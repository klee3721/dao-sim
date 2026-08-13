import { ipcRenderer } from 'electron'
import { analyzeSelection, isNumericSelectionCandidate } from '../shared/huyen-so/selection-analysis'

declare global {
  interface Window {
    __DAO_SIM_HUYEN_SO_AUTO__?: boolean
  }
}

interface SelectionSnapshot {
  text: string
  left: number
  top: number
}

const SELECTION_DELAY_MS = 250

function readInputSelection(): SelectionSnapshot | null {
  const active = document.activeElement
  const isTextArea = active instanceof HTMLTextAreaElement
  const isInput = active instanceof HTMLInputElement
  if (!isTextArea && !isInput) return null
  if (isInput && active.type.toLowerCase() === 'password') return null

  const start = active.selectionStart
  const end = active.selectionEnd
  if (start === null || end === null || start === end) return null
  const text = active.value.slice(Math.min(start, end), Math.max(start, end))
  if (!text.trim()) return null
  const rect = active.getBoundingClientRect()
  return { text, left: rect.left, top: rect.top }
}

function readDocumentSelection(): SelectionSnapshot | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null
  const text = selection.toString()
  if (!text.trim()) return null
  const rect = selection.getRangeAt(0).getBoundingClientRect()
  return { text, left: rect.left, top: rect.top }
}

function readSelection(): SelectionSnapshot | null {
  return readInputSelection() ?? readDocumentSelection()
}

function bootstrap(): void {
  let selectionTimer: number | undefined
  let lastSelectionKey = ''

  const analyzeCurrentSelection = (): void => {
    const snapshot = readSelection()
    if (!snapshot || !isNumericSelectionCandidate(snapshot.text)) return

    const key = [snapshot.text, Math.round(snapshot.left), Math.round(snapshot.top)].join('|')
    if (key === lastSelectionKey) return
    lastSelectionKey = key
    ipcRenderer.send('huyen-so:selection-result', analyzeSelection(snapshot.text))
  }

  const scheduleAnalysis = (): void => {
    if (selectionTimer !== undefined) window.clearTimeout(selectionTimer)
    selectionTimer = window.setTimeout(() => {
      selectionTimer = undefined
      analyzeCurrentSelection()
    }, SELECTION_DELAY_MS)
  }

  document.addEventListener(
    'pointerdown',
    () => {
      lastSelectionKey = ''
    },
    true
  )
  document.addEventListener('pointerup', scheduleAnalysis, true)
  document.addEventListener('keyup', scheduleAnalysis, true)
}

if (!window.__DAO_SIM_HUYEN_SO_AUTO__) {
  window.__DAO_SIM_HUYEN_SO_AUTO__ = true
  bootstrap()
}
