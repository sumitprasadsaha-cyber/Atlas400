export type NoteStatus = "active" | "hidden" | "deleted";

export interface Note {
  id: string;
  title: string;
  description: string;
  subject: string;
  chapter: string;
  batch: string;
  class: string;
  tags: string[];
  fileName: string;
  originalFileName: string;
  mimeType: string;
  extension: string;
  size: number;
  r2ObjectKey: string;
  uploadedBy: string;
  uploadedAt: string;
  updatedAt: string;
  status: NoteStatus;
  downloadCount: number;
  lastDownloadedAt: string | null;
  isVisible: boolean;
  version: number;

  // Compatibility fields with existing views
  classId?: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  storageKey?: string;
  bucket?: string;
  fileSize?: number;
}

// Backward-compatible alias
export type NoteMetadata = Note;

export interface NoteUploadPayload {
  title: string;
  description?: string;
  subject: string;
  chapter?: string;
  batch?: string;
  class?: string;
  tags?: string[];
  file: File | Blob;
  originalFileName: string;
  mimeType?: string;
  
  // Compatibility fields
  classId?: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
}

export interface NoteReplacePayload {
  noteId: string;
  file: File | Blob;
  originalFileName: string;
  mimeType?: string;
}

export interface NoteUpdateMetadataPayload {
  title?: string;
  description?: string;
  subject?: string;
  chapter?: string;
  batch?: string;
  class?: string;
  tags?: string[];
}

export type NoteSortOption = "newest" | "oldest" | "recentlyUpdated" | "downloads" | "title";

export interface NoteFilters {
  subject?: string;
  batch?: string;
  chapter?: string;
  classGrade?: string;
  searchQuery?: string;
  status?: NoteStatus;
  isVisible?: boolean;
  sortBy?: NoteSortOption;
}
