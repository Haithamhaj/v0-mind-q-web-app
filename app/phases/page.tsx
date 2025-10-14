"use client"

import type React from "react"

import { useState, useRef, useMemo } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, Play, Plus, X } from "lucide-react"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

const phases = [
  { id: "01", name: "Ingestion", desc: "Multi-file CSV/Parquet ingestion and SLA document processing" },
  { id: "02", name: "Quality", desc: "Data quality checks, row guards, and issue cataloging" },
  { id: "03", name: "Schema", desc: "Schema extraction and baseline verification" },
  { id: "04", name: "Profile", desc: "Lightweight profiling and row-count consistency" },
  { id: "05", name: "Missing", desc: "Hybrid/groupwise imputation with PSI monitoring" },
  { id: "06", name: "Standardize", desc: "Feature engineering and protected-column enforcement" },
  { id: "07", name: "Readiness", desc: "Leakage detection and correlation analysis" },
  { id: "08", name: "Insights", desc: "Associative insights and operational stories" },
  { id: "09", name: "Validation", desc: "Business validation and SLA assessment" },
]

export default function PhasesPage() {
  const generateRunId = () => `phase-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`
  const initialRunId = useMemo(() => generateRunId(), [])
  const [selectedPhase, setSelectedPhase] = useState("01")
  const [runId, setRunId] = useState(initialRunId)
  const [dataFiles, setDataFiles] = useState<string[]>([])
  const [slaFiles, setSlaFiles] = useState<string[]>([])
  const [configJson, setConfigJson] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [phaseResult, setPhaseResult] = useState<Record<string, unknown> | null>(null)
  const [phaseError, setPhaseError] = useState<string | null>(null)
  const [isUploadingDataFiles, setIsUploadingDataFiles] = useState(false)
  const [isUploadingSlaFiles, setIsUploadingSlaFiles] = useState(false)
  const { toast } = useToast()

  const dataFileInputRef = useRef<HTMLInputElement>(null)
  const slaFileInputRef = useRef<HTMLInputElement>(null)

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
        description: `Uploaded ${uploads.length} data file${uploads.length > 1 ? "s" : ""} for phase ingestion`,
      })
    } catch (error) {
      console.error("[v0] Phase data upload failed:", error)
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
        title: "SLA ready",
        description: `Uploaded ${uploads.length} SLA document${uploads.length > 1 ? "s" : ""}`,
      })
    } catch (error) {
      console.error("[v0] Phase SLA upload failed:", error)
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

  const handleRunPhase = async () => {
    console.log("[v0] handleRunPhase called for phase:", selectedPhase)
    console.log("[v0] Current state - runId:", runId, "dataFiles:", dataFiles, "slaFiles:", slaFiles)

    const trimmedRunId = runId.trim() || generateRunId()
    if (!runId.trim()) {
      setRunId(trimmedRunId)
    }

    setIsRunning(true)
    setPhaseResult(null)
    setPhaseError(null)
    console.log("[v0] Starting phase execution...")

    try {
      let config: Record<string, unknown> | undefined
      if (configJson.trim()) {
        try {
          config = JSON.parse(configJson)
          console.log("[v0] Parsed config:", config)
        } catch {
          console.error("[v0] Failed to parse config JSON")
          toast({
            title: "Invalid JSON",
            description: "Config must be valid JSON",
            variant: "destructive",
          })
          setIsRunning(false)
          return
        }
      }

      let response: Record<string, unknown> | null = null

      if (selectedPhase === "01") {
        // Phase 01 has special handling
        if (dataFiles.filter((f) => f.trim()).length === 0) {
          console.log("[v0] Phase 01 validation failed - no data files")
          toast({
            title: "Validation Error",
            description: "Phase 01 requires at least one data file",
            variant: "destructive",
          })
          setIsRunning(false)
          return
        }

        console.log("[v0] Executing Phase 01 with ingestion request")
        response = await api.runPhase01(trimmedRunId, {
          data_files: dataFiles.filter((f) => f.trim()),
          sla_files: slaFiles.filter((f) => f.trim()),
          config,
        })
      } else {
        // Other phases use standard request
        console.log("[v0] Executing Phase", selectedPhase, "with standard request")
        response = await api.runPhase(trimmedRunId, selectedPhase, {
          config,
          use_defaults: true,
        })
      }

      setPhaseResult(response)
      setPhaseError(null)
      console.log("[v0] Phase execution successful:", response)
      toast({
        title: "Phase Started",
        description: `Phase ${selectedPhase} is now running for ${trimmedRunId}`,
      })
    } catch (error) {
      console.error("[v0] Phase execution failed:", error)
      setPhaseResult(null)
      setPhaseError(error instanceof Error ? error.message : "Unknown error occurred")
      toast({
        title: "Phase Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsRunning(false)
      console.log("[v0] Phase execution completed")
    }
  }

  const currentPhase = phases.find((p) => p.id === selectedPhase)

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <div className="mx-auto max-w-6xl space-y-6">
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
              <h1 className="text-3xl font-bold text-foreground">Individual Phase Execution</h1>
              <p className="text-muted-foreground">Run specific pipeline stages independently</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Phase Selection */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Select Phase</CardTitle>
                  <CardDescription>Choose a stage to execute</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {phases.map((phase) => (
                      <button
                        key={phase.id}
                        onClick={() => setSelectedPhase(phase.id)}
                        className={`w-full rounded-lg border p-3 text-left transition-all ${
                          selectedPhase === phase.id
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border bg-card/50 hover:border-primary/50 hover:bg-accent/10"
                        }`}
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${
                              selectedPhase === phase.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {phase.id}
                          </span>
                          <span className="font-semibold text-foreground">{phase.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{phase.desc}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Phase Configuration */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>
                    Phase {currentPhase?.id}: {currentPhase?.name}
                  </CardTitle>
                  <CardDescription>{currentPhase?.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="basic">Basic</TabsTrigger>
                      <TabsTrigger value="advanced">Advanced</TabsTrigger>
                    </TabsList>

                    <TabsContent value="basic" className="space-y-4">
                      {/* Run ID */}
                      <div className="space-y-2">
                        <Label htmlFor="runId">Run ID</Label>
                        <div className="flex gap-2">
                          <Input
                            id="runId"
                            placeholder="Phase run identifier"
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
                      </div>

                      {/* Phase 01 specific fields */}
                        {selectedPhase === "01" && (
                          <>
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                  <Label>Data Files</Label>
                                  <p className="text-xs text-muted-foreground">
                                    Upload ingestion datasets or provide accessible file paths.
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addDataFile}
                                    disabled={isUploadingDataFiles}
                                  >
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
                                Uploaded files are saved under <code>uploads/</code> in this project. Update the path if
                                the phase expects a different location.
                              </p>
                            </div>

                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                  <Label>SLA Files (Optional)</Label>
                                  <p className="text-xs text-muted-foreground">
                                    Attach SLA documents or reference existing files.
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addSlaFile}
                                    disabled={isUploadingSlaFiles}
                                  >
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
                                Supported formats: PDF, DOCX, CSV, HTML, Excel. Uploaded files live under <code>uploads/</code>.
                              </p>
                            </div>
                          </>
                        )}

                      {/* Other phases info */}
                      {selectedPhase !== "01" && (
                        <div className="rounded-lg border border-border bg-muted/20 p-4">
                          <p className="text-sm text-muted-foreground">
                            This phase will use default inputs from previous stages. You can override specific inputs in
                            the Advanced tab.
                          </p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="advanced" className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="config">Configuration (JSON)</Label>
                        <Textarea
                          id="config"
                          placeholder='{"key": "value"}'
                          value={configJson}
                          onChange={(e) => setConfigJson(e.target.value)}
                          rows={10}
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Optional JSON configuration to override phase defaults
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <Button
                    className="mt-6 w-full"
                    size="lg"
                    onClick={handleRunPhase}
                    disabled={isRunning || isUploadingDataFiles || isUploadingSlaFiles}
                  >
                    <Play className="mr-2 h-5 w-5" />
                    {isUploadingDataFiles || isUploadingSlaFiles
                      ? "Uploading files..."
                      : isRunning
                        ? "Running Phase..."
                        : `Run Phase ${selectedPhase}`}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {(phaseResult || phaseError) && (
              <Card>
                <CardHeader>
                  <CardTitle>Last Phase Response</CardTitle>
                  <CardDescription>
                    {!phaseResult && phaseError ? "Phase request failed" : "Latest response payload"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {phaseError ? (
                    <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4">
                      <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
                      <div>
                        <p className="font-medium text-destructive">Phase call failed</p>
                        <p className="text-sm text-destructive/80">{phaseError}</p>
                      </div>
                    </div>
                  ) : null}
                  {phaseResult ? (
                    <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/20 p-4 text-xs text-foreground">
                      {JSON.stringify(phaseResult, null, 2)}
                    </pre>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {/* Phase Dependencies */}
            <Card>
              <CardHeader>
                <CardTitle>Phase Dependencies</CardTitle>
                <CardDescription>Understanding the pipeline flow</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {phases.map((phase, index) => (
                      <div key={phase.id} className="flex items-center gap-2">
                        <div
                          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border-2 font-bold ${
                            phase.id === selectedPhase
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-foreground"
                          }`}
                        >
                          {phase.id}
                        </div>
                        {index < phases.length - 1 && <div className="h-0.5 w-8 flex-shrink-0 bg-border" />}
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Each phase depends on outputs from previous stages. Phase 01 is the entry point and requires raw
                    data files.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
