import React from "react";
import { Link } from "react-router-dom";
import type { Tracker } from "./progressView_custom";
import { useProgressText } from "./progressView_custom";

export const TaskProgressProject: React.FC<{
  tracker: Pick<Tracker, "tag_id" | "tag_name">;
}> = ({ tracker }) => {
  const t = useProgressText();
  const content = (
    <>
      <small>{t("Project")}</small>
      <strong>{tracker.tag_name}</strong>
    </>
  );
  return tracker.tag_id !== "0" ? (
    <Link
      className="progress-tracker-modal-context-field"
      to={`/tags/${tracker.tag_id}`}
    >
      {content}
    </Link>
  ) : (
    <span className="progress-tracker-modal-context-field">
      {content}
      <small>{t("Deleted tag")}</small>
    </span>
  );
};
