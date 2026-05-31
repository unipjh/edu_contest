import { Link } from 'react-router-dom'
import { FileText, Trash2 } from 'lucide-react'

export default function DocumentCard({ documentData, onDelete, deleting }) {
  const standardCount = documentData.standards?.length || 0
  const targetCount = documentData.standardTargets?.length || 0
  const meta = [
    documentData.grade,
    documentData.subject,
    documentData.unit,
    standardCount ? `성취기준 ${standardCount}개` : '성취기준 미연결',
    targetCount ? `이해 단위 ${targetCount}개` : '',
  ].filter(Boolean).join(' · ')

  return (
    <article className="documentCard">
      <div className="documentIcon">
        <FileText size={22} />
      </div>
      <div>
        <h3>{documentData.title}</h3>
        <p className="documentMeta">{meta}</p>
      </div>
      <div className="documentActions">
        <Link className="secondaryButton" to={`/viewer/${documentData.id}`}>
          열기
        </Link>
        <button
          className="ghostButton dangerButton"
          onClick={() => onDelete(documentData)}
          disabled={deleting}
          title="자료 삭제"
        >
          <Trash2 size={16} />
          {deleting ? '삭제 중' : '삭제'}
        </button>
      </div>
    </article>
  )
}
