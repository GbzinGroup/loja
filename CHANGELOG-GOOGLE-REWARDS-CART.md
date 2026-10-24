# Atualização Gbzin Shop — 23/10/2026

- Login com Google adicionado à tela de autenticação usando Firebase Auth popup.
- Painel de códigos promocionais: recompensa de saldo virtual, pontos ou benefício manual; ativar, pausar e excluir códigos.
- Aprovação de resgate: credita carteira virtual ou pontos e registra trilha de auditoria. Benefício manual permanece para tratamento operacional.
- Painel de mensagens/toasts: excluir comunicados individuais do histórico e da central do destinatário.
- Carrinho e formulário de login refinados visualmente com a paleta navy/azul.
- Regras Firestore ajustadas para os campos necessários.

## Atenção antes de produção
O fluxo de crédito de saldo ainda executa na aplicação cliente com autorização administrativa, portanto depende estritamente de regras corretas e de uma conta administrativa protegida. Para uma loja com saldo de valor real ou conversível, migre créditos para Cloud Functions/servidor confiável com idempotência e auditoria. O saldo é dinheiro virtual interno, não representa pagamento bancário.
- Corrigida a importação explícita de `GoogleAuthProvider` e `signInWithPopup` no módulo principal; o botão de login Google já existia, mas sem esses imports falharia em tempo de execução.
- README ampliado com os passos para configurar o OAuth Client ID no Google Cloud/Firebase, domínios autorizados e lista de administradores.
