import { firestoreService, COLLECTIONS } from "../../../services/firebase";
import { r2UploadService, r2DownloadService } from "../../../services/r2";
import { NoteMetadata, NoteUploadPayload } from "../../../shared/types/notes.types";
import { where, orderBy } from "firebase/firestore";
import { logger } from "../../../shared/utils/logger";

export const notesService = {
  async getNotesBySubject(classId: string, subjectId: string): Promise<NoteMetadata[]> {
    return firestoreService.getCollection<NoteMetadata>(COLLECTIONS.NOTES_METADATA, [
      where("classId", "==", classId),
      where("subjectId", "==", subjectId),
      orderBy("createdAt", "desc"),
    ]);
  },

  async uploadNote(payload: NoteUploadPayload, uploadedBy: string): Promise<NoteMetadata> {
    logger.info("Notes feature: Initiating note upload to R2 and metadata to Firestore", { title: payload.title });
    // 1. Binary asset to Cloudflare R2
    const uploadResult = await r2UploadService.uploadFile(payload.file, payload.originalFilename, "notes");

    // 2. Metadata to Cloud Firestore
    const noteId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const metadata: NoteMetadata = {
      id: noteId,
      title: payload.title,
      description: payload.description,
      classId: payload.classId,
      subjectId: payload.subjectId,
      chapterId: payload.chapterId,
      topicId: payload.topicId,
      storageKey: uploadResult.storageKey,
      bucket: uploadResult.bucket,
      mimeType: uploadResult.mimeType,
      fileSize: uploadResult.fileSize,
      originalFilename: uploadResult.originalFilename,
      uploadedBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await firestoreService.setDocument(COLLECTIONS.NOTES_METADATA, noteId, metadata);
    return metadata;
  },

  async openNote(note: NoteMetadata): Promise<void> {
    await r2DownloadService.openDocumentNatively(note.storageKey, note.bucket, note.originalFilename);
  },

  async deleteNote(noteId: string): Promise<void> {
    await firestoreService.deleteDocument(COLLECTIONS.NOTES_METADATA, noteId);
  },
};
