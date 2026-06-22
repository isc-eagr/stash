import React from "react";
import { Button, Card, Col, Form, Row } from "react-bootstrap";
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
  PerformerMarkersExcludeCriterion,
  IPerformerMarkersExcludeGroup,
} from "src/models/list-filter/criteria/performer-markers-exclude";
import {
  PerformerIDSelect,
  Performer,
} from "src/components/Performers/PerformerSelect";
import { Tag, TagIDSelect } from "src/components/Tags/TagSelect";
import { RatingCriterion } from "src/models/list-filter/criteria/tags";
import { getCountries } from "src/utils/country";
import { CountryFlag } from "src/components/Shared/CountryFlag";
import { RatingSystem } from "src/components/Shared/Rating/RatingSystem";

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

interface IPerformerMarkersExcludeFilterProps {
  criterion: PerformerMarkersExcludeCriterion;
  setCriterion: (c: PerformerMarkersExcludeCriterion) => void;
}

interface IGroupEditorProps {
  group: IPerformerMarkersExcludeGroup;
  onUpdate: (updates: Partial<IPerformerMarkersExcludeGroup>) => void;
}

const GroupEditor: React.FC<IGroupEditorProps> = ({ group, onUpdate }) => {
  const intl = useIntl();

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

  // Tags handler
  const onTagsChange = (tags: Tag[]) => {
    onUpdate({
      tag_ids: tags.map((t) => ({
        id: t.id,
        label: t.name ?? t.id,
      })),
    });
  };

  const onDepthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ depth: e.target.checked ? -1 : 0 });
  };

  // Performer handlers
  const onPerformerPerformersChange = (performers: Performer[]) => {
    onUpdate({
      performer_ids: performers.map((p) => ({
        id: p.id,
        label: p.name ?? p.id,
      })),
    });
  };

  const onPerformerEthnicitiesChange = (
    values: readonly { value: string }[]
  ) => {
    onUpdate({ performer_ethnicities: values.map((v) => v.value) });
  };

  const onPerformerCountriesChange = (values: readonly { value: string }[]) => {
    onUpdate({ performer_countries: values.map((v) => v.value) });
  };

  const onPerformerRatingChange = (rating: RatingCriterion) => {
    onUpdate({ performer_rating: rating });
  };

  const onPerformerRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as "any" | "top" | "bottom";
    onUpdate({ performer_role: newRole });
  };

  // Partner handlers
  const onPartnerPerformersChange = (performers: Performer[]) => {
    onUpdate({
      partner_ids: performers.map((p) => ({
        id: p.id,
        label: p.name ?? p.id,
      })),
    });
  };

  const onPartnerEthnicitiesChange = (values: readonly { value: string }[]) => {
    onUpdate({ partner_ethnicities: values.map((v) => v.value) });
  };

  const onPartnerCountriesChange = (values: readonly { value: string }[]) => {
    onUpdate({ partner_countries: values.map((v) => v.value) });
  };

  const onPartnerRatingChange = (rating: RatingCriterion) => {
    onUpdate({ partner_rating: rating });
  };

  const onPartnerRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as "any" | "top" | "bottom";
    onUpdate({ partner_role: newRole });
  };

  // Performer rating helpers
  const performerRating = group.performer_rating;
  const performerModifier =
    performerRating?.modifier ?? CriterionModifier.Equals;

  const onPerformerRatingModifierChange = (m: CriterionModifier) => {
    onPerformerRatingChange({
      modifier: m,
      value: performerRating?.value ?? 0,
      value2: performerRating?.value2,
    });
  };

  const onPerformerRatingValueChange = (v: number) => {
    if (!performerRating) {
      onPerformerRatingChange({ modifier: CriterionModifier.Equals, value: v });
    } else {
      onPerformerRatingChange({ ...performerRating, value: v });
    }
  };

  const onPerformerRatingValue2Change = (v: number) => {
    if (!performerRating) {
      onPerformerRatingChange({
        modifier: CriterionModifier.Between,
        value: 0,
        value2: v,
      });
    } else {
      onPerformerRatingChange({ ...performerRating, value2: v });
    }
  };

  // Partner rating helpers
  const partnerRating = group.partner_rating;
  const partnerModifier = partnerRating?.modifier ?? CriterionModifier.Equals;

  const onPartnerRatingModifierChange = (m: CriterionModifier) => {
    onPartnerRatingChange({
      modifier: m,
      value: partnerRating?.value ?? 0,
      value2: partnerRating?.value2,
    });
  };

  const onPartnerRatingValueChange = (v: number) => {
    if (!partnerRating) {
      onPartnerRatingChange({ modifier: CriterionModifier.Equals, value: v });
    } else {
      onPartnerRatingChange({ ...partnerRating, value: v });
    }
  };

  const onPartnerRatingValue2Change = (v: number) => {
    if (!partnerRating) {
      onPartnerRatingChange({
        modifier: CriterionModifier.Between,
        value: 0,
        value2: v,
      });
    } else {
      onPartnerRatingChange({ ...partnerRating, value2: v });
    }
  };

  // Disable role options based on other side's selection
  const disablePerformerRoles = {
    any: group.partner_role === "top" || group.partner_role === "bottom",
    top: group.partner_role === "top",
    bottom: group.partner_role === "bottom",
  };

  const disablePartnerRoles = {
    any: group.performer_role === "top" || group.performer_role === "bottom",
    top: group.performer_role === "top",
    bottom: group.performer_role === "bottom",
  };

  return (
    <Card className="mb-3">
      <Card.Body>
        {/* Tags section at the top */}
        <Form.Group className="mb-3">
          <Form.Label>
            <FormattedMessage id="tags" defaultMessage="Tags" />
          </Form.Label>
          <TagIDSelect
            isMulti
            ids={group.tag_ids.map((t) => t.id)}
            onSelect={onTagsChange}
            menuPortalTarget={document.body}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Check
            type="checkbox"
            id="include-sub-tags"
            label={intl.formatMessage({
              id: "include_sub_tags",
              defaultMessage: "Include Sub Tags",
            })}
            checked={group.depth !== 0}
            onChange={onDepthChange}
          />
        </Form.Group>

        <Row>
          {/* Performer Column */}
          <Col md={6}>
            <h6 className="mb-3">
              <FormattedMessage id="performer" defaultMessage="Vato" />
            </h6>

            {/* Performer Performers */}
            <Form.Group className="mb-3">
              <Form.Label>
                <FormattedMessage id="performers" defaultMessage="Vatos" />
              </Form.Label>
              <PerformerIDSelect
                isMulti
                ids={group.performer_ids.map((p) => p.id)}
                onSelect={onPerformerPerformersChange}
                menuPortalTarget={document.body}
              />
            </Form.Group>

            {/* Role dropdown */}
            <Form.Group className="mb-3">
              <Form.Label>
                <FormattedMessage id="role" defaultMessage="Role" />
              </Form.Label>
              <Form.Control
                as="select"
                value={group.performer_role}
                onChange={onPerformerRoleChange}
              >
                {!disablePerformerRoles.any && <option value="any">Any</option>}
                {!disablePerformerRoles.top && <option value="top">Top</option>}
                {!disablePerformerRoles.bottom && (
                  <option value="bottom">Bottom</option>
                )}
              </Form.Control>
            </Form.Group>

            {/* Performer Ethnicity */}
            <Form.Group
              className="mb-3"
              style={{
                opacity: group.performer_ids.length > 0 ? 0.5 : 1,
              }}
            >
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
                isDisabled={group.performer_ids.length > 0}
                options={ethnicityOptions}
                value={ethnicityOptions.filter((o) =>
                  group.performer_ethnicities.includes(o.value)
                )}
                placeholder={intl.formatMessage({
                  id: "any_ethnicity",
                  defaultMessage: "Any ethnicity",
                })}
                onChange={onPerformerEthnicitiesChange}
                components={{ IndicatorSeparator: null }}
                menuPortalTarget={document.body}
              />
            </Form.Group>

            {/* Performer Country */}
            <Form.Group
              className="mb-3"
              style={{
                opacity: group.performer_ids.length > 0 ? 0.5 : 1,
              }}
            >
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
                isDisabled={group.performer_ids.length > 0}
                options={countryOptions}
                value={countryOptions.filter((o) =>
                  group.performer_countries.includes(o.value)
                )}
                placeholder={intl.formatMessage({
                  id: "any_country",
                  defaultMessage: "Any country",
                })}
                onChange={onPerformerCountriesChange}
                menuPortalTarget={document.body}
                components={{
                  IndicatorSeparator: null,
                  Option: CountryOption,
                  MultiValue: CountryMultiValue,
                }}
              />
            </Form.Group>

            {/* Performer Rating */}
            <Form.Group
              className="mb-3"
              style={{
                opacity: group.performer_ids.length > 0 ? 0.5 : 1,
              }}
            >
              <Form.Label>
                <FormattedMessage
                  id="performer_rating"
                  defaultMessage="Rating"
                />
              </Form.Label>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <div className="btn-group" role="group">
                  {ratingModifiers.map((m) => (
                    <Button
                      key={m.value}
                      variant={
                        performerModifier === m.value ? "primary" : "secondary"
                      }
                      size="sm"
                      onClick={() => onPerformerRatingModifierChange(m.value)}
                      title={m.title}
                      disabled={group.performer_ids.length > 0}
                    >
                      {m.label}
                    </Button>
                  ))}
                </div>
                <RatingSystem
                  value={performerRating?.value}
                  onSetRating={(value) =>
                    onPerformerRatingValueChange(value ?? 0)
                  }
                  valueRequired
                  disabled={group.performer_ids.length > 0}
                />
                {(performerRating?.modifier === CriterionModifier.Between ||
                  performerRating?.modifier ===
                    CriterionModifier.NotBetween) && (
                  <RatingSystem
                    value={performerRating?.value2}
                    onSetRating={(value) =>
                      onPerformerRatingValue2Change(value ?? 0)
                    }
                    valueRequired
                    disabled={group.performer_ids.length > 0}
                  />
                )}
                {performerRating && (
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => onPerformerRatingChange(null)}
                    disabled={group.performer_ids.length > 0}
                  >
                    <FormattedMessage
                      id="actions.clear"
                      defaultMessage="Clear"
                    />
                  </Button>
                )}
              </div>
            </Form.Group>
          </Col>

          {/* Partner Column */}
          <Col md={6}>
            <h6 className="mb-3">
              <FormattedMessage id="partner" defaultMessage="Partner" />
            </h6>

            {/* Partner Performers */}
            <Form.Group className="mb-3">
              <Form.Label>
                <FormattedMessage id="performers" defaultMessage="Vatos" />
              </Form.Label>
              <PerformerIDSelect
                isMulti
                ids={group.partner_ids.map((p) => p.id)}
                onSelect={onPartnerPerformersChange}
                menuPortalTarget={document.body}
              />
            </Form.Group>

            {/* Role dropdown */}
            <Form.Group className="mb-3">
              <Form.Label>
                <FormattedMessage id="role" defaultMessage="Role" />
              </Form.Label>
              <Form.Control
                as="select"
                value={group.partner_role}
                onChange={onPartnerRoleChange}
              >
                {!disablePartnerRoles.any && <option value="any">Any</option>}
                {!disablePartnerRoles.top && <option value="top">Top</option>}
                {!disablePartnerRoles.bottom && (
                  <option value="bottom">Bottom</option>
                )}
              </Form.Control>
            </Form.Group>

            {/* Partner Ethnicity */}
            <Form.Group
              className="mb-3"
              style={{
                opacity: group.partner_ids.length > 0 ? 0.5 : 1,
              }}
            >
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
                isDisabled={group.partner_ids.length > 0}
                options={ethnicityOptions}
                value={ethnicityOptions.filter((o) =>
                  group.partner_ethnicities.includes(o.value)
                )}
                placeholder={intl.formatMessage({
                  id: "any_ethnicity",
                  defaultMessage: "Any ethnicity",
                })}
                onChange={onPartnerEthnicitiesChange}
                components={{ IndicatorSeparator: null }}
                menuPortalTarget={document.body}
              />
            </Form.Group>

            {/* Partner Country */}
            <Form.Group
              className="mb-3"
              style={{
                opacity: group.partner_ids.length > 0 ? 0.5 : 1,
              }}
            >
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
                isDisabled={group.partner_ids.length > 0}
                options={countryOptions}
                value={countryOptions.filter((o) =>
                  group.partner_countries.includes(o.value)
                )}
                placeholder={intl.formatMessage({
                  id: "any_country",
                  defaultMessage: "Any country",
                })}
                onChange={onPartnerCountriesChange}
                menuPortalTarget={document.body}
                components={{
                  IndicatorSeparator: null,
                  Option: CountryOption,
                  MultiValue: CountryMultiValue,
                }}
              />
            </Form.Group>

            {/* Partner Rating */}
            <Form.Group
              className="mb-3"
              style={{
                opacity: group.partner_ids.length > 0 ? 0.5 : 1,
              }}
            >
              <Form.Label>
                <FormattedMessage
                  id="performer_rating"
                  defaultMessage="Rating"
                />
              </Form.Label>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <div className="btn-group" role="group">
                  {ratingModifiers.map((m) => (
                    <Button
                      key={m.value}
                      variant={
                        partnerModifier === m.value ? "primary" : "secondary"
                      }
                      size="sm"
                      onClick={() => onPartnerRatingModifierChange(m.value)}
                      title={m.title}
                      disabled={group.partner_ids.length > 0}
                    >
                      {m.label}
                    </Button>
                  ))}
                </div>
                <RatingSystem
                  value={partnerRating?.value}
                  onSetRating={(value) =>
                    onPartnerRatingValueChange(value ?? 0)
                  }
                  valueRequired
                  disabled={group.partner_ids.length > 0}
                />
                {(partnerRating?.modifier === CriterionModifier.Between ||
                  partnerRating?.modifier === CriterionModifier.NotBetween) && (
                  <RatingSystem
                    value={partnerRating?.value2}
                    onSetRating={(value) =>
                      onPartnerRatingValue2Change(value ?? 0)
                    }
                    valueRequired
                    disabled={group.partner_ids.length > 0}
                  />
                )}
                {partnerRating && (
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    disabled={group.partner_ids.length > 0}
                    onClick={() => onPartnerRatingChange(null)}
                  >
                    <FormattedMessage
                      id="actions.clear"
                      defaultMessage="Clear"
                    />
                  </Button>
                )}
              </div>
            </Form.Group>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

export const PerformerMarkersExcludeFilter: React.FC<
  IPerformerMarkersExcludeFilterProps
> = ({ criterion, setCriterion }) => {
  const onUpdateGroup = (updates: Partial<IPerformerMarkersExcludeGroup>) => {
    const c = criterion.clone() as PerformerMarkersExcludeCriterion;
    c.updateGroup(updates);
    setCriterion(c);
  };

  return (
    <div className="performer-markers-exclude-filter">
      <div className="mb-3 text-muted small">
        <FormattedMessage
          id="performer_markers_exclude_filter_help"
          defaultMessage="Exclude vatos with markers matching these criteria. Use 'Includes All' for AND mode (both vato AND partner must match), 'Includes' for OR mode (either can match)."
        />
      </div>

      <GroupEditor group={criterion.value.group} onUpdate={onUpdateGroup} />
    </div>
  );
};

export default PerformerMarkersExcludeFilter;
