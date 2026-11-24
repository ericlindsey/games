// The settings panel (built from PARAMS) and the readout box.

import { PARAMS, toSlider, fromSlider, format } from './params.js';
import { comfortFor } from './physics.js';

/** Build sliders into `root`. onChange(key, value) fires while dragging. */
export function buildPanel(root, params, onChange) {
  const rows = {};
  let group = null;
  for (const def of PARAMS) {
    if (def.group !== group) {
      group = def.group;
      const h = document.createElement('h3');
      h.textContent = group;
      root.appendChild(h);
    }
    const row = document.createElement('label');
    row.className = 'row';
    const top = document.createElement('div');
    top.className = 'top';
    const name = document.createElement('span');
    name.textContent = def.label;
    const val = document.createElement('output');
    top.append(name, val);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = 0;
    input.max = def.kind === 'steps' ? def.steps.length - 1 : 1000;
    input.step = 1;
    input.value = toSlider(def, params[def.key]);
    input.dataset.key = def.key;
    val.textContent = format(def, params[def.key]);
    input.addEventListener('input', () => {
      const v = fromSlider(def, Number(input.value));
      val.textContent = format(def, v);
      onChange(def.key, v);
    });
    row.append(top, input);
    root.appendChild(row);
    rows[def.key] = { input, val, def };
  }
  return {
    /** Move a slider to show a value set from code (no change event). */
    set(key, v) {
      const r = rows[key];
      if (!r || document.activeElement === r.input) return;
      r.input.value = toSlider(r.def, v);
      r.val.textContent = format(r.def, v);
    },
    setAll(p) { for (const k in rows) this.set(k, p[k]); },
  };
}

const fmt = (v, d = 0) => v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

function duration(s) {
  if (s < 120) return `${fmt(s, 1)} s`;
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

export function readoutHTML(d, p, live) {
  const c = comfortFor(d.rpm);
  const area = d.floorArea >= 1e4 ? `${fmt(d.floorArea / 1e4, 2)} ha` : `${fmt(d.floorArea)} m²`;
  return `
    <div><b>Spin</b> ${fmt(d.rpm, 2)} rpm · one turn in ${duration(d.period)}</div>
    <div class="c${c.level}">${c.text}</div>
    <div><b>Rim speed</b> ${fmt(d.rimSpeed, 1)} m/s (${fmt(d.rimSpeed * 3.6)} km/h)</div>
    <div><b>At eye level</b> ${fmt(d.gHead, 3)} g (${fmt(d.gradient * 100, 1)}% less than at your feet)</div>
    <div><b>Coriolis</b> walking at 1.4 m/s: ${fmt(d.coriolisWalk, 3)} g sideways</div>
    <div><b>Floor</b> ${area} · ring ${fmt(2 * Math.PI * d.R)} m round</div>
    <div><b>Orbit</b> ${fmt(d.orbit.altitude)} km up · ${duration(d.orbit.period)} · ${fmt(d.orbit.speed, 2)} km/s</div>
    <div><b>Sun</b> ${live.sunElev >= 0 ? `${fmt(live.sunElev)}° above` : `${fmt(-live.sunElev)}° below`} your horizon
      · <b>Moon</b> centre ${live.moonElev >= 0 ? `${fmt(live.moonElev)}° above` : `${fmt(-live.moonElev)}° below`}</div>
  `;
}
