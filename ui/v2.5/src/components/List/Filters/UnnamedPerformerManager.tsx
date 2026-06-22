import React, { useState } from "react";
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
  faPlus,
  faEdit,
  faTrash,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { getCountries } from "src/utils/country";
import { CountryFlag } from "src/components/Shared/CountryFlag";
import { RatingSystem } from "src/components/Shared/Rating/RatingSystem";
import {
  IUnnamedPerformer,
  createUnnamedPerformer,
  formatUnnamedPerformerSummary,
} from "src/models/list-filter/criteria/unnamed-performer";
import {
  PerformerRatingCriteriaCriterionOption,
  RatingCriteriaCriterion,
} from "src/models/list-filter/criteria/rating-criteria_custom";
import { RatingCriteriaFilter } from "./RatingCriteriaFilter_custom";

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

interface IUnnamedPerformerEditorProps {
  performer: IUnnamedPerformer;
  onSave: (performer: IUnnamedPerformer) => void;
  onCancel: () => void;
  isNew?: boolean;
}

/**
 * Modal/inline editor for creating or editing an unnamed performer's criteria
 */
export const UnnamedPerformerEditor: React.FC<IUnnamedPerformerEditorProps> = ({
  performer,
  onSave,
  onCancel,
  isNew = false,
}) => {
  const intl = useIntl();
  const [editedPerformer, setEditedPerformer] = useState<IUnnamedPerformer>({
    ...performer,
  });

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

  const onEthnicitiesChange = (values: readonly { value: string }[]) => {
    setEditedPerformer({
      ...editedPerformer,
      ethnicities: values.map((v) => v.value),
    });
  };

  const onCountriesChange = (values: readonly { value: string }[]) => {
    setEditedPerformer({
      ...editedPerformer,
      countries: values.map((v) => v.value),
    });
  };

  const { rating } = editedPerformer;
  const ratingCriteriaCriterion = React.useMemo(() => {
    const criterion = new RatingCriteriaCriterion(
      PerformerRatingCriteriaCriterionOption
    );
    criterion.value = editedPerformer.rating_criteria ?? {
      criteria: {},
      bonuses: {},
      penalties: {},
    };
    return criterion;
  }, [editedPerformer.rating_criteria]);

  const onRatingModifierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    const newModifier = value as CriterionModifier;
    setEditedPerformer({
      ...editedPerformer,
      rating: {
        modifier: newModifier,
        value: rating?.value ?? 0,
      },
    });
  };

  const onRatingValueChange = (v: number) => {
    // Preserve the current modifier, default to EQUALS
    setEditedPerformer({
      ...editedPerformer,
      rating: {
        modifier: rating?.modifier ?? CriterionModifier.Equals,
        value: v,
      },
    });
  };

  const onClearRating = () => {
    setEditedPerformer({
      ...editedPerformer,
      rating: null,
    });
  };

  const onRatingCriteriaChange = (criterion: RatingCriteriaCriterion) => {
    setEditedPerformer({
      ...editedPerformer,
      rating_criteria: criterion.isValid() ? criterion.value : null,
    });
  };

  const handleSave = () => {
    onSave(editedPerformer);
  };

  return (
    <Card className="unnamed-performer-editor mb-3">
      <Card.Header className="d-flex align-items-center">
        <Icon icon={faUser} className="me-2" />
        <strong>{editedPerformer.label}</strong>
        <small className="ms-2 text-muted">
          <FormattedMessage
            id="unnamed_performer.define_criteria"
            defaultMessage="Define criteria (optional)"
          />
        </small>
      </Card.Header>
      <Card.Body>
        {/* Ethnicity */}
        <Form.Group className="mb-3">
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
              editedPerformer.ethnicities.includes(o.value)
            )}
            placeholder={intl.formatMessage({
              id: "any_ethnicity",
              defaultMessage: "Any ethnicity",
            })}
            onChange={onEthnicitiesChange}
            components={{ IndicatorSeparator: null }}
            menuPortalTarget={document.body}
          />
        </Form.Group>

        {/* Country */}
        <Form.Group className="mb-3">
          <Form.Label>
            <FormattedMessage id="performer_country" defaultMessage="Country" />
          </Form.Label>
          <Select
            classNamePrefix="react-select"
            isMulti
            isClearable
            options={countryOptions}
            value={countryOptions.filter((o) =>
              editedPerformer.countries.includes(o.value)
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
        </Form.Group>

        {/* Rating */}
        <Form.Group className="mb-3">
          <Form.Label className="d-flex align-items-center">
            <FormattedMessage id="performer_rating" defaultMessage="Rating" />
            {rating && (
              <Button
                variant="link"
                size="sm"
                className="ms-2 p-0"
                onClick={onClearRating}
              >
                <FormattedMessage id="actions.clear" defaultMessage="Clear" />
              </Button>
            )}
          </Form.Label>
          <Row className="g-2 align-items-center">
            <Col xs="auto">
              <Form.Control
                as="select"
                size="sm"
                value={rating?.modifier ?? CriterionModifier.Equals}
                onChange={onRatingModifierChange}
                style={{ width: "auto" }}
              >
                <option value={CriterionModifier.Equals}>=</option>
                <option value={CriterionModifier.GreaterThan}>{">"}</option>
                <option value={CriterionModifier.GreaterThanEquals}>≥</option>
                <option value={CriterionModifier.LessThan}>{"<"}</option>
                <option value={CriterionModifier.LessThanEquals}>≤</option>
              </Form.Control>
            </Col>
            <Col>
              <RatingSystem
                value={rating?.value ?? 0}
                onSetRating={(value) => onRatingValueChange(value ?? 0)}
                clickToRate
              />
            </Col>
          </Row>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>
            <FormattedMessage
              id="rating_criteria"
              defaultMessage="Vato Rating Criteria"
            />
          </Form.Label>
          <RatingCriteriaFilter
            criterion={ratingCriteriaCriterion}
            setCriterion={onRatingCriteriaChange}
          />
        </Form.Group>
      </Card.Body>
      <Card.Footer className="d-flex justify-content-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          <FormattedMessage id="actions.cancel" defaultMessage="Cancel" />
        </Button>
        <Button variant="primary" size="sm" onClick={handleSave}>
          {isNew ? (
            <FormattedMessage id="actions.add" defaultMessage="Add" />
          ) : (
            <FormattedMessage id="actions.save" defaultMessage="Save" />
          )}
        </Button>
      </Card.Footer>
    </Card>
  );
};

interface IUnnamedPerformerBadgeProps {
  performer: IUnnamedPerformer;
  onEdit: (performer: IUnnamedPerformer) => void;
  onDelete: (performer: IUnnamedPerformer) => void;
}

/**
 * Compact badge display for an unnamed performer with edit/delete actions
 */
export const UnnamedPerformerBadge: React.FC<IUnnamedPerformerBadgeProps> = ({
  performer,
  onEdit,
  onDelete,
}) => {
  return (
    <Badge
      variant="info"
      className="unnamed-performer-badge d-inline-flex align-items-center me-2 mb-2"
      style={{ fontSize: "0.85em", padding: "6px 10px" }}
    >
      <Icon icon={faUser} className="me-1" />
      <span className="me-2">
        <strong>{performer.label}:</strong>{" "}
        {formatUnnamedPerformerSummary(performer)}
      </span>
      <Button
        variant="link"
        size="sm"
        className="p-0 text-light me-1"
        onClick={() => onEdit(performer)}
        title="Edit"
      >
        <Icon icon={faEdit} />
      </Button>
      <Button
        variant="link"
        size="sm"
        className="p-0 text-light"
        onClick={() => onDelete(performer)}
        title="Delete"
      >
        <Icon icon={faTrash} />
      </Button>
    </Badge>
  );
};

interface IUnnamedPerformersManagerProps {
  performers: IUnnamedPerformer[];
  onPerformersChange: (performers: IUnnamedPerformer[]) => void;
}

/**
 * Manager component for the list of unnamed performers
 * Handles adding, editing, and removing unnamed performers
 */
export const UnnamedPerformersManager: React.FC<
  IUnnamedPerformersManagerProps
> = ({ performers, onPerformersChange }) => {
  const [editingPerformer, setEditingPerformer] =
    useState<IUnnamedPerformer | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleAddClick = () => {
    const newPerformer = createUnnamedPerformer(performers);
    setEditingPerformer(newPerformer);
    setIsCreating(true);
  };

  const handleEdit = (performer: IUnnamedPerformer) => {
    setEditingPerformer({ ...performer });
    setIsCreating(false);
  };

  const handleDelete = (performer: IUnnamedPerformer) => {
    onPerformersChange(performers.filter((p) => p.id !== performer.id));
  };

  const handleSave = (performer: IUnnamedPerformer) => {
    if (isCreating) {
      onPerformersChange([...performers, performer]);
    } else {
      onPerformersChange(
        performers.map((p) => (p.id === performer.id ? performer : p))
      );
    }
    setEditingPerformer(null);
    setIsCreating(false);
  };

  const handleCancel = () => {
    setEditingPerformer(null);
    setIsCreating(false);
  };

  return (
    <div className="unnamed-performers-manager mb-3">
      <div className="d-flex flex-wrap align-items-center mb-2">
        <Form.Label className="mb-0 me-2">
          <FormattedMessage
            id="unnamed_performers"
            defaultMessage="Unnamed Vatos"
          />
        </Form.Label>
        <Button
          variant="outline-primary"
          size="sm"
          onClick={handleAddClick}
          disabled={editingPerformer !== null}
        >
          <Icon icon={faPlus} className="me-1" />
          <FormattedMessage
            id="unnamed_performer.add"
            defaultMessage="Add Unnamed Vato"
          />
        </Button>
      </div>

      {/* List of existing unnamed performers */}
      {performers.length > 0 && !editingPerformer && (
        <div className="unnamed-performers-list mb-2">
          {performers.map((p) => (
            <UnnamedPerformerBadge
              key={p.id}
              performer={p}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Editor for creating/editing */}
      {editingPerformer && (
        <UnnamedPerformerEditor
          performer={editingPerformer}
          onSave={handleSave}
          onCancel={handleCancel}
          isNew={isCreating}
        />
      )}
    </div>
  );
};

export default UnnamedPerformersManager;
