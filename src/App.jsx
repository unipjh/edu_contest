import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { BookOpen, Gauge } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth.js'
import EmptyState from './components/common/EmptyState.jsx'

export default function App() {
  const { user, loading, error, firebaseReady } = useAuth()
  const location = useLocation()
  const isViewer = location.pathname.startsWith('/viewer')
  const [online, setOnline] = useState(() => navigator.onLine)

  const mainClassName = isViewer ? 'mainArea viewerMainArea' : 'mainArea'

  useEffect(() => {
    function updateOnline() {
      setOnline(navigator.onLine)
    }

    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  return (
    <div className={isViewer ? 'appShell viewerShell' : 'appShell'}>
      <header className="topBar">
        <div>
          <p className="eyebrow">NCIC 기반 학습 흐름</p>
          <NavLink className="brandLink" to="/library">Co-Study</NavLink>
        </div>
        <nav className="navLinks" aria-label="주요 메뉴">
          <NavLink to="/library">
            <BookOpen size={18} />
            라이브러리
          </NavLink>
          <NavLink to="/dashboard">
            <Gauge size={18} />
            대시보드
          </NavLink>
        </nav>
      </header>

      {!online ? (
        <div className="networkBanner" role="status">
          네트워크 연결이 불안정합니다. 이미 불러온 기록은 볼 수 있지만 업로드, AI 응답, 대시보드 갱신은 지연될 수 있습니다.
        </div>
      ) : null}

      {!firebaseReady ? (
        <main className="mainArea">
          <EmptyState
            title="Firebase 환경 변수가 필요합니다"
            description=".env.local에 Firebase 설정과 Gemini API 키를 입력하면 업로드와 성취기준 연결을 시작할 수 있습니다."
          />
        </main>
      ) : loading ? (
        <main className="mainArea">
          <EmptyState title="시연 세션 준비 중" description="익명 사용자 세션을 만들고 있습니다." />
        </main>
      ) : error ? (
        <main className="mainArea">
          <EmptyState title="시연 세션을 시작할 수 없습니다" description={error} />
        </main>
      ) : !user ? (
        <main className="mainArea">
          <EmptyState title="세션 정보를 찾을 수 없습니다" description="페이지를 새로고침한 뒤 다시 시도해주세요." />
        </main>
      ) : (
        <main className={mainClassName}>
          <Outlet />
        </main>
      )}
    </div>
  )
}
