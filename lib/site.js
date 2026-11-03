// Параметры сайта из переменных окружения сборки (interfaces.md §3).
export function getSite(env = process.env) {
  const rawUrl = (env.SITE_URL || "").trim();
  const url = (rawUrl || "http://localhost:8080").replace(/\/+$/, "");
  // Индексация открывается только явно и только для https-адреса.
  const indexable = env.INDEXABLE === "true" && /^https:\/\//.test(rawUrl);
  return { url, indexable };
}
