# Extensao, painel web e painel admin

## Painel da atendente

URL:

```text
https://utalk-atendente-web.vercel.app/
```

Funcao:

- login com token UTalk;
- organizacao ja preenchida;
- botao `Disponivel`;
- botao `Indisponivel`;
- sessao salva no navegador.

O painel nao move chats atuais. Ele so altera se a atendente pode receber novos contatos.

## Extensao do navegador

Arquivos fonte:

```text
browser-extension/
```

Pacote pronto:

```text
dist/utalk-atendente-extensao-pronta.zip
```

Pasta pronta:

```text
dist/utalk-atendente-extensao-pronta/
```

## Instalar a extensao

1. Abra `chrome://extensions`.
2. Ative `Modo do desenvolvedor`.
3. Clique em `Carregar sem compactacao`.
4. Selecione a pasta `dist/utalk-atendente-extensao-pronta`.

## Login permanente

A extensao salva:

- token;
- organizacao;
- id da atendente;
- nome;
- ultimo status.

Ela so pede login de novo se:

- clicar em `Sair`;
- remover a extensao;
- limpar os dados da extensao no navegador.

## Painel admin

URL:

```text
https://utalk-atendente-web.vercel.app/admin
```

Mostra:

- total de chats abertos;
- total em esperando;
- esperando por unidade;
- proxima atendente de cada fila;
- status das atendentes;
- tabela de clientes em esperando;
- exportacao CSV;
- resumo copiavel;
- impressao.

O painel admin consulta a Umbler com o token informado no navegador e consulta filas pelo Railway.

## Historico dos atendimentos

URL:

```text
https://utalk-atendente-web.vercel.app/admin/logs
```

Funcao:

- buscar um atendimento pelo link do chat;
- listar atendimentos recentes;
- pesquisar nos recentes por cliente, telefone, unidade ou atendente;
- mostrar cliente, unidade, canal, responsavel atual e situacao;
- mostrar a linha do tempo do atendimento em linguagem simples;
- destacar transferencias, etiquetas, mensagens, notas internas e entrada em esperando;
- mostrar registros do nosso sistema, como decisao da fila, disponibilidade, remarketing e ajustes de fila;
- ao buscar um chat, procurar registros pelo ID do chat e pelo telefone do contato;
- copiar um resumo para conferencias internas;
- imprimir o historico.

Essa pagina usa o mesmo token UTalk informado no navegador. Token, organizacao, ultimo chat digitado e filtro ficam salvos no proprio navegador para nao precisar preencher tudo de novo.

Ela nao muda fluxo, nao transfere atendimento e nao altera etiqueta. Serve apenas para consulta e validacao.

## Mapa do fluxo principal

URL:

```text
https://utalk-atendente-web.vercel.app/admin/fluxo-principal
```

Funcao:

- mostrar o fluxo principal em formato visual;
- explicar cada etapa em linguagem simples;
- mostrar a regra de parceiro, atendente marcada, fila, pátio, servicos e esperando;
- usar cards de nota para orientar pessoas nao tecnicas;
- permitir zoom, arrastar e navegar pelo mapa.

O mapa usa React Flow apenas para visualizacao. Ele nao altera o fluxo da Umbler e nao muda nenhum atendimento.
