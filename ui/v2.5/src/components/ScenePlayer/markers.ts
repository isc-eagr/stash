import videojs, { VideoJsPlayer } from "video.js";
import CryptoJS from "crypto-js";
import {
  getSceneMarkerTimestampPickerHorizontalLayout,
  getSceneMarkerTimestampOptions,
  shouldScheduleSceneMarkerTimestampPickerHide,
  shouldShowSceneMarkerTooltip,
  type ISceneMarkerTimestampSource,
  type SceneMarkerTimestampBoundary,
} from "./sceneMarkerTimestampCopy_custom"; // CUSTOM
import TextUtils from "src/utils/text"; // CUSTOM

export interface IMarker {
  id?: string;
  title: string;
  seconds: number;
  end_seconds?: number | null;
  primaryTag: { id?: string; name: string };
  tags?: Array<{ id?: string; name: string }>; // CUSTOM
  isRoyalSapphire?: boolean; // CUSTOM
  ratingCardClass?: string; // CUSTOM
  // CUSTOM: begin - performer roles on markers
  top_performers?: Array<{
    id: string;
    name: string;
    image_path?: string | null;
  }>;
  bottom_performers?: Array<{
    id: string;
    name: string;
    image_path?: string | null;
  }>;
  hover_performers?: Array<{
    id: string;
    name: string;
    image_path?: string | null;
    top_tags: Array<{ id?: string; name: string; isOverlap?: boolean }>;
    bottom_tags: Array<{ id?: string; name: string; isOverlap?: boolean }>;
  }>;
  // CUSTOM: end
}

// CUSTOM: begin - negative marker interface
export interface INegativeMarker {
  id: string;
  name: string;
  start_seconds: number;
  end_seconds: number;
}
// CUSTOM: end

interface IMarkersOptions {
  markers?: IMarker[];
  onMarkerClick?: (
    marker: IMarker | INegativeMarker,
    seconds: number,
    boundary?: SceneMarkerTimestampBoundary
  ) => void; // CUSTOM
}

class MarkersPlugin extends videojs.getPlugin("plugin") {
  private markers: IMarker[] = [];
  private markerDivs: {
    dot?: HTMLDivElement;
    range?: HTMLDivElement;
    containedRanges?: HTMLDivElement[];
  }[] = [];
  private negativeMarkerDivs: HTMLDivElement[] = []; // CUSTOM
  private oTimestampDivs: HTMLDivElement[] = []; // CUSTOM
  private markerTooltip: HTMLElement | null = null;
  private markerTooltipHideTimer?: number; // CUSTOM
  private markerTooltipOwner: HTMLElement | null = null; // CUSTOM
  private markerTooltipOwnerIsNegative = false; // CUSTOM
  private defaultTooltip: HTMLElement | null = null;
  private timestampCopyPicker: HTMLElement | null = null; // CUSTOM
  private timestampCopyPickerOwner: HTMLElement | null = null; // CUSTOM
  private timestampCopyPickerOwnerIsNegative = false; // CUSTOM
  private timestampCopyHideTimer?: number; // CUSTOM

  private layerHeight: number = 9;

  private tagColors: { [tag: string]: string } = {};
  private onMarkerClick?: (
    marker: IMarker | INegativeMarker,
    seconds: number,
    boundary?: SceneMarkerTimestampBoundary
  ) => void; // CUSTOM
  private timestampCopyMode = false; // CUSTOM

  private _fallbackDuration: number = 0; // CUSTOM: used when player.duration() is 0 (preload=none, not started yet)

  // CUSTOM: set known duration before playback begins so markers render on the seek bar before play is pressed
  setFallbackDuration(duration: number) {
    this._fallbackDuration = duration;
  }

  constructor(player: VideoJsPlayer, options?: IMarkersOptions) {
    super(player);
    this.onMarkerClick = options?.onMarkerClick;
    player.ready(() => {
      const tooltip = videojs.dom.createEl("div") as HTMLElement;
      tooltip.className = "vjs-marker-tooltip";
      tooltip.style.visibility = "hidden";
      tooltip.addEventListener("mouseenter", () => {
        window.clearTimeout(this.markerTooltipHideTimer);
      }); // CUSTOM
      tooltip.addEventListener("mouseleave", () => {
        this.scheduleMarkerTooltipHide();
      }); // CUSTOM

      const parent = player.el().querySelector(".vjs-progress-control");
      if (parent) parent.appendChild(tooltip);
      this.markerTooltip = tooltip;

      // CUSTOM: begin - stable, interactive timestamp picker used instead of
      // overlapping boundary handles on adjacent markers.
      const timestampCopyPicker = videojs.dom.createEl("div") as HTMLElement;
      timestampCopyPicker.className =
        "vjs-marker-timestamp-picker scene-marker-timestamp-picker";
      timestampCopyPicker.style.visibility = "hidden";
      timestampCopyPicker.addEventListener("mouseenter", () => {
        window.clearTimeout(this.timestampCopyHideTimer);
      });
      timestampCopyPicker.addEventListener("mouseleave", () => {
        this.scheduleTimestampCopyPickerHide();
      });
      if (parent) parent.appendChild(timestampCopyPicker);
      this.timestampCopyPicker = timestampCopyPicker;
      // CUSTOM: end

      this.defaultTooltip = player
        .el()
        .querySelector<HTMLElement>(
          ".vjs-progress-holder .vjs-mouse-display .vjs-time-tooltip"
        );
    });
  }

  setOnMarkerClick(
    onMarkerClick?: (
      marker: IMarker | INegativeMarker,
      seconds: number,
      boundary?: SceneMarkerTimestampBoundary
    ) => void
  ) {
    this.onMarkerClick = onMarkerClick;
  }

  // CUSTOM: Show an exact-time picker while a marker form is waiting for a
  // timestamp copied from the player timeline.
  setTimestampCopyMode(enabled: boolean) {
    this.timestampCopyMode = enabled;
    if (!enabled) this.hideTimestampCopyPicker(); // CUSTOM
  }

  // CUSTOM: begin - interactive timestamp picker for scene marker boundaries
  private hideTimestampCopyPicker() {
    window.clearTimeout(this.timestampCopyHideTimer);
    this.timestampCopyPickerOwner = null;
    this.timestampCopyPickerOwnerIsNegative = false; // CUSTOM
    if (this.timestampCopyPicker) {
      this.timestampCopyPicker.style.visibility = "hidden";
    }
    if (this.defaultTooltip) this.defaultTooltip.style.visibility = "visible";
  }

  private scheduleTimestampCopyPickerHide(owner?: HTMLElement) {
    if (
      !shouldScheduleSceneMarkerTimestampPickerHide(
        this.timestampCopyPickerOwner,
        owner
      )
    ) {
      return;
    }

    window.clearTimeout(this.timestampCopyHideTimer);
    this.timestampCopyHideTimer = window.setTimeout(
      () => this.hideTimestampCopyPicker(),
      350
    );
  }

  private appendTimestampRangeChips(
    parent: HTMLElement,
    marker: ISceneMarkerTimestampSource,
    action: "copy" | "seek",
    onSelect: (boundary: SceneMarkerTimestampBoundary, seconds: number) => void
  ) {
    const range = document.createElement("div");
    range.className = "scene-marker-timestamp-picker-range";
    range.setAttribute("aria-label", "Marker range");

    getSceneMarkerTimestampOptions(marker).forEach((option, index) => {
      if (index > 0) {
        const divider = document.createElement("span");
        divider.className = "scene-marker-timestamp-picker-range-divider";
        divider.setAttribute("aria-hidden", "true");
        divider.textContent = "\u2013";
        range.appendChild(divider);
      }

      const actionLabel = action === "seek" ? "Seek to" : "Use";
      const button = document.createElement("button");
      button.type = "button";
      button.className = `scene-marker-timestamp-picker-chip scene-marker-timestamp-picker-chip-${option.boundary}`;
      button.title = `${actionLabel} marker ${option.label.toLowerCase()} time`;
      button.setAttribute(
        "aria-label",
        `${actionLabel} marker ${option.label.toLowerCase()} time ${TextUtils.secondsToTimestamp(
          option.seconds,
          true
        )}`
      );
      button.textContent = TextUtils.secondsToTimestamp(option.seconds, true);
      button.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
      });
      button.addEventListener("mousedown", (event) => {
        event.stopPropagation();
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect(option.boundary, option.seconds);
      });
      range.appendChild(button);
    });

    parent.appendChild(range);
  }

  private showTimestampCopyPicker(
    marker: IMarker | INegativeMarker,
    layer: number,
    target: HTMLElement,
    cursorClientX?: number
  ) {
    const picker = this.timestampCopyPicker;
    if (!picker) return;

    const isNegativeMarker = "start_seconds" in marker;
    // CUSTOM: keep the higher-priority negative marker stable when overlapping
    // regular marker elements emit competing mouseenter events.
    if (
      !shouldShowSceneMarkerTooltip({
        activeOwner: this.timestampCopyPickerOwner,
        activeIsNegative: this.timestampCopyPickerOwnerIsNegative,
        requestedOwner: target,
        requestedIsNegative: isNegativeMarker,
      })
    ) {
      return;
    }

    window.clearTimeout(this.timestampCopyHideTimer);
    this.timestampCopyPickerOwner = target;
    this.timestampCopyPickerOwnerIsNegative = isNegativeMarker; // CUSTOM
    this.hideMarkerTooltip();
    picker.replaceChildren();

    const timestampSource = isNegativeMarker
      ? {
          id: marker.id,
          seconds: marker.start_seconds,
          end_seconds: marker.end_seconds,
        }
      : marker;
    const markerTitle = isNegativeMarker
      ? marker.name || "Negative marker"
      : marker.primaryTag.name || marker.title;

    const title = document.createElement("div");
    title.className = "scene-marker-timestamp-picker-title";
    title.textContent = markerTitle;
    picker.appendChild(title);

    const range = document.createElement("div");
    range.className = "scene-marker-timestamp-picker-range";
    const rangeLabel = document.createElement("span");
    rangeLabel.className = "scene-marker-timestamp-picker-range-label";
    rangeLabel.textContent = "Marker range";
    range.appendChild(rangeLabel);

    const startTimestamp = TextUtils.secondsToTimestamp(
      timestampSource.seconds,
      true
    );
    const endTimestamp =
      timestampSource.end_seconds !== null &&
      timestampSource.end_seconds !== undefined
        ? TextUtils.secondsToTimestamp(timestampSource.end_seconds, true)
        : "No end time";
    const rangeValue = document.createElement("span");
    rangeValue.className = "scene-marker-timestamp-picker-range-value";
    rangeValue.textContent = `${startTimestamp} – ${endTimestamp}`;
    range.appendChild(rangeValue);
    getSceneMarkerTimestampOptions(timestampSource).forEach((option, index) => {
      if (index > 0) {
        const divider = document.createElement("span");
        divider.className = "scene-marker-timestamp-picker-range-divider";
        divider.setAttribute("aria-hidden", "true");
        divider.textContent = "\u2013";
        range.appendChild(divider);
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = `scene-marker-timestamp-picker-chip scene-marker-timestamp-picker-chip-${option.boundary}`;
      button.title = `Copy marker ${option.label.toLowerCase()} time`;
      button.setAttribute(
        "aria-label",
        `Use marker ${option.label.toLowerCase()} time ${TextUtils.secondsToTimestamp(
          option.seconds,
          true
        )}`
      );
      button.textContent = TextUtils.secondsToTimestamp(option.seconds, true);
      button.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
      });
      button.addEventListener("mousedown", (event) => {
        event.stopPropagation();
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.player.currentTime(option.seconds);
        this.onMarkerClick?.(marker, option.seconds, option.boundary);
        this.hideTimestampCopyPicker();
      });
      range.appendChild(button);
    });
    picker.appendChild(range);

    picker.style.visibility = "hidden";
    picker.style.width = "";
    picker.style.left = "0px";
    picker.style.removeProperty("--timestamp-picker-caret-left");

    const parent = picker.parentElement;
    if (parent) {
      const parentRect = parent.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const padding = 6;
      const maxWidth = Math.max(parentRect.width - padding * 2, 0);
      const naturalWidth = picker.offsetWidth;
      picker.style.width = naturalWidth > maxWidth ? `${maxWidth}px` : "";

      const pickerWidth = picker.offsetWidth;
      const cursorX =
        cursorClientX !== undefined && Number.isFinite(cursorClientX)
          ? cursorClientX - parentRect.left
          : targetRect.left + targetRect.width / 2 - parentRect.left;
      const layout = getSceneMarkerTimestampPickerHorizontalLayout({
        parentWidth: parentRect.width,
        pickerWidth,
        cursorX,
        padding,
      });
      picker.style.left = `${layout.left}px`;
      picker.style.setProperty(
        "--timestamp-picker-caret-left",
        `${layout.caretLeft}px`
      );
    }

    picker.style.top = `-${
      this.layerHeight * layer + picker.offsetHeight + 12
    }px`;
    picker.style.visibility = "visible";
    if (this.defaultTooltip) this.defaultTooltip.style.visibility = "hidden";
  }
  // CUSTOM: end

  // CUSTOM: begin - enhanced tooltip with performer roles and negative marker styling
  private showMarkerTooltip(
    title: string,
    layer: number = 0,
    topPerformers?: Array<{
      id: string;
      name: string;
      image_path?: string | null;
    }>,
    bottomPerformers?: Array<{
      id: string;
      name: string;
      image_path?: string | null;
    }>,
    isNegativeMarker: boolean = false,
    target?: HTMLElement,
    markerTags?: Array<{ id?: string; name: string }>,
    hoverPerformers?: IMarker["hover_performers"],
    ratingCardClass?: string,
    timestampSource?: ISceneMarkerTimestampSource,
    cursorClientX?: number
  ) {
    if (!this.markerTooltip) return;

    if (
      target &&
      !shouldShowSceneMarkerTooltip({
        activeOwner: this.markerTooltipOwner,
        activeIsNegative: this.markerTooltipOwnerIsNegative,
        requestedOwner: target,
        requestedIsNegative: isNegativeMarker,
      })
    ) {
      return;
    }

    window.clearTimeout(this.markerTooltipHideTimer); // CUSTOM
    this.markerTooltipOwner = target ?? null; // CUSTOM
    this.markerTooltipOwnerIsNegative = isNegativeMarker; // CUSTOM

    let tooltipContent = title;

    // Only show arrows if marker has performers in BOTH roles (top and bottom)
    const showRoleArrows =
      (topPerformers?.length ?? 0) > 0 && (bottomPerformers?.length ?? 0) > 0;

    // Add top performers (with up arrows only if both roles have performers)
    if (topPerformers && topPerformers.length > 0) {
      const topNames = topPerformers
        .map((p) => (showRoleArrows ? `↑ ${p.name}` : p.name))
        .join(", ");
      tooltipContent += ` [${topNames}]`;
    }

    // Add bottom performers (with down arrows only if both roles have performers)
    if (bottomPerformers && bottomPerformers.length > 0) {
      const bottomNames = bottomPerformers
        .map((p) => (showRoleArrows ? `↓ ${p.name}` : p.name))
        .join(", ");
      if (topPerformers && topPerformers.length > 0) {
        tooltipContent += ` [${bottomNames}]`;
      } else {
        tooltipContent += ` [${bottomNames}]`;
      }
    }

    this.markerTooltip.innerText = tooltipContent;
    // CUSTOM: begin - image-aware performer tooltip content
    this.markerTooltip.replaceChildren();
    const hasMarkerContext =
      !!markerTags ||
      !!topPerformers?.length ||
      !!bottomPerformers?.length ||
      !!hoverPerformers?.length;
    this.markerTooltip.classList.toggle(
      "vjs-marker-tooltip-with-performer-card",
      hasMarkerContext && !isNegativeMarker
    );
    this.markerTooltip.classList.toggle(
      "vjs-marker-tooltip-interactive",
      !!timestampSource
    ); // CUSTOM
    const titleEl = document.createElement("div");
    titleEl.className = "vjs-marker-tooltip-title";
    titleEl.textContent = title;
    this.markerTooltip.appendChild(titleEl);

    const addPerformers = (
      performers: Array<{
        id: string;
        name: string;
        image_path?: string | null;
      }>,
      role: "top" | "bottom"
    ) => {
      if (performers.length === 0) return;

      const list = document.createElement("div");
      list.className = `vjs-marker-tooltip-performers vjs-marker-tooltip-performers-${role}`;

      performers.forEach((performer) => {
        const item = document.createElement("span");
        item.className = "vjs-marker-tooltip-performer";

        if (performer.image_path) {
          const image = document.createElement("img");
          image.className = "vjs-marker-tooltip-performer-image";
          image.src = performer.image_path;
          image.alt = performer.name;
          item.appendChild(image);
        }

        const name = document.createElement("span");
        name.className = "vjs-marker-tooltip-performer-name";
        name.textContent = performer.name;
        item.appendChild(name);
        list.appendChild(item);
      });

      this.markerTooltip?.appendChild(list);
    };

    addPerformers(topPerformers ?? [], "top");
    addPerformers(bottomPerformers ?? [], "bottom");

    if (hasMarkerContext && !isNegativeMarker) {
      this.markerTooltip.replaceChildren();

      const card = document.createElement("div");
      card.className = `scene-marker-highlight-popover-card ${
        ratingCardClass ?? ""
      }`.trim(); // CUSTOM: carry GOAT/Royal Sapphire styling into timeline hover cards
      const performersWrapper = document.createElement("div");
      performersWrapper.className = "scene-marker-activity-config-performers";
      const displayTags =
        markerTags && markerTags.length > 0
          ? markerTags
          : [{ id: "primary", name: title }];

      const addPerformerTile = (
        performer: {
          id: string;
          name: string;
          image_path?: string | null;
        },
        topTags: Array<{ id?: string; name: string }>,
        bottomTags: Array<{ id?: string; name: string }>
      ) => {
        const item = document.createElement("div");
        item.className =
          "scene-marker-activity-performer scene-marker-highlight-performer";
        item.title = performer.name;

        const imageWrapper = document.createElement("div");
        imageWrapper.className = "scene-marker-activity-performer-image";
        if (performer.image_path) {
          const image = document.createElement("img");
          image.src = performer.image_path;
          image.alt = performer.name;
          imageWrapper.appendChild(image);
        }
        item.appendChild(imageWrapper);

        const name = document.createElement("div");
        name.className = "scene-marker-activity-performer-name";
        name.textContent = performer.name;
        item.appendChild(name);

        const tagList = document.createElement("div");
        tagList.className = "scene-marker-highlight-performer-tags";
        const addTagBadges = (
          tags: Array<{ id?: string; name: string; isOverlap?: boolean }>,
          role: "top" | "bottom"
        ) => {
          tags.forEach((tag) => {
            const badge = document.createElement("span");
            badge.className = `badge badge-secondary tag-badge scene-marker-highlight-tag-${role}${
              tag.isOverlap ? " scene-marker-highlight-tag-overlap" : ""
            }`;
            badge.textContent = tag.name;
            tagList.appendChild(badge);
          });
        };
        addTagBadges(topTags, "top");
        addTagBadges(bottomTags, "bottom");
        item.appendChild(tagList);
        performersWrapper.appendChild(item);
      };

      if (hoverPerformers) {
        hoverPerformers.forEach((performer) =>
          addPerformerTile(performer, performer.top_tags, performer.bottom_tags)
        );
      } else {
        (topPerformers ?? []).forEach((performer) =>
          addPerformerTile(performer, displayTags, [])
        );
        (bottomPerformers ?? []).forEach((performer) =>
          addPerformerTile(performer, [], displayTags)
        );
      }

      if (!performersWrapper.childElementCount) {
        const empty = document.createElement("div");
        empty.className = "scene-marker-activity-config-empty";
        empty.textContent = "No performers";
        performersWrapper.appendChild(empty);
      }

      card.appendChild(performersWrapper);
      this.markerTooltip.appendChild(card);
    }

    // CUSTOM: normal timeline hovers keep their performer/tag card and add
    // the same exact-boundary chips used by timestamp-copy mode underneath.
    if (timestampSource) {
      if (isNegativeMarker) this.markerTooltip.replaceChildren();

      const timestampPicker = document.createElement("div");
      timestampPicker.className =
        "scene-marker-timestamp-picker scene-marker-timeline-seek-picker";

      const timestampTitle = document.createElement("div");
      timestampTitle.className = "scene-marker-timestamp-picker-title";
      timestampTitle.textContent = markerTags?.[0]?.name || title;
      timestampPicker.appendChild(timestampTitle);

      this.appendTimestampRangeChips(
        timestampPicker,
        timestampSource,
        "seek",
        (_boundary, seconds) => {
          this.player.currentTime(seconds);
          this.hideMarkerTooltip();
        }
      );
      this.markerTooltip.appendChild(timestampPicker);
    }
    // CUSTOM: end

    // CUSTOM: begin - keep marker tooltips inside the player timeline edges
    this.markerTooltip.style.visibility = "hidden";
    this.markerTooltip.style.width = "";
    this.markerTooltip.style.maxWidth = "";
    this.markerTooltip.style.transform = "none";
    this.markerTooltip.style.right = "";
    this.markerTooltip.style.left = "0px";

    const parent = this.markerTooltip.parentElement;
    if (parent && target) {
      const parentRect = parent.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const padding = 6;
      const maxWidth = Math.max(parentRect.width - padding * 2, 0);
      const naturalWidth = this.markerTooltip.offsetWidth;

      this.markerTooltip.style.width =
        naturalWidth > maxWidth ? `${maxWidth}px` : "";
      const tooltipWidth = this.markerTooltip.offsetWidth;

      const targetCenter =
        cursorClientX !== undefined && Number.isFinite(cursorClientX)
          ? cursorClientX - parentRect.left
          : targetRect.left + targetRect.width / 2 - parentRect.left;
      const maxLeft = parentRect.width - tooltipWidth - padding;
      const left = Math.max(
        padding,
        Math.min(targetCenter - tooltipWidth / 2, maxLeft)
      );

      this.markerTooltip.style.left = `${left}px`;
    } else {
      this.markerTooltip.style.left = "50%";
      this.markerTooltip.style.transform = "translateX(-50%)";
    }

    this.markerTooltip.style.top = `-${
      this.layerHeight * layer + this.markerTooltip.offsetHeight + 10
    }px`;
    this.markerTooltip.style.visibility = "visible";
    // CUSTOM: end

    // Style differently for negative markers
    if (isNegativeMarker) {
      this.markerTooltip.classList.add("vjs-marker-tooltip-negative");
    } else {
      this.markerTooltip.classList.remove("vjs-marker-tooltip-negative");
    }

    if (this.defaultTooltip) this.defaultTooltip.style.visibility = "hidden";
  }
  // CUSTOM: end

  private hideMarkerTooltip() {
    window.clearTimeout(this.markerTooltipHideTimer); // CUSTOM
    this.markerTooltipOwner = null; // CUSTOM
    this.markerTooltipOwnerIsNegative = false; // CUSTOM
    if (this.markerTooltip) this.markerTooltip.style.visibility = "hidden";
    if (this.defaultTooltip) this.defaultTooltip.style.visibility = "visible";
  }

  private scheduleMarkerTooltipHide(owner?: HTMLElement) {
    if (
      !shouldScheduleSceneMarkerTimestampPickerHide(
        this.markerTooltipOwner,
        owner
      )
    ) {
      return;
    }

    window.clearTimeout(this.markerTooltipHideTimer);
    this.markerTooltipHideTimer = window.setTimeout(
      () => this.hideMarkerTooltip(),
      350
    );
  }

  addDotMarker(marker: IMarker) {
    const duration = this.player.duration() || this._fallbackDuration; // CUSTOM
    const markerSet: {
      dot?: HTMLDivElement;
      range?: HTMLDivElement;
    } = {};
    const seekBar = this.player.el().querySelector(".vjs-progress-holder");

    markerSet.dot = videojs.dom.createEl("div") as HTMLDivElement;
    markerSet.dot.className = "vjs-marker";
    if (this.timestampCopyMode) {
      markerSet.dot.classList.add("vjs-marker-timestamp-copy"); // CUSTOM
      markerSet.dot.title = "Choose a marker timestamp"; // CUSTOM
    }
    if (marker.isRoyalSapphire) {
      markerSet.dot.classList.add("vjs-marker-royal-sapphire"); // CUSTOM
    }
    if (duration) {
      // marker is 6px wide - adjust by 3px to align to center not left side
      markerSet.dot.style.left = `calc(${
        (marker.seconds / duration) * 100
      }% - 3px)`;
      markerSet.dot.style.visibility = "visible";
    }

    // Add event listeners to dot
    markerSet.dot.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.timestampCopyMode && markerSet.dot) {
        this.showTimestampCopyPicker(marker, 0, markerSet.dot, event.clientX); // CUSTOM
        return;
      }
      this.player.currentTime(marker.seconds);
      this.onMarkerClick?.(marker, marker.seconds);
    });
    markerSet.dot.toggleAttribute("marker-tooltip-shown", true);

    // Set background color based on tag (if available)
    if (
      !marker.isRoyalSapphire &&
      marker.primaryTag &&
      marker.primaryTag.name &&
      this.tagColors[marker.primaryTag.name]
    ) {
      markerSet.dot.style.backgroundColor =
        this.tagColors[marker.primaryTag.name];
    }
    markerSet.dot.addEventListener("mouseenter", (event) => {
      if (this.timestampCopyMode && markerSet.dot) {
        this.showTimestampCopyPicker(marker, 0, markerSet.dot, event.clientX); // CUSTOM
        markerSet.dot.toggleAttribute("marker-tooltip-shown", true);
        return;
      }
      this.showMarkerTooltip(
        marker.title,
        0,
        marker.top_performers,
        marker.bottom_performers,
        false,
        markerSet.dot,
        [marker.primaryTag, ...(marker.tags ?? [])],
        marker.hover_performers,
        marker.ratingCardClass,
        marker,
        event.clientX
      ); // CUSTOM: performer roles
      markerSet.dot?.toggleAttribute("marker-tooltip-shown", true);
    });

    markerSet.dot.addEventListener("mouseout", () => {
      if (this.timestampCopyMode) {
        this.scheduleTimestampCopyPickerHide(markerSet.dot); // CUSTOM
      } else {
        this.scheduleMarkerTooltipHide(markerSet.dot); // CUSTOM
      }
      markerSet.dot?.toggleAttribute("marker-tooltip-shown", false);
    });

    if (seekBar) {
      seekBar.appendChild(markerSet.dot);
    }
    this.markers.push(marker);
    this.markerDivs.push(markerSet);
  }

  addDotMarkers(markers: IMarker[]) {
    markers.forEach(this.addDotMarker, this);
  }

  private renderRangeMarkers(markers: IMarker[], layer: number) {
    const duration = this.player.duration() || this._fallbackDuration; // CUSTOM
    const parent = this.player.el().querySelector(".vjs-progress-control");
    const seekBar = this.player.el().querySelector(".vjs-progress-holder");
    if (!seekBar || !parent || !duration) return;

    markers.forEach((marker) => {
      this.renderRangeMarker(marker, layer, duration, seekBar, parent);
    });
  }

  private renderRangeMarker(
    marker: IMarker,
    layer: number,
    duration: number,
    seekBar: Element,
    parent: Element
  ) {
    if (!marker.end_seconds) return;

    const markerSet: {
      dot?: HTMLDivElement;
      range?: HTMLDivElement;
    } = {};
    const rangeDiv = videojs.dom.createEl("div") as HTMLDivElement;
    rangeDiv.className = "vjs-marker-range";
    if (marker.isRoyalSapphire) {
      rangeDiv.classList.add("vjs-marker-royal-sapphire"); // CUSTOM
    }

    // Use percentage-based positioning for proper scaling in fullscreen mode
    // The range marker is inside vjs-progress-control, but needs to align with
    // vjs-progress-holder which has 15px margins on each side.
    // We use calc() to combine percentage positioning with the fixed margin offset.
    const startPercent = (marker.seconds / duration) * 100;
    const widthPercent =
      ((marker.end_seconds - marker.seconds) / duration) * 100;

    // left: 15px margin + percentage of the progress holder width
    // Since progress-holder has margin: 0 15px, we need calc(15px + X% of remaining width)
    // The progress-holder width is (100% - 30px), so the actual left position is:
    // 15px + startPercent% * (100% - 30px) = 15px + startPercent% * 100% - startPercent% * 30px
    rangeDiv.style.left = `calc(15px + ${startPercent}% - ${
      startPercent * 0.3
    }px)`;

    rangeDiv.style.width = `calc(${widthPercent}% - ${widthPercent * 0.3}px)`;
    rangeDiv.style.bottom = `${layer * this.layerHeight}px`; // Adjust height based on layer
    rangeDiv.style.display = "none"; // Initially hidden

    // Set background color based on tag (if available)
    if (
      !marker.isRoyalSapphire &&
      marker.primaryTag &&
      marker.primaryTag.name &&
      this.tagColors[marker.primaryTag.name]
    ) {
      rangeDiv.style.backgroundColor = this.tagColors[marker.primaryTag.name];
    }

    markerSet.range = rangeDiv;
    markerSet.range.style.display = "block";
    if (this.timestampCopyMode) {
      markerSet.range.classList.add("vjs-marker-range-timestamp-copy"); // CUSTOM
    }
    markerSet.range.addEventListener("pointermove", (e) => {
      e.stopPropagation();
    });
    markerSet.range.addEventListener("pointerover", (e) => {
      e.stopPropagation();
    });
    markerSet.range.addEventListener("pointerout", (e) => {
      e.stopPropagation();
    });
    markerSet.range.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.timestampCopyMode && markerSet.range) {
        this.showTimestampCopyPicker(
          marker,
          layer,
          markerSet.range,
          event.clientX
        ); // CUSTOM
        return;
      }
      const seekBarRect = seekBar.getBoundingClientRect();
      const clickRatio =
        seekBarRect.width > 0
          ? (event.clientX - seekBarRect.left) / seekBarRect.width
          : 0;
      const clickedSeconds = Math.min(
        marker.end_seconds ?? duration,
        Math.max(
          marker.seconds,
          Math.min(Math.max(clickRatio, 0), 1) * duration
        )
      );

      this.player.currentTime(clickedSeconds);
      this.onMarkerClick?.(marker, clickedSeconds);
    });
    markerSet.range.addEventListener("mouseenter", (event) => {
      if (this.timestampCopyMode && markerSet.range) {
        this.showTimestampCopyPicker(
          marker,
          layer,
          markerSet.range,
          event.clientX
        ); // CUSTOM
        markerSet.range.toggleAttribute("marker-tooltip-shown", true);
        return;
      }
      this.showMarkerTooltip(
        marker.title,
        layer,
        marker.top_performers,
        marker.bottom_performers,
        false,
        markerSet.range,
        [marker.primaryTag, ...(marker.tags ?? [])],
        marker.hover_performers,
        marker.ratingCardClass,
        marker,
        event.clientX
      ); // CUSTOM: performer roles
      markerSet.range?.toggleAttribute("marker-tooltip-shown", true);
    });

    markerSet.range.addEventListener("mouseout", () => {
      if (this.timestampCopyMode) {
        this.scheduleTimestampCopyPickerHide(markerSet.range); // CUSTOM
      } else {
        this.scheduleMarkerTooltipHide(markerSet.range); // CUSTOM
      }
      markerSet.range?.toggleAttribute("marker-tooltip-shown", false);
    });
    parent.appendChild(rangeDiv);
    this.markers.push(marker);
    this.markerDivs.push(markerSet);
  }

  addRangeMarkers(markers: IMarker[]) {
    let remainingMarkers = [...markers];
    let layerNum = 0;

    while (remainingMarkers.length > 0) {
      // Get the set of markers that currently have the highest total duration that don't overlap. We do this layer by layer to prioritize filling
      // the lower layers when possible
      const mwis = this.findMWIS(remainingMarkers);
      if (!mwis.length) break;

      this.renderRangeMarkers(mwis, layerNum);
      remainingMarkers = remainingMarkers.filter(
        (marker) => !mwis.includes(marker)
      );
      layerNum++;
    }
  }

  // Use dynamic programming to find maximum weight independent set (ie the set of markers that have the highest total duration that don't overlap)
  private findMWIS(markers: IMarker[]): IMarker[] {
    if (!markers.length) return [];

    // Sort markers by end time
    markers = markers
      .slice()
      .sort((a, b) => (a.end_seconds || 0) - (b.end_seconds || 0));
    const n = markers.length;

    // Compute p(j) for each marker. This is the index of the marker that has the highest end time that doesn't overlap with marker j
    const p: number[] = new Array(n).fill(-1);
    for (let j = 0; j < n; j++) {
      for (let i = j - 1; i >= 0; i--) {
        if ((markers[i].end_seconds || 0) <= markers[j].seconds) {
          p[j] = i;
          break;
        }
      }
    }

    // Initialize M[j]
    // Compute M[j] for each marker. This is the maximum total duration of markers that don't overlap with marker j
    const M: number[] = new Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      const include =
        (markers[j].end_seconds || 0) - markers[j].seconds + (M[p[j]] || 0);
      const exclude = j > 0 ? M[j - 1] : 0;
      M[j] = Math.max(include, exclude);
    }

    // Reconstruct optimal solution
    const findSolution = (j: number): IMarker[] => {
      if (j < 0) return [];
      const include =
        (markers[j].end_seconds || 0) - markers[j].seconds + (M[p[j]] || 0);
      const exclude = j > 0 ? M[j - 1] : 0;
      if (include >= exclude) {
        return [...findSolution(p[j]), markers[j]];
      } else {
        return findSolution(j - 1);
      }
    };

    return findSolution(n - 1);
  }

  removeMarker(marker: IMarker) {
    const i = this.markers.indexOf(marker);
    if (i === -1) return;

    this.markers.splice(i, 1);
    const markerSet = this.markerDivs.splice(i, 1)[0];

    if (markerSet.dot?.hasAttribute("marker-tooltip-shown")) {
      this.hideMarkerTooltip();
    }

    markerSet.dot?.remove();
    if (markerSet.range) markerSet.range.remove();
  }

  removeMarkers(markers: IMarker[]) {
    markers.forEach(this.removeMarker, this);
  }

  clearMarkers() {
    this.hideTimestampCopyPicker(); // CUSTOM
    for (const markerSet of this.markerDivs) {
      if (markerSet.dot?.hasAttribute("marker-tooltip-shown")) {
        this.hideMarkerTooltip();
      }

      markerSet.dot?.remove();
      if (markerSet.range) markerSet.range.remove();
    }
    this.markers = [];
    this.markerDivs = [];

    // CUSTOM: begin - clear negative markers
    for (const div of this.negativeMarkerDivs) {
      div.remove();
    }
    this.negativeMarkerDivs = [];
    // CUSTOM: end

    // CUSTOM: begin - clear O timestamp markers
    for (const div of this.oTimestampDivs) {
      div.remove();
    }
    this.oTimestampDivs = [];
    // CUSTOM: end
  }

  // CUSTOM: begin - add negative markers (displayed in red)
  addNegativeMarkers(negativeMarkers: INegativeMarker[]) {
    const duration = this.player.duration() || this._fallbackDuration; // CUSTOM
    const parent = this.player.el().querySelector(".vjs-progress-control");
    if (!parent || !duration) return;

    for (const marker of negativeMarkers) {
      const rangeDiv = videojs.dom.createEl("div") as HTMLDivElement;
      rangeDiv.className = "vjs-marker-range vjs-negative-marker-range";

      const startPercent = (marker.start_seconds / duration) * 100;
      const widthPercent =
        ((marker.end_seconds - marker.start_seconds) / duration) * 100;

      rangeDiv.style.left = `calc(15px + ${startPercent}% - ${
        startPercent * 0.3
      }px)`;
      rangeDiv.style.width = `calc(${widthPercent}% - ${widthPercent * 0.3}px)`;
      rangeDiv.style.bottom = "0px";
      rangeDiv.style.display = "block";
      // Force red color for negative markers
      rangeDiv.style.backgroundColor = "#dc3545";
      rangeDiv.style.opacity = "0.7";
      if (this.timestampCopyMode) {
        rangeDiv.classList.add("vjs-negative-marker-range-timestamp-copy");
        rangeDiv.title = "Choose a negative marker timestamp";
        rangeDiv.style.opacity = "0.95";
      }

      rangeDiv.addEventListener("click", (event) => {
        if (!this.timestampCopyMode) return;

        event.preventDefault();
        event.stopPropagation();
        this.showTimestampCopyPicker(marker, 0, rangeDiv, event.clientX);
      });

      rangeDiv.addEventListener("mouseenter", (event) => {
        if (this.timestampCopyMode) {
          this.showTimestampCopyPicker(marker, 0, rangeDiv, event.clientX);
          rangeDiv.toggleAttribute("marker-tooltip-shown", true);
          return;
        }

        const title = marker.name || "Skip Section";
        this.showMarkerTooltip(
          title,
          0,
          undefined,
          undefined,
          true,
          rangeDiv,
          undefined,
          undefined,
          undefined,
          {
            id: marker.id,
            seconds: marker.start_seconds,
            end_seconds: marker.end_seconds,
          },
          event.clientX
        );
        rangeDiv.toggleAttribute("marker-tooltip-shown", true);
      });

      rangeDiv.addEventListener("mouseout", () => {
        if (this.timestampCopyMode) {
          this.scheduleTimestampCopyPickerHide(rangeDiv);
        } else {
          this.scheduleMarkerTooltipHide(rangeDiv);
        }
        rangeDiv.toggleAttribute("marker-tooltip-shown", false);
      });

      rangeDiv.addEventListener("pointermove", (e) => {
        e.stopPropagation();
      });
      rangeDiv.addEventListener("pointerover", (e) => {
        e.stopPropagation();
      });
      rangeDiv.addEventListener("pointerout", (e) => {
        e.stopPropagation();
      });

      parent.appendChild(rangeDiv);
      this.negativeMarkerDivs.push(rangeDiv);
    }
  }
  // CUSTOM: end

  // CUSTOM: begin - add O timestamp markers (gold glowing dots on the seek bar)
  addOTimestampMarkers(entries: Array<{ ts: number; date: string }>) {
    const duration = this.player.duration() || this._fallbackDuration; // CUSTOM
    const seekBar = this.player.el().querySelector(".vjs-progress-holder");
    if (!seekBar || !duration || entries.length === 0) return;

    // Cluster: keep only one timestamp per 10-second window
    const sorted = [...entries].sort((a, b) => a.ts - b.ts);
    const clustered: Array<{ ts: number; date: string }> = [];
    let lastKept = -Infinity;
    for (const entry of sorted) {
      if (entry.ts - lastKept >= 10) {
        clustered.push(entry);
        lastKept = entry.ts;
      }
    }

    for (const { ts, date } of clustered) {
      const dot = videojs.dom.createEl("div") as HTMLDivElement;
      dot.className = "vjs-o-timestamp-marker";
      dot.style.left = `calc(${(ts / duration) * 100}% - 3px)`;
      // CUSTOM: tooltip shows the date the O was recorded
      const label = date
        ? new Date(date).toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : "O";

      dot.addEventListener("click", () => this.player.currentTime(ts));
      dot.addEventListener("mouseenter", () => {
        this.showMarkerTooltip(
          `O on ${label}`,
          0,
          undefined,
          undefined,
          false,
          dot
        );
        dot.toggleAttribute("marker-tooltip-shown", true);
      });
      dot.addEventListener("mouseout", () => {
        this.hideMarkerTooltip();
        dot.toggleAttribute("marker-tooltip-shown", false);
      });

      seekBar.appendChild(dot);
      this.oTimestampDivs.push(dot);
    }
  }
  // CUSTOM: end

  // Implementing the findColors method
  findColors(tagNames: string[]) {
    // Compute base hues for each tag
    const baseHues: { [tag: string]: number } = {};
    for (const tag of tagNames) {
      baseHues[tag] = this.computeBaseHue(tag);
    }

    // Adjust hues to avoid similar colors
    const adjustedHues = this.adjustHues(baseHues);

    // Convert adjusted hues to colors and store in tagColors dictionary
    for (const tag of tagNames) {
      this.tagColors[tag] =
        this.semanticTagColor(tag) ?? this.hueToColor(adjustedHues[tag]); // CUSTOM
    }
  }

  // Helper methods translated from Python

  // CUSTOM: begin - keep common role marker colors visibly distinct
  private semanticTagColor(tag: string): string | undefined {
    const normalized = tag.toLocaleLowerCase();

    if (
      /\b(bj|blow\s*job|blowjob|blow\w*|oral|suck\w*|fellatio)\b/.test(
        normalized
      )
    ) {
      return "#14b8d4cc";
    }

    if (/\b(fuck\w*|sex|anal|penetrat\w*|intercourse)\b/.test(normalized)) {
      return "#ff7a00cc";
    }
  }
  // CUSTOM: end

  // Compute base hue from tag name
  private computeBaseHue(tag: string): number {
    const hash = CryptoJS.SHA256(tag);
    const hashHex = hash.toString(CryptoJS.enc.Hex);
    const hashInt = BigInt(`0x${hashHex}`);
    const baseHue = Number(hashInt % BigInt(360)); // Map to [0, 360)
    return baseHue;
  }

  // Calculate minimum acceptable hue difference based on number of tags
  private calculateDeltaMin(N: number): number {
    const maxDeltaNeeded = 35;
    let scalingFactor: number;

    if (N <= 4) {
      scalingFactor = 0.8;
    } else if (N <= 10) {
      scalingFactor = 0.6;
    } else {
      scalingFactor = 0.4;
    }

    const deltaMin = Math.min((360 / N) * scalingFactor, maxDeltaNeeded);
    return deltaMin;
  }

  // Adjust hues to ensure minimum difference
  private adjustHues(baseHues: { [tag: string]: number }): {
    [tag: string]: number;
  } {
    const adjustedHues: { [tag: string]: number } = {};
    const tags = Object.keys(baseHues);
    const N = tags.length;
    const deltaMin = this.calculateDeltaMin(N);

    // Sort the tags by base hue
    const sortedTags = tags.sort((a, b) => baseHues[a] - baseHues[b]);
    // Get sorted base hues
    const baseHuesSorted = sortedTags.map((tag) => baseHues[tag]);

    // Unwrap hues to handle circular nature
    const unwrappedHues = [...baseHuesSorted];
    for (let i = 1; i < N; i++) {
      if (unwrappedHues[i] <= unwrappedHues[i - 1]) {
        unwrappedHues[i] += 360; // Unwrap by adding 360 degrees
      }
    }

    // Adjust hues to ensure minimum difference
    for (let i = 1; i < N; i++) {
      const requiredHue = unwrappedHues[i - 1] + deltaMin;
      if (unwrappedHues[i] < requiredHue) {
        unwrappedHues[i] = requiredHue; // Adjust hue minimally
      }
    }

    // Handle wrap-around difference
    const endGap = unwrappedHues[0] + 360 - unwrappedHues[N - 1];
    if (endGap < deltaMin) {
      // Adjust first and last hues minimally to increase end gap
      const adjustmentNeeded = (deltaMin - endGap) / 2;
      // Adjust the first hue backward, ensure it doesn't go below other hues
      unwrappedHues[0] = Math.max(
        unwrappedHues[0] - adjustmentNeeded,
        unwrappedHues[1] - 360 + deltaMin
      );
      // Adjust the last hue forward
      unwrappedHues[N - 1] += adjustmentNeeded;
    }

    // Wrap adjusted hues back to [0, 360)
    const adjustedHuesList = unwrappedHues.map((hue) => hue % 360);

    // Map adjusted hues back to tags
    for (let i = 0; i < N; i++) {
      adjustedHues[sortedTags[i]] = adjustedHuesList[i];
    }

    return adjustedHues;
  }

  // Convert hue to RGB color in hex format
  // CUSTOM: begin - avoids red hues (0-30 and 330-360) and gold hues (~45-65°)
  //   to reserve red for negative markers and gold for O timestamp markers
  private hueToColor(hue: number): string {
    // Step 1: Remap [0,360) → [30,330) to avoid reds (used by negative markers)
    let remappedHue = 30 + (hue % 360) * (300 / 360);

    // Step 2: Also skip the gold band [45,65) to reserve it for O timestamp markers.
    // If we land inside [45,65), push to 65. Then re-compress the remaining space.
    const GOLD_START = 45;
    const GOLD_END = 65;
    if (remappedHue >= GOLD_START && remappedHue < GOLD_END) {
      remappedHue = GOLD_END;
    } else if (remappedHue >= GOLD_END) {
      // Shift everything above gold band down so colors remain evenly spread.
      const goldWidth = GOLD_END - GOLD_START;
      remappedHue = remappedHue - goldWidth;
    }

    // Convert hue from degrees to [0, 1)
    const hueNormalized = remappedHue / 360.0;
    const saturation = 0.65;
    const value = 0.95;
    const rgb = this.hsvToRgb(hueNormalized, saturation, value);
    const alpha = 0.6; // Set the desired alpha value here
    const rgbColor = `#${this.toHex(rgb[0])}${this.toHex(rgb[1])}${this.toHex(
      rgb[2]
    )}${this.toHex(Math.round(alpha * 255))}`;
    return rgbColor;
  }
  // CUSTOM: end

  // Convert HSV to RGB
  private hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    let r, g, b;
    switch (i % 6) {
      case 0:
        r = v;
        g = t;
        b = p;
        break;
      case 1:
        r = q;
        g = v;
        b = p;
        break;
      case 2:
        r = p;
        g = v;
        b = t;
        break;
      case 3:
        r = p;
        g = q;
        b = v;
        break;
      case 4:
        r = t;
        g = p;
        b = v;
        break;
      case 5:
        r = v;
        g = p;
        b = q;
        break;
      default:
        r = v;
        g = t;
        b = p;
        break;
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  // Convert a number to two-digit hex string
  private toHex(value: number): string {
    return value.toString(16).padStart(2, "0");
  }
}

videojs.registerPlugin("markers", MarkersPlugin);

/* eslint-disable @typescript-eslint/naming-convention */
declare module "video.js" {
  interface VideoJsPlayer {
    markers: () => MarkersPlugin;
  }
  interface VideoJsPlayerPluginOptions {
    markers?: IMarkersOptions;
  }
}

export default MarkersPlugin;
