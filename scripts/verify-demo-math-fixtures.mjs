import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import demo from '../src/data/demo_math_2022_user_data.json' with { type: 'json' }
import standards from '../src/data/ncic_standards.json' with { type: 'json' }
import { findLearningTargets, findStandards } from '../src/lib/ncicMapper.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const htmlPath = path.join(root, 'docs', 'examples', 'co-study-2022-math-demo.html')
const pdfPath = path.join(root, 'output', 'pdf', 'co-study-2022-math-demo.pdf')
const requirePdf = process.argv.includes('--require-pdf')

const allowedSubjects = new Set(demo.allowedSubjects)
const standardsByCode = new Map(standards.map((standard) => [standard.code, standard]))
const failures = []
const warnings = []

const forbiddenPatterns = [
  /수열의\s*극한/,
  /무한\s*급수/,
  /급수의\s*합/,
  /초월함수/,
  /삼각함수의\s*(미분|도함수|적분)/,
  /지수함수의\s*(미분|도함수|적분)/,
  /로그함수의\s*(미분|도함수|적분)/,
  /자연로그/,
  /\bln\s*x?\b/i,
  /\be\^?x\b/i,
  /치환\s*적분/,
  /부분\s*적분/,
]

function fail(message) {
  failures.push(message)
}

function warn(message) {
  warnings.push(message)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function checkText(label, text) {
  assert(!/[�]/.test(text), `${label}: replacement character detected`)
  assert(!/[怨援먯쑁諛섎뒗蹂]/.test(text), `${label}: likely mojibake characters detected`)
  for (const pattern of forbiddenPatterns) {
    assert(!pattern.test(text), `${label}: forbidden out-of-scope term matched ${pattern}`)
  }
}

function subjectOf(code) {
  return standardsByCode.get(code)?.subject
}

const pages = demo.document.pages || []
assert(pages.length === demo.document.pageCount, 'document.pageCount must match pages.length')

const coveredSubjects = new Set(pages.map((page) => page.subject))
for (const subject of allowedSubjects) {
  assert(coveredSubjects.has(subject), `missing sample page for allowed subject: ${subject}`)
}
for (const subject of coveredSubjects) {
  assert(allowedSubjects.has(subject), `page uses non-allowed subject: ${subject}`)
}

const allText = [
  demo.title,
  demo.targetUser,
  demo.document.title,
  ...(demo.document.learningGoals || []),
  ...pages.flatMap((page) => [
    page.title,
    page.subject,
    page.unit,
    page.studentPrompt,
    page.body,
    ...(page.focusTerms || []),
  ]),
  ...demo.seed.highlights.flatMap((item) => [item.text, item.memo, item.standardCode]),
  ...demo.seed.chats.flatMap((item) => [item.question, item.answer, item.contextText, item.standardCode]),
  ...demo.seed.quizzes.flatMap((item) => [item.question, item.standardCode, item.setTitle]),
].join('\n')
checkText('fixture json', allText)

for (const page of pages) {
  assert(page.body.length >= 260, `page ${page.page}: body is too short for realistic PDF testing`)
  assert((page.focusTerms || []).length >= 5, `page ${page.page}: expected at least 5 focus terms`)
  assert((page.expectedStandards || []).length >= 2, `page ${page.page}: expected at least 2 standards`)

  for (const code of page.expectedStandards || []) {
    const standard = standardsByCode.get(code)
    assert(standard, `page ${page.page}: unknown standard ${code}`)
    assert(allowedSubjects.has(standard?.subject), `page ${page.page}: ${code} belongs to disallowed subject ${standard?.subject}`)
    assert(standard?.subject === page.subject, `page ${page.page}: ${code} subject ${standard?.subject} does not match page subject ${page.subject}`)
  }

  const mappingText = [page.title, page.subject, page.unit, page.body, ...(page.focusTerms || [])].join(' ')
  const mappedStandards = findStandards(mappingText)
  const mappedTargets = findLearningTargets(mappingText, page.expectedStandards)
  const matchedExpected = page.expectedStandards.filter((code) => mappedStandards.includes(code))
  assert(
    matchedExpected.length >= Math.min(2, page.expectedStandards.length),
    `page ${page.page}: mapper found ${mappedStandards.join(', ') || '-'} but expected at least two of ${page.expectedStandards.join(', ')}`,
  )
  assert(mappedTargets.length > 0, `page ${page.page}: no learning target matched expected standards`)
}

const seedSections = ['highlights', 'chats', 'quizzes']
for (const section of seedSections) {
  assert(Array.isArray(demo.seed[section]) && demo.seed[section].length > 0, `seed.${section} must not be empty`)
  for (const item of demo.seed[section]) {
    const standard = standardsByCode.get(item.standardCode)
    assert(standard, `seed.${section}: unknown standard ${item.standardCode}`)
    assert(allowedSubjects.has(standard?.subject), `seed.${section}: disallowed subject for ${item.standardCode}`)
    assert(pages.some((page) => page.expectedStandards.includes(item.standardCode)), `seed.${section}: ${item.standardCode} is not represented by a demo page`)
  }
}

for (const item of demo.seed.weakStandards || []) {
  const standard = standardsByCode.get(item.standardCode)
  assert(standard, `seed.weakStandards: unknown standard ${item.standardCode}`)
  assert(Number.isInteger(item.count) && item.count > 0, `seed.weakStandards: ${item.standardCode} must have positive integer count`)
  assert(allowedSubjects.has(standard?.subject), `seed.weakStandards: disallowed subject for ${item.standardCode}`)
}

if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8')
  checkText('generated html', html)
  for (const page of pages) {
    assert(html.includes(page.title), `generated html missing page title: ${page.title}`)
  }
} else {
  warn(`HTML not generated yet: ${path.relative(root, htmlPath)}`)
}

if (fs.existsSync(pdfPath)) {
  const stat = fs.statSync(pdfPath)
  assert(stat.size > 50_000, `generated PDF is suspiciously small: ${stat.size} bytes`)
} else if (requirePdf) {
  fail(`PDF not generated: ${path.relative(root, pdfPath)}`)
} else {
  warn(`PDF not generated yet: ${path.relative(root, pdfPath)}`)
}

if (warnings.length) {
  for (const message of warnings) console.warn(`WARN ${message}`)
}

if (failures.length) {
  for (const message of failures) console.error(`FAIL ${message}`)
  console.error(`${failures.length} demo fixture quality check(s) failed.`)
  process.exit(1)
}

console.log([
  'PASS demo fixture quality checks',
  `pages=${pages.length}`,
  `subjects=${Array.from(coveredSubjects).join(', ')}`,
  `standards=${pages.flatMap((page) => page.expectedStandards).length}`,
].join(' | '))
