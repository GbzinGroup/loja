# Gbzin Shop — revisão de UI/UX

## Objetivo
Reduzir a poluição visual, tornar a hierarquia mais clara e evitar que conteúdos, controles e tabelas ultrapassem seus contêineres em diferentes tamanhos de tela.

## Alterações
- Padronização de cartões e painéis com menos sombras e contrastes mais consistentes.
- Espaçamentos e títulos ajustados para melhorar a leitura e separar áreas funcionais.
- Foco de teclado visível, controles com altura mínima confortável e estados desabilitados claros.
- Prevenção de overflow horizontal em textos, grids, formulários, abas e contêineres.
- Tabelas mantêm rolagem horizontal dentro do próprio contêiner, sem empurrar a página inteira.
- Painel administrativo, filtros de solicitações e indicadores reorganizados para telas médias e pequenas.
- Abas da conta permitem quebra de linha sem sobreposição.
- Respeito à preferência de movimento reduzido do sistema.

## Observação de validação
Esta revisão altera principalmente CSS e não muda regras de negócio, permissões, pagamentos ou dados do Firebase. Testar visualmente em desktop e celular, além dos fluxos de login, conta e administração, antes de publicar.

## Comunicação e checkout — 2026-10-23
- Refinada a hierarquia visual do resumo de checkout mantendo navy e azul elétrico.
- Adicionada aba administrativa “Mensagens e avisos” com prévia em tempo real, envio individual ou para até 500 perfis carregados, histórico recente e opção de toast ao iniciar.
- Toast de entrada é exibido uma vez por navegador/usuário/comunicado; a mensagem também permanece na central de notificações.
- Usa a coleção `notifications` e o esquema já existente em `firestore.txt`; não altera saldo, pagamento nem regras de negócio.
- O envio em massa atual considera até 500 perfis por consulta; para bases maiores, recomenda-se paginação ou backend com fila.
