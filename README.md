# FinFlow

Plataforma multiplataforma de finanças pessoais **Local-First ou Servidor Remoto**, construída 100% em TypeScript com foco em **Mobile First** (Android) e **Keyboard First** (Desktop Windows & Linux).

---

## Visão Geral

O **FinFlow** permite controlar entradas, saídas, transferências entre contas e gastos/receitas recorrentes com total privacidade:

- **Modo Local (Desktop):** o Electron sobe automaticamente a API Fastify + SQLite embarcada no seu computador (`userData/finflow.db`), sem depender da internet.
- **Modo Servidor Remoto:** aponte o app (Desktop, Web ou Android) para qualquer instância sua da API (`https://fin.seudominio.com` ou `http://192.168.x.x:3333`) e compartilhe os dados entre celular e PC.
- **Rotas Protegidas:** autenticação JWT (Access Token 15m + Refresh Token 7d rotacionado em banco), `scrypt` com salt por usuário, `helmet`, `cors` e `rate-limit`.
- **Dinheiro em Centavos:** todos os valores monetários são armazenados e calculados como inteiros (`amountCents`) para eliminar erros de ponto flutuante.

---

## Arquitetura do Monorepo

```text
FinFlow/
├── apps/
│   ├── api/         # Fastify + Prisma + SQLite + JWT + Swagger (/docs)
│   ├── web/         # React + Vite + Tailwind (Mobile First + Keyboard First)
│   ├── desktop/     # Electron (Windows .exe/.msi e Linux .AppImage/.deb)
│   └── mobile/      # Capacitor Android (.apk e .aab)
├── packages/
│   └── shared/      # Contratos Zod, tipos TS e regras financeiras puras
├── e2e/             # Testes End-to-End com Playwright (Desktop + Mobile)
├── docs/            # Fluxo de desenvolvimento, Arquitetura e Roadmap
└── .github/
    └── workflows/   # CI (testes/build) e Release multiplataforma
```

---

## Atalhos de Teclado (Keyboard First)

| Atalho | Ação |
| :--- | :--- |
| `Ctrl+K` / `Cmd+K` | Abrir Paleta de Comandos global |
| `N` | Novo lançamento rápido |
| `G` depois `D` | Ir para Dashboard |
| `G` depois `T` | Ir para Lançamentos |
| `G` depois `R` | Ir para Recorrentes |
| `G` depois `A` | Ir para Contas |
| `G` depois `C` | Ir para Categorias |
| `G` depois `S` | Ir para Configurações |
| `P` | Modo Privacidade (borra todos os valores na tela) |
| `?` | Abrir guia de atalhos |
| `Esc` | Fechar modal ou paleta ativa |

---

## Como Rodar Localmente

### Pré-requisitos
- Node.js `>= 20` (`npm` `>= 10`)

### Instalação e Setup

```bash
npm install
npm run db:generate
npm run db:push
```

### Desenvolvimento (API + Web)

```bash
npm run dev
```

- Web UI: `http://localhost:5173`
- API + Swagger Docs: `http://127.0.0.1:3333/docs`

### Testes e Verificação Completa

```bash
# Typecheck + Vitest (shared + api + web) + Build
npm run verify

# Testes End-to-End (Playwright)
npm run test:e2e
```

---

## Documentação

- [Fluxo de Desenvolvimento (Obrigatório)](docs/DEVELOPMENT_FLOW.md)
- [Roadmap em 4 Fases](docs/ROADMAP.md)
- [Arquitetura e Segurança](docs/ARCHITECTURE.md)
- [Guia de Contribuição](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

---

## Publicar no GitHub e Gerar Releases

1. Autentique o GitHub CLI (uma única vez):
   ```bash
   gh auth login
   ```
2. Crie o repositório remoto e envie a branch `main`:
   ```bash
   gh repo create FinFlow --private --source=. --remote=origin --push
   ```
3. Para disparar uma **Release multiplataforma** (`.exe`, `.msi`, `.AppImage`, `.deb`, `.apk`, `.aab`) via GitHub Actions:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
