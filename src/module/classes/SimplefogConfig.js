import { hexToWeb, webToHex } from "../helpers.js";

export default class SimplefogConfig extends FormApplication {
	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			classes: ["form"],
			closeOnSubmit: false,
			submitOnChange: true,
			submitOnClose: true,
			popOut: true,
			editable: game.user.isGM,
			width: 500,
			template: "modules/simplefog/templates/scene-config.html",
			id: "simplefog-scene-config",
			title: game.i18n.localize("Simplefog Options"),
		});
	}

	/* -------------------------------------------- */

	/**
	 * Obtain module metadata and merge it with game settings which track current module visibility
	 * @return {Object}   The data provided to the template when rendering the form
	 */
	getData() {
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
		};
	}

	/* -------------------------------------------- */
	/*  Event Listeners and Handlers                */
	/* -------------------------------------------- */

	/**
	 * This method is called upon form submission after form data is validated
	 * @param event {Event}       The initial triggering submission event
	 * @param formData {Object}   The object of validated form data with which to update the object
	 * @private
	 */
	async _updateObject(event, formData) {
		Object.entries(formData).forEach(async ([key, val]) => {
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
			if (event.submitter?.name === "saveDefaults") {
				canvas.simplefog.setUserSetting(key, val);
			}
		});

		// If save button was clicked, close app
		if (["submit", "saveDefaults"].includes(event.submitter?.name)) {
			this.close();
		}

		// Update sight layer
		canvas.perception.refresh();
	}
}
