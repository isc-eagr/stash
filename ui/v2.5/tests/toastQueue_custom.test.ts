import assert from "node:assert/strict";
import {
  taskProgressAchievementToastPriority,
  toastQueueReducerCustom,
} from "../src/hooks/toastQueue_custom.ts";
import type { IToastQueueState } from "../src/hooks/toastQueue_custom.ts";

let state: IToastQueueState = { queued: [], nextID: 0 };
state = toastQueueReducerCustom(state, {
  type: "add",
  item: { content: "Scene saved" },
});
const saveID = state.active!.id;
for (const content of [
  "Bronze · 25% achieved · Scenes",
  "30% achieved · Scenes",
]) {
  state = toastQueueReducerCustom(state, {
    type: "add",
    item: {
      content,
      enqueue: true,
      priority: taskProgressAchievementToastPriority,
    },
  });
}
assert.equal(
  state.active?.content,
  "Bronze · 25% achieved · Scenes",
  "achievements interrupt an existing success toast"
);
assert.deepEqual(
  state.queued.map((toast) => toast.content),
  ["30% achieved · Scenes", "Scene saved"],
  "remaining achievements precede the interrupted success"
);
const bronzeID = state.active!.id;
const current = state;
assert.equal(
  toastQueueReducerCustom(state, { type: "close", id: saveID }),
  current,
  "a stale success autohide callback cannot dismiss an achievement"
);

state = toastQueueReducerCustom(state, {
  type: "add",
  item: { content: "Another scene saved" },
});
assert.equal(
  state.active?.content,
  "Bronze · 25% achieved · Scenes",
  "success notifications wait behind the active achievement"
);
assert.deepEqual(
  state.queued.map((toast) => toast.content),
  ["30% achieved · Scenes", "Another scene saved"],
  "pending successes keep the latest message behind all achievements"
);

state = toastQueueReducerCustom(state, {
  type: "add",
  item: { content: "Save failed", variant: "danger" },
});
const errorID = state.active!.id;
assert.equal(
  state.active?.content,
  "Save failed",
  "errors interrupt achievements"
);
assert.deepEqual(
  state.queued.map((toast) => toast.content),
  [
    "Bronze · 25% achieved · Scenes",
    "30% achieved · Scenes",
    "Another scene saved",
  ],
  "an error preserves the interrupted achievement at the front"
);
state = toastQueueReducerCustom(state, {
  type: "add",
  item: { content: "Latest scene saved" },
});
state = toastQueueReducerCustom(state, {
  type: "add",
  item: {
    content: "35% achieved · Scenes",
    enqueue: true,
    priority: taskProgressAchievementToastPriority,
  },
});
assert.equal(
  state.active?.id,
  errorID,
  "queued achievements do not overwrite errors"
);
state = toastQueueReducerCustom(state, { type: "close", id: errorID });
assert.equal(
  state.active?.id,
  bronzeID,
  "the interrupted achievement resumes after the error"
);
const resumed = state;
assert.equal(
  toastQueueReducerCustom(state, { type: "close", id: errorID }),
  resumed,
  "a stale error callback cannot close the resumed achievement"
);
const delivered = [];
while (state.active) {
  delivered.push(state.active.content);
  state = toastQueueReducerCustom(state, {
    type: "close",
    id: state.active.id,
  });
}
assert.deepEqual(
  delivered,
  [
    "Bronze · 25% achieved · Scenes",
    "30% achieved · Scenes",
    "35% achieved · Scenes",
    "Latest scene saved",
  ],
  "dismissal or autohide delivers achievements in order before the latest success"
);

state = toastQueueReducerCustom(state, {
  type: "add",
  item: {
    content: "Queued first",
    enqueue: true,
    priority: taskProgressAchievementToastPriority,
  },
});
assert.equal(
  state.active?.content,
  "Queued first",
  "an idle toast displays queued notifications immediately"
);
state = toastQueueReducerCustom(state, { type: "close", id: state.active!.id });
state = toastQueueReducerCustom(state, {
  type: "add",
  item: { content: "First save" },
});
state = toastQueueReducerCustom(state, {
  type: "add",
  item: { content: "Latest save" },
});
assert.equal(
  state.active?.content,
  "Latest save",
  "ordinary toasts retain their existing replacement behavior"
);
assert.deepEqual(
  state.queued,
  [],
  "replaced ordinary toasts do not build a queue"
);

state = { queued: [], nextID: 0 };
state = toastQueueReducerCustom(state, {
  type: "add",
  item: { content: "Important error", variant: "danger", priority: 200 },
});
for (const item of [
  { content: "Scene saved" },
  {
    content: "10% achieved · Scenes",
    enqueue: true,
    priority: taskProgressAchievementToastPriority,
  },
  { content: "Another error", variant: "danger" as const, priority: 0 },
]) {
  state = toastQueueReducerCustom(state, { type: "add", item });
}
const priorityOrder = [];
while (state.active) {
  priorityOrder.push(state.active.content);
  state = toastQueueReducerCustom(state, {
    type: "close",
    id: state.active.id,
  });
}
assert.deepEqual(
  priorityOrder,
  ["Important error", "Another error", "10% achieved · Scenes", "Scene saved"],
  "queued errors always precede achievements, which precede successes"
);

console.log(
  "PASS: errors > achievements > successes, interruption/resume, FIFO achievements, latest pending success, and stale callback protection."
);
