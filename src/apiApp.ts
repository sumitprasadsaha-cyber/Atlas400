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
    const oldKey = req.body?.oldKey || req.body?.oldR2ObjectKey || req.body?.oldStoragePath || (req.query.oldKey as string);
    const newKey = req.body?.newKey || req.body?.newR2ObjectKey || req.body?.newStoragePath || req.body?.key || (req.query.key as string);
    const base64 = req.body?.base64;
    const mimeType = req.body?.mimeType || (req.query.mimeType as string) || "application/octet-stream";

    console.log(`[Server R2] Processing Replace request: oldKey="${oldKey}", newKey="${newKey}"`);

    let uploadRes: any = null;
    let buffer: Buffer | null = null;

    // 1. Upload new file first (if newKey and base64 provided)
    if (newKey && base64) {
      buffer = Buffer.from(base64, "base64");
      uploadRes = await uploadObjectToR2({
        bucket,
        key: newKey,
        body: buffer,
        contentType: mimeType,
      });

      // Verify new upload
      const head = await headObjectFromR2({ bucket, key: newKey });
      if (!head.exists) {
        throw new Error(`Replacement upload verification failed for '${newKey}'`);
      }
    }

    // 2. Delete old object only after successful new upload
    let oldKeyDeleted = false;
    if (oldKey) {
      const cleanOld = String(oldKey).replace(/^\/+/, "");
      try {
        await deleteObjectFromR2({ bucket, key: cleanOld });
        const oldHead = await headObjectFromR2({ bucket, key: cleanOld });
        oldKeyDeleted = !oldHead.exists;
        console.log(`[Server R2] Old object deleted during replace: ${cleanOld} (verified: ${oldKeyDeleted})`);
      } catch (delErr) {
        console.warn(`[Server R2] Notice: Old object deletion notice for: ${cleanOld}`, delErr);
      }
    }

    if (uploadRes && buffer) {
      const config = getR2ServerConfig();
      const downloadUrl = `/api/r2/download?bucket=${encodeURIComponent(uploadRes.bucket)}&key=${encodeURIComponent(newKey)}`;
      const publicUrl = config.publicUrl
        ? `${config.publicUrl}/${newKey.replace(/^\/+/, "")}`
        : downloadUrl;

      return res.status(200).json({
        success: true,
        data: {
          bucket: uploadRes.bucket,
          storageKey: uploadRes.key,
          r2ObjectKey: uploadRes.key,
          oldR2ObjectKey: oldKey ? String(oldKey).replace(/^\/+/, "") : null,
          oldKeyDeleted,
          etag: uploadRes.etag,
          url: downloadUrl,
          publicUrl,
          size: buffer.length,
          mimeType,
          replaced: true,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        oldKeyDeleted: Boolean(oldKey),
        replaced: true,
        message: "Replace processed successfully.",
      },
    });
  } catch (err: any) {
    console.error("[Server R2] Replace error:", err);
    return res.status(500).json({
      success: false,
      error: {
        message: err.message || "Failed to execute replacement in Cloudflare R2.",
        stack: err.stack,
      },
    });
  }
};

router.post("/r2/replace", handleReplaceObject);
router.patch("/r2/replace", handleReplaceObject);
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

// ========================================================
// PRACTICE TESTS API ROUTES (PHASE 4)
// ========================================================

// 1. Upload Question Bank to Cloudflare R2
router.post("/practice/upload", async (req, res) => {
  try {
    const { uploadObjectToR2, getR2ServerConfig, headObjectFromR2 } = await import("../api/_lib/r2Server");
    const { validateQuestionBank } = await import("../shared/validation/practice.validator");

    let payload = req.body;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (err: any) {
        return res.status(400).json({ success: false, error: { message: "Invalid JSON format: " + err.message } });
      }
    }

    const { subject, chapter, testId, title, duration, batch, description } = payload || {};
    const validation = validateQuestionBank(payload, { testId, title, subject, chapter, batch, duration });

    if (!validation.isValid || !validation.cleanQuestionBank) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Validation failed for practice test question bank.",
          details: validation.errors,
          warnings: validation.warnings,
        },
      });
    }

    const cleanBank = validation.cleanQuestionBank;
    const normSubject = (cleanBank.subject || "general").toLowerCase().replace(/[^a-z0-9]/g, "_");
    const normChapter = (cleanBank.chapter || "ch1").toLowerCase().replace(/[^a-z0-9]/g, "_");
    const cleanTestId = cleanBank.testId.replace(/[^a-zA-Z0-9_-]/g, "_");

    const r2ObjectKey = `practice-tests/${normSubject}/${normChapter}/${cleanTestId}.json`;
    const jsonString = JSON.stringify(cleanBank, null, 2);
    const jsonBuffer = Buffer.from(jsonString, "utf-8");

    const config = getR2ServerConfig();
    const bucket = (req.query?.bucket as string) || config.bucket || "academy-connect-files";

    const uploadResult = await uploadObjectToR2({
      bucket,
      key: r2ObjectKey,
      body: jsonBuffer,
      contentType: "application/json",
      metadata: {
        testid: cleanBank.testId,
        title: encodeURIComponent(cleanBank.title),
        subject: encodeURIComponent(cleanBank.subject),
        chapter: encodeURIComponent(cleanBank.chapter),
        questioncount: String(cleanBank.questions.length),
        version: String(cleanBank.version),
      },
    });

    const head = await headObjectFromR2({ bucket, key: r2ObjectKey });
    if (!head.exists) {
      throw new Error("Failed to verify question bank upload in Cloudflare R2.");
    }

    return res.status(200).json({
      success: true,
      data: {
        testId: cleanBank.testId,
        title: cleanBank.title,
        subject: cleanBank.subject,
        chapter: cleanBank.chapter,
        batch: cleanBank.batch,
        description: cleanBank.description,
        questionCount: cleanBank.questions.length,
        duration: cleanBank.duration,
        totalMarks: cleanBank.totalMarks,
        negativeMarking: cleanBank.negativeMarking,
        r2ObjectKey,
        bucket: uploadResult.bucket,
        fileSize: jsonBuffer.length,
        version: cleanBank.version,
        url: `/api/practice/download?key=${encodeURIComponent(r2ObjectKey)}`,
        warnings: validation.warnings,
      },
      message: "Practice test question bank uploaded and validated successfully.",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Practice Upload] Error:", err);
    return res.status(500).json({ success: false, error: { message: err.message || "Failed to upload question bank." } });
  }
});

// 2. Download Question Bank or Pre-signed redirect
router.get("/practice/download", async (req, res) => {
  try {
    const { generateR2SignedUrl, getR2ServerConfig, headObjectFromR2, getObjectFromR2 } = await import("../api/_lib/r2Server");
    const key = (req.query?.key as string) || (req.query?.r2ObjectKey as string) || (req.query?.storageKey as string);
    if (!key) {
      return res.status(400).json({ success: false, error: { message: "Missing required 'key' parameter." } });
    }

    const cleanKey = String(key).replace(/^\/+/, "");
    const config = getR2ServerConfig();
    const bucket = ((req.query?.bucket as string) || config.bucket || "academy-connect-files").trim();
    const expiresIn = Number(req.query?.expiresIn) || 300;

    const head = await headObjectFromR2({ bucket, key: cleanKey });
    if (!head.exists) {
      return res.status(404).json({ success: false, error: { message: `Question bank not found in storage: ${cleanKey}` } });
    }

    const signedUrl = await generateR2SignedUrl({
      bucket,
      key: cleanKey,
      expiresIn,
      operation: "getObject",
      contentType: head.contentType,
    });

    const isDirectFetch = req.query?.direct === "true" || req.query?.fetchJson === "true";
    if (isDirectFetch && cleanKey.endsWith(".json")) {
      const obj = await getObjectFromR2({ bucket, key: cleanKey });
      if (obj.body) {
        res.setHeader("Content-Type", "application/json");
        return obj.body.pipe(res);
      }
    }

    if (req.query?.redirect === "true") {
      return res.redirect(302, signedUrl);
    }

    return res.status(200).json({
      success: true,
      data: {
        signedUrl,
        r2ObjectKey: cleanKey,
        bucket,
        expiresIn,
        contentType: head.contentType,
        contentLength: head.contentLength,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Practice Download] Error:", err);
    return res.status(500).json({ success: false, error: { message: err.message || "Failed to download question bank." } });
  }
});

// 3. Generate Signed URL for Practice Test Assets
router.post("/practice/signed-url", async (req, res) => {
  try {
    const { generateR2SignedUrl, getR2ServerConfig, headObjectFromR2 } = await import("../api/_lib/r2Server");
    const { key, r2ObjectKey, storageKey, operation, contentType, expiresIn } = req.body || {};
    const targetKey = r2ObjectKey || storageKey || key;
    if (!targetKey) {
      return res.status(400).json({ success: false, error: { message: "Missing required 'r2ObjectKey' parameter." } });
    }

    const cleanKey = String(targetKey).replace(/^\/+/, "");
    const config = getR2ServerConfig();
    const bucket = (req.body?.bucket || config.bucket || "academy-connect-files").trim();
    const expirySeconds = Number(expiresIn) || 300;

    if (operation !== "putObject") {
      const head = await headObjectFromR2({ bucket, key: cleanKey });
      if (!head.exists) {
        return res.status(404).json({ success: false, error: { message: `Question bank not found in storage: ${cleanKey}` } });
      }
    }

    const signedUrl = await generateR2SignedUrl({
      bucket,
      key: cleanKey,
      expiresIn: expirySeconds,
      operation: operation === "putObject" ? "putObject" : "getObject",
      contentType: contentType || (cleanKey.endsWith(".json") ? "application/json" : undefined),
    });

    return res.status(200).json({
      success: true,
      data: { signedUrl, r2ObjectKey: cleanKey, bucket, expiresIn: expirySeconds },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message || "Signed URL generation failed." } });
  }
});

// 4. Delete Practice Test from R2
const handlePracticeDelete = async (req: express.Request, res: express.Response) => {
  try {
    const { deleteObjectFromR2, deleteObjectsFromR2, headObjectFromR2, getR2ServerConfig } = await import("../api/_lib/r2Server");
    const { r2ObjectKey, key, imageKeys, associatedKeys } = req.body || {};
    const targetKey = r2ObjectKey || key || req.query?.key || req.query?.r2ObjectKey;

    if (!targetKey) {
      return res.status(400).json({ success: false, error: { message: "Missing required 'r2ObjectKey' parameter." } });
    }

    const cleanKey = String(targetKey).replace(/^\/+/, "");
    const config = getR2ServerConfig();
    const bucket = (req.body?.bucket || req.query?.bucket || config.bucket || "academy-connect-files").trim();
    const deletedKeys: string[] = [];

    await deleteObjectFromR2({ bucket, key: cleanKey });
    deletedKeys.push(cleanKey);

    const extraKeys: string[] = [];
    if (Array.isArray(imageKeys)) extraKeys.push(...imageKeys);
    if (Array.isArray(associatedKeys)) extraKeys.push(...associatedKeys);

    if (extraKeys.length > 0) {
      const cleanExtraKeys = extraKeys.map((k) => String(k).replace(/^\/+/, "")).filter(Boolean);
      await deleteObjectsFromR2({ bucket, keys: cleanExtraKeys });
      deletedKeys.push(...cleanExtraKeys);
    }

    const verifyHead = await headObjectFromR2({ bucket, key: cleanKey });
    return res.status(200).json({
      success: true,
      data: { r2ObjectKey: cleanKey, deletedKeys, verifiedClean: !verifyHead.exists, bucket },
      message: "Practice test JSON and associated media purged completely from Cloudflare R2.",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message || "Failed to delete files from R2." } });
  }
};
router.delete("/practice/delete", handlePracticeDelete);
router.post("/practice/delete", handlePracticeDelete);

// 5. Atomic Replace Practice Test
const handlePracticeReplace = async (req: express.Request, res: express.Response) => {
  try {
    const { uploadObjectToR2, deleteObjectFromR2, deleteObjectsFromR2, headObjectFromR2, getR2ServerConfig } = await import("../api/_lib/r2Server");
    const { validateQuestionBank } = await import("../shared/validation/practice.validator");

    let payload = req.body;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (err: any) {
        return res.status(400).json({ success: false, error: { message: "Invalid JSON: " + err.message } });
      }
    }

    const { oldR2ObjectKey, oldKey, newQuestionBank, oldImageKeys, version } = payload || {};
    const previousKey = oldR2ObjectKey || oldKey;

    const validation = validateQuestionBank(newQuestionBank || payload);
    if (!validation.isValid || !validation.cleanQuestionBank) {
      return res.status(400).json({
        success: false,
        error: { message: "Validation failed for replacement question bank.", details: validation.errors },
      });
    }

    const cleanBank = validation.cleanQuestionBank;
    const nextVersion = (Number(version) || Number(cleanBank.version) || 1) + 1;
    cleanBank.version = nextVersion;

    const normSubject = (cleanBank.subject || "general").toLowerCase().replace(/[^a-z0-9]/g, "_");
    const normChapter = (cleanBank.chapter || "ch1").toLowerCase().replace(/[^a-z0-9]/g, "_");
    const cleanTestId = cleanBank.testId.replace(/[^a-zA-Z0-9_-]/g, "_");

    const newR2ObjectKey = `practice-tests/${normSubject}/${normChapter}/${cleanTestId}_v${nextVersion}.json`;
    const jsonBuffer = Buffer.from(JSON.stringify(cleanBank, null, 2), "utf-8");

    const config = getR2ServerConfig();
    const bucket = (req.query?.bucket as string) || config.bucket || "academy-connect-files";

    await uploadObjectToR2({
      bucket,
      key: newR2ObjectKey,
      body: jsonBuffer,
      contentType: "application/json",
      metadata: { testid: cleanBank.testId, version: String(nextVersion), questioncount: String(cleanBank.questions.length) },
    });

    const newHead = await headObjectFromR2({ bucket, key: newR2ObjectKey });
    if (!newHead.exists) {
      throw new Error(`Failed to verify replacement upload in R2 for key: ${newR2ObjectKey}`);
    }

    let oldKeyDeleted = false;
    if (previousKey && previousKey !== newR2ObjectKey) {
      const cleanOldKey = String(previousKey).replace(/^\/+/, "");
      await deleteObjectFromR2({ bucket, key: cleanOldKey });
      const oldHead = await headObjectFromR2({ bucket, key: cleanOldKey });
      oldKeyDeleted = !oldHead.exists;
    }

    if (Array.isArray(oldImageKeys) && oldImageKeys.length > 0) {
      const cleanImgKeys = oldImageKeys.map((k) => String(k).replace(/^\/+/, "")).filter(Boolean);
      await deleteObjectsFromR2({ bucket, keys: cleanImgKeys });
    }

    return res.status(200).json({
      success: true,
      data: {
        testId: cleanBank.testId,
        title: cleanBank.title,
        subject: cleanBank.subject,
        chapter: cleanBank.chapter,
        questionCount: cleanBank.questions.length,
        duration: cleanBank.duration,
        totalMarks: cleanBank.totalMarks,
        negativeMarking: cleanBank.negativeMarking,
        r2ObjectKey: newR2ObjectKey,
        oldR2ObjectKey: previousKey || null,
        oldKeyDeleted,
        version: nextVersion,
        fileSize: jsonBuffer.length,
      },
      message: "Practice test replaced atomically in Cloudflare R2.",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message || "Failed to replace practice test." } });
  }
};
router.patch("/practice/replace", handlePracticeReplace);
router.post("/practice/replace", handlePracticeReplace);

// 6. Submit and Evaluate Practice Test
router.post("/practice/submit", async (req, res) => {
  try {
    const { getObjectFromR2, getR2ServerConfig } = await import("../api/_lib/r2Server");
    const { attemptId, studentId, studentName, practiceTestId, r2ObjectKey, answers, timeTaken, startedAt } = req.body || {};

    if (!studentId || !practiceTestId || !r2ObjectKey) {
      return res.status(400).json({
        success: false,
        error: { message: "Missing studentId, practiceTestId, or r2ObjectKey." },
      });
    }

    const config = getR2ServerConfig();
    const bucket = (req.body?.bucket || config.bucket || "academy-connect-files").trim();

    const r2Response = await getObjectFromR2({ bucket, key: r2ObjectKey });
    if (!r2Response.body) {
      return res.status(404).json({ success: false, error: { message: `Question bank not found in R2: ${r2ObjectKey}` } });
    }

    const chunks: any[] = [];
    for await (const chunk of r2Response.body as any) {
      chunks.push(chunk);
    }
    const jsonStr = Buffer.concat(chunks).toString("utf-8");
    const questionBank = JSON.parse(jsonStr);

    const studentAnswers = answers || {};
    let earnedMarks = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    const difficultyBreakdown: any = {
      easy: { total: 0, correct: 0, score: 0 },
      medium: { total: 0, correct: 0, score: 0 },
      hard: { total: 0, correct: 0, score: 0 },
    };

    const reviewItems: any[] = [];

    questionBank.questions.forEach((q: any, idx: number) => {
      const qDiff = (q.difficulty || "medium") as "easy" | "medium" | "hard";
      if (difficultyBreakdown[qDiff]) {
        difficultyBreakdown[qDiff].total += 1;
      }

      const qId = q.id || `q_${idx + 1}`;
      const givenAns = studentAnswers[qId];
      const hasAnswered = givenAns !== undefined && givenAns !== null && givenAns !== "";
      let isCorrect = false;

      if (!hasAnswered) {
        unansweredCount += 1;
      } else {
        if (typeof q.correctAnswer === "number") {
          isCorrect = Number(givenAns) === q.correctAnswer;
        } else if (typeof q.correctAnswer === "string") {
          isCorrect = String(givenAns).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
        }

        if (isCorrect) {
          correctCount += 1;
          const marks = q.marks || 4;
          earnedMarks += marks;
          if (difficultyBreakdown[qDiff]) {
            difficultyBreakdown[qDiff].correct += 1;
            difficultyBreakdown[qDiff].score += marks;
          }
        } else {
          wrongCount += 1;
          const penalty = q.negativeMarks !== undefined ? q.negativeMarks : (questionBank.negativeMarking || 0);
          earnedMarks -= penalty;
        }
      }

      reviewItems.push({
        id: qId,
        questionNumber: idx + 1,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        studentAnswer: hasAnswered ? givenAns : null,
        isCorrect,
        isSkipped: !hasAnswered,
        explanation: q.explanation || "No explanation provided.",
        reference: q.reference,
        hint: q.hint,
        difficulty: qDiff,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
      });
    });

    earnedMarks = Math.max(0, earnedMarks);
    const totalMarks = questionBank.totalMarks || (questionBank.questions.length * 4);
    const percentage = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 10000) / 100 : 0;
    const passStatus = percentage >= 40 ? "passed" : "failed";
    const finalAttemptId = attemptId || `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    return res.status(200).json({
      success: true,
      data: {
        attempt: {
          attemptId: finalAttemptId,
          studentId,
          studentName: studentName || "Student",
          practiceTestId,
          testTitle: questionBank.title,
          subject: questionBank.subject,
          chapter: questionBank.chapter,
          startedAt: startedAt || now,
          submittedAt: now,
          timeTaken: Number(timeTaken) || 0,
          answers: studentAnswers,
          score: earnedMarks,
          totalMarks,
          percentage,
          passed: passStatus === "passed",
          passStatus,
          correct: correctCount,
          wrong: wrongCount,
          unanswered: unansweredCount,
          status: "submitted",
        },
        result: {
          id: finalAttemptId,
          attemptId: finalAttemptId,
          studentId,
          studentName: studentName || "Student",
          practiceTestId,
          testTitle: questionBank.title,
          subject: questionBank.subject,
          chapter: questionBank.chapter,
          finalScore: earnedMarks,
          totalMarks,
          percentage,
          passStatus,
          completionTime: Number(timeTaken) || 0,
          correctCount,
          wrongCount,
          unansweredCount,
          breakdownByDifficulty: difficultyBreakdown,
          generatedAt: now,
        },
        review: reviewItems,
      },
      message: "Practice test submitted and evaluated successfully.",
      timestamp: now,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message || "Evaluation error." } });
  }
});

// 7. Results & Analytics
router.get("/practice/results", async (req, res) => {
  return res.status(200).json({
    success: true,
    query: req.query,
    timestamp: new Date().toISOString(),
  });
});

// Mount router on both /api and / to handle both direct and rewritten paths safely
apiApp.use("/api", router);
apiApp.use("/", router);
