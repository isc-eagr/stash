import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Form,
  Modal,
  OverlayTrigger,
  Spinner,
  Tooltip,
} from "react-bootstrap";
import { Helmet } from "react-helmet";
import {
  openInsightEntityLink,
  openInsightSceneLink,
} from "src/utils/insightSceneLinks_custom";
import {
  getRatingCardThresholdsForEntity,
  type IRatingCardThresholdConfig,
} from "src/utils/ratingCardStyles_custom";
import { useConfigurationContext } from "src/hooks/Config";
import { useTitleProps } from "src/hooks/title";
import { StatsPage } from "../StatsPage_custom";
import { normalizeSceneCardInsightThresholds } from "../Scenes/sceneCardInsightsData_custom";
import { SceneCardInsightChip } from "../Scenes/SceneCardInsights_custom";
import type {
  SceneCardInsightThresholdKey,
  SceneCardInsightThresholds,
} from "../Scenes/sceneCardInsightTypes_custom";
import {
  insightStatsCatalog,
  insightStatsMainCatalog,
  insightStatsTone,
  insightThresholdLabels,
} from "./insightStatsCatalog_custom";
import {
  compareInsightStatsVariants,
  insightStatsPercentage,
  type InsightStatsConfig,
  type InsightStatsMode,
  type InsightStatsRatingTier,
  type InsightStatsRatingTierCounts,
  type InsightStatsRatingTierSource,
} from "./insightStatsData_custom";
import { useInsightStats } from "./useInsightStats_custom";
import { InsightThresholdControl } from "./InsightThresholdControl";
import {
  RatingThresholdControl,
  type RatingThresholdKey,
} from "./RatingThresholdControl";
import "./InsightStats.scss";

const ratingTierLabels: Array<{
  tier: InsightStatsRatingTier;
  label: string;
  className: string;
}> = [
  {
    tier: "royalSapphire",
    label: "Royal Sapphire",
    className: "royal-sapphire",
  },
  { tier: "gold", label: "Gold", className: "gold" },
  { tier: "silver", label: "Silver", className: "silver" },
  { tier: "bronze", label: "Bronze", className: "bronze" },
  { tier: "none", label: "No Metallic Tier", className: "none" },
];

const ratingTierSources: Array<{
  source: InsightStatsRatingTierSource;
  label: string;
  previewChanges: boolean;
}> = [
  { source: "threshold", label: "Numeric rating", previewChanges: true },
  { source: "goatMarker", label: "GOAT marker", previewChanges: false },
  { source: "tagOverride", label: "Tag override", previewChanges: false },
  {
    source: "ratingAdvisor",
    label: "Advisor Sapphire bonus",
    previewChanges: false,
  },
];

const ratingThresholdKeys: RatingThresholdKey[] = [
  "bronze",
  "silver",
  "gold",
  "royalSapphire",
];

function PreviewUpdateStatus({ label }: { label: string }) {
  return (
    <span
      className="insight-stats-preview-status"
      role="status"
      aria-live="polite"
    >
      <Spinner animation="border" size="sm" aria-hidden="true" />
      {label}
    </span>
  );
}

function RatingTierActualLink({
  count,
  display,
  ids,
  entity,
  label,
}: {
  count: number;
  display?: string;
  ids: string[];
  entity: "scenes" | "vatos";
  label: string;
}) {
  const [error, setError] = useState<string>();
  if (count === 0) {
    return (
      <span className="insight-stats-rating-tier-count">{display ?? 0}</span>
    );
  }
  return (
    <span className="insight-stats-rating-tier-count">
      <Button
        className="insight-stats-rating-tier-link p-0"
        variant="link"
        title={`View matching ${entity}`}
        onClick={() => {
          try {
            if (
              !openInsightEntityLink(
                entity === "scenes" ? "scene" : "performer",
                label,
                ids
              )
            ) {
              setError("Pop-up blocked");
            }
          } catch {
            setError("Unable to create link");
          }
        }}
      >
        {display ?? count.toLocaleString()}
      </Button>
      {error && <small role="alert">{error}</small>}
    </span>
  );
}

function RatingTierTable({
  title,
  entity,
  current,
  preview,
  population,
}: {
  title: string;
  entity: "scenes" | "vatos";
  current: InsightStatsRatingTierCounts;
  preview: InsightStatsRatingTierCounts;
  population: number;
}) {
  const sources =
    entity === "scenes"
      ? ratingTierSources
      : ratingTierSources.filter(
          ({ source }) => source === "threshold" || source === "tagOverride"
        );
  const staticSources = sources.filter(({ source }) => source !== "threshold");
  return (
    <section className="insight-stats-rating-tier-table-section">
      <h3>
        {title} <small>{population.toLocaleString()} rated</small>
      </h3>
      <div className="table-responsive">
        <table
          className="table insight-stats-rating-tier-table"
          aria-label={`${title} metallic rating tiers`}
        >
          <thead>
            <tr>
              <th scope="col">Tier</th>
              <th scope="col">Current Count</th>
              <th scope="col">Projected Count</th>
              <th scope="col">Current Percentage</th>
              <th scope="col">Projected Percentage</th>
              <th scope="col">Numeric Rating</th>
              {staticSources.map(({ source, label }) => (
                <th scope="col" key={source}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ratingTierLabels.map(({ tier, label, className }) => {
              const currentTier = current[tier][entity];
              const previewTier = preview[tier][entity];
              const currentPercentage = population
                ? (currentTier.ratedTotal / population) * 100
                : 0;
              const previewPercentage = population
                ? (previewTier.ratedTotal / population) * 100
                : 0;
              const projectionClass = (
                currentValue: number,
                projectedValue: number
              ) =>
                projectedValue > currentValue
                  ? " insight-stats-rating-tier-projection-increase"
                  : projectedValue < currentValue
                  ? " insight-stats-rating-tier-projection-decrease"
                  : "";
              return (
                <tr
                  className={`insight-stats-rating-tier-${className}`}
                  key={tier}
                >
                  <th scope="row">{label}</th>
                  <td>
                    <strong>
                      <RatingTierActualLink
                        count={currentTier.total}
                        ids={currentTier.ids}
                        entity={entity}
                        label={`${title} · ${label} · Total`}
                      />
                    </strong>
                  </td>
                  <td>
                    <strong
                      className={`insight-stats-rating-tier-count${projectionClass(
                        currentTier.total,
                        previewTier.total
                      )}`}
                    >
                      {previewTier.total.toLocaleString()}
                    </strong>
                  </td>
                  <td>
                    <RatingTierActualLink
                      count={currentTier.ratedTotal}
                      display={`${currentPercentage.toFixed(1)}%`}
                      ids={currentTier.ratedIds}
                      entity={entity}
                      label={`${title} · ${label} · Rated total`}
                    />
                  </td>
                  <td>
                    <span
                      className={`insight-stats-rating-tier-count${projectionClass(
                        currentTier.ratedTotal,
                        previewTier.ratedTotal
                      )}`}
                    >
                      {previewPercentage.toFixed(1)}%
                    </span>
                  </td>
                  <td>
                    <span
                      className={`insight-stats-rating-tier-count${projectionClass(
                        currentTier.sources.threshold,
                        previewTier.sources.threshold
                      )}`}
                    >
                      {previewTier.sources.threshold.toLocaleString()}
                    </span>
                  </td>
                  {staticSources.map(({ source, label: sourceLabel }) => (
                    <td key={source}>
                      <RatingTierActualLink
                        count={currentTier.sources[source]}
                        ids={currentTier.sourceIds[source]}
                        entity={entity}
                        label={`${title} · ${label} · ${sourceLabel}`}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/*
 * Kept below RatingTierTable so this page's existing coverage table can share
 * the same exact-ID snapshot behavior without changing its presentation.
 */
function Coverage({
  count,
  total,
  ids,
  label,
}: {
  count: number;
  total: number;
  ids?: string[];
  label?: string;
}) {
  const [error, setError] = useState<string>();
  const percent = insightStatsPercentage(count, total);
  return (
    <div className="insight-stats-coverage">
      {ids ? (
        <Button
          variant="link"
          className="p-0"
          title="View all matching scenes"
          onClick={() => {
            try {
              if (!openInsightSceneLink(label ?? "Insight", ids)) {
                setError(
                  "Your browser blocked the new Scenes tab. Please allow pop-ups and retry."
                );
              }
            } catch {
              setError(
                "Unable to store scene link. Free browser storage and retry."
              );
            }
          }}
        >
          <strong>{count.toLocaleString()}</strong>
        </Button>
      ) : (
        <strong>{count.toLocaleString()}</strong>
      )}{" "}
      {error && <small role="alert">{error}</small>}
      <span>{percent.toFixed(1)}%</span>
      <meter
        min={0}
        max={100}
        value={percent}
        aria-label={`${percent.toFixed(1)}% of eligible scenes`}
      />
    </div>
  );
}

function Change({
  current,
  preview,
  total,
}: {
  current: number;
  preview: number;
  total: number;
}) {
  const delta = preview - current;
  const prefix = delta > 0 ? "+" : "";
  return (
    <span className={delta ? "insight-stats-changed" : "text-muted"}>
      {prefix}
      {delta.toLocaleString()}
      <small>
        {prefix}
        {insightStatsPercentage(delta, total).toFixed(1)} pp
      </small>
    </span>
  );
}

const InsightStats: React.FC = () => {
  const titleProps = useTitleProps("Insight Stats");
  const { configuration } = useConfigurationContext();
  const { ui } = configuration;
  const missingMappings = (
    [
      ["sexTagId", "Sex"],
      ["oralTagId", "Oral"],
      ["soloTagId", "Solo"],
      ["goatTagId", "GOAT"],
      ["reallyHotTagId", "Really Hot"],
      ["orgasmTagId", "Orgasm"],
      ["facialTagId", "Facial"],
      ["secondCameraTagId", "2nd Camera"],
      ["feetTagId", "Feet"],
    ] as const
  )
    .filter(([key]) => !ui?.roleTagIds?.[key])
    .map(([, label]) => label);
  const configJSON = JSON.stringify({
    roleTagIds: ui?.roleTagIds,
    sceneCardInsightThresholds: ui?.sceneCardInsightThresholds,
    ratingCardOverrideTagIds: ui?.ratingCardOverrideTagIds,
    ratingCardThresholds: ui?.ratingCardThresholds,
  });
  const saved = useMemo(
    () =>
      normalizeSceneCardInsightThresholds(
        (JSON.parse(configJSON) as InsightStatsConfig)
          .sceneCardInsightThresholds
      ),
    [configJSON]
  );
  const savedRatingThresholds = useMemo<IRatingCardThresholdConfig>(() => {
    const configured = (JSON.parse(configJSON) as InsightStatsConfig)
      .ratingCardThresholds;
    return {
      scene: getRatingCardThresholdsForEntity(configured, "scene"),
      performer: getRatingCardThresholdsForEntity(configured, "performer"),
    };
  }, [configJSON]);
  const [draft, setDraft] = useState<SceneCardInsightThresholds>(saved);
  const [ratingDraft, setRatingDraft] = useState<IRatingCardThresholdConfig>(
    savedRatingThresholds
  );
  const [refresh, setRefresh] = useState(0);
  const [mode, setMode] = useState<InsightStatsMode>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("catalog");
  const [showZero, setShowZero] = useState(true);
  const [selected, setSelected] = useState<string>();
  const [variantSearch, setVariantSearch] = useState("");
  const [combinations, setCombinations] = useState(false);
  const [variantPage, setVariantPage] = useState(0);
  useEffect(() => {
    setDraft(saved);
    setRatingDraft(savedRatingThresholds);
  }, [saved, savedRatingThresholds]);
  const { result, error, message, updatingChips, updatingRatings } =
    useInsightStats(configJSON, draft, ratingDraft, refresh);
  const changedKeys = (
    Object.keys(saved) as SceneCardInsightThresholdKey[]
  ).filter((key) => saved[key] !== draft[key]);
  const changedRatingThresholds = (["scene", "performer"] as const).flatMap(
    (entity) =>
      ratingThresholdKeys.filter(
        (key) =>
          savedRatingThresholds[entity]?.[key] !== ratingDraft[entity]?.[key]
      )
  );
  const total = result?.current.total ?? 0;
  const selectedDefinition = insightStatsCatalog.find(
    ({ id }) => id === selected
  );
  const variants = useMemo(() => {
    if (!result || !selected) return [];
    return compareInsightStatsVariants(
      result.current.rows.get(selected)!,
      result.preview.rows.get(selected)!,
      mode,
      variantSearch,
      !combinations
    );
  }, [mode, result, selected, variantSearch, combinations]);
  const visibleVariantPage = Math.min(
    variantPage,
    Math.max(0, Math.ceil(variants.length / 25) - 1)
  );
  const rows = insightStatsMainCatalog
    .filter((definition) => {
      if (
        !`${definition.label} ${definition.note}`
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase())
      )
        return false;
      return (
        showZero ||
        !result ||
        (result.current.rows.get(definition.id)?.[mode] ?? 0) > 0 ||
        (result.preview.rows.get(definition.id)?.[mode] ?? 0) > 0
      );
    })
    .sort((a, b) => {
      if (!result || sort === "catalog") return 0;
      const currentA = result.current.rows.get(a.id)![mode];
      const currentB = result.current.rows.get(b.id)![mode];
      const previewA = result.preview.rows.get(a.id)![mode];
      const previewB = result.preview.rows.get(b.id)![mode];
      return (
        (sort === "current"
          ? currentB - currentA
          : sort === "preview"
          ? previewB - previewA
          : Math.abs(previewB - currentB) - Math.abs(previewA - currentA)) ||
        a.label.localeCompare(b.label)
      );
    });

  const setThreshold = (key: SceneCardInsightThresholdKey, value: string) => {
    if (value === "" || !Number.isFinite(Number(value))) return;
    setDraft((previous) =>
      normalizeSceneCardInsightThresholds({ ...previous, [key]: Number(value) })
    );
  };

  const setRatingThreshold = (
    entity: "scene" | "performer",
    key: RatingThresholdKey,
    value: number
  ) => {
    setRatingDraft((previous) => ({
      ...previous,
      [entity]: {
        ...getRatingCardThresholdsForEntity(previous, entity),
        [key]: value,
      },
    }));
  };

  const selectDefinition = (id: string) => {
    setSelected(id);
    setVariantSearch("");
    setVariantPage(0);
  };

  const tooltipID = (id: string) =>
    `insight-stats-tooltip-${id.replace(/[^a-z0-9-]/gi, "-")}`;

  return (
    <StatsPage className="insight-stats-page">
      <Helmet {...titleProps} />
      <div className="insight-stats-shell">
        <header className="insight-stats-header">
          <div>
            <div className="insight-stats-eyebrow">
              INSIGHTS ENGINE · THRESHOLD PLAYGROUND
            </div>
            <h1>Insight Stats</h1>
          </div>
          <Button
            className="insight-stats-action"
            variant="outline-secondary"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Refresh library scan
          </Button>
        </header>
        <div className="insight-stats-notice">
          Preview only · totals use scenes with at least one activity type
          marker with an end time.
        </div>
        {error && (
          <div role="alert" className="alert alert-danger">
            {error}{" "}
            <Button
              className="insight-stats-action insight-stats-action-danger"
              variant="outline-danger"
              onClick={() => setRefresh((value) => value + 1)}
            >
              Retry scan
            </Button>
          </div>
        )}
        {!result && !error && (
          <p role="status">
            <Spinner animation="border" size="sm" /> {message}
          </p>
        )}
        {result && (
          <>
            <div className="insight-stats-summary">
              <div>
                <strong>{total.toLocaleString()}</strong>
                <span>Eligible scenes</span>
              </div>
              <div>
                <strong>{result.current.scanned.toLocaleString()}</strong>
                <span>Scenes scanned</span>
              </div>
              <div>
                <strong>{result.current.withoutChips.toLocaleString()}</strong>
                <span>No qualifying chips</span>
              </div>
              <div>
                <strong>
                  {result.current.excludedWithoutMarkers.toLocaleString()}
                </strong>
                <span>Excluded · no markers</span>
              </div>
            </div>
            <p className="text-muted">
              {result.cacheAvailable
                ? "12-hour cache · "
                : "Cache unavailable · "}
              Updated {new Date(result.scannedAt).toLocaleString()} ·{" "}
              {result.current.excludedWithoutEndTime.toLocaleString()} excluded
              without an ended activity type marker ·{" "}
              {result.current.withoutDuration.toLocaleString()} eligible scenes
              without duration.
            </p>
            <section
              className="insight-stats-rating-tiers"
              aria-labelledby="insight-stats-rating-tiers-heading"
              aria-busy={updatingRatings}
            >
              <div className="insight-stats-rating-tiers-heading">
                <div>
                  <h2 id="insight-stats-rating-tiers-heading">
                    Rating tier preview
                  </h2>
                  {updatingRatings && (
                    <PreviewUpdateStatus label="Updating tier preview…" />
                  )}
                </div>
                <Button
                  className="insight-stats-action"
                  size="sm"
                  variant="outline-secondary"
                  disabled={!changedRatingThresholds.length}
                  onClick={() => setRatingDraft(savedRatingThresholds)}
                >
                  Reset rating preview
                </Button>
              </div>
              <div className="insight-stats-rating-tier-panels">
                {(["scene", "performer"] as const).map((thresholdEntity) => {
                  const entity =
                    thresholdEntity === "scene" ? "scenes" : "vatos";
                  const title =
                    thresholdEntity === "scene" ? "Scenes" : "Vatos";
                  return (
                    <section
                      className="insight-stats-rating-tier-panel"
                      key={thresholdEntity}
                    >
                      <h3>
                        {thresholdEntity === "scene" ? "Scene" : "Vato"}{" "}
                        thresholds
                      </h3>
                      <div className="insight-stats-rating-thresholds">
                        {ratingThresholdKeys.map((key) => (
                          <RatingThresholdControl
                            key={key}
                            entity={thresholdEntity}
                            thresholdKey={key}
                            value={
                              getRatingCardThresholdsForEntity(
                                ratingDraft,
                                thresholdEntity
                              )[key]
                            }
                            onChange={setRatingThreshold}
                          />
                        ))}
                      </div>
                      <RatingTierTable
                        title={title}
                        entity={entity}
                        current={result.current.ratingTiers}
                        preview={result.preview.ratingTiers}
                        population={result.current.ratingTierPopulation[entity]}
                      />
                    </section>
                  );
                })}
              </div>
            </section>
            {total === 0 && (
              <div role="status" className="alert alert-info">
                No eligible scenes in this scan. The chip catalog remains
                available below.
              </div>
            )}
          </>
        )}
        {missingMappings.length > 0 && (
          <p className="alert alert-info">
            Unconfigured role tags: {missingMappings.join(", ")}. Tag-dependent
            coverage follows your current mappings in Custom Settings.
          </p>
        )}
        <div className="insight-stats-layout">
          <aside className="insight-stats-controls">
            <h2>Try thresholds</h2>
            <p>{changedKeys.length} unsaved</p>
            <Button
              className="insight-stats-action"
              size="sm"
              variant="outline-secondary"
              disabled={!changedKeys.length}
              onClick={() => setDraft(saved)}
            >
              Reset preview to saved
            </Button>
            <div className="insight-stats-threshold-grid">
              {(
                Object.keys(
                  insightThresholdLabels
                ) as SceneCardInsightThresholdKey[]
              ).map((key) => (
                <InsightThresholdControl
                  key={key}
                  thresholdKey={key}
                  value={draft[key]}
                  onChange={setThreshold}
                />
              ))}
            </div>
          </aside>
          <section
            className="insight-stats-results"
            aria-label="Chip coverage"
            aria-busy={updatingChips}
          >
            <div className="insight-stats-toolbar">
              <Form.Group controlId="insight-stats-mode">
                <Form.Label>Count chips</Form.Label>
                <Form.Control
                  as="select"
                  value={mode}
                  onChange={(event) => {
                    setMode(event.target.value as InsightStatsMode);
                    setVariantPage(0);
                  }}
                >
                  <option value="all">
                    All qualifying chips (includes overflow)
                  </option>
                  <option value="visible">Visible on scene cards</option>
                </Form.Control>
              </Form.Group>
              <Form.Group controlId="insight-stats-search">
                <Form.Label>Find a chip family</Form.Label>
                <Form.Control
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="GOAT, filler, rare…"
                />
              </Form.Group>
              <Form.Group controlId="insight-stats-sort">
                <Form.Label>Sort by</Form.Label>
                <Form.Control
                  as="select"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="catalog">Chip family</option>
                  <option value="current">Current coverage</option>
                  <option value="preview">Preview coverage</option>
                  <option value="change">Largest change</option>
                </Form.Control>
              </Form.Group>
            </div>
            <div className="insight-stats-table-status">
              <Form.Check
                id="insight-stats-zero"
                label="Include zero-count chip types"
                checked={showZero}
                onChange={(event) => setShowZero(event.target.checked)}
              />
              {result && updatingChips ? (
                <PreviewUpdateStatus label="Updating chip preview…" />
              ) : (
                <span role="status">
                  {result ? `${rows.length} chip rows` : "Waiting for scan"}
                </span>
              )}
            </div>
            <p className="insight-stats-help">
              Click a family to inspect combinations.
            </p>
            <div className="table-responsive">
              <table className="table insight-stats-table">
                <thead>
                  <tr>
                    <th scope="col">Chip / family</th>
                    <th scope="col">
                      Current
                      <br />
                      <small>Saved thresholds</small>
                    </th>
                    <th scope="col">
                      Preview
                      <br />
                      <small>Temporary thresholds</small>
                    </th>
                    <th scope="col">
                      Change
                      <br />
                      <small>Scenes / percentage points</small>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((definition) => {
                    const current =
                      result?.current.rows.get(definition.id)?.[mode] ?? 0;
                    const preview =
                      result?.preview.rows.get(definition.id)?.[mode] ?? 0;
                    return (
                      <tr key={definition.id}>
                        <th scope="row">
                          <OverlayTrigger
                            placement="top"
                            overlay={
                              <Tooltip id={tooltipID(definition.id)}>
                                {definition.note}
                              </Tooltip>
                            }
                          >
                            <SceneCardInsightChip
                              ariaLabel={`${definition.label}. ${definition.note} Open combinations.`}
                              className={
                                result
                                  ? "scene-card-insight-clickable"
                                  : undefined
                              }
                              label={definition.label}
                              onClick={() => {
                                if (result) selectDefinition(definition.id);
                              }}
                              onKeyDown={(event) => {
                                if (
                                  event.key !== "Enter" &&
                                  event.key !== " "
                                ) {
                                  return;
                                }
                                event.preventDefault();
                                if (result) selectDefinition(definition.id);
                              }}
                              role="button"
                              tabIndex={result ? 0 : -1}
                              tone={insightStatsTone(definition.kind)}
                            />
                          </OverlayTrigger>
                        </th>
                        <td>
                          {result ? (
                            <Coverage
                              count={current}
                              total={total}
                              ids={
                                result.current.rows.get(definition.id)
                                  ?.sceneIds[mode]
                              }
                              label={`${definition.label} · saved`}
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {result && !updatingChips ? (
                            <Coverage
                              count={preview}
                              total={total}
                              ids={
                                result.preview.rows.get(definition.id)
                                  ?.sceneIds[mode]
                              }
                              label={`${definition.label} · preview`}
                            />
                          ) : (
                            "…"
                          )}
                        </td>
                        <td>
                          {result && !updatingChips ? (
                            <Change
                              current={current}
                              preview={preview}
                              total={total}
                            />
                          ) : (
                            "…"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && <p>No chip types match these filters.</p>}
          </section>
        </div>
      </div>
      <Modal
        show={!!selectedDefinition}
        onHide={() => setSelected(undefined)}
        size="xl"
        className="insight-stats-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>{selectedDefinition?.label}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="insight-stats-modal-thresholds">
            {selectedDefinition?.thresholds.map((key) => (
              <InsightThresholdControl
                key={key}
                thresholdKey={key}
                value={draft[key]}
                onChange={setThreshold}
                prefix="modal"
              />
            ))}
            {mode === "visible" && (
              <InsightThresholdControl
                thresholdKey="visibleInsightLimit"
                value={draft.visibleInsightLimit}
                onChange={setThreshold}
                prefix="modal"
              />
            )}
          </div>
          <p className="text-muted">
            Current vs. preview combinations · {total.toLocaleString()} scenes.
          </p>
          <Form.Group controlId="insight-stats-variants">
            <Form.Label>Find a chip</Form.Label>
            <Form.Control
              type="search"
              placeholder="Tag, quality, pattern…"
              value={variantSearch}
              onChange={(event) => {
                setVariantSearch(event.target.value);
                setVariantPage(0);
              }}
            />
          </Form.Group>
          <Form.Check
            id="insight-stats-combinations"
            label="Show combined chip text"
            checked={combinations}
            onChange={(event) => {
              setCombinations(event.target.checked);
              setVariantPage(0);
            }}
          />
          {updatingChips && (
            <PreviewUpdateStatus label="Updating chip preview…" />
          )}
          <div className="table-responsive">
            <table className="table insight-stats-table">
              <thead>
                <tr>
                  <th scope="col">Combination / chip text</th>
                  <th scope="col">Current</th>
                  <th scope="col">Preview</th>
                  <th scope="col">Change</th>
                </tr>
              </thead>
              <tbody>
                {variants
                  .slice(visibleVariantPage * 25, (visibleVariantPage + 1) * 25)
                  .map((variant) => (
                    <tr key={variant.label}>
                      <th scope="row">
                        <OverlayTrigger
                          placement="top"
                          overlay={
                            <Tooltip id={tooltipID(`variant-${variant.label}`)}>
                              {insightStatsCatalog.find(
                                (definition) =>
                                  definition.label === variant.label
                              )?.note ?? selectedDefinition?.note}
                            </Tooltip>
                          }
                        >
                          <SceneCardInsightChip
                            label={variant.label}
                            tone={insightStatsTone(selectedDefinition!.kind)}
                            ariaLabel={variant.label}
                            tabIndex={0}
                          />
                        </OverlayTrigger>
                      </th>
                      <td>
                        <Coverage
                          count={variant.current}
                          total={total}
                          ids={variant.currentIds}
                          label={`${variant.label} · saved`}
                        />
                      </td>
                      <td>
                        {updatingChips ? (
                          "…"
                        ) : (
                          <Coverage
                            count={variant.preview}
                            total={total}
                            ids={variant.previewIds}
                            label={`${variant.label} · preview`}
                          />
                        )}
                      </td>
                      <td>
                        {updatingChips ? (
                          "…"
                        ) : (
                          <Change
                            current={variant.current}
                            preview={variant.preview}
                            total={total}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!variants.length && (
            <p>
              No observed combinations match this view. Zero can mean no
              matches, a missing tag mapping, or a disabled rule.
            </p>
          )}
          <div className="insight-stats-pagination">
            <Button
              className="insight-stats-action"
              variant="outline-secondary"
              disabled={visibleVariantPage === 0}
              onClick={() => setVariantPage(visibleVariantPage - 1)}
            >
              Previous
            </Button>
            <span>
              {variants.length.toLocaleString()} combinations · Page{" "}
              {visibleVariantPage + 1} /{" "}
              {Math.max(1, Math.ceil(variants.length / 25))}
            </span>
            <Button
              className="insight-stats-action"
              variant="outline-secondary"
              disabled={(visibleVariantPage + 1) * 25 >= variants.length}
              onClick={() => setVariantPage(visibleVariantPage + 1)}
            >
              Next
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </StatsPage>
  );
};

export default InsightStats;
