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

      const allResults = [];

for (let offset = 0; offset < 200; offset += 50) {
  const pageParams = new URLSearchParams(params);

  pageParams.set("limit", "50");
  pageParams.set("offset", String(offset));

  const response = await fetch(
    `https://portal-market.com/partners/nfts/search?${pageParams}`,
    {
      headers: {
        Authorization: `partners ${apiKey}`
      }
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error("Portals API request failed");
  }

  const results = data.results || [];

  allResults.push(...results);

  if (results.length < 50) {
    break;
  }
}
