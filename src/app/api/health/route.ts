import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "EVENTSible OS Admin",
    timestamp: new Date().toISOString(),
  });
}
