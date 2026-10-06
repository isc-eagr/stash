import React, { useMemo } from "react";
import { Table } from "react-bootstrap";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import cx from "classnames";
import { useStashDbMatchesReportQuery } from "src/core/generated-graphql";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { ErrorMessage } from "src/components/Shared/ErrorMessage";
import { objectTitle } from "src/core/files";
import TextUtils from "src/utils/text";
import {
  sortStashDBMatchesChangesCustom,
  stashDBMatchesDeltaCustom,
  stashDBMatchesDeltaLabelCustom,
} from "./stashDBMatchesReport_custom";
import "./StashDBMatchesReport.scss";

// CUSTOM: report of the latest StashDB Matches refresh task run.
const StashDBMatchesReport: React.FC = () => {
  const intl = useIntl();
  const { data, loading, error } = useStashDbMatchesReportQuery({
    fetchPolicy: "network-only",
  });
  const report = data?.stashDBMatchesReport;
  const changes = useMemo(
    () => sortStashDBMatchesChangesCustom(report?.changes ?? []),
    [report]
  );
  const title = `${intl.formatMessage({ id: "stashdb_matches" })} report`;

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
        {changes.length === 0 ? (
          <p className="text-muted">No counts changed.</p>
        ) : (
          <Table striped size="sm" className="stashdb-matches-report-table">
            <thead>
              <tr>
                <th>{intl.formatMessage({ id: "scene" })}</th>
                <th className="text-right">Before</th>
                <th className="text-right">After</th>
                <th className="text-right">Change</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => {
                const delta = stashDBMatchesDeltaCustom(change);
                const details = [change.scene.studio?.name, change.scene.date]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <tr key={change.scene.id}>
                    <td>
                      <Link to={`/scenes/${change.scene.id}`}>
                        {objectTitle(change.scene)}
                      </Link>
                      {details && (
                        <div className="text-muted small">{details}</div>
                      )}
                    </td>
                    <td className="text-right">{change.previous ?? "—"}</td>
                    <td className="text-right">{change.current}</td>
                    <td
                      className={cx("text-right", {
                        "text-success": change.previous != null && delta > 0,
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
