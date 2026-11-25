# Roadmap do FinFlow (Benchmark: Actual Budget, Firefly III, YNAB, Organizze, Mobills)

O desenvolvimento é dividido em **4 grandes fases completas**, cada uma entregando valor real ponta-a-ponta (Banco + API + Testes + Web/Mobile/Desktop).

---

## Fase 1 — Fundação Multiplataforma & Fluxo de Caixa Essencial *(Entregue)*

- **Monorepo TypeScript:** `@finflow/shared`, `@finflow/api`, `@finflow/web`, `@finflow/desktop` (Electron), `@finflow/mobile` (Capacitor Android).
- **Autenticação & Segurança:** Cadastro, Login, Refresh Token rotacionado em SQLite, `scrypt`, `helmet`, `rate-limit`, rotas `/api/v1/*` protegidas por JWT e Swagger `/docs`.
- **Contas & Categorias:** Múltiplas contas (Corrente, Carteira, Poupança, Investimento, Cartão) com saldo calculado automaticamente e categorias customizáveis com cores e ícones.
- **Lançamentos Completos:** Receitas, Despesas e Transferências entre contas, status `Pago` / `Pendente`, filtros por mês, tipo, conta, categoria e busca textual.
- **Despesas & Receitas Recorrentes:** Regras diárias, semanais, quinzenais, mensais e anuais com materialização manual (1 clique) ou em lote ("Processar Vencidas").
- **Dashboard Analítico:** Saldo total, receitas/despesas do mês, taxa de poupança, gráfico de fluxo de caixa (6 meses), gastos por categoria, próximos vencimentos e últimos lançamentos.
- **Conexão Local vs Servidor Remoto:** Configurável na tela de login e em Configurações, com teste de `/health` ao vivo.
- **Mobile First & Keyboard First:** Bottom navigation no celular + Command Palette (`Ctrl+K`), atalhos (`N`, `G+D/T/R/A/C/S`, `P` privacidade, `?` ajuda).
- **Qualidade & CI/CD:** Vitest (unitário + integração API), Playwright E2E e GitHub Actions para CI e Releases (`.exe`, `.msi`, `.AppImage`, `.deb`, `.apk`, `.aab`).

---

## Fase 2 — Cartões de Crédito, Orçamentos, Metas & APIs Financeiras

- **Módulo Completo de Cartões de Crédito:**
  - Dia de fechamento e dia de vencimento por cartão.
  - Cálculo automático de fatura aberta, fechada e próxima fatura.
  - Lançamentos parcelados (`1/12`, `2/12`...) gerados automaticamente nas faturas futuras.
  - Pagamento de fatura como transferência vinculada à conta corrente.
- **Orçamentos por Categoria (Envelopes):**
  - Limite mensal por categoria com barra de progresso (verde/amarelo/vermelho) e alertas ao atingir 80% e 100%.
- **Metas Financeiras (Objetivos):**
  - Reserva de emergência, viagem, compra planejada com aportes vinculados e previsão de conclusão.
- **Integrações com APIs Públicas Gratuitas:**
  - **AwesomeAPI (`economia.awesomeapi.com.br`):** Cotações em tempo real (USD, EUR, BTC) para suporte multi-moeda e conversão.
  - **Banco Central do Brasil (SGS):** Taxa Selic, IPCA e PTAX para corrigir metas e simular rendimentos.
  - **BrasilAPI (`brasilapi.com.br`):** Lista oficial de bancos brasileiros (códigos/ISPB), feriados nacionais (ajuste de vencimento em dias úteis) e consulta CNPJ para fornecedores.
- **Importação & Exportação:**
  - Importador de extratos **OFX** e **CSV** bancários com pré-visualização.
  - Exportação de relatórios em **CSV** e **PDF**, além de backup completo JSON/SQLite criptografado.
- **Comprovantes:** Upload/anexo de imagens e PDFs de notas fiscais nos lançamentos.

---

## Fase 3 — Offline-First Sync Engine, Automação & Segurança Avançada

- **Offline-First Real (SQLite Local <-> Servidor Remoto):**
  - Fila local (`outbox`) no Desktop e Android para lançar gastos mesmo sem internet e sincronizar automaticamente ao reconectar, com resolução de conflitos determinística (Last-Write-Wins por campo / HLC).
- **Motor de Regras & Auto-Categorização:**
  - Regras do tipo *"Se descrição contém 'UBER' ou '99' -> Categoria Transporte + Tag Mobilidade"*.
  - Detecção inteligente de lançamentos duplicados na importação OFX/CSV.
- **Projeção de Fluxo de Caixa (3, 6 e 12 meses):**
  - Simulação de saldo futuro combinando saldo atual + recorrências ativas + parcelas de cartão de crédito.
- **Segurança Avançada:**
  - 2FA (TOTP — Google Authenticator / Authy).
  - Bloqueio por PIN e Biometria nativa no Android.
  - Criptografia de banco local (SQLCipher) no Desktop/Mobile.
- **Notificações & Webhooks:**
  - Lembretes nativos de contas a vencer no Windows/Linux/Android.
  - Webhooks configuráveis (Telegram, Discord, ntfy) para resumo diário/semanal e alertas de vencimento.

---

## Fase 4 — Patrimônio, Investimentos, Open Finance & Colaboração

- **Patrimônio Líquido (Net Worth) & Investimentos:**
  - Carteira consolidada (Renda Fixa/CDB/Tesouro, Ações, FIIs, ETFs, Cripto).
  - Atualização automática de cotações via **brapi.dev** (B3) e **CoinGecko** (Cripto).
  - Evolução histórica do patrimônio líquido e rentabilidade real descontando IPCA.
- **Open Finance Brasil (Opcional):**
  - Conector modular compatível com **Pluggy / Belvo** para sincronização automática de extratos e faturas quando configurado pelo usuário.
- **Workspaces & Finanças Compartilhadas:**
  - Múltiplos espaços (Pessoal, Casal/Família, PJ/Empresa) com controle de permissões e divisão de despesas.
- **Inteligência & Captura Rápida:**
  - Entrada em linguagem natural (*"Almoço 45,90 no Pix hoje"* -> preenche lançamento automaticamente).
  - Leitor de QR Code de **NFC-e** no Android para importar compras de mercado/restaurante com 1 toque.
