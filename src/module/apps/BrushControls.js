import { hexToPercent, percentToHex } from "../helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class BrushControls extends HandlebarsApplicationMixin(ApplicationV2) {
	static DEFAULT_OPTIONS = {
		id: "simplefog-filter-config",
		tag: "aside",
		position: {
			width: 320,
			height: "auto"
		},
		window: {
			title: "Brush Controls",
			icon: "fas fa-cloud",
			minimizable: false
		},
		actions: {
			brushSize: BrushControls.brushSize,
			brushOpacity: BrushControls.brushOpacity,
			brushOpacityToggle: BrushControls.brushOpacityToggle
		},
	};

	/** @override */
	static PARTS = {
		list: {
			id: "list",
			template: "modules/simplefog/templates/brush-controls.html",
		}
	};

	/* -------------------------------------------- */

	/** @inheritDoc */
	async _renderFrame(options) {
		const frame = await super._renderFrame(options);
		this.window.close.remove(); // Prevent closing
		return frame;
	}

	/* -------------------------------------------- */

	/** @inheritDoc */
	async close(options={}) {
		if ( !options.closeKey ) return super.close(options);
		return this;
	}

	/* -------------------------------------------- */

	/** @inheritDoc */
	_onFirstRender(context, options) {
		super._onFirstRender(context, options);
		const left = ui.nav?.element[0].getBoundingClientRect().left;
		const top = ui.controls?.element[0].getBoundingClientRect().top;
		options.position = {...options.position, left, top};
		canvas.scene.apps[this.id] = this;
	}

	/* -------------------------------------------- */

	/** @inheritDoc */
	_onRender(context, options) {
		super._onRender(context, options);
		this.element.querySelector("input[name='brushSize']")
			?.addEventListener("change", BrushControls.brushSize.bind(this));
		this.element.querySelector("input[name='brushOpacity']")
			.addEventListener("change", BrushControls.brushOpacity.bind(this));
	}

	/* -------------------------------------------- */

	/** @override */
	_onClose(options) {
		super._onClose(options);
		delete canvas.scene.apps[this.id];
	}

	/* -------------------------------------------- */

	/** @override */
	async _prepareContext(_options) {
		const displayContainer = canvas.simplefog.activeTool === "brush";
		return {
			displayContainer,
			brushSize: canvas.simplefog.getUserSetting("brushSize"),
			brushOpacity: hexToPercent(canvas.simplefog.getUserSetting("brushOpacity")),
		};
	}

	/* -------------------------------------------- */

	static async brushSize(event, target) {
		event?.preventDefault();
		target ??= event?.target.closest("[data-action]") ?? this.element.querySelector("input[name='brushSize']");
		const value = Number(target.value);
		await canvas.simplefog.setUserSetting("brushSize", value);
		target.parentNode.querySelector(".range-value").innerText = `${value}px`;
		canvas.simplefog.setPreviewTint();
	}

	static async brushOpacity(event, target) {
		event?.preventDefault();
		target ??= event?.target.closest("[data-action]") ?? this.element.querySelector("input[name='brushOpacity']");
		const value = Number(target.value);
		await canvas.simplefog.setUserSetting("brushOpacity", percentToHex(value));
		target.parentNode.querySelector(".range-value").innerText = `${value}%`;
		canvas.simplefog.setPreviewTint();
	}

	static async brushOpacityToggle(event, target) {
		event?.preventDefault();
		const bc = canvas.simplefog.brushControls;
		const slider = bc.element.querySelector("input[name=brushOpacity]");
		slider.value = Number(event.target.dataset.value);
		BrushControls.brushOpacity.call(bc);
	}
}
