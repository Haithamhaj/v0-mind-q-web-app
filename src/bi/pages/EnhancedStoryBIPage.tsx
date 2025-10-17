'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, DollarSign, TrendingUp, MapPin, Activity, Calendar } from "lucide-react";
import { BiDataProvider, useBiDataContext } from '../data/provider';
import { useKpiCalculations, formatCurrency, formatNumber, formatPercentage } from '../data/kpi-calculations';

const StoryBIDashboard: React.FC = () => {
  const { dataset, loading, error } = useBiDataContext();
  const kpis = useKpiCalculations(dataset);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">خطأ في تحميل البيانات</h3>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (dataset.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">لا توجد بيانات متاحة</h3>
          <p className="text-muted-foreground">يرجى التأكد من وجود بيانات في النظام</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">لوحة معلومات الـ BI</h1>
          <p className="text-muted-foreground">تحليل شامل لبيانات الطلبات والشحن</p>
        </div>
        <Badge variant="secondary" className="px-3 py-1">
          <Calendar className="h-4 w-4 mr-2" />
          {dataset.length} طلب
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-all duration-300 border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الطلبات</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(kpis.totalOrders)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1" />
              طلب مسجل في النظام
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 border-green-500/20 bg-gradient-to-br from-card to-green-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.totalRevenue)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <Activity className="h-3 w-3 mr-1" />
              متوسط الطلب: {formatCurrency(kpis.avgOrderValue)}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 border-orange-500/20 bg-gradient-to-br from-card to-orange-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">معدل الدفع عند التسليم</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(kpis.codRate)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <Activity className="h-3 w-3 mr-1" />
              متوسط المبلغ: {formatCurrency(kpis.avgCodAmount)}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 border-purple-500/20 bg-gradient-to-br from-card to-purple-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">أعلى وجهة</CardTitle>
            <MapPin className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">{kpis.topDestination}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1" />
              معدل التسليم: {formatPercentage(kpis.deliveryRate)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Summary */}
      <Card>
        <CardHeader>
          <CardTitle>ملخص البيانات</CardTitle>
          <CardDescription>إحصائيات تفصيلية عن الطلبات</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">الطلبات المُسلمة</div>
              <div className="text-xl font-semibold">{formatNumber(kpis.deliveredOrders)}</div>
              <div className="text-xs text-green-600">من إجمالي {formatNumber(kpis.totalOrders)} طلب</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">معدل التسليم الناجح</div>
              <div className="text-xl font-semibold">{formatPercentage(kpis.deliveryRate)}</div>
              <div className="text-xs text-blue-600">من إجمالي الطلبات</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">متوسط مبلغ الطلب</div>
              <div className="text-xl font-semibold">{formatCurrency(kpis.avgOrderValue)}</div>
              <div className="text-xs text-purple-600">للطلب الواحد</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const StoryBIPage: React.FC = () => {
  return (
    <BiDataProvider>
      <StoryBIDashboard />
    </BiDataProvider>
  );
};

export default StoryBIPage;