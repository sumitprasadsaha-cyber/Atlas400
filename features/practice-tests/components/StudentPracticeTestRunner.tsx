import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Clock,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Bookmark,
  Send,
  Loader2,
  Award,
  HelpCircle,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { PracticeTest, PracticeTestQuestion, StudentTestAttempt, PracticeResult } from "../../../shared/types/practice-tests.types";
import { practiceTestsService } from "../services/practice-tests.service";
import PracticeTestResultsModal from "./PracticeTestResultsModal";

interface StudentPracticeTestRunnerProps {
  isOpen: boolean;
  onClose: () => void;
  test: PracticeTest;
  studentId: string;
  studentName?: string;
  onCompleted?: (result: PracticeResult) => void;
}

export default function StudentPracticeTestRunner({
  isOpen,
  onClose,
  test,
  studentId,
  studentName = "Student",
  onCompleted,
}: StudentPracticeTestRunnerProps) {
  const [questions, setQuestions] = useState<PracticeTestQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [secondsRemaining, setSecondsRemaining] = useState<number>(test.duration * 60);
  const [attemptId, setAttemptId] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Results State
  const [showResults, setShowResults] = useState<boolean>(false);
  const [finalResult, setFinalResult] = useState<PracticeResult | null>(null);
  const [finalAttempt, setFinalAttempt] = useState<StudentTestAttempt | null>(null);
  const [reviewQuestions, setReviewQuestions] = useState<any[]>([]);

  // Submission confirmation modal
  const [showConfirmSubmit, setShowConfirmSubmit] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // 1. Initialize Test & Fetch Questions from R2
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);
    setShowResults(false);
    setFinalResult(null);

    const initTest = async () => {
      try {
        // Fetch Question Bank from Cloudflare R2
        const bank = await practiceTestsService.fetchQuestionBank(test.r2ObjectKey);
        if (!isMounted) return;

        if (!bank || !Array.isArray(bank.questions) || bank.questions.length === 0) {
          throw new Error("No questions found in this practice test.");
        }

        setQuestions(bank.questions);

        // Check for existing ongoing attempt in Firestore to recover progress
        const existingAttempts = await practiceTestsService.getStudentAttempts(studentId, test.id);
        const ongoing = existingAttempts.find((a) => a.status === "in_progress");

        if (ongoing) {
          setAttemptId(ongoing.attemptId);
          setAnswers(ongoing.answers || {});
          setCurrentIdx(ongoing.currentQuestionIndex || 0);
          if (typeof ongoing.remainingSeconds === "number" && ongoing.remainingSeconds > 0) {
            setSecondsRemaining(ongoing.remainingSeconds);
          } else {
            setSecondsRemaining(test.duration * 60);
          }
        } else {
          // Initialize fresh attempt
          const newAttempt = await practiceTestsService.startAttempt(studentId, test.id, test, studentName);
          if (isMounted) {
            setAttemptId(newAttempt.attemptId);
            setSecondsRemaining(test.duration * 60);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to load practice test questions.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initTest();

    return () => {
      isMounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [isOpen, test.id, test.r2ObjectKey, studentId]);

  // 2. Countdown Timer
  useEffect(() => {
    if (!isOpen || isLoading || showResults || !questions.length) return;

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, isLoading, showResults, questions.length]);

  // 3. Periodic 5-second Auto-save to Firestore
  useEffect(() => {
    if (!isOpen || !attemptId || showResults) return;

    autoSaveRef.current = setInterval(() => {
      const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
      practiceTestsService.autoSaveAttempt(attemptId, {
        currentQuestionIndex: currentIdx,
        remainingSeconds: secondsRemaining,
        answers,
        timeTaken: timeSpent,
      }).catch((e) => console.warn("[PracticeRunner] Auto-save failed:", e));
    }, 5000);

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [isOpen, attemptId, currentIdx, secondsRemaining, answers, showResults]);

  const handleSelectOption = (questionId: string, optionIdx: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIdx,
    }));
  };

  const handleClearResponse = (questionId: string) => {
    setAnswers((prev) => {
      const copy = { ...prev };
      delete copy[questionId];
      return copy;
    });
  };

  const handleToggleFlag = (questionId: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const handleAutoSubmit = () => {
    handleSubmitTest();
  };

  const handleSubmitTest = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setShowConfirmSubmit(false);

    try {
      const timeTakenSeconds = Math.max(1, test.duration * 60 - secondsRemaining);

      const submission = await practiceTestsService.submitAttempt({
        attemptId,
        studentId,
        studentName,
        practiceTestId: test.id,
        r2ObjectKey: test.r2ObjectKey,
        answers,
        timeTaken: timeTakenSeconds,
      });

      setFinalAttempt(submission.attempt);
      setFinalResult(submission.result);
      setReviewQuestions(submission.review);
      setShowResults(true);

      if (onCompleted) {
        onCompleted(submission.result);
      }
    } catch (err: any) {
      alert("Submission error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentQ = questions[currentIdx];
  const qId = currentQ?.id || `q_${currentIdx + 1}`;
  const selectedOption = answers[qId];
  const isFlagged = flagged.has(qId);

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = questions.length - answeredCount;
  const flaggedCount = flagged.size;

  const formattedTimer = useMemo(() => {
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, [secondsRemaining]);

  const isLowTime = secondsRemaining <= 300; // 5 minutes or less

  if (!isOpen) return null;

  if (showResults && finalResult) {
    return (
      <PracticeTestResultsModal
        isOpen={true}
        onClose={onClose}
        result={finalResult}
        attempt={finalAttempt}
        reviewQuestions={reviewQuestions}
        onRetake={() => {
          setShowResults(false);
          setAnswers({});
          setFlagged(new Set());
          setCurrentIdx(0);
          setSecondsRemaining(test.duration * 60);
          startTimeRef.current = Date.now();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Navbar */}
        <div className="px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-md">
              {test.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {test.subject} • {test.chapter} • Total Marks: {test.totalMarks}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Timer Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition ${
                isLowTime
                  ? "bg-rose-100 text-rose-600 dark:bg-rose-950/70 dark:text-rose-400 animate-pulse border border-rose-300 dark:border-rose-800"
                  : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{formattedTimer}</span>
            </div>

            <button
              onClick={() => setShowConfirmSubmit(true)}
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Submit
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Body */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-xs text-slate-500">Loading questions from Cloudflare R2...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
            <AlertTriangle className="w-10 h-10 text-rose-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Unable to Start Test</h3>
            <p className="text-xs text-slate-500 max-w-sm">{error}</p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left/Main Question Area */}
            <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
              {/* Question Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl text-xs font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                    Question {currentIdx + 1} of {questions.length}
                  </span>
                  {currentQ?.difficulty && (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">
                      {currentQ.difficulty}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    +{currentQ?.marks || 4} / -{currentQ?.negativeMarks || 1}
                  </span>
                </div>

                <button
                  onClick={() => handleToggleFlag(qId)}
                  className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                    isFlagged
                      ? "bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                      : "border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  {isFlagged ? "Flagged for Review" : "Mark for Review"}
                </button>
              </div>

              {/* Question Text */}
              <div className="space-y-4">
                <p className="text-base font-medium text-slate-900 dark:text-white leading-relaxed select-none">
                  {currentQ?.question}
                </p>

                {/* Optional Image or Diagram */}
                {currentQ?.image && (
                  <div className="max-w-md rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                    <img
                      src={currentQ.image}
                      alt="Question attachment"
                      className="w-full h-auto object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </div>

              {/* Options */}
              <div className="space-y-3 pt-2">
                {currentQ?.options?.map((opt, optIdx) => {
                  const isSelected = selectedOption === optIdx;
                  return (
                    <button
                      key={optIdx}
                      onClick={() => handleSelectOption(qId, optIdx)}
                      className={`w-full p-4 rounded-2xl border text-left text-xs font-medium flex items-center justify-between transition cursor-pointer select-none ${
                        isSelected
                          ? "bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-500 dark:border-indigo-500 text-indigo-950 dark:text-indigo-100 ring-2 ring-indigo-500/20"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 rounded-lg font-bold flex items-center justify-center text-xs ${
                            isSelected
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span className="text-sm">{opt}</span>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                    </button>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => handleClearResponse(qId)}
                  disabled={selectedOption === undefined}
                  className="text-xs font-semibold text-slate-400 hover:text-rose-500 disabled:opacity-0 transition cursor-pointer"
                >
                  Clear Selection
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
                    disabled={currentIdx === 0}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
                    disabled={currentIdx === questions.length - 1}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-40 shadow-sm transition cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            {/* Right Sidebar: Palette */}
            <div className="w-full md:w-72 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 p-5 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
                  Question Palette
                </h3>

                {/* Status legend */}
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 mb-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-emerald-500" />
                    <span>Answered ({answeredCount})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-slate-200 dark:bg-slate-700" />
                    <span>Unanswered ({unansweredCount})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-amber-500" />
                    <span>Flagged ({flaggedCount})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md ring-2 ring-indigo-500 bg-white dark:bg-slate-900" />
                    <span>Current</span>
                  </div>
                </div>

                {/* Number Grid */}
                <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto pr-1">
                  {questions.map((q, idx) => {
                    const qItemKey = q.id || `q_${idx + 1}`;
                    const hasAnswer = answers[qItemKey] !== undefined;
                    const isQFlagged = flagged.has(qItemKey);
                    const isCur = currentIdx === idx;

                    let bgClass = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
                    if (hasAnswer) {
                      bgClass = "bg-emerald-600 text-white font-bold";
                    }
                    if (isQFlagged) {
                      bgClass = "bg-amber-500 text-white font-bold";
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => setCurrentIdx(idx)}
                        className={`h-9 rounded-xl text-xs font-semibold flex items-center justify-center transition cursor-pointer ${bgClass} ${
                          isCur
                            ? "ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 scale-105"
                            : "hover:opacity-80"
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Progress Summary Card */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  <span>Overall Progress</span>
                  <span>{Math.round((answeredCount / questions.length) * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${(answeredCount / questions.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal before Submit */}
        {showConfirmSubmit && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Submit Practice Test?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                You have answered <span className="font-bold text-slate-900 dark:text-white">{answeredCount}</span> of{" "}
                <span className="font-bold text-slate-900 dark:text-white">{questions.length}</span> questions.{" "}
                {unansweredCount > 0 && (
                  <span className="text-rose-500 block mt-1">
                    ⚠️ {unansweredCount} question(s) are currently unanswered.
                  </span>
                )}
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowConfirmSubmit(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Return to Test
                </button>
                <button
                  onClick={handleSubmitTest}
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Submission
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
