import Papa from "papaparse";
import {
  BULK_MAX_FILE_SIZE,
  BULK_MAX_INPUT_CHARACTERS,
  BULK_MAX_NON_EMPTY_ROWS,
  BULK_MAX_TOTAL_ROWS,
  type BulkPhoneRow,
} from "./bulk-phone";

export class BulkCsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BulkCsvError";
  }
}

function isBlankRow(row: string[]): boolean {
  return row.every((cell) => cell.trim().length === 0);
}

export function parseBulkCsvText(text: string): string[] {
  const size = new TextEncoder().encode(text).byteLength;
  if (size === 0) {
    throw new BulkCsvError("File CSV đang trống.");
  }
  if (size > BULK_MAX_FILE_SIZE) {
    throw new BulkCsvError("File vượt quá giới hạn 5 MB.");
  }
  if (text.includes("\0")) {
    throw new BulkCsvError("File có dữ liệu nhị phân và không phải CSV hợp lệ.");
  }

  const normalizedText = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let fatalError: Papa.ParseError | undefined;
  let inputLengthError: BulkCsvError | undefined;
  let exceededTotalRows = false;

  Papa.parse<string[]>(normalizedText, {
    dynamicTyping: false,
    skipEmptyLines: false,
    step(result, parser) {
      const nextFatalError = result.errors.find(
        (error) => error.code !== "UndetectableDelimiter",
      );
      if (nextFatalError) {
        fatalError = nextFatalError;
        parser.abort();
        return;
      }

      const row = Array.isArray(result.data)
        ? result.data.map((cell) => String(cell ?? ""))
        : [String(result.data ?? "")];
      if ((row[0] ?? "").length > BULK_MAX_INPUT_CHARACTERS) {
        inputLengthError = new BulkCsvError(
          `Dòng ${rows.length + 1}, cột A vượt quá ${BULK_MAX_INPUT_CHARACTERS} ký tự.`,
        );
        parser.abort();
        return;
      }
      rows.push(row);

      // Papa Parse can emit one final blank row for a trailing line ending.
      // Keep at most one provisional row so malformed files cannot allocate
      // millions of blank rows before the limit is checked.
      if (rows.length > BULK_MAX_TOTAL_ROWS + 1) {
        exceededTotalRows = true;
        parser.abort();
      }
    },
  });

  if (fatalError) {
    throw new BulkCsvError(
      `Không thể đọc CSV tại dòng ${(fatalError.row ?? 0) + 1}: ${fatalError.message}`,
    );
  }
  if (inputLengthError) throw inputLengthError;
  if (exceededTotalRows) {
    throw new BulkCsvError(
      `File vượt giới hạn ${BULK_MAX_TOTAL_ROWS.toLocaleString("vi-VN")} dòng.`,
    );
  }

  if (
    rows.length > 1 &&
    isBlankRow(rows.at(-1) ?? []) &&
    /(?:\r\n|\n|\r)$/.test(normalizedText)
  ) {
    rows.pop();
  }

  if (rows.length > BULK_MAX_TOTAL_ROWS) {
    throw new BulkCsvError(
      `File vượt giới hạn ${BULK_MAX_TOTAL_ROWS.toLocaleString("vi-VN")} dòng.`,
    );
  }

  rows.forEach((row, rowIndex) => {
    const extraColumnIndex = row
      .slice(1)
      .findIndex((cell) => cell.trim().length > 0);
    if (extraColumnIndex >= 0) {
      const columnNumber = extraColumnIndex + 2;
      throw new BulkCsvError(
        `Dòng ${rowIndex + 1}, cột ${columnNumber} đang có dữ liệu. File đầu vào chỉ được dùng cột A.`,
      );
    }
  });

  const values = rows.map((row) => row[0] ?? "");
  const nonEmptyRows = values.filter((value) => value.trim().length > 0).length;

  if (nonEmptyRows === 0) {
    throw new BulkCsvError("File chưa có số điện thoại nào trong cột A.");
  }
  if (nonEmptyRows > BULK_MAX_NON_EMPTY_ROWS) {
    throw new BulkCsvError(
      `File có ${nonEmptyRows.toLocaleString("vi-VN")} dòng dữ liệu, vượt giới hạn 10.000 dòng.`,
    );
  }

  return values;
}

export function neutralizeSpreadsheetFormula(value: string): string {
  return /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function buildBulkCsvText(rows: BulkPhoneRow[]): string {
  const matrix = rows.map((row) => [
    neutralizeSpreadsheetFormula(row.original),
    ...row.cells.map((cell) => neutralizeSpreadsheetFormula(cell.text)),
  ]);

  return `\uFEFF${Papa.unparse(matrix, {
    newline: "\r\n",
    quotes: true,
  })}`;
}
