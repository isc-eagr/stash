import React from "react";
import { useIntl } from "react-intl";
import { faFingerprint } from "@fortawesome/free-solid-svg-icons";
import { CountButton } from "src/components/Shared/CountButton";
import { Icon } from "src/components/Shared/Icon";
import { getStashboxBase } from "src/utils/stashbox";

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
// fingerprints that produce the count.
export const StashDBMatchesCount: React.FC<{
  value?: number | null;
  stashIDs: { endpoint: string; stash_id: string }[];
}> = ({ value, stashIDs }) => {
  const intl = useIntl();
  if (value == null) return null;

  const title = intl.formatMessage({ id: "stashdb_matches" });
  const url = stashDBFingerprintsURLCustom(stashIDs);
  const open = url
    ? () => window.open(url, "_blank", "noopener,noreferrer")
    : undefined;

  return (
    <span>
      <CountButton
        value={value}
        icon={<Icon icon={faFingerprint} />}
        title={title}
        countTitle={title}
        onIncrement={open}
        onValueClicked={open}
      />
    </span>
  );
};
