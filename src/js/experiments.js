(function () {
  "use strict";
  window.Analogverse = window.Analogverse || {};
  const A = window.Analogverse;

const experiments = A.ExperimentData;

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }
  function circuitThumbnail(ex) {
    const label = ex.kind === "device" ? "NMOS device" : ex.kind === "topology" ? ex.topology.toUpperCase() + " stage" : ex.kind === "mirror" ? "Current mirror" : ex.kind === "cmos" ? "CMOS inverter" : ex.kind === "ota" ? "Differential pair" : ex.kind === "opamp" ? "Feedback op-amp" : "Common-source stage";
    let detail = '<path d="M58 27h18m26 0h22m18 0h23M91 12v30m-9-29v28m20-28v28"/><text x="110" y="19">M1</text>';
    if (ex.kind === "mirror") detail = '<path d="M48 27h18m26 0h20m18 0h18m18 0h16M82 12v30m-9-29v28m54-28v28m-9-28v28m-4 14h-10"/><text x="66" y="18">REF</text><text x="132" y="18">OUT</text>';
    if (ex.kind === "cmos") detail = '<path d="M92 8v10m0 18v14m-32-25h23m18 0h26m-35-9v18m-8-17v16m8-1v16m-8-16v16m9-8h24"/><circle cx="92" cy="23" r="8"/><text x="116" y="19">P</text><text x="116" y="41">N</text>';
    if (ex.kind === "ota") detail = '<path d="M43 29h28m18 0h25m18 0h28m-63-1V13m0 17v17m-9-34v32m18-32v32m-18 0h18m-4 7h-10m-23-23h-18m74 0h18"/><text x="71" y="19">M1</text><text x="105" y="19">M2</text>';
    if (ex.kind === "opamp") detail = '<path d="M73 8l55 20-55 20zM43 20h30m-30 20h30m55-12h31m-27 0v-13h-53"/><text x="78" y="25">+</text><text x="78" y="39">−</text><text x="95" y="31">A</text>';
    return '<div class="experiment-schematic"><svg viewBox="0 0 180 56" role="img" aria-label="' + esc(label) + ' diagram"><rect width="180" height="56" rx="7" fill="#f4f7fa"/><g fill="none" stroke="#60758d" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M35 6h109M35 6v13m109-13v13M35 44v6m109-6v6"/>' + detail + '</g><g fill="#263a50" font-family="monospace" font-size="6"><text x="5" y="30">IN</text><text x="147" y="30">OUT</text><text x="6" y="52">' + esc(label) + '</text></g></svg></div>';
  }
  function renderRecent() {
    const target = document.getElementById("recentExperiments");
    if (!target) return;
    target.innerHTML = experiments.slice(0, 4).map(function (ex, index) {
      return '<div class="recent-item"><span class="recent-num">0' + (index + 1) + '</span><span class="recent-copy"><strong>' + esc(ex.title) + '</strong><small>' + esc(ex.tag) + '</small></span><button class="text-button" data-recent="' + esc(ex.id) + '">Run →</button></div>';
    }).join("");
    target.querySelectorAll("[data-recent]").forEach(function (button) {
      button.addEventListener("click", function () { launch(button.dataset.recent); });
    });
  }
  function render() {
    const target = document.getElementById("experimentList");
    if (!target) return;
    document.getElementById("experimentCount").textContent = String(experiments.length);
    target.innerHTML = experiments.map(function (ex, index) {
      return '<article class="experiment-card"><div class="experiment-card-head"><div><span class="experiment-number">EXP ' + String(index + 1).padStart(2, "0") + '</span><h3>' + esc(ex.title) + '</h3></div><span class="experiment-tag">' + esc(ex.tag) + '</span></div>' + circuitThumbnail(ex) +
        '<p><b>Objective:</b> ' + esc(ex.objective) + '</p><div class="equation">' + esc(ex.equation) + '</div>' +
        '<details><summary>View theory, components, procedure, and conclusion</summary><p><b>Theory:</b> ' + esc(ex.theory) + '</p><p><b>Components:</b> ' + esc(ex.components) + '</p><p><b>Procedure:</b> ' + esc(ex.procedure) + '</p><p><b>Model observation:</b> ' + esc(ex.observation) + '</p><p><b>Conclusion:</b> ' + esc(ex.conclusion) + '</p></details>' +
        '<footer><span>Results calculate in the linked lab</span><button class="text-button" data-experiment-launch="' + esc(ex.id) + '">Open experiment →</button></footer></article>';
    }).join("");
    target.querySelectorAll("[data-experiment-launch]").forEach(function (button) {
      button.addEventListener("click", function () { launch(button.dataset.experimentLaunch); });
    });
    const select = document.getElementById("reportExperiment");
    select.innerHTML = '<option value="all">Combined report · all experiments</option>' + experiments.map(function (ex) { return '<option value="' + esc(ex.id) + '">' + esc(ex.title) + '</option>'; }).join("");
  }
  function getExperiment(id) { return experiments.find(function (ex) { return ex.id === id; }) || experiments[0]; }
  function launch(id) {
    const ex = getExperiment(id);
    if (ex.kind === "device") {
      A.MosfetLab.setPreset(ex.preset);
      A.App.navigate("mosfet");
    } else if (ex.kind === "topology") {
      A.AdvancedLabs.setTopology(ex.topology);
      A.App.openAmplifier("default");
    } else if (ex.kind === "mirror") {
      A.App.navigate("current-mirror");
    } else if (ex.kind === "cmos") {
      A.App.navigate("cmos");
    } else if (ex.kind === "ota") {
      A.App.navigate("ota");
      document.querySelector('[data-ota-tab="ota"]').click();
    } else if (ex.kind === "opamp") {
      A.App.navigate("ota");
      document.querySelector('[data-ota-tab="opamp"]').click();
    } else if (ex.kind === "studio") {
      A.CircuitStudio.setTemplate(ex.studioTemplate);
      A.App.navigate("studio");
    } else {
      A.App.openAmplifier(ex.mode);
    }
  }
  function currentSnapshot(experiment) {
    if (experiment.kind === "device") {
      const snap = A.MosfetLab.getSnapshot();
      if (!snap) return null;
      return {
        summary: snap.config.polarity.toUpperCase() + " · " + snap.result.region + " · ID " + (snap.result.id * 1000).toFixed(3) + " mA · gm " + (snap.result.gm * 1000).toFixed(3) + " mS",
        rows: [
          ["VGS magnitude", snap.config.vgs.toFixed(2) + " V"], ["VDS magnitude", snap.config.vds.toFixed(2) + " V"],
          ["Threshold magnitude", snap.config.vth.toFixed(2) + " V"], ["Overdrive", snap.result.vov.toFixed(3) + " V"],
          ["Kn", snap.config.knMilli.toFixed(2) + " mA/V²"], ["W/L", snap.config.wl.toFixed(1)],
          ["β = Kn(W/L)", (snap.result.beta * 1000).toFixed(2) + " mA/V²"], ["λ", snap.config.lambda.toFixed(3) + " V⁻¹"],
          ["Drain current", (snap.result.id * 1000).toFixed(4) + " mA"], ["Transconductance", (snap.result.gm * 1000).toFixed(4) + " mS"],
          ["Drain power", (snap.result.power * 1000).toFixed(3) + " mW"], ["Region", snap.result.region]
        ]
      };
    }
    if (experiment.kind === "studio" && A.CircuitStudio) {
      const snap = A.CircuitStudio.getSnapshot();
      if (!snap || !snap.result) return { summary: "Circuit Studio · no simulation result", rows: [["Status", "Load the experiment circuit and run its selected analysis."]] };
      const result = snap.result, rows = [["Analysis", snap.mode.toUpperCase()], ["Convergence", result.converged ? "Converged" : "Failed"], ["Solver iterations", String(result.iterations || 0)], ["Model", "MNA with supported device models"]];
      if (result.converged && snap.mode === "dc") Object.keys(result.nodes).filter(function (n) { return n !== "0"; }).forEach(function (n) { rows.push(["Node " + n, result.nodes[n].toFixed(6) + " V"]); });
      if (result.converged && snap.mode === "transient") { const p = result.points[result.points.length - 1]; rows.push(["Final time", p.t.toPrecision(5) + " s"]); Object.keys(p.nodes).filter(function (n) { return n !== "0"; }).forEach(function (n) { rows.push(["Final V(" + n + ")", Number(p.nodes[n]).toFixed(6) + " V"]); }); }
      if (result.converged && snap.mode === "ac") { const p = result.points[Math.floor(result.points.length / 2)], node = p.nodes.out || p.nodes.out1 || p.nodes.n1; if (node) rows.push(["Mid-sweep output magnitude", Math.hypot(node.re, node.im).toFixed(6) + " V"], ["Mid-sweep phase", (Math.atan2(node.im, node.re) * 180 / Math.PI).toFixed(3) + "°"], ["Frequency", p.frequency.toPrecision(5) + " Hz"]); }
      return { summary: "Circuit Studio · " + snap.template + " · " + snap.mode.toUpperCase() + " · " + (result.converged ? "converged" : result.error), rows: rows };
    }
    if (["topology","mirror","cmos","ota","opamp"].indexOf(experiment.kind) >= 0 && A.AdvancedLabs) {
      const state = A.AdvancedLabs.getState(), result = state.results;
      if (experiment.kind === "topology" && result.amp) return { summary: experiment.topology.toUpperCase() + " · " + result.amp.region + " · Av " + result.amp.gain.toFixed(3) + " V/V · ID " + (result.amp.id * 1000).toFixed(3) + " mA", rows: [["Topology", experiment.title], ["Drain current", (result.amp.id * 1000).toFixed(4) + " mA"], ["Transconductance", (result.amp.gm * 1000).toFixed(4) + " mS"], ["Small-signal gain", result.amp.gain.toFixed(4) + " V/V"], ["Gain magnitude", result.amp.gainDb.toFixed(3) + " dB"], ["Q-point region", result.amp.region], ["Model", "Square-law DC root and first-order AC model"]] };
      if (experiment.kind === "mirror" && result.mirror) return { summary: "Current mirror · IOUT " + (result.mirror.actual * 1000).toFixed(4) + " mA · error " + result.mirror.err.toFixed(2) + "%", rows: [["Reference current", state.mirror.iref.toFixed(3) + " mA"], ["W/L ratio", state.mirror.ratio.toFixed(2)], ["Ideal output", (result.mirror.ideal * 1000).toFixed(4) + " mA"], ["Calculated output", (result.mirror.actual * 1000).toFixed(4) + " mA"], ["Mirroring error", result.mirror.err.toFixed(3) + "%"], ["Overdrive", result.mirror.vov.toFixed(4) + " V"], ["Model", "Square-law with channel-length modulation"]] };
      if (experiment.kind === "cmos" && result.cmos) return { summary: "CMOS inverter · VOUT " + result.cmos.vout.toFixed(3) + " V · VM " + result.cmos.switchV.toFixed(3) + " V", rows: [["Input voltage", state.cmos.vin.toFixed(3) + " V"], ["Output voltage", result.cmos.vout.toFixed(4) + " V"], ["Switching threshold", result.cmos.switchV.toFixed(4) + " V"], ["Static power", (result.cmos.static * 1000).toFixed(5) + " mW"], ["Dynamic power estimate", (result.cmos.dynamic * 1000).toFixed(5) + " mW"], ["Model", "Numerical current-balance solve"]] };
      if (experiment.kind === "ota" && result.ota) return { summary: "OTA differential pair · IDIFF " + (result.ota.id * 1000).toFixed(4) + " mA · gm " + (result.ota.gm * 1000).toFixed(3) + " mS", rows: [["Tail current", state.ota.itail.toFixed(3) + " mA"], ["Differential input", state.ota.vdiff.toFixed(4) + " V"], ["Output current", (result.ota.id * 1000).toFixed(4) + " mA"], ["Small-signal gm", (result.ota.gm * 1000).toFixed(4) + " mS"], ["Linear input span", "±" + result.ota.limit.toFixed(4) + " V"], ["Model", "Matched long-channel square-law pair"]] };
      if (experiment.kind === "opamp" && result.opamp) return { summary: "Feedback op-amp · Acl " + Math.hypot(result.opamp.closed.re, result.opamp.closed.im).toFixed(3) + " V/V · BW " + result.opamp.bw.toFixed(1) + " Hz", rows: [["Configuration", state.opamp.mode], ["Ideal gain", result.opamp.ideal.toFixed(4) + " V/V"], ["Finite-A0 closed-loop gain", Math.hypot(result.opamp.closed.re, result.opamp.closed.im).toFixed(4) + " V/V"], ["Gain-bandwidth product", state.opamp.gbw.toFixed(1) + " Hz"], ["Closed-loop bandwidth", result.opamp.bw.toFixed(2) + " Hz"], ["Output peak", result.opamp.output.toFixed(4) + " V"], ["Model", "Finite-A0 one-pole feedback block"]] };
    }
    const signal = A.Instruments.getTelemetry();
    if (!signal) return { summary: "Amplifier report selected; run the amplifier simulation to include measured transient values.", rows: [["Data status", "No amplifier transient has been received yet"]] };
    return {
      summary: signal.waveform.toUpperCase() + " · " + (signal.bypass ? "CS enabled" : "CS disabled") + " · " + signal.frequencyHz.toFixed(2) + " Hz",
      rows: [
        ["Frequency", signal.frequencyHz.toFixed(2) + " Hz"], ["Input amplitude", (signal.amplitudePeak * 1000).toFixed(1) + " mVpk"],
        ["Measured output VPP", signal.outputVpp ? signal.outputVpp.toFixed(3) + " V" : "Calculated from waveform"],
        ["Small-signal gain", Number.isFinite(signal.gainDb) ? signal.gainDb.toFixed(2) + " dB" : "—"],
        ["DC drain current", signal.biasCurrent || "—"], ["DC region", signal.region || "—"],
        ["Bypass capacitor", signal.bypass ? "Enabled" : "Disabled"], ["Model", "Nonlinear square-law transient"]
      ]
    };
  }
  function escapeHtml(value) { return esc(value); }
  function generateReport() {
    const combined = document.getElementById("reportExperiment").value === "all";
    const selectedExperiments = combined ? experiments : [getExperiment(document.getElementById("reportExperiment").value)];
    const ex = selectedExperiments[0];
    const result = currentSnapshot(ex) || { summary: "No result available", rows: [] };
    const images = A.MosfetLab.getChartImages();
    const telemetry = A.Instruments.getTelemetry();
    const name = escapeHtml(document.getElementById("studentName").value || "Not provided");
    const roll = escapeHtml(document.getElementById("studentRoll").value || "Not provided");
    const date = new Date().toLocaleDateString();
    const rows = result.rows.map(function (row) { return '<div class="report-value"><b>' + esc(row[0]) + '</b><br>' + esc(row[1]) + '</div>'; }).join("");
    const figures = [];
    if (images.transfer) figures.push('<h2>Device transfer characteristic</h2><img alt="Calculated device transfer characteristic" src="' + images.transfer + '">');
    if (images.output) figures.push('<h2>Device output characteristics</h2><img alt="Calculated device output characteristics" src="' + images.output + '">');
    const scopeImage = A.Instruments.getChartImage();
    if (telemetry && scopeImage) figures.push('<h2>Amplifier transient snapshot</h2><img alt="Calculated amplifier transient" src="' + scopeImage + '">');
    const extraCharts = A.AdvancedLabs && A.AdvancedLabs.getReportCharts ? A.AdvancedLabs.getReportCharts() : {};
    Object.keys(extraCharts).forEach(function (key) { if (extraCharts[key]) figures.push('<h2>' + esc(key) + '</h2><img alt="' + esc(key) + ' calculated chart" src="' + extraCharts[key] + '">'); });
    const reportBody = combined ? selectedExperiments.map(function (item) {
      const snapshot = currentSnapshot(item) || { summary: "No active calculated result", rows: [] };
      return '<section class="combined-experiment"><h2>' + esc(item.title) + '</h2><p><b>Objective:</b> ' + esc(item.objective) + '</p><p><b>Theory:</b> ' + esc(item.theory) + '</p><p><b>Equation:</b> <span class="formula">' + esc(item.equation) + '</span></p><p><b>Components:</b> ' + esc(item.components) + '</p><p><b>Procedure:</b> ' + esc(item.procedure) + '</p><p><b>Calculated result:</b> ' + esc(snapshot.summary) + '</p><div class="report-results">' + snapshot.rows.map(function (row) { return '<div class="report-value"><b>' + esc(row[0]) + '</b><br>' + esc(row[1]) + '</div>'; }).join("") + '</div><p><b>Observation:</b> ' + esc(item.observation) + '</p><p><b>Conclusion:</b> ' + esc(item.conclusion) + '</p></section>';
    }).join("") : '<h2>Objective</h2><p>' + esc(ex.objective) + '</p><h2>Theory</h2><p>' + esc(ex.theory) + '</p><p><b>Equation:</b> <span class="formula">' + esc(ex.equation) + '</span></p><h2>Components and model settings</h2><p>' + esc(ex.components) + '</p><h2>Procedure</h2><p>' + esc(ex.procedure) + '</p><h2>Calculated results</h2><div class="report-results">' + rows + '</div><h2>Observation</h2><p>' + esc(ex.observation) + '</p><h2>Conclusion</h2><p>' + esc(ex.conclusion) + '</p>';
    const report = '<div class="overline">ANALOGVERSE PRO · VIRTUAL ANALOG ELECTRONICS LAB</div><h1>Engineering Experiment Report</h1>' +
      '<div class="report-meta"><div><b>Project</b><br>ANALOGVERSE Virtual Analog Electronics Laboratory</div><div><b>Experiment</b><br>' + (combined ? 'Combined laboratory report · ' + experiments.length + ' experiments' : esc(ex.title)) + '</div><div><b>Student</b><br>' + name + '</div><div><b>Roll number</b><br>' + roll + '</div><div><b>Date</b><br>' + esc(date) + '</div><div><b>Active model result</b><br>' + esc(combined ? 'Each section reports current model state; unselected modules show their retained settings.' : result.summary) + '</div></div>' + reportBody + figures.join("") +
      '<h2>Assumptions and limitations</h2><p class="report-muted">Educational long-channel square-law compact model. Channel-length modulation is included only in the MOSFET device lab; body effect, short-channel effects, subthreshold conduction, device capacitances, temperature, noise, and fabricated-device measurements are omitted. Common-source transient values are calculated from the project model, not hardware or SPICE data.</p>';
    const view = document.getElementById("printReportView");
    view.innerHTML = report;
    view.setAttribute("aria-hidden", "false");
    window.setTimeout(function () { window.print(); }, 100);
  }
  function resetSelected() {
    const id = document.getElementById("reportExperiment").value;
    if (id === "all") { A.MosfetLab.reset(); A.AdvancedLabs.reset(); return; }
    const ex = getExperiment(id);
    if (ex.kind === "device") {
      A.MosfetLab.reset();
    } else if (ex.kind === "topology") {
      A.AdvancedLabs.setTopology(ex.topology);
      A.App.openAmplifier("default");
    } else if (ex.kind === "mirror") {
      A.App.navigate("current-mirror");
    } else if (ex.kind === "cmos") {
      A.App.navigate("cmos");
    } else if (ex.kind === "ota" || ex.kind === "opamp") {
      A.App.navigate("ota");
      document.querySelector(ex.kind === "ota" ? '[data-ota-tab="ota"]' : '[data-ota-tab="opamp"]').click();
    } else if (ex.kind === "studio") {
      A.CircuitStudio.setTemplate(ex.studioTemplate);
      A.App.navigate("studio");
    } else {
      A.App.openAmplifier("default");
    }
  }
  function initialize() {
    if (!document.getElementById("experimentList")) return;
    render();
    renderRecent();
    document.getElementById("reportButton").addEventListener("click", generateReport);
    document.getElementById("printReportButton").addEventListener("click", generateReport);
    document.getElementById("resetExperiment").addEventListener("click", resetSelected);
  }
  document.addEventListener("DOMContentLoaded", initialize, { once: true });
  A.Experiments = { list: experiments, launch: launch, generateReport: generateReport };
}());

