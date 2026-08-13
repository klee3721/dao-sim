import type {
  SelectionAnalysisModel,
  SelectionEnergyViewModel,
  SelectionSuccessModel
} from '../../shared/huyen-so/selection-analysis'

interface HuyenSoPanelProps {
  result: SelectionAnalysisModel | null
  onClose: () => void
}

function StrengthBadge({
  strength,
  label
}: {
  strength?: 1 | 2 | 3 | 4
  label?: string
}) {
  if (!strength) return null
  return (
    <span
      className="huyen-so-strength-badge"
      aria-label={`Bậc ${strength}`}
      title={label ?? `Bậc ${strength}`}
    >
      {strength}
    </span>
  )
}

function EnergyDetails({ energy }: { energy: SelectionEnergyViewModel }) {
  const groups = [
    ['Điểm mạnh', energy.strengths],
    ['Điểm cần lưu ý', energy.limitations],
    ['Công việc', energy.career],
    ['Tài chính', energy.finance],
    ['Quan hệ', energy.relationships],
    ['Sức khỏe', energy.health],
    ['Hướng chuyển hóa', energy.advice]
  ] as const

  return (
    <details className="huyen-so-energy">
      <summary>
        <span>
          <strong>{energy.name}</strong>
          <small>{energy.label}</small>
        </span>
        <em>{energy.count} lần</em>
      </summary>
      <div className="huyen-so-energy-body">
        <p>{energy.overview}</p>
        <p className="huyen-so-keywords">Từ khóa: {energy.keywords.join(', ')}</p>
        {groups.map(([title, values]) =>
          values.length > 0 ? (
            <div className="huyen-so-energy-group" key={title}>
              <h5>{title}</h5>
              <ul>
                {values.map((value) => <li key={value}>{value}</li>)}
              </ul>
            </div>
          ) : null
        )}
      </div>
    </details>
  )
}

function ResultBody({ result }: { result: SelectionSuccessModel }) {
  const showNormalized =
    result.originalInput.replace(/\s/gu, '') !== result.normalizedInput ||
    Boolean(result.normalizationNote)

  return (
    <div className="huyen-so-dock-scroll">
      <div className="huyen-so-number-card">
        <span>{result.selectionLabel}</span>
        <strong>{result.originalInput}</strong>
        {showNormalized && <small>Chuẩn hóa: {result.normalizedInput}</small>}
        {result.normalizationNote && <em>{result.normalizationNote}</em>}
      </div>

      <p className="huyen-so-summary">{result.summary}</p>

      <div className="huyen-so-stats">
        <div className="huyen-so-stat huyen-so-stat--cat">
          <strong>{result.catCount}</strong>
          <span>Cặp cát tinh</span>
        </div>
        <div className="huyen-so-stat huyen-so-stat--hung">
          <strong>{result.hungCount}</strong>
          <span>Cặp hung tinh</span>
        </div>
      </div>

      <section className="huyen-so-section">
        <h4>Chuỗi luận giải · {result.pairs.length} cặp</h4>
        <div className="huyen-so-pairs">
          {result.pairs.map((pair) => (
            <span
              key={pair.id}
              className={`huyen-so-pair huyen-so-pair--${pair.polarity ?? 'special'}`}
              title={`${pair.sourceLabel} · ${pair.strengthLabel}`}
            >
              <b>{pair.segment}</b>
              <span>·</span>
              <span>{pair.energyName ?? 'Đặc biệt'}</span>
              <StrengthBadge strength={pair.strength} label={pair.strengthLabel} />
            </span>
          ))}
        </div>
      </section>

      {(result.warnings.length > 0 || result.quickCodes.length > 0) && (
        <section className="huyen-so-section">
          <h4>Điểm cần lưu ý</h4>
          <div className="huyen-so-alerts">
            {result.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            {result.quickCodes.map((code) => (
              <p key={`${code.code}-${code.category}`}>Mã {code.code}: {code.label}</p>
            ))}
          </div>
        </section>
      )}

      <details className="huyen-so-full-details">
        <summary>Xem luận giải chi tiết</summary>

        <section className="huyen-so-section">
          <h4>Chi tiết từng cặp</h4>
          <div className="huyen-so-pair-details">
            {result.pairs.map((pair) => (
              <div key={pair.id}>
                <b>{pair.segment}</b>
                <p>
                  <strong>{pair.energyName ?? 'Cặp đặc biệt'}</strong>
                  <span>
                    <StrengthBadge strength={pair.strength} label={pair.strengthLabel} />
                    {pair.sourceLabel}
                  </span>
                  {pair.note && <small>{pair.note}</small>}
                </p>
              </div>
            ))}
          </div>
        </section>

        {result.transitions.length > 0 && (
          <section className="huyen-so-section">
            <h4>Dòng chuyển hóa</h4>
            <div className="huyen-so-transitions">
              {result.transitions.map((transition) => (
                <p key={transition.id}>
                  {transition.fromPair} · {transition.fromName}{' '}
                  <StrengthBadge strength={transition.fromStrength} /> →{' '}
                  {transition.toPair} · {transition.toName}{' '}
                  <StrengthBadge strength={transition.toStrength} />
                </p>
              ))}
            </div>
          </section>
        )}

        {result.energies.length > 0 && (
          <section className="huyen-so-section">
            <h4>Ý nghĩa các từ trường</h4>
            <div className="huyen-so-energies">
              {result.energies.map((energy) => <EnergyDetails key={energy.id} energy={energy} />)}
            </div>
          </section>
        )}

        {result.fortuneCycles && result.fortuneCycles.length > 0 && (
          <section className="huyen-so-section">
            <h4>Đại vận CCCD</h4>
            <div className="huyen-so-cycle-table">
              {result.fortuneCycles.map((cycle) => (
                <div key={`${cycle.age}-${cycle.pair}`}>
                  <span>{cycle.age}</span>
                  <b>{cycle.pair}</b>
                  <em>
                    {cycle.energyName ?? 'Đặc biệt'}{' '}
                    <StrengthBadge strength={cycle.strength} />
                    {cycle.special ? ' · có số 0' : ''}
                  </em>
                </div>
              ))}
            </div>
          </section>
        )}
      </details>

      <p className="huyen-so-local-note">Luận giải cục bộ trên máy · Nội dung mang tính tham khảo</p>
    </div>
  )
}

export function HuyenSoPanel({ result, onClose }: HuyenSoPanelProps) {
  return (
    <section className={`huyen-so-dock${result ? ' huyen-so-dock--active' : ''}`} aria-label="Luận giải Huyền Số">
      <header className="huyen-so-dock-header">
        <span className="huyen-so-mark" aria-hidden="true">數</span>
        <div>
          <p>HUYỀN SỐ · TỰ ĐỘNG</p>
          <h3>{result?.kind === 'success' ? result.selectionLabel : 'Luận giải số'}</h3>
        </div>
        <span className="huyen-so-auto-pill">AUTO</span>
        {result && (
          <button type="button" onClick={onClose} aria-label="Đóng kết quả" title="Đóng kết quả">×</button>
        )}
      </header>

      {!result ? (
        <div className="huyen-so-empty">
          <span aria-hidden="true">✦</span>
          <strong>Bôi đen một dãy số</strong>
          <p>Kết quả luận giải sẽ tự động xuất hiện cố định tại đây và không che website.</p>
        </div>
      ) : result.kind === 'error' ? (
        <div className="huyen-so-error">
          <strong>Dãy số chưa hợp lệ</strong>
          <p>{result.error}</p>
          {result.originalInput && <code>{result.originalInput}</code>}
        </div>
      ) : (
        <ResultBody result={result} />
      )}
    </section>
  )
}
