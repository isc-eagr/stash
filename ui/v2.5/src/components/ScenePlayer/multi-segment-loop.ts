import videojs, { VideoJsPlayer } from "video.js";
import { SceneMarkerRepeatCustom } from "./sceneMarkerRepeat_custom"; // CUSTOM
import {
  nextSelectedSegmentCustom,
  remoteLoopRevisionCustom,
} from "./remoteLoopSelection_custom"; // CUSTOM
import {
  getPlaybackBoundaryDelayMs,
  isPlaybackBoundaryDue,
} from "./playbackBoundary_custom"; // CUSTOM
// CUSTOM: begin
import {
  findLoopSegmentIndexAtTime,
  loopSegmentContainsTime,
  loopSegmentIndexAfterRemoval,
  loopSegmentIndexForEnable,
  LOOP_SEGMENT_START_TOLERANCE_SECONDS,
  nudgedLoopSegmentBounds,
  type LoopSegmentEdge,
} from "./multiSegmentLoopState_custom";
// CUSTOM: end

export interface ILoopSegment {
  id: string;
  start: number;
  end: number;
  title?: string;
}

export type ILoopSegmentInput = Omit<ILoopSegment, "id">;

// CUSTOM: begin - immutable state published to every subscriber
export interface IMultiSegmentLoopSnapshot {
  segments: ILoopSegment[];
  enabled: boolean;
  currentSegmentIndex: number;
  loopSingleId: string | null;
  pendingStart: number | null;
  remoteSelectedIds: string[];
  markerRepeatId: string | null;
}

export type MultiSegmentLoopListener = (
  snapshot: IMultiSegmentLoopSnapshot
) => void;
// CUSTOM: end

export interface IMultiSegmentLoopOptions {
  segments: ILoopSegment[];
  enabled: boolean;
  currentSegmentIndex: number;
}

class MultiSegmentLoopPlugin extends videojs.getPlugin("plugin") {
  private segments: ILoopSegment[] = [];
  private enabled: boolean = false;
  private currentSegmentIndex: number = 0;
  private pendingStart: number | null = null;
  private boundaryTimer: number | null = null; // CUSTOM
  private scheduledBoundary: number | null = null; // CUSTOM
  private loopSingleId: string | null = null; // ID of segment to loop single
  private remoteSelectedIds: string[] = []; // CUSTOM: temporary playback subset
  private markerRepeat = new SceneMarkerRepeatCustom(); // CUSTOM
  // CUSTOM: begin - subscribers and seek bookkeeping
  private listeners = new Set<MultiSegmentLoopListener>();
  private snapshot: IMultiSegmentLoopSnapshot | null = null;
  private internalSeekTarget: number | null = null;
  private seekInProgress = false;
  // CUSTOM: end

  // CUSTOM: begin - remote selection preserves segments and preset configuration
  getRemoteLoopState() {
    return {
      loop_enabled: this.enabled,
      loop_revision: remoteLoopRevisionCustom(this.enabled, this.segments),
      loop_segments: this.segments.map((s) => ({ ...s, title: s.title ?? "" })),
      selected_segment_ids: this.selectedIds(),
    };
  }

  selectRemoteSegments(ids: string[], revision: string): boolean {
    if (
      !this.enabled ||
      revision !== this.getRemoteLoopState().loop_revision ||
      ids.some((id) => !this.segments.some((s) => s.id === id))
    )
      return false;
    this.remoteSelectedIds = [...new Set(ids)];
    if (
      ids.length &&
      !ids.includes(this.segments[this.currentSegmentIndex]?.id)
    ) {
      this.jumpToSegment(this.segments.findIndex((s) => ids.includes(s.id)));
    } else if (ids.length) {
      const segment = this.segments[this.currentSegmentIndex];
      const time = this.player.currentTime();
      if (time < segment.start || time >= segment.end) {
        this.jumpToSegment(this.currentSegmentIndex);
      }
    }
    this.scheduleBoundaryCheck(true);
    this.emitChange();
    return true;
  }

  private selectedIds(): string[] {
    return this.remoteSelectedIds.filter((id) =>
      this.segments.some((s) => s.id === id)
    );
  }
  // CUSTOM: end

  // CUSTOM: begin - stable listener references for precise boundary scheduling
  private readonly boundCheckLoop = this.checkLoop.bind(this);
  private readonly boundOnPlaying = this.onPlaying.bind(this);
  private readonly boundOnPause = this.onPause.bind(this);
  private readonly boundOnSeeking = this.onSeeking.bind(this);
  private readonly boundClearSeek = (): void => {
    this.seekInProgress = false;
    this.internalSeekTarget = null;
    if (this.markerRepeat.active) {
      this.markerRepeat.clear();
      this.clearBoundaryTimer();
      this.emitChange();
    }
  };
  private readonly boundOnEnded = (): void => {
    if (!this.markerRepeat.active) return;
    this.advanceToNextSegment();
    this.player.play()?.catch(() => {});
  };
  private readonly boundOnSeeked = this.onSeeked.bind(this);
  private readonly boundRescheduleBoundary = (): void => {
    this.scheduleBoundaryCheck(true);
  };
  // CUSTOM: end

  // Timeline visualization elements
  private segmentMarkers: Map<string, HTMLDivElement> = new Map();
  private pendingMarker: HTMLDivElement | null = null;

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
    });
  }

  private setupTimeUpdateHandler(): void {
    this.player.on("timeupdate", this.boundCheckLoop);
    this.player.on("playing", this.boundOnPlaying);
    this.player.on("pause", this.boundOnPause);
    // CUSTOM: begin - keep the one-shot timer aligned after rate and seek changes
    this.player.on("waiting", this.boundOnPause);
    this.player.on("ratechange", this.boundRescheduleBoundary);
    this.player.on("seeking", this.boundOnSeeking);
    this.player.on("seeked", this.boundOnSeeked);
    this.player.on("loadstart", this.boundClearSeek);
    this.player.on("durationchange", this.boundRenderSegmentMarkers);
    this.player.on("ended", this.boundOnEnded);
    // CUSTOM: end
  }

  // CUSTOM: begin - subscription API
  /** Returns the current state. The object is replaced, never mutated. */
  getSnapshot(): IMultiSegmentLoopSnapshot {
    if (!this.snapshot) {
      this.snapshot = {
        segments: this.segments.map((segment) => ({ ...segment })),
        enabled: this.enabled,
        currentSegmentIndex: this.currentSegmentIndex,
        loopSingleId: this.loopSingleId,
        pendingStart: this.pendingStart,
        remoteSelectedIds: this.selectedIds(),
        markerRepeatId: this.markerRepeat.active?.markerId ?? null,
      };
    }
    return this.snapshot;
  }

  subscribe(listener: MultiSegmentLoopListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitChange(): void {
    this.snapshot = null;
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  toggleMarkerRepeat(markerId: string, segment: ILoopSegmentInput): void {
    const target = this.markerRepeat.toggle(
      markerId,
      segment,
      this.player.currentTime(),
      this.player.duration()
    );
    if (target === null) return;
    this.clearBoundaryTimer();
    this.seekTo(target);
    this.scheduleBoundaryCheck(true);
    this.emitChange();
  }

  private getPlaybackSegment(): ILoopSegmentInput | undefined {
    return (
      this.markerRepeat.active?.segment ??
      (this.enabled ? this.segments[this.currentSegmentIndex] : undefined)
    );
  }

  private seekTo(time: number): void {
    this.internalSeekTarget = time;
    this.player.currentTime(time);
  }

  private readonly boundRenderSegmentMarkers = (): void => {
    this.renderSegmentMarkers();
  };

  // Browsers report the new time before "seeked", so hold the loop until then.
  private onSeeking(): void {
    this.seekInProgress = true;
    this.clearBoundaryTimer();
  }

  // A user seek into another segment makes it the current segment.
  private onSeeked(): void {
    this.seekInProgress = false;
    const internalTarget = this.internalSeekTarget;
    this.internalSeekTarget = null;
    if (this.markerRepeat.active) {
      this.checkLoop();
      this.scheduleBoundaryCheck(true);
      return;
    }
    const time = this.player.currentTime();
    const userSeek =
      internalTarget === null ||
      Math.abs(time - internalTarget) > LOOP_SEGMENT_START_TOLERANCE_SECONDS;
    if (userSeek && !this.adoptSegmentAtTime(time) && !this.player.paused()) {
      // A seek outside every segment returns to the current one while playing.
      this.jumpToSegment(this.currentSegmentIndex);
      return;
    }
    this.scheduleBoundaryCheck(true);
  }

  /** Returns false when the loop is on and the time is outside every segment. */
  private adoptSegmentAtTime(time: number): boolean {
    if (!this.enabled || this.segments.length === 0) return true;
    const current = this.segments[this.currentSegmentIndex];
    if (current && loopSegmentContainsTime(current, time)) return true;

    const index = findLoopSegmentIndexAtTime(
      this.segments,
      time,
      this.currentSegmentIndex,
      this.selectedIds()
    );
    if (index < 0) return false;

    this.currentSegmentIndex = index;
    if (this.loopSingleId !== null) {
      this.loopSingleId = this.segments[index].id;
    }
    this.updateActiveSegmentMarker();
    this.emitChange();
    return true;
  }
  // CUSTOM: end

  private onPlaying(): void {
    // CUSTOM: the temporary marker takes precedence over configured segments.
    if (this.markerRepeat.active) {
      this.checkLoop();
      return;
    }
    // When playing starts and loop is enabled, ensure we're at a valid position
    if (this.enabled && this.segments.length > 0) {
      const currentTime = this.player.currentTime();
      const currentSegment = this.segments[this.currentSegmentIndex];

      // If we're not within any segment, jump to current segment start
      if (
        currentSegment &&
        (currentTime < currentSegment.start || currentTime > currentSegment.end)
      ) {
        this.seekTo(currentSegment.start); // CUSTOM
      }

      this.scheduleBoundaryCheck(true); // CUSTOM
    }
  }

  private onPause(): void {
    this.clearBoundaryTimer(); // CUSTOM
  }

  private checkLoop(): void {
    // CUSTOM: begin - repeat without changing the loop configuration or selection
    const repeat = this.markerRepeat.active;
    if (repeat) {
      if (this.player.paused()) {
        this.clearBoundaryTimer();
        return;
      }
      if (this.seekInProgress || this.player.seeking?.()) return;
      const time = this.player.currentTime();
      if (
        time >= repeat.segment.end ||
        time < repeat.segment.start - LOOP_SEGMENT_START_TOLERANCE_SECONDS
      ) {
        this.advanceToNextSegment();
      } else {
        this.scheduleBoundaryCheck();
      }
      return;
    }
    // CUSTOM: end
    if (!this.enabled || this.segments.length === 0 || this.player.paused()) {
      this.clearBoundaryTimer(); // CUSTOM
      return;
    }
    if (this.seekInProgress || this.player.seeking?.()) return; // CUSTOM: wait for the seek to land

    const currentTime = this.player.currentTime();
    const currentSegment = this.segments[this.currentSegmentIndex];

    if (!currentSegment) {
      return;
    }

    // CUSTOM: keep the subset valid after local segment removal or editing.
    const selected = this.selectedIds();
    if (selected.length && !selected.includes(currentSegment.id)) {
      this.jumpToSegment(
        this.segments.findIndex((s) => selected.includes(s.id))
      );
      return;
    }

    // Check if we've reached the end of the current segment
    if (currentTime >= currentSegment.end) {
      this.advanceToNextSegment();
      return;
    }

    // CUSTOM: never play the gap before the current segment after an edit or removal.
    if (
      currentTime <
      currentSegment.start - LOOP_SEGMENT_START_TOLERANCE_SECONDS
    ) {
      this.jumpToSegment(this.currentSegmentIndex);
      return;
    }

    this.scheduleBoundaryCheck(); // CUSTOM
  }

  // CUSTOM: begin - schedule the exact media boundary instead of cutting 100 ms early
  private scheduleBoundaryCheck(force: boolean = false): void {
    const currentSegment = this.getPlaybackSegment();
    if (!currentSegment || this.player.paused()) {
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

      const segment = this.getPlaybackSegment();
      if (!segment || this.player.paused()) return;
      if (this.seekInProgress) return; // CUSTOM: "seeked" reschedules

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
    // CUSTOM: a temporary marker never advances the configured loop's index.
    if (this.markerRepeat.active) {
      this.seekTo(this.markerRepeat.active.segment.start);
      this.scheduleBoundaryCheck(true);
      return;
    }
    const fromSegment = this.segments[this.currentSegmentIndex];

    // Check if single loop is enabled for the current segment
    if (
      this.remoteSelectedIds.length === 0 && // CUSTOM: subset takes precedence
      this.loopSingleId &&
      fromSegment &&
      this.loopSingleId === fromSegment.id
    ) {
      // Loop back to the start of the same segment
      this.seekTo(fromSegment.start); // CUSTOM
      this.scheduleBoundaryCheck(true); // CUSTOM
      return;
    }

    // Move to next segment, or wrap to first
    const nextIndex = nextSelectedSegmentCustom(
      this.segments,
      this.selectedIds(),
      this.currentSegmentIndex
    ); // CUSTOM
    this.currentSegmentIndex = nextIndex;

    const toSegment = this.segments[this.currentSegmentIndex];

    // Seek to start of next segment
    this.seekTo(toSegment.start); // CUSTOM
    this.scheduleBoundaryCheck(true); // CUSTOM

    // Update visual markers
    this.updateActiveSegmentMarker();
    this.emitChange(); // CUSTOM
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
    this.remoteSelectedIds = []; // CUSTOM
    this.loopSingleId = null; // CUSTOM
    this.segments = segments.map((segment) => ({ ...segment })); // CUSTOM
    this.currentSegmentIndex = 0;
    this.scheduleBoundaryCheck(true); // CUSTOM
    this.renderSegmentMarkers();
    this.emitChange(); // CUSTOM
  }

  /**
   * Add a new segment
   */
  addSegment(start: number, end: number, title?: string): ILoopSegment {
    const [segment] = this.addSegments([{ start, end, title }]); // CUSTOM
    return segment;
  }

  // CUSTOM: begin - add several segments with one state update
  addSegments(inputs: ILoopSegmentInput[]): ILoopSegment[] {
    const added = inputs.map(({ start, end, title }) => ({
      id: this.generateId(),
      start: Math.min(start, end),
      end: Math.max(start, end),
      title,
    }));
    if (!added.length) return added;

    this.segments = [...this.segments, ...added];
    this.scheduleBoundaryCheck(true);
    this.renderSegmentMarkers();
    this.emitChange();
    return added;
  }
  // CUSTOM: end

  /**
   * Remove a segment by ID
   */
  removeSegment(id: string): boolean {
    return this.removeSegments([id]) > 0; // CUSTOM
  }

  // CUSTOM: begin - removal keeps the playing segment selected
  removeSegments(ids: string[]): number {
    const removedIds = new Set(
      ids.filter((id) => this.segments.some((segment) => segment.id === id))
    );
    if (!removedIds.size) return 0;

    this.currentSegmentIndex = loopSegmentIndexAfterRemoval(
      this.segments,
      this.currentSegmentIndex,
      removedIds
    );
    this.segments = this.segments.filter(
      (segment) => !removedIds.has(segment.id)
    );
    this.remoteSelectedIds = this.remoteSelectedIds.filter(
      (selected) => !removedIds.has(selected)
    );
    if (this.loopSingleId && removedIds.has(this.loopSingleId)) {
      this.loopSingleId = null;
    }

    this.scheduleBoundaryCheck(true);
    this.renderSegmentMarkers();
    this.emitChange();
    return removedIds.size;
  }
  // CUSTOM: end

  /**
   * Update a segment by ID
   */
  updateSegment(id: string, start: number, end: number): boolean {
    const segment = this.segments.find((s) => s.id === id);
    if (!segment) return false;

    // CUSTOM: replace instead of mutating so subscribers see the edit
    this.segments = this.segments.map((s) =>
      s.id === id
        ? { ...s, start: Math.min(start, end), end: Math.max(start, end) }
        : s
    );

    this.scheduleBoundaryCheck(true); // CUSTOM

    this.renderSegmentMarkers();
    this.emitChange(); // CUSTOM
    return true;
  }

  // CUSTOM: begin - boundary edits shared by every loop editor
  setSegmentBoundaryToCurrentTime(id: string, edge: LoopSegmentEdge): boolean {
    const segment = this.segments.find((s) => s.id === id);
    if (!segment) return false;
    const time = this.player.currentTime() || 0;
    return edge === "start"
      ? this.updateSegment(id, time, segment.end)
      : this.updateSegment(id, segment.start, time);
  }

  nudgeSegmentBoundary(
    id: string,
    edge: LoopSegmentEdge,
    deltaSeconds: number
  ): boolean {
    const segment = this.segments.find((s) => s.id === id);
    if (!segment) return false;
    const { start, end } = nudgedLoopSegmentBounds(
      segment,
      edge,
      deltaSeconds,
      this.player.duration()
    );
    return this.updateSegment(id, start, end);
  }
  // CUSTOM: end

  /**
   * Clear all segments
   */
  clearSegments(): void {
    this.remoteSelectedIds = []; // CUSTOM
    this.loopSingleId = null; // CUSTOM
    this.segments = [];
    this.currentSegmentIndex = 0;
    this.pendingStart = null;
    this.clearBoundaryTimer(); // CUSTOM
    this.renderSegmentMarkers();
    this.emitChange(); // CUSTOM
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
      this.emitChange(); // CUSTOM
      return { action: "start", pendingStart: currentTime };
    } else {
      // Second click - create segment
      const start = this.pendingStart;
      this.pendingStart = null;
      this.clearPendingMarker();
      const segment = this.addSegment(start, currentTime);
      return { action: "end", segment };
    }
  }

  /**
   * Cancel pending segment creation
   */
  cancelPending(): void {
    this.pendingStart = null;
    this.clearPendingMarker();
    this.emitChange(); // CUSTOM
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
    // CUSTOM: turning the loop off also ends temporary subset/single-segment modes
    if (!enabled) {
      this.remoteSelectedIds = [];
      this.loopSingleId = null;
    }
    const wasEnabled = this.enabled;
    this.enabled = enabled;

    if (enabled && !wasEnabled && this.segments.length > 0) {
      // CUSTOM: stay in the segment under the playhead, or start at the next one
      const { index, seek } = loopSegmentIndexForEnable(
        this.segments,
        this.player.currentTime(),
        this.currentSegmentIndex
      );
      this.currentSegmentIndex = index;
      if (seek) this.seekTo(this.segments[index].start);
    }

    if (enabled) {
      this.scheduleBoundaryCheck(true); // CUSTOM
    } else {
      this.clearBoundaryTimer(); // CUSTOM
    }

    this.updateActiveSegmentMarker();
    this.emitChange(); // CUSTOM
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
    // CUSTOM: an explicit local jump outside the subset restores normal playback.
    if (
      this.remoteSelectedIds.length &&
      !this.remoteSelectedIds.includes(this.segments[index].id)
    )
      this.remoteSelectedIds = [];
    // CUSTOM: single-segment mode follows an explicit jump.
    if (this.loopSingleId !== null) {
      this.loopSingleId = this.segments[index].id;
    }

    this.currentSegmentIndex = index;
    const segment = this.segments[index];
    this.seekTo(segment.start); // CUSTOM
    this.scheduleBoundaryCheck(true); // CUSTOM

    this.updateActiveSegmentMarker();
    this.emitChange(); // CUSTOM
    return true;
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

    const segments = [...this.segments]; // CUSTOM
    const [segment] = segments.splice(fromIndex, 1);
    segments.splice(toIndex, 0, segment);
    this.segments = segments; // CUSTOM

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
    this.emitChange(); // CUSTOM
    return true;
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
   * When enabling, turns the loop on and jumps to that segment.
   */
  setLoopSingleId(segmentId: string | null): void {
    this.loopSingleId = segmentId;

    // If enabling single loop, jump to that segment immediately
    if (segmentId !== null) {
      const segmentIndex = this.segments.findIndex((s) => s.id === segmentId);
      if (segmentIndex !== -1) {
        this.enabled = true; // CUSTOM: repeating one segment requires the loop to be on
        this.jumpToSegment(segmentIndex);
      }
    }

    this.updateActiveSegmentMarker();
    this.emitChange(); // CUSTOM
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

  dispose(): void {
    this.clearBoundaryTimer(); // CUSTOM
    this.clearSegmentMarkers();
    this.clearPendingMarker();
    this.listeners.clear(); // CUSTOM
    this.player.off("timeupdate", this.boundCheckLoop);
    this.player.off("playing", this.boundOnPlaying);
    this.player.off("pause", this.boundOnPause);
    // CUSTOM: begin
    this.player.off("waiting", this.boundOnPause);
    this.player.off("ratechange", this.boundRescheduleBoundary);
    this.player.off("seeking", this.boundOnSeeking);
    this.player.off("seeked", this.boundOnSeeked);
    this.player.off("loadstart", this.boundClearSeek);
    this.player.off("durationchange", this.boundRenderSegmentMarkers);
    this.player.off("ended", this.boundOnEnded);
    this.markerRepeat.clear();
    // CUSTOM: end
    super.dispose();
  }
}

// Register the plugin with VideoJS
videojs.registerPlugin("multiSegmentLoop", MultiSegmentLoopPlugin);

export default MultiSegmentLoopPlugin;
