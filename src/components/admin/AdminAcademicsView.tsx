import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  Layers,
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  Users,
  Search,
  CheckCircle2,
  X,
  ChevronRight,
  FolderPlus
} from "lucide-react";
import { AcademicCourse, AcademicBatch, Student, ClassNote } from "../../types";
import { adminService } from "../../lib/adminService";

interface AdminAcademicsViewProps {
  students: Student[];
  allNotes: ClassNote[];
}

export const AdminAcademicsView: React.FC<AdminAcademicsViewProps> = ({
  students,
  allNotes,
}) => {
  const [courses, setCourses] = useState<AcademicCourse[]>([]);
  const [batches, setBatches] = useState<AcademicBatch[]>([]);
  const [activeTab, setActiveTab] = useState<"courses" | "batches" | "subjects">("courses");
  const [searchTerm, setSearchTerm] = useState("");
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Form State for Course
  const [editingCourse, setEditingCourse] = useState<AcademicCourse | null>(null);
  const [courseForm, setCourseForm] = useState({
    name: "",
    code: "",
    description: "",
    category: "school" as "school" | "competitive" | "upsc" | "vocational",
    targetGrades: "Class 10",
  });

  // Form State for Batch
  const [editingBatch, setEditingBatch] = useState<AcademicBatch | null>(null);
  const [batchForm, setBatchForm] = useState({
    name: "",
    courseId: "",
    classGrade: "Class 10",
    academicYear: "2026-2027",
    term: "Annual",
    maxCapacity: 30,
    schedule: "Mon-Wed-Fri 04:30 PM",
  });

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      const cList = await adminService.getCourses();
      const bList = await adminService.getBatches();
      if (active) {
        setCourses(cList);
        setBatches(bList);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, []);

  // Handle Save Course
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseForm.name || !courseForm.code) return;

    const courseToSave: AcademicCourse = {
      id: editingCourse?.id || "",
      name: courseForm.name,
      code: courseForm.code,
      description: courseForm.description,
      category: courseForm.category,
      targetGrades: [courseForm.targetGrades],
      status: "active",
      createdAt: editingCourse?.createdAt || new Date().toISOString(),
    };

    const saved = await adminService.saveCourse(courseToSave, "admin@atlas.tuition");
    setCourses((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [saved, ...prev];
    });

    setIsCourseModalOpen(false);
    setEditingCourse(null);
    setCourseForm({ name: "", code: "", description: "", category: "school", targetGrades: "Class 10" });
  };

  // Handle Delete Course
  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm("Are you sure you want to delete this course?")) return;
    await adminService.deleteCourse(courseId, "admin@atlas.tuition");
    setCourses((prev) => prev.filter((c) => c.id !== courseId));
  };

  // Handle Save Batch
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchForm.name) return;

    const selectedCourse = courses.find((c) => c.id === batchForm.courseId);

    const batchToSave: AcademicBatch = {
      id: editingBatch?.id || "",
      name: batchForm.name,
      courseId: batchForm.courseId,
      courseName: selectedCourse?.name || "General Curriculum",
      classGrade: batchForm.classGrade,
      academicYear: batchForm.academicYear,
      term: batchForm.term,
      maxCapacity: Number(batchForm.maxCapacity) || 30,
      schedule: batchForm.schedule,
      status: "active",
      createdAt: editingBatch?.createdAt || new Date().toISOString(),
    };

    const saved = await adminService.saveBatch(batchToSave, "admin@atlas.tuition");
    setBatches((prev) => {
      const idx = prev.findIndex((b) => b.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [saved, ...prev];
    });

    setIsBatchModalOpen(false);
    setEditingBatch(null);
    setBatchForm({
      name: "",
      courseId: "",
      classGrade: "Class 10",
      academicYear: "2026-2027",
      term: "Annual",
      maxCapacity: 30,
      schedule: "Mon-Wed-Fri 04:30 PM",
    });
  };

  // Handle Delete Batch
  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm("Are you sure you want to delete this batch?")) return;
    await adminService.deleteBatch(batchId, "admin@atlas.tuition");
    setBatches((prev) => prev.filter((b) => b.id !== batchId));
  };

  // Extract distinct subjects and chapters from notes
  const subjectBreakdown = React.useMemo(() => {
    const map: Record<string, { classGrade: string; chaptersCount: number; notes: number }> = {};
    allNotes.forEach((n) => {
      const key = `${n.classGrade} - ${n.subject}`;
      if (!map[key]) {
        map[key] = { classGrade: n.classGrade, chaptersCount: 0, notes: 0 };
      }
      map[key].notes += 1;
    });
    return Object.entries(map);
  }, [allNotes]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" id="admin-academics-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Academic Programs & Curriculum
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Structure courses, batches, academic years, terms, and subject syllabi
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "courses" && (
            <button
              onClick={() => {
                setEditingCourse(null);
                setCourseForm({ name: "", code: "", description: "", category: "school", targetGrades: "Class 10" });
                setIsCourseModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer shadow-md shadow-blue-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Course</span>
            </button>
          )}

          {activeTab === "batches" && (
            <button
              onClick={() => {
                setEditingBatch(null);
                setBatchForm({
                  name: "",
                  courseId: courses[0]?.id || "",
                  classGrade: "Class 10",
                  academicYear: "2026-2027",
                  term: "Annual",
                  maxCapacity: 30,
                  schedule: "Mon-Wed-Fri 04:30 PM",
                });
                setIsBatchModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Batch</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("courses")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === "courses"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Courses ({courses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("batches")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === "batches"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Batches ({batches.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("subjects")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === "subjects"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Subjects & Syllabi</span>
        </button>
      </div>

      {/* Course List View */}
      {activeTab === "courses" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <div
              key={course.id}
              className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-sm hover:border-blue-400 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                    {course.code}
                  </span>
                  <h3 className="text-base font-black text-slate-900 dark:text-white mt-1.5">
                    {course.name}
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingCourse(course);
                      setCourseForm({
                        name: course.name,
                        code: course.code,
                        description: course.description || "",
                        category: course.category || "school",
                        targetGrades: course.targetGrades?.[0] || "Class 10",
                      });
                      setIsCourseModalOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCourse(course.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                {course.description || "No description provided for this academic course."}
              </p>

              <div className="pt-2 border-t border-slate-150 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  Target: {course.targetGrades?.join(", ") || "General"}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 font-bold text-[10px]">
                  Active
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Batch List View */}
      {activeTab === "batches" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {batches.map((batch) => (
            <div
              key={batch.id}
              className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-sm hover:border-indigo-400 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                    {batch.academicYear} • {batch.term || "Annual"}
                  </span>
                  <h3 className="text-base font-black text-slate-900 dark:text-white mt-1.5">
                    {batch.name}
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingBatch(batch);
                      setBatchForm({
                        name: batch.name,
                        courseId: batch.courseId || "",
                        classGrade: batch.classGrade,
                        academicYear: batch.academicYear,
                        term: batch.term || "Annual",
                        maxCapacity: batch.maxCapacity || 30,
                        schedule: batch.schedule || "Mon-Wed-Fri 04:30 PM",
                      });
                      setIsBatchModalOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteBatch(batch.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{batch.schedule || "Schedule not specified"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                  <span>Grade: {batch.classGrade}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-150 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">
                  Capacity: {batch.maxCapacity || 30} students
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 font-bold text-[10px]">
                  Enrolling
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Subjects & Syllabi View */}
      {activeTab === "subjects" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            Active Enrolled Subjects & Syllabi Modules
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {subjectBreakdown.map(([key, item]) => (
              <div
                key={key}
                className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl space-y-1.5"
              >
                <div className="font-bold text-slate-900 dark:text-white text-xs">
                  {key}
                </div>
                <div className="text-[11px] text-slate-500">
                  {item.notes} study material chapters in Cloudflare R2
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Course Modal */}
      {isCourseModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {editingCourse ? "Edit Course" : "Create New Course"}
              </h3>
              <button
                onClick={() => setIsCourseModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Course Name *
                </label>
                <input
                  type="text"
                  required
                  value={courseForm.name}
                  onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                  placeholder="e.g. Class 10 CBSE Board Prep"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Course Code *
                </label>
                <input
                  type="text"
                  required
                  value={courseForm.code}
                  onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
                  placeholder="e.g. CBSE-10"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Target Grade
                </label>
                <input
                  type="text"
                  value={courseForm.targetGrades}
                  onChange={(e) => setCourseForm({ ...courseForm, targetGrades: e.target.value })}
                  placeholder="e.g. Class 10 or UPSC"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  placeholder="Brief curriculum syllabus description..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-150 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCourseModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
                >
                  Save Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {editingBatch ? "Edit Batch" : "Create New Batch"}
              </h3>
              <button
                onClick={() => setIsBatchModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBatch} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Batch Name *
                </label>
                <input
                  type="text"
                  required
                  value={batchForm.name}
                  onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })}
                  placeholder="e.g. Class 10 Morning Batch (CBSE-A)"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Class Grade
                  </label>
                  <input
                    type="text"
                    value={batchForm.classGrade}
                    onChange={(e) => setBatchForm({ ...batchForm, classGrade: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={batchForm.academicYear}
                    onChange={(e) => setBatchForm({ ...batchForm, academicYear: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Weekly Schedule
                </label>
                <input
                  type="text"
                  value={batchForm.schedule}
                  onChange={(e) => setBatchForm({ ...batchForm, schedule: e.target.value })}
                  placeholder="e.g. Mon, Wed, Fri (07:00 AM - 08:30 AM)"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-150 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
                >
                  Save Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
