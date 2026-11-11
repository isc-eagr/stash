import React, { useState } from "react";

interface IProps {
  screenshot?: string | null;
  updatedAt?: string | null;
}

// Fills the player area for a release without a video file: its cover, or a
// message when it has none.
export const SceneReleaseNoFileCover: React.FC<IProps> = ({
  screenshot,
  updatedAt,
}) => {
  const [broken, setBroken] = useState(false);
  const src = screenshot
    ? `${screenshot}?t=${Date.parse(updatedAt ?? "") || 0}`
    : undefined;

  return (
    <div className="VideoPlayer">
      <div className="video-wrapper scene-player-no-file" role="status">
        {src && !broken ? (
          <img
            className="scene-release-no-file-cover"
            src={src}
            alt="Release cover"
            onError={() => setBroken(true)}
          />
        ) : (
          "This release has no video file."
        )}
      </div>
    </div>
  );
};
