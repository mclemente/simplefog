export const registerSettings = function () {
	// Register global config settings
	game.settings.register("simplefog", "confirmFogDisable", {
		name: "SIMPLEFOG.SETTINGS.confirmFogDisable.name",
		hint: "SIMPLEFOG.SETTINGS.confirmFogDisable.hint",
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
	});
	game.settings.register("simplefog", "autoEnableSceneFog", {
		name: "SIMPLEFOG.SETTINGS.autoEnableSceneFog.name",
		hint: "SIMPLEFOG.SETTINGS.autoEnableSceneFog.hint",
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
	});
	game.settings.register("simplefog", "toolHotKeys", {
		name: "SIMPLEFOG.SETTINGS.toolHotKeys.name",
		hint: "SIMPLEFOG.SETTINGS.toolHotKeys.hint",
		scope: "world",
		config: true,
		default: "brush",
		type: String,
		choices: {
			brush: "SIMPLEFOG.SETTINGS.toolHotKeys.choices.brush",
			grid: "SIMPLEFOG.SETTINGS.toolHotKeys.choices.grid",
			room: "SIMPLEFOG.SETTINGS.toolHotKeys.choices.room",
			polygon: "SIMPLEFOG.SETTINGS.toolHotKeys.choices.polygon",
			box: "SIMPLEFOG.SETTINGS.toolHotKeys.choices.box",
			ellipse: "SIMPLEFOG.SETTINGS.toolHotKeys.choices.ellipse",
		},
	});
	game.settings.register("simplefog", "zIndex", {
		name: "SIMPLEFOG.SETTINGS.zIndex.name",
		hint: "SIMPLEFOG.SETTINGS.zIndex.hint",
		scope: "world",
		config: true,
		default: 220,
		type: Number,
		onChange: (value) => canvas.simplefog.zIndex = value
	});
};
