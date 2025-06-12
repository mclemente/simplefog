import SimplefogConfig from "./apps/SimplefogConfig.js";
import SimplefogLayer from "./layers/SimplefogLayer.js";
import { registerSettings } from "./settings.js";

Hooks.once("init", async () => {
	registerSettings();
	CONFIG.Canvas.layers.simplefog = { group: "interface", layerClass: SimplefogLayer };

	const isActiveControl = () => ui.controls.activeControl === "simplefog";
	game.keybindings.register("simplefog", "swap", {
		name: "Swap to Simple Fog's Controls",
		hint: "Toggles between the Token and Simple Fog layers. Check the module's settings to define which tool will be selected by default.",
		editable: [
			{
				key: "S",
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
				key: "Z",
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
				key: "T"
			}
		],
		onDown: () => {
			if (isActiveControl()) {
				const bc = canvas.simplefog.brushControls;
				const handler = bc.options.actions.brushOpacity;
				const slider = bc.element.querySelector("input[name=brushOpacity]");
				slider.value = slider.value === "100" ? 0 : 100;
				handler.call(bc);
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
		onDown: () => {
			if (isActiveControl() && canvas.simplefog.activeTool === "brush") {
				const bc = canvas.simplefog.brushControls;
				const handler = bc.options.actions.brushSize;
				const slider = bc.element.querySelector("input[name=brushSize]");
				slider.value = Math.max(Number(slider.value) * 0.8, 10).toNearest(10, "floor");
				handler.call(bc);
				canvas.simplefog.setBrushSize(slider.value);
				return true;
			}
		},
		onUp: () => {},
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
		onDown: () => {
			if (isActiveControl() && canvas.simplefog.activeTool === "brush") {
				const bc = canvas.simplefog.brushControls;
				const handler = bc.options.actions.brushSize;
				const slider = bc.element.querySelector("input[name=brushSize]");
				slider.value = Math.min(Number(slider.value) * 1.25, 500).toNearest(10, "ceil");
				handler.call(bc);
				canvas.simplefog.setBrushSize(slider.value);
				return true;
			}
		},
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
	canvas.simplefog.zIndex = game.settings.get("simplefog", "zIndex");

	canvas.perception.update({
		refreshLighting: true,
		refreshVision: true,
		refreshOcclusion: true
	});
});

Hooks.once("canvasInit", () => {
	if (!game.user.isGM) return;
	Object.keys(canvas.simplefog.DEFAULTS).forEach((key) => {
		// Check for existing scene specific setting
		if (canvas.simplefog.getSetting(key) !== undefined) return;
		// Check for custom default
		const def = canvas.simplefog.getUserSetting(key);
		// If user has custom default, set it for scene
		if (def !== undefined) canvas.simplefog.setSetting(key, def);
		// Otherwise fall back to module default
		else canvas.simplefog.setSetting(key, canvas.simplefog.DEFAULTS[key]);
	});
});

Hooks.on("canvasInit", () => {
	const overlayFile = canvas.simplefog.getSetting("fogImageOverlayFilePath");
	if (overlayFile) {
		canvas.loadTexturesOptions.additionalSources.push(overlayFile);
	}
});

// from controls.js

/**
 * Add control buttons
 */
Hooks.on("getSceneControlButtons", (controls) => {
	if (!game.user.isGM) return;
	let activeTool = game.settings.get("simplefog", "toolHotKeys");
	controls.simplefog = {
		name: "simplefog",
		title: "Simple Fog",
		icon: "fas fa-eye",
		onChange: (event, active) => {
			if ( active ) canvas.simplefog.activate();
		},
		onToolChange: (event, tool) => canvas.simplefog._changeTool(tool.name),
		activeTool: canvas.grid?.type === 0 && activeTool === "grid" ? "brush" : activeTool,
		tools: {
			simplefogtoggle: {
				name: "simplefogtoggle",
				icon: "fas fa-eye",
				visible: true,
				order: 0,
				onChange: () => toggleSimpleFog(),
				title: game.i18n.localize("SIMPLEFOG.onoff"),
				active: canvas.simplefog?.visible,
				toggle: true,
			},
			brush: {
				name: "brush",
				title: game.i18n.localize("SIMPLEFOG.brushTool"),
				icon: "fas fa-paint-brush",
				visible: true,
				order: 1
			},
			grid: {
				name: "grid",
				title: game.i18n.localize("SIMPLEFOG.gridTool"),
				icon: "fas fa-border-none",
				visible: true, // TODO hide button when no grid is available once V13 fixes https://github.com/foundryvtt/foundryvtt/issues/12906
				order: 1
			},
			room: {
				name: "room",
				title: game.i18n.localize("SIMPLEFOG.roomTool"),
				icon: "fas fa-block-brick",
				visible: true,
				order: 2
			},
			polygon: {
				name: "polygon",
				title: game.i18n.localize("SIMPLEFOG.polygonTool"),
				icon: "fas fa-draw-polygon",
				visible: true,
				order: 2
			},
			box: {
				name: "box",
				title: game.i18n.localize("SIMPLEFOG.boxTool"),
				icon: "far fa-square",
				visible: true,
				order: 2
			},
			ellipse: {
				name: "ellipse",
				title: game.i18n.localize("SIMPLEFOG.ellipseTool"),
				icon: "far fa-circle",
				visible: true,
				order: 2
			},
			sceneConfig: {
				name: "sceneConfig",
				title: game.i18n.localize("SIMPLEFOG.sceneConfig"),
				icon: "fas fa-cog",
				visible: true,
				order: 2,
				onChange: () => new SimplefogConfig().render(true),
				button: true
			},
			reset: {
				name: "reset",
				title: game.i18n.localize("SIMPLEFOG.reset"),
				icon: "fas fa-trash",
				visible: true,
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
        ui.controls.render({ reset: true });
    } else {
        toggleOffSimpleFog();
    }
}

function toggleOffSimpleFog() {
	canvas.simplefog.toggle();
	canvas.perception.update({
		refreshLighting: true,
		refreshVision: true,
		refreshOcclusion: true
	});
}
