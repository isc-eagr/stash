import React, { useCallback, useMemo, useState } from "react";
import { Badge, Button, Card, Col, Collapse, Form, Row } from "react-bootstrap";
import Select, {
  components as selectComponents,
  OptionProps,
  MultiValueProps,
} from "react-select";
import { defineMessages, useIntl } from "react-intl";
import { CriterionModifier, FilterMode , usePerformerEthnicitiesQuery } from "src/core/generated-graphql";
import {
  SceneMarkerTagsCriterion,
  SceneMarkerTagGroupUI,
  RatingCriterion,
} from "src/models/list-filter/criteria/tags";
import { Tag, TagIDSelect } from "src/components/Tags/TagSelect";
import {
  PerformerIDSelect,
  Performer,
} from "src/components/Performers/PerformerSelect";
import { getCountries } from "src/utils/country";
import { CountryFlag } from "src/components/Shared/CountryFlag";
import { RatingSystem } from "src/components/Shared/Rating/RatingSystem";
import {
  faChevronDown,
  faChevronRight,
  faArrowUp,
  faArrowDown,
  faArrowsUpDown,
} from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";

const messages = defineMessages({
  add_group: { id: "actions.add_marker", defaultMessage: "Add marker" },
  marker_label: { id: "filters.marker", defaultMessage: "Marker" },
  tags: { id: "tags", defaultMessage: "Tags" },
  performers: { id: "performers", defaultMessage: "Performers" },
  country: { id: "performer_country", defaultMessage: "Country" },
  ethnicity: { id: "performer_ethnicity", defaultMessage: "Ethnicity" },
  rating: { id: "performer_rating", defaultMessage: "Rating" },
});

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

const makeEmptyGroup = (): SceneMarkerTagGroupUI => ({
  tags: [],
  top_performer_ids: [],
  top_ethnicities: [],
  top_countries: [],
  top_rating: null,
  bottom_performer_ids: [],
  bottom_ethnicities: [],
  bottom_countries: [],
  bottom_rating: null,
  both_roles_performer_ids: [],
  both_roles_ethnicities: [],
  both_roles_countries: [],
  both_roles_rating: null,
  performer_mode: "OR",
});

// Reusable component for role-specific attribute section
interface IRoleAttributeSectionProps {
  roleKey: string;
  roleLabel: string;
  roleIcon: React.ReactNode;
  performerIds: { id: string; label?: string }[];
  ethnicities: string[];
  countries: string[];
  rating: RatingCriterion | null;
  countryOptions: { label: string; value: string }[];
  ethnicityOptions: { label: string; value: string }[];
  onPerformersChange: (performers: Performer[]) => void;
  onEthnicitiesChange: (values: string[]) => void;
  onCountriesChange: (values: string[]) => void;
  onRatingChange: (rating: RatingCriterion | null) => void;
  CountryOption: React.FC<OptionProps<{ label: string; value: string }, true>>;
  CountryMultiValue: React.FC<
    MultiValueProps<{ label: string; value: string }, true>
  >;
}

const RoleAttributeSection: React.FC<IRoleAttributeSectionProps> = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  roleKey,
  roleLabel,
  roleIcon,
  performerIds,
  ethnicities,
  countries,
  rating,
  countryOptions,
  ethnicityOptions,
  onPerformersChange,
  onEthnicitiesChange,
  onCountriesChange,
  onRatingChange,
  CountryOption,
  CountryMultiValue,
}) => {
  const intl = useIntl();

  const hasContent =
    performerIds.length > 0 ||
    ethnicities.length > 0 ||
    countries.length > 0 ||
    rating != null;

  const [isOpen, setIsOpen] = useState(hasContent);

  const currentModifier = rating?.modifier ?? CriterionModifier.Equals;
  const currentModDef = ratingModifiers.find(
    (m) => m.value === currentModifier
  );

  const onRatingModifierChange = (m: CriterionModifier) => {
    onRatingChange({
      modifier: m,
      value: rating?.value ?? 0,
      value2: rating?.value2,
    });
  };

  const onRatingValueChange = (v: number) => {
    if (!rating)
      return onRatingChange({ modifier: CriterionModifier.Equals, value: v });
    onRatingChange({ ...rating, value: v });
  };

  const onRatingValue2Change = (v: number) => {
    if (!rating)
      return onRatingChange({
        modifier: CriterionModifier.Between,
        value: 0,
        value2: v,
      });
    onRatingChange({ ...rating, value2: v });
  };

  return (
    <Card className="mb-2">
      <Card.Header
        className="py-2 d-flex align-items-center cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: "pointer" }}
      >
        <Icon icon={isOpen ? faChevronDown : faChevronRight} className="me-2" />
        {roleIcon}
        <strong className="ms-2">{roleLabel}</strong>
        {hasContent && <span className="ms-2 badge bg-primary">Active</span>}
      </Card.Header>
      <Collapse in={isOpen}>
        <Card.Body>
          {/* Performers */}
          <Form.Label className="mb-1">
            {intl.formatMessage(messages.performers)}
          </Form.Label>
          <PerformerIDSelect
            isMulti
            ids={performerIds.map((p) => p.id)}
            onSelect={onPerformersChange}
            menuPortalTarget={document.body}
          />

          {/* Ethnicity + Country */}
          <Row className="g-2 mt-2">
            <Col md={6}>
              <Form.Label className="mb-1">
                {intl.formatMessage(messages.ethnicity)}
              </Form.Label>
              <Select
                classNamePrefix="react-select"
                isMulti
                isClearable
                options={ethnicityOptions}
                value={ethnicityOptions.filter((o) =>
                  ethnicities.includes(o.value)
                )}
                placeholder="Any ethnicity"
                onChange={(val) => onEthnicitiesChange(val.map((v) => v.value))}
                components={{ IndicatorSeparator: null }}
                menuPortalTarget={document.body}
              />
            </Col>
            <Col md={6}>
              <Form.Label className="mb-1">
                {intl.formatMessage(messages.country)}
              </Form.Label>
              <Select
                classNamePrefix="react-select"
                isMulti
                isClearable
                options={countryOptions}
                value={countryOptions.filter((o) =>
                  countries.includes(o.value)
                )}
                placeholder="Any country"
                onChange={(val) => onCountriesChange(val.map((v) => v.value))}
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
          <Row className="g-2 mt-2">
            <Col md={12}>
              <Form.Label className="mb-1">
                {intl.formatMessage(messages.rating)}
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
                  aria-label={currentModDef?.title}
                >
                  {ratingModifiers.map((m) => (
                    <option
                      key={m.value}
                      value={m.value}
                      title={m.title}
                      aria-label={m.title}
                    >
                      {m.label}
                    </option>
                  ))}
                </Form.Control>
                <div>
                  <RatingSystem
                    value={rating?.value}
                    onSetRating={(value) => onRatingValueChange(value ?? 0)}
                    valueRequired
                  />
                </div>
                {(rating?.modifier === CriterionModifier.Between ||
                  rating?.modifier === CriterionModifier.NotBetween) && (
                  <div>
                    <RatingSystem
                      value={rating?.value2}
                      onSetRating={(value) => onRatingValue2Change(value ?? 0)}
                      valueRequired
                    />
                  </div>
                )}
                {rating && (
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => onRatingChange(null)}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Collapse>
    </Card>
  );
};

export const SceneMarkerTagsFilter: React.FC<{
  criterion: SceneMarkerTagsCriterion;
  setCriterion: (c: SceneMarkerTagsCriterion) => void;
  filterMode?: FilterMode;
}> = ({ criterion, setCriterion, filterMode }) => {
  const intl = useIntl();

  // Get description based on filter mode
  const filterDescription = useMemo(() => {
    if (filterMode === FilterMode.Scenes) {
      return "Filter scenes by marker activity. Each marker group can specify tags and performer criteria (top/bottom/both roles with attributes like ethnicity, country, rating).";
    }
    return null;
  }, [filterMode]);

  const addGroup = () => {
    const c = criterion.clone() as SceneMarkerTagsCriterion;
    const newGroup = makeEmptyGroup();
    c.extendedGroups = [...c.extendedGroups, newGroup];
    c.groups = [...c.groups, []];
    setCriterion(c);
  };

  const removeGroup = (idx: number) => {
    const c = criterion.clone() as SceneMarkerTagsCriterion;
    c.extendedGroups = c.extendedGroups.filter((_, i) => i !== idx);
    c.groups = c.groups.filter((_, i) => i !== idx);
    setCriterion(c);
  };

  const updateGroup = useCallback(
    (idx: number, updates: Partial<SceneMarkerTagGroupUI>) => {
      const c = criterion.clone() as SceneMarkerTagsCriterion;
      if (!c.extendedGroups[idx]) c.extendedGroups[idx] = makeEmptyGroup();
      c.extendedGroups[idx] = { ...c.extendedGroups[idx], ...updates };
      // Sync tags to groups for backwards compatibility
      if (updates.tags) {
        c.groups[idx] = updates.tags;
      }
      setCriterion(c);
    },
    [criterion, setCriterion]
  );

  const onTagsChange = useCallback(
    (idx: number, tags: Tag[]) => {
      const mapped = tags.map((t) => ({ id: t.id, label: t.name ?? t.id }));
      updateGroup(idx, { tags: mapped });
    },
    [updateGroup]
  );

  const onExcludeTagsChange = useCallback(
    (idx: number, tags: Tag[]) => {
      const mapped = tags.map((t) => ({ id: t.id, label: t.name ?? t.id }));
      updateGroup(idx, { exclude_tags: mapped });
    },
    [updateGroup]
  );

  const onDepthChange = useCallback(
    (idx: number, depth: number | undefined) => {
      updateGroup(idx, { depth });
    },
    [updateGroup]
  );

  const onPerformerModeChange = useCallback(
    (idx: number, mode: "AND" | "OR") => {
      updateGroup(idx, { performer_mode: mode });
    },
    [updateGroup]
  );

  // Country options
  const { locale } = useIntl();
  const countryOptions = useMemo(
    () => getCountries(locale) as { label: string; value: string }[],
    [locale]
  );

  // Custom option component with flag
  const CountryOption: React.FC<
    OptionProps<{ label: string; value: string }, true>
  > = (optionProps) => {
    const { data } = optionProps;
    return (
      <selectComponents.Option {...optionProps}>
        <div className="d-flex align-items-center">
          <CountryFlag country={data.value} />
          <span style={{ marginLeft: "0.5rem" }}>{data.label}</span>
        </div>
      </selectComponents.Option>
    );
  };

  const CountryMultiValue: React.FC<
    MultiValueProps<{ label: string; value: string }, true>
  > = (props) => {
    const { data } = props;
    return (
      <selectComponents.MultiValue {...props}>
        <div className="d-flex align-items-center">
          <CountryFlag country={data.value} />
          <span style={{ marginLeft: "0.25rem" }}>{data.label}</span>
        </div>
      </selectComponents.MultiValue>
    );
  };

  // Ethnicity options
  const { data: ethnicityData } = usePerformerEthnicitiesQuery();
  const ethnicityOptions = useMemo(() => {
    const list = ethnicityData?.performerEthnicities ?? [];
    return (list as string[]).map((v) => ({ label: v, value: v }));
  }, [ethnicityData]);

  const onFlatChange = useCallback(
    (tags: Tag[]) => {
      const c = criterion.clone() as SceneMarkerTagsCriterion;
      c.items = tags.map((t) => ({ id: t.id, label: t.name ?? t.id }));
      setCriterion(c);
    },
    [criterion, setCriterion]
  );

  if (
    criterion.modifier === CriterionModifier.IsNull ||
    criterion.modifier === CriterionModifier.NotNull
  ) {
    return null;
  }

  const isGrouped =
    criterion.modifier === CriterionModifier.Equals ||
    criterion.modifier === CriterionModifier.NotEquals;

  // Check if top or bottom has criteria set (for showing performer mode)
  const hasTopBottomCriteria = (group: SceneMarkerTagGroupUI) => {
    return (
      (group.top_performer_ids?.length ?? 0) > 0 ||
      (group.top_ethnicities?.length ?? 0) > 0 ||
      (group.top_countries?.length ?? 0) > 0 ||
      group.top_rating != null ||
      (group.bottom_performer_ids?.length ?? 0) > 0 ||
      (group.bottom_ethnicities?.length ?? 0) > 0 ||
      (group.bottom_countries?.length ?? 0) > 0 ||
      group.bottom_rating != null
    );
  };

  return (
    <div className="scene-marker-tags-filter">
      {filterDescription && (
        <div className="mb-2">
          <small className="text-muted">{filterDescription}</small>
        </div>
      )}
      {isGrouped ? (
        <div className="grouped-tags">
          {criterion.extendedGroups.map((group, idx) => (
            <Card
              key={idx}
              className="mb-3 marker-group-card"
              style={{
                backgroundColor: "var(--card-bg, #1e2227)",
                border: "2px solid var(--primary, #137cbd)",
              }}
            >
              <Card.Header
                className="d-flex align-items-center justify-content-between py-2"
                style={{ backgroundColor: "var(--card-header-bg, #252a30)" }}
              >
                <strong>
                  {intl.formatMessage(messages.marker_label)} {idx + 1}
                </strong>
                <Button
                  className="minimal"
                  size="sm"
                  variant="danger"
                  onClick={() => removeGroup(idx)}
                >
                  ×
                </Button>
              </Card.Header>
              <Card.Body>
                {/* Tags Section */}
                <Form.Label className="mb-1 fw-bold">
                  {intl.formatMessage(messages.tags)}
                </Form.Label>
                <TagIDSelect
                  isMulti
                  ids={(group.tags ?? []).map((t) => t.id)}
                  onSelect={(tags) => onTagsChange(idx, tags)}
                  menuPortalTarget={document.body}
                />
                <Form.Check
                  type="checkbox"
                  label="Include Sub Tags"
                  className="mt-1 mb-3"
                  checked={group.depth === -1}
                  onChange={(e) =>
                    onDepthChange(idx, e.currentTarget.checked ? -1 : undefined)
                  }
                />

                {/* Exclude Tags Section */}
                <Form.Label className="mb-1 fw-bold text-danger">
                  Exclude Tags
                </Form.Label>
                <small className="d-block mb-1 text-muted">
                  Scenes with ANY of these tags on ANY marker will be excluded
                </small>
                <TagIDSelect
                  isMulti
                  ids={(group.exclude_tags ?? []).map((t) => t.id)}
                  onSelect={(tags) => onExcludeTagsChange(idx, tags)}
                  menuPortalTarget={document.body}
                />
                <div className="mb-3" />

                {/* Top Section */}
                <RoleAttributeSection
                  roleKey="top"
                  roleLabel="Top"
                  roleIcon={
                    <Badge
                      pill
                      variant="success"
                      style={{ fontSize: 12, padding: "4px 8px" }}
                    >
                      <Icon icon={faArrowUp} />
                    </Badge>
                  }
                  performerIds={group.top_performer_ids ?? []}
                  ethnicities={group.top_ethnicities ?? []}
                  countries={group.top_countries ?? []}
                  rating={group.top_rating ?? null}
                  countryOptions={countryOptions}
                  ethnicityOptions={ethnicityOptions}
                  onPerformersChange={(performers) =>
                    updateGroup(idx, {
                      top_performer_ids: performers.map((p) => ({
                        id: p.id,
                        label: p.name ?? p.id,
                      })),
                    })
                  }
                  onEthnicitiesChange={(values) =>
                    updateGroup(idx, { top_ethnicities: values })
                  }
                  onCountriesChange={(values) =>
                    updateGroup(idx, { top_countries: values })
                  }
                  onRatingChange={(rating) =>
                    updateGroup(idx, { top_rating: rating })
                  }
                  CountryOption={CountryOption}
                  CountryMultiValue={CountryMultiValue}
                />

                {/* Bottom Section */}
                <RoleAttributeSection
                  roleKey="bottom"
                  roleLabel="Bottom"
                  roleIcon={
                    <Badge
                      pill
                      variant="info"
                      style={{ fontSize: 12, padding: "4px 8px" }}
                    >
                      <Icon icon={faArrowDown} />
                    </Badge>
                  }
                  performerIds={group.bottom_performer_ids ?? []}
                  ethnicities={group.bottom_ethnicities ?? []}
                  countries={group.bottom_countries ?? []}
                  rating={group.bottom_rating ?? null}
                  countryOptions={countryOptions}
                  ethnicityOptions={ethnicityOptions}
                  onPerformersChange={(performers) =>
                    updateGroup(idx, {
                      bottom_performer_ids: performers.map((p) => ({
                        id: p.id,
                        label: p.name ?? p.id,
                      })),
                    })
                  }
                  onEthnicitiesChange={(values) =>
                    updateGroup(idx, { bottom_ethnicities: values })
                  }
                  onCountriesChange={(values) =>
                    updateGroup(idx, { bottom_countries: values })
                  }
                  onRatingChange={(rating) =>
                    updateGroup(idx, { bottom_rating: rating })
                  }
                  CountryOption={CountryOption}
                  CountryMultiValue={CountryMultiValue}
                />

                {/* Both Roles Section */}
                <RoleAttributeSection
                  roleKey="both_roles"
                  roleLabel="Both Roles (same performer as top AND bottom)"
                  roleIcon={
                    <Badge
                      pill
                      variant="warning"
                      style={{ fontSize: 12, padding: "4px 8px" }}
                    >
                      <Icon icon={faArrowsUpDown} />
                    </Badge>
                  }
                  performerIds={group.both_roles_performer_ids ?? []}
                  ethnicities={group.both_roles_ethnicities ?? []}
                  countries={group.both_roles_countries ?? []}
                  rating={group.both_roles_rating ?? null}
                  countryOptions={countryOptions}
                  ethnicityOptions={ethnicityOptions}
                  onPerformersChange={(performers) =>
                    updateGroup(idx, {
                      both_roles_performer_ids: performers.map((p) => ({
                        id: p.id,
                        label: p.name ?? p.id,
                      })),
                    })
                  }
                  onEthnicitiesChange={(values) =>
                    updateGroup(idx, { both_roles_ethnicities: values })
                  }
                  onCountriesChange={(values) =>
                    updateGroup(idx, { both_roles_countries: values })
                  }
                  onRatingChange={(rating) =>
                    updateGroup(idx, { both_roles_rating: rating })
                  }
                  CountryOption={CountryOption}
                  CountryMultiValue={CountryMultiValue}
                />

                {/* Performer Mode: AND/OR (only if top or bottom has criteria) */}
                {hasTopBottomCriteria(group) && (
                  <div className="mt-3 p-2 border rounded">
                    <Form.Label className="mb-1 fw-bold">
                      Top/Bottom Mode
                    </Form.Label>
                    <div className="d-flex gap-3 align-items-center">
                      <Form.Check
                        inline
                        type="radio"
                        id={`mode-or-${idx}`}
                        name={`performer-mode-${idx}`}
                        label="OR (either top or bottom matches)"
                        checked={group.performer_mode !== "AND"}
                        onChange={() => onPerformerModeChange(idx, "OR")}
                      />
                      <Form.Check
                        inline
                        type="radio"
                        id={`mode-and-${idx}`}
                        name={`performer-mode-${idx}`}
                        label="AND (both top and bottom must match)"
                        checked={group.performer_mode === "AND"}
                        onChange={() => onPerformerModeChange(idx, "AND")}
                      />
                    </div>
                  </div>
                )}
              </Card.Body>
            </Card>
          ))}
          <Button className="minimal" onClick={addGroup}>
            {intl.formatMessage(messages.add_group)}
          </Button>
        </div>
      ) : (
        <div className="flat-tags">
          <TagIDSelect
            isMulti
            ids={criterion.items.map((t) => t.id)}
            onSelect={(tags) => onFlatChange(tags)}
            menuPortalTarget={document.body}
          />
        </div>
      )}
    </div>
  );
};

export default SceneMarkerTagsFilter;
