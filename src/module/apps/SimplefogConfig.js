import { hexToWeb } from "../helpers.js";
const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class SimplefogConfig extends HandlebarsApplicationMixin(ApplicationV2) {
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
			title: "simplefog.app_title",
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

	get title() {
		return `${game.i18n.format("Simple Fog Options")}`;
	}

	/* -------------------------------------------- */

	/**
	 * Obtain module metadata and merge it with game settings which track current module visibility
	 * @return {Object}   The data provided to the template when rendering the form
	 */
	async _preparePartContext(partId, context, options) {
		context = await super._preparePartContext(partId, context, options);
		context.fields = game.settings.settings.get("simplefog.config").type.fields;

		// Return data to the template
		return {
			...context,
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
			fogImageOverlayZIndexOptions: {
				4000: "Color Tint Above Overlay Image",
				6000: "Overlay Image Above Color Tint",
			},
			buttons: [
				{
					type: "submit",
					action: "saveDefaults",
					icon: "fas fa-save",
					label: "SIMPLEFOG.saveAsDef",
				},
				{
					type: "button",
					action: "reset",
					icon: "fas fa-undo",
					label: "SETTINGS.Reset",
				},
				{
					type: "submit",
					icon: "fa fa-check",
					label: "Save",
				},
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
		Object.entries(settings).forEach(async ([key, val]) => {
			// Save settings to scene
			await canvas.scene.setFlag("simplefog", key, val);
		});
		// If saveDefaults button clicked, also save to user's defaults
		if (event.submitter.dataset.action === "saveDefaults") {
			await game.settings.set("simplefog", "config", settings);
		}

		// Update sight layer
		canvas.perception.update({
			refreshLighting: true,
			refreshVision: true,
			refreshOcclusion: true,
		});
	}

	static async #reset() {
		await Promise.all(
			Object.keys(canvas.simplefog.settings).map((key) => canvas.scene.unsetFlag("simplefog", key))
		);
		this.render();
	}
}
