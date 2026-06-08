# Servidor Railway

O servidor fica em `status-server/server.js`.

URL publica:

```text
https://utalk-status-webhook-production.up.railway.app
```

## O que ele faz

- Guarda se cada atendente esta disponivel.
- Controla a vez da fila.
- Mantem uma fila separada para cada unidade.
- Responde aos webhooks dos fluxos Umbler.
- Roda o remarketing.
- Fornece dados para o painel admin.

## Filas

| Branch | Unidade | Ordem |
|---|---|---|
| `main` | Principal | Bruna -> Isa -> Julia -> Kenia -> Ana |
| `sj` | Sao Jose | Adrielli -> Micheli Maia |
| `ph` | Palhoca | Amanda -> Robson |

## Endpoints principais

| Endpoint | Uso |
|---|---|
| `GET /health` | Ver se o servidor esta online |
| `GET /status?memberId=...` | Ver disponibilidade de uma atendente |
| `POST /status` | Alterar disponibilidade |
| `GET /available?branch=...&memberId=...` | Verificar fila e avancar a vez se for sucesso |
| `GET /direct-available?memberId=...` | Verificar uma atendente sem mexer na fila |
| `GET /queue?branch=sj` | Consultar fila SJ |
| `POST /queue/reset` | Resetar a fila |
| `GET /status/all` | Status e filas para painel admin |
| `GET /remarketing/health` | Estado do remarketing |

## Diferenca entre `/available` e `/direct-available`

`/available` usa fila. Ele so retorna sucesso se a atendente estiver disponivel e for a vez dela.

`/direct-available` nao usa fila. Ele so olha se aquela pessoa esta disponivel. E usado quando o cliente precisa voltar para a dona da etiqueta.

## Variaveis de ambiente

Configure no Railway, sem colocar no Git:

| Variavel | Funcao |
|---|---|
| `STATUS_API_KEY` | Chave usada para chamadas protegidas |
| `DATA_FILE` | Caminho do arquivo persistente de status |
| `UMBLER_API_TOKEN` | Token da Umbler usado pelo remarketing |
| `UMBLER_ORGANIZATION_ID` | Organizacao Umbler |
| `SUPABASE_URL` | URL do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave do Supabase |
| `REMARKETING_*` | Configuracoes do remarketing |

## Deploy

```bash
cd status-server
railway up --detach --service utalk-status-webhook
```

Validar depois do deploy:

```bash
curl "https://utalk-status-webhook-production.up.railway.app/health"
curl "https://utalk-status-webhook-production.up.railway.app/queue?branch=sj" -H "x-api-key: <STATUS_API_KEY>"
```
