import { useState } from "react";
import { Flame, Landmark, Plus, Trash2, TrendingUp } from "lucide-react";
import {
  ASSET_CLASSES,
  calculateFireProjection,
  parseCurrencyToCents,
  type AssetClass,
  type InvestmentAssetDTO,
  type NetWorthSummaryDTO,
} from "@finflow/shared";
import { MoneyText } from "../components/MoneyText";
import { api } from "../lib/api";

const CLASS_LABEL: Record<AssetClass, string> = {
  FIXED_INCOME: "Renda Fixa",
  STOCK: "Ações",
  FII: "FIIs",
  ETF: "ETFs",
  CRYPTO: "Cripto",
  CASH: "Caixa",
};

interface InvestmentsPageProps {
  assets: InvestmentAssetDTO[];
  netWorth: NetWorthSummaryDTO | null;
  privacyMode: boolean;
  onRefresh: () => void;
}

export function InvestmentsPage({
  assets,
  netWorth,
  privacyMode,
  onRefresh,
}: InvestmentsPageProps) {
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [assetClass, setAssetClass] = useState<AssetClass>("STOCK");
  const [quantity, setQuantity] = useState("1");
  const [avgPrice, setAvgPrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");

  const [fireExpense, setFireExpense] = useState("5000");
  const [fireContribution, setFireContribution] = useState("2000");
  const fire = calculateFireProjection(
    parseCurrencyToCents(fireExpense),
    netWorth?.netWorthCents ?? 0,
    parseCurrencyToCents(fireContribution),
    6
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number.parseFloat(quantity);
    const avgCents = parseCurrencyToCents(avgPrice);
    const curCents = parseCurrencyToCents(currentPrice || avgPrice);
    if (!symbol.trim() || !name.trim() || !Number.isFinite(qty) || qty <= 0) return;

    await api.investments.create({
      symbol: symbol.trim().toUpperCase(),
      name: name.trim(),
      assetClass,
      quantity: qty,
      avgPriceCents: avgCents,
      currentPriceCents: curCents,
      currency: "BRL",
    });
    setSymbol("");
    setName("");
    setQuantity("1");
    setAvgPrice("");
    setCurrentPrice("");
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Patrimônio & Investimentos</h1>
        <p className="text-xs text-zinc-500">Patrimônio Líquido (Net Worth), carteira e simulador FIRE</p>
      </div>

      {/* Net Worth Hero */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Patrimônio Líquido Total</span>
            <Landmark className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-400">
            <MoneyText cents={netWorth?.netWorthCents ?? 0} privacyMode={privacyMode} />
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-xs text-zinc-500">Total Investido (Mercado)</span>
          <p className="mt-2 text-2xl font-bold">
            <MoneyText cents={netWorth?.investmentsTotalCents ?? 0} privacyMode={privacyMode} />
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Lucro / Prejuízo</span>
            <TrendingUp className="h-4 w-4 text-sky-400" />
          </div>
          <p
            className={`mt-2 text-2xl font-bold ${
              (netWorth?.totalGainLossCents ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            <MoneyText
              cents={netWorth?.totalGainLossCents ?? 0}
              privacyMode={privacyMode}
              showSign
            />
          </p>
        </div>
      </div>

      {/* Add Asset */}
      <form
        onSubmit={handleCreate}
        className="grid grid-cols-1 gap-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-6"
      >
        <input
          required
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Código (ITSA4)"
          className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-xs uppercase dark:border-zinc-700"
        />
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome (Itaúsa)"
          className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
        />
        <select
          value={assetClass}
          onChange={(e) => setAssetClass(e.target.value as AssetClass)}
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        >
          {ASSET_CLASSES.map((c) => (
            <option key={c} value={c}>
              {CLASS_LABEL[c]}
            </option>
          ))}
        </select>
        <input
          required
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Qtd"
          className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-xs tabular-nums dark:border-zinc-700"
        />
        <input
          required
          inputMode="decimal"
          value={currentPrice}
          onChange={(e) => {
            setCurrentPrice(e.target.value);
            if (!avgPrice) setAvgPrice(e.target.value);
          }}
          placeholder="Preço atual (R$)"
          className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-xs tabular-nums dark:border-zinc-700"
        />
        <button
          type="submit"
          className="flex items-center justify-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-zinc-950"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </button>
      </form>

      {/* Assets Table */}
      <div className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {assets.length === 0 ? (
          <p className="py-10 text-center text-xs text-zinc-500">Nenhum ativo cadastrado.</p>
        ) : (
          assets.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-semibold">
                  {a.symbol} <span className="text-xs font-normal text-zinc-500">• {a.name}</span>
                </p>
                <p className="text-xs text-zinc-500">
                  {CLASS_LABEL[a.assetClass]} • Qtd: {a.quantity}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-semibold">
                    <MoneyText cents={a.totalCurrentCents} privacyMode={privacyMode} />
                  </p>
                  <p
                    className={`text-xs ${
                      a.gainLossCents >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {a.gainLossPercent >= 0 ? "+" : ""}
                    {a.gainLossPercent}%
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await api.investments.remove(a.id);
                    onRefresh();
                  }}
                  className="text-zinc-400 hover:text-rose-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FIRE Simulator */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-center gap-2">
          <Flame className="h-5 w-5 text-amber-400" />
          <h2 className="text-sm font-semibold">Simulador FIRE (Independência Financeira)</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Custo de vida mensal (R$)</label>
            <input
              value={fireExpense}
              onChange={(e) => setFireExpense(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm tabular-nums dark:border-zinc-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Aporte mensal (R$)</label>
            <input
              value={fireContribution}
              onChange={(e) => setFireContribution(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm tabular-nums dark:border-zinc-700"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-zinc-50 p-4 text-xs dark:bg-zinc-800/50">
          <div>
            <p className="text-zinc-500">Número FIRE (25x anual)</p>
            <p className="text-base font-bold text-amber-400">
              <MoneyText cents={fire.fireNumberCents} privacyMode={privacyMode} />
            </p>
          </div>
          <div>
            <p className="text-zinc-500">Progresso Atual</p>
            <p className="text-base font-bold">{fire.progressPercent}%</p>
          </div>
          <div>
            <p className="text-zinc-500">Tempo Estimado (6% a.a. real)</p>
            <p className="text-base font-bold text-emerald-400">
              {fire.yearsToFire !== null ? `${fire.yearsToFire} anos` : "--"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
