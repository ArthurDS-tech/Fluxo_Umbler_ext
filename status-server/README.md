# UTalk Status Server no Railway

Servico simples para o fluxo da Umbler consultar se uma atendente esta disponivel.

O mesmo servico tambem pode executar o remarketing. Assim, a aplicacao Railway do fluxo passa a ter:

- fila/status das atendentes;
- validacao de horario;
- rotas de remarketing;
- execucao manual ou automatica do remarketing.

## Rotas

```txt
GET  /health
GET  /status?memberId=ID_DA_ATENDENTE
POST /status
GET  /status/all
GET  /available?memberId=ID_DA_ATENDENTE
GET  /available?branch=sj&memberId=ID_DA_ATENDENTE
GET  /available?branch=ph&memberId=ID_DA_ATENDENTE
GET  /direct-available?memberId=ID_DA_ATENDENTE
GET  /queue
GET  /queue?branch=sj
GET  /queue?branch=ph
GET  /remarketing/health
POST /remarketing/tick
POST /remarketing/run-phone
```

## Variaveis no Railway

```txt
STATUS_API_KEY=crie-uma-senha-forte
DATA_FILE=/data/status-data.json
```

`STATUS_API_KEY` protege as rotas que alteram ou listam todos os status.
Ela tambem protege as rotas manuais do remarketing.

Para ativar o remarketing dentro desta mesma aplicacao, configure tambem:

```txt
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
UMBLER_API_BASE_URL=https://app-utalk.umbler.com/api
UMBLER_API_TOKEN=
UMBLER_ORGANIZATION_ID=
STATUS_API_BASE_URL=https://utalk-status-webhook-production.up.railway.app
STATUS_API_KEY=mesma-chave-usada-no-status
REMARKETING_EXECUTE=true
REMARKETING_WORKER_ENABLED=true
REMARKETING_WINDOW_MINUTES=7
REMARKETING_POLL_MS=10000
REMARKETING_MAX_LEADS_PER_TICK=20
REMARKETING_LOOKBACK_DAYS=14
REMARKETING_CREATED_AFTER=2026-06-05T00:00:00Z
REMARKETING_REQUIRE_CREATED_AFTER=true
REMARKETING_CHANNEL_ID=ZwWSUqYuIZ8I3hxt
REMARKETING_TEMPLATE_ID=aiKrlq1GnW5qf0XK
REMARKETING_TEMPLATE_FILE_ID=aiMIVYll8KEm3xcn
REMARKETING_TEMPLATE_PARAM_2=
REMARKETING_SEND_PRIVATE_NOTE=true
REMARKETING_EVENTS_TABLE=remarketing_7min_events
```

Se `REMARKETING_WORKER_ENABLED=false`, o remarketing fica disponivel apenas para teste manual pelas rotas.

## Como o fluxo consulta

Para consultar apenas o status salvo de uma atendente:

```txt
GET https://SEU-DOMINIO.up.railway.app/status?memberId=ID_DA_ATENDENTE
```

Resposta:

```json
{
  "memberId": "ID_DA_ATENDENTE",
  "available": true,
  "status": "available"
}
```

Para a fila circular do fluxo, use:

```txt
GET https://SEU-DOMINIO.up.railway.app/available?memberId=ID_DA_ATENDENTE
```

Essa rota retorna:

- `200` quando a atendente pode receber e e a vez dela.
- `409 Conflict` quando o fluxo deve pular para a proxima atendente.

O `409` aparece no historico da Umbler, mas nao quebra o atendimento. Ele e o sinal usado pelo card de webhook para seguir pelo caminho de falha e testar a proxima atendente.

Para as unidades de Sao Jose e Palhoca, informe a unidade na URL:

```txt
GET https://SEU-DOMINIO.up.railway.app/available?branch=sj&memberId=ID_DA_ATENDENTE
GET https://SEU-DOMINIO.up.railway.app/available?branch=ph&memberId=ID_DA_ATENDENTE
```

Filas configuradas:

- `main`: Bruna -> Isa -> Julia -> Kenia -> Ana.
- `sj`: Adrielli -> Micheli Maia.
- `ph`: Amanda -> Robson.

Cada fila anda separada. Um atendimento de Palhoca nao interfere na vez de Sao Jose nem na fila principal.

Para casos diretos, sem avancar a fila, use:

```txt
GET https://SEU-DOMINIO.up.railway.app/direct-available?memberId=ID_DA_ATENDENTE
```

Essa rota e indicada para casos como patio/Isa ou cliente que deve voltar para uma atendente especifica se ela estiver disponivel.

## Como a extensao atualiza

```txt
POST https://SEU-DOMINIO.up.railway.app/status
Header: X-API-Key: STATUS_API_KEY
Body: { "memberId": "ID_DA_ATENDENTE", "available": false }
```

Para voltar a receber:

```json
{ "memberId": "ID_DA_ATENDENTE", "available": true }
```

## Persistencia

Por padrao o Dockerfile usa:

```txt
DATA_FILE=/data/status-data.json
```

No Railway, adicione um volume montado em `/data` para manter os status apos redeploy/restart.

## Remarketing na mesma aplicacao

Validar configuracao:

```txt
GET https://SEU-DOMINIO.up.railway.app/remarketing/health
```

Rodar um telefone em modo seguro, sem enviar template:

```txt
POST https://SEU-DOMINIO.up.railway.app/remarketing/run-phone
Header: X-API-Key: STATUS_API_KEY
Body: { "phone": "5548999999999", "execute": false, "force": true }
```

Rodar um ciclo manual:

```txt
POST https://SEU-DOMINIO.up.railway.app/remarketing/tick
Header: X-API-Key: STATUS_API_KEY
Body: { "execute": false }
```

Regras mantidas:

- Cadastro comum usa a fila das atendentes disponiveis.
- Cadastro de patio vai somente para Isa.
- Se o cliente ja abriu conversa depois do cadastro, nao envia mensagem.
- O template usado e `aiKrlq1GnW5qf0XK`.
- Esse template e de imagem, por isso o arquivo `aiMIVYll8KEm3xcn` precisa estar configurado.
- A nota interna nao usa nome do cliente nem a palavra `lead`.
