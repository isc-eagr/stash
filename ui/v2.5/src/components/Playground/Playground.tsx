import React, { useMemo, useState } from "react";
import { Alert, Button, Form, ProgressBar, Tab, Tabs } from "react-bootstrap";
import { Helmet } from "react-helmet";
import { useConfigurationContext } from "src/hooks/Config";
import { useTitleProps } from "src/hooks/title";
import { StatsPage } from "../StatsPage_custom";
import { InsightStats } from "../InsightStats/InsightStats";
import type { SceneRatingModeCustom } from "../Shared/groupSceneRating_custom";
import { PlaygroundChart } from "./PlaygroundChart";
import {
  createPlaygroundRandom,
  samplePlaygroundPoints,
  playgroundScenesPerCoordinate,
  playgroundSceneLimit,
} from "./playgroundChart_custom";
import {
  emptyPlaygroundFilters,
  getPlaygroundPoints,
  matchesPlaygroundFilters,
  preparePlaygroundScene,
  type IPlaygroundFilters,
} from "./playgroundData_custom";
import { playgroundMetrics } from "./playgroundCatalog_custom";
import { PlaygroundSceneFilters } from "./PlaygroundSceneFilters";
import { PlaygroundSceneTiers } from "./PlaygroundSceneTiers";
import {
  usePlaygroundScenes,
  type IPlaygroundScenesState,
} from "./usePlaygroundScenes_custom";
import { PlaygroundVatoTiers } from "./PlaygroundVatoTiers";
import "./Playground.scss";
import "./VatoTiers.scss";

const PlaygroundSceneExplorer: React.FC<{
  state: IPlaygroundScenesState;
  onReload: () => void;
}> = ({ state, onReload }) => {
  const { configuration } = useConfigurationContext();
  const { scenes, loading, loaded, total, error, loadedAt } = state;
  const [mode, setMode] = useState<SceneRatingModeCustom>("default");
  const [xKey, setXKey] = useState("topAttractiveness");
  const [yKey, setYKey] = useState("chemistry");
  const [spreadPoints, setSpreadPoints] = useState(true);
  const [shuffleSeed, setShuffleSeed] = useState(() =>
    Math.floor(Math.random() * 4294967296)
  );
  const [splits, setSplits] = useState<Record<string, number | undefined>>({});
  const [filters, setFilters] = useState<IPlaygroundFilters>(
    emptyPlaygroundFilters
  );
  const metrics = useMemo(() => playgroundMetrics(mode), [mode]);
  const xMetric = metrics.find((metric) => metric.key === xKey) ?? metrics[0];
  const yMetric = metrics.find((metric) => metric.key === yKey) ?? metrics[1];
  const xSplit = splits[`x:${xMetric.key}`] ?? xMetric.max / 2;
  const ySplit = splits[`y:${yMetric.key}`] ?? yMetric.max / 2;
  const entries = useMemo(
    () =>
      scenes.map((scene) =>
        preparePlaygroundScene(scene, configuration.ui ?? {})
      ),
    [scenes, configuration.ui]
  );
  const modeEntries = useMemo(
    () => entries.filter((entry) => entry.mode === mode),
    [entries, mode]
  );
  const filtered = useMemo(
    () =>
      modeEntries.filter((entry) => matchesPlaygroundFilters(entry, filters)),
    [modeEntries, filters]
  );
  const points = useMemo(
    () => getPlaygroundPoints(filtered, xMetric, yMetric),
    [filtered, xMetric, yMetric]
  );
  const scenesPerCoordinate =
    spreadPoints && (xMetric.choices?.length || yMetric.choices?.length)
      ? playgroundScenesPerCoordinate
      : 1;
  const sampledPoints = useMemo(
    () =>
      samplePlaygroundPoints(
        points,
        createPlaygroundRandom(shuffleSeed),
        scenesPerCoordinate
      ),
    [points, shuffleSeed, scenesPerCoordinate]
  );
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
          title={`Refresh the 12-hour cache${
            loadedAt ? ` (loaded ${new Date(loadedAt).toLocaleString()})` : ""
          }.`}
          onClick={onReload}
        >
          Reload scenes
        </Button>
      </div>
      <div className="playground-panel playground-controls">
        <Form.Group controlId="playground-mode">
          <Form.Label>Rating mode</Form.Label>
          <Form.Control
            as="select"
            value={mode}
            onChange={(event) => {
              const nextMode = event.target.value as SceneRatingModeCustom;
              const nextMetrics = playgroundMetrics(nextMode);
              setMode(nextMode);
              if (!nextMetrics.some((metric) => metric.key === xKey))
                setXKey(nextMetrics[0].key);
              if (!nextMetrics.some((metric) => metric.key === yKey))
                setYKey(nextMetrics[1].key);
              setFilters((previous) => ({
                ...previous,
                present: [],
                absent: [],
              }));
              refreshPlot();
            }}
          >
            <option value="default">Standard</option>
            <option value="solo">Solo</option>
            <option value="group">Group (4+ vatos)</option>
          </Form.Control>
        </Form.Group>
        {(
          [
            { axis: "x", metric: xMetric, setKey: setXKey },
            { axis: "y", metric: yMetric, setKey: setYKey },
          ] as const
        ).map(({ axis, metric, setKey }) => (
          <Form.Group key={axis} controlId={`playground-${axis}`}>
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
      <PlaygroundSceneFilters
        idPrefix="playground"
        entries={modeEntries}
        mode={mode}
        filters={filters}
        config={configuration.ui ?? {}}
        disabled={loading}
        onChange={(nextFilters) => {
          setFilters(nextFilters);
          refreshPlot();
        }}
      />
      {loading && (
        <div className="playground-panel" role="status">
          <p>
            Loading scenes
            {total
              ? ` · ${loaded.toLocaleString()} / ${total.toLocaleString()}`
              : "…"}
          </p>
          <ProgressBar animated now={total ? (loaded / total) * 100 : 0} />
        </div>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      {!loading && !error && (
        <div className="playground-panel">
          <div className="playground-chart-header">
            <div>
              <h2>Scene comparison</h2>
              <div
                role="status"
                className="playground-count"
                title={`${filtered.length.toLocaleString()} matching scenes; ${(
                  filtered.length - points.length
                ).toLocaleString()} missing or invalid axis scores.`}
              >
                {sampledPoints.length.toLocaleString()} sampled ·{" "}
                {points.length.toLocaleString()} rated
              </div>
            </div>
            <div className="playground-splits">
              {(
                [
                  { axis: "x", metric: xMetric, value: xSplit },
                  { axis: "y", metric: yMetric, value: ySplit },
                ] as const
              ).map(({ axis, metric, value }) => (
                <Form.Group key={axis} controlId={`playground-${axis}-split`}>
                  <Form.Label>{axis.toUpperCase()} divide at</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    max={metric.max}
                    step={0.5}
                    value={value}
                    onChange={(event) => {
                      const raw = event.target.value;
                      setSplits((previous) => ({
                        ...previous,
                        [`${axis}:${metric.key}`]:
                          raw === ""
                            ? undefined
                            : Math.max(
                                0,
                                Math.min(metric.max, Number(raw) || 0)
                              ),
                      }));
                    }}
                  />
                </Form.Group>
              ))}
            </div>
          </div>
          {points.length ? (
            <>
              <div className="playground-filter-footer">
                <Form.Check
                  id="playground-spread-points"
                  type="switch"
                  label="Spread points"
                  checked={spreadPoints}
                  onChange={(event) => setSpreadPoints(event.target.checked)}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  title={`Up to ${scenesPerCoordinate} scenes per shared score, ${playgroundSceneLimit} total.`}
                  onClick={refreshPlot}
                >
                  Shuffle scenes
                </Button>
              </div>
              <PlaygroundChart
                points={sampledPoints}
                xMetric={xMetric}
                yMetric={yMetric}
                xSplit={xSplit}
                ySplit={ySplit}
                spreadPoints={spreadPoints}
              />
            </>
          ) : (
            <div className="playground-empty">
              {filtered.length
                ? "No scenes have both selected scores."
                : "No matching scenes."}
            </div>
          )}
        </div>
      )}
    </>
  );
};

const Playground: React.FC = () => {
  const titleProps = useTitleProps("Playground");
  const [sceneRevision, setSceneRevision] = useState(0);
  const sceneState = usePlaygroundScenes(sceneRevision);
  const reloadScenes = () => setSceneRevision((revision) => revision + 1);
  return (
    <StatsPage className="playground-page">
      <Helmet {...titleProps} />
      <div className="playground-content">
        <div className="playground-header">
          <h1>Playground</h1>
        </div>
        <Tabs
          id="playground-tabs"
          defaultActiveKey="scenes"
          className="playground-tabs"
          mountOnEnter
        >
          <Tab eventKey="scenes" title="Scene Explorer">
            <PlaygroundSceneExplorer
              state={sceneState}
              onReload={reloadScenes}
            />
          </Tab>
          <Tab eventKey="scene-tiers" title="Scene Tiers">
            <PlaygroundSceneTiers state={sceneState} onReload={reloadScenes} />
          </Tab>
          <Tab eventKey="vatos" title="Vato Tiers">
            <PlaygroundVatoTiers />
          </Tab>
          <Tab eventKey="insights" title="Insight Stats">
            <InsightStats />
          </Tab>
        </Tabs>
      </div>
    </StatsPage>
  );
};

export default Playground;
