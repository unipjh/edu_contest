import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase.js'

export function useDocument(docId) {
  const [documentData, setDocumentData] = useState(null)
  const [loading, setLoading] = useState(Boolean(docId))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!docId || !db) return undefined
    setLoading(true)
    return onSnapshot(
      doc(db, 'documents', docId),
      (snapshot) => {
        setDocumentData(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null)
        setLoading(false)
      },
      (nextError) => {
        setError(nextError.message)
        setLoading(false)
      },
    )
  }, [docId])

  return { documentData, loading, error }
}
