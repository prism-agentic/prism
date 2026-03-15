/**
 * PRISM 智能体流水线 — LLM 驱动的多智能体协作
 * 每个智能体拥有专业化的系统提示词，并接收前序智能体的上下文，
 * 形成真正的协作链。
 */
import { invokeLLM } from "./_core/llm";
import { createAgentLog, updateTask } from "./db";

// ─── 智能体定义 ───────────────────────────────────────────────
const AGENTS = [
  { name: "Conductor", role: "conductor", department: "specialized" },
  { name: "Researcher", role: "researcher", department: "specialized" },
  { name: "Product Manager", role: "pm", department: "business" },
  { name: "UX Designer", role: "ux", department: "design" },
  { name: "Backend Architect", role: "backend", department: "engineering" },
  { name: "Frontend Developer", role: "frontend", department: "engineering" },
  { name: "DevOps Engineer", role: "devops", department: "engineering" },
  { name: "Quality Critic", role: "critic", department: "specialized" },
  { name: "Growth Hacker", role: "growth", department: "business" },
] as const;

// ─── 智能体系统提示词 ────────────────────────────────────────────
const AGENT_PROMPTS: Record<string, string> = {
  conductor: `你是**指挥官** —— PRISM 多智能体软件开发团队的编排领导者。

你的职责是：
1. 深入分析用户的任务/需求
2. 将其拆解为清晰、可执行的子任务
3. 将每个子任务分配给合适的专业智能体
4. 定义执行顺序和依赖关系

请用 Markdown 格式输出结构化的任务拆解：
- **项目概述**：一段话总结需要构建什么
- **子任务列表**：编号列表，包含智能体分配、优先级和描述
- **执行计划**：按阶段排序

保持简洁但全面。使用专业语言。请全程使用中文回复。`,

  researcher: `你是**调研员** —— PRISM 团队的技术情报智能体。

基于指挥官的任务拆解，你的职责是：
1. 为该项目确定最佳技术栈
2. 调研相关的框架、库和工具
3. 分析潜在的技术风险和缓解策略
4. 提供竞品/市场格局洞察（如适用）

请用 Markdown 格式输出结构化的调研报告：
- **推荐技术栈**：每项选择附理由
- **关键库和工具**：具体的包名及版本
- **风险评估**：前 3 大技术风险及缓解方案
- **市场背景**：简要的竞品/市场洞察

请具体说明技术推荐。引用真实的框架和工具。请全程使用中文回复。`,

  pm: `你是**产品经理** —— PRISM 团队的需求和策略智能体。

基于前序智能体的分析，你的职责是：
1. 定义清晰的用户故事及验收标准
2. 创建功能优先级矩阵（MoSCoW 方法）
3. 定义 MVP 范围
4. 制定成功指标和 KPI

请用 Markdown 格式输出：
- **用户故事**：3-5 个关键用户故事，使用"作为...我希望...以便..."格式，附验收标准
- **MVP 范围**：必须实现 vs 锦上添花的功能
- **成功指标**：可衡量的 KPI
- **时间估算**：各阶段的大致时间

聚焦于可执行、可衡量的需求。请全程使用中文回复。`,

  ux: `你是**UX 设计师** —— PRISM 团队的用户体验和界面设计智能体。

基于产品经理的需求，你的职责是：
1. 定义信息架构
2. 描述关键用户流程
3. 制定设计系统（配色、字体、间距）
4. 详细描述核心页面的布局

请用 Markdown 格式输出：
- **信息架构**：站点地图 / 导航结构
- **关键用户流程**：2-3 个核心任务的分步流程描述
- **设计系统**：色彩方案、字体排版、间距规则
- **核心页面**：主要页面的详细布局描述

请具体说明视觉设计决策和交互模式。请全程使用中文回复。`,

  backend: `你是**后端架构师** —— PRISM 团队的服务端工程智能体。

基于调研和需求，你的职责是：
1. 设计数据库 Schema
2. 定义 API 端点和契约
3. 规划服务架构
4. 制定认证和安全措施

请用 Markdown 格式输出：
- **数据库 Schema**：表结构，包含列名、类型和关系（使用代码块）
- **API 设计**：RESTful 或 GraphQL 端点，附请求/响应示例
- **架构设计**：服务边界、数据流、缓存策略
- **安全方案**：认证流程、输入校验、限流

使用代码块展示 Schema 和 API 示例。确保可直接用于实现。请全程使用中文回复。`,

  frontend: `你是**前端开发者** —— PRISM 团队的客户端工程智能体。

基于 UX 设计和后端 API，你的职责是：
1. 定义组件架构
2. 规划状态管理策略
3. 详细说明关键组件的实现
4. 制定响应式设计方案

请用 Markdown 格式输出：
- **组件树**：层级化的组件结构
- **状态管理**：全局 vs 局部状态、数据获取策略
- **关键组件**：2-3 个核心组件的规格说明及 Props
- **响应式策略**：断点和移动优先方案

包含关键组件的代码片段。聚焦于 React/TypeScript 模式。请全程使用中文回复。`,

  devops: `你是**DevOps 工程师** —— PRISM 团队的基础设施和部署智能体。

基于架构决策，你的职责是：
1. 设计 CI/CD 流水线
2. 规划部署架构
3. 搭建监控和告警
4. 定义环境配置

请用 Markdown 格式输出：
- **CI/CD 流水线**：构建、测试、部署各阶段
- **基础设施**：托管、CDN、数据库托管建议
- **监控方案**：关键指标、告警阈值、日志策略
- **环境配置**：环境变量、密钥管理

请具体说明工具和配置。在有帮助的地方包含流水线 YAML 片段。请全程使用中文回复。`,

  critic: `你是**质量评审员** —— PRISM 团队的代码审查和质量保证智能体。

审查所有前序智能体的输出，你的职责是：
1. 识别潜在的问题、缺口或不一致
2. 提出改进和优化建议
3. 检查安全漏洞
4. 验证是否完整覆盖了原始需求

请用 Markdown 格式输出：
- **发现的问题**：编号列表，标注严重程度（严重 / 高 / 中 / 低）
- **改进建议**：具体、可执行的建议
- **安全审查**：潜在漏洞及修复方案
- **完整性检查**：需求覆盖度评估

请建设性但彻底地审查。每个问题都应附带建议的修复方案。请全程使用中文回复。`,

  growth: `你是**增长黑客** —— PRISM 团队的发布和增长策略智能体。

基于完整的项目方案，你的职责是：
1. 定义上市策略
2. 规划用户获取渠道
3. 搭建分析和追踪
4. 设计引导和留存流程

请用 Markdown 格式输出：
- **发布计划**：发布前、发布当天、发布后的活动
- **获客渠道**：前 3 个渠道，附策略和预估成本
- **分析体系**：需要追踪的关键事件、漏斗定义
- **留存策略**：引导流程、参与钩子、召回策略

聚焦于适合初创企业的可执行、低成本增长策略。请全程使用中文回复。`,
};

// ─── 流水线阶段 ─────────────────────────────────────────────────
const PIPELINE_PHASES = [
  { phase: 0, name: "Discover",  agents: ["conductor", "researcher"] },
  { phase: 1, name: "Strategy",  agents: ["pm", "ux"] },
  { phase: 2, name: "Scaffold",  agents: ["backend", "frontend"] },
  { phase: 3, name: "Build",     agents: ["backend", "frontend", "devops"] },
  { phase: 4, name: "Harden",    agents: ["critic"] },
  { phase: 5, name: "Launch",    agents: ["growth"] },
];

// ─── LLM 调用辅助函数 ─────────────────────────────────────────────────
async function callAgent(
  agentRole: string,
  userPrompt: string,
  previousContext: string,
  modelId?: string,
): Promise<string> {
  const systemPrompt = AGENT_PROMPTS[agentRole];
  if (!systemPrompt) {
    throw new Error(`未找到智能体角色的提示词: ${agentRole}`);
  }

  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  // 构建包含前序智能体上下文的用户消息
  let userMessage = `## 用户的任务\n${userPrompt}`;
  if (previousContext.trim()) {
    userMessage += `\n\n## 前序智能体的上下文\n${previousContext}`;
  }
  userMessage += `\n\n请基于以上内容提供你的分析和交付物。保持简洁但全面。请全程使用中文回复。如果上下文中提供了需求简报，请将其作为项目需求的权威来源。`;

  messages.push({ role: "user", content: userMessage });

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await invokeLLM({ messages, maxTokens: 4096, ...(modelId ? { model: modelId } : {}) });
      const content = result.choices?.[0]?.message?.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map(c => c.text)
          .join("\n");
      }
      return "智能体已完成分析，但未产生文本输出。";
    } catch (error) {
      console.error(`[AgentSimulator] ${agentRole} 的 LLM 调用失败 (第 ${attempt}/${MAX_RETRIES} 次):`, error);
      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[AgentSimulator] ${delay}ms 后重试 ${agentRole}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        return `[错误] 智能体 ${agentRole} 在 ${MAX_RETRIES} 次尝试后遇到问题。回退到摘要模式。\n\n${agentRole} 智能体由于临时服务问题无法完成分析。流水线将继续使用已有上下文。`;
      }
    }
  }
  return "智能体已完成但未产生输出。";
}

// ─── 主流水线执行器 ──────────────────────────────────────────
export async function simulateAgentPipeline(taskId: number, prompt: string, requirementsBrief?: string, modelId?: string) {
  // 累积所有智能体的输出，用于上下文传递
  const agentOutputs: Record<string, string> = {};

  // 如果有来自会议的需求简报，注入为预置上下文
  if (requirementsBrief) {
    agentOutputs["requirements_brief"] = requirementsBrief;
  }

  try {
    // 标记任务为运行中
    await updateTask(taskId, {
      status: "running",
      startedAt: new Date(),
      currentPhase: 0,
    });

    for (const phase of PIPELINE_PHASES) {
      // 更新任务阶段
      await updateTask(taskId, { currentPhase: phase.phase });

      for (const agentRole of phase.agents) {
        const agent = AGENTS.find(a => a.role === agentRole)!;
        const actionLabel = getActionLabel(agentRole, phase.phase);

        // 记录"思考中"状态
        await createAgentLog({
          taskId,
          agentName: agent.name,
          agentRole: agent.role,
          phase: phase.phase,
          action: actionLabel,
          content: null,
          status: "thinking",
        });

        // 构建前序智能体输出的上下文
        const previousContext = buildContext(agentOutputs, agentRole);

        // 记录"工作中"状态
        await createAgentLog({
          taskId,
          agentName: agent.name,
          agentRole: agent.role,
          phase: phase.phase,
          action: actionLabel,
          content: "正在使用 AI 分析并生成交付物...",
          status: "working",
        });

        // 调用 LLM 获取真实智能体输出
        const startTime = Date.now();
        const output = await callAgent(agentRole, prompt, previousContext, modelId);
        const durationMs = Date.now() - startTime;

        // 存储输出用于上下文链
        const outputKey = phase.phase === 3 && agentRole !== "devops"
          ? `${agentRole}_build`  // 第 3 阶段复用 backend/frontend，使用唯一键
          : agentRole;
        agentOutputs[outputKey] = output;

        // 记录"完成"状态及 LLM 生成的内容
        await createAgentLog({
          taskId,
          agentName: agent.name,
          agentRole: agent.role,
          phase: phase.phase,
          action: actionLabel,
          content: output,
          status: "done",
          durationMs,
        });
      }
    }

    // 构建最终结果摘要
    const resultSummary = buildResultSummary(prompt, agentOutputs);

    // 标记任务为已完成
    await updateTask(taskId, {
      status: "completed",
      currentPhase: 5,
      completedAt: new Date(),
      result: resultSummary,
    });
  } catch (error) {
    console.error("[AgentSimulator] 流水线错误:", error);
    await updateTask(taskId, {
      status: "failed",
      completedAt: new Date(),
      result: { error: String(error) },
    }).catch(() => {});
  }
}

// ─── 辅助函数：操作标签 ──────────────────────────────────────────
function getActionLabel(role: string, phase: number): string {
  const labels: Record<string, Record<number, string>> = {
    conductor: { 0: "分析与拆解任务" },
    researcher: { 0: "调研技术与市场" },
    pm:       { 1: "定义需求与用户故事" },
    ux:       { 1: "设计用户体验与流程" },
    backend:  { 2: "设计系统架构", 3: "实现核心服务", 4: "优化性能" },
    frontend: { 2: "规划组件架构", 3: "构建 UI 实现" },
    devops:   { 3: "配置基础设施与 CI/CD" },
    critic:   { 4: "审查质量与安全" },
    growth:   { 5: "规划发布与增长策略" },
  };
  return labels[role]?.[phase] ?? "处理中";
}

// ─── 辅助函数：构建智能体上下文 ─────────────────────────────────
function buildContext(outputs: Record<string, string>, currentRole: string): string {
  // 定义每个智能体接收的上下文
  const contextMap: Record<string, string[]> = {
    conductor: ["requirements_brief"],
    researcher: ["conductor", "requirements_brief"],
    pm:       ["conductor", "researcher", "requirements_brief"],
    ux:       ["pm", "requirements_brief"],
    backend:  ["researcher", "pm", "ux", "requirements_brief"],
    frontend: ["ux", "backend", "requirements_brief"],
    devops:   ["backend", "backend_build"],
    critic:   ["conductor", "pm", "backend", "frontend", "backend_build", "frontend_build"],
    growth:   ["pm", "critic"],
  };

  const relevantKeys = contextMap[currentRole] ?? [];
  const contextParts: string[] = [];

  for (const key of relevantKeys) {
    if (outputs[key]) {
      const agentName = AGENTS.find(a => a.role === key)?.name ?? key;
      contextParts.push(`### ${agentName} 的输出\n${outputs[key]}`);
    }
  }

  return contextParts.join("\n\n---\n\n");
}

// ─── 辅助函数：构建最终结果 ──────────────────────────────────────
function buildResultSummary(
  prompt: string,
  outputs: Record<string, string>,
): Record<string, unknown> {
  return {
    summary: `任务「${prompt}」已通过 6 个流水线阶段、${AGENTS.length} 个专业 AI 智能体成功完成。`,
    phases: PIPELINE_PHASES.map(p => p.name),
    agentsUsed: AGENTS.length,
    deliverables: Object.entries(outputs).map(([role, content]) => ({
      agent: AGENTS.find(a => a.role === role)?.name ?? role,
      role,
      contentLength: content.length,
      preview: content.substring(0, 200) + (content.length > 200 ? "..." : ""),
    })),
  };
}
