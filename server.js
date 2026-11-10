const http = require("http");
const { URL } = require("url");

const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
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
    res.writeHead(200, { "Content-Type": "application/json" });
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
    const allowedSources = ["MRKT", "Portals"];

    if (!allowedSources.includes(source)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        error: "Invalid market source"
      }));
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      source,
      gifts: [],
      connected: false,
      message: "Market integration is not configured yet."
    }));
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`GIFTFLIP API is running on port ${PORT}`);
});
