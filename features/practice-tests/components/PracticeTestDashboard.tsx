import React, { useState, useEffect, useMemo } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Clock,
  Award,
  Layers,
  Sparkles,
  Trash2,
  RefreshCw,
  Play,
  FileText,
  CheckCircle2,
  BarChart3,
  Users,
  Eye,
  Edit,
  ArrowRight,
  UploadCloud,
  FileSpreadsheet,
} from "lucide-react";
import { PracticeTest, PracticeResult, QuestionBank } from "../../../shared/types/practice-tests.types";
import { practiceTestsService } from "../services/practice-tests.service";
import StudentPracticeTestRunner from "./StudentPracticeTestRunner";
import PracticeTestResultsModal from "./PracticeTestResultsModal";

interface PracticeTestDashboardProps {
  userRole?: "admin" | "teacher" | "student";
  currentStudentId?: string;
  currentStudentName?: string;
  classGrade?: string;
  onOpenAdminBuilder?: (test?: PracticeTest) => void;
}

export default function PracticeTestDashboard({
  userRole = "admin",
  currentStudentId = "demo_student",
  currentStudentName = "Student",
  classGrade = "Grade 10",
  onOpenAdminBuilder,
}: PracticeTestDashboardProps) {
  const [tests, setTests] = useState<PracticeTest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedBatch, setSelectedBatch] = useState<string>("all");

  // Active student runner state
  const [activeTestForRunning, setActiveTestForRunning] = useState<PracticeTest | null>(null);

  // Active result modal state
  const [selectedResult, setSelectedResult] = useState<PracticeResult | null>(null);
  const [isResultOpen, setIsResultOpen] = useState<boolean>(false);

  // Student scores map: testId -> best Score
  const [studentResults, setStudentResults] = useState<Record<string, PracticeResult>>({});

  const isAdmin = userRole === "admin" || userRole === "teacher";

  // 1. Subscribe to Real-time Tests from Firestore
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = practiceTestsService.subscribeToTests((freshTests) => {
      setTests(freshTests);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch student past results
  useEffect(() => {
    if (!currentStudentId) return;

    const loadResults = async () => {
      try {
        const results = await practiceTestsService.getStudentResults(currentStudentId);
        const map: Record<string, PracticeResult> = {};
        results.forEach((r) => {
          if (!map[r.practiceTestId] || r.finalScore > map[r.practiceTestId].finalScore) {
            map[r.practiceTestId] = r;
          }
        });
        setStudentResults(map);
      } catch (err) {
        console.warn("[PracticeDashboard] Error loading student results:", err);
      }
    };

    loadResults();
  }, [currentStudentId]);

  // Derived filters
  const subjects = useMemo(() => {
    const set = new Set<string>();
    tests.forEach((t) => {
      if (t.subject) set.add(t.subject);
    });
    return Array.from(set);
  }, [tests]);

  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      const matchSubject = selectedSubject === "all" || t.subject === selectedSubject;
      const matchBatch = selectedBatch === "all" || t.batch === selectedBatch || t.batch === "All Batches";
      const matchQuery =
        !searchQuery ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.chapter.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.subject.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSubject && matchBatch && matchQuery;
    });
  }, [tests, selectedSubject, selectedBatch, searchQuery]);

  const handleDeleteTest = async (test: PracticeTest, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Permanently delete "${test.title}" and its questions from Cloudflare R2?`)) {
      try {
        await practiceTestsService.deletePracticeTest(test.id, test.r2ObjectKey);
      } catch (err: any) {
        alert("Failed to delete test: " + err.message);
      }
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-950 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 uppercase tracking-wider">
              Atlas 2.0 Module
            </span>
            <span className="text-xs text-indigo-300">R2 + Firestore Architecture</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Practice Tests & Question Banks</h1>
          <p className="text-xs sm:text-sm text-indigo-200 max-w-xl">
            Timed practice assessments with instant automated scoring, difficulty analysis, and cloud persistence.
          </p>
        </div>

        {isAdmin && onOpenAdminBuilder && (
          <div className="relative z-10 flex items-center gap-2.5">
            <button
              onClick={() => onOpenAdminBuilder()}
              className="px-4 py-2.5 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs shadow-lg transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create Practice Test
            </button>
          </div>
        )}
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Practice Tests</div>
          <div className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{tests.length}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Available Questions</div>
          <div className="mt-1 text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {tests.reduce((acc, t) => acc + (t.questionCount || 0), 0)}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Published Status</div>
          <div className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {tests.filter((t) => t.status === "published").length}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tests Attempted</div>
          <div className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">
            {Object.keys(studentResults).length}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by topic, chapter, or title..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Subject Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">All Subjects</option>
            {subjects.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tests Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          <span>Synchronizing tests with Cloud Firestore...</span>
        </div>
      ) : filteredTests.length === 0 ? (
        <div className="p-12 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Practice Tests Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {isAdmin
              ? "Create your first practice test to start uploading questions to Cloudflare R2."
              : "No practice tests are currently assigned to your grade or batch."}
          </p>
          {isAdmin && onOpenAdminBuilder && (
            <button
              onClick={() => onOpenAdminBuilder()}
              className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition cursor-pointer"
            >
              Create New Test
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTests.map((test) => {
            const studentPastResult = studentResults[test.id];

            return (
              <div
                key={test.id}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group relative"
              >
                <div className="space-y-3">
                  {/* Top Tags */}
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                      {test.subject}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                      {test.chapter}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                      {test.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                      {test.description || `Assessment covering ${test.topicName || test.chapter}.`}
                    </p>
                  </div>

                  {/* Test Info Badges */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{test.questionCount} Qs</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>{test.duration} mins</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{test.totalMarks} Marks</span>
                    </div>
                  </div>

                  {/* Student Previous Score Badge (if completed) */}
                  {studentPastResult && (
                    <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Best: {studentPastResult.finalScore} / {studentPastResult.totalMarks}</span>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedResult(studentPastResult);
                          setIsResultOpen(true);
                        }}
                        className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        View Report
                      </button>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  {isAdmin ? (
                    <div className="flex items-center gap-2">
                      {onOpenAdminBuilder && (
                        <button
                          onClick={() => onOpenAdminBuilder(test)}
                          className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="Edit / Replace Question Bank"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDeleteTest(test, e)}
                        className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition cursor-pointer"
                        title="Delete from R2 & Firestore"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">
                      Negative: -{test.negativeMarking * 100}%
                    </div>
                  )}

                  <button
                    onClick={() => setActiveTestForRunning(test)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer ml-auto"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {studentPastResult ? "Retake Test" : "Start Test"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Student Runner Modal */}
      {activeTestForRunning && (
        <StudentPracticeTestRunner
          isOpen={true}
          onClose={() => setActiveTestForRunning(null)}
          test={activeTestForRunning}
          studentId={currentStudentId}
          studentName={currentStudentName}
          onCompleted={(res) => {
            setStudentResults((prev) => ({
              ...prev,
              [res.practiceTestId]: res,
            }));
          }}
        />
      )}

      {/* Results Modal */}
      {selectedResult && (
        <PracticeTestResultsModal
          isOpen={isResultOpen}
          onClose={() => {
            setIsResultOpen(false);
            setSelectedResult(null);
          }}
          result={selectedResult}
        />
      )}
    </div>
  );
}
