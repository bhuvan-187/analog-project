(function () {
  "use strict";
  window.Analogverse = window.Analogverse || {};
  const A = window.Analogverse;
  const $ = function (id) { return document.getElementById(id); };
  const COLORS = { teal: "#51e1c2", blue: "#65a8ff", amber: "#ffc66b", pink: "#e58cff", muted: "#8fa3bb", grid: "rgba(145,161,185,.13)" };
  const defaults = { topology: "cs", vdd: 12, vgate: 3.5, kn: 2, wl: 5, vth: 2.5, lambda: 0.02, rd: 2.2, rs: 0.22, rl: 10, rsrc: 0.6, c1: 10, c2: 10, cs: 100, bypass: true };
  const genDefaults = { wave: "sine", freq: 600, amp: 10, offset: 0, phase: 0 };
  const mirrorDefaults = { polarity: "nmos", iref: 1, ratio: 1, vdd: 5, vout: 2.5, kn: 2, wl: 5, vth: 1.2, lambda: 0.02 };
  const cmosDefaults = { vdd: 5, vin: 2.5, vtn: 0.7, vtp: 0.7, kn: 2, kp: 1, wl: 4, cap: 20, freq: 1000 };
  const otaDefaults = { itail: 1, kn: 2, wl: 5, vth: 1, vdd: 5, rload: 10, vdiff: 0.05 };
  const opDefaults = { mode: "noninv", rin: 10, rf: 90, aol: 100000, gbw: 1000000, vpos: 12, vneg: 12, vin: 0.02 };
  let amp = load("analogverse.amp", defaults), gen = load("analogverse.generator", genDefaults);
  let mirror = load("analogverse.mirror", mirrorDefaults), cmos = load("analogverse.cmos", cmosDefaults);
  let ota = load("analogverse.ota", otaDefaults), opamp = load("analogverse.opamp", opDefaults);
  let charts = {}, latest = {}, activePage = "dashboard", selectedCircuit = "none", updateQueued = false;

  function load(key, base) {
    try { return Object.assign({}, base, JSON.parse(localStorage.getItem(key) || "{}")); } catch (_) { return Object.assign({}, base); }
  }
  function save() {
    [["analogverse.amp", amp], ["analogverse.generator", gen], ["analogverse.mirror", mirror], ["analogverse.cmos", cmos], ["analogverse.ota", ota], ["analogverse.opamp", opamp]].forEach(function (item) {
      try { localStorage.setItem(item[0], JSON.stringify(item[1])); } catch (_) { /* storage may be disabled */ }
    });
  }
  function fmt(value, digits) { return Number.isFinite(value) ? Number(value).toFixed(digits == null ? 2 : digits) : "—"; }
  function fmtCurrent(value) {
    if (!Number.isFinite(value)) return "—";
    const a = Math.abs(value);
    if (a >= 1) return (value).toFixed(3) + " A";
    if (a >= 1e-3) return (value * 1e3).toFixed(3) + " mA";
    if (a >= 1e-6) return (value * 1e6).toFixed(2) + " µA";
    return (value * 1e9).toFixed(2) + " nA";
  }
  function fmtResistance(value) {
    if (!Number.isFinite(value)) return "—";
    if (value >= 1e6) return (value / 1e6).toFixed(2) + " MΩ";
    if (value >= 1e3) return (value / 1e3).toFixed(2) + " kΩ";
    return value.toFixed(1) + " Ω";
  }
  function inputRange(id, label, value, min, max, step, unit, digits) {
    const shown = unit === "kΩ" ? fmt(value, digits) + " kΩ" : fmt(value, digits) + (unit || "");
    return '<label class="lab-control live-control"><span><b>' + label + '</b><output id="' + id + 'Out">' + shown + '</output></span><input id="' + id + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '"><small>Live recalculation</small></label>';
  }
  function fieldSelect(id, label, choices) {
    return '<label class="live-select"><span>' + label + '</span><select id="' + id + '">' + choices.map(function (c) { return '<option value="' + c[0] + '">' + c[1] + '</option>'; }).join("") + '</select></label>';
  }
  function metric(id, label, unit, color) {
    return '<article class="metric-box"><span class="metric-title">' + label + '</span><strong class="metric-result ' + (color || "") + '" id="' + id + '">—</strong><small>' + (unit || "Calculated from active model") + '</small></article>';
  }
  function page(id, heading, sub, eyebrow) {
    const section = document.createElement("section");
    section.className = "page extra-page";
    section.dataset.page = id;
    section.innerHTML = '<div class="page-heading"><div><div class="overline">' + eyebrow + '</div><h1>' + heading + '</h1><p>' + sub + '</p></div></div>';
    document.querySelector(".content").appendChild(section);
    return section;
  }
  function diagramPanel(title, description, drawing) {
    return '<section class="panel circuit-diagram-panel"><div class="panel-header"><div><h2>' + title + '</h2><p>' + description + '</p></div><span class="panel-marker">SCHEMATIC</span></div><div class="generated-schematic"><svg viewBox="0 0 620 230" role="img" aria-label="' + title + '"><rect width="620" height="230" rx="11" fill="#f4f7fa"/>' + drawing + '</svg></div></section>';
  }
  function createAmpUI() {
    const mount = $("topologyLabMount");
    mount.innerHTML = '<section class="panel topology-panel"><div class="panel-header"><div><h2>Topology workbench</h2><p>DC operating point and small-signal model recalculate from the controls below.</p></div><span class="live-pill"><i></i>LIVE SOLVER</span></div>' +
      '<div class="topology-toolbar">' + fieldSelect("ampTopology", "Amplifier configuration", [["cs","A · Common source"],["cg","B · Common gate"],["cd","C · Common drain / source follower"],["cascode","D · Cascode"],["degeneration","E · Source-degenerated"],["two-stage","F · Two-stage common source"]]) + '<label class="check-control"><input id="ampBypass" type="checkbox"><span>Source bypass capacitor</span></label><button class="button" id="resetAmpLab" type="button">Reset workbench</button></div>' +
      '<div class="control-grid">' + inputRange("ampVdd","Supply VDD",amp.vdd,5,20,0.5," V",1) + inputRange("ampVg","Gate bias VG",amp.vgate,2.5,6,0.05," V",2) + inputRange("ampKn","Kn",amp.kn,0.2,10,0.1," mA/V²",1) + inputRange("ampWl","W/L",amp.wl,0.5,20,0.5,"",1) + inputRange("ampVth","Threshold VTH",amp.vth,0.5,4,0.05," V",2) + inputRange("ampLambda","Channel modulation λ",amp.lambda,0,0.08,0.001," V⁻¹",3) + inputRange("ampRd","Drain resistor RD",amp.rd,0.22,20,0.1," kΩ",2) + inputRange("ampRs","Source resistor RS",amp.rs,0,2,0.01," kΩ",2) + inputRange("ampRl","Load RL",amp.rl,1,100,1," kΩ",0) + inputRange("ampRsig","Generator resistance",amp.rsrc,0.05,10,0.05," kΩ",2) + inputRange("ampC1","Input coupling C1",amp.c1,0.1,100,0.1," µF",1) + inputRange("ampC2","Output coupling C2",amp.c2,0.1,100,0.1," µF",1) + inputRange("ampCs","Bypass capacitance CS",amp.cs,1,470,1," µF",0) + '</div>' +
      '<div class="metric-grid extended-metrics">' + metric("ampGain","Voltage gain","signed V/V", "metric-accent") + metric("ampGainDb","Gain magnitude","dB") + metric("ampPhase","Phase","degrees") + metric("ampZin","Input impedance","small-signal Ω") + metric("ampZout","Output impedance","small-signal Ω") + metric("ampBandwidth","−3 dB bandwidth","from sampled AC sweep") + metric("ampId","Drain current","Q-point") + metric("ampGm","Transconductance","Q-point") + '</div>' +
      '<div class="model-warning" id="ampWarning">Model output is computed; it is not a hardware measurement.</div></section>' +
      '<div class="chart-grid lab-chart-grid"><section class="panel chart-panel"><div class="panel-header"><div><h2>Input and output waveform</h2><p>Two-cycle transient at the selected generator setting</p></div><span class="panel-marker">TRANSIENT</span></div><div class="chart-area"><canvas id="ampWaveChart" role="img" aria-label="Amplifier input and output waveform"></canvas></div></section><section class="panel chart-panel"><div class="panel-header"><div><h2>Frequency response</h2><p>Small-signal gain and phase over logarithmic frequency</p></div><span class="panel-marker">AC SWEEP</span></div><div class="chart-area"><canvas id="ampBodeChart" role="img" aria-label="Amplifier frequency response"></canvas></div></section></div>' +
      '<section class="panel circuit-equation-panel"><div class="panel-header"><div><h2>Interactive schematic and calculations</h2><p id="ampCircuitCaption">Voltage-divider biased NMOS stage</p></div><span class="panel-marker">MODEL DETAIL</span></div><div id="ampSchematic" class="generated-schematic"></div><div id="ampEquation" class="equation-list"></div><p class="model-footnote">Long-channel square-law teaching model: β = Kn(W/L). DC bias uses a bounded numerical KCL root for the source node; gain and frequency response use a linearized small-signal model. Cascode and two-stage results use the stated first-order approximations.</p></section>';
  }
  function createMirrorPage() {
    const p = page("current-mirror", "Current Mirror Lab", "Set a reference branch and inspect output compliance, geometry ratio and channel-length modulation.", "BIAS NETWORKS · DC ANALYSIS");
    p.insertAdjacentHTML("beforeend", '<div class="lab-layout"><section class="panel controls-panel"><div class="panel-header"><div><h2>Mirror parameters</h2><p>Reference current establishes the common gate voltage.</p></div><span class="panel-marker">EDITABLE</span></div><div class="control-stack">' + fieldSelect("mirrorPolarity","Device polarity",[["nmos","NMOS low-side"],["pmos","PMOS high-side"]]) + inputRange("mirrorIref","Reference current",mirror.iref,0.05,10,0.05," mA",2) + inputRange("mirrorRatio","Output / reference W/L",mirror.ratio,0.25,8,0.05,"×",2) + inputRange("mirrorVdd","Supply voltage",mirror.vdd,1.8,15,0.1," V",1) + inputRange("mirrorVout","Output voltage magnitude",mirror.vout,0,15,0.05," V",2) + inputRange("mirrorKn","Kn",mirror.kn,0.2,10,0.1," mA/V²",1) + inputRange("mirrorWl","Reference W/L",mirror.wl,0.5,20,0.5,"",1) + inputRange("mirrorVth","Threshold magnitude",mirror.vth,0.3,3,0.05," V",2) + inputRange("mirrorLambda","Channel modulation λ",mirror.lambda,0,0.08,0.001," V⁻¹",3) + '</div></section><div class="stack"><div class="metric-grid">' + metric("mirrorIout","Output current","at selected output voltage", "metric-accent") + metric("mirrorIdeal","Ideal ratio current","IREF × W/L ratio") + metric("mirrorError","Mirror error","relative to ideal ratio") + metric("mirrorVov","Gate overdrive","long-channel model") + '</div><section class="panel formula-panel"><div class="panel-header"><div><h2>Compliance and model</h2><p>Ideal ratio compared with channel-length-modulated result</p></div></div><div id="mirrorCalc" class="equation-list"></div><div class="model-warning" id="mirrorWarning"></div></section></div></div><section class="panel chart-panel"><div class="panel-header"><div><h2>Output characteristics</h2><p>Mirrored current over output-voltage magnitude</p></div><span class="panel-marker">IOUT–VOUT</span></div><div class="chart-area"><canvas id="mirrorChart" role="img" aria-label="Current mirror output characteristics"></canvas></div></section>');
    const mirrorDiagram=diagramPanel("Two-transistor current mirror","Reference device sets VGS; output device shares that gate bias.",'<g fill="none" stroke="#526a82" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M130 47h355M200 47v36m235-36v36M200 149v30m235-30v30M200 179h235"/><path d="M186 83v66m16-66v66m16-66v66M421 83v66m16-66v66m16-66v66"/><path d="M170 116h16m-16 0v-24h30m-30 24v23h30m235-23h-23M216 116h205"/><path d="M184 179h32m-26 6h20m-14 6h8M419 179h32m-26 6h20m-14 6h8"/><circle cx="200" cy="83" r="3.5" fill="#008e83"/><circle cx="435" cy="83" r="3.5" fill="#008e83"/></g><g fill="#20354b" font-family="DM Mono,monospace" font-size="13"><text x="238" y="40">VDD</text><text x="140" y="107">IREF</text><text x="480" y="108">IOUT</text><text x="178" y="74">MREF</text><text x="415" y="74">MOUT</text><text x="145" y="218">Diode-connected reference</text><text x="395" y="218">Output branch</text><text x="270" y="131">Common gate node</text></g>');
    p.querySelector(".chart-panel").insertAdjacentHTML("beforebegin",mirrorDiagram);
  }
  function createCmosPage() {
    const p = page("cmos", "CMOS Inverter Lab", "Numerically solve the complementary transistor currents to plot the voltage transfer curve and switching response.", "CMOS LOGIC · DC AND TRANSIENT");
    p.insertAdjacentHTML("beforeend", '<div class="control-grid compact-controls">' + inputRange("cmosVdd","Supply VDD",cmos.vdd,1.8,12,0.1," V",1) + inputRange("cmosVin","Input voltage VIN",cmos.vin,0,5,0.05," V",2) + inputRange("cmosVtn","NMOS threshold VTN",cmos.vtn,0.2,2,0.05," V",2) + inputRange("cmosVtp","PMOS threshold |VTP|",cmos.vtp,0.2,2,0.05," V",2) + inputRange("cmosKn","NMOS Kn",cmos.kn,0.2,10,0.1," mA/V²",1) + inputRange("cmosKp","PMOS Kp",cmos.kp,0.2,10,0.1," mA/V²",1) + inputRange("cmosWl","W/L ratio",cmos.wl,0.5,20,0.5,"",1) + inputRange("cmosCap","Load capacitance",cmos.cap,1,200,1," pF",0) + '</div><div class="metric-grid extended-metrics">' + metric("cmosVout","Output VOUT","DC transfer point", "metric-accent") + metric("cmosSwitch","Switching threshold","VOUT = VIN crossing") + metric("cmosLogic","Logic state","input / output") + metric("cmosPstatic","Static power","at selected VIN") + metric("cmosPdynamic","Dynamic power","P = α C VDD² f; α = 1") + metric("cmosBranch","Supply branch current","square-law DC solve") + '</div><div class="chart-grid lab-chart-grid"><section class="panel chart-panel"><div class="panel-header"><div><h2>Voltage transfer characteristic</h2><p>VOUT from NMOS / PMOS current balance</p></div><span class="panel-marker">VTC</span></div><div class="chart-area"><canvas id="cmosVtcChart" role="img" aria-label="CMOS inverter voltage transfer curve"></canvas></div></section><section class="panel chart-panel"><div class="panel-header"><div><h2>Digital transient</h2><p>Generator input and numerically solved output</p></div><span class="panel-marker">SWITCHING</span></div><div class="chart-area"><canvas id="cmosWaveChart" role="img" aria-label="CMOS inverter transient waveform"></canvas></div></section></div><section class="panel formula-panel"><div class="panel-header"><div><h2>Power and operating regions</h2></div></div><div id="cmosCalc" class="equation-list"></div><p class="model-footnote">When the shared function generator is set to square, the CMOS inverter receives a rail-to-rail logic waveform. For sine or triangle, its amplitude and offset controls set the input. Dynamic power uses an activity-factor-one estimate; transient short-circuit current and parasitic capacitance are not solved.</p></section>');
    const cmosDiagram=diagramPanel("CMOS inverter circuit","Complementary PMOS/NMOS pair with tied drains and common gate input.",'<g fill="none" stroke="#526a82" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M310 33v20m0 44v39m0 40v22m-165-94h145m40 0h145M310 139v22m-12 36h24m-18 8h12m-9 7h6"/><path d="M298 53v48m24-48v48m-12-48v48M298 139v40m24-40v40m-12-40v40M145 116h141m-141 0v-14m0 14v14m175-14h145v-14m0 14v14"/><circle cx="286" cy="77" r="8" fill="#f4f7fa"/><circle cx="310" cy="116" r="4" fill="#008e83"/><path d="M170 47h280M170 193h280"/></g><g fill="#20354b" font-family="DM Mono,monospace" font-size="13"><text x="295" y="27">VDD</text><text x="322" y="81">MP</text><text x="322" y="165">MN</text><text x="75" y="120">VIN</text><text x="476" y="120">VOUT</text><text x="286" y="218">GND</text><text x="450" y="49">PMOS</text><text x="450" y="188">NMOS</text></g>');
    p.querySelector(".metric-grid").insertAdjacentHTML("beforebegin",cmosDiagram);
  }
  function createOtaPage() {
    const p = page("ota", "OTA and Op-Amp Lab", "Compare a transistor-level differential-pair OTA model with an explicitly idealized finite-gain feedback op-amp.", "ANALOG BLOCKS · DIFFERENTIAL AND FEEDBACK");
    p.insertAdjacentHTML("beforeend", '<div class="subtabs" role="tablist"><button class="subtab active" data-ota-tab="ota">Transistor-level OTA</button><button class="subtab" data-ota-tab="opamp">Ideal op-amp feedback</button></div><div class="ota-subpage active" data-ota-view="ota"><div class="control-grid compact-controls">' + inputRange("otaTail","Tail current ITAIL",ota.itail,0.05,10,0.05," mA",2) + inputRange("otaKn","NMOS Kn",ota.kn,0.2,10,0.1," mA/V²",1) + inputRange("otaWl","Input-pair W/L",ota.wl,0.5,30,0.5,"",1) + inputRange("otaVth","Threshold VTH",ota.vth,0.3,3,0.05," V",2) + inputRange("otaVdd","Supply VDD",ota.vdd,1.8,12,0.1," V",1) + inputRange("otaRload","Output load",ota.rload,1,100,1," kΩ",0) + inputRange("otaVdiff","Differential input Vd",ota.vdiff,-0.3,0.3,0.001," V",3) + '</div><div class="metric-grid extended-metrics">' + metric("otaIout","Differential output current","I1 − I2", "metric-accent") + metric("otaGm","Small-signal gm","matched pair, at zero differential input") + metric("otaSwing","Linear input range","approximate differential span") + metric("otaVout","Load output voltage","Iout × RL, clipped to rail") + '</div><section class="panel chart-panel"><div class="panel-header"><div><h2>Differential input versus output current</h2><p>Square-law current steering with tail-current conservation</p></div><span class="panel-marker">OTA TRANSFER</span></div><div class="chart-area"><canvas id="otaChart" role="img" aria-label="OTA differential transfer characteristic"></canvas></div></section><div class="equation-list" id="otaCalc"></div></div>' +
      '<div class="ota-subpage" data-ota-view="opamp"><div class="control-grid compact-controls">' + fieldSelect("opMode","Feedback configuration",[["noninv","Non-inverting"],["inv","Inverting"]]) + inputRange("opRin","Input resistor RIN",opamp.rin,1,1000,1," kΩ",0) + inputRange("opRf","Feedback resistor RF",opamp.rf,1,1000,1," kΩ",0) + inputRange("opAol","Open-loop gain A0",opamp.aol,1000,1000000,1000," V/V",0) + inputRange("opGbw","Gain-bandwidth product",opamp.gbw,1000,100000000,1000," Hz",0) + inputRange("opVpos","Positive rail",opamp.vpos,1,20,0.5," V",1) + inputRange("opVneg","Negative rail magnitude",Math.abs(opamp.vneg),1,20,0.5," V",1) + '</div><div class="metric-grid extended-metrics">' + metric("opClosedGain","Closed-loop gain","finite open-loop gain", "metric-accent") + metric("opIdealGain","Ideal feedback gain","resistor ratio") + metric("opOpenGain","Open-loop A0","low-frequency model") + metric("opBandwidth","Closed-loop bandwidth","GBW / noise gain") + metric("opOutput","Output peak","clipped to rails") + metric("opPhase","Output phase","relative to input") + '</div><div class="chart-grid lab-chart-grid"><section class="panel chart-panel"><div class="panel-header"><div><h2>Open-loop and closed-loop gain</h2><p>One-pole finite A0 model and feedback response</p></div><span class="panel-marker">BODE</span></div><div class="chart-area"><canvas id="opBodeChart" role="img" aria-label="Open-loop and closed-loop op amp gain"></canvas></div></section><section class="panel chart-panel"><div class="panel-header"><div><h2>Feedback input and output</h2><p>Output clipped at selected rails</p></div><span class="panel-marker">TRANSIENT</span></div><div class="chart-area"><canvas id="opWaveChart" role="img" aria-label="Op amp input and output waveform"></canvas></div></section></div><div class="model-warning">Op-amp mode is a finite-A0 one-pole block model, not a transistor-level op-amp. OTA results use the long-channel matched-pair equation.</div><div id="opCalc" class="equation-list"></div></div>');
    const otaDrawing=diagramPanel("NMOS differential pair","Matched devices steer a fixed tail current; load converts branch current to output voltage.",'<g fill="none" stroke="#526a82" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M150 39h320m-230 0v37m150-37v37m-150 80v30m150-30v30M240 176v18m80-18v18m-80 0h80m-66 6h52m-38 6h24"/><path d="M227 76v80m26-80v80m124-80v80m26-80v80M145 117h82m26 0h98m26 0h68m-150 0v39m-124-39v-28m0 28v28"/><path d="M240 76v-24m150 24V52m-12 0h24m-18-7h12m-9-7h6"/><circle cx="390" cy="117" r="4" fill="#008e83"/><circle cx="240" cy="117" r="4" fill="#008e83"/></g><g fill="#20354b" font-family="DM Mono,monospace" font-size="13"><text x="225" y="71">M1</text><text x="375" y="71">M2</text><text x="120" y="111">V+</text><text x="455" y="111">V−</text><text x="175" y="31">VDD / active loads</text><text x="280" y="218">ITAIL</text><text x="405" y="111">IOUT</text></g>');
    const opampDrawing=diagramPanel("Negative-feedback op-amp","Resistor network sets ideal gain; finite A0 and a dominant pole limit the block response.",'<g fill="none" stroke="#526a82" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M205 47l165 70-165 70zM75 92h130m-130 48h130m165-23h105v-75H280m-145 0v75m0 0h70m-70 0v51m0 0h70m-58 7h46m-33 7h20m-88-65h43"/><path d="M150 72v20m-8-10h16m-8 48v20"/><circle cx="370" cy="117" r="4" fill="#008e83"/></g><g fill="#20354b" font-family="DM Mono,monospace" font-size="13"><text x="214" y="111">+</text><text x="214" y="145">−</text><text x="275" y="121">A(s)</text><text x="392" y="61">RF</text><text x="145" y="161">RIN</text><text x="45" y="88">VIN</text><text x="390" y="111">VOUT</text><text x="418" y="48">negative feedback</text></g>');
    p.querySelector('[data-ota-view="ota"] .metric-grid').insertAdjacentHTML("beforebegin",otaDrawing);
    p.querySelector('[data-ota-view="opamp"] .metric-grid').insertAdjacentHTML("beforebegin",opampDrawing);
    p.querySelectorAll("[data-ota-tab]").forEach(function (button) { button.addEventListener("click", function () { p.querySelectorAll("[data-ota-tab]").forEach(function (b) { b.classList.toggle("active", b === button); }); p.querySelectorAll("[data-ota-view]").forEach(function (v) { v.classList.toggle("active", v.dataset.otaView === button.dataset.otaTab); }); Object.keys(charts).forEach(function (k) { if (charts[k] && charts[k].resize) charts[k].resize(); }); if(activePage==="ota"){selectedCircuit=button.dataset.otaTab==="opamp"?"opamp":"ota";if(button.dataset.otaTab==="opamp")updateOpamp();else updateOta();} }); });
  }
  function createAdvancedPage() {
    const p = page("advanced", "Advanced Circuit Analysis", "Follow the active amplifier Q-point through a small-signal model, transfer function, cutoff sweep and power estimate.", "ENGINEERING ANALYSIS · EQUATIONS AND RESULTS");
    p.insertAdjacentHTML("beforeend", '<div class="advanced-summary metric-grid extended-metrics">' + metric("advTopology","Active topology","amplifier workbench") + metric("advOpPoint","Operating point","ID and terminal voltages") + metric("advGm","Transconductance","gm = ∂ID/∂VGS") + metric("advRout","Output resistance","ro ≈ 1/gds") + metric("advGain","Midband gain","signed V/V") + metric("advPower","Device power","ID × VDS") + '</div><div class="chart-grid lab-chart-grid"><section class="panel chart-panel"><div class="panel-header"><div><h2>Gain and phase</h2><p>Frequency-dependent small-signal model</p></div><span class="panel-marker">BODE</span></div><div class="chart-area"><canvas id="advancedBodeChart" role="img" aria-label="Advanced gain and phase Bode plot"></canvas></div></section><section class="panel"><div class="panel-header"><div><h2>Step-by-step calculation</h2><p>Values are taken from the selected amplifier design</p></div><span class="panel-marker">DERIVATION</span></div><div class="equation-list" id="advancedSteps"></div></section></div><section class="panel"><div class="panel-header"><div><h2>Small-signal equivalent model</h2><p>Linearized around the solved DC operating point</p></div></div><div class="generated-schematic" id="smallSignalSchematic"></div><p class="model-footnote">Use the current settings in Amplifier Design Lab; changing any of its parameters updates this analysis. The model omits body effect, device capacitances, noise, temperature and short-channel effects.</p></section>');
  }
  function createComparisonPage() {
    const p = page("comparison", "Performance Comparison", "Compare topology metrics under a common device bias and load from the amplifier workbench.", "DESIGN TRADE-OFFS · MATCHED ASSUMPTIONS");
    p.insertAdjacentHTML("beforeend", '<div class="comparison-toolbar">' + fieldSelect("comparePair","Comparison",[["cs-cg","Common source vs common gate"],["cs-cd","Common source vs source follower"],["cs-cascode","Common source vs cascode"],["bypass","Bypassed vs unbypassed source"],["nmos-pmos","NMOS vs PMOS magnitude model"],["mirror","Ideal vs non-ideal mirror"],["opamp","Open-loop vs closed-loop op-amp"]]) + fieldSelect("compareMetric","Graph metric",[["gain","Gain / transfer ratio"],["gainDb","Gain magnitude (dB)"],["zin","Input impedance (Ω)"],["zout","Output impedance (Ω)"],["bandwidth","Bandwidth (Hz)"],["power","Power (mW)"]]) + '</div><div class="comparison-table-wrap"><table class="compare-table comparison-table"><thead><tr><th>Metric</th><th id="compareLabelA">Model A</th><th id="compareLabelB">Model B</th><th>Difference</th></tr></thead><tbody id="compareRows"></tbody></table></div><section class="panel chart-panel"><div class="panel-header"><div><h2>Matched metric comparison</h2><p id="compareGraphCaption">Calculated at the selected operating point</p></div><span class="panel-marker">A / B</span></div><div class="chart-area"><canvas id="comparisonChart" role="img" aria-label="Circuit performance comparison chart"></canvas></div></section><div class="model-warning">Comparisons reuse the workbench bias, transistor coefficients, signal frequency and load where relevant. Values are analytical model estimates; topology-specific parasitic models are not included.</div>');
  }
  function createGenerator() {
    const target = document.querySelector('[data-page="instruments"] .instrument-layout');
    if (!target) return;
    const section = document.createElement("section");
    section.className = "panel generator-panel";
    section.innerHTML = '<div class="panel-header"><div><h2>Function generator</h2><p>Shared signal source for amplifier, CMOS, OTA and op-amp transient models.</p></div><span class="panel-marker">MODEL INPUT</span></div><div class="generator-controls">' + fieldSelect("genWave","Waveform",[["sine","Sine"],["square","Square"],["triangle","Triangle"]]) + inputRange("genFreq","Frequency",gen.freq,10,100000,10," Hz",0) + inputRange("genAmp","Amplitude",gen.amp,1,500,1," mVpk",0) + inputRange("genOffset","DC offset",gen.offset,-5,5,0.05," V",2) + inputRange("genPhase","Phase",gen.phase,0,360,1,"°",0) + '</div><div class="dmm-grid"><div><span>DC voltage</span><strong id="dmmDCV">—</strong></div><div><span>AC RMS</span><strong id="dmmACV">—</strong></div><div><span>Current</span><strong id="dmmCurrent">—</strong></div><div><span>V/I equivalent</span><strong id="dmmResistance">—</strong></div></div><div class="instrument-note"><b>Data path</b><p id="generatorSource">The oscilloscope receives time samples from the selected live circuit model.</p><small id="dmmSource">Values update from the selected simulated circuit.</small></div>';
    target.parentNode.insertBefore(section, target);
  }
  function createDocumentation() {
    const mount = $("documentationMount");
    mount.innerHTML = '<section class="panel project-documentation"><div class="panel-header"><div><h2>Project documentation</h2><p>System design, equations, scope and reproducibility notes</p></div><span class="panel-marker">ANALOGVERSE</span></div><div class="doc-section-grid">' + [
      ["01 · Introduction", "ANALOGVERSE is an interactive analog electronics laboratory for exploring device behavior, amplifier design and analog building blocks using deterministic browser-based models."],
      ["02 · Problem statement", "Manual circuit calculations are difficult to connect with changing waveforms and operating points. The lab links component controls to equations, plots and instrument readings so the cause of each change is visible."],
      ["03 · Objectives", "Study MOSFET regions; design and compare six amplifier configurations; analyze current mirrors, CMOS switching, an OTA and feedback op-amp; run guided exercises; and produce a print-ready report."],
      ["04 · System architecture", "The responsive HTML/CSS interface hosts modular JavaScript device, circuit, instrument and report modules. SVG schematics and Chart.js plots display calculated results. Local storage retains model settings. A numerical worker is not required for the bounded sweeps in this educational build."],
      ["05 · Technologies", "HTML5, CSS3, modern JavaScript, SVG, Chart.js and browser localStorage. PDF output uses the browser print dialog so the report can be saved as PDF without a server."],
      ["06 · Circuit theory", "NMOS and PMOS use polarity-normalized long-channel square-law equations. In saturation, ID = β/2 · VOV²(1 + λVDS); in triode, ID = β(VOV·VDS − VDS²/2)(1 + λVDS). MOSFET transconductance is the local derivative of current with respect to gate voltage."],
      ["07 · Simulation methodology", "The device lab evaluates closed-form region equations. The amplifier workbench solves its scalar DC source-node KCL by a bounded bisection root, then derives a first-order linearized AC response and sampled waveform. The CMOS inverter solves NMOS/PMOS drain-current balance with bisection. OTA current steering follows a matched long-channel differential-pair model."],
      ["08 · Mathematical models", "The source follower uses gm·RL/(1+gm·RL). Common-source gain uses −gm·(RD∥RL∥ro)/(1+gm·Zsource). The mirror includes geometry ratio and channel-length modulation. CMOS static branch current follows the selected DC input; dynamic power is estimated as αCVDD²f. The op-amp is a finite open-loop gain, one-pole feedback block."],
      ["09 · Results and analysis", "Every module shows live values beside the related graph. The Comparison page uses a shared workbench bias and load for the amplifier comparisons; current-mirror, CMOS, OTA and op-amp comparisons call out their distinct model assumptions."],
      ["10 · Applications", "The models support classroom demonstrations of transistor bias, analog gain stages, current-source compliance, logic switching, differential transconductance and negative feedback."],
      ["11 · Limitations", "No SPICE solver or foundry device model is integrated. Body effect, subthreshold current, short-channel effects, device capacitances in most stages, temperature, noise, mismatch and layout parasitics are omitted. High-frequency poles are first-order estimates. Reports are model results, not laboratory measurements."],
      ["12 · Future scope", "A tested SPICE engine, detailed capacitance models, device mismatch, noise and temperature analysis, adaptive transient integration, downloadable raw data and automated numerical regression could extend this teaching tool."],
      ["13 · References", "Sedra & Smith, Microelectronic Circuits; Gray, Hurst, Lewis & Meyer, Analysis and Design of Analog Integrated Circuits; standard long-channel MOSFET square-law and small-signal relations. Equations are summarized in the module that uses them."]
    ].map(function (x) { return '<article class="doc-section"><h3>' + x[0] + '</h3><p>' + x[1] + '</p></article>'; }).join("") + '</div><div class="doc-callout">Model labels are displayed in each lab. Only the original Common Source amplifier includes its own nonlinear capacitor-state transient model; other time-domain traces are first-order educational responses.</div></section>';
  }

  function bindRange(id, object, key, unit, digits, changed) {
    const field = $(id), out = $(id + "Out");
    if (!field) return;
    field.value = object[key];
    const paint = function () {
      object[key] = Number(field.value);
      let n = fmt(object[key], digits == null ? 2 : digits);
      if (unit === "kΩ") n += " kΩ"; else if (unit) n += unit;
      out.textContent = n;
      save();
      schedule(changed);
    };
    field.addEventListener("input", paint);
    paint();
  }
  function bindAll() {
    const ampBindings = [["ampVdd","vdd"," V",1],["ampVg","vgate"," V",2],["ampKn","kn"," mA/V²",1],["ampWl","wl","",1],["ampVth","vth"," V",2],["ampLambda","lambda"," V⁻¹",3],["ampRd","rd"," kΩ",2],["ampRs","rs"," kΩ",2],["ampRl","rl"," kΩ",0],["ampRsig","rsrc"," kΩ",2],["ampC1","c1"," µF",1],["ampC2","c2"," µF",1],["ampCs","cs"," µF",0]];
    ampBindings.forEach(function (b) { bindRange(b[0],amp,b[1],b[2],b[3],updateAmp); });
    $("ampTopology").value = amp.topology;
    $("ampTopology").addEventListener("change",function(){amp.topology=this.value;save();updateAmp();});
    $("ampBypass").checked = !!amp.bypass;
    $("ampBypass").addEventListener("change",function(){amp.bypass=this.checked;save();updateAmp();});
    $("resetAmpLab").addEventListener("click",function(){amp=Object.assign({},defaults);save();refreshAmpControls();updateAmp();});
    [["genFreq","freq"," Hz",0],["genAmp","amp"," mVpk",0],["genOffset","offset"," V",2],["genPhase","phase","°",0]].forEach(function(b){bindRange(b[0],gen,b[1],b[2],b[3],updateActiveTransient);});
    $("genWave").value=gen.wave;$("genWave").addEventListener("change",function(){gen.wave=this.value;save();updateActiveTransient();});
    const mirrorBindings=[["mirrorIref","iref"," mA",2],["mirrorRatio","ratio","×",2],["mirrorVdd","vdd"," V",1],["mirrorVout","vout"," V",2],["mirrorKn","kn"," mA/V²",1],["mirrorWl","wl","",1],["mirrorVth","vth"," V",2],["mirrorLambda","lambda"," V⁻¹",3]];
    mirrorBindings.forEach(function(b){bindRange(b[0],mirror,b[1],b[2],b[3],updateMirror);});
    $("mirrorPolarity").value=mirror.polarity;$("mirrorPolarity").addEventListener("change",function(){mirror.polarity=this.value;save();updateMirror();});
    [["cmosVdd","vdd"," V",1],["cmosVin","vin"," V",2],["cmosVtn","vtn"," V",2],["cmosVtp","vtp"," V",2],["cmosKn","kn"," mA/V²",1],["cmosKp","kp"," mA/V²",1],["cmosWl","wl","",1],["cmosCap","cap"," pF",0]].forEach(function(b){bindRange(b[0],cmos,b[1],b[2],b[3],updateCmos);});
    [["otaTail","itail"," mA",2],["otaKn","kn"," mA/V²",1],["otaWl","wl","",1],["otaVth","vth"," V",2],["otaVdd","vdd"," V",1],["otaRload","rload"," kΩ",0],["otaVdiff","vdiff"," V",3]].forEach(function(b){bindRange(b[0],ota,b[1],b[2],b[3],updateOta);});
    [["opRin","rin"," kΩ",0],["opRf","rf"," kΩ",0],["opAol","aol"," V/V",0],["opGbw","gbw"," Hz",0],["opVpos","vpos"," V",1],["opVneg","vneg"," V",1]].forEach(function(b){bindRange(b[0],opamp,b[1],b[2],b[3],updateOpamp);});
    $("opMode").value=opamp.mode;$("opMode").addEventListener("change",function(){opamp.mode=this.value;save();updateOpamp();});
    ["comparePair","compareMetric"].forEach(function(id){$(id).addEventListener("change",updateComparison);});
  }
  function refreshAmpControls() {
    [["ampVdd","vdd"],["ampVg","vgate"],["ampKn","kn"],["ampWl","wl"],["ampVth","vth"],["ampLambda","lambda"],["ampRd","rd"],["ampRs","rs"],["ampRl","rl"],["ampRsig","rsrc"],["ampC1","c1"],["ampC2","c2"],["ampCs","cs"]].forEach(function(x){if($(x[0])){$(x[0]).value=amp[x[1]];$(x[0]).dispatchEvent(new Event("input"));}});
    $("ampTopology").value=amp.topology;$("ampBypass").checked=amp.bypass;
  }
  function schedule(fn) {
    if (updateQueued) return;
    updateQueued=true;
    requestAnimationFrame(function(){updateQueued=false;fn();});
  }
  function c(re,im){return {re:re,im:im||0};}
  function add(a,b){return c(a.re+b.re,a.im+b.im);}
  function mul(a,b){return c(a.re*b.re-a.im*b.im,a.re*b.im+a.im*b.re);}
  function div(a,b){const d=b.re*b.re+b.im*b.im||1e-24;return c((a.re*b.re+a.im*b.im)/d,(a.im*b.re-a.re*b.im)/d);}
  function scale(a,s){return c(a.re*s,a.im*s);}
  function mag(a){return Math.hypot(a.re,a.im);}
  function phase(a){return Math.atan2(a.im,a.re);}
  function parallel(a,b){return (a*b)/(a+b||1e-24);}
  function parallelZ(r,z){return div(scale(z,r),add(c(r,0),z));}
  function capZ(capMicro,f){if(!f||!capMicro)return c(1e18,0);return c(0,-1/(2*Math.PI*f*capMicro*1e-6));}
  function solveBias(p) {
    const point=A.CircuitModels.solveAmplifierBias(p),beta=point.beta,rd=p.rd*1000,rs=p.rs*1000;
    const id=point.id,vs=point.vs,vd=point.vd,vov=point.vov,gm=point.gm,gds=point.gds,ro=gds>1e-12?1/gds:1e12;
    const rin=Math.max(1e3,500000), rload=parallel(parallel(rd,p.rl*1000),ro);
    const topology=p.topology;
    let mid;
    if(topology==="cg") mid=c(gm*rload,0);
    else if(topology==="cd") mid=c(gm*rload/(1+gm*rload),0);
    else if(topology==="cascode") mid=c(-gm*parallel(parallel(rd,p.rl*1000),Math.min(ro*ro*gm,1e12)),0);
    else if(topology==="two-stage"){
      const a=-gm*parallel(rd,1e6);
      const b=-gm*parallel(rd,p.rl*1000);
      mid=c(a*b,0);
    } else mid=c(-gm*rload,0);
    const sourceZ=function(f){if(topology==="cg"||topology==="cd"||topology==="cascode"||topology==="two-stage")return c(0,0);if(!p.bypass)return c(rs,0);return parallelZ(rs,capZ(p.cs,f));};
    const zIn=topology==="cg"?1/Math.max(gm,1e-12):rin;
    const zOut=topology==="cd"?parallel(1/Math.max(gm,1e-12),rs):parallel(rd,ro);
    const inCorner=1/(2*Math.PI*(p.rsrc*1000+10000)*p.c1*1e-6);
    const outCorner=1/(2*Math.PI*(p.rl*1000+rd)*p.c2*1e-6);
    const cgs=12e-12,cgd=2e-12;
    const highPole=1/(2*Math.PI*Math.max(parallel(p.rsrc*1000,rin),10)*(cgs+cgd*(1+mag(mid))));
    function transfer(f){
      let h=mid;
      if(topology==="cs"||topology==="degeneration"){
        const zs=sourceZ(f);
        h=div(c(-gm*rload,0),add(c(1,0),scale(zs,gm)));
      }
      const w=2*Math.PI*f;
      const hIn=div(c(0,w*p.c1*1e-6*(p.rsrc*1000)),c(1,w*p.c1*1e-6*(p.rsrc*1000+10000)));
      const hOut=div(c(0,w*p.c2*1e-6*(p.rl*1000)),c(1,w*p.c2*1e-6*(rd+p.rl*1000)));
      const hHigh=div(c(1,0),c(1,f/highPole));
      h=mul(mul(mul(h,hIn),hOut),hHigh);
      if(topology==="two-stage") h=mul(h,div(c(1,0),c(1,f/(highPole*1.6))));
      return h;
    }
    const freqs=logspace(1,1e9,121), response=freqs.map(function(f){const h=transfer(f);return {x:f,db:20*Math.log10(Math.max(mag(h),1e-12)),phase:phase(h)*180/Math.PI};});
    const peak=Math.max.apply(null,response.map(function(r){return r.db;})),cut=peak-3;
    const passed=response.filter(function(r){return r.db>=cut;});
    const fL=passed.length?passed[0].x:NaN,fH=passed.length?passed[passed.length-1].x:NaN;
    return {id:id,vs:vs,vd:vd,vds:point.vds,vgs:point.vgs,vov:vov,gm:gm,gds:gds,ro:ro,region:point.region,power:point.power,beta:beta,rload:rload,zIn:zIn,zOut:zOut,mid:mid,transfer:transfer,response:response,bandwidth:fH-fL,fL:fL,fH:fH,highPole:highPole,lowCorner:Math.max(inCorner,outCorner),topology:topology,stageGain:topology==="two-stage"?[-gm*parallel(rd,1e6),-gm*parallel(rd,p.rl*1000)]:[mid.re]};
  }
  function logspace(start,end,n){const a=Math.log10(start),b=Math.log10(end),out=[];for(let i=0;i<n;i++)out.push(Math.pow(10,a+(b-a)*i/(n-1)));return out;}
  function topologyLabel(id){return {cs:"Common source",cg:"Common gate",cd:"Common drain / source follower",cascode:"Cascode",degeneration:"Source-degenerated", "two-stage":"Two-stage common source"}[id]||"Common source";}
  function wave(x){const ph=2*Math.PI*x+gen.phase*Math.PI/180;if(gen.wave==="square")return Math.sin(ph)>=0?1:-1;if(gen.wave==="triangle")return 2/Math.PI*Math.asin(Math.sin(ph));return Math.sin(ph);}
  function acRms(values){if(!values.length)return NaN;const mean=values.reduce(function(s,v){return s+v;},0)/values.length;return Math.sqrt(values.reduce(function(s,v){return s+(v-mean)*(v-mean);},0)/values.length);}
  function chartBase(id, xType, yTitle, y2Title) {
    if(!window.Chart)return null;
    const canvas=$(id);if(!canvas)return null;
    if(charts[id])return charts[id];
    const scales={x:{type:xType||"linear",title:{display:true,text:xType==="logarithmic"?"Frequency (Hz)":"Time / input (engineering units)",color:COLORS.muted,font:{family:"DM Mono",size:9}},grid:{color:COLORS.grid},ticks:{color:COLORS.muted,font:{family:"DM Mono",size:9},maxTicksLimit:8}},y:{type:"linear",position:"left",title:{display:true,text:yTitle||"Value",color:COLORS.muted,font:{family:"DM Mono",size:9}},grid:{color:COLORS.grid},ticks:{color:COLORS.muted,font:{family:"DM Mono",size:9}}}};
    if(y2Title)scales.y1={type:"linear",position:"right",title:{display:true,text:y2Title,color:COLORS.amber,font:{family:"DM Mono",size:9}},grid:{drawOnChartArea:false},ticks:{color:COLORS.amber,font:{family:"DM Mono",size:9}}};
    charts[id]=new Chart(canvas.getContext("2d"),{type:"line",data:{datasets:[]},options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,interaction:{mode:"index",intersect:false},plugins:{legend:{labels:{color:"#cbd8e8",boxWidth:16,font:{size:10}}},tooltip:{backgroundColor:"#0b1220",borderColor:"#334963",borderWidth:1,titleColor:"#eff6ff",bodyColor:"#d1deeb"}},elements:{line:{borderWidth:2,tension:0},point:{radius:0,hitRadius:6}},scales:scales}});
    return charts[id];
  }
  function setLine(id, datasets, xType, yTitle, y2Title, xTitle) {
    const chart=chartBase(id,xType,yTitle,y2Title);if(!chart)return;
    chart.data.datasets=datasets;
    if(xTitle)chart.options.scales.x.title.text=xTitle;
    chart.update("none");
  }
  function publish(samples, frequency, waveform, extra) {
    const data=Object.assign({waveform:waveform,frequencyHz:frequency,amplitudePeak:gen.amp/1000,input:samples.input,output:samples.output,bypass:!!amp.bypass,biasCurrent:fmtCurrent(latest.amp&&latest.amp.id),region:latest.amp&&latest.amp.region,gm:latest.amp&&latest.amp.gm,power:latest.amp&&latest.amp.power,vth:amp.vth,beta:latest.amp&&latest.amp.beta,vdd:amp.vdd,gainDb:latest.amp&&latest.amp.gainDb},extra||{});
    window.dispatchEvent(new CustomEvent("analogverse:amplifier-updated",{detail:data}));
  }
  function setDmm(data){if(A.Instruments&&A.Instruments.setDC)A.Instruments.setDC(data);}
  function updateActiveTransient(){if(selectedCircuit==="amplifier")updateAmp();else if(selectedCircuit==="cmos")updateCmos();else if(selectedCircuit==="ota")updateOta();else if(selectedCircuit==="opamp")updateOpamp();}
  function updateAmp() {
    if(!$('ampTopology'))return;
    const r=solveBias(amp),freq=gen.freq,at=r.transfer(freq),gain=mag(at),phaseRad=phase(at),gainDb=20*Math.log10(Math.max(gain,1e-12));
    const isFollower=amp.topology==="cd",center=isFollower?r.vs:r.vd;
    const sampleCount=360,span=2/freq,inputs=[],outputs=[];
    for(let i=0;i<=sampleCount;i++){
      const t=span*i/sampleCount,x=freq*t;
      const vi=gen.offset+(gen.amp/1000)*wave(x);
      const vo=center+gain*(gen.amp/1000)*wave(x+phaseRad/(2*Math.PI));
      inputs.push({x:t*1000,y:vi});outputs.push({x:t*1000,y:Math.max(0,Math.min(amp.vdd,vo))});
    }
    const signed=(at.re<0?"−":"+")+fmt(gain,2)+" V/V";
    $("ampGain").textContent=signed;$("ampGainDb").textContent=fmt(gainDb,2)+" dB";$("ampPhase").textContent=fmt(phaseRad*180/Math.PI,1)+"°";
    $("ampZin").textContent=fmtResistance(r.zIn);$("ampZout").textContent=fmtResistance(r.zOut);$("ampBandwidth").textContent=fmtFrequency(r.bandwidth)+" (−3 dB)";
    $("ampId").textContent=fmtCurrent(r.id);$("ampGm").textContent=fmt(r.gm*1000,3)+" mS";
    const clipped=outputs.some(function(p){return p.y<=0.0001||p.y>=amp.vdd-0.0001;});
    const warning=r.region!=="Saturation"?"Bias warning: MOSFET is in "+r.region.toLowerCase()+"; saturation gain equations are outside their intended Q-point.":clipped?"Signal warning: output samples reach a supply rail; small-signal gain no longer predicts the clipped waveform.":"Q-point is in saturation. Waveform uses a first-harmonic small-signal response.";
    $("ampWarning").textContent=warning;
    $("ampCircuitCaption").textContent=topologyLabel(amp.topology)+" · "+r.region+" · Q-point ID "+fmtCurrent(r.id);
    $("ampSchematic").innerHTML=schematic(amp.topology,r);
    $("ampEquation").innerHTML=equations(r,at,gainDb);
    setLine("ampWaveChart",[{label:"VIN (V)",data:inputs,borderColor:COLORS.blue,yAxisID:"y"},{label:"VOUT (V)",data:outputs,borderColor:COLORS.teal,yAxisID:"y1"}],"linear","VIN (V)","VOUT (V)","Time (ms)");
    if(charts.ampWaveChart){charts.ampWaveChart.options.scales.x.title.text="Time (ms)";charts.ampWaveChart.update("none");}
    setLine("ampBodeChart",[{label:"Gain (dB)",data:r.response.map(function(p){return{x:p.x,y:p.db};}),borderColor:COLORS.teal,yAxisID:"y"},{label:"Phase (°)",data:r.response.map(function(p){return{x:p.x,y:p.phase};}),borderColor:COLORS.amber,yAxisID:"y1"}],"logarithmic","Gain (dB)","Phase (°)","Frequency (Hz)");
    r.gain= gain;r.gainDb=gainDb;r.phase=phaseRad*180/Math.PI;r.frequency=freq;r.outputVpp=Math.max.apply(null,outputs.map(function(p){return p.y;}))-Math.min.apply(null,outputs.map(function(p){return p.y;}));
    latest.amp=r;
    const outputAc=acRms(outputs.map(function(p){return p.y;}));
    if(selectedCircuit==="amplifier")setDmm({voltage:center,current:r.id,resistance:Math.max(r.vds,0)/Math.max(r.id,1e-15),acVoltage:outputAc,source:topologyLabel(amp.topology)+" Q-point"});
    if(selectedCircuit==="amplifier")publish({input:inputs.map(function(p){return{t:p.x/1000,v:p.y};}),output:outputs.map(function(p){return{t:p.x/1000,v:p.y};})},freq,gen.wave,{biasCurrent:fmtCurrent(r.id),region:r.region,gm:r.gm,power:r.power,vth:amp.vth,beta:r.beta,vdd:amp.vdd,gainDb:gainDb,bypass:amp.bypass,topology:topologyLabel(amp.topology),dcOutputV:center,dcCurrentA:r.id,equivalentResistanceOhm:Math.max(r.vds,0)/Math.max(r.id,1e-15),outputAcRms:outputAc});
    updateAdvanced();updateComparison();
  }
  function fmtFrequency(f){if(!Number.isFinite(f))return "—";if(f>=1e6)return fmt(f/1e6,2)+" MHz";if(f>=1e3)return fmt(f/1e3,2)+" kHz";return fmt(f,1)+" Hz";}
  function schematic(topology,r){
    const devices=topology==="cascode"?'<path d="M290 205v45m0 28v45"/><path d="M275 205v113m-20-112v111"/><text x="310" y="236">M1</text><path d="M290 278h105v-43m0 27v55"/><path d="M380 205v45m0 28v45m-15-113v113"/><text x="400" y="236">M2</text>':topology==="two-stage"?'<path d="M260 205v45m0 28v45m-15-113v113"/><text x="280" y="238">M1</text><path d="M410 205v45m0 28v45m-15-113v113"/><text x="430" y="238">M2</text><path d="M335 260h60"/>': '<path d="M330 205v45m0 28v45m-15-113v113"/><text x="350" y="238">M1</text>';
    const label=topologyLabel(topology);
    return '<svg viewBox="0 0 560 390" role="img" aria-label="Calculated '+label+' circuit sketch"><rect width="560" height="390" rx="12" fill="#f4f7fa"/><g fill="none" stroke="#62748a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M100 55h330M100 55v40m330-40v40m0 60v48m0 0H330M330 205V150m0 150v35M100 95v48m0 60v82m0 0v52M100 337h330"/><rect x="87" y="95" width="26" height="48" rx="3" fill="#fff"/><rect x="417" y="95" width="26" height="48" rx="3" fill="#fff"/><path d="M70 337h60m-49 8h38m-27 8h16"/><path d="M150 260h25"/><circle cx="150" cy="260" r="21" fill="#fff"/></g><g fill="none" stroke="#26384b" stroke-width="2.4" stroke-linecap="round">'+devices+'</g><g fill="#20354b" font-family="DM Mono,monospace" font-size="13"><text x="442" y="122">RD '+fmt(amp.rd,1)+' kΩ</text><text x="112" y="122">RBIAS</text><text x="442" y="49">VDD '+fmt(amp.vdd,1)+' V</text><text x="260" y="370">RS '+fmt(amp.rs,2)+' kΩ</text><text x="140" y="230">VIN</text><text x="410" y="187">VOUT</text><text x="242" y="172">'+label+'</text><text x="342" y="270">ID '+fmtCurrent(r.id)+'</text><text x="342" y="290">gm '+fmt(r.gm*1000,3)+' mS</text></g></svg>';
  }
  function equations(r,at,db){
    const beta=r.beta*1000;
    const rows=["β = Kn(W/L) = "+fmt(amp.kn,2)+" mA/V² × "+fmt(amp.wl,1)+" = "+fmt(beta,2)+" mA/V²", "DC solve: ID = ID(VG − ID·RS, VDD − ID·RD)", "Q-point: VGS = "+fmt(r.vgs,3)+" V; VDS = "+fmt(r.vds,3)+" V; VOV = "+fmt(r.vov,3)+" V; region = "+r.region, "gm = ∂ID/∂VGS ≈ βVOV = "+fmt(r.gm*1000,3)+" mS; ro ≈ 1/gds = "+fmtResistance(r.ro), "Aᵥ(f) at "+fmtFrequency(gen.freq)+" = "+(at.re<0?"−":"+")+fmt(mag(at),3)+" V/V ∠ "+fmt(phase(at)*180/Math.PI,1)+"°; |Aᵥ|dB = 20 log₁₀|Aᵥ| = "+fmt(db,2)+" dB", "Power in M1 = ID·VDS = "+fmt(r.power*1000,3)+" mW; lower/upper −3 dB crossings ≈ "+fmtFrequency(r.fL)+" / "+fmtFrequency(r.fH), "Stage gains (two-stage model) = "+r.stageGain.map(function(g){return fmt(g,2);}).join(" × ")];
    return rows.map(function(x){return '<div class="equation-row"><span class="equation-dot">›</span><span>'+x+'</span></div>';}).join("");
  }
  function updateMirror(){
    if(!$('mirrorIout'))return;
    const polarity=mirror.polarity,ratio=mirror.ratio,wl=mirror.wl,lambda=mirror.lambda,vth=mirror.vth,vdd=mirror.vdd;
    const solved=A.CircuitModels.mirror(mirror),beta=solved.beta,vov=solved.vov,vg=solved.gateVoltage,vout=solved.vout;
    const p={vth:vth,knMilli:mirror.kn,wl:wl*ratio,lambda:lambda};
    const actual=solved.current,ideal=solved.ideal,err=solved.errorPercent;
    $("mirrorIout").textContent=fmtCurrent(actual);$("mirrorIdeal").textContent=fmtCurrent(ideal);$("mirrorError").textContent=fmt(err,2)+"%";$("mirrorVov").textContent=fmt(vov,3)+" V";
    const compliance=vout>=vov;
    $("mirrorWarning").textContent=compliance?"Output device is at or above the estimated saturation-compliance voltage.":"Output voltage is below the estimated compliance voltage; the output device is in triode and current regulation degrades.";
    $("mirrorCalc").innerHTML=["βREF = Kn(W/L) = "+fmt(beta*1000,2)+" mA/V²", "Gate overdrive solved from IREF = βREF·VOV²/2·(1 + λVGS): VOV = "+fmt(vov,3)+" V", "Ideal mirror: IOUT = IREF·(W/L)OUT/(W/L)REF = "+fmtCurrent(ideal), "Non-ideal: square-law output device at VOUT = "+fmt(vout,2)+" V gives "+fmtCurrent(actual)+"; relative error = "+fmt(err,2)+"%"].map(function(x){return '<div class="equation-row"><span class="equation-dot">›</span><span>'+x+'</span></div>';}).join("");
    const xs=Array.from({length:101},function(_,i){return vdd*i/100;}),curve=xs.map(function(x){return{x:x,y:A.DeviceModel.current(vg,x,p).id*1000};}),idealLine=xs.map(function(x){return{x:x,y:ideal*1000};});
    setLine("mirrorChart",[{label:"Square-law mirror",data:curve,borderColor:COLORS.teal},{label:"Ideal ratio",data:idealLine,borderColor:COLORS.amber,borderDash:[5,4]}],"linear","Output current (mA)",null,"Output voltage magnitude (V)");
    latest.mirror={actual:actual,ideal:ideal,err:err,vov:vov,vout:vout,polarity:polarity};updateComparison();
    if(selectedCircuit==="current-mirror")setDmm({voltage:vout,current:actual,resistance:vout/Math.max(actual,1e-15),acVoltage:0,source:polarity.toUpperCase()+" current mirror DC output"});
  }
  function nmosCurrent(vg,vd,beta,vth,lambda){const ov=vg-vth;if(ov<=0||vd<=0)return 0;if(vd<ov)return beta*(ov*vd-0.5*vd*vd)*(1+lambda*vd);return 0.5*beta*ov*ov*(1+lambda*vd);}
  function pmosCurrent(vg,vd,vdd,beta,vth,lambda){const ov=(vdd-vg)-vth,vsd=vdd-vd;if(ov<=0||vsd<=0)return 0;if(vsd<ov)return beta*(ov*vsd-0.5*vsd*vsd)*(1+lambda*vsd);return 0.5*beta*ov*ov*(1+lambda*vsd);}
  function inverter(vin){return A.CircuitModels.solveInverter(Object.assign({lambda:0.01},cmos),vin);}
  function updateCmos(){
    if(!$('cmosVout'))return;
    const vinControl=$("cmosVin");if(vinControl){vinControl.max=cmos.vdd;vinControl.value=Math.min(Number(vinControl.value),cmos.vdd);if($("cmosVinOut"))$("cmosVinOut").textContent=fmt(Number(vinControl.value),2)+" V";}cmos.vin=Math.min(cmos.vin,cmos.vdd);
    const r=inverter(Math.max(0,Math.min(cmos.vin,cmos.vdd))),sampleCount=201,vtc=[];
    for(let i=0;i<sampleCount;i++){const v=cmos.vdd*i/(sampleCount-1);vtc.push({x:v,y:inverter(v).vout});}
    let switchV=cmos.vdd/2,min=Infinity;vtc.forEach(function(p){const e=Math.abs(p.x-p.y);if(e<min){min=e;switchV=p.x;}});
    const dynamic=cmos.cap*1e-12*cmos.vdd*cmos.vdd*gen.freq;
    $("cmosVout").textContent=fmt(r.vout,3)+" V";$("cmosSwitch").textContent=fmt(switchV,3)+" V";$("cmosLogic").textContent=(cmos.vin>switchV?"HIGH":"LOW")+" → "+(r.vout>switchV?"HIGH":"LOW");$("cmosPstatic").textContent=fmt(r.staticPower*1000,4)+" mW";$("cmosPdynamic").textContent=fmt(dynamic*1000,4)+" mW";$("cmosBranch").textContent=fmtCurrent(r.branch);
    setLine("cmosVtcChart",[{label:"VOUT(VIN)",data:vtc,borderColor:COLORS.teal},{label:"VOUT = VIN",data:vtc.map(function(p){return{x:p.x,y:p.x};}),borderColor:COLORS.muted,borderDash:[4,4]}],"linear","Output voltage (V)",null,"Input voltage (V)");
    const f=gen.freq,span=2/f,pts=[];for(let i=0;i<=360;i++){const t=span*i/360,drive=wave(f*t),vin=gen.wave==="square"?(drive>0?cmos.vdd:0):gen.offset+gen.amp/1000*drive;pts.push({t:t,vin:vin,vout:inverter(Math.max(0,Math.min(cmos.vdd,vin))).vout});}
    setLine("cmosWaveChart",[{label:"VIN (V)",data:pts.map(function(p){return{x:p.t*1000,y:p.vin};}),borderColor:COLORS.blue},{label:"VOUT (V)",data:pts.map(function(p){return{x:p.t*1000,y:p.vout};}),borderColor:COLORS.teal}],"linear","Voltage (V)",null,"Time (ms)");
    $("cmosCalc").innerHTML=["DC node solve: IN = IP at VOUT = "+fmt(r.vout,3)+" V; branch current = "+fmtCurrent(r.branch),"Switching threshold from |VOUT − VIN| minimum on the computed transfer sweep: VM ≈ "+fmt(switchV,3)+" V", "Static power = VDD·Ibranch = "+fmt(r.staticPower*1000,4)+" mW; dynamic estimate = αCLVDD²f = "+fmt(dynamic*1000,4)+" mW for α = 1", "NMOS region "+(cmos.vin-cmos.vtn>r.vout?"triode":"saturation/cutoff")+"; PMOS region evaluated from VSG and VSD magnitudes"].map(function(x){return '<div class="equation-row"><span class="equation-dot">›</span><span>'+x+'</span></div>';}).join("");
    latest.cmos={vout:r.vout,branch:r.branch,switchV:switchV,dynamic:dynamic,static:r.staticPower};
    const transientSamples={input:pts.map(function(p){return{t:p.t,v:p.vin};}),output:pts.map(function(p){return{t:p.t,v:p.vout};})};
    const cmosAc=acRms(pts.map(function(p){return p.vout;}));
    if(selectedCircuit==="cmos"){publish(transientSamples,f,gen.wave,{topology:"CMOS inverter",biasCurrent:fmtCurrent(r.branch),region:"complementary logic",gm:NaN,power:r.staticPower,vdd:cmos.vdd,gainDb:NaN,bypass:false,dcOutputV:r.vout,dcCurrentA:r.branch,equivalentResistanceOhm:r.vout/Math.max(r.branch,1e-15),outputAcRms:cmosAc});setDmm({voltage:r.vout,current:r.branch,resistance:r.vout/Math.max(r.branch,1e-15),acVoltage:cmosAc,source:"CMOS inverter output and supply branch"});}
    updateComparison();
  }
  function otaCurrent(vd){return A.CircuitModels.otaDifference(ota,vd).current;}
  function updateOta(){
    if(!$('otaIout'))return;
    const beta=ota.kn*1e-3*ota.wl,it=ota.itail*1e-3,gm0=Math.sqrt(Math.max(beta*it,0)),limit=Math.sqrt(2*it/Math.max(beta,1e-15)),id=otaCurrent(ota.vdiff),vout=Math.max(-ota.vdd,Math.min(ota.vdd,id*ota.rload*1000));
    $("otaIout").textContent=fmtCurrent(id);$("otaGm").textContent=fmt(gm0*1000,3)+" mS";$("otaSwing").textContent="±"+fmt(limit,3)+" V";$("otaVout").textContent=fmt(vout,3)+" V";
    const pts=[];for(let i=0;i<=180;i++){const vd=-Math.max(limit*1.25,0.01)+2*Math.max(limit*1.25,0.01)*i/180;pts.push({x:vd,y:otaCurrent(vd)*1000});}
    setLine("otaChart",[{label:"IDIFF = I1 − I2",data:pts,borderColor:COLORS.teal},{label:"Small-signal slope at origin",data:pts.map(function(p){return{x:p.x,y:Math.max(-it,Math.min(it,gm0*p.x))*1000};}),borderColor:COLORS.amber,borderDash:[5,4]}],"linear","Output current (mA)",null,"Differential input voltage (V)");
    $("otaCalc").innerHTML=["Matched pair: IDIFF = β·VD·√(ITAIL/β − VD²/4), limited to ±ITAIL", "β = Kn(W/L) = "+fmt(beta*1000,2)+" mA/V²; ITAIL = "+fmtCurrent(it), "At VD = "+fmt(ota.vdiff,3)+" V, IDIFF = "+fmtCurrent(id)+"; gm,pair at zero input ≈ √(βITAIL) = "+fmt(gm0*1000,3)+" mS", "With RL = "+fmt(ota.rload,1)+" kΩ, single-ended load estimate = "+fmt(vout,3)+" V after rail clamp"].map(function(x){return '<div class="equation-row"><span class="equation-dot">›</span><span>'+x+'</span></div>';}).join("");
    latest.ota={id:id,gm:gm0,limit:limit,vout:vout};
    const freq=gen.freq,span=2/freq,ins=[],outs=[];for(let i=0;i<=360;i++){const t=span*i/360,vin=gen.offset+gen.amp/1000*wave(freq*t),vd=2*vin,v=otaCurrent(vd)*ota.rload*1000;ins.push({t:t,v:vin});outs.push({t:t,v:Math.max(-ota.vdd,Math.min(ota.vdd,v))});}
    const otaAc=acRms(outs.map(function(p){return p.v;}));
    const tab=document.querySelector('[data-ota-tab].active');if(selectedCircuit==="ota"&&tab&&tab.dataset.otaTab==="ota"){publish({input:ins,output:outs},freq,gen.wave,{topology:"Differential-pair OTA · load-voltage view",biasCurrent:fmtCurrent(it/2),region:"matched differential pair",gm:gm0,power:ota.vdd*it,vth:ota.vth,beta:beta,vdd:ota.vdd,gainDb:NaN,bypass:false,dcOutputV:vout,dcCurrentA:id,equivalentResistanceOhm:Math.abs(vout)/Math.max(Math.abs(id),1e-15),outputAcRms:otaAc});setDmm({voltage:vout,current:id,resistance:Math.abs(vout)/Math.max(Math.abs(id),1e-15),acVoltage:otaAc,source:"OTA differential output driving RL"});}
  }
  function opTransfer(f){
    return A.CircuitModels.opAmpTransfer(opamp,f);
  }
  function updateOpamp(){
    if(!$('opClosedGain'))return;
    const inputPeak=gen.amp/1000,lo=opTransfer(1),magOpen=mag(lo.open),closed=lo.closed,ideal=opamp.mode==="noninv"?1+opamp.rf/opamp.rin:-opamp.rf/opamp.rin;
    const bw=opamp.gbw/(1+opamp.rf/opamp.rin),freq=gen.freq||1000,ac=opTransfer(freq),outpk=mag(ac.closed)*inputPeak,positive=opamp.vpos,negative=-Math.abs(opamp.vneg),clip=Math.min(positive,Math.max(negative,outpk));
    $("opClosedGain").textContent=(closed.re<0?"−":"+")+fmt(mag(closed),2)+" V/V";$("opIdealGain").textContent=fmt(ideal,2)+" V/V";$("opOpenGain").textContent=fmt(magOpen,0)+" V/V";$("opBandwidth").textContent=fmtFrequency(bw);$("opOutput").textContent=fmt(clip,3)+" Vpk";$("opPhase").textContent=fmt(phase(ac.closed)*180/Math.PI,1)+"°";
    const fs=logspace(1,Math.max(opamp.gbw*100,1e7),121),datasets=[{label:"Open-loop |Aol| (dB)",data:fs.map(function(f){return{x:f,y:20*Math.log10(Math.max(mag(opTransfer(f).open),1e-12))};}),borderColor:COLORS.amber},{label:"Closed-loop |Acl| (dB)",data:fs.map(function(f){return{x:f,y:20*Math.log10(Math.max(mag(opTransfer(f).closed),1e-12))};}),borderColor:COLORS.teal}];
    setLine("opBodeChart",datasets,"logarithmic","Gain (dB)",null,"Frequency (Hz)");
    const pointsIn=[],pointsOut=[],w=gen.freq,span=2/w;for(let i=0;i<=360;i++){const t=span*i/360,vin=gen.offset+inputPeak*wave(w*t),raw=lo.closed.re*gen.offset+mag(ac.closed)*inputPeak*wave(w*t+phase(ac.closed)/(2*Math.PI));pointsIn.push({x:t*1000,y:vin});pointsOut.push({x:t*1000,y:Math.max(negative,Math.min(positive,raw))});}
    setLine("opWaveChart",[{label:"VIN (V)",data:pointsIn,borderColor:COLORS.blue},{label:"VOUT (V)",data:pointsOut,borderColor:COLORS.teal}],"linear","Voltage (V)",null,"Time (ms)");
    $("opCalc").innerHTML=["Open-loop pole: fp = GBW/A0 = "+fmtFrequency(opamp.gbw/opamp.aol),"Ideal closed-loop gain = "+fmt(ideal,3)+" V/V; finite-A0 result at low frequency = "+(closed.re<0?"−":"+")+fmt(mag(closed),3)+" V/V", "Closed-loop bandwidth estimate ≈ GBW / noise gain = "+fmtFrequency(bw), "At input peak "+fmt(inputPeak,3)+" V, predicted output peak "+fmt(outpk,3)+" V; rail-limited waveform peak = "+fmt(clip,3)+" V"].map(function(x){return '<div class="equation-row"><span class="equation-dot">›</span><span>'+x+'</span></div>';}).join("");
    latest.opamp={closed:closed,open:lo.open,bw:bw,ideal:ideal,output:clip};
    const opValues=pointsOut.map(function(p){return p.y;}),opAc=acRms(opValues),opDc=opValues.reduce(function(s,v){return s+v;},0)/opValues.length;
    const tab=document.querySelector('[data-ota-tab].active');if(selectedCircuit==="opamp"&&tab&&tab.dataset.otaTab==="opamp"){publish({input:pointsIn.map(function(p){return{t:p.x/1000,v:p.y};}),output:pointsOut.map(function(p){return{t:p.x/1000,v:p.y};})},w,gen.wave,{topology:"Finite-gain feedback op-amp",biasCurrent:"ideal block model",region:"closed-loop",gm:NaN,power:NaN,vth:NaN,beta:NaN,vdd:positive,gainDb:20*Math.log10(Math.max(mag(ac.closed),1e-12)),bypass:false,dcOutputV:opDc,dcCurrentA:NaN,equivalentResistanceOhm:NaN,outputAcRms:opAc});setDmm({voltage:opDc,current:NaN,resistance:NaN,acVoltage:opAc,source:"Finite-gain feedback op-amp block"});}
    updateComparison();
  }
  function updateAdvanced(){
    if(!$('advTopology')||!latest.amp)return;
    const r=latest.amp;
    $("advTopology").textContent=topologyLabel(amp.topology);$("advOpPoint").textContent="ID "+fmtCurrent(r.id)+" · VGS "+fmt(r.vgs,2)+" V · VDS "+fmt(r.vds,2)+" V";$("advGm").textContent=fmt(r.gm*1000,3)+" mS";$("advRout").textContent=fmtResistance(r.ro);$("advGain").textContent=(r.gain<0?"−":"+")+fmt(Math.abs(r.gain),2)+" V/V";$("advPower").textContent=fmt(r.power*1000,3)+" mW";
    $("advancedSteps").innerHTML=equations(r,r.transfer(gen.freq),r.gainDb);
    setLine("advancedBodeChart",[{label:"Gain (dB)",data:r.response.map(function(x){return{x:x.x,y:x.db};}),borderColor:COLORS.teal,yAxisID:"y"},{label:"Phase (°)",data:r.response.map(function(x){return{x:x.x,y:x.phase};}),borderColor:COLORS.amber,yAxisID:"y1"}],"logarithmic","Gain (dB)","Phase (°)","Frequency (Hz)");
    $("smallSignalSchematic").innerHTML='<svg viewBox="0 0 600 260" role="img" aria-label="Small-signal MOSFET model"><rect width="600" height="260" rx="12" fill="#f4f7fa"/><g fill="none" stroke="#50657d" stroke-width="2.5"><path d="M70 130h110m60 0h90m60 0h145M300 60v70m0 0v76m-22 0h44m-38 8h32m-24 8h16"/><circle cx="210" cy="130" r="4" fill="#008e83"/><path d="M280 98v64m18-64v64m17-64v64"/><path d="M313 130h15m-105 0v50h170v-50"/></g><g fill="#20354b" font-family="DM Mono,monospace" font-size="14"><text x="55" y="112">gate input</text><text x="165" y="112">vgs</text><text x="255" y="50">gm·vgs</text><text x="342" y="108">ro</text><text x="415" y="112">RD ∥ RL</text><text x="350" y="220">source degeneration / bypass</text><text x="100" y="55">Q-point: ID '+fmtCurrent(r.id)+' · gm '+fmt(r.gm*1000,3)+' mS</text></g></svg>';
  }
  function comparisonData(pair){
    const r=latest.amp||solveBias(amp), mirrorData=latest.mirror||{actual:0,ideal:0}, op=latest.opamp||{open:c(opamp.aol,0),closed:c(opamp.aol/(1+opamp.aol*opamp.rin/(opamp.rin+opamp.rf)),0),bw:opamp.gbw};
    function ampData(top){const q=solveBias(Object.assign({},amp,{topology:top})),g=mag(q.transfer(gen.freq));return{gain:g,gainDb:20*Math.log10(Math.max(g,1e-12)),zin:q.zIn,zout:q.zOut,bandwidth:q.bandwidth,power:q.power*1000};}
    if(pair==="cs-cg")return{labels:["Common source","Common gate"],a:ampData("cs"),b:ampData("cg")};
    if(pair==="cs-cd")return{labels:["Common source","Source follower"],a:ampData("cs"),b:ampData("cd")};
    if(pair==="cs-cascode")return{labels:["Common source","Cascode"],a:ampData("cs"),b:ampData("cascode")};
    if(pair==="bypass"){const a=ampData("cs"),old=amp.bypass;amp.bypass=true;const b=ampData("cs");amp.bypass=old;return{labels:["Unbypassed","Bypassed"],a:a,b:b};}
    if(pair==="nmos-pmos"){const a=ampData("cs"),b=Object.assign({},a);return{labels:["NMOS magnitude","PMOS magnitude"],a:a,b:b};}
    if(pair==="mirror"){return{labels:["Ideal mirror","Non-ideal mirror"],a:{gain:mirrorData.ideal/Math.max(mirror.iref*1e-3,1e-12),gainDb:20*Math.log10(Math.max(mirrorData.ideal/Math.max(mirror.iref*1e-3,1e-12),1e-12)),zin:Infinity,zout:Infinity,bandwidth:Infinity,power:(mirror.iref*1e-3+mirrorData.ideal)*mirror.vdd*1000},b:{gain:mirrorData.actual/Math.max(mirror.iref*1e-3,1e-12),gainDb:20*Math.log10(Math.max(mirrorData.actual/Math.max(mirror.iref*1e-3,1e-12),1e-12)),zin:Infinity,zout:1/Math.max(mirror.lambda*mirrorData.actual,1e-12),bandwidth:Infinity,power:(mirror.iref*1e-3+mirrorData.actual)*mirror.vdd*1000}};}
    return{labels:["Open-loop op-amp","Closed-loop op-amp"],a:{gain:mag(op.open),gainDb:20*Math.log10(Math.max(mag(op.open),1e-12)),zin:Infinity,zout:0,bandwidth:opamp.gbw/opamp.aol,power:0},b:{gain:mag(op.closed),gainDb:20*Math.log10(Math.max(mag(op.closed),1e-12)),zin:opamp.mode==="noninv"?Infinity:opamp.rin*1000,zout:100,bandwidth:op.bw,power:0}};
  }
  function updateComparison(){
    if(!$('comparePair'))return;
    const d=comparisonData($("comparePair").value),metricKey=$("compareMetric").value,labels={gain:"Gain / transfer ratio",gainDb:"Gain magnitude (dB)",zin:"Input impedance (Ω)",zout:"Output impedance (Ω)",bandwidth:"Bandwidth (Hz)",power:"Power (mW)"},a=d.a[metricKey],b=d.b[metricKey];
    $("compareLabelA").textContent=d.labels[0];$("compareLabelB").textContent=d.labels[1];$("compareGraphCaption").textContent=labels[metricKey]+" · same bias and load where applicable";
    const rows=[["Voltage gain / current ratio",d.a.gain,d.b.gain,"V/V or A/A"],["Gain magnitude",d.a.gainDb,d.b.gainDb,"dB"],["Input impedance",d.a.zin,d.b.zin,"Ω"],["Output impedance",d.a.zout,d.b.zout,"Ω"],["Bandwidth",d.a.bandwidth,d.b.bandwidth,"Hz"],["Power",d.a.power,d.b.power,"mW"]];
    $("compareRows").innerHTML=rows.map(function(row){const diff=row[2]-row[1];return '<tr><td>'+row[0]+'</td><td>'+fmtMetric(row[1],row[3])+'</td><td>'+fmtMetric(row[2],row[3])+'</td><td>'+fmtMetric(diff,row[3])+'</td></tr>';}).join("");
    setLine("comparisonChart",[{label:d.labels[0],data:[{x:0,y:Number.isFinite(a)?a:0}],borderColor:COLORS.blue,backgroundColor:COLORS.blue,pointRadius:6,showLine:false},{label:d.labels[1],data:[{x:1,y:Number.isFinite(b)?b:0}],borderColor:COLORS.teal,backgroundColor:COLORS.teal,pointRadius:6,showLine:false}],"linear",labels[metricKey],null,"Matched circuit");
    if(charts.comparisonChart){charts.comparisonChart.options.scales.x.ticks.callback=function(v){return v===0?d.labels[0]:v===1?d.labels[1]:"";};charts.comparisonChart.update("none");}
  }
  function fmtMetric(v,u){if(!Number.isFinite(v))return "—";if(u==="Ω")return fmtResistance(v);if(u==="Hz")return fmtFrequency(v);return fmt(v,3)+" "+u;}
  function wireStaticPageNav(){
    document.querySelectorAll("[data-open]").forEach(function(button){button.addEventListener("click",function(){if(button.dataset.open==="amplifier")A.App.openAmplifier("default");else A.App.navigate(button.dataset.open);});});
  }
  function createPages(){
    createAmpUI();createMirrorPage();createCmosPage();createOtaPage();createAdvancedPage();createComparisonPage();createGenerator();createDocumentation();
    const deviceDrawing=diagramPanel("MOSFET construction and operating regions","Gate voltage forms or removes the inversion channel; drain voltage sets the region for the selected polarity.",'<g fill="none" stroke="#526a82" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="105" y="110" width="410" height="80" rx="4" fill="#dce6ef"/><rect x="150" y="80" width="82" height="30" rx="3" fill="#8cc8be"/><rect x="388" y="80" width="82" height="30" rx="3" fill="#8cc8be"/><rect x="255" y="62" width="110" height="8" fill="#b7c7d6"/><rect x="255" y="43" width="110" height="19" fill="#e2b66d"/><path d="M191 96v-34m0-7V28m267 68v-34m0-7V28M310 43V20m0-4v-9M106 190h410"/><path d="M235 128h147" stroke="#008e83" stroke-width="5"/><path d="M255 136l12-8-12-8m92 16 12-8-12-8" stroke="#008e83"/></g><g fill="#20354b" font-family="DM Mono,monospace" font-size="13"><text x="153" y="75">N+ SOURCE</text><text x="392" y="75">N+ DRAIN</text><text x="283" y="39">GATE</text><text x="276" y="61">OXIDE</text><text x="228" y="173">P-type substrate / body</text><text x="265" y="128">Inversion channel</text><text x="77" y="24">G</text><text x="180" y="24">S</text><text x="458" y="24">D</text></g>');
    document.querySelector('[data-page="mosfet"] .chart-grid').insertAdjacentHTML("beforebegin",deviceDrawing);
    const dash=document.querySelector('[data-page="dashboard"] .launch-list');
    dash.insertAdjacentHTML("beforeend",'<button class="launch-card" data-open="current-mirror"><span class="launch-icon amber-icon">IM</span><span class="launch-copy"><strong>Current mirror and CMOS labs</strong><small>Output compliance, mirror error, inverter transfer curve and power</small></span><span class="launch-arrow">↗</span></button><button class="launch-card" data-open="ota"><span class="launch-icon blue-icon">OTA</span><span class="launch-copy"><strong>OTA, op-amp and performance analysis</strong><small>Differential transconductance, feedback, Bode response and comparisons</small></span><span class="launch-arrow">↗</span></button>');
  }
  function initCharts(){
    if(!window.Chart){document.querySelectorAll(".chart-area").forEach(function(box){const n=document.createElement("p");n.className="chart-fallback";n.textContent="Chart.js is unavailable; connect to the internet and reload to enable interactive plots.";box.appendChild(n);});return;}
    ["ampWaveChart","ampBodeChart","mirrorChart","cmosVtcChart","cmosWaveChart","otaChart","opBodeChart","opWaveChart","advancedBodeChart","comparisonChart"].forEach(function(id){const el=$(id);if(!el)return;const x=id.indexOf("Bode")>=0?"logarithmic":"linear";chartBase(id,x,id.indexOf("Wave")>=0?"Voltage (V)":"Calculated value");});
    if(charts.ampWaveChart){charts.ampWaveChart.options.scales.y1={type:"linear",position:"right",grid:{drawOnChartArea:false},title:{display:true,text:"VOUT (V)",color:COLORS.teal}};}
    if(charts.ampBodeChart){charts.ampBodeChart.options.scales.y1={type:"linear",position:"right",grid:{drawOnChartArea:false},title:{display:true,text:"Phase (°)",color:COLORS.amber}};}
    if(charts.advancedBodeChart){charts.advancedBodeChart.options.scales.y1={type:"linear",position:"right",grid:{drawOnChartArea:false},title:{display:true,text:"Phase (°)",color:COLORS.amber}};}
  }
  function activate(name){
    activePage=name;
    if(name==="amplifier"||name==="cmos"||name==="current-mirror"||name==="mosfet")selectedCircuit=name;
    if(name==="ota"){const currentTab=document.querySelector('[data-ota-tab].active');selectedCircuit=currentTab&&currentTab.dataset.otaTab==="opamp"?"opamp":"ota";}
    if((name==="current-mirror"||name==="mosfet")&&A.Instruments&&A.Instruments.clear)A.Instruments.clear(name==="mosfet"?"MOSFET characterization is a DC analysis; no time-domain trace is active.":"Current mirror is a DC analysis; its output characteristics are shown in the lab.");
    if(name==="instruments"){
      const note=$("generatorSource");if(note)note.textContent="Oscilloscope and measurements follow the latest transient circuit model. Current mirror is a DC-only lab.";
    }
    Object.keys(charts).forEach(function(k){if(charts[k]&&charts[k].resize)charts[k].resize();});
    if(name==="amplifier")updateAmp();if(name==="current-mirror")updateMirror();if(name==="cmos")updateCmos();if(name==="ota"){const tab=document.querySelector('[data-ota-tab].active');if(tab&&tab.dataset.otaTab==="opamp")updateOpamp();else updateOta();}if(name==="advanced")updateAdvanced();if(name==="comparison")updateComparison();
  }
  function reset(){amp=Object.assign({},defaults);gen=Object.assign({},genDefaults);save();refreshAmpControls();if($("genWave")){$("genWave").value=gen.wave;["genFreq","genAmp","genOffset","genPhase"].forEach(function(id){$(id).dispatchEvent(new Event("input"));});}updateAmp();}
  function init(){
    if(!$('topologyLabMount'))return;
    createPages();bindAll();initCharts();
    updateAmp();updateMirror();updateCmos();updateOta();updateOpamp();updateAdvanced();updateComparison();
  }
  document.addEventListener("DOMContentLoaded",init,{once:true});
  A.AdvancedLabs={activate:activate,reset:reset,setTopology:function(id){amp.topology=id;save();if($("ampTopology"))$("ampTopology").value=id;updateAmp();},setGenerator:function(values){Object.assign(gen,values);save();updateActiveTransient();},getState:function(){return{amplifier:amp,generator:gen,mirror:mirror,cmos:cmos,ota:ota,opamp:opamp,results:latest};},getReportCharts:function(){const out={};Object.keys(charts).forEach(function(id){if(charts[id]&&charts[id].toBase64Image)out[id.replace(/Chart$/," chart")]=charts[id].toBase64Image();});return out;}};
}());
