# Visao geral

Este projeto resolve a distribuicao de atendimentos da Umbler Talk.

O objetivo e simples:

- a atendente escolhe se esta disponivel;
- novos contatos so caem em quem esta disponivel;
- a fila respeita a ordem combinada;
- cada unidade tem fila independente;
- clientes especiais, como patio e parceiro, seguem regras proprias.

## Componentes

| Parte | Funcao |
|---|---|
| Painel web | A atendente marca Disponivel ou Indisponivel pelo navegador |
| Extensao | Faz a mesma coisa que o painel web, direto no Chrome/Edge |
| Painel admin | Mostra filas, status das atendentes e chats em esperando |
| Railway | Guarda status, controla fila e roda remarketing |
| Umbler | Executa o fluxo, chama o Railway e transfere os chats |
| Supabase | Banco consultado pelo remarketing |

## Fluxo de um novo contato

```text
Cliente chama no WhatsApp
        |
        v
Umbler inicia o fluxo do canal
        |
        v
Fluxo verifica se e Parceiro ou Patio
        |
        v
Fluxo verifica etiqueta valida da unidade
        |
        v
Se nao tiver dona valida, consulta a fila Railway
        |
        v
Transfere para a atendente correta
        |
        v
Adiciona etiqueta e coloca em esperando
```

## Pontos importantes

- Mudar para indisponivel nao move chats atuais.
- Mudar para disponivel nao tira chats do esperando.
- O fluxo pode mostrar `409 Conflict` no historico. Isso e esperado na fila.
- Etiquetas antigas nao sao apagadas.
- Em SJ/PH, etiquetas de outra unidade nao decidem transferencia.
