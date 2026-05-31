import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInAnonymously, signOut as firebaseSignOut } from 'firebase/auth'
import { auth, firebaseReady } from '../lib/firebase.js'

function readableAuthError(error) {
  if (error?.code?.includes('operation-not-allowed')) {
    return 'Firebase Authentication에서 익명 로그인을 활성화해주세요.'
  }
  return error?.message || '시연 세션을 준비하는 중 문제가 발생했습니다.'
}

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(firebaseReady)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return undefined
    }

    let active = true
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return

      if (nextUser) {
        setUser(nextUser)
        setError('')
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        await signInAnonymously(auth)
      } catch (nextError) {
        if (!active) return
        setError(readableAuthError(nextError))
        setLoading(false)
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  async function resetSession() {
    setError('')
    setLoading(true)
    await firebaseSignOut(auth)
  }

  return {
    user,
    loading,
    error,
    resetSession,
    firebaseReady,
  }
}
