export default class FogColorLayer extends PIXI.Sprite {
	constructor({ x = 0, y = 0, width, height }) {
		super(PIXI.Texture.WHITE);
		this.width = width;
		this.height = height;
		this.x = x;
		this.y = y;
		this.zIndex = 5000;

		this.alpha = game.user.isGM ? canvas.simplefog.getSetting("gmColorAlpha") / 100 : 1;
		this.tint = game.user.isGM ? canvas.simplefog.getSetting("gmColorTint") : canvas.simplefog.getSetting("playerColorTint");

		this.mask = canvas.simplefog.maskSprite;
	}
}
