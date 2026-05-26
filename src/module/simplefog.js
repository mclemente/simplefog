import SimplefogConfig from "./apps/SimplefogConfig.js";
import SimplefogLayer from "./layers/SimplefogLayer.js";
import { registerSettings } from "./settings.js";

Hooks.once("init", async () => {
	registerSettings();
	CONFIG.Canvas.layers.simplefog = { group: "interface", layerClass: SimplefogLayer };

	const isActiveControl = () => ui.controls.control.name === "simplefog";
	const { SHIFT } = KeyboardManager.MODIFIER_KEYS;
	game.keybindings.register("simplefog", "swap", {
		name: "Swap to Simple Fog's Controls",
		hint: "Toggles between the Token and Simple Fog layers.",
		editable: [
			{
				key: "KeyS",
				modifiers: ["Control"]
			}
		],
		onDown: () => {
			const layer = isActiveControl() ? "tokens" : "simplefog";
			canvas[layer].activate();
			return true;
		},
		restricted: true,
		precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
	});
	game.keybindings.register("simplefog", "undo", {
		name: "Undo Change",
		hint: "",
		editable: [
			{
				key: "KeyZ",
				modifiers: ["Control"]
			}
		],
		onDown: () => {
			if (isActiveControl()) {
				canvas.simplefog.undo();
				return true;
			}
		},
		restricted: true,
		precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
	});
	game.keybindings.register("simplefog", "opacity", {
		name: "Toggle Opacity",
		hint: "Toggles the Brush Opacity's bar between Reveal/Hide. Only works while editing Simple Fog's layer.",
		uneditable: [],
		editable: [
			{
				key: "KeyT"
			}
		],
		onDown: () => {
			if (isActiveControl()) {
				toggleFogEraser(canvas.simplefog.brushOpacity === "0xffffff");
				return true;
			}
		},
		restricted: true,
	});
	game.keybindings.register("simplefog", "brushReduce", {
		name: "Reduce Brush Size",
		hint: "Only works while the Brush is selected.",
		editable: [
			{
				key: "BracketLeft"
			}
		],
		onDown: (context) => {
			if (isActiveControl() && canvas.simplefog.activeTool === "brush") {
				const size = context.isShift ? 10 : Number(canvas.simplefog.brushSize) * 0.8;
				const brushSize = Math.max(size, 10).toNearest(10, "floor");
				canvas.simplefog.setBrushSize(brushSize);
				return true;
			}
		},
		reservedModifiers: [SHIFT],
		repeat: true,
		restricted: true,
	});
	game.keybindings.register("simplefog", "brushIncrease", {
		name: "Increase Brush Size",
		hint: "Only works while the Brush is selected.",
		editable: [
			{
				key: "BracketRight"
			}
		],
		onDown: (context) => {
			if (isActiveControl() && canvas.simplefog.activeTool === "brush") {
				const size = context.isShift ? 500 : Number(canvas.simplefog.brushSize) * 1.25;
				const brushSize = Math.min(size, 500).toNearest(10, "ceil");
				canvas.simplefog.setBrushSize(brushSize);
				return true;
			}
		},
		reservedModifiers: [SHIFT],
		repeat: true,
		restricted: true,
	});
	game.keybindings.register("simplefog", "forceShape", {
		name: "Force Drag Shape (Hold)",
		hint: "Forces the width and height of Rectangle and Ellipse tools to be the same.",
		uneditable: [
			{
				key: "Shift"
			}
		],
		repeat: true,
		restricted: true,
		precedence: CONST.KEYBINDING_PRECEDENCE.DEFERRED
	});
});

Hooks.once("ready", async () => {
	if (!canvas.ready) return;
	canvas.simplefog.zIndex = game.settings.get("simplefog", "zIndex");
	canvas.simplefog.updatePerception();
});

Hooks.on("createScene", (doc, options, userId) => {
	if (game.settings.get("simplefog", "autoEnableSceneFog")) {
		doc.setFlag("simplefog", "visible", true);
	}
});

Hooks.on("canvasInit", () => {
	const overlayFile = canvas.simplefog.getSetting("fogImageOverlayFilePath");
	if (overlayFile) {
		canvas.loadTexturesOptions.additionalSources.push(overlayFile);
	}
});

Hooks.on("controlToken", (token, active) => {
	if (game.user.isGM && canvas.simplefog?.visible) {
		if (active && token.actor.hasPlayerOwner) {
			canvas.simplefog.fogColorLayer.alpha = 1;
			canvas.simplefog.fogColorLayer.tint = canvas.simplefog.getSetting("playerColorTint");
			canvas.simplefog.fogImageOverlayLayer.alpha = canvas.simplefog.getSetting("fogImageOverlayPlayerAlpha") / 100;
		} else {
			canvas.simplefog.fogColorLayer.alpha = canvas.simplefog.getSetting("gmColorAlpha") / 100;
			canvas.simplefog.fogColorLayer.tint = canvas.simplefog.getSetting("gmColorTint");
			canvas.simplefog.fogImageOverlayLayer.alpha = canvas.simplefog.getSetting("fogImageOverlayGMAlpha") / 100;
		}
	}
});

// from controls.js

/**
 * Add control buttons
 */
Hooks.on("getSceneControlButtons", (controls) => {
	if (!game.user.isGM) return;
	controls.simplefog = {
		name: "simplefog",
		title: "Simple Fog",
		icon: "fas fa-cloud",
		onChange: (event, active) => {
			if ( active ) canvas.simplefog.activate();
		},
		onToolChange: (event, tool, active) => {
			if ( active ) canvas.simplefog._changeTool(tool.name);
		},
		activeTool: "brush",
		tools: {
			simplefogtoggle: {
				name: "simplefogtoggle",
				icon: "fas fa-eye",
				visible: true,
				order: 0,
				onChange: () => toggleSimpleFog(),
				title: "SIMPLEFOG.onoff",
				active: canvas.simplefog?.visible,
				toggle: true,
			},
			brush: {
				name: "brush",
				title: "SIMPLEFOG.brushTool",
				icon: "fas fa-paint-brush",
				visible: canvas.simplefog?.visible,
				order: 1
			},
			grid: {
				name: "grid",
				title: "SIMPLEFOG.gridTool",
				icon: "fas fa-grid",
				visible: canvas.grid?.type !== 0 && canvas.simplefog?.visible,
				order: 1
			},
			room: {
				name: "room",
				title: "SIMPLEFOG.roomTool",
				icon: "fas fa-block-brick",
				visible: canvas.simplefog?.visible,
				order: 2
			},
			polygon: {
				name: "polygon",
				title: "SIMPLEFOG.polygonTool",
				icon: "fas fa-draw-polygon",
				visible: canvas.simplefog?.visible,
				order: 2
			},
			box: {
				name: "box",
				title: "SIMPLEFOG.boxTool",
				icon: "fas icon-fa-rectangle",
				visible: canvas.simplefog?.visible,
				order: 2
			},
			ellipse: {
				name: "ellipse",
				title: "SIMPLEFOG.ellipseTool",
				icon: "fas icon-fa-ellipse",
				visible: canvas.simplefog?.visible,
				order: 2
			},
			eraser: {
				name: "eraser",
				title: "SIMPLEFOG.eraser",
				icon: "fas fa-eraser",
				visible: canvas.simplefog?.visible,
				order: 2,
				onChange: (event, active) => toggleFogEraser(active),
				active: canvas.simplefog?.brushOpacity === "0x000000",
				toggle: true,
			},
			expand: {
				name: "expand",
				title: "SIMPLEFOG.expand",
				icon: "fas fa-up-right-and-down-left-from-center",
				visible: canvas.simplefog?.activeTool === "room",
				order: 2,
				onChange: (event, active) => canvas.simplefog.roomExpand = active,
				active: canvas.simplefog?.roomExpand ?? false,
				toggle: true
			},
			snap: {
				name: "snap",
				title: "CONTROLS.CommonForceSnap",
				icon: "fa-solid fa-plus",
				visible: !canvas.grid?.isGridless && ["box", "ellipse", "polygon"].includes(canvas.simplefog?.activeTool),
				order: 2,
				onChange: (event, toggled) => canvas.forceSnapVertices = toggled,
				active: canvas.forceSnapVertices,
				toggle: true
			},
			sceneConfig: {
				name: "sceneConfig",
				title: "SIMPLEFOG.sceneConfig",
				icon: "fas fa-cog",
				visible: canvas.simplefog?.visible,
				order: 2,
				onChange: () => new SimplefogConfig(canvas.scene).render(true),
				button: true
			},
			reset: {
				name: "reset",
				title: "SIMPLEFOG.reset",
				icon: "fas fa-trash",
				visible: canvas.simplefog?.visible,
				order: 2,
				onChange: () => {
					foundry.applications.api.DialogV2.wait({
						window: { title: game.i18n.localize("SIMPLEFOG.reset") },
						content: game.i18n.localize("SIMPLEFOG.confirmReset"),
						buttons: [
							{
								label: "Reset",
								action: "reset",
								callback: () => canvas.simplefog.resetMask(),
								icon: "fas fa-trash",
							},
							{
								label: "Blank",
								action: "blank",
								callback: () => canvas.simplefog.blankMask(),
								icon: "fas fa-eye",
							},
							{
								label: "Cancel",
								icon: "fas fa-times",
							}
						]
					});
				},
				button: true
			}
		},
	};
});

/**
 * Toggle Simple Fog
 */
async function toggleSimpleFog() {
	if (game.settings.get("simplefog", "confirmFogDisable") && canvas.simplefog.getSetting("visible")) {
		await foundry.applications.api.DialogV2.confirm({
			window: {
				title: game.i18n.localize("SIMPLEFOG.disableFog")
			},
			content: game.i18n.localize("SIMPLEFOG.confirmDisableFog"),
			yes: {
				callback: () => toggleOffSimpleFog()
			}
		});
	} else {
		await toggleOffSimpleFog();
	}
}

async function toggleOffSimpleFog() {
	await canvas.simplefog.toggle();
	if (!canvas.simplefog.activeTool) canvas.simplefog._changeTool("brush");
	canvas.simplefog.updatePerception();
	ui.controls.render({ reset: true });
}

function toggleFogEraser(active) {
	if (active) canvas.simplefog.brushOpacity = "0x000000";
	else canvas.simplefog.brushOpacity = "0xffffff";
	canvas.simplefog.setPreviewTint();
	ui.controls.render({ reset: true });
}
