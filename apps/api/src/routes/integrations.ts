import type { FastifyInstance } from "fastify";

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 3500): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function registerIntegrationRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/integrations/rates",
    { preHandler: [app.authenticate] },
    async () => {
      const cached = cache.get("rates") as CacheEntry<unknown> | undefined;
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }

      try {
        const raw = await fetchJsonWithTimeout<{
          USDBRL?: { bid: string };
          EURBRL?: { bid: string };
          BTCBRL?: { bid: string };
        }>("https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL");

        const payload = {
          source: "live" as const,
          updatedAt: new Date().toISOString(),
          rates: {
            usdBrl: Number.parseFloat(raw.USDBRL?.bid ?? "5.80"),
            eurBrl: Number.parseFloat(raw.EURBRL?.bid ?? "6.15"),
            btcBrl: Number.parseFloat(raw.BTCBRL?.bid ?? "520000"),
          },
        };
        cache.set("rates", { expiresAt: Date.now() + CACHE_TTL_MS, data: payload });
        return payload;
      } catch {
        return {
          source: "fallback" as const,
          updatedAt: new Date().toISOString(),
          rates: { usdBrl: 5.8, eurBrl: 6.15, btcBrl: 520000 },
        };
      }
    }
  );

  app.get(
    "/api/v1/integrations/bcb",
    { preHandler: [app.authenticate] },
    async () => {
      const cached = cache.get("bcb") as CacheEntry<unknown> | undefined;
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }

      try {
        const [selicArr, ipcaArr] = await Promise.all([
          fetchJsonWithTimeout<Array<{ valor: string }>>(
            "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json"
          ),
          fetchJsonWithTimeout<Array<{ valor: string }>>(
            "https://api.bcb.gov.br/dados/serie/bcdata.sgs.13522/dados/ultimos/1?formato=json"
          ),
        ]);

        const payload = {
          source: "live" as const,
          updatedAt: new Date().toISOString(),
          selicPercent: Number.parseFloat(selicArr[0]?.valor ?? "11.25"),
          ipcaPercent12m: Number.parseFloat(ipcaArr[0]?.valor ?? "4.5"),
        };
        cache.set("bcb", { expiresAt: Date.now() + CACHE_TTL_MS, data: payload });
        return payload;
      } catch {
        return {
          source: "fallback" as const,
          updatedAt: new Date().toISOString(),
          selicPercent: 11.25,
          ipcaPercent12m: 4.5,
        };
      }
    }
  );

  app.get(
    "/api/v1/integrations/holidays/:year",
    { preHandler: [app.authenticate] },
    async (request) => {
      const { year } = request.params as { year: string };
      const safeYear = /^\d{4}$/.test(year) ? year : String(new Date().getFullYear());
      const key = `holidays:${safeYear}`;
      const cached = cache.get(key) as CacheEntry<unknown> | undefined;
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }

      try {
        const holidays = await fetchJsonWithTimeout<
          Array<{ date: string; name: string; type: string }>
        >(`https://brasilapi.com.br/api/feriados/v1/${safeYear}`);
        const payload = { source: "live" as const, year: safeYear, holidays };
        cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data: payload });
        return payload;
      } catch {
        return {
          source: "fallback" as const,
          year: safeYear,
          holidays: [
            { date: `${safeYear}-01-01`, name: "Confraternização Universal", type: "national" },
            { date: `${safeYear}-09-07`, name: "Independência do Brasil", type: "national" },
            { date: `${safeYear}-12-25`, name: "Natal", type: "national" },
          ],
        };
      }
    }
  );

  app.get(
    "/api/v1/integrations/banks",
    { preHandler: [app.authenticate] },
    async () => {
      const cached = cache.get("banks") as CacheEntry<unknown> | undefined;
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }

      try {
        const banks = await fetchJsonWithTimeout<
          Array<{ ispb: string; name: string; code: number | null; fullName: string }>
        >("https://brasilapi.com.br/api/banks/v1");
        const payload = {
          source: "live" as const,
          banks: banks.filter((b) => b.code !== null).slice(0, 50),
        };
        cache.set("banks", { expiresAt: Date.now() + CACHE_TTL_MS, data: payload });
        return payload;
      } catch {
        return {
          source: "fallback" as const,
          banks: [
            { ispb: "00000000", name: "BCO DO BRASIL S.A.", code: 1, fullName: "Banco do Brasil S.A." },
            { ispb: "18236120", name: "NU PAGAMENTOS - IP", code: 260, fullName: "Nu Pagamentos S.A." },
            { ispb: "60701190", name: "ITAÚ UNIBANCO S.A.", code: 341, fullName: "Itaú Unibanco S.A." },
          ],
        };
      }
    }
  );
}
