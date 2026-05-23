export default class BrushPreview extends PIXI.Graphics {
	/**
	 * Creates a PIXI graphic using the given brush parameters
	 * @param data {Object}       A collection of brush parameters
	 *
	 * @example
	 * const myBrush = new BrushPreview({
	 *      shape: BRUSH_TYPES.ELLIPSE,
	 *      x: 0,
	 *      y: 0,
	 *      fill: 0x000000,
	 *      width: 50,
	 *      height: 50,
	 *      alpha: 1
	 * });
	 * */
	constructor(data = {}) {
		super();
		this.draw(data);
	}

	#previewTint = 0xff0000;

	draw(data) {
		const { alpha = 1, fill = 0xffffff, visible = true, x = 0, y = 0, zIndex = 10 } = data;
		this.beginFill(fill);
		this.shape(data);
		this.endFill();
		this.alpha = alpha;
		this.visible = visible;
		this.x = x;
		this.y = y;
		this.zIndex = zIndex;
	}

	shape({ height = 100, shape, vertices = [], width = 100 }) {
		const { BRUSH_TYPES } = canvas.simplefog;
		if (shape === BRUSH_TYPES.ELLIPSE) {
			this.drawEllipse(0, 0, width, height);
		} else if (shape === BRUSH_TYPES.BOX) {
			this.drawRect(0, 0, width, height);
		} else if (shape === BRUSH_TYPES.ROUNDED_RECT) {
			this.drawRoundedRect(0, 0, width, height, 10);
		} else if (shape === BRUSH_TYPES.POLYGON) {
			this.drawPolygon(vertices);
		}
	}
}
