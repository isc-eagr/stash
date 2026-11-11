import type * as GQL from "src/core/generated-graphql";

// Release mode projects the selected release into a scene-shaped "owner view"
// so the player and the read-only tabs consume one SceneDataFragment. Every
// release-owned field is taken from the release; the parent keeps its id, its
// ratings, and its organized flag (shared by design). Scene-level release totals are zeroed so the
// release's own history is never counted twice.
export const getSceneReleasePlaybackContextCustom = (
  scene: GQL.SceneDataFragment,
  releaseId: string | null
): { ownerKey: string; scene: GQL.SceneDataFragment } | undefined => {
  if (!releaseId) {
    return {
      ownerKey: `scene:${scene.id}:${scene.files[0]?.id ?? "empty"}`,
      scene,
    };
  }
  const release = scene.releases.find((item) => item.id === releaseId);
  if (!release) return undefined;
  return {
    ownerKey: `release:${release.id}:${release.files[0]?.id ?? "empty"}`,
    scene: {
      ...scene,
      title: release.title,
      code: release.code,
      details: release.details,
      director: release.director,
      urls: release.urls,
      date: release.date,
      effective_date: release.date,
      studio: release.studio,
      performers:
        release.performers as unknown as GQL.SceneDataFragment["performers"],
      tags: release.tags,
      groups: release.groups as unknown as GQL.SceneDataFragment["groups"],
      galleries: release.galleries,
      direct_galleries: release.galleries,
      stash_ids: release.stash_ids,
      stashdb_matches: release.stashdb_matches,
      custom_fields: release.custom_fields,
      created_at: release.created_at,
      updated_at: release.updated_at,
      last_played_at: latestTime(release.play_history),
      release_o_counter: 0,
      release_stashdb_matches: null,
      release_last_o_at: null,
      resume_time: release.resume_time,
      play_duration: release.play_duration,
      interactive: release.interactive,
      interactive_speed: release.interactive_speed,
      play_count: release.play_history.length,
      o_counter: release.o_history.length,
      play_history: release.play_history,
      o_history: release.o_history,
      o_timestamps: release.o_timestamps,
      files: release.files,
      sceneStreams: release.streams,
      paths: {
        ...scene.paths,
        screenshot: release.paths.screenshot,
        preview: release.paths.preview,
        stream: null,
        webp: release.paths.webp,
        vtt: release.paths.vtt,
        sprite: release.paths.sprite,
        funscript: release.paths.funscript,
        interactive_heatmap: release.paths.interactive_heatmap,
        caption: release.paths.caption,
      },
      captions: release.captions,
      scene_markers: release.scene_markers,
      scene_marker_tag_ancestors: release.scene_marker_tag_ancestors,
      negative_markers: release.negative_markers,
      multi_segment_loop_presets: release.multi_segment_loop_presets,
    },
  };
};

const latestTime = (times: string[]): string | null =>
  times.reduce<string | null>(
    (latest, time) => (latest === null || time > latest ? time : latest),
    null
  );
