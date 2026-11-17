(function () {
  "use strict";
  window.Analogverse = window.Analogverse || {};
  const A = window.Analogverse, $ = function (id) { return document.getElementById(id); };
  const STORAGE_KEY = "analogverse.studio.design.v1", NS = "http://www.w3.org/2000/svg";
  const partPins = { R: { p: [-34, 0], n: [34, 0] }, C: { p: [-34, 0], n: [34, 0] }, L: { p: [-34, 0], n: [34, 0] }, V: { p: [-34, 0], n: [34, 0] }, I: { p: [-34, 0], n: [34, 0] }, D: { a: [-34, 0], k: [34, 0] }, NMOS: { d: [0, -36], g: [-35, 0], s: [0, 36] }, PMOS: { d: [0, -36], g: [-35, 0], s: [0, 36] }, GND: { g: [0, -18] } };
  const pinLabels = { p: "+", n: "−", a: "A", k: "K", d: "D", g: "G", s: "S" };
  const catalog = [["R", "Resistor"], ["C", "Capacitor"], ["L", "Inductor"], ["V", "Voltage source"], ["I", "Current source"], ["D", "Diode"], ["NMOS", "NMOS"], ["PMOS", "PMOS"], ["GND", "Ground"]];
  const templates = {
    divider: { title: "Voltage divider", elements: [
      { id: "V1", type: "V", nodes: { p: "vdd", n: "0" }, value: 12, x: 130, y: 205 },
      { id: "R1", type: "R", nodes: { p: "vdd", n: "out" }, value: 2000, x: 360, y: 175 },
      { id: "R2", type: "R", nodes: { p: "out", n: "0" }, value: 1000, x: 530, y: 275 },
      { id: "G1", type: "GND", nodes: { g: "0" }, x: 130, y: 315 }
    ] },
    rcstep: { title: "RC step response", elements: [
      { id: "V1", type: "V", nodes: { p: "vin", n: "0" }, value: 1, wave: "dc", x: 130, y: 205 },
      { id: "R1", type: "R", nodes: { p: "vin", n: "out" }, value: 1000, x: 365, y: 175 },
      { id: "C1", type: "C", nodes: { p: "out", n: "0" }, value: 1e-6, x: 535, y: 275 },
      { id: "G1", type: "GND", nodes: { g: "0" }, x: 130, y: 315 }
    ] },
    rclow: { title: "RC low-pass AC sweep", elements: [
      { id: "V1", type: "V", nodes: { p: "vin", n: "0" }, value: 0, acMagnitude: 1, x: 130, y: 205 },
      { id: "R1", type: "R", nodes: { p: "vin", n: "out" }, value: 1000, x: 365, y: 175 },
      { id: "C1", type: "C", nodes: { p: "out", n: "0" }, value: 1e-6, x: 535, y: 275 },
      { id: "G1", type: "GND", nodes: { g: "0" }, x: 130, y: 315 }
    ] },
    rchigh: { title: "RC high-pass AC sweep", elements: [
      { id: "V1", type: "V", nodes: { p: "vin", n: "0" }, value: 0, acMagnitude: 1, x: 130, y: 205 },
      { id: "C1", type: "C", nodes: { p: "vin", n: "out" }, value: 1e-6, x: 365, y: 175 },
      { id: "R1", type: "R", nodes: { p: "out", n: "0" }, value: 1000, x: 535, y: 275 },
      { id: "G1", type: "GND", nodes: { g: "0" }, x: 130, y: 315 }
    ] },
    rlc: { title: "Series RLC resonance", elements: [
      { id: "V1", type: "V", nodes: { p: "src", n: "0" }, value: 0, acMagnitude: 1, x: 115, y: 205 },
      { id: "R1", type: "R", nodes: { p: "src", n: "n1" }, value: 10, x: 325, y: 160 },
      { id: "L1", type: "L", nodes: { p: "n1", n: "n2" }, value: 0.01, x: 495, y: 160 },
      { id: "C1", type: "C", nodes: { p: "n2", n: "0" }, value: 1e-6, x: 650, y: 265 },
      { id: "G1", type: "GND", nodes: { g: "0" }, x: 115, y: 320 }
    ] },
    rectifier: { title: "Diode half-wave rectifier", elements: [
      { id: "V1", type: "V", nodes: { p: "src", n: "0" }, value: 0, wave: "sine", amplitude: 5, frequency: 50, x: 125, y: 205 },
      { id: "D1", type: "D", nodes: { a: "src", k: "out" }, is: 1e-12, n: 1, x: 365, y: 160 },
      { id: "R1", type: "R", nodes: { p: "out", n: "0" }, value: 1000, x: 545, y: 265 },
      { id: "G1", type: "GND", nodes: { g: "0" }, x: 125, y: 320 }
    ] },
    mosfet: { title: "NMOS common-source bias", elements: [
      { id: "VDD", type: "V", nodes: { p: "vdd", n: "0" }, value: 5, x: 145, y: 175 },
      { id: "VG", type: "V", nodes: { p: "gate", n: "0" }, value: 2, acMagnitude: 1, x: 145, y: 355 },
      { id: "RD", type: "R", nodes: { p: "vdd", n: "out" }, value: 1000, x: 370, y: 175 },
      { id: "RL", type: "R", nodes: { p: "out", n: "0" }, value: 10000, x: 600, y: 280 },
      { id: "M1", type: "NMOS", nodes: { d: "out", g: "gate", s: "0" }, kn: 0.002, wl: 1, vth: 1, lambda: 0.02, x: 410, y: 360 },
      { id: "G1", type: "GND", nodes: { g: "0" }, x: 145, y: 465 }
    ] },
    mirror: { title: "NMOS current mirror", elements: [
      { id: "VDD", type: "V", nodes: { p: "vdd", n: "0" }, value: 5, x: 130, y: 150 },
      { id: "IREF", type: "I", nodes: { p: "vdd", n: "nref" }, value: 0.001, x: 310, y: 130 },
      { id: "MREF", type: "NMOS", nodes: { d: "nref", g: "nref", s: "0" }, kn: 0.002, wl: 1, vth: 0.5, lambda: 0, x: 365, y: 280 },
      { id: "VOUT", type: "V", nodes: { p: "out", n: "0" }, value: 3, x: 650, y: 150 },
      { id: "MOUT", type: "NMOS", nodes: { d: "out", g: "nref", s: "0" }, kn: 0.002, wl: 2, vth: 0.5, lambda: 0, x: 650, y: 300 },
      { id: "G1", type: "GND", nodes: { g: "0" }, x: 130, y: 420 }
    ] },
    cmos: { title: "CMOS inverter transfer", elements: [
      { id: "VDD", type: "V", nodes: { p: "vdd", n: "0" }, value: 5, x: 150, y: 145 },
      { id: "VIN", type: "V", nodes: { p: "in", n: "0" }, value: 2.5, x: 150, y: 355 },
      { id: "MN", type: "NMOS", nodes: { d: "out", g: "in", s: "0" }, kn: 0.002, wl: 4, vth: 0.7, lambda: 0.01, x: 455, y: 345 },
      { id: "MP", type: "PMOS", nodes: { d: "out", g: "in", s: "vdd" }, kn: 0.002, wl: 4, vth: 0.7, lambda: 0.01, x: 455, y: 185 },
      { id: "G1", type: "GND", nodes: { g: "0" }, x: 150, y: 470 }
    ] },
    diffpair: { title: "NMOS differential pair", elements: [
      { id: "VDD", type: "V", nodes: { p: "vdd", n: "0" }, value: 5, x: 120, y: 145 },
      { id: "V1", type: "V", nodes: { p: "in1", n: "0" }, value: 1.5, x: 120, y: 315 },
      { id: "V2", type: "V", nodes: { p: "in2", n: "0" }, value: 1.5, x: 120, y: 425 },
      { id: "RD1", type: "R", nodes: { p: "vdd", n: "out1" }, value: 5000, x: 350, y: 155 },
      { id: "RD2", type: "R", nodes: { p: "vdd", n: "out2" }, value: 5000, x: 600, y: 155 },
      { id: "M1", type: "NMOS", nodes: { d: "out1", g: "in1", s: "tail" }, kn: 0.002, wl: 2, vth: 0.5, lambda: 0.01, x: 350, y: 320 },
      { id: "M2", type: "NMOS", nodes: { d: "out2", g: "in2", s: "tail" }, kn: 0.002, wl: 2, vth: 0.5, lambda: 0.01, x: 600, y: 320 },
      { id: "ITAIL", type: "I", nodes: { p: "tail", n: "0" }, value: 0.001, x: 470, y: 475 },
      { id: "G1", type: "GND", nodes: { g: "0" }, x: 120, y: 510 }
    ] }
  };
  let state, chart = null, active = false, last = null, currentTemplate = "divider", undoStack = [], redoStack = [], wireMode = false, pendingPin = null, drag = null, worker = null, requestId = 0, pendingRequest = null, view = { x: 0, y: 0, zoom: 1 };

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function blankDesign() { return { seq: 1, elements: clone(templates.divider.elements), selectedIds: ["R1"] }; }
  function readSaved() { try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); if (parsed && parsed.version === 1 && Array.isArray(parsed.elements)) return { seq: parsed.seq || 1, elements: parsed.elements, selectedIds: parsed.selectedIds || [] }; } catch (_) {} return blankDesign(); }
  state = readSaved();
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, seq: state.seq, elements: state.elements, selectedIds: state.selectedIds })); } catch (_) {} }
  function snapshot() { return clone({ seq: state.seq, elements: state.elements, selectedIds: state.selectedIds }); }
  function pushHistory() { undoStack.push(snapshot()); if (undoStack.length > 40) undoStack.shift(); redoStack = []; updateHistoryButtons(); }
  function restore(s) { state = clone(s); save(); renderAll(); runAnalysis(); }
  function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); updateHistoryButtons(); }
  function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); updateHistoryButtons(); }
  function updateHistoryButtons() { if ($("studioUndo")) { $("studioUndo").disabled = !undoStack.length; $("studioRedo").disabled = !redoStack.length; } }
  function allNodes() { const names = new Set(["0", "n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8", "in", "out", "vin", "vdd", "gate", "drain", "source", "nref"]); state.elements.forEach(function (e) { Object.keys(partPins[e.type] || {}).forEach(function (key) { names.add(String(e.nodes[key] || "0")); }); }); return Array.from(names).sort(function (a, b) { if (a === "0") return -1; if (b === "0") return 1; return a.localeCompare(b); }); }
  function primary() { return state.elements.find(function (e) { return state.selectedIds.indexOf(e.id) >= 0; }) || null; }
  function elementValue(e) {
    if (e.type === "R") return Number(e.value).toLocaleString() + " Ω";
    if (e.type === "C") return Number(e.value) >= 1e-6 ? (Number(e.value) * 1e6).toPrecision(3) + " µF" : (Number(e.value) * 1e9).toPrecision(3) + " nF";
    if (e.type === "L") return Number(e.value) >= 1e-3 ? (Number(e.value) * 1e3).toPrecision(3) + " mH" : (Number(e.value) * 1e6).toPrecision(3) + " µH";
    if (e.type === "V") return Number(e.value).toPrecision(3) + " V";
    if (e.type === "I") return Number(e.value).toPrecision(3) + " A";
    if (e.type === "D") return "IS " + Number(e.is).toExponential(1);
    if (e.type === "NMOS" || e.type === "PMOS") return "W/L " + Number(e.wl).toPrecision(3);
    return "0 V";
  }
  function pinPoint(e, key) {
    const pin = partPins[e.type][key], angle = Number(e.rotation || 0) * Math.PI / 180, x = pin[0] * Math.cos(angle) - pin[1] * Math.sin(angle), y = pin[0] * Math.sin(angle) + pin[1] * Math.cos(angle);
    return { x: Number(e.x) + x, y: Number(e.y) + y, node: String(e.nodes[key] || "0"), id: e.id, key: key };
  }
  function symbol(e) {
    if (e.type === "R") return '<path class="studio-part-symbol" d="M-34 0h7l5-11 10 22 10-22 10 22 10-22 5 11h7"/>';
    if (e.type === "C") return '<path class="studio-part-symbol" d="M-34 0h13m0-15v30m15-30v30m0-15h27"/>';
    if (e.type === "L") return '<path class="studio-part-symbol" d="M-34 0h8c0-16 18-16 18 0 0-16 18-16 18 0 0-16 18-16 18 0h6"/>';
    if (e.type === "V") return '<path class="studio-part-symbol" d="M-34 0h12m44 0h12"/><circle class="studio-part-symbol" cx="0" cy="0" r="22"/><path class="studio-part-symbol" d="M0-10v8m-4-4h8m-4 10v8"/>';
    if (e.type === "I") return '<path class="studio-part-symbol" d="M-34 0h12m44 0h12"/><circle class="studio-part-symbol" cx="0" cy="0" r="22"/><path class="studio-part-symbol" d="M0 10V-8m-6 6 6-6 6 6"/>';
    if (e.type === "D") return '<path class="studio-part-symbol" d="M-34 0h13m20 0h35"/><path class="studio-part-symbol" d="M-21-15 4 0l-25 15zM6-16v32"/>';
    if (e.type === "NMOS" || e.type === "PMOS") return '<path class="studio-part-symbol" d="M0-36v9m0 54v9m0-45v36m-18-29v22m-17 0h17m18-4h18m-18-14h18"/>' + (e.type === "PMOS" ? '<circle class="studio-part-symbol" cx="-14" cy="0" r="4"/>' : "");
    return '<path class="studio-part-symbol" d="M0-18v9m-15 0h30m-11 6h-8m-5 6h18m-14 6h10"/>';
  }
  function renderCanvas() {
    const svg = $("studioSvg"), viewport = $("studioViewport"); if (!svg || !viewport) return;
    svg.setAttribute("viewBox", "0 0 1000 620");
    let pins = {};
    state.elements.forEach(function (e) { Object.keys(partPins[e.type] || {}).forEach(function (key) { const point = pinPoint(e, key); (pins[point.node] = pins[point.node] || []).push(point); }); });
    let wires = "";
    Object.keys(pins).forEach(function (net) { const group = pins[net]; if (group.length < 2) return; const a = group[0]; group.slice(1).forEach(function (b) { const mid = Math.round((a.x + b.x) / 2); wires += '<path class="studio-net-wire ' + (net === "0" ? "net-ground" : "") + '" d="M' + a.x + " " + a.y + " H" + mid + " V" + b.y + " H" + b.x + '"/>'; }); if (group.length > 2) wires += '<circle class="studio-net-dot" cx="' + a.x + '" cy="' + a.y + '" r="4"/>'; });
    const parts = state.elements.map(function (e) {
      const selected = state.selectedIds.indexOf(e.id) >= 0, rot = Number(e.rotation || 0), pinMarkup = Object.keys(partPins[e.type] || {}).map(function (key) { const p = partPins[e.type][key], node = esc(e.nodes[key] || "0"); return '<circle class="studio-pin" data-pin-part="' + esc(e.id) + '" data-pin-key="' + key + '" cx="' + p[0] + '" cy="' + p[1] + '" r="5"/><text class="studio-pin-label" x="' + (p[0] + (p[0] < 0 ? -10 : 6)) + '" y="' + (p[1] + (p[1] < 0 ? -4 : 3)) + '">' + node + '</text>'; }).join("");
      return '<g class="studio-part ' + (selected ? "selected" : "") + '" data-part="' + esc(e.id) + '" transform="translate(' + Number(e.x) + ' ' + Number(e.y) + ') rotate(' + rot + ')"><rect x="-49" y="-37" width="98" height="74" rx="8" fill="transparent" stroke="' + (selected ? "#51e1c2" : "transparent") + '" stroke-width="1.5"/><g>' + symbol(e) + '</g>' + pinMarkup + '<text class="studio-part-label" x="0" y="-43" transform="rotate(' + (-rot) + ')">' + esc(e.id) + '</text><text class="studio-part-value" x="0" y="52" transform="rotate(' + (-rot) + ')">' + esc(elementValue(e)) + '</text></g>';
    }).join("");
    viewport.setAttribute("transform", "translate(" + view.x + " " + view.y + ") scale(" + view.zoom + ")");
    viewport.innerHTML = '<defs><pattern id="studioGrid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#192a3d" stroke-width="1"/><circle cx="0" cy="0" r="1.25" fill="#2b4057"/></pattern></defs><rect id="studioCanvasBg" class="studio-grid-bg" x="-1000" y="-1000" width="3000" height="3000"/>' + wires + parts;
    updateInspector();
  }
  function field(label, key, value, type, step, unit) {
    return '<label class="studio-field">' + label + (unit ? " · " + unit : "") + '<input data-param="' + key + '" type="' + (type || "number") + '" value="' + esc(value) + '"' + (step ? ' step="' + step + '"' : "") + '></label>';
  }
  function nodeField(e, key) {
    const current = String(e.nodes[key] || "0"), options = allNodes();
    if (options.indexOf(current) < 0) options.push(current);
    return '<label class="studio-field">Terminal ' + (pinLabels[key] || key.toUpperCase()) + '<select data-node="' + key + '">' + options.map(function (n) { return '<option value="' + esc(n) + '" ' + (n === current ? "selected" : "") + '>' + esc(n) + '</option>'; }).join("") + '</select></label>';
  }
  function updateInspector() {
    const panel = $("studioInspector"), e = primary(); if (!panel) return;
    if (!e) { panel.innerHTML = '<p class="studio-template-note">Select a component to edit its electrical nodes and parameters.</p>'; $("studioSelection").textContent = state.selectedIds.length + " selected"; return; }
    const nodes = e.type === "GND" ? '<p class="studio-template-note">Ground is fixed at node 0. Use Wire pins to connect another terminal to this ground net.</p>' : Object.keys(partPins[e.type] || {}).map(function (key) { return nodeField(e, key); }).join("");
    let params = "";
    if (e.type === "R") params = field("Resistance", "value", e.value, "number", "any", "Ω");
    if (e.type === "C") params = field("Capacitance", "value", e.value, "number", "any", "F");
    if (e.type === "L") params = field("Inductance", "value", e.value, "number", "any", "H");
    if (e.type === "V" || e.type === "I") params = field("DC value", "value", e.value, "number", "any", e.type === "V" ? "V" : "A") + '<label class="studio-field">Transient waveform<select data-param="wave"><option value="dc">DC / step</option><option value="sine">Sine</option><option value="square">Square</option><option value="triangle">Triangle</option><option value="pulse">Pulse</option></select></label>' + field("Transient amplitude", "amplitude", e.amplitude || 0, "number", "any", e.type === "V" ? "Vpk" : "Apk") + field("Frequency", "frequency", e.frequency || 1000, "number", "any", "Hz") + field("DC offset", "offset", e.offset || 0, "number", "any", e.type === "V" ? "V" : "A") + field("Phase", "phase", e.phase || 0, "number", "any", "degrees") + field("AC magnitude", "acMagnitude", e.acMagnitude || 0, "number", "any", e.type === "V" ? "V" : "A") + field("AC phase", "acPhase", e.acPhase || 0, "number", "any", "degrees");
    if (e.type === "D") params = field("Saturation current", "is", e.is || 1e-12, "number", "any", "A") + field("Ideality factor", "n", e.n || 1, "number", "any", "n");
    if (e.type === "NMOS" || e.type === "PMOS") params = field("Kn process parameter", "kn", e.kn, "number", "any", "A/V²") + field("W/L", "wl", e.wl, "number", "any", "ratio") + field("Threshold", "vth", e.vth, "number", "any", "V") + field("Channel-length modulation", "lambda", e.lambda || 0, "number", "any", "V⁻¹");
    panel.innerHTML = '<div class="studio-selected">' + esc(e.id) + " · " + esc(e.type) + (state.selectedIds.length > 1 ? " · +" + (state.selectedIds.length - 1) + " more" : "") + '</div><div class="studio-tool-row"><button class="studio-small-button" id="studioRotate">Rotate 90°</button><button class="studio-small-button" id="studioDuplicate">Duplicate</button><button class="studio-small-button" id="studioDelete">Delete</button></div><h3>Electrical terminals</h3>' + nodes + (params ? '<h3>Model parameters</h3>' + params : '<p class="studio-template-note">Ground is node 0. Connect it to a circuit net by assigning another terminal to node 0.</p>');
    $("studioSelection").textContent = state.selectedIds.length + " selected · " + e.id;
    const wave = panel.querySelector('[data-param="wave"]'); if (wave) wave.value = e.wave || "dc";
    panel.querySelectorAll("[data-param]").forEach(function (input) { input.addEventListener("change", function () { pushHistory(); if (input.type === "number" && !Number.isFinite(Number(input.value))) { showStatus("Parameter values must be numeric.", "bad"); return; } const target = primary(); if (!target) return; target[input.dataset.param] = input.type === "number" ? Number(input.value) : input.value; save(); renderCanvas(); runAnalysis(); }); });
    panel.querySelectorAll("[data-node]").forEach(function (select) { select.addEventListener("change", function () { pushHistory(); const target = primary(); if (!target) return; target.nodes[select.dataset.node] = select.value; save(); renderCanvas(); runAnalysis(); }); });
    $("studioRotate").addEventListener("click", rotateSelected); $("studioDuplicate").addEventListener("click", duplicateSelected); $("studioDelete").addEventListener("click", deleteSelected);
  }
  function showStatus(message, kind) { const el = $("studioStatus"); if (!el) return; el.textContent = message; el.className = "studio-status " + (kind || ""); }
  function renderAll() { renderCanvas(); updateHistoryButtons(); if ($("studioWire")) $("studioWire").classList.toggle("active-tool", wireMode); }
  function newElement(type) {
    const prefix = type === "NMOS" || type === "PMOS" ? "M" : type === "GND" ? "G" : type;
    let id; do { id = prefix + state.seq++; } while (state.elements.some(function (e) { return e.id === id; }));
    const base = { id: id, type: type, x: 390 + (state.elements.length % 4) * 62, y: 170 + Math.floor(state.elements.length / 4) * 85, rotation: 0, nodes: {} };
    Object.keys(partPins[type]).forEach(function (key, i) { base.nodes[key] = type === "GND" ? "0" : (i === 0 ? "n1" : i === 1 ? "n2" : "0"); });
    if (type === "R") base.value = 1000;
    if (type === "C") base.value = 1e-6;
    if (type === "L") base.value = 1e-3;
    if (type === "V") Object.assign(base, { value: 5, wave: "dc", amplitude: 1, frequency: 1000, offset: 0, phase: 0, acMagnitude: 0, acPhase: 0 });
    if (type === "I") Object.assign(base, { value: 0.001, wave: "dc", amplitude: 0.001, frequency: 1000, offset: 0, phase: 0, acMagnitude: 0, acPhase: 0 });
    if (type === "D") Object.assign(base, { is: 1e-12, n: 1 });
    if (type === "NMOS" || type === "PMOS") Object.assign(base, { kn: 0.002, wl: 5, vth: 0.7, lambda: 0.02 });
    return base;
  }
  function addPart(type) { pushHistory(); const e = newElement(type); state.elements.push(e); state.selectedIds = [e.id]; save(); renderAll(); runAnalysis(); showStatus(e.id + " added. Assign its terminal nets in the inspector or wire pins.", "good"); }
  function setTemplate(name) { const t = templates[name]; if (!t) return; pushHistory(); currentTemplate = name; state.elements = clone(t.elements); state.seq = Math.max.apply(null, state.elements.map(function (e) { const m = e.id.match(/(\d+)$/); return m ? Number(m[1]) + 1 : 1; }).concat([1])); state.selectedIds = [state.elements[0].id]; last = null; save(); if ($("studioAnalysis")) $("studioAnalysis").value = ["rcstep", "rectifier"].indexOf(name) >= 0 ? "transient" : ["rclow", "rchigh", "rlc"].indexOf(name) >= 0 ? "ac" : "dc"; updateAnalysisControls(); renderAll(); runAnalysis(); showStatus("Loaded " + t.title + " template.", "good"); }
  function rotateSelected() { if (!state.selectedIds.length) return; pushHistory(); state.elements.forEach(function (e) { if (state.selectedIds.indexOf(e.id) >= 0) e.rotation = (Number(e.rotation || 0) + 90) % 360; }); save(); renderCanvas(); }
  function duplicateSelected() { if (!state.selectedIds.length) return; pushHistory(); const copies = state.elements.filter(function (e) { return state.selectedIds.indexOf(e.id) >= 0; }).map(function (e) { const copy = clone(e), m = e.id.match(/^([A-Z]+)(\d+)$/); copy.id = (m ? m[1] : e.type) + state.seq++; copy.x += 35; copy.y += 35; return copy; }); state.elements = state.elements.concat(copies); state.selectedIds = copies.map(function (e) { return e.id; }); save(); renderAll(); showStatus(copies.length + " component(s) duplicated.", "good"); }
  function deleteSelected() { if (!state.selectedIds.length) return; pushHistory(); state.elements = state.elements.filter(function (e) { return state.selectedIds.indexOf(e.id) < 0; }); state.selectedIds = []; save(); renderAll(); last = null; showStatus("Selected component(s) deleted.", "good"); }
  function mergeNets(a, b) {
    if (a === b) return false;
    let old, replacement;
    if (a === "0") { old = b; replacement = "0"; }
    else if (b === "0") { old = a; replacement = "0"; }
    else { old = a; replacement = b; }
    state.elements.forEach(function (e) { Object.keys(e.nodes || {}).forEach(function (key) { if (String(e.nodes[key]) === old) e.nodes[key] = replacement; }); });
    return true;
  }
  function wirePin(id, key) {
    const e = state.elements.find(function (x) { return x.id === id; }); if (!e) return;
    if (!wireMode) { state.selectedIds = [id]; renderAll(); return; }
    if (!pendingPin) { pendingPin = { id: id, key: key, node: String(e.nodes[key] || "0") }; $("studioWirePrompt").textContent = "First end: " + id + "." + key.toUpperCase() + " (" + pendingPin.node + "). Click the destination pin."; return; }
    const targetNode = String(e.nodes[key] || "0"), merged = pendingPin.node !== targetNode;
    if (merged) { pushHistory(); mergeNets(pendingPin.node, targetNode); save(); runAnalysis(); showStatus("Connected nets " + pendingPin.node + " and " + targetNode + ".", "good"); }
    else showStatus("Those terminals already share node " + targetNode + ".", "");
    pendingPin = null; $("studioWirePrompt").textContent = "Wire mode: click two component pins to join their electrical nets."; renderAll();
  }
  function getLocalPoint(svg, event) {
    const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const ctm = $("studioViewport").getScreenCTM(); return point.matrixTransform(ctm.inverse());
  }
  function attachCanvasEvents() {
    const svg = $("studioSvg"); if (!svg) return;
    svg.addEventListener("pointerdown", function (event) {
      const pin = event.target.closest && event.target.closest("[data-pin-part]");
      if (pin) { event.preventDefault(); wirePin(pin.dataset.pinPart, pin.dataset.pinKey); return; }
      const part = event.target.closest && event.target.closest("[data-part]");
      if (part) {
        const id = part.dataset.part;
        if (event.shiftKey) { state.selectedIds = state.selectedIds.indexOf(id) >= 0 ? state.selectedIds.filter(function (x) { return x !== id; }) : state.selectedIds.concat([id]); }
        else if (state.selectedIds.indexOf(id) < 0) state.selectedIds = [id];
        pushHistory(); const p = getLocalPoint(svg, event), selected = state.elements.filter(function (e) { return state.selectedIds.indexOf(e.id) >= 0; });
        drag = { type: "parts", x: p.x, y: p.y, origins: selected.map(function (e) { return { id: e.id, x: e.x, y: e.y }; }) }; renderCanvas(); svg.setPointerCapture(event.pointerId); event.preventDefault(); return;
      }
      if (event.target.id === "studioCanvasBg") { drag = { type: "pan", x: event.clientX, y: event.clientY, ox: view.x, oy: view.y }; svg.setPointerCapture(event.pointerId); event.preventDefault(); }
    });
    svg.addEventListener("pointermove", function (event) {
      if (!drag) return;
      if (drag.type === "parts") { const p = getLocalPoint(svg, event), dx = p.x - drag.x, dy = p.y - drag.y; drag.origins.forEach(function (origin) { const e = state.elements.find(function (x) { return x.id === origin.id; }); if (e) { e.x = Math.round((origin.x + dx) / 5) * 5; e.y = Math.round((origin.y + dy) / 5) * 5; } }); renderCanvas(); }
      else { const rect = svg.getBoundingClientRect(); view.x = drag.ox + (event.clientX - drag.x) * 1000 / rect.width; view.y = drag.oy + (event.clientY - drag.y) * 620 / rect.height; renderCanvas(); }
    });
    function finish() { if (drag) { save(); drag = null; } }
    svg.addEventListener("pointerup", finish); svg.addEventListener("pointercancel", finish);
  }
  function setZoom(factor) { view.zoom = Math.max(0.45, Math.min(2.5, view.zoom * factor)); renderCanvas(); }
  function createPage() {
    const section = document.createElement("section"); section.className = "page extra-page"; section.dataset.page = "studio";
    section.innerHTML = '<div class="page-heading"><div><div class="overline">NETLIST-DRIVEN EDA · MNA SOLVER</div><h1>Circuit Studio</h1><p>Build and analyze circuits from editable components. Supported models are listed beside the component library.</p></div></div>' +
      '<div class="studio-toolbar"><select id="studioTemplate"><option value="divider">Voltage divider</option><option value="rcstep">RC step response</option><option value="rclow">RC low-pass AC</option><option value="rchigh">RC high-pass AC</option><option value="rlc">Series RLC</option><option value="rectifier">Diode rectifier</option><option value="mosfet">NMOS common source</option><option value="mirror">NMOS current mirror</option><option value="cmos">CMOS inverter</option><option value="diffpair">NMOS differential pair</option></select><button class="studio-small-button" id="studioLoadTemplate">Load circuit</button><button class="studio-small-button" id="studioUndo">Undo</button><button class="studio-small-button" id="studioRedo">Redo</button><button class="studio-small-button" id="studioWire">Wire pins</button><button class="studio-small-button" id="studioZoomOut">− Zoom</button><button class="studio-small-button" id="studioZoomIn">+ Zoom</button><button class="studio-small-button" id="studioSave">Save</button><button class="studio-small-button" id="studioLoad">Load saved</button><button class="studio-small-button" id="studioExport">Export JSON</button><button class="studio-small-button" id="studioImportButton">Import JSON</button><input id="studioImport" type="file" accept="application/json,.json" hidden></div>' +
      '<div class="studio-layout"><section class="panel studio-panel"><div class="panel-header"><div><h2>Library</h2><p>Click to place</p></div></div><div class="studio-tools"><div class="studio-library" id="studioLibrary"></div><div class="studio-unsupported"><b>Supported:</b> R, C, L, independent V/I sources, Shockley diode, three-terminal square-law NMOS/PMOS, ground.<br><b>Unsupported:</b> BJT, Zener/LED-specific behavior, op-amp macromodels, potentiometer, dependent sources and semiconductor charge models. These parts are intentionally not offered.</div><div class="studio-template-note">Connections are node-based. Use Wire pins or edit terminal net names. Moving symbols does not change circuit connectivity.</div></div></section>' +
      '<section class="panel studio-panel"><div class="panel-header"><div><h2>Electrical canvas</h2><p>Drag symbols to place them · drag empty canvas to pan</p></div><span class="panel-marker">MNA SCHEMATIC</span></div><div class="studio-canvas-wrap"><svg class="studio-canvas" id="studioSvg" role="img" aria-label="Interactive circuit canvas"><g id="studioViewport"></g></svg></div><div class="studio-wire-prompt" id="studioWirePrompt">Wire mode is off. Choose Wire pins, then click two terminals to connect their nets.</div><div class="studio-status" id="studioStatus">Circuit is ready. Run an analysis or select a validation case.</div></section>' +
      '<section class="panel studio-panel studio-inspector-panel"><div class="panel-header"><div><h2>Inspector</h2><p id="studioSelection">No selection</p></div></div><div class="studio-inspector" id="studioInspector"></div></section></div>' +
      '<section class="panel studio-panel" style="margin-top:10px"><div class="panel-header"><div><h2>Analysis controls</h2><p>DC operating point, backward-Euler transient, or linearized AC sweep</p></div><span class="panel-marker">EDIT → RUN</span></div><div class="studio-analysis-controls"><label class="studio-field">Analysis<select id="studioAnalysis"><option value="dc">DC operating point</option><option value="transient">Transient · backward Euler</option><option value="ac">AC sweep · small signal</option></select></label><label class="studio-field">Stop time · s<input id="studioStop" type="number" value="0.005" min="0.000001" step="any"></label><label class="studio-field">Time step · s<input id="studioDt" type="number" value="0.00001" min="0.000000001" step="any"></label><label class="studio-field">Start frequency · Hz<input id="studioFStart" type="number" value="1" min="0.000001" step="any"></label><label class="studio-field">Stop frequency · Hz<input id="studioFStop" type="number" value="1000000" min="0.000002" step="any"></label><label class="studio-field">AC points<input id="studioFPoints" type="number" value="81" min="3" max="401" step="1"></label><button class="button button-primary" id="studioRun">Run simulation</button></div></section>' +
      '<section class="panel studio-panel" style="margin-top:10px"><div class="panel-header"><div><h2 id="studioGraphTitle">Simulation results</h2><p id="studioResultCaption">Node voltages, branch currents, device bias and power</p></div><span class="panel-marker" id="studioConvergence">NOT RUN</span></div><div class="studio-results"><div class="studio-status" id="studioPowerSummary">Total power summary is calculated after simulation.</div><div class="studio-results-grid"><div><h3>Node voltages / branch currents</h3><div class="studio-table-wrap"><table class="studio-table"><thead id="studioTableHead"></thead><tbody id="studioTableBody"></tbody></table></div></div><div><div class="studio-toolbar"><select id="studioSignal"></select><button class="studio-small-button" id="studioCsv">Export CSV</button><button class="studio-small-button" id="studioPng">Export graph PNG</button></div><div class="chart-area studio-chart"><canvas id="studioChart" role="img" aria-label="Circuit simulation plot"></canvas></div></div></div><div class="studio-unsupported" id="studioExplanation">Model explanation uses solver values and device assumptions.</div></div></section>' +
      '<section class="panel studio-panel" style="margin-top:10px"><div class="panel-header"><div><h2>Engineering validation dashboard</h2><p>Theoretical values are compared with solver outputs; only passing checks receive a pass label.</p></div><button class="button" id="studioRunValidation">Run validation suite</button></div><div class="validation-summary" id="studioValidationSummary">Validation suite has not run in this session.</div><div class="studio-results"><div class="studio-table-wrap"><table class="studio-table"><thead><tr><th>Case</th><th>Theoretical</th><th>Solver</th><th>Error</th><th>Convergence</th><th>Outcome</th></tr></thead><tbody id="studioValidationRows"><tr><td colspan="6">Run the validation suite to populate verified results.</td></tr></tbody></table></div></div></section>';
    document.querySelector(".content").appendChild(section);
    $("studioLibrary").innerHTML = catalog.map(function (item) { return '<button type="button" data-add-part="' + item[0] + '">' + item[0] + " · " + item[1] + "</button>"; }).join("");
  }
  function makeChart() {
    if (!window.Chart || !$("studioChart")) { showStatus("Chart.js is unavailable. Connect to the internet and reload to enable studio graphs.", "bad"); return; }
    chart = new Chart($("studioChart").getContext("2d"), { type: "line", data: { datasets: [] }, options: { responsive: true, maintainAspectRatio: false, animation: false, parsing: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { labels: { color: "#cbd8e8", font: { size: 9 } } }, tooltip: { enabled: true } }, elements: { line: { tension: 0, borderWidth: 2 }, point: { radius: 0, hitRadius: 5 } }, scales: { x: { type: "linear", title: { display: true, text: "Time (s)", color: "#8fa3bb" }, grid: { color: "rgba(145,161,185,.13)" }, ticks: { color: "#8fa3bb" } }, y: { title: { display: true, text: "Voltage (V)", color: "#8fa3bb" }, grid: { color: "rgba(145,161,185,.13)" }, ticks: { color: "#8fa3bb" } } } } });
  }
  function bindControls() {
    $("studioLibrary").addEventListener("click", function (event) { const button = event.target.closest("[data-add-part]"); if (button) addPart(button.dataset.addPart); });
    $("studioLoadTemplate").addEventListener("click", function () { setTemplate($("studioTemplate").value); });
    $("studioUndo").addEventListener("click", undo); $("studioRedo").addEventListener("click", redo);
    $("studioWire").addEventListener("click", function () { wireMode = !wireMode; pendingPin = null; $("studioWirePrompt").textContent = wireMode ? "Wire mode: click two component pins to join their electrical nets." : "Wire mode is off."; renderAll(); });
    $("studioZoomIn").addEventListener("click", function () { setZoom(1.2); }); $("studioZoomOut").addEventListener("click", function () { setZoom(1 / 1.2); });
    $("studioSave").addEventListener("click", function () { save(); showStatus("Circuit saved in this browser's local storage.", "good"); });
    $("studioLoad").addEventListener("click", function () { const s = readSaved(); state = s; undoStack = []; redoStack = []; renderAll(); runAnalysis(); showStatus("Saved circuit loaded.", "good"); });
    $("studioExport").addEventListener("click", exportDesign); $("studioImportButton").addEventListener("click", function () { $("studioImport").click(); });
    $("studioImport").addEventListener("change", importDesign);
    $("studioRun").addEventListener("click", runAnalysis); $("studioAnalysis").addEventListener("change", updateAnalysisControls);
    $("studioSignal").addEventListener("change", renderResultChart);
    $("studioCsv").addEventListener("click", exportCsv); $("studioPng").addEventListener("click", exportPng);
    $("studioRunValidation").addEventListener("click", runValidation);
    document.addEventListener("keydown", function (event) { if (!active) return; if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); } else if ((event.key === "Delete" || event.key === "Backspace") && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { event.preventDefault(); deleteSelected(); } });
    attachCanvasEvents(); updateAnalysisControls();
  }
  function updateAnalysisControls() {
    const mode = $("studioAnalysis").value;
    document.querySelectorAll(".studio-analysis-controls .studio-field").forEach(function (field) {
      const label = field.textContent.toLowerCase();
      const transient = label.indexOf("stop time") === 0 || label.indexOf("time step") === 0;
      const ac = label.indexOf("start frequency") === 0 || label.indexOf("stop frequency") === 0 || label.indexOf("ac points") === 0;
      field.hidden = transient ? mode !== "transient" : ac ? mode !== "ac" : false;
    });
  }
  function logspace(a, b, count) { const out = []; for (let i = 0; i < count; i++) out.push(Math.pow(10, Math.log10(a) + (Math.log10(b) - Math.log10(a)) * i / (count - 1))); return out; }
  function runAnalysis() {
    if (!$("studioAnalysis")) return;
    const mode = $("studioAnalysis").value, engine = A.CircuitEngine, id = ++requestId, elements = clone(state.elements); let params = {}, frequencies = [];
    if (!engine) { showStatus("MNA engine failed to load.", "bad"); return; }
    try {
      if (mode === "transient") params = { tStop: Number($("studioStop").value), dt: Number($("studioDt").value) };
      if (mode === "ac") { const start = Number($("studioFStart").value), stop = Number($("studioFStop").value), count = Math.max(3, Math.min(201, Math.round(Number($("studioFPoints").value)))); if (start <= 0 || stop <= start) throw new Error("AC sweep requires positive frequencies and stop frequency greater than start."); frequencies = logspace(start, stop, count); }
    } catch (error) { finishAnalysis(id, mode, { converged: false, error: error.message }, elements, ""); return; }
    const request = { id: id, mode: mode, elements: elements, options: params, frequencies: frequencies };
    if (typeof Worker !== "undefined" && location.protocol !== "file:") {
      try {
        if (!worker) {
          worker = new Worker("src/js/circuit-worker.js");
          worker.onmessage = function (event) { const data = event.data || {}, pending = pendingRequest; if (!pending || data.id !== requestId || data.id !== pending.id) return; finishAnalysis(pending.id, pending.mode, data.result, pending.elements, ""); };
          worker.onerror = function () { const pending = pendingRequest; if (worker) worker.terminate(); worker = null; if (pending && pending.id === requestId) runSyncRequest(pending, "Worker failed; calculation used the main thread."); };
        }
        pendingRequest = request;
        $("studioRun").disabled = true; showStatus("Solving " + mode.toUpperCase() + " in the numerical worker…", "");
        worker.postMessage({ id: id, mode: mode, elements: elements, options: params, frequencies: frequencies });
        return;
      } catch (_) { if (worker) worker.terminate(); worker = null; }
    }
    runSyncRequest(request, typeof Worker === "undefined" || location.protocol === "file:" ? "Worker unavailable; calculation ran on the main thread." : "Worker could not start; calculation ran on the main thread.");
  }
  function runSyncRequest(request, note) {
    let result; const engine = A.CircuitEngine;
    try { result = request.mode === "dc" ? engine.solveDC(request.elements) : request.mode === "transient" ? engine.solveTransient(request.elements, request.options) : engine.solveAC(request.elements, request.frequencies); }
    catch (error) { result = { converged: false, error: error.message || String(error) }; }
    finishAnalysis(request.id, request.mode, result, request.elements, note);
  }
  function finishAnalysis(id, mode, result, elements, note) {
    if (id !== requestId) return;
    pendingRequest = null;
    last = { mode: mode, result: result || { converged: false, error: "Worker returned no result." }, elements: elements };
    $("studioRun").disabled = false; renderResult();
    const r = last.result;
    if (r.converged) showStatus(mode.toUpperCase() + " converged. Solver iterations: " + r.iterations + (mode === "transient" ? " · points: " + r.points.length : mode === "ac" ? " · frequencies: " + r.points.length : "") + (note ? " · " + note : ""), "good");
    else showStatus("Simulation failed: " + (r.error || "unknown numerical error") + (note ? " · " + note : ""), "bad");
  }
  function table(headers, rows) { $("studioTableHead").innerHTML = "<tr>" + headers.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr>"; $("studioTableBody").innerHTML = rows.map(function (r) { return "<tr>" + r.map(function (v) { return "<td>" + esc(v) + "</td>"; }).join("") + "</tr>"; }).join("") || '<tr><td colspan="5">No result rows.</td></tr>'; }
  function fmt(value, digits) { return Number.isFinite(Number(value)) ? Number(value).toPrecision(digits || 5) : "—"; }
  function fmtEng(value, unit) { if (!Number.isFinite(Number(value))) return "—"; const a = Math.abs(Number(value)); if (unit === "A") return a >= 1 ? fmt(value, 4) + " A" : a >= 1e-3 ? fmt(value * 1e3, 4) + " mA" : a >= 1e-6 ? fmt(value * 1e6, 4) + " µA" : fmt(value * 1e9, 4) + " nA"; if (unit === "W") return a >= 1 ? fmt(value, 4) + " W" : a >= 1e-3 ? fmt(value * 1e3, 4) + " mW" : fmt(value * 1e6, 4) + " µW"; return fmt(value, 5) + " " + unit; }
  function renderResult() {
    if (!last) return;
    const mode = last.mode, result = last.result, badge = $("studioConvergence"); badge.textContent = result.converged ? "CONVERGED" : "FAILED"; badge.className = "panel-marker " + (result.converged ? "validation-pass" : "validation-fail");
    $("studioGraphTitle").textContent = mode === "dc" ? "DC operating point" : mode === "transient" ? "Transient response" : "AC frequency response";
    if (!result.converged) { table(["Result", "Detail"], [["Error", result.error || "Simulation did not converge"]]); $("studioPowerSummary").textContent = "No power balance is reported for a failed analysis."; $("studioExplanation").textContent = "Check that every active node has a DC path to ground, source polarities are consistent, and component parameters are in range."; if (chart) { chart.data.datasets = []; chart.update("none"); } return; }
    if (mode === "dc") {
      const rows = Object.keys(result.nodes).filter(function (n) { return n !== "0"; }).map(function (n) { return ["Node " + n, fmtEng(result.nodes[n], "V"), "—", "—", "—"]; });
      Object.keys(result.branches).forEach(function (id) { rows.push(["Branch " + id, "—", fmtEng(result.branches[id], "A"), "—", "—"]); });
      Object.keys(result.components).forEach(function (id) { const c = result.components[id]; rows.push([id + " voltage", fmtEng(c.voltage, "V"), fmtEng(c.current, "A"), fmtEng(c.power, "W"), "component"]); });
      table(["Quantity", "Voltage", "Current", "Power", "Type"], rows);
      const power = powerBalance(result.components, last.elements); $("studioPowerSummary").textContent = "DC power: sources deliver " + fmtEng(power.delivered, "W") + "; modeled loads dissipate " + fmtEng(power.dissipated, "W") + "; balance residual " + fmtEng(power.residual, "W") + ".";
      $("studioResultCaption").textContent = "DC node voltages, branch currents and component power · Newton-Raphson/MNA · " + result.iterations + " iterations";
    } else if (mode === "transient") {
      const final = result.points[result.points.length - 1], rows = Object.keys(final.nodes).filter(function (n) { return n !== "0"; }).map(function (n) { return ["Node " + n, fmtEng(final.nodes[n], "V"), "at t=" + fmt(final.t, 4) + " s"]; });
      Object.keys(final.components || {}).forEach(function (id) { const c = final.components[id]; rows.push([id, fmtEng(c.voltage, "V"), fmtEng(c.current, "A") + " · " + fmtEng(c.power, "W")]); });
      table(["Quantity", "Value", "At final time"], rows); $("studioResultCaption").textContent = "Backward-Euler integration · " + result.points.length + " samples · total Newton iterations " + result.iterations;
      const power = powerBalance(final.components || {}, last.elements); $("studioPowerSummary").textContent = "Final-sample power: sources deliver " + fmtEng(power.delivered, "W") + "; elements absorb " + fmtEng(power.dissipated, "W") + "; residual " + fmtEng(power.residual, "W") + ". Capacitor and inductor power may be stored or returned.";
    } else {
      const first = result.points[0], rows = Object.keys(first.nodes).filter(function (n) { return n !== "0"; }).map(function (n) { const p = first.nodes[n]; return ["Node " + n, fmtEng(Math.hypot(p.re, p.im), "V"), fmt(20 * Math.log10(Math.max(Math.hypot(p.re, p.im), 1e-15)), 4) + " dB", fmt(Math.atan2(p.im, p.re) * 180 / Math.PI, 4) + "°"]; });
      table(["Quantity", "Magnitude", "Gain", "Phase"], rows); $("studioResultCaption").textContent = "Linearized AC MNA about the DC operating point · " + result.points.length + " logarithmic frequency points"; $("studioPowerSummary").textContent = "AC power is represented by phasors; real-power reporting is omitted for this analysis.";
    }
    updateSignalOptions(); renderResultChart(); explainResult();
  }
  function powerBalance(components, elements) {
    let source = 0, load = 0;
    elements.forEach(function (e) { const c = components[e.id]; if (!c) return; if (e.type === "V" || e.type === "I") source += Number(c.power || 0); else if (e.type !== "GND") load += Number(c.power || 0); });
    return { delivered: -source, dissipated: load, residual: source + load };
  }
  function explainResult() {
    const mode = last.mode, result = last.result, elements = last.elements; let text = "";
    const mosfets = elements.filter(function (e) { return e.type === "NMOS" || e.type === "PMOS"; });
    if (mode === "dc") {
      const outputName = result.nodes.out !== undefined ? "out" : Object.keys(result.nodes).filter(function (n) { return n !== "0"; }).pop(), output = outputName ? result.nodes[outputName] : NaN;
      text = "DC operating point solved with Newton-Raphson on the supported device equations. " + (outputName ? "Node " + outputName + " is " + fmtEng(output, "V") + ". " : "");
      if (mosfets.length) text += mosfets.map(function (e) { const d=result.nodes[e.nodes.d]||0,g=result.nodes[e.nodes.g]||0,s=result.nodes[e.nodes.s]||0,vgs=e.type==="NMOS"?g-s:s-g,vds=e.type==="NMOS"?d-s:s-d,vov=vgs-Number(e.vth),region=vgs<=Number(e.vth)?"cutoff":vds<vov?"triode":"saturation";return e.id+" is in "+region+" (VOV "+fmtEng(vov,"V")+", VDS magnitude "+fmtEng(vds,"V")+")."; }).join(" ");
      else if (elements.some(function (e) { return e.type === "C"; })) text += "Capacitors are open circuits in DC analysis.";
    } else if (mode === "transient") {
      const key = $("studioSignal").value || "V:out", id = key.slice(2), vals = result.points.map(function (p) { return key.indexOf("I:") === 0 ? Number((p.components[id] || {}).current || 0) : Number(p.nodes[id] || 0); }), max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
      text = (key.indexOf("I:") === 0 ? "Branch current " : "Node voltage ") + id + " ranges from " + fmtEng(min, key.indexOf("I:") === 0 ? "A" : "V") + " to " + fmtEng(max, key.indexOf("I:") === 0 ? "A" : "V") + " over the simulated interval. Backward Euler uses the selected fixed time step.";
    } else {
      const key = $("studioSignal").value || "V:out", id = key.slice(2), points = result.points, first = points[0], lastPoint = points[points.length - 1], a = first.nodes[id] || { re: 0, im: 0 }, b = lastPoint.nodes[id] || { re: 0, im: 0 };
      text = "Linearized AC analysis about the solved DC operating point. V(" + id + ") changes from " + fmt(20*Math.log10(Math.max(Math.hypot(a.re,a.im),1e-15)), 5) + " dB to " + fmt(20*Math.log10(Math.max(Math.hypot(b.re,b.im),1e-15)), 5) + " dB across the sweep; phase is shown on the second graph axis.";
    }
    if (mosfets.length) text += " MOSFETs use a long-channel square-law model without body effect or charge storage.";
    $("studioExplanation").textContent = text;
  }
  function signalList() {
    if (!last || !last.result.converged) return [];
    const result = last.result, out = [];
    if (last.mode === "transient") { const final = result.points[result.points.length - 1]; Object.keys(final.nodes).filter(function (n) { return n !== "0"; }).forEach(function (n) { out.push({ value: "V:" + n, label: "V(" + n + ") · V" }); }); Object.keys(final.components || {}).forEach(function (id) { out.push({ value: "I:" + id, label: "I(" + id + ") · A" }); }); }
    else if (last.mode === "ac") Object.keys(result.points[0].nodes).filter(function (n) { return n !== "0"; }).forEach(function (n) { out.push({ value: "V:" + n, label: "V(" + n + ") · AC" }); });
    else Object.keys(result.nodes).filter(function (n) { return n !== "0"; }).forEach(function (n) { out.push({ value: "V:" + n, label: "V(" + n + ") · DC" }); });
    return out;
  }
  function updateSignalOptions() { const select = $("studioSignal"), current = select.value, list = signalList(); select.innerHTML = list.map(function (s) { return '<option value="' + esc(s.value) + '">' + esc(s.label) + "</option>"; }).join(""); if (list.some(function (s) { return s.value === current; })) select.value = current; }
  function renderResultChart() {
    if (!chart || !last || !last.result.converged) return;
    const mode = last.mode, key = $("studioSignal").value || "V:out"; let datasets = [], xScale = "linear", xTitle = "Time (s)", yTitle = "Voltage (V)", y2 = false, labels = [];
    if (mode === "transient") {
      const points = last.result.points.map(function (p) { const id = key.slice(2); return { x: p.t, y: key.indexOf("V:") === 0 ? Number(p.nodes[id] || 0) : Number((p.components[id] || {}).current || 0) }; });
      const isCurrent = key.indexOf("I:") === 0; yTitle = isCurrent ? "Current (A)" : "Voltage (V)"; datasets = [{ label: $("studioSignal").selectedOptions[0] ? $("studioSignal").selectedOptions[0].textContent : key, data: points, borderColor: "#51e1c2", pointRadius: 0 }];
    } else if (mode === "ac") {
      xScale = "logarithmic"; xTitle = "Frequency (Hz)"; yTitle = "Magnitude (dB)"; y2 = true; const node = key.slice(2), points = last.result.points.map(function (p) { const v = p.nodes[node] || { re: 0, im: 0 }, m = Math.hypot(v.re, v.im); return { x: p.frequency, y: 20 * Math.log10(Math.max(m, 1e-15)) }; }), phases = last.result.points.map(function (p) { const v = p.nodes[node] || { re: 0, im: 0 }; return { x: p.frequency, y: Math.atan2(v.im, v.re) * 180 / Math.PI }; });
      datasets = [{ label: "Magnitude", data: points, borderColor: "#51e1c2", yAxisID: "y", pointRadius: 0 }, { label: "Phase", data: phases, borderColor: "#ffc66b", yAxisID: "y1", pointRadius: 0 }];
    } else {
      xTitle = "Node"; xScale = "category"; yTitle = "Voltage (V)"; labels = Object.keys(last.result.nodes).filter(function (n) { return n !== "0"; }); datasets = [{ label: "Node voltage", data: labels.map(function (n) { return last.result.nodes[n]; }), borderColor: "#51e1c2", pointRadius: 4 }];
    }
    chart.data.labels = labels; chart.data.datasets = datasets; chart.options.scales.x.type = xScale; chart.options.scales.x.title.text = xTitle; chart.options.scales.y.title.text = yTitle;
    if (y2) chart.options.scales.y1 = { type: "linear", position: "right", title: { display: true, text: "Phase (°)", color: "#ffc66b" }, grid: { drawOnChartArea: false }, ticks: { color: "#ffc66b" } }; else delete chart.options.scales.y1;
    chart.update("none");
  }
  function download(name, content, type) { const a = document.createElement("a"), url = URL.createObjectURL(new Blob([content], { type: type })); a.href = url; a.download = name; a.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000); }
  function exportDesign() { download("analogverse-circuit.json", JSON.stringify({ version: 1, elements: state.elements }, null, 2), "application/json"); }
  function importDesign(event) { const file = event.target.files && event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function () { try { const data = JSON.parse(reader.result); if (!data || !Array.isArray(data.elements) || !data.elements.length) throw new Error("JSON must contain a non-empty elements array."); data.elements.forEach(function (e) { if (!A.CircuitEngine.supported.includes(e.type) || !e.nodes || !Number.isFinite(Number(e.x)) || !Number.isFinite(Number(e.y))) throw new Error("Unsupported or malformed component: " + (e.id || "unnamed")); }); pushHistory(); state.elements = data.elements; state.seq = state.elements.length + 1; state.selectedIds = [state.elements[0].id]; save(); renderAll(); runAnalysis(); showStatus("Circuit JSON imported.", "good"); } catch (error) { showStatus("Import failed: " + error.message, "bad"); } }; reader.readAsText(file); event.target.value = ""; }
  function exportCsv() {
    if (!last || !last.result.converged) { showStatus("Run a converged analysis before exporting CSV.", "bad"); return; }
    let csv = "";
    if (last.mode === "transient") { const keys = Object.keys(last.result.points[last.result.points.length - 1].nodes).filter(function (n) { return n !== "0"; }); csv = ["time_s"].concat(keys.map(function (n) { return "V(" + n + ")_V"; })).join(",") + "\n" + last.result.points.map(function (p) { return [p.t].concat(keys.map(function (n) { return p.nodes[n] || 0; })).join(","); }).join("\n"); }
    else if (last.mode === "ac") { const keys = Object.keys(last.result.points[0].nodes).filter(function (n) { return n !== "0"; }); csv = ["frequency_Hz"].concat(keys.flatMap(function (n) { return ["V(" + n + ")_magnitude_V", "V(" + n + ")_phase_deg"]; })).join(",") + "\n" + last.result.points.map(function (p) { return [p.frequency].concat(keys.flatMap(function (n) { const v = p.nodes[n], m = Math.hypot(v.re, v.im); return [m, Math.atan2(v.im, v.re) * 180 / Math.PI]; })).join(","); }).join("\n"); }
    else csv = "quantity,value,unit\n" + Object.keys(last.result.nodes).map(function (n) { return "V(" + n + ")," + last.result.nodes[n] + ",V"; }).join("\n");
    download("analogverse-results.csv", csv, "text/csv;charset=utf-8");
  }
  function exportPng() { if (!chart) { showStatus("Chart.js is unavailable; no graph image to export.", "bad"); return; } const a = document.createElement("a"); a.href = chart.toBase64Image(); a.download = "analogverse-graph.png"; a.click(); }
  function runValidation() {
    const tests = A.CircuitEngine.runValidation(), passed = tests.filter(function (t) { return t.passed; }).length;
    $("studioValidationSummary").innerHTML = '<b class="' + (passed === tests.length ? "validation-pass" : "validation-fail") + '">' + passed + " / " + tests.length + " passed</b><span>Numerical error is computed against each displayed theoretical result.</span>";
    $("studioValidationRows").innerHTML = tests.map(function (t) { return '<tr><td>' + esc(t.name) + '<br><small>' + esc(t.explanation) + '</small></td><td>' + fmt(t.expected, 6) + " " + esc(t.unit) + '</td><td>' + fmt(t.actual, 6) + " " + esc(t.unit) + '</td><td>' + fmt(t.errorPercent, 5) + '%</td><td>' + (t.convergence ? "YES" : "NO") + '</td><td class="' + (t.passed ? "validation-pass" : "validation-fail") + '">' + (t.passed ? "PASS" : "FAIL") + "</td></tr>"; }).join("");
    showStatus("Validation completed: " + passed + " / " + tests.length + " theoretical comparisons passed.", passed === tests.length ? "good" : "bad");
  }
  function activate(name) { if (name === "studio" && last) { if (chart && chart.resize) chart.resize(); } }
  function init() { if (!document.querySelector(".content")) return; createPage(); makeChart(); bindControls(); renderAll(); updateHistoryButtons(); runAnalysis(); }
  document.addEventListener("DOMContentLoaded", init, { once: true });
  A.CircuitStudio = { activate: activate, run: runAnalysis, runValidation: runValidation, setTemplate: setTemplate, getDesign: function () { return clone(state.elements); }, getSnapshot: function () { return last ? { template: currentTemplate, mode: last.mode, result: last.result, elements: clone(last.elements) } : null; } };
}());
