const { aiError } = require("./ai-error.cjs");

const AI_TIMEOUT_MS = 10 * 60 * 1000;
const AI_OUTPUT_TOKENS = 24000;
async function requestAI({
  key,
  model,
  messages,
  maxTokens = AI_OUTPUT_TOKENS,
  timeoutMs = AI_TIMEOUT_MS,
  onDelta,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let body;
  try {
    const response = await fetch("https://zenmux.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw await aiError(response, key);
    if (!response.headers.get("content-type")?.includes("text/event-stream")) {
      body = await response.json();
      if (typeof body.choices?.[0]?.message?.content === "string")
        onDelta?.(body.choices[0].message.content);
    } else {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "",
        content = "",
        finishReason,
        usage,
        completed = false;
      const event = (line) => {
        if (!line.startsWith("data:")) return;
        const value = line.slice(5).trim();
        if (!value) return;
        if (value === "[DONE]") {
          completed = true;
          return;
        }
        const chunk = JSON.parse(value);
        if (chunk.usage) usage = chunk.usage;
        if (chunk.error)
          throw new Error(
            "AI 平台在生成过程中返回错误，请稍后重试或切换模型。",
          );
        const choice = chunk.choices?.[0];
        if (typeof choice?.delta?.content === "string") {
          content += choice.delta.content;
          onDelta?.(choice.delta.content);
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
      };
      try {
        while (!completed) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop();
          for (const line of lines) {
            event(line);
            if (completed) break;
          }
          if (done) {
            if (buffer && !completed) event(buffer);
            break;
          }
        }
        if (!completed && !finishReason)
          throw new Error("AI 回答传输中断，未收到完整结果，请重试。");
      } finally {
        await reader.cancel().catch(() => {});
      }
      body = {
        choices: [{ message: { content }, finish_reason: finishReason }],
        usage,
      };
    }
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        `AI 生成超过 ${Math.round(timeoutMs / 60000)} 分钟，已停止等待。请稍后重试，或切换模型；完形填空可先选择 15 空。`,
      );
    if (error instanceof TypeError || error.name === "AbortError")
      throw new Error("AI 网络连接中断，请检查网络后重试。");
    if (error instanceof SyntaxError)
      throw new Error("AI 平台返回的数据不完整或格式异常，请重试。");
    throw error;
  } finally {
    clearTimeout(timer);
  }
  if (body.choices?.[0]?.finish_reason === "length") {
    const tokens = body.usage?.completion_tokens;
    const reasoning = body.usage?.completion_tokens_details?.reasoning_tokens;
    const detail = Number.isFinite(tokens)
      ? `平台报告已用 ${tokens} 个输出 token${Number.isFinite(reasoning) ? `（其中推理 ${reasoning} 个）` : ""}。`
      : "平台未提供 token 用量。";
    const error = new Error(
      `AI 回答达到输出上限（本次预算 ${maxTokens} tokens），结果不完整。${detail}请重新生成；长题型可先选择 15 空。`,
    );
    error.code = "AI_OUTPUT_LIMIT";
    error.finishReason = "length";
    error.usage = body.usage;
    throw error;
  }
  return body;
}
module.exports = { requestAI, AI_TIMEOUT_MS, AI_OUTPUT_TOKENS };
