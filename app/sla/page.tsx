"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"

import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, PipelineRunInfo } from "@/lib/api"
import { AlertCircle, Bot, CheckCircle2, ChevronRight, Loader2, MessageSquare, RefreshCw, XCircle } from "lucide-react"

type MetricStatus = "pass" | "warn" | "stop" | "unknown"

interface SlaMetric {
  id: string
  label: string
  value: number | null
  format: string
  unit: string
  status: MetricStatus
  thresholds?: { warn?: string; stop?: string }
}

interface SlaDocument {
  id: string | null
  title: string | null
  status: string | null
  compliance: number | null
  terms: number | null
  passed: number | null
  warned: number | null
  failed: number | null
}

interface RuleFailure {
  rule_id: string | null
  level: string | null
  count: number | null
  message: string | null
}

interface SlaPayload {
  run: string
  metrics: SlaMetric[]
  overall: { label: string; score: number | null; score_pct: number | null; status: MetricStatus }
  documents: SlaDocument[]
  gate: { status?: string; reasons: string[] }
  rule_failures: RuleFailure[]
  performance: { rows: number | null; approve_pct: number | null; reject_pct: number | null; exec_seconds: number | null }
  kpi_values: Record<string, number | null>
  targets: Record<string, Record<string, string>>
  notes?: string[]
  provenance?: Record<string, unknown>
  sla_results?: any
  generated_at?: string
}

interface SopDocumentSummary {
  title?: string | null
  source?: string | null
  path?: string | null
  run_id?: string | null
}

interface SopExpectationRecord {
  metric_id: string
  metric_label?: string
  target_value?: number | null
  target_unit?: string | null
  condition?: string | null
  timeframe?: string | null
  responsible_team?: string | null
  source_document?: string | null
  citation?: string | null
  rationale?: string | null
}

interface SlaSopResponse {
  run: string
  expectations: SopExpectationRecord[]
  documents: SopDocumentSummary[]
  provider?: string
  model?: string
  logs?: Array<Record<string, unknown>>
  recommendations?: Array<Record<string, unknown>>
}

interface SlaGapItem {
  metric_id: string
  metric_label?: string
  target_value?: number | null
  target_unit?: string | null
  actual_value?: number | null
  delta?: number | null
  timeframe?: string | null
  condition?: string | null
  responsible_team?: string | null
  source_document?: string | null
  citation?: string | null
  rationale?: string | null
  status?: string
}

interface SlaGapResponse {
  run: string
  analysis: {
    overall: Record<string, unknown>
    analysis: SlaGapItem[]
  }
  expectations_meta: {
    provider?: string
    model?: string
    documents: SopDocumentSummary[]
  }
  recommendations: Array<Record<string, unknown>>
}

type ChatMessage = { role: "user" | "assistant"; content: string; source?: "local" | "llm" | "system" }

const statusPalette: Record<MetricStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pass: { label: "ضمن الحد", color: "text-secondary", icon: <CheckCircle2 className="h-4 w-4 text-secondary" /> },
  warn: { label: "تحذير", color: "text-amber-500", icon: <AlertCircle className="h-4 w-4 text-amber-500" /> },
  stop: { label: "إيقاف", color: "text-destructive", icon: <XCircle className="h-4 w-4 text-destructive" /> },
  unknown: { label: "غير متوفر", color: "text-muted-foreground", icon: <AlertCircle className="h-4 w-4 text-muted-foreground" /> },
}

const statusLabels: Record<MetricStatus, string> = {
  pass: "ضمن الحدود",
  warn: "تحذير",
  stop: "توقف",
  unknown: "غير محدد",
}

const metricKeywords: Record<string, string[]> = {
  sla_pct: ["sla", "الالتزام", "نسبة الالتزام", "التسليم في الوقت"],
  rto_pct: ["rto", "إرجاع", "مرتجع", "عودة الشحنة"],
  lead_time_p50: ["lead time", "p50", "الزمن الوسيط", "زمن التوصيل"],
  lead_time_p90: ["lead time", "p90", "أعلى زمن", "الوقت الطويل"],
  cod_rate: ["cod", "الدفع عند الاستلام", "نسبة الدفع نقدا", "حصة الدفع"],
  cod_total: ["cod", "إجمالي المبالغ", "تحصيل", "القيمة النقدية"],
}

const normalizeQuestion = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\u0621-\u064a]+/gu, " ")
    .trim()

const questionMentions = (normalizedQuestion: string, keyword: string): boolean => {
  const normalizedKeyword = normalizeQuestion(keyword)
  if (!normalizedKeyword) return false
  return normalizedQuestion.includes(normalizedKeyword)
}

const formatMetricValue = (metric: SlaMetric): string => {
  const value = metric.value
  if (value === null || Number.isNaN(value)) {
    return "-"
  }
  switch (metric.format) {
    case "percentage":
      return `${(value * 100).toFixed(2)}%`
    case "duration_hours":
      return `${value.toFixed(1)} ساعة`
    case "currency":
      return `${value.toFixed(2)} ر.س`
    default:
      return value.toFixed(2)
  }
}

const describeMetric = (metric: SlaMetric): string => {
  const label = metric.label ?? metric.id
  const formatted = formatMetricValue(metric)
  const status = statusLabels[metric.status] ?? statusLabels.unknown
  const warn = metric.thresholds?.warn
  const stop = metric.thresholds?.stop
  const thresholdParts = [warn ? `تحذير: ${warn}` : null, stop ? `توقف: ${stop}` : null].filter(Boolean).join(" | ")
  return `${label}: ${formatted} (الحالة: ${status})${thresholdParts ? ` - ${thresholdParts}` : ""}`
}

const resolveLocalSlaAnswer = (
  question: string,
  payload?: SlaPayload,
  sop?: SlaSopResponse,
  gap?: SlaGapResponse,
): string | undefined => {
  if (!payload) {
    return undefined
  }

  const normalizedQuestion = normalizeQuestion(question)
  if (!normalizedQuestion) {
    return undefined
  }

  const matchedMetrics = payload.metrics.filter((metric) => {
    const keywords = [
      metric.id,
      metric.label ?? "",
      ...(metricKeywords[metric.id] ?? []),
    ]
    return keywords.some((keyword) => questionMentions(normalizedQuestion, keyword))
  })

  if (matchedMetrics.length > 0) {
    const lines: string[] = []
    if (payload.run) {
      lines.push(`تشغيل: ${payload.run}`)
    }
    if (payload.generated_at) {
      lines.push(`آخر تحديث: ${payload.generated_at}`)
    }
    const overallScore = payload.overall?.score_pct
    if (overallScore !== null && overallScore !== undefined) {
      const status = statusLabels[payload.overall.status] ?? statusLabels.unknown
      lines.push(`الامتثال العام: ${overallScore.toFixed(2)}% (الحالة: ${status})`)
    }
    lines.push("تفاصيل المؤشرات:")
    matchedMetrics.forEach((metric) => lines.push(`- ${describeMetric(metric)}`))
    return lines.join("\n")
  }

  const gateReasons = payload.gate?.reasons ?? []
  if (gateReasons.length > 0 && ["سبب", "أسباب", "gate", "إيقاف", "رفض"].some((keyword) => questionMentions(normalizedQuestion, keyword))) {
    const status = statusLabels[payload.gate?.status ?? "unknown"] ?? statusLabels.unknown
    const reasonLines = gateReasons.map((reason) => `- ${reason}`).join("\n")
    return `الحالة الحالية للبوابة: ${status}\nالأسباب المسجلة:\n${reasonLines}`
  }

  const documents = payload.documents ?? []
  if (
    documents.length > 0 &&
    ["عقد", "وثيقة", "documents", "اتفاق", "agreement"].some((keyword) => questionMentions(normalizedQuestion, keyword))
  ) {
    const lines = ["حالة وثائق SLA:"]
    documents.forEach((doc) => {
      const title = doc.title ?? doc.id ?? "وثيقة"
      const status = doc.status ?? "غير محدد"
      const compliance = doc.compliance != null ? `${doc.compliance}%` : "غير متوفر"
      lines.push(`- ${title}: الحالة ${status} | الالتزام ${compliance}`)
    })
    return lines.join("\n")
  }

  if (["تحسين", "recommend", "اقتراح", "حل"].some((keyword) => questionMentions(normalizedQuestion, keyword))) {
    const suggestions = improvementIdeasFromSla(payload)
    if (suggestions.length) {
      return ["مقترحات تحسين:", ...suggestions.slice(0, 5).map((idea) => `- ${idea}`)].join("\n")
    }
  }

  if (sop?.expectations?.length) {
    const expectationKeywords = ["sop", "هدف", "اهداف", "أهداف", "target", "policy", "سياسة"]
    if (expectationKeywords.some((keyword) => questionMentions(normalizedQuestion, keyword))) {
      const lines = ["الأهداف المستخلصة من مستندات SOP:"]
      sop.expectations.slice(0, 6).forEach((expectation) => {
        const valueText =
          expectation.target_value != null
            ? `${expectation.target_value}${expectation.target_unit ? ` ${expectation.target_unit}` : ""}`
            : "غير محدد"
        lines.push(
          `- ${expectation.metric_label ?? expectation.metric_id}: الهدف ${valueText}${
            expectation.timeframe ? ` (${expectation.timeframe})` : ""
          }${expectation.condition ? ` – شرط: ${expectation.condition}` : ""}`,
        )
      })
      return lines.join("\n")
    }
  }

  if (gap?.analysis?.analysis?.length) {
    const gapKeywords = ["فجوة", "gap", "تحليل", "فرق", "انحراف"]
    if (gapKeywords.some((keyword) => questionMentions(normalizedQuestion, keyword))) {
      const lines = ["تحليل الفجوات مقابل أهداف SOP:"]
      gap.analysis.analysis.slice(0, 6).forEach((item) => {
        const actualValue = item.actual_value != null ? Number(item.actual_value) : null
        const actual =
          actualValue != null && Number.isFinite(actualValue) ? actualValue.toFixed(3) : "غير متوفر"
        const targetValue = item.target_value != null ? Number(item.target_value) : null
        const target =
          targetValue != null && Number.isFinite(targetValue)
            ? targetValue.toFixed(3) + (item.target_unit ? ` ${item.target_unit}` : "")
            : "غير محدد"
        const deltaValue = item.delta != null ? Number(item.delta) : null
        const delta =
          deltaValue != null && Number.isFinite(deltaValue)
            ? `${deltaValue >= 0 ? "+" : ""}${deltaValue.toFixed(3)}`
            : "غير محسوب"
        lines.push(
          `- ${item.metric_label ?? item.metric_id}: الحالي ${actual} | الهدف ${target} | الفارق ${delta}`,
        )
      })
      return lines.join("\n")
    }

    const recommendationKeywords = ["خطة", "إجراء", "recommend", "مقترح", "action"]
    if (recommendationKeywords.some((keyword) => questionMentions(normalizedQuestion, keyword))) {
      const recs = gap.recommendations ?? []
      if (recs.length) {
        const lines = ["التوصيات المقترحة:"]
        recs.slice(0, 5).forEach((rec, idx) => {
          const recRecord = (rec ?? {}) as Record<string, unknown>
          const metricId = recRecord["metric_id"]
          const label = typeof metricId === "string" ? metricId : `recommendation_${idx + 1}`
          const actionsValue = recRecord["recommended_actions"]
          const action =
            typeof actionsValue === "string"
              ? actionsValue
              : JSON.stringify(actionsValue ?? recRecord)
          lines.push(`- ${label}: ${action}`)
        })
        return lines.join("\n")
      }
    }
  }

  return undefined
}

function improvementIdeasFromSla(data?: SlaPayload): string[] {
  if (!data) {
    return []
  }
  const ideas = new Set<string>()
  data.metrics.forEach((metric) => {
    if (metric.status === "warn") {
      ideas.add(`راجع خطة التحسين لمؤشر ${metric.label} قبل تجاوز الحد الحرج.`)
    }
    if (metric.status === "stop") {
      ideas.add(`استجب فورًا لفشل مؤشر ${metric.label}. استخدم العتبات ${JSON.stringify(metric.thresholds ?? {})}.`)
    }
  })
  ;(data.gate?.reasons ?? []).forEach((reason) => ideas.add(`سبب من مرحلة 09: ${reason}. وثّق الإجراء التصحيحي.`))
  data.rule_failures.forEach((rule) => {
    if (rule.rule_id) {
      ideas.add(`تحقق من القاعدة ${rule.rule_id} (${rule.level}) ومعالجة السبب: ${rule.message}.`)
    }
  })
  if (!ideas.size) {
    ideas.add("لا توجد ملاحظات حرجة حاليًا. استمر في مراقبة المؤشرات للحفاظ على الامتثال.")
  }
  return Array.from(ideas)
}

const formatTimestamp = (iso?: string | null): string | undefined => {
  if (!iso) return undefined
  try {
    return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
  } catch {
    return iso ?? undefined
  }
}

const SlaPage: React.FC = () => {
  const [runs, setRuns] = useState<PipelineRunInfo[]>([])
  const [runsLoading, setRunsLoading] = useState(true)
  const [runsError, setRunsError] = useState<string>()
  const [selectedRun, setSelectedRun] = useState<string | undefined>()

  const [slaData, setSlaData] = useState<SlaPayload>()
  const [slaLoading, setSlaLoading] = useState(true)
  const [slaError, setSlaError] = useState<string>()
  const [sopData, setSopData] = useState<SlaSopResponse>()
  const [sopLoading, setSopLoading] = useState(true)
  const [sopError, setSopError] = useState<string>()
  const [gapData, setGapData] = useState<SlaGapResponse>()
  const [gapLoading, setGapLoading] = useState(true)
  const [gapError, setGapError] = useState<string>()

  const [assistantHistory, setAssistantHistory] = useState<ChatMessage[]>([])
  const [assistantInput, setAssistantInput] = useState("")
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantError, setAssistantError] = useState<string>()
  const [refreshToken, setRefreshToken] = useState(0)

  const improvementIdeas = useMemo(() => improvementIdeasFromSla(slaData), [slaData])

  const quickSuggestions = useMemo(() => {
    const suggestions = new Set<string>()
    suggestions.add("ما هي نسبة الالتزام الحالية؟")
    suggestions.add("ما التوصيات لتحسين SLA؟")

    if (slaData?.metrics.some((metric) => metric.status === "warn" || metric.status === "stop")) {
      suggestions.add("ما أسباب التحذيرات أو التوقف الحالي؟")
    }
    if (slaData?.gate?.reasons?.length) {
      suggestions.add("ما أسباب رفض بوابة الاعتماد؟")
    }
    if (slaData?.documents?.length) {
      suggestions.add("ما حالة وثائق SLA الحالية؟")
    }
    if (sopData?.expectations?.length) {
      suggestions.add("ما هي الأهداف الرسمية في مستندات SOP؟")
    }
    if (gapData?.analysis?.analysis?.some((item) => (item.delta ?? 0) < 0)) {
      suggestions.add("ما الفجوات الحالية مقارنة بالأهداف؟")
    }
    if (gapData?.recommendations?.length) {
      suggestions.add("ما خطة العمل المقترحة من التحليل؟")
    }

    return Array.from(suggestions).slice(0, 4)
  }, [slaData, sopData, gapData])

  useEffect(() => {
    let mounted = true
    const loadRuns = async () => {
      setRunsLoading(true)
      try {
        const response = await api.listRuns()
        if (!mounted) return
        setRuns(response.runs)
        if (response.runs.length) {
          setSelectedRun((prev) => prev ?? response.runs[0].run_id)
        }
        setRunsError(undefined)
      } catch (error) {
        if (!mounted) return
        setRunsError(error instanceof Error ? error.message : "تعذر تحميل قائمة التشغيل")
      } finally {
        if (mounted) {
          setRunsLoading(false)
        }
      }
    }
    loadRuns()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const runParam = selectedRun ? `?run=${encodeURIComponent(selectedRun)}` : ""

    const fetchSla = async () => {
      setSlaLoading(true)
      setSlaError(undefined)
      try {
        const response = await fetch(`/api/bi/sla${runParam}`, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`فشل جلب بيانات SLA (status ${response.status})`)
        }
        const json: SlaPayload = await response.json()
        setSlaData(json)
      } catch (error) {
        if (controller.signal.aborted) return
        setSlaError(error instanceof Error ? error.message : "تعذر تحميل مؤشرات الامتثال")
      } finally {
        if (!controller.signal.aborted) {
          setSlaLoading(false)
        }
      }
    }

    const fetchSop = async () => {
      setSopLoading(true)
      setSopError(undefined)
      try {
        const response = await fetch(`/api/bi/sla/sop${runParam}`, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`فشل تحميل ملفات SOP (status ${response.status})`)
        }
        const json: SlaSopResponse = await response.json()
        setSopData(json)
      } catch (error) {
        if (controller.signal.aborted) return
        setSopError(error instanceof Error ? error.message : "تعذر تحميل مستندات SOP")
        setSopData(undefined)
      } finally {
        if (!controller.signal.aborted) {
          setSopLoading(false)
        }
      }
    }

    const fetchGap = async () => {
      setGapLoading(true)
      setGapError(undefined)
      try {
        const response = await fetch(`/api/bi/sla/gap-analysis${runParam}`, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`فشل تحليل الفجوات (status ${response.status})`)
        }
        const json: SlaGapResponse = await response.json()
        setGapData(json)
      } catch (error) {
        if (controller.signal.aborted) return
        setGapError(error instanceof Error ? error.message : "تعذر حساب فجوات SLA")
        setGapData(undefined)
      } finally {
        if (!controller.signal.aborted) {
          setGapLoading(false)
        }
      }
    }

    fetchSla()
    fetchSop()
    fetchGap()

    return () => controller.abort()
  }, [selectedRun, refreshToken])

  const handleAskAssistant = useCallback(async () => {
    if (!assistantInput.trim() || assistantLoading) {
      return
    }
    const question = assistantInput.trim()
    const historyForRequest = assistantHistory.map(({ role, content }) => ({ role, content }))

    setAssistantLoading(true)
    setAssistantError(undefined)
    setAssistantInput("")
    setAssistantHistory((prev) => [...prev, { role: "user", content: question }])

    const localAnswer = resolveLocalSlaAnswer(question, slaData, sopData, gapData)
    if (localAnswer) {
      setAssistantHistory((prev) => [...prev, { role: "assistant", content: localAnswer, source: "local" }])
      setAssistantLoading(false)
      return
    }

    try {
      const body = { run: selectedRun ?? "run-latest", question, history: historyForRequest }
      const response = await fetch("/api/bi/sla/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        throw new Error(`فشل طلب المساعد (status ${response.status})`)
      }
      const data = await response.json()
      const reply =
        typeof data.reply === "string" ? data.reply : data.reply?.reply ?? JSON.stringify(data.reply, null, 2)
      const source: ChatMessage["source"] =
        data?.context?.mode === "local" || data?.provider === "local-rules" ? "local" : "llm"
      setAssistantHistory((prev) => [...prev, { role: "assistant", content: reply, source }])
    } catch (error) {
      const message = error instanceof Error ? error.message : "حدث خطأ أثناء التواصل مع المساعد."
      setAssistantError(message)
      setAssistantHistory((prev) => [
        ...prev,
        { role: "assistant", content: `تعذر الحصول على رد: ${message}`, source: "system" },
      ])
    } finally {
      setAssistantLoading(false)
    }
  }, [assistantHistory, assistantInput, assistantLoading, selectedRun, slaData, sopData, gapData])

  const overallScore = slaData?.overall.score_pct ?? null
  const formattedGeneratedAt = formatTimestamp(slaData?.generated_at)

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">لوحة متابعة اتفاقيات مستوى الخدمة (SLA)</h1>
                <p className="text-muted-foreground">
                  نظرة تنفيذية تربط الأداء التشغيلي بالالتزامات التعاقدية وتعرض أين نحتاج إلى تدخل سريع.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-56">
                  <Select
                    value={selectedRun ?? "run-latest"}
                    onValueChange={(value) => setSelectedRun(value === "run-latest" ? undefined : value)}
                    disabled={runsLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={runsLoading ? 'جاري التحميل...' : 'اختر تشغيلًا'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="run-latest">أحدث تشغيل</SelectItem>
                      {runs.map((run) => (
                        <SelectItem key={run.run_id} value={run.run_id}>
                          {run.run_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={() => setRefreshToken((token) => token + 1)} disabled={slaLoading}>
                  <RefreshCw className="mr-2 h-4 w-4" /> تحديث
                </Button>
              </div>
            </div>

            {runsError && (
              <Card className="border-destructive/40 bg-destructive/10 text-destructive">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> تعذر تحميل قائمة التشغيل</CardTitle>
                  <CardDescription className="text-destructive">{runsError}</CardDescription>
                </CardHeader>
              </Card>
            )}

            {slaError && (
              <Card className="border-destructive/40 bg-destructive/10 text-destructive">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> تعذر تحميل مؤشرات الامتثال</CardTitle>
                  <CardDescription className="text-destructive">{slaError}</CardDescription>
                </CardHeader>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-secondary/20 bg-gradient-to-br from-card to-secondary/5 transition hover:shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-sm font-medium">{slaData?.overall.label ?? "معدل الامتثال العام"}</CardTitle>
                    <CardDescription>مدى التزام الشبكة بالمستهدف الزمني الحالي</CardDescription>
                  </div>
                  {statusPalette[slaData?.overall.status ?? 'unknown'].icon}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl font-bold text-foreground">{overallScore !== null ? `${overallScore.toFixed(1)}%` : '—'}</div>
                  <Progress value={overallScore ?? 0} max={100} />
                  <div className="text-xs text-muted-foreground">حالة بوابة الاعتماد: {slaData?.gate.status ?? "غير محددة"}</div>
                  {formattedGeneratedAt && <div className="text-xs text-muted-foreground">آخر تحديث للقياس: {formattedGeneratedAt}</div>}
                </CardContent>
              </Card>
              <Card className="transition hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">مؤشرات سريعة</CardTitle>
                  <CardDescription>أبرز المعطيات التشغيلية لهذا التشغيل</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div>عدد السجلات: {slaData?.performance.rows ?? '—'}</div>
                  <div>نسبة الموافقات: {slaData?.performance.approve_pct != null ? `${(slaData.performance.approve_pct * 100).toFixed(1)}%` : '—'}</div>
                  <div>نسبة الرفض: {slaData?.performance.reject_pct != null ? `${(slaData.performance.reject_pct * 100).toFixed(1)}%` : '—'}</div>
                  <div>زمن التنفيذ: {slaData?.performance.exec_seconds != null ? `${slaData.performance.exec_seconds.toFixed(1)} ثانية` : '—'}</div>
                </CardContent>
              </Card>
              <Card className="transition hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">أولويات التدخل</CardTitle>
                  <CardDescription>توصيات عملية استنادًا إلى وضع المؤشرات الحالي</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  {improvementIdeas.map((idea) => (
                    <div key={idea} className="flex items-start gap-2">
                      <ChevronRight className="mt-1 h-3 w-3" />
                      <span>{idea}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="transition hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>المؤشرات الأساسية</CardTitle>
                  <CardDescription>القيم المصدرية من مرحلة 09/10</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {slaLoading ? (
                  <div className="flex min-h-[120px] items-center justify-center text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> جار التحميل...
                  </div>
                ) : slaData ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {slaData.metrics.map((metric) => {
                      const palette = statusPalette[metric.status]
                      return (
                        <div key={metric.id} className="rounded-lg border border-border/40 bg-card/40 p-4 shadow-sm transition hover:border-border">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium text-foreground">{metric.label}</div>
                            <div className="flex items-center gap-1 text-xs font-semibold">
                              <span className={palette.color}>{palette.label}</span>
                              {palette.icon}
                            </div>
                          </div>
                          <div className="mt-2 text-2xl font-bold text-foreground">{formatMetricValue(metric)}</div>
                          {metric.thresholds && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              العتبات: تحذير={metric.thresholds.warn ?? '—'} | إيقاف={metric.thresholds.stop ?? '—'}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">لا تتوفر بيانات امتثال.</div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="transition hover:shadow-lg">
                <CardHeader>
                  <CardTitle>الملفات التعاقدية</CardTitle>
                  <CardDescription>عناصر SLA المرتبطة بالتشغيل الحالي</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {slaData?.documents?.length ? (
                    slaData.documents.map((doc) => (
                      <div key={doc.id ?? doc.title ?? Math.random()} className="rounded-lg border border-border/40 bg-card/40 p-3">
                        <div className="flex flex-col gap-1">
                          <div className="font-semibold text-foreground">{doc.title ?? 'وثيقة غير مسماة'}</div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">المعرف: {doc.id ?? 'غير متوفر'}</Badge>
                            <Badge variant="secondary">الحالة: {doc.status ?? 'غير محدد'}</Badge>
                          </div>
                          <div className="text-xs">الامتثال: {doc.compliance != null ? `${doc.compliance}%` : '—'} | البنود: {doc.terms ?? '—'} (✔ {doc.passed ?? '—'}, ⚠ {doc.warned ?? '—'}, ✖ {doc.failed ?? '—'})</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div>لا توجد وثائق مرتبطة في هذا التشغيل.</div>
                  )}
                </CardContent>
              </Card>

              <Card className="transition hover:shadow-lg">
                <CardHeader>
                  <CardTitle>إنذارات الاعتماد</CardTitle>
                  <CardDescription>الأسباب التشغيلية التي منعت الامتثال الكامل</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {slaData?.gate.reasons?.length ? (
                    slaData.gate.reasons.map((reason, idx) => (
                      <div key={`${reason}-${idx}`} className="flex items-start gap-2 rounded-lg border border-border/40 bg-card/40 p-3">
                        <AlertCircle className="mt-1 h-4 w-4 text-amber-500" />
                        <span>{reason}</span>
                      </div>
                    ))
                  ) : (
                    <div>لا توجد إنذارات.</div>
                  )}

                  {slaData?.rule_failures?.length ? (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-foreground">القواعد المخالفة</div>
                      {slaData.rule_failures.map((rule, idx) => (
                        <div key={`${rule.rule_id}-${idx}`} className="rounded-lg border border-border/40 bg-card/40 p-3">
                          <div className="font-semibold text-foreground">{rule.rule_id ?? 'Rule'}</div>
                          <div className="text-xs">المستوى: {rule.level ?? 'غير محدد'} | العدد: {rule.count ?? '—'}</div>
                          <div className="mt-1 text-xs">{rule.message ?? 'لا يوجد وصف إضافي.'}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="transition hover:shadow-lg">
                <CardHeader>
                  <CardTitle>معايير SOP المعتمدة</CardTitle>
                  <CardDescription>المستهدفات الرسمية المقتبسة من إجراءات التشغيل</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {sopLoading ? (
                    <div className="flex min-h-[120px] items-center justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> جار تحميل ملفات SOP...
                    </div>
                  ) : sopError ? (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive">
                      {sopError}
                    </div>
                  ) : sopData ? (
                    <div className="space-y-3">
                      <div className="text-sm">
                        تم استخراج {sopData.expectations.length} هدفًا من {sopData.documents.length} مستند.
                      </div>
                      {sopData.documents.length ? (
                        <div className="space-y-2">
                          {sopData.documents.slice(0, 5).map((doc, idx) => (
                            <div key={`${doc.source ?? idx}`} className="rounded-lg border border-border/40 bg-card/40 p-3">
                              <div className="font-semibold text-foreground">{doc.title ?? doc.source ?? "مستند بدون عنوان"}</div>
                              <div className="text-xs text-muted-foreground">{doc.source ?? "مسار غير متوفر"}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div>لم يجرِ تحميل ملفات مرجعية لهذا التشغيل بعد.</div>
                      )}
                      {sopData.expectations.length ? (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-foreground">أبرز الأهداف الكمية</div>
                          {sopData.expectations.slice(0, 5).map((expectation) => (
                            <div key={expectation.metric_id} className="rounded-lg border border-border/30 bg-card/30 p-3">
                              <div className="font-semibold text-foreground">
                                {expectation.metric_label ?? expectation.metric_id}
                              </div>
                              <div className="text-xs">
                                الهدف:{" "}
                                {expectation.target_value != null
                                  ? `${expectation.target_value}${expectation.target_unit ? ` ${expectation.target_unit}` : ""}`
                                  : "غير محدد"}
                                {expectation.timeframe ? ` | الإطار الزمني: ${expectation.timeframe}` : ""}
                              </div>
                              {expectation.condition && <div className="text-xs">الشرط: {expectation.condition}</div>}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {(sopData.provider || sopData.model) && (
                        <div className="text-xs text-muted-foreground">
                          مستخرج بواسطة: {sopData.provider ?? "—"} · النموذج: {sopData.model ?? "—"}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>لم يتم العثور على ملفات SOP لهذا التشغيل.</div>
                  )}
                </CardContent>
              </Card>

              <Card className="transition hover:shadow-lg">
                <CardHeader>
                  <CardTitle>تحليل الفجوات مقابل SOP</CardTitle>
                  <CardDescription>مقارنة القيم الحالية بالأهداف التعاقدية</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {gapLoading ? (
                    <div className="flex min-h-[120px] items-center justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> جار حساب الفجوات...
                    </div>
                  ) : gapError ? (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive">
                      {gapError}
                    </div>
                  ) : gapData && gapData.analysis?.analysis?.length ? (
                    <div className="space-y-2">
                      {gapData.analysis.analysis.slice(0, 6).map((item) => {
                        const actualValue = item.actual_value != null ? Number(item.actual_value) : null
                        const targetValue = item.target_value != null ? Number(item.target_value) : null
                        const deltaValue = item.delta != null ? Number(item.delta) : null
                        return (
                          <div key={item.metric_id} className="rounded-lg border border-border/40 bg-card/40 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-semibold text-foreground">{item.metric_label ?? item.metric_id}</div>
                              <Badge variant="outline">{item.status ?? "غير محدد"}</Badge>
                            </div>
                            <div className="text-xs">
                              الحالي:{" "}
                              {actualValue != null && Number.isFinite(actualValue) ? actualValue.toFixed(3) : "—"} | الهدف:{" "}
                              {targetValue != null && Number.isFinite(targetValue)
                                ? targetValue.toFixed(3) + (item.target_unit ? ` ${item.target_unit}` : "")
                                : "غير محدد"}
                            </div>
                            <div className="text-xs">
                              الفارق:{" "}
                              {deltaValue != null && Number.isFinite(deltaValue)
                                ? `${deltaValue >= 0 ? "+" : ""}${deltaValue.toFixed(3)}`
                                : "غير محسوب"}
                            </div>
                            {item.condition && <div className="text-xs">الشرط: {item.condition}</div>}
                            {item.rationale && <div className="text-xs">المبرر: {item.rationale}</div>}
                          </div>
                        )
                      })}
                      {gapData.recommendations?.length ? (
                        <div className="space-y-1 text-xs">
                          <div className="font-semibold text-foreground">خطة العمل المقترحة</div>
                          {gapData.recommendations.slice(0, 3).map((rec, idx) => {
                            const record = (rec ?? {}) as Record<string, unknown>
                            const actionsValue = record["recommended_actions"]
                            const metricId = record["metric_id"]
                            return (
                              <div key={`rec-${idx}`} className="rounded-lg border border-border/30 bg-card/30 p-2">
                                {metricId ? <div className="font-semibold text-foreground">{String(metricId)}</div> : null}
                                <div>
                                  {typeof actionsValue === "string"
                                    ? actionsValue
                                    : JSON.stringify(actionsValue ?? record)}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div>لا توجد بيانات فجوة متاحة.</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="transition hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>مساعد الامتثال</CardTitle>
                  <CardDescription>يستخدم بيانات SLA الحالية فقط للإجابة</CardDescription>
                </div>
                <Bot className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent className="space-y-4">
                {quickSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {quickSuggestions.map((suggestion) => (
                      <Button
                        key={suggestion}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAssistantInput(suggestion)}
                        disabled={assistantLoading}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                )}
                <div className="space-y-3">
                  <Textarea
                    placeholder="اكتب سؤالك حول الامتثال..."
                    value={assistantInput}
                    onChange={(event) => setAssistantInput(event.target.value)}
                    rows={4}
                  />
                  <div className="flex items-center gap-2">
                    <Button onClick={handleAskAssistant} disabled={assistantLoading || !assistantInput.trim()}>
                      {assistantLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                      إرسال
                    </Button>
                    {assistantError && <span className="text-sm text-destructive">{assistantError}</span>}
                  </div>
                </div>
                <div className="space-y-2">
                  {assistantHistory.length === 0 ? (
                    <div className="rounded-lg border border-border/40 bg-muted/30 p-3 text-sm text-muted-foreground">
                      اطرح سؤالاً حول مؤشرات SLA وسيقوم المساعد بتلخيص الوضع واقتراح إجراءات عملية.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {assistantHistory.map((message, idx) => (
                        <div
                          key={idx}
                          className={`whitespace-pre-wrap rounded-lg border border-border/40 p-3 text-sm ${message.role === 'user' ? 'bg-card/60 text-foreground' : 'bg-secondary/10 text-secondary-foreground'}`}
                        >
                          <span className="block text-xs font-semibold text-muted-foreground">
                            {message.role === "user" ? "أنت" : "المساعد"}
                          </span>
                          {message.role === "assistant" && message.source === "local" && (
                            <span className="text-[10px] font-medium text-emerald-500">رد فوري من البيانات الحالية</span>
                          )}
                          {message.role === "assistant" && message.source === "system" && (
                            <span className="text-[10px] font-medium text-destructive">تنبيه من النظام</span>
                          )}
                          <div className="mt-1">{message.content}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}

export default SlaPage
