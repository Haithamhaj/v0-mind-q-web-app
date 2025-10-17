"use client";

import { useMemo } from "react";
import { BiDatasetRow } from "./types";

export interface KpiValues {
  totalOrders: number;
  avgOrderValue: number;
  codRate: number;
  totalRevenue: number;
  deliveredOrders: number;
  deliveryRate: number;
  topDestination: string;
  avgCodAmount: number;
}

export const useKpiCalculations = (dataset: BiDatasetRow[]): KpiValues => {
  return useMemo(() => {
    if (!dataset || dataset.length === 0) {
      return {
        totalOrders: 0,
        avgOrderValue: 0,
        codRate: 0,
        totalRevenue: 0,
        deliveredOrders: 0,
        deliveryRate: 0,
        topDestination: "N/A",
        avgCodAmount: 0,
      };
    }

    // Calculate basic metrics
    const totalOrders = dataset.length;
    
    // Revenue calculations
    const totalRevenue = dataset.reduce((sum, row) => {
      const amount = parseFloat(String(row.amount || 0));
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
    
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // COD calculations
    const codOrders = dataset.filter(row => String(row.payment_method).toUpperCase() === 'COD');
    const codRate = totalOrders > 0 ? (codOrders.length / totalOrders) * 100 : 0;
    
    const totalCodAmount = dataset.reduce((sum, row) => {
      const codAmount = parseFloat(String(row.cod_amount || 0));
      return sum + (isNaN(codAmount) ? 0 : codAmount);
    }, 0);
    
    const avgCodAmount = codOrders.length > 0 ? totalCodAmount / codOrders.length : 0;
    
    // Delivery calculations
    const deliveredOrders = dataset.filter(row => String(row.status).toLowerCase() === 'delivered').length;
    const deliveryRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0;
    
    // Top destination
    const destinationCounts: Record<string, number> = {};
    dataset.forEach(row => {
      const dest = String(row.destination || 'Unknown');
      destinationCounts[dest] = (destinationCounts[dest] || 0) + 1;
    });
    
    const topDestination = Object.entries(destinationCounts).reduce((a, b) => 
      a[1] > b[1] ? a : b, ['N/A', 0]
    )[0];

    return {
      totalOrders,
      avgOrderValue,
      codRate,
      totalRevenue,
      deliveredOrders,
      deliveryRate,
      topDestination,
      avgCodAmount,
    };
  }, [dataset]);
};

export const formatCurrency = (value: number): string => {
  return `${value.toFixed(2)} ر.س`;
};

export const formatNumber = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
};

export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};