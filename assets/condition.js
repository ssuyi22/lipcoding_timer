const AUTH_STATE_KEY = "pomodoro_auth_state_v1";
const AUTH_TOKEN_KEY = "pomodoro_auth_token_v1";

const conditionForm = document.getElementById("conditionForm");
const conditionStatus = document.getElementById("conditionStatus");
const saveConditionBtn = document.getElementById("saveConditionBtn");
const conditionNameInput = document.getElementById("conditionNameInput");
const conditionSleepInput = document.getElementById("conditionSleepInput");

function loadAuthState() {
  try {
    const raw = localStorage.getItem(AUTH_STATE_KEY);
    const token = String(localStorage.getItem(AUTH_TOKEN_KEY) || "");
    if (!raw) {
      return { isLoggedIn: false, token: "", email: "", profile: null };
    }
    const parsed = JSON.parse(raw);
    return {
      isLoggedIn: Boolean(parsed?.isLoggedIn),
      token,
      email: String(parsed?.email || ""),
      plan: String(parsed?.plan || "free"),
      profile: parsed?.profile && typeof parsed.profile === "object" ? parsed.profile : null,
    };
  } catch {
    return { isLoggedIn: false, token: "", email: "", profile: null };
  }
}

function saveAuthState(nextState) {
  const prev = loadAuthState();
  const safeState = {
    isLoggedIn: true,
    email: String(nextState?.email || prev.email || ""),
    plan: String(nextState?.plan || prev.plan || "pro"),
    profile: nextState?.profile && typeof nextState.profile === "object" ? nextState.profile : null,
  };
  localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(safeState));
}

function setStatus(message, isError = false) {
  if (!conditionStatus) {
    return;
  }
  conditionStatus.textContent = message;
  conditionStatus.classList.toggle("error", isError);
}

async function apiRequest(url, options, fallbackMessage) {
  const response = await fetch(url, options);
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) {
    const base = data?.error || fallbackMessage;
    const reqId = data?.requestId ? ` (req: ${data.requestId})` : "";
    throw new Error(`${base}${reqId}`);
  }
  return data;
}

function getSelectedHealthStatus() {
  const selected = document.querySelector('input[name="conditionHealth"]:checked');
  return String(selected?.value || "");
}

function setSelectedHealthStatus(value) {
  const radio = document.querySelector(`input[name="conditionHealth"][value="${value}"]`);
  if (radio) {
    radio.checked = true;
  }
}

function validateInput(name, sleepPattern, healthStatus) {
  if (!name || !sleepPattern || !healthStatus) {
    return "이름, 수면 패턴, 건강 상태를 모두 입력해주세요.";
  }
  if (name.length < 2 || name.length > 30) {
    return "이름은 2~30자로 입력해주세요.";
  }
  if (sleepPattern.length < 2 || sleepPattern.length > 100) {
    return "수면 패턴은 2~100자로 입력해주세요.";
  }
  return "";
}

async function loadProfile() {
  const auth = loadAuthState();
  if (!auth.isLoggedIn || !auth.token) {
    setStatus("로그인이 필요합니다. 메인 페이지에서 로그인 후 다시 시도해주세요.", true);
    if (saveConditionBtn) {
      saveConditionBtn.disabled = true;
    }
    return;
  }

  try {
    const data = await apiRequest(
      "/api/user/profile",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      },
      "프로필 조회 실패"
    );

    const profile = data?.profile || {};
    conditionNameInput.value = String(profile.name || "");
    conditionSleepInput.value = String(profile.sleepPattern || "");
    setSelectedHealthStatus(String(profile.healthStatus || "보통"));

    saveAuthState({
      email: data?.user?.email || auth.email,
      plan: data?.user?.plan || auth.plan,
      profile,
    });

    setStatus(`로그인 사용자: ${data?.user?.email || auth.email}`);
  } catch (error) {
    setStatus(`프로필을 불러오지 못했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`, true);
  }
}

async function saveProfile(event) {
  event.preventDefault();

  const auth = loadAuthState();
  if (!auth.isLoggedIn || !auth.token) {
    setStatus("로그인이 필요합니다.", true);
    return;
  }

  const name = String(conditionNameInput.value || "").trim();
  const sleepPattern = String(conditionSleepInput.value || "").trim();
  const healthStatus = getSelectedHealthStatus();
  const validationMessage = validateInput(name, sleepPattern, healthStatus);
  if (validationMessage) {
    setStatus(validationMessage, true);
    return;
  }

  if (saveConditionBtn) {
    saveConditionBtn.disabled = true;
  }

  try {
    const data = await apiRequest(
      "/api/user/profile",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          name,
          sleepPattern,
          healthStatus,
        }),
      },
      "프로필 저장 실패"
    );

    saveAuthState({
      email: auth.email,
      plan: auth.plan,
      profile: data.profile,
    });

    setStatus("저장되었습니다. 메인 화면 카드에도 바로 반영됩니다.");
  } catch (error) {
    setStatus(`저장 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`, true);
  } finally {
    if (saveConditionBtn) {
      saveConditionBtn.disabled = false;
    }
  }
}

if (conditionForm) {
  conditionForm.addEventListener("submit", (event) => {
    void saveProfile(event);
  });
}

void loadProfile();
