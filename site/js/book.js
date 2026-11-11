(() => {
  const ClioSite = (window.ClioSite = window.ClioSite || {});

  const RAMP = ' .:-=+*#%@';
  const RAMP_MAX = RAMP.length - 1;
  const PAGE_COUNT = 26;
  const PAGE_WIDTH = 1.0;
  const PAGE_HEIGHT = 1.42;
  const TILT = 0.62;
  const LIGHT = { x: -0.35, y: 0.55, z: 0.76 };
  const FRAME_INTERVAL_MS = 40;
  const STATIC_FRAME_TIME = 6.5;

  function hash(index) {
    const n = Math.sin(index * 12.9898) * 43758.5453;
    return n - Math.floor(n);
  }

  function createGrid(stage, pre) {
    const box = stage.getBoundingClientRect();
    const cellPx = Math.max(5, Math.min(10, box.width / 92));
    pre.style.setProperty('--bcell', `${cellPx}px`);

    const probe = document.createElement('span');
    probe.style.cssText =
      'position:absolute;visibility:hidden;white-space:pre;line-height:1;letter-spacing:0;' +
      `font-family:${getComputedStyle(pre).fontFamily};font-size:${cellPx}px`;
    probe.textContent = '0000000000';
    document.body.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    document.body.removeChild(probe);

    const cellWidth = rect.width / 10 || cellPx * 0.6;
    const cellHeight = rect.height || cellPx;
    const aspect = cellWidth / cellHeight;
    const cols = Math.floor(box.width / cellWidth);
    const rows = Math.floor(box.height / cellHeight);
    return {
      cols,
      rows,
      aspect,
      depth: new Float32Array(cols * rows),
      light: new Float32Array(cols * rows),
      scale: Math.min(rows * 0.56, cols * aspect * 0.36),
      originX: cols * 0.46,
      originY: rows * 0.7,
    };
  }

  function rasterPage(grid, phi0, bend, edge, yaw) {
    const { cols, rows, aspect, depth, light, scale, originX, originY } = grid;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const ct = Math.cos(TILT);
    const st = Math.sin(TILT);
    const stepsU = Math.max(18, Math.round(cols * 0.26));
    const stepsV = Math.max(24, Math.round(rows * 0.8));
    const du = PAGE_WIDTH / stepsU;
    let x = 0;
    let z = 0;

    for (let iu = 0; iu <= stepsU; iu++) {
      const u = iu / stepsU;
      const phi = phi0 + bend * u;
      x += Math.cos(phi) * du;
      z += Math.sin(phi) * du;
      const nx = -Math.sin(phi);
      const nz = Math.cos(phi);
      const nX = nx * cy;
      const nY = nx * sy;
      const nDepth = -nY * ct + nz * st;
      const nUp = nz * ct + nY * st;
      const lum = Math.abs(nX * LIGHT.x + nUp * LIGHT.y + nDepth * LIGHT.z);

      for (let iv = 0; iv <= stepsV; iv++) {
        const v = iv / stepsV;
        const y = (v - 0.5) * PAGE_HEIGHT;
        const X = x * cy - y * sy;
        const Y = x * sy + y * cy;
        const up = z * ct + Y * st;
        const d = -Y * ct + z * st;
        const k = 4 / (4 - d);
        const col = Math.round(originX + (X * scale * k) / aspect);
        const row = Math.round(originY - up * scale * k);
        if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
        const j = row * cols + col;
        if (d <= depth[j]) continue;
        depth[j] = d;

        let value = 0.06 + lum * 0.62;
        if (u > 0.14 && u < 0.9 && v > 0.1 && v < 0.9 && (v * 30) % 1 < 0.45) value *= 0.35;
        if (iu === stepsU) value = Math.max(value, 0.92 * edge);
        else if (iv === 0 || iv === stepsV) value = Math.max(value, 0.62 * edge);
        value += (hash(j + iu) - 0.5) * 0.12;
        light[j] = value;
      }
    }
  }

  function drawFrame(grid, pre, pageNo, time) {
    const { cols, rows, depth, light } = grid;
    depth.fill(-99);
    light.fill(0);
    const yaw = 0.32 + Math.sin(time * 0.23) * 0.07;

    rasterPage(grid, 0.03, 0, 0.6, yaw);
    rasterPage(grid, Math.PI - 0.03, 0, 0.6, yaw);
    for (let i = 0; i < PAGE_COUNT; i++) {
      const s = (i / PAGE_COUNT + time * 0.045) % 1;
      const eased = 0.5 - 0.5 * Math.cos(Math.PI * s);
      const phi = 0.07 + (Math.PI - 0.14) * (1 - eased);
      const lift = Math.sin(phi);
      const bend = (phi < Math.PI / 2 ? 0.5 : -0.5) * lift * lift;
      rasterPage(grid, phi, bend, 1, yaw);
    }

    const lines = new Array(rows);
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let c = 0; c < cols; c++) {
        const v = light[r * cols + c];
        if (v <= 0 && hash(r * 977 + c + Math.floor(time * 3)) > 0.996) {
          line += '.';
          continue;
        }
        line += v <= 0.12 ? ' ' : RAMP.charAt(v >= 1 ? RAMP_MAX : (v * RAMP_MAX) | 0);
      }
      lines[r] = line;
    }
    pre.textContent = lines.join('\n');
    const page = (Math.floor(time * 0.045 * PAGE_COUNT) % 999) + 1;
    pageNo.textContent = String(page).padStart(3, '0');
  }

  function startBook({ stage, pre, pageNo, reduceMotion }) {
    let grid = createGrid(stage, pre);

    if (reduceMotion) {
      drawFrame(grid, pre, pageNo, STATIC_FRAME_TIME);
      return;
    }

    let visible = true;
    let last = 0;
    const start = performance.now();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
      }).observe(stage);
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        grid = createGrid(stage, pre);
      }, 180);
    });

    const loop = (now) => {
      requestAnimationFrame(loop);
      if (!visible || now - last < FRAME_INTERVAL_MS) return;
      last = now;
      drawFrame(grid, pre, pageNo, (now - start) / 1000);
    };
    loop(start);
  }

  ClioSite.book = { startBook };
})();
