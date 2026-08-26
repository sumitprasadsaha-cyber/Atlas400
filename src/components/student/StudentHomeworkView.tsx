import React, { useState, useMemo } from "react";
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Upload,
  Send,
  ExternalLink,
  ChevronRight,
  Filter,
  Sparkles,
  X,
  Paperclip,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Student } from "../../types";
import { StudentHomeworkItem, studentPortalService } from "../../lib/studentPortalService";
import { formatDisplayDate } from "../../utils/studentFormatters";

interface StudentHomeworkViewProps {
  student: Student;
  homework: StudentHomeworkItem[];
  onRefresh?: () => void;
}

export const StudentHomeworkView: React.FC<StudentHomeworkViewProps> = ({
  student,
  homework,
  onRefresh,
}) => {
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "submitted" | "completed">("all");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedItemForSubmit, setSelectedItemForSubmit] = useState<StudentHomeworkItem | null>(null);
  const [submissionRemarks, setSubmissionRemarks] = useState("");
  const [submissionAttachmentUrl, setSubmissionAttachmentUrl] = useState("");
  const [submissionAttachmentName, setSubmissionAttachmentName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);

  // Available subjects
  const subjects = useMemo(() => {
    const subs = new Set<string>();
    homework.forEach((h) => {
      if (h.subject) subs.add(h.subject);
    });
    return Array.from(subs);
  }, [homework]);

  // Filter homework
  const filteredHomework = useMemo(() => {
    return homework.filter((h) => {
      const matchStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "pending"
          ? h.status === "pending"
          : statusFilter === "submitted"
          ? h.status === "submitted"
          : h.status === "completed" || h.status === "reviewed";

      const matchSubject = selectedSubject === "all" ? true : h.subject.toLowerCase() === selectedSubject.toLowerCase();
      return matchStatus && matchSubject;
    });
  }, [homework, statusFilter, selectedSubject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForSubmit) return;

    setIsSubmitting(true);
    try {
      await studentPortalService.submitStudentHomework(selectedItemForSubmit.id, student.id, {
        remarks: submissionRemarks,
        attachmentUrl: submissionAttachmentUrl,
        attachmentName: submissionAttachmentName,
      });

      setSubmitSuccessMsg("Homework submitted successfully!");
      setTimeout(() => {
        setSubmitSuccessMsg(null);
        setSelectedItemForSubmit(null);
        setSubmissionRemarks("");
        setSubmissionAttachmentUrl("");
        setSubmissionAttachmentName("");
        if (onRefresh) onRefresh();
      }, 1500);
    } catch (err: any) {
      alert(`Submission failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDueStatus = (dueDate: string, status: string) => {
    if (status === "submitted" || status === "completed" || status === "reviewed") {
      return { label: "Submitted", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200" };
    }

    const due = new Date(dueDate).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: "Overdue", color: "text-rose-600 bg-rose-50 dark:bg-rose-950/50 border-rose-200" };
    }
    if (diffDays === 0) {
      return { label: "Due Today", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/50 border-amber-200" };
    }
    if (diffDays === 1) {
      return { label: "Due Tomorrow", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/50 border-amber-200" };
    }
    return { label: `Due in ${diffDays} days`, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/50 border-blue-200" };
  };

  return (
    <div id="student-homework-view" className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Homework & Assignments
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Track assigned problem sets, submission deadlines, and tutor feedback
            </p>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center space-x-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {(["all", "pending", "submitted", "completed"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition ${
                  statusFilter === st
                    ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Subject Filter Pills */}
        {subjects.length > 0 && (
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 pt-2 border-t border-slate-100 dark:border-slate-800 scrollbar-none">
            <button
              onClick={() => setSelectedSubject("all")}
              className={`px-3.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer ${
                selectedSubject === "all"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              All Subjects
            </button>
            {subjects.map((sub) => (
              <button
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                className={`px-3.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer ${
                  selectedSubject.toLowerCase() === sub.toLowerCase()
                    ? "bg-amber-500 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Homework Cards List */}
      {filteredHomework.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-8 space-y-3">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            No Homework Assignments Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            No homework matches your selected filters. Great job staying on top of your studies!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHomework.map((item) => {
            const dueInfo = getDueStatus(item.dueDate, item.status);
            const isPending = item.status === "pending";

            return (
              <div
                key={item.id}
                className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-amber-300 dark:hover:border-amber-600 transition flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 truncate max-w-[130px]">
                      {item.subject}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${dueInfo.color}`}
                    >
                      {dueInfo.label}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3">
                      {item.description}
                    </p>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Due: {formatDisplayDate(item.dueDate)}</span>
                    </span>
                    {item.assignedBy && <span>By: {item.assignedBy}</span>}
                  </div>

                  {item.teacherRemarks && (
                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-xs space-y-1">
                      <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Teacher Feedback:</span>
                      </div>
                      <p className="text-emerald-700 dark:text-emerald-400">{item.teacherRemarks}</p>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  {isPending ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItemForSubmit(item);
                        setSubmissionRemarks(item.submissionRemarks || "");
                        setSubmissionAttachmentUrl(item.submissionAttachmentUrl || "");
                      }}
                      className="w-full inline-flex items-center justify-center space-x-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer active:scale-95"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Submit Solution</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItemForSubmit(item);
                        setSubmissionRemarks(item.submissionRemarks || "");
                        setSubmissionAttachmentUrl(item.submissionAttachmentUrl || "");
                      }}
                      className="w-full inline-flex items-center justify-center space-x-2 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>View Submission</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Homework Submission Modal */}
      {selectedItemForSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedItemForSubmit.status === "pending" ? "Submit Homework" : "Your Submission"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedItemForSubmit.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItemForSubmit(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitSuccessMsg ? (
              <div className="p-6 text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-emerald-700">{submitSuccessMsg}</h4>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Submission Notes / Solution Summary
                  </label>
                  <textarea
                    rows={4}
                    value={submissionRemarks}
                    onChange={(e) => setSubmissionRemarks(e.target.value)}
                    placeholder="Describe your solution or write your answers here..."
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Solution Attachment URL / Image Drive Link (Optional)
                  </label>
                  <div className="relative">
                    <Paperclip className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      value={submissionAttachmentUrl}
                      onChange={(e) => setSubmissionAttachmentUrl(e.target.value)}
                      placeholder="https://drive.google.com/... or hosted image link"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedItemForSubmit(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center space-x-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? "Submitting..." : "Save Submission"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
