// CUSTOM: Partners filter UI — 3x3 grid (Topped/Bottomed/Unique × Sex/Oral/Facial) with per-row AND/OR operator
import React, { useCallback } from "react";
import { Form } from "react-bootstrap";
import { useIntl } from "react-intl";
import { CriterionModifier } from "src/core/generated-graphql";
import { Criterion } from "src/models/list-filter/criteria/criterion";
import {
  IPartnerMetric,
  IPerformerPartnersValue,
  PerformerPartnersCriterion,
} from "src/models/list-filter/criteria/performer-partners";

interface IPerformerPartnersFilterProps {
  criterion: PerformerPartnersCriterion;
  setCriterion: (criterion: Criterion) => void;
}

type MetricKey = keyof IPerformerPartnersValue;
type OperatorKey = "topped_operator" | "bottomed_operator" | "unique_operator";

const MODIFIERS = [
  { value: CriterionModifier.Equals, label: "=" },
  { value: CriterionModifier.GreaterThan, label: ">" },
  { value: CriterionModifier.LessThan, label: "<" },
];

const ROWS: Array<{ labelKey: string; keys: MetricKey[]; operatorKey: OperatorKey }> = [
  {
    labelKey: "partners.topped",
    keys: ["sex_topped", "oral_topped", "facial_topped"],
    operatorKey: "topped_operator",
  },
  {
    labelKey: "partners.bottomed",
    keys: ["sex_bottomed", "oral_bottomed", "facial_bottomed"],
    operatorKey: "bottomed_operator",
  },
  {
    labelKey: "partners.unique",
    keys: ["sex_unique", "oral_unique", "facial_unique"],
    operatorKey: "unique_operator",
  },
];

const COLUMNS = ["partners.sex", "partners.oral", "partners.facial"];

export const PerformerPartnersFilter: React.FC<
  IPerformerPartnersFilterProps
> = ({ criterion, setCriterion }) => {
  const intl = useIntl();

  const updateValue = useCallback(
    (update: Partial<IPerformerPartnersValue>) => {
      const newCriterion = criterion.clone() as PerformerPartnersCriterion;
      newCriterion.value = { ...newCriterion.value, ...update };
      setCriterion(newCriterion);
    },
    [criterion, setCriterion]
  );

  const updateMetric = useCallback(
    (key: MetricKey, metric: IPartnerMetric | undefined) => {
      const newCriterion = criterion.clone() as PerformerPartnersCriterion;
      const newValue: IPerformerPartnersValue = { ...newCriterion.value };
      if (metric === undefined) {
        delete newValue[key];
      } else {
        newValue[key] = metric;
      }
      newCriterion.value = newValue;
      setCriterion(newCriterion);
    },
    [criterion, setCriterion]
  );

  const renderCell = (key: MetricKey) => {
    const metric = criterion.value[key];
    const modifier = metric?.modifier ?? CriterionModifier.Equals;
    const value = metric?.value ?? "";

    const onModifierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newModifier = e.target.value as CriterionModifier;
      // Always allow changing modifier — preserve existing value (or keep undefined)
      updateMetric(key, { modifier: newModifier, value: metric?.value });
    };

    const onValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = parseInt(e.target.value, 10);
      const num = Number.isNaN(raw) ? undefined : raw;
      if (e.target.value === "") {
        // Clearing value: keep the modifier so the user can re-enter a value later
        updateMetric(key, metric !== undefined ? { modifier: metric.modifier, value: undefined } : undefined);
      } else {
        updateMetric(key, { modifier, value: num });
      }
    };

    return (
      <td
        key={key}
        style={{ paddingLeft: "0.25rem", paddingRight: "0.25rem", paddingBottom: "0.5rem" }}
      >
        <div style={{ display: "flex", gap: "0.2rem", alignItems: "center" }}>
          <Form.Control
            as="select"
            size="sm"
            value={modifier}
            style={{ width: "3rem", flexShrink: 0 }}
            onChange={onModifierChange}
          >
            {MODIFIERS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Form.Control>
          <Form.Control
            type="number"
            size="sm"
            min={0}
            value={value}
            placeholder="—"
            style={{ width: "3.5rem" }}
            onChange={onValueChange}
          />
        </div>
      </td>
    );
  };

  const renderOperatorToggle = (operatorKey: OperatorKey) => {
    const op = criterion.value[operatorKey] ?? "AND";
    return (
      <td
        style={{
          paddingLeft: "0.25rem",
          paddingBottom: "0.5rem",
          verticalAlign: "middle",
        }}
      >
        <Form.Control
          as="select"
          size="sm"
          value={op}
          style={{ width: "3.5rem" }}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            const newOp = e.target.value as "AND" | "OR";
            updateValue({ [operatorKey]: newOp });
          }}
        >
          <option value="AND">AND</option>
          <option value="OR">OR</option>
        </Form.Control>
      </td>
    );
  };

  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ width: "4.5rem" }} />
            {COLUMNS.map((col) => (
              <th
                key={col}
                style={{
                  textAlign: "center",
                  paddingBottom: "0.25rem",
                  fontWeight: "normal",
                  fontSize: "0.85em",
                }}
              >
                {intl.formatMessage({ id: col })}
              </th>
            ))}
            <th
              style={{
                paddingBottom: "0.25rem",
                paddingLeft: "0.5rem",
                fontWeight: "normal",
                fontSize: "0.85em",
              }}
            >
              {intl.formatMessage({ id: "operator" })}
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.labelKey}>
              <td
                style={{
                  paddingRight: "0.5rem",
                  paddingBottom: "0.5rem",
                  whiteSpace: "nowrap",
                  fontSize: "0.85em",
                  verticalAlign: "middle",
                }}
              >
                {intl.formatMessage({ id: row.labelKey })}
              </td>
              {row.keys.map((key) => renderCell(key))}
              {renderOperatorToggle(row.operatorKey)}
            </tr>
          ))}
        </tbody>
      </table>
      <Form.Text className="text-muted" style={{ fontSize: "0.8em" }}>
        {intl.formatMessage({ id: "partners_filter_hint" })}
      </Form.Text>
    </div>
  );
};
