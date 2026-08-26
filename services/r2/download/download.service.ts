import { logger } from "../../../shared/utils/logger";
import { r2SignedUrlService } from "../signed-url/signed-url.service";
import { platformUtils } from "../../../shared/utils/platform";
import { Browser } from "@capacitor/browser";

export const r2DownloadService = {
  async openDocumentNatively(storageKey: string, bucket?: string, originalFilename?: string): Promise<void> {
    try {
      logger.info("Opening document via direct temporary signed URL", { storageKey, originalFilename });

      // 1. Fetch direct 10-minute temporary signed URL from Serverless API
      const { signedUrl } = await r2SignedUrlService.getSignedUrl(storageKey, bucket, 600);

      if (!signedUrl) {
        throw new Error("Failed to generate temporary signed URL for document");
      }

      // 2. Open via native browser / device system viewer
      if (platformUtils.isNative()) {
        await Browser.open({
          url: signedUrl,
          windowName: "_system",
          presentationStyle: "fullscreen",
        });
      } else {
        const link = document.createElement("a");
        link.href = signedUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        if (originalFilename) {
          link.download = originalFilename;
        }
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      logger.error("Failed to open document natively", error, { storageKey });
      throw error;
    }
  },
};
