# UTalk Status Server no Railway

Servico simples para o fluxo da Umbler consultar se uma atendente esta disponivel.

## Rotas

```txt
GET  /health
GET  /status?memberId=ID_DA_ATENDENTE
POST /status
GET  /status/all
```

## Variaveis no Railway

```txt
STATUS_API_KEY=crie-uma-senha-forte
DATA_FILE=/data/status-data.json
```

`STATUS_API_KEY` protege as rotas que alteram ou listam todos os status.

## Como o fluxo consulta

Use no card de Webhook:

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
