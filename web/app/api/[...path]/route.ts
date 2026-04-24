import { NextRequest } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

async function forward(req: NextRequest, params: { path: string[] }) {
  const path = params.path.join("/");
  const url = `${API_BASE_URL}/${path}${req.nextUrl.search}`;
  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers: Object.fromEntries(
      [...req.headers.entries()].filter(
        ([k]) =>
          !["host", "connection", "content-length", "expect", "transfer-encoding", "keep-alive"].includes(
            k.toLowerCase(),
          ),
      ),
    ),
    cache: "no-store",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    // Forward the raw body as bytes. `.arrayBuffer()` keeps multipart uploads
    // and any other binary payload intact. Using `req.body` + duplex would also
    // work but requires extra flags that vary by runtime.
    init.body = await req.arrayBuffer();
  }
  const upstream = await fetch(url, init);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, await ctx.params);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, await ctx.params);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, await ctx.params);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, await ctx.params);
}
