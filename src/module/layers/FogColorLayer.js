export default class FogColorLayer extends PIXI.Sprite {
	constructor() {
		super(PIXI.Texture.WHITE);
		const { x, y, width, height } = canvas.dimensions.sceneRect;
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
