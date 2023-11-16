/*
 * Provides for the ability to check and run migration code for changes to data
 */
/* eslint-disable max-len */
import { dmToGM } from "../helpers.js";

export default class SimplefogMigrations {
	static check() {
		if (!game.user.isGM) return;
		const ver = game.settings.get("simplefog", "migrationVersion");
		if (ver === 1) {
			SimplefogMigrations.migration2();
		} else if (ver < 1) SimplefogMigrations.migration1();
	}

	/*
	 * Tidys up some messy data storage from early versions
	 * - Converts string based shape names to integers
	 * - Rounds any decimal x / y / height / width values
	 * - Deletes any unnecessary visible & alpha props
	 */
	static migration1() {
		game.scenes.forEach(async (s) => {
			// Check if scene has simplefog history
			if (s.data.flags?.simplefog?.history?.events) {
				const { history } = s.data.flags.simplefog;
				// Loop through all events to check for old data
				for (let i = 0; i < history.events.length; i += 1) {
					for (let j = 0; j < history.events[i].length; j += 1) {
						// Update shape props to use integers instead of strings
						switch (history.events[i][j].shape) {
							case "ellipse":
								history.events[i][j].shape = 0;
								break;
							case "box":
								history.events[i][j].shape = 1;
								break;
							case "shape":
								history.events[i][j].shape = 3;
								break;
							case "polygon":
								history.events[i][j].shape = 3;
								break;
							default:
								break;
						}
						// Round decimal values
						if (history.events[i][j].x) history.events[i][j].x = Math.round(history.events[i][j].x);
						if (history.events[i][j].x) history.events[i][j].y = Math.round(history.events[i][j].y);
						if (history.events[i][j].height) history.events[i][j].height = Math.round(history.events[i][j].height);
						if (history.events[i][j].width) history.events[i][j].width = Math.round(history.events[i][j].width);
						// Remove unnecessary visible & alpha props
						if (history.events[i][j].visible) delete history.events[i][j].visible;
						if (history.events[i][j].alpha) delete history.events[i][j].alpha;
					}
				}
				await s.unsetFlag("simplefog", "history");
				s.setFlag("simplefog", "history", history);
				game.settings.set("simplefog", "migrationVersion", 1);
			}
		});
	}

	/*
	 * Major data changes from v9 to v10
	 */
	static migration2() {
		game.scenes.forEach(async (s) => {
			// Migrate all variables to new names, otherwise set to defaults
			if (s.flags?.simplefog?.gmAlpha) {
				s.setFlag("simplefog", "gmColorAlpha", s.data.flags.simplefog.gmAlpha);
				await s.unsetFlag("simplefog", "gmAlpha");
			} else if (s.getFlag("simplefog", "gmColorAlpha") === undefined) {
				s.setFlag("simplefog", "gmColorAlpha", canvas.simplefog.DEFAULTS.gmColorAlpha);
			}

			if (s.flags?.simplefog?.gmTint) {
				s.setFlag("simplefog", "gmColorTint", s.data.flags.simplefog.gmTint);
				await s.unsetFlag("simplefog", "gmTint");
			} else if (s.getFlag("simplefog", "gmColorTint") === undefined) {
				s.setFlag("simplefog", "gmColorTint", canvas.simplefog.DEFAULTS.gmColorTint);
			}

			if (s.flags?.simplefog?.playerAlpha) {
				s.setFlag("simplefog", "playerColorAlpha", s.data.flags.simplefog.playerAlpha);
				await s.unsetFlag("simplefog", "playerAlpha");
			} else if (s.getFlag("simplefog", "playerColorAlpha") === undefined) {
				s.setFlag("simplefog", "playerColorAlpha", canvas.simplefog.DEFAULTS.playerColorAlpha);
			}

			if (s.flags?.simplefog?.playerTint) {
				s.setFlag("simplefog", "playerColorTint", s.data.flags.simplefog.playerTint);
				await s.unsetFlag("simplefog", "playerTint");
			} else if (s.getFlag("simplefog", "playerColorTint") === undefined) {
				s.setFlag("simplefog", "playerColorTint", canvas.simplefog.DEFAULTS.playerColorTint);
			}

			if (s.flags?.simplefog?.layerZindex) {
				s.setFlag("simplefog", "fogImageOverlayZIndex", s.data.flags.simplefog.layerZindex);
				await s.unsetFlag("simplefog", "layerZindex");
			} else if (s.getFlag("simplefog", "fogImageOverlayZIndex") === undefined) {
				s.setFlag("simplefog", "fogImageOverlayZIndex", canvas.simplefog.DEFAULTS.fogImageOverlayZIndex);
			}

			if (s.flags?.simplefog?.fogTextureFilePath) {
				s.setFlag("simplefog", "fogImageOverlayFilePath", s.data.flags.simplefog.fogTextureFilePath);
				await s.unsetFlag("simplefog", "fogTextureFilePath");
			}
		});
		dmToGM(game.i18n.localize("SIMPLEFOG.migration2Notification"), undefined);
		game.settings.set("simplefog", "migrationVersion", 2);
	}
}
