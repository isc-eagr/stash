import React from "react";
import {
  Badge,
  Button,
  Card,
  Col,
  Form,
  Row,
} from "react-bootstrap";
import Select, {
  components as selectComponents,
  OptionProps,
  MultiValueProps,
} from "react-select";
import { FormattedMessage, useIntl } from "react-intl";
import { CriterionModifier } from "src/core/generated-graphql";
import {
  SceneMarkersCriterion,
  ISceneMarkersGroup,
} from "src/models/list-filter/criteria/scene-markers";
import {
  PerformerIDSelect,
  Performer,
} from "src/components/Performers/PerformerSelect";
import { Tag, TagIDSelect } from "src/components/Tags/TagSelect";
import {
  faArrowUp,
  faArrowDown,
  faPlus,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { RatingCriterion } from "src/models/list-filter/criteria/tags";
import { getCountries } from "src/utils/country";
import { CountryFlag } from "src/components/Shared/CountryFlag";
import { usePerformerEthnicitiesQuery } from "src/core/generated-graphql";
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

interface ISceneMarkersFilterProps {
  criterion: SceneMarkersCriterion;
  setCriterion: (c: SceneMarkersCriterion) => void;
}

interface IGroupEditorProps {
  group: ISceneMarkersGroup;
  onUpdate: (updates: Partial<Omit<ISceneMarkersGroup, "groupId">>) => void;
  onDelete: () => void;
  canDelete: boolean;
}

const GroupEditor: React.FC<IGroupEditorProps> = ({
  group,
  onUpdate,
  onDelete,
  canDelete,
}) => {
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

  // Top handlers
  const onTopPerformersChange = (performers: Performer[]) => {
    onUpdate({
      top_performer_ids: performers.map((p) => ({
        id: p.id,
        label: p.name ?? p.id,
      })),
    });
  };

  const onTopEthnicitiesChange = (values: readonly { value: string }[]) => {
    onUpdate({ top_ethnicities: values.map((v) => v.value) });
  };

  const onTopCountriesChange = (values: readonly { value: string }[]) => {
    onUpdate({ top_countries: values.map((v) => v.value) });
  };

  const onTopRatingChange = (rating: RatingCriterion) => {
    onUpdate({ top_rating: rating });
  };

  // Bottom handlers
  const onBottomPerformersChange = (performers: Performer[]) => {
    onUpdate({
      bottom_performer_ids: performers.map((p) => ({
        id: p.id,
        label: p.name ?? p.id,
      })),
    });
  };

  const onBottomEthnicitiesChange = (values: readonly { value: string }[]) => {
    onUpdate({ bottom_ethnicities: values.map((v) => v.value) });
  };

  const onBottomCountriesChange = (values: readonly { value: string }[]) => {
    onUpdate({ bottom_countries: values.map((v) => v.value) });
  };

  const onBottomRatingChange = (rating: RatingCriterion) => {
    onUpdate({ bottom_rating: rating });
  };

  // Top rating helpers
  const topRating = group.top_rating;
  const topModifier = topRating?.modifier ?? CriterionModifier.Equals;

  const onTopRatingModifierChange = (m: CriterionModifier) => {
    onTopRatingChange({
      modifier: m,
      value: topRating?.value ?? 0,
      value2: topRating?.value2,
    });
  };

  const onTopRatingValueChange = (v: number) => {
    if (!topRating) {
      onTopRatingChange({ modifier: CriterionModifier.Equals, value: v });
    } else {
      onTopRatingChange({ ...topRating, value: v });
    }
  };

  const onTopRatingValue2Change = (v: number) => {
    if (!topRating) {
      onTopRatingChange({
        modifier: CriterionModifier.Between,
        value: 0,
        value2: v,
      });
    } else {
      onTopRatingChange({ ...topRating, value2: v });
    }
  };

  // Bottom rating helpers
  const bottomRating = group.bottom_rating;
  const bottomModifier = bottomRating?.modifier ?? CriterionModifier.Equals;

  const onBottomRatingModifierChange = (m: CriterionModifier) => {
    onBottomRatingChange({
      modifier: m,
      value: bottomRating?.value ?? 0,
      value2: bottomRating?.value2,
    });
  };

  const onBottomRatingValueChange = (v: number) => {
    if (!bottomRating) {
      onBottomRatingChange({ modifier: CriterionModifier.Equals, value: v });
    } else {
      onBottomRatingChange({ ...bottomRating, value: v });
    }
  };

  const onBottomRatingValue2Change = (v: number) => {
    if (!bottomRating) {
      onBottomRatingChange({
        modifier: CriterionModifier.Between,
        value: 0,
        value2: v,
      });
    } else {
      onBottomRatingChange({ ...bottomRating, value2: v });
    }
  };

  return (
    <Card className="mb-3">
      <Card.Header className="d-flex justify-content-between align-items-center py-2">
        <Badge variant="primary">
          <FormattedMessage id="marker" defaultMessage="Marker" />{" "}
          {group.groupId}
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
            id={`include-sub-tags-${group.groupId}`}
            label={intl.formatMessage({
              id: "include_sub_tags",
              defaultMessage: "Include Sub Tags",
            })}
            checked={group.depth !== 0}
            onChange={onDepthChange}
          />
        </Form.Group>

        <Row>
          {/* Top Column */}
          <Col md={6}>
            <h6 className="d-flex align-items-center mb-3">
              <Badge
                pill
                variant="success"
                className="me-2"
                style={{ fontSize: 10, padding: "3px 6px" }}
              >
                <Icon icon={faArrowUp} />
              </Badge>
              <FormattedMessage id="top_performers" defaultMessage="Top" />
            </h6>

            {/* Top Performers */}
            <Form.Group className="mb-3">
              <Form.Label>
                <FormattedMessage id="performers" defaultMessage="Performers" />
              </Form.Label>
              <PerformerIDSelect
                isMulti
                ids={group.top_performer_ids.map((p) => p.id)}
                onSelect={onTopPerformersChange}
                menuPortalTarget={document.body}
              />
            </Form.Group>

            {/* Top Ethnicity */}
            <Form.Group
              className="mb-3"
              style={{
                opacity: group.top_performer_ids.length > 0 ? 0.5 : 1,
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
                isDisabled={group.top_performer_ids.length > 0}
                options={ethnicityOptions}
                value={ethnicityOptions.filter((o) =>
                  group.top_ethnicities.includes(o.value)
                )}
                placeholder={intl.formatMessage({
                  id: "any_ethnicity",
                  defaultMessage: "Any ethnicity",
                })}
                onChange={onTopEthnicitiesChange}
                components={{ IndicatorSeparator: null }}
                menuPortalTarget={document.body}
              />
            </Form.Group>

            {/* Top Country */}
            <Form.Group
              className="mb-3"
              style={{
                opacity: group.top_performer_ids.length > 0 ? 0.5 : 1,
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
                isDisabled={group.top_performer_ids.length > 0}
                options={countryOptions}
                value={countryOptions.filter((o) =>
                  group.top_countries.includes(o.value)
                )}
                placeholder={intl.formatMessage({
                  id: "any_country",
                  defaultMessage: "Any country",
                })}
                onChange={onTopCountriesChange}
                menuPortalTarget={document.body}
                components={{
                  IndicatorSeparator: null,
                  Option: CountryOption,
                  MultiValue: CountryMultiValue,
                }}
              />
            </Form.Group>

            {/* Top Rating */}
            <Form.Group
              className="mb-3"
              style={{
                opacity: group.top_performer_ids.length > 0 ? 0.5 : 1,
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
                      variant={topModifier === m.value ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => onTopRatingModifierChange(m.value)}
                      title={m.title}
                      disabled={group.top_performer_ids.length > 0}
                    >
                      {m.label}
                    </Button>
                  ))}
                </div>
                <RatingSystem
                  value={topRating?.value}
                  onSetRating={(value) => onTopRatingValueChange(value ?? 0)}
                  valueRequired
                  disabled={group.top_performer_ids.length > 0}
                />
                {(topRating?.modifier === CriterionModifier.Between ||
                  topRating?.modifier === CriterionModifier.NotBetween) && (
                  <RatingSystem
                    value={topRating?.value2}
                    onSetRating={(value) => onTopRatingValue2Change(value ?? 0)}
                    valueRequired
                    disabled={group.top_performer_ids.length > 0}
                  />
                )}
                {topRating && (
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => onTopRatingChange(null)}
                    disabled={group.top_performer_ids.length > 0}
                  >
                    <FormattedMessage id="actions.clear" defaultMessage="Clear" />
                  </Button>
                )}
              </div>
            </Form.Group>
          </Col>

          {/* Bottom Column */}
          <Col md={6}>
            <h6 className="d-flex align-items-center mb-3">
              <Badge
                pill
                variant="info"
                className="me-2"
                style={{ fontSize: 10, padding: "3px 6px" }}
              >
                <Icon icon={faArrowDown} />
              </Badge>
              <FormattedMessage id="bottom_performers" defaultMessage="Bottom" />
            </h6>

            {/* Bottom Performers */}
            <Form.Group className="mb-3">
              <Form.Label>
                <FormattedMessage id="performers" defaultMessage="Performers" />
              </Form.Label>
              <PerformerIDSelect
                isMulti
                ids={group.bottom_performer_ids.map((p) => p.id)}
                onSelect={onBottomPerformersChange}
                menuPortalTarget={document.body}
              />
            </Form.Group>

            {/* Bottom Ethnicity */}
            <Form.Group
              className="mb-3"
              style={{
                opacity: group.bottom_performer_ids.length > 0 ? 0.5 : 1,
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
                isDisabled={group.bottom_performer_ids.length > 0}
                options={ethnicityOptions}
                value={ethnicityOptions.filter((o) =>
                  group.bottom_ethnicities.includes(o.value)
                )}
                placeholder={intl.formatMessage({
                  id: "any_ethnicity",
                  defaultMessage: "Any ethnicity",
                })}
                onChange={onBottomEthnicitiesChange}
                components={{ IndicatorSeparator: null }}
                menuPortalTarget={document.body}
              />
            </Form.Group>

            {/* Bottom Country */}
            <Form.Group
              className="mb-3"
              style={{
                opacity: group.bottom_performer_ids.length > 0 ? 0.5 : 1,
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
                isDisabled={group.bottom_performer_ids.length > 0}
                options={countryOptions}
                value={countryOptions.filter((o) =>
                  group.bottom_countries.includes(o.value)
                )}
                placeholder={intl.formatMessage({
                  id: "any_country",
                  defaultMessage: "Any country",
                })}
                onChange={onBottomCountriesChange}
                menuPortalTarget={document.body}
                components={{
                  IndicatorSeparator: null,
                  Option: CountryOption,
                  MultiValue: CountryMultiValue,
                }}
              />
            </Form.Group>

            {/* Bottom Rating */}
            <Form.Group
              className="mb-3"
              style={{
                opacity: group.bottom_performer_ids.length > 0 ? 0.5 : 1,
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
                      variant={bottomModifier === m.value ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => onBottomRatingModifierChange(m.value)}
                      title={m.title}
                      disabled={group.bottom_performer_ids.length > 0}
                    >
                      {m.label}
                    </Button>
                  ))}
                </div>
                <RatingSystem
                  value={bottomRating?.value}
                  onSetRating={(value) => onBottomRatingValueChange(value ?? 0)}
                  valueRequired
                  disabled={group.bottom_performer_ids.length > 0}
                />
                {(bottomRating?.modifier === CriterionModifier.Between ||
                  bottomRating?.modifier === CriterionModifier.NotBetween) && (
                  <RatingSystem
                    value={bottomRating?.value2}
                    onSetRating={(value) => onBottomRatingValue2Change(value ?? 0)}
                    valueRequired
                    disabled={group.bottom_performer_ids.length > 0}
                  />
                )}
                {bottomRating && (
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    disabled={group.bottom_performer_ids.length > 0}
                    onClick={() => onBottomRatingChange(null)}
                  >
                    <FormattedMessage id="actions.clear" defaultMessage="Clear" />
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

export const SceneMarkersFilter: React.FC<ISceneMarkersFilterProps> = ({
  criterion,
  setCriterion,
}) => {
  const intl = useIntl();

  const onAddGroup = () => {
    const c = criterion.clone() as SceneMarkersCriterion;
    c.addGroup();
    setCriterion(c);
  };

  const onUpdateGroup = (
    groupId: string,
    updates: Partial<Omit<ISceneMarkersGroup, "groupId">>
  ) => {
    const c = criterion.clone() as SceneMarkersCriterion;
    c.updateGroup(groupId, updates);
    setCriterion(c);
  };

  const onDeleteGroup = (groupId: string) => {
    const c = criterion.clone() as SceneMarkersCriterion;
    c.removeGroup(groupId);
    setCriterion(c);
  };

  // Auto-add first group if empty
  React.useEffect(() => {
    if (criterion.value.groups.length === 0) {
      onAddGroup();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="scene-markers-filter">
      <div className="mb-3 text-muted small">
        <FormattedMessage
          id="scene_markers_filter_help"
          defaultMessage="Find scenes with markers matching these configurations. Each marker group must match a UNIQUE marker in the scene. Use 'Includes All' for AND mode (both top AND bottom must match), 'Includes' for OR mode (either can match)."
        />
      </div>

      {criterion.value.groups.map((group) => (
        <GroupEditor
          key={group.groupId}
          group={group}
          onUpdate={(updates) => onUpdateGroup(group.groupId, updates)}
          onDelete={() => onDeleteGroup(group.groupId)}
          canDelete={criterion.value.groups.length > 1}
        />
      ))}

      <Button
        variant="secondary"
        size="sm"
        onClick={onAddGroup}
        className="w-100"
      >
        <Icon icon={faPlus} className="me-2" />
        <FormattedMessage
          id="add_marker_config"
          defaultMessage="Add Marker Configuration"
        />
      </Button>
    </div>
  );
};

export default SceneMarkersFilter;
