# COMPONENTS.md — 컴포넌트 구조

새 컴포넌트 추가 전 읽는다.

---

## 디렉토리 구조

```
src/
  components/
    Library/
      LibraryPage.jsx        # 업로드 + 문서 카드 목록
      UploadButton.jsx
      DocumentCard.jsx
    Viewer/
      ViewerPage.jsx         # 전체 뷰어 레이아웃
      PDFRenderer.jsx        # react-pdf 렌더링
      HighlightLayer.jsx     # Canvas 하이라이트 레이어
      StandardsBadge.jsx     # 성취기준 배지 (상단)
      LockModeToggle.jsx     # 페이지 잠금 토글
    Sidebar/
      ChatPanel.jsx          # 소크라테스식 채팅
      MemoTab.jsx            # 메모 목록
    Quiz/
      QuizModal.jsx          # 퀴즈 문제 + 선택지
    Goals/
      LearningGoalModal.jsx  # 학습목표 제안 모달
    Dashboard/
      DashboardPage.jsx      # 대시보드 전체
      StandardCard.jsx       # 성취기준 카드 하나
    common/
      Button.jsx
      Badge.jsx
      Modal.jsx
      LoadingSpinner.jsx
      EmptyState.jsx         # 빈 상태 안내
  hooks/
    useStandards.js          # NCIC 매핑, standardCode 관련
    useQuiz.js               # 퀴즈 생성, 오답 기록
    useChat.js               # 소크라테스식 채팅 상태
    useDashboard.js          # Firestore 집계 쿼리
    useAnnotation.js         # 하이라이트·메모
    useDocumentList.js       # 문서 목록
    useDocumentUpload.js     # 업로드 + A 매핑 트리거
  lib/
    firebase.js              # Firebase 초기화 (단일 진입점)
    gemini.js                # Gemini API 함수 모음 (단일 진입점)
    ncicMapper.js            # NCIC JSON 룩업 유틸
  data/
    ncic_standards.json      # NCIC 성취기준 사전 빌드
  store/
    documentStore.js         # 현재 문서, standards
    annotationStore.js       # 하이라이트, 메모
    chatStore.js             # 채팅 메시지
    quizStore.js             # 퀴즈 상태, 잠금 모드
  pages/
    LibraryPage.jsx
    ViewerPage.jsx
    DashboardPage.jsx
```

---

## 상태 관리 책임 분리

| 상태 종류 | 관리 방법 |
|---|---|
| 서버 상태 (Firestore 데이터) | 커스텀 훅에서 직접 구독 |
| UI 상태 (모달 열림, 잠금 모드) | Zustand store |
| 임시 입력값 (채팅 입력창 텍스트) | 로컬 useState |

Zustand store 간 직접 참조 금지.
필요한 경우 훅에서 조합.

---

## gemini.js 함수 목록

모든 Gemini 호출은 여기서만. 컴포넌트 직접 호출 금지.

```js
export async function extractKeywordsFromPDF(text)
// → string[]  예: ["수열", "극한", "수렴"]

export async function generateLearningGoals(pageOneText, standards)
// → string[]  예: ["수열의 수렴 조건 파악", ...]

export async function generateQuiz(pageText, standardCode)
// → { question, options, answer, standard_code, explanation }
// responseMimeType: "application/json" 필수

export async function socraticChat(messages, context)
// context: { standards: string[], highlightText: string }
// → string (스트리밍 또는 일반)
```

JSON 응답 기대 함수는 반드시 `responseMimeType: "application/json"` 옵션 사용.
