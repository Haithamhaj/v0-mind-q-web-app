import { NextResponse } from "next/server";

const DEFAULT_BACKEND = process.env.MINDQ_API_BASE_URL || "http://localhost:9000";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const run = url.searchParams.get("run");
  const path = url.searchParams.get("path");
  const artifactsRoot = url.searchParams.get("artifacts_root");

  if (!run || !path) {
    return NextResponse.json(
      { detail: "Missing required query params: run, path" },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({ path });
  if (artifactsRoot) params.set("artifacts_root", artifactsRoot);

  const backendUrl = `${DEFAULT_BACKEND}/v1/runs/${encodeURIComponent(
    run,
  )}/artifacts/content?${params.toString()}`;

  try {
    const resp = await fetch(backendUrl, { cache: "no-store" });
    const contentType = resp.headers.get("content-type") || "";
    if (!resp.ok) {
      const detail = contentType.includes("application/json")
        ? await resp.json().catch(() => ({ detail: resp.statusText }))
        : await resp.text().catch(() => resp.statusText);
      return NextResponse.json(
        { detail: typeof detail === "string" ? detail : detail.detail || "Upstream error" },
        { status: resp.status },
      );
    }
    if (contentType.includes("application/json")) {
      const data = await resp.json();
      return NextResponse.json(data, { status: 200 });
    }
    const text = await resp.text();
    return new NextResponse(text, {
      status: 200,
      headers: { "content-type": contentType || "text/plain; charset=utf-8" },
    });
  } catch (error) {
    return NextResponse.json(
      { detail: (error as Error).message || "Failed to proxy artifacts content" },
      { status: 502 },
    );
  }
}


