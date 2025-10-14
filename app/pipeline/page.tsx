"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Play, Plus, X } from "lucide-react"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

export default function PipelinePage() {
  const [runId, setRunId] = useState("")
  const [dataFiles, setDataFiles] = useState<string[]>([""])
  const [slaFiles, setSlaFiles] = useState<string[]>([])
  const [stopOnError, setStopOnError] = useState(true)
  const [llmSummary, setLlmSummary] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const { toast } = useToast()

  const dataFileInputRef = useRef<HTMLInputElement>(null)
  const slaFileInputRef = useRef<HTMLInputElement>(null)

  const addDataFile = () => {
    dataFileInputRef.current?.click()
  }

  const handleDataFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const newFiles = Array.from(files).map((file) => file.name)
      setDataFiles([...dataFiles.filter((f) => f.trim()), ...newFiles])
    }
    // Reset input
    if (dataFileInputRef.current) {
      dataFileInputRef.current.value = ""
    }
  }

  const removeDataFile = (index: number) => setDataFiles(dataFiles.filter((_, i) => i !== index))
  const updateDataFile = (index: number, value: string) => {
    const newFiles = [...dataFiles]
    newFiles[index] = value
    setDataFiles(newFiles)
  }

  const addSlaFile = () => {
    slaFileInputRef.current?.click()
  }

  const handleSlaFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const newFiles = Array.from(files).map((file) => file.name)
      setSlaFiles([...slaFiles, ...newFiles])
    }
    // Reset input
    if (slaFileInputRef.current) {
      slaFileInputRef.current.value = ""
    }
  }

  const removeSlaFile = (index: number) => setSlaFiles(slaFiles.filter((_, i) => i !== index))
  const updateSlaFile = (index: number, value: string) => {
    const newFiles = [...slaFiles]
    newFiles[index] = value
    setSlaFiles(newFiles)
  }

  const handleRunPipeline = async () => {
    console.log("[v0] handleRunPipeline called")
    console.log("[v0] Current state - runId:", runId, "dataFiles:", dataFiles, "slaFiles:", slaFiles)

    if (!runId || dataFiles.filter((f) => f.trim()).length === 0) {
      console.log("[v0] Validation failed - missing runId or dataFiles")
      toast({
        title: "Validation Error",
        description: "Please provide a Run ID and at least one data file",
        variant: "destructive",
      })
      return
    }

    setIsRunning(true)
    console.log("[v0] Starting pipeline execution...")

    try {
      const result = await api.runFullPipeline(runId, {
        data_files: dataFiles.filter((f) => f.trim()),
        sla_files: slaFiles.filter((f) => f.trim()),
        stop_on_error: stopOnError,
        llm_summary: llmSummary,
      })

      console.log("[v0] Pipeline execution successful:", result)
      toast({
        title: "Pipeline Started",
        description: `Pipeline ${result.run_id} is now running`,
      })
    } catch (error) {
      console.error("[v0] Pipeline execution failed:", error)
      toast({
        title: "Pipeline Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsRunning(false)
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
                  <Input
                    id="runId"
                    placeholder="e.g., run_2024_001"
                    value={runId}
                    onChange={(e) => setRunId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Unique identifier for this pipeline run</p>
                </div>

                {/* Data Files */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Data Files</Label>
                    <Button variant="outline" size="sm" onClick={addDataFile}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add File
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {dataFiles.map((file, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="/path/to/data.csv or /path/to/data.parquet"
                          value={file}
                          onChange={(e) => updateDataFile(index, e.target.value)}
                        />
                        {dataFiles.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => removeDataFile(index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">CSV or Parquet files for ingestion</p>
                </div>

                {/* SLA Files */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>SLA Files (Optional)</Label>
                    <Button variant="outline" size="sm" onClick={addSlaFile}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add SLA
                    </Button>
                  </div>
                  {slaFiles.length > 0 && (
                    <div className="space-y-2">
                      {slaFiles.map((file, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder="/path/to/sla.pdf or /path/to/sla.docx"
                            value={file}
                            onChange={(e) => updateSlaFile(index, e.target.value)}
                          />
                          <Button variant="ghost" size="icon" onClick={() => removeSlaFile(index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">PDF, DOCX, CSV, HTML, or Excel SLA documents</p>
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
                <Button className="w-full" size="lg" onClick={handleRunPipeline} disabled={isRunning}>
                  <Play className="mr-2 h-5 w-5" />
                  {isRunning ? "Running Pipeline..." : "Run Full Pipeline"}
                </Button>
              </CardContent>
            </Card>

            {/* Pipeline Stages Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Pipeline Stages</CardTitle>
                <CardDescription>9 stages from ingestion to business validation</CardDescription>
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
