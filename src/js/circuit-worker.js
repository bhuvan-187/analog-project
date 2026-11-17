"use strict";
importScripts("circuit-models.js", "circuit-engine.js");
self.onmessage = function (event) {
  const request = event.data || {}, engine = self.Analogverse.CircuitEngine;
  let result;
  try {
    if (request.mode === "dc") result = engine.solveDC(request.elements);
    else if (request.mode === "transient") result = engine.solveTransient(request.elements, request.options);
    else if (request.mode === "ac") result = engine.solveAC(request.elements, request.frequencies);
    else result = { converged: false, error: "Unsupported analysis mode." };
    self.postMessage({ id: request.id, result: result });
  } catch (error) {
    self.postMessage({ id: request.id, result: { converged: false, error: error.message || String(error) } });
  }
};
