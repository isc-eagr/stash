import React, {
  PropsWithChildren,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
} from "react";
import { Badge, BadgeProps, Button, Overlay, Popover } from "react-bootstrap";
import {
  Criterion,
  UnsupportedCriterion,
  ModifierCriterion, // CUSTOM
} from "src/models/list-filter/criteria/criterion";
import { FormattedMessage, useIntl } from "react-intl";
import { Icon } from "../Shared/Icon";
import {
  faExclamationTriangle,
  faMagnifyingGlass,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { BsPrefixProps, ReplaceProps } from "react-bootstrap/esm/helpers";
import { CustomFieldsCriterion } from "src/models/list-filter/criteria/custom-fields";
import { useDebounce } from "src/hooks/debounce";
import cx from "classnames";
// CUSTOM: begin - marker criterion imports
import { SceneMarkerTagsCriterion } from "src/models/list-filter/criteria/tags";
import { MarkerTagsCriterion } from "src/models/list-filter/criteria/marker-tags";
import { MarkerTopCriterion } from "src/models/list-filter/criteria/marker-top";
import { MarkerBottomCriterion } from "src/models/list-filter/criteria/marker-bottom";
import { ExcludeMarkerTagsCriterion } from "src/models/list-filter/criteria/exclude-marker-tags";
import {
  CriterionModifier,
  useFindTagsForSelectQuery,
  useFindPerformersForSelectQuery,
} from "src/core/generated-graphql";
// CUSTOM: end
import { useConfigurationContext } from "src/hooks/Config";

type TagItemProps = PropsWithChildren<
  ReplaceProps<"span", BsPrefixProps<"span"> & BadgeProps>
>;

export const TagItem: React.FC<TagItemProps> = (props) => {
  const { className, children, ...others } = props;
  return (
    <Badge
      className={cx("tag-item", className)}
      variant="secondary"
      {...others}
    >
      {children}
    </Badge>
  );
};

export const FilterTag: React.FC<{
  className?: string;
  label: React.ReactNode;
  onClick: React.MouseEventHandler<HTMLSpanElement>;
  onRemove: React.MouseEventHandler<HTMLElement>;
  unsupported?: boolean;
}> = ({ className, label, onClick, onRemove, unsupported }) => {
  function handleClick(e: React.MouseEvent<HTMLSpanElement, MouseEvent>) {
    if (unsupported) {
      return;
    }
    onClick(e);
  }

  return (
    <TagItem className={cx(className, { unsupported })} onClick={handleClick}>
      {unsupported && (
        <Icon icon={faExclamationTriangle} className="unsupported-icon" />
      )}
      {label}
      <Button
        variant="secondary"
        onClick={(e) => {
          onRemove(e);
          e.stopPropagation();
        }}
      >
        <Icon icon={faTimes} />
      </Button>
    </TagItem>
  );
};

const MoreFilterTags: React.FC<{
  tags: React.ReactNode[];
}> = ({ tags }) => {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const target = useRef(null);

  if (!tags.length) {
    return null;
  }

  function handleMouseEnter() {
    setShowTooltip(true);
  }

  function handleMouseLeave() {
    setShowTooltip(false);
  }

  return (
    <>
      <Overlay target={target.current} placement="bottom" show={showTooltip}>
        <Popover
          id="more-criteria-popover"
          className="hover-popover-content"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleMouseLeave}
        >
          {tags}
        </Popover>
      </Overlay>
      <Badge
        ref={target}
        className={"tag-item more-tags"}
        variant="secondary"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <FormattedMessage
          id="search_filter.more_filter_criteria"
          values={{ count: tags.length }}
        />
      </Badge>
    </>
  );
};

interface IFilterTagsProps {
  searchTerm?: string;
  criteria: Criterion[];
  onEditSearchTerm?: () => void;
  onEditCriterion: (c: Criterion) => void;
  onRemoveCriterion: (c: Criterion, valueIndex?: number) => void;
  onRemoveAll: () => void;
  onRemoveSearchTerm?: () => void;
  truncateOnOverflow?: boolean;
}

// CUSTOM: begin - chip label components for custom marker criteria
const SceneMarkerTagsChipLabel: React.FC<{
  criterion: SceneMarkerTagsCriterion;
}> = ({ criterion }) => {
  const intl = useIntl();
  // Gather unresolved tag ids (labels equal to ids)
  const unresolvedTagIds = React.useMemo(() => {
    const ids = new Set<string>();
    if (
      criterion.modifier === CriterionModifier.Equals ||
      criterion.modifier === CriterionModifier.NotEquals
    ) {
      // Check extendedGroups for tags
      criterion.extendedGroups.forEach((g) =>
        (g.tags ?? []).forEach((t) => {
          if (t.label === t.id) ids.add(t.id);
        })
      );
      // Also check simple groups for backwards compatibility
      criterion.groups.forEach((g) =>
        g.forEach((t) => {
          if (t.label === t.id) ids.add(t.id);
        })
      );
    } else {
      criterion.items.forEach((t) => {
        if (t.label === t.id) ids.add(t.id);
      });
    }
    return Array.from(ids);
  }, [criterion]);

  // Gather unresolved performer ids (from both top and bottom fields)
  const unresolvedPerformerIds = React.useMemo(() => {
    const ids = new Set<string>();
    if (
      criterion.modifier === CriterionModifier.Equals ||
      criterion.modifier === CriterionModifier.NotEquals
    ) {
      criterion.extendedGroups.forEach((g) => {
        (g.top_performer_ids ?? []).forEach(
          (p: { id: string; label: string }) => {
            if (p.label === p.id) ids.add(p.id);
          }
        );
        (g.bottom_performer_ids ?? []).forEach(
          (p: { id: string; label: string }) => {
            if (p.label === p.id) ids.add(p.id);
          }
        );
      });
    }
    return Array.from(ids);
  }, [criterion]);

  const { data: tagData } = useFindTagsForSelectQuery({
    variables: unresolvedTagIds.length
      ? { ids: unresolvedTagIds, filter: { per_page: unresolvedTagIds.length } }
      : { ids: [] },
    skip: unresolvedTagIds.length === 0,
  } as any);

  const { data: performerData } = useFindPerformersForSelectQuery({
    variables: unresolvedPerformerIds.length
      ? {
          ids: unresolvedPerformerIds,
          filter: { per_page: unresolvedPerformerIds.length },
        }
      : { ids: [] },
    skip: unresolvedPerformerIds.length === 0,
  } as any);

  const tagNameMap = React.useMemo(() => {
    const m = new Map<string, string>();
    (tagData?.findTags?.tags ?? []).forEach((t) => m.set(t.id, t.name));
    return m;
  }, [tagData]);

  const performerNameMap = React.useMemo(() => {
    const m = new Map<string, string>();
    (performerData?.findPerformers?.performers ?? []).forEach((p) =>
      m.set(p.id, p.name ?? p.id)
    );
    return m;
  }, [performerData]);

  const criterionLabel = intl.formatMessage({
    id: (criterion as any).criterionOption.messageID,
  });
  const modifierString = ModifierCriterion.getModifierLabel(
    intl,
    criterion.modifier as unknown as CriterionModifier
  );

  // Check if any extendedGroup has extra attributes
  const hasExtendedAttrs = criterion.extendedGroups.some(
    (g) =>
      (g.top_performer_ids?.length ?? 0) > 0 ||
      (g.bottom_performer_ids?.length ?? 0) > 0 ||
      (g.both_roles_performer_ids?.length ?? 0) > 0 ||
      (g.exclude_tags?.length ?? 0) > 0 ||
      (g.depth != null && g.depth !== 0)
  );

  let valueString = "";
  if (
    criterion.modifier === CriterionModifier.Equals ||
    criterion.modifier === CriterionModifier.NotEquals
  ) {
    if (hasExtendedAttrs) {
      valueString = criterion.extendedGroups
        .map((g) => {
          const parts: string[] = [];
          if (g.tags?.length) {
            const tagStr = g.tags
              .map((v: { id: string; label: string }) =>
                v.label === v.id ? tagNameMap.get(v.id) ?? v.label : v.label
              )
              .join(" + ");
            if (g.depth != null && g.depth !== 0) {
              parts.push(`${tagStr} (+subs)`);
            } else {
              parts.push(tagStr);
            }
          }
          if (g.exclude_tags?.length) {
            const excludeStr = g.exclude_tags
              .map((v: { id: string; label: string }) =>
                v.label === v.id ? tagNameMap.get(v.id) ?? v.label : v.label
              )
              .join(",");
            parts.push(`excl=${excludeStr}`);
          }
          // Top attributes
          if (g.top_performer_ids?.length) {
            const perfStr = g.top_performer_ids
              .map((v: { id: string; label: string }) =>
                v.label === v.id
                  ? performerNameMap.get(v.id) ?? v.label
                  : v.label
              )
              .join(",");
            parts.push(`top=${perfStr}`);
          }
          // Bottom attributes
          if (g.bottom_performer_ids?.length) {
            const perfStr = g.bottom_performer_ids
              .map((v: { id: string; label: string }) =>
                v.label === v.id
                  ? performerNameMap.get(v.id) ?? v.label
                  : v.label
              )
              .join(",");
            parts.push(`btm=${perfStr}`);
          }
          // Both roles attributes
          if (g.both_roles_performer_ids?.length) {
            const perfStr = g.both_roles_performer_ids
              .map((v: { id: string; label: string }) =>
                v.label === v.id
                  ? performerNameMap.get(v.id) ?? v.label
                  : v.label
              )
              .join(",");
            parts.push(`both=${perfStr}`);
          }
          return `(${parts.join(" ")})`;
        })
        .join("; ");
    } else {
      valueString = criterion.groups
        .map(
          (g) =>
            `(${g
              .map((v) =>
                v.label === v.id ? tagNameMap.get(v.id) ?? v.label : v.label
              )
              .join(" + ")})`
        )
        .join("; ");
    }
  } else {
    valueString = criterion.items
      .map((v) =>
        v.label === v.id ? tagNameMap.get(v.id) ?? v.label : v.label
      )
      .join(", ");
  }

  return (
    <>
      {intl.formatMessage(
        { id: "criterion_modifier.format_string" },
        { criterion: criterionLabel, modifierString, valueString }
      )}
    </>
  );
};

// Chip label for the new MarkerTagsCriterion
const MarkerTagsChipLabel: React.FC<{ criterion: MarkerTagsCriterion }> = ({
  criterion,
}) => {
  const intl = useIntl();

  // Collect all tag IDs from all groups that need resolving
  const unresolvedTagIds = React.useMemo(() => {
    const ids: string[] = [];
    criterion.value.groups.forEach((g) => {
      g.tags.forEach((t) => {
        if (t.label === t.id && !ids.includes(t.id)) {
          ids.push(t.id);
        }
      });
    });
    return ids;
  }, [criterion.value.groups]);

  const { data: tagData } = useFindTagsForSelectQuery({
    variables: unresolvedTagIds.length
      ? { ids: unresolvedTagIds, filter: { per_page: unresolvedTagIds.length } }
      : { ids: [] },
    skip: unresolvedTagIds.length === 0,
  } as any);

  const tagNameMap = React.useMemo(() => {
    const m = new Map<string, string>();
    (tagData?.findTags?.tags ?? []).forEach((t) => m.set(t.id, t.name));
    return m;
  }, [tagData]);

  // Build summary string showing group count and total tags
  const groupCount = criterion.value.groups.length;
  const totalTags = criterion.value.groups.reduce(
    (acc, g) => acc + g.tags.length,
    0
  );

  // Show first few tag names as preview
  const previewTags: string[] = [];
  for (const g of criterion.value.groups) {
    for (const t of g.tags) {
      const name = t.label === t.id ? tagNameMap.get(t.id) ?? t.label : t.label;
      if (!previewTags.includes(name)) {
        previewTags.push(name);
      }
      if (previewTags.length >= 3) break;
    }
    if (previewTags.length >= 3) break;
  }

  const moreCount = totalTags - previewTags.length;
  const tagPreview =
    previewTags.join(", ") + (moreCount > 0 ? ` +${moreCount}` : "");

  return (
    <span>
      <Badge variant="secondary" className="me-1">
        {groupCount} {groupCount === 1 ? "group" : "groups"}
      </Badge>
      {intl.formatMessage({ id: "marker_tags" })}:{" "}
      {tagPreview || intl.formatMessage({ id: "none" })}
    </span>
  );
};

// Chip label for MarkerTopCriterion
const MarkerTopChipLabel: React.FC<{ criterion: MarkerTopCriterion }> = ({
  criterion,
}) => {
  const intl = useIntl();

  const filterCount = criterion.value.filters?.length ?? 0;

  if (filterCount === 0) {
    return (
      <span>
        {intl.formatMessage({ id: "marker_top" })}:{" "}
        {intl.formatMessage({ id: "none" })}
      </span>
    );
  }

  if (filterCount === 1) {
    const filter = criterion.value.filters[0];
    const unresolvedPerformerIds = filter.performer_ids
      .filter((p) => p.label === p.id)
      .map((p) => p.id);

    const { data: performerData } = useFindPerformersForSelectQuery({
      variables: unresolvedPerformerIds.length
        ? {
            ids: unresolvedPerformerIds,
            filter: { per_page: unresolvedPerformerIds.length },
          }
        : { ids: [] },
      skip: unresolvedPerformerIds.length === 0,
    } as any);

    const performerNameMap = React.useMemo(() => {
      const m = new Map<string, string>();
      (performerData?.findPerformers?.performers ?? []).forEach((p) =>
        m.set(p.id, p.name ?? p.id)
      );
      return m;
    }, [performerData]);

    const parts: string[] = [];
    if (filter.performer_ids.length > 0) {
      const names = filter.performer_ids
        .map((p) =>
          p.label === p.id ? performerNameMap.get(p.id) ?? p.label : p.label
        )
        .join(", ");
      parts.push(names);
    }
    if (filter.ethnicities.length > 0) {
      parts.push(filter.ethnicities.join(", "));
    }
    if (filter.countries.length > 0) {
      parts.push(filter.countries.join(", "));
    }
    if (filter.rating) {
      const mod = ModifierCriterion.getModifierLabel(
        intl,
        filter.rating.modifier
      );
      parts.push(`${mod} ${filter.rating.value}★`);
    }

    const valueString =
      parts.length > 0 ? parts.join(", ") : intl.formatMessage({ id: "none" });

    return (
      <span>
        <Badge variant="success" className="me-1">
          ⬆ {filter.targetGroupId}
        </Badge>
        {intl.formatMessage({ id: "marker_top" })}: {valueString}
      </span>
    );
  }

  return (
    <span>
      <Badge variant="secondary" className="me-1">
        {filterCount} {filterCount === 1 ? "filter" : "filters"}
      </Badge>
      {intl.formatMessage({ id: "marker_top" })}
    </span>
  );
};

// Chip label for MarkerBottomCriterion (Bottom)
const MarkerBottomChipLabel: React.FC<{ criterion: MarkerBottomCriterion }> = ({
  criterion,
}) => {
  const intl = useIntl();

  const filterCount = criterion.value.filters?.length ?? 0;

  if (filterCount === 0) {
    return (
      <span>
        {intl.formatMessage({ id: "marker_bottom" })}:{" "}
        {intl.formatMessage({ id: "none" })}
      </span>
    );
  }

  if (filterCount === 1) {
    const filter = criterion.value.filters[0];
    const unresolvedPerformerIds = filter.performer_ids
      .filter((p) => p.label === p.id)
      .map((p) => p.id);

    const { data: performerData } = useFindPerformersForSelectQuery({
      variables: unresolvedPerformerIds.length
        ? {
            ids: unresolvedPerformerIds,
            filter: { per_page: unresolvedPerformerIds.length },
          }
        : { ids: [] },
      skip: unresolvedPerformerIds.length === 0,
    } as any);

    const performerNameMap = React.useMemo(() => {
      const m = new Map<string, string>();
      (performerData?.findPerformers?.performers ?? []).forEach((p) =>
        m.set(p.id, p.name ?? p.id)
      );
      return m;
    }, [performerData]);

    const parts: string[] = [];
    if (filter.performer_ids.length > 0) {
      const names = filter.performer_ids
        .map((p) =>
          p.label === p.id ? performerNameMap.get(p.id) ?? p.label : p.label
        )
        .join(", ");
      parts.push(names);
    }
    if (filter.ethnicities.length > 0) {
      parts.push(filter.ethnicities.join(", "));
    }
    if (filter.countries.length > 0) {
      parts.push(filter.countries.join(", "));
    }
    if (filter.rating) {
      const mod = ModifierCriterion.getModifierLabel(
        intl,
        filter.rating.modifier
      );
      parts.push(`${mod} ${filter.rating.value}★`);
    }

    const valueString =
      parts.length > 0 ? parts.join(", ") : intl.formatMessage({ id: "none" });

    return (
      <span>
        <Badge variant="info" className="me-1">
          ⬇ {filter.targetGroupId}
        </Badge>
        {intl.formatMessage({ id: "marker_bottom" })}: {valueString}
      </span>
    );
  }

  return (
    <span>
      <Badge variant="secondary" className="me-1">
        {filterCount} {filterCount === 1 ? "filter" : "filters"}
      </Badge>
      {intl.formatMessage({ id: "marker_bottom" })}
    </span>
  );
};

// Chip label for ExcludeMarkerTagsCriterion
const ExcludeMarkerTagsChipLabel: React.FC<{
  criterion: ExcludeMarkerTagsCriterion;
}> = ({ criterion }) => {
  const intl = useIntl();

  const unresolvedTagIds = React.useMemo(() => {
    return criterion.value.tags
      .filter((t) => t.label === t.id)
      .map((t) => t.id);
  }, [criterion.value.tags]);

  const { data: tagData } = useFindTagsForSelectQuery({
    variables: unresolvedTagIds.length
      ? { ids: unresolvedTagIds, filter: { per_page: unresolvedTagIds.length } }
      : { ids: [] },
    skip: unresolvedTagIds.length === 0,
  } as any);

  const tagNameMap = React.useMemo(() => {
    const m = new Map<string, string>();
    (tagData?.findTags?.tags ?? []).forEach((t) => m.set(t.id, t.name));
    return m;
  }, [tagData]);

  const tagNames = criterion.value.tags
    .map((t) => (t.label === t.id ? tagNameMap.get(t.id) ?? t.label : t.label))
    .join(", ");

  const groupSuffix = criterion.value.targetGroupId
    ? ` (from ${criterion.value.targetGroupId})`
    : "";

  return (
    <span>
      <Badge variant="danger" className="me-1">
        ❌
      </Badge>
      {intl.formatMessage({ id: "exclude_marker_tags" })}: {tagNames}
      {groupSuffix}
    </span>
  );
};
// CUSTOM: end

export const FilterTags: React.FC<IFilterTagsProps> = ({
  searchTerm,
  criteria,
  onEditCriterion,
  onRemoveCriterion,
  onRemoveAll,
  onEditSearchTerm,
  onRemoveSearchTerm,
  truncateOnOverflow = false,
}) => {
  const intl = useIntl();
  const ref = useRef<HTMLDivElement>(null);

  const { configuration } = useConfigurationContext();
  const { sfwContentMode } = configuration.interface;

  const [cutoff, setCutoff] = React.useState<number | undefined>();
  const elementGap = 10; // Adjust this value based on your CSS gap or margin
  const moreTagWidth = 80; // reserve space for the "more" tag

  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  const debounceResetCutoff = useDebounce(
    () => {
      setCutoff(undefined);
      // setting cutoff won't trigger a re-render if it's already undefined
      // so we force a re-render to recalculate the cutoff
      forceUpdate();
    },
    100 // Adjust the debounce delay as needed
  );

  // trigger recalculation of cutoff when control resizes
  useEffect(() => {
    if (!truncateOnOverflow || !ref.current) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      debounceResetCutoff();
    });

    const { current } = ref;
    resizeObserver.observe(current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [truncateOnOverflow, debounceResetCutoff]);

  // we need to check this on every render, and the call to setCutoff _should_ be safe
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  useLayoutEffect(() => {
    if (!truncateOnOverflow) {
      setCutoff(undefined);
      return;
    }

    const { current } = ref;

    if (current) {
      // calculate the number of tags that can fit in the container
      const containerWidth = current.clientWidth;
      const children = Array.from(current.children);

      // don't recalculate anything if the more tag is visible and cutoff is already set
      const moreTags = children.find((child) => {
        return (child as HTMLElement).classList.contains("more-tags");
      });

      if (moreTags && cutoff !== undefined) {
        return;
      }

      const childTags = children.filter((child) => {
        return (
          (child as HTMLElement).classList.contains("tag-item") ||
          (child as HTMLElement).classList.contains("clear-all-button")
        );
      });

      const clearAllButton = children.find((child) => {
        return (child as HTMLElement).classList.contains("clear-all-button");
      });

      // calculate the total width without the more tag
      const defaultTotalWidth = childTags.reduce((total, child, idx) => {
        return (
          total +
          ((child as HTMLElement).offsetWidth ?? 0) +
          (idx === childTags.length - 1 ? 0 : elementGap)
        );
      }, 0);

      if (containerWidth >= defaultTotalWidth) {
        // if the container is wide enough to fit all tags, reset cutoff
        setCutoff(undefined);
        return;
      }

      let totalWidth = 0;
      let visibleCount = 0;

      // reserve space for the more tags control
      totalWidth += moreTagWidth;

      // reserve space for the clear all button if present
      if (clearAllButton) {
        totalWidth += (clearAllButton as HTMLElement).offsetWidth ?? 0;
      }

      for (const child of children) {
        totalWidth += ((child as HTMLElement).offsetWidth ?? 0) + elementGap;
        if (totalWidth > containerWidth) {
          break;
        }
        visibleCount++;
      }

      setCutoff(visibleCount);
    }
  });

  function onRemoveCriterionTag(
    criterion: Criterion,
    $event: React.MouseEvent<HTMLElement, MouseEvent>,
    valueIndex?: number
  ) {
    if (!criterion) {
      return;
    }
    onRemoveCriterion(criterion, valueIndex);
    $event.stopPropagation();
  }

  function onClickCriterionTag(criterion: Criterion) {
    onEditCriterion(criterion);
  }

  function getFilterTags(criterion: Criterion) {
    if (
      criterion instanceof CustomFieldsCriterion &&
      criterion.value.length > 1
    ) {
      return criterion.value.map((value, index) => {
        return (
          <FilterTag
            key={index}
            label={criterion.getValueLabel(intl, value)}
            onClick={() => onClickCriterionTag(criterion)}
            onRemove={($event) =>
              onRemoveCriterionTag(criterion, $event, index)
            }
          />
        );
      });
    }

    const unsupported = criterion instanceof UnsupportedCriterion;

    return (
      <FilterTag
        key={criterion.getId()}
        label={
          // CUSTOM: begin - custom chip labels for marker criteria
          criterion instanceof SceneMarkerTagsCriterion ? (
            <SceneMarkerTagsChipLabel criterion={criterion} />
          ) : criterion instanceof MarkerTagsCriterion ? (
            <MarkerTagsChipLabel criterion={criterion} />
          ) : criterion instanceof MarkerTopCriterion ? (
            <MarkerTopChipLabel criterion={criterion} />
          ) : criterion instanceof MarkerBottomCriterion ? (
            <MarkerBottomChipLabel criterion={criterion} />
          ) : criterion instanceof ExcludeMarkerTagsCriterion ? (
            <ExcludeMarkerTagsChipLabel criterion={criterion} />
          ) : (
            // CUSTOM: end
            criterion.getLabel(intl, sfwContentMode)
          )
        }
        unsupported={unsupported}
        onClick={() => onClickCriterionTag(criterion)}
        onRemove={($event) => onRemoveCriterionTag(criterion, $event)}
      />
    );
  }

  if (criteria.length === 0 && !searchTerm) {
    return null;
  }

  const className = "wrap-tags filter-tags";

  const filterTags = criteria.map((c) => getFilterTags(c)).flat();

  if (searchTerm && searchTerm.length > 0) {
    filterTags.unshift(
      <FilterTag
        key="search-term"
        className="search-term-filter-tag"
        label={
          <span className="search-term">
            <Icon icon={faMagnifyingGlass} />
            {searchTerm}
          </span>
        }
        onClick={() => onEditSearchTerm?.()}
        onRemove={() => onRemoveSearchTerm?.()}
      />
    );
  }

  const visibleCriteria =
    cutoff !== undefined ? filterTags.slice(0, cutoff) : filterTags;
  const hiddenCriteria = cutoff !== undefined ? filterTags.slice(cutoff) : [];

  return (
    <div className={className} ref={ref}>
      {visibleCriteria}
      <MoreFilterTags tags={hiddenCriteria} />
      {filterTags.length >= 3 && (
        <Button
          variant="minimal"
          className="clear-all-button"
          onClick={() => onRemoveAll()}
        >
          <FormattedMessage id="actions.clear" />
        </Button>
      )}
    </div>
  );
};
