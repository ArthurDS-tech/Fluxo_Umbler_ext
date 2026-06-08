const fs = require("fs");
const path = require("path");

const TOKEN = process.env.UMBLER_API_TOKEN;
const ORGANIZATION_ID = process.env.UMBLER_ORGANIZATION_ID || "ZQG4wFMHGHuTs59F";
const API_BASE = process.env.UMBLER_API_BASE_URL || "https://app-utalk.umbler.com/api";
const STATUS_BASE = "https://utalk-status-webhook-production.up.railway.app";

const FLOWS = {
  sj: {
    id: "aiBQZyxNLsXpDDwS",
    label: "SJ",
    queueStart: "aiK87hUbFkASONgq",
    preferred: ["adrielli", "micheli", "amanda", "robson", "ana", "isa", "julia", "kenia", "bruna"]
  },
  ph: {
    id: "aiAw0vJQCsVttEzC",
    label: "PH",
    queueStart: "aiK87hUbFkASONgq",
    preferred: ["amanda", "robson", "adrielli", "micheli", "ana", "isa", "julia", "kenia", "bruna"]
  }
};

const TAG_GATE_ID = "ahWHlp-bJKqv3Z25";
const DAY_OF_WEEK_ID = "ZQxNip1kTeEJ-ORl";
const GENERIC_WAITING_ID = "aiMWaitAna000001";

const OWNER_CONDITIONAL_IDS = [
  "ahWaC_aSGnCj6KLn",
  "ahWctr3Avs_ml00G",
  "ahW8pF8vO5JoX83a",
  "ahW83cXHup_5iJWn",
  "ahW9FnK4-0jVxYZy",
  "aiOwnCond000001X",
  "aiOwnCond000002X",
  "aiOwnCond000003X",
  "aiOwnCond000004X"
];

const OWNERS = {
  ana: { name: "ANA", memberId: "ZaZkfnFmogpzCidw", tagId: "aRcUrulTi7VLdefG", waitingId: "aiMWaitAna000001" },
  isa: { name: "ISA", memberId: "ZaZlLHFmogpzC4xO", tagId: "aRcX9elTi7VLfbiN", waitingId: "aiMWaitIsa000001" },
  julia: { name: "JULIA", memberId: "ZoWIY_xoe7uoAAFQ", tagId: "aRcUv3AZQLndGPqS", waitingId: "aiMWaitJul000001" },
  kenia: { name: "KENIA", memberId: "Z26n85VVIK64B6I2", tagId: "aRcVICUhmYerxl6F", waitingId: "aiMWaitKen000001" },
  bruna: { name: "BRUNA", memberId: "ZzUQwM9nj2l-H5hc", tagId: "aRcU4SUhmYerxbuc", waitingId: "aiMWaitBru000001" },
  adrielli: { name: "ADRIELLI", memberId: "ZrzsX_BLm_zYqujY", tagId: "aRcXOulTi7VLe25M", waitingId: GENERIC_WAITING_ID },
  micheli: { name: "MICHELI", memberId: "Zafi39QwFgY3PIe3", tagId: "aRcXlpId9HOMVvSO", waitingId: "aiMWaitIsa000001" },
  amanda: { name: "AMANDA", memberId: "ZuGqFp5N9i3HAKOn", tagId: "aRcc7SUhmYer23sK", waitingId: GENERIC_WAITING_ID },
  robson: { name: "ROBSON", memberId: "ZaWboNQwFgY3oMeT", tagId: "aRcc0yUhmYer2zTn", waitingId: "aiMWaitIsa000001" }
};

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

function makeConditional(id, owner, onSuccess, onFail, index) {
  return {
    _t: "ConditionalActionModel",
    strategy: "Group",
    onSuccess: null,
    onFail,
    conditionalGroups: [
      {
        conditionals: [
          {
            _t: "SectorConditionalModel",
            sectors: ["aSRq-Q8ELj-uto7s"],
            operator: "Any"
          },
          {
            _t: "TagConditionalModel",
            chatTags: [],
            contactTags: [owner.tagId],
            operator: "Equals"
          }
        ],
        onSuccess,
        name: owner.name
      }
    ],
    position: { x: 2250 + index * 360, y: 4550 },
    id
  };
}

function makeOwnerSteps(flowKey, ownerKey, owner, nextFailId, index) {
  const prefix = `aiO${flowKey.toUpperCase()}${String(index + 1).padStart(2, "0")}OWNER`;
  const messageId = `${prefix}Msg1`;
  const webhookId = `${prefix}Web1`;
  const successId = `${prefix}Okay`;
  const transferId = `${prefix}Tran`;
  const y = 5050 + index * 260;
  const waitingId = owner.waitingId || GENERIC_WAITING_ID;

  return {
    messageId,
    steps: [
      {
        _t: "SendMessageActionModel",
        organizationFileId: null,
        message: `Cliente ja esta com etiqueta ${owner.name}. Vou verificar se esta disponivel para receber este atendimento.`,
        isPrivate: true,
        buttons: [],
        nextStepId: webhookId,
        position: { x: 2250, y },
        id: messageId
      },
      {
        _t: "WebhookActionModel",
        uri: `${STATUS_BASE}/direct-available?memberId=${encodeURIComponent(owner.memberId)}`,
        method: "Get",
        headers: [],
        responseMessageMapper: [],
        requestContent: null,
        onSuccess: successId,
        onFail: nextFailId,
        position: { x: 2600, y },
        id: webhookId
      },
      {
        _t: "SendMessageActionModel",
        organizationFileId: null,
        message: `${owner.name} esta disponivel. O atendimento volta para a responsavel da etiqueta.`,
        isPrivate: true,
        buttons: [],
        nextStepId: transferId,
        position: { x: 2950, y },
        id: successId
      },
      {
        _t: "MemberTransferActionModel",
        target: "All",
        options: {
          memberIds: [owner.memberId],
          strategy: "Direct"
        },
        onlyMembersAvailable: false,
        nextStepId: waitingId,
        onFail: nextFailId,
        position: { x: 3300, y },
        id: transferId
      }
    ]
  };
}

function applyOwnerValidation(bot, flowKey, config) {
  const steps = bot.steps || [];
  const stepsById = byId(steps);
  const ownerKeys = config.preferred;
  const ownerSteps = [];

  const ownerStepData = ownerKeys.map((ownerKey, index) => {
    const owner = OWNERS[ownerKey];
    const nextConditionalId = OWNER_CONDITIONAL_IDS[index + 1] || config.queueStart;
    const nextFailId = index === ownerKeys.length - 1 ? config.queueStart : nextConditionalId;
    const data = makeOwnerSteps(flowKey, ownerKey, owner, nextFailId, index);
    ownerSteps.push(...data.steps);
    return { ownerKey, owner, conditionalId: OWNER_CONDITIONAL_IDS[index], messageId: data.messageId, nextFailId, index };
  });

  for (const data of ownerStepData) {
    const conditional = makeConditional(data.conditionalId, data.owner, data.messageId, data.nextFailId, data.index);
    const existing = stepsById.get(data.conditionalId);
    if (existing) {
      Object.assign(existing, conditional);
    } else {
      steps.push(conditional);
    }
  }

  for (const step of ownerSteps) {
    const existing = stepsById.get(step.id);
    if (existing) Object.assign(existing, step);
    else steps.push(step);
  }

  const gate = stepsById.get(TAG_GATE_ID);
  if (gate?.conditionalGroups?.[1]?.conditionals?.[0]) {
    gate.onFail = OWNER_CONDITIONAL_IDS[0];
    gate.conditionalGroups[1].conditionals[0].contactTags = ownerKeys.map((key) => OWNERS[key].tagId);
  }

  for (const id of ["aiMWaitAna000001", "aiMWaitIsa000001", "aiMWaitJul000001", "aiMWaitBru000001", "aiMWaitKen000001"]) {
    const waiting = stepsById.get(id);
    if (waiting) {
      waiting.waiting = true;
      waiting.nextStepId = DAY_OF_WEEK_ID;
    }
  }

  bot.snapshotTitle = `Valida dono da etiqueta ${config.label} - ${new Date().toISOString()}`;
  return bot;
}

function refsFromStep(step) {
  const refs = [];
  for (const key of ["nextStepId", "onSuccess", "onFail", "defaultNextStep"]) {
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
  const results = [];

  for (const [flowKey, config] of Object.entries(FLOWS)) {
    const bot = await getBot(config.id);
    const backupPath = path.join(backupDir, `flow-${config.id}-before-owner-validation-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(bot, null, 2));

    const updated = applyOwnerValidation(JSON.parse(JSON.stringify(bot)), flowKey, config);
    const missing = validateBot(updated);
    if (missing.length) throw new Error(`Fluxo ${config.id} tem referencias quebradas: ${JSON.stringify(missing.slice(0, 10))}`);

    if (!process.argv.includes("--dry-run")) {
      await saveBot(updated);
    }

    const saved = process.argv.includes("--dry-run") ? updated : await getBot(config.id);
    results.push({
      flowKey,
      id: config.id,
      title: saved.title,
      active: saved.active,
      channels: saved.channels,
      steps: saved.steps?.length || 0,
      missingRefs: validateBot(saved).length,
      tagGateOnFail: saved.steps?.find((step) => step.id === TAG_GATE_ID)?.onFail,
      backupPath
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
