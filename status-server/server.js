const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.STATUS_API_KEY || "";
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "status-data.json");
const BODY_LIMIT_BYTES = 1024 * 64;
const QUEUE = [
  "ZzUQwM9nj2l-H5hc", // BRUNA
  "ZaZlLHFmogpzC4xO", // ISA
  "ZoWIY_xoe7uoAAFQ", // JULIA
  "Z26n85VVIK64B6I2", // KENIA
  "ZaZkfnFmogpzCidw" // ANA
];
const MEMBER_NAMES = {
  "ZzUQwM9nj2l-H5hc": "BRUNA",
  "ZaZlLHFmogpzC4xO": "ISA",
  ZoWIY_xoe7uoAAFQ: "JULIA",
  Z26n85VVIK64B6I2: "KENIA",
  ZaZkfnFmogpzCidw: "ANA"
};
const BUSINESS_HOURS = {
  timeZone: "America/Sao_Paulo",
  startHour: 8,
  endHour: 18
};

const dataStore = loadDataStore();
const statusMap = dataStore.statuses;
const queueState = dataStore.queue;
let remarketing = null;
let remarketingEnv = null;
let remarketingRunning = false;
let remarketingTickCount = 0;
let remarketingLastRun = null;
let remarketingLastError = null;
let remarketingTimer = null;

function loadDataStore() {
  try {
    if (!fs.existsSync(DATA_FILE)) return createEmptyDataStore();
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return createEmptyDataStore();
    }

    if (parsed.statuses && typeof parsed.statuses === "object" && !Array.isArray(parsed.statuses)) {
      return {
        statuses: parsed.statuses,
        queue: normalizeQueueState(parsed.queue)
      };
    }

    return {
      statuses: parsed,
      queue: normalizeQueueState(null)
    };
  } catch (error) {
    console.warn(`[status-server] Nao foi possivel ler ${DATA_FILE}: ${error.message}`);
    return createEmptyDataStore();
  }
}

function createEmptyDataStore() {
  return {
    statuses: {},
    queue: normalizeQueueState(null)
  };
}

function normalizeQueueState(value) {
  const currentIndex = Number(value?.currentIndex);
  return {
    currentIndex: Number.isInteger(currentIndex) && currentIndex >= 0 ? currentIndex % QUEUE.length : 0,
    lastAssignedMemberId: normalizeMemberId(value?.lastAssignedMemberId) || null,
    lastAssignedAtUTC: typeof value?.lastAssignedAtUTC === "string" ? value.lastAssignedAtUTC : null
  };
}

function saveDataStore() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        {
          statuses: statusMap,
          queue: queueState
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error(`[status-server] Nao foi possivel salvar ${DATA_FILE}: ${error.message}`);
  }
}

function getAvailableQueueMember() {
  if (!isBusinessOpen().open) return null;

  for (let offset = 0; offset < QUEUE.length; offset += 1) {
    const index = (queueState.currentIndex + offset) % QUEUE.length;
    const memberId = QUEUE[index];

    if (statusMap[memberId] !== false) {
      return { memberId, index, offset };
    }
  }

  return null;
}

function isBusinessOpen(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_HOURS.timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  const weekday = value("weekday");
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));
  const isWeekday = !["Sat", "Sun"].includes(weekday);
  const minutes = hour * 60 + minute;
  const start = BUSINESS_HOURS.startHour * 60;
  const end = BUSINESS_HOURS.endHour * 60;
  const open = isWeekday && minutes >= start && minutes < end;

  return {
    open,
    weekday,
    hour,
    minute,
    timeZone: BUSINESS_HOURS.timeZone,
    reason: open
      ? "Dentro do horario de atendimento."
      : "Fora do horario de atendimento."
  };
}

function assignQueueMember(memberId, index) {
  queueState.currentIndex = (index + 1) % QUEUE.length;
  queueState.lastAssignedMemberId = memberId;
  queueState.lastAssignedAtUTC = new Date().toISOString();
  saveDataStore();
}

function getQueueSnapshot() {
  const next = getAvailableQueueMember();
  return {
    order: QUEUE.map((memberId) => ({
      memberId,
      name: MEMBER_NAMES[memberId] || memberId,
      available: statusMap[memberId] !== false
    })),
    currentIndex: queueState.currentIndex,
    currentMemberId: QUEUE[queueState.currentIndex],
    currentMemberName: MEMBER_NAMES[QUEUE[queueState.currentIndex]] || QUEUE[queueState.currentIndex],
    nextAvailableMemberId: next?.memberId || null,
    nextAvailableMemberName: next ? MEMBER_NAMES[next.memberId] || next.memberId : null,
    lastAssignedMemberId: queueState.lastAssignedMemberId,
    lastAssignedMemberName: queueState.lastAssignedMemberId
      ? MEMBER_NAMES[queueState.lastAssignedMemberId] || queueState.lastAssignedMemberId
      : null,
    lastAssignedAtUTC: queueState.lastAssignedAtUTC
  };
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

function getRemarketing() {
  if (!remarketing) {
    remarketing = require("./remarketing/remarketing-flow");
  }
  return remarketing;
}

function getRemarketingEnv(overrides = {}) {
  const mod = getRemarketing();
  remarketingEnv = mod.loadEnv({
    execute: process.env.REMARKETING_EXECUTE || "true",
    watch: "true",
    ...overrides
  });
  return remarketingEnv;
}

function getRemarketingStatus() {
  try {
    const env = remarketingEnv || getRemarketingEnv();
    return {
      ok: !remarketingLastError,
      enabled: env.workerEnabled,
      running: remarketingRunning,
      tickCount: remarketingTickCount,
      lastRun: remarketingLastRun,
      lastError: remarketingLastError,
      config: {
        execute: env.execute,
        windowMinutes: env.windowMinutes,
        pollMs: env.pollMs,
        maxLeadsPerTick: env.maxLeadsPerTick,
        lookbackDays: env.lookbackDays,
        createdAfter: env.createdAfter || null,
        templateId: env.templateId,
        eventsTable: env.eventsTable,
        attendantSelection: env.assignMemberId ? "manual" : "fila_railway_com_patio_para_isa",
        statusApiBaseUrl: env.statusApiBaseUrl
      }
    };
  } catch (error) {
    return {
      ok: false,
      enabled: false,
      running: false,
      tickCount: remarketingTickCount,
      lastRun: remarketingLastRun,
      lastError: {
        at: new Date().toISOString(),
        message: error.message
      }
    };
  }
}

async function runRemarketingTick(source = "manual", envOverrides = {}) {
  if (remarketingRunning) return { skipped: true, reason: "remarketing_already_running" };

  const mod = getRemarketing();
  const env = getRemarketingEnv(envOverrides);
  remarketingRunning = true;
  remarketingTickCount += 1;
  const started = Date.now();

  try {
    const summary = await mod.scanDueLeads(env);
    remarketingLastRun = {
      source,
      startedAt: new Date(started).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      checked: summary.checked,
      sent: summary.sent,
      skipped: summary.skipped,
      errors: summary.errors
    };
    remarketingLastError = null;
    console.log(
      `[remarketing] checked=${summary.checked} sent=${summary.sent} skipped=${summary.skipped} errors=${summary.errors}`
    );
    return summary;
  } catch (error) {
    remarketingLastError = {
      at: new Date().toISOString(),
      message: error.message
    };
    console.error(`[remarketing] error: ${error.message}`);
    return { error: error.message };
  } finally {
    remarketingRunning = false;
  }
}

function startRemarketingWorkerIfEnabled() {
  const status = getRemarketingStatus();
  if (!status.ok || !status.enabled || remarketingTimer) return;

  const env = remarketingEnv;
  runRemarketingTick("startup").catch((error) => {
    console.error(`[remarketing] startup error: ${error.message}`);
  });
  remarketingTimer = setInterval(() => {
    runRemarketingTick("timer").catch((error) => {
      console.error(`[remarketing] timer error: ${error.message}`);
    });
  }, env.pollMs);
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

  if (
    req.method === "GET" &&
    (url.pathname === "/remarketing" ||
      url.pathname === "/remarketing/health" ||
      url.pathname === "/remarketing/status")
  ) {
    sendJson(res, 200, getRemarketingStatus());
    return;
  }

  if (req.method === "POST" && url.pathname === "/remarketing/tick") {
    if (!hasWriteAccess(req)) {
      sendJson(res, 401, { error: "Nao autorizado" });
      return;
    }

    try {
      const rawBody = await readBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const result = await runRemarketingTick("manual", payload);
      sendJson(res, result.error ? 500 : 200, result);
    } catch (error) {
      sendJson(res, 400, {
        error: error.message === "BODY_TOO_LARGE" ? "Corpo da requisicao muito grande" : "JSON invalido"
      });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/remarketing/run-phone") {
    if (!hasWriteAccess(req)) {
      sendJson(res, 401, { error: "Nao autorizado" });
      return;
    }

    try {
      const rawBody = await readBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const mod = getRemarketing();
      const env = getRemarketingEnv({
        ...payload,
        testPhone: payload.phone || payload.testPhone || "",
        execute: payload.execute === undefined ? "false" : String(payload.execute)
      });
      const result = await mod.runOnce(env);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    sendJson(res, 200, {
      ok: true,
      service: "utalk-status-server",
      remarketing: getRemarketingStatus(),
      storedMembers: Object.keys(statusMap).length,
      queue: {
        currentMemberId: QUEUE[queueState.currentIndex],
        currentMemberName: MEMBER_NAMES[QUEUE[queueState.currentIndex]] || QUEUE[queueState.currentIndex],
        lastAssignedMemberId: queueState.lastAssignedMemberId,
        lastAssignedAtUTC: queueState.lastAssignedAtUTC
      },
      businessHours: isBusinessOpen()
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

  if (req.method === "GET" && url.pathname === "/available") {
    const memberId = normalizeMemberId(url.searchParams.get("memberId"));

    if (!memberId) {
      sendJson(res, 400, { error: "memberId obrigatorio" });
      return;
    }

    const available = statusMap[memberId] !== false;
    const inQueue = QUEUE.includes(memberId);
    const next = getAvailableQueueMember();
    const isNextInQueue = Boolean(next && next.memberId === memberId);
    const businessHours = isBusinessOpen();

    if (businessHours.open && available && inQueue && isNextInQueue) {
      assignQueueMember(memberId, next.index);
    }

    const canReceive = businessHours.open && (inQueue ? available && isNextInQueue : available);
    sendJson(res, canReceive ? 200 : 409, {
      memberId,
      available,
      name: MEMBER_NAMES[memberId] || memberId,
      canReceive,
      reason: canReceive
        ? "Atendente disponivel e na vez da fila."
        : !businessHours.open
          ? "Fora do horario de atendimento."
          : available
          ? "Atendente disponivel, mas ainda nao e a vez dela na fila."
          : "Atendente indisponivel.",
      status: available ? "available" : "unavailable",
      businessHours,
      queue: getQueueSnapshot()
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/direct-available") {
    const memberId = normalizeMemberId(url.searchParams.get("memberId"));

    if (!memberId) {
      sendJson(res, 400, { error: "memberId obrigatorio" });
      return;
    }

    const available = statusMap[memberId] !== false;
    const businessHours = isBusinessOpen();
    const canReceive = businessHours.open && available;

    sendJson(res, canReceive ? 200 : 409, {
      memberId,
      available,
      name: MEMBER_NAMES[memberId] || memberId,
      canReceive,
      reason: canReceive
        ? "Atendente disponivel dentro do horario."
        : !businessHours.open
          ? "Fora do horario de atendimento."
          : "Atendente indisponivel.",
      status: available ? "available" : "unavailable",
      businessHours
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
      saveDataStore();

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

    sendJson(res, 200, { statuses: statusMap, queue: getQueueSnapshot() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/queue") {
    if (!hasWriteAccess(req)) {
      sendJson(res, 401, { error: "Nao autorizado" });
      return;
    }

    sendJson(res, 200, { queue: getQueueSnapshot() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/queue/reset") {
    if (!hasWriteAccess(req)) {
      sendJson(res, 401, { error: "Nao autorizado" });
      return;
    }

    try {
      const rawBody = await readBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const memberId = normalizeMemberId(payload.memberId);
      const index = memberId ? QUEUE.indexOf(memberId) : 0;

      if (memberId && index === -1) {
        sendJson(res, 400, { error: "memberId nao faz parte da fila" });
        return;
      }

      queueState.currentIndex = index === -1 ? 0 : index;
      queueState.lastAssignedMemberId = null;
      queueState.lastAssignedAtUTC = null;
      saveDataStore();
      sendJson(res, 200, { queue: getQueueSnapshot() });
    } catch {
      sendJson(res, 400, { error: "JSON invalido" });
    }
    return;
  }

  sendJson(res, 404, { error: "Rota nao encontrada" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[status-server] Rodando na porta ${PORT}`);
  console.log("[status-server] GET  /health");
  console.log("[status-server] GET  /status?memberId=ID_DA_ATENDENTE");
  console.log("[status-server] GET  /available?memberId=ID_DA_ATENDENTE");
  console.log("[status-server] GET  /direct-available?memberId=ID_DA_ATENDENTE");
  console.log("[status-server] GET  /queue");
  console.log("[status-server] GET  /remarketing/health");
  console.log("[status-server] POST /remarketing/tick");
  console.log("[status-server] POST /remarketing/run-phone");
  console.log("[status-server] POST /status");
  console.log("[status-server] POST /queue/reset");
  console.log(`[status-server] DATA_FILE=${DATA_FILE}`);
  console.log(`[status-server] STATUS_API_KEY=${API_KEY ? "configurada" : "nao configurada"}`);
  startRemarketingWorkerIfEnabled();
});

function shutdown(signal) {
  console.log(`[status-server] Encerrando (${signal})`);
  if (remarketingTimer) clearInterval(remarketingTimer);
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
