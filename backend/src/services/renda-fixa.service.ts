import { RendaFixaRepository } from '../repositories/renda-fixa.repository.js';
import { rendaFixaSchema } from 'shared/src/schemas.js';
import { z } from 'zod';

export interface CreateRendaFixaDTO {
  institution: string;
  investedAmount: number;
  maturityDate: string;
  rateType: 'CDI_PERCENTAGE' | 'IPCA_PLUS';
  rateValue: number;
}

export interface UpdateRendaFixaDTO extends Partial<CreateRendaFixaDTO> {}

export interface RendaFixaResult {
  id: string;
  userId: string;
  institution: string;
  investedAmount: number;
  maturityDate: Date;
  rateType: string;
  rateValue: number;
  ipcaPlusRate: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ServiceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ValidationError extends Error {
  public readonly issues: z.ZodIssue[];
  public readonly statusCode: number;

  constructor(issues: z.ZodIssue[]) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.issues = issues;
    this.statusCode = 400;
  }
}

export class RendaFixaService {
  private repository: RendaFixaRepository;

  constructor(repository?: RendaFixaRepository) {
    this.repository = repository ?? new RendaFixaRepository();
  }

  async create(userId: string, data: CreateRendaFixaDTO): Promise<RendaFixaResult> {
    const validated = this.validate(data);

    const record = await this.repository.create({
      userId,
      institution: validated.institution,
      investedAmount: validated.investedAmount,
      maturityDate: new Date(validated.maturityDate),
      rateType: validated.rateType,
      rateValue: validated.rateValue,
      ipcaPlusRate: validated.rateType === 'IPCA_PLUS' ? validated.rateValue : null,
    });

    return this.toResult(record);
  }

  async update(userId: string, id: string, data: UpdateRendaFixaDTO): Promise<RendaFixaResult> {
    const existing = await this.repository.findById(id);

    if (!existing) {
      throw new ServiceError('Título de renda fixa não encontrado', 'NOT_FOUND', 404);
    }

    if (existing.userId !== userId) {
      throw new ServiceError('Título de renda fixa não encontrado', 'NOT_FOUND', 404);
    }

    // Merge with existing data for validation
    const merged: CreateRendaFixaDTO = {
      institution: data.institution ?? existing.institution,
      investedAmount: data.investedAmount ?? Number(existing.investedAmount),
      maturityDate: data.maturityDate ?? existing.maturityDate.toISOString(),
      rateType: data.rateType ?? existing.rateType,
      rateValue: data.rateValue ?? Number(existing.rateValue),
    };

    const validated = this.validate(merged);

    const record = await this.repository.update(id, {
      institution: validated.institution,
      investedAmount: validated.investedAmount,
      maturityDate: new Date(validated.maturityDate),
      rateType: validated.rateType,
      rateValue: validated.rateValue,
      ipcaPlusRate: validated.rateType === 'IPCA_PLUS' ? validated.rateValue : null,
    });

    return this.toResult(record);
  }

  async delete(userId: string, id: string): Promise<void> {
    const existing = await this.repository.findById(id);

    if (!existing) {
      throw new ServiceError('Título de renda fixa não encontrado', 'NOT_FOUND', 404);
    }

    if (existing.userId !== userId) {
      throw new ServiceError('Título de renda fixa não encontrado', 'NOT_FOUND', 404);
    }

    await this.repository.delete(id);
  }

  async list(userId: string): Promise<RendaFixaResult[]> {
    const records = await this.repository.findByUserId(userId);
    return records.map((record) => this.toResult(record));
  }

  async findById(userId: string, id: string): Promise<RendaFixaResult> {
    const record = await this.repository.findById(id);

    if (!record) {
      throw new ServiceError('Título de renda fixa não encontrado', 'NOT_FOUND', 404);
    }

    if (record.userId !== userId) {
      throw new ServiceError('Título de renda fixa não encontrado', 'NOT_FOUND', 404);
    }

    return this.toResult(record);
  }

  private validate(data: CreateRendaFixaDTO): CreateRendaFixaDTO {
    const result = rendaFixaSchema.safeParse(data);

    if (!result.success) {
      throw new ValidationError(result.error.issues);
    }

    return result.data;
  }

  private toResult(record: any): RendaFixaResult {
    return {
      id: record.id,
      userId: record.userId,
      institution: record.institution,
      investedAmount: Number(record.investedAmount),
      maturityDate: record.maturityDate,
      rateType: record.rateType,
      rateValue: Number(record.rateValue),
      ipcaPlusRate: record.ipcaPlusRate ? Number(record.ipcaPlusRate) : null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
