import CONSTANTS from "./constants.js";

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

/**
 * Dumps a render of a given pixi container or texture to a new tab
 */
export function pixiDump(tgt = null) {
	canvas.app.render();
	const data = canvas.app.renderer.extract.base64(tgt);
	const win = window.open();
	win.document.write(`<img src='${data}'/>`);
}

/**
 * Gets a single pixel of texture data from GPU
 * @param target {Object} PIXI Object to read from
 * @param x {Integer}     X Position to read
 * @param y {Integer}     Y Position to read
 */
export function readPixel(target, x = 0, y = 0) {
	const { renderer } = canvas.app;
	let resolution;
	let renderTexture;
	let generated = false;
	if (target instanceof PIXI.RenderTexture) {
		renderTexture = target;
	} else {
		renderTexture = renderer.generateTexture(target);
		generated = true;
	}
	if (renderTexture) {
		resolution = renderTexture.baseTexture.resolution;
		renderer.renderTexture.bind(renderTexture);
	}
	const pixel = new Uint8Array(4);
	// read pixels to the array
	const { gl } = renderer;
	gl.readPixels(x * resolution, y * resolution, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
	if (generated) {
		renderTexture.destroy(true);
	}
	return pixel;
}

export function addSimplefogControlToggleListener() {
	window.addEventListener("keydown", (event) => {
		if (!areHotkeysEnabled() || !toggleControls(event) || !isOnCanvas(event)) {
			return;
		}

		let controlName = getNewControlName();
		let toolName = game.settings.get("simplefog", "toolHotKeys");

		$(`li.scene-control[data-control=${controlName}]`)?.click();
		setTimeout(function () {
			$(`ol.sub-controls.active li.control-tool[data-tool=${toolName}]`)?.click();
		}, 500);
	});
}

/**
 * @returns bool
 */
function areHotkeysEnabled() {
	return game.settings.get("simplefog", "enableHotKeys");
}

/**
 * @param {Event} event
 * @returns bool
 */
function toggleControls(event) {
	return event.key === "s" && event.ctrlKey;
}

/**
 * @param {Event} event
 * @returns bool
 */
function isOnCanvas(event) {
	let $path = $(event.path[0]);
	let allowedClasses = ["vtt", "game"];

	for (let allowedClass of allowedClasses) {
		if (!$path.hasClass(allowedClass)) {
			return false;
		}
	}

	return true;
}

/**
 * @returns string
 */
function getNewControlName() {
	return isActiveControl() ? "token" : "simplefog";
}

/**
 * @returns bool
 */
function isActiveControl() {
	return getActiveControlName() === "simplefog";
}

/**
 * @returns string
 */
function getActiveControlName() {
	return ui.controls.activeControl;
}

export function addSimplefogOpacityToggleListener() {
	window.addEventListener("keydown", (event) => {
		if (!areHotkeysEnabled() || !toggleOpacity(event) || !isOnCanvas(event) || !isActiveControl()) {
			return;
		}

		toggleSliderAndSubmitForm();
	});
}

/**
 * @param {Event} event
 * @returns bool
 */
function toggleOpacity(event) {
	return event.key === "t";
}

function toggleSliderAndSubmitForm() {
	let $slider = $("input[name=brushOpacity]");
	let brushOpacity = $slider.val();
	$slider.val(brushOpacity === "100" ? 0 : 100);
	$("form#simplefog-brush-controls-form").submit();
}

export function dmToGM(message) {
	let whisper_to_dm = ChatMessage.create({
		whisper: [game.user.id],
		blind: true,
		content: message,
	});
}

export function dmToAllGM(message) {
	let dm_ids = [];
	for (let indexA = 0; indexA < game.users.length; indexA++) {
		if (game.users[indexA].value.isGM) {
			dm_ids.push(game.users[indexA].key);
		}
	}

	let whisper_to_dm = ChatMessage.create({
		whisper: dm_ids,
		blind: true,
		content: message,
	});
}
