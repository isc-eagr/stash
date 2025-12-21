import React from "react";
import { FormattedMessage } from "react-intl";
import * as GQL from "src/core/generated-graphql";
import { Button, Badge, Card, Collapse, Form } from "react-bootstrap";
import TextUtils from "src/utils/text";
import { markerTitle } from "src/core/markers";
import { Icon } from "src/components/Shared/Icon";
import { faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";

interface IPrimaryTags {
  sceneMarkers: GQL.SceneMarkerDataFragment[];
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  onEdit: (marker: GQL.SceneMarkerDataFragment) => void;
  expandedCards: Record<string, boolean>;
  onToggleCard: (id: string) => void;
  selectedMarkerIds: Set<string>;
  onSelectMarker: (id: string, selected: boolean) => void;
  onSelectMarkers: (ids: string[], selected: boolean) => void;
}

const PrimaryCard: React.FC<{
  id: string;
  tagName: string;
  markers: JSX.Element[];
  isOpen: boolean;
  onToggle: () => void;
  selectAllChecked: boolean;
  onSelectAllChanged: (selected: boolean) => void;
}> = ({ id, tagName, markers, isOpen, onToggle, selectAllChecked, onSelectAllChanged }) => {

  return (
    <Card className="primary-card primary-card-tall col-12 col-sm-6 col-xl-6" key={id}>
      <div 
        className="primary-card-header" 
        onClick={onToggle}
        style={{ cursor: "pointer", display: "flex", alignItems: "center", padding: "1rem" }}
      >
        <Form.Check
          className="mr-2"
          type="checkbox"
          checked={selectAllChecked}
          onClick={(e) => e.stopPropagation()}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            e.stopPropagation();
            onSelectAllChanged(e.currentTarget.checked);
          }}
        />
        <Icon icon={isOpen ? faChevronDown : faChevronRight} className="mr-2" />
        <h3 style={{ margin: 0 }}>{tagName}</h3>
        <Badge variant="info" className="ml-2">{markers.length}</Badge>
      </div>
      <Collapse in={isOpen}>
        <Card.Body className="primary-card-body">{markers}</Card.Body>
      </Collapse>
    </Card>
  );
};

export const PrimaryTags: React.FC<IPrimaryTags> = ({
  sceneMarkers,
  onClickMarker,
  onEdit,
  expandedCards,
  onToggleCard,
  selectedMarkerIds,
  onSelectMarker,
  onSelectMarkers,
}) => {
  if (!sceneMarkers?.length) return <div />;

  const primaryTagNames: Record<string, string> = {};
  const markersByTag: Record<string, GQL.SceneMarkerDataFragment[]> = {};
  sceneMarkers.forEach((m) => {
    if (primaryTagNames[m.primary_tag.id]) {
      markersByTag[m.primary_tag.id].push(m);
    } else {
      primaryTagNames[m.primary_tag.id] = m.primary_tag.name;
      markersByTag[m.primary_tag.id] = [m];
    }
  });

  const primaryCards = Object.keys(markersByTag).map((id) => {
    const markerIDsForTag = markersByTag[id].map((m) => m.id);
    const allSelectedForTag =
      markerIDsForTag.length > 0 &&
      markerIDsForTag.every((mid) => selectedMarkerIds.has(mid));

    const markers = markersByTag[id].map((marker) => {
      const tags = marker.tags.map((tag) => (
        <Badge key={tag.id} variant="secondary" className="tag-item">
          {tag.name}
        </Badge>
      ));

      const performers = marker.performers?.map((performer) => (
        <Badge key={performer.id} variant="primary" className="performer-item mr-1">
          {performer.name}
        </Badge>
      ));

      return (
        <div key={marker.id}>
          <hr />
          <div className="row align-items-center">
            <Form.Check
              className="ml-3"
              type="checkbox"
              checked={selectedMarkerIds.has(marker.id)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onSelectMarker(marker.id, e.currentTarget.checked)
              }
            />
            <Button variant="link" onClick={() => onClickMarker(marker)}>
              {markerTitle(marker)}
            </Button>
            <Button
              variant="link"
              className="ml-auto"
              onClick={() => onEdit(marker)}
            >
              <FormattedMessage id="actions.edit" />
            </Button>
          </div>
          <div>
            {TextUtils.formatTimestampRange(
              marker.seconds,
              marker.end_seconds ?? undefined
            )}
          </div>
          {performers && performers.length > 0 && (
            <div className="card-section centered">{performers}</div>
          )}
          <div className="card-section centered">{tags}</div>
        </div>
      );
    });

    return (
      <PrimaryCard 
        key={id}
        id={id}
        tagName={primaryTagNames[id]}
        markers={markers}
        isOpen={expandedCards[id] || false}
        onToggle={() => onToggleCard(id)}
        selectAllChecked={allSelectedForTag}
        onSelectAllChanged={(selected) => onSelectMarkers(markerIDsForTag, selected)}
      />
    );
  });

  return <div className="primary-tag row">{primaryCards}</div>;
};
