# UTalk Atendente - Extensao de Disponibilidade

Extensao para Chrome/Edge e painel web simples para controlar quais atendentes podem receber novos atendimentos no fluxo da Umbler Talk.

O sistema usa:

- Extensao do navegador para a atendente marcar `Disponivel` ou `Indisponivel`.
- Backend Railway para guardar disponibilidade e controlar a fila.
- Fluxo Umbler para consultar a fila e transferir para a atendente correta.
- Painel Vercel como alternativa fora da extensao.

## Estado Atual

Validado em 2026-06-05:

- Fluxo Umbler ativo.
- 159 cards no fluxo.
- 0 conexoes quebradas.
- Todas as atendentes estao disponiveis na fila.
- Extensao com login permanente.
- ID da organizacao ja preenchido: `ZQG4wFMHGHuTs59F`.
- Repositorios GitHub publicados.
- Conversas transferidas agora entram em `esperando` depois da etiqueta da atendente.

## Como Funciona

```text
Atendente clica Indisponivel
        |
        v
Extensao salva available=false no backend Railway
        |
        v
Fluxo Umbler pula essa atendente nos novos contatos
        |
        v
Chats atuais continuam com a mesma atendente
```

Quando a atendente volta para `Disponivel`, a extensao salva `available=true` no Railway e ela volta a entrar na fila.

## Ordem da Fila

A ordem da fila fica no backend Railway em `status-server/server.js`:

```text
BRUNA -> ISA -> JULIA -> KENIA -> ANA
```

IDs usados:

| Atendente | Member ID |
|---|---|
| Bruna | `ZzUQwM9nj2l-H5hc` |
| Isa | `ZaZlLHFmogpzC4xO` |
| Julia | `ZoWIY_xoe7uoAAFQ` |
| Kenia | `Z26n85VVIK64B6I2` |
| Ana | `ZaZkfnFmogpzCidw` |

## Sobre o 409 Conflict

O `409 Conflict` que aparece no historico do fluxo **nao quebra o atendimento**.

Ele e usado de forma controlada para dizer ao fluxo:

```text
Essa atendente nao deve receber agora. Pule para a proxima.
```

Exemplo esperado:

```text
Bruna -> 409: pula para Isa
Isa -> 409: pula para Julia
Julia -> 409: pula para Kenia
Kenia -> 200: transfere para Kenia
```

O cliente continua seguindo normalmente. Para remover esse texto visual do historico, seria necessario redesenhar a logica dos cards de fila na Umbler. Nao basta mudar o backend para retornar `200`, porque isso faria o fluxo transferir para a atendente errada.

## Extensao

Arquivos principais:

```text
browser-extension/
├── manifest.json
├── popup.html
├── popup.js
└── content.js
```

Tambem existe um `manifest.json` na raiz para permitir carregar a pasta inteira no Chrome.

### Instalar

1. Abra `chrome://extensions`.
2. Ative o modo do desenvolvedor.
3. Clique em `Carregar sem compactacao`.
4. Selecione a pasta da extensao.

Pasta pronta local:

```text
C:\Users\arthur.schuster\Downloads\utalk-atendente-extensao-pronta
```

Zip local:

```text
C:\Users\arthur.schuster\Downloads\utalk-atendente-extensao.zip
```

### Login

A atendente precisa colar somente o token da Umbler Talk.

O ID da organizacao ja vem preenchido:

```text
ZQG4wFMHGHuTs59F
```

O login fica salvo permanentemente no `chrome.storage.local`. A extensao so pede login de novo se a atendente clicar em `Sair`, remover a extensao ou limpar os dados da extensao no navegador.

## Painel Web

URL publicada:

```text
https://utalk-atendente-web.vercel.app/
```

O painel usa a mesma regra da extensao e tambem mantem sessao salva no navegador.

## Painel Admin

URL publicada:

```text
https://utalk-atendente-web.vercel.app/admin
```

O painel admin e separado do painel da atendente. Ele nao altera chats nem filas; apenas consulta e mostra:

- total de chats abertos;
- total de clientes em `esperando`;
- contagem de esperando por unidade;
- fila atual de Florianopolis, Sao Jose e Palhoca;
- proxima atendente de cada fila;
- status disponivel/indisponivel das atendentes;
- clientes em esperando com unidade, atendente, canal, tempo de espera, ultima mensagem e etiquetas.
- relatorio CSV dos clientes em esperando;
- resumo copiavel para acompanhamento;
- impressao da tela;
- filtro para ocultar grupos internos.

O token Umbler usado no painel fica salvo somente no navegador.

## Backend Railway

URL:

```text
https://utalk-status-webhook-production.up.railway.app
```

Endpoints principais:

```text
GET /health
GET /status?memberId=ID_DA_ATENDENTE
POST /status
GET /available?memberId=ID_DA_ATENDENTE
GET /available?branch=sj&memberId=ID_DA_ATENDENTE
GET /available?branch=ph&memberId=ID_DA_ATENDENTE
GET /direct-available?memberId=ID_DA_ATENDENTE
GET /queue
GET /queue?branch=sj
GET /queue?branch=ph
POST /queue/reset
```

`/available` controla a fila circular. Quando retorna sucesso, a vez da fila avanca.

`/direct-available` verifica apenas se uma atendente especifica esta disponivel, sem avancar a fila. E usado para casos como pátio/Isa ou cliente que deve voltar para uma atendente dona.

Filas por unidade:

- `main`: Bruna -> Isa -> Julia -> Kenia -> Ana.
- `sj`: Adrielli -> Micheli.
- `ph`: Amanda -> Robson.

Cada unidade tem sua propria vez da fila. Um atendimento de Sao Jose nao muda a vez de Palhoca e nao muda a vez da fila principal.

## Fluxo Umbler

URL:

```text
https://app-utalk.umbler.com/settings/chatbots/editor/ahWgp29Q4NlgpyeU
```

Validacoes feitas:

- Fluxo ativo.
- 159 cards.
- 0 conexoes quebradas.
- Gatilhos manuais de teste presentes:
  - `Teste Codex Fila`
  - `Teste Codex Patio`
- Webhooks de fila presentes.
- Transferencias para as cinco atendentes presentes.
- Pátio direcionado para Isa.

Fluxos duplicados para unidades:

- Sao Jose: `https://app-utalk.umbler.com/settings/chatbots/editor/aiBQZyxNLsXpDDwS`
  - Canais: `SJ - Adrielli` e `SJ - Micheli`.
  - Fila: Adrielli -> Micheli.
  - Etiquetas: Adrielli e Micheli.
- Palhoca: `https://app-utalk.umbler.com/settings/chatbots/editor/aiAw0vJQCsVttEzC`
  - Canais: `PH - Amanda` e `PH - Robson`.
  - Fila: Amanda -> Robson.
  - Etiquetas: Amanda e Robson.

Os dois fluxos usam a mesma estrutura do fluxo principal, mas chamam o backend com `branch=sj` ou `branch=ph` para manter as filas separadas.

## Etiquetas de Atendente

As etiquetas definem quem e a dona atual do cliente:

| Atendente | Etiqueta |
|---|---|
| Ana | `aRcUrulTi7VLdefG` |
| Bruna | `aRcU4SUhmYerxbuc` |
| Isa | `aRcX9elTi7VLfbiN` |
| Julia | `aRcUv3AZQLndGPqS` |
| Kenia | `aRcVICUhmYerxl6F` |
| Adrielli | `aRcXOulTi7VLe25M` |
| Micheli | `aRcXlpId9HOMVvSO` |
| Amanda | `aRcc7SUhmYer23sK` |
| Robson | `aRcc0yUhmYer2zTn` |

Regra planejada:

- Cliente com etiqueta da atendente volta para ela se ela estiver disponivel.
- Se ela estiver indisponivel, cai na fila normal.
- Cliente sem etiqueta cai na fila normal.
- Pátio vai para Isa. Se Isa estiver indisponivel, fica no esperando dela.

Mais detalhes em `FLUXO_ETIQUETAS_ATENDENTES.md`.

Validacao aplicada no fluxo principal, Sao Jose e Palhoca:

- Principal valida etiquetas nesta ordem: Ana -> Kenia -> Julia -> Isa -> Bruna.
- Sao Jose valida etiquetas nesta ordem: Adrielli -> Micheli -> Amanda -> Robson -> Ana -> Isa -> Julia -> Kenia -> Bruna.
- Palhoca valida etiquetas nesta ordem: Amanda -> Robson -> Adrielli -> Micheli -> Ana -> Isa -> Julia -> Kenia -> Bruna.
- O card de entrada primeiro pergunta se o cliente ja tem etiqueta de atendente.
- Se a dona da etiqueta estiver disponivel, o fluxo transfere direto para ela e marca a conversa como `esperando`.
- Se a dona da etiqueta nao estiver disponivel, o fluxo continua ate cair na fila normal da unidade.
- Cliente sem etiqueta cai direto na fila normal.
- Validacao por API em 2026-06-08: fluxo principal ativo com 179 cards, Sao Jose e Palhoca ativos com 199 cards cada, 0 conexoes quebradas e todos os webhooks/transferencias apontando para as atendentes corretas.

## Esperando Apos Transferencia

Depois da transferencia para uma atendente, o fluxo adiciona a etiqueta da atendente e em seguida marca a conversa como `esperando`.

Esse ajuste garante que a conversa apareca no esperando da atendente depois da transferencia.

Cards novos:

| Atendente | Etiqueta | Esperando |
|---|---|---|
| Ana | `ahW9pz7NmL8V5lza` | `aiMWaitAna000001` |
| Isa | `ahW-vaPXazLflJNR` | `aiMWaitIsa000001` |
| Julia | `ahW-zsCLa1_pRkJi` | `aiMWaitJul000001` |
| Bruna | `ahW-3ljj7yv7AP6i` | `aiMWaitBru000001` |
| Kenia | `ahW-7_eIZfuAoxC5` | `aiMWaitKen000001` |

## Fluxo de Avisos Televendas

URL:

```text
https://app-utalk.umbler.com/settings/chatbots/editor/aUWOP8NnXHj9QjWC
```

Titulo:

```text
*** FLUXO AVISOS TELEVENDAS ***
```

Esse fluxo estava inativo e permaneceu inativo apos a migracao.

Validacao apos migracao:

- 84 cards.
- 0 conexoes quebradas.
- 5 transferencias migradas.
- 25 cards novos para etiquetar a atendente correta.

Regra aplicada:

```text
Transferir para grupo de atendentes
        |
        v
Verificar qual atendente recebeu
        |
        v
Adicionar etiqueta da atendente
        |
        v
Voltar para o mesmo caminho original do fluxo
```

Etiquetas usadas:

| Atendente | Etiqueta |
|---|---|
| Ana | `aRcUrulTi7VLdefG` |
| Isa | `aRcX9elTi7VLfbiN` |
| Julia | `aRcUv3AZQLndGPqS` |
| Bruna | `aRcU4SUhmYerxbuc` |
| Kenia | `aRcVICUhmYerxl6F` |

## Remarketing

O motor de remarketing esta preparado dentro do `status-server/remarketing/remarketing-flow.js`.

Regras:

- Le todas as tabelas de clientes configuradas.
- Nao envia para cliente que ja abriu conversa depois do cadastro.
- Usa o template aprovado `aiKrlq1GnW5qf0XK`.
- Cliente comum entra pela fila Railway.
- Pátio vai para Isa.
- Nota interna nao mostra nome do cliente e nao usa a palavra `lead`.

Observacao: as rotas de remarketing dependem de redeploy do Railway para ficarem publicas na URL atual.

## Validacao Rapida

Validar JavaScript:

```bash
node --check app.js
node --check browser-extension/popup.js
node --check api/status.js
node --check api/utalk.js
node --check status-server/server.js
node --check status-server/remarketing/remarketing-flow.js
```

Conferir fila:

```bash
curl -H "X-API-Key: utalk-status-2026-railway" \
  https://utalk-status-webhook-production.up.railway.app/queue
```

## Repositorios

Projeto completo:

```text
https://github.com/ArthurDS-tech/Fluxo_Umbler_talk.git
```

Extensao separada:

```text
https://github.com/ArthurDS-tech/Fluxo_Umbler_ext.git
```
