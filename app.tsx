import { useEffect, useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  RefreshCw,
  ExternalLink,
  Gift,
  ChevronDown,
  ArrowUpDown,
} from "lucide-react";

type MarketSource = "MRKT" | "Portals";

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

export default function App() {
  const [source, setSource] = useState<MarketSource>("Portals");
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

      const response = await fetch(`https://giftflip-api.onrender.com/api/market/gifts?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Market API is not connected yet.");
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
      const name = gift.name.toLowerCase();
      const collection = gift.collection?.toLowerCase() ?? "";

      return name.includes(query) || collection.includes(query);
    });
  }, [gifts, search]);

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
            aria-label="Refresh market"
          >
            <RefreshCw
              size={20}
              className={loading ? "animate-spin" : ""}
            />
          </button>
        </header>

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
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              API connection pending
            </div>
          </div>
        </section>

        <section className="mt-6 px-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Marketplace</h2>

            <button
              onClick={() => setSort(sort === "low" ? "high" : "low")}
              className="flex items-center gap-1.5 text-xs text-gray-400"
            >
              <ArrowUpDown size={14} />
              {sort === "low" ? "Price: low to high" : "Price: high to low"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-[#151722] p-1">
            {SOURCES.map((item) => (
              <button
                key={item}
                onClick={() => setSource(item)}
                className={`rounded-xl py-3 text-sm font-bold transition ${
                  source === item
                    ? "bg-violet-500 text-white shadow-lg shadow-violet-900/30"
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
                if (event.key === "Enter") {
                  loadGifts();
                }
              }}
              placeholder="Search gifts or collections"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
            />

            <button
              onClick={loadGifts}
              className="text-violet-300"
              aria-label="Search"
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
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
                <Gift size={23} />
              </div>

              <h3 className="mt-4 font-semibold">
                Marketplace connection pending
              </h3>

              <p className="mx-auto mt-2 max-w-[260px] text-sm leading-5 text-gray-400">
                {error} Реальні лоти з'являться після налаштування сервера.
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
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-gray-500">
                <Gift size={23} />
              </div>

              <h3 className="mt-4 font-semibold">No listings found</h3>

              <p className="mt-2 text-sm text-gray-500">
                There are no matching listings right now.
              </p>
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
                      <Gift size={42} className="text-violet-300/40" />
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
                        <p className="text-[10px] text-gray-500">Price</p>

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
                          aria-label="Open listing"
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

        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-[#0c0e16]/95 px-3 pb-5 pt-3 backdrop-blur">
          <div className="mx-auto grid max-w-md grid-cols-4">
            {[
              ["Market", "🛍"],
              ["Flip", "🎁"],
              ["Portfolio", "💎"],
              ["Profile", "👤"],
            ].map(([label, icon]) => (
              <button
                key={label}
                className={`flex flex-col items-center gap-1 text-xs ${
                  label === "Market"
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
