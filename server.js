import "dotenv/config";
import express from "express";
import cors from "cors";
import { CopilotClient } from "@github/copilot-sdk";
import path from "path";
import crypto from "crypto";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";

const app = express();
const port = Number(process.env.PORT || 8080);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const USERS_DB_PATH = path.join(DATA_DIR, "users.json");
const authSessions = new Map();
const DEFAULT_USER_PROFILE = {
  name: "사용자",
  sleepPattern: "평균 7시간",
  healthStatus: "보통",
};
const ALLOWED_HEALTH_STATUS = new Set(["보통", "힘든", "피곤함"]);

function logEvent(level, event, data = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateSignupPayload({ email, password, name, sleepPattern, healthStatus }) {
  if (!email || !password) {
    return { ok: false, error: "email and password are required" };
  }
  if (!isValidEmail(email)) {
    return { ok: false, error: "invalid email format" };
  }
  if (password.length < 4 || password.length > 64) {
    return { ok: false, error: "password must be 4~64 chars" };
  }
  if (!name || !sleepPattern || !healthStatus) {
    return { ok: false, error: "name, sleepPattern, healthStatus are required" };
  }
  if (name.length < 2 || name.length > 30) {
    return { ok: false, error: "name must be 2~30 chars" };
  }
  if (sleepPattern.length < 2 || sleepPattern.length > 100) {
    return { ok: false, error: "sleepPattern must be 2~100 chars" };
  }
  if (!ALLOWED_HEALTH_STATUS.has(healthStatus)) {
    return { ok: false, error: "healthStatus must be one of 보통, 힘든, 피곤함" };
  }
  return { ok: true };
}

function validateLoginPayload({ email, password }) {
  if (!email || !password) {
    return { ok: false, error: "email and password are required" };
  }
  if (!isValidEmail(email)) {
    return { ok: false, error: "invalid email format" };
  }
  if (password.length < 4 || password.length > 64) {
    return { ok: false, error: "password must be 4~64 chars" };
  }
  return { ok: true };
}

function validateBackupPayload({ predictionHistory, dailyContext }) {
  if (!Array.isArray(predictionHistory)) {
    return { ok: false, error: "predictionHistory must be an array" };
  }
  if (predictionHistory.length > 200) {
    return { ok: false, error: "predictionHistory must be 200 items or fewer" };
  }
  if (!dailyContext || typeof dailyContext !== "object" || Array.isArray(dailyContext)) {
    return { ok: false, error: "dailyContext must be an object" };
  }
  return { ok: true };
}

function validatePredictionPayload(payload) {
  const taskName = String(payload.taskName || "").trim();
  const category = String(payload.category || "").trim();
  const predictedMinutes = Number(payload.predictedMinutes);
  const actualMinutes = Number(payload.actualMinutes);
  const deltaMinutes = Number(payload.deltaMinutes);
  const predictedInterruptions = Number(payload.predictedInterruptions);
  const actualInterruptions = Number(payload.actualInterruptions);
  const pauseCount = Number(payload.pauseCount);
  const skipCount = Number(payload.skipCount);

  if (!taskName) {
    return { ok: false, error: "taskName is required" };
  }
  if (taskName.length > 80) {
    return { ok: false, error: "taskName must be 80 chars or fewer" };
  }
  if (category.length > 40) {
    return { ok: false, error: "category must be 40 chars or fewer" };
  }

  const minuteValues = [predictedMinutes, actualMinutes];
  if (minuteValues.some((value) => !Number.isFinite(value) || value < 0 || value > 300)) {
    return { ok: false, error: "predictedMinutes and actualMinutes must be 0~300" };
  }
  if (!Number.isFinite(deltaMinutes) || deltaMinutes < -300 || deltaMinutes > 300) {
    return { ok: false, error: "deltaMinutes must be -300~300" };
  }

  const countValues = [predictedInterruptions, actualInterruptions, pauseCount, skipCount];
  if (countValues.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    return { ok: false, error: "interruption counts must be 0~100" };
  }

  return {
    ok: true,
    normalized: {
      taskName,
      category,
      predictedMinutes,
      actualMinutes,
      deltaMinutes,
      predictedInterruptions,
      actualInterruptions,
      pauseCount,
      skipCount,
      clientToken: String(payload.token || "").trim(),
    },
  };
}

function validateProfileUpdatePayload(payload) {
  const name = String(payload?.name || "").trim();
  const sleepPattern = String(payload?.sleepPattern || "").trim();
  const healthStatus = String(payload?.healthStatus || "").trim();

  if (!name || !sleepPattern || !healthStatus) {
    return { ok: false, error: "name, sleepPattern, healthStatus are required" };
  }
  if (name.length < 2 || name.length > 30) {
    return { ok: false, error: "name must be 2~30 chars" };
  }
  if (sleepPattern.length < 2 || sleepPattern.length > 100) {
    return { ok: false, error: "sleepPattern must be 2~100 chars" };
  }
  if (!ALLOWED_HEALTH_STATUS.has(healthStatus)) {
    return { ok: false, error: "healthStatus must be one of 보통, 힘든, 피곤함" };
  }

  return {
    ok: true,
    normalized: {
      name,
      sleepPattern,
      healthStatus,
    },
  };
}

app.use(cors());
app.use(express.json({ limit: "256kb" }));

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  const startedAt = Date.now();
  res.setHeader("x-request-id", req.requestId);
  res.on("finish", () => {
    logEvent("info", "http_request", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      ip: req.ip,
    });
  });
  next();
});

app.use(express.static("."));

async function ensureUsersStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(USERS_DB_PATH);
  } catch {
    await fs.writeFile(USERS_DB_PATH, JSON.stringify({ users: [] }, null, 2), "utf8");
  }
}

async function loadUsersDb() {
  await ensureUsersStore();
  const raw = await fs.readFile(USERS_DB_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.users)) {
      return { users: [] };
    }

    let hasMigrationChange = false;
    parsed.users = parsed.users.map((user) => {
      const normalizedProfile = buildNormalizedProfile(user?.profile || {});
      const prevProfile = user?.profile || {};
      const profileChanged =
        String(prevProfile?.name || "") !== normalizedProfile.name ||
        String(prevProfile?.sleepPattern || "") !== normalizedProfile.sleepPattern ||
        String(prevProfile?.healthStatus || "") !== normalizedProfile.healthStatus ||
        Object.prototype.hasOwnProperty.call(prevProfile, "recentCondition");

      if (profileChanged) {
        hasMigrationChange = true;
      }

      return {
        ...user,
        profile: normalizedProfile,
      };
    });

    if (hasMigrationChange) {
      await saveUsersDb(parsed);
    }

    return parsed;
  } catch {
    return { users: [] };
  }
}

async function saveUsersDb(db) {
  await ensureUsersStore();
  await fs.writeFile(USERS_DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function normalizeHealthStatus(value) {
  const v = String(value || "").trim();
  return ALLOWED_HEALTH_STATUS.has(v) ? v : DEFAULT_USER_PROFILE.healthStatus;
}

function buildNormalizedProfile(profile = {}) {
  return {
    name: String(profile?.name || "").trim() || DEFAULT_USER_PROFILE.name,
    sleepPattern: String(profile?.sleepPattern || "").trim() || DEFAULT_USER_PROFILE.sleepPattern,
    healthStatus: normalizeHealthStatus(profile?.healthStatus),
  };
}

function createSessionToken(email) {
  const token = `${crypto.randomUUID()}-${crypto.randomBytes(16).toString("hex")}`;
  authSessions.set(token, { email, createdAt: Date.now() });
  return token;
}

function getAuthEmailFromRequest(req) {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice(7).trim();
  const session = authSessions.get(token);
  return session?.email || null;
}

async function authMiddleware(req, res, next) {
  const email = getAuthEmailFromRequest(req);
  if (!email) {
    return res.status(401).json({ error: "Unauthorized", requestId: req.requestId });
  }
  req.authEmail = email;
  return next();
}

function buildSystemPrompt() {
  return [
    "You are a concise Pomodoro productivity coach.",
    "Give practical, short suggestions for focus and breaks.",
    "Use Korean unless user asks another language."
  ].join(" ");
}

function buildPredictionSystemPrompt() {
  return [
    "You are an expert Pomodoro prediction analyst.",
    "Return ONLY valid JSON.",
    "Language: Korean.",
    "Schema:",
    '{"aiReasons":["reason1","reason2"],"aiSuggestedMinutes":30,"aiInsight":"short text"}',
    "Rules:",
    "- aiReasons: 1~3 concise bullet-like reasons",
    "- aiSuggestedMinutes: integer 15~90",
    "- aiInsight: one short sentence"
  ].join(" ");
}

function parseJsonFromText(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const sliced = text.slice(start, end + 1);
      return JSON.parse(sliced);
    }
    throw new Error("JSON parse failed");
  }
}

function buildFallbackCoachReply(message) {
  const text = String(message || "").trim();
  const hasCodingKeyword = /(코딩|공부|학습|알고리즘|문제풀이|리팩토링)/.test(text);

  if (hasCodingKeyword) {
    return [
      "좋아요. 코딩 공부용 25분 포모도로를 바로 시작해볼게요.",
      "1) 목표를 1개로 좁히기: 예) 배열 문제 2개 풀이",
      "2) 25분 동안은 IDE/문서만 열고 알림 차단",
      "3) 막히면 3분 규칙: 3분 고민 후 힌트 1개만 확인",
      "4) 종료 2분 전: 배운 점 2줄 기록",
      "지금 세션 목표를 한 줄로 적어주면 더 구체적으로 쪼개드릴게요."
    ].join("\n");
  }

  return [
    "좋아요. 지금 작업을 25분 단위로 잘게 나눠서 진행해볼게요.",
    "1) 이번 세션의 완료 조건 1개를 정하기",
    "2) 방해 요소(알림/메신저) 25분 차단",
    "3) 끝나면 5분 휴식 + 다음 세션 우선순위 1개 정리"
  ].join("\n");
}

async function sendWithCopilot(message, systemPrompt = buildSystemPrompt(), clientToken = null) {
  const token = clientToken || process.env.GITHUB_TOKEN || process.env.COPILOT_API_KEY;
  if (!token) {
    throw new Error("GITHUB_TOKEN or COPILOT_API_KEY is not set.");
  }

  const client = new CopilotClient({
    authToken: token,
    systemPrompt
  });

  const session = await client.createSession();
  const response = await session.sendAndWait(message);

  if (typeof response === "string") {
    return response;
  }

  if (response?.content) {
    return String(response.content);
  }

  if (response?.text) {
    return String(response.text);
  }

  return JSON.stringify(response);
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "").trim();
    const name = String(req.body?.name || "").trim();
    const sleepPattern = String(req.body?.sleepPattern || "").trim();
    const healthStatus = String(req.body?.healthStatus || "").trim();
    const validation = validateSignupPayload({ email, password, name, sleepPattern, healthStatus });
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error, requestId: req.requestId });
    }

    const profile = buildNormalizedProfile({ name, sleepPattern, healthStatus });

    const db = await loadUsersDb();
    const exists = db.users.find((u) => u.email === email);
    if (exists) {
      return res.status(409).json({ error: "user already exists", requestId: req.requestId });
    }

    db.users.push({
      email,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      plan: "pro",
      profile,
      backup: {
        predictionHistory: [],
        dailyContext: {},
        updatedAt: null,
      },
    });
    await saveUsersDb(db);

    const token = createSessionToken(email);
    return res.json({
      ok: true,
      token,
      user: {
        email,
        plan: "pro",
        profile,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    return res.status(500).json({ error: "signup failed", requestId: req.requestId });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "").trim();
    const validation = validateLoginPayload({ email, password });
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error, requestId: req.requestId });
    }

    const db = await loadUsersDb();
    const user = db.users.find((u) => u.email === email);
    if (!user || user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ error: "invalid credentials", requestId: req.requestId });
    }

    const token = createSessionToken(email);
    return res.json({
      ok: true,
      token,
      user: {
        email,
        plan: user.plan || "pro",
        profile: buildNormalizedProfile(user.profile),
      },
      requestId: req.requestId,
    });
  } catch (error) {
    return res.status(500).json({ error: "login failed", requestId: req.requestId });
  }
});

app.get("/api/user/profile", authMiddleware, async (req, res) => {
  try {
    const email = req.authEmail;
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.email === email);
    if (!user) {
      return res.status(404).json({ error: "user not found", requestId: req.requestId });
    }

    return res.json({
      ok: true,
      profile: buildNormalizedProfile(user.profile),
      user: {
        email: user.email,
        plan: user.plan || "pro",
      },
      requestId: req.requestId,
    });
  } catch {
    return res.status(500).json({ error: "profile fetch failed", requestId: req.requestId });
  }
});

app.put("/api/user/profile", authMiddleware, async (req, res) => {
  try {
    const validation = validateProfileUpdatePayload(req.body || {});
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error, requestId: req.requestId });
    }

    const email = req.authEmail;
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.email === email);
    if (!user) {
      return res.status(404).json({ error: "user not found", requestId: req.requestId });
    }

    user.profile = buildNormalizedProfile(validation.normalized);
    await saveUsersDb(db);

    return res.json({
      ok: true,
      profile: user.profile,
      requestId: req.requestId,
    });
  } catch {
    return res.status(500).json({ error: "profile update failed", requestId: req.requestId });
  }
});

app.post("/api/user/backup", authMiddleware, async (req, res) => {
  try {
    const email = req.authEmail;
    const predictionHistory = req.body?.predictionHistory;
    const dailyContext = req.body?.dailyContext;
    const validation = validateBackupPayload({ predictionHistory, dailyContext });
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error, requestId: req.requestId });
    }

    const db = await loadUsersDb();
    const user = db.users.find((u) => u.email === email);
    if (!user) {
      return res.status(404).json({ error: "user not found", requestId: req.requestId });
    }

    user.backup = {
      predictionHistory: predictionHistory.slice(0, 200),
      dailyContext,
      updatedAt: new Date().toISOString(),
    };
    await saveUsersDb(db);

    return res.json({ ok: true, updatedAt: user.backup.updatedAt, requestId: req.requestId });
  } catch (error) {
    return res.status(500).json({ error: "backup update failed", requestId: req.requestId });
  }
});

app.get("/api/user/backup", authMiddleware, async (req, res) => {
  try {
    const email = req.authEmail;
    const db = await loadUsersDb();
    const user = db.users.find((u) => u.email === email);
    if (!user) {
      return res.status(404).json({ error: "user not found", requestId: req.requestId });
    }

    return res.json({
      ok: true,
      backup: user.backup || {
        predictionHistory: [],
        dailyContext: {},
        updatedAt: null,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    return res.status(500).json({ error: "backup fetch failed", requestId: req.requestId });
  }
});

app.post("/api/observability/client-error", (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  logEvent("warn", "client_error", {
    requestId: req.requestId,
    message: String(body.message || ""),
    stack: String(body.stack || ""),
    source: String(body.source || ""),
    line: Number(body.line || 0),
    column: Number(body.column || 0),
    url: String(body.url || ""),
    userAgent: String(req.headers["user-agent"] || ""),
  });
  return res.json({ ok: true, requestId: req.requestId });
});

app.post("/api/copilot/chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    const clientToken = String(req.body?.token || "").trim();
    
    if (!message) {
      return res.status(400).json({ error: "message is required", requestId: req.requestId });
    }
    if (message.length > 3000) {
      return res.status(400).json({ error: "message must be 3000 chars or fewer", requestId: req.requestId });
    }

    const reply = await sendWithCopilot(message, buildSystemPrompt(), clientToken || undefined);
    return res.json({ reply, requestId: req.requestId });
  } catch (error) {
    const fallbackReply = buildFallbackCoachReply(req.body?.message);
    logEvent("warn", "copilot_chat_fallback", {
      requestId: req.requestId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return res.status(200).json({
      reply: fallbackReply,
      fallback: true,
      error: error instanceof Error ? error.message : "Unknown error",
      requestId: req.requestId,
    });
  }
});

app.post("/api/copilot/prediction-analysis", async (req, res) => {
  try {
    const payload = req.body || {};
    const validation = validatePredictionPayload(payload);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error, requestId: req.requestId });
    }
    const {
      taskName,
      category,
      predictedMinutes,
      actualMinutes,
      deltaMinutes,
      predictedInterruptions,
      actualInterruptions,
      pauseCount,
      skipCount,
      clientToken,
    } = validation.normalized;

    const message = [
      "아래 포모도로 예측 결과를 분석해줘.",
      `작업명: ${taskName}`,
      `카테고리: ${category || "미분류"}`,
      `예측 시간(분): ${predictedMinutes}`,
      `실제 시간(분): ${actualMinutes}`,
      `오차(분): ${deltaMinutes}`,
      `예상 방해 횟수: ${predictedInterruptions}`,
      `실제 방해 횟수: ${actualInterruptions}`,
      `일시정지 횟수: ${pauseCount}`,
      `건너뛰기 횟수: ${skipCount}`,
      "JSON만 반환해줘.",
    ].join("\n");

    const reply = await sendWithCopilot(message, buildPredictionSystemPrompt(), clientToken || undefined);
    const parsed = parseJsonFromText(reply);
    const aiReasonsRaw = Array.isArray(parsed?.aiReasons) ? parsed.aiReasons : [];
    const aiReasons = aiReasonsRaw.map((item) => String(item)).filter(Boolean).slice(0, 3);
    const aiSuggestedMinutesRaw = Number(parsed?.aiSuggestedMinutes);
    const aiSuggestedMinutes = Number.isFinite(aiSuggestedMinutesRaw)
      ? Math.min(90, Math.max(15, Math.round(aiSuggestedMinutesRaw)))
      : null;
    const aiInsight = typeof parsed?.aiInsight === "string" ? parsed.aiInsight : "";

    return res.json({
      analysis: {
        aiReasons,
        aiSuggestedMinutes,
        aiInsight,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    logEvent("error", "prediction_analysis_failed", {
      requestId: req.requestId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return res.status(500).json({
      error: "prediction analysis failed",
      requestId: req.requestId,
    });
  }
});

app.get("/api/token-status", (_req, res) => {
  const hasToken = Boolean(process.env.GITHUB_TOKEN || process.env.COPILOT_API_KEY);
  res.json({ hasToken });
});

app.use((req, res) => {
  res.status(404).json({ error: "not found", requestId: req.requestId });
});

app.use((error, req, res, _next) => {
  logEvent("error", "unhandled_error", {
    requestId: req.requestId,
    path: req.originalUrl,
    message: error instanceof Error ? error.message : "Unknown error",
    stack: error instanceof Error ? error.stack : "",
  });
  res.status(500).json({ error: "internal server error", requestId: req.requestId });
});

async function startServer() {
  try {
    await loadUsersDb();
    logEvent("info", "startup_migration_completed");
  } catch (error) {
    logEvent("error", "startup_migration_failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  app.listen(port, () => {
    const tokenStatus = process.env.GITHUB_TOKEN || process.env.COPILOT_API_KEY ? "✓ 토큰 설정됨" : "✗ 토큰 미설정";
    logEvent("info", "server_started", {
      port,
      tokenStatus,
      url: `http://localhost:${port}`,
    });
  });
}

void startServer();
