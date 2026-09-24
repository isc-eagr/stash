import type * as GQL from "src/core/generated-graphql";

// The player still consumes SceneDataFragment; this boundary supplies only the
// selected owner's media and activity while retaining the parent scene identity.
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
      rating100: release.rating100,
      studio: release.studio,
      tags: release.tags,
      galleries: release.galleries,
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
      scene_marker_tag_ancestors: [],
      negative_markers: release.negative_markers,
      multi_segment_loop_presets: release.multi_segment_loop_presets,
    },
  };
};
