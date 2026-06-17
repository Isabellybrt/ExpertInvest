// === Enums ===

export enum RateType {
  CDI_PERCENTAGE = 'CDI_PERCENTAGE',
  IPCA_PLUS = 'IPCA_PLUS',
}

export enum AssetType {
  RENDA_FIXA = 'RENDA_FIXA',
  FII = 'FII',
}

export enum OperationType {
  NEW_POSITION = 'NEW_POSITION',
  EXISTING_POSITION = 'EXISTING_POSITION',
}

export enum IndexType {
  CDI = 'CDI',
  IPCA = 'IPCA',
}

// === Renda Fixa DTOs ===

export interface CreateRendaFixaDTO {
  institution: string;
  investedAmount: number;
  maturityDate: string;
  rateType: 'CDI_PERCENTAGE' | 'IPCA_PLUS';
  rateValue: number;
}

// === FII DTOs ===

export interface CreateFIIDTO {
  ticker: string;
  shares: number;
  averagePrice: number;
  purchaseDate: string;
}

// === Aporte DTOs ===

export interface CreateAporteDTO {
  assetType: 'RENDA_FIXA' | 'FII';
  assetId?: string;
  amount?: number;
  shares?: number;
  pricePerShare?: number;
  date: string;
}

// === Dashboard DTOs ===

export interface PortfolioSummary {
  totalPatrimony: number;
  rendaFixaTotal: number;
  fiiTotal: number;
  rendaFixaPercentage: number;
  fiiPercentage: number;
  estimatedMonthlyDividends: number;
}

export interface PatrimonyPoint {
  month: string;
  value: number;
}

export interface DividendPoint {
  month: string;
  value: number;
  isProjection: boolean;
}

export interface FIIPerformanceData {
  ticker: string;
  shares: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  acquisitionValue: number;
  variationPercent: number;
  lastDividend: number;
  dividendYield: number;
  lastUpdateDate: string;
  isStale: boolean;
}

// === Export DTOs ===

export interface ExportRow {
  date: string;
  assetName: string;
  assetType: 'Renda_Fixa' | 'FII';
  investedAmount: number;
  shares: number | null;
  currentBalance: number;
}
