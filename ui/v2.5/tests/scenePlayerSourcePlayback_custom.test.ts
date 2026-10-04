import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

class FakeEvents {
  private handlers = new Map<string, Array<(...args: any[]) => void>>();
  on(event: string, handler: (...args: any[]) => void) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
  }
  one(event: string, handler: (...args: any[]) => void) {
    const once = (...args: any[]) => {
      this.handlers.set(
        event,
        (this.handlers.get(event) ?? []).filter((callback) => callback !== once)
      );
      handler(...args);
    };
    this.on(event, once);
  }
  trigger(event: string, data?: unknown) {
    this.handlers
      .get(event)
      ?.slice()
      .forEach((handler) => handler({}, data));
  }
}

class FakeComponent extends FakeEvents {
  constructor(private parentPlayer: unknown) {
    super();
  }
  player() {
    return this.parentPlayer;
  }
  addClass() {}
  selected() {}
  update() {}
}

const pluginExports: Record<string, any> = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL(
        "../src/components/ScenePlayer/source-selector.ts",
        import.meta.url
      ),
      "utf8"
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }
  ).outputText,
  {
    exports: pluginExports,
    require: () => ({
      getComponent: () => FakeComponent,
      getPlugin: () =>
        class {
          constructor(public player: unknown) {}
        },
      registerComponent() {},
      registerPlugin() {},
    }),
    MediaError: { MEDIA_ERR_SRC_NOT_SUPPORTED: 4, MEDIA_ERR_DECODE: 3 },
    console: { log() {} },
  }
);

function createPlayer() {
  const events = new FakeEvents();
  const state = {
    paused: true,
    time: 20,
    playCalls: 0,
    source: { src: "initial.m3u8" },
    error: null as null | { code: number },
  };
  const player = Object.assign(events, {
    paused: () => state.paused,
    play() {
      state.paused = false;
      state.playCalls += 1;
      events.trigger("play");
    },
    pause() {
      state.paused = true;
      events.trigger("pause");
    },
    src(source: typeof state.source) {
      state.source = source;
      state.error = null;
      this.pause();
    },
    load() {},
    currentTime(value?: number) {
      if (value !== undefined) state.time = value;
      return state.time;
    },
    currentSrc: () => state.source.src,
    currentSource: () => state.source,
    videoWidth: () => 0,
    videoHeight: () => 0,
    error(value?: { code: number }) {
      if (value) state.error = value;
      return state.error;
    },
  });
  const plugin = new pluginExports.default(player);
  const sources = [{ src: "first.m3u8" }, { src: "second.m3u8" }];
  plugin.setSources(sources);
  return { player, state, plugin, sources };
}

for (const streamingSource of ["first.m3u8", "first.mpd"]) {
  const { player, state } = createPlayer();
  state.source.src = streamingSource;
  player.trigger("loadedmetadata");
  assert.equal(state.playCalls, 0, "stream metadata cannot auto-start a scene");
}

for (const playing of [false, true]) {
  const { player, state, plugin, sources } = createPlayer();
  if (playing) player.play();
  plugin.menu.trigger("sourceselected", sources[1]);
  player.trigger("loadedmetadata");
  assert.equal(
    state.paused,
    !playing,
    "manual stream changes preserve playback state"
  );
  assert.equal(state.time, 20, "manual stream changes preserve the timestamp");
}

for (const playing of [false, true]) {
  const { player, state, sources } = createPlayer();
  if (playing) player.play();
  state.error = { code: 3 };
  player.pause();
  player.trigger("error");
  assert.equal(
    state.source,
    sources[1],
    "decoding errors still try the fallback source"
  );
  assert.equal(
    state.paused,
    !playing,
    "fallback only resumes requested playback"
  );
}

const { player, state, plugin, sources } = createPlayer();
player.play();
plugin.setSources(sources);
state.error = { code: 3 };
player.trigger("error");
assert.equal(
  state.paused,
  true,
  "new scenes cannot inherit the previous playback intent"
);
