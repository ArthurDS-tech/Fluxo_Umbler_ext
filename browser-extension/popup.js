const API = "https://app-utalk.umbler.com/api";

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
  ["utalk_token", "utalk_org", "utalk_member_id", "utalk_name", "utalk_available"],
  (data) => {
    if (data.utalk_token && data.utalk_member_id) {
      const available = data.utalk_available !== false;
      showMain(data.utalk_name || "Atendente");
      updateBadge(available);
    } else {
      show(elLogin);
    }
  }
);

// ── Login ──────────────────────────────────────────────────
document.getElementById("btn-login").addEventListener("click", async () => {
  const token = document.getElementById("input-token").value.trim();
  const org   = document.getElementById("input-org").value.trim();

  if (!token || !org) {
    setMsg("Preencha o token e o ID da organização.", "error");
    return;
  }

  setMsg("Verificando...");
  disableButtons(true);

  try {
    const me = await apiGet("/v1/members/me/", token, null);
    const name = me.displayName || me.emailAddress || "Atendente";

    chrome.storage.local.set({
      utalk_token: token,
      utalk_org: org,
      utalk_member_id: me.id,
      utalk_name: name,
      utalk_available: true,
    });

    showMain(name);
    updateBadge(true);
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
    document.getElementById("input-org").value = "";
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
          // ── INDISPONÍVEL ──────────────────────────────────
          // Busca todos os chats abertos e atribuídos a esta atendente
          const chats = await fetchOpenChats(utalk_token, utalk_org, utalk_member_id);

          if (chats.length === 0) {
            // Nenhum chat aberto — apenas salva o status
            chrome.storage.local.set({ utalk_available: false, [WAITING_KEY]: [] });
            updateBadge(false);
            setMsg("⏸ Indisponível. Você não tinha chats abertos.", "ok");
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
          });

          updateBadge(false);
          setMsg(
            `⏸ Indisponível. ${succeeded.length} chat(s) colocados em espera.`,
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
          });

          updateBadge(true);
          setMsg("✔ Disponível. Chats restaurados.", "ok");
        }
      } catch (e) {
        setMsg(`Erro ao atualizar status. (${e.message})`, "error");
      } finally {
        disableButtons(false);
      }
    }
  );
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
  return Array.isArray(data) ? data : (data.items || []);
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
