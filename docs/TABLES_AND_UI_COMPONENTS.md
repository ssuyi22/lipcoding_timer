# Pomodoro Timer - 테이블 및 UI 컴포넌트 정리

## 📊 모든 데이터 테이블 목록

---

## 1️⃣ 오늘 통계 테이블 (Today Statistics)

### 위치
메인 페이지 우측 상단, "오늘 통계" 섹션

### HTML 구조
```html
<section class="card stats">
  <h2>오늘 통계</h2>
  <div class="stats-grid">
    <div><span id="focusCount">0</span><small>완료한 집중 세션</small></div>
    <div><span id="streakCount">0</span><small>연속 완료</small></div>
    <div><span id="totalFocusMinutes">0</span><small>총 집중 시간(분)</small></div>
  </div>
  <div id="authStatus" class="auth-status">현재 상태: 무료 모드</div>
</section>
```

### 테이블 구조

| 지표 | HTML ID | 초기값 | 데이터 타입 | 갱신 조건 |
|------|---------|--------|-----------|---------|
| **완료한 집중 세션** | `focusCount` | 0 | number | 집중 모드 완료 시 +1 |
| **연속 완료** | `streakCount` | 0 | number | 휴식 건너뛰면 리셋 |
| **총 집중 시간(분)** | `totalFocusMinutes` | 0 | number | 집중 완료 시 +25 |

### 스타일
- 레이아웃: 3열 그리드 (flex)
- 각 항목: `<span>` 숫자 + `<small>` 라벨
- 폰트: 큰 숫자 + 작은 라벨

### 데이터 저장
```javascript
// sessionStorage (일별 초기화)
sessionStorage.setItem('focusCount', focusCount);
sessionStorage.setItem('streakCount', streakCount);
sessionStorage.setItem('totalFocusMinutes', totalFocusMinutes);
```

---

## 2️⃣ 예측 기록 테이블 (Prediction History)

### 위치
메인 페이지 하단, "예측 기록(누적)" 섹션

### HTML 구조
```html
<table class="prediction-history-table" role="table" aria-label="예측 기록 표">
  <thead>
    <tr>
      <th>작업명</th>
      <th>카테고리</th>
      <th>예측 시간</th>
      <th>실제 시간</th>
      <th>차이</th>
      <th>AI 분석</th>
    </tr>
  </thead>
  <tbody id="predictionHistoryBody">
    <!-- 동적 생성 -->
  </tbody>
</table>
```

### 테이블 구조

| 컬럼 | 데이터 타입 | 범위 | 설명 | 저장 경로 |
|------|-----------|------|------|---------|
| **작업명** | string | - | 사용자 입력 작업 이름 | `taskName` |
| **카테고리** | string | - | 작업 분류 (사용자 정의) | `category` |
| **예측 시간** | number | 1~300분 | 사용자 입력 예상 시간 | `predictedMinutes` |
| **실제 시간** | number | 0~∞ | 실제 소요 시간 (분) | `actualMinutes` |
| **차이** | number (계산값) | -∞~∞ | 실제 - 예측 | `difference` |
| **AI 분석** | string | - | Copilot 분석 결과 또는 "규칙" | `aiAnalysis` |

### 예시 데이터

| 작업명 | 카테고리 | 예측 시간 | 실제 시간 | 차이 | AI 분석 |
|--------|---------|---------|---------|------|--------|
| 알고리즘 문제 풀이 | 코딩 | 15분 | 1분 | -14분 | 규칙 |
| 이름 없는 작업 | 미분류 | 25분 | 1분 | -24분 | 규칙 |
| 기획서 초안 | 문서 작성 | 120분 | 1분 | -119분 | 규칙 |
| 코딩 작업 | 코딩 | 25분 | 1분 | -24분 | 규칙 |

### 데이터 저장
```javascript
// localStorage: pomodoro_prediction_history_v1
[
  {
    "taskName": "알고리즘 문제 풀이",
    "category": "코딩",
    "predictedMinutes": 15,
    "actualMinutes": 1,
    "difference": -14,
    "aiAnalysis": "규칙",
    "timestamp": 1718841600000
  }
]
```

### 제약 조건
- 최대 50개 기록 유지 (초과 시 가장 오래된 항목 삭제)
- 시간순 정렬 (최신 순서)

---

## 3️⃣ 카테고리별 통계 테이블 (Category Statistics)

### 위치
메인 페이지 하단, "카테고리별 통계" 섹션

### HTML 구조
```html
<div id="categoryStats" class="category-stats">
  <h4>카테고리별 통계</h4>
  <div id="categoryStatsContent">
    <!-- 동적 생성 -->
  </div>
</div>
```

### 테이블 구조

| 카테고리 | 회수 | 평균오차(분) | 정확도(%) |
|---------|------|-----------|---------|
| 문서 작성 | 1 | -119.0 | -376% |
| 코딩 | 2 | -19.0 | 24% |
| 미분류 | 2 | -24.0 | 4% |

### 계산 공식
```javascript
// 회수
회수 = COUNT(category에서 같은 항목)

// 평균오차
평균오차 = SUM(차이) / 회수
       = SUM(실제 - 예측) / 회수

// 정확도
정확도(%) = (예측값 - |평균오차|) / 예측값 × 100
         = (예측값 - 절댓값(평균오차)) / 예측값 × 100
```

### 예시 계산
**코딩 카테고리**:
- 기록 1: 예측 15분, 실제 1분, 차이 -14분
- 기록 2: 예측 25분, 실제 1분, 차이 -24분
- 회수: 2
- 평균오차: (-14 + -24) / 2 = -19.0분
- 정확도: (20 - 19) / 20 × 100 = 5% (근사)

### 렌더링 로직
```javascript
function renderCategoryStats() {
  const history = loadPredictionHistory();
  const categories = {};
  
  // 카테고리별 집계
  history.forEach(record => {
    if (!categories[record.category]) {
      categories[record.category] = [];
    }
    categories[record.category].push(record);
  });
  
  // 테이블 생성
  let html = '';
  Object.entries(categories).forEach(([cat, records]) => {
    const count = records.length;
    const totalError = records.reduce((sum, r) => sum + (r.difference || 0), 0);
    const avgError = totalError / count;
    const accuracy = Math.round(((avgError - Math.abs(avgError)) / avgError) * 100);
    
    html += `
      <div class="category-row">
        <strong>${escapeHtml(cat)}</strong>
        <span>(${count}회 | 평균오차: ${avgError.toFixed(1)}분 | 정확도: ${accuracy}%)</span>
      </div>
    `;
  });
  
  categoryStatsContent.innerHTML = html;
}
```

---

## 4️⃣ 모드 선택 버튼 그룹

### 위치
타이머 섹션 상단, 3개 모드 버튼

### HTML 구조
```html
<div class="mode-row">
  <button class="mode-btn active" data-mode="focus">집중</button>
  <button class="mode-btn" data-mode="shortBreak">짧은 휴식</button>
  <button class="mode-btn" data-mode="longBreak">긴 휴식</button>
</div>
```

### 버튼 데이터

| 모드 이름 | data-mode | 시간 | 색상 | 기본 상태 |
|---------|----------|------|------|---------|
| **집중** | focus | 25분 | 빨강 | active |
| **짧은 휴식** | shortBreak | 5분 | 파랑 | inactive |
| **긴 휴식** | longBreak | 15분 | 초록 | inactive |

### 스타일
- 폭: 각 25% (3열 등분)
- 높이: 48px 이상
- 활성 상태: `.active` 클래스 (배경색 진함)
- 비활성: 투명 배경

---

## 5️⃣ 타이머 컨트롤 버튼 레이아웃

### 위치
타이머 환 우측, 수직 배치

### HTML 구조
```html
<div class="timer-actions-layout">
  <div class="controls controls-left">
    <button id="startPauseBtn" class="primary">시작</button>
    <button id="resetBtn" class="ghost">리셋</button>
  </div>
  
  <div class="controls controls-right">
    <button id="skipBtn" class="ghost">건너뛰기</button>
    <div class="custom-time-row compact">
      <label for="customMinutesInput">현재 모드 시간(분)</label>
      <input id="customMinutesInput" type="number" min="1" max="180" value="25" />
      <button id="applyCustomMinutesBtn" class="ghost">적용</button>
    </div>
  </div>
</div>
```

### 버튼 사양

| 버튼 ID | 텍스트 | 스타일 | 너비 | 상태 변화 |
|---------|--------|--------|------|---------|
| `startPauseBtn` | "시작" / "일시정지" | primary (파랑) | 140px | 토글 |
| `resetBtn` | "리셋" | ghost (흰색) | 140px | 고정 |
| `skipBtn` | "건너뛰기" | ghost (흰색) | 140px | 고정 |
| `applyCustomMinutesBtn` | "적용" | ghost (흰색) | 140px | 고정 |

### 커스텀 시간 입력

| 속성 | 값 | 설명 |
|------|-----|------|
| **ID** | `customMinutesInput` | 입력 필드 |
| **타입** | number | 숫자만 입력 |
| **최소값** | 1 | 1분 |
| **최대값** | 180 | 3시간 |
| **스텝** | 1 | 1분 단위 |
| **기본값** | 25 | 집중 모드 시간 |

---

## 6️⃣ 예측 입력 폼 (Prediction Input Form)

### 위치
메인 페이지 중단, "예측 결과 모드" 섹션

### HTML 구조
```html
<div class="prediction-grid">
  <div class="field">
    <label for="taskNameInput">작업 이름</label>
    <input id="taskNameInput" type="text" placeholder="예: 발표 자료 1차 완성" />
  </div>
  <div class="field">
    <label for="taskCategoryInput">카테고리</label>
    <input id="taskCategoryInput" type="text" placeholder="예: 문서 작성" />
  </div>
  <div class="field">
    <label for="predictedMinutesInput">예상 소요 시간(분)</label>
    <input id="predictedMinutesInput" type="number" min="1" max="300" value="25" />
  </div>
  <div class="field">
    <label for="predictedInterruptionsInput">예상 방해 횟수</label>
    <input id="predictedInterruptionsInput" type="number" min="0" max="20" value="0" />
  </div>
</div>
```

### 입력 필드 사양

| 필드 ID | 라벨 | 타입 | 최소 | 최대 | 기본값 | 필수 |
|---------|------|------|------|------|--------|------|
| `taskNameInput` | 작업 이름 | text | - | - | "" | YES |
| `taskCategoryInput` | 카테고리 | text | - | - | "" | YES |
| `predictedMinutesInput` | 예상 소요 시간(분) | number | 1 | 300 | 25 | YES |
| `predictedInterruptionsInput` | 예상 방해 횟수 | number | 0 | 20 | 0 | NO |

---

## 7️⃣ 컨디션 개인화 폼 (Personalization Panel)

### 위치
"예측 결과 모드" 섹션 내 중단부

### HTML 구조
```html
<div class="personalization-panel">
  <h3>전용 집중 루틴 엔진</h3>
  <p class="subtitle">오늘 컨디션 기준 자동 추천.</p>
  <div class="personal-grid">
    <div class="field">
      <label for="sleepHoursInput">수면 시간(시간)</label>
      <input id="sleepHoursInput" type="number" min="3" max="12" step="0.5" value="7" />
    </div>
    <div class="field">
      <label for="conditionScoreInput">컨디션 점수(1~5)</label>
      <input id="conditionScoreInput" type="range" min="1" max="5" value="3" />
      <span id="conditionScoreText">중간</span>
    </div>
    <div class="field">
      <label for="scheduleLoadInput">외부 일정 강도</label>
      <select id="scheduleLoadInput">
        <option value="여유">여유</option>
        <option value="보통" selected>보통</option>
        <option value="바쁨">바쁨</option>
      </select>
    </div>
  </div>
</div>
```

### 입력 필드 사양

| 필드 ID | 라벨 | 타입 | 범위 | 기본값 | 설명 |
|---------|------|------|------|--------|------|
| `sleepHoursInput` | 수면 시간(시간) | number | 3~12 | 7 | 0.5시간 단위 |
| `conditionScoreInput` | 컨디션 점수(1~5) | range | 1~5 | 3(중간) | 1=매우피곤, 5=최고조 |
| `scheduleLoadInput` | 외부 일정 강도 | select | 여유/보통/바쁨 | 보통 | 3가지 옵션 |

### 조건 점수 매핑
```javascript
const scoreLabels = {
  1: "매우 피곤",
  2: "피곤",
  3: "중간",
  4: "좋음",
  5: "최고조"
};
```

### 출력 (권장 루틴)
```javascript
// 자동으로 계산되는 값들
{
  "recommendedMinutes": 15,        // 권장 집중 시간 (분)
  "allowedInterruptions": 2,       // 예상 방해 허용치 (회)
  "verticalRoutine": "준비 3분 → 딥워크 10분 → 정리 2분",
  "beforeFocusTips": "알림 차단, 단일 창 유지, 완료 기준 1줄 정의",
  "conditionNotes": "수면 7시간 / 컨디션 매우 피곤 (1) / 일정 보통",
  "accumulatedPattern": "평균 오차 -41.0분, 평균 방해 0.2회"
}
```

---

## 8️⃣ AI 분석 및 토큰 관리 섹션

### 토큰 상태 알림

```html
<div id="tokenStatusAlert" class="token-status-alert" style="display:none;">
  <strong>⚠️ 토큰 미설정:</strong> AI 분석 기능을 사용하려면 아래에서 GitHub 토큰을 입력해주세요.
  <div class="token-input-section" style="margin-top: 12px;">
    <input id="githubTokenInput" type="password" placeholder="GitHub Personal Access Token" />
    <button id="saveTokenBtn" class="primary">토큰 저장</button>
  </div>
</div>
```

### AI 분석 옵션 체크박스

```html
<div class="ai-analysis-option">
  <input id="useAiAnalysisCheck" type="checkbox" checked />
  <label for="useAiAnalysisCheck">Copilot SDK AI 분석 사용</label>
</div>
```

---

## 9️⃣ 세션 상태 표시 (Auth Status)

### HTML 구조
```html
<div id="authStatus" class="auth-status" aria-live="polite">
  현재 상태: 유료 로그인 (user@example.com) · 백업 동기화 사용
</div>
```

### 표시 형식

| 상태 | 표시 텍스트 |
|------|-----------|
| 무료 사용자 | "현재 상태: 무료 모드" |
| 유료 사용자 | "현재 상태: 유료 로그인 (user@example.com) · 백업 동기화 사용" |
| 로그인 중 | "로그인 중..." |
| 로그아웃 후 | "로그아웃 되었습니다" |

---

## 📋 전체 테이블 요약

| # | 테이블명 | 위치 | 컬럼 수 | 데이터 소스 | 갱신 빈도 |
|----|---------|------|--------|-----------|---------|
| 1 | 오늘 통계 | 우측 상단 | 3 | sessionStorage | 실시간 |
| 2 | 예측 기록 | 하단 | 6 | localStorage | 세션 종료 시 |
| 3 | 카테고리별 통계 | 하단 | 4 | localStorage (계산) | 수동 갱신 |
| 4 | 모드 버튼 | 상단 | 3 | 고정 | N/A |
| 5 | 컨트롤 버튼 | 우측 | 4 | 고정 | 상태 변화 시 |
| 6 | 예측 입력 폼 | 중단 | 4 | 사용자 입력 | 사용자 입력 시 |
| 7 | 컨디션 폼 | 중단 | 3 | 사용자 입력 | 사용자 입력 시 |
| 8 | 토큰 관리 | 중단 | 1 | localStorage | 수동 설정 |
| 9 | 상태 표시 | 우측 | 1 | Auth 정보 | 로그인/로그아웃 시 |

---

## 🔗 테이블 간 데이터 흐름

```
사용자 입력 (예측 폼)
    ↓
예측 세션 시작
    ↓
실제 시간 소요
    ↓
예측 세션 종료
    ↓
계산: 차이 = 실제 - 예측
    ↓
저장: localStorage
    ↓
렌더링: 예측 기록 테이블 ← 데이터
    ↓
계산: 카테고리별 통계
    ↓
렌더링: 카테고리별 통계 테이블
```

