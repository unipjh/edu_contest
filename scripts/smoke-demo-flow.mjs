import { chromium } from '@playwright/test'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'output', 'pdf', 'co-study-demo-sequence.pdf')
const logPath = path.join(root, 'output', 'smoke-demo-flow.log')
const port = process.env.PORT || '5187'
const baseUrl = `http://127.0.0.1:${port}`
const mojibakePattern = /\u6028|\u8adb|\uc12f|\uc496|\uae46|\uc208|\ub4bf|\uafa9|\ub348|\uba84|\ubdbe|\uf9ce|\uf9de|\u5a9b|\u745c|\ud69e/

fs.mkdirSync(path.dirname(logPath), { recursive: true })
fs.writeFileSync(logPath, '')

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`
  console.log(line)
  fs.appendFileSync(logPath, `${line}\n`)
}

async function withTimeout(label, promise, ms) {
  let timeoutId
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timeoutId)
  }
}

function waitForServer(proc) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const timer = setInterval(async () => {
      try {
        const response = await fetch(baseUrl)
        if (response.ok) {
          clearInterval(timer)
          resolve()
        }
      } catch {
        if (Date.now() - startedAt > 30000) {
          clearInterval(timer)
          reject(new Error('dev server did not become ready in time'))
        }
      }
    }, 500)
    proc.once('exit', (code) => {
      if (Date.now() - startedAt < 30000) {
        clearInterval(timer)
        reject(new Error(`dev server exited early with code ${code}. Output: ${devOutput.slice(-1000)}`))
      }
    })
  })
}

const devCommand = process.platform === 'win32' ? 'cmd.exe' : 'npm'
const devArgs = process.platform === 'win32'
  ? ['/c', 'npm.cmd', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', port]
  : ['run', 'dev', '--', '--host', '127.0.0.1', '--port', port]

const dev = spawn(devCommand, devArgs, {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
})
let devOutput = ''
dev.stdout.on('data', (chunk) => { devOutput += chunk.toString() })
dev.stderr.on('data', (chunk) => { devOutput += chunk.toString() })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const consoleErrors = []
const externalWarnings = []
page.on('console', (msg) => {
  if (msg.type() !== 'error') return
  const text = msg.text()
  if (text.includes('Could not reach Cloud Firestore backend')) {
    externalWarnings.push(text)
    return
  }
  consoleErrors.push(text)
})
page.on('pageerror', (err) => consoleErrors.push(err.message))

try {
  log('starting dev server')
  await waitForServer(dev)
  log(`opening ${baseUrl}/library`)
  await withTimeout('open library', page.goto(`${baseUrl}/library`, { waitUntil: 'domcontentloaded' }), 30000)
  try {
    await withTimeout('wait app shell', page.locator('h1', { hasText: 'Co-Study' }).waitFor({ timeout: 30000 }), 35000)
  } catch (error) {
    const body = await page.locator('body').innerText().catch(() => '')
    const html = await page.content().catch(() => '')
    throw new Error(`app shell did not render. Body: ${body.slice(0, 300)} HTML: ${html.slice(0, 500)} Console: ${consoleErrors.slice(0, 3).join(' | ')}`)
  }
  try {
    await withTimeout('wait library page', page.locator('h2', { hasText: '학습자료' }).waitFor({ timeout: 30000 }), 35000)
  } catch (error) {
    const body = await page.locator('body').innerText()
    throw new Error(`library page did not become ready. Visible text: ${body.slice(0, 700)}`)
  }

  const initialBody = await page.locator('body').innerText()
  if (mojibakePattern.test(initialBody)) {
    throw new Error('mojibake text detected on library page')
  }

  log(`uploading ${pdfPath}`)
  await withTimeout('set input file', page.locator('input[type="file"]').setInputFiles(pdfPath), 30000)
  log('waiting for viewer route')
  await withTimeout('wait viewer route', page.waitForURL(/\/viewer\//, { timeout: 90000 }), 95000)
  log('waiting for learning goal modal')
  try {
    await withTimeout('wait learning goal modal', page.getByText('학습 시작').waitFor({ timeout: 45000 }), 50000)
  } catch (error) {
    const body = await page.locator('body').innerText().catch(() => '')
    throw new Error(`viewer did not show learning goal modal. Visible text: ${body.slice(0, 900)}`)
  }

  const viewerBody = await page.locator('body').innerText()
  if (mojibakePattern.test(viewerBody)) {
    throw new Error('mojibake text detected on viewer page')
  }
  await withTimeout(
    'wait mapped standards badge',
    page.waitForFunction(() => {
      const body = document.body.innerText
      return body.includes('10수학02-01') || body.includes('10수학02-02')
    }, { timeout: 10000 }),
    12000,
  )

  await page.getByRole('button', { name: '학습 시작' }).click()
  log('checking highlight flow')
  await withTimeout(
    'wait pdf text layer',
    page.locator('.react-pdf__Page__textContent span').first().waitFor({ timeout: 30000 }),
    35000,
  )
  await withTimeout(
    'select pdf text',
    page.evaluate(() => {
      const span = document.querySelector('.react-pdf__Page__textContent span')
      if (!span?.firstChild) throw new Error('pdf text span not found')
      const range = document.createRange()
      range.selectNodeContents(span)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      span.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    }),
    10000,
  )
  await withTimeout('wait color picker', page.locator('.selectionColorPicker').waitFor({ timeout: 10000 }), 12000)
  await page.locator('.selectionColorPicker .colorSwatch').first().click()
  await withTimeout('wait memo saved', page.getByText('하이라이트를 저장했습니다.').waitFor({ timeout: 15000 }), 18000)

  log('checking lock gate flow')
  await page.getByRole('button', { name: /잠금 OFF/ }).click()
  await page.getByRole('button', { name: '다음 페이지' }).click()
  await withTimeout('wait ox modal', page.getByText('잠깐, 이해하고 있나요?').waitFor({ timeout: 45000 }), 50000)
  const oxButton = page.locator('.oxButtons button').first()
  await withTimeout('wait ox button enabled', oxButton.waitFor({ state: 'visible', timeout: 45000 }), 50000)
  await page.waitForFunction(() => {
    const button = document.querySelector('.oxButtons button')
    return button && !button.disabled
  }, { timeout: 45000 })
  await oxButton.click()
  await withTimeout('wait gate feedback', page.locator('.gateFeedback').waitFor({ timeout: 15000 }), 18000)
  await page.getByRole('button', { name: '닫기' }).click()

  log('checking chat flow')
  await page.locator('.studyToolbar .toolPill').filter({ hasText: 'Chat' }).click()
  await page.getByPlaceholder(/질문을 입력하세요/).fill('수렴과 발산을 어떻게 구분해?')
  await page.getByRole('button', { name: '전송' }).click()
  await withTimeout('wait chat answer', page.locator('.chatBubble.assistant').last().waitFor({ timeout: 45000 }), 50000)
  const chatAnswer = await page.locator('.chatBubble.assistant').last().innerText()
  if (!/근거|10수학02-01|수열/.test(chatAnswer)) {
    throw new Error(`chat answer did not include expected grounding: ${chatAnswer.slice(0, 500)}`)
  }

  log('checking quiz tab')
  await page.locator('.studyToolbar .toolPill').filter({ hasText: 'Quiz' }).click()
  await page.getByText('현재 페이지 퀴즈 생성').waitFor({ timeout: 10000 })

  log('checking dashboard seed flow')
  await page.getByRole('link', { name: /대시보드/ }).click()
  await withTimeout('wait dashboard', page.getByText('성취기준별 학습 현황').waitFor({ timeout: 30000 }), 35000)
  await page.getByRole('button', { name: '샘플 학습 기록 추가' }).click()
  await withTimeout('wait dashboard card', page.getByText('취약 · 복습 필요').waitFor({ timeout: 30000 }), 35000)
  const dashboardBody = await page.locator('body').innerText()
  if (!dashboardBody.includes('10수학02-01') || !dashboardBody.includes('오답')) {
    throw new Error(`dashboard did not show expected weak standard card: ${dashboardBody.slice(0, 700)}`)
  }

  log('checking mobile layout basics')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${baseUrl}/library`, { waitUntil: 'domcontentloaded' })
  await page.locator('h2', { hasText: '학습자료' }).waitFor({ timeout: 30000 })
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' })
  await page.getByText('성취기준별 학습 현황').waitFor({ timeout: 30000 })
  const mobileBody = await page.locator('body').innerText()
  if (mojibakePattern.test(mobileBody)) {
    throw new Error('mojibake text detected on mobile dashboard')
  }
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
  if (hasHorizontalOverflow) {
    throw new Error(`mobile layout has horizontal overflow: ${await page.evaluate(() => `${document.documentElement.scrollWidth}/${window.innerWidth}`)}`)
  }

  if (consoleErrors.length) {
    throw new Error(`console errors detected: ${consoleErrors.slice(0, 3).join(' | ')}`)
  }
  if (externalWarnings.length) {
    log(`external warning: ${externalWarnings[0].slice(0, 220)}`)
  }

  log('pass')
} finally {
  await browser.close()
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(dev.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    dev.kill('SIGTERM')
  }
}
