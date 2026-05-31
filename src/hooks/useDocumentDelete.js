import { useState } from 'react'
import { collection, doc, getDocs, increment, query, serverTimestamp, where, writeBatch } from 'firebase/firestore'
import { deleteObject, ref } from 'firebase/storage'
import { db, storage } from '../lib/firebase.js'

const RELATED_COLLECTIONS = ['highlights', 'chatHistory', 'quizHistory']

export function useDocumentDelete(uid) {
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')

  async function removeDocument(documentData) {
    if (!uid || !documentData?.id) return false
    setDeletingId(documentData.id)
    setError('')

    try {
      if (documentData.storagePath) {
        try {
          await deleteObject(ref(storage, documentData.storagePath))
        } catch (storageError) {
          if (storageError?.code !== 'storage/object-not-found') throw storageError
        }
      }

      const wrongCounts = new Map()
      const batch = writeBatch(db)

      for (const collectionName of RELATED_COLLECTIONS) {
        const snap = await getDocs(
          query(
            collection(db, collectionName),
            where('uid', '==', uid),
            where('docId', '==', documentData.id),
          ),
        )
        snap.docs.forEach((itemDoc) => {
          const data = itemDoc.data()
          if (collectionName === 'quizHistory' && data.isCorrect === false) {
            const code = data.standardCode || 'unknown'
            wrongCounts.set(code, (wrongCounts.get(code) || 0) + 1)
          }
          batch.delete(itemDoc.ref)
        })
      }

      wrongCounts.forEach((count, code) => {
        batch.set(
          doc(db, 'users', uid, 'weakStandards', code),
          { count: increment(-count), lastRolledBack: serverTimestamp() },
          { merge: true },
        )
      })

      batch.delete(doc(db, 'documents', documentData.id))
      await batch.commit()
      return true
    } catch (nextError) {
      setError(nextError.message)
      return false
    } finally {
      setDeletingId('')
    }
  }

  return { removeDocument, deletingId, error }
}
