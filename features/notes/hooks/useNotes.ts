import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Note,
  NoteFilters,
  NoteUploadPayload,
  NoteReplacePayload,
  NoteUpdateMetadataPayload,
} from "../../../shared/types/notes.types";
import { notesService } from "../services/notes.service";
import { logger } from "../../../shared/utils/logger";

export interface UseNotesOptions {
  initialFilters?: NoteFilters;
  realtime?: boolean;
}

export function useNotes(options?: UseNotesOptions | string, legacySubjectId?: string) {
  // Support both new options object and legacy (classId, subjectId) arguments
  const defaultFilters: NoteFilters = useMemo(() => {
    if (typeof options === "string") {
      return {
        batch: options || "all",
        subject: legacySubjectId || "all",
        sortBy: "newest",
      };
    }
    return options?.initialFilters || { sortBy: "newest" };
  }, [options, legacySubjectId]);

  const [filters, setFilters] = useState<NoteFilters>(defaultFilters);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isReplacing, setIsReplacing] = useState<string | null>(null);

  // Load notes
  const fetchNotes = useCallback(async (currentFilters?: NoteFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const activeFilters = currentFilters || filters;
      const data = await notesService.getNotes(activeFilters);
      setNotes(data);
    } catch (e: any) {
      logger.error("useNotes: Failed to load notes", e);
      setError(e.message || "Failed to load notes");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Realtime subscription or initial fetch
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (typeof options === "object" && options.realtime) {
      setIsLoading(true);
      unsubscribe = notesService.subscribeNotes(
        (updatedNotes) => {
          setNotes(updatedNotes);
          setIsLoading(false);
        },
        filters
      );
    } else {
      fetchNotes(filters);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [filters, options, fetchNotes]);

  // Upload note
  const uploadNote = useCallback(
    async (payload: NoteUploadPayload, uploadedBy: string, userRole: string = "admin"): Promise<Note> => {
      setIsUploading(true);
      setError(null);
      try {
        const created = await notesService.uploadNote(payload, uploadedBy, userRole);
        setNotes((prev) => [created, ...prev.filter((n) => n.id !== created.id)]);
        return created;
      } catch (e: any) {
        logger.error("useNotes: Upload failed", e);
        setError(e.message || "Failed to upload note");
        throw e;
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  // Replace note file
  const replaceNoteFile = useCallback(
    async (payload: NoteReplacePayload, updatedBy: string, userRole: string = "admin"): Promise<Note> => {
      setIsReplacing(payload.noteId);
      setError(null);
      try {
        const updated = await notesService.replaceNoteFile(payload, updatedBy, userRole);
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        return updated;
      } catch (e: any) {
        logger.error("useNotes: Replace failed", e);
        setError(e.message || "Failed to replace note file");
        throw e;
      } finally {
        setIsReplacing(null);
      }
    },
    []
  );

  // Update note metadata
  const updateMetadata = useCallback(
    async (noteId: string, metadata: NoteUpdateMetadataPayload, updatedBy: string, userRole: string = "admin") => {
      try {
        const updated = await notesService.updateNoteMetadata(noteId, metadata, updatedBy, userRole);
        setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
        return updated;
      } catch (e: any) {
        setError(e.message || "Failed to update note metadata");
        throw e;
      }
    },
    []
  );

  // Toggle visibility
  const toggleVisibility = useCallback(
    async (noteId: string, isVisible: boolean, updatedBy: string, userRole: string = "admin") => {
      try {
        await notesService.toggleNoteVisibility(noteId, isVisible, updatedBy, userRole);
        setNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, isVisible, status: isVisible ? "active" : "hidden" } : n))
        );
      } catch (e: any) {
        setError(e.message || "Failed to toggle visibility");
        throw e;
      }
    },
    []
  );

  // Delete note
  const deleteNote = useCallback(
    async (noteId: string, deletedBy: string, userRole: string = "admin") => {
      setIsDeleting(noteId);
      try {
        await notesService.deleteNote(noteId, deletedBy, userRole);
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
      } catch (e: any) {
        logger.error("useNotes: Delete failed", e);
        setError(e.message || "Failed to delete note");
        throw e;
      } finally {
        setIsDeleting(null);
      }
    },
    []
  );

  // Open note natively
  const openNote = useCallback(
    async (note: Note, userId: string = "anonymous", userRole: string = "student") => {
      try {
        await notesService.openNote(note, userId, userRole);
        // Optimistically increment download count
        setNotes((prev) =>
          prev.map((n) =>
            n.id === note.id
              ? {
                  ...n,
                  downloadCount: (n.downloadCount || 0) + 1,
                  lastDownloadedAt: new Date().toISOString(),
                }
              : n
          )
        );
      } catch (e: any) {
        logger.error("useNotes: Open failed", e);
        setError(e.message || "Failed to open note");
        throw e;
      }
    },
    []
  );

  // Filter setters
  const updateFilters = useCallback((newFilters: Partial<NoteFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ sortBy: "newest" });
  }, []);

  return {
    notes,
    isLoading,
    isUploading,
    isDeleting,
    isReplacing,
    error,
    filters,
    updateFilters,
    resetFilters,
    refresh: () => fetchNotes(filters),
    uploadNote,
    replaceNoteFile,
    updateMetadata,
    toggleVisibility,
    deleteNote,
    openNote,
  };
}
