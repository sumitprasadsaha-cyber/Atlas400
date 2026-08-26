import handlerSignedUrl from "../api/r2/signed-url";
import handlerUpload from "../api/r2/upload";
import handlerDelete from "../api/r2/delete";
import handlerHealth from "../api/r2/health";

function createMockReqRes(method: string, url: string, body?: any, query?: Record<string, string>, headers?: Record<string, string>) {
  let statusCode = 200;
  const resHeaders: Record<string, string> = {};
  let resData = "";

  const req = {
    method,
    url,
    body,
    query: query || {},
    headers: headers || {},
  };

  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    setHeader(name: string, value: string) {
      resHeaders[name.toLowerCase()] = value;
      return res;
    },
    json(data: any) {
      resData = JSON.stringify(data);
      return res;
    },
    send(data: any) {
      resData = String(data);
      return res;
    },
    end(data?: any) {
      if (data) resData = String(data);
      return res;
    },
    getStatus: () => statusCode,
    getHeaders: () => resHeaders,
    getData: () => resData,
  };

  return { req, res };
}

async function verifyVercelFunctions() {
  console.log("=== [TESTING DIRECT VERCEL SERVERLESS FUNCTIONS] ===");

  // 1. Test health endpoint
  console.log("1. Testing handlerHealth...");
  const healthMocks = createMockReqRes("GET", "/api/r2/health");
  await handlerHealth(healthMocks.req, healthMocks.res);
  console.log("   Health Status:", healthMocks.res.getStatus());
  console.log("   Health Response:", healthMocks.res.getData());
  if (healthMocks.res.getStatus() !== 200) {
    throw new Error(`handlerHealth failed with status ${healthMocks.res.getStatus()}`);
  }

  // 2. Test signed-url endpoint
  console.log("2. Testing handlerSignedUrl with POST...");
  const signedMocks = createMockReqRes("POST", "/api/r2/signed-url", {
    bucket: "academy-connect-files",
    storageKey: "notes/student-test/test-note.pdf",
    expiresIn: 600,
  });
  await handlerSignedUrl(signedMocks.req, signedMocks.res);
  console.log("   Signed URL Status:", signedMocks.res.getStatus());
  const signedJson = JSON.parse(signedMocks.res.getData());
  console.log("   Signed URL Result:", {
    success: signedJson.success,
    hasSignedUrl: Boolean(signedJson.signedUrl),
    bucket: signedJson.bucket,
    storageKey: signedJson.storageKey,
    expiresIn: signedJson.expiresIn,
  });

  if (signedMocks.res.getStatus() !== 200 || !signedJson.signedUrl) {
    throw new Error(`handlerSignedUrl failed: status=${signedMocks.res.getStatus()}, data=${signedMocks.res.getData()}`);
  }

  // 3. Test upload endpoint
  console.log("3. Testing handlerUpload POST...");
  const uploadMocks = createMockReqRes("POST", "/api/r2/upload", {
    bucket: "academy-connect-files",
    fileName: "sample.pdf",
    mimeType: "application/pdf",
    base64: Buffer.from("%PDF-1.4 test file content").toString("base64"),
  });
  await handlerUpload(uploadMocks.req, uploadMocks.res);
  console.log("   Upload Status:", uploadMocks.res.getStatus());
  const uploadJson = JSON.parse(uploadMocks.res.getData());
  console.log("   Upload Result:", uploadJson);

  // 4. Test delete endpoint
  console.log("4. Testing handlerDelete POST...");
  const deleteMocks = createMockReqRes("POST", "/api/r2/delete", {
    bucket: "academy-connect-files",
    storageKey: uploadJson.storageKey || "notes/sample.pdf",
  });
  await handlerDelete(deleteMocks.req, deleteMocks.res);
  console.log("   Delete Status:", deleteMocks.res.getStatus());
  const deleteJson = JSON.parse(deleteMocks.res.getData());
  console.log("   Delete Result:", deleteJson);

  console.log("=== ALL VERCEL SERVERLESS FUNCTIONS PASSED 100% ===");
}

verifyVercelFunctions().catch((err) => {
  console.error("Vercel Serverless Function test failed:", err);
  process.exit(1);
});
