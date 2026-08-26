import React, { useState, useEffect } from "react";
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Loader2,
  Trash2,
  Plus,
  Image as ImageIcon,
  Save,
  FileSpreadsheet,
  Code2,
  HelpCircle,
} from "lucide-react";
import { PracticeTest, PracticeTestQuestion, QuestionBank } from "../../../shared/types/practice-tests.types";
import { practiceValidator } from "../../../shared/validation/practice.validator";
import { practiceTestsService } from "../services/practice-tests.service";

interface AdminTestBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTest?: PracticeTest | null;
  onSaved?: (test: PracticeTest) => void;
}

export default function AdminTestBuilderModal({
  isOpen,
  onClose,
  initialTest,
  onSaved,
}: AdminTestBuilderModalProps) {
  const [activeTab, setActiveTab] = useState<"text" | "json" | "csv" | "manual">("text");

  // Metadata Fields
  const [title, setTitle] = useState<string>("");
  const [subject, setSubject] = useState<string>("Physics");
  const [chapter, setChapter] = useState<string>("Motion");
  const [chapterNo, setChapterNo] = useState<number>(1);
  const [topicName, setTopicName] = useState<string>("");
  const [classGrade, setClassGrade] = useState<string>("Grade 10");
  const [batch, setBatch] = useState<string>("All Batches");
  const [duration, setDuration] = useState<number>(30);
  const [description, setDescription] = useState<string>("");

  // Input Data
  const [rawText, setRawText] = useState<string>("");
  const [jsonInput, setJsonInput] = useState<string>("");
  const [csvInput, setCsvInput] = useState<string>("");
  const [parsedQuestions, setParsedQuestions] = useState<PracticeTestQuestion[]>([]);

  // Feedback State
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Initialize or populate if editing
  useEffect(() => {
    if (!isOpen) return;

    if (initialTest) {
      setTitle(initialTest.title || "");
      setSubject(initialTest.subject || "Physics");
      setChapter(initialTest.chapter || "Motion");
      setChapterNo(initialTest.chapterNo || 1);
      setTopicName(initialTest.topicName || "");
      setClassGrade(initialTest.classGrade || "Grade 10");
      setBatch(initialTest.batch || "All Batches");
      setDuration(initialTest.duration || 30);
      setDescription(initialTest.description || "");

      // Fetch current questions from R2
      practiceTestsService.fetchQuestionBank(initialTest.r2ObjectKey).then((bank) => {
        if (bank?.questions) {
          setParsedQuestions(bank.questions);
          setJsonInput(JSON.stringify(bank, null, 2));
        }
      });
    } else {
      setTitle("");
      setSubject("Physics");
      setChapter("Chapter 1: Kinematics");
      setChapterNo(1);
      setTopicName("Uniform Acceleration");
      setClassGrade("Grade 10");
      setBatch("All Batches");
      setDuration(30);
      setDescription("");
      setRawText("");
      setJsonInput("");
      setCsvInput("");
      setParsedQuestions([]);
      setValidationErrors([]);
      setValidationSuccess(null);
    }
  }, [isOpen, initialTest]);

  if (!isOpen) return null;

  const handleParseText = () => {
    setValidationErrors([]);
    setValidationSuccess(null);

    const result = practiceValidator.parseFormattedTextToQuestions(rawText);

    if (!result.success || !result.questions?.length) {
      setValidationErrors(result.errors.length ? result.errors : ["No valid questions parsed."]);
      return;
    }

    setParsedQuestions(result.questions);
    setValidationSuccess(`Successfully parsed ${result.questions.length} questions from text.`);
  };

  const handleParseJson = () => {
    setValidationErrors([]);
    setValidationSuccess(null);

    try {
      const parsed = JSON.parse(jsonInput);
      const validation = practiceValidator.validateQuestionBank(parsed);
      if (!validation.isValid || !validation.cleanQuestionBank) {
        setValidationErrors(validation.errors);
        return;
      }
      setParsedQuestions(validation.cleanQuestionBank.questions);
      if (validation.cleanQuestionBank.title && !title) setTitle(validation.cleanQuestionBank.title);
      setValidationSuccess(`Valid Question Bank: ${validation.cleanQuestionBank.questions.length} questions loaded.`);
    } catch (e: any) {
      setValidationErrors(["Invalid JSON format: " + e.message]);
    }
  };

  const handleParseCsv = () => {
    setValidationErrors([]);
    setValidationSuccess(null);

    const result = practiceValidator.parseCsvToQuestions(csvInput);
    if (!result.success || !result.questions?.length) {
      setValidationErrors(result.errors.length ? result.errors : ["No valid questions parsed from CSV."]);
      return;
    }

    setParsedQuestions(result.questions);
    setValidationSuccess(`Successfully parsed ${result.questions.length} questions from CSV.`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (file.name.endsWith(".json")) {
        setJsonInput(content);
        setActiveTab("json");
      } else if (file.name.endsWith(".csv")) {
        setCsvInput(content);
        setActiveTab("csv");
      } else {
        setRawText(content);
        setActiveTab("text");
      }
    };
    reader.readAsText(file);
  };

  const handleSaveToCloudflareR2 = async () => {
    if (parsedQuestions.length === 0) {
      setValidationErrors(["Please parse or enter at least one question before saving."]);
      return;
    }

    setIsSaving(true);
    setValidationErrors([]);
    setValidationSuccess(null);

    try {
      const testTitle = title || `${topicName || chapter} - ${subject} Practice Test`;
      const testId = initialTest?.id || `test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const totalMarks = parsedQuestions.reduce((acc, q) => acc + (q.marks || 4), 0);

      const bankPayload: QuestionBank = {
        testId,
        title: testTitle,
        subject,
        chapter,
        batch,
        description,
        duration,
        totalMarks,
        negativeMarking: 0.25,
        questions: parsedQuestions,
        version: (initialTest?.version || 0) + 1,
        createdAt: initialTest?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      let resultTest: PracticeTest;

      if (initialTest) {
        // Atomic Replace Question Bank in R2
        const updated = await practiceTestsService.replaceQuestionBank(
          initialTest.id,
          bankPayload,
          { id: "admin", name: "Admin" }
        );
        resultTest = updated.test;
      } else {
        // Create new Question Bank in R2 & Firestore
        const created = await practiceTestsService.createTest(bankPayload);
        resultTest = created.test;
      }

      setValidationSuccess("Practice test successfully saved to Cloudflare R2 and Firestore!");
      if (onSaved) onSaved(resultTest);

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setValidationErrors([err.message || "Failed to save practice test."]);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {initialTest ? "Edit / Replace Practice Test" : "Create New Practice Test"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Binary stored in Cloudflare R2 • Metadata indexed in Firestore
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              Import File
              <input
                type="file"
                accept=".json,.csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Grid */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              1. Test Details & Target Batch
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Physics"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Chapter Name *
                </label>
                <input
                  type="text"
                  value={chapter}
                  onChange={(e) => setChapter(e.target.value)}
                  placeholder="e.g. Chapter 1: Kinematics"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Topic Name
                </label>
                <input
                  type="text"
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  placeholder="e.g. Acceleration"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Class / Grade
                </label>
                <input
                  type="text"
                  value={classGrade}
                  onChange={(e) => setClassGrade(e.target.value)}
                  placeholder="e.g. Grade 10"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Batch Assignment
                </label>
                <input
                  type="text"
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  placeholder="e.g. All Batches"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Question Input Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                2. Input Question Bank
              </h3>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab("text")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    activeTab === "text"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Text Parser
                </button>
                <button
                  onClick={() => setActiveTab("json")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    activeTab === "json"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  JSON
                </button>
                <button
                  onClick={() => setActiveTab("csv")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                    activeTab === "csv"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  CSV
                </button>
              </div>
            </div>

            {/* Tab: Text */}
            {activeTab === "text" && (
              <div className="space-y-2">
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Paste questions here, for example:
1. What is the SI unit of acceleration?
A. m/s
B. m/s² ✅
C. km/h
D. Newton

Explanation: Acceleration is the rate of change of velocity per unit time.
`}
                  className="w-full h-48 p-4 text-xs font-mono rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleParseText}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition cursor-pointer"
                  >
                    Parse Text
                  </button>
                </div>
              </div>
            )}

            {/* Tab: JSON */}
            {activeTab === "json" && (
              <div className="space-y-2">
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder='Paste Question Bank JSON array or object...'
                  className="w-full h-48 p-4 text-xs font-mono rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleParseJson}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition cursor-pointer"
                  >
                    Validate JSON
                  </button>
                </div>
              </div>
            )}

            {/* Tab: CSV */}
            {activeTab === "csv" && (
              <div className="space-y-2">
                <textarea
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  placeholder="Question,OptionA,OptionB,OptionC,OptionD,CorrectAnswer,Explanation"
                  className="w-full h-48 p-4 text-xs font-mono rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleParseCsv}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition cursor-pointer"
                  >
                    Parse CSV
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Validation Feedback */}
          {validationErrors.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-4 h-4" /> Validation Errors:
              </div>
              <ul className="text-xs text-rose-600 dark:text-rose-400 list-disc list-inside space-y-0.5">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {validationSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
              {validationSuccess}
            </div>
          )}

          {/* Live Questions Preview */}
          {parsedQuestions.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  3. Parsed Questions Preview ({parsedQuestions.length} Questions)
                </h3>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {parsedQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-900 dark:text-white">
                        Q{idx + 1}. {q.question}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-300 uppercase">
                        {q.difficulty || "medium"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-slate-600 dark:text-slate-400">
                      {q.options.map((opt, optIdx) => {
                        const isCorrect =
                          typeof q.correctAnswer === "number"
                            ? q.correctAnswer === optIdx
                            : String(q.correctAnswer).toLowerCase() === opt.toLowerCase();
                        return (
                          <div
                            key={optIdx}
                            className={`p-1.5 rounded-lg border ${
                              isCorrect
                                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-700 dark:text-emerald-300 font-semibold"
                                : "border-slate-100 dark:border-slate-800"
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}. {opt}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40">
          <div className="text-xs text-slate-500">
            {parsedQuestions.length} Questions • {parsedQuestions.reduce((acc, q) => acc + (q.marks || 4), 0)} Total Marks
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveToCloudflareR2}
              disabled={isSaving || parsedQuestions.length === 0}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save to Cloudflare R2
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
