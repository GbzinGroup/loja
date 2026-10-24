# Atualizações desta versão

- Redesign visual em azul/ciano sobre fundo navy, com cabeçalho sticky, cards, botões, formulários, tabelas e páginas adaptáveis.
- Marca da Gbzin Shop integrada ao cabeçalho e rodapé; favicon e ícones de aplicação adicionados.
- Novas rotas: Ofertas, Como comprar e Transações.
- Página Ofertas mostra apenas cupons publicados pelo painel e produtos com preço promocional.
- Gestão de cupons: validação, bloqueio de duplicados, ativar/desativar, publicar/ocultar e sincronização com `publicCoupons`.
- Acesso público limitado aos dados dos cupons publicados; a coleção administrativa continua restrita a administradores.
- `src/js/firebase-config.js` preservado.

- Removida a exigência de confirmação de e-mail no cadastro e login.
- Acesso administrativo baseado na lista explícita de e-mails autorizados.
- Regras do Realtime Database atualizadas para não exigir `email_verified` de administradores autorizados.


## Sistema de recompensas persistente (2026-10-23)
- Pontos do cliente agora vêm do campo `customers.rewardPoints`, persistido no Firestore, em vez de um cálculo transitório baseado no gasto.
- Nova aba administrativa `Recompensas`: ajuste de pontos com motivo, catálogo de recompensas, ativar/pausar/excluir e fila de resgates.
- A aprovação de um resgate desconta os pontos numa transação Firestore e grava um registro de auditoria em `pointsLedger`.
- O cliente vê o catálogo ativo, custo, saldo, estado dos resgates e não consegue solicitar item com pontos insuficientes.
- Regras Firestore atualizadas para catálogo, saldo de pontos e auditoria. Publique `firestore.txt` antes de testar.
