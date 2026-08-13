import type { BulkPhoneRow } from "./bulk-phone";
import type { EnergyId } from "./numerology";

export interface BulkPhoneFilterCriteria {
  minHungCells?: number;
  minConsecutiveHungCells?: number;
  excludedEnergyIds: EnergyId[];
  requiredEnergyIds: EnergyId[];
  numberTokens: string[];
}

export type BulkPhoneFilterReason =
  | "hung-count"
  | "hung-streak"
  | "energy"
  | "missing-energy"
  | "number";

export interface BulkPhoneFilterResult {
  keptRows: BulkPhoneRow[];
  removedRows: BulkPhoneRow[];
  reasonCounts: Record<BulkPhoneFilterReason, number>;
}

export interface BulkNumberTokenResult {
  tokens: string[];
  invalidTokens: string[];
}

export const EMPTY_BULK_PHONE_FILTER: BulkPhoneFilterCriteria = {
  excludedEnergyIds: [],
  requiredEnergyIds: [],
  numberTokens: [],
};

/**
 * Giữ cùng cách nhập với bộ lọc CSV: mỗi chuỗi số cách nhau bằng dấu phẩy
 * hoặc xuống dòng. Thứ tự đầu tiên được giữ lại và giá trị trùng bị bỏ.
 */
export function parseBulkNumberTokens(input: string): BulkNumberTokenResult {
  const values = input
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    tokens: [...new Set(values.filter((value) => /^\d+$/.test(value)))],
    invalidTokens: [...new Set(values.filter((value) => !/^\d+$/.test(value)))],
  };
}

export function countHungCells(row: BulkPhoneRow): number {
  return row.cells.reduce(
    (count, cell) => count + (cell.tone === "hung" ? 1 : 0),
    0,
  );
}

export function longestConsecutiveHungCells(row: BulkPhoneRow): number {
  let longest = 0;
  let current = 0;

  row.cells.forEach((cell) => {
    if (cell.tone === "hung") {
      current += 1;
      longest = Math.max(longest, current);
      return;
    }

    current = 0;
  });

  return longest;
}

function normalizedDigits(row: BulkPhoneRow): string {
  return row.original.replace(/\D/g, "");
}

export function filterBulkPhoneRows(
  rows: BulkPhoneRow[],
  criteria: BulkPhoneFilterCriteria,
): BulkPhoneFilterResult {
  const excludedEnergyIds = new Set(criteria.excludedEnergyIds);
  const requiredEnergyIds = new Set(criteria.requiredEnergyIds);
  const reasonCounts: Record<BulkPhoneFilterReason, number> = {
    "hung-count": 0,
    "hung-streak": 0,
    energy: 0,
    "missing-energy": 0,
    number: 0,
  };
  const keptRows: BulkPhoneRow[] = [];
  const removedRows: BulkPhoneRow[] = [];

  rows.forEach((row) => {
    const matchesHungCount =
      criteria.minHungCells !== undefined &&
      countHungCells(row) >= criteria.minHungCells;
    const matchesHungStreak =
      criteria.minConsecutiveHungCells !== undefined &&
      longestConsecutiveHungCells(row) >= criteria.minConsecutiveHungCells;
    const matchesEnergy =
      excludedEnergyIds.size > 0 &&
      row.cells.some(
        (cell) => cell.energyId && excludedEnergyIds.has(cell.energyId),
      );
    const rowEnergyIds = new Set(
      row.cells.flatMap((cell) => (cell.energyId ? [cell.energyId] : [])),
    );
    const matchesMissingEnergy =
      requiredEnergyIds.size > 0 &&
      [...requiredEnergyIds].some((energyId) => !rowEnergyIds.has(energyId));
    const digits = normalizedDigits(row);
    const matchesNumber =
      criteria.numberTokens.length > 0 &&
      criteria.numberTokens.some((token) => digits.includes(token));

    if (matchesHungCount) reasonCounts["hung-count"] += 1;
    if (matchesHungStreak) reasonCounts["hung-streak"] += 1;
    if (matchesEnergy) reasonCounts.energy += 1;
    if (matchesMissingEnergy) reasonCounts["missing-energy"] += 1;
    if (matchesNumber) reasonCounts.number += 1;

    if (
      matchesHungCount ||
      matchesHungStreak ||
      matchesEnergy ||
      matchesMissingEnergy ||
      matchesNumber
    ) {
      removedRows.push(row);
    } else {
      keptRows.push(row);
    }
  });

  return { keptRows, removedRows, reasonCounts };
}
