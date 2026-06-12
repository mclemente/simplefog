/* SimplefogLayer extends MaskLayer
 *
 * Implements tools for manipulating the MaskLayer
 */

import { Layout } from "../../libs/hexagons.js";
import SimplefogPalette from "../apps/SimplefogPalette.js";
import { CWSPNoDoors } from "../ClockwiseSweep.js";
import { hexObjsToArr, hexToPercent, percentToHex } from "../helpers.js";
import BrushPreview from "./BrushPreview.js";
import MaskLayer from "./MaskLayer.js";

export default class SimplefogLayer extends MaskLayer {
	constructor() {
		super();

		// Register event listerenrs
		Hooks.on("ready", () => {
			this._registerMouseListeners();
		});

		this.DEFAULTS = {
			handlesize: 20
		};

		// React to changes to current scene
		Hooks.on("updateScene", this._updateScene.bind(this));
		Hooks.on("canvasReady", () => {
			this._onCanvasLevelChange(canvas.level?.id ?? null);
		});
		Hooks.on("canvasPan", (_canvas, position) => {
			const levelId = position?.level ?? canvas.level?.id ?? null;
			this._onCanvasLevelChange(levelId);
		});
	}


	static #paletteClass = SimplefogPalette;

	// @TODO remove all Palette below if https://github.com/foundryvtt/foundryvtt/issues/14521 is completed
	static get TOGGLE_PALETTE() {
		return {
			name: "togglePalette",
			title: "CONTROLS.Palette",
			icon: "fa-solid fa-palette",
			active: !!ui.controls?.paletteOpen || !!canvas.simplefog?.paletteOpen,
			toggle: true,
			onChange: (event, toggled) => canvas.simplefog.togglePlaceablePalette(toggled)
		};
	}

	get paletteOpen() {
		return this.#paletteOpen;
	}

  	#paletteOpen = false;

	async togglePlaceablePalette(toggle) {
		await ui.placeablesPalette?.close({ animate: false });
		const paletteClass = SimplefogPalette;
		if ( !paletteClass || !("togglePalette" in ui.controls.tools) ) return;
		this.#setPaletteOpen(toggle !== undefined ? !!toggle : this.#paletteOpen);
		if ( !this.#paletteOpen ) return;
		const palette = new paletteClass({ initialData: ui.controls.tool.createData ?? {}, position: { top: 180, left: 100 } });
		await palette.render({ force: true });
	}

	#setPaletteOpen(paletteOpen) {
		if ( this.#paletteOpen === paletteOpen ) return;
		this.#paletteOpen = paletteOpen;
		for ( const control of Object.values(ui.controls.controls) ) {
			if ( control.tools.togglePalette ) control.tools.togglePalette.active = paletteOpen;
		}
		ui.controls.render();
	}

	brushOpacity = percentToHex(0);

	/**
	 * Sets if an operation is currently happening.
	 * Has some special cases for features that draw when pointerup event is triggered.
	 * @type {Boolean|"box"|"ellipse"|"grid"|"room"}
	 * */
	op = false;

	roomExpand = false;

	static get layerOptions() {
		return foundry.utils.mergeObject(super.layerOptions, {
			name: "simplefog",
		});
	}

	get activeTool() {
		return this.#activeTool;
	}

	set activeTool(tool) {
		this.#activeTool = tool;
	}

	#activeTool;

	#gridSize;

	#gridType;

	#lastPosition;

	#brushPrev;

	#suppressHistoryUpdates = false;

	#previewTint = 0xff0000;

	#rightclick;

	/* -------------------------------------------- */

	_activate() {
		super._activate();
		this.brushSize ??= canvas.grid.size / 2;
		this.boxPreview = new BrushPreview({
			shape: this.BRUSH_TYPES.BOX,
			alpha: 0.4,
			visible: false
		});
		this.ellipsePreview = new BrushPreview({
			shape: this.BRUSH_TYPES.ELLIPSE,
			alpha: 0.4,
			visible: false
		});
		this.polygonPreview = new BrushPreview({
			shape: this.BRUSH_TYPES.POLYGON,
			alpha: 0.4,
			visible: false
		});
		this.polygonHandle = new BrushPreview({
			shape: this.BRUSH_TYPES.BOX,
			fill: 0xff6400,
			width: this.DEFAULTS.handlesize * 2,
			height: this.DEFAULTS.handlesize * 2,
			alpha: 0.4,
			visible: false,
			zIndex: 15,
		});
		// Pointer used for Polygon, Box and Ellipse tools
		this.genericPointer = new BrushPreview({
			shape: this.BRUSH_TYPES.ELLIPSE,
			width: this.DEFAULTS.handlesize / 2,
			height: this.DEFAULTS.handlesize / 2,
			alpha: 0.4,
			visible: false,
			zIndex: 15
		});

		this.addChild(this.boxPreview);
		this.addChild(this.ellipsePreview);
		this.addChild(this.polygonPreview);
		this.addChild(this.polygonHandle);
		this.addChild(this.genericPointer);
		canvas.interface.grid.addHighlightLayer("simplefog");
		// For cases when the layer is redrawn
		if (this.activeTool) this.setPreviewTint();
		this.togglePlaceablePalette();
	}

	/** @inheritDoc */
	_deactivate() {
		super._deactivate();
		this.clearActiveTool();
		this.togglePlaceablePalette(false);
	}

	_changeTool(tool) {
		this.clearActiveTool();
		this.activeTool = tool;
		this.setPreviewTint();
		if (this.activeTool === "brush") {
			this.ellipsePreview.visible = true;
			this._pointerMoveBrush(canvas.mousePosition);
		} else if (this.activeTool === "grid") {
			this._initGrid();
			this._pointerMoveGrid(canvas.mousePosition);
		} else if (this.activeTool === "room") {
			this._pointerMoveRoom(canvas.mousePosition);
			canvas.walls.objects.visible = true;
			canvas.walls.placeables.forEach((l) => l.renderFlags.set({ refreshState: true }));
		}
		ui.placeablesPalette?.render({ force: true });
		ui.controls.render({ reset: true });
	}

	/* -------------------------------------------- */
	/*  Event Listeners and Handlers                */
	/* -------------------------------------------- */

	/**
   * React to updates of canvas.scene flags
   */
	_updateScene(scene, changed, data, userId) {
		// Check if update applies to current viewed scene
		if (!scene._view) return;
		const historyKey = this.getHistoryKey();
		if (foundry.utils.hasProperty(changed, `flags.simplefog.${historyKey}`)) {
			if (this.#suppressHistoryUpdates) return;
			const history = canvas.scene.getFlag("simplefog", historyKey);
			if (history === undefined) return;
			const stop = canvas.scene.getFlag("simplefog", `${historyKey}.pointer`);
			canvas.simplefog.renderStack({ history, stop });
			this.updatePerception();
		} else if (
			scene.id === canvas.scene.id
			&& game.user.id !== userId
			&& foundry.utils.hasProperty(changed, "flags.simplefog")
		) {
			this.updatePerception();
			canvas.draw(scene);
		} else if (
			game.user.isGM
			&& this.activeTool === "grid"
			&& (changed.grid.size || changed.grid.type)
		) {
			this._initGrid();
		}
	}

	async _onCanvasLevelChange(newLevelId) {
		if (newLevelId === this._activeLevelId) return;
		if (this.historyBuffer.length > 0) {
			await this.commitHistory();
		}
		this._activeLevelId = newLevelId;
		if (!this.maskTexture) return;
		this.pointer = 0;
		this.resetMask(false);
		this.renderStack({ start: 0, isInit: true });
	}

	/**
   * Adds the mouse listeners to the layer
   */
	_registerMouseListeners() {
		this.addListener("pointerup", this._pointerUp);
		this.addListener("pointermove", this._pointerMove);
	}

	getPositions(p) {
		if (!canvas.forceSnapVertices) return { x: p.x, y: p.y };
		const { type } = canvas.scene.grid;
		if (type === 1) {
			const { x, y } = canvas.grid.getTopLeftPoint({ x: p.x, y: p.y });
			return { x, y };
		} else if ([2, 3, 4, 5].includes(type)) {
			const coords = canvas.grid.getCenterPoint({ x: p.x, y: p.y });
			const cube = canvas.grid.getCube(coords);
			const offset = canvas.grid.getOffset(cube);
			const { x, y } = canvas.grid.getTopLeftPoint(offset);
			return { x, y };
		}
	}

	highlightConfig(x, y) {
		return { x, y, color: this.#previewTint, alpha: 0.4 };
	}

	setPreviewTint() {
		const bo = hexToPercent(this.brushOpacity) / 100;
		this.#previewTint = 0xff0000;
		if (bo < 1) this.#previewTint = 0x00ff00;
		this.ellipsePreview.tint = this.#previewTint;
		this.boxPreview.tint = this.#previewTint;
		this.polygonPreview.tint = this.#previewTint;
		this.genericPointer.tint = this.#previewTint;
		if (this.activeTool === "grid" && this.#lastPosition) {
			const { x, y } = this.#lastPosition;
			canvas.interface.grid.clearHighlightLayer("simplefog");
			canvas.interface.grid.highlightPosition("simplefog", this.highlightConfig(x, y));
		}
	}

	/**
   * Sets the active tool & shows preview for brush & grid tools
   * @param {Number}  Size in pixels
   */
	async setBrushSize(s) {
		this.brushSize = s;
		this.ellipsePreview.width = s * 2;
		this.ellipsePreview.height = s * 2;
	}

	/**
   * Aborts any active drawing tools
   */
	clearActiveTool() {
		canvas.interface.grid.clearHighlightLayer("simplefog");
		// Box preview
		this.boxPreview.visible = false;
		// Ellipse Preview
		this.ellipsePreview.visible = false;
		this.polygonPreview.clear();
		this.polygonPreview.visible = false;
		this.polygonHandle.visible = false;
		this.genericPointer.visible = false;
		this.polygon = [];
		// Cancel op flag only if not in a brush operation
		if (this.activeTool !== "brush") {
			this.op = false;
		}
		if (this.#suppressHistoryUpdates) {
			this.#suppressHistoryUpdates = false;
		}
		if (this.activeTool === "room") {
			canvas.walls.objects.visible = false;
			canvas.walls.placeables.forEach((l) => l.renderFlags.set({ refreshState: true }));
		}
	}

	_onClickLeft(e) {
		// Don't allow new action if history push still in progress
		if (this.historyBuffer.length > 0) return;
		const p = canvas.mousePosition;
		if (!canvas.dimensions.sceneRect.contains(p.x, p.y)) return;
		// Round positions to nearest pixel
		p.x = Math.round(p.x);
		p.y = Math.round(p.y);
		this.op = true;
		// Check active tool
		switch (this.activeTool) {
			case "brush":
				this._pointerDownBrush(p);
				break;
			case "grid":
				this._pointerDownGrid();
				break;
			case "box":
				this._pointerDownBox(p);
				break;
			case "ellipse":
				this._pointerDownEllipse(p);
				break;
			case "polygon":
				this._pointerDownPolygon(p);
				break;
			case "room":
				this._pointerDownRoom(p, e);
				break;
			default: // Do nothing
				break;
		}
		// Call _pointermove so single click will still draw brush if mouse does not move
		this._pointerMove(e);
	}

	_onClickLeft2(e) {
		// Don't allow new action if history push still in progress
		if (this.historyBuffer.length > 0) return;
		const p = canvas.mousePosition;
		if (!canvas.dimensions.sceneRect.contains(p.x, p.y)) return;
		// Round positions to nearest pixel
		p.x = Math.round(p.x);
		p.y = Math.round(p.y);
		this.op = true;
		// Check active tool
		switch (this.activeTool) {
			case "polygon":
				this._pointerDown2Polygon(p);
				break;
			default: // Do nothing
				break;
		}
		// Call _pointermove so single click will still draw brush if mouse does not move
		this._pointerMove(e);
	}

	_onClickRight(e) {
		if (this.historyBuffer.length > 0) return;
		// Todo: Not sure why this doesnt trigger when drawing ellipse & box
		if (["box", "ellipse"].includes(this.activeTool)) {
			this.clearActiveTool();
		} else if (this.activeTool === "polygon") this.#rightclick = true;
	}

	_pointerMove(e) {
		// Get mouse position translated to canvas coords
		const p = canvas.mousePosition;
		// Round positions to nearest pixel
		p.x = Math.round(p.x);
		p.y = Math.round(p.y);
		switch (this.activeTool) {
			case "brush":
				this._pointerMoveBrush(p);
				break;
			case "box":
				this._pointerMoveBox(p, e);
				break;
			case "grid":
				this._pointerMoveGrid(p);
				break;
			case "ellipse":
				this._pointerMoveEllipse(p, e);
				break;
			case "polygon":
				this._pointerMovePolygon(p);
				this.#rightclick = false;
				break;
			case "room":
				this._pointerMoveRoom(p, e);
				break;
			default:
				break;
		}
	}

	async _pointerUp(e) {
		if (e.data.button === 0) {
			// Translate click to canvas position
			const p = canvas.mousePosition;
			// Round positions to nearest pixel
			p.x = Math.round(p.x);
			p.y = Math.round(p.y);
			switch (this.op) {
				case "box":
					this._pointerUpBox(p, e);
					break;
				case "ellipse":
					this._pointerUpEllipse(p, e);
					break;
				case "room":
					this._pointerUpRoom(p, e);
					break;
				default: // Do nothing
					break;
			}
			// Reset operation
			this.op = false;
			this.#brushPrev = null;
			// Always stop partial sync
			this._stopPartialSync();
			// Wait for any in-progress partial sync to finish
			while (this.lock) {
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
			// Only commit if there is anything left in the buffer
			if (this.historyBuffer.length > 0) {
				await this.commitHistory();
			}
			if (this.#suppressHistoryUpdates) {
				this.#suppressHistoryUpdates = false;
				this.updatePerception();
			}
		} else if (e.data.button === 2) {
			if (this.activeTool === "polygon" && this.#rightclick) {
				this.clearActiveTool();
			}
		}
	}

	/**
   * Brush Tool
   */
	_pointerDownBrush(p) {
		// Always allow starting a new brush operation
		this.op = true;
		this.#brushPrev = { x: p.x, y: p.y };
		this.#suppressHistoryUpdates = true;
	}

	_pointerMoveBrush(p) {
		if (!canvas.dimensions.sceneRect.contains(p.x, p.y)) {
			this.ellipsePreview.visible = false;
			return;
		}
		this.ellipsePreview.visible = true;
		const size = this.brushSize;
		this.ellipsePreview.width = size * 2;
		this.ellipsePreview.height = size * 2;
		this.ellipsePreview.x = p.x;
		this.ellipsePreview.y = p.y;
		// If drag operation has started
		if (this.op) {
			this._renderBrushLine(this.#brushPrev, p);
			this.#brushPrev = { x: p.x, y: p.y };
		}
	}

	_renderBrushLine(prev, current) {
		const dx = current.x - prev.x;
		const dy = current.y - prev.y;
		const distance = Math.hypot(dx, dy);
		const step = Math.max(this.brushSize * 0.5, 4);
		const count = Math.max(1, Math.ceil(distance / step));
		for (let i = 0; i <= count; i += 1) {
			const t = i / count;
			this.renderBrush({
				shape: this.BRUSH_TYPES.ELLIPSE,
				x: prev.x + (dx * t),
				y: prev.y + (dy * t),
				fill: this.brushOpacity,
				width: this.brushSize,
				height: this.brushSize,
			});
		}
	}

	/*
   * Box Tool
   */
	_pointerDownBox(p) {
		const { x, y } = this.getPositions(p);
		// Set active drag operation
		this.op = "box";
		// Set drag start coords
		this.dragStart.x = x;
		this.dragStart.y = y;
		// Reveal the preview shape
		this.boxPreview.visible = true;
		this.boxPreview.x = x;
		this.boxPreview.y = y;
	}

	_pointerMoveBox(p, e) {
		if (!this.op) {
			const { x, y } = this.getPositions(p);
			this.genericPointer.visible = true;
			this.genericPointer.x = x;
			this.genericPointer.y = y;
			return;
		}
		this.genericPointer.visible = false;
		const d = this._getDragBounds(p, e);
		this.boxPreview.visible = true;
		this.boxPreview.width = d.w;
		this.boxPreview.height = d.h;
	}

	_pointerUpBox(p, e) {
		const d = this._getDragBounds(p, e);
		this.renderBrush({
			shape: this.BRUSH_TYPES.BOX,
			x: this.dragStart.x,
			y: this.dragStart.y,
			width: d.w,
			height: d.h,
			fill: this.brushOpacity,
		});
		this.boxPreview.visible = false;
	}

	// --- Throttled partial sync logic ---
	_startPartialSync() {
		if (this._partialSyncActive) return;
		this._partialSyncActive = true;
		const tick = async () => {
			if (!this._partialSyncActive) return;
			await this.commitHistoryPartial();
			this._partialSyncTimer = setTimeout(tick, this._partialSyncInterval);
		};
		tick();
	}

	_stopPartialSync() {
		this._partialSyncActive = false;
		if (this._partialSyncTimer) {
			clearTimeout(this._partialSyncTimer);
			this._partialSyncTimer = null;
		}
	}

	async commitHistoryPartial() {
		if (this.historyBuffer.length === 0 || this.lock) return;
		this.lock = true;
		const historyKey = this.getHistoryKey();
		let history = canvas.scene.getFlag("simplefog", historyKey);
		if (!history) {
			history = {
				events: [],
				pointer: 0,
			};
		}
		// Truncate if pointer is behind (undo case)
		history.events = history.events.slice(0, history.pointer);
		// Push a shallow copy of the buffer (so final commit can still push the full buffer)
		history.events.push([...this.historyBuffer]);
		history.pointer = history.events.length;
		// Do NOT unset the flag, just set it (partial update)
		await canvas.scene.setFlag("simplefog", historyKey, history);
		this.lock = false;
	}

	/*
   * Ellipse Tool
   */
	_pointerDownEllipse(p) {
		const { x, y } = this.getPositions(p);
		// Set active drag operation
		this.op = "ellipse";
		// Set drag start coords
		this.dragStart.x = x;
		this.dragStart.y = y;
		// Reveal the preview shape
		this.ellipsePreview.x = x;
		this.ellipsePreview.y = y;
		this.ellipsePreview.visible = true;
	}

	_pointerMoveEllipse(p, e) {
		if (!this.op) {
			const { x, y } = this.getPositions(p);
			this.genericPointer.visible = true;
			this.genericPointer.x = x;
			this.genericPointer.y = y;
			return;
		}
		this.genericPointer.visible = false;
		const d = this._getDragBounds(p, e);
		this.ellipsePreview.width = d.w * 2;
		this.ellipsePreview.height = d.h * 2;
	}

	_pointerUpEllipse(p, e) {
		const d = this._getDragBounds(p, e);
		this.renderBrush({
			shape: this.BRUSH_TYPES.ELLIPSE,
			x: this.dragStart.x,
			y: this.dragStart.y,
			width: Math.abs(d.w),
			height: Math.abs(d.h),
			fill: this.brushOpacity,
		});
		this.ellipsePreview.visible = false;
	}

	/*
   * Polygon Tool
   */
	_pointerDownPolygon(p) {
		if (!this.polygon) this.polygon = [];
		const { x, y } = this.getPositions(p);
		// If this is not the first vertex...
		if (this.polygon.length) {
			// Check if new point is close enough to start to close the polygon
			const xo = Math.abs(this.polygon[0].x - x);
			const yo = Math.abs(this.polygon[0].y - y);
			if (xo < this.DEFAULTS.handlesize && yo < this.DEFAULTS.handlesize) {
				this._pointerClosePolygon();
				return;
			}
		}
		// If this is first vertex...
		else {
			// Draw shape handle
			this.polygonHandle.x = x - this.DEFAULTS.handlesize;
			this.polygonHandle.y = y - this.DEFAULTS.handlesize;
			this.polygonHandle.visible = true;
		}
		this._pointerUpdatePolygon(x, y);
	}

	_pointerDown2Polygon() {
		if (!this.polygon || this.polygon.length < 3) return;
		this._pointerClosePolygon();
	}

	_pointerClosePolygon() {
		const verts = hexObjsToArr(this.polygon);
		// render the new shape to history
		this.renderBrush({
			shape: this.BRUSH_TYPES.POLYGON,
			vertices: verts,
			fill: this.brushOpacity,
		});
		// Reset the preview shape
		this.polygonPreview.clear();
		this.polygonPreview.visible = false;
		this.polygonHandle.visible = false;
		this.polygon = [];
		return true;
	}

	_pointerUpdatePolygon(x, y) {
		// Add new vertex to polygon
		this.polygon.push({ x, y });
		this._updatePolygonPreview();
	}

	_updatePolygonPreview() {
		// Redraw polygon with all edges and vertices visible
		this.polygonPreview.clear();
		if (this.polygon.length === 0) {
			this.polygonPreview.visible = false;
			return;
		}
		// Draw filled polygon (semi-transparent)
		this.polygonPreview.beginFill(0xffffff, 0.3);
		this.polygonPreview.drawPolygon(hexObjsToArr(this.polygon));
		this.polygonPreview.endFill();
		// Draw edges with zoom-independent width
		const zoomInverse = 1 / canvas.stage.scale.x;
		this.polygonPreview.lineStyle(2 * zoomInverse, 0xffffff, 0.8);
		for (let i = 0; i < this.polygon.length; i++) {
			const curr = this.polygon[i];
			const next = this.polygon[(i + 1) % this.polygon.length];
			this.polygonPreview.moveTo(curr.x, curr.y);
			this.polygonPreview.lineTo(next.x, next.y);
		}
		// Draw vertex handles
		const handleSize = this.DEFAULTS.handlesize / 2;
		for (const vert of this.polygon) {
			this.polygonPreview.lineStyle(0);
			this.polygonPreview.beginFill(0xff6400, 0.8);
			this.polygonPreview.drawRect(vert.x - handleSize, vert.y - handleSize, handleSize * 2, handleSize * 2);
			this.polygonPreview.endFill();
		}
		this.polygonPreview.visible = true;
	}

	_pointerMovePolygon(p) {
		// Show preview with ghost line from last vertex to cursor
		const { x, y } = this.getPositions(p);
		this.genericPointer.visible = true;
		this.genericPointer.x = x;
		this.genericPointer.y = y;

		if (!this.polygon || this.polygon.length === 0) return;
		if (!canvas.dimensions.sceneRect.contains(p.x, p.y)) {
			this.polygonPreview.visible = false;
			this.genericPointer.visible = false;
			return;
		}
		this.polygonPreview.visible = true;
		// Update polygon preview first (edges + vertices)
		this._updatePolygonPreview();
		// Draw ghost line from last vertex to cursor
		const lastVert = this.polygon[this.polygon.length - 1];
		const zoomInverse = 1 / canvas.stage.scale.x;
		this.polygonPreview.lineStyle(2 * zoomInverse, 0xffff00, 0.6);
		this.polygonPreview.moveTo(lastVert.x, lastVert.y);
		this.polygonPreview.lineTo(x, y);
	}

	_pointerUpRoom(p, e) {
		if (this.roomExpand) return;
		this.genericPointer.visible = true;
		this.genericPointer.x = p.x;
		this.genericPointer.y = p.y;
		this._drawRoom(p, e);
		this.polygonPreview.clear();
		this.polygonPreview.visible = false;
	}

	_pointerDownRoom(p, e) {
		if (!this.roomExpand) {
			this.op = "room";
			this.polygonOrigin = { x: p.x, y: p.y };
			this.genericPointer.visible = false;
			return;
		}
		this._drawRoom(p, e);
	}

	_drawRoom(p, e) {
		const vertices = this._getRoomVertices(p, e);
		if (!vertices) return false;

		this.renderBrush({
			shape: this.BRUSH_TYPES.POLYGON,
			vertices,
			fill: this.brushOpacity,
		});
	}

	_pointerMoveRoom(p, e) {
		if (!this.op && !this.roomExpand) {
			this.genericPointer.x = p.x;
			this.genericPointer.y = p.y;
			return;
		}
		if (!canvas.dimensions.sceneRect.contains(p.x, p.y)) {
			this.polygonPreview.visible = false;
			return;
		}
		this.polygonPreview.visible = true;
		this.polygonPreview.clear();
		this.polygonPreview.beginFill(0xffffff);
		this.polygonPreview.drawPolygon(this._getRoomVertices(p, e));
		this.polygonPreview.endFill();
	}

	_getRoomVertices(p, e) {
		const { x, y } = !this.roomExpand ? this.polygonOrigin : canvas.mousePosition;
		const origin = { x, y };
		const radius = !this.roomExpand ? Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) : null;
		const sceneRect = canvas.dimensions.sceneRect;
		if (p.x < sceneRect.left || p.x > sceneRect.right || p.y < sceneRect.top || p.y > sceneRect.bottom) return [];
		const sweep = CWSPNoDoors.create(origin, { type: "sight", edgeTypes: { innerBounds: { mode: 2 } }, radius, shiftKey: e?.shiftKey });
		return Array.from(sweep.points);
	}

	/**
   * Grid Tool
   */
	_pointerDownGrid() {
		// Set active drag operation
		this.op = "grid";
		this._initGrid();
	}

	_pointerMoveGrid(p) {
		canvas.interface.grid.clearHighlightLayer("simplefog");
		if (!canvas.dimensions.sceneRect.contains(p.x, p.y)) return;
		const { size, type } = canvas.scene.grid;
		// Square grid
		if (type === 1) {
			const { x, y } = canvas.grid.getTopLeftPoint({ x: p.x, y: p.y });
			canvas.interface.grid.highlightPosition("simplefog", this.highlightConfig(x, y));
			this.#lastPosition = { x, y };
			if (this.op) {
				const coord = `${x},${y}`;
				if (!this.dupes.includes(coord)) {
					// Flag cell as drawn in dupes
					this.dupes.push(coord);
					this.renderBrush({
						shape: this.BRUSH_TYPES.BOX,
						x,
						y,
						width: size,
						height: size,
						fill: this.brushOpacity,
					});
				}
			}
		}
		// Hex Grid
		else if ([2, 3, 4, 5].includes(type)) {
			const coords = canvas.grid.getCenterPoint({ x: p.x, y: p.y });
			const cube = canvas.grid.getCube(coords);
			const offset = canvas.grid.getOffset(cube);
			const { x, y } = canvas.grid.getTopLeftPoint(offset);
			canvas.interface.grid.highlightPosition("simplefog", this.highlightConfig(x, y));
			this.#lastPosition = { x, y };
			// If drag operation has started
			if (this.op) {
				// Convert pixel coord to hex coord
				const qr = this.gridLayout.pixelToHex(p).round();
				const coord = `${qr.q},${qr.r}`;
				// Check if this grid cell was already drawn
				if (!this.dupes.includes(coord)) {
					// Get current grid coord verts
					const vertices = this.gridLayout.polygonCorners({ q: qr.q, r: qr.r });
					// Convert to array of individual verts
					const vertexArray = hexObjsToArr(vertices);
					// Get the vert coords for the hex
					this.renderBrush({
						shape: this.BRUSH_TYPES.POLYGON,
						vertices: vertexArray,
						fill: this.brushOpacity,
					});
					// Flag cell as drawn in dupes
					this.dupes.push(coord);
				}
			}
		}
	}

	/*
   * Returns height and width given a pointer coord and event for modifer keys
   */
	_getDragBounds(p, e) {
		let h = p.y - this.dragStart.y;
		let w = p.x - this.dragStart.x;
		if (e.data.originalEvent.shiftKey) {
			const ws = Math.sign(w);
			const hs = Math.sign(h);
			if (Math.abs(h) > Math.abs(w)) w = Math.abs(h) * ws;
			else h = Math.abs(w) * hs;
		}
		return { w, h };
	}

	/*
   * Checks grid type, creates a dupe detection matrix & if hex grid init a layout
   */
	_initGrid() {
		const { size, type } = canvas.scene.grid;
		this.dupes = [];
		if (this.#gridSize === size && this.#gridType === type) return;
		const legacyHex = !!canvas.scene.flags.core?.legacyHex;
		const divisor = legacyHex ? 2 : Math.sqrt(3);
		switch (type) {
			// Square grid
			// Pointy Hex Odd
			case 2:
				this.gridLayout = new Layout(
					Layout.pointy,
					{ x: size / divisor, y: size / divisor },
					{ x: 0, y: size / divisor }
				);
				break;
				// Pointy Hex Even
			case 3: {
				const x = legacyHex ? (Math.sqrt(3) * size) / 4 : size / 2;
				this.gridLayout = new Layout(
					Layout.pointy,
					{ x: size / divisor, y: size / divisor },
					{ x, y: size / divisor }
				);
				break;
			}
			// Flat Hex Odd
			case 4:
				this.gridLayout = new Layout(
					Layout.flat,
					{ x: size / divisor, y: size / divisor },
					{ x: size / divisor, y: 0 }
				);
				break;
				// Flat Hex Even
			case 5: {
				const y = legacyHex ? (Math.sqrt(3) * size) / 4 : size / 2;
				this.gridLayout = new Layout(
					Layout.flat,
					{ x: size / divisor, y: size / divisor },
					{ x: size / divisor, y }
				);
				break;
			}
			default:
				break;
		}
		this.#gridType = type;
		this.#gridSize = size;
	}
}
