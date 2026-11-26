# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e versionamento em [SemVer](https://semver.org/lang/pt-BR/).

## [1.0.0] - 2026-11-25

### Added (Fase 4)
- Patrimônio Líquido (Net Worth), carteira de investimentos (Ações, FIIs, Renda Fixa, ETFs, Cripto) e Simulador FIRE.
- Workspaces compartilhados (Casal/Família/PJ) com divisão automática de despesas e cálculo de saldos ("quem deve a quem").
- Conector modular Open Finance Brasil (Pluggy / Belvo / Sandbox).
- Entrada rápida em Linguagem Natural (PT-BR), leitor de QR Code NFC-e e Insights Inteligentes.

## [0.3.0] - 2026-11-25

### Added (Fase 3)
- Offline-First Sync Engine com fila local (`outbox`) e processamento idempotente em lote (`/api/v1/sync/batch`).
- Motor de regras de auto-categorização por prioridade (`CONTAINS`, `STARTS_WITH`, `REGEX`).
- Projeção de fluxo de caixa (3, 6 e 12 meses) com alerta de saldo negativo.
- Segurança avançada: 2FA TOTP (RFC 6238), PIN Lock, Backup criptografado AES-256-GCM e Webhooks (Discord/Telegram/ntfy).

## [0.2.0] - 2026-11-25

### Added (Fase 2)
- Cartões de crédito: fechamento/vencimento, cálculo de faturas, parcelamentos (`1/N`) e pagamento de fatura.
- Orçamentos por categoria com alertas de 80% e 100%, e Metas financeiras com aportes.
- Importação de extratos OFX/CSV com detecção de duplicatas e exportação CSV/JSON.
- Integrações com APIs públicas: AwesomeAPI (USD/EUR/BTC), Banco Central SGS (Selic/IPCA) e BrasilAPI (feriados/bancos).

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
