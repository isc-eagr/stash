import React from "react";
import { Badge, Button, ButtonGroup, Col, Form, Row } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { MarkerPerformersCriterion } from "src/models/list-filter/criteria/marker-performers";
import { PerformerIDSelect } from "src/components/Performers/PerformerSelect";
import { Tag, TagIDSelect } from "src/components/Tags/TagSelect";
import { faArrowUp, faArrowDown } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { UnnamedPerformersManager } from "./UnnamedPerformerManager";
import {
  IUnnamedPerformer,
  isUnnamedPerformerId,
} from "src/models/list-filter/criteria/unnamed-performer";

interface IMarkerPerformersFilterProps {
  criterion: MarkerPerformersCriterion;
  setCriterion: (c: MarkerPerformersCriterion) => void;
}

export const MarkerPerformersFilter: React.FC<IMarkerPerformersFilterProps> = ({
  criterion,
  setCriterion,
}) => {
  const intl = useIntl();

  // Tags handler
  const onTagsChange = (tags: Tag[]) => {
    const c = criterion.clone() as MarkerPerformersCriterion;
    c.value.tag_ids = tags.map((t) => ({
      id: t.id,
      label: t.name ?? t.id,
    }));
    setCriterion(c);
  };

  // Unnamed performers handler
  const onUnnamedPerformersChange = (performers: IUnnamedPerformer[]) => {
    const c = criterion.clone() as MarkerPerformersCriterion;
    c.value.unnamed_performers = performers;

    // Remove any unnamed performer selections that no longer exist
    const validIds = new Set(performers.map((p) => p.id));
    c.value.top_performer_ids = c.value.top_performer_ids.filter(
      (p) => !isUnnamedPerformerId(p.id) || validIds.has(p.id)
    );
    c.value.bottom_performer_ids = c.value.bottom_performer_ids.filter(
      (p) => !isUnnamedPerformerId(p.id) || validIds.has(p.id)
    );

    setCriterion(c);
  };

  return (
    <div className="marker-performers-filter">
      {/* Tags section at the top */}
      <Form.Group className="mb-3">
        <Form.Label>
          <FormattedMessage id="tags" defaultMessage="Tags" />
        </Form.Label>
        <TagIDSelect
          isMulti
          ids={criterion.value.tag_ids.map((t) => t.id)}
          onSelect={onTagsChange}
          menuPortalTarget={document.body}
        />
        <Form.Check
          type="checkbox"
          className="mt-1"
          label={intl.formatMessage({
            id: "include_sub_tags",
            defaultMessage: "Include sub-tags",
          })}
          checked={criterion.value.include_subtags}
          onChange={(e) => {
            const c = criterion.clone() as MarkerPerformersCriterion;
            c.value.include_subtags = e.currentTarget.checked;
            setCriterion(c);
          }}
        />
      </Form.Group>

      {/* Unnamed Performers Manager */}
      <UnnamedPerformersManager
        performers={criterion.value.unnamed_performers ?? []}
        onPerformersChange={onUnnamedPerformersChange}
      />

      {/* Performer Mode Toggle (AND/OR) */}
      <Form.Group className="mb-3">
        <Form.Label>
          <FormattedMessage id="mode" defaultMessage="Mode" />
        </Form.Label>
        <ButtonGroup size="sm" className="d-flex">
          <Button
            variant={
              criterion.value.performer_mode === "OR"
                ? "primary"
                : "outline-primary"
            }
            onClick={() => {
              const c = criterion.clone() as MarkerPerformersCriterion;
              c.value.performer_mode = "OR";
              setCriterion(c);
            }}
          >
            <FormattedMessage
              id="performer_mode_or"
              defaultMessage="Top OR Bottom"
            />
          </Button>
          <Button
            variant={
              criterion.value.performer_mode === "AND"
                ? "primary"
                : "outline-primary"
            }
            onClick={() => {
              const c = criterion.clone() as MarkerPerformersCriterion;
              c.value.performer_mode = "AND";
              setCriterion(c);
            }}
          >
            <FormattedMessage
              id="performer_mode_and"
              defaultMessage="Top AND Bottom"
            />
          </Button>
        </ButtonGroup>
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
              ids={criterion.value.top_performer_ids
                .filter((p) => !isUnnamedPerformerId(p.id))
                .map((p) => p.id)}
              onSelect={(performers) => {
                // Merge with any unnamed performer selections
                const unnamedIds = criterion.value.top_performer_ids.filter(
                  (p) => isUnnamedPerformerId(p.id)
                );
                const c = criterion.clone() as MarkerPerformersCriterion;
                c.value.top_performer_ids = [
                  ...unnamedIds,
                  ...performers.map((p) => ({
                    id: p.id,
                    label: p.name ?? p.id,
                  })),
                ];
                setCriterion(c);
              }}
              menuPortalTarget={document.body}
            />
            {/* Unnamed performer quick-select buttons */}
            {(criterion.value.unnamed_performers?.length ?? 0) > 0 && (
              <div className="unnamed-performer-quick-select mt-2">
                <small className="text-muted me-2">
                  <FormattedMessage
                    id="unnamed_performers"
                    defaultMessage="Unnamed:"
                  />
                </small>
                {(criterion.value.unnamed_performers ?? []).map((up) => {
                  const isSelected = criterion.value.top_performer_ids.some(
                    (p) => p.id === up.id
                  );
                  return (
                    <Button
                      key={up.id}
                      size="sm"
                      variant={isSelected ? "info" : "outline-info"}
                      className="me-1 mb-1"
                      onClick={() => {
                        const c =
                          criterion.clone() as MarkerPerformersCriterion;
                        if (isSelected) {
                          c.value.top_performer_ids =
                            c.value.top_performer_ids.filter(
                              (p) => p.id !== up.id
                            );
                        } else {
                          c.value.top_performer_ids = [
                            ...c.value.top_performer_ids,
                            { id: up.id, label: up.label },
                          ];
                        }
                        setCriterion(c);
                      }}
                    >
                      {up.label}
                    </Button>
                  );
                })}
              </div>
            )}
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
              ids={criterion.value.bottom_performer_ids
                .filter((p) => !isUnnamedPerformerId(p.id))
                .map((p) => p.id)}
              onSelect={(performers) => {
                // Merge with any unnamed performer selections
                const unnamedIds = criterion.value.bottom_performer_ids.filter(
                  (p) => isUnnamedPerformerId(p.id)
                );
                const c = criterion.clone() as MarkerPerformersCriterion;
                c.value.bottom_performer_ids = [
                  ...unnamedIds,
                  ...performers.map((p) => ({
                    id: p.id,
                    label: p.name ?? p.id,
                  })),
                ];
                setCriterion(c);
              }}
              menuPortalTarget={document.body}
            />
            {/* Unnamed performer quick-select buttons */}
            {(criterion.value.unnamed_performers?.length ?? 0) > 0 && (
              <div className="unnamed-performer-quick-select mt-2">
                <small className="text-muted me-2">
                  <FormattedMessage
                    id="unnamed_performers"
                    defaultMessage="Unnamed:"
                  />
                </small>
                {(criterion.value.unnamed_performers ?? []).map((up) => {
                  const isSelected = criterion.value.bottom_performer_ids.some(
                    (p) => p.id === up.id
                  );
                  return (
                    <Button
                      key={up.id}
                      size="sm"
                      variant={isSelected ? "info" : "outline-info"}
                      className="me-1 mb-1"
                      onClick={() => {
                        const c =
                          criterion.clone() as MarkerPerformersCriterion;
                        if (isSelected) {
                          c.value.bottom_performer_ids =
                            c.value.bottom_performer_ids.filter(
                              (p) => p.id !== up.id
                            );
                        } else {
                          c.value.bottom_performer_ids = [
                            ...c.value.bottom_performer_ids,
                            { id: up.id, label: up.label },
                          ];
                        }
                        setCriterion(c);
                      }}
                    >
                      {up.label}
                    </Button>
                  );
                })}
              </div>
            )}
          </Form.Group>
        </Col>
      </Row>
    </div>
  );
};

export default MarkerPerformersFilter;
