# Validacao completa - UTalk Atendente e fluxo

Data: 2026-06-05

Ultima revalidacao: 2026-06-05 12:51 BRT.

Revalidacao da integracao Railway/remarketing: 2026-06-05 12:56 BRT.

## Resultado geral

Validado com sucesso:

- Painel web da atendente publicado em `https://utalk-atendente-web.vercel.app/`.
- Extensao do navegador com login salvo de forma permanente.
- Servidor de status/fila online.
- Fluxo Umbler ativo e sem conexoes quebradas.
- Remarketing lendo todas as tabelas de clientes.
- Regra de patio indo para Isa.
- Regra comum indo pela fila das atendentes disponiveis.

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

Estado validado:

- Bruna indisponivel.
- Ana indisponivel.
- Isa disponivel.
- Julia disponivel.
- Kenia disponivel.

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

Bloqueio atual para ficar publico:

- O token Railway disponivel retornou `Unauthorized`.
- Sem token Railway valido, nao foi possivel executar o redeploy do mesmo servico na URL publica.

## Fluxo Umbler

Fluxo:

```text
https://app-utalk.umbler.com/settings/chatbots/editor/ahWgp29Q4NlgpyeU
```

Validacoes feitas por API:

- Fluxo ativo.
- Total de cards: 154.
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
