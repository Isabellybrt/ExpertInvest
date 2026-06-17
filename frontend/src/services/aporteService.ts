/**
 * Aporte service layer — handles API communication for aporte operations.
 * Uses the shared apiClient for authenticated requests.
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { apiClient } from './api';

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

const aporteService = {
  async list(): Promise<AporteResult[]> {
    const response = await apiClient.get<AporteResult[]>('/aportes');
    return response.data;
  },

  async listByAsset(assetId: string, assetType: 'RENDA_FIXA' | 'FII'): Promise<AporteResult[]> {
    const response = await apiClient.get<AporteResult[]>(
      `/aportes/${assetId}?assetType=${assetType}`
    );
    return response.data;
  },

  async create(data: CreateAporteDTO): Promise<AporteResult> {
    const response = await apiClient.post<AporteResult>('/aportes', data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/aportes/${id}`);
  },
};

export default aporteService;
