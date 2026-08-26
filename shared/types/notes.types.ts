export interface NoteMetadata {
  id: string;
  title: string;
  description?: string;
  classId: string;
  subjectId: string;
  chapterId?: string;
  topicId?: string;
  storageKey: string;
  bucket: string;
  mimeType: string;
  fileSize: number;
  originalFilename: string;
  uploadedBy: string;
  uploadedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteUploadPayload {
  title: string;
  description?: string;
  classId: string;
  subjectId: string;
  chapterId?: string;
  topicId?: string;
  file: File | Blob;
  originalFilename: string;
}
