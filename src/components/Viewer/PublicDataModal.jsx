import { useState } from 'react'
import { X, ChevronDown } from 'lucide-react'
import { getLearningTargetById, getStandardByCode } from '../../lib/ncicMapper.js'
import publicDataSources from '../../data/public_data_sources.json'

export default function PublicDataModal({ standards = [], matchedTargets = [], onClose }) {
  const [openStandards, setOpenStandards] = useState({})
  const [openTargets, setOpenTargets] = useState({})

  const standardDetails = standards.map((code) => getStandardByCode(code)).filter(Boolean)
  const matchedTargetDetails = matchedTargets.map((target) => ({
    ...getLearningTargetById(target.id),
    ...target,
  })).filter((target) => target.id)
  const resources = standardDetails.flatMap((standard) => standard.publicResources || [])
  const uniqueResources = resources.filter((resource, index, array) => (
    array.findIndex((item) => item.id === resource.id || item.url === resource.url) === index
  ))

  const toggleStandard = (code) =>
    setOpenStandards((prev) => ({ ...prev, [code]: !prev[code] }))
  const toggleTarget = (id) =>
    setOpenTargets((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="modalBackdrop mutedBackdrop" role="presentation">
      <section className="studyModal publicDataModal" role="dialog" aria-modal="true" aria-labelledby="public-data-title">
        <button className="modalClose iconOnlyClose" onClick={onClose} aria-label="닫기">
          <X size={20} />
        </button>
        <h2 id="public-data-title">공식 데이터 조회</h2>
        <p className="modalLead">현재 문서와 연결된 성취기준, NCIC 원본, 공공 학습자료를 한곳에서 확인합니다.</p>

        <div className="dataSection">
          <h3>NCIC 성취기준 연결</h3>
          {standardDetails.length ? standardDetails.map((standard) => {
            const isOpen = !!openStandards[standard.code]
            return (
              <article className="dataCard" key={standard.code}>
                <div
                  className="dataCardSummary"
                  onClick={() => toggleStandard(standard.code)}
                  role="button"
                  aria-expanded={isOpen}
                >
                  <div className="dataCardSummaryMain">
                    <strong>{standard.code}</strong>
                    <span className="dataCardSnippet">{standard.description || '-'}</span>
                  </div>
                  <div className="dataCardSummaryRight">
                    <a
                      href={standard.edunetUrl || 'https://ncic.re.kr'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      공식 링크
                    </a>
                    <ChevronDown
                      size={15}
                      className={`dataToggleChevron${isOpen ? ' isOpen' : ''}`}
                    />
                  </div>
                </div>
                {isOpen && (
                  <dl>
                    <div><dt>과목</dt><dd>{standard.subject || '-'}</dd></div>
                    <div><dt>학년</dt><dd>{standard.grade || '-'}</dd></div>
                    <div><dt>단원</dt><dd>{standard.unit || '-'}</dd></div>
                    <div><dt>설명</dt><dd>{standard.description || '-'}</dd></div>
                    <div><dt>키워드</dt><dd>{(standard.keywords || []).join(', ') || '-'}</dd></div>
                    <div>
                      <dt>이해 단위</dt>
                      <dd>{(standard.learningTargets || []).map((t) => t.title).join(', ') || '-'}</dd>
                    </div>
                  </dl>
                )}
              </article>
            )
          }) : (
            <p className="panelEmpty">연결된 성취기준이 없습니다.</p>
          )}
        </div>

        <div className="dataSection">
          <h3>문서와 연결된 이해 단위</h3>
          {matchedTargetDetails.length ? matchedTargetDetails.map((target) => {
            const isOpen = !!openTargets[target.id]
            return (
              <article className="dataCard" key={target.id}>
                <div
                  className="dataCardSummary"
                  onClick={() => toggleTarget(target.id)}
                  role="button"
                  aria-expanded={isOpen}
                >
                  <div className="dataCardSummaryMain">
                    <strong>{target.title}</strong>
                  </div>
                  <div className="dataCardSummaryRight">
                    <span className="dataScore">점수 {target.score || 0}</span>
                    <ChevronDown
                      size={15}
                      className={`dataToggleChevron${isOpen ? ' isOpen' : ''}`}
                    />
                  </div>
                </div>
                {isOpen && (
                  <dl>
                    <div><dt>판단 근거</dt><dd>{(target.criteria || []).join(', ') || '-'}</dd></div>
                  </dl>
                )}
              </article>
            )
          }) : (
            <p className="panelEmpty">아직 문서와 연결된 이해 단위가 없습니다. 새로 업로드하는 자료부터 자동 저장됩니다.</p>
          )}
        </div>

        <div className="dataSection">
          <h3>연결된 공공 학습자료</h3>
          {uniqueResources.length ? uniqueResources.map((resource) => (
            <article className="dataCard" key={resource.id || resource.url}>
              <div className="dataCardHeader">
                <strong>{resource.title}</strong>
                <a href={resource.url} target="_blank" rel="noopener noreferrer">자료 열기</a>
              </div>
              <dl>
                <div><dt>제공처</dt><dd>{resource.provider || resource.sourceName || '-'}</dd></div>
                <div><dt>데이터셋</dt><dd>{resource.dataset || '-'}</dd></div>
                <div><dt>기준일</dt><dd>{resource.baseDate || '-'}</dd></div>
                <div><dt>키워드</dt><dd>{(resource.keywords || []).join(', ') || '-'}</dd></div>
                <div><dt>원본</dt><dd>{resource.publicDataPortalUrl ? <a href={resource.publicDataPortalUrl} target="_blank" rel="noopener noreferrer">공공데이터포털</a> : '-'}</dd></div>
              </dl>
            </article>
          )) : (
            <p className="panelEmpty">연결된 공공 학습자료가 없습니다.</p>
          )}
        </div>

        <div className="dataSection">
          <h3>사용 데이터 출처</h3>
          {publicDataSources.map((source) => (
            <article className="sourceRow" key={source.id}>
              <strong>{source.name}</strong>
              <span>{source.provider}</span>
              <a href={source.url} target="_blank" rel="noopener noreferrer">원본 보기</a>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
