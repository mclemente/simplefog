import { BrushControls } from "./BrushControls";

const { createFontAwesomeIcon } = foundry.applications.fields;

export default class SimplefogPalette extends BrushControls {
	static DEFAULT_OPTIONS = {
		classes: ["placeable-palette", "faded-ui"],
		id: "simplefogPalette",
		initialData: {},
		position: {
			scale: .8,
			width: 375
		},
		form: {
			closeOnSubmit: false,
			submitOnChange: true
		},
		actions: {
			closePalette: SimplefogPalette.#onClosePalette
		},
		preview: false
	};

	get title() {
		return _loc("SIMPLEFOG.BrushControls.label");
	}

	_onClose(options) {
		super._onClose(options);
		ui.placeablesPalette = null;
	}

	async _onFirstRender(context, options) {
		await super._onFirstRender(context, options);
		ui.placeablesPalette = this;
	}

	async _onRender(context, options) {
		await super._onRender(context, options);
		this.#renderInlineHints();
	}

	async _renderFrame(options) {
		const frame = await super._renderFrame(options);
		this.window.close.dataset.action = "closePalette";
		return frame;
	}

	static #onClosePalette() {
		return ui.controls.activate({ toggles: { togglePalette: false } });
	}

	#renderInlineHints() {
		for ( const hint of this.element.querySelectorAll("p.hint") ) {
			const group = hint.closest(".form-group");
			const label = group?.querySelector("label");
			if ( !label ) continue;
			label.classList.add("info");
			label.dataset.tooltipText = hint.textContent;
			label.insertAdjacentElement("beforeend", createFontAwesomeIcon("circle-info"));
			hint.hidden = true;
		}
	}
}
