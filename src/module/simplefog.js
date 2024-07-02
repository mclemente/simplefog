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
				const value = slider.value = slider.value === "100" ? 0 : 100;
				handler.call(bc, null, null, value);
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
	controls.push({
		name: "simplefog",
		title: game.i18n.localize("SIMPLEFOG.sf"),
		icon: "fas fa-cloud",
		layer: "simplefog",
		tools: [
			{
				name: "simplefogtoggle",
				title: game.i18n.localize("SIMPLEFOG.onoff"),
				icon: "fas fa-eye",
				onClick: () => toggleSimpleFog(),
				active: canvas.simplefog?.visible,
				toggle: true,
			},
			{
				name: "brush",
				title: game.i18n.localize("SIMPLEFOG.brushTool"),
				icon: "fas fa-paint-brush",
			},
			{
				name: "grid",
				title: game.i18n.localize("SIMPLEFOG.gridTool"),
				icon: "fas fa-border-none",
			},
			{
				name: "polygon",
				title: game.i18n.localize("SIMPLEFOG.polygonTool"),
				icon: "fas fa-draw-polygon",
			},
			{
				name: "box",
				title: game.i18n.localize("SIMPLEFOG.boxTool"),
				icon: "far fa-square",
			},
			{
				name: "ellipse",
				title: game.i18n.localize("SIMPLEFOG.ellipseTool"),
				icon: "far fa-circle",
			},
			// {
			//   name: "image",
			//   title: "Image Tool",
			//   icon: "far fa-image",
			// },
			{
				name: "sceneConfig",
				title: game.i18n.localize("SIMPLEFOG.sceneConfig"),
				icon: "fas fa-cog",
				onClick: () => {
					new SimplefogConfig().render(true);
				},
				button: true,
			},
			{
				name: "clearfog",
				title: game.i18n.localize("SIMPLEFOG.reset"),
				icon: "fas fa-trash",
				onClick: () => {
					const dg = new Dialog({
						title: game.i18n.localize("SIMPLEFOG.reset"),
						content: game.i18n.localize("SIMPLEFOG.confirmReset"),
						buttons: {
							reset: {
								icon: '<i class="fas fa-trash"></i>',
								label: "Reset",
								callback: () => canvas.simplefog.resetMask(),
							},
							blank: {
								icon: '<i class="fas fa-eye"></i>',
								label: "Blank",
								callback: () => canvas.simplefog.blankMask(),
							},
							cancel: {
								icon: '<i class="fas fa-times"></i>',
								label: "Cancel",
							},
						},
						default: "reset",
					});
					dg.render(true);
				},
				button: true,
			},
		],
		activeTool: game.settings.get("simplefog", "toolHotKeys"),
	});
});

/**
 * Toggle Simple Fog
 */
function toggleSimpleFog() {
	if (game.settings.get("simplefog", "confirmFogDisable") && canvas.simplefog.getSetting("visible")) {
		let dg = Dialog.confirm({
			title: game.i18n.localize("SIMPLEFOG.disableFog"),
			content: game.i18n.localize("SIMPLEFOG.confirmDisableFog"),
			yes: () => toggleOffSimpleFog(),
			no: () => cancelToggleSimpleFog(),
			defaultYes: false,
			rejectClose: true,
		});
		dg.then(undefined, cancelToggleSimpleFog);
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

function cancelToggleSimpleFog(result = undefined) {
	ui.controls.controls.find(({ name }) => name === "simplefog").tools[0].active = true;
	ui.controls.render();
}
