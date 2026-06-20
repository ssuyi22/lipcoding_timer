# Pomodoro 앱 기능/데이터 문서

## 1. 문서 목적
이 문서는 현재 구현된 포모도로 앱의 기능과 데이터 처리 방식을 빠르게 검토하기 위한 확인용 명세서입니다.

## 2. 구현 범위 요약

### 2.1 타이머/세션 기능
- 모드: 집중, 짧은 휴식, 긴 휴식
- 동작: 시작/일시정지, 리셋, 건너뛰기
- 현재 모드 시간(분) 직접 설정 가능
- 집중 세션 완료 시 통계 업데이트

### 2.2 통계 기능
- 완료한 집중 세션 수
- 연속 완료 횟수
- 총 집중 시간(분)

### 2.3 Copilot 코치 기능
- 사용자 메시지를 서버 API로 전달
- 코치 응답을 채팅 UI에 출력
- 오류 메시지 표시

### 2.4 예측 결과 모드
- 입력 항목
  - 작업 이름
  - 카테고리
  - 예상 소요 시간(분)
  - 예상 방해 횟수
- 제어 버튼
  - 예측 세션 시작
  - 예측 세션 종료/분석
- 분석 결과
  - 판정 배지: 과소추정 / 과대추정 / 예측 정확
  - 예상 시간, 실제 시간, 오차(분)
  - 예상 방해, 실제 방해(일시정지+건너뛰기)
  - 원인 추정 문구
  - 다음 세션 권장 시간(자동 제한 적용)

### 2.5 예측 기록 누적
- 화면 표에 누적 기록 표시
- 브라우저 localStorage에 저장
- 최근 50개 기록 유지

## 3. 데이터 모델

### 3.1 예측 세션(진행 중)
```json
{
  "taskName": "기획서 초안",
  "category": "문서 작성",
  "predictedMinutes": 25,
  "predictedInterruptions": 1,
  "startedAt": 1760000000000
}
```

### 3.2 예측 기록(저장)
```json
{
  "taskName": "기획서 초안",
  "category": "문서 작성",
  "predictedMinutes": 25,
  "actualMinutes": 32,
  "diffMinutes": 7,
  "savedAt": "2026-06-20T12:34:56.000Z"
}
```

요청하신 5개 핵심 적립 항목은 아래와 같습니다.
- 작업명: taskName
- 카테고리: category
- 예측 시간: predictedMinutes
- 실제 시간: actualMinutes
- 차이: diffMinutes

참고로 savedAt(저장 시각)은 추후 정렬/분석을 위한 보조 필드입니다.

## 4. 판정/권장 시간 규칙

### 4.1 판정 배지 규칙
- deltaMinutes = actualMinutes - predictedMinutes
- deltaMinutes >= 3: 과소추정
- deltaMinutes <= -3: 과대추정
- 그 외: 예측 정확

### 4.2 권장 시간 계산
- 기본 계산
  - recommendationBase = round(actualMinutes * 0.7 + predictedMinutes * 0.3)
- 자동 제한
  - 최소 15분
  - 최대 90분
- 결과
  - recommendedMinutes = clamp(recommendationBase, 15, 90)
- UX 반영
  - 분석 완료 후 예상 시간 입력칸에 recommendedMinutes 자동 반영

## 5. 실제 방해 횟수 계산
실제 방해 횟수는 아래 합으로 계산됩니다.
- pauseCount(일시정지 횟수)
- skipCount(건너뛰기 횟수)

즉,
- actualInterruptions = pauseCount + skipCount

## 6. 저장소/제한 정책
- 저장 위치: 브라우저 localStorage
- 키: pomodoro_prediction_history_v1
- 보존 개수: 최근 50건
- 렌더링: 최신 기록이 표 상단에 표시되도록 역순 출력

## 7. 보안/안정성 처리
- 예측 결과/기록 표를 innerHTML로 렌더링할 때 문자열 이스케이프 처리
- 작업명/카테고리 등 사용자 입력값에 대해 HTML 인젝션 완화

## 8. 사용자 확인 체크리스트
아래 항목을 체크해주시면 다음 수정을 정확히 반영할 수 있습니다.

1. 판정 기준 임계값(현재 ±3분)이 적절한지
2. 권장 시간 제한 범위(현재 15~90분)가 적절한지
3. 권장 시간 가중치(실제 70%, 예측 30%)를 유지할지
4. 기록 보관 개수(현재 50개)를 늘릴지
5. 카테고리 목록을 자유입력으로 둘지, 선택형으로 바꿀지
6. 기록에 저장 시각(savedAt) 표시가 필요한지

## 9. 수정 제안 슬롯(작성용)
아래 형식으로 주시면 바로 반영 가능합니다.

- 변경 요청 1:
  - 대상:
  - 현재:
  - 변경:
  - 이유:

- 변경 요청 2:
  - 대상:
  - 현재:
  - 변경:
  - 이유:

## 10. 코드 위치
- UI 구조: /Users/suni/pomodoro-webapp/index.html
- 스타일: /Users/suni/pomodoro-webapp/assets/styles.css
- 로직/데이터 저장: /Users/suni/pomodoro-webapp/assets/app.js
