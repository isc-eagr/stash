import React, { useCallback } from "react";
import { Form } from "react-bootstrap";
import { useIntl } from "react-intl";
import { CriterionModifier } from "src/core/generated-graphql";
import { Criterion } from "src/models/list-filter/criteria/criterion";
import {
  ActivityTypeCriterion,
  ActivityTypeMetricKey,
  IActivityTypeMetric,
  IActivityTypeValue,
} from "src/models/list-filter/criteria/activity-type_custom";

interface IActivityTypeFilterProps {
  criterion: ActivityTypeCriterion;
  setCriterion: (criterion: Criterion) => void;
}

const MODIFIERS = [
  { value: CriterionModifier.GreaterThan, label: ">" },
  { value: CriterionModifier.LessThan, label: "<" },
];

export const ActivityTypeFilter: React.FC<IActivityTypeFilterProps> = ({
  criterion,
  setCriterion,
}) => {
  const intl = useIntl();

  const updateMetric = useCallback(
    (key: ActivityTypeMetricKey, metric: IActivityTypeMetric | undefined) => {
      const newCriterion = criterion.clone() as ActivityTypeCriterion;
      const newValue: IActivityTypeValue = { ...newCriterion.value };
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

  const renderRow = (key: ActivityTypeMetricKey) => {
    const metric = criterion.value[key];
    const modifier = metric?.modifier ?? CriterionModifier.GreaterThan;
    const value = metric?.value ?? "";

    const onModifierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newModifier = e.target.value as CriterionModifier;
      updateMetric(key, { modifier: newModifier, value: metric?.value });
    };

    const onValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = parseInt(e.target.value, 10);
      const num = Number.isNaN(raw) ? undefined : raw;
      if (e.target.value === "") {
        updateMetric(
          key,
          metric !== undefined
            ? { modifier: metric.modifier, value: undefined }
            : undefined
        );
      } else {
        updateMetric(key, { modifier, value: num });
      }
    };

    return (
      <tr key={key}>
        <td className="pr-2 pb-2 align-middle">
          {intl.formatMessage({ id: `activity_type.${key}` })}
        </td>
        <td className="pr-2 pb-2">
          <Form.Control
            as="select"
            size="sm"
            value={modifier}
            style={{ width: "3.25rem" }}
            onChange={onModifierChange}
          >
            {MODIFIERS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Form.Control>
        </td>
        <td className="pb-2">
          <div className="d-flex align-items-center">
            <Form.Control
              type="number"
              size="sm"
              min={0}
              max={100}
              value={value}
              placeholder="-"
              style={{ width: "5rem" }}
              onChange={onValueChange}
            />
            <span className="ml-2">%</span>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div>
      <table style={{ borderCollapse: "collapse" }}>
        <tbody>{criterion.metricKeys.map(renderRow)}</tbody>
      </table>
      <Form.Text className="text-muted" style={{ fontSize: "0.8em" }}>
        {intl.formatMessage({ id: "activity_type_filter_hint" })}
      </Form.Text>
    </div>
  );
};
