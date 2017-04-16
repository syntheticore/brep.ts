/**
 * Rotation surface with r = f(z)
 */
class RotationReqFofZ extends Surface {
	l3axis: number
	FofR: (r:number) => number
	minZ: number
	maxZ: number

	constructor(l3Axis, FofR, minZ, maxZ) {
		super()
		assertInst(L3, l3Axis)
		this.l3Axis = l3Axis
		this.FofR = FofR
		this.minZ = minZ
		this.maxZ = maxZ
	}

	toMesh(zStart, zEnd, count) {
		let zInterval = zEnd - zStart, zStep = zInterval / (count - 1)
		let vertices = NLA.arrayFromFunction(count,
			i => {
				let z = zStart + i * zStep;
				return new V3(this.FofR(z), 0, z)
			})
		let normals = NLA.arrayFromFunction(count, i => {
			var z = zStart + i * zStep
			var fz = this.FofR(z)
			var dfz = (this.FofR(z + eps) - fz) / eps
			return new V3(1, 0, -dfz).unit()
		})
		let z = this.l3Axis.dir1, x = z.getPerpendicular().unit(), y = z.cross(x)
		let matrix = M4.forSys(x, y, z, this.l3Axis.anchor);
		vertices = matrix.transformedPoints(vertices)
		normals = matrix.inversed().transposed().transformedVectors(normals).map(v => v.unit())
		return GL.Mesh.rotation(vertices, this.l3Axis, 2 * Math.PI, 64, true, normals)
	}

	parametricFunction() {
		var z = this.l3Axis.dir1, x = z.getPerpendicular().unit(), y = z.cross(x)
		var matrix = M4.forSys(x, y, z, this.l3Axis.anchor)
		var f = this.FofR
		return function (d, z) {
			var radius = f(z)
			return matrix.transformPoint(new V3(radius * cos(d), radius * sin(d), z))
		}
	}

	parametricNormal() {
		var z = this.l3Axis.dir1, x = z.getPerpendicular().unit(), y = z.cross(x)
		var matrix = M4.forSys(x, y, z, this.l3Axis.anchor).inversed().transposed()
		return (d, z) => {
			var fz = this.FofR(z)
			var dfz = (this.FofR(z + eps) - fz) / eps
			return matrix.transformVector(new V3(cos(d), sin(d), -dfz)).unit()
		}
	}

	implicitFunction() {
		var z = this.l3Axis.dir1, x = z.getPerpendicular().unit(), y = z.cross(x)
		var matrix = M4.forSys(x, y, z, this.l3Axis.anchor)
		var matrixInverse = matrix.inversed()
		var f = this.FofR
		return function (pWC) {
			var p = matrixInverse.transformPoint(pWC)
			var radiusLC = Math.sqrt(p.x * p.x + p.y * p.y)
			return f(p.z) - radiusLC
		}
	}

	boundsFunction() {
		var z = this.l3Axis.dir1, x = z.getPerpendicular().unit(), y = z.cross(x)
		var matrix = M4.forSys(x, y, z, this.l3Axis.anchor)
		var matrixInverse = matrix.inversed()
		var f = this.FofR, minZ = this.minZ, maxZ = this.maxZ
		return function (pWC) {
			var z = matrixInverse.transformPoint(pWC).z
			return minZ <= z && z <= maxZ
		}
	}

	pointToParameterFunction(p) {
		var z = this.l3Axis.dir1, x = z.getPerpendicular().unit(), y = z.cross(x)
		var matrix = M4.forSys(x, y, z, this.l3Axis.anchor)
		var matrixInverse = matrix.inversed()
		var f = this.FofR
		return function (pWC) {
			var p = matrixInverse.transformPoint(pWC)
			return new V3(atan2(p.y, p.x), p.z, 0)
		}
	}

	/**
	 * @inheritDoc
	 */
	isCurvesWithSurface(surface2) {
		// prefer other surface to be the paramteric one
		if (surface2.parametricFunction) {
			return new PICurve(surface2, this)
		} else if (surface2.implicitFunction) {
			return new PICurve(this, surface2)
		}
	}
}