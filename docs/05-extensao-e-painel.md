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
