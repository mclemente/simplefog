// CWSP which ignores open doors

export class CWSPNoDoors extends ClockwiseSweepPolygon {
	_testEdgeInclusion(edge, edgeTypes, bounds) {
		const { type, boundaryShapes, useThreshold, wallDirectionMode, externalRadius } = this.config;

		// Only include edges of the appropriate type
		const m = edgeTypes[edge.type];
		if ( !m ) return false;
		if ( m === 2 ) return true;

		// Test for inclusion in the overall bounding box
		//if ( !bounds.lineSegmentIntersects(edge.a, edge.b, { inside: true }) ) return false;

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
		const wdm = PointSourcePolygon.WALL_DIRECTION_MODES;
		if ( edge.direction && (wallDirectionMode !== wdm.BOTH) ) {
			if ( (wallDirectionMode === wdm.NORMAL) === (side === edge.direction) ) return false;
		}

		// Ignore threshold walls which do not satisfy their required proximity
		if ( useThreshold ) return !edge.applyThreshold(type, this.origin, externalRadius);
		return true;
	}
}
