"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Play, Plus, X } from "lucide-react"
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
  const [selectedPhase, setSelectedPhase] = useState("01")
  const [runId, setRunId] = useState("")
  const [dataFiles, setDataFiles] = useState<string[]>([""])
  const [slaFiles, setSlaFiles] = useState<string[]>([])
  const [configJson, setConfigJson] = useState("")
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

  const handleRunPhase = async () => {
    console.log("[v0] handleRunPhase called for phase:", selectedPhase)
    console.log("[v0] Current state - runId:", runId, "dataFiles:", dataFiles, "slaFiles:", slaFiles)

    if (!runId) {
      console.log("[v0] Validation failed - missing runId")
      toast({
        title: "Validation Error",
        description: "Please provide a Run ID",
        variant: "destructive",
      })
      return
    }

    setIsRunning(true)
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
        await api.runPhase01(runId, {
          data_files: dataFiles.filter((f) => f.trim()),
          sla_files: slaFiles.filter((f) => f.trim()),
          config,
        })
      } else {
        // Other phases use standard request
        console.log("[v0] Executing Phase", selectedPhase, "with standard request")
        await api.runPhase(runId, selectedPhase, {
          config,
          use_defaults: true,
        })
      }

      console.log("[v0] Phase execution successful")
      toast({
        title: "Phase Started",
        description: `Phase ${selectedPhase} is now running for ${runId}`,
      })
    } catch (error) {
      console.error("[v0] Phase execution failed:", error)
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
                        <Input
                          id="runId"
                          placeholder="e.g., run_2024_001"
                          value={runId}
                          onChange={(e) => setRunId(e.target.value)}
                        />
                      </div>

                      {/* Phase 01 specific fields */}
                      {selectedPhase === "01" && (
                        <>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Data Files</Label>
                              <Button variant="outline" size="sm" onClick={addDataFile}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {dataFiles.map((file, index) => (
                                <div key={index} className="flex gap-2">
                                  <Input
                                    placeholder="/path/to/data.csv"
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
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>SLA Files (Optional)</Label>
                              <Button variant="outline" size="sm" onClick={addSlaFile}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add
                              </Button>
                            </div>
                            {slaFiles.length > 0 && (
                              <div className="space-y-2">
                                {slaFiles.map((file, index) => (
                                  <div key={index} className="flex gap-2">
                                    <Input
                                      placeholder="/path/to/sla.pdf"
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

                  <Button className="mt-6 w-full" size="lg" onClick={handleRunPhase} disabled={isRunning}>
                    <Play className="mr-2 h-5 w-5" />
                    {isRunning ? "Running Phase..." : `Run Phase ${selectedPhase}`}
                  </Button>
                </CardContent>
              </Card>
            </div>

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
