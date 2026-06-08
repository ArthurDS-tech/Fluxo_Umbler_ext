# Estrutura do projeto

## Raiz

| Caminho | Para que serve |
|---|---|
| `README.md` | Porta de entrada da documentacao |
| `app.js` | Painel web da atendente |
| `index.html` | Tela do painel web da atendente |
| `styles.css` | Estilo do painel web |
| `admin.html` | Tela do painel admin |
| `admin.js` | Logica do painel admin |
| `admin.css` | Estilo do painel admin |
| `package.json` | Scripts do painel publicado no Vercel |
| `vercel.json` | Configuracao do deploy Vercel |
| `railway.json` | Configuracao raiz usada no deploy |
| `Dockerfile` | Build Docker da aplicacao |
| `FLUXO_ETIQUETAS_ATENDENTES.md` | Historico e regras de etiquetas |
| `VALIDACAO_COMPLETA.md` | Registro de validacoes |

## `api/`

| Arquivo | Funcao |
|---|---|
| `api/status.js` | Proxy do painel web para o Railway |
| `api/utalk.js` | Proxy do painel web para a API da Umbler |

## `browser-extension/`

Arquivos fonte da extensao.

| Arquivo | Funcao |
|---|---|
| `manifest.json` | Manifesto da extensao |
| `popup.html` | Interface da extensao |
| `popup.js` | Login e disponibilidade |
| `content.js` | Conteudo auxiliar |

## `dist/`

Pacotes gerados da extensao.

| Caminho | Funcao |
|---|---|
| `dist/utalk-atendente-extensao-pronta.zip` | Zip pronto para enviar |
| `dist/utalk-atendente-extensao-pronta/` | Pasta pronta para carregar no navegador |
| `dist/browser-extension/` | Build da extensao |

## `scripts/`

Scripts que editam fluxos Umbler via API.

| Arquivo | Funcao |
|---|---|
| `apply-owner-validation-branch-flows.js` | Aplica regra de dona por etiqueta, parceiro, canais e filas por unidade |
| `apply-branch-flows.js` | Script historico de duplicacao SJ/PH |
| `apply-avisos-railway-queue.js` | Ajusta o fluxo de avisos para usar fila Railway e etiquetas |

## `status-server/`

Servidor publicado no Railway.

| Arquivo | Funcao |
|---|---|
| `server.js` | API de status, fila, health e remarketing |
| `package.json` | Script `npm start` |
| `Dockerfile` | Build do servidor |
| `railway.json` | Configuracao Railway |
| `remarketing/remarketing-flow.js` | Motor de remarketing |

## `backups/`

Backups dos fluxos baixados antes de alteracoes.

Esses arquivos servem para auditoria e rollback manual. Eles podem ficar grandes e nao devem receber tokens novos.

## `docs/`

Documentacao operacional do sistema.
