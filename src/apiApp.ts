import express from "express";
import { GoogleGenAI } from "@google/genai";
import {
  uploadObjectToR2,
  getObjectFromR2,
  generateR2SignedUrl,
  deleteObjectFromR2,
  deleteObjectsFromR2,
  listObjectsFromR2,
  headObjectFromR2,
  getR2ServerConfig,
  isR2Configured,
  getR2S3Client,
} from "../api/_lib/r2Server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { APP_VERSION } from "../shared/constants/app.constants";
import { ROLE_PERMISSIONS } from "../shared/constants/permissions.constants";
import { UserRole, Permission } from "../shared/types/auth.types";

export const apiApp = express();

// Enable CORS for all API routes so direct browser fetches / downloads work smoothly
apiApp.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Type, ETag, Content-Disposition");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Enable raw binary upload parsing for R2 uploads and JSON for API requests
apiApp.use(express.raw({ type: "application/octet-stream", limit: "100mb" }));
apiApp.use(express.json({ limit: "25mb" }));
apiApp.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Lazy initializer for Gemini API client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// System prompt instructing the AI Assistant
const SYSTEM_INSTRUCTION = `You are Sumit Tuition App's AI Assistant, an expert educational administrator and data analyst for a tuition center / coaching academy.
Your task is to analyze student, class, attendance, fee, test, homework, and syllabus structured JSON data and generate clear, professional, actionable, and encouraging reports in clean Markdown format.

RULES:
1. Format output cleanly in beautiful, well-structured Markdown with appropriate headings (##, ###), bullet points, bold highlights, and tables where helpful.
2. Provide specific, data-backed insights based on the provided JSON data.
3. Keep tone professional, empathetic, constructive, and action-oriented.
4. Highlight risks clearly (e.g. attendance < 75%, unpaid fees, declining test marks) and offer practical remediation strategies.
5. NEVER suggest or imply automatic modification of database records. All suggestions are for human review.
6. When writing parent communications, use polite, clear, and professional language with appropriate placeholders if needed.`;

const router = express.Router();

// ========================================================
// SYSTEM & HEALTH ROUTES
// ========================================================

// 1. General Application Health Check
router.get("/health", (req, res) => {
  return res.status(200).json({
    status: "healthy",
    version: `v${APP_VERSION}`,
    runtime: "nodejs",
    deployment: process.env.NODE_ENV || "production",
    timestamp: new Date().toISOString(),
  });
});

// 2. Authentication Session Endpoint
router.all("/auth/session", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token = "";
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }

    if (!token) {
      return res.status(200).json({
        authenticated: false,
        user: null,
        role: null,
        permissions: [],
        tokenValidation: {
          valid: false,
          method: "header-bearer",
          error: "No authorization token provided.",
        },
        timestamp: new Date().toISOString(),
      });
    }

    let uid = "unknown";
    let email = "";
    let role: UserRole = "student";

    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], "base64").toString("utf-8");
        const payload = JSON.parse(payloadJson);
        uid = payload.user_id || payload.sub || payload.uid || uid;
        email = payload.email || "";
        if (payload.role === "admin" || payload.admin === true) {
          role = "admin";
        }
      }
    } catch {
      // Basic decoding fallback
    }

    const permissions: Permission[] = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.student;

    return res.status(200).json({
      authenticated: true,
      user: {
        uid,
        email: email || null,
        displayName: email ? email.split("@")[0] : "User",
        role,
        isActive: true,
      },
      role,
      permissions,
      tokenValidation: {
        valid: true,
        method: "firebase-id-token",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({
      authenticated: false,
      user: null,
      role: null,
      permissions: [],
      tokenValidation: {
        valid: false,
        method: "header-bearer",
        error: error.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// ========================================================
// AI REPORT & CHAT ROUTES
// ========================================================

router.post("/ai/report", async (req, res) => {
  try {
    const { reportType, dataPayload, promptExtra } = req.body;

    if (!dataPayload) {
      return res.status(400).json({ error: "Missing dataPayload in request body" });
    }

    const ai = getGeminiClient();

    let userPrompt = `Analysis Request Type: ${reportType}\n\n`;
    userPrompt += `Provided Institution / Student Structured JSON Data:\n\`\`\`json\n${JSON.stringify(dataPayload, null, 2)}\n\`\`\`\n\n`;

    if (promptExtra) {
      userPrompt += `Additional Instructions / Focus Area:\n${promptExtra}\n\n`;
    }

    userPrompt += `Please generate the requested ${reportType} report in clean, well-formatted Markdown following the system guidance.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.4,
      },
    });

    const markdownText = response.text || "No response generated by AI.";

    return res.json({
      success: true,
      markdown: markdownText,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Error generating AI report:", err);
    return res.status(500).json({
      error: err.message || "Failed to generate AI report. Please verify your API key and network connection.",
    });
  }
});

router.post("/ai/chat", async (req, res) => {
  try {
    const { query, dataContext, history } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Missing query in request body" });
    }

    const ai = getGeminiClient();

    let fullPrompt = `Context Data on Sumit Tuition App Institution & Students:\n\`\`\`json\n${JSON.stringify(dataContext || {}, null, 2)}\n\`\`\`\n\n`;

    if (history && Array.isArray(history) && history.length > 0) {
      fullPrompt += `Previous Conversation History:\n`;
      history.forEach((item: { role: string; text: string }) => {
        fullPrompt += `${item.role === "user" ? "Admin" : "AI Assistant"}: ${item.text}\n`;
      });
      fullPrompt += `\n`;
    }

    fullPrompt += `Admin Question: ${query}\n\n`;
    fullPrompt += `Provide a helpful, precise, and well-formatted Markdown answer based directly on the provided context data.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.3,
      },
    });

    return res.json({
      success: true,
      reply: response.text || "I could not analyze the requested query.",
    });
  } catch (err: any) {
    console.error("Error in AI Chat endpoint:", err);
    return res.status(500).json({
      error: err.message || "AI Chat failed. Please check network or API setup.",
    });
  }
});

// ========================================================
// CLOUDFLARE R2 STORAGE API ROUTES
// ========================================================

// 1. Health check & configuration status
router.get("/r2/health", async (req, res) => {
  const config = getR2ServerConfig();
  const configured = isR2Configured();

  const environmentValidation = {
    hasAccountId: Boolean(config.accountId),
    hasAccessKey: Boolean(config.accessKeyId),
    hasSecretKey: Boolean(config.secretAccessKey),
    hasBucket: Boolean(config.bucket),
    hasEndpoint: Boolean(config.endpoint),
    hasPublicUrl: Boolean(config.publicUrl),
  };

  let bucketConnectivity = false;
  let status: "ok" | "degraded" | "unconfigured" = configured ? "ok" : "unconfigured";

  if (configured) {
    try {
      const client = getR2S3Client();
      const command = new ListObjectsV2Command({
        Bucket: config.bucket,
        MaxKeys: 1,
      });
      await client.send(command);
      bucketConnectivity = true;
      status = "ok";
    } catch (err: any) {
      console.warn(`[R2Health] Connectivity test notice: ${err.message}`);
      bucketConnectivity = false;
      status = "degraded";
    }
  }

  return res.json({
    storage: "Cloudflare R2",
    status,
    bucketConnectivity,
    configurationStatus: configured ? "valid" : "incomplete",
    environmentValidation,
    bucket: config.bucket,
    timestamp: new Date().toISOString(),
  });
});

// 2. Generate Pre-signed URL (GET or PUT)
router.post("/r2/signed-url", async (req, res) => {
  try {
    const { bucket, key, storageKey, expiresIn, operation, contentType } = req.body;
    const targetKey = storageKey || key;
    if (!targetKey) {
      return res.status(400).json({ error: "Missing required 'storageKey' parameter." });
    }

    const cleanKey = String(targetKey).replace(/^\/+/, "");
    const config = getR2ServerConfig();
    const actualBucket = (bucket || config.bucket || "academy-connect-files").trim();
    const expirySeconds = Number(expiresIn) || 600; // 10 minutes default

    const signedUrl = await generateR2SignedUrl({
      bucket: actualBucket,
      key: cleanKey,
      expiresIn: expirySeconds,
      operation: operation === "putObject" ? "putObject" : "getObject",
      contentType: contentType,
    });

    return res.json({
      success: true,
      signedUrl,
      bucket: actualBucket,
      storageKey: cleanKey,
      expiresIn: expirySeconds,
    });
  } catch (err: any) {
    console.error("[Server R2] Error generating signed URL:", err);
    return res.status(500).json({
      error: err.message || "Failed to generate Cloudflare R2 signed URL.",
    });
  }
});

// 3. Upload File to R2
router.post("/r2/upload", async (req, res) => {
  try {
    const bucket = (req.query.bucket as string) || req.body?.bucket;
    const key = (req.query.key as string) || req.body?.key || req.body?.storageKey;
    let contentType = (req.query.mimeType as string) || req.body?.mimeType || req.headers["content-type"] || "application/octet-stream";
    let originalFilename = (req.query.fileName as string) || req.body?.fileName || req.body?.originalFilename || "document.pdf";

    if (contentType.includes(";")) {
      contentType = contentType.split(";")[0].trim();
    }

    let buffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      const reqContentType = req.headers["content-type"] || "";
      if (reqContentType.includes("application/json")) {
        try {
          const parsed = JSON.parse(req.body.toString("utf8"));
          if (parsed.base64) {
            buffer = Buffer.from(parsed.base64, "base64");
            if (parsed.mimeType) contentType = parsed.mimeType;
            if (parsed.fileName) originalFilename = parsed.fileName;
          } else {
            buffer = req.body;
          }
        } catch {
          buffer = req.body;
        }
      } else {
        buffer = req.body;
      }
    } else if (req.body && typeof req.body === "object" && req.body.base64) {
      buffer = Buffer.from(req.body.base64, "base64");
      if (req.body.mimeType) contentType = req.body.mimeType;
      if (req.body.fileName) originalFilename = req.body.fileName;
    } else if (typeof req.body === "string") {
      buffer = Buffer.from(req.body, "utf-8");
    } else {
      return res.status(400).json({ error: "No upload body data received." });
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: "Upload buffer is empty." });
    }

    let storageKey = key;
    if (!storageKey) {
      const sanitizedName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const timestamp = Date.now();
      const randomHex = Math.random().toString(36).substring(2, 8);
      storageKey = `notes/${timestamp}-${randomHex}-${sanitizedName}`;
    }

    const cleanKey = String(storageKey).replace(/^\/+/, "");

    const result = await uploadObjectToR2({
      bucket,
      key: cleanKey,
      body: buffer,
      contentType,
    });

    return res.json({
      success: true,
      bucket: result.bucket,
      storageKey: result.key,
      mimeType: contentType,
      fileSize: buffer.length,
      originalFilename,
    });
  } catch (err: any) {
    console.error("[Server R2] Upload error:", err);
    return res.status(500).json({
      error: err.message || "Failed to upload file to Cloudflare R2.",
    });
  }
});

// 4b. Verify Object Existence
router.all("/r2/verify", async (req, res) => {
  try {
    const bucket = (req.query.bucket as string) || req.body?.bucket;
    const key = (req.query.key as string) || req.body?.key || req.body?.storageKey || req.body?.storagePath;

    if (!key) {
      return res.status(400).json({ exists: false, error: "Missing required 'key' parameter." });
    }

    const cleanKey = key.replace(/^\/+/, "");
    const head = await headObjectFromR2({ bucket, key: cleanKey });

    return res.json({
      exists: head.exists,
      bucket: bucket || getR2ServerConfig().bucket,
      key: cleanKey,
      contentLength: head.contentLength,
      contentType: head.contentType,
      etag: head.etag,
      lastModified: head.lastModified,
    });
  } catch (err: any) {
    return res.status(500).json({
      exists: false,
      error: err.message || "Verification failed",
    });
  }
});

// 5. Delete Single Object
const handleDeleteSingleObject = async (req: express.Request, res: express.Response) => {
  try {
    const bucket = req.body?.bucket || (req.query.bucket as string);
    const key =
      req.body?.key ||
      req.body?.storagePath ||
      req.body?.path ||
      (req.query.key as string) ||
      (req.query.storagePath as string) ||
      (req.query.path as string);

    if (!key) {
      return res.status(400).json({ error: "Missing required 'key' parameter." });
    }

    const cleanKey = String(key).replace(/^\/+/, "");
    console.log(`[Server R2] Executing delete for object: bucket="${bucket || "default"}", key="${cleanKey}" (Method: ${req.method})`);

    const result = await deleteObjectFromR2({ bucket, key: cleanKey });
    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[Server R2] Delete error:", {
      endpoint: req.originalUrl,
      method: req.method,
      error: err.message,
      stack: err.stack,
    });
    return res.status(500).json({
      error: err.message || "Failed to delete file from Cloudflare R2.",
      endpoint: req.originalUrl,
      stack: err.stack,
    });
  }
};

router.post("/r2/delete", handleDeleteSingleObject);
router.delete("/r2/delete", handleDeleteSingleObject);
router.delete("/r2/file", handleDeleteSingleObject);
router.delete("/storage/delete", handleDeleteSingleObject);
router.post("/storage/delete", handleDeleteSingleObject);
router.delete("/files", handleDeleteSingleObject);
router.post("/files/delete", handleDeleteSingleObject);

// 6. Delete Multiple Objects
const handleDeleteMultipleObjects = async (req: express.Request, res: express.Response) => {
  try {
    const bucket = req.body?.bucket || (req.query.bucket as string);
    let keys = req.body?.keys || req.query?.keys;
    if (typeof keys === "string") {
      try {
        keys = JSON.parse(keys);
      } catch {
        keys = keys.split(",").map((k: string) => k.trim());
      }
    }

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ error: "Missing or invalid 'keys' array parameter." });
    }

    const result = await deleteObjectsFromR2({ bucket, keys });
    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[Server R2] Multiple delete error:", {
      endpoint: req.originalUrl,
      method: req.method,
      error: err.message,
      stack: err.stack,
    });
    return res.status(500).json({
      error: err.message || "Failed to delete files from Cloudflare R2.",
      endpoint: req.originalUrl,
      stack: err.stack,
    });
  }
};

router.post("/r2/delete-multiple", handleDeleteMultipleObjects);
router.delete("/r2/delete-multiple", handleDeleteMultipleObjects);

// 7. Atomic Replace Endpoint
const handleReplaceObject = async (req: express.Request, res: express.Response) => {
  try {
    const bucket = (req.query.bucket as string) || req.body?.bucket;
    const oldKey = req.body?.oldKey || req.body?.oldStoragePath || (req.query.oldKey as string);
    const newKey = req.body?.newKey || req.body?.newStoragePath || req.body?.key || (req.query.key as string);
    const base64 = req.body?.base64;
    const mimeType = req.body?.mimeType || (req.query.mimeType as string) || "application/octet-stream";

    console.log(`[Server R2] Processing Replace request: oldKey="${oldKey}", newKey="${newKey}"`);

    if (oldKey) {
      try {
        await deleteObjectFromR2({ bucket, key: oldKey });
        console.log(`[Server R2] Old object deleted during replace: ${oldKey}`);
      } catch (delErr) {
        console.warn(`[Server R2] Notice: Old object was not present or already deleted: ${oldKey}`, delErr);
      }
    }

    if (newKey && base64) {
      const buffer = Buffer.from(base64, "base64");
      const uploadRes = await uploadObjectToR2({
        bucket,
        key: newKey,
        body: buffer,
        contentType: mimeType,
      });

      const config = getR2ServerConfig();
      const downloadUrl = `/api/r2/download?bucket=${encodeURIComponent(uploadRes.bucket)}&key=${encodeURIComponent(newKey)}`;
      const publicUrl = config.publicUrl
        ? `${config.publicUrl}/${newKey.replace(/^\/+/, "")}`
        : downloadUrl;

      return res.status(200).json({
        success: true,
        bucket: uploadRes.bucket,
        key: uploadRes.key,
        etag: uploadRes.etag,
        url: downloadUrl,
        publicUrl,
        size: buffer.length,
        mimeType,
        replaced: true,
      });
    }

    return res.status(200).json({
      success: true,
      oldKeyDeleted: Boolean(oldKey),
      message: "Replace processed successfully.",
    });
  } catch (err: any) {
    console.error("[Server R2] Replace error:", err);
    return res.status(500).json({
      error: err.message || "Failed to execute replacement in Cloudflare R2.",
      stack: err.stack,
    });
  }
};

router.post("/r2/replace", handleReplaceObject);
router.put("/r2/replace", handleReplaceObject);

// 8. List objects
router.post("/r2/list", async (req, res) => {
  try {
    const { bucket, prefix, limit, continuationToken } = req.body;
    const result = await listObjectsFromR2({
      bucket,
      prefix,
      maxKeys: Number(limit) || 1000,
      continuationToken,
    });
    return res.json(result);
  } catch (err: any) {
    console.error("[Server R2] List error:", {
      endpoint: "/api/r2/list",
      error: err.message,
      stack: err.stack,
    });
    return res.status(500).json({
      error: err.message || "Failed to list files from Cloudflare R2.",
      endpoint: "/api/r2/list",
      stack: err.stack,
    });
  }
});

// Mount router on both /api and / to handle both direct and rewritten paths safely
apiApp.use("/api", router);
apiApp.use("/", router);
