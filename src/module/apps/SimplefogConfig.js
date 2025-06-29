import { hexToWeb } from "../helpers.js";
const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class SimplefogConfig extends HandlebarsApplicationMixin(ApplicationV2) {
	constructor(scene, options) {
		super(options);
		this.scene = scene;
	}

	static DEFAULT_OPTIONS = {
		id: "simplefog-scene-config",
		form: {
			handler: SimplefogConfig.handler,
			closeOnSubmit: true,
		},
		position: {
			width: 500,
			height: "auto",
		},
		tag: "form",
		window: {
			icon: "fas fa-cloud",
			title: "SIMPLEFOG.fogConfiguration",
			contentClasses: ["standard-form"],
		},
		options: {
			scrollable: true,
		},
		actions: {
			reset: SimplefogConfig.#reset
		}
	};

	static PARTS = {
		body: {
			template: "modules/simplefog/templates/scene-config.html",
		},
		footer: {
			template: "templates/generic/form-footer.hbs",
		},
	};

	/* -------------------------------------------- */

	/**
	 * Obtain module metadata and merge it with game settings which track current module visibility
	 * @return {Object}   The data provided to the template when rendering the form
	 */
	async _prepareContext() {
		return {
			fields: game.settings.settings.get("simplefog.config").type.fields,
			gmColorAlpha: Math.round(canvas.simplefog.getSetting("gmColorAlpha")),
			gmColorTint: hexToWeb(canvas.simplefog.getSetting("gmColorTint")),
			playerColorAlpha: Math.round(canvas.simplefog.getSetting("playerColorAlpha")),
			playerColorTint: hexToWeb(canvas.simplefog.getSetting("playerColorTint")),
			transition: canvas.simplefog.getSetting("transition"),
			transitionSpeed: canvas.simplefog.getSetting("transitionSpeed"),
			blurEnable: canvas.simplefog.getSetting("blurEnable"),
			blurRadius: canvas.simplefog.getSetting("blurRadius"),
			blurQuality: canvas.simplefog.getSetting("blurQuality"),
			autoVisibility: canvas.simplefog.getSetting("autoVisibility"),
			autoVisGM: canvas.simplefog.getSetting("autoVisGM"),
			vThreshold: Math.round(canvas.simplefog.getSetting("vThreshold")),
			fogImageOverlayFilePath: canvas.simplefog.getSetting("fogImageOverlayFilePath"),
			fogImageOverlayGMAlpha: Math.round(canvas.simplefog.getSetting("fogImageOverlayGMAlpha")),
			fogImageOverlayPlayerAlpha: Math.round(canvas.simplefog.getSetting("fogImageOverlayPlayerAlpha")),
			fogImageOverlayZIndex: canvas.simplefog.getSetting("fogImageOverlayZIndex"),
			buttons: [
				{
					type: "submit",
					icon: "fas fa-save",
					label: this.scene ? "Save" : "SIMPLEFOG.saveAsDef",
				},
				{
					type: "button",
					action: "reset",
					icon: "fas fa-undo",
					label: "SETTINGS.Reset",
				}
			],
		};
	}

	/**
	 * This method is called upon form submission after form data is validated
	 * @param event {Event}       The initial triggering submission event
	 * @param formData {Object}   The object of validated form data with which to update the object
	 * @private
	 */
	static async handler(event, form, formData) {
		const settings = foundry.utils.expandObject(formData.object).simplefog.config;
		if (this.scene) {
			const defaultSettings = game.settings.get("simplefog", "config");
			for (const [key, val] of Object.entries(settings)) {
				const isEqualToDefault = defaultSettings[key] === val || defaultSettings[key]?.css === val;
				if (!val || isEqualToDefault) await this.scene.unsetFlag("simplefog", key);
				else await this.scene.setFlag("simplefog", key, val);
			}
		} else {
			await game.settings.set("simplefog", "config", settings);
		}

		// Update sight layer
		canvas.perception.update({
			refreshLighting: true,
			refreshVision: true,
			refreshOcclusion: true,
		});
		if (this.scene) await canvas.draw(this.scene);
	}

	static async #reset() {
		if (this.scene) {
			for (const key of Object.keys(canvas.simplefog.settings)) {
				await this.scene.unsetFlag("simplefog", key);
			}
		} else {
			await game.settings.set("simplefog", "config", undefined);
		}
		this.render();
	}
}
