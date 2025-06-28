import SimplefogConfig from "./apps/SimplefogConfig.js";
import { percentToHex } from "./helpers.js";

export const registerSettings = function () {
	const { BooleanField, ColorField, FilePathField, NumberField, SchemaField } = foundry.data.fields;
	// Register global config settings
	game.settings.registerMenu("simplefog", "config", {
		name: "SIMPLEFOG.SETTINGS.config.name",
		label: "SIMPLEFOG.SETTINGS.config.label",
		hint: "SIMPLEFOG.SETTINGS.config.hint",
		icon: "fas fa-cloud",
		type: SimplefogConfig,
		restricted: true,
	});

	game.settings.register("simplefog", "config", {
		scope: "world",
		config: false,
		type: new SchemaField({
			blurEnable: new BooleanField({ initial: true, label: "SIMPLEFOG.blurEnable" }),
			blurQuality: new NumberField({
				required: true,
				nullable: false,
				initial: 2,
				min: 1,
				max: 8,
				step: 1,
				integer: true,
				positive: true,
				label: "SIMPLEFOG.blurQuality"
			}),
			blurRadius: new NumberField({
				required: true,
				nullable: false,
				initial: 5,
				min: 0,
				max: 50,
				step: 1,
				integer: true,
				label: "SIMPLEFOG.blurRadius"
			}),
			gmColorAlpha: new NumberField({
				required: true,
				nullable: false,
				initial: 60,
				min: 0,
				max: 100,
				step: 1,
				integer: true,
				label: "SIMPLEFOG.gmColorAlpha"
			}),
			gmColorTint: new ColorField({ required: true, nullable: false, initial: "#000000", label: "SIMPLEFOG.gmColorTint" }),
			playerColorAlpha: new NumberField({
				required: true,
				nullable: false,
				initial: 100,
				min: 0,
				max: 100,
				step: 1,
				integer: true,
				label: "SIMPLEFOG.playerColorAlpha"
			}),
			playerColorTint: new ColorField({ required: true, nullable: false, initial: "#000000", label: "SIMPLEFOG.playerColorTint" }),
			fogImageOverlayFilePath: new FilePathField({
				categories: ["IMAGE", "VIDEO"],
				nullable: true,
				initial: null,
				required: false,
				label: "SIMPLEFOG.fogImageOverlay",
				hint: "SIMPLEFOG.fogImageOverlayNotes",
			}),
			fogImageOverlayGMAlpha: new NumberField({
				required: true,
				nullable: false,
				initial: 60,
				min: 0,
				max: 100,
				step: 1,
				integer: true,
				label: "SIMPLEFOG.fogImageOverlayGMAlpha"
			}),
			fogImageOverlayPlayerAlpha: new NumberField({
				required: true,
				nullable: false,
				initial: 100,
				min: 0,
				max: 100,
				step: 1,
				integer: true,
				label: "SIMPLEFOG.fogImageOverlayPlayerAlpha"
			}),
			fogImageOverlayZIndex: new NumberField({
				required: true,
				nullable: false,
				initial: 6000,
				integer: true,
				choices: {
					4000: "SIMPLEFOG.fogImageOverlayZIndexOptions.4000",
					6000: "SIMPLEFOG.fogImageOverlayZIndexOptions.6000",
				},
				label: "SIMPLEFOG.fogImageOverlayZIndex"
			}),
			transition: new BooleanField({ initial: true, label: "SIMPLEFOG.enableTransitions" }),
			transitionSpeed: new NumberField({
				required: true,
				nullable: false,
				initial: 800,
				min: 100,
				max: 5000,
				step: 100,
				integer: true,
				label: "SIMPLEFOG.transitionSpeed"
			}),
			autoVisibility: new BooleanField({ initial: false, label: "SIMPLEFOG.enableAutovis", hint: "SIMPLEFOG.autoVisNotes" }),
			autoVisGM: new BooleanField({ initial: false, label: "SIMPLEFOG.enableForGM" }),
			vThreshold: new NumberField({
				required: true,
				nullable: false,
				initial: 100,
				min: 0,
				max: 100,
				step: 1,
				integer: true,
				label: "SIMPLEFOG.visThreshold"
			}),
		}),
		onChange: (v) => canvas.simplefog.settings = v
	});
	game.settings.register("simplefog", "brushSize", {
		scope: "world",
		config: false,
		type: new NumberField({
			required: true,
			nullable: false,
			initial: 50,
			min: 10,
			max: 500,
			step: 10,
			integer: true
		}),
		onChange: (v) => canvas.simplefog.brushSize = v
	});
	game.settings.register("simplefog", "brushOpacity", {
		scope: "world",
		config: false,
		type: new NumberField({
			required: true,
			nullable: false,
			initial: 0,
			min: 0,
			max: 100,
			step: 1,
			integer: true
		}),
		onChange: (v) => canvas.simplefog.brushOpacity = percentToHex(v)
	});
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
	const hasHealthEstimate = game.modules.get("healthEstimate")?.active;
	game.settings.register("simplefog", "zIndex", {
		name: "SIMPLEFOG.SETTINGS.zIndex.name",
		hint: "SIMPLEFOG.SETTINGS.zIndex.hint",
		scope: "world",
		config: true,
		type: new NumberField({
			required: true,
			nullable: false,
			initial: 1120,
			choices: {
				220: "SIMPLEFOG.SETTINGS.zIndex.choices.tokens",
				1020: "SIMPLEFOG.SETTINGS.zIndex.choices.controls",
				1120: hasHealthEstimate ? "SIMPLEFOG.SETTINGS.zIndex.choices.healthEstimate" : "SIMPLEFOG.SETTINGS.zIndex.choices.interface"
			},
			integer: true
		}),
		onChange: (value) => canvas.simplefog.zIndex = value
	});
};
