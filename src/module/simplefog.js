import SimplefogConfig from "./apps/SimplefogConfig.js";
import SimplefogLayer from "./layers/SimplefogLayer.js";
import { registerSettings } from "./settings.js";

Hooks.once("init", async () => {
	registerSettings();
	CONFIG.Canvas.layers.simplefog = { group: "interface", layerClass: SimplefogLayer };

	const isActiveControl = () => ui.controls.activeControl === "simplefog";
	game.keybindings.register("simplefog", "swap", {
		name: "Swap to Simple Fog's Controls",
		hint: "Toggles between the Token and Simple Fog layers. Check the module's settings to define which tool will be selected by default.",
		editable: [
			{
				key: "S",
				modifiers: ["Control"]
			}
		],
		onDown: () => {
			const layer = isActiveControl() ? "tokens" : "simplefog";
			canvas[layer].activate();
			return true;
		},
		restricted: true,
		precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
	});
	game.keybindings.register("simplefog", "undo", {
		name: "Undo Change",
		hint: "",
		editable: [
			{
				key: "Z",
				modifiers: ["Control"]
			}
		],
		onDown: () => {
			if (isActiveControl()) {
				canvas.simplefog.undo();
				return true;
			}
		},
		restricted: true,
		precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
	});
	game.keybindings.register("simplefog", "opacity", {
		name: "Toggle Opacity",
		hint: "Toggles the Brush Opacity's bar between Reveal/Hide. Only works while editing Simple Fog's layer.",
		uneditable: [],
		editable: [
			{
				key: "T"
			}
		],
		onDown: () => {
			if (isActiveControl()) {
				const bc = canvas.simplefog.brushControls;
				const handler = bc.options.actions.brushOpacity;
				const slider = bc.element.querySelector("input[name=brushOpacity]");
				slider.value = slider.value === "100" ? 0 : 100;
				handler.call(bc);
				return true;
			}
		},
		restricted: true,
	});
	game.keybindings.register("simplefog", "brushReduce", {
		name: "Reduce Brush Size",
		hint: "Only works while the Brush is selected.",
		editable: [
			{
				key: "BracketLeft"
			}
		],
		onDown: () => {
			if (isActiveControl() && canvas.simplefog.activeTool === "brush") {
				const bc = canvas.simplefog.brushControls;
				const handler = bc.options.actions.brushSize;
				const slider = bc.element.querySelector("input[name=brushSize]");
				slider.value = Math.max(Number(slider.value) * 0.8, 10).toNearest(10, "floor");
				handler.call(bc);
				canvas.simplefog.setBrushSize(slider.value);
				return true;
			}
		},
		onUp: () => {},
		repeat: true,
		restricted: true,
	});
	game.keybindings.register("simplefog", "brushIncrease", {
		name: "Increase Brush Size",
		hint: "Only works while the Brush is selected.",
		editable: [
			{
				key: "BracketRight"
			}
		],
		onDown: () => {
			if (isActiveControl() && canvas.simplefog.activeTool === "brush") {
				const bc = canvas.simplefog.brushControls;
				const handler = bc.options.actions.brushSize;
				const slider = bc.element.querySelector("input[name=brushSize]");
				slider.value = Math.min(Number(slider.value) * 1.25, 500).toNearest(10, "ceil");
				handler.call(bc);
				canvas.simplefog.setBrushSize(slider.value);
				return true;
			}
		},
		repeat: true,
		restricted: true,
	});
	game.keybindings.register("simplefog", "forceShape", {
		name: "Force Drag Shape (Hold)",
		hint: "Forces the width and height of Rectangle and Ellipse tools to be the same.",
		uneditable: [
			{
				key: "Shift"
			}
		],
		repeat: true,
		restricted: true,
		precedence: CONST.KEYBINDING_PRECEDENCE.DEFERRED
	});
});

Hooks.once("ready", async () => {
	canvas.simplefog.zIndex = game.settings.get("simplefog", "zIndex");

	canvas.perception.update({
		refreshLighting: true,
		refreshVision: true,
		refreshOcclusion: true
	});
});

Hooks.once("canvasInit", () => {
	if (!game.user.isGM) return;
	Object.keys(canvas.simplefog.DEFAULTS).forEach((key) => {
		// Check for existing scene specific setting
		if (canvas.simplefog.getSetting(key) !== undefined) return;
		// Check for custom default
		const def = canvas.simplefog.getUserSetting(key);
		// If user has custom default, set it for scene
		if (def !== undefined) canvas.simplefog.setSetting(key, def);
		// Otherwise fall back to module default
		else canvas.simplefog.setSetting(key, canvas.simplefog.DEFAULTS[key]);
	});
});

Hooks.on("canvasInit", () => {
	const overlayFile = canvas.simplefog.getSetting("fogImageOverlayFilePath");
	if (overlayFile) {
		canvas.loadTexturesOptions.additionalSources.push(overlayFile);
	}
});

// from controls.js

/**
 * Add control buttons
 */
// Hooks.on("getSceneControlButtons", (controls) => {
// 	if (!game.user.isGM) return;
// 	const tools = {
// 		"simplefogtoggle": {
// 			name: "simplefogtoggle",
// 			title: game.i18n.localize("SIMPLEFOG.onoff"),
// 			icon: "fas fa-eye",
// 			onClick: () => toggleSimpleFog(),
// 			active: canvas.simplefog?.visible,
// 			toggle: true,
// 		},
// 		"brush": {
// 			name: "brush",
// 			title: game.i18n.localize("SIMPLEFOG.brushTool"),
// 			icon: "fas fa-paint-brush",
// 			onClick: () => canvas.simplefog?._changeTool(),
// 		},
// 		"room": {
// 			name: "room",
// 			title: game.i18n.localize("SIMPLEFOG.roomTool"),
// 			icon: "fas fa-block-brick",
// 			onClick: () => canvas.simplefog?._changeTool(),
// 		},
// 		"polygon": {
// 			name: "polygon",
// 			title: game.i18n.localize("SIMPLEFOG.polygonTool"),
// 			icon: "fas fa-draw-polygon",
// 			onClick: () => canvas.simplefog?._changeTool(),
// 		},
// 		"box": {
// 			name: "box",
// 			title: game.i18n.localize("SIMPLEFOG.boxTool"),
// 			icon: "far fa-square",
// 			onClick: () => canvas.simplefog?._changeTool(),
// 		},
// 		"ellipse": {
// 			name: "ellipse",
// 			title: game.i18n.localize("SIMPLEFOG.ellipseTool"),
// 			icon: "far fa-circle",
// 			onClick: () => canvas.simplefog?._changeTool(),
// 		},
// 		"sceneConfig": {
// 			name: "sceneConfig",
// 			title: game.i18n.localize("SIMPLEFOG.sceneConfig"),
// 			icon: "fas fa-cog",
// 			onClick: () => {
// 				new SimplefogConfig().render(true);
// 			},
// 			button: true,
// 		},
// 		"clearfog": {
// 			name: "clearfog",
// 			title: game.i18n.localize("SIMPLEFOG.reset"),
// 			icon: "fas fa-trash",
// 			onClick: () => {
// 				const dg = new Dialog({
// 					title: game.i18n.localize("SIMPLEFOG.reset"),
// 					content: game.i18n.localize("SIMPLEFOG.confirmReset"),
// 					buttons: {
// 						reset: {
// 							icon: '<i class="fas fa-trash"></i>',
// 							label: "Reset",
// 							callback: () => canvas.simplefog.resetMask(),
// 						},
// 						blank: {
// 							icon: '<i class="fas fa-eye"></i>',
// 							label: "Blank",
// 							callback: () => canvas.simplefog.blankMask(),
// 						},
// 						cancel: {
// 							icon: '<i class="fas fa-times"></i>',
// 							label: "Cancel",
// 						},
// 					},
// 					default: "reset",
// 				});
// 				dg.render(true);
// 			},
// 			button: true,
// 		},
// 	};
// 	let activeTool = game.settings.get("simplefog", "toolHotKeys");
// 	if (canvas.grid?.type) {
// 		tools.splice(2, 0, {
// 			name: "grid",
// 			title: game.i18n.localize("SIMPLEFOG.gridTool"),
// 			icon: "fas fa-border-none",
// 			onClick: () => canvas.simplefog?._changeTool(),
// 		});
// 	} else if (activeTool === "grid") activeTool = "brush";
// 	controls["simplefog"] = {
// 		name: "simplefog",
// 		title: game.i18n.localize("SIMPLEFOG.sf"),
// 		icon: "fas fa-cloud",
// 		layer: "simplefog",
// 		tools,
// 		activeTool,
// 	};
// });
Hooks.on('getSceneControlButtons', controls => {
        if (!game.user.isGM) return;

        controls.simplefog = {
            name: "simplefog",
            title: "Simple Fog",
            icon: "fas fa-eye",
            activeTool: "dummy",
            tools: {
                dummy: {
                    //Dummy tool because Foundry does not like it when there's no valid 'active' tool available, it's hidden on the 'renderSceneControls' hook. https://github.com/foundryvtt/foundryvtt/issues/12966
                    name: "dummy",
                    visible: true,
                    order: 9
                },
                simplefogtoggle: {
                    name: "simplefogtoggle",
                    icon: "fas fa-eye",
                    visible: true,
                    button: true,
                    order: 0,
                    onChange: () => toggleSimpleFog(),
					title: game.i18n.localize("SIMPLEFOG.onoff"),
					active: canvas.simplefog?.visible,
					toggle: true,
                },
                brush: {
                    name: "brush",
                    title: game.i18n.localize("SIMPLEFOG.brushTool"),
                    icon: "fas fa-paint-brush",
                    visible: true,
                    order: 1,
                    onClick: () => {
                        canvas.simplefog?._changeTool("brush");
                    },
                    button: true
                },
                room: {
                    name: "room",
                    title: game.i18n.localize("SIMPLEFOG.roomTool"),
                    icon: "fas fa-block-brick",
                    visible: true,
                    order: 2,
                    onClick: () => {
                        canvas.simplefog?._changeTool("room");
                    },
                    button: true
                },
				polygon: {
                    name: "polygon",
                    title: game.i18n.localize("SIMPLEFOG.polygonTool"),
                    icon: "fas fa-draw-polygon",
                    visible: true,
                    order: 2,
                    onClick: () => {
                        canvas.simplefog?._changeTool("polygon");
                    },
                    button: true
                },
				box: {
                    name: "box",
                    title: game.i18n.localize("SIMPLEFOG.boxTool"),
                    icon: "far fa-square",
                    visible: true,
                    order: 2,
                    onClick: () => {
                        canvas.simplefog?._changeTool("box");
                    },
                    button: true
                },
				ellipse: {
                    name: "ellipse",
                    title: game.i18n.localize("SIMPLEFOG.ellipseTool"),
                    icon: "far fa-circle",
                    visible: true,
                    order: 2,
                    onClick: () => {
                        canvas.simplefog?._changeTool("ellipse");
                    },
                    button: true
                },
				sceneConfig: {
                    name: "sceneConfig",
                    title: game.i18n.localize("SIMPLEFOG.sceneConfig"),
                    icon: "fas fa-cog",
                    visible: true,
                    order: 2,
                    onClick: () => {
                        new SimplefogConfig().render(true);
                    },
                    button: true
                },
				reset: {
                    name: "reset",
                    title: game.i18n.localize("SIMPLEFOG.reset"),
                    icon: "fas fa-trash",
                    visible: true,
                    order: 2,
                    onClick: () => {
						const dg = new Dialog({
							title: game.i18n.localize("SIMPLEFOG.reset"),
							content: game.i18n.localize("SIMPLEFOG.confirmReset"),
							buttons: {
								reset: {
									icon: '<i class="fas fa-trash"></i>',
									label: "Reset",
									callback: () => canvas.simplefog.resetMask(),
								},
								blank: {
									icon: '<i class="fas fa-eye"></i>',
									label: "Blank",
									callback: () => canvas.simplefog.blankMask(),
								},
								cancel: {
									icon: '<i class="fas fa-times"></i>',
									label: "Cancel",
								},
							},
							default: "reset",
						});
						dg.render(true);
					},
                    button: true
                }
            },
        }
    });

    Hooks.on('renderSceneControls', () => {
         if (!game.user.isGM) return;
        if (ui.controls.control.name !== 'simplefog') {
            // lockView.viewbox.enableEdit(false);
            // ui.controls.controls.lockView.tools.editViewbox.active = false;
        }
        else {
            //hide dummy tool
            document.querySelector('button[data-tool="dummy"]').parentElement.style.display = 'none' 
        }
    })

/**
 * Toggle Simple Fog
 */
function toggleSimpleFog() {
	if (game.settings.get("simplefog", "confirmFogDisable") && canvas.simplefog.getSetting("visible")) {
		let dg = Dialog.confirm({
			title: game.i18n.localize("SIMPLEFOG.disableFog"),
			content: game.i18n.localize("SIMPLEFOG.confirmDisableFog"),
			yes: () => toggleOffSimpleFog(),
			no: () => cancelToggleSimpleFog(),
			defaultYes: false,
			rejectClose: true,
		});
		dg.then(undefined, cancelToggleSimpleFog);
	} else {
		toggleOffSimpleFog();
	}
}

function toggleOffSimpleFog() {
	canvas.simplefog.toggle();
	canvas.perception.update({
		refreshLighting: true,
		refreshVision: true,
		refreshOcclusion: true
	});
}

function cancelToggleSimpleFog(result = undefined) {
	ui.controls.controls.find(({ name }) => name === "simplefog").tools[0].active = true;
	ui.controls.render();
}
