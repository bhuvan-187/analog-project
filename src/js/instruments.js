(function () {
  "use strict";
  window.Analogverse = window.Analogverse || {};
  const A = window.Analogverse;
  let chart = null;
  let telemetry = null;
  let dcSnapshot = null;

  function el(id) { return document.getElementById(id); }
  function vpp(data) {
    if (!data || !data.length) return NaN;
    let lo = Infinity, hi = -Infinity;
    data.forEach(function (p) { lo = Math.min(lo, p.v); hi = Math.max(hi, p.v); });
    return hi - lo;
  }
  function rmsAc(data) {
    if (!data || !data.length) return NaN;
    const mean = data.reduce(function (sum, p) { return sum + p.v; }, 0) / data.length;
    return Math.sqrt(data.reduce(function (sum, p) { return sum + Math.pow(p.v - mean, 2); }, 0) / data.length);
  }
  function fundamental(data, freq) {
    if (!data || data.length < 8 || !freq) return null;
    let mean = 0;
    data.forEach(function (p) { mean += p.v; });
    mean /= data.length;
    let sin = 0, cos = 0;
    data.forEach(function (p) {
      const angle = 2 * Math.PI * freq * p.t;
      const y = p.v - mean;
      sin += y * Math.sin(angle);
      cos += y * Math.cos(angle);
    });
    const scale = 2 / data.length;
    const a = sin * scale, b = cos * scale;
    return { amplitude: Math.hypot(a, b), phase: Math.atan2(b, a) };
  }
  function wrapDegrees(deg) {
    let value = deg;
    while (value > 180) value -= 360;
    while (value < -180) value += 360;
    return value;
  }
  function fmtV(value) {
    if (!Number.isFinite(value)) return "—";
    const abs = Math.abs(value);
    if (abs >= 1) return value.toFixed(3) + " V";
    if (abs >= 1e-3) return (value * 1e3).toFixed(2) + " mV";
    return (value * 1e6).toFixed(1) + " µV";
  }
  function fmtGain(value) {
    if (!Number.isFinite(value)) return "—";
    return (value < 0 ? "−" : "+") + Math.abs(value).toFixed(Math.abs(value) >= 100 ? 1 : 2) + " V/V";
  }
  function updateMeasurements() {
    if (!telemetry) return;
    const inputVpp = vpp(telemetry.input);
    const outputVpp = vpp(telemetry.output);
    const rms = rmsAc(telemetry.output);
    telemetry.inputVpp = inputVpp;
    telemetry.outputVpp = outputVpp;
    telemetry.outputRms = rms;
    const inFund = fundamental(telemetry.input, telemetry.frequencyHz);
    const outFund = fundamental(telemetry.output, telemetry.frequencyHz);
    let measuredGain = NaN, phase = NaN;
    if (inFund && outFund && inFund.amplitude > 1e-12) {
      const delta = wrapDegrees((outFund.phase - inFund.phase) * 180 / Math.PI);
      phase = delta;
      measuredGain = outFund.amplitude / inFund.amplitude * (Math.cos(delta * Math.PI / 180) < 0 ? -1 : 1);
    }
    el("measureFrequency").textContent = telemetry.frequencyHz >= 1000 ? (telemetry.frequencyHz / 1000).toFixed(2) + " kHz" : telemetry.frequencyHz.toFixed(2) + " Hz";
    el("measureInputVpp").textContent = fmtV(inputVpp);
    el("measureOutputVpp").textContent = fmtV(outputVpp);
    el("measureOutputRms").textContent = fmtV(rms);
    el("measureGain").textContent = fmtGain(measuredGain);
    el("measurePhase").textContent = Number.isFinite(phase) ? (phase < 0 ? "−" : "+") + Math.abs(phase).toFixed(1) + "°" : "—";
    el("measurementSource").textContent = telemetry.topology || "Selected circuit" + " · " + telemetry.waveform.toUpperCase() + " generator · values from model samples";
  }
  function updateScope() {
    if (!chart || !telemetry) return;
    const showIn = el("showCh1").checked;
    const showOut = el("showCh2").checked;
    const timeDiv = Number(el("scopeTimeDiv").value);
    const duration = timeDiv * 10;
    const full = telemetry.input || [];
    const fullOutput = telemetry.output || [];
    const end = full.length ? full[full.length - 1].t : 0;
    const triggerSource = el("scopeTriggerSource").value;
    const triggerSeries = triggerSource === "output" ? fullOutput : full;
    const triggerLevel = Number(el("scopeTriggerLevel").value);
    let triggerTime = NaN;
    for (let i = 1; i < triggerSeries.length; i++) {
      if (triggerSeries[i - 1].v <= triggerLevel && triggerSeries[i].v > triggerLevel) { triggerTime = triggerSeries[i].t; break; }
    }
    if (!Number.isFinite(triggerTime)) triggerTime = end;
    const start = Math.max(0, Math.min(Math.max(0, end - duration), triggerTime - 2 * timeDiv));
    const scale = telemetry.frequencyHz >= 1000 ? 1e6 : 1e3;
    const unit = telemetry.frequencyHz >= 1000 ? "Time (µs)" : "Time (ms)";
    const inputData = full.filter(function (p) { return p.t >= start && p.t <= start + duration; }).map(function (p) { return { x: (p.t - start) * scale, y: p.v * 1000 }; });
    const outputData = fullOutput.filter(function (p) { return p.t >= start && p.t <= start + duration; }).map(function (p) { return { x: (p.t - start) * scale, y: p.v }; });
    const mean = function (arr, key) { return arr.length ? arr.reduce(function (sum, p) { return sum + p[key]; }, 0) / arr.length : 0; };
    const centerIn = mean(inputData, "y"), centerOut = mean(outputData, "y");
    const rangeIn = Number(el("scopeCh1Div").value) * 1000 * 5;
    const rangeOut = Number(el("scopeCh2Div").value) * 5;
    chart.data.datasets = [
      { label: "CH1 · Vin (mV)", data: inputData, yAxisID: "y", borderColor: "#65a8ff", backgroundColor: "#65a8ff", borderWidth: 1.8, hidden: !showIn },
      { label: "CH2 · Vout (V)", data: outputData, yAxisID: "y1", borderColor: "#51e1c2", backgroundColor: "#51e1c2", borderWidth: 1.8, hidden: !showOut }
    ];
    chart.options.scales.x.title.text = unit;
    chart.options.scales.x.min = 0;
    chart.options.scales.x.max = duration * scale;
    chart.options.scales.y.min = centerIn - rangeIn;
    chart.options.scales.y.max = centerIn + rangeIn;
    chart.options.scales.y1.min = centerOut - rangeOut;
    chart.options.scales.y1.max = centerOut + rangeOut;
    chart.update("none");
    el("emptyScope").hidden = true;
    el("scopeLive").innerHTML = "<i></i>LIVE";
    el("scopeLive").classList.add("is-live");
    el("scopeState").textContent = (telemetry.topology || telemetry.waveform + " transient") + " · " + (timeDiv * 1e6 >= 1000 ? (timeDiv * 1e3).toFixed(2) + " ms/div" : (timeDiv * 1e6).toFixed(1) + " µs/div") + " · trigger " + triggerSource.toUpperCase() + " @ " + triggerLevel.toFixed(2) + " V";
  }
  function init() {
    if (!document.querySelector("[data-page=instruments]")) return;
    if (window.Chart) {
      chart = new Chart(el("scopeChart").getContext("2d"), {
        type: "line",
        data: { datasets: [] },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: "#0b1220", borderColor: "#334963", borderWidth: 1, titleColor: "#eff6ff", bodyColor: "#d1deeb" }
          },
          elements: { line: { borderWidth: 1.8, tension: 0 }, point: { radius: 0, hitRadius: 5 } },
          scales: {
            x: { type: "linear", title: { display: true, text: "Time", color: "#8fa3bb", font: { family: "DM Mono", size: 8 } }, grid: { color: "rgba(145,161,185,.12)" }, ticks: { color: "#8599b2", font: { family: "DM Mono", size: 8 }, maxTicksLimit: 7 } },
            y: { type: "linear", position: "left", title: { display: true, text: "Vin (mV)", color: "#65a8ff", font: { family: "DM Mono", size: 8 } }, grid: { color: "rgba(145,161,185,.12)" }, ticks: { color: "#65a8ff", font: { family: "DM Mono", size: 8 } } },
            y1: { type: "linear", position: "right", title: { display: true, text: "Vout (V)", color: "#51e1c2", font: { family: "DM Mono", size: 8 } }, grid: { drawOnChartArea: false }, ticks: { color: "#51e1c2", font: { family: "DM Mono", size: 8 } } }
          }
        }
      });
    } else {
      el("scopeState").textContent = "Chart.js did not load; connect to the internet and reload to enable the scope graph.";
    }
    ["scopeTimeDiv", "scopeCh1Div", "scopeCh2Div", "scopeTriggerSource", "showCh1", "showCh2"].forEach(function (id) { el(id).addEventListener("change", updateScope); });
    el("scopeTriggerLevel").addEventListener("input", function () { el("scopeTriggerLevelOut").textContent = Number(this.value).toFixed(2) + " V"; updateScope(); });
    window.addEventListener("analogverse:amplifier-updated", function (event) {
      telemetry = event.detail;
      el("emptyScope").hidden = true;
      updateMeasurements();
      updateScope();
      if (Number.isFinite(telemetry.dcOutputV) || Number.isFinite(telemetry.dcCurrentA)) {
        setDC({ voltage: telemetry.dcOutputV, current: telemetry.dcCurrentA, resistance: telemetry.equivalentResistanceOhm, acVoltage: telemetry.outputAcRms, source: telemetry.topology || "Selected circuit" });
      }
    });
  }
  function setDC(snapshot) {
    if (!snapshot) return;
    dcSnapshot = snapshot;
    if (!el("dmmDCV")) return;
    el("dmmDCV").textContent = fmtV(snapshot.voltage);
    el("dmmACV").textContent = fmtV(snapshot.acVoltage);
    el("dmmCurrent").textContent = Number.isFinite(snapshot.current) ? fmtCurrent(snapshot.current) : "—";
    el("dmmResistance").textContent = Number.isFinite(snapshot.resistance) ? fmtResistance(snapshot.resistance) : "—";
    el("dmmSource").textContent = snapshot.source || "Selected circuit model";
  }
  function clear(message) {
    telemetry = null;
    if (chart) { chart.data.datasets = []; chart.update("none"); }
    if (el("emptyScope")) el("emptyScope").hidden = false;
    if (el("scopeLive")) { el("scopeLive").textContent = "DC ONLY"; el("scopeLive").classList.remove("is-live"); }
    if (el("scopeState")) el("scopeState").textContent = message || "Selected circuit has no transient simulation.";
    ["measureFrequency","measureInputVpp","measureOutputVpp","measureOutputRms","measureGain","measurePhase"].forEach(function(id){if(el(id))el(id).textContent="—";});
    if (el("measurementSource")) el("measurementSource").textContent = message || "No transient samples are active.";
  }
  document.addEventListener("DOMContentLoaded", init, { once: true });
  A.Instruments = {
    receive: function (data) {
      telemetry = data;
      if (document.readyState !== "loading") {
        if (el("emptyScope")) el("emptyScope").hidden = true;
        updateMeasurements();
        updateScope();
        if (data && data.dcOutputV !== undefined) setDC({ voltage: data.dcOutputV, current: data.dcCurrentA, resistance: data.equivalentResistanceOhm, acVoltage: data.outputAcRms, source: data.topology || "Selected circuit" });
        else if (data && data.power > 0) {
          const current = parseCurrent(data.biasCurrent), voltage = current > 0 ? data.power / current : NaN;
          setDC({ voltage: voltage, current: current, resistance: voltage / current, acVoltage: data.outputVpp / (2 * Math.sqrt(2)), source: "Original Common Source model · derived from Q-point and transient" });
        }
      }
    },
    getTelemetry: function () { return telemetry; },
    getChartImage: function () { return chart ? chart.toBase64Image() : ""; },
    setDC: setDC,
    clear: clear,
    getDCSnapshot: function () { return dcSnapshot; }
  };
  function fmtCurrent(amps) {
    if (!Number.isFinite(amps)) return "—";
    const a = Math.abs(amps);
    if (a >= 1) return amps.toFixed(3) + " A";
    if (a >= 1e-3) return (amps * 1e3).toFixed(3) + " mA";
    if (a >= 1e-6) return (amps * 1e6).toFixed(2) + " µA";
    return (amps * 1e9).toFixed(2) + " nA";
  }
  function fmtResistance(ohms) {
    if (!Number.isFinite(ohms)) return "—";
    if (ohms >= 1e6) return (ohms / 1e6).toFixed(2) + " MΩ";
    if (ohms >= 1e3) return (ohms / 1e3).toFixed(2) + " kΩ";
    return ohms.toFixed(1) + " Ω";
  }
  function parseCurrent(value) {
    if (typeof value !== "string") return NaN;
    const match = value.trim().match(/^([-+]?\d+(?:\.\d+)?)\s*(mA|µA|uA|nA|A)$/i);
    if (!match) return NaN;
    const amount = Number(match[1]), unit = match[2].toLowerCase();
    return amount * (unit === "ma" ? 1e-3 : unit === "µa" || unit === "ua" ? 1e-6 : unit === "na" ? 1e-9 : 1);
  }
}());

