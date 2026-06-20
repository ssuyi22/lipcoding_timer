const MODES = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};
const RING_BASE_SECONDS = 60 * 60;

let mode = "focus";
let remaining = MODES[mode];
let total = MODES[mode];
let timerId = null;

let focusCount = 0;
let streakCount = 0;
let totalFocusMinutes = 0;
let pauseCount = 0;
let skipCount = 0;
let predictionSession = null;
const PREDICTION_HISTORY_KEY = "pomodoro_prediction_history_v1";
const PREDICTION_HISTORY_LIMIT = 50;
const RECOMMENDED_MINUTES_MIN = 15;
const RECOMMENDED_MINUTES_MAX = 90;
const DAILY_CONTEXT_KEY = "pomodoro_daily_context_v1";
const AUTH_STATE_KEY = "pomodoro_auth_state_v1";
const AUTH_TOKEN_KEY = "pomodoro_auth_token_v1";

const timerDisplay = document.getElementById("timerDisplay");
const timerCard = document.querySelector(".timer-card");
const modeChip = document.getElementById("modeChip");
const startPauseBtn = document.getElementById("startPauseBtn");
const resetBtn = document.getElementById("resetBtn");
const skipBtn = document.getElementById("skipBtn");
const customMinutesInput = document.getElementById("customMinutesInput");
const applyCustomMinutesBtn = document.getElementById("applyCustomMinutesBtn");
const overHourBadge = document.getElementById("overHourBadge");

const focusCountEl = document.getElementById("focusCount");
const streakCountEl = document.getElementById("streakCount");
const totalFocusMinutesEl = document.getElementById("totalFocusMinutes");
const coachMessages = document.getElementById("coachMessages");
const coachInput = document.getElementById("coachInput");
const coachSendBtn = document.getElementById("coachSendBtn");
const taskNameInput = document.getElementById("taskNameInput");
const taskCategoryInput = document.getElementById("taskCategoryInput");
const predictedMinutesInput = document.getElementById("predictedMinutesInput");
const predictedInterruptionsInput = document.getElementById("predictedInterruptionsInput");
const startPredictionBtn = document.getElementById("startPredictionBtn");
const finishPredictionBtn = document.getElementById("finishPredictionBtn");
const useAiAnalysisCheck = document.getElementById("useAiAnalysisCheck");
const tokenStatusAlert = document.getElementById("tokenStatusAlert");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const categoryStats = document.getElementById("categoryStats");
const categoryStatsContent = document.getElementById("categoryStatsContent");
const predictionSummary = document.getElementById("predictionSummary");
const predictionHistoryBody = document.getElementById("predictionHistoryBody");
const githubTokenInput = document.getElementById("githubTokenInput");
const saveTokenBtn = document.getElementById("saveTokenBtn");
const sleepHoursInput = document.getElementById("sleepHoursInput");
const conditionScoreInput = document.getElementById("conditionScoreInput");
const conditionScoreText = document.getElementById("conditionScoreText");
const scheduleLoadInput = document.getElementById("scheduleLoadInput");
const autoConnectContextBtn = document.getElementById("autoConnectContextBtn");
const applyRoutineBtn = document.getElementById("applyRoutineBtn");
const routinePreview = document.getElementById("routinePreview");
const interruptPatternWarning = document.getElementById("interruptPatternWarning");
const authEmailInput = document.getElementById("authEmailInput");
const authPasswordInput = document.getElementById("authPasswordInput");
const openLoginModalBtn = document.getElementById("openLoginModalBtn");
const openSignupModalBtn = document.getElementById("openSignupModalBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authStatus = document.getElementById("authStatus");
const authGateMessage = document.getElementById("authGateMessage");
const authModal = document.getElementById("authModal");
const authModalBackdrop = document.getElementById("authModalBackdrop");
const closeAuthModalBtn = document.getElementById("closeAuthModalBtn");
const authModalTitle = document.getElementById("authModalTitle");
const authModalSubtitle = document.getElementById("authModalSubtitle");
const authModalSubmitBtn = document.getElementById("authModalSubmitBtn");
const switchAuthModeBtn = document.getElementById("switchAuthModeBtn");
const GITHUB_TOKEN_KEY = "github_copilot_token_v1";
let authModalMode = "login";
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function loadPredictionHistory() {
  try {
    const raw = localStorage.getItem(PREDICTION_HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadAuthState() {
  try {
    const raw = localStorage.getItem(AUTH_STATE_KEY);
    const token = String(localStorage.getItem(AUTH_TOKEN_KEY) || "");
    if (!raw) {
      return { isLoggedIn: false, email: "", token: "", plan: "free", profile: null };
    }
    const parsed = JSON.parse(raw);
    return {
      isLoggedIn: Boolean(parsed?.isLoggedIn),
      email: String(parsed?.email || ""),
      token,
      plan: String(parsed?.plan || "free"),
      profile: parsed?.profile && typeof parsed.profile === "object" ? parsed.profile : null,
    };
  } catch {
    return { isLoggedIn: false, email: "", token: "", plan: "free", profile: null };
  }
}

function saveAuthState(state) {
  const safeState = {
    isLoggedIn: Boolean(state?.isLoggedIn),
    email: String(state?.email || ""),
    plan: String(state?.plan || "free"),
    profile: state?.profile && typeof state.profile === "object" ? state.profile : null,
  };
  localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(safeState));
  if (state?.token) {
    localStorage.setItem(AUTH_TOKEN_KEY, String(state.token));
  }
}

function clearAuthState() {
  localStorage.removeItem(AUTH_STATE_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

function getBackupPayload() {
  return {
    predictionHistory: loadPredictionHistory(),
    dailyContext: loadDailyContext(),
  };
}

function formatApiErrorMessage(data, fallbackMessage) {
  const baseMessage = data?.error || fallbackMessage;
  const requestId = data?.requestId ? ` (req: ${data.requestId})` : "";
  return `${baseMessage}${requestId}`;
}

async function apiRequest(url, options = {}, fallbackErrorMessage = "요청 실패") {
  const response = await fetch(url, options);
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) {
    throw new Error(formatApiErrorMessage(data, fallbackErrorMessage));
  }
  return data;
}

async function reportClientError(payload) {
  try {
    await fetch("/api/observability/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Deliberately ignore telemetry send failures.
  }
}

function setupClientObservability() {
  window.addEventListener("error", (event) => {
    void reportClientError({
      source: "window.error",
      message: event.message,
      stack: event.error?.stack || "",
      line: event.lineno || 0,
      column: event.colno || 0,
      url: event.filename || window.location.href,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason || "Unhandled rejection");
    const stack = reason instanceof Error ? reason.stack || "" : "";
    void reportClientError({
      source: "window.unhandledrejection",
      message,
      stack,
      line: 0,
      column: 0,
      url: window.location.href,
    });
  });
}

async function authRequest(url, body) {
  const data = await apiRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, "인증 요청 실패");
  return data;
}

async function fetchBackupFromServer(token) {
  const data = await apiRequest("/api/user/backup", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  }, "백업 조회 실패");
  return data.backup || { predictionHistory: [], dailyContext: {}, updatedAt: null };
}

async function syncBackupToServer() {
  const auth = loadAuthState();
  if (!auth.isLoggedIn || !auth.token) {
    return;
  }

  try {
    await apiRequest("/api/user/backup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify(getBackupPayload()),
    }, "백업 저장 실패");
  } catch (error) {
    console.warn("백업 동기화 실패:", error);
  }
}

async function restoreOrSyncBackupAfterLogin(token) {
  try {
    const remoteBackup = await fetchBackupFromServer(token);
    const localHistory = loadPredictionHistory();
    const localContext = loadDailyContext();

    const hasLocalData = localHistory.length > 0 || Object.keys(localContext).length > 0;
    const hasRemoteData = Array.isArray(remoteBackup.predictionHistory) && remoteBackup.predictionHistory.length > 0;

    if (!hasLocalData && hasRemoteData) {
      savePredictionHistory(remoteBackup.predictionHistory);
      localStorage.setItem(DAILY_CONTEXT_KEY, JSON.stringify(remoteBackup.dailyContext || {}));
      renderPredictionHistory();
      autoConnectContext();
      updateRoutinePreview(taskNameInput.value.trim());
      return;
    }

    await syncBackupToServer();
  } catch (error) {
    console.warn("로그인 후 백업 처리 실패:", error);
  }
}

function renderAccessByAuth() {
  const auth = loadAuthState();
  const premiumSections = document.querySelectorAll(".premium-only");
  const freeSections = document.querySelectorAll(".free-only");
  const memberSections = document.querySelectorAll(".member-only");

  premiumSections.forEach((section) => {
    section.style.display = "";
    section.classList.toggle("is-locked", !auth.isLoggedIn);
  });

  freeSections.forEach((section) => {
    section.style.display = auth.isLoggedIn ? "none" : "";
  });

  memberSections.forEach((section) => {
    section.style.display = auth.isLoggedIn ? "" : "none";
  });

  if (auth.isLoggedIn) {
    renderMemberCondition(auth.profile || {});
  }

  if (openLoginModalBtn) {
    openLoginModalBtn.style.display = auth.isLoggedIn ? "none" : "";
  }
  if (openSignupModalBtn) {
    openSignupModalBtn.style.display = auth.isLoggedIn ? "none" : "";
  }
  if (logoutBtn) {
    logoutBtn.style.display = auth.isLoggedIn ? "" : "none";
  }

  if (!authStatus) {
    return;
  }

  if (auth.isLoggedIn) {
    authStatus.textContent = `현재 상태: 유료 로그인 (${auth.email || "사용자"}) · 백업 동기화 사용`;
    if (authGateMessage) {
      authGateMessage.textContent = "Pro 모드 활성화";
    }
    return;
  }

  authStatus.textContent = "현재 상태: 무료 모드";
  if (authGateMessage) {
    authGateMessage.textContent = "무료 기본, 로그인 시 Pro 전환";
  }
}

function renderMemberCondition(profile = {}) {
  const nameEl = document.getElementById("memberNameText");
  const sleepEl = document.getElementById("memberSleepPatternText");
  const healthEl = document.getElementById("memberHealthText");
  if (!nameEl || !sleepEl || !healthEl) {
    return;
  }
  nameEl.textContent = String(profile?.name || "미입력");
  sleepEl.textContent = String(profile?.sleepPattern || "미입력");
  healthEl.textContent = String(profile?.healthStatus || "미입력");
}

function updateTimerModeVisual() {
  if (!timerCard) {
    return;
  }
  const isBreak = mode !== "focus";
  timerCard.classList.toggle("mode-focus", !isBreak);
  timerCard.classList.toggle("mode-break", isBreak);
  if (modeChip) {
    modeChip.textContent = isBreak ? "Break Mode" : "Focus Mode";
  }
}

function setAuthStatusMessage(message, isError = false) {
  if (!authStatus) {
    return;
  }
  authStatus.textContent = message;
  authStatus.classList.toggle("error", isError);
}

function setAuthModalMode(mode) {
  authModalMode = mode === "signup" ? "signup" : "login";
  if (!authModalTitle || !authModalSubtitle || !authModalSubmitBtn || !switchAuthModeBtn) {
    return;
  }
  const isSignup = authModalMode === "signup";
  authModalTitle.textContent = isSignup ? "회원가입" : "로그인";
  authModalSubtitle.textContent = isSignup
    ? "계정을 만들고 바로 Pro 기능을 열어보세요."
    : "이메일로 바로 유료 기능을 활성화하세요.";
  authModalSubmitBtn.textContent = isSignup ? "회원가입" : "로그인";
  switchAuthModeBtn.textContent = isSignup ? "로그인으로 전환" : "회원가입으로 전환";
  authModal.classList.toggle("signup-mode", isSignup);
}

function openAuthModal(mode = "login") {
  if (!authModal) {
    return;
  }
  setAuthModalMode(mode);
  authModal.classList.add("show");
  authModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  if (authEmailInput) {
    authEmailInput.focus();
  }
}

function closeAuthModal() {
  if (!authModal) {
    return;
  }
  authModal.classList.remove("show");
  authModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

async function submitAuthModal() {
  const email = String(authEmailInput?.value || "").trim();
  const password = String(authPasswordInput?.value || "").trim();
  const nameInput = document.getElementById("authNameInput");
  const sleepPatternInput = document.getElementById("sleepPatternInput");
  const healthStatusRadio = document.querySelector('input[name="authHealthStatus"]:checked');
  const name = String(nameInput?.value || "").trim();
  const sleepPattern = String(sleepPatternInput?.value || "").trim();
  const healthStatus = String(healthStatusRadio?.value || "").trim();

  if (!email || !password) {
    setAuthStatusMessage("이메일과 비밀번호를 입력해주세요.", true);
    return;
  }

  if (authModalMode === "signup" && (!name || !sleepPattern || !healthStatus)) {
    setAuthStatusMessage("회원가입 시 이름/수면패턴/건강상태를 입력해주세요.", true);
    return;
  }

  if (authModalSubmitBtn) {
    authModalSubmitBtn.disabled = true;
  }

  try {
    const endpoint = authModalMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    const data = await authRequest(endpoint, {
      email,
      password,
      ...(authModalMode === "signup" ? { name, sleepPattern, healthStatus } : {}),
    });
    saveAuthState({
      isLoggedIn: true,
      email: data?.user?.email || email,
      token: data?.token || "",
      plan: data?.user?.plan || "pro",
      profile: data?.user?.profile || null,
    });

    if (authPasswordInput) {
      authPasswordInput.value = "";
    }
    if (nameInput) {
      nameInput.value = "";
    }
    if (sleepPatternInput) {
      sleepPatternInput.value = "";
    }
    const defaultHealthRadio = document.querySelector('input[name="authHealthStatus"][value="보통"]');
    if (defaultHealthRadio) {
      defaultHealthRadio.checked = true;
    }

    renderAccessByAuth();
    await restoreOrSyncBackupAfterLogin(data?.token || "");
    setAuthStatusMessage(`현재 상태: 유료 로그인 (${data?.user?.email || email}) · 백업 동기화 사용`);
    closeAuthModal();
  } catch (error) {
    setAuthStatusMessage(
      `${authModalMode === "signup" ? "회원가입" : "로그인"} 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      true
    );
  } finally {
    if (authModalSubmitBtn) {
      authModalSubmitBtn.disabled = false;
    }
  }
}

function savePredictionHistory(history) {
  localStorage.setItem(PREDICTION_HISTORY_KEY, JSON.stringify(history));
  void syncBackupToServer();
}

function renderPredictionHistory() {
  const history = loadPredictionHistory();

  if (history.length === 0) {
    predictionHistoryBody.innerHTML = "<tr><td colspan=\"6\">아직 저장된 기록이 없습니다.</td></tr>";
    renderCategoryStats([]);
    return;
  }

  predictionHistoryBody.innerHTML = history
    .slice()
    .reverse()
    .map((item) => {
      const diffText = `${item.diffMinutes >= 0 ? "+" : ""}${item.diffMinutes}분`;
      const aiUsedBadge = item.aiUsed ? "<span style=\"color:#195b43;font-size:0.85rem;\">AI</span>" : "<span style=\"color:#6d6a63;font-size:0.85rem;\">규칙</span>";
      return [
        "<tr>",
        `<td>${escapeHtml(item.taskName)}</td>`,
        `<td>${escapeHtml(item.category)}</td>`,
        `<td>${item.predictedMinutes}분</td>`,
        `<td>${item.actualMinutes}분</td>`,
        `<td>${diffText}</td>`,
        `<td>${aiUsedBadge}</td>`,
        "</tr>",
      ].join("");
    })
    .join("");
  
  renderCategoryStats(history);
}

function renderCategoryStats(history) {
  if (history.length === 0) {
    categoryStats.style.display = "none";
    return;
  }

  const categoryMap = {};
  history.forEach((item) => {
    const cat = item.category || "미분류";
    if (!categoryMap[cat]) {
      categoryMap[cat] = {
        count: 0,
        totalError: 0,
        underEstimate: 0,
        overEstimate: 0,
      };
    }
    categoryMap[cat].count += 1;
    categoryMap[cat].totalError += item.diffMinutes;
    if (item.diffMinutes >= 3) categoryMap[cat].underEstimate += 1;
    if (item.diffMinutes <= -3) categoryMap[cat].overEstimate += 1;
  });

  let html = "";
  Object.entries(categoryMap).forEach(([cat, stats]) => {
    const avgError = (stats.totalError / stats.count).toFixed(1);
    const accuracy = ((100 - Math.abs(avgError / 25 * 100)) || 0).toFixed(0);
    html += `
      <div class="category-stat-item">
        <strong>${escapeHtml(cat)}</strong>
        <span>(${stats.count}회 | 평균오차: ${avgError}분 | 정확도: ${accuracy}%)</span>
      </div>
    `;
  });

  categoryStatsContent.innerHTML = html;
  categoryStats.style.display = "block";
}

function getRecentPatternStats(history = loadPredictionHistory()) {
  const recent = history.slice(-10);
  if (recent.length === 0) {
    return {
      avgDiff: 0,
      avgInterruptions: 0,
      underEstimateRate: 0,
      overEstimateRate: 0,
    };
  }

  const totalDiff = recent.reduce((acc, item) => acc + Number(item.diffMinutes || 0), 0);
  const totalInterruptions = recent.reduce((acc, item) => acc + Number(item.actualInterruptions || 0), 0);
  const underEstimateCount = recent.filter((item) => Number(item.diffMinutes) >= 3).length;
  const overEstimateCount = recent.filter((item) => Number(item.diffMinutes) <= -3).length;

  return {
    avgDiff: totalDiff / recent.length,
    avgInterruptions: totalInterruptions / recent.length,
    underEstimateRate: underEstimateCount / recent.length,
    overEstimateRate: overEstimateCount / recent.length,
  };
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadDailyContext() {
  try {
    const raw = localStorage.getItem(DAILY_CONTEXT_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveDailyContext(context) {
  const all = loadDailyContext();
  const todayKey = getTodayKey();
  all[todayKey] = context;
  localStorage.setItem(DAILY_CONTEXT_KEY, JSON.stringify(all));
  void syncBackupToServer();
}

function getConditionLabel(score) {
  const num = Number(score);
  if (num >= 5) return `최상 (${num})`;
  if (num >= 4) return `좋음 (${num})`;
  if (num >= 3) return `보통 (${num})`;
  if (num >= 2) return `피곤 (${num})`;
  return `매우 피곤 (${num})`;
}

function getScheduleLabel(level) {
  if (level === "heavy") return "바쁨";
  if (level === "light") return "여유";
  return "보통";
}

function estimateScheduleByTime() {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  const weekday = day >= 1 && day <= 5;

  if (weekday && hour >= 9 && hour <= 18) {
    return "heavy";
  }
  if (hour >= 22 || hour <= 6) {
    return "light";
  }
  return "normal";
}

function buildRoutinePlan(taskName, recommendedMinutes, recommendedInterruptions) {
  const safeTask = taskName || "현재 작업";
  const warmup = Math.max(3, Math.round(recommendedMinutes * 0.2));
  const deep = Math.max(10, Math.round(recommendedMinutes * 0.6));
  const wrapup = Math.max(2, recommendedMinutes - warmup - deep);

  return [
    `작업: ${safeTask}`,
    `권장 집중 시간: ${recommendedMinutes}분`,
    `예상 방해 허용치: ${recommendedInterruptions}회`,
    `세로 루틴: 준비 ${warmup}분 → 딥워크 ${deep}분 → 정리 ${wrapup}분`,
    "집중 전: 알림 차단, 단일 창 유지, 완료 기준 1줄 정의",
  ].join("\n");
}

function computePersonalizedRecommendation(taskCategory = "") {
  const sleepHours = Number(sleepHoursInput?.value || 7);
  const conditionScore = Number(conditionScoreInput?.value || 3);
  const scheduleLoad = scheduleLoadInput?.value || "normal";
  const pattern = getRecentPatternStats();
  const history = loadPredictionHistory();

  const categoryHistory = history.filter((item) => (item.category || "미분류") === (taskCategory || "미분류"));
  const categoryAvgDiff = categoryHistory.length > 0
    ? categoryHistory.reduce((acc, item) => acc + Number(item.diffMinutes || 0), 0) / categoryHistory.length
    : 0;

  const base = Number(predictedMinutesInput.value) || 25;
  let adjusted = base;

  if (sleepHours < 6) adjusted += 8;
  else if (sleepHours < 7) adjusted += 4;
  else if (sleepHours >= 8) adjusted -= 2;

  adjusted += (3 - conditionScore) * 2;

  if (scheduleLoad === "heavy") adjusted += 6;
  if (scheduleLoad === "light") adjusted -= 2;

  adjusted += pattern.avgDiff * 0.35;
  adjusted += categoryAvgDiff * 0.25;

  const recommendedMinutes = clamp(Math.round(adjusted), RECOMMENDED_MINUTES_MIN, RECOMMENDED_MINUTES_MAX);

  const predictedInterruptionsBase = Number(predictedInterruptionsInput.value) || 0;
  const scheduleInterruptions = scheduleLoad === "heavy" ? 2 : scheduleLoad === "normal" ? 1 : 0;
  const conditionInterruptions = conditionScore <= 2 ? 1 : 0;
  const patternInterruptions = Math.round(pattern.avgInterruptions * 0.35);
  const recommendedInterruptions = clamp(
    predictedInterruptionsBase + scheduleInterruptions + conditionInterruptions + patternInterruptions,
    0,
    20
  );

  return {
    recommendedMinutes,
    recommendedInterruptions,
    sleepHours,
    conditionScore,
    scheduleLoad,
    pattern,
  };
}

function updateRoutinePreview(taskName = "") {
  if (!routinePreview) {
    return;
  }

  const recommendation = computePersonalizedRecommendation(taskCategoryInput.value.trim() || "미분류");
  const preview = buildRoutinePlan(taskName || taskNameInput.value.trim() || "현재 작업", recommendation.recommendedMinutes, recommendation.recommendedInterruptions);
  const extra = [
    `컨디션 반영: 수면 ${recommendation.sleepHours}시간 / 컨디션 ${getConditionLabel(recommendation.conditionScore)} / 일정 ${getScheduleLabel(recommendation.scheduleLoad)}`,
    `누적 패턴 반영: 평균 오차 ${recommendation.pattern.avgDiff.toFixed(1)}분, 평균 방해 ${recommendation.pattern.avgInterruptions.toFixed(1)}회`,
  ].join("\n");
  routinePreview.textContent = `${preview}\n${extra}`;
}

function autoConnectContext() {
  if (!sleepHoursInput || !conditionScoreInput || !scheduleLoadInput) {
    return;
  }

  const pattern = getRecentPatternStats();
  const allContext = loadDailyContext();
  const today = getTodayKey();
  const previous = allContext[today] || {};

  const autoSleep = Number(previous.sleepHours || 7);
  const autoCondition = clamp(
    Math.round(3 + (autoSleep - 7) * 0.7 - Math.abs(pattern.avgDiff) * 0.05),
    1,
    5
  );
  const autoSchedule = previous.scheduleLoad || estimateScheduleByTime();

  sleepHoursInput.value = String(autoSleep);
  conditionScoreInput.value = String(autoCondition);
  if (conditionScoreText) {
    conditionScoreText.textContent = getConditionLabel(autoCondition);
  }
  scheduleLoadInput.value = autoSchedule;

  saveDailyContext({
    sleepHours: autoSleep,
    conditionScore: autoCondition,
    scheduleLoad: autoSchedule,
    updatedAt: new Date().toISOString(),
  });

  updateRoutinePreview(taskNameInput.value.trim());
}

function updateInterruptionWarning() {
  if (!interruptPatternWarning || !predictionSession) {
    if (interruptPatternWarning) {
      interruptPatternWarning.style.display = "none";
    }
    return;
  }

  const actualInterruptions = pauseCount + skipCount;
  const predicted = Number(predictionSession.predictedInterruptions || 0);
  const warningLevel = actualInterruptions - predicted;

  if (warningLevel >= 2) {
    interruptPatternWarning.style.display = "block";
    interruptPatternWarning.textContent = `방해 패턴 경고: 현재 방해가 예상보다 ${warningLevel}회 많습니다. 2분 정리 후 단일 작업으로 다시 복귀하세요.`;
    return;
  }

  if (warningLevel >= 1) {
    interruptPatternWarning.style.display = "block";
    interruptPatternWarning.textContent = "주의: 방해 횟수가 예상치를 넘기기 시작했습니다. 알림을 잠시 끄고 목표 1개만 유지하세요.";
    return;
  }

  interruptPatternWarning.style.display = "none";
}

function exportHistoryToCsv() {
  const history = loadPredictionHistory();
  if (history.length === 0) {
    alert("내보낼 기록이 없습니다.");
    return;
  }

  const headers = [
    "작업명",
    "카테고리",
    "예측시간(분)",
    "실제시간(분)",
    "오차(분)",
    "실제방해(회)",
    "수면(시간)",
    "컨디션(1~5)",
    "일정강도",
    "AI분석",
    "저장일시",
  ];
  const rows = history.map((item) => [
    item.taskName,
    item.category,
    item.predictedMinutes,
    item.actualMinutes,
    item.diffMinutes,
    item.actualInterruptions ?? "",
    item.sleepHours ?? "",
    item.conditionScore ?? "",
    item.scheduleLoad ?? "",
    item.aiUsed ? "AI" : "규칙",
    new Date(item.savedAt).toLocaleString("ko-KR"),
  ]);

  let csv = headers.join(",") + "\n";
  rows.forEach((row) => {
    csv += row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `pomodoro-records-${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function savePredictionRecord(record) {
  const history = loadPredictionHistory();
  history.push(record);
  const trimmed = history.slice(-PREDICTION_HISTORY_LIMIT);
  savePredictionHistory(trimmed);
  renderPredictionHistory();
}

function fmt(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function render() {
  timerDisplay.textContent = fmt(remaining);
  const remainingRatioByHour = Math.max(0, Math.min(1, remaining / RING_BASE_SECONDS));
  const ringAngle = remainingRatioByHour * 360;
  const overHourSeconds = Math.max(0, remaining - RING_BASE_SECONDS);
  const overHourMinutes = Math.ceil(overHourSeconds / 60);
  const overHourRatio = Math.max(0, Math.min(1, overHourSeconds / RING_BASE_SECONDS));

  if (timerCard) {
    timerCard.style.setProperty("--ring-angle", `${ringAngle}deg`);
    timerCard.style.setProperty("--over-hour-ratio", String(overHourRatio));
    timerCard.classList.toggle("over-hour", overHourSeconds > 0);
  }

  if (overHourBadge) {
    if (overHourSeconds > 0) {
      overHourBadge.hidden = false;
      overHourBadge.textContent = `60분 기준 +${overHourMinutes}분`;
    } else {
      overHourBadge.hidden = true;
      overHourBadge.textContent = "";
    }
  }

  focusCountEl.textContent = String(focusCount);
  streakCountEl.textContent = String(streakCount);
  totalFocusMinutesEl.textContent = String(totalFocusMinutes);
}

function resetCurrentModeToFull() {
  remaining = total;
  if (timerCard) {
    const remainingRatioByHour = Math.max(0, Math.min(1, remaining / RING_BASE_SECONDS));
    timerCard.style.setProperty("--ring-angle", `${remainingRatioByHour * 360}deg`);
  }
}

function setMode(nextMode) {
  mode = nextMode;
  total = MODES[mode];
  resetCurrentModeToFull();
  stop();
  updateTimerModeVisual();
  updateModeButtons();
  customMinutesInput.value = String(Math.floor(MODES[mode] / 60));
  render();
}

function updateModeButtons() {
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
}

function stop() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
    pauseCount += 1;
  }
  startPauseBtn.textContent = "시작";
}

function stopWithoutCountingPause() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  startPauseBtn.textContent = "시작";
}

function estimateReasons(deltaMinutes, actualInterruptions, predictedInterruptions) {
  const reasons = [];

  if (deltaMinutes > 5) {
    reasons.push("작업 범위를 처음에 너무 작게 잡았을 가능성");
  }
  if (deltaMinutes < -5) {
    reasons.push("예상보다 빠르게 핵심 작업을 끝낸 경우 (범위 과대 추정)");
  }
  if (actualInterruptions > predictedInterruptions) {
    reasons.push("예상보다 방해 요소가 많아서 집중 흐름이 끊김");
  }
  if (pauseCount >= 2) {
    reasons.push("중간 일시정지 횟수가 많아 실제 완료 시간이 증가");
  }
  if (skipCount > 0) {
    reasons.push("세션 건너뛰기로 측정 흐름이 불안정해짐");
  }
  if (reasons.length === 0) {
    reasons.push("예측과 실제가 유사합니다. 추정 정확도가 좋은 편입니다.");
  }

  return reasons;
}

async function requestAiPredictionAnalysis(payload) {
  const token = localStorage.getItem(GITHUB_TOKEN_KEY);
  const data = await apiRequest("/api/copilot/prediction-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, token }),
  }, "AI 예측 분석 요청에 실패했습니다.");

  return data.analysis || {};
}

async function finishPredictionSession(auto = false) {
  if (!predictionSession) {
    predictionSummary.textContent = "진행 중인 예측 세션이 없습니다.";
    return;
  }

  finishPredictionBtn.disabled = true;

  try {
    const now = Date.now();
    const actualMinutes = Math.max(1, Math.round((now - predictionSession.startedAt) / 60000));
    const predictedMinutes = predictionSession.predictedMinutes;
    const deltaMinutes = actualMinutes - predictedMinutes;
    const actualInterruptions = pauseCount + skipCount;
    const predictedInterruptions = predictionSession.predictedInterruptions;
    const currentSleepHours = Number(sleepHoursInput?.value || 7);
    const currentConditionScore = Number(conditionScoreInput?.value || 3);
    const currentScheduleLoad = scheduleLoadInput?.value || "normal";
    const recommendationBase = Math.round(actualMinutes * 0.7 + predictedMinutes * 0.3);
    let recommendedMinutes = clamp(recommendationBase, RECOMMENDED_MINUTES_MIN, RECOMMENDED_MINUTES_MAX);

    let reasons = estimateReasons(deltaMinutes, actualInterruptions, predictedInterruptions);
    let aiInsight = "";
    let aiUsed = false;
    const useAi = Boolean(useAiAnalysisCheck?.checked);

    if (useAi) {
      try {
        const aiAnalysis = await requestAiPredictionAnalysis({
          taskName: predictionSession.taskName,
          category: predictionSession.category,
          predictedMinutes,
          actualMinutes,
          deltaMinutes,
          predictedInterruptions,
          actualInterruptions,
          pauseCount,
          skipCount,
        });

        if (Array.isArray(aiAnalysis.aiReasons) && aiAnalysis.aiReasons.length > 0) {
          reasons = aiAnalysis.aiReasons.map((item) => String(item));
        }

        const aiSuggested = Number(aiAnalysis.aiSuggestedMinutes);
        if (Number.isFinite(aiSuggested)) {
          recommendedMinutes = clamp(Math.round(aiSuggested), RECOMMENDED_MINUTES_MIN, RECOMMENDED_MINUTES_MAX);
        }

        aiInsight = typeof aiAnalysis.aiInsight === "string" ? aiAnalysis.aiInsight : "";
        aiUsed = true;
      } catch (error) {
        reasons = [
          ...reasons,
          `AI 분석 실패로 규칙 기반 분석으로 대체: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        ];
      }
    }

    const modeText = auto ? "(집중 세션 완료로 자동 분석)" : "(수동 분석)";
    const safeTaskName = escapeHtml(predictionSession.taskName);
    const safeCategory = escapeHtml(predictionSession.category);
    const safeReasons = reasons.map((reason) => escapeHtml(reason));
    const safeAiInsight = escapeHtml(aiInsight);
    let judgement = "예측 정확";
    let badgeClass = "match";

    if (deltaMinutes >= 3) {
      judgement = "과소추정";
      badgeClass = "under";
    } else if (deltaMinutes <= -3) {
      judgement = "과대추정";
      badgeClass = "over";
    }

    predictedMinutesInput.value = String(recommendedMinutes);

    predictionSummary.innerHTML = [
      `<span class=\"summary-badge ${badgeClass}\">${judgement}</span>`,
      `<div class=\"summary-line\">AI 분석 사용 여부: ${aiUsed ? "사용 (Copilot SDK)" : "미사용 (규칙 기반)"}</div>`,
      `<div class=\"summary-line\">작업: ${safeTaskName} (${safeCategory})</div>`,
      `<div class=\"summary-line\">예상 시간: ${predictedMinutes}분 | 실제 시간: ${actualMinutes}분 | 오차: ${deltaMinutes >= 0 ? "+" : ""}${deltaMinutes}분</div>`,
      `<div class=\"summary-line\">예상 방해: ${predictedInterruptions}회 | 실제 방해(일시정지+건너뛰기): ${actualInterruptions}회</div>`,
      `<div class="summary-line">개인화 컨텍스트: 수면 ${currentSleepHours}시간 / 컨디션 ${getConditionLabel(currentConditionScore)} / 일정 ${getScheduleLabel(currentScheduleLoad)}</div>`,
      `<div class=\"summary-line\">분석 ${modeText}</div>`,
      `<div class=\"summary-line\">- ${safeReasons.join("<br>- ")}</div>`,
      safeAiInsight ? `<div class=\"summary-line\">AI 인사이트: ${safeAiInsight}</div>` : "",
      `<div class=\"summary-recommend\">다음 세션 권장 시간: ${recommendedMinutes}분 (자동 제한 ${RECOMMENDED_MINUTES_MIN}~${RECOMMENDED_MINUTES_MAX}분 적용)</div>`,
    ].join("");

    savePredictionRecord({
      taskName: predictionSession.taskName,
      category: predictionSession.category,
      predictedMinutes,
      actualMinutes,
      diffMinutes: deltaMinutes,
      actualInterruptions,
      sleepHours: currentSleepHours,
      conditionScore: currentConditionScore,
      scheduleLoad: currentScheduleLoad,
      aiUsed,
      savedAt: new Date().toISOString(),
    });

    predictionSession = null;
  } finally {
    finishPredictionBtn.disabled = false;
  }
}

function startPredictionSession() {
  const taskName = taskNameInput.value.trim() || "이름 없는 작업";
  const category = taskCategoryInput.value.trim() || "미분류";
  const predictedMinutes = Number(predictedMinutesInput.value);
  const predictedInterruptions = Number(predictedInterruptionsInput.value);

  if (!Number.isFinite(predictedMinutes) || predictedMinutes < 1 || predictedMinutes > 300) {
    alert("예상 시간은 1분에서 300분 사이로 입력해주세요.");
    return;
  }
  if (!Number.isFinite(predictedInterruptions) || predictedInterruptions < 0 || predictedInterruptions > 20) {
    alert("예상 방해 횟수는 0~20 사이로 입력해주세요.");
    return;
  }

  predictionSession = {
    taskName,
    category,
    predictedMinutes: Math.round(predictedMinutes),
    predictedInterruptions: Math.round(predictedInterruptions),
    startedAt: Date.now()
  };

  pauseCount = 0;
  skipCount = 0;
  if (interruptPatternWarning) {
    interruptPatternWarning.style.display = "none";
  }

  predictionSummary.textContent = `예측 세션 시작: ${taskName} (${category})\n예상 ${predictionSession.predictedMinutes}분 / 방해 ${predictionSession.predictedInterruptions}회`;
}

function completeSession() {
  if (mode === "focus") {
    focusCount += 1;
    streakCount += 1;
    totalFocusMinutes += 25;

    if (predictionSession) {
      void finishPredictionSession(true);
    }

    if (focusCount % 4 === 0) {
      setMode("longBreak");
    } else {
      setMode("shortBreak");
    }
  } else {
    setMode("focus");
  }
}

function tick() {
  if (remaining > 0) {
    remaining -= 1;
    render();
    updateInterruptionWarning();
    return;
  }

  stop();
  completeSession();
}

function start() {
  if (timerId) {
    stop();
    return;
  }

  timerId = setInterval(tick, 1000);
  startPauseBtn.textContent = "일시정지";
}

startPauseBtn.addEventListener("click", start);
resetBtn.addEventListener("click", () => {
  resetCurrentModeToFull();
  streakCount = 0;
  stopWithoutCountingPause();
  render();
});
skipBtn.addEventListener("click", () => {
  skipCount += 1;
  stopWithoutCountingPause();
  updateInterruptionWarning();
  completeSession();
});

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    setMode(btn.dataset.mode);
  });
});

function applyCustomMinutes() {
  const minutes = Number(customMinutesInput.value);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180) {
    alert("시간은 1분에서 180분 사이로 입력해주세요.");
    customMinutesInput.value = String(Math.floor(MODES[mode] / 60));
    return;
  }

  const seconds = Math.round(minutes * 60);
  MODES[mode] = seconds;
  total = seconds;
  resetCurrentModeToFull();
  stop();
  render();
}

applyCustomMinutesBtn.addEventListener("click", applyCustomMinutes);
customMinutesInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    applyCustomMinutes();
  }
});

startPredictionBtn.addEventListener("click", startPredictionSession);
finishPredictionBtn.addEventListener("click", () => {
  void finishPredictionSession(false);
});

if (conditionScoreInput && conditionScoreText) {
  conditionScoreInput.addEventListener("input", () => {
    conditionScoreText.textContent = getConditionLabel(conditionScoreInput.value);
    updateRoutinePreview(taskNameInput.value.trim());
  });
}

if (sleepHoursInput) {
  sleepHoursInput.addEventListener("input", () => {
    updateRoutinePreview(taskNameInput.value.trim());
  });
}

if (scheduleLoadInput) {
  scheduleLoadInput.addEventListener("change", () => {
    updateRoutinePreview(taskNameInput.value.trim());
  });
}

taskNameInput.addEventListener("input", () => {
  updateRoutinePreview(taskNameInput.value.trim());
});

taskCategoryInput.addEventListener("input", () => {
  updateRoutinePreview(taskNameInput.value.trim());
});

if (autoConnectContextBtn) {
  autoConnectContextBtn.addEventListener("click", () => {
    autoConnectContext();
  });
}

if (applyRoutineBtn) {
  applyRoutineBtn.addEventListener("click", () => {
    const recommendation = computePersonalizedRecommendation(taskCategoryInput.value.trim() || "미분류");
    predictedMinutesInput.value = String(recommendation.recommendedMinutes);
    predictedInterruptionsInput.value = String(recommendation.recommendedInterruptions);

    saveDailyContext({
      sleepHours: recommendation.sleepHours,
      conditionScore: recommendation.conditionScore,
      scheduleLoad: recommendation.scheduleLoad,
      updatedAt: new Date().toISOString(),
    });

    updateRoutinePreview(taskNameInput.value.trim());
  });
}

if (openLoginModalBtn) {
  openLoginModalBtn.addEventListener("click", () => {
    openAuthModal("login");
  });
}

if (openSignupModalBtn) {
  openSignupModalBtn.addEventListener("click", () => {
    openAuthModal("signup");
  });
}

if (authModalSubmitBtn) {
  authModalSubmitBtn.addEventListener("click", () => {
    void submitAuthModal();
  });
}

if (switchAuthModeBtn) {
  switchAuthModeBtn.addEventListener("click", () => {
    setAuthModalMode(authModalMode === "signup" ? "login" : "signup");
  });
}

if (closeAuthModalBtn) {
  closeAuthModalBtn.addEventListener("click", closeAuthModal);
}

if (authModalBackdrop) {
  authModalBackdrop.addEventListener("click", closeAuthModal);
}

if (authPasswordInput) {
  authPasswordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitAuthModal();
    }
  });
}

if (authEmailInput) {
  authEmailInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitAuthModal();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && authModal?.classList.contains("show")) {
    closeAuthModal();
  }
});

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    clearAuthState();
    renderAccessByAuth();
    setAuthStatusMessage("현재 상태: 무료 모드");
  });
}

function addMessage(text, role) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  coachMessages.appendChild(div);
  coachMessages.scrollTop = coachMessages.scrollHeight;
}

async function sendCoachMessage() {
  const message = coachInput.value.trim();
  if (!message) {
    return;
  }

  addMessage(message, "user");
  coachInput.value = "";
  coachSendBtn.disabled = true;

  try {
    const token = localStorage.getItem(GITHUB_TOKEN_KEY);
    const data = await apiRequest("/api/copilot/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, token })
    }, "요청에 실패했습니다.");

    addMessage(data.reply || "응답이 비어 있습니다.", "bot");
  } catch (error) {
    addMessage(`오류: ${error instanceof Error ? error.message : "알 수 없는 오류"}`, "bot");
  } finally {
    coachSendBtn.disabled = false;
  }
}

coachSendBtn.addEventListener("click", sendCoachMessage);
coachInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendCoachMessage();
  }
});

exportCsvBtn.addEventListener("click", exportHistoryToCsv);

function getStoredToken() {
  return localStorage.getItem(GITHUB_TOKEN_KEY);
}

function saveToken(token) {
  if (token.trim()) {
    localStorage.setItem(GITHUB_TOKEN_KEY, token.trim());
    return true;
  }
  return false;
}

function clearToken() {
  localStorage.removeItem(GITHUB_TOKEN_KEY);
}

async function checkTokenStatus() {
  try {
    const storedToken = getStoredToken();
    const data = await apiRequest("/api/token-status", { method: "GET" }, "토큰 상태 확인 실패");
    const hasToken = storedToken || data.hasToken;
    
    if (!hasToken) {
      tokenStatusAlert.style.display = "block";
      useAiAnalysisCheck.checked = false;
      useAiAnalysisCheck.disabled = true;
    } else {
      tokenStatusAlert.style.display = "none";
      useAiAnalysisCheck.disabled = false;
    }
  } catch (error) {
    console.warn("토큰 상태 확인 실패:", error);
  }
}

saveTokenBtn.addEventListener("click", () => {
  const token = githubTokenInput.value.trim();
  if (!token) {
    alert("토큰을 입력해주세요.");
    return;
  }
  if (token.length < 20) {
    alert("토큰이 너무 짧습니다. 유효한 GitHub 토큰을 입력해주세요.");
    return;
  }
  if (saveToken(token)) {
    alert("토큰이 저장되었습니다!");
    githubTokenInput.value = "";
    checkTokenStatus();
  }
});

githubTokenInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    saveTokenBtn.click();
  }
});

checkTokenStatus();
setupClientObservability();
autoConnectContext();
updateRoutinePreview();
renderAccessByAuth();
updateTimerModeVisual();
renderPredictionHistory();
render();

{
  const auth = loadAuthState();
  if (auth.isLoggedIn && auth.token) {
    void restoreOrSyncBackupAfterLogin(auth.token);
  }
}
