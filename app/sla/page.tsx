"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { HelpTrigger } from "@/components/help/help-trigger"
import { useHelpCenter } from "@/components/help/help-context"
import { useLanguage } from "@/context/language-context"
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

const GATE_REASON_CATEGORY_LABELS: Record<string, string> = {
  missing_insights: "Missing insight metrics",
  missing_kpi_reference: "Missing KPI references",
  sla: "SLA policy",
  status_enum: "Status enumeration",
}

const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  ok: "Active",
  warning: "Warning",
  warn: "Warning",
  critical: "Critical",
  failed: "Critical",
  pending: "Pending review",
  unknown: "Unknown status",
}

const humanizeIdentifier = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const summarizeGateReason = (reason: string, translate: (key: string, replacements?: Record<string, unknown>) => string, joiner: string) => {
  if (!reason) {
    return null
  }
  const [categoryRaw, detailsRaw] = reason.split("::")
  const categoryKey = categoryRaw ? categoryRaw.toLowerCase() : ""
  const categoryLabel = categoryKey && GATE_REASON_CATEGORY_LABELS[categoryKey]
    ? translate(GATE_REASON_CATEGORY_LABELS[categoryKey])
    : humanizeIdentifier(categoryRaw ?? "")

  const detailTokens = detailsRaw
    ? detailsRaw.split(/[,|]/g).map((token) => humanizeIdentifier(token)).filter((token) => token.length > 0)
    : []

  if (!detailTokens.length) {
    return translate("Gate category {category} requires review.", { category: categoryLabel })
  }

  const limitedDetails = detailTokens.slice(0, 5)
  const detailsText = limitedDetails.join(joiner)
  const remaining = detailTokens.length - limitedDetails.length

  return remaining > 0
    ? translate("Gate category {category} flagged: {details} (+{count} more).", {
        category: categoryLabel,
        details: detailsText,
        count: remaining,
      })
    : translate("Gate category {category} flagged: {details}.", { category: categoryLabel, details: detailsText })
}

const extractDocumentTitle = (document: SlaDocument, translate: (key: string) => string) => {
  if (document.title && document.title.trim().length > 0) {
    return document.title.trim()
  }
  if (document.id) {
    const meaningful = document.id.match(/[A-Za-z].+/)
    if (meaningful && meaningful[0]) {
      return meaningful[0].replace(/\s+/g, " ").trim()
    }
    return document.id
  }
  return translate("Untitled document")
}

const formatDocumentStatus = (status: string | null | undefined, translate: (key: string) => string) => {
  if (!status) {
    return translate("Unknown status")
  }
  const normalized = status.toLowerCase().replace(/[^a-z]/g, "")
  const mapped = DOCUMENT_STATUS_LABELS[normalized]
  return mapped ? translate(mapped) : humanizeIdentifier(status)
}

const statusPaletteConfig: Record<
  MetricStatus,
  { labelKey: string; colorClass: string; iconClass: string; Icon: typeof CheckCircle2 }
> = {
  pass: { labelKey: "Within threshold", colorClass: "text-secondary", iconClass: "text-secondary", Icon: CheckCircle2 },
  warn: { labelKey: "Warning threshold", colorClass: "text-amber-500", iconClass: "text-amber-500", Icon: AlertCircle },
  stop: { labelKey: "Stop threshold", colorClass: "text-destructive", iconClass: "text-destructive", Icon: XCircle },
  unknown: { labelKey: "Not specified", colorClass: "text-muted-foreground", iconClass: "text-muted-foreground", Icon: AlertCircle },
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

  const { translate, language } = useLanguage()
  const listJoiner = language === "ar" ? "، " : ", "
  const formattedGateReasons = useMemo(() => {
    if (!slaData?.gate?.reasons?.length) {
      return []
    }
    return slaData.gate.reasons
      .map((reason) => summarizeGateReason(reason, translate, listJoiner))
      .filter((reason): reason is string => Boolean(reason))
  }, [listJoiner, slaData, translate])

  const documentSummarySentences = useMemo(() => {
    if (!slaData?.documents?.length) {
      return []
    }
    return slaData.documents
      .map((document) => {
        const title = extractDocumentTitle(document, translate)
        const compliance = document.compliance != null ? `${Number(document.compliance).toFixed(1)}%` : translate("Awaiting data")
        const warned = document.warned ?? 0
        const failed = document.failed ?? 0
        return translate("Document {title} compliance {score} (warnings {warned}, failed {failed}).", {
          title,
          score: compliance,
          warned,
          failed,
        })
      })
      .filter((sentence) => sentence && sentence.length > 0)
  }, [slaData, translate])
  const { openTopic } = useHelpCenter()
  const assistantSectionRef = useRef<HTMLDivElement | null>(null)
  const statusPalette = useMemo<Record<MetricStatus, { label: string; color: string; icon: JSX.Element }>>(() => {
    const entries = {} as Record<MetricStatus, { label: string; color: string; icon: JSX.Element }>
    (Object.entries(statusPaletteConfig) as Array<[MetricStatus, (typeof statusPaletteConfig)[MetricStatus]]>).forEach(
      ([key, config]) => {
        const IconComponent = config.Icon
        entries[key] = {
          label: translate(config.labelKey),
          color: config.colorClass,
          icon: <IconComponent className={`h-4 w-4 ${config.iconClass}`} />,
        }
      },
    )
    return entries
  }, [translate])

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

  const complianceHighlights = useMemo(() => {
    if (!slaData) return []

    const ruleNotes = (slaData.rule_failures ?? []).map((failure) => {
      const ruleId = failure.rule_id ? humanizeIdentifier(failure.rule_id) : translate("Unnamed rule")
      const details = failure.message && failure.message.length > 0 ? failure.message : translate("No details provided")
      return translate("Rule {rule}: {details}", { rule: ruleId, details })
    })

    const additionalNotes = (slaData.notes ?? []).filter((note): note is string => typeof note === 'string' && note.length > 0)

    return [...ruleNotes, ...additionalNotes].slice(0, 5)
  }, [slaData, translate])

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

  const overviewSummary = useMemo(() => {
    if (!slaData) return null

    const points: string[] = []

    const statusEntry = statusPalette[normalizeStatus(slaData.overall.status)]
    const scoreText = overallScore !== null ? `${(overallScore * 100).toFixed(1)}%` : translate("Awaiting data")
    points.push(
      translate("Overall compliance scored {score} with status {status}.", {
        score: scoreText,
        status: statusEntry.label,
      }),
    )

    if (formattedGateReasons.length) {
      points.push(...formattedGateReasons.slice(0, 2))
      if (formattedGateReasons.length > 2) {
        points.push(
          translate("There are {count} additional gate notes in the detailed section.", {
            count: formattedGateReasons.length - 2,
          }),
        )
      }
    } else {
      points.push(translate("No gate warnings recorded this run."))
    }

    if (documentSummarySentences.length) {
      points.push(...documentSummarySentences.slice(0, 2))
      if (documentSummarySentences.length > 2) {
        points.push(
          translate("{count} additional contract documents were referenced.", {
            count: documentSummarySentences.length - 2,
          }),
        )
      }
    } else {
      points.push(translate("No contract files were attached for this run."))
    }

    return points
  }, [formattedGateReasons, documentSummarySentences, language, overallScore, slaData, statusPalette, translate])

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div>
                    <h1 className="text-3xl font-bold text-foreground">{translate("SLA compliance command center")}</h1>
                    <p className="text-muted-foreground">{translate("Executive overview of contractual adherence and quick intervention guidance.")}</p>
                  </div>
                  <HelpTrigger
                    topicId="sla.overview"
                    aria-label={translate("Explain the SLA dashboard")}
                    variant="link"
                    buildTopic={() => {
                      const runLabel = selectedRun ?? translate("Latest run")
                      const gateStatusLabel =
                        slaData?.gate?.status
                          ? statusPalette[normalizeStatus(slaData.gate.status)].label
                          : translate("Not specified")
                      return {
                        title: translate("SLA compliance overview"),
                        summary: translate(
                          "This dashboard links SLA policy documents with the automated checks from phases 09 and 10.",
                        ),
                        detailItems: [
                          translate("Current run: {runId}", { runId: runLabel }),
                          translate("Overall compliance score: {score}", {
                            score: overallScore !== null ? `${(overallScore * 100).toFixed(1)}%` : translate("Awaiting data"),
                          }),
                          translate("Gate status: {status}", { status: gateStatusLabel }),
                          translate("Last refreshed: {timestamp}", {
                            timestamp: formattedGeneratedAt ?? translate("Awaiting data"),
                          }),
                        ],
                        sources: [
                          {
                            label: translate("SLA Master Agreement"),
                            description: translate(
                              "Primary contractual obligations and penalties that govern the KPIs on this page.",
                            ),
                          },
                          {
                            label: translate("SOP - Logistics Quality v2024"),
                            description: translate(
                              "Defines delivery promises, incident thresholds, and escalation workflow feeding these metrics.",
                            ),
                          },
                        ],
                        suggestedQuestions: [
                          translate("What is driving the current gate status?"),
                          translate("Which contracts deteriorated most in this run?"),
                          translate("What actions should we take before the next cycle?"),
                        ],
                        onAsk: () => {
                          assistantSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                        },
                      }
                    }}
                  >
                    {translate("Explain")}
                  </HelpTrigger>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-56">
                  <Select
                    value={selectedRun ?? "run-latest"}
                    onValueChange={(value) => setSelectedRun(value === "run-latest" ? undefined : value)}
                    disabled={runsLoading}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={runsLoading ? translate("Loading runs...") : translate("Select a run")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="run-latest">{translate("Latest run")}</SelectItem>
                      {runs.map((run) => (
                        <SelectItem key={run.run_id} value={run.run_id}>
                          {run.run_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={() => setRefreshToken((token) => token + 1)} disabled={slaLoading}>
                  <RefreshCw className="mr-2 h-4 w-4" /> {translate("Refresh")}
                </Button>
              </div>
            </div>

            {overviewSummary?.length ? (
              <Card className="border-border/40 bg-card/80 shadow-sm">
                <CardHeader className="space-y-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-sm font-semibold text-foreground">{translate("SLA narrative overview")}</CardTitle>
                      <CardDescription>{translate("Assistant-ready summary linking KPIs to policy documents and gate status.")}</CardDescription>
                    </div>
                    <HelpTrigger
                      topicId="sla.overview"
                      aria-label={translate("Explain the SLA dashboard")}
                      variant="link"
                      buildTopic={() => {
                        const runLabel = selectedRun ?? translate("Latest run")
                        const gateStatusLabel =
                          slaData?.gate?.status
                            ? statusPalette[normalizeStatus(slaData.gate.status)].label
                            : translate("Not specified")
                        return {
                          title: translate("SLA compliance overview"),
                          summary: translate(
                            "This dashboard links SLA policy documents with the automated checks from phases 09 and 10.",
                          ),
                          detailItems: [
                            translate("Current run: {runId}", { runId: runLabel }),
                            translate("Overall compliance score: {score}", {
                              score: overallScore !== null ? `${(overallScore * 100).toFixed(1)}%` : translate("Awaiting data"),
                            }),
                            translate("Gate status: {status}", { status: gateStatusLabel }),
                            translate("Last refreshed: {timestamp}", {
                              timestamp: formattedGeneratedAt ?? translate("Awaiting data"),
                            }),
                          ],
                          sources: [
                            {
                              label: translate("SLA Master Agreement"),
                              description: translate(
                                "Primary contractual obligations and penalties that govern the KPIs on this page.",
                              ),
                            },
                            {
                              label: translate("SOP - Logistics Quality v2024"),
                              description: translate(
                                "Defines delivery promises, incident thresholds, and escalation workflow feeding these metrics.",
                              ),
                            },
                          ],
                          suggestedQuestions: [
                            translate("What is driving the current gate status?"),
                            translate("Which contracts deteriorated most in this run?"),
                            translate("What actions should we take before the next cycle?"),
                          ],
                          onAsk: () => {
                            assistantSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                          },
                        }
                      }}
                    >
                      {translate("Open help center")}
                    </HelpTrigger>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {overviewSummary.map((entry, index) => (
                      <li key={`overview-point-${index}`} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                        <span>{entry}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            {runsError && (
              <Card className="border-destructive/40 bg-destructive/10 text-destructive">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {translate("Unable to load run list")}
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
                    {translate("Unable to load SLA indicators")}
                  </CardTitle>
                  <CardDescription className="text-destructive">{slaError}</CardDescription>
                </CardHeader>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-secondary/20 bg-gradient-to-br from-card to-secondary/5 transition hover:shadow-lg">
                <CardHeader className="space-y-0 pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-sm font-medium">{translate("Overall SLA compliance score")}</CardTitle>
                      <CardDescription>{translate("Aggregated score comparing the current run with contractual targets.")}</CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      {statusPalette[normalizeStatus(slaData?.overall.status)].icon}
                      <HelpTrigger
                        topicId="sla.overall"
                        aria-label={translate("Explain the overall compliance score")}
                        buildTopic={() => {
                          const runLabel = selectedRun ?? translate("Latest run")
                          const overallStatus = statusPalette[normalizeStatus(slaData?.overall.status)]
                          const targetScore =
                            slaData?.overall.score != null ? `${(slaData.overall.score * 100).toFixed(1)}%` : translate("Not specified")
                          return {
                            title: translate("Overall SLA compliance score"),
                            summary: translate(
                              "Weighted combination of SLA metrics covering delivery punctuality, quality gates, and critical escalations.",
                            ),
                            detailItems: [
                              translate("Current run: {runId}", { runId: runLabel }),
                              translate("Recorded score: {score}", {
                                score: overallScore !== null ? `${(overallScore * 100).toFixed(1)}%` : translate("Awaiting data"),
                              }),
                              translate("Status classification: {status}", { status: overallStatus.label }),
                              translate("Target threshold: {target}", { target: targetScore }),
                            ],
                            sources: [
                              {
                                label: translate("SLA Master Agreement"),
                                description: translate(
                                  "Defines the contractual target for the combined SLA compliance score (section 3.2).",
                                ),
                              },
                              {
                                label: translate("SOP - Logistics Quality v2024"),
                                description: translate(
                                  "Explains the weighting between on-time delivery, incident resolution, and escalation metrics.",
                                ),
                              },
                            ],
                            suggestedQuestions: [
                              translate("How is the compliance score calculated for this run?"),
                              translate("Which KPI contributed most to the score change?"),
                              translate("What corrective actions are recommended to lift the score?"),
                            ],
                            onAsk: () => {
                              assistantSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                            },
                          }
                        }}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl font-bold text-foreground">{overallScore !== null ? `${(overallScore * 100).toFixed(1)}%` : "—"}</div>
                  <Progress value={overallScore != null ? overallScore * 100 : 0} max={100} />
                  {formattedGeneratedAt ? (
                    <div className="text-xs text-muted-foreground">
                      {translate("Last refreshed: {timestamp}", { timestamp: formattedGeneratedAt })}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="transition hover:shadow-lg">
                <CardHeader>
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-medium">مؤشرات سريعة</CardTitle>
                    <CardDescription>أبرز الأرقام التشغيلية لهذا التشغيل</CardDescription>
                  </div>
                  <CardAction>
                    <HelpTrigger
                      topicId="sla.performance"
                      aria-label={translate("Explain the performance snapshot")}
                      buildTopic={() => {
                        const rows = slaData?.performance.rows
                        const approvals = slaData?.performance.approve_pct
                        const rejections = slaData?.performance.reject_pct
                        const runtime = slaData?.performance.exec_seconds
                        return {
                          title: translate("Operational performance snapshot"),
                          summary: translate("Quick view of processing volume and outcome ratios for the current run."),
                          detailItems: [
                            translate("Rows processed: {count}", {
                              count: rows != null ? rows.toLocaleString() : translate("Not specified"),
                            }),
                            translate("Approval rate: {value}", {
                              value: approvals != null ? `${(approvals * 100).toFixed(1)}%` : translate("Not specified"),
                            }),
                            translate("Rejection rate: {value}", {
                              value: rejections != null ? `${(rejections * 100).toFixed(1)}%` : translate("Not specified"),
                            }),
                            translate("Execution time: {seconds} seconds", {
                              seconds: runtime != null ? runtime.toFixed(1) : translate("Not specified"),
                            }),
                          ],
                          sources: [
                            {
                              label: translate("ETL monitoring logs"),
                              description: translate("Derived from BI pipeline performance metrics exported with each run."),
                            },
                          ],
                          suggestedQuestions: [
                            translate("Why did the approval rate change compared to the previous run?"),
                            translate("Which inputs are causing the current rejection volume?"),
                          ],
                          onAsk: () => {
                            assistantSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                          },
                        }
                      }}
                    />
                  </CardAction>
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
                  <CardTitle className="text-sm font-medium">{translate("Key compliance notes")}</CardTitle>
                  <CardDescription>{translate("Alerts or recommendations derived from this run.")}</CardDescription>
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {translate("Loading...")}
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
                  <CardTitle>{translate("Contract documents")}</CardTitle>
                  <CardDescription>{translate("SLA artifacts linked to this run")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {slaData?.documents?.length ? (
                    slaData.documents.map((document, index) => {
                      const title = extractDocumentTitle(document, translate)
                      const statusLabel = formatDocumentStatus(document.status, translate)
                      const complianceLine = translate("Compliance {compliance} across {terms} terms (passed {passed}, warnings {warned}, failed {failed}).", {
                        compliance: document.compliance != null ? `${Number(document.compliance).toFixed(1)}%` : translate("Not specified"),
                        terms: document.terms ?? translate("Not specified"),
                        passed: document.passed ?? 0,
                        warned: document.warned ?? 0,
                        failed: document.failed ?? 0,
                      })
                      const identifier = document.id ?? translate("Not specified")
                      const statusTone = document.status?.toLowerCase().includes("fail") || document.status?.toLowerCase().includes("critical")
                        ? "bg-destructive/20 text-destructive border-destructive/30"
                        : document.status?.toLowerCase().includes("warn")
                          ? "bg-amber-500/20 text-amber-600 border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-600 border-emerald-500/30"
                      return (
                        <div key={document.id ?? document.title ?? index} className="rounded-lg border border-border/40 bg-card/40 p-3">
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-semibold text-foreground">{title}</div>
                              <Badge variant="outline" className={statusTone}>{statusLabel}</Badge>
                            </div>
                            <div className="break-all text-xs text-muted-foreground">{translate("Document ID: {id}", { id: identifier })}</div>
                            <div className="text-xs text-muted-foreground">{complianceLine}</div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div>{translate("No contract files were attached for this run.")}</div>
                  )}
                </CardContent>
              </Card>

              <Card className="transition hover:shadow-lg">
                <CardHeader>
                  <CardTitle>{translate("Gate alerts")}</CardTitle>
                  <CardDescription>{translate("Operational reasons preventing full compliance.")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {formattedGateReasons.length ? (
                    formattedGateReasons.map((reason, idx) => (
                      <div key={`${reason}-${idx}`} className="flex items-start gap-2 rounded-lg border border-border/40 bg-card/40 p-3">
                        <AlertCircle className="mt-1 h-4 w-4 text-amber-500" />
                        <span>{reason}</span>
                      </div>
                    ))
                  ) : (
                    <div>{translate("No gate alerts present.")}</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div ref={assistantSectionRef}>
              <Card className="transition hover:shadow-lg">
                <CardHeader>
                  <CardTitle>{translate("Intelligent compliance assistant")}</CardTitle>
                <CardDescription>يولّد إجابات تنفيذية اعتمادًا على أحدث بيانات SLA</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Textarea
                    placeholder={translate("Ask for an executive summary or a remediation plan about compliance...")}
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
                      {translate("Try requesting an executive summary or a plan to improve delivery performance in a specific region.")}
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
          </div>
        </main>
      </div>
    </div>
  )
}

export default SlaPage
