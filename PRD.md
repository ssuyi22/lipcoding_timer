# PRD - Pomodoro Focus Timer

## 1. Product Summary
Pomodoro Focus Timer는 짧은 집중/휴식 루프를 통해 사용자의 작업 지속력과 실행률을 높이는 웹 앱이다. 기본 타이머 기능에 더해, 예측-실측 비교, 개인 컨디션 기반 추천 루틴, AI 피드백을 제공한다.

## 2. Problem Statement
사용자는 다음 문제를 반복적으로 겪는다.
- 작업 시간을 과대/과소 추정한다.
- 중단(방해) 패턴을 정량적으로 추적하지 못한다.
- 컨디션이 다른 날에도 동일한 루틴을 적용해 효율이 낮아진다.

## 3. Target Users
- 학생, 개발자, 지식노동자
- 짧은 집중 세션으로 생산성을 관리하려는 사용자
- 계획 대비 실제 수행 결과를 데이터로 개선하고 싶은 사용자

## 4. Product Goals
- 포모도로 루틴 실행율 향상
- 예측 시간 대비 실제 시간 오차 감소
- 개인 컨디션에 맞는 집중 루틴 추천

## 5. Non-Goals
- 팀 협업/프로젝트 관리 SaaS 대체
- 고도화된 캘린더 통합
- 장기 리포팅 BI 시스템

## 6. Core Features (Source of Truth)
### 6.1 Timer Modes
- Focus: 25분
- Short Break: 5분
- Long Break: 15분

### 6.2 Visual Ring Timer
- 원형 진행도(60분 기준 스케일)
- 시작점은 12시 방향의 "60" 마커
- 남은 시간 비율에 따라 각도 업데이트

### 6.3 Controls
- 시작/일시정지
- 리셋
- 건너뛰기
- 현재 모드 커스텀 시간(분) 적용

### 6.4 Daily Stats
- 완료한 집중 세션 수
- 연속 완료(streak)
- 총 집중 시간(분)

### 6.5 Authentication and Plans
- 이메일 기반 로그인/회원가입
- Free / Premium 접근 제어

### 6.6 Prediction Mode (Premium)
- 작업명, 카테고리, 예상 소요 시간, 예상 방해 횟수 입력
- 세션 종료 시 실제 소요 시간 기록
- 예측 대비 오차 및 기록 누적

### 6.7 Personalization (Premium)
- 수면 시간, 컨디션 점수, 외부 일정 강도 입력
- 권장 집중 시간 및 루틴 안내

### 6.8 AI Analysis (Premium)
- Copilot SDK 기반 분석 옵션
- 예측 정확도 및 패턴 피드백 제공

### 6.9 History and Export
- 예측 기록 누적 저장
- CSV 내보내기

## 7. User Flow
1. 사용자 로그인(선택)
2. 모드 선택 후 타이머 시작
3. 세션 완료/리셋/건너뛰기 수행
4. (Premium) 예측 세션 시작 → 종료/분석
5. 누적 기록 확인 및 CSV 내보내기

## 8. Success Metrics
- D1 재방문율
- 세션 완료율
- 예측 오차 평균 절대값(MAE)
- Premium 기능 사용률

## 9. Technical Scope
- Frontend: HTML/CSS/Vanilla JS
- Backend: Node.js (Express)
- Data: browser localStorage + server API
- Deployment target: Azure Container Apps (koreacentral)

## 10. Constraints
- 브라우저 기반 앱으로 네이티브 기능 제한
- 일부 AI 기능은 토큰/인증 상태에 의존
- 배포 시 컨테이너 빌드 환경(Docker/ACR 정책)에 영향받음

## 11. Current Production URL
- https://pomodoro-webapp.purplestone-169714be.koreacentral.azurecontainerapps.io/

## 12. Versioning
- PRD version: 1.0
- Updated: 2026-06-20
