/*
 * Monkeypatch for core canvas.sight.update() that implements autovisibility
 */
import { readPixel } from "./helpers.js";

/*
 * The token's worldTransform is not updated yet when this is called
 * probably because the token will be animated, so we need to convert
 * the token's grid position to world coords since grid position updates
 * immediately
 *
 * If there is a more straight forward way to do this it would be nice!
 */
function _getCanvasCoords(placeable) {
	const { grid } = canvas.scene.data;
	// Check if placeable is a door
	const p = placeable.data.door ? placeable.doorControl : placeable.data;

	try {
		return {
			x: Math.round((grid / 2) + p.x),
			y: Math.round((grid / 2) + p.y),
		};
	} catch(error) {
		return {
			x: Math.round(grid / 2),
			y: Math.round(grid / 2),
		};
	}
}

/*
 * Checks mask opacity at location of placeable and sets visibility
 */
function _setPlaceableVisibility(placeable) {
	if (placeable.observer && !game.user.isGM) return;
	const pos = _getCanvasCoords(placeable);
	const p = readPixel(canvas.simplefog.maskTexture, pos.x, pos.y);
	const pAvg = (p[0] + p[1] + p[2]) / 3;
	const v = pAvg / 255 < canvas.scene.getFlag("simplefog", "vThreshold");
	// if this is a door, we set vis on it's control object instead
	if (placeable.data.door) placeable.doorControl.visible = v;
	else placeable.visible = v;
}

/*
 * Extends canvas.sight.update() to set visibility for placeables based on simplefog
 */
export default function sightLayerUpdate() {
	// Skip checking placeables if simplefog not visible anyway
	if (!canvas.simplefog.visible) return;
	// Skip if autoVisibility not enabled for this scene
	if (!canvas.scene.getFlag("simplefog", "autoVisibility")) return;
	// Skip if user is GM and autoVisGM Disabled
	if (game.user.isGM && !canvas.scene.getFlag("simplefog", "autoVisGM")) return;
	// loop through placeables
	canvas.tokens.placeables.forEach((placeable) => {
		_setPlaceableVisibility(placeable);
	});
	canvas.notes.placeables.forEach((placeable) => {
		_setPlaceableVisibility(placeable);
	});
	canvas.walls.placeables.forEach((placeable) => {
		if (placeable.data.door) {
			_setPlaceableVisibility(placeable);
		}
	});
}
