import { refreshMediaStreamIfStale } from "./stream-store";

const schedulerKey = Symbol.for("dalbitmedia.mediaStreamScheduler");
type SchedulerGlobal = typeof globalThis & { [schedulerKey]?: NodeJS.Timeout };

export function startMediaStreamScheduler() {
  const schedulerGlobal = globalThis as SchedulerGlobal;
  if (schedulerGlobal[schedulerKey]) return;

  void refreshMediaStreamIfStale().catch((error) => console.error("Media stream collection failed", error));
  const timer = setInterval(() => {
    void refreshMediaStreamIfStale().catch((error) => console.error("Media stream collection failed", error));
  }, 30 * 60 * 1000);
  timer.unref();
  schedulerGlobal[schedulerKey] = timer;
}