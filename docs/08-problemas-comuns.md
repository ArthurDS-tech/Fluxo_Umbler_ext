# Problemas comuns

## Aparece `409 Conflict` no historico

Isso e esperado.

O fluxo usa o retorno `409` para pular uma atendente que nao deve receber naquele momento.

So vira problema se todas retornarem `409` e o chat nao cair em nenhuma espera.

## Cliente de SJ caiu em Julia ou Bruna

Isso acontecia quando o fluxo de SJ aceitava etiqueta antiga de outra unidade.

Regra atual:

- SJ so respeita Evylin, Adrielli e Micheli Maia.
- Etiquetas Julia/Bruna continuam no contato, mas nao decidem rota em SJ.

## Cliente de PH caiu em Bruna

Isso acontecia quando PH aceitava etiqueta antiga de outra unidade.

Regra atual:

- PH so respeita Amanda e Robson.
- Etiqueta Bruna nao decide rota em PH.

## Parceiro esta com varias etiquetas

Isso e normal.

Parceiro pode falar com varias atendentes. Por isso, se o contato tem etiqueta `Parceiro`, o fluxo nao usa etiqueta antiga de atendente para decidir rota. Ele adiciona nota interna e manda para a fila da unidade.

## Atendente mudou para disponivel e chats sairam do esperando

Esse comportamento foi removido.

Atualmente, a extensao e o painel web nao movem chats atuais. Eles so alteram se a atendente recebe novos contatos.

## Fluxo nao executou em um canal

Verifique se o canal esta em algum fluxo ativo.

Hoje:

- `Particular - Sao Jose` precisa estar no fluxo SJ.
- `Particular - Palhoca` precisa estar no fluxo PH.
- `Particular - Florianopolis` fica no fluxo Principal.

## Micheli nao recebe na fila SJ

Confirmar se o Railway esta com o ID de Micheli Maia atual.

Fila correta:

```text
Adrielli -> Micheli Maia
```

Se aparecer `MICHELI` antigo, redeploy do `status-server`.

## Remarketing nao envia

Conferir:

- `/remarketing/health`;
- se o worker esta habilitado;
- se `REMARKETING_EXECUTE=true`;
- se o cadastro esta dentro da janela;
- se nao existe conversa depois do cadastro;
- se o template esta correto.
