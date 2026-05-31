# INPUT_GUIDE.md — Claude Code 시작 시 입력할 것들

빈 디렉토리에서 Claude Code를 시작할 때,
어떤 파일을 어디에 넣고 무엇을 직접 입력해야 하는지 정리.

---

## 파일로 제공할 것 (디렉토리에 배치)

| 파일 | 위치 | 내용 | 준비 방법 |
|---|---|---|---|
| `CLAUDE.md` | 프로젝트 루트 | Claude Code 핵심 지침 | 이 패키지의 CLAUDE.md 그대로 |
| `docs/CONTEXT.md` | `docs/` | 공모전 배경·문제정의 | 이 패키지의 파일 그대로 |
| `docs/SPEC.md` | `docs/` | 사용자 플로우·기능 명세 | 이 패키지의 파일 그대로 |
| `docs/SCHEMA.md` | `docs/` | Firestore 스키마 | 이 패키지의 파일 그대로 |
| `docs/COMPONENTS.md` | `docs/` | 컴포넌트 구조 | 이 패키지의 파일 그대로 |
| `docs/SETUP.md` | `docs/` | 환경 세팅 가이드 | 이 패키지의 파일 그대로 |
| `docs/NCIC_BUILD.md` | `docs/` | NCIC JSON 빌드 가이드 | 이 패키지의 파일 그대로 |
| `src/data/ncic_standards.json` | `src/data/` | NCIC 성취기준 데이터 | **직접 빌드 필요** (아래 참고) |
| `.env.local` | 루트 | Firebase + Gemini API 키 | **직접 입력 필요** (아래 참고) |

---

## 직접 입력할 것

### 1. .env.local — API 키

Firebase 콘솔과 Google AI Studio에서 발급 후 직접 입력.
`docs/SETUP.md` 2~3번 항목 참고.

```
VITE_FIREBASE_API_KEY=         ← Firebase 콘솔에서 복사
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GEMINI_API_KEY=           ← aistudio.google.com에서 발급
```

### 2. ncic_standards.json — 성취기준 데이터

`docs/NCIC_BUILD.md` 참고해서 직접 빌드.
MVP 범위(수학II, 국어, 통합과학 고1)만 먼저 만들어도 충분.

빠른 방법: NCIC 사이트에서 텍스트 복사 → Gemini에게 JSON 변환 요청
(NCIC_BUILD.md의 "방법 2" 참고)

---

## Claude Code 첫 메시지 템플릿

디렉토리 세팅 완료 후 Claude Code에게 보낼 첫 메시지:

```
CLAUDE.md와 docs/ 아래 모든 문서를 읽어줘.

읽은 후 아래 순서로 시작해:
1. docs/SETUP.md 6번 항목 순서대로 초기 파일 구조 생성
2. src/lib/firebase.js 작성
3. src/lib/ncicMapper.js 작성 (docs/NCIC_BUILD.md 참고)
4. src/lib/gemini.js 함수 시그니처 작성
5. PHASE 1 시작: PDF 업로드 → 성취기준 매핑 (docs/SPEC.md 기능 A 참고)

각 단계 완료 후 다음 단계 시작 전 나에게 확인 요청해줘.
```

---

## 단계별 확인 포인트

각 PHASE 완료 후 Claude Code에게 확인할 것:

| PHASE | 확인 방법 |
|---|---|
| 1 (A 완성) | 테스트 PDF 업로드 → 성취기준 배지 표시 확인 |
| 2 (B·C 완성) | 뷰어 진입 → 모달 확인, 잠금 모드 ON → 퀴즈 확인 |
| 3 (D 완성) | 채팅 입력 → 역질문 확인, 성취기준 코드 답변 포함 확인 |
| 4 (E 완성) | 대시보드 탭 → 카드 표시, 취약 카드 빨간 테두리 확인 |
| 5 (시연) | `docs/SPEC.md` 시연 체크리스트 7개 전부 통과 확인 |

---

## 참고: Notion 원본 문서 링크

설계 판단이 필요할 때 원본 맥락 확인:
- S7~S10 구체화: https://www.notion.so/370c20b3255e818bb541caf0959fbcf6
- 사용자 플로우·기능 명세: https://www.notion.so/370c20b3255e8191a9b5c7b2907d611a
