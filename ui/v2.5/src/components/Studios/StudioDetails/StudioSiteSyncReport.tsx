// CUSTOM: Report of the latest studio site sync run.
import React from "react";
import { Alert, Badge, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import { faListCheck } from "@fortawesome/free-solid-svg-icons";
import { ModalComponent } from "src/components/Shared/Modal";
import {
  SiteSyncReportCustom,
  SiteSyncSceneChangeCustom,
  siteSyncChangeLabelsCustom,
  siteSyncSummaryCustom,
  splitSiteSyncScenesCustom,
} from "./studioSiteSync_custom";

const SceneCell: React.FC<{ scene: SiteSyncSceneChangeCustom }> = ({
  scene,
}) => (
  <td>
    <Link to={`/scenes/${scene.scene_id}`}>
      {scene.title || scene.basename}
    </Link>
    {scene.title && <div className="text-muted small">{scene.basename}</div>}
  </td>
);

interface IStudioSiteSyncReportProps {
  report: SiteSyncReportCustom;
  show: boolean;
  onHide: () => void;
}

export const StudioSiteSyncReport: React.FC<IStudioSiteSyncReportProps> = ({
  report,
  show,
  onHide,
}) => {
  const { changed, issues } = splitSiteSyncScenesCustom(report.scenes);

  return (
    <ModalComponent
      show={show}
      onHide={onHide}
      closeButton
      icon={faListCheck}
      header={`${report.site} sync report`}
      accept={{ onClick: onHide }}
      dialogClassName="modal-dialog-scrollable modal-lg"
    >
      {report.error && <Alert variant="danger">{report.error}</Alert>}
      {report.cancelled && (
        <Alert variant="warning">Stopped before it finished.</Alert>
      )}
      {report.warnings.map((warning) => (
        <Alert key={warning} variant="warning">
          {warning}
        </Alert>
      ))}
      <p className="text-muted">{siteSyncSummaryCustom(report).join(" · ")}</p>

      {changed.length === 0 && issues.length === 0 && (
        <p>Nothing new. Everything is up to date.</p>
      )}

      {changed.length > 0 && (
        <>
          <h6>Changed</h6>
          <Table size="sm" striped>
            <tbody>
              {changed.map((scene) => (
                <tr key={scene.scene_id}>
                  <SceneCell scene={scene} />
                  <td className="text-nowrap">{scene.code}</td>
                  <td>
                    {siteSyncChangeLabelsCustom(scene).map((label) =>
                      label === "Gallery" ? (
                        <Link
                          key={label}
                          to={`/galleries/${scene.gallery_id}`}
                          className="mr-1"
                        >
                          <Badge variant="info">{label}</Badge>
                        </Link>
                      ) : (
                        <Badge key={label} variant="secondary" className="mr-1">
                          {label}
                        </Badge>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}

      {issues.length > 0 && (
        <>
          <h6>Needs a look</h6>
          <Table size="sm" striped>
            <tbody>
              {issues.map((scene) => (
                <tr key={scene.scene_id}>
                  <SceneCell scene={scene} />
                  <td>
                    {scene.issues.map((issue) => (
                      <div key={issue}>{issue}</div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </ModalComponent>
  );
};
