import React, { useState, useEffect } from "react";
import {
  Bell,
  Plus,
  Edit2,
  Trash2,
  Pin,
  Calendar,
  Users,
  Search,
  CheckCircle2,
  Paperclip,
  X,
  Send,
  Eye,
  Megaphone
} from "lucide-react";
import { AdminAnnouncement } from "../../types";
import { adminService } from "../../lib/adminService";

export const AdminAnnouncementsView: React.FC = () => {
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AdminAnnouncement | null>(null);

  // Form State
  const [formState, setFormState] = useState({
    title: "",
    content: "",
    targetScope: "all" as "all" | "course" | "batch" | "student",
    targetId: "",
    isPinned: false,
    authorName: "Head Office",
  });

  useEffect(() => {
    let active = true;
    const loadAnnouncements = async () => {
      const list = await adminService.getAnnouncements();
      if (active) setAnnouncements(list);
    };
    loadAnnouncements();
    return () => {
      active = false;
    };
  }, []);

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.title || !formState.content) return;

    const annToSave: AdminAnnouncement = {
      id: editingAnnouncement?.id || "",
      title: formState.title,
      content: formState.content,
      targetType: formState.targetScope,
      targetScope: formState.targetScope,
      targetId: formState.targetId || undefined,
      isPinned: formState.isPinned,
      authorId: "admin",
      authorName: formState.authorName,
      createdAt: editingAnnouncement?.createdAt || new Date().toISOString(),
    };

    const saved = await adminService.saveAnnouncement(annToSave, "admin@atlas.tuition");
    setAnnouncements((prev) => {
      const idx = prev.findIndex((a) => a.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [saved, ...prev];
    });

    setIsModalOpen(false);
    setEditingAnnouncement(null);
    setFormState({
      title: "",
      content: "",
      targetScope: "all",
      targetId: "",
      isPinned: false,
      authorName: "Head Office",
    });
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    await adminService.deleteAnnouncement(id, "admin@atlas.tuition");
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  };

  const filteredAnnouncements = announcements.filter((a) =>
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" id="admin-announcements-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Official Announcements & Notices
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Broadcast institute alerts, holiday schedules, exam notices, and target specific batches
          </p>
        </div>

        <button
          onClick={() => {
            setEditingAnnouncement(null);
            setFormState({
              title: "",
              content: "",
              targetScope: "all",
              targetId: "",
              isPinned: false,
              authorName: "Head Office",
            });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all cursor-pointer shadow-md shadow-amber-600/20"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Announcement</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search announcements..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
        />
      </div>

      {/* Announcements List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredAnnouncements.map((ann) => (
          <div
            key={ann.id}
            className={`p-5 bg-white dark:bg-slate-900 border rounded-2xl space-y-3 shadow-sm transition-all ${
              ann.isPinned
                ? "border-amber-400/80 bg-amber-50/10 dark:border-amber-600/50"
                : "border-slate-200 dark:border-slate-800"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {ann.isPinned && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1">
                    <Pin className="w-3 h-3" />
                    <span>Pinned</span>
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Target: {ann.targetScope.toUpperCase()}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditingAnnouncement(ann);
                    setFormState({
                      title: ann.title,
                      content: ann.content,
                      targetScope: ann.targetScope,
                      targetId: ann.targetId || "",
                      isPinned: !!ann.isPinned,
                      authorName: ann.authorName || "Head Office",
                    });
                    setIsModalOpen(true);
                  }}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteAnnouncement(ann.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {ann.title}
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line">
              {ann.content}
            </p>

            <div className="pt-2 border-t border-slate-150 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
              <span>Author: {ann.authorName || "Administration"}</span>
              <span>{new Date(ann.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {editingAnnouncement ? "Edit Announcement" : "Create Official Announcement"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAnnouncement} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={formState.title}
                  onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                  placeholder="e.g. Schedule for Upcoming Term-1 Mock Examinations"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Audience Target
                  </label>
                  <select
                    value={formState.targetScope}
                    onChange={(e) => setFormState({ ...formState, targetScope: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs cursor-pointer"
                  >
                    <option value="all">Entire Institute (All Students)</option>
                    <option value="course">Specific Course</option>
                    <option value="batch">Specific Batch</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Author Name / Department
                  </label>
                  <input
                    type="text"
                    value={formState.authorName}
                    onChange={(e) => setFormState({ ...formState, authorName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Announcement Message Body *
                </label>
                <textarea
                  rows={4}
                  required
                  value={formState.content}
                  onChange={(e) => setFormState({ ...formState, content: e.target.value })}
                  placeholder="Dear students, please note that the mock examination will commence on..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formState.isPinned}
                  onChange={(e) => setFormState({ ...formState, isPinned: e.target.checked })}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Pin to top of student bulletin board
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-150 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer"
                >
                  Publish Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
