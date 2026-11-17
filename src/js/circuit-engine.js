(function () {
  "use strict";
  const host = typeof window !== "undefined" ? window : self;
  host.Analogverse = host.Analogverse || {};

  const supported = new Set(["R", "C", "L", "V", "I", "D", "NMOS", "PMOS", "GND"]);
  const nodeKeys = { R: ["p", "n"], C: ["p", "n"], L: ["p", "n"], V: ["p", "n"], I: ["p", "n"], D: ["a", "k"], NMOS: ["d", "g", "s"], PMOS: ["d", "g", "s"], GND: ["g"] };
  const thermalV = 0.02585;

  function finite(value, name) {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error((name || "Parameter") + " must be a finite number.");
    return n;
  }
  function nodeOf(element, key) { return String((element.nodes && element.nodes[key]) || "0"); }
  function nodesIn(elements) {
    const list = new Set();
    elements.forEach(function (e) { (nodeKeys[e.type] || []).forEach(function (key) { const n = nodeOf(e, key); if (n !== "0") list.add(n); }); });
    return Array.from(list).sort();
  }
  function validate(elements) {
    if (!Array.isArray(elements) || !elements.length) throw new Error("Add at least one component before running an analysis.");
    const ids = new Set();
    elements.forEach(function (e) {
      if (!supported.has(e.type)) throw new Error("Unsupported component " + e.type + " (" + (e.id || "unnamed") + ").");
      if (!e.id || ids.has(String(e.id))) throw new Error("Every component must have a unique, non-empty reference designator.");
      ids.add(String(e.id));
      (nodeKeys[e.type] || []).forEach(function (key) { if (!e.nodes || !String(e.nodes[key] || "").trim()) throw new Error(e.id + " terminal " + key + " has no electrical node."); });
      if (e.type === "GND" && nodeOf(e, "g") !== "0") throw new Error(e.id + " ground terminal must be assigned to node 0.");
      if (e.type === "R" && finite(e.value, e.id + " resistance") <= 0) throw new Error(e.id + " resistance must be greater than zero.");
      if ((e.type === "C" || e.type === "L") && finite(e.value, e.id + " value") <= 0) throw new Error(e.id + " value must be greater than zero.");
      if (e.type === "V" || e.type === "I") { finite(e.value, e.id + " source value"); finite(e.amplitude || 0, e.id + " amplitude"); finite(e.frequency || 0, e.id + " frequency"); finite(e.acMagnitude || 0, e.id + " AC magnitude"); if (e.wave && e.wave !== "dc" && Number(e.frequency || 0) <= 0) throw new Error(e.id + " waveform frequency must be positive."); }
      if ((e.type === "NMOS" || e.type === "PMOS") && (finite(e.kn, e.id + " Kn") <= 0 || finite(e.wl, e.id + " W/L") <= 0 || finite(e.vth, e.id + " VTH") < 0)) throw new Error(e.id + " needs Kn > 0, W/L > 0 and VTH ≥ 0.");
      if (e.type === "D" && (finite(e.is, e.id + " IS") <= 0 || finite(e.n, e.id + " ideality") <= 0)) throw new Error(e.id + " diode IS and ideality factor must be positive.");
    });
    if (!nodesIn(elements).length) throw new Error("The circuit has no non-ground node.");
  }
  function branchList(elements, mode) {
    return elements.filter(function (e) { return e.type === "V" || ((mode === "dc" || mode === "transient") && e.type === "L"); });
  }
  function nodeIndexMap(names) {
    const map = { "0": -1 };
    names.forEach(function (name, i) { map[name] = i; });
    return map;
  }
  function zeros(n) { return Array.from({ length: n }, function () { return 0; }); }
  function matrix(n) { return Array.from({ length: n }, function () { return zeros(n); }); }
  function addG(a, ni, p, n, g) {
    const i = ni[p], j = ni[n];
    if (i >= 0) a[i][i] += g;
    if (j >= 0) a[j][j] += g;
    if (i >= 0 && j >= 0) { a[i][j] -= g; a[j][i] -= g; }
  }
  function addI(b, ni, p, n, amps) {
    const i = ni[p], j = ni[n];
    if (i >= 0) b[i] -= amps;
    if (j >= 0) b[j] += amps;
  }
  function valueAt(element, mode, time) {
    const offset = Number(element.offset || 0), amp = Number(element.amplitude || 0), f = Math.max(Number(element.frequency || 0), 0), phase = Number(element.phase || 0) * Math.PI / 180;
    if (mode !== "transient") return Number(element.value || 0);
    if (element.wave === "sine") return offset + amp * Math.sin(2 * Math.PI * f * time + phase);
    if (element.wave === "square") return offset + amp * (Math.sin(2 * Math.PI * f * time + phase) >= 0 ? 1 : -1);
    if (element.wave === "triangle") return offset + amp * 2 / Math.PI * Math.asin(Math.sin(2 * Math.PI * f * time + phase));
    if (element.wave === "pulse") return offset + amp * (((time * f + phase / (2 * Math.PI)) % 1 + 1) % 1 < Number(element.duty || 0.5) ? 1 : 0);
    return Number(element.value || 0);
  }
  function channel(vgs, vds, beta, vth, lambda) {
    const ov = vgs - vth;
    if (ov <= 0 || vds <= 0) return { id: 0, gm: 0, gds: 0 };
    if (vds < ov) {
      const base = beta * (ov * vds - vds * vds / 2);
      return { id: base * (1 + lambda * vds), gm: beta * vds * (1 + lambda * vds), gds: beta * (ov - vds) * (1 + lambda * vds) + lambda * base };
    }
    const base = beta * ov * ov / 2;
    return { id: base * (1 + lambda * vds), gm: beta * ov * (1 + lambda * vds), gds: base * lambda };
  }
  function mosCurrent(element, vd, vg, vs) {
    const beta = Number(element.kn) * Number(element.wl), vth = Number(element.vth), lambda = Number(element.lambda || 0);
    if (element.type === "NMOS") return vd >= vs ? channel(vg - vs, vd - vs, beta, vth, lambda).id : -channel(vg - vd, vs - vd, beta, vth, lambda).id;
    return vd <= vs ? -channel(vs - vg, vs - vd, beta, vth, lambda).id : channel(vd - vg, vd - vs, beta, vth, lambda).id;
  }
  function mosPartials(element, vd, vg, vs) {
    const h = 1e-6;
    return {
      d: (mosCurrent(element, vd + h, vg, vs) - mosCurrent(element, vd - h, vg, vs)) / (2 * h),
      g: (mosCurrent(element, vd, vg + h, vs) - mosCurrent(element, vd, vg - h, vs)) / (2 * h),
      s: (mosCurrent(element, vd, vg, vs + h) - mosCurrent(element, vd, vg, vs - h)) / (2 * h)
    };
  }
  function diode(element, voltage) {
    const is = Number(element.is), nvt = Number(element.n || 1) * thermalV, exp = Math.exp(Math.max(-40, Math.min(40, voltage / nvt)));
    return { current: is * (exp - 1), g: is * exp / nvt };
  }
  function stampControlled(a, b, ni, d, g, s, current, partials) {
    const rowD = ni[d], rowS = ni[s], colD = ni[d], colG = ni[g], colS = ni[s];
    const eq = current - partials.d * readNode(b._guess, d) - partials.g * readNode(b._guess, g) - partials.s * readNode(b._guess, s);
    [[rowD, colD, partials.d], [rowD, colG, partials.g], [rowD, colS, partials.s], [rowS, colD, -partials.d], [rowS, colG, -partials.g], [rowS, colS, -partials.s]].forEach(function (entry) { if (entry[0] >= 0 && entry[1] >= 0) a[entry[0]][entry[1]] += entry[2]; });
    if (rowD >= 0) b[rowD] -= eq;
    if (rowS >= 0) b[rowS] += eq;
  }
  function readNode(values, name) { return name === "0" ? 0 : Number(values[name] || 0); }
  function assembleReal(elements, ctx, guesses) {
    const names = nodesIn(elements), ni = nodeIndexMap(names), branches = branchList(elements, ctx.mode), bIndex = new Map();
    branches.forEach(function (e, i) { bIndex.set(e.id, names.length + i); });
    const n = names.length + branches.length, a = matrix(n), b = zeros(n), prev = ctx.prevNodes || { "0": 0 };
    b._guess = guesses;
    elements.forEach(function (e) {
      const type = e.type;
      if (type === "GND") return;
      if (type === "R") { addG(a, ni, nodeOf(e, "p"), nodeOf(e, "n"), 1 / Number(e.value)); return; }
      if (type === "C") {
        if (ctx.mode === "transient") { const g = Number(e.value) / ctx.dt, p = nodeOf(e, "p"), q = nodeOf(e, "n"), vp = readNode(prev, p) - readNode(prev, q); addG(a, ni, p, q, g); addI(b, ni, p, q, -g * vp); }
        return;
      }
      if (type === "L") {
        const k = bIndex.get(e.id), p = ni[nodeOf(e, "p")], q = ni[nodeOf(e, "n")];
        if (p >= 0) { a[p][k] += 1; a[k][p] += 1; }
        if (q >= 0) { a[q][k] -= 1; a[k][q] -= 1; }
        if (ctx.mode === "transient") { a[k][k] -= Number(e.value) / ctx.dt; b[k] -= Number(e.value) / ctx.dt * Number((ctx.prevBranches || {})[e.id] || 0); }
        return;
      }
      if (type === "V") {
        const k = bIndex.get(e.id), p = ni[nodeOf(e, "p")], q = ni[nodeOf(e, "n")];
        if (p >= 0) { a[p][k] += 1; a[k][p] += 1; }
        if (q >= 0) { a[q][k] -= 1; a[k][q] -= 1; }
        b[k] = valueAt(e, ctx.mode, ctx.time || 0);
        return;
      }
      if (type === "I") { addI(b, ni, nodeOf(e, "p"), nodeOf(e, "n"), valueAt(e, ctx.mode, ctx.time || 0)); return; }
      if (type === "D") {
        const p = nodeOf(e, "a"), q = nodeOf(e, "k"), v = readNode(guesses, p) - readNode(guesses, q), model = diode(e, v), ieq = model.current - model.g * v;
        addG(a, ni, p, q, model.g); addI(b, ni, p, q, ieq); return;
      }
      if (type === "NMOS" || type === "PMOS") {
        const d = nodeOf(e, "d"), g = nodeOf(e, "g"), s = nodeOf(e, "s"), vd = readNode(guesses, d), vg = readNode(guesses, g), vs = readNode(guesses, s);
        stampControlled(a, b, ni, d, g, s, mosCurrent(e, vd, vg, vs), mosPartials(e, vd, vg, vs));
      }
    });
    delete b._guess;
    return { a: a, b: b, names: names, nodeIndex: ni, branches: branches, branchIndex: bIndex, dimension: n };
  }
  function solveLinear(a, b) {
    const n = b.length, m = a.map(function (row, i) { return row.slice().concat([b[i]]); });
    for (let k = 0; k < n; k++) {
      let pivot = k;
      for (let r = k + 1; r < n; r++) if (Math.abs(m[r][k]) > Math.abs(m[pivot][k])) pivot = r;
      if (Math.abs(m[pivot][k]) < 1e-18) throw new Error("MNA matrix is singular. Check ground and floating nodes.");
      if (pivot !== k) { const temp = m[k]; m[k] = m[pivot]; m[pivot] = temp; }
      const divisor = m[k][k];
      for (let j = k; j <= n; j++) m[k][j] /= divisor;
      for (let i = 0; i < n; i++) if (i !== k) { const factor = m[i][k]; if (factor !== 0) for (let j = k; j <= n; j++) m[i][j] -= factor * m[k][j]; }
    }
    return m.map(function (row) { return row[n]; });
  }
  function decodeReal(elements, system, x, ctx) {
    const nodes = { "0": 0 }, branches = {}, components = {};
    system.names.forEach(function (name, i) { nodes[name] = x[i]; });
    system.branches.forEach(function (e) { branches[e.id] = x[system.branchIndex.get(e.id)]; });
    elements.forEach(function (e) {
      if (e.type === "GND") return;
      let p, n, v, i, pwr;
      if (e.type === "NMOS" || e.type === "PMOS") {
        p = nodeOf(e, "d"); n = nodeOf(e, "s"); v = readNode(nodes, p) - readNode(nodes, n); i = mosCurrent(e, readNode(nodes, p), readNode(nodes, nodeOf(e, "g")), readNode(nodes, n));
      } else {
        const pk = e.type === "D" ? "a" : "p", nk = e.type === "D" ? "k" : "n"; p = nodeOf(e, pk); n = nodeOf(e, nk); v = readNode(nodes, p) - readNode(nodes, n);
        if (e.type === "R") i = v / Number(e.value);
        else if (e.type === "C") i = ctx.mode === "transient" ? Number(e.value) * (v - (readNode(ctx.prevNodes || {}, p) - readNode(ctx.prevNodes || {}, n))) / ctx.dt : 0;
        else if (e.type === "L" || e.type === "V") i = Number(branches[e.id] || 0);
        else if (e.type === "I") i = valueAt(e, ctx.mode, ctx.time || 0);
        else i = diode(e, v).current;
      }
      pwr = v * i;
      components[e.id] = { voltage: v, current: i, power: pwr };
    });
    return { nodes: nodes, branches: branches, components: components };
  }
  function solveNewton(elements, ctx, initial) {
    const names = nodesIn(elements); let guess = Object.assign({ "0": 0 }, initial || {}), lastSystem, x = [];
    let converged = false, iterations = 0;
    for (iterations = 1; iterations <= 80; iterations++) {
      const system = assembleReal(elements, ctx, guess); lastSystem = system; x = solveLinear(system.a, system.b);
      let maxV = 0;
      names.forEach(function (name, i) { maxV = Math.max(maxV, Math.abs(x[i] - readNode(guess, name))); });
      guess = { "0": 0 };
      names.forEach(function (name, i) { guess[name] = x[i]; });
      if (maxV < 1e-9) { converged = true; break; }
    }
    const decoded = decodeReal(elements, lastSystem, x, ctx);
    return Object.assign(decoded, { converged: converged, iterations: Math.min(iterations, 80), error: converged ? null : "Newton-Raphson did not meet the voltage tolerance in 80 iterations.", nodes: decoded.nodes });
  }
  function seedNodes(elements) {
    const names = nodesIn(elements), sources = elements.filter(function (e) { return e.type === "V"; });
    const rail = sources.reduce(function (max, e) { return Math.max(max, Math.abs(Number(e.value || 0))); }, 1);
    const seed = rail / 2, out = { "0": 0 }, fixed = new Set(["0"]);
    names.forEach(function (name) { out[name] = seed; });
    sources.forEach(function (e) { const p = nodeOf(e, "p"), n = nodeOf(e, "n"), value = Number(e.value || 0); if (n === "0" && p !== "0") { out[p] = value; fixed.add(p); } else if (p === "0" && n !== "0") { out[n] = -value; fixed.add(n); } });
    // Start MOS source nodes on the conducting side of the square-law region.
    // This avoids a zero-derivative first Jacobian for tail-current circuits.
    elements.forEach(function (e) {
      if ((e.type === "NMOS" || e.type === "PMOS") && !fixed.has(nodeOf(e, "s"))) out[nodeOf(e, "s")] = e.type === "NMOS" ? 0 : rail;
    });
    return out;
  }
  function solveDC(elements) {
    try { validate(elements); return solveNewton(elements, { mode: "dc", time: 0 }, seedNodes(elements)); }
    catch (error) { return { converged: false, iterations: 0, error: error.message, nodes: {}, branches: {}, components: {} }; }
  }
  function solveTransient(elements, options) {
    try {
      validate(elements);
      const stop = finite(options.tStop, "Stop time"), dt = finite(options.dt, "Time step");
      if (stop <= 0 || dt <= 0) throw new Error("Stop time and time step must be positive.");
      const steps = Math.ceil(stop / dt);
      if (steps > 10000) throw new Error("Transient request exceeds 10,000 steps. Increase the time step or shorten the stop time.");
      let time = 0, nodes = { "0": 0 }, branches = {}, guess = seedNodes(elements), points = [{ t: 0, nodes: nodes, branches: {}, components: {} }], iterations = 0;
      for (let k = 1; k <= steps; k++) {
        const nextTime = Math.min(k * dt, stop), localDt = nextTime - time;
        const result = solveNewton(elements, { mode: "transient", time: nextTime, dt: localDt, prevNodes: nodes, prevBranches: branches }, guess);
        if (!result.converged) return { converged: false, error: result.error, iterations: iterations + result.iterations, points: points };
        iterations += result.iterations; nodes = result.nodes; branches = result.branches; guess = nodes; time = nextTime;
        points.push({ t: time, nodes: nodes, branches: branches, components: result.components });
      }
      return { converged: true, iterations: iterations, points: points, error: null };
    } catch (error) { return { converged: false, error: error.message, iterations: 0, points: [] }; }
  }
  function c(re, im) { return { re: re, im: im || 0 }; }
  function cadd(a, b) { return c(a.re + b.re, a.im + b.im); }
  function csub(a, b) { return c(a.re - b.re, a.im - b.im); }
  function cmul(a, b) { return c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re); }
  function cdiv(a, b) { const d = b.re * b.re + b.im * b.im || 1e-30; return c((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); }
  function cmat(n) { return Array.from({ length: n }, function () { return Array.from({ length: n }, function () { return c(0, 0); }); }); }
  function cb(n) { return Array.from({ length: n }, function () { return c(0, 0); }); }
  function addCY(a, ni, p, n, y) {
    const i = ni[p], j = ni[n];
    if (i >= 0) a[i][i] = cadd(a[i][i], y);
    if (j >= 0) a[j][j] = cadd(a[j][j], y);
    if (i >= 0 && j >= 0) { a[i][j] = csub(a[i][j], y); a[j][i] = csub(a[j][i], y); }
  }
  function addCI(b, ni, p, n, i) { const a = ni[p], z = ni[n]; if (a >= 0) b[a] = csub(b[a], i); if (z >= 0) b[z] = cadd(b[z], i); }
  function solveComplex(a, b) {
    const n = b.length, r = matrix(2 * n), d = zeros(2 * n);
    for (let i = 0; i < n; i++) {
      d[i] = b[i].re; d[i + n] = b[i].im;
      for (let j = 0; j < n; j++) { r[i][j] = a[i][j].re; r[i][j + n] = -a[i][j].im; r[i + n][j] = a[i][j].im; r[i + n][j + n] = a[i][j].re; }
    }
    const x = solveLinear(r, d);
    return Array.from({ length: n }, function (_, i) { return c(x[i], x[i + n]); });
  }
  function acAt(elements, dc, frequency) {
    const names = nodesIn(elements), ni = nodeIndexMap(names), sources = elements.filter(function (e) { return e.type === "V"; }), bi = new Map();
    sources.forEach(function (e, i) { bi.set(e.id, names.length + i); });
    const n = names.length + sources.length, a = cmat(n), b = cb(n), w = 2 * Math.PI * frequency;
    elements.forEach(function (e) {
      if (e.type === "GND") return;
      if (e.type === "R") { addCY(a, ni, nodeOf(e, "p"), nodeOf(e, "n"), c(1 / Number(e.value), 0)); return; }
      if (e.type === "C") { addCY(a, ni, nodeOf(e, "p"), nodeOf(e, "n"), c(0, w * Number(e.value))); return; }
      if (e.type === "L") { addCY(a, ni, nodeOf(e, "p"), nodeOf(e, "n"), c(0, -1 / (w * Number(e.value)))); return; }
      if (e.type === "V") {
        const k = bi.get(e.id), p = ni[nodeOf(e, "p")], q = ni[nodeOf(e, "n")];
        if (p >= 0) { a[p][k] = cadd(a[p][k], c(1)); a[k][p] = cadd(a[k][p], c(1)); }
        if (q >= 0) { a[q][k] = csub(a[q][k], c(1)); a[k][q] = csub(a[k][q], c(1)); }
        const mag = Number(e.acMagnitude || 0), angle = Number(e.acPhase || 0) * Math.PI / 180; b[k] = c(mag * Math.cos(angle), mag * Math.sin(angle)); return;
      }
      if (e.type === "I") { const mag = Number(e.acMagnitude || 0), angle = Number(e.acPhase || 0) * Math.PI / 180; addCI(b, ni, nodeOf(e, "p"), nodeOf(e, "n"), c(mag * Math.cos(angle), mag * Math.sin(angle))); return; }
      if (e.type === "D") { const v = readNode(dc.nodes, nodeOf(e, "a")) - readNode(dc.nodes, nodeOf(e, "k")); addCY(a, ni, nodeOf(e, "a"), nodeOf(e, "k"), c(diode(e, v).g, 0)); return; }
      if (e.type === "NMOS" || e.type === "PMOS") {
        const d = nodeOf(e, "d"), g = nodeOf(e, "g"), s = nodeOf(e, "s"), pd = mosPartials(e, readNode(dc.nodes, d), readNode(dc.nodes, g), readNode(dc.nodes, s));
        const rd = ni[d], rg = ni[g], rs = ni[s];
        [[rd, rd, pd.d], [rd, rg, pd.g], [rd, rs, pd.s], [rs, rd, -pd.d], [rs, rg, -pd.g], [rs, rs, -pd.s]].forEach(function (x) { if (x[0] >= 0 && x[1] >= 0) a[x[0]][x[1]] = cadd(a[x[0]][x[1]], c(x[2])); });
      }
    });
    const x = solveComplex(a, b), nodes = { "0": c(0, 0) }, branches = {};
    names.forEach(function (name, i) { nodes[name] = x[i]; });
    sources.forEach(function (e) { branches[e.id] = x[bi.get(e.id)]; });
    const components = {};
    elements.forEach(function (e) {
      if (e.type === "GND") return;
      let p, n, v, i;
      if (e.type === "NMOS" || e.type === "PMOS") { p = nodeOf(e, "d"); n = nodeOf(e, "s"); v = csub(nodes[p], nodes[n]); const g=nodeOf(e,"g"),pd=mosPartials(e,readNode(dc.nodes,p),readNode(dc.nodes,g),readNode(dc.nodes,n));i=cadd(cadd(cmul(c(pd.d),nodes[p]),cmul(c(pd.g),nodes[g])),cmul(c(pd.s),nodes[n])); }
      else { p = e.type === "D" ? nodeOf(e, "a") : nodeOf(e, "p"); n = e.type === "D" ? nodeOf(e, "k") : nodeOf(e, "n"); v = csub(nodes[p], nodes[n]);
        if (e.type === "R") i = c(v.re / Number(e.value), v.im / Number(e.value));
        else if (e.type === "C") i = cmul(c(0, w * Number(e.value)), v);
        else if (e.type === "L") i = cmul(c(0, -1 / (w * Number(e.value))), v);
        else if (e.type === "V") i = branches[e.id];
        else if (e.type === "I") { const m=Number(e.acMagnitude||0),a0=Number(e.acPhase||0)*Math.PI/180;i=c(m*Math.cos(a0),m*Math.sin(a0)); }
        else { const dcV=readNode(dc.nodes,p)-readNode(dc.nodes,n);i=cmul(c(diode(e,dcV).g),v); }
      }
      components[e.id] = { voltage: v, current: i, magnitude: Math.hypot(v.re,v.im), currentMagnitude: Math.hypot(i.re,i.im), phase: Math.atan2(v.im,v.re) * 180 / Math.PI };
    });
    return { frequency: frequency, nodes: nodes, branches: branches, components: components };
  }
  function solveAC(elements, frequencies) {
    const dc = solveDC(elements);
    if (!dc.converged) return { converged: false, error: "AC linearization needs a valid DC operating point: " + dc.error, dc: dc, points: [] };
    try {
      const points = frequencies.map(function (f) { if (!(Number(f) > 0)) throw new Error("AC frequencies must be positive."); return acAt(elements, dc, Number(f)); });
      return { converged: true, error: null, dc: dc, points: points };
    } catch (error) { return { converged: false, error: error.message, dc: dc, points: [] }; }
  }
  function runValidation() {
    function errorPct(actual, expected) { return Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-12) * 100; }
    const tests = [];
    const divider = solveDC([
      { id: "V1", type: "V", nodes: { p: "vin", n: "0" }, value: 12 },
      { id: "R1", type: "R", nodes: { p: "vin", n: "out" }, value: 2000 },
      { id: "R2", type: "R", nodes: { p: "out", n: "0" }, value: 1000 }
    ]);
    tests.push({ name: "Voltage divider", expected: 4, actual: divider.nodes.out, unit: "V", errorPercent: errorPct(divider.nodes.out, 4), passed: divider.converged && errorPct(divider.nodes.out, 4) < 0.01, convergence: divider.converged, explanation: "12 V through 2 kΩ / 1 kΩ divider; VOUT = 12 × 1/(2+1)." });
    const rc = [
      { id: "V1", type: "V", nodes: { p: "vin", n: "0" }, value: 1, acMagnitude: 1 },
      { id: "R1", type: "R", nodes: { p: "vin", n: "out" }, value: 1000 },
      { id: "C1", type: "C", nodes: { p: "out", n: "0" }, value: 1e-6 }
    ];
    const transient = solveTransient(rc, { tStop: 0.005, dt: 1e-5 }), rcExpected = 1 - Math.exp(-0.001 / 0.001), rcPoint = transient.points.reduce(function (best, p) { return Math.abs(p.t - 0.001) < Math.abs(best.t - 0.001) ? p : best; }, transient.points[0]);
    tests.push({ name: "RC step at 1τ", expected: rcExpected, actual: rcPoint && rcPoint.nodes.out, unit: "V", errorPercent: errorPct(rcPoint && rcPoint.nodes.out, rcExpected), passed: transient.converged && errorPct(rcPoint.nodes.out, rcExpected) < 2, convergence: transient.converged, explanation: "1 kΩ × 1 µF gives τ = 1 ms; backward-Euler step result compared with 1 − exp(−t/τ)." });
    const rl = solveTransient([
      { id: "V1", type: "V", nodes: { p: "in", n: "0" }, value: 1 },
      { id: "R1", type: "R", nodes: { p: "in", n: "out" }, value: 10 },
      { id: "L1", type: "L", nodes: { p: "out", n: "0" }, value: 0.001 }
    ], { tStop: 1e-4, dt: 1e-6 }), rlPoint = rl.points[rl.points.length - 1], rlExpected = 0.1 * (1 - Math.exp(-1)), rlActual = rlPoint && rlPoint.branches.L1;
    tests.push({ name: "RL step at 1τ", expected: rlExpected, actual: rlActual, unit: "A", errorPercent: errorPct(rlActual, rlExpected), passed: rl.converged && errorPct(rlActual, rlExpected) < 0.5, convergence: rl.converged, explanation: "L/R = 100 µs; backward-Euler inductor current compared with 0.1 × (1 − exp(−t/τ)) A." });
    const fc = 1 / (2 * Math.PI * 1000 * 1e-6), ac = solveAC(rc, [fc]), acNode = ac.points[0] && ac.points[0].nodes.out, acGain = acNode ? Math.hypot(acNode.re, acNode.im) : NaN, acExpected = 1 / Math.sqrt(2);
    tests.push({ name: "RC cutoff frequency", expected: acExpected, actual: acGain, unit: "V/V", errorPercent: errorPct(acGain, acExpected), passed: ac.converged && errorPct(acGain, acExpected) < 0.1, convergence: ac.converged, explanation: "fC = 1/(2πRC); first-order low-pass magnitude at fC is 1/√2." });
    const rectifier = [
      { id: "VS", type: "V", nodes: { p: "src", n: "0" }, value: 0, wave: "sine", amplitude: 5, frequency: 50 },
      { id: "D1", type: "D", nodes: { a: "src", k: "out" }, is: 1e-12, n: 1 },
      { id: "RL", type: "R", nodes: { p: "out", n: "0" }, value: 1000 }
    ], rectifierResult = solveTransient(rectifier, { tStop: 0.01, dt: 2e-5 });
    let lo = 0, hi = 5;
    for (let i = 0; i < 80; i++) { const v = (lo + hi) / 2, id = 1e-12 * (Math.exp((5 - v) / thermalV) - 1), il = v / 1000; if (id > il) lo = v; else hi = v; }
    const rectifierExpected = (lo + hi) / 2, rectifierPeak = rectifierResult.points.reduce(function (best, p) { return Number(p.nodes.out || 0) > Number(best.nodes.out || 0) ? p : best; }, rectifierResult.points[0]);
    tests.push({ name: "Diode half-wave rectifier", expected: rectifierExpected, actual: rectifierPeak.nodes.out, unit: "V peak", errorPercent: errorPct(rectifierPeak.nodes.out, rectifierExpected), passed: rectifierResult.converged && errorPct(rectifierPeak.nodes.out, rectifierExpected) < 0.1, convergence: rectifierResult.converged, explanation: "Peak output is compared with the diode Shockley equation and 1 kΩ load-line solution at a 5 V input peak." });
    const f0 = 1 / (2 * Math.PI * Math.sqrt(0.01 * 1e-6)), rlc = [
      { id: "V1", type: "V", nodes: { p: "src", n: "0" }, value: 0, acMagnitude: 1 },
      { id: "R1", type: "R", nodes: { p: "src", n: "n1" }, value: 10 },
      { id: "L1", type: "L", nodes: { p: "n1", n: "n2" }, value: 0.01 },
      { id: "C1", type: "C", nodes: { p: "n2", n: "0" }, value: 1e-6 }
    ], rlcAc = solveAC(rlc, [f0 / 2, f0, f0 * 2]), peakCurrent = rlcAc.points[1] && rlcAc.points[1].branches.V1 ? Math.hypot(rlcAc.points[1].branches.V1.re, rlcAc.points[1].branches.V1.im) : NaN;
    const rlcExpected = 1 / 10;
    tests.push({ name: "Series RLC resonance", expected: rlcExpected, actual: peakCurrent, unit: "A at 1 V", errorPercent: errorPct(peakCurrent, rlcExpected), passed: rlcAc.converged && peakCurrent >= Math.hypot(rlcAc.points[0].branches.V1.re, rlcAc.points[0].branches.V1.im) && peakCurrent >= Math.hypot(rlcAc.points[2].branches.V1.re, rlcAc.points[2].branches.V1.im) && errorPct(peakCurrent, rlcExpected) < 0.01, convergence: rlcAc.converged, explanation: "At f0 = 1/(2π√LC), series reactances cancel and source current is 1/R for a 1 V AC source." });
    const mos = solveDC([
      { id: "VDD", type: "V", nodes: { p: "vdd", n: "0" }, value: 5 },
      { id: "RD", type: "R", nodes: { p: "vdd", n: "drain" }, value: 1000 },
      { id: "VG", type: "V", nodes: { p: "gate", n: "0" }, value: 2 },
      { id: "M1", type: "NMOS", nodes: { d: "drain", g: "gate", s: "0" }, kn: 0.002, wl: 1, vth: 1, lambda: 0 }
    ]), mosExpected = 0.001;
    tests.push({ name: "MOSFET DC operating point", expected: mosExpected, actual: mos.components.M1 && mos.components.M1.current, unit: "A", errorPercent: errorPct(mos.components.M1 && mos.components.M1.current, mosExpected), passed: mos.converged && errorPct(mos.components.M1.current, mosExpected) < 0.1, convergence: mos.converged, explanation: "Kn = 2 mA/V², W/L = 1, VOV = 1 V gives ID = ½KnVOV² = 1 mA; RD leaves 4 V VDS." });
    const csCircuit = [
      { id: "VDD", type: "V", nodes: { p: "vdd", n: "0" }, value: 5 },
      { id: "VG", type: "V", nodes: { p: "gate", n: "0" }, value: 2, acMagnitude: 1 },
      { id: "RD", type: "R", nodes: { p: "vdd", n: "out" }, value: 1000 },
      { id: "RL", type: "R", nodes: { p: "out", n: "0" }, value: 10000 },
      { id: "M1", type: "NMOS", nodes: { d: "out", g: "gate", s: "0" }, kn: 0.002, wl: 1, vth: 1, lambda: 0.02 }
    ], csAc = solveAC(csCircuit, [1000]), csOut = csAc.points[0] && csAc.points[0].nodes.out, csQ = csAc.dc, csPartials = mosPartials(csCircuit[4], csQ.nodes.out, csQ.nodes.gate, 0), csExpected = -csPartials.g / (1 / 1000 + 1 / 10000 + csPartials.d), csActual = csOut && csOut.re;
    tests.push({ name: "Common-source small-signal gain", expected: csExpected, actual: csActual, unit: "V/V", errorPercent: errorPct(csActual, csExpected), passed: csAc.converged && csExpected < 0 && csActual < 0 && errorPct(csActual, csExpected) < 0.1, convergence: csAc.converged, explanation: "MNA AC result compared with −gm/(1/RD + 1/RL + gds) at the solved MOSFET operating point." });
    const mirror = solveDC([
      { id: "VDD", type: "V", nodes: { p: "vdd", n: "0" }, value: 5 },
      { id: "IREF", type: "I", nodes: { p: "vdd", n: "nref" }, value: 0.001 },
      { id: "MREF", type: "NMOS", nodes: { d: "nref", g: "nref", s: "0" }, kn: 0.002, wl: 1, vth: 0.5, lambda: 0 },
      { id: "VOUT", type: "V", nodes: { p: "out", n: "0" }, value: 3 },
      { id: "MOUT", type: "NMOS", nodes: { d: "out", g: "nref", s: "0" }, kn: 0.002, wl: 2, vth: 0.5, lambda: 0 }
    ]), mirrorActual = mirror.components.MOUT && mirror.components.MOUT.current, mirrorExpected = 0.002;
    tests.push({ name: "Current mirror ratio", expected: mirrorExpected, actual: mirrorActual, unit: "A", errorPercent: errorPct(mirrorActual, mirrorExpected), passed: mirror.converged && errorPct(mirrorActual, mirrorExpected) < 0.1, convergence: mirror.converged, explanation: "Two matched square-law NMOS devices with a 2:1 geometry ratio; output held above compliance." });
    const pair = solveDC([
      { id: "VDD", type: "V", nodes: { p: "vdd", n: "0" }, value: 5 },
      { id: "VIN1", type: "V", nodes: { p: "in1", n: "0" }, value: 1.5 },
      { id: "VIN2", type: "V", nodes: { p: "in2", n: "0" }, value: 1.5 },
      { id: "RD1", type: "R", nodes: { p: "vdd", n: "out1" }, value: 5000 },
      { id: "RD2", type: "R", nodes: { p: "vdd", n: "out2" }, value: 5000 },
      { id: "M1", type: "NMOS", nodes: { d: "out1", g: "in1", s: "tail" }, kn: 0.002, wl: 2, vth: 0.5, lambda: 0.01 },
      { id: "M2", type: "NMOS", nodes: { d: "out2", g: "in2", s: "tail" }, kn: 0.002, wl: 2, vth: 0.5, lambda: 0.01 },
      { id: "ITAIL", type: "I", nodes: { p: "tail", n: "0" }, value: 0.001 }
    ]), pairExpected = 0.0005, pairActual = pair.components.M1 && pair.components.M1.current;
    tests.push({ name: "Balanced differential pair", expected: pairExpected, actual: pairActual, unit: "A per branch", errorPercent: errorPct(pairActual, pairExpected), passed: pair.converged && errorPct(pairActual, pairExpected) < 0.1 && errorPct(pair.components.M2.current, pairExpected) < 0.1, convergence: pair.converged, explanation: "Equal gate voltages split a 1 mA tail current equally between matched NMOS branches." });
    function cmosAt(vin) { return solveDC([
      { id: "VDD", type: "V", nodes: { p: "vdd", n: "0" }, value: 5 },
      { id: "VIN", type: "V", nodes: { p: "vin", n: "0" }, value: vin },
      { id: "MN", type: "NMOS", nodes: { d: "out", g: "vin", s: "0" }, kn: 0.002, wl: 4, vth: 0.7, lambda: 0.01 },
      { id: "MP", type: "PMOS", nodes: { d: "out", g: "vin", s: "vdd" }, kn: 0.002, wl: 4, vth: 0.7, lambda: 0.01 }
    ]); }
    const cmosLow = cmosAt(0), cmosHigh = cmosAt(5), cmosError = Math.max(errorPct(cmosLow.nodes.out, 5), errorPct(cmosHigh.nodes.out, 0));
    tests.push({ name: "CMOS inverter endpoints", expected: 5, actual: cmosLow.nodes.out, unit: "V at VIN=0 V", errorPercent: cmosError, passed: cmosLow.converged && cmosHigh.converged && cmosError < 0.01, convergence: cmosLow.converged && cmosHigh.converged, explanation: "MNA DC solutions check rail-to-rail switching at VIN=0 V and VIN=VDD." });
    const opModel = host.Analogverse.CircuitModels;
    if (opModel && opModel.opAmpTransfer) {
      const feedback = opModel.opAmpTransfer({ aol: 100000, gbw: 1000000, mode: "noninv", rin: 10, rf: 90 }, 1), feedbackGain = Math.hypot(feedback.closed.re, feedback.closed.im);
      tests.push({ name: "Non-inverting op-amp gain", expected: 10, actual: feedbackGain, unit: "V/V", errorPercent: errorPct(feedbackGain, 10), passed: errorPct(feedbackGain, 10) < 0.1, convergence: true, explanation: "Finite-A0 feedback model compared with ideal 1 + RF/RIN gain at low frequency." });
    } else tests.push({ name: "Non-inverting op-amp gain", expected: 10, actual: NaN, unit: "V/V", errorPercent: NaN, passed: false, convergence: false, explanation: "The feedback model module is unavailable." });
    return tests;
  }
  host.Analogverse.CircuitEngine = { supported: Array.from(supported), solveDC: solveDC, solveTransient: solveTransient, solveAC: solveAC, runValidation: runValidation, valueAt: valueAt };
}());
