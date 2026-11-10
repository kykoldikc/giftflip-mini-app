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
  price: number;
  currency: string;
  image?: string;
  source: MarketSource;
  url?: string;
};

type MarketResponse = {
  gifts: MarketGift[];
};

const SOURCES: MarketSource[] = ["MRKT", "Portals"];

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
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
        throw new Error("Market API error");
      }

      const data: MarketResponse = await response.json();

      setGifts(Array.isArray(data.gifts) ? data.gifts : []);
    } catch {
      setGifts([]);
      setError("Market API ще не підключено.");
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
        (gift.collection?.toLowerCase() ?? "").includes(query)
      );
    });
  }, [gifts, search]);

  const opportunities = useMemo(() => {
    const groups = new Map<string, MarketGift[]>();

    gifts.forEach((gift) => {
      const key = gift.name.trim().toLowerCase();

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)!.push(gift);
    });

    const results: {
      gift: MarketGift;
      referencePrice: number;
      discount: number;
      comparableCount: number;
    }[] = [];

    groups.forEach((group) => {
      if (group.length < 3) return;

      const referencePrice = median(
        group.map((gift) => gift.price)
      );

      group.forEach((gift) => {
        const discount =
          ((referencePrice - gift.price) / referencePrice) * 100;

        if (discount >= 10) {
          results.push({
            gift,
            referencePrice,
            discount,
            comparableCount: group.length,
          });
        }
      });
    });

    return results.sort((a, b) => b.discount - a.discount);
  }, [gifts]);

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

                <h2 className="mt-3 text-2xl font-bold leading-tight">
                  Find your
                  <br />
                  next collectible.
                </h2>

                <p className="mt-2 max-w-[260px] text-sm leading-5 text-gray-400">
                  Explore collectible gifts from supported marketplaces.
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
                  {sort === "low"
                    ? "Price: low to high"
                    : "Price: high to low"}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-[#151722] p-1">
                {SOURCES.map((item) => (
                  <button
                    key={item}
                    onClick={() => setSource(item)}
                    className={`rounded-xl py-3 text-sm font-bold transition ${
                      source === item
                        ? "bg-violet-500 text-white shadow-lg"
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
                <Search size={18} className="shrink-0 text-gray-500" />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") loadGifts();
                  }}
                  placeholder="Search gifts or collections"
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                />

                <button
                  onClick={loadGifts}
                  className="text-violet-300"
                >
                  <SlidersHorizontal size={18} />
                </button>
              </div>
            </section>

            <section className="mt-6 px-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">Live listings</h2>

                <button
                  onClick={loadGifts}
                  className="flex items-center gap-1 text-xs text-violet-300"
                >
                  Refresh
                  <RefreshCw size={12} />
                </button>
              </div>

              {loading && (
                <div className="rounded-3xl border border-white/10 bg-[#12141e] px-5 py-10 text-center">
                  <RefreshCw
                    size={24}
                    className="mx-auto animate-spin text-violet-400"
                  />
                  <p className="mt-3 text-sm text-gray-400">
                    Loading marketplace...
                  </p>
                </div>
              )}

              {!loading && error && (
                <div className="rounded-3xl border border-amber-400/20 bg-amber-400/5 px-5 py-8 text-center">
                  <h3 className="font-semibold">
                    Marketplace connection pending
                  </h3>
                  <p className="mt-2 text-sm text-gray-400">
                    {error}
                  </p>
                  <button
                    onClick={loadGifts}
                    className="mt-5 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold"
                  >
                    Try again
                  </button>
                </div>
              )}

              {!loading && !error && filteredGifts.length === 0 && (
                <div className="rounded-3xl border border-white/10 bg-[#12141e] px-5 py-10 text-center">
                  <Gift
                    size={30}
                    className="mx-auto text-gray-500"
                  />
                  <h3 className="mt-4 font-semibold">
                    No listings found
                  </h3>
                </div>
              )}

              {!loading && !error && filteredGifts.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {filteredGifts.map((gift) => (
                    <article
                      key={gift.id}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-[#151722]"
                    >
                      <div className="relative flex aspect-square items-center justify-center bg-gradient-to-br from-[#242039] to-[#11131d]">
                        {gift.image ? (
                          <img
                            src={gift.image}
                            alt={gift.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Gift
                            size={42}
                            className="text-violet-300/40"
                          />
                        )}

                        <span className="absolute left-2 top-2 rounded-lg bg-black/50 px-2 py-1 text-[10px] font-bold">
                          {gift.source}
                        </span>
                      </div>

                      <div className="p-3">
                        <h3 className="truncate text-sm font-semibold">
                          {gift.name}
                        </h3>

                        {gift.collection && (
                          <p className="mt-1 truncate text-xs text-gray-500">
                            {gift.collection}
                          </p>
                        )}

                        <div className="mt-3 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] text-gray-500">
                              Price
                            </p>
                            <p className="text-sm font-bold text-violet-300">
                              {gift.price} {gift.currency}
                            </p>
                          </div>

                          {gift.url && (
                            <a
                              href={gift.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-violet-500/15 p-2 text-violet-300"
                            >
                              <ExternalLink size={15} />
                            </a>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
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

              <p className="mt-2 text-sm leading-5 text-gray-400">
                Порівнюємо ціни подарунків з однаковою назвою серед завантажених лотів.
              </p>

              <div className="mt-4 rounded-xl bg-black/20 p-3 text-xs text-gray-400">
                Аналізується поточна вибірка Portals. Це не повна ринкова оцінка.
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                Potential deals
              </h2>

              <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs text-violet-300">
                {opportunities.length} found
              </span>
            </div>

            {loading && (
              <div className="mt-4 rounded-2xl bg-[#151722] p-6 text-center text-sm text-gray-400">
                Scanning listings...
              </div>
            )}

            {!loading && opportunities.length === 0 && (
              <div className="mt-4 rounded-3xl border border-white/10 bg-[#12141e] px-5 py-10 text-center">
                <ScanSearch
                  size={36}
                  className="mx-auto text-violet-300/50"
                />

                <h3 className="mt-4 font-semibold">
                  No potential deals yet
                </h3>

                <p className="mt-2 text-sm leading-5 text-gray-500">
                  Потрібно щонайменше три лоти з однаковою назвою. Сканер також шукає ціну мінімум на 10% нижче медіани.
                </p>

                <button
                  onClick={loadGifts}
                  className="mt-5 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold"
                >
                  Scan again
                </button>
              </div>
            )}

            {!loading && opportunities.length > 0 && (
              <div className="mt-4 space-y-3">
                {opportunities.map((item) => (
                  <article
                    key={item.gift.id}
                    className="overflow-hidden rounded-2xl border border-green-400/20 bg-[#151722] p-3"
                  >
                    <div className="flex gap-3">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#242039]">
                        {item.gift.image ? (
                          <img
                            src={item.gift.image}
                            alt={item.gift.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Gift size={30} className="text-violet-300/50" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold">
                          {item.gift.name}
                        </h3>

                        <div className="mt-2 flex items-center gap-1 text-green-400">
                          <TrendingDown size={15} />
                          <span className="text-sm font-bold">
                            {item.discount.toFixed(1)}% below median
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-gray-500">
                          {item.comparableCount} comparable listings
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-black/20 p-3">
                        <p className="text-[10px] text-gray-500">
                          Listing price
                        </p>
                        <p className="mt-1 text-sm font-bold text-green-300">
                          {item.gift.price} {item.gift.currency}
                        </p>
                      </div>

                      <div className="rounded-xl bg-black/20 p-3">
                        <p className="text-[10px] text-gray-500">
                          Sample median
                        </p>
                        <p className="mt-1 text-sm font-bold text-white">
                          {item.referencePrice.toFixed(2)} {item.gift.currency}
                        </p>
                      </div>
                    </div>

                    {item.gift.url && (
                      <a
                        href={item.gift.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-violet-500 py-3 text-sm font-semibold"
                      >
                        Open listing
                        <ExternalLink size={15} />
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
              <Gift size={35} className="mx-auto text-violet-300/50" />
              <h3 className="mt-4 font-semibold">
                Portfolio coming soon
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Тут з'являться твої подарунки, витрати та результати перепродажів.
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
            {([
              ["Market", "🛍"],
              ["Flip", "🎁"],
              ["Portfolio", "💎"],
              ["Profile", "👤"],
            ] as [Tab, string][]).map(([label, icon]) => (
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
