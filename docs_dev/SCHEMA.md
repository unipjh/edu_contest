# SCHEMA.md - Firestore 스키마

DB 읽기/쓰기 로직을 바꿀 때는 이 문서를 먼저 갱신한 뒤 구현한다.

## 컬렉션 구조

```text
users/
  {uid}/
    learningElements:
      concepts: string[]
      weakPoints: string[]
      strongPoints: string[]
      generatedAt: timestamp
    weakStandards/
      {standardCode}/
        count: number
        lastFailed: timestamp

documents/
  {docId}/
    uid: string
    title: string
    storageUrl: string
    storagePath: string
    standards: string[]
    standardTargets: Array<{
      id: string
      standardCode: string
      title: string
      description: string
      criteria: string[]
      keywords: string[]
      score: number
      matchedTerms: string[]
    }>
    subject: string
    grade: string
    unit: string
    learningGoals: string[]
    pageTexts: string[]
    pageCount: number
    createdAt: timestamp

highlights/
  {highlightId}/
    docId: string
    uid: string
    text: string
    memo: string
    color: "important" | "unclear" | "memorize" | string
    page: number
    standardCode: string
    createdAt: timestamp

chatHistory/
  {chatId}/
    docId: string
    uid: string
    standardCode: string
    question: string
    answer: string
    contextText: string
    createdAt: timestamp

quizHistory/
  {quizId}/
    docId: string
    uid: string
    standardCode: string
    question: string
    options: string[]
    answer: number | boolean
    selectedAnswer: number | boolean | null
    isCorrect: boolean | null     # null이면 생성만 되고 아직 풀지 않은 퀴즈
    explanation: string
    mode: "quiz" | "ox-gate"
    scope: "page" | "document"
    page: number | null
    setId: string | null          # 한 번 생성된 퀴즈 단위를 묶는 키
    setTitle: string
    setSize: number
    sequence: number
    createdAt: timestamp
    answeredAt: timestamp
```

## 쿼리 패턴

```js
// 문서 목록
documents where uid == {uid}

// 문서별 메모
highlights where docId == {docId} and uid == {uid}

// 문서별 채팅
chatHistory where docId == {docId} and uid == {uid}

// 문서별 생성/풀이 퀴즈
quizHistory where docId == {docId} and uid == {uid}

// 사용자 취약 성취기준
users/{uid}/weakStandards
```
