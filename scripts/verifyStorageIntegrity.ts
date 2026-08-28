/**
 * Atlas v5.0.8 — Storage Integrity Verification CLI Tool
 *
 * Scans all Firestore notes and verifies that every canonical storageKey exists
 * in Cloudflare R2 via non-destructive HeadObject checks.
 *
 * Usage:
 *   npx tsx scripts/verifyStorageIntegrity.ts
 */

import { fetchAllClassNotesFromFirestore } from "../src/lib/firestoreService";
import { verifyR2ObjectExists, getR2BucketName } from "../src/lib/r2Client";

async function main() {
  console.log("\n========================================================");
  console.log("  ATLAS v5.0.8 — TOPIC NOTE STORAGE INTEGRITY AUDIT");
  console.log("========================================================\n");

  const bucket = getR2BucketName();
  console.log(`[Target Bucket]: ${bucket}`);
  console.log(`[Scanning Firestore Notes]...\n`);

  let allNotes = [];
  try {
    allNotes = await fetchAllClassNotesFromFirestore();
  } catch (err: any) {
    console.error("Failed to load notes from Firestore:", err.message);
    process.exit(1);
  }

  const total = allNotes.length;
  console.log(`Discovered ${total} Topic Note records in database.`);

  if (total === 0) {
    console.log("No notes currently registered in the database. Storage integrity is clean.");
    process.exit(0);
  }

  let healthy = 0;
  let missing = 0;
  let errors = 0;

  for (let i = 0; i < total; i++) {
    const note = allNotes[i];
    const key =
      note.storagePath ||
      note.storageKey ||
      note.r2Key ||
      note.downloadKey ||
      note.objectKey ||
      "";
    const name = note.topicName || note.partLabel || note.fileName || note.id;

    process.stdout.write(`[${i + 1}/${total}] Checking: ${name.slice(0, 35).padEnd(35)} ... `);

    if (!key) {
      console.log("❌ MISSING KEY IN DB");
      missing++;
      continue;
    }

    try {
      const check = await verifyR2ObjectExists({ bucket, key });
      if (check && check.exists) {
        console.log(`✅ OK (${check.size ? `${(check.size / 1024).toFixed(1)} KB` : "verified"})`);
        healthy++;
      } else {
        console.log(`❌ NOT FOUND IN R2 (Key: ${key})`);
        missing++;
      }
    } catch (err: any) {
      console.log(`⚠️ ERROR: ${err.message}`);
      errors++;
    }
  }

  console.log("\n--------------------------------------------------------");
  console.log("  AUDIT SUMMARY");
  console.log("--------------------------------------------------------");
  console.log(`  Total Notes:    ${total}`);
  console.log(`  Healthy in R2:  ${healthy}`);
  console.log(`  Missing in R2:  ${missing}`);
  console.log(`  Errors:         ${errors}`);
  console.log(`  Integrity Rate: ${Math.round((healthy / total) * 100)}%`);
  console.log("--------------------------------------------------------\n");

  if (missing === 0 && errors === 0) {
    console.log("✨ ALL TOPIC NOTES ARE 100% HEALTHY AND VERIFIED IN R2 STORAGE.\n");
    process.exit(0);
  } else {
    console.log("⚠️ Some note storage keys could not be verified. Review missing keys above.\n");
    process.exit(missing > 0 ? 1 : 0);
  }
}

main().catch((err) => {
  console.error("Audit aborted with unhandled error:", err);
  process.exit(1);
});
