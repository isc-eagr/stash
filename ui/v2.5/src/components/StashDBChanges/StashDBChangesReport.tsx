import React, { useCallback, useMemo, useState } from "react";
import { Button, Form, ProgressBar, Tab, Tabs } from "react-bootstrap";
import { useIntl } from "react-intl";
import { Helmet } from "react-helmet";
import {
  StashDbChangesReportQuery,
  useCheckStashDbChangesMutation,
  useStashDbChangesReportQuery,
} from "src/core/generated-graphql";
import {
  useApplyStashDBPerformerChangesCustom,
  useApplyStashDBSceneChangesCustom,
  useConfigureUISetting,
} from "src/core/StashService";
import { useConfigurationContext } from "src/hooks/Config";
import { useToast } from "src/hooks/Toast";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { objectTitle } from "src/core/files";
import { useMonitorJob } from "src/utils/job";
import TextUtils from "src/utils/text";
import { groupStashDBMatchesByStudioCustom } from "../StashDBMatches/stashDBMatchesReport_custom";
import {
  StashDBChangesEntry,
  StashDBChangesGroup,
  StashDBChangesPagedList,
} from "./StashDBChangesEntry";
import {
  IStashDBFieldChangeCustom,
  StashDBChangesKindCustom,
  stashDBFieldCountsCustom,
  stashDBFieldsCustom,
  stashDBSkippedCustom,
  toggleStashDBFieldCustom,
  visibleStashDBChangesCustom,
} from "./stashDBChanges_custom";
import "./StashDBChangesReport.scss";

type Report = StashDbChangesReportQuery["stashDBChangesReport"];
type SceneEntry = Report["scenes"][number];
type PerformerEntry = Report["performers"][number];
type Run = NonNullable<Report["scene_run"]>;

const CONFIG_KEYS = {
  scene: "excludedSceneFields",
  performer: "excludedPerformerFields",
} as const;

interface IPanelProps {
  kind: StashDBChangesKindCustom;
  run?: Run | null;
  entries: readonly (SceneEntry | PerformerEntry)[];
  excluded: string[];
  onToggleField: (field: string) => void;
  onCheck: () => void;
  checking: boolean;
}

const StashDBChangesPanel: React.FC<IPanelProps> = ({
  kind,
  run,
  entries,
  excluded,
  onToggleField,
  onCheck,
  checking,
}) => {
  const intl = useIntl();
  const Toast = useToast();
  const [applyScene] = useApplyStashDBSceneChangesCustom();
  const [applyPerformer] = useApplyStashDBPerformerChangesCustom();
  const [applying, setApplying] = useState<string>();
  const fields = stashDBFieldsCustom(kind);
  const labels = useMemo(
    () => new Map(fields.map(([key, id]) => [key, intl.formatMessage({ id })])),
    [fields, intl]
  );
  const counts = useMemo(() => stashDBFieldCountsCustom(entries), [entries]);
  const { gone, changed } = useMemo(
    () => visibleStashDBChangesCustom(entries, excluded),
    [entries, excluded]
  );
  const plural = kind === "scene" ? "scenes" : "vatos";

  const entityID = (entry: SceneEntry | PerformerEntry) =>
    "scene" in entry ? entry.scene.id : entry.performer.id;
  const entryKey = (entry: SceneEntry | PerformerEntry) =>
    `${entityID(entry)}-${entry.stash_id}`;

  // The entry updates from the cache; only skips need a word.
  async function apply(entry: SceneEntry | PerformerEntry, applied: string[]) {
    setApplying(entryKey(entry));
    const input = {
      id: entityID(entry),
      stash_id: entry.stash_id,
      fields: applied,
    };
    try {
      let left: IStashDBFieldChangeCustom[] | undefined;
      if ("scene" in entry) {
        const { data } = await applyScene({ variables: { input } });
        left = data?.applyStashDBSceneChanges.fields;
      } else {
        const { data } = await applyPerformer({ variables: { input } });
        left = data?.applyStashDBPerformerChanges.fields;
      }
      const skipped = stashDBSkippedCustom(applied, left ?? []);
      if (skipped.length > 0) {
        Toast.toast({
          variant: "warning",
          content: `No local match, skipped: ${skipped.join(", ")}`,
        });
      } else {
        Toast.success("Listo, updated from StashDB.");
      }
    } catch (e) {
      Toast.error(e);
    } finally {
      setApplying(undefined);
    }
  }

  function renderEntry(entry: SceneEntry | PerformerEntry, endpoint: string) {
    const common = {
      kind,
      endpoint,
      status: entry.status,
      stashID: entry.stash_id,
      mergedIntoID: entry.merged_into_id,
      fields: entry.fields,
      labels,
      onApply: (applied: string[]) => apply(entry, applied),
      applying: applying === entryKey(entry),
    };
    if ("scene" in entry) {
      return (
        <StashDBChangesEntry
          key={entryKey(entry)}
          {...common}
          name={objectTitle(entry.scene)}
          subtitle={entry.scene.date}
          url={`/scenes/${entry.scene.id}`}
        />
      );
    }
    return (
      <StashDBChangesEntry
        key={entryKey(entry)}
        {...common}
        name={entry.performer.name}
        subtitle={entry.performer.disambiguation}
        url={`/performers/${entry.performer.id}`}
      />
    );
  }

  function renderChanged(endpoint: string) {
    if (changed.length === 0) {
      return <p className="text-muted">Todo igualito. Nothing changed.</p>;
    }
    if (kind === "performer") {
      return (
        <StashDBChangesPagedList
          items={changed}
          render={(e) => renderEntry(e, endpoint)}
        />
      );
    }
    return groupStashDBMatchesByStudioCustom(changed as SceneEntry[]).map(
      (group) => (
        <StashDBChangesGroup
          key={group.id ?? "no-studio"}
          name={group.name}
          count={group.entries.length}
        >
          {group.entries.map((e) => renderEntry(e, endpoint))}
        </StashDBChangesGroup>
      )
    );
  }

  function renderReport() {
    if (!run) {
      return (
        <p className="text-muted">
          No check yet. Hit Check to compare your {plural} with StashDB.
        </p>
      );
    }
    const stats: [string, number][] = [
      ["Checked", run.checked],
      ["Changed", changed.length],
      ["Gone from StashDB", gone.length],
      ["Failed", run.failed],
    ];
    return (
      <>
        <p className="text-muted">
          {TextUtils.formatDateTime(intl, run.finished_at)}
          {run.cancelled && (
            <span className="text-warning ml-2">
              Stopped early; not every {kind === "scene" ? "scene" : "vato"} was
              checked.
            </span>
          )}
        </p>
        <div className="stashdb-changes-stats">
          {stats.map(([label, value]) => (
            <div key={label} className="stashdb-changes-stat">
              <div className="stashdb-changes-stat-value">
                {intl.formatNumber(value)}
              </div>
              <div className="stashdb-changes-stat-label">{label}</div>
            </div>
          ))}
        </div>
        <div className="stashdb-changes-fields">
          <div className="stashdb-changes-fields-heading">Compare</div>
          {fields.map(([key]) => (
            <Form.Check
              inline
              key={key}
              id={`stashdb-changes-${kind}-${key}`}
              type="checkbox"
              checked={!excluded.includes(key)}
              onChange={() => onToggleField(key)}
              label={
                <>
                  {labels.get(key)}
                  {counts.get(key) ? (
                    <span className="text-muted ml-1">({counts.get(key)})</span>
                  ) : null}
                </>
              }
            />
          ))}
          <div className="text-muted small">Images aren&apos;t compared.</div>
        </div>
        {gone.length > 0 && (
          <>
            <h3>Gone from StashDB</h3>
            <StashDBChangesPagedList
              items={gone}
              render={(e) => renderEntry(e, run.endpoint)}
            />
          </>
        )}
        <h3>Changed</h3>
        {renderChanged(run.endpoint)}
      </>
    );
  }

  return (
    <>
      <div className="stashdb-changes-toolbar">
        <Button variant="secondary" onClick={onCheck} disabled={checking}>
          Check {plural}
        </Button>
      </div>
      {renderReport()}
    </>
  );
};

// CUSTOM: compares StashDB-linked scenes and vatos with StashDB.
const StashDBChangesReport: React.FC = () => {
  const intl = useIntl();
  const Toast = useToast();
  const { configuration } = useConfigurationContext();
  const [saveUISetting] = useConfigureUISetting();
  const [check] = useCheckStashDbChangesMutation();
  const { data, loading, error, refetch } = useStashDbChangesReportQuery({
    fetchPolicy: "network-only",
  });
  const [jobID, setJobID] = useState<string>();
  const onJobDone = useCallback(() => {
    setJobID(undefined);
    refetch();
  }, [refetch]);
  const { job } = useMonitorJob(jobID, onJobDone);

  const config = configuration?.ui.stashdbChanges;
  const title = intl.formatMessage({ id: "stashdb_changes" });
  const report = data?.stashDBChangesReport;

  function toggleField(kind: StashDBChangesKindCustom, field: string) {
    const key = CONFIG_KEYS[kind];
    saveUISetting({
      variables: {
        key: "stashdbChanges",
        value: {
          ...config,
          [key]: toggleStashDBFieldCustom(config?.[key] ?? [], field),
        },
      },
    });
  }

  async function onCheck(kind: StashDBChangesKindCustom) {
    try {
      const result = await check({
        variables: {
          input: { scenes: kind === "scene", performers: kind === "performer" },
        },
      });
      setJobID(result.data?.checkStashDBChanges);
    } catch (e) {
      Toast.error(e);
    }
  }

  function renderPanel(kind: StashDBChangesKindCustom) {
    return (
      <StashDBChangesPanel
        kind={kind}
        run={kind === "scene" ? report?.scene_run : report?.performer_run}
        entries={(kind === "scene" ? report?.scenes : report?.performers) ?? []}
        excluded={config?.[CONFIG_KEYS[kind]] ?? []}
        onToggleField={(field) => toggleField(kind, field)}
        onCheck={() => onCheck(kind)}
        checking={!!jobID}
      />
    );
  }

  function renderBody() {
    if (loading) return <LoadingIndicator />;
    if (error) return <ErrorMessage error={error.message} />;
    return (
      <Tabs id="stashdb-changes-tabs" defaultActiveKey="scene" mountOnEnter>
        <Tab eventKey="scene" title={intl.formatMessage({ id: "scenes" })}>
          {renderPanel("scene")}
        </Tab>
        <Tab
          eventKey="performer"
          title={intl.formatMessage({ id: "performers" })}
        >
          {renderPanel("performer")}
        </Tab>
      </Tabs>
    );
  }

  return (
    <div className="stashdb-changes-report">
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <h2>{title}</h2>
      {jobID && (
        <div className="stashdb-changes-progress">
          <span>Checking StashDB…</span>
          <ProgressBar
            now={(job?.progress ?? 0) * 100}
            label={`${Math.round((job?.progress ?? 0) * 100)}%`}
          />
        </div>
      )}
      {renderBody()}
    </div>
  );
};

export default StashDBChangesReport;
