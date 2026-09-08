/** Validate and snapshot an explicit rectangle or simple polygon in scene pixels. */
export function areaVertices(area) {
	const invalid = () => {
		throw new TypeError("Supply a positive rectangle or a non-intersecting polygon with 3-256 finite vertices.");
	};
	if (!area || typeof area !== "object" || Array.isArray(area)) invalid();
	let vertices;
	if (area.shape === "rectangle") {
		const { x, y, width, height } = area;
		if (![x, y, width, height, x + width, y + height].every(Number.isFinite)
			|| width <= 0 || height <= 0) invalid();
		vertices = [x, y, x + width, y, x + width, y + height, x, y + height];
	} else if (area.shape === "polygon") {
		if (!Array.isArray(area.vertices) || area.vertices.length > 514
			|| !area.vertices.every(Number.isFinite)) invalid();
		vertices = [...area.vertices];
		if (vertices.length >= 8 && vertices[0] === vertices.at(-2) && vertices[1] === vertices.at(-1)) {
			vertices.splice(-2);
		}
	} else invalid();
	if (vertices.length < 6 || vertices.length > 512 || vertices.length % 2) invalid();
	const points = [];
	for (let i = 0; i < vertices.length; i += 2) points.push({ x: vertices[i], y: vertices[i + 1] });
	const cross = (a, b, c) => ((b.x - a.x) * (c.y - a.y)) - ((b.y - a.y) * (c.x - a.x));
	const on = (a, b, c) => cross(a, b, c) === 0 && c.x >= Math.min(a.x, b.x) && c.x <= Math.max(a.x, b.x)
		&& c.y >= Math.min(a.y, b.y) && c.y <= Math.max(a.y, b.y);
	const intersects = (a, b, c, d) => {
		const abC = cross(a, b, c); const abD = cross(a, b, d); const cdA = cross(c, d, a); const cdB = cross(c, d, b);
		return ((abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0))
			|| on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b);
	};
	let twiceArea = 0;
	for (let i = 0; i < points.length; i++) {
		const a = points[i]; const b = points[(i + 1) % points.length];
		if (a.x === b.x && a.y === b.y) invalid();
		twiceArea += cross(points[0], a, b);
		for (let j = i + 1; j < points.length; j++) {
			if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
			if (intersects(a, b, points[j], points[(j + 1) % points.length])) invalid();
		}
	}
	if (!Number.isFinite(twiceArea) || Math.abs(twiceArea) < 1e-8) invalid();
	return vertices;
}
