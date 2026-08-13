import { describe, expect, it } from "vitest";
import {
  buildBulkCsvText,
  BulkCsvError,
  neutralizeSpreadsheetFormula,
  parseBulkCsvText,
} from "./bulk-csv";
import {
  analyzeBulkPhoneValue,
  BULK_MAX_FILE_SIZE,
  BULK_MAX_INPUT_CHARACTERS,
  BULK_MAX_NON_EMPTY_ROWS,
  BULK_MAX_TOTAL_ROWS,
  getBulkPhoneStats,
  type BulkPhoneRow,
} from "./bulk-phone";

describe("Huyền Số bulk phone processing", () => {
  it("preserves blank rows, duplicates, and input ordering", () => {
    const values = parseBulkCsvText(
      "\uFEFF911046786,,,,\r\n\r\n978918612,,\r\n911046786\r\n",
    );

    expect(values).toEqual(["911046786", "", "978918612", "911046786"]);
    expect(values.filter((value) => value === "911046786")).toHaveLength(2);
  });

  it("rejects data outside column A and binary-looking input", () => {
    expect(() => parseBulkCsvText("0911046786,du-lieu-cu\r\n")).toThrow(
      /Dòng 1, cột 2 đang có dữ liệu/,
    );
    expect(() => parseBulkCsvText("0911046786\0")).toThrow(BulkCsvError);
  });

  it("enforces the 5 MB and 10,000-row limits", () => {
    expect(() => parseBulkCsvText("1".repeat(BULK_MAX_FILE_SIZE + 1))).toThrow(
      /5 MB/,
    );

    const tooManyRows = Array.from(
      { length: BULK_MAX_NON_EMPTY_ROWS + 1 },
      () => "911046786",
    ).join("\n");
    expect(() => parseBulkCsvText(tooManyRows)).toThrow(/10\.000 dòng/);
  });

  it("stops files with too many blank rows before building an unbounded result", () => {
    const tooManyLogicalRows = [
      "911046786",
      ...Array.from({ length: BULK_MAX_TOTAL_ROWS + 1 }, () => ""),
    ].join("\n");

    expect(() => parseBulkCsvText(tooManyLogicalRows)).toThrow(/10\.000 dòng/);
  });

  it("rejects an oversized column-A value before preview or XLSX export", () => {
    expect(() =>
      parseBulkCsvText("9".repeat(BULK_MAX_INPUT_CHARACTERS + 1)),
    ).toThrow(/Dòng 1, cột A vượt quá 128 ký tự/);
  });

  it("auto-restores the leading zero for nine digits and stays compatible with 10 digits and +84", () => {
    const nineDigits = analyzeBulkPhoneValue("911046786", 1);
    const tenDigits = analyzeBulkPhoneValue("0911046786", 2);
    const international = analyzeBulkPhoneValue("+84 911 046 786", 3);

    expect(nineDigits.normalized).toBe("0911046786");
    expect(tenDigits.cells).toEqual(nineDigits.cells);
    expect(international.cells).toEqual(nineDigits.cells);
  });

  it("formats the documented bulk source sample", () => {
    const row = analyzeBulkPhoneValue("911046786", 1);

    expect(row.status).toBe("valid");
    expect(row.cells.map((cell) => cell.text)).toEqual([
      "91 - DN 1",
      "11 - PV 1",
      "104→14 - SK 1 (ẩn)",
      "46 - HH 3",
      "67 - SK 2",
      "78 - DN 2",
      "86 - TY 2",
    ]);
    expect(row.cells[2]).toMatchObject({ tone: "cat", accented: true });
    expect(row.cells[3].tone).toBe("hung");
  });

  it("keeps invalid and blank rows without stopping the batch", () => {
    const rows = [
      analyzeBulkPhoneValue("0911046786", 1),
      analyzeBulkPhoneValue("091234567", 2),
      analyzeBulkPhoneValue("", 3),
    ];

    expect(rows.map((row) => row.status)).toEqual(["valid", "invalid", "blank"]);
    expect(rows[1].cells[0].text).toMatch(/^Lỗi - .*10 chữ số/);
    expect(getBulkPhoneStats(rows)).toEqual({
      totalRows: 3,
      validRows: 1,
      invalidRows: 1,
      blankRows: 1,
    });
  });

  it("builds a UTF-8 CSV and neutralizes spreadsheet formulas in every output cell", () => {
    const formulaRow: BulkPhoneRow = {
      rowNumber: 1,
      original: "+84 911 046 786",
      normalized: "0911046786",
      status: "valid",
      cells: [{ text: " =HYPERLINK(\"https://example.com\")", tone: "neutral" }],
    };
    const csv = buildBulkCsvText([
      formulaRow,
      analyzeBulkPhoneValue("911046786", 2),
    ]);

    expect(neutralizeSpreadsheetFormula("0911046786")).toBe("0911046786");
    expect(neutralizeSpreadsheetFormula("\t-2+3")).toBe("'\t-2+3");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("\"'+84 911 046 786\"");
    expect(csv).toContain("' =HYPERLINK");
    expect(csv).toContain("\r\n");
    expect(csv).toContain("91 - DN 1");
    expect(csv).toContain("46 - HH 3");
    expect(csv).not.toContain("Gợi ý chuyển hóa");
  });

  it("uses the current S5 and number-five modifier labels", () => {
    const row = analyzeBulkPhoneValue("0513123456", 1);

    expect(row.cells.some((cell) => cell.text === "51 - S5")).toBe(true);
    expect(row.cells.some((cell) => cell.text === "13 - TY 1 (kích)")).toBe(true);
  });
});
