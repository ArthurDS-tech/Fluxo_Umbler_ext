const DEFAULT_STATUS_API_BASE = "https://utalk-status-webhook-production.up.railway.app";
const DEFAULT_STATUS_API_KEY = "utalk-status-2026-railway";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const statusBase = (process.env.STATUS_API_BASE || DEFAULT_STATUS_API_BASE).replace(/\/$/, "");
  const statusKey = process.env.STATUS_API_KEY || DEFAULT_STATUS_API_KEY;

  if (req.method === "GET") {
    const memberId = String(req.query?.memberId || "").trim();
    const queueRequested = String(req.query?.queue || "").trim() === "1";
    const allRequested = String(req.query?.all || "").trim() === "1";
    const logsRequested = String(req.query?.logs || "").trim() === "1";

    if (logsRequested) {
      const params = new URLSearchParams();
      for (const key of ["limit", "chatId", "memberId", "branch"]) {
        const value = String(req.query?.[key] || "").trim();
        if (value) params.set(key, value);
      }
      await proxyStatusRequest(res, {
        url: `${statusBase}/logs${params.toString() ? `?${params}` : ""}`,
        method: "GET",
        headers: {
          "X-API-Key": statusKey
        }
      });
      return;
    }

    if (queueRequested) {
      const branch = String(req.query?.branch || "main").trim() || "main";
      await proxyStatusRequest(res, {
        url: `${statusBase}/queue?branch=${encodeURIComponent(branch)}`,
        method: "GET",
        headers: {
          "X-API-Key": statusKey
        }
      });
      return;
    }

    if (allRequested) {
      await proxyStatusRequest(res, {
        url: `${statusBase}/status/all`,
        method: "GET",
        headers: {
          "X-API-Key": statusKey
        }
      });
      return;
    }

    if (!memberId) {
      res.status(400).json({ error: "memberId obrigatorio" });
      return;
    }

    await proxyStatusRequest(res, {
      url: `${statusBase}/status?memberId=${encodeURIComponent(memberId)}`,
      method: "GET"
    });
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

  const memberId = String(requestBody.memberId || "").trim();
  const { available } = requestBody;

  if (!memberId || typeof available !== "boolean") {
    res.status(400).json({ error: "memberId e available sao obrigatorios" });
    return;
  }

  await proxyStatusRequest(res, {
    url: `${statusBase}/status`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": statusKey
    },
    body: JSON.stringify({ memberId, available })
  });
};

async function proxyStatusRequest(res, request) {
  try {
    const upstream = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });

    const text = await upstream.text();
    res.status(upstream.status);

    if (!text) {
      res.end();
      return;
    }

    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (error) {
    res.status(502).json({
      error: "Falha ao chamar o servidor de status",
      detail: error.message
    });
  }
}
