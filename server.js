import http from "node:http";
import { URL } from "node:url";

const PORT = process.env.PORT || 3001;
const PORTALS_BASE = "https://portal-market.com/partners";
const PORTALS_API_KEY = process.env.PORTALS_API_KEY;

const cache = new Map();
const pending = new Map();

let lastPortalsRequest = 0;
let requestQueue = Promise.resolve();

const CACHE_TTL = {
  market: 30 * 1000,
  attributes: 15 * 60 * 1000,
  activity: 60 * 1000,
  metrics: 5 * 60 * 1000
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });

  res.end(JSON.stringify(data));
}

function getCached(key) {
  const item = cache.get(key);

  if (!item || Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }

  return item.data;
}

function setCached(key, data, ttl) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttl
  });
}

function queuedRequest(task) {
  const current = requestQueue.then(async () => {
    const elapsed = Date.now() - lastPortalsRequest;
    const wait = Math.max(0, 1100 - elapsed);

    if (wait > 0) {
      await new Promise(resolve => setTimeout(resolve, wait));
    }

    lastPortalsRequest = Date.now();

    return task();
  });

  requestQueue = current.catch(() => {});
  return current;
}

async function portalsRequest(path, params = {}) {
  if (!PORTALS_API_KEY) {
    const error = new Error("Portals API key is missing");
    error.status = 503;
    throw error;
  }

  const url = new URL(`${PORTALS_BASE}${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return queuedRequest(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `partners ${PORTALS_API_KEY}`
        },
        signal: controller.signal
      });

      const text = await response.text();

      let data;

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        const error = new Error(
          data.message || `Portals API error: ${response.status}`
        );

        error.status = response.status;
        error.code = data.code || null;

        throw error;
      }

      return data;
    } finally {
      clearTimeout(timeout);
    }
  });
}

async function cachedRequest(key, ttl, loader) {
  const cached = getCached(key);

  if (cached) {
    return {
      ...cached,
      cached: true
    };
  }

  if (pending.has(key)) {
    return pending.get(key);
  }

  const request = loader()
    .then(data => {
      setCached(key, data, ttl);
      return {
        ...data,
        cached: false
      };
    })
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, request);

  return request;
}

function handleError(res, error) {
  console.error("GIFTFLIP API error:", error);

  const status = error.status || 502;

  sendJson(res, status, {
    error: "Market data request failed",
    message: error.message || "Unknown error",
    code: error.code || null
  });
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

  const path = requestUrl.pathname;

  if (req.method === "GET" && path === "/health") {
    return sendJson(res, 200, {
      status: "ok",
      service: "GIFTFLIP API"
    });
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, {
      error: "Method not allowed"
    });
  }

  // 1. Market listings

  if (path === "/api/market/gifts") {
    const source = requestUrl.searchParams.get("source");

    if (source !== "Portals" && source !== "MRKT") {
      return sendJson(res, 400, {
        error: "Invalid market source"
      });
    }

    if (source === "MRKT") {
      return sendJson(res, 200, {
        source: "MRKT",
        gifts: [],
        connected: false,
        message: "MRKT integration is not configured."
      });
    }

    const search = requestUrl.searchParams.get("search");
    const minPrice = requestUrl.searchParams.get("min_price");
    const maxPrice = requestUrl.searchParams.get("max_price");
    const sortBy = requestUrl.searchParams.get("sort_by");

    const params = {
      status: "listed",
      limit: 50,
      search,
      min_price: minPrice,
      max_price: maxPrice,
      sort_by: sortBy || "price asc"
    };

    const cacheKey = `market:${JSON.stringify(params)}`;

    try {
      const result = await cachedRequest(
        cacheKey,
        CACHE_TTL.market,
        async () => {
          const data = await portalsRequest(
            "/nfts/search",
            params
          );

          const gifts = (data.results || [])
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
              floorPrice: gift.floor_price
                ? Number(gift.floor_price)
                : null,
              currency: "GRAM",
              image: gift.photo_url || undefined,
              attributes: Array.isArray(gift.attributes)
                ? gift.attributes
                : [],
              source: "Portals",
              status: gift.status,
              listedAt: gift.listed_at || null,
              unlocksAt: gift.unlocks_at || null,
              telegramId: gift.tg_id || null
            }));

          return {
            source: "Portals",
            gifts,
            connected: true,
            total: gifts.length,
            totalCount: data.total_count ?? gifts.length,
            currency: "GRAM"
          };
        }
      );

      return sendJson(res, 200, result);
    } catch (error) {
      return handleError(res, error);
    }
  }

  // 2. Attribute floor prices

  if (path === "/api/market/attribute-floors") {
    try {
      const result = await cachedRequest(
        "attribute-floors",
        CACHE_TTL.attributes,
        async () => {
          const data = await portalsRequest(
            "/collections/attribute-floors"
          );

          return {
            source: "Portals",
            currency: "GRAM",
            attributeFloors: data.attribute_floors || {},
            updatedAt: data.updated_at || null
          };
        }
      );

      return sendJson(res, 200, result);
    } catch (error) {
      return handleError(res, error);
    }
  }

  // 3. Recent market activity and purchases

  if (path === "/api/market/activity") {
    const period =
      requestUrl.searchParams.get("period") || "seven_days";

    const collectionId =
      requestUrl.searchParams.get("collection_id");

    const limit = Math.min(
      20,
      Math.max(
        1,
        Number(requestUrl.searchParams.get("limit")) || 20
      )
    );

    const params = {
      action_types: "purchase",
      period,
      limit,
      collection_id: collectionId || undefined
    };

    const cacheKey = `activity:${JSON.stringify(params)}`;

    try {
      const result = await cachedRequest(
        cacheKey,
        CACHE_TTL.activity,
        async () => {
          const data = await portalsRequest(
            "/market/actions/",
            params
          );

          const purchases = (data.actions || [])
            .filter(action => action.type === "purchase")
            .map(action => ({
              type: action.type,
              amount: action.amount !== undefined
                ? Number(action.amount)
                : null,
              currency: "GRAM",
              createdAt: action.created_at || null,
              gift: action.nft || null
            }));

          return {
            source: "Portals",
            currency: "GRAM",
            period,
            purchases,
            total: purchases.length
          };
        }
      );

      return sendJson(res, 200, result);
    } catch (error) {
      return handleError(res, error);
    }
  }

  // 4. Collection market metrics

  if (path === "/api/market/metrics") {
    const collectionId =
      requestUrl.searchParams.get("collection_id");

    if (!collectionId) {
      return sendJson(res, 400, {
        error: "collection_id is required"
      });
    }

    const groupBy =
      requestUrl.searchParams.get("group_by") || "day";

    if (!["hour", "day", "week", "month"].includes(groupBy)) {
      return sendJson(res, 400, {
        error: "Invalid group_by value"
      });
    }

    const from =
      requestUrl.searchParams.get("from") ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString();

    const params = {
      group_by: groupBy,
      from
    };

    const cacheKey =
      `metrics:${collectionId}:${JSON.stringify(params)}`;

    try {
      const result = await cachedRequest(
        cacheKey,
        CACHE_TTL.metrics,
        async () => {
          const data = await portalsRequest(
            `/collections/${encodeURIComponent(collectionId)}/metrics`,
            params
          );

          const history = (data.history || []).map(item => ({
            time: item.interval_time || null,
            averagePrice: item.avg_price != null
              ? Number(item.avg_price)
              : null,
            floorPrice: item.floor_price != null
              ? Number(item.floor_price)
              : null,
            volume: item.total_volume != null
              ? Number(item.total_volume)
              : null,
            currency: "GRAM"
          }));

          return {
            source: "Portals",
            collectionId,
            currency: "GRAM",
            groupBy,
            history
          };
        }
      );

      return sendJson(res, 200, result);
    } catch (error) {
      return handleError(res, error);
    }
  }

  return sendJson(res, 404, {
    error: "Not found"
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`GIFTFLIP API running on port ${PORT}`);
});
