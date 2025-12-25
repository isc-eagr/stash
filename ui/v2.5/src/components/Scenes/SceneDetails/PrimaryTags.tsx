import React from "react";
import { FormattedMessage } from "react-intl";
import * as GQL from "src/core/generated-graphql";
import { Button, Badge, Card, Collapse, Form } from "react-bootstrap";
import TextUtils from "src/utils/text";
import { markerTitle } from "src/core/markers";
import { Icon } from "src/components/Shared/Icon";
import { faChevronDown, faChevronRight, faArrowUp, faArrowDown } from "@fortawesome/free-solid-svg-icons";

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
    <Card className="primary-card primary-card-tall col-12" key={id}>
      <div 
        className="primary-card-header" 
        onClick={onToggle}
        style={{ cursor: "pointer", display: "flex", alignItems: "center", padding: "0.25rem 0.5rem" }}
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
        <div style={{ flex: 1, minWidth: 0, marginRight: "0.5rem" }}>
          <h4 className="text-truncate m-0" title={tagName}>{tagName}</h4>
        </div>
        <Badge variant="info">{markers.length}</Badge>
      </div>
      <Collapse in={isOpen}>
        <Card.Body className="primary-card-body p-0">{markers}</Card.Body>
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

    const markers = markersByTag[id].map((marker, index) => {
      const tags = marker.tags.map((tag) => (
        <Badge key={tag.id} variant="secondary" className="tag-item">
          {tag.name}
        </Badge>
      ));

      const giverPerformers = marker.giver_performers?.map((performer) => (
        <Badge key={performer.id} variant="success" className="performer-item mr-1">
          <Icon icon={faArrowUp} className="mr-1" />
          {performer.name}
        </Badge>
      ));

      const receiverPerformers = marker.receiver_performers?.map((performer) => (
        <Badge key={performer.id} variant="info" className="performer-item mr-1">
          <Icon icon={faArrowDown} className="mr-1" />
          {performer.name}
        </Badge>
      ));

      return (
        <div key={marker.id} className={`marker-item p-1 ${index !== 0 ? "border-top" : ""}`}>
          <div className="d-flex align-items-start">
            <Form.Check
              className="mr-2 mt-1"
              type="checkbox"
              checked={selectedMarkerIds.has(marker.id)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onSelectMarker(marker.id, e.currentTarget.checked)
              }
            />
            <div className="flex-grow-1 min-w-0">
              <div className="d-flex align-items-center flex-wrap">
                <Button 
                  variant="link" 
                  className="p-0 text-truncate text-left mr-2" 
                  onClick={() => onClickMarker(marker)}
                  title={markerTitle(marker)}
                  style={{ maxWidth: "100%" }}
                >
                  {markerTitle(marker)}
                </Button>
                {giverPerformers && giverPerformers.length > 0 && (
                  <div className="mr-2">{giverPerformers}</div>
                )}
                {receiverPerformers && receiverPerformers.length > 0 && (
                  <div className="mr-2">{receiverPerformers}</div>
                )}
                <Button
                  variant="link"
                  className="ml-auto p-0 small text-muted"
                  style={{ fontSize: "0.85em", flexShrink: 0 }}
                  onClick={() => onEdit(marker)}
                >
                  <FormattedMessage id="actions.edit" />
                </Button>
              </div>
              <div className="d-flex align-items-center flex-wrap small text-muted">
                <span className="mr-2">
                  {TextUtils.formatTimestampRange(
                    marker.seconds,
                    marker.end_seconds ?? undefined
                  )}
                </span>
                {tags && tags.length > 0 && (
                  <div>{tags}</div>
                )}
              </div>
            </div>
          </div>
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
