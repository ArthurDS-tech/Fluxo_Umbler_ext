# UTalk Atendente — Extensão de Disponibilidade

Extensão para Chrome/Edge que permite às atendentes controlar manualmente sua disponibilidade para receber novos atendimentos, usando a API oficial da Umbler Talk com o próprio token da atendente. Não requer permissão de Admin.

---

## Como funciona

```
Atendente clica "Indisponível"
        │
        ▼
GET /v1/chats/ → busca todos os chats abertos da atendente
        │
        ▼
PUT /v1/chats/{id}/ → { waiting: true } em cada chat
        │
        ▼
Bot da Umbler Talk detecta chats em espera
e redireciona novos contatos para outras atendentes
        │
Atendente clica "Disponível"
        │
        ▼
PUT /v1/chats/{id}/ → { waiting: false } nos chats salvos
```

- A conta nunca é desativada
- Os chats em andamento continuam com a atendente
- Somente novos contatos são redirecionados pelo bot
- Funciona com token de atendente comum — sem necessidade de Admin
- Não requer servidor externo

---

## Estrutura

```
browser-extension/
├── manifest.json     Manifest V3
├── popup.html        Interface
└── popup.js          Lógica principal
```

---

## Instalação

1. Abra `chrome://extensions` (ou `edge://extensions`)
2. Ative o **Modo do desenvolvedor**
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `browser-extension`

Nunca abra o `popup.html` diretamente no navegador. A API `chrome.storage` só funciona quando o popup é aberto pelo ícone da extensão instalada.

---

## Login

### 1. Gerar o token de acesso

1. Acesse [app-utalk.umbler.com](https://app-utalk.umbler.com)
2. Vá em **Configurações → API**
3. Gere ou copie seu token de acesso pessoal

### 2. Obter o ID da organização

Consulte a API com seu token:

```
GET https://app-utalk.umbler.com/api/v1/members/me/
Authorization: Bearer SEU_TOKEN
```

O campo `organizations[].id` contém o ID. Formato: `AB_12-xyzEXAMPLE`

### 3. Entrar na extensão

1. Clique no ícone da extensão
2. Cole o token
3. Cole o ID da organização
4. Clique em **Entrar**

As credenciais ficam salvas no `chrome.storage.local`.

---

## Uso

| Botão | O que acontece |
|---|---|
| ✔ Disponível | Retira `waiting: true` dos chats que a extensão colocou em espera. A atendente volta a receber novos atendimentos. |
| ⏸ Indisponível | Busca todos os chats abertos da atendente e aplica `waiting: true`. O bot detecta e redireciona novos contatos. Os chats atuais continuam com ela. |

---

## Endpoints utilizados

Todos usam `Authorization: Bearer TOKEN`. Apenas leitura e atualização de chats — sem escrita em membros ou organização.

### Validação do token / login

```
GET /v1/members/me/
```

Retorna `id`, `displayName` e `emailAddress` da atendente autenticada.

### Buscar chats abertos

```
GET /v1/chats/?organizationId={org}&ChatState=Open&Members.Rule=Any&Members.Values={memberId}&Take=100
```

Retorna lista paginada `{ items: [...] }`. Filtrado por chats abertos atribuídos à atendente.

### Atualizar estado do chat

```
PUT /v1/chats/{chatId}/?organizationId={org}
Content-Type: application/json

{ "waiting": true }   // indisponível — sinaliza ao bot para redirecionar
{ "waiting": false }  // disponível — retira da fila de espera
```

Modelo: `UpdateChatModel`. Rate limit: 250 requisições por 5 segundos.

---

## Armazenamento local

| Chave | Conteúdo |
|---|---|
| `utalk_token` | Token Bearer |
| `utalk_org` | ID da organização |
| `utalk_member_id` | ID do membro |
| `utalk_name` | Nome de exibição |
| `utalk_available` | `true` ou `false` |
| `utalk_waiting_chats` | Array de IDs dos chats colocados em espera pela extensão |

`utalk_waiting_chats` é usado para restaurar exatamente os chats que foram alterados ao voltar para disponível. Removidos todos ao clicar em Sair.

---

## Permissões do manifest

| Permissão | Motivo |
|---|---|
| `storage` | Salvar credenciais e estado localmente |
| `activeTab` | Reservada |
| `host_permissions: https://app-utalk.umbler.com/*` | Permitir chamadas fetch à API |

---

## Configuração do bot na Umbler Talk

Para que o redirecionamento funcione, o bot precisa estar configurado para verificar o estado `waiting` antes de atribuir um chat a uma atendente, ou usar o **WaitingFlow** nativo da plataforma.

O campo `waiting: true` em um chat é reconhecido nativamente pela Umbler Talk como "aguardando redistribuição".

---

## Requisitos

- Chrome 88+ ou Edge 88+ (Manifest V3)
- Token de acesso gerado na Umbler Talk
- ID da organização
