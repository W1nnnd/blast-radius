/** Redact configured credentials, including their Basic authorization encoding. */
export function safeErrorMessage(message, env) {
  const emails = [env.FORGE_EMAIL, env.ATLASSIAN_EMAIL].filter(Boolean);
  const tokens = [env.FORGE_API_TOKEN, env.ATLASSIAN_API_TOKEN].filter(Boolean);
  const secrets = [...emails, ...tokens, ...emails.flatMap(email => tokens.map(token =>
    Buffer.from(`${email}:${token}`).toString('base64')))]
    .filter(Boolean).sort((a, b) => b.length - a.length);
  let text = String(message);
  for (const secret of secrets) {
    text = text.split(secret).join('[REDACTED]');
  }
  return text;
}

/** Read only the response body; unavailable bodies must not hide HTTP context. */
export async function responseDetail(response, env) {
  try {
    return safeErrorMessage(await response.text(), env).slice(0, 300);
  } catch {
    return '';
  }
}
