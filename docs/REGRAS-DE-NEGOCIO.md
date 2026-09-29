# SIGAS Saúde — Regras de Negócio e Funcionalidades

> Documento consolidado a partir do código-fonte do sistema (repositório `sigas`).
> Data da compilação: 29/09/2026. Quando este documento divergir do código, o código prevalece.

---

## Índice

1. [Visão geral](#1-visão-geral)
2. [Perfis e permissões](#2-perfis-e-permissões)
3. [Autenticação, sessão e proteção de rotas](#3-autenticação-sessão-e-proteção-de-rotas)
4. [Escopo de almoxarifados (multi-almoxarifado)](#4-escopo-de-almoxarifados-multi-almoxarifado)
5. [Catálogos e cadastros](#5-catálogos-e-cadastros)
6. [Usuários](#6-usuários)
7. [Estoque: conceitos e movimentações manuais](#7-estoque-conceitos-e-movimentações-manuais)
8. [Solicitações de materiais](#8-solicitações-de-materiais)
9. [Transferências entre almoxarifados](#9-transferências-entre-almoxarifados)
10. [Inventários](#10-inventários)
11. [Dashboard](#11-dashboard)
12. [Relatórios](#12-relatórios)
13. [Configurações](#13-configurações)
14. [Auditoria](#14-auditoria)
15. [Regras transversais](#15-regras-transversais)
16. [Navegação e controle de acesso na interface](#16-navegação-e-controle-de-acesso-na-interface)
17. [Limitações e pontos de atenção](#17-limitações-e-pontos-de-atenção)
18. [Anexo A — Endpoints de API](#anexo-a--endpoints-de-api)
19. [Anexo B — Ações de auditoria](#anexo-b--ações-de-auditoria)
20. [Anexo C — Tipos de movimentação](#anexo-c--tipos-de-movimentação)

---

## 1. Visão geral

O SIGAS Saúde é um sistema de gestão de almoxarifado e suprimentos para a Secretaria
Municipal de Saúde: cadastro de produtos, saldos por almoxarifado, entradas e saídas,
solicitações de materiais por setor, transferências entre almoxarifados, inventários com
ajuste automático de saldo, relatórios exportáveis em PDF, usuários/permissões,
configurações e trilha de auditoria.

**Stack:** Next.js (App Router, Server Components), NextAuth v4 (credenciais + JWT),
Prisma 7 + PostgreSQL (Supabase), bcrypt (10 rounds), jsPDF + AutoTable para PDF.

**Módulos (páginas):** Dashboard, Produtos, Estoque, Entradas, Saídas, Solicitações,
Transferências, Inventário, Relatórios, Usuários, Auditoria, Configurações,
Minha conta (`/conta`, acessível pelo cabeçalho), Ajuda (`/ajuda` — fluxos,
perfis e glossário, acessível a qualquer perfil autenticado).

**Entidades principais:** `User`, `Warehouse`, `Sector`, `Category`, `Unit`, `Product`,
`Stock` (saldo por produto×almoxarifado), `StockMovement`, `MaterialRequest` + `RequestItem`,
`Transfer` + `TransferItem`, `Inventory` + `InventoryItem`, `AuditLog`, `SystemSetting`.

**Operações nunca existem:** não há endpoint de exclusão física em nenhum módulo — a
remoção é sempre simbólica (campo `active`), preservando histórico e auditoria.

---

## 2. Perfis e permissões

Cinco perfis (`UserRole`) e 15 permissões (`lib/permissions/roles.ts`):

| Permissão | ADMIN | GESTOR | OPERADOR | SOLICITANTE | CONSULTA |
|---|:--:|:--:|:--:|:--:|:--:|
| `users.manage` (gerenciar usuários) | ✅ | | | | |
| `warehouses.manage` (almoxarifados e parâmetros) | ✅ | | | | |
| `sectors.manage` (setores) | ✅ | | | | |
| `products.manage` (produtos, categorias, unidades) | ✅ | | ✅ | | |
| `stock.view` (ver estoque) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `stock.view_all_warehouses` (ver todos os almoxarifados) | ✅ | ✅ | | ✅ | |
| `stock.move` (entradas e saídas manuais) | ✅ | | ✅ | | |
| `requests.create` (criar solicitações) | ✅ | | | ✅ | |
| `requests.analyze` (analisar/aprovar/rejeitar) | ✅ | ✅ | ✅ | | |
| `requests.fulfill` (atender solicitações) | ✅ | | ✅ | | |
| `transfers.manage` (transferências) | ✅ | | ✅ | | |
| `inventory.manage` (inventários) | ✅ | | ✅ | | |
| `reports.view` (relatórios) | ✅ | ✅ | ✅ | | ✅ |
| `audit.view` (auditoria) | ✅ | ✅ | | | |
| `dashboard.view` (dashboard) | ✅ | ✅ | ✅ | ✅ | ✅ |

**Regras gerais de autorização:**

- Toda rota de API chama `requirePermission(permissao)` → sem sessão **401**,
  sem permissão **403**.
- Páginas sem gate próprio são protegidas pelo middleware (somente presença de sessão);
  as páginas sensíveis (`/usuarios`, `/relatorios`, `/auditoria`, `/configuracoes`,
  `/solicitacoes/nova`, `/transferencias/nova`, `/inventarios/nova` e detalhes de
  solicitação/transferência/inventário) aplicam checagem de permissão/escopo no servidor.
- O sidebar **não** filtra links por perfil: o bloqueio real é feito por página e API.

---

## 3. Autenticação, sessão e proteção de rotas

- **Login:** NextAuth `CredentialsProvider` (`/login` → `POST /api/auth/callback/credentials`).
  - E-mail normalizado (`toLowerCase().trim()`); usuário inexistente, **inativo**
    (`active = false`) ou senha incorreta → falha genérica “E-mail ou senha inválidos.”
    (sem distinguir o motivo).
  - Senhas armazenadas com **bcrypt, 10 rounds**.
- **Sessão:** estratégia **JWT** (não há estado servidor). O token carrega
  `id`, `role`, `warehouseIds` e `sectorId`, copiados **somente no login**
  (`callback jwt` com `if (user)`): alterações de perfil, almoxarifados ou status só
  passam a valer **após novo login**.
- **Sessão exposta em `session.user`:** `id`, `name`, `email`, `role`, `warehouseIds`, `sectorId`.
- **Middleware (`middleware.ts`, `withAuth`):**
  - Matcher: páginas `/dashboard`, `/produtos`, `/estoque`, `/entradas`, `/saidas`,
    `/solicitacoes`, `/transferencias`, `/inventarios`, `/relatorios`, `/usuarios`,
    `/configuracoes`, `/auditoria` + APIs `/api/produtos`, `/api/estoque`,
    `/api/movimentacoes`, `/api/solicitacoes`, `/api/transferencias`, `/api/inventarios`,
    `/api/usuarios`, `/api/configuracoes`.
  - Fora do matcher: `/`, `/login`, `/api/auth/*` (necessário para autenticar).
  - Usuário anônimo em página → redireciona para `/login` (307, com `callbackUrl`);
    em API → requisição recusada (307).
  - Reforços: `/` redireciona conforme sessão; o layout `(dashboard)` redireciona para
    `/login` se não houver `session.user`.
- **Logout:** botão “Sair” no header → `signOut({ callbackUrl: "/login" })`.
- **Tela de login:** é Server Component (`force-dynamic`) e exibe os parâmetros gerais
  (`orgName` como marca e `orgContact` como “Suporte: …”).

---

## 4. Escopo de almoxarifados (multi-almoxarifado)

Cada usuário tem `warehouseIds` (lista de vínculos, até 50). Regras
(`lib/permissions/warehouse-access.ts`):

- `canAccessWarehouse` → **liberado** se o papel tem `stock.view_all_warehouses`
  (ADMIN, GESTOR, SOLICITANTE) **ou** se o almoxarifado está em `user.warehouseIds`.
- `assertWarehouseAccess` → caso contrário, erro “Acesso negado ao almoxarifado informado.” → **403**.
- `filterAccessibleWarehouseIds` → com a permissão global devolve a lista intacta; sem ela,
  interseção com `warehouseIds` (preservando a ordem).

**Onde o escopo é aplicado:**

| Contexto | Efeito |
|---|---|
| Dashboard (saldos, movimentos do dia, transferências pendentes, estoque por almoxarifado) | calculado só com almoxarifados acessíveis |
| `/estoque` (lista e filtro) | `warehouseId ∈ acessíveis`; filtro `almox` fora do escopo é ignorado |
| `/entradas` e `/saidas` (histórico e formulário) | entrada escopa por destino, saída por origem |
| `/relatorios` (select e consulta) | relatório restrito aos acessíveis; `almox` fora do escopo → todos os acessíveis |
| `/solicitacoes/nova` (origem) e atendimento (`ATENDER`) | apenas acessíveis |
| `/transferencias/nova` | **origem** restrita aos acessíveis; **destino** = qualquer almoxarifado ativo |
| `/inventarios/nova` e detalhe | almoxarifado do inventário precisa ser acessível |
| APIs de movimentação/transferência/inventário/estoque | `assertWarehouseAccess` → 403 |

**Visibilidade de listagens (sem passar por filtro):**

- `/solicitacoes`: quem não analisa nem atende vê **apenas solicitações que criou**
  (`requesterId = eu`); analistas/atuadores veem todas.
- `/transferencias` e `/inventarios`: quem não tem a permissão de gestão nem
  `stock.view_all_warehouses` vê apenas registros cujos almoxarifados ele opera.
- Detalhes: solicitação/transferência/inventário fora do escopo → painel “Sem acesso”.

---

## 5. Catálogos e cadastros

### 5.1 Almoxarifados (`/configuracoes?aba=almoxarifados`)

- Permissão: `warehouses.manage` (ADMIN).
- Campos: `code` (código), `name`, `type` **obrigatório**
  (`INSUMOS_MEDICAMENTOS` ou `ADMINISTRATIVO`), `location` e `responsible`
  (opcionais, máx. 120 caracteres, vazio limpa o campo), `active`.
- Código: 2–24 caracteres de `[A-Z0-9._-]`, normalizado para maiúsculas;
  unicidade **case-insensitive** → 409.
- Nome: 2–80 caracteres.
- Ações: criar (201), editar (200; sem mudanças → 200 sem auditoria),
  **Desativar/Reativar** (toggle `active` com confirmação na UI). Sem exclusão.
- Auditoria: `CATALOG_CREATE` / `CATALOG_UPDATE` (entidade `Warehouse`).

### 5.2 Setores (`?aba=setores`)

- Permissão: `sectors.manage` (ADMIN). Campos `code` + `name` (mesmas regras acima) + `active`.
- Entidade de auditoria: `Sector`.

### 5.3 Categorias e Unidades (`?aba=categorias` / `?aba=unidades`)

- Permissão: `products.manage` (ADMIN e OPERADOR). Campos `code` + `name` + `active`.
- Entidades de auditoria: `Category`, `Unit`.
- Regra de negócio: apenas itens **ativos** aparecem nos selects de cadastro de produto
  (`/produtos/novo` filtra `active: true`); desativar não afeta produtos já vinculados.

### 5.4 Produtos (`/produtos`, `/produtos/novo`, `/produtos/[id]`, `/produtos/[id]/editar`)

- Permissão de escrita: `products.manage` (ADMIN, OPERADOR). Leitura: qualquer perfil autenticado.
- As páginas de **criação e edição** exigem `products.manage` (painel “Sem permissão”
  caso contrário); o detalhe é aberto a todos, mas o botão **Editar** só aparece para
  quem tem `products.manage`.
- **Criação** (`POST /api/produtos`, 201) e **edição** (`PATCH /api/produtos/[id]`, 200):
  - `code` (obrigatório, `trim`, único no banco) e `name` (obrigatório) → 409 se código duplicado
    (“Já existe um produto com o código …”).
  - `categoryId` e `unitId`: UUIDs obrigatórios e existentes → 400 caso contrário.
  - `type`: obrigatório — `INSUMO`, `MEDICAMENTO`, `MATERIAL_ADMINISTRATIVO`, `OUTRO`.
  - `minStock`: default `0`; `maxStock` e `reorderPoint`: opcionais (`null`);
    todos precisam ser números **não negativos**.
  - `maxStock < minStock` → 400 (“O estoque máximo deve ser maior ou igual ao estoque mínimo.”).
  - `requiresBatch`: boolean (default `false`); `active`: boolean (default `true`).
  - `description`/`notes`: opcionais, vazios viram `null`.
- **Edição é parcial** (mesmo padrão de usuários/configurações): só os campos enviados
  são validados; comparação com o valor atual; **sem mudanças → 200 com o estado atual
  e NENHUMA auditoria**. `active: false` desativa o produto (soft delete) — desativado
  some dos selects de formulários, mas permanece em movimentações/histórico.
- Efeitos: 201 `{ product }` + auditoria `PRODUCT_CREATE` (criação); 200 `{ product }` +
  auditoria `PRODUCT_UPDATE` com `{code, changes: {campo: {from, to}}}` (edição).
- Detalhe do produto exibe ficha completa + botões **Editar** (se `products.manage`) e **Voltar**.
- **Simplicidade da tela:** mínimo/máximo, ponto de reordenação, descrição, observações,
  lote e status ficam atrás do toggle **“Opções avançadas”** (recolhido na criação; abre
  sozinho na edição quando o produto já usa algum campo avançado). Os campos continuam
  sempre presentes no envio — só a visibilidade muda (ver 16.1).

---

## 6. Usuários

- Permissão: `users.manage` (**apenas ADMIN**). Senhas nunca retornadas (`passwordHash` fora do `select`).
- **Criação** (`POST /api/usuarios`, 201):
  - `name` 2–120; `email` válido, normalizado para minúsculas, máx. 160;
    unicidade **case-insensitive** → 409.
  - `role`: `ADMIN | GESTOR | OPERADOR | SOLICITANTE | CONSULTA`.
  - `password`: **8–72 caracteres**, hash bcrypt(10). Usuário sempre criado **ativo**.
  - `sectorId` opcional (UUID existente ou `null`); `warehouseIds` opcional
    (array deduplicado, **máx. 50**, todos existentes).
  - Auditoria `USER_CREATE`.
- **Edição** (`PATCH /api/usuarios/[id]`, atualização parcial):
  - Só os campos enviados são validados; comparação com o valor atual;
    **sem mudanças → 200 com o estado atual e NENHUMA auditoria**.
  - `password` opcional: ausente/`""` mantém a atual; enviada regrava o hash
    → auditorias `USER_UPDATE` + `USER_PASSWORD_RESET`.
  - Mudança de `active` → `USER_ACTIVATE` / `USER_DEACTIVATE`.
  - Mudança de outros campos → `USER_UPDATE` com `changes[]` (rótulos: nome, e-mail,
    perfil, status, setor, almoxarifados, senha).
- **Guardas de integridade (400):**
  1. **Não é possível desativar a própria conta.**
  2. **Obrigatório manter pelo menos um administrador ativo** (não se pode remover
     o último ADMIN ativo nem rebaixá-lo a outro perfil).
- **Remoção é soft delete:** não existe exclusão de usuários na interface; a
  desativação também **bloqueia o login**.
- Edição no detalhe mostra o painel “Permissões do perfil” (chips) e omite o botão de
  desativar quando o alvo é o próprio usuário.

### 6.1 Minha conta (`/conta`, `PATCH /api/conta`)

- **Qualquer perfil autenticado** edita a própria conta (sem permissão especial);
  anônimo → 307 via middleware.
- `name`: mesma regra do cadastro (2–120, `trim`) → auditoria `USER_UPDATE` com
  `context.changes = ["nome"]` e `self: true`.
- `newPassword`: exige `currentPassword` presente e **correta** (verificada com
  bcrypt) → 400 “Senha atual incorreta.” se errada; nova senha usa as mesmas regras
  de `password` (8–72) e **deve ser diferente da atual**. Sucesso grava
  `USER_PASSWORD_RESET` com `self: true` e reescreve o hash.
- Trocar **só a senha** não obriga enviar o nome (e vice-versa); corpo sem mudanças
  → 200 sem auditoria.
- Conta desativada → 403 no próprio PATCH (“Conta desativada.”).
- O **cabeçalho lê o nome direto do banco** a cada render do layout: renomear em
  “Minha conta” reflete imediatamente sem novo login (permissões continuam vindo
  do JWT — ver 17.3).
- Formulário no cliente valida confirmação de senha; os 3 campos de senha ficam
  opcionais (deixar em branco mantém a atual).

---

## 7. Estoque: conceitos e movimentações manuais

### 7.1 Conceitos

- **Saldo físico** (`physicalQty`): quantidade real no almoxarifado.
- **Reservado** (`reservedQty`): hoje **nunca é escrito** pelos fluxos (sempre 0).
- **Disponível** = `max(0, físico − reservado)` → na prática, igual ao físico.
- **Abaixo do mínimo**: `physicalQty < minStock` — **informativo apenas**
  (alimenta cards, badges e relatórios); **nunca bloqueia** movimentação.
- **Sem estoque**: `physicalQty ≤ 0`.
- Regra de ouro: **o saldo nunca fica negativo** — toda saída valida a disponibilidade.

### 7.2 Tipos de movimentação

O enum completo é `ENTRADA_COMPRA`, `ENTRADA_DEVOLUCAO`, `ENTRADA_TRANSFERENCIA`,
`ENTRADA_DOACAO`, `ENTRADA_IMPLANTACAO`, `SAIDA_ATENDIMENTO`, `SAIDA_CONSUMO`,
`SAIDA_DEVOLUCAO_FORNECEDOR`, `SAIDA_PERDA`, `SAIDA_TRANSFERENCIA`,
`AJUSTE_INVENTARIO`, `OUTRO`. Quem gera o quê:

| Fluxo | Tipo gerado | Efeito no saldo |
|---|---|---|
| Entrada manual (`/entradas`) | tipo escolhido (default `ENTRADA_COMPRA`); só `ENTRADA_*` | soma `physicalQty` (upsert cria a linha de saldo) |
| Saída manual (`/saidas`) | tipo escolhido (default `SAIDA_CONSUMO`); só `SAIDA_*` | valida disponível e subtrai |
| Atendimento de solicitação | `SAIDA_ATENDIMENTO` | baixa na origem do atendimento |
| Saída de transferência | `SAIDA_TRANSFERENCIA` | baixa na origem |
| Recebimento de transferência | `ENTRADA_TRANSFERENCIA` | crédito no destino |
| Ajuste de inventário | `AJUSTE_INVENTARIO` | credita `variance > 0`, debita `|variance|` |

`OUTRO` existe no enum mas **não** é aceito nas rotas manuais.

Todo movimento grava: produto, quantidade, usuário, almoxarifado de origem e/ou destino,
`referenceType`/`referenceId` (`MaterialRequest`, `Transfer`, `Inventory`),
`documentRef` (nº do documento) e observações.

### 7.3 Entrada manual — `POST /api/movimentacoes/entrada`

- Permissão `stock.move` (ADMIN, OPERADOR) + acesso ao almoxarifado de destino (403).
- Obrigatórios: `productId`, `warehouseId`, `quantity`. Produto deve existir e estar **ativo**
  (400 “Produto inativo ou inexistente.”).
- `type` (opcional) precisa pertencer aos 5 tipos de entrada; `documentRef`/`notes` opcionais.
- `quantity` precisa ser **numérica, finita e > 0**: `0`/vazio caem no 400 de obrigatórios;
  string não numérica (`"abc"`), `Infinity` (`"1e999"`) ou negativo → 400 “Informe uma
  quantidade numérica maior que zero.” — validação ocorre **antes** de tocar no saldo
  (`Number()` sem `isFinite` deixaria `NaN` escapar das comparações).
- Sucesso: 201 `{ movement }` + auditoria `STOCK_ENTRY`.

### 7.4 Saída manual — `POST /api/movimentacoes/saida`

- Mesmos guards da entrada. `type` restrito aos 5 tipos de saída.
- `quantity > disponível` → 400 “Saldo disponível insuficiente para a saída.”
  (nenhuma baixa é aplicada). **Estoque negativo é impossível.**
- Sucesso: 201 + auditoria `STOCK_EXIT`.

### 7.5 Idempotência

- `StockMovement.idempotencyKey` é **única**; as rotas manuais de entrada/saída
  verificam a chave antes de alterar saldo: se já existir, devolvem **200** com o
  movimento original, **sem alterar saldo e sem nova auditoria**.
- Os formulários geram a chave com `crypto.randomUUID()` e a rotacionam após envio bem-sucedido
  (reenvio acidental não duplica movimento).

### 7.6 Comprovante de saída (PDF com assinaturas das duas partes)

- **Onde:** página `/saidas`, coluna "Comprovante" do histórico — uma linha por saída,
  cobrindo todos os tipos `SAIDA_*` (inclusive saídas de atendimento e de transferência).
- **Fluxo:** ao clicar em "Comprovante PDF", o usuário digita os nomes das duas partes —
  **Entregue por** (quem entrega) e **Recebido por** (quem recebe), 2 a 120 caracteres cada.
- **Emissão:** `POST /api/movimentacoes/comprovante` valida que a movimentação existe,
  é de saída (`SAIDA_*`) e que o almoxarifado de origem é acessível ao usuário; responde com
  o payload autoritativo (nome do órgão dos parâmetros, destino, unidade, registrado por).
  Permissão: `stock.view` (a emissão não altera estoque).
- **Auditoria:** cada emissão grava `STOCK_RECEIPT` ligado à movimentação, com
  `{entreguePor, recebidoPor, type, productId, quantity, documentRef}` — os nomes digitados
  ficam registrados no histórico.
- **PDF:** gerado no navegador (jsPDF + AutoTable, import dinâmico) com cabeçalho do órgão,
  tabela de dados da movimentação (tipo, documento, produto, quantidade, origem, destino,
  registrado por, observações) e dois blocos de assinatura (nome impresso, linha de
  assinatura e data) para impressão e assinatura manual. Arquivo:
  `comprovante-saida-<documento|código>-<aaaammdd-hhmm>.pdf`.
- **Escopo:** valem as regras de multi-almoxarifado — só é possível emitir comprovante de
  saídas cuja origem está no vínculo do usuário (403 fora do escopo); anônimo não emite
  (307 do middleware).

---

## 8. Solicitações de materiais

**Finalidade:** um setor pede materiais; a gestão analisa/aprova; o almoxarifado atende,
gerando saídas de estoque.

- **Numeração:** `SOL-AAAA-0001` (ano + sequencial de 4 dígitos), gerada com até 5
  tentativas e garantida por constraint única no banco.
- **Criação** (`POST /api/solicitacoes`): permissão `requests.create` (ADMIN, SOLICITANTE).
  - Itens: **1 a 100**, produto único por item, quantidade **> 0** (número finito),
    todos os produtos existentes e **ativos**.
  - Setor: usa o `sectorId` do usuário; sem vínculo, exige `sectorId` válido e ativo no corpo.
  - Almoxarifado de origem: **opcional** (“A definir no atendimento”); se informado,
    precisa estar ativo e acessível (403).
  - Cria com status **`PENDENTE`**, `submittedAt = agora`, contadores zerados.
  - Auditoria `REQUEST_CREATE`.
- **Visibilidade:** quem não tem `requests.analyze` nem `requests.fulfill` vê apenas as
  próprias solicitações.
- **Ações** (`PATCH /api/solicitacoes/[id]`):

| Ação (UI) | Permissão | De → Para | Regras |
|---|---|---|---|
| `INICIAR_ANALISE` | `requests.analyze` | `PENDENTE → EM_ANALISE` | — |
| `APROVAR` | `requests.analyze` | `EM_ANALISE → APROVADA` | aprova tudo: `aprovado = solicitado` em cada item |
| `APROVAR_PARCIAL` | `requests.analyze` | `EM_ANALISE → APROVADA_PARCIALMENTE` | todos os itens devem vir informados; `0 ≤ aprovado ≤ solicitado`; **ao menos um item > 0** (para recusar tudo, use Rejeitar) |
| `REJEITAR` | `requests.analyze` | `EM_ANALISE → REJEITADA` | motivo obrigatório com **≥ 3 caracteres**; anexado às observações como “[Rejeição] …” |
| `CANCELAR` | dono **ou** `requests.analyze` | `RASCUNHO/PENDENTE/EM_ANALISE/APROVADA/APROVADA_PARCIALMENTE/EM_ATENDIMENTO → CANCELADA` | **bloqueado (400) se algum item já foi atendido** |
| `INICIAR_ATENDIMENTO` | `requests.fulfill` | `APROVADA/APROVADA_PARCIALMENTE → EM_ATENDIMENTO` | exige soma aprovada > 0 |
| `ATENDER` | `requests.fulfill` | `EM_ATENDIMENTO → ATENDIDA` ou `ATENDIDA_PARCIALMENTE` | ver regras abaixo |
| `REABRIR` | `requests.fulfill` | `ATENDIDA_PARCIALMENTE → EM_ATENDIMENTO` | reabre o atendimento |

- **Contadores por item:** `quantityApproved`, `quantityFulfilled`,
  `quantityPending = aprovado − atendido`.
- **Regras do `ATENDER`:**
  - Almoxarifado: `originWarehouseId` fixo da solicitação, ou o informado no corpo
    (precisa existir, estar ativo e ser acessível → 403).
  - Quantidades: informadas por item, **> 0**, únicas, pertencentes à solicitação e
    **≤ pendente** (validado também dentro da transação).
  - **Transação única:** para cada item aplica a baixa de estoque
    (tipo `SAIDA_ATENDIMENTO`, referência à solicitação, documento = número da SOL),
    incrementa `quantityFulfilled` e recalcula `quantityPending`.
  - Saldo insuficiente em **qualquer** item → 400 e **rollback total** (nada é baixado).
  - Se todos os itens ficaram zerados → `ATENDIDA` (`completedAt` preenchido);
    senão → `ATENDIDA_PARCIALMENTE` (permanece reabertível).
  - Auditoria `REQUEST_FULFILL`.
- **Máquina de estados completa** (`lib/requests/state-machine.ts`):
  `RASCUNHO → [PENDENTE, CANCELADA]`; `PENDENTE → [EM_ANALISE, CANCELADA]`;
  `EM_ANALISE → [APROVADA, APROVADA_PARCIALMENTE, REJEITADA, CANCELADA]`;
  `APROVADA → [EM_ATENDIMENTO, CANCELADA]`; `APROVADA_PARCIALMENTE → [EM_ATENDIMENTO, CANCELADA]`;
  `REJEITADA → []` (final); `EM_ATENDIMENTO → [ATENDIDA, ATENDIDA_PARCIALMENTE, CANCELADA]`;
  `ATENDIDA → []` (final); `ATENDIDA_PARCIALMENTE → [EM_ATENDIMENTO]`;
  `CANCELADA → []` (final). Transição fora da tabela → 400.
  (Observação: `RASCUNHO` existe no enum/schema mas nenhum fluxo cria solicitações nesse status — a criação sempre nasce `PENDENTE`.)

---

## 9. Transferências entre almoxarifados

- **Numeração:** `TRF-AAAA-0001` (5 tentativas + constraint única).
- **Criação** (`POST /api/transferencias`): permissão `transfers.manage` (ADMIN, OPERADOR).
  - Origem e destino: UUIDs distintos (**origem ≠ destino**), ambos ativos;
    acesso verificado **apenas na origem** (403).
  - Itens: 1–100, produto único, quantidade > 0, produtos existentes e ativos.
  - Nasce **`PENDENTE`** com `createdById`; auditoria `TRANSFER_CREATE`.
- **Ações** (`PATCH /api/transferencias/[id]` — todas exigem `transfers.manage`):

| Ação | De → Para | Regras |
|---|---|---|
| `CONFIRMAR_SAIDA` | `PENDENTE → SAIDA_CONFIRMADA` | exige acesso à **origem**; transação baixa todos os itens (`SAIDA_TRANSFERENCIA`, ref. Transfer) e grava `exitConfirmedAt`; saldo insuficiente em qualquer item → rollback total |
| `RECEBER` | `SAIDA_CONFIRMADA → RECEBIDA` | exige acesso ao **destino**; transação credita todos os itens (`ENTRADA_TRANSFERENCIA`) e grava `receivedAt` |
| `CANCELAR` | `PENDENTE → CANCELADA` | **só a partir de `PENDENTE`** — depois da saída confirmada, o caminho é concluir o recebimento; nenhum estoque é movimentado |

- Máquina: `PENDENTE → [SAIDA_CONFIRMADA, CANCELADA]`;
  `SAIDA_CONFIRMADA → [RECEBIDA]`; `RECEBIDA` e `CANCELADA` são finais.
  Segunda confirmação/recebimento → 400 (bloqueio por estado, sem idempotencyKey).
- Auditorias: `TRANSFER_EXIT`, `TRANSFER_RECEIPT`, `TRANSFER_CANCEL`.
- Detalhe exige ver a transferência só se envolver almoxarifado acessível; os botões
  aparecem conforme permissão + acesso (origem para saída, destino para recebimento).

---

## 10. Inventários

**Finalidade:** contar o saldo físico de um almoxarifado, registrar divergências com
justificativa e ajustar o estoque automaticamente.

- **Código exibido:** `INV-XXXXXXXX` — derivado dos 8 primeiros caracteres do UUID
  (não há coluna de número).
- **Criação** (`POST /api/inventarios`): permissão `inventory.manage` (ADMIN, OPERADOR) +
  acesso ao almoxarifado (403).
  - **Unicidade:** só pode existir um inventário em aberto por almoxarifado
    (status `ABERTO`, `EM_CONTAGEM`, `CONFERIDO` ou `AJUSTADO`) → 400 caso contrário.
  - Itens: informar até **200 produtos** (únicos, existentes, ativos) **ou** omitir para
    incluir automaticamente todo produto com saldo físico > 0 no almoxarifado
    (sem nenhum → 400 “Não há produtos com saldo neste almoxarifado para inventariar.”).
  - `expectedQty` = **snapshot** do `physicalQty` na abertura.
  - Nasce **`ABERTO`** com `responsibleId` e `startedAt`; auditoria `INVENTORY_CREATE`.
- **Ações** (`PATCH /api/inventarios/[id]` — todas exigem `inventory.manage` **e** acesso
  ao almoxarifado do inventário):

| Ação | De → Para | Regras |
|---|---|---|
| `INICIAR_CONTAGEM` | `ABERTO → EM_CONTAGEM` | — |
| `LANCAR_CONTAGEM` | mantém `EM_CONTAGEM` | só em andamento; itens válidos/pertencentes, sem repetição; `countedQty` número **≥ 0**; justificativa opcional **máx. 500** caracteres; `variance = contado − esperado`; pode ser chamada várias vezes (sobrescreve) |
| `FINALIZAR_CONTAGEM` | `EM_CONTAGEM → CONFERIDO` | **todos** os itens lançados (senão, informa quantos faltam) e **todas as divergências justificadas com ≥ 3 caracteres** |
| `RECONTAR` | `CONFERIDO → EM_CONTAGEM` | mantém os lançamentos |
| `APLICAR_AJUSTE` | `CONFERIDO → AJUSTADO` | exige **≥ 1 divergência**; transação: cada item divergente gera movimento `AJUSTE_INVENTARIO` (referência Inventory, notas “Contagem X vs esperado Y — justificativa”); `variance > 0` credita, `variance < 0` debita com validação de saldo (400 → rollback) |
| `CONCLUIR` | `AJUSTADO → CONCLUIDO` | se estiver em `CONFERIDO` com divergências pendentes → 400 “Aplique o ajuste de N divergência(s) antes de concluir.”; grava `closedAt` |
| `CANCELAR` | `ABERTO`/`EM_CONTAGEM → CANCELADO` | grava `closedAt`; nenhum estoque é alterado |

- Máquina de estados: `ABERTO → [EM_CONTAGEM, CANCELADO]`;
  `EM_CONTAGEM → [CONFERIDO, CANCELADO]`; `CONFERIDO → [AJUSTADO, CONCLUIDO, EM_CONTAGEM]`;
  `AJUSTADO → [CONCLUIDO]`; `CONCLUIDO` e `CANCELADO` são finais.
- Auditorias: `INVENTORY_CREATE`, `INVENTORY_COUNT_START`, `INVENTORY_COUNT_SAVE`,
  `INVENTORY_COUNT_FINISH`, `INVENTORY_RECOUNT`, `INVENTORY_ADJUST`, `INVENTORY_CLOSE`,
  `INVENTORY_CANCEL`.
- UI: durante `EM_CONTAGEM` a tabela editável fica no painel de contagem (botões
  “Preencher com o esperado”, “Salvar contagens”, “Finalizar contagem”);
  divergências aparecem em âmbar e exigem justificativa.

---

## 11. Dashboard

Somente leitura; KPIs calculados em `lib/dashboard/metrics.ts`:

1. **Produtos ativos** (global, não escopado por almoxarifado).
2. **Itens abaixo do mínimo** (`físico < minStock`, só almoxarifados acessíveis, produtos ativos).
3. **Itens sem estoque** (`físico ≤ 0`).
4. **Movimentações hoje** (movimentos desde 00h com origem ou destino acessível).
5. **Solicitações pendentes** (`PENDENTE` + `EM_ANALISE`) — global.
6. **Solicitações em atendimento** (`EM_ATENDIMENTO`) — global.
7. **Transferências pendentes** (`PENDENTE` + `SAIDA_CONFIRMADA` com origem ou destino acessível).
8. **Saldo físico total (un.)** (soma dos saldos acessíveis).

Bloco extra: **Estoque por almoxarifado** — para cada almoxarifado acessível ativo,
`Físico: X · Disponível: Y`.

Além dos KPIs:

- **Cards são clicáveis** (drill-down): Produtos ativos → `/produtos`; Abaixo do mínimo →
  `/estoque?situacao=baixo`; Sem estoque → `/estoque?situacao=zerado`; Solicitações
  pendentes → `/solicitacoes`; Em atendimento → `/solicitacoes?status=EM_ATENDIMENTO`;
  Transferências pendentes → `/transferencias`; Saldo físico total → `/estoque`.
  “Movimentações hoje” não tem link (mistura entradas e saídas).
- **Ações rápidas** — bloco acima dos cards com um atalho por permissão: Nova entrada e
  Nova saída (`stock.move`), Nova solicitação (`requests.create`), Nova transferência
  (`transfers.manage`), Novo inventário (`inventory.manage`), Novo produto (`products.manage`).

---

## 12. Relatórios

- Permissão: `reports.view`. Quatro tipos via `?tipo=` (inválido → `movimentacoes`):

| Tipo | Resumo (cards) | Blocos/tabelas |
|---|---|---|
| `movimentacoes` | Entradas (un.), Saídas (un.), Movimentos no período, Saldo líquido | Entradas por tipo; Saídas por tipo; **Últimos 15 lançamentos** (data/hora, tipo, produto, qtd., trajeto “origem → destino”, documento) |
| `estoque` | Produtos em estoque, Saldo físico total, Abaixo do mínimo, Sem estoque | Saldos por produto e almoxarifado (código, produto, unid., almoxarifado, físico, reservado, disponível, mínimo, situação) |
| `solicitacoes` | Total, Pendentes, Em atendimento, Atendidas, Encerradas sem atendimento | Até **300** solicitações do período (nº, setor, almoxarifado, status, itens, criada em, solicitante) |
| `transferencias` | Total, Pendentes, Em trânsito, Recebidas, Canceladas | Até **300** transferências (nº, origem, destino, itens, status, criada em, saída, recebimento) |

- **Período** (`?de`, `?ate`, formato `yyyy-MM-dd`): default **30 dias**; data inválida
  cai no default; `de > ate` → **inverte**; `ate` limitado a **`de` + 366 dias**.
- **Escopo de almoxarifado:** `?almox` restrito aos acessíveis; fora do escopo →
  “todos os almoxarifados acessíveis”.
- Os mesmos `ReportPayload` (título, subtítulo, resumo, blocos) alimentam a **tabela HTML**
  e o **PDF**.
- **Exportação PDF** (jsPDF + AutoTable, import dinâmico só no clique):
  - Nome: `relatorio-{tipo}-AAAA-MM-DD.pdf`.
  - Título: `"{orgName} — {título do relatório}"` (parâmetro geral).
  - Sanitização de texto para fonte WinAnsi (`→`→`->`, `—`/`–`→`-`, `·`→`-`, `±`→`+/-`,
    aspas tipográficas → retas).
  - A4, margem 14 mm, cabeçalho com título/subtítulo/data de geração, resumo item a item,
    tabelas com grade e cabeçalho azul, quebra de página automática, rodapé em todas as
    páginas com título, data/hora e “Página X de Y”.

---

## 13. Configurações

Página com abas (`?aba=`), cards de contagem e gerenciador inline (formulário criar/editar +
tabela com status e ações):

| Aba | Recurso | Permissão | Campos |
|---|---|---|---|
| `almoxarifados` | Warehouse | `warehouses.manage` | code, name, type, location, responsible, active |
| `setores` | Sector | `sectors.manage` | code, name, active |
| `categorias` | Category | `products.manage` | code, name, active |
| `unidades` | Unit | `products.manage` | code, name, active |
| `parametros` | SystemSetting | `warehouses.manage` | `orgName` (2–80), `orgContact` (e-mail ou vazio) |

- Aba pedida sem permissão → painel “Sem permissão” específico; sem nenhuma permissão →
  painel geral; aba ausente/inválida → **primeira aba liberada** do perfil.
- Parâmetros gerais: chave única `"general"` no `SystemSetting`; consumidos por
  **tela de login** (marca + suporte) e **cabeçalho do PDF de relatórios**.
  Defaults: `orgName = "SIGAS Saúde"`, `orgContact = ""`.
- Sem mudanças → 200 sem auditoria; com mudança → `SETTINGS_UPDATE`.

---

## 14. Auditoria

- Permissão: `audit.view` (ADMIN, GESTOR); sem → painel “Sem permissão”.
- **O que é registrado:** toda mutação sensível via API (movimentações, produtos,
  solicitações, transferências, inventários, usuários, catálogos e parâmetros),
  sempre **após o commit** da transação, com `userId`, `action`, `entity`, `entityId`,
  `context` (JSON) e `createdAt`. Login/logout **não** geram auditoria.
- **Não grava** quando não há mudança (PATCH no-op) nem em replay idempotente.
- **Filtros da página:** período (`de`/`ate`, default 30 dias, inversão, máx. 366 dias),
  `usuario` (UUID existente), `entidade` e `acao` (valores existentes no banco) —
  entradas inválidas são ignoradas.
- **Cards:** Registros totais, Últimas 24 horas, No período, Entidades no período.
- **Lista:** 100 registros mais recentes — data/hora, usuário, ação (badge colorida por
  família + rótulo pt-BR), entidade, registro (UUID truncado com **link** para a
  página de destino) e **contexto JSON expansível**.
- Catálogo completo de ações: Anexo B.

---

## 15. Regras transversais

### 15.1 Formato de erro das APIs

Sempre `{ "error": "<mensagem em pt-BR>" }`:

| Situação | Status |
|---|---|
| Sem sessão (dentro do handler) | 401 |
| Permissão de papel ausente | 403 |
| Sem acesso ao almoxarifado | 403 |
| Validação, transição inválida, saldo insuficiente | 400 |
| ID malformado ou registro inexistente | 404 |
| Código/e-mail duplicado | 409 |
| Erro inesperado | 500 |
| Sucesso | 200 (update/no-op) · 201 (criação) |

### 15.2 Transações e consistência

- Operações compostas usam `prisma.$transaction` (tudo-ou-nada): entrada/saída manual,
  aprovação/atendimento de solicitação, saída/recebimento de transferência,
  lançamento e ajuste de inventário.
- Saída de saldo insuficiente em operações multi-item → **rollback integral**.
- Numerações (`SOL-`, `TRF-`) são geradas por contagem + verificação, com até 5
  tentativas; a unicidade final é garantida por constraint `@unique` no banco.
- Não há trava de linha (`FOR UPDATE`): a concorrência é mitigada por transações,
  constraints únicas e a máquina de estados (segunda ação repetida → 400).

### 15.3 Soft delete e retenção

- Nenhum registro operacional é excluído: produtos, usuários e catálogos só são
  desativados (`active`); solicitações/transferências/inventários são encerrados por
  status; movimentações são **imutáveis** (não há edição nem exclusão).

### 15.4 Datas e filtros

- Períodos usam `date-fns` com `startOfDay`/`endOfDay`, inversão quando `de > ate` e
  teto de 366 dias (relatórios e auditoria).
- Listagens operacionais mostram as N mais recentes: 50 (solicitações, transferências,
  inventários, usuários), 100 (auditoria), 25/página com paginação client (estoque).

### 15.5 Auditoria e idempotência

- `writeAuditLog` roda fora da transação, após o commit; falha de gravação propaga erro.
- Replay de `idempotencyKey` devolve 200 com o movimento original e **não** audita.

---

## 16. Navegação e controle de acesso na interface

Sidebar (12 links, nesta ordem): **Dashboard, Produtos, Estoque, Entradas, Saídas,
Solicitações, Transferências, Inventário, Relatórios, Usuários, Auditoria, Configurações**.
Item ativo por prefixo de rota; cabeçalho do sidebar marca “SIGAS Saúde / Gestão de
Almoxarifado”. O header mostra botão **hambúrguer** (somente abaixo de `md`), nome do
usuário (link para **Minha conta**), perfil (role), links “Ajuda” e “Minha conta”,
botão de **modo escuro** (sol/lua) e botão “Sair”.

- Os links **são filtrados por permissão** no layout do dashboard: some de
  **Relatórios** quem não tem `reports.view`, de **Usuários** quem não tem
  `users.manage`, de **Auditoria** quem não tem `audit.view` e de **Configurações**
  quem não tem nenhuma permissão de aba (`warehouses.manage`/`sectors.manage`/
  `products.manage`) nem `warehouses.manage` de parâmetros. As páginas continuam
  protegidas por trás (gate individual + API), mesmo digitando a URL direto.
- Estados vazios e mensagens de erro são exibidos inline nos formulários client
  (após falha de conexão ou validação do servidor).

### 16.1 Simplicidade de uso (pacote de UX)

Medidas para reduzir cliques e erros de preenchimento, **sem alterar regra de negócio**:

1. **Menu no celular** — abaixo de `md` a sidebar vira um **drawer** aberto pelo botão
   hambúrguer do cabeçalho (`aria-label="Abrir menu"`); fecha ao navegar (troca de rota)
   ou clicar no fundo. No desktop a sidebar continua estática e filtrada (acima).
2. **Dashboard acionável** — cards clicáveis e bloco **Ações rápidas** por permissão
   (ver §11).
3. **Pré-seleção de almoxarifado** (`lib/form/warehouse-prefs.ts`, aplicada em entrada,
   saída, transferência de origem e inventário): com **um único** almoxarifado acessível
   ele já vem selecionado (valor idêntico no servidor e no cliente — sem divergência de
   hidratação); com vários, restaura o **último usado** (`localStorage` lido via
   `useSyncExternalStore`, assumido após a hidratação) e grava após cada envio
   bem-sucedido. O botão “Limpar” de entrada/saída **mantém** o almoxarifado escolhido.
   Na solicitação a origem **não** é pré-preenchida (o default “A definir no
   atendimento” é intencional).
4. **Busca nos seletores de produto** (`components/ui/product-select.tsx`) — com mais de
   15 produtos aparece um campo “Filtrar por código ou nome” acima do `<select>`.
   Usado em entrada, saída, solicitação e transferência. O item selecionado permanece
   visível mesmo sob filtro; na transferência os produtos já usados nas linhas seguem
   desabilitados.
5. **Formulário de produto com “Opções avançadas”** — mínimo/máximo, ponto de
   reordenação, descrição, observações, lote e status recolhidos atrás de um toggle
   (abre sozinho na edição quando já há valor) + dicas curtas em cada campo (ver 5.4).
6. **Chips de situação no estoque** (`/estoque?situacao=baixo|zerado`) — filtros em
   1 clique: Todos / Abaixo do mínimo / Sem estoque. O chip recorta a **listagem** e o
   card “Itens listados”; os demais cards continuam resumindo o conjunto completo.
   Com chip ativo só produtos **ativos** entram (mesma contagem do dashboard) e a
   mensagem vazia cita a situação. Valor de `situacao` inválido é ignorado.
7. **Página Ajuda (`/ajuda`)** — fluxos passo a passo (entradas, saídas, solicitações,
   transferências, inventários, relatórios), tabela de perfis, glossário e link para
   Minha conta. Qualquer perfil autenticado acessa (anônimo → 307); linkada no
   cabeçalho de todas as páginas.
8. **Modo escuro** — botão sol/lua no cabeçalho (`components/layout/theme-toggle.tsx`)
   alterna a classe `.dark` no `<html>`; preferência salva em `localStorage`
   (`sigas:tema`) e padrão = tema do sistema. O script `theme-init`
   (`app/layout.tsx`) aplica o tema **antes da primeira pintura** (sem flash) e o
   `<html>` usa `suppressHydrationWarning`. O tema é 100% CSS (`app/globals.css`,
   bloco `.dark`): sobrescreve os utilitários de cor usados no app — superfícies,
   rampa de textos slate, bordas, divisores e badges de situação (fundos 100 → tom
   escuro da família, textos 700/800 → tom 300) — sem tocar no modo claro, que
   permanece idêntico (as regras só casam sob ancestral `.dark`). `color-scheme:
   dark` ajusta controles nativos e scrollbars; cores de marca (`bg-sky-600/700`,
   `text-white`, anéis de foco) são mantidas. O ícone usa a variante `dark:`
   habilitada por `@custom-variant dark` no Tailwind v4.

---

## 17. Limitações e pontos de atenção

Fatos conhecidos do código que devem ser considerados em evoluções:

1. **`reservedQty` nunca é escrito** — o conceito de reserva existe no modelo/UI, mas
   nenhum fluxo reserva estoque; disponível = físico.
2. **Concorrência sem lock de linha** — a leitura do saldo na saída não usa `FOR UPDATE`;
   baixas simultâneas extremas dependem da transação + constraints.
3. **Claims do JWT ficam defasados** — troca de perfil/almoxarifados exige novo login.
   O nome exibido no cabeçalho é a exceção: vem do banco a cada render (6.1).
4. **Status `RASCUNHO`** de solicitação existe na máquina de estados mas nunca é usado.
5. **Não há notificações/e-mails** — todo acompanhamento é feito pela própria interface.
6. **Relatórios de solicitações/transferências truncam em 300 registros** por período
    (marcados com sufixo `+` quando atingem o limite).

---

## Anexo A — Endpoints de API

| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/auth/*` (NextAuth: csrf, session, callback) | público |
| POST | `/api/produtos` | `products.manage` |
| PATCH | `/api/produtos/[id]` (edição parcial, inclusive `active`) | `products.manage` |
| PATCH | `/api/conta` (próprio nome/senha; exige `currentPassword` para trocar) | qualquer autenticado |
| GET | `/api/estoque` (`productId`, `warehouseId`, `q` — `q` case-insensitive) | `stock.view` |
| POST | `/api/movimentacoes/entrada` | `stock.move` + acesso ao almoxarifado |
| POST | `/api/movimentacoes/saida` | `stock.move` + acesso ao almoxarifado |
| POST | `/api/movimentacoes/comprovante` | `stock.view` + acesso à origem |
| POST | `/api/solicitacoes` | `requests.create` |
| PATCH | `/api/solicitacoes/[id]` (`action`) | por ação: `requests.analyze` / `requests.fulfill` / dono (CANCELAR) |
| POST | `/api/transferencias` | `transfers.manage` + acesso à origem |
| PATCH | `/api/transferencias/[id]` (`CONFIRMAR_SAIDA` \| `RECEBER` \| `CANCELAR`) | `transfers.manage` + acesso (origem/destino) |
| POST | `/api/inventarios` | `inventory.manage` + acesso |
| PATCH | `/api/inventarios/[id]` (7 ações) | `inventory.manage` + acesso |
| POST | `/api/usuarios` | `users.manage` |
| PATCH | `/api/usuarios/[id]` | `users.manage` |
| POST | `/api/configuracoes/[recurso]` | por recurso (`warehouses`/`sectors`/`products.manage`) |
| PATCH | `/api/configuracoes/[recurso]/[id]` | por recurso |
| PATCH | `/api/configuracoes/parametros` | `warehouses.manage` |

Todas (exceto `/api/auth`) passam pelo middleware: anônimo → 307.

---

## Anexo B — Ações de auditoria

| Família | Ações | Contexto típico |
|---|---|---|
| Estoque (`STOCK_`) | `STOCK_ENTRY`, `STOCK_EXIT`, `STOCK_RECEIPT` | `{productId, warehouseId, quantity}` / `{entreguePor, recebidoPor, ...}` |
| Produtos (`PRODUCT_`) | `PRODUCT_CREATE`, `PRODUCT_UPDATE` | `{code, name}` / `{code, changes: {campo: {from, to}}}` |
| Solicitações (`REQUEST_`) | `REQUEST_CREATE`, `REQUEST_ANALYZE`, `REQUEST_APPROVE` (mode total/parcial), `REQUEST_REJECT`, `REQUEST_CANCEL`, `REQUEST_FULFILL_START`, `REQUEST_FULFILL`, `REQUEST_FULFILL_REOPEN` | `{number, ...}` |
| Transferências (`TRANSFER_`) | `TRANSFER_CREATE`, `TRANSFER_EXIT`, `TRANSFER_RECEIPT`, `TRANSFER_CANCEL` | `{number, from, to, items}` |
| Inventários (`INVENTORY_`) | `INVENTORY_CREATE`, `INVENTORY_COUNT_START`, `INVENTORY_COUNT_SAVE`, `INVENTORY_COUNT_FINISH`, `INVENTORY_RECOUNT`, `INVENTORY_ADJUST`, `INVENTORY_CLOSE`, `INVENTORY_CANCEL` | `{warehouseId, items, ...}` |
| Usuários (`USER_`) | `USER_CREATE`, `USER_UPDATE`, `USER_PASSWORD_RESET`, `USER_ACTIVATE`, `USER_DEACTIVATE` | `{email, role, changes}` — em “Minha conta” vem com `self: true` |
| Catálogos (`CATALOG_`) | `CATALOG_CREATE`, `CATALOG_UPDATE` | `{code, name}` / `{changes}` |
| Parâmetros (`SETTINGS_`) | `SETTINGS_UPDATE` | `{keys, orgName}` |

Entidades: `StockMovement`, `Product`, `MaterialRequest`, `Transfer`, `Inventory`,
`User`, `Warehouse`, `Sector`, `Category`, `Unit`, `SystemSetting` — cada uma com rótulo
pt-BR, cor de badge por família e link de navegação para a página correspondente.

---

## Anexo C — Tipos de movimentação

```
ENTRADA_COMPRA · ENTRADA_DEVOLUCAO · ENTRADA_TRANSFERENCIA · ENTRADA_DOACAO · ENTRADA_IMPLANTACAO
SAIDA_ATENDIMENTO · SAIDA_CONSUMO · SAIDA_DEVOLUCAO_FORNECEDOR · SAIDA_PERDA · SAIDA_TRANSFERENCIA
AJUSTE_INVENTARIO · OUTRO
```

- **Entradas manuais** aceitam apenas `ENTRADA_*` (default `ENTRADA_COMPRA`).
- **Saídas manuais** aceitam apenas `SAIDA_*` (default `SAIDA_CONSUMO`).
- `ENTRADA_TRANSFERENCIA` e `SAIDA_TRANSFERENCIA` só nascem do fluxo de transferência;
  `SAIDA_ATENDIMENTO` do atendimento de solicitação; `AJUSTE_INVENTARIO` do inventário;
  `OUTRO` não é aceito por nenhuma rota (reservado a integrações futuras).
