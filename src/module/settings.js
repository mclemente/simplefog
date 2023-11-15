import SimplefogLayer from "./classes/SimplefogLayer.js";
import config from "./config.js";
import CONSTANTS from "./constants.js";
export const registerSettings = function () {
	game.settings.registerMenu(CONSTANTS.MODULE_NAME, "resetAllSettings", {
		name: `${CONSTANTS.MODULE_NAME}.setting.reset.name`,
		hint: `${CONSTANTS.MODULE_NAME}.setting.reset.hint`,
		icon: "fas fa-coins",
		type: ResetSettingsDialog,
		restricted: true,
	});
	// =====================================================================
	// Register global module settings
	config.forEach((cfg) => {
		game.settings.register("simplefog", cfg.name, cfg.data);
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
	// ========================================================================
	// const settings = defaultSettings();
	// for (const [settingName, settingValue] of Object.entries(settings)) {
	//   game.settings.register(CONSTANTS.MODULE_NAME, settingName, settingValue);
	// }
	for (const [settingName, settingValue] of Object.entries(otherSettings)) {
		game.settings.register(CONSTANTS.MODULE_NAME, settingName, settingValue);
	}
};
class ResetSettingsDialog extends FormApplication {
	constructor(...args) {
		// @ts-ignore
		super(...args);
		// @ts-ignore
		return new Dialog({
			title: game.i18n.localize(`${CONSTANTS.MODULE_NAME}.dialogs.resetsettings.title`),
			content:
				`<p style="margin-bottom:1rem;">${
				game.i18n.localize(`${CONSTANTS.MODULE_NAME}.dialogs.resetsettings.content`)
				}</p>`,
			buttons: {
				confirm: {
					icon: '<i class="fas fa-check"></i>',
					label: game.i18n.localize(`${CONSTANTS.MODULE_NAME}.dialogs.resetsettings.confirm`),
					callback: async () => {
						await applyDefaultSettings();
						window.location.reload();
					},
				},
				cancel: {
					icon: '<i class="fas fa-times"></i>',
					label: game.i18n.localize(`${CONSTANTS.MODULE_NAME}.dialogs.resetsettings.cancel`),
				},
			},
			default: "cancel",
		});
	}

	async _updateObject(event, formData) {
		// do nothing
	}
}
async function applyDefaultSettings() {
	const settings = defaultSettings(true);
	// for (const [name, data] of Object.entries(settings)) {
	//   await game.settings.set(CONSTANTS.MODULE_NAME, name, data.default);
	// }
	const settings2 = otherSettings(true);
	for (const [name, data] of Object.entries(settings2)) {
		// @ts-ignore
		await game.settings.set(CONSTANTS.MODULE_NAME, name, data.default);
	}
}
function defaultSettings(apply = false) {
	return {
		// TODO this is usually useful for maintain some hidden settings between versions
	};
}
function otherSettings(apply = false) {
	return {
		// Register global config settings
		confirmFogDisable: {
			name: "Confirm Disabling of Scene Simplefog",
			hint: "When enabled, a confirmation dialog will be displayed before Simplefog can be toggled off for a scene",
			scope: "world",
			config: true,
			default: true,
			type: Boolean,
		},
		autoEnableSceneFog: {
			name: "Auto Enable Scene Fog",
			hint: "When enabled, Simplefog will automatically be enabled for a scene when it is first created.",
			scope: "world",
			config: true,
			default: true,
			type: Boolean,
		},
		enableHotKeys: {
			name: "Enable Simplefog Hotkeys",
			hint: "When enabled, you will be able to quickly swap to the Simplefog control by using Ctrl+S and toggle the opacity using the hotkey 'T'",
			scope: "world",
			config: true,
			default: false,
			type: Boolean,
		},
		toolHotKeys: {
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
		},
		zIndex: {
			name: "Simplefog Z-Index",
			hint: "The z-index determines the order in which various layers are rendered within the Foundry canvas.  A higher number will be rendered on top of lower numbered layers (and the objects on that layer).  This allows for the adjustment of the z-index to allow for Simple Fog to be rendered above/below other layers; particularly ones added by other modules. Going below 200 will intermingle with Foundry layers such as the foreground image (200), tokens (100), etc...  (Default: 220)",
			scope: "world",
			config: true,
			default: 220,
			type: Number,
			onChange: SimplefogLayer.refreshZIndex,
		},
		debug: {
			name: `${CONSTANTS.MODULE_NAME}.setting.debug.name`,
			hint: `${CONSTANTS.MODULE_NAME}.setting.debug.hint`,
			scope: "client",
			config: true,
			default: false,
			type: Boolean,
		},
		//
	};
}
