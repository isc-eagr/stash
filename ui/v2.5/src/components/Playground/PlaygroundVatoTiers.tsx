import React, { useMemo, useState } from "react";
import { Alert, Button, ButtonGroup, Form, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import Select from "react-select";
import { useConfigurationContext } from "src/hooks/Config";
import { openInsightEntityLink } from "src/utils/insightSceneLinks_custom";
import { makeVatoTierPerformersUrl } from "src/utils/navigation_custom";
import {
  countVatoTiers,
  emptyVatoTierFilters,
  filterTierVatos,
  groupTierVatos,
  projectVatoTiers,
  vatoTiers,
  vatoTierDisplayValue,
  vatoTierFilterValue,
  type VatoTier,
  type VatoTierDimension,
  type VatoTierSort,
} from "./vatoTiersData_custom";
import { useVatoTiers, type IVatoTiersState } from "./useVatoTiers_custom";
import { RatingTierThresholds } from "./RatingTierThresholds";
import { useRatingTierThresholdDraft } from "./useRatingTierThresholdDraft_custom";
import type { IRatingTierConfig } from "./ratingTiersData_custom";

export const VatoTiersView: React.FC<{
  state: IVatoTiersState;
  onReload: () => void;
  ratingConfig?: IRatingTierConfig;
}> = ({ state, onReload, ratingConfig = {} }) => {
  const [filters, setFilters] = useState(emptyVatoTierFilters);
  const [dimension, setDimension] = useState<VatoTierDimension>("ethnicity");
  const [sort, setSort] = useState<VatoTierSort>("total");
  const [descending, setDescending] = useState(true);
  const [drilldownError, setDrilldownError] = useState<string>();
  const thresholds = useRatingTierThresholdDraft(
    ratingConfig.thresholds,
    "performer"
  );

  const options = useMemo(() => {
    const choices = (key: VatoTierDimension) =>
      [
        ...new Set(
          state.performers.map((performer) =>
            vatoTierFilterValue(performer, key)
          )
        ),
      ]
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: vatoTierDisplayValue(value, key) }));
    return { ethnicity: choices("ethnicity"), country: choices("country") };
  }, [state.performers]);
  const filtered = useMemo(
    () => filterTierVatos(state.performers, filters),
    [state.performers, filters]
  );
  const totals = useMemo(() => countVatoTiers(filtered), [filtered]);
  const projectedConfig = useMemo<IRatingTierConfig>(
    () => ({
      ...ratingConfig,
      thresholds: {
        ...(ratingConfig.thresholds ?? {}),
        performer: thresholds.draft,
      },
    }),
    [ratingConfig, thresholds.draft]
  );
  const projected = useMemo(
    () => projectVatoTiers(filtered, projectedConfig),
    [filtered, projectedConfig]
  );
  const projectedTotals = useMemo(() => countVatoTiers(projected), [projected]);
  const rows = useMemo(
    () => groupTierVatos(filtered, dimension, sort, descending),
    [filtered, dimension, sort, descending]
  );
  const hasFilters = !!(filters.ethnicity.length || filters.country.length);

  function vatoListUrl(tier?: VatoTier, values?: string[]) {
    return makeVatoTierPerformersUrl({
      ...filters,
      [dimension]: values ?? filters[dimension],
      tier,
    });
  }

  function renderCount(
    count: number,
    total: number,
    tier?: VatoTier,
    values?: string[]
  ) {
    const selectedProjected = projected.filter(
      (performer) =>
        (!tier || performer.tier === tier) &&
        (!values || values.includes(vatoTierFilterValue(performer, dimension)))
    );
    const projectedCount = selectedProjected.length;
    const projectedTotal = total;
    const projectedIds = selectedProjected.map(({ id }) => id);
    const percentage = total ? (count / total) * 100 : 0;
    const projectedPercentage = projectedTotal
      ? (projectedCount / projectedTotal) * 100
      : 0;
    const delta = projectedCount - count;
    return (
      <div className="rating-tier-count-pair">
        <Link
          className="vato-tiers-count"
          to={vatoListUrl(tier, values)}
          aria-label={`View ${count.toLocaleString()} vatos · ${
            vatoTiers.find((entry) => entry.key === tier)?.label ?? "All tiers"
          }`}
        >
          <strong>{count.toLocaleString()}</strong>
          <span>{percentage.toFixed(1)}% current</span>
        </Link>
        <button
          type="button"
          className={`rating-tier-projected${
            delta > 0 ? " increase" : delta < 0 ? " decrease" : ""
          }`}
          disabled={!projectedCount}
          onClick={() => {
            try {
              if (
                !openInsightEntityLink(
                  "performer",
                  `Vato Tiers · ${
                    vatoTiers.find((entry) => entry.key === tier)?.label ??
                    "All tiers"
                  } · Projected`,
                  projectedIds
                )
              )
                setDrilldownError("Your browser blocked the new Vatos tab.");
            } catch {
              setDrilldownError(
                "Unable to create the projected Vato drilldown."
              );
            }
          }}
        >
          <strong>{projectedCount.toLocaleString()}</strong>
          <span>
            {projectedPercentage.toFixed(1)}% projected
            {delta ? ` · ${delta > 0 ? "+" : ""}${delta}` : ""}
          </span>
        </button>
      </div>
    );
  }

  function renderHeading(key: VatoTierSort, label: string) {
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
    <section className="vato-tiers rating-tiers" aria-label="Vato Tiers">
      <div className="vato-tiers-heading">
        <div>
          <h2>Vato Tiers</h2>
          {!state.loading && !state.error && (
            <span role="status">
              {filtered.length.toLocaleString()} of{" "}
              {state.performers.length.toLocaleString()} vatos
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={state.loading}
          onClick={() => {
            onReload();
          }}
        >
          Reload vatos
        </Button>
      </div>
      <RatingTierThresholds
        entity="performer"
        draft={thresholds.draft}
        changed={thresholds.changed}
        onChange={thresholds.setDraft}
        onReset={thresholds.reset}
      />
      {drilldownError && <Alert variant="warning">{drilldownError}</Alert>}
      <div className="playground-panel vato-tiers-filters">
        {(["ethnicity", "country"] as const).map((key) => (
          <Form.Group key={key} controlId={`vato-tiers-${key}`}>
            <Form.Label>
              {key === "ethnicity" ? "Ethnicity" : "Country"}
            </Form.Label>
            <Select
              inputId={`vato-tiers-${key}`}
              className="react-select"
              classNamePrefix="react-select"
              isMulti
              isClearable
              closeMenuOnSelect={false}
              placeholder="Any"
              isDisabled={state.loading}
              options={options[key]}
              value={filters[key].map((value) => ({
                value,
                label: vatoTierDisplayValue(value, key),
              }))}
              onChange={(values) =>
                setFilters((previous) => ({
                  ...previous,
                  [key]: values.map(({ value }) => value),
                }))
              }
            />
          </Form.Group>
        ))}
        <Button
          size="sm"
          variant="link"
          disabled={!hasFilters}
          onClick={() => setFilters(emptyVatoTierFilters)}
        >
          Clear filters
        </Button>
      </div>
      {state.loading && (
        <div className="vato-tiers-empty" role="status">
          <Spinner animation="border" size="sm" /> Loading{" "}
          {state.tier ?? "vatos"}… · {state.loaded.toLocaleString()}
        </div>
      )}
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {!state.loading && !state.error && (
        <>
          <div className="vato-tiers-cards">
            {vatoTiers.map((tier) => (
              <div
                key={tier.key}
                className="vato-tiers-card"
                style={{ "--tier-color": tier.color } as React.CSSProperties}
                aria-label={`View ${totals[tier.key].toLocaleString()} ${
                  tier.label
                } vatos`}
              >
                <span className="vato-tiers-card-label">{tier.label}</span>
                {renderCount(totals[tier.key], filtered.length, tier.key)}
                <span className="vato-tiers-card-track" aria-hidden="true">
                  <span
                    style={{
                      width: `${
                        filtered.length
                          ? (projectedTotals[tier.key] / filtered.length) * 100
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
                  {(["ethnicity", "country"] as const).map((key) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={dimension === key ? "primary" : "secondary"}
                      aria-pressed={dimension === key}
                      onClick={() => setDimension(key)}
                    >
                      {key === "ethnicity" ? "Ethnicity" : "Country"}
                    </Button>
                  ))}
                </ButtonGroup>
              </div>
            </div>
            {rows.length ? (
              <div className="table-responsive">
                <table className="vato-tiers-table">
                  <caption className="sr-only">
                    Vato Tiers by {dimension}, with current and projected counts
                    and row percentages.
                  </caption>
                  <thead>
                    <tr>
                      {renderHeading(
                        "label",
                        dimension === "ethnicity" ? "Ethnicity" : "Country"
                      )}
                      {vatoTiers.map((tier) =>
                        renderHeading(tier.key, tier.label)
                      )}
                      {renderHeading("total", "Total")}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.label}>
                        <th scope="row">
                          <Link
                            className="vato-tiers-row-label"
                            to={vatoListUrl(undefined, row.values)}
                          >
                            {row.label}
                          </Link>
                          <div
                            className="vato-tiers-distribution"
                            aria-hidden="true"
                          >
                            {vatoTiers.map((tier) => (
                              <span
                                key={tier.key}
                                style={{
                                  background: tier.color,
                                  width: `${
                                    (row[tier.key] / row.total) * 100
                                  }%`,
                                }}
                              />
                            ))}
                          </div>
                        </th>
                        {vatoTiers.map((tier) => (
                          <td
                            key={tier.key}
                            style={
                              {
                                "--tier-color": tier.color,
                              } as React.CSSProperties
                            }
                          >
                            {renderCount(
                              row[tier.key],
                              row.total,
                              tier.key,
                              row.values
                            )}
                          </td>
                        ))}
                        <td>
                          {renderCount(
                            row.total,
                            row.total,
                            undefined,
                            row.values
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">Total</th>
                      {vatoTiers.map((tier) => (
                        <td key={tier.key}>
                          {renderCount(
                            totals[tier.key],
                            filtered.length,
                            tier.key
                          )}
                        </td>
                      ))}
                      <td>{renderCount(filtered.length, filtered.length)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="vato-tiers-empty">
                <h3>{hasFilters ? "No matching vatos" : "No vatos yet"}</h3>
                {hasFilters && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setFilters(emptyVatoTierFilters)}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export const PlaygroundVatoTiers: React.FC = () => {
  const { configuration } = useConfigurationContext();
  const { state, reload } = useVatoTiers();
  return (
    <VatoTiersView
      state={state}
      onReload={reload}
      ratingConfig={{
        thresholds: configuration.ui?.ratingCardThresholds,
        overrideTagIds: configuration.ui?.ratingCardOverrideTagIds,
        goatTagId: configuration.ui?.roleTagIds?.goatTagId,
      }}
    />
  );
};
