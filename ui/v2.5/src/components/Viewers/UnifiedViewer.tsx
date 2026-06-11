import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { gql, useQuery } from "@apollo/client";
import { useHistory, useLocation } from "react-router-dom";
import { Button, ButtonGroup, Modal } from "react-bootstrap";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faChevronLeft,
  faChevronRight,
  faFilm,
  faImage,
  faMapMarkerAlt,
  faPlus,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { faSquareCheck } from "@fortawesome/free-regular-svg-icons";
import { UAParser } from "ua-parser-js";
import cx from "classnames";
import * as GQL from "src/core/generated-graphql";
import { objectTitle } from "src/core/files";
import { markerTitle } from "src/core/markers";
import {
  queryFindImages,
  queryFindSceneMarkers,
  queryFindScenesForSelect,
} from "src/core/StashService";
import { Icon } from "src/components/Shared/Icon";
import { SearchTermInput, SortBySelect } from "src/components/List/ListFilter";
import { SavedFilterDropdown } from "src/components/List/SavedFilterList";
import { FilterButton } from "src/components/List/Filters/FilterButton";
import { EditFilterDialog } from "src/components/List/EditFilterDialog";
import { View } from "src/components/List/views";
import { languageMap } from "src/utils/caption";
import { ListFilterModel } from "src/models/list-filter/filter";
import {
  IImageViewerItem,
  IVideoViewerItem,
  MultiVideoViewer,
} from "src/components/Scenes/MultiVideoViewer";
import { ErrorMessage } from "src/components/Shared/ErrorMessage"; // CUSTOM

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
          image_path
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
    image_path?: string | null;
  }[];
}

interface IFindScenesForViewerResult {
  findScenes: {
    scenes: ISceneForViewer[];
  };
}

type ViewerKind = "images" | "markers" | "scenes";

const VIEWER_SEARCH_PAGE_SIZE = 40;

interface IViewerSearchResult {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
}

interface IViewerKindConfig {
  icon: IconDefinition;
  label: string;
  filterMode: GQL.FilterMode;
  view: View;
}

const viewerKindConfig: Record<ViewerKind, IViewerKindConfig> = {
  images: {
    icon: faImage,
    label: "Images",
    filterMode: GQL.FilterMode.Images,
    view: View.Images,
  },
  markers: {
    icon: faMapMarkerAlt,
    label: "Markers",
    filterMode: GQL.FilterMode.SceneMarkers,
    view: View.SceneMarkers,
  },
  scenes: {
    icon: faFilm,
    label: "Scenes",
    filterMode: GQL.FilterMode.Scenes,
    view: View.Scenes,
  },
};

function makeSearchFilter(kind: ViewerKind) {
  const filter = new ListFilterModel(viewerKindConfig[kind].filterMode);
  filter.itemsPerPage = VIEWER_SEARCH_PAGE_SIZE;
  return filter;
}

function normalizeSearchFilter(filter: ListFilterModel) {
  const nextFilter = filter.clone();
  nextFilter.itemsPerPage = VIEWER_SEARCH_PAGE_SIZE;
  return nextFilter;
}

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
    // CUSTOM: begin - support pasted viewer URLs with repeated or singular params
    const ids = params.getAll(key).flatMap(splitIds);
    if (ids.length > 0) return ids;
    // CUSTOM: end
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

const ViewerSearchButton: React.FC<{
  kind: ViewerKind;
  onClick: () => void;
}> = ({ kind, onClick }) => {
  const config = viewerKindConfig[kind];

  return (
    <Button
      className="viewer-search-button"
      onClick={onClick}
      size="sm"
      title={`Add ${config.label.toLowerCase()}`}
      variant="secondary"
    >
      <Icon icon={config.icon} />
      <span>{config.label}</span>
    </Button>
  );
};

const ViewerSearchModal: React.FC<{
  kind: ViewerKind | null;
  currentIds: string[];
  onAdd: (kind: ViewerKind, ids: string[]) => void;
  onClose: () => void;
}> = ({ kind, currentIds, onAdd, onClose }) => {
  const [filter, setFilter] = useState(() => makeSearchFilter("images"));
  const [results, setResults] = useState<IViewerSearchResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const updateFilter = useCallback((nextFilter: ListFilterModel) => {
    setFilter(normalizeSearchFilter(nextFilter));
  }, []);

  useEffect(() => {
    if (!kind) {
      setResults([]);
      setSelectedIds(new Set());
      setTotalCount(0);
      return;
    }

    setFilter(makeSearchFilter(kind));
    setResults([]);
    setSelectedIds(new Set());
    setTotalCount(0);
    setShowFilterDialog(false);
  }, [kind]);

  useEffect(() => {
    setSelectedIds(
      (prev) => new Set([...prev].filter((id) => !currentIds.includes(id)))
    );
  }, [currentIds]);

  useEffect(() => {
    if (!kind) return;

    let cancelled = false;

    const runSearch = async () => {
      setLoading(true);

      try {
        if (kind === "images") {
          const query = await queryFindImages(filter);
          if (cancelled) return;

          setTotalCount(query.data.findImages.count);
          setResults(
            query.data.findImages.images
              .filter((image) => !currentIds.includes(image.id))
              .map((image) => ({
                id: image.id,
                title: objectTitle(image) || `Image ${image.id}`,
                subtitle: image.galleries?.[0]?.title ?? undefined,
                imageUrl: image.paths?.thumbnail ?? image.paths?.preview,
              }))
          );
        } else if (kind === "markers") {
          const query = await queryFindSceneMarkers(filter);
          if (cancelled) return;

          setTotalCount(query.data.findSceneMarkers.count);
          setResults(
            query.data.findSceneMarkers.scene_markers
              .filter((marker) => !currentIds.includes(marker.id))
              .map((marker) => ({
                id: marker.id,
                title:
                  markerTitle(marker) ||
                  marker.scene?.title ||
                  `Marker ${marker.id}`,
                subtitle: marker.scene?.title ?? undefined,
                imageUrl: marker.screenshot || marker.preview,
              }))
          );
        } else {
          const query = await queryFindScenesForSelect(filter);
          if (cancelled) return;

          setTotalCount(query.data.findScenes.count);
          setResults(
            query.data.findScenes.scenes
              .filter((scene) => !currentIds.includes(scene.id))
              .map((scene) => ({
                id: scene.id,
                title: objectTitle(scene) || `Scene ${scene.id}`,
                subtitle:
                  scene.studio?.name ??
                  scene.files?.find((file) => file.path)?.path,
                imageUrl: scene.paths?.screenshot,
              }))
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    runSearch();

    return () => {
      cancelled = true;
    };
  }, [currentIds, filter, kind]);

  if (!kind) return null;

  const config = viewerKindConfig[kind];
  const filterOptions = filter.options;
  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / VIEWER_SEARCH_PAGE_SIZE)
  );
  const canPageBack = filter.currentPage > 1;
  const canPageForward = filter.currentPage < totalPages;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      results.forEach((result) => next.add(result.id));
      return next;
    });
  };

  const addSelected = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    onAdd(kind, ids);
    onClose();
  };

  const changePage = (page: number) => {
    updateFilter(filter.changePage(page));
  };

  return (
    <Modal
      backdropClassName="viewer-search-backdrop"
      centered
      className="viewer-search-modal"
      onHide={onClose}
      show
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <Icon icon={config.icon} />
          <span>Add {config.label}</span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="viewer-search-toolbar filtered-list-toolbar">
          <SearchTermInput filter={filter} onFilterUpdate={updateFilter} />
          <ButtonGroup>
            <SavedFilterDropdown
              filter={filter}
              onSetFilter={updateFilter}
              view={config.view}
            />
            <FilterButton
              count={filter.count()}
              onClick={() => setShowFilterDialog(true)}
            />
          </ButtonGroup>
          <SortBySelect
            sortBy={filter.sortBy}
            sortDirection={filter.sortDirection}
            options={filterOptions.sortByOptions}
            onChangeSortBy={(eventKey) =>
              updateFilter(filter.setSortBy(eventKey ?? undefined))
            }
            onChangeSortDirection={() =>
              updateFilter(filter.toggleSortDirection())
            }
            onReshuffleRandomSort={() =>
              updateFilter(filter.reshuffleRandomSort())
            }
          />
          <ButtonGroup className="viewer-search-selection">
            <Button
              disabled={selectedIds.size === 0}
              onClick={() => setSelectedIds(new Set())}
              title="Clear selection"
              variant="secondary"
            >
              <Icon icon={faTimes} />
            </Button>
            <span className="viewer-search-selection-count">
              {selectedIds.size}
            </span>
            <Button
              disabled={results.length === 0}
              onClick={selectVisible}
              title="Select visible results"
              variant="secondary"
            >
              <Icon icon={faSquareCheck} />
            </Button>
          </ButtonGroup>
          <Button
            className="viewer-search-add-selected"
            disabled={selectedIds.size === 0}
            onClick={addSelected}
            title="Add selected"
            variant="primary"
          >
            <Icon icon={faPlus} />
          </Button>
          <ButtonGroup className="viewer-search-pagination">
            <Button
              disabled={!canPageBack || loading}
              onClick={() => changePage(filter.currentPage - 1)}
              title="Previous page"
              variant="secondary"
            >
              <Icon icon={faChevronLeft} />
            </Button>
            <span className="viewer-search-page-count">
              {filter.currentPage}/{totalPages}
            </span>
            <Button
              disabled={!canPageForward || loading}
              onClick={() => changePage(filter.currentPage + 1)}
              title="Next page"
              variant="secondary"
            >
              <Icon icon={faChevronRight} />
            </Button>
          </ButtonGroup>
        </div>
        <div className="viewer-search-results">
          {loading && <div className="viewer-search-status">Searching...</div>}
          {!loading && results.length === 0 && (
            <div className="viewer-search-status">No results found.</div>
          )}
          {!loading &&
            results.map((result) => {
              const selected = selectedIds.has(result.id);
              return (
                <button
                  aria-pressed={selected}
                  className={cx("viewer-search-result", { selected })}
                  key={result.id}
                  onClick={() => toggleSelected(result.id)}
                  type="button"
                >
                  {result.imageUrl ? (
                    <img alt="" loading="lazy" src={result.imageUrl} />
                  ) : (
                    <span className="viewer-search-result-fallback">
                      <Icon icon={config.icon} />
                    </span>
                  )}
                  <span className="viewer-search-result-text">
                    <span className="viewer-search-result-title">
                      {result.title}
                    </span>
                    {result.subtitle && (
                      <span className="viewer-search-result-subtitle">
                        {result.subtitle}
                      </span>
                    )}
                  </span>
                  <span className="viewer-search-result-add">
                    <Icon icon={selected ? faSquareCheck : faPlus} />
                  </span>
                </button>
              );
            })}
        </div>
        {showFilterDialog && (
          <EditFilterDialog
            filter={filter}
            onApply={(nextFilter) => {
              updateFilter(nextFilter);
              setShowFilterDialog(false);
            }}
            onCancel={() => setShowFilterDialog(false)}
          />
        )}
      </Modal.Body>
    </Modal>
  );
};

export const UnifiedViewer: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const [activeSearchKind, setActiveSearchKind] = useState<ViewerKind | null>(
    null
  );
  const isSafari = useMemo(
    () => UAParser().browser.name?.includes("Safari") ?? false,
    []
  );

  const { imageIds, markerIds, sceneIds } = useMemo(() => {
    // CUSTOM: begin - make pasted viewer URLs survive cold app boot
    const search = location.search || window.location.search;
    const pathname = location.pathname || window.location.pathname;
    const params = new URLSearchParams(search);
    // CUSTOM: end
    const legacyIds = splitIds(params.get("ids"));
    const imageParamIds = firstIds(params, ["images", "image", "image_ids"]);
    const markerParamIds = firstIds(params, [
      "markers",
      "marker",
      "marker_ids",
    ]);
    const sceneParamIds = firstIds(params, ["scenes", "scene", "scene_ids"]);

    return {
      imageIds:
        imageParamIds.length > 0 || pathname !== "/images/viewer"
          ? imageParamIds
          : legacyIds,
      markerIds:
        markerParamIds.length > 0 ||
        pathname !== "/scenes/markers/viewer"
          ? markerParamIds
          : legacyIds,
      sceneIds:
        sceneParamIds.length > 0 || pathname !== "/scenes/viewer"
          ? sceneParamIds
          : legacyIds,
    };
  }, [location.pathname, location.search]);
  const viewerIdsRef = useRef<Record<ViewerKind, string[]>>({
    images: imageIds,
    markers: markerIds,
    scenes: sceneIds,
  });

  useEffect(() => {
    viewerIdsRef.current = {
      images: imageIds,
      markers: markerIds,
      scenes: sceneIds,
    };
  }, [imageIds, markerIds, sceneIds]);

  const writeViewerIds = useCallback(
    (next: Record<ViewerKind, string[]>) => {
      viewerIdsRef.current = next;
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
    [history]
  );

  const addViewerIds = useCallback(
    (kind: ViewerKind, ids: string[]) => {
      const { current } = viewerIdsRef;
      const next = {
        images: [...current.images],
        markers: [...current.markers],
        scenes: [...current.scenes],
      };

      ids.forEach((id) => {
        if (!next[kind].includes(id)) {
          next[kind].push(id);
        }
      });

      writeViewerIds(next);
    },
    [writeViewerIds]
  );

  const removeViewerItem = useCallback(
    (id: string) => {
      const [kind, rawId] = id.split(":");
      const key =
        kind === "image"
          ? "images"
          : kind === "marker"
          ? "markers"
          : kind === "scene"
          ? "scenes"
          : undefined;

      if (!key || !rawId) return;

      const { current } = viewerIdsRef;
      const next = {
        images: [...current.images],
        markers: [...current.markers],
        scenes: [...current.scenes],
      };
      next[key] = next[key].filter((value) => value !== rawId);
      writeViewerIds(next);
    },
    [writeViewerIds]
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
        streamUrl:
          marker.scene?.paths?.stream || `/scene/${marker.scene.id}/stream`,
        title:
          markerTitle(marker) || marker.scene?.title || `Marker ${marker.id}`,
        sceneId: marker.scene?.id ?? undefined,
        startTime: marker.seconds,
        endTime: marker.end_seconds ?? null,
        topPerformerNames: (marker.top_performers ?? [])
          .map(performerDisplayName)
          .filter(Boolean),
        bottomPerformerNames: (marker.bottom_performers ?? [])
          .map(performerDisplayName)
          .filter(Boolean),
        topPerformers: (marker.top_performers ?? []).map((p) => ({
          id: p.id,
          name: performerDisplayName(p),
          image_path: p.image_path,
          disambiguation: p.disambiguation,
        })),
        bottomPerformers: (marker.bottom_performers ?? []).map((p) => ({
          id: p.id,
          name: performerDisplayName(p),
          image_path: p.image_path,
          disambiguation: p.disambiguation,
        })),
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
        topPerformers: (scene.performers ?? []).map((performer) => ({
          id: performer.id,
          name: performerDisplayName(performer),
          image_path: performer.image_path,
          disambiguation: performer.disambiguation,
        })),
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

  const activeSearchIds = useMemo(() => {
    if (activeSearchKind === "images") return imageIds;
    if (activeSearchKind === "markers") return markerIds;
    if (activeSearchKind === "scenes") return sceneIds;
    return [];
  }, [activeSearchKind, imageIds, markerIds, sceneIds]);

  const headerContent = (
    <div className="viewer-add-controls">
      <ViewerSearchButton
        kind="images"
        onClick={() => setActiveSearchKind("images")}
      />
      <ViewerSearchButton
        kind="markers"
        onClick={() => setActiveSearchKind("markers")}
      />
      <ViewerSearchButton
        kind="scenes"
        onClick={() => setActiveSearchKind("scenes")}
      />
    </div>
  );

  const loadError =
    imagesQuery.error?.message ||
    markersQuery.error?.message ||
    scenesQuery.error?.message;

  if (loadError) {
    return <ErrorMessage error={loadError} />;
  }

  return (
    <>
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
        onRemoveItem={removeViewerItem}
        orderedIds={orderedVideoIds}
        title="Viewer"
      />
      <ViewerSearchModal
        currentIds={activeSearchIds}
        kind={activeSearchKind}
        onAdd={addViewerIds}
        onClose={() => setActiveSearchKind(null)}
      />
    </>
  );
};

export default UnifiedViewer;
