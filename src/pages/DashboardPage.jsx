import { useState } from 'react'
import { addDoc, collection, doc, increment, serverTimestamp, setDoc } from 'firebase/firestore'
import { Sparkles } from 'lucide-react'
import { auth, db } from '../lib/firebase.js'
import { useLearningDashboard } from '../hooks/useLearningDashboard.js'
import EmptyState from '../components/common/EmptyState.jsx'
import LoadingSpinner from '../components/common/LoadingSpinner.jsx'
import StandardCard from '../components/Dashboard/StandardCard.jsx'
import demoMath2022 from '../data/demo_math_2022_user_data.json'

const { seed: DEMO_SEED } = demoMath2022

const showDemoTools = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_TOOLS === 'true'

export default function DashboardPage() {
  const uid = auth.currentUser?.uid
  const { cards, learningElements, loading, permError, error, extracting, runExtraction } = useLearningDashboard(uid)
  const [seedLoading, setSeedLoading] = useState(false)
  const [seedDone, setSeedDone] = useState(false)
  const [seedError, setSeedError] = useState('')

  async function addSeedData() {
    if (!uid || !db) return
    setSeedLoading(true)
    setSeedError('')
    try {
      const now = serverTimestamp()
      for (const item of DEMO_SEED.highlights) {
        await addDoc(collection(db, 'highlights'), {
          uid,
          docId: demoMath2022.document.docId,
          createdAt: now,
          ...item,
        })
      }
      for (const item of DEMO_SEED.chats) {
        await addDoc(collection(db, 'chatHistory'), {
          uid,
          docId: demoMath2022.document.docId,
          createdAt: now,
          ...item,
        })
      }
      for (const item of DEMO_SEED.quizzes) {
        await addDoc(collection(db, 'quizHistory'), {
          uid,
          docId: demoMath2022.document.docId,
          createdAt: now,
          options: item.options || ['O', 'X'],
          setId: demoMath2022.id,
          setSize: DEMO_SEED.quizzes.length,
          ...item,
        })
      }
      for (const item of DEMO_SEED.weakStandards) {
        await setDoc(
          doc(db, 'users', uid, 'weakStandards', item.standardCode),
          { count: increment(item.count), lastFailed: now },
          { merge: true },
        )
      }
      setSeedDone(true)
    } catch (err) {
      setSeedError(err.message)
    } finally {
      setSeedLoading(false)
    }
  }

  const genTime = learningElements?.generatedAt?.toDate?.()
    ? new Date(learningElements.generatedAt.toDate()).toLocaleString('ko-KR')
    : null

  const weakCards = cards.filter((c) => c.status === 'weak')
  const learningCards = cards.filter((c) => c.status === 'learning')
  const neutralCards = cards.filter((c) => c.status === 'neutral')

  return (
    <div className="dashboardPage">
      {permError && (
        <div className="permBanner">
          <strong>Firestore 읽기 규칙 설정이 필요합니다</strong>
          <p>
            Firebase Console의 Firestore Database Rules에 프로젝트의 <code>firestore.rules</code> 내용을 붙여넣고 게시해주세요.
            규칙 배포 후 새로고침하면 대시보드 데이터가 표시됩니다.
          </p>
        </div>
      )}

      <section className="dashboardSection">
        <div className="sectionHeader">
          <h2>핵심 학습 요소</h2>
          <button
            className="primaryButton"
            onClick={runExtraction}
            disabled={extracting || cards.length === 0}
          >
            <Sparkles size={16} />
            {extracting ? '분석 중...' : '학습 요소 분석'}
          </button>
        </div>

        {learningElements ? (
          <div className="profileCard">
            {learningElements.concepts?.length > 0 && (
              <div className="profileSection">
                <h3>학습한 핵심 개념</h3>
                <div className="conceptTags">
                  {learningElements.concepts.map((c) => <span key={c} className="conceptTag">{c}</span>)}
                </div>
              </div>
            )}
            {learningElements.weakPoints?.length > 0 && (
              <div className="profileSection">
                <h3>보완 필요 포인트</h3>
                <div className="conceptTags">
                  {learningElements.weakPoints.map((c) => <span key={c} className="weakTag">{c}</span>)}
                </div>
              </div>
            )}
            {learningElements.strongPoints?.length > 0 && (
              <div className="profileSection">
                <h3>잘 이해한 부분</h3>
                <div className="conceptTags">
                  {learningElements.strongPoints.map((c) => <span key={c} className="strongTag">{c}</span>)}
                </div>
              </div>
            )}
            {genTime && <p className="profileGenTime">마지막 분석: {genTime}</p>}
          </div>
        ) : (
          <p className="panelEmpty">
            퀴즈, 채팅, 메모 기록이 쌓인 뒤 오른쪽 버튼을 누르면 AI가 핵심 학습 요소를 분석합니다.
          </p>
        )}
      </section>

      <section className="dashboardSection">
        <h2>성취기준별 학습 현황</h2>

        {error && <p className="errorText">{error}</p>}
        {loading ? (
          <LoadingSpinner label="학습 데이터를 불러오는 중입니다." />
        ) : cards.length === 0 ? (
          <EmptyState
            title="학습 기록이 없습니다"
            description="PDF를 읽고 퀴즈, 채팅, 메모를 사용하면 성취기준별 학습 현황이 표시됩니다."
          />
        ) : (
          <div className="standardCardArea">
            {weakCards.length > 0 && (
              <div className="cardGroup">
                <p className="cardGroupLabel weak">취약 · 복습 필요 ({weakCards.length})</p>
                <div className="standardCardGrid">{weakCards.map((c) => <StandardCard key={c.standardCode} data={c} />)}</div>
              </div>
            )}
            {learningCards.length > 0 && (
              <div className="cardGroup">
                <p className="cardGroupLabel learning">이해 중 ({learningCards.length})</p>
                <div className="standardCardGrid">{learningCards.map((c) => <StandardCard key={c.standardCode} data={c} />)}</div>
              </div>
            )}
            {neutralCards.length > 0 && (
              <div className="cardGroup">
                <p className="cardGroupLabel neutral">학습 중 ({neutralCards.length})</p>
                <div className="standardCardGrid">{neutralCards.map((c) => <StandardCard key={c.standardCode} data={c} />)}</div>
              </div>
            )}
          </div>
        )}
      </section>

      {showDemoTools ? (
        <section className="devSection">
          <p className="devLabel">개발 테스트용 버튼입니다. 배포 빌드에서는 숨겨지며, 시연 전 데이터 흐름을 빠르게 확인할 때만 사용합니다.</p>
          <div className="buttonRow">
            <button className="secondaryButton" onClick={addSeedData} disabled={seedLoading || !uid}>
              {seedLoading ? '추가 중...' : '샘플 학습 기록 추가'}
            </button>
            {seedDone && <span className="seedSuccess">추가 완료. 위 카드를 확인하세요.</span>}
          </div>
          {seedError && <p className="errorText">{seedError}</p>}
        </section>
      ) : null}
    </div>
  )
}
