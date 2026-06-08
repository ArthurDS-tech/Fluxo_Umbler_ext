const DEFAULT_ORGANIZATION_ID = "ZQG4wFMHGHuTs59F";
const LOG_SESSION_KEY = "utalk_admin_logs_session";

const MEMBER_NAMES = {
  "ZzUQwM9nj2l-H5hc": "BRUNA",
  ZaZlLHFmogpzC4xO: "ISA",
  ZoWIY_xoe7uoAAFQ: "JULIA",
  Z26n85VVIK64B6I2: "KENIA",
  ZaZkfnFmogpzCidw: "ANA",
  ZrzsX_BLm_zYqujY: "ADRIELLI",
  Z5e_UnhziN5VdCCp: "MICHELI MAIA",
  ZuGqFp5N9i3HAKOn: "AMANDA",
  ZaWboNQwFgY3oMeT: "ROBSON",
  ZjjGI2sLFms4kT6b: "EVYLIN",
  "ZQxoyBkRFwc7X-Vk": "CRISTIANE",
  ZyJUBxlZDTR81qdF: "ESTER"
};

const UNIT_BY_CHANNEL = {
  ZQxHaZ4vN7FoyHm7: "Florianopolis",
  ZQxHphkRFwc7FJ2W: "Florianopolis",
  ZZRSn5wSM4RTE7KJ: "Florianopolis",
  ZZRSWJl_JmIQx0UE: "Florianopolis",
  ZQxHJhkRFwc7E0bT: "Florianopolis",
  ZwWSUqYuIZ8I3hxt: "Florianopolis",
  ZaAgdeJmQyTgQhTs: "Sao Jose",
  ZZRR85l_JmIQxo0T: "Sao Jose",
  ZZRSipl_JmIQx5qg: "Sao Jose",
  Zj4crV8ECNOxXLpX: "Sao Jose",
  ZZRS4Jl_JmIQyDKA: "Palhoca",
  ZZRTMpwSM4RTFNHr: "Palhoca",
  ZZRSyJl_JmIQyAWW: "Palhoca",
  "aJtKOl4daaS-nrAB": "Palhoca"
};

const tokenInput = document.getElementById("input-token");
const orgInput = document.getElementById("input-org");
const chatInput = document.getElementById("input-chat");
const searchButton = document.getElementById("btn-search");
const recentButton = document.getElementById("btn-recent");
const refreshButton = document.getElementById("btn-refresh");
const recentFilterInput = document.getElementById("input-recent-filter");
const message = document.getElementById("message");
const recentCount = document.getElementById("recent-count");
const recentList = document.getElementById("recent-list");
const chatStatus = document.getElementById("chat-status");
const chatSummary = document.getElementById("chat-summary");
const timeline = document.getElementById("timeline");
const copyButton = document.getElementById("btn-copy-log");
const printButton = document.getElementById("btn-print-log");

const state = {
  token: "",
  organizationId: DEFAULT_ORGANIZATION_ID,
  recentChats: [],
  recentFilter: "",
  selectedChat: null,
  selectedEvents: []
};

loadSavedSession();

searchButton.addEventListener("click", () => searchChat());
recentButton.addEventListener("click", () => loadRecentChats());
refreshButton.addEventListener("click", () => {
  if (state.selectedChat?.id) {
    chatInput.value = state.selectedChat.id;
    searchChat();
    return;
  }
  loadRecentChats();
});
copyButton.addEventListener("click", copyCurrentSummary);
printButton.addEventListener("click", () => window.print());
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") searchChat();
});
recentFilterInput.addEventListener("input", () => {
  state.recentFilter = recentFilterInput.value;
  renderRecent(state.recentChats);
});

async function searchChat() {
  const chatId = extractChatId(chatInput.value);
  if (!chatId) {
    setMessage("Cole o link ou codigo do chat.", "error");
    return;
  }

  if (!readCredentials()) return;
  setBusy(true);
  setMessage("Buscando historico do atendimento...");

  try {
    const chat = await fetchChat(chatId);
    renderChat(chat);
    saveSession();
    setMessage("Historico carregado.", "ok");
  } catch (error) {
    setMessage(`Nao consegui carregar esse chat. ${friendlyError(error)}`, "error");
  } finally {
    setBusy(false);
  }
}

async function loadRecentChats() {
  if (!readCredentials()) return;
  setBusy(true);
  setMessage("Carregando atendimentos recentes...");

  try {
    const chats = await fetchRecentChats();
    state.recentChats = chats;
    renderRecent(chats);
    saveSession();
    setMessage("Recentes carregados.", "ok");
  } catch (error) {
    setMessage(`Nao consegui carregar os recentes. ${friendlyError(error)}`, "error");
  } finally {
    setBusy(false);
  }
}

async function fetchChat(chatId) {
  const data = await requestUtalk({
    path: `/v1/chats/${encodeURIComponent(chatId)}/`,
    query: { includeMessages: "1" }
  });
  return data.chat || data;
}

async function fetchRecentChats() {
  const data = await requestUtalk({
    path: "/v1/chats/",
    query: { ChatState: "Open", Take: "80", Skip: "0" }
  });
  return normalizeItems(data)
    .sort((a, b) => dateValue(b.lastMessage?.eventAtUTC || b.eventAtUTC || b.createdAtUTC) - dateValue(a.lastMessage?.eventAtUTC || a.eventAtUTC || a.createdAtUTC))
    .slice(0, 60);
}

async function requestUtalk(payload) {
  const response = await fetch("/api/utalk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: state.token,
      organizationId: state.organizationId,
      ...payload
    })
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.error || data?.detail || response.status);
  return data;
}

function renderRecent(chats) {
  const filtered = filterRecent(chats);
  recentCount.textContent = `${filtered.length} encontrados`;
  if (!filtered.length) {
    recentList.innerHTML = '<p class="empty">Nenhum atendimento recente encontrado.</p>';
    return;
  }

  recentList.innerHTML = filtered.map((chat) => {
    const selected = chat.id === state.selectedChat?.id ? " active" : "";
    return `
      <button class="recent-item${selected}" type="button" data-chat-id="${escapeHtml(chat.id)}">
        <strong>${escapeHtml(contactName(chat))}</strong>
        <span class="recent-meta">${escapeHtml(unitName(chat))} · ${escapeHtml(chat.channel?.name || "-")}</span>
        <span class="recent-meta">${escapeHtml(responsibleName(chat))} · ${escapeHtml(formatDate(chat.lastMessage?.eventAtUTC || chat.eventAtUTC || chat.createdAtUTC))}</span>
        <span class="recent-meta">${escapeHtml(trimText(chat.lastMessage?.content || "", 90))}</span>
      </button>
    `;
  }).join("");

  recentList.querySelectorAll("[data-chat-id]").forEach((button) => {
    button.addEventListener("click", () => {
      chatInput.value = button.dataset.chatId;
      searchChat();
    });
  });
}

function renderChat(chat) {
  state.selectedChat = chat;
  const events = buildTimeline(chat);
  state.selectedEvents = events;

  chatStatus.textContent = chat.waiting ? "Em esperando" : chat.open ? "Aberto" : "Finalizado";
  chatSummary.innerHTML = renderSummaryCards(chat);
  timeline.innerHTML = events.length
    ? events.map(renderEvent).join("")
    : '<p class="empty">Nenhum passo registrado para este atendimento.</p>';
  copyButton.disabled = false;
  printButton.disabled = false;
  renderRecent(state.recentChats);
}

function renderSummaryCards(chat) {
  const cards = [
    ["Cliente", contactName(chat)],
    ["Telefone", chat.contact?.phoneNumber || "-"],
    ["Unidade", unitName(chat)],
    ["Responsavel atual", responsibleName(chat)],
    ["Canal", chat.channel?.name || "-"],
    ["Situacao", chat.waiting ? "Em esperando" : chat.open ? "Aberto" : "Finalizado"],
    ["Criado em", formatDate(chat.createdAtUTC)],
    ["Ultima atividade", formatDate(chat.lastMessage?.eventAtUTC || chat.eventAtUTC)]
  ];

  return cards.map(([label, value]) => `
    <article class="log-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `).join("");
}

function buildTimeline(chat) {
  const events = [];

  addEvent(events, {
    at: chat.createdAtUTC,
    title: "Atendimento aberto",
    text: `${contactName(chat)} entrou pelo canal ${chat.channel?.name || "-"}.`,
    kind: "success",
    details: [
      ["Unidade", unitName(chat)],
      ["Canal", chat.channel?.name || "-"],
      ["Telefone", chat.contact?.phoneNumber || "-"]
    ]
  });

  for (const tag of chat.contact?.tags || []) {
    addEvent(events, {
      at: chat.createdAtUTC,
      title: "Etiqueta no contato",
      text: tag.name || "Etiqueta registrada",
      kind: "soft"
    });
  }

  for (const tag of chat.tags || []) {
    addEvent(events, {
      at: chat.createdAtUTC,
      title: "Etiqueta na conversa",
      text: tag.name || "Etiqueta registrada",
      kind: "soft"
    });
  }

  for (const item of chat.bots || []) {
    addEvent(events, {
      at: item.createdAt,
      title: "Bot executado",
      text: botSummary(item),
      kind: item.status === "Complete" ? "success" : "warn"
    });
  }

  for (const history of chat.sectorHistory || []) {
    addEvent(events, {
      at: history.enteredAt,
      title: "Setor definido",
      text: `O atendimento ficou no setor ${history.name || chat.sector?.name || "responsavel"}.`,
      kind: "soft"
    });
  }

  for (const history of chat.organizationMemberHistory || []) {
    addEvent(events, {
      at: history.enteredAt,
      title: "Transferencia",
      text: `O atendimento foi direcionado para ${memberName(history.memberId || history.organizationMemberId || history.member?.id, history.member?.name || history.organizationMember?.name)}.${transferReason(history)}`,
      kind: "success"
    });
  }

  const messages = normalizeMessages(chat);
  for (const msg of messages) {
    addEvent(events, messageEvent(msg));
  }

  if (chat.waiting) {
    addEvent(events, {
      at: chat.waitingSinceUTC || chat.eventAtUTC,
      title: "Entrou em esperando",
      text: `O atendimento ficou em esperando para ${responsibleName(chat)}.`,
      kind: "warn"
    });
  }

  if (chat.lastMessage && !messages.some((msg) => msg.id === chat.lastMessage.id)) {
    addEvent(events, messageEvent(chat.lastMessage));
  }

  return events
    .filter((event) => event.at || event.title)
    .sort((a, b) => dateValue(a.at) - dateValue(b.at));
}

function messageEvent(msg) {
  const fromClient = msg.source === "Contact" || !msg.sentByOrganizationMember;
  const privateNote = msg.isPrivate === true;
  const from = privateNote
    ? "Nota interna"
    : fromClient
      ? "Mensagem do cliente"
      : `Mensagem de ${memberName(msg.sentByOrganizationMember?.id)}`;

  return {
    at: msg.eventAtUTC || msg.createdAtUTC,
    title: from,
    text: msg.content || msg.message || msg.messageType || "Mensagem registrada",
    kind: privateNote ? "soft" : fromClient ? "warn" : "success"
  };
}

function addEvent(events, event) {
  if (!event) return;
  events.push(event);
}

function renderEvent(event) {
  const details = event.details?.length
    ? `<div class="log-grid">${event.details.map(([label, value]) => `
        <div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>
      `).join("")}</div>`
    : "";

  return `
    <article class="timeline-item ${escapeHtml(event.kind || "")}">
      <span class="timeline-meta">${escapeHtml(formatDate(event.at))}</span>
      <strong>${escapeHtml(event.title)}</strong>
      <div class="timeline-text">${escapeHtml(event.text || "-")}</div>
      ${details}
    </article>
  `;
}

async function copyCurrentSummary() {
  if (!state.selectedChat) return;
  const chat = state.selectedChat;
  const lines = [
    "Historico do atendimento",
    `Cliente: ${contactName(chat)}`,
    `Telefone: ${chat.contact?.phoneNumber || "-"}`,
    `Unidade: ${unitName(chat)}`,
    `Responsavel atual: ${responsibleName(chat)}`,
    `Situacao: ${chat.waiting ? "Em esperando" : chat.open ? "Aberto" : "Finalizado"}`,
    "",
    ...state.selectedEvents.map((event) => `${formatDate(event.at)} - ${event.title}: ${event.text || "-"}`)
  ];

  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    setMessage("Resumo copiado.", "ok");
  } catch {
    setMessage("Nao foi possivel copiar automaticamente.", "error");
  }
}

function readCredentials() {
  state.token = tokenInput.value.trim();
  state.organizationId = orgInput.value.trim() || DEFAULT_ORGANIZATION_ID;

  if (!state.token) {
    setMessage("Informe o token Umbler para carregar os logs.", "error");
    return false;
  }

  return true;
}

function extractChatId(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/\/chats\/([^/?#\s]+)/i);
  return (match?.[1] || text).trim();
}

function botSummary(item) {
  const status = item.status === "Complete" ? "concluido" : "em andamento";
  const reason = item.stopReason === "ReachedFlowEnd" ? "chegou ao fim do caminho previsto" : "foi interrompido ou pausado";
  return `O bot ${item.botTitle || "do atendimento"} foi ${status} e ${reason}.`;
}

function transferReason(history) {
  const reason = history.transferredBy?.reason;
  if (reason === "ChatBot") return " A transferencia foi feita automaticamente pelo fluxo.";
  if (reason === "ChatEdited") return " A transferencia foi feita manualmente.";
  return "";
}

function contactName(chat) {
  return chat.contact?.name || chat.contact?.phoneNumber || "-";
}

function responsibleName(chat) {
  return memberName(chat.organizationMember?.id || chat.memberId || chat.member?.id, chat.organizationMember?.name || chat.member?.name);
}

function memberName(id, fallbackName = "") {
  if (fallbackName) return fallbackName;
  if (!id) return "Sem responsavel";
  return MEMBER_NAMES[id] || "Atendente";
}

function filterRecent(chats) {
  const term = normalizeText(state.recentFilter);
  if (!term) return chats;
  return chats.filter((chat) => {
    const text = [
      contactName(chat),
      chat.contact?.phoneNumber,
      unitName(chat),
      responsibleName(chat),
      chat.channel?.name,
      chat.lastMessage?.content
    ].map(normalizeText).join(" ");
    return text.includes(term);
  });
}

function normalizeMessages(chat) {
  const messages = chat.messages || chat.latestMessages || [];
  return Array.isArray(messages) ? messages : [];
}

function unitName(chat) {
  const byId = UNIT_BY_CHANNEL[chat.channel?.id];
  if (byId) return byId;
  const name = normalizeText(chat.channel?.name || "");
  if (name.includes("sao jose") || name.includes("sj ")) return "Sao Jose";
  if (name.includes("palhoca") || name.includes("ph ")) return "Palhoca";
  if (name.includes("florianopolis") || name.includes("fpolis")) return "Florianopolis";
  return "Outras";
}

function normalizeItems(data) {
  if (Array.isArray(data)) return data;
  return data?.items || data?.chats || data?.data || [];
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function dateValue(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
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
  return text.length > size ? `${text.slice(0, size - 1)}...` : text || "-";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function friendlyError(error) {
  const text = String(error?.message || error || "");
  if (text.includes("401") || text.toLowerCase().includes("unauthorized")) return "Confira se o token esta correto.";
  if (text.includes("404")) return "Nao encontrei esse chat.";
  return text;
}

function setBusy(busy) {
  [searchButton, recentButton, refreshButton].forEach((button) => {
    button.disabled = busy;
  });
}

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function saveSession() {
  localStorage.setItem(LOG_SESSION_KEY, JSON.stringify({
    token: state.token,
    organizationId: state.organizationId
  }));
}

function loadSavedSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOG_SESSION_KEY) || "{}");
    tokenInput.value = saved.token || "";
    orgInput.value = saved.organizationId || DEFAULT_ORGANIZATION_ID;
  } catch {
    orgInput.value = DEFAULT_ORGANIZATION_ID;
  }
}
