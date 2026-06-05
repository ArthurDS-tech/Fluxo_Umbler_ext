const DEFAULT_ORGANIZATION_ID = "ZQG4wFMHGHuTs59F";
const ADMIN_SESSION_KEY = "utalk_admin_session";

const UNITS = {
  main: {
    name: "Florianopolis",
    branch: "main",
    channels: new Set([
      "ZQxHaZ4vN7FoyHm7",
      "ZQxHphkRFwc7FJ2W",
      "ZZRSn5wSM4RTE7KJ",
      "ZZRSWJl_JmIQx0UE",
      "ZQxHJhkRFwc7E0bT",
      "ZwWSUqYuIZ8I3hxt"
    ]),
    members: new Set([
      "ZzUQwM9nj2l-H5hc",
      "ZaZlLHFmogpzC4xO",
      "ZoWIY_xoe7uoAAFQ",
      "Z26n85VVIK64B6I2",
      "ZaZkfnFmogpzCidw"
    ])
  },
  sj: {
    name: "Sao Jose",
    branch: "sj",
    channels: new Set(["ZaAgdeJmQyTgQhTs", "ZZRR85l_JmIQxo0T"]),
    members: new Set(["ZrzsX_BLm_zYqujY", "Zafi39QwFgY3PIe3"])
  },
  ph: {
    name: "Palhoca",
    branch: "ph",
    channels: new Set(["ZZRS4Jl_JmIQyDKA", "ZZRTMpwSM4RTFNHr"]),
    members: new Set(["ZuGqFp5N9i3HAKOn", "ZaWboNQwFgY3oMeT"])
  },
  other: {
    name: "Outras",
    branch: null,
    channels: new Set(),
    members: new Set()
  }
};

const MEMBER_NAMES = {
  ZzUQwM9nj2lH5hc: "BRUNA",
  "ZzUQwM9nj2l-H5hc": "BRUNA",
  ZaZlLHFmogpzC4xO: "ISA",
  ZoWIY_xoe7uoAAFQ: "JULIA",
  Z26n85VVIK64B6I2: "KENIA",
  ZaZkfnFmogpzCidw: "ANA",
  ZrzsX_BLm_zYqujY: "ADRIELLI",
  Zafi39QwFgY3PIe3: "MICHELI",
  ZuGqFp5N9i3HAKOn: "AMANDA",
  ZaWboNQwFgY3oMeT: "ROBSON"
};

const tokenInput = document.getElementById("input-token");
const orgInput = document.getElementById("input-org");
const unitFilter = document.getElementById("unit-filter");
const loadButton = document.getElementById("btn-load");
const refreshButton = document.getElementById("btn-refresh");
const message = document.getElementById("message");
const lastUpdate = document.getElementById("last-update");
const summary = document.getElementById("summary");
const queues = document.getElementById("queues");
const attendants = document.getElementById("attendants");
const waitingTable = document.getElementById("waiting-table");
const waitingCount = document.getElementById("waiting-count");

const state = {
  token: "",
  organizationId: DEFAULT_ORGANIZATION_ID,
  chats: [],
  queueData: {},
  statusData: null
};

loadSavedSession();
loadButton.addEventListener("click", loadDashboard);
refreshButton.addEventListener("click", loadDashboard);

async function loadDashboard() {
  state.token = tokenInput.value.trim();
  state.organizationId = orgInput.value.trim() || DEFAULT_ORGANIZATION_ID;

  if (!state.token) {
    setMessage("Informe o token Umbler para carregar os dados.", "error");
    return;
  }

  setBusy(true);
  setMessage("Carregando dados...");

  try {
    saveSession();
    const [statusData, queueData, chats] = await Promise.all([
      fetchStatusAll(),
      fetchQueues(),
      fetchOpenChats(state.token, state.organizationId)
    ]);

    state.statusData = statusData;
    state.queueData = queueData;
    state.chats = chats;
    renderDashboard();
    lastUpdate.textContent = `Atualizado ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    setMessage("Painel atualizado.", "ok");
  } catch (error) {
    setMessage(`Erro ao carregar painel. (${error.message})`, "error");
  } finally {
    setBusy(false);
  }
}

async function fetchStatusAll() {
  const response = await fetch("/api/status?all=1");
  return readJson(response);
}

async function fetchQueues() {
  const entries = await Promise.all(
    ["main", "sj", "ph"].map(async (branch) => {
      const response = await fetch(`/api/status?queue=1&branch=${encodeURIComponent(branch)}`);
      const data = await readJson(response);
      return [branch, data.queue];
    })
  );
  return Object.fromEntries(entries);
}

async function fetchOpenChats(token, organizationId) {
  const byId = new Map();
  const pageSize = 250;
  const maxPages = 8;

  for (let page = 0; page < maxPages; page += 1) {
    const data = await requestUtalk({
      token,
      organizationId,
      path: "/v1/chats/",
      query: { ChatState: "Open", Take: String(pageSize), Skip: String(page * pageSize) }
    });

    const items = normalizeItems(data);
    for (const chat of items) {
      if (chat?.id) byId.set(chat.id, chat);
    }

    if (items.length < pageSize) break;
  }

  return [...byId.values()];
}

async function requestUtalk(payload) {
  const response = await fetch("/api/utalk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return readJson(response);
}

async function readJson(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || response.status);
  }

  return data;
}

function renderDashboard() {
  const filter = unitFilter.value;
  const chats = state.chats.map(enrichChat);
  const filtered = filter === "all" ? chats : chats.filter((chat) => chat.unitKey === filter);
  const waiting = filtered.filter((chat) => chat.waiting);
  const open = filtered;
  const unread = filtered.reduce((sum, chat) => sum + Number(chat.totalUnread || 0), 0);
  const units = buildUnitStats(chats);
  const memberStats = buildMemberStats(waiting);

  renderSummary(open, waiting, unread, units);
  renderQueues(waiting);
  renderAttendants(memberStats);
  renderWaitingTable(waiting);
}

function enrichChat(chat) {
  const memberId = chat.organizationMember?.id || "";
  const unitKey = detectUnit(chat);
  return {
    id: chat.id,
    unitKey,
    unitName: UNITS[unitKey]?.name || "Outras",
    contactName: chat.contact?.name || "-",
    phone: chat.contact?.phoneNumber || "-",
    channelName: chat.channel?.name || "-",
    channelPhone: chat.channel?.phoneNumber || "",
    memberId,
    memberName: MEMBER_NAMES[memberId] || memberId || "-",
    waiting: chat.waiting === true,
    waitingSinceUTC: chat.waitingSinceUTC,
    totalUnread: chat.totalUnread || 0,
    lastMessageAt: chat.lastMessage?.eventAtUTC || chat.message?.eventAtUTC || chat.eventAtUTC || chat.createdAtUTC,
    lastMessage: chat.lastMessage?.content || chat.message?.content || "",
    tags: [...(chat.contact?.tags || []), ...(chat.tags || [])].map((tag) => tag.name).filter(Boolean)
  };
}

function detectUnit(chat) {
  const channelId = chat.channel?.id;
  const memberId = chat.organizationMember?.id;

  for (const key of ["sj", "ph", "main"]) {
    if (UNITS[key].channels.has(channelId) || UNITS[key].members.has(memberId)) return key;
  }

  return "other";
}

function buildUnitStats(chats) {
  const stats = {};
  for (const key of Object.keys(UNITS)) {
    stats[key] = { open: 0, waiting: 0, unread: 0 };
  }

  for (const chat of chats) {
    const unit = stats[chat.unitKey] || stats.other;
    unit.open += 1;
    if (chat.waiting) unit.waiting += 1;
    unit.unread += Number(chat.totalUnread || 0);
  }

  return stats;
}

function buildMemberStats(waiting) {
  const stats = {};
  for (const chat of waiting) {
    const key = chat.memberId || "sem_atendente";
    if (!stats[key]) {
      stats[key] = {
        memberId: key,
        name: chat.memberName || "Sem atendente",
        unitName: chat.unitName,
        waiting: 0,
        unread: 0,
        oldestWaiting: null
      };
    }
    stats[key].waiting += 1;
    stats[key].unread += Number(chat.totalUnread || 0);
    if (!stats[key].oldestWaiting || compareDates(chat.waitingSinceUTC, stats[key].oldestWaiting) < 0) {
      stats[key].oldestWaiting = chat.waitingSinceUTC;
    }
  }
  return stats;
}

function renderSummary(open, waiting, unread, units) {
  const cards = [
    ["Chats abertos", open.length],
    ["Em esperando", waiting.length],
    ["Nao lidas", unread],
    ["SJ esperando", units.sj.waiting],
    ["PH esperando", units.ph.waiting]
  ];

  summary.innerHTML = cards.map(([label, value]) => (
    `<article class="metric"><span>${escapeHtml(label)}</span><strong>${value}</strong></article>`
  )).join("");
}

function renderQueues(waiting) {
  const visibleBranches = unitFilter.value === "all"
    ? ["main", "sj", "ph"]
    : ["main", "sj", "ph"].filter((branch) => branch === unitFilter.value);

  queues.innerHTML = visibleBranches.map((branch) => {
    const queue = state.queueData[branch];
    if (!queue) return "";
    const waitingInBranch = waiting.filter((chat) => chat.unitKey === branch).length;
    const people = (queue.order || []).map((person) => {
      const next = person.memberId === queue.nextAvailableMemberId;
      const klass = next ? "pill next" : person.available ? "pill" : "pill offline";
      return `<span class="${klass}">${escapeHtml(person.name)}${next ? " · proxima" : ""}${person.available ? "" : " · indisponivel"}</span>`;
    }).join("");
    return `
      <article class="queue-card">
        <div class="queue-head">
          <strong>${escapeHtml(UNITS[branch].name)}</strong>
          <span class="muted">${waitingInBranch} esperando</span>
        </div>
        <div class="attendant-meta">
          <span>Proxima: ${escapeHtml(queue.nextAvailableMemberName || "-")}</span>
          <span>Ultima: ${escapeHtml(queue.lastAssignedMemberName || "-")}</span>
        </div>
        <div class="queue-people">${people}</div>
      </article>
    `;
  }).join("") || '<p class="empty">Nenhuma fila para este filtro.</p>';
}

function renderAttendants(memberStats) {
  const statuses = state.statusData?.statuses || {};
  const rows = Object.values(memberStats).sort((a, b) => b.waiting - a.waiting || a.name.localeCompare(b.name));

  if (!rows.length) {
    attendants.innerHTML = '<p class="empty">Nenhum cliente em esperando para este filtro.</p>';
    return;
  }

  attendants.innerHTML = rows.map((row) => {
    const available = statuses[row.memberId] !== false;
    return `
      <article class="attendant-card">
        <div class="attendant-row">
          <strong>${escapeHtml(row.name)}</strong>
          <span class="${available ? "pill next" : "pill offline"}">${available ? "disponivel" : "indisponivel"}</span>
        </div>
        <div class="attendant-meta">
          <span>${escapeHtml(row.unitName)}</span>
          <span>${row.waiting} esperando</span>
          <span>${row.unread} nao lidas</span>
          <span>mais antigo: ${formatAge(row.oldestWaiting)}</span>
        </div>
      </article>
    `;
  }).join("");
}

function renderWaitingTable(waiting) {
  waitingCount.textContent = `${waiting.length} cliente(s)`;

  if (!waiting.length) {
    waitingTable.innerHTML = '<tr><td colspan="7" class="empty">Nenhum cliente em esperando neste filtro.</td></tr>';
    return;
  }

  waitingTable.innerHTML = waiting
    .sort((a, b) => compareDates(a.waitingSinceUTC || a.lastMessageAt, b.waitingSinceUTC || b.lastMessageAt))
    .map((chat) => `
      <tr>
        <td><strong>${escapeHtml(chat.contactName)}</strong><span class="muted">${escapeHtml(chat.phone)}</span></td>
        <td>${escapeHtml(chat.unitName)}</td>
        <td>${escapeHtml(chat.memberName)}</td>
        <td><strong>${escapeHtml(chat.channelName)}</strong><span class="muted">${escapeHtml(chat.channelPhone)}</span></td>
        <td>${formatAge(chat.waitingSinceUTC)}</td>
        <td><strong>${formatDate(chat.lastMessageAt)}</strong><span class="muted">${escapeHtml(trimText(chat.lastMessage, 80))}</span></td>
        <td>${renderTags(chat.tags)}</td>
      </tr>
    `).join("");
}

function renderTags(tags) {
  const unique = [...new Set(tags)].slice(0, 5);
  return unique.length ? unique.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("") : "-";
}

function normalizeItems(data) {
  if (Array.isArray(data)) return data;
  return data?.items || data?.chats || data?.data || [];
}

function compareDates(a, b) {
  return new Date(a || 0).getTime() - new Date(b || 0).getTime();
}

function formatAge(value) {
  if (!value) return "-";
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "-";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}min`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function trimText(value, size) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > size ? `${text.slice(0, size - 1)}...` : text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setBusy(busy) {
  loadButton.disabled = busy;
  refreshButton.disabled = busy;
}

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function saveSession() {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
    token: state.token,
    organizationId: state.organizationId
  }));
}

function loadSavedSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || "{}");
    tokenInput.value = saved.token || "";
    orgInput.value = saved.organizationId || DEFAULT_ORGANIZATION_ID;
  } catch {
    orgInput.value = DEFAULT_ORGANIZATION_ID;
  }
}
