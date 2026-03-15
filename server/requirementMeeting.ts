/**
 * PRISM 需求会议引擎
 * 
 * 结构化会议与智能路由：
 *   第 1 轮（固定）：指挥官 → 调研员 → 产品经理（顺序分析）
 *   第 2+ 轮（智能）：指挥官路由用户回复 → 分派给最合适的智能体
 *   结束：产品经理汇总所有会议上下文生成需求简报
 */
import { invokeLLM } from "./_core/llm";
import { createMeetingMessage, updateTask, getTaskMeetingMessages } from "./db";

// ─── 会议智能体提示词 ──────────────────────────────────────────

const MEETING_PROMPTS = {
  /** 指挥官：初始任务分析 + 复杂度评估 */
  conductor_round1: `你是 PRISM 多智能体框架需求会议中的**指挥官**。

用户提交了一个新任务。你在本次会议中的职责是：
1. 分析任务描述，识别关键维度（范围、复杂度、领域）
2. 梳理哪些信息仍然缺失或模糊
3. 识别用户试图解决的核心问题
4. 评估这是否需要深入澄清，还是比较直接明了

请用 Markdown 格式输出：
- **任务理解**：你对用户需求的解读（2-3 句话）
- **关键维度**：列出主要方面（目标用户、核心功能、技术约束、时间线）
- **信息缺口**：哪些内容不清楚或缺失，需要进一步澄清
- **复杂度评估**：简单 / 中等 / 复杂 —— 附简要理由

保持简洁且可执行。请全程使用中文回复。`,

  /** 调研员：竞品分析 + 市场情报 */
  researcher_round1: `你是 PRISM 多智能体框架需求会议中的**调研员**。

基于指挥官的分析，你的职责是：
1. 识别 2-3 个最相关的现有产品/解决方案（Follow the Best 策略）
2. 分析它们的核心功能、优势和差异化特点
3. 记录它们使用的技术栈（如相关）
4. 找出差异化机会

请用 Markdown 格式输出：
- **市场格局**：该领域的简要概述
- **主要竞品**：针对每个产品（2-3 个）：
  - 名称和简要描述
  - 核心解决方案 / 关键功能
  - 优势和劣势
  - 技术方案（如已知）
- **差异化机会**：存在哪些用户可以利用的空白
- **建议**：最值得研究的产品及原因

请尽量具体——使用真实的产品名称、真实的功能、真实的数据。请全程使用中文回复。`,

  /** 产品经理：基于调研的结构化澄清问题 */
  pm_round1: `你是 PRISM 多智能体框架需求会议中的**产品经理**。

基于指挥官的分析和调研员的竞品情报，你的职责是：
1. 将发现综合为清晰、结构化的澄清问题
2. 每个问题应在相关处引用竞品调研
3. 问题应有助于缩小 MVP 范围

请生成 3-5 个澄清问题。每个问题需要：
- 具体且可执行（不要模糊的"你想要什么？"）
- 在适当的地方引用竞品作为选项（例如："你更倾向于像 Linear 那样的极简看板，还是像 Jira 那样的全功能项目管理套件？"）
- 覆盖不同维度：目标用户、核心功能、技术偏好、范围/时间线

请用 Markdown 格式输出：
- **需要你回答的问题**：编号列表，3-5 个问题
  - 每个问题 1-2 句话
  - 包含来自竞品调研的上下文/选项，帮助用户做决定

最后附一句话："你可以选择回答部分或全部问题，也可以跳过，让我们按最佳判断继续推进。"

请全程使用中文回复。`,

  /** 指挥官：分类用户回复并决定哪个智能体应该响应 */
  conductor_router: `你是需求会议中担任**智能路由器**角色的**指挥官**。

用户已回复了会议讨论。分析他们的回复，决定哪个智能体应该响应：

- **conductor**：如果用户询问项目范围、可行性、时间线、团队规模或整体方案
- **researcher**：如果用户询问技术选型、市场对比、竞品功能，或需要更多调研
- **pm**：如果用户讨论功能、优先级、用户故事、MVP 范围或业务需求

你**必须**只返回一个有效的 JSON 对象（不要 markdown，不要解释）：
{
  "respondents": ["agent_role_1", "agent_role_2"],
  "reasoning": "简要说明为什么这些智能体应该响应",
  "isResolved": false
}

规则：
- "respondents" 必须包含 1-2 个智能体角色，来自："conductor"、"researcher"、"pm"
- 仅当用户明确表示已完成或满意时，才将 "isResolved" 设为 true
- 通常 1 个智能体就够了；仅当回复明确跨越两个领域时才用 2 个
- 如果不确定，默认使用 ["pm"]，因为产品经理处理大多数产品讨论`,

  /** 第 2+ 轮各智能体的跟进提示词 */
  conductor_followup: `你是需求会议中回复用户的**指挥官**。

基于会议上下文和用户的最新回复，提供关于项目范围、可行性或方案的有价值回应。保持简洁（3-5 句话）。引用之前的讨论要点。请全程使用中文回复。`,

  researcher_followup: `你是需求会议中回复用户的**调研员**。

基于会议上下文和用户的最新回复，提供额外的调研洞察、技术对比或竞品情报。请使用具体的产品名称和功能。保持简洁（3-5 句话）。请全程使用中文回复。`,

  pm_followup: `你是需求会议中回复用户的**产品经理**。

基于会议上下文和用户的最新回复，帮助澄清需求、细化功能优先级或缩小 MVP 范围。如果用户已回答了问题，请确认并在此基础上深入。如有需要可追问 1-2 个跟进问题。保持简洁。请全程使用中文回复。`,

  /** 产品经理：生成最终需求简报 */
  pm_brief: `你是 PRISM 多智能体框架需求会议的**产品经理**，正在总结会议。

基于所有会议讨论（指挥官的分析、调研员的竞品情报、你的问题以及用户的回答），生成一份全面的**需求简报**，用于指导所有下游智能体。

请用 Markdown 格式输出结构化的需求简报：

# 需求简报

## 项目概述
（2-3 句话总结我们要构建什么以及为什么）

## 目标用户
（这是为谁做的？主要和次要用户画像）

## 竞品参考
（我们从哪些产品学习，应该采纳/避免什么——基于调研员的发现）

## 核心功能（MVP）
（编号列表，列出必须实现的功能及简要描述）

## 锦上添花功能
（MVP 之后的功能）

## 技术偏好
（用户明确的技术栈、架构或约束偏好）

## 成功标准
（如何判断做得好？2-3 个可衡量的标准）

## 关键决策
（会议讨论中做出的重要决策）

请具体且可执行。这份文档将成为所有智能体的唯一权威需求来源。请全程使用中文回复。`,
};

// ─── LLM 调用辅助函数 ─────────────────────────────────────────────────────

async function callMeetingAgent(
  systemPrompt: string,
  userMessage: string,
  modelId?: string,
): Promise<string> {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        maxTokens: 3000,
        ...(modelId ? { model: modelId } : {}),
      });
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
      console.error(`[Meeting] LLM 调用失败 (第 ${attempt}/${MAX_RETRIES} 次):`, error);
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      } else {
        return `[会议智能体遇到临时问题。会议将继续使用已有上下文。]`;
      }
    }
  }
  return "智能体已完成但未产生输出。";
}

// ─── 第 1 轮：固定分析链 ──────────────────────────────────────

export async function runMeetingRound1(taskId: number, prompt: string, modelId?: string) {
  try {
    // 标记任务为澄清中
    await updateTask(taskId, { status: "clarifying", meetingRound: 1 });

    // 步骤 1：指挥官分析
    const conductorOutput = await callMeetingAgent(
      MEETING_PROMPTS.conductor_round1,
      `## 用户的任务\n${prompt}`,
      modelId,
    );
    await createMeetingMessage({
      taskId,
      sender: "conductor",
      round: 1,
      content: conductorOutput,
      messageType: "analysis",
    });

    // 步骤 2：调研员进行竞品调研
    const researcherOutput = await callMeetingAgent(
      MEETING_PROMPTS.researcher_round1,
      `## 用户的任务\n${prompt}\n\n## 指挥官的分析\n${conductorOutput}`,
      modelId,
    );
    await createMeetingMessage({
      taskId,
      sender: "researcher",
      round: 1,
      content: researcherOutput,
      messageType: "research",
    });

    // 步骤 3：产品经理生成结构化问题
    const pmOutput = await callMeetingAgent(
      MEETING_PROMPTS.pm_round1,
      `## 用户的任务\n${prompt}\n\n## 指挥官的分析\n${conductorOutput}\n\n## 调研员的竞品情报\n${researcherOutput}`,
      modelId,
    );
    await createMeetingMessage({
      taskId,
      sender: "pm",
      round: 1,
      content: pmOutput,
      messageType: "questions",
    });

    console.log(`[Meeting] 任务 ${taskId} 第 1 轮完成。等待用户回复。`);
  } catch (error) {
    console.error(`[Meeting] 任务 ${taskId} 第 1 轮出错:`, error);
    // 不让任务失败——让用户仍可继续
    await createMeetingMessage({
      taskId,
      sender: "conductor",
      round: 1,
      content: "会议遇到临时问题。你仍然可以点击「结束会议」继续，或尝试回复以继续讨论。",
      messageType: "error",
    });
  }
}

// ─── 第 2+ 轮：智能路由 ──────────────────────────────────────

export async function handleUserReply(taskId: number, prompt: string, userReply: string, modelId?: string) {
  // 保存用户消息
  const messages = await getTaskMeetingMessages(taskId);
  const currentRound = Math.max(...messages.map(m => m.round), 0) + 1;

  await createMeetingMessage({
    taskId,
    sender: "user",
    round: currentRound,
    content: userReply,
    messageType: "reply",
  });

  // 构建会议上下文供路由器使用
  const meetingContext = messages
    .map(m => `[${m.sender.toUpperCase()}] (第 ${m.round} 轮): ${m.content}`)
    .join("\n\n---\n\n");

  // 步骤 1：指挥官路由回复
  const routerInput = `## 原始任务\n${prompt}\n\n## 会议历史\n${meetingContext}\n\n## 用户最新回复\n${userReply}`;
  const routerOutput = await callMeetingAgent(MEETING_PROMPTS.conductor_router, routerInput, modelId);

  let respondents: string[] = ["pm"];
  let isResolved = false;

  try {
    // 解析路由器输出的 JSON（处理可能的 markdown 包裹）
    const jsonStr = routerOutput.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed.respondents)) {
      respondents = parsed.respondents.filter((r: string) =>
        ["conductor", "researcher", "pm"].includes(r)
      );
      if (respondents.length === 0) respondents = ["pm"];
    }
    isResolved = !!parsed.isResolved;
  } catch {
    console.warn("[Meeting] 解析路由器输出失败，默认使用产品经理:", routerOutput);
  }

  if (isResolved) {
    // 用户满意——生成简报并继续
    await generateRequirementsBrief(taskId, prompt);
    return { isResolved: true, respondents: [] };
  }

  // 步骤 2：分派给选定的智能体
  const followupPrompts: Record<string, string> = {
    conductor: MEETING_PROMPTS.conductor_followup,
    researcher: MEETING_PROMPTS.researcher_followup,
    pm: MEETING_PROMPTS.pm_followup,
  };

  const fullContext = `## 原始任务\n${prompt}\n\n## 会议历史\n${meetingContext}\n\n## 用户最新回复\n${userReply}`;

  for (const agent of respondents) {
    const agentPrompt = followupPrompts[agent];
    if (!agentPrompt) continue;

    const output = await callMeetingAgent(agentPrompt, fullContext, modelId);
    await createMeetingMessage({
      taskId,
      sender: agent,
      round: currentRound,
      content: output,
      messageType: "followup",
    });
  }

  // 更新会议轮次
  await updateTask(taskId, { meetingRound: currentRound });

  return { isResolved: false, respondents };
}

// ─── 生成需求简报 ───────────────────────────────────────────

export async function generateRequirementsBrief(taskId: number, prompt: string, modelId?: string) {
  const messages = await getTaskMeetingMessages(taskId);

  const meetingTranscript = messages
    .map(m => {
      const label = m.sender === "user" ? "用户" : m.sender.toUpperCase();
      return `[${label}] (第 ${m.round} 轮): ${m.content}`;
    })
    .join("\n\n---\n\n");

  const briefInput = `## 原始任务\n${prompt}\n\n## 完整会议记录\n${meetingTranscript}`;
  const brief = await callMeetingAgent(MEETING_PROMPTS.pm_brief, briefInput, modelId);

  // 保存简报为会议消息并存入任务
  await createMeetingMessage({
    taskId,
    sender: "pm",
    round: Math.max(...messages.map(m => m.round), 0) + 1,
    content: brief,
    messageType: "brief",
  });

  await updateTask(taskId, {
    requirementsBrief: { brief, generatedAt: new Date().toISOString() },
  });

  console.log(`[Meeting] 任务 ${taskId} 的需求简报已生成`);
  return brief;
}
