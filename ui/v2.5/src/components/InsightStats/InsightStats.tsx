import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Form,
  Modal,
  OverlayTrigger,
  Spinner,
  Tooltip,
} from "react-bootstrap";
import { openInsightSceneLink } from "src/utils/insightSceneLinks_custom";
import { useConfigurationContext } from "src/hooks/Config";
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
} from "./insightStatsData_custom";
import { useInsightStats } from "./useInsightStats_custom";
import { InsightThresholdControl } from "./InsightThresholdControl";
import "./InsightStats.scss";

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
    <span
      className={
        delta > 0
          ? "insight-stats-changed increase"
          : delta < 0
          ? "insight-stats-changed decrease"
          : "text-muted"
      }
    >
      {prefix}
      {delta.toLocaleString()}
      <small>
        {prefix}
        {insightStatsPercentage(delta, total).toFixed(1)} pp
      </small>
    </span>
  );
}

export const InsightStats: React.FC = () => {
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
  const [draft, setDraft] = useState<SceneCardInsightThresholds>(saved);
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
  }, [saved]);
  const { result, error, message, updatingChips } = useInsightStats(
    configJSON,
    draft,
    refresh
  );
  const changedKeys = (
    Object.keys(saved) as SceneCardInsightThresholdKey[]
  ).filter((key) => saved[key] !== draft[key]);
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

  const selectDefinition = (id: string) => {
    setSelected(id);
    setVariantSearch("");
    setVariantPage(0);
  };

  const tooltipID = (id: string) =>
    `insight-stats-tooltip-${id.replace(/[^a-z0-9-]/gi, "-")}`;

  return (
    <>
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
    </>
  );
};

export default InsightStats;
