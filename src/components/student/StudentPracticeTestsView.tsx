import React, { useState, useMemo, useEffect } from "react";
import {
  Award,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  BarChart2,
  TrendingUp,
  X,
  FileCheck,
  ChevronRight,
} from "lucide-react";
import { Student } from "../../types";
import { PracticeTest, StudentTestAttempt, PracticeResult } from "../../../shared/types/practice-tests.types";
import { practiceTestsService } from "../../../features/practice-tests/services/practice-tests.service";
import StudentPracticeTestRunner from "../../../features/practice-tests/components/StudentPracticeTestRunner";
import PracticeTestResultsModal from "../../../features/practice-tests/components/PracticeTestResultsModal";
import { formatDisplayDate } from "../../utils/studentFormatters";

interface StudentPracticeTestsViewProps {
  student: Student;
  allTests: PracticeTest[];
  initialTestId?: string | null;
  onRefresh?: () => void;
}

export const StudentPracticeTestsView: React.FC<StudentPracticeTestsViewProps> = ({
  student,
  allTests,
  initialTestId,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedTestToRun, setSelectedTestToRun] = useState<PracticeTest | null>(null);
  const [selectedTestInstructions, setSelectedTestInstructions] = useState<PracticeTest | null>(null);
  const [attempts, setAttempts] = useState<StudentTestAttempt[]>([]);
  const [isLoadingAttempts, setIsLoadingAttempts] = useState(false);

  // Review past attempt modal
  const [reviewResult, setReviewResult] = useState<PracticeResult | null>(null);

  // Fetch student test attempts from Firestore
  useEffect(() => {
    let isMounted = true;
    const loadAttempts = async () => {
      setIsLoadingAttempts(true);
      try {
        const studentAttempts = await practiceTestsService.getStudentAttempts(student.id);
        if (isMounted) {
          setAttempts(studentAttempts);
        }
      } catch (err) {
        console.warn("[StudentPracticeTestsView] Failed to fetch test attempts:", err);
      } finally {
        if (isMounted) setIsLoadingAttempts(false);
      }
    };

    loadAttempts();
  }, [student.id]);

  // Initial test selection if passed
  useEffect(() => {
    if (initialTestId) {
      const match = allTests.find((t) => t.id === initialTestId);
      if (match) {
        setSelectedTestInstructions(match);
      }
    }
  }, [initialTestId, allTests]);

  // Available subjects for tests
  const subjects = useMemo(() => {
    const subs = new Set<string>();
    allTests.forEach((t) => {
      if (t.subject) subs.add(t.subject);
    });
    return Array.from(subs);
  }, [allTests]);

  // Filtered practice tests
  const filteredTests = useMemo(() => {
    return allTests.filter((t) => {
      const classMatch = !t.classGrade || t.classGrade === student.classGrade || t.classGrade === "all";
      const subjectMatch = selectedSubject === "all" || t.subject.toLowerCase() === selectedSubject.toLowerCase();
      const searchMatch =
        !searchQuery.trim() ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.chapter && t.chapter.toLowerCase().includes(searchQuery.toLowerCase()));

      return classMatch && subjectMatch && searchMatch;
    });
  }, [allTests, student.classGrade, selectedSubject, searchQuery]);

  // Attempts stats
  const attemptStats = useMemo(() => {
    if (attempts.length === 0) return { totalAttempts: 0, highestScore: 0, avgScore: 0, passedCount: 0 };
    const completed = attempts.filter((a) => a.status === "submitted");
    if (completed.length === 0) return { totalAttempts: 0, highestScore: 0, avgScore: 0, passedCount: 0 };

    const scores = completed.map((a) => a.percentage || 0);
    const highestScore = Math.max(...scores);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const passedCount = completed.filter((a) => (a.percentage || 0) >= 50).length;

    return { totalAttempts: completed.length, highestScore, avgScore, passedCount };
  }, [attempts]);

  // Map testId to best score
  const bestScoresMap = useMemo(() => {
    const map: Record<string, number> = {};
    attempts.forEach((a) => {
      const targetId = a.practiceTestId || a.testId;
      if (a.status === "submitted" && typeof a.percentage === "number" && targetId) {
        if (map[targetId] === undefined || a.percentage > map[targetId]) {
          map[targetId] = a.percentage;
        }
      }
    });
    return map;
  }, [attempts]);

  return (
    <div id="student-practice-tests-view" className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. Header and Analytics Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl">
                <Award className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Practice Tests & Assessments
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Test your subject mastery with timed MCQ question banks and instant score reviews
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tests, topics..."
              className="w-full pl-10 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Analytics Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Available Tests</span>
            <div className="text-lg font-black text-slate-900 dark:text-white">{filteredTests.length}</div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tests Attempted</span>
            <div className="text-lg font-black text-purple-600 dark:text-purple-400">{attemptStats.totalAttempts}</div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Highest Score</span>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{attemptStats.highestScore}%</div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Average Score</span>
            <div className="text-lg font-black text-blue-600 dark:text-blue-400">{attemptStats.avgScore}%</div>
          </div>
        </div>

        {/* Subject Filter Tabs */}
        {subjects.length > 0 && (
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedSubject("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedSubject === "all"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              All Subjects
            </button>
            {subjects.map((sub) => (
              <button
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedSubject.toLowerCase() === sub.toLowerCase()
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Available Practice Tests Grid */}
      {filteredTests.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-8 space-y-3">
          <div className="w-12 h-12 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mx-auto">
            <Award className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            No Practice Tests Available
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `No assessments matched "${searchQuery}".`
              : "No practice tests are currently active for this subject."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTests.map((test) => {
            const bestScore = bestScoresMap[test.id];

            return (
              <div
                key={test.id}
                className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 transition flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 truncate max-w-[140px]">
                      {test.subject}
                    </span>
                    {typeof bestScore === "number" && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          bestScore >= 75
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : bestScore >= 50
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        Best: {bestScore}%
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white line-clamp-2">
                      {test.title}
                    </h3>
                    {test.chapter && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                        Chapter: {test.chapter}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{test.duration} Minutes</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                      <span>{test.questionCount || test.questions?.length || "—"} Questions</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTestInstructions(test)}
                    className="w-full inline-flex items-center justify-center space-x-2 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>{typeof bestScore === "number" ? "Retake Test" : "Start Test"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. TEST INSTRUCTIONS MODAL */}
      {selectedTestInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-xl">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Test Instructions
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Read the guidelines carefully before starting
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTestInstructions(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-100 dark:border-purple-900/40 text-xs">
                <p className="font-bold text-purple-900 dark:text-purple-300 text-sm mb-1">
                  {selectedTestInstructions.title}
                </p>
                <div className="text-purple-700 dark:text-purple-400 space-y-0.5">
                  <div>Subject: {selectedTestInstructions.subject}</div>
                  {selectedTestInstructions.chapter && <div>Chapter: {selectedTestInstructions.chapter}</div>}
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Total Duration: <strong>{selectedTestInstructions.duration} Minutes</strong>. The timer will auto-submit when expired.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Questions can be marked for review and answered in any sequence.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Your test attempt is auto-saved to avoid progress loss if disconnected.</span>
                </div>
                {Boolean(selectedTestInstructions.negativeMarking) && (
                  <div className="flex items-start space-x-2 text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Negative marking is enabled (-{selectedTestInstructions.negativeMarking} per incorrect answer).</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedTestInstructions(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = selectedTestInstructions;
                  setSelectedTestInstructions(null);
                  setSelectedTestToRun(target);
                }}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95"
              >
                Begin Assessment Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. ACTIVE TEST RUNNER MODAL */}
      {selectedTestToRun && (
        <StudentPracticeTestRunner
          isOpen={Boolean(selectedTestToRun)}
          onClose={() => {
            setSelectedTestToRun(null);
            if (onRefresh) onRefresh();
          }}
          test={selectedTestToRun}
          studentId={student.id}
          studentName={student.name}
          onCompleted={(result) => {
            setReviewResult(result);
            setSelectedTestToRun(null);
          }}
        />
      )}

      {/* 5. RESULTS / REVIEW MODAL */}
      {reviewResult && (
        <PracticeTestResultsModal
          isOpen={Boolean(reviewResult)}
          onClose={() => setReviewResult(null)}
          result={reviewResult}
        />
      )}
    </div>
  );
};
