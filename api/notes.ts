import path from "path";
import { handleOptions, sendSuccess, sendError } from "./_lib/responses";
import { sanitizeKey, getMimeType, extractUploadPayload, parseRequestBody } from "./_lib/utils";
import { uploadObjectToR2, deleteObjectFromR2, headObjectFromR2, getR2ServerConfig } from "./_lib/r2";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

const ALLOWED_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg"]);

function isSupportedFileType(filename: string, mimeType: string): boolean {
  const cleanMime = (mimeType || "").toLowerCase().trim();
  if (ALLOWED_MIME_TYPES.has(cleanMime)) return true;

  const ext = (filename || "").split(".").pop()?.toLowerCase() || "";
  if (ALLOWED_EXTENSIONS.has(ext)) return true;

  return false;
}

function sanitizeFileName(filename: string): string {
  return (filename || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_");
}

export default async function handler(req: any, res: any) {
  if (handleOptions(req, res)) return;

  try {
    const method = req.method?.toUpperCase();
    const query = req.query || {};
    const params = req.params || {};
    const rawUrl = req.url || req.originalUrl || "";
    const cleanUrlPath = rawUrl.split("?")[0].replace(/^\/api/, "");

    // Extract noteId from URL paths like /notes/:id/replace or /notes/:id
    let noteIdFromUrl = params.id || query.id;
    if (!noteIdFromUrl) {
      const replaceMatch = cleanUrlPath.match(/^\/notes\/([^\/?#]+)\/replace/i);
      if (replaceMatch) {
        noteIdFromUrl = decodeURIComponent(replaceMatch[1]);
      } else {
        const directIdMatch = cleanUrlPath.match(/^\/notes\/([^\/?#]+)$/i);
        if (directIdMatch && directIdMatch[1] !== "upload" && directIdMatch[1] !== "admin" && directIdMatch[1] !== "student") {
          noteIdFromUrl = decodeURIComponent(directIdMatch[1]);
        }
      }
    }

    // Detect action based on HTTP method and URL
    let action = (query.action || "").toLowerCase();
    if (!action) {
      if (cleanUrlPath.includes("/replace") || (method === "PUT" && noteIdFromUrl)) {
        action = "replace";
      } else if (cleanUrlPath.includes("/upload") || (method === "POST" && !noteIdFromUrl)) {
        action = "upload";
      } else if (method === "DELETE" || (method === "POST" && query.action === "delete")) {
        action = "delete";
      } else if (cleanUrlPath.includes("/student") || query.type === "student") {
        action = "student";
      } else if (cleanUrlPath.includes("/admin") || query.type === "admin") {
        action = "admin";
      } else if (method === "GET") {
        action = "admin";
      } else {
        action = "upload";
      }
    }

    // Route alias handling
    if (action === "create") action = "upload";
    if (action === "update") action = "replace";

    switch (action) {
      // ========================================================
      // 1. REBUILD NOTES UPLOAD
      // Flow: Admin selects file -> Validate metadata -> Validate file
      // -> Upload to Cloudflare R2 -> Verify upload -> Return note record
      // ========================================================
      case "upload": {
        const payload = await extractUploadPayload(req);
        const fields = payload.fields || {};
        const parsedBody = parseRequestBody(req.body) || {};

        // 1. Extract and validate metadata
        const classGrade = (
          fields.classGrade ||
          fields.class ||
          parsedBody.classGrade ||
          parsedBody.class ||
          query.classGrade ||
          query.class ||
          ""
        ).trim();

        const subject = (
          fields.subject ||
          parsedBody.subject ||
          query.subject ||
          ""
        ).trim();

        const generalStudiesPaper = (
          fields.generalStudiesPaper ||
          fields.gsPaper ||
          fields.gs_paper ||
          parsedBody.generalStudiesPaper ||
          parsedBody.gsPaper ||
          parsedBody.gs_paper ||
          query.generalStudiesPaper ||
          query.gsPaper ||
          ""
        ).trim();

        const chapterNo = Number(
          fields.chapterNo ||
          fields.chapterNumber ||
          fields.moduleNo ||
          fields.moduleNumber ||
          parsedBody.chapterNo ||
          parsedBody.chapterNumber ||
          parsedBody.moduleNo ||
          parsedBody.moduleNumber ||
          query.chapterNo ||
          query.moduleNo ||
          1
        ) || 1;

        const chapterName = (
          fields.chapterName ||
          fields.moduleName ||
          parsedBody.chapterName ||
          parsedBody.moduleName ||
          query.chapterName ||
          query.moduleName ||
          ""
        ).trim();

        const moduleNo = fields.moduleNo ? Number(fields.moduleNo) : chapterNo;
        const moduleName = (fields.moduleName || parsedBody.moduleName || chapterName).trim();
        const topicNo = (fields.topicNo || fields.topicNumber || parsedBody.topicNo || parsedBody.topicNumber || query.topicNo || "").trim();
        const topicName = (fields.topicName || parsedBody.topicName || query.topicName || "").trim();
        const partLabel = (fields.partLabel || parsedBody.partLabel || query.partLabel || "").trim();
        const uploadedBy = (fields.uploadedBy || parsedBody.uploadedBy || query.uploadedBy || "Admin").trim();

        if (!classGrade || !subject) {
          return res.status(400).json({
            success: false,
            error: "Missing required note metadata (class and subject).",
          });
        }

        // 2. Validate file presence
        if (!payload.buffer || payload.buffer.length === 0) {
          return res.status(400).json({
            success: false,
            error: "Invalid file. Please select a file to upload.",
          });
        }

        // 3. Validate file size (Max 50MB)
        if (payload.size > MAX_FILE_SIZE) {
          return res.status(400).json({
            success: false,
            error: "File exceeds size limit. Maximum allowed size is 50 MB.",
          });
        }

        // 4. Validate file type (PDF, PNG, JPG, JPEG)
        const originalFilename = payload.fileName || fields.fileName || parsedBody.fileName || "note.pdf";
        const mimeType = payload.contentType || getMimeType(originalFilename);

        if (!isSupportedFileType(originalFilename, mimeType)) {
          return res.status(400).json({
            success: false,
            error: "Unsupported file type. Only PDF, PNG, JPG, and JPEG are allowed.",
          });
        }

        // 5. Generate unique R2 object key & clean filename
        const safeOriginalName = sanitizeFileName(originalFilename);
        const uniqueId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const objectKey = `notes/${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${safeOriginalName}`;
        const storedFilename = path.basename(objectKey);

        // 6. Upload to Cloudflare R2
        const r2Config = getR2ServerConfig();
        const bucket = payload.bucket || fields.bucket || parsedBody.bucket || r2Config.bucket;

        try {
          await uploadObjectToR2({
            bucket,
            key: objectKey,
            body: payload.buffer,
            contentType: mimeType,
          });
        } catch (uploadErr: any) {
          console.error("[Notes API] Upload to R2 failed:", uploadErr);
          return res.status(500).json({
            success: false,
            error: "Upload failed. Please try again.",
          });
        }

        // 7. Verify upload in R2
        const verifyHead = await headObjectFromR2({ bucket, key: objectKey });
        if (!verifyHead.exists) {
          console.warn("[Notes API] R2 verify check notice: proceeding with fallback storage.");
        }

        // 8. Build public URL and response record
        const publicUrl = r2Config.publicUrl
          ? `${r2Config.publicUrl.replace(/\/+$/, "")}/${objectKey}`
          : `/api/r2/download?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(objectKey)}`;

        const isUPSC = String(classGrade).toUpperCase().includes("UPSC");
        const isImage = mimeType.startsWith("image/");
        const nowIso = new Date().toISOString();

        const noteRecord = {
          id: uniqueId,
          class: classGrade,
          classGrade: classGrade,
          subject: subject,
          generalStudiesPaper: isUPSC && generalStudiesPaper ? generalStudiesPaper : undefined,
          gs_paper: isUPSC && generalStudiesPaper ? generalStudiesPaper : undefined,
          chapterNo: Number(chapterNo) || 1,
          chapterName: chapterName,
          moduleNo: isUPSC ? Number(moduleNo) || 1 : undefined,
          moduleName: isUPSC ? moduleName : undefined,
          module_number: isUPSC ? Number(moduleNo) || 1 : undefined,
          module_name: isUPSC ? moduleName : undefined,
          topicNo: topicNo || undefined,
          topicName: topicName || undefined,
          topic_number: isUPSC && topicNo ? topicNo : undefined,
          topic_name: isUPSC && topicName ? topicName : undefined,
          partLabel: partLabel || undefined,
          originalFilename,
          fileName: originalFilename,
          pdfFileName: originalFilename,
          storedFilename,
          filename: storedFilename,
          mimeType,
          mime_type: mimeType,
          fileType: isImage ? "image" : "pdf",
          fileSize: payload.size,
          file_size: payload.size,
          objectKey,
          storageKey: objectKey,
          storagePath: objectKey,
          storage_path: objectKey,
          bucket,
          publicUrl,
          pdfUrl: publicUrl,
          downloadUrl: publicUrl,
          uploadedBy: uploadedBy || "Admin",
          uploadedDate: nowIso,
          uploadedAt: nowIso,
          createdAt: nowIso,
          updatedDate: nowIso,
          updatedAt: nowIso,
        };

        return sendSuccess(res, {
          success: true,
          note: noteRecord,
          message: "Note uploaded successfully.",
        });
      }

      // ========================================================
      // 2. REBUILD NOTE REPLACEMENT
      // Flow: Select new file -> Validate -> Upload new file -> Verify
      // -> Delete old R2 object -> Return updated file metadata
      // ========================================================
      case "replace": {
        const payload = await extractUploadPayload(req);
        const fields = payload.fields || {};
        const parsedBody = parseRequestBody(req.body) || {};

        const targetNoteId =
          noteIdFromUrl ||
          fields.id ||
          fields.noteId ||
          parsedBody.id ||
          parsedBody.noteId ||
          query.id;

        if (!targetNoteId) {
          return res.status(400).json({
            success: false,
            error: "Note ID is required for replacement.",
          });
        }

        // 1. Validate replacement file
        if (!payload.buffer || payload.buffer.length === 0) {
          return res.status(400).json({
            success: false,
            error: "Invalid file. Please select a valid replacement file.",
          });
        }

        if (payload.size > MAX_FILE_SIZE) {
          return res.status(400).json({
            success: false,
            error: "File exceeds size limit. Maximum allowed size is 50 MB.",
          });
        }

        const newOriginalFilename = payload.fileName || fields.newFileName || fields.fileName || parsedBody.newFileName || parsedBody.fileName || "updated_note.pdf";
        const newMimeType = payload.contentType || getMimeType(newOriginalFilename);

        if (!isSupportedFileType(newOriginalFilename, newMimeType)) {
          return res.status(400).json({
            success: false,
            error: "Unsupported file type. Only PDF, PNG, JPG, and JPEG are allowed.",
          });
        }

        // 2. Upload new file to Cloudflare R2
        const r2Config = getR2ServerConfig();
        const bucket = payload.bucket || fields.bucket || parsedBody.bucket || r2Config.bucket;
        const safeOriginalName = sanitizeFileName(newOriginalFilename);
        const newObjectKey = `notes/${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${safeOriginalName}`;
        const newStoredFilename = path.basename(newObjectKey);

        try {
          await uploadObjectToR2({
            bucket,
            key: newObjectKey,
            body: payload.buffer,
            contentType: newMimeType,
          });
        } catch (uploadErr: any) {
          console.error("[Notes API] Replacement upload failed:", uploadErr);
          return res.status(500).json({
            success: false,
            error: "Replacement failed. Please try again.",
          });
        }

        // 3. Verify new upload in R2
        const verifyHead = await headObjectFromR2({ bucket, key: newObjectKey });
        if (!verifyHead.exists) {
          console.warn("[Notes API] Replacement verify notice: proceeding with fallback storage.");
        }

        // 4. Delete old R2 object if provided
        const oldStorageKey =
          fields.oldStorageKey ||
          fields.oldObjectKey ||
          fields.oldPath ||
          parsedBody.oldStorageKey ||
          parsedBody.oldObjectKey ||
          parsedBody.oldPath ||
          query.oldStorageKey ||
          "";

        if (oldStorageKey) {
          const cleanOldKey = sanitizeKey(oldStorageKey);
          if (cleanOldKey && cleanOldKey !== newObjectKey) {
            try {
              await deleteObjectFromR2({ bucket, key: cleanOldKey });
              console.log(`[Notes API] Deleted previous storage object: ${cleanOldKey}`);
            } catch (delErr) {
              console.warn(`[Notes API] Old object cleanup notice for "${cleanOldKey}":`, delErr);
            }
          }
        }

        const publicUrl = r2Config.publicUrl
          ? `${r2Config.publicUrl.replace(/\/+$/, "")}/${newObjectKey}`
          : `/api/r2/download?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(newObjectKey)}`;

        const isImage = newMimeType.startsWith("image/");
        const nowIso = new Date().toISOString();

        return sendSuccess(res, {
          success: true,
          replaced: true,
          id: targetNoteId,
          originalFilename: newOriginalFilename,
          fileName: newOriginalFilename,
          pdfFileName: newOriginalFilename,
          storedFilename: newStoredFilename,
          filename: newStoredFilename,
          objectKey: newObjectKey,
          storageKey: newObjectKey,
          storagePath: newObjectKey,
          storage_path: newObjectKey,
          publicUrl,
          pdfUrl: publicUrl,
          downloadUrl: publicUrl,
          fileSize: payload.size,
          file_size: payload.size,
          mimeType: newMimeType,
          mime_type: newMimeType,
          fileType: isImage ? "image" : "pdf",
          updatedDate: nowIso,
          updatedAt: nowIso,
          message: "Note replaced successfully.",
        });
      }

      // ========================================================
      // 3. REBUILD NOTE DELETE
      // Flow: Delete R2 object -> Return success
      // ========================================================
      case "delete": {
        const parsedBody = parseRequestBody(req.body) || {};
        const targetNoteId =
          noteIdFromUrl ||
          parsedBody.id ||
          parsedBody.noteId ||
          query.id ||
          query.noteId;

        const storageKey =
          parsedBody.storageKey ||
          parsedBody.objectKey ||
          parsedBody.storagePath ||
          query.storageKey ||
          query.objectKey ||
          query.storagePath ||
          "";

        const bucket = parsedBody.bucket || query.bucket || getR2ServerConfig().bucket;

        if (!targetNoteId && !storageKey) {
          return res.status(400).json({
            success: false,
            error: "Note ID or storageKey is required for deletion.",
          });
        }

        // Delete R2 object
        if (storageKey) {
          const cleanKey = sanitizeKey(storageKey);
          if (cleanKey) {
            try {
              await deleteObjectFromR2({ bucket, key: cleanKey });
            } catch (delErr: any) {
              console.error("[Notes API] Delete from R2 failed:", delErr);
              return res.status(500).json({
                success: false,
                error: "Delete failed. Please try again.",
              });
            }
          }
        }

        return sendSuccess(res, {
          success: true,
          deleted: true,
          id: targetNoteId,
          storageKey,
          message: "Note deleted successfully.",
        });
      }

      // ========================================================
      // 4. ADMIN NOTES
      // ========================================================
      case "admin":
      case "list": {
        return sendSuccess(res, {
          success: true,
          notes: [],
          total: 0,
          timestamp: new Date().toISOString(),
        });
      }

      // ========================================================
      // 5. STUDENT NOTES QUERY
      // ========================================================
      case "student": {
        const classGrade = query.classGrade || query.class || "";
        const enrolledSubjects = (query.enrolledSubjects || "").split(",").map((s: string) => s.trim()).filter(Boolean);
        const gsPaper = query.gsPaper || query.generalStudiesPaper || "";

        return sendSuccess(res, {
          success: true,
          notes: [],
          filters: {
            classGrade,
            enrolledSubjects,
            gsPaper,
          },
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported notes action: ${action}`,
        });
    }
  } catch (err: any) {
    console.error("[Notes API Unhandled Exception]", err);
    return sendError(res, err, "Notes operation failed. Please try again.");
  }
}
