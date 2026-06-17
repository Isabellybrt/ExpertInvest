/**
 * Export service interface.
 * Defines the contract for generating portfolio data exports in CSV and Excel formats.
 *
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4
 */

export interface ExportRow {
  date: string;             // YYYY-MM-DD (ISO 8601)
  assetName: string;
  assetType: 'Renda_Fixa' | 'FII';
  investedAmount: string;   // 2 decimal places
  shares: string;           // number or empty string for RF
  currentBalance: string;   // 2 decimal places
}

export interface IExportService {
  /**
   * Generate a CSV file containing all portfolio data for the authenticated user.
   * Must complete within 5 seconds for up to 5000 records.
   * Must cancel after 30 seconds with an error message.
   */
  generateCSV(userId: string): Promise<Buffer>;

  /**
   * Generate an Excel file containing all portfolio data for the authenticated user.
   * Must complete within 5 seconds for up to 5000 records.
   * Must cancel after 30 seconds with an error message.
   */
  generateExcel(userId: string): Promise<Buffer>;
}
