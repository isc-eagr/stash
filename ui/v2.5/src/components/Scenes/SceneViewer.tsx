import React, { useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import { useLocation } from "react-router-dom";
import { objectTitle } from "src/core/files";
import { languageMap } from "src/utils/caption";
import { UAParser } from "ua-parser-js";
import { MultiVideoViewer, IVideoViewerItem } from "./MultiVideoViewer";

const FIND_SCENES_FOR_VIEWER = gql`
  query FindScenesForViewer($ids: [ID!]) {
    findScenes(ids: $ids) {
      scenes {
        id
        title
        files {
          path
          duration
        }
        paths {
          stream
          screenshot
          vtt
          caption
        }
        sceneStreams {
          url
          mime_type
          label
        }
        captions {
          language_code
          caption_type
        }
        scene_markers {
          id
          title
          seconds
          end_seconds
          primary_tag {
            id
            name
          }
          top_performers {
            id
            name
          }
          bottom_performers {
            id
            name
          }
        }
        negative_markers {
          id
          name
          start_seconds
          end_seconds
        }
        o_timestamps
        o_history
        multi_segment_loop_presets {
          id
          name
          enabled
          current_segment_index
          segments {
            start
            end
          }
        }
        performers {
          id
          name
          disambiguation
          image_path
        }
      }
    }
  }
`;

interface ISceneForViewer {
  id: string;
  title?: string | null;
  files: {
    path: string;
    duration: number;
  }[];
  paths: {
    stream?: string | null;
    screenshot?: string | null;
    vtt?: string | null;
    caption?: string | null;
  };
  sceneStreams: {
    url: string;
    mime_type?: string | null;
    label?: string | null;
  }[];
  captions?:
    | {
        language_code: string;
        caption_type: string;
      }[]
    | null;
  scene_markers: {
    id: string;
    title: string;
    seconds: number;
    end_seconds?: number | null;
    primary_tag: {
      id: string;
      name: string;
    };
    top_performers?: {
      id: string;
      name: string;
    }[];
    bottom_performers?: {
      id: string;
      name: string;
    }[];
  }[];
  negative_markers?: {
    id: string;
    name: string;
    start_seconds: number;
    end_seconds: number;
  }[];
  o_timestamps?: Array<number | null>;
  o_history?: string[];
  multi_segment_loop_presets?: {
    id?: string | null;
    name: string;
    enabled?: boolean | null;
    current_segment_index?: number | null;
    segments?: {
      start?: number | null;
      end?: number | null;
    }[];
  }[];
  performers: {
    id: string;
    name: string;
    disambiguation?: string | null;
    image_path?: string | null;
  }[];
}

interface IFindScenesForViewerResult {
  findScenes: {
    scenes: ISceneForViewer[];
  };
}

function performerDisplayName(p: {
  name: string;
  disambiguation?: string | null;
}) {
  return p.disambiguation ? `${p.name} (${p.disambiguation})` : p.name;
}

function isDirectStream(src: string) {
  const parsed = new URL(src, window.location.origin);
  return (
    parsed.pathname.endsWith("/stream") ||
    parsed.pathname.endsWith("/stream.mpd") ||
    parsed.pathname.endsWith("/stream.m3u8")
  );
}

function getDefaultLanguageCode() {
  let languageCode = window.navigator.language;

  if (languageCode.indexOf("-") !== -1) {
    languageCode = languageCode.split("-")[0];
  }

  if (languageCode.indexOf("_") !== -1) {
    languageCode = languageCode.split("_")[0];
  }

  return languageCode;
}

function getTextTracks(scene: ISceneForViewer) {
  if (!scene.paths.caption || !scene.captions?.length) return [];

  const defaultLanguageCode = getDefaultLanguageCode();
  let hasDefault = false;

  return scene.captions.map((caption) => {
    const lang = caption.language_code;
    let label = languageMap.get(lang) ?? lang;
    label = `${label} (${caption.caption_type})`;

    const setAsDefault = !hasDefault && defaultLanguageCode === lang;
    if (setAsDefault) {
      hasDefault = true;
    }

    return {
      src: `${scene.paths.caption}?lang=${encodeURIComponent(
        lang
      )}&type=${encodeURIComponent(caption.caption_type)}`,
      kind: "captions",
      srclang: lang,
      label,
      default: setAsDefault,
    };
  });
}

export const SceneViewer: React.FC = () => {
  const location = useLocation();
  const isSafari = useMemo(
    () => UAParser().browser.name?.includes("Safari") ?? false,
    []
  );

  const sceneIds = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const ids = params.get("ids");
    return ids ? ids.split(",").filter(Boolean) : [];
  }, [location.search]);

  const { data, loading } = useQuery<IFindScenesForViewerResult>(
    FIND_SCENES_FOR_VIEWER,
    {
      skip: sceneIds.length === 0,
      variables: { ids: sceneIds },
    }
  );

  const items = useMemo<IVideoViewerItem[]>(() => {
    return (data?.findScenes.scenes ?? []).map((scene) => {
      const sources = scene.sceneStreams
        .filter((stream) => {
          const isFileTranscode = !isDirectStream(stream.url);
          return !(isFileTranscode && isSafari);
        })
        .map((stream) => ({
          src: stream.url,
          type: stream.mime_type,
          label: stream.label,
          offset: !isDirectStream(stream.url),
        }));

      return {
        id: scene.id,
        streamUrl: scene.paths.stream || `/scene/${scene.id}/stream`,
        title: objectTitle(scene) || `Scene ${scene.id}`,
        sceneId: scene.id,
        customControls: true,
        posterUrl: scene.paths.screenshot,
        vttUrl: scene.paths.vtt,
        duration: scene.files[0]?.duration,
        sources,
        textTracks: getTextTracks(scene),
        timelineMarkers: (scene.scene_markers ?? []).map((marker) => ({
          title: marker.title,
          seconds: marker.seconds,
          end_seconds: marker.end_seconds ?? null,
          primaryTag: { name: marker.primary_tag.name },
          top_performers: (marker.top_performers ?? []).map((performer) => ({
            id: performer.id,
            name: performer.name,
          })),
          bottom_performers: (marker.bottom_performers ?? []).map(
            (performer) => ({
              id: performer.id,
              name: performer.name,
            })
          ),
        })),
        negativeMarkers: scene.negative_markers ?? [],
        oTimestamps: (scene.o_timestamps ?? [])
          .map((timestamp, index) =>
            timestamp !== null && timestamp !== undefined
              ? {
                  ts: timestamp,
                  date: scene.o_history?.[index] ?? "",
                }
              : null
          )
          .filter(
            (timestamp): timestamp is { ts: number; date: string } =>
              timestamp !== null
          ),
        segmentPresets: (scene.multi_segment_loop_presets ?? []).map(
          (preset) => ({
            id: preset.id ?? undefined,
            name: preset.name,
            enabled: preset.enabled ?? false,
            currentSegmentIndex: preset.current_segment_index ?? 0,
            segments: (preset.segments ?? []).map((segment) => ({
              start: segment.start ?? 0,
              end: segment.end ?? 0,
            })),
          })
        ),
        topPerformerNames: (scene.performers ?? [])
          .map(performerDisplayName)
          .filter(Boolean),
        topPerformers: (scene.performers ?? []).map((performer) => ({
          id: performer.id,
          name: performerDisplayName(performer),
          image_path: performer.image_path,
          disambiguation: performer.disambiguation,
        })),
      };
    });
  }, [data?.findScenes.scenes, isSafari]);

  return (
    <MultiVideoViewer
      items={items}
      orderedIds={sceneIds}
      loading={loading}
      title="Scene Viewer"
      itemLabel="scene"
      emptyMessage="No scenes found for this viewer URL."
    />
  );
};

export default SceneViewer;
