import { FIIRepository } from '../repositories/fii.repository.js';

export interface FIIPortfolioItem {
  ticker: string;
  shares: number;
  averagePrice: number;
  lastMonthDividend: number;
  projectedMonthlyYield: number;
}

export interface FIIDividendRecord {
  id: string;
  fiiId: string;
  dividendPerShare: number | { toNumber(): number };
  paymentDate: Date;
}

export interface FIIPortfolioServiceDeps {
  fiiRepository: FIIRepository;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export class FIIPortfolioService {
  private fiiRepository: FIIRepository;

  constructor(deps: FIIPortfolioServiceDeps) {
    this.fiiRepository = deps.fiiRepository;
  }

  async getPortfolio(userId: string): Promise<FIIPortfolioItem[]> {
    const fiis = await this.fiiRepository.findByUserIdWithAllDividends(userId);

    return fiis.map((fii) => {
      const shares = fii.shares;
      const averagePrice = round2(Number(fii.averagePrice));
      const dividends: FIIDividendRecord[] = fii.dividends.map((d) => ({
        id: d.id,
        fiiId: d.fiiId,
        dividendPerShare: d.dividendPerShare,
        paymentDate: d.paymentDate,
      }));

      const lastMonthDividend = this.calculateLastMonthDividend(shares, dividends, new Date());
      const projectedMonthlyYield = this.calculateProjectedMonthlyYield(shares, dividends);

      return {
        ticker: fii.ticker,
        shares,
        averagePrice,
        lastMonthDividend,
        projectedMonthlyYield,
      };
    });
  }

  getPreviousMonthRange(referenceDate: Date): [Date, Date] {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth(); // 0-indexed current month

    // Previous month
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear = year - 1;
    }

    const start = new Date(prevYear, prevMonth, 1, 0, 0, 0, 0);
    // Last day of previous month: day 0 of current month gives last day of prev month
    const lastDay = new Date(year, month, 0).getDate();
    const end = new Date(prevYear, prevMonth, lastDay, 23, 59, 59, 999);

    return [start, end];
  }

  calculateLastMonthDividend(
    shares: number,
    dividends: FIIDividendRecord[],
    referenceDate: Date
  ): number {
    if (shares === 0 || dividends.length === 0) {
      return 0;
    }

    const [start, end] = this.getPreviousMonthRange(referenceDate);

    const relevantDividends = dividends.filter((d) => {
      const paymentDate = d.paymentDate instanceof Date ? d.paymentDate : new Date(d.paymentDate);
      return paymentDate >= start && paymentDate <= end;
    });

    if (relevantDividends.length === 0) {
      return 0;
    }

    const sum = relevantDividends.reduce((acc, d) => {
      const dividendPerShare = typeof d.dividendPerShare === 'number'
        ? d.dividendPerShare
        : d.dividendPerShare.toNumber();
      return acc + dividendPerShare * shares;
    }, 0);

    return round2(sum);
  }

  calculateProjectedMonthlyYield(
    shares: number,
    dividends: FIIDividendRecord[]
  ): number {
    if (shares === 0 || dividends.length === 0) {
      return 0;
    }

    // Dividends are expected to be ordered by paymentDate desc
    // Take the most recent one
    const mostRecent = dividends[0]!;
    const dividendPerShare = typeof mostRecent.dividendPerShare === 'number'
      ? mostRecent.dividendPerShare
      : mostRecent.dividendPerShare.toNumber();

    return round2(dividendPerShare * shares);
  }
}
