import type { BulkCellTone, BulkOutputCell, BulkPhoneRow } from '../../shared/huyen-so/bulk-phone'
import type { CellObject, Sheet, SheetData } from 'write-excel-file/browser'

type WorkbookSheet = Sheet<ArrayBuffer>

const TONE_STYLES: Record<
  BulkCellTone,
  Pick<CellObject, 'backgroundColor' | 'textColor' | 'borderColor'>
> = {
  cat: {
    backgroundColor: '#EDF7F1',
    textColor: '#3E765B',
    borderColor: '#B8D6C4'
  },
  hung: {
    backgroundColor: '#FAEDF1',
    textColor: '#9C4C66',
    borderColor: '#E4BBC8'
  },
  special: {
    backgroundColor: '#FBF2DF',
    textColor: '#735C2D',
    borderColor: '#D8BD82'
  },
  error: {
    backgroundColor: '#FDECEC',
    textColor: '#9B2C2C',
    borderColor: '#E2A5A5'
  },
  neutral: {
    backgroundColor: '#F3F1F5',
    textColor: '#685D75',
    borderColor: '#D4CDD9'
  }
}

function inputCell(value: string): CellObject {
  return {
    value,
    type: String,
    fontWeight: 'bold',
    textColor: '#2C124D',
    backgroundColor: '#F8F3FB',
    borderColor: '#CBB4E1',
    borderStyle: 'thin',
    align: 'left',
    alignVertical: 'center',
    wrap: true,
    height: 30
  }
}

function outputCell(cell: BulkOutputCell): CellObject {
  const style = TONE_STYLES[cell.tone]
  return {
    value: cell.text,
    type: String,
    ...style,
    borderColor: cell.accented ? '#C9A663' : style.borderColor,
    borderStyle: cell.accented ? 'medium' : 'thin',
    align: 'left',
    alignVertical: 'center',
    wrap: true,
    height: 30
  }
}

function legendRow(label: string, description: string, tone: BulkCellTone): CellObject[] {
  return [
    {
      ...outputCell({ text: label, tone }),
      fontWeight: 'bold'
    },
    {
      value: description,
      type: String,
      textColor: '#20172D',
      align: 'left',
      alignVertical: 'center',
      wrap: true,
      height: 30
    }
  ]
}

export function buildBulkWorkbookSheets(rows: BulkPhoneRow[]): WorkbookSheet[] {
  const maxColumns = Math.max(2, ...rows.map((row) => Math.max(1, row.cells.length + 1)))
  const resultData = rows.map((row) => [inputCell(row.original), ...row.cells.map(outputCell)])
  const legendData: SheetData = [
    [
      {
        value: 'CHÚ GIẢI KẾT QUẢ',
        type: String,
        fontWeight: 'bold',
        textColor: '#F8F5FF',
        backgroundColor: '#2C124D',
        borderColor: '#2C124D',
        borderStyle: 'thin',
        align: 'left',
        alignVertical: 'center',
        height: 36
      },
      null
    ],
    legendRow('Cát tinh', 'TY = Thiên Y; SK = Sinh Khí; DN = Diên Niên; PV = Phục Vị.', 'cat'),
    legendRow('Hung tinh', 'LS = Lục Sát; HH = Họa Hại; NQ = Ngũ Quỷ; TM = Tuyệt Mệnh.', 'hung'),
    legendRow(
      'Đặc biệt',
      'S5 = cặp đặc biệt có số 5; (ẩn) = cặp cầu qua số 0; (kích) = cặp được số 5 kích phát.',
      'special'
    ),
    legendRow(
      'Dòng lỗi',
      'Số điện thoại không đủ điều kiện phân tích; các dòng khác vẫn được xử lý.',
      'error'
    ),
    [
      {
        value: 'Quy ước',
        type: String,
        fontWeight: 'bold',
        textColor: '#2C124D',
        backgroundColor: '#F8F3FB',
        borderColor: '#CBB4E1',
        borderStyle: 'thin',
        align: 'left',
        alignVertical: 'top',
        wrap: true,
        height: 42
      },
      {
        value:
          'Cột A giữ dữ liệu gốc. Cột B trở đi là các cặp theo đúng thứ tự bộ máy luận số. Chữ số sau mã là bậc 1–4, ví dụ TY 4 = Thiên Y bậc 4. Nội dung chỉ mang tính tham khảo.',
        type: String,
        textColor: '#685D75',
        backgroundColor: '#FCFAF7',
        borderColor: '#E4DDE8',
        borderStyle: 'thin',
        align: 'left',
        alignVertical: 'top',
        wrap: true,
        height: 42
      }
    ]
  ]

  return [
    {
      data: resultData,
      sheet: 'Kết quả',
      columns: [
        { width: 20 },
        ...Array.from({ length: maxColumns - 1 }, () => ({ width: 18 }))
      ],
      stickyColumnsCount: 1,
      showGridLines: false,
      zoomScale: 0.9
    },
    {
      data: legendData,
      sheet: 'Chú giải',
      columns: [{ width: 22 }, { width: 64 }],
      showGridLines: false
    }
  ]
}

export async function createBulkXlsxBytes(rows: BulkPhoneRow[]): Promise<Uint8Array> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const blob = await writeXlsxFile(buildBulkWorkbookSheets(rows), {
    fontFamily: 'Arial',
    fontSize: 11
  }).toBlob()
  return new Uint8Array(await blob.arrayBuffer())
}
