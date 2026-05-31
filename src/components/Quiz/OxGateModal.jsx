export default function OxGateModal({ question, loading, feedback, onAnswer, onClose, onExplain }) {
  return (
    <div className="modalBackdrop mutedBackdrop" role="presentation">
      <section className="studyModal oxModal" role="dialog" aria-modal="true" aria-labelledby="ox-title">
        <button className="modalClose" onClick={onClose} aria-label="닫기">×</button>
        <h2 id="ox-title">잠깐, 이해하고 있나요?</h2>
        <p className="modalLead">지금까지 읽은 내용을 바탕으로 간단한 O/X 질문에 답해주세요.</p>
        <div className="oxStatement">
          {loading ? '확인 질문을 준비하고 있습니다.' : question?.statement || '질문을 준비할 수 없습니다.'}
        </div>
        <div className="oxButtons">
          <button disabled={loading} onClick={() => onAnswer(true)}>O</button>
          <button disabled={loading} onClick={() => onAnswer(false)}>X</button>
        </div>
        {feedback ? (
          <div className={`gateFeedback ${feedback.correct ? 'isCorrect' : 'isWrong'}`}>
            <strong>{feedback.correct ? '맞았어요. 다음으로 넘어갈 수 있습니다.' : '조금 더 확인해볼까요?'}</strong>
            <p>{feedback.explanation}</p>
          </div>
        ) : null}
        {feedback && !feedback.correct ? (
          <div className="buttonRow end">
            <button className="secondaryButton" onClick={onExplain}>AI에게 설명 요청</button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
