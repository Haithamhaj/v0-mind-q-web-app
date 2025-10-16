"use client"

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  Package, 
  DollarSign, 
  MapPin, 
  Calendar,
  BarChart3,
  LineChart,
  PieChart,
  Activity,
  Loader2,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

interface BiDashboardProps {
  runId: string;
  metrics: any;
  isLoading: boolean;
}

export function BiDashboard({ runId, metrics, isLoading }: BiDashboardProps) {
  const ordersChartRef = useRef<HTMLDivElement>(null);
  const codAmountChartRef = useRef<HTMLDivElement>(null);
  const codRateChartRef = useRef<HTMLDivElement>(null);
  const trendsChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (metrics && Object.keys(metrics).length > 0 && !isLoading) {
      setTimeout(() => {
        initializeCharts(metrics);
      }, 100);
    }
  }, [metrics, isLoading]);

  const initializeCharts = (data: any) => {
    // Orders by Destination Chart
    if (ordersChartRef.current && data.orders_by_destination?.length > 0) {
      const chart = echarts.init(ordersChartRef.current);
      chart.setOption({
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderColor: '#333',
          textStyle: { color: '#fff' }
        },
        xAxis: {
          type: 'category',
          data: data.orders_by_destination.map((item: any) => item.dt),
          axisLabel: { rotate: 45, fontSize: 10 }
        },
        yAxis: { 
          type: 'value',
          axisLabel: { fontSize: 10 }
        },
        series: [{
          name: 'عدد الطلبات',
          type: 'bar',
          data: data.orders_by_destination.map((item: any) => item.val),
          itemStyle: { 
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#3b82f6' },
              { offset: 1, color: '#1e40af' }
            ])
          },
          emphasis: {
            itemStyle: {
              color: '#2563eb'
            }
          }
        }],
        grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
        animation: true,
        animationDuration: 1000
      });
    }

    // COD Amount Chart
    if (codAmountChartRef.current && data.avg_cod_amount_destination?.length > 0) {
      const chart = echarts.init(codAmountChartRef.current);
      chart.setOption({
        tooltip: { 
          trigger: 'axis',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderColor: '#333',
          textStyle: { color: '#fff' }
        },
        xAxis: {
          type: 'category',
          data: data.avg_cod_amount_destination.map((item: any) => item.dt),
          axisLabel: { rotate: 45, fontSize: 10 }
        },
        yAxis: { 
          type: 'value',
          axisLabel: { fontSize: 10 }
        },
        series: [{
          name: 'متوسط مبلغ الدفع عند الاستلام',
          type: 'bar',
          data: data.avg_cod_amount_destination.map((item: any) => item.val),
          itemStyle: { 
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#10b981' },
              { offset: 1, color: '#059669' }
            ])
          }
        }],
        grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
        animation: true,
        animationDuration: 1200
      });
    }

    // COD Rate Chart (COD vs CC Distribution)
    if (codRateChartRef.current && data.cod_rate_by_receiver_mode?.length > 0) {
      const chart = echarts.init(codRateChartRef.current);
      chart.setOption({
        tooltip: {
          trigger: 'item',
          formatter: '{a} <br/>{b}: {c} ({d}%)'
        },
        legend: {
          orient: 'vertical',
          left: 'left',
          textStyle: { fontSize: 10 }
        },
        series: [{
          name: 'طريقة الدفع',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          data: data.cod_rate_by_receiver_mode.map((item: any) => ({
            value: item.val,
            name: item.dt === 'COD' ? 'الدفع عند الاستلام' : 'الدفع بالبطاقة'
          })),
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: '20',
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: false
          }
        }],
        color: ['#f59e0b', '#3b82f6'],
        animation: true,
        animationDuration: 1500
      });
    }

    // COD Rate by Destination Trends
    if (trendsChartRef.current && data.cod_rate_by_destination?.length > 0) {
      const chart = echarts.init(trendsChartRef.current);
      chart.setOption({
        tooltip: {
          trigger: 'axis',
          formatter: function(params: any) {
            return `${params[0].name}<br/>معدل الدفع عند الاستلام: ${(params[0].value * 100).toFixed(1)}%`;
          }
        },
        xAxis: {
          type: 'category',
          data: data.cod_rate_by_destination.map((item: any) => item.dt),
          axisLabel: { rotate: 45, fontSize: 10 }
        },
        yAxis: {
          type: 'value',
          axisLabel: { 
            fontSize: 10,
            formatter: function(value: number) {
              return (value * 100).toFixed(0) + '%';
            }
          }
        },
        series: [{
          name: 'معدل الدفع عند الاستلام',
          type: 'line',
          data: data.cod_rate_by_destination.map((item: any) => item.val),
          smooth: true,
          lineStyle: { width: 3, color: '#8b5cf6' },
          itemStyle: { color: '#8b5cf6' },
          areaStyle: {
            opacity: 0.3,
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#8b5cf6' },
              { offset: 1, color: 'transparent' }
            ])
          }
        }],
        grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
        animation: true,
        animationDuration: 1000
      });
    }
  };

  // Calculate metrics with corrected data
  const totalOrders = metrics.orders_total && metrics.orders_total.length > 0 
    ? metrics.orders_total[0].val 
    : 0;

  const totalDestinations = metrics.orders_by_destination ? metrics.orders_by_destination.length : 0;

  const codOrders = metrics.cod_rate_by_receiver_mode?.find((item: any) => item.dt === 'COD')?.val || 0;
  const ccOrders = metrics.cod_rate_by_receiver_mode?.find((item: any) => item.dt === 'CC')?.val || 0;
  const codRate = totalOrders > 0 ? (codOrders / totalOrders * 100) : 0;

  const topDestination = metrics.orders_by_destination && metrics.orders_by_destination.length > 0 
    ? metrics.orders_by_destination[0] 
    : null;

  if (!metrics || Object.keys(metrics).length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">
                جاري تحميل لوحة المعلومات التجارية
              </h1>
            </div>
            <p className="mt-2 text-gray-600">
              نقوم بمعالجة البيانات وإعداد التقارير المتقدمة...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">
            🎯 لوحة المعلومات التجارية الذكية
          </h1>
          <p className="text-lg text-gray-600">
            تحليل شامل للبيانات مع رؤى ذكية ومؤشرات الأداء الرئيسية
          </p>
          <Badge variant="outline" className="mt-2 bg-blue-50 text-blue-700">
            <Activity className="mr-1 h-4 w-4" />
            معرف التشغيل: {runId}
          </Badge>
        </div>

        {/* KPI Cards */}
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 bg-gradient-to-br from-blue-50 to-blue-100 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900">إجمالي الطلبات</CardTitle>
              <Package className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">{totalOrders.toLocaleString()}</div>
              <p className="text-xs text-blue-700">
                <ArrowUpRight className="inline h-3 w-3" />
                العدد الإجمالي للطلبات المسجلة
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-emerald-50 to-emerald-100 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-900">معدل الدفع عند الاستلام</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-900">{codRate.toFixed(1)}%</div>
              <p className="text-xs text-emerald-700">
                {codOrders.toLocaleString()} من أصل {totalOrders.toLocaleString()} طلب
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-purple-50 to-purple-100 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-900">عدد الوجهات</CardTitle>
              <MapPin className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900">{totalDestinations}</div>
              <p className="text-xs text-purple-700">
                المناطق الجغرافية المختلفة
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-amber-50 to-amber-100 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-900">أكبر وجهة</CardTitle>
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-900">
                {topDestination?.dt || 'غير محدد'}
              </div>
              <p className="text-xs text-amber-700">
                {topDestination?.val?.toLocaleString() || 0} طلب
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <Tabs defaultValue="geographic" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white shadow-sm">
            <TabsTrigger value="geographic" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              التوزيع الجغرافي
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              طرق الدفع
            </TabsTrigger>
            <TabsTrigger value="amounts" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              المبالغ
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-2">
              <LineChart className="h-4 w-4" />
              الاتجاهات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="geographic">
            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  توزيع الطلبات حسب الوجهة الجغرافية
                </CardTitle>
                <CardDescription>
                  عرض توزيع الطلبات على المناطق المختلفة في المملكة العربية السعودية
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div ref={ordersChartRef} className="h-96 w-full" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment">
            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-emerald-600" />
                  توزيع طرق الدفع
                </CardTitle>
                <CardDescription>
                  مقارنة بين الدفع عند الاستلام والدفع بالبطاقة الائتمانية
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div ref={codRateChartRef} className="h-96 w-full" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="amounts">
            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                  متوسط مبالغ الدفع عند الاستلام حسب الوجهة
                </CardTitle>
                <CardDescription>
                  تحليل متوسط المبالغ المدفوعة عند الاستلام في كل منطقة
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div ref={codAmountChartRef} className="h-96 w-full" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends">
            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-purple-600" />
                  معدل الدفع عند الاستلام حسب المنطقة
                </CardTitle>
                <CardDescription>
                  تحليل اتجاهات استخدام الدفع عند الاستلام في المناطق المختلفة
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div ref={trendsChartRef} className="h-96 w-full" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Button variant="outline" size="sm" className="mx-2">
            <Calendar className="mr-2 h-4 w-4" />
            تحديث البيانات
          </Button>
          <Button variant="outline" size="sm" className="mx-2">
            📊 تصدير التقرير
          </Button>
        </div>
      </div>
    </div>
  );
}