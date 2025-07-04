
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

	_configureRenderOptions(options) {
		super._configureRenderOptions(options);
		if ( options.isFirstRender && ui.nav ) {
			const {right, top} = ui.nav.element.getBoundingClientRect();
			const uiScale = game.settings.get("core", "uiConfig").uiScale;
			options.position.left ??= right + (16 * uiScale);
			options.position.top ??= top;
		}
	}

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
		delete canvas.scene?.apps[this.id];
	}

	/* -------------------------------------------- */

	/** @override */
	async _prepareContext(_options) {
		const displayContainer = canvas.simplefog.activeTool === "brush";
		return {
			displayContainer,
			brushSize: game.settings.get("simplefog", "brushSize"),
			brushOpacity: game.settings.get("simplefog", "brushOpacity"),
		};
	}

	/* -------------------------------------------- */

	static async brushSize(event, target) {
		event?.preventDefault();
		target ??= event?.target.closest("[data-action]") ?? this.element.querySelector("input[name='brushSize']");
		const value = Number(target.value);
		await game.settings.set("simplefog", "brushSize", value);
		target.parentNode.querySelector(".range-value").innerText = `${value}px`;
		canvas.simplefog.setPreviewTint();
	}

	static async brushOpacity(event, target) {
		event?.preventDefault();
		target ??= event?.target.closest("[data-action]") ?? this.element.querySelector("input[name='brushOpacity']");
		const value = Number(target.value);
		await game.settings.set("simplefog", "brushOpacity", value);
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
