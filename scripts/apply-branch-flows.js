const fs = require("fs");
const path = require("path");

const TOKEN = process.env.UMBLER_API_TOKEN;
const ORGANIZATION_ID = process.env.UMBLER_ORGANIZATION_ID || "ZQG4wFMHGHuTs59F";
const API_BASE = process.env.UMBLER_API_BASE_URL || "https://app-utalk.umbler.com/api";
const SOURCE_FLOW_ID = process.env.SOURCE_FLOW_ID || "ahWgp29Q4NlgpyeU";
const STATUS_BASE = "https://utalk-status-webhook-production.up.railway.app";

const FLOWS = {
  sj: {
    id: "aiBQZyxNLsXpDDwS",
    title: "teste - TELEVENDAS - Sao Jose",
    channels: ["ZaAgdeJmQyTgQhTs", "ZZRR85l_JmIQxo0T"],
    attendants: [
      { name: "ADRIELLI", memberId: "ZrzsX_BLm_zYqujY", tagId: "aRcXOulTi7VLe25M" },
      { name: "MICHELI.M", memberId: "Z5e_UnhziN5VdCCp", tagId: "aRcXlpId9HOMVvSO" }
    ]
  },
  ph: {
    id: "aiAw0vJQCsVttEzC",
    title: "teste - TELEVENDAS - Palhoca",
    channels: ["ZZRS4Jl_JmIQyDKA", "ZZRTMpwSM4RTFNHr"],
    attendants: [
      { name: "AMANDA", memberId: "ZuGqFp5N9i3HAKOn", tagId: "aRcc7SUhmYer23sK" },
      { name: "ROBSON", memberId: "ZaWboNQwFgY3oMeT", tagId: "aRcc0yUhmYer2zTn" }
    ]
  }
};

const IDS = {
  firstCheckMessage: "aiK87hUbFkASONgq",
  firstWebhook: "aiK87P-D72HsZvJI",
  firstSuccessMessage: "aiK87SJy0E0BnJ-H",
  firstTransfer: "aiK87AHIIuZpfCJu",
  secondCheckMessage: "aiK873VOTK54HFF1",
  secondWebhook: "aiK87IOwZtYwPedN",
  secondSuccessMessage: "aiK87T820fdxp0zp",
  secondTransfer: "aiK87BN40gyOkrd9",
  noAvailableMessage: "aiK87nNL50hEdZhI",
  firstConditional: "ahW9cqW2d8zkWsQv",
  secondConditional: "ahW-BwXCEP2GodSV",
  firstTag: "ahW9pz7NmL8V5lza",
  secondTag: "ahW-vaPXazLflJNR",
  firstWaiting: "aiMWaitAna000001",
  secondWaiting: "aiMWaitIsa000001",
  dayOfWeek: "ZQxNip1kTeEJ-ORl",
  patioCheckMessage: "aiK88M491E4pqw_R",
  patioWebhook: "aiK88FM_cnR7OJXg",
  patioSuccessMessage: "aiK88ZLTFAPGzT39",
  patioFailMessage: "aiK88wnkTWQCWImS",
  patioTransfer: "aiAZGW-g2SQ--RJ1"
};

function requireEnv() {
  if (!TOKEN) {
    throw new Error("Defina UMBLER_API_TOKEN antes de rodar.");
  }
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

function setMessage(step, text) {
  step.message = text;
}

function setTransfer(step, memberId) {
  step.options = {
    ...(step.options || {}),
    memberIds: [memberId],
    strategy: "Direct"
  };
}

function setSingleMemberConditional(step, attendant, onSuccess, onFail) {
  step.strategy = "Group";
  step.onSuccess = null;
  step.onFail = onFail;
  step.conditionalGroups = [
    {
      conditionals: [
        {
          _t: "MemberConditionalModel",
          members: [attendant.memberId],
          operator: "Any"
        }
      ],
      onSuccess,
      name: attendant.name
    }
  ];
}

function setAttendantTag(step, tagId, nextStepId) {
  step.option = "Add";
  step.tags = [];
  step.contactTags = [tagId];
  step.nextStepId = nextStepId;
}

function applyBranch(sourceBot, targetBot, branchKey, config) {
  const bot = JSON.parse(JSON.stringify(sourceBot));
  const steps = bot.steps || [];
  const stepsById = byId(steps);
  const [first, second] = config.attendants;

  bot.id = targetBot.id;
  bot.title = config.title;
  bot.active = true;
  bot.channels = config.channels.map((id) => ({ id }));
  bot.triggers = ["ChatCreatedByContact", "ContactMessage"];
  bot.manualTriggers = [];
  bot.updatedAtUTC = targetBot.updatedAtUTC;
  bot.createdAtUTC = targetBot.createdAtUTC;
  bot.lastSnapshotId = targetBot.lastSnapshotId;
  bot.executionsCount = targetBot.executionsCount || 0;
  bot.executionsDateUTC = targetBot.executionsDateUTC || null;
  bot.snapshotTitle = `Fila ${branchKey.toUpperCase()} independente - ${new Date().toISOString()}`;

  setMessage(
    stepsById.get(IDS.firstCheckMessage),
    `Fila ${branchKey.toUpperCase()}: verificando se ${first.name} esta disponivel e se e a vez dela receber este atendimento.`
  );
  stepsById.get(IDS.firstWebhook).uri =
    `${STATUS_BASE}/available?branch=${encodeURIComponent(branchKey)}&memberId=${encodeURIComponent(first.memberId)}`;
  stepsById.get(IDS.firstWebhook).onSuccess = IDS.firstSuccessMessage;
  stepsById.get(IDS.firstWebhook).onFail = IDS.secondCheckMessage;
  setMessage(
    stepsById.get(IDS.firstSuccessMessage),
    `${first.name} esta disponivel e e a proxima da fila ${branchKey.toUpperCase()}. O atendimento sera transferido para ela.`
  );
  setTransfer(stepsById.get(IDS.firstTransfer), first.memberId);
  stepsById.get(IDS.firstTransfer).nextStepId = IDS.firstConditional;
  stepsById.get(IDS.firstTransfer).onFail = IDS.secondCheckMessage;

  setMessage(
    stepsById.get(IDS.secondCheckMessage),
    `Fila ${branchKey.toUpperCase()}: verificando se ${second.name} esta disponivel e se e a vez dela receber este atendimento.`
  );
  stepsById.get(IDS.secondWebhook).uri =
    `${STATUS_BASE}/available?branch=${encodeURIComponent(branchKey)}&memberId=${encodeURIComponent(second.memberId)}`;
  stepsById.get(IDS.secondWebhook).onSuccess = IDS.secondSuccessMessage;
  stepsById.get(IDS.secondWebhook).onFail = IDS.noAvailableMessage;
  setMessage(
    stepsById.get(IDS.secondSuccessMessage),
    `${second.name} esta disponivel e e a proxima da fila ${branchKey.toUpperCase()}. O atendimento sera transferido para ela.`
  );
  setTransfer(stepsById.get(IDS.secondTransfer), second.memberId);
  stepsById.get(IDS.secondTransfer).nextStepId = IDS.firstConditional;
  stepsById.get(IDS.secondTransfer).onFail = IDS.noAvailableMessage;

  setMessage(
    stepsById.get(IDS.noAvailableMessage),
    `Fila ${branchKey.toUpperCase()}: nenhuma atendente disponivel ou estamos fora do horario. O chat ficara em espera para ser atendido assim que possivel.`
  );

  setSingleMemberConditional(stepsById.get(IDS.firstConditional), first, IDS.firstTag, IDS.secondConditional);
  setSingleMemberConditional(stepsById.get(IDS.secondConditional), second, IDS.secondTag, IDS.dayOfWeek);
  setAttendantTag(stepsById.get(IDS.firstTag), first.tagId, IDS.firstWaiting);
  setAttendantTag(stepsById.get(IDS.secondTag), second.tagId, IDS.secondWaiting);
  stepsById.get(IDS.firstWaiting).nextStepId = IDS.dayOfWeek;
  stepsById.get(IDS.secondWaiting).nextStepId = IDS.dayOfWeek;

  setMessage(
    stepsById.get(IDS.patioCheckMessage),
    `Patio ${branchKey.toUpperCase()}: verificando se ${first.name} pode receber este atendimento de veiculo apreendido.`
  );
  stepsById.get(IDS.patioWebhook).uri =
    `${STATUS_BASE}/direct-available?memberId=${encodeURIComponent(first.memberId)}`;
  stepsById.get(IDS.patioWebhook).onSuccess = IDS.patioSuccessMessage;
  stepsById.get(IDS.patioWebhook).onFail = IDS.patioFailMessage;
  setMessage(
    stepsById.get(IDS.patioSuccessMessage),
    `Patio ${branchKey.toUpperCase()}: ${first.name} esta disponivel. O atendimento sera transferido para ela.`
  );
  setMessage(
    stepsById.get(IDS.patioFailMessage),
    `Patio ${branchKey.toUpperCase()}: ${first.name} nao esta disponivel agora ou estamos fora do horario. Mesmo assim, o chat ficara em espera para ${first.name}.`
  );
  setTransfer(stepsById.get(IDS.patioTransfer), first.memberId);
  stepsById.get(IDS.patioTransfer).nextStepId = IDS.firstConditional;

  for (const step of steps) {
    if (step._t === "WebhookActionModel" && /available\\?memberId=/.test(step.uri || "")) {
      step.uri = step.uri.replace("/available?memberId=", `/available?branch=${branchKey}&memberId=`);
    }
  }

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
  if (!res.ok) {
    throw new Error(`Falha ao salvar ${bot.id}: ${res.status} ${res.text.slice(0, 1000)}`);
  }
  return res.data;
}

async function main() {
  requireEnv();
  const source = await getBot(SOURCE_FLOW_ID);
  const backupDir = path.join(__dirname, "..", "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  const results = [];
  for (const [branch, config] of Object.entries(FLOWS)) {
    const target = await getBot(config.id);
    const backupPath = path.join(backupDir, `flow-${config.id}-before-branch-queue-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(target, null, 2));

    const bot = applyBranch(source, target, branch, config);
    const missing = validateBot(bot);
    if (missing.length) {
      throw new Error(`Fluxo ${config.id} tem referencias quebradas: ${JSON.stringify(missing.slice(0, 10))}`);
    }

    if (process.argv.includes("--dry-run")) {
      results.push({ branch, id: config.id, title: bot.title, active: bot.active, steps: bot.steps.length, backupPath });
      continue;
    }

    await saveBot(bot);
    const saved = await getBot(config.id);
    const savedMissing = validateBot(saved);
    results.push({
      branch,
      id: config.id,
      title: saved.title,
      active: saved.active,
      channels: saved.channels,
      steps: saved.steps?.length || 0,
      missingRefs: savedMissing.length,
      backupPath
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
