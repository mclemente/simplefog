import { CWSPNoDoors } from "./ClockwiseSweep.js";

/** Calculate the Room Tool's sight polygon without reading any tool or mouse state. */
export function getRoomVertices(origin, { radius = null, passThroughOpenDoors = false } = {}) {
	const point = { x: Math.round(origin.x), y: Math.round(origin.y) };
	if (!canvas.dimensions.sceneRect.contains(point.x, point.y)) return [];
	const sweep = CWSPNoDoors.create(point, {
		type: "sight",
		level: canvas.level,
		edgeTypes: { innerBounds: { mode: 2 } },
		radius,
		passThroughOpenDoors
	});
	return Array.from(sweep.points);
}

/** Two pixel-offset origins; rounding matches Foundry's polygon origin precision. */
export function getDoorOrigins([x0, y0, x1, y1]) {
	const length = Math.hypot(x1 - x0, y1 - y0);
	if (!Number.isFinite(length) || length === 0) throw new TypeError("The door must have non-zero length.");
	const midpoint = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
	const normal = { x: -(y1 - y0) / length, y: (x1 - x0) / length };
	return [-1, 1].map((side) => ({
		x: Math.round(midpoint.x + (side * normal.x * 2)),
		y: Math.round(midpoint.y + (side * normal.y * 2))
	}));
}
