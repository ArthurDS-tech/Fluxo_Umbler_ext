const fs = require("fs");
const path = require("path");

const TOKEN = process.env.UMBLER_API_TOKEN;
const ORGANIZATION_ID = process.env.UMBLER_ORGANIZATION_ID || "ZQG4wFMHGHuTs59F";
const API_BASE = process.env.UMBLER_API_BASE_URL || "https://app-utalk.umbler.com/api";
const STATUS_BASE = "https://utalk-status-webhook-production.up.railway.app";
const FLOW_ID = "aUWOP8NnXHj9QjWC";

const QUEUE = [
  { key: "bruna", name: "BRUNA", memberId: "ZzUQwM9nj2l-H5hc" },
  { key: "isa", name: "ISA", memberId: "ZaZlLHFmogpzC4xO" },
  { key: "julia", name: "JULIA", memberId: "ZoWIY_xoe7uoAAFQ" },
  { key: "kenia", name: "KENIA", memberId: "Z26n85VVIK64B6I2" },
  { key: "ana", name: "ANA", memberId: "ZaZkfnFmogpzCidw" }
];

const TRANSFER_ENTRY_IDS = [
  "aURc9U_Muiw87Klo",
  "aURfFLh15w-MSAD2",
  "aUVRWxqSNap8qUS5",
  "acPZPNfC2blZIjeQ",
  "aUU-yfYuYBCA_6KQ"
];

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

function makeQueueSteps(entryId, originalNextStepId, originalOnFail, groupIndex) {
  const steps = [];
  const baseX = 4100;
  const baseY = 200 + groupIndex * 650;
  const idPrefix = entryId.slice(0, 12);

  steps.push({
    _t: "SendMessageActionModel",
    organizationFileId: null,
    message: "Fila: vou verificar a proxima atendente disponivel para continuar este atendimento.",
    isPrivate: true,
    buttons: [],
    nextStepId: `${idPrefix}QW01`,
    position: { x: baseX, y: baseY },
    id: entryId
  });

  QUEUE.forEach((attendant, index) => {
    const number = String(index + 1).padStart(2, "0");
    const webhookId = `${idPrefix}QW${number}`;
    const successId = `${idPrefix}QS${number}`;
    const transferId = `${idPrefix}QT${number}`;
    const nextWebhookId = `${idPrefix}QW${String(index + 2).padStart(2, "0")}`;
    const onFail = index === QUEUE.length - 1 ? originalOnFail : nextWebhookId;
    const y = baseY + 120 + index * 120;

    steps.push({
      _t: "WebhookActionModel",
      uri: `${STATUS_BASE}/available?memberId=${encodeURIComponent(attendant.memberId)}`,
      method: "Get",
      headers: [],
      responseMessageMapper: [],
      requestContent: null,
      onSuccess: successId,
      onFail,
      position: { x: baseX + 350, y },
      id: webhookId
    });

    steps.push({
      _t: "SendMessageActionModel",
      organizationFileId: null,
      message: `${attendant.name} esta disponivel e e a proxima da fila. O atendimento sera transferido para ela.`,
      isPrivate: true,
      buttons: [],
      nextStepId: transferId,
      position: { x: baseX + 700, y },
      id: successId
    });

    steps.push({
      _t: "MemberTransferActionModel",
      target: "All",
      options: {
        memberIds: [attendant.memberId],
        strategy: "Direct"
      },
      onlyMembersAvailable: false,
      nextStepId: originalNextStepId,
      onFail,
      position: { x: baseX + 1050, y },
      id: transferId
    });
  });

  return steps;
}

function applyQueue(bot) {
  const steps = bot.steps || [];
  const byId = new Map(steps.map((step) => [step.id, step]));

  TRANSFER_ENTRY_IDS.forEach((entryId, index) => {
    const original = byId.get(entryId);
    if (!original) throw new Error(`Card de transferencia nao encontrado: ${entryId}`);
    const originalNextStepId = original.nextStepId;
    const originalOnFail = original.onFail;
    if (!originalNextStepId) throw new Error(`Card ${entryId} sem nextStepId original.`);
    if (!originalOnFail) throw new Error(`Card ${entryId} sem onFail original.`);

    const queueSteps = makeQueueSteps(entryId, originalNextStepId, originalOnFail, index);
    for (const queueStep of queueSteps) {
      const existing = byId.get(queueStep.id);
      if (existing) {
        Object.assign(existing, queueStep);
      } else {
        steps.push(queueStep);
        byId.set(queueStep.id, queueStep);
      }
    }
  });

  bot.snapshotTitle = `Avisos usa fila Railway - ${new Date().toISOString()}`;
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
  const payload = buildSavePayload(bot);
  const res = await request(`/v1/bots/flowchart/${encodeURIComponent(bot.id)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Falha ao salvar ${bot.id}: ${res.status} ${res.text.slice(0, 1000)}`);
  return res.data;
}

async function main() {
  requireEnv();
  const backupDir = path.join(__dirname, "..", "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  const bot = await getBot(FLOW_ID);
  const backupPath = path.join(backupDir, `flow-${FLOW_ID}-before-railway-queue-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(bot, null, 2));

  const updated = applyQueue(JSON.parse(JSON.stringify(bot)));
  const missing = validateBot(updated);
  if (missing.length) throw new Error(`Fluxo tem referencias quebradas: ${JSON.stringify(missing.slice(0, 10))}`);

  if (!process.argv.includes("--dry-run")) {
    await saveBot(updated);
  }

  const saved = process.argv.includes("--dry-run") ? updated : await getBot(FLOW_ID);
  const savedMissing = validateBot(saved);
  const transferEntries = TRANSFER_ENTRY_IDS.map((id) => saved.steps.find((step) => step.id === id));
  console.log(JSON.stringify({
    id: FLOW_ID,
    title: saved.title,
    active: saved.active,
    channels: saved.channels,
    steps: saved.steps?.length || 0,
    missingRefs: savedMissing.length,
    entryCards: transferEntries.map((step) => ({
      id: step?.id,
      type: step?._t,
      nextStepId: step?.nextStepId,
      message: step?.message
    })),
    backupPath
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
