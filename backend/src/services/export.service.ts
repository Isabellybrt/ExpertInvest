import ExcelJS from 'exceljs';
import { createObjectCsvStringifier } from 'csv-writer';
import { IExportService, ExportRow } from './interfaces/export.interface.js';
import { RendaFixaRepository } from '../repositories/renda-fixa.repository.js';
import { FIIRepository } from '../repositories/fii.repository.js';
import { AporteRepository } from '../repositories/aporte.repository.js';
import { MarketIndexRepository } from '../repositories/market-index.repository.js';
import { CalculationService } from './calculation.service.js';

const TIMEOUT_MS = 30_000;

/**
 * ExportService generates CSV and Excel files containing portfolio data.
 *
 * Columns: date (YYYY-MM-DD), assetName, assetType (Renda_Fixa | FII),
 * investedAmount (2 decimals), shares (null for RF), currentBalance (2 decimals).
 *
 * Performance: 5-second response for up to 5000 records, cancels after 30s.
 *
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4
 */
export class ExportService implements IExportService {
  private rendaFixaRepository: RendaFixaRepository;
  private fiiRepository: FIIRepository;
  private aporteRepository: AporteRepository;
  private marketIndexRepository: MarketIndexRepository;
  private calculationService: CalculationService;

  constructor(
    rendaFixaRepo?: RendaFixaRepository,
    fiiRepo?: FIIRepository,
    aporteRepo?: AporteRepository,
    marketIndexRepo?: MarketIndexRepository,
    calculationSvc?: CalculationService
  ) {
    this.rendaFixaRepository = rendaFixaRepo ?? new RendaFixaRepository();
    this.fiiRepository = fiiRepo ?? new FIIRepository();
    this.aporteRepository = aporteRepo ?? new AporteRepository();
    this.marketIndexRepository = marketIndexRepo ?? new MarketIndexRepository();
    this.calculationService = calculationSvc ?? new CalculationService();
  }

  /**
   * Gather all export rows for a user by combining aporte data with
   * current balance calculations.
   */
  async getExportRows(userId: string): Promise<ExportRow[]> {
    // Fetch all user data in parallel
    const [aportes, rendaFixaAssets, fiis, cdiIndex, ipcaIndex] = await Promise.all([
      this.aporteRepository.findByUserId(userId),
      this.rendaFixaRepository.findByUserId(userId),
      this.fiiRepository.findByUserId(userId),
      this.marketIndexRepository.getLatest('CDI'),
      this.marketIndexRepository.getLatest('IPCA'),
    ]);

    const cdiRate = cdiIndex ? Number(cdiIndex.value) : 0;
    const ipcaRate = ipcaIndex ? Number(ipcaIndex.value) : 0;

    // Build lookup maps for current balance computation
    const rfMap = new Map<string, number>();
    for (const rf of rendaFixaAssets) {
      const projection = this.calculationService.calculateRendaFixaProjection(
        {
          id: rf.id,
          investedAmount: Number(rf.investedAmount),
          rateType: rf.rateType,
          rateValue: Number(rf.rateValue),
          ipcaPlusRate: rf.ipcaPlusRate ? Number(rf.ipcaPlusRate) : null,
          maturityDate: rf.maturityDate,
          createdAt: rf.createdAt,
        },
        cdiRate,
        ipcaRate
      );
      rfMap.set(rf.id, projection.projectedBalance);
    }

    const fiiMap = new Map<string, { ticker: string; currentBalance: number; shares: number }>();
    for (const fii of fiis) {
      const latestQuotePrice = fii.quotes && fii.quotes.length > 0
        ? Number(fii.quotes[0]!.price)
        : Number(fii.averagePrice);
      fiiMap.set(fii.id, {
        ticker: fii.ticker,
        currentBalance: fii.shares * latestQuotePrice,
        shares: fii.shares,
      });
    }

    // Map aportes to export rows
    const rows: ExportRow[] = aportes.map((aporte) => {
      const date = formatDate(aporte.date);
      const isRF = aporte.assetType === 'RENDA_FIXA';

      let assetName: string;
      let currentBalance: number;
      let shares: string;

      if (isRF && aporte.rendaFixaId) {
        const rf = rendaFixaAssets.find((r) => r.id === aporte.rendaFixaId);
        assetName = rf ? rf.institution : 'Renda Fixa';
        currentBalance = rfMap.get(aporte.rendaFixaId) ?? Number(aporte.amount);
        shares = '';
      } else if (!isRF && aporte.fiiId) {
        const fiiData = fiiMap.get(aporte.fiiId);
        assetName = fiiData?.ticker ?? 'FII';
        currentBalance = fiiData?.currentBalance ?? 0;
        shares = aporte.shares != null ? String(aporte.shares) : '';
      } else {
        assetName = isRF ? 'Renda Fixa' : 'FII';
        currentBalance = Number(aporte.amount);
        shares = isRF ? '' : (aporte.shares != null ? String(aporte.shares) : '');
      }

      return {
        date,
        assetName,
        assetType: isRF ? 'Renda_Fixa' : 'FII',
        investedAmount: Number(aporte.amount).toFixed(2),
        shares,
        currentBalance: currentBalance.toFixed(2),
      };
    });

    return rows;
  }

  /**
   * Generate CSV buffer from user portfolio data.
   * Validates: Requirements 15.1, 15.2, 15.3, 15.4
   */
  async generateCSV(userId: string): Promise<Buffer> {
    return this.withTimeout(async () => {
      const rows = await this.getExportRows(userId);

      const csvStringifier = createObjectCsvStringifier({
        header: [
          { id: 'date', title: 'date' },
          { id: 'assetName', title: 'asset name' },
          { id: 'assetType', title: 'type' },
          { id: 'investedAmount', title: 'invested amount' },
          { id: 'shares', title: 'shares' },
          { id: 'currentBalance', title: 'current balance' },
        ],
      });

      const header = csvStringifier.getHeaderString() ?? '';
      const body = csvStringifier.stringifyRecords(rows);
      const csvContent = header + body;

      return Buffer.from(csvContent, 'utf-8');
    });
  }

  /**
   * Generate Excel buffer from user portfolio data.
   * Validates: Requirements 15.1, 15.2, 15.3, 15.4
   */
  async generateExcel(userId: string): Promise<Buffer> {
    return this.withTimeout(async () => {
      const rows = await this.getExportRows(userId);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Portfolio');

      worksheet.columns = [
        { header: 'date', key: 'date', width: 12 },
        { header: 'asset name', key: 'assetName', width: 25 },
        { header: 'type', key: 'assetType', width: 12 },
        { header: 'invested amount', key: 'investedAmount', width: 16 },
        { header: 'shares', key: 'shares', width: 10 },
        { header: 'current balance', key: 'currentBalance', width: 16 },
      ];

      for (const row of rows) {
        worksheet.addRow(row);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    });
  }

  /**
   * Wrap an async operation with a 30-second timeout.
   * If the operation exceeds the timeout, throws an error.
   * Validates: Requirement 15.4
   */
  private async withTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ExportTimeoutError('Export operation exceeded 30 seconds and was cancelled.'));
      }, TIMEOUT_MS);

      operation()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
}

export class ExportTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportTimeoutError';
  }
}

/**
 * Format a Date to ISO 8601 date string (YYYY-MM-DD).
 * Uses UTC to avoid timezone offset issues.
 */
function formatDate(date: Date): string {
  const isoString = date.toISOString().split('T')[0];
  return isoString!;
}
