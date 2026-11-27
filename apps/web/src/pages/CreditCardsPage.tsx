import { useState } from "react";
import { CheckCircle2, CreditCard } from "lucide-react";
import type { AccountDTO, CreditCardInvoiceDTO } from "@finflow/shared";
import { MoneyText } from "../components/MoneyText";
import { api } from "../lib/api";

interface CreditCardsPageProps {
  invoices: CreditCardInvoiceDTO[];
  accounts: AccountDTO[];
  month: string;
  onMonthChange: (m: string) => void;
  privacyMode: boolean;
  onRefresh: () => void;
}

export function CreditCardsPage({
  invoices,
  accounts,
  month,
  onMonthChange,
  privacyMode,
  onRefresh,
}: CreditCardsPageProps) {
  const payingAccounts = accounts.filter(
    (a) => a.type !== "CREDIT_CARD" && a.type !== "MEAL_VOUCHER" && !a.isArchived
  );
  const [sourceAccountId, setSourceAccountId] = useState(payingAccounts[0]?.id ?? "");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handlePayInvoice = async (cardAccountId: string) => {
    const sourceId = sourceAccountId || payingAccounts[0]?.id;
    if (!sourceId) return;
    setPayingId(cardAccountId);
    setMessage(null);
    try {
      const res = await api.creditCards.payInvoice(cardAccountId, {
        month,
        sourceAccountId: sourceId,
      });
      setMessage(`Fatura paga: R$ ${(res.paidCents / 100).toFixed(2).replace(".", ",")}`);
      onRefresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao pagar fatura");
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cartões & Faturas</h1>
          <p className="text-xs text-zinc-500">Limite disponível, fechamento e parcelamentos</p>
        </div>

        <div className="flex items-center gap-2">
          {payingAccounts.length > 0 && (
            <select
              value={sourceAccountId || payingAccounts[0]?.id}
              onChange={(e) => setSourceAccountId(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900"
              aria-label="Conta pagadora"
            >
              {payingAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  Pagar com: {acc.name}
                </option>
              ))}
            </select>
          )}
          <input
            type="month"
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900"
          />
        </div>
      </div>

      {message && (
        <div className="rounded-xl bg-emerald-500/15 px-4 py-2.5 text-xs text-emerald-400">
          {message}
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          Nenhum cartão de crédito cadastrado. Crie uma conta do tipo{" "}
          <strong>Cartão de Crédito</strong> na aba Contas.
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((inv) => {
            const usedPercent =
              inv.creditLimitCents > 0
                ? Math.min(
                    100,
                    Math.round(
                      ((inv.creditLimitCents - inv.availableLimitCents) / inv.creditLimitCents) *
                        100
                    )
                  )
                : 0;

            return (
              <div
                key={inv.accountId}
                className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                      style={{ backgroundColor: inv.color }}
                    >
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{inv.accountName}</h2>
                      <p className="text-xs text-zinc-500">
                        Fecha dia {inv.closingDay} • Vence dia {inv.dueDay}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Fatura {inv.month}</p>
                    <p className="text-2xl font-bold text-rose-500">
                      <MoneyText cents={inv.invoiceTotalCents} privacyMode={privacyMode} />
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>
                      Disponível:{" "}
                      <MoneyText cents={inv.availableLimitCents} privacyMode={privacyMode} />
                    </span>
                    <span>
                      Limite: <MoneyText cents={inv.creditLimitCents} privacyMode={privacyMode} />
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${usedPercent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <span className="text-xs text-zinc-500">
                    Pendente:{" "}
                    <strong className="text-amber-400">
                      <MoneyText cents={inv.pendingTotalCents} privacyMode={privacyMode} />
                    </strong>
                  </span>

                  {inv.pendingTotalCents > 0 && (
                    <button
                      type="button"
                      disabled={payingId === inv.accountId}
                      onClick={() => handlePayInvoice(inv.accountId)}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {payingId === inv.accountId ? "Pagando..." : "Pagar Fatura"}
                    </button>
                  )}
                </div>

                {inv.transactions.length > 0 && (
                  <div className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
                    {inv.transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between px-3 py-2 text-xs">
                        <div>
                          <span className="font-medium">{tx.title}</span>
                          <span className="ml-2 text-zinc-500">{tx.date.slice(0, 10)}</span>
                        </div>
                        <span className="font-semibold text-rose-400">
                          <MoneyText cents={tx.amountCents} privacyMode={privacyMode} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
