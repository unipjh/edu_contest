# SPEC.md — 사용자 플로우 + 기능 명세

기능 구현 전 반드시 읽는다.

---

## 전체 사용자 플로우

```
[라이브러리]   PDF 업로드
      ↓
[구조화 - A]   성취기준 자동 매핑 (Gemini + NCIC JSON)
               → Firestore 저장 + 뷰어 상단 배지 표시
      ↓
[뷰어 진입 - B] 학습목표 모달 (최초 1회, 건너뛰기 불가)
               → 확인 후 학습 시작
      ↓
[읽기 - C]     하이라이트 + 메모
               페이지 이동 시 퀴즈 (잠금 모드 ON일 때)
               오답 → weakStandards 카운터 +1
      ↓
[채팅 - D]     하이라이트 선택 → 채팅 전송
               AI 역질문 → 학생 답변 → AI 보완 설명
               답변 하단: 성취기준 코드 + 에듀넷 링크
      ↓
[대시보드 - E] 성취기준 단위 카드 목록
               취약 카드 클릭 → 에듀넷 자료 바로가기
      ↓
[루프]         다음 자료 업로드 → 성취기준 카드에 누적
```

---

## 기능 명세

### A. 성취기준 자동 매핑 (PHASE 1 — 가장 먼저)

B~E의 데이터 기반. A 없이 나머지 작동 불가.

- **트리거**: PDF 업로드 완료 직후 자동
- **처리 순서**:
  1. pdf.js로 텍스트 추출 (첫 3페이지 또는 최대 2000자)
  2. `gemini.extractKeywordsFromPDF(text)` 호출 → 키워드 배열 반환
  3. `ncicMapper.findStandards(keywords)` → 성취기준 코드 배열
  4. Firestore `documents/{docId}` 업데이트: `standards`, `subject`, `grade`, `unit`
- **출력**: 뷰어 상단 배지 (`고1 · 수학 II · 수열`)
- **실패 시**: `standards: []`, 배지에 "과목 불명확" 표시. 앱 크래시 금지

---

### B. 학습목표 제안 (PHASE 2)

- **트리거**: 뷰어 진입 시, `learningGoals` 필드가 비어있을 때 1회
- **처리**: `gemini.generateLearningGoals(pageOneText, standards)` → 목표 3개
- **UX**: 모달. 건너뛰기 없음. 확인 또는 직접 수정 후 닫기
- **저장**: `documents/{docId}.learningGoals: string[]`

---

### C. 성취기준 기반 퀴즈 + 페이지 잠금 (PHASE 2)

- **트리거**: 페이지 이동 버튼 클릭 (잠금 모드 ON)
- **퀴즈 생성**: `gemini.generateQuiz(pageText, standardCode)` → JSON
- **Gemini 응답 형식**:
  ```json
  {
    "question": "질문",
    "options": ["①", "②", "③", "④"],
    "answer": 2,
    "standard_code": "10수학02-01",
    "explanation": "오답 시 설명"
  }
  ```
- **오답 처리**: `users/{uid}/weakStandards/{code}.count` +1, `quizHistory` 저장
- **잠금 모드**: 기본 OFF, 뷰어 상단 토글, localStorage 유지

---

### D. 소크라테스식 채팅 (PHASE 3)

기존 ChatPanel의 **시스템 프롬프트 수정**으로 구현. 새 컴포넌트 불필요.

**시스템 프롬프트**:
```
당신은 소크라테스식 학습 보조 AI입니다.
학생이 개념 설명을 요청하면 즉시 답하지 마세요.
먼저 "이 개념에 대해 지금 어떻게 이해하고 있어? 한 문장으로 말해봐"라고 질문하세요.
학생이 답하면, 틀린 부분을 교정하고 보완 설명을 제공하세요.
답변 마지막에는 반드시 포함:
  📌 근거: [성취기준 코드] {단원명}
  🔗 공식 자료: {에듀넷 검색 URL}
학생이 "그냥 설명해줘"라고 하면 즉시 답해도 됩니다.
```

**채팅 컨텍스트**: 현재 문서의 `standards[]`, 선택된 하이라이트 텍스트

---

### E. 학습 상태 대시보드 (PHASE 4)

신규 API 없음. Firestore 집계만으로 구현.

- **데이터 소스**: `users/{uid}/weakStandards` + `highlights` + `chatHistory`
- **카드 하나의 데이터**:
  ```
  성취기준 코드 + 단원명 (ncic_standards.json 룩업)
  하이라이트 수: highlights에서 standardCode 일치 count
  퀴즈 오답 수: weakStandards/{code}.count
  채팅 횟수: chatHistory에서 standardCode 일치 count
  ```
- **카드 상태**:
  - 오답 1회 이상 → 빨간 테두리 (취약)
  - 하이라이트 3개 이상 + 오답 없음 → 초록 (이해 중)
  - 그 외 → 회색
- **취약 카드 클릭**:
  ```
  https://www.edunet.net/nedu/search/searchList.do?query={단원명}
  ```

---

## 시연 체크리스트 (제출 전 전체 통과 확인)

```
[ ] A: PDF 업로드 → 성취기준 배지가 10초 이내 표시
[ ] B: 뷰어 진입 → 학습목표 모달 자동 표시
[ ] C: 잠금 모드 ON → 페이지 이동 시 퀴즈 출제
[ ] D: 채팅 입력 → AI 역질문 → 성취기준 근거 포함 답변
[ ] E: 대시보드 → 카드 표시, 취약 카드 빨간 테두리
[ ] 루프: A→B→C→D→E 단일 PDF로 끊김 없이 진행
[ ] 영속성: 새로고침 후 모든 데이터 유지
```
