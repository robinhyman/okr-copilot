import * as XLSX from 'xlsx';
import { addKrCheckin, listKeyResultsForUser, type UserKeyResult } from '../../data/okrs-repo.js';

export interface ImportRow {
  rowNumber: number;
  objective: string;
  keyResult: string;
  value: number | null;
  commentary: string;
  timestamp: string | null;
  timestampInvalid: boolean;
}

export interface RowError {
  rowNumber: number;
  code: string;
  message: string;
}

export interface PreviewRow {
  rowNumber: number;
  objective: string;
  keyResult: string;
  matched: boolean;
  keyResultId: number | null;
  currentValue: number | null;
  targetValue: number | null;
  proposedValue: number | null;
  commentary: string;
  timestamp: string | null;
  errors: RowError[];
}

export interface PreviewResult {
  summary: {
    totalRows: number;
    matchedRows: number;
    unmatchedRows: number;
    invalidRows: number;
    readyToApply: number;
  };
  rows: PreviewRow[];
}

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

function valueAsNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number(raw.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function timestampAsIso(raw: unknown): { value: string | null; invalid: boolean } {
  if (raw == null || raw === '') return { value: null, invalid: false };

  if (typeof raw === 'number') {
    const date = XLSX.SSF.parse_date_code(raw);
    if (!date) return { value: null, invalid: true };
    return {
      value: new Date(Date.UTC(date.y, date.m - 1, date.d, date.H ?? 0, date.M ?? 0, date.S ?? 0)).toISOString(),
      invalid: false
    };
  }

  if (typeof raw === 'string') {
    const date = new Date(raw.trim());
    if (Number.isNaN(date.valueOf())) return { value: null, invalid: true };
    return { value: date.toISOString(), invalid: false };
  }

  return { value: null, invalid: true };
}

export function parseWorkbook(buffer: Buffer): { rows: ImportRow[]; fileErrors: string[] } {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    return { rows: [], fileErrors: ['invalid_xlsx_file'] };
  }

  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return { rows: [], fileErrors: ['missing_sheet'] };

  const worksheet = workbook.Sheets[firstSheet];
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
  const requiredColumns = ['key_result', 'value'];
  const discoveredColumns = new Set(
    jsonRows.flatMap((row) => Object.keys(row).map((k) => String(k).trim().toLowerCase()))
  );

  for (const column of requiredColumns) {
    if (!discoveredColumns.has(column)) {
      return { rows: [], fileErrors: [`missing_required_column:${column}`] };
    }
  }

  const rows: ImportRow[] = jsonRows.map((row, index) => {
    const ts = timestampAsIso(row.timestamp);
    return {
      rowNumber: index + 2,
      objective: String(row.objective ?? '').trim(),
      keyResult: String(row.key_result ?? '').trim(),
      value: valueAsNumber(row.value),
      commentary: String(row.commentary ?? '').trim(),
      timestamp: ts.value,
      timestampInvalid: ts.invalid
    };
  });

  return { rows, fileErrors: [] };
}

function validateRow(row: ImportRow): RowError[] {
  const errors: RowError[] = [];
  if (!row.keyResult) {
    errors.push({ rowNumber: row.rowNumber, code: 'missing_key_result', message: 'key_result is required' });
  }
  if (row.value == null) {
    errors.push({ rowNumber: row.rowNumber, code: 'invalid_value', message: 'value must be numeric' });
  }
  if (row.timestampInvalid) {
    errors.push({ rowNumber: row.rowNumber, code: 'invalid_timestamp', message: 'timestamp is invalid' });
  }
  return errors;
}

function buildKrLookup(keyResults: UserKeyResult[]) {
  const map = new Map<string, UserKeyResult>();
  for (const kr of keyResults) {
    map.set(normalize(kr.title), kr);
  }
  return map;
}

export async function buildPreview(userId: string, rows: ImportRow[]): Promise<PreviewResult> {
  const existing = await listKeyResultsForUser(userId);
  const byTitle = buildKrLookup(existing);

  const previewRows: PreviewRow[] = rows.map((row) => {
    const errors = validateRow(row);
    const match = byTitle.get(normalize(row.keyResult));

    if (!match) {
      errors.push({
        rowNumber: row.rowNumber,
        code: 'key_result_not_found',
        message: 'No key result matched by title for this user'
      });
    }

    return {
      rowNumber: row.rowNumber,
      objective: row.objective,
      keyResult: row.keyResult,
      matched: Boolean(match),
      keyResultId: match?.id ?? null,
      currentValue: match?.current_value ?? null,
      targetValue: match?.target_value ?? null,
      proposedValue: row.value,
      commentary: row.commentary,
      timestamp: row.timestamp,
      errors
    };
  });

  const matchedRows = previewRows.filter((r) => r.matched).length;
  const invalidRows = previewRows.filter((r) => r.errors.length > 0).length;
  const readyToApply = previewRows.filter((r) => r.matched && r.errors.length === 0).length;

  return {
    summary: {
      totalRows: previewRows.length,
      matchedRows,
      unmatchedRows: previewRows.length - matchedRows,
      invalidRows,
      readyToApply
    },
    rows: previewRows
  };
}

export async function applyPreviewSelection(input: {
  userId: string;
  previewRows: PreviewRow[];
  selectedRowNumbers?: number[];
}) {
  const selected =
    input.selectedRowNumbers && input.selectedRowNumbers.length > 0
      ? new Set(input.selectedRowNumbers)
      : null;

  const candidates = input.previewRows.filter((row) => {
    if (row.errors.length > 0 || !row.keyResultId || row.proposedValue == null) return false;
    if (!selected) return true;
    return selected.has(row.rowNumber);
  });

  const applied = [];
  for (const row of candidates) {
    const checkin = await addKrCheckin({
      keyResultId: row.keyResultId!,
      userId: input.userId,
      value: row.proposedValue!,
      commentary: row.commentary,
      source: 'excel_import',
      createdAt: row.timestamp ?? undefined
    });
    applied.push({ rowNumber: row.rowNumber, keyResultId: row.keyResultId, checkinId: Number(checkin.id) });
  }

  return {
    appliedCount: applied.length,
    skippedCount: input.previewRows.length - applied.length,
    applied
  };
}
