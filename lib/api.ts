const API_BASE_URL = "https://x87f1sfx-9000.euw.devtunnels.ms"

export interface PhaseRequest {
  inputs?: Record<string, unknown>
  config?: Record<string, unknown>
  artifacts_root?: string
  use_defaults?: boolean
}

export interface IngestionRequest {
  data_files: string[]
  sla_files?: string[]
  artifacts_root?: string
  config?: Record<string, unknown>
  ingestion_overrides?: Record<string, unknown>
}

export interface PipelineRequest {
  data_files: string[]
  sla_files?: string[]
  artifacts_root?: string
  stop_on_error?: boolean
  llm_summary?: boolean
}

export interface PipelineResponse {
  run_id: string
  phases: Array<Record<string, unknown>>
}

class MindQAPI {
  private baseURL: string

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
    console.log("[v0] MindQAPI initialized with baseURL:", this.baseURL)
  }

  async healthCheck(): Promise<Record<string, unknown>> {
    console.log("[v0] Calling healthCheck endpoint")
    const response = await fetch(`${this.baseURL}/healthz`)
    console.log("[v0] Health check response status:", response.status)
    if (!response.ok) {
      throw new Error("Health check failed")
    }
    const data = await response.json()
    console.log("[v0] Health check data:", data)
    return data
  }

  async runPhase01(runId: string, request: IngestionRequest): Promise<Record<string, unknown>> {
    const url = `${this.baseURL}/v1/runs/${runId}/phases/01/ingestion`
    console.log("[v0] Calling Phase 01 endpoint:", url)
    console.log("[v0] Phase 01 request payload:", request)

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })

    console.log("[v0] Phase 01 response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Phase 01 error response:", errorText)
      throw new Error(`Phase 01 failed: ${response.statusText}`)
    }

    const data = await response.json()
    console.log("[v0] Phase 01 response data:", data)
    return data
  }

  async runPhase(runId: string, phase: string, request: PhaseRequest): Promise<Record<string, unknown>> {
    const phaseMap: Record<string, string> = {
      "02": "quality",
      "03": "schema",
      "04": "profile",
      "05": "missing",
      "06": "standardize",
      "07": "readiness",
      "08": "insights",
      "09": "business-validation",
    }

    const endpoint = phaseMap[phase]
    if (!endpoint) {
      throw new Error(`Invalid phase: ${phase}`)
    }

    const url = `${this.baseURL}/v1/runs/${runId}/phases/${phase}/${endpoint}`
    console.log("[v0] Calling Phase", phase, "endpoint:", url)
    console.log("[v0] Phase", phase, "request payload:", request)

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })

    console.log("[v0] Phase", phase, "response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Phase", phase, "error response:", errorText)
      throw new Error(`Phase ${phase} failed: ${response.statusText}`)
    }

    const data = await response.json()
    console.log("[v0] Phase", phase, "response data:", data)
    return data
  }

  async runFeatureReport(runId: string, request: PhaseRequest): Promise<Record<string, unknown>> {
    const url = `${this.baseURL}/v1/runs/${runId}/phases/07/feature-report`
    console.log("[v0] Calling Feature Report endpoint:", url)
    console.log("[v0] Feature Report request payload:", request)

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })

    console.log("[v0] Feature Report response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Feature Report error response:", errorText)
      throw new Error(`Feature report failed: ${response.statusText}`)
    }

    const data = await response.json()
    console.log("[v0] Feature Report response data:", data)
    return data
  }

  async runLLMSummary(runId: string, request: PhaseRequest): Promise<Record<string, unknown>> {
    const url = `${this.baseURL}/v1/runs/${runId}/phases/07/llm-summary`
    console.log("[v0] Calling LLM Summary endpoint:", url)
    console.log("[v0] LLM Summary request payload:", request)

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })

    console.log("[v0] LLM Summary response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] LLM Summary error response:", errorText)
      throw new Error(`LLM summary failed: ${response.statusText}`)
    }

    const data = await response.json()
    console.log("[v0] LLM Summary response data:", data)
    return data
  }

  async runFullPipeline(runId: string, request: PipelineRequest): Promise<PipelineResponse> {
    const url = `${this.baseURL}/v1/runs/${runId}/pipeline/full`
    console.log("[v0] Calling Full Pipeline endpoint:", url)
    console.log("[v0] Full Pipeline request payload:", request)

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })

    console.log("[v0] Full Pipeline response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Full Pipeline error response:", errorText)
      throw new Error(`Full pipeline failed: ${response.statusText}`)
    }

    const data = await response.json()
    console.log("[v0] Full Pipeline response data:", data)
    return data
  }
}

export const api = new MindQAPI()
