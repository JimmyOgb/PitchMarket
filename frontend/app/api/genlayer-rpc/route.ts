import { NextResponse } from "next/server";

const UPSTREAM_RPC_URL = "https://studio.genlayer.com/api";

type JsonRpcRequest = {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

function rpcError(
  id: unknown,
  code: number,
  message: string,
  status = 400,
) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code, message },
    },
    { status },
  );
}

export async function POST(request: Request) {
  let body: JsonRpcRequest;
  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, "Invalid JSON");
  }

  if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return rpcError(body.id, -32600, "Invalid JSON-RPC request");
  }

  const payload = {
    jsonrpc: "2.0",
    id: body.id ?? null,
    method: body.method,
    params: Array.isArray(body.params) ? body.params : [],
  };

  try {
    const upstreamResponse = await fetch(UPSTREAM_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const responseText = await upstreamResponse.text();
    let responseBody: unknown;

    try {
      responseBody = JSON.parse(responseText);
    } catch {
      return rpcError(
        body.id,
        -32000,
        "GenLayer RPC returned a non-JSON response",
        502,
      );
    }

    return NextResponse.json(responseBody, { status: upstreamResponse.status });
  } catch {
    return rpcError(body.id, -32000, "GenLayer RPC request failed", 502);
  }
}

export function GET() {
  return rpcError(null, -32600, "JSON-RPC POST required", 405);
}
