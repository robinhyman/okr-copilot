export interface KrUpdateRow {
  objective: string;
  keyResult: string;
  currentValue: number;
  targetValue: number;
  updatedAtIso: string;
}

export class ExcelKrAdapter {
  // TODO-B3: Parse workbook rows and map headers with validation + error reporting.
  async ingestFromPath(filePath: string): Promise<{ rows: KrUpdateRow[]; warnings: string[] }> {
    return {
      rows: [],
      warnings: [`Placeholder only. Excel ingestion not implemented for file: ${filePath}`]
    };
  }
}
