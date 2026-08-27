import {
  faChevronDown,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import React from "react";
import { Link } from "react-router-dom";
import { Icon } from "src/components/Shared/Icon";
import { ModalComponent } from "src/components/Shared/Modal";
import TextUtils from "src/utils/text";
import type {
  IOutstandingActivityCell,
  IOutstandingActivityMeasure,
  IOutstandingActivityMatrix,
  SceneCardInsightTag,
} from "./sceneCardInsightsData_custom";
import { shouldShowOutstandingActivityTotalColumn } from "./sceneCardInsightsData_custom";
import "./outstandingActivityMatrix_custom.scss";

interface ITableProps {
  expandedTagIds?: ReadonlySet<string>;
  matrix: IOutstandingActivityMatrix;
  onToggleTag?: (tagID: string) => void;
  percentLabel?: string;
  showPercent?: boolean;
  tagHref?: (tag: SceneCardInsightTag) => string;
  treeRows?: Array<{
    depth: number;
    hasChildren: boolean;
    row: IOutstandingActivityMatrix["rows"][number];
  }>;
  title?: string;
}

interface IModalProps {
  matrix: IOutstandingActivityMatrix;
  onHide: () => void;
  show: boolean;
}

function markerCountLabel(markerCount: number) {
  return `${markerCount} ${markerCount === 1 ? "marker" : "markers"}`;
}

function ActivityMeasure({
  label,
  measure,
  tone,
}: {
  label?: string;
  measure: IOutstandingActivityMeasure;
  tone?: "goat";
}) {
  return (
    <span
      className={`outstanding-activity-cell-value${
        tone ? ` outstanding-activity-cell-value-${tone}` : ""
      }`}
    >
      <strong>
        {label && (
          <span className="outstanding-activity-cell-label">{label}</span>
        )}
        {TextUtils.secondsToTimestamp(measure.duration)}
      </strong>
      <small>{markerCountLabel(measure.markerCount)}</small>
    </span>
  );
}

function ActivityCell({ cell }: { cell?: IOutstandingActivityCell }) {
  if (!cell) return <span className="outstanding-activity-empty">—</span>;

  if (cell.outstanding || cell.goat) {
    return (
      <span className="outstanding-activity-cell-breakdown">
        {cell.outstanding && (
          <ActivityMeasure label="Outstanding" measure={cell.outstanding} />
        )}
        {cell.goat && (
          <ActivityMeasure label="GOAT" measure={cell.goat} tone="goat" />
        )}
      </span>
    );
  }

  return <ActivityMeasure measure={cell} />;
}

export const OutstandingActivityMatrixTable: React.FC<ITableProps> = ({
  expandedTagIds,
  matrix,
  onToggleTag,
  percentLabel = "of scene",
  showPercent = true,
  tagHref = (tag) => `/tags/${tag.id}`,
  treeRows,
  title = "Outstanding activity",
}) => {
  if (matrix.rows.length === 0) return null;
  const showTotalColumn = shouldShowOutstandingActivityTotalColumn(matrix);
  const displayRows =
    treeRows ??
    matrix.rows.map((row) => ({ depth: 0, hasChildren: false, row }));

  return (
    <section
      className={`outstanding-activity-matrix${
        matrix.columns.length === 0 ? " outstanding-activity-total-only" : ""
      }`}
      aria-label={title}
    >
      <div className="outstanding-activity-heading">
        <h4>{title}</h4>
      </div>
      <div className="outstanding-activity-table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Activity tag</th>
              {showTotalColumn && <th scope="col">Total</th>}
              {matrix.columns.map((column) => (
                <th key={column.id} scope="col">
                  {column.sceneWide ? (
                    column.name
                  ) : (
                    <Link
                      className="outstanding-activity-performer"
                      to={`/performers/${column.id}`}
                    >
                      <span
                        aria-hidden="true"
                        className="outstanding-activity-performer-image"
                        style={{
                          backgroundImage: column.imagePath
                            ? `url(${column.imagePath})`
                            : undefined,
                        }}
                      />
                      <span>{column.name}</span>
                    </Link>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map(({ depth, hasChildren, row }, rowIndex) => (
              <tr
                className={
                  rowIndex === displayRows.length - 1
                    ? "outstanding-activity-final-row"
                    : undefined
                }
                key={row.tag.id}
              >
                <th scope="row">
                  <div
                    className="outstanding-activity-tag-tree-label"
                    style={{ paddingLeft: `${depth * 1.15}rem` }}
                  >
                    {treeRows &&
                      (hasChildren ? (
                        <button
                          aria-expanded={expandedTagIds?.has(row.tag.id)}
                          aria-label={`${
                            expandedTagIds?.has(row.tag.id)
                              ? "Collapse"
                              : "Expand"
                          } ${row.tag.name} sub-tags`}
                          className="outstanding-activity-tree-toggle"
                          onClick={() => onToggleTag?.(row.tag.id)}
                          type="button"
                        >
                          <Icon
                            icon={
                              expandedTagIds?.has(row.tag.id)
                                ? faChevronDown
                                : faChevronRight
                            }
                          />
                        </button>
                      ) : (
                        <span className="outstanding-activity-tree-spacer" />
                      ))}
                    <Link
                      className="outstanding-activity-tag-link"
                      title={`Open ${row.tag.name}`}
                      to={tagHref(row.tag)}
                    >
                      {row.tag.name}
                    </Link>
                  </div>
                </th>
                {showTotalColumn && (
                  <td>
                    <ActivityCell cell={row} />
                    {showPercent && (
                      <small className="outstanding-activity-percent">
                        {Math.round(row.percent)}% {percentLabel}
                      </small>
                    )}
                  </td>
                )}
                {matrix.columns.map((column) => (
                  <td key={column.id}>
                    <ActivityCell cell={row.cells[column.id]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export const OutstandingActivityMatrixModal: React.FC<IModalProps> = ({
  matrix,
  onHide,
  show,
}) => (
  <ModalComponent
    accept={{ onClick: onHide, text: "Close" }}
    closeButton
    dialogClassName="outstanding-activity-dialog"
    header="Outstanding activity"
    modalProps={{ keyboard: true, size: "xl" }}
    onHide={onHide}
    show={show}
  >
    <OutstandingActivityMatrixTable matrix={matrix} title="Activity matrix" />
  </ModalComponent>
);
