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

interface SlaTermResult {
  kpi: string
  status?: string | null
  actual?: number | null
  target?: number | null
  warn?: number | null
  stop?: number | null
  unit?: string | null
  notes?: string[]
  direction?: string | null
  source?: Record<string, unknown>
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
  sla_results?: SlaTermResult[]
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
  pass: { label: "Ø¶ÙÙ Ø§ÙØ­Ø¯", color: "text-secondary", icon: <CheckCircle2 className="h-4 w-4 text-secondary" /> },
  warn: { label: "ØªØ­Ø°ÙØ±", color: "text-amber-500", icon: <AlertCircle className="h-4 w-4 text-amber-500" /> },
  stop: { label: "Ø¥ÙÙØ§Ù", color: "text-destructive", icon: <XCircle className="h-4 w-4 text-destructive" /> },
  unknown: { label: "ØºÙØ± ÙØªÙÙØ±", color: "text-muted-foreground", icon: <AlertCircle className="h-4 w-4 text-muted-foreground" /> },
}

const normalizeStatus = (status?: string | null): MetricStatus => {
  const value = (status ?? "").toLowerCase()
  if (value === "pass" || value === "warn" || value === "stop") {
    return value
  }
  return "unknown"
}

const formatSlaValue = (value?: number | null, unit?: string | null): string => {
  if (value === null || value === undefined) {
    return "ØºÙØ± ÙØªÙÙØ±"
  }
  if (unit && unit.toLowerCase() in { "%": true, percent: true }) {
    const percentValue = value > 1 ? value : value * 100
    return `${percentValue.toFixed(percentValue >= 100 ? 0 : 2)}%`
  }
  const absValue = Math.abs(value)
  const formatted = absValue >= 100 ? value.toFixed(0) : value.toFixed(2)
  if (!unit) {
    return formatted
  }
  const unitLower = unit.toLowerCase()
  if (unitLower in { hours: true, hour: true, hrs: true, hr: true, h: true }) {
    return `${formatted} Ø³Ø§Ø¹Ø©`
  }
  if (unitLower in { days: true, day: true, d: true }) {
    return `${formatted} ÙÙÙ`
  }
  if (unitLower in { minutes: true, minute: true, mins: true, min: true, m: true }) {
    return `${formatted} Ø¯ÙÙÙØ©`
  }
  return `${formatted} ${unit}`
}

const statusLabels: Record<MetricStatus, string> = {
  pass: "Ø¶ÙÙ Ø§ÙØ­Ø¯ÙØ¯",
  warn: "ØªØ­Ø°ÙØ±",
  stop: "ØªÙÙÙ",
  unknown: "ØºÙØ± ÙØ­Ø¯Ø¯",
}

const metricKeywords: Record<string, string[]> = {
  sla_pct: ["sla", "Ø§ÙØ§ÙØªØ²Ø§Ù", "ÙØ³Ø¨Ø© Ø§ÙØ§ÙØªØ²Ø§Ù", "Ø§ÙØªØ³ÙÙÙ ÙÙ Ø§ÙÙÙØª"],
  rto_pct: ["rto", "Ø¥Ø±Ø¬Ø§Ø¹", "ÙØ±ØªØ¬Ø¹", "Ø¹ÙØ¯Ø© Ø§ÙØ´Ø­ÙØ©"],
  lead_time_p50: ["lead time", "p50", "Ø§ÙØ²ÙÙ Ø§ÙÙØ³ÙØ·", "Ø²ÙÙ Ø§ÙØªÙØµÙÙ"],
  lead_time_p90: ["lead time", "p90", "Ø£Ø¹ÙÙ Ø²ÙÙ", "Ø§ÙÙÙØª Ø§ÙØ·ÙÙÙ"],
  cod_rate: ["cod", "Ø§ÙØ¯ÙØ¹ Ø¹ÙØ¯ Ø§ÙØ§Ø³ØªÙØ§Ù", "ÙØ³Ø¨Ø© Ø§ÙØ¯ÙØ¹ ÙÙØ¯Ø§", "Ø­ØµØ© Ø§ÙØ¯ÙØ¹"],
  cod_total: ["cod", "Ø¥Ø¬ÙØ§ÙÙ Ø§ÙÙØ¨Ø§ÙØº", "ØªØ­ØµÙÙ", "Ø§ÙÙÙÙØ© Ø§ÙÙÙØ¯ÙØ©"],
}

const normalizeQuestion = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9ء-ي]+/gu, " ")
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
      return `${value.toFixed(1)} Ø³Ø§Ø¹Ø©`
    case "currency":
      return `${value.toFixed(2)} Ø±.Ø³`
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
  const thresholdParts = [warn ? `ØªØ­Ø°ÙØ±: ${warn}` : null, stop ? `ØªÙÙÙ: ${stop}` : null].filter(Boolean).join(" | ")
  return `${label}: ${formatted} (Ø§ÙØ­Ø§ÙØ©: ${status})${thresholdParts ? ` - ${thresholdParts}` : ""}`
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
      lines.push(`ØªØ´ØºÙÙ: ${payload.run}`)
    }
    if (payload.generated_at) {
      lines.push(`Ø¢Ø®Ø± ØªØ­Ø¯ÙØ«: ${payload.generated_at}`)
    }
    const overallScore = payload.overall?.score_pct
    if (overallScore !== null && overallScore !== undefined) {
      const status = statusLabels[normalizeStatus(payload.overall.status)] ?? statusLabels.unknown
      lines.push(`Ø§ÙØ§ÙØªØ«Ø§Ù Ø§ÙØ¹Ø§Ù: ${overallScore.toFixed(2)}% (Ø§ÙØ­Ø§ÙØ©: ${status})`)
    }
    lines.push("ØªÙØ§ØµÙÙ Ø§ÙÙØ¤Ø´Ø±Ø§Øª:")
    matchedMetrics.forEach((metric) => lines.push(`- ${describeMetric(metric)}`))
    return lines.join("
")
  }

  const gateReasons = payload.gate?.reasons ?? []
  if (gateReasons.length > 0 && ["Ø³Ø¨Ø¨", "Ø£Ø³Ø¨Ø§Ø¨", "gate", "Ø¥ÙÙØ§Ù", "Ø±ÙØ¶"].some((keyword) => questionMentions(normalizedQuestion, keyword))) {
    const status = statusLabels[normalizeStatus(payload.gate?.status)] ?? statusLabels.unknown
    const reasonLines = gateReasons.map((reason) => `- ${reason}`).join("
")
    return `Ø§ÙØ­Ø§ÙØ© Ø§ÙØ­Ø§ÙÙØ© ÙÙØ¨ÙØ§Ø¨Ø©: ${status}
Ø§ÙØ£Ø³Ø¨Ø§Ø¨ Ø§ÙÙØ³Ø¬ÙØ©:
${reasonLines}`
  }

  const documents = payload.documents ?? []
  if (
    documents.length > 0 &&
    ["Ø¹ÙØ¯", "ÙØ«ÙÙØ©", "documents", "Ø§ØªÙØ§Ù", "agreement"].some((keyword) => questionMentions(normalizedQuestion, keyword))
  ) {
    const lines = ["Ø­Ø§ÙØ© ÙØ«Ø§Ø¦Ù SLA:"]
    documents.forEach((doc) => {
      const title = doc.title ?? doc.id ?? "ÙØ«ÙÙØ©"
      const status = doc.status ?? "ØºÙØ± ÙØ­Ø¯Ø¯"
      const compliance = doc.compliance != null ? `${doc.compliance}%` : "ØºÙØ± ÙØªÙÙØ±"
      lines.push(`- ${title}: Ø§ÙØ­Ø§ÙØ© ${status} | Ø§ÙØ§ÙØªØ²Ø§Ù ${compliance}`)
    })
    return lines.join("
")
  }

  if (["ØªØ­Ø³ÙÙ", "recommend", "Ø§ÙØªØ±Ø§Ø­", "Ø­Ù"].some((keyword) => questionMentions(normalizedQuestion, keyword))) {
    const suggestions = improvementIdeasFromSla(payload)
    if (suggestions.length) {
      return ["ÙÙØªØ±Ø­Ø§Øª ØªØ­Ø³ÙÙ:", ...suggestions.slice(0, 5).map((idea) => `- ${idea}`)].join("
")
    }
  }

  if (sop?.expectations?.length) {
    const expectationKeywords = ["sop", "ÙØ¯Ù", "Ø§ÙØ¯Ø§Ù", "Ø£ÙØ¯Ø§Ù", "target", "policy", "Ø³ÙØ§Ø³Ø©"]
    if (expectationKeywords.some((keyword) => questionMentions(normalizedQuestion, keyword))) {
      const lines = ["Ø§ÙØ£ÙØ¯Ø§Ù Ø§ÙÙØ³ØªØ®ÙØµØ© ÙÙ ÙØ³ØªÙØ¯Ø§Øª SOP:"]
      sop.expectations.slice(0, 6).forEach((expectation) => {
        const valueText =
          expectation.target_value != null
            ? `${expectation.target_value}${expectation.target_unit ? ` ${expectation.target_unit}` : ""}`
            : "ØºÙØ± ÙØ­Ø¯Ø¯"
        lines.push(
          `- ${expectation.metric_label ?? expectation.metric_id}: Ø§ÙÙØ¯Ù ${valueText}${
            expectation.timeframe ? ` (${expectation.timeframe})` : ""
          }${expectation.condition ? ` â Ø´Ø±Ø·: ${expectation.condition}` : ""}`,
        )
      })
      return lines.join("
")
    }
  }

  if (gap?.analysis?.analysis?.length) {
    const gapKeywords = ["ÙØ¬ÙØ©", "gap", "ØªØ­ÙÙÙ", "ÙØ±Ù", "Ø§ÙØ­Ø±Ø§Ù"]
    if (gapKeywords.some((keyword) => questionMentions(normalizedQuestion, keyword))) {
      const lines = ["ØªØ­ÙÙÙ Ø§ÙÙØ¬ÙØ§Øª ÙÙØ§Ø¨Ù Ø£ÙØ¯Ø§Ù SOP:"]
      gap.analysis.analysis.slice(0, 6).forEach((item) => {
        const actualValue = item.actual_value != null ? Number(item.actual_value) : null
        const actual =
          actualValue != null && Number.isFinite(actualValue) ? actualValue.toFixed(3) : "ØºÙØ± ÙØªÙÙØ±"
        const targetValue = item.target_value != null ? Number(item.target_value) : null
        const target =
          targetValue != null && Number.isFinite(targetValue)
            ? targetValue.toFixed(3) + (item.target_unit ? ` ${item.target_unit}` : "")
            : "ØºÙØ± ÙØ­Ø¯Ø¯"
        const deltaValue = item.delta != null ? Number(item.delta) : null
        const delta =
          deltaValue != null && Number.isFinite(deltaValue)
            ? `${deltaValue >= 0 ? "+" : ""}${deltaValue.toFixed(3)}`
            : "ØºÙØ± ÙØ­Ø³ÙØ¨"
        lines.push(
          `- ${item.metric_label ?? item.metric_id}: Ø§ÙØ­Ø§ÙÙ ${actual} | Ø§ÙÙØ¯Ù ${target} | Ø§ÙÙØ§Ø±Ù ${delta}`,
        )
      })
      return lines.join("
")
    }

    const recommendationKeywords = ["Ø®Ø·Ø©", "Ø¥Ø¬Ø±Ø§Ø¡", "recommend", "ÙÙØªØ±Ø­", "action"]
    if (recommendationKeywords.some((keyword) => questionMentions(normalizedQuestion, keyword))) {
      const recs = gap.recommendations ?? []
      if (recs.length) {
        const lines = ["Ø§ÙØªÙØµÙØ§Øª Ø§ÙÙÙØªØ±Ø­Ø©:"]
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
        return lines.join("
")
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
      ideas.add(`Ø¶Ø¨Ø· ÙØ³Ø§Ø± ÙØ¤Ø´Ø± ${metric.label}: Ø£Ø¨ÙØº ÙØ±ÙÙ Ø§ÙØ¹ÙÙÙØ§Øª Ø¨Ø®Ø·Ø© ØªØµØ­ÙØ­ Ø®ÙØ§Ù 24 Ø³Ø§Ø¹Ø© ÙØ¨Ù ØªØ¬Ø§ÙØ² Ø§ÙØ­Ø¯.`)
    }
    if (metric.status === "stop") {
      ideas.add(`ÙØ¤Ø´Ø± ${metric.label} ÙØªØ¬Ø§ÙØ² ÙÙØ­Ø¯ Ø§ÙØ­Ø±Ø¬Ø ÙØªØ·ÙØ¨ Ø¬ÙØ³Ø© Ø·ÙØ§Ø±Ø¦ ÙØ¹ Ø§ÙÙØ§ÙÙ Ø§ÙØªÙÙÙØ°Ù ÙØªØ­Ø¯ÙØ¯ ÙØ³Ø§Ø± Ø§Ø³ØªØ¹Ø§Ø¯Ø©.`)
    }
  })
  ;(data.gate?.reasons ?? []).forEach((reason) =>
    ideas.add(`Ø³Ø¨Ø¨ Ø¨ÙØ§Ø¨Ø© Ø§ÙØ§Ø¹ØªÙØ§Ø¯: ${reason}. Ø¹ÙÙÙ ÙØ³Ø¤ÙÙ ÙØªØ§Ø¨Ø¹Ø© ÙØ­Ø¯Ø¯ ØªØ§Ø±ÙØ® Ø¥ØºÙØ§Ù ÙÙØ«Ù.`),
  )
  data.rule_failures.forEach((rule) => {
    if (rule.rule_id) {
      ideas.add(`Ø±Ø§Ø¬Ø¹ ÙØ§Ø¹Ø¯Ø© ${rule.rule_id} (${rule.level}) ÙØ£Ø¹Ø¯ Ø¶Ø¨Ø· Ø§ÙØ¶ÙØ§Ø¨Ø· ÙØ¶ÙØ§Ù Ø¹Ø¯Ù ØªÙØ±Ø§Ø± Ø§ÙØ³Ø¨Ø¨: ${rule.message}.`)
    }
  })
  if (!ideas.size) {
    ideas.add("ÙØ§ ØªÙØ¬Ø¯ Ø¥ÙØ°Ø§Ø±Ø§Øª Ø­Ø§ÙÙØ©. Ø§Ø³ØªÙØ± ÙÙ ÙØ±Ø§ÙØ¨Ø© Ø§ÙØ£Ø¯Ø§Ø¡ ÙØ­Ø§ÙØ¸ Ø¹ÙÙ Ø¬ÙØ³Ø© ÙØªØ§Ø¨Ø¹Ø© Ø£Ø³Ø¨ÙØ¹ÙØ© ÙÙÙØ³ØªÙØ¯ÙØ§Øª.")
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

  const slaTerms = slaData?.sla_results ?? []
  const quickSuggestions = useMemo(() => {
    const suggestions = new Set<string>()
    suggestions.add("ÙØ¯Ù ÙÙØ®ØµÙØ§ ØªÙÙÙØ°ÙÙØ§ ÙÙØ³Ø¨Ø© Ø§ÙØ§ÙØªØ«Ø§Ù Ø§ÙØ­Ø§ÙÙØ©.")
    suggestions.add("ÙØ§ Ø§ÙØ¥Ø¬Ø±Ø§Ø¡Ø§Øª Ø§ÙØªØµØ­ÙØ­ÙØ© Ø°Ø§Øª Ø§ÙØ£ÙÙÙÙØ© Ø§ÙÙØµÙÙØ")

    if (slaData?.metrics.some((metric) => metric.status === "warn" || metric.status === "stop")) {
      suggestions.add("ÙØ³Ø± Ø£Ø³Ø¨Ø§Ø¨ Ø§ÙØªØ­Ø°ÙØ±Ø§Øª Ø§ÙØ­Ø§ÙÙØ© ÙÙÙÙÙØ© Ø¥ØºÙØ§ÙÙØ§.")
    }
    if (slaData?.gate?.reasons?.length) {
      suggestions.add("ÙØ§ Ø§ÙØ¹ÙØ§Ø¦Ù Ø§ÙØ±Ø¦ÙØ³ÙØ© ÙÙ Ø¨ÙØ§Ø¨Ø© Ø§ÙØ§Ø¹ØªÙØ§Ø¯ ÙÙÙÙ ÙØ¹Ø§ÙØ¬ÙØ§Ø")
    }
    if (slaData?.documents?.length) {
      suggestions.add("ÙØ§ Ø­Ø§ÙØ© ÙØ«Ø§Ø¦Ù SLA Ø§ÙØ±Ø³ÙÙØ© ÙØ£ÙÙ Ø¨ÙÙØ¯ÙØ§Ø")
    }
    if (sopData?.expectations?.length) {
      suggestions.add("ÙØ§ Ø§ÙØ£ÙØ¯Ø§Ù Ø§ÙÙÙÙØ© Ø§ÙÙØ³ØªØ®Ø±Ø¬Ø© ÙÙ ÙØ«Ø§Ø¦Ù SOPØ")
    }
    if (gapData?.analysis?.analysis?.some((item) => (item.delta ?? 0) < 0)) {
      suggestions.add("Ø­Ø¯Ø¯ Ø£ÙØ¨Ø± ÙØ¬ÙØ§Øª Ø§ÙØ£Ø¯Ø§Ø¡ ÙÙØ§Ø±ÙØ© Ø¨Ø§ÙÙØ³ØªÙØ¯Ù.")
    }
    if (gapData?.recommendations?.length) {
      suggestions.add("ÙØ®ÙØµ Ø®Ø·Ø© Ø§ÙØ¹ÙÙ Ø§ÙÙÙØªØ±Ø­Ø© ÙØ¥ØºÙØ§Ù Ø§ÙÙØ¬ÙØ§Øª.")
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
        setRunsError(error instanceof Error ? error.message : "ØªØ¹Ø°Ø± ØªØ­ÙÙÙ ÙØ§Ø¦ÙØ© Ø§ÙØªØ´ØºÙÙ")
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
          throw new Error(`ÙØ´Ù Ø¬ÙØ¨ Ø¨ÙØ§ÙØ§Øª SLA (status ${response.status})`)
        }
        const json: SlaPayload = await response.json()
        setSlaData(json)
      } catch (error) {
        if (controller.signal.aborted) return
        setSlaError(error instanceof Error ? error.message : "ØªØ¹Ø°Ø± ØªØ­ÙÙÙ ÙØ¤Ø´Ø±Ø§Øª Ø§ÙØ§ÙØªØ«Ø§Ù")
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
          throw new Error(`ÙØ´Ù ØªØ­ÙÙÙ ÙÙÙØ§Øª SOP (status ${response.status})`)
        }
        const json: SlaSopResponse = await response.json()
        setSopData(json)
      } catch (error) {
        if (controller.signal.aborted) return
        setSopError(error instanceof Error ? error.message : "ØªØ¹Ø°Ø± ØªØ­ÙÙÙ ÙØ³ØªÙØ¯Ø§Øª SOP")
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
          throw new Error(`ÙØ´Ù ØªØ­ÙÙÙ Ø§ÙÙØ¬ÙØ§Øª (status ${response.status})`)
        }
        const json: SlaGapResponse = await response.json()
        setGapData(json)
      } catch (error) {
        if (controller.signal.aborted) return
        setGapError(error instanceof Error ? error.message : "ØªØ¹Ø°Ø± Ø­Ø³Ø§Ø¨ ÙØ¬ÙØ§Øª SLA")
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
        throw new Error(`ÙØ´Ù Ø·ÙØ¨ Ø§ÙÙØ³Ø§Ø¹Ø¯ (status ${response.status})`)
      }
      const data = await response.json()
      const reply =
        typeof data.reply === "string" ? data.reply : data.reply?.reply ?? JSON.stringify(data.reply, null, 2)
      const source: ChatMessage["source"] =
        data?.context?.mode === "local" || data?.provider === "local-rules" ? "local" : "llm"
      setAssistantHistory((prev) => [...prev, { role: "assistant", content: reply, source }])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ø­Ø¯Ø« Ø®Ø·Ø£ Ø£Ø«ÙØ§Ø¡ Ø§ÙØªÙØ§ØµÙ ÙØ¹ Ø§ÙÙØ³Ø§Ø¹Ø¯."
      setAssistantError(message)
      setAssistantHistory((prev) => [
        ...prev,
        { role: "assistant", content: `ØªØ¹Ø°Ø± Ø§ÙØ­ØµÙÙ Ø¹ÙÙ Ø±Ø¯: ${message}`, source: "system" },
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
                <h1 className="text-3xl font-bold text-foreground">ÙÙØ­Ø© ÙØªØ§Ø¨Ø¹Ø© Ø§ØªÙØ§ÙÙØ§Øª ÙØ³ØªÙÙ Ø§ÙØ®Ø¯ÙØ© (SLA)</h1>
                <p className="text-muted-foreground">
                  ÙØ¸Ø±Ø© ØªÙÙÙØ°ÙØ© ØªØ±Ø¨Ø· Ø§ÙØ£Ø¯Ø§Ø¡ Ø§ÙØªØ´ØºÙÙÙ Ø¨Ø§ÙØ§ÙØªØ²Ø§ÙØ§Øª Ø§ÙØªØ¹Ø§ÙØ¯ÙØ© ÙØªØ¹Ø±Ø¶ Ø£ÙÙ ÙØ­ØªØ§Ø¬ Ø¥ÙÙ ØªØ¯Ø®Ù Ø³Ø±ÙØ¹.
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
                      <SelectValue placeholder={runsLoading ? 'Ø¬Ø§Ø±Ù Ø§ÙØªØ­ÙÙÙ...' : 'Ø§Ø®ØªØ± ØªØ´ØºÙÙÙØ§'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="run-latest">Ø£Ø­Ø¯Ø« ØªØ´ØºÙÙ</SelectItem>
                      {runs.map((run) => (
                        <SelectItem key={run.run_id} value={run.run_id}>
                          {run.run_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={() => setRefreshToken((token) => token + 1)} disabled={slaLoading}>
                  <RefreshCw className="mr-2 h-4 w-4" /> ØªØ­Ø¯ÙØ«
                </Button>
              </div>
            </div>

            {runsError && (
              <Card className="border-destructive/40 bg-destructive/10 text-destructive">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> ØªØ¹Ø°Ø± ØªØ­ÙÙÙ ÙØ§Ø¦ÙØ© Ø§ÙØªØ´ØºÙÙ</CardTitle>
                  <CardDescription className="text-destructive">{runsError}</CardDescription>
                </CardHeader>
              </Card>
            )}

            {slaError && (
              <Card className="border-destructive/40 bg-destructive/10 text-destructive">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> ØªØ¹Ø°Ø± ØªØ­ÙÙÙ ÙØ¤Ø´Ø±Ø§Øª Ø§ÙØ§ÙØªØ«Ø§Ù</CardTitle>
                  <CardDescription className="text-destructive">{slaError}</CardDescription>
                </CardHeader>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-secondary/20 bg-gradient-to-br from-card to-secondary/5 transition hover:shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-sm font-medium">{slaData?.overall.label ?? "ÙØ¹Ø¯Ù Ø§ÙØ§ÙØªØ«Ø§Ù Ø§ÙØ¹Ø§Ù"}</CardTitle>
                    <CardDescription>ÙØ¯Ù Ø§ÙØªØ²Ø§Ù Ø§ÙØ´Ø¨ÙØ© Ø¨Ø§ÙÙØ³ØªÙØ¯Ù Ø§ÙØ²ÙÙÙ Ø§ÙØ­Ø§ÙÙ</CardDescription>
                  </div>
                  {statusPalette[normalizeStatus(slaData?.overall.status)].icon}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl font-bold text-foreground">{overallScore !== null ? `${overallScore.toFixed(1)}%` : 'â'}</div>
                  <Progress value={overallScore ?? 0} max={100} />
                  <div className="text-xs text-muted-foreground">Ø­Ø§ÙØ© Ø¨ÙØ§Ø¨Ø© Ø§ÙØ§Ø¹ØªÙØ§Ø¯: {slaData?.gate.status ?? "ØºÙØ± ÙØ­Ø¯Ø¯Ø©"}</div>
                  {formattedGeneratedAt && <div className="text-xs text-muted-foreground">Ø¢Ø®Ø± ØªØ­Ø¯ÙØ« ÙÙÙÙØ§Ø³: {formattedGeneratedAt}</div>}
                </CardContent>
              </Card>
              <Card className="transition hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">ÙØ¤Ø´Ø±Ø§Øª Ø³Ø±ÙØ¹Ø©</CardTitle>
                  <CardDescription>Ø£Ø¨Ø±Ø² Ø§ÙÙØ¹Ø·ÙØ§Øª Ø§ÙØªØ´ØºÙÙÙØ© ÙÙØ°Ø§ Ø§ÙØªØ´ØºÙÙ</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div>Ø¹Ø¯Ø¯ Ø§ÙØ³Ø¬ÙØ§Øª: {slaData?.performance.rows ?? 'â'}</div>
                  <div>ÙØ³Ø¨Ø© Ø§ÙÙÙØ§ÙÙØ§Øª: {slaData?.performance.approve_pct != null ? `${(slaData.performance.approve_pct * 100).toFixed(1)}%` : 'â'}</div>
                  <div>ÙØ³Ø¨Ø© Ø§ÙØ±ÙØ¶: {slaData?.performance.reject_pct != null ? `${(slaData.performance.reject_pct * 100).toFixed(1)}%` : 'â'}</div>
                  <div>Ø²ÙÙ Ø§ÙØªÙÙÙØ°: {slaData?.performance.exec_seconds != null ? `${slaData.performance.exec_seconds.toFixed(1)} Ø«Ø§ÙÙØ©` : 'â'}</div>
                </CardContent>
              </Card>
              <Card className="transition hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Ø£ÙÙÙÙØ§Øª Ø§ÙØªØ¯Ø®Ù</CardTitle>
                  <CardDescription>ØªÙØµÙØ§Øª Ø¹ÙÙÙØ© Ø§Ø³ØªÙØ§Ø¯ÙØ§ Ø¥ÙÙ ÙØ¶Ø¹ Ø§ÙÙØ¤Ø´Ø±Ø§Øª Ø§ÙØ­Ø§ÙÙ</CardDescription>
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
                  <CardTitle>Ø§ÙÙØ¤Ø´Ø±Ø§Øª Ø§ÙØ£Ø³Ø§Ø³ÙØ©</CardTitle>
                  <CardDescription>Ø§ÙÙÙÙ Ø§ÙÙØµØ¯Ø±ÙØ© ÙÙ ÙØ±Ø­ÙØ© 09/10</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {slaLoading ? (
                  <div className="flex min-h-[120px] items-center justify-center text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ø¬Ø§Ø± Ø§ÙØªØ­ÙÙÙ...
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
                              Ø§ÙØ¹ØªØ¨Ø§Øª: ØªØ­Ø°ÙØ±={metric.thresholds.warn ?? 'â'} | Ø¥ÙÙØ§Ù={metric.thresholds.stop ?? 'â'}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">ÙØ§ ØªØªÙÙØ± Ø¨ÙØ§ÙØ§Øª Ø§ÙØªØ«Ø§Ù.</div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <Card className="transition hover:shadow-lg">
                <CardHeader>
                  <CardTitle>Ø§ÙÙÙÙØ§Øª Ø§ÙØªØ¹Ø§ÙØ¯ÙØ©</CardTitle>
                  <CardDescription>Ø¹ÙØ§ØµØ± SLA Ø§ÙÙØ±ØªØ¨Ø·Ø© Ø¨Ø§ÙØªØ´ØºÙÙ Ø§ÙØ­Ø§ÙÙ</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {slaData?.documents?.length ? (
                    slaData.documents.map((doc) => (
                      <div key={doc.id ?? doc.title ?? Math.random()} className="rounded-lg border border-border/40 bg-card/40 p-3">
                        <div className="flex flex-col gap-1">
                          <div className="font-semibold text-foreground">{doc.title ?? 'ÙØ«ÙÙØ© ØºÙØ± ÙØ³ÙØ§Ø©'}</div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">Ø§ÙÙØ¹Ø±Ù: {doc.id ?? 'ØºÙØ± ÙØªÙÙØ±'}</Badge>
                            <Badge variant="secondary">Ø§ÙØ­Ø§ÙØ©: {doc.status ?? 'ØºÙØ± ÙØ­Ø¯Ø¯'}</Badge>
                          </div>
                          <div className="text-xs">Ø§ÙØ§ÙØªØ«Ø§Ù: {doc.compliance != null ? `${doc.compliance}%` : 'â'} | Ø§ÙØ¨ÙÙØ¯: {doc.terms ?? 'â'} (â {doc.passed ?? 'â'}, â  {doc.warned ?? 'â'}, â {doc.failed ?? 'â'})</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div>ÙØ§ ØªÙØ¬Ø¯ ÙØ«Ø§Ø¦Ù ÙØ±ØªØ¨Ø·Ø© ÙÙ ÙØ°Ø§ Ø§ÙØªØ´ØºÙÙ.</div>
                  )}
                </CardContent>
              </Card>

              <Card className="transition hover:shadow-lg">
                <CardHeader>
                  <CardTitle>Ø¥ÙØ°Ø§Ø±Ø§Øª Ø§ÙØ§Ø¹ØªÙØ§Ø¯</CardTitle>
                  <CardDescription>Ø§ÙØ£Ø³Ø¨Ø§Ø¨ Ø§ÙØªØ´ØºÙÙÙØ© Ø§ÙØªÙ ÙÙØ¹Øª Ø§ÙØ§ÙØªØ«Ø§Ù Ø§ÙÙØ§ÙÙ</CardDescription>
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
                    <div>ÙØ§ ØªÙØ¬Ø¯ Ø¥ÙØ°Ø§Ø±Ø§Øª.</div>
                  )}

                  {slaData?.rule_failures?.length ? (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-foreground">Ø§ÙÙÙØ§Ø¹Ø¯ Ø§ÙÙØ®Ø§ÙÙØ©</div>
                      {slaData.rule_failures.map((rule, idx) => (
                        <div key={`${rule.rule_id}-${idx}`} className="rounded-lg border border-border/40 bg-card/40 p-3">
                          <div className="font-semibold text-foreground">{rule.rule_id ?? 'Rule'}</div>
                          <div className="text-xs">Ø§ÙÙØ³ØªÙÙ: {rule.level ?? 'ØºÙØ± ÙØ­Ø¯Ø¯'} | Ø§ÙØ¹Ø¯Ø¯: {rule.count ?? 'â'}</div>
                          <div className="mt-1 text-xs">{rule.message ?? 'ÙØ§ ÙÙØ¬Ø¯ ÙØµÙ Ø¥Ø¶Ø§ÙÙ.'}</div>
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
                  <CardTitle>ÙØ¹Ø§ÙÙØ± SOP Ø§ÙÙØ¹ØªÙØ¯Ø©</CardTitle>
                  <CardDescription>Ø§ÙÙØ³ØªÙØ¯ÙØ§Øª Ø§ÙØ±Ø³ÙÙØ© Ø§ÙÙÙØªØ¨Ø³Ø© ÙÙ Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª Ø§ÙØªØ´ØºÙÙ</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {sopLoading ? (
                    <div className="flex min-h-[120px] items-center justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ø¬Ø§Ø± ØªØ­ÙÙÙ ÙÙÙØ§Øª SOP...
                    </div>
                  ) : sopError ? (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive">
                      {sopError}
                    </div>
                  ) : sopData ? (
                    <div className="space-y-3">
                      <div className="text-sm">
                        ØªÙ Ø§Ø³ØªØ®Ø±Ø§Ø¬ {sopData.expectations.length} ÙØ¯ÙÙØ§ ÙÙ {sopData.documents.length} ÙØ³ØªÙØ¯.
                      </div>
                      {sopData.documents.length ? (
                        <div className="space-y-2">
                          {sopData.documents.slice(0, 5).map((doc, idx) => (
                            <div key={`${doc.source ?? idx}`} className="rounded-lg border border-border/40 bg-card/40 p-3">
                              <div className="font-semibold text-foreground">{doc.title ?? doc.source ?? "ÙØ³ØªÙØ¯ Ø¨Ø¯ÙÙ Ø¹ÙÙØ§Ù"}</div>
                              <div className="text-xs text-muted-foreground">{doc.source ?? "ÙØ³Ø§Ø± ØºÙØ± ÙØªÙÙØ±"}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div>ÙÙ ÙØ¬Ø±Ù ØªØ­ÙÙÙ ÙÙÙØ§Øª ÙØ±Ø¬Ø¹ÙØ© ÙÙØ°Ø§ Ø§ÙØªØ´ØºÙÙ Ø¨Ø¹Ø¯.</div>
                      )}
                      {sopData.expectations.length ? (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-foreground">Ø£Ø¨Ø±Ø² Ø§ÙØ£ÙØ¯Ø§Ù Ø§ÙÙÙÙØ©</div>
                          {sopData.expectations.slice(0, 5).map((expectation) => (
                            <div key={expectation.metric_id} className="rounded-lg border border-border/30 bg-card/30 p-3">
                              <div className="font-semibold text-foreground">
                                {expectation.metric_label ?? expectation.metric_id}
                              </div>
                              <div className="text-xs">
                                Ø§ÙÙØ¯Ù:{" "}
                                {expectation.target_value != null
                                  ? `${expectation.target_value}${expectation.target_unit ? ` ${expectation.target_unit}` : ""}`
                                  : "ØºÙØ± ÙØ­Ø¯Ø¯"}
                                {expectation.timeframe ? ` | Ø§ÙØ¥Ø·Ø§Ø± Ø§ÙØ²ÙÙÙ: ${expectation.timeframe}` : ""}
                              </div>
                              {expectation.condition && <div className="text-xs">Ø§ÙØ´Ø±Ø·: {expectation.condition}</div>}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {(sopData.provider || sopData.model) && (
                        <div className="text-xs text-muted-foreground">
                          ÙØ³ØªØ®Ø±Ø¬ Ø¨ÙØ§Ø³Ø·Ø©: {sopData.provider ?? "â"} Â· Ø§ÙÙÙÙØ°Ø¬: {sopData.model ?? "â"}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>ÙÙ ÙØªÙ Ø§ÙØ¹Ø«ÙØ± Ø¹ÙÙ ÙÙÙØ§Øª SOP ÙÙØ°Ø§ Ø§ÙØªØ´ØºÙÙ.</div>
                  )}
                </CardContent>
              </Card>

              <Card className="transition hover:shadow-lg">
                <CardHeader>
                  <CardTitle>Ø§ÙÙØ¬ÙØ§Øª ÙÙØ§Ø¨Ù Ø§ÙÙØ³ØªÙØ¯ÙØ§Øª</CardTitle>
                  <CardDescription>ØªØ­ÙÙÙ Ø§ÙÙØ±ÙÙ Ø¨ÙÙ Ø§ÙØ£Ø¯Ø§Ø¡ Ø§ÙÙØ¹ÙÙ ÙÙØªØ·ÙØ¨Ø§Øª SOP</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {gapLoading ? (
                    <div className="flex min-h-[120px] items-center justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ø¬Ø§Ø± Ø­Ø³Ø§Ø¨ Ø§ÙÙØ¬ÙØ§Øª...
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
                              <Badge variant="outline">{item.status ?? "ØºÙØ± ÙØ­Ø¯Ø¯"}</Badge>
                            </div>
                            <div className="text-xs">
                              Ø§ÙØ£Ø¯Ø§Ø¡ Ø§ÙØ­Ø§ÙÙ:{" "}
                              {actualValue != null && Number.isFinite(actualValue) ? actualValue.toFixed(3) : "â"} | Ø§ÙÙØ¯Ù:{" "}
                              {targetValue != null && Number.isFinite(targetValue)
                                ? targetValue.toFixed(3) + (item.target_unit ? ` ${item.target_unit}` : "")
                                : "ØºÙØ± ÙØ­Ø¯Ø¯"}
                            </div>
                            <div className="text-xs">
                              Ø§ÙÙØ§Ø±Ù Ø¹Ù Ø§ÙÙØ³ØªÙØ¯Ù:{" "}
                              {deltaValue != null && Number.isFinite(deltaValue)
                                ? `${deltaValue >= 0 ? "+" : ""}${deltaValue.toFixed(3)}`
                                : "ØºÙØ± ÙØ­Ø³ÙØ¨"}
                            </div>
                            {item.condition && <div className="text-xs">Ø§ÙØ´Ø±Ø·: {item.condition}</div>}
                            {item.rationale && <div className="text-xs">Ø§ÙÙØ¨Ø±Ø±: {item.rationale}</div>}
                          </div>
                        )
                      })}
                      {gapData.recommendations?.length ? (
                        <div className="space-y-1 text-xs">
                          <div className="font-semibold text-foreground">Ø®Ø·Ø© Ø§ÙØ¹ÙÙ Ø§ÙÙÙØªØ±Ø­Ø©</div>
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
                    <div>ÙØ§ ØªÙØ¬Ø¯ Ø¨ÙØ§ÙØ§Øª ÙØ¬ÙØ© ÙØªØ§Ø­Ø©.</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="transition hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>ÙØ³Ø§Ø¹Ø¯ Ø§ÙØ§ÙØªØ«Ø§Ù</CardTitle>
                  <CardDescription>ÙÙÙÙØ¯ Ø¥Ø¬Ø§Ø¨Ø§Øª ØªÙÙÙØ°ÙØ© Ø§Ø¹ØªÙØ§Ø¯ÙØ§ Ø¹ÙÙ Ø£Ø­Ø¯Ø« Ø¨ÙØ§ÙØ§Øª SLA ÙØ§ÙÙ SOP</CardDescription>
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
                    placeholder="Ø§Ø·ÙØ¨ ØªÙØ®ÙØµÙØ§ Ø£Ù Ø®Ø·Ø© Ø¹ÙÙ ØªØªØ¹ÙÙ Ø¨Ø§ÙØ§ÙØªØ«Ø§Ù..."
                    value={assistantInput}
                    onChange={(event) => setAssistantInput(event.target.value)}
                    rows={4}
                  />
                  <div className="flex items-center gap-2">
                    <Button onClick={handleAskAssistant} disabled={assistantLoading || !assistantInput.trim()}>
                      {assistantLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                      Ø¥Ø±Ø³Ø§Ù
                    </Button>
                    {assistantError && <span className="text-sm text-destructive">{assistantError}</span>}
                  </div>
                </div>
                <div className="space-y-2">
                  {assistantHistory.length === 0 ? (
                    <div className="rounded-lg border border-border/40 bg-muted/30 p-3 text-sm text-muted-foreground">
                      Ø§Ø·ÙØ¨ ÙØ«ÙØ§Ù: "ÙØ¯Ù ÙÙØ®ØµÙØ§ ØªÙÙÙØ°ÙÙØ§ ÙÙØ§ÙØªØ«Ø§Ù ÙØ£Ø¨Ø±Ø² ÙØ®Ø§Ø·Ø± Ø§ÙØ£Ø³Ø¨ÙØ¹" Ø£Ù "Ø­Ø¯Ø¯ Ø®Ø·Ø© Ø¥ØºÙØ§Ù ÙØ¬ÙØ© Ø§ÙØªØ³ÙÙÙ ÙÙ Ø§ÙØ±ÙØ§Ø¶".
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {assistantHistory.map((message, idx) => (
                        <div
                          key={idx}
                          className={`whitespace-pre-wrap rounded-lg border border-border/40 p-3 text-sm ${message.role === 'user' ? 'bg-card/60 text-foreground' : 'bg-secondary/10 text-secondary-foreground'}`}
                        >
                          <span className="block text-xs font-semibold text-muted-foreground">
                            {message.role === "user" ? "Ø£ÙØª" : "Ø§ÙÙØ³Ø§Ø¹Ø¯"}
                          </span>
                          {message.role === "assistant" && message.source === "local" && (
                            <span className="text-[10px] font-medium text-emerald-500">Ø±Ø¯ ÙÙØ±Ù ÙÙ Ø§ÙØ¨ÙØ§ÙØ§Øª Ø§ÙØ­Ø§ÙÙØ©</span>
                          )}
                          {message.role === "assistant" && message.source === "system" && (
                            <span className="text-[10px] font-medium text-destructive">ØªÙØ¨ÙÙ ÙÙ Ø§ÙÙØ¸Ø§Ù</span>
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