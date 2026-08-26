import { getR2ServerConfig, isR2Configured, getR2S3Client } from "../_lib/r2Server";
import { HeadBucketCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const config = getR2ServerConfig();
  const isConfigured = isR2Configured();

  const environmentValidation = {
    hasAccountId: Boolean(config.accountId),
    hasAccessKey: Boolean(config.accessKeyId),
    hasSecretKey: Boolean(config.secretAccessKey),
    hasBucket: Boolean(config.bucket),
    hasEndpoint: Boolean(config.endpoint),
    hasPublicUrl: Boolean(config.publicUrl),
  };

  let bucketConnectivity = false;
  let status: "ok" | "degraded" | "unconfigured" = isConfigured ? "ok" : "unconfigured";

  if (isConfigured) {
    try {
      const client = getR2S3Client();
      // Test connectivity by executing a non-mutating list command with maxKeys=1
      const command = new ListObjectsV2Command({
        Bucket: config.bucket,
        MaxKeys: 1,
      });
      await client.send(command);
      bucketConnectivity = true;
      status = "ok";
    } catch (err: any) {
      console.warn(`[R2Health] Connectivity test warning: ${err.message}`);
      bucketConnectivity = false;
      status = "degraded";
    }
  }

  return res.status(200).json({
    storage: "Cloudflare R2",
    status,
    bucketConnectivity,
    configurationStatus: isConfigured ? "valid" : "incomplete",
    environmentValidation,
    bucket: config.bucket,
    timestamp: new Date().toISOString(),
  });
}
