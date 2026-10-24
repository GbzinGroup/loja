# Correções de Toast, cadastro e códigos promocionais

- Corrigida a consulta dos toasts de entrada, da central de notificações e da área de sistemas para não exigir índice composto `userId + createdAt`: consulta por `userId`, ordena localmente por data e limita os itens exibidos.
- Melhorado o tratamento de `auth/email-already-in-use`: o usuário é encaminhado para entrar com o e-mail preenchido e recebe uma mensagem clara, sem tratar uma conta existente como falha inesperada.
- Melhorada a validação de códigos promocionais com mensagens específicas para código, descrição, limite de usos e valor da recompensa.
- Aceita valor monetário digitado com vírgula ou ponto. Para recompensa manual, o campo de valor é desabilitado e salvo como zero; para pontos, exige valor inteiro.
- Verificação de sintaxe JavaScript realizada com `node --check` nos módulos alterados.

Observação: não foi possível testar contra o projeto Firebase de produção nesta sessão. Se `failed-precondition` persistir em outra consulta, consulte a mensagem completa do Firebase Console para identificar se é índice, transação ou pré-condição diferente.
