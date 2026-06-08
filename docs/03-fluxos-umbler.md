# Fluxos Umbler

## Fluxos ativos

| Unidade | Bot ID | URL |
|---|---|---|
| Principal | `ahWgp29Q4NlgpyeU` | `https://app-utalk.umbler.com/settings/chatbots/editor/ahWgp29Q4NlgpyeU` |
| Sao Jose | `aiBQZyxNLsXpDDwS` | `https://app-utalk.umbler.com/settings/chatbots/editor/aiBQZyxNLsXpDDwS` |
| Palhoca | `aiAw0vJQCsVttEzC` | `https://app-utalk.umbler.com/settings/chatbots/editor/aiAw0vJQCsVttEzC` |

## Canais por fluxo

### Principal

- Fpolis e canais principais.
- Inclui `Particular - Florianopolis`.

### Sao Jose

- `SJ - Adrielli`
- `SJ - Micheli`
- canal SJ extra
- `Particular - Sao Jose`

### Palhoca

- `PH - Amanda`
- `PH - Robson`
- canal PH extra
- `Particular - Palhoca`

## Ordem de decisao

1. Se tiver etiqueta `Parceiro`, anota no chat e segue para fila da unidade.
2. Se tiver etiqueta de dona valida daquela unidade, tenta voltar para ela.
3. Se a dona nao estiver disponivel, segue para a fila da unidade.
4. Se nao tiver etiqueta valida, segue para a fila da unidade.
5. Patio vai para Isa, mesmo se ela estiver indisponivel.

## Etiquetas respeitadas por unidade

| Unidade | Etiquetas |
|---|---|
| Principal | Cristiane, Ester, Ana, Kenia, Julia, Isa, Bruna |
| Sao Jose | Evylin, Adrielli, Micheli.M |
| Palhoca | Amanda, Robson |

## Por que separar por unidade

Antes, um cliente de Sao Jose com etiqueta antiga `Julia` podia voltar para Julia. Isso confundia a equipe, porque o cliente entrava por um canal SJ.

Agora, se o cliente entra por Sao Jose, o fluxo so respeita as donas de Sao Jose. Etiquetas de outras unidades continuam no contato, mas nao decidem a rota.

## Cards tecnicos importantes

| Card | Funcao |
|---|---|
| `aiPartnerGate001` | Verifica etiqueta `Parceiro` |
| `aiPartnerNote001` | Nota interna para parceiro |

## Notas visuais no editor

Os tres fluxos tambem possuem cards de comentario dentro do editor da Umbler.

Esses cards nao transferem, nao etiquetam, nao enviam mensagem e nao mudam o caminho do cliente. Eles servem apenas para documentar o que cada area faz.

Areas documentadas:

- entrada do cliente;
- cliente parceiro;
- cliente com atendente marcada;
- fila da unidade;
- veiculo apreendido ou patio;
- coleta do servico;
- esperando;
- fora do horario.

Script usado para aplicar ou atualizar essas notas:

```bash
UMBLER_API_TOKEN="..." UMBLER_ORGANIZATION_ID="ZQG4wFMHGHuTs59F" node scripts/apply-flow-comment-notes.js
```
| `ahWHlp-bJKqv3Z25` | Verifica se existe etiqueta de dona valida |
| `aiK87hUbFkASONgq` | Inicio da fila normal |

## Como aplicar mudancas nos fluxos

Modo teste:

```bash
UMBLER_API_TOKEN="..." UMBLER_ORGANIZATION_ID="ZQG4wFMHGHuTs59F" node scripts/apply-owner-validation-branch-flows.js --dry-run
```

Salvar na Umbler:

```bash
UMBLER_API_TOKEN="..." UMBLER_ORGANIZATION_ID="ZQG4wFMHGHuTs59F" node scripts/apply-owner-validation-branch-flows.js
```

O script gera backup em `backups/` antes de salvar.
