const WAITING_KEY = "utalk_waiting_chats";
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const token = tokenInput.value.trim();
  const organizationId = orgInput.value.trim();

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
    state.available = true;
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
  localStorage.removeItem("utalk_session");
  form.hidden = false;
  statusSection.hidden = true;
  logoutButton.hidden = true;
  tokenInput.value = "";
  orgInput.value = "";
  setMessage("");
});

availableButton.addEventListener("click", () => setAvailability(true));
unavailableButton.addEventListener("click", () => setAvailability(false));

async function setAvailability(available) {
  setBusy(true);
  setMessage("Atualizando status...");

  try {
    if (!available) {
      const chats = await fetchOpenChats();
      const results = await Promise.allSettled(
        chats.map((chat) => updateChatWaiting(chat.id, true))
      );
      state.waitingChats = chats
        .filter((_, index) => results[index].status === "fulfilled")
        .map((chat) => chat.id);
      state.available = false;
      saveSession();
      updateStatusUi();
      setMessage(
        `Indisponivel. ${state.waitingChats.length} chat(s) colocados em espera.`,
        "ok"
      );
      return;
    }

    if (state.waitingChats.length > 0) {
      await Promise.allSettled(
        state.waitingChats.map((chatId) => updateChatWaiting(chatId, false))
      );
    }

    state.available = true;
    state.waitingChats = [];
    saveSession();
    updateStatusUi();
    setMessage("Disponivel. Chats restaurados.", "ok");
  } catch (error) {
    setMessage(`Erro ao atualizar status. (${error.message})`, "error");
  } finally {
    setBusy(false);
  }
}

async function fetchOpenChats() {
  const data = await apiRequest({
    token: state.token,
    path: "/v1/chats/",
    organizationId: state.organizationId,
    query: {
      ChatState: "Open",
      "Members.Rule": "Any",
      "Members.Values": state.memberId,
      Take: "100"
    }
  });

  return Array.isArray(data) ? data : data.items || [];
}

function updateChatWaiting(chatId, waiting) {
  return apiRequest({
    token: state.token,
    path: `/v1/chats/${chatId}/`,
    organizationId: state.organizationId,
    method: "PUT",
    body: { waiting }
  });
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
  const saved = localStorage.getItem("utalk_session");
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

    if (state.token && state.organizationId && state.memberId) {
      showStatus();
    }
  } catch {
    localStorage.removeItem("utalk_session");
  }
}

function saveSession() {
  localStorage.setItem(
    "utalk_session",
    JSON.stringify({
      token: state.token,
      organizationId: state.organizationId,
      memberId: state.memberId,
      memberName: state.memberName,
      available: state.available,
      [WAITING_KEY]: state.waitingChats
    })
  );
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
