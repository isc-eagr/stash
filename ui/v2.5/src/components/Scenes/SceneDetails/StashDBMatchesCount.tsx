import React from "react";
import cx from "classnames"; // CUSTOM
import { useIntl } from "react-intl";
import { Button } from "react-bootstrap"; // CUSTOM: scene card match control
import { faFingerprint } from "@fortawesome/free-solid-svg-icons";
import { CountButton } from "src/components/Shared/CountButton";
import { HoverPopover } from "src/components/Shared/HoverPopover"; // CUSTOM
import { Icon } from "src/components/Shared/Icon";
import { getStashboxBase } from "src/utils/stashbox";
import {
  type ISceneTotalCustom,
  sceneTotalHintCustom,
} from "../sceneReleaseTotals_custom";

// The StashDB scene page's fingerprints tab, or undefined without a StashDB ID.
export function stashDBFingerprintsURLCustom(
  stashIDs: { endpoint: string; stash_id: string }[]
) {
  const stashID = stashIDs.find((s) => {
    try {
      const host = new URL(s.endpoint).hostname.toLowerCase();
      return host === "stashdb.org" || host.endsWith(".stashdb.org");
    } catch {
      return false;
    }
  });
  const base = stashID && getStashboxBase(stashID.endpoint);
  if (!stashID || !base) return undefined;
  return `${base}scenes/${stashID.stash_id}#fingerprints`;
}

// CUSTOM: StashDB Matches in the scene toolbar, linking to the StashDB
// fingerprints that produce the count. The total includes the releases'.
export const StashDBMatchesCount: React.FC<{
  total?: ISceneTotalCustom;
  stashIDs: { endpoint: string; stash_id: string }[];
}> = ({ total, stashIDs }) => {
  const intl = useIntl();
  if (!total) return null;

  const title = intl.formatMessage({ id: "stashdb_matches" });
  const url = stashDBFingerprintsURLCustom(stashIDs);
  const open = url
    ? () => window.open(url, "_blank", "noopener,noreferrer")
    : undefined;

  const hint = sceneTotalHintCustom(total);
  return (
    <span>
      <CountButton
        className={hint.className}
        value={total.total}
        icon={<Icon icon={faFingerprint} />}
        title={title}
        countTitle={title}
        valueTitle={hint.title}
        onIncrement={open}
        onValueClicked={open}
      />
    </span>
  );
};

// CUSTOM: StashDB Matches on scene cards, linking to the StashDB fingerprints.
export const StashDBMatchesCardButton: React.FC<{
  total?: ISceneTotalCustom;
  stashIDs: { endpoint: string; stash_id: string }[];
  className?: string;
}> = ({ total, stashIDs, className }) => {
  const intl = useIntl();
  if (!total) return null;

  const url = stashDBFingerprintsURLCustom(stashIDs);
  const hint = sceneTotalHintCustom(total);
  const title = intl.formatMessage({ id: "stashdb_matches" });
  return (
    <HoverPopover
      className={cx("stashdb-matches-count", className, hint.className)}
      content={hint.title ? `${title}: ${hint.title}` : title}
      placement="bottom"
    >
      <Button
        className="minimal"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icon icon={faFingerprint} />
        <span>{total.total}</span>
      </Button>
    </HoverPopover>
  );
};
