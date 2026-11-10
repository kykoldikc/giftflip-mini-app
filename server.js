import http from "node:http";
import { URL } from "node:url";

const PORT = process.env.PORT || 3001;
const CACHE_TTL = 15000;

const cache = new Map();
let portalsRequestRunning = false;

function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });

  res.end(JSON.stringify(data));
}

async function getPortalsGifts(search) {
  const apiKey = process.env.PORTALS_API_KEY;

  if (!apiKey) {
    throw new Error("Portals API key is missing");
  }

  const params = new URLSearchParams({
    status: "listed",
    limit: "50",
    sort_by: "price asc"
  });

  if (search) {
    params.set("search", search);
  }

  const response = await fetch(
    `https://portal-market.com/partners/nfts/search?${params}`,
    {
      headers: {
        Authorization: `partners ${apiKey}`
      },
      signal: AbortSignal.timeout(15000)
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Portals API error ${response.status}: ${
        data.message || "Unknown error"
      }`
    );
  }

  return (data.results || [])
    .filter(gift =>
      gift.status === "listed" &&
      gift.price !== null &&
      gift.price !== undefined
    )
    .map(gift => ({
      id: String(gift.id),
      name: gift.name,
      collection: gift.name,
      collectionId: gift.collection_id || null,
      number: gift.external_collection_number || null,
      price: Number(gift.price),
      floorPrice: gift.floor_price != null
        ? Number(gift.floor_price)
        : null,
      currency: "GRAM",
      image: gift.photo_url || null,
      attributes: Array.isArray(gift.attributes)
        ? gift.attributes
        : [],
      source: "Portals",
      status: gift.status,
      listedAt: gift.listed_at || null,
      unlocksAt: gift.unlocks_at || null,
      telegramId: gift.tg_id || null
    }));
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const requestUrl = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  );

  if (req.method === "GET" && requestUrl.pathname === "/health") {
    return send(res, 200, {
      status: "ok",
      service: "GIFTFLIP API"
    });
  }

  if (
    req.method === "GET" &&
    requestUrl.pathname === "/api/market/gifts"
  ) {
    const source = requestUrl.searchParams.get("source");

    if (!["MRKT", "Portals"].includes(source)) {
      return send(res, 400, {
        error: "Invalid market source"
      });
    }

    if (source === "MRKT") {
      return send(res, 200, {
        source: "MRKT",
        gifts: [],
        connected: false,
        message: "MRKT integration is awaiting official API access."
      });
    }

    const search = requestUrl.searchParams.get("search") || "";
    const cacheKey = `portals:${search.toLowerCase()}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return send(res, 200, cached.data);
    }

    if (portalsRequestRunning) {
      if (cached) {
        return send(res, 200, cached.data);
      }

      return send(res, 503, {
        error: "Market data is updating. Please try again shortly."
      });
    }

    portalsRequestRunning = true;

    try {
      const gifts = await getPortalsGifts(search);

      const result = {
        source: "Portals",
        gifts,
        connected: true,
        total: gifts.length,
        currency: "GRAM",
        updatedAt: new Date().toISOString()
      };

      cache.set(cacheKey, {
        time: Date.now(),
        data: result
      });

      return send(res, 200, result);

    } catch (error) {
      console.error("Portals error:", error);

      return send(res, 502, {
        error: "Could not load Portals market data",
        message: error.message
      });

    } finally {
      portalsRequestRunning = false;
    }
  }

  return send(res, 404, {
    error: "Not found"
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`GIFTFLIP API running on port ${PORT}`);
});
