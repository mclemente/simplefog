const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class BrushControls extends HandlebarsApplicationMixin(ApplicationV2) {
	static DEFAULT_OPTIONS = {
		id: "simplefog-filter-config",
		tag: "aside",
		position: {
			width: 560,
			// height: "auto"
		},
		window: {
			title: "SIMPLEFOG.BrushControls.label",
			icon: "fas fa-cloud",
			// minimizable: false
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

	// _configureRenderOptions(options) {
	// 	super._configureRenderOptions(options);
	// 	if ( options.isFirstRender && ui.nav ) {
	// 		const {right, top} = ui.nav.element.getBoundingClientRect();
	// 		const uiScale = game.settings.get("core", "uiConfig").uiScale;
	// 		options.position.left ??= right + (16 * uiScale);
	// 		options.position.top ??= top;
	// 	}
	// }

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
			brushSize: canvas.simplefog.brushSize,
			brushOpacity: game.settings.get("simplefog", "brushOpacity"),
		};
	}

	/* -------------------------------------------- */

	static async brushSize(event) {
		event?.preventDefault();
		const value = Number(event.target.closest("[data-action]").value);
		canvas.simplefog.brushSize = value;
		canvas.simplefog.setPreviewTint();
		this.render({ force: true });
	}

	static async brushOpacity(event) {
		event.preventDefault();
		const value = Number(event.target.closest("[data-action]").value);
		await game.settings.set("simplefog", "brushOpacity", value);
		canvas.simplefog.setPreviewTint();
		this.render({ force: true });
	}

	static async brushOpacityToggle(event, target) {
		event.preventDefault();
		const value = Number(event.target.dataset.value);
		await game.settings.set("simplefog", "brushOpacity", value);
		canvas.simplefog.setPreviewTint();
		this.render({ force: true });
	}
}