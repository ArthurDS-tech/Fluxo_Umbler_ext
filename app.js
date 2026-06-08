const WAITING_KEY = "utalk_waiting_chats";
const SESSION_KEY = "utalk_session";
const STATUS_API = "/api/status";
const DEFAULT_ORGANIZATION_ID = "ZQG4wFMHGHuTs59F";

const state = {
  token: "",
  organizationId: "",
  memberId: "",
  memberName: "",
  available: true,
  waitingChats: []
};

const form = document.getElementById("credentials-form");
const tokenInput = document.getElementById("input-token");
const orgInput = document.getElementById("input-org");
const statusSection = document.getElementById("status-section");
const logoutButton = document.getElementById("btn-logout");
const availableButton = document.getElementById("btn-disponivel");
const unavailableButton = document.getElementById("btn-indisponivel");
const memberName = document.getElementById("member-name");
const statusBadge = document.getElementById("status-badge");
const statusText = document.getElementById("status-text");
const hintText = document.getElementById("hint-text");
const message = document.getElementById("message");

loadSavedSession();
if (!orgInput.value) {
  orgInput.value = DEFAULT_ORGANIZATION_ID;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const token = tokenInput.value.trim();
  const organizationId = orgInput.value.trim() || DEFAULT_ORGANIZATION_ID;

  if (!token || !organizationId) {
    setMessage("Preencha o token e o ID da organizacao.", "error");
    return;
  }

  setBusy(true);
  setMessage("Verificando credenciais...");

  try {
    const me = await apiRequest({ token, path: "/v1/members/me/" });
    state.token = token;
    state.organizationId = organizationId;
    state.memberId = me.id;
    state.memberName = me.displayName || me.emailAddress || "Atendente";
    state.available = await fetchRemoteAvailability(me.id);
    state.waitingChats = [];
    saveSession();
    showStatus();
    setMessage("Credenciais salvas. Voce ja pode alterar o status.", "ok");
  } catch (error) {
    setMessage(`Token invalido ou erro de conexao. (${error.message})`, "error");
  } finally {
    setBusy(false);
  }
});

logoutButton.addEventListener("click", () => {
  localStorage.removeItem(SESSION_KEY);
  form.hidden = false;
  statusSection.hidden = true;
  logoutButton.hidden = true;
  tokenInput.value = "";
  orgInput.value = DEFAULT_ORGANIZATION_ID;
  setMessage("");
});

availableButton.addEventListener("click", () => setAvailability(true));
unavailableButton.addEventListener("click", () => setAvailability(false));

async function setAvailability(available) {
  setBusy(true);
  setMessage("Atualizando status...");

  try {
    if (!available) {
      await updateRemoteAvailability(false);
      state.available = false;
      state.waitingChats = [];
      saveSession();
      updateStatusUi();
      setMessage(
        "Indisponivel. Seus chats atuais continuam exatamente onde estao. Novos contatos serao redirecionados.",
        "ok"
      );
      return;
    }

    state.available = true;
    state.waitingChats = [];
    await updateRemoteAvailability(true);
    saveSession();
    updateStatusUi();
    setMessage("Disponivel. Fila liberada. Chats que estavam em espera continuam em espera.", "ok");
  } catch (error) {
    setMessage(`Erro ao atualizar status. (${error.message})`, "error");
  } finally {
    setBusy(false);
  }
}

async function updateRemoteAvailability(available) {
  if (!state.memberId) {
    throw new Error("atendente nao identificada");
  }

  const response = await fetch(STATUS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      memberId: state.memberId,
      available
    })
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || response.status);
  }

  return data;
}

async function fetchRemoteAvailability(memberId = state.memberId) {
  if (!memberId) return false;

  const response = await fetch(`${STATUS_API}?memberId=${encodeURIComponent(memberId)}`);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || response.status);
  }

  return data?.available === true;
}

async function apiRequest(payload) {
  const response = await fetch("/api/utalk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || response.status);
  }

  return data;
}

function loadSavedSession() {
  const saved = localStorage.getItem(SESSION_KEY);
  if (!saved) return;

  try {
    const data = JSON.parse(saved);
    Object.assign(state, {
      token: data.token || "",
      organizationId: data.organizationId || "",
      memberId: data.memberId || "",
      memberName: data.memberName || "",
      available: data.available !== false,
      waitingChats: Array.isArray(data[WAITING_KEY]) ? data[WAITING_KEY] : []
    });

    if (hasSavedSession()) {
      showStatus();
      refreshRemoteAvailability();
    } else {
      tokenInput.value = state.token;
      orgInput.value = state.organizationId || DEFAULT_ORGANIZATION_ID;
    }
  } catch {
    localStorage.removeItem(SESSION_KEY);
    orgInput.value = DEFAULT_ORGANIZATION_ID;
  }
}

function saveSession() {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      version: 1,
      token: state.token,
      organizationId: state.organizationId,
      memberId: state.memberId,
      memberName: state.memberName,
      available: state.available,
      [WAITING_KEY]: state.waitingChats,
      savedAt: new Date().toISOString()
    })
  );
}

function hasSavedSession() {
  return Boolean(state.token && state.organizationId && state.memberId);
}

function showStatus() {
  form.hidden = true;
  statusSection.hidden = false;
  logoutButton.hidden = false;
  memberName.textContent = state.memberName || "Atendente";
  updateStatusUi();
}

function updateStatusUi() {
  statusBadge.className = state.available ? "badge online" : "badge offline";
  statusText.textContent = state.available ? "Disponivel" : "Indisponivel";
  hintText.textContent = state.available
    ? "Voce esta recebendo novos atendimentos normalmente."
    : "Seus chats atuais continuam com voce. Novos contatos serao redirecionados.";
}

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function setBusy(isBusy) {
  document.querySelectorAll("button").forEach((button) => {
    button.disabled = isBusy;
  });
}

async function refreshRemoteAvailability() {
  try {
    state.available = await fetchRemoteAvailability();
    saveSession();
    updateStatusUi();
  } catch (error) {
    setMessage(`Nao foi possivel confirmar o status atual. (${error.message})`, "error");
  }
}
