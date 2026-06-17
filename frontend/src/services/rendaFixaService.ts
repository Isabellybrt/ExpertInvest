/**
 * Renda Fixa API service.
 * Handles CRUD operations for Renda Fixa assets via the backend API.
 */

import { apiClient } from './api';
import type { CreateRendaFixaDTO } from '@shared';

export interface RendaFixaAsset {
  id: string;
  userId: string;
  institution: string;
  investedAmount: number;
  maturityDate: string;
  rateType: 'CDI_PERCENTAGE' | 'IPCA_PLUS';
  rateValue: number;
  ipcaPlusRate?: number;
  createdAt: string;
  updatedAt: string;
}

export type UpdateRendaFixaDTO = Partial<CreateRendaFixaDTO>;

const rendaFixaService = {
  async list(): Promise<RendaFixaAsset[]> {
    const response = await apiClient.get<RendaFixaAsset[]>('/renda-fixa');
    return response.data;
  },

  async create(data: CreateRendaFixaDTO): Promise<RendaFixaAsset> {
    const response = await apiClient.post<RendaFixaAsset>('/renda-fixa', data);
    return response.data;
  },

  async update(id: string, data: UpdateRendaFixaDTO): Promise<RendaFixaAsset> {
    const response = await apiClient.put<RendaFixaAsset>(`/renda-fixa/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/renda-fixa/${id}`);
  },
};

export default rendaFixaService;
