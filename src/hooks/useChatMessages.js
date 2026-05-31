import { useEffect, useState } from 'react'
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { socraticChat } from '../lib/gemini.js'

export function useChatMessages(uid, docId) {
  const [turns, setTurns] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!uid || !docId || !db) return undefined
    const chatQuery = query(collection(db, 'chatHistory'), where('uid', '==', uid), where('docId', '==', docId))
    return onSnapshot(
      chatQuery,
      (snapshot) => {
        setTurns(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0)),
        )
        setError('')
      },
      (nextError) => setError(nextError.message),
    )
  }, [uid, docId])

  async function send(question, context) {
    const cleanQuestion = question.trim()
    if (!cleanQuestion || sending) return

    setSending(true)
    setError('')
    try {
      // SC-4: Limit to last 6 turns (12 messages) before passing to Gemini
      const recentTurns = turns.slice(-6)
      const history = recentTurns.flatMap((turn) => [
        {
          role: 'user',
          content: turn.contextText
            ? `맥락: ${turn.contextText}\n질문: ${turn.question}`
            : turn.question,
        },
        { role: 'assistant', content: turn.answer },
      ])
      const answer = await socraticChat([...history, { role: 'user', content: cleanQuestion }], context)
      await addDoc(collection(db, 'chatHistory'), {
        uid,
        docId,
        standardCode: context.standards?.[0] || 'unknown',
        question: cleanQuestion,
        answer,
        contextText: context.highlightText || '',
        createdAt: serverTimestamp(),
      })
    } catch (nextError) {
      // SC-5: Surface errors in Korean
      setError(`AI 응답 오류: ${nextError.message}`)
    } finally {
      setSending(false)
    }
  }

  return { turns, sending, send, error }
}
