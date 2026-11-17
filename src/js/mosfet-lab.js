(function () {
  "use strict";
  window.Analogverse = window.Analogverse || {};
  const A = window.Analogverse;
  const M = A.DeviceModel;
  const ids = ["vgsControl", "vdsControl", "vthControl", "knControl", "wlControl", "lambdaControl", "comparePolarity"];
  const colors = ["#51e1c2", "#65a8ff", "#ffc66b", "#db91ff", "#ff8585"];
  let polarity = "nmos";
  let transferChart = null;
  let outputChart = null;
  let latest = null;
  let debounceFrame = 0;

  function el(id) { return document.getElementById(id); }
  function config() {
    return {
      polarity: polarity,
      vgs: Number(el("vgsControl").value),
      vds: Number(el("vdsControl").value),
      vth: Number(el("vthControl").value),
      knMilli: Number(el("knControl").value),
      wl: Number(el("wlControl").value),
      lambda: Number(el("lambdaControl").value)
    };
  }
  function formatCurrent(amps) {
    if (amps >= 1) return amps.toFixed(3) + " A";
    if (amps >= 1e-3) return (amps * 1e3).toFixed(3) + " mA";
    if (amps >= 1e-6) return (amps * 1e6).toFixed(2) + " µA";
    return (amps * 1e9).toFixed(2) + " nA";
  }
  function formatConductance(siemens) {
    if (siemens >= 1) return siemens.toFixed(2) + " S";
    if (siemens >= 1e-3) return (siemens * 1e3).toFixed(2) + " mS";
    if (siemens >= 1e-6) return (siemens * 1e6).toFixed(2) + " µS";
    return (siemens * 1e9).toFixed(2) + " nS";
  }
  function chartBase() {
    return {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: "nearest", intersect: false },
      plugins: {
        legend: { display: true, position: "bottom", labels: { color: "#9bacbf", boxWidth: 12, boxHeight: 2, padding: 14, font: { family: "DM Mono", size: 9 } } },
        tooltip: { backgroundColor: "#0b1220", borderColor: "#31445d", borderWidth: 1, titleColor: "#eff6ff", bodyColor: "#cfdeed", displayColors: true }
      },
      elements: { line: { borderWidth: 2, tension: 0 }, point: { radius: 0, hitRadius: 6 } },
      scales: {
        x: { type: "linear", grid: { color: "rgba(145,161,185,.12)" }, ticks: { color: "#8599b2", font: { family: "DM Mono", size: 8 }, maxTicksLimit: 7 } },
        y: { beginAtZero: true, grid: { color: "rgba(145,161,185,.12)" }, ticks: { color: "#8599b2", font: { family: "DM Mono", size: 8 }, maxTicksLimit: 6 } }
      }
    };
  }
  function initCharts() {
    if (!window.Chart) {
      document.querySelectorAll(".chart-area").forEach(function (node) {
        node.insertAdjacentHTML("beforeend", '<div class="chart-error">Chart.js did not load. Connect to the internet and reload the lab.</div>');
      });
      return;
    }
    transferChart = new Chart(el("transferChart").getContext("2d"), {
      type: "line",
      data: { datasets: [] },
      options: Object.assign(chartBase(), {
        scales: {
          x: Object.assign(chartBase().scales.x, { title: { display: true, text: "Gate voltage magnitude (V)", color: "#8fa3bb", font: { family: "DM Mono", size: 8 } } }),
          y: Object.assign(chartBase().scales.y, { title: { display: true, text: "Drain current (mA)", color: "#8fa3bb", font: { family: "DM Mono", size: 8 } } })
        }
      })
    });
    outputChart = new Chart(el("outputChart").getContext("2d"), {
      type: "line",
      data: { datasets: [] },
      options: Object.assign(chartBase(), {
        scales: {
          x: Object.assign(chartBase().scales.x, { title: { display: true, text: "Drain voltage magnitude (V)", color: "#8fa3bb", font: { family: "DM Mono", size: 8 } } }),
          y: Object.assign(chartBase().scales.y, { title: { display: true, text: "Drain current (mA)", color: "#8fa3bb", font: { family: "DM Mono", size: 8 } } })
        }
      })
    });
  }
  function polarityText() {
    el("vgsLabel").textContent = polarity === "nmos" ? "VGS" : "|VSG|";
    el("vdsLabel").textContent = polarity === "nmos" ? "VDS" : "|VSD|";
    el("mosfetCurrentNote").textContent = polarity === "nmos" ? "Conventional drain current" : "Conventional drain-current magnitude";
  }
  function currentPointDataset(point, label, color) {
    return { type: "scatter", label: label, data: [point], borderColor: color, backgroundColor: color, pointRadius: 4, pointHoverRadius: 6, showLine: false };
  }
  function refreshCharts(p, op) {
    if (!transferChart || !outputChart) return;
    const compare = el("comparePolarity").checked;
    const activeType = polarity.toUpperCase();
    const otherType = polarity === "nmos" ? "PMOS" : "NMOS";
    const transfer = [{ label: activeType + " transfer", data: M.transferSweep(p), borderColor: colors[0], backgroundColor: colors[0], pointRadius: 0 }];
    if (compare) transfer.push({ label: otherType + " (matched model)", data: M.transferSweep(p), borderColor: colors[1], backgroundColor: colors[1], borderDash: [5, 4], pointRadius: 0 });
    transfer.push(currentPointDataset({ x: p.vgs, y: op.id * 1000 }, "Operating point", "#ffffff"));
    transferChart.data.datasets = transfer;
    transferChart.options.scales.x.title.text = polarity === "nmos" ? "VGS (V)" : "|VSG| (V)";
    transferChart.update("none");

    const gateLevels = [0.35, 0.7, 1.05, 1.4].map(function (offset) { return Math.min(8, p.vth + offset); });
    const output = gateLevels.map(function (vg, index) {
      return { label: (polarity === "nmos" ? "VGS " : "|VSG| ") + vg.toFixed(2) + " V", data: M.outputSweep(p, vg), borderColor: colors[index], backgroundColor: colors[index], pointRadius: 0 };
    });
    if (compare) {
      output.push({ label: otherType + " (matched model)", data: M.outputSweep(p, p.vgs), borderColor: "#ffffff", backgroundColor: "#ffffff", borderDash: [4, 4], borderWidth: 1, pointRadius: 0 });
    }
    output.push(currentPointDataset({ x: p.vds, y: op.id * 1000 }, "Operating point", "#ffffff"));
    outputChart.data.datasets = output;
    outputChart.options.scales.x.title.text = polarity === "nmos" ? "VDS (V)" : "|VSD| (V)";
    outputChart.update("none");
  }
  function update() {
    const p = config();
    const op = M.operatingPoint(p);
    latest = { config: p, result: op, time: new Date().toISOString() };
    el("vgsValue").textContent = p.vgs.toFixed(2) + " V";
    el("vdsValue").textContent = p.vds.toFixed(2) + " V";
    el("vthValue").textContent = p.vth.toFixed(2) + " V";
    el("knValue").textContent = p.knMilli.toFixed(2) + " mA/V²";
    el("wlValue").textContent = p.wl.toFixed(1);
    el("lambdaValue").textContent = p.lambda.toFixed(3) + " V⁻¹";
    el("mosfetCurrent").textContent = formatCurrent(op.id);
    el("mosfetGm").textContent = formatConductance(op.gm);
    el("mosfetVov").textContent = op.vov.toFixed(3) + " V";
    el("mosfetRegion").textContent = op.region.toUpperCase();
    el("mosfetRegion").classList.toggle("warning", op.region !== "Saturation");
    el("mosfetRegionNote").textContent = op.region === "Cutoff" ? "VGS ≤ VTH" : op.region === "Saturation" ? "VDS ≥ VOV" : "0 < VDS < VOV";
    el("formulaRegion").textContent = op.region.toUpperCase();
    const vgsName = polarity === "nmos" ? "VGS" : "|VSG|";
    const vdsName = polarity === "nmos" ? "VDS" : "|VSD|";
    const betaMilli = op.beta * 1000;
    let equation;
    if (op.region === "Cutoff") equation = "ID ≈ 0, when " + vgsName + " ≤ |VTH|";
    else if (op.region === "Saturation") equation = "ID = (" + betaMilli.toFixed(2) + " mA/V² / 2) · " + op.vov.toFixed(3) + "² · (1 + " + p.lambda.toFixed(3) + " · " + p.vds.toFixed(2) + ")";
    else equation = "ID = " + betaMilli.toFixed(2) + " mA/V² · (" + op.vov.toFixed(3) + " · " + vdsName + " − " + vdsName + "²/2) · (1 + λ" + vdsName + ")";
    el("activeEquation").textContent = equation;
    polarityText();
    refreshCharts(p, op);
    window.dispatchEvent(new CustomEvent("analogverse:device-updated", { detail: latest }));
  }
  function scheduleUpdate() {
    if (debounceFrame) cancelAnimationFrame(debounceFrame);
    debounceFrame = requestAnimationFrame(function () { debounceFrame = 0; update(); });
  }
  function reset() {
    el("vgsControl").value = "3.5";
    el("vdsControl").value = "5";
    el("vthControl").value = "2.5";
    el("knControl").value = "2";
    el("wlControl").value = "5";
    el("lambdaControl").value = "0.02";
    el("comparePolarity").checked = false;
    polarity = "nmos";
    document.querySelectorAll("[data-polarity]").forEach(function (b) { b.classList.toggle("active", b.dataset.polarity === polarity); });
    update();
  }
  function setPreset(name) {
    el("vgsControl").value = "3.5";
    el("vdsControl").value = "5";
    el("vthControl").value = "2.5";
    el("knControl").value = "2";
    el("wlControl").value = "5";
    el("lambdaControl").value = "0.02";
    polarity = "nmos";
    if (name !== "compare") el("comparePolarity").checked = false;
    if (name === "pmos") {
      polarity = "pmos";
      document.querySelectorAll("[data-polarity]").forEach(function (b) { b.classList.toggle("active", b.dataset.polarity === polarity); });
      el("vgsControl").value = "3.5";
      el("vdsControl").value = "5";
    } else if (name === "transfer") {
      polarity = "nmos";
      el("vgsControl").value = "2.65";
      el("vdsControl").value = "5";
    } else if (name === "output") {
      polarity = "nmos";
      el("vgsControl").value = "3.5";
      el("vdsControl").value = "5";
    } else if (name === "cutoff") {
      polarity = "nmos";
      el("vgsControl").value = "2.1";
      el("vdsControl").value = "5";
    } else if (name === "triode") {
      polarity = "nmos";
      el("vgsControl").value = "4.2";
      el("vdsControl").value = "0.35";
    } else if (name === "lambda") {
      polarity = "nmos";
      el("vgsControl").value = "3.5";
      el("vdsControl").value = "5";
      el("lambdaControl").value = "0.04";
    } else if (name === "geometry") {
      polarity = "nmos";
      el("vgsControl").value = "3.5";
      el("vdsControl").value = "5";
      el("wlControl").value = "10";
    } else if (name === "compare") {
      polarity = "nmos";
      el("vgsControl").value = "3.5";
      el("vdsControl").value = "5";
      el("comparePolarity").checked = true;
    }
    document.querySelectorAll("[data-polarity]").forEach(function (b) { b.classList.toggle("active", b.dataset.polarity === polarity); });
    update();
  }
  function chartImages() {
    return {
      transfer: transferChart ? transferChart.toBase64Image() : "",
      output: outputChart ? outputChart.toBase64Image() : ""
    };
  }
  function initialize() {
    if (!document.querySelector("[data-page=mosfet]")) return;
    initCharts();
    ids.forEach(function (id) { el(id).addEventListener("input", scheduleUpdate); el(id).addEventListener("change", scheduleUpdate); });
    document.querySelectorAll("[data-polarity]").forEach(function (button) {
      button.addEventListener("click", function () {
        polarity = button.dataset.polarity;
        document.querySelectorAll("[data-polarity]").forEach(function (b) { b.classList.toggle("active", b === button); });
        update();
      });
    });
    update();
  }
  document.addEventListener("DOMContentLoaded", initialize, { once: true });
  A.MosfetLab = {
    update: update,
    reset: reset,
    setPreset: setPreset,
    getSnapshot: function () { return latest; },
    getChartImages: chartImages
  };
}());

