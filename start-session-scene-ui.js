(function (root) {
  'use strict';

  const TAU = 2 * Math.PI;
  const colors = {
    housing: [89, 105, 119], chuck: [154, 170, 183], jaw: [143, 158, 171],
    stock: [162, 181, 195], holder: [65, 84, 101], insert: [230, 171, 62],
    bolt: [41, 57, 70], groove: [98, 114, 129],
  };

  function lathe(faces, profile, material, spin = false, center = [0, 0]) {
    const sides = 48;
    for (let ring = 1; ring < profile.length; ring++) {
      const [x0, r0] = profile[ring - 1];
      const [x1, r1] = profile[ring];
      for (let side = 0; side < sides; side++) {
        const a = side * TAU / sides, b = (side + 1) * TAU / sides;
        const point = (x, r, angle) => [x, center[0] + r * Math.cos(angle), center[1] + r * Math.sin(angle)];
        const mid = (a + b) / 2;
        faces.push({
          points: [point(x0, r0, a), point(x1, r1, a), point(x1, r1, b), point(x0, r0, b)],
          normal: [r0 - r1, (x1 - x0) * Math.cos(mid), (x1 - x0) * Math.sin(mid)],
          material, spin,
        });
      }
    }
  }

  function prism(faces, outline, z0, z1, material, spin = false, tool = false) {
    const add = (points, normal) => faces.push({ points, normal, material, spin, tool });
    add(outline.map(([x, y]) => [x, y, z0]), [0, 0, -1]);
    add(outline.map(([x, y]) => [x, y, z1]), [0, 0, 1]);
    outline.forEach(([x, y], i) => {
      const [nextX, nextY] = outline[(i + 1) % outline.length];
      add([[x, y, z0], [nextX, nextY, z0], [nextX, nextY, z1], [x, y, z1]], [nextY - y, x - nextX, 0]);
    });
  }

  function mesh() {
    const faces = [];
    lathe(faces, [[-53, 0], [-53, 93], [-49, 99], [-18, 99], [-11, 94], [-11, 0]], colors.housing);
    lathe(faces, [[-18, 0], [-18, 88], [-12, 94], [22, 94], [30, 88], [30, 0]], colors.chuck);
    lathe(faces, [[30, 51], [30.2, 51], [30.2, 50], [30, 50]], colors.groove);
    lathe(faces, [[26, 0], [26, 27], [308, 27], [311, 25], [311, 0]], colors.stock);
    lathe(faces, [[311.1, 3], [311.2, 3], [311.2, 0]], colors.groove, true, [16, 0]);
    for (let i = 0; i < 3; i++) {
      const angle = i * TAU / 3;
      const rotate = ([x, y, z]) => [x, y * Math.cos(angle) - z * Math.sin(angle), y * Math.sin(angle) + z * Math.cos(angle)];
      const jaw = [];
      prism(jaw, [[27, 29], [54, 29], [54, 48], [47, 48], [47, 66], [39, 66], [39, 83], [27, 83]], -13, 13, colors.jaw, true);
      lathe(jaw, [[30.4, 5], [31, 5], [31, 0]], colors.bolt, true, [74, 28]);
      jaw.forEach(face => faces.push({ ...face, points: face.points.map(rotate), normal: rotate(face.normal) }));
    }
    prism(faces, [[143, 72], [174, 72], [183, 103], [215, 109], [215, 143], [143, 143]], 13, 38, colors.holder, false, true);
    prism(faces, [[143, 57], [162, 66], [172, 83], [145, 80]], 22, 40, colors.insert, false, true);
    return faces;
  }

  function create() {
    const canvas = document.createElement('canvas');
    canvas.className = 'start-lathe';
    canvas.width = 1080;
    canvas.height = 462;
    canvas.setAttribute('role', 'img');
    canvas.textContent = 'Патрон удерживает цилиндрическую заготовку. Резец расположен над заготовкой.';
    const ctx = canvas.getContext('2d');
    const faces = ctx ? mesh() : [];
    const motionPreference = root.matchMedia?.('(prefers-reduced-motion: reduce)');
    const yaw = .52, pitch = .19;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    let state, angle = .32, request = 0, previous = 0, brake = null, speed = 0;

    function view(x, y, z) {
      return [cy * x - sy * z, -sp * (sy * x + cy * z) + cp * y, cp * (sy * x + cy * z) + sp * y];
    }

    function screen(x, y) {
      const left = 305 + 1.92 * x;
      return [state.step === 2 ? canvas.width - left : left, 258 - 1.92 * y];
    }

    function draw() {
      if (!ctx) return;
      const c = Math.cos(angle), s = Math.sin(angle);
      const visible = [];
      for (const face of faces) {
        const [nx, ny, nz] = face.normal;
        const normal = face.spin ? view(nx, ny * c - nz * s, ny * s + nz * c) : view(nx, ny, nz);
        if (normal[2] <= 0) continue;
        const points = face.points.map(([x, y, z]) => face.spin
          ? view(x, y * c - z * s, y * s + z * c)
          : view(x + (face.tool ? state.tool * 28 : 0), y, z));
        const depth = points.reduce((sum, point) => sum + point[2], 0) / points.length;
        const light = Math.max(0, (-.32 * normal[0] + .78 * normal[1] + .54 * normal[2]) / Math.hypot(...normal));
        const tone = .57 + .63 * light;
        visible.push({ points, depth, fill: 'rgb(' + face.material.map(channel => Math.round(channel * tone)).join(',') + ')' });
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      visible.sort((a, b) => a.depth - b.depth);
      for (const face of visible) {
        ctx.beginPath();
        face.points.forEach(([x, y], index) => {
          const [px, py] = screen(x, y);
          if (index === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle = face.fill;
        ctx.lineWidth = 1.15;
        ctx.fill();
        ctx.stroke();
      }
      if (state.motion !== 'stopped') drawArrow();
      if (state.step === 0 || state.step === 2) {
        const labels = state.step === 2 ? ['B', 'C', 'A'] : ['A', 'B', 'C'];
        const positions = [[-111, -72, 0], [223, -60, 0], [185, 129, -15]];
        positions.forEach((point, index) => {
          const [x, y] = screen(...view(...point));
          ctx.beginPath();
          ctx.arc(x, y, 17, 0, TAU);
          ctx.fillStyle = '#2458ee';
          ctx.fill();
          ctx.font = 'bold 20px system-ui';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fff';
          ctx.fillText(labels[index], x, y);
        });
      }
    }

    function drawArrow() {
      const point = a => screen(...view(34, 68 * Math.cos(a), 68 * Math.sin(a)));
      const start = .27, end = 1.8;
      ctx.beginPath();
      ctx.moveTo(...point(start));
      for (let a = start + .05; a < end; a += .05) ctx.lineTo(...point(a));
      const [x, y] = point(end), [px, py] = point(end - .15);
      ctx.lineTo(x, y);
      const direction = Math.atan2(y - py, x - px);
      for (const offset of [-.6, .6]) {
        ctx.moveTo(x, y);
        ctx.lineTo(x - 14 * Math.cos(direction + offset), y - 14 * Math.sin(direction + offset));
      }
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#2458ee';
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.stroke();
    }

    function frame(now) {
      request = 0;
      if (!canvas.isConnected) return;
      const elapsed = previous ? Math.min(50, now - previous) / 1000 : 0;
      previous = now;
      if (brake) {
        const remaining = motionPreference?.matches ? 0 : Math.max(0, 1 - (now - brake.started) / 1050);
        speed = brake.speed * remaining;
      }
      angle = (angle + speed * elapsed) % TAU;
      draw();
      if (brake && speed === 0) {
        const { done } = brake;
        brake = null;
        done();
      }
      schedule();
    }

    function schedule() {
      if (ctx && !request && canvas.isConnected && (brake || (speed > 0 && !motionPreference?.matches))) {
        request = root.requestAnimationFrame(frame);
      }
    }

    function update(next) {
      const changed = state?.motion !== next.motion;
      state = next;
      canvas.setAttribute('aria-label', next.step === 2
        ? 'A — верхняя узкая деталь с кромкой, B — массивный узел справа, C — цилиндр посередине.'
        : 'Патрон слева удерживает цилиндрическую заготовку. Резец расположен сверху.');
      if (changed || (next.motion !== 'stopped' && speed === 0 && !brake)) {
        speed = { running: 2.6, coasting: 1.25, stopped: 0 }[state.motion];
        previous = 0;
      }
      draw();
      queueMicrotask(schedule);
    }

    function wait(done) {
      if (!ctx || motionPreference?.matches) return done();
      brake = { started: performance.now(), speed, done };
      schedule();
    }

    return { canvas, update, wait };
  }

  root.CNCStartSessionSceneUI = Object.freeze({ create });
})(window);
