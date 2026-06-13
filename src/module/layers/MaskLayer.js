/* MaskLayer extends CanvasLayer
 *
 * Creates an interactive layer which has an alpha channel mask
 * that can be rendered to and history for syncing between players
 * and replaying the mask / undo etc.
 */

import BrushPreview from "./BrushPreview.js";
import FogColorLayer from "./FogColorLayer.js";

export default class MaskLayer extends foundry.canvas.layers.InteractionLayer {
	constructor() {
		super();
		this.lock = false;
		this.historyBuffer = [];
		this.pointer = 0;
		this.gridLayout = {};
		this.dragStart = { x: 0, y: 0 };
		this.BRUSH_TYPES = {
			ELLIPSE: 0,
			BOX: 1,
			ROUNDED_RECT: 2,
			POLYGON: 3,
		};

		// Throttled partial sync state
		this._partialSyncTimer = null;
		this._partialSyncInterval = 150;
		this._partialSyncActive = false;
		this._activeLevelId = null;
		this.settings = game.settings.get("simplefog", "config");
	}

	getHistoryKey() {
		const levelId = this._activeLevelId ?? canvas.level?.id ?? null;
		return levelId ? `levelHistory.${levelId}` : "history";
	}

	static get layerOptions() {
		return foundry.utils.mergeObject(super.layerOptions, {
			baseClass: MaskLayer,
			zIndex: game.settings.get("simplefog", "zIndex"),
		});
	}

	/**
	 * @returns {PIXI.Rectangle}
	 */
	get dimensions() {
		return game.user.isGM ? canvas.dimensions.sceneRect : canvas.dimensions.rect;
	}

	/* -------------------------------------------- */
	/*  Getters and setters for layer props         */
	/* -------------------------------------------- */

	/**
	 * @returns {PIXI.RenderTexture}
	 */
	static getMaskTexture() {
		// PIXI.RenderTexture requires the whole canvas' size, not just the scene's rectangle
		const { width, height } = canvas.dimensions;
		const pixels = width * height;
		let resolution = 1.0;
		if (pixels > 16000 ** 2) resolution = 0.25;
		else if (pixels > 8000 ** 2) resolution = 0.5;

		// Create the mask elements
		return PIXI.RenderTexture.create({ width, height, resolution });
	}

	/**
   * Gets and sets various layer wide properties
   * Some properties have different values depending on if user is a GM or player
   */

	getSetting(name) {
		return canvas.scene.getFlag("simplefog", name) ?? this.settings[name];
	}

	async setSetting(name, value) {
		return await canvas.scene.setFlag("simplefog", name, value);
	}

	async setUserSetting(name, value) {
		return await game.user.setFlag("simplefog", name, value);
	}

	/**
   * Renders the history stack to the mask
   * @param history {Array}       A collection of history events
   * @param start {Number}        The position in the history stack to begin rendering from
   * @param start {Number}        The position in the history stack to stop rendering
   */
	renderStack({
		history = canvas.scene.getFlag("simplefog", this.getHistoryKey()),
		start = this.pointer,
		stop = canvas.scene.getFlag("simplefog", `${this.getHistoryKey()}.pointer`),
		isInit = false
	}) {
		if (!history || !Array.isArray(history.events)) history = { events: [], pointer: 0 };
		// If history is blank, do nothing
		if (history === undefined && !isInit) {
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
		this.updatePerception();
	}

	updatePerception() {
		canvas.perception.update({
			refreshLighting: true,
			refreshVision: true,
			refreshOcclusion: true
		});
	}

	/**
   * Add buffered history stack to scene flag and clear buffer
   */
	async commitHistory() {
		// Do nothing if no history to be committed, otherwise get history
		if (this.historyBuffer.length === 0) return;
		if (this.lock) return;
		this.lock = true;
		const historyKey = this.getHistoryKey();
		let history = canvas.scene.getFlag("simplefog", historyKey);
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
		// Need to unset arrays first, otherwise they get concatenated
		await canvas.scene.unsetFlag("simplefog", historyKey);
		await canvas.scene.setFlag("simplefog", historyKey, history);
		this.pointer = history.pointer;
		// Clear the history buffer
		this.historyBuffer = [];
		this.lock = false;
	}

	/**
   * Resets the mask of the layer
   * @param save {Boolean} If true, also resets the layer history
   */
	async resetMask(save = true) {
		// Fill fog layer with solid
		this.setFill();
		// If save, also unset history and reset pointer
		if (save) {
			const historyKey = this.getHistoryKey();
			await canvas.scene.unsetFlag("simplefog", historyKey);
			await canvas.scene.setFlag("simplefog", historyKey, {
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
		await this.resetMask();
		this.renderBrush({
			shape: this.BRUSH_TYPES.BOX,
			fill: 0x000000,
			...this.dimensions
		});
		this.commitHistory();
	}

	async _onUndoKey() {
		// Grab existing history
		const historyKey = this.getHistoryKey();
		const history = canvas.scene.getFlag("simplefog", historyKey) ?? { events: [], pointer: 0 };
		// Set new pointer & update history
		history.pointer = Math.max(0, this.pointer - 1);
		await canvas.scene.unsetFlag("simplefog", historyKey);
		await canvas.scene.setFlag("simplefog", historyKey, history);
		this.pointer = history.pointer;
		return true;
	}

	/* -------------------------------------------- */
	/*  Shapes, sprites and PIXI objs               */
	/* -------------------------------------------- */

	/**
   * Gets a brush using the given parameters, renders it to mask and saves the event to history
   * @param data {Object}       A collection of brush parameters
   * @param save {Boolean}      If true, will add the operation to the history buffer
   */
	renderBrush(data, save = true) {
		const brush = new BrushPreview(data);
		this.composite(brush);
		brush.destroy();
		if (save) this.historyBuffer.push(data);
	}

	/**
   * Renders the given brush to the layer mask
   * @param data {Object}       PIXI Object to be used as brush
   */
	composite(brush) {
		const opt = {
			renderTexture: this.maskTexture,
			clear: false,
			transform: null,
			skipUpdateTransform: false
		};
		canvas.app.renderer.render(brush, opt);
	}

	/**
   * Fills the mask layer with solid white
   */
	setFill() {
		const fill = new PIXI.Graphics();
		fill.beginFill(0xffffff);
		const { x, y, width, height } = this.dimensions;
		fill.drawRect(x, y, width, height);
		fill.endFill();
		this.composite(fill);
		fill.destroy();
	}

	/**
   * Toggles visibility of primary layer
   */
	async toggle() {
		const v = canvas.scene.getFlag("simplefog", "visible") ?? false;
		this.visible = !v;
		await canvas.scene.setFlag("simplefog", "visible", !v);

		// If first time, set autofog to opposite so it doesn't reapply it.
		let history = canvas.scene.getFlag("simplefog", this.getHistoryKey());

		if (history === undefined) {
			await canvas.scene.setFlag("simplefog", "autoFog", !v);
		}
	}

	async _draw() {
		const imageAlpha = (game.user.isGM
			? this.getSetting("fogImageOverlayGMAlpha")
			: this.getSetting("fogImageOverlayPlayerAlpha")
		) / 100;
		// Check if masklayer is flagged visible
		this.visible = this.getSetting("visible") ?? false;

		this.maskTexture = MaskLayer.getMaskTexture();
		this.maskSprite = new PIXI.Sprite(this.maskTexture);

		// The layer is the primary sprite to be displayed
		this.fogColorLayer = new FogColorLayer(this.dimensions);
		this.setFill();

		// Allow zIndex prop to function for items on this layer
		this.sortableChildren = true;

		// Render entire history stack
		this.renderStack({ start: 0, isInit: true });

		// apply image overlay to fog layer after we renderStack to prevent revealing the map
		const fogImageOverlayFilePath = this.getSetting("fogImageOverlayFilePath");
		const texture = fogImageOverlayFilePath ? foundry.canvas.getTexture(fogImageOverlayFilePath) : null;
		this.fogImageOverlayLayer = new PIXI.Sprite(texture);
		const { x, y, width, height } = canvas.dimensions.sceneRect;
		this.fogImageOverlayLayer.position.set(x, y);
		this.fogImageOverlayLayer.width = width;
		this.fogImageOverlayLayer.height = height;
		this.fogImageOverlayLayer.mask = this.maskSprite;
		this.fogImageOverlayLayer.zIndex = this.getSetting("fogImageOverlayZIndex");
		this.fogImageOverlayLayer.alpha = imageAlpha;

		this.addChild(this.fogImageOverlayLayer);
		this.addChild(this.fogColorLayer);
		this.addChild(this.fogColorLayer.mask);
	}
}
