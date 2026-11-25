# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e versionamento em [SemVer](https://semver.org/lang/pt-BR/).

## [0.1.0] - 2026-11-25

### Added
- Bootstrap completo do monorepo **FinFlow** (`@finflow/shared`, `@finflow/api`, `@finflow/web`, `@finflow/desktop`, `@finflow/mobile`).
- Documentação completa de fluxo de desenvolvimento (`docs/DEVELOPMENT_FLOW.md`), arquitetura (`docs/ARCHITECTURE.md`) e roadmap em 4 fases (`docs/ROADMAP.md`).
- API Fastify + Prisma + SQLite com autenticação JWT (Access + Refresh Token), proteção de rotas e Swagger `/docs`.
- CRUD completo de Contas, Categorias, Lançamentos (Receita, Despesa, Transferência), Regras Recorrentes com materialização e Dashboard analítico.
- Frontend React + Tailwind **Mobile First** (bottom nav) e **Keyboard First** (`Ctrl+K`, `N`, `G+*`, `P` privacidade, `?`).
- Configuração dinâmica de **Modo Local** vs **Servidor Remoto** com teste de conexão `/health`.
- Suporte a empacotamento Desktop Electron (`.exe`, `.msi`, `.AppImage`, `.deb`) e Mobile Capacitor Android (`.apk`, `.aab`).
- Pipeline GitHub Actions de CI e Release multiplataforma + suíte de testes Vitest e Playwright E2E.
