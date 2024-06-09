/* SimplefogLayer extends MaskLayer
 *
 * Implements tools for manipulating the MaskLayer
 */

import { Layout } from "../../libs/hexagons.js";
import { hexObjsToArr, hexToPercent } from "../helpers.js";
import MaskLayer from "./MaskLayer.js";

export default class SimplefogLayer extends MaskLayer {
	constructor() {
		super("simplefog");

		// Register event listerenrs
		Hooks.on("ready", () => {
			this._registerMouseListeners();
		});

		this.DEFAULTS = Object.assign(this.DEFAULTS, {
			transition: true,
			transitionSpeed: 800,
			previewColor: "0x00FFFF",
			handlefill: "0xff6400",
			handlesize: 20,
			previewAlpha: 0.4,
			brushSize: 50,
			brushOpacity: 1,
			autoVisibility: false,
			autoVisGM: false,
			vThreshold: 1,
			hotKeyTool: "Brush",
		});

		/*    // React to canvas zoom
    Hooks.on('canvasPan', (canvas, dimensions) => {
    // Scale blur filter radius to account for zooming
      //this.blur.blur = this.getSetting('blurRadius') * dimensions.scale;
    });*/

		// React to changes to current scene
		Hooks.on("updateScene", (scene, data) => this._updateScene(scene, data));

		// Canvas expects the options.name property to be set
		this.options = this.constructor.layerOptions;
	}

	initSimplefog() {
		// Preview brush objects
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
		// React to visibility change
		if (foundry.utils.hasProperty(data, `flags.${this.layername}.visible`)) {
			canvas[this.layername].visible = data.flags[this.layername].visible;
		}
		// React to composite history change
		if (foundry.utils.hasProperty(data, `flags.${this.layername}.blurEnable`)) {
			if (this.fogColorLayer !== undefined) {
				if (this.getSetting("blurEnable")) {
					this.fogColorLayer.filters = [this.blur];
				} else {
					this.fogColorLayer.filters = [];
				}
			}
		}
		if (foundry.utils.hasProperty(data, `flags.${this.layername}.blurRadius`)) {
			canvas[this.layername].blur.blur = this.getSetting("blurRadius");
		}
		// React to composite history change
		if (foundry.utils.hasProperty(data, `flags.${this.layername}.blurQuality`)) {
			canvas[this.layername].blur.quality = this.getSetting("blurQuality");
		}
		// React to composite history change
		if (foundry.utils.hasProperty(data, `flags.${this.layername}.history`)) {
			canvas[this.layername].renderStack(data.flags[this.layername].history);

			canvas.perception.update({
				refreshLighting: true,
				refreshVision: true,
				refreshOcclusion: true
			});
		}
		// React to autoVisibility setting changes
		if (
			foundry.utils.hasProperty(data, `flags.${this.layername}.autoVisibility`)
			|| foundry.utils.hasProperty(data, `flags.${this.layername}.vThreshold`)
		) {
			canvas.perception.update({
				refreshLighting: true,
				refreshVision: true,
				refreshOcclusion: true
			});
		}
		// React to alpha/tint changes
		if (!game.user.isGM && foundry.utils.hasProperty(data, `flags.${this.layername}.playerColorAlpha`)) {
			canvas[this.layername].setColorAlpha(data.flags[this.layername].playerColorAlpha);
		}
		if (game.user.isGM && foundry.utils.hasProperty(data, `flags.${this.layername}.gmColorAlpha`)) {
			canvas[this.layername].setColorAlpha(data.flags[this.layername].gmColorAlpha);
		}
		if (!game.user.isGM && foundry.utils.hasProperty(data, `flags.${this.layername}.playerColorTint`)) {
			canvas[this.layername].setColorTint(data.flags[this.layername].playerColorTint);
		}
		if (game.user.isGM && foundry.utils.hasProperty(data, `flags.${this.layername}.gmColorTint`)) {
			canvas[this.layername].setColorTint(data.flags[this.layername].gmColorTint);
		}

		// React to Image Overylay file changes
		if (foundry.utils.hasProperty(data, `flags.${this.layername}.fogImageOverlayFilePath`)) {
			canvas[this.layername].setFogImageOverlayTexture(data.flags[this.layername].fogImageOverlayFilePath);
		}

		if (game.user.isGM && foundry.utils.hasProperty(data, `flags.${this.layername}.fogImageOverlayGMAlpha`)) {
			canvas[this.layername].setFogImageOverlayAlpha(data.flags[this.layername].fogImageOverlayGMAlpha);
		}
		if (!game.user.isGM && foundry.utils.hasProperty(data, `flags.${this.layername}.fogImageOverlayPlayerAlpha`)) {
			canvas[this.layername].setFogImageOverlayAlpha(data.flags[this.layername].fogImageOverlayPlayerAlpha);
		}
		if (foundry.utils.hasProperty(data, `flags.${this.layername}.fogImageOverlayZIndex`)) canvas[this.layername].setFogImageOverlayZIndex(data.flags[this.layername].fogImageOverlayZIndex);
	}

	/**
	 * Adds the mouse listeners to the layer
	 */
	_registerMouseListeners() {
		this.addListener("pointerdown", this._pointerDown);
		this.addListener("pointerup", this._pointerUp);
		this.addListener("pointermove", this._pointerMove);
		this.dragging = false;
		this.brushing = false;
	}

	/**
	 * Sets the active tool & shows preview for brush & grid tools
	 */
	setActiveTool(tool) {
		this.clearActiveTool();
		this.activeTool = tool;
		this.setPreviewTint();
		const currentTool = $("#simplefog-brush-controls #brush-size-container");
		if (currentTool.length) {
			if (tool === "brush") {
				this.ellipsePreview.visible = true;
				$("#simplefog-brush-controls #brush-size-container").show();
			} else {
				$("#simplefog-brush-controls #brush-size-container").hide();
			}
		}
		if (tool === "grid") {
			if (canvas.scene.grid.type === 1) {
				this.boxPreview.width = canvas.scene.grid.size;
				this.boxPreview.height = canvas.scene.grid.size;
				this.boxPreview.visible = true;
			} else if ([2, 3, 4, 5].includes(canvas.scene.grid.type)) {
				this._initGrid();
				this.polygonPreview.visible = true;
			}
		}
	}

	setPreviewTint() {
		const vt = this.getSetting("vThreshold");
		const bo = hexToPercent(this.getUserSetting("brushOpacity")) / 100;
		let tint = 0xff0000;
		if (bo < vt) tint = 0x00ff00;
		this.ellipsePreview.tint = tint;
		this.boxPreview.tint = tint;
		this.polygonPreview.tint = tint;
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
		try {
			// Box preview
			this.boxPreview.visible = false;
		} catch(err) {}
		try {
			// Ellipse Preview
			this.ellipsePreview.visible = false;
		} catch(err) {}
		try {
			// Shape preview
			this.polygonPreview.clear();
			this.polygonPreview.visible = false;
			this.polygonHandle.visible = false;
			this.polygon = [];
		} catch(err) {}
		try {
			// Cancel op flag
			this.op = false;
		} catch(err) {}
		try {
			// Clear history buffer
			this.historyBuffer = [];
		} catch(err) {}
	}

	/**
	 * Mouse handlers for canvas layer interactions
	 */
	_pointerDown(e) {
		// Don't allow new action if history push still in progress
		if (this.historyBuffer.length > 0) return;
		// On left mouse button
		if (e.data.button === 0) {
			const p = e.data.getLocalPosition(canvas.app.stage);
			// Round positions to nearest pixel
			p.x = Math.round(p.x);
			p.y = Math.round(p.y);
			this.op = true;
			// Check active tool
			switch (this.activeTool) {
				case "brush":
					this._pointerDownBrush(p, e);
					break;
				case "grid":
					this._pointerDownGrid(p, e);
					break;
				case "box":
					this._pointerDownBox(p, e);
					break;
				case "ellipse":
					this._pointerDownEllipse(p, e);
					break;
				case "polygon":
					this._pointerDownPolygon(p, e);
					break;
				default: // Do nothing
					break;
			}
			// Call _pointermove so single click will still draw brush if mouse does not move
			this._pointerMove(e);
		}
		// On right button, cancel action
		else if (e.data.button === 2) {
			// Todo: Not sure why this doesnt trigger when drawing ellipse & box
			if (["polygon", "box", "ellipse"].includes(this.activeTool)) {
				this.clearActiveTool();
			}
		}
	}

	_pointerMove(e) {
		// Get mouse position translated to canvas coords
		const p = e.data.getLocalPosition(canvas.app.stage);
		// Round positions to nearest pixel
		p.x = Math.round(p.x);
		p.y = Math.round(p.y);
		switch (this.activeTool) {
			case "brush":
				this._pointerMoveBrush(p, e);
				break;
			case "box":
				this._pointerMoveBox(p, e);
				break;
			case "grid":
				this._pointerMoveGrid(p, e);
				break;
			case "ellipse":
				this._pointerMoveEllipse(p, e);
				break;
			default:
				break;
		}
	}

	_pointerUp(e) {
		// Only react to left mouse button
		if (e.data.button === 0) {
			// Translate click to canvas position
			const p = e.data.getLocalPosition(canvas.app.stage);
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
		}
	}

	/**
	 * Brush Tool
	 */
	_pointerDownBrush() {
		this.op = true;
	}

	_pointerMoveBrush(p) {
		const size = this.getUserSetting("brushSize");
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
				fill: this.getUserSetting("brushOpacity"),
				width: this.getUserSetting("brushSize"),
				height: this.getUserSetting("brushSize"),
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
			fill: this.getUserSetting("brushOpacity"),
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
			fill: this.getUserSetting("brushOpacity"),
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
				const verts = hexObjsToArr(this.polygon);
				// render the new shape to history
				this.renderBrush({
					shape: this.BRUSH_TYPES.POLYGON,
					x: 0,
					y: 0,
					vertices: verts,
					fill: this.getUserSetting("brushOpacity"),
				});
				// Reset the preview shape
				this.polygonPreview.clear();
				this.polygonPreview.visible = false;
				this.polygonHandle.visible = false;
				this.polygon = [];
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
		// If intermediate vertex, add it to array and redraw the preview
		this.polygon.push({ x, y });
		this.polygonPreview.clear();
		this.polygonPreview.beginFill(0xffffff);
		this.polygonPreview.drawPolygon(hexObjsToArr(this.polygon));
		this.polygonPreview.endFill();
		this.polygonPreview.visible = true;
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
		const gridSize = canvas.scene.grid.size;
		const gridType = canvas.scene.grid.type;
		// Square grid
		if (gridType === 1) {
			const gridx = Math.floor(p.x / gridSize);
			const gridy = Math.floor(p.y / gridSize);
			const x = gridx * gridSize;
			const y = gridy * gridSize;
			const coord = `${x},${y}`;
			this.boxPreview.x = x;
			this.boxPreview.y = y;
			this.boxPreview.width = gridSize;
			this.boxPreview.height = gridSize;
			if (this.op) {
				if (!this.dupes.includes(coord)) {
					// Flag cell as drawn in dupes
					this.dupes.push(coord);
					this.renderBrush({
						shape: this.BRUSH_TYPES.BOX,
						x,
						y,
						width: gridSize,
						height: gridSize,
						fill: this.getUserSetting("brushOpacity"),
					});
				}
			}
		}
		// Hex Grid
		else if ([2, 3, 4, 5].includes(gridType)) {
			// Convert pixel coord to hex coord
			const qr = this.gridLayout.pixelToHex(p).round();
			// Get current grid coord verts
			const vertices = this.gridLayout.polygonCorners({ q: qr.q, r: qr.r });
			// Convert to array of individual verts
			const vertexArray = hexObjsToArr(vertices);
			// Update the preview shape
			this.polygonPreview.clear();
			this.polygonPreview.beginFill(0xffffff);
			this.polygonPreview.drawPolygon(vertexArray);
			this.polygonPreview.endFill();
			// If drag operation has started
			if (this.op) {
				const coord = `${qr.q},${qr.r}`;
				// Check if this grid cell was already drawn
				if (!this.dupes.includes(coord)) {
					// Get the vert coords for the hex
					this.renderBrush({
						shape: this.BRUSH_TYPES.POLYGON,
						vertices: vertexArray,
						x: 0,
						y: 0,
						fill: this.getUserSetting("brushOpacity"),
					});
					// Flag cell as drawn in dupes
					this.dupes.push(`${qr.q},${qr.r}`);
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
		const gridSize = canvas.scene.grid.size;
		this.dupes = [];
		if (canvas.scene.flags.core?.legacyHex) {
			switch (canvas.scene.grid.type) {
				// Square grid
				// Pointy Hex Odd
				case 2:
					this.gridLayout = new Layout(
						Layout.pointy,
						{ x: gridSize / 2, y: gridSize / 2 },
						{ x: 0, y: gridSize / 2 }
					);
					break;
				// Pointy Hex Even
				case 3:
					this.gridLayout = new Layout(
						Layout.pointy,
						{ x: gridSize / 2, y: gridSize / 2 },
						{ x: (Math.sqrt(3) * gridSize) / 4, y: gridSize / 2 }
					);
					break;
				// Flat Hex Odd
				case 4:
					this.gridLayout = new Layout(
						Layout.flat,
						{ x: gridSize / 2, y: gridSize / 2 },
						{ x: gridSize / 2, y: 0 }
					);
					break;
				// Flat Hex Even
				case 5:
					this.gridLayout = new Layout(
						Layout.flat,
						{ x: gridSize / 2, y: gridSize / 2 },
						{ x: gridSize / 2, y: (Math.sqrt(3) * gridSize) / 4 }
					);
					break;
				default:
					break;
			}
		} else {
			switch (canvas.scene.grid.type) {
				// Square grid
				// Pointy Hex Odd
				case 2:
					this.gridLayout = new Layout(
						Layout.pointy,
						{ x: gridSize / Math.sqrt(3), y: gridSize / Math.sqrt(3) },
						{ x: 0, y: gridSize / Math.sqrt(3) }
					);
					break;
				// Pointy Hex Even
				case 3:
					this.gridLayout = new Layout(
						Layout.pointy,
						{ x: gridSize / Math.sqrt(3), y: gridSize / Math.sqrt(3) },
						{ x: gridSize / 2, y: gridSize / Math.sqrt(3) }
					);
					break;
				// Flat Hex Odd
				case 4:
					this.gridLayout = new Layout(
						Layout.flat,
						{ x: gridSize / Math.sqrt(3), y: gridSize / Math.sqrt(3) },
						{ x: gridSize / Math.sqrt(3), y: 0 }
					);
					break;
				// Flat Hex Even
				case 5:
					this.gridLayout = new Layout(
						Layout.flat,
						{ x: gridSize / Math.sqrt(3), y: gridSize / Math.sqrt(3) },
						{ x: gridSize / Math.sqrt(3), y: gridSize / 2 }
					);
					break;
				default:
					break;
			}
		}
	}

	async draw() {
		super.draw();
		this.initSimplefog();

		this.addChild(this.boxPreview);
		this.addChild(this.ellipsePreview);
		this.addChild(this.polygonPreview);
		this.addChild(this.polygonHandle);
	}
}
