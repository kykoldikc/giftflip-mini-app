import { useEffect, useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  RefreshCw,
  ExternalLink,
  Gift,
  ArrowUpDown,
  TrendingDown,
  ScanSearch,
} from "lucide-react";

type MarketSource = "MRKT" | "Portals";
type Tab = "Market" | "Flip" | "Portfolio" | "Profile";

type MarketGift = {
  id: string;
  name: string;
  collection?: string;
  collectionId?: string | number | null;
  number?: string | number | null;
  price: number;
  floorPrice?: number | null;
  currency: string;
  image?: string;
  source: MarketSource;
  url?: string;
  attributes?: unknown[];
};

type Opportunity = {
  gift: MarketGift;
  referencePrice: number;
  spread: number;
  discount: number;
  referenceType: string;
};

function getNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getCollectionKey(gift: MarketGift): string {
  if (gift.collectionId != null) {
    return `id:${gift.collectionId}`;
  }

  return `name:${(gift.collection || gift.name || "").trim().toLowerCase()}`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function getAttributes(attributes: unknown[] = []): string[] {
  return attributes
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) &&
        typeof item === "object" &&
        !Array.isArray(item)
    )
    .map((item) => {
      const name =
        item.trait_type ?? item.name ?? item.type ?? item.key;
      const value =
        item.value ?? item.display_value ?? item.rarity;

      if (name == null || value == null) return "";

      return `${String(name)}: ${String(value)}`;
    })
    .filter(Boolean);
}

export default function App() {
  const [source, setSource] = useState<MarketSource>("Portals");
  const [activeTab, setActiveTab] = useState<Tab>("Market");
  const [search, setSearch] = useState("");
  const [gifts, setGifts] = useState<MarketGift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<"low" | "high">("low");

  async function loadGifts() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        source,
        search,
        sort,
      });

      const response = await fetch(
        `https://giftflip-api.onrender.com/api/market/gifts?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      const normalized: MarketGift[] = Array.isArray(data.gifts)
        ? data.gifts
            .map((gift: any) => ({
              ...gift,
              id: String(gift.id ?? ""),
              name: String(gift.name ?? "Telegram Gift"),
              price: getNumber(gift.price) ?? 0,
              floorPrice: getNumber(gift.floorPrice),
              currency: String(gift.currency ?? "UNKNOWN"),
              collection: gift.collection
                ? String(gift.collection)
                : String(gift.name ?? ""),
              source,
            }))
            .filter((gift: MarketGift) => gift.price > 0)
        : [];

      setGifts(normalized);
    } catch (err) {
      console.error(err);
      setGifts([]);
      setError("Не вдалося завантажити лоти. Спробуй оновити.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGifts();
  }, [source, sort]);

  const filteredGifts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return gifts.filter((gift) => {
      return (
        gift.name.toLowerCase().includes(query) ||
        (gift.collection ?? "").toLowerCase().includes(query)
      );
    });
  }, [gifts, search]);

  const scanner = useMemo(() => {
    const validGifts = gifts.filter(
      (gift) => Number.isFinite(gift.price) && gift.price > 0
    );

    const collectionPrices = new Map<string, number[]>();

    validGifts.forEach((gift) => {
      const key = getCollectionKey(gift);
      const current = collectionPrices.get(key) ?? [];
      current.push(gift.price);
      collectionPrices.set(key, current);
    });

    const opportunities: Opportunity[] = [];
    let analyzed = 0;
    let missingReference = 0;
    let floorReferences = 0;
    let collectionReferences = 0;

    validGifts.forEach((gift) => {
      let referencePrice: number | null = null;
      let referenceType = "";

      if (
        gift.floorPrice != null &&
        Number.isFinite(gift.floorPrice) &&
        gift.floorPrice > 0
      ) {
        referencePrice = gift.floorPrice;
        referenceType = "Floor price";
        floorReferences++;
      } else {
        const prices = collectionPrices.get(getCollectionKey(gift)) ?? [];

        if (prices.length >= 2) {
          referencePrice = median(prices);
          referenceType = "Collection median";
          collectionReferences++;
        }
      }

      if (
        referencePrice == null ||
        !Number.isFinite(referencePrice) ||
        referencePrice <= 0
      ) {
        missingReference++;
        return;
      }

      analyzed++;

      if (referencePrice <= gift.price) return;

      const spread = referencePrice - gift.price;
      const discount = (spread / referencePrice) * 100;

      if (discount >= 8) {
        opportunities.push({
          gift,
          referencePrice,
          spread,
          discount,
          referenceType,
        });
      }
    });

    return {
      opportunities: opportunities.sort(
        (a, b) => b.discount - a.discount
      ),
      total: validGifts.length,
      analyzed,
      missingReference,
      floorReferences,
      collectionReferences,
    };
  }, [gifts]);

  const opportunities = scanner.opportunities;

  return (
    <div className="min-h-screen bg-[#090b12] text-white">
      <div className="mx-auto min-h-screen max-w-md overflow-hidden pb-24">
        <header className="flex items-center justify-between px-5 pb-5 pt-7">
          <div>
            <div className="text-xs font-semibold tracking-[0.25em] text-violet-400">
              TELEGRAM GIFTS
            </div>
            <h1 className="mt-1 text-3xl font-black tracking-tight">
              GIFT<span className="text-violet-400">FLIP</span>
            </h1>
          </div>

          <button
            onClick={loadGifts}
            disabled={loading}
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-violet-300"
          >
            <RefreshCw
              size={20}
              className={loading ? "animate-spin" : ""}
            />
          </button>
        </header>

        {activeTab === "Market" && (
          <>
            <section className="px-5">
              <div className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/20 via-[#171426] to-[#10131d] p-5">
                <div className="flex items-center gap-2 text-sm text-violet-200">
                  <Gift size={17} />
                  Telegram Gift Market
                </div>

                <h2 className="mt-3 text-2xl font-bold">
                  Find your next collectible.
                </h2>

                <p className="mt-2 text-sm text-gray-400">
                  Explore gifts from supported marketplaces.
                </p>

                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  Portals connected
                </div>
              </div>
            </section>

            <section className="mt-6 px-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Marketplace</h2>

                <button
                  onClick={() =>
                    setSort(sort === "low" ? "high" : "low")
                  }
                  className="flex items-center gap-1.5 text-xs text-gray-400"
                >
                  <ArrowUpDown size={14} />
                  {sort === "low" ? "Price: low to high" : "Price: high to low"}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-[#151722] p-1">
                {(["MRKT", "Portals"] as MarketSource[]).map((item) => (
                  <button
                    key={item}
                    onClick={() => setSource(item)}
                    className={`rounded-xl py-3 text-sm font-bold ${
                      source === item
                        ? "bg-violet-500 text-white"
                        : "text-gray-400"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-5 px-5">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#151722] px-4 py-3">
                <Search size={18} className="text-gray-500" />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") loadGifts();
                  }}
                  placeholder="Search gifts or collections"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />

                <button onClick={loadGifts} className="text-violet-300">
                  <SlidersHorizontal size={18} />
                </button>
              </div>
            </section>

            <section className="mt-6 px-5">
              <h2 className="mb-3 text-lg font-bold">Live listings</h2>

              {loading && (
                <p className="py-8 text-center text-sm text-gray-400">
                  Loading marketplace...
                </p>
              )}

              {!loading && error && (
                <p className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-300">
                  {error}
                </p>
              )}

              {!loading && !error && filteredGifts.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">
                  No listings found.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                {!loading &&
                  filteredGifts.map((gift) => (
                    <article
                      key={gift.id}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-[#151722]"
                    >
                      <div className="flex aspect-square items-center justify-center bg-[#242039]">
                        {gift.image ? (
                          <img
                            src={gift.image}
                            alt={gift.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Gift size={42} className="text-violet-300/40" />
                        )}
                      </div>

                      <div className="p-3">
                        <h3 className="truncate text-sm font-semibold">
                          {gift.name}
                        </h3>

                        <p className="mt-2 text-sm font-bold text-violet-300">
                          {gift.price} {gift.currency}
                        </p>

                        {gift.url && (
                          <a
                            href={gift.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-xs text-violet-300"
                          >
                            Open listing <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
              </div>
            </section>
          </>
        )}

        {activeTab === "Flip" && (
          <section className="px-5">
            <div className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/20 to-[#10131d] p-5">
              <div className="flex items-center gap-2 text-violet-200">
                <ScanSearch size={19} />
                Flip Scanner
              </div>

              <h2 className="mt-3 text-2xl font-bold">
                Find undervalued gifts.
              </h2>

              <p className="mt-2 text-sm text-gray-400">
                Аналізуємо подарунки за floor price або цінами інших лотів
                тієї самої колекції.
              </p>

              <button
                onClick={loadGifts}
                disabled={loading}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 py-3 text-sm font-bold"
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
                Оновити та просканувати
              </button>
            </div>

            <div className="mt-6">
              <h2 className="text-lg font-bold">Scanner statistics</h2>

              <div className="mt-3 grid grid-cols-2 gap-3">
                {[
                  ["Усього лотів", scanner.total],
                  ["Оцінено лотів", scanner.analyzed],
                  ["Потенційні угоди", opportunities.length],
                  ["Без орієнтира", scanner.missingReference],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-[#151722] p-4"
                  >
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="mt-2 text-2xl font-bold text-violet-300">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-[#151722] p-4">
              <h3 className="text-sm font-semibold">Джерела оцінки</h3>

              <div className="mt-3 flex justify-between text-xs text-gray-400">
                <span>Floor price</span>
                <span>{scanner.floorReferences}</span>
              </div>

              <div className="mt-2 flex justify-between text-xs text-gray-400">
                <span>Медіана колекції</span>
                <span>{scanner.collectionReferences}</span>
              </div>

              <p className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-5 text-gray-500">
                Це попередня оцінка, а не гарантований прибуток. Медіана
                оголошень не дорівнює реальній ціні продажу. Для точнішого
                аналізу потрібні завершені продажі, комісії та ліквідність.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <h2 className="text-lg font-bold">Potential deals</h2>
              <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs text-violet-300">
                {opportunities.length} found
              </span>
            </div>

            {loading && (
              <p className="mt-4 text-center text-sm text-gray-400">
                Scanning listings...
              </p>
            )}

            {!loading && opportunities.length === 0 && (
              <div className="mt-4 rounded-3xl border border-white/10 bg-[#12141e] px-5 py-8 text-center">
                <ScanSearch
                  size={36}
                  className="mx-auto text-violet-300/50"
                />

                <h3 className="mt-4 font-semibold">
                  Поки немає підтверджених сигналів
                </h3>

                <p className="mt-2 text-sm text-gray-500">
                  Сканер не буде вигадувати прибуток, якщо даних для
                  порівняння недостатньо.
                </p>
              </div>
            )}

            {!loading && opportunities.length > 0 && (
              <div className="mt-4 space-y-3">
                {opportunities.map((item) => (
                  <article
                    key={item.gift.id}
                    className="rounded-2xl border border-green-400/20 bg-[#151722] p-3"
                  >
                    <div className="flex gap-3">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#242039]">
                        {item.gift.image && (
                          <img
                            src={item.gift.image}
                            alt={item.gift.name}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold">
                          {item.gift.name}
                        </h3>

                        <div className="mt-2 flex items-center gap-1 text-green-400">
                          <TrendingDown size={15} />
                          <span className="text-sm font-bold">
                            {item.discount.toFixed(1)}% нижче орієнтира
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-gray-500">
                          Різниця: {item.spread.toFixed(2)}{" "}
                          {item.gift.currency}
                        </p>

                        <p className="mt-1 text-[10px] text-gray-500">
                          Порівняння: {item.referenceType}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-black/20 p-3">
                        <p className="text-[10px] text-gray-500">
                          Ціна лота
                        </p>
                        <p className="mt-1 text-sm font-bold text-green-300">
                          {item.gift.price} {item.gift.currency}
                        </p>
                      </div>

                      <div className="rounded-xl bg-black/20 p-3">
                        <p className="text-[10px] text-gray-500">
                          Ціна порівняння
                        </p>
                        <p className="mt-1 text-sm font-bold">
                          {item.referencePrice.toFixed(2)}{" "}
                          {item.gift.currency}
                        </p>
                      </div>
                    </div>

                    {getAttributes(item.gift.attributes).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {getAttributes(item.gift.attributes).map((label) => (
                          <span
                            key={label}
                            className="rounded-lg bg-white/5 px-2 py-1 text-[10px] text-gray-400"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.gift.url && (
                      <a
                        href={item.gift.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-violet-500 py-3 text-sm font-semibold"
                      >
                        Відкрити лот <ExternalLink size={15} />
                      </a>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "Portfolio" && (
          <section className="px-5">
            <h2 className="text-2xl font-bold">Portfolio</h2>
            <div className="mt-5 rounded-3xl border border-white/10 bg-[#151722] p-6 text-center">
              <Gift
                size={35}
                className="mx-auto text-violet-300/50"
              />
              <h3 className="mt-4 font-semibold">Portfolio coming soon</h3>
              <p className="mt-2 text-sm text-gray-500">
                Тут з'являться твої подарунки, витрати та результати
                перепродажів.
              </p>
            </div>
          </section>
        )}

        {activeTab === "Profile" && (
          <section className="px-5">
            <h2 className="text-2xl font-bold">Profile</h2>
            <div className="mt-5 rounded-3xl border border-white/10 bg-[#151722] p-6 text-center">
              <p className="text-sm text-gray-400">
                Налаштування GIFTFLIP з'являться тут.
              </p>
            </div>
          </section>
        )}

        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-[#0c0e16]/95 px-3 pb-5 pt-3 backdrop-blur">
          <div className="mx-auto grid max-w-md grid-cols-4">
            {(
              [
                ["Market", "🛍"],
                ["Flip", "🎁"],
                ["Portfolio", "💎"],
                ["Profile", "👤"],
              ] as [Tab, string][]
            ).map(([label, icon]) => (
              <button
                key={label}
                onClick={() => setActiveTab(label)}
                className={`flex flex-col items-center gap-1 text-xs ${
                  activeTab === label
                    ? "font-semibold text-violet-300"
                    : "text-gray-500"
                }`}
              >
                <span className="text-lg">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
