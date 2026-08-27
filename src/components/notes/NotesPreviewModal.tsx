import React, { useState, useEffect } from "react";
import { 
  X, 
  Download, 
  ExternalLink, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  FileText, 
  Maximize2, 
  Minimize2,
  Loader2,
  AlertCircle
} from "lucide-react";
import { ClassNote, ChapterNote } from "../../types";
import { isImageFile } from "../../lib/nativePdfService";

interface NotesPreviewModalProps {
  note: ClassNote | ChapterNote | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: (note: ClassNote | ChapterNote) => void;
}

export default function NotesPreviewModal({
  note,
  isOpen,
  onClose,
  onDownload,
}: NotesPreviewModalProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!isOpen || !note) {
      setBlobUrl(null);
      setIsLoading(false);
      setHasError(false);
      setZoom(100);
      setRotation(0);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    const url = note.pdfUrl || (note as any).publicUrl || (note as any).downloadUrl || "";
    if (url) {
      setBlobUrl(url);
      setIsLoading(false);
    } else {
      setHasError(true);
      setIsLoading(false);
    }
  }, [isOpen, note]);

  if (!isOpen || !note) return null;

  const isImg = isImageFile(note.fileName || note.pdfFileName || "");
  const title = (note as any).topicTitle || (note as any).topicName || note.partLabel || note.chapterName || "Document Preview";
  const subtitle = [
    (note as any).className || note.classGrade,
    note.subject,
    (note as any).chapterNumber ? `Chapter ${(note as any).chapterNumber}` : (note as any).moduleNumber ? `Module ${(note as any).moduleNumber}` : "",
  ].filter(Boolean).join(" • ");

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const directUrl = blobUrl || note.pdfUrl || "";

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
      id="notes-preview-modal-backdrop"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-5xl h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        id="notes-preview-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate" title={title}>
                {title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {subtitle} {note.fileName ? `• ${note.fileName}` : ""}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isImg && (
              <>
                <button
                  onClick={handleZoomOut}
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  title="Zoom Out"
                  id="preview-zoom-out-btn"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-slate-500 w-10 text-center">
                  {zoom}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  title="Zoom In"
                  id="preview-zoom-in-btn"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRotate}
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  title="Rotate"
                  id="preview-rotate-btn"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </>
            )}

            {directUrl && (
              <a
                href={directUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Open in new tab"
                id="preview-open-new-tab-btn"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            {onDownload && (
              <button
                onClick={() => onDownload(note)}
                className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Download"
                id="preview-download-btn"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors hidden sm:inline-flex"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              id="preview-fullscreen-btn"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ml-1"
              title="Close"
              id="preview-close-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="relative flex-1 w-full h-full overflow-auto bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-2 sm:p-4">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/70 dark:bg-slate-900/70 backdrop-blur-xs">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="mt-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                Loading document preview...
              </p>
            </div>
          )}

          {hasError || !directUrl ? (
            <div className="flex flex-col items-center justify-center text-center p-6 max-w-md">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-2xl text-amber-600 border border-amber-200 dark:border-amber-900 mb-3">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Preview Unavailable
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
                The document preview could not be loaded directly. You can download the file or open it in a new browser tab.
              </p>
              {directUrl && (
                <a
                  href={directUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" /> Open File
                </a>
              )}
            </div>
          ) : isImg ? (
            <div className="w-full h-full flex items-center justify-center overflow-auto">
              <img
                src={directUrl}
                alt={title}
                className="max-w-full max-h-full object-contain transition-transform duration-200 rounded-lg shadow-sm"
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                }}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                }}
              />
            </div>
          ) : (
            <iframe
              src={`${directUrl}#toolbar=1&navpanes=0`}
              title={title}
              className="w-full h-full border-0 rounded-xl bg-white shadow-inner"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
