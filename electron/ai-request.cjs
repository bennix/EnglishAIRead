const { aiError } = require("./ai-error.cjs");

const AI_TIMEOUT_MS = 10 * 60 * 1000;
async function requestAI({
  key,
  model,
  messages,
  maxTokens = 6000,
  timeoutMs = AI_TIMEOUT_MS,
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
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw await aiError(response, key);
    if (!response.headers.get("content-type")?.includes("text/event-stream")) {
      body = await response.json();
    } else {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "",
        content = "",
        finishReason,
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
        if (chunk.error)
          throw new Error(
            "AI 平台在生成过程中返回错误，请稍后重试或切换模型。",
          );
        const choice = chunk.choices?.[0];
        if (typeof choice?.delta?.content === "string")
          content += choice.delta.content;
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
  if (body.choices?.[0]?.finish_reason === "length")
    throw new Error(
      "AI 回答达到输出上限，结果不完整。请减少题数或切换模型后重试。",
    );
  return body;
}
module.exports = { requestAI, AI_TIMEOUT_MS };
