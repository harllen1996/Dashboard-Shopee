import express from "express";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/sheet", async (req, res) => {
    const sheetId = req.query.sheetId as string;
    const tabName = req.query.tabName as string;

    if (!sheetId || !tabName) {
      return res.status(400).json({ error: "Missing sheetId or tabName" });
    }

    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;

    try {
      const response = await fetch(csvUrl);
      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch from Google Sheets: ${response.statusText}`);
      }
      const csvText = await response.text();
      res.setHeader('Content-Type', 'text/csv');
      res.send(csvText);
    } catch (error: any) {
      console.error("Error fetching Google Sheet:", error);
      res.status(500).json({ error: "Failed to fetch from Google Sheets" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
