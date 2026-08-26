import React from "react";
import { useNotes } from "../hooks/useNotes";
import { FileText, Download, ExternalLink, Clock } from "lucide-react";
import { formatBytes, formatDisplayDate } from "../../../shared/utils";

interface NotesContainerProps {
  classId: string;
  subjectId: string;
}

export const NotesContainer: React.FC<NotesContainerProps> = ({ classId, subjectId }) => {
  const { notes, isLoading, error, openNote } = useNotes(classId, subjectId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
        <span>Loading notes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Class Notes</h2>
        <span className="text-xs text-slate-500">{notes.length} documents</span>
      </div>

      {notes.length === 0 ? (
        <div className="text-center py-10 bg-slate-50 border border-slate-200 rounded-xl">
          <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">No notes uploaded yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => openNote(note)}
              className="flex items-start justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-sm cursor-pointer transition"
            >
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-800 line-clamp-1">{note.title}</h3>
                  <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                    <span>{formatBytes(note.fileSize)}</span>
                    <span>•</span>
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDisplayDate(note.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="p-1.5 text-slate-400 hover:text-blue-600 transition"
                title="Open Document"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
