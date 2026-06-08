const fs = require("fs");
const path = require("path");

const TOKEN = process.env.UMBLER_API_TOKEN;
const ORGANIZATION_ID = process.env.UMBLER_ORGANIZATION_ID || "ZQG4wFMHGHuTs59F";
const API_BASE = process.env.UMBLER_API_BASE_URL || "https://app-utalk.umbler.com/api";
const STATUS_BASE = "https://utalk-status-webhook-production.up.railway.app";

const FLOWS = {
  main: { id: "ahWgp29Q4NlgpyeU", label: "Florianopolis" },
  sj: { id: "aiBQZyxNLsXpDDwS", label: "Sao Jose" },
  ph: { id: "aiAw0vJQCsVttEzC", label: "Palhoca" }
};

const QUEUE_START_ID = "aiK87hUbFkASONgq";
const MEMBER_CONDITION_START_ID = "ahW9cqW2d8zkWsQv";
const WEBHOOK_ID = "aiQCleanWeb0001X";
const DONE_MESSAGE_ID = "aiQCleanDone001X";
const FAIL_MESSAGE_ID = "aiQCleanFail001X";
const FAIL_WAIT_ID = "aiQCleanWait001X";

function requireEnv() {
  if (!TOKEN) throw new Error("Defina UMBLER_API_TOKEN antes de rodar.");
}

async function request(pathname, options = {}) {
  const separator = pathname.includes("?") ? "&" : "?";
  const url = `${API_BASE}${pathname}${separator}organizationId=${encodeURIComponent(ORGANIZATION_ID)}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data, text };
}

async function getBot(id) {
  const res = await request(`/v1/bots/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Falha ao buscar bot ${id}: ${res.status} ${res.text.slice(0, 300)}`);
  return res.data.bot || res.data;
}

function byId(steps) {
  return new Map(steps.map((step) => [step.id, step]));
}

function upsertStep(steps, step) {
  const existing = steps.find((item) => item.id === step.id);
  if (existing) Object.assign(existing, step);
  else steps.push(step);
}

function applyCleanQueue(bot, branch, config) {
  const steps = bot.steps || [];
  const stepsById = byId(steps);
  const queueStart = stepsById.get(QUEUE_START_ID);
  if (!queueStart) throw new Error(`Card inicial da fila nao encontrado no fluxo ${bot.id}`);
  if (!stepsById.get(MEMBER_CONDITION_START_ID)) {
    throw new Error(`Card de etiqueta por atendente nao encontrado no fluxo ${bot.id}`);
  }

  Object.assign(queueStart, {
    _t: "SendMessageActionModel",
    organizationFileId: null,
    message: `Sistema do Arthur: verificando a fila ${config.label} e escolhendo a responsavel correta para este atendimento.`,
    isPrivate: true,
    buttons: [],
    nextStepId: WEBHOOK_ID
  });

  upsertStep(steps, {
    _t: "WebhookActionModel",
    uri: `${STATUS_BASE}/assign-queue?branch=${encodeURIComponent(branch)}&chatId={{Conversa.Id}}&phone={{Contato.Numero}}`,
    method: "Get",
    headers: [],
    responseMessageMapper: [],
    requestContent: null,
    onSuccess: DONE_MESSAGE_ID,
    onFail: FAIL_MESSAGE_ID,
    position: {
      x: (queueStart.position?.x || 1450) + 360,
      y: queueStart.position?.y || 650
    },
    id: WEBHOOK_ID
  });

  upsertStep(steps, {
    _t: "SendMessageActionModel",
    organizationFileId: null,
    message:
      `Sistema do Arthur: atendimento direcionado pela fila ${config.label}. ` +
      `Responsavel definida: {{#Ou}} {{Contexto.${WEBHOOK_ID}:memberName}} | equipe de atendimento {{/Ou}}.`,
    isPrivate: true,
    buttons: [],
    nextStepId: MEMBER_CONDITION_START_ID,
    position: {
      x: (queueStart.position?.x || 1450) + 720,
      y: queueStart.position?.y || 650
    },
    id: DONE_MESSAGE_ID
  });

  upsertStep(steps, {
    _t: "SendMessageActionModel",
    organizationFileId: null,
    message:
      "Sistema do Arthur: nao consegui confirmar a fila automaticamente. " +
      "O atendimento ficara em esperando para a equipe conferir sem perder o cliente.",
    isPrivate: true,
    buttons: [],
    nextStepId: FAIL_WAIT_ID,
    position: {
      x: (queueStart.position?.x || 1450) + 720,
      y: (queueStart.position?.y || 650) + 220
    },
    id: FAIL_MESSAGE_ID
  });

  upsertStep(steps, {
    _t: "SetWaitingStateActionModel",
    waiting: true,
    nextStepId: null,
    position: {
      x: (queueStart.position?.x || 1450) + 1080,
      y: (queueStart.position?.y || 650) + 220
    },
    id: FAIL_WAIT_ID
  });

  bot.snapshotTitle = `Fila limpa sem 409 ${config.label} - ${new Date().toISOString()}`;
  return bot;
}

function refsFromStep(step) {
  const refs = [];
  for (const key of ["nextStepId", "onSuccess", "onFail", "defaultNextStep", "onTimeout", "onResponseFail"]) {
    if (typeof step[key] === "string" && step[key]) refs.push({ from: step.id, key, to: step[key] });
  }
  if (Array.isArray(step.options)) {
    step.options.forEach((option, index) => {
      if (option?.stepId) refs.push({ from: step.id, key: `options[${index}].stepId`, to: option.stepId });
      if (option?.nextStepId) refs.push({ from: step.id, key: `options[${index}].nextStepId`, to: option.nextStepId });
    });
  }
  if (Array.isArray(step.stepsForDaysOfTheWeek)) {
    step.stepsForDaysOfTheWeek.forEach((id, index) => {
      if (id) refs.push({ from: step.id, key: `stepsForDaysOfTheWeek[${index}]`, to: id });
    });
  }
  if (Array.isArray(step.conditionalGroups)) {
    step.conditionalGroups.forEach((group, index) => {
      if (group?.onSuccess) refs.push({ from: step.id, key: `conditionalGroups[${index}].onSuccess`, to: group.onSuccess });
    });
  }
  return refs;
}

function validateBot(bot) {
  const ids = new Set((bot.steps || []).map((step) => step.id));
  const missing = [];
  for (const step of bot.steps || []) {
    for (const ref of refsFromStep(step)) {
      if (!ids.has(ref.to)) missing.push(ref);
    }
  }
  return missing;
}

function sanitizePlain(value) {
  if (Array.isArray(value)) return value.map(sanitizePlain);
  if (!value || typeof value !== "object") return value;

  const copy = {};
  for (const [key, raw] of Object.entries(value)) {
    if (["createdAtUTC", "updatedAtUTC", "executionsCount", "executionsDateUTC", "lastSnapshotId"].includes(key)) continue;
    if (key === "footer" && raw === null) continue;
    copy[key] = sanitizePlain(raw);
  }
  return copy;
}

function createTypeName(typeName) {
  if (!typeName || typeName.startsWith("Create")) return typeName;
  return `Create${typeName}`;
}

function sanitizeStepForSave(step) {
  const copy = sanitizePlain(step);
  copy._t = createTypeName(step._t);
  if (Array.isArray(copy.options)) {
    const optionType = step._t === "RegexStepModel" ? "CreateRegexOptionModel" : "CreateBotOptionModel";
    copy.options = copy.options.map((option) => ({
      _t: option._t || optionType,
      ...option
    }));
  }
  return copy;
}

function buildSavePayload(bot) {
  const payload = sanitizePlain(bot);
  payload._t = "EditFlowchartBotModel";
  payload.channelIds = (bot.channels || []).map((channel) => channel.id);
  payload.steps = (bot.steps || []).map((step) => sanitizeStepForSave(step));
  return payload;
}

async function saveBot(bot) {
  const res = await request(`/v1/bots/flowchart/${encodeURIComponent(bot.id)}`, {
    method: "PUT",
    body: JSON.stringify(buildSavePayload(bot))
  });
  if (!res.ok) throw new Error(`Falha ao salvar ${bot.id}: ${res.status} ${res.text.slice(0, 1000)}`);
}

async function main() {
  requireEnv();
  const dryRun = process.argv.includes("--dry-run");
  const backupDir = path.join(__dirname, "..", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const results = [];

  for (const [branch, config] of Object.entries(FLOWS)) {
    const bot = await getBot(config.id);
    const backupPath = path.join(backupDir, `flow-${config.id}-before-clean-queue-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(bot, null, 2));

    const updated = applyCleanQueue(JSON.parse(JSON.stringify(bot)), branch, config);
    const missing = validateBot(updated);
    if (missing.length) throw new Error(`Fluxo ${config.id} com referencias quebradas: ${JSON.stringify(missing.slice(0, 10))}`);

    if (!dryRun) await saveBot(updated);
    const saved = dryRun ? updated : await getBot(config.id);
    results.push({
      branch,
      id: config.id,
      title: saved.title,
      active: saved.active,
      steps: saved.steps?.length || 0,
      missingRefs: validateBot(saved).length,
      queueStartNext: saved.steps?.find((step) => step.id === QUEUE_START_ID)?.nextStepId,
      webhookUri: saved.steps?.find((step) => step.id === WEBHOOK_ID)?.uri,
      backupPath,
      dryRun
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
