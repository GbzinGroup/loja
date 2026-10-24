# Atualização de perfil, afiliados e visibilidade

- Removido o aviso solicitado do histórico de transações.
- Adicionado atalho Afiliados na navegação do perfil.
- Melhorados limites, autocomplete e feedback ao salvar o nome do perfil.
- Atribuição de indicação persistida por até 30 dias quando o navegador permite armazenamento local.
- Evita solicitações de parceria duplicadas quando já há uma solicitação pendente/aprovada/ativa.
- Adicionados canonical, Open Graph, Twitter Cards, JSON-LD OnlineStore, robots.txt, sitemap.xml e conteúdo HTML inicial.

## Limites importantes
O front-end registra o código de indicação para revisão, mas não deve creditar comissões automaticamente. Para rastreamento confiável e comissões reais, a criação do pedido e a confirmação do pagamento precisam ocorrer em backend confiável com validação anti-fraude e operações idempotentes.
