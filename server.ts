import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { apiApp } from "./src/apiApp";
import { getR2ServerConfig, isR2Configured } from "./src/lib/r2Server";

const app = express();
const PORT = 3000;

// Mount all API routes
app.use(apiApp);

// Vite Middleware & Static Production Handler
async function startServer() {
  try {
    if (process.env.NODE_ENV !== "production") {
      const hmrDisabled = process.env.DISABLE_HMR === "true";
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: hmrDisabled ? false : undefined,
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Server] Production-ready Applet running on http://localhost:${PORT}`);
      console.log(`[Server] Storage Backend: ${isR2Configured() ? "Cloudflare R2" : "Local Storage (R2 Fallback)"} (${getR2ServerConfig().bucket})`);
    });
  } catch (error) {
    console.error("[Server] Fatal bootstrap error:", error);
    process.exit(1);
  }
}

if (process.env.VERCEL !== "1") {
  startServer();
}

export default app;
