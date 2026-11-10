import http from "node:http";
import { URL } from "node:url";

const PORT = process.env.PORT || 3001;

const MARKET_CACHE_TTL = 15000;
const ATTRIBUTE_CACHE_TTL = 10 * 60 * 1000;

const marketCache = new Map();

let portalsRequestRunning = false;
let attributeRequestRunning = false;

let attributeCache = {
  time: 0,
  data: null
};

function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });

  res.end(JSON.stringify(data));
}

function getApiKey() {
  const apiKey = process.env.PORTALS_API_KEY;

  if (!apiKey) {
    throw new Error("Portals API key is missing");
  }

  return apiKey;
}

async function portalsFetch(endpoint) {
  const response = await fetch(
    `https://portal-market.com${endpoint}`,
    {
      headers: {
        Authorization: `partners ${getApiKey()}`
      },
      signal: AbortSignal.timeout(20000)
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

  return data;
}

async function getPortalsGifts(search) {
  const params = new URLSearchParams({
    status: "listed",
    limit: "50",
    sort_by: "price asc"
  });

  if (search) {
    params.set("search", search);
  }

  const data = await portalsFetch(
    `/partners/nfts/search?${params.toString()}`
  );

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

async function getAttributeFloors() {
  const now = Date.now();

  if (
    attributeCache.data &&
    now - attributeCache.time < ATTRIBUTE_CACHE_TTL
  ) {
    return attributeCache.data;
  }

  if (attributeRequestRunning) {
    if (attributeCache.data) {
      return attributeCache.data;
    }

    throw new Error(
      "Attribute prices are updating. Please try again shortly."
    );
  }

  attributeRequestRunning = true;

  try {
    const data = await portalsFetch(
      "/partners/collections/attribute-floors"
    );

    if (
      !data.attribute_floors ||
      typeof data.attribute_floors !== "object"
    ) {
      throw new Error(
        "Portals returned an unexpected attribute_floors format"
      );
    }

    const result = {
      source: "Portals",
      currency: "GRAM",
      attributeFloors: data.attribute_floors,
      updatedAt: data.updated_at || null,
      fetchedAt: new Date().toISOString()
    };

    attributeCache = {
      time: Date.now(),
      data: result
    };

    return result;

  } finally {
    attributeRequestRunning = false;
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const requestUrl = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  );

  if (
    req.method === "GET" &&
    requestUrl.pathname === "/health"
  ) {
    return send(res, 200, {
      status: "ok",
      service: "GIFTFLIP API"
    });
  }

  if (
    req.method === "GET" &&
    requestUrl.pathname === "/api/market/attribute-floors"
  ) {
    try {
      const data = await getAttributeFloors();

      return send(res, 200, {
        connected: true,
        ...data
      });

    } catch (error) {
      console.error("Attribute floors error:", error);

      return send(res, 502, {
        connected: false,
        error: "Could not load attribute floor prices",
        message: error.message
      });
    }
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
        message:
          "MRKT integration is awaiting official API access."
      });
    }

    const search =
      requestUrl.searchParams.get("search") || "";

    const cacheKey = `portals:${search.toLowerCase()}`;

    const cached = marketCache.get(cacheKey);

    if (
      cached &&
      Date.now() - cached.time < MARKET_CACHE_TTL
    ) {
      return send(res, 200, cached.data);
    }

    if (portalsRequestRunning) {
      if (cached) {
        return send(res, 200, cached.data);
      }

      return send(res, 503, {
        error:
          "Market data is updating. Please try again shortly."
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

      marketCache.set(cacheKey, {
        time: Date.now(),
        data: result
      });

      return send(res, 200, result);

    } catch (error) {
      console.error("Portals market error:", error);

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
