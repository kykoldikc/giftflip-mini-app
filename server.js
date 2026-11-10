import http from "node:http";
import { URL } from "node:url";

const PORT = process.env.PORT || 3001;

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
    res.writeHead(200, {
      "Content-Type": "application/json"
    });

    return res.end(JSON.stringify({
      status: "ok",
      service: "GIFTFLIP API"
    }));
  }

  if (
    req.method === "GET" &&
    requestUrl.pathname === "/api/market/gifts"
  ) {
    const source = requestUrl.searchParams.get("source");

    if (!["MRKT", "Portals"].includes(source)) {
      res.writeHead(400, {
        "Content-Type": "application/json"
      });

      return res.end(JSON.stringify({
        error: "Invalid market source"
      }));
    }

    if (source === "MRKT") {
      res.writeHead(200, {
        "Content-Type": "application/json"
      });

      return res.end(JSON.stringify({
        source: "MRKT",
        gifts: [],
        connected: false,
        message: "MRKT integration is not configured."
      }));
    }

    const apiKey = process.env.PORTALS_API_KEY;

    if (!apiKey) {
      res.writeHead(503, {
        "Content-Type": "application/json"
      });

      return res.end(JSON.stringify({
        error: "Portals API key is missing"
      }));
    }

    try {
      const params = new URLSearchParams();

      params.set("status", "listed");
      params.set("limit", "50");

      const search = requestUrl.searchParams.get("search");

      if (search) {
        params.set("search", search);
      }

      const response = await fetch(
        `https://portal-market.com/partners/nfts/search?${params}`,
        {
          headers: {
            Authorization: `partners ${apiKey}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Portals API error:", response.status, data);

        res.writeHead(response.status, {
          "Content-Type": "application/json"
        });

        return res.end(JSON.stringify({
          error: "Portals API request failed",
          status: response.status,
          message: data.message || "Unknown API error"
        }));
      }

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

      res.writeHead(200, {
        "Content-Type": "application/json"
      });

      return res.end(JSON.stringify({
        source: "Portals",
        gifts,
        connected: true,
        total: gifts.length
      }));

    } catch (error) {
      console.error("Portals connection error:", error);

      res.writeHead(502, {
        "Content-Type": "application/json"
      });

      return res.end(JSON.stringify({
        error: "Could not connect to Portals"
      }));
    }
  }

  res.writeHead(404, {
    "Content-Type": "application/json"
  });

  res.end(JSON.stringify({
    error: "Not found"
  }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`GIFTFLIP API running on port ${PORT}`);
});
