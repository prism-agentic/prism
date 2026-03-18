/**
 * LLM 调用辅助函数
 *
 * 封装 invokeLLM 调用，包含重试机制和错误处理。
 * 被 SequentialExecutor 和修复循环使用。
 */

import { invokeLLM } from "../_core/llm";
import { AGENT_REGISTRY, buildAgentContext } from "./agentRegistry";

/**
 * 调用指定 Agent 角色的 LLM，返回生成的文本内容。
 *
 * @param agentRole - Agent 角色标识
 * @param userPrompt - 用户的原始需求
 * @param previousContext - 前序 Agent 的上下文字符串
 * @param modelId - LLM 模型 ID（可选）
 * @param maxRetries - 最大重试次数（默认 3）
 */
export async function callAgent(
  agentRole: string,
  userPrompt: string,
  previousContext: string,
  modelId?: string,
  maxRetries: number = 3,
): Promise<string> {
  const agentDef = AGENT_REGISTRY[agentRole];
  if (!agentDef) {
    throw new Error(`未找到智能体角色的定义: ${agentRole}`);
  }

  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: agentDef.systemPrompt },
  ];

  // 构建包含前序智能体上下文的用户消息
  let userMessage = `## 用户的任务\n${userPrompt}`;
  if (previousContext.trim()) {
    userMessage += `\n\n## 前序智能体的上下文\n${previousContext}`;
  }
  userMessage += `\n\n请基于以上内容提供你的分析和交付物。保持简洁但全面。请全程使用中文回复。如果上下文中提供了需求简报，请将其作为项目需求的权威来源。`;

  messages.push({ role: "user", content: userMessage });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await invokeLLM({
        messages,
        maxTokens: agentDef.maxTokens,
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
      console.error(
        `[LLMHelper] ${agentRole} 的 LLM 调用失败 (第 ${attempt}/${maxRetries} 次):`,
        error,
      );
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[LLMHelper] ${delay}ms 后重试 ${agentRole}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        return `[错误] 智能体 ${agentRole} 在 ${maxRetries} 次尝试后遇到问题。回退到摘要模式。\n\n${agentRole} 智能体由于临时服务问题无法完成分析。流水线将继续使用已有上下文。`;
      }
    }
  }
  return "智能体已完成但未产生输出。";
}

/**
 * 调用 Agent 并使用注册表中的上下文依赖自动构建上下文
 *
 * @param agentRole - Agent 角色标识
 * @param userPrompt - 用户的原始需求
 * @param agentOutputs - 所有已完成 Agent 的输出
 * @param modelId - LLM 模型 ID（可选）
 */
export async function callAgentWithContext(
  agentRole: string,
  userPrompt: string,
  agentOutputs: Record<string, string>,
  modelId?: string,
): Promise<string> {
  const context = buildAgentContext(agentOutputs, agentRole);
  return callAgent(agentRole, userPrompt, context, modelId);
}
