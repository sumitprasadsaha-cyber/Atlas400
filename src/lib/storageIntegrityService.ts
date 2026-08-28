/**
 * Atlas v5.0.8 — Storage Integrity Verification Service
 *
 * Architecture-Level Non-Destructive Integrity Auditor for Topic Notes.
 * - Scans all Firestore notes collections (School & UPSC).
 * - Performs non-destructive HeadObject existence & health checks against Cloudflare R2.
 * - Never modifies, mutates, or deletes any data.
 * - Produces comprehensive audit reports on note storage health.
 */

import { fetchAllClassNotesFromFirestore } from "./firestoreService";
import { verifyR2ObjectExists, getR2BucketName } from "./r2Client";
import { ClassNote } from "../types";

export interface NoteIntegrityItem {
  noteId: string;
  title: string;
  classGrade: string;
  subject: string;
  chapterNo?: number;
  chapterName?: string;
  topicName?: string;
  storageKey: string;
  status: "healthy" | "missing" | "empty" | "error";
  sizeBytes?: number;
  mimeType?: string;
  lastModified?: string;
  errorMessage?: string;
}

export interface StorageIntegrityReport {
  timestamp: string;
  bucket: string;
  totalNotes: number;
  healthyCount: number;
  missingCount: number;
  emptyCount: number;
  errorCount: number;
  is100PercentHealthy: boolean;
  healthPercentage: number;
  items: NoteIntegrityItem[];
}

/**
 * Executes a non-destructive storage integrity audit across all persisted Topic Notes.
 */
export async function auditStorageIntegrity(
  onProgress?: (checked: number, total: number, currentNoteTitle: string) => void
): Promise<StorageIntegrityReport> {
  const bucket = getR2BucketName();
  console.log(`[Storage Integrity Audit] Starting non-destructive audit on bucket: "${bucket}"...`);

  const allNotes: ClassNote[] = await fetchAllClassNotesFromFirestore();
  const total = allNotes.length;
  console.log(`[Storage Integrity Audit] Found ${total} notes in Firestore.`);

  let healthyCount = 0;
  let missingCount = 0;
  let emptyCount = 0;
  let errorCount = 0;
  const items: NoteIntegrityItem[] = [];

  for (let i = 0; i < total; i++) {
    const note = allNotes[i];
    const storageKey =
      note.storagePath ||
      note.storageKey ||
      note.r2Key ||
      note.downloadKey ||
      note.objectKey ||
      "";
    const title =
      note.topicName ||
      note.topicTitle ||
      note.partLabel ||
      note.fileName ||
      note.pdfFileName ||
      `Note ${note.id}`;

    if (onProgress) {
      onProgress(i + 1, total, title);
    }

    if (!storageKey) {
      missingCount++;
      items.push({
        noteId: note.id,
        title,
        classGrade: note.classGrade || (note as any).className || "Class 10",
        subject: note.subject || "General",
        chapterNo: note.chapterNo,
        chapterName: note.chapterName,
        topicName: note.topicName,
        storageKey: "(missing key in Firestore)",
        status: "missing",
        errorMessage: "Document has no storage key or path persisted in Firestore metadata.",
      });
      continue;
    }

    try {
      // Non-destructive HeadObject check
      const check = await verifyR2ObjectExists({
        bucket,
        key: storageKey,
      });

      if (!check || !check.exists) {
        missingCount++;
        items.push({
          noteId: note.id,
          title,
          classGrade: note.classGrade || (note as any).className || "Class 10",
          subject: note.subject || "General",
          chapterNo: note.chapterNo,
          chapterName: note.chapterName,
          topicName: note.topicName,
          storageKey,
          status: "missing",
          errorMessage: `Object not found in R2 storage at key "${storageKey}".`,
        });
      } else if (check.size !== undefined && check.size <= 0) {
        emptyCount++;
        items.push({
          noteId: note.id,
          title,
          classGrade: note.classGrade || (note as any).className || "Class 10",
          subject: note.subject || "General",
          chapterNo: note.chapterNo,
          chapterName: note.chapterName,
          topicName: note.topicName,
          storageKey,
          status: "empty",
          sizeBytes: 0,
          errorMessage: "R2 object exists but has 0 bytes content-length.",
        });
      } else {
        healthyCount++;
        items.push({
          noteId: note.id,
          title,
          classGrade: note.classGrade || (note as any).className || "Class 10",
          subject: note.subject || "General",
          chapterNo: note.chapterNo,
          chapterName: note.chapterName,
          topicName: note.topicName,
          storageKey,
          status: "healthy",
          sizeBytes: check.size ?? note.fileSize,
          mimeType: note.mimeType,
          lastModified: note.updatedAt || note.createdAt,
        });
      }
    } catch (err: any) {
      errorCount++;
      items.push({
        noteId: note.id,
        title,
        classGrade: note.classGrade || (note as any).className || "Class 10",
        subject: note.subject || "General",
        chapterNo: note.chapterNo,
        chapterName: note.chapterName,
        topicName: note.topicName,
        storageKey,
        status: "error",
        errorMessage: err?.message || "Storage verification request failed.",
      });
    }
  }

  const is100PercentHealthy = total > 0 && healthyCount === total;
  const healthPercentage = total > 0 ? Math.round((healthyCount / total) * 100) : 100;

  console.log(`[Storage Integrity Audit] Audit finished: ${healthyCount}/${total} healthy (${healthPercentage}%).`);

  return {
    timestamp: new Date().toISOString(),
    bucket,
    totalNotes: total,
    healthyCount,
    missingCount,
    emptyCount,
    errorCount,
    is100PercentHealthy,
    healthPercentage,
    items,
  };
}
