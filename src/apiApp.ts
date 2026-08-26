import express from "express";
import storageHandler from "../api/storage";
import aiHandler from "../api/ai";
import notesHandler from "../api/notes";
import practiceTestsHandler from "../api/practice-tests";
import studentsHandler from "../api/students";
import authHandler from "../api/auth";
import healthHandler from "../api/health";

export const apiApp = express();

// Enable CORS for all API routes so direct browser fetches / downloads work smoothly
apiApp.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range, Authorization, X-Requested-With, Accept");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Type, ETag, Content-Disposition");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Enable raw binary upload parsing for storage uploads (PDFs, Images, Octet-stream, Multipart) and JSON/urlencoded for API requests
apiApp.use(express.json({ limit: "50mb" }));
apiApp.use(express.urlencoded({ extended: true, limit: "50mb" }));
apiApp.use(
  express.raw({
    type: (req) => {
      const ct = (req.headers["content-type"] || "").toLowerCase();
      // Parse raw buffer for non-JSON requests (such as pdf, images, octet-stream, multipart, etc.)
      return !ct.includes("application/json") && !ct.includes("application/x-www-form-urlencoded");
    },
    limit: "100mb",
  })
);

const router = express.Router();

// ========================================================
// CONSOLIDATED PHASE 9 VERCEL SERVERLESS ENDPOINTS
// ========================================================

// 1. Storage API (/api/storage)
router.all("/storage", (req, res) => storageHandler(req, res));

// 2. AI API (/api/ai)
router.all("/ai", (req, res) => aiHandler(req, res));

// 3. Notes API (/api/notes, /api/notes/upload, /api/notes/:id/replace, /api/notes/:id, /api/admin/notes, /api/student/notes)
router.post("/notes/upload", (req, res) => {
  req.query.action = "upload";
  return notesHandler(req, res);
});
router.put("/notes/:id/replace", (req, res) => {
  req.query.action = "replace";
  return notesHandler(req, res);
});
router.delete("/notes/:id", (req, res) => {
  req.query.action = "delete";
  return notesHandler(req, res);
});
router.get("/admin/notes", (req, res) => {
  req.query.action = "admin";
  return notesHandler(req, res);
});
router.get("/student/notes", (req, res) => {
  req.query.action = "student";
  return notesHandler(req, res);
});
router.all("/notes", (req, res) => notesHandler(req, res));

// 4. Practice Tests API (/api/practice-tests)
router.all("/practice-tests", (req, res) => practiceTestsHandler(req, res));

// 5. Students API (/api/students)
router.all("/students", (req, res) => studentsHandler(req, res));

// 6. Auth API (/api/auth)
router.all("/auth", (req, res) => authHandler(req, res));

// 7. Health API (/api/health)
router.all("/health", (req, res) => healthHandler(req, res));

// ========================================================
// BACKWARD COMPATIBILITY ALIASES (ZERO REGRESSION)
// ========================================================

// Legacy R2 Routes forwarded to storageHandler with action
router.all("/r2/health", (req, res) => healthHandler(req, res));
router.all("/r2/signed-url", (req, res) => {
  req.query.action = "signed-url";
  return storageHandler(req, res);
});
router.all("/r2/upload", (req, res) => {
  req.query.action = "upload";
  return storageHandler(req, res);
});
router.all("/r2/download", (req, res) => {
  req.query.action = "download";
  return storageHandler(req, res);
});
router.all("/r2/verify", (req, res) => {
  req.query.action = "verify";
  return storageHandler(req, res);
});
router.all("/r2/delete", (req, res) => {
  req.query.action = "delete";
  return storageHandler(req, res);
});
router.all("/r2/delete-multiple", (req, res) => {
  req.query.action = "delete-multiple";
  return storageHandler(req, res);
});
router.all("/r2/replace", (req, res) => {
  req.query.action = "replace";
  return storageHandler(req, res);
});
router.all("/r2/list", (req, res) => {
  req.query.action = "list";
  return storageHandler(req, res);
});
router.all("/storage/delete", (req, res) => {
  req.query.action = "delete";
  return storageHandler(req, res);
});

// Legacy AI Routes forwarded to aiHandler with action
router.all("/ai/chat", (req, res) => {
  req.query.action = "chat";
  return aiHandler(req, res);
});
router.all("/ai/report", (req, res) => {
  req.query.action = "report";
  return aiHandler(req, res);
});
router.all("/ai/notes/analyze", (req, res) => {
  req.query.action = "notes";
  return aiHandler(req, res);
});
router.all("/ai/practice-test/generate", (req, res) => {
  req.query.action = "practice-test";
  return aiHandler(req, res);
});
router.all("/ai/homework/generate", (req, res) => {
  req.query.action = "homework";
  return aiHandler(req, res);
});
router.all("/ai/analytics/insights", (req, res) => {
  req.query.action = "analytics";
  return aiHandler(req, res);
});
router.all("/ai/search", (req, res) => {
  req.query.action = "search";
  return aiHandler(req, res);
});
router.all("/ai/moderation", (req, res) => {
  req.query.action = "moderation";
  return aiHandler(req, res);
});
router.all("/ai/metrics", (req, res) => {
  req.query.action = "metrics";
  return aiHandler(req, res);
});
router.all("/ai/limits", (req, res) => {
  req.query.action = "limits";
  return aiHandler(req, res);
});

// Mount router on both /api and /
apiApp.use("/api", router);
apiApp.use("/", router);
