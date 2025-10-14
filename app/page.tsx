"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Activity, CheckCircle2, AlertCircle, Clock, TrendingUp, Database, FileText, Loader2 } from "lucide-react"
import { api } from "@/lib/api"

type HealthState = "unknown" | "healthy" | "unhealthy"

export default function DashboardPage() {
  const [healthState, setHealthState] = useState<HealthState>("unknown")
  const [healthDetails, setHealthDetails] = useState<Record<string, unknown> | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)

  const fetchHealth = async () => {
    setIsCheckingHealth(true)
    setHealthError(null)

    try {
      const response = await api.healthCheck()
      setHealthDetails(response)
      setHealthState("healthy")
    } catch (error) {
      setHealthDetails(null)
      setHealthState("unhealthy")
      setHealthError(error instanceof Error ? error.message : "Unable to reach pipeline API")
    } finally {
      setIsCheckingHealth(false)
    }
  }

  useEffect(() => {
    void fetchHealth()
  }, [])

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          {/* Hero Section */}
          <div className="mb-8">
            <h1 className="mb-2 text-4xl font-bold text-foreground">
              Mind-<span className="text-primary">Q</span> V4
            </h1>
            <p className="text-lg text-muted-foreground">Logistics Intelligence Platform</p>
          </div>

          {/* Stats Grid */}
          <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
                <Activity className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">24</div>
                <p className="text-xs text-muted-foreground">+3 from last week</p>
              </CardContent>
            </Card>

            <Card className="border-secondary/20 bg-gradient-to-br from-card to-secondary/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Successful</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-secondary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">21</div>
                <p className="text-xs text-muted-foreground">87.5% success rate</p>
              </CardContent>
            </Card>

            <Card className="border-destructive/20 bg-gradient-to-br from-card to-destructive/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">3</div>
                <p className="text-xs text-muted-foreground">-1 from last week</p>
              </CardContent>
            </Card>

            <Card className="border-muted/20 bg-gradient-to-br from-card to-muted/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">12m</div>
                <p className="text-xs text-muted-foreground">Per pipeline run</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Runs */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Pipeline Runs</CardTitle>
                <CardDescription>Latest executions and their status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { id: "run_2024_001", status: "success", time: "2 hours ago", duration: "11m 23s" },
                    { id: "run_2024_002", status: "success", time: "5 hours ago", duration: "10m 45s" },
                    { id: "run_2024_003", status: "failed", time: "8 hours ago", duration: "3m 12s" },
                    { id: "run_2024_004", status: "success", time: "1 day ago", duration: "12m 34s" },
                  ].map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-4 transition-colors hover:bg-accent/10"
                    >
                      <div className="flex items-center gap-4">
                        {run.status === "success" ? (
                          <CheckCircle2 className="h-5 w-5 text-secondary" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        )}
                        <div>
                          <p className="font-mono text-sm font-medium text-foreground">{run.id}</p>
                          <p className="text-xs text-muted-foreground">{run.time}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">{run.duration}</p>
                        <p className="text-xs text-muted-foreground">Duration</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks and operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/pipeline">
                  <Button className="w-full justify-start bg-transparent" variant="outline" size="lg">
                    <Activity className="mr-3 h-5 w-5 text-primary" />
                    <div className="text-left">
                      <div className="font-semibold">Run Full Pipeline</div>
                      <div className="text-xs text-muted-foreground">Execute all 9 stages</div>
                    </div>
                  </Button>
                </Link>

                <Link href="/phases">
                  <Button className="w-full justify-start bg-transparent" variant="outline" size="lg">
                    <Database className="mr-3 h-5 w-5 text-secondary" />
                    <div className="text-left">
                      <div className="font-semibold">Run Individual Phase</div>
                      <div className="text-xs text-muted-foreground">Execute specific stage</div>
                    </div>
                  </Button>
                </Link>

                <Link href="/results">
                  <Button className="w-full justify-start bg-transparent" variant="outline" size="lg">
                    <FileText className="mr-3 h-5 w-5 text-primary" />
                    <div className="text-left">
                      <div className="font-semibold">View Results</div>
                      <div className="text-xs text-muted-foreground">Browse artifacts and reports</div>
                    </div>
                  </Button>
                </Link>

                <Link href="/sla">
                  <Button className="w-full justify-start bg-transparent" variant="outline" size="lg">
                    <TrendingUp className="mr-3 h-5 w-5 text-secondary" />
                    <div className="text-left">
                      <div className="font-semibold">SLA Compliance</div>
                      <div className="text-xs text-muted-foreground">Check SLA status</div>
                    </div>
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* System Health */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>
                Current platform status and metrics. Last checked{" "}
                {isCheckingHealth ? "just now" : "on page load"}
              </CardDescription>
              <div className="mt-4 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => void fetchHealth()} disabled={isCheckingHealth}>
                  {isCheckingHealth ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Refresh Health
                </Button>
                {healthError ? <span className="text-xs text-destructive">{healthError}</span> : null}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-secondary/30 bg-secondary/10 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        healthState === "healthy" ? "bg-secondary" : healthState === "unhealthy" ? "bg-destructive" : "bg-muted-foreground"
                      }`}
                    />
                    <span className="text-sm font-medium text-foreground">
                      API Status {healthState === "unknown" && "(checking...)"}
                    </span>
                  </div>
                  <p
                    className={`text-2xl font-bold ${
                      healthState === "healthy"
                        ? "text-secondary"
                        : healthState === "unhealthy"
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {healthState === "healthy" ? "Operational" : healthState === "unhealthy" ? "Unavailable" : "Pending"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {healthState === "healthy"
                      ? "All endpoints responding"
                      : healthState === "unhealthy"
                        ? "Check backend service on port 9000"
                        : "Awaiting health check response"}
                  </p>
                </div>

                <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-sm font-medium text-foreground">Data Quality</span>
                  </div>
                  <p className="text-2xl font-bold text-primary">98.5%</p>
                  <p className="text-xs text-muted-foreground">Across all runs</p>
                </div>

                <div className="rounded-lg border border-secondary/30 bg-secondary/10 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-secondary" />
                    <span className="text-sm font-medium text-foreground">SLA Compliance</span>
                  </div>
                  <p className="text-2xl font-bold text-secondary">92%</p>
                  <p className="text-xs text-muted-foreground">Meeting targets</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {healthDetails ? (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Health Payload</CardTitle>
                <CardDescription>Latest response from /healthz</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-4 text-xs text-foreground">
                  {JSON.stringify(healthDetails, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ) : null}
        </main>
      </div>
    </div>
  )
}
