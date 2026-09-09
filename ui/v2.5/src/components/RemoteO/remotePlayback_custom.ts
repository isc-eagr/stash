export type PlaybackSnapshot = {
  scene_id: string;
  scene_title: string;
  video_timestamp: number;
  duration: number;
  playback_rate: number;
  status: string;
};

export function remoteIdCustom(): string {
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    ""
  );
}

export function remotePlayerIdCustom(): string {
  const key = "stash.remoteO.player";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = remoteIdCustom();
  localStorage.setItem(key, id);
  return id;
}

export function remotePairingURLCustom(
  address: string,
  base: string,
  token: string
): string {
  if (!/^[a-f0-9]{48}$/.test(token)) return "";
  try {
    const target = new URL(`${base}remote/o`, address);
    if (
      !/^https?:$/.test(target.protocol) ||
      target.username ||
      target.password
    )
      return "";
    target.hash = `pair=${token}`;
    return target.toString();
  } catch {
    return "";
  }
}

export type RemotePendingCustom = {
  command_id: string;
  player_id: string;
  session_id: string;
  expected_scene_id: string;
};

export function remoteCommandIdCustom(
  state: { server_id: string; updated_at: string },
  nonce: string
): string {
  return `${state.server_id}_${Date.parse(state.updated_at)}_${nonce}`;
}

export function remotePendingCustom(
  raw: string | null,
  playerId: string
): RemotePendingCustom | undefined {
  try {
    const value = JSON.parse(raw ?? "null");
    if (
      value &&
      value.player_id === playerId &&
      [
        value.command_id,
        value.player_id,
        value.session_id,
        value.expected_scene_id,
      ].every((item) => typeof item === "string" && item.length > 0)
    )
      return value;
  } catch {
    /* Invalid saved state is ignored. */
  }
  return undefined;
}

export function remoteSnapshotValidCustom(snapshot: PlaybackSnapshot): boolean {
  return (
    !!snapshot.scene_id &&
    Number.isFinite(snapshot.video_timestamp) &&
    Number.isFinite(snapshot.duration) &&
    snapshot.duration > 0 &&
    snapshot.video_timestamp >= 0 &&
    snapshot.video_timestamp <= snapshot.duration &&
    Number.isFinite(snapshot.playback_rate) &&
    snapshot.playback_rate > 0
  );
}

export function remoteCommandMatchesCustom(
  sessionId: string,
  snapshot: PlaybackSnapshot | undefined,
  command: { session_id: string; expected_scene_id: string }
): boolean {
  return (
    !!snapshot &&
    remoteSnapshotValidCustom(snapshot) &&
    snapshot.status !== "buffering" &&
    sessionId === command.session_id &&
    snapshot.scene_id === command.expected_scene_id
  );
}

export function remoteTimeCustom(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
