'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, Loader2, RefreshCcw } from "lucide-react"

import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLanguage } from "@/context/language-context"
import type { Language } from "@/context/language-context"
import SchemaGlossaryCard from "@/components/schema-glossary"
import {
  api,
  type RunTimeline,
  type RunTimelinePhase,
  type RunTimelinePhaseDefinition,
  type RunTimelineSummary,
  type SchemaTerminologyRecord,
} from "@/lib/api"

type PageProps = {
  params: {
    runId: string
  }
}

const statusVariants: Record<string, string> = {
  PASS: "bg-emerald-500/10 text-emerald-500 border-emerald-500/40",
  SUCCESS: "bg-emerald-500/10 text-emerald-500 border-emerald-500/40",
  WARN: "bg-amber-500/10 text-amber-500 border-amber-500/40",
  WARNING: "bg-amber-500/10 text-amber-500 border-amber-500/40",
  FAIL: "bg-red-500/10 text-red-500 border-red-500/40",
  ERROR: "bg-red-500/10 text-red-500 border-red-500/40",
  UNKNOWN: "bg-slate-500/10 text-slate-400 border-slate-500/40",
  NOT_RUN: "bg-muted text-muted-foreground border-muted-foreground/20",
}

const statusLabels: Record<string, string> = {
  PASS: "Pass",
  SUCCESS: "Success",
  WARN: "Warning",
  WARNING: "Warning",
  FAIL: "Failure",
  ERROR: "Failure",
  UNKNOWN: "Unknown",
  NOT_RUN: "Not Run",
}

const phaseStatus = (phase: RunTimelinePhase): string => {
  const rawStatus = (phase.meta?.status as string | undefined)?.toUpperCase()
  if (rawStatus && statusLabels[rawStatus]) {
    return rawStatus
  }
  if (phase.events.some((event) => event.event === "phase_error")) {
    return "FAIL"
  }
  if (phase.meta) {
    return "UNKNOWN"
  }
  return "NOT_RUN"
}

const pickLocale = (value: Record<string, string>, language: Language): string => {
  if (!value) return ""
  return value[language] ?? value.en ?? Object.values(value)[0] ?? ""
}

const formatDateTime = (value?: unknown): string => {
  if (!value || typeof value !== "string") {
    return "—"
  }
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return value
    }
    return date.toLocaleString()
  } catch {
    return value
  }
}

const formatSeconds = (seconds?: number): string => {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds)) {
    return "—"
  }
  if (seconds < 1) {
    return `${Math.round(seconds * 1000)} ms`
  }
  if (seconds < 120) {
    return `${seconds.toFixed(1)} s`
  }
  const mins = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${mins}m ${remainder.toFixed(0)}s`
}

const formatDurationMs = (duration?: unknown): string => {
  if (typeof duration !== "number" || Number.isNaN(duration)) {
    return "—"
  }
  if (duration < 1000) {
    return `${duration} ms`
  }
  return `${(duration / 1000).toFixed(2)} s`
}

const gatherStringValues = (payload: unknown): string[] => {
  if (!payload) return []
  if (typeof payload === "string") return [payload]
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => gatherStringValues(item))
  }
  if (typeof payload === "object") {
    return Object.values(payload as Record<string, unknown>).flatMap((item) => gatherStringValues(item))
  }
  return []
}

const ExpectedSection = ({
  definition,
  language,
  metaOutputs,
}: {
  definition: RunTimelinePhaseDefinition
  language: Language
  metaOutputs?: Record<string, unknown>
}) => {
  const outputStrings = useMemo(() => gatherStringValues(metaOutputs), [metaOutputs])
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <h4 className="font-semibold text-foreground">{language === "ar" ? "المدخلات المتوقعة" : "Expected Inputs"}</h4>
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          {definition.expected_inputs.map((input) => (
            <li key={input.id}>
              <p className="font-medium text-foreground">{pickLocale(input.name, language)}</p>
              <p>{pickLocale(input.description, language)}</p>
            </li>
          ))}
          {definition.expected_inputs.length === 0 && (
            <li>{language === "ar" ? "لا توجد مدخلات محددة." : "No inputs documented."}</li>
          )}
        </ul>
      </div>
      <div>
        <h4 className="font-semibold text-foreground">{language === "ar" ? "المخرجات المتوقعة" : "Expected Outputs"}</h4>
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          {definition.expected_outputs.map((output) => {
            const produced = outputStrings.some((value) => value?.includes(output.split("/").pop() ?? ""))
            return (
              <li key={output} className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${produced ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                <span>{output}</span>
              </li>
            )
          })}
          {definition.expected_outputs.length === 0 && (
            <li>{language === "ar" ? "لا توجد مخرجات محددة." : "No outputs documented."}</li>
          )}
        </ul>
      </div>
    </div>
  )
}

const LearningResources = ({
  definition,
  language,
}: {
  definition: RunTimelinePhaseDefinition
  language: Language
}) => {
  if (!definition.learning_resources.length) {
    return null
  }
  return (
    <div>
      <h4 className="font-semibold text-foreground">
        {language === "ar" ? "مصادر التعلم" : "Learning Resources"}
      </h4>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {definition.learning_resources.map((item, index) => (
          <li key={`${item.title}-${index}`}>
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer" className="text-primary underline">
                {item.title}
              </a>
            ) : (
              item.title
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

const PhaseCard = ({ phase, language }: { phase: RunTimelinePhase; language: Language }) => {
  const status = phaseStatus(phase)
  const statusClass = statusVariants[status] ?? statusVariants.UNKNOWN
  const statusLabel = statusLabels[status] ?? status
  const description = pickLocale(phase.definition.description, language)
  const name = pickLocale(phase.definition.name, language)
  const meta = (phase.meta ?? {}) as Record<string, unknown>
  const events = phase.events ?? []

  return (
    <Card key={phase.id}>
      <CardHeader>
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle>{name}</CardTitle>
            <CardDescription>{description}</CardDescription>
            <p className="text-xs text-muted-foreground">
              {language === "ar" ? "مجلد المرحلة:" : "Stage directory:"} {phase.stage_directory}
            </p>
          </div>
          <Badge variant="outline" className={`${statusClass} border`}>
            {language === "ar"
              ? statusLabel === "Pass"
                ? "نجاح"
                : statusLabel === "Failure"
                  ? "فشل"
                  : statusLabel === "Warning"
                    ? "تحذير"
                    : statusLabel === "Not Run"
                      ? "لم تُنفذ"
                      : statusLabel
              : statusLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">
              {language === "ar" ? "وقت البداية" : "Started"}
            </p>
            <p className="font-medium text-foreground">{formatDateTime(meta.started_at)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{language === "ar" ? "وقت الانتهاء" : "Finished"}</p>
            <p className="font-medium text-foreground">{formatDateTime(meta.finished_at)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {language === "ar" ? "المدة (مللي ثانية)" : "Duration (ms)"}
            </p>
            <p className="font-medium text-foreground">{formatDurationMs(meta.duration_ms)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {language === "ar" ? "مخرجات موثقة" : "Outputs Recorded"}
            </p>
            <p className="font-medium text-foreground">{Object.keys((meta.outputs as Record<string, unknown>) ?? {}).length}</p>
          </div>
        </div>

        <ExpectedSection
          definition={phase.definition}
          language={language}
          metaOutputs={(meta.outputs as Record<string, unknown>) ?? undefined}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="font-semibold text-foreground">
              {language === "ar" ? "الفحوص الأساسية" : "Key Checks"}
            </h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {phase.definition.key_checks.length > 0 ? (
                phase.definition.key_checks.map((item, index) => <li key={`${phase.id}-check-${index}`}>{item}</li>)
              ) : (
                <li>{language === "ar" ? "لا توجد فحوص محددة." : "No key checks documented."}</li>
              )}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground">
              {language === "ar" ? "الأعطال الشائعة" : "Common Failures"}
            </h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {phase.definition.common_failures.length > 0 ? (
                phase.definition.common_failures.map((item, index) => (
                  <li key={`${phase.id}-failure-${index}`}>{item}</li>
                ))
              ) : (
                <li>{language === "ar" ? "لم يتم تسجيل أعطال معروفة." : "No known failures documented."}</li>
              )}
            </ul>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-foreground">
            {language === "ar" ? "السجل الزمني" : "Event Timeline"}
          </h4>
          {events.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {language === "ar" ? "لا توجد أحداث مسجلة لهذه المرحلة." : "No events captured for this phase."}
            </p>
          ) : (
            <ScrollArea className="mt-2 max-h-64 rounded border border-border">
              <ul className="divide-y divide-border">
                {events.map((event, index) => (
                  <li key={`${phase.id}-event-${index}`} className="space-y-1 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{event.event as string}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(event.ts)}</span>
                    </div>
                    {event.message && <p className="text-muted-foreground">{event.message as string}</p>}
                    {event.payload ? (
                      <pre className="mt-1 overflow-auto rounded bg-muted/30 p-2 text-xs text-muted-foreground">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>

        <div>
          <h4 className="font-semibold text-foreground">{language === "ar" ? "المخرجات" : "Outputs"}</h4>
          <pre className="mt-2 max-h-48 overflow-auto rounded border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            {meta.outputs ? JSON.stringify(meta.outputs, null, 2) : language === "ar" ? "لا توجد مخرجات." : "No outputs recorded."}
          </pre>
        </div>

        <div>
          <h4 className="font-semibold text-foreground">{language === "ar" ? "الإعدادات" : "Configuration Snapshot"}</h4>
          <pre className="mt-2 max-h-48 overflow-auto rounded border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            {meta.config ? JSON.stringify(meta.config, null, 2) : language === "ar" ? "لا توجد إعدادات." : "No configuration captured."}
          </pre>
        </div>

        <LearningResources definition={phase.definition} language={language} />
      </CardContent>
    </Card>
  )
}

const SummaryCard = ({
  summary,
  language,
}: {
  summary: RunTimelineSummary
  language: Language
}) => {
  const entries = Object.entries(summary.status_counts ?? {})
  return (
    <Card>
      <CardHeader>
        <CardTitle>{language === "ar" ? "نظرة عامة على التشغيل" : "Run Overview"}</CardTitle>
        <CardDescription>
          {language === "ar"
            ? "تلخيص لحالات المراحل، وأوقات البدء والانتهاء، وأي تحذيرات."
            : "Summary of phase states, execution window, and any warnings."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">{language === "ar" ? "البداية" : "Started"}</p>
            <p className="font-medium text-foreground">{formatDateTime(summary.started_at)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{language === "ar" ? "الانتهاء" : "Finished"}</p>
            <p className="font-medium text-foreground">{formatDateTime(summary.finished_at)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{language === "ar" ? "مدة التشغيل" : "Total Duration"}</p>
            <p className="font-medium text-foreground">{formatSeconds(summary.duration_seconds)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {language === "ar" ? "مراحل بها تحذيرات/أخطاء" : "Phases with Warnings/Errors"}
            </p>
            <p className="font-medium text-foreground">
              {(summary.phases_with_warnings?.length ?? 0) + (summary.phases_with_errors?.length ?? 0)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {entries.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              {language === "ar" ? "لا توجد بيانات حالة." : "No status data available."}
            </span>
          ) : (
            entries.map(([key, value]) => (
              <span
                key={key}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${statusVariants[key] ?? statusVariants.UNKNOWN}`}
              >
                <span className="uppercase">{key}</span>
                <span>{value}</span>
              </span>
            ))
          )}
        </div>
        {summary.phases_with_errors?.length ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-semibold">
                {language === "ar" ? "مراحل فشلت" : "Phases reporting failures"}
              </p>
              <p>{summary.phases_with_errors.join(", ")}</p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default function RunAnalysisPage({ params }: PageProps) {
  const { runId } = params
  const searchParams = useSearchParams()
  const artifactsRoot = searchParams.get("artifacts_root") ?? undefined
  const { language, translate } = useLanguage()

  const [timeline, setTimeline] = useState<RunTimeline | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [terminologyRecords, setTerminologyRecords] = useState<SchemaTerminologyRecord[]>([])
  const [terminologyAliases, setTerminologyAliases] = useState<Record<string, string>>({})
  const [terminologyLoading, setTerminologyLoading] = useState<boolean>(true)
  const [terminologyError, setTerminologyError] = useState<string | null>(null)

  const loadTimeline = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.getRunTimeline(runId, artifactsRoot)
      setTimeline(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load run timeline.")
      setTimeline(null)
    } finally {
      setLoading(false)
    }
  }, [runId, artifactsRoot])

  const loadTerminology = useCallback(async () => {
    setTerminologyLoading(true)
    setTerminologyError(null)
    try {
      const response = await api.getSchemaTerminology(runId, artifactsRoot)
      setTerminologyRecords(response.records ?? [])
      setTerminologyAliases(response.aliases ?? {})
    } catch (err) {
      setTerminologyError(err instanceof Error ? err.message : "Unable to load schema glossary.")
      setTerminologyRecords([])
      setTerminologyAliases({})
    } finally {
      setTerminologyLoading(false)
    }
  }, [runId, artifactsRoot])

  useEffect(() => {
    void loadTimeline()
  }, [loadTimeline])

  useEffect(() => {
    void loadTerminology()
  }, [loadTerminology])

  const aliasesByColumn = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const [aliasRaw, columnIdRaw] of Object.entries(terminologyAliases ?? {})) {
      if (!columnIdRaw) {
        continue
      }
      const alias = String(aliasRaw).trim()
      const columnId = String(columnIdRaw).trim()
      if (!alias || !columnId) {
        continue
      }
      if (!map[columnId]) {
        map[columnId] = []
      }
      if (!map[columnId].includes(alias)) {
        map[columnId].push(alias)
      }
    }
    for (const key of Object.keys(map)) {
      map[key] = map[key].sort((a, b) => a.localeCompare(b))
    }
    return map
  }, [terminologyAliases])

  const handleRefresh = useCallback(() => {
    void loadTimeline()
    void loadTerminology()
  }, [loadTimeline, loadTerminology])

  const isRefreshing = loading || terminologyLoading

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {language === "ar"
                    ? translate("تشريح تشغيل") + ` · ${runId}`
                    : translate("Run Analysis") + ` · ${runId}`}
                </h1>
                <p className="text-muted-foreground">
                  {language === "ar"
                    ? "واجهة تعليمية تعرض ما هو متوقع من كل مرحلة وما حدث فعلياً."
                    : "An instructive timeline describing expected behaviour and actual results for each stage."}
                </p>
                {artifactsRoot ? (
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" ? "مسار الملفات:" : "Artifacts root:"} {artifactsRoot}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
                  {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                  {language === "ar" ? "تحديث" : "Refresh"}
                </Button>
                <Link
                  href={artifactsRoot ? `/results?artifacts_root=${encodeURIComponent(artifactsRoot)}&selected=${runId}` : "/results"}
                  className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {language === "ar" ? "الرجوع إلى النتائج" : "Back to Results"}
                </Link>
              </div>
            </div>

            <Tabs defaultValue="timeline" className="space-y-6">
              <TabsList className="w-full justify-start gap-2 md:w-auto">
                <TabsTrigger value="timeline" className="flex-1 md:flex-none">
                  {language === "ar" ? "المخطط الزمني للمراحل" : "Phase Timeline"}
                </TabsTrigger>
                <TabsTrigger value="glossary" className="flex-1 md:flex-none">
                  {language === "ar" ? "مسرد المخطط" : "Schema Glossary"}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="timeline" className="space-y-6">
                {loading ? (
                  <div className="flex items-center justify-center py-20 text-muted-foreground">
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                    {language === "ar" ? "جاري تحميل تفاصيل التشغيل..." : "Loading run details..."}
                  </div>
                ) : error ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-destructive">
                    <p className="font-semibold">
                      {language === "ar" ? "فشل تحميل المخطط الزمني للتشغيل." : "Failed to load run timeline."}
                    </p>
                    <p className="text-sm">{error}</p>
                  </div>
                ) : timeline ? (
                  <div className="space-y-6">
                    <SummaryCard summary={timeline.summary} language={language} />
                    {timeline.phases.map((phase) => (
                      <PhaseCard key={phase.id} phase={phase} language={language} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
                    {language === "ar"
                      ? "لا تتوفر بيانات المخطط الزمني لهذا التشغيل."
                      : "No timeline data is available for this run."}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="glossary">
                <SchemaGlossaryCard
                  records={terminologyRecords}
                  aliasesByColumn={aliasesByColumn}
                  language={language}
                  loading={terminologyLoading}
                  error={terminologyError}
                  resetKey={`${runId}-${artifactsRoot ?? ""}`}
                />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  )
}
