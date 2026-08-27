import { Tab, Nav, Dropdown, Button } from "react-bootstrap";
import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useLayoutEffect,
  useCallback,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useHistory, RouteComponentProps } from "react-router-dom";
import { Helmet } from "react-helmet";
import * as GQL from "src/core/generated-graphql";
import {
  mutateMetadataScan,
  useFindScene,
  useSceneIncrementO,
  useSceneRecordOAtTimestamp, // CUSTOM
  useSceneGenerateScreenshot,
  useSceneUpdate,
  queryFindScenes,
  queryFindScenesByID,
  useSceneIncrementPlayCount,
} from "src/core/StashService";

import { SceneEditPanel } from "./SceneEditPanel";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { Icon } from "src/components/Shared/Icon";
import { Counter } from "src/components/Shared/Counter";
import { useToast } from "src/hooks/Toast";
import SceneQueue, { QueuedScene } from "src/models/sceneQueue";
import { ListFilterModel } from "src/models/list-filter/filter";
import Mousetrap from "mousetrap";
import { OrganizedButton } from "./OrganizedButton";
import { useConfigurationContext } from "src/hooks/Config";
import {
  getAbLoopPlugin,
  getPlayerPosition,
} from "src/components/ScenePlayer/util";
import { formatORecordedToastCustom } from "../oRecordToast_custom"; // CUSTOM
import { shouldEnableSceneOHotkeyCustom } from "./sceneOHotkeyPreference_custom"; // CUSTOM
import {
  faEllipsisV,
  faChevronRight,
  faChevronLeft,
  faCompress,
  faExpand,
  faHand, // CUSTOM
} from "@fortawesome/free-solid-svg-icons";
// CUSTOM: begin - role icon SVG imports
import mouthSvg from "src/assets/mouth.svg";
import gaySvg from "src/assets/gay.svg";
import straightSvg from "src/assets/straight.svg";
// CUSTOM: end
import { objectPath, objectTitle } from "src/core/files";
import { RatingAdvisorButton } from "src/components/Shared/RatingAdvisor_custom"; // CUSTOM
import { getSceneRatingModeCustom } from "src/components/Shared/groupSceneRating_custom"; // CUSTOM
import TextUtils from "src/utils/text";
import {
  OCounterButton,
  ViewCountButton,
} from "src/components/Shared/CountButton";
import { lazyComponent } from "src/utils/lazyComponent";
import cx from "classnames";
import { TruncatedText } from "src/components/Shared/TruncatedText";
import { PatchComponent, PatchContainerComponent } from "src/patch";
import { SceneMergeModal } from "../SceneMergeDialog";
import { FormattedDate } from "src/components/Shared/Date";
import { StudioLogo } from "src/components/Shared/StudioLogo";
// CUSTOM: begin - multi-segment loop and icon imports
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type {
  IMultiSegmentLoopApi,
  ILoopSegmentInput,
} from "src/components/ScenePlayer/multi-segment-loop";
import { filterLoopSegmentsOutsideNegativeMarkers } from "src/components/ScenePlayer/loopSegments_custom";
import { SceneActivityMetrics } from "../SceneActivityMetrics_custom";
import {
  completeSceneMarkerFocusRequest,
  type ISceneMarkerFocusRequest,
} from "./sceneMarkerFocusScroll_custom";
import { ScenePerformerOverviewProvider } from "./ScenePerformerOverviewPanel_custom";
import {
  resolveSceneMarkerTimestampCopySelection,
  type ISceneMarkerTimestampCopyRequest,
  type ISceneMarkerTimestampCopySelection,
  type ISceneMarkerTimestampSource,
  type SceneMarkerTimestampBoundary,
  type SceneMarkerTimestampDestination,
  type SceneMarkerTimestampField,
  type SceneMarkerTimestampSourceKind,
} from "src/components/ScenePlayer/sceneMarkerTimestampCopy_custom";
// CUSTOM: end

const SubmitStashBoxDraft = lazyComponent(
  () => import("src/components/Dialogs/SubmitDraft")
);
const ScenePlayer = lazyComponent(
  () => import("src/components/ScenePlayer/ScenePlayer")
);

const GalleryViewer = lazyComponent(
  () => import("src/components/Galleries/GalleryViewer")
);
const ExternalPlayerButton = lazyComponent(
  () => import("./ExternalPlayerButton")
);

const QueueViewer = lazyComponent(() => import("./QueueViewer"));
const SceneMarkersPanel = lazyComponent(() => import("./SceneMarkersPanel"));
const SceneNegativeMarkersPanel = lazyComponent(
  () => import("./SceneNegativeMarkersPanel")
); // CUSTOM
const SceneFileInfoPanel = lazyComponent(() => import("./SceneFileInfoPanel"));
const SceneDetailPanel = lazyComponent(() => import("./SceneDetailPanel"));
const SceneHistoryPanel = lazyComponent(() => import("./SceneHistoryPanel"));
const SceneGroupPanel = lazyComponent(() => import("./SceneGroupPanel"));
const SceneGalleriesPanel = lazyComponent(
  () => import("./SceneGalleriesPanel")
);
// CUSTOM: begin - SceneReleasesPanel lazy import
const SceneReleasesPanel = lazyComponent(() => import("./SceneReleasesPanel"));
// CUSTOM: end
const SceneStatsPanel = lazyComponent(() => import("./SceneStatsPanel")); // CUSTOM
const DeleteScenesDialog = lazyComponent(() => import("../DeleteScenesDialog"));
const GenerateDialog = lazyComponent(
  () => import("../../Dialogs/GenerateDialog")
);
const SceneVideoFilterPanel = lazyComponent(
  () => import("./SceneVideoFilterPanel")
);

const VideoFrameRateResolution: React.FC<{
  width?: number;
  height?: number;
  frameRate?: number;
}> = ({ width, height, frameRate }) => {
  const intl = useIntl();

  const resolution = useMemo(() => {
    if (width && height) {
      const r = TextUtils.resolution(width, height);
      return (
        <span className="resolution" data-value={r}>
          {r}
        </span>
      );
    }
    return undefined;
  }, [width, height]);

  const frameRateDisplay = useMemo(() => {
    if (frameRate) {
      return (
        <span className="frame-rate" data-value={frameRate}>
          <FormattedMessage
            id="frames_per_second"
            values={{ value: intl.formatNumber(frameRate ?? 0) }}
          />
        </span>
      );
    }
    return undefined;
  }, [intl, frameRate]);

  const divider = useMemo(() => {
    return resolution && frameRateDisplay ? (
      <span className="divider"> | </span>
    ) : undefined;
  }, [resolution, frameRateDisplay]);

  return (
    <span>
      {frameRateDisplay}
      {divider}
      {resolution}
    </span>
  );
};

interface IProps {
  scene: GQL.SceneDataFragment;
  setTimestamp: (num: number) => void;
  addMultiSegmentLoopSegments: (segments: ILoopSegmentInput[]) => void; // CUSTOM
  queueScenes: QueuedScene[];
  onQueueNext: () => void;
  onQueuePrevious: () => void;
  onQueueRandom: () => void;
  onQueueSceneClicked: (sceneID: string) => void;
  onDelete: () => void;
  continuePlaylist: boolean;
  queueHasMoreScenes: boolean;
  onQueueMoreScenes: () => void;
  onQueueLessScenes: () => void;
  queueStart: number;
  collapsed: boolean;
  setCollapsed: (state: boolean) => void;
  setContinuePlaylist: (value: boolean) => void;
  onRefetch: () => void; // CUSTOM
  activeReleaseId: string | null; // CUSTOM
  setActiveReleaseId: (id: string | null) => void; // CUSTOM
  currentTimestamp?: number; // CUSTOM
  markerTimestampCopyRequest?: ISceneMarkerTimestampCopyRequest; // CUSTOM
  markerTimestampCopySelection?: ISceneMarkerTimestampCopySelection; // CUSTOM
  onMarkerTimestampCopyRequest: (
    field: SceneMarkerTimestampField | undefined,
    destination: SceneMarkerTimestampDestination
  ) => void; // CUSTOM
  onMarkerTimestampCopySelectionHandled: (requestId: number) => void; // CUSTOM
}

interface ISceneParams {
  id: string;
}

const ScenePageTabs = PatchContainerComponent<IProps>("ScenePage.Tabs");
const ScenePageTabContent = PatchContainerComponent<IProps>(
  "ScenePage.TabContent"
);

const ScenePage: React.FC<IProps> = PatchComponent("ScenePage", (props) => {
  const {
    scene,
    setTimestamp,
    addMultiSegmentLoopSegments, // CUSTOM
    queueScenes,
    onQueueNext,
    onQueuePrevious,
    onQueueRandom,
    onQueueSceneClicked,
    onDelete,
    continuePlaylist,
    queueHasMoreScenes,
    onQueueMoreScenes,
    onQueueLessScenes,
    queueStart,
    collapsed,
    setCollapsed,
    setContinuePlaylist,
    activeReleaseId, // CUSTOM
    setActiveReleaseId, // CUSTOM
    currentTimestamp, // CUSTOM
    markerTimestampCopyRequest, // CUSTOM
    markerTimestampCopySelection, // CUSTOM
    onMarkerTimestampCopyRequest, // CUSTOM
    onMarkerTimestampCopySelectionHandled, // CUSTOM
  } = props;

  const Toast = useToast();
  const intl = useIntl();
  const history = useHistory();
  const [updateScene] = useSceneUpdate();
  const [generateScreenshot] = useSceneGenerateScreenshot();
  const { configuration } = useConfigurationContext();
  const { showStudioText } = configuration?.ui ?? {};
  const isSceneOHotkeyEnabled = shouldEnableSceneOHotkeyCustom(
    configuration?.ui
  ); // CUSTOM

  const [showDraftModal, setShowDraftModal] = useState(false);
  const boxes = configuration?.general?.stashBoxes ?? [];

  const [incrementO] = useSceneIncrementO(scene.id);
  const [recordOAtTimestamp] = useSceneRecordOAtTimestamp(scene.id); // CUSTOM

  const [incrementPlay] = useSceneIncrementPlayCount();

  function incrementPlayCount() {
    incrementPlay({
      variables: {
        id: scene.id,
      },
    });
  }

  const [organizedLoading, setOrganizedLoading] = useState(false);

  const [activeTabKey, setActiveTabKey] = useState("scene-details-panel");
  const [scenePanelCompact, setScenePanelCompact] = useState(false); // CUSTOM
  // CUSTOM: begin - every scrubber marker click gets a distinct latest-wins request
  const scrubberMarkerFocusRequestId = useRef(0);
  const [scrubberMarkerFocusRequest, setScrubberMarkerFocusRequest] =
    useState<ISceneMarkerFocusRequest>();
  // CUSTOM: end

  const [isMerging, setIsMerging] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState<boolean>(false);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);

  // CUSTOM: begin - Record O with video timestamp when available
  const onIncrementOClick = async () => {
    try {
      const playerPos = getPlayerPosition();
      if (playerPos !== undefined) {
        await recordOAtTimestamp({
          variables: { id: scene.id, video_timestamp: playerPos },
        });
        Toast.success(formatORecordedToastCustom(playerPos));
      } else {
        await incrementO();
        Toast.success(formatORecordedToastCustom());
      }
    } catch (e) {
      Toast.error(e);
    }
  };
  // CUSTOM: end

  // set up hotkeys
  useEffect(() => {
    Mousetrap.bind("a", () => setActiveTabKey("scene-details-panel"));
    Mousetrap.bind("q", () => setActiveTabKey("scene-queue-panel"));
    Mousetrap.bind("e", () => setActiveTabKey("scene-edit-panel"));
    Mousetrap.bind("k", () => setActiveTabKey("scene-markers-panel"));
    Mousetrap.bind("i", () => setActiveTabKey("scene-file-info-panel"));
    Mousetrap.bind("h", () => setActiveTabKey("scene-history-panel"));
    if (isSceneOHotkeyEnabled) {
      Mousetrap.bind("o", () => {
        onIncrementOClick();
      });
    }
    Mousetrap.bind("p n", () => onQueueNext());
    Mousetrap.bind("p p", () => onQueuePrevious());
    Mousetrap.bind("p r", () => onQueueRandom());
    Mousetrap.bind(",", () => setCollapsed(!collapsed));
    Mousetrap.bind("d d", () => setIsDeleteAlertOpen(true));
    Mousetrap.bind("c c", () => {
      onGenerateScreenshot(getPlayerPosition());
    });
    Mousetrap.bind("c d", () => {
      onGenerateScreenshot();
    });

    return () => {
      Mousetrap.unbind("a");
      Mousetrap.unbind("q");
      Mousetrap.unbind("e");
      Mousetrap.unbind("k");
      Mousetrap.unbind("i");
      Mousetrap.unbind("h");
      Mousetrap.unbind("o");
      Mousetrap.unbind("d d");
      Mousetrap.unbind("p n");
      Mousetrap.unbind("p p");
      Mousetrap.unbind("p r");
      Mousetrap.unbind(",");
      Mousetrap.unbind("c c");
      Mousetrap.unbind("c d");
    };
  });

  async function onSave(input: GQL.SceneCreateInput) {
    await updateScene({
      variables: {
        input: {
          id: scene.id,
          ...input,
        },
      },
    });
    Toast.success(
      intl.formatMessage(
        { id: "toast.updated_entity" },
        { entity: intl.formatMessage({ id: "scene" }).toLocaleLowerCase() }
      )
    );
  }

  const onOrganizedClick = async () => {
    try {
      setOrganizedLoading(true);
      await updateScene({
        variables: {
          input: {
            id: scene.id,
            organized: !scene.organized,
          },
        },
      });
    } catch (e) {
      Toast.error(e);
    } finally {
      setOrganizedLoading(false);
    }
  };

  const onClickMarker = useCallback(
    (marker: GQL.SceneMarkerDataFragment, seekSeconds = marker.seconds) => {
      const abLoopPlugin = getAbLoopPlugin();
      const opts = abLoopPlugin?.getOptions();
      const start = opts?.start;
      const end = opts?.end;

      const hasLoopRange =
        opts?.enabled &&
        typeof start === "number" &&
        typeof end === "number" &&
        Number.isFinite(start) &&
        Number.isFinite(end);

      if (
        abLoopPlugin &&
        opts &&
        hasLoopRange &&
        (seekSeconds < Math.min(start as number, end as number) ||
          seekSeconds > Math.max(start as number, end as number))
      ) {
        abLoopPlugin.setOptions({
          ...opts,
          enabled: false,
        });
      }

      setTimestamp(seekSeconds);
    },
    [setTimestamp]
  );

  // CUSTOM: begin - surface clicked scrubber markers in the Markers tab
  const focusScrubberMarker = useCallback(
    (markerId: string, seconds: number) => {
      const marker = scene.scene_markers.find(
        (sceneMarker) => sceneMarker.id === markerId
      );

      if (!marker) return;

      setActiveTabKey("scene-markers-panel");
      scrubberMarkerFocusRequestId.current += 1;
      setScrubberMarkerFocusRequest({
        markerId,
        requestId: scrubberMarkerFocusRequestId.current,
      });
      onClickMarker(marker, seconds);
    },
    [onClickMarker, scene.scene_markers]
  );

  useEffect(() => {
    const onScrubberMarkerClick = (event: Event) => {
      const { markerId, seconds } =
        (event as CustomEvent<{ markerId?: string; seconds?: number }>)
          .detail ?? {};

      if (markerId && seconds !== undefined) {
        focusScrubberMarker(markerId, seconds);
      }
    };

    window.addEventListener(
      "stash:scene-marker-scrubber-click",
      onScrubberMarkerClick
    );

    return () => {
      window.removeEventListener(
        "stash:scene-marker-scrubber-click",
        onScrubberMarkerClick
      );
    };
  }, [focusScrubberMarker]);

  const onScrubberMarkerFocusHandled = useCallback((requestId: number) => {
    setScrubberMarkerFocusRequest((currentRequest) =>
      completeSceneMarkerFocusRequest(currentRequest, requestId)
    );
  }, []);
  // CUSTOM: end

  async function onRescan() {
    await mutateMetadataScan({
      paths: [objectPath(scene)],
      rescan: true,
    });

    Toast.success(
      intl.formatMessage(
        { id: "toast.rescanning_entity" },
        {
          count: 1,
          singularEntity: intl
            .formatMessage({ id: "scene" })
            .toLocaleLowerCase(),
        }
      )
    );
  }

  async function onGenerateScreenshot(at?: number) {
    await generateScreenshot({
      variables: {
        id: scene.id,
        at,
      },
    });
    Toast.success(intl.formatMessage({ id: "toast.generating_screenshot" }));
  }

  function onDeleteDialogClosed(deleted: boolean) {
    setIsDeleteAlertOpen(false);
    if (deleted) {
      onDelete();
    }
  }

  function maybeRenderMergeDialog() {
    if (!scene.id) return;
    return (
      <SceneMergeModal
        show={isMerging}
        onClose={(mergedId) => {
          setIsMerging(false);
          if (mergedId !== undefined && mergedId !== scene.id) {
            // By default, the merge destination is the current scene, but
            // the user can change it, in which case we need to redirect.
            history.replace(`/scenes/${mergedId}`);
          }
        }}
        scenes={[{ id: scene.id, title: objectTitle(scene) }]}
      />
    );
  }

  function maybeRenderDeleteDialog() {
    if (isDeleteAlertOpen) {
      return (
        <DeleteScenesDialog selected={[scene]} onClose={onDeleteDialogClosed} />
      );
    }
  }

  function maybeRenderSceneGenerateDialog() {
    if (isGenerateDialogOpen) {
      return (
        <GenerateDialog
          selectedIds={[scene.id]}
          onClose={() => {
            setIsGenerateDialogOpen(false);
          }}
          type="scene"
        />
      );
    }
  }

  const renderOperations = () => (
    <Dropdown>
      <Dropdown.Toggle
        variant="secondary"
        id="operation-menu"
        className="minimal"
        title={intl.formatMessage({ id: "operations" })}
      >
        <Icon icon={faEllipsisV} />
      </Dropdown.Toggle>
      <Dropdown.Menu className="bg-secondary text-white">
        {!!scene.files.length && (
          <Dropdown.Item
            key="rescan"
            className="bg-secondary text-white"
            onClick={() => onRescan()}
          >
            <FormattedMessage id="actions.rescan" />
          </Dropdown.Item>
        )}
        <Dropdown.Item
          key="generate"
          className="bg-secondary text-white"
          onClick={() => setIsGenerateDialogOpen(true)}
        >
          <FormattedMessage id="actions.generate" />…
        </Dropdown.Item>
        <Dropdown.Item
          key="generate-screenshot"
          className="bg-secondary text-white"
          onClick={() => onGenerateScreenshot(getPlayerPosition())}
        >
          <FormattedMessage id="actions.generate_thumb_from_current" />
        </Dropdown.Item>
        <Dropdown.Item
          key="generate-default"
          className="bg-secondary text-white"
          onClick={() => onGenerateScreenshot()}
        >
          <FormattedMessage id="actions.generate_thumb_default" />
        </Dropdown.Item>
        {boxes.length > 0 && (
          <Dropdown.Item
            key="submit"
            className="bg-secondary text-white"
            onClick={() => setShowDraftModal(true)}
          >
            <FormattedMessage id="actions.submit_stash_box" />
          </Dropdown.Item>
        )}
        <Dropdown.Item
          key="merge-scene"
          className="bg-secondary text-white"
          onClick={() => setIsMerging(true)}
        >
          <FormattedMessage id="actions.merge" />
          ...
        </Dropdown.Item>
        <Dropdown.Item
          key="delete-scene"
          className="bg-secondary text-white"
          onClick={() => setIsDeleteAlertOpen(true)}
        >
          <FormattedMessage
            id="actions.delete"
            values={{ entityType: intl.formatMessage({ id: "scene" }) }}
          />
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );

  const renderTabs = () => (
    <Tab.Container
      activeKey={activeTabKey}
      onSelect={(k) => k && setActiveTabKey(k)}
    >
      <div className="scene-tab-row">
        <Nav variant="tabs" className="mr-auto">
          <ScenePageTabs {...props}>
            <Nav.Item>
              <Nav.Link eventKey="scene-details-panel">
                <FormattedMessage id="details" />
              </Nav.Link>
            </Nav.Item>
            {queueScenes.length > 0 ? (
              <Nav.Item>
                <Nav.Link eventKey="scene-queue-panel">
                  <FormattedMessage id="queue" />
                </Nav.Link>
              </Nav.Item>
            ) : (
              ""
            )}
            <Nav.Item>
              <Nav.Link eventKey="scene-markers-panel">
                <FormattedMessage id="markers" />
              </Nav.Link>
            </Nav.Item>
            {/* CUSTOM: begin - negative markers tab */}
            <Nav.Item>
              <Nav.Link eventKey="scene-negative-markers-panel">
                <FormattedMessage id="negative_markers" defaultMessage="Skip" />
                <Counter count={scene.negative_markers?.length ?? 0} hideZero />
              </Nav.Link>
            </Nav.Item>
            {/* CUSTOM: end */}
            {scene.groups.length > 0 ? (
              <Nav.Item>
                <Nav.Link eventKey="scene-group-panel">
                  <FormattedMessage
                    id="countables.groups"
                    values={{ count: scene.groups.length }}
                  />
                </Nav.Link>
              </Nav.Item>
            ) : (
              ""
            )}
            {scene.galleries.length >= 1 ? (
              <Nav.Item>
                <Nav.Link eventKey="scene-galleries-panel">
                  <FormattedMessage
                    id="countables.galleries"
                    values={{ count: scene.galleries.length }}
                  />
                </Nav.Link>
              </Nav.Item>
            ) : undefined}
            <Nav.Item>
              <Nav.Link eventKey="scene-video-filter-panel">
                <FormattedMessage id="effect_filters.name" />
              </Nav.Link>
            </Nav.Item>
            {/* CUSTOM: begin - releases tab */}
            <Nav.Item>
              <Nav.Link eventKey="scene-releases-panel">
                Releases
                <Counter count={scene.releases?.length ?? 0} hideZero />
              </Nav.Link>
            </Nav.Item>
            {/* CUSTOM: end */}
            <Nav.Item>
              <Nav.Link eventKey="scene-file-info-panel">
                <FormattedMessage id="file_info" />
                <Counter count={scene.files.length} hideZero hideOne />
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="scene-history-panel">
                <FormattedMessage id="history" />
              </Nav.Link>
            </Nav.Item>
            {/* CUSTOM: begin - stats tab */}
            <Nav.Item>
              <Nav.Link eventKey="scene-stats-panel">Stats</Nav.Link>
            </Nav.Item>
            {/* CUSTOM: end */}
            <Nav.Item>
              <Nav.Link eventKey="scene-edit-panel">
                <FormattedMessage id="actions.edit" />
              </Nav.Link>
            </Nav.Item>
          </ScenePageTabs>
        </Nav>
        {/* CUSTOM: begin - details panel vertical expansion toggle */}
        <Button
          className="scene-panel-density-toggle minimal"
          variant="secondary"
          onClick={() => setScenePanelCompact((current) => !current)}
          title={
            scenePanelCompact ? "Show scene header" : "Expand panel vertically"
          }
        >
          <Icon icon={scenePanelCompact ? faCompress : faExpand} />
        </Button>
        {/* CUSTOM: end */}
      </div>

      {/* CUSTOM: preserve Bootstrap row gutters in the clipped upstream panes */}
      <Tab.Content
        className={cx({
          "scene-tab-content-bootstrap-gutters": ![
            "scene-negative-markers-panel",
            "scene-releases-panel",
            "scene-stats-panel",
          ].includes(activeTabKey),
        })}
      >
        <ScenePageTabContent {...props}>
          <Tab.Pane eventKey="scene-details-panel">
            <SceneDetailPanel scene={scene} />
          </Tab.Pane>
          <Tab.Pane eventKey="scene-queue-panel">
            <QueueViewer
              scenes={queueScenes}
              currentID={scene.id}
              continue={continuePlaylist}
              setContinue={setContinuePlaylist}
              onSceneClicked={onQueueSceneClicked}
              onNext={onQueueNext}
              onPrevious={onQueuePrevious}
              onRandom={onQueueRandom}
              start={queueStart}
              hasMoreScenes={queueHasMoreScenes}
              onLessScenes={onQueueLessScenes}
              onMoreScenes={onQueueMoreScenes}
            />
          </Tab.Pane>
          <Tab.Pane eventKey="scene-markers-panel">
            <SceneMarkersPanel
              sceneId={scene.id}
              onClickMarker={onClickMarker}
              isVisible={activeTabKey === "scene-markers-panel"}
              addMultiSegmentLoopSegments={addMultiSegmentLoopSegments} // CUSTOM
              currentTimestamp={currentTimestamp} // CUSTOM
              focusedMarkerRequest={scrubberMarkerFocusRequest} // CUSTOM
              onFocusedMarkerHandled={onScrubberMarkerFocusHandled} // CUSTOM
              markerTimestampCopyRequest={markerTimestampCopyRequest} // CUSTOM
              markerTimestampCopySelection={markerTimestampCopySelection} // CUSTOM
              onMarkerTimestampCopyRequest={onMarkerTimestampCopyRequest} // CUSTOM
              onMarkerTimestampCopySelectionHandled={
                onMarkerTimestampCopySelectionHandled
              } // CUSTOM
            />
          </Tab.Pane>
          {/* CUSTOM: begin - negative markers pane */}
          <Tab.Pane eventKey="scene-negative-markers-panel">
            <SceneNegativeMarkersPanel
              scene={scene}
              isVisible={activeTabKey === "scene-negative-markers-panel"}
              onRefetch={props.onRefetch}
              markerTimestampCopyRequest={markerTimestampCopyRequest} // CUSTOM
              markerTimestampCopySelection={markerTimestampCopySelection} // CUSTOM
              onMarkerTimestampCopyRequest={onMarkerTimestampCopyRequest} // CUSTOM
              onMarkerTimestampCopySelectionHandled={
                onMarkerTimestampCopySelectionHandled
              } // CUSTOM
            />
          </Tab.Pane>
          {/* CUSTOM: end */}
          <Tab.Pane eventKey="scene-group-panel">
            <SceneGroupPanel scene={scene} />
          </Tab.Pane>
          {scene.galleries.length >= 1 && (
            <Tab.Pane eventKey="scene-galleries-panel">
              <SceneGalleriesPanel galleries={scene.galleries} />
              {scene.galleries.length === 1 && (
                <GalleryViewer galleryId={scene.galleries[0].id} />
              )}
            </Tab.Pane>
          )}
          <Tab.Pane eventKey="scene-video-filter-panel">
            <SceneVideoFilterPanel scene={scene} />
          </Tab.Pane>
          {/* CUSTOM: begin - releases pane */}
          <Tab.Pane eventKey="scene-releases-panel">
            <SceneReleasesPanel
              scene={scene}
              activeReleaseId={activeReleaseId}
              onSetActiveRelease={setActiveReleaseId}
              onRefetch={props.onRefetch}
            />
          </Tab.Pane>
          {/* CUSTOM: end */}
          <Tab.Pane
            className="file-info-panel"
            eventKey="scene-file-info-panel"
          >
            <SceneFileInfoPanel scene={scene} />
          </Tab.Pane>
          <Tab.Pane eventKey="scene-edit-panel" mountOnEnter>
            <SceneEditPanel
              isVisible={activeTabKey === "scene-edit-panel"}
              scene={scene}
              onSubmit={onSave}
              onDelete={() => setIsDeleteAlertOpen(true)}
            />
          </Tab.Pane>
          <Tab.Pane eventKey="scene-history-panel">
            <SceneHistoryPanel scene={scene} />
          </Tab.Pane>
          {/* CUSTOM: begin - stats pane */}
          <Tab.Pane eventKey="scene-stats-panel">
            <SceneStatsPanel
              scene={scene}
              addMultiSegmentLoopSegments={addMultiSegmentLoopSegments}
            />
          </Tab.Pane>
          {/* CUSTOM: end */}
        </ScenePageTabContent>
      </Tab.Content>
    </Tab.Container>
  );

  function getCollapseButtonIcon() {
    return collapsed ? faChevronRight : faChevronLeft;
  }

  const title = objectTitle(scene);

  const file = useMemo(
    () => (scene.files.length > 0 ? scene.files[0] : undefined),
    [scene]
  );

  // CUSTOM: begin - role tag icon logic
  // Determine which icon to show based on scene markers with role tags
  const iconToShow = useMemo(() => {
    type SceneIconToShow =
      | {
          type: "straight" | "gay" | "mouth";
          className: string;
          title: string;
        }
      | {
          type: "hand";
          icon: IconDefinition;
          className: string;
          title: string;
        }
      | null;

    // Get role tag IDs from configuration
    const roleTagIds = configuration?.ui?.roleTagIds ?? {};
    const { sexTagId } = roleTagIds;
    const { oralTagId } = roleTagIds;
    const { soloTagId } = roleTagIds;

    // Get scene marker tag IDs
    const markerTagIds = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sceneMarkers = (scene as any).scene_markers ?? [];
    for (const marker of sceneMarkers) {
      // Check if this is an oral marker
      const isOralMarker =
        (marker?.primary_tag?.id && marker.primary_tag.id === oralTagId) ||
        (marker?.tags ?? []).some(
          (tag: { id?: string }) => tag?.id === oralTagId
        );

      // Add oral markers to tag set
      if (isOralMarker && oralTagId) {
        markerTagIds.add(oralTagId);
      }

      // Add non-oral tag IDs normally
      if (marker?.primary_tag?.id) {
        if (marker.primary_tag.id === sexTagId)
          markerTagIds.add(marker.primary_tag.id);
        if (marker.primary_tag.id === soloTagId)
          markerTagIds.add(marker.primary_tag.id);
      }
      const markerTags: Array<{ id?: string }> = marker?.tags ?? [];
      for (const tag of markerTags) {
        if (tag?.id) {
          if (tag.id === sexTagId) markerTagIds.add(tag.id);
          if (tag.id === soloTagId) markerTagIds.add(tag.id);
        }
      }
    }

    // Priority: sex > oral > solo
    if (sexTagId && markerTagIds.has(sexTagId)) {
      return {
        type: "gay",
        className: "scene-gay-icon",
        title: "Scene has sex markers",
      } as SceneIconToShow;
    }

    if (oralTagId && markerTagIds.has(oralTagId)) {
      return {
        type: "mouth",
        className: "scene-mouth-icon",
        title: "Scene has oral markers",
      } as SceneIconToShow;
    }

    if (soloTagId && markerTagIds.has(soloTagId)) {
      return {
        type: "hand",
        icon: faHand,
        className: "scene-hand-icon",
        title: "Scene has solo markers",
      } as SceneIconToShow;
    }

    return null;
  }, [scene, configuration?.ui]);
  // CUSTOM: end

  return (
    <ScenePerformerOverviewProvider scene={scene}>
      {/* CUSTOM: scene-scoped vato overview drawer */}
      <Helmet>
        <title>{title}</title>
      </Helmet>
      {maybeRenderSceneGenerateDialog()}
      {maybeRenderMergeDialog()}
      {maybeRenderDeleteDialog()}
      <div
        className={cx("scene-tabs order-xl-first order-last", {
          collapsed,
          "scene-tabs-compact": scenePanelCompact, // CUSTOM
        })}
      >
        <div className="scene-overview">
          <div className="scene-header-container">
            <StudioLogo studio={scene.studio} showText={showStudioText} />
            <h3 className={cx("scene-header", { "no-studio": !scene.studio })}>
              {/* CUSTOM: begin - role icon in header */}
              <span style={{ display: "flex", alignItems: "center" }}>
                {iconToShow?.type === "mouth" ? (
                  <img
                    src={mouthSvg}
                    alt={iconToShow.title}
                    title={iconToShow.title}
                    className={iconToShow.className}
                  />
                ) : iconToShow?.type === "gay" ? (
                  <img
                    src={gaySvg}
                    alt={iconToShow.title}
                    title={iconToShow.title}
                    className={iconToShow.className}
                  />
                ) : iconToShow?.type === "straight" ? (
                  <img
                    src={straightSvg}
                    alt={iconToShow.title}
                    title={iconToShow.title}
                    className={iconToShow.className}
                  />
                ) : iconToShow?.type === "hand" ? (
                  <Icon
                    icon={iconToShow.icon}
                    className={iconToShow.className}
                    title={iconToShow.title}
                  />
                ) : null}
                <TruncatedText lineCount={2} text={title} />
              </span>
              {/* CUSTOM: end */}
            </h3>
          </div>

          {/* CUSTOM: scene activity duration metrics */}
          <SceneActivityMetrics
            scene={scene}
            className="scene-activity-metrics--detail"
          />

          <div className="scene-subheader">
            <span
              className="date"
              data-value={scene.effective_date ?? scene.date ?? undefined}
            >
              {" "}
              {/* CUSTOM: effective_date */}
              {(scene.effective_date ?? scene.date) && (
                <FormattedDate value={(scene.effective_date ?? scene.date)!} />
              )}{" "}
              {/* CUSTOM: effective_date */}
            </span>
            <VideoFrameRateResolution
              width={file?.width}
              height={file?.height}
              frameRate={file?.frame_rate}
            />
          </div>

          <div className="scene-toolbar">
            <span className="scene-toolbar-group">
              <RatingAdvisorButton
                entityType="scene"
                entityId={scene.id}
                sceneRatingMode={getSceneRatingModeCustom(
                  scene.performers.length,
                  iconToShow?.type === "hand"
                )}
                rating100={scene.rating100}
                ratingScores={scene.rating_scores}
                onRatingSaved={props.onRefetch}
              />{" "}
              {/* CUSTOM */}
            </span>
            <span className="scene-toolbar-group">
              <span>
                <ExternalPlayerButton scene={scene} />
              </span>
              <span>
                <ViewCountButton
                  value={scene.play_count ?? 0}
                  onIncrement={() => incrementPlayCount()}
                />
              </span>
              <span>
                <OCounterButton
                  value={scene.o_counter ?? 0}
                  onIncrement={() => onIncrementOClick()}
                />
              </span>
              <span>
                <OrganizedButton
                  loading={organizedLoading}
                  organized={scene.organized}
                  onClick={onOrganizedClick}
                />
              </span>
              <span>{renderOperations()}</span>
            </span>
          </div>
        </div>
        {renderTabs()}
      </div>
      <div className="scene-divider d-none d-xl-block">
        <Button onClick={() => setCollapsed(!collapsed)}>
          <Icon className="fa-fw" icon={getCollapseButtonIcon()} />
        </Button>
      </div>
      <SubmitStashBoxDraft
        type="scene"
        boxes={boxes}
        entity={scene}
        show={showDraftModal}
        onHide={() => setShowDraftModal(false)}
      />
    </ScenePerformerOverviewProvider>
  );
});

const SceneLoader: React.FC<RouteComponentProps<ISceneParams>> = ({
  location,
  history,
  match,
}) => {
  const { id } = match.params;
  const { configuration } = useConfigurationContext();
  const { data, loading, error, refetch } = useFindScene(id); // CUSTOM: refetch

  const [scene, setScene] = useState<GQL.SceneDataFragment>();

  // useLayoutEffect to update before paint
  useLayoutEffect(() => {
    // only update scene when loading is done
    if (!loading) {
      setScene(data?.findScene ?? undefined);
    }
  }, [data, loading]);

  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );
  const sceneQueue = useMemo(
    () => SceneQueue.fromQueryParameters(queryParams),
    [queryParams]
  );
  const queryContinue = useMemo(() => {
    let cont = queryParams.get("continue");
    if (cont) {
      return cont === "true";
    } else {
      return !!configuration?.interface.continuePlaylistDefault;
    }
  }, [configuration?.interface.continuePlaylistDefault, queryParams]);

  const [queueScenes, setQueueScenes] = useState<QueuedScene[]>([]);

  const [collapsed, setCollapsed] = useState(false);
  const [continuePlaylist, setContinuePlaylist] = useState(queryContinue);
  const [hideScrubber, setHideScrubber] = useState(
    !(configuration?.interface.showScrubber ?? true)
  );
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(0); // CUSTOM
  // CUSTOM: begin - route marker boundary selections back to the form field
  // that requested a copied timestamp.
  const markerTimestampCopyRequestId = useRef(0);
  const [markerTimestampCopyRequest, setMarkerTimestampCopyRequest] =
    useState<ISceneMarkerTimestampCopyRequest>();
  const [markerTimestampCopySelection, setMarkerTimestampCopySelection] =
    useState<ISceneMarkerTimestampCopySelection>();

  const onMarkerTimestampCopyRequest = useCallback(
    (
      field: SceneMarkerTimestampField | undefined,
      destination: SceneMarkerTimestampDestination
    ) => {
      setMarkerTimestampCopySelection((currentSelection) =>
        field || currentSelection?.destination === destination
          ? undefined
          : currentSelection
      );
      setMarkerTimestampCopyRequest((currentRequest) => {
        if (!field) {
          return currentRequest?.destination === destination
            ? undefined
            : currentRequest;
        }
        if (
          currentRequest?.field === field &&
          currentRequest.destination === destination
        ) {
          return undefined;
        }

        markerTimestampCopyRequestId.current += 1;
        return {
          field,
          destination,
          requestId: markerTimestampCopyRequestId.current,
        };
      });
    },
    []
  );

  const onMarkerTimestampCopySelectionHandled = useCallback(
    (requestId: number) => {
      setMarkerTimestampCopySelection((currentSelection) =>
        currentSelection?.requestId === requestId ? undefined : currentSelection
      );
    },
    []
  );

  useEffect(() => {
    setMarkerTimestampCopyRequest(undefined);
    setMarkerTimestampCopySelection(undefined);
  }, [id]);
  // CUSTOM: end

  const _setTimestamp = useRef<(value: number) => void>();
  const _multiSegmentLoopApi = useRef<IMultiSegmentLoopApi | null>(null); // CUSTOM
  const initialTimestamp = useMemo(() => {
    const t = queryParams.get("t");
    if (!t) return 0;

    const n = Number(t);
    if (Number.isNaN(n)) return 0;
    return n;
  }, [queryParams]);

  const [queueTotal, setQueueTotal] = useState(0);
  const [queueStart, setQueueStart] = useState(1);

  // CUSTOM: begin - active release playback state
  // State for active release playback
  const [activeReleaseId, setActiveReleaseId] = useState<string | null>(null);

  // Create a modified scene for player that uses release files and streams when a release is active
  const sceneForPlayer = useMemo((): GQL.SceneDataFragment | undefined => {
    if (!scene) {
      return undefined;
    }
    if (!activeReleaseId || !scene.releases) {
      return scene;
    }

    const activeRelease = scene.releases.find((r) => r.id === activeReleaseId);
    if (
      !activeRelease ||
      !activeRelease.files ||
      activeRelease.files.length === 0
    ) {
      return scene;
    }

    // Swap the scene files and streams with release files and streams
    return {
      ...scene,
      files: activeRelease.files,
      sceneStreams: activeRelease.streams,
    };
  }, [scene, activeReleaseId]);
  // CUSTOM: end

  const autoplay = queryParams.get("autoplay") === "true";
  const autoPlayOnSelected =
    configuration?.interface.autostartVideoOnPlaySelected ?? false;

  const currentQueueIndex = useMemo(
    () => queueScenes.findIndex((s) => s.id === id),
    [queueScenes, id]
  );

  function getSetTimestamp(fn: (value: number) => void) {
    _setTimestamp.current = fn;
  }

  // CUSTOM: begin - multi-segment loop API
  function getMultiSegmentLoopApi(api: IMultiSegmentLoopApi) {
    _multiSegmentLoopApi.current = api;
  }

  function addMultiSegmentLoopSegments(segments: ILoopSegmentInput[]) {
    _multiSegmentLoopApi.current?.addSegments(
      filterLoopSegmentsOutsideNegativeMarkers(
        segments,
        scene?.negative_markers
      )
    );
  }
  // CUSTOM: end

  function setTimestamp(value: number) {
    if (_setTimestamp.current) {
      _setTimestamp.current(value);
    }
  }

  // set up hotkeys
  useEffect(() => {
    Mousetrap.bind(".", () => setHideScrubber((value) => !value));

    return () => {
      Mousetrap.unbind(".");
    };
  }, []);

  async function getQueueFilterScenes(filter: ListFilterModel) {
    const query = await queryFindScenes(filter);
    const { scenes, count } = query.data.findScenes;
    setQueueScenes(scenes);
    setQueueTotal(count);
    setQueueStart((filter.currentPage - 1) * filter.itemsPerPage + 1);
  }

  async function getQueueScenes(sceneIDs: number[]) {
    const query = await queryFindScenesByID(sceneIDs);
    const { scenes, count } = query.data.findScenes;
    setQueueScenes(scenes);
    setQueueTotal(count);
    setQueueStart(1);
  }

  useEffect(() => {
    if (sceneQueue.query) {
      getQueueFilterScenes(sceneQueue.query);
    } else if (sceneQueue.sceneIDs) {
      getQueueScenes(sceneQueue.sceneIDs);
    }
  }, [sceneQueue]);

  async function onQueueLessScenes() {
    if (!sceneQueue.query || queueStart <= 1) {
      return;
    }

    const filterCopy = sceneQueue.query.clone();
    const newStart = queueStart - filterCopy.itemsPerPage;
    filterCopy.currentPage = Math.ceil(newStart / filterCopy.itemsPerPage);
    const query = await queryFindScenes(filterCopy);
    const { scenes } = query.data.findScenes;

    // prepend scenes to scene list
    const newScenes = (scenes as QueuedScene[]).concat(queueScenes);
    setQueueScenes(newScenes);
    setQueueStart(newStart);

    return scenes;
  }

  const queueHasMoreScenes = useMemo(() => {
    return queueStart + queueScenes.length - 1 < queueTotal;
  }, [queueStart, queueScenes, queueTotal]);

  async function onQueueMoreScenes() {
    if (!sceneQueue.query || !queueHasMoreScenes) {
      return;
    }

    const filterCopy = sceneQueue.query.clone();
    const newStart = queueStart + queueScenes.length;
    filterCopy.currentPage = Math.ceil(newStart / filterCopy.itemsPerPage);
    const query = await queryFindScenes(filterCopy);
    const { scenes } = query.data.findScenes;

    // append scenes to scene list
    const newScenes = queueScenes.concat(scenes);
    setQueueScenes(newScenes);
    // don't change queue start
    return scenes;
  }

  function loadScene(sceneID: string, autoPlay?: boolean, newPage?: number) {
    const sceneLink = sceneQueue.makeLink(sceneID, {
      newPage,
      autoPlay,
      continue: continuePlaylist,
    });
    history.replace(sceneLink);
  }

  async function queueNext(autoPlay: boolean) {
    if (currentQueueIndex === -1) return;

    if (currentQueueIndex < queueScenes.length - 1) {
      loadScene(queueScenes[currentQueueIndex + 1].id, autoPlay);
    } else {
      // if we're at the end of the queue, load more scenes
      if (currentQueueIndex === queueScenes.length - 1 && queueHasMoreScenes) {
        const loadedScenes = await onQueueMoreScenes();
        if (loadedScenes && loadedScenes.length > 0) {
          // set the page to the next page
          const newPage = (sceneQueue.query?.currentPage ?? 0) + 1;
          loadScene(loadedScenes[0].id, autoPlay, newPage);
        }
      }
    }
  }

  async function queuePrevious(autoPlay: boolean) {
    if (currentQueueIndex === -1) return;

    if (currentQueueIndex > 0) {
      loadScene(queueScenes[currentQueueIndex - 1].id, autoPlay);
    } else {
      // if we're at the beginning of the queue, load the previous page
      if (queueStart > 1) {
        const loadedScenes = await onQueueLessScenes();
        if (loadedScenes && loadedScenes.length > 0) {
          const newPage = (sceneQueue.query?.currentPage ?? 0) - 1;
          loadScene(
            loadedScenes[loadedScenes.length - 1].id,
            autoPlay,
            newPage
          );
        }
      }
    }
  }

  async function queueRandom(autoPlay: boolean) {
    if (sceneQueue.query) {
      const { query } = sceneQueue;
      const pages = Math.ceil(queueTotal / query.itemsPerPage);
      const page = Math.floor(Math.random() * pages) + 1;
      const index = Math.floor(
        Math.random() * Math.min(query.itemsPerPage, queueTotal)
      );
      const filterCopy = sceneQueue.query.clone();
      filterCopy.currentPage = page;
      const queryResults = await queryFindScenes(filterCopy);
      if (queryResults.data.findScenes.scenes.length > index) {
        const { id: sceneID } = queryResults.data.findScenes.scenes[index];
        // navigate to the image player page
        loadScene(sceneID, autoPlay, page);
      }
    } else if (queueTotal !== 0) {
      const index = Math.floor(Math.random() * queueTotal);
      loadScene(queueScenes[index].id, autoPlay);
    }
  }

  function onComplete() {
    // load the next scene if we're continuing
    if (continuePlaylist) {
      queueNext(true);
    }
  }

  // CUSTOM: begin - bridge player scrubber marker clicks to ScenePage tabs
  const onScenePlayerMarkerClick = useCallback(
    (
      markerId: string,
      seconds: number,
      boundary?: SceneMarkerTimestampBoundary,
      sourceKind: SceneMarkerTimestampSourceKind = "scene-marker"
    ) => {
      // CUSTOM: timestamp-copy mode consumes the marker click and leaves the
      // Create Marker form open instead of focusing the source marker card.
      if (markerTimestampCopyRequest) {
        if (!boundary) return;

        let sourceMarker: ISceneMarkerTimestampSource | undefined;
        if (sourceKind === "negative-marker") {
          const negativeMarker = scene?.negative_markers.find(
            (candidate) => candidate.id === markerId
          );
          if (negativeMarker) {
            sourceMarker = {
              id: negativeMarker.id,
              seconds: negativeMarker.start_seconds,
              end_seconds: negativeMarker.end_seconds,
            };
          }
        } else {
          sourceMarker = scene?.scene_markers.find(
            (sceneMarker) => sceneMarker.id === markerId
          );
        }
        if (!sourceMarker) return;

        const selection = resolveSceneMarkerTimestampCopySelection(
          markerTimestampCopyRequest,
          sourceMarker,
          boundary
        );
        if (!selection) return;

        setMarkerTimestampCopySelection(selection);
        setMarkerTimestampCopyRequest(undefined);
        return;
      }

      window.dispatchEvent(
        new CustomEvent("stash:scene-marker-scrubber-click", {
          detail: { markerId, seconds },
        })
      );
    },
    [markerTimestampCopyRequest, scene?.negative_markers, scene?.scene_markers]
  );
  // CUSTOM: end

  function onDelete() {
    if (
      continuePlaylist &&
      currentQueueIndex >= 0 &&
      currentQueueIndex < queueScenes.length - 1
    ) {
      loadScene(queueScenes[currentQueueIndex + 1].id);
    } else {
      history.goBack(); // CUSTOM: goBack instead of goBackOrReplace
    }
  }

  function getScenePage(sceneID: string) {
    if (!sceneQueue.query) return;

    // find the page that the scene is on
    const index = queueScenes.findIndex((s) => s.id === sceneID);

    if (index === -1) return;

    const perPage = sceneQueue.query.itemsPerPage;
    return Math.floor((index + queueStart - 1) / perPage) + 1;
  }

  function onQueueSceneClicked(sceneID: string) {
    loadScene(sceneID, autoPlayOnSelected, getScenePage(sceneID));
  }

  if (!scene) {
    if (loading) return <LoadingIndicator />;
    if (error) return <ErrorMessage error={error.message} />;
    return <ErrorMessage error={`No scene found with id ${id}.`} />;
  }

  return (
    <div className="row">
      <ScenePage
        scene={scene}
        setTimestamp={setTimestamp}
        addMultiSegmentLoopSegments={addMultiSegmentLoopSegments}
        queueScenes={queueScenes}
        queueStart={queueStart}
        onDelete={onDelete}
        onQueueNext={() => queueNext(autoPlayOnSelected)}
        onQueuePrevious={() => queuePrevious(autoPlayOnSelected)}
        onQueueRandom={() => queueRandom(autoPlayOnSelected)}
        onQueueSceneClicked={onQueueSceneClicked}
        continuePlaylist={continuePlaylist}
        queueHasMoreScenes={queueHasMoreScenes}
        onQueueLessScenes={onQueueLessScenes}
        onQueueMoreScenes={onQueueMoreScenes}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        setContinuePlaylist={setContinuePlaylist}
        onRefetch={refetch} // CUSTOM
        activeReleaseId={activeReleaseId} // CUSTOM
        setActiveReleaseId={setActiveReleaseId} // CUSTOM
        currentTimestamp={currentTimestamp} // CUSTOM
        markerTimestampCopyRequest={markerTimestampCopyRequest} // CUSTOM
        markerTimestampCopySelection={markerTimestampCopySelection} // CUSTOM
        onMarkerTimestampCopyRequest={onMarkerTimestampCopyRequest} // CUSTOM
        onMarkerTimestampCopySelectionHandled={
          onMarkerTimestampCopySelectionHandled
        } // CUSTOM
      />
      <div className={`scene-player-container ${collapsed ? "expanded" : ""}`}>
        <ScenePlayer
          key={`ScenePlayer-${activeReleaseId || "main"}`} // CUSTOM: release-aware key
          scene={sceneForPlayer!} // CUSTOM: sceneForPlayer
          hideScrubberOverride={hideScrubber}
          autoplay={autoplay}
          permitLoop={!continuePlaylist}
          initialTimestamp={initialTimestamp}
          sendSetTimestamp={getSetTimestamp}
          sendMultiSegmentLoopApi={getMultiSegmentLoopApi} // CUSTOM
          onTimeChange={setCurrentTimestamp} // CUSTOM
          onMarkerClick={onScenePlayerMarkerClick} // CUSTOM
          markerTimestampCopyActive={!!markerTimestampCopyRequest} // CUSTOM
          onComplete={onComplete}
          onNext={() => queueNext(true)}
          onPrevious={() => queuePrevious(true)}
        />
      </div>
    </div>
  );
};

export default SceneLoader;
