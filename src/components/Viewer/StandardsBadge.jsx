import { Database } from 'lucide-react'

export default function StandardsBadge({ documentData, onOpenPublicData }) {
  const standards = documentData?.standards || []
  const disabled = !standards.length || documentData?.subject === '분석 중'

  return (
    <button
      className="secondaryButton officialDataButton"
      type="button"
      onClick={onOpenPublicData}
      disabled={disabled}
      title={disabled ? '연결된 공식 데이터가 없습니다.' : '연결된 성취기준과 공공데이터를 확인합니다.'}
    >
      <Database size={16} />
      공식 데이터 조회
    </button>
  )
}
