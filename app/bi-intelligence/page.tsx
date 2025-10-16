"use client"

import React, { useState, useEffect } from 'react';
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Brain,
  MessageSquare,
  Send,
  Sparkles,
  RefreshCw,
  Download,
  Loader2
} from "lucide-react";
import { api } from "@/lib/api";
import { BiDashboard } from "@/components/BI/BiDashboard";
import { BiChat } from "@/components/BI/BiChat";

interface BiIntelligencePageState {
  selectedRun: string;
  availableRuns: string[];
  isLoading: boolean;
  metrics: any;
  chatOpen: boolean;
  loadingMessage: string;
}

export default function BiIntelligencePage() {
  const [state, setState] = useState<BiIntelligencePageState>({
    selectedRun: '',
    availableRuns: [],
    isLoading: true,
    metrics: null,
    chatOpen: false,
    loadingMessage: 'جاري تحميل البيانات...'
  });

  useEffect(() => {
    fetchAvailableRuns();
  }, []);

  useEffect(() => {
    if (state.selectedRun) {
      fetchMetrics();
    }
  }, [state.selectedRun]);

  const fetchAvailableRuns = async () => {
    try {
      setState(prev => ({ ...prev, loadingMessage: 'جاري تحميل قائمة التشغيلات...' }));
      const response = await api.listRuns();
      const runs = response.runs.map((run: any) => run.run_id);
      setState(prev => ({
        ...prev,
        availableRuns: runs,
        selectedRun: runs[0] || '', // أحدث run تلقائياً
        isLoading: false,
        loadingMessage: 'تم تحميل البيانات بنجاح'
      }));
    } catch (error) {
      console.error('Error fetching runs:', error);
      setState(prev => ({ ...prev, isLoading: false, loadingMessage: 'خطأ في الاتصال بالخادم' }));
    }
  };

  const fetchMetrics = async () => {
    if (!state.selectedRun) return;
    
    try {
      setState(prev => ({ ...prev, isLoading: true, loadingMessage: 'جاري الاتصال بالخادم...' }));
      
      console.log('Fetching metrics for run:', state.selectedRun);
      
      // Fetch available metrics sequentially to avoid overwhelming the server
      setState(prev => ({ ...prev, loadingMessage: 'جاري تحميل البيانات الإجمالية...' }));
      const ordersTotal = await api.getBiMetric(state.selectedRun, 'orders_total').catch((err) => {
        console.error('Error fetching orders_total:', err);
        return null;
      });

      setState(prev => ({ ...prev, loadingMessage: 'جاري تحميل بيانات الطلبات حسب الوجهة...' }));
      const ordersByDestination = await api.getBiMetric(state.selectedRun, 'orders_by_destination').catch((err) => {
        console.error('Error fetching orders_by_destination:', err);
        return null;
      });

      setState(prev => ({ ...prev, loadingMessage: 'جاري تحميل بيانات المبالغ حسب الوجهة...' }));
      const avgCodAmount = await api.getBiMetric(state.selectedRun, 'avg_cod_amount_destination').catch((err) => {
        console.error('Error fetching avg_cod_amount_destination:', err);
        return null;
      });

      setState(prev => ({ ...prev, loadingMessage: 'جاري تحميل بيانات توزيع طرق الدفع...' }));
      const codDistribution = await api.getBiMetric(state.selectedRun, 'cod_rate_by_receiver_mode').catch((err) => {
        console.error('Error fetching cod_rate_by_receiver_mode:', err);
        return null;
      });

      setState(prev => ({ ...prev, loadingMessage: 'جاري تحميل بيانات معدل الدفع عند الاستلام حسب المنطقة...' }));
      const codRateByDestination = await api.getBiMetric(state.selectedRun, 'cod_rate_by_destination').catch((err) => {
        console.error('Error fetching cod_rate_by_destination:', err);
        return null;
      });

      console.log('Fetched metrics:', { 
        ordersTotal: !!ordersTotal, 
        ordersByDestination: !!ordersByDestination,
        avgCodAmount: !!avgCodAmount, 
        codDistribution: !!codDistribution,
        codRateByDestination: !!codRateByDestination 
      });

      setState(prev => ({
        ...prev,
        metrics: {
          orders_total: ordersTotal?.data || [],
          orders_by_destination: ordersByDestination?.data || [],
          avg_cod_amount_destination: avgCodAmount?.data || [],
          cod_rate_by_receiver_mode: codDistribution?.data || [],
          cod_rate_by_destination: codRateByDestination?.data || []
        },
        isLoading: false,
        loadingMessage: 'تم تحميل البيانات بنجاح'
      }));
    } catch (error) {
      console.error('Error fetching metrics:', error);
      setState(prev => ({ ...prev, isLoading: false, loadingMessage: 'حدث خطأ في تحميل البيانات' }));
    }
  };

  const toggleChat = () => {
    setState(prev => ({ ...prev, chatOpen: !prev.chatOpen }));
  };

  if (state.isLoading && !state.metrics) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto bg-background p-6">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <div className="text-lg">جاري تحميل نظام الذكاء التجاري...</div>
                <div className="text-sm text-muted-foreground">يتم تحضير البيانات والتحليلات</div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen" dir="rtl">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        
        {/* Main Content */}
        <main className="flex-1 overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
          <div className="h-full flex flex-col">
            {/* Header Section */}
            <div className="border-b border-border bg-card/50 backdrop-blur-sm p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Brain className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold text-foreground">
                        نظام الذكاء التجاري
                      </h1>
                      <p className="text-muted-foreground">
                        تحليل البيانات اللوجستية بالذكاء الاصطناعي
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      {state.isLoading ? state.loadingMessage : 'متصل مع النظام'}
                    </Badge>
                    {state.selectedRun && (
                      <Badge variant="outline" className="font-mono text-xs">
                        {state.selectedRun}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Run Selector */}
                  <div className="w-64">
                    <Select 
                      value={state.selectedRun} 
                      onValueChange={(value: string) => setState(prev => ({ ...prev, selectedRun: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر تشغيل التحليل" />
                      </SelectTrigger>
                      <SelectContent>
                        {state.availableRuns.map(run => (
                          <SelectItem key={run} value={run}>
                            {run}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Action Buttons */}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={fetchMetrics}
                    disabled={state.isLoading}
                  >
                    {state.isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    تحديث
                  </Button>

                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={toggleChat}
                    className="flex items-center gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    المساعد الذكي
                    {state.chatOpen && (
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full flex">
                {/* Main Dashboard */}
                <div className={`transition-all duration-300 ${
                  state.chatOpen ? 'flex-1 mr-96' : 'flex-1'
                } overflow-auto`}>
                  <BiDashboard 
                    runId={state.selectedRun}
                    metrics={state.metrics}
                    isLoading={state.isLoading}
                  />
                </div>

                {/* AI Chat Panel */}
                {state.chatOpen && (
                  <div className="w-96 border-l border-border bg-card/50 backdrop-blur-sm">
                    <BiChat 
                      runId={state.selectedRun}
                      onClose={() => setState(prev => ({ ...prev, chatOpen: false }))}
                      currentMetrics={state.metrics}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}