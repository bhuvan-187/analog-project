# ANALOGVERSE Test Results

## Checks run

**JavaScript syntax:** `node --check` passed for every JavaScript file in `src/js/`, including the MNA engine, worker and Circuit Studio UI.

**Static project integrity:** all 72 static HTML IDs are unique; all 13 local JavaScript and stylesheet references from `index.html` exist. The Experiment Center contains 33 records with unique IDs.

**Original project preservation:** `labs/common-source-amplifier/index.html` matches the supplied standalone Common Source page byte-for-byte (SHA-256 `EF9B07F9DD3B1D5DF68F1E7218B9FFAE2C1EA908F76C9C3FB6FC2C8EBE1EE937`).

**MNA numerical validation:** all 12 engine cases passed:

| Case | Theoretical value | Solver result | Relative error |
|---|---:|---:|---:|
| 12 V divider output | 4 V | 4 V | 0% |
| RC step at 1τ | 0.632121 V | 0.630289 V | 0.2898% |
| RL step at 1τ | 0.0632121 A | 0.0630289 A | 0.2898% |
| RC cutoff magnitude | 0.707107 V/V | 0.707107 V/V | <0.0001% |
| Half-wave diode output peak | 4.42585 V | 4.42585 V | 0% |
| Series RLC current at resonance | 0.1 A | 0.1 A | 0% |
| Square-law NMOS operating current | 1 mA | 1 mA | 0% |
| Common-source AC gain | −1.91327 V/V | −1.91327 V/V | 0% |
| 2:1 NMOS current mirror output | 2 mA | 2 mA | 0% |
| Balanced differential-pair branch current | 0.5 mA | 0.5 mA | <0.0001% |
| CMOS inverter rail endpoints | 5 V / 0 V | 5 V / ~0 V | <0.0001% |
| Finite-A0 non-inverting gain | 10 V/V | 9.99900 V/V | 0.0100% |

The models loaded in a direct Node.js run and produced the same 12 passing records as the Circuit Studio validation suite. The differential-pair case also confirms convergence after the MOS source-node initial-guess correction.

Earlier deterministic model checks also passed for MOSFET cutoff/triode/saturation boundaries and channel-length modulation; the amplifier workbench's default bias and KCL residual; mirror compliance; CMOS current balance; OTA small-signal transconductance and tail-current limit; and finite-A0 op-amp feedback. These checks validate their stated educational equations, not universal circuit accuracy.

## Not verified in this run

The Codex browser preview rejected opening the local `file:` URL under its URL policy. No alternate browser route was used. Page navigation, interactive schematic editing, worker execution in a browser, chart rendering, responsive layout, scope drawing, report layout, print-to-PDF, and export dialogs were therefore not exercised end to end. Chart.js and the selected fonts load from public CDNs.

The MNA checks cover the listed deterministic circuits and parameters. They do not establish SPICE equivalence or validate every topology and parameter combination. Nonlinear convergence can fail for singular, floating, or poorly conditioned circuits; the engine reports the failure. Transient analysis uses fixed-step backward Euler and caps each run at 10,000 steps. AC analysis is a small-signal linearization around the DC operating point. See `README.md` for the supported device set and model boundaries.

## PDF behavior

The report builder creates a print-ready HTML report and invokes the browser print dialog. Use the browser's **Save as PDF** destination to export it. This interaction was not exercised in the environment run above.
