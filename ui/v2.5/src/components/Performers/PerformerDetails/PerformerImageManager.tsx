import React, { useState, useEffect } from "react";
import type { ApolloQueryResult } from "@apollo/client";
import { Button } from "react-bootstrap";
import { Icon } from "src/components/Shared/Icon";
import {
  faUpload,
  faTrash,
  faStar,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { useToast } from "src/hooks/Toast";
import * as GQL from "src/core/generated-graphql";
import "./PerformerImageManager.scss";

interface IPerformerImageManagerProps {
  performer: GQL.PerformerDataFragment;
  onImageChange: (imagePath: string) => void;
  refetch: () => Promise<ApolloQueryResult<GQL.FindPerformerQuery>>;
  children: React.ReactNode;
}

export const PerformerImageManager: React.FC<IPerformerImageManagerProps> = ({
  performer,
  onImageChange,
  refetch,
  children,
}) => {
  const Toast = useToast();
  const [isHovered, setIsHovered] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [performerImageUpload] = GQL.usePerformerImageUploadMutation();
  const [performerImageDelete] = GQL.usePerformerImageDeleteMutation();
  const [performerImageSetDefault] = GQL.usePerformerImageSetDefaultMutation();

  // Get all images: default image + additional images
  const defaultImage = performer.image_path;
  const additionalImages = performer.additional_images || [];
  const allImages = [
    { id: "default", path: defaultImage, isDefault: true },
    ...additionalImages.map((img) => ({
      id: img.id,
      path: img.image_path,
      isDefault: false,
    })),
  ].filter((img) => img.path);

  // Reset index if out of bounds after refetch
  useEffect(() => {
    if (currentImageIndex >= allImages.length && allImages.length > 0) {
      setCurrentImageIndex(allImages.length - 1);
    }
  }, [allImages.length, currentImageIndex]);

  const currentImage = allImages[currentImageIndex];
  const isDefaultImage = currentImage?.isDefault || false;

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async (e: Event) => {
      const { files } = e.target as HTMLInputElement;
      if (!files || files.length === 0) return;

      setIsLoading(true);
      try {
        const uploaded: string[] = [];
        const skippedDuplicates: string[] = [];
        const failed: string[] = [];

        const isDuplicateError = (error: unknown): boolean => {
          if (typeof error !== "object" || error === null) return false;

          const gqlErrors = (
            error as {
              graphQLErrors?: unknown;
            }
          ).graphQLErrors;
          if (!Array.isArray(gqlErrors)) return false;
          return gqlErrors.some((graphQLError: unknown) => {
            if (typeof graphQLError !== "object" || graphQLError === null) {
              return false;
            }
            return (
              (graphQLError as { extensions?: { code?: unknown } }).extensions
                ?.code === "DUPLICATE_PERFORMER_IMAGE"
            );
          });
        };

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const imageData = await readFileAsDataURL(file);

          try {
            await performerImageUpload({
              variables: {
                performer_id: performer.id,
                image: imageData,
              },
            });
            uploaded.push(file.name);
          } catch (err) {
            if (isDuplicateError(err)) {
              skippedDuplicates.push(file.name);
            } else {
              failed.push(file.name);
            }
          }
        }

        if (uploaded.length > 0) {
          // Small delay to ensure transaction commits
          await new Promise((resolve) => setTimeout(resolve, 100));
          await refetch();
        }

        const parts: string[] = [];
        if (uploaded.length > 0) parts.push(`Uploaded: ${uploaded.join(", ")}`);
        if (skippedDuplicates.length > 0)
          parts.push(`Skipped duplicates: ${skippedDuplicates.join(", ")}`);
        if (failed.length > 0) parts.push(`Failed: ${failed.join(", ")}`);

        if (failed.length > 0) {
          Toast.toast({ content: parts.join("\n"), variant: "danger" });
        } else if (skippedDuplicates.length > 0) {
          Toast.toast({ content: parts.join("\n"), variant: "warning" });
        } else {
          Toast.toast({ content: parts.join("\n"), variant: "success" });
        }
      } catch (error) {
        Toast.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    input.click();
  };

  const handleRemove = async () => {
    if (isDefaultImage) {
      Toast.toast({
        content:
          "Cannot remove the default image. Set another image as default first.",
        variant: "warning",
      });
      return;
    }

    if (!currentImage || currentImage.id === "default") return;

    const deletedIndex = currentImageIndex;

    setIsLoading(true);
    try {
      const result = await performerImageDelete({
        variables: {
          id: currentImage.id,
        },
      });

      if (!result.data?.performerImageDelete) return;

      Toast.success("Image removed successfully");

      const refetchResult = await refetch();
      const newPerformer = refetchResult.data?.findPerformer;
      if (newPerformer) {
        const newAdditionalImages = newPerformer.additional_images || [];
        const newAllImages = [
          { id: "default", path: newPerformer.image_path, isDefault: true },
          ...newAdditionalImages.map((img) => ({
            id: img.id,
            path: img.image_path,
            isDefault: false,
          })),
        ].filter((img) => img.path);

        const newIndex = Math.min(
          deletedIndex,
          Math.max(0, newAllImages.length - 1)
        );
        setCurrentImageIndex(newIndex);
        const newImagePath = newAllImages[newIndex]?.path;
        if (newImagePath) {
          onImageChange(newImagePath);
        }
      }
    } catch (error) {
      Toast.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefault = async () => {
    if (isDefaultImage) {
      Toast.toast({
        content: "This is already the default image",
        variant: "warning",
      });
      return;
    }

    if (!currentImage || currentImage.id === "default") return;

    setIsLoading(true);
    try {
      const result = await performerImageSetDefault({
        variables: {
          id: currentImage.id,
        },
      });

      if (!result.data?.performerImageSetDefault) return;

      Toast.success("Default image updated successfully");

      const refetchResult = await refetch();
      const newPerformer = refetchResult.data?.findPerformer;
      if (newPerformer?.image_path) {
        setCurrentImageIndex(0);
        onImageChange(newPerformer.image_path);
      }
    } catch (error) {
      Toast.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevious = () => {
    const newIndex =
      currentImageIndex > 0 ? currentImageIndex - 1 : allImages.length - 1;
    setCurrentImageIndex(newIndex);
    const path = allImages[newIndex]?.path;
    if (path) {
      onImageChange(path);
    }
  };

  const handleNext = () => {
    const newIndex =
      currentImageIndex < allImages.length - 1 ? currentImageIndex + 1 : 0;
    setCurrentImageIndex(newIndex);
    const path = allImages[newIndex]?.path;
    if (path) {
      onImageChange(path);
    }
  };

  return (
    <div
      className={`performer-image-manager ${isLoading ? "loading" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}

      {isHovered && (
        <>
          {/* Navigation arrows (only show if more than 1 image) */}
          {allImages.length > 1 && (
            <>
              <Button
                variant="secondary"
                className="performer-image-nav performer-image-nav-left"
                onClick={handlePrevious}
                title="Previous image"
                disabled={isLoading}
              >
                <Icon icon={faChevronLeft} />
              </Button>
              <Button
                variant="secondary"
                className="performer-image-nav performer-image-nav-right"
                onClick={handleNext}
                title="Next image"
                disabled={isLoading}
              >
                <Icon icon={faChevronRight} />
              </Button>
            </>
          )}

          {/* Control buttons */}
          <div className="performer-image-controls">
            <Button
              variant="success"
              className="performer-image-btn"
              onClick={handleUpload}
              title="Upload new image(s)"
              disabled={isLoading}
            >
              <Icon icon={faUpload} />
            </Button>

            {!isDefaultImage && (
              <>
                <Button
                  variant="primary"
                  className="performer-image-btn"
                  onClick={handleSetDefault}
                  title="Make this the default image"
                  disabled={isLoading}
                >
                  <Icon icon={faStar} />
                </Button>
                <Button
                  variant="danger"
                  className="performer-image-btn"
                  onClick={handleRemove}
                  title="Remove this image"
                  disabled={isLoading}
                >
                  <Icon icon={faTrash} />
                </Button>
              </>
            )}

            {isDefaultImage && allImages.length > 1 && (
              <span className="performer-image-default-label">(Default)</span>
            )}
          </div>

          {/* Image counter */}
          {allImages.length > 1 && (
            <div className="performer-image-counter">
              {currentImageIndex + 1} / {allImages.length}
            </div>
          )}
        </>
      )}
    </div>
  );
};
