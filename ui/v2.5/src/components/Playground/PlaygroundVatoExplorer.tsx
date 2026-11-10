// CUSTOM: Playground > Vato Explorer.
import React, { useMemo, useState } from "react";
import { Alert, Button, Form, ProgressBar } from "react-bootstrap";
import { Link } from "react-router-dom";
import Select from "react-select";
import { getAppLocaleCustom } from "src/utils/appLocale_custom";
import { PlaygroundChart } from "./PlaygroundChart";
import {
  createPlaygroundRandom,
  samplePlaygroundPoints,
  playgroundScenesPerCoordinate,
  playgroundSceneLimit,
} from "./playgroundChart_custom";
import {
  playgroundAxisMaximum,
  playgroundAxisMinimum,
  playgroundDefaultSplit,
} from "./playgroundData_custom";
import { useVatoExplorer } from "./useVatoExplorer_custom";
import {
  filterExplorerVatos,
  getVatoExplorerPoints,
  vatoExplorerAge,
  vatoExplorerMetrics,
  type IVatoExplorerPoint,
} from "./vatoExplorerData_custom";
import {
  emptyVatoTierFilters,
  vatoTierDisplayValue,
  vatoTierFilterValue,
  vatoTierUnknownValue,
  type VatoTierDimension,
} from "./vatoTiersData_custom";

const VATO_NOUN: [string, string] = ["vato", "vatos"];
const metrics = vatoExplorerMetrics();

function count(value: number) {
  return value.toLocaleString(getAppLocaleCustom());
}

function renderVatoDetails({ vato }: IVatoExplorerPoint) {
  const age = vatoExplorerAge(vato);
  const facts = (["ethnicity", "country"] as const)
    .map((dimension) => vatoTierFilterValue(vato, dimension))
    .map((value, index) =>
      value === vatoTierUnknownValue
        ? undefined
        : vatoTierDisplayValue(value, index === 0 ? "ethnicity" : "country")
    );
  return (
    <>
      {vato.image_path && (
        <img
          className="playground-vato-portrait"
          src={vato.image_path}
          alt=""
        />
      )}
      <Link to={`/performers/${vato.id}`} className="playground-scene-title">
        {vato.name}
      </Link>
      <div className="text-muted">
        {[...facts, age !== undefined ? `${age} years` : undefined]
          .filter(Boolean)
          .join(" · ")}
      </div>
      <div className="text-muted">
        Overall rating {vato.rating100 ?? "Unrated"} · {count(vato.scene_count)}{" "}
        {vato.scene_count === 1 ? "scene" : "scenes"} ·{" "}
        {count(vato.o_counter ?? 0)} {vato.o_counter === 1 ? "O" : "O's"}
      </div>
    </>
  );
}

export const PlaygroundVatoExplorer: React.FC = () => {
  const { state, reload } = useVatoExplorer();
  const { vatos, loading, loaded, total, error } = state;
  const [xKey, setXKey] = useState("face");
  const [yKey, setYKey] = useState("body");
  const [spreadPoints, setSpreadPoints] = useState(true);
  const [shuffleSeed, setShuffleSeed] = useState(() =>
    Math.floor(Math.random() * 4294967296)
  );
  const [splits, setSplits] = useState<Record<string, number | undefined>>({});
  const [filters, setFilters] = useState(emptyVatoTierFilters);
  const xMetric = metrics.find((metric) => metric.key === xKey) ?? metrics[0];
  const yMetric = metrics.find((metric) => metric.key === yKey) ?? metrics[1];

  const options = useMemo(() => {
    const choices = (key: VatoTierDimension) =>
      [...new Set(vatos.map((vato) => vatoTierFilterValue(vato, key)))]
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: vatoTierDisplayValue(value, key) }));
    return { ethnicity: choices("ethnicity"), country: choices("country") };
  }, [vatos]);
  const filtered = useMemo(
    () => filterExplorerVatos(vatos, filters),
    [vatos, filters]
  );
  const points = useMemo(
    () => getVatoExplorerPoints(filtered, xMetric, yMetric),
    [filtered, xMetric, yMetric]
  );
  const xSplit =
    splits[`x:${xMetric.key}`] ?? playgroundDefaultSplit(points, "x", xMetric);
  const ySplit =
    splits[`y:${yMetric.key}`] ?? playgroundDefaultSplit(points, "y", yMetric);
  const perCoordinate =
    spreadPoints && (xMetric.choices?.length || yMetric.choices?.length)
      ? playgroundScenesPerCoordinate
      : 1;
  const sampledPoints = useMemo(
    () =>
      samplePlaygroundPoints(
        points,
        createPlaygroundRandom(shuffleSeed),
        perCoordinate
      ),
    [points, shuffleSeed, perCoordinate]
  );
  const hasFilters = !!(filters.ethnicity.length || filters.country.length);

  function refreshPlot() {
    setShuffleSeed(Math.floor(Math.random() * 4294967296));
  }

  return (
    <>
      <div className="playground-header">
        <Button
          variant="secondary"
          size="sm"
          disabled={loading}
          onClick={reload}
        >
          Reload vatos
        </Button>
      </div>
      <div className="playground-panel playground-controls playground-controls--axes">
        {(
          [
            { axis: "x", metric: xMetric, setKey: setXKey },
            { axis: "y", metric: yMetric, setKey: setYKey },
          ] as const
        ).map(({ axis, metric, setKey }) => (
          <Form.Group key={axis} controlId={`vato-explorer-${axis}`}>
            <Form.Label>{axis.toUpperCase()} axis</Form.Label>
            <Form.Control
              as="select"
              value={metric.key}
              onChange={(event) => setKey(event.target.value)}
            >
              {metrics.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </Form.Control>
          </Form.Group>
        ))}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setXKey(yMetric.key);
            setYKey(xMetric.key);
          }}
        >
          Swap axes
        </Button>
      </div>
      <div className="playground-panel vato-tiers-filters">
        {(["ethnicity", "country"] as const).map((key) => (
          <Form.Group key={key} controlId={`vato-explorer-${key}`}>
            <Form.Label>
              {key === "ethnicity" ? "Ethnicity" : "Country"}
            </Form.Label>
            <Select
              inputId={`vato-explorer-${key}`}
              className="react-select"
              classNamePrefix="react-select"
              isMulti
              isClearable
              closeMenuOnSelect={false}
              placeholder="Any"
              isDisabled={loading}
              options={options[key]}
              value={filters[key].map((value) => ({
                value,
                label: vatoTierDisplayValue(value, key),
              }))}
              onChange={(values) => {
                setFilters((previous) => ({
                  ...previous,
                  [key]: values.map(({ value }) => value),
                }));
                refreshPlot();
              }}
            />
          </Form.Group>
        ))}
        <Button
          size="sm"
          variant="link"
          disabled={!hasFilters}
          onClick={() => {
            setFilters(emptyVatoTierFilters);
            refreshPlot();
          }}
        >
          Clear filters
        </Button>
      </div>
      {loading && (
        <div className="playground-panel" role="status">
          <p>
            Loading vatos
            {total ? ` · ${count(loaded)} / ${count(total)}` : "…"}
          </p>
          <ProgressBar animated now={total ? (loaded / total) * 100 : 0} />
        </div>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      {!loading && !error && (
        <div className="playground-panel">
          <div className="playground-chart-header">
            <div>
              <h2>Vato comparison</h2>
              <div
                role="status"
                className="playground-count"
                title={`${count(filtered.length)} matching vatos; ${count(
                  filtered.length - points.length
                )} missing one of the two values.`}
              >
                {count(sampledPoints.length)} sampled · {count(points.length)}{" "}
                with both values
              </div>
            </div>
            <div className="playground-splits">
              {(
                [
                  { axis: "x", metric: xMetric, value: xSplit },
                  { axis: "y", metric: yMetric, value: ySplit },
                ] as const
              ).map(({ axis, metric, value }) => {
                const max = playgroundAxisMaximum(points, axis, metric);
                const min = playgroundAxisMinimum(points, axis, metric);
                return (
                  <Form.Group
                    key={axis}
                    controlId={`vato-explorer-${axis}-split`}
                  >
                    <Form.Label>{axis.toUpperCase()} divide at</Form.Label>
                    <Form.Control
                      type="number"
                      min={min}
                      max={max}
                      step={0.5}
                      value={value}
                      onChange={(event) => {
                        const raw = event.target.value;
                        setSplits((previous) => ({
                          ...previous,
                          [`${axis}:${metric.key}`]:
                            raw === ""
                              ? undefined
                              : Math.max(min, Math.min(max, Number(raw) || 0)),
                        }));
                      }}
                    />
                  </Form.Group>
                );
              })}
            </div>
          </div>
          {points.length ? (
            <>
              <div className="playground-filter-footer">
                <Form.Check
                  id="vato-explorer-spread-points"
                  type="switch"
                  label="Spread points"
                  checked={spreadPoints}
                  onChange={(event) => setSpreadPoints(event.target.checked)}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  title={`Up to ${perCoordinate} vatos per shared score, ${playgroundSceneLimit} total.`}
                  onClick={refreshPlot}
                >
                  Shuffle vatos
                </Button>
              </div>
              <PlaygroundChart
                points={sampledPoints}
                xMetric={xMetric}
                yMetric={yMetric}
                xSplit={xSplit}
                ySplit={ySplit}
                spreadPoints={spreadPoints}
                noun={VATO_NOUN}
                renderDetails={renderVatoDetails}
              />
            </>
          ) : (
            <div className="playground-empty">
              {filtered.length
                ? "No vatos have both selected values."
                : "No matching vatos."}
            </div>
          )}
        </div>
      )}
    </>
  );
};
