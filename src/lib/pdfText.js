import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerSrc

export async function extractPdfText(file, { maxPages = 3, maxChars = 2000 } = {}) {
  const buffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: buffer }).promise
  const pageCount = Math.min(pdf.numPages, maxPages)
  const chunks = []

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    chunks.push(textContent.items.map((item) => item.str).join(' '))
    const combined = chunks.join('\n')
    if (combined.length >= maxChars) return combined.slice(0, maxChars)
  }

  return chunks.join('\n').slice(0, maxChars)
}

export async function extractPdfPages(file, { maxPages = 80, maxCharsPerPage = 2500 } = {}) {
  const buffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: buffer }).promise
  const pageCount = Math.min(pdf.numPages, maxPages)
  const pages = []

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const text = textContent.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim()
    pages.push(text.slice(0, maxCharsPerPage))
  }

  return pages
}
