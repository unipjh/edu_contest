import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../lib/firebase.js'

export function useMemos(uid, docId) {
  const [memos, setMemos] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!uid || !docId || !db) return undefined
    const memoQuery = query(collection(db, 'highlights'), where('uid', '==', uid), where('docId', '==', docId))
    return onSnapshot(
      memoQuery,
      (snapshot) => {
        setMemos(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)),
        )
        setError('')
      },
      (nextError) => setError(nextError.message),
    )
  }, [uid, docId])

  async function addMemo({ text, memo, page, standardCode, rects, color }) {
    if (!uid || !docId || !text.trim()) return
    await addDoc(collection(db, 'highlights'), {
      uid,
      docId,
      text: text.trim(),
      memo: memo?.trim() || '',
      color: color || 'yellow',
      rects: rects || [],
      page,
      standardCode: standardCode || 'unknown',
      createdAt: serverTimestamp(),
    })
  }

  async function removeMemo(id) {
    await deleteDoc(doc(db, 'highlights', id))
  }

  const memoText = useMemo(
    () => memos.map((item) => `[${item.page || '?'}p] ${item.text} ${item.memo || ''}`.trim()).join('\n'),
    [memos],
  )

  return { memos, memoText, addMemo, removeMemo, error }
}
