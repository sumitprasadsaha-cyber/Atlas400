export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: { message: "Method not allowed. Use GET." } });
  }

  try {
    const { testId, studentId, limit } = req.query || {};

    return res.status(200).json({
      success: true,
      message: "Practice results query endpoint ready.",
      query: {
        testId: testId || null,
        studentId: studentId || null,
        limit: Number(limit) || 50,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Practice Results] Error:", err);
    return res.status(500).json({
      success: false,
      error: { message: err.message || "Failed to retrieve results." },
      timestamp: new Date().toISOString(),
    });
  }
}
