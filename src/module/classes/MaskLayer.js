/* MaskLayer extends CanvasLayer
 *
 * Creates an interactive layer which has an alpha channel mask
 * that can be rendered to and history for syncing between players
 * and replaying the mask / undo etc.
 */

import { simplefogLog, simplefogLogDebug } from "../helpers.js";

export default class MaskLayer extends InteractionLayer {
	constructor(layername) {
		super();
		this.lock = false;
		this.layername = layername;
		this.historyBuffer = [];
		this.pointer = 0;
		this.gridLayout = {};
		this.dragStart = { x: 0, y: 0 };
		// Not actually used, just to prevent foundry from complaining
		this.history = [];
		this.BRUSH_TYPES = {
			ELLIPSE: 0,
			BOX: 1,
			ROUNDED_RECT: 2,
			POLYGON: 3,
		};
		this.DEFAULTS = {
			visible: false,
			blurEnable: true,
			blurQuality: 2,
			blurRadius: 5,
			gmColorAlpha: 0.6,
			gmColorTint: "0x000000",
			playerColorAlpha: 1,
			playerColorTint: "0x000000",
			fogImageOverlayFilePath: "",
			fogImageOverlayGMAlpha: 0.6,
			fogImageOverlayPlayerAlpha: 1,
			fogImageOverlayZIndex: 6000,
			layerZindex: 220,
		};
	}

	static get layerOptions() {
		// @ts-ignore
		return mergeObject(super.layerOptions, {
			// ToDo: is ugly hack still needed?
			// Ugly hack - render at very high zindex and then re-render at layer init with layerZindex value
			zIndex: game.settings.get("simplefog", "zIndex"),
		});
	}

	/* -------------------------------------------- */
	/*  Init                                        */
	/* -------------------------------------------- */

	/**
	 * Called on canvas init, creates the canvas layers and various objects and registers listeners
	 *
	 * Important objects:
	 *
	 * layer       - PIXI Sprite which holds all the mask elements
	 * filters     - Holds filters such as blur applied to the layer
	 * fogColorLayer  - PIXI Sprite wrapping the renderable mask
	 * maskTexture - renderable texture that holds the actual mask data
	 * fogImageOverlayLayer   - PIXI Sprite that holds the image applied over the fog color
	 */
	initMask() {
		simplefogLogDebug("MaskLayer.initMask");
		// Check if masklayer is flagged visible
		let v = this.getSetting("visible");
		if (v === undefined) v = false;
		this.visible = v;
		simplefogLogDebug("MaskLayer.initMask - visible", this.visible);

		// The layer is the primary sprite to be displayed
		this.fogColorLayer = MaskLayer.getCanvasSprite();
		this.setColorTint(this.getTint());
		this.setColorAlpha(this.getColorAlpha(), true);

		this.blur = new PIXI.filters.BlurFilter();
		this.blur.padding = 0;
		this.blur.repeatEdgePixels = true;
		this.blur.blur = this.getSetting("blurRadius");
		this.blur.quality = this.getSetting("blurQuality");

		// Filters
		if (this.getSetting("blurEnable")) {
			this.fogColorLayer.filters = [this.blur];
		} else {
			this.fogColorLayer.filters = [];
		}

		// So you can hit escape on the keyboard and it will bring up the menu
		this._controlled = {};

		this.maskTexture = MaskLayer.getMaskTexture();
		this.maskSprite = new PIXI.Sprite(this.maskTexture);

		this.fogColorLayer.mask = this.maskSprite;
		this.setFill();

		// Allow zIndex prop to function for items on this layer
		this.sortableChildren = true;

		// Render entire history stack
		this.renderStack(undefined, 0, undefined, true);

		// apply image overlay to fog layer after we renderStack to prevent revealing the map
		this.fogImageOverlayLayer = new PIXI.Sprite();
		this.fogImageOverlayLayer.position.set(canvas.dimensions.sceneRect.x, canvas.dimensions.sceneRect.y);
		this.fogImageOverlayLayer.width = canvas.dimensions.sceneRect.width;
		this.fogImageOverlayLayer.height = canvas.dimensions.sceneRect.height;
		this.fogImageOverlayLayer.mask = this.maskSprite;
		this.setFogImageOverlayZIndex(this.getSetting("fogImageOverlayZIndex"));
		this.setFogImageOverlayTexture();
		this.setFogImageOverlayAlpha(this.getFogImageOverlayAlpha(), true);
	}

	/* -------------------------------------------- */
	/*  Getters and setters for layer props         */
	/* -------------------------------------------- */

	// Tint & Alpha have special cases because they can differ between GM & Players
	// And alpha can be animated for transition effects

	getColorAlpha() {
		let alpha;
		if (game.user.isGM) alpha = this.getSetting("gmColorAlpha");
		else alpha = this.getSetting("playerColorAlpha");
		if (!alpha) {
			if (game.user.isGM) alpha = this.DEFAULTS.gmColorAlpha;
			else alpha = this.DEFAULTS.playerColorAlpha;
		}
		return alpha;
	}

	/**
	 * Sets the scene's alpha for the primary layer.
	 * @param alpha {Number} 0-1 opacity representation
	 * @param skip {Boolean} Optional override to skip using animated transition
	 */
	async setColorAlpha(alpha, skip = false) {
		simplefogLogDebug("MaskLayer.setColorAlpha");
		// If skip is false, do not transition and just set alpha immediately
		if (skip || !this.getSetting("transition")) {
			this.fogColorLayer.alpha = alpha;
		}
		// Loop until transition is complete
		else {
			const start = this.fogColorLayer.alpha;
			const dist = start - alpha;
			const fps = 60;
			const speed = this.getSetting("transitionSpeed");
			const frame = 1000 / fps;
			const rate = dist / ((fps * speed) / 1000);
			let f = (fps * speed) / 1000;
			while (f > 0) {
				// Delay 1 frame before updating again
				// eslint-disable-next-line no-await-in-loop
				await new Promise((resolve) => setTimeout(resolve, frame));
				this.fogColorLayer.alpha -= rate;
				f -= 1;
			}
			// Reset target alpha in case loop overshot a bit
			this.fogColorLayer.alpha = alpha;
		}
	}

	getTint() {
		let tint;
		if (game.user.isGM) tint = this.getSetting("gmColorTint");
		else tint = this.getSetting("playerColorTint");
		if (!tint) {
			if (game.user.isGM) tint = this.gmColorTintDefault;
			else tint = this.playerColorTintDefault;
		}
		return tint;
	}

	setColorTint(tint) {
		this.fogColorLayer.tint = tint;
	}

	static getMaskTexture() {
		simplefogLogDebug("MaskLayer.getMaskTexture");
		const d = canvas.dimensions;
		let res = 1.0;
		if (d.width * d.height > 16000 ** 2) res = 0.25;
		else if (d.width * d.height > 8000 ** 2) res = 0.5;

		// Create the mask elements
		const tex = PIXI.RenderTexture.create({
			width: canvas.dimensions.width,
			height: canvas.dimensions.height,
			resolution: res,
		});
		return tex;
	}

	/* -------------------------------------------- */
	/*  Player Fog Image Overlay                    */
	/* -------------------------------------------- */
	async setFogImageOverlayTexture(fogImageOverlayFilePath = this.getSetting("fogImageOverlayFilePath")) {
		if (fogImageOverlayFilePath) {
			const texture = await loadTexture(fogImageOverlayFilePath);
			this.fogImageOverlayLayer.texture = texture;
			// If player, don't set tint
			// if (!game.user.isGM) canvas[this.layername].setColorTint(null);
		} else {
			this.fogImageOverlayLayer.texture = undefined;
		}
	}

	getFogImageOverlayAlpha() {
		let alpha;
		if (game.user.isGM) alpha = this.getSetting("fogImageOverlayGMAlpha");
		else alpha = this.getSetting("fogImageOverlayPlayerAlpha");
		if (!alpha) {
			if (game.user.isGM) alpha = this.DEFAULTS.fogImageOverlayGMAlpha;
			else alpha = this.DEFAULTS.fogImageOverlayAlpha;
		}
		return alpha;
	}

	async setFogImageOverlayAlpha(alpha, skip = false) {
		// If skip is false, do not transition and just set alpha immediately
		if (skip || !this.getSetting("transition")) {
			this.fogImageOverlayLayer.alpha = alpha;
		}
		// Loop until transition is complete
		else {
			const start = this.fogImageOverlayLayer.alpha;
			const dist = start - alpha;
			const fps = 60;
			const speed = this.getSetting("transitionSpeed");
			const frame = 1000 / fps;
			const rate = dist / ((fps * speed) / 1000);
			let f = (fps * speed) / 1000;
			while (f > 0) {
				// Delay 1 frame before updating again
				// eslint-disable-next-line no-await-in-loop
				await new Promise((resolve) => setTimeout(resolve, frame));
				this.fogImageOverlayLayer.alpha -= rate;
				f -= 1;
			}
			// Reset target alpha in case loop overshot a bit
			this.fogImageOverlayLayer.alpha = alpha;
		}
	}

	async setFogImageOverlayZIndex(zIndex) {
		this.fogImageOverlayLayer.zIndex = zIndex;
	}

	/**
	 * Gets and sets various layer wide properties
	 * Some properties have different values depending on if user is a GM or player
	 */

	getSetting(name) {
		let setting = canvas.scene.getFlag(this.layername, name);
		if (setting === undefined) setting = this.getUserSetting(name);
		if (setting === undefined) setting = this.DEFAULTS[name];
		return setting;
	}

	async setSetting(name, value) {
		const v = await canvas.scene.setFlag(this.layername, name, value);
		return v;
	}

	getUserSetting(name) {
		let setting = game.user.getFlag(this.layername, name);
		if (setting === undefined) setting = this.DEFAULTS[name];
		return setting;
	}

	async setUserSetting(name, value) {
		const v = await game.user.setFlag(this.layername, name, value);
		return v;
	}

	/**
	 * Renders the history stack to the mask
	 * @param history {Array}       A collection of history events
	 * @param start {Number}        The position in the history stack to begin rendering from
	 * @param start {Number}        The position in the history stack to stop rendering
	 */
	renderStack(
		history = canvas.scene.getFlag(this.layername, "history"),
		start = this.pointer,
		stop = canvas.scene.getFlag(this.layername, "history.pointer"),
		isInit = false
	) {
		simplefogLogDebug("MaskLayer.renderStack");
		history = history || { events: [], pointer: 0 };
		// If history is blank, do nothing
		if (history === undefined && !isInit) {
			simplefogLogDebug("MaskLayer.renderStack - set visible to autoEnableSceneFog");
			this.visible = game.settings.get("simplefog", "autoEnableSceneFog");
			return;
		}
		// If history is zero, reset scene fog
		if (history.events.length === 0) this.resetMask(false);
		if (start === undefined) start = 0;
		if (stop === undefined) stop = history.events.length;
		// If pointer preceeds the stop, reset and start from 0
		if (stop <= this.pointer) {
			this.resetMask(false);
			start = 0;
		}

		simplefogLog(`Rendering from: ${start} to ${stop}`);
		// Render all ops starting from pointer
		for (let i = start; i < stop; i += 1) {
			for (let j = 0; j < history.events[i].length; j += 1) {
				this.renderBrush(history.events[i][j], false);
			}
		}
		// Update local pointer
		this.pointer = stop;
		// Prevent calling update when no lights loaded
		if (!canvas.sight?.light?.los?.geometry) return;
		// Update sight layer
		// ToDo: Determine replacement for canvas.sight.refresh()
		canvas.perception.refresh();
	}

	/**
	 * Add buffered history stack to scene flag and clear buffer
	 */
	async commitHistory() {
		simplefogLogDebug("MaskLayer.commitHistory");
		// Do nothing if no history to be committed, otherwise get history
		if (this.historyBuffer.length === 0) return;
		if (this.lock) return;
		this.lock = true;
		let history = canvas.scene.getFlag(this.layername, "history");
		// If history storage doesnt exist, create it
		if (!history) {
			history = {
				events: [],
				pointer: 0,
			};
		}
		// If pointer is less than history length (f.x. user undo), truncate history
		history.events = history.events.slice(0, history.pointer);
		// Push the new history buffer to the scene
		history.events.push(this.historyBuffer);
		history.pointer = history.events.length;
		await canvas.scene.unsetFlag(this.layername, "history");
		await this.setSetting("history", history);
		simplefogLog(`Pushed ${this.historyBuffer.length} updates.`);
		// Clear the history buffer
		this.historyBuffer = [];
		this.lock = false;
	}

	/**
	 * Resets the mask of the layer
	 * @param save {Boolean} If true, also resets the layer history
	 */
	async resetMask(save = true) {
		simplefogLogDebug("MaskLayer.resetMask");
		// Fill fog layer with solid
		this.setFill();
		// If save, also unset history and reset pointer
		if (save) {
			await canvas.scene.unsetFlag(this.layername, "history");
			await canvas.scene.setFlag(this.layername, "history", {
				events: [],
				pointer: 0,
			});
			this.pointer = 0;
		}
	}

	/**
	 * Resets the mask of the layer
	 * @param save {Boolean} If true, also resets the layer history
	 */
	async blankMask() {
		simplefogLogDebug("MaskLayer.blankMask");
		await this.resetMask();
		this.renderBrush({
			shape: this.BRUSH_TYPES.BOX,
			x: 0,
			y: 0,
			width: this.width,
			height: this.height,
			fill: 0x000000,
		});
		this.commitHistory();
	}

	/**
	 * Steps the history buffer back X steps and redraws
	 * @param steps {Integer} Number of steps to undo, default 1
	 */
	async undo(steps = 1) {
		simplefogLogDebug("MaskLayer.undo");
		simplefogLog(`Undoing ${steps} steps.`);
		// Grab existing history
		// Todo: this could probably just grab and set the pointer for a slight performance improvement
		let history = canvas.scene.getFlag(this.layername, "history");
		if (!history) {
			history = {
				events: [],
				pointer: 0,
			};
		}
		let newpointer = this.pointer - steps;
		if (newpointer < 0) newpointer = 0;
		// Set new pointer & update history
		history.pointer = newpointer;
		await canvas.scene.unsetFlag(this.layername, "history");
		await canvas.scene.setFlag(this.layername, "history", history);
	}

	/* -------------------------------------------- */
	/*  Shapes, sprites and PIXI objs               */
	/* -------------------------------------------- */

	/**
	 * Creates a PIXI graphic using the given brush parameters
	 * @param data {Object}       A collection of brush parameters
	 * @returns {Object}          PIXI.Graphics() instance
	 *
	 * @example
	 * const myBrush = this.brush({
	 *      shape: "ellipse",
	 *      x: 0,
	 *      y: 0,
	 *      fill: 0x000000,
	 *      width: 50,
	 *      height: 50,
	 *      alpha: 1,
	 *      visible: true
	 * });
	 */
	brush(data) {
		// Get new graphic & begin filling
		const alpha = typeof data.alpha === "undefined" ? 1 : data.alpha;
		const visible = typeof data.visible === "undefined" ? true : data.visible;
		const brush = new PIXI.Graphics();
		brush.beginFill(data.fill);
		// Draw the shape depending on type of brush
		switch (data.shape) {
			case this.BRUSH_TYPES.ELLIPSE:
				brush.drawEllipse(0, 0, data.width, data.height);
				break;
			case this.BRUSH_TYPES.BOX:
				brush.drawRect(0, 0, data.width, data.height);
				break;
			case this.BRUSH_TYPES.ROUNDED_RECT:
				brush.drawRoundedRect(0, 0, data.width, data.height, 10);
				break;
			case this.BRUSH_TYPES.POLYGON:
				brush.drawPolygon(data.vertices);
				break;
			default:
				break;
		}
		// End fill and set the basic props
		brush.endFill();
		brush.alpha = alpha;
		brush.visible = visible;
		brush.x = data.x;
		brush.y = data.y;
		brush.zIndex = data.zIndex;
		return brush;
	}

	/**
	 * Gets a brush using the given parameters, renders it to mask and saves the event to history
	 * @param data {Object}       A collection of brush parameters
	 * @param save {Boolean}      If true, will add the operation to the history buffer
	 */
	renderBrush(data, save = true) {
		const brush = this.brush(data);
		this.composite(brush);
		brush.destroy();
		if (save) this.historyBuffer.push(data);
	}

	/**
	 * Renders the given brush to the layer mask
	 * @param data {Object}       PIXI Object to be used as brush
	 */
	composite(brush) {
		if (isNewerVersion(game.version, "10.999")) {
			const opt = {
				renderTexture: this.maskTexture,
				clear: false,
				transform: null,
				skipUpdateTransform: false
			};
			canvas.app.renderer.render(brush, opt);
		}
		else {
			canvas.app.renderer.render(brush, this.maskTexture, false, null, false);
		}
	}

	/**
	 * Returns a blank PIXI Sprite of canvas dimensions
	 */
	static getCanvasSprite() {
		simplefogLogDebug("MaskLayer.getCanvasSprite");
		const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
		const d = canvas.dimensions;
		sprite.width = d.width;
		sprite.height = d.height;
		sprite.x = 0;
		sprite.y = 0;
		sprite.zIndex = 5000;
		return sprite;
	}

	/**
	 * Fills the mask layer with solid white
	 */
	setFill() {
		simplefogLogDebug("MaskLayer.setFill");
		const fill = new PIXI.Graphics();
		fill.beginFill(0xffffff);
		fill.drawRect(0, 0, canvas.dimensions.width, canvas.dimensions.height);
		fill.endFill();
		this.composite(fill);
		fill.destroy();
	}

	/**
	 * Toggles visibility of primary layer
	 */
	toggle() {
		simplefogLogDebug("MaskLayer.toggle");
		const v = this.getSetting("visible");
		this.visible = !v;
		this.setSetting("visible", !v);

		// If first time, set autofog to opposite so it doesn't reapply it.
		let history = canvas.scene.getFlag(this.layername, "history");

		if (history === undefined) {
			this.setSetting("autoFog", !v);

		}
	}

	/**
	 * Actions upon layer becoming active
	 */
	activate() {
		simplefogLogDebug("MaskLayer.activate");
		super.activate();
    if (isNewerVersion(game.version, "10.999")) {
      this.eventMode = "static";
    } else {
      this.interactive = true;
    }
	}

	/**
	 * Actions upon layer becoming inactive
	 */
	deactivate() {
		simplefogLogDebug("MaskLayer.deactivate");
		super.deactivate();
    if (isNewerVersion(game.version, "10.999")) {
      this.eventMode = "passive";
    } else {
      this.interactive = false;
    }
	}

	async draw() {
		simplefogLogDebug("MaskLayer.draw");
		super.draw();
		this.initMask();
		this.addChild(canvas.simplefog.fogImageOverlayLayer);
		this.addChild(this.fogColorLayer);
		this.addChild(this.fogColorLayer.mask);
	}

	refreshZIndex() {
		canvas.simplefog.zIndex = game.settings.get("simplefog", "zIndex");
	}
}
