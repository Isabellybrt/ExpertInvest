import { z } from 'zod';
import { aporteRendaFixaSchema, aporteFIISchema } from 'shared/src/schemas.js';
import { AporteRepository } from '../repositories/aporte.repository.js';
import { RendaFixaRepository } from '../repositories/renda-fixa.repository.js';
import { FIIRepository } from '../repositories/fii.repository.js';
import { withTransaction, TransactionClient } from '../repositories/index.js';

// === DTOs ===

export interface CreateAporteRendaFixaDTO {
  assetType: 'RENDA_FIXA';
  assetId?: string;
  amount: number;
  date: string;
  // Fields for new position creation
  institution?: string;
  maturityDate?: string;
  rateType?: 'CDI_PERCENTAGE' | 'IPCA_PLUS';
  rateValue?: number;
}

export interface CreateAporteFIIDTO {
  assetType: 'FII';
  assetId?: string;
  shares: number;
  pricePerShare: number;
  date: string;
  // Fields for new position creation
  ticker?: string;
  purchaseDate?: string;
}

export type CreateAporteDTO = CreateAporteRendaFixaDTO | CreateAporteFIIDTO;

export interface AporteResult {
  id: string;
  userId: string;
  assetType: 'RENDA_FIXA' | 'FII';
  rendaFixaId: string | null;
  fiiId: string | null;
  amount: number;
  shares: number | null;
  pricePerShare: number | null;
  operationType: 'NEW_POSITION' | 'EXISTING_POSITION';
  date: string;
  createdAt: string;
}

export interface AporteResultWithAsset extends AporteResult {
  assetName: string;
}

export interface AssetOption {
  id: string;
  label: string;
}

export interface UserAssetsResponse {
  fii: AssetOption[];
  rendaFixa: AssetOption[];
}

// === Errors ===

export class AporteServiceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: z.ZodIssue[];

  constructor(message: string, code: string, statusCode: number, details?: z.ZodIssue[]) {
    super(message);
    this.name = 'AporteServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// === Service ===

export class AporteService {
  private aporteRepository: AporteRepository;
  private rendaFixaRepository: RendaFixaRepository;
  private fiiRepository: FIIRepository;

  constructor(
    aporteRepository?: AporteRepository,
    rendaFixaRepository?: RendaFixaRepository,
    fiiRepository?: FIIRepository
  ) {
    this.aporteRepository = aporteRepository ?? new AporteRepository();
    this.rendaFixaRepository = rendaFixaRepository ?? new RendaFixaRepository();
    this.fiiRepository = fiiRepository ?? new FIIRepository();
  }

  /**
   * Register a new aporte. Uses a Prisma transaction to ensure atomicity (Req 3.6).
   * - For Renda Fixa: sums amount to existing balance
   * - For FII: recalculates average price with weighted formula
   * - For new positions: delegates to create logic
   */
  async registerAporte(userId: string, data: CreateAporteDTO): Promise<AporteResult> {
    if (data.assetType === 'RENDA_FIXA') {
      return this.registerRendaFixaAporte(userId, data as CreateAporteRendaFixaDTO);
    } else if (data.assetType === 'FII') {
      return this.registerFIIAporte(userId, data as CreateAporteFIIDTO);
    }

    throw new AporteServiceError('Tipo de ativo inválido', 'VALIDATION_ERROR', 400);
  }

  /**
   * List all aportes for a user, including resolved asset names.
   */
  async listByUser(userId: string): Promise<AporteResultWithAsset[]> {
    const aportes = await this.aporteRepository.findByUserIdWithAssets(userId);
    return aportes.map((a) => this.toResultWithAsset(a));
  }

  /**
   * List user's registered assets formatted for dropdown selection.
   * Fetches FIIs and RendaFixas in parallel and maps them to AssetOption shape.
   */
  async listUserAssets(userId: string): Promise<UserAssetsResponse> {
    const [fiis, rendaFixas] = await Promise.all([
      this.fiiRepository.findByUserId(userId),
      this.rendaFixaRepository.findByUserId(userId),
    ]);

    return {
      fii: fiis.map((f) => ({ id: f.id, label: f.ticker })),
      rendaFixa: rendaFixas.map((r) => ({
        id: r.id,
        label: this.formatRendaFixaLabel(r),
      })),
    };
  }

  /**
   * List aportes for a specific asset.
   */
  async listByAsset(assetId: string, assetType: 'RENDA_FIXA' | 'FII'): Promise<AporteResult[]> {
    const aportes = await this.aporteRepository.findByAssetId(assetId, assetType);
    return aportes.map((a) => this.toResult(a));
  }

  /**
   * Delete an aporte and reverse its effect on the associated asset.
   * - For Renda Fixa (EXISTING_POSITION): subtracts amount from the asset balance
   * - For FII (EXISTING_POSITION): recalculates shares and average price
   * - For NEW_POSITION: deletes the associated asset if no other aportes reference it
   */
  async deleteAporte(userId: string, aporteId: string): Promise<void> {
    const aporte = await this.aporteRepository.findById(aporteId);

    if (!aporte) {
      throw new AporteServiceError('Aporte não encontrado', 'NOT_FOUND', 404);
    }

    if (aporte.userId !== userId) {
      throw new AporteServiceError('Aporte não encontrado', 'NOT_FOUND', 404);
    }

    await withTransaction(async (tx: TransactionClient) => {
      // Reverse the effect on the asset
      if (aporte.operationType === 'EXISTING_POSITION') {
        await this.reverseExistingPositionAporte(aporte, tx);
      } else if (aporte.operationType === 'NEW_POSITION') {
        await this.reverseNewPositionAporte(aporte, tx);
      }

      // Delete the aporte record
      await this.aporteRepository.delete(aporteId, tx);
    });
  }

  private async reverseExistingPositionAporte(aporte: any, tx: TransactionClient): Promise<void> {
    if (aporte.assetType === 'RENDA_FIXA' && aporte.rendaFixaId) {
      const rendaFixa = await this.rendaFixaRepository.findById(aporte.rendaFixaId, tx);
      if (rendaFixa) {
        const currentBalance = Number(rendaFixa.investedAmount);
        const newBalance = Math.max(0, currentBalance - Number(aporte.amount));
        await this.rendaFixaRepository.update(aporte.rendaFixaId, { investedAmount: newBalance }, tx);
      }
    } else if (aporte.assetType === 'FII' && aporte.fiiId) {
      const fii = await this.fiiRepository.findById(aporte.fiiId, tx);
      if (fii && aporte.shares && aporte.pricePerShare) {
        const currentShares = fii.shares;
        const currentAvgPrice = Number(fii.averagePrice);
        const aporteShares = aporte.shares;

        const newShares = currentShares - aporteShares;
        if (newShares <= 0) {
          // All shares came from this aporte — reset to zero
          await this.fiiRepository.update(aporte.fiiId, { shares: 0, averagePrice: 0 }, tx);
        } else {
          // Reverse weighted average: newAvg = (totalCost - removedCost) / newShares
          const totalCost = currentShares * currentAvgPrice;
          const removedCost = aporteShares * Number(aporte.pricePerShare);
          const newAveragePrice = (totalCost - removedCost) / newShares;
          await this.fiiRepository.update(aporte.fiiId, { shares: newShares, averagePrice: Math.max(0, newAveragePrice) }, tx);
        }
      }
    }
  }

  private async reverseNewPositionAporte(aporte: any, tx: TransactionClient): Promise<void> {
    // For new position aportes, check if the asset has other aportes
    // If not, delete the asset entirely
    if (aporte.assetType === 'RENDA_FIXA' && aporte.rendaFixaId) {
      const otherAportes = await this.aporteRepository.findByAssetId(aporte.rendaFixaId, 'RENDA_FIXA', tx);
      const hasOtherAportes = otherAportes.some((a: any) => a.id !== aporte.id);
      if (!hasOtherAportes) {
        await this.rendaFixaRepository.delete(aporte.rendaFixaId, tx);
      } else {
        // Just subtract the amount
        const rendaFixa = await this.rendaFixaRepository.findById(aporte.rendaFixaId, tx);
        if (rendaFixa) {
          const newBalance = Math.max(0, Number(rendaFixa.investedAmount) - Number(aporte.amount));
          await this.rendaFixaRepository.update(aporte.rendaFixaId, { investedAmount: newBalance }, tx);
        }
      }
    } else if (aporte.assetType === 'FII' && aporte.fiiId) {
      const otherAportes = await this.aporteRepository.findByAssetId(aporte.fiiId, 'FII', tx);
      const hasOtherAportes = otherAportes.some((a: any) => a.id !== aporte.id);
      if (!hasOtherAportes) {
        await this.fiiRepository.delete(aporte.fiiId, tx);
      } else if (aporte.shares && aporte.pricePerShare) {
        const fii = await this.fiiRepository.findById(aporte.fiiId, tx);
        if (fii) {
          const newShares = fii.shares - aporte.shares;
          if (newShares <= 0) {
            await this.fiiRepository.update(aporte.fiiId, { shares: 0, averagePrice: 0 }, tx);
          } else {
            const totalCost = fii.shares * Number(fii.averagePrice);
            const removedCost = aporte.shares * Number(aporte.pricePerShare);
            const newAveragePrice = (totalCost - removedCost) / newShares;
            await this.fiiRepository.update(aporte.fiiId, { shares: newShares, averagePrice: Math.max(0, newAveragePrice) }, tx);
          }
        }
      }
    }
  }

  // === Private: Renda Fixa Aporte ===

  private async registerRendaFixaAporte(
    userId: string,
    data: CreateAporteRendaFixaDTO
  ): Promise<AporteResult> {
    // Validate input
    const parseResult = aporteRendaFixaSchema.safeParse(data);
    if (!parseResult.success) {
      throw new AporteServiceError(
        'Dados de aporte inválidos',
        'VALIDATION_ERROR',
        400,
        parseResult.error.issues
      );
    }

    return withTransaction(async (tx: TransactionClient) => {
      if (data.assetId) {
        // Existing position: sum amount to balance (Req 3.1)
        return this.aporteExistingRendaFixa(userId, data, tx);
      } else {
        // New position: delegate to create logic (Req 3.3)
        return this.aporteNewRendaFixa(userId, data, tx);
      }
    });
  }

  private async aporteExistingRendaFixa(
    userId: string,
    data: CreateAporteRendaFixaDTO,
    tx: TransactionClient
  ): Promise<AporteResult> {
    const existing = await this.rendaFixaRepository.findById(data.assetId!, tx);

    if (!existing || existing.userId !== userId) {
      throw new AporteServiceError('Título de renda fixa não encontrado', 'NOT_FOUND', 404);
    }

    // Req 3.1: new balance = current + amount
    const currentBalance = Number(existing.investedAmount);
    const newBalance = currentBalance + data.amount;

    await this.rendaFixaRepository.update(
      data.assetId!,
      { investedAmount: newBalance },
      tx
    );

    // Register in history (Req 3.4)
    const aporte = await this.aporteRepository.create(
      {
        userId,
        assetType: 'RENDA_FIXA',
        rendaFixaId: data.assetId!,
        amount: data.amount,
        operationType: 'EXISTING_POSITION',
        date: new Date(data.date),
      },
      tx
    );

    return this.toResult(aporte);
  }

  private async aporteNewRendaFixa(
    userId: string,
    data: CreateAporteRendaFixaDTO,
    tx: TransactionClient
  ): Promise<AporteResult> {
    if (!data.institution || !data.maturityDate || !data.rateType || !data.rateValue) {
      throw new AporteServiceError(
        'Para nova posição de Renda Fixa, informe institution, maturityDate, rateType e rateValue',
        'VALIDATION_ERROR',
        400
      );
    }

    // Create new Renda Fixa position (Req 3.3)
    const newRendaFixa = await this.rendaFixaRepository.create(
      {
        userId,
        institution: data.institution,
        investedAmount: data.amount,
        maturityDate: new Date(data.maturityDate),
        rateType: data.rateType,
        rateValue: data.rateValue,
        ipcaPlusRate: data.rateType === 'IPCA_PLUS' ? data.rateValue : null,
      },
      tx
    );

    // Register in history (Req 3.4)
    const aporte = await this.aporteRepository.create(
      {
        userId,
        assetType: 'RENDA_FIXA',
        rendaFixaId: newRendaFixa.id,
        amount: data.amount,
        operationType: 'NEW_POSITION',
        date: new Date(data.date),
      },
      tx
    );

    return this.toResult(aporte);
  }

  // === Private: FII Aporte ===

  private async registerFIIAporte(
    userId: string,
    data: CreateAporteFIIDTO
  ): Promise<AporteResult> {
    // Validate input
    const parseResult = aporteFIISchema.safeParse(data);
    if (!parseResult.success) {
      throw new AporteServiceError(
        'Dados de aporte inválidos',
        'VALIDATION_ERROR',
        400,
        parseResult.error.issues
      );
    }

    return withTransaction(async (tx: TransactionClient) => {
      if (data.assetId) {
        // Existing position: recalculate average price (Req 3.2)
        return this.aporteExistingFII(userId, data, tx);
      } else {
        // New position: delegate to create logic (Req 3.3)
        return this.aporteNewFII(userId, data, tx);
      }
    });
  }

  private async aporteExistingFII(
    userId: string,
    data: CreateAporteFIIDTO,
    tx: TransactionClient
  ): Promise<AporteResult> {
    const existing = await this.fiiRepository.findById(data.assetId!, tx);

    if (!existing || existing.userId !== userId) {
      throw new AporteServiceError('FII não encontrado', 'NOT_FOUND', 404);
    }

    // Req 3.2: recalculate average price
    // newAvg = (Q1*P1 + Q2*P2) / (Q1 + Q2)
    const q1 = existing.shares;
    const p1 = Number(existing.averagePrice);
    const q2 = data.shares;
    const p2 = data.pricePerShare;

    const newShares = q1 + q2;
    const newAveragePrice = (q1 * p1 + q2 * p2) / newShares;

    await this.fiiRepository.update(
      data.assetId!,
      {
        shares: newShares,
        averagePrice: newAveragePrice,
      },
      tx
    );

    // Register in history (Req 3.4)
    const totalAmount = data.shares * data.pricePerShare;
    const aporte = await this.aporteRepository.create(
      {
        userId,
        assetType: 'FII',
        fiiId: data.assetId!,
        amount: totalAmount,
        shares: data.shares,
        pricePerShare: data.pricePerShare,
        operationType: 'EXISTING_POSITION',
        date: new Date(data.date),
      },
      tx
    );

    return this.toResult(aporte);
  }

  private async aporteNewFII(
    userId: string,
    data: CreateAporteFIIDTO,
    tx: TransactionClient
  ): Promise<AporteResult> {
    if (!data.ticker) {
      throw new AporteServiceError(
        'Para nova posição de FII, informe o ticker',
        'VALIDATION_ERROR',
        400
      );
    }

    // Create new FII position (Req 3.3)
    const newFII = await this.fiiRepository.create(
      {
        userId,
        ticker: data.ticker,
        shares: data.shares,
        averagePrice: data.pricePerShare,
        purchaseDate: new Date(data.purchaseDate || data.date),
      },
      tx
    );

    // Register in history (Req 3.4)
    const totalAmount = data.shares * data.pricePerShare;
    const aporte = await this.aporteRepository.create(
      {
        userId,
        assetType: 'FII',
        fiiId: newFII.id,
        amount: totalAmount,
        shares: data.shares,
        pricePerShare: data.pricePerShare,
        operationType: 'NEW_POSITION',
        date: new Date(data.date),
      },
      tx
    );

    return this.toResult(aporte);
  }

  // === Helpers ===

  private toResult(aporte: any): AporteResult {
    return {
      id: aporte.id,
      userId: aporte.userId,
      assetType: aporte.assetType,
      rendaFixaId: aporte.rendaFixaId ?? null,
      fiiId: aporte.fiiId ?? null,
      amount: Number(aporte.amount),
      shares: aporte.shares ?? null,
      pricePerShare: aporte.pricePerShare ? Number(aporte.pricePerShare) : null,
      operationType: aporte.operationType,
      date: aporte.date instanceof Date ? aporte.date.toISOString() : aporte.date,
      createdAt: aporte.createdAt instanceof Date ? aporte.createdAt.toISOString() : aporte.createdAt,
    };
  }

  private formatRendaFixaLabel(rendaFixa: { institution: string; rateType: string; rateValue: { toString(): string } | number }): string {
    const suffix = rendaFixa.rateType === 'CDI_PERCENTAGE' ? 'CDI' : 'IPCA+';
    return `${rendaFixa.institution} - ${rendaFixa.rateValue}% ${suffix}`;
  }

  private toResultWithAsset(aporte: any): AporteResultWithAsset {
    let assetName: string;
    if (aporte.fii) {
      assetName = aporte.fii.ticker;
    } else if (aporte.rendaFixa) {
      assetName = aporte.rendaFixa.institution;
    } else {
      assetName = 'Ativo removido';
    }

    return {
      ...this.toResult(aporte),
      assetName,
    };
  }
}
