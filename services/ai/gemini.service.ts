import { AiChatResult, AiReportResult, ApiResponse } from "../../shared/types/api.types";
import { logger } from "../../shared/utils/logger";

export const aiService = {
  async sendMessage(prompt: string, context?: Record<string, unknown>): Promise<string> {
    try {
      logger.info("Sending AI prompt via serverless endpoint");
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, context }),
      });

      const resJson: ApiResponse<AiChatResult> = await response.json();
      if (!response.ok || !resJson.success) {
        const errorMsg = !resJson.success && resJson.error ? resJson.error.message : `HTTP ${response.status}`;
        throw new Error(errorMsg);
      }

      return resJson.data.response;
    } catch (error) {
      logger.error("AI service error", error);
      throw error;
    }
  },

  async generateReport(studentId: string, parameters: Record<string, unknown>): Promise<string> {
    try {
      logger.info("Generating student AI report", { studentId });
      const response = await fetch("/api/ai/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, parameters }),
      });

      const resJson: ApiResponse<AiReportResult> = await response.json();
      if (!response.ok || !resJson.success) {
        const errorMsg = !resJson.success && resJson.error ? resJson.error.message : `HTTP ${response.status}`;
        throw new Error(errorMsg);
      }

      return resJson.data.reportText;
    } catch (error) {
      logger.error("AI report generation failed", error, { studentId });
      throw error;
    }
  },
};
