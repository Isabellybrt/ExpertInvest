/**
 * FII service layer — handles API communication for FII CRUD operations.
 * Uses the shared apiClient for authenticated requests.
 */

import { apiClient } from './api';

export interface FIIAsset {
  id: string;
  ticker: string;
  shares: number;
  averagePrice: number;
  purchaseDate: string;
  createdAt: string;
  updatedAt: string;
}

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

const fiiService = {
  async list(): Promise<FIIAsset[]> {
    const response = await apiClient.get<FIIAsset[]>('/fiis');
    return response.data;
  },

  async create(data: CreateFIIDTO): Promise<FIIAsset> {
    const response = await apiClient.post<FIIAsset>('/fiis', data);
    return response.data;
  },

  async update(id: string, data: UpdateFIIDTO): Promise<FIIAsset> {
    const response = await apiClient.put<FIIAsset>(`/fiis/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/fiis/${id}`);
  },
};

export default fiiService;
