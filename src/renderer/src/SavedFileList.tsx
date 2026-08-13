import type { SavedFileEntry, SavedFileFormat } from '../../shared/types'

interface SavedFileListProps {
  directory: string
  files: SavedFileEntry[]
  activePath?: string
  busy?: boolean
  openableFormats?: SavedFileFormat[]
  onOpen: (path: string) => void
}

const DATE_FORMAT = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
})

function folderName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function SavedFileList({
  directory,
  files,
  activePath,
  busy = false,
  openableFormats = ['csv'],
  onOpen
}: SavedFileListProps) {
  return (
    <section className="saved-file-list" aria-label="Danh sách file đã lưu">
      <div className="saved-file-list-heading">
        <div>
          <strong>File trong thư mục lưu</strong>
          <span title={directory}>{folderName(directory)}</span>
        </div>
        <em>{files.length} file gần nhất</em>
      </div>
      {files.length > 0 ? (
        <div className="saved-file-list-scroll">
          {files.map((file) => {
            const canOpen = openableFormats.includes(file.format)
            const selected = activePath === file.path
            return (
              <button
                key={file.path}
                type="button"
                className={`saved-file-item ${selected ? 'is-selected' : ''}`}
                onClick={() => onOpen(file.path)}
                disabled={busy || !canOpen}
                title={
                  canOpen
                    ? `Mở ${file.name}`
                    : 'File Excel được hiển thị để theo dõi nhưng tab này chỉ mở CSV.'
                }
              >
                <span className={`saved-file-format is-${file.format}`}>{file.format}</span>
                <span className="saved-file-copy">
                  <strong>{file.name}</strong>
                  <small>
                    {DATE_FORMAT.format(new Date(file.modifiedAt))} · {sizeLabel(file.size)}
                  </small>
                </span>
                <span className="saved-file-tags">
                  {file.isActive && <i>Đang lưu</i>}
                  {file.includesAnalysis && <i className="is-analysis">Có luận giải</i>}
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="saved-file-list-empty">
          Chưa có CSV hoặc Excel trong thư mục này.
        </div>
      )}
    </section>
  )
}
