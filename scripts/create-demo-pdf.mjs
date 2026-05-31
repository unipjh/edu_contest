import { chromium } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const input = path.join(root, 'docs', 'examples', 'co-study-demo-case.html')
const output = path.join(root, 'output', 'pdf', 'co-study-demo-sequence.pdf')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto(`file://${input.replaceAll(path.sep, '/')}`, { waitUntil: 'networkidle' })
await page.pdf({
  path: output,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
})
await browser.close()

console.log(output)
