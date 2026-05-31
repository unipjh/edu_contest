export default function LearningGoalBanner({ goals, open, generating }) {
  const primaryGoal = goals?.[0] || '자료를 읽으며 핵심 주장과 근거를 스스로 확인한다.'

  return (
    <section className="goalBanner">
      <span className="goalBadge">우선</span>
      <strong>학습 목표</strong>
      <p>{generating ? '학습목표를 준비하고 있습니다.' : primaryGoal}</p>
      <button className="ghostButton" onClick={open}>보기</button>
    </section>
  )
}
