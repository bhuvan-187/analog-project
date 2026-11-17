(function () {
  "use strict";
  const host = typeof window !== "undefined" ? window : self;
  host.Analogverse = host.Analogverse || {};

  function squareLaw(vg, vd, vth, beta, lambda) {
    const vov = vg - vth, vds = Math.max(vd, 0);
    if (vov <= 0 || vds <= 0) return { id: 0, gm: 0, gds: 0, vov: Math.max(0, vov), region: "Cutoff" };
    if (vds < vov) {
      const base = beta * (vov * vds - 0.5 * vds * vds);
      return { id: base * (1 + lambda * vds), gm: beta * vds * (1 + lambda * vds), gds: beta * (vov - vds) * (1 + lambda * vds) + lambda * base, vov: vov, region: "Triode" };
    }
    const base = 0.5 * beta * vov * vov;
    return { id: base * (1 + lambda * vds), gm: beta * vov * (1 + lambda * vds), gds: base * lambda, vov: vov, region: "Saturation" };
  }
  function solveAmplifierBias(p) {
    const beta = Number(p.kn) * 1e-3 * Number(p.wl), rd = Number(p.rd) * 1e3, rs = Number(p.rs) * 1e3, vdd = Number(p.vdd);
    let lo = 0, hi = Math.max(vdd / Math.max(rd, 1), 1e-9);
    for (let i = 0; i < 72; i++) {
      const id = (lo + hi) / 2, vs = id * rs, vd = vdd - id * rd;
      const predicted = squareLaw(Number(p.vgate) - vs, vd - vs, Number(p.vth), beta, Number(p.lambda)).id;
      if (predicted > id) lo = id; else hi = id;
    }
    const id = (lo + hi) / 2, vs = id * rs, vd = vdd - id * rd, vgs = Number(p.vgate) - vs, vds = vd - vs;
    const device = squareLaw(vgs, vds, Number(p.vth), beta, Number(p.lambda));
    return { id: id, vs: vs, vd: vd, vgs: vgs, vds: vds, vov: device.vov, gm: device.gm, gds: device.gds, region: device.region, power: id * Math.max(vds, 0), beta: beta };
  }
  function mirror(p) {
    const kn = Number(p.kn) * 1e-3, wl = Number(p.wl), ratio = Number(p.ratio), lambda = Number(p.lambda), vth = Number(p.vth), vdd = Number(p.vdd), iref = Number(p.iref) * 1e-3;
    const beta = kn * wl;
    let lo = 0, hi = 5;
    for (let i = 0; i < 64; i++) {
      const vov = (lo + hi) / 2;
      const current = 0.5 * beta * vov * vov * (1 + lambda * (vth + vov));
      if (current < iref) lo = vov; else hi = vov;
    }
    const vov = (lo + hi) / 2, vg = vth + vov, vout = Math.min(Math.max(Number(p.vout), 0), vdd);
    const out = squareLaw(vg, vout, vth, beta * ratio, lambda), ideal = iref * ratio;
    return { vov: vov, gateVoltage: vg, vout: vout, current: out.id, ideal: ideal, errorPercent: (out.id - ideal) / Math.max(ideal, 1e-12) * 100, region: out.region, beta: beta, ratio: ratio };
  }
  function nmosCurrent(vg, vd, beta, vth, lambda) { return squareLaw(vg, vd, vth, beta, lambda).id; }
  function pmosCurrent(vg, vd, vdd, beta, vth, lambda) { return squareLaw(vdd - vg, vdd - vd, vth, beta, lambda).id; }
  function solveInverter(p, vin) {
    const vdd = Number(p.vdd), betaN = Number(p.kn) * 1e-3 * Number(p.wl), betaP = Number(p.kp) * 1e-3 * Number(p.wl), lam = Number(p.lambda == null ? 0.01 : p.lambda);
    let lo = 0, hi = vdd;
    for (let i = 0; i < 72; i++) {
      const vo = (lo + hi) / 2, difference = nmosCurrent(vin, vo, betaN, Number(p.vtn), lam) - pmosCurrent(vin, vo, vdd, betaP, Number(p.vtp), lam);
      if (difference > 0) hi = vo; else lo = vo;
    }
    const vout = (lo + hi) / 2, iN = nmosCurrent(vin, vout, betaN, Number(p.vtn), lam), ip = pmosCurrent(vin, vout, vdd, betaP, Number(p.vtp), lam), current = (iN + ip) / 2;
    return { vout: vout, current: current, staticPower: vdd * current, nmosCurrent: iN, pmosCurrent: ip };
  }
  function otaDifference(p, vd) {
    const beta = Number(p.kn) * 1e-3 * Number(p.wl), itail = Number(p.itail) * 1e-3;
    if (beta <= 0 || itail <= 0) return { current: 0, gm: 0, limit: 0 };
    const limit = Math.sqrt(2 * itail / beta), abs = Math.abs(vd);
    const current = abs >= limit ? Math.sign(vd) * itail : beta * Math.sqrt(Math.max(itail / beta - vd * vd / 4, 0)) * vd;
    return { current: current, gm: Math.sqrt(beta * itail), limit: limit };
  }
  function complex(re, im) { return { re: re, im: im || 0 }; }
  function cadd(a, b) { return complex(a.re + b.re, a.im + b.im); }
  function cdiv(a, b) { const d = b.re * b.re + b.im * b.im || 1e-24; return complex((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); }
  function cmul(a, b) { return complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re); }
  function cscale(a, x) { return complex(a.re * x, a.im * x); }
  function opAmpTransfer(p, frequency) {
    const a0 = Number(p.aol), fp = Number(p.gbw) / Math.max(a0, 1), open = cdiv(complex(a0), complex(1, frequency / fp));
    if (p.mode === "noninv") {
      const beta = Number(p.rin) / (Number(p.rin) + Number(p.rf));
      return { open: open, closed: cdiv(open, cadd(complex(1), cscale(open, beta))) };
    }
    const beta = Number(p.rin) / (Number(p.rin) + Number(p.rf)), ratio = Number(p.rf) / Number(p.rin);
    return { open: open, closed: cdiv(cscale(open, -ratio), cadd(complex(1), cscale(open, beta))) };
  }
  host.Analogverse.CircuitModels = { squareLaw: squareLaw, solveAmplifierBias: solveAmplifierBias, mirror: mirror, solveInverter: solveInverter, otaDifference: otaDifference, opAmpTransfer: opAmpTransfer };
}());
