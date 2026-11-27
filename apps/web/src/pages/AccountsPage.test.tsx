import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountDTO } from "@finflow/shared";
import { api } from "../lib/api";
import { AccountsPage } from "./AccountsPage";

const ACCOUNTS: AccountDTO[] = [
  {
    id: "acc-1",
    name: "Conta Corrente",
    type: "CHECKING",
    initialBalanceCents: 100000,
    currentBalanceCents: 150000,
    color: "#10b981",
    icon: "landmark",
    isArchived: false,
    creditLimitCents: null,
    closingDay: null,
    dueDay: null,
    currency: "BRL",
    createdAt: "2026-11-01T00:00:00.000Z",
  },
];

describe("AccountsPage editing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("opens edit dialog prefilled, updates account name/balance/color/archive, and refreshes", async () => {
    const updateSpy = vi.spyOn(api.accounts, "update").mockResolvedValue({
      ...ACCOUNTS[0]!,
      name: "Banco Inter",
      initialBalanceCents: 250050,
      color: "#3b82f6",
      isArchived: true,
    });
    const onRefresh = vi.fn();

    render(<AccountsPage accounts={ACCOUNTS} privacyMode={false} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar conta" }));

    expect(screen.getByRole("dialog", { name: "Editar Conta" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome da Conta")).toHaveValue("Conta Corrente");
    expect(screen.getByLabelText("Saldo Inicial (R$)")).toHaveValue("1000,00");

    fireEvent.change(screen.getByLabelText("Nome da Conta"), {
      target: { value: "Banco Inter" },
    });
    fireEvent.change(screen.getByLabelText("Saldo Inicial (R$)"), {
      target: { value: "2500,50" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cor #3b82f6" }));
    fireEvent.click(screen.getByLabelText("Conta arquivada"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar Alterações" }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith("acc-1", {
        name: "Banco Inter",
        type: "CHECKING",
        initialBalanceCents: 250050,
        color: "#3b82f6",
        icon: "landmark",
        isArchived: true,
        creditLimitCents: null,
        closingDay: null,
        dueDay: null,
      });
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole("dialog", { name: "Editar Conta" })).not.toBeInTheDocument();
  });

  it("supports switching account type to CREDIT_CARD with limit/closing/due and closes on Escape", async () => {
    const updateSpy = vi.spyOn(api.accounts, "update").mockResolvedValue({
      ...ACCOUNTS[0]!,
      type: "CREDIT_CARD",
    });

    render(<AccountsPage accounts={ACCOUNTS} privacyMode={false} onRefresh={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar conta" }));
    expect(screen.getByRole("dialog", { name: "Editar Conta" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Editar Conta" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Editar conta" }));
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "CREDIT_CARD" } });
    fireEvent.change(screen.getByLabelText("Limite (R$)"), { target: { value: "8000,00" } });
    fireEvent.change(screen.getByLabelText("Fechamento"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Vencimento"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Alterações" }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        "acc-1",
        expect.objectContaining({
          type: "CREDIT_CARD",
          icon: "credit-card",
          creditLimitCents: 800000,
          closingDay: 5,
          dueDay: 12,
        })
      );
    });
  });
});
