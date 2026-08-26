import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const SYSTEM_INSTRUCTION = `You are Sumit Tuition App's AI Assistant, an expert educational administrator and data analyst for a tuition center / coaching academy.
Your task is to analyze student, class, attendance, fee, test, homework, and syllabus structured JSON data and generate clear, professional, actionable, and encouraging reports in clean Markdown format.`;

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    }
    const { query, dataContext, history } = body || {};

    if (!query) {
      return res.status(400).json({ error: "Missing query in request body" });
    }

    const ai = getGeminiClient();

    let fullPrompt = `Context Data on Sumit Tuition App Institution & Students:\n\`\`\`json\n${JSON.stringify(dataContext || {}, null, 2)}\n\`\`\`\n\n`;

    if (history && Array.isArray(history) && history.length > 0) {
      fullPrompt += `Previous Conversation History:\n`;
      history.forEach((item: { role: string; text: string }) => {
        fullPrompt += `${item.role === "user" ? "Admin" : "AI Assistant"}: ${item.text}\n`;
      });
      fullPrompt += `\n`;
    }

    fullPrompt += `Admin Question: ${query}\n\n`;
    fullPrompt += `Provide a helpful, precise, and well-formatted Markdown answer based directly on the provided context data.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.3,
      },
    });

    return res.status(200).json({
      success: true,
      reply: response.text || "I could not analyze the requested query.",
    });
  } catch (err: any) {
    console.error("Error in AI Chat endpoint:", err);
    return res.status(500).json({
      error: err.message || "AI Chat failed.",
    });
  }
}
