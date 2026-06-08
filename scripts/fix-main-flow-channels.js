const fs = require("fs");
const path = require("path");

const TOKEN = process.env.UMBLER_API_TOKEN;
const ORGANIZATION_ID = process.env.UMBLER_ORGANIZATION_ID || "ZQG4wFMHGHuTs59F";
const API_BASE = process.env.UMBLER_API_BASE_URL || "https://app-utalk.umbler.com/api";
const FLOW_ID = "ahWgp29Q4NlgpyeU";

const REQUIRED_CHANNELS = [
  "ZQxHaZ4vN7FoyHm7",
  "ZQxHphkRFwc7FJ2W",
  "ZZRSn5wSM4RTE7KJ",
  "aicOVx099okrepMI",
  "aibCkWoD3AhLiWE2",
  "ZwWSUqYuIZ8I3hxt",
  "ZtXHk4I_xBAd46pH",
  "ZQxHlJ4vN7FoyPqG"
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

  const bot = await getBot(FLOW_ID);
  const backupPath = path.join(backupDir, `flow-${FLOW_ID}-before-main-channels-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(bot, null, 2));

  const currentIds = new Set((bot.channels || []).map((channel) => channel.id));
  const missingBefore = REQUIRED_CHANNELS.filter((id) => !currentIds.has(id));
  bot.channels = REQUIRED_CHANNELS.map((id) => ({ id }));
  bot.snapshotTitle = `Canais principais revisados - ${new Date().toISOString()}`;

  const missingRefs = validateBot(bot);
  if (missingRefs.length) throw new Error(`Fluxo principal com referencias quebradas: ${JSON.stringify(missingRefs.slice(0, 10))}`);

  if (!dryRun) await saveBot(bot);

  const saved = dryRun ? bot : await getBot(FLOW_ID);
  const savedChannelIds = (saved.channels || []).map((channel) => channel.id);
  console.log(JSON.stringify({
    flowId: FLOW_ID,
    title: saved.title,
    active: saved.active,
    steps: saved.steps?.length || 0,
    missingRefs: validateBot(saved).length,
    missingBefore,
    hasFpolisEster: savedChannelIds.includes("ZQxHlJ4vN7FoyPqG"),
    hasExtraMainChannel: savedChannelIds.includes("ZtXHk4I_xBAd46pH"),
    channelIds: savedChannelIds,
    backupPath,
    dryRun
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
