import SimplefogConfig from "./apps/SimplefogConfig.js";
import SimplefogLayer from "./layers/SimplefogLayer.js";
import { controlToken, registerSettings } from "./settings.js";

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
				ui.placeablesPalette?.render(true);
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
				ui.placeablesPalette?.render(true);
				return true;
			}
		},
		reservedModifiers: [SHIFT],
		repeat: true,
		restricted: true,
	});
	game.keybindings.register("simplefog", "forceShape", {
		name: "Draw Square/Circle Shape (Hold)",
		hint: "Forces the width and height of the Rectangle and Ellipse tools to be the same.",
		uneditable: [
			{
				key: "Shift"
			}
		],
		repeat: true,
		restricted: true,
		precedence: CONST.KEYBINDING_PRECEDENCE.DEFERRED
	});
	game.keybindings.register("simplefog", "passThroughDoors", {
		name: "Pass Through Open Doors (Hold)",
		hint: "Room Tool's drawing passes through open doors.",
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
	if (game.settings.get("simplefog", "previewPlayerVision") && game.user.isGM) {
		Hooks.on("controlToken", controlToken);
	}
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

export function toggleFogEraser(active) {
	if (active) canvas.simplefog.brushOpacity = "0x000000";
	else canvas.simplefog.brushOpacity = "0xffffff";
	canvas.simplefog.setPreviewTint();
	ui.controls.render({ reset: true });
}
