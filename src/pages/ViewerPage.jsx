import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, MessageCircle, NotebookPen, Sparkles } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { doc as firestoreDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase.js'
import { generateLearningGoals, generateOxQuestion } from '../lib/gemini.js'
import { findLearningTargets, findStandards, getSummary } from '../lib/ncicMapper.js'
import { extractSelection } from '../lib/selectionUtils.js'
import { useDocument } from '../hooks/useDocument.js'
import { useDocumentStore } from '../store/documentStore.js'
import { useMemos } from '../hooks/useMemos.js'
import { useChatMessages } from '../hooks/useChatMessages.js'
import { useQuizHistory } from '../hooks/useQuizHistory.js'
import StandardsBadge from '../components/Viewer/StandardsBadge.jsx'
import PublicDataModal from '../components/Viewer/PublicDataModal.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import LoadingSpinner from '../components/common/LoadingSpinner.jsx'
import LearningGoalBanner from '../components/Goals/LearningGoalBanner.jsx'
import LearningGoalModal from '../components/Goals/LearningGoalModal.jsx'
import OxGateModal from '../components/Quiz/OxGateModal.jsx'
import StudySidePanel from '../components/Sidebar/StudySidePanel.jsx'
import HighlightOverlay from '../components/Viewer/HighlightOverlay.jsx'
import SelectionColorPicker from '../components/Viewer/SelectionColorPicker.jsx'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

export default function ViewerPage() {
  const { docId } = useParams()
  const uid = auth.currentUser?.uid
  const { documentData, loading, error } = useDocument(docId)
  const { currentPage, setCurrentPage } = useDocumentStore()
  const { memos, memoText, addMemo, removeMemo } = useMemos(uid, docId)
  const { turns, sending, send, error: chatError } = useChatMessages(uid, docId)
  const {
    record,
    updateResult,
    items: quizHistory,
    loading: quizHistoryLoading,
    error: quizHistoryError,
  } = useQuizHistory(uid, docId)
  const studyMainRef = useRef(null)
  const pdfWrapRef = useRef(null)
  const [pendingSelection, setPendingSelection] = useState(null)
  const [pendingHighlight, setPendingHighlight] = useState('')
  const [pageCount, setPageCount] = useState(0)
  const [pageWidth, setPageWidth] = useState(() => Math.max(280, Math.min(980, window.innerWidth - 48)))
  const [activeTab, setActiveTab] = useState('chat')
  const [goalOpen, setGoalOpen] = useState(false)
  const [goalGenerating, setGoalGenerating] = useState(false)
  const [goalAttempted, setGoalAttempted] = useState(false)
  const [goalAcknowledged, setGoalAcknowledged] = useState(false)
  const [gateEnabled, setGateEnabled] = useState(() => localStorage.getItem('costudy:gate') === 'true')
  const [gateOpen, setGateOpen] = useState(false)
  const [gateLoading, setGateLoading] = useState(false)
  const [gateQuestion, setGateQuestion] = useState(null)
  const [gateTargetPage, setGateTargetPage] = useState(null)
  const [gateFeedback, setGateFeedback] = useState(null)
  const [publicDataOpen, setPublicDataOpen] = useState(false)

  const pageTexts = documentData?.pageTexts || []
  const currentPageText = pageTexts[currentPage - 1] || ''
  const savedStandards = documentData?.standards || []
  const savedStandardTargets = documentData?.standardTargets || []
  const fallbackMapping = useMemo(() => {
    if (savedStandards.length) {
      return { standards: savedStandards, standardTargets: savedStandardTargets }
    }

    const previewText = pageTexts.slice(0, 5).join('\n').slice(0, 4000)
    if (!previewText.trim()) {
      return { standards: [], standardTargets: [] }
    }

    const mappedStandards = findStandards(previewText)
    return {
      standards: mappedStandards,
      standardTargets: findLearningTargets(previewText, mappedStandards),
    }
  }, [pageTexts, savedStandardTargets, savedStandards])
  const standards = fallbackMapping.standards
  const standardTargets = fallbackMapping.standardTargets
  const standardCode = standards[0] || 'unknown'
  const goals = documentData?.learningGoals || []
  const goalStorageKey = docId ? `costudy:goals:${docId}` : ''
  const pdfSource = useMemo(() => {
    if (!documentData?.storageUrl) return ''
    return import.meta.env.DEV && documentData.storageUrl.startsWith('https://firebasestorage.googleapis.com')
      ? documentData.storageUrl.replace('https://firebasestorage.googleapis.com', '/__firebase_storage')
      : documentData.storageUrl
  }, [documentData?.storageUrl])

  useEffect(() => {
    if (!goalStorageKey) return
    setGoalAcknowledged(localStorage.getItem(goalStorageKey) === 'true')
    setGoalOpen(false)
    setGoalAttempted(false)
  }, [goalStorageKey])

  useEffect(() => {
    function updatePageWidth(width) {
      const viewportPadding = window.innerWidth < 760 ? 24 : 72
      setPageWidth(Math.max(280, Math.min(980, Math.floor(width - viewportPadding))))
    }

    const node = studyMainRef.current
    if (!node) return undefined

    function measure() {
      updatePageWidth(node.getBoundingClientRect().width)
    }

    measure()
    const observer = new ResizeObserver((entries) => {
      updatePageWidth(entries[0].contentRect.width)
    })
    observer.observe(node)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('costudy:gate', String(gateEnabled))
  }, [gateEnabled])

  useEffect(() => {
    if (!documentData || savedStandards.length || !standards.length || !docId) return

    const summary = getSummary(standards)
    updateDoc(firestoreDoc(db, 'documents', docId), {
      standards,
      standardTargets,
      subject: summary.subject,
      grade: summary.grade,
      unit: summary.unit,
    }).catch((mappingError) => console.warn(mappingError))
  }, [docId, documentData, savedStandards.length, standardTargets, standards])

  useEffect(() => {
    setPendingSelection(null)
    window.getSelection()?.removeAllRanges()
  }, [currentPage])

  useEffect(() => {
    async function ensureGoals() {
      if (!documentData || goals.length || goalGenerating || goalAttempted || !pageTexts[0]) return
      setGoalAttempted(true)
      setGoalGenerating(true)
      try {
        const generated = await generateLearningGoals(pageTexts[0], standards, standardTargets)
        if (generated.length) {
          await updateDoc(firestoreDoc(db, 'documents', docId), { learningGoals: generated })
        }
      } catch (goalError) {
        console.warn(goalError)
      } finally {
        setGoalGenerating(false)
      }
    }

    ensureGoals()
  }, [documentData, docId, goalAttempted, goalGenerating, goals.length, pageTexts, standards, standardTargets])

  useEffect(() => {
    if (!documentData || goalAcknowledged || goalGenerating) return
    if (goals.length || goalAttempted) setGoalOpen(true)
  }, [documentData, goalAcknowledged, goalAttempted, goalGenerating, goals.length])

  if (loading) return <LoadingSpinner label="문서를 불러오는 중입니다." />
  if (error) return <p className="errorText">{error}</p>
  if (!documentData) {
    return (
      <EmptyState
        title="문서를 찾을 수 없습니다"
        description="라이브러리에서 다시 선택해주세요."
      />
    )
  }

  const canPrev = currentPage > 1
  const canNext = pageCount ? currentPage < pageCount : false

  function closeGoalModal() {
    if (goalStorageKey) localStorage.setItem(goalStorageKey, 'true')
    setGoalAcknowledged(true)
    setGoalOpen(false)
  }

  function dismissGoalModal() {
    setGoalOpen(false)
  }

  async function requestPageChange(nextPage) {
    if (nextPage < 1 || (pageCount && nextPage > pageCount)) return
    if (nextPage <= currentPage || !gateEnabled) {
      setCurrentPage(nextPage)
      return
    }

    setGateOpen(true)
    setGateLoading(true)
    setGateFeedback(null)
    setGateTargetPage(nextPage)
    try {
      const question = currentPageText
        ? await generateOxQuestion(currentPageText, currentPage, standards)
        : {
            statement: '현재 페이지의 핵심 내용을 확인했습니다.',
            answer: true,
            explanation: '텍스트 추출이 부족한 페이지라 기본 확인 질문으로 대체했습니다.',
          }
      setGateQuestion(question)
    } catch (gateError) {
      console.warn(gateError)
      setGateQuestion({
        statement: '현재 페이지에서 중요한 내용을 한 번 이상 확인했습니다.',
        answer: true,
        explanation: 'AI 질문 생성에 실패해 기본 확인 질문으로 대체했습니다.',
      })
    } finally {
      setGateLoading(false)
    }
  }

  async function answerGate(answer) {
    if (!gateQuestion) return
    const correct = answer === gateQuestion.answer
    await record({
      standardCode,
      question: gateQuestion.statement,
      isCorrect: correct,
      mode: 'ox-gate',
      page: currentPage,
      scope: 'page',
      answer: gateQuestion.answer,
      selectedAnswer: answer,
      explanation: gateQuestion.explanation || '',
      setId: `ox:${docId}:${Date.now()}`,
      setTitle: `${currentPage}페이지 O/X 확인`,
      setSize: 1,
      sequence: 1,
    })
    setGateFeedback({ correct, explanation: gateQuestion.explanation })
    if (correct) {
      setTimeout(() => {
        setGateOpen(false)
        setCurrentPage(gateTargetPage)
      }, 500)
    }
  }

  async function sendChat(question, extraContext = '') {
    const highlightCtx = extraContext || pendingHighlight
    setPendingHighlight('')
    await send(question, {
      standards,
      standardTargets,
      pageNumber: currentPage,
      pageText: currentPageText,
      highlightText: highlightCtx,
    })
  }

  function handlePdfMouseUp() {
    setTimeout(() => {
      const sel = extractSelection(pdfWrapRef.current)
      if (sel) setPendingSelection(sel)
    }, 10)
  }

  async function handleColorPick(colorKey) {
    if (!pendingSelection) return
    const { text, rects } = pendingSelection
    setPendingSelection(null)
    window.getSelection()?.removeAllRanges()
    await addMemo({ text, rects, color: colorKey, page: currentPage, standardCode })
    setActiveTab('memo')
  }

  function dismissColorPicker() {
    setPendingSelection(null)
  }

  function explainGate() {
    setActiveTab('chat')
    setGateOpen(false)
    sendChat(`다음 O/X 질문을 쉽게 설명해줘: ${gateQuestion?.statement || ''}`, gateQuestion?.statement || '')
  }

  return (
    <section className="studyViewer">
      <div className="viewerTopBar">
        <div className="viewerTitleBlock">
          <h2>{documentData.title}</h2>
        </div>
        <div className="topPageControl" aria-label="페이지 이동">
          <button className="iconButton" disabled={!canPrev} onClick={() => requestPageChange(currentPage - 1)} aria-label="이전 페이지">
            <ChevronLeft size={20} />
          </button>
          <span>{currentPage} / {pageCount || '-'}</span>
          <button className="iconButton" disabled={!canNext} onClick={() => requestPageChange(currentPage + 1)} aria-label="다음 페이지">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="viewerMetaControls">
          <StandardsBadge documentData={documentData} standards={standards} onOpenPublicData={() => setPublicDataOpen(true)} />
          <button className={gateEnabled ? 'togglePill active' : 'togglePill'} onClick={() => setGateEnabled(!gateEnabled)}>
            잠금 {gateEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="studyWorkspace">
        <div className="studyMain" ref={studyMainRef}>
          <LearningGoalBanner goals={goals} generating={goalGenerating} open={() => setGoalOpen(true)} />
          <div className="pdfScrollArea" onMouseUp={handlePdfMouseUp}>
            <div className="pdfFrame presentationFrame">
              <Document
                file={pdfSource}
                loading={<LoadingSpinner label="PDF를 여는 중입니다." />}
                error={<EmptyState title="PDF를 표시할 수 없습니다" description="파일 주소, Storage 권한 또는 CORS 설정을 확인해주세요." />}
                onLoadSuccess={({ numPages }) => {
                  setPageCount(numPages)
                  if (currentPage > numPages) setCurrentPage(1)
                }}
              >
                <div className="pdfPageWrap" ref={pdfWrapRef}>
                  <Page pageNumber={currentPage} width={pageWidth} />
                  <HighlightOverlay memos={memos} currentPage={currentPage} />
                </div>
              </Document>
            </div>
          </div>
          {pendingSelection && (
            <SelectionColorPicker
              pickerPos={pendingSelection.pickerPos}
              onSelect={handleColorPick}
              onDismiss={dismissColorPicker}
            />
          )}

          <div className="studyToolbarWrap">
            <div className="studyToolbar">
              <button className="toolPill active">페이지</button>
              <button className={activeTab === 'memo' ? 'toolPill active' : 'toolPill'} onClick={() => setActiveTab('memo')}>
                <NotebookPen size={16} />
                메모
              </button>
              <button className={activeTab === 'chat' ? 'toolPill active' : 'toolPill'} onClick={() => setActiveTab('chat')}>
                <MessageCircle size={16} />
                Chat
              </button>
              <button className={activeTab === 'quiz' ? 'toolPill active' : 'toolPill'} onClick={() => setActiveTab('quiz')}>
                <Sparkles size={16} />
                Quiz
              </button>
              <button className="toolPill check" onClick={() => setGoalOpen(true)}>목표 확인</button>
            </div>
          </div>
        </div>

        <StudySidePanel
          activeTab={activeTab}
          turns={turns}
          sending={sending}
          chatError={chatError}
          onSendChat={(nextQuestion) => sendChat(nextQuestion)}
          memos={memos}
          memoText={memoText}
          onDeleteMemo={removeMemo}
          onSendMemoToChat={(memo) => {
            setPendingHighlight(memo.text)
            setActiveTab('chat')
          }}
          pageText={currentPageText}
          pageTexts={pageTexts}
          currentPage={currentPage}
          pageCount={pageCount}
          standardCode={standardCode}
          standards={standards}
          onRecordQuiz={record}
          onUpdateQuizResult={updateResult}
          quizHistory={quizHistory}
          quizHistoryLoading={quizHistoryLoading}
          quizHistoryError={quizHistoryError}
          pendingHighlight={pendingHighlight}
          onClearPendingHighlight={() => setPendingHighlight('')}
        />
      </div>

      {goalOpen ? <LearningGoalModal goals={goals} onClose={closeGoalModal} onExit={dismissGoalModal} /> : null}
      {gateOpen ? (
        <OxGateModal
          question={gateQuestion}
          loading={gateLoading}
          feedback={gateFeedback}
          onAnswer={answerGate}
          onClose={() => setGateOpen(false)}
          onExplain={explainGate}
        />
      ) : null}
      {publicDataOpen ? <PublicDataModal standards={standards} matchedTargets={standardTargets} onClose={() => setPublicDataOpen(false)} /> : null}
    </section>
  )
}
