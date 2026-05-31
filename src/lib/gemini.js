import { getEdunetUrl, getStandardByCode } from './ncicMapper.js'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const MODEL = 'gemini-2.0-flash'

async function callGemini(prompt, { json = false } = {}) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API 키가 설정되지 않았습니다.')
  }

  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 30000)

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: json ? { responseMimeType: 'application/json' } : undefined,
      }),
    },
  ).finally(() => globalThis.clearTimeout(timeoutId))

  if (!response.ok) {
    throw new Error(`Gemini 요청 실패: ${response.status}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text).join('').trim() || ''
}

function parseJson(text, fallback) {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/)
    if (!match) return fallback
    try {
      return JSON.parse(match[0])
    } catch {
      return fallback
    }
  }
}

export async function extractKeywordsFromPDF(text) {
  const prompt = `
다음 학습자료 텍스트에서 교육과정 관련 핵심 키워드를 5~15개 추출해줘.
규칙:
- 단원명이나 챕터 제목(예: "수열의 극한", "미분법")과 핵심 교과 개념(예: "미분계수", "도함수")을 모두 포함해줘.
- 여러 단원을 다루는 자료라면 각 단원의 키워드를 빠짐없이 포함해줘.
- 한국 고등학교 교과 개념 위주로 고르고 JSON 배열로만 답해.
예: ["수열의 극한", "수렴", "발산", "등비수열", "미분계수", "도함수"]

텍스트:
${String(text || '').slice(0, 4000)}
`
  const result = await callGemini(prompt, { json: true })
  const keywords = parseJson(result, [])
  return Array.isArray(keywords) ? keywords.map(String).slice(0, 15) : []
}

export async function generateLearningGoals(pageOneText, standards, standardTargets = []) {
  const targetBlock = standardTargets.length
    ? standardTargets
        .slice(0, 6)
        .map((target) => `- [${target.standardCode}] ${target.title}: ${target.description}`)
        .join('\n')
    : '매핑된 이해 단위 없음'
  const prompt = `
다음 PDF 첫 페이지, 성취기준, 이해 단위를 바탕으로 학생이 읽기 전에 확인할 학습목표 3개를 JSON 배열로 작성해줘.
문장은 짧고 관찰 가능한 행동으로 써줘. 가능하면 성취기준보다 더 구체적인 이해 단위(예: 등차수열의 구조, 도함수의 뜻)를 반영해줘.

성취기준: ${standards.join(', ') || '미확인'}
매핑된 이해 단위:
${targetBlock}
자료:
${String(pageOneText || '').slice(0, 2000)}
`
  const result = await callGemini(prompt, { json: true })
  const goals = parseJson(result, [])
  return Array.isArray(goals) ? goals.map(String).slice(0, 3) : []
}

export async function generateOxQuestion(pageText, pageNumber, standards) {
  const prompt = `
학생이 ${pageNumber}페이지를 읽었는지 빠르게 확인하는 O/X 사실 질문을 1개 만들어줘.
정답은 반드시 true 또는 false로 넣고, 단순 암기보다 핵심 이해를 확인하게 해줘.

JSON 객체로만 답해:
{
  "statement": "O/X로 판단할 문장",
  "answer": true,
  "explanation": "정답 이유를 2문장 이내로 설명"
}

성취기준: ${standards.join(', ') || '미확인'}
페이지 텍스트:
${String(pageText || '').slice(0, 2200)}
`
  const result = await callGemini(prompt, { json: true })
  const parsed = parseJson(result, null)
  if (!parsed?.statement || typeof parsed.answer !== 'boolean') {
    throw new Error('O/X 질문 형식이 올바르지 않습니다.')
  }
  return {
    statement: String(parsed.statement),
    answer: parsed.answer,
    explanation: String(parsed.explanation || ''),
  }
}

export async function generateQuiz(pageText, standardCode, options = {}) {
  const { scopeLabel = '현재 페이지', maxLength = 4200 } = options
  const prompt = `다음 학습 자료 범위(${scopeLabel})를 읽고 학생 이해를 점검할 객관식 문항 1개를 생성해줘.
문항은 단순 암기보다 핵심 개념 이해를 확인해야 해.

자료:
${String(pageText || '').slice(0, maxLength)}

성취기준: ${standardCode || '없음'}

JSON 객체만 출력:
{
  "question": "문제 문장",
  "options": ["선택지 1", "선택지 2", "선택지 3", "선택지 4"],
  "answer": 0,
  "standard_code": "${standardCode || '없음'}",
  "explanation": "정답 이유를 2문장 이내로 설명"
}`
  const result = await callGemini(prompt, { json: true })
  return parseJson(result, null)
}

export async function generateQuizSet(pageText, standardCode, count = 10, options = {}) {
  const { scopeLabel = '전체 문서', maxLength = 7000 } = options
  const safeCount = Math.min(10, Math.max(1, Number(count) || 1))
  const prompt = `다음 학습 자료 범위(${scopeLabel}) 전체를 바탕으로 객관식 문항 ${safeCount}개를 생성해줘.
문항들은 서로 다른 페이지/개념을 다루고, 단순 암기보다 핵심 개념 이해를 확인해야 해.

자료:
${String(pageText || '').slice(0, maxLength)}

성취기준: ${standardCode || '없음'}

JSON 배열만 출력:
[
  {
    "question": "문제 문장",
    "options": ["선택지 1", "선택지 2", "선택지 3", "선택지 4"],
    "answer": 0,
    "standard_code": "${standardCode || '없음'}",
    "explanation": "정답 이유를 2문장 이내로 설명"
  }
]
반드시 ${safeCount}개를 생성해.`
  const result = await callGemini(prompt, { json: true })
  const parsed = parseJson(result, [])
  const list = Array.isArray(parsed) ? parsed : parsed?.quizzes
  return Array.isArray(list) ? list.slice(0, safeCount) : []
}

export async function extractLearningElements(quizSummary, chatSummary, memoSummary) {
  const prompt = `
학생의 학습 기록을 분석해서 핵심 학습 요소를 JSON으로 추출해줘.

퀴즈 오답 및 시도 기록:
${quizSummary}

채팅 질문 기록:
${chatSummary}

메모/하이라이트 기록:
${memoSummary}

다음 JSON 형식으로만 답해:
{
  "concepts": ["핵심 개념1", "핵심 개념2"],
  "weakPoints": ["보완 필요 지점"],
  "strongPoints": ["잘 이해한 부분"]
}

concepts는 학습한 교과 개념 5~8개, weakPoints는 오답이나 반복 질문에서 보이는 보완점 1~3개, strongPoints는 정답이나 메모가 많은 이해 항목 1~3개로 작성해줘.
`
  const result = await callGemini(prompt, { json: true })
  const parsed = parseJson(result, null)
  if (!parsed?.concepts || !Array.isArray(parsed.concepts)) {
    throw new Error('학습 요소 추출 결과가 올바르지 않습니다.')
  }
  return {
    concepts: parsed.concepts.map(String).slice(0, 8),
    weakPoints: (Array.isArray(parsed.weakPoints) ? parsed.weakPoints : []).map(String).slice(0, 3),
    strongPoints: (Array.isArray(parsed.strongPoints) ? parsed.strongPoints : []).map(String).slice(0, 3),
  }
}

export async function socraticChat(messages, context) {
  const { standards = [], standardTargets = [], pageNumber, pageText = '', highlightText = '' } = context

  const standardInfos = standards.map((code) => getStandardByCode(code)).filter(Boolean)
  const targetBlock = standardTargets.length
    ? standardTargets
        .slice(0, 6)
        .map((target) => `- [${target.standardCode}] ${target.title}: ${target.description}`)
        .join('\n')
    : '매핑된 이해 단위 없음'
  const standardBlock = standardInfos.length
    ? standardInfos
        .map((s) => {
          const resourceText = s.publicResources?.length
            ? ` | 공공 학습자료: ${s.publicResources.map((resource) => `${resource.title} ${resource.url}`).join(' / ')}`
            : ''
          return `[${s.code}] ${s.subject} ${s.grade} | 단원: ${s.unit} | 목표: ${s.description} | 공식 자료: ${getEdunetUrl(s.code)}${resourceText}`
        })
        .join('\n')
    : '(성취기준 매핑 없음. 일반 학습 맥락으로 응답)'

  const highlightBlock = highlightText.trim()
    ? `\n학생이 Chat 맥락으로 보낸 문장. 이 문장을 반드시 언급하거나 풀어서 설명:\n"${highlightText.trim()}"\n`
    : ''

  const safePageText = String(pageText || '').trim()
  const pageBlock = safePageText
    ? `\n현재 페이지 내용 참고:\n${safePageText.slice(0, 1600)}\n`
    : ''

  const pageQuote = safePageText
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => line.length >= 18)

  const prompt = `당신은 한국 고등학생을 돕는 학습 보조 AI입니다.

## 학습 맥락
성취기준:
${standardBlock}
이해 단위:
${targetBlock}
현재 페이지: ${pageNumber || '-'}
${highlightBlock}${pageBlock}
## 응답 원칙
- 사용자가 질문하면 "충분히 생각했나요?"처럼 확인 질문만 던지지 마세요.
- 먼저 짧은 설명을 2~3문장으로 제공하고, 현재 페이지나 사용자가 보낸 맥락을 1문장으로 연결하세요.
- 마지막에는 학생 사고를 이어가는 꼬리 질문 1개를 제시하세요.
- 자료와 성취기준 범위 안에서만 설명하세요.
- 아래 형식을 지키되, 불필요한 제목을 길게 늘리지 마세요.

핵심 설명: 개념을 짧게 설명
맥락: 현재 페이지나 선택 맥락과 연결. 가능하면 "${pageQuote || '현재 페이지의 핵심 문장'}"을 짧게 인용
생각해볼 질문: 학생이 다음으로 확인할 질문 1개
출처: [성취기준 코드] 이해 단위 또는 단원명 / 공식 자료 URL

## 대화 기록
${messages.map((m) => `${m.role === 'user' ? '학생' : 'AI'}: ${m.content}`).join('\n')}

응답:`

  return callGemini(prompt)
}
