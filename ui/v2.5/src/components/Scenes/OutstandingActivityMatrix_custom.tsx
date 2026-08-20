import React from "react";
import { Link } from "react-router-dom";
import { ModalComponent } from "src/components/Shared/Modal";
import TextUtils from "src/utils/text";
import type {
  IOutstandingActivityCell,
  IOutstandingActivityMatrix,
} from "./sceneCardInsightsData_custom";
import "./outstandingActivityMatrix_custom.scss";

interface ITableProps {
  matrix: IOutstandingActivityMatrix;
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

function ActivityCell({ cell }: { cell?: IOutstandingActivityCell }) {
  if (!cell) return <span className="outstanding-activity-empty">—</span>;

  return (
    <span className="outstanding-activity-cell-value">
      <strong>{TextUtils.secondsToTimestamp(cell.duration)}</strong>
      <small>{markerCountLabel(cell.markerCount)}</small>
    </span>
  );
}

export const OutstandingActivityMatrixTable: React.FC<ITableProps> = ({
  matrix,
  title = "Outstanding activity",
}) => {
  if (matrix.rows.length === 0) return null;

  return (
    <section className="outstanding-activity-matrix" aria-label={title}>
      <div className="outstanding-activity-heading">
        <h4>{title}</h4>
      </div>
      <div className="outstanding-activity-table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Activity tag</th>
              <th scope="col">Total</th>
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
            {matrix.rows.map((row, rowIndex) => (
              <tr
                className={
                  rowIndex === matrix.rows.length - 1
                    ? "outstanding-activity-final-row"
                    : undefined
                }
                key={row.tag.id}
              >
                <th scope="row">
                  <Link to={`/tags/${row.tag.id}`}>{row.tag.name}</Link>
                </th>
                <td>
                  <ActivityCell cell={row} />
                  <small className="outstanding-activity-percent">
                    {Math.round(row.percent)}% of scene
                  </small>
                </td>
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
