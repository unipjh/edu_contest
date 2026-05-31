import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, increment, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase.js'

export function useQuizHistory(uid, docId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!uid || !docId) {
      setItems([])
      return undefined
    }

    setLoading(true)
    setError('')
    const historyQuery = query(
      collection(db, 'quizHistory'),
      where('uid', '==', uid),
      where('docId', '==', docId),
    )

    return onSnapshot(
      historyQuery,
      (snap) => {
        const nextItems = snap.docs.map((historyDoc) => ({ id: historyDoc.id, ...historyDoc.data() }))
        setItems(nextItems)
        setLoading(false)
      },
      (snapshotError) => {
        setError(snapshotError.message)
        setLoading(false)
      },
    )
  }, [docId, uid])

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0
      const bTime = b.createdAt?.toMillis?.() || 0
      return bTime - aTime
    })
  }, [items])

  async function record({
    standardCode = 'unknown',
    question,
    isCorrect = null,
    mode = 'quiz',
    page = null,
    scope = 'page',
    options = [],
    answer = null,
    selectedAnswer = null,
    explanation = '',
    setId = null,
    setTitle = '',
    setSize = 1,
    sequence = 1,
  }) {
    if (!uid || !docId) return
    const historyDoc = await addDoc(collection(db, 'quizHistory'), {
      uid,
      docId,
      standardCode,
      question,
      isCorrect,
      mode,
      page,
      scope,
      options,
      answer,
      selectedAnswer,
      explanation,
      setId,
      setTitle,
      setSize,
      sequence,
      createdAt: serverTimestamp(),
    })

    if (isCorrect === false) {
      await setDoc(
        doc(db, 'users', uid, 'weakStandards', standardCode),
        { count: increment(1), lastFailed: serverTimestamp() },
        { merge: true },
      )
    }

    return historyDoc.id
  }

  async function updateResult({ quizId, standardCode = 'unknown', isCorrect, selectedAnswer }) {
    if (!uid || !docId || !quizId) return
    await updateDoc(doc(db, 'quizHistory', quizId), {
      isCorrect,
      selectedAnswer,
      answeredAt: serverTimestamp(),
    })

    if (isCorrect === false) {
      await setDoc(
        doc(db, 'users', uid, 'weakStandards', standardCode),
        { count: increment(1), lastFailed: serverTimestamp() },
        { merge: true },
      )
    }
  }

  return { record, updateResult, items: sortedItems, loading, error }
}
