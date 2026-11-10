import TextUtils from "src/utils/text";

export function formatORecordedToastCustom(videoTimestamp?: number): string {
  if (videoTimestamp === undefined || !Number.isFinite(videoTimestamp)) {
    return "O recorded";
  }

  return `O recorded at ${TextUtils.secondsToTimestamp(videoTimestamp)}`;
}
