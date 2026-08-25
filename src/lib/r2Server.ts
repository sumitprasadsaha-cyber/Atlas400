import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  type PutObjectCommandInput,
  type GetObjectCommandInput,
  type DeleteObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint?: string;
  publicUrl?: string;
}

let s3ClientInstance: S3Client | null = null;
let lastS3Endpoint: string = "";

const LOCAL_STORAGE_DIR = path.join(process.cwd(), "data", "storage");

/**
 * Ensures the target directory exists synchronously.
 */
function ensureDirectoryExists(dirPath: string): void {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (err) {
    console.error(`[R2Server] Failed to create directory: ${dirPath}`, err);
  }
}

/**
 * Resolves a safe filesystem path within the local storage directory to prevent path traversal.
 */
function getSafeLocalPath(bucket: string, key: string): string {
  const cleanBucket = (bucket || "academy-connect-files").replace(/[^a-zA-Z0-9._-]/g, "_");
  const cleanKey = key.replace(/^\/+/, "").replace(/\.\./g, "_");
  const fullPath = path.join(LOCAL_STORAGE_DIR, cleanBucket, cleanKey);
  
  // Guard against path traversal
  const normalizedFull = path.normalize(fullPath);
  const normalizedRoot = path.normalize(LOCAL_STORAGE_DIR);
  if (!normalizedFull.startsWith(normalizedRoot)) {
    throw new Error("Invalid storage path: Directory traversal detected.");
  }
  
  return normalizedFull;
}

/**
 * Returns MIME type based on file extension.
 */
function getMimeTypeFromKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

/**
 * Resolves Cloudflare R2 configuration from environment variables.
 */
export function getR2ServerConfig(): R2Config {
  const accountId = (process.env.R2_ACCOUNT_ID || process.env.VITE_R2_ACCOUNT_ID || "").trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || process.env.VITE_R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || process.env.VITE_R2_SECRET_ACCESS_KEY || "").trim();
  const bucket = (process.env.R2_BUCKET || process.env.VITE_R2_BUCKET || "academy-connect-files").trim();
  const explicitEndpoint = (process.env.R2_ENDPOINT || process.env.VITE_R2_ENDPOINT || "").trim();
  const publicUrl = (process.env.R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL || "").trim().replace(/\/+$/, "");

  const endpoint = explicitEndpoint || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint,
    publicUrl,
  };
}

/**
 * Checks if real Cloudflare R2 credentials and endpoint are fully provided.
 */
export function isR2Configured(): boolean {
  const config = getR2ServerConfig();
  return Boolean(
    config.accessKeyId &&
    config.secretAccessKey &&
    config.endpoint &&
    config.endpoint.startsWith("http")
  );
}

/**
 * Initializes and returns the singleton AWS S3 client configured for Cloudflare R2.
 */
export function getR2S3Client(): S3Client {
  const config = getR2ServerConfig();
  if (!config.accessKeyId || !config.secretAccessKey || !config.endpoint) {
    throw new Error(
      `Cloudflare R2 is not fully configured. Missing credentials or endpoint: ${JSON.stringify({
        hasAccessKey: Boolean(config.accessKeyId),
        hasSecretKey: Boolean(config.secretAccessKey),
        hasEndpoint: Boolean(config.endpoint),
        bucket: config.bucket,
      })}`
    );
  }

  if (!s3ClientInstance || lastS3Endpoint !== config.endpoint) {
    s3ClientInstance = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true, // Cloudflare R2 requires path-style routing
    });
    lastS3Endpoint = config.endpoint;
  }
  return s3ClientInstance;
}

/**
 * Saves buffer or stream to local storage directory.
 */
async function saveToLocalStorage(
  bucket: string,
  key: string,
  body: Buffer | Uint8Array | string | Readable
): Promise<string> {
  const filePath = getSafeLocalPath(bucket, key);
  ensureDirectoryExists(path.dirname(filePath));

  if (body instanceof Readable) {
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      const hash = crypto.createHash("md5");
      body.on("data", (chunk) => hash.update(chunk));
      body.pipe(writeStream);
      writeStream.on("finish", () => resolve(`"${hash.digest("hex")}"`));
      writeStream.on("error", reject);
    });
  } else {
    const buffer = Buffer.isBuffer(body)
      ? body
      : typeof body === "string"
      ? Buffer.from(body, "utf-8")
      : Buffer.from(body);
    await fs.promises.writeFile(filePath, buffer);
    const hash = crypto.createHash("md5").update(buffer).digest("hex");
    return `"${hash}"`;
  }
}

/**
 * Uploads an object directly to Cloudflare R2 bucket, or smoothly falls back to local disk storage.
 */
export async function uploadObjectToR2(params: {
  bucket?: string;
  key: string;
  body: Buffer | Uint8Array | string | Readable;
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}): Promise<{ bucket: string; key: string; etag?: string }> {
  const config = getR2ServerConfig();
  const bucketName = params.bucket || config.bucket;
  const cleanKey = params.key.replace(/^\/+/, "");

  if (isR2Configured()) {
    try {
      const client = getR2S3Client();
      const input: PutObjectCommandInput = {
        Bucket: bucketName,
        Key: cleanKey,
        Body: params.body,
        ContentType: params.contentType || getMimeTypeFromKey(cleanKey),
        CacheControl: params.cacheControl || "public, max-age=31536000, immutable",
        Metadata: params.metadata,
      };

      const command = new PutObjectCommand(input);
      const response = await client.send(command);

      console.log(`[R2Server] PutObject successful to Cloudflare R2: bucket="${bucketName}", key="${cleanKey}", ETag=${response.ETag}`);

      // Also create local cache backup in background if body is a Buffer
      if (Buffer.isBuffer(params.body)) {
        saveToLocalStorage(bucketName, cleanKey, params.body).catch(() => {});
      }

      return {
        bucket: bucketName,
        key: cleanKey,
        etag: response.ETag,
      };
    } catch (err: any) {
      console.warn(`[R2Server] Cloudflare R2 upload error (${err.message}). Falling back to local disk storage for key="${cleanKey}"`);
      const etag = await saveToLocalStorage(bucketName, cleanKey, params.body);
      return {
        bucket: bucketName,
        key: cleanKey,
        etag,
      };
    }
  }

  // Cloudflare R2 credentials not configured: Use seamless local disk storage
  console.log(`[R2Server] Storing object to local storage fallback: bucket="${bucketName}", key="${cleanKey}"`);
  const etag = await saveToLocalStorage(bucketName, cleanKey, params.body);
  return {
    bucket: bucketName,
    key: cleanKey,
    etag,
  };
}

/**
 * Retrieves an object stream from Cloudflare R2 bucket or local disk fallback.
 */
export async function getObjectFromR2(params: {
  bucket?: string;
  key: string;
  range?: string;
}): Promise<{
  body: Readable | null;
  contentType?: string;
  contentLength?: number;
  contentRange?: string;
  lastModified?: Date;
  etag?: string;
  metadata?: Record<string, string>;
}> {
  const config = getR2ServerConfig();
  const bucketName = params.bucket || config.bucket;
  const cleanKey = params.key.replace(/^\/+/, "");

  if (isR2Configured()) {
    try {
      const client = getR2S3Client();
      const input: GetObjectCommandInput = {
        Bucket: bucketName,
        Key: cleanKey,
        Range: params.range,
      };

      const command = new GetObjectCommand(input);
      const response = await client.send(command);

      return {
        body: (response.Body as unknown as Readable) || null,
        contentType: response.ContentType || getMimeTypeFromKey(cleanKey),
        contentLength: response.ContentLength,
        contentRange: response.ContentRange,
        lastModified: response.LastModified,
        etag: response.ETag,
        metadata: response.Metadata,
      };
    } catch (err: any) {
      if (
        err.name === "NoSuchKey" ||
        err.name === "NotFound" ||
        err.$metadata?.httpStatusCode === 404
      ) {
        // Check local disk storage fallback before returning null
      } else {
        console.warn(`[R2Server] Cloudflare R2 GetObject issue (${err.message}), checking local storage fallback...`);
      }
    }
  }

  // Check local filesystem storage
  try {
    const filePath = getSafeLocalPath(bucketName, cleanKey);
    if (fs.existsSync(filePath)) {
      const stat = await fs.promises.stat(filePath);
      const contentType = getMimeTypeFromKey(cleanKey);
      const etag = `"${stat.size}-${stat.mtimeMs}"`;

      if (params.range && stat.size > 0) {
        const parts = params.range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10) || 0;
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });

        return {
          body: fileStream,
          contentType,
          contentLength: chunkSize,
          contentRange: `bytes ${start}-${end}/${stat.size}`,
          lastModified: stat.mtime,
          etag,
        };
      }

      return {
        body: fs.createReadStream(filePath),
        contentType,
        contentLength: stat.size,
        lastModified: stat.mtime,
        etag,
      };
    }
  } catch (localErr) {
    console.error(`[R2Server] Local storage lookup error for ${cleanKey}:`, localErr);
  }

  return { body: null };
}

/**
 * Generates a presigned URL or proxy streaming URL for downloading or uploading to Cloudflare R2 / Local Storage.
 */
export async function generateR2SignedUrl(params: {
  bucket?: string;
  key: string;
  expiresIn?: number;
  operation?: "getObject" | "putObject";
  contentType?: string;
}): Promise<string> {
  const config = getR2ServerConfig();
  const bucketName = params.bucket || config.bucket;
  const cleanKey = params.key.replace(/^\/+/, "");
  const expiresIn = params.expiresIn || 3600;
  const operation = params.operation || "getObject";

  if (isR2Configured()) {
    try {
      const client = getR2S3Client();
      if (operation === "putObject") {
        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: cleanKey,
          ContentType: params.contentType || getMimeTypeFromKey(cleanKey),
        });
        return await getSignedUrl(client, command, { expiresIn });
      }

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: cleanKey,
      });
      return await getSignedUrl(client, command, { expiresIn });
    } catch (err: any) {
      console.warn(`[R2Server] generateR2SignedUrl falling back to proxy URL for ${cleanKey}:`, err?.message || err);
    }
  }

  // Seamless fallback to proxy streaming URL
  return `/api/r2/download?bucket=${encodeURIComponent(bucketName)}&key=${encodeURIComponent(cleanKey)}`;
}

/**
 * Deletes an object from Cloudflare R2 bucket and local storage.
 */
export async function deleteObjectFromR2(params: {
  bucket?: string;
  key: string;
}): Promise<{ success: boolean; bucket: string; key: string }> {
  const config = getR2ServerConfig();
  const bucketName = params.bucket || config.bucket;
  const cleanKey = params.key.replace(/^\/+/, "");

  if (isR2Configured()) {
    try {
      const client = getR2S3Client();
      const input: DeleteObjectCommandInput = {
        Bucket: bucketName,
        Key: cleanKey,
      };
      const command = new DeleteObjectCommand(input);
      await client.send(command);
      console.log(`[R2Server] Successfully deleted object from Cloudflare R2: bucket="${bucketName}", key="${cleanKey}"`);
    } catch (err: any) {
      console.warn(`[R2Server] R2 DeleteObject notice: ${err.message || err}`);
    }
  }

  // Also remove from local disk storage if exists
  try {
    const filePath = getSafeLocalPath(bucketName, cleanKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      console.log(`[R2Server] Removed local storage copy: ${cleanKey}`);
    }
  } catch (localErr) {
    // Ignore local deletion error
  }

  return {
    success: true,
    bucket: bucketName,
    key: cleanKey,
  };
}

/**
 * Deletes multiple objects from Cloudflare R2 bucket and local storage.
 */
export async function deleteObjectsFromR2(params: {
  bucket?: string;
  keys: string[];
}): Promise<{ success: boolean; deleted: string[]; errors?: any[] }> {
  const cleanKeys = params.keys.map((k) => k.replace(/^\/+/, "")).filter(Boolean);
  if (cleanKeys.length === 0) {
    return { success: true, deleted: [] };
  }

  const config = getR2ServerConfig();
  const bucketName = params.bucket || config.bucket;

  if (isR2Configured()) {
    try {
      const client = getR2S3Client();
      const command = new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: cleanKeys.map((k) => ({ Key: k })),
          Quiet: false,
        },
      });
      await client.send(command);
    } catch (err: any) {
      console.warn(`[R2Server] R2 DeleteObjects notice:`, err.message || err);
    }
  }

  // Also delete from local storage
  for (const key of cleanKeys) {
    try {
      const filePath = getSafeLocalPath(bucketName, key);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch {
      // ignore
    }
  }

  return {
    success: true,
    deleted: cleanKeys,
  };
}

/**
 * Recursively lists all files in a local directory.
 */
async function scanLocalFiles(
  baseDir: string,
  currentDir: string = baseDir
): Promise<Array<{ key: string; size: number; lastModified?: Date; etag?: string }>> {
  let results: Array<{ key: string; size: number; lastModified?: Date; etag?: string }> = [];
  if (!fs.existsSync(currentDir)) return results;

  const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      const subResults = await scanLocalFiles(baseDir, fullPath);
      results = results.concat(subResults);
    } else if (entry.isFile()) {
      const relativeKey = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      const stat = await fs.promises.stat(fullPath);
      results.push({
        key: relativeKey,
        size: stat.size,
        lastModified: stat.mtime,
        etag: `"${stat.size}-${stat.mtimeMs}"`,
      });
    }
  }
  return results;
}

/**
 * Lists objects in Cloudflare R2 bucket matching a prefix, or falls back to local storage listing.
 */
export async function listObjectsFromR2(params: {
  bucket?: string;
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}): Promise<{
  objects: Array<{ key: string; size: number; lastModified?: Date; etag?: string }>;
  nextContinuationToken?: string;
  isTruncated: boolean;
}> {
  const config = getR2ServerConfig();
  const bucketName = params.bucket || config.bucket;
  const cleanPrefix = (params.prefix || "").replace(/^\/+/, "");

  if (isR2Configured()) {
    try {
      const client = getR2S3Client();
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: cleanPrefix,
        MaxKeys: params.maxKeys || 1000,
        ContinuationToken: params.continuationToken,
      });

      const response = await client.send(command);
      const objects = (response.Contents || []).map((item) => ({
        key: item.Key || "",
        size: item.Size || 0,
        lastModified: item.LastModified,
        etag: item.ETag,
      }));

      return {
        objects,
        nextContinuationToken: response.NextContinuationToken,
        isTruncated: response.IsTruncated || false,
      };
    } catch (err: any) {
      console.warn(`[R2Server] Cloudflare R2 ListObjects notice (${err.message}), falling back to local file scan...`);
    }
  }

  // Scan local directory
  try {
    const bucketDir = path.join(LOCAL_STORAGE_DIR, bucketName.replace(/[^a-zA-Z0-9._-]/g, "_"));
    const allLocal = await scanLocalFiles(bucketDir);
    const filtered = cleanPrefix
      ? allLocal.filter((item) => item.key.startsWith(cleanPrefix))
      : allLocal;

    const limit = params.maxKeys || 1000;
    return {
      objects: filtered.slice(0, limit),
      isTruncated: filtered.length > limit,
    };
  } catch (localErr) {
    return {
      objects: [],
      isTruncated: false,
    };
  }
}

/**
 * Checks metadata/existence of an object in Cloudflare R2 bucket or local disk fallback.
 */
export async function headObjectFromR2(params: {
  bucket?: string;
  key: string;
}): Promise<{
  exists: boolean;
  contentLength?: number;
  contentType?: string;
  lastModified?: Date;
  etag?: string;
  metadata?: Record<string, string>;
}> {
  const config = getR2ServerConfig();
  const bucketName = params.bucket || config.bucket;
  const cleanKey = params.key.replace(/^\/+/, "");

  if (isR2Configured()) {
    try {
      const client = getR2S3Client();
      const command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: cleanKey,
      });
      const response = await client.send(command);
      return {
        exists: true,
        contentLength: response.ContentLength,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        etag: response.ETag,
        metadata: response.Metadata,
      };
    } catch (err: any) {
      // Check local storage
    }
  }

  // Check local filesystem
  try {
    const filePath = getSafeLocalPath(bucketName, cleanKey);
    if (fs.existsSync(filePath)) {
      const stat = await fs.promises.stat(filePath);
      return {
        exists: true,
        contentLength: stat.size,
        contentType: getMimeTypeFromKey(cleanKey),
        lastModified: stat.mtime,
        etag: `"${stat.size}-${stat.mtimeMs}"`,
      };
    }
  } catch {
    // ignore
  }

  return { exists: false };
}

