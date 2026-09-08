# Simple Fog API (v1)

Initial implementation based on upstream `master` at `9020f8d` (Simple Fog 1.5.10), targeting Foundry V14.


## Availability

The API is registered at `init`; consumers should discover it at `ready` or later:

```js
const fog = game.modules.get("simplefog")?.api;
if (fog?.apiVersion !== 1) throw new Error("Simple Fog reveal API v1 is required.");
```

Calls require a GM, a ready canvas, and the currently viewed scene and native V14 level. Simple Fog must be enabled on that scene. The API never selects a tool or enables fog automatically. Its options are independent of mouse position, Shift, brush size, reveal/hide mode, and brush opacity.

## Reveal from a point

```js
const result = await fog.revealFromPoint({
  x: 1200,
  y: 900,
  passThroughOpenDoors: false
});
```

`x` and `y` are finite canvas coordinates in **scene pixels**, not screen pixels or grid units. Foundry rounds the origin to whole pixels. Out-of-scene origins produce an empty result; they are not clamped onto the map.

The reveal uses the Room Tool's sight polygon, without a user-selected radius. It follows the existing wall restrictions and scene boundary. **It does not find an entire enclosed room or reveal around corners.** Open areas can therefore reveal as far as the scene boundary. One-way walls and windows retain the existing Room Tool behaviour.

## Reveal beside a door

```js
// Example: one selected wall in the GM's Walls controls.
const wall = canvas.walls.controlled[0]?.document;
const result = await fog.revealDoorSides({
  wall,
  passThroughOpenDoors: false
});
```

`wall` accepts a current `WallDocument` or its canvas `Wall` object. It must represent a door in the viewed scene and level. Strings, IDs, UUIDs, deleted documents, and plain object copies are not accepted. A secret door is accepted when explicitly supplied by a GM. The API does not change the door state or require it to be open; the caller decides when revealing is appropriate.

Two points are sampled two scene pixels either side of the door midpoint, perpendicular to the door. Each point produces its own sight polygon. Both polygons are written in **one history entry and one Undo step**. An origin outside the scene is omitted, so a door on the map edge may yield just one polygon. Extremely narrow passages, nearby parallel walls, and unusual door geometry need visual testing because these offsets are fixed.

## Open doors

Both methods default `passThroughOpenDoors` to `false`. Open doors remain polygon boundaries, including the supplied door. Sampling both sides explicitly reveals the neighbouring areas while other door boundaries limit further reveals.

With `true`, open doors follow the normal sight restrictions and can allow the reveal to continue through additional doorways. Closed doors and other walls keep the Room Tool's normal behaviour. The option does not force traversal through walls that still block sight.

## Results and errors

Both methods return a Promise:

```js
{ status: "committed", sceneId: "...", levelId: "...", polygons: 2 }
{ status: "skipped", sceneId: "...", levelId: null, polygons: 0, reason: "busy" }
```

`levelId` is `null` when there is no native canvas level. `polygons` counts drawing commands saved, not newly exposed pixels; overlapping or repeated reveals can still create history entries.

| Skip reason | Meaning |
| --- | --- |
| `disabled` | Simple Fog is disabled in the current scene. |
| `busy` | A manual drawing operation, pending brush data, or another history write is active. |
| `empty` | No usable polygon was produced, including out-of-scene origins. |
| `context-changed` | The scene, level, or canvas drawing context changed before a queued request began. |

The API does not retry skipped requests. A consumer may retry `busy` once the drawing has finished, after checking that its original scene, level, and trigger still apply.

Invalid calls reject with `SimpleFogAPIError` and a stable `code`:

| Code | Meaning |
| --- | --- |
| `NOT_GM` | The executing user is not a GM, or lost that permission while queued. |
| `NOT_READY` | The canvas is unavailable or Simple Fog is still changing levels. |
| `INVALID_INPUT` | Invalid coordinates, options object, or boolean option. |
| `INVALID_WALL` | The supplied object is not a valid door in the current context. |
| `SAVE_FAILED` | The fog change could not be committed; inspect `error.cause`. |

Requests from one API instance run in order. Each has an independent history batch, and a failed request does not prevent later requests from running. Manual strokes are not incorporated into API batches. The existing drawing controls, Undo, reset, and blank actions cannot start a conflicting history write while a save is active.

Queued requests are cancelled before writing if their context changes. A write already sent to Foundry completes against its **captured original scene and history key**, even if the GM switches scenes; it does not draw onto the newly viewed scene. The Promise indicates persistence, not an acknowledgement from every player display. Player updates use Simple Fog's existing scene-flag synchronisation.

## Consumer responsibilities

The consuming module or macro owns door hooks, scene preferences, per-door exceptions, repeat-trigger handling, and choosing **one GM** to execute an operation. This API has no multi-GM write arbitration or player-to-GM socket delegation. It does not add automatic reveals, MATT tiles, hidden tokens, display policy, or audio behaviour.

The API exposes reveal and apply operations for points, door sides and explicit areas. Existing UI controls remain the way to Undo or reset fog. Off-canvas scene editing is outside this API.

## Verification before table use

Run `npm test`, `npm run lint`, and `npm run build` from the checkout. Automated checks use real API and history code with substitutes for the Foundry host and polygon engine. They cover input validation, offset arithmetic, option mapping, batching, Undo history, queueing, failed saves, manual interaction, and scene/level transitions. They do **not** prove the polygon engine's visible output or network synchronisation.

In an isolated V14 test scene with a GM and a player/Common Display client:

- Try horizontal, vertical, and diagonal doors, including reversed wall endpoints and a door at the scene edge.
- Open into an L-shaped room: visible areas reveal while the hidden corner remains covered.
- Place another open door beyond the first. Compare the default with `passThroughOpenDoors: true`.
- Check secret doors, one-way walls, windows, thin corridors, and closely spaced walls against the normal Room Tool.
- Repeat on square, hex, and gridless scenes; offsets must remain measured in scene pixels.
- Verify both door polygons appear on the player display, and one Undo removes the entire operation. Reload both clients and confirm the saved result.
- Trigger several calls quickly, try manual drawing, then reveal again. Confirm independent history entries.
- Switch scene and native level with requests queued; confirm no reveal lands on the wrong scene or floor.
- Recheck manual brush partial synchronisation, Undo followed by drawing, reset, and blank. These share the history writer.

No live geometry or display-synchronisation result should be inferred from the automated checks alone.

## Reveal an explicit area

```js
await fog.revealArea({ shape: "rectangle", x: 1200, y: 900, width: 400, height: 250 });
await fog.revealArea({ shape: "polygon", vertices: [1200,900, 1600,900, 1500,1200, 1200,1150] });
```

This is the polygon brush's coordinate-based mask operation, not a sight calculation. It reveals the specified area even across walls; the mask texture bounds still apply. Square areas are rectangles with equal width and height. Coordinates are scene pixels, not screen or grid coordinates. Neither the mouse nor current brush mode/opacity affects the reveal.

The method is an additive v1 capability: check `typeof fog.revealArea === "function"`. Rectangles need positive dimensions. Polygons accept 3-256 finite corners as a flat x/y array, including concave polygons and either winding order. An optional repeated closing corner is removed. Zero-area, intersecting, duplicate-edge and oversized shapes reject with `INVALID_INPUT` before writing. Holes and multiple disconnected polygons are not supported by this method.

Inputs are copied before entering the shared ordered queue. One call commits one existing-history batch and one Undo step. GM, ready scene/level, disabled/busy, context-change and failed-save rules are shared with point/door reveals. Existing reveal methods and `apiVersion: 1` remain compatible.

## Apply Fog

The API also exposes `applyFromPoint(options)`, `applyDoorSides(options)` and `applyArea(options)`. Each takes the same options as its reveal counterpart and paints opaque fog instead of revealing it. All six methods share the same validation, GM/context guards, result codes, ordered local queue and one-batch Undo history. Check individual method availability when integrating with an older API v1 release.

`applyArea` covers the explicit area regardless of walls. Point and door methods cover their sight polygons; they do not close doors or disable other controls.
