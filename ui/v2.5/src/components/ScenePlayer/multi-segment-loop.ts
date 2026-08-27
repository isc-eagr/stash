import videojs, { VideoJsPlayer } from "video.js";
import {
  getPlaybackBoundaryDelayMs,
  isPlaybackBoundaryDue,
} from "./playbackBoundary_custom"; // CUSTOM

export interface ILoopSegment {
  id: string;
  start: number;
  end: number;
  title?: string;
}

export type ILoopSegmentInput = Omit<ILoopSegment, "id">;

export interface IMultiSegmentLoopApi {
  addSegments: (segments: ILoopSegmentInput[]) => void;
  setSegments: (segments: ILoopSegmentInput[]) => void;
  clearSegments: () => void;
}

export interface IMultiSegmentLoopOptions {
  segments: ILoopSegment[];
  enabled: boolean;
  currentSegmentIndex: number;
  createButton?: boolean;
}

// Events emitted by the plugin
export type MultiSegmentLoopEvents = {
  segmentschange: (segments: ILoopSegment[]) => void;
  enabledchange: (enabled: boolean) => void;
  currentsegmentchange: (index: number, segment: ILoopSegment | null) => void;
  segmentloop: (fromSegment: ILoopSegment, toSegment: ILoopSegment) => void;
  loopsinglechange: (segmentId: string | null) => void;
};

class MultiSegmentLoopPlugin extends videojs.getPlugin("plugin") {
  private segments: ILoopSegment[] = [];
  private enabled: boolean = false;
  private currentSegmentIndex: number = 0;
  private pendingStart: number | null = null;
  private boundaryTimer: number | null = null; // CUSTOM
  private scheduledBoundary: number | null = null; // CUSTOM
  private loopSingleId: string | null = null; // ID of segment to loop single

  // CUSTOM: begin - stable listener references for precise boundary scheduling
  private readonly boundCheckLoop = this.checkLoop.bind(this);
  private readonly boundOnPlaying = this.onPlaying.bind(this);
  private readonly boundOnPause = this.onPause.bind(this);
  private readonly boundRescheduleBoundary = (): void => {
    this.scheduleBoundaryCheck(true);
  };
  // CUSTOM: end

  // Timeline visualization elements
  private segmentMarkers: Map<string, HTMLDivElement> = new Map();
  private pendingMarker: HTMLDivElement | null = null;
  private controlButton: { updateState?: () => void } | null = null;

  // Callback references for external listeners
  private onSegmentsChange?: (segments: ILoopSegment[]) => void;
  private onEnabledChange?: (enabled: boolean) => void;
  private onCurrentSegmentChange?: (
    index: number,
    segment: ILoopSegment | null
  ) => void;
  private onSegmentLoop?: (
    fromSegment: ILoopSegment,
    toSegment: ILoopSegment
  ) => void;
  private onLoopSingleChange?: (segmentId: string | null) => void;

  constructor(
    player: VideoJsPlayer,
    options?: Partial<IMultiSegmentLoopOptions>
  ) {
    super(player);

    if (options?.segments) {
      this.segments = [...options.segments];
    }
    if (options?.enabled !== undefined) {
      this.enabled = options.enabled;
    }
    if (options?.currentSegmentIndex !== undefined) {
      this.currentSegmentIndex = options.currentSegmentIndex;
    }

    player.ready(() => {
      this.setupTimeUpdateHandler();
      if (options?.createButton) {
        this.createControlButton();
      }
    });
  }

  private setupTimeUpdateHandler(): void {
    this.player.on("timeupdate", this.boundCheckLoop);
    this.player.on("playing", this.boundOnPlaying);
    this.player.on("pause", this.boundOnPause);
    // CUSTOM: begin - keep the one-shot timer aligned after rate and seek changes
    this.player.on("waiting", this.boundOnPause);
    this.player.on("ratechange", this.boundRescheduleBoundary);
    this.player.on("seeked", this.boundRescheduleBoundary);
    // CUSTOM: end
  }

  private onPlaying(): void {
    // When playing starts and loop is enabled, ensure we're at a valid position
    if (this.enabled && this.segments.length > 0) {
      const currentTime = this.player.currentTime();
      const currentSegment = this.segments[this.currentSegmentIndex];

      // If we're not within any segment, jump to current segment start
      if (
        currentSegment &&
        (currentTime < currentSegment.start || currentTime > currentSegment.end)
      ) {
        this.player.currentTime(currentSegment.start);
      }

      this.scheduleBoundaryCheck(true); // CUSTOM
    }
  }

  private onPause(): void {
    this.clearBoundaryTimer(); // CUSTOM
  }

  private checkLoop(): void {
    if (!this.enabled || this.segments.length === 0 || this.player.paused()) {
      this.clearBoundaryTimer(); // CUSTOM
      return;
    }

    const currentTime = this.player.currentTime();
    const currentSegment = this.segments[this.currentSegmentIndex];

    if (!currentSegment) {
      return;
    }

    // Check if we've reached the end of the current segment
    if (currentTime >= currentSegment.end) {
      this.advanceToNextSegment();
      return;
    }

    this.scheduleBoundaryCheck(); // CUSTOM
  }

  // CUSTOM: begin - schedule the exact media boundary instead of cutting 100 ms early
  private scheduleBoundaryCheck(force: boolean = false): void {
    if (!this.enabled || this.segments.length === 0 || this.player.paused()) {
      this.clearBoundaryTimer();
      return;
    }

    const currentSegment = this.segments[this.currentSegmentIndex];
    if (!currentSegment) {
      this.clearBoundaryTimer();
      return;
    }

    if (
      !force &&
      this.boundaryTimer !== null &&
      this.scheduledBoundary === currentSegment.end
    ) {
      return;
    }

    this.clearBoundaryTimer();
    this.scheduledBoundary = currentSegment.end;
    const delay = getPlaybackBoundaryDelayMs(
      this.player.currentTime(),
      currentSegment.end,
      this.player.playbackRate()
    );

    this.boundaryTimer = window.setTimeout(() => {
      this.boundaryTimer = null;
      this.scheduledBoundary = null;

      const segment = this.segments[this.currentSegmentIndex];
      if (!segment || !this.enabled || this.player.paused()) return;

      if (isPlaybackBoundaryDue(this.player.currentTime(), segment.end)) {
        this.advanceToNextSegment();
      } else {
        // Playback can stall while the wall-clock timer continues.
        this.scheduleBoundaryCheck(true);
      }
    }, delay);
  }

  private clearBoundaryTimer(): void {
    if (this.boundaryTimer !== null) {
      window.clearTimeout(this.boundaryTimer);
      this.boundaryTimer = null;
    }
    this.scheduledBoundary = null;
  }
  // CUSTOM: end

  private advanceToNextSegment(): void {
    const fromSegment = this.segments[this.currentSegmentIndex];

    // Check if single loop is enabled for the current segment
    if (
      this.loopSingleId &&
      fromSegment &&
      this.loopSingleId === fromSegment.id
    ) {
      // Loop back to the start of the same segment
      this.player.currentTime(fromSegment.start);
      this.scheduleBoundaryCheck(true); // CUSTOM
      return;
    }

    // Move to next segment, or wrap to first
    const nextIndex = (this.currentSegmentIndex + 1) % this.segments.length;
    this.currentSegmentIndex = nextIndex;

    const toSegment = this.segments[this.currentSegmentIndex];

    // Seek to start of next segment
    this.player.currentTime(toSegment.start);
    this.scheduleBoundaryCheck(true); // CUSTOM

    // Update visual markers
    this.updateActiveSegmentMarker();

    // Emit events
    if (this.onCurrentSegmentChange) {
      this.onCurrentSegmentChange(this.currentSegmentIndex, toSegment);
    }
    if (this.onSegmentLoop && fromSegment) {
      this.onSegmentLoop(fromSegment, toSegment);
    }
  }

  // Generate a unique ID for a segment
  private generateId(): string {
    return `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API

  /**
   * Get all segments
   */
  getSegments(): ILoopSegment[] {
    return [...this.segments];
  }

  /**
   * Set all segments (replaces existing)
   */
  setSegments(segments: ILoopSegment[]): void {
    this.segments = [...segments];
    this.currentSegmentIndex = 0;
    this.scheduleBoundaryCheck(true); // CUSTOM
    this.renderSegmentMarkers();
    this.updateControlButton();
    if (this.onSegmentsChange) {
      this.onSegmentsChange(this.getSegments());
    }
    if (this.onCurrentSegmentChange) {
      this.onCurrentSegmentChange(
        this.currentSegmentIndex,
        this.segments[0] || null
      );
    }
  }

  /**
   * Add a new segment
   */
  addSegment(start: number, end: number, title?: string): ILoopSegment {
    const segment: ILoopSegment = {
      id: this.generateId(),
      start: Math.min(start, end),
      end: Math.max(start, end),
      title,
    };
    this.segments.push(segment);
    this.scheduleBoundaryCheck(true); // CUSTOM
    this.renderSegmentMarkers();
    this.updateControlButton();
    if (this.onSegmentsChange) {
      this.onSegmentsChange(this.getSegments());
    }
    return segment;
  }

  /**
   * Remove a segment by ID
   */
  removeSegment(id: string): boolean {
    const index = this.segments.findIndex((s) => s.id === id);
    if (index === -1) return false;

    this.segments.splice(index, 1);

    // Adjust current segment index if needed
    if (this.currentSegmentIndex >= this.segments.length) {
      this.currentSegmentIndex = Math.max(0, this.segments.length - 1);
    }

    this.scheduleBoundaryCheck(true); // CUSTOM

    this.renderSegmentMarkers();
    this.updateControlButton();
    if (this.onSegmentsChange) {
      this.onSegmentsChange(this.getSegments());
    }
    if (this.onCurrentSegmentChange) {
      this.onCurrentSegmentChange(
        this.currentSegmentIndex,
        this.segments[this.currentSegmentIndex] || null
      );
    }
    return true;
  }

  /**
   * Update a segment by ID
   */
  updateSegment(id: string, start: number, end: number): boolean {
    const segment = this.segments.find((s) => s.id === id);
    if (!segment) return false;

    segment.start = Math.min(start, end);
    segment.end = Math.max(start, end);

    this.scheduleBoundaryCheck(true); // CUSTOM

    this.renderSegmentMarkers();
    this.updateControlButton();
    if (this.onSegmentsChange) {
      this.onSegmentsChange(this.getSegments());
    }
    return true;
  }

  /**
   * Clear all segments
   */
  clearSegments(): void {
    this.segments = [];
    this.currentSegmentIndex = 0;
    this.pendingStart = null;
    this.clearBoundaryTimer(); // CUSTOM
    this.renderSegmentMarkers();
    this.updateControlButton();
    if (this.onSegmentsChange) {
      this.onSegmentsChange(this.getSegments());
    }
    if (this.onCurrentSegmentChange) {
      this.onCurrentSegmentChange(0, null);
    }
  }

  /**
   * Start creating a new segment at current time
   * Call this once to set start, call again to set end and create segment
   */
  markPoint(): {
    action: "start" | "end";
    segment?: ILoopSegment;
    pendingStart?: number;
  } {
    const currentTime = this.player.currentTime();

    if (this.pendingStart === null) {
      // First click - set start point
      this.pendingStart = currentTime;
      this.renderPendingMarker();
      return { action: "start", pendingStart: currentTime };
    } else {
      // Second click - create segment
      const segment = this.addSegment(this.pendingStart, currentTime);
      this.pendingStart = null;
      this.clearPendingMarker();
      return { action: "end", segment };
    }
  }

  /**
   * Cancel pending segment creation
   */
  cancelPending(): void {
    this.pendingStart = null;
    this.clearPendingMarker();
  }

  /**
   * Get pending start time if any
   */
  getPendingStart(): number | null {
    return this.pendingStart;
  }

  /**
   * Check if loop is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable the loop
   */
  setEnabled(enabled: boolean): void {
    const wasEnabled = this.enabled;
    this.enabled = enabled;

    if (enabled && !wasEnabled && this.segments.length > 0) {
      // When enabling, jump to the start of the first segment
      this.currentSegmentIndex = 0;
      const segment = this.segments[0];
      this.player.currentTime(segment.start);
      if (this.onCurrentSegmentChange) {
        this.onCurrentSegmentChange(0, segment);
      }
    }

    if (enabled) {
      this.scheduleBoundaryCheck(true); // CUSTOM
    } else {
      this.clearBoundaryTimer(); // CUSTOM
    }

    this.updateActiveSegmentMarker();
    this.updateControlButton();
    if (this.onEnabledChange) {
      this.onEnabledChange(enabled);
    }
  }

  /**
   * Toggle loop on/off
   */
  toggleEnabled(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  /**
   * Get current segment index
   */
  getCurrentSegmentIndex(): number {
    return this.currentSegmentIndex;
  }

  /**
   * Get current segment
   */
  getCurrentSegment(): ILoopSegment | null {
    return this.segments[this.currentSegmentIndex] || null;
  }

  /**
   * Jump to a specific segment by index
   */
  jumpToSegment(index: number): boolean {
    if (index < 0 || index >= this.segments.length) return false;

    this.currentSegmentIndex = index;
    const segment = this.segments[index];
    this.player.currentTime(segment.start);
    this.scheduleBoundaryCheck(true); // CUSTOM

    this.updateActiveSegmentMarker();
    if (this.onCurrentSegmentChange) {
      this.onCurrentSegmentChange(index, segment);
    }
    return true;
  }

  /**
   * Jump to next segment
   */
  nextSegment(): void {
    if (this.segments.length === 0) return;
    const nextIndex = (this.currentSegmentIndex + 1) % this.segments.length;
    this.jumpToSegment(nextIndex);
  }

  /**
   * Jump to previous segment
   */
  previousSegment(): void {
    if (this.segments.length === 0) return;
    const prevIndex =
      this.currentSegmentIndex === 0
        ? this.segments.length - 1
        : this.currentSegmentIndex - 1;
    this.jumpToSegment(prevIndex);
  }

  /**
   * Reorder segments by moving a segment to a new position
   */
  reorderSegment(fromIndex: number, toIndex: number): boolean {
    if (
      fromIndex < 0 ||
      fromIndex >= this.segments.length ||
      toIndex < 0 ||
      toIndex >= this.segments.length
    ) {
      return false;
    }

    const [segment] = this.segments.splice(fromIndex, 1);
    this.segments.splice(toIndex, 0, segment);

    // Adjust current segment index to follow the segment if it was moved
    if (this.currentSegmentIndex === fromIndex) {
      this.currentSegmentIndex = toIndex;
    } else if (
      fromIndex < this.currentSegmentIndex &&
      toIndex >= this.currentSegmentIndex
    ) {
      this.currentSegmentIndex--;
    } else if (
      fromIndex > this.currentSegmentIndex &&
      toIndex <= this.currentSegmentIndex
    ) {
      this.currentSegmentIndex++;
    }

    this.scheduleBoundaryCheck(true); // CUSTOM
    this.renderSegmentMarkers();
    if (this.onSegmentsChange) {
      this.onSegmentsChange(this.getSegments());
    }
    return true;
  }

  // Event listener setters
  setOnSegmentsChange(callback: (segments: ILoopSegment[]) => void): void {
    this.onSegmentsChange = callback;
  }

  setOnEnabledChange(callback: (enabled: boolean) => void): void {
    this.onEnabledChange = callback;
  }

  setOnCurrentSegmentChange(
    callback: (index: number, segment: ILoopSegment | null) => void
  ): void {
    this.onCurrentSegmentChange = callback;
  }

  setOnSegmentLoop(
    callback: (fromSegment: ILoopSegment, toSegment: ILoopSegment) => void
  ): void {
    this.onSegmentLoop = callback;
  }

  setOnLoopSingleChange(callback: (segmentId: string | null) => void): void {
    this.onLoopSingleChange = callback;
  }

  // Single segment loop methods

  /**
   * Get the ID of the segment that's set to loop single
   */
  getLoopSingleId(): string | null {
    return this.loopSingleId;
  }

  /**
   * Set a segment to loop single by ID. Pass null to disable single loop.
   * When enabling, immediately jumps to that segment.
   */
  setLoopSingleId(segmentId: string | null): void {
    this.loopSingleId = segmentId;

    // If enabling single loop, jump to that segment immediately
    if (segmentId !== null) {
      const segmentIndex = this.segments.findIndex((s) => s.id === segmentId);
      if (segmentIndex !== -1) {
        this.jumpToSegment(segmentIndex);
      }
    }

    this.updateActiveSegmentMarker();
    if (this.onLoopSingleChange) {
      this.onLoopSingleChange(segmentId);
    }
  }

  /**
   * Toggle single loop for a segment by ID
   */
  toggleLoopSingle(segmentId: string): void {
    if (this.loopSingleId === segmentId) {
      this.setLoopSingleId(null);
    } else {
      this.setLoopSingleId(segmentId);
    }
  }

  // Timeline visualization methods

  /**
   * Render all segment markers on the timeline
   */
  renderSegmentMarkers(): void {
    this.clearSegmentMarkers();

    const duration = this.player.duration();
    const progressControl = this.player
      .el()
      .querySelector(".vjs-progress-control");

    if (!progressControl || !duration) return;

    this.segments.forEach((segment, index) => {
      this.renderSegmentMarker(segment, index, duration, progressControl);
    });

    // Also render pending marker if exists
    this.renderPendingMarker();
  }

  private renderSegmentMarker(
    segment: ILoopSegment,
    index: number,
    duration: number,
    parent: Element
  ): void {
    const rangeDiv = document.createElement("div");
    rangeDiv.className = "vjs-multi-segment-marker";

    const startPercent = (segment.start / duration) * 100;
    const widthPercent = ((segment.end - segment.start) / duration) * 100;

    // Position similar to range markers in the markers plugin
    rangeDiv.style.left = `calc(15px + ${startPercent}% - ${
      startPercent * 0.3
    }px)`;
    rangeDiv.style.width = `calc(${widthPercent}% - ${widthPercent * 0.3}px)`;

    // Highlight current segment when enabled
    if (this.enabled && index === this.currentSegmentIndex) {
      rangeDiv.classList.add("active");
    }

    // Highlight single loop segment
    if (this.loopSingleId === segment.id) {
      rangeDiv.classList.add("loop-single");
    }

    // Add segment number label
    const label = document.createElement("span");
    label.className = "segment-label";
    label.textContent = String(index + 1);
    rangeDiv.appendChild(label);

    // Click to jump to segment
    rangeDiv.addEventListener("click", (e) => {
      e.stopPropagation();
      this.jumpToSegment(index);
    });

    parent.appendChild(rangeDiv);
    this.segmentMarkers.set(segment.id, rangeDiv);
  }

  private renderPendingMarker(): void {
    this.clearPendingMarker();

    if (this.pendingStart === null) return;

    const duration = this.player.duration();
    const progressControl = this.player
      .el()
      .querySelector(".vjs-progress-control");

    if (!progressControl || !duration) return;

    const markerDiv = document.createElement("div");
    markerDiv.className = "vjs-multi-segment-pending-marker";

    const startPercent = (this.pendingStart / duration) * 100;
    markerDiv.style.left = `calc(15px + ${startPercent}% - ${
      startPercent * 0.3
    }px)`;

    progressControl.appendChild(markerDiv);
    this.pendingMarker = markerDiv;
  }

  private clearSegmentMarkers(): void {
    this.segmentMarkers.forEach((marker) => {
      marker.remove();
    });
    this.segmentMarkers.clear();
  }

  private clearPendingMarker(): void {
    if (this.pendingMarker) {
      this.pendingMarker.remove();
      this.pendingMarker = null;
    }
  }

  /**
   * Update the active segment highlighting
   */
  updateActiveSegmentMarker(): void {
    this.segmentMarkers.forEach((marker, id) => {
      const index = this.segments.findIndex((s) => s.id === id);
      if (this.enabled && index === this.currentSegmentIndex) {
        marker.classList.add("active");
      } else {
        marker.classList.remove("active");
      }
      // Update single loop styling
      if (this.loopSingleId === id) {
        marker.classList.add("loop-single");
      } else {
        marker.classList.remove("loop-single");
      }
    });
  }

  /**
   * Create a toggle button in the control bar
   */
  private createControlButton(): void {
    const Button = videojs.getComponent("Button");
    const plugin = this;

    class MultiSegmentLoopButton extends Button {
      constructor(player: VideoJsPlayer, options: Record<string, unknown>) {
        super(player, options);
        this.controlText("Multi-Segment Loop");
        this.addClass("vjs-multi-segment-loop-button");
        this.updateState();
      }

      buildCSSClass(): string {
        return `vjs-multi-segment-loop-button ${super.buildCSSClass()}`;
      }

      handleClick(): void {
        plugin.toggleEnabled();
        this.updateState();
      }

      updateState(): void {
        if (plugin.isEnabled() && plugin.getSegments().length > 0) {
          this.addClass("vjs-multi-segment-loop-active");
        } else {
          this.removeClass("vjs-multi-segment-loop-active");
        }
      }
    }

    videojs.registerComponent("MultiSegmentLoopButton", MultiSegmentLoopButton);

    const controlBar = this.player.getChild("ControlBar");
    if (controlBar) {
      const button = new MultiSegmentLoopButton(this.player, {});
      this.controlButton = button;

      // Add button before fullscreen button
      const fullscreenToggle = controlBar.getChild("FullscreenToggle");
      if (fullscreenToggle) {
        controlBar.addChild(
          button,
          {},
          controlBar.children().indexOf(fullscreenToggle)
        );
      } else {
        controlBar.addChild(button);
      }
    }
  }

  /**
   * Update control button state (called when enabled or segments change)
   */
  private updateControlButton(): void {
    this.controlButton?.updateState?.();
  }

  dispose(): void {
    this.clearBoundaryTimer(); // CUSTOM
    this.clearSegmentMarkers();
    this.clearPendingMarker();
    this.player.off("timeupdate", this.boundCheckLoop);
    this.player.off("playing", this.boundOnPlaying);
    this.player.off("pause", this.boundOnPause);
    // CUSTOM: begin
    this.player.off("waiting", this.boundOnPause);
    this.player.off("ratechange", this.boundRescheduleBoundary);
    this.player.off("seeked", this.boundRescheduleBoundary);
    // CUSTOM: end
    super.dispose();
  }
}

// Register the plugin with VideoJS
videojs.registerPlugin("multiSegmentLoop", MultiSegmentLoopPlugin);

export default MultiSegmentLoopPlugin;
