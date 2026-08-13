/* eslint-disable @typescript-eslint/naming-convention */
import videojs, { VideoJsPlayer } from "video.js";

interface ISeekButtonsOptions {
  forward?: number;
  back?: number;
}

const SEEK_OPTIONS = [5, 10, 20, 30];
const DEFAULT_SEEK = 5; // CUSTOM

// Menu item for seek duration selection
class SeekMenuItem extends videojs.getComponent("MenuItem") {
  public seconds: number;
  private parentButton: SeekMenuButton;

  constructor(
    player: VideoJsPlayer,
    parentButton: SeekMenuButton,
    seconds: number,
    selected: boolean
  ) {
    const options = {} as videojs.MenuItemOptions;
    options.selectable = true;
    options.multiSelectable = false;
    options.label = `${seconds}s`;
    options.selected = selected;

    super(player, options);

    this.seconds = seconds;
    this.parentButton = parentButton;

    this.addClass("vjs-seek-menu-item");

    if (selected) {
      this.addClass("vjs-selected");
    }
  }

  handleClick() {
    this.parentButton.setSeekSeconds(this.seconds);
    // Update selection state for all items
    const items = this.parentButton.menu?.children() || [];
    for (const item of items) {
      if (item instanceof SeekMenuItem) {
        item.selected(item.seconds === this.seconds);
      }
    }
  }
}

// Base menu button for seek with dropdown
class SeekMenuButton extends videojs.getComponent("MenuButton") {
  private seekSeconds: number = DEFAULT_SEEK;
  private isForward: boolean = true;
  private siblingButton?: SeekMenuButton;

  constructor(
    player: VideoJsPlayer,
    isForward: boolean,
    initialSeconds: number = DEFAULT_SEEK
  ) {
    // Set properties before super() call since createEl() will be called during super()
    // We can't actually do this in JS - properties are set after super()
    // So we'll handle this in createEl with a workaround
    super(player);

    this.seekSeconds = initialSeconds;
    this.isForward = isForward;

    // Re-apply classes now that isForward is set
    this.removeClass("skip-forward");
    this.removeClass("skip-back");
    this.addClass("vjs-seek-button");
    this.addClass(isForward ? "skip-forward" : "skip-back");
    this.addClass("vjs-seek-menu-button");

    this.controlText(
      isForward
        ? `Skip forward ${this.seekSeconds} seconds`
        : `Skip back ${this.seekSeconds} seconds`
    );

    // Update the button text/icon
    this.updateButtonDisplay();
  }

  setSiblingButton(sibling: SeekMenuButton) {
    this.siblingButton = sibling;
  }

  createEl() {
    // Note: isForward is not yet set during initial createEl call
    // We use a generic class here and fix it in the constructor
    const el = videojs.dom.createEl("div", {
      className: `vjs-seek-button vjs-seek-menu-button vjs-menu-button vjs-menu-button-popup vjs-control vjs-button`,
    });
    return el;
  }

  buildCSSClass() {
    const direction = this.isForward ? "skip-forward" : "skip-back";
    return `vjs-seek-button vjs-seek-menu-button vjs-menu-button vjs-menu-button-popup vjs-control vjs-button ${direction} ${super.buildCSSClass()}`;
  }

  createItems(): videojs.MenuItem[] {
    const items: videojs.MenuItem[] = [];

    for (const seconds of SEEK_OPTIONS) {
      const item = new SeekMenuItem(
        this.player(),
        this,
        seconds,
        seconds === this.seekSeconds
      );
      items.push(item);
    }

    return items;
  }

  // When the main button area is clicked (not menu), perform the seek
  handleClick(event: Event) {
    // Check if click was on a menu item - if so, let the menu item handle it
    const target = event.target as HTMLElement;
    if (target.closest(".vjs-menu")) {
      return;
    }

    this.performSeek();
  }

  private performSeek() {
    const player = this.player();
    const currentTime = player.currentTime() || 0;
    const duration = player.duration() || 0;

    let newTime: number;
    if (this.isForward) {
      newTime = Math.min(currentTime + this.seekSeconds, duration);
    } else {
      newTime = Math.max(currentTime - this.seekSeconds, 0);
    }

    player.currentTime(newTime);
  }

  setSeekSeconds(seconds: number, syncSibling: boolean = true) {
    this.seekSeconds = seconds;
    this.updateButtonDisplay();
    this.controlText(
      this.isForward
        ? `Skip forward ${seconds} seconds`
        : `Skip back ${seconds} seconds`
    );

    // Sync the sibling button to the same value
    if (syncSibling && this.siblingButton) {
      this.siblingButton.setSeekSeconds(seconds, false);
      // Also update sibling's menu selection
      this.siblingButton.updateMenuSelection(seconds);
    }
  }

  updateMenuSelection(seconds: number) {
    const items = this.menu?.children() || [];
    for (const item of items) {
      if (item instanceof SeekMenuItem) {
        item.selected(item.seconds === seconds);
      }
    }
  }

  getSeekSeconds(): number {
    return this.seekSeconds;
  }

  private updateButtonDisplay() {
    // The icon and number are handled via CSS ::before and ::after pseudo-elements
    // We set a data attribute that CSS can use
    this.el().setAttribute("data-seek-seconds", String(this.seekSeconds));
  }
}

// The plugin class
class SeekButtonsPlugin extends videojs.getPlugin("plugin") {
  private forwardButton?: SeekMenuButton;
  private backButton?: SeekMenuButton;

  constructor(player: VideoJsPlayer, options?: ISeekButtonsOptions) {
    super(player, options);

    const forwardSeconds = options?.forward ?? DEFAULT_SEEK;

    player.ready(() => {
      this.setupButtons(forwardSeconds);
    });
  }

  private setupButtons(forwardSeconds: number) {
    const { controlBar } = this.player;
    const playToggle = controlBar.getChild("playToggle");

    if (!playToggle) return;

    // Use the same initial seconds for both (use forward as the default)
    const initialSeconds = forwardSeconds;

    // Create forward button
    this.forwardButton = new SeekMenuButton(this.player, true, initialSeconds);
    controlBar.addChild(this.forwardButton);

    // Create back button
    this.backButton = new SeekMenuButton(this.player, false, initialSeconds);
    controlBar.addChild(this.backButton);

    // Link buttons together so changing one updates both
    this.forwardButton.setSiblingButton(this.backButton);
    this.backButton.setSiblingButton(this.forwardButton);

    // Insert buttons after play toggle: [Play] [Back] [Forward]
    const playToggleEl = playToggle.el();
    const controlBarEl = controlBar.el();

    // Insert forward button after play toggle
    if (playToggleEl.nextSibling) {
      controlBarEl.insertBefore(
        this.forwardButton.el(),
        playToggleEl.nextSibling
      );
    } else {
      controlBarEl.appendChild(this.forwardButton.el());
    }

    // Insert back button after play toggle (before forward)
    controlBarEl.insertBefore(this.backButton.el(), this.forwardButton.el());
  }

  public setForwardSeconds(seconds: number) {
    this.forwardButton?.setSeekSeconds(seconds);
  }

  public setBackSeconds(seconds: number) {
    this.backButton?.setSeekSeconds(seconds);
  }

  public getForwardSeconds(): number {
    return this.forwardButton?.getSeekSeconds() ?? DEFAULT_SEEK;
  }

  public getBackSeconds(): number {
    return this.backButton?.getSeekSeconds() ?? DEFAULT_SEEK;
  }
}

// Register the plugin with videojs
videojs.registerComponent("SeekMenuButton", SeekMenuButton);
videojs.registerPlugin("seekButtonsMenu", SeekButtonsPlugin);

// Extend VideoJsPlayer type
/* eslint-disable @typescript-eslint/naming-convention */
declare module "video.js" {
  interface VideoJsPlayer {
    seekButtonsMenu: () => SeekButtonsPlugin;
  }
  interface VideoJsPlayerPluginOptions {
    seekButtonsMenu?: ISeekButtonsOptions;
  }
}

export default SeekButtonsPlugin;
