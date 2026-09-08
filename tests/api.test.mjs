import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

// Exercise the real API, layer methods, and history writer. Only Foundry's host,
// PIXI renderer, and polygon engine are substituted; geometry needs in-app QA.
let sweeps;
let makePolygon;
globalThis.PIXI = { Graphics: class {}, Sprite: class {} };
globalThis.Hooks = { on() {} };
globalThis.CONST = { EDGE_SENSE_TYPES: { NONE: 0 }, EDGE_DIRECTION_MODES: { BOTH: 0, NORMAL: 1 } };
globalThis.foundry = {
	utils: { deepClone: structuredClone },
	applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: (base) => base }, fields: {} },
	canvas: {
		layers: { InteractionLayer: class {} },
		geometry: {
			ClockwiseSweepPolygon: class {
				static create(origin, config) {
					sweeps.push({ origin, config });
					return { points: makePolygon(origin) };
				}
			}
		}
	}
};

const { createAPI } = await import("../src/module/api.js");
const { default: SimplefogLayer } = await import("../src/module/layers/SimplefogLayer.js");
const { getDoorOrigins } = await import("../src/module/roomGeometry.js");
const { CWSPNoDoors } = await import("../src/module/ClockwiseSweep.js");
let layer;
let scene;
let api;
let writes;
let rendered;
let flags;
let beforeWrite;

function deferred() {
	let resolve;
	const promise = new Promise((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

function door(c = [50, 20, 50, 80], extras = {}) {
	const wall = { id: "door", documentName: "Wall", isDoor: true, c, levels: new Set(), ...extras };
	scene.walls.set(wall.id, wall);
	return wall;
}

beforeEach(() => {
	sweeps = [];
	writes = [];
	rendered = [];
	flags = new Map([["visible", true]]);
	beforeWrite = undefined;
	makePolygon = ({ x, y }) => [x, y, x + 1, y, x, y + 1];
	globalThis.game = { user: { isGM: true }, settings: { get: () => ({}) } };
	scene = {
		id: "scene", walls: new Map(),
		getFlag: (_scope, key) => flags.get(key),
		async setFlag(scope, key, value) {
			if (beforeWrite) await beforeWrite();
			writes.push({ scope, key, value: structuredClone(value) });
			flags.set(key, structuredClone(value));
			return scene;
		},
		unsetFlag() {
			throw new Error("Saving history must never delete the existing flag first.");
		}
	};
	layer = new SimplefogLayer();
	layer.maskTexture = {};
	layer.renderStack = ({ history }) => {
		rendered.push(history);
		layer.pointer = history?.pointer ?? 0;
	};
	layer.setFill = () => {};
	layer.updatePerception = () => {};
	globalThis.canvas = {
		ready: true, scene, simplefog: layer, level: null,
		dimensions: { sceneRect: {
			x: 0, y: 0, width: 100, height: 100, left: 0, right: 100, top: 0, bottom: 100,
			contains: (x, y) => x >= 0 && x < 100 && y >= 0 && y < 100
		} }
	};
	api = createAPI();
});

test("versioned API reveals from explicit coordinates without touching mouse or brush settings", async () => {
	assert.equal(api.apiVersion, 1);
	assert.ok(Object.isFrozen(api));
	Object.defineProperty(canvas, "mousePosition", { get() {
		throw new Error("Mouse dependency");
	} });
	Object.defineProperty(layer, "brushOpacity", { get() {
		throw new Error("Brush dependency");
	} });
	assert.deepEqual(await api.revealFromPoint({ x: 20, y: 30 }), {
		status: "committed", sceneId: "scene", levelId: null, polygons: 1
	});
	assert.equal(writes.length, 1);
	assert.equal(writes[0].value.events[0][0].fill, 0);
	assert.equal(sweeps[0].config.passThroughOpenDoors, false);
	assert.equal(sweeps[0].config.radius, null);
	assert.deepEqual(sweeps[0].origin, { x: 20, y: 30 });
	assert.deepEqual(layer.historyBuffer, []);
});

test("Apply Fog paints white for area, point and door and shares single-step Undo", async () => {
	await api.applyArea({ shape: "rectangle", x: 10, y: 20, width: 30, height: 40 });
	await api.applyFromPoint({ x: 20, y: 30 });
	await api.applyDoorSides({ wall: door() });
	assert.equal(writes.length, 3);
	for (const batch of flags.get("history").events) for (const event of batch) assert.equal(event.fill, 0xffffff);
	assert.equal(flags.get("history").pointer, 3);
	await layer._onUndoKey();
	assert.equal(flags.get("history").pointer, 2);
});

test("Apply Fog retains permission, disabled and invalid-geometry guards", async () => {
	const area = { shape: "rectangle", x: 0, y: 0, width: 10, height: 10 };
	flags.set("visible", false);
	assert.equal((await api.applyArea(area)).reason, "disabled");
	flags.set("visible", true);
	await assert.rejects(api.applyArea({ ...area, width: -1 }), { code: "INVALID_INPUT" });
	game.user.isGM = false;
	await assert.rejects(api.applyFromPoint({ x: 20, y: 30 }), { code: "NOT_GM" });
	assert.equal(writes.length, 0);
});

test("WallDocument and canvas Wall inputs both save two polygons as one undo step", async () => {
	const wall = door();
	await api.revealDoorSides({ wall });
	await api.revealDoorSides({ wall: { document: wall } });
	assert.equal(writes.length, 2);
	assert.deepEqual(flags.get("history").events.map((batch) => batch.length), [2, 2]);
	assert.equal(flags.get("history").pointer, 2);
	await layer._onUndoKey();
	assert.equal(flags.get("history").pointer, 1);
	assert.equal(flags.get("history").events.length, 2);
});

test("door origins stay on opposite sides for horizontal, vertical, diagonal, and reversed walls", () => {
	for (const coords of [[20, 50, 80, 50], [50, 20, 50, 80], [20, 20, 80, 80], [80, 20, 20, 80]]) {
		const [x0, y0, x1, y1] = coords;
		const origins = getDoorOrigins(coords);
		const sides = origins.map((p) => ((x1 - x0) * (p.y - y0)) - ((y1 - y0) * (p.x - x0)));
		assert.ok(sides[0] * sides[1] < 0);
		assert.deepEqual(getDoorOrigins([x1, y1, x0, y0]), origins.toReversed());
	}
	assert.throws(() => getDoorOrigins([2, 2, 2, 2]), /non-zero/);
});

test("the scene-edge door omits the outside origin without moving it into a different room", async () => {
	const answer = await api.revealDoorSides({ wall: door([0, 20, 0, 80]) });
	assert.equal(answer.polygons, 1);
	assert.deepEqual(sweeps.map((s) => s.origin), [{ x: 2, y: 50 }]);
});

test("outside point and empty polygons produce no history writes", async () => {
	assert.equal((await api.revealFromPoint({ x: -10, y: 20 })).reason, "empty");
	makePolygon = () => [];
	assert.equal((await api.revealFromPoint({ x: 10, y: 20 })).reason, "empty");
	assert.equal(writes.length, 0);
});

test("open doors are boundaries by default and can be explicitly passed through", async () => {
	const sweep = new CWSPNoDoors();
	const edge = {
		type: "wall", object: { isOpen: true }, sight: 0, priority: 1, orientPoint: () => 1, direction: 0
	};
	const edgeTypes = { wall: { mode: 1, priority: 0 } };
	sweep.config = { type: "sight", boundaryShapes: [], passThroughOpenDoors: false };
	assert.equal(sweep._testEdgeInclusion(edge, edgeTypes), true);
	sweep.config.passThroughOpenDoors = true;
	assert.equal(sweep._testEdgeInclusion(edge, edgeTypes), false);
	edge.object.isOpen = false;
	assert.equal(sweep._testEdgeInclusion(edge, edgeTypes), false);
	edge.sight = 1;
	assert.equal(sweep._testEdgeInclusion(edge, edgeTypes), true);
	await api.revealFromPoint({ x: 20, y: 20, passThroughOpenDoors: true });
	assert.equal(sweeps[0].config.passThroughOpenDoors, true);
});

test("manual Room Tool keeps its drag origin, radius, and Shift behaviour", () => {
	layer.roomExpand = false;
	layer.polygonOrigin = { x: 10, y: 10 };
	layer._getRoomVertices({ x: 40, y: 30 }, { shiftKey: true });
	assert.deepEqual(sweeps[0].origin, { x: 10, y: 10 });
	assert.equal(sweeps[0].config.radius, 30);
	assert.equal(sweeps[0].config.passThroughOpenDoors, true);
	layer.roomExpand = true;
	canvas.mousePosition = { x: 25, y: 35 };
	layer._getRoomVertices(canvas.mousePosition, {});
	assert.deepEqual(sweeps[1].origin, canvas.mousePosition);
	assert.equal(sweeps[1].config.radius, null);
	assert.equal(sweeps[1].config.passThroughOpenDoors, false);
});

test("disabled fog is skipped without enabling it", async () => {
	flags.set("visible", false);
	assert.equal((await api.revealFromPoint({ x: 20, y: 20 })).reason, "disabled");
	assert.equal(writes.length, 0);
});

test("manual operations, buffered drawing, and partial saves stay separate", async () => {
	for (const [key, value] of [["op", "polygon"], ["lock", true], ["_partialSyncActive", true], ["historyBuffer", [{}]]]) {
		const previous = layer[key];
		layer[key] = value;
		assert.equal((await api.revealFromPoint({ x: 20, y: 20 })).reason, "busy", key);
		layer[key] = previous;
	}
	assert.equal(writes.length, 0);
});

test("rapid API calls wait their turn and preserve both history entries", async () => {
	const saving = deferred();
	const entered = deferred();
	beforeWrite = async () => {
		entered.resolve(); await saving.promise;
	};
	const first = api.revealFromPoint({ x: 10, y: 20 });
	const second = api.revealFromPoint({ x: 30, y: 40 });
	await entered.promise;
	assert.equal(sweeps.length, 1);
	assert.equal(layer.lock, true);
	saving.resolve();
	assert.equal((await first).status, "committed");
	assert.equal((await second).status, "committed");
	assert.equal(flags.get("history").events.length, 2);
	assert.equal(layer.lock, false);
});

test("a failed save preserves existing history and releases the queue for the next call", async () => {
	const existing = { events: [[{ existing: true }]], pointer: 1 };
	flags.set("history", existing);
	beforeWrite = () => {
		throw new Error("Connection lost");
	};
	await assert.rejects(api.revealFromPoint({ x: 20, y: 20 }), { code: "SAVE_FAILED" });
	assert.deepEqual(existing, { events: [[{ existing: true }]], pointer: 1 });
	assert.equal(flags.get("history"), existing);
	assert.equal(layer.lock, false);
	assert.equal(rendered.length, 0);
	beforeWrite = undefined;
	await api.revealFromPoint({ x: 30, y: 30 });
	assert.equal(flags.get("history").events.length, 2);
});

test("cancelled document writes reject instead of claiming a saved reveal", async () => {
	scene.setFlag = async () => undefined;
	await assert.rejects(api.revealFromPoint({ x: 20, y: 20 }), { code: "SAVE_FAILED" });
	assert.equal(layer.lock, false);
});

test("a new reveal after Undo replaces only the abandoned future history", async () => {
	flags.set("history", { events: [[{ old: true }], [{ abandoned: true }]], pointer: 1 });
	await api.revealFromPoint({ x: 20, y: 20 });
	assert.equal(flags.get("history").events.length, 2);
	assert.deepEqual(flags.get("history").events[0], [{ old: true }]);
	assert.equal(flags.get("history").events[1][0].fill, 0);
});

test("queued calls are cancelled when the viewed scene changes", async () => {
	const pending = api.revealFromPoint({ x: 20, y: 20 });
	canvas.scene = { id: "other" };
	assert.equal((await pending).reason, "context-changed");
	assert.equal(writes.length, 0);
});

test("level changes, including switching away and back, cancel queued calls", async () => {
	const pending = api.revealFromPoint({ x: 20, y: 20 });
	canvas.level = { id: "upstairs" };
	await layer._onCanvasLevelChange("upstairs");
	canvas.level = null;
	await layer._onCanvasLevelChange(null);
	assert.equal((await pending).reason, "context-changed");
	assert.equal(writes.length, 0);
});

test("an in-flight save finishes on its captured scene without drawing onto the new scene", async () => {
	const saving = deferred();
	const entered = deferred();
	beforeWrite = async () => {
		entered.resolve(); await saving.promise;
	};
	const pending = api.revealFromPoint({ x: 20, y: 20 });
	await entered.promise;
	canvas.scene = { id: "other" };
	saving.resolve();
	assert.equal((await pending).sceneId, "scene");
	assert.equal(writes.length, 1);
	assert.equal(rendered.length, 0);
});

test("native level history is used without modifying another level", async () => {
	canvas.level = { id: "upstairs" };
	layer._activeLevelId = "upstairs";
	flags.set("levelHistory.downstairs", { events: [], pointer: 0 });
	const answer = await api.revealDoorSides({ wall: door(undefined, { levels: new Set(["upstairs"]) }) });
	assert.equal(answer.levelId, "upstairs");
	assert.equal(writes[0].key, "levelHistory.upstairs");
	assert.equal(flags.get("levelHistory.downstairs").pointer, 0);
	assert.equal(sweeps[0].config.level, canvas.level);
});

test("invalid options, non-doors, foreign walls, other levels, and zero-length doors reject", async () => {
	for (const options of [null, [], { x: NaN, y: 0 }, { x: 0, y: Infinity }, { x: "10", y: 10 },
		{ x: 10, y: 10, passThroughOpenDoors: "false" }]) {
		await assert.rejects(api.revealFromPoint(options), { code: "INVALID_INPUT" });
	}
	const wall = door();
	for (const input of [{ ...wall }, "door", undefined, door(undefined, { isDoor: false }),
		door([0, 0, 0, 0]), door(undefined, { levels: new Set(["upstairs"]) })]) {
		await assert.rejects(api.revealDoorSides({ wall: input }), { code: "INVALID_WALL" });
	}
	assert.equal(writes.length, 0);
});

test("queued door requests revalidate after deletion", async () => {
	const wall = door();
	const pending = api.revealDoorSides({ wall });
	scene.walls.delete(wall.id);
	await assert.rejects(pending, { code: "INVALID_WALL" });
});

test("permission and readiness checks happen before writing and again after waiting", async () => {
	game.user.isGM = false;
	await assert.rejects(api.revealFromPoint({ x: 20, y: 20 }), { code: "NOT_GM" });
	game.user.isGM = true;
	canvas.ready = false;
	await assert.rejects(api.revealFromPoint({ x: 20, y: 20 }), { code: "NOT_READY" });
	canvas.ready = true;
	const pending = api.revealFromPoint({ x: 20, y: 20 });
	game.user.isGM = false;
	await assert.rejects(pending, { code: "NOT_GM" });
	assert.equal(writes.length, 0);
});

test("manual commits and partial saves release their locks after failure", async () => {
	layer.historyBuffer.push({ manual: true });
	beforeWrite = () => {
		throw new Error("Connection lost");
	};
	await assert.rejects(layer.commitHistory());
	assert.equal(layer.lock, false);
	assert.equal(layer.historyBuffer.length, 1);
	await assert.rejects(layer.commitHistoryPartial());
	assert.equal(layer.lock, false);
	beforeWrite = undefined;
	await layer.commitHistory();
	assert.equal(layer.historyBuffer.length, 0);
});

test("manual drawing, Undo, reset, and blank cannot interleave with an API save", async () => {
	const saving = deferred();
	const entered = deferred();
	beforeWrite = async () => {
		entered.resolve(); await saving.promise;
	};
	const pending = api.revealDoorSides({ wall: door() });
	await entered.promise;
	Object.defineProperty(canvas, "mousePosition", { get() {
		throw new Error("Drawing should be blocked");
	} });
	layer._onClickLeft({});
	layer._onClickLeft2({});
	assert.equal(await layer._onUndoKey(), false);
	await layer.resetMask();
	await layer.blankMask();
	saving.resolve();
	await pending;
	assert.equal(writes.length, 1);
});

test("reset, blank, and Undo block API writes while saving, and unlock on failure", async () => {
	for (const operation of ["resetMask", "blankMask", "_onUndoKey"]) {
		const saving = deferred();
		const entered = deferred();
		beforeWrite = async () => {
			entered.resolve(); await saving.promise; throw new Error("Offline");
		};
		const pending = layer[operation]();
		await entered.promise;
		assert.equal((await api.revealFromPoint({ x: 20, y: 20 })).reason, "busy");
		saving.resolve();
		await assert.rejects(pending);
		assert.equal(layer.lock, false);
	}
});

test("a failed reset preserves the local mask as well as the saved history", async () => {
	let filled = false;
	layer.setFill = () => {
		filled = true;
	};
	beforeWrite = () => {
		throw new Error("Offline");
	};
	await assert.rejects(layer.resetMask());
	assert.equal(filled, false);
});

test("late manual history completions cannot redraw or change the pointer on a new scene", async () => {
	for (const operation of ["resetMask", "blankMask", "_onUndoKey", "commitHistory"]) {
		canvas.scene = scene;
		layer.pointer = 2;
		if (operation === "commitHistory") layer.historyBuffer.push({ manual: true });
		const saving = deferred();
		const entered = deferred();
		beforeWrite = async () => {
			entered.resolve(); await saving.promise;
		};
		const pending = layer[operation]();
		await entered.promise;
		canvas.scene = { id: "new-scene" };
		layer.pointer = 50;
		saving.resolve();
		await pending;
		assert.equal(layer.pointer, 50, operation);
		assert.equal(rendered.length, 0, operation);
	}
});

test("explicit areas bypass sight geometry and share the existing single-step Undo history", async () => {
	assert.deepEqual(await api.revealArea({ shape: "rectangle", x: 10, y: 20, width: 30, height: 40 }), {
		status: "committed", sceneId: "scene", levelId: null, polygons: 1
	});
	assert.deepEqual(writes[0].value.events[0][0].vertices, [10, 20, 40, 20, 40, 60, 10, 60]);
	const vertices = [10, 10, 80, 10, 30, 30, 80, 80, 10, 80];
	const pending = api.revealArea({ shape: "polygon", vertices }); vertices[0] = 999;
	await pending;
	assert.equal(writes[1].value.events[1][0].vertices[0], 10);
	assert.equal(sweeps.length, 0); assert.equal(flags.get("history").pointer, 2);
	await layer._onUndoKey(); assert.equal(flags.get("history").pointer, 1);
});

test("area validation rejects degenerate, non-finite, intersecting and oversized shapes without writes", async () => {
	for (const area of [null, {}, { shape: "rectangle", x: 0, y: 0, width: -1, height: 2 },
		{ shape: "polygon", vertices: [0, 0, 10, 10, 0, 10, 10, 0] },
		{ shape: "polygon", vertices: [0, 0, 1, 1, 2, 2] },
		{ shape: "polygon", vertices: [0, 0, Infinity, 0, 0, 10] },
		{ shape: "polygon", vertices: Array(516).fill(1) }]) {
		await assert.rejects(api.revealArea(area), { code: "INVALID_INPUT" });
	}
	assert.equal(writes.length, 0);
	await api.revealArea({ shape: "polygon", vertices: [0, 0, 0, 10, 10, 10, 10, 0, 0, 0] });
	assert.equal(writes.length, 1);
});

test("area reveals retain disabled, busy, permission and queued-context guards", async () => {
	const area = { shape: "rectangle", x: 0, y: 0, width: 10, height: 10 };
	flags.set("visible", false); assert.equal((await api.revealArea(area)).reason, "disabled");
	flags.set("visible", true); layer.lock = true; assert.equal((await api.revealArea(area)).reason, "busy");
	layer.lock = false;
	const pending = api.revealArea(area); canvas.scene = { id: "other" };
	assert.equal((await pending).reason, "context-changed"); canvas.scene = scene;
	game.user.isGM = false; await assert.rejects(api.revealArea(area), { code: "NOT_GM" });
	assert.equal(writes.length, 0);
});
