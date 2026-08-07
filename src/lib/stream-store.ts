import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { calculateTrendScore, canonicalStreamUrl, collectMediaStream, isIndexedItem, isRankedItem, normalizedStreamTitle, youtubeChannelNames, TOTAL_SOURCE_COUNT, STREAM_REVALIDATE_SECONDS, type Platform, type StreamItem, type TrendMetric } from "./media-stream";
import { extractProperNouns, koreanProperNounSeeds, normalizeProperNoun, type ProperNounMatch } from "./korean-proper-nouns";

export type StoredProperNoun = {
  normalized: string;
  displayName: string;
};

export type StoredStreamItem = StreamItem & {
  batchId: number;
  collectedAt: string;
  sourceScore: number;
  tags: StoredProperNoun[];
};

export type SourceSummary = {
  source: string;
  platform: Platform;
  count: number;
};

export type StoredStreamPage = {
  items: StoredStreamItem[];
  nextCursor: string | null;
  sources: SourceSummary[];
  updatedAt: string | null;
  activeSources: number;
  totalSources: number;
  inactiveSources: string[];
};

export type ProperNounTrend = StoredProperNoun & {
  count: number;
  sourceCount: number;
  latestAt: string;
  rankChange?: number | "new";
};

export type ProperNounTrendData = {
  trackedSince: string;
  updatedAt: string | null;
  windows: {
    realtime: ProperNounTrend[];
    day: ProperNounTrend[];
    week: ProperNounTrend[];
    month: ProperNounTrend[];
    quarter: ProperNounTrend[];
    half: ProperNounTrend[];
  };
  history: Array<{
    month: string;
    keywords: ProperNounTrend[];
  }>;
};

type ItemRow = {
  row_id: number;
  item_id: string;
  batch_id: number;
  platform: Platform;
  source: string;
  title: string;
  url: string;
  published_at: string;
  image: string | null;
  description: string | null;
  trend_score: number;
  trend_metrics: string;
  collected_at: string;
};

type Cursor = {
  publishedAt: string;
  rowId: number;
};

const databaseDirectory = path.join(process.cwd(), "data");
const databasePath = path.join(databaseDirectory, "media-stream.sqlite");
let database: DatabaseSync | undefined;
let refreshPromise: Promise<void> | undefined;

function getDatabase() {
  if (database) return database;
  fs.mkdirSync(databaseDirectory, { recursive: true });
  database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS stream_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collected_at TEXT NOT NULL,
      active_sources INTEGER NOT NULL,
      total_sources INTEGER NOT NULL,
      inactive_sources TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS stream_items (
      id TEXT PRIMARY KEY,
      batch_id INTEGER NOT NULL REFERENCES stream_batches(id),
      platform TEXT NOT NULL,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      published_at TEXT NOT NULL,
      image TEXT,
      description TEXT,
      trend_score INTEGER NOT NULL,
      trend_metrics TEXT NOT NULL,
      collected_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS proper_nouns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      normalized TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      is_seeded INTEGER NOT NULL DEFAULT 0,
      seed_rank INTEGER,
      seed_views INTEGER,
      first_seen_at TEXT,
      last_seen_at TEXT
    );
    CREATE TABLE IF NOT EXISTS proper_noun_occurrences (
      item_id TEXT NOT NULL,
      proper_noun_id INTEGER NOT NULL REFERENCES proper_nouns(id),
      observed_at TEXT NOT NULL,
      published_at TEXT NOT NULL,
      source TEXT NOT NULL,
      PRIMARY KEY (item_id, proper_noun_id)
    );
    CREATE TABLE IF NOT EXISTS stream_engine_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS stream_items_order_idx ON stream_items(batch_id DESC, trend_score DESC);
    CREATE INDEX IF NOT EXISTS stream_items_source_idx ON stream_items(source, batch_id DESC, trend_score DESC);
    CREATE INDEX IF NOT EXISTS stream_items_platform_idx ON stream_items(platform, batch_id DESC, trend_score DESC);
    CREATE INDEX IF NOT EXISTS stream_items_recent_idx ON stream_items(published_at DESC);
    CREATE INDEX IF NOT EXISTS proper_noun_occurrences_time_idx ON proper_noun_occurrences(observed_at DESC, proper_noun_id);
    CREATE INDEX IF NOT EXISTS proper_noun_occurrences_noun_time_idx ON proper_noun_occurrences(proper_noun_id, observed_at DESC);
  `);
  const itemColumns = database.prepare("PRAGMA table_info(stream_items)").all() as Array<{ name: string }>;
  if (!itemColumns.some((column) => column.name === "description")) database.exec("ALTER TABLE stream_items ADD COLUMN description TEXT");
  const batchColumns = database.prepare("PRAGMA table_info(stream_batches)").all() as Array<{ name: string }>;
  if (!batchColumns.some((column) => column.name === "inactive_sources")) database.exec("ALTER TABLE stream_batches ADD COLUMN inactive_sources TEXT NOT NULL DEFAULT '[]'");
  cleanStoredItems(database);
  initializeProperNounEngine(database);
  return database;
}

function recordProperNouns(db: DatabaseSync, itemId: string, publishedAt: string, source: string, observedAt: string, matches: ProperNounMatch[]) {
  const insertNoun = db.prepare(`
    INSERT INTO proper_nouns (normalized, display_name, is_seeded, seed_rank, seed_views)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(normalized) DO UPDATE SET
      display_name = CASE WHEN excluded.is_seeded = 1 THEN excluded.display_name ELSE display_name END,
      is_seeded = MAX(is_seeded, excluded.is_seeded),
      seed_rank = COALESCE(excluded.seed_rank, seed_rank),
      seed_views = COALESCE(excluded.seed_views, seed_views)
  `);
  const findNoun = db.prepare("SELECT id FROM proper_nouns WHERE normalized = ?");
  const insertOccurrence = db.prepare(`
    INSERT OR IGNORE INTO proper_noun_occurrences (item_id, proper_noun_id, observed_at, published_at, source)
    VALUES (?, ?, ?, ?, ?)
  `);
  const markSeen = db.prepare(`
    UPDATE proper_nouns SET first_seen_at = COALESCE(first_seen_at, ?), last_seen_at = ? WHERE id = ?
  `);

  for (const match of matches) {
    insertNoun.run(match.normalized, match.displayName, Number(match.seeded), match.seedRank ?? null, match.seedViews ?? null);
    const noun = findNoun.get(match.normalized) as { id: number };
    const result = insertOccurrence.run(itemId, noun.id, observedAt, publishedAt, source);
    if (result.changes > 0) markSeen.run(observedAt, observedAt, noun.id);
  }
}

function initializeProperNounEngine(db: DatabaseSync) {
  const engineVersion = "7";
  const insertSeed = db.prepare(`
    INSERT INTO proper_nouns (normalized, display_name, is_seeded, seed_rank, seed_views)
    VALUES (?, ?, 1, ?, ?) ON CONFLICT(normalized) DO UPDATE SET
      display_name = excluded.display_name, is_seeded = 1, seed_rank = excluded.seed_rank, seed_views = excluded.seed_views
  `);
  const getMetadata = db.prepare("SELECT value FROM stream_engine_metadata WHERE key = ?");
  const setMetadata = db.prepare("INSERT OR REPLACE INTO stream_engine_metadata (key, value) VALUES (?, ?)");
  const startedAt = (getMetadata.get("proper_noun_tracking_started_at") as { value: string } | undefined)?.value ?? new Date().toISOString();

  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("UPDATE proper_nouns SET is_seeded = 0, seed_rank = NULL, seed_views = NULL");
    for (const seed of koreanProperNounSeeds) insertSeed.run(normalizeProperNoun(seed.name), seed.name, seed.rank, seed.views);
    setMetadata.run("proper_noun_tracking_started_at", startedAt);
    const storedVersion = (getMetadata.get("proper_noun_engine_version") as { value: string } | undefined)?.value;
    if (storedVersion !== engineVersion) {
      db.exec(`
        DELETE FROM proper_noun_occurrences WHERE proper_noun_id IN (SELECT id FROM proper_nouns WHERE is_seeded = 0);
        DELETE FROM proper_nouns WHERE is_seeded = 0;
      `);
    }
    if (!getMetadata.get("proper_noun_backfill_complete") || storedVersion !== engineVersion) {
      const rows = db.prepare("SELECT id, title, description, published_at, source FROM stream_items").all() as Array<{ id: string; title: string; description: string | null; published_at: string; source: string }>;
      const matchesByItem = extractProperNouns(rows.map((row) => ({ id: row.id, title: row.title, description: row.description ?? undefined })));
      for (const row of rows) recordProperNouns(db, row.id, row.published_at, row.source, startedAt, matchesByItem.get(row.id) ?? []);
      setMetadata.run("proper_noun_backfill_complete", startedAt);
      setMetadata.run("proper_noun_engine_version", engineVersion);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function cleanStoredItems(db: DatabaseSync) {
  const rows = db.prepare(`
    SELECT rowid AS row_id, url, title, published_at, trend_score, trend_metrics
    FROM stream_items ORDER BY published_at DESC, rowid DESC
  `).all() as Array<Pick<ItemRow, "row_id" | "url" | "title" | "published_at" | "trend_score" | "trend_metrics">>;
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const removeRow = db.prepare("DELETE FROM stream_items WHERE rowid = ?");
  const updateScore = db.prepare("UPDATE stream_items SET trend_score = ? WHERE rowid = ?");
  const updatePublishedAt = db.prepare("UPDATE stream_items SET published_at = ? WHERE rowid = ?");

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const row of rows) {
      const metrics = JSON.parse(row.trend_metrics) as TrendMetric[];
      const url = canonicalStreamUrl(row.url);
      const title = normalizedStreamTitle(row.title);
      if (metrics.some((metric) => metric.label === "피드 순위") || seenUrls.has(url) || seenTitles.has(title)) {
        removeRow.run(row.row_id);
        continue;
      }
      const score = calculateTrendScore(metrics, row.published_at);
      if (score < 35 && !isRankedItem(metrics) && !isIndexedItem(metrics)) {
        removeRow.run(row.row_id);
        continue;
      }
      seenUrls.add(url);
      seenTitles.add(title);
      const publishedAt = new Date(row.published_at).toISOString();
      if (publishedAt !== row.published_at) updatePublishedAt.run(publishedAt, row.row_id);
      if (score !== row.trend_score) updateScore.run(score, row.row_id);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string | undefined): Cursor | null {
  if (!value) return null;
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Cursor;
    return typeof cursor.publishedAt === "string" && !Number.isNaN(Date.parse(cursor.publishedAt)) && Number.isInteger(cursor.rowId) ? cursor : null;
  } catch {
    return null;
  }
}

function rowToItem(row: ItemRow, tags: StoredProperNoun[], sourceScore: number): StoredStreamItem {
  return {
    id: String(row.row_id),
    batchId: row.batch_id,
    platform: row.platform,
    source: row.source,
    title: row.title,
    url: row.url,
    publishedAt: row.published_at,
    image: row.image ?? undefined,
    description: row.description ?? undefined,
    trendScore: row.trend_score,
    trendMetrics: JSON.parse(row.trend_metrics) as TrendMetric[],
    collectedAt: row.collected_at,
    sourceScore,
    tags,
  };
}

function getSourceScores(db: DatabaseSync) {
  const rows = db.prepare(`
    SELECT id AS item_id, source, trend_score, trend_metrics, published_at
    FROM stream_items
  `).all() as Array<Pick<ItemRow, "item_id" | "source" | "trend_score" | "trend_metrics" | "published_at">>;
  const sourceRows = new Map<string, typeof rows>();
  for (const row of rows) sourceRows.set(row.source, [...(sourceRows.get(row.source) ?? []), row]);

  const scores = new Map<string, number>();
  for (const items of sourceRows.values()) {
    items.sort((left, right) => {
      const leftRank = (JSON.parse(left.trend_metrics) as TrendMetric[]).find((metric) => metric.label === "인기 순위" || metric.label === "조회 순위")?.value ?? Number.POSITIVE_INFINITY;
      const rightRank = (JSON.parse(right.trend_metrics) as TrendMetric[]).find((metric) => metric.label === "인기 순위" || metric.label === "조회 순위")?.value ?? Number.POSITIVE_INFINITY;
      return right.trend_score - left.trend_score || leftRank - rightRank || Date.parse(right.published_at) - Date.parse(left.published_at);
    });
    items.forEach((item, index) => {
      const percentile = items.length === 1 ? 100 : 100 - (index / (items.length - 1)) * 95;
      scores.set(item.item_id, Math.max(5, Math.min(100, Math.round(percentile / 5) * 5)));
    });
  }
  return scores;
}

function getLatestBatch() {
  return getDatabase().prepare(`
    SELECT id, collected_at, active_sources, total_sources, inactive_sources
    FROM stream_batches ORDER BY id DESC LIMIT 1
  `).get() as { id: number; collected_at: string; active_sources: number; total_sources: number; inactive_sources: string } | undefined;
}

async function runCollection() {
  const stream = await collectMediaStream();
  const db = getDatabase();
  const sourceCounts = new Map<string, number>();
  const selectedItems = stream.items.filter((item) => {
    const count = sourceCounts.get(item.source) ?? 0;
    if (count >= 8) return false;
    sourceCounts.set(item.source, count + 1);
    return true;
  });
  const properNounsByItem = extractProperNouns(selectedItems);
  const existingRows = db.prepare("SELECT rowid AS row_id, id, url, title FROM stream_items").all() as Array<{ row_id: number; id: string; url: string; title: string }>;
  const rowsById = new Map(existingRows.map((row) => [row.id, row]));
  const rowsByUrl = new Map(existingRows.map((row) => [canonicalStreamUrl(row.url), row]));
  const rowsByTitle = new Map(existingRows.map((row) => [normalizedStreamTitle(row.title), row]));
  db.exec("BEGIN IMMEDIATE");
  try {
    const batchResult = db.prepare(`
      INSERT INTO stream_batches (collected_at, active_sources, total_sources, inactive_sources) VALUES (?, ?, ?, ?)
    `).run(stream.updatedAt, stream.activeSources, stream.totalSources, JSON.stringify(stream.inactiveSources));
    const batchId = Number(batchResult.lastInsertRowid);
    const insertItem = db.prepare(`
      INSERT INTO stream_items
      (id, batch_id, platform, source, title, url, published_at, image, description, trend_score, trend_metrics, collected_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateItem = db.prepare(`
      UPDATE stream_items SET batch_id = ?, platform = ?, source = ?, title = ?, url = ?, published_at = ?,
        image = ?, description = ?, trend_score = ?, trend_metrics = ?, collected_at = ? WHERE rowid = ?
    `);
    const removeSupersededSnapshotItems = db.prepare("DELETE FROM stream_items WHERE source = ? AND batch_id <> ?");

    for (const item of selectedItems) {
      const existing = rowsById.get(item.id) ?? rowsByUrl.get(item.url) ?? rowsByTitle.get(normalizedStreamTitle(item.title));
      const values = [batchId, item.platform, item.source, item.title, item.url, item.publishedAt, item.image ?? null, item.description ?? null, item.trendScore, JSON.stringify(item.trendMetrics), stream.updatedAt] as const;
      if (existing) {
        updateItem.run(...values, existing.row_id);
        recordProperNouns(db, existing.id, item.publishedAt, item.source, stream.updatedAt, properNounsByItem.get(item.id) ?? []);
      } else {
        const result = insertItem.run(item.id, ...values);
        const row = { row_id: Number(result.lastInsertRowid), id: item.id, url: item.url, title: item.title };
        rowsById.set(item.id, row);
        rowsByUrl.set(item.url, row);
        rowsByTitle.set(normalizedStreamTitle(item.title), row);
        recordProperNouns(db, item.id, item.publishedAt, item.source, stream.updatedAt, properNounsByItem.get(item.id) ?? []);
      }
    }
    const snapshotSources = new Set(selectedItems.filter((item) => isRankedItem(item.trendMetrics) || isIndexedItem(item.trendMetrics)).map((item) => item.source));
    for (const source of snapshotSources) removeSupersededSnapshotItems.run(source, batchId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function refreshMediaStreamIfStale(force = false) {
  const latest = getLatestBatch();
  const isFresh = latest && Date.now() - Date.parse(latest.collected_at) < STREAM_REVALIDATE_SECONDS * 1000;
  if (!force && isFresh) return;
  if (!refreshPromise) {
    refreshPromise = runCollection().finally(() => {
      refreshPromise = undefined;
    });
  }
  await refreshPromise;
}

export function getSourceSummaries(): SourceSummary[] {
  const rows = getDatabase().prepare(`
    SELECT source, platform, COUNT(*) AS count
    FROM stream_items
    GROUP BY source, platform
  `).all() as Array<{ source: string; platform: Platform; count: number }>;

  return rows
    .map((row) => ({ ...row, count: Number(row.count) }))
    .sort((left, right) => {
      const leftKorean = left.platform === "국내 커뮤니티" ? 1 : 0;
      const rightKorean = right.platform === "국내 커뮤니티" ? 1 : 0;
      return rightKorean - leftKorean || right.count - left.count || left.source.localeCompare(right.source, "ko");
    });
}

export function getStoredStreamPage(options: { cursor?: string; filter?: string; search?: string; tag?: string; limit?: number } = {}): StoredStreamPage {
  const db = getDatabase();
  const cursor = decodeCursor(options.cursor);
  const limit = Math.min(48, Math.max(1, options.limit ?? 24));
  const conditions: string[] = [];
  const parameters: Array<string | number> = [];

  if (options.filter) {
    const platformFilters: Platform[] = ["YouTube", "Instagram", "TikTok", "X", "Facebook", "검색 트렌드", "국내 뉴스"];
    if (platformFilters.includes(options.filter as Platform)) {
      conditions.push("platform = ?");
    } else {
      conditions.push("source = ?");
    }
    parameters.push(options.filter);
  }
  if (options.search) {
    const search = `%${options.search.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push("(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR source LIKE ? ESCAPE '\\' OR platform LIKE ? ESCAPE '\\')");
    parameters.push(search, search, search, search);
  }
  if (options.tag) {
    conditions.push(`EXISTS (
      SELECT 1 FROM proper_noun_occurrences occurrence
      JOIN proper_nouns noun ON noun.id = occurrence.proper_noun_id
      WHERE occurrence.item_id = stream_items.id AND noun.normalized = ?
    )`);
    parameters.push(normalizeProperNoun(options.tag));
  }
  if (cursor) {
    conditions.push("(published_at < ? OR (published_at = ? AND rowid < ?))");
    parameters.push(cursor.publishedAt, cursor.publishedAt, cursor.rowId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db.prepare(`
    SELECT rowid AS row_id, id AS item_id, batch_id, platform, source, title, url, published_at, image, description,
      trend_score, trend_metrics, collected_at
    FROM stream_items
    ${where}
    ORDER BY published_at DESC, rowid DESC
    LIMIT ?
  `).all(...parameters, limit + 1) as unknown as ItemRow[];
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const lastRow = pageRows.at(-1);
  const latest = getLatestBatch();
  const sourceScores = getSourceScores(db);
  const tagsByItem = new Map<string, StoredProperNoun[]>();
  if (pageRows.length > 0) {
    const placeholders = pageRows.map(() => "?").join(",");
    const tagRows = db.prepare(`
      SELECT occurrence.item_id, noun.normalized, noun.display_name
      FROM proper_noun_occurrences occurrence
      JOIN proper_nouns noun ON noun.id = occurrence.proper_noun_id
      WHERE occurrence.item_id IN (${placeholders})
      ORDER BY noun.is_seeded DESC, noun.seed_rank ASC, noun.display_name
    `).all(...pageRows.map((row) => row.item_id)) as Array<{ item_id: string; normalized: string; display_name: string }>;
    for (const tag of tagRows) {
      const itemTags = tagsByItem.get(tag.item_id) ?? [];
      itemTags.push({ normalized: tag.normalized, displayName: tag.display_name });
      tagsByItem.set(tag.item_id, itemTags);
    }
  }

  return {
    items: pageRows.map((row) => rowToItem(row, tagsByItem.get(row.item_id) ?? [], sourceScores.get(row.item_id) ?? 5)),
    nextCursor: hasMore && lastRow ? encodeCursor({ publishedAt: lastRow.published_at, rowId: lastRow.row_id }) : null,
    sources: getSourceSummaries(),
    updatedAt: latest?.collected_at ?? null,
    activeSources: latest?.active_sources ?? 0,
    totalSources: TOTAL_SOURCE_COUNT,
    inactiveSources: (() => {
      const raw = latest ? JSON.parse(latest.inactive_sources) as string[] : [];
      // Normalize legacy per-channel YouTube entries into a single "YouTube" entry
      const hasYoutubeInactive = raw.some((n) => youtubeChannelNames.has(n));
      return [...raw.filter((n) => !youtubeChannelNames.has(n)), ...(hasYoutubeInactive ? ["YouTube"] : [])];
    })(),
  };
}

function getProperNounTrendsSince(db: DatabaseSync, since: string, limit: number, minimumSources = 1): ProperNounTrend[] {
  const rows = db.prepare(`
    SELECT noun.normalized, noun.display_name, COUNT(*) AS count,
      COUNT(DISTINCT occurrence.source) AS source_count, MAX(occurrence.observed_at) AS latest_at
    FROM proper_noun_occurrences occurrence
    JOIN proper_nouns noun ON noun.id = occurrence.proper_noun_id
    WHERE occurrence.observed_at >= ?
    GROUP BY noun.id
    HAVING COUNT(DISTINCT occurrence.source) >= ?
    ORDER BY count DESC, source_count DESC, latest_at DESC, noun.seed_rank ASC
    LIMIT ?
  `).all(since, minimumSources, limit) as Array<{ normalized: string; display_name: string; count: number; source_count: number; latest_at: string }>;
  return rows.map((row) => ({
    normalized: row.normalized,
    displayName: row.display_name,
    count: Number(row.count),
    sourceCount: Number(row.source_count),
    latestAt: row.latest_at,
  }));
}

function applyRankChanges(current: ProperNounTrend[], previous: ProperNounTrend[]): ProperNounTrend[] {
  const prevRank = new Map(previous.map((t, i) => [t.normalized, i + 1]));
  return current.map((t, i) => ({
    ...t,
    rankChange: prevRank.has(t.normalized) ? prevRank.get(t.normalized)! - (i + 1) : "new",
  }));
}

export function getProperNounTrendData(now = new Date()): ProperNounTrendData {
  const db = getDatabase();
  const tracking = db.prepare("SELECT value FROM stream_engine_metadata WHERE key = 'proper_noun_tracking_started_at'").get() as { value: string };
  const latest = getLatestBatch();
  const since = (milliseconds: number) => new Date(now.getTime() - milliseconds).toISOString();
  const latestOccurrence = db.prepare("SELECT MAX(observed_at) AS observed_at FROM proper_noun_occurrences").get() as { observed_at: string | null };
  const realtimeSince = latestOccurrence.observed_at
    ? new Date(new Date(latestOccurrence.observed_at).getTime() - 6 * 60 * 60_000).toISOString()
    : since(6 * 60 * 60_000);
  const startMonth = new Date(now);
  startMonth.setUTCDate(1);
  startMonth.setUTCHours(0, 0, 0, 0);
  startMonth.setUTCMonth(startMonth.getUTCMonth() - 11);
  const historyRows = db.prepare(`
    SELECT substr(occurrence.observed_at, 1, 7) AS month, noun.normalized, noun.display_name,
      COUNT(*) AS count, COUNT(DISTINCT occurrence.source) AS source_count, MAX(occurrence.observed_at) AS latest_at
    FROM proper_noun_occurrences occurrence
    JOIN proper_nouns noun ON noun.id = occurrence.proper_noun_id
    WHERE occurrence.observed_at >= ?
    GROUP BY month, noun.id
    HAVING COUNT(DISTINCT occurrence.source) >= 2
    ORDER BY month ASC, count DESC, source_count DESC, latest_at DESC
  `).all(startMonth.toISOString()) as Array<{ month: string; normalized: string; display_name: string; count: number; source_count: number; latest_at: string }>;
  const historyMap = new Map<string, ProperNounTrend[]>();
  for (const row of historyRows) {
    const keywords = historyMap.get(row.month) ?? [];
    if (keywords.length < 8) keywords.push({ normalized: row.normalized, displayName: row.display_name, count: Number(row.count), sourceCount: Number(row.source_count), latestAt: row.latest_at });
    historyMap.set(row.month, keywords);
  }

  const raw = {
    realtime: getProperNounTrendsSince(db, realtimeSince, 20),
    day: getProperNounTrendsSince(db, since(24 * 60 * 60_000), 20, 2),
    week: getProperNounTrendsSince(db, since(7 * 24 * 60 * 60_000), 20, 2),
    month: getProperNounTrendsSince(db, since(30 * 24 * 60 * 60_000), 20, 2),
    quarter: getProperNounTrendsSince(db, since(90 * 24 * 60 * 60_000), 20, 2),
    half: getProperNounTrendsSince(db, since(180 * 24 * 60 * 60_000), 20, 2),
  };
  return {
    trackedSince: tracking.value,
    updatedAt: latest?.collected_at ?? null,
    windows: {
      realtime: applyRankChanges(raw.realtime, raw.day),
      day: applyRankChanges(raw.day, raw.week),
      week: applyRankChanges(raw.week, raw.month),
      month: applyRankChanges(raw.month, raw.quarter),
      quarter: applyRankChanges(raw.quarter, raw.half),
      half: raw.half,
    },
    history: [...historyMap].map(([month, keywords]) => ({ month, keywords })),
  };
}