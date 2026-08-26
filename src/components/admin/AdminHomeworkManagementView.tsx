import React, { useState, useEffect } from "react";
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Paperclip,
  Calendar,
  Users,
  Search,
  ChevronRight,
  X,
  MessageSquare,
  Award,
  Send
} from "lucide-react";
import { StudentHomeworkItem, Student } from "../../types";
import { adminService } from "../../lib/adminService";

interface AdminHomeworkManagementViewProps {
  students: Student[];
}

export const AdminHomeworkManagementView: React.FC<AdminHomeworkManagementViewProps> = ({
  students,
}) => {
  const [homeworkList, setHomeworkList] = useState<StudentHomeworkItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedHwForReview, setSelectedHwForReview] = useState<StudentHomeworkItem | null>(null);

  // Form State
  const [formState, setFormState] = useState({
    title: "",
    classGrade: "Class 10",
    subject: "Mathematics",
    description: "",
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    assignedBy: "Lead Tutor",
  });

  // Review & Grading State
  const [reviewStudentId, setReviewStudentId] = useState(students[0]?.id || "");
  const [reviewGrade, setReviewGrade] = useState("A+");
  const [reviewRemarks, setReviewRemarks] = useState("Excellent work! All steps clearly demonstrated.");

  useEffect(() => {
    let active = true;
    const loadHw = async () => {
      const list = await adminService.getAllHomeworkAssignments();
      if (active) setHomeworkList(list);
    };
    loadHw();
    return () => {
      active = false;
    };
  }, []);

  const handleSaveHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.title) return;

    const newHw: StudentHomeworkItem = {
      id: "",
      title: formState.title,
      classGrade: formState.classGrade,
      subject: formState.subject,
      description: formState.description,
      dueDate: new Date(formState.dueDate).toISOString(),
      assignedBy: formState.assignedBy,
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    const saved = await adminService.saveHomeworkAssignment(newHw, "admin@atlas.tuition");
    setHomeworkList((prev) => [saved, ...prev]);
    setIsCreateModalOpen(false);
    setFormState({
      title: "",
      classGrade: "Class 10",
      subject: "Mathematics",
      description: "",
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      assignedBy: "Lead Tutor",
    });
  };

  const handleDeleteHomework = async (hwId: string) => {
    if (!confirm("Are you sure you want to delete this homework assignment?")) return;
    await adminService.deleteHomeworkAssignment(hwId, "admin@atlas.tuition");
    setHomeworkList((prev) => prev.filter((h) => h.id !== hwId));
  };

  const handleGradeSubmission = async () => {
    if (!selectedHwForReview || !reviewStudentId) return;
    await adminService.reviewAndGradeHomeworkSubmission(
      selectedHwForReview.id,
      reviewStudentId,
      reviewGrade,
      reviewRemarks,
      "admin@atlas.tuition"
    );
    alert("Homework submission graded and feedback returned to student successfully!");
    setSelectedHwForReview(null);
  };

  const filteredHw = homeworkList.filter((h) => {
    const matchSearch = h.title.toLowerCase().includes(searchTerm.toLowerCase()) || h.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchClass = classFilter === "all" || h.classGrade === classFilter;
    return matchSearch && matchClass;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" id="admin-homework-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Homework & Assignment Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Issue task assignments, set due deadlines, inspect student submissions, and return grades
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all cursor-pointer shadow-md shadow-rose-600/20"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Assign New Homework</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search homework by title, topic, or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
          />
        </div>

        <div>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs cursor-pointer"
          >
            <option value="all">All Classes</option>
            <option value="Class 10">Class 10</option>
            <option value="Class 9">Class 9</option>
            <option value="UPSC">UPSC</option>
          </select>
        </div>
      </div>

      {/* Homework Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredHw.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            No homework assignments found. Click "Assign New Homework" to create one.
          </div>
        ) : (
          filteredHw.map((hw) => (
            <div
              key={hw.id}
              className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-sm hover:border-rose-400 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                    {hw.classGrade} • {hw.subject}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDeleteHomework(hw.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      title="Delete Homework"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="text-sm font-black text-slate-900 dark:text-white line-clamp-1">
                  {hw.title}
                </h3>

                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {hw.description || "No specific instructions provided."}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-150 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Due: {new Date(hw.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    By: {hw.assignedBy || "Tutor"}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setSelectedHwForReview(hw);
                    setReviewStudentId(students[0]?.id || "");
                  }}
                  className="w-full py-1.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Review & Grade Submissions</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Homework Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Create Homework Assignment
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHomework} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assignment Title *
                </label>
                <input
                  type="text"
                  required
                  value={formState.title}
                  onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                  placeholder="e.g. Chapter 4 Trigonometry Exercises 4.1 & 4.2"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Class / Batch
                  </label>
                  <input
                    type="text"
                    value={formState.classGrade}
                    onChange={(e) => setFormState({ ...formState, classGrade: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={formState.subject}
                    onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Due Submission Date *
                </label>
                <input
                  type="date"
                  required
                  value={formState.dueDate}
                  onChange={(e) => setFormState({ ...formState, dueDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Task Instructions & Problems List
                </label>
                <textarea
                  rows={3}
                  value={formState.description}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                  placeholder="Solve questions 1 through 15 on page 42. Show all formula derivations..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-150 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
                >
                  Publish Homework
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Submissions Modal */}
      {selectedHwForReview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Review & Grade Submission
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedHwForReview.title}
                </p>
              </div>
              <button
                onClick={() => setSelectedHwForReview(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Student
                </label>
                <select
                  value={reviewStudentId}
                  onChange={(e) => setReviewStudentId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs cursor-pointer"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.classGrade})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Grade / Score
                </label>
                <input
                  type="text"
                  value={reviewGrade}
                  onChange={(e) => setReviewGrade(e.target.value)}
                  placeholder="e.g. A+, 95/100, Excellent"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tutor Remarks & Feedback
                </label>
                <textarea
                  rows={3}
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-150 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedHwForReview(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGradeSubmission}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Return Grade to Student</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
