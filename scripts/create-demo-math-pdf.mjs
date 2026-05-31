import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import demo from '../src/data/demo_math_2022_user_data.json' with { type: 'json' }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const htmlOutput = path.join(root, 'docs', 'examples', 'co-study-2022-math-demo.html')
const pdfOutput = path.join(root, 'output', 'pdf', 'co-study-2022-math-demo.pdf')

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderPage(page) {
  const standardBadges = page.expectedStandards
    .map((code) => `<span class="badge">${escapeHtml(code)}</span>`)
    .join('')
  const focusTerms = page.focusTerms
    .map((term) => `<span>${escapeHtml(term)}</span>`)
    .join('')

  return `
    <section class="page">
      <div class="kicker">${escapeHtml(page.subject)} · ${escapeHtml(page.unit)}</div>
      <h1>${escapeHtml(page.title)}</h1>
      <div class="standards">${standardBadges}</div>
      <p class="bodyText">${escapeHtml(page.body)}</p>
      <div class="focus">
        <h2>하이라이트 후보</h2>
        <div class="terms">${focusTerms}</div>
      </div>
      <div class="question">
        <strong>학생 질문 예시</strong>
        <p>${escapeHtml(page.studentPrompt)}</p>
      </div>
      <footer>${escapeHtml(demo.document.title)} · ${page.page}/${demo.document.pageCount}</footer>
    </section>
  `
}

function renderHtml() {
  const allowed = demo.allowedSubjects.map((subject) => `<span>${escapeHtml(subject)}</span>`).join('')
  const excluded = demo.excludedScopes.map((scope) => `<span>${escapeHtml(scope)}</span>`).join('')
  const pages = demo.document.pages.map(renderPage).join('')

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(demo.document.title)}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #172033;
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", Arial, sans-serif;
      line-height: 1.62;
      background: #ffffff;
    }
    .cover, .page {
      break-after: page;
      min-height: 261mm;
      position: relative;
    }
    .page:last-child { break-after: auto; }
    .cover {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 18px;
      border-top: 8px solid #2563eb;
    }
    .cover h1 {
      margin: 0;
      max-width: 720px;
      font-size: 32px;
      line-height: 1.25;
      color: #111827;
    }
    .cover p {
      max-width: 720px;
      margin: 0;
      font-size: 15px;
      color: #475569;
    }
    .chipRow {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 4px;
    }
    .chipRow span, .terms span, .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      border: 1px solid #cbd5e1;
      padding: 4px 9px;
      font-size: 11px;
      color: #334155;
      background: #f8fafc;
    }
    .excluded span {
      border-color: #fed7aa;
      color: #9a3412;
      background: #fff7ed;
    }
    .kicker {
      margin: 0 0 10px;
      font-size: 12px;
      font-weight: 700;
      color: #2563eb;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 25px;
      line-height: 1.3;
      color: #0f172a;
    }
    h2 {
      margin: 0 0 8px;
      font-size: 15px;
      color: #334155;
    }
    .standards {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0 0 18px;
    }
    .badge {
      border-color: #bfdbfe;
      color: #1d4ed8;
      background: #eff6ff;
      font-weight: 700;
    }
    .bodyText {
      margin: 0;
      padding: 18px 20px;
      border: 1px solid #dbe4f0;
      border-radius: 8px;
      background: #fbfdff;
      font-size: 14px;
      white-space: pre-wrap;
    }
    .focus {
      margin-top: 18px;
      padding: 14px 16px;
      border-left: 4px solid #14b8a6;
      background: #f0fdfa;
    }
    .terms {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .question {
      margin-top: 18px;
      padding: 14px 16px;
      border: 1px solid #fde68a;
      border-radius: 8px;
      background: #fffbeb;
    }
    .question strong {
      display: block;
      margin-bottom: 6px;
      color: #92400e;
      font-size: 13px;
    }
    .question p {
      margin: 0;
      font-size: 13px;
    }
    footer {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      color: #64748b;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <section class="cover">
    <div class="kicker">Co-Study 실사용 테스트 자료</div>
    <h1>${escapeHtml(demo.document.title)}</h1>
    <p>${escapeHtml(demo.targetUser)}</p>
    <p>PDF 업로드, 성취기준 매핑, 학습목표 생성, 하이라이트, 근거 기반 채팅, 잠금 퀴즈, 대시보드 누적 흐름을 한 번에 점검하기 위한 예시 자료입니다.</p>
    <div>
      <h2>포함 과목</h2>
      <div class="chipRow">${allowed}</div>
    </div>
    <div>
      <h2>의도적으로 제외한 범위</h2>
      <div class="chipRow excluded">${excluded}</div>
    </div>
  </section>
  ${pages}
</body>
</html>`
}

fs.mkdirSync(path.dirname(htmlOutput), { recursive: true })
fs.mkdirSync(path.dirname(pdfOutput), { recursive: true })
fs.writeFileSync(htmlOutput, renderHtml(), 'utf8')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto(`file://${htmlOutput.replaceAll(path.sep, '/')}`, { waitUntil: 'networkidle' })
await page.pdf({
  path: pdfOutput,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
})
await browser.close()

console.log(`HTML: ${htmlOutput}`)
console.log(`PDF: ${pdfOutput}`)
