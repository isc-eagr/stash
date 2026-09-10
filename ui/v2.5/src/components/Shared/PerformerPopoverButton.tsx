import { faUser } from "@fortawesome/free-solid-svg-icons";
import React from "react";
import { Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import * as GQL from "src/core/generated-graphql";
import { sortPerformers } from "src/core/performers";
import { HoverPopover } from "./HoverPopover";
import { Icon } from "./Icon";
import { PerformerLink, PerformerLinkType } from "./TagLink";
import cx from "classnames"; // CUSTOM

interface IProps {
  performers: Pick<
    GQL.Performer,
    "id" | "name" | "image_path" | "disambiguation" | "gender"
  >[];
  linkType?: PerformerLinkType;
  className?: string; // CUSTOM
}

export const PerformerPopoverContent: React.FC<
  Pick<IProps, "performers" | "linkType">
> = ({ performers, linkType }) => {
  const sorted = sortPerformers(performers);

  return (
    <div className="performer-hover-grid">
      {sorted.map((performer) => (
        <div
          className="performer-tag-container performer-hover-row"
          key={performer.id}
        >
          <Link
            to={`/performers/${performer.id}`}
            className="performer-tag performer-hover-image-link zoom-2"
          >
            <img
              className="image-thumbnail performer-hover-image-thumbnail"
              alt={performer.name ?? ""}
              src={performer.image_path ?? ""}
            />
          </Link>
          <PerformerLink
            key={performer.id}
            performer={performer}
            className="d-block"
            linkType={linkType}
          />
        </div>
      ))}
    </div>
  );
};

export const PerformerPopoverButton: React.FC<IProps> = ({
  performers,
  linkType,
  className, // CUSTOM
}) => {
  const popoverContent = (
    <PerformerPopoverContent performers={performers} linkType={linkType} />
  ); // CUSTOM

  return (
    <HoverPopover
      className={cx("performer-count", className)} // CUSTOM
      placement="bottom"
      content={popoverContent}
    >
      <Button className="minimal">
        <Icon icon={faUser} />
        <span>{performers.length}</span>
      </Button>
    </HoverPopover>
  );
};
