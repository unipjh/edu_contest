import { getEdunetUrl, getLearningTargetsForStandard, getStandardByCode } from '../../lib/ncicMapper.js'

const STATUS_LABEL = { weak: '취약', learning: '이해 중', neutral: '학습 중' }

export default function StandardCard({ data }) {
  const info = getStandardByCode(data.standardCode)
  const targets = getLearningTargetsForStandard(data.standardCode)
  const resourceUrl = getEdunetUrl(data.standardCode)

  return (
    <article className={`standardCard ${data.status}`}>
      <div className="cardHeader">
        <span className="cardCode">{data.standardCode}</span>
        <span className={`cardStatusBadge ${data.status}`}>{STATUS_LABEL[data.status]}</span>
      </div>

      <div className="cardMeta">
        {info?.grade && <span>{info.grade}</span>}
        {info?.subject && <span>{info.subject}</span>}
        {info?.unit && <span>{info.unit}</span>}
      </div>

      {info?.description && <p className="cardDesc">{info.description}</p>}
      {targets.length ? (
        <div className="targetChipList">
          {targets.slice(0, 4).map((target) => <span key={target.id}>{target.title}</span>)}
        </div>
      ) : null}

      <div className="cardStats">
        <span title="메모 수">메모 {data.memoCount}</span>
        <span title="채팅 횟수">채팅 {data.chatCount}</span>
        <span title="퀴즈 시도">퀴즈 {data.quizAttempts > 0 ? `${data.quizCorrect}/${data.quizAttempts}` : '0'}</span>
        {data.wrongCount > 0 && <span className="wrongBadge" title="오답 누적">오답 {data.wrongCount}회</span>}
      </div>

      {data.status === 'weak' && resourceUrl && (
        <a className="edunetLink" href={resourceUrl} target="_blank" rel="noopener noreferrer">
          공공 학습자료 열기
        </a>
      )}
    </article>
  )
}
