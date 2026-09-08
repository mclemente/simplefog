import { areaVertices } from "./areaGeometry.js";
import { getDoorOrigins, getRoomVertices } from "./roomGeometry.js";

export class SimpleFogAPIError extends Error {
	constructor(code, message, options) {
		super(message, options);
		this.name = "SimpleFogAPIError";
		this.code = code;
	}
}

/** Create the public API once at init. Each client has its own ordered request queue. */
export function createAPI() {
	let queue = Promise.resolve();

	function captureContext() {
		if (!game.user?.isGM) throw new SimpleFogAPIError("NOT_GM", "Only a GM can change Simple Fog.");
		const layer = canvas?.simplefog;
		if (!canvas?.ready || !canvas.scene || !layer?.maskTexture) {
			throw new SimpleFogAPIError("NOT_READY", "A drawn scene with Simple Fog is required.");
		}
		const levelId = canvas.level?.id ?? null;
		if (layer._activeLevelId !== levelId) {
			throw new SimpleFogAPIError("NOT_READY", "Simple Fog is changing levels.");
		}
		return {
			scene: canvas.scene, layer, levelId, historyKey: layer.getHistoryKey(),
			texture: layer.maskTexture, version: layer._historyContextVersion
		};
	}

	function isCurrent(context) {
		return canvas.ready && canvas.scene === context.scene && canvas.simplefog === context.layer
			&& (canvas.level?.id ?? null) === context.levelId && context.layer._activeLevelId === context.levelId
			&& context.layer.maskTexture === context.texture
			&& context.layer._historyContextVersion === context.version;
	}

	function result(context, status, polygons = 0, reason = undefined) {
		return { status, sceneId: context.scene.id, levelId: context.levelId, polygons, ...(reason ? { reason } : {}) };
	}

	function validateOptions(options) {
		if (!options || typeof options !== "object" || Array.isArray(options)) {
			throw new SimpleFogAPIError("INVALID_INPUT", "Options must be an object.");
		}
		if (options.passThroughOpenDoors !== undefined && typeof options.passThroughOpenDoors !== "boolean") {
			throw new SimpleFogAPIError("INVALID_INPUT", "passThroughOpenDoors must be a boolean.");
		}
	}

	function validateWall(wall, context) {
		if (wall?.documentName !== "Wall" || context.scene.walls.get(wall.id) !== wall || !wall.isDoor) {
			throw new SimpleFogAPIError("INVALID_WALL", "Supply a door WallDocument or Wall from the viewed scene.");
		}
		if (wall.levels.size && !wall.levels.has(context.levelId)) {
			throw new SimpleFogAPIError("INVALID_WALL", "The door does not belong to the viewed level.");
		}
		if (!Array.isArray(wall.c) || wall.c.length !== 4 || !wall.c.every(Number.isFinite)
			|| !Number.isFinite(Math.hypot(wall.c[2] - wall.c[0], wall.c[3] - wall.c[1]))
			|| Math.hypot(wall.c[2] - wall.c[0], wall.c[3] - wall.c[1]) === 0) {
			throw new SimpleFogAPIError("INVALID_WALL", "The door must have finite endpoints and non-zero length.");
		}
	}

	function enqueue(context, getPolygons, fill = 0x000000) {
		const request = queue.then(async () => {
			if (!game.user?.isGM) throw new SimpleFogAPIError("NOT_GM", "Only a GM can change Simple Fog.");
			if (!isCurrent(context)) return result(context, "skipped", 0, "context-changed");
			const { layer } = context;
			if (!layer.getSetting("visible")) return result(context, "skipped", 0, "disabled");
			// Do not absorb an unfinished manual stroke or its partial history writes.
			if (layer.lock || layer.op || layer._partialSyncActive || layer.historyBuffer.length) {
				return result(context, "skipped", 0, "busy");
			}
			const polygons = getPolygons()
				.filter((vertices) => vertices.length >= 6 && vertices.length % 2 === 0
					&& vertices.every(Number.isFinite));
			if (!polygons.length) return result(context, "skipped", 0, "empty");
			const events = polygons.map((vertices) => ({ shape: layer.BRUSH_TYPES.POLYGON, vertices, fill }));
			try {
				await layer.commitHistoryBatch(events, context, () => isCurrent(context));
			} catch(error) {
				throw new SimpleFogAPIError("SAVE_FAILED", "Simple Fog could not save the fog change.", { cause: error });
			}
			return result(context, "committed", events.length);
		});
		// Failed requests reject their caller without poisoning the queue.
		queue = request.catch(() => {});
		return request;
	}

	const api = { apiVersion: 1 };
	for (const [prefix, fill] of [["reveal", 0x000000], ["apply", 0xffffff]]) {
		api[`${prefix}Area`] = async (options = {}) => {
			validateOptions(options);
			let vertices;
			try {
				vertices = areaVertices(options);
			} catch(error) {
				throw new SimpleFogAPIError("INVALID_INPUT", error.message);
			}
			return enqueue(captureContext(), () => [vertices], fill);
		};
		api[`${prefix}FromPoint`] = async (options = {}) => {
			validateOptions(options);
			const { x, y, passThroughOpenDoors = false } = options;
			if (!Number.isFinite(x) || !Number.isFinite(y)) {
				throw new SimpleFogAPIError("INVALID_INPUT", "x and y must be finite scene pixel coordinates.");
			}
			return enqueue(captureContext(), () => [getRoomVertices({ x, y }, { passThroughOpenDoors })], fill);
		};
		api[`${prefix}DoorSides`] = async (options = {}) => {
			validateOptions(options);
			const context = captureContext();
			const wall = options.wall?.document ?? options.wall;
			validateWall(wall, context);
			const passThroughOpenDoors = options.passThroughOpenDoors ?? false;
			return enqueue(context, () => {
				validateWall(wall, context);
				return getDoorOrigins(wall.c).map((point) => getRoomVertices(point, { passThroughOpenDoors }));
			}, fill);
		};
	}
	return Object.freeze(api);
}
