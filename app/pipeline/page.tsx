"use client"

import type React from "react"

import { useState, useRef, useMemo, useEffect, useCallback } from "react"
import type { PipelineResponse } from "@/lib/api"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AlertTriangle, Play, Plus, X } from "lucide-react"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

const generateRunId = () => `run-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`

type ParsedPipelineError = {
  headline: string
  reason: string | null
  references: string[]
}

const parsePipelineErrorMessage = (message: string): ParsedPipelineError => {
  const [main, filesPart] = message.split(" Related files:")
  const trimmedMain = main.trim()
  const colonIndex = trimmedMain.indexOf(":")
  const headline = colonIndex >= 0 ? trimmedMain.slice(0, colonIndex).trim() : trimmedMain
  const reason = colonIndex >= 0 ? trimmedMain.slice(colonIndex + 1).trim() : null
  const references = filesPart
    ? filesPart
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : []
  return { headline, reason, references }
}

export default function PipelinePage() {
  const initialRunId = useMemo(() => generateRunId(), [])
  const [runId, setRunId] = useState(initialRunId)
  const [dataFiles, setDataFiles] = useState<string[]>([])
  const [slaFiles, setSlaFiles] = useState<string[]>([])
  const [stopOnError, setStopOnError] = useState(true)
  const [llmSummary, setLlmSummary] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [pipelineResult, setPipelineResult] = useState<PipelineResponse | null>(null)
  const [pipelineError, setPipelineError] = useState<string | null>(null)
  const [isUploadingDataFiles, setIsUploadingDataFiles] = useState(false)
  const [isUploadingSlaFiles, setIsUploadingSlaFiles] = useState(false)
  const { toast } = useToast()

  const parsedPipelineError = pipelineError ? parsePipelineErrorMessage(pipelineError) : null

  const dataFileInputRef = useRef<HTMLInputElement>(null)
  const slaFileInputRef = useRef<HTMLInputElement>(null)
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollingRunIdRef = useRef<string | null>(null)
  const isMountedRef = useRef(true)

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
    pollingRunIdRef.current = null
  }, [])

  const pollPipelineCompletion = useCallback(
    (targetRunId: string) => {
      stopPolling()
      pollingRunIdRef.current = targetRunId
      const maxAttempts = 180
      const intervalMs = 10000
      let attempts = 0

      const poll = async () => {
        if (!isMountedRef.current || pollingRunIdRef.current !== targetRunId) {
          return
        }
        attempts += 1
        try {
          const artifacts = await api.listRunArtifacts(targetRunId)
          const phases = artifacts.phases ?? []
          const hasBiPhase = phases.some((phase) => phase.id === "stage_10_bi")
          if (hasBiPhase) {
            stopPolling()
            if (!isMountedRef.current) {
              return
            }
            setIsRunning(false)
            setPipelineError(null)
            setPipelineResult({
              run_id: artifacts.run_id,
              phases: phases.map((phase) => ({
                phase: phase.id,
                label: phase.label,
                files: phase.files,
              })) as Array<Record<string, unknown>>,
            })
            toast({
              title: "Pipeline Completed",
              description: `Pipeline ${targetRunId} finished successfully.`,
            })
            return
          }
        } catch (error) {
          console.error("[v0] Polling pipeline status failed:", error)
        }

        if (attempts >= maxAttempts) {
          stopPolling()
          if (!isMountedRef.current) {
            return
          }
          setPipelineResult(null)
          setIsRunning(false)
          setPipelineError("Pipeline is still running or failed. Please review artifacts for details.")
          toast({
            title: "Pipeline status timed out",
            description: `Unable to confirm completion for ${targetRunId}. Check the pipeline artifacts.`,
            variant: "destructive",
          })
          return
        }

        pollTimeoutRef.current = setTimeout(poll, intervalMs)
      }

      pollTimeoutRef.current = setTimeout(poll, 0)
    },
    [stopPolling, toast],
  )

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      stopPolling()
    }
  }, [stopPolling])

  const addDataFile = () => {
    dataFileInputRef.current?.click()
  }

  const addManualDataFile = () => {
    setDataFiles((prev) => [...prev, ""])
  }

  const handleDataFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) {
      return
    }

    const selectedFiles = Array.from(files)
    setIsUploadingDataFiles(true)

    try {
      const uploads = await Promise.all(selectedFiles.map((file) => api.uploadFile(file)))
      setDataFiles((prev) => {
        const existing = [...prev]
        const newPaths = uploads.map((upload) => upload.path)
        return [...existing, ...newPaths]
      })
      toast({
        title: "Data ready",
        description: `Uploaded ${uploads.length} data file${uploads.length > 1 ? "s" : ""} for processing`,
      })
    } catch (error) {
      console.error("[v0] Data file upload failed:", error)
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload data files",
        variant: "destructive",
      })
    } finally {
      setIsUploadingDataFiles(false)
      if (dataFileInputRef.current) {
        dataFileInputRef.current.value = ""
      }
    }
  }

  const removeDataFile = (index: number) => setDataFiles((prev) => prev.filter((_, i) => i !== index))
  const updateDataFile = (index: number, value: string) => {
    setDataFiles((prev) => {
      const newFiles = [...prev]
      newFiles[index] = value
      return newFiles
    })
  }

  const addSlaFile = () => {
    slaFileInputRef.current?.click()
  }

  const addManualSlaFile = () => {
    setSlaFiles((prev) => [...prev, ""])
  }

  const handleSlaFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) {
      return
    }

    const selectedFiles = Array.from(files)
    setIsUploadingSlaFiles(true)

    try {
      const uploads = await Promise.all(selectedFiles.map((file) => api.uploadFile(file)))
      setSlaFiles((prev) => {
        const existing = [...prev]
        const newPaths = uploads.map((upload) => upload.path)
        return [...existing, ...newPaths]
      })
      toast({
        title: "SLA files ready",
        description: `Uploaded ${uploads.length} SLA document${uploads.length > 1 ? "s" : ""}`,
      })
    } catch (error) {
      console.error("[v0] SLA file upload failed:", error)
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload SLA files",
        variant: "destructive",
      })
    } finally {
      setIsUploadingSlaFiles(false)
      if (slaFileInputRef.current) {
        slaFileInputRef.current.value = ""
      }
    }
  }

  const removeSlaFile = (index: number) => setSlaFiles((prev) => prev.filter((_, i) => i !== index))
  const updateSlaFile = (index: number, value: string) => {
    setSlaFiles((prev) => {
      const newFiles = [...prev]
      newFiles[index] = value
      return newFiles
    })
  }

  const handleRunPipeline = async () => {
    console.log("[v0] handleRunPipeline called")
    console.log("[v0] Current state - runId:", runId, "dataFiles:", dataFiles, "slaFiles:", slaFiles)

    const trimmedRunId = runId.trim() || generateRunId()
    if (!runId.trim()) {
      setRunId(trimmedRunId)
    }

    if (dataFiles.filter((f) => f.trim()).length === 0) {
      console.log("[v0] Validation failed - missing dataFiles")
      toast({
        title: "Validation Error",
        description: "Please upload or enter at least one data file path",
        variant: "destructive",
      })
      return
    }

    stopPolling()
    setIsRunning(true)
    setPipelineResult(null)
    setPipelineError(null)
    console.log("[v0] Starting pipeline execution...")

    let acceptedAsync = false

    try {
      const result = await api.runFullPipeline(
        trimmedRunId,
        {
          data_files: dataFiles.filter((f) => f.trim()),
          sla_files: slaFiles.filter((f) => f.trim()),
          stop_on_error: stopOnError,
          llm_summary: llmSummary,
        },
        { asyncMode: true },
      )

      if (result === null) {
        acceptedAsync = true
        toast({
          title: "Pipeline Accepted",
          description: `Pipeline ${trimmedRunId} is running in the background.`,
        })
        pollPipelineCompletion(trimmedRunId)
      } else {
        console.log("[v0] Pipeline execution successful:", result)
        setPipelineResult(result)
        setPipelineError(null)
        toast({
          title: "Pipeline Completed",
          description: `Pipeline ${result.run_id} finished successfully.`,
        })
      }
    } catch (error) {
      console.error("[v0] Pipeline execution failed:", error)
      stopPolling()
      setPipelineResult(null)
      setPipelineError(error instanceof Error ? error.message : "Unknown error occurred")
      toast({
        title: "Pipeline Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    } finally {
      if (!acceptedAsync) {
        setIsRunning(false)
      }
      console.log("[v0] Pipeline execution completed")
    }
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <input
              ref={dataFileInputRef}
              type="file"
              accept=".csv,.parquet"
              multiple
              className="hidden"
              onChange={handleDataFileSelect}
            />
            <input
              ref={slaFileInputRef}
              type="file"
              accept=".pdf,.docx,.csv,.html,.xlsx,.xls"
              multiple
              className="hidden"
              onChange={handleSlaFileSelect}
            />

            <div>
              <h1 className="text-3xl font-bold text-foreground">Full Pipeline Execution</h1>
              <p className="text-muted-foreground">Configure and run the complete Mind-Q pipeline</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Pipeline Configuration</CardTitle>
                <CardDescription>Set up your pipeline run parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Run ID */}
                <div className="space-y-2">
                    <Label htmlFor="runId">Run ID</Label>
                    <div className="flex gap-2">
                      <Input
                        id="runId"
                        placeholder="Run identifier"
                        value={runId}
                        onChange={(e) => setRunId(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const newId = generateRunId()
                          setRunId(newId)
                          toast({
                            title: "Run ID updated",
                            description: `Generated ${newId}`,
                          })
                        }}
                      >
                        Regenerate
                      </Button>
                    </div>
                  <p className="text-xs text-muted-foreground">Unique identifier for this pipeline run</p>
                </div>

                {/* Data Files */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <Label>Data Files</Label>
                      <p className="text-xs text-muted-foreground">
                        Upload raw datasets or enter server-accessible paths.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={addDataFile} disabled={isUploadingDataFiles}>
                        <Plus className="mr-2 h-4 w-4" />
                        Upload Files
                      </Button>
                      <Button variant="ghost" size="sm" onClick={addManualDataFile}>
                        Add Path
                      </Button>
                    </div>
                  </div>
                  {isUploadingDataFiles ? (
                    <p className="text-xs text-muted-foreground">Uploading data files...</p>
                  ) : null}
                  {dataFiles.length > 0 ? (
                    <div className="space-y-2">
                      {dataFiles.map((file, index) => (
                        <div key={`${file}-${index}`} className="flex gap-2">
                          <Input
                            placeholder="/absolute/path/to/data.csv"
                            value={file}
                            onChange={(e) => updateDataFile(index, e.target.value)}
                          />
                          <Button variant="ghost" size="icon" onClick={() => removeDataFile(index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">No data files selected yet.</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Uploaded files are stored under <code>uploads/</code> and their absolute paths are sent to the
                    pipeline. Adjust paths if the backend expects a different location.
                  </p>
                </div>

                {/* SLA Files */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <Label>SLA Files (Optional)</Label>
                      <p className="text-xs text-muted-foreground">Attach SLA documents or reference existing paths.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={addSlaFile} disabled={isUploadingSlaFiles}>
                        <Plus className="mr-2 h-4 w-4" />
                        Upload SLA
                      </Button>
                      <Button variant="ghost" size="sm" onClick={addManualSlaFile}>
                        Add Path
                      </Button>
                    </div>
                  </div>
                  {isUploadingSlaFiles ? (
                    <p className="text-xs text-muted-foreground">Uploading SLA documents...</p>
                  ) : null}
                  {slaFiles.length > 0 ? (
                    <div className="space-y-2">
                      {slaFiles.map((file, index) => (
                        <div key={`${file}-${index}`} className="flex gap-2">
                          <Input
                            placeholder="/absolute/path/to/sla.pdf"
                            value={file}
                            onChange={(e) => updateSlaFile(index, e.target.value)}
                          />
                          <Button variant="ghost" size="icon" onClick={() => removeSlaFile(index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">No SLA documents attached.</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Supported formats: PDF, DOCX, CSV, HTML, Excel. Uploaded files are stored under <code>uploads/</code>.
                  </p>
                </div>

                {/* Options */}
                <div className="space-y-4 rounded-lg border border-border bg-card/50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="stopOnError">Stop on Error</Label>
                      <p className="text-xs text-muted-foreground">Abort pipeline on first phase failure</p>
                    </div>
                    <Switch id="stopOnError" checked={stopOnError} onCheckedChange={setStopOnError} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="llmSummary">LLM Summary</Label>
                      <p className="text-xs text-muted-foreground">Generate AI-powered executive summary</p>
                    </div>
                    <Switch id="llmSummary" checked={llmSummary} onCheckedChange={setLlmSummary} />
                  </div>
                </div>

                {/* Run Button */}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleRunPipeline}
                  disabled={isRunning || isUploadingDataFiles || isUploadingSlaFiles}
                >
                  <Play className="mr-2 h-5 w-5" />
                  {isUploadingDataFiles || isUploadingSlaFiles
                    ? "Uploading files..."
                    : isRunning
                      ? "Running Pipeline..."
                      : "Run Full Pipeline"}
                </Button>
              </CardContent>
            </Card>

            {(pipelineResult || pipelineError) && (
              <Card>
                <CardHeader>
                  <CardTitle>Last Pipeline Response</CardTitle>
                  <CardDescription>
                    {!pipelineResult && pipelineError ? "Pipeline request failed" : "Latest response payload"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pipelineError ? (
                    <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4">
                      <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
                      <div className="space-y-1">
                        <p className="font-medium text-destructive">
                          {parsedPipelineError?.headline || "Pipeline call failed"}
                        </p>
                        {parsedPipelineError?.reason ? (
                          <p className="text-sm text-destructive/80">{parsedPipelineError.reason}</p>
                        ) : (
                          <p className="text-sm text-destructive/80">{pipelineError}</p>
                        )}
                        {parsedPipelineError?.references?.length ? (
                          <div className="pt-1">
                            <p className="text-xs font-medium text-destructive/60">Related files</p>
                            <ul className="mt-1 space-y-1 text-xs text-destructive/60">
                              {parsedPipelineError.references.map((reference) => (
                                <li key={reference}>
                                  <code className="break-all">{reference}</code>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {pipelineResult ? (
                    <div className="space-y-3">
                      <div className="rounded-md border border-border bg-muted/20 p-4">
                        <p className="text-sm font-medium text-muted-foreground">Run ID</p>
                        <p className="font-mono text-sm text-foreground">{pipelineResult.run_id}</p>
                      </div>
                      <div className="rounded-md border border-border bg-muted/20 p-4">
                        <p className="text-sm font-medium text-muted-foreground">Phases Payload</p>
                        <pre className="max-h-64 overflow-auto text-xs text-foreground">
                          {JSON.stringify(pipelineResult.phases, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {/* Pipeline Stages Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Pipeline Stages</CardTitle>
                <CardDescription>10 stages from ingestion to BI delivery</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { stage: "01", name: "Ingestion", desc: "Data & SLA ingestion" },
                    { stage: "02", name: "Quality", desc: "Data quality checks" },
                    { stage: "03", name: "Schema", desc: "Schema extraction" },
                    { stage: "04", name: "Profile", desc: "Data profiling" },
                    { stage: "05", name: "Missing", desc: "Imputation" },
                    { stage: "06", name: "Standardize", desc: "Feature engineering" },
                    { stage: "07", name: "Readiness", desc: "Readiness analysis" },
                    { stage: "08", name: "Insights", desc: "Operational insights" },
                    { stage: "09", name: "Validation", desc: "Business validation" },
                    { stage: "10", name: "BI Delivery", desc: "Semantic marts & dashboards" },
                  ].map((phase) => (
                    <div
                      key={phase.stage}
                      className="rounded-lg border border-border bg-gradient-to-br from-card to-primary/5 p-4"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
                          {phase.stage}
                        </span>
                        <h3 className="font-semibold text-foreground">{phase.name}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground">{phase.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
