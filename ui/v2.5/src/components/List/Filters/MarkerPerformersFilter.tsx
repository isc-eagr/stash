import React from "react";
import { Badge, Form } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { CriterionModifier } from "src/core/generated-graphql";
import { MarkerPerformersCriterion, IMarkerPerformersValue } from "src/models/list-filter/criteria/marker-performers";
import { PerformerIDSelect, Performer } from "src/components/Performers/PerformerSelect";
import { faArrowUp, faArrowDown } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";

interface IMarkerPerformersFilterProps {
  criterion: MarkerPerformersCriterion;
  setCriterion: (c: MarkerPerformersCriterion) => void;
}

export const MarkerPerformersFilter: React.FC<IMarkerPerformersFilterProps> = ({
  criterion,
  setCriterion,
}) => {
  const intl = useIntl();

  const onGiversChange = (performers: Performer[]) => {
    const c = criterion.clone() as MarkerPerformersCriterion;
    c.value.giver_performer_ids = performers.map((p) => ({
      id: p.id,
      label: p.name ?? p.id,
    }));
    setCriterion(c);
  };

  const onReceiversChange = (performers: Performer[]) => {
    const c = criterion.clone() as MarkerPerformersCriterion;
    c.value.receiver_performer_ids = performers.map((p) => ({
      id: p.id,
      label: p.name ?? p.id,
    }));
    setCriterion(c);
  };

  const onModeChange = (mode: "AND" | "OR") => {
    const c = criterion.clone() as MarkerPerformersCriterion;
    c.value.mode = mode;
    setCriterion(c);
  };

  // Don't show inputs for IS_NULL/NOT_NULL modifiers
  if (
    criterion.modifier === CriterionModifier.IsNull ||
    criterion.modifier === CriterionModifier.NotNull
  ) {
    return null;
  }

  return (
    <div className="marker-performers-filter">
      <Form.Group className="mb-3">
        <Form.Label className="d-flex align-items-center">
          <Badge pill variant="success" className="me-2" style={{ fontSize: 10, padding: '3px 6px' }}><Icon icon={faArrowUp} /></Badge>
          <FormattedMessage id="giver_performers" defaultMessage="Top Performers" />
        </Form.Label>
        <PerformerIDSelect
          isMulti
          ids={criterion.value.giver_performer_ids.map((p) => p.id)}
          onSelect={onGiversChange}
          menuPortalTarget={document.body}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label className="d-flex align-items-center">
          <Badge pill variant="info" className="me-2" style={{ fontSize: 10, padding: '3px 6px' }}><Icon icon={faArrowDown} /></Badge>
          <FormattedMessage id="receiver_performers" defaultMessage="Bottom Performers" />
        </Form.Label>
        <PerformerIDSelect
          isMulti
          ids={criterion.value.receiver_performer_ids.map((p) => p.id)}
          onSelect={onReceiversChange}
          menuPortalTarget={document.body}
        />
      </Form.Group>

      <Form.Group className="mb-2">
        <Form.Label>
          <FormattedMessage id="mode" defaultMessage="Mode" />
        </Form.Label>
        <div className="d-flex gap-3">
          <Form.Check
            type="radio"
            id="mode-or"
            name="mode"
            label={intl.formatMessage({ id: "mode_or", defaultMessage: "OR (either)" })}
            checked={criterion.value.mode === "OR"}
            onChange={() => onModeChange("OR")}
          />
          <Form.Check
            type="radio"
            id="mode-and"
            name="mode"
            label={intl.formatMessage({ id: "mode_and", defaultMessage: "AND (both)" })}
            checked={criterion.value.mode === "AND"}
            onChange={() => onModeChange("AND")}
          />
        </div>
        <Form.Text className="text-muted">
          <FormattedMessage
            id="marker_performers_mode_help"
            defaultMessage="OR = matches if giver OR receiver matches. AND = matches only if BOTH giver AND receiver match."
          />
        </Form.Text>
      </Form.Group>
    </div>
  );
};

export default MarkerPerformersFilter;
