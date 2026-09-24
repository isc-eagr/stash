import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Button,
  Card,
  Badge,
  Modal,
  Form,
  Accordion,
  Row,
  Col,
  Dropdown,
} from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { Prompt, useHistory } from "react-router-dom";
import { DateInput } from "src/components/Shared/DateInput";
import { ImageInput } from "src/components/Shared/ImageInput";
import * as GQL from "src/core/generated-graphql";
import {
  useSceneReleaseCreate,
  useSceneReleaseUpdate,
  useSceneReleaseDestroy,
  useSceneReleaseAddFile,
  useSceneReleaseRemoveFile,
  useConvertSceneToRelease,
  useConvertReleaseToScene,
} from "src/core/StashService";
import { useToast } from "src/hooks/Toast";
import { Icon } from "src/components/Shared/Icon";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import {
  faPlay,
  faPlus,
  faTrash,
  faExchangeAlt,
  faPencilAlt,
  faChevronDown,
  faChevronRight,
  faFile,
  faFilm,
  faMinus,
} from "@fortawesome/free-solid-svg-icons";
import { SceneSelectorDialog } from "./SceneSelectorDialog";
import { Studio, StudioSelect } from "src/components/Studios/StudioSelect";
import { Gallery, GallerySelect } from "src/components/Galleries/GallerySelect";
import {
  Performer,
  PerformerSelect,
} from "src/components/Performers/PerformerSelect";
import { Tag, TagSelect } from "src/components/Tags/TagSelect";
import { IGroupEntry, SceneGroupTable } from "./SceneGroupTable";
import {
  CustomFieldMap,
  CustomFieldsInput,
} from "src/components/Shared/CustomFields";
import ImageUtils from "src/utils/image";
import TextUtils from "src/utils/text";
import {
  summarizeReleaseConversionCustom,
  summarizeSceneConversionCustom,
} from "./sceneReleaseConversionSummary_custom"; // CUSTOM
import "./SceneReleasesPanel_custom.scss";

interface IReleaseFormData {
  title: string;
  code: string;
  urls: string;
  rating100: string;
  organized: boolean;
  date: string;
  details: string;
  director: string;
  studio_id: string;
  gallery_ids: string[];
  cover_image: string | null;
}

const emptyFormData: IReleaseFormData = {
  title: "",
  code: "",
  urls: "",
  rating100: "",
  organized: false,
  date: "",
  details: "",
  director: "",
  studio_id: "",
  gallery_ids: [],
  cover_image: null,
};

interface ISceneReleasesPanelProps {
  scene: GQL.SceneDataFragment;
  activeReleaseId: string | null;
  onSetActiveRelease: (releaseId: string | null) => void;
  onRefetch: () => void;
}

export const SceneReleasesPanel: React.FC<ISceneReleasesPanelProps> = ({
  scene,
  activeReleaseId,
  onSetActiveRelease,
  onRefetch,
}) => {
  const intl = useIntl();
  const Toast = useToast();
  const history = useHistory();
  // CUSTOM: preserve each request ID across network failures and retries.
  const conversionRequestIds = useRef(new Map<string, string>());
  const conversionRequestId = (key: string) => {
    let requestId = conversionRequestIds.current.get(key);
    if (!requestId) {
      requestId = window.crypto.randomUUID();
      conversionRequestIds.current.set(key, requestId);
    }
    return requestId;
  };

  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null);
  const [showSceneSelectorModal, setShowSceneSelectorModal] = useState(false);
  const [pendingConvertSceneId, setPendingConvertSceneId] = useState<
    string | null
  >(null); // scene selected, waiting for options
  const [showDeleteReleaseModal, setShowDeleteReleaseModal] = useState<
    string | null
  >(null);
  const [showAddFileModal, setShowAddFileModal] = useState<string | null>(null); // release ID
  const [showConvertToSceneModal, setShowConvertToSceneModal] = useState<
    string | null
  >(null); // release ID
  const [formData, setFormData] = useState<IReleaseFormData>(emptyFormData);
  const [selectedPerformers, setSelectedPerformers] = useState<Performer[]>([]);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [groupEntries, setGroupEntries] = useState<IGroupEntry[]>([]);
  const [stashIDs, setStashIDs] = useState<GQL.StashIdInput[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldMap>({});
  const [customFieldsError, setCustomFieldsError] = useState<string>();
  const [showDiscardReleaseModal, setShowDiscardReleaseModal] = useState(false);
  const releaseDraftBaseline = useRef<string | null>(null);
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(
    new Set()
  );
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const [showRemoveFileModal, setShowRemoveFileModal] = useState<{
    releaseId: string;
    fileId: string;
    fileName: string;
  } | null>(null);

  // For studio and gallery selects
  const [selectedStudio, setSelectedStudio] = useState<Studio | null>(null);
  const [selectedGalleries, setSelectedGalleries] = useState<Gallery[]>([]);

  const [createRelease, { loading: creating }] = useSceneReleaseCreate();
  const [updateRelease, { loading: updating }] = useSceneReleaseUpdate();
  const [destroyRelease, { loading: destroying }] = useSceneReleaseDestroy();
  const [addFileToRelease, { loading: addingFile }] = useSceneReleaseAddFile();
  const [removeFileFromRelease, { loading: removingFile }] =
    useSceneReleaseRemoveFile();
  const [convertScene, { loading: converting }] = useConvertSceneToRelease();
  const [convertReleaseToScene, { loading: convertingToScene }] =
    useConvertReleaseToScene();

  const { data: conversionSourceData, loading: conversionSourceLoading } =
    GQL.useFindSceneQuery({
      variables: { id: pendingConvertSceneId ?? "" },
      skip: !pendingConvertSceneId,
    }); // CUSTOM: show what the scene conversion moves
  const conversionSource = conversionSourceData?.findScene;
  const sourceSummary = conversionSource
    ? summarizeSceneConversionCustom(conversionSource)
    : undefined; // CUSTOM

  const releases = useMemo(() => scene.releases ?? [], [scene.releases]);
  const conversionRelease = releases.find(
    (release) => release.id === showConvertToSceneModal
  ); // CUSTOM
  const releaseSummary = conversionRelease
    ? summarizeReleaseConversionCustom(conversionRelease)
    : undefined; // CUSTOM
  const releaseDraftFingerprint = JSON.stringify({
    formData,
    studio: selectedStudio?.id,
    galleries: selectedGalleries.map((gallery) => gallery.id),
    performers: selectedPerformers.map((performer) => performer.id),
    tags: selectedTags.map((tag) => tag.id),
    groups: groupEntries.map((entry) => [entry.group.id, entry.scene_index]),
    stashIDs,
    customFields,
  });
  useEffect(() => {
    if (showReleaseModal && releaseDraftBaseline.current === null) {
      releaseDraftBaseline.current = releaseDraftFingerprint;
    }
  }, [showReleaseModal, releaseDraftFingerprint]);
  const releaseDraftDirty =
    showReleaseModal &&
    releaseDraftBaseline.current !== null &&
    releaseDraftBaseline.current !== releaseDraftFingerprint;

  // Sort releases by date ascending
  const sortedReleases = useMemo(() => {
    return [...releases].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });
  }, [releases]);

  // Get file IDs that are already used in releases
  const usedFileIds = useMemo(() => {
    const ids = new Set<string>();
    releases.forEach((release) => {
      release.files.forEach((file) => ids.add(file.id));
    });
    return ids;
  }, [releases]);

  // Available files from scene that are not already in a release
  const availableFiles = useMemo(() => {
    return (scene.files ?? []).filter((file) => !usedFileIds.has(file.id));
  }, [scene.files, usedFileIds]);

  const openNewReleaseModal = () => {
    setEditingReleaseId(null);
    setFormData(emptyFormData);
    setSelectedStudio(null);
    setSelectedGalleries([]);
    setSelectedPerformers([]);
    setSelectedTags([]);
    setGroupEntries([]);
    setStashIDs([]);
    setCustomFields({});
    setCustomFieldsError(undefined);
    setShowReleaseModal(true);
  };

  const openEditReleaseModal = (release: GQL.SceneReleaseDataFragment) => {
    setEditingReleaseId(release.id);
    setFormData({
      title: release.title || "",
      code: release.code || "",
      urls: release.urls.join("\n"),
      rating100: release.rating100?.toString() || "",
      organized: release.organized,
      date: release.date || "",
      details: release.details || "",
      director: release.director || "",
      studio_id: release.studio?.id || "",
      gallery_ids: release.galleries?.map((g) => g.id) || [],
      cover_image: null, // Don't prefill - only set if changing
    });
    setSelectedStudio(
      release.studio
        ? ({ id: release.studio.id, name: release.studio.name } as Studio)
        : null
    );
    setSelectedGalleries(
      release.galleries?.map(
        (g) => ({ id: g.id, title: g.title } as Gallery)
      ) || []
    );
    setSelectedPerformers(release.performers);
    setSelectedTags(release.tags);
    setGroupEntries(
      release.groups.map((item) => ({
        group: item.group,
        scene_index: item.scene_index,
      }))
    );
    setStashIDs(release.stash_ids);
    setCustomFields((release.custom_fields || {}) as CustomFieldMap);
    setCustomFieldsError(undefined);
    setShowReleaseModal(true);
  };

  const closeReleaseModal = () => {
    setShowReleaseModal(false);
    setShowDiscardReleaseModal(false);
    releaseDraftBaseline.current = null;
    setEditingReleaseId(null);
    setFormData(emptyFormData);
    setSelectedStudio(null);
    setSelectedGalleries([]);
    setSelectedPerformers([]);
    setSelectedTags([]);
    setGroupEntries([]);
    setStashIDs([]);
    setCustomFields({});
    setCustomFieldsError(undefined);
  };

  const requestCloseReleaseModal = () => {
    if (releaseDraftDirty) {
      setShowDiscardReleaseModal(true);
    } else {
      closeReleaseModal();
    }
  };

  const handleSaveRelease = async () => {
    if (customFieldsError) {
      Toast.error(customFieldsError);
      return;
    }
    const ratingText = formData.rating100.trim();
    const rating100 = ratingText === "" ? null : Number(ratingText);
    if (
      rating100 !== null &&
      (!Number.isInteger(rating100) || rating100 < 0 || rating100 > 100)
    ) {
      Toast.error("Rating must be a whole number from 0 to 100");
      return;
    }
    const urls = formData.urls
      .split(/\r?\n/)
      .map((url) => url.trim())
      .filter(Boolean);
    if (
      stashIDs.some((item) => !item.endpoint.trim() || !item.stash_id.trim())
    ) {
      Toast.error("Stash IDs need both an endpoint and an ID");
      return;
    }
    try {
      const editingRelease = releases.find(
        (release) => release.id === editingReleaseId
      );
      const input = {
        title: formData.title,
        code: formData.code,
        urls,
        rating100:
          editingRelease && rating100 === (editingRelease.rating100 ?? null)
            ? undefined
            : rating100,
        organized: formData.organized,
        performer_ids: selectedPerformers.map((performer) => performer.id),
        tag_ids: selectedTags.map((tag) => tag.id),
        groups: groupEntries.map((entry) => ({
          group_id: entry.group.id,
          scene_index: entry.scene_index,
        })),
        stash_ids: stashIDs,
        custom_fields: { full: customFields },
        date: formData.date,
        details: formData.details,
        director: formData.director,
        studio_id: selectedStudio?.id || "",
        gallery_ids: selectedGalleries.map((g) => g.id),
        cover_image: formData.cover_image ?? undefined,
      };

      if (editingReleaseId) {
        await updateRelease({
          variables: {
            input: {
              id: editingReleaseId,
              ...input,
            },
          },
        });
        // Clear broken image state for this release so it re-fetches the new image
        if (formData.cover_image) {
          setBrokenImages((prev) => {
            const next = new Set(prev);
            next.delete(editingReleaseId);
            return next;
          });
        }
        Toast.success(
          intl.formatMessage(
            { id: "toast.updated_entity" },
            { entity: "release" }
          )
        );
      } else {
        await createRelease({
          variables: {
            input: {
              scene_id: scene.id,
              ...input,
            },
          },
        });
        Toast.success(
          intl.formatMessage(
            { id: "toast.created_entity" },
            { entity: "release" }
          )
        );
      }
      closeReleaseModal();
      onRefetch();
    } catch (e) {
      Toast.error(e);
    }
  };

  const handleDeleteRelease = async (releaseId: string) => {
    try {
      await destroyRelease({
        variables: {
          input: { id: releaseId },
        },
      });
      Toast.success(
        intl.formatMessage(
          { id: "toast.deleted_entity" },
          { entity: "release" }
        )
      );
      if (activeReleaseId === releaseId) {
        onSetActiveRelease(null);
      }
      setShowDeleteReleaseModal(null);
      onRefetch();
    } catch (e) {
      Toast.error(e);
    }
  };

  const handleConvertScene = async (sourceSceneId: string) => {
    const requestKey = `scene:${sourceSceneId}:${scene.id}`;
    try {
      await convertScene({
        variables: {
          input: {
            source_scene_id: sourceSceneId,
            target_scene_id: scene.id,
            request_id: conversionRequestId(requestKey),
          },
        },
      });
      Toast.success(
        intl.formatMessage(
          { id: "toast.created_entity" },
          { entity: "release" }
        )
      );
      setShowSceneSelectorModal(false);
      setPendingConvertSceneId(null);
      conversionRequestIds.current.delete(requestKey);
      onRefetch();
    } catch (e) {
      Toast.error(e);
    }
  };

  const onSceneSelected = (sceneId: string) => {
    // When scene is selected, show options modal instead of immediately converting
    setPendingConvertSceneId(sceneId);
    setShowSceneSelectorModal(false);
  };

  const handleAddFile = async (
    releaseId: string,
    fileIdOrPath: string,
    isPath: boolean = false
  ) => {
    try {
      await addFileToRelease({
        variables: {
          input: {
            release_id: releaseId,
            file_id: isPath ? undefined : fileIdOrPath,
            file_path: isPath ? fileIdOrPath : undefined,
          },
        },
      });
      Toast.success("File added to release");
      setShowAddFileModal(null);
      onRefetch();
    } catch (e) {
      Toast.error(e);
    }
  };

  const handleRemoveFile = async (
    releaseId: string,
    fileId: string,
    deleteFromFilesystem: boolean
  ) => {
    try {
      await removeFileFromRelease({
        variables: {
          input: {
            release_id: releaseId,
            file_id: fileId,
            delete_from_filesystem: deleteFromFilesystem,
          },
        },
      });
      Toast.success(
        deleteFromFilesystem
          ? "File removed and deleted from filesystem"
          : "File moved to main scene"
      );
      setShowRemoveFileModal(null);
      onRefetch();
    } catch (e) {
      Toast.error(e);
    }
  };

  const handleConvertToScene = async () => {
    if (!showConvertToSceneModal) return;
    const requestKey = `release:${showConvertToSceneModal}`;

    try {
      const result = await convertReleaseToScene({
        variables: {
          input: {
            release_id: showConvertToSceneModal,
            request_id: conversionRequestId(requestKey),
          },
        },
      });
      Toast.success("Release converted to scene");
      setShowConvertToSceneModal(null);
      conversionRequestIds.current.delete(requestKey);
      onRefetch();

      // Navigate to the new scene
      if (result.data?.convertReleaseToScene?.id) {
        history.push(`/scenes/${result.data.convertReleaseToScene.id}`);
      }
    } catch (e) {
      Toast.error(e);
    }
  };

  const handleMarkForPlayback = (releaseId: string) => {
    if (activeReleaseId === releaseId) {
      onSetActiveRelease(null);
    } else {
      onSetActiveRelease(releaseId);
    }
  };

  const toggleReleaseExpanded = (releaseId: string) => {
    setExpandedReleases((prev) => {
      const next = new Set(prev);
      if (next.has(releaseId)) {
        next.delete(releaseId);
      } else {
        next.add(releaseId);
      }
      return next;
    });
  };

  const onImageLoad = (imageData: string) => {
    setFormData({ ...formData, cover_image: imageData });
  };

  const onCoverImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    ImageUtils.onImageChange(event, onImageLoad);
  };

  const handleImageError = (releaseId: string) => {
    setBrokenImages((prev) => new Set(prev).add(releaseId));
  };

  const isLoading =
    creating ||
    updating ||
    destroying ||
    converting ||
    addingFile ||
    removingFile ||
    convertingToScene;

  const renderCoverImage = () => {
    // Show preview of new image if set, otherwise show existing image for edit mode
    if (formData.cover_image) {
      return (
        <img
          className="scene-cover mb-2"
          src={formData.cover_image}
          alt={intl.formatMessage({ id: "cover_image" })}
          style={{ maxWidth: "100%", maxHeight: "200px" }}
        />
      );
    }
    if (editingReleaseId && formData.cover_image !== "") {
      const release = releases.find((r) => r.id === editingReleaseId);
      if (release?.paths?.screenshot && !brokenImages.has(editingReleaseId)) {
        return (
          <img
            className="scene-cover mb-2"
            src={`${release.paths.screenshot}?t=${new Date(
              release.updated_at
            ).getTime()}`}
            alt={intl.formatMessage({ id: "cover_image" })}
            style={{ maxWidth: "100%", maxHeight: "200px" }}
            onError={() => handleImageError(editingReleaseId)}
          />
        );
      }
    }
    return null;
  };

  return (
    <div className="scene-releases-panel">
      <Prompt
        when={releaseDraftDirty}
        message={intl.formatMessage({ id: "dialogs.unsaved_changes" })}
      />
      {isLoading && <LoadingIndicator />}

      <div className="mb-3">
        <Button
          variant="primary"
          className="mr-2"
          onClick={openNewReleaseModal}
        >
          <Icon icon={faPlus} />
          <span className="ml-1">
            <FormattedMessage id="new" />
          </span>
        </Button>
        <Button
          variant="secondary"
          onClick={() => setShowSceneSelectorModal(true)}
        >
          <Icon icon={faExchangeAlt} />
          <span className="ml-1">
            <FormattedMessage
              id="actions.add_from_existing"
              defaultMessage="New From Existing Scene"
            />
          </span>
        </Button>
      </div>

      {sortedReleases.length === 0 ? (
        <div className="text-muted">
          <FormattedMessage
            id="no_releases_message"
            defaultMessage="No releases yet. Add a release to track alternate versions of this scene."
          />
        </div>
      ) : (
        <Accordion>
          {sortedReleases.map((release) => {
            const isExpanded = expandedReleases.has(release.id);
            // Only show screenshot if it's a non-empty string and hasn't errored
            const hasScreenshot =
              release.paths?.screenshot &&
              release.paths.screenshot.length > 0 &&
              !brokenImages.has(release.id);

            return (
              <Card
                key={release.id}
                className={`mb-2 ${
                  activeReleaseId === release.id ? "border-primary" : ""
                }`}
              >
                <Card.Header className="scene-release-summary">
                  {hasScreenshot ? (
                    <img
                      className="scene-release-summary__cover"
                      src={`${release.paths.screenshot!}?t=${new Date(
                        release.updated_at
                      ).getTime()}`}
                      alt=""
                      onError={() => handleImageError(release.id)}
                    />
                  ) : (
                    <span
                      className="scene-release-summary__cover scene-release-summary__placeholder"
                      aria-hidden="true"
                    >
                      <Icon icon={faFilm} />
                    </span>
                  )}
                  <Button
                    variant="link"
                    className="scene-release-summary__label text-left text-decoration-none"
                    onClick={() => toggleReleaseExpanded(release.id)}
                    aria-expanded={isExpanded}
                    aria-controls={
                      isExpanded ? `release-details-${release.id}` : undefined
                    }
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} ${
                      release.title || "release"
                    }`}
                  >
                    <span className="scene-release-summary__title">
                      <Icon
                        icon={isExpanded ? faChevronDown : faChevronRight}
                      />{" "}
                      <strong>{release.title || "Untitled Release"}</strong>
                    </span>
                    <span className="scene-release-summary__meta text-muted">
                      {[
                        release.date,
                        release.studio?.name,
                        `${release.files.length} files`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </Button>
                  {release.rating100 != null && (
                    <Badge variant="secondary">{release.rating100}/100</Badge>
                  )}
                  {activeReleaseId === release.id && (
                    <Badge variant="primary">Playing</Badge>
                  )}
                  <div className="scene-release-summary__actions">
                    {release.files.length > 0 && (
                      <Button
                        variant={
                          activeReleaseId === release.id
                            ? "success"
                            : "outline-success"
                        }
                        size="sm"
                        onClick={() => handleMarkForPlayback(release.id)}
                        aria-label={
                          activeReleaseId === release.id
                            ? "Play main scene"
                            : "Play release"
                        }
                      >
                        <Icon icon={faPlay} />
                      </Button>
                    )}
                    <Dropdown alignRight>
                      <Dropdown.Toggle
                        variant="secondary"
                        size="sm"
                        aria-label={`Actions for ${release.title || "release"}`}
                      >
                        <FormattedMessage
                          id="actions.actions"
                          defaultMessage="Actions"
                        />
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        <Dropdown.Item
                          onClick={() => openEditReleaseModal(release)}
                        >
                          <Icon icon={faPencilAlt} />{" "}
                          <FormattedMessage id="actions.edit" />
                        </Dropdown.Item>
                        <Dropdown.Item
                          onClick={() => setShowAddFileModal(release.id)}
                        >
                          <Icon icon={faFile} />{" "}
                          <FormattedMessage
                            id="actions.add_file"
                            defaultMessage="Add file"
                          />
                        </Dropdown.Item>
                        <Dropdown.Item
                          onClick={() => setShowConvertToSceneModal(release.id)}
                        >
                          <Icon icon={faFilm} />{" "}
                          <FormattedMessage
                            id="actions.convert_to_scene"
                            defaultMessage="Convert to scene"
                          />
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        <Dropdown.Item
                          onClick={() => setShowDeleteReleaseModal(release.id)}
                          className="text-danger"
                        >
                          <Icon icon={faTrash} />{" "}
                          <FormattedMessage id="actions.delete" />
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </div>
                </Card.Header>

                {isExpanded && (
                  <Card.Body id={`release-details-${release.id}`}>
                    {hasScreenshot ? (
                      <div className="mb-3">
                        <img
                          src={`${release.paths.screenshot!}?t=${new Date(
                            release.updated_at
                          ).getTime()}`}
                          alt={release.title || "Release cover"}
                          className="img-fluid rounded w-100"
                          onError={() => handleImageError(release.id)}
                        />
                      </div>
                    ) : null}
                    <dl className="row mb-0">
                      {release.studio && (
                        <>
                          <dt className="col-sm-3">
                            <FormattedMessage id="studio" />
                          </dt>
                          <dd className="col-sm-9">
                            {release.studio.image_path ? (
                              <img
                                src={release.studio.image_path}
                                alt={release.studio.name}
                                style={{
                                  height: "2em",
                                  maxHeight: "2em",
                                  maxWidth: "200px",
                                  verticalAlign: "middle",
                                  objectFit: "contain",
                                }}
                                title={release.studio.name}
                              />
                            ) : (
                              release.studio.name
                            )}
                          </dd>
                        </>
                      )}
                      {release.code && (
                        <>
                          <dt
                            className="col-sm-3"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            <FormattedMessage
                              id="studio_code"
                              defaultMessage="Studio Code"
                            />
                          </dt>
                          <dd className="col-sm-9">{release.code}</dd>
                        </>
                      )}
                      {release.director && (
                        <>
                          <dt className="col-sm-3">
                            <FormattedMessage id="director" />
                          </dt>
                          <dd className="col-sm-9">{release.director}</dd>
                        </>
                      )}
                      {release.urls.length > 0 && (
                        <>
                          <dt className="col-sm-3">
                            <FormattedMessage id="url" />
                          </dt>
                          <dd className="col-sm-9">
                            {release.urls.map((url) => (
                              <div key={url} className="text-break">
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {url}
                                </a>
                              </div>
                            ))}
                          </dd>
                        </>
                      )}
                      {release.performers.length > 0 && (
                        <>
                          <dt className="col-sm-3">
                            <FormattedMessage id="performers" />
                          </dt>
                          <dd className="col-sm-9">
                            {release.performers
                              .map((performer) => performer.name)
                              .join(", ")}
                          </dd>
                        </>
                      )}
                      {release.tags.length > 0 && (
                        <>
                          <dt className="col-sm-3">
                            <FormattedMessage id="tags" />
                          </dt>
                          <dd className="col-sm-9">
                            {release.tags.map((tag) => tag.name).join(", ")}
                          </dd>
                        </>
                      )}
                      {release.groups.length > 0 && (
                        <>
                          <dt className="col-sm-3">
                            <FormattedMessage id="groups" />
                          </dt>
                          <dd className="col-sm-9">
                            {release.groups
                              .map((entry) => entry.group.name)
                              .join(", ")}
                          </dd>
                        </>
                      )}
                      {release.stash_ids.length > 0 && (
                        <>
                          <dt className="col-sm-3">Stash IDs</dt>
                          <dd className="col-sm-9">
                            {release.stash_ids.map((item) => (
                              <div
                                key={`${item.endpoint}:${item.stash_id}`}
                                className="text-break"
                              >
                                {item.endpoint}: {item.stash_id}
                              </div>
                            ))}
                          </dd>
                        </>
                      )}
                      {(release.play_history.length > 0 ||
                        release.o_history.length > 0) && (
                        <>
                          <dt className="col-sm-3">Activity</dt>
                          <dd className="col-sm-9">
                            {release.play_history.length} plays ·{" "}
                            {release.o_history.length} O events
                          </dd>
                        </>
                      )}
                      {release.rating_scores.length > 0 && (
                        <>
                          <dt className="col-sm-3">
                            <FormattedMessage
                              id="scene_release.rating_breakdown"
                              defaultMessage="Rating breakdown"
                            />
                          </dt>
                          <dd className="col-sm-9">
                            {release.rating_scores.map((score) => (
                              <div key={score.id}>
                                {score.label || score.key}: {score.raw_value}
                              </div>
                            ))}
                          </dd>
                        </>
                      )}
                      {release.files.length > 0 && (
                        <>
                          <dt className="col-sm-3">Files</dt>
                          <dd className="col-sm-9">
                            {release.files.map((f) => (
                              <div
                                key={f.id}
                                className="d-flex align-items-center justify-content-between mb-1"
                              >
                                <a
                                  href={`file:///${f.path.replace(/\\/g, "/")}`}
                                >
                                  {f.path}
                                </a>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  className="ml-2"
                                  onClick={() =>
                                    setShowRemoveFileModal({
                                      releaseId: release.id,
                                      fileId: f.id,
                                      fileName:
                                        f.path.split(/[\\/]/).pop() || f.path,
                                    })
                                  }
                                  title="Remove file from release"
                                >
                                  <Icon icon={faMinus} />
                                </Button>
                              </div>
                            ))}
                          </dd>
                        </>
                      )}
                      {release.files.length > 0 && (
                        <>
                          <dt
                            className="col-sm-3"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            Metadata
                          </dt>
                          <dd className="col-sm-9">
                            {release.files.map((f) => {
                              // Get scene's primary file for comparison
                              const sceneFile =
                                scene.files && scene.files.length > 0
                                  ? scene.files[0]
                                  : null;

                              // Helper to get color based on comparison
                              const getColor = (
                                releaseVal: number,
                                sceneVal: number | undefined,
                                higherIsBetter: boolean
                              ) => {
                                if (!sceneVal) return "#fff";
                                if (releaseVal > sceneVal)
                                  return higherIsBetter ? "#28a745" : "#dc3545";
                                if (releaseVal < sceneVal)
                                  return higherIsBetter ? "#dc3545" : "#28a745";
                                return "#fff";
                              };

                              // For duration, compare at the second level to avoid millisecond differences
                              const durationColor =
                                f.duration && sceneFile?.duration
                                  ? getColor(
                                      Math.floor(f.duration),
                                      Math.floor(sceneFile.duration),
                                      true
                                    )
                                  : "#fff";
                              const fpsColor =
                                f.frame_rate && sceneFile?.frame_rate
                                  ? getColor(
                                      f.frame_rate,
                                      sceneFile.frame_rate,
                                      true
                                    )
                                  : "#fff";
                              const resolutionColor =
                                f.height && sceneFile?.height
                                  ? getColor(f.height, sceneFile.height, true)
                                  : "#fff";
                              const fileSizeColor =
                                f.size && sceneFile?.size
                                  ? getColor(f.size, sceneFile.size, true)
                                  : "#fff";

                              // Format file size
                              const fileSizeInfo = f.size
                                ? TextUtils.fileSize(f.size)
                                : null;

                              return (
                                <div
                                  key={f.id}
                                  style={{
                                    fontWeight: "bold",
                                    fontSize: "1.1em",
                                  }}
                                >
                                  {f.duration && (
                                    <span style={{ color: durationColor }}>
                                      {TextUtils.secondsToTimestamp(f.duration)}
                                    </span>
                                  )}
                                  {f.duration && f.frame_rate && (
                                    <span style={{ color: "#fff" }}> | </span>
                                  )}
                                  {f.frame_rate && (
                                    <span style={{ color: fpsColor }}>
                                      {intl.formatNumber(f.frame_rate, {
                                        maximumFractionDigits: 2,
                                        minimumFractionDigits: 0,
                                      })}{" "}
                                      fps
                                    </span>
                                  )}
                                  {f.frame_rate && f.width && f.height && (
                                    <span style={{ color: "#fff" }}> | </span>
                                  )}
                                  {f.width && f.height && (
                                    <span style={{ color: resolutionColor }}>
                                      {TextUtils.resolution(f.width, f.height)}
                                    </span>
                                  )}
                                  {f.width && f.height && fileSizeInfo && (
                                    <span style={{ color: "#fff" }}> | </span>
                                  )}
                                  {fileSizeInfo && (
                                    <span style={{ color: fileSizeColor }}>
                                      {intl.formatNumber(fileSizeInfo.size, {
                                        maximumFractionDigits:
                                          TextUtils.fileSizeFractionalDigits(
                                            fileSizeInfo.unit
                                          ),
                                      })}{" "}
                                      {TextUtils.formatFileSizeUnit(
                                        fileSizeInfo.unit
                                      )}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </dd>
                        </>
                      )}
                      {release.galleries && release.galleries.length > 0 && (
                        <>
                          <dt className="col-sm-3">
                            <FormattedMessage id="galleries" />
                          </dt>
                          <dd className="col-sm-9">
                            {release.galleries.map((g, idx) => (
                              <span key={g.id}>
                                <a href={`/galleries/${g.id}?sortby=path`}>
                                  {g.title || g.id}
                                </a>
                                {idx < release.galleries.length - 1 && ", "}
                              </span>
                            ))}
                          </dd>
                        </>
                      )}
                      {release.details && (
                        <>
                          <dt className="col-sm-3">
                            <FormattedMessage id="details" />
                          </dt>
                          <dd className="col-sm-9">{release.details}</dd>
                        </>
                      )}
                    </dl>
                  </Card.Body>
                )}
              </Card>
            );
          })}
        </Accordion>
      )}

      {/* Release Edit/Create Modal */}
      <Modal
        show={showReleaseModal}
        onHide={requestCloseReleaseModal}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {editingReleaseId ? (
              <FormattedMessage
                id="actions.edit_entity"
                defaultMessage="Edit {entityType}"
                values={{ entityType: "Release" }}
              />
            ) : (
              <FormattedMessage
                id="actions.create_entity"
                defaultMessage="Create {entityType}"
                values={{ entityType: "Release" }}
              />
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FormattedMessage id="title" />
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FormattedMessage id="date" />
                  </Form.Label>
                  <DateInput
                    value={formData.date}
                    onValueChange={(date) => setFormData({ ...formData, date })}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FormattedMessage
                      id="studio_code"
                      defaultMessage="Studio Code"
                    />
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FormattedMessage id="director" />
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.director}
                    onChange={(e) =>
                      setFormData({ ...formData, director: e.target.value })
                    }
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>
                <FormattedMessage id="studio" />
              </Form.Label>
              <StudioSelect
                onSelect={(items) =>
                  setSelectedStudio(items.length > 0 ? items[0] : null)
                }
                values={selectedStudio ? [selectedStudio] : []}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                <FormattedMessage id="url" />
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={formData.urls}
                onChange={(e) =>
                  setFormData({ ...formData, urls: e.target.value })
                }
                aria-label="Release URLs, one per line"
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Rating (0–100)</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={formData.rating100}
                    onChange={(e) =>
                      setFormData({ ...formData, rating100: e.target.value })
                    }
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label={<FormattedMessage id="organized" />}
                    checked={formData.organized}
                    onChange={(e) =>
                      setFormData({ ...formData, organized: e.target.checked })
                    }
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>
                <FormattedMessage id="performers" />
              </Form.Label>
              <PerformerSelect
                isMulti
                values={selectedPerformers}
                onSelect={(items) => setSelectedPerformers(items)}
                ageFromDate={formData.date}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                <FormattedMessage id="tags" />
              </Form.Label>
              <TagSelect
                isMulti
                values={selectedTags}
                onSelect={(items) => setSelectedTags(items)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                <FormattedMessage id="groups" />
              </Form.Label>
              <SceneGroupTable
                value={groupEntries}
                onUpdate={setGroupEntries}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Stash IDs</Form.Label>
              {stashIDs.map((item, index) => (
                <Row key={index} className="mb-2">
                  <Col md={5}>
                    <Form.Control
                      aria-label={`Stash endpoint ${index + 1}`}
                      value={item.endpoint}
                      placeholder="Endpoint"
                      onChange={(event) =>
                        setStashIDs((current) =>
                          current.map((existing, i) =>
                            i === index
                              ? {
                                  ...existing,
                                  endpoint: event.target.value,
                                  updated_at: new Date().toISOString(),
                                }
                              : existing
                          )
                        )
                      }
                    />
                  </Col>
                  <Col md={5}>
                    <Form.Control
                      aria-label={`Stash ID ${index + 1}`}
                      value={item.stash_id}
                      placeholder="ID"
                      onChange={(event) =>
                        setStashIDs((current) =>
                          current.map((existing, i) =>
                            i === index
                              ? {
                                  ...existing,
                                  stash_id: event.target.value,
                                  updated_at: new Date().toISOString(),
                                }
                              : existing
                          )
                        )
                      }
                    />
                  </Col>
                  <Col md={2}>
                    <Button
                      variant="outline-danger"
                      aria-label={`Remove Stash ID ${index + 1}`}
                      onClick={() =>
                        setStashIDs((current) =>
                          current.filter((_, i) => i !== index)
                        )
                      }
                    >
                      <Icon icon={faMinus} />
                    </Button>
                  </Col>
                </Row>
              ))}
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() =>
                  setStashIDs((current) => [
                    ...current,
                    {
                      endpoint: "",
                      stash_id: "",
                      updated_at: new Date().toISOString(),
                    },
                  ])
                }
              >
                <Icon icon={faPlus} /> Add Stash ID
              </Button>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                <FormattedMessage id="galleries" />
              </Form.Label>
              <GallerySelect
                values={selectedGalleries}
                onSelect={(items) => setSelectedGalleries(items)}
                isMulti
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                <FormattedMessage id="details" />
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.details}
                onChange={(e) =>
                  setFormData({ ...formData, details: e.target.value })
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                <FormattedMessage id="cover_image" />
              </Form.Label>
              {renderCoverImage()}
              <ImageInput isEditing onImageChange={onCoverImageChange} />
              {editingReleaseId && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={() => setFormData({ ...formData, cover_image: "" })}
                >
                  <FormattedMessage
                    id="scene_release.remove_cover"
                    defaultMessage="Remove cover"
                  />
                </Button>
              )}
            </Form.Group>

            <CustomFieldsInput
              values={customFields}
              onChange={setCustomFields}
              error={customFieldsError}
              setError={setCustomFieldsError}
            />
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={requestCloseReleaseModal}>
            <FormattedMessage id="actions.cancel" />
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveRelease}
            disabled={creating || updating}
          >
            {editingReleaseId ? (
              <FormattedMessage id="actions.save" />
            ) : (
              <FormattedMessage id="actions.create" />
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showDiscardReleaseModal}
        onHide={() => setShowDiscardReleaseModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FormattedMessage
              id="dialogs.unsaved_changes"
              defaultMessage="Unsaved changes"
            />
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <FormattedMessage
            id="scene_release.discard_changes"
            defaultMessage="Discard changes to this release?"
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowDiscardReleaseModal(false)}
          >
            <FormattedMessage id="actions.cancel" />
          </Button>
          <Button variant="danger" onClick={closeReleaseModal}>
            <FormattedMessage id="actions.discard" defaultMessage="Discard" />
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Scene Selector Modal */}
      <Modal
        show={!!showDeleteReleaseModal}
        onHide={() => setShowDeleteReleaseModal(null)}
      >
        <Modal.Header closeButton>
          <Modal.Title>Delete release</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          The release will be removed. Its files will return to the main scene.
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowDeleteReleaseModal(null)}
          >
            <FormattedMessage id="actions.cancel" />
          </Button>
          <Button
            variant="danger"
            disabled={destroying}
            onClick={() =>
              showDeleteReleaseModal &&
              handleDeleteRelease(showDeleteReleaseModal)
            }
          >
            <FormattedMessage id="actions.delete" />
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Scene Selector Modal */}
      {showSceneSelectorModal && (
        <SceneSelectorDialog
          onSelect={onSceneSelected}
          onClose={() => setShowSceneSelectorModal(false)}
          excludeIds={[scene.id]}
        />
      )}

      {/* Convert Scene Options Modal */}
      <Modal
        show={!!pendingConvertSceneId}
        onHide={() => setPendingConvertSceneId(null)}
      >
        <Modal.Header closeButton>
          <Modal.Title>Convert Scene to Release</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {conversionSourceLoading ? (
            <LoadingIndicator />
          ) : conversionSource ? (
            <dl className="row mb-2">
              <dt className="col-3">Source</dt>
              <dd className="col-9">
                {conversionSource.title || conversionSource.id}
              </dd>
              <dt className="col-3">Target</dt>
              <dd className="col-9">{scene.title || scene.id}</dd>
              <dt className="col-3">Moving</dt>
              <dd className="col-9">
                {sourceSummary?.files} files · {sourceSummary?.plays} plays ·{" "}
                {sourceSummary?.oEvents} O events
                {conversionSource.releases.length > 0 &&
                  ` · ${conversionSource.releases.length} existing releases`}
              </dd>
            </dl>
          ) : (
            <p>Source scene is unavailable.</p>
          )}
          <p className="text-muted mb-0">
            The source scene is removed after its data moves to the
            target&apos;s releases.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setPendingConvertSceneId(null)}
          >
            <FormattedMessage id="actions.cancel" />
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              pendingConvertSceneId && handleConvertScene(pendingConvertSceneId)
            }
            disabled={
              converting || conversionSourceLoading || !conversionSource
            }
          >
            Convert to Release
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Add File Modal */}
      <Modal
        show={!!showAddFileModal}
        onHide={() => setShowAddFileModal(null)}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>Add File to Release</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {availableFiles.length === 0 ? (
            <p className="text-muted">
              No available files. All scene files are already assigned to
              releases.
            </p>
          ) : (
            <div className="list-group">
              {availableFiles.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  className="list-group-item list-group-item-action"
                  onClick={() =>
                    showAddFileModal &&
                    handleAddFile(showAddFileModal, file.id, false)
                  }
                  disabled={addingFile}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <div className="font-weight-bold">
                        {file.path.split(/[\\/]/).pop()}
                      </div>
                      <small className="text-muted">{file.path}</small>
                    </div>
                    <div className="text-right">
                      {file.width && file.height && (
                        <span className="badge badge-secondary mr-1">
                          {TextUtils.resolution(file.width, file.height)}
                        </span>
                      )}
                      {file.size && (
                        <span className="badge badge-info">
                          {TextUtils.fileSize(file.size).size.toFixed(1)}{" "}
                          {TextUtils.formatFileSizeUnit(
                            TextUtils.fileSize(file.size).unit
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddFileModal(null)}>
            <FormattedMessage id="actions.cancel" />
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Convert to Scene Modal */}
      <Modal
        show={!!showConvertToSceneModal}
        onHide={() => setShowConvertToSceneModal(null)}
      >
        <Modal.Header closeButton>
          <Modal.Title>Convert Release to Scene</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {conversionRelease && (
            <dl className="row mb-2">
              <dt className="col-3">Source</dt>
              <dd className="col-9">
                {conversionRelease.title || conversionRelease.id}
              </dd>
              <dt className="col-3">Target</dt>
              <dd className="col-9">New standalone scene</dd>
              <dt className="col-3">Moving</dt>
              <dd className="col-9">
                {releaseSummary?.files} files · {releaseSummary?.plays} plays ·{" "}
                {releaseSummary?.oEvents} O events
              </dd>
            </dl>
          )}
          <p className="text-muted mb-0">
            The release is removed after conversion;{" "}
            {scene.title || "the parent scene"} keeps its own data and history.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowConvertToSceneModal(null)}
          >
            <FormattedMessage id="actions.cancel" />
          </Button>
          <Button
            variant="primary"
            onClick={handleConvertToScene}
            disabled={convertingToScene}
          >
            Convert to Scene
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Remove File Modal */}
      <Modal
        show={!!showRemoveFileModal}
        onHide={() => setShowRemoveFileModal(null)}
      >
        <Modal.Header closeButton>
          <Modal.Title>Remove File from Release</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            How would you like to remove{" "}
            <strong>{showRemoveFileModal?.fileName}</strong> from this release?
          </p>

          <div className="d-grid gap-2">
            <Button
              variant="warning"
              className="mb-2"
              onClick={() =>
                showRemoveFileModal &&
                handleRemoveFile(
                  showRemoveFileModal.releaseId,
                  showRemoveFileModal.fileId,
                  false
                )
              }
              disabled={removingFile}
            >
              Move to main scene
              <br />
              <small className="text-muted">(keeps the file on disk)</small>
            </Button>

            <Button
              variant="danger"
              onClick={() =>
                showRemoveFileModal &&
                handleRemoveFile(
                  showRemoveFileModal.releaseId,
                  showRemoveFileModal.fileId,
                  true
                )
              }
              disabled={removingFile}
            >
              Remove and DELETE from filesystem
              <br />
              <small>(permanent - cannot be undone!)</small>
            </Button>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowRemoveFileModal(null)}
          >
            <FormattedMessage id="actions.cancel" />
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default SceneReleasesPanel;
