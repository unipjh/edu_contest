import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/firebase.js'
import { useDocumentList } from '../hooks/useDocumentList.js'
import { useDocumentDelete } from '../hooks/useDocumentDelete.js'
import { useDocumentUpload } from '../hooks/useDocumentUpload.js'
import DocumentCard from '../components/Library/DocumentCard.jsx'
import UploadButton from '../components/Library/UploadButton.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import LoadingSpinner from '../components/common/LoadingSpinner.jsx'

export default function LibraryPage() {
  const uid = auth.currentUser?.uid
  const navigate = useNavigate()
  const { documents, loading, error: listError } = useDocumentList(uid)
  const { upload, busy, message, error: uploadError } = useDocumentUpload(uid)
  const { removeDocument, deletingId, error: deleteError } = useDocumentDelete(uid)

  async function handleUpload(file) {
    const docId = await upload(file)
    if (docId) navigate(`/viewer/${docId}`)
  }

  async function handleDelete(documentData) {
    const ok = window.confirm(
      `"${documentData.title}" 자료를 삭제할까요?\nPDF 파일, 하이라이트, 채팅, 퀴즈 기록이 함께 삭제됩니다.`,
    )
    if (!ok) return
    await removeDocument(documentData)
  }

  return (
    <section className="pageStack">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">라이브러리</p>
          <h2>학습자료</h2>
        </div>
        <UploadButton onUpload={handleUpload} busy={busy} />
      </div>

      {busy ? <LoadingSpinner label={message} /> : null}
      {uploadError ? <p className="errorText">{uploadError}</p> : null}
      {deleteError ? <p className="errorText">{deleteError}</p> : null}
      {listError ? <p className="errorText">{listError}</p> : null}

      {loading ? (
        <LoadingSpinner label="문서 목록을 불러오는 중입니다." />
      ) : documents.length ? (
        <div className="documentList">
          {documents.map((documentData) => (
            <DocumentCard
              key={documentData.id}
              documentData={documentData}
              deleting={deletingId === documentData.id}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="아직 업로드한 PDF가 없습니다"
          description="학습자료를 올리면 성취기준 연결과 학습목표 생성이 자동으로 시작됩니다."
        />
      )}
    </section>
  )
}
