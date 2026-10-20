import React, { useState } from "react";
import { Badge, Button } from "react-bootstrap";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { getCountryByISO } from "src/utils/country";
import { genderToString } from "src/utils/gender";
import {
  STASHDB_STATUS_LABELS_CUSTOM,
  StashDBChangesKindCustom,
  stashDBApplicableCustom,
  stashDBEntryURLCustom,
  stashDBShortURLCustom,
} from "./stashDBChanges_custom";

interface IFieldChange {
  field: string;
  local?: string | null;
  remote?: string | null;
  added: string[];
  removed: string[];
}

export interface IStashDBChangesEntryProps {
  kind: StashDBChangesKindCustom;
  endpoint: string;
  name: string;
  subtitle?: string | null;
  url: string;
  status: string;
  stashID: string;
  mergedIntoID?: string | null;
  fields: IFieldChange[];
  labels: Map<string, string>;
  // Writes StashDB's values for the given fields.
  onApply?: (fields: string[]) => void;
  applying?: boolean;
}

function ListValue({ values, sign }: { values: string[]; sign: "+" | "−" }) {
  const tone = sign === "+" ? "added" : "removed";
  return (
    <>
      {values.map((v) => (
        <span
          key={`${sign}${v}`}
          className={`stashdb-changes-pill stashdb-changes-pill-${tone}`}
          title={v}
        >
          {sign}{" "}
          {/^https?:\/\//i.test(v) ? (
            <a href={v} target="_blank" rel="noopener noreferrer">
              {stashDBShortURLCustom(v)}
            </a>
          ) : (
            v
          )}
        </span>
      ))}
    </>
  );
}

// CUSTOM: one scene or vato that differs from StashDB or is gone from it.
export const StashDBChangesEntry: React.FC<IStashDBChangesEntryProps> = ({
  kind,
  endpoint,
  name,
  subtitle,
  url,
  status,
  stashID,
  mergedIntoID,
  fields,
  labels,
  onApply,
  applying,
}) => {
  const intl = useIntl();
  const applicable = onApply
    ? fields.filter(stashDBApplicableCustom).map((f) => f.field)
    : [];
  const gone = status !== "CHANGED";

  function format(field: string, value: string) {
    if (field === "gender") return genderToString(value) ?? value;
    if (field === "country")
      return getCountryByISO(value, intl.locale) ?? value;
    return value;
  }

  function renderScalar(
    field: string,
    value: string | null | undefined,
    tone: string
  ) {
    if (!value) return <span className="stashdb-changes-empty">empty</span>;
    return (
      <span className={`stashdb-changes-scalar stashdb-changes-${tone}`}>
        {format(field, value)}
      </span>
    );
  }

  function renderField(f: IFieldChange) {
    const isList = f.added.length > 0 || f.removed.length > 0;
    return (
      <div key={f.field} className="stashdb-changes-row">
        <div className="stashdb-changes-label">
          {labels.get(f.field) ?? f.field}
        </div>
        {isList ? (
          <div className="stashdb-changes-value stashdb-changes-pills">
            <ListValue values={f.added} sign="+" />
            <ListValue values={f.removed} sign="−" />
          </div>
        ) : (
          <>
            <div className="stashdb-changes-value">
              {renderScalar(f.field, f.local, "old")}
            </div>
            <div className="stashdb-changes-arrow" aria-hidden>
              →
            </div>
            <div className="stashdb-changes-value">
              {renderScalar(f.field, f.remote, "new")}
            </div>
          </>
        )}
        <div className="stashdb-changes-apply">
          {applicable.includes(f.field) && (
            <Button
              size="sm"
              variant="outline-success"
              disabled={applying}
              onClick={() => onApply?.([f.field])}
            >
              Use StashDB
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`stashdb-changes-entry ${
        gone ? "stashdb-changes-entry-gone" : ""
      }`}
    >
      <div className="stashdb-changes-entry-header">
        <div className="stashdb-changes-entry-title">
          <Link to={url}>{name}</Link>
          {subtitle && (
            <span className="text-muted small ml-2">{subtitle}</span>
          )}
          {STASHDB_STATUS_LABELS_CUSTOM[status] && (
            <Badge variant="warning" className="ml-2">
              {STASHDB_STATUS_LABELS_CUSTOM[status]}
            </Badge>
          )}
          {fields.length > 0 && (
            <span className="text-muted small ml-2">
              {fields.length} {fields.length === 1 ? "change" : "changes"}
            </span>
          )}
          {mergedIntoID && (
            <span className="small ml-2">
              Now{" "}
              <a
                href={stashDBEntryURLCustom(endpoint, kind, mergedIntoID)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {mergedIntoID}
              </a>
            </span>
          )}
        </div>
        <div className="stashdb-changes-entry-actions">
          {applicable.length > 1 && (
            <Button
              size="sm"
              variant="success"
              disabled={applying}
              title="Hidden fields stay as they are"
              onClick={() => onApply?.(applicable)}
            >
              Use all
            </Button>
          )}
          <a
            href={stashDBEntryURLCustom(endpoint, kind, stashID)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-secondary"
          >
            StashDB
          </a>
        </div>
      </div>
      {fields.length > 0 && (
        <div className="stashdb-changes-rows">
          <div className="stashdb-changes-row stashdb-changes-row-head">
            <div />
            <div>Yours</div>
            <div />
            <div>StashDB</div>
            <div />
          </div>
          {fields.map(renderField)}
        </div>
      )}
    </div>
  );
};

// Native disclosure that renders its rows only once opened.
export const StashDBChangesGroup: React.FC<{ name: string; count: number }> = ({
  name,
  count,
  children,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="stashdb-changes-group"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        {name} <span className="text-muted">({count})</span>
      </summary>
      {open && <div className="stashdb-changes-group-body">{children}</div>}
    </details>
  );
};

const PAGE_SIZE = 100;

// Long lists render a page at a time.
export function StashDBChangesPagedList<T>({
  items,
  render,
}: {
  items: readonly T[];
  render: (item: T) => React.ReactNode;
}) {
  const [shown, setShown] = useState(PAGE_SIZE);
  return (
    <>
      {items.slice(0, shown).map(render)}
      {items.length > shown && (
        <Button variant="link" onClick={() => setShown(shown + PAGE_SIZE)}>
          Show more ({items.length - shown} left)
        </Button>
      )}
    </>
  );
}
