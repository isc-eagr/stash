import React from "react";
import cx from "classnames";
import { Link } from "react-router-dom";
import spermsSvg from "src/assets/sperms.svg";
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config";
import { RoleTileContent } from "src/components/Shared/RoleTileContent_custom";
import { NutTypePips } from "src/components/Performers/PerformerDetails/NutTypePips_custom";
import { nutTypeMarkerTagsCustom } from "src/components/Performers/PerformerDetails/nutTypes_custom";
import {
  makeTopMarkersWithTagsUrlCustom,
  withStudioScope,
} from "src/utils/navigation_custom";

// CUSTOM: Studio Detail Nut tile: the studio's nuts and facials by quality,
// beside its Scene Types tiles. Feet stays on Vato Detail.
export const StudioNutTile: React.FC<{
  studio: Pick<GQL.StudioDataFragment, "id" | "name">;
  depth: number;
  counts: Pick<GQL.NutTypeCounts, "nut" | "facial">;
}> = ({ studio, depth, counts }) => {
  const { configuration } = useConfigurationContext();
  const roleTagIds = configuration?.ui?.roleTagIds;
  const scoped = (url: string) =>
    withStudioScope(url, studio.id, studio.name, depth);
  const sum = (q: GQL.NutQualityCounts) => q.plain + q.really_hot + q.goat;
  const total = sum(counts.nut) + sum(counts.facial);
  const url =
    total > 0 && roleTagIds?.orgasmTagId
      ? scoped(
          makeTopMarkersWithTagsUrlCustom(
            [],
            [{ id: roleTagIds.orgasmTagId, label: "Nut" }],
            roleTagIds.secondCameraTagId
              ? [{ id: roleTagIds.secondCameraTagId, label: "2nd Camera" }]
              : []
          )
        )
      : undefined;
  const content = (
    <RoleTileContent
      count={total}
      full
      icon={<img src={spermsSvg} alt="Nut" className="category-icon" />}
      label="Nut"
    />
  );
  return (
    <div className="performer-category-strip performer-role-badges performer-category-strip--tiles performer-category-strip--tiles-full">
      <div
        className={cx("role-badge-item orgasm-badge", {
          "role-badge-item--zero": total === 0,
        })}
      >
        <div
          className="category-icon-container"
          title={`${total} nut${total !== 1 ? "s" : ""} and facials`}
        >
          {url ? (
            <Link to={url} className="role-badge-link">
              {content}
            </Link>
          ) : (
            content
          )}
          <NutTypePips
            counts={counts}
            getUrl={(row, quality) => {
              const tags = nutTypeMarkerTagsCustom(row, quality, roleTagIds);
              return tags
                ? scoped(
                    makeTopMarkersWithTagsUrlCustom(
                      [],
                      tags.tags,
                      tags.excludeTags
                    )
                  )
                : "#";
            }}
          />
        </div>
      </div>
    </div>
  );
};
