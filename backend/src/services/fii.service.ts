import { fiiSchema } from '@shared/src/schemas.js';
import { FIIRepository } from '../repositories/fii.repository.js';
import { z } from 'zod';

export interface CreateFIIDTO {
  ticker: string;
  shares: number;
  averagePrice: number;
  purchaseDate: string;
}

export interface UpdateFIIDTO {
  ticker?: string;
  shares?: number;
  averagePrice?: number;
  purchaseDate?: string;
}

export interface FIIResult {
  id: string;
  userId: string;
  ticker: string;
  shares: number;
  averagePrice: number;
  purchaseDate: string;
  createdAt: string;
  updatedAt: string;
}

export class FIIServiceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: z.ZodIssue[];

  constructor(message: string, code: string, statusCode: number, details?: z.ZodIssue[]) {
    super(message);
    this.name = 'FIIServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class FIIService {
  private fiiRepository: FIIRepository;

  constructor(fiiRepository?: FIIRepository) {
    this.fiiRepository = fiiRepository ?? new FIIRepository();
  }

  async create(userId: string, data: CreateFIIDTO): Promise<FIIResult> {
    this.validate(data);

    const fii = await this.fiiRepository.create({
      userId,
      ticker: data.ticker,
      shares: data.shares,
      averagePrice: data.averagePrice,
      purchaseDate: new Date(data.purchaseDate),
    });

    return this.toResult(fii);
  }

  async update(id: string, userId: string, data: UpdateFIIDTO): Promise<FIIResult> {
    const existing = await this.fiiRepository.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new FIIServiceError('FII not found', 'NOT_FOUND', 404);
    }

    // Build the full data for validation (merge existing + updates)
    const mergedData: CreateFIIDTO = {
      ticker: data.ticker ?? existing.ticker,
      shares: data.shares ?? existing.shares,
      averagePrice: data.averagePrice ?? Number(existing.averagePrice),
      purchaseDate: data.purchaseDate ?? existing.purchaseDate.toISOString(),
    };

    this.validate(mergedData);

    const updated = await this.fiiRepository.update(id, {
      ...(data.ticker !== undefined && { ticker: data.ticker }),
      ...(data.shares !== undefined && { shares: data.shares }),
      ...(data.averagePrice !== undefined && { averagePrice: data.averagePrice }),
      ...(data.purchaseDate !== undefined && { purchaseDate: new Date(data.purchaseDate) }),
    });

    return this.toResult(updated);
  }

  async delete(id: string, userId: string): Promise<void> {
    const existing = await this.fiiRepository.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new FIIServiceError('FII not found', 'NOT_FOUND', 404);
    }

    await this.fiiRepository.delete(id);
  }

  async list(userId: string): Promise<FIIResult[]> {
    const fiis = await this.fiiRepository.findByUserId(userId);
    return fiis.map((fii) => this.toResult(fii));
  }

  private validate(data: CreateFIIDTO): void {
    const result = fiiSchema.safeParse(data);
    if (!result.success) {
      throw new FIIServiceError(
        'Validation failed',
        'VALIDATION_ERROR',
        400,
        result.error.issues
      );
    }
  }

  private toResult(fii: any): FIIResult {
    return {
      id: fii.id,
      userId: fii.userId,
      ticker: fii.ticker,
      shares: fii.shares,
      averagePrice: Number(fii.averagePrice),
      purchaseDate: fii.purchaseDate instanceof Date
        ? fii.purchaseDate.toISOString()
        : fii.purchaseDate,
      createdAt: fii.createdAt instanceof Date
        ? fii.createdAt.toISOString()
        : fii.createdAt,
      updatedAt: fii.updatedAt instanceof Date
        ? fii.updatedAt.toISOString()
        : fii.updatedAt,
    };
  }
}
