# Pomodoro Timer - 데이터 흐름 및 상태 관리

## 📊 상태 관리 아키텍처

### 전역 상태 변수들

```javascript
// 타이머 상태
let mode = "focus"              // 현재 모드: "focus" | "shortBreak" | "longBreak"
let remaining = 1500            // 남은 시간 (초)
let total = 1500                // 총 시간 (초)
let timerId = null              // 타이머 인터벌 ID

// 통계 상태
let focusCount = 0              // 완료한 집중 세션
let streakCount = 0             // 연속 완료
let totalFocusMinutes = 0       // 총 집중 시간(분)
let pauseCount = 0              // 일시정지 횟수
let skipCount = 0               // 건너뛰기 횟수

// 예측 상태
let predictionSession = null    // 현재 실행 중인 예측 세션
let authModalMode = "login"     // 인증 모달: "login" | "signup"
```

---

## 🔄 데이터 흐름도

### 1. 타이머 실행 흐름
```
[시작 클릭]
    ↓
startTimer()
    ↓
setInterval() → tick()
    ↓
remaining-- (매초)
    ↓
render() 호출
    ↓
CSS 변수 업데이트 (--ring-angle)
    ↓
UI 업데이트 (MM:SS 표시)
    ↓
remaining == 0?
    ├─ YES → 완료 처리 → focusCount++
    └─ NO → 계속 진행
```

### 2. 예측 데이터 저장 흐름
```
[예측 세션 시작]
    ↓
predictionSession = {
  taskName, category, 
  predictedMinutes, 
  predictedInterruptions
}
    ↓
[예측 세션 종료/분석]
    ↓
실제 소요 시간 계산
    ↓
차이 = 실제 - 예측
    ↓
loadPredictionHistory()
    ↓
새 항목 추가
    ↓
최대 50개 유지
    ↓
savePredictionHistory()
    ↓
localStorage에 JSON 저장
```

### 3. 인증 흐름
```
[로그인 클릭]
    ↓
authModal 표시 (모드: "login")
    ↓
이메일 + 비밀번호 입력
    ↓
authModalSubmitBtn 클릭
    ↓
API 요청 (POST /api/login)
    ↓
성공?
├─ YES → 
│   ├─ 토큰 저장 (pomodoro_auth_token_v1)
│   ├─ 사용자 정보 저장 (pomodoro_auth_state_v1)
│   ├─ 모달 닫기
│   ├─ Premium UI 표시
│   └─ authStatus 업데이트
└─ NO → 에러 메시지 표시
```

---

## 📝 localStorage 데이터 구조 (상세)

### 인증 정보
```json
{
  "pomodoro_auth_token_v1": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "pomodoro_auth_state_v1": {
    "email": "user@example.com",
    "name": "사용자 이름",
    "plan": "premium",
    "loginTime": 1718841600000
  }
}
```

### 예측 히스토리
```json
{
  "pomodoro_prediction_history_v1": [
    {
      "taskName": "알고리즘 문제 풀이",
      "category": "코딩",
      "predictedMinutes": 15,
      "actualMinutes": 1,
      "difference": -14,
      "aiAnalysis": "규칙 패턴 감지",
      "timestamp": 1718841600000
    },
    {
      "taskName": "발표 자료 1차 완성",
      "category": "문서 작성",
      "predictedMinutes": 120,
      "actualMinutes": 1,
      "difference": -119,
      "aiAnalysis": "복잡도 과추정",
      "timestamp": 1718828200000
    }
  ]
}
```

### 일일 컨디션
```json
{
  "pomodoro_daily_context_v1": {
    "date": "2026-06-20",
    "sleepHours": 7,
    "conditionScore": 1,
    "scheduleLoad": "보통",
    "recommendedMinutes": 15,
    "allowedInterruptions": 2
  }
}
```

### GitHub 토큰
```json
{
  "github_copilot_token_v1": "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

---

## 🎯 CSS 변수 업데이트 메커니즘

### Ring Animation 계산

```javascript
// render() 함수 내
const remainingRatioByHour = Math.max(0, Math.min(1, remaining / RING_BASE_SECONDS));
const ringAngle = remainingRatioByHour * 360;
timerCard.style.setProperty("--ring-angle", `${ringAngle}deg`);
```

### 예시
- 60분 남음 (3600초): (3600/3600) × 360 = 360° (전체)
- 30분 남음 (1800초): (1800/3600) × 360 = 180° (반원)
- 25분 남음 (1500초): (1500/3600) × 360 = 150° (약 42%)
- 5분 남음 (300초): (300/3600) × 360 = 30°

### CSS에서의 사용
```css
.clock-rim {
  background: conic-gradient(
    from 0deg,                              /* 12시 시작 */
    var(--ring-color, #ea4335) 0deg,
    var(--ring-color, #ea4335) var(--ring-angle, 360deg),
    var(--ring-track-color, #f3d2ce) var(--ring-angle, 360deg),
    var(--ring-track-color, #f3d2ce) 360deg
  );
}
```

---

## 🔌 Event Listener 매핑

### 타이머 제어
```javascript
startPauseBtn.addEventListener("click", () => {
  if (timerId) pauseTimer();
  else startTimer();
});

resetBtn.addEventListener("click", () => {
  resetCurrentModeToFull();
});

skipBtn.addEventListener("click", () => {
  switchMode(getNextMode());
});

applyCustomMinutesBtn.addEventListener("click", () => {
  const minutes = parseInt(customMinutesInput.value);
  remaining = minutes * 60;
  total = minutes * 60;
  render();
});
```

### 모드 선택
```javascript
document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", (e) => {
    const newMode = e.target.dataset.mode;
    switchMode(newMode);
  });
});
```

### 예측 세션
```javascript
startPredictionBtn.addEventListener("click", () => {
  predictionSession = {
    taskName: taskNameInput.value,
    category: taskCategoryInput.value,
    predictedMinutes: parseInt(predictedMinutesInput.value),
    predictedInterruptions: parseInt(predictedInterruptionsInput.value),
    startTime: Date.now()
  };
  // UI 업데이트: "예측 세션 시작됨"
});

finishPredictionBtn.addEventListener("click", () => {
  if (!predictionSession) return;
  
  const actualMinutes = (Date.now() - predictionSession.startTime) / 60000;
  
  // 히스토리 저장
  const history = loadPredictionHistory();
  history.push({
    ...predictionSession,
    actualMinutes: Math.round(actualMinutes),
    timestamp: Date.now()
  });
  savePredictionHistory(history);
  
  predictionSession = null;
  renderPredictionHistory();
});
```

### 인증
```javascript
openLoginModalBtn.addEventListener("click", () => {
  authModalMode = "login";
  showAuthModal();
});

authModalSubmitBtn.addEventListener("click", async () => {
  const email = authEmailInput.value;
  const password = authPasswordInput.value;
  
  if (authModalMode === "login") {
    await handleLogin(email, password);
  } else {
    await handleSignup(email, password);
  }
});
```

---

## 📈 통계 계산 로직

### 카테고리별 분석

```javascript
function calculateCategoryStats() {
  const history = loadPredictionHistory();
  const byCategory = {};
  
  history.forEach(item => {
    if (!byCategory[item.category]) {
      byCategory[item.category] = {
        count: 0,
        totalError: 0,
        accuracy: 0
      };
    }
    
    byCategory[item.category].count++;
    byCategory[item.category].totalError += (item.actualMinutes - item.predictedMinutes);
  });
  
  // 정확도 계산
  Object.keys(byCategory).forEach(cat => {
    const stats = byCategory[cat];
    const avgError = stats.totalError / stats.count;
    stats.accuracy = Math.round(((stats.totalError - Math.abs(avgError)) / stats.totalError) * 100);
  });
  
  return byCategory;
}
```

### 출력 형식
```
문서 작성 | (1회 | 평균오차: -119.0분 | 정확도: -376%)
코딩     | (2회 | 평균오차: -19.0분 | 정확도: 24%)
미분류   | (2회 | 평균오차: -24.0분 | 정확도: 4%)
```

---

## 🛡️ 데이터 검증

### 입력 값 검증
```javascript
// 예측 시간 범위
const predictedMinutes = clamp(parseInt(predictedMinutesInput.value), 1, 300);

// 컨디션 점수
const conditionScore = clamp(parseInt(conditionScoreInput.value), 1, 5);

// 수면 시간
const sleepHours = clamp(parseFloat(sleepHoursInput.value), 3, 12);

// 커스텀 타이머
const customMinutes = clamp(parseInt(customMinutesInput.value), 1, 180);
```

### HTML Escaping
```javascript
// 모든 사용자 입력은 UI 렌더링 시 escapeHtml() 처리
const sanitizedTaskName = escapeHtml(taskNameInput.value);
```

---

## ⏱️ 타이머 틱(Tick) 로직

```javascript
function tick() {
  remaining--;
  
  if (remaining < 0) {
    // 세션 완료
    clearInterval(timerId);
    timerId = null;
    
    if (mode === "focus") {
      focusCount++;
      totalFocusMinutes += MODES[mode] / 60;
      streakCount++;
    } else {
      // 휴식 완료 - 스트릭 유지
    }
    
    // 다음 모드로 자동 전환
    switchMode(getNextMode());
    
  } else {
    render(); // UI 업데이트
  }
}
```

---

## 🔄 모드 전환 로직

```javascript
const modeSequence = ["focus", "shortBreak", "focus", "shortBreak", 
                      "focus", "shortBreak", "focus", "longBreak"];
let sequenceIndex = 0;

function getNextMode() {
  sequenceIndex = (sequenceIndex + 1) % modeSequence.length;
  return modeSequence[sequenceIndex];
}

function switchMode(newMode) {
  clearInterval(timerId);
  timerId = null;
  
  mode = newMode;
  remaining = MODES[mode];
  total = MODES[mode];
  
  // UI 업데이트
  modeChip.textContent = getModeLabel(mode);
  startPauseBtn.textContent = "시작";
  
  render();
}
```

---

## 📱 UI 렌더링 주기

### render() 함수 실행 시점
1. 타이머 매 초 (tick)
2. 모드 전환 시
3. 리셋 버튼 클릭
4. 커스텀 시간 적용
5. 빌드: UI 업데이트 관련 메서드 호출 시

### render() 내 작업
```javascript
function render() {
  // 1. MM:SS 형식 업데이트
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  // 2. CSS 변수 업데이트 (Ring 애니메이션)
  const remainingRatioByHour = Math.max(0, Math.min(1, remaining / RING_BASE_SECONDS));
  const ringAngle = remainingRatioByHour * 360;
  timerCard.style.setProperty("--ring-angle", `${ringAngle}deg`);
  
  // 3. 1시간 이상 배지 표시 여부
  if (remaining > 3600) {
    const overHours = Math.floor(remaining / 3600);
    const overMinutes = Math.floor((remaining % 3600) / 60);
    overHourBadge.textContent = `${overHours}:${String(overMinutes).padStart(2, '0')}`;
    overHourBadge.hidden = false;
  } else {
    overHourBadge.hidden = true;
  }
  
  // 4. 통계 UI 업데이트
  focusCountEl.textContent = focusCount;
  streakCountEl.textContent = streakCount;
  totalFocusMinutesEl.textContent = totalFocusMinutes;
}
```

---

## 📌 주요 상수

```javascript
const MODES = {
  focus: 1500,        // 25분
  shortBreak: 300,    // 5분
  longBreak: 900      // 15분
};

const RING_BASE_SECONDS = 3600;              // 60분 = 1시간 (Ring 기준)
const PREDICTION_HISTORY_LIMIT = 50;         // 최대 히스토리
const RECOMMENDED_MINUTES_MIN = 15;          // 최소 추천 시간
const RECOMMENDED_MINUTES_MAX = 90;          // 최대 추천 시간
```

---

## 📋 localStorage 키 정리

| 키 | 목적 | 만료 |
|----|------|------|
| `pomodoro_auth_token_v1` | 인증 토큰 | 수동 로그아웃 시 |
| `pomodoro_auth_state_v1` | 사용자 정보 | 수동 로그아웃 시 |
| `pomodoro_prediction_history_v1` | 예측 기록 (최대 50개) | 최대 50개 초과 시 삭제 |
| `pomodoro_daily_context_v1` | 일일 컨디션 | 자동 삭제 안함 |
| `github_copilot_token_v1` | GitHub 토큰 | 수동 삭제 전까지 |

---

## 🔐 보안 체크리스트

- ✓ XSS 방지 (escapeHtml)
- ✓ 토큰 localStorage 저장 (서버 저장 안함)
- ✓ 입력값 범위 검증 (clamp)
- ✓ 이메일 형식 검증
- ✓ HTTPS 권장 (localStorage 민감 데이터)

