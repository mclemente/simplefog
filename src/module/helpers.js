// ======================================
// PIXI UTILITY
// =======================================

/**
 * Converts web colors to base 16
 * @param n {Hex}               Web format color, f.x. #FF0000
 * @return {Hex}                Base 16 format color, f.x. 0xFF0000
 */
export function webToHex(n) {
	return n.replace("#", "0x");
}

/**
 * Converts a base16 color into a web color
 * @param n {Hex}               Base 16 Color, f.x. 0xFF0000
 * @return {Hex}                Web format color, f.x. #FF0000
 */
export function hexToWeb(n) {
	return `${n}`.replace("0x", "#");
}

/**
 * Converts a hexadecimal color to an integer percentage
 * @param n {Hex}               Base 16 Color, f.x. 0x000000
 * @return {Integer}             f.x 0
 */
export function hexToPercent(n) {
	return Math.ceil((n / 0xffffff) * 100);
}

/**
 * Converts an integer percent (0-100) to a hexadecimal greyscale color
 * @param n {Number}            0-100 numeric input
 * @return {Hex}                Base 16 format color, f.x. 0xFFFFFF
 */
export function percentToHex(n) {
	let c = Math.ceil(n * 2.55).toString(16);
	if (c.length === 1) c = `0${c}`;
	c = `0x${c}${c}${c}`;
	return c;
}

/**
 * Converts an object containing coordinate pair arrays into a single array of points for PIXI
 * @param hex {Object}  An object containing a set of [x,y] pairs
 */
export function hexObjsToArr(hex) {
	const a = [];
	hex.forEach((point) => {
		a.push(point.x);
		a.push(point.y);
	});
	// Append first point to end of array to complete the shape
	a.push(hex[0].x);
	a.push(hex[0].y);
	return a;
}
