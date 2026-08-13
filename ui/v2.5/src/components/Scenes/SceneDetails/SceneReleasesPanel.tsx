import React, { useState, useMemo } from "react";
import {
  Button,
  Card,
  Badge,
  Modal,
  Form,
  Accordion,
  Row,
  Col,
} from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { useHistory } from "react-router-dom";
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
import ImageUtils from "src/utils/image";
import TextUtils from "src/utils/text";

interface IReleaseFormData {
  title: string;
  code: string;
  url: string;
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
  url: "",
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

  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null);
  const [showSceneSelectorModal, setShowSceneSelectorModal] = useState(false);
  const [pendingConvertSceneId, setPendingConvertSceneId] = useState<
    string | null
  >(null); // scene selected, waiting for options
  const [convertSceneOptions, setConvertSceneOptions] = useState({
    transferOHistory: false,
    transferMarkers: false,
  });
  const [showAddFileModal, setShowAddFileModal] = useState<string | null>(null); // release ID
  const [showConvertToSceneModal, setShowConvertToSceneModal] = useState<
    string | null
  >(null); // release ID
  const [convertOptions, setConvertOptions] = useState({
    transferOHistory: false,
    transferMarkers: false,
  });
  const [formData, setFormData] = useState<IReleaseFormData>(emptyFormData);
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

  const releases = useMemo(() => scene.releases ?? [], [scene.releases]);

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
    setShowReleaseModal(true);
  };

  const openEditReleaseModal = (release: GQL.SceneReleaseDataFragment) => {
    setEditingReleaseId(release.id);
    setFormData({
      title: release.title || "",
      code: release.code || "",
      url: release.url || "",
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
    setShowReleaseModal(true);
  };

  const closeReleaseModal = () => {
    setShowReleaseModal(false);
    setEditingReleaseId(null);
    setFormData(emptyFormData);
    setSelectedStudio(null);
    setSelectedGalleries([]);
  };

  const handleSaveRelease = async () => {
    try {
      const input = {
        title: formData.title || undefined,
        code: formData.code || undefined,
        url: formData.url || undefined,
        date: formData.date || undefined,
        details: formData.details || undefined,
        director: formData.director || undefined,
        studio_id: selectedStudio?.id || undefined,
        gallery_ids: selectedGalleries.map((g) => g.id),
        cover_image: formData.cover_image || undefined,
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
    const release = releases.find((r) => r.id === releaseId);
    const releaseStudioName = release?.studio?.name || "Unknown Studio";
    const sceneTitle = scene.title || "Untitled Scene";
    const sceneStudioName = scene.studio?.name || "Unknown Studio";
    const message = `Are you sure you want to delete the ${releaseStudioName} release of "${sceneTitle}" from ${sceneStudioName}?`;

    if (!window.confirm(message)) {
      return;
    }
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
      onRefetch();
    } catch (e) {
      Toast.error(e);
    }
  };

  const handleConvertScene = async (sourceSceneId: string) => {
    try {
      await convertScene({
        variables: {
          input: {
            source_scene_id: sourceSceneId,
            target_scene_id: scene.id,
            transfer_o_history: convertSceneOptions.transferOHistory,
            transfer_markers: convertSceneOptions.transferMarkers,
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
      setConvertSceneOptions({
        transferOHistory: false,
        transferMarkers: false,
      });
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
          : "File removed from release"
      );
      setShowRemoveFileModal(null);
      onRefetch();
    } catch (e) {
      Toast.error(e);
    }
  };

  const handleConvertToScene = async () => {
    if (!showConvertToSceneModal) return;

    try {
      const result = await convertReleaseToScene({
        variables: {
          input: {
            release_id: showConvertToSceneModal,
            transfer_o_history: convertOptions.transferOHistory,
            transfer_markers: convertOptions.transferMarkers,
          },
        },
      });
      Toast.success("Release converted to scene");
      setShowConvertToSceneModal(null);
      setConvertOptions({ transferOHistory: false, transferMarkers: false });
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
    if (editingReleaseId) {
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
                <Card.Header className="d-flex align-items-center p-2">
                  <Button
                    variant="link"
                    className="p-0 mr-2 text-decoration-none"
                    onClick={() => toggleReleaseExpanded(release.id)}
                  >
                    <Icon icon={isExpanded ? faChevronDown : faChevronRight} />
                  </Button>

                  <div
                    className="flex-grow-1"
                    style={{ cursor: "pointer" }}
                    onClick={() => toggleReleaseExpanded(release.id)}
                  >
                    <strong>{release.title || "Untitled Release"}</strong>
                    {activeReleaseId === release.id && (
                      <Badge variant="primary" className="ml-2">
                        Playing
                      </Badge>
                    )}
                    {release.date && (
                      <span className="text-muted ml-2">{release.date}</span>
                    )}
                  </div>

                  <div className="d-flex">
                    {release.files.length > 0 && (
                      <Button
                        variant={
                          activeReleaseId === release.id
                            ? "success"
                            : "outline-success"
                        }
                        size="sm"
                        className="mr-1"
                        onClick={() => handleMarkForPlayback(release.id)}
                        title="Mark for playback"
                      >
                        <Icon icon={faPlay} />
                      </Button>
                    )}
                    <Button
                      variant="outline-info"
                      size="sm"
                      className="mr-1"
                      onClick={() => setShowAddFileModal(release.id)}
                      title="Add file to release"
                    >
                      <Icon icon={faFile} />
                    </Button>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="mr-1"
                      onClick={() => openEditReleaseModal(release)}
                      title={intl.formatMessage({ id: "actions.edit" })}
                    >
                      <Icon icon={faPencilAlt} />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mr-1"
                      onClick={() => setShowConvertToSceneModal(release.id)}
                      title="Convert to scene"
                    >
                      <Icon icon={faFilm} />
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDeleteRelease(release.id)}
                      title={intl.formatMessage({ id: "actions.delete" })}
                    >
                      <Icon icon={faTrash} />
                    </Button>
                  </div>
                </Card.Header>

                {isExpanded && (
                  <Card.Body>
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
                      {release.url && (
                        <>
                          <dt className="col-sm-3">
                            <FormattedMessage id="url" />
                          </dt>
                          <dd className="col-sm-9">
                            <a
                              href={release.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {release.url}
                            </a>
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
      <Modal show={showReleaseModal} onHide={closeReleaseModal} size="lg">
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
                type="url"
                value={formData.url}
                onChange={(e) =>
                  setFormData({ ...formData, url: e.target.value })
                }
              />
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
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeReleaseModal}>
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
        onHide={() => {
          setPendingConvertSceneId(null);
          setConvertSceneOptions({
            transferOHistory: false,
            transferMarkers: false,
          });
        }}
      >
        <Modal.Header closeButton>
          <Modal.Title>Convert Scene to Release</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            The selected scene will be converted into a release of this scene.
            All its files and metadata will be preserved in the new release.
          </p>
          <p>
            <strong>Note:</strong> The source scene will be deleted after
            conversion.
          </p>

          <Form.Group className="mb-3">
            <Form.Check
              type="checkbox"
              id="convertSceneTransferOHistory"
              label="Transfer O-history from source scene to this scene"
              checked={convertSceneOptions.transferOHistory}
              onChange={(e) =>
                setConvertSceneOptions((prev) => ({
                  ...prev,
                  transferOHistory: e.target.checked,
                }))
              }
            />
            <Form.Text className="text-muted">
              If enabled, all O-dates from the source scene will be transferred
              to this scene.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Check
              type="checkbox"
              id="convertSceneTransferMarkers"
              label="Transfer markers from source scene to this scene"
              checked={convertSceneOptions.transferMarkers}
              onChange={(e) =>
                setConvertSceneOptions((prev) => ({
                  ...prev,
                  transferMarkers: e.target.checked,
                }))
              }
            />
            <Form.Text className="text-muted">
              If enabled, all scene markers from the source scene will be
              transferred to this scene.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setPendingConvertSceneId(null);
              setConvertSceneOptions({
                transferOHistory: false,
                transferMarkers: false,
              });
            }}
          >
            <FormattedMessage id="actions.cancel" />
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              pendingConvertSceneId && handleConvertScene(pendingConvertSceneId)
            }
            disabled={converting}
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
          <p>
            This will convert the release into a new standalone scene, keeping
            all its data (title, date, studio, etc.) and associated file(s).
          </p>
          <p>
            <strong>Note:</strong> The release will be deleted and a new scene
            will be created.
          </p>

          <Form.Group className="mb-3">
            <Form.Check
              type="checkbox"
              id="transferOHistory"
              label="Transfer O-history from parent scene"
              checked={convertOptions.transferOHistory}
              onChange={(e) =>
                setConvertOptions((prev) => ({
                  ...prev,
                  transferOHistory: e.target.checked,
                }))
              }
            />
            <Form.Text className="text-muted">
              If enabled, all O-dates from the parent scene will be transferred
              to the new scene.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Check
              type="checkbox"
              id="transferMarkers"
              label="Transfer markers from parent scene"
              checked={convertOptions.transferMarkers}
              onChange={(e) =>
                setConvertOptions((prev) => ({
                  ...prev,
                  transferMarkers: e.target.checked,
                }))
              }
            />
            <Form.Text className="text-muted">
              If enabled, all scene markers from the parent scene will be
              transferred to the new scene.
            </Form.Text>
          </Form.Group>
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
              Remove from release only
              <br />
              <small className="text-muted">(keeps the file on disk)</small>
            </Button>

            <Button
              variant="danger"
              onClick={() => {
                if (
                  showRemoveFileModal &&
                  window.confirm(
                    `⚠️ DESTRUCTIVE ACTION\n\nThis will permanently delete "${showRemoveFileModal.fileName}" from your filesystem!\n\nAre you absolutely sure?`
                  )
                ) {
                  handleRemoveFile(
                    showRemoveFileModal.releaseId,
                    showRemoveFileModal.fileId,
                    true
                  );
                }
              }}
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
