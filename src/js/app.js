(function () {
  "use strict";
  window.Analogverse = window.Analogverse || {};
  const pageTitles = {
    dashboard: "Dashboard",
    mosfet: "MOSFET Device Lab",
    amplifier: "Amplifier Design Lab",
    "current-mirror": "Current Mirror Lab",
    cmos: "CMOS Lab",
    ota: "OTA and Op-Amp Lab",
    advanced: "Advanced Circuit Analysis",
    studio: "Circuit Studio",
    instruments: "Virtual Instruments",
    experiments: "Experiment Center",
    comparison: "Performance Comparison",
    documentation: "Documentation"
  };
  let amplifierLoaded = false;
  let lastAmplifierPreset = "";

  function el(id) { return document.getElementById(id); }
  function fmtCurrent(amps) {
    if (!Number.isFinite(amps)) return "—";
    if (amps >= 1e-3) return (amps * 1e3).toFixed(2) + " mA";
    if (amps >= 1e-6) return (amps * 1e6).toFixed(1) + " µA";
    return (amps * 1e9).toFixed(1) + " nA";
  }
  function fmtConductance(s) {
    if (!Number.isFinite(s)) return "—";
    if (s >= 1e-3) return (s * 1e3).toFixed(2) + " mS";
    if (s >= 1e-6) return (s * 1e6).toFixed(2) + " µS";
    return (s * 1e9).toFixed(1) + " nS";
  }
  function updateDeviceDashboard(snapshot) {
    if (!snapshot) return;
    const p = snapshot.config, r = snapshot.result;
    el("dashDevice").textContent = p.polarity.toUpperCase();
    el("dashCondition").textContent = (p.polarity === "nmos" ? "VGS " : "|VSG| ") + p.vgs.toFixed(2) + " V · " + (p.polarity === "nmos" ? "VDS " : "|VSD| ") + p.vds.toFixed(2) + " V";
    el("dashCurrent").textContent = fmtCurrent(r.id);
    el("dashRegion").textContent = r.region.toUpperCase();
    el("dashOverdrive").textContent = "Overdrive " + r.vov.toFixed(3) + " V";
    el("dashSource").textContent = p.polarity.toUpperCase() + " device model";
    el("dashSupply").textContent = "Drain supply " + p.vds.toFixed(2) + " V";
    el("dashGm").textContent = fmtConductance(r.gm);
    el("dashPower").textContent = (r.power * 1000).toFixed(2) + " mW";
    el("dashThreshold").textContent = p.vth.toFixed(2) + " V";
    el("dashBeta").textContent = (r.beta * 1000).toFixed(2) + " mA/V²";
    el("dashStatus").textContent = "Calculated using the " + r.region.toLowerCase() + "-region device equation";
    el("globalStatus").textContent = "DEVICE MODEL UPDATED";
    if (window.Analogverse.Instruments) window.Analogverse.Instruments.setDC({ voltage: p.vds, current: r.id, resistance: p.vds / Math.max(r.id, 1e-15), acVoltage: 0, source: p.polarity.toUpperCase() + " DC operating point" });
  }
  function updateAmplifierDashboard(data) {
    el("dashDevice").textContent = data.topology || "Common-source NMOS";
    el("dashCondition").textContent = (data.waveform || "signal").toUpperCase() + " · " + (Number.isFinite(data.frequencyHz) ? data.frequencyHz.toFixed(1) : "—") + " Hz · " + (Number.isFinite(data.amplitudePeak) ? (data.amplitudePeak * 1000).toFixed(1) : "—") + " mVpk";
    el("dashCurrent").textContent = data.biasCurrent || "—";
    el("dashRegion").textContent = (data.region || "—").toUpperCase();
    el("dashOverdrive").textContent = "Small-signal gain " + (Number.isFinite(data.gainDb) ? data.gainDb.toFixed(1) + " dB" : "—");
    el("dashSource").textContent = data.topology || "Common-source amplifier";
    el("dashSupply").textContent = "Supply " + (Number.isFinite(data.vdd) ? data.vdd.toFixed(2) : "10.00") + " V";
    el("dashGm").textContent = Number.isFinite(data.gm) ? fmtConductance(data.gm) : "—";
    el("dashPower").textContent = Number.isFinite(data.power) ? (data.power * 1000).toFixed(2) + " mW" : "—";
    el("dashThreshold").textContent = Number.isFinite(data.vth) ? data.vth.toFixed(2) + " V" : "2.50 V";
    el("dashBeta").textContent = Number.isFinite(data.beta) ? (data.beta * 1000).toFixed(2) + " mA/V²" : "40.00 mA/V²";
    el("dashStatus").textContent = "Live transient data received from the selected circuit model";
    el("globalStatus").textContent = "AMPLIFIER MODEL UPDATED";
    if (window.Analogverse.Instruments && Number.isFinite(data.dcOutputV)) window.Analogverse.Instruments.setDC({ voltage: data.dcOutputV, current: data.dcCurrentA, resistance: data.equivalentResistanceOhm, acVoltage: data.outputAcRms, source: data.topology || "Common-source amplifier" });
  }
  function navigate(name) {
    if (!pageTitles[name]) return;
    document.querySelectorAll(".page").forEach(function (page) { page.classList.toggle("active", page.dataset.page === name); });
    document.querySelectorAll("[data-nav]").forEach(function (button) { button.classList.toggle("active", button.dataset.nav === name); });
    el("breadcrumbCurrent").textContent = pageTitles[name];
    if (window.Analogverse.AdvancedLabs) window.Analogverse.AdvancedLabs.activate(name);
    if (window.Analogverse.CircuitStudio) window.Analogverse.CircuitStudio.activate(name);
    if (name === "instruments" && !amplifierLoaded) {
      el("scopeState").textContent = "Run a transient-capable circuit to connect current waveform data.";
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function loadAmplifier(preset) {
    const frame = el("amplifierFrame");
    const normalized = preset || "default";
    if (!amplifierLoaded || normalized !== lastAmplifierPreset) {
      const query = normalized === "default" ? "?preset=default" : "?preset=" + encodeURIComponent(normalized);
      frame.src = "labs/common-source-amplifier/index.html" + query;
      amplifierLoaded = true;
      lastAmplifierPreset = normalized;
    }
  }
  function openAmplifier(preset) {
    navigate("amplifier");
    loadAmplifier(preset || "default");
  }
  function initialize() {
    document.querySelectorAll("[data-nav]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        if (button.dataset.nav === "amplifier") openAmplifier("default");
        else navigate(button.dataset.nav);
      });
    });
    document.querySelectorAll("[data-open]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (button.dataset.open === "amplifier") openAmplifier("default");
        else navigate(button.dataset.open);
      });
    });
    el("resetDevice").addEventListener("click", function () {
      window.Analogverse.MosfetLab.reset();
      if (window.Analogverse.AdvancedLabs) window.Analogverse.AdvancedLabs.reset();
      if (document.querySelector('[data-page="amplifier"].active')) openAmplifier("default");
    });
    window.addEventListener("analogverse:device-updated", function (event) { updateDeviceDashboard(event.detail); });
    window.addEventListener("analogverse:amplifier-updated", function (event) { updateAmplifierDashboard(event.detail); });
    window.addEventListener("message", function (event) {
      const frame = el("amplifierFrame");
      if (!frame || event.source !== frame.contentWindow || !event.data || event.data.type !== "analogverse:amplifier-telemetry") return;
      if (!document.querySelector('[data-page="amplifier"].active')) return;
      window.Analogverse.Instruments.receive(event.data.payload);
      window.dispatchEvent(new CustomEvent("analogverse:amplifier-updated", { detail: event.data.payload }));
      updateAmplifierDashboard(event.data.payload);
    });
    if (window.Analogverse.MosfetLab) updateDeviceDashboard(window.Analogverse.MosfetLab.getSnapshot());
  }
  document.addEventListener("DOMContentLoaded", initialize, { once: true });
  window.Analogverse.App = { navigate: navigate, openAmplifier: openAmplifier, updateDeviceDashboard: updateDeviceDashboard };
}());

