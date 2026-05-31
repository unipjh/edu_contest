const FALLBACK_GOALS = [
  '핵심 개념을 표시하며 읽기',
  '이해가 흔들리는 문장은 메모로 남기기',
  '페이지 이동 전 O/X 질문으로 스스로 점검하기',
]

export default function LearningGoalModal({ goals, onClose, onExit }) {
  return (
    <div className="modalBackdrop" role="presentation">
      <section className="studyModal" role="dialog" aria-modal="true" aria-labelledby="learning-goal-title">
        <p className="eyebrow">학습목표</p>
        <h2 id="learning-goal-title">읽기 전에 오늘 볼 지점을 정리해요</h2>
        <ol className="goalList">
          {(goals?.length ? goals : FALLBACK_GOALS).map((goal) => (
            <li key={goal}>{goal}</li>
          ))}
        </ol>
        <div className="modalActionRow">
          <button className="secondaryButton" onClick={onExit}>나가기</button>
          <button className="primaryButton" onClick={onClose}>학습 시작</button>
        </div>
      </section>
    </div>
  )
}
