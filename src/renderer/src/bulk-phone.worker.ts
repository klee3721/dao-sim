/// <reference lib="webworker" />

import { parseBulkCsvText } from '../../shared/huyen-so/bulk-csv'
import {
  analyzeBulkPhoneValue,
  BULK_PROCESSING_CHUNK_SIZE,
  type BulkPhoneRow
} from '../../shared/huyen-so/bulk-phone'

interface AnalyzeBulkCsvMessage {
  type: 'analyze'
  requestId: number
  text: string
}

interface BulkProgressMessage {
  type: 'progress'
  requestId: number
  processed: number
  total: number
}

interface BulkCompleteMessage {
  type: 'complete'
  requestId: number
  rows: BulkPhoneRow[]
}

interface BulkErrorMessage {
  type: 'error'
  requestId: number
  message: string
}

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.onmessage = (event: MessageEvent<AnalyzeBulkCsvMessage>) => {
  if (event.data.type !== 'analyze') return

  const { requestId, text } = event.data

  try {
    const values = parseBulkCsvText(text)
    const rows: BulkPhoneRow[] = []

    const initialProgress: BulkProgressMessage = {
      type: 'progress',
      requestId,
      processed: 0,
      total: values.length
    }
    workerScope.postMessage(initialProgress)

    values.forEach((value, index) => {
      rows.push(analyzeBulkPhoneValue(value, index + 1))

      const processed = index + 1
      if (
        processed % BULK_PROCESSING_CHUNK_SIZE === 0 ||
        processed === values.length
      ) {
        const progress: BulkProgressMessage = {
          type: 'progress',
          requestId,
          processed,
          total: values.length
        }
        workerScope.postMessage(progress)
      }
    })

    const complete: BulkCompleteMessage = {
      type: 'complete',
      requestId,
      rows
    }
    workerScope.postMessage(complete)
  } catch (error) {
    const failure: BulkErrorMessage = {
      type: 'error',
      requestId,
      message: error instanceof Error ? error.message : 'Không thể xử lý file CSV.'
    }
    workerScope.postMessage(failure)
  }
}

export {}
