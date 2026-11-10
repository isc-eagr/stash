import { getAppLocaleCustom } from "src/utils/appLocale_custom"; // CUSTOM
import React, { useMemo, useState } from "react";
import { Alert, Form } from "react-bootstrap";
import { Link, useHistory, useLocation } from "react-router-dom";
import cx from "classnames";
import {
  StatsChartGroup,
  StatsKpiRow,
  type IStatsKpi,
} from "src/components/StatsCharts_custom";
import {
  useStashDbMatchesPerformerNamesQuery,
  useStashDbMatchesStudioNamesQuery,
} from "src/core/generated-graphql";
import { formatStatsTotal } from "src/utils/statsDrilldown_custom";
import type { SceneStatsScene } from "./sceneStatsCompactData_custom";
import {
  buildStashDBMatchesTableCustom,
  STASHDB_MATCHES_FEW_SCENES_CUSTOM,
  STASHDB_MATCHES_TABLE_TITLES_CUSTOM,
  STASHDB_MATCHES_VATO_MIN_SCENES_CUSTOM,
  stashDBMatchesAverageCustom,
  stashDBMatchesLabelRowsCustom,
  stashDBMatchesRatingGapsCustom,
  stashDBMatchesRowScenesURLCustom,
  stashDBMatchesSceneGroupsCustom,
  stashDBMatchesScenesCustom,
  type IStashDBMatchesGapSceneCustom,
  type IStashDBMatchesRowCustom,
  type StashDBMatchesDimensionCustom,
  type StashDBMatchesGroupsCustom,
  type StashDBMatchesPageDimensionCustom,
} from "./sceneStatsStashDBMatchesData_custom";
import {
  sceneStatsFlagFromSearch,
  sceneStatsSearchForFlag,
} from "./sceneStatsSection_custom";

const FEW_SCENES = STASHDB_MATCHES_FEW_SCENES_CUSTOM;
const COLLAPSED_ROWS = 12;

// Rows open in a new tab so the stats stay put.
function openInNewTab(url: string) {
  // A "noopener" feature makes window.open return null even when the tab
  // opens, so detect blocking from the handle and detach the opener after.
  const tab = window.open(url, "_blank");
  if (!tab) return false;
  tab.opener = null;
  return true;
}

const TABLE_ORDER: StashDBMatchesDimensionCustom[] = [
  "performer_count",
  "scene_type",
  "rating",
  "metallic_rating",
  "vato_rating",
  "best_facial",
  "best_nut",
  "release_year",
  "ethnicity",
  "country",
  "vato",
  "studio",
];

function formatAverage(value?: number) {
  return value === undefined
    ? "—"
    : value.toLocaleString(getAppLocaleCustom(), { maximumFractionDigits: 1 });
}

const MatchesTable: React.FC<{
  title: string;
  rows: IStashDBMatchesRowCustom[];
  note?: string;
}> = ({ title, rows, note }) => {
  const [expanded, setExpanded] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const max = Math.max(0, ...rows.map((row) => row.average));
  const visible = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);

  function openRow(row: IStashDBMatchesRowCustom) {
    try {
      setOpenFailed(
        !openInNewTab(stashDBMatchesRowScenesURLCustom(title, row))
      );
    } catch {
      // The drilldown needs browser storage for its scene snapshot.
      setOpenFailed(true);
    }
  }

  return (
    <section className="stats-bar-chart scenestats-matches-table">
      <header className="stats-bar-chart-heading">
        <div className="stats-bar-chart-title">
          <h3>{title}</h3>
          {note && <span className="stats-bar-chart-total">{note}</span>}
        </div>
      </header>
      {rows.length === 0 ? (
        <div className="stats-bar-chart-empty">Nothing yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Group</th>
              <th scope="col">Scenes</th>
              <th scope="col">Avg Matches</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                className={cx({ few: row.sceneCount < FEW_SCENES })}
                key={row.key}
                onClick={() => openRow(row)}
                title={`${
                  row.sceneCount < FEW_SCENES ? "Few scenes. " : ""
                }Open these scenes`}
              >
                <th scope="row">
                  {/* The row is clickable; the button keeps it keyboard-reachable. */}
                  <button
                    className="scenestats-matches-link"
                    onClick={(event) => {
                      event.stopPropagation();
                      openRow(row);
                    }}
                    type="button"
                  >
                    {row.label}
                  </button>
                </th>
                <td>{row.sceneCount.toLocaleString(getAppLocaleCustom())}</td>
                <td>
                  <div className="scenestats-matches-cell">
                    <span className="scenestats-matches-bar">
                      <span
                        className={cx("stats-bar-chart-fill", {
                          peak: row.average === max && max > 0,
                        })}
                        style={{
                          width: `${max > 0 ? (row.average / max) * 100 : 0}%`,
                        }}
                      />
                    </span>
                    <span className="scenestats-matches-value">
                      {formatAverage(row.average)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {openFailed && (
        <div className="stats-bar-chart-total">
          Couldn&apos;t open these scenes. Allow pop-ups and browser storage.
        </div>
      )}
      {rows.length > COLLAPSED_ROWS && (
        <div className="stats-bar-chart-more">
          <button
            className="stats-chip"
            onClick={() => setExpanded((value) => !value)}
            type="button"
          >
            {expanded
              ? "Show less"
              : `Show all ${rows.length.toLocaleString(getAppLocaleCustom())}`}
          </button>
        </div>
      )}
    </section>
  );
};

// Scenes where your rating and the community's matches disagree most.
const GapList: React.FC<{
  title: string;
  note: string;
  scenes: IStashDBMatchesGapSceneCustom[];
}> = ({ title, note, scenes }) => {
  return (
    <section className="stats-bar-chart scenestats-matches-table scenestats-matches-table--scenes">
      <header className="stats-bar-chart-heading">
        <div className="stats-bar-chart-title">
          <h3>{title}</h3>
          <span className="stats-bar-chart-total">{note}</span>
        </div>
      </header>
      {scenes.length === 0 ? (
        <div className="stats-bar-chart-empty">Nothing yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Scene</th>
              <th scope="col">Rating</th>
              <th scope="col">Matches</th>
            </tr>
          </thead>
          <tbody>
            {scenes.map((scene) => (
              <tr
                key={scene.id}
                onClick={() => openInNewTab(`/scenes/${scene.id}`)}
              >
                <th scope="row">
                  <Link
                    className="scenestats-matches-link"
                    onClick={(event) => event.stopPropagation()}
                    rel="noopener noreferrer"
                    target="_blank"
                    to={`/scenes/${scene.id}`}
                  >
                    {scene.title}
                  </Link>
                </th>
                <td>{scene.rating}</td>
                <td>{scene.matches.toLocaleString(getAppLocaleCustom())}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

// CUSTOM: Scene Stats > StashDB Matches. Follows the page's filters, date
// range, and studio scope, like the Overview charts.
export const SceneStatsStashDBMatches: React.FC<{
  scenes: readonly SceneStatsScene[];
  pageGroups: Record<
    StashDBMatchesPageDimensionCustom,
    StashDBMatchesGroupsCustom
  >;
}> = ({ scenes, pageGroups }) => {
  const history = useHistory();
  const location = useLocation();
  const hideFew = sceneStatsFlagFromSearch(location.search, "hideFew");
  const counted = useMemo(() => stashDBMatchesScenesCustom(scenes), [scenes]);
  const tables = useMemo(() => {
    const groupers: Record<
      StashDBMatchesDimensionCustom,
      StashDBMatchesGroupsCustom
    > = { ...stashDBMatchesSceneGroupsCustom, ...pageGroups };
    return TABLE_ORDER.map((dimension) => {
      const rows = buildStashDBMatchesTableCustom(counted, groupers[dimension]);
      return {
        dimension,
        rows:
          dimension === "vato"
            ? rows.filter(
                (row) =>
                  row.sceneCount >= STASHDB_MATCHES_VATO_MIN_SCENES_CUSTOM
              )
            : rows,
      };
    });
  }, [counted, pageGroups]);
  const gaps = useMemo(
    () => stashDBMatchesRatingGapsCustom(counted),
    [counted]
  );

  // By Vato and By Studio group by ID; names load for their rows.
  const idsFor = (dimension: StashDBMatchesDimensionCustom) =>
    tables
      .find((table) => table.dimension === dimension)
      ?.rows.map((row) => row.key) ?? [];
  const performerIDs = idsFor("vato");
  const studioIDs = idsFor("studio");
  const performerNames = useStashDbMatchesPerformerNamesQuery({
    skip: performerIDs.length === 0,
    variables: { ids: performerIDs },
  });
  const studioNames = useStashDbMatchesStudioNamesQuery({
    skip: studioIDs.length === 0,
    variables: { ids: studioIDs },
  });
  const names = useMemo(
    () => ({
      vato: new Map(
        (performerNames.data?.findPerformers.performers ?? []).map((p) => [
          p.id,
          p.name,
        ])
      ),
      studio: new Map(
        (studioNames.data?.findStudios.studios ?? []).map((s) => [s.id, s.name])
      ),
    }),
    [performerNames.data, studioNames.data]
  );

  const organized = scenes.filter((scene) => scene.organized).length;
  const kpis: IStatsKpi[] = [
    {
      key: "average",
      label: "Avg StashDB Matches",
      value: formatAverage(stashDBMatchesAverageCustom(counted)),
      detail: formatStatsTotal(counted.length, "scene", "scenes"),
    },
    {
      key: "missing",
      label: "No Count Yet",
      value: (organized - counted.length).toLocaleString(getAppLocaleCustom()),
      detail: "organized scenes",
    },
  ];

  if (counted.length === 0) {
    return (
      <Alert variant="secondary">
        No organized scenes with StashDB Matches yet. Run Settings → Tasks →
        StashDB Matches → Refresh.
      </Alert>
    );
  }

  return (
    <>
      <StatsKpiRow items={kpis} label="StashDB Matches" />
      <Form.Check
        checked={hideFew}
        className="mt-3"
        id="scene-stats-stashdb-matches-hide-few"
        label={`Hide groups under ${FEW_SCENES} scenes`}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          history.replace({
            ...location,
            search: sceneStatsSearchForFlag(
              location.search,
              "hideFew",
              event.target.checked
            ),
          })
        }
        type="switch"
      />
      <StatsChartGroup
        description="Organized scenes with a count. Multi-vato scenes count toward each vato's group."
        title="Avg StashDB Matches"
      >
        {tables.map(({ dimension, rows }) => (
          <MatchesTable
            key={dimension}
            note={
              dimension === "vato"
                ? `${STASHDB_MATCHES_VATO_MIN_SCENES_CUSTOM}+ scenes`
                : undefined
            }
            rows={stashDBMatchesLabelRowsCustom(
              dimension,
              hideFew
                ? rows.filter((row) => row.sceneCount >= FEW_SCENES)
                : rows,
              names
            )}
            title={STASHDB_MATCHES_TABLE_TITLES_CUSTOM[dimension]}
          />
        ))}
      </StatsChartGroup>
      <StatsChartGroup
        description="Rated scenes, comparing your rating and their matches as percentiles."
        title="Your Rating vs Community"
      >
        <GapList
          note="You rate them way above their matches"
          scenes={gaps.underrated}
          title="Underrated Gems"
        />
        <GapList
          note="Matched way more than you rate them"
          scenes={gaps.overhyped}
          title="Overhyped"
        />
      </StatsChartGroup>
    </>
  );
};
