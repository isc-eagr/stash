import React from "react";
import { Badge, Card } from "react-bootstrap";
import * as GQL from "src/core/generated-graphql";
import { FileSize } from "src/components/Shared/FileSize";

export const SceneReleaseFileInfoCustom: React.FC<{
  release: GQL.SceneReleaseDataFragment;
}> = ({ release }) => (
  <div className="p-3" aria-label={`${release.title || "Release"} files`}>
    {release.files.map((file, index) => (
      <Card key={file.id} className="mb-2">
        <Card.Body>
          <div className="d-flex align-items-center justify-content-between">
            <strong className="text-break">{file.path}</strong>
            {index === 0 && <Badge variant="primary">Primary</Badge>}
          </div>
          <div className="text-muted small">
            <FileSize size={file.size} /> · {Math.round(file.duration)}s
            {file.width && file.height ? ` · ${file.width}×${file.height}` : ""}
            {file.video_codec ? ` · ${file.video_codec}` : ""}
          </div>
        </Card.Body>
      </Card>
    ))}
    {release.files.length === 0 && (
      <span className="text-muted">No files on this release.</span>
    )}
  </div>
);
