import SimplefogConfig from "./apps/SimplefogConfig.js";
import { percentToHex } from "./helpers.js";

export function registerSettings() {
	const { ColorField, FilePathField, NumberField, SchemaField } = foundry.data.fields;
	// Register global config settings
	game.settings.registerMenu("simplefog", "config", {
		name: "SIMPLEFOG.SETTINGS.config.name",
		label: "SIMPLEFOG.SETTINGS.config.label",
		hint: "SIMPLEFOG.SETTINGS.config.hint",
		icon: "fas fa-cloud",
		type: SimplefogConfig,
		restricted: true,
	});

	game.settings.register("simplefog", "previewPlayerVision", {
		name: "SIMPLEFOG.SETTINGS.previewPlayerVision.name",
		hint: "SIMPLEFOG.SETTINGS.previewPlayerVision.hint",
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
		onChange: (v) => {
			if (game.user.isGM) {
				if (v) Hooks.on("controlToken", controlToken);
				else Hooks.off("controlToken", controlToken);
			}
		}
	});
	game.settings.register("simplefog", "config", {
		scope: "world",
		config: false,
		type: new SchemaField({
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
				initial: 60,
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
			})
		}),
		onChange: (v) => canvas.simplefog.settings = v
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
				190: "SIMPLEFOG.SETTINGS.zIndex.choices.belowTokens",
				220: "SIMPLEFOG.SETTINGS.zIndex.choices.tokens",
				1020: "SIMPLEFOG.SETTINGS.zIndex.choices.controls",
				1120: "SIMPLEFOG.SETTINGS.zIndex.choices.interface"
			},
			integer: true
		}),
		onChange: (value) => canvas.simplefog.zIndex = value
	});
}

export function controlToken(token, active) {
	if (canvas.simplefog?.visible) {
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
}
