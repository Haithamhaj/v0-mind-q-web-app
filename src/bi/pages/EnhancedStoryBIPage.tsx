"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  Calendar,
  DollarSign,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { api, PipelineRunInfo } from "@/lib/api";
import { BiDataProvider, useBiDataContext } from "../data/provider";
import { formatCurrency, formatNumber, formatPercentage, useKpiCalculations } from "../data/kpi-calculations";

interface StoryBIDashboardProps {
  runInfo?: { runId?: string; updatedAt?: string };
}

const formatRunTimestamp = (iso?: string): string | undefined => {
  if (!iso) {
    return undefined;
  }
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const StoryBIDashboard: React.FC<StoryBIDashboardProps> = ({ runInfo }) => {
  const { dataset, loading, error } = useBiDataContext();
  const kpis = useKpiCalculations(dataset);
  const formattedCount = useMemo(() => dataset.length.toLocaleString("en-US"), [dataset.length]);
  const formattedUpdatedAt = formatRunTimestamp(runInfo?.updatedAt);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading BI data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">Unable to load operational data</h3>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (dataset.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No records available</h3>
          <p className="text-muted-foreground">
            Run phase 10 or pick another run to explore its BI output.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">لوحة المعلومات التجارية الذكية</h1>
          <p className="text-muted-foreground">
            مؤشرات محدثة لحركة الطلبات، الدفع عند الاستلام، والبصمة التشغيلية لكل تشغيل.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {runInfo?.runId && (
            <Badge variant="outline" className="font-mono text-xs">
              {runInfo.runId}
            </Badge>
          )}
          {formattedUpdatedAt && (
            <Badge variant="secondary" className="text-xs">
              آخر تحديث: {formattedUpdatedAt}
            </Badge>
          )}
          <Badge variant="secondary" className="flex items-center gap-2 px-3 py-1 text-xs">
            <Calendar className="h-3 w-3" />
            {formattedCount} سجل
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5 transition-all duration-300 hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الطلبات</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(kpis.totalOrders)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="mr-1 h-3 w-3" />
              مقارنةً بالفترة السابقة
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 bg-gradient-to-br from-card to-green-500/5 transition-all duration-300 hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إيرادات الطلبات</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.totalRevenue)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <Activity className="mr-1 h-3 w-3" />
              متوسط قيمة الطلب: {formatCurrency(kpis.avgOrderValue)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20 bg-gradient-to-br from-card to-orange-500/5 transition-all duration-300 hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">نسبة الدفع عند الاستلام</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(kpis.codRate)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <Activity className="mr-1 h-3 w-3" />
              متوسط تحصيل COD: {formatCurrency(kpis.avgCodAmount)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-gradient-to-br from-card to-purple-500/5 transition-all duration-300 hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">أبرز الوجهات</CardTitle>
            <MapPin className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">{kpis.topDestination}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="mr-1 h-3 w-3" />
              معدل التسليم: {formatPercentage(kpis.deliveryRate)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ملخص الأداء التشغيلي</CardTitle>
          <CardDescription>مقاييس أساسية لمتابعة الطلبات وتحويلات الدفع.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="text-sm text-muted-foreground">الطلبات المُسلمة</div>
              <div className="text-xl font-semibold">{formatNumber(kpis.deliveredOrders)}</div>
              <div className="text-xs text-green-600">من أصل {formatNumber(kpis.totalOrders)} طلب</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="text-sm text-muted-foreground">معدل التسليم</div>
              <div className="text-xl font-semibold">{formatPercentage(kpis.deliveryRate)}</div>
              <div className="text-xs text-blue-600">يشمل الحالات الناجحة فقط</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="text-sm text-muted-foreground">متوسط قيمة الطلب</div>
              <div className="text-xl font-semibold">{formatCurrency(kpis.avgOrderValue)}</div>
              <div className="text-xs text-purple-600">يشمل كل طرق الدفع</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const buildRunAwareEndpoints = (runId: string) => {
  const encoded = encodeURIComponent(runId);
  return {
    dataset: `/api/bi/orders?run=${encoded}`,
    insights: `/api/bi/insights?run=${encoded}`,
    dimensions: `/api/bi/dimensions?run=${encoded}`,
  };
};

const StoryBIPage: React.FC = () => {
  const [runs, setRuns] = useState<PipelineRunInfo[]>([]);
  const [selectedRun, setSelectedRun] = useState<string>();
  const [runsLoading, setRunsLoading] = useState<boolean>(true);
  const [runsError, setRunsError] = useState<string>();
  const [refreshToken, setRefreshToken] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;

    const loadRuns = async () => {
      setRunsLoading(true);
      try {
        const response = await api.listRuns();
        if (!isMounted) {
          return;
        }
        setRuns(response.runs);
        setRunsError(undefined);
        setSelectedRun((prev) => {
          if (prev && response.runs.some((run) => run.run_id === prev)) {
            return prev;
          }
          return response.runs[0]?.run_id ?? "run-latest";
        });
      } catch (err) {
        console.error("[story-bi] failed to load run list", err);
        if (!isMounted) {
          return;
        }
        setRunsError("Failed to load run list. Falling back to run-latest.");
        setSelectedRun((prev) => prev ?? "run-latest");
      } finally {
        if (isMounted) {
          setRunsLoading(false);
        }
      }
    };

    loadRuns();

    return () => {
      isMounted = false;
    };
  }, []);

  const runId = selectedRun ?? "run-latest";
  const providerEndpoints = useMemo(() => buildRunAwareEndpoints(runId), [runId, refreshToken]);
  const providerKey = useMemo(() => `${runId}-${refreshToken}`, [runId, refreshToken]);
  const runInfo = useMemo(
    () => runs.find((run) => run.run_id === runId) ?? { run_id: runId, updated_at: undefined },
    [runId, runs],
  );

  const handleRefresh = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background" dir="rtl">
      <div className="border-b border-border bg-card/50 px-6 py-5 backdrop-blur-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">اختر تشغيل المرحلة العاشرة</h2>
            <p className="text-sm text-muted-foreground">
              يتم تحميل البيانات مباشرة من مخرجات المرحلة 10 (BI Delivery) لكل تشغيل.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
            <div className="w-full min-w-[16rem] md:w-72">
              <Select
                value={runId}
                onValueChange={setSelectedRun}
                disabled={runsLoading || (!runs.length && !runsError)}
              >
                <SelectTrigger className="justify-between">
                  <SelectValue placeholder="اختر تشغيل BI" />
                </SelectTrigger>
                <SelectContent>
                  {runsLoading && (
                    <SelectItem value={runId} disabled>
                      جارٍ تحميل قائمة التشغيلات...
                    </SelectItem>
                  )}
                  {runs.map((run) => (
                    <SelectItem key={run.run_id} value={run.run_id}>
                      {run.run_id}
                    </SelectItem>
                  ))}
                  {!runsLoading && runs.length === 0 && (
                    <SelectItem value="run-latest">run-latest</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={handleRefresh}
              disabled={runsLoading}
            >
              {runsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span>تحديث البيانات</span>
            </Button>
          </div>
        </div>
        {runsError && <p className="mt-3 text-sm text-destructive">{runsError}</p>}
      </div>

      <div className="flex-1 bg-background">
        <BiDataProvider key={providerKey} endpoints={providerEndpoints}>
          <StoryBIDashboard runInfo={{ runId: runInfo?.run_id, updatedAt: runInfo?.updated_at }} />
        </BiDataProvider>
      </div>
    </div>
  );
};

export default StoryBIPage;
