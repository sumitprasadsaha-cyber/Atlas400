import React from "react";
import { ClassNote, Student } from "../types";
import AdminNotesDashboard from "./notes/AdminNotesDashboard";

interface AdminNotesViewProps {
  notes: ClassNote[];
  students?: Student[];
  onRefresh?: () => void;
}

/**
 * Atlas v5.0.7 — Modern Hierarchical Notes Management System
 * Completely redesigned Google Drive / Notion-style Notes Manager
 */
export default function AdminNotesView({
  notes = [],
  students = [],
  onRefresh,
}: AdminNotesViewProps) {
  return (
    <AdminNotesDashboard
      notes={notes}
      students={students}
      onRefresh={onRefresh}
    />
  );
}
