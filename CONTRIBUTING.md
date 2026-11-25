# Guia de Contribuição

Antes de contribuir com código, leia atentamente o [Fluxo de Desenvolvimento](docs/DEVELOPMENT_FLOW.md).

## Regras Rápidas

1. Crie uma branch descritiva (`feat/...`, `fix/...`, `refactor/...`).
2. Toda mudança de regra ou contrato começa em `packages/shared`.
3. Toda nova feature ou correção exige testes automatizados (Vitest + Playwright E2E quando aplicável).
4. Rode `npm run verify && npm run test:e2e` antes de commitar.
5. Use **Conventional Commits** nas mensagens de commit.
