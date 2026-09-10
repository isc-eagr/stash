import React from "react";
import * as GQL from "src/core/generated-graphql";
import { getSceneSaveChanges } from "./sceneSavePreview_custom";
import type {
  ISceneSaveChange,
  SceneSaveField,
} from "./sceneSavePreview_custom";

interface IProps {
  local: GQL.SlimSceneDataFragment;
  input: GQL.SceneUpdateInput;
  remote: GQL.ScrapedScene;
  excluded: Record<string, boolean>;
  onClearField: (field: SceneSaveField, clear: boolean) => void;
  cover?: string | null;
  unresolved: number;
}

export const SceneSavePreview: React.FC<IProps> = ({
  local,
  input,
  remote,
  excluded,
  onClearField,
  cover,
  unresolved,
}) => {
  const changes = getSceneSaveChanges(local, input, remote);
  const performerIDs = input.performer_ids ?? [];
  const tagIDs = input.tag_ids ?? [];
  const studioIDs = input.studio_id ? [input.studio_id] : [];
  const performers = GQL.useFindPerformersForSelectQuery({
    variables: { ids: performerIDs, filter: { per_page: -1 } },
    skip: !performerIDs.length,
  });
  const tags = GQL.useFindTagsForSelectQuery({
    variables: { ids: tagIDs, filter: { per_page: -1 } },
    skip: !tagIDs.length,
  });
  const studios = GQL.useFindStudiosForSelectQuery({
    variables: { ids: studioIDs },
    skip: !studioIDs.length,
  });
  const names: Record<string, Map<string, string>> = {
    performers: new Map(
      [
        ...local.performers,
        ...(performers.data?.findPerformers.performers ?? []),
      ].map((p) => [p.id, p.name])
    ),
    tags: new Map(
      [...local.tags, ...(tags.data?.findTags.tags ?? [])].map((t) => [
        t.id,
        t.name,
      ])
    ),
    studio: new Map(
      [
        ...(local.studio ? [local.studio] : []),
        ...(studios.data?.findStudios.studios ?? []),
      ].map((s) => [s.id, s.name])
    ),
  };
  const changed = changes.filter((c) => c.status !== "Unchanged");
  const keptCount = changed.filter((c) => c.status === "Kept locally").length;
  const changeCount = changed.length - keptCount;
  const unchanged = changes.filter((c) => c.status === "Unchanged");

  function renderValue(change: ISceneSaveChange, side: "before" | "after") {
    const values = change[side];
    const other = change[side === "before" ? "after" : "before"];
    if (!values.length) return <span className="tagger-empty">Empty</span>;
    return values.map((v) => (
      <div
        key={v}
        className={other.includes(v) ? undefined : `tagger-value-${side}`}
      >
        {names[change.key]?.get(v) ?? (names[change.key] ? `ID ${v}` : v)}
      </div>
    ));
  }

  function renderRows(rows: ISceneSaveChange[]) {
    return (
      <div className="tagger-diff-scroll">
        <table className="tagger-diff-table">
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Local now</th>
              <th scope="col">After Save</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.key}>
                <th scope="row">
                  {c.label}
                  <span
                    className={`tagger-change-status tagger-status-${c.status
                      .toLowerCase()
                      .replace(/ /g, "-")}`}
                  >
                    {c.status}
                  </span>
                  {c.remoteMissingField && (
                    <span className="tagger-change-status">Remote empty</span>
                  )}
                </th>
                <td>{renderValue(c, "before")}</td>
                <td>
                  {renderValue(c, "after")}
                  {c.remoteMissingField && (
                    <label className="tagger-clear-field">
                      <input
                        type="checkbox"
                        checked={c.status === "Removed"}
                        disabled={!!excluded[c.remoteMissingField]}
                        aria-label={`Clear ${c.label} on Save`}
                        onChange={(event) =>
                          onClearField(
                            c.remoteMissingField!,
                            event.currentTarget.checked
                          )
                        }
                      />
                      {excluded[c.remoteMissingField]
                        ? "Field excluded"
                        : "Clear on Save"}
                    </label>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section className="tagger-save-preview" aria-label="Changes on Save">
      <div className="tagger-preview-heading">
        <strong>Changes on Save</strong>
        <span role="status">
          {changeCount} {changeCount === 1 ? "change" : "changes"}
          {keptCount ? ` · ${keptCount} kept locally` : ""}
          {cover ? " + cover" : ""}
        </span>
      </div>
      {unresolved > 0 && (
        <p className="tagger-preview-help">
          {unresolved} unmatched {unresolved === 1 ? "performer" : "performers"}{" "}
          omitted
        </p>
      )}
      {changed.length ? (
        renderRows(changed)
      ) : (
        <p className="tagger-no-changes">No metadata changes.</p>
      )}
      {cover && (
        <div className="tagger-cover-preview">
          <strong>Cover replacement</strong>
          <div>
            <figure>
              <figcaption>Local now</figcaption>
              {local.paths.screenshot ? (
                <img src={local.paths.screenshot} alt="Current scene cover" />
              ) : (
                "No cover"
              )}
            </figure>
            <figure>
              <figcaption>After Save</figcaption>
              <img src={cover} alt="Selected scraped cover" />
            </figure>
          </div>
        </div>
      )}
      <details className="tagger-unchanged">
        <summary>{unchanged.length} unchanged fields</summary>
        {renderRows(unchanged)}
      </details>
    </section>
  );
};
