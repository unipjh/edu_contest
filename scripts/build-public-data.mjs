import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const csvInputPath = path.join(root, 'data', 'raw', 'keris_topic_learning_resources_sample.csv')
const apiInputPath = path.join(root, 'data', 'raw', 'keris_topic_learning_resources_api.json')
const outputPath = path.join(root, 'src', 'data', 'public_learning_resources.json')

function parseCsv(text) {
  const rows = []
  let row = []
  let value = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]
    if (quoted && char === '"' && next === '"') {
      value += '"'
      i += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (!quoted && char === ',') {
      row.push(value)
      value = ''
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i += 1
      row.push(value)
      if (row.some((item) => item.trim())) rows.push(row)
      row = []
      value = ''
    } else {
      value += char
    }
  }
  row.push(value)
  if (row.some((item) => item.trim())) rows.push(row)
  return rows
}

function splitKeywords(value) {
  return String(value || '')
    .split(/\s*,\s*|\s*;\s*|\s*\|\s*/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function stableId(url, title) {
  return crypto.createHash('sha1').update(`${url}:${title}`).digest('hex').slice(0, 12)
}

function pick(record, ...keys) {
  const key = keys.find((item) => record[item] !== undefined && record[item] !== null && String(record[item]).trim() !== '')
  return String(key ? record[key] : '').trim()
}

function normalizeRecord(record) {
  const title = pick(record, 'LERN_DATA_NM', 'lernDataNm', 'learningDataName', '학습자료명')
  const url = pick(record, 'HMPG_ADDR', 'hmpgAddr', 'homepageUrl', '홈페이지주소')
  return {
    id: stableId(url, title),
    title,
    pageNumber: pick(record, 'PG_NO', 'pgNo', 'pageNumber', '페이지번호'),
    keywords: splitKeywords(pick(record, 'KWD_NM', 'kwdNm', 'keywordName', '키워드명')),
    fileName: pick(record, 'FILE_NM', 'fileNm', 'fileName', '파일명'),
    tocName: pick(record, 'CNTNT_NM', 'cntntNm', 'contentName', '목차명'),
    extension: pick(record, 'EXTN_NM', 'extnNm', 'extensionName', '확장자명'),
    sourceName: pick(record, 'SRC_NM', 'srcNm', 'sourceName', '출처명') || '에듀넷',
    url,
    createdAt: pick(record, 'WRT_YMD', 'wrtYmd', 'createdAt', '작성일자'),
    baseDate: pick(record, 'CRTR_YMD', 'crtrYmd', 'baseDate', '데이터기준일자'),
    provider: '한국교육학술정보원',
    dataset: '전국초중등교과주제별학습자료표준데이터',
    publicDataPortalUrl: 'https://www.data.go.kr/data/15107733/standard.do',
  }
}

function readCsvRecords() {
  const csv = fs.readFileSync(csvInputPath, 'utf8')
  const [header, ...rows] = parseCsv(csv)
  return rows.map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] || ''])))
}

function readApiRecords() {
  const data = JSON.parse(fs.readFileSync(apiInputPath, 'utf8'))
  if (Array.isArray(data.items)) return data.items
  const items = data.response?.body?.items?.item ?? data.response?.body?.items ?? []
  return Array.isArray(items) ? items : [items].filter(Boolean)
}

const inputSource = fs.existsSync(apiInputPath) ? apiInputPath : csvInputPath
const records = fs.existsSync(apiInputPath) ? readApiRecords() : readCsvRecords()
const resources = records
  .map(normalizeRecord)
  .filter((resource) => resource.title && resource.url)

fs.writeFileSync(outputPath, `${JSON.stringify(resources, null, 2)}\n`)
console.log(`Wrote ${resources.length} resources from ${inputSource} to ${outputPath}`)
