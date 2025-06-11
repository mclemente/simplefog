// CWSP which ignores open doors

export class CWSPNoDoors extends foundry.canvas.geometry.ClockwiseSweepPolygon {
	_testEdgeInclusion(edge, edgeTypes) {
		const { type, boundaryShapes, useThreshold, wallDirectionMode, externalRadius } = this.config;

		// Only include edges of the appropriate type
		const edgeType = edgeTypes[edge.type];
		const m = edgeType?.mode;
		if ( !m ) return false;
		if ( m === 2 ) return true;

		// Exclude edges with a lower priority than required for this polygon
		if ( edge.priority < edgeType.priority ) return false;

		// Specific boundary shapes may impose additional requirements
		for ( const shape of boundaryShapes ) {
			if ( shape._includeEdge && !shape._includeEdge(edge.a, edge.b) ) return false;
		}

		// Ignore edges which do not block this polygon type
		const isOpenDoor = edge.type === "wall" && edge.object.isOpen;
		if ( (this.config.shiftKey || !isOpenDoor) && edge[type] === CONST.WALL_SENSE_TYPES.NONE ) return false;

		// Ignore edges which are collinear with the origin
		const side = edge.orientPoint(this.origin);
		if ( !side ) return false;

		// Ignore one-directional walls which are facing away from the origin
		const wdm = foundry.canvas.geometry.PointSourcePolygon.WALL_DIRECTION_MODES;
		if ( edge.direction && (wallDirectionMode !== wdm.BOTH) ) {
			if ( (wallDirectionMode === wdm.NORMAL) === (side === edge.direction) ) return false;
		}

		// Ignore threshold walls which do not satisfy their required proximity
		if ( useThreshold ) return !edge.applyThreshold(type, this.origin, externalRadius);
		return true;
	}
}
