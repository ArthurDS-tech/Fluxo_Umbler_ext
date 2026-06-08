# Fluxo por etiqueta da atendente

Data: 2026-06-05

Atualizado em 2026-06-08: a validacao por dona da etiqueta foi aplicada no fluxo principal e tambem nos fluxos Sao Jose e Palhoca. Clientes com etiqueta `Parceiro` agora entram por uma regra propria antes da etiqueta de atendente.

## Regra correta

O fluxo nao deve ser aleatorio.

Quando o cliente ja tem etiqueta de uma atendente:

- Se a atendente da etiqueta estiver disponivel, o cliente deve voltar para ela.
- Se a atendente da etiqueta estiver indisponivel, em almoco ou fora do horario, o cliente deve cair na fila normal.
- Se o cliente nao tiver etiqueta de atendente, o cliente deve cair na fila normal.
- Se o cliente tiver etiqueta `Parceiro`, o fluxo nao usa etiqueta antiga de atendente. Ele adiciona uma nota interna e segue pela fila da unidade.
- Patio continua sendo caso especial: vai para Isa. Se Isa estiver indisponivel, fica no esperando dela.

## Problema encontrado

O fluxo ja identifica etiquetas de atendente, mas os caminhos por etiqueta ainda chamam a fila comum:

```text
/available?memberId=...
```

Esse endpoint respeita a vez da fila. Por isso um cliente com etiqueta da Kenia pode passar para Julia, Ana ou outra atendente se a Kenia nao for a proxima da fila naquele momento.

Tambem foi encontrado outro ponto: depois da transferencia, o fluxo adiciona a etiqueta da nova atendente, mas nao remove as etiquetas antigas. Isso permite que o mesmo cliente fique com duas etiquetas, por exemplo Kenia e Ana.

## Ajuste necessario no fluxo

Nos caminhos que verificam etiqueta da atendente, trocar a checagem de fila por checagem direta:

```text
De:
https://utalk-status-webhook-production.up.railway.app/available?memberId=ID_DA_ATENDENTE

Para:
https://utalk-status-webhook-production.up.railway.app/direct-available?memberId=ID_DA_ATENDENTE
```

Essa troca deve ser feita somente nos cards que sao acionados por etiqueta de atendente.

Nao trocar os cards da fila normal. A fila normal deve continuar usando:

```text
/available?memberId=...
```

## IDs das atendentes

| Atendente | Member ID | Etiqueta |
|---|---|---|
| Ana | `ZaZkfnFmogpzCidw` | `aRcUrulTi7VLdefG` |
| Bruna | `ZzUQwM9nj2l-H5hc` | `aRcU4SUhmYerxbuc` |
| Isa | `ZaZlLHFmogpzC4xO` | `aRcX9elTi7VLfbiN` |
| Julia | `ZoWIY_xoe7uoAAFQ` | `aRcUv3AZQLndGPqS` |
| Kenia | `Z26n85VVIK64B6I2` | `aRcVICUhmYerxl6F` |
| Adrielli | `ZrzsX_BLm_zYqujY` | `aRcXOulTi7VLe25M` |
| Micheli Maia | `Z5e_UnhziN5VdCCp` | `aRcXlpId9HOMVvSO` |
| Amanda | `ZuGqFp5N9i3HAKOn` | `aRcc7SUhmYer23sK` |
| Robson | `ZaWboNQwFgY3oMeT` | `aRcc0yUhmYer2zTn` |

## Cards de etiqueta encontrados

Estes cards verificam se o cliente tem etiqueta de uma atendente:

| Atendente | Card condicional | Proximo card de verificacao |
|---|---|---|
| Kenia | `ahWaC_aSGnCj6KLn` | `aiK87eLdDNcsTN6K` |
| Julia | `ahWctr3Avs_ml00G` | `aiK87Xpem1468xYn` |
| Ana | `ahW8pF8vO5JoX83a` | `aiK87jS6bwSC8Sr1` |
| Isa | `ahW83cXHup_5iJWn` | `aiK873VOTK54HFF1` |
| Bruna | `ahW9FnK4-0jVxYZy` | `aiK87hUbFkASONgq` |

Cada caminho acima precisa chamar `direct-available` antes de transferir para a dona da etiqueta.

## Fluxo principal, Sao Jose e Palhoca

Os fluxos receberam a mesma regra de dona da etiqueta.

Principal:

- URL: `https://app-utalk.umbler.com/settings/chatbots/editor/ahWgp29Q4NlgpyeU`
- Ordem de validacao: Cristiane -> Ester -> Ana -> Kenia -> Julia -> Isa -> Bruna.
- Se nenhuma dona da etiqueta puder receber, cai na fila principal.

Sao Jose:

- URL: `https://app-utalk.umbler.com/settings/chatbots/editor/aiBQZyxNLsXpDDwS`
- Ordem de validacao: Evylin -> Adrielli -> Micheli Maia.
- Se nenhuma dona da etiqueta puder receber, cai na fila `sj`.

Palhoca:

- URL: `https://app-utalk.umbler.com/settings/chatbots/editor/aiAw0vJQCsVttEzC`
- Ordem de validacao: Amanda -> Robson.
- Se nenhuma dona da etiqueta puder receber, cai na fila `ph`.

Validacao por API em 2026-06-08:

- Principal ativo, 216 cards, 0 conexoes quebradas.
- Sao Jose ativo, 216 cards, 0 conexoes quebradas.
- Palhoca ativo, 216 cards, 0 conexoes quebradas.
- O card de entrada foi corrigido: com etiqueta vai para a dona; sem etiqueta vai para a fila normal.
- Todos os caminhos por etiqueta usam `/direct-available`.
- Todas as transferencias apontam para a atendente correta e depois colocam a conversa em `esperando`.

## Regra de parceiro

Parceiro e um caso diferente, porque pode falar com varias atendentes e carregar etiquetas antigas.

Quando o contato tem a etiqueta `Parceiro`:

- O fluxo adiciona uma nota interna explicando que e parceiro.
- O fluxo nao usa etiqueta antiga de atendente para decidir a transferencia.
- O atendimento vai para a fila da unidade.
- As etiquetas antigas permanecem no contato, porque elas fazem parte do historico comercial.

## Resultado esperado

Exemplo com cliente da Kenia:

- Kenia disponivel: transfere para Kenia, mesmo que a proxima da fila seja outra atendente.
- Kenia indisponivel: cai na fila normal e vai para a proxima atendente disponivel.
- Depois da transferencia: adiciona a etiqueta da atendente responsavel pelo atendimento atual, sem apagar etiquetas antigas.

Exemplo com cliente de Sao Jose com etiqueta antiga Julia:

- O fluxo de Sao Jose nao usa a etiqueta Julia como dona.
- O atendimento segue pela fila de Sao Jose.

## Observacao sobre API

A API de leitura e gravacao da Umbler confirmou os cards e ids acima nos fluxos Principal, Sao Jose e Palhoca.

O script usado para aplicar a regra foi:

```text
scripts/apply-owner-validation-branch-flows.js
```
