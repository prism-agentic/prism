/**
 * ConcurrentExecutor — 并发执行器
 *
 * 基于 TaskExecutor 接口的并发执行策略。
 * 同一阶段内的多个 Agent 并行工作，缩短流水线总耗时。
 *
 * 核心设计：
 * - 阶段间仍然串行（因为后续阶段依赖前序阶段的输出）
 * - 同阶段内的 Agent 并发执行（Promise.allSettled）
 * - 通过事件队列保证事件产出的有序性
 * - 上下文依赖自动解析：只有当依赖的 Agent 都完成后才开始
 * - 质量门控逻辑与 SequentialExecutor 共享
 *
 * 并发安全：
 * - agentOutputs 的写入通过 outputKey 隔离，不同 Agent 写不同 key
 * - 事件队列通过 push + drain 模式保证顺序
 */

import type { TaskExecutor, ExecutorContext } from "./types";
import type { TaskEvent, AgentIdentity } from "../../shared/taskEvents";
import type { GatePhase, VerificationReport } from "../../shared/verification";
import {
  AGENT_REGISTRY,
  PIPELINE_PHASES,
  AGENT_LIST,
  getActionLabel,
  buildAgentContext,
} from "./agentRegistry";
import { callAgent } from "./llmHelper";
import { createAgentLog, updateTask } from "../db";
import { VerificationEngine } from "../verification";

// ─── 门控阶段映射（与 SequentialExecutor 一致） ─────────────────
const GATE_AFTER_PHASE: Record<number, GatePhase> = {
  1: "post_strategy",
  3: "post_build",
  4: "final",
};

// ─── 并发 Agent 执行结果 ─────────────────────────────────────
interface AgentResult {
  role: string;
  outputKey: string;
  output: string;
  durationMs: number;
  events: TaskEvent[];
}

export class ConcurrentExecutor implements TaskExecutor {
  readonly name = "concurrent";

  async *execute(ctx: ExecutorContext): AsyncGenerator<TaskEvent, void, unknown> {
    let agentOutputs: Record<string, string> = {};

    // 初始化验证引擎
    const verificationEngine = new VerificationEngine((event) => {
      console.log(`[Verification] 事件: ${event.type}`, JSON.stringify(event));
    });

    // ─── 注入需求简报 & 提取验收标准 ───────────────────────
    if (ctx.config.requirementsBrief) {
      agentOutputs["requirements_brief"] = ctx.config.requirementsBrief;

      try {
        yield* this.emitGateLog(ctx.taskId, -1, "提取验收标准", "📋 正在从需求简报中提取验收标准...", "thinking");

        const criteriaSet = await verificationEngine.extractCriteria(ctx.taskId, ctx.config.requirementsBrief);

        const mustCount = criteriaSet.criteria.filter(c => c.priority === "must").length;
        const shouldCount = criteriaSet.criteria.filter(c => c.priority === "should").length;
        const niceCount = criteriaSet.criteria.filter(c => c.priority === "nice_to_have").length;

        yield* this.emitGateLog(
          ctx.taskId,
          -1,
          "验收标准已就绪",
          `📋 已从需求简报中提取 **${criteriaSet.criteria.length}** 条验收标准\n\n` +
          `- 🔴 必须 (Must): ${mustCount} 条\n` +
          `- 🟡 应该 (Should): ${shouldCount} 条\n` +
          `- 🟢 可选 (Nice-to-have): ${niceCount} 条\n\n` +
          `**标准列表：**\n` +
          criteriaSet.criteria.map(c => {
            const icon = c.priority === "must" ? "🔴" : c.priority === "should" ? "🟡" : "🟢";
            return `${icon} ${c.id}: ${c.description}`;
          }).join("\n"),
          "done",
        );
      } catch (error) {
        console.error("[ConcurrentExecutor] 验收标准提取失败:", error);
        yield* this.emitGateLog(
          ctx.taskId,
          -1,
          "验收标准提取跳过",
          `⚠️ 验收标准提取失败，流水线将在无门控模式下继续执行。\n\n错误: ${String(error)}`,
          "error",
        );
      }
    }

    // ─── 发射任务开始事件 ───────────────────────────────────
    yield {
      type: "task:status",
      taskId: ctx.taskId,
      status: "running",
      timestamp: Date.now(),
    };

    await updateTask(ctx.taskId, {
      status: "running",
      startedAt: new Date(),
      currentPhase: 0,
    });

    try {
      // ─── 主流水线循环（阶段间串行） ───────────────────────
      for (const phase of PIPELINE_PHASES) {
        // 发射阶段变更事件
        yield {
          type: "phase:change",
          taskId: ctx.taskId,
          phase: { index: phase.index, name: phase.name, agents: phase.agents },
          timestamp: Date.now(),
        };

        await updateTask(ctx.taskId, { currentPhase: phase.index });

        // ─── 阶段内并发执行 ─────────────────────────────
        if (phase.agents.length === 1) {
          // 单 Agent 阶段：直接串行执行（无需并发开销）
          yield* this.executeAgent(ctx, phase.index, phase.agents[0], agentOutputs);
        } else {
          // 多 Agent 阶段：并发执行
          yield* this.executeConcurrentAgents(ctx, phase.index, phase.agents, agentOutputs);
        }

        // ─── 质量门控检查 ─────────────────────────────────
        const gatePhase = GATE_AFTER_PHASE[phase.index];
        if (gatePhase && verificationEngine.getCriteria()) {
          const gateResult = yield* this.runQualityGate(
            verificationEngine,
            ctx.taskId,
            gatePhase,
            phase.index,
            agentOutputs,
            ctx.prompt,
            ctx.config.modelId,
          );
          agentOutputs = gateResult.updatedOutputs;
        }
      }

      // ─── 构建结果摘要 ───────────────────────────────────
      const criteria = verificationEngine.getCriteria();
      const resultSummary = this.buildResultSummary(
        ctx.prompt,
        agentOutputs,
        criteria ? criteria.criteria.length : 0,
      );

      // 发射任务完成事件
      yield {
        type: "task:status",
        taskId: ctx.taskId,
        status: "completed",
        timestamp: Date.now(),
      };

      await updateTask(ctx.taskId, {
        status: "completed",
        currentPhase: 5,
        completedAt: new Date(),
        result: resultSummary,
      });
    } catch (error) {
      console.error("[ConcurrentExecutor] 流水线错误:", error);

      yield {
        type: "error",
        taskId: ctx.taskId,
        message: String(error),
        recoverable: false,
        timestamp: Date.now(),
      };

      yield {
        type: "task:status",
        taskId: ctx.taskId,
        status: "failed",
        timestamp: Date.now(),
      };

      await updateTask(ctx.taskId, {
        status: "failed",
        completedAt: new Date(),
        result: { error: String(error) },
      }).catch(() => {});
    }
  }

  // ─── 并发执行同阶段的多个 Agent ─────────────────────────────

  /**
   * 并发执行同阶段的多个 Agent。
   *
   * 策略：
   * 1. 分析每个 Agent 的 contextFrom 依赖
   * 2. 依赖已满足的 Agent 立即启动
   * 3. 依赖未满足的 Agent 等待依赖完成后启动
   * 4. 所有 Agent 通过 Promise.allSettled 并发执行
   *
   * 注意：同阶段的 Agent 通常互不依赖（如 backend 和 frontend 在 Scaffold 阶段），
   * 但在 Build 阶段 devops 依赖 backend_build，需要等待。
   */
  private async *executeConcurrentAgents(
    ctx: ExecutorContext,
    phaseIndex: number,
    agentRoles: string[],
    agentOutputs: Record<string, string>,
  ): AsyncGenerator<TaskEvent, void, unknown> {
    // 分析依赖关系，分为可立即执行和需等待的
    const { immediate, deferred } = this.analyzeDependencies(agentRoles, agentOutputs, phaseIndex);

    console.log(
      `[ConcurrentExecutor] 阶段 ${phaseIndex}: 并发=${immediate.length}, 延迟=${deferred.length}`,
    );

    // 第一批：并发执行所有可立即启动的 Agent
    if (immediate.length > 0) {
      const results = await this.runAgentsConcurrently(ctx, phaseIndex, immediate, agentOutputs);

      // 按顺序产出所有事件
      for (const result of results) {
        for (const event of result.events) {
          yield event;
        }
        // 存储输出到 agentOutputs（供后续 Agent 使用）
        agentOutputs[result.outputKey] = result.output;
      }
    }

    // 第二批：依赖已满足的延迟 Agent（此时第一批已完成）
    if (deferred.length > 0) {
      // 重新检查依赖是否已满足
      const nowReady: string[] = [];
      const stillWaiting: string[] = [];

      for (const role of deferred) {
        if (this.areDependenciesMet(role, agentOutputs, phaseIndex)) {
          nowReady.push(role);
        } else {
          stillWaiting.push(role);
        }
      }

      // 并发执行已就绪的
      if (nowReady.length > 0) {
        const results = await this.runAgentsConcurrently(ctx, phaseIndex, nowReady, agentOutputs);
        for (const result of results) {
          for (const event of result.events) {
            yield event;
          }
          agentOutputs[result.outputKey] = result.output;
        }
      }

      // 仍未就绪的串行执行（兜底）
      for (const role of stillWaiting) {
        yield* this.executeAgent(ctx, phaseIndex, role, agentOutputs);
      }
    }
  }

  // ─── 并发运行一组 Agent ─────────────────────────────────────

  private async runAgentsConcurrently(
    ctx: ExecutorContext,
    phaseIndex: number,
    agentRoles: string[],
    agentOutputs: Record<string, string>,
  ): Promise<AgentResult[]> {
    const promises = agentRoles.map(role =>
      this.runSingleAgentCollectEvents(ctx, phaseIndex, role, agentOutputs),
    );

    const settled = await Promise.allSettled(promises);

    const results: AgentResult[] = [];
    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        // Agent 执行失败，生成错误事件
        const role = agentRoles[i];
        const agentDef = AGENT_REGISTRY[role];
        console.error(`[ConcurrentExecutor] Agent ${role} 执行失败:`, result.reason);
        results.push({
          role,
          outputKey: role,
          output: `[错误] Agent ${agentDef?.name ?? role} 执行失败: ${String(result.reason)}`,
          durationMs: 0,
          events: [
            {
              type: "agent:status",
              taskId: ctx.taskId,
              agent: {
                name: agentDef?.name ?? role,
                role,
                department: agentDef?.department ?? "unknown",
              },
              phase: phaseIndex,
              status: "error",
              action: `执行失败: ${String(result.reason).substring(0, 100)}`,
              timestamp: Date.now(),
            },
          ],
        });
      }
    }

    return results;
  }

  // ─── 单个 Agent 执行（收集事件而非直接 yield） ─────────────────

  private async runSingleAgentCollectEvents(
    ctx: ExecutorContext,
    phaseIndex: number,
    agentRole: string,
    agentOutputs: Record<string, string>,
  ): Promise<AgentResult> {
    const agentDef = AGENT_REGISTRY[agentRole];
    if (!agentDef) {
      throw new Error(`Agent ${agentRole} 未在注册表中找到`);
    }

    const agent: AgentIdentity = {
      name: agentDef.name,
      role: agentDef.role,
      department: agentDef.department,
    };
    const actionLabel = getActionLabel(agentRole, phaseIndex);
    const events: TaskEvent[] = [];

    // Agent 思考中
    events.push({
      type: "agent:status",
      taskId: ctx.taskId,
      agent,
      phase: phaseIndex,
      status: "thinking",
      action: actionLabel,
      timestamp: Date.now(),
    });

    await createAgentLog({
      taskId: ctx.taskId,
      agentName: agent.name,
      agentRole: agent.role,
      phase: phaseIndex,
      action: actionLabel,
      content: null,
      status: "thinking",
    });

    // 构建上下文
    const previousContext = buildAgentContext(agentOutputs, agentRole);

    // Agent 工作中
    events.push({
      type: "agent:status",
      taskId: ctx.taskId,
      agent,
      phase: phaseIndex,
      status: "working",
      action: actionLabel,
      timestamp: Date.now(),
    });

    await createAgentLog({
      taskId: ctx.taskId,
      agentName: agent.name,
      agentRole: agent.role,
      phase: phaseIndex,
      action: actionLabel,
      content: "正在使用 AI 分析并生成交付物...",
      status: "working",
    });

    // 调用 LLM
    const startTime = Date.now();
    const output = await callAgent(agentRole, ctx.prompt, previousContext, ctx.config.modelId);
    const durationMs = Date.now() - startTime;

    // 确定输出键
    const outputKey = phaseIndex === 3 && agentRole !== "devops"
      ? `${agentRole}_build`
      : agentRole;

    // Agent 输出
    events.push({
      type: "agent:output",
      taskId: ctx.taskId,
      agent,
      phase: phaseIndex,
      content: output,
      isStreaming: false,
      timestamp: Date.now(),
    });

    // Agent 完成
    events.push({
      type: "agent:status",
      taskId: ctx.taskId,
      agent,
      phase: phaseIndex,
      status: "done",
      action: actionLabel,
      timestamp: Date.now(),
    });

    await createAgentLog({
      taskId: ctx.taskId,
      agentName: agent.name,
      agentRole: agent.role,
      phase: phaseIndex,
      action: actionLabel,
      content: output,
      status: "done",
      durationMs,
    });

    return { role: agentRole, outputKey, output, durationMs, events };
  }

  // ─── 串行执行单个 Agent（兜底 / 单 Agent 阶段） ─────────────────

  private async *executeAgent(
    ctx: ExecutorContext,
    phaseIndex: number,
    agentRole: string,
    agentOutputs: Record<string, string>,
  ): AsyncGenerator<TaskEvent, void, unknown> {
    const agentDef = AGENT_REGISTRY[agentRole];
    if (!agentDef) return;

    const agent: AgentIdentity = {
      name: agentDef.name,
      role: agentDef.role,
      department: agentDef.department,
    };
    const actionLabel = getActionLabel(agentRole, phaseIndex);

    yield {
      type: "agent:status",
      taskId: ctx.taskId,
      agent,
      phase: phaseIndex,
      status: "thinking",
      action: actionLabel,
      timestamp: Date.now(),
    };

    await createAgentLog({
      taskId: ctx.taskId,
      agentName: agent.name,
      agentRole: agent.role,
      phase: phaseIndex,
      action: actionLabel,
      content: null,
      status: "thinking",
    });

    const previousContext = buildAgentContext(agentOutputs, agentRole);

    yield {
      type: "agent:status",
      taskId: ctx.taskId,
      agent,
      phase: phaseIndex,
      status: "working",
      action: actionLabel,
      timestamp: Date.now(),
    };

    await createAgentLog({
      taskId: ctx.taskId,
      agentName: agent.name,
      agentRole: agent.role,
      phase: phaseIndex,
      action: actionLabel,
      content: "正在使用 AI 分析并生成交付物...",
      status: "working",
    });

    const startTime = Date.now();
    const output = await callAgent(agentRole, ctx.prompt, previousContext, ctx.config.modelId);
    const durationMs = Date.now() - startTime;

    const outputKey = phaseIndex === 3 && agentRole !== "devops"
      ? `${agentRole}_build`
      : agentRole;
    agentOutputs[outputKey] = output;

    yield {
      type: "agent:output",
      taskId: ctx.taskId,
      agent,
      phase: phaseIndex,
      content: output,
      isStreaming: false,
      timestamp: Date.now(),
    };

    yield {
      type: "agent:status",
      taskId: ctx.taskId,
      agent,
      phase: phaseIndex,
      status: "done",
      action: actionLabel,
      timestamp: Date.now(),
    };

    await createAgentLog({
      taskId: ctx.taskId,
      agentName: agent.name,
      agentRole: agent.role,
      phase: phaseIndex,
      action: actionLabel,
      content: output,
      status: "done",
      durationMs,
    });
  }

  // ─── 依赖分析 ─────────────────────────────────────────

  /**
   * 分析同阶段 Agent 的依赖关系，分为可立即执行和需延迟的。
   *
   * 规则：
   * - 如果 Agent 的 contextFrom 中的所有依赖都已在 agentOutputs 中，则可立即执行
   * - 如果依赖中包含同阶段的其他 Agent（如 Build 阶段的 devops 依赖 backend_build），
   *   则需要延迟到第一批完成后
   */
  private analyzeDependencies(
    agentRoles: string[],
    agentOutputs: Record<string, string>,
    phaseIndex: number,
  ): { immediate: string[]; deferred: string[] } {
    const immediate: string[] = [];
    const deferred: string[] = [];

    // 计算同阶段 Agent 会产出的 outputKey
    const samePhaseOutputKeys = new Set(
      agentRoles.map(role =>
        phaseIndex === 3 && role !== "devops" ? `${role}_build` : role,
      ),
    );

    for (const role of agentRoles) {
      const agentDef = AGENT_REGISTRY[role];
      if (!agentDef) continue;

      // 检查是否有依赖指向同阶段的其他 Agent 的输出
      const hasSamePhaseDep = agentDef.contextFrom.some(dep => {
        // 依赖不在已有输出中，且是同阶段 Agent 的输出
        return !agentOutputs[dep] && samePhaseOutputKeys.has(dep);
      });

      if (hasSamePhaseDep) {
        deferred.push(role);
      } else {
        immediate.push(role);
      }
    }

    return { immediate, deferred };
  }

  /**
   * 检查 Agent 的所有依赖是否已满足
   */
  private areDependenciesMet(
    agentRole: string,
    agentOutputs: Record<string, string>,
    _phaseIndex: number,
  ): boolean {
    const agentDef = AGENT_REGISTRY[agentRole];
    if (!agentDef) return true;

    return agentDef.contextFrom.every(dep => !!agentOutputs[dep]);
  }

  // ─── 质量门控（与 SequentialExecutor 共享逻辑） ─────────────────

  private async *runQualityGate(
    engine: VerificationEngine,
    taskId: number,
    gate: GatePhase,
    phaseIndex: number,
    agentOutputs: Record<string, string>,
    prompt: string,
    modelId?: string,
  ): AsyncGenerator<TaskEvent, { passed: boolean; updatedOutputs: Record<string, string> }, unknown> {
    const gateLabels: Record<GatePhase, string> = {
      post_strategy: "策略阶段质量门控",
      post_build: "构建阶段质量门控",
      final: "最终质量验证",
    };

    const label = gateLabels[gate];

    yield {
      type: "gate:status",
      taskId,
      gate,
      phase: phaseIndex,
      status: "started",
      message: `🔍 开始 ${label}：正在对照验收标准验证各智能体输出...`,
      timestamp: Date.now(),
    };

    yield* this.emitGateLog(taskId, phaseIndex, label, `🔍 开始 ${label}：正在对照验收标准验证各智能体输出...`, "thinking");

    try {
      yield {
        type: "gate:status",
        taskId,
        gate,
        phase: phaseIndex,
        status: "verifying",
        message: `正在验证 ${label}...`,
        timestamp: Date.now(),
      };

      const report = await engine.runGate(taskId, gate, agentOutputs);

      if (report.gatePass) {
        const passedCount = report.results.filter(r => r.status === "pass").length;
        const totalCount = report.results.length;

        yield {
          type: "gate:status",
          taskId,
          gate,
          phase: phaseIndex,
          status: "passed",
          score: report.overallScore,
          threshold: report.gateThreshold,
          report,
          message: `✅ ${label}通过（评分: ${report.overallScore}/100）`,
          timestamp: Date.now(),
        };

        yield* this.emitGateLog(
          taskId,
          phaseIndex,
          label,
          `✅ ${label}通过（评分: ${report.overallScore}/100，阈值: ${report.gateThreshold}）\n\n` +
          `**验证结果**：${passedCount}/${totalCount} 条标准通过\n\n` +
          this.formatGateResults(report),
          "done",
        );

        return { passed: true, updatedOutputs: agentOutputs };
      }

      // 门控未通过 → 修复循环
      const failedCriteria = report.results.filter(r => r.status === "fail" || r.status === "partial");

      yield {
        type: "gate:status",
        taskId,
        gate,
        phase: phaseIndex,
        status: "failed",
        score: report.overallScore,
        threshold: report.gateThreshold,
        report,
        message: `⚠️ ${label}未通过（评分: ${report.overallScore}/100），启动修复循环...`,
        timestamp: Date.now(),
      };

      yield* this.emitGateLog(
        taskId,
        phaseIndex,
        label,
        `⚠️ ${label}未通过（评分: ${report.overallScore}/100，阈值: ${report.gateThreshold}）\n\n` +
        `**失败标准**：${failedCriteria.length} 条\n\n` +
        this.formatGateResults(report) +
        `\n\n正在启动定向修复循环...`,
        "reviewing",
      );

      yield {
        type: "gate:status",
        taskId,
        gate,
        phase: phaseIndex,
        status: "fixing",
        message: `🔧 正在针对失败标准进行定向修复...`,
        timestamp: Date.now(),
      };

      yield* this.emitGateLog(taskId, phaseIndex, `${label} — 修复`, `🔧 正在针对失败标准进行定向修复...`, "working");

      const fixResult = await engine.runFixAndReVerify(
        taskId,
        gate,
        report,
        agentOutputs,
        async (role: string, fixPrompt: string, context: string) => {
          return callAgent(role, fixPrompt, context, modelId);
        },
      );

      if (fixResult.decision === "pass") {
        yield {
          type: "gate:status",
          taskId,
          gate,
          phase: phaseIndex,
          status: "passed",
          score: fixResult.report.overallScore,
          threshold: fixResult.report.gateThreshold,
          report: fixResult.report,
          message: `✅ 修复后重新验证通过（评分: ${fixResult.report.overallScore}/100）`,
          timestamp: Date.now(),
        };

        yield* this.emitGateLog(
          taskId,
          phaseIndex,
          `${label} — 修复完成`,
          `✅ 修复后重新验证通过（评分: ${fixResult.report.overallScore}/100）\n\n` +
          this.formatGateResults(fixResult.report),
          "done",
        );
        return { passed: true, updatedOutputs: fixResult.updatedOutputs };
      }

      if (fixResult.decision === "degraded_pass") {
        yield {
          type: "gate:status",
          taskId,
          gate,
          phase: phaseIndex,
          status: "degraded_pass",
          score: fixResult.report.overallScore,
          threshold: fixResult.report.gateThreshold,
          report: fixResult.report,
          message: `⚠️ 降级通过（评分: ${fixResult.report.overallScore}/100）`,
          timestamp: Date.now(),
        };

        yield* this.emitGateLog(
          taskId,
          phaseIndex,
          `${label} — 降级通过`,
          `⚠️ 修复后评分提升但未达阈值（评分: ${fixResult.report.overallScore}/100）。所有必须项已通过，降级放行。\n\n` +
          this.formatGateResults(fixResult.report),
          "reviewing",
        );
        return { passed: true, updatedOutputs: fixResult.updatedOutputs };
      }

      // user_intervention
      yield {
        type: "gate:status",
        taskId,
        gate,
        phase: phaseIndex,
        status: "failed",
        score: fixResult.report.overallScore,
        threshold: fixResult.report.gateThreshold,
        report: fixResult.report,
        message: `❌ 修复后仍有关键标准未通过`,
        timestamp: Date.now(),
      };

      yield* this.emitGateLog(
        taskId,
        phaseIndex,
        `${label} — 需要关注`,
        `❌ 修复后仍有关键标准未通过（评分: ${fixResult.report.overallScore}/100）。流水线继续执行，但交付质量可能受影响。\n\n` +
        this.formatGateResults(fixResult.report),
        "error",
      );

      return { passed: false, updatedOutputs: fixResult.updatedOutputs };
    } catch (error) {
      console.error(`[ConcurrentExecutor] ${label} 执行出错:`, error);

      yield {
        type: "gate:status",
        taskId,
        gate,
        phase: phaseIndex,
        status: "failed",
        message: `⚠️ ${label}执行出错，已跳过`,
        timestamp: Date.now(),
      };

      yield* this.emitGateLog(
        taskId,
        phaseIndex,
        `${label} — 跳过`,
        `⚠️ ${label}执行出错，已跳过。流水线继续执行。\n\n错误: ${String(error)}`,
        "error",
      );

      return { passed: false, updatedOutputs: agentOutputs };
    }
  }

  // ─── 辅助方法 ─────────────────────────────────────────

  private async *emitGateLog(
    taskId: number,
    phase: number,
    action: string,
    content: string,
    status: "thinking" | "working" | "done" | "error" | "reviewing",
  ): AsyncGenerator<TaskEvent, void, unknown> {
    await createAgentLog({
      taskId,
      agentName: "Quality Gate",
      agentRole: "gate",
      phase,
      action,
      content,
      status,
    });

    yield {
      type: "agent:output",
      taskId,
      agent: { name: "Quality Gate", role: "gate", department: "verification" },
      phase,
      content,
      isStreaming: false,
      timestamp: Date.now(),
    };
  }

  private formatGateResults(report: VerificationReport): string {
    const lines: string[] = [];
    for (const result of report.results) {
      const statusIcon = {
        pass: "✅",
        fail: "❌",
        partial: "⚠️",
        not_applicable: "➖",
      }[result.status];
      lines.push(`${statusIcon} **${result.criterionId}**: ${result.reasoning}`);
      if (result.fixSuggestion) {
        lines.push(`  💡 修复建议: ${result.fixSuggestion}`);
      }
    }
    return lines.join("\n");
  }

  private buildResultSummary(
    prompt: string,
    outputs: Record<string, string>,
    criteriaCount: number = 0,
  ): Record<string, unknown> {
    return {
      summary: `任务「${prompt}」已通过 6 个流水线阶段、${AGENT_LIST.length} 个专业 AI 智能体成功完成（并发模式）。` +
        (criteriaCount > 0 ? ` 经过 ${criteriaCount} 条验收标准的质量门控验证。` : ""),
      executionMode: "concurrent",
      phases: PIPELINE_PHASES.map(p => p.name),
      agentsUsed: AGENT_LIST.length,
      qualityGates: criteriaCount > 0 ? {
        criteriaCount,
        gatesExecuted: ["post_strategy", "post_build", "final"],
      } : undefined,
      deliverables: Object.entries(outputs)
        .filter(([role]) => role !== "requirements_brief")
        .map(([role, content]) => ({
          agent: AGENT_REGISTRY[role]?.name ?? role,
          role,
          contentLength: content.length,
          preview: content.substring(0, 200) + (content.length > 200 ? "..." : ""),
        })),
    };
  }
}
