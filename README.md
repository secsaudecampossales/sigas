# SIGAS Saúde — Gestão de Almoxarifado

Sistema web para gerenciamento integrado de dois almoxarifados da Secretaria Municipal de Saúde (insumos/medicamentos e administrativo), conforme especificação funcional e técnica do projeto.

## Stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS 4, Radix UI, Lucide
- MongoDB + Prisma
- NextAuth (credenciais) + bcryptjs
- Vitest (regras de negócio)

## Configuração local

1. Copie `.env.example` para `.env` e ajuste `DATABASE_URL` e `NEXTAUTH_SECRET`.
2. MongoDB deve permitir transações (replica set recomendado para `$transaction`).
3. Instale dependências e gere o client Prisma:

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
```

4. Inicie o servidor:

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

**Usuário inicial (seed):** `admin@saude.local` / `admin123` (altere em produção).

## Scripts

| Comando | Descrição |
|--------|-----------|
| `npm run dev` | Desenvolvimento |
| `npm run build` | Build de produção |
| `npm test` | Testes unitários (Vitest) |
| `npm run db:push` | Sincroniza schema com MongoDB |
| `npm run db:seed` | Dados iniciais (almoxarifados, admin, produto exemplo) |

## Estado da implementação (fases)

| Fase | Status |
|------|--------|
| 1 — Fundação (Next, Prisma, auth, layout) | Em andamento |
| 2 — Usuários, perfis, setores, almoxarifados | Parcial (schema + seed) |
| 3 — Cadastros (produtos) | Schema pronto; telas pendentes |
| 4 — Estoque e movimentações | API entrada/saída + regras no servidor |
| 5–10 | Placeholders de navegação; evolução incremental |

## APIs protegidas (amostra)

- `POST /api/movimentacoes/entrada`
- `POST /api/movimentacoes/saida`
- `GET /api/estoque?productId=...` (visão consolidada por almoxarifado)

Todas exigem sessão autenticada e permissões validadas no servidor.
