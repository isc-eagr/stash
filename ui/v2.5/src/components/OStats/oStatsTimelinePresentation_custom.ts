// Only an explicit scene timeline can share identity; date/vato/tag timelines
// keep each scene's identity even if today's result happens to contain one scene.
export function commonOStatsTimelineSceneCustom<
  T extends { scene: { id: string } }
>(events: readonly T[], sceneId?: string): T["scene"] | undefined {
  return sceneId &&
    events.length > 0 &&
    events.every((event) => event.scene.id === sceneId)
    ? events[0].scene
    : undefined;
}
