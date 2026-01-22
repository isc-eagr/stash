import React, { useMemo } from "react";
import { Badge } from "react-bootstrap";
import Select, {
  components,
  OptionProps,
  MultiValueProps,
  GroupBase,
  StylesConfig,
} from "react-select";
import { useIntl } from "react-intl";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import {
  IUnnamedPerformer,
  formatUnnamedPerformerSummary,
  isUnnamedPerformerId,
} from "src/models/list-filter/criteria/unnamed-performer";
import {
  PerformerIDSelect,
  Performer,
} from "src/components/Performers/PerformerSelect";
import { queryFindPerformersByIDForSelect } from "src/core/StashService";

// Option type that can be either a regular performer or an unnamed performer
interface PerformerOption {
  value: string;
  label: string;
  isUnnamed: boolean;
  performer?: Performer;
  unnamedPerformer?: IUnnamedPerformer;
}

interface IPerformerSelectWithUnnamedProps {
  // Regular props
  isMulti?: boolean;
  ids: string[];
  onSelect: (performers: Performer[]) => void;
  menuPortalTarget?: HTMLElement | null;
  // Unnamed performers available in this filter context
  unnamedPerformers: IUnnamedPerformer[];
  // Handler that will be called with the full selected IDs (including unnamed)
  onSelectWithUnnamed?: (ids: string[], performers: Performer[]) => void;
}

// Custom option component to render unnamed performers with a distinct style
const CustomOption: React.FC<OptionProps<PerformerOption, true>> = (props) => {
  const { data } = props;

  if (data.isUnnamed && data.unnamedPerformer) {
    return (
      <components.Option {...props}>
        <div className="unnamed-performer-option d-flex align-items-center">
          <Badge
            variant="info"
            className="me-2"
            style={{ fontSize: "0.75em", padding: "4px 6px" }}
          >
            <Icon icon={faUser} className="me-1" />
            {data.unnamedPerformer.letter}
          </Badge>
          <span>
            <strong>{data.label}</strong>
            <small className="text-muted ms-2">
              {formatUnnamedPerformerSummary(data.unnamedPerformer)}
            </small>
          </span>
        </div>
      </components.Option>
    );
  }

  // For regular performers, use the default option rendering
  return <components.Option {...props}>{data.label}</components.Option>;
};

// Custom multi-value component to render selected unnamed performers distinctly
const CustomMultiValue: React.FC<MultiValueProps<PerformerOption, true>> = (
  props
) => {
  const { data } = props;

  if (data.isUnnamed && data.unnamedPerformer) {
    return (
      <components.MultiValue {...props}>
        <Badge
          variant="info"
          className="me-1"
          style={{ fontSize: "0.7em", padding: "2px 4px" }}
        >
          <Icon icon={faUser} className="me-1" />
          {data.unnamedPerformer.letter}
        </Badge>
        {data.label}
      </components.MultiValue>
    );
  }

  return <components.MultiValue {...props}>{data.label}</components.MultiValue>;
};

/**
 * A performer select component that includes unnamed performers as options.
 * Unnamed performers appear at the top of the dropdown, followed by regular performers.
 */
export const PerformerSelectWithUnnamed: React.FC<
  IPerformerSelectWithUnnamedProps
> = ({
  isMulti = true,
  ids,
  onSelect,
  menuPortalTarget,
  unnamedPerformers,
  onSelectWithUnnamed,
}) => {
  const intl = useIntl();

  // If there are no unnamed performers, just use the regular PerformerIDSelect
  if (unnamedPerformers.length === 0) {
    return (
      <PerformerIDSelect
        isMulti={isMulti}
        ids={ids.filter((id) => !isUnnamedPerformerId(id))}
        onSelect={onSelect}
        menuPortalTarget={menuPortalTarget}
      />
    );
  }

  // Convert unnamed performers to options
  const unnamedOptions: PerformerOption[] = useMemo(
    () =>
      unnamedPerformers.map((up) => ({
        value: up.id,
        label: up.label,
        isUnnamed: true,
        unnamedPerformer: up,
      })),
    [unnamedPerformers]
  );

  // Get the selected values (need to handle both named and unnamed)
  const [selectedOptions, setSelectedOptions] = React.useState<
    PerformerOption[]
  >([]);
  const [loadedPerformers, setLoadedPerformers] = React.useState<
    Map<string, Performer>
  >(new Map());

  // Load named performers when IDs change
  React.useEffect(() => {
    const namedIds = ids.filter((id) => !isUnnamedPerformerId(id));
    const unnamedIds = ids.filter((id) => isUnnamedPerformerId(id));

    // Build selected options
    const options: PerformerOption[] = [];

    // Add unnamed performers
    for (const id of unnamedIds) {
      const up = unnamedPerformers.find((p) => p.id === id);
      if (up) {
        options.push({
          value: up.id,
          label: up.label,
          isUnnamed: true,
          unnamedPerformer: up,
        });
      }
    }

    // Load named performers if needed
    const missingIds = namedIds.filter((id) => !loadedPerformers.has(id));
    if (missingIds.length > 0) {
      queryFindPerformersByIDForSelect(missingIds).then((result) => {
        const newMap = new Map(loadedPerformers);
        for (const p of result.data.findPerformers.performers) {
          newMap.set(p.id, p);
        }
        setLoadedPerformers(newMap);
      });
    }

    // Add already loaded named performers
    for (const id of namedIds) {
      const p = loadedPerformers.get(id);
      if (p) {
        options.push({
          value: p.id,
          label: p.name || p.id,
          isUnnamed: false,
          performer: p,
        });
      }
    }

    setSelectedOptions(options);
  }, [ids, unnamedPerformers, loadedPerformers]);

  const handleChange = (selected: readonly PerformerOption[] | null) => {
    const newOptions = selected ? [...selected] : [];
    setSelectedOptions(newOptions);

    // Separate named and unnamed performers
    const namedPerformers: Performer[] = [];
    const allIds: string[] = [];

    for (const opt of newOptions) {
      allIds.push(opt.value);
      if (!opt.isUnnamed && opt.performer) {
        namedPerformers.push(opt.performer);
      }
    }

    // Call the handlers
    onSelect(namedPerformers);
    onSelectWithUnnamed?.(allIds, namedPerformers);
  };

  // Load options for async search
  const loadOptions = async (inputValue: string): Promise<PerformerOption[]> => {
    // Start with unnamed performers that match the search
    const matchingUnnamed = unnamedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(inputValue.toLowerCase()) ||
        (opt.unnamedPerformer &&
          formatUnnamedPerformerSummary(opt.unnamedPerformer)
            .toLowerCase()
            .includes(inputValue.toLowerCase()))
    );

    // This is a simplified version - in production you'd want to fetch performers from the API
    // For now, we'll return unnamed performers plus a placeholder for "type to search"
    return [
      ...matchingUnnamed,
      // Regular performers would be loaded here via API
    ];
  };

  // Custom styles to make unnamed performers stand out
  const customStyles: StylesConfig<PerformerOption, true> = {
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.data.isUnnamed
        ? state.isFocused
          ? "#e3f2fd"
          : "#f5f5f5"
        : state.isFocused
        ? "#deebff"
        : undefined,
    }),
    multiValue: (provided, state) => ({
      ...provided,
      backgroundColor: state.data.isUnnamed ? "#17a2b8" : "#e9ecef",
      color: state.data.isUnnamed ? "white" : undefined,
    }),
    multiValueLabel: (provided, state) => ({
      ...provided,
      color: state.data.isUnnamed ? "white" : undefined,
    }),
  };

  // Group the options
  const groupedOptions: GroupBase<PerformerOption>[] = [
    {
      label: intl.formatMessage({
        id: "unnamed_performer.section_title",
        defaultMessage: "— Unnamed Performers —",
      }),
      options: unnamedOptions,
    },
  ];

  return (
    <Select<PerformerOption, true>
      isMulti
      value={selectedOptions}
      onChange={handleChange}
      options={groupedOptions}
      components={{
        Option: CustomOption,
        MultiValue: CustomMultiValue,
      }}
      styles={customStyles}
      menuPortalTarget={menuPortalTarget ?? document.body}
      placeholder={intl.formatMessage(
        { id: "actions.select_entity" },
        { entityType: intl.formatMessage({ id: "performers" }) }
      )}
      classNamePrefix="react-select"
      isClearable
    />
  );
};

export default PerformerSelectWithUnnamed;
