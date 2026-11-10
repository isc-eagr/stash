import React, { useMemo } from "react";
import Select from "react-select";
import {
  EthnicityCriterion,
  ethnicityExactValue,
  ethnicityTokenLabels,
} from "src/models/list-filter/criteria/ethnicity";
import { usePerformerEthnicitiesQuery } from "src/core/generated-graphql";

interface IOption {
  label: string;
  value: string;
}

export const PerformerEthnicityFilter: React.FC<{
  criterion: EthnicityCriterion;
  onValueChanged: (value: string) => void;
}> = ({ criterion, onValueChanged }) => {
  const { data } = usePerformerEthnicitiesQuery();
  const options: IOption[] = useMemo(() => {
    const list = data?.performerEthnicities ?? [];
    return (list as string[]).map((v: string) => ({ label: v, value: v }));
  }, [data]);

  const selectedValues = useMemo(() => {
    if (!criterion.value) return [] as IOption[];
    const codes = criterion.value
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    return codes.map(
      (v: string) =>
        options.find((o: IOption) => o.value === v) || {
          label: ethnicityTokenLabels[v] ?? v,
          value: v,
        }
    );
  }, [criterion.value, options]);
  const exact = selectedValues.some((v) => v.value === ethnicityExactValue);

  return (
    <div>
      <Select
        classNamePrefix="react-select"
        isMulti
        value={selectedValues}
        options={options}
        placeholder="Ethnicity"
        onChange={(vals) =>
          onValueChanged((vals as IOption[]).map((v) => v.value).join(","))
        }
        components={{ IndicatorSeparator: null }}
        menuPortalTarget={document.body}
      />
      <div style={{ marginTop: 4 }}>
        <small className="text-muted">
          {exact
            ? "Exact match: Mixed and Afrolatino only count as themselves."
            : "Note: Afrolatino counts as Black and Latino; Mixed counts as Black and White."}
        </small>
      </div>
    </div>
  );
};
