import React, { useState } from "react";
import { Badge, Button, Table } from "react-bootstrap";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { getCountryByISO } from "src/utils/country";
import { genderToString } from "src/utils/gender";
import {
  STASHDB_STATUS_LABELS_CUSTOM,
  StashDBChangesKindCustom,
  stashDBApplicableCustom,
  stashDBEntryURLCustom,
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
  return (
    <ul className="stashdb-changes-list">
      {values.map((v) => (
        <li key={v} className={sign === "+" ? "text-success" : "text-danger"}>
          {sign}{" "}
          {/^https?:\/\//i.test(v) ? (
            <a href={v} target="_blank" rel="noopener noreferrer">
              {v}
            </a>
          ) : (
            v
          )}
        </li>
      ))}
    </ul>
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

  function format(field: string, value?: string | null) {
    if (!value) return <span className="text-muted">—</span>;
    if (field === "gender") return genderToString(value) ?? value;
    if (field === "country")
      return getCountryByISO(value, intl.locale) ?? value;
    return value;
  }

  function renderField(f: IFieldChange) {
    const isList = f.added.length > 0 || f.removed.length > 0;
    return (
      <tr key={f.field}>
        <th scope="row">{labels.get(f.field) ?? f.field}</th>
        <td className="stashdb-changes-value">
          {isList ? (
            <ListValue values={f.removed} sign="−" />
          ) : (
            format(f.field, f.local)
          )}
        </td>
        <td className="stashdb-changes-value">
          {isList ? (
            <ListValue values={f.added} sign="+" />
          ) : (
            format(f.field, f.remote)
          )}
        </td>
        <td className="stashdb-changes-apply">
          {applicable.includes(f.field) && (
            <Button
              size="sm"
              variant="secondary"
              disabled={applying}
              onClick={() => onApply?.([f.field])}
            >
              Use StashDB
            </Button>
          )}
        </td>
      </tr>
    );
  }

  return (
    <div className="stashdb-changes-entry">
      <div className="stashdb-changes-entry-header">
        <div>
          <Link to={url}>{name}</Link>
          {subtitle && (
            <span className="text-muted small ml-2">{subtitle}</span>
          )}
          {STASHDB_STATUS_LABELS_CUSTOM[status] && (
            <Badge variant="warning" className="ml-2">
              {STASHDB_STATUS_LABELS_CUSTOM[status]}
            </Badge>
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
              variant="primary"
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
            className="small"
          >
            StashDB
          </a>
        </div>
      </div>
      {fields.length > 0 && (
        <Table size="sm" className="stashdb-changes-fields-table">
          <thead>
            <tr>
              <th />
              <th>Yours</th>
              <th>StashDB</th>
              <th className="stashdb-changes-apply" />
            </tr>
          </thead>
          <tbody>{fields.map(renderField)}</tbody>
        </Table>
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
