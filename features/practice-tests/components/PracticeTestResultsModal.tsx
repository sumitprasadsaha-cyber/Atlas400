import React, { useState } from "react";
import {
  X,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Filter,
  BarChart3,
  Sparkles,
  Share2,
} from "lucide-react";
import { PracticeResult, StudentTestAttempt } from "../../../shared/types/practice-tests.types";

interface PracticeTestResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: PracticeResult | null;
  attempt?: StudentTestAttempt | null;
  reviewQuestions?: Array<{
    id: string;
    questionNumber: number;
    question: string;
    options: string[];
    correctAnswer: number | string;
    studentAnswer: number | string | null;
    isCorrect: boolean;
    isSkipped: boolean;
    explanation?: string;
    reference?: string;
    hint?: string;
    difficulty?: "easy" | "medium" | "hard";
    marks?: number;
    negativeMarks?: number;
  }>;
  onRetake?: () => void;
}

export default function PracticeTestResultsModal({
  isOpen,
  onClose,
  result,
  attempt,
  reviewQuestions = [],
  onRetake,
}: PracticeTestResultsModalProps) {
  const [filterMode, setFilterMode] = useState<"all" | "correct" | "wrong" | "skipped">("all");
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);

  if (!isOpen || !result) return null;

  const isPassed = result.passStatus === "passed";
  const formattedTime = (() => {
    const mins = Math.floor(result.completionTime / 60);
    const secs = result.completionTime % 60;
    return `${mins}m ${secs}s`;
  })();

  const filteredQuestions = reviewQuestions.filter((q) => {
    if (filterMode === "correct") return q.isCorrect;
    if (filterMode === "wrong") return !q.isCorrect && !q.isSkipped;
    if (filterMode === "skipped") return q.isSkipped;
    return true;
  });

  const activeQuestion = filteredQuestions[selectedQuestionIndex] || filteredQuestions[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                isPassed
                  ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                  : "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
              }`}
            >
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {result.testTitle || "Practice Test Performance Report"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {result.subject} • {result.chapter}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary Scorecard */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Score</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-black text-indigo-950 dark:text-indigo-100">
                  {result.finalScore}
                </span>
                <span className="text-xs text-indigo-500 dark:text-indigo-400">/ {result.totalMarks}</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{result.percentage}% marks</span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Correct</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-black text-emerald-950 dark:text-emerald-100">
                  {result.correctCount}
                </span>
                <span className="text-xs text-emerald-500 dark:text-emerald-400">questions</span>
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                {isPassed ? "Passed Exam" : "Keep Practicing"}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50">
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Incorrect</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-black text-rose-950 dark:text-rose-100">{result.wrongCount}</span>
                <span className="text-xs text-rose-500 dark:text-rose-400">wrong</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{result.unansweredCount} skipped</span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Time Spent</span>
              <div className="mt-1 text-2xl font-black text-amber-950 dark:text-amber-100">{formattedTime}</div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Duration</span>
            </div>
          </div>

          {/* Difficulty Breakdown */}
          {result.breakdownByDifficulty && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-indigo-500" />
                Performance by Difficulty Level
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(["easy", "medium", "hard"] as const).map((diff) => {
                  const data = result.breakdownByDifficulty?.[diff];
                  if (!data || data.total === 0) return null;
                  const acc = Math.round((data.correct / data.total) * 100);
                  return (
                    <div
                      key={diff}
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                    >
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="capitalize font-semibold text-slate-700 dark:text-slate-300">{diff}</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {data.correct}/{data.total} ({acc}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            acc >= 70 ? "bg-emerald-500" : acc >= 40 ? "bg-amber-500" : "bg-rose-500"
                          }`}
                          style={{ width: `${acc}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detailed Question Review Section */}
          {reviewQuestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                  Detailed Question Review
                </h3>
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  {(["all", "correct", "wrong", "skipped"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setFilterMode(mode);
                        setSelectedQuestionIndex(0);
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition ${
                        filterMode === mode
                          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Number Badges */}
              <div className="flex flex-wrap gap-2">
                {filteredQuestions.map((q, idx) => (
                  <button
                    key={q.id || idx}
                    onClick={() => setSelectedQuestionIndex(idx)}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center ${
                      selectedQuestionIndex === idx
                        ? "ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900"
                        : ""
                    } ${
                      q.isCorrect
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                        : q.isSkipped
                        ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                    }`}
                  >
                    {q.questionNumber || idx + 1}
                  </button>
                ))}
              </div>

              {/* Active Question Details Card */}
              {activeQuestion && (
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                        Q{activeQuestion.questionNumber}
                      </span>
                      {activeQuestion.difficulty && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 uppercase">
                          {activeQuestion.difficulty}
                        </span>
                      )}
                    </div>
                    <div>
                      {activeQuestion.isCorrect ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" /> Correct (+{activeQuestion.marks || 4})
                        </span>
                      ) : activeQuestion.isSkipped ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                          <HelpCircle className="w-4 h-4" /> Skipped (0)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                          <XCircle className="w-4 h-4" /> Incorrect (-{activeQuestion.negativeMarks || 1})
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm font-medium text-slate-900 dark:text-white leading-relaxed">
                    {activeQuestion.question}
                  </p>

                  {/* Options */}
                  <div className="space-y-2">
                    {activeQuestion.options.map((opt, optIdx) => {
                      const isCorrectAnswer =
                        typeof activeQuestion.correctAnswer === "number"
                          ? activeQuestion.correctAnswer === optIdx
                          : String(activeQuestion.correctAnswer).toLowerCase() === opt.toLowerCase();
                      const isStudentSelected =
                        typeof activeQuestion.studentAnswer === "number"
                          ? activeQuestion.studentAnswer === optIdx
                          : String(activeQuestion.studentAnswer).toLowerCase() === opt.toLowerCase();

                      let stateClass = "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800";
                      if (isCorrectAnswer) {
                        stateClass =
                          "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200";
                      } else if (isStudentSelected && !isCorrectAnswer) {
                        stateClass =
                          "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200";
                      }

                      return (
                        <div
                          key={optIdx}
                          className={`p-3 rounded-xl border flex items-center justify-between text-xs transition ${stateClass}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold flex items-center justify-center text-slate-700 dark:text-slate-300">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span>{opt}</span>
                          </div>
                          {isCorrectAnswer && (
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              ✓ Correct Answer
                            </span>
                          )}
                          {isStudentSelected && !isCorrectAnswer && (
                            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                              ✗ Your Answer
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation box */}
                  {activeQuestion.explanation && (
                    <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs">
                      <span className="font-bold text-indigo-900 dark:text-indigo-300 block mb-1">
                        💡 Explanation:
                      </span>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        {activeQuestion.explanation}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Completed on {new Date(result.generatedAt).toLocaleDateString()}
          </div>
          <div className="flex items-center gap-3">
            {onRetake && (
              <button
                onClick={onRetake}
                className="px-4 py-2 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition cursor-pointer"
              >
                Retake Test
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
