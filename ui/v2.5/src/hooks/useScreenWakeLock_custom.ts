import { useEffect } from "react";

interface IWakeLockSentinelCustom {
  released: boolean;
  release(): Promise<void>;
}

interface IWakeLockNavigatorCustom {
  wakeLock?: { request(type: "screen"): Promise<IWakeLockSentinelCustom> };
}

// Keeps the screen on while `active`. The browser drops the lock whenever the
// page is hidden, so it is requested again when the page becomes visible.
// Wake Lock needs a secure context (HTTPS or localhost); elsewhere this is a
// no-op.
export function useScreenWakeLockCustom(active: boolean) {
  useEffect(() => {
    const { wakeLock } = navigator as Navigator & IWakeLockNavigatorCustom;
    if (!active || !wakeLock) return;

    let sentinel: IWakeLockSentinelCustom | undefined;
    let cancelled = false;

    const request = () => {
      if (document.visibilityState !== "visible") return;
      if (sentinel && !sentinel.released) return;
      wakeLock
        .request("screen")
        .then((lock) => {
          if (cancelled) lock.release().catch(() => {});
          else sentinel = lock;
        })
        .catch(() => {});
    };

    request();
    document.addEventListener("visibilitychange", request);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", request);
      sentinel?.release().catch(() => {});
    };
  }, [active]);
}
