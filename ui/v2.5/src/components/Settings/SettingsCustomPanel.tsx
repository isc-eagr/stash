import React from "react";
import { Button } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { TagIDSelect, Tag as TagOption } from "src/components/Tags/TagSelect";
import { mutateMetadataGenerate } from "src/core/StashService";
import { useToast } from "src/hooks/Toast";
import {
  defaultRatingCardTheme,
  getRatingCardThresholdsForEntity,
  normalizeRatingCardThresholds,
} from "src/utils/ratingCardStyles_custom";
import { SettingSection } from "./SettingSection";
import {
  BooleanSetting,
  NumberSetting,
  SelectSetting,
  Setting,
} from "./Inputs";
import { useSettings } from "./context";

type RoleTagKey =
  | "sexTagId"
  | "oralTagId"
  | "soloTagId"
  | "facialTagId"
  | "orgasmTagId"
  | "feetTagId"
  | "secondCameraTagId"
  | "reallyHotTagId"
  | "goatTagId";

export const SettingsCustomPanel: React.FC = () => {
  const intl = useIntl();
  const Toast = useToast();
  const { general, ui, loading, error, saveGeneral, saveUI } = useSettings();

  if (error) return <h1>{error.message}</h1>;
  if (loading) return <LoadingIndicator />;

  const sceneRatingCardThresholds = getRatingCardThresholdsForEntity(
    ui.ratingCardThresholds,
    "scene"
  );
  const performerRatingCardThresholds = getRatingCardThresholdsForEntity(
    ui.ratingCardThresholds,
    "performer"
  );

  function saveRatingCardThreshold(
    entityType: "scene" | "performer",
    key: "bronze" | "silver" | "gold" | "royalSapphire",
    value: number
  ) {
    const currentThresholds = ui.ratingCardThresholds ?? {};
    const currentEntityThresholds = normalizeRatingCardThresholds(
      entityType === "performer"
        ? currentThresholds.performer ?? currentThresholds
        : currentThresholds.scene ?? currentThresholds
    );

    saveUI({
      ratingCardThresholds: {
        ...currentThresholds,
        [entityType]: {
          ...currentEntityThresholds,
          [key]: value,
        },
      },
    });
  }

  function saveRatingCardOverrideTag(
    key: "bronzeTagId" | "silverTagId" | "goldTagId" | "royalSapphireTagId",
    items: TagOption[]
  ) {
    saveUI({
      ratingCardOverrideTagIds: {
        ...(ui.ratingCardOverrideTagIds ?? {}),
        [key]: items[0]?.id ?? undefined,
      },
    });
  }

  function saveRoleTag(key: RoleTagKey, items: TagOption[]) {
    saveUI({
      roleTagIds: {
        ...(ui.roleTagIds ?? {}),
        [key]: items[0]?.id ?? undefined,
      },
    });
  }

  async function deleteSimpleMarkerPreviews() {
    try {
      await mutateMetadataGenerate({
        deleteSimpleMarkerPreviews: true,
      });

      Toast.success(
        intl.formatMessage(
          { id: "config.tasks.added_job_to_queue" },
          { operation_name: intl.formatMessage({ id: "actions.generate" }) }
        )
      );
    } catch (e) {
      Toast.error(e);
    }
  }

  return (
    <>
      <SettingSection headingID="config.categories.custom">
        <BooleanSetting
          id="show-multi-segment-loop"
          headingID="config.ui.scene_player.options.show_multi_segment_loop_controls"
          subHeadingID="config.ui.scene_player.options.show_multi_segment_loop_controls_desc"
          checked={ui.showMultiSegmentLoopControls ?? undefined}
          onChange={(v) => saveUI({ showMultiSegmentLoopControls: v })}
        />
        <Setting
          id="delete-simple-marker-previews-task"
          headingID="dialogs.scene_gen.delete_simple_marker_previews"
          subHeadingID="dialogs.scene_gen.delete_simple_marker_previews_tooltip"
        >
          <Button
            variant="secondary"
            onClick={() => deleteSimpleMarkerPreviews()}
          >
            <FormattedMessage id="dialogs.scene_gen.delete_simple_marker_previews" />
          </Button>
        </Setting>
        <Setting
          id="simple-marker-preview-excluded-tags"
          headingID="config.ui.simple_marker_preview_excluded_tags.heading"
          subHeadingID="config.ui.simple_marker_preview_excluded_tags.description"
        >
          <TagIDSelect
            isMulti
            creatable={false}
            ids={ui.simpleMarkerPreviewExcludedTagIds ?? []}
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) =>
              saveUI({
                simpleMarkerPreviewExcludedTagIds: items.map((item) => item.id),
              })
            }
          />
        </Setting>
      </SettingSection>

      <SettingSection headingID="config.general.preview_generation">
        <BooleanSetting
          id="marker-preview-source-quality"
          headingID="config.general.marker_preview_source_quality_head"
          subHeadingID="config.general.marker_preview_source_quality_desc"
          checked={general.markerPreviewSourceQuality ?? false}
          onChange={(v) => saveGeneral({ markerPreviewSourceQuality: v })}
        />
        <BooleanSetting
          id="marker-preview-skip-quality-check"
          headingID="config.general.marker_preview_skip_quality_check_head"
          subHeadingID="config.general.marker_preview_skip_quality_check_desc"
          checked={general.markerPreviewSkipQualityCheck ?? false}
          onChange={(v) => saveGeneral({ markerPreviewSkipQualityCheck: v })}
        />
      </SettingSection>

      <SettingSection headingID="config.ui.role_tags.heading">
        <div className="setting-group">
          <div className="setting">
            <div>
              <h3>{intl.formatMessage({ id: "config.ui.role_tags.title" })}</h3>
              <div className="sub-heading">
                {intl.formatMessage({ id: "config.ui.role_tags.description" })}
              </div>
            </div>
            <div />
          </div>
        </div>

        <Setting id="role-tag-sex" headingID="config.ui.role_tags.sex">
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={ui.roleTagIds?.sexTagId ? [ui.roleTagIds.sexTagId] : []}
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) => saveRoleTag("sexTagId", items)}
          />
        </Setting>
        <Setting id="role-tag-oral" headingID="config.ui.role_tags.oral">
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={ui.roleTagIds?.oralTagId ? [ui.roleTagIds.oralTagId] : []}
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) => saveRoleTag("oralTagId", items)}
          />
        </Setting>
        <Setting id="role-tag-solo" headingID="config.ui.role_tags.solo">
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={ui.roleTagIds?.soloTagId ? [ui.roleTagIds.soloTagId] : []}
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) => saveRoleTag("soloTagId", items)}
          />
        </Setting>
        <Setting id="role-tag-facial" headingID="config.ui.role_tags.facial">
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={ui.roleTagIds?.facialTagId ? [ui.roleTagIds.facialTagId] : []}
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) => saveRoleTag("facialTagId", items)}
          />
        </Setting>
        <Setting
          id="role-tag-really-hot"
          headingID="config.ui.role_tags.really_hot"
        >
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={
              ui.roleTagIds?.reallyHotTagId
                ? [ui.roleTagIds.reallyHotTagId]
                : []
            }
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) =>
              saveRoleTag("reallyHotTagId", items)
            }
          />
        </Setting>
        <Setting id="role-tag-goat" headingID="config.ui.role_tags.goat">
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={ui.roleTagIds?.goatTagId ? [ui.roleTagIds.goatTagId] : []}
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) => saveRoleTag("goatTagId", items)}
          />
        </Setting>
        <Setting id="role-tag-orgasm" headingID="config.ui.role_tags.orgasm">
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={ui.roleTagIds?.orgasmTagId ? [ui.roleTagIds.orgasmTagId] : []}
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) => saveRoleTag("orgasmTagId", items)}
          />
        </Setting>
        <Setting id="role-tag-feet" headingID="config.ui.role_tags.feet">
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={ui.roleTagIds?.feetTagId ? [ui.roleTagIds.feetTagId] : []}
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) => saveRoleTag("feetTagId", items)}
          />
        </Setting>
        <Setting
          id="role-tag-second-camera"
          headingID="config.ui.role_tags.second_camera"
        >
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={
              ui.roleTagIds?.secondCameraTagId
                ? [ui.roleTagIds.secondCameraTagId]
                : []
            }
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) =>
              saveRoleTag("secondCameraTagId", items)
            }
          />
        </Setting>
        <Setting
          id="role-tag-o-stats-exclusions"
          headingID="config.ui.role_tags.o_stats_exclusions"
        >
          <TagIDSelect
            isMulti
            creatable={false}
            ids={ui.roleTagIds?.oStatsExcludedTagIds ?? []}
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) =>
              saveUI({
                roleTagIds: {
                  ...(ui.roleTagIds ?? {}),
                  oStatsExcludedTagIds: items.map((item) => item.id),
                },
              })
            }
          />
        </Setting>
      </SettingSection>

      <SettingSection headingID="config.ui.card_rating_styles.heading">
        <SelectSetting
          id="rating-card-theme"
          headingID="config.ui.card_rating_styles.theme.heading"
          subHeadingID="config.ui.card_rating_styles.theme.description"
          value={ui.ratingCardTheme ?? defaultRatingCardTheme}
          onChange={(v) =>
            saveUI({ ratingCardTheme: v as "premium" | "classic" })
          }
        >
          <option value="premium">
            {intl.formatMessage({
              id: "config.ui.card_rating_styles.theme.options.premium",
            })}
          </option>
          <option value="classic">
            {intl.formatMessage({
              id: "config.ui.card_rating_styles.theme.options.classic",
            })}
          </option>
        </SelectSetting>
        <Setting
          headingID="config.ui.card_rating_styles.override_tags.bronze.heading"
          subHeadingID="config.ui.card_rating_styles.override_tags.description"
        >
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={
              ui.ratingCardOverrideTagIds?.bronzeTagId
                ? [ui.ratingCardOverrideTagIds.bronzeTagId]
                : []
            }
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) =>
              saveRatingCardOverrideTag("bronzeTagId", items)
            }
          />
        </Setting>
        <Setting
          headingID="config.ui.card_rating_styles.override_tags.silver.heading"
          subHeadingID="config.ui.card_rating_styles.override_tags.description"
        >
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={
              ui.ratingCardOverrideTagIds?.silverTagId
                ? [ui.ratingCardOverrideTagIds.silverTagId]
                : []
            }
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) =>
              saveRatingCardOverrideTag("silverTagId", items)
            }
          />
        </Setting>
        <Setting
          headingID="config.ui.card_rating_styles.override_tags.gold.heading"
          subHeadingID="config.ui.card_rating_styles.override_tags.description"
        >
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={
              ui.ratingCardOverrideTagIds?.goldTagId
                ? [ui.ratingCardOverrideTagIds.goldTagId]
                : []
            }
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) =>
              saveRatingCardOverrideTag("goldTagId", items)
            }
          />
        </Setting>
        <Setting
          headingID="config.ui.card_rating_styles.override_tags.royalSapphire.heading"
          subHeadingID="config.ui.card_rating_styles.override_tags.description"
        >
          <TagIDSelect
            isMulti={false}
            creatable={false}
            ids={
              ui.ratingCardOverrideTagIds?.royalSapphireTagId
                ? [ui.ratingCardOverrideTagIds.royalSapphireTagId]
                : []
            }
            menuPortalTarget={document.body}
            onSelect={(items: TagOption[]) =>
              saveRatingCardOverrideTag("royalSapphireTagId", items)
            }
          />
        </Setting>
        <NumberSetting
          id="scene-rating-card-threshold-bronze"
          headingID="config.ui.card_rating_styles.thresholds.scene.bronze.heading"
          subHeadingID="config.ui.card_rating_styles.thresholds.description"
          value={sceneRatingCardThresholds.bronze}
          onChange={(v) => saveRatingCardThreshold("scene", "bronze", v)}
        />
        <NumberSetting
          id="scene-rating-card-threshold-silver"
          headingID="config.ui.card_rating_styles.thresholds.scene.silver.heading"
          subHeadingID="config.ui.card_rating_styles.thresholds.description"
          value={sceneRatingCardThresholds.silver}
          onChange={(v) => saveRatingCardThreshold("scene", "silver", v)}
        />
        <NumberSetting
          id="scene-rating-card-threshold-gold"
          headingID="config.ui.card_rating_styles.thresholds.scene.gold.heading"
          subHeadingID="config.ui.card_rating_styles.thresholds.description"
          value={sceneRatingCardThresholds.gold}
          onChange={(v) => saveRatingCardThreshold("scene", "gold", v)}
        />
        <NumberSetting
          id="scene-rating-card-threshold-royalSapphire"
          headingID="config.ui.card_rating_styles.thresholds.scene.royalSapphire.heading"
          subHeadingID="config.ui.card_rating_styles.thresholds.description"
          value={sceneRatingCardThresholds.royalSapphire}
          onChange={(v) => saveRatingCardThreshold("scene", "royalSapphire", v)}
        />
        <NumberSetting
          id="performer-rating-card-threshold-bronze"
          headingID="config.ui.card_rating_styles.thresholds.performer.bronze.heading"
          subHeadingID="config.ui.card_rating_styles.thresholds.description"
          value={performerRatingCardThresholds.bronze}
          onChange={(v) => saveRatingCardThreshold("performer", "bronze", v)}
        />
        <NumberSetting
          id="performer-rating-card-threshold-silver"
          headingID="config.ui.card_rating_styles.thresholds.performer.silver.heading"
          subHeadingID="config.ui.card_rating_styles.thresholds.description"
          value={performerRatingCardThresholds.silver}
          onChange={(v) => saveRatingCardThreshold("performer", "silver", v)}
        />
        <NumberSetting
          id="performer-rating-card-threshold-gold"
          headingID="config.ui.card_rating_styles.thresholds.performer.gold.heading"
          subHeadingID="config.ui.card_rating_styles.thresholds.description"
          value={performerRatingCardThresholds.gold}
          onChange={(v) => saveRatingCardThreshold("performer", "gold", v)}
        />
        <NumberSetting
          id="performer-rating-card-threshold-royalSapphire"
          headingID="config.ui.card_rating_styles.thresholds.performer.royalSapphire.heading"
          subHeadingID="config.ui.card_rating_styles.thresholds.description"
          value={performerRatingCardThresholds.royalSapphire}
          onChange={(v) =>
            saveRatingCardThreshold("performer", "royalSapphire", v)
          }
        />
      </SettingSection>
    </>
  );
};

export default SettingsCustomPanel;
