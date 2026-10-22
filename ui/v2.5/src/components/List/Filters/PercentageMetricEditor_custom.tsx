import React from "react";
import { Form } from "react-bootstrap";
import { useIntl } from "react-intl";
import { CriterionModifier } from "src/core/generated-graphql";
import type { Criterion } from "src/models/list-filter/criteria/criterion";
import {
  parsePercentageMetricCustom,
  updatePercentageMetricCustom,
  type IPercentageMetricCustom,
} from "src/utils/percentageMetric_custom";

// CUSTOM: One editor and empty-value policy for activity and time quality.
export function PercentageMetricEditor<K extends string>({
  criterion,
  setCriterion,
  prefix,
  hint,
}: {
  criterion: Criterion & {
    value: Partial<Record<K, IPercentageMetricCustom>>;
    metricKeys: readonly K[];
  };
  setCriterion: (criterion: Criterion) => void;
  prefix: string;
  hint: string;
}) {
  const intl = useIntl();
  function update(key: K, value?: IPercentageMetricCustom) {
    const next = criterion.clone() as typeof criterion;
    next.value = updatePercentageMetricCustom(next.value, key, value);
    setCriterion(next);
  }
  return (
    <div>
      <table style={{ borderCollapse: "collapse" }}>
        <tbody>
          {criterion.metricKeys.map((key) => {
            const metric = criterion.value[key];
            return (
              <tr key={key}>
                <td className="pr-2 pb-2 align-middle">
                  {intl.formatMessage({ id: `${prefix}.${key}` })}
                </td>
                <td className="pr-2 pb-2">
                  <Form.Control
                    as="select"
                    size="sm"
                    value={metric?.modifier ?? CriterionModifier.GreaterThan}
                    style={{ width: "3.25rem" }}
                    aria-label={
                      intl.formatMessage({ id: `${prefix}.${key}` }) +
                      " comparison"
                    }
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                      update(key, {
                        modifier: event.target.value as CriterionModifier,
                        value: metric?.value,
                      })
                    }
                  >
                    <option value={CriterionModifier.GreaterThan}>{">"}</option>
                    <option value={CriterionModifier.LessThan}>{"<"}</option>
                  </Form.Control>
                </td>
                <td className="pb-2">
                  <div className="d-flex align-items-center">
                    <Form.Control
                      type="number"
                      size="sm"
                      min={0}
                      max={100}
                      value={metric?.value ?? ""}
                      placeholder="-"
                      style={{ width: "5rem" }}
                      aria-label={intl.formatMessage({
                        id: `${prefix}.${key}`,
                      })}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        update(
                          key,
                          parsePercentageMetricCustom(
                            event.target.value,
                            metric
                          )
                        )
                      }
                    />
                    <span className="ml-2">%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Form.Text className="text-muted" style={{ fontSize: "0.8em" }}>
        {intl.formatMessage({ id: hint })}
      </Form.Text>
    </div>
  );
}
