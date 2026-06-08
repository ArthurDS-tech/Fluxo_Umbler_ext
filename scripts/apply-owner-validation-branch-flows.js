const fs = require("fs");
const path = require("path");

const TOKEN = process.env.UMBLER_API_TOKEN;
const ORGANIZATION_ID = process.env.UMBLER_ORGANIZATION_ID || "ZQG4wFMHGHuTs59F";
const API_BASE = process.env.UMBLER_API_BASE_URL || "https://app-utalk.umbler.com/api";
const STATUS_BASE = "https://utalk-status-webhook-production.up.railway.app";

const FLOWS = {
  main: {
    id: "ahWgp29Q4NlgpyeU",
    label: "Principal",
    prefix: "MN",
    queueStart: "aiK87hUbFkASONgq",
    channels: [
      "ZQxHaZ4vN7FoyHm7",
      "ZQxHphkRFwc7FJ2W",
      "ZZRSn5wSM4RTE7KJ",
      "aicOVx099okrepMI",
      "aibCkWoD3AhLiWE2",
      "ZwWSUqYuIZ8I3hxt",
      "ZtXHk4I_xBAd46pH",
      "ZQxHlJ4vN7FoyPqG"
    ],
    preferred: ["cristiane", "ester", "ana", "kenia", "julia", "isa", "bruna"]
  },
  sj: {
    id: "aiBQZyxNLsXpDDwS",
    label: "SJ",
    prefix: "SJ",
    queueStart: "aiK87hUbFkASONgq",
    channels: ["ZaAgdeJmQyTgQhTs", "ZZRR85l_JmIQxo0T", "ZZRSipl_JmIQx5qg", "Zj4crV8ECNOxXLpX"],
    preferred: ["evylin", "adrielli", "micheli"]
  },
  ph: {
    id: "aiAw0vJQCsVttEzC",
    label: "PH",
    prefix: "PH",
    queueStart: "aiK87hUbFkASONgq",
    channels: ["ZZRS4Jl_JmIQyDKA", "ZZRTMpwSM4RTFNHr", "ZZRSyJl_JmIQyAWW", "aJtKOl4daaS-nrAB"],
    preferred: ["amanda", "robson"]
  }
};

const TAG_GATE_ID = "ahWHlp-bJKqv3Z25";
const PARTNER_GATE_ID = "aiPartnerGate001";
const PARTNER_NOTE_ID = "aiPartnerNote001";
const PARTNER_TAG_ID = "aG67LR9r7uYtRuW7";
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
  "aiOwnCond000004X",
  "aiOwnCond000005X",
  "aiOwnCond000006X",
  "aiOwnCond000007X"
];

const OWNERS = {
  ana: { name: "ANA", memberId: "ZaZkfnFmogpzCidw", tagId: "aRcUrulTi7VLdefG", waitingId: "aiMWaitAna000001" },
  isa: { name: "ISA", memberId: "ZaZlLHFmogpzC4xO", tagId: "aRcX9elTi7VLfbiN", waitingId: "aiMWaitIsa000001" },
  julia: { name: "JULIA", memberId: "ZoWIY_xoe7uoAAFQ", tagId: "aRcUv3AZQLndGPqS", waitingId: "aiMWaitJul000001" },
  kenia: { name: "KENIA", memberId: "Z26n85VVIK64B6I2", tagId: "aRcVICUhmYerxl6F", waitingId: "aiMWaitKen000001" },
  bruna: { name: "BRUNA", memberId: "ZzUQwM9nj2l-H5hc", tagId: "aRcU4SUhmYerxbuc", waitingId: "aiMWaitBru000001" },
  adrielli: { name: "ADRIELLI", memberId: "ZrzsX_BLm_zYqujY", tagId: "aRcXOulTi7VLe25M", waitingId: GENERIC_WAITING_ID },
  micheli: { name: "MICHELI.M", memberId: "Z5e_UnhziN5VdCCp", tagId: "aRcXlpId9HOMVvSO", waitingId: "aiMWaitIsa000001" },
  amanda: { name: "AMANDA", memberId: "ZuGqFp5N9i3HAKOn", tagId: "aRcc7SUhmYer23sK", waitingId: GENERIC_WAITING_ID },
  robson: { name: "ROBSON", memberId: "ZaWboNQwFgY3oMeT", tagId: "aRcc0yUhmYer2zTn", waitingId: "aiMWaitIsa000001" },
  evylin: { name: "EVYLIN", memberId: "ZjjGI2sLFms4kT6b", tagId: "aRcXLHAZQLndHdD8", waitingId: GENERIC_WAITING_ID },
  cristiane: { name: "CRISTIANE", memberId: "ZQxoyBkRFwc7X-Vk", tagId: "aRcXpyUhmYerzT5-", waitingId: GENERIC_WAITING_ID },
  ester: { name: "ESTER", memberId: "ZyJUBxlZDTR81qdF", tagId: "aRcXvSUhmYerzXRL", waitingId: GENERIC_WAITING_ID }
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

function makePartnerGate(queueStart) {
  return {
    _t: "ConditionalActionModel",
    strategy: "Global",
    onSuccess: PARTNER_NOTE_ID,
    onFail: TAG_GATE_ID,
    conditionalGroups: [
      {
        conditionals: [
          {
            _t: "TagConditionalModel",
            chatTags: [],
            contactTags: [PARTNER_TAG_ID],
            operator: "Equals"
          }
        ],
        onSuccess: null,
        name: "Cliente parceiro"
      }
    ],
    position: { x: 1850, y: 4550 },
    id: PARTNER_GATE_ID
  };
}

function makePartnerNote(queueStart, label) {
  return {
    _t: "SendMessageActionModel",
    organizationFileId: null,
    message:
      `Cliente marcado como Parceiro. Vou seguir pela fila ${label}, sem usar etiqueta antiga de atendente, para evitar transferencia errada.`,
    isPrivate: true,
    buttons: [],
    nextStepId: queueStart,
    position: { x: 2050, y: 4850 },
    id: PARTNER_NOTE_ID
  };
}

function makeOwnerSteps(flowPrefix, ownerKey, owner, nextFailId, index) {
  const prefix = `aiO${flowPrefix}${String(index + 1).padStart(2, "0")}OWNER`;
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
  const flowPrefix = config.prefix || flowKey.toUpperCase();

  bot.triggers = ["ChatCreatedByContact", "Manual"];

  if (Array.isArray(config.channels)) {
    bot.channels = config.channels.map((id) => ({ id }));
  }

  for (const step of steps) {
    for (const key of ["nextStepId", "onSuccess", "onFail", "defaultNextStep"]) {
      if (step[key] === TAG_GATE_ID) step[key] = PARTNER_GATE_ID;
    }
    if (Array.isArray(step.options)) {
      for (const option of step.options) {
        if (option.stepId === TAG_GATE_ID) option.stepId = PARTNER_GATE_ID;
        if (option.nextStepId === TAG_GATE_ID) option.nextStepId = PARTNER_GATE_ID;
      }
    }
    if (Array.isArray(step.stepsForDaysOfTheWeek)) {
      step.stepsForDaysOfTheWeek = step.stepsForDaysOfTheWeek.map((id) => (id === TAG_GATE_ID ? PARTNER_GATE_ID : id));
    }
    if (Array.isArray(step.conditionalGroups)) {
      for (const group of step.conditionalGroups) {
        if (group.onSuccess === TAG_GATE_ID) group.onSuccess = PARTNER_GATE_ID;
      }
    }

    if (
      step._t === "SetWaitingStateActionModel" &&
      (step.nextStepId === TAG_GATE_ID || step.nextStepId === PARTNER_GATE_ID)
    ) {
      step.nextStepId = null;
    }
  }

  const partnerGate = makePartnerGate(config.queueStart);
  const partnerNote = makePartnerNote(config.queueStart, config.label);
  const existingPartnerGate = stepsById.get(PARTNER_GATE_ID);
  if (existingPartnerGate) Object.assign(existingPartnerGate, partnerGate);
  else steps.push(partnerGate);
  const existingPartnerNote = stepsById.get(PARTNER_NOTE_ID);
  if (existingPartnerNote) Object.assign(existingPartnerNote, partnerNote);
  else steps.push(partnerNote);

  const ownerStepData = ownerKeys.map((ownerKey, index) => {
    const owner = OWNERS[ownerKey];
    const nextConditionalId = OWNER_CONDITIONAL_IDS[index + 1] || config.queueStart;
    const nextFailId = index === ownerKeys.length - 1 ? config.queueStart : nextConditionalId;
    const data = makeOwnerSteps(flowPrefix, ownerKey, owner, nextFailId, index);
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
  if (gate) {
    gate.strategy = "Global";
    gate.onSuccess = OWNER_CONDITIONAL_IDS[0];
    gate.onFail = config.queueStart;
    gate.conditionalGroups = [
      {
        conditionals: [
          {
            _t: "TagConditionalModel",
            chatTags: [],
            contactTags: ownerKeys.map((key) => OWNERS[key].tagId),
            operator: "Equals"
          }
        ],
        onSuccess: null,
        name: "Cliente com etiqueta de atendente"
      }
    ];
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
      partnerGateOnFail: saved.steps?.find((step) => step.id === PARTNER_GATE_ID)?.onFail,
      partnerGateOnSuccess: saved.steps?.find((step) => step.id === PARTNER_GATE_ID)?.onSuccess,
      backupPath
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
