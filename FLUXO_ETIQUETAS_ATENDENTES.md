# Fluxo por etiqueta da atendente

Data: 2026-06-05

## Regra correta

O fluxo nao deve ser aleatorio.

Quando o cliente ja tem etiqueta de uma atendente:

- Se a atendente da etiqueta estiver disponivel, o cliente deve voltar para ela.
- Se a atendente da etiqueta estiver indisponivel, em almoco ou fora do horario, o cliente deve cair na fila normal.
- Se o cliente nao tiver etiqueta de atendente, o cliente deve cair na fila normal.
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

## Limpeza de etiquetas

Antes de adicionar a etiqueta da atendente que recebeu o cliente, remover as cinco etiquetas de atendente:

- Ana: `aRcUrulTi7VLdefG`
- Bruna: `aRcU4SUhmYerxbuc`
- Isa: `aRcX9elTi7VLfbiN`
- Julia: `aRcUv3AZQLndGPqS`
- Kenia: `aRcVICUhmYerxl6F`

Depois disso, adicionar somente a etiqueta da atendente que recebeu o cliente.

Assim o cliente sempre fica com uma unica dona atual.

## Resultado esperado

Exemplo com cliente da Kenia:

- Kenia disponivel: transfere para Kenia, mesmo que a proxima da fila seja outra atendente.
- Kenia indisponivel: cai na fila normal e vai para a proxima atendente disponivel.
- Depois da transferencia: remove etiquetas antigas e deixa somente a etiqueta da atendente que ficou com o cliente.

## Observacao sobre API

A API de leitura da Umbler confirmou os cards e ids acima.

A gravacao direta via API recusou o payload exportado com erro:

```text
No initial event step was found
```

Por seguranca, o fluxo ativo nao foi sobrescrito por tentativa. O ajuste deve ser aplicado pelo editor visual da Umbler ou por um payload de editor confirmado pela propria plataforma.
