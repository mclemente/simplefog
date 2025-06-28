/* SimplefogLayer extends MaskLayer
 *
 * Implements tools for manipulating the MaskLayer
 */

import { Layout } from "../../libs/hexagons.js";
import { BrushControls } from "../apps/BrushControls.js";
import { CWSPNoDoors } from "../ClockwiseSweep.js";
import { hexObjsToArr, hexToPercent, percentToHex } from "../helpers.js";
import MaskLayer from "./MaskLayer.js";

export default class SimplefogLayer extends MaskLayer {
	constructor() {
		super();

		// Register event listerenrs
		Hooks.on("ready", () => {
			this._registerMouseListeners();
		});

		this.DEFAULTS = {
			handlefill: "0xff6400",
			handlesize: 20,
			previewAlpha: 0.4
		};

		// React to changes to current scene
		Hooks.on("updateScene", (scene, data) => this._updateScene(scene, data));
	}

	brushSize = game.settings.get("simplefog", "brushSize");

	brushOpacity = percentToHex(game.settings.get("simplefog", "brushOpacity"));

	static get layerOptions() {
		return foundry.utils.mergeObject(super.layerOptions, {
			name: "simplefog",
			baseClass: SimplefogLayer,
		});
	}

	get activeTool() {
		return this.#activeTool;
	}

	set activeTool(tool) {
		this.#activeTool = tool;
	}

	get brushControls() {
		return this.#brushControls ??= new BrushControls();
	}

	#activeTool;

	#brushControls;

	#gridType;

	#lastPosition;

	#previewTint = 0xff0000;

	#rightclick;

	_activate() {
		super._activate();
		this._changeTool();
	}

		/* -------------------------------------------- */

		/** @inheritDoc */
	_deactivate() {
		super._deactivate();
		this.brushControls.close({animate: false});
		this.clearActiveTool();
	}

	_changeTool(tool = "") {
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
			canvas.walls.placeables.forEach((l) => l.renderFlags.set({refreshState: true}));
		}
		this.brushControls.render({ force: true });
	}

	/* -------------------------------------------- */
	/*  Event Listeners and Handlers                */
	/* -------------------------------------------- */

	/**
	 * React to updates of canvas.scene flags
	 */
	_updateScene(scene, data) {
		// Check if update applies to current viewed scene
		if (!scene._view) return;
		// React to composite history change
		if (foundry.utils.hasProperty(data, "flags.simplefog.blurEnable")) {
			if (this.fogColorLayer !== undefined) {
				if (this.getSetting("blurEnable")) {
					this.fogColorLayer.filters = [this.blur];
				} else {
					this.fogColorLayer.filters = [];
				}
			}
		}
		if (foundry.utils.hasProperty(data, "flags.simplefog.blurRadius")) {
			canvas.simplefog.blur.blur = this.getSetting("blurRadius");
		}
		// React to composite history change
		if (foundry.utils.hasProperty(data, "flags.simplefog.blurQuality")) {
			canvas.simplefog.blur.quality = this.getSetting("blurQuality");
		}
		// React to composite history change
		if (foundry.utils.hasProperty(data, "flags.simplefog.history")) {
			canvas.simplefog.renderStack({ history: data.flags.simplefog.history });

			canvas.perception.update({
				refreshLighting: true,
				refreshVision: true,
				refreshOcclusion: true
			});
		}
		// React to autoVisibility setting changes
		if (
			foundry.utils.hasProperty(data, "flags.simplefog.autoVisibility")
			|| foundry.utils.hasProperty(data, "flags.simplefog.vThreshold")
		) {
			canvas.perception.update({
				refreshLighting: true,
				refreshVision: true,
				refreshOcclusion: true
			});
		}
		// React to alpha/tint changes
		if (!game.user.isGM && foundry.utils.hasProperty(data, "flags.simplefog.playerColorAlpha")) {
			canvas.simplefog.setColorAlpha(data.flags.simplefog.playerColorAlpha);
		}
		if (game.user.isGM && foundry.utils.hasProperty(data, "flags.simplefog.gmColorAlpha")) {
			canvas.simplefog.setColorAlpha(data.flags.simplefog.gmColorAlpha);
		}
		if (!game.user.isGM && foundry.utils.hasProperty(data, "flags.simplefog.playerColorTint")) {
			canvas.simplefog.setColorTint(data.flags.simplefog.playerColorTint);
		}
		if (game.user.isGM && foundry.utils.hasProperty(data, "flags.simplefog.gmColorTint")) {
			canvas.simplefog.setColorTint(data.flags.simplefog.gmColorTint);
		}

		// React to Image Overylay file changes
		if (foundry.utils.hasProperty(data, "flags.simplefog.fogImageOverlayFilePath")) {
			canvas.simplefog.setFogImageOverlayTexture(data.flags.simplefog.fogImageOverlayFilePath);
		}

		if (game.user.isGM && foundry.utils.hasProperty(data, "flags.simplefog.fogImageOverlayGMAlpha")) {
			canvas.simplefog.setFogImageOverlayAlpha(data.flags.simplefog.fogImageOverlayGMAlpha);
		}
		if (!game.user.isGM && foundry.utils.hasProperty(data, "flags.simplefog.fogImageOverlayPlayerAlpha")) {
			canvas.simplefog.setFogImageOverlayAlpha(data.flags.simplefog.fogImageOverlayPlayerAlpha);
		}
		if (foundry.utils.hasProperty(data, "flags.simplefog.fogImageOverlayZIndex")) {
			canvas.simplefog.fogImageOverlayLayer.zIndex = data.flags.simplefog.fogImageOverlayZIndex;
		}
		canvas.draw(scene);
	}

	/**
	 * Adds the mouse listeners to the layer
	 */
	_registerMouseListeners() {
		this.addListener("pointerup", this._pointerUp);
		this.addListener("pointermove", this._pointerMove);
	}

	highlightConfig(x, y) {
		return { x, y, color: this.#previewTint, alpha: this.DEFAULTS.previewAlpha };
	}

	setPreviewTint() {
		const vt = this.getSetting("vThreshold") / 100;
		const bo = hexToPercent(this.brushOpacity) / 100;
		this.#previewTint = 0xff0000;
		if (bo < vt) this.#previewTint = 0x00ff00;
		this.ellipsePreview.tint = this.#previewTint;
		this.boxPreview.tint = this.#previewTint;
		this.polygonPreview.tint = this.#previewTint;
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
		await this.setUserSetting("brushSize", s);
		const p = { x: this.ellipsePreview.x, y: this.ellipsePreview.y };
		this._pointerMoveBrush(p);
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
		this.polygon = [];
		// Cancel op flag
		this.op = false;
		// Clear history buffer
		this.historyBuffer = [];
		if (this.activeTool === "room") {
			canvas.walls.objects.visible = false;
			canvas.walls.placeables.forEach((l) => l.renderFlags.set({refreshState: true}));
		}
	}

	_onClickLeft(e) {
		// Don't allow new action if history push still in progress
		if (this.historyBuffer.length > 0) return;
		const p = canvas.mousePosition;
		if (!canvas.dimensions.rect.contains(p.x, p.y)) return;
		// Round positions to nearest pixel
		p.x = Math.round(p.x);
		p.y = Math.round(p.y);
		this.op = true;
		// Check active tool
		switch (this.activeTool) {
			case "brush":
				this._pointerDownBrush();
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
		if (!canvas.dimensions.rect.contains(p.x, p.y)) return;
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
				this.#rightclick = false;
				break;
			case "room":
				this._pointerMoveRoom(p, e);
				break;
			default:
				break;
		}
	}

	_pointerUp(e) {
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
				default: // Do nothing
					break;
			}
			// Reset operation
			this.op = false;
			// Push the history buffer
			this.commitHistory();
		} else if (e.data.button === 2) {
			if (this.activeTool === "polygon" && this.#rightclick) {
				this.clearActiveTool();
			}
		}
	}

	/**
	 * Brush Tool
	 */
	_pointerDownBrush() {
		this.op = true;
	}

	_pointerMoveBrush(p) {
		if (!canvas.dimensions.rect.contains(p.x, p.y)) {
			this.ellipsePreview.visible = false;
			return;
		} else this.ellipsePreview.visible = true;
		const size = this.brushSize;
		this.ellipsePreview.width = size * 2;
		this.ellipsePreview.height = size * 2;
		this.ellipsePreview.x = p.x;
		this.ellipsePreview.y = p.y;
		// If drag operation has started
		if (this.op) {
			// Send brush movement events to renderbrush to be drawn and added to history stack
			this.renderBrush({
				shape: this.BRUSH_TYPES.ELLIPSE,
				x: p.x,
				y: p.y,
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
		// Set active drag operation
		this.op = "box";
		// Set drag start coords
		this.dragStart.x = p.x;
		this.dragStart.y = p.y;
		// Reveal the preview shape
		this.boxPreview.visible = true;
		this.boxPreview.x = p.x;
		this.boxPreview.y = p.y;
	}

	_pointerMoveBox(p, e) {
		// If drag operation has started
		if (this.op) {
			// update the preview shape
			const d = this._getDragBounds(p, e);
			this.boxPreview.width = d.w;
			this.boxPreview.height = d.h;
		}
	}

	_pointerUpBox(p, e) {
		// update the preview shape
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

	/*
	 * Ellipse Tool
	 */
	_pointerDownEllipse(p) {
		// Set active drag operation
		this.op = "ellipse";
		// Set drag start coords
		this.dragStart.x = p.x;
		this.dragStart.y = p.y;
		// Reveal the preview shape
		this.ellipsePreview.x = p.x;
		this.ellipsePreview.y = p.y;
		this.ellipsePreview.visible = true;
	}

	_pointerMoveEllipse(p, e) {
		// If drag operation has started
		const d = this._getDragBounds(p, e);
		if (this.op) {
			// Just update the preview shape
			this.ellipsePreview.width = d.w * 2;
			this.ellipsePreview.height = d.h * 2;
		}
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
		const x = Math.floor(p.x);
		const y = Math.floor(p.y);
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
			x: 0,
			y: 0,
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
		// If intermediate vertex, add it to array and redraw the preview
		this.polygon.push({ x, y });
		this.polygonPreview.clear();
		this.polygonPreview.beginFill(0xffffff);
		this.polygonPreview.drawPolygon(hexObjsToArr(this.polygon));
		this.polygonPreview.endFill();
		this.polygonPreview.visible = true;
	}

	_pointerDownRoom(p, e) {
		const vertices = this._getRoomVertices(p, e);
		if (!vertices) return false;

		this.renderBrush({
			shape: this.BRUSH_TYPES.POLYGON,
			x: 0,
			y: 0,
			vertices,
			fill: this.brushOpacity,
		});
		return true;
	}

	_pointerMoveRoom(p, e) {
		if (!canvas.dimensions.rect.contains(p.x, p.y)) {
			this.polygonPreview.visible = false;
			return;
		} else this.polygonPreview.visible = true;
		this.polygonPreview.clear();
		this.polygonPreview.beginFill(0xffffff);
		this.polygonPreview.drawPolygon(this._getRoomVertices(p, e));
		this.polygonPreview.endFill();
	}

	_getRoomVertices(p, e) {
		const sceneRect = canvas.dimensions.sceneRect;
		if (p.x < sceneRect.left || p.x > sceneRect.right || p.y < sceneRect.top || p.y > sceneRect.bottom) return [];
		const sweep = CWSPNoDoors.create(canvas.mousePosition, { type: "sight", useInnerBounds: true, shiftKey: e?.shiftKey });
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
		if (!canvas.dimensions.rect.contains(p.x, p.y)) return;
		const { size, type } = canvas.scene.grid;
		// Square grid
		if (type === 1) {
			const { x, y } = canvas.grid.getTopLeftPoint({x: p.x, y: p.y });
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
						x: 0,
						y: 0,
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
		if (this.#gridType === type) return;
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
	}

	async _draw() {
		super._draw();
		this.boxPreview = this.brush({
			shape: this.BRUSH_TYPES.BOX,
			x: 0,
			y: 0,
			fill: 0xffffff,
			alpha: this.DEFAULTS.previewAlpha,
			width: 100,
			height: 100,
			visible: false,
			zIndex: 10,
		});
		this.ellipsePreview = this.brush({
			shape: this.BRUSH_TYPES.ELLIPSE,
			x: 0,
			y: 0,
			fill: 0xffffff,
			alpha: this.DEFAULTS.previewAlpha,
			width: 100,
			height: 100,
			visible: false,
			zIndex: 10,
		});
		this.polygonPreview = this.brush({
			shape: this.BRUSH_TYPES.POLYGON,
			x: 0,
			y: 0,
			vertices: [],
			fill: 0xffffff,
			alpha: this.DEFAULTS.previewAlpha,
			visible: false,
			zIndex: 10,
		});
		this.polygonHandle = this.brush({
			shape: this.BRUSH_TYPES.BOX,
			x: 0,
			y: 0,
			fill: this.DEFAULTS.handlefill,
			width: this.DEFAULTS.handlesize * 2,
			height: this.DEFAULTS.handlesize * 2,
			alpha: this.DEFAULTS.previewAlpha,
			visible: false,
			zIndex: 15,
		});

		this.addChild(this.boxPreview);
		this.addChild(this.ellipsePreview);
		this.addChild(this.polygonPreview);
		this.addChild(this.polygonHandle);
		canvas.interface.grid.addHighlightLayer("simplefog");
	}
}
