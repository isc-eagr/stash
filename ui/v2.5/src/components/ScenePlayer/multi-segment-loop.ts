import videojs, { VideoJsPlayer } from "video.js";

export interface ILoopSegment {
  id: string;
  start: number;
  end: number;
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
};

class MultiSegmentLoopPlugin extends videojs.getPlugin("plugin") {
  private segments: ILoopSegment[] = [];
  private enabled: boolean = false;
  private currentSegmentIndex: number = 0;
  private pendingStart: number | null = null;
  private checkInterval: number | null = null;
  private loopMargin: number = 0.1; // margin in seconds before end to trigger loop

  // Timeline visualization elements
  private segmentMarkers: Map<string, HTMLDivElement> = new Map();
  private pendingMarker: HTMLDivElement | null = null;
  private controlButton: any = null;

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

  constructor(player: VideoJsPlayer, options?: Partial<IMultiSegmentLoopOptions>) {
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
    this.player.on("timeupdate", this.checkLoop.bind(this));
    this.player.on("playing", this.onPlaying.bind(this));
    this.player.on("pause", this.onPause.bind(this));
  }

  private onPlaying(): void {
    // When playing starts and loop is enabled, ensure we're at a valid position
    if (this.enabled && this.segments.length > 0) {
      const currentTime = this.player.currentTime();
      const currentSegment = this.segments[this.currentSegmentIndex];
      
      // If we're not within any segment, jump to current segment start
      if (currentSegment && (currentTime < currentSegment.start || currentTime > currentSegment.end)) {
        this.player.currentTime(currentSegment.start);
      }
    }
  }

  private onPause(): void {
    // Nothing specific needed on pause for now
  }

  private checkLoop(): void {
    if (!this.enabled || this.segments.length === 0 || this.player.paused()) {
      return;
    }

    const currentTime = this.player.currentTime();
    const currentSegment = this.segments[this.currentSegmentIndex];

    if (!currentSegment) {
      return;
    }

    // Check if we've reached the end of the current segment
    if (currentTime >= currentSegment.end - this.loopMargin) {
      this.advanceToNextSegment();
    }
  }

  private advanceToNextSegment(): void {
    const fromSegment = this.segments[this.currentSegmentIndex];
    
    // Move to next segment, or wrap to first
    const nextIndex = (this.currentSegmentIndex + 1) % this.segments.length;
    this.currentSegmentIndex = nextIndex;
    
    const toSegment = this.segments[this.currentSegmentIndex];
    
    // Seek to start of next segment
    this.player.currentTime(toSegment.start);
    
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
  addSegment(start: number, end: number): ILoopSegment {
    const segment: ILoopSegment = {
      id: this.generateId(),
      start: Math.min(start, end),
      end: Math.max(start, end),
    };
    this.segments.push(segment);
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
  markPoint(): { action: "start" | "end"; segment?: ILoopSegment; pendingStart?: number } {
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
    const prevIndex = this.currentSegmentIndex === 0 
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
    } else if (fromIndex < this.currentSegmentIndex && toIndex >= this.currentSegmentIndex) {
      this.currentSegmentIndex--;
    } else if (fromIndex > this.currentSegmentIndex && toIndex <= this.currentSegmentIndex) {
      this.currentSegmentIndex++;
    }
    
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

  // Timeline visualization methods

  /**
   * Render all segment markers on the timeline
   */
  renderSegmentMarkers(): void {
    this.clearSegmentMarkers();
    
    const duration = this.player.duration();
    const progressControl = this.player.el().querySelector(".vjs-progress-control");
    
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
    rangeDiv.style.left = `calc(15px + ${startPercent}% - ${startPercent * 0.3}px)`;
    rangeDiv.style.width = `calc(${widthPercent}% - ${widthPercent * 0.3}px)`;
    
    // Highlight current segment when enabled
    if (this.enabled && index === this.currentSegmentIndex) {
      rangeDiv.classList.add("active");
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
    const progressControl = this.player.el().querySelector(".vjs-progress-control");
    
    if (!progressControl || !duration) return;
    
    const markerDiv = document.createElement("div");
    markerDiv.className = "vjs-multi-segment-pending-marker";
    
    const startPercent = (this.pendingStart / duration) * 100;
    markerDiv.style.left = `calc(15px + ${startPercent}% - ${startPercent * 0.3}px)`;
    
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
    });
  }

  /**
   * Create a toggle button in the control bar
   */
  private createControlButton(): void {
    const Button = videojs.getComponent("Button");
    const plugin = this;
    
    class MultiSegmentLoopButton extends Button {
      constructor(player: VideoJsPlayer, options: any) {
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
        controlBar.addChild(button, {}, controlBar.children().indexOf(fullscreenToggle));
      } else {
        controlBar.addChild(button);
      }
    }
  }

  /**
   * Update control button state (called when enabled or segments change)
   */
  private updateControlButton(): void {
    if (this.controlButton && typeof this.controlButton.updateState === 'function') {
      this.controlButton.updateState();
    }
  }

  dispose(): void {
    this.clearSegmentMarkers();
    this.clearPendingMarker();
    this.player.off("timeupdate", this.checkLoop.bind(this));
    this.player.off("playing", this.onPlaying.bind(this));
    this.player.off("pause", this.onPause.bind(this));
    super.dispose();
  }
}

// Register the plugin with VideoJS
videojs.registerPlugin("multiSegmentLoop", MultiSegmentLoopPlugin);

export default MultiSegmentLoopPlugin;
