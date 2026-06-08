const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.STATUS_API_KEY || "";
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "status-data.json");
const BODY_LIMIT_BYTES = 1024 * 64;
const LOG_LIMIT = Number(process.env.LOG_LIMIT || 1000);
const QUEUES = {
  main: [
  "ZzUQwM9nj2l-H5hc", // BRUNA
  "ZaZlLHFmogpzC4xO", // ISA
  "ZoWIY_xoe7uoAAFQ", // JULIA
  "Z26n85VVIK64B6I2", // KENIA
  "ZaZkfnFmogpzCidw" // ANA
  ],
  sj: [
    "ZrzsX_BLm_zYqujY", // ADRIELLI
    "Z5e_UnhziN5VdCCp" // MICHELI.M
  ],
  ph: [
    "ZuGqFp5N9i3HAKOn", // AMANDA
    "ZaWboNQwFgY3oMeT" // ROBSON
  ]
};
const MEMBER_NAMES = {
  "ZzUQwM9nj2l-H5hc": "BRUNA",
  "ZaZlLHFmogpzC4xO": "ISA",
  ZoWIY_xoe7uoAAFQ: "JULIA",
  Z26n85VVIK64B6I2: "KENIA",
  ZaZkfnFmogpzCidw: "ANA",
  ZrzsX_BLm_zYqujY: "ADRIELLI",
  Z5e_UnhziN5VdCCp: "MICHELI.M",
  ZuGqFp5N9i3HAKOn: "AMANDA",
  ZaWboNQwFgY3oMeT: "ROBSON",
  ZjjGI2sLFms4kT6b: "EVYLIN",
  "ZQxoyBkRFwc7X-Vk": "CRISTIANE",
  ZyJUBxlZDTR81qdF: "ESTER"
};
const BUSINESS_HOURS = {
  timeZone: "America/Sao_Paulo",
  startHour: 8,
  endHour: 18
};

const dataStore = loadDataStore();
const statusMap = dataStore.statuses;
const queueStates = dataStore.queues;
const eventLogs = dataStore.logs;
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
        queues: normalizeQueueStates(parsed.queues || parsed.queue),
        logs: normalizeLogs(parsed.logs)
      };
    }

    return {
      statuses: parsed,
      queues: normalizeQueueStates(null),
      logs: []
    };
  } catch (error) {
    console.warn(`[status-server] Nao foi possivel ler ${DATA_FILE}: ${error.message}`);
    return createEmptyDataStore();
  }
}

function createEmptyDataStore() {
  return {
    statuses: {},
    queues: normalizeQueueStates(null),
    logs: []
  };
}

function normalizeQueueStates(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const looksLikeSingleQueue =
    Object.prototype.hasOwnProperty.call(source, "currentIndex") ||
    Object.prototype.hasOwnProperty.call(source, "lastAssignedMemberId");

  const states = {};
  for (const branch of Object.keys(QUEUES)) {
    states[branch] = normalizeQueueState(looksLikeSingleQueue && branch === "main" ? source : source[branch], branch);
  }
  return states;
}

function normalizeQueueState(value, branch = "main") {
  const queue = getQueueForBranch(branch);
  const currentIndex = Number(value?.currentIndex);
  return {
    currentIndex: Number.isInteger(currentIndex) && currentIndex >= 0 ? currentIndex % queue.length : 0,
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
          queues: queueStates,
          logs: eventLogs
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error(`[status-server] Nao foi possivel salvar ${DATA_FILE}: ${error.message}`);
  }
}

function normalizeLogs(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .slice(-LOG_LIMIT);
}

function addLog(entry) {
  const log = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    kind: entry.kind || "info",
    title: entry.title || "Registro do sistema",
    text: entry.text || "",
    branch: entry.branch || null,
    memberId: entry.memberId || null,
    memberName: entry.memberName || (entry.memberId ? MEMBER_NAMES[entry.memberId] || entry.memberId : null),
    chatId: entry.chatId || null,
    contactPhone: entry.contactPhone || null,
    result: entry.result || null
  };

  eventLogs.push(log);
  if (eventLogs.length > LOG_LIMIT) {
    eventLogs.splice(0, eventLogs.length - LOG_LIMIT);
  }
  saveDataStore();
  return log;
}

function getLogsSnapshot(options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit || 200), LOG_LIMIT));
  const chatId = String(options.chatId || "").trim();
  const contactPhone = normalizePhone(options.contactPhone || options.phone);
  const memberId = normalizeMemberId(options.memberId);
  const branch = options.branch ? getBranchKey(options.branch) : "";

  return eventLogs
    .filter((item) => !chatId || item.chatId === chatId)
    .filter((item) => !contactPhone || normalizePhone(item.contactPhone) === contactPhone)
    .filter((item) => !memberId || item.memberId === memberId)
    .filter((item) => !branch || item.branch === branch)
    .slice(-limit)
    .reverse();
}

function getBranchKey(value) {
  const branch = String(value || "main").trim().toLowerCase();
  return QUEUES[branch] ? branch : "main";
}

function getQueueForBranch(branch = "main") {
  return QUEUES[getBranchKey(branch)];
}

function getQueueState(branch = "main") {
  return queueStates[getBranchKey(branch)];
}

function getAvailableQueueMember(branch = "main") {
  if (!isBusinessOpen().open) return null;

  const queue = getQueueForBranch(branch);
  const state = getQueueState(branch);
  for (let offset = 0; offset < queue.length; offset += 1) {
    const index = (state.currentIndex + offset) % queue.length;
    const memberId = queue[index];

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

function assignQueueMember(memberId, index, branch = "main") {
  const queue = getQueueForBranch(branch);
  const state = getQueueState(branch);
  state.currentIndex = (index + 1) % queue.length;
  state.lastAssignedMemberId = memberId;
  state.lastAssignedAtUTC = new Date().toISOString();
  saveDataStore();
}

function getQueueSnapshot(branch = "main") {
  const branchKey = getBranchKey(branch);
  const queue = getQueueForBranch(branchKey);
  const state = getQueueState(branchKey);
  const next = getAvailableQueueMember(branchKey);
  return {
    branch: branchKey,
    order: queue.map((memberId) => ({
      memberId,
      name: MEMBER_NAMES[memberId] || memberId,
      available: statusMap[memberId] !== false
    })),
    currentIndex: state.currentIndex,
    currentMemberId: queue[state.currentIndex],
    currentMemberName: MEMBER_NAMES[queue[state.currentIndex]] || queue[state.currentIndex],
    nextAvailableMemberId: next?.memberId || null,
    nextAvailableMemberName: next ? MEMBER_NAMES[next.memberId] || next.memberId : null,
    lastAssignedMemberId: state.lastAssignedMemberId,
    lastAssignedMemberName: state.lastAssignedMemberId
      ? MEMBER_NAMES[state.lastAssignedMemberId] || state.lastAssignedMemberId
      : null,
    lastAssignedAtUTC: state.lastAssignedAtUTC
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
  if (remarketingRunning) {
    addLog({
      kind: "warn",
      title: "Remarketing ja estava rodando",
      text: "Uma nova verificacao foi ignorada porque a anterior ainda nao tinha terminado.",
      result: "skipped"
    });
    return { skipped: true, reason: "remarketing_already_running" };
  }

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
    addLog({
      kind: summary.errors ? "warn" : "success",
      title: "Remarketing verificado",
      text: `${summary.checked} cadastro(s) avaliados, ${summary.sent} mensagem(ns) enviada(s), ${summary.skipped} ignorado(s) e ${summary.errors} erro(s).`,
      result: summary.errors ? "warning" : "success"
    });
    console.log(
      `[remarketing] checked=${summary.checked} sent=${summary.sent} skipped=${summary.skipped} errors=${summary.errors}`
    );
    return summary;
  } catch (error) {
    remarketingLastError = {
      at: new Date().toISOString(),
      message: error.message
    };
    addLog({
      kind: "error",
      title: "Remarketing com erro",
      text: error.message,
      result: "error"
    });
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

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
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
      addLog({
        kind: result?.error ? "error" : "success",
        title: "Teste de remarketing por telefone",
        text: result?.error
          ? result.error
          : `Telefone testado. Resultado: ${result?.validation?.reason || "verificacao concluida"}.`,
        chatId: result?.chatId || null,
        contactPhone: payload.phone || payload.testPhone || "",
        memberId: result?.selectedAttendant?.memberId || null,
        memberName: result?.selectedAttendant?.name || null,
        result: result?.error ? "error" : "success"
      });
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
      queues: Object.fromEntries(Object.keys(QUEUES).map((branch) => [branch, getQueueSnapshot(branch)])),
      businessHours: isBusinessOpen()
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/logs") {
    if (!hasWriteAccess(req)) {
      sendJson(res, 401, { error: "Nao autorizado" });
      return;
    }

    sendJson(res, 200, {
      logs: getLogsSnapshot({
        limit: url.searchParams.get("limit"),
        chatId: url.searchParams.get("chatId"),
        contactPhone: url.searchParams.get("contactPhone") || url.searchParams.get("phone"),
        memberId: url.searchParams.get("memberId"),
        branch: url.searchParams.get("branch")
      })
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
    const branchParam = url.searchParams.get("branch");
    const branch = getBranchKey(branchParam);

    if (!memberId) {
      sendJson(res, 400, { error: "memberId obrigatorio" });
      return;
    }

    const available = statusMap[memberId] !== false;
    const queue = getQueueForBranch(branch);
    const inQueue = queue.includes(memberId);
    const next = getAvailableQueueMember(branch);
    const isNextInQueue = Boolean(next && next.memberId === memberId);
    const businessHours = isBusinessOpen();

    if (businessHours.open && available && inQueue && isNextInQueue) {
      assignQueueMember(memberId, next.index, branch);
    }

    const requiresQueue = Boolean(branchParam);
    const canReceive = businessHours.open && (requiresQueue || inQueue ? inQueue && available && isNextInQueue : available);
    addLog({
      kind: canReceive ? "success" : "warn",
      title: "Fila consultada",
      text: canReceive
        ? `${MEMBER_NAMES[memberId] || memberId} estava disponivel e era a vez dela.`
        : !businessHours.open
          ? "O atendimento chegou fora do horario definido."
          : requiresQueue && !inQueue
          ? `${MEMBER_NAMES[memberId] || memberId} nao faz parte da fila ${branch}.`
          : available
          ? `${MEMBER_NAMES[memberId] || memberId} estava disponivel, mas ainda nao era a vez dela.`
          : `${MEMBER_NAMES[memberId] || memberId} estava indisponivel.`,
      branch,
      memberId,
      chatId: url.searchParams.get("chatId"),
      contactPhone: url.searchParams.get("phone"),
      result: canReceive ? "accepted" : "skipped"
    });
    sendJson(res, canReceive ? 200 : 409, {
      memberId,
      branch,
      available,
      name: MEMBER_NAMES[memberId] || memberId,
      canReceive,
      reason: canReceive
        ? "Atendente disponivel e na vez da fila."
        : !businessHours.open
          ? "Fora do horario de atendimento."
          : requiresQueue && !inQueue
          ? "Atendente nao faz parte da fila desta unidade."
          : available
          ? "Atendente disponivel, mas ainda nao e a vez dela na fila."
          : "Atendente indisponivel.",
      status: available ? "available" : "unavailable",
      businessHours,
      queue: getQueueSnapshot(branch)
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
    addLog({
      kind: canReceive ? "success" : "warn",
      title: "Atendente especifica consultada",
      text: canReceive
        ? `${MEMBER_NAMES[memberId] || memberId} estava disponivel dentro do horario.`
        : !businessHours.open
          ? "O atendimento chegou fora do horario definido."
          : `${MEMBER_NAMES[memberId] || memberId} estava indisponivel.`,
      memberId,
      chatId: url.searchParams.get("chatId"),
      contactPhone: url.searchParams.get("phone"),
      result: canReceive ? "accepted" : "skipped"
    });

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
      addLog({
        kind: available ? "success" : "warn",
        title: "Disponibilidade alterada",
        text: `${MEMBER_NAMES[memberId] || memberId} marcou ${available ? "disponivel" : "indisponivel"}.`,
        memberId,
        result: available ? "available" : "unavailable"
      });

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

    sendJson(res, 200, {
      statuses: statusMap,
      queues: Object.fromEntries(Object.keys(QUEUES).map((branch) => [branch, getQueueSnapshot(branch)]))
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/queue") {
    if (!hasWriteAccess(req)) {
      sendJson(res, 401, { error: "Nao autorizado" });
      return;
    }

    const branch = getBranchKey(url.searchParams.get("branch"));
    sendJson(res, 200, { queue: getQueueSnapshot(branch) });
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
      const branch = getBranchKey(payload.branch);
      const queue = getQueueForBranch(branch);
      const state = getQueueState(branch);
      const index = memberId ? queue.indexOf(memberId) : 0;

      if (memberId && index === -1) {
        sendJson(res, 400, { error: "memberId nao faz parte da fila" });
        return;
      }

      state.currentIndex = index === -1 ? 0 : index;
      state.lastAssignedMemberId = null;
      state.lastAssignedAtUTC = null;
      saveDataStore();
      addLog({
        kind: "warn",
        title: "Fila reposicionada",
        text: memberId
          ? `A fila ${branch} foi ajustada para comecar por ${MEMBER_NAMES[memberId] || memberId}.`
          : `A fila ${branch} foi reiniciada pelo primeiro nome da lista.`,
        branch,
        memberId: memberId || null,
        result: "reset"
      });
      sendJson(res, 200, { queue: getQueueSnapshot(branch) });
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
  console.log("[status-server] GET  /logs");
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
