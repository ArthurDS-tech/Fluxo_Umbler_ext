const DEFAULT_API_BASE = "https://app-utalk.umbler.com/api";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo nao permitido" });
    return;
  }

  let requestBody = req.body || {};
  if (typeof requestBody === "string") {
    try {
      requestBody = JSON.parse(requestBody || "{}");
    } catch {
      res.status(400).json({ error: "JSON invalido" });
      return;
    }
  }
  const { token, path, organizationId, query, body, method = "GET" } = requestBody;
  const upstreamMethod = String(method).toUpperCase();

  if (!token || !path) {
    res.status(400).json({ error: "token e path sao obrigatorios" });
    return;
  }

  if (!path.startsWith("/v1/")) {
    res.status(400).json({ error: "path invalido" });
    return;
  }

  const apiBase = (process.env.UTALK_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
  const url = new URL(apiBase + path);

  if (organizationId) url.searchParams.set("organizationId", organizationId);
  if (query && typeof query === "object") {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  try {
    const upstream = await fetch(url.toString(), {
      method: upstreamMethod,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: upstreamMethod === "GET" ? undefined : JSON.stringify(body || {})
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "";
    res.status(upstream.status);

    if (!text) {
      res.end();
      return;
    }

    if (contentType.includes("application/json")) {
      res.setHeader("Content-Type", "application/json");
      res.send(text);
      return;
    }

    res.json({ data: text });
  } catch (error) {
    res.status(502).json({
      error: "Falha ao chamar a API da Umbler Talk",
      detail: error.message
    });
  }
};
