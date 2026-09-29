import React, { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config";
import { SortMetricValueCustom } from "../Shared/SortMetricBadge_custom";
import {
  getSceneSortMetricCustom,
  getSceneSortMetricDefinitionCustom,
} from "./sceneSortMetric_custom";
import {
  getSceneActivityMetrics,
  type SceneActivityMetricRows,
  type SceneActivityRoleTagIds,
} from "./sceneActivityMetricsData_custom";

export interface ISceneMetricColumnCustom {
  value: string;
  label: string;
  sortBy: string;
  defaultShow?: boolean;
  render: (scene: GQL.SlimSceneDataFragment) => React.ReactNode;
}

// Header click starts these ascending; every other scene sort starts descending.
export const SCENE_TABLE_ASCENDING_SORTS_CUSTOM = [
  "title",
  "path",
  "studio",
  "code",
];

// Sort keys whose value is computed from scene markers rather than read from
// the scene itself.
const ACTIVITY_SORTS = new Set([
  "sex_activity_percent",
  "oral_activity_percent",
  "solo_activity_percent",
  "outstanding_activity_percent",
  "standard_activity_percent",
  "unclassified_activity_percent",
  "unusable_activity_percent",
]);

// Builds scene table columns whose value comes from the scene sort metric
// definitions, so each column shows the same value its sort orders by.
export function useSceneMetricColumnCustom() {
  const intl = useIntl();
  const { configuration } = useConfigurationContext();
  const roleTagIds: SceneActivityRoleTagIds = useMemo(
    () => configuration?.ui?.roleTagIds ?? {},
    [configuration?.ui?.roleTagIds]
  );

  // Activity rows are only computed for scenes whose activity columns render.
  const activityCache = useMemo(
    () =>
      new WeakMap<
        GQL.SlimSceneDataFragment,
        SceneActivityMetricRows | undefined
      >(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roleTagIds]
  );

  return useCallback(
    (sortBy: string, defaultShow = false): ISceneMetricColumnCustom => {
      const definition = getSceneSortMetricDefinitionCustom(sortBy);
      return {
        value: sortBy,
        label: intl.formatMessage({ id: definition?.messageID ?? sortBy }),
        sortBy,
        defaultShow,
        render: (scene) => {
          if (!definition) return null;
          let activityMetrics: SceneActivityMetricRows | undefined;
          if (ACTIVITY_SORTS.has(sortBy)) {
            if (!activityCache.has(scene)) {
              activityCache.set(
                scene,
                getSceneActivityMetrics(scene, roleTagIds)
              );
            }
            activityMetrics = activityCache.get(scene);
          }
          const metric = getSceneSortMetricCustom(
            sortBy,
            scene,
            GQL.SortDirectionEnum.Desc,
            roleTagIds,
            undefined,
            activityMetrics
          );
          return (
            <span className="list-table-metric">
              <SortMetricValueCustom
                format={definition.format}
                value={metric?.value}
              />
            </span>
          );
        },
      };
    },
    [intl, roleTagIds, activityCache]
  );
}
