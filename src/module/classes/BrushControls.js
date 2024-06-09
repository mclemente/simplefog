import { hexToPercent, percentToHex } from "../helpers.js";

export default class BrushControls extends FormApplication {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			closeOnSubmit: false,
			submitOnChange: true,
			submitOnClose: true,
			popOut: false,
			editable: game.user.isGM,
			template: "modules/simplefog/templates/brush-controls.html",
			id: "filter-config",
			title: game.i18n.localize("Simple Fog Options"),
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
			brushSize: canvas.simplefog.getUserSetting("brushSize"),
			brushOpacity: hexToPercent(canvas.simplefog.getUserSetting("brushOpacity")),
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
		canvas.simplefog.setUserSetting("brushSize", formData.brushSize);
		await canvas.simplefog.setUserSetting("brushOpacity", percentToHex(formData.brushOpacity));
		canvas.simplefog.setPreviewTint();
	}
}
