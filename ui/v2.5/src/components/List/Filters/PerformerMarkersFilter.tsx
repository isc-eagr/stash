import React, { useCallback, useMemo, useState } from "react";
import { Badge, Button, Card, Col, Collapse, Form, Row } from "react-bootstrap";
import Select, { components as selectComponents, OptionProps, MultiValueProps } from "react-select";
import { defineMessages, useIntl } from "react-intl";
import { CriterionModifier } from "src/core/generated-graphql";
import { PerformerMarkersCriterion, IPerformerMarkerCondition, makeEmptyCondition, IRatingValue } from "src/models/list-filter/criteria/performer-markers";
import { Tag, TagIDSelect } from "src/components/Tags/TagSelect";
import { getCountries } from "src/utils/country";
import { CountryFlag } from "src/components/Shared/CountryFlag";
import { usePerformerEthnicitiesQuery } from "src/core/generated-graphql";
import { RatingSystem } from "src/components/Shared/Rating/RatingSystem";
import { faChevronDown, faChevronRight, faPlus, faMinus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";

const messages = defineMessages({
  add_include: { id: "actions.add_include", defaultMessage: "Add include condition" },
  add_exclude: { id: "actions.add_exclude", defaultMessage: "Add exclude condition" },
  include_label: { id: "filters.include", defaultMessage: "Must have" },
  exclude_label: { id: "filters.exclude", defaultMessage: "Must NOT have" },
  tags: { id: "tags", defaultMessage: "Tags" },
  role: { id: "role", defaultMessage: "Role" },
  self: { id: "self", defaultMessage: "Self" },
  partner: { id: "partner", defaultMessage: "Partner" },
  country: { id: "performer_country", defaultMessage: "Country" },
  ethnicity: { id: "performer_ethnicity", defaultMessage: "Ethnicity" },
  rating: { id: "performer_rating", defaultMessage: "Rating" },
});

const ratingModifiers: { value: CriterionModifier; label: string; title: string }[] = [
  { value: CriterionModifier.Equals, label: "=", title: "Equals" },
  { value: CriterionModifier.NotEquals, label: "≠", title: "Not equals" },
  { value: CriterionModifier.GreaterThan, label: ">", title: "Greater than" },
  { value: CriterionModifier.LessThan, label: "<", title: "Less than" },
];

interface ConditionEditorProps {
  condition: IPerformerMarkerCondition;
  onChange: (condition: IPerformerMarkerCondition) => void;
  onRemove: () => void;
  countryOptions: { label: string; value: string }[];
  ethnicityOptions: { label: string; value: string }[];
  CountryOption: React.FC<OptionProps<{ label: string; value: string }, true>>;
  CountryMultiValue: React.FC<MultiValueProps<{ label: string; value: string }, true>>;
  isInclude: boolean;
}

const ConditionEditor: React.FC<ConditionEditorProps> = ({
  condition,
  onChange,
  onRemove,
  countryOptions,
  ethnicityOptions,
  CountryOption,
  CountryMultiValue,
  isInclude,
}) => {
  const intl = useIntl();
  const [showSelf, setShowSelf] = useState(
    condition.self_ethnicities.length > 0 ||
    condition.self_countries.length > 0 ||
    condition.self_rating != null
  );
  const [showPartner, setShowPartner] = useState(
    condition.partner_ethnicities.length > 0 ||
    condition.partner_countries.length > 0 ||
    condition.partner_rating != null
  );

  const onTagsChange = useCallback((tags: Tag[]) => {
    onChange({
      ...condition,
      tags: tags.map((t) => ({ id: t.id, label: t.name ?? "" })),
    });
  }, [condition, onChange]);

  const onRoleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...condition,
      role: e.target.value as "giver" | "receiver" | "any",
    });
  }, [condition, onChange]);

  // Self rating
  const currentSelfRatingModifier = condition.self_rating?.modifier ?? CriterionModifier.GreaterThan;
  const currentSelfRatingModDef = ratingModifiers.find((m) => m.value === currentSelfRatingModifier);

  const onSelfRatingModifierChange = (m: CriterionModifier) => {
    const current: IRatingValue = condition.self_rating ?? { modifier: m, value: 0 };
    onChange({
      ...condition,
      self_rating: { ...current, modifier: m },
    });
  };

  const onSelfRatingChange = (value: number | null) => {
    const current: IRatingValue = condition.self_rating ?? { modifier: CriterionModifier.GreaterThan, value: 0 };
    onChange({
      ...condition,
      self_rating: value && value > 0 ? { ...current, value } : null,
    });
  };

  // Partner rating
  const currentRatingModifier = condition.partner_rating?.modifier ?? CriterionModifier.GreaterThan;
  const currentRatingModDef = ratingModifiers.find((m) => m.value === currentRatingModifier);

  const onPartnerRatingModifierChange = (m: CriterionModifier) => {
    const current: IRatingValue = condition.partner_rating ?? { modifier: m, value: 0 };
    onChange({
      ...condition,
      partner_rating: { ...current, modifier: m },
    });
  };

  const onPartnerRatingChange = (value: number | null) => {
    const current: IRatingValue = condition.partner_rating ?? { modifier: CriterionModifier.GreaterThan, value: 0 };
    onChange({
      ...condition,
      partner_rating: value && value > 0 ? { ...current, value } : null,
    });
  };

  return (
    <Card className={`mb-2 border-${isInclude ? "success" : "danger"}`}>
      <Card.Body className="p-2">
        <Row className="align-items-center mb-2">
          <Col xs="auto">
            <Badge pill variant={isInclude ? "success" : "danger"}>
              {isInclude ? <Icon icon={faPlus} /> : <Icon icon={faMinus} />}
            </Badge>
          </Col>
          <Col>
            <strong>{isInclude ? intl.formatMessage(messages.include_label) : intl.formatMessage(messages.exclude_label)}</strong>
          </Col>
          <Col xs="auto">
            <Button variant="outline-danger" size="sm" onClick={onRemove}>
              <Icon icon={faTrash} />
            </Button>
          </Col>
        </Row>

        {/* Tags */}
        <Form.Group className="mb-2">
          <Form.Label className="small mb-1">{intl.formatMessage(messages.tags)}</Form.Label>
          <TagIDSelect
            ids={condition.tags.map((t) => t.id)}
            onSelect={onTagsChange}
            isMulti
            isClearable={false}
          />
        </Form.Group>

        {/* Role */}
        <Form.Group className="mb-2">
          <Form.Label className="small mb-1">{intl.formatMessage(messages.role)}</Form.Label>
          <Form.Control
            as="select"
            value={condition.role}
            onChange={onRoleChange}
            className="form-control input-control"
          >
            <option value="any">Any role</option>
            <option value="giver">Top (giver)</option>
            <option value="receiver">Bottom (receiver)</option>
          </Form.Control>
        </Form.Group>

        {/* Self attributes toggle */}
        <Button
          variant="link"
          className="p-0 mb-2"
          onClick={() => setShowSelf(!showSelf)}
        >
          <Icon icon={showSelf ? faChevronDown : faChevronRight} className="me-1" />
          {intl.formatMessage(messages.self)} attributes (this performer)
        </Button>

        <Collapse in={showSelf}>
          <div className="ps-3 border-start">
            {/* Self Ethnicity */}
            <Form.Group className="mb-2">
              <Form.Label className="small mb-1">{intl.formatMessage(messages.ethnicity)}</Form.Label>
              <Select
                isMulti
                classNamePrefix="react-select"
                options={ethnicityOptions}
                value={ethnicityOptions.filter((o) => condition.self_ethnicities.includes(o.value))}
                onChange={(selected) =>
                  onChange({
                    ...condition,
                    self_ethnicities: selected ? selected.map((o) => o.value) : [],
                  })
                }
                placeholder="Any ethnicity"
              />
            </Form.Group>

            {/* Self Country */}
            <Form.Group className="mb-2">
              <Form.Label className="small mb-1">{intl.formatMessage(messages.country)}</Form.Label>
              <Select
                isMulti
                classNamePrefix="react-select"
                options={countryOptions}
                components={{ Option: CountryOption, MultiValue: CountryMultiValue }}
                value={countryOptions.filter((o) => condition.self_countries.includes(o.value))}
                onChange={(selected) =>
                  onChange({
                    ...condition,
                    self_countries: selected ? selected.map((o) => o.value) : [],
                  })
                }
                placeholder="Any country"
              />
            </Form.Group>

            {/* Self Rating */}
            <Form.Group className="mb-2">
              <Form.Label className="small mb-1">{intl.formatMessage(messages.rating)}</Form.Label>
              <div className="d-flex align-items-center gap-2">
                <Form.Control
                  as="select"
                  className="form-control input-control w-auto"
                  value={currentSelfRatingModifier}
                  onChange={(e) => onSelfRatingModifierChange(e.target.value as CriterionModifier)}
                  title={currentSelfRatingModDef?.title}
                >
                  {ratingModifiers.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </Form.Control>
                <RatingSystem
                  value={condition.self_rating?.value ?? 0}
                  onSetRating={onSelfRatingChange}
                />
              </div>
            </Form.Group>
          </div>
        </Collapse>

        {/* Partner toggle */}
        <Button
          variant="link"
          className="p-0 mb-2"
          onClick={() => setShowPartner(!showPartner)}
        >
          <Icon icon={showPartner ? faChevronDown : faChevronRight} className="me-1" />
          {intl.formatMessage(messages.partner)} attributes
        </Button>

        <Collapse in={showPartner}>
          <div className="ps-3 border-start">
            {/* Partner Ethnicity */}
            <Form.Group className="mb-2">
              <Form.Label className="small mb-1">{intl.formatMessage(messages.ethnicity)}</Form.Label>
              <Select
                isMulti
                classNamePrefix="react-select"
                options={ethnicityOptions}
                value={ethnicityOptions.filter((o) => condition.partner_ethnicities.includes(o.value))}
                onChange={(selected) =>
                  onChange({
                    ...condition,
                    partner_ethnicities: selected ? selected.map((o) => o.value) : [],
                  })
                }
                placeholder="Any ethnicity"
              />
            </Form.Group>

            {/* Partner Country */}
            <Form.Group className="mb-2">
              <Form.Label className="small mb-1">{intl.formatMessage(messages.country)}</Form.Label>
              <Select
                isMulti
                classNamePrefix="react-select"
                options={countryOptions}
                components={{ Option: CountryOption, MultiValue: CountryMultiValue }}
                value={countryOptions.filter((o) => condition.partner_countries.includes(o.value))}
                onChange={(selected) =>
                  onChange({
                    ...condition,
                    partner_countries: selected ? selected.map((o) => o.value) : [],
                  })
                }
                placeholder="Any country"
              />
            </Form.Group>

            {/* Partner Rating */}
            <Form.Group className="mb-2">
              <Form.Label className="small mb-1">{intl.formatMessage(messages.rating)}</Form.Label>
              <div className="d-flex align-items-center gap-2">
                <Form.Control
                  as="select"
                  className="form-control input-control w-auto"
                  value={currentRatingModifier}
                  onChange={(e) => onPartnerRatingModifierChange(e.target.value as CriterionModifier)}
                  title={currentRatingModDef?.title}
                >
                  {ratingModifiers.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </Form.Control>
                <RatingSystem
                  value={condition.partner_rating?.value ?? 0}
                  onSetRating={onPartnerRatingChange}
                />
              </div>
            </Form.Group>
          </div>
        </Collapse>
      </Card.Body>
    </Card>
  );
};

interface PerformerMarkersFilterProps {
  criterion: PerformerMarkersCriterion;
  setCriterion: (c: PerformerMarkersCriterion) => void;
}

export const PerformerMarkersFilter: React.FC<PerformerMarkersFilterProps> = ({
  criterion,
  setCriterion,
}) => {
  const intl = useIntl();

  // Get ethnicity options from existing performers
  const { data: ethnicitiesData } = usePerformerEthnicitiesQuery();
  const ethnicityOptions = useMemo(() => {
    const ethnicities = ethnicitiesData?.performerEthnicities || [];
    return ethnicities
      .filter((e) => e && e.trim())
      .map((e) => ({ label: e!, value: e! }));
  }, [ethnicitiesData]);

  // Get country options
  const countryOptions = useMemo(() => {
    const countries = getCountries();
    return countries.map((c) => ({ label: c.label, value: c.value }));
  }, []);

  // Country select components with flags
  const CountryOption: React.FC<OptionProps<{ label: string; value: string }, true>> = (props) => (
    <selectComponents.Option {...props}>
      <CountryFlag country={props.data.value} className="me-2" />
      {props.data.label}
    </selectComponents.Option>
  );

  const CountryMultiValue: React.FC<MultiValueProps<{ label: string; value: string }, true>> = (props) => (
    <selectComponents.MultiValue {...props}>
      <CountryFlag country={props.data.value} className="me-1" />
      {props.data.label}
    </selectComponents.MultiValue>
  );

  const updateIncludeCondition = useCallback((index: number, condition: IPerformerMarkerCondition) => {
    const newC = criterion.clone() as PerformerMarkersCriterion;
    newC.value.include[index] = condition;
    setCriterion(newC);
  }, [criterion, setCriterion]);

  const updateExcludeCondition = useCallback((index: number, condition: IPerformerMarkerCondition) => {
    const newC = criterion.clone() as PerformerMarkersCriterion;
    newC.value.exclude[index] = condition;
    setCriterion(newC);
  }, [criterion, setCriterion]);

  const addIncludeCondition = useCallback(() => {
    const newC = criterion.clone() as PerformerMarkersCriterion;
    newC.value.include.push(makeEmptyCondition());
    setCriterion(newC);
  }, [criterion, setCriterion]);

  const addExcludeCondition = useCallback(() => {
    const newC = criterion.clone() as PerformerMarkersCriterion;
    newC.value.exclude.push(makeEmptyCondition());
    setCriterion(newC);
  }, [criterion, setCriterion]);

  const removeIncludeCondition = useCallback((index: number) => {
    const newC = criterion.clone() as PerformerMarkersCriterion;
    newC.value.include.splice(index, 1);
    setCriterion(newC);
  }, [criterion, setCriterion]);

  const removeExcludeCondition = useCallback((index: number) => {
    const newC = criterion.clone() as PerformerMarkersCriterion;
    newC.value.exclude.splice(index, 1);
    setCriterion(newC);
  }, [criterion, setCriterion]);

  return (
    <div className="performer-markers-filter">
      {/* Include conditions */}
      <div className="mb-3">
        {criterion.value.include.map((condition, index) => (
          <ConditionEditor
            key={`include-${index}`}
            condition={condition}
            onChange={(c) => updateIncludeCondition(index, c)}
            onRemove={() => removeIncludeCondition(index)}
            countryOptions={countryOptions}
            ethnicityOptions={ethnicityOptions}
            CountryOption={CountryOption}
            CountryMultiValue={CountryMultiValue}
            isInclude={true}
          />
        ))}
        <Button variant="outline-success" size="sm" onClick={addIncludeCondition}>
          <Icon icon={faPlus} className="me-1" />
          {intl.formatMessage(messages.add_include)}
        </Button>
      </div>

      {/* Exclude conditions */}
      <div>
        {criterion.value.exclude.map((condition, index) => (
          <ConditionEditor
            key={`exclude-${index}`}
            condition={condition}
            onChange={(c) => updateExcludeCondition(index, c)}
            onRemove={() => removeExcludeCondition(index)}
            countryOptions={countryOptions}
            ethnicityOptions={ethnicityOptions}
            CountryOption={CountryOption}
            CountryMultiValue={CountryMultiValue}
            isInclude={false}
          />
        ))}
        <Button variant="outline-danger" size="sm" onClick={addExcludeCondition}>
          <Icon icon={faMinus} className="me-1" />
          {intl.formatMessage(messages.add_exclude)}
        </Button>
      </div>
    </div>
  );
};
