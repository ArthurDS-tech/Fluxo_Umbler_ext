# Validacao completa - UTalk Atendente e fluxo

Data: 2026-06-05

Ultima revalidacao: 2026-06-05 12:51 BRT.

Revalidacao da integracao Railway/remarketing: 2026-06-05 12:56 BRT.

Revalidacao final de fila e documentacao: 2026-06-05 14:16 BRT.

Migracao para colocar conversas em esperando apos transferencia: 2026-06-05 14:52 BRT.

Migracao de etiquetas por atendente no fluxo de avisos: 2026-06-05 15:14 BRT.

Duplicacao dos fluxos Sao Jose e Palhoca com filas independentes: 2026-06-05 16:23 BRT.

Atualizacao de parceiro e canal SJ: 2026-06-08 12:45 BRT.

## Resultado geral

Validado com sucesso:

- Painel web da atendente publicado em `https://utalk-atendente-web.vercel.app/`.
- Extensao do navegador com login salvo de forma permanente.
- Servidor de status/fila online.
- Fluxo Umbler ativo e sem conexoes quebradas.
- Remarketing lendo todas as tabelas de clientes.
- Regra de patio indo para Isa.
- Regra comum indo pela fila das atendentes disponiveis.
- Regra de etiqueta da atendente mapeada e documentada.
- Todas as atendentes ativadas como disponiveis por API.
- Comportamento `409 Conflict` documentado como pulo controlado de fila.
- Apos transferir e adicionar etiqueta da atendente, o fluxo agora marca a conversa como `esperando`.
- Fluxo Sao Jose ativo com fila propria Adrielli -> Micheli Maia.
- Fluxo Palhoca ativo com fila propria Amanda -> Robson.
- As filas `main`, `sj` e `ph` nao interferem uma na outra.
- Cliente com etiqueta `Parceiro` agora recebe nota interna e segue pela fila da unidade, sem usar etiqueta antiga de atendente.
- Canal `Particular - Sao Jose` agora esta no fluxo ativo de Sao Jose.

## Extensao e painel da atendente

Arquivos principais:

- `app.js`
- `browser-extension/popup.js`
- `api/status.js`
- `api/utalk.js`

Validacoes feitas:

- Codigo validado com `node --check`.
- Painel publicado no Vercel.
- URL final respondeu `200`.
- `app.js` publicado contem a sessao permanente.
- `browser-extension/popup.js` publicado contem restauracao permanente por `chrome.storage.local`.
- Proxy `/api/status` respondeu corretamente para atendentes disponiveis.

Comportamento do login:

- A atendente faz login uma vez.
- Token, organizacao, membro, nome, status e chats em espera ficam salvos.
- O login nao expira por tempo.
- Ao fechar navegador ou reiniciar computador, continua logado.
- So pede login novamente se clicar em `Sair`, remover a extensao ou limpar manualmente os dados da extensao.

## Servidor de status e fila

URL:

```text
https://utalk-status-webhook-production.up.railway.app
```

Validacoes feitas:

- `/health` respondeu online.
- Horario de atendimento estava aberto.
- `/status?memberId=...` respondeu disponibilidade real.
- `/queue` respondeu a fila com chave de seguranca.

Estado validado na ultima conferencia:

- Bruna disponivel.
- Ana disponivel.
- Isa disponivel.
- Julia disponivel.
- Kenia disponivel.

Fila esperada:

```text
BRUNA -> ISA -> JULIA -> KENIA -> ANA
```

Filas por unidade:

```text
Sao Jose: ADRIELLI -> MICHELI MAIA
Palhoca: AMANDA -> ROBSON
```

Validacao publica das filas por unidade:

- `GET /queue?branch=sj`: respondeu Adrielli e Micheli Maia disponiveis.
- `GET /queue?branch=ph`: respondeu Amanda e Robson disponiveis.
- Simulacao SJ: Adrielli recebeu `200`, a fila avancou para Micheli Maia, repetir Adrielli retornou `409`, Micheli Maia recebeu `200`.
- Simulacao PH: Amanda recebeu `200`, a fila avancou para Robson, repetir Amanda retornou `409`, Robson recebeu `200`.
- Depois do teste, SJ foi resetado para Adrielli e PH foi resetado para Amanda.

Observacao sobre `409 Conflict`:

- O `409` no historico do fluxo nao impede o atendimento.
- Ele e usado pelo webhook `/available` para acionar o caminho de falha do card e pular para a proxima atendente.
- Quando a atendente correta da vez responde `200`, o fluxo transfere o atendimento e adiciona a etiqueta.
- Exemplo validado: Bruna, Isa e Julia retornaram `409`; Kenia retornou sucesso e recebeu o atendimento.

## Remarketing na mesma aplicacao Railway do fluxo

Situacao encontrada na URL publicada:

- `GET /health`: respondeu online.
- `GET /queue`: respondeu com chave de seguranca.
- `GET /remarketing/health`: ainda retorna `404` na URL publicada atual.
- `POST /remarketing/run-phone`: ainda retorna `404` na URL publicada atual.

Conclusao da validacao publica:

- Antes do novo redeploy, a aplicacao Railway publicada contem status/fila, mas ainda nao contem as rotas de remarketing.

O que foi preparado no codigo do mesmo servico Railway:

- O `status-server` agora inclui o motor do remarketing em `status-server/remarketing/remarketing-flow.js`.
- O `status-server/server.js` agora expoe:
  - `GET /remarketing/health`
  - `GET /remarketing/status`
  - `POST /remarketing/tick`
  - `POST /remarketing/run-phone`
- O `Dockerfile` agora copia a pasta `remarketing` para dentro da imagem.
- A `.railwayignore` foi corrigida para nao excluir arquivos essenciais do deploy.
- O `README.md` do `status-server` documenta as variaveis e rotas.

Validacao local da aplicacao integrada:

- `GET /health`: respondeu com bloco `remarketing`.
- `GET /remarketing/health`: respondeu `ok=true`.
- `POST /remarketing/run-phone` com cadastro comum: respondeu `mode=fila_railway`.
- `POST /remarketing/run-phone` com cadastro de patio: respondeu `mode=patio_exclusivo_isa`.
- Template usado: `aiKrlq1GnW5qf0XK`.
- Parametros enviados: 0.
- Arquivo enviado: nenhum.
- Nota interna sem `Nome:`.
- Nota interna sem a palavra `lead`.
- Registros de teste restantes no Supabase: 0.

Situacao publica atual:

- O servico Railway foi redeployado e respondeu `/health`.
- A fila SJ publicada foi validada com Adrielli -> Micheli Maia.

## Fluxo Umbler

Fluxo:

```text
https://app-utalk.umbler.com/settings/chatbots/editor/ahWgp29Q4NlgpyeU
```

Fluxos por unidade:

```text
Sao Jose: https://app-utalk.umbler.com/settings/chatbots/editor/aiBQZyxNLsXpDDwS
Palhoca: https://app-utalk.umbler.com/settings/chatbots/editor/aiAw0vJQCsVttEzC
```

Validacao dos fluxos por unidade:

- Principal ativo.
- Principal com 216 cards e 0 conexoes quebradas.
- Principal valida a dona da etiqueta antes da fila normal.
- Principal valida nesta ordem: Cristiane -> Ester -> Ana -> Kenia -> Julia -> Isa -> Bruna.
- Sao Jose ativo.
- Sao Jose com canais `SJ - Adrielli`, `SJ - Micheli`, canal SJ extra e `Particular - Sao Jose`.
- Sao Jose com 216 cards e 0 conexoes quebradas.
- Sao Jose com webhooks `branch=sj`.
- Sao Jose transfere e etiqueta Adrielli/Micheli Maia.
- Palhoca ativo.
- Palhoca com canais `PH - Amanda` e `PH - Robson`.
- Palhoca com 216 cards e 0 conexoes quebradas.
- Palhoca com webhooks `branch=ph`.
- Palhoca transfere e etiqueta Amanda/Robson.
- Sao Jose e Palhoca validam a dona da etiqueta antes da fila normal.
- Sao Jose valida nesta ordem: Evylin -> Adrielli -> Micheli Maia.
- Palhoca valida nesta ordem: Amanda -> Robson.
- Nos caminhos por etiqueta, o webhook usa `/direct-available`, para nao consumir a vez da fila.
- O card de entrada foi corrigido: com etiqueta vai para a dona; sem etiqueta vai para a fila normal.
- Se a dona da etiqueta estiver disponivel, o atendimento volta para ela e entra em `esperando`.
- Se a dona da etiqueta estiver indisponivel, o fluxo segue para a proxima etiqueta valida da unidade e depois para a fila da unidade.
- Validacao por API em 2026-06-08 confirmou: principal, Sao Jose e Palhoca com 216 cards cada, 0 referencias quebradas, regra de parceiro ativa e transferencias diretas para as atendentes mapeadas.

Validacoes feitas por API:

- Fluxo ativo.
- Total de cards apos migracao: 159.
- Conexoes quebradas: 0.
- Gatilhos manuais de teste presentes:
  - `Teste Codex Fila`
  - `Teste Codex Patio`
- Webhooks de fila encontrados: 5.
- Webhook especial de patio para Isa encontrado: 1.
- Cards de transferencia encontrados: 6.
- Todos os cards de transferencia estao com `onlyMembersAvailable=false`.

Transferencias validadas:

- Bruna: `ZzUQwM9nj2l-H5hc`
- Isa: `ZaZlLHFmogpzC4xO`
- Julia: `ZoWIY_xoe7uoAAFQ`
- Kenia: `Z26n85VVIK64B6I2`
- Ana: `ZaZkfnFmogpzCidw`
- Patio: Isa `ZaZlLHFmogpzC4xO`

Regra de etiqueta da atendente:

- O fluxo ja possui verificacoes por etiqueta de Ana, Bruna, Isa, Julia e Kenia.
- O comportamento correto foi documentado em `FLUXO_ETIQUETAS_ATENDENTES.md`.
- Cliente com etiqueta deve voltar para a atendente da etiqueta se ela estiver disponivel.
- Se a atendente da etiqueta estiver indisponivel, o cliente deve cair na fila normal.
- As etiquetas antigas de atendente nao sao removidas, pois fazem parte do historico comercial.

Situacao de aplicacao:

- A leitura por API confirmou todos os cards e ids.
- Em 2026-06-08 a gravacao direta por API foi aplicada nos fluxos Principal, Sao Jose e Palhoca com `scripts/apply-owner-validation-branch-flows.js`.
- Os backups do estado anterior ficaram em `backups/`.
- O fluxo principal permanece como referencia da estrutura original.

Organizacao visual dos cards:

- Foi tentado um salvamento sem mudanca funcional para validar a API de edicao.
- A Umbler recusou com erro interno `IncidentId: aiMCH4ll8KEmycea`.
- O fluxo ativo permaneceu intacto: `updatedAtUTC` nao mudou e as conexoes continuaram com 0 referencias quebradas.
- Portanto, a organizacao visual deve ser feita pelo editor visual da Umbler, arrastando os cards, sem alterar webhooks, textos, condicoes ou transferencias.

Migracao aplicada para `esperando` apos transferencia:

- Antes: transferencia para atendente -> adicionava etiqueta -> seguia para `ZQxNip1kTeEJ-ORl`.
- Depois: transferencia para atendente -> adiciona etiqueta -> define `waiting=true` -> segue para `ZQxNip1kTeEJ-ORl`.
- Foram criados 5 cards `SetWaitingStateActionModel`.
- Validacao apos salvar:
  - Fluxo ativo.
  - 159 cards.
  - 0 conexoes quebradas.
  - Snapshot: `Migra transferencias para aguardando apos etiqueta`.

Cards novos:

| Atendente | Card de etiqueta | Card novo de esperando |
|---|---|---|
| Ana | `ahW9pz7NmL8V5lza` | `aiMWaitAna000001` |
| Isa | `ahW-vaPXazLflJNR` | `aiMWaitIsa000001` |
| Julia | `ahW-zsCLa1_pRkJi` | `aiMWaitJul000001` |
| Bruna | `ahW-3ljj7yv7AP6i` | `aiMWaitBru000001` |
| Kenia | `ahW-7_eIZfuAoxC5` | `aiMWaitKen000001` |

## Fluxo de avisos televendas

Fluxo:

```text
https://app-utalk.umbler.com/settings/chatbots/editor/aUWOP8NnXHj9QjWC
```

Titulo:

```text
*** FLUXO AVISOS TELEVENDAS ***
```

Validacao antes da migracao:

- Fluxo inativo, preservado como inativo.
- 34 cards.
- 0 conexoes quebradas.
- 5 cards de transferencia para grupo de atendentes.

Migracao aplicada:

- Depois de cada transferencia, o fluxo agora verifica qual atendente ficou com o chat.
- Se ficou com Ana, adiciona etiqueta `Ana Paula`.
- Se ficou com Isa, adiciona etiqueta `Isabelle`.
- Se ficou com Julia, adiciona etiqueta `Julia`.
- Se ficou com Bruna, adiciona etiqueta `Bruna`.
- Se ficou com Kenia, adiciona etiqueta `Kênia`.
- Depois da etiqueta, o fluxo volta para o mesmo card que ja seguia antes da migracao.

Validacao apos salvar:

- Fluxo continuou inativo.
- Total de cards: 84.
- Conexoes quebradas: 0.
- Snapshot: `Adiciona etiquetas por atendente apos transferencia`.
- Foram criados 25 cards de etiqueta de atendente: 5 transferencias x 5 atendentes possiveis.

Atualizacao em 2026-06-08:

- Os 5 pontos de transferencia do fluxo de avisos deixaram de usar o rodizio interno da Umbler.
- Esses pontos agora usam a fila Railway principal: Bruna -> Isa -> Julia -> Kenia -> Ana.
- Se uma atendente nao estiver disponivel ou estiver fora do horario, o fluxo tenta a proxima da fila.
- Validacao por API confirmou: fluxo com 159 cards, 0 conexoes quebradas e 5 entradas de transferencia usando `/available?memberId=...`.
- O fluxo permanece com o mesmo estado de ativacao que ja estava configurado na Umbler.

## Extensao de disponibilidade

Atualizacao em 2026-06-08:

- A extensao e a pagina web nao alteram mais o campo `waiting` dos chats quando a atendente clica em `Disponivel` ou `Indisponivel`.
- `Indisponivel` agora apenas bloqueia novos atendimentos na fila.
- `Disponivel` agora apenas libera novos atendimentos na fila.
- Os chats que ja estavam em `esperando` continuam em `esperando`.
- Os chats que estavam em atendimento continuam em atendimento.

Transferencias migradas:

| Card de transferencia | Comportamento |
|---|---|
| `aURc9U_Muiw87Klo` | Identifica atendente, etiqueta e volta para `acPtdxu8lud4ONFk` |
| `aURfFLh15w-MSAD2` | Identifica atendente, etiqueta e volta para `acPuHJnKfac5PirK` |
| `aUVRWxqSNap8qUS5` | Identifica atendente, etiqueta e volta para `acPuNc6qvIhVB_KA` |
| `acPZPNfC2blZIjeQ` | Identifica atendente, etiqueta e volta para `acPZS9eSQze0hE9n` |
| `aUU-yfYuYBCA_6KQ` | Identifica atendente, etiqueta e volta para `aUVGrPRdi6aM1kzM` |

Etiquetas usadas:

| Atendente | Etiqueta |
|---|---|
| Ana | `aRcUrulTi7VLdefG` |
| Isa | `aRcX9elTi7VLfbiN` |
| Julia | `aRcUv3AZQLndGPqS` |
| Bruna | `aRcU4SUhmYerxbuc` |
| Kenia | `aRcVICUhmYerxl6F` |

## Remarketing

Pasta:

```text
C:\Users\arthur.schuster\Worspace\Ana\plaas em massa 2\REMARKENTING
```

Tabelas validadas no Supabase:

- `clientes`
- `contatos_site`
- `contatos_site_rota_oculta`
- `whatsapp_popup_telefones`
- `whatsapp_leads`
- `patio_leads`

Template validado:

- Nome: `Template REMARKENTING`
- Status: aprovado.
- Variaveis: 0.
- Arquivo: nenhum.

Regras validadas:

- Cliente comum entra pela fila das atendentes disponiveis.
- Cliente de patio vai somente para Isa.
- Se o cliente ja abriu conversa depois do cadastro, nao envia remarketing.
- Nota interna nao mostra nome do cliente.
- Nota interna nao usa a palavra `lead`.

Testes feitos em modo seguro:

- Cadastro comum de teste criado em `clientes`, processado em modo sem envio e removido.
- Cadastro de patio de teste criado em `patio_leads`, processado em modo sem envio e removido.
- Conferido que ficaram 0 registros de teste no banco.

Ultima rodada segura:

- Cadastro comum: entrou pelo modo `fila_railway` e foi para Julia.
- Cadastro de patio: entrou pelo modo `patio_exclusivo_isa` e foi para Isa.
- Template usado: `aiKrlq1GnW5qf0XK`.
- Parametros enviados: 0.
- Arquivo enviado: nenhum.
- Nota interna sem `Nome:`.
- Nota interna sem a palavra `lead`.
- Registros de teste restantes no Supabase: 0.

## Publicacao

Frontend/painel:

- Deploy Vercel concluido.
- Alias final: `https://utalk-atendente-web.vercel.app/`.

Extensao:

- Arquivos locais atualizados em `browser-extension/`.
- Para usar no navegador, recarregar a extensao em `chrome://extensions`.

Backend de status:

- Servidor atual esta online e respondendo.
- Nao foi necessario alterar a URL do Railway nesta validacao.
