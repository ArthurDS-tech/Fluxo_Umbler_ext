const fs = require("fs");
const path = require("path");

const TOKEN = process.env.UMBLER_API_TOKEN;
const ORGANIZATION_ID = process.env.UMBLER_ORGANIZATION_ID || "ZQG4wFMHGHuTs59F";
const API_BASE = process.env.UMBLER_API_BASE_URL || "https://app-utalk.umbler.com/api";

const FLOWS = {
  main: {
    id: "ahWgp29Q4NlgpyeU",
    label: "Florianopolis",
    queue: "Bruna -> Isa -> Julia -> Kenia -> Ana",
    ownerRule: "Cristiane, Ester, Ana, Kenia, Julia, Isa e Bruna",
    patio: "Patio vai para Isa. Se Isa nao puder receber, fica em esperando dela."
  },
  sj: {
    id: "aiBQZyxNLsXpDDwS",
    label: "Sao Jose",
    queue: "Adrielli -> Micheli.M",
    ownerRule: "Evylin, Adrielli e Micheli.M",
    patio: "Servico de veiculo preso segue pela fila da unidade, conforme regra deste fluxo."
  },
  ph: {
    id: "aiAw0vJQCsVttEzC",
    label: "Palhoca",
    queue: "Amanda -> Robson",
    ownerRule: "Amanda e Robson",
    patio: "Servico de veiculo preso segue pela fila da unidade, conforme regra deste fluxo."
  }
};

const NOTES = [
  {
    id: "ZLAAAAAAAAAAAAAB",
    x: 250,
    y: -350,
    title: "ENTRADA DO CLIENTE",
    text: "Aqui o fluxo identifica por qual canal o cliente chegou. Cada unidade deve seguir somente a sua propria fila."
  },
  {
    id: "ZLAAAAAAAAAAAAAC",
    x: 1450,
    y: 4200,
    title: "CLIENTE PARCEIRO",
    text: "Se o contato tiver etiqueta Parceiro, o fluxo nao usa etiqueta antiga de atendente para decidir. Ele registra uma nota interna e segue pela fila da unidade."
  },
  {
    id: "ZLAAAAAAAAAAAAAD",
    x: 2250,
    y: 4200,
    title: "CLIENTE COM ATENDENTE MARCADA",
    text: "Se existir etiqueta de atendente valida para esta unidade, o fluxo tenta voltar para essa atendente. Se ela nao puder receber, segue para a proxima regra sem parar o cliente."
  },
  {
    id: "ZLAAAAAAAAAAAAAE",
    x: 3550,
    y: 4200,
    title: "FILA DA UNIDADE",
    text: "A fila usa a ordem definida no Railway. Quando uma atendente recebe, a proxima da lista passa a ser a vez seguinte."
  },
  {
    id: "ZLAAAAAAAAAAAAAF",
    x: 900,
    y: 5200,
    title: "VEICULO APREENDIDO OU PATIO",
    text: "Esta area trata o caminho de veiculo preso. A regra especial deve ser mantida, porque esse atendimento nao pode cair em rota errada."
  },
  {
    id: "ZLAAAAAAAAAAAAAG",
    x: 4850,
    y: 5200,
    title: "COLETA DO SERVICO",
    text: "Depois que o cliente escolhe o servico, o fluxo coleta as informacoes necessarias. Ao terminar, deve colocar em esperando e encerrar o caminho."
  },
  {
    id: "ZLAAAAAAAAAAAAAH",
    x: 6350,
    y: 6500,
    title: "ESPERANDO",
    text: "Quando chegar aqui, o atendimento deve ficar parado para a responsavel atual. Nao deve voltar para o inicio da fila depois de entrar em esperando."
  },
  {
    id: "ZLAAAAAAAAAAAAAI",
    x: 7800,
    y: 2200,
    title: "FORA DO HORARIO",
    text: "Fora do horario, o fluxo deve orientar o cliente e manter o atendimento em um ponto seguro para a equipe continuar depois."
  }
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

function makeComment(note, config) {
  const dynamicText = note.text
    .replace("a sua propria fila", `a fila ${config.label}: ${config.queue}`)
    .replace("etiqueta de atendente valida para esta unidade", `etiqueta de atendente valida para ${config.label}: ${config.ownerRule}`)
    .replace("A regra especial deve ser mantida, porque esse atendimento nao pode cair em rota errada.", config.patio);

  return {
    _t: "CommentBlockModel",
    comment: `${note.title}\n\n${dynamicText}`,
    position: { x: note.x, y: note.y },
    id: note.id
  };
}

function applyNotes(bot, config) {
  const steps = bot.steps || [];
  const byId = new Map(steps.map((step) => [step.id, step]));

  for (const note of NOTES) {
    const comment = makeComment(note, config);
    const existing = byId.get(note.id);
    if (existing) Object.assign(existing, comment);
    else steps.push(comment);
  }

  bot.steps = steps;
  bot.snapshotTitle = `Documentacao visual ${config.label} - ${new Date().toISOString()}`;
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
}

async function main() {
  requireEnv();
  const dryRun = process.argv.includes("--dry-run");
  const backupDir = path.join(__dirname, "..", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const results = [];

  for (const [flowKey, config] of Object.entries(FLOWS)) {
    const bot = await getBot(config.id);
    const backupPath = path.join(backupDir, `flow-${config.id}-before-comment-notes-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(bot, null, 2));

    const updated = applyNotes(JSON.parse(JSON.stringify(bot)), config);
    const missing = validateBot(updated);
    if (missing.length) throw new Error(`Fluxo ${config.id} tem referencias quebradas: ${JSON.stringify(missing.slice(0, 10))}`);

    if (!dryRun) await saveBot(updated);
    const saved = dryRun ? updated : await getBot(config.id);
    const noteCount = (saved.steps || []).filter((step) => NOTES.some((note) => note.id === step.id)).length;

    results.push({
      flowKey,
      id: config.id,
      title: saved.title,
      active: saved.active,
      steps: saved.steps?.length || 0,
      commentNotes: noteCount,
      missingRefs: validateBot(saved).length,
      backupPath
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
