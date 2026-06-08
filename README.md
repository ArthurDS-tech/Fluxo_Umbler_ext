# UTalk Atendente e Fluxos Umbler

Sistema para controlar disponibilidade das atendentes, distribuir novos contatos por fila, respeitar etiquetas de dona quando fizer sentido e executar remarketing de clientes do site.

Este repositorio contem tres partes:

- Painel web e extensao da atendente.
- Servidor Railway de status, fila e remarketing.
- Scripts que aplicam e validam os fluxos da Umbler.

## Links principais

- Painel da atendente: `https://utalk-atendente-web.vercel.app/`
- Painel admin: `https://utalk-atendente-web.vercel.app/admin`
- Servidor Railway: `https://utalk-status-webhook-production.up.railway.app`
- Fluxo Principal: `https://app-utalk.umbler.com/settings/chatbots/editor/ahWgp29Q4NlgpyeU`
- Fluxo Sao Jose: `https://app-utalk.umbler.com/settings/chatbots/editor/aiBQZyxNLsXpDDwS`
- Fluxo Palhoca: `https://app-utalk.umbler.com/settings/chatbots/editor/aiAw0vJQCsVttEzC`
- Fluxo Avisos Televendas: `https://app-utalk.umbler.com/settings/chatbots/editor/aUWOP8NnXHj9QjWC`

## Como funciona em palavras simples

1. A atendente entra no painel ou extensao com o token UTalk.
2. Ela marca `Disponivel` ou `Indisponivel`.
3. O Railway guarda esse status.
4. O fluxo da Umbler consulta o Railway antes de transferir um novo atendimento.
5. Se a atendente estiver indisponivel, novos contatos pulam para outra pessoa da fila.
6. Chats atuais nao sao movidos quando a atendente muda status.

## Regra atual das filas

As filas ficam em `status-server/server.js`.

| Unidade | Ordem |
|---|---|
| Principal | Bruna -> Isa -> Julia -> Kenia -> Ana |
| Sao Jose | Adrielli -> Micheli Maia |
| Palhoca | Amanda -> Robson |

Cada unidade tem sua propria fila. Um atendimento de Sao Jose nao muda a vez de Palhoca nem a vez da fila Principal.

## Regra atual das etiquetas

As etiquetas antigas continuam no contato. Elas nao sao apagadas, porque fazem parte do historico e ajudam a identificar a dona comercial.

Mas cada fluxo so respeita as etiquetas da sua unidade:

| Fluxo | Etiquetas respeitadas como dona |
|---|---|
| Principal | Cristiane, Ester, Ana, Kenia, Julia, Isa, Bruna |
| Sao Jose | Evylin, Adrielli, Micheli Maia |
| Palhoca | Amanda, Robson |

Exemplo: se um contato entra por Sao Jose com etiqueta antiga `Julia`, o fluxo de Sao Jose nao manda para Julia. Ele ignora essa etiqueta para decisao de rota e segue para a fila SJ.

## Regra de parceiro

Se o contato tem a etiqueta `Parceiro`, o fluxo nao usa etiqueta antiga de atendente para decidir transferencia.

Nesse caso:

- adiciona uma nota interna no chat;
- segue pela fila da unidade;
- mantem as etiquetas antigas no contato.

## Regra de patio

Atendimento de patio continua sendo caso especial.

- Patio vai para Isa.
- Se Isa estiver indisponivel, o atendimento fica no esperando dela.

## Sobre o erro 409 no historico

O `409 Conflict` no historico do fluxo e esperado.

Ele significa:

```text
Essa atendente nao deve receber agora. Pule para a proxima.
```

Quando a pessoa correta da fila responde com sucesso, o fluxo transfere o atendimento.

## Documentacao

A documentacao principal fica na pasta `docs/`:

- `docs/01-visao-geral.md`: explicacao geral do sistema.
- `docs/02-estrutura-do-projeto.md`: o que existe em cada pasta e arquivo.
- `docs/03-fluxos-umbler.md`: regras dos fluxos Umbler.
- `docs/04-servidor-railway.md`: backend, endpoints e filas.
- `docs/05-extensao-e-painel.md`: painel web, extensao e painel admin.
- `docs/06-remarketing.md`: como o remarketing funciona.
- `docs/07-operacao-e-testes.md`: comandos de validacao e rotina de manutencao.
- `docs/08-problemas-comuns.md`: diagnostico dos erros mais comuns.

## Comandos uteis

Validar JavaScript principal:

```bash
node --check scripts/apply-owner-validation-branch-flows.js
node --check status-server/server.js
node --check admin.js
```

Aplicar os fluxos em modo teste, sem salvar na Umbler:

```bash
UMBLER_API_TOKEN="..." UMBLER_ORGANIZATION_ID="ZQG4wFMHGHuTs59F" node scripts/apply-owner-validation-branch-flows.js --dry-run
```

Aplicar os fluxos de verdade:

```bash
UMBLER_API_TOKEN="..." UMBLER_ORGANIZATION_ID="ZQG4wFMHGHuTs59F" node scripts/apply-owner-validation-branch-flows.js
```

Deploy do servidor Railway:

```bash
cd status-server
railway up --detach --service utalk-status-webhook
```

Consultar fila SJ:

```bash
curl "https://utalk-status-webhook-production.up.railway.app/queue?branch=sj" -H "x-api-key: <STATUS_API_KEY>"
```

## Estado validado

Ultima validacao registrada:

- Fluxo Principal ativo com 0 conexoes quebradas.
- Fluxo Sao Jose ativo com 0 conexoes quebradas.
- Fluxo Palhoca ativo com 0 conexoes quebradas.
- Canal `Particular - Sao Jose` dentro do fluxo SJ.
- Canal `Particular - Palhoca` dentro do fluxo PH.
- Regra de parceiro ativa nos tres fluxos.
- Fila SJ publicada no Railway usando `Adrielli -> Micheli Maia`.
- Fila PH publicada no Railway usando `Amanda -> Robson`.

Mais detalhes em `VALIDACAO_COMPLETA.md`.
