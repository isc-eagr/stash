import {
  faFilm,
  faThumbsUp, // CUSTOM
  faImage,
  faImages,
  faPlayCircle,
  faUser,
  faVideo,
  faMapMarkerAlt,
} from "@fortawesome/free-solid-svg-icons";
import React from "react";
import { Button, OverlayTrigger, Tooltip } from "react-bootstrap";
import { FormattedNumber, useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { useConfigurationContext } from "src/hooks/Config";
import TextUtils from "src/utils/text";
import { Icon } from "./Icon";
import { SweatDrops } from "./SweatDrops"; // CUSTOM

export const Count: React.FC<{
  count: number;
}> = ({ count }) => {
  const { configuration } = useConfigurationContext();
  const abbreviateCounter = configuration?.ui.abbreviateCounters ?? false;

  if (!abbreviateCounter) {
    return <span>{count}</span>;
  }

  const formatted = TextUtils.abbreviateCounter(count);

  return (
    <span>
      <FormattedNumber
        value={formatted.size}
        maximumFractionDigits={formatted.digits}
      />
      {formatted.unit}
    </span>
  );
};

type PopoverLinkType =
  | "scene"
  | "image"
  | "gallery"
  | "marker"
  | "group"
  | "sub_group"
  | "performer"
  | "studio"
  | "o_count"; // CUSTOM
type StandardPopoverLinkType = Exclude<PopoverLinkType, "o_count">; // CUSTOM

interface IProps {
  className?: string;
  url: string;
  type: PopoverLinkType;
  count: number;
  showZero?: boolean;
  showTooltip?: boolean; // CUSTOM
}

export const PopoverCountButton: React.FC<IProps> = ({
  className,
  url,
  type,
  count,
  showZero = true,
  showTooltip = true, // CUSTOM
}) => {
  const intl = useIntl();
  const { configuration } = useConfigurationContext(); // CUSTOM

  if (!showZero && count === 0) {
    return null;
  }

  function renderIcon() {
    // CUSTOM: begin - compact O count support
    if (type === "o_count") {
      return !configuration.interface.sfwContentMode ? (
        <SweatDrops />
      ) : (
        <Icon icon={faThumbsUp} />
      );
    }
    // CUSTOM: end

    return <Icon icon={getIcon(type)} />;
  }

  // TODO - refactor - create SceneIcon, ImageIcon etc components
  function getIcon(linkType: StandardPopoverLinkType) {
    switch (linkType) {
      case "scene":
        return faPlayCircle;
      case "image":
        return faImage;
      case "gallery":
        return faImages;
      case "marker":
        return faMapMarkerAlt;
      case "group":
      case "sub_group":
        return faFilm;
      case "performer":
        return faUser;
      case "studio":
        return faVideo;
    }
  }

  function getPluralOptions() {
    switch (type) {
      case "scene":
        return {
          one: "scene",
          other: "scenes",
        };
      case "image":
        return {
          one: "image",
          other: "images",
        };
      case "gallery":
        return {
          one: "gallery",
          other: "galleries",
        };
      case "marker":
        return {
          one: "marker",
          other: "markers",
        };
      case "group":
        return {
          one: "group",
          other: "groups",
        };
      case "sub_group":
        return {
          one: "sub_group",
          other: "sub_groups",
        };
      case "performer":
        return {
          one: "performer",
          other: "performers",
        };
      case "studio":
        return {
          one: "studio",
          other: "studios",
        };
      // CUSTOM: begin - O count tooltip
      case "o_count":
        return {
          one: configuration.interface.sfwContentMode
            ? "o_count_sfw"
            : "o_count",
          other: configuration.interface.sfwContentMode
            ? "o_count_sfw"
            : "o_count",
        };
      // CUSTOM: end
    }
  }

  function getTitle() {
    const pluralCategory = intl.formatPlural(count);
    const options = getPluralOptions();
    const plural = intl.formatMessage({
      id: options[pluralCategory as "one"] || options.other,
    });
    return `${count} ${plural}`;
  }

  const link = (
    <Link className={className} to={url}>
      <Button className="minimal">
        {renderIcon()}
        <Count count={count} />
      </Button>
    </Link>
  );

  if (!showTooltip) return link; // CUSTOM

  return (
    <OverlayTrigger
      overlay={<Tooltip id={`${type}-count-tooltip`}>{getTitle()}</Tooltip>}
      placement="bottom"
    >
      {link}
    </OverlayTrigger>
  );
};
