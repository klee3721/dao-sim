import {
  analyze,
  ENERGIES,
  type AnalyzedPair,
  type EnergyId,
} from "./numerology";

export const BULK_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const BULK_MAX_NON_EMPTY_ROWS = 10_000;
export const BULK_MAX_TOTAL_ROWS = 10_000;
export const BULK_MAX_INPUT_CHARACTERS = 128;
export const BULK_PREVIEW_ROWS = 50;
export const BULK_PROCESSING_CHUNK_SIZE = 250;

export type BulkCellTone =
  | "cat"
  | "hung"
  | "special"
  | "error"
  | "neutral";

export interface BulkOutputCell {
  text: string;
  tone: BulkCellTone;
  energyId?: EnergyId;
  accented?: boolean;
}

export type BulkRowStatus = "valid" | "invalid" | "blank";

export interface BulkPhoneRow {
  rowNumber: number;
  original: string;
  normalized: string;
  status: BulkRowStatus;
  cells: BulkOutputCell[];
}

export interface BulkPhoneStats {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  blankRows: number;
}

function pairText(pair: AnalyzedPair): string {
  if (!pair.energyId) {
    return `${pair.segment} - S5`;
  }

  const prefix =
    pair.source === "zero-bridge"
      ? `${pair.segment}→${pair.pair}`
      : pair.pair;
  const modifiers = [
    pair.hiddenByZero ? "ẩn" : undefined,
    pair.triggeredByFive ? "kích" : undefined,
  ].filter(Boolean);

  return `${prefix} - ${pair.energyId}${
    pair.strength ? ` ${pair.strength}` : ""
  }${
    modifiers.length > 0 ? ` (${modifiers.join(", ")})` : ""
  }`;
}

function pairTone(pair: AnalyzedPair): BulkCellTone {
  if (!pair.energyId) return "special";
  return ENERGIES[pair.energyId].polarity;
}

export function formatBulkPair(pair: AnalyzedPair): BulkOutputCell {
  return {
    text: pairText(pair),
    tone: pairTone(pair),
    energyId: pair.energyId,
    accented: Boolean(pair.hiddenByZero || pair.triggeredByFive),
  };
}

/**
 * File hàng loạt thường được xuất từ bảng tính dưới dạng số nên mất số 0 đầu.
 * Chỉ khôi phục số 0 cho đúng 9 chữ số; các định dạng cũ tiếp tục đi qua bộ
 * chuẩn hóa SĐT chính để giữ tương thích với số 10 chữ số và +84.
 */
export function prepareBulkPhoneForAnalysis(original: string): string {
  const compact = original.trim().replace(/[\s.\-()]/g, "");

  if (/^[1-9]\d{8}$/.test(compact)) {
    return `0${compact}`;
  }

  return original;
}

export function analyzeBulkPhoneValue(
  original: string,
  rowNumber: number,
): BulkPhoneRow {
  if (original.trim().length === 0) {
    return {
      rowNumber,
      original,
      normalized: "",
      status: "blank",
      cells: [],
    };
  }

  const analysis = analyze(prepareBulkPhoneForAnalysis(original), "phone");

  if (!analysis.result) {
    return {
      rowNumber,
      original,
      normalized: analysis.normalized,
      status: "invalid",
      cells: [
        {
          text: `Lỗi - ${analysis.error ?? "Không thể phân tích số điện thoại."}`,
          tone: "error",
        },
      ],
    };
  }

  const cells = analysis.result.pairs.map(formatBulkPair);
  analysis.result.specialWarnings.forEach((warning) => {
    cells.push({
      text: `Lưu ý - ${warning}`,
      tone: "special",
    });
  });

  if (cells.length === 0) {
    cells.push({
      text: "Lưu ý - Dãy chưa tạo được cặp chuẩn thuộc tám từ trường.",
      tone: "neutral",
    });
  }

  return {
    rowNumber,
    original,
    normalized: analysis.result.normalizedInput,
    status: "valid",
    cells,
  };
}

export function getBulkPhoneStats(rows: BulkPhoneRow[]): BulkPhoneStats {
  return rows.reduce<BulkPhoneStats>(
    (stats, row) => {
      stats.totalRows += 1;
      if (row.status === "valid") stats.validRows += 1;
      if (row.status === "invalid") stats.invalidRows += 1;
      if (row.status === "blank") stats.blankRows += 1;
      return stats;
    },
    {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      blankRows: 0,
    },
  );
}
