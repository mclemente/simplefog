export const registerSettings = function () {
	// Register global config settings
	game.settings.register("simplefog", "confirmFogDisable", {
		name: "Confirm Disabling of Scene Simple Fog",
		hint: "When enabled, a confirmation dialog will be displayed before Simple Fog can be toggled off for a scene",
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
	});
	game.settings.register("simplefog", "autoEnableSceneFog", {
		name: "Auto Enable Scene Fog",
		hint: "When enabled, Simple Fog will automatically be enabled for a scene when it is first created.",
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
	});
	game.settings.register("simplefog", "toolHotKeys", {
		name: "Hotkey Tool",
		hint: "Define which tool will be selected when using the keybinding.",
		scope: "world",
		config: true,
		default: "brush",
		type: String,
		choices: {
			brush: "Brush",
			grid: "Grid",
			room: "Room",
			polygon: "Polygon",
			box: "Box",
			ellipse: "Ellipse",
		},
	});
	game.settings.register("simplefog", "zIndex", {
		name: "Simplefog Z-Index",
		hint: "The z-index determines the order in which various layers are rendered within the Foundry canvas. A higher number will be rendered on top of lower numbered layers (and the objects on that layer). This allows for the adjustment of the z-index to allow for Simple Fog to be rendered above/below other layers; particularly ones added by other modules. Going below 200 will intermingle with Foundry layers such as the foreground image (200), tokens (100), etc... (Default: 220)",
		scope: "world",
		config: true,
		default: 220,
		type: Number,
		onChange: (value) => canvas.simplefog.zIndex = value
	});
};
