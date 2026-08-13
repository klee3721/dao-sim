import {
  analyze,
  ENERGIES,
  getStrengthLabel,
  type EnergyId,
  type Polarity,
  type StrengthLevel
} from './numerology'

export type SupportedSelectionMode = 'number' | 'phone' | 'cccd'
export type SelectionKind = 'pair' | 'number' | 'phone' | 'cccd'

export interface ClassifiedSelection {
  originalInput: string
  normalizedInput: string
  analysisInput: string
  mode: SupportedSelectionMode
  kind: SelectionKind
  normalizationNote?: string
}

export type ClassificationResult =
  | { ok: true; value: ClassifiedSelection }
  | { ok: false; error: string; normalizedInput: string }

export interface SelectionPairViewModel {
  id: string
  pair: string
  segment: string
  energyId?: EnergyId
  energyName?: string
  polarity?: Polarity
  strength?: StrengthLevel
  strengthLabel: string
  sourceLabel: string
  note?: string
}

export interface SelectionEnergyViewModel {
  id: EnergyId
  name: string
  label: string
  polarity: Polarity
  count: number
  shortSummary: string
  keywords: string[]
  overview: string
  strengths: string[]
  limitations: string[]
  career: string[]
  finance: string[]
  relationships: string[]
  health: string[]
  advice: string[]
}

export interface SelectionSuccessModel {
  kind: 'success'
  originalInput: string
  normalizedInput: string
  normalizationNote?: string
  analysisMode: SupportedSelectionMode
  selectionKind: SelectionKind
  selectionLabel: string
  analyzedDigits: string
  summary: string
  pairs: SelectionPairViewModel[]
  energies: SelectionEnergyViewModel[]
  dominantEnergyIds: EnergyId[]
  endingEnergyId?: EnergyId
  catCount: number
  hungCount: number
  warnings: string[]
  quickCodes: Array<{ code: string; label: string; category: string }>
  transitions: Array<{
    id: string
    fromPair: string
    toPair: string
    fromName: string
    toName: string
    fromStrength?: StrengthLevel
    toStrength?: StrengthLevel
  }>
  tailDigits?: string
  fortuneCycles?: Array<{
    age: string
    pair: string
    energyName?: string
    strength?: StrengthLevel
    special?: boolean
  }>
}

export interface SelectionErrorModel {
  kind: 'error'
  originalInput: string
  normalizedInput?: string
  error: string
}

export type SelectionAnalysisModel = SelectionSuccessModel | SelectionErrorModel

const MAX_RAW_SELECTION_LENGTH = 500
const FORMATTING_CHARACTERS = /[\s.\-()]/gu

const SELECTION_LABELS: Record<SelectionKind, string> = {
  pair: 'Cặp số',
  number: 'Dãy số',
  phone: 'Số điện thoại',
  cccd: 'CCCD'
}

const SOURCE_LABELS = {
  standard: 'Cặp chuẩn',
  'zero-bridge': 'Cặp nền qua số 0',
  'cccd-zero': 'Phục Vị đặc biệt trong CCCD',
  'five-special': 'Cặp đặc biệt có số 5'
} as const

export function isNumericSelectionCandidate(value: string): boolean {
  const compact = value.trim().replace(FORMATTING_CHARACTERS, '')
  return /^\d+$/u.test(compact) || /^\+84\d+$/u.test(compact)
}

export function classifySelection(rawInput: string): ClassificationResult {
  const originalInput = rawInput.trim()

  if (!originalInput) {
    return {
      ok: false,
      error: 'Hãy bôi đen một dãy có ít nhất 2 chữ số.',
      normalizedInput: ''
    }
  }

  if (originalInput.length > MAX_RAW_SELECTION_LENGTH) {
    return {
      ok: false,
      error: 'Selection quá dài. Hãy chỉ chọn một dãy số cần luận giải.',
      normalizedInput: ''
    }
  }

  const compact = originalInput.replace(FORMATTING_CHARACTERS, '')

  if (compact.startsWith('+84')) {
    const nationalDigits = compact.slice(3)
    if (!/^\d+$/.test(nationalDigits)) {
      return {
        ok: false,
        error: 'SĐT +84 chỉ được chứa chữ số và ký tự định dạng thông dụng.',
        normalizedInput: nationalDigits.replace(/\D/gu, '')
      }
    }
    if (nationalDigits.length !== 9) {
      return {
        ok: false,
        error: `SĐT +84 cần 9 chữ số phía sau. Hiện có ${nationalDigits.length} chữ số.`,
        normalizedInput: nationalDigits
      }
    }

    const normalizedInput = `0${nationalDigits}`
    return {
      ok: true,
      value: {
        originalInput,
        normalizedInput,
        analysisInput: normalizedInput,
        mode: 'phone',
        kind: 'phone',
        normalizationNote: 'Đã đổi mã quốc gia +84 thành đầu số 0.'
      }
    }
  }

  if (!/^\d+$/.test(compact)) {
    return {
      ok: false,
      error:
        'Chỉ chọn một dãy số. Tiện ích chỉ tự xóa khoảng trắng, dấu chấm, gạch ngang và dấu ngoặc.',
      normalizedInput: compact.replace(/\D/gu, '')
    }
  }

  const length = compact.length
  if (length < 2) {
    return {
      ok: false,
      error: 'Hãy bôi đen một dãy có ít nhất 2 chữ số.',
      normalizedInput: compact
    }
  }

  if (length === 9) {
    if (compact.startsWith('0')) {
      return {
        ok: false,
        error: 'Số điện thoại đang bắt đầu bằng 0 nhưng mới có 9 chữ số.',
        normalizedInput: compact
      }
    }
    const normalizedInput = `0${compact}`
    return {
      ok: true,
      value: {
        originalInput,
        normalizedInput,
        analysisInput: normalizedInput,
        mode: 'phone',
        kind: 'phone',
        normalizationNote: 'Đã tự bổ sung số 0 ở đầu SĐT.'
      }
    }
  }

  if (length === 10) {
    if (!compact.startsWith('0')) {
      return {
        ok: false,
        error: 'Số điện thoại 10 chữ số cần bắt đầu bằng 0.',
        normalizedInput: compact
      }
    }
    return {
      ok: true,
      value: {
        originalInput,
        normalizedInput: compact,
        analysisInput: compact,
        mode: 'phone',
        kind: 'phone'
      }
    }
  }

  if (length === 12) {
    return {
      ok: true,
      value: {
        originalInput,
        normalizedInput: compact,
        analysisInput: compact,
        mode: 'cccd',
        kind: 'cccd'
      }
    }
  }

  if (length > 30) {
    return {
      ok: false,
      error: 'Chế độ Số hỗ trợ tối đa 30 chữ số trong một lần xem.',
      normalizedInput: compact
    }
  }

  return {
    ok: true,
    value: {
      originalInput,
      normalizedInput: compact,
      analysisInput: compact,
      mode: 'number',
      kind: length === 2 ? 'pair' : 'number'
    }
  }
}

function buildSummary(
  dominantEnergyIds: EnergyId[],
  endingEnergyId: EnergyId | undefined,
  pairCount: number
): string {
  if (dominantEnergyIds.length === 0) {
    return pairCount === 0
      ? 'Dãy này chưa tạo được cặp thuộc tám từ trường chuẩn.'
      : 'Dãy có cặp đặc biệt nhưng chưa xác định được năng lượng chủ đạo.'
  }

  const dominantNames = dominantEnergyIds.map((id) => ENERGIES[id].name).join(', ')
  const endingText = endingEnergyId
    ? ` Từ trường kết đuôi là ${ENERGIES[endingEnergyId].name}.`
    : ''
  return `Năng lượng chủ đạo: ${dominantNames}.${endingText}`
}

export function analyzeSelection(rawInput: string): SelectionAnalysisModel {
  const classified = classifySelection(rawInput)
  if (!classified.ok) {
    return {
      kind: 'error',
      originalInput: rawInput.trim(),
      normalizedInput: classified.normalizedInput || undefined,
      error: classified.error
    }
  }

  const analysis = analyze(classified.value.analysisInput, classified.value.mode)
  if (!analysis.result || analysis.error) {
    return {
      kind: 'error',
      originalInput: classified.value.originalInput,
      normalizedInput: analysis.normalized || undefined,
      error: analysis.error ?? 'Không thể luận giải dãy số này.'
    }
  }

  const result = analysis.result
  const orderedEnergyIds: EnergyId[] = []
  result.pairs.forEach((pair) => {
    if (pair.energyId && !orderedEnergyIds.includes(pair.energyId)) {
      orderedEnergyIds.push(pair.energyId)
    }
  })

  return {
    kind: 'success',
    originalInput: classified.value.originalInput,
    normalizedInput: result.normalizedInput,
    normalizationNote: classified.value.normalizationNote,
    analysisMode: classified.value.mode,
    selectionKind: classified.value.kind,
    selectionLabel: SELECTION_LABELS[classified.value.kind],
    analyzedDigits: result.analyzedDigits,
    summary: buildSummary(result.dominantEnergies, result.endingEnergy, result.pairs.length),
    pairs: result.pairs.map((pair) => ({
      id: pair.id,
      pair: pair.pair,
      segment: pair.segment,
      energyId: pair.energyId,
      energyName: pair.energyId ? ENERGIES[pair.energyId].name : undefined,
      polarity: pair.energyId ? ENERGIES[pair.energyId].polarity : undefined,
      strength: pair.strength,
      strengthLabel: getStrengthLabel(pair.strength),
      sourceLabel: SOURCE_LABELS[pair.source],
      note: pair.note
    })),
    energies: orderedEnergyIds.map((energyId) => {
      const energy = ENERGIES[energyId]
      return {
        id: energyId,
        name: energy.name,
        label: energy.label,
        polarity: energy.polarity,
        count: result.counts[energyId],
        shortSummary: energy.shortSummary,
        keywords: energy.keywords,
        overview: energy.overview,
        strengths: energy.strengths,
        limitations: energy.limitations,
        career: energy.career,
        finance: energy.finance,
        relationships: energy.relationships,
        health: energy.health,
        advice: energy.advice
      }
    }),
    dominantEnergyIds: result.dominantEnergies,
    endingEnergyId: result.endingEnergy,
    catCount: result.catCount,
    hungCount: result.hungCount,
    warnings: result.specialWarnings,
    quickCodes: result.quickCodeMatches,
    transitions: result.transitions.map((transition) => ({
      id: transition.id,
      fromPair: transition.fromPair,
      toPair: transition.toPair,
      fromName: ENERGIES[transition.from].name,
      toName: ENERGIES[transition.to].name,
      fromStrength: transition.fromStrength,
      toStrength: transition.toStrength
    })),
    tailDigits: result.tailDigits,
    fortuneCycles: result.fortuneCycles?.map((cycle) => ({
      age: cycle.age,
      pair: cycle.pair,
      energyName: cycle.energyId ? ENERGIES[cycle.energyId].name : undefined,
      strength: cycle.strength,
      special: cycle.special
    }))
  }
}
