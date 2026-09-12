import React, { useMemo, useState } from "react";
import { Alert, Button, ButtonGroup, ProgressBar } from "react-bootstrap";
import { useConfigurationContext } from "src/hooks/Config";
import { openInsightEntityLink } from "src/utils/insightSceneLinks_custom";
import type { SceneRatingModeCustom } from "../Shared/groupSceneRating_custom";
import {
  emptyPlaygroundFilters,
  matchesPlaygroundFilters,
  playgroundFilterCount,
  preparePlaygroundScene,
  type IPlaygroundFilters,
} from "./playgroundData_custom";
import { PlaygroundSceneFilters } from "./PlaygroundSceneFilters";
import { RatingTierThresholds } from "./RatingTierThresholds";
import { useRatingTierThresholdDraft } from "./useRatingTierThresholdDraft_custom";
import { ratingTiers, type IRatingTierConfig } from "./ratingTiersData_custom";
import {
  countSceneTiers,
  createSceneTierMembers,
  groupSceneTiers,
  type ISceneTierBandCount,
  type SceneTierDimension,
  type SceneTierSort,
} from "./sceneTiersData_custom";
import type { IPlaygroundScenesState } from "./usePlaygroundScenes_custom";

export const PlaygroundSceneTiers: React.FC<{
  state: IPlaygroundScenesState;
  onReload: () => void;
}> = ({ state, onReload }) => {
  const { configuration } = useConfigurationContext();
  const ui = useMemo(() => configuration.ui ?? {}, [configuration.ui]);
  const [mode, setMode] = useState<SceneRatingModeCustom | "all">("all");
  const [filters, setFilters] = useState<IPlaygroundFilters>(
    emptyPlaygroundFilters
  );
  const [dimension, setDimension] = useState<SceneTierDimension>("sceneType");
  const [sort, setSort] = useState<SceneTierSort>("total");
  const [descending, setDescending] = useState(true);
  const [drilldownError, setDrilldownError] = useState<string>();
  const thresholds = useRatingTierThresholdDraft(
    ui.ratingCardThresholds,
    "scene"
  );
  const entries = useMemo(
    () => state.scenes.map((scene) => preparePlaygroundScene(scene, ui)),
    [state.scenes, ui]
  );
  const modeEntries = useMemo(
    () => entries.filter((entry) => mode === "all" || entry.mode === mode),
    [entries, mode]
  );
  const filtered = useMemo(
    () =>
      modeEntries.filter((entry) => matchesPlaygroundFilters(entry, filters)),
    [modeEntries, filters]
  );
  const currentConfig: IRatingTierConfig = useMemo(
    () => ({
      thresholds: ui.ratingCardThresholds,
      overrideTagIds: ui.ratingCardOverrideTagIds,
      goatTagId: ui.roleTagIds?.goatTagId,
    }),
    [
      ui.ratingCardOverrideTagIds,
      ui.ratingCardThresholds,
      ui.roleTagIds?.goatTagId,
    ]
  );
  const projectedConfig: IRatingTierConfig = useMemo(
    () => ({
      ...currentConfig,
      thresholds: {
        ...(ui.ratingCardThresholds ?? {}),
        scene: thresholds.draft,
      },
    }),
    [currentConfig, thresholds.draft, ui.ratingCardThresholds]
  );
  const members = useMemo(
    () => createSceneTierMembers(filtered, currentConfig, projectedConfig),
    [currentConfig, filtered, projectedConfig]
  );
  const totals = useMemo(() => countSceneTiers(members), [members]);
  const rows = useMemo(
    () => groupSceneTiers(members, dimension, sort, descending),
    [members, dimension, sort, descending]
  );

  function openExact(label: string, ids: string[]) {
    if (!ids.length) return;
    try {
      if (!openInsightEntityLink("scene", label, ids))
        setDrilldownError("Your browser blocked the new Scenes tab.");
    } catch {
      setDrilldownError("Unable to create the exact Scene drilldown.");
    }
  }

  function renderExactCount(
    current: ISceneTierBandCount,
    projected: ISceneTierBandCount,
    currentTotal: number,
    projectedTotal: number,
    label: string
  ) {
    const currentPercent = currentTotal
      ? (current.count / currentTotal) * 100
      : 0;
    const projectedPercent = projectedTotal
      ? (projected.count / projectedTotal) * 100
      : 0;
    const delta = projected.count - current.count;
    return (
      <div className="rating-tier-count-pair">
        <button
          type="button"
          className="vato-tiers-count"
          disabled={!current.count}
          onClick={() => openExact(`${label} · Current`, current.ids)}
        >
          <strong>{current.count.toLocaleString()}</strong>
          <span>{currentPercent.toFixed(1)}% current</span>
        </button>
        <button
          type="button"
          className={`rating-tier-projected${
            delta > 0 ? " increase" : delta < 0 ? " decrease" : ""
          }`}
          disabled={!projected.count}
          onClick={() => openExact(`${label} · Projected`, projected.ids)}
        >
          <strong>{projected.count.toLocaleString()}</strong>
          <span>
            {projectedPercent.toFixed(1)}% projected
            {delta ? ` · ${delta > 0 ? "+" : ""}${delta}` : ""}
          </span>
        </button>
      </div>
    );
  }

  function renderHeading(key: SceneTierSort, label: string) {
    return (
      <th
        scope="col"
        key={key}
        aria-sort={
          sort === key ? (descending ? "descending" : "ascending") : "none"
        }
      >
        <button
          type="button"
          onClick={() => {
            setSort(key);
            setDescending(sort === key ? !descending : key !== "label");
          }}
        >
          {label}
          <span aria-hidden="true">
            {sort === key ? (descending ? " ↓" : " ↑") : " ↕"}
          </span>
        </button>
      </th>
    );
  }

  return (
    <section className="vato-tiers rating-tiers" aria-label="Scene Tiers">
      <div className="vato-tiers-heading">
        <div>
          <h2>Scene Tiers</h2>
          {!state.loading && !state.error && (
            <span role="status">
              {totals.currentTotal.toLocaleString()} tiered of{" "}
              {filtered.length.toLocaleString()} matching scenes
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={state.loading}
          title={
            state.loadedAt
              ? `Loaded ${new Date(state.loadedAt).toLocaleString()}`
              : undefined
          }
          onClick={onReload}
        >
          Reload scenes
        </Button>
      </div>
      <RatingTierThresholds
        entity="scene"
        draft={thresholds.draft}
        changed={thresholds.changed}
        onChange={thresholds.setDraft}
        onReset={thresholds.reset}
      />
      <PlaygroundSceneFilters
        idPrefix="scene-tiers"
        entries={modeEntries}
        mode={mode}
        showMode
        filters={filters}
        config={ui}
        disabled={state.loading}
        onModeChange={(nextMode) => {
          setMode(nextMode);
          setFilters((previous) => ({
            ...previous,
            present: [],
            absent: [],
          }));
        }}
        onChange={setFilters}
      />
      {state.loading && (
        <div className="playground-panel rating-tiers-loading" role="status">
          <p>
            Loading scenes
            {state.total
              ? ` · ${state.loaded.toLocaleString()} / ${state.total.toLocaleString()}`
              : "…"}
          </p>
          <ProgressBar
            animated
            now={state.total ? (state.loaded / state.total) * 100 : 0}
          />
        </div>
      )}
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {drilldownError && (
        <Alert
          variant="warning"
          dismissible
          onClose={() => setDrilldownError(undefined)}
        >
          {drilldownError}
        </Alert>
      )}
      {!state.loading && !state.error && totals.currentTotal > 0 && (
        <>
          <div className="vato-tiers-cards">
            {ratingTiers.map((tier) => (
              <div
                key={tier.key}
                className="vato-tiers-card"
                style={{ "--tier-color": tier.color } as React.CSSProperties}
              >
                <span className="vato-tiers-card-label">{tier.label}</span>
                {renderExactCount(
                  totals.current[tier.key],
                  totals.projected[tier.key],
                  totals.currentTotal,
                  totals.projectedTotal,
                  `Scene Tiers · ${tier.label}`
                )}
                <span className="vato-tiers-card-track" aria-hidden="true">
                  <span
                    style={{
                      width: `${
                        totals.projectedTotal
                          ? (totals.projected[tier.key].count /
                              totals.projectedTotal) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </span>
              </div>
            ))}
          </div>
          <div className="vato-tiers-table-panel">
            <div className="vato-tiers-toolbar">
              <div className="vato-tiers-group">
                <span>Group by</span>
                <ButtonGroup aria-label="Group by">
                  {(["sceneType", "studio"] as const).map((key) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={dimension === key ? "primary" : "secondary"}
                      aria-pressed={dimension === key}
                      onClick={() => setDimension(key)}
                    >
                      {key === "sceneType" ? "Scene Type" : "Studio"}
                    </Button>
                  ))}
                </ButtonGroup>
              </div>
            </div>
            <div className="table-responsive">
              <table className="vato-tiers-table">
                <caption className="sr-only">
                  Scene Tiers by{" "}
                  {dimension === "sceneType" ? "Scene Type" : "Studio"}, with
                  current and projected counts and row percentages.
                </caption>
                <thead>
                  <tr>
                    {renderHeading(
                      "label",
                      dimension === "sceneType" ? "Scene Type" : "Studio"
                    )}
                    {ratingTiers.map((tier) =>
                      renderHeading(tier.key, tier.label)
                    )}
                    {renderHeading("total", "Total")}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">
                        <button
                          type="button"
                          className="vato-tiers-row-label"
                          onClick={() =>
                            openExact(
                              `Scene Tiers · ${row.label}`,
                              row.currentIds
                            )
                          }
                        >
                          {row.label}
                        </button>
                        <div
                          className="vato-tiers-distribution"
                          aria-hidden="true"
                        >
                          {ratingTiers.map((tier) => (
                            <span
                              key={tier.key}
                              style={{
                                background: tier.color,
                                width: `${
                                  row.projectedTotal
                                    ? (row.projected[tier.key].count /
                                        row.projectedTotal) *
                                      100
                                    : 0
                                }%`,
                              }}
                            />
                          ))}
                        </div>
                      </th>
                      {ratingTiers.map((tier) => (
                        <td
                          key={tier.key}
                          style={
                            {
                              "--tier-color": tier.color,
                            } as React.CSSProperties
                          }
                        >
                          {renderExactCount(
                            row.current[tier.key],
                            row.projected[tier.key],
                            row.currentTotal,
                            row.projectedTotal,
                            `Scene Tiers · ${row.label} · ${tier.label}`
                          )}
                        </td>
                      ))}
                      <td>
                        {renderExactCount(
                          { count: row.currentTotal, ids: row.currentIds },
                          { count: row.projectedTotal, ids: row.projectedIds },
                          row.currentTotal,
                          row.projectedTotal,
                          `Scene Tiers · ${row.label} · Total`
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    {ratingTiers.map((tier) => (
                      <td key={tier.key}>
                        {renderExactCount(
                          totals.current[tier.key],
                          totals.projected[tier.key],
                          totals.currentTotal,
                          totals.projectedTotal,
                          `Scene Tiers · ${tier.label} · Total`
                        )}
                      </td>
                    ))}
                    <td>
                      {renderExactCount(
                        { count: totals.currentTotal, ids: totals.currentIds },
                        {
                          count: totals.projectedTotal,
                          ids: totals.projectedIds,
                        },
                        totals.currentTotal,
                        totals.projectedTotal,
                        "Scene Tiers · Total"
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
      {!state.loading && !state.error && totals.currentTotal === 0 && (
        <div className="vato-tiers-empty">
          <h3>
            {playgroundFilterCount(filters)
              ? "No matching tiered scenes"
              : "No tiered scenes yet"}
          </h3>
          {!!playgroundFilterCount(filters) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFilters(emptyPlaygroundFilters)}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
    </section>
  );
};
