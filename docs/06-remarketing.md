# Remarketing

O remarketing fica dentro do mesmo servidor Railway, em:

```text
status-server/remarketing/remarketing-flow.js
```

## Objetivo

Buscar cadastros novos no Supabase e enviar a mensagem template da Umbler quando o cliente ainda nao iniciou conversa.

## Regras principais

- Nao enviar para cliente aleatorio.
- Enviar somente para cadastro novo elegivel.
- Antes de enviar, verificar se ja existe conversa depois do cadastro.
- Patio vai para Isa.
- Outros assuntos usam fila Railway.
- A nota interna nao deve falar `lead` nem expor texto confuso para as atendentes.

## Tabelas consultadas

O worker foi preparado para consultar as tabelas de clientes do site, incluindo:

- `clientes`
- `contatos_site`
- `contatos_site_rota_oculta`
- `patio_leads`
- `whatsapp_leads`
- `whatsapp_popup_telefones`

## Template

Template configurado na Umbler:

```text
https://app-utalk.umbler.com/settings/templates/aiKrlq1GnW5qf0XK
```

## Endpoints

| Endpoint | Funcao |
|---|---|
| `GET /remarketing/health` | Ver estado do worker |
| `POST /remarketing/tick` | Rodar uma varredura manual |
| `POST /remarketing/run-phone` | Testar por telefone |

## Variaveis

As variaveis ficam no Railway:

- `REMARKETING_WORKER_ENABLED`
- `REMARKETING_EXECUTE`
- `REMARKETING_TEMPLATE_ID`
- `REMARKETING_CHANNEL_ID`
- `REMARKETING_WINDOW_MINUTES`
- `REMARKETING_POLL_MS`
- `REMARKETING_CREATED_AFTER`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `UMBLER_API_TOKEN`

Nao colocar valores sensiveis no Git.
