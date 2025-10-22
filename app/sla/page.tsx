"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"

import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api, PipelineRunInfo } from "@/lib/api"
import { AlertCircle, CheckCircle2, Loader2, MessageSquare, RefreshCw, XCircle } from "lucide-react"

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

interface SlaPayload {
  run: string
  metrics: SlaMetric[]
  overall: { label: string; score: number | null; score_pct: number | null; status: MetricStatus }
  documents: SlaDocument[]
  gate: { status?: string; reasons: string[] }
  rule_failures: Array<{ rule_id: string | null; message: string | null }>
  performance: { rows: number | null; approve_pct: number | null; reject_pct: number | null; exec_seconds: number | null }
  notes?: string[]
  generated_at?: string
}

type ChatMessage = { role: "user" | "assistant"; content: string; source?: "local" | "system" | "llm" }

const statusPalette: Record<MetricStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pass: { label: "ضمن الحد", color: "text-secondary", icon: <CheckCircle2 className="h-4 w-4 text-secondary" /> },
  warn: { label: "تحذير", color: "text-amber-500", icon: <AlertCircle className="h-4 w-4 text-amber-500" /> },
  stop: { label: "إيقاف", color: "text-destructive", icon: <XCircle className="h-4 w-4 text-destructive" /> },
  unknown: { label: "غير محدد", color: "text-muted-foreground", icon: <AlertCircle className="h-4 w-4 text-muted-foreground" /> },
}

const normalizeStatus = (status?: string | null): MetricStatus => {
  const value = (status ?? "").toLowerCase()
  if (value === "pass" || value === "warn" || value === "stop") return value
  return "unknown"
}

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/gu, " ")
    .trim()

const describeMetric = (metric: SlaMetric): string => {
  const label = metric.label ?? metric.id
  const value = metric.value
  if (value === null || value === undefined) return `${label}: غير متوفر`
  if (metric.format === "percentage") return `${label}: ${(value * 100).toFixed(2)}%`
  return `${label}: ${value.toLocaleString()} ${metric.unit ?? ""}`.trim()
}

const formatMetricValue = (metric: SlaMetric): string => {
  const value = metric.value
  if (value === null || value === undefined) return "—"
  if (metric.format === "percentage") return `${(value * 100).toFixed(2)}%`
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${metric.unit ?? ""}`.trim()
}

const formatTimestamp = (timestamp?: string | null): string | null => {
  if (!timestamp) return null
  try {
    const date = new Date(timestamp)
    return date.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })
  } catch {
    return timestamp
  }
}

const resolveLocalSlaAnswer = (question: string, payload?: SlaPayload): string | undefined => {
  if (!payload) return undefined
  const normalizedQuestion = normalizeText(question)
  if (!normalizedQuestion) return undefined

  const matchedMetrics = payload.metrics.filter((metric) =>
    [metric.id, metric.label].some((keyword) => keyword && normalizeText(keyword).length > 0 && normalizedQuestion.includes(normalizeText(keyword))),
  )
  if (matchedMetrics.length > 0) {
    const lines = matchedMetrics.map((metric) => `- ${describeMetric(metric)}`)
    return ["ملخص المؤشرات المطلوبة:", ...lines].join("\n")
  }

  if (
    (payload.gate?.reasons?.length ?? 0) > 0 &&
    ["سبب", "أسباب", "gate", "إيقاف", "رفض"].some((keyword) => normalizeText(keyword).length > 0 && normalizedQuestion.includes(normalizeText(keyword)))
  ) {
    const reasons = payload.gate.reasons.map((reason) => `- ${reason}`)
    return ["الحالة الحالية للبوابة:", payload.gate.status ?? "غير محددة", "الأسباب:", ...reasons].join("\n")
  }

  return undefined
}

const SlaPage: React.FC = () => {
  const [runs, setRuns] = useState<PipelineRunInfo[]>([])
  const [runsLoading, setRunsLoading] = useState(true)
  const [runsError, setRunsError] = useState<string | undefined>()

  const [selectedRun, setSelectedRun] = useState<string | undefined>()
  const [refreshToken, setRefreshToken] = useState(0)

  const [slaData, setSlaData] = useState<SlaPayload | undefined>()
  const [slaLoading, setSlaLoading] = useState(true)
  const [slaError, setSlaError] = useState<string | undefined>()

  const [assistantInput, setAssistantInput] = useState("")
  const [assistantHistory, setAssistantHistory] = useState<ChatMessage[]>([])
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantError, setAssistantError] = useState<string | undefined>()

  const currentRunParam = selectedRun ?? "run-latest"

  const loadRuns = useCallback(async () => {
    setRunsLoading(true)
    setRunsError(undefined)
    try {
      const response = await api.listRuns()
      setRuns(response.runs ?? [])
    } catch (error) {
      setRunsError(error instanceof Error ? error.message : "تعذر تحميل قائمة التشغيل.")
    } finally {
      setRunsLoading(false)
    }
  }, [])

  const loadSlaData = useCallback(async () => {
    const controller = new AbortController()
    setSlaLoading(true)
    setSlaError(undefined)
    try {
      const payload = await fetch(`/api/bi/sla?run=${encodeURIComponent(currentRunParam)}`, { signal: controller.signal })
      if (!payload.ok) throw new Error(`HTTP ${payload.status} - ${payload.statusText}`)
      setSlaData(await payload.json())
    } catch (error) {
      setSlaError(error instanceof Error ? error.message : "تعذر تحميل مؤشرات الامتثال.")
      setSlaData(undefined)
    } finally {
      setSlaLoading(false)
    }
    return () => controller.abort()
  }, [currentRunParam])

  useEffect(() => {
    loadRuns().catch(() => undefined)
  }, [loadRuns])

  useEffect(() => {
    loadSlaData()
  }, [loadSlaData, refreshToken])

  const improvementIdeas = useMemo(() => {
    if (!slaData) return []
    const notes = slaData.notes ?? []
    const failures = slaData.rule_failures.map((failure) => `فحص القاعدة ${failure.rule_id ?? "غير معروفة"}: ${failure.message ?? "بدون تفاصيل"}`)
    return [...failures, ...notes].slice(0, 5)
  }, [slaData])

  const handleAskAssistant = useCallback(async () => {
    if (!assistantInput.trim()) return
    const question = assistantInput.trim()
    setAssistantHistory((prev) => [...prev, { role: "user", content: question }])
    setAssistantInput("")
    setAssistantLoading(true)
    setAssistantError(undefined)

    const localAnswer = resolveLocalSlaAnswer(question, slaData)
    if (localAnswer) {
      setAssistantHistory((prev) => [...prev, { role: "assistant", content: localAnswer, source: "local" }])
      setAssistantLoading(false)
      return
    }

    try {
      const response = await fetch("/api/bi/sla/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run: currentRunParam, question, history: assistantHistory.slice(-10) }),
      })
      if (!response.ok) throw new Error(`فشل استدعاء المساعد (HTTP ${response.status})`)
      const json = await response.json()
      const reply =
        typeof json?.reply === "string"
          ? json.reply
          : typeof json?.reply?.reply === "string"
          ? json.reply.reply
          : "تعذر توليد رد تفصيلي من الخدمة."
      setAssistantHistory((prev) => [...prev, { role: "assistant", content: reply, source: json?.reply?.source ?? "llm" }])
    } catch (error) {
      setAssistantHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "تعذر الوصول إلى المساعد الذكي حالياً. يمكنك الاعتماد على الملخصات المعروضة أو المحاولة لاحقاً.",
          source: "system",
        },
      ])
      setAssistantError(error instanceof Error ? error.message : "حدث خطأ أثناء التواصل مع المساعد.")
    } finally {
      setAssistantLoading(false)
    }
  }, [assistantHistory, assistantInput, currentRunParam, slaData])

  const overallScore = slaData?.overall.score_pct ?? null
  const formattedGeneratedAt = formatTimestamp(slaData?.generated_at)

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">لوحة متابعة اتفاقيات مستوى الخدمة (SLA)</h1>
                <p className="text-muted-foreground">نظرة تنفيذية لأداء الامتثال وتوصيات التدخل السريع.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-56">
                  <Select
                    value={selectedRun ?? "run-latest"}
                    onValueChange={(value) => setSelectedRun(value === "run-latest" ? undefined : value)}
                    disabled={runsLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={runsLoading ? "جاري التحميل..." : "اختر تشغيلًا"} />
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
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    تعذر تحميل قائمة التشغيل
                  </CardTitle>
                  <CardDescription className="text-destructive">{runsError}</CardDescription>
                </CardHeader>
              </Card>
            )}

            {slaError && (
              <Card className="border-destructive/40 bg-destructive/10 text-destructive">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    تعذر تحميل مؤشرات الامتثال
                  </CardTitle>
                  <CardDescription className="text-destructive">{slaError}</CardDescription>
                </CardHeader>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-secondary/20 bg-gradient-to-br from-card to-secondary/5 transition hover:shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-sm font-medium">{slaData?.overall.label ?? "معدل الامتثال العام"}</CardTitle>
                    <CardDescription>قياس الالتزام الحالي مقابل المستهدف</CardDescription>
                  </div>
                  {statusPalette[normalizeStatus(slaData?.overall.status)].icon}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl font-bold text-foreground">{overallScore !== null ? `${(overallScore * 100).toFixed(1)}%` : "—"}</div>
                  <Progress value={overallScore != null ? overallScore * 100 : 0} max={100} />
                  {formattedGeneratedAt && <div className="text-xs text-muted-foreground">آخر تحديث: {formattedGeneratedAt}</div>}
                </CardContent>
              </Card>

              <Card className="transition hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">مؤشرات سريعة</CardTitle>
                  <CardDescription>أبرز الأرقام التشغيلية لهذا التشغيل</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div>عدد السجلات: {slaData?.performance.rows ?? "—"}</div>
                  <div>نسبة الموافقات: {slaData?.performance.approve_pct != null ? `${(slaData.performance.approve_pct * 100).toFixed(1)}%` : "—"}</div>
                  <div>نسبة الرفض: {slaData?.performance.reject_pct != null ? `${(slaData.performance.reject_pct * 100).toFixed(1)}%` : "—"}</div>
                  <div>زمن التنفيذ: {slaData?.performance.exec_seconds != null ? `${slaData.performance.exec_seconds.toFixed(1)} ثانية` : "—"}</div>
                </CardContent>
              </Card>

              <Card className="transition hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">ملاحظات رئيسية</CardTitle>
                  <CardDescription>تنبيهات أو توصيات مستخلصة من التشغيل</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  {improvementIdeas.length ? improvementIdeas.map((idea, idx) => <div key={`${idea}-${idx}`}>- {idea}</div>) : <div>لا توجد ملاحظات إضافية.</div>}
                </CardContent>
              </Card>
            </div>

            <Card className="transition hover:shadow-lg">
              <CardHeader>
                <CardTitle>المؤشرات الأساسية</CardTitle>
                <CardDescription>القيم المصدرية من مرحلة 09/10</CardDescription>
              </CardHeader>
              <CardContent>
                {slaLoading ? (
                  <div className="flex min-h-[120px] items-center justify-center text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> جاري التحميل...
                  </div>
                ) : slaData ? (
                  <div className="grid gap-4 md:grid-cols-2">
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
                              العتبات: تحذير={metric.thresholds.warn ?? "—"} | إيقاف={metric.thresholds.stop ?? "—"}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">لا تتوفر بيانات امتثال للتشغيل المحدد.</div>
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
                          <div className="font-semibold text-foreground">{doc.title ?? "وثيقة غير مسماة"}</div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">المعرف: {doc.id ?? "غير متوفر"}</Badge>
                            <Badge variant="secondary">الحالة: {doc.status ?? "غير محدد"}</Badge>
                          </div>
                          <div className="text-xs">
                            الامتثال: {doc.compliance != null ? `${doc.compliance}%` : "—"} | البنود: {doc.terms ?? "—"} (✔ {doc.passed ?? "—"}, ⚠ {doc.warned ?? "—"}, ✖ {doc.failed ?? "—"})
                          </div>
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
                </CardContent>
              </Card>
            </div>

            <Card className="transition hover:shadow-lg">
              <CardHeader>
                <CardTitle>المساعد الذكي للامتثال</CardTitle>
                <CardDescription>يولّد إجابات تنفيذية اعتمادًا على أحدث بيانات SLA</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Textarea
                    placeholder="اطلب ملخصًا أو خطة عمل تتعلق بالامتثال..."
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
                      اطلب مثلاً: "قدّم ملخصًا تنفيذيًا للامتثال وأبرز المخاطر" أو "ما خطة تحسين نسبة التسليم في جدة؟".
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {assistantHistory.map((message, idx) => (
                        <div
                          key={idx}
                          className={`whitespace-pre-wrap rounded-lg border border-border/40 p-3 text-sm ${message.role === "user" ? "bg-card/60 text-foreground" : "bg-secondary/10 text-secondary-foreground"}`}
                        >
                          <span className="block text-xs font-semibold text-muted-foreground">
                            {message.role === "user" ? "أنت" : message.source === "local" ? "المساعد (ملخص محلي)" : message.source === "system" ? "المساعد (تنبيه)" : "المساعد"}
                          </span>
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
