import { getObjectFromR2, getR2ServerConfig } from "../_lib/r2Server";
import { PracticeTestQuestionBank, PracticeResult, StudentTestAttempt } from "../../shared/types/practice-tests.types";

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: { message: "Method not allowed. Use POST." } });
  }

  try {
    const { attemptId, studentId, studentName, practiceTestId, r2ObjectKey, answers, timeTaken, startedAt } = req.body || {};

    if (!studentId || !practiceTestId || !r2ObjectKey) {
      return res.status(400).json({
        success: false,
        error: { message: "Missing required fields: studentId, practiceTestId, and r2ObjectKey are required." },
      });
    }

    const config = getR2ServerConfig();
    const bucket = (req.body?.bucket || config.bucket || "academy-connect-files").trim();

    // Fetch official question bank directly from R2 to securely verify answers server-side
    const r2Response = await getObjectFromR2({ bucket, key: r2ObjectKey });
    if (!r2Response.body) {
      return res.status(404).json({ success: false, error: { message: `Question bank not found in R2: ${r2ObjectKey}` } });
    }

    // Read full JSON string from stream
    const chunks: any[] = [];
    for await (const chunk of r2Response.body as any) {
      chunks.push(chunk);
    }
    const jsonStr = Buffer.concat(chunks).toString("utf-8");
    const questionBank: PracticeTestQuestionBank = JSON.parse(jsonStr);

    // Calculate score, penalties, and question breakdown
    const studentAnswers = answers || {};
    let earnedMarks = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    const difficultyBreakdown = {
      easy: { total: 0, correct: 0, score: 0 },
      medium: { total: 0, correct: 0, score: 0 },
      hard: { total: 0, correct: 0, score: 0 },
    };

    const reviewItems: any[] = [];

    questionBank.questions.forEach((q, idx) => {
      const qDiff = (q.difficulty || "medium") as "easy" | "medium" | "hard";
      if (difficultyBreakdown[qDiff]) {
        difficultyBreakdown[qDiff].total += 1;
      }

      const qId = q.id || `q_${idx + 1}`;
      const givenAns = studentAnswers[qId];

      const hasAnswered = givenAns !== undefined && givenAns !== null && givenAns !== "";
      let isCorrect = false;

      if (!hasAnswered) {
        unansweredCount += 1;
      } else {
        if (typeof q.correctAnswer === "number") {
          isCorrect = Number(givenAns) === q.correctAnswer;
        } else if (typeof q.correctAnswer === "string") {
          isCorrect = String(givenAns).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
        }

        if (isCorrect) {
          correctCount += 1;
          const marks = q.marks || 4;
          earnedMarks += marks;
          if (difficultyBreakdown[qDiff]) {
            difficultyBreakdown[qDiff].correct += 1;
            difficultyBreakdown[qDiff].score += marks;
          }
        } else {
          wrongCount += 1;
          const penalty = q.negativeMarks !== undefined ? q.negativeMarks : (questionBank.negativeMarking || 0);
          earnedMarks -= penalty;
        }
      }

      reviewItems.push({
        id: qId,
        questionNumber: idx + 1,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        studentAnswer: hasAnswered ? givenAns : null,
        isCorrect,
        isSkipped: !hasAnswered,
        explanation: q.explanation || "No explanation provided.",
        reference: q.reference,
        hint: q.hint,
        difficulty: qDiff,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
      });
    });

    // Score bounds check
    earnedMarks = Math.max(0, earnedMarks);
    const totalMarks = questionBank.totalMarks || (questionBank.questions.length * 4);
    const percentage = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 10000) / 100 : 0;
    const passingPercentage = 40;
    const passStatus = percentage >= passingPercentage ? "passed" : "failed";
    const finalAttemptId = attemptId || `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const evaluatedAttempt: StudentTestAttempt = {
      attemptId: finalAttemptId,
      studentId,
      studentName: studentName || "Student",
      practiceTestId,
      testTitle: questionBank.title,
      subject: questionBank.subject,
      chapter: questionBank.chapter,
      startedAt: startedAt || now,
      submittedAt: now,
      timeTaken: Number(timeTaken) || 0,
      answers: studentAnswers,
      score: earnedMarks,
      totalMarks,
      percentage,
      passed: passStatus === "passed",
      passStatus,
      correct: correctCount,
      wrong: wrongCount,
      unanswered: unansweredCount,
      status: "submitted",
    };

    const evaluatedResult: PracticeResult = {
      id: finalAttemptId,
      attemptId: finalAttemptId,
      studentId,
      studentName: studentName || "Student",
      practiceTestId,
      testTitle: questionBank.title,
      subject: questionBank.subject,
      chapter: questionBank.chapter,
      finalScore: earnedMarks,
      totalMarks,
      percentage,
      passStatus,
      completionTime: Number(timeTaken) || 0,
      correctCount,
      wrongCount,
      unansweredCount,
      breakdownByDifficulty: difficultyBreakdown,
      generatedAt: now,
    };

    return res.status(200).json({
      success: true,
      data: {
        attempt: evaluatedAttempt,
        result: evaluatedResult,
        review: reviewItems,
      },
      message: "Practice test submitted and evaluated successfully.",
      timestamp: now,
    });
  } catch (err: any) {
    console.error("[Practice Submit] Error:", err);
    return res.status(500).json({
      success: false,
      error: {
        message: err.message || "Failed to evaluate practice test submission.",
      },
      timestamp: new Date().toISOString(),
    });
  }
}
