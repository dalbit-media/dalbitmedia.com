import { getStoredStreamPage } from "@/lib/stream-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const filter = searchParams.get("filter") || undefined;
  const cursor = searchParams.get("cursor") || undefined;
  const search = searchParams.get("q")?.trim().slice(0, 100) || undefined;
  const tag = searchParams.get("tag")?.trim().slice(0, 100) || undefined;
  const sort = searchParams.get("sort") === "trending" ? "trending" : "newest";
  const periodParam = searchParams.get("period");
  const period = periodParam && ["day", "week", "month", "season", "year", "all"].includes(periodParam)
    ? (periodParam as "day" | "week" | "month" | "season" | "year" | "all")
    : undefined;
  return Response.json(getStoredStreamPage({ filter, cursor, search, tag, sort, period, limit: 24 }));
}