async function aiError(response, key) {
  let detail = "";
  let type = "";
  try {
    const body = await response.json();
    type = body.error?.type;
    const message = body.error?.message || body.message || body.error;
    if (typeof message === "string") detail = message;
  } catch {
    // Do not expose HTML gateway pages as an API diagnostic.
  }
  if (key) detail = detail.split(key).join("[REDACTED]");
  detail = detail.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").slice(0, 1000);
  let hint = "请稍后重试。";
  if (response.status === 401) hint = "认证失败，请检查 ZenMux API Key。";
  if (response.status === 402) hint = "请检查 ZenMux 账户余额。";
  if (response.status === 429) hint = "请求受限，请稍后重试并检查平台限额。";
  if ([408, 504, 524].includes(response.status))
    hint = "ZenMux 或上游模型响应超时，请稍后重试或切换模型。";
  if (response.status === 403) {
    hint =
      type === "access_denied"
        ? "ZenMux 拒绝了此请求的访问权限。请在平台检查该密钥的 API 访问授权；如仍失败，请向 ZenMux 支持提供下方请求编号。"
        : "请求被平台或网络网关拒绝；仅凭 403 无法判断是密钥、额度还是模型限制。";
    if (detail.includes("api_key_source: payg"))
      hint +=
        " 当前凭据被识别为按量付费（PAYG）；订阅用户请从订阅管理页获取 sk-ss-v1- 开头的完整 API Key。";
  }
  return new Error(
    `AI 请求失败（${response.status}）。${hint}${detail ? `\n平台返回：${detail}` : ""}`,
  );
}
module.exports = { aiError };
