import { ApiResponse } from "../../../shared/types/api.types";
import { logger } from "../../../shared/utils/logger";
import { getClientR2Config } from "../config/r2.config";

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

export interface R2ReplaceResult {
  bucket: string;
  storageKey: string;
  r2ObjectKey: string;
  oldR2ObjectKey: string | null;
  oldKeyDeleted: boolean;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  extension: string;
  size: number;
  etag?: string;
  replaced: boolean;
}

export const r2ReplaceService = {
  async replaceFile(params: {
    oldR2ObjectKey: string;
    file: File | Blob;
    fileName: string;
    batch?: string;
    subject?: string;
    mimeType?: string;
    bucket?: string;
  }): Promise<R2ReplaceResult> {
    try {
      const config = getClientR2Config();
      const targetBucket = params.bucket || config.defaultBucket;
      const base64 = await fileToBase64(params.file);

      logger.info("Executing R2 file replacement", {
        oldKey: params.oldR2ObjectKey,
        newFileName: params.fileName,
        size: params.file.size,
      });

      const response = await fetch("/api/r2/replace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          oldKey: params.oldR2ObjectKey,
          fileName: params.fileName,
          batch: params.batch,
          subject: params.subject,
          mimeType: params.mimeType,
          bucket: targetBucket,
          base64,
        }),
      });

      const resJson: ApiResponse<R2ReplaceResult> = await response.json();

      if (!response.ok || !resJson.success) {
        const errorMsg = "error" in resJson && resJson.error ? resJson.error.message : `HTTP ${response.status}`;
        throw new Error(`Replace failed: ${errorMsg}`);
      }

      logger.info("R2 file replacement successful", {
        oldKey: params.oldR2ObjectKey,
        newKey: resJson.data.r2ObjectKey,
      });

      return resJson.data;
    } catch (error) {
      logger.error("R2 file replacement error", error, { oldKey: params.oldR2ObjectKey });
      throw error;
    }
  },
};
