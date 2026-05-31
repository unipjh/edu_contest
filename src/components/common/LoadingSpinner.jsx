export default function LoadingSpinner({ label = '처리 중입니다.' }) {
  return (
    <div className="loadingLine" role="status">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  )
}
