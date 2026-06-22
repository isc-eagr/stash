import React from "react";
import { Badge, Button, Card, Col, Form, Row } from "react-bootstrap";
import Select, {
  components as selectComponents,
  OptionProps,
  MultiValueProps,
} from "react-select";
import { FormattedMessage, useIntl } from "react-intl";
import {
  CriterionModifier,
  usePerformerEthnicitiesQuery,
} from "src/core/generated-graphql";
import {
  PerformerIDSelect,
  Performer,
} from "src/components/Performers/PerformerSelect";
import { getCountries } from "src/utils/country";
import { CountryFlag } from "src/components/Shared/CountryFlag";
import { RatingSystem } from "src/components/Shared/Rating/RatingSystem";
import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import {
  MarkerBottomCriterion,
  IMarkerBottomFilter,
} from "src/models/list-filter/criteria/marker-bottom";
import { useMarkerFilterGroups } from "./MarkerFilterGroupContext";
import { RatingCriterion } from "src/models/list-filter/criteria/tags";

const ratingModifiers: {
  value: CriterionModifier;
  label: string;
  title: string;
}[] = [
  { value: CriterionModifier.Equals, label: "=", title: "Equals" },
  { value: CriterionModifier.NotEquals, label: "≠", title: "Not equals" },
  { value: CriterionModifier.GreaterThan, label: ">", title: "Greater than" },
  { value: CriterionModifier.LessThan, label: "<", title: "Less than" },
  { value: CriterionModifier.Between, label: "↔", title: "Between" },
  { value: CriterionModifier.NotBetween, label: "↮", title: "Not between" },
];

// Country option with flag
const CountryOption: React.FC<
  OptionProps<{ label: string; value: string }, true>
> = (props) => {
  const { data } = props;
  return (
    <selectComponents.Option {...props}>
      <CountryFlag country={data.value} className="me-2" />
      {data.label}
    </selectComponents.Option>
  );
};

// Country multi-value with flag
const CountryMultiValue: React.FC<
  MultiValueProps<{ label: string; value: string }, true>
> = (props) => {
  const { data } = props;
  return (
    <selectComponents.MultiValue {...props}>
      <CountryFlag country={data.value} className="me-1" />
      {data.label}
    </selectComponents.MultiValue>
  );
};

interface IMarkerBottomFilterProps {
  criterion: MarkerBottomCriterion;
  setCriterion: (c: MarkerBottomCriterion) => void;
}

interface IFilterEditorProps {
  filter: IMarkerBottomFilter;
  index: number;
  onUpdate: (updates: Partial<IMarkerBottomFilter>) => void;
  onDelete: () => void;
  canDelete: boolean;
}

const FilterEditor: React.FC<IFilterEditorProps> = ({
  filter,
  index,
  onUpdate,
  onDelete,
  canDelete,
}) => {
  const intl = useIntl();
  const { groups } = useMarkerFilterGroups();

  // Fetch ethnicity options
  const { data: ethnicityData } = usePerformerEthnicitiesQuery();
  const ethnicityOptions = React.useMemo(() => {
    const ethnicities = ethnicityData?.performerEthnicities ?? [];
    return ethnicities.map((e) => ({ label: e, value: e }));
  }, [ethnicityData]);

  // Country options
  const countryOptions = React.useMemo(() => {
    return getCountries().map((c) => ({ label: c.label, value: c.value }));
  }, []);

  const onTargetGroupChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>
  ) => {
    onUpdate({ targetGroupId: e.target.value });
  };

  const onPerformersChange = (performers: Performer[]) => {
    onUpdate({
      performer_ids: performers.map((p) => ({
        id: p.id,
        label: p.name ?? p.id,
      })),
    });
  };

  const onEthnicitiesChange = (values: readonly { value: string }[]) => {
    onUpdate({ ethnicities: values.map((v) => v.value) });
  };

  const onCountriesChange = (values: readonly { value: string }[]) => {
    onUpdate({ countries: values.map((v) => v.value) });
  };

  const onRatingChange = (rating: RatingCriterion) => {
    onUpdate({ rating });
  };

  const currentRating = filter.rating;
  const currentModifier = currentRating?.modifier ?? CriterionModifier.Equals;
  const currentModDef = ratingModifiers.find(
    (m) => m.value === currentModifier
  );

  const onRatingModifierChange = (m: CriterionModifier) => {
    onRatingChange({
      modifier: m,
      value: currentRating?.value ?? 0,
      value2: currentRating?.value2,
    });
  };

  const onRatingValueChange = (v: number) => {
    if (!currentRating) {
      onRatingChange({ modifier: CriterionModifier.Equals, value: v });
    } else {
      onRatingChange({ ...currentRating, value: v });
    }
  };

  const onRatingValue2Change = (v: number) => {
    if (!currentRating) {
      onRatingChange({
        modifier: CriterionModifier.Between,
        value: 0,
        value2: v,
      });
    } else {
      onRatingChange({ ...currentRating, value2: v });
    }
  };

  return (
    <Card className="mb-3">
      <Card.Header className="d-flex justify-content-between align-items-center py-2">
        <Badge variant="secondary">
          <FormattedMessage
            id="markers_filter.bottom"
            defaultMessage="Bottom"
          />{" "}
          #{index + 1}
        </Badge>
        {canDelete && (
          <Button
            variant="danger"
            size="sm"
            onClick={onDelete}
            title={intl.formatMessage({ id: "actions.delete" })}
          >
            <Icon icon={faTrash} />
          </Button>
        )}
      </Card.Header>
      <Card.Body>
        {/* Target Group Selection */}
        <Form.Group className="mb-3">
          <Form.Label>
            <FormattedMessage id="target_group" defaultMessage="Target Group" />
          </Form.Label>
          <Form.Control
            as="select"
            value={filter.targetGroupId}
            onChange={onTargetGroupChange}
          >
            <option value="">
              {intl.formatMessage({
                id: "select_group",
                defaultMessage: "Select a group...",
              })}
            </option>
            {groups.map((g) => (
              <option key={g.groupId} value={g.groupId}>
                {intl.formatMessage({ id: "group", defaultMessage: "Group" })}{" "}
                {g.groupId}
                {g.tagLabels.length > 0 ? ` (${g.tagLabels.join(", ")})` : ""}
              </option>
            ))}
          </Form.Control>
        </Form.Group>

        {/* Performers */}
        <Form.Group className="mb-3">
          <Form.Label>
            <FormattedMessage id="performers" defaultMessage="Vatos" />
          </Form.Label>
          <PerformerIDSelect
            isMulti
            ids={filter.performer_ids.map((p) => p.id)}
            onSelect={onPerformersChange}
            menuPortalTarget={document.body}
          />
        </Form.Group>

        {/* Ethnicity + Country */}
        <Row className="g-2 mb-3">
          <Col md={6}>
            <Form.Label>
              <FormattedMessage
                id="performer_ethnicity"
                defaultMessage="Ethnicity"
              />
            </Form.Label>
            <Select
              classNamePrefix="react-select"
              isMulti
              isClearable
              options={ethnicityOptions}
              value={ethnicityOptions.filter((o) =>
                filter.ethnicities.includes(o.value)
              )}
              placeholder={intl.formatMessage({
                id: "any_ethnicity",
                defaultMessage: "Any ethnicity",
              })}
              onChange={onEthnicitiesChange}
              components={{ IndicatorSeparator: null }}
              menuPortalTarget={document.body}
            />
          </Col>
          <Col md={6}>
            <Form.Label>
              <FormattedMessage
                id="performer_country"
                defaultMessage="Country"
              />
            </Form.Label>
            <Select
              classNamePrefix="react-select"
              isMulti
              isClearable
              options={countryOptions}
              value={countryOptions.filter((o) =>
                filter.countries.includes(o.value)
              )}
              placeholder={intl.formatMessage({
                id: "any_country",
                defaultMessage: "Any country",
              })}
              onChange={onCountriesChange}
              menuPortalTarget={document.body}
              components={{
                IndicatorSeparator: null,
                Option: CountryOption,
                MultiValue: CountryMultiValue,
              }}
            />
          </Col>
        </Row>

        {/* Rating */}
        <Form.Group className="mb-0">
          <Form.Label>
            <FormattedMessage id="performer_rating" defaultMessage="Rating" />
          </Form.Label>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <Form.Control
              as="select"
              value={currentModifier}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                onRatingModifierChange(
                  e.target.value as unknown as CriterionModifier
                )
              }
              size="sm"
              className="w-auto"
              title={currentModDef?.title}
            >
              {ratingModifiers.map((m) => (
                <option key={m.value} value={m.value} title={m.title}>
                  {m.label}
                </option>
              ))}
            </Form.Control>
            <RatingSystem
              value={currentRating?.value}
              onSetRating={(value) => onRatingValueChange(value ?? 0)}
              valueRequired
            />
            {(currentRating?.modifier === CriterionModifier.Between ||
              currentRating?.modifier === CriterionModifier.NotBetween) && (
              <RatingSystem
                value={currentRating?.value2}
                onSetRating={(value) => onRatingValue2Change(value ?? 0)}
                valueRequired
              />
            )}
            {currentRating && (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => onRatingChange(null)}
              >
                <FormattedMessage id="actions.clear" defaultMessage="Clear" />
              </Button>
            )}
          </div>
        </Form.Group>
      </Card.Body>
    </Card>
  );
};

export const MarkerBottomFilter: React.FC<IMarkerBottomFilterProps> = ({
  criterion,
  setCriterion,
}) => {
  const { hasGroups } = useMarkerFilterGroups();

  const onAddFilter = () => {
    const c = criterion.clone() as MarkerBottomCriterion;
    c.addFilter();
    setCriterion(c);
  };

  const onUpdateFilter = (
    index: number,
    updates: Partial<IMarkerBottomFilter>
  ) => {
    const c = criterion.clone() as MarkerBottomCriterion;
    c.updateFilter(index, updates);
    setCriterion(c);
  };

  const onDeleteFilter = (index: number) => {
    const c = criterion.clone() as MarkerBottomCriterion;
    c.removeFilter(index);
    setCriterion(c);
  };

  // Auto-add first filter if empty
  React.useEffect(() => {
    if (criterion.value.filters.length === 0) {
      onAddFilter();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasGroups) {
    return (
      <div className="marker-bottom-filter text-muted">
        <p>
          <FormattedMessage
            id="add_marker_tags_first"
            defaultMessage="Add a Marker Tags filter first to enable Bottom filtering."
          />
        </p>
      </div>
    );
  }

  return (
    <div className="marker-bottom-filter">
      <div className="mb-3 text-muted">
        <FormattedMessage
          id="marker_bottom_help"
          defaultMessage="Filter markers by bottom vato attributes. Each filter targets a specific marker tag group."
        />
      </div>

      {criterion.value.filters.map((filter, index) => (
        <FilterEditor
          key={index}
          filter={filter}
          index={index}
          onUpdate={(updates) => onUpdateFilter(index, updates)}
          onDelete={() => onDeleteFilter(index)}
          canDelete={criterion.value.filters.length > 1}
        />
      ))}

      <Button
        variant="secondary"
        size="sm"
        onClick={onAddFilter}
        className="w-100"
      >
        <Icon icon={faPlus} className="me-2" />
        <FormattedMessage id="add_bottom_filter" defaultMessage="Add Bottom" />
      </Button>
    </div>
  );
};

export default MarkerBottomFilter;
