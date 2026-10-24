# Correção de índice Firestore e erro `state is not defined`

- O histórico financeiro consulta transações por `userId` e ordena localmente por `createdAt`, evitando depender do índice composto `userId + createdAt`.
- A área de sistemas usa a mesma estratégia para o resumo de transações.
- Os manipuladores globais de aprovação de códigos e recompensas agora obtêm o UID administrativo de `auth.currentUser`, em vez de referenciar a variável local `state` fora de escopo.
- Verificação de sintaxe executada com `node --check` nos módulos JavaScript alterados.

Observação: as permissões de leitura/gravação continuam dependendo das regras do Firestore publicadas no projeto Firebase.
