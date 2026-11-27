import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AccountDTO, CategoryDTO, RecurringRuleDTO } from "@finflow/shared";
import { api } from "../lib/api";
import { CommandPalette } from "./CommandPalette";
import { MoneyText } from "./MoneyText";
import { RecurringModal } from "./RecurringModal";
import { ShortcutsModal } from "./ShortcutsModal";

const ACCOUNTS: AccountDTO[] = [
  {
    id: "acc-1",
    name: "Conta Corrente",
    type: "CHECKING",
    initialBalanceCents: 0,
    currentBalanceCents: 0,
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

const CATEGORIES: CategoryDTO[] = [
  {
    id: "cat-1",
    name: "Moradia",
    type: "EXPENSE",
    color: "#ef4444",
    icon: "home",
    budgetLimitCents: null,
  },
];

describe("Core Web Components", () => {
  it("CommandPalette filters commands and executes selected item", () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();

    render(
      <CommandPalette
        open={true}
        onClose={onClose}
        onNavigate={onNavigate}
        onNewTransaction={vi.fn()}
        onTogglePrivacy={vi.fn()}
        onToggleTheme={vi.fn()}
        onOpenShortcuts={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Digite um comando ou página...");
    fireEvent.change(input, { target: { value: "Servidor" } });
    fireEvent.click(screen.getByText("Ir para Painel do Servidor"));

    expect(onNavigate).toHaveBeenCalledWith("server");
    expect(onClose).toHaveBeenCalled();
  });

  it("ShortcutsModal renders shortcuts and closes on click", () => {
    const onClose = vi.fn();
    render(<ShortcutsModal open={true} onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: "Atalhos de Teclado" })).toBeInTheDocument();
    expect(screen.getByText("G depois V")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Fechar"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("RecurringModal creates a recurring rule", async () => {
    const createSpy = vi.spyOn(api.recurring, "create").mockResolvedValue({} as RecurringRuleDTO);
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(
      <RecurringModal
        open={true}
        onClose={onClose}
        onSaved={onSaved}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Ex: Aluguel, Internet, Netflix"), {
      target: { value: "Internet Fibra" },
    });
    fireEvent.change(screen.getByPlaceholderText("0,00"), {
      target: { value: "129,90" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Recorrência" }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Internet Fibra",
          amountCents: 12990,
          accountId: "acc-1",
        })
      );
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
  });

  it("MoneyText formats positive and negative amounts", () => {
    render(<MoneyText cents={-2500} privacyMode={false} />);
    expect(screen.getByText(/25,00/)).toBeInTheDocument();
  });
});
