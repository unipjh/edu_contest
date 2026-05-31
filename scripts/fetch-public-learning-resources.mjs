import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const envPath = path.join(root, '.env.local')
const outputPath = path.join(root, 'data', 'raw', 'keris_topic_learning_resources_api.json')
const endpoint = process.env.PUBLIC_DATA_ENDPOINT || 'https://api.data.go.kr/openapi/tn_pubr_public_lern_data_api'

loadEnvFile(envPath)

const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY
const pageNo = Number(process.env.PUBLIC_DATA_PAGE_NO || 1)
const numOfRows = Number(process.env.PUBLIC_DATA_NUM_ROWS || 1000)
const fetchAll = String(process.env.PUBLIC_DATA_FETCH_ALL || '').toLowerCase() === 'true'
const maxPages = Number(process.env.PUBLIC_DATA_MAX_PAGES || 20)

if (!serviceKey) {
  throw new Error('DATA_GO_KR_SERVICE_KEY를 .env.local 또는 환경변수에 설정해야 합니다.')
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function buildUrl(nextPageNo) {
  const params = new URLSearchParams()
  params.set('pageNo', String(nextPageNo))
  params.set('numOfRows', String(numOfRows))
  params.set('type', 'json')

  // data.go.kr often provides an already-encoded service key. Preserve it when
  // it contains percent escapes to avoid double encoding.
  const serviceKeyParam = serviceKey.includes('%')
    ? `serviceKey=${serviceKey}`
    : `serviceKey=${encodeURIComponent(serviceKey)}`
  return `${endpoint}?${serviceKeyParam}&${params.toString()}`
}

function extractBody(data) {
  return data.response?.body || data.body || {}
}

function extractItems(data) {
  const items = extractBody(data).items
  const item = items?.item ?? items ?? data.items ?? []
  return Array.isArray(item) ? item : [item].filter(Boolean)
}

async function fetchPage(nextPageNo) {
  const url = buildUrl(nextPageNo)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`KERIS 공공데이터 API 요청 실패: HTTP ${response.status}`)
  }

  const data = await response.json()
  const header = data.response?.header || data.header
  const resultCode = header?.resultCode || header?.resultcode
  if (resultCode && !['00', '0', 'INFO-000'].includes(String(resultCode))) {
    throw new Error(`KERIS 공공데이터 API 오류: ${resultCode} ${header?.resultMsg || header?.resultmsg || ''}`.trim())
  }
  return data
}

const firstPage = await fetchPage(pageNo)
const firstBody = extractBody(firstPage)
const totalCount = Number(firstBody.totalCount || firstBody.totalcount || extractItems(firstPage).length)
let pages = [firstPage]

if (fetchAll && totalCount > numOfRows) {
  const totalPages = Math.ceil(totalCount / numOfRows)
  const lastPage = Math.min(totalPages, pageNo + maxPages - 1)
  for (let nextPage = pageNo + 1; nextPage <= lastPage; nextPage += 1) {
    pages.push(await fetchPage(nextPage))
  }
}

const mergedItems = pages.flatMap(extractItems)
const output = {
  fetchedAt: new Date().toISOString(),
  endpoint,
  pageNo,
  numOfRows,
  fetchAll,
  totalCount,
  fetchedPages: pages.length,
  items: mergedItems,
  response: firstPage.response,
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`)
console.log(`Wrote ${mergedItems.length} KERIS resources from ${pages.length} page(s) to ${outputPath}`)
if (totalCount && mergedItems.length < totalCount) {
  console.log(`API totalCount is ${totalCount}. Set PUBLIC_DATA_FETCH_ALL=true to fetch more pages.`)
}
