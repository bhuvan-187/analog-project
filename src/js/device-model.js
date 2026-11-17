(function () {
  "use strict";
  window.Analogverse = window.Analogverse || {};

  function effectiveBeta(params) {
    return Number(params.knMilli) * 1e-3 * Number(params.wl);
  }

  function current(vgMag, vdMag, params) {
    const vth = Number(params.vth);
    const vov = vgMag - vth;
    const vds = Math.max(0, vdMag);
    const beta = effectiveBeta(params);
    const lambda = Number(params.lambda);
    if (vov <= 0 || vds <= 0 || beta <= 0) {
      return { id: 0, gm: 0, gds: 0, vov: Math.max(vov, 0), region: "Cutoff", beta: beta, base: 0 };
    }
    if (vds >= vov) {
      const base = 0.5 * beta * vov * vov;
      const id = base * (1 + lambda * vds);
      const gm = beta * vov * (1 + lambda * vds);
      const gds = base * lambda;
      return { id: id, gm: gm, gds: gds, vov: vov, region: "Saturation", beta: beta, base: base };
    }
    const base = beta * (vov * vds - 0.5 * vds * vds);
    const id = base * (1 + lambda * vds);
    const gm = beta * vds * (1 + lambda * vds);
    const gds = beta * (vov - vds) * (1 + lambda * vds) + lambda * base;
    return { id: id, gm: gm, gds: gds, vov: vov, region: "Triode", beta: beta, base: base };
  }

  function operatingPoint(params) {
    const result = current(params.vgs, params.vds, params);
    return Object.assign({}, result, {
      polarity: params.polarity,
      vgs: Number(params.vgs),
      vds: Number(params.vds),
      vth: Number(params.vth),
      power: result.id * Number(params.vds)
    });
  }

  function transferSweep(params, maxVg) {
    const points = [];
    const end = maxVg || 8;
    const count = 121;
    for (let i = 0; i <= count; i++) {
      const vg = end * i / count;
      points.push({ x: vg, y: current(vg, params.vds, params).id * 1000 });
    }
    return points;
  }

  function outputSweep(params, vg, maxVd) {
    const points = [];
    const end = maxVd || 10;
    const count = 101;
    for (let i = 0; i <= count; i++) {
      const vd = end * i / count;
      points.push({ x: vd, y: current(vg, vd, params).id * 1000 });
    }
    return points;
  }

  window.Analogverse.DeviceModel = {
    effectiveBeta: effectiveBeta,
    current: current,
    operatingPoint: operatingPoint,
    transferSweep: transferSweep,
    outputSweep: outputSweep
  };
}());

