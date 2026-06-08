const fs = require('fs');
const path = require('path');

const TABLES = [
  {
    table: 'clientes',
    label: 'Clientes',
    select:
      'id,nome_completo,email,telefone,telefone_e164,origem_contato,assunto,servico,url_redirecionamento,created_at,updated_at,umbler_status,umbler_contact_id,umbler_chat_id'
  },
  {
    table: 'contatos_site',
    label: 'Clientes site novo',
    select:
      'id,lead_id,tipo_contato,nome_completo,email,telefone,telefone_e164,origem_contato,mensagem,assunto,created_at,updated_at,umbler_status,umbler_contact_id,umbler_chat_id'
  },
  {
    table: 'contatos_site_rota_oculta',
    label: 'Clientes organico',
    select:
      'id,lead_id,tipo_contato,nome_completo,email,telefone,telefone_e164,origem_contato,mensagem,assunto,created_at,updated_at,umbler_status,umbler_contact_id,umbler_chat_id'
  },
  {
    table: 'whatsapp_popup_telefones',
    label: 'Clientes site anuncio 1',
    select:
      'id,telefone,telefone_e164,origem_contato,mensagem,atendente,aceite_redirecionamento,created_at,updated_at'
  },
  {
    table: 'whatsapp_leads',
    label: 'Clientes WhatsApp',
    select:
      'id,telefone,telefone_e164,origem_contato,mensagem,umbler_status,umbler_contact_id,umbler_chat_id,created_at,updated_at'
  },
  {
    table: 'patio_leads',
    label: 'Patio - veiculo apreendido',
    select:
      'id,whatsapp,whatsapp_digits,origem,mensagem,page_url,user_agent,status,created_at,updated_at'
  }
];

const DEFAULT_ATTENDANTS = [
  {
    key: 'bruna',
    name: 'Bruna',
    phone: '+5548988260213',
    channelId: 'ZZRSn5wSM4RTE7KJ',
    memberId: 'ZzUQwM9nj2l-H5hc'
  },
  {
    key: 'ana',
    name: 'Ana',
    phone: '+5548991917671',
    channelId: 'ZZRSWJl_JmIQx0UE',
    memberId: 'ZaZkfnFmogpzCidw'
  },
  {
    key: 'kenia',
    name: 'Kenia',
    phone: '+5548991917564',
    channelId: 'ZQxHphkRFwc7FJ2W',
    memberId: 'Z26n85VVIK64B6I2'
  },
  {
    key: 'isa',
    name: 'Isa',
    phone: '+5548984034938',
    channelId: 'ZQxHJhkRFwc7E0bT',
    memberId: 'ZaZlLHFmogpzC4xO'
  },
  {
    key: 'julia',
    name: 'Julia',
    phone: '+5548991065955',
    channelId: 'ZQxHaZ4vN7FoyHm7',
    memberId: 'ZoWIY_xoe7uoAAFQ'
  }
];

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return false;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2] || '';
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
  return true;
}

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    if (!raw.startsWith('--')) continue;
    const [key, value = 'true'] = raw.slice(2).split('=');
    args[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  return args;
}

function boolFrom(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'sim'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'nao', 'não'].includes(normalized)) return false;
  return fallback;
}

function numberFrom(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function timestampFrom(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

function parseAttendants(value) {
  if (!value) return DEFAULT_ATTENDANTS;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_ATTENDANTS;
  } catch {
    return DEFAULT_ATTENDANTS;
  }
}

function listFromApiPayload(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.members)) return data.members;
  return [];
}

function memberTransferTimestamp(member) {
  const value = member?.lastBotTransferenceUTC || member?.lastTransferenceUTC || member?.updatedAtUTC || '';
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

function buildActiveAttendantQueue(attendants, onlineMembers) {
  const configured = (attendants || []).filter((item) => item?.memberId);
  const onlineById = new Map(
    listFromApiPayload(onlineMembers)
      .filter((member) => member?.id && member.active !== false)
      .map((member) => [member.id, member])
  );

  return configured
    .map((attendant, index) => {
      const onlineMember = onlineById.get(attendant.memberId);
      if (!onlineMember) return null;
      return {
        ...attendant,
        online: true,
        onlineMember: {
          id: onlineMember.id,
          displayName: onlineMember.displayName || onlineMember.name || '',
          emailAddress: onlineMember.emailAddress || '',
          active: onlineMember.active !== false,
          lastBotTransferenceUTC: onlineMember.lastBotTransferenceUTC || null
        },
        queueIndex: index,
        lastBotTransferenceUTC: onlineMember.lastBotTransferenceUTC || null
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = memberTransferTimestamp(a.onlineMember);
      const bTime = memberTransferTimestamp(b.onlineMember);
      if (aTime !== bTime) return aTime - bTime;
      return a.queueIndex - b.queueIndex;
    });
}

function attendantByMemberId(env, memberId) {
  return (env.attendants || []).find((attendant) => attendant.memberId === memberId) || null;
}

function isaAttendant(env) {
  return attendantByMemberId(env, 'ZaZlLHFmogpzC4xO') || {
    key: 'isa',
    name: 'Isa',
    phone: '+5548984034938',
    channelId: 'ZQxHJhkRFwc7E0bT',
    memberId: 'ZaZlLHFmogpzC4xO'
  };
}

async function statusApi(env, pathname, options = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
  if (env.statusApiKey) headers['X-API-Key'] = env.statusApiKey;
  return requestJson(`${env.statusApiBaseUrl}${pathname}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  });
}

async function pickActiveAttendant(umbler, env, lead = null) {
  if (env.assignMemberId) {
    return {
      selected: { key: 'manual', name: 'Manual', memberId: env.assignMemberId, channelId: env.channelId, phone: '' },
      onlineMembers: [],
      activeQueue: [],
      offlineAttendants: []
    };
  }

  if (isPatioLead(lead)) {
    const isa = isaAttendant(env);
    const availability = await statusApi(env, `/direct-available?memberId=${encodeURIComponent(isa.memberId)}`);
    return {
      selected: {
        ...isa,
        patioExclusive: true,
        availableInPanel: availability.ok,
        availabilityReason: availability.data?.reason || ''
      },
      onlineMembers: [],
      activeQueue: [isa],
      offlineAttendants: []
    };
  }

  const queueRes = await statusApi(env, '/queue');
  if (!queueRes.ok) {
    throw new Error(`Falha ao buscar fila de disponibilidade: status ${queueRes.status}`);
  }

  const nextMemberId = queueRes.data?.queue?.nextAvailableMemberId;
  const activeQueue = (queueRes.data?.queue?.order || [])
    .filter((item) => item.available)
    .map((item) => ({
      ...item,
      ...(attendantByMemberId(env, item.memberId) || {})
    }));
  const offlineAttendants = (queueRes.data?.queue?.order || [])
    .filter((item) => !item.available)
    .map((item) => ({ key: item.name, name: item.name, memberId: item.memberId }));

  if (!nextMemberId) {
    return {
      selected: null,
      onlineMembers: [],
      activeQueue,
      offlineAttendants
    };
  }

  if (!env.execute) {
    const selected = attendantByMemberId(env, nextMemberId) || {
      key: queueRes.data?.queue?.nextAvailableMemberName || nextMemberId,
      name: queueRes.data?.queue?.nextAvailableMemberName || nextMemberId,
      phone: '',
      channelId: env.channelId,
      memberId: nextMemberId
    };

    return {
      selected: {
        ...selected,
        availabilityReason: 'Teste sem envio: fila consultada sem consumir a vez.',
        queue: queueRes.data?.queue || null
      },
      onlineMembers: [],
      activeQueue,
      offlineAttendants
    };
  }

  const reserveRes = await statusApi(env, `/available?memberId=${encodeURIComponent(nextMemberId)}`);
  if (!reserveRes.ok) {
    return {
      selected: null,
      onlineMembers: [],
      activeQueue,
      offlineAttendants,
      reserveError: reserveRes.data
    };
  }

  const selected = attendantByMemberId(env, nextMemberId) || {
    key: reserveRes.data?.name || nextMemberId,
    name: reserveRes.data?.name || nextMemberId,
    phone: '',
    channelId: env.channelId,
    memberId: nextMemberId
  };

  return {
    selected: {
      ...selected,
      availabilityReason: reserveRes.data?.reason || '',
      queue: reserveRes.data?.queue || null
    },
    onlineMembers: [],
    activeQueue,
    offlineAttendants
  };
}

function loadEnv(args) {
  const localEnv = path.join(__dirname, '..', '.env');
  const fallbackEnv = path.join(__dirname, '..', '..', 'deploy_vercel_vendas_ia', '.env');
  const loadedPath = loadDotEnv(localEnv) ? localEnv : loadDotEnv(fallbackEnv) ? fallbackEnv : null;

  const env = {
    loadedPath,
    supabaseUrl: String(process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '',
    umblerApiBaseUrl: String(process.env.UMBLER_API_BASE_URL || 'https://app-utalk.umbler.com/api').replace(/\/$/, ''),
    umblerApiToken: process.env.UMBLER_API_TOKEN || '',
    organizationId: process.env.UMBLER_ORGANIZATION_ID || '',
    statusApiBaseUrl: String(process.env.STATUS_API_BASE_URL || 'https://utalk-status-webhook-production.up.railway.app').replace(/\/$/, ''),
    statusApiKey: process.env.STATUS_API_KEY || 'utalk-status-2026-railway',
    windowMinutes: numberFrom(args.windowMinutes || process.env.REMARKETING_WINDOW_MINUTES, 7),
    requestDelayMs: numberFrom(process.env.REQUEST_DELAY_MS, 120),
    testPhone: args.testPhone || process.env.REMARKETING_TEST_PHONE || '',
    channelId: args.channelId || process.env.REMARKETING_CHANNEL_ID || 'ZZRSn5wSM4RTE7KJ',
    templateId: args.templateId || process.env.REMARKETING_TEMPLATE_ID || 'aiKrlq1GnW5qf0XK',
    assignMemberId: args.assignMemberId || process.env.REMARKETING_ASSIGN_MEMBER_ID || '',
    attendants: parseAttendants(process.env.REMARKETING_ATTENDANTS_JSON),
    testChatId: args.testChatId || process.env.REMARKETING_TEST_CHAT_ID || '',
    createdAfter: args.createdAfter || process.env.REMARKETING_CREATED_AFTER || '',
    requireCreatedAfter: boolFrom(args.requireCreatedAfter || process.env.REMARKETING_REQUIRE_CREATED_AFTER, true),
    templateParam2: args.templateParam2 || process.env.REMARKETING_TEMPLATE_PARAM_2 || '2026',
    templateFileId: args.templateFileId || process.env.REMARKETING_TEMPLATE_FILE_ID || 'aiMIVYll8KEm3xcn',
    eventsTable: args.eventsTable || process.env.REMARKETING_EVENTS_TABLE || 'remarketing_7min_events',
    privateNote: boolFrom(args.privateNote || process.env.REMARKETING_SEND_PRIVATE_NOTE, true),
    execute: boolFrom(args.execute || process.env.REMARKETING_EXECUTE, false),
    workerEnabled: boolFrom(args.workerEnabled || process.env.REMARKETING_WORKER_ENABLED, true),
    force: boolFrom(args.force, false),
    once: !boolFrom(args.watch, false),
    pollMs: numberFrom(args.pollMs || process.env.REMARKETING_POLL_MS, 10000),
    maxLeadsPerTick: numberFrom(args.maxLeadsPerTick || process.env.REMARKETING_MAX_LEADS_PER_TICK, 20),
    lookbackDays: numberFrom(args.lookbackDays || process.env.REMARKETING_LOOKBACK_DAYS, 14)
  };

  const missing = [];
  if (!env.supabaseUrl) missing.push('SUPABASE_URL');
  if (!env.supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_ANON_KEY');
  if (!env.umblerApiToken) missing.push('UMBLER_API_TOKEN');
  if (!env.organizationId) missing.push('UMBLER_ORGANIZATION_ID');
  if (!env.channelId) missing.push('REMARKETING_CHANNEL_ID');
  if (!env.templateId) missing.push('REMARKETING_TEMPLATE_ID');
  if (env.requireCreatedAfter && !env.createdAfter) missing.push('REMARKETING_CREATED_AFTER');
  if (missing.length) throw new Error(`Variaveis ausentes: ${missing.join(', ')}`);
  return env;
}

function isLeadBeforeCreatedAfter(lead, env) {
  const createdAfterMs = timestampFrom(env.createdAfter);
  if (!createdAfterMs) return false;
  const leadMs = timestampFrom(lead?.created_at);
  return !leadMs || leadMs < createdAfterMs;
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizePhone(value) {
  const digits = digitsOnly(value);
  if (!digits) return '';
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return String(value || '').trim();
}

function phoneVariants(phone) {
  const digits = digitsOnly(phone);
  const variants = new Set();
  if (!digits) return [];
  variants.add(`+${digits}`);
  variants.add(digits);
  if (digits.startsWith('55') && digits.length === 13) {
    const withoutNine = `${digits.slice(0, 4)}${digits.slice(5)}`;
    variants.add(`+${withoutNine}`);
    variants.add(withoutNine);
  }
  if (digits.startsWith('55') && digits.length === 12) {
    const withNine = `${digits.slice(0, 4)}9${digits.slice(4)}`;
    variants.add(`+${withNine}`);
    variants.add(withNine);
  }
  return Array.from(variants);
}

function normalizeLead(tableConfig, row) {
  if (tableConfig.table === 'patio_leads') {
    const phone = normalizePhone(row.whatsapp || row.whatsapp_digits || '');
    return {
      source_table: tableConfig.table,
      source_label: tableConfig.label,
      id: row.id || '',
      lead_id: row.id || '',
      nome_completo: '',
      email: '',
      telefone: row.whatsapp || row.whatsapp_digits || '',
      telefone_e164: phone,
      origem_contato: row.origem || 'website',
      assunto: 'Veiculo Apreendido / Blitz',
      mensagem: row.mensagem || '',
      atendente: 'Isa',
      umbler_contact_id: '',
      umbler_chat_id: '',
      page_url: row.page_url || '',
      user_agent: row.user_agent || '',
      lead_status: row.status || '',
      created_at: row.created_at || '',
      updated_at: row.updated_at || ''
    };
  }

  return {
    source_table: tableConfig.table,
    source_label: tableConfig.label,
    id: row.id || '',
    lead_id: row.lead_id || '',
    nome_completo: row.nome_completo || '',
    email: row.email || '',
    telefone: row.telefone || '',
    telefone_e164: normalizePhone(row.telefone_e164 || row.telefone || ''),
    origem_contato: row.origem_contato || '',
    assunto: row.assunto || row.servico || '',
    mensagem: row.mensagem || '',
    atendente: row.atendente || '',
    umbler_contact_id: row.umbler_contact_id || '',
    umbler_chat_id: row.umbler_chat_id || '',
    page_url: row.url_redirecionamento || '',
    created_at: row.created_at || '',
    updated_at: row.updated_at || ''
  };
}

function textIncludesAny(value, words) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return words.some((word) => normalized.includes(word));
}

function isPatioLead(lead) {
  if (lead?.source_table === 'patio_leads') return true;
  return textIncludesAny(
    [lead?.assunto, lead?.mensagem, lead?.origem_contato, lead?.source_label, lead?.page_url].filter(Boolean).join(' '),
    ['patio', 'veiculo apreendido', 'veiculo preso', 'blitz', 'apreendido']
  );
}

function chatCreatedAt(chat) {
  const candidates = [chat?.createdAtUTC, chat?.createdAt, chat?.created_at, chat?.startedAtUTC];
  for (const value of candidates) {
    const ms = new Date(value || 0).getTime();
    if (Number.isFinite(ms) && ms > 0) return new Date(ms).toISOString();
  }
  return '';
}

function chatSortTimestamp(chat) {
  const candidates = [
    chat?.lastMessage?.eventAtUTC,
    chat?.lastMessage?.createdAtUTC,
    chat?.message?.eventAtUTC,
    chat?.message?.createdAtUTC,
    chat?.updatedAtUTC,
    chat?.closedAtUTC,
    chat?.createdAtUTC,
    chat?.createdAt
  ];
  for (const value of candidates) {
    const ms = new Date(value || 0).getTime();
    if (Number.isFinite(ms) && ms > 0) return ms;
  }
  return 0;
}

function isChatInWindow(chat, leadCreatedAt, windowMs) {
  const leadMs = new Date(leadCreatedAt || 0).getTime();
  const chatMs = new Date(chatCreatedAt(chat) || 0).getTime();
  if (!Number.isFinite(leadMs) || !Number.isFinite(chatMs) || leadMs <= 0 || chatMs <= 0) return false;
  return chatMs >= leadMs && chatMs <= leadMs + windowMs;
}

function classifyLeadChats(lead, chats, windowMs) {
  if (chats.some((chat) => isChatInWindow(chat, lead.created_at, windowMs))) return 'chat_criado_dentro_da_janela';
  if (!chats.length) return 'nenhum_chat_encontrado';

  const leadMs = new Date(lead.created_at || 0).getTime();
  const chatTimes = chats.map((chat) => new Date(chatCreatedAt(chat) || 0).getTime()).filter((ms) => Number.isFinite(ms) && ms > 0);
  if (!Number.isFinite(leadMs) || leadMs <= 0 || !chatTimes.length) return 'chat_sem_data_confiavel';
  if (chatTimes.every((chatMs) => chatMs < leadMs)) return 'chats_existentes_antes_do_cadastro';
  if (chatTimes.every((chatMs) => chatMs > leadMs + windowMs)) return 'primeiro_chat_apos_7min';
  return 'sem_chat_na_janela_7min';
}

function hasChatAfterLeadCreated(lead, chats) {
  const leadMs = new Date(lead?.created_at || 0).getTime();
  if (!Number.isFinite(leadMs) || leadMs <= 0) return true;
  return chats.some((chat) => {
    const chatMs = new Date(chatCreatedAt(chat) || 0).getTime();
    return Number.isFinite(chatMs) && chatMs >= leadMs;
  });
}

async function sleep(ms) {
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data, text };
}

class SupabaseClient {
  constructor(env) {
    this.env = env;
  }

  headers() {
    return {
      apikey: this.env.supabaseKey,
      Authorization: `Bearer ${this.env.supabaseKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    };
  }

  async fetchLeadsByPhone(phone, options = {}) {
    const wanted = new Set(phoneVariants(normalizePhone(phone)).map(digitsOnly));
    const createdAfterMs = options.createdAfter ? new Date(options.createdAfter).getTime() : 0;
    const leads = [];

    for (const table of TABLES) {
      const params = new URLSearchParams();
      params.set('select', table.select);
      params.set('order', 'created_at.desc');
      params.set('limit', '1000');
      const res = await requestJson(`${this.env.supabaseUrl}/rest/v1/${table.table}?${params}`, { headers: this.headers() });
      if (!res.ok) throw new Error(`Supabase ${table.table} status ${res.status}: ${JSON.stringify(res.data)}`);
      for (const row of Array.isArray(res.data) ? res.data : []) {
        const rowDigits = [row.telefone_e164, row.telefone, row.whatsapp, row.whatsapp_digits]
          .flatMap((value) => [digitsOnly(value), digitsOnly(normalizePhone(value))])
          .filter(Boolean);
        if (!rowDigits.some((value) => wanted.has(value))) continue;
        const lead = normalizeLead(table, row);
        const leadMs = new Date(lead.created_at || 0).getTime();
        if (createdAfterMs && (!Number.isFinite(leadMs) || leadMs < createdAfterMs)) continue;
        leads.push(lead);
      }
    }

    leads.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return leads;
  }

  async fetchDueLeads(options = {}) {
    const windowMs = Number(options.windowMinutes || 7) * 60 * 1000;
    const cutoffIso = new Date(Date.now() - windowMs).toISOString();
    const createdAfterMs = options.createdAfter ? new Date(options.createdAfter).getTime() : 0;
    const fallbackLookbackMs = Number(options.lookbackDays || 14) * 24 * 60 * 60 * 1000;
    const fallbackStartIso = new Date(Date.now() - fallbackLookbackMs).toISOString();
    const leads = [];

    for (const table of TABLES) {
      const params = new URLSearchParams();
      params.set('select', table.select);
      params.set('order', 'created_at.asc');
      params.set('limit', String(options.limitPerTable || 1000));
      params.append('created_at', `lte.${cutoffIso}`);
      params.append('created_at', `gte.${createdAfterMs ? new Date(createdAfterMs).toISOString() : fallbackStartIso}`);

      const res = await requestJson(`${this.env.supabaseUrl}/rest/v1/${table.table}?${params}`, { headers: this.headers() });
      if (!res.ok) throw new Error(`Supabase ${table.table} status ${res.status}: ${JSON.stringify(res.data)}`);

      for (const row of Array.isArray(res.data) ? res.data : []) {
        const lead = normalizeLead(table, row);
        if (!lead.telefone_e164 && !lead.telefone) continue;
        leads.push(lead);
      }
    }

    leads.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    return leads.slice(0, Number(options.maxRows || 20));
  }

  async recordEvent(event) {
    if (!this.env.eventsTable) return { ok: false, skipped: true, status: 0 };

    const payload = {
      ...event,
      updated_at: new Date().toISOString()
    };
    const conflictColumns = 'lead_source_table,lead_record_id';
    const url = `${this.env.supabaseUrl}/rest/v1/${this.env.eventsTable}?on_conflict=${encodeURIComponent(conflictColumns)}`;
    const res = await requestJson(url, {
      method: 'POST',
      headers: { ...this.headers(), Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(payload)
    });

    if (res.ok || res.status !== 409) return res;

    const patchParams = new URLSearchParams();
    patchParams.set('lead_source_table', `eq.${event.lead_source_table}`);
    patchParams.set('lead_record_id', `eq.${event.lead_record_id}`);
    const patchRes = await requestJson(`${this.env.supabaseUrl}/rest/v1/${this.env.eventsTable}?${patchParams}`, {
      method: 'PATCH',
      headers: { ...this.headers(), Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });

    return patchRes;
  }

  async findSentEvent(lead) {
    if (!this.env.eventsTable) return null;
    const params = new URLSearchParams();
    params.set('select', 'id,status,chat_id,template_id,created_at');
    params.set('lead_source_table', `eq.${lead.source_table}`);
    params.set('lead_record_id', `eq.${lead.id}`);
    params.set('status', 'eq.sent');
    params.set('limit', '1');

    const res = await requestJson(`${this.env.supabaseUrl}/rest/v1/${this.env.eventsTable}?${params}`, {
      headers: this.headers()
    });

    if (!res.ok || !Array.isArray(res.data) || !res.data.length) return null;
    return res.data[0];
  }
}

class UmblerClient {
  constructor(env) {
    this.env = env;
  }

  headers() {
    return {
      Authorization: `Bearer ${this.env.umblerApiToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    };
  }

  async get(pathname) {
    const res = await requestJson(`${this.env.umblerApiBaseUrl}${pathname}`, { headers: this.headers() });
    await sleep(this.env.requestDelayMs);
    return res;
  }

  async post(pathname, payload) {
    const res = await requestJson(`${this.env.umblerApiBaseUrl}${pathname}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload)
    });
    await sleep(this.env.requestDelayMs);
    return res;
  }

  async put(pathname, payload) {
    const res = await requestJson(`${this.env.umblerApiBaseUrl}${pathname}`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify(payload)
    });
    await sleep(this.env.requestDelayMs);
    return res;
  }

  async getChannel(channelId) {
    return this.get(`/v1/channels/${encodeURIComponent(channelId)}/?organizationId=${this.env.organizationId}`);
  }

  async getTemplate(templateId) {
    return this.get(`/v1/templates/${encodeURIComponent(templateId)}/?organizationId=${this.env.organizationId}`);
  }

  async getChat(chatId, includeMessages = 0) {
    return this.get(`/v1/chats/${encodeURIComponent(chatId)}/?organizationId=${this.env.organizationId}&includeMessages=${includeMessages}`);
  }

  async getOnlineMembers() {
    return this.get(`/v1/members/online/?organizationId=${this.env.organizationId}`);
  }

  async getContactByPhone(phone) {
    const statuses = [];
    for (const variant of phoneVariants(phone)) {
      const res = await this.get(
        `/v1/contacts/phone/?phoneNumber=${encodeURIComponent(variant)}&organizationId=${this.env.organizationId}`
      );
      statuses.push(res.status);
      const contact = res.data?.contact || res.data;
      if (res.ok && contact?.id) return { found: true, status: res.status, contact, matchedPhone: variant };
    }
    return { found: false, status: statuses.find((status) => status !== 404) || statuses[0] || 404, contact: null };
  }

  async createContact(lead) {
    return this.post('/v1/contacts/', {
      organizationId: this.env.organizationId,
      name: lead.nome_completo || lead.telefone_e164 || lead.telefone,
      phoneNumber: lead.telefone_e164,
      email: lead.email || null,
      source: `remarketing:${lead.source_table}`
    });
  }

  async getChatsByContactId(contactId) {
    const chats = [];
    for (let page = 1; page <= 200; page += 1) {
      const res = await this.get(
        `/v1/contacts/${encodeURIComponent(contactId)}/chats?organizationId=${this.env.organizationId}&page=${page}&pageSize=250`
      );
      if (!res.ok) return { ok: false, status: res.status, chats };
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      if (!items.length) break;
      chats.push(...items);
      if (items.length < 250) break;
    }
    chats.sort((a, b) => chatSortTimestamp(b) - chatSortTimestamp(a));
    return { ok: true, status: 200, chats };
  }

  async ensureContact(lead) {
    if (lead.umbler_contact_id) return { id: lead.umbler_contact_id };

    const found = await this.getContactByPhone(lead.telefone_e164);
    if (found.found) return found.contact;

    const created = await this.createContact(lead);
    const contact = created.data?.contact || created.data;
    if (!created.ok || !contact?.id) {
      throw new Error(`Falha ao criar contato Umbler status ${created.status}: ${JSON.stringify(created.data)}`);
    }
    return contact;
  }

  async ensureChat(contactId, channelId) {
    const created = await this.post('/v1/chats/', {
      organizationId: this.env.organizationId,
      contactId,
      channelId
    });
    if (!created.ok || !created.data?.id) {
      throw new Error(`Falha ao criar/abrir chat Umbler status ${created.status}: ${JSON.stringify(created.data)}`);
    }
    return created.data;
  }

  async sendMessage(chatId, message, isPrivate) {
    return this.post('/v1/messages/', {
      organizationId: this.env.organizationId,
      chatId,
      message,
      isPrivate,
      skipReassign: true,
      automated: true
    });
  }

  async sendTemplate(chatId, templateId, params, fileId) {
    const payload = {
      organizationId: this.env.organizationId,
      chatId,
      templateId,
      params,
      skipReassign: true
    };
    if (fileId) payload.fileId = fileId;
    return this.post('/v1/template-messages/', payload);
  }

  async assignChat(chatId, memberId) {
    return this.put(`/v1/chats/${encodeURIComponent(chatId)}/?organizationId=${this.env.organizationId}`, {
      open: true,
      waiting: true,
      memberId
    });
  }
}

function buildLeadNote(lead, validation, chatId, selectedAttendant = null) {
  const patio = isPatioLead(lead);
  const cleanText = (value) => String(value || '-').replace(/\blead\b/gi, 'cadastro');
  return [
    patio ? 'NOTA INTERNA - Atendimento de patio' : 'NOTA INTERNA - Atendimento vindo do site',
    'O cliente deixou o telefone no site e nao iniciou conversa nos primeiros minutos.',
    'Enviamos a mensagem inicial automaticamente e deixamos este atendimento com a responsavel abaixo.',
    `Responsavel: ${selectedAttendant?.name || '-'}${patio ? ' (atendimento de patio)' : ''}`,
    `Regra usada: ${patio ? 'Patio vai somente para Isa.' : 'Distribuicao pela fila das atendentes disponiveis.'}`,
    `Situacao: ${validation.reason}`,
    `Telefone: ${lead.telefone_e164 || lead.telefone || '-'}`,
    `Email: ${lead.email || '-'}`,
    `Origem: ${lead.origem_contato || lead.source_label || '-'}`,
    `Assunto: ${lead.assunto || '-'}`,
    `Mensagem inicial: ${cleanText(lead.mensagem).replace(/\s+/g, ' ').trim()}`,
    lead.page_url ? `Pagina: ${lead.page_url}` : null,
    `Cadastro: ${lead.created_at || '-'}`,
    `Cadastro ID: ${lead.lead_id || lead.id || '-'}`,
    `Chat Umbler: ${chatId || '-'}`,
    `Validado em: ${new Date().toISOString()}`
  ].filter(Boolean).join('\n');
}

function templateParamsForLead(lead, env) {
  return [];
}

async function collectValidation(umbler, lead, env) {
  let contact = null;

  if (lead.umbler_contact_id) {
    contact = { id: lead.umbler_contact_id };
  } else {
    const found = await umbler.getContactByPhone(lead.telefone_e164);
    if (found.found) contact = found.contact;
  }

  if (!contact?.id && !env.execute) {
    return {
      contact: { id: 'dry_run_contact_nao_criado' },
      chats: [],
      reason: 'nenhum_chat_encontrado',
      eligible: true
    };
  }

  if (!contact?.id) contact = await umbler.ensureContact(lead);

  const chatRes = await umbler.getChatsByContactId(contact.id);
  if (!chatRes.ok) throw new Error(`Falha ao buscar chats do contato ${contact.id}: status ${chatRes.status}`);

  const reason = classifyLeadChats(lead, chatRes.chats, env.windowMinutes * 60000);
  return { contact, chats: chatRes.chats, reason, eligible: reason !== 'chat_criado_dentro_da_janela' };
}

async function processLead(lead, env, clients = {}) {
  const supabase = clients.supabase || new SupabaseClient(env);
  const umbler = clients.umbler || new UmblerClient(env);

  if (isLeadBeforeCreatedAfter(lead, env)) {
    return {
      lead,
      validation: {
        reason: 'lead_anterior_ao_corte_configurado',
        eligible: false,
        createdAfter: env.createdAfter
      },
      actions: [{ action: 'skip', reason: 'lead_anterior_ao_REMARKETING_CREATED_AFTER' }]
    };
  }

  const sentEvent = env.force ? null : await supabase.findSentEvent(lead);
  if (sentEvent) {
    return {
      lead,
      validation: {
        reason: 'ja_enviado_no_supabase',
        eligible: false
      },
      actions: [{ action: 'skip', reason: 'ja_enviado_no_supabase', event: sentEvent }]
    };
  }

  const channelRes = await umbler.getChannel(env.channelId);
  if (!channelRes.ok) throw new Error(`Canal ${env.channelId} nao encontrado: status ${channelRes.status}`);
  const templateRes = await umbler.getTemplate(env.templateId);
  if (!templateRes.ok) throw new Error(`Template ${env.templateId} nao encontrado: status ${templateRes.status}`);

  if (templateRes.data?.status !== 'APPROVED') {
    throw new Error(`Template ${env.templateId} nao esta aprovado. Status atual: ${templateRes.data?.status || 'desconhecido'}`);
  }

  const validation = await collectValidation(umbler, lead, env);
  const leadMs = new Date(lead.created_at || 0).getTime();
  const dueAtMs = leadMs + env.windowMinutes * 60000;
  const isDue = Number.isFinite(dueAtMs) && dueAtMs > 0 ? Date.now() >= dueAtMs : true;
  const newestChat = validation.chats[0] || null;
  const existingChatSummary = newestChat ? `${newestChat.id} (${chatCreatedAt(newestChat) || 'sem data'})` : 'nenhum';

  const result = {
    lead,
    validation: {
      reason: validation.reason,
      eligible: validation.eligible,
      chatsFound: validation.chats.length,
      newestChat: existingChatSummary
    },
    actions: []
  };

  if (!validation.eligible) {
    result.actions.push({ action: 'skip', reason: 'chat_criado_dentro_da_janela' });
    return result;
  }

  if (hasChatAfterLeadCreated(lead, validation.chats)) {
    result.validation.eligible = false;
    result.validation.reason = 'cliente_ja_entrou_em_contato_apos_o_cadastro';
    result.actions.push({ action: 'skip', reason: 'cliente_ja_tem_conversa_apos_o_cadastro' });
    return result;
  }

  if (!isDue) {
    result.validation.eligible = false;
    result.validation.reason = 'aguardando_janela_7min';
    result.validation.dueAt = new Date(dueAtMs).toISOString();
    result.actions.push({ action: 'wait', reason: 'lead_ainda_na_janela_7min', dueAt: result.validation.dueAt });
    return result;
  }

  const attendantSelection = await pickActiveAttendant(umbler, env, lead);
  const selectedAttendant = attendantSelection.selected;
  result.attendantQueue = {
    active: attendantSelection.activeQueue.map((attendant) => ({
      key: attendant.key,
      name: attendant.name,
      memberId: attendant.memberId,
      displayName: attendant.onlineMember?.displayName || attendant.name || '',
      lastBotTransferenceUTC: attendant.lastBotTransferenceUTC || null,
      available: attendant.available !== false
    })),
    offline: attendantSelection.offlineAttendants,
    reserveError: attendantSelection.reserveError || null,
    mode: isPatioLead(lead) ? 'patio_exclusivo_isa' : 'fila_railway'
  };

  if (!selectedAttendant) {
    result.validation.eligible = false;
    result.validation.reason = isPatioLead(lead) ? 'aguardando_isa' : 'aguardando_atendente_disponivel_na_fila';
    result.actions.push({
      action: 'wait',
      reason: isPatioLead(lead) ? 'isa_nao_encontrada_para_patio' : 'nenhuma_atendente_disponivel_na_fila',
      offlineAttendants: attendantSelection.offlineAttendants
    });
    return result;
  }

  const templateChannelId = templateRes.data?.channelId || selectedAttendant.channelId || env.channelId;
  const templateChannelDiffers = Boolean(templateRes.data?.channelId && templateRes.data.channelId !== env.channelId);
  const shouldUseProvidedChatForTemplate = Boolean(env.testChatId && !templateChannelDiffers);
  const templateChatId = env.execute
    ? shouldUseProvidedChatForTemplate
      ? env.testChatId
      : (await umbler.ensureChat(validation.contact.id, templateChannelId)).id
    : shouldUseProvidedChatForTemplate
      ? env.testChatId
      : newestChat?.id || 'dry_run_chat_nao_criado';
  const noteChatId = env.testChatId || templateChatId;
  const note = buildLeadNote(lead, validation, templateChatId, selectedAttendant).slice(0, 2000);
  const params = templateParamsForLead(lead, env);

  result.chatId = templateChatId;
  result.noteChatId = noteChatId;
  result.contactId = validation.contact.id;
  result.selectedAttendant = selectedAttendant;
  result.template = {
    id: env.templateId,
    label: templateRes.data?.label || '',
    templateType: templateRes.data?.templateType || '',
    templateChannelId,
    configuredChannelId: env.channelId,
    params,
    hasFileId: Boolean(env.templateFileId)
  };

  if (templateChannelDiffers) {
    result.actions.push({
      action: 'warning',
      reason: `template_channel_differs_from_configured_channel:${templateChannelId}`
    });
  }

  if (!env.execute) {
    result.actions.push({ action: 'dry_run', notePreview: note, wouldSendTemplate: true, wouldAssignTo: selectedAttendant });
    return result;
  }

  const templateSendRes = await umbler.sendTemplate(templateChatId, env.templateId, params, env.templateFileId);
  result.actions.push({ action: 'send_template', ok: templateSendRes.ok, status: templateSendRes.status, response: templateSendRes.data });
  if (!templateSendRes.ok) throw new Error(`Falha ao enviar template: status ${templateSendRes.status} ${JSON.stringify(templateSendRes.data)}`);

  const noteRes = await umbler.sendMessage(noteChatId, note, env.privateNote);
  result.actions.push({ action: 'send_client_info_note', ok: noteRes.ok, status: noteRes.status, response: noteRes.data });
  if (!noteRes.ok) throw new Error(`Falha ao enviar nota do cliente: status ${noteRes.status} ${JSON.stringify(noteRes.data)}`);

  const assignRes = await umbler.assignChat(templateChatId, selectedAttendant.memberId);
  result.actions.push({ action: 'assign_chat', ok: assignRes.ok, status: assignRes.status, response: assignRes.data });
  if (!assignRes.ok) throw new Error(`Falha ao transferir/atribuir chat: status ${assignRes.status} ${JSON.stringify(assignRes.data)}`);

  if (noteChatId !== templateChatId) {
    const noteAssignRes = await umbler.assignChat(noteChatId, selectedAttendant.memberId);
    result.actions.push({ action: 'assign_note_chat', ok: noteAssignRes.ok, status: noteAssignRes.status, response: noteAssignRes.data });
  }

  const event = {
    lead_source_table: lead.source_table,
    lead_record_id: String(lead.id),
    lead_created_at: lead.created_at || null,
    phone_e164: lead.telefone_e164,
    status: 'sent',
    reason: validation.reason,
    chat_id: templateChatId,
    contact_id: validation.contact.id,
    template_id: env.templateId,
    channel_id: templateChannelId,
    assigned_member_id: selectedAttendant.memberId,
    payload: result
  };
  const eventRes = await supabase.recordEvent(event);
  result.actions.push({ action: 'record_supabase_event', ok: eventRes.ok, status: eventRes.status, skipped: eventRes.skipped || false });

  return result;
}

async function runOnce(env) {
  const supabase = new SupabaseClient(env);
  const umbler = new UmblerClient(env);
  const phone = normalizePhone(env.testPhone);
  if (!phone) throw new Error('Informe REMARKETING_TEST_PHONE ou --test-phone=5548999895903');

  const leads = await supabase.fetchLeadsByPhone(phone, { createdAfter: env.createdAfter });
  if (!leads.length) {
    return {
      lead: null,
      validation: {
        reason: 'aguardando_cadastro',
        eligible: false,
        chatsFound: 0,
        newestChat: 'nenhum'
      },
      actions: [{ action: 'wait', reason: `nenhum_lead_encontrado_para_${phone}` }]
    };
  }
  const lead = leads[0];

  return processLead(lead, env, { supabase, umbler });
}

async function scanDueLeads(env) {
  if (env.requireCreatedAfter && !env.createdAfter) {
    return {
      generatedAt: new Date().toISOString(),
      checked: 0,
      sent: 0,
      skipped: 0,
      errors: 1,
      results: [
        {
          lead: null,
          validation: { eligible: false, reason: 'created_after_obrigatorio' },
          actions: [{ action: 'error', reason: 'Configure REMARKETING_CREATED_AFTER para impedir envios a contatos antigos.' }]
        }
      ]
    };
  }

  const supabase = new SupabaseClient(env);
  const umbler = new UmblerClient(env);
  const leads = await supabase.fetchDueLeads({
    windowMinutes: env.windowMinutes,
    createdAfter: env.createdAfter,
    lookbackDays: env.lookbackDays,
    maxRows: env.maxLeadsPerTick
  });
  const results = [];

  for (const lead of leads) {
    const sentEvent = env.force ? null : await supabase.findSentEvent(lead);
    if (sentEvent) {
      results.push({
        lead,
        validation: { eligible: false, reason: 'ja_enviado_no_supabase' },
        actions: [{ action: 'skip', reason: 'ja_enviado_no_supabase', event: sentEvent }]
      });
      continue;
    }

    try {
      results.push(await processLead(lead, env, { supabase, umbler }));
    } catch (error) {
      const failed = {
        lead,
        validation: { eligible: false, reason: 'erro_processamento' },
        actions: [{ action: 'error', reason: error.message }]
      };
      await supabase.recordEvent({
        lead_source_table: lead.source_table,
        lead_record_id: String(lead.id),
        lead_created_at: lead.created_at || null,
        phone_e164: lead.telefone_e164,
        status: 'error',
        reason: 'erro_processamento',
        payload: failed,
        error_message: error.message
      });
      results.push(failed);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    checked: leads.length,
    sent: results.filter((result) => result.actions.some((action) => action.action === 'send_template' && action.ok)).length,
    skipped: results.filter((result) => result.actions.some((action) => action.action === 'skip')).length,
    errors: results.filter((result) => result.actions.some((action) => action.action === 'error')).length,
    results
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const env = loadEnv(args);
  const outDir = path.join(__dirname, '..', 'output');
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Env: ${env.loadedPath || 'process.env'}`);
  console.log(`Modo: ${env.execute ? 'EXECUTAR ENVIO REAL' : 'DRY RUN'}`);
  console.log(`Telefone teste: ${normalizePhone(env.testPhone)}`);
  console.log(`Janela: ${env.windowMinutes} minuto(s)`);
  if (env.createdAfter) console.log(`Somente cadastros apos: ${new Date(env.createdAfter).toISOString()}`);

  let lastResult = null;
  do {
    lastResult = await runOnce(env);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(outDir, `remarketing_flow_${stamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(lastResult, null, 2));

    console.log(`Elegivel: ${lastResult.validation.eligible} | motivo: ${lastResult.validation.reason}`);
    console.log(`Chat: ${lastResult.chatId || 'nao usado'}`);
    if (lastResult.selectedAttendant) {
      console.log(`Atendente: ${lastResult.selectedAttendant.name} (${lastResult.selectedAttendant.memberId})`);
    }
    console.log(`Acoes: ${lastResult.actions.map((action) => `${action.action}:${action.status || action.reason || 'ok'}`).join(' | ')}`);
    console.log(`Resultado: ${filePath}`);

    if (env.once) break;
    await sleep(env.pollMs);
  } while (true);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Erro: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_ATTENDANTS,
  SupabaseClient,
  UmblerClient,
  buildActiveAttendantQueue,
  loadEnv,
  parseArgs,
  pickActiveAttendant,
  processLead,
  runOnce,
  scanDueLeads,
  normalizePhone,
  sleep
};
