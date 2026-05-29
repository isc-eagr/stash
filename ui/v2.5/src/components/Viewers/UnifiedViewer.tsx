import React, { useCallback, useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import { useHistory, useLocation } from "react-router-dom";
import AsyncSelect from "react-select/async";
import { SingleValue, StylesConfig } from "react-select";
import {
  faFilm,
  faImage,
  faMapMarkerAlt,
} from "@fortawesome/free-solid-svg-icons";
import { UAParser } from "ua-parser-js";
import * as GQL from "src/core/generated-graphql";
import { objectTitle } from "src/core/files";
import { markerTitle } from "src/core/markers";
import {
  queryFindImages,
  queryFindSceneMarkers,
  queryFindScenesForSelect,
} from "src/core/StashService";
import { Icon } from "src/components/Shared/Icon";
import { languageMap } from "src/utils/caption";
import { ListFilterModel } from "src/models/list-filter/filter";
import {
  IImageViewerItem,
  IVideoViewerItem,
  MultiVideoViewer,
} from "src/components/Scenes/MultiVideoViewer";

const FIND_UNIFIED_VIEWER_IMAGES = gql`
  query FindUnifiedViewerImages($ids: [ID!]) {
    findImages(ids: $ids) {
      images {
        ...SlimImageData
      }
    }
  }
  ${GQL.SlimImageDataFragmentDoc}
`;

const FIND_UNIFIED_VIEWER_MARKERS = gql`
  query FindUnifiedViewerMarkers($ids: [ID!]) {
    findSceneMarkers(ids: $ids) {
      scene_markers {
        ...SceneMarkerData
      }
    }
  }
  ${GQL.SceneMarkerDataFragmentDoc}
`;

const FIND_UNIFIED_VIEWER_SCENES = gql`
  query FindUnifiedViewerScenes($ids: [ID!]) {
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
        }
      }
    }
  }
`;

interface IFindImagesForViewerResult {
  findImages: {
    images: GQL.SlimImageDataFragment[];
  };
}

interface IFindMarkersForViewerResult {
  findSceneMarkers: {
    scene_markers: GQL.SceneMarkerDataFragment[];
  };
}

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
  }[];
}

interface IFindScenesForViewerResult {
  findScenes: {
    scenes: ISceneForViewer[];
  };
}

interface IViewerSelectOption {
  value: string;
  label: string;
}

type ViewerKind = "images" | "markers" | "scenes";

const selectStyles: StylesConfig<IViewerSelectOption, false> = {
  container: (base) => ({
    ...base,
    minWidth: 220,
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 300000,
  }),
  option: (base) => ({
    ...base,
    color: "#111",
  }),
};

function splitIds(value: string | null) {
  if (!value) return [];
  const seen = new Set<string>();
  return value
    .split(",")
    .map((id) => id.trim())
    .filter((id) => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function firstIds(params: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const ids = splitIds(params.get(key));
    if (ids.length > 0) return ids;
  }
  return [];
}

function viewerId(kind: "image" | "marker" | "scene", id: string) {
  return `${kind}:${id}`;
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

const ViewerAddSelect: React.FC<{
  icon: typeof faImage;
  placeholder: string;
  loadOptions: (input: string) => Promise<IViewerSelectOption[]>;
  onSelect: (id: string) => void;
}> = ({ icon, placeholder, loadOptions, onSelect }) => {
  const handleChange = (option: SingleValue<IViewerSelectOption>) => {
    if (option) {
      onSelect(option.value);
    }
  };

  return (
    <div className="viewer-add-select">
      <Icon icon={icon} />
      <AsyncSelect<IViewerSelectOption, false>
        cacheOptions
        classNamePrefix="viewer-select"
        isClearable
        loadOptions={loadOptions}
        menuPortalTarget={document.body}
        onChange={handleChange}
        placeholder={placeholder}
        styles={selectStyles}
        value={null}
      />
    </div>
  );
};

export const UnifiedViewer: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const isSafari = useMemo(
    () => UAParser().browser.name?.includes("Safari") ?? false,
    []
  );

  const { imageIds, markerIds, sceneIds } = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const legacyIds = splitIds(params.get("ids"));
    const imageParamIds = firstIds(params, ["images", "image_ids"]);
    const markerParamIds = firstIds(params, ["markers", "marker_ids"]);
    const sceneParamIds = firstIds(params, ["scenes", "scene_ids"]);

    return {
      imageIds:
        imageParamIds.length > 0 || location.pathname !== "/images/viewer"
          ? imageParamIds
          : legacyIds,
      markerIds:
        markerParamIds.length > 0 ||
        location.pathname !== "/scenes/markers/viewer"
          ? markerParamIds
          : legacyIds,
      sceneIds:
        sceneParamIds.length > 0 || location.pathname !== "/scenes/viewer"
          ? sceneParamIds
          : legacyIds,
    };
  }, [location.pathname, location.search]);

  const updateViewerIds = useCallback(
    (kind: ViewerKind, id: string) => {
      const next = {
        images: [...imageIds],
        markers: [...markerIds],
        scenes: [...sceneIds],
      };

      if (!next[kind].includes(id)) {
        next[kind].push(id);
      }

      const params = new URLSearchParams();
      if (next.images.length > 0) params.set("images", next.images.join(","));
      if (next.markers.length > 0)
        params.set("markers", next.markers.join(","));
      if (next.scenes.length > 0) params.set("scenes", next.scenes.join(","));

      const search = params.toString();
      history.replace({
        pathname: "/viewer",
        search: search ? `?${search}` : "",
      });
    },
    [history, imageIds, markerIds, sceneIds]
  );

  const imagesQuery = useQuery<IFindImagesForViewerResult>(
    FIND_UNIFIED_VIEWER_IMAGES,
    {
      skip: imageIds.length === 0,
      variables: { ids: imageIds },
    }
  );
  const markersQuery = useQuery<IFindMarkersForViewerResult>(
    FIND_UNIFIED_VIEWER_MARKERS,
    {
      skip: markerIds.length === 0,
      variables: { ids: markerIds },
    }
  );
  const scenesQuery = useQuery<IFindScenesForViewerResult>(
    FIND_UNIFIED_VIEWER_SCENES,
    {
      skip: sceneIds.length === 0,
      variables: { ids: sceneIds },
    }
  );

  const loadImageOptions = useCallback(
    async (input: string) => {
      if (!input.trim()) return [];
      const filter = new ListFilterModel(GQL.FilterMode.Images);
      filter.searchTerm = input;
      filter.itemsPerPage = 30;

      const query = await queryFindImages(filter);
      return query.data.findImages.images
        .filter((image) => !imageIds.includes(image.id))
        .map((image) => ({
          value: image.id,
          label: objectTitle(image) || `Image ${image.id}`,
        }));
    },
    [imageIds]
  );

  const loadMarkerOptions = useCallback(
    async (input: string) => {
      if (!input.trim()) return [];
      const filter = new ListFilterModel(GQL.FilterMode.SceneMarkers);
      filter.searchTerm = input;
      filter.itemsPerPage = 30;

      const query = await queryFindSceneMarkers(filter);
      return query.data.findSceneMarkers.scene_markers
        .filter((marker) => !markerIds.includes(marker.id))
        .map((marker) => ({
          value: marker.id,
          label:
            markerTitle(marker) || marker.scene?.title || `Marker ${marker.id}`,
        }));
    },
    [markerIds]
  );

  const loadSceneOptions = useCallback(
    async (input: string) => {
      if (!input.trim()) return [];
      const filter = new ListFilterModel(GQL.FilterMode.Scenes);
      filter.searchTerm = input;
      filter.itemsPerPage = 30;

      const query = await queryFindScenesForSelect(filter);
      return query.data.findScenes.scenes
        .filter((scene) => !sceneIds.includes(scene.id))
        .map((scene) => ({
          value: scene.id,
          label: objectTitle(scene) || `Scene ${scene.id}`,
        }));
    },
    [sceneIds]
  );

  const imageItems = useMemo<IImageViewerItem[]>(() => {
    const fetchedImages = imagesQuery.data?.findImages.images ?? [];
    return imageIds
      .map((id) => fetchedImages.find((image) => image.id === id))
      .filter(
        (image): image is GQL.SlimImageDataFragment =>
          image !== undefined && !!image.paths?.image
      )
      .map((image) => ({
        id: viewerId("image", image.id),
        url: image.paths.image ?? "",
        title: objectTitle(image) || `Image ${image.id}`,
      }));
  }, [imageIds, imagesQuery.data?.findImages.images]);

  const markerItems = useMemo<IVideoViewerItem[]>(() => {
    return (markersQuery.data?.findSceneMarkers.scene_markers ?? []).map(
      (marker) => ({
        id: viewerId("marker", marker.id),
        streamUrl: marker.stream,
        title:
          markerTitle(marker) || marker.scene?.title || `Marker ${marker.id}`,
        sceneId: marker.scene?.id ?? undefined,
        topPerformerNames: (marker.top_performers ?? [])
          .map(performerDisplayName)
          .filter(Boolean),
        bottomPerformerNames: (marker.bottom_performers ?? [])
          .map(performerDisplayName)
          .filter(Boolean),
      })
    );
  }, [markersQuery.data?.findSceneMarkers.scene_markers]);

  const sceneItems = useMemo<IVideoViewerItem[]>(() => {
    return (scenesQuery.data?.findScenes.scenes ?? []).map((scene) => {
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
        id: viewerId("scene", scene.id),
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
      };
    });
  }, [isSafari, scenesQuery.data?.findScenes.scenes]);

  const videoItems = useMemo(
    () => [...markerItems, ...sceneItems],
    [markerItems, sceneItems]
  );
  const orderedVideoIds = useMemo(
    () => [
      ...markerIds.map((id) => viewerId("marker", id)),
      ...sceneIds.map((id) => viewerId("scene", id)),
    ],
    [markerIds, sceneIds]
  );
  const orderedImageIds = useMemo(
    () => imageIds.map((id) => viewerId("image", id)),
    [imageIds]
  );

  const headerContent = (
    <div className="viewer-add-controls">
      <ViewerAddSelect
        icon={faImage}
        loadOptions={loadImageOptions}
        onSelect={(id) => updateViewerIds("images", id)}
        placeholder="Add image"
      />
      <ViewerAddSelect
        icon={faMapMarkerAlt}
        loadOptions={loadMarkerOptions}
        onSelect={(id) => updateViewerIds("markers", id)}
        placeholder="Add marker"
      />
      <ViewerAddSelect
        icon={faFilm}
        loadOptions={loadSceneOptions}
        onSelect={(id) => updateViewerIds("scenes", id)}
        placeholder="Add scene"
      />
    </div>
  );

  return (
    <MultiVideoViewer
      emptyMessage="No viewer items selected."
      headerContent={headerContent}
      imageItems={imageItems}
      imageOrderedIds={orderedImageIds}
      itemLabel="item"
      items={videoItems}
      loading={
        imagesQuery.loading || markersQuery.loading || scenesQuery.loading
      }
      orderedIds={orderedVideoIds}
      title="Viewer"
    />
  );
};

export default UnifiedViewer;
