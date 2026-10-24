# Gbzin Shop — versão redesenhada

Loja digital com visual escuro inspirado no site Atlas MC, detalhes azul/ciano, cartões modernos e navegação responsiva.

## Como executar
1. Extraia o ZIP.
2. Abra a pasta no VS Code.
3. Inicie um servidor local (por exemplo, Live Server). Como o projeto usa módulos ES e Firebase, não abra com `file://`.
4. Publique a pasta inteira em uma hospedagem HTTPS.

## Personalização e Firebase
- `src/js/firebase-config.js` foi preservado sem alterações.
- `database.txt` contém as regras do **Firebase Realtime Database** atualizadas para os cupons.
- `firestore.txt` contém as regras do **Cloud Firestore**; esta revisão habilita exclusão de mensagens de chamados apenas para administradores.
- Antes de publicar, revise as regras no console Firebase e confirme que a lista de administradores contém apenas e-mails que você controla. O login não exige verificação de e-mail nesta versão.

## Cupons: mudanças
- Bloqueia códigos duplicados, códigos malformados, descontos inválidos e percentuais acima de 100%.
- Validação de código ativo diretamente no caminho individual do cupom.
- Contas de clientes só recebem cupons publicados em `publicCoupons`.
- O painel administrativo permite ativar/desativar cupons e controlar a visibilidade na conta.
- Cupons publicados são sincronizados com `publicCoupons`; ao desativar/ocultar/excluir, são retirados da listagem pública.
- O cliente pode copiar os códigos publicados na página **Ofertas** e, quando houver cupons publicados, na aba **Cupons** da conta.

### Importante: aplicar regras do Realtime Database
No Firebase Console, abra **Realtime Database → Regras** e publique o conteúdo de `database.txt`. Não cole esse arquivo nas regras do Firestore. A listagem pública usa um caminho separado (`publicCoupons`) para que códigos ocultos não sejam expostos pela leitura da coleção administrativa.

## Páginas adicionadas
- **Ofertas:** cupons publicados e produtos com preço promocional.
- **Como comprar:** guia passo a passo.
- **Transações:** histórico financeiro para usuários autenticados.
- **Novidades, Clube VIP, Benefícios, Pedidos, Favoritos, Carrinho, Suporte e Painel** continuam ligados ao roteamento existente.
- Footer com atalhos para páginas institucionais.

## Pagamentos e segurança
- A tela de checkout apresenta um valor estimado e gera um código Pix a partir do payload configurado. Isso não equivale a criar uma cobrança por gateway nem confirma que o pagamento ocorreu.
- A validação exibida no navegador não substitui uma validação final em backend. Antes de usar descontos em pedidos pagos automaticamente, implemente validação de preço/cupom e criação de pedido no servidor ou em Cloud Functions.
- Nunca publique credenciais privadas, tokens ou segredos no JavaScript do navegador.
- A API key do Firebase usada por aplicações web é normalmente pública, mas a segurança real depende de Authentication e regras restritivas. Confira as regras e os domínios autorizados do projeto.

## Arquivos principais
- `index.html` — entrada da aplicação.
- `style.css` — estilos originais com camada visual Atlas-inspired.
- `src/js/main.js` — navegação, catálogo, checkout e páginas.
- `src/js/store.js` — operações Firebase, incluindo cupons.
- `src/js/account.js` — conta e cupons visíveis ao cliente.
- `src/js/admin.js` — painel e gestão de cupons.
- `database.txt` — regras do Realtime Database.
- `firestore.txt` — regras do Cloud Firestore.
- `assets/` — logotipo e ícones.
- `site.webmanifest` — metadados para dispositivos compatíveis.


## Solução de `PERMISSION_DENIED` em cupons

As regras administrativas de `database.txt` exigem que a conta esteja autenticada, use um dos e-mails administrativos listados nas regras e tenha o e-mail confirmado no Firebase Authentication. O front-end agora também verifica `user.emailVerified` para evitar mostrar o painel administrativo quando as regras vão negar o acesso.

1. No Firebase Console, abra **Authentication → Users** e confira o e-mail da conta usada no painel.
2. Confirme o e-mail pelo link enviado pelo Firebase. Saia da loja e entre novamente para atualizar o token de autenticação.
3. Confira se o e-mail está exatamente na lista administrativa de `database.txt` (sem diferenças de conta).
4. Em **Realtime Database → Regras**, publique o conteúdo de `database.txt`. Não cole essas regras em Cloud Firestore.
5. Recarregue o site. Se persistir, confira se o Realtime Database selecionado é `gbzin-group-default-rtdb` e se as regras publicadas são as deste projeto.

Não torne `coupons` publicamente gravável para contornar o erro: isso permitiria que visitantes criassem, alterassem ou apagassem cupons.


## Correção de login e cadastro
- Após login/cadastro, a navegação retorna para a página inicial em vez de permanecer no formulário.
- O botão mostra estado de carregamento e é reativado após a tentativa.
- Contas administrativas sem e-mail confirmado recebem uma solicitação de confirmação; depois de confirmar, saia e entre novamente para atualizar a sessão.
- As regras administrativas continuam exigindo e-mail verificado. Não remova essa exigência para contornar o erro.


## Autenticação sem confirmação de e-mail

Esta versão não envia nem exige confirmação de e-mail no cadastro/login. Para que o painel administrativo e os cupons funcionem, publique o arquivo `database.txt` nas regras do **Realtime Database** e mantenha apenas os e-mails confiáveis na lista de administradores de `src/js/main.js` e nas regras. As regras do Firestore continuam separadas e devem ser publicadas no Firestore Rules, não no Realtime Database.

**Segurança:** sem verificação de e-mail, proteja as contas administrativas com senhas fortes e não adicione endereços que você não controla à lista de administradores.

## Ajustes desta versão
- Removido o ponto azul decorativo antes do logotipo no cabeçalho.
- Corrigida a aba Clientes: implementada a consulta `getAllCustomers()` que faltava no `store.js`, com tratamento de erro e detalhes dos perfis.
- Solicitações administrativas agora podem ser excluídas.
- Aba Solicitações e carteira agora lista carteiras e extratos, com exclusão de documento de carteira ou de registro de transação. Excluir um registro de extrato não altera o saldo.
- Central de atendimento permite ao administrador excluir chamados e suas mensagens. Para habilitar isso, publique as regras atualizadas de `firestore.txt` no Cloud Firestore.


## Recompensas e pontos
Publique `firestore.txt` em **Cloud Firestore → Regras** antes de usar o sistema. No painel administrativo, abra **Recompensas** para criar o catálogo, adicionar/remover pontos por UID e processar solicitações. Os pontos são persistidos em `customers.rewardPoints`; a auditoria fica em `pointsLedger`. A aprovação de resgate desconta os pontos de forma transacional. Use a lista de administradores já definida nas regras e nunca torne as operações administrativas públicas.


## Atualização de carrinho e afiliados

- `src/js/cart.js`: renderização dedicada do carrinho, totais consistentes, remoção de itens, alerta de estoque e layout responsivo.
- `src/js/affiliates.js`: captura de código `?ref=`, criação de links e cópia com fallback.
- O carrinho atualiza a interface de forma otimista e serializa gravações no Realtime Database para evitar que cliques rápidos em `+`/`-` se sobrescrevam.
- A tela administrativa de solicitações agora possui pesquisa e filtros por tipo/status; o atalho Afiliados abre o filtro de parcerias.
- A atribuição do afiliado é registrada como referência no protocolo de análise do pagamento, mas comissões não são liberadas automaticamente: isso exige confirmação de pagamento no backend.


## Área do cliente: Recompensas, Solicitações e carteira, Afiliados
- Navegação principal reorganizada em três abas independentes: **Recompensas**, **Solicitações e carteira** e **Afiliados**.
- A aba Solicitações e carteira reúne saldo confirmado, formulário de recarga, geração de QR para referência, histórico de solicitações e histórico financeiro.
- As solicitações do usuário são listadas com status e tipo; o filtro permite isolar recargas, recompensas, afiliados e códigos.
- Enviar uma solicitação atualiza a interface após a gravação no Firestore e mostra erro legível se a gravação falhar.
- A geração de QR/código Pix no navegador não comprova pagamento nem credita saldo; a confirmação deve vir do administrador ou de um backend de pagamento confiável.


## Comunicação administrativa
O painel inclui a aba **Mensagens e avisos**. Administradores podem publicar mensagens na central do cliente ou toasts de entrada, individualmente por UID ou para os perfis retornados pela consulta de até 500 clientes. Os documentos usam a coleção Firestore `notifications` e o esquema permitido nas regras fornecidas em `firestore.txt`. O toast de entrada é marcado localmente por navegador para não reaparecer em cada navegação; a mensagem continua disponível na área de notificações. Para bases maiores, implemente paginação/backend em lote.


## Atualização de códigos, notificações e identidade visual (23/10/2026)

- O favicon e os ícones de instalação usam agora o azul elétrico da Gbzin Shop. Se o navegador mantiver o ícone antigo, limpe o cache ou use Ctrl+F5.
- O painel inclui a aba **Códigos promocionais**, com criação, validade, limite de resgates e pausa/ativação.
- O cliente só consegue enviar códigos existentes e ativos para análise; o benefício não é liberado pelo navegador. A aprovação administrativa valida o limite de uso em transação.
- O perfil tem a aba **Mensagens e avisos**, com histórico e ação para marcar avisos como lidos. Toasts de entrada usam a mesma coleção privada de notificações.
- Publique as regras de `firestore.txt` no Firestore antes de testar estes recursos. Em produção, benefícios de alto valor devem ser concedidos por Cloud Functions/backend confiável, não por código executado no cliente.


## Atualização: Google Login, recompensas virtuais e carrinho
- Login Google via Firebase Authentication `GoogleAuthProvider` e `signInWithPopup`.
- Códigos promocionais podem conceder saldo virtual (BRL na carteira), pontos ou benefício manual após aprovação administrativa.
- Histórico de mensagens/toasts tem ação de exclusão por item.
- Estilos do carrinho e login foram refinados para tema navy/azul e telas menores.
- Publique as regras atualizadas de `firestore.txt` no Firebase Console.

### Configuração Google necessária
No Firebase Console > Authentication > Sign-in method, habilite Google. Em Authorized domains, inclua o domínio publicado. O OAuth Client ID informado deve estar configurado no provedor Google/Firebase Console e com o domínio/redirect URI autorizado. O código cliente usa o provedor Firebase; não é seguro tratar o Client ID como segredo.

## Login com Google (inclui acesso ao painel)

O botão **Continuar com Google** usa Firebase Authentication com `GoogleAuthProvider` e `signInWithPopup`. O SDK não recebe o OAuth Client ID diretamente no código da página: ele usa a configuração do provedor Google cadastrado no Firebase. Client ID informado para configurar no Google Cloud/Firebase:

`771087321692-02hh2p3k797sr97buvcqvch39dkm9oin.apps.googleusercontent.com`

Para ativar em produção:
1. Em **Firebase Console → Authentication → Sign-in method**, habilite **Google** e selecione o e-mail de suporte do projeto.
2. Em **Google Cloud Console → APIs e serviços → Credenciais**, confira que o OAuth Client ID acima é do tipo **Aplicativo da Web** e pertence ao mesmo projeto Google/Firebase.
3. Nos URIs de redirecionamento autorizados desse cliente, adicione `https://gbzin-group.firebaseapp.com/__/auth/handler` (e o handler do domínio customizado somente se a configuração Firebase indicar esse domínio).
4. Em **Firebase Authentication → Settings → Authorized domains**, adicione o domínio publicado da loja e `localhost` apenas para desenvolvimento local.
5. Para permitir que uma conta Google abra o painel, o e-mail retornado pelo Google deve constar na lista `ADMINS` de `src/js/main.js`. A lista no front-end controla a exibição do painel, mas as regras Firebase também precisam restringir todas as operações administrativas. Não adicione e-mails que não controla.

O OAuth Client ID é um identificador público, não uma senha. Nunca coloque client secret, chave privada ou credenciais de servidor no front-end.

## Segurança das recompensas em saldo virtual

Os créditos de códigos promocionais são **saldo virtual interno**, não pagamento bancário nem dinheiro sacável. A aprovação usa uma transação Firestore para atualizar o contador de uso, a carteira e o histórico financeiro em conjunto. Para produção com saldo de valor real, mova a aprovação/creditação para Cloud Functions ou outro backend confiável, com idempotência, autorização por claims e trilha de auditoria; regras Firestore e controles no navegador devem ser testados com contas não administrativas antes da abertura ao público.


## Perfil, afiliados e visibilidade (24/10/2026)
- Removido do histórico financeiro o aviso solicitado.
- Adicionado atalho para Afiliados na navegação do perfil e melhorado o feedback ao salvar dados.
- O código de indicação fica armazenado por até 30 dias no navegador e é incluído na solicitação de revisão do pagamento para facilitar a conferência administrativa.
- Solicitações de parceria duplicadas são bloqueadas quando já existe uma ativa.
- SEO básico: canonical, metadados Open Graph/Twitter, schema `OnlineStore`, `robots.txt`, `sitemap.xml` e conteúdo HTML inicial.
- Comissões não são creditadas pelo navegador. Para atribuição e comissão confiáveis, implemente validação no backend após confirmação do pagamento.
