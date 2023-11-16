/*
 * Provides a mechanism to send whisper to GM when new version installed.
 */
import { dmToGM } from "../helpers.js";

export default class SimplefogNotification {
	static checkVersion() {
    let packageVersion;

	packageVersion = game.modules.get("simplefog").version;

		if (
			game.user.isGM
			&& game.user.getFlag("simplefog", "versionNotification") !== packageVersion
		) {
			// GM has never seen current version message

			dmToGM(game.i18n.localize("SIMPLEFOG.versionNotification"), undefined);

			// Update the saved version
			game.user.setFlag("simplefog", "versionNotification", packageVersion);
		}
	}
}
