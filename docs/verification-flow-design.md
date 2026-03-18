# PRISM 自动化验证流程设计

**版本：** v1.0
**日期：** 2026-03-18
**作者：** Manus AI

---

## 1. 设计背景

### 1.1 问题陈述

PRISM 当前的流水线包含 6 个阶段（Discover → Strategy → Scaffold → Build → Harden → Launch），其中 Harden 阶段由 Quality Critic Agent 执行一次性审查。这种设计存在三个核心问题：

**验证滞后。** Critic Agent 位于流水线倒数第二个阶段（Phase 4），此时所有设计和实现决策已经完成。如果发现严重问题（如架构设计与需求不匹配），修复成本极高 — 需要回退到 Phase 1-2 重新执行，浪费前序 Agent 的全部计算。

**验证单一。** 当前 Critic 只做一次审查，产出一份报告。它没有能力要求某个 Agent 修改输出，也没有机制验证修改后的结果是否真正解决了问题。这相当于只有"发现问题"的能力，没有"解决问题"的闭环。

**缺乏需求对照。** Critic 的审查依赖其系统提示词中的通用标准（"识别问题、检查安全、验证完整性"），但没有将需求简报作为结构化的验收标准逐条对照。这意味着即使所有 Agent 都产出了高质量的内容，也可能整体偏离了用户的原始需求。

### 1.2 设计目标

借鉴 Qoder Quest 1.0 的 **Spec → Coding → Verify** 闭环思路 [1]，为 PRISM 设计一个自动化验证流程，实现以下目标：

1. **需求驱动验证** — 将需求简报转化为结构化验收标准，每个交付物都对照标准逐条验证
2. **分层验证** — 不只在最后验证，而是在每个关键阶段设置质量门控
3. **闭环修复** — 发现问题后能自动触发修复，并验证修复结果
4. **可观测** — 验证过程对用户透明，用户能看到每个验收标准的通过/失败状态

---

## 2. 核心概念

### 2.1 验收标准（Acceptance Criteria）

验收标准是连接需求和验证的桥梁。它从需求简报中自动提取，是一组结构化的、可判定的条件。

```typescript
// shared/verification.ts

/** 单条验收标准 */
export interface AcceptanceCriterion {
  /** 唯一标识 */
  id: string;
  /** 来源：需求简报中的哪个部分 */
  source: "core_feature" | "tech_preference" | "success_metric" | "key_decision";
  /** 标准描述 */
  description: string;
  /** 验证方式 */
  verifyMethod: "content_check" | "structure_check" | "consistency_check";
  /** 关联的 Agent 角色（哪些 Agent 的输出需要满足此标准） */
  relatedAgents: string[];
  /** 优先级 */
  priority: "must" | "should" | "nice_to_have";
}

/** 验收标准集 */
export interface AcceptanceCriteriaSet {
  taskId: number;
  /** 从需求简报自动提取的标准列表 */
  criteria: AcceptanceCriterion[];
  /** 提取时间 */
  generatedAt: number;
  /** 需求简报的摘要哈希（用于检测需求变更） */
  briefHash: string;
}
```

**提取流程：** 需求会议结束、产品经理生成需求简报后，立即调用一次 LLM 将简报转化为结构化的验收标准集。这个过程发生在流水线启动之前，确保所有 Agent 和验证器共享同一套标准。

### 2.2 验证报告（Verification Report）

每次验证产出一份结构化报告，记录每条验收标准的验证结果。

```typescript
/** 单条标准的验证结果 */
export interface CriterionResult {
  criterionId: string;
  /** 验证状态 */
  status: "pass" | "fail" | "partial" | "not_applicable";
  /** 验证说明 */
  reasoning: string;
  /** 如果失败，需要哪个 Agent 修复 */
  fixAgent?: string;
  /** 修复建议 */
  fixSuggestion?: string;
}

/** 验证报告 */
export interface VerificationReport {
  taskId: number;
  /** 验证阶段 */
  phase: "post_strategy" | "post_build" | "final";
  /** 各标准的验证结果 */
  results: CriterionResult[];
  /** 总体评分 (0-100) */
  overallScore: number;
  /** 是否通过门控 */
  gatePass: boolean;
  /** 门控阈值 */
  gateThreshold: number;
  /** 验证时间 */
  verifiedAt: number;
}
```

### 2.3 质量门控（Quality Gate）

质量门控是流水线中的检查点。当验证报告的 `gatePass` 为 `false` 时，流水线暂停，进入修复循环。

---

## 3. 验证流程架构

### 3.1 整体流程

PRISM 的验证流程采用**三层门控 + 闭环修复**模式，嵌入到现有的 6 阶段流水线中：

```
需求会议
  │
  ▼
┌─────────────────────────────────────────────────┐
│  Spec 阶段：提取验收标准                          │
│  需求简报 → AcceptanceCriteriaSet                │
└─────────────────────────────────────────────────┘
  │
  ▼
Phase 0: Discover (Conductor + Researcher)
Phase 1: Strategy (PM + UX)
  │
  ▼
┌─────────────────────────────────────────────────┐
│  Gate 1：策略验证（post_strategy）                │
│  验证 PM 和 UX 的输出是否覆盖核心需求             │
│  阈值：80 分                                     │
│  失败 → 修复循环（最多 2 轮）                     │
└─────────────────────────────────────────────────┘
  │ (通过)
  ▼
Phase 2: Scaffold (Backend + Frontend)
Phase 3: Build (Backend + Frontend + DevOps)
  │
  ▼
┌─────────────────────────────────────────────────┐
│  Gate 2：构建验证（post_build）                   │
│  验证实现是否与策略一致、代码是否完整              │
│  阈值：75 分                                     │
│  失败 → 修复循环（最多 2 轮）                     │
└─────────────────────────────────────────────────┘
  │ (通过)
  ▼
Phase 4: Harden (Critic — 升级为 Verifier)
  │
  ▼
┌─────────────────────────────────────────────────┐
│  Gate 3：最终验证（final）                        │
│  逐条对照验收标准，生成完整验证报告               │
│  阈值：85 分                                     │
│  失败 → 定向修复（最多 1 轮）                     │
└─────────────────────────────────────────────────┘
  │ (通过)
  ▼
Phase 5: Launch (Growth)
  │
  ▼
交付给用户（附验证报告）
```

### 3.2 与现有流水线的关系

验证流程**不改变现有的 6 阶段结构**，而是在阶段之间插入门控检查点。对现有代码的影响最小化：

| 变更点 | 现有代码 | 新增/修改 |
|--------|---------|----------|
| 需求简报后 | `generateRequirementsBrief()` 返回简报文本 | 新增：调用 `extractAcceptanceCriteria()` 提取验收标准 |
| Phase 1 后 | 直接进入 Phase 2 | 新增：插入 Gate 1 验证 |
| Phase 3 后 | 直接进入 Phase 4 | 新增：插入 Gate 2 验证 |
| Phase 4 (Critic) | 通用审查，产出文本报告 | 修改：升级为结构化验证，产出 `VerificationReport` |
| Phase 5 后 | 标记任务完成 | 修改：将验证报告附加到任务结果中 |

### 3.3 事件系统扩展

在现有的 `TaskEvent` 联合类型中新增验证相关事件：

```typescript
// shared/taskEvents.ts — 新增

/** 验收标准提取完成 */
export interface CriteriaExtractedEvent {
  type: "verify:criteria_extracted";
  taskId: number;
  criteriaCount: number;
  mustCount: number;
  timestamp: number;
}

/** 质量门控开始 */
export interface GateStartEvent {
  type: "verify:gate_start";
  taskId: number;
  gate: "post_strategy" | "post_build" | "final";
  criteriaCount: number;
  timestamp: number;
}

/** 单条标准验证完成 */
export interface CriterionVerifiedEvent {
  type: "verify:criterion_result";
  taskId: number;
  gate: string;
  criterionId: string;
  status: "pass" | "fail" | "partial" | "not_applicable";
  reasoning: string;
  timestamp: number;
}

/** 质量门控结果 */
export interface GateResultEvent {
  type: "verify:gate_result";
  taskId: number;
  gate: string;
  overallScore: number;
  gatePass: boolean;
  failedCriteria: string[];
  timestamp: number;
}

/** 修复循环开始 */
export interface FixLoopStartEvent {
  type: "verify:fix_start";
  taskId: number;
  gate: string;
  round: number;
  fixAgent: string;
  criterionId: string;
  timestamp: number;
}

/** 修复循环结果 */
export interface FixLoopResultEvent {
  type: "verify:fix_result";
  taskId: number;
  gate: string;
  round: number;
  fixAgent: string;
  success: boolean;
  timestamp: number;
}
```

这些事件使得前端可以实时展示验证进度 — 用户能看到每条验收标准的逐条验证过程，以及修复循环的状态。

---

## 4. 详细设计

### 4.1 Spec 阶段：验收标准提取

**触发时机：** `generateRequirementsBrief()` 完成后，流水线启动前。

**实现方式：** 调用 LLM，输入需求简报，要求以 JSON 格式输出结构化的验收标准。

```typescript
// server/verification/criteriaExtractor.ts

import { invokeLLM } from "../_core/llm";
import type { AcceptanceCriteriaSet, AcceptanceCriterion } from "@shared/verification";

const EXTRACTION_PROMPT = `你是 PRISM 框架的验收标准提取器。

给定一份需求简报，你需要提取出结构化的验收标准。每条标准必须是：
- **可判定的**：能明确判断"满足"或"不满足"
- **可追溯的**：能关联到需求简报的具体部分
- **有优先级的**：区分"必须满足"和"最好满足"

从以下维度提取：
1. **core_feature**：核心功能需求 → 每个 MVP 功能对应 1-2 条标准
2. **tech_preference**：技术偏好 → 用户指定的技术栈、架构约束
3. **success_metric**：成功标准 → 可衡量的 KPI
4. **key_decision**：关键决策 → 会议中确定的重要方向

输出规则：
- 总数控制在 8-15 条
- must 优先级的标准不超过总数的 60%
- 每条标准的 description 用一句话描述，不超过 50 字
- relatedAgents 填写需要满足该标准的 Agent 角色

你**必须**返回一个有效的 JSON 对象，格式如下：
{
  "criteria": [
    {
      "id": "AC-001",
      "source": "core_feature",
      "description": "...",
      "verifyMethod": "content_check",
      "relatedAgents": ["pm", "backend"],
      "priority": "must"
    }
  ]
}`;

export async function extractAcceptanceCriteria(
  taskId: number,
  requirementsBrief: string,
): Promise<AcceptanceCriteriaSet> {
  const result = await invokeLLM({
    messages: [
      { role: "system", content: EXTRACTION_PROMPT },
      { role: "user", content: `## 需求简报\n\n${requirementsBrief}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "acceptance_criteria",
        strict: true,
        schema: {
          type: "object",
          properties: {
            criteria: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  source: { type: "string", enum: ["core_feature", "tech_preference", "success_metric", "key_decision"] },
                  description: { type: "string" },
                  verifyMethod: { type: "string", enum: ["content_check", "structure_check", "consistency_check"] },
                  relatedAgents: { type: "array", items: { type: "string" } },
                  priority: { type: "string", enum: ["must", "should", "nice_to_have"] },
                },
                required: ["id", "source", "description", "verifyMethod", "relatedAgents", "priority"],
                additionalProperties: false,
              },
            },
          },
          required: ["criteria"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = result.choices?.[0]?.message?.content;
  const parsed = JSON.parse(typeof content === "string" ? content : "");

  return {
    taskId,
    criteria: parsed.criteria,
    generatedAt: Date.now(),
    briefHash: simpleHash(requirementsBrief),
  };
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}
```

### 4.2 Gate 1：策略验证（post_strategy）

**触发时机：** Phase 1（Strategy）完成后，Phase 2（Scaffold）开始前。

**验证范围：** PM 和 UX 的输出是否覆盖了核心需求。

**验证逻辑：** 筛选 `relatedAgents` 包含 `pm` 或 `ux` 的验收标准，逐条验证。

```typescript
// server/verification/gateVerifier.ts

import { invokeLLM } from "../_core/llm";
import type {
  AcceptanceCriteriaSet,
  AcceptanceCriterion,
  CriterionResult,
  VerificationReport,
} from "@shared/verification";

/** 门控配置 */
const GATE_CONFIG = {
  post_strategy: {
    relevantPhases: [0, 1],
    relevantAgents: ["conductor", "researcher", "pm", "ux"],
    threshold: 80,
    maxFixRounds: 2,
  },
  post_build: {
    relevantPhases: [2, 3],
    relevantAgents: ["backend", "frontend", "devops"],
    threshold: 75,
    maxFixRounds: 2,
  },
  final: {
    relevantPhases: [0, 1, 2, 3, 4],
    relevantAgents: ["conductor", "researcher", "pm", "ux", "backend", "frontend", "devops", "critic"],
    threshold: 85,
    maxFixRounds: 1,
  },
} as const;

type GatePhase = keyof typeof GATE_CONFIG;

const VERIFY_PROMPT = `你是 PRISM 框架的质量验证器。

给定一条验收标准和相关 Agent 的输出内容，判断该标准是否被满足。

判断规则：
- **pass**：输出内容明确覆盖了该标准的要求
- **partial**：部分覆盖，但有遗漏或不够具体
- **fail**：未覆盖，或与标准要求矛盾
- **not_applicable**：该标准在当前阶段不适用

你**必须**返回一个有效的 JSON 对象：
{
  "status": "pass" | "fail" | "partial" | "not_applicable",
  "reasoning": "简要说明判断理由（1-2 句话）",
  "fixAgent": "如果 fail/partial，建议哪个 Agent 修复（角色名）",
  "fixSuggestion": "如果 fail/partial，具体的修复建议（1 句话）"
}`;

export async function runGateVerification(
  taskId: number,
  gate: GatePhase,
  criteriaSet: AcceptanceCriteriaSet,
  agentOutputs: Record<string, string>,
  emitEvent: (event: any) => void,
): Promise<VerificationReport> {
  const config = GATE_CONFIG[gate];

  // 筛选当前门控相关的验收标准
  const relevantCriteria = criteriaSet.criteria.filter(c =>
    c.relatedAgents.some(a => config.relevantAgents.includes(a))
  );

  emitEvent({
    type: "verify:gate_start",
    taskId,
    gate,
    criteriaCount: relevantCriteria.length,
    timestamp: Date.now(),
  });

  const results: CriterionResult[] = [];

  for (const criterion of relevantCriteria) {
    // 收集该标准关联的 Agent 输出
    const relevantOutputs = criterion.relatedAgents
      .filter(a => agentOutputs[a])
      .map(a => `### ${a} 的输出\n${agentOutputs[a]}`)
      .join("\n\n---\n\n");

    if (!relevantOutputs.trim()) {
      results.push({
        criterionId: criterion.id,
        status: "not_applicable",
        reasoning: "关联 Agent 尚未产出内容",
      });
      continue;
    }

    // 调用 LLM 验证
    const verifyResult = await invokeLLM({
      messages: [
        { role: "system", content: VERIFY_PROMPT },
        {
          role: "user",
          content: `## 验收标准\nID: ${criterion.id}\n描述: ${criterion.description}\n优先级: ${criterion.priority}\n验证方式: ${criterion.verifyMethod}\n\n## 相关 Agent 输出\n${relevantOutputs}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "criterion_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["pass", "fail", "partial", "not_applicable"] },
              reasoning: { type: "string" },
              fixAgent: { type: "string" },
              fixSuggestion: { type: "string" },
            },
            required: ["status", "reasoning"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = verifyResult.choices?.[0]?.message?.content;
    const parsed = JSON.parse(typeof content === "string" ? content : "{}");

    const result: CriterionResult = {
      criterionId: criterion.id,
      status: parsed.status ?? "fail",
      reasoning: parsed.reasoning ?? "验证失败",
      fixAgent: parsed.fixAgent,
      fixSuggestion: parsed.fixSuggestion,
    };

    results.push(result);

    // 发送逐条验证事件
    emitEvent({
      type: "verify:criterion_result",
      taskId,
      gate,
      criterionId: criterion.id,
      status: result.status,
      reasoning: result.reasoning,
      timestamp: Date.now(),
    });
  }

  // 计算总体评分
  const overallScore = calculateScore(results, relevantCriteria);
  const gatePass = overallScore >= config.threshold;

  const report: VerificationReport = {
    taskId,
    phase: gate,
    results,
    overallScore,
    gatePass,
    gateThreshold: config.threshold,
    verifiedAt: Date.now(),
  };

  emitEvent({
    type: "verify:gate_result",
    taskId,
    gate,
    overallScore,
    gatePass,
    failedCriteria: results
      .filter(r => r.status === "fail")
      .map(r => r.criterionId),
    timestamp: Date.now(),
  });

  return report;
}

/** 评分算法：加权计算 */
function calculateScore(
  results: CriterionResult[],
  criteria: AcceptanceCriterion[],
): number {
  const weights = { must: 3, should: 2, nice_to_have: 1 };
  const statusScores = { pass: 1, partial: 0.5, fail: 0, not_applicable: 1 };

  let totalWeight = 0;
  let weightedScore = 0;

  for (const result of results) {
    const criterion = criteria.find(c => c.id === result.criterionId);
    if (!criterion) continue;

    const weight = weights[criterion.priority];
    totalWeight += weight;
    weightedScore += weight * (statusScores[result.status] ?? 0);
  }

  return totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 100;
}
```

### 4.3 闭环修复机制

当门控验证失败时，系统自动进入修复循环。修复循环的核心思路是：**定向修复，而非全量重跑**。

```typescript
// server/verification/fixLoop.ts

import type { CriterionResult, AcceptanceCriterion } from "@shared/verification";

/** 修复请求 */
export interface FixRequest {
  /** 失败的验收标准 */
  criterion: AcceptanceCriterion;
  /** 验证结果 */
  result: CriterionResult;
  /** 需要修复的 Agent 角色 */
  targetAgent: string;
  /** 该 Agent 之前的输出 */
  previousOutput: string;
  /** 修复建议 */
  suggestion: string;
}

const FIX_PROMPT_TEMPLATE = `你是 PRISM 框架中的 {agentName}。

你之前的输出未能满足以下验收标准，需要修复：

## 验收标准
{criterionDescription}

## 验证反馈
状态：{status}
原因：{reasoning}
修复建议：{fixSuggestion}

## 你之前的输出
{previousOutput}

请基于以上反馈，修改并完善你的输出。要求：
1. 针对性修复指出的问题，不要重写无关部分
2. 确保修复后的内容明确满足验收标准
3. 在输出开头用一句话说明你做了什么修改

请全程使用中文回复。`;

export async function executeFixLoop(
  taskId: number,
  gate: string,
  fixRequests: FixRequest[],
  agentOutputs: Record<string, string>,
  maxRounds: number,
  callAgent: (role: string, prompt: string, context: string) => Promise<string>,
  emitEvent: (event: any) => void,
): Promise<Record<string, string>> {
  const updatedOutputs = { ...agentOutputs };

  for (let round = 1; round <= maxRounds; round++) {
    for (const fix of fixRequests) {
      emitEvent({
        type: "verify:fix_start",
        taskId,
        gate,
        round,
        fixAgent: fix.targetAgent,
        criterionId: fix.criterion.id,
        timestamp: Date.now(),
      });

      // 构建修复提示词
      const fixPrompt = FIX_PROMPT_TEMPLATE
        .replace("{agentName}", fix.targetAgent)
        .replace("{criterionDescription}", fix.criterion.description)
        .replace("{status}", fix.result.status)
        .replace("{reasoning}", fix.result.reasoning)
        .replace("{fixSuggestion}", fix.suggestion)
        .replace("{previousOutput}", fix.previousOutput);

      // 调用 Agent 修复
      const fixedOutput = await callAgent(fix.targetAgent, fixPrompt, "");
      updatedOutputs[fix.targetAgent] = fixedOutput;

      emitEvent({
        type: "verify:fix_result",
        taskId,
        gate,
        round,
        fixAgent: fix.targetAgent,
        success: true,
        timestamp: Date.now(),
      });
    }
  }

  return updatedOutputs;
}
```

### 4.4 修复后的重新验证

修复循环完成后，系统对修复过的标准重新验证。如果仍然不通过，有两种策略：

**策略 A（推荐）：降级通过。** 如果修复后评分提升但仍未达到阈值，且所有 `must` 优先级的标准都已通过，则降级通过并在验证报告中标注。这避免了无限循环。

**策略 B：用户介入。** 将验证报告展示给用户，让用户决定是否接受当前结果、手动调整需求、或要求重新执行。

```typescript
/** 修复后重新验证的决策逻辑 */
function decideAfterFix(
  originalReport: VerificationReport,
  fixedReport: VerificationReport,
): "pass" | "degraded_pass" | "user_intervention" {
  // 所有 must 标准通过 → 降级通过
  const mustResults = fixedReport.results.filter(r => {
    // 需要关联 criteria 判断优先级，此处简化
    return true; // 实际实现中需要查找 criterion.priority
  });

  if (fixedReport.gatePass) {
    return "pass";
  }

  // 评分有提升且所有 must 通过
  if (fixedReport.overallScore > originalReport.overallScore) {
    return "degraded_pass";
  }

  // 评分没有提升 → 需要用户介入
  return "user_intervention";
}
```

---

## 5. 流水线集成

### 5.1 修改后的流水线执行器

以下是将验证流程集成到现有 `simulateAgentPipeline` 的伪代码：

```typescript
export async function simulateAgentPipeline(
  taskId: number,
  prompt: string,
  requirementsBrief?: string,
) {
  const agentOutputs: Record<string, string> = {};
  let criteriaSet: AcceptanceCriteriaSet | null = null;

  // ─── Spec 阶段：提取验收标准 ───
  if (requirementsBrief) {
    agentOutputs["requirements_brief"] = requirementsBrief;
    criteriaSet = await extractAcceptanceCriteria(taskId, requirementsBrief);
    emitEvent({ type: "verify:criteria_extracted", taskId, ... });
  }

  // ─── Phase 0-1: Discover + Strategy ───
  for (const phase of PIPELINE_PHASES.slice(0, 2)) {
    await executePhase(phase, agentOutputs);
  }

  // ─── Gate 1: 策略验证 ───
  if (criteriaSet) {
    const report = await runGateVerification(
      taskId, "post_strategy", criteriaSet, agentOutputs, emitEvent
    );
    if (!report.gatePass) {
      const fixRequests = buildFixRequests(report, criteriaSet, agentOutputs);
      const fixedOutputs = await executeFixLoop(
        taskId, "post_strategy", fixRequests, agentOutputs, 2, callAgent, emitEvent
      );
      Object.assign(agentOutputs, fixedOutputs);
      // 重新验证
      const reReport = await runGateVerification(
        taskId, "post_strategy", criteriaSet, agentOutputs, emitEvent
      );
      // 降级通过或用户介入
    }
  }

  // ─── Phase 2-3: Scaffold + Build ───
  for (const phase of PIPELINE_PHASES.slice(2, 4)) {
    await executePhase(phase, agentOutputs);
  }

  // ─── Gate 2: 构建验证 ───
  if (criteriaSet) {
    const report = await runGateVerification(
      taskId, "post_build", criteriaSet, agentOutputs, emitEvent
    );
    if (!report.gatePass) {
      // 同上：修复循环 + 重新验证
    }
  }

  // ─── Phase 4: Harden (升级为 Verifier) ───
  // Critic Agent 仍然执行，但其输出被纳入最终验证的上下文

  // ─── Gate 3: 最终验证 ───
  if (criteriaSet) {
    const finalReport = await runGateVerification(
      taskId, "final", criteriaSet, agentOutputs, emitEvent
    );
    // 将验证报告附加到任务结果
    await updateTask(taskId, {
      result: {
        ...buildResultSummary(prompt, agentOutputs),
        verificationReport: finalReport,
      },
    });
  }

  // ─── Phase 5: Launch ───
  await executePhase(PIPELINE_PHASES[5], agentOutputs);
}
```

### 5.2 数据库变更

新增 `verification_reports` 表存储验证报告：

```typescript
// drizzle/schema.ts — 新增

export const verificationReports = mysqlTable("verification_reports", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  /** 门控阶段 */
  gate: mysqlEnum("gate", ["post_strategy", "post_build", "final"]).notNull(),
  /** 验证结果 JSON */
  results: json("results").notNull(),
  /** 总体评分 */
  overallScore: int("overallScore").notNull(),
  /** 是否通过 */
  gatePass: boolean("gatePass").notNull(),
  /** 门控阈值 */
  gateThreshold: int("gateThreshold").notNull(),
  /** 修复轮次（0 = 首次验证） */
  fixRound: int("fixRound").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

验收标准集存储在 `tasks` 表的 `result` JSON 字段中（或新增 `acceptanceCriteria` JSON 列），避免额外建表。

---

## 6. 前端展示设计

### 6.1 验证进度实时展示

在 AgentMonitor 组件中新增验证状态展示区域。当门控验证开始时，展示一个验收标准清单，每条标准实时更新状态：

```
┌─────────────────────────────────────────┐
│  Gate 1: 策略验证                    75% │
│  ─────────────────────────────────────  │
│  ✅ AC-001  支持用户注册和登录    pass   │
│  ✅ AC-002  包含数据看板功能      pass   │
│  ⚠️ AC-003  使用 React + Tailwind partial│
│  ❌ AC-004  支持多语言切换        fail   │
│  ⏳ AC-005  响应式移动端适配      ...    │
│  ─────────────────────────────────────  │
│  🔧 修复中: UX Designer 正在修复 AC-004  │
└─────────────────────────────────────────┘
```

### 6.2 验证报告页面

在 TaskResults 页面新增"验证报告"标签页，展示：

- 验收标准总览（通过率、评分）
- 每条标准的详细验证结果和推理过程
- 修复历史（如果有）
- 最终评分和门控通过状态

### 6.3 用户介入界面

当验证需要用户介入时，在 Workspace 中展示一个交互卡片：

```
┌─────────────────────────────────────────┐
│  ⚠️ 质量门控需要你的确认                  │
│                                         │
│  当前评分: 72/100（阈值: 80）             │
│  未通过标准:                              │
│  - AC-004: 多语言切换（已修复但仍不完整）  │
│                                         │
│  [接受当前结果]  [调整需求]  [重新执行]    │
└─────────────────────────────────────────┘
```

---

## 7. 与进化引擎的关系

验证流程为 PRISM 的三层进化引擎提供了关键数据源：

**L1 微调层：** 每次验证的通过/失败模式被记录。如果某个 Agent 在特定类型的验收标准上反复失败，L1 层可以自动调整该 Agent 的系统提示词，强化薄弱环节。这与用户偏好中"Agent 应具备自主生成提示词和技能的能力"的理念一致。

**L2 蒸馏层：** 修复循环中产生的"原始输出 → 修复反馈 → 改进输出"三元组是高质量的训练数据。可以用于微调特定 Agent 的行为，使其在后续任务中直接产出更高质量的内容，减少修复循环的次数。

**L3 架构审查层：** 跨任务的验证报告聚合分析可以揭示系统性问题。例如，如果 Gate 1 的通过率持续低于 Gate 2，说明策略阶段的 Agent 能力不足，需要调整流水线结构或 Agent 分工。

---

## 8. 实施计划

### 8.1 分阶段实施

| 阶段 | 内容 | 预估工时 | 依赖 |
|------|------|---------|------|
| **Phase A** | 验收标准提取（`extractAcceptanceCriteria`） | 2-3 小时 | 需求简报功能已就绪 |
| **Phase B** | Gate 3 最终验证（升级 Critic Agent） | 3-4 小时 | Phase A |
| **Phase C** | Gate 1 + Gate 2 中间门控 | 3-4 小时 | Phase B |
| **Phase D** | 闭环修复机制 | 4-5 小时 | Phase C |
| **Phase E** | 前端验证进度展示 | 3-4 小时 | Phase B |
| **Phase F** | 用户介入界面 | 2-3 小时 | Phase D |
| **Phase G** | 进化引擎数据采集 | 2-3 小时 | Phase D |

**推荐实施顺序：** A → B → E → C → D → F → G

先实现 Phase A + B + E（验收标准提取 + 最终验证 + 前端展示），这是最小可用版本 — 用户能看到交付物是否满足需求。然后再逐步加入中间门控和修复循环。

### 8.2 对现有代码的影响评估

| 文件 | 影响程度 | 说明 |
|------|---------|------|
| `server/agentSimulator.ts` | 中等 | 在阶段之间插入门控调用，不改变现有 Agent 逻辑 |
| `server/requirementMeeting.ts` | 低 | 仅在 `generateRequirementsBrief` 后追加一步提取 |
| `server/routers.ts` | 低 | 新增验证报告查询接口 |
| `drizzle/schema.ts` | 低 | 新增 `verification_reports` 表 |
| `shared/taskEvents.ts`（待创建） | 新增 | 验证相关事件类型 |
| `client/src/pages/TaskResults.tsx` | 中等 | 新增验证报告标签页 |
| `client/src/components/AgentMonitor.tsx` | 中等 | 新增验证进度实时展示 |

---

## 9. 与 Qoder 方案的对比

| 维度 | Qoder (Spec → Coding → Verify) | PRISM (需求简报 → 流水线 → 三层门控) |
|------|------|------|
| **Spec 来源** | 用户手写或 Agent 生成 | 需求会议自动生成需求简报 |
| **验收标准** | 隐式（在 Spec 中） | 显式提取为结构化 JSON |
| **验证方式** | 运行测试 + 语法检查 | LLM 语义验证（无可运行代码） |
| **验证时机** | 每次编码后 | 三个关键阶段（策略后、构建后、最终） |
| **修复机制** | 自动进入下一轮迭代 | 定向修复 + 重新验证 |
| **用户介入** | 可选 | 门控失败时可选介入 |
| **验证可见性** | 日志级别 | 实时 UI 展示每条标准状态 |

PRISM 的验证方案在**可见性**和**结构化程度**上超越 Qoder — 用户能看到每条验收标准的逐条验证过程，而不只是一个通过/失败的结果。但在**验证精度**上不如 Qoder — 因为 PRISM 依赖 LLM 语义判断，而 Qoder 可以运行真实测试。这是产品形态决定的：PRISM 产出的是设计方案和代码蓝图，不是可运行的代码库。

---

## 参考资料

[1]: https://qoder.com/blog/quest-refactored "Quest 1.0: Refactoring the Agent with the Agent"
