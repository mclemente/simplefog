import SimplefogLayer from "./classes/SimplefogLayer.js";
export const registerSettings = function () {
	game.settings.register("simplefog", "migrationVersion", {
		name: "Simplefog Migration Version",
		scope: "world",
		config: false,
		type: Number,
		default: 0,
	});
	// Register global config settings
	game.settings.register("simplefog", "confirmFogDisable", {
		name: "Confirm Disabling of Scene Simplefog",
		hint: "When enabled, a confirmation dialog will be displayed before Simplefog can be toggled off for a scene",
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
	});
	game.settings.register("simplefog", "autoEnableSceneFog", {
		name: "Auto Enable Scene Fog",
		hint: "When enabled, Simplefog will automatically be enabled for a scene when it is first created.",
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
	});
	game.settings.register("simplefog", "enableHotKeys", {
		name: "Enable Simplefog Hotkeys",
		hint: "When enabled, you will be able to quickly swap to the Simplefog control by using Ctrl+S and toggle the opacity using the hotkey 'T'",
		scope: "world",
		config: true,
		default: false,
		type: Boolean,
	});
	game.settings.register("simplefog", "toolHotKeys", {
		name: "Hotkey Tool",
		hint: "When Hotkeys is enabled, define which tool will be selected by using Ctrl+S",
		scope: "world",
		config: true,
		default: "brush",
		type: String,
		choices: {
			brush: "Brush",
			grid: "Grid",
			polygon: "Polygon",
			box: "Box",
			ellipse: "Ellipse",
		},
	});
	game.settings.register("simplefog", "zIndex", {
		name: "Simplefog Z-Index",
		hint: "The z-index determines the order in which various layers are rendered within the Foundry canvas.  A higher number will be rendered on top of lower numbered layers (and the objects on that layer).  This allows for the adjustment of the z-index to allow for Simple Fog to be rendered above/below other layers; particularly ones added by other modules. Going below 200 will intermingle with Foundry layers such as the foreground image (200), tokens (100), etc...  (Default: 220)",
		scope: "world",
		config: true,
		default: 220,
		type: Number,
		onChange: SimplefogLayer.refreshZIndex,
	});
};