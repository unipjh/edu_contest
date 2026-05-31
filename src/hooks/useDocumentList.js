import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase.js'

export function useDocumentList(uid) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(Boolean(uid))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!uid || !db) return undefined
    setLoading(true)
    const documentsQuery = query(collection(db, 'documents'), where('uid', '==', uid))

    return onSnapshot(
      documentsQuery,
      (snapshot) => {
        setDocuments(
          snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)),
        )
        setError('')
        setLoading(false)
      },
      (nextError) => {
        setError(
          nextError.code === 'permission-denied'
            ? 'Firestore 보안 규칙에서 현재 사용자의 문서 읽기 권한을 허용해야 합니다.'
            : nextError.message,
        )
        setLoading(false)
      },
    )
  }, [uid])

  return { documents, loading, error }
}
