/**
 * Procedural PBR Canvas Texture Generator
 * Pure Mathematical & HTML Canvas generation - 0% external asset dependency, 0% CORS issues
 */

const Textures = {
  cache: {},

  // Bề mặt đất rừng tự nhiên (Natural Forest Ground)
  // Kết hợp hài hòa nâu đất ẩm (#4a3c2c) và cỏ kim xẫm (#3d4a2d) với nhiễu hạt mịn (Fine Noise)
  // 100% Liền mạch (Seamless Tiling), không đốm tròn, không viền ghép ô vuông (Zero Grid Seams)
  forestGround() {
    if (this.cache.forestGround) return this.cache.forestGround;
    const w = 512, h = 512;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y++) {
      const ny = (y / h) * Math.PI * 2;
      const sinY = Math.sin(ny);
      const cosY = Math.cos(ny);
      const sin2Y = Math.sin(ny * 2);
      const cos2Y = Math.cos(ny * 2);
      const sin3Y = Math.sin(ny * 3);

      for (let x = 0; x < w; x++) {
        const nx = (x / w) * Math.PI * 2;
        const sinX = Math.sin(nx);
        const cosX = Math.cos(nx);
        const sin2X = Math.sin(nx * 2);
        const cos2X = Math.cos(nx * 2);
        const sin3X = Math.sin(nx * 3);

        // Hòa âm lượng giác Toroidal đảm bảo biên viền 100% lặp khớp hoàn hảo, không có đường biên
        const harm1 = (sinX + cosY) * 0.32;
        const harm2 = (sin2X * cos2Y + cos2X * sin2Y) * 0.22;
        const harm3 = (sin3X + sin3Y) * 0.12;
        let t = 0.5 + harm1 + harm2 + harm3;
        t = Math.max(0, Math.min(1, t));

        // Nhiễu hạt mịn tự nhiên (Fine Grain Noise) mô phỏng cấu trúc mùn đất và lá mục
        const grain = (Math.random() - 0.5) * 8.5;

        // Hòa trộn giữa #3d4a2d (61, 74, 45) và #4a3c2c (74, 60, 44)
        const r = Math.min(255, Math.max(0, Math.round(61 + (74 - 61) * t + grain)));
        const g = Math.min(255, Math.max(0, Math.round(74 + (60 - 74) * t + grain)));
        const b = Math.min(255, Math.max(0, Math.round(45 + (44 - 45) * t + grain * 0.8)));

        const idx = (y * w + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    this.cache.forestGround = tex;
    return tex;
  },

  // Alias ground sang forestGround để đồng bộ toàn bộ địa hình
  ground() {
    return this.forestGround();
  },

  // Vỏ cây thông nứt nẻ gồ ghề có rêu ẩm
  bark() {
    if (this.cache.bark) return this.cache.bark;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 512;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#3e2723';
    ctx.fillRect(0, 0, 256, 512);

    // Rãnh vỏ dọc sần sùi
    for (let x = 0; x < 256; x += 4) {
      const dark = Math.random() * 40 - 20;
      ctx.fillStyle = `rgb(${62 + dark}, ${39 + dark * 0.7}, ${35 + dark * 0.6})`;
      ctx.fillRect(x, 0, 3 + Math.random() * 3, 512);
    }

    // Mảng rêu ẩm màu xanh rêu
    for (let i = 0; i < 40; i++) {
      const rx = Math.random() * 256;
      const ry = Math.random() * 512;
      ctx.fillStyle = 'rgba(46, 125, 50, 0.35)';
      ctx.beginPath();
      ctx.ellipse(rx, ry, Math.random() * 15 + 5, Math.random() * 30 + 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 2);
    this.cache.bark = tex;
    return tex;
  },

  // Mặt cắt khúc gỗ có vân tròn đồng tâm (Tree Rings)
  treeRings() {
    if (this.cache.rings) return this.cache.rings;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#e0a96d';
    ctx.fillRect(0, 0, 256, 256);

    const cx = 128, cy = 128;
    for (let r = 6; r < 124; r += 4.5) {
      ctx.strokeStyle = Math.random() > 0.3 ? '#8d5b2c' : '#b87d46';
      ctx.lineWidth = Math.random() * 1.8 + 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, r + (Math.random() - 0.5) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Tâm lõi gỗ (Heartwood)
    ctx.fillStyle = '#6d421d';
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(cv);
    this.cache.rings = tex;
    return tex;
  },

  // Ván gỗ xơ ráp tự nhiên
  plank() {
    if (this.cache.plank) return this.cache.plank;
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#d97706';
    ctx.fillRect(0, 0, 512, 128);

    // Thớ xơ gỗ nằm ngang
    for (let y = 0; y < 128; y += 3) {
      const shade = (Math.random() - 0.5) * 30;
      ctx.fillStyle = `rgb(${217 + shade}, ${119 + shade * 0.8}, ${6 + shade * 0.4})`;
      ctx.fillRect(0, y, 512, 2.5);
    }

    // Vài mắt gỗ nhỏ
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.ellipse(Math.random() * 450 + 30, Math.random() * 100 + 14, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(cv);
    this.cache.plank = tex;
    return tex;
  },

  woodPlank() {
    return this.plank();
  },

  // Gỗ thông Bắc Âu ốp tường và sàn cao cấp (Scandinavian Timber Log Planks)
  timberPlank() {
    if (this.cache.timberPlank) return this.cache.timberPlank;
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 256;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#b45309';
    ctx.fillRect(0, 0, 512, 256);

    const plankH = 32;
    for (let y = 0; y < 256; y += plankH) {
      const baseTone = (Math.random() - 0.5) * 20;
      ctx.fillStyle = `rgb(${205 + baseTone}, ${125 + baseTone * 0.8}, ${45 + baseTone * 0.4})`;
      ctx.fillRect(0, y, 512, plankH - 2);

      // Thớ vân gỗ mịn
      for (let py = y + 2; py < y + plankH - 3; py += 3) {
        ctx.fillStyle = 'rgba(120, 53, 15, 0.25)';
        ctx.fillRect(0, py, 512, 1.2);
      }

      // Rãnh nối mộng gỗ tối màu
      ctx.fillStyle = '#451a03';
      ctx.fillRect(0, y + plankH - 2, 512, 2);
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    this.cache.timberPlank = tex;
    return tex;
  },

  // Ngói đất nung đỏ cam phong cách Bắc Âu (Terracotta Scandinavian Roof Tiles)
  scandiRoof() {
    if (this.cache.scandiRoof) return this.cache.scandiRoof;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#9a3412';
    ctx.fillRect(0, 0, 256, 256);

    const rowH = 24;
    let rowIdx = 0;
    for (let y = 0; y < 256; y += rowH) {
      const xOffset = (rowIdx % 2) * 16;
      for (let x = -16; x < 256; x += 32) {
        const tone = (Math.random() - 0.5) * 18;
        ctx.fillStyle = `rgb(${215 + tone}, ${75 + tone * 0.6}, ${25 + tone * 0.3})`;
        ctx.beginPath();
        ctx.roundRect(x + xOffset + 1, y + 1, 30, rowH - 2, 4);
        ctx.fill();

        // Viền bóng gờ ngói
        ctx.fillStyle = 'rgba(67, 20, 7, 0.35)';
        ctx.fillRect(x + xOffset + 1, y + rowH - 3, 30, 2);
      }
      rowIdx++;
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    this.cache.scandiRoof = tex;
    return tex;
  },

  // Sàn đá cuội lát bo tròn (Cobblestone Flagstone Pavers)
  cobblestonePavers() {
    if (this.cache.cobblestonePavers) return this.cache.cobblestonePavers;
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 512;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 512, 512);

    const stoneSize = 32;
    for (let y = 0; y < 512; y += stoneSize) {
      const offX = ((y / stoneSize) % 2) * (stoneSize / 2);
      for (let x = -stoneSize; x < 512; x += stoneSize) {
        const tone = (Math.random() - 0.5) * 24;
        ctx.fillStyle = `rgb(${140 + tone}, ${148 + tone}, ${156 + tone})`;
        ctx.beginPath();
        ctx.roundRect(x + offX + 2, y + 2, stoneSize - 4, stoneSize - 4, 6);
        ctx.fill();

        // Gờ sáng nhẹ trên đỉnh viên đá
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(x + offX + 4, y + 4, stoneSize - 8, 3);
      }
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    this.cache.cobblestonePavers = tex;
    return tex;
  },

  // Bê tông xám công nghiệp có vết rạn nứt & vệt dầu nhớt
  concretePBR() {
    if (this.cache.concrete) return this.cache.concrete;
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 512;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 1500; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.fillStyle = Math.random() > 0.5 ? '#334155' : '#64748b';
      ctx.fillRect(x, y, Math.random() * 3 + 1, Math.random() * 3 + 1);
    }

    // Vết dầu loang đen bóng
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.beginPath();
    ctx.ellipse(260, 240, 55, 35, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Rãnh nứt chân chim
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(120, 100); ctx.lineTo(160, 140); ctx.lineTo(180, 200);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    this.cache.concrete = tex;
    return tex;
  },

  // Vạch sơn an toàn chéo vàng/đen công nghiệp
  hazardStripes() {
    if (this.cache.stripes) return this.cache.stripes;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#0f172a';
    for (let i = -256; i < 512; i += 48) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 24, 0);
      ctx.lineTo(i + 24 + 256, 256);
      ctx.lineTo(i + 256, 256);
      ctx.closePath();
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    this.cache.stripes = tex;
    return tex;
  },

  // Mặt đường nhựa Asphalt có vết vá & vệt phanh
  asphalt() {
    if (this.cache.asphalt) return this.cache.asphalt;
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 512;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.fillStyle = Math.random() > 0.5 ? '#0f172a' : '#334155';
      ctx.fillRect(x, y, 2, 2);
    }

    // Vệt phanh đen lốp xe
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(140, 0, 18, 512);
    ctx.fillRect(350, 0, 18, 512);

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 4);
    this.cache.asphalt = tex;
    return tex;
  },

  // Texture thác nước cuộn bọt trắng
  waterfall() {
    if (this.cache.waterfall) return this.cache.waterfall;
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 256;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 0, 128, 256);

    // Dải bọt trắng cuộn dọc
    for (let y = 0; y < 256; y += 4) {
      for (let x = 0; x < 128; x += 6) {
        if (Math.random() > 0.4) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.fillRect(x, y, Math.random() * 4 + 2, Math.random() * 10 + 4);
        }
      }
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.waterfall = tex;
    return tex;
  },

  // Tạo texture vòng tròn tiến độ nạp tiền (Radial Fill 0% -> 100%)
  makeRadialProgressTexture(pct, color = '#f59e0b') {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');

    const cx = 64, cy = 64, r = 52;
    // Vòng mờ nền
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Vệt sáng khép kín theo %
    if (pct > 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + (Math.PI * 2 * Math.min(pct, 1.0));
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    return tex;
  },

  // Dải bọt sóng trắng dập dềnh ven bờ sông (Shoreline Foam)
  shoreFoam() {
    if (this.cache.shoreFoam) return this.cache.shoreFoam;
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const ctx = cv.getContext('2d');

    ctx.clearRect(0, 0, 512, 64);
    // Gradient dải bọt trắng
    const grad = ctx.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.4, 'rgba(224, 242, 254, 0.65)');
    grad.addColorStop(1, 'rgba(2, 132, 199, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 64);

    // Hạt bọt li ti
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 400; i++) {
      const bx = Math.random() * 512;
      const by = Math.random() * 28;
      ctx.beginPath();
      ctx.arc(bx, by, Math.random() * 2 + 1, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(8, 1);
    this.cache.shoreFoam = tex;
    return tex;
  },

  // Ánh sáng khúc xạ đáy nước (Water Caustics)
  caustics() {
    if (this.cache.caustics) return this.cache.caustics;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#0369a1';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = 'rgba(224, 242, 254, 0.35)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      ctx.ellipse(Math.random() * 256, Math.random() * 256, Math.random() * 40 + 20, Math.random() * 25 + 10, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 2);
    this.cache.caustics = tex;
    return tex;
  },

  // 3D Normal Map cho vỏ cây thông rãnh sâu chân thực (Sobel Gradient Vector)
  barkNormal() {
    if (this.cache.barkNormal) return this.cache.barkNormal;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 512;
    const ctx = cv.getContext('2d');
    const imgData = ctx.createImageData(256, 512);
    const data = imgData.data;

    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 256; x++) {
        const idx = (y * 256 + x) * 4;
        // Tính toán độ dốc rãnh vỏ cây theo trục X
        const groove = Math.sin(x * 0.35) * Math.cos(y * 0.05);
        const noise = (Math.random() - 0.5) * 0.25;
        const nx = (groove + noise) * 0.8;
        const ny = Math.sin(y * 0.2) * 0.15;
        const nz = 1.0;

        // Chuẩn hóa vector pháp tuyến Normal (RGB: -1..1 -> 0..255)
        const len = Math.hypot(nx, ny, nz);
        data[idx] = Math.floor(((nx / len) * 0.5 + 0.5) * 255);     // Red (X)
        data[idx + 1] = Math.floor(((ny / len) * 0.5 + 0.5) * 255); // Green (Y)
        data[idx + 2] = Math.floor(((nz / len) * 0.5 + 0.5) * 255); // Blue (Z)
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 2);
    this.cache.barkNormal = tex;
    return tex;
  },

  // Roughness Map cho vỏ cây: Gỗ sần sùi (0.9), giọt nhựa thông phản chiếu bóng (0.12)
  barkRoughness() {
    if (this.cache.barkRoughness) return this.cache.barkRoughness;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 512;
    const ctx = cv.getContext('2d');

    // Nền nhám khô
    ctx.fillStyle = '#e5e5e5'; // 90% roughness
    ctx.fillRect(0, 0, 256, 512);

    // Vài vệt nhựa thông bóng loáng (Resin droplets)
    ctx.fillStyle = '#222222'; // 12% roughness (phản chiếu bóng)
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.ellipse(Math.random() * 256, Math.random() * 512, Math.random() * 4 + 2, Math.random() * 14 + 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 2);
    this.cache.barkRoughness = tex;
    return tex;
  },

  // Mặt đất rừng tự nhiên đồng bộ
  groundWet() {
    return this.forestGround();
  },

  // Roughness Map mặt đất: Độ nhám tự nhiên đồng đều (~85% roughness)
  groundRoughness() {
    if (this.cache.groundRoughness) return this.cache.groundRoughness;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d');

    // Nền nhám 85% (#d9d9d9)
    ctx.fillStyle = '#d9d9d9';
    ctx.fillRect(0, 0, 256, 256);

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    this.cache.groundRoughness = tex;
    return tex;
  },

  // Normal Map gợn sóng nước giao thoa kép (Water Ripple Normal)
  waterNormal() {
    if (this.cache.waterNormal) return this.cache.waterNormal;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d');
    const imgData = ctx.createImageData(256, 256);
    const data = imgData.data;

    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const idx = (y * 256 + x) * 4;
        const waveX = Math.sin(x * 0.15) * Math.cos(y * 0.12) + Math.sin((x + y) * 0.08);
        const waveY = Math.cos(x * 0.12) * Math.sin(y * 0.15) + Math.cos((x - y) * 0.08);
        const nx = waveX * 0.4;
        const ny = waveY * 0.4;
        const nz = 1.0;
        const len = Math.hypot(nx, ny, nz);

        data[idx] = Math.floor(((nx / len) * 0.5 + 0.5) * 255);
        data[idx + 1] = Math.floor(((ny / len) * 0.5 + 0.5) * 255);
        data[idx + 2] = Math.floor(((nz / len) * 0.5 + 0.5) * 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    this.cache.waterNormal = tex;
    return tex;
  },

  // Bầu trời khí quyển tán xạ quang học Rayleigh (Atmospheric Sky Dome Gradient)
  skyAtmosphere() {
    if (this.cache.skyAtmosphere) return this.cache.skyAtmosphere;
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 512;
    const ctx = cv.getContext('2d');

    // Gradient từ thiên đỉnh xanh thẳm đến chân trời cam ấm
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, '#0369a1'); // Đỉnh trời xanh thẳm
    grad.addColorStop(0.45, '#38bdf8'); // Tầng trung lưu xanh biếc
    grad.addColorStop(0.75, '#bae6fd'); // Khí quyển sáng
    grad.addColorStop(0.92, '#fde68a'); // Chân trời vàng dịu
    grad.addColorStop(1.0, '#fed7aa'); // Ánh nắng phản quang chân mây

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const tex = new THREE.CanvasTexture(cv);
    this.cache.skyAtmosphere = tex;
    return tex;
  },

  // Vết bóng tiếp xúc cục bộ mềm mại (Contact Ambient Occlusion Shadow)
  contactShadow() {
    if (this.cache.contactShadow) return this.cache.contactShadow;
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');

    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
    grad.addColorStop(0.4, 'rgba(15, 23, 42, 0.45)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const tex = new THREE.CanvasTexture(cv);
    this.cache.contactShadow = tex;
    return tex;
  },

  // Kết cấu container hàng hải dập gân sóng & vách đúc (Corrugated Shipping Container)
  shippingContainer(baseColor = '#0284c7', label = 'MAERSK') {
    const key = `container_${baseColor}_${label}`;
    if (this.cache[key]) return this.cache[key];
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const ctx = cv.getContext('2d');

    // Nền thùng
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 256, 128);

    // Gân sóng dập nổi thẳng đứng
    ctx.lineWidth = 2;
    for (let x = 12; x < 244; x += 8) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x, 122); ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath(); ctx.moveTo(x + 2, 6); ctx.lineTo(x + 2, 122); ctx.stroke();
    }

    // Góc đúc thép đai viền container
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 250, 122);

    // Bảng tên thương hiệu hãng tàu
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 128, 64);

    const tex = new THREE.CanvasTexture(cv);
    this.cache[key] = tex;
    return tex;
  },

  // Vệt bọt nước rẽ sóng thân tàu (Ship Hydrodynamic Bow & Stern Wake)
  boatWake() {
    if (this.cache.boatWake) return this.cache.boatWake;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const ctx = cv.getContext('2d');

    const grad = ctx.createLinearGradient(0, 64, 256, 64);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.5, 'rgba(224, 242, 254, 0.5)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 48);
    ctx.lineTo(256, 0);
    ctx.lineTo(256, 128);
    ctx.lineTo(0, 80);
    ctx.closePath();
    ctx.fill();

    const tex = new THREE.CanvasTexture(cv);
    this.cache.boatWake = tex;
    return tex;
  },

  // Gradient độ sâu lòng sông nước ngọc bích (River Depth & Shoreline Gradient)
  riverGradient() {
    if (this.cache.riverGradient) return this.cache.riverGradient;
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 512;
    const ctx = cv.getContext('2d');

    // Chuyển sắc đối xứng: 2 bờ sông xanh ngọc lam trong vắt -> Giữa lòng sông xanh đại dương thẳm
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, '#38bdf8');  // Bờ Bắc nước nông xanh ngọc sáng
    grad.addColorStop(0.12, '#06b6d4'); // Vùng ven bờ xanh ngọc bích
    grad.addColorStop(0.35, '#0284c7'); // Chuyển tiếp độ sâu
    grad.addColorStop(0.5, '#0369a1');  // Tim luồng hàng hải xanh thẳm
    grad.addColorStop(0.65, '#0284c7');
    grad.addColorStop(0.88, '#06b6d4');
    grad.addColorStop(1.0, '#38bdf8');  // Bờ Nam nước nông ven cảng

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 512);

    // Gợn bọt vi sinh li ti ngầm dưới nước
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(Math.random() * 128, Math.random() * 512, Math.random() * 2 + 1, Math.random() * 2 + 1);
    }

    const tex = new THREE.CanvasTexture(cv);
    this.cache.riverGradient = tex;
    return tex;
  },

  // Chùm tia sáng hình nón thể tích (Volumetric Light Beam / God Rays)
  volumetricBeam() {
    if (this.cache.volumetricBeam) return this.cache.volumetricBeam;
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 512;
    const ctx = cv.getContext('2d');

    // Gradient hình nón từ đỉnh sáng rực -> đáy tản mềm
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.2, 'rgba(254, 240, 138, 0.65)');
    grad.addColorStop(0.6, 'rgba(253, 230, 138, 0.25)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 512);

    // Viền 2 bên mờ dần theo trục ngang
    const hGrad = ctx.createLinearGradient(0, 0, 128, 0);
    hGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
    hGrad.addColorStop(0.25, 'rgba(0, 0, 0, 0)');
    hGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0)');
    hGrad.addColorStop(1, 'rgba(0, 0, 0, 1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, 128, 512);
    ctx.globalCompositeOperation = 'source-over';

    const tex = new THREE.CanvasTexture(cv);
    this.cache.volumetricBeam = tex;
    return tex;
  },

  // Đốm sáng kim cương phản quang mặt trời trên sóng nước (Sun Glint Sparkle)
  sunGlint() {
    if (this.cache.sunGlint) return this.cache.sunGlint;
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const ctx = cv.getContext('2d');

    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.2, 'rgba(254, 240, 138, 0.8)');
    grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.3)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    // Tia sáng chữ thập 4 cánh
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32, 4); ctx.lineTo(32, 60);
    ctx.moveTo(4, 32); ctx.lineTo(60, 32);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(cv);
    this.cache.sunGlint = tex;
    return tex;
  },

  // Vòng sóng lan tỏa khi cá nhảy lên mặt nước hoặc giọt nước rơi (Concentric Water Ripple)
  waterRipple() {
    if (this.cache.waterRipple) return this.cache.waterRipple;
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');

    ctx.clearRect(0, 0, 128, 128);
    // Vòng sóng chính ngoài
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.stroke();

    // Vòng sóng thứ hai
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(64, 64, 34, 0, Math.PI * 2);
    ctx.stroke();

    // Vòng tâm gợn
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(64, 64, 16, 0, Math.PI * 2);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(cv);
    this.cache.waterRipple = tex;
    return tex;
  },


  // 1. Mặt đứng cao ốc kính hiện đại (Modern Skyscraper Glass Curtain Wall)
  modernSkyscraperFacade(baseTint = '#0f172a', glassTint = '#0284c7') {
    const key = `sky_facade_${baseTint}_${glassTint}`;
    if (this.cache[key]) return this.cache[key];
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 512;
    const ctx = cv.getContext('2d');

    // Nền tường và khung dầm chịu lực
    ctx.fillStyle = baseTint;
    ctx.fillRect(0, 0, 256, 512);

    const floors = 16;
    const cols = 8;
    const floorH = 512 / floors;
    const colW = 256 / cols;

    for (let f = 0; f < floors; f++) {
      const y = f * floorH;
      // Dầm phân tầng Spandrel
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, y, 256, 4);

      for (let c = 0; c < cols; c++) {
        const x = c * colW;
        // Ô cửa kính thụt sâu
        ctx.fillStyle = '#090d16'; // Bóng tối hốc cửa sổ
        ctx.fillRect(x + 2, y + 5, colW - 4, floorH - 6);

        // Kính phản quang
        const isLit = (f * 7 + c * 13) % 5 === 0;
        if (isLit) {
          // Phòng bật đèn ấm cúng
          ctx.fillStyle = (f + c) % 2 === 0 ? '#fef08a' : '#bae6fd';
          ctx.globalAlpha = 0.85;
          ctx.fillRect(x + 3, y + 6, colW - 6, floorH - 8);
          ctx.globalAlpha = 1.0;
        } else {
          // Kính phản chiếu bầu trời ban ngày
          const grad = ctx.createLinearGradient(x, y + 6, x, y + floorH);
          grad.addColorStop(0, glassTint);
          grad.addColorStop(1, '#0369a1');
          ctx.fillStyle = grad;
          ctx.fillRect(x + 3, y + 6, colW - 6, floorH - 8);
        }

        // Nan chia kính (Mullion)
        ctx.fillStyle = '#334155';
        ctx.fillRect(x + Math.floor(colW / 2), y + 6, 1, floorH - 8);
      }
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache[key] = tex;
    return tex;
  },

  // 2. Bề mặt sỏi chống thấm tầng thượng công nghiệp (Industrial Rooftop Gravel & Bitumen)
  rooftopGravel() {
    if (this.cache.rooftopGravel) return this.cache.rooftopGravel;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d');

    // Lớp bitum xám đen
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 256, 256);

    // Đường ghép nối màng chống thấm
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    for (let x = 0; x <= 256; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
    }
    for (let y = 0; y <= 256; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }

    // Hạt sỏi rải mặt chống nóng
    for (let i = 0; i < 600; i++) {
      const gx = Math.random() * 256;
      const gy = Math.random() * 256;
      const gray = Math.floor(60 + Math.random() * 60);
      ctx.fillStyle = `rgb(${gray},${gray},${gray + 5})`;
      ctx.fillRect(gx, gy, 2, 2);
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.rooftopGravel = tex;
    return tex;
  },

  // 3. Tấm pin quang điện năng lượng mặt trời (Photovoltaic Solar Panel)
  solarPanel() {
    if (this.cache.solarPanel) return this.cache.solarPanel;
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');

    // Khung nhôm anode
    ctx.fillStyle = '#64748b';
    ctx.fillRect(0, 0, 128, 128);

    // Tế bào quang điện silic xanh thẫm
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(4, 4, 120, 120);

    // Lưới bạc dẫn điện (Busbars)
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 1;
    for (let x = 16; x < 120; x += 16) {
      ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, 124); ctx.stroke();
    }
    for (let y = 16; y < 120; y += 16) {
      ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(124, y); ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(cv);
    this.cache.solarPanel = tex;
    return tex;
  },

  // 4. Quạt thông gió & Lưới tản nhiệt điều hòa công nghiệp (HVAC Fan & Louvers)
  hvacVent() {
    if (this.cache.hvacVent) return this.cache.hvacVent;
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 128, 128);

    // Nan chớp gió tản nhiệt
    ctx.fillStyle = '#0f172a';
    for (let y = 8; y < 120; y += 8) {
      ctx.fillRect(8, y, 112, 4);
    }

    // Lồng quạt tròn ở giữa
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(64, 64, 48, 0, Math.PI * 2);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(cv);
    this.cache.hvacVent = tex;
    return tex;
  },

  // 5. Cụm bụi cỏ tự nhiên 3D (Natural 3D Grass Tufts Texture)
  grassTuft() {
    if (this.cache.grassTuft) return this.cache.grassTuft;
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');

    // Trong suốt hoàn toàn
    ctx.clearRect(0, 0, 128, 128);

    // Vẽ từng nhánh cỏ vươn lên
    const blades = [
      { bx: 64, by: 128, tx: 35, ty: 15, w: 7, col: '#16a34a' },
      { bx: 64, by: 128, tx: 50, ty: 8, w: 8, col: '#22c55e' },
      { bx: 64, by: 128, tx: 64, ty: 5, w: 9, col: '#4ade80' },
      { bx: 64, by: 128, tx: 80, ty: 10, w: 8, col: '#22c55e' },
      { bx: 64, by: 128, tx: 95, ty: 22, w: 7, col: '#15803d' },
      { bx: 64, by: 128, tx: 20, ty: 38, w: 6, col: '#15803d' },
      { bx: 64, by: 128, tx: 108, ty: 35, w: 6, col: '#16a34a' }
    ];

    blades.forEach(b => {
      ctx.fillStyle = b.col;
      ctx.beginPath();
      ctx.moveTo(b.bx - b.w / 2, b.by);
      ctx.quadraticCurveTo(b.bx, (b.by + b.ty) / 2, b.tx, b.ty);
      ctx.quadraticCurveTo(b.bx + 2, (b.by + b.ty) / 2, b.bx + b.w / 2, b.by);
      ctx.closePath();
      ctx.fill();
    });

    const tex = new THREE.CanvasTexture(cv);
    this.cache.grassTuft = tex;
    return tex;
  },

  // Biển hiệu đèn Neon cửa hàng tầng trệt (Neon Retail Storefront Signage)
  neonShopSign(type = 'mart') {
    const key = `neon_sign_${type}`;
    if (this.cache[key]) return this.cache[key];
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const ctx = cv.getContext('2d');

    // Nền bảng hiệu đen viền kim loại
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 60);

    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (type === 'mart') {
      ctx.shadowColor = '#22c55e'; ctx.shadowBlur = 10;
      ctx.fillStyle = '#4ade80';
      ctx.fillText('🟢 24/7 MINI MART', 128, 32);
    } else if (type === 'cafe') {
      ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 10;
      ctx.fillStyle = '#fde047';
      ctx.fillText('☕ STAR COFFEE', 128, 32);
    } else if (type === 'pharmacy') {
      ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 10;
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('➕ PHARMACY 24H', 128, 32);
    } else {
      ctx.shadowColor = '#f43f5e'; ctx.shadowBlur = 10;
      ctx.fillStyle = '#fb7185';
      ctx.fillText('🏦 TYCOON BANK ATM', 128, 32);
    }

    const tex = new THREE.CanvasTexture(cv);
    this.cache[key] = tex;
    return tex;
  },

  // Vạch kẻ đường đi bộ Zebra Crosswalk (Thermoplastic White Stripes)
  zebraCrosswalk() {
    if (this.cache.zebraCrosswalk) return this.cache.zebraCrosswalk;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 256, 128);

    ctx.fillStyle = '#f8fafc';
    for (let x = 16; x < 256; x += 32) {
      ctx.fillRect(x, 10, 20, 108);
    }

    const tex = new THREE.CanvasTexture(cv);
    this.cache.zebraCrosswalk = tex;
    return tex;
  },

    // Nấm đỏ chấm trắng hoạt hình mọc dưới gốc thông (Stylized Toadstool Mushroom)
  mushroomCap() {
    if (this.cache.mushroomCap) return this.cache.mushroomCap;
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');

    // Nền đỏ thắm tươi tắn
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, 128, 128);

    // Chấm bi trắng hoạt hình tròn xoe
    ctx.fillStyle = '#ffffff';
    const dots = [
      [32, 32, 10], [96, 32, 8], [64, 64, 12],
      [24, 96, 9], [104, 96, 11], [64, 20, 7], [64, 108, 8]
    ];
    dots.forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    const tex = new THREE.CanvasTexture(cv);
    this.cache.mushroomCap = tex;
    return tex;
  },

  // Bóng đổ tiếp xúc chân thực người chơi & NPC (Blob Contact Shadow Decal)
  blobShadow() {
    if (this.cache.blobShadow) return this.cache.blobShadow;
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 62);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.65)');
    grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.35)');
    grad.addColorStop(0.85, 'rgba(15, 23, 42, 0.1)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const tex = new THREE.CanvasTexture(cv);
    this.cache.blobShadow = tex;
    return tex;
  },

  // Vệt mũi tên dẫn hướng 3D AR bám sát mặt đất (3D AR Waypoint Chevron)
  chevronWaypoint() {
    if (this.cache.chevronWaypoint) return this.cache.chevronWaypoint;
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 128, 256);

    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#0284c7';
    ctx.shadowBlur = 12;

    for (let y = 30; y < 240; y += 80) {
      ctx.beginPath();
      ctx.moveTo(64, y);
      ctx.lineTo(112, y + 50);
      ctx.lineTo(96, y + 60);
      ctx.lineTo(64, y + 25);
      ctx.lineTo(32, y + 60);
      ctx.lineTo(16, y + 50);
      ctx.closePath();
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.chevronWaypoint = tex;
    return tex;
  },

  // Lớp tuyết mùa đông phủ mái nhà (Winter Snow Cap Texture)
  snowRooftop() {
    if (this.cache.snowRooftop) return this.cache.snowRooftop;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 256, 256);

    // Bụi tuyết lấp lánh xanh băng nhẹ
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#e2e8f0' : '#f1f5f9';
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }

    const tex = new THREE.CanvasTexture(cv);
    this.cache.snowRooftop = tex;
    return tex;
  },

  // Hòm tiếp tế Airdrop quân sự (Military Supply Crate)
  airdropCrate() {
    if (this.cache.airdropCrate) return this.cache.airdropCrate;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, 0, 256, 256);

    // Viền khung thép gia cố
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, 242, 242);

    // Ký hiệu cảnh báo chéo vàng đen
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AIRDROP', 128, 140);

    const tex = new THREE.CanvasTexture(cv);
    this.cache.airdropCrate = tex;
    return tex;
  },

  // =========================================================================
  // GIAI ĐOẠN 1: TEXTURE PBR & HIỆU ỨNG THỊ GIÁC CAO CẤP (MỤC 1 - 60)
  // =========================================================================

  // Hoa văn khúc xạ ánh sáng đáy nước Water Caustics (Mục 1)
  waterCaustics() {
    if (this.cache.waterCaustics) return this.cache.waterCaustics;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Vẽ mạng lưới gợn sóng khúc xạ Voronoi giả lập
    for (let i = 0; i < 32; i++) {
      ctx.beginPath();
      const x0 = (i * 37) % 256;
      const y0 = (i * 61) % 256;
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(
        (x0 + 40) % 256, (y0 + 20) % 256,
        (x0 - 20) % 256, (y0 + 70) % 256,
        (x0 + 50) % 256, (y0 + 80) % 256
      );
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    this.cache.waterCaustics = tex;
    return tex;
  },

  // Texture đám mây thể tích mềm mại Volumetric Cloud (Mục 3)
  volumetricCloud() {
    if (this.cache.volumetricCloud) return this.cache.volumetricCloud;
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');

    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.88)');
    grad.addColorStop(0.4, 'rgba(241, 245, 249, 0.65)');
    grad.addColorStop(0.8, 'rgba(226, 232, 240, 0.22)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const tex = new THREE.CanvasTexture(cv);
    this.cache.volumetricCloud = tex;
    return tex;
  },

  // Decal vệt lốp xe hằn trên đường bùn Mud Track Decals (Mục 9)
  mudTrack() {
    if (this.cache.mudTrack) return this.cache.mudTrack;
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 256;
    const ctx = cv.getContext('2d');

    ctx.clearRect(0, 0, 128, 256);
    ctx.fillStyle = 'rgba(67, 40, 24, 0.72)'; // Màu bùn đất nâu ẩm

    // 2 vệt rãnh bánh xe song song
    [24, 88].forEach(vx => {
      for (let y = 0; y < 256; y += 14) {
        ctx.fillRect(vx - 8, y, 16, 8);
      }
    });

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.mudTrack = tex;
    return tex;
  },

  // Bảng đèn LED ma trận uốn cong tòa tháp Tài Chính (Mục 20)
  ledCurveStock() {
    if (this.cache.ledCurveStock) return this.cache.ledCurveStock;
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, 512, 64);

    // Kẻ lưới LED chấm điểm
    ctx.fillStyle = '#00ff66';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('▲ WOOD +8.4%   ▲ PORT +4.2%   ▼ OIL -1.8%   ▲ GOLD +12.5%', 16, 40);

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    this.cache.ledCurveStock = tex;
    return tex;
  }
};
if (typeof window !== 'undefined') {
  window.Textures = Textures;
}
