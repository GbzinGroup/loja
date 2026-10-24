# Correções gerais — Pix, solicitações e responsividade

- O histórico da conta agora inclui o filtro para pagamentos Pix de pedidos.
- Solicitações antigas marcadas como `approved` não são apresentadas como Pix confirmado quando não há registro de conferência.
- O painel administrativo ganhou uma ação explícita de conferência de Pix, com confirmação manual e trilha de auditoria.
- O texto para o cliente esclarece que informar pagamento não cria pedido nem confirma recebimento.
- A solicitação de checkout passa a guardar os itens estruturados para facilitar a conferência/processamento pela equipe.
- Ajustes responsivos para o histórico e a área de carteira.

## Limitação importante

A confirmação é manual. Este front-end ainda não cria automaticamente um pedido final nem entrega produtos após a conferência; isso precisa ser concluído pela equipe ou implementado com backend confiável e integração de pagamento.
