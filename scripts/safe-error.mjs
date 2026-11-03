/** Redact configured credentials, including their Basic authorization encoding. */
export function safeErrorMessage(message, env) {
  const email = env.ATLASSIAN_EMAIL;
  const token = env.ATLASSIAN_API_TOKEN;
  const secrets = [email, token, email && token && Buffer.from(`${email}:${token}`).toString('base64')]
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
