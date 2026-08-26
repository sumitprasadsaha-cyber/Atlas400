import { useState, useEffect, useCallback } from "react";
import { NoteMetadata, NoteUploadPayload } from "../../../shared/types/notes.types";
import { notesService } from "../services/notes.service";
import { logger } from "../../../shared/utils/logger";

export function useNotes(classId?: string, subjectId?: string) {
  const [notes, setNotes] = useState<NoteMetadata[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    if (!classId || !subjectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await notesService.getNotesBySubject(classId, subjectId);
      setNotes(data);
    } catch (e: any) {
      logger.error("useNotes: Failed to load notes", e);
      setError(e.message || "Failed to load notes");
    } finally {
      setIsLoading(false);
    }
  }, [classId, subjectId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const uploadNote = async (payload: NoteUploadPayload, uploadedBy: string) => {
    setIsLoading(true);
    try {
      const created = await notesService.uploadNote(payload, uploadedBy);
      setNotes((prev) => [created, ...prev]);
      return created;
    } catch (e: any) {
      setError(e.message || "Failed to upload note");
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const openNote = async (note: NoteMetadata) => {
    await notesService.openNote(note);
  };

  return {
    notes,
    isLoading,
    error,
    refresh: fetchNotes,
    uploadNote,
    openNote,
  };
}
