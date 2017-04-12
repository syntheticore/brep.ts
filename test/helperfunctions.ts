QUnit.assert.B2equals = function(actual, expected, message) {
	if (!(actual instanceof B2)) {
		this.push(false, actual, null, "actual is not a B2")
		return
	}

	this.equal(actual.faces.length, expected.faces.length, "no of faces")

	actual.faces.forEach(face => {
		if (!expected.faces.some(expectedFace => expectedFace.likeFace(face))) {
			this.ok(false, "Unexpected face in result:" + face.toSource())
		}
	})
}

QUnit.assert.fuzzyEquals = function(actual, expected, message) {
	this.push(NLA.eq(actual, expected), actual, expected, message)
}

function b2Equal(test, a, b, actual, expected) {

    linkB2(test, `a=${a.toSource()}&b=${b.toSource()}&c=${expected.translate(20, 0, 0).toSource()}'`, 'expected')
    linkB2(test, `a=${a.toSource()}&b=${b.toSource()}&c=${actual.translate(20, 0, 0).toSource()}`, 'actual')
    test.B2equals(actual, expected)
}


QUnit.assert.V3ArraysLike = function (actual, expected, message) {
	this.push(expected.every((v, i) => v.like(actual[i])), actual.toSource(), expected.toSource(), message)
}


function registerTests(o: { [key: string]: (assert: Assert) => void }) {
	for (const key in o) {
		QUnit.test(key, o[key])
	}
}
function linkB2(assert: Assert, link, msg = 'view') {
	//link = link.replace(/, /g, ',').replace(/[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/g, (numberStr) => {
	//	const f = parseFloat(numberStr), rd = NLA.round10(f, -7)
	//	return eq(f, rd) ? rd : f
	//})
	assert.ok(true, `<html><a href='brep2.html?${link}'>${msg}</a>`)
}
function linkB3(assert: Assert, values, msg = 'view') {
	const link = Object.getOwnPropertyNames(values).map(name => name + '=' + values[name].toSource()).join('&')
	linkB2(assert, link, msg)
}
function testISCurves(assert: Assert, surface1: Surface, surface2: Surface, curveCount: int) {
	const isCurves = surface1.isCurvesWithSurface(surface2)
	linkB2(assert, `meshes=[${surface1}.toMesh(), ${surface2}.toMesh()]&edges=${isCurves.map(c => Edge.forCurveAndTs(c)).sce}`)
	assert.equal(isCurves.length, curveCount, 'number of curves = ' +  curveCount)
	for (const curve of isCurves) {
		assert.ok(surface1.containsCurve(curve), 'surface1.containsCurve(curve) ' + surface1.str + ' ' + curve.str)
		assert.ok(surface2.containsCurve(curve), 'surface2.containsCurve(curve) ' + surface2.str + ' ' + curve.str)
		const t = curve.tMin || 0, p = curve.at(t), dp = curve.tangentAt(t)
		assert.ok(surface1.containsPoint(p), 'surface1.containsPoint(curve.at(curve.sMin))')
		assert.ok(surface2.containsPoint(p), 'surface2.containsPoint(curve.at(curve.tMax))')

		const pN1 = surface1.normalAt(p)
		const pN2 = surface2.normalAt(p)
		assert.ok(pN1.cross(pN2).isParallelTo(dp), 'pN1.cross(pN2).isParallelTo(dp)')
		assert.ok(pN1.cross(pN2).dot(dp) > 0, 'pN1.cross(pN2).dot(dp) > 0')
	}
}
function testZDirVolume(assert: Assert, face) {
	linkB2(assert, `mesh=${face.sce}.toMesh()`)
	const actual = face.zDirVolume().volume, expected = face.toMesh().calcVolume().volume
	assert.push(NLA.eq2(actual, expected, 0.1), actual, expected, "diff = " + (actual - expected))
}
function testCurve(ass: Assert, curve: Curve) {
	const STEPS = 12
	NLA.arrayFromFunction(STEPS, i => {
		const t = lerp(curve.tMin, curve.tMax, i / (STEPS - 1))
		const p = curve.at(t)
		ass.pushResult({
			result: eq(t, curve.pointT(p)),
			actual: curve.pointT(p),
			expected: t,
			message: 't eq pointT(at(t) for ' + t})
		ass.ok(curve.containsPoint(p), `containsPoint(at(t = ${t}) = ${p})`)
	})

	// test curve length
	if (curve.arcLength !== Curve.prototype.arcLength) {
		const expected = glqInSteps(t => curve.tangentAt(t).length(), curve.tMin, curve.tMax, 4)
		const actual = curve.arcLength(curve.tMin, curve.tMax)
		ass.pushResult({result: eq2(expected, actual, 1e-6), expected, actual, message: 'curve should have same length as the numericaly calculated value'})
	}
}

function testParametricSurface(ass: Assert, ps: Surface) {
	const params = [V(0.25, 0.25), V(0.6, 0.25), V(0.25, 0.6), V(0.6, 0.6)]
		.map(pm => new V3(lerp(ps.sMin, ps.sMax, pm.x), lerp(ps.tMin, ps.tMax, pm.y), 0))
	const points = params.map(({x, y}) => ps.parametricFunction()(x, y))
	const psFlipped = ps.flipped()
	for (let i = 0; i < points.length; i++) {
		const p = points[i], pNormal = ps.normalAt(p)
		ass.ok(ps.containsPoint(p))
		assert(ps.containsPoint(p))
		const psFlippedNormal = psFlipped.normalAt(p)
		ass.ok(psFlippedNormal.negated().like(pNormal))
		assert(psFlippedNormal.negated().like(pNormal))
		const pm = params[i]
		if (ps.parametricNormal) {
			const pmNormal = ps.parametricNormal()(pm.x, pm.y)
			ass.ok(pNormal.like(pmNormal))
			assert(pNormal.like(pmNormal))
		}
	}
	const matrices = [M4.mirroring(P3.XY), M4.mirroring(P3.YZ), M4.mirroring(P3.ZX)]
	for (let mI = 0; mI < matrices.length; mI++) {
		const m = matrices[mI]
		for (let i = 0; i < points.length; i++) {
			const p = points[i], pNormal = ps.normalAt(p)
			const normalMatrix = m.as3x3().inversed().transposed()
			const mNormal = normalMatrix.transformVector(pNormal)
			const mP = m.transformPoint(p)
			const mSurface = ps.transform(m)
			ass.ok(mSurface.normalAt(mP).like(mNormal))
			assert(mSurface.normalAt(mP).like(mNormal))

			ass.ok(mSurface.containsPoint(mP))
			assert(mSurface.containsPoint(mP))


			//const mPSFlipped = mSurface.flipped()
			//ass.ok(mPSFlipped.normalAt(mP).negated().like(mNormal))
			//assert(mPSFlipped.normalAt(mP).negated().like(mNormal))
		}
	}

}
function testCurveISInfos(assert: Assert, c1, c2, count, f = 'isInfosWithCurve') {
	const intersections = c1[f](c2).map(info => info.p)
	linkB3(assert, {edges: [c1, c2].map(c => Edge.forCurveAndTs(c)), points: intersections})
	assert.equal(intersections.length, count, `intersections.length == count: ${intersections.length} == ${count}`)
	intersections.forEach((is, i) => {
		assert.ok(intersections.every((is2, j) => j == i || !is.like(is2)), is.sce + ' is not unique ' + intersections)
		assert.ok(c1.containsPoint(is), `e1.containsPoint(is): ${c1.toSource()}.containsPoint(${is.sce},`)
		assert.ok(c2.containsPoint(is), `e2.containsPoint(is): ${c1.toSource()}.containsPoint(${is.sce},`)
	})
}
function testISTs(assert: Assert, curve: Curve, surface: Surface | P3, tCount: int) {
	surface instanceof P3 && (surface = new PlaneSurface(surface))
	const ists = curve instanceof L3 ? surface.isTsForLine(curve) : curve.isTsWithSurface(surface)
	const points = ists.map(t => curve.at(t))
	linkB2(assert, `meshes=[${surface}.toMesh()]&edges=[${Edge.forCurveAndTs(curve, curve.tMin, curve.tMax)}]&points=${points.sce}`)
	assert.equal(ists.length, tCount, 'number of curves = ' +  tCount)
	for (const t of ists) {
		const p = curve.at(t)
		assert.ok(surface.containsPoint(p), 'surface.containsPoint(p) ' + surface.str + ' ' + p.str
			+ ' t: ' + t
			+ ' dist: ' + surface.implicitFunction()(p))
	}
}

function testLoopContainsPoint(assert: Assert, surface: Surface, loop: Edge[], p: V3, result: PointVsFace) {
	!surface.edgeLoopCCW(loop) && (loop = Edge.reverseLoop(loop))
	linkB2(assert, `meshes=[${Face.create(surface, loop).sce}.toMesh()]&points=[${p.sce}]`)
	assert.equal(surface.loopContainsPoint(loop, p), result)
}