import assert from "node:assert/strict";

import {
  followMovedIndexCustom,
  getPointerSortItemStateCustom,
  getPointerSortTargetIndexCustom,
  moveArrayItemCustom,
} from "../src/components/Shared/pointerSortable_custom.ts";

const items = ["a", "b", "c", "d", "e"];
assert.deepEqual(moveArrayItemCustom(items, 0, 3), ["b", "c", "d", "a", "e"]);
assert.deepEqual(moveArrayItemCustom(items, 4, 1), ["a", "e", "b", "c", "d"]);
assert.deepEqual(moveArrayItemCustom(items, 2, 2), items);
assert.deepEqual(items, ["a", "b", "c", "d", "e"], "the source is untouched");

// The playing item keeps playing wherever it lands, and the ones it passes
// shift by one; moving another item past it no longer steals playback.
assert.equal(followMovedIndexCustom(0, 4, 3), 0, "unrelated moves keep it");
assert.equal(followMovedIndexCustom(2, 2, 4), 4, "the moved item follows");
assert.equal(followMovedIndexCustom(3, 0, 4), 2, "items moved past shift up");
assert.equal(
  followMovedIndexCustom(1, 4, 0),
  2,
  "items moved before shift down"
);
assert.equal(followMovedIndexCustom(4, 0, 3), 4, "items beyond the move stay");

// Rows 40px tall stacked from y=0; dragging row 1.
const rects = [0, 40, 80, 120].map((top) => ({ top, bottom: top + 40 }));
assert.equal(getPointerSortTargetIndexCustom(10, rects, 1), 0);
assert.equal(getPointerSortTargetIndexCustom(55, rects, 1), 1, "over itself");
assert.equal(getPointerSortTargetIndexCustom(105, rects, 1), 2);
assert.equal(getPointerSortTargetIndexCustom(500, rects, 1), 3);
assert.equal(
  getPointerSortTargetIndexCustom(500, [rects[0], undefined, rects[2]], 0),
  1,
  "unmounted rows are ignored"
);

assert.equal(getPointerSortItemStateCustom(1, undefined, undefined), undefined);
assert.equal(getPointerSortItemStateCustom(2, 2, 0), "dragging");
assert.equal(getPointerSortItemStateCustom(0, 2, 0), "drop-before");
assert.equal(getPointerSortItemStateCustom(4, 2, 4), "drop-after");
assert.equal(getPointerSortItemStateCustom(3, 2, 4), undefined);
