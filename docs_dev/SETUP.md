# SETUP.md — 초기 환경 세팅

빈 디렉토리에서 시작할 때 이 파일 순서대로 진행한다.

---

## 1. 프로젝트 초기화

```bash
npm create vite@latest co-study-contest -- --template react
cd co-study-contest
npm install
```

**추가 패키지**:
```bash
npm install firebase zustand react-pdf pdfjs-dist
npm install react-router-dom
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

## 2. Firebase 새 프로젝트 세팅

1. https://console.firebase.google.com → 새 프로젝트 생성
2. Authentication → 이메일/비밀번호 로그인 활성화
3. Firestore Database → 프로덕션 모드로 생성
4. Storage → 기본 설정으로 생성
5. 프로젝트 설정 → 웹 앱 추가 → SDK 설정 값 복사

**Firestore 보안 규칙**:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /documents/{docId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == resource.data.uid;
    }
    match /highlights/{id} {
      allow read, write: if request.auth != null
                         && request.auth.uid == resource.data.uid;
    }
    match /chatHistory/{id} {
      allow read, write: if request.auth != null
                         && request.auth.uid == resource.data.uid;
    }
    match /quizHistory/{id} {
      allow read, write: if request.auth != null
                         && request.auth.uid == resource.data.uid;
    }
    match /users/{uid} {
      allow read, write: if request.auth != null
                         && request.auth.uid == uid;
    }
  }
}
```

---

## 3. 환경변수 (.env.local)

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GEMINI_API_KEY=
```

Gemini API 키: https://aistudio.google.com/app/apikey

---

## 4. NCIC JSON 빌드

`docs/NCIC_BUILD.md` 참고. 빌드 결과를 `src/data/ncic_standards.json`에 저장.

---

## 5. Vercel 배포

```bash
npm install -g vercel
vercel
```

환경변수를 Vercel 대시보드에도 동일하게 입력.

---

## 6. 초기 디렉토리 세팅 순서

```
1. src/data/ncic_standards.json 배치 (NCIC_BUILD.md 참고)
2. src/lib/firebase.js 작성
3. src/lib/gemini.js 작성 (함수 시그니처만 먼저)
4. src/lib/ncicMapper.js 작성
5. PHASE 1 시작 (SPEC.md 참고)
```
