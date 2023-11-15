import BrushControls from "./classes/BrushControls.js";
import SimplefogConfig from "./classes/SimplefogConfig.js";
import SimplefogHUDControlLayer from "./classes/SimplefogHUDControlLayer.js";
import SimplefogLayer from "./classes/SimplefogLayer.js";
import SimplefogMigrations from "./classes/SimplefogMigrations.js";
import SimplefogNotification from "./classes/SimplefogNotification.js";
import {
	addSimplefogControlToggleListener,
	addSimplefogOpacityToggleListener,
} from "./helpers.js";
import { registerSettings } from "./settings.js";

Hooks.once("init", async () => {
	registerSettings();
	CONFIG.Canvas.layers.simplefog = { group: "interface", layerClass: SimplefogLayer };
	CONFIG.Canvas.layers.simplefogHUDControls = { group: "interface", layerClass: SimplefogHUDControlLayer };

	Object.defineProperty(canvas, "simplefog", {
		value: new SimplefogLayer(),
		configurable: true,
		writable: true,
		enumerable: false,
	});
	Object.defineProperty(canvas, "simplefogHUDControls", {
		value: new SimplefogHUDControlLayer(),
		configurable: true,
		writable: true,
		enumerable: false,
	});
});

Hooks.once("ready", async () => {
	// Check if any migrations need to be performed
	SimplefogMigrations.check();

	// Fix simplefog zIndex

	canvas.simplefog.refreshZIndex();
	// ToDo: why is this set below???
	// canvas.simplefogHUDControls.zIndex = canvas.simplefog.getSetting('layerZindex') - 1;

	// Move object hud to tokens layer
	game.canvas.controls.hud.setParent(game.canvas.simplefogHUDControls);

	// Check if new version; if so send DM to GM
	SimplefogNotification.checkVersion();

	// Hooks.on('sightRefresh', sightLayerUpdate);

	// ToDo: Determine replacement for canvas.sight.refresh()
	canvas.perception.refresh();

	addSimplefogControlToggleListener();
	addSimplefogOpacityToggleListener();
});

Hooks.once("canvasInit", () => {
	canvas.simplefog.canvasInit();
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
		activeTool: "brush",
	});
});

/**
 * Handles adding the custom brush controls pallet
 * and switching active brush flag
 */
Hooks.on("renderSceneControls", (controls) => {
	// Switching to layer
	if (canvas.simplefog != null) {
		if (controls.activeControl == "simplefog" && controls.activeTool != undefined) {
			// Open brush tools if not already open
			if (!$("#simplefog-brush-controls").length) new BrushControls().render(true);
			// Set active tool
			canvas.simplefog.setActiveTool(controls.activeTool);
		}
		// Switching away from layer
		else {
			// Clear active tool
			canvas.simplefog.clearActiveTool();
			// Remove brush tools if open
			const bc = $("#simplefog-brush-controls")[0];
			if (bc) bc.remove();
		}
	}
});

/**
 * Sets Y position of the brush controls to account for scene navigation buttons
 */
function setBrushControlPos() {
	const brushControl = $("#simplefog-brush-controls");
	const navigation = $("#navigation");
	if (brushControl.length && navigation.length) {
		const h = navigation.height();
		brushControl.css({ top: `${h + 30}px` });
		canvas.simplefog.setActiveTool(canvas.simplefog.activeTool);
	}
}

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

	// ToDo: Determine replacement for canvas.sight.refresh()
	canvas.perception.refresh();
}

function cancelToggleSimpleFog(result = undefined) {
	ui.controls.controls.find(({ name }) => name === "simplefog").tools[0].active = true;
	ui.controls.render();
}

// Reset position when brush controls are rendered or sceneNavigation changes
Hooks.on("renderBrushControls", setBrushControlPos);
Hooks.on("renderSceneNavigation", setBrushControlPos);
