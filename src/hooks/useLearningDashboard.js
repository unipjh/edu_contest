import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { extractLearningElements } from '../lib/gemini.js'

function isPermError(err) {
  return err?.code === 'permission-denied' || err?.message?.includes('permissions')
}

export function useLearningDashboard(uid) {
  const [weakStandards, setWeakStandards] = useState({})
  const [highlights, setHighlights] = useState([])
  const [chatHistory, setChatHistory] = useState([])
  const [quizHistory, setQuizHistory] = useState([])
  const [learningElements, setLearningElements] = useState(null)
  const [loading, setLoading] = useState(true)
  const [permError, setPermError] = useState(false)
  const [error, setError] = useState('')
  const [extracting, setExtracting] = useState(false)

  useEffect(() => {
    if (!uid || !db) {
      setLoading(false)
      return undefined
    }

    setLoading(true)
    setPermError(false)
    let fired = 0
    function markReady() {
      fired += 1
      if (fired >= 5) setLoading(false)
    }

    const unsubWs = onSnapshot(
      collection(db, 'users', uid, 'weakStandards'),
      (snap) => {
        const map = {}
        snap.docs.forEach((d) => { map[d.id] = d.data() })
        setWeakStandards(map)
        markReady()
      },
      (err) => {
        if (isPermError(err)) setPermError(true)
        else setError(err.message)
        markReady()
      },
    )

    const unsubHl = onSnapshot(
      query(collection(db, 'highlights'), where('uid', '==', uid)),
      (snap) => {
        setHighlights(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        markReady()
      },
      (err) => {
        if (isPermError(err)) setPermError(true)
        else setError(err.message)
        markReady()
      },
    )

    const unsubCh = onSnapshot(
      query(collection(db, 'chatHistory'), where('uid', '==', uid)),
      (snap) => {
        setChatHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        markReady()
      },
      (err) => {
        if (isPermError(err)) setPermError(true)
        else setError(err.message)
        markReady()
      },
    )

    const unsubQh = onSnapshot(
      query(collection(db, 'quizHistory'), where('uid', '==', uid)),
      (snap) => {
        setQuizHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        markReady()
      },
      (err) => {
        if (isPermError(err)) setPermError(true)
        else setError(err.message)
        markReady()
      },
    )

    const unsubUser = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        setLearningElements(snap.exists() ? (snap.data().learningElements || null) : null)
        markReady()
      },
      (err) => {
        if (isPermError(err)) setPermError(true)
        else setError(err.message)
        markReady()
      },
    )

    return () => {
      unsubWs()
      unsubHl()
      unsubCh()
      unsubQh()
      unsubUser()
    }
  }, [uid])

  const cards = useMemo(() => {
    const codes = new Set(
      [
        ...Object.keys(weakStandards),
        ...highlights.map((h) => h.standardCode),
        ...chatHistory.map((c) => c.standardCode),
        ...quizHistory.map((q) => q.standardCode),
      ].filter((c) => c && c !== 'unknown'),
    )

    return Array.from(codes)
      .map((code) => {
        const wrongCount = weakStandards[code]?.count || 0
        const memoCount = highlights.filter((h) => h.standardCode === code).length
        const chatCount = chatHistory.filter((c) => c.standardCode === code).length
        const quizAttempts = quizHistory.filter((q) => q.standardCode === code).length
        const quizCorrect = quizHistory.filter((q) => q.standardCode === code && q.isCorrect).length
        const status = wrongCount >= 1 ? 'weak' : memoCount >= 3 && wrongCount === 0 ? 'learning' : 'neutral'
        return { standardCode: code, wrongCount, memoCount, chatCount, quizAttempts, quizCorrect, status }
      })
      .sort((a, b) => {
        const order = { weak: 0, learning: 1, neutral: 2 }
        return order[a.status] - order[b.status]
      })
  }, [weakStandards, highlights, chatHistory, quizHistory])

  async function runExtraction() {
    if (extracting || cards.length === 0) return
    setExtracting(true)
    setError('')
    try {
      const quizSummary = quizHistory.length
        ? quizHistory.map((q) => `[${q.standardCode}] ${q.isCorrect ? '정답' : '오답'}: ${q.question}`).join('\n')
        : '퀴즈 기록 없음'
      const chatSummary = chatHistory.length
        ? chatHistory.map((c) => `[${c.standardCode}] Q: ${c.question}`).join('\n')
        : '채팅 기록 없음'
      const memoSummary = highlights.length
        ? highlights.map((h) => `[${h.standardCode}] "${h.text}"${h.memo ? ` / 메모: ${h.memo}` : ''}`).join('\n')
        : '메모 없음'

      const result = await extractLearningElements(quizSummary, chatSummary, memoSummary)
      await setDoc(
        doc(db, 'users', uid),
        { learningElements: { ...result, generatedAt: serverTimestamp() } },
        { merge: true },
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setExtracting(false)
    }
  }

  return { cards, learningElements, loading, permError, error, extracting, runExtraction }
}
