import React, { useMemo } from "react";
import Select from "react-select";
import { useIntl } from "react-intl";
import { getCountries } from "src/utils/country";
import { CountryCriterion } from "src/models/list-filter/criteria/country";

interface IOption {
  label: string;
  value: string;
}

export const PerformerCountryFilter: React.FC<{
  criterion: CountryCriterion;
  onValueChanged: (value: string) => void;
}> = ({ criterion, onValueChanged }) => {
  const { locale } = useIntl();
  const options = useMemo(() => getCountries(locale) as IOption[], [locale]);

  const selectedValues = useMemo(() => {
    if (!criterion.value) return [] as IOption[];
    return criterion.value
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .map((v) => options.find((o) => o.value === v) || { label: v, value: v });
  }, [criterion.value, options]);

  return (
    <Select
      classNamePrefix="react-select"
      isMulti
      value={selectedValues}
      options={options}
      placeholder="Country"
      onChange={(vals) =>
        onValueChanged(
          (vals as IOption[]).map((v) => v.value).join(",")
        )
      }
      components={{ IndicatorSeparator: null }}
      menuPortalTarget={document.body}
    />
  );
};
