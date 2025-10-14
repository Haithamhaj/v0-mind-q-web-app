"use client"

import type React from "react"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  FileText,
  Download,
  Search,
  FileJson,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react"

const mockArtifacts = [
  {
    runId: "run_2024_001",
    phase: "01",
    name: "Ingestion",
    artifacts: [
      { name: "raw.parquet", type: "parquet", size: "2.4 MB", status: "success" },
      { name: "meta_ingestion.json", type: "json", size: "12 KB", status: "success" },
      { name: "sla_manifest.json", type: "json", size: "8 KB", status: "success" },
    ],
  },
  {
    runId: "run_2024_001",
    phase: "02",
    name: "Quality",
    artifacts: [
      { name: "quality_report.json", type: "json", size: "45 KB", status: "success" },
      { name: "issues_catalog.json", type: "json", size: "23 KB", status: "warn" },
    ],
  },
  {
    runId: "run_2024_001",
    phase: "07",
    name: "Readiness",
    artifacts: [
      { name: "readiness_report.json", type: "json", size: "67 KB", status: "success" },
      { name: "correlation_matrix.json", type: "json", size: "156 KB", status: "success" },
      { name: "leakage_analysis.json", type: "json", size: "34 KB", status: "success" },
    ],
  },
  {
    runId: "run_2024_001",
    phase: "08",
    name: "Insights",
    artifacts: [
      { name: "insights_report.json", type: "json", size: "89 KB", status: "success" },
      { name: "story_ops.json", type: "json", size: "45 KB", status: "success" },
      { name: "diagnostics.json", type: "json", size: "56 KB", status: "success" },
      { name: "segment_stats.parquet", type: "parquet", size: "1.2 MB", status: "success" },
    ],
  },
  {
    runId: "run_2024_001",
    phase: "09",
    name: "Business Validation",
    artifacts: [
      { name: "validation_report.json", type: "json", size: "123 KB", status: "success" },
      { name: "bi_feed.parquet", type: "parquet", size: "3.1 MB", status: "success" },
      { name: "sla_summary.json", type: "json", size: "34 KB", status: "success" },
      { name: "bi_whitelist.jsonl", type: "jsonl", size: "78 KB", status: "success" },
    ],
  },
]

export default function ResultsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRun, setSelectedRun] = useState("run_2024_001")

  const getFileIcon = (type: string) => {
    switch (type) {
      case "json":
      case "jsonl":
        return <FileJson className="h-5 w-5 text-primary" />
      case "parquet":
        return <FileSpreadsheet className="h-5 w-5 text-secondary" />
      case "md":
        return <FileText className="h-5 w-5 text-muted-foreground" />
      default:
        return <FileCode className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-secondary" />
      case "warn":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />
      default:
        return null
    }
  }

  const filteredArtifacts = mockArtifacts.filter(
    (group) =>
      group.runId === selectedRun &&
      (searchQuery === "" ||
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.artifacts.some((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()))),
  )

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Results & Artifacts</h1>
              <p className="text-muted-foreground">Browse and download pipeline outputs</p>
            </div>

            {/* Run Selector and Search */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1">
                    <Label className="mb-2 block text-sm font-medium">Select Run</Label>
                    <select
                      value={selectedRun}
                      onChange={(e) => setSelectedRun(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="run_2024_001">run_2024_001</option>
                      <option value="run_2024_002">run_2024_002</option>
                      <option value="run_2024_003">run_2024_003</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <Label className="mb-2 block text-sm font-medium">Search Artifacts</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search by phase or file name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Artifacts by Phase */}
            <div className="space-y-4">
              {filteredArtifacts.map((group) => (
                <Card key={`${group.runId}-${group.phase}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-primary/10 text-primary">
                          Phase {group.phase}
                        </Badge>
                        <CardTitle className="text-lg">{group.name}</CardTitle>
                      </div>
                      <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Download All
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {group.artifacts.map((artifact, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-4 transition-colors hover:bg-accent/10"
                        >
                          <div className="flex items-center gap-4">
                            {getFileIcon(artifact.type)}
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-mono text-sm font-medium text-foreground">{artifact.name}</p>
                                {getStatusIcon(artifact.status)}
                              </div>
                              <p className="text-xs text-muted-foreground">{artifact.size}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                            <Button variant="outline" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Artifact Details Viewer */}
            <Card>
              <CardHeader>
                <CardTitle>Artifact Viewer</CardTitle>
                <CardDescription>Preview artifact contents</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="validation">
                  <TabsList>
                    <TabsTrigger value="validation">Validation Report</TabsTrigger>
                    <TabsTrigger value="insights">Insights</TabsTrigger>
                    <TabsTrigger value="sla">SLA Summary</TabsTrigger>
                  </TabsList>

                  <TabsContent value="validation" className="space-y-4">
                    <div className="rounded-lg border border-border bg-muted/20 p-4">
                      <pre className="overflow-x-auto text-xs">
                        {JSON.stringify(
                          {
                            run_id: "run_2024_001",
                            timestamp: "2024-01-15T10:30:00Z",
                            status: "PASS",
                            kpi_results: {
                              on_time_delivery: { value: 94.5, target: 90, status: "PASS" },
                              cost_efficiency: { value: 87.2, target: 85, status: "PASS" },
                              quality_score: { value: 96.8, target: 95, status: "PASS" },
                            },
                            rules_evaluated: 12,
                            rules_passed: 11,
                            rules_warned: 1,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  </TabsContent>

                  <TabsContent value="insights" className="space-y-4">
                    <div className="space-y-3">
                      <div className="rounded-lg border border-secondary/30 bg-secondary/10 p-4">
                        <h4 className="mb-2 font-semibold text-foreground">Key Insight</h4>
                        <p className="text-sm text-muted-foreground">
                          Delivery performance improved by 12% in the last quarter, driven by optimized routing
                          algorithms and reduced transit times in urban areas.
                        </p>
                      </div>
                      <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
                        <h4 className="mb-2 font-semibold text-foreground">Operational Story</h4>
                        <p className="text-sm text-muted-foreground">
                          Cost efficiency metrics show strong correlation with vehicle utilization rates. Segments with
                          80%+ utilization demonstrate 15% better cost performance.
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="sla" className="space-y-4">
                    <div className="space-y-3">
                      {[
                        { term: "On-Time Delivery", status: "PASS", actual: "94.5%", target: "90%" },
                        { term: "Cost per Mile", status: "PASS", actual: "$2.34", target: "$2.50" },
                        { term: "Customer Satisfaction", status: "WARN", actual: "88%", target: "90%" },
                      ].map((sla, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg border border-border p-4"
                        >
                          <div>
                            <p className="font-medium text-foreground">{sla.term}</p>
                            <p className="text-sm text-muted-foreground">
                              Actual: {sla.actual} | Target: {sla.target}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              sla.status === "PASS"
                                ? "bg-secondary/20 text-secondary"
                                : "bg-yellow-500/20 text-yellow-500"
                            }
                          >
                            {sla.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}

function Label({ children, className, ...props }: React.ComponentPropsWithoutRef<"label">) {
  return (
    <label
      className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
      {...props}
    >
      {children}
    </label>
  )
}
