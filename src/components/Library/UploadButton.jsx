import { Upload } from 'lucide-react'

export default function UploadButton({ onUpload, busy }) {
  return (
    <label className={`uploadButton ${busy ? 'isBusy' : ''}`}>
      <Upload size={18} />
      <span>{busy ? '처리 중' : 'PDF 업로드'}</span>
      <input
        type="file"
        accept="application/pdf"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onUpload(file)
          event.target.value = ''
        }}
      />
    </label>
  )
}
