import { describe, expect, it } from "vitest";
import type { BulkOutputCell, BulkPhoneRow } from "./bulk-phone";
import {
  countHungCells,
  EMPTY_BULK_PHONE_FILTER,
  filterBulkPhoneRows,
  longestConsecutiveHungCells,
  parseBulkNumberTokens,
} from "./bulk-filter";

function row(
  rowNumber: number,
  original: string,
  cells: BulkOutputCell[],
): BulkPhoneRow {
  return {
    rowNumber,
    original,
    normalized: original,
    status: "valid",
    cells,
  };
}

const cat = (text = "Sinh Khí"): BulkOutputCell => ({
  text,
  tone: "cat",
  energyId: "SK",
});
const hung = (energyId: "HH" | "NQ" = "HH"): BulkOutputCell => ({
  text: energyId === "HH" ? "Họa Hại" : "Ngũ Quỷ",
  tone: "hung",
  energyId,
});

describe("bulk phone filters", () => {
  it("removes rows whose red-cell count is equal to or above the threshold", () => {
    const rows = [
      row(1, "911111111", [hung(), cat(), hung("NQ")]),
      row(2, "922222222", [hung(), cat()]),
    ];
    const result = filterBulkPhoneRows(rows, {
      ...EMPTY_BULK_PHONE_FILTER,
      minHungCells: 2,
    });

    expect(rows.map(countHungCells)).toEqual([2, 1]);
    expect(result.removedRows.map((item) => item.rowNumber)).toEqual([1]);
    expect(result.keptRows.map((item) => item.rowNumber)).toEqual([2]);
  });

  it("only treats adjacent red cells as a consecutive streak", () => {
    const separated = row(1, "911111111", [hung(), cat(), hung()]);
    const adjacent = row(2, "922222222", [cat(), hung(), hung("NQ")]);
    const result = filterBulkPhoneRows([separated, adjacent], {
      ...EMPTY_BULK_PHONE_FILTER,
      minConsecutiveHungCells: 2,
    });

    expect(longestConsecutiveHungCells(separated)).toBe(1);
    expect(longestConsecutiveHungCells(adjacent)).toBe(2);
    expect(result.removedRows.map((item) => item.rowNumber)).toEqual([2]);
  });

  it("removes a row containing any selected energy value", () => {
    const result = filterBulkPhoneRows(
      [row(1, "911111111", [cat(), hung("HH")]), row(2, "922222222", [cat()])],
      {
        ...EMPTY_BULK_PHONE_FILTER,
        excludedEnergyIds: ["HH"],
      },
    );

    expect(result.removedRows.map((item) => item.rowNumber)).toEqual([1]);
    expect(result.reasonCounts.energy).toBe(1);
  });

  it("removes a row missing any required energy value", () => {
    const result = filterBulkPhoneRows(
      [
        row(1, "911111111", [cat(), hung("HH")]),
        row(2, "922222222", [cat()]),
        row(3, "933333333", [hung("HH")]),
      ],
      {
        ...EMPTY_BULK_PHONE_FILTER,
        requiredEnergyIds: ["SK", "HH"],
      },
    );

    expect(result.keptRows.map((item) => item.rowNumber)).toEqual([1]);
    expect(result.removedRows.map((item) => item.rowNumber)).toEqual([2, 3]);
    expect(result.reasonCounts["missing-energy"]).toBe(2);
  });

  it("matches digit tokens even when the original phone is formatted", () => {
    const result = filterBulkPhoneRows(
      [
        row(1, "+84 911 046 786", [cat()]),
        row(2, "978918612", [cat()]),
      ],
      {
        ...EMPTY_BULK_PHONE_FILTER,
        numberTokens: ["046", "55"],
      },
    );

    expect(result.removedRows.map((item) => item.rowNumber)).toEqual([1]);
  });

  it("combines active conditions with OR while preserving order and duplicates", () => {
    const rows = [
      row(1, "911111111", [hung(), hung()]),
      row(2, "922222222", [hung("NQ")]),
      row(3, "933333333", [cat()]),
      row(4, "933333333", [cat()]),
    ];
    const result = filterBulkPhoneRows(rows, {
      minHungCells: 2,
      excludedEnergyIds: ["NQ"],
      requiredEnergyIds: [],
      numberTokens: ["333"],
    });

    expect(result.removedRows.map((item) => item.rowNumber)).toEqual([1, 2, 3, 4]);
    expect(result.reasonCounts).toEqual({
      "hung-count": 1,
      "hung-streak": 0,
      energy: 1,
      "missing-energy": 0,
      number: 2,
    });
  });

  it("parses comma/newline number tokens, deduplicates, and reports invalid text", () => {
    expect(parseBulkNumberTokens("0, 5\n05,0, abc, 5.5")).toEqual({
      tokens: ["0", "5", "05"],
      invalidTokens: ["abc", "5.5"],
    });
  });
});
