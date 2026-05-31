import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, FileStack, Filter, ListChecks, RefreshCw, X } from 'lucide-react'
import { generateQuiz, generateQuizSet } from '../../lib/gemini.js'
import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_MAP } from '../../lib/highlightColors.js'

const QUIZ_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'page', label: '현재 페이지' },
  { key: 'document', label: '전체 범위' },
  { key: 'ox-gate', label: 'O/X' },
  { key: 'correct', label: '정답' },
  { key: 'wrong', label: '오답' },
  { key: 'pending', label: '미풀이' },
]

function makeDocumentQuizText(pageTexts = []) {
  return pageTexts
    .map((text, index) => {
      const clean = String(text || '').trim()
      if (!clean) return ''
      return `[${index + 1}페이지]\n${clean.slice(0, 900)}`
    })
    .filter(Boolean)
    .join('\n\n')
}

function formatTime(value) {
  const date = value?.toDate?.()
  if (!date) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatOxAnswer(value) {
  if (value === true) return 'O'
  if (value === false) return 'X'
  return '-'
}

function isAnswered(item) {
  return item?.isCorrect === true || item?.isCorrect === false
}

function getSetKey(item) {
  if (item.mode === 'ox-gate') return 'ox-gate:all'
  if (item.setId) return item.setId
  return `${item.mode || 'quiz'}:${item.id}`
}

function getSetTitle(item) {
  if (item.mode === 'ox-gate') return 'O/X 퀴즈'
  if (item.setTitle) return item.setTitle
  if (item.scope === 'document') return '전체 범위 퀴즈'
  return `${item.page || '-'}페이지 퀴즈`
}

function itemMatchesFilter(item, filter) {
  if (filter === 'all') return true
  if (filter === 'page') return item.mode === 'quiz' && item.scope === 'page'
  if (filter === 'document') return item.mode === 'quiz' && item.scope === 'document'
  if (filter === 'ox-gate') return item.mode === 'ox-gate'
  if (filter === 'correct') return item.isCorrect === true
  if (filter === 'wrong') return item.isCorrect === false
  if (filter === 'pending') return !isAnswered(item)
  return true
}

function buildQuizGroups(items, filter) {
  const groups = new Map()
  items
    .filter((item) => item.mode === 'quiz' || item.mode === 'ox-gate')
    .forEach((item) => {
      if (!itemMatchesFilter(item, filter)) return
      const key = getSetKey(item)
      const group = groups.get(key) || {
        key,
        title: getSetTitle(item),
        mode: item.mode,
        scope: item.scope,
        page: item.page,
        createdAt: item.createdAt,
        total: item.setSize || 1,
        items: [],
      }
      group.items.push(item)
      if (!group.createdAt && item.createdAt) group.createdAt = item.createdAt
      group.total = Math.max(group.total || 1, item.setSize || 1, group.items.length)
      groups.set(key, group)
    })

  return [...groups.values()]
    .map((group) => {
      const sortedItems = group.mode === 'ox-gate'
        ? [...group.items].sort((a, b) => {
            const pageDiff = (a.page || 0) - (b.page || 0)
            if (pageDiff) return pageDiff
            return (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0)
          })
        : [...group.items].sort((a, b) => (a.sequence || 1) - (b.sequence || 1))

      return {
        ...group,
        total: group.mode === 'ox-gate' ? sortedItems.length : group.total,
        items: sortedItems,
      }
    })
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
}

export default function StudySidePanel({
  activeTab,
  turns,
  sending,
  chatError,
  onSendChat,
  memos,
  memoText,
  onDeleteMemo,
  onSendMemoToChat,
  pageText,
  pageTexts = [],
  currentPage,
  pageCount,
  standardCode,
  onRecordQuiz,
  onUpdateQuizResult,
  quizHistory = [],
  quizHistoryLoading,
  quizHistoryError,
  pendingHighlight,
  onClearPendingHighlight,
}) {
  const [question, setQuestion] = useState('')
  const [activeSetKey, setActiveSetKey] = useState('')
  const [activeQuizId, setActiveQuizId] = useState('')
  const [expandedSetIds, setExpandedSetIds] = useState(() => new Set())
  const [quizLoadingScope, setQuizLoadingScope] = useState('')
  const [quizError, setQuizError] = useState('')
  const [quizFilter, setQuizFilter] = useState('all')
  const [oxReviewOpen, setOxReviewOpen] = useState(false)
  const [selectedOxId, setSelectedOxId] = useState('')
  const messagesEndRef = useRef(null)

  const messages = useMemo(
    () => turns.flatMap((turn) => [
      { id: `${turn.id}:q`, role: 'user', content: turn.question, contextText: turn.contextText || '' },
      { id: `${turn.id}:a`, role: 'assistant', content: turn.answer },
    ]),
    [turns],
  )

  const oxHistory = useMemo(
    () => quizHistory.filter((item) => item.mode === 'ox-gate'),
    [quizHistory],
  )

  const selectedOx = useMemo(
    () => oxHistory.find((item) => item.id === selectedOxId) || oxHistory[0] || null,
    [oxHistory, selectedOxId],
  )

  const quizGroups = useMemo(
    () => buildQuizGroups(quizHistory, quizFilter),
    [quizHistory, quizFilter],
  )

  const activeGroup = useMemo(
    () => quizGroups.find((group) => group.key === activeSetKey) || quizGroups[0] || null,
    [activeSetKey, quizGroups],
  )

  const activeQuiz = useMemo(
    () => activeGroup?.items.find((item) => item.id === activeQuizId) || activeGroup?.items[0] || null,
    [activeGroup, activeQuizId],
  )

  const activeQuizIndex = activeGroup && activeQuiz
    ? activeGroup.items.findIndex((item) => item.id === activeQuiz.id)
    : -1

  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, activeTab])

  useEffect(() => {
    if (selectedOxId && !oxHistory.some((item) => item.id === selectedOxId)) {
      setSelectedOxId('')
    }
  }, [oxHistory, selectedOxId])

  useEffect(() => {
    if (!quizGroups.length) {
      setActiveSetKey('')
      setActiveQuizId('')
      return
    }
    if (!activeGroup) {
      setActiveSetKey(quizGroups[0].key)
      setActiveQuizId(quizGroups[0].items[0]?.id || '')
    } else if (activeQuiz && activeQuiz.id !== activeQuizId) {
      setActiveQuizId(activeQuiz.id)
    }
  }, [activeGroup, activeQuiz, activeQuizId, quizGroups])

  async function submitChat(event) {
    event.preventDefault()
    const clean = question.trim()
    if (!clean) return
    setQuestion('')
    await onSendChat(clean)
  }

  async function createQuiz(scope) {
    const isDocumentScope = scope === 'document'
    const sourceText = isDocumentScope ? makeDocumentQuizText(pageTexts) : (pageText || memoText)
    if (!sourceText.trim()) {
      setQuizError(isDocumentScope ? '전체 문서에서 추출된 텍스트가 아직 없습니다.' : '현재 페이지에서 추출된 텍스트가 아직 없습니다.')
      return
    }

    setQuizLoadingScope(scope)
    setQuizError('')
    try {
      const quizCount = isDocumentScope
        ? Math.min(10, Math.max(1, pageCount || pageTexts.filter((text) => String(text || '').trim()).length || 1))
        : 1
      const scopeLabel = isDocumentScope ? `전체 ${pageCount || pageTexts.length || ''}페이지` : `${currentPage}페이지`
      const nextQuizzes = isDocumentScope
        ? await generateQuizSet(sourceText, standardCode, quizCount, { scopeLabel, maxLength: 7000 })
        : [await generateQuiz(sourceText, standardCode, { scopeLabel, maxLength: 3000 })]

      if (!nextQuizzes.length || nextQuizzes.some((quiz) => !quiz?.question || !Array.isArray(quiz.options))) {
        throw new Error('퀴즈 형식이 올바르지 않습니다.')
      }

      const setId = `quiz:${scope}:${Date.now()}`
      const setTitle = isDocumentScope ? `전체 범위 퀴즈 ${nextQuizzes.length}문항` : `${currentPage}페이지 퀴즈`
      const savedIds = []
      for (const [index, quiz] of nextQuizzes.entries()) {
        const savedId = await onRecordQuiz({
          standardCode: quiz.standard_code || standardCode,
          question: quiz.question,
          isCorrect: null,
          mode: 'quiz',
          page: isDocumentScope ? null : currentPage,
          scope,
          options: quiz.options,
          answer: quiz.answer,
          selectedAnswer: null,
          explanation: quiz.explanation || '',
          setId,
          setTitle,
          setSize: nextQuizzes.length,
          sequence: index + 1,
        })
        if (savedId) savedIds.push(savedId)
      }

      setActiveSetKey(setId)
      setActiveQuizId(savedIds[0] || '')
      setExpandedSetIds((prev) => new Set([...prev, setId]))
    } catch (error) {
      setQuizError(error.message)
    } finally {
      setQuizLoadingScope('')
    }
  }

  async function answerQuiz(index) {
    if (!activeQuiz || isAnswered(activeQuiz)) return
    const correct = index === activeQuiz.answer
    await onUpdateQuizResult({
      quizId: activeQuiz.id,
      standardCode: activeQuiz.standardCode || standardCode,
      isCorrect: correct,
      selectedAnswer: index,
    })
  }

  function selectGroup(group) {
    setActiveSetKey(group.key)
    setActiveQuizId(group.items[0]?.id || '')
    setExpandedSetIds((prev) => new Set([...prev, group.key]))
  }

  function toggleGroup(group) {
    setExpandedSetIds((prev) => {
      const next = new Set(prev)
      if (next.has(group.key)) next.delete(group.key)
      else next.add(group.key)
      return next
    })
    if (activeSetKey !== group.key) selectGroup(group)
  }

  function moveActiveQuiz(step) {
    if (!activeGroup || activeQuizIndex < 0) return
    const nextIndex = activeQuizIndex + step
    if (nextIndex < 0 || nextIndex >= activeGroup.items.length) return
    setActiveQuizId(activeGroup.items[nextIndex].id)
  }

  function openOxReview() {
    setSelectedOxId(oxHistory[0]?.id || '')
    setOxReviewOpen(true)
  }

  return (
    <aside className="studySidePanel">
      <div className="sideHint">하이라이트나 메모를 Chat 맥락으로 보낼 수 있어요.</div>

      {activeTab === 'chat' ? (
        <section className="panelBody chatPanel">
          <div className="messageList">
            {messages.length ? messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            )) : (
              <p className="panelEmpty">궁금한 내용을 질문하거나 메모 탭에서 하이라이트를 Chat으로 보내보세요.</p>
            )}
            <div ref={messagesEndRef} />
          </div>
          {chatError ? <p className="errorText">{chatError}</p> : null}
          {pendingHighlight ? (
            <div className="chatContextChip">
              <span className="chatContextLabel">맥락</span>
              <span className="chatContextText">"{pendingHighlight.slice(0, 60)}{pendingHighlight.length > 60 ? '...' : ''}"</span>
              <button className="chipIconButton" onClick={onClearPendingHighlight} aria-label="맥락 삭제" title="맥락 삭제">
                <X size={14} />
              </button>
            </div>
          ) : null}
          <form className="chatInputRow" onSubmit={submitChat}>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  submitChat(event)
                }
              }}
              placeholder="질문을 입력하세요. Enter 전송, Shift+Enter 줄바꿈"
            />
            <button className="primaryButton" disabled={sending}>{sending ? '전송 중' : '전송'}</button>
          </form>
        </section>
      ) : null}

      {activeTab === 'memo' ? (
        <section className="panelBody memoPanel">
          {memos.length ? memos.map((memo) => {
            const colorHex = HIGHLIGHT_COLOR_MAP[memo.color] || HIGHLIGHT_COLOR_MAP.yellow
            const colorLabel = HIGHLIGHT_COLORS.find((color) => color.key === memo.color)?.label || '중요'
            return (
              <article className="memoCard" key={memo.id}>
                <div className="memoCardHeader">
                  <span
                    className="memoColorDot"
                    style={{ background: HIGHLIGHT_COLORS.find((color) => color.key === memo.color)?.hex || colorHex }}
                    title={colorLabel}
                  />
                  <span className="memoPage">{memo.page || currentPage}p</span>
                </div>
                <strong>{memo.text}</strong>
                {memo.memo ? <p>{memo.memo}</p> : null}
                <div className="buttonRow">
                  <button className="secondaryButton" onClick={() => onSendMemoToChat(memo)}>Chat</button>
                  <button
                    className="ghostButton dangerText"
                    onClick={() => {
                      if (window.confirm('하이라이트와 메모를 삭제할까요?')) onDeleteMemo(memo.id)
                    }}
                  >
                    하이라이트 삭제
                  </button>
                </div>
              </article>
            )
          }) : (
            <p className="panelEmpty">PDF에서 텍스트를 드래그하면 색상 선택 팝업이 표시됩니다.</p>
          )}
        </section>
      ) : null}

      {activeTab === 'quiz' ? (
        <section className="panelBody quizPanel">
          <div className="quizActionGrid">
            <button className="primaryButton" onClick={() => createQuiz('page')} disabled={!!quizLoadingScope}>
              <RefreshCw size={16} />
              {quizLoadingScope === 'page' ? '생성 중' : '현재 페이지'}
            </button>
            <button className="secondaryButton" onClick={() => createQuiz('document')} disabled={!!quizLoadingScope}>
              <FileStack size={16} />
              {quizLoadingScope === 'document' ? '생성 중' : '전체 범위'}
            </button>
          </div>
          <div className="quizUtilityRow single">
            <button className="secondaryButton" onClick={openOxReview} disabled={!oxHistory.length}>
              <ListChecks size={16} />
              이전 O/X 다시 보기
            </button>
          </div>

          {quizError ? <p className="errorText">{quizError}</p> : null}
          {quizHistoryError ? <p className="errorText">{quizHistoryError}</p> : null}

          {activeQuiz ? (
            <QuizCard
              quiz={activeQuiz}
              group={activeGroup}
              index={activeQuizIndex}
              onAnswer={answerQuiz}
              onPrev={() => moveActiveQuiz(-1)}
              onNext={() => moveActiveQuiz(1)}
            />
          ) : (
            <p className="panelEmpty">현재 페이지 또는 전체 문서 범위로 자기 점검 퀴즈를 만들 수 있습니다.</p>
          )}

          <PanelSubhead icon={<Filter size={15} />} title="퀴즈 세트" />
          <div className="filterChips">
            {QUIZ_FILTERS.map((filter) => (
              <button key={filter.key} className={quizFilter === filter.key ? 'active' : ''} onClick={() => setQuizFilter(filter.key)}>
                {filter.label}
              </button>
            ))}
          </div>
          <div className="quizSetList">
            {quizHistoryLoading ? <p className="panelEmpty">퀴즈 기록을 불러오는 중입니다.</p> : null}
            {!quizHistoryLoading && quizGroups.length ? quizGroups.map((group) => (
              <QuizSetGroup
                key={group.key}
                group={group}
                activeQuizId={activeQuiz?.id}
                expanded={expandedSetIds.has(group.key) || activeGroup?.key === group.key}
                onToggle={() => toggleGroup(group)}
                onSelectQuiz={(quiz) => {
                  setActiveSetKey(group.key)
                  setActiveQuizId(quiz.id)
                }}
              />
            )) : null}
            {!quizHistoryLoading && !quizGroups.length ? <p className="panelEmpty">선택한 조건의 퀴즈가 없습니다.</p> : null}
          </div>
        </section>
      ) : null}

      {oxReviewOpen ? (
        <OxReviewModal
          oxHistory={oxHistory}
          selectedOx={selectedOx}
          selectedOxId={selectedOxId}
          onSelect={setSelectedOxId}
          onClose={() => setOxReviewOpen(false)}
        />
      ) : null}
    </aside>
  )
}

function QuizCard({ quiz, group, index, onAnswer, onPrev, onNext }) {
  const answered = isAnswered(quiz)
  const selectedAnswer = quiz.selectedAnswer
  const isOx = quiz.mode === 'ox-gate'
  const options = isOx ? ['O', 'X'] : quiz.options || []
  const answerIndex = isOx ? (quiz.answer ? 0 : 1) : quiz.answer
  const selectedIndex = isOx ? (quiz.selectedAnswer === true ? 0 : quiz.selectedAnswer === false ? 1 : null) : selectedAnswer

  return (
    <article className="quizCard">
      <div className="quizCardMeta">
        <span>{group?.title || (quiz.scope === 'document' ? '전체 범위' : `${quiz.page || '-'}p`)}</span>
        {group?.items.length > 1 ? <span>{index + 1} / {group.items.length}</span> : null}
        {answered ? (
          <span className={quiz.isCorrect ? 'correctText' : 'wrongText'}>{quiz.isCorrect ? '정답' : '오답'}</span>
        ) : (
          <span>미풀이</span>
        )}
      </div>
      <strong>{quiz.question}</strong>
      <div className="quizOptions">
        {options.map((option, optionIndex) => {
          const isAnswer = optionIndex === answerIndex
          const isPicked = optionIndex === selectedIndex
          return (
            <button
              key={`${quiz.id}:${option}`}
              className={answered && isAnswer ? 'correct' : answered && isPicked ? 'wrong' : ''}
              onClick={() => onAnswer(isOx ? optionIndex === 0 : optionIndex)}
              disabled={answered}
            >
              {option}
            </button>
          )
        })}
      </div>
      {answered ? <p className="quizExplanation">{quiz.explanation || '저장된 해설이 없습니다.'}</p> : null}
      {group?.items.length > 1 ? (
        <div className="quizNavRow">
          <button className="secondaryButton" onClick={onPrev} disabled={index <= 0}>
            <ChevronLeft size={16} />
            이전 퀴즈
          </button>
          <button className="secondaryButton" onClick={onNext} disabled={index >= group.items.length - 1}>
            다음 퀴즈
            <ChevronRight size={16} />
          </button>
        </div>
      ) : null}
    </article>
  )
}

function QuizSetGroup({ group, activeQuizId, expanded, onToggle, onSelectQuiz }) {
  const answeredCount = group.items.filter(isAnswered).length
  const wrongCount = group.items.filter((item) => item.isCorrect === false).length
  const firstItem = group.items[0]

  return (
    <article className={expanded ? 'quizSetGroup expanded' : 'quizSetGroup'}>
      <button className="quizSetHeader" onClick={onToggle}>
        <span>{group.mode === 'ox-gate' ? 'O/X' : group.scope === 'document' ? '전체 범위' : '현재 페이지'}</span>
        <strong>{group.title}</strong>
        <em>
          {answeredCount}/{group.total || group.items.length} 풀이
          {wrongCount ? ` · 오답 ${wrongCount}` : ''}
          {formatTime(firstItem?.createdAt) ? ` · ${formatTime(firstItem.createdAt)}` : ''}
        </em>
      </button>
      {expanded ? (
        <div className="quizSetItems">
          {group.items.map((quiz) => (
            <button
              key={quiz.id}
              className={activeQuizId === quiz.id ? 'quizSetItem active' : 'quizSetItem'}
              onClick={() => onSelectQuiz(quiz)}
            >
              <span>{quiz.mode === 'ox-gate' ? `${quiz.page || '-'}p` : `문제 ${quiz.sequence || 1}`}</span>
              <strong>{quiz.question}</strong>
              <em className={quiz.isCorrect === false ? 'wrongText' : quiz.isCorrect === true ? 'correctText' : ''}>
                {quiz.isCorrect === true ? '정답' : quiz.isCorrect === false ? '오답' : '미풀이'}
              </em>
            </button>
          ))}
        </div>
      ) : null}
    </article>
  )
}

function PanelSubhead({ icon, title }) {
  return (
    <div className="panelSubhead">
      {icon}
      <span>{title}</span>
    </div>
  )
}

function ChatMessage({ message }) {
  const { body, source } = splitAssistantSource(message.content)

  return (
    <article className={`chatBubble ${message.role}`}>
      {message.role === 'user' && message.contextText ? (
        <div className="sentContextBlock">
          <span>맥락</span>
          <p>{message.contextText}</p>
        </div>
      ) : null}
      <RichText content={message.role === 'assistant' ? body : message.content} />
      {message.role === 'assistant' && source ? (
        <details className="sourceDetails">
          <summary>출처</summary>
          <RichText content={source} />
        </details>
      ) : null}
    </article>
  )
}

function splitAssistantSource(content = '') {
  const lines = String(content || '').split(/\r?\n/)
  const sourceIndex = lines.findIndex((line) => /^(출처|근거)\s*[:：]/.test(line.trim()))
  if (sourceIndex >= 0) {
    return {
      body: lines.slice(0, sourceIndex).join('\n').trim(),
      source: lines.slice(sourceIndex).join('\n').trim(),
    }
  }

  const urlIndex = lines.findIndex((line) => /https?:\/\//.test(line))
  if (urlIndex >= 0 && urlIndex >= lines.length - 2) {
    return {
      body: lines.slice(0, urlIndex).join('\n').trim(),
      source: lines.slice(urlIndex).join('\n').trim(),
    }
  }

  return { body: content, source: '' }
}

function RichText({ content = '' }) {
  const blocks = String(content || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  if (!blocks.length) return null

  return (
    <div className="richChatText">
      {blocks.map((block, blockIndex) => {
        const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
        const isList = lines.every((line) => /^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line))
        if (isList) {
          return (
            <ul key={`${block}:${blockIndex}`}>
              {lines.map((line) => (
                <li key={line}>{line.replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, '')}</li>
              ))}
            </ul>
          )
        }

        return (
          <p key={`${block}:${blockIndex}`}>
            {lines.map((line, index) => (
              <span key={`${line}:${index}`}>
                {renderInlineLabel(line)}
                {index < lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

function renderInlineLabel(line) {
  const match = line.match(/^([^:：]{2,12})[:：]\s*(.+)$/)
  if (!match) return renderTextWithLinks(line)
  return (
    <>
      <strong>{match[1]}</strong>
      {': '}
      {renderTextWithLinks(match[2])}
    </>
  )
}

function renderTextWithLinks(text) {
  const parts = String(text || '').split(/(https?:\/\/[^\s]+)/g).filter(Boolean)
  return parts.map((part) => (
    /^https?:\/\//.test(part)
      ? <a key={part} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
      : part
  ))
}

function OxReviewModal({ oxHistory, selectedOx, selectedOxId, onSelect, onClose }) {
  return (
    <div className="modalBackdrop mutedBackdrop" role="presentation">
      <section className="studyModal reviewModal" role="dialog" aria-modal="true" aria-labelledby="ox-review-title">
        <button className="modalClose iconOnlyClose" onClick={onClose} aria-label="닫기"><X size={20} /></button>
        <h2 id="ox-review-title">이전 O/X 퀴즈</h2>
        <p className="modalLead">페이지 이동 전에 풀었던 O/X 질문을 다시 확인합니다.</p>
        {oxHistory.length ? (
          <div className="reviewLayout">
            <div className="reviewList">
              {oxHistory.map((item) => (
                <button key={item.id} className={selectedOxId === item.id ? 'active' : ''} onClick={() => onSelect(item.id)}>
                  <span>{item.page ? `${item.page}p` : '페이지'}</span>
                  <strong>{item.question}</strong>
                  <em className={item.isCorrect ? 'correctText' : 'wrongText'}>{item.isCorrect ? '정답' : '오답'}</em>
                </button>
              ))}
            </div>
            <article className="reviewDetail">
              <span className="smallLabel">{selectedOx?.page ? `${selectedOx.page}페이지` : 'O/X'}</span>
              <strong>{selectedOx?.question}</strong>
              <p>{selectedOx?.explanation || '저장된 해설이 없습니다.'}</p>
              <div className="answerPair">
                <span>정답: {formatOxAnswer(selectedOx?.answer)}</span>
                <span>내 답: {formatOxAnswer(selectedOx?.selectedAnswer)}</span>
              </div>
            </article>
          </div>
        ) : (
          <p className="panelEmpty">아직 저장된 O/X 기록이 없습니다.</p>
        )}
      </section>
    </div>
  )
}
