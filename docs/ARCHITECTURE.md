# Arquitetura do FinFlow

## 1. Visão de Componentes

```text
+---------------------------------------------------------------+
|                        CLIENTES (UI)                          |
|  Web (Vite)   |   Desktop (Electron)   |   Mobile (Capacitor) |
+---------------------------------------------------------------+
        |                  |                         |
        | HTTP/REST + JWT  | (Local: IPC -> Child    | HTTP/REST + JWT
        |                  |  Process 127.0.0.1:3333 |
        v                  v  ou Servidor Remoto)    v
+---------------------------------------------------------------+
|                   API BACKEND (@finflow/api)                  |
|  Fastify 5 + Zod Validation + JWT Guard + Rate Limit + Helmet |
+---------------------------------------------------------------+
                                |
                                v
+---------------------------------------------------------------+
|                  PERSISTÊNCIA (Prisma + SQLite)               |
|  Local: userData/finflow.db   |   Remoto: Server SQLite DB    |
+---------------------------------------------------------------+
```

---

## 2. Modo Local vs Modo Servidor Remoto

O frontend (`apps/web`) é agnóstico ao local de hospedagem da API:
- **Modo Local (Desktop):** ao iniciar o Electron no modo local, o processo principal (`apps/desktop/src/main.ts`) inicializa a API Fastify embarcada apontando o SQLite para `app.getPath('userData')/finflow.db` (evitando problemas de permissão em `Program Files`).
- **Modo Remoto (Desktop / Mobile / Web):** o usuário informa a URL do seu servidor (ex: `https://fin.seudominio.com` ou IP da rede local) na tela de Login ou em **Configurações**. Um botão **"Testar Conexão"** valida `GET /health` antes de salvar.

---

## 3. Segurança e Proteção de Rotas

1. **Senhas:** hash com `crypto.scrypt` nativo do Node.js + salt aleatório de 16 bytes por usuário e comparação em tempo constante (`crypto.timingSafeEqual`).
2. **Tokens:**
   - **Access Token (JWT):** curta duração (15 minutos), enviado no header `Authorization: Bearer <token>`.
   - **Refresh Token:** validade de 7 dias, armazenado como hash SHA-256 na tabela `RefreshToken`, com rotação e revogação no logout.
3. **Isolamento Multi-Tenant:** todas as consultas e mutações no Prisma incluem `userId: request.user.sub` na cláusula `where`.
4. **Hardening HTTP:** `@fastify/helmet`, `@fastify/cors` e `@fastify/rate-limit`.

---

## 4. Modelo de Dados (Prisma + SQLite)

- `User`: perfil, moeda padrão (`BRL`), credenciais.
- `RefreshToken`: tokens de renovação revogáveis.
- `Account`: contas financeiras (`CHECKING`, `WALLET`, `SAVINGS`, `CREDIT_CARD`, `INVESTMENT`) e saldo inicial em centavos.
- `Category`: categorias de receita/despesa, cor, ícone e limite de orçamento mensal.
- `RecurringRule`: regras recorrentes (`DAILY`, `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `YEARLY`), próxima execução e status ativo.
- `Transaction`: receitas, despesas e transferências (`accountId` -> `destinationAccountId`), status `PAID`/`PENDING`, vínculo opcional com `RecurringRule`.
