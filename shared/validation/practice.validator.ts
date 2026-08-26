import { PracticeTestQuestion, PracticeTestQuestionBank } from "../types/practice-tests.types";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  cleanQuestionBank?: PracticeTestQuestionBank;
}

/**
 * Validates a single practice test question
 */
export function validateSingleQuestion(
  q: any,
  index: number
): { isValid: boolean; errors: string[]; cleanQuestion?: PracticeTestQuestion } {
  const errors: string[] = [];

  if (!q || typeof q !== "object") {
    return { isValid: false, errors: [`Question #${index + 1} is not a valid object.`] };
  }

  const rawQuestion = (q.question || q.text || q.questionText || "").toString().trim();
  if (!rawQuestion) {
    errors.push(`Question #${index + 1}: Missing question text.`);
  }

  let options: string[] = [];
  if (Array.isArray(q.options)) {
    options = q.options.map((opt: any) => (opt != null ? String(opt).trim() : "")).filter(Boolean);
  } else if (typeof q.options === "object" && q.options !== null) {
    options = Object.values(q.options).map((opt: any) => (opt != null ? String(opt).trim() : "")).filter(Boolean);
  }

  if (options.length < 2) {
    errors.push(`Question #${index + 1}: Must contain at least 2 non-empty options.`);
  }

  // Determine correct answer index
  let correctIndex = -1;
  if (typeof q.correctAnswer === "number") {
    if (q.correctAnswer >= 0 && q.correctAnswer < options.length) {
      correctIndex = q.correctAnswer;
    } else {
      errors.push(`Question #${index + 1}: Correct answer index ${q.correctAnswer} is out of bounds (options: ${options.length}).`);
    }
  } else if (typeof q.correctAnswer === "string") {
    const trimmed = q.correctAnswer.trim();
    // Check if letter A, B, C, D...
    if (/^[A-Z]$/i.test(trimmed)) {
      const idx = trimmed.toUpperCase().charCodeAt(0) - 65;
      if (idx >= 0 && idx < options.length) {
        correctIndex = idx;
      }
    }
    if (correctIndex === -1) {
      // Try matching by exact option string
      const matchedIdx = options.findIndex((opt) => opt.toLowerCase() === trimmed.toLowerCase());
      if (matchedIdx !== -1) {
        correctIndex = matchedIdx;
      }
    }
    if (correctIndex === -1 && typeof q.correctOptionIndex === "number") {
      if (q.correctOptionIndex >= 0 && q.correctOptionIndex < options.length) {
        correctIndex = q.correctOptionIndex;
      }
    }
  } else if (typeof q.correctOptionIndex === "number") {
    if (q.correctOptionIndex >= 0 && q.correctOptionIndex < options.length) {
      correctIndex = q.correctOptionIndex;
    }
  }

  if (correctIndex === -1 && errors.length === 0) {
    errors.push(`Question #${index + 1}: Could not determine a valid correct answer from provided options.`);
  }

  const marks = typeof q.marks === "number" && q.marks > 0 ? q.marks : 4;
  const negativeMarks = typeof q.negativeMarks === "number" ? Math.abs(q.negativeMarks) : 1;
  const difficulty = ["easy", "medium", "hard"].includes(String(q.difficulty).toLowerCase())
    ? (String(q.difficulty).toLowerCase() as "easy" | "medium" | "hard")
    : "medium";

  const questionId = q.id && String(q.id).trim() ? String(q.id).trim() : `q_${index + 1}_${Date.now()}`;

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  const cleanQuestion: PracticeTestQuestion = {
    id: questionId,
    question: rawQuestion,
    options,
    correctAnswer: correctIndex,
    explanation: q.explanation ? String(q.explanation).trim() : undefined,
    difficulty,
    marks,
    negativeMarks,
    image: q.image ? String(q.image).trim() : undefined,
    diagram: q.diagram ? String(q.diagram).trim() : undefined,
    reference: q.reference ? String(q.reference).trim() : undefined,
    hint: q.hint ? String(q.hint).trim() : undefined,
    tags: Array.isArray(q.tags) ? q.tags.map(String) : undefined,
  };

  return { isValid: true, errors: [], cleanQuestion };
}

/**
 * Validates an entire question bank payload and produces clean JSON
 */
export function validateQuestionBank(
  payload: any,
  fallbackMetadata?: {
    testId?: string;
    title?: string;
    subject?: string;
    chapter?: string;
    batch?: string;
    duration?: number;
  }
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!payload || typeof payload !== "object") {
    return { isValid: false, errors: ["Invalid question bank payload: root must be an object or array."], warnings: [] };
  }

  // Handle case where payload is directly an array of questions
  const rawQuestions = Array.isArray(payload) ? payload : payload.questions;
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return { isValid: false, errors: ["No questions found in question bank. Minimum 1 question is required."], warnings: [] };
  }

  const testId = payload.testId || fallbackMetadata?.testId || `test_${Date.now()}`;
  const title = (payload.title || fallbackMetadata?.title || "Practice Test").toString().trim();
  const subject = (payload.subject || fallbackMetadata?.subject || "General").toString().trim();
  const chapter = (payload.chapter || fallbackMetadata?.chapter || "General").toString().trim();
  const batch = payload.batch || fallbackMetadata?.batch || "All Batches";
  const description = payload.description || "";
  const duration = Number(payload.duration || fallbackMetadata?.duration) || 30;
  const negativeMarking = typeof payload.negativeMarking === "number" ? payload.negativeMarking : 0.25;

  const seenIds = new Set<string>();
  const cleanQuestions: PracticeTestQuestion[] = [];
  let totalMarks = 0;

  rawQuestions.forEach((rawQ: any, idx: number) => {
    const validated = validateSingleQuestion(rawQ, idx);
    if (!validated.isValid || !validated.cleanQuestion) {
      errors.push(...validated.errors);
      return;
    }

    let qId = validated.cleanQuestion.id;
    if (seenIds.has(qId)) {
      warnings.push(`Duplicate question ID '${qId}' encountered at #${idx + 1}. Auto-generating unique ID.`);
      qId = `${qId}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`;
      validated.cleanQuestion.id = qId;
    }
    seenIds.add(qId);

    totalMarks += validated.cleanQuestion.marks;
    cleanQuestions.push(validated.cleanQuestion);
  });

  if (errors.length > 0) {
    return { isValid: false, errors, warnings };
  }

  const now = new Date().toISOString();
  const cleanQuestionBank: PracticeTestQuestionBank = {
    testId,
    title,
    subject,
    chapter,
    batch,
    description,
    duration,
    totalMarks,
    negativeMarking,
    questions: cleanQuestions,
    version: Number(payload.version) || 1,
    createdAt: payload.createdAt || now,
    updatedAt: now,
  };

  return {
    isValid: true,
    errors: [],
    warnings,
    cleanQuestionBank,
  };
}

/**
 * Parses CSV or Tab-Delimited text into Practice Questions
 */
export function parseCsvToQuestions(csvText: string): { success: boolean; questions: PracticeTestQuestion[]; errors: string[] } {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) {
    return { success: false, questions: [], errors: ["CSV file is empty or contains only a header."] };
  }

  // Detect delimiter: comma, tab, or semicolon
  const headerLine = lines[0];
  let delimiter = ",";
  if (headerLine.includes("\t")) delimiter = "\t";
  else if (headerLine.includes(";") && !headerLine.includes(",")) delimiter = ";";

  const headers = headerLine.split(delimiter).map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ""));
  
  const qIdx = headers.findIndex((h) => h.includes("question") || h.includes("text") || h.includes("prompt"));
  const optAIdx = headers.findIndex((h) => h === "a" || h === "option_a" || h === "option a" || h === "option1" || h === "opt1");
  const optBIdx = headers.findIndex((h) => h === "b" || h === "option_b" || h === "option b" || h === "option2" || h === "opt2");
  const optCIdx = headers.findIndex((h) => h === "c" || h === "option_c" || h === "option c" || h === "option3" || h === "opt3");
  const optDIdx = headers.findIndex((h) => h === "d" || h === "option_d" || h === "option d" || h === "option4" || h === "opt4");
  const ansIdx = headers.findIndex((h) => h.includes("ans") || h.includes("correct") || h.includes("key"));
  const expIdx = headers.findIndex((h) => h.includes("exp") || h.includes("solution") || h.includes("reason"));
  const diffIdx = headers.findIndex((h) => h.includes("diff") || h.includes("level"));
  const marksIdx = headers.findIndex((h) => h.includes("mark") || h.includes("pts"));

  if (qIdx === -1) {
    return { success: false, questions: [], errors: ["CSV header must include a 'Question' column."] };
  }

  const rawRows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    // Split taking quotes into account
    const tokens: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let charIdx = 0; charIdx < rawLine.length; charIdx++) {
      const c = rawLine[charIdx];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === delimiter && !inQuotes) {
        tokens.push(cur.trim().replace(/^["']|["']$/g, ""));
        cur = "";
      } else {
        cur += c;
      }
    }
    tokens.push(cur.trim().replace(/^["']|["']$/g, ""));

    const qText = tokens[qIdx] || "";
    if (!qText) continue;

    const options: string[] = [];
    if (optAIdx !== -1 && tokens[optAIdx]) options.push(tokens[optAIdx]);
    if (optBIdx !== -1 && tokens[optBIdx]) options.push(tokens[optBIdx]);
    if (optCIdx !== -1 && tokens[optCIdx]) options.push(tokens[optCIdx]);
    if (optDIdx !== -1 && tokens[optDIdx]) options.push(tokens[optDIdx]);

    // Fallback: search for remaining tokens
    if (options.length === 0 && tokens.length > qIdx + 1) {
      for (let k = qIdx + 1; k < Math.min(tokens.length, qIdx + 5); k++) {
        if (tokens[k]) options.push(tokens[k]);
      }
    }

    const rawAns = ansIdx !== -1 ? tokens[ansIdx] : "A";
    const rawExp = expIdx !== -1 ? tokens[expIdx] : "";
    const rawDiff = diffIdx !== -1 ? tokens[diffIdx] : "medium";
    const rawMarks = marksIdx !== -1 ? Number(tokens[marksIdx]) || 4 : 4;

    rawRows.push({
      id: `q_csv_${i}`,
      question: qText,
      options,
      correctAnswer: rawAns,
      explanation: rawExp,
      difficulty: rawDiff,
      marks: rawMarks,
      negativeMarks: 1,
    });
  }

  const result = validateQuestionBank(rawRows);
  if (!result.isValid || !result.cleanQuestionBank) {
    return { success: false, questions: [], errors: result.errors };
  }

  return { success: true, questions: result.cleanQuestionBank.questions, errors: [] };
}

/**
 * Natural text format parser (e.g. from pasted MCQ document or Word text)
 */
export function parseFormattedTextToQuestions(text: string): { success: boolean; questions: PracticeTestQuestion[]; errors: string[] } {
  const lines = text.split(/\r?\n/);
  const questions: PracticeTestQuestion[] = [];
  const errors: string[] = [];

  let currentQuestion: {
    questionText: string;
    options: string[];
    correctAnswerText?: string;
    correctOptionIndex?: number;
    explanation?: string;
    difficulty?: "easy" | "medium" | "hard";
    marks?: number;
    negativeMarks?: number;
  } | null = null;

  const flushQuestion = () => {
    if (!currentQuestion) return;
    if (!currentQuestion.questionText.trim()) return;

    let correctIndex = currentQuestion.correctOptionIndex ?? -1;
    if (correctIndex === -1 && currentQuestion.correctAnswerText) {
      const matchLetter = currentQuestion.correctAnswerText.match(/^[A-D]/i);
      if (matchLetter) {
        correctIndex = matchLetter[0].toUpperCase().charCodeAt(0) - 65;
      }
    }

    if (correctIndex < 0 || correctIndex >= currentQuestion.options.length) {
      correctIndex = 0; // fallback to first option
    }

    questions.push({
      id: `q_txt_${questions.length + 1}_${Date.now()}`,
      question: currentQuestion.questionText.trim(),
      options: currentQuestion.options.length >= 2 ? currentQuestion.options : ["True", "False"],
      correctAnswer: correctIndex,
      explanation: currentQuestion.explanation?.trim(),
      difficulty: currentQuestion.difficulty || "medium",
      marks: currentQuestion.marks || 4,
      negativeMarks: currentQuestion.negativeMarks || 1,
    });

    currentQuestion = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed === "⸻" || /^[=\-_*]{3,}$/.test(trimmed)) continue;

    // Check for Question Number marker e.g., "1.", "1)", "Q1.", "Q1:"
    const qMatch = trimmed.match(/^(?:Q\s*)?(\d+)[\.\):]\s*(.*)$/i);
    if (qMatch) {
      flushQuestion();
      currentQuestion = {
        questionText: qMatch[2] || "",
        options: [],
        difficulty: "medium",
        marks: 4,
        negativeMarks: 1,
      };
      continue;
    }

    // Check for Option e.g., "A.", "A)", "(A)", "[A]"
    const optMatch = trimmed.match(/^[\(\[]?([A-E])[\)\]\.\:]\s*(.*)$/i);
    if (optMatch && currentQuestion) {
      let optText = optMatch[2] || "";
      const isCheckMarked = optText.includes("✅") || optText.includes("✔");
      if (isCheckMarked) {
        optText = optText.replace(/[✅✔]/g, "").trim();
        const letterIndex = optMatch[1].toUpperCase().charCodeAt(0) - 65;
        currentQuestion.correctOptionIndex = letterIndex;
      }
      currentQuestion.options.push(optText.trim());
      continue;
    }

    // Check for Correct Answer marker: "Correct Answer: C" or "Answer: B"
    const ansMatch = trimmed.match(/^(?:Correct\s+)?Ans(?:wer)?\s*[\:\=]\s*(.*)$/i);
    if (ansMatch && currentQuestion) {
      currentQuestion.correctAnswerText = ansMatch[1].trim();
      continue;
    }

    // Check for Explanation: "Explanation: ..." or "Solution: ..."
    const expMatch = trimmed.match(/^(?:Explanation|Solution|Reason)\s*[\:\=]\s*(.*)$/i);
    if (expMatch && currentQuestion) {
      currentQuestion.explanation = expMatch[1].trim();
      continue;
    }

    // Append to current question text or explanation
    if (currentQuestion) {
      if (currentQuestion.explanation) {
        currentQuestion.explanation += " " + trimmed;
      } else if (currentQuestion.options.length === 0) {
        currentQuestion.questionText += " " + trimmed;
      }
    }
  }

  flushQuestion();

  if (questions.length === 0) {
    return { success: false, questions: [], errors: ["Could not detect any valid questions in the provided text."] };
  }

  return { success: true, questions, errors: [] };
}

export const practiceValidator = {
  validateSingleQuestion,
  validateQuestionBank,
  parseCsvToQuestions,
  parseFormattedTextToQuestions,
};
