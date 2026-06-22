import React, { useEffect, useState, useMemo } from "react";
import { Button, Spinner, Form } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { Icon } from "src/components/Shared/Icon";
import {
  faCheck,
  faChevronLeft,
  faChevronRight,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import { TagSelect, Tag } from "src/components/Tags/TagSelect";
import cx from "classnames";

interface ISelectedImage {
  id: string;
  url: string; // Full image URL (paths.image)
}

interface IPerformerImageSelectModalProps {
  performerIds: string[];
  galleryIds: string[];
  selectedImages: ISelectedImage[];
  onConfirm: (images: ISelectedImage[]) => void;
  onClose: () => void;
  isFullscreen?: boolean;
}

const IMAGES_PER_PAGE = 40;

export const PerformerImageSelectModal: React.FC<
  IPerformerImageSelectModalProps
> = ({
  performerIds,
  galleryIds,
  selectedImages: initialSelectedImages,
  onConfirm,
  onClose,
  isFullscreen = false,
}) => {
  const intl = useIntl();
  const [page, setPage] = useState(1);
  const [selectedImages, setSelectedImages] = useState<ISelectedImage[]>(
    initialSelectedImages
  );
  const [filterTags, setFilterTags] = useState<Tag[]>([]);

  const [fetchImages, { data, loading, error }] = GQL.useFindImagesLazyQuery();

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterTags]);

  // Fetch images when modal opens, page changes, or filters change
  useEffect(() => {
    // Need at least performer IDs or gallery IDs
    if (performerIds.length === 0 && galleryIds.length === 0) return;

    // Build the image filter - combine performer and gallery filters with OR
    let imageFilter: GQL.ImageFilterType = {};

    const hasPerformers = performerIds.length > 0;
    const hasGalleries = galleryIds.length > 0;

    if (hasPerformers && hasGalleries) {
      // Both - use OR to combine
      imageFilter = {
        performers: {
          modifier: GQL.CriterionModifier.Includes,
          value: performerIds,
        },
        OR: {
          galleries: {
            modifier: GQL.CriterionModifier.Includes,
            value: galleryIds,
          },
        },
      };
    } else if (hasPerformers) {
      imageFilter = {
        performers: {
          modifier: GQL.CriterionModifier.Includes,
          value: performerIds,
        },
      };
    } else if (hasGalleries) {
      imageFilter = {
        galleries: {
          modifier: GQL.CriterionModifier.Includes,
          value: galleryIds,
        },
      };
    }

    // Add tag filter if tags are selected
    if (filterTags.length > 0) {
      imageFilter.tags = {
        modifier: GQL.CriterionModifier.IncludesAll,
        value: filterTags.map((t) => t.id),
        depth: -1, // Include subtags
      };
    }

    fetchImages({
      variables: {
        filter: {
          page,
          per_page: IMAGES_PER_PAGE,
          sort: "created_at",
          direction: GQL.SortDirectionEnum.Desc,
        },
        image_filter: imageFilter,
      },
    });
  }, [fetchImages, performerIds, galleryIds, page, filterTags]);

  // Sort images: performer-associated images first, then gallery-only images
  const images = useMemo(() => {
    const rawImages = data?.findImages?.images ?? [];

    // Sort by whether the image has a performer that matches our performerIds
    return [...rawImages].sort((a, b) => {
      const aHasPerformer = a.performers?.some((p) =>
        performerIds.includes(p.id)
      );
      const bHasPerformer = b.performers?.some((p) =>
        performerIds.includes(p.id)
      );

      if (aHasPerformer && !bHasPerformer) return -1;
      if (!aHasPerformer && bHasPerformer) return 1;
      return 0;
    });
  }, [data?.findImages?.images, performerIds]);
  const totalCount = data?.findImages?.count ?? 0;
  const totalPages = Math.ceil(totalCount / IMAGES_PER_PAGE);

  const handleImageClick = (image: GQL.SlimImageDataFragment) => {
    const imageUrl = image.paths?.image;
    if (!imageUrl) return;

    const isSelected = selectedImages.some((s) => s.id === image.id);

    if (isSelected) {
      // Deselect
      setSelectedImages((prev) => prev.filter((s) => s.id !== image.id));
    } else {
      // Select
      setSelectedImages((prev) => [...prev, { id: image.id, url: imageUrl }]);
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedImages);
    onClose();
  };

  const handleClear = () => {
    setSelectedImages([]);
  };

  // Prevent click propagation to video
  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={cx("performer-image-select-backdrop", {
        "fullscreen-mode": isFullscreen,
      })}
      onClick={onClose}
    >
      <div
        className={cx("performer-image-select-modal", {
          "fullscreen-mode": isFullscreen,
        })}
        onClick={handleContainerClick}
      >
        {/* Header */}
        <div className="pis-header">
          <h5 className="pis-title">
            <FormattedMessage
              id="performer_image_overlay.select_images"
              defaultMessage="Select Vato Images"
            />
            <span className="pis-selection-count">
              ({selectedImages.length} selected)
            </span>
          </h5>
          <Button
            variant="link"
            className="pis-close-btn"
            onClick={onClose}
            title={intl.formatMessage({ id: "actions.close" })}
          >
            <Icon icon={faTimes} />
          </Button>
        </div>

        {/* Content */}
        <div className="pis-content">
          {/* Tag Filter */}
          <Form.Group className="pis-tag-filter">
            <TagSelect
              isMulti
              onSelect={(items) => setFilterTags(items)}
              values={filterTags}
            />
          </Form.Group>

          {loading && (
            <div className="pis-loading">
              <Spinner animation="border" size="sm" />
              <span>
                <FormattedMessage id="loading" defaultMessage="Loading..." />
              </span>
            </div>
          )}

          {error && (
            <div className="pis-error">
              <FormattedMessage
                id="performer_image_overlay.error_loading"
                defaultMessage="Error loading images"
              />
            </div>
          )}

          {!loading && !error && images.length === 0 && (
            <div className="pis-empty">
              <FormattedMessage
                id="performer_image_overlay.no_images"
                defaultMessage="No images found for vatos in this scene"
              />
            </div>
          )}

          {!loading && images.length > 0 && (
            <div className="pis-image-grid">
              {images.map((image) => {
                const isSelected = selectedImages.some(
                  (s) => s.id === image.id
                );
                const selectionIndex = selectedImages.findIndex(
                  (s) => s.id === image.id
                );
                // Get performer names for this image
                const performerNames = image.performers
                  ?.map((p) => p.name)
                  .join(", ");

                return (
                  <div
                    key={image.id}
                    className={cx("pis-image-item", {
                      selected: isSelected,
                    })}
                    onClick={() => handleImageClick(image)}
                  >
                    <div className="pis-image-wrapper">
                      <img
                        src={image.paths?.thumbnail ?? image.paths?.image ?? ""}
                        alt={image.title ?? `Image ${image.id}`}
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="pis-selected-badge">
                          {selectionIndex + 1}
                        </div>
                      )}
                    </div>
                    {performerNames && (
                      <div
                        className="pis-performer-names"
                        title={performerNames}
                      >
                        {performerNames}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pis-pagination">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <Icon icon={faChevronLeft} />
            </Button>
            <span className="pis-page-info">
              {page} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <Icon icon={faChevronRight} />
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="pis-footer">
          <Button variant="secondary" size="sm" onClick={handleClear}>
            <FormattedMessage id="actions.clear" defaultMessage="Clear" />
          </Button>
          <div className="pis-footer-right">
            <Button variant="secondary" size="sm" onClick={onClose}>
              <FormattedMessage id="actions.cancel" defaultMessage="Cancel" />
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirm}>
              <Icon icon={faCheck} />
              <FormattedMessage id="actions.confirm" defaultMessage="Confirm" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformerImageSelectModal;
