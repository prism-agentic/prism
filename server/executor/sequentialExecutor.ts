/**
 * SequentialExecutor — 串行执行器
 *
 * 将现有 agentSimulator.ts 的核心逻辑封装为 TaskExecutor 接口实现。
 * 保留完整的功能：
 * - 6 阶段串行流水线
 * - 质量门控（3 个 Gate）
 * - 修复循环
 * - 验收标准提取
 *
 * 核心变化：
 * - 不再直接写数据库，而是通过 yield TaskEvent 产出事件
 * - 数据库持久化由 Orchestrator 在消费事件时完成
 * - 但为了向后兼容，当前仍在内部做持久化（后续可迁移到 Orchestrator）
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

// ─── 门控阶段映射 ─────────────────────────────────────────────
const GATE_AFTER_PHASE: Record<number, GatePhase> = {
  1: "post_strategy",
  3: "post_build",
  4: "final",
};

export class SequentialExecutor implements TaskExecutor {
  readonly name = "sequential";

  async *execute(ctx: ExecutorContext): AsyncGenerator<TaskEvent, void, unknown> {
    let agentOutputs: Record<string, string> = {};

    // 初始化验证引擎
    const verificationEngine = new VerificationEngine((event) => {
      console.log(`[Verification] 事件: ${event.type}`, JSON.stringify(event));
    });

    // ─── 注入需求简报 & 提取验收标准 ───────────────────────
    if (ctx.config.requirementsBrief) {
      agentOutputs["requirements_brief"] = ctx.config.requirementsBrief;

      // 提取验收标准
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
        console.error("[SequentialExecutor] 验收标准提取失败:", error);
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
      // ─── 主流水线循环 ───────────────────────────────────
      for (const phase of PIPELINE_PHASES) {
        // 发射阶段变更事件
        yield {
          type: "phase:change",
          taskId: ctx.taskId,
          phase: { index: phase.index, name: phase.name, agents: phase.agents },
          timestamp: Date.now(),
        };

        await updateTask(ctx.taskId, { currentPhase: phase.index });

        // 执行该阶段的每个 Agent
        for (const agentRole of phase.agents) {
          const agentDef = AGENT_REGISTRY[agentRole];
          if (!agentDef) continue;

          const agent: AgentIdentity = {
            name: agentDef.name,
            role: agentDef.role,
            department: agentDef.department,
          };
          const actionLabel = getActionLabel(agentRole, phase.index);

          // 发射 Agent 思考中
          yield {
            type: "agent:status",
            taskId: ctx.taskId,
            agent,
            phase: phase.index,
            status: "thinking",
            action: actionLabel,
            timestamp: Date.now(),
          };

          await createAgentLog({
            taskId: ctx.taskId,
            agentName: agent.name,
            agentRole: agent.role,
            phase: phase.index,
            action: actionLabel,
            content: null,
            status: "thinking",
          });

          // 构建上下文
          const previousContext = buildAgentContext(agentOutputs, agentRole);

          // 发射 Agent 工作中
          yield {
            type: "agent:status",
            taskId: ctx.taskId,
            agent,
            phase: phase.index,
            status: "working",
            action: actionLabel,
            timestamp: Date.now(),
          };

          await createAgentLog({
            taskId: ctx.taskId,
            agentName: agent.name,
            agentRole: agent.role,
            phase: phase.index,
            action: actionLabel,
            content: "正在使用 AI 分析并生成交付物...",
            status: "working",
          });

          // 调用 LLM
          const startTime = Date.now();
          const output = await callAgent(agentRole, ctx.prompt, previousContext, ctx.config.modelId);
          const durationMs = Date.now() - startTime;

          // 存储输出用于上下文链
          const outputKey = phase.index === 3 && agentRole !== "devops"
            ? `${agentRole}_build`
            : agentRole;
          agentOutputs[outputKey] = output;

          // 发射 Agent 输出
          yield {
            type: "agent:output",
            taskId: ctx.taskId,
            agent,
            phase: phase.index,
            content: output,
            isStreaming: false,
            timestamp: Date.now(),
          };

          // 发射 Agent 完成
          yield {
            type: "agent:status",
            taskId: ctx.taskId,
            agent,
            phase: phase.index,
            status: "done",
            action: actionLabel,
            timestamp: Date.now(),
          };

          await createAgentLog({
            taskId: ctx.taskId,
            agentName: agent.name,
            agentRole: agent.role,
            phase: phase.index,
            action: actionLabel,
            content: output,
            status: "done",
            durationMs,
          });
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

          // 使用修复后的输出
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
      console.error("[SequentialExecutor] 流水线错误:", error);

      // 发射错误事件
      yield {
        type: "error",
        taskId: ctx.taskId,
        message: String(error),
        recoverable: false,
        timestamp: Date.now(),
      };

      // 发射任务失败事件
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

  // ─── 质量门控执行 ─────────────────────────────────────────

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

    // 门控开始
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
      // 门控验证中
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
        // 门控通过
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

      // 门控未通过
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

      // 修复循环
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

      // 修复结果
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

      // user_intervention — 修复失败
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
      console.error(`[SequentialExecutor] ${label} 执行出错:`, error);

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

  /** 发射门控日志（同时写数据库和产出事件） */
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

    // 也发射为 agent:output 事件，让前端能实时看到门控日志
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

  /** 格式化门控结果 */
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

  /** 构建最终结果摘要 */
  private buildResultSummary(
    prompt: string,
    outputs: Record<string, string>,
    criteriaCount: number = 0,
  ): Record<string, unknown> {
    return {
      summary: `任务「${prompt}」已通过 6 个流水线阶段、${AGENT_LIST.length} 个专业 AI 智能体成功完成。` +
        (criteriaCount > 0 ? ` 经过 ${criteriaCount} 条验收标准的质量门控验证。` : ""),
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
