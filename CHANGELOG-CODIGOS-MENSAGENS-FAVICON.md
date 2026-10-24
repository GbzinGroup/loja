# Gbzin Shop — códigos, mensagens e favicon

- Favicon e ícones PWA recoloridos para azul elétrico, preservando transparência.
- Nova aba administrativa “Códigos promocionais” para criar, listar, pausar e reativar códigos com validade e limite de resgates.
- Resgate do cliente valida código ativo, validade e limite; cria solicitação pendente, sem conceder benefício no navegador.
- Aprovação de resgates usa transação Firestore para conferir e incrementar o contador de usos.
- Perfil do usuário ganhou aba própria “Mensagens e avisos”, contador de não lidas e ação para marcar como lida.
- Regras Firestore atualizadas para códigos promocionais, resgates e confirmação de leitura das notificações.
- Toasts de entrada continuam vinculados ao usuário autenticado e não bloqueiam o carregamento da loja em caso de falha.

## Publicação

Publique `firestore.txt` no Firebase Console em Firestore Database → Rules antes de ativar os novos fluxos. Testes reais exigem conta administrativa autorizada e Firebase configurado.
