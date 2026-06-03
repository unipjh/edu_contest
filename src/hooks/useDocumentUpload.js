import { useState } from 'react'
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../lib/firebase.js'
import { extractKeywordsFromPDF, generateLearningGoals } from '../lib/gemini.js'
import { findLearningTargets, findStandards, getSummary } from '../lib/ncicMapper.js'
import { extractPdfPages } from '../lib/pdfText.js'

export function useDocumentUpload(uid) {
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function prepareDocument(docId, file) {
    try {
      setStatus('extracting')
      setMessage('PDF 페이지 텍스트를 읽고 있습니다.')
      const pageTexts = await extractPdfPages(file)
      const previewText = pageTexts.slice(0, 5).join('\n').slice(0, 4000)

      await updateDoc(doc(db, 'documents', docId), {
        pageTexts,
        pageCount: pageTexts.length,
      })

      setStatus('mapping')
      setMessage('성취기준과 학습목표를 준비하고 있습니다.')

      let standards = []
      let standardTargets = []
      let learningGoals = []
      let mappingInput = previewText
      try {
        const keywords = await extractKeywordsFromPDF(previewText)
        mappingInput = keywords.length ? [...keywords, previewText] : previewText
      } catch (mappingError) {
        console.warn(mappingError)
      }

      standards = findStandards(mappingInput)
      standardTargets = findLearningTargets(mappingInput, standards)

      try {
        learningGoals = await generateLearningGoals(pageTexts[0] || previewText, standards, standardTargets)
      } catch (goalError) {
        console.warn(goalError)
      }

      const summary = getSummary(standards)
      await updateDoc(doc(db, 'documents', docId), {
        standards,
        standardTargets,
        subject: summary.subject,
        grade: summary.grade,
        unit: summary.unit,
        learningGoals,
      })

      setStatus('done')
      setMessage('학습자료 준비가 완료되었습니다.')
    } catch (nextError) {
      setStatus('error')
      setError(nextError.message)
    }
  }

  async function upload(file) {
    if (!file || !uid) return null
    setStatus('uploading')
    setMessage('PDF 업로드 중입니다.')
    setError('')

    try {
      const storagePath = `documents/${uid}/${Date.now()}-${file.name}`
      const fileRef = ref(storage, storagePath)
      await uploadBytes(fileRef, file)
      const storageUrl = await getDownloadURL(fileRef)

      const docRef = await addDoc(collection(db, 'documents'), {
        uid,
        title: file.name,
        storageUrl,
        storagePath,
        standards: [],
        standardTargets: [],
        subject: '분석 중',
        grade: '',
        unit: '',
        learningGoals: [],
        pageTexts: [],
        pageCount: 0,
        createdAt: serverTimestamp(),
      })

      prepareDocument(docRef.id, file)
      return docRef.id
    } catch (nextError) {
      setStatus('error')
      setError(nextError.message)
      return null
    }
  }

  return { upload, status, message, error, busy: ['uploading', 'extracting', 'mapping'].includes(status) }
}
