import { NextRequest, NextResponse } from "next/server";
import {
  exactOrigin,
  readPreviewBody,
  verifyStudioCapability,
} from "@/lib/site-studio-preview-session.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const headers: Record<string, string> = {
    "Cache-Control": "private, no-store, max-age=0",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    const audience = exactOrigin(request.headers.get("origin"));
    const text = await readPreviewBody(request, 2048);
    if (
      !audience ||
      text.length > 2048 ||
      !request.headers.get("content-type")?.startsWith("text/plain")
    )
      throw new Error("Invalid capability");
    const context = verifyStudioCapability(
      text,
      audience,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
    if (!context) throw new Error("Invalid capability");
    // Only the signed exact audience can read this non-secret bootstrap context.
    // The capability grants rendering only; it cannot read drafts, write or publish.
    headers["Access-Control-Allow-Origin"] = audience;
    return NextResponse.json(context, { headers });
  } catch {
    return NextResponse.json(
      { error: "preview_denied" },
      { status: 403, headers },
    );
  }
}
