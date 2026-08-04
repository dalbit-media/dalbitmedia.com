import { getStoredStreamPage } from "@/lib/stream-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const filter = searchParams.get("filter") || undefined;
  const cursor = searchParams.get("cursor") || undefined;
  const search = searchParams.get("q")?.trim().slice(0, 100) || undefined;
  const tag = searchParams.get("tag")?.trim().slice(0, 100) || undefined;
  return Response.json(getStoredStreamPage({ filter, cursor, search, tag, limit: 24 }));
}