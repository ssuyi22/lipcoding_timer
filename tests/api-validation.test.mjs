import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const PORT = 18080;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServerReady(timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/api/token-status`);
      if (response.ok) {
        return;
      }
    } catch {
      // keep waiting until timeout
    }
    await sleep(200);
  }
  throw new Error("Server did not become ready in time");
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  let data = {};
  if (contentType.includes("application/json")) {
    data = await response.json();
  }
  return { response, data };
}

function expectStatus(actual, expected, message) {
  assert.equal(actual, expected, message);
}

async function run() {
  const server = spawn("node", ["server.js"], {
    env: {
      ...process.env,
      PORT: String(PORT),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let serverLogs = "";
  server.stdout.on("data", (chunk) => {
    serverLogs += String(chunk);
  });
  server.stderr.on("data", (chunk) => {
    serverLogs += String(chunk);
  });

  try {
    await waitForServerReady();

    const uniqueEmail = `test-${Date.now()}@example.com`;

    {
      const { response, data } = await request("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "", password: "1234" }),
      });
      expectStatus(response.status, 400, "signup should reject missing email");
      assert.ok(data.requestId, "signup 400 should include requestId");
    }

    {
      const { response } = await request("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "bad-email",
          password: "1234",
          name: "홍길동",
          sleepPattern: "평균 7시간",
          healthStatus: "보통",
        }),
      });
      expectStatus(response.status, 400, "signup should reject invalid email format");
    }

    {
      const { response } = await request("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: uniqueEmail,
          password: "123",
          name: "홍길동",
          sleepPattern: "평균 7시간",
          healthStatus: "보통",
        }),
      });
      expectStatus(response.status, 400, "signup should reject short password");
    }

    {
      const { response } = await request("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: uniqueEmail,
          password: "1234",
          name: "홍길동",
          sleepPattern: "평균 7시간",
          healthStatus: "최고",
        }),
      });
      expectStatus(response.status, 400, "signup should reject unsupported healthStatus");
    }

    let token = "";
    {
      const { response, data } = await request("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: uniqueEmail,
          password: "1234",
          name: "홍길동",
          sleepPattern: "평균 7시간",
          healthStatus: "보통",
        }),
      });
      expectStatus(response.status, 200, "signup should succeed with valid payload");
      assert.ok(data.requestId, "signup success should include requestId");
      assert.ok(response.headers.get("x-request-id"), "response should include x-request-id header");
      token = String(data.token || "");
      assert.ok(token, "signup success should return token");
    }

    {
      const { response } = await request("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: uniqueEmail,
          password: "1234",
          name: "홍길동",
          sleepPattern: "평균 7시간",
          healthStatus: "보통",
        }),
      });
      expectStatus(response.status, 409, "signup should reject duplicate email");
    }

    {
      const { response } = await request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "bad-email", password: "1234" }),
      });
      expectStatus(response.status, 400, "login should reject invalid email format");
    }

    {
      const { response } = await request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: uniqueEmail, password: "9999" }),
      });
      expectStatus(response.status, 401, "login should reject wrong password");
    }

    {
      const { response, data } = await request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: uniqueEmail, password: "1234" }),
      });
      expectStatus(response.status, 200, "login should succeed with valid credential");
      assert.ok(data.requestId, "login success should include requestId");
    }

    {
      const { response } = await request("/api/user/backup", { method: "GET" });
      expectStatus(response.status, 401, "backup should reject unauthorized request");
    }

    {
      const { response } = await request("/api/user/backup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ predictionHistory: "not-array", dailyContext: {} }),
      });
      expectStatus(response.status, 400, "backup should reject non-array history");
    }

    {
      const { response } = await request("/api/user/backup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          predictionHistory: [
            { taskName: "리뷰", predictedMinutes: 25, actualMinutes: 30, savedAt: new Date().toISOString() },
          ],
          dailyContext: { sleepHours: 7, conditionScore: 3, scheduleLoad: "normal" },
        }),
      });
      expectStatus(response.status, 200, "backup should accept valid payload");
    }

    {
      const { response } = await request("/api/copilot/prediction-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskName: "",
          category: "개발",
          predictedMinutes: 25,
          actualMinutes: 28,
          deltaMinutes: 3,
          predictedInterruptions: 1,
          actualInterruptions: 2,
          pauseCount: 1,
          skipCount: 0,
        }),
      });
      expectStatus(response.status, 400, "prediction-analysis should reject empty taskName");
    }

    {
      const { response } = await request("/api/copilot/prediction-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskName: "문서 정리",
          category: "개발",
          predictedMinutes: 500,
          actualMinutes: 28,
          deltaMinutes: 3,
          predictedInterruptions: 1,
          actualInterruptions: 2,
          pauseCount: 1,
          skipCount: 0,
        }),
      });
      expectStatus(response.status, 400, "prediction-analysis should reject out-of-range minute");
    }

    {
      const { response } = await request("/api/observability/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "test",
          message: "validation smoke",
          line: 10,
          column: 2,
          url: BASE_URL,
        }),
      });
      expectStatus(response.status, 200, "client-error endpoint should accept payload");
    }

    console.log("API validation tests passed.");
  } finally {
    server.kill("SIGTERM");
    await sleep(300);
    if (!server.killed) {
      server.kill("SIGKILL");
    }

    if (serverLogs) {
      console.log("--- server logs (excerpt) ---");
      console.log(serverLogs.split("\n").slice(-12).join("\n"));
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
