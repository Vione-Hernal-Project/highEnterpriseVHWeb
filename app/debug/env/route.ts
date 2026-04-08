import { NextResponse } from "next/server";

import { getPublicSupabaseEnvError, getPublicSupabaseEnvStatus } from "@/lib/env/public";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    publicEnv: getPublicSupabaseEnvStatus(),
    configError: getPublicSupabaseEnvError(),
  });
}
