# Operacao e testes

## Validar codigo local

```bash
node --check scripts/apply-owner-validation-branch-flows.js
node --check status-server/server.js
node --check admin.js
```

## Validar fluxos sem salvar

```bash
UMBLER_API_TOKEN="..." UMBLER_ORGANIZATION_ID="ZQG4wFMHGHuTs59F" node scripts/apply-owner-validation-branch-flows.js --dry-run
```

O resultado esperado:

- `missingRefs: 0`;
- fluxo Principal ativo;
- fluxo SJ ativo;
- fluxo PH ativo.

## Salvar fluxos na Umbler

```bash
UMBLER_API_TOKEN="..." UMBLER_ORGANIZATION_ID="ZQG4wFMHGHuTs59F" node scripts/apply-owner-validation-branch-flows.js
```

Depois de salvar, conferir os fluxos no editor da Umbler.

## Validar Railway

```bash
curl "https://utalk-status-webhook-production.up.railway.app/health"
```

Consultar filas:

```bash
curl "https://utalk-status-webhook-production.up.railway.app/queue?branch=main" -H "x-api-key: <STATUS_API_KEY>"
curl "https://utalk-status-webhook-production.up.railway.app/queue?branch=sj" -H "x-api-key: <STATUS_API_KEY>"
curl "https://utalk-status-webhook-production.up.railway.app/queue?branch=ph" -H "x-api-key: <STATUS_API_KEY>"
```

Resetar uma fila:

```bash
curl -X POST "https://utalk-status-webhook-production.up.railway.app/queue/reset" \
  -H "x-api-key: <STATUS_API_KEY>" \
  -H "content-type: application/json" \
  --data '{"branch":"sj","memberId":"ZrzsX_BLm_zYqujY"}'
```

## Deploy Railway

```bash
cd status-server
railway up --detach --service utalk-status-webhook
```

## Deploy Vercel

O painel web usa Vercel.

```bash
npx vercel --prod
```

## Checklist depois de qualquer mudanca

- Conferir `node --check`.
- Rodar dry-run dos fluxos.
- Salvar na Umbler so se `missingRefs` for 0.
- Conferir `/health` no Railway.
- Conferir filas `main`, `sj` e `ph`.
- Abrir o painel da atendente.
- Abrir o painel admin.
- Testar um chat por unidade quando possivel.
