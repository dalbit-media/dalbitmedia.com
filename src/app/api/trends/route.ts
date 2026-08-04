import { getProperNounTrendData } from "@/lib/stream-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getProperNounTrendData());
}