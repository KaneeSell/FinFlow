# Fluxo de Desenvolvimento (Development Flow)

Este documento define o **fluxo obrigatório** para qualquer alteração no **FinFlow** (nova feature, correção de bug, refatoração ou alteração de schema). O objetivo é garantir que **nada chegue à `main` sem contratos tipados, testes automatizados e validação E2E**.

---

## Visão Geral do Ciclo

```text
1. Branch (feat/ | fix/ | refactor/)
   │
   ▼
2. Contratos & Schema (packages/shared + prisma/schema.prisma)
   │
   ▼
3. Implementação Backend (apps/api: service + route + proteção JWT)
   │
   ▼
4. Implementação Frontend (apps/web: Mobile First + Keyboard First)
   │
   ▼
5. Testes Automatizados Obrigatórios
   ├─ Unitários (Vitest em packages/shared e apps/web)
   ├─ Integração de API (Vitest + Fastify inject + SQLite isolado)
   └─ E2E (Playwright em Desktop e Mobile 390x844)
   │
   ▼
6. Gate Local (npm run verify && npm run test:e2e)
   │
   ▼
7. Conventional Commit + Push + Pull Request (CI Verde)
   │
   ▼
8. Tag SemVer (vX.Y.Z) -> GitHub Actions Release (Win, Linux, Android)
```

---

## Passo a Passo Detalhado

### 1. Branching Strategy
Nunca commite features diretamente na `main`. Crie uma branch a partir da `main` atualizada:
- `feat/<nome-curto>` — nova funcionalidade (ex: `feat/credit-card-invoices`)
- `fix/<nome-curto>` — correção de bug (ex: `fix/recurring-leap-year`)
- `refactor/<nome-curto>` — melhoria interna sem alterar comportamento
- `docs/<nome-curto>` — documentação
- `chore/<nome-curto>` — build, CI/CD, dependências

### 2. Contratos & Banco de Dados Primeiro
Antes de escrever rotas ou telas:
1. Defina ou atualize os **schemas Zod e tipos TypeScript** em `packages/shared/src/schemas.ts`.
2. Se houver mudança no banco, edite `apps/api/prisma/schema.prisma` e gere a migration:
   ```bash
   npm run db:migrate -- --name <descricao_da_mudanca>
   ```
3. Regras financeiras puras (cálculos, datas, formatação em centavos) devem ficar em `packages/shared/src/` para serem reutilizadas pela API, Web e Desktop.

### 3. Implementação Backend (`apps/api`)
- Toda rota nova sob `/api/v1/*` **deve** usar o hook `app.authenticate` (exceto `auth/register`, `auth/login`, `auth/refresh` e `/health`).
- Valide payloads com os schemas do `@finflow/shared`.
- Sempre filtre queries Prisma pelo `userId: request.user.sub` para evitar vazamento entre contas (IDOR).
- Valores monetários são sempre inteiros em **centavos** (`amountCents`).

### 4. Implementação Frontend (`apps/web`)
Toda nova tela ou fluxo deve respeitar os dois pilares de UX:
- **Mobile First:** projete primeiro para `390x844` (toque confortável `>= 44px`, bottom nav, modais responsivos sem scroll horizontal).
- **Keyboard First:** suporte navegação por teclado (`Tab`, `Esc` para fechar, `Enter` para confirmar), atalhos de ação quando aplicável e registro na **Paleta de Comandos (`Ctrl+K`)**.
- **Modo Privacidade (`P`):** todo valor monetário exibido deve respeitar o estado de privacidade (`privacy-blur`).

### 5. Testes Automatizados Obrigatórios
**Regra de ouro:** nenhum código novo é considerado pronto sem testes cobrindo o que foi criado ou alterado.

1. **Testes Unitários (`packages/shared` e `apps/web` — Vitest):**
   - Toda nova função pura ou cálculo financeiro em `packages/shared` exige casos de teste (incluindo bordas: zero, negativos, virada de mês/ano).
   - Componentes/utilitários de UI críticos devem ter testes com `@testing-library/react`.
2. **Testes de Integração de API (`apps/api/tests/` — Vitest):**
   - Toda nova rota deve testar:
     - Acesso não autenticado retorna `401`.
     - Payload inválido retorna `400`.
     - Fluxo feliz (CRUD / regra de negócio) com SQLite de teste isolado.
     - Isolamento por usuário (usuário A não acessa recurso do usuário B).
3. **Testes E2E (`e2e/` — Playwright):**
   - Fluxos principais do usuário devem ter cobertura E2E rodando contra a API + Web reais, validando Desktop e Mobile (`390x844`).

### 6. Gate Local Antes do Commit
Execute sempre a bateria completa antes de abrir PR ou fazer merge:

```bash
npm run verify      # typecheck + vitest (shared, api, web) + build
npm run test:e2e    # Playwright E2E
```

### 7. Conventional Commits & Pull Request
Use o padrão **Conventional Commits**:
- `feat(transactions): add bulk status toggle`
- `fix(api): prevent duplicate recurring materialization`
- `test(e2e): cover mobile bottom nav flow`
- `docs: update roadmap phase 2`
- `ci: add android apk signing step`

Checklist do PR:
- [ ] Contratos em `@finflow/shared` atualizados
- [ ] Testes unitários + integração + E2E adicionados e passando
- [ ] `npm run verify && npm run test:e2e` passou localmente
- [ ] Funciona em modo Local e Servidor Remoto
- [ ] `CHANGELOG.md` atualizado (quando relevante para release)

### 8. Versionamento (SemVer) & Release Automática
Seguimos **Semantic Versioning (`MAJOR.MINOR.PATCH`)**:
- `PATCH` (`0.1.1`): correções de bugs sem quebra de contrato.
- `MINOR` (`0.2.0`): novas funcionalidades compatíveis (ex: entrega de fase ou módulo).
- `MAJOR` (`1.0.0`): marcos principais ou mudanças incompatíveis de API/banco.

Para gerar uma nova release oficial:
1. Atualize a versão no `package.json` raiz (e `apps/desktop`, `apps/mobile`) e registre no `CHANGELOG.md`.
2. Crie e envie a tag Git:
   ```bash
   git tag -a v0.1.0 -m "Release v0.1.0"
   git push origin v0.1.0
   ```
3. O workflow `.github/workflows/release.yml` irá validar os testes e publicar automaticamente na aba **GitHub Releases**:
   - **Windows:** `.exe` (NSIS) e `.msi`
   - **Linux:** `.AppImage` e `.deb`
   - **Android:** `.apk` e `.aab`
