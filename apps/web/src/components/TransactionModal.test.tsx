import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountDTO, CategoryDTO, TransactionDTO } from "@finflow/shared";
import { api } from "../lib/api";
import { TransactionModal } from "./TransactionModal";

const ACCOUNTS: AccountDTO[] = [
  {
    id: "acc-1",
    name: "Conta Corrente",
    type: "CHECKING",
    initialBalanceCents: 100000,
    currentBalanceCents: 100000,
    color: "#10b981",
    icon: "landmark",
    isArchived: false,
    creditLimitCents: null,
    closingDay: null,
    dueDay: null,
    currency: "BRL",
    createdAt: "2026-11-01T00:00:00.000Z",
  },
  {
    id: "acc-2",
    name: "Carteira",
    type: "WALLET",
    initialBalanceCents: 20000,
    currentBalanceCents: 20000,
    color: "#f59e0b",
    icon: "wallet",
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
    id: "cat-exp",
    name: "Alimentação",
    type: "EXPENSE",
    color: "#ef4444",
    icon: "utensils",
    budgetLimitCents: null,
  },
  {
    id: "cat-inc",
    name: "Salário",
    type: "INCOME",
    color: "#10b981",
    icon: "briefcase",
    budgetLimitCents: null,
  },
];

describe("TransactionModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an expense and preserves typed values when accounts prop refreshes", async () => {
    const createSpy = vi.spyOn(api.transactions, "create").mockResolvedValue({} as TransactionDTO);
    const onSaved = vi.fn();
    const onClose = vi.fn();

    const { rerender } = render(
      <TransactionModal
        open={true}
        onClose={onClose}
        onSaved={onSaved}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Ex: Supermercado, Salário..."), {
      target: { value: "Mercado" },
    });
    fireEvent.change(screen.getByPlaceholderText("0,00"), {
      target: { value: "125,50" },
    });

    // Simulate background refresh changing accounts array reference
    rerender(
      <TransactionModal
        open={true}
        onClose={onClose}
        onSaved={onSaved}
        accounts={[...ACCOUNTS]}
        categories={CATEGORIES}
      />
    );

    expect(screen.getByPlaceholderText("Ex: Supermercado, Salário...")).toHaveValue("Mercado");
    expect(screen.getByPlaceholderText("0,00")).toHaveValue("125,50");

    fireEvent.click(screen.getByRole("button", { name: "Criar Lançamento" }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "acc-1",
          title: "Mercado",
          type: "EXPENSE",
          amountCents: 12550,
          installments: 1,
        })
      );
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("creates a transfer and validates missing account or zero amount", async () => {
    const createSpy = vi.spyOn(api.transactions, "create").mockResolvedValue({} as TransactionDTO);

    const { rerender } = render(
      <TransactionModal
        open={true}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        accounts={[]}
        categories={CATEGORIES}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Ex: Supermercado, Salário..."), {
      target: { value: "Teste" },
    });
    fireEvent.change(screen.getByPlaceholderText("0,00"), {
      target: { value: "50,00" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Criar Lançamento" }).closest("form")!);
    expect(
      screen.getByText("Selecione ou cadastre uma conta antes de criar um lançamento.")
    ).toBeInTheDocument();

    rerender(
      <TransactionModal
        open={true}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Transferência" }));
    fireEvent.change(screen.getByPlaceholderText("Ex: Supermercado, Salário..."), {
      target: { value: "Pix para Carteira" },
    });
    fireEvent.change(screen.getByPlaceholderText("0,00"), {
      target: { value: "200,00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar Lançamento" }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "acc-1",
          destinationAccountId: "acc-2",
          type: "TRANSFER",
          amountCents: 20000,
        })
      );
    });
  });

  it("updates an existing transaction when editing prop is provided", async () => {
    const updateSpy = vi.spyOn(api.transactions, "update").mockResolvedValue({} as TransactionDTO);
    const editingTx: TransactionDTO = {
      id: "tx-1",
      accountId: "acc-1",
      destinationAccountId: null,
      categoryId: "cat-exp",
      recurringRuleId: null,
      title: "Almoço",
      type: "EXPENSE",
      amountCents: 4500,
      date: "2026-11-27T12:00:00.000Z",
      status: "PAID",
      notes: null,
      tags: [],
      createdAt: "2026-11-27T12:00:00.000Z",
    };

    render(
      <TransactionModal
        open={true}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
        editing={editingTx}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Ex: Supermercado, Salário..."), {
      target: { value: "Almoço Editado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Alterações" }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        "tx-1",
        expect.objectContaining({
          title: "Almoço Editado",
          amountCents: 4500,
        })
      );
    });
  });
});
