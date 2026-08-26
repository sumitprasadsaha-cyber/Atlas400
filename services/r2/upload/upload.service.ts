import { R2UploadResult, ApiResponse } from "../../../shared/types/api.types";
import { logger } from "../../../shared/utils/logger";

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

export const r2UploadService = {
  async uploadFile(
    file: File | Blob,
    fileName: string,
    folder: string = "notes",
    mimeType?: string
  ): Promise<R2UploadResult> {
    try {
      const base64Data = await fileToBase64(file);
      const payloadMime = mimeType || (file instanceof File ? file.type : "application/pdf") || "application/octet-stream";

      logger.info("Uploading file to R2 via serverless API", { fileName, folder, size: file.size });

      const response = await fetch("/api/r2/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName,
          folder,
          mimeType: payloadMime,
          base64: base64Data,
        }),
      });

      const resJson: ApiResponse<R2UploadResult> = await response.json();

      if (!response.ok || !resJson.success) {
        const errorMsg = !resJson.success && resJson.error ? resJson.error.message : `HTTP ${response.status}`;
        throw new Error(`Upload failed: ${errorMsg}`);
      }

      logger.info("R2 upload successful", { storageKey: resJson.data.storageKey });
      return resJson.data;
    } catch (error) {
      logger.error("R2 upload error", error, { fileName, folder });
      throw error;
    }
  },
};
