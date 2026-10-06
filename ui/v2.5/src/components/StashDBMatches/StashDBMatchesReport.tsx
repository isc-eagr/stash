import React, { useMemo } from "react";
import { Table } from "react-bootstrap";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import cx from "classnames";
import {
  StashDbMatchesReportQuery,
  useStashDbMatchesReportQuery,
} from "src/core/generated-graphql";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { objectTitle } from "src/core/files";
import TextUtils from "src/utils/text";
import {
  groupStashDBMatchesByStudioCustom,
  sortStashDBMatchesChangesCustom,
  stashDBMatchesDeltaCustom,
  stashDBMatchesDeltaLabelCustom,
  stashDBReportFingerprintsURLCustom,
} from "./stashDBMatchesReport_custom";
import { StashDBMatchesStudioGroup } from "./StashDBMatchesStudioGroup";
import "./StashDBMatchesReport.scss";

type ReportScene = NonNullable<
  StashDbMatchesReportQuery["stashDBMatchesReport"]
>["changes"][number]["scene"];

// CUSTOM: report of the latest StashDB Matches refresh task run.
const StashDBMatchesReport: React.FC = () => {
  const intl = useIntl();
  const { data, loading, error } = useStashDbMatchesReportQuery({
    fetchPolicy: "network-only",
  });
  const report = data?.stashDBMatchesReport;
  const changeGroups = useMemo(
    () =>
      groupStashDBMatchesByStudioCustom(
        sortStashDBMatchesChangesCustom(report?.changes ?? [])
      ),
    [report]
  );
  const unsubmittedGroups = useMemo(
    () => groupStashDBMatchesByStudioCustom(report?.unsubmitted ?? []),
    [report]
  );
  const title = `${intl.formatMessage({ id: "stashdb_matches" })} report`;

  function renderScene(scene: ReportScene) {
    return (
      <>
        <Link to={`/scenes/${scene.id}`}>{objectTitle(scene)}</Link>
        {scene.date && <div className="text-muted small">{scene.date}</div>}
      </>
    );
  }

  function renderBody() {
    if (loading) return <LoadingIndicator />;
    if (error) return <ErrorMessage error={error.message} />;
    if (!report) {
      return (
        <p className="text-muted">
          No refresh has run yet. Run it from Settings → Tasks.
        </p>
      );
    }

    const stats: [string, number][] = [
      ["Checked", report.checked],
      ["Changed", report.changed],
      ["Unchanged", report.unchanged],
      ["Not on StashDB", report.not_found],
      ["Failed", report.failed],
    ];
    const { endpoint } = report;

    return (
      <>
        <p className="text-muted">
          {TextUtils.formatDateTime(intl, report.finished_at)}
          {report.cancelled && (
            <span className="text-warning ml-2">
              Stopped early; not every scene was checked.
            </span>
          )}
        </p>
        <div className="stashdb-matches-report-stats">
          {stats.map(([label, value]) => (
            <div key={label} className="stashdb-matches-report-stat">
              <div className="stashdb-matches-report-stat-value">
                {intl.formatNumber(value)}
              </div>
              <div className="stashdb-matches-report-stat-label">{label}</div>
            </div>
          ))}
        </div>
        <h3>Changed counts</h3>
        {changeGroups.length === 0 ? (
          <p className="text-muted">No counts changed.</p>
        ) : (
          changeGroups.map((group) => (
            <StashDBMatchesStudioGroup
              key={group.id ?? "no-studio"}
              name={group.name}
              count={group.entries.length}
            >
              <Table striped size="sm" responsive>
                <thead>
                  <tr>
                    <th>{intl.formatMessage({ id: "scene" })}</th>
                    <th className="text-right">Before</th>
                    <th className="text-right">After</th>
                    <th className="text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {group.entries.map((change) => {
                    const delta = stashDBMatchesDeltaCustom(change);
                    return (
                      <tr key={change.scene.id}>
                        <td>{renderScene(change.scene)}</td>
                        <td className="text-right">{change.previous ?? "—"}</td>
                        <td className="text-right">{change.current}</td>
                        <td
                          className={cx("text-right", {
                            "text-success":
                              change.previous != null && delta > 0,
                            "text-danger": delta < 0,
                          })}
                        >
                          {stashDBMatchesDeltaLabelCustom(change)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </StashDBMatchesStudioGroup>
          ))
        )}
        <h3 className="mt-4">
          Not submitted by me
          {endpoint && ` (${intl.formatNumber(report.unsubmitted.length)})`}
        </h3>
        {!endpoint ? (
          <p className="text-muted">
            Run a refresh to check your PHASH submissions.
          </p>
        ) : (
          <>
            <p className="text-muted">
              No PHASH submitted by the account using your configured StashDB
              API key.
            </p>
            {unsubmittedGroups.length === 0 ? (
              <p className="text-muted">No unsubmitted scenes found.</p>
            ) : (
              unsubmittedGroups.map((group) => (
                <StashDBMatchesStudioGroup
                  key={group.id ?? "no-studio"}
                  name={group.name}
                  count={group.entries.length}
                >
                  <Table striped size="sm" responsive>
                    <thead>
                      <tr>
                        <th>{intl.formatMessage({ id: "scene" })}</th>
                        <th className="text-right">Matches</th>
                        <th>StashDB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.entries.map((entry) => (
                        <tr key={entry.scene.id}>
                          <td>{renderScene(entry.scene)}</td>
                          <td className="text-right">{entry.matches}</td>
                          <td>
                            <a
                              href={stashDBReportFingerprintsURLCustom(
                                endpoint,
                                entry.stash_id
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Fingerprints
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </StashDBMatchesStudioGroup>
              ))
            )}
          </>
        )}
      </>
    );
  }

  return (
    <div className="stashdb-matches-report">
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <h2>{title}</h2>
      {renderBody()}
    </div>
  );
};

export default StashDBMatchesReport;
