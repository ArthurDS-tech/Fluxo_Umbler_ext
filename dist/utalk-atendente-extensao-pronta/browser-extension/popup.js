const API = "https://app-utalk.umbler.com/api";
const STATUS_API = "https://utalk-status-webhook-production.up.railway.app/status";
const STATUS_API_KEY = "utalk-status-2026-railway";
const DEFAULT_ORGANIZATION_ID = "ZQG4wFMHGHuTs59F";
const SESSION_KEYS = [
  "utalk_token",
  "utalk_org",
  "utalk_member_id",
  "utalk_name",
  "utalk_available",
  "utalk_waiting_chats",
  "utalk_saved_at"
];

// ── Elementos ──────────────────────────────────────────────
const elLoading     = document.getElementById("loading");
const elLogin       = document.getElementById("section-login");
const elMain        = document.getElementById("section-main");
const elMemberName  = document.getElementById("member-name");
const elStatusBadge = document.getElementById("status-badge");
const elStatusText  = document.getElementById("status-text");
const elHint        = document.getElementById("hint-text");

// ── Guarda chats que foram colocados em espera pela extensão
// para poder restaurá-los ao voltar a disponível
const WAITING_KEY = "utalk_waiting_chats";

// ── Init ───────────────────────────────────────────────────
if (typeof chrome === "undefined" || !chrome.storage) {
  elLoading.textContent = "Abra pelo ícone da extensão no navegador.";
  throw new Error("chrome.storage indisponível");
}

chrome.storage.local.get(
  SESSION_KEYS,
  (data) => {
    if (hasSavedSession(data)) {
      const available = data.utalk_available !== false;
      showMain(data.utalk_name || "Atendente");
      updateBadge(available);
      refreshRemoteAvailability(data.utalk_member_id);
    } else {
      document.getElementById("input-token").value = data.utalk_token || "";
      document.getElementById("input-org").value = data.utalk_org || DEFAULT_ORGANIZATION_ID;
      show(elLogin);
    }
  }
);

// ── Login ──────────────────────────────────────────────────
document.getElementById("btn-login").addEventListener("click", async () => {
  const token = document.getElementById("input-token").value.trim();
  const org   = document.getElementById("input-org").value.trim() || DEFAULT_ORGANIZATION_ID;

  if (!token || !org) {
    setMsg("Preencha o token e o ID da organização.", "error");
    return;
  }

  setMsg("Verificando...");
  disableButtons(true);

  try {
    const me = await apiGet("/v1/members/me/", token, null);
    const name = me.displayName || me.emailAddress || "Atendente";

    const available = await fetchRemoteAvailability(me.id);

    chrome.storage.local.set({
      utalk_token: token,
      utalk_org: org,
      utalk_member_id: me.id,
      utalk_name: name,
      utalk_available: available,
      utalk_waiting_chats: [],
      utalk_saved_at: new Date().toISOString(),
    });

    showMain(name);
    updateBadge(available);
    setMsg("");
  } catch (e) {
    setMsg(`Token inválido ou erro de conexão. (${e.message})`, "error");
  } finally {
    disableButtons(false);
  }
});

// ── Logout ─────────────────────────────────────────────────
document.getElementById("btn-logout").addEventListener("click", () => {
  chrome.storage.local.clear(() => {
    show(elLogin);
    document.getElementById("input-token").value = "";
    document.getElementById("input-org").value = DEFAULT_ORGANIZATION_ID;
    setMsg("");
  });
});

// ── Disponibilidade ────────────────────────────────────────
document.getElementById("btn-disponivel").addEventListener("click", () =>
  setAvailability(true)
);
document.getElementById("btn-indisponivel").addEventListener("click", () =>
  setAvailability(false)
);

async function setAvailability(available) {
  disableButtons(true);
  setMsg("Atualizando...");

  chrome.storage.local.get(
    ["utalk_token", "utalk_org", "utalk_member_id", WAITING_KEY],
    async (data) => {
      const { utalk_token, utalk_org, utalk_member_id } = data;

      try {
        if (!available) {
          await updateRemoteAvailability(utalk_member_id, false);

          // ── INDISPONÍVEL ──────────────────────────────────
          // Busca todos os chats abertos e atribuídos a esta atendente
          const chats = await fetchOpenChats(utalk_token, utalk_org, utalk_member_id);

          if (chats.length === 0) {
            // Nenhum chat aberto — apenas salva o status
            chrome.storage.local.set({
              utalk_available: false,
              [WAITING_KEY]: [],
              utalk_saved_at: new Date().toISOString(),
            });
            updateBadge(false);
            setMsg("⏸ Indisponível. Você não tinha chats abertos. Novos contatos serão pulados na fila.", "ok");
            return;
          }

          // Coloca todos os chats em waiting: true
          // Isso sinaliza ao bot da Umbler Talk para redistribuir novos contatos
          const results = await Promise.allSettled(
            chats.map((c) =>
              apiPut(`/v1/chats/${c.id}/`, utalk_token, utalk_org, { waiting: true })
            )
          );

          const succeeded = chats
            .filter((_, i) => results[i].status === "fulfilled")
            .map((c) => c.id);

          // Salva os IDs que foram alterados para restaurar depois
          chrome.storage.local.set({
            utalk_available: false,
            [WAITING_KEY]: succeeded,
            utalk_saved_at: new Date().toISOString(),
          });

          updateBadge(false);
          setMsg(
            `⏸ Indisponível. ${succeeded.length} chat(s) colocados em espera. Novos contatos serão pulados na fila.`,
            "ok"
          );
        } else {
          // ── DISPONÍVEL ────────────────────────────────────
          // Restaura os chats que esta extensão colocou em espera
          const waitingIds = data[WAITING_KEY] || [];

          if (waitingIds.length > 0) {
            await Promise.allSettled(
              waitingIds.map((id) =>
                apiPut(`/v1/chats/${id}/`, utalk_token, utalk_org, { waiting: false })
              )
            );
          }

          chrome.storage.local.set({
            utalk_available: true,
            [WAITING_KEY]: [],
            utalk_saved_at: new Date().toISOString(),
          });

          await updateRemoteAvailability(utalk_member_id, true);
          updateBadge(true);
          setMsg("✔ Disponível. Chats restaurados e fila liberada.", "ok");
        }
      } catch (e) {
        setMsg(`Erro ao atualizar status. (${e.message})`, "error");
      } finally {
        disableButtons(false);
      }
    }
  );
}

async function updateRemoteAvailability(memberId, available) {
  if (!memberId) throw new Error("atendente não identificada");

  const res = await fetch(STATUS_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": STATUS_API_KEY,
    },
    body: JSON.stringify({ memberId, available }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || res.status);
  }

  return res.json();
}

async function fetchRemoteAvailability(memberId) {
  if (!memberId) throw new Error("atendente não identificada");

  const url = new URL(STATUS_API);
  url.searchParams.set("memberId", memberId);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || res.status);
  }

  const data = await res.json();
  return data?.available === true;
}

async function refreshRemoteAvailability(memberId) {
  try {
    const available = await fetchRemoteAvailability(memberId);
    chrome.storage.local.set({
      utalk_available: available,
      utalk_saved_at: new Date().toISOString(),
    });
    updateBadge(available);
  } catch (e) {
    setMsg(`Não foi possível confirmar o status atual. (${e.message})`, "error");
  }
}

function hasSavedSession(data) {
  return Boolean(data.utalk_token && data.utalk_org && data.utalk_member_id);
}

// ── Busca chats abertos da atendente ───────────────────────
// GET /v1/chats/ filtrando por membro e estado aberto
async function fetchOpenChats(token, org, memberId) {
  const url = new URL(API + "/v1/chats/");
  url.searchParams.set("organizationId", org);
  url.searchParams.set("ChatState", "Open");
  // Filtra apenas chats atribuídos a esta atendente
  url.searchParams.set("Members.Rule", "Any");
  url.searchParams.set("Members.Values", memberId);
  url.searchParams.set("Take", "100");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(res.status);
  const data = await res.json();
  // A API retorna paginado: { items: [...] } ou array direto
  const chats = Array.isArray(data) ? data : (data.items || []);
  return chats.filter((chat) => isChatAssignedToMember(chat, memberId));
}

function isChatAssignedToMember(chat, memberId) {
  if (!chat || !memberId) return false;
  return chat.organizationMember?.id === memberId;
}

// ── Helpers de UI ──────────────────────────────────────────
function show(el) {
  [elLoading, elLogin, elMain].forEach((e) => (e.style.display = "none"));
  el.style.display = "block";
}

function showMain(name) {
  elMemberName.textContent = name;
  show(elMain);
}

function updateBadge(available) {
  elStatusBadge.className = available ? "online" : "offline";
  elStatusText.textContent = available ? "Disponível" : "Indisponível";
  elHint.textContent = available
    ? "Você está recebendo novos atendimentos normalmente."
    : "Seus chats atuais continuam com você. Novos serão redirecionados.";
}

function setMsg(text, type = "") {
  const visible = elMain.style.display !== "none" ? elMain : elLogin;
  const el = visible.querySelector("#msg") || document.getElementById("msg");
  if (el) { el.textContent = text; el.className = type; }
}

function disableButtons(disabled) {
  ["btn-disponivel", "btn-indisponivel", "btn-login"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = disabled;
  });
}

// ── Helpers de API ─────────────────────────────────────────
async function apiGet(path, token, org) {
  const url = new URL(API + path);
  if (org) url.searchParams.set("organizationId", org);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

async function apiPut(path, token, org, body) {
  const url = new URL(API + path);
  if (org) url.searchParams.set("organizationId", org);
  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} em ${path}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}
