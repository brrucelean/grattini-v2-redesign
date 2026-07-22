// ─── UI ZOOM — shared mutable global ─────────────────────────
let _uiZoom = 1;

export function getUiZoom() { return _uiZoom; }
export function setUiZoom(v) { _uiZoom = v; }
