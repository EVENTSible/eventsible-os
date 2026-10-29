import { NextRequest, NextResponse } from "next/server";
import { authorizeHqCapability } from "@/lib/hq-auth";
import {
  allowedStudioIssuer,
  issueStudioCapability,
  readPreviewBody,
  studioFrameOrigin,
} from "@/lib/site-studio-preview-session.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin"),
    issuer = request.nextUrl.origin;
  if (
    origin !== issuer ||
    !allowedStudioIssuer(issuer) ||
    !request.headers.get("content-type")?.startsWith("application/json")
  ) {
    return NextResponse.json(
      { error: "preview_denied" },
      { status: 403, headers },
    );
  }
  try {
    const auth = await authorizeHqCapability("system.manage");
    if (!auth.ok || auth.user.app_metadata?.role !== "owner") {
      return NextResponse.json(
        { error: "preview_denied" },
        {
          status: auth.ok ? 403 : auth.reason === "unauthenticated" ? 401 : 403,
          headers,
        },
      );
    }
    const text = await readPreviewBody(request, 1024);
    const input = JSON.parse(text),
      audience = studioFrameOrigin();
    if (!audience || input.audience !== audience)
      throw new Error("Invalid preview audience");
    const result = issueStudioCapability(
      {
        issuer,
        audience,
        channel: input.channel,
        frameNonce: input.frameNonce,
      },
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json(
      { error: "preview_unavailable" },
      { status: 503, headers },
    );
  }
}
