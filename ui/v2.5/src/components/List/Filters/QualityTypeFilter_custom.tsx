import React, { useCallback } from "react";
import { Form } from "react-bootstrap";
import { useIntl } from "react-intl";
import { CriterionModifier } from "src/core/generated-graphql";
import { Criterion } from "src/models/list-filter/criteria/criterion";
import {
  IQualityTypeMetric,
  IQualityTypeValue,
  QualityTypeCriterion,
  QualityTypeMetricKey,
} from "src/models/list-filter/criteria/quality-type_custom";

interface IQualityTypeFilterProps {
  criterion: QualityTypeCriterion;
  setCriterion: (criterion: Criterion) => void;
}

const MODIFIERS = [
  { value: CriterionModifier.GreaterThan, label: ">" },
  { value: CriterionModifier.LessThan, label: "<" },
];

export const QualityTypeFilter: React.FC<IQualityTypeFilterProps> = ({
  criterion,
  setCriterion,
}) => {
  const intl = useIntl();

  const updateMetric = useCallback(
    (key: QualityTypeMetricKey, metric: IQualityTypeMetric | undefined) => {
      const newCriterion = criterion.clone() as QualityTypeCriterion;
      const newValue: IQualityTypeValue = { ...newCriterion.value };
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

  const renderRow = (key: QualityTypeMetricKey) => {
    const metric = criterion.value[key];
    const modifier = metric?.modifier ?? CriterionModifier.GreaterThan;
    const value = metric?.value ?? "";

    const onModifierChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
      const newModifier = event.target.value as CriterionModifier;
      updateMetric(key, { modifier: newModifier, value: metric?.value });
    };

    const onValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = parseInt(event.target.value, 10);
      const numericValue = Number.isNaN(raw) ? undefined : raw;
      if (event.target.value === "") {
        updateMetric(
          key,
          metric !== undefined
            ? { modifier: metric.modifier, value: undefined }
            : undefined
        );
      } else {
        updateMetric(key, { modifier, value: numericValue });
      }
    };

    return (
      <tr key={key}>
        <td className="pr-2 pb-2 align-middle">
          {intl.formatMessage({ id: `quality_type.${key}` })}
        </td>
        <td className="pr-2 pb-2">
          <Form.Control
            as="select"
            size="sm"
            value={modifier}
            style={{ width: "3.25rem" }}
            onChange={onModifierChange}
          >
            {MODIFIERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
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
        {intl.formatMessage({ id: "quality_type_filter_hint" })}
      </Form.Text>
    </div>
  );
};
