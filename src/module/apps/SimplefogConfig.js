import { hexToWeb, webToHex } from "../helpers.js";
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
		// Return data to the template
		return {
			gmColorAlpha: Math.round(canvas.simplefog.getSetting("gmColorAlpha") * 100),
			gmColorTint: hexToWeb(canvas.simplefog.getSetting("gmColorTint")),
			playerColorAlpha: Math.round(canvas.simplefog.getSetting("playerColorAlpha") * 100),
			playerColorTint: hexToWeb(canvas.simplefog.getSetting("playerColorTint")),
			transition: canvas.simplefog.getSetting("transition"),
			transitionSpeed: canvas.simplefog.getSetting("transitionSpeed"),
			blurEnable: canvas.simplefog.getSetting("blurEnable"),
			blurRadius: canvas.simplefog.getSetting("blurRadius"),
			blurQuality: canvas.simplefog.getSetting("blurQuality"),
			autoVisibility: canvas.simplefog.getSetting("autoVisibility"),
			autoVisGM: canvas.simplefog.getSetting("autoVisGM"),
			vThreshold: Math.round(canvas.simplefog.getSetting("vThreshold") * 100),
			fogImageOverlayFilePath: canvas.simplefog.getSetting("fogImageOverlayFilePath"),
			fogImageOverlayGMAlpha: Math.round(canvas.simplefog.getSetting("fogImageOverlayGMAlpha") * 100),
			fogImageOverlayPlayerAlpha: Math.round(canvas.simplefog.getSetting("fogImageOverlayPlayerAlpha") * 100),
			fogImageOverlayZIndex: canvas.simplefog.getSetting("fogImageOverlayZIndex"),
			fogImageOverlayZIndexOptions: {
				4000: "Color Tint Above Overlay Image",
				6000: "Overlay Image Above Color Tint",
			},
			versionNotification: canvas.simplefog.getSetting("versionNotification"),
			buttons: [
				{
					type: "submit",
					action: "saveDefaults",
					icon: "fas fa-save",
					label: "SIMPLEFOG.saveAsDef",
				},
				{
					type: "submit",
					action: "ok",
					icon: "fa fa-check",
					label: "SIMPLEFOG.ok",
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
		const settings = foundry.utils.expandObject(formData.object);
		Object.entries(settings).forEach(async ([key, val]) => {
			// If setting is an opacity slider, convert from 1-100 to 0-1
			if (
				[
					"gmColorAlpha",
					"playerColorAlpha",
					"vThreshold",
					"fogImageOverlayGMAlpha",
					"fogImageOverlayPlayerAlpha",
				].includes(key)
			) val /= 100;
			// If setting is a color value, convert webcolor to hex before saving
			if (["gmColorTint", "playerColorTint"].includes(key)) val = webToHex(val);
			// Save settings to scene
			await canvas.simplefog.setSetting(key, val);
			// If saveDefaults button clicked, also save to user's defaults
			if (event.submitter.dataset.action === "saveDefaults") {
				canvas.simplefog.setUserSetting(key, val);
			}
		});

		// Update sight layer
		canvas.perception.update({
			refreshLighting: true,
			refreshVision: true,
			refreshOcclusion: true,
		});
	}
}
