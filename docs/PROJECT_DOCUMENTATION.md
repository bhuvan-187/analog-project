# ANALOGVERSE Project Documentation

## Introduction

ANALOGVERSE is a browser-based analog-electronics laboratory for device characterization, circuit design and introductory analysis. It connects editable component parameters with calculated operating points, frequency responses, time-domain traces and engineering plots. The project includes both focused teaching labs and a node-based schematic editor backed by a numerical MNA engine.

## Objectives

- Characterize NMOS and PMOS operation in cutoff, triode and saturation.
- Preserve the supplied Common Source amplifier while extending it with additional amplifier configurations.
- Explore current mirrors, CMOS switching, a MOS differential-pair OTA and op-amp feedback.
- Edit circuit connectivity and component models, then solve DC, transient and small-signal AC analyses.
- Connect virtual instruments to the active circuit model and provide guided exercises and reports.

## System architecture

The site is static HTML, CSS and JavaScript. No build step or backend is required. `device-model.js` supplies the original MOSFET equations; `circuit-models.js` contains the existing bias, mirror, CMOS, OTA and feedback calculations. `circuit-engine.js` implements MNA analysis; `circuit-worker.js` runs those calculations in a Web Worker when the page is served over HTTP. `circuit-studio.js` creates the editable SVG workspace, analysis controls, plots and data exports. Other modules provide the device lab, advanced labs, instruments, experiment guides and print-ready reports. LocalStorage retains settings and the saved Circuit Studio design.

For worker support, serve the project with a static HTTP server, such as `python -m http.server 8000`. When opened with `file:`, Circuit Studio uses the main browser thread. Chart.js and the selected web fonts are loaded from public CDNs.

## Circuit Studio interaction

The schematic canvas supports symbol placement, selection, multiselection, drag, rotation, duplicate, delete, pan and zoom. Components connect by electrical node names: edit terminal nets in the inspector, or choose **Wire pins** and click two terminals to join their nets. Moving symbols does not change connectivity. Undo/redo, browser-local save/load and JSON import/export are available. Built-in templates demonstrate a divider, RC response and filters, RLC resonance, diode rectification, MOSFET bias, current mirror, CMOS inverter and differential pair.

The component library contains resistors, capacitors, inductors, independent voltage and current sources, Shockley diodes, three-terminal square-law NMOS/PMOS devices and ground. Transient sources support DC steps, sine, square, triangle and pulse waveforms. The UI identifies unsupported device types instead of silently substituting a model.

## MNA methods

DC operating points use Newton-Raphson iterations over a real MNA system. Ideal voltage sources and DC inductors add branch-current unknowns. Resistors, independent current sources, Shockley diodes and square-law MOSFETs stamp their device equations into the nonlinear system. A singular circuit or a circuit that does not converge returns an explicit failure status.

Transient analysis uses fixed-step backward Euler for capacitors and inductors, with Newton iterations at each time step. A run is limited to 10,000 steps. AC analysis first solves the DC operating point, then linearizes diodes and MOSFETs around that bias and solves the complex MNA system at each requested frequency. AC independent-source magnitudes and phases provide the excitation.

The result panel reports node voltages, branch currents, component values and a DC or final-sample power summary. The graph displays a selected node voltage or transient component current, or AC magnitude and phase. CSV export includes node voltage samples or frequency-domain node magnitude/phase; JSON export saves the editable circuit; PNG export saves the graph image.

## Existing educational models

For normalized MOS terminal-voltage magnitudes, the long-channel MOS model uses β = Kn(W/L), VOV = VGS − VTH and:

- Cutoff: ID = 0 for VOV ≤ 0.
- Triode: ID = β(VOV·VDS − VDS²/2)(1 + λVDS), for 0 < VDS < VOV.
- Saturation: ID = (β/2)VOV²(1 + λVDS), for VDS ≥ VOV.
- Saturation transconductance: gm ≈ βVOV(1 + λVDS).
- Channel output conductance: gds ≈ (β/2)VOV²λ.

The other labs use bounded equation-based models: the amplifier workbench solves a scalar DC KCL root and evaluates first-order small-signal responses; the current mirror computes a geometry-scaled device current and compliance behavior; the CMOS lab solves static current balance; the OTA uses a matched square-law differential pair; and the op-amp block models finite open-loop gain with a single pole and resistive feedback. The original standalone Common Source page retains its capacitor-state transient implementation.

## Validation and testing

The Circuit Studio dashboard contains 12 comparisons with theoretical values: a divider, RC and RL step at one time constant, RC cutoff, diode half-wave peak, series RLC resonance, MOSFET bias current, common-source AC gain, current-mirror ratio, balanced differential-pair current, CMOS inverter endpoints and finite-A0 op-amp gain. All 12 passed in the direct numerical run. JavaScript syntax, local HTML asset paths, unique HTML IDs and experiment IDs were also checked. The original standalone Common Source file was verified byte-for-byte. Exact values and unverified browser behavior are recorded in `TEST_RESULTS.md`.

Browser interaction, chart display, print-dialog output, responsive layout and browser exports were not exercised in this environment. The local `file:` preview was rejected under the environment's URL policy; use a static HTTP server to run the project.

## Limitations

ANALOGVERSE is an educational model suite, not SPICE. The MNA MOSFET model omits body effect and charge storage; the diode is a Shockley junction. The library does not include BJTs, Zener/LED-specific behavior, op-amp macromodels, potentiometers, dependent sources, noise, temperature, mismatch, foundry models or layout parasitics. DC and nonlinear transient convergence is not guaranteed for singular, floating or poorly conditioned networks. Transient analysis uses fixed-step backward Euler; AC analysis is linearized about the DC point.

Outside Circuit Studio, the amplifier workbench waveform is a clipped first-harmonic response, CMOS time samples are quasi-static current-balance results, and the OTA and op-amp are compact educational models. Cascode and two-stage responses are first-order estimates. The instruments display calculated model values, not hardware measurements. Supply controls do not include current-limit foldback. Reports use the browser print dialog and do not directly write a PDF file.

## Applications and future scope

The labs support classroom demonstrations of device regions, biasing, small-signal gain, filters, rectification, resonance, current steering, CMOS switching and feedback. Future work could add adaptive time integration, semiconductor charge models, BJT models, device mismatch and temperature, and a validated SPICE backend.

## References

- A. S. Sedra and K. C. Smith, *Microelectronic Circuits*.
- P. R. Gray, P. J. Hurst, S. H. Lewis and R. G. Meyer, *Analysis and Design of Analog Integrated Circuits*.
- Long-channel MOSFET square-law and small-signal relations as presented in standard analog-circuit texts.
