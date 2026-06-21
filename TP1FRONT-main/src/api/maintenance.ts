import { apiClient } from './client';

export interface MarketRates {
  lag1: number;
  lag2: number;
  lag3: number;
}

export async function getMarketRates(): Promise<MarketRates> {
  const res = await apiClient.get<MarketRates>('/api/maintenance/market-rates');
  return res.data;
}

export async function updateMarketRates(data: MarketRates): Promise<MarketRates> {
  const res = await apiClient.patch<MarketRates>('/api/maintenance/market-rates', data);
  return res.data;
}
