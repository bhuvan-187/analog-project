# ANALOGVERSE — Analog Electronics Virtual Laboratory

ANALOGVERSE is a responsive, browser-based lab for analog device characterization, circuit design and introductory circuit analysis. The project includes an editable schematic workspace with a bounded modified nodal analysis (MNA) engine. The supplied Common Source MOSFET amplifier remains available as a standalone page at `labs/common-source-amplifier/index.html` and inside the Amplifier Design Lab.

## Run locally

1. Open `index.html` in a current desktop browser, or serve this folder with a static HTTP server.
2. No build step or backend is required. Circuit Studio runs its numerical solver in a Web Worker when served over HTTP; it falls back to the main browser thread when workers are unavailable or the page is opened with `file:`.
3. Chart.js and selected web fonts load from public CDNs, so graphs and typography need an internet connection. Equations, controls and text remain available without the CDN.

For a local server, run `python -m http.server 8000` from this folder and visit `http://localhost:8000`.

## Modules

- MOSFET Device Lab: NMOS/PMOS cutoff, triode and saturation characteristics, transconductance and channel-length modulation.
- Amplifier Design Lab: common source, common gate, common drain, cascode, source-degenerated and two-stage estimates. The original Common Source lab is preserved.
- Current Mirror Lab, CMOS Lab, OTA and Op-Amp Lab, and Advanced Circuit Analysis.
- Circuit Studio: editable SVG symbols, node-based wiring, component inspector, DC/transient/AC analysis, a 12-case numerical validation dashboard, CSV/JSON/PNG export, undo/redo, templates, save/load and import/export.
- Virtual Instruments: shared function generator, model-linked DMM and oscilloscope with time/div, separate channel V/div and trigger source/level.
- Experiment Center: 33 guided experiments and print-ready individual or combined reports.
- Performance Comparison and Reports & Documentation.

## Circuit Studio engine

`src/js/circuit-engine.js` implements DC and transient Newton-Raphson MNA, backward-Euler integration and small-signal AC analysis with a complex MNA solve. `src/js/circuit-worker.js` runs those calculations away from the UI thread when a worker is available. `src/js/circuit-studio.js` provides the schematic editor, templates, plots and result exports. `src/js/circuit-models.js` and `src/js/device-model.js` hold the existing educational device and circuit models.

The editor supports resistors, capacitors, inductors, independent voltage and current sources, Shockley diodes, three-terminal square-law NMOS/PMOS devices and ground. Transient independent sources support DC steps, sine, square, triangle and pulse waveforms. The MNA solver limits a transient run to 10,000 steps.

## Model boundaries

This is an educational simulator, not SPICE. The MNA MOSFET model uses long-channel square-law equations with channel-length modulation and no body effect or charge storage. The diode uses the Shockley equation. Capacitors and inductors use fixed-step backward Euler in transient analysis. AC results linearize nonlinear devices about a converged DC operating point. Floating or singular circuits and unsupported elements return an error instead of a result.

The MNA part library does not include BJTs, Zener/LED-specific models, op-amp macromodels, potentiometers, dependent sources, semiconductor charge models, noise or temperature effects. The other labs also use explicit first-order teaching models: the amplifier workbench's waveform is a clipped first-harmonic response, CMOS transient points are quasi-static current-balance solutions, the OTA is a matched long-channel pair, and the op-amp is a finite-A0 one-pole feedback block rather than a transistor-level model. Supply controls do not model current-limit foldback. Results are calculated model values, not hardware measurements.

## Validation

The project includes numerical checks for divider, RC/RL transient, RC AC cutoff, diode rectifier, RLC resonance, MOSFET bias and gain, current mirror, differential pair, CMOS inverter and finite-A0 op-amp gain. Source syntax and static asset references are checked separately. Browser navigation, chart rendering, responsive layout, report printing and export dialogs were not verified in the environment run; see `TEST_RESULTS.md` for exact results and boundaries.
