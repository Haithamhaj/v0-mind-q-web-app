"use client"

import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle2, AlertTriangle, XCircle, TrendingUp, TrendingDown, Minus } from "lucide-react"

const slaMetrics = [
  {
    category: "Delivery Performance",
    metrics: [
      {
        name: "On-Time Delivery Rate",
        actual: 94.5,
        target: 90,
        unit: "%",
        status: "pass",
        trend: "up",
        change: 2.3,
      },
      {
        name: "Average Delivery Time",
        actual: 2.8,
        target: 3.0,
        unit: "days",
        status: "pass",
        trend: "down",
        change: -0.2,
      },
      {
        name: "Delivery Accuracy",
        actual: 98.2,
        target: 98,
        unit: "%",
        status: "pass",
        trend: "up",
        change: 0.5,
      },
    ],
  },
  {
    category: "Cost Efficiency",
    metrics: [
      {
        name: "Cost per Mile",
        actual: 2.34,
        target: 2.5,
        unit: "$",
        status: "pass",
        trend: "down",
        change: -0.08,
      },
      {
        name: "Fuel Efficiency",
        actual: 7.2,
        target: 7.0,
        unit: "mpg",
        status: "pass",
        trend: "up",
        change: 0.3,
      },
      {
        name: "Operating Cost Ratio",
        actual: 87.2,
        target: 85,
        unit: "%",
        status: "warn",
        trend: "up",
        change: 1.2,
      },
    ],
  },
  {
    category: "Quality & Compliance",
    metrics: [
      {
        name: "Customer Satisfaction",
        actual: 88,
        target: 90,
        unit: "%",
        status: "warn",
        trend: "down",
        change: -1.5,
      },
      {
        name: "Damage Rate",
        actual: 0.8,
        target: 1.0,
        unit: "%",
        status: "pass",
        trend: "down",
        change: -0.1,
      },
      {
        name: "Compliance Score",
        actual: 96.8,
        target: 95,
        unit: "%",
        status: "pass",
        trend: "up",
        change: 1.2,
      },
    ],
  },
]

const slaDocuments = [
  {
    id: "SLA_2024_Q1",
    name: "Q1 2024 Service Level Agreement",
    status: "active",
    compliance: 92,
    terms: 12,
    passed: 10,
    warned: 2,
    failed: 0,
  },
  {
    id: "SLA_2024_Q2",
    name: "Q2 2024 Service Level Agreement",
    status: "active",
    compliance: 88,
    terms: 15,
    passed: 12,
    warned: 2,
    failed: 1,
  },
  {
    id: "SLA_2023_Q4",
    name: "Q4 2023 Service Level Agreement",
    status: "completed",
    compliance: 95,
    terms: 12,
    passed: 11,
    warned: 1,
    failed: 0,
  },
]

export default function SLAPage() {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="h-5 w-5 text-secondary" />
      case "warn":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case "fail":
        return <XCircle className="h-5 w-5 text-destructive" />
      default:
        return null
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-secondary" />
      case "down":
        return <TrendingDown className="h-4 w-4 text-destructive" />
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />
    }
  }

  const overallCompliance =
    slaMetrics.reduce((acc, cat) => {
      const passed = cat.metrics.filter((m) => m.status === "pass").length
      return acc + passed
    }, 0) / slaMetrics.reduce((acc, cat) => acc + cat.metrics.length, 0)

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">SLA Compliance Tracking</h1>
              <p className="text-muted-foreground">Monitor service level agreements and performance metrics</p>
            </div>

            {/* Overall Compliance */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-secondary/20 bg-gradient-to-br from-card to-secondary/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overall Compliance</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-secondary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{(overallCompliance * 100).toFixed(1)}%</div>
                  <Progress value={overallCompliance * 100} className="mt-2" />
                  <p className="mt-2 text-xs text-muted-foreground">Across all SLA terms</p>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active SLAs</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {slaDocuments.filter((d) => d.status === "active").length}
                  </div>
                  <p className="text-xs text-muted-foreground">Currently monitored</p>
                </CardContent>
              </Card>

              <Card className="border-muted/20 bg-gradient-to-br from-card to-muted/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Terms Tracked</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {slaMetrics.reduce((acc, cat) => acc + cat.metrics.length, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Performance indicators</p>
                </CardContent>
              </Card>
            </div>

            {/* SLA Documents */}
            <Card>
              <CardHeader>
                <CardTitle>SLA Documents</CardTitle>
                <CardDescription>Active and historical service level agreements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {slaDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-4"
                    >
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-3">
                          <h3 className="font-semibold text-foreground">{doc.name}</h3>
                          <Badge
                            variant="outline"
                            className={doc.status === "active" ? "bg-primary/10" : "bg-muted/10"}
                          >
                            {doc.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4 text-secondary" />
                            {doc.passed} passed
                          </span>
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            {doc.warned} warned
                          </span>
                          {doc.failed > 0 && (
                            <span className="flex items-center gap-1">
                              <XCircle className="h-4 w-4 text-destructive" />
                              {doc.failed} failed
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-foreground">{doc.compliance}%</div>
                        <p className="text-xs text-muted-foreground">Compliance</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Metrics by Category */}
            <Tabs defaultValue="delivery" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="delivery">Delivery</TabsTrigger>
                <TabsTrigger value="cost">Cost</TabsTrigger>
                <TabsTrigger value="quality">Quality</TabsTrigger>
              </TabsList>

              {slaMetrics.map((category, catIndex) => (
                <TabsContent key={catIndex} value={category.category.toLowerCase().split(" ")[0]} className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>{category.category}</CardTitle>
                      <CardDescription>Performance metrics and targets</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {category.metrics.map((metric, metricIndex) => (
                          <div
                            key={metricIndex}
                            className="rounded-lg border border-border bg-gradient-to-r from-card to-card/50 p-4"
                          >
                            <div className="mb-3 flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                {getStatusIcon(metric.status)}
                                <div>
                                  <h4 className="font-semibold text-foreground">{metric.name}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    Target: {metric.target}
                                    {metric.unit}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {getTrendIcon(metric.trend)}
                                <span
                                  className={`text-sm font-medium ${
                                    metric.trend === "up" && metric.change > 0
                                      ? "text-secondary"
                                      : metric.trend === "down" && metric.change < 0
                                        ? "text-secondary"
                                        : "text-muted-foreground"
                                  }`}
                                >
                                  {metric.change > 0 ? "+" : ""}
                                  {metric.change}
                                  {metric.unit}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Current Performance</span>
                                <span className="font-mono font-semibold text-foreground">
                                  {metric.actual}
                                  {metric.unit}
                                </span>
                              </div>
                              <Progress
                                value={Math.min((metric.actual / metric.target) * 100, 100)}
                                className={
                                  metric.status === "pass"
                                    ? "[&>div]:bg-secondary"
                                    : metric.status === "warn"
                                      ? "[&>div]:bg-yellow-500"
                                      : "[&>div]:bg-destructive"
                                }
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>

            {/* Historical Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Compliance Trends</CardTitle>
                <CardDescription>Historical performance over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-border bg-gradient-to-br from-secondary/10 to-transparent p-4">
                      <h4 className="mb-2 font-semibold text-foreground">Best Performing</h4>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center justify-between">
                          <span className="text-muted-foreground">Delivery Accuracy</span>
                          <span className="font-semibold text-secondary">98.2%</span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span className="text-muted-foreground">Compliance Score</span>
                          <span className="font-semibold text-secondary">96.8%</span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span className="text-muted-foreground">On-Time Delivery</span>
                          <span className="font-semibold text-secondary">94.5%</span>
                        </li>
                      </ul>
                    </div>

                    <div className="rounded-lg border border-border bg-gradient-to-br from-yellow-500/10 to-transparent p-4">
                      <h4 className="mb-2 font-semibold text-foreground">Needs Attention</h4>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center justify-between">
                          <span className="text-muted-foreground">Customer Satisfaction</span>
                          <span className="font-semibold text-yellow-500">88%</span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span className="text-muted-foreground">Operating Cost Ratio</span>
                          <span className="font-semibold text-yellow-500">87.2%</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
