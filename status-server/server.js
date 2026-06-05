const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.STATUS_API_KEY || "";
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "status-data.json");
const BODY_LIMIT_BYTES = 1024 * 64;

const statusMap = loadStatusMap();

function loadStatusMap() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.warn(`[status-server] Nao foi possivel ler ${DATA_FILE}: ${error.message}`);
    return {};
  }
}

function saveStatusMap() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(statusMap, null, 2));
  } catch (error) {
    console.error(`[status-server] Nao foi possivel salvar ${DATA_FILE}: ${error.message}`);
  }
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function setCors(req, res) {
  const requestedHeaders = req.headers["access-control-request-headers"];
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    requestedHeaders || "Content-Type, Authorization, X-API-Key"
  );
}

function hasWriteAccess(req) {
  if (!API_KEY) return true;
  const auth = req.headers.authorization || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return req.headers["x-api-key"] === API_KEY || bearer === API_KEY;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > BODY_LIMIT_BYTES) {
        reject(new Error("BODY_TOO_LARGE"));
        req.destroy();
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function normalizeMemberId(value) {
  return typeof value === "string" ? value.trim() : "";
}

const server = http.createServer(async (req, res) => {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    sendJson(res, 200, {
      ok: true,
      service: "utalk-status-server",
      storedMembers: Object.keys(statusMap).length
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/status") {
    const memberId = normalizeMemberId(url.searchParams.get("memberId"));

    if (!memberId) {
      sendJson(res, 400, { error: "memberId obrigatorio" });
      return;
    }

    const available = statusMap[memberId] !== false;
    sendJson(res, 200, {
      memberId,
      available,
      status: available ? "available" : "unavailable"
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/status") {
    if (!hasWriteAccess(req)) {
      sendJson(res, 401, { error: "Nao autorizado" });
      return;
    }

    try {
      const rawBody = await readBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const memberId = normalizeMemberId(payload.memberId);
      const { available } = payload;

      if (!memberId || typeof available !== "boolean") {
        sendJson(res, 400, { error: "memberId e available sao obrigatorios" });
        return;
      }

      statusMap[memberId] = available;
      saveStatusMap();

      console.log(
        `[${new Date().toISOString()}] ${memberId} -> ${available ? "disponivel" : "indisponivel"}`
      );

      sendJson(res, 200, {
        memberId,
        available,
        status: available ? "available" : "unavailable"
      });
    } catch (error) {
      if (error.message === "BODY_TOO_LARGE") {
        sendJson(res, 413, { error: "Corpo da requisicao muito grande" });
        return;
      }

      sendJson(res, 400, { error: "JSON invalido" });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/status/all") {
    if (!hasWriteAccess(req)) {
      sendJson(res, 401, { error: "Nao autorizado" });
      return;
    }

    sendJson(res, 200, { statuses: statusMap });
    return;
  }

  sendJson(res, 404, { error: "Rota nao encontrada" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[status-server] Rodando na porta ${PORT}`);
  console.log("[status-server] GET  /health");
  console.log("[status-server] GET  /status?memberId=ID_DA_ATENDENTE");
  console.log("[status-server] POST /status");
  console.log(`[status-server] DATA_FILE=${DATA_FILE}`);
  console.log(`[status-server] STATUS_API_KEY=${API_KEY ? "configurada" : "nao configurada"}`);
});
