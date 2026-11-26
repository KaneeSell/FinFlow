import { expect, test } from "@playwright/test";

test.describe("FinFlow End-to-End Flows", () => {
  test("full flow: server config -> register -> transactions -> recurring -> keyboard shortcuts -> mobile viewport", async ({
    page,
  }) => {
    // 1. Configure remote/local API URL to E2E test API (port 3339) via UI
    await page.goto("/");
    await page.getByText("Apontar para servidor local ou remoto").click();
    await page.getByText("Servidor Remoto").click();
    await page.getByPlaceholder("https://fin.seudominio.com").fill("http://127.0.0.1:3339");
    await page.getByRole("button", { name: "Testar Conexão" }).click();
    await expect(page.getByText(/Conectado com sucesso/)).toBeVisible();
    await page.getByRole("button", { name: "Salvar" }).click();

    // 2. Register new user
    await page.getByRole("button", { name: "Criar Conta" }).click();
    await page.getByPlaceholder("Daniel Silva").fill("Daniel E2E");
    await page.getByPlaceholder("voce@email.com").fill(`e2e-${Date.now()}@finflow.app`);
    await page.getByPlaceholder("••••••").fill("Senha123!");
    await page.getByRole("button", { name: "Criar Conta e Começar" }).click();

    await expect(page.getByRole("heading", { name: "Visão Geral" })).toBeVisible();

    // 3. Keyboard First: press 'N' to open New Transaction modal and create Income
    await page.keyboard.press("n");
    await expect(page.getByRole("dialog", { name: "Novo Lançamento" })).toBeVisible();
    await page.getByRole("button", { name: "Receita" }).click();
    await page.getByPlaceholder("Ex: Supermercado, Salário...").fill("Salário E2E");
    await page.getByPlaceholder("0,00").fill("5000,00");
    await page.getByRole("button", { name: "Criar Lançamento" }).click();

    await expect(page.getByText("Salário E2E")).toBeVisible();
    await expect(page.getByText(/5\.000,00/).first()).toBeVisible();

    // 4. Keyboard First: Ctrl+K Command Palette -> navigate to Recorrentes
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog", { name: "Paleta de Comandos" })).toBeVisible();
    await page.getByText("Ir para Recorrentes").click();
    await expect(page.getByRole("heading", { name: "Gastos & Receitas Recorrentes" })).toBeVisible();

    // 5. Create a Recurring Expense and materialize it
    await page.getByRole("button", { name: "Nova Recorrência" }).click();
    await page.getByPlaceholder("Ex: Aluguel, Internet, Netflix").fill("Aluguel E2E");
    await page.getByPlaceholder("0,00").fill("1500,00");
    await page.getByRole("button", { name: "Salvar Recorrência" }).click();

    await expect(page.getByText("Aluguel E2E")).toBeVisible();
    await page.getByRole("button", { name: "Gerar Lançamento" }).click();

    // 6. Keyboard First: G then T -> Lançamentos, verify materialized tx
    await page.keyboard.press("g");
    await page.keyboard.press("t");
    await expect(page.getByRole("heading", { name: "Lançamentos" })).toBeVisible();
    await expect(page.getByText("Aluguel E2E")).toBeVisible();

    // 7. Privacy Mode ('P') and Shortcuts Modal ('?')
    await page.keyboard.press("p");
    await expect(page.locator(".privacy-blur").first()).toBeVisible();
    await page.keyboard.press("p");

    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: "Atalhos de Teclado" })).toBeVisible();
    await page.keyboard.press("Escape");

    // 8. Phase 4: Quick Natural Language capture + Investments + Workspaces
    await page.keyboard.press("g");
    await page.keyboard.press("d");
    await expect(page.getByRole("heading", { name: "Visão Geral" })).toBeVisible();
    await page.getByPlaceholder(/Entrada rápida/).fill("Café 18,50 hoje");
    await page.getByRole("button", { name: "Lançar", exact: true }).click();
    await expect(page.getByText(/Lançado: Café/)).toBeVisible();

    await page.keyboard.press("g");
    await page.keyboard.press("i");
    await expect(page.getByRole("heading", { name: "Patrimônio & Investimentos" })).toBeVisible();

    // 9. Mobile First viewport check (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileNav = page.getByRole("navigation", { name: "Navegação Mobile" });
    await expect(mobileNav).toBeVisible();
    await mobileNav.getByText("Início").click();
    await expect(page.getByRole("heading", { name: "Visão Geral" })).toBeVisible();
  });
});
