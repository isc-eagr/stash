import React, { useMemo, useState } from "react";
import { Alert, Form } from "react-bootstrap";
import { useHistory, useLocation } from "react-router-dom";
import { OutstandingActivityMatrixTable } from "src/components/Scenes/OutstandingActivityMatrix_custom";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { useSceneStatsActivityMatrixQuery } from "src/core/generated-graphql";
import {
  makeSceneStatsActivityMatrix,
  makeSceneStatsActivityMatrixTagURL,
  makeSceneStatsActivityMatrixTreeRows,
} from "./sceneStatsActivityMatrixData_custom";
import {
  sceneStatsIncludeSubTagsFromSearch,
  sceneStatsSearchForIncludeSubTags,
} from "./sceneStatsSection_custom";

interface IProps {
  active?: boolean;
  studioId?: string;
  depth?: number;
  studioName?: string;
  performerId?: string;
  performerName?: string;
}

export const SceneStatsActivityMatrix: React.FC<IProps> = ({
  active = true,
  studioId,
  depth,
  studioName,
  performerId,
  performerName,
}) => {
  const history = useHistory();
  const location = useLocation();
  const includeSubTags = sceneStatsIncludeSubTagsFromSearch(location.search);
  const { data, error, loading } = useSceneStatsActivityMatrixQuery({
    variables: { studioId, depth, performerId, includeSubTags },
    skip: !active,
  });
  const matrix = useMemo(
    () => makeSceneStatsActivityMatrix(data?.sceneStatsActivityMatrix ?? []),
    [data?.sceneStatsActivityMatrix]
  );
  const [expandedTagIds, setExpandedTagIds] = useState<Set<string>>(new Set());
  const treeRows = useMemo(
    () =>
      includeSubTags
        ? makeSceneStatsActivityMatrixTreeRows(matrix.rows, expandedTagIds)
        : undefined,
    [expandedTagIds, includeSubTags, matrix.rows]
  );
  const studioScope =
    studioId && studioName
      ? { id: studioId, name: studioName, depth: depth ?? 0 }
      : undefined;
  const performerScope =
    performerId && performerName
      ? { id: performerId, name: performerName }
      : undefined;

  if (!active) return null;
  if (loading && !data) {
    return <LoadingIndicator message="Loading activity matrix…" />;
  }
  if (error) return <ErrorMessage error={error.message} />;
  if (matrix.rows.length === 0) {
    return <Alert variant="secondary">No tagged marker activity found.</Alert>;
  }

  return (
    <div>
      <Form.Check
        checked={includeSubTags}
        className="mb-3"
        id="scene-stats-activity-matrix-subtags"
        label="Include sub-tag content"
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          history.replace({
            ...location,
            search: sceneStatsSearchForIncludeSubTags(
              location.search,
              event.target.checked
            ),
          })
        }
        type="switch"
      />
      <OutstandingActivityMatrixTable
        expandedTagIds={expandedTagIds}
        matrix={matrix}
        onToggleTag={(tagID) =>
          setExpandedTagIds((current) => {
            const next = new Set(current);
            if (next.has(tagID)) next.delete(tagID);
            else next.add(tagID);
            return next;
          })
        }
        showPercent={false}
        tagHref={(tag) =>
          makeSceneStatsActivityMatrixTagURL(
            tag,
            studioScope,
            includeSubTags,
            performerScope
          )
        }
        treeRows={treeRows}
        title={
          studioName
            ? `${studioName} Activity Matrix`
            : performerName
            ? `${performerName} Activity Matrix`
            : "Activity Matrix"
        }
      />
    </div>
  );
};
