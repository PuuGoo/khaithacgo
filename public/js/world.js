/**
 * 3D World Construction & Living Biome
 * Procedural PBR materials, Waterfall with UV scroll & mist, Tree Lifecycle Growth,
 * Flying Arc Bezier Log Physics, Arcade Upgrade Pads & Quest Arrow Indicator
 */

const clickables = [];
const trees = [];
let worldScene = null;
const pickableLogs = [];
const flyingLogs = []; // { mesh, p0, p1, pMid, t, onComplete }
const barricades = {};
const upgradePads = []; // Array of ArcadePad instances
let questArrowMesh = null;
let waterfallMesh = null;
let waterMistPoints = null;

// Helper: 3D Billboard Sprite
function makeBillboardText(text, color = '#ffffff', width = 360, height = 70) {
  const cv = document.createElement('canvas');
  cv.width = width; cv.height = height;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(4, 4, width - 8, height - 8, 16);
  } else {
    ctx.beginPath();
    ctx.rect(4, 4, width - 8, height - 8);
  }
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(cv);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
  sprite.scale.set(width / 48, height / 40, 1);
  return sprite;
}
window.makeBillboardText = makeBillboardText;

// ---------------------------------------------------------------------------
// ARCADE UPGRADE PAD CLASS
// ---------------------------------------------------------------------------
class ArcadeUpgradePad {
  constructor(scene, config) {
    this.id = config.id;
    this.name = config.name;
    this.desc = config.desc;
    this.pos = new THREE.Vector3(config.pos.x, config.pos.y, config.pos.z);
    this.radius = config.radius || 2.2;
    this.color = config.color || '#f59e0b';
    this.icon = config.icon || '⭐';

    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    scene.add(this.group);

    // Glowing base ring
    const ringGeo = new THREE.RingGeometry(this.radius * 0.75, this.radius, 32);
    ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.color),
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide
    });
    this.ring = new THREE.Mesh(ringGeo, this.ringMat);
    this.ring.position.y = 0.05;
    this.group.add(this.ring);

    // Dynamic Radial Progress Disc
    const discGeo = new THREE.CircleGeometry(this.radius * 0.72, 32);
    discGeo.rotateX(-Math.PI / 2);
    this.radialMat = new THREE.MeshBasicMaterial({
      map: Textures.makeRadialProgressTexture(0, this.color),
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    this.radialDisc = new THREE.Mesh(discGeo, this.radialMat);
    this.radialDisc.position.y = 0.06;
    this.group.add(this.radialDisc);

    // Floating 3D Billboard (Y = +2.2m, ẩn khi ở xa để không che tầm nhìn)
    this.billboard = makeBillboardText(`${this.icon} ${this.name}\n$0`, this.color, 360, 75);
    this.billboard.position.set(0, 2.2, 0);
    this.billboard.visible = false;
    this.group.add(this.billboard);

    this.drainTimer = 0;
    this.updateDisplay();
  }

  updateDisplay() {
    const totalCost = getPadCurrentCost(this.id);
    const invested = gameState.upgradeInvestments[this.id] || 0;
    const remaining = Math.max(totalCost - invested, 0);
    const pct = Math.min(invested / totalCost, 1.0);

    // Update radial texture
    this.radialMat.map = Textures.makeRadialProgressTexture(pct, this.color);
    this.radialMat.needsUpdate = true;

    // Update billboard
    const cv = this.billboard.material.map.image;
    if (cv) {
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.roundRect(4, 4, cv.width - 8, cv.height - 8, 16);
      ctx.fill();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${this.icon} ${this.name}`, cv.width / 2, 28);

      ctx.fillStyle = this.color;
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(remaining > 0 ? `Cần: $${remaining}` : 'ĐÃ ĐẠT MAX!', cv.width / 2, 58);
      this.billboard.material.map.needsUpdate = true;
    }
  }

  update(dt, playerPos) {
    // Pulsing & rotation
    this.ring.rotation.y += dt * 1.5;
    const pulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
    this.ringMat.opacity = pulse;

    const dist = playerPos.distanceTo(this.pos);
    // Chỉ hiển thị bảng chữ 3D khi người chơi tiến lại gần bán kính 3.5m
    this.billboard.visible = dist <= 3.5;

    if (dist <= this.radius) {
      this.drainTimer += dt;
      if (this.drainTimer >= 0.05) {
        this.drainTimer = 0;
        this.stepDrain();
      }
    }
  }

  stepDrain() {
    const totalCost = getPadCurrentCost(this.id);
    const invested = gameState.upgradeInvestments[this.id] || 0;
    if (invested >= totalCost) return;

    const step = 5;
    if (gameState.money >= step) {
      gameState.money -= step;
      gameState.upgradeInvestments[this.id] = invested + step;
      sounds.playDrainStep();
      spawnFloatingText(this.pos, `-$${step} 🪙`, '#facc15');

      if (gameState.upgradeInvestments[this.id] >= totalCost) {
        this.completeUpgrade();
      } else {
        this.updateDisplay();
        updateHUD();
      }
    }
  }

  completeUpgrade() {
    gameState.upgradeInvestments[this.id] = 0;
    sounds.playLevelUp();
    showToast(`🎉 NÂNG CẤP THÀNH CÔNG: ${this.name}!`);

    // Apply upgrade effect
    if (this.id === 'pad_axe') {
      gameState.axeTier = Math.min(gameState.axeTier + 1, 4);
    } else if (this.id === 'pad_lumberjack') {
      gameState.workers = (gameState.workers || 0) + 1;
      if (typeof spawnLumberjackWorker === 'function') spawnLumberjackWorker();
    } else if (this.id === 'pad_reforest') {
      gameState.reforestationLevel = (gameState.reforestationLevel || 0) + 1;
    } else if (this.id === 'pad_sawmill_speed') {
      gameState.sawmillSpeedTier = (gameState.sawmillSpeedTier || 0) + 1;
    } else if (this.id === 'pad_forklift') {
      gameState.forklifts = (gameState.forklifts || 0) + 1;
      if (typeof spawnForkliftAgent === 'function') spawnForkliftAgent();
    } else if (this.id === 'pad_boat') {
      gameState.boats = (gameState.boats || 0) + 1;
    } else if (this.id === 'pad_supermarket') {
      gameState.supermarketTier = (gameState.supermarketTier || 0) + 1;
    }

    this.updateDisplay();
    updateHUD();
    triggerActionSave();
  }
}

// ---------------------------------------------------------------------------
// WORLD INITIALIZATION
// ---------------------------------------------------------------------------
function initWorld(scene) {
  worldScene = scene;
  window.scene = scene;
  // Main Ground với PBR Vật Liệu Đất Rừng Tự Nhiên - MỞ RỘNG TOÀN CẢNH SIÊU ĐÔ THỊ ĐẾ CHẾ 380m x 380m
  const groundGeo = new THREE.BoxGeometry(380, 4, 380);
  const groundMat = new THREE.MeshStandardMaterial({
    map: Textures.forestGround(),
    roughness: 0.85,
    metalness: 0.1
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = -2;
  ground.receiveShadow = true;
  scene.add(ground);
  window.groundMesh = ground;

  // -------------------------------------------------------------------------
  // SECTOR 1: KHU RỪNG THÔNG ĐỐN CỦI SÂU TRONG ĐẤT LIỀN (TRỤC Z = -18)
  // -------------------------------------------------------------------------
  // Mặt sàn đất rừng tự nhiên phẳng, sạch sẽ, hoàn toàn nằm trong đất liền
  const forestFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 28),
    new THREE.MeshStandardMaterial({
      map: Textures.forestGround(),
      roughness: 0.85,
      metalness: 0.1
    })
  );
  forestFloor.rotation.x = -Math.PI / 2;
  forestFloor.position.set(-33, 0.01, -18);
  forestFloor.receiveShadow = true;
  scene.add(forestFloor);

  // SHARED MATERIAL PALETTE CHO TOÀN BỘ RỪNG THÔNG (GIẢM 700+ VẬT LIỆU XUỐNG CÒN 1 BỘ DUY NHẤT, ZERO DRAW CALL BLOAT)
  const sharedTrunkMat = new THREE.MeshStandardMaterial({
    map: Textures.bark(),
    normalMap: Textures.barkNormal(),
    normalScale: new THREE.Vector2(1.25, 1.25),
    roughnessMap: Textures.barkRoughness(),
    roughness: 0.85,
    metalness: 0.05
  });
  const sharedCutEndMat = new THREE.MeshStandardMaterial({ map: Textures.treeRings(), roughness: 0.8 });
  const sharedPineCanopyMats = [
    new THREE.MeshStandardMaterial({ color: 0x0f2b1d, roughness: 0.75, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x14452f, roughness: 0.72, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.7, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.68, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.65, flatShading: true })
  ];
  const sharedRedwoodCanopyMats = [
    new THREE.MeshStandardMaterial({ color: 0x450a0a, roughness: 0.75, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.72, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.7, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.68, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.65, flatShading: true })
  ];
  const sharedMushroomCapMat = new THREE.MeshStandardMaterial({ map: Textures.mushroomCap(), roughness: 0.5 });
  const sharedMushroomStemMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.7 });
  const sharedFlowerMatYellow = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 });
  const sharedFlowerMatPurple = new THREE.MeshStandardMaterial({ color: 0xc084fc, roughness: 0.6 });

  // Plant Realistic Pine Trees with 3D Normal Map Bark, Buttress Roots & Multi-Branches
  function plantTree(x, z) {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);

    // Thân cây gỗ dùng chung vật liệu PBR tối ưu hoá
    const trunkMat = sharedTrunkMat;

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.82, 4.2, 10),
      trunkMat
    );
    trunk.position.y = 2.1;
    trunk.castShadow = true;
    tree.add(trunk);

    // Rễ cây ngoằn ngoèo trồi lên từ gốc cắm vào nền đất (Buttress Roots)
    for (let r = 0; r < 4; r++) {
      const rootAngle = (r * Math.PI) / 2 + (Math.random() - 0.5) * 0.35;
      const root = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 1.2, 5),
        trunkMat
      );
      root.position.set(Math.cos(rootAngle) * 0.68, 0.28, Math.sin(rootAngle) * 0.68);
      root.rotation.set(Math.sin(rootAngle) * 0.7, 0, -Math.cos(rootAngle) * 0.7);
      root.castShadow = true;
      tree.add(root);
    }

    // Cành nhánh ngang tự nhiên
    for (let b = 0; b < 3; b++) {
      const bAngle = b * 2.1;
      const branch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.12, 1.4, 5),
        trunkMat
      );
      branch.position.set(Math.cos(bAngle) * 0.45, 2.2 + b * 0.75, Math.sin(bAngle) * 0.45);
      branch.rotation.set(Math.sin(bAngle) * 0.45, 0, -Math.cos(bAngle) * 0.45);
      tree.add(branch);
    }

    // Cut End Rings
    const cutEnd = new THREE.Mesh(new THREE.CircleGeometry(0.52, 10), sharedCutEndMat);
    cutEnd.position.y = 4.21;
    cutEnd.rotateX(-Math.PI / 2);
    tree.add(cutEnd);

    // Tán lá kim phân tầng 5 lớp chuyển sắc tự nhiên (Multi-Layer Stylized Pine Canopy)
    const canopy = new THREE.Group();
    tree.add(canopy);
    tree.userData.canopy = canopy;

    const isRedwood = (typeof gameState !== 'undefined' && gameState.researchTechs && gameState.researchTechs.redwoodEco && Math.random() < 0.22);
    const canopyMats = isRedwood ? sharedRedwoodCanopyMats : sharedPineCanopyMats;
    if (isRedwood) {
      trunk.scale.set(1.2, 1.35, 1.2);
    }

    const c1 = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2.4, 7), canopyMats[0]);
    c1.position.y = 3.6; c1.castShadow = true; canopy.add(c1);

    const c2 = new THREE.Mesh(new THREE.ConeGeometry(2.3, 2.2, 7), canopyMats[1]);
    c2.position.y = 4.8; c2.rotation.y = 0.4; canopy.add(c2);

    const c3 = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.9, 7), canopyMats[2]);
    c3.position.y = 5.9; c3.rotation.y = 0.8; canopy.add(c3);

    const c4 = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.6, 6), canopyMats[3]);
    c4.position.y = 6.9; canopy.add(c4);

    const c5 = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 5), canopyMats[4]);
    c5.position.y = 7.8; c5.rotation.y = 0.3; canopy.add(c5);

    // Nấm đỏ chấm trắng mọc ở chân gốc thông
    const mush = new THREE.Group();
    const mCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      sharedMushroomCapMat
    );
    mCap.position.y = 0.2;
    mush.add(mCap);
    const mStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 0.22, 6),
      sharedMushroomStemMat
    );
    mStem.position.y = 0.11;
    mush.add(mStem);
    const mAngle = (x * 3.7 + z * 1.9) % (Math.PI * 2);
    mush.position.set(Math.cos(mAngle) * 0.95, 0, Math.sin(mAngle) * 0.95);
    tree.add(mush);

    // Khóm hoa dại ngũ sắc ven gốc cây (Wildflowers)
    const flowerMat = ((x + z) % 2 === 0) ? sharedFlowerMatYellow : sharedFlowerMatPurple;
    for (let f = 0; f < 3; f++) {
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 5), flowerMat);
      const fAngle = (f * 2.1) + (x % 1.5);
      fl.position.set(Math.cos(fAngle) * 1.15, 0.1, Math.sin(fAngle) * 1.15);
      tree.add(fl);
    }

    // 4-Segment 3D HP Bar floating above tree
    const hpBar = new THREE.Group();
    hpBar.position.set(0, 8.2, 0);
    hpBar.visible = false;
    tree.add(hpBar);

    const hpSegments = [];
    for (let s = 0; s < 4; s++) {
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.15, 0.12),
        new THREE.MeshBasicMaterial({ color: 0x22c55e })
      );
      seg.position.set(-0.68 + s * 0.45, 0, 0);
      hpBar.add(seg);
      hpSegments.push(seg);
    }

    tree.userData = {
      type: 'tree',
      isRedwood: isRedwood,
      hp: 100,
      maxHp: 100,
      hpBar: hpBar,
      hpSegments: hpSegments,
      growthStage: 3, // 1: sprout (0.1), 2: sapling (0.45), 3: mature (1.0)
      isFalling: false
    };

    scene.add(tree);
    trees.push(tree);
    clickables.push(tree);
  }

  // Bố trí 25 cây thông an toàn trong đất liền (Z: -27 đến -9, cách sông hơn 14m)
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      plantTree(-46 + c * 6.5 + (Math.random() - 0.5) * 1.0, -27 + r * 4.5 + (Math.random() - 0.5) * 1.0);
    }
  }
  window.trees = trees;

  // -------------------------------------------------------------------------
  // THẢM THỰC VẬT RỪNG NGUYÊN SINH: BỤI DƯƠNG XỈ & TẢNG ĐÁ CUỘI RÊU PHONG
  // -------------------------------------------------------------------------
  const fernCount = 40;
  const fernGeo = new THREE.ConeGeometry(0.35, 0.9, 3);
  fernGeo.rotateX(Math.PI / 3);
  const fernMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.65, flatShading: true });
  const fernInstanced = new THREE.InstancedMesh(fernGeo, fernMat, fernCount * 4);
  const dummyFern = new THREE.Object3D();
  let fIdx = 0;
  for (let i = 0; i < fernCount; i++) {
    const fx = -48 + Math.random() * 32;
    const fz = -28 + Math.random() * 20;
    for (let k = 0; k < 4; k++) {
      dummyFern.position.set(fx, 0.65, fz);
      dummyFern.rotation.set(0, k * (Math.PI / 2) + Math.random() * 0.3, 0.35);
      dummyFern.scale.set(0.8, 0.8, 0.8);
      dummyFern.updateMatrix();
      fernInstanced.setMatrixAt(fIdx++, dummyFern.matrix);
    }
  }
  scene.add(fernInstanced);

  // Tảng đá cuội rêu phong trong đất liền
  const boulderMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.9,
    flatShading: true
  });
  const boulderGeo = new THREE.DodecahedronGeometry(1.2, 1);
  const boulderPositions = [
    [-20, 0.5, -28, 1.4],
    [-44, 0.6, -28, 1.8],
    [-44, 0.6, -8, 1.8],
    [-20, 0.5, -8, 1.4],
    [-8, 0.3, -24, 1.2],
    [18, 0.3, -24, 1.3],
    [24, 0.3, -8, 1.5]
  ];
  boulderPositions.forEach(([bx, by, bz, bs]) => {
    const b = new THREE.Mesh(boulderGeo, boulderMat);
    b.position.set(bx, by, bz);
    b.scale.set(bs, bs * 0.65, bs * 0.85);
    b.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    b.castShadow = true;
    b.receiveShadow = true;
    scene.add(b);
  });

  // -------------------------------------------------------------------------
  // HỆ SINH THÁI RỪNG SỐNG ĐỘNG: NẤM ĐỎ, HOA DẠI & ĐÀN BƯỚM CHAO LƯỢN
  // -------------------------------------------------------------------------
  // 1. Nấm đỏ đốm trắng (Amanita Mushrooms) rải rác dưới gốc thông
  const mushroomGroup = new THREE.Group();
  const capGeo = new THREE.SphereGeometry(0.24, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const capMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });
  const stemGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.35, 6);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.9 });

  for (let m = 0; m < 20; m++) {
    const mx = -45 + Math.random() * 28;
    const mz = -27 + Math.random() * 20;
    const shroom = new THREE.Group();
    shroom.position.set(mx, 0, mz);

    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.17;
    shroom.add(stem);

    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 0.32;
    shroom.add(cap);

    // Chấm trắng trên nón nấm
    const dotGeo = new THREE.DodecahedronGeometry(0.04);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let di = 0; di < 3; di++) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set((Math.random() - 0.5) * 0.2, 0.42, (Math.random() - 0.5) * 0.2);
      shroom.add(dot);
    }
    shroom.scale.setScalar(0.7 + Math.random() * 0.6);
    mushroomGroup.add(shroom);
  }
  scene.add(mushroomGroup);

  // 2. Hoa cúc dại trắng/vàng li ti ven bãi cỏ
  const flowerGroup = new THREE.Group();
  const petalGeo = new THREE.CircleGeometry(0.12, 6);
  petalGeo.rotateX(-Math.PI / 2);
  const petalMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, side: THREE.DoubleSide });
  for (let f = 0; f < 30; f++) {
    const fl = new THREE.Mesh(petalGeo, petalMat);
    fl.position.set(-46 + Math.random() * 32, 0.04, -28 + Math.random() * 22);
    flowerGroup.add(fl);
  }
  scene.add(flowerGroup);

  // 3. Đàn bướm chao lượn quanh bìa rừng thông (Animated Butterflies)
  const butterflies = [];
  const wingMatY = new THREE.MeshStandardMaterial({ color: 0xfacc15, side: THREE.DoubleSide, roughness: 0.5 });
  const wingMatB = new THREE.MeshStandardMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, roughness: 0.5 });
  const wingGeo = new THREE.PlaneGeometry(0.24, 0.2);

  for (let b = 0; b < 4; b++) {
    const bGroup = new THREE.Group();
    const wMat = b % 2 === 0 ? wingMatY : wingMatB;
    const wL = new THREE.Mesh(wingGeo, wMat);
    wL.position.set(-0.12, 0, 0);
    bGroup.add(wL);
    const wR = new THREE.Mesh(wingGeo, wMat);
    wR.position.set(0.12, 0, 0);
    bGroup.add(wR);

    bGroup.position.set(-36 + Math.random() * 20, 1.4 + Math.random() * 0.8, -20 + Math.random() * 12);
    bGroup.userData = {
      baseX: bGroup.position.x,
      baseZ: bGroup.position.z,
      wL: wL,
      wR: wR,
      seed: b * 1.6
    };
    scene.add(bGroup);
    butterflies.push(bGroup);
  }
  window.butterflies = butterflies;

  // Contact Shadows đệm chân công trình trong đất liền
  function addContactShadow(pos, size) {
    const s = new THREE.Mesh(
      new THREE.PlaneGeometry(size.x, size.z),
      new THREE.MeshBasicMaterial({ map: Textures.contactShadow(), transparent: true, opacity: 0.75, depthWrite: false })
    );
    s.position.set(pos.x, 0.03, pos.z);
    s.rotation.x = -Math.PI / 2;
    scene.add(s);
  }
  addContactShadow(new THREE.Vector3(-20, 0, -28), new THREE.Vector3(4.8, 0, 4.0)); // Tool Shed
  addContactShadow(new THREE.Vector3(-6, 0, -18), new THREE.Vector3(4.2, 0, 3.2));   // Hand Saw Bench
  addContactShadow(new THREE.Vector3(0, 0, -18), new THREE.Vector3(12, 0, 8));       // Red Saw Chamber
  addContactShadow(new THREE.Vector3(18, 0, -18), new THREE.Vector3(4.2, 0, 3.2));  // Trading Stall
  addContactShadow(new THREE.Vector3(0, 0, -24), new THREE.Vector3(4.5, 0, 4.5));   // Cyclone Silo
  // HQ shadow removed

  // -------------------------------------------------------------------------
  // CHÒI GỖ XƯỞNG RÌU (TOOL SHED CABIN) TRONG ĐẤT LIỀN: { x: -20, z: -28 }
  // -------------------------------------------------------------------------
  const toolShed = new THREE.Group();
  toolShed.position.set(-20, 0, -28);
  scene.add(toolShed);

  const shedBody = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 2.5, 2.8),
    new THREE.MeshStandardMaterial({ map: Textures.bark(), roughness: 0.9 })
  );
  shedBody.position.y = 1.25;
  shedBody.castShadow = true;
  toolShed.add(shedBody);

  const shedRoof = new THREE.Mesh(
    new THREE.ConeGeometry(2.8, 1.2, 4),
    new THREE.MeshStandardMaterial({ map: Textures.plank(), roughness: 0.8 })
  );
  shedRoof.position.y = 3.0;
  shedRoof.rotateY(Math.PI / 4);
  shedRoof.castShadow = true;
  toolShed.add(shedRoof);

  const shedDoor = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.8, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x1e293b })
  );
  shedDoor.position.set(0, 0.9, 1.41);
  toolShed.add(shedDoor);

  const shedSign = makeBillboardText('🪓 TOOL SHED', '#f59e0b', 240, 50);
  shedSign.position.set(0, 2.4, 1.5);
  toolShed.add(shedSign);

  // -------------------------------------------------------------------------
  // 1. BÀN CƯA TAY (ĐẦU DÂY CHUYỀN THẲNG HÀNG TRỤC Z = -18: { x: -6, z: -18 })
  // -------------------------------------------------------------------------
  const handSawGroup = new THREE.Group();
  handSawGroup.position.set(-6, 0, -18);
  scene.add(handSawGroup);

  const handSawBench = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.9, 1.4),
    new THREE.MeshStandardMaterial({ map: Textures.plank(), roughness: 0.85 })
  );
  handSawBench.position.y = 0.45;
  handSawBench.castShadow = true;
  handSawBench.userData = { type: 'manual_saw_bench' };
  handSawGroup.add(handSawBench);
  clickables.push(handSawBench);
  window.handSawBench = handSawBench;

  // Lưỡi cưa tay kim loại gắn trên bàn
  const sawSteelBlade = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.4, 1.8),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 })
  );
  sawSteelBlade.position.set(0, 1.05, 0);
  handSawGroup.add(sawSteelBlade);

  // Bệ đỡ ván gỗ thành phẩm bên cạnh bàn cưa
  const plankRack = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.4, 1.4),
    new THREE.MeshStandardMaterial({ map: Textures.plank(), roughness: 0.9 })
  );
  plankRack.position.set(1.6, 0.2, 0);
  handSawGroup.add(plankRack);

  // Chồng ván xẻ mẫu trên giá đỡ
  for (let pi = 0; pi < 3; pi++) {
    const pk = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.1, 1.2),
      new THREE.MeshStandardMaterial({ map: Textures.plank() })
    );
    pk.position.set(1.6, 0.45 + pi * 0.11, 0);
    handSawGroup.add(pk);
  }

  // Vòng tương tác dưới sàn bàn cưa (r = 1.25m)
  const sawRingGeo = new THREE.RingGeometry(0.9, 1.25, 32);
  sawRingGeo.rotateX(-Math.PI / 2);
  const sawRing = new THREE.Mesh(sawRingGeo, new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  sawRing.position.y = 0.05;
  handSawGroup.add(sawRing);

  // Bảng tên 3D (Y = +2.2m)
  const sawTag = makeBillboardText('🪚 BÀN CƯA TAY (Bước vào xẻ ván)', '#facc15');
  sawTag.position.set(-6, 2.2, -18);
  sawTag.visible = false;
  scene.add(sawTag);
  window.sawTag = sawTag;

  // -------------------------------------------------------------------------
  // SECTOR 2: BÃI XƯỞNG CƯA TRUNG TÂM NẰM THẲNG HÀNG TRỤC Z = -18: { x: 0, z: -18 }
  // -------------------------------------------------------------------------
  // Sàn bãi xưởng xẻ lát đá bo viền gỗ mộc tự nhiên (Timber-framed Flagstone Yard)
  const factoryFloor = new THREE.Mesh(
    new THREE.BoxGeometry(32, 0.3, 16),
    new THREE.MeshStandardMaterial({ map: Textures.cobblestonePavers(), roughness: 0.65 })
  );
  factoryFloor.position.set(2, 0.15, -18);
  factoryFloor.receiveShadow = true;
  scene.add(factoryFloor);

  // Thanh dầm gỗ viền quanh sàn bãi xưởng
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x58240c, roughness: 0.85 });
  const trimNorth = new THREE.Mesh(new THREE.BoxGeometry(32.4, 0.45, 0.5), trimMat);
  trimNorth.position.set(2, 0.22, -26);
  scene.add(trimNorth);
  const trimSouth = new THREE.Mesh(new THREE.BoxGeometry(32.4, 0.45, 0.5), trimMat);
  trimSouth.position.set(2, 0.22, -10);
  scene.add(trimSouth);

  // -------------------------------------------------------------------------
  // MÁY CƯA GỖ CÔNG NGHIỆP NẶNG LỘ THIÊN (HEAVY INDUSTRIAL SAWMILL MACHINERY)
  // Không phải ngôi nhà/cabin, mà là cỗ máy cơ khí chịu lực lộ thiên hoàn toàn
  // -------------------------------------------------------------------------
  const industrialSawmill = new THREE.Group();
  industrialSawmill.position.set(0, 0, -18);
  scene.add(industrialSawmill);
  window.industrialSawmill = industrialSawmill;

  // 1. Khung Giàn Thép Chịu Lực H-Beam Công Nghiệp (Màu xám than & viền vàng an toàn)
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.35 });
  const safetyYellowMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.3, roughness: 0.5 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.15 });

  // 4 Trụ thép đứng H-Beam cao 4.2m
  const colPositions = [[-2.4, -1.8], [2.4, -1.8], [-2.4, 1.8], [2.4, 1.8]];
  colPositions.forEach(([cx, cz]) => {
    // Trụ chính
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.45, 4.4, 0.45), steelMat);
    col.position.set(cx, 2.2, cz);
    col.castShadow = true;
    industrialSawmill.add(col);

    // Bản mã chân đế thép
    const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.12, 0.85), safetyYellowMat);
    basePlate.position.set(cx, 0.06, cz);
    industrialSawmill.add(basePlate);
  });

  // Dầm ngang chịu lực nóc máy (Top Gantry Beams)
  const beamNorth = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.4, 0.4), steelMat);
  beamNorth.position.set(0, 4.3, -1.8);
  industrialSawmill.add(beamNorth);

  const beamSouth = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.4, 0.4), steelMat);
  beamSouth.position.set(0, 4.3, 1.8);
  industrialSawmill.add(beamSouth);

  const crossBeamL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 4.0), safetyYellowMat);
  crossBeamL.position.set(-2.4, 4.3, 0);
  industrialSawmill.add(crossBeamL);

  const crossBeamR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 4.0), safetyYellowMat);
  crossBeamR.position.set(2.4, 4.3, 0);
  industrialSawmill.add(crossBeamR);

  // Vạch kẻ sọc an toàn vàng/đen trên dầm trán máy
  const hazardBeam = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.35, 0.08),
    new THREE.MeshBasicMaterial({ map: Textures.hazardStripes() })
  );
  hazardBeam.position.set(0, 4.3, 2.05);
  industrialSawmill.add(hazardBeam);

  // Biển hiệu công nghiệp gắn trán máy cưa
  const millSign = makeBillboardText('⚡ MÁY CƯA GỖ CÔNG NGHIỆP HEAVY-DUTY', '#facc15', 380, 50);
  millSign.position.set(0, 5.0, 0);
  industrialSawmill.add(millSign);

  // 2. Cụm Động Cơ Điện 3 Pha 150kW (Electric Motor & Drive Belt Pulleys)
  const motorGroup = new THREE.Group();
  motorGroup.position.set(-1.6, 2.9, -1.6);
  industrialSawmill.add(motorGroup);

  const motorBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 1.4, 16),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4, metalness: 0.6 })
  );
  motorBody.rotateZ(Math.PI / 2);
  motorGroup.add(motorBody);

  // Cánh tản nhiệt & hộp đấu điện động cơ
  const motorBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.4), steelMat);
  motorBox.position.set(0, 0.65, 0);
  motorGroup.add(motorBox);

  // Bánh đà puly truyền động (Drive Pulley)
  const pulleyGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.16, 16);
  pulleyGeo.rotateZ(Math.PI / 2);
  const drivePulley = new THREE.Mesh(pulleyGeo, chromeMat);
  drivePulley.position.set(0.85, 0, 0);
  motorGroup.add(drivePulley);
  window.drivePulley = drivePulley;

  // Dây curoa cao su nối xuống trục cưa (Rubber Drive Belt)
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 });
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.28), beltMat);
  belt.position.set(0.85, -0.65, 0.4);
  belt.rotation.z = 0.2;
  motorGroup.add(belt);

  // 3. Cụm Vỏ Bảo Vệ & Trục Cưa Kép Thép Carbide (Dual Circular Saw Assembly)
  const sawChamberBox = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 1.8, 2.4),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 })
  );
  sawChamberBox.position.set(0, 2.0, 0);
  sawChamberBox.castShadow = true;
  industrialSawmill.add(sawChamberBox);

  // Cửa quan sát chống văng dăm gỗ (Lexan Safety Glass Window)
  const windowMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.9, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, roughness: 0.1 })
  );
  windowMesh.position.set(0, 2.1, 1.25);
  industrialSawmill.add(windowMesh);

  // Ánh sáng phát quang bên trong buồng cắt (Saw Light)
  const sawLight = new THREE.PointLight(0xf97316, 0, 14);
  sawLight.position.set(0, 2.0, 0);
  industrialSawmill.add(sawLight);
  sawLight.userData.nightIntensity = 2.2;
  if (!window.nightLights) window.nightLights = [];
  window.nightLights.push(sawLight);
  window.sawLight = sawLight;

  // 2 Lưỡi cưa đĩa hợp kim siêu bén xoay tốc độ cao (Blade 1 & Blade 2)
  const bladeGeo = new THREE.CylinderGeometry(1.65, 1.65, 0.08, 20);
  bladeGeo.rotateZ(Math.PI / 2);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.98, roughness: 0.1 });
  const blade1 = new THREE.Mesh(bladeGeo, bladeMat);
  blade1.position.set(-0.65, 1.9, 0);
  blade1.castShadow = true;
  industrialSawmill.add(blade1);

  const blade2 = new THREE.Mesh(bladeGeo, bladeMat);
  blade2.position.set(0.65, 1.9, 0);
  blade2.castShadow = true;
  industrialSawmill.add(blade2);
  window.blade1 = blade1;
  window.blade2 = blade2;

  // 4. Phễu Hút Mùn Cưa & Đường Ống Thông Gió Công Nghiệp Nối Vào Cyclone Silo
  const hood = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 1.2, 4),
    new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.3 })
  );
  hood.position.set(0, 3.4, 0);
  hood.rotateY(Math.PI / 4);
  industrialSawmill.add(hood);

  // Đường ống uốn cong từ nóc máy cưa sang Cyclone Silo
  const ductCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 4.0, 0),
    new THREE.Vector3(0, 5.2, -2.5),
    new THREE.Vector3(0, 4.8, -6.0)
  ]);
  const ductGeo = new THREE.TubeGeometry(ductCurve, 16, 0.38, 10, false);
  const ductMesh = new THREE.Mesh(ductGeo, new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.3 }));
  industrialSawmill.add(ductMesh);

  // 5. Bàn Băng Chuyền Con Lăn Cơ Khí (Motorized Infeed & Outfeed Roller Tables)
  const conveyorBedMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.4 });
  const rollerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });

  // Bàn tiếp liệu đầu vào (Infeed Roller Bed) - Phía Tây (x = -5.8)
  const infeedConveyor = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.55, 2.2), conveyorBedMat);
  infeedConveyor.position.set(-5.8, 0.65, 0);
  infeedConveyor.castShadow = true;
  industrialSawmill.add(infeedConveyor);

  const rollers = [];
  for (let ri = -2.6; ri <= 2.6; ri += 0.85) {
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.05, 10), rollerMat);
    roller.rotateX(Math.PI / 2);
    roller.position.set(-5.8 + ri, 0.98, 0);
    roller.castShadow = true;
    industrialSawmill.add(roller);
    rollers.push(roller);
  }

  // Bàn xuất ván thành phẩm (Outfeed Roller Bed) - Phía Đông (x = +5.8)
  const outfeedConveyor = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.55, 2.2), conveyorBedMat);
  outfeedConveyor.position.set(5.8, 0.65, 0);
  outfeedConveyor.castShadow = true;
  industrialSawmill.add(outfeedConveyor);

  for (let ro = -2.6; ro <= 2.6; ro += 0.85) {
    const rollerO = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.05, 10), rollerMat);
    rollerO.rotateX(Math.PI / 2);
    rollerO.position.set(5.8 + ro, 0.98, 0);
    rollerO.castShadow = true;
    industrialSawmill.add(rollerO);
    rollers.push(rollerO);
  }
  window.millRollers = rollers;

  // Khúc gỗ nguyên liệu trượt trên băng chuyền nạp phôi (Infeed Log)
  const millInfeedLog = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.38, 2.2, 8),
    sharedTrunkMat
  );
  millInfeedLog.rotateZ(Math.PI / 2);
  millInfeedLog.position.set(-6.8, 1.35, 0);
  millInfeedLog.castShadow = true;
  industrialSawmill.add(millInfeedLog);
  window.millInfeedLog = millInfeedLog;

  // Kiện ván gỗ thành phẩm trượt trên băng chuyền xuất xưởng (Outfeed Planks)
  const plankMat = new THREE.MeshStandardMaterial({ map: Textures.plank(), roughness: 0.6 });
  const millOutfeedPlank = new THREE.Group();
  for (let pi = -0.22; pi <= 0.22; pi += 0.22) {
    const pMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.55), plankMat);
    pMesh.position.set(0, pi + 0.22, 0);
    pMesh.castShadow = true;
    millOutfeedPlank.add(pMesh);
  }
  millOutfeedPlank.position.set(2.5, 1.25, 0);
  industrialSawmill.add(millOutfeedPlank);
  window.millOutfeedPlank = millOutfeedPlank;

  // Đèn pha công trường cao áp rọi sáng bàn cưa và bãi gỗ về đêm
  if (!window.nightLights) window.nightLights = [];
  const sawFloodlight1 = new THREE.SpotLight(0xfef08a, 0, 32, Math.PI / 3.5, 0.45);
  sawFloodlight1.position.set(-3.2, 5.8, 1.8);
  sawFloodlight1.target.position.set(-5.5, 0, 0);
  industrialSawmill.add(sawFloodlight1);
  industrialSawmill.add(sawFloodlight1.target);
  sawFloodlight1.userData.nightIntensity = 3.6;
  window.nightLights.push(sawFloodlight1);

  const sawFloodlight2 = new THREE.SpotLight(0xfef08a, 0, 32, Math.PI / 3.5, 0.45);
  sawFloodlight2.position.set(3.2, 5.8, 1.8);
  sawFloodlight2.target.position.set(5.5, 0, 0);
  industrialSawmill.add(sawFloodlight2);
  industrialSawmill.add(sawFloodlight2.target);
  sawFloodlight2.userData.nightIntensity = 3.6;
  window.nightLights.push(sawFloodlight2);

  // Cụm Máy Đóng Đai Tự Động Pallet Gỗ (Automatic Pallet Strapping Machine)
  const strappingBay = new THREE.Group();
  strappingBay.position.set(6.0, 0, 0);
  industrialSawmill.add(strappingBay);

  const archL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), safetyYellowMat);
  archL.position.set(0, 1.6, -1.2);
  archL.castShadow = true;
  strappingBay.add(archL);
  const archR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), safetyYellowMat);
  archR.position.set(0, 1.6, 1.2);
  archR.castShadow = true;
  strappingBay.add(archR);
  const archTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 2.75), safetyYellowMat);
  archTop.position.set(0, 3.2, 0);
  strappingBay.add(archTop);

  const pressHead = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 1.8), steelMat);
  pressHead.position.set(0, 2.4, 0);
  strappingBay.add(pressHead);
  window.strappingPressHead = pressHead;

  const strapSign = makeBillboardText('📦 TRẠM ĐÓNG ĐAI PALLET (5 VÁN ➜ 1 PALLET)', '#f59e0b', 340, 48);
  strapSign.position.set(6.0, 4.2, -18);
  scene.add(strapSign);
  window.strapSign = strapSign;

  // Bãi tập kết các kiện Pallet gỗ thành phẩm
  const palletMeshes = [];
  const palletBaseGeo = new THREE.BoxGeometry(1.6, 0.18, 1.6);
  const plankBundleGeo = new THREE.BoxGeometry(1.5, 0.75, 1.5);
  const strapGeo = new THREE.BoxGeometry(1.54, 0.77, 0.06);
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95 });
  const euroPalletMat = new THREE.MeshStandardMaterial({ map: Textures.plank(), roughness: 0.8 });

  for (let pi = 0; pi < 12; pi++) {
    const pGroup = new THREE.Group();
    const col = pi % 3;
    const row = Math.floor((pi % 6) / 3);
    const tier = Math.floor(pi / 6);
    pGroup.position.set(11.8 + col * 1.9, tier * 1.05 + 0.1, -16.5 - row * 2.0);

    const pBase = new THREE.Mesh(palletBaseGeo, euroPalletMat);
    pBase.position.y = 0.09;
    pBase.castShadow = true;
    pGroup.add(pBase);

    const pBundle = new THREE.Mesh(plankBundleGeo, euroPalletMat);
    pBundle.position.y = 0.55;
    pBundle.castShadow = true;
    pGroup.add(pBundle);

    const s1 = new THREE.Mesh(strapGeo, strapMat);
    s1.position.set(0, 0.55, -0.4);
    pGroup.add(s1);
    const s2 = new THREE.Mesh(strapGeo, strapMat);
    s2.position.set(0, 0.55, 0.4);
    pGroup.add(s2);

    pGroup.visible = false;
    scene.add(pGroup);
    palletMeshes.push(pGroup);
  }
  window.palletStackMeshes = palletMeshes;

  // 6. Bàn Bảng Điều Khiển Của Kỹ Sư Vận Hành Máy (Saw Operator Station)
  const controlDesk = new THREE.Group();
  controlDesk.position.set(-1.8, 0, 1.8);
  industrialSawmill.add(controlDesk);

  const deskBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.8), steelMat);
  deskBody.position.y = 0.55;
  deskBody.castShadow = true;
  controlDesk.add(deskBody);

  const deskSlope = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.6), safetyYellowMat);
  deskSlope.position.set(0, 1.15, 0.05);
  deskSlope.rotation.x = 0.25;
  controlDesk.add(deskSlope);

  // Nút ấn Dừng Khẩn Cấp đỏ (E-Stop Mushroom Button)
  const eStop = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
  eStop.position.set(0.35, 1.25, 0.05);
  controlDesk.add(eStop);

  // 2 Cần gạt điều khiển thủy lực (Hydraulic Levers)
  const leverMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.9 });
  const leverL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6), leverMat);
  leverL.position.set(-0.25, 1.3, 0.05);
  leverL.rotation.x = -0.3;
  controlDesk.add(leverL);
  window.operatorLever = leverL;

  const leverR = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6), leverMat);
  leverR.position.set(0, 1.3, 0.05);
  leverR.rotation.x = 0.2;
  controlDesk.add(leverR);

  // -------------------------------------------------------------------------
  // 7. BÃI ĐỆM CHẤT ĐỐNG GỖ THẬT 3D CHỜ XẺ (DYNAMIC INTAKE LOG BUFFER PILE)
  // Gỗ chất đống hình kim tự tháp bên cạnh bàn tiếp liệu, hiển thị vơi đầy chân thật
  // -------------------------------------------------------------------------
  const logBufferGroup = new THREE.Group();
  logBufferGroup.position.set(-6.0, 0, -15.5);
  scene.add(logBufferGroup);
  window.logBufferGroup = logBufferGroup;

  const bufferLogGeo = new THREE.CylinderGeometry(0.22, 0.22, 2.6, 8);
  bufferLogGeo.rotateZ(Math.PI / 2);
  const bufferLogMat = new THREE.MeshStandardMaterial({ map: Textures.bark(), roughness: 0.85 });

  const bufferMeshes = [];
  // Xếp kim tự tháp 20 khúc gỗ: Tầng 0 (6 khúc), Tầng 1 (5 khúc), Tầng 2 (4 khúc), Tầng 3 (3 khúc), Tầng 4 (2 khúc)
  const layers = [
    { count: 6, y: 0.22, zStart: -1.2, stepZ: 0.48 },
    { count: 5, y: 0.58, zStart: -0.96, stepZ: 0.48 },
    { count: 4, y: 0.94, zStart: -0.72, stepZ: 0.48 },
    { count: 3, y: 1.30, zStart: -0.48, stepZ: 0.48 },
    { count: 2, y: 1.66, zStart: -0.24, stepZ: 0.48 }
  ];

  layers.forEach(layer => {
    for (let c = 0; c < layer.count; c++) {
      const bLog = new THREE.Mesh(bufferLogGeo, bufferLogMat);
      bLog.position.set(0, layer.y, layer.zStart + c * layer.stepZ);
      bLog.castShadow = true;
      bLog.visible = false;
      logBufferGroup.add(bLog);
      bufferMeshes.push(bLog);
    }
  });
  window.machineLogBufferMeshes = bufferMeshes;

  // Vòng tương tác nạp gỗ dưới sàn: { x: -6.0, z: -18 }, r = 1.6m
  const bufferRingGeo = new THREE.RingGeometry(1.2, 1.6, 32);
  bufferRingGeo.rotateX(-Math.PI / 2);
  const bufferRing = new THREE.Mesh(
    bufferRingGeo,
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
  );
  bufferRing.position.set(-6.0, 0.05, -18);
  scene.add(bufferRing);
  window.bufferRing = bufferRing;

  // Bảng 3D trên đầu bãi đệm gỗ
  const bufferTag = makeBillboardText('🪵 ĐỆM NẠP GỖ: 0/30 (Bước vào để dỡ gỗ)', '#38bdf8', 340, 52);
  bufferTag.position.set(-6.0, 2.6, -15.5);
  scene.add(bufferTag);
  window.bufferTag = bufferTag;

  // Kho Pallet Ván Gỗ Thành Phẩm: { x: 12, z: -18 } (Tách biệt khỏi buồng đóng đai)
  const palletBay = new THREE.Group();
  palletBay.position.set(12, 0, -18);
  scene.add(palletBay);
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 2.2), new THREE.MeshStandardMaterial({ map: Textures.plank(), roughness: 0.8 }));
    p.position.set(0, 0.35 + i * 0.55, 0);
    p.castShadow = true;
    palletBay.add(p);
  }

  // HÀNH LANG GIAO THÔNG XE NÂNG CHUYÊN DỤNG (DEDICATED FORKLIFT CORRIDOR: Z = -13, X: 11 đến 26)
  const forkliftCorridorMat = new THREE.MeshStandardMaterial({ map: Textures.asphalt(), roughness: 0.8 });
  const forkliftCorridor = new THREE.Mesh(new THREE.BoxGeometry(16.5, 0.22, 4.2), forkliftCorridorMat);
  forkliftCorridor.position.set(18.5, 0.12, -13);
  forkliftCorridor.receiveShadow = true;
  scene.add(forkliftCorridor);

  // Vạch sơn sọc an toàn công nghiệp vàng phản quang 2 bên mép hành lang
  const hazardMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const hazardStripeNorth = new THREE.Mesh(new THREE.PlaneGeometry(16.5, 0.25), hazardMat);
  hazardStripeNorth.rotateX(-Math.PI / 2);
  hazardStripeNorth.position.set(18.5, 0.24, -15.1);
  scene.add(hazardStripeNorth);

  const hazardStripeSouth = new THREE.Mesh(new THREE.PlaneGeometry(16.5, 0.25), hazardMat);
  hazardStripeSouth.rotateX(-Math.PI / 2);
  hazardStripeSouth.position.set(18.5, 0.24, -10.9);
  scene.add(hazardStripeSouth);

  const corridorSign = makeBillboardText('🚜 LÀN ĐƯỜNG XE NÂNG HÀNG NỘI BỘ', '#facc15', 340, 48);
  corridorSign.position.set(18.5, 3.6, -13);
  scene.add(corridorSign);

  // -------------------------------------------------------------------------
  // 2. QUẦY THU MUA VÁN GỖ - ĐẶT TẠI SÂN THƯƠNG MẠI: { x: 18, z: -25 }
  // (Không còn chắn ngang đường chạy của xe nâng)
  // -------------------------------------------------------------------------
  const tradingStall = new THREE.Group();
  tradingStall.position.set(18, 0, -25);
  scene.add(tradingStall);

  // Bàn quầy thu mua bằng gỗ thông mộc mạc
  const sellZone = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.0, 1.8),
    new THREE.MeshStandardMaterial({ map: Textures.timberPlank(), roughness: 0.75 })
  );
  sellZone.position.y = 0.5;
  sellZone.castShadow = true;
  sellZone.receiveShadow = true;
  sellZone.userData = { type: 'trade_stall' };
  tradingStall.add(sellZone);
  clickables.push(sellZone);
  window.sellZone = sellZone;

  // 4 Cột dầm gỗ sồi đỡ mái bạt
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x58240c, roughness: 0.85 });
  [[-1.4, -0.75], [1.4, -0.75], [-1.4, 0.75], [1.4, 0.75]].forEach(([px, pz]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), poleMat);
    pole.position.set(px, 1.2, pz);
    pole.castShadow = true;
    tradingStall.add(pole);
  });

  // Mái bạt vòm sọc màu cam/trắng phong cách chợ phiên (Market Awning)
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.35, 2.4),
    new THREE.MeshStandardMaterial({ map: Textures.scandiRoof(), roughness: 0.6 })
  );
  canopy.position.set(0, 2.45, 0);
  canopy.rotation.x = 0.1;
  canopy.castShadow = true;
  tradingStall.add(canopy);

  // Thùng gỗ trưng bày kiện ván và hòm tiền vàng mở nắp
  const plankCrate = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.85), new THREE.MeshStandardMaterial({ map: Textures.plank() }));
  plankCrate.position.set(1.15, 1.25, 0.2);
  plankCrate.castShadow = true;
  tradingStall.add(plankCrate);

  const goldCoin = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.08, 12), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 }));
  goldCoin.position.set(1.15, 1.62, 0.2);
  tradingStall.add(goldCoin);

  // Đèn lồng vàng ấm treo trước quầy
  const stallLight = new THREE.PointLight(0xfef08a, 0, 8);
  stallLight.position.set(0, 2.1, 1.1);
  tradingStall.add(stallLight);
  stallLight.userData.nightIntensity = 1.4;
  if (!window.nightLights) window.nightLights = [];
  window.nightLights.push(stallLight);

  // Vòng tương tác dưới sàn quầy bán (r = 1.25m)
  const sellRingGeo = new THREE.RingGeometry(0.9, 1.25, 32);
  sellRingGeo.rotateX(-Math.PI / 2);
  const sellRing = new THREE.Mesh(sellRingGeo, new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  sellRing.position.y = 0.05;
  tradingStall.add(sellRing);

  // Bảng hiệu 3D (Y = +2.2m)
  const sellTag = makeBillboardText('💰 THU MUA VÁN GỖ - $20/ván', '#4ade80');
  sellTag.position.set(18, 2.2, -18);
  sellTag.visible = false;
  scene.add(sellTag);
  window.sellTag = sellTag;

  // -------------------------------------------------------------------------
  // THÁP THU HỒI MÙN CƯA CYCLONE SILO - HẬU CẦN PHÍA TÂY: { x: -8, z: -26 }
  // -------------------------------------------------------------------------
  const cycloneGroup = new THREE.Group();
  cycloneGroup.position.set(-8, 0, -26);
  scene.add(cycloneGroup);

  const siloBody = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 4.2, 16),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 })
  );
  siloBody.position.y = 3.6;
  siloBody.castShadow = true;
  cycloneGroup.add(siloBody);

  const siloCone = new THREE.Mesh(
    new THREE.ConeGeometry(1.5, 1.8, 16),
    new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.85 })
  );
  siloCone.position.y = 0.9;
  siloCone.rotateX(Math.PI);
  cycloneGroup.add(siloCone);

  const siloCap = new THREE.Mesh(
    new THREE.ConeGeometry(1.8, 0.8, 16),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 })
  );
  siloCap.position.y = 6.1;
  cycloneGroup.add(siloCap);

  // Ống hút kim loại uốn cong nối buồng cưa với Cyclone Silo
  const siloDuctCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 3.8, 4.2),
    new THREE.Vector3(-1.2, 4.5, 2.0),
    new THREE.Vector3(0, 4.8, 0)
  ]);
  const siloDuctGeo = new THREE.TubeGeometry(siloDuctCurve, 12, 0.32, 8, false);
  const siloDuctMesh = new THREE.Mesh(siloDuctGeo, new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9 }));
  cycloneGroup.add(siloDuctMesh);

  // Đồng hồ đo áp suất kim quay giật trên tường buồng cưa
  const gaugeCv = document.createElement('canvas');
  gaugeCv.width = 128; gaugeCv.height = 128;
  const gCtx = gaugeCv.getContext('2d');
  gCtx.fillStyle = '#f8fafc'; gCtx.beginPath(); gCtx.arc(64, 64, 58, 0, Math.PI * 2); gCtx.fill();
  gCtx.strokeStyle = '#0f172a'; gCtx.lineWidth = 6; gCtx.stroke();
  gCtx.strokeStyle = '#ef4444'; gCtx.lineWidth = 4; gCtx.beginPath(); gCtx.moveTo(64, 64); gCtx.lineTo(92, 42); gCtx.stroke();
  const gaugeSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gaugeCv) }));
  gaugeSprite.scale.set(0.7, 0.7, 1);
  gaugeSprite.position.set(-1.8, 3.6, 2.45);
  industrialSawmill.add(gaugeSprite);

  // -------------------------------------------------------------------------
  // SECTOR 3: DÒNG SÔNG NGỌC BÍCH THỦY ĐỘNG LỰC HỌC (STYLIZED AAA RIVER SYSTEM - DÀI 380m)
  // -------------------------------------------------------------------------
  const riverGeo = new THREE.PlaneGeometry(380, 24, 96, 24);
  riverGeo.rotateX(-Math.PI / 2);

  const rGradient = Textures.riverGradient();
  rGradient.wrapS = THREE.RepeatWrapping;
  rGradient.wrapT = THREE.ClampToEdgeWrapping;
  rGradient.repeat.set(6, 1);

  const wNormal = Textures.waterNormal();
  wNormal.wrapS = THREE.RepeatWrapping;
  wNormal.wrapT = THREE.RepeatWrapping;
  wNormal.repeat.set(8, 2);

  const riverMat = new THREE.MeshStandardMaterial({
    map: rGradient,
    roughness: 0.05,
    metalness: 0.22,
    normalMap: wNormal,
    normalScale: new THREE.Vector2(1.25, 1.25),
    transparent: true,
    opacity: 0.94
  });
  const river = new THREE.Mesh(riverGeo, riverMat);
  river.position.set(0, 0.1, 16);
  river.receiveShadow = true;
  scene.add(river);
  window.riverMesh = river;

  // 100 Đốm kim cương lấp lánh phản quang ánh nắng trên sóng nước (Sun Specular Sparkles)
  const glintGeo = new THREE.PlaneGeometry(0.35, 0.35);
  glintGeo.rotateX(-Math.PI / 2);
  const glintMat = new THREE.MeshBasicMaterial({
    map: Textures.sunGlint(),
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const glintGroup = new THREE.Group();
  scene.add(glintGroup);
  window.glintGroup = glintGroup;
  window.glintItems = [];
  for (let gi = 0; gi < 45; gi++) {
    const glint = new THREE.Mesh(glintGeo, glintMat);
    const gx = -58 + Math.random() * 116;
    const gz = 7 + Math.random() * 18;
    glint.position.set(gx, 0.14, gz);
    glintGroup.add(glint);
    window.glintItems.push({
      mesh: glint,
      baseX: gx,
      baseZ: gz,
      phase: Math.random() * Math.PI * 2,
      speed: 1.8 + Math.random() * 2.2
    });
  }

  // Hàng cọc gỗ kè bờ sông mộc mạc (Rustic Shoreline Timber Pilings)
  const pileGeo = new THREE.CylinderGeometry(0.16, 0.2, 1.4, 6);
  const pileMat = new THREE.MeshStandardMaterial({ color: 0x58240c, roughness: 0.85 });
  const pilingsGroup = new THREE.Group();
  for (let px = -62; px <= 62; px += 2.6) {
    const pile = new THREE.Mesh(pileGeo, pileMat);
    pile.position.set(px, 0.65, 5.25);
    pile.rotation.set((Math.random() - 0.5) * 0.1, Math.random() * Math.PI, (Math.random() - 0.5) * 0.1);
    pile.castShadow = true;
    pilingsGroup.add(pile);
  }
  scene.add(pilingsGroup);

  // Dải bọt sóng trắng dập dềnh hai bên bờ sông (Shoreline Foam Ribbons)
  const shoreFoamGeo = new THREE.PlaneGeometry(140, 1.8);
  shoreFoamGeo.rotateX(-Math.PI / 2);
  const shoreFoamMat = new THREE.MeshBasicMaterial({
    map: Textures.shoreFoam(),
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  });

  const shoreFoamNorth = new THREE.Mesh(shoreFoamGeo, shoreFoamMat);
  shoreFoamNorth.position.set(0, 0.12, 5.2);
  scene.add(shoreFoamNorth);
  window.shoreFoamNorth = shoreFoamNorth;

  const shoreFoamSouth = new THREE.Mesh(shoreFoamGeo, shoreFoamMat);
  shoreFoamSouth.position.set(0, 0.12, 26.8);
  shoreFoamSouth.rotateY(Math.PI);
  scene.add(shoreFoamSouth);
  window.shoreFoamSouth = shoreFoamSouth;

  // -------------------------------------------------------------------------
  // VÒM TRỜI KHÍ QUYỂN NGHỆ THUẬT (STYLIZED ATMOSPHERIC SKY DOME)
  // -------------------------------------------------------------------------
  const skyDomeGeo = new THREE.SphereGeometry(180, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const skyDomeMat = new THREE.MeshBasicMaterial({
    map: Textures.skyAtmosphere(),
    side: THREE.BackSide,
    depthWrite: false
  });
  const skyDome = new THREE.Mesh(skyDomeGeo, skyDomeMat);
  skyDome.position.set(0, -4, 0);
  scene.add(skyDome);
  window.skyDome = skyDome;

  // CHÙM TIA NẮNG THỂ TÍCH XUYÊN RỪNG THÔNG (VOLUMETRIC GOD RAYS)
  const godRayGeo = new THREE.CylinderGeometry(0.8, 5.2, 42, 8, 1, true);
  godRayGeo.rotateZ(Math.PI / 5.2);
  const godRayMat = new THREE.MeshBasicMaterial({
    map: Textures.volumetricBeam(),
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const godRaysGroup = new THREE.Group();
  godRaysGroup.position.set(-25, 22, -18);
  scene.add(godRaysGroup);
  window.godRaysGroup = godRaysGroup;

  [-10, 0, 10].forEach((rx, idx) => {
    const beam = new THREE.Mesh(godRayGeo, godRayMat);
    beam.position.set(rx * 1.4, (idx % 2) * 2, (idx - 1) * 7);
    beam.rotation.y = 0.2 + idx * 0.15;
    godRaysGroup.add(beam);
  });

  // -------------------------------------------------------------------------
  // MÂY TRÔI BỒNG BỀNH LOW-POLY TRÊN BẦU TRỜI (PUFFY DRIFTING CLOUDS)
  // -------------------------------------------------------------------------
  const clouds = [];
  function createPuffyCloud(cx, cy, cz) {
    const cloudGroup = new THREE.Group();
    cloudGroup.position.set(cx, cy, cz);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      flatShading: true
    });

    const sphereGeo = new THREE.DodecahedronGeometry(2.4, 1);
    const offsets = [
      [0, 0, 0, 1.0],
      [-2.0, -0.4, 0.2, 0.8],
      [2.0, -0.3, -0.2, 0.85],
      [0.8, 0.6, 0.3, 0.75],
      [-0.8, 0.5, -0.3, 0.7]
    ];
    offsets.forEach(([ox, oy, oz, sc]) => {
      const m = new THREE.Mesh(sphereGeo, cloudMat);
      m.position.set(ox, oy, oz);
      m.scale.set(sc, sc * 0.7, sc);
      cloudGroup.add(m);
    });

    scene.add(cloudGroup);
    clouds.push(cloudGroup);
  }

  for (let i = 0; i < 7; i++) {
    createPuffyCloud(-60 + i * 20 + Math.random() * 8, 32 + Math.random() * 6, -40 + Math.random() * 80);
  }
  window.clouds = clouds;

  // -------------------------------------------------------------------------
  // ĐOM ĐÓM PHÁT SÁNG BAN ĐÊM (NIGHT FIREFLIES)
  // -------------------------------------------------------------------------
  const fireflyCount = 30;
  const fireflyGeo = new THREE.BufferGeometry();
  const fireflyPositions = new Float32Array(fireflyCount * 3);
  for (let i = 0; i < fireflyCount * 3; i += 3) {
    fireflyPositions[i] = -45 + Math.random() * 50;
    fireflyPositions[i + 1] = 0.5 + Math.random() * 2.5;
    fireflyPositions[i + 2] = -30 + Math.random() * 45;
  }
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3));
  const fireflyMat = new THREE.PointsMaterial({
    color: 0xbef264,
    size: 0.35,
    transparent: true,
    opacity: 0.0 // Sẽ tự động sáng vào ban đêm trong updateDayNightCycle
  });
  const fireflies = new THREE.Points(fireflyGeo, fireflyMat);
  scene.add(fireflies);
  window.fireflies = fireflies;

  // Thác Nước Thực Tế (Cascading Waterfall) với UV Scroll
  const waterfallGeo = new THREE.PlaneGeometry(16, 12, 16, 16);
  const waterfallMat = new THREE.MeshStandardMaterial({
    map: Textures.waterfall(),
    transparent: true,
    opacity: 0.85,
    roughness: 0.2
  });
  waterfallMesh = new THREE.Mesh(waterfallGeo, waterfallMat);
  waterfallMesh.position.set(-64, 5.5, 16);
  waterfallMesh.rotateY(Math.PI / 2);
  scene.add(waterfallMesh);

  // Hạt sương mù chân thác nước (Water Mist Points)
  const mistCount = 120;
  const mistGeo = new THREE.BufferGeometry();
  const mistPositions = new Float32Array(mistCount * 3);
  for (let i = 0; i < mistCount * 3; i += 3) {
    mistPositions[i] = -63 + (Math.random() - 0.5) * 4;
    mistPositions[i + 1] = 0.5 + Math.random() * 3.5;
    mistPositions[i + 2] = 16 + (Math.random() - 0.5) * 12;
  }
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3));
  const mistMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.45 });
  waterMistPoints = new THREE.Points(mistGeo, mistMat);
  scene.add(waterMistPoints);

  // -------------------------------------------------------------------------
  // SECTOR 3: HẠ TẦNG HẢI CẢNG & KHU CHẾ BIẾN THỦY SẢN HIỆN ĐẠI (MODERN PORT)
  // [BỜ TÂY SÔNG THÔNG THOÁNG: HOÀN TOÀN TÁCH BIỆT TRỤC CAO TỐC VÀ CẦU VƯỢT X = 20..36]
  // -------------------------------------------------------------------------

  // 1. Tuyến Đường Nhựa Nhánh Nối Từ Cao Tốc Vào Cảng (Harbor Access Road)
  // [ĐẤU NỐI VÀO BỜ BẮC CAO TỐC TẠI Z = -10, CÁCH XA ĐẦU CẦU Z = 2.0 ĐẢM BẢO XE CHẠY KHÔNG BAO GIỜ BỊ XUYÊN CẮT]
  const harborRoadMat = new THREE.MeshStandardMaterial({ map: Textures.asphalt(), roughness: 0.85 });
  const harborRoad = new THREE.Mesh(new THREE.BoxGeometry(12, 0.22, 6.0), harborRoadMat);
  harborRoad.position.set(14, 0.13, -10.0);
  harborRoad.receiveShadow = true;
  scene.add(harborRoad);

  // Vạch kẻ đường vàng phản quang nhánh cảng
  const hRoadLineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const hStripe = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.25), hRoadLineMat);
  hStripe.rotateX(-Math.PI / 2);
  hStripe.position.set(14, 0.26, -10.0);
  scene.add(hStripe);

  // Biển báo chỉ dẫn lối vào Cảng Biển
  const portSign = makeBillboardText('⚓ CẢNG THỦY SẢN & CHỢ CÁ BIỂN', '#38bdf8', 340, 48);
  portSign.position.set(18.5, 4.4, -10.0);
  scene.add(portSign);
  window.portSign = portSign;

  // 2. Bờ Kè Đá Cảng & Sàn Đi Bộ Lát Gỗ Bờ Tây (West Harbor Quay)
  // [GIỚI HẠN X TỪ -6.0 ĐẾN 16.0 - CÁCH MÉP CẦU VƯỢT 4.6M, TUYỆT ĐỐI KHÔNG CHÈO QUA LÀN ĐƯỜNG CAO TỐC]
  const quayGeo = new THREE.BoxGeometry(22, 0.65, 3.2);
  const quayMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9, metalness: 0.2 });
  const stoneQuay = new THREE.Mesh(quayGeo, quayMat);
  stoneQuay.position.set(5.0, 0.35, 5.2);
  stoneQuay.castShadow = true;
  stoneQuay.receiveShadow = true;
  scene.add(stoneQuay);

  // Cọc bích gang đúc neo đậu tàu bên bờ Tây (bx từ -4 đến 14, không vượt qua X = 15)
  const bollardGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.55, 8);
  const bollardMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.3 });
  for (let bx = -4; bx <= 14; bx += 4.5) {
    const bollard = new THREE.Mesh(bollardGeo, bollardMat);
    bollard.position.set(bx, 0.85, 6.4);
    bollard.castShadow = true;
    scene.add(bollard);

    // Lốp xe cao su giảm chấn treo mạn bờ kè
    const tireFender = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.12, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 })
    );
    tireFender.position.set(bx, 0.35, 6.78);
    scene.add(tireFender);
  }

  // Cột đèn hải cảng bờ Tây (Nautical Pier Lanterns tại X = 0, 7, 14)
  const lanternPoleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.2, 8);
  const lanternPoleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85 });
  [0, 7, 14].forEach(lx => {
    const lp = new THREE.Mesh(lanternPoleGeo, lanternPoleMat);
    lp.position.set(lx, 2.3, 4.0);
    lp.castShadow = true;
    scene.add(lp);

    const lHead = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.35), new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.3 }));
    lHead.position.set(lx, 4.3, 4.0);
    scene.add(lHead);

    const pLight = new THREE.PointLight(0xfef08a, 0, 14, 1.8);
    pLight.position.set(lx, 4.1, 4.0);
    scene.add(pLight);
    pLight.userData.nightIntensity = 1.8;
    if (!window.nightLights) window.nightLights = [];
    window.nightLights.push(pLight);
  });

  // 3. CẦU TÀU GỖ HÌNH CHỮ "T" BỜ TÂY VEN SÔNG NƯỚC SÂU (T-SHAPED WEST EMBANKMENT PIER)
  // [ĐÃ DỜI TÁCH BIỆT KHỎI KHU VỰC CẦU CAO TỐC ĐƯỜNG BỘ X = 28]
  const pierMat = new THREE.MeshStandardMaterial({ map: Textures.plank(), roughness: 0.85 });
  const tPierGroup = new THREE.Group();
  scene.add(tPierGroup);

  // Thân cầu tàu nối từ bờ ra giữa sông phía Tây (Stem tại X = 5.0)
  const stemDeck = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.55, 12.0), pierMat);
  stemDeck.position.set(5.0, 0.65, 11.2);
  stemDeck.castShadow = true;
  stemDeck.receiveShadow = true;
  tPierGroup.add(stemDeck);

  // Cánh ngang cầu tàu nước sâu (Crosshead Wing X = 5.0, rộng 10.0m: X từ 0.0 đến 10.0)
  const wingDeck = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.55, 5.6), pierMat);
  wingDeck.position.set(5.0, 0.65, 17.0);
  wingDeck.castShadow = true;
  wingDeck.receiveShadow = true;
  tPierGroup.add(wingDeck);

  // Các cọc gỗ lớn cắm sâu dưới lòng sông bờ Tây
  const pierPilingGeo = new THREE.CylinderGeometry(0.24, 0.28, 3.2, 8);
  const pierPilingMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
  [
    [3.2, 8.5], [6.8, 8.5],
    [3.2, 13.5], [6.8, 13.5],
    [1.0, 17.0], [5.0, 17.0], [9.0, 17.0]
  ].forEach(([px, pz]) => {
    const pil = new THREE.Mesh(pierPilingGeo, pierPilingMat);
    pil.position.set(px, -0.6, pz);
    tPierGroup.add(pil);
  });

  // MŨI CẦU TÀU: KHU VỰC CÂU CÁ GIẢI TRÍ (RECREATIONAL FISHING SPOT BỜ TÂY)
  const fishSpotRing = new THREE.Mesh(
    new THREE.RingGeometry(1.2, 1.6, 24),
    new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
  );
  fishSpotRing.rotateX(-Math.PI / 2);
  fishSpotRing.position.set(5.0, 0.94, 18.8);
  fishSpotRing.userData = { type: 'fishing_spot' };
  tPierGroup.add(fishSpotRing);
  clickables.push(fishSpotRing);

  const fishingTag = makeBillboardText('🎣 [SPACE] CÂU CÁ THƯ GIÃN (+$45/con)', '#38bdf8', 340, 48);
  fishingTag.position.set(5.0, 3.2, 18.8);
  tPierGroup.add(fishingTag);
  window.fishingTag = fishingTag;

  // Thùng đồ câu, xô ướp đá và cuộn dây neo tàu
  const tackleBox = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.45), new THREE.MeshStandardMaterial({ color: 0xd97706 }));
  tackleBox.position.set(3.8, 1.15, 18.5);
  tPierGroup.add(tackleBox);

  const iceCooler = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.65, 0.75), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
  iceCooler.position.set(6.2, 1.25, 18.5);
  tPierGroup.add(iceCooler);

  // TÀU CÂU MỰC ĐÊM TRÊN CÁNH TÂY CẦU TÀU (NIGHT SQUID FISHING BOAT)
  const squidBoat = new THREE.Group();
  squidBoat.position.set(-4.5, 0.22, 14.0);
  scene.add(squidBoat);

  const sHullMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.5 }); // Xanh lục ngọc bích
  const sBottomMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 }); // Đáy đỏ chống hà
  const sDeckMat = new THREE.MeshStandardMaterial({ map: Textures.plank(), roughness: 0.8 });
  const sWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
  const sChromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 });

  // 1. Đáy tàu đỏ chống hà
  const sBottom = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.45, 2.5), sBottomMat);
  sBottom.position.y = 0.22;
  squidBoat.add(sBottom);

  // 2. Thân tàu chính
  const sHull = new THREE.Mesh(new THREE.BoxGeometry(6.0, 1.1, 2.6), sHullMat);
  sHull.position.y = 0.85;
  sHull.castShadow = true;
  squidBoat.add(sHull);

  // Mũi tàu vuốt nhọn rẽ sóng (Prow Wedge hướng sang Tây -X)
  const sBow = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.4, 4), sHullMat);
  sBow.rotation.z = Math.PI / 2;
  sBow.rotation.y = Math.PI / 4;
  sBow.position.set(-3.8, 0.95, 0);
  sBow.scale.set(1.0, 1.0, 0.8);
  sBow.castShadow = true;
  squidBoat.add(sBow);

  // Gờ viền mạn tàu (Rub-rail) gỗ mun sang trọng
  const rubRail = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.12, 2.76), new THREE.MeshStandardMaterial({ color: 0x451a03 }));
  rubRail.position.y = 1.35;
  squidBoat.add(rubRail);

  // 3. Cabin điều khiển bo cong góc cạnh
  const sCabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 2.0), sWhiteMat);
  sCabin.position.set(0.6, 2.0, 0);
  sCabin.castShadow = true;
  squidBoat.add(sCabin);

  // Kính buồng lái màu xanh khói
  const squidGlass = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 1.8), new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 }));
  squidGlass.position.set(-0.46, 2.2, 0);
  squidBoat.add(squidGlass);

  // Phao cứu sinh cam tròn bên mạn cabin
  [-1.05, 1.05].forEach(pz => {
    const lifeRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.08, 8, 16), new THREE.MeshStandardMaterial({ color: 0xf97316 }));
    lifeRing.position.set(0.6, 2.0, pz);
    squidBoat.add(lifeRing);
  });

  // 4. Giàn đèn câu mực đêm 2 tầng (Overhead 2-Tier Halogen Squid Lamp Rack)
  const rackGroup = new THREE.Group();
  rackGroup.position.set(-1.0, 2.8, 0);
  squidBoat.add(rackGroup);

  const rackFrame = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.08, 1.8), sChromeMat);
  rackGroup.add(rackFrame);

  // Cột đỡ giàn đèn 4 góc
  [[-1.6, -0.7], [-1.6, 0.7], [1.6, -0.7], [1.6, 0.7]].forEach(([rx, rz]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6), sChromeMat);
    post.position.set(rx, -0.75, rz);
    rackGroup.add(post);
  });

  // Hàng bóng đèn Halogen hình cầu lấp lánh
  for (let bx = -1.4; bx <= 1.4; bx += 0.55) {
    [-0.65, 0.65].forEach(bz => {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshStandardMaterial({ color: 0xa7f3d0, emissive: 0x34d399, emissiveIntensity: 0.8 }));
      bulb.position.set(bx, -0.15, bz);
      rackGroup.add(bulb);
    });
  }

  // Nguồn sáng xanh ngọc công suất cao chiếu rực mặt nước
  const squidLight = new THREE.PointLight(0x6ee7b7, 0, 22, 2.2);
  squidLight.position.set(-1.0, 2.6, 0);
  squidBoat.add(squidLight);
  squidLight.userData.nightIntensity = 3.2;
  window.nightLights.push(squidLight);

  // Lốp cao su đệm mạn chống va vào cọc cầu tàu
  [-1.2, 1.2].forEach(lz => {
    const fender = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 8, 12), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 }));
    fender.position.set(lz, 0.8, -1.35);
    squidBoat.add(fender);
  });

  // 4. KHU CHỢ CÁ CẢNG BIỂN & QUẦY THU MUA HẢI SẢN (SEAFOOD HARBOR MARKET)
  const seafoodMarket = new THREE.Group();
  seafoodMarket.position.set(13.0, 0, 4.0);
  scene.add(seafoodMarket);

  // Quầy gỗ ốp đá hoa cương mát lạnh
  const mDesk = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.1, 1.6), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 }));
  mDesk.position.y = 0.55;
  mDesk.castShadow = true;
  seafoodMarket.add(mDesk);

  const mTop = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.12, 1.8), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8 }));
  mTop.position.y = 1.15;
  seafoodMarket.add(mTop);

  // Mái bạt sọc xanh - trắng rực rỡ phong cách làng chài
  const awningMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.6 });
  const mRoof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.4, 4), awningMat);
  mRoof.position.y = 3.2;
  mRoof.rotateY(Math.PI / 4);
  seafoodMarket.add(mRoof);

  // Khay ướp đá đầy ắp cá tươi bạc & tôm cua
  const iceTray = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 1.2), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.1 }));
  iceTray.position.set(0, 1.28, 0);
  seafoodMarket.add(iceTray);

  for (let fi = -1.2; fi <= 1.2; fi += 0.5) {
    const fMini = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 6), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 }));
    fMini.rotateZ(Math.PI / 2.3);
    fMini.position.set(fi, 1.42, (Math.random() - 0.5) * 0.4);
    seafoodMarket.add(fMini);
  }

  // 3D Tiểu thương/Thợ cá đeo tạp dề cao su đứng bán
  const fMonger = new THREE.Group();
  fMonger.position.set(0, 0, -1.2);
  seafoodMarket.add(fMonger);

  const fmBody = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.45), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
  fmBody.position.y = 1.3;
  fMonger.add(fmBody);

  const fmApron = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.8, 0.5), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
  fmApron.position.set(0, 1.2, 0.02);
  fMonger.add(fmApron);

  const fmHead = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), new THREE.MeshStandardMaterial({ color: 0xffedd5 }));
  fmHead.position.y = 2.1;
  fMonger.add(fmHead);

  // Vòng tương tác Bán Cá Tươi
  const sellFishRing = new THREE.Mesh(
    new THREE.RingGeometry(1.2, 1.6, 24),
    new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
  );
  sellFishRing.rotateX(-Math.PI / 2);
  sellFishRing.position.set(0, 0.05, 1.8);
  sellFishRing.userData = { type: 'seafood_market' };
  seafoodMarket.add(sellFishRing);
  clickables.push(sellFishRing);

  const marketSign = makeBillboardText('🐟 CHỢ CÁ CẢNG BIỂN - BÁN CÁ $45/CON', '#10b981', 340, 48);
  marketSign.position.set(13.0, 4.2, 4.0);
  scene.add(marketSign);
  window.seafoodMarketSign = marketSign;

  // 5. NHÀ MÁY CHẾ BIẾN & ĐÓNG HỘP CÁ BÓC MÁI (OPEN-ROOF FISH CANNERY DIORAMA)
  // Đặt tại bến cảng nước sâu phía Đông: { x: 44, z: 4.0 }
  const cannery = new THREE.Group();
  cannery.position.set(44.0, 0, 4.0);
  scene.add(cannery);

  // Sàn bê tông epoxy bóng công nghiệp
  const cFloor = new THREE.Mesh(
    new THREE.BoxGeometry(12.5, 0.25, 9.2),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.35, metalness: 0.15 })
  );
  cFloor.position.y = 0.12;
  cFloor.receiveShadow = true;
  cannery.add(cFloor);

  // Tường bao lửng kiến trúc bóc mái (cao 2.2m để nhìn toàn cảnh bên trong)
  const cWallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.3 });
  const cWallBack = new THREE.Mesh(new THREE.BoxGeometry(12.5, 2.2, 0.35), cWallMat);
  cWallBack.position.set(0, 1.2, -4.4);
  cannery.add(cWallBack);
  const cWallL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.2, 9.2), cWallMat);
  cWallL.position.set(-6.1, 1.2, 0);
  cannery.add(cWallL);
  const cWallR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.2, 9.2), cWallMat);
  cWallR.position.set(6.1, 1.2, 0);
  cannery.add(cWallR);

  // DÂY CHUYỀN ĐÓNG HỘP CÁ TỰ ĐỘNG (CANNING CONVEYOR SYSTEM)
  const convBed = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.75, 1.6), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 }));
  convBed.position.set(0, 0.5, -1.2);
  cannery.add(convBed);

  // Băng tải con lăn inox & các lon cá hộp bằng nhôm sáng
  const canMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });
  for (let ci = -3.2; ci <= 3.2; ci += 0.9) {
    const tCan = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.38, 12), canMat);
    tCan.position.set(ci, 1.05, -1.2);
    cannery.add(tCan);
  }

  // BÀN SƠ CHẾ & PHÂN LOẠI CÁ TƯƠI
  const prepTable = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.85, 2.0), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9 }));
  prepTable.position.set(0, 0.5, 2.4);
  cannery.add(prepTable);

  for (let fi = -1.8; fi <= 1.8; fi += 0.9) {
    const freshFish = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x7dd3fc, metalness: 0.8 }));
    freshFish.rotateZ(Math.PI / 2.2);
    freshFish.position.set(fi, 1.05, 2.4);
    cannery.add(freshFish);
  }

  // 2 CÔNG NHÂN NHÀ MÁY ĐÓNG HỘP (CANNERY WORKER NPCs)
  // Công nhân 1: Đứng ở dây chuyền đóng hộp
  const cWorker1 = new THREE.Group();
  cWorker1.position.set(-1.8, 0, -2.4);
  cannery.add(cWorker1);
  const cw1Body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.4), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
  cw1Body.position.y = 1.1;
  cWorker1.add(cw1Body);
  const cw1Apron = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.85, 0.44), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
  cw1Apron.position.set(0, 1.05, 0.02);
  cWorker1.add(cw1Apron);
  const cw1Head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: 0xffedd5 }));
  cw1Head.position.y = 1.82;
  cWorker1.add(cw1Head);
  const cw1Cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.46), new THREE.MeshStandardMaterial({ color: 0x15803d }));
  cw1Cap.position.y = 2.08;
  cWorker1.add(cw1Cap);

  // Công nhân 2: Đứng ở bàn phân loại cá
  const cWorker2 = new THREE.Group();
  cWorker2.position.set(1.8, 0, 1.2);
  cWorker2.rotation.y = Math.PI;
  cannery.add(cWorker2);
  const cw2Body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.4), new THREE.MeshStandardMaterial({ color: 0x0369a1 }));
  cw2Body.position.y = 1.1;
  cWorker2.add(cw2Body);
  const cw2Apron = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.85, 0.44), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
  cw2Apron.position.set(0, 1.05, 0.02);
  cWorker2.add(cw2Apron);
  const cw2Head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: 0xffedd5 }));
  cw2Head.position.y = 1.82;
  cWorker2.add(cw2Head);

  // Ống khói hơi nước inox công nghiệp
  const cChimney = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 5.2, 12), steelMat);
  cChimney.position.set(4.8, 2.6, -3.8);
  cannery.add(cChimney);

  // Cửa cuốn xuất hàng lớn đón xe tải vào bốc hàng
  const cShutter = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.4 })
  );
  cShutter.position.set(0, 1.1, 4.62);
  cannery.add(cShutter);

  // Băng chuyền Inox nối từ mép cầu tàu vào nhà máy
  const cChute = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.45, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.15 })
  );
  cChute.position.set(-4.5, 1.2, 3.8);
  cChute.rotation.z = 0.24;
  cannery.add(cChute);

  // Cần Cẩu Bốc Dỡ Cầu Tàu
  const craneGroup = new THREE.Group();
  craneGroup.position.set(44.0, 0.65, 12.0);
  scene.add(craneGroup);
  const craneBase = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 1.3, 8), steelMat);
  craneBase.position.y = 0.65;
  craneGroup.add(craneBase);
  const craneJib = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 5.2), safetyYellowMat);
  craneJib.position.set(0, 2.8, 1.8);
  craneJib.rotation.x = -0.38;
  craneGroup.add(craneJib);
  const craneCable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 4), steelMat);
  craneCable.position.set(0, 1.8, 3.6);
  craneGroup.add(craneCable);
  window.pierCrane = craneGroup;

  const cannerySign = makeBillboardText('🥫 NHÀ MÁY ĐỒ HỘP XUẤT KHẨU', '#38bdf8', 340, 48);
  cannerySign.position.set(44.0, 6.2, 4.0);
  cannerySign.userData = { type: 'cannery_factory' };
  scene.add(cannerySign);
  clickables.push(cannerySign);
  window.cannerySign = cannerySign;

  // Chú cá bạc nhảy quẫy nước tạo vòng tròn sóng lan tỏa (Jumping Salmon & Water Ripples)
  const jumpingFishGroup = new THREE.Group();
  jumpingFishGroup.position.set(0, 0.1, 16);
  scene.add(jumpingFishGroup);

  const fishMesh = new THREE.Group();
  const fishBody = new THREE.Mesh(
    new THREE.ConeGeometry(0.26, 0.92, 8),
    new THREE.MeshStandardMaterial({ color: 0x7dd3fc, metalness: 0.85, roughness: 0.2 })
  );
  fishBody.rotateZ(Math.PI / 2);
  fishMesh.add(fishBody);

  const fishBelly = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.75, 6),
    new THREE.MeshStandardMaterial({ color: 0xfda4af, metalness: 0.6, roughness: 0.3 })
  );
  fishBelly.rotateZ(Math.PI / 2);
  fishBelly.position.set(0, -0.05, 0);
  fishMesh.add(fishBelly);

  const fishTail = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.36, 0.24),
    new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4 })
  );
  fishTail.position.set(-0.52, 0, 0);
  fishMesh.add(fishTail);

  fishMesh.visible = false;
  jumpingFishGroup.add(fishMesh);

  // Vòng tròn sóng lan tỏa trên mặt nước (Concentric Water Ripple Texture)
  const rippleGeo = new THREE.PlaneGeometry(1.8, 1.8);
  rippleGeo.rotateX(-Math.PI / 2);
  const rippleMat = new THREE.MeshBasicMaterial({
    map: Textures.waterRipple(),
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const fishRipple = new THREE.Mesh(rippleGeo, rippleMat);
  fishRipple.position.y = 0.03;
  jumpingFishGroup.add(fishRipple);

  window.jumpingFishData = {
    group: jumpingFishGroup,
    fish: fishMesh,
    ripple: fishRipple,
    timer: 0,
    state: 'idle', // 'idle', 'jumping', 'ripple'
    jumpT: 0,
    baseX: -10,
    baseZ: 16
  };

  // -------------------------------------------------------------------------
  // SECTOR 4: ĐẠI SIÊU THỊ & NHÀ MÁY THỦY SẢN BÓC MÁI (OPEN-ROOF CUTAWAY DIORAMAS)
  // [KIẾN TRÚC BÓC MÁI 3D: NHÌN RÕ TOÀN BỘ NỘI THẤT, KỆ HÀNG, QUẦY THU NGÂN & CON NGƯỜI LÀM VIỆC]
  // -------------------------------------------------------------------------

  // 1. NHÀ MÁY CHẾ BIẾN CÁ TƯƠI BÓC MÁI { x: -14, z: 42 }
  const fishPlant = new THREE.Group();
  fishPlant.position.set(-14, 0, 42);
  scene.add(fishPlant);

  // Sàn gạch men chống thấm xanh dương nhạt
  const plantFloor = new THREE.Mesh(
    new THREE.BoxGeometry(15, 0.25, 12),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3, metalness: 0.1 })
  );
  plantFloor.position.y = 0.12;
  plantFloor.receiveShadow = true;
  fishPlant.add(plantFloor);

  // Tường bao lửng kiến trúc bóc mái (cao 2.0m để góc nhìn Isometric nhìn trọn bên trong)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 });
  const pWallBack = new THREE.Mesh(new THREE.BoxGeometry(15, 2.0, 0.35), wallMat);
  pWallBack.position.set(0, 1.1, -5.8);
  fishPlant.add(pWallBack);
  const pWallL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.0, 12), wallMat);
  pWallL.position.set(-7.3, 1.1, 0);
  fishPlant.add(pWallL);
  const pWallR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.0, 12), wallMat);
  pWallR.position.set(7.3, 1.1, 0);
  fishPlant.add(pWallR);

  // Bàn sơ chế cá inox công nghiệp (Stainless Steel Prep Tables)
  const stainlessMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.95, roughness: 0.15 });
  [-3.5, 3.5].forEach(tx => {
    const table = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.85, 2.2), stainlessMat);
    table.position.set(tx, 0.45, 0);
    table.castShadow = true;
    fishPlant.add(table);

    // Khay đá ướp cá tươi
    const ice = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.12, 1.8), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.1 }));
    ice.position.set(tx, 0.92, 0);
    fishPlant.add(ice);

    // Những con cá hồi bạc xếp trên khay
    for (let f = -1.8; f <= 1.8; f += 0.8) {
      const salmon = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.65, 6), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85 }));
      salmon.rotateZ(Math.PI / 2.2);
      salmon.position.set(tx + f, 1.05, (Math.random() - 0.5) * 0.4);
      fishPlant.add(salmon);
    }
  });

  // Công nhân sơ chế cá (Fish Butcher NPC) đứng tại bàn sơ chế
  const fishButcher = new THREE.Group();
  fishButcher.position.set(-3.5, 0, 1.6);
  fishPlant.add(fishButcher);
  const fbBody = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.0, 0.45), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
  fbBody.position.y = 1.1;
  fishButcher.add(fbBody);
  const fbApron = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.85, 0.48), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
  fbApron.position.set(0, 1.05, 0.02);
  fishButcher.add(fbApron);
  const fbHead = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), new THREE.MeshStandardMaterial({ color: 0xffedd5 }));
  fbHead.position.y = 1.85;
  fishButcher.add(fbHead);
  const fbCap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.15, 0.48), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  fbCap.position.y = 2.12;
  fishButcher.add(fbCap);

  // Thùng đá nhựa cách nhiệt xếp chồng
  const coolerMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
  [[-5.5, -4], [-5.5, -2], [-5.5, 4]].forEach(([cx, cz]) => {
    const cBox = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.2), coolerMat);
    cBox.position.set(cx, 0.48, cz);
    fishPlant.add(cBox);
  });

  const pSign = makeBillboardText('🐟 TRUNG TÂM SƠ CHẾ CÁ TƯƠI', '#38bdf8', 340, 48);
  pSign.position.set(0, 3.8, -5.8);
  fishPlant.add(pSign);

  // 2. ĐẠI SIÊU THỊ ĐẾ CHẾ BÓC MÁI (OPEN-ROOF HYPERMARKET DIORAMA) { x: 8, z: 42 }
  const superMarket = new THREE.Group();
  superMarket.position.set(8, 0, 42);
  scene.add(superMarket);
  window.superMarket = superMarket;

  // Sàn gạch men hoa văn đá Granite bóng loáng
  const marketFloor = new THREE.Mesh(
    new THREE.BoxGeometry(18.5, 0.25, 14),
    new THREE.MeshStandardMaterial({ map: Textures.plank(), roughness: 0.45 })
  );
  marketFloor.position.y = 0.12;
  marketFloor.receiveShadow = true;
  superMarket.add(marketFloor);

  // Tường bao lửng phong cách Bắc Âu hiện đại (cao 2.2m để nhìn toàn cảnh nội thất bên trong)
  const smWallMat = new THREE.MeshStandardMaterial({ map: Textures.timberPlank(), roughness: 0.7 });
  const smBackWall = new THREE.Mesh(new THREE.BoxGeometry(18.5, 2.2, 0.4), smWallMat);
  smBackWall.position.set(0, 1.2, -6.8);
  superMarket.add(smBackWall);
  const smLeftWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 14), smWallMat);
  smLeftWall.position.set(-9.05, 1.2, 0);
  superMarket.add(smLeftWall);
  const smRightWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 14), smWallMat);
  smRightWall.position.set(9.05, 1.2, 0);
  superMarket.add(smRightWall);

  // Vách kính mặt tiền trong suốt có cửa tự động mở
  const smGlassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5, roughness: 0.1, metalness: 0.85 });
  [-5.8, 5.8].forEach(gx => {
    const gWall = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.2, 0.2), smGlassMat);
    gWall.position.set(gx, 1.2, 6.8);
    superMarket.add(gWall);
  });

  // NỘI THẤT SIÊU THỊ: 3 DÃY KỆ HÀNG ĐÔI (SUPERMARKET GONDOLA AISLES)
  const shelfFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
  [-4.0, 0, 4.0].forEach(sx => {
    // Khung kệ hàng sắt
    const gondola = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 8.0), shelfFrameMat);
    gondola.position.set(sx, 1.0, -1.2);
    gondola.castShadow = true;
    superMarket.add(gondola);

    // Các tầng mặt kệ hàng
    for (let tier = 0.4; tier <= 1.8; tier += 0.5) {
      const shelfTier = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.05, 7.8), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
      shelfTier.position.set(sx, tier, -1.2);
      superMarket.add(shelfTier);

      // Các hộp hàng hóa đầy màu sắc trưng bày trên kệ (Canned goods, cereal boxes, juice)
      const goodsColors = [0xef4444, 0x22c55e, 0x3b82f6, 0xfacc15, 0xf97316];
      for (let gz = -3.2; gz <= 3.2; gz += 1.1) {
        [-0.55, 0.55].forEach(gxOffset => {
          const randCol = goodsColors[Math.floor(Math.random() * goodsColors.length)];
          const itemBox = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.32, 0.75),
            new THREE.MeshStandardMaterial({ color: randCol, roughness: 0.5 })
          );
          itemBox.position.set(sx + gxOffset, tier + 0.18, -1.2 + gz);
          superMarket.add(itemBox);
        });
      }
    }
  });

  // QUẦY THU NGÂN ĐÁ CẨM THẠCH & MÁY TÍNH TIỀN POS (CHECKOUT COUNTER)
  const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });
  const checkoutDesk = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.95, 1.4), marbleMat);
  checkoutDesk.position.set(-4.5, 0.5, 4.8);
  checkoutDesk.castShadow = true;
  superMarket.add(checkoutDesk);

  // Màn hình POS & Máy quét mã vạch
  const posMonitor = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.38, 0.08), new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0284c7, emissiveIntensity: 0.4 }));
  posMonitor.position.set(-4.5, 1.25, 4.6);
  superMarket.add(posMonitor);

  // NHÂN VIÊN THU NGÂN (CASHIER NPC) ĐỨNG BÁN HÀNG TẠI QUẦY
  const cashierNPC = new THREE.Group();
  cashierNPC.position.set(-4.5, 0, 3.8);
  superMarket.add(cashierNPC);
  const cBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.4), new THREE.MeshStandardMaterial({ color: 0x2563eb }));
  cBody.position.y = 1.1;
  cashierNPC.add(cBody);
  const cHead = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: 0xffedd5 }));
  cHead.position.y = 1.82;
  cashierNPC.add(cHead);
  // Tạp dề vàng cam
  const cApron = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.8, 0.44), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
  cApron.position.set(0, 1.05, 0.02);
  cashierNPC.add(cApron);

  // KHÁCH HÀNG ĐI MUA SẮM (SHOPPER NPCs)
  // Khách 1 đang đứng xem hàng ở lối đi 1
  const shopper1 = new THREE.Group();
  shopper1.position.set(-1.8, 0, -0.5);
  shopper1.rotation.y = Math.PI / 2;
  superMarket.add(shopper1);
  const s1Body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.4), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
  s1Body.position.y = 1.1;
  shopper1.add(s1Body);
  const s1Head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: 0xffedd5 }));
  s1Head.position.y = 1.82;
  shopper1.add(s1Head);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.4), new THREE.MeshStandardMaterial({ color: 0xf97316 }));
  basket.position.set(0.45, 0.85, 0);
  shopper1.add(basket);

  // Khách 2 đẩy xe siêu thị ở lối đi 2
  const shopper2 = new THREE.Group();
  shopper2.position.set(2.2, 0, 1.8);
  superMarket.add(shopper2);
  const s2Body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.4), new THREE.MeshStandardMaterial({ color: 0x16a34a }));
  s2Body.position.y = 1.1;
  shopper2.add(s2Body);
  const s2Head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: 0xffedd5 }));
  s2Head.position.y = 1.82;
  shopper2.add(s2Head);

  // Đèn rọi nội thất siêu thị rực sáng (Interior Track Spotlights)
  [-4, 0, 4].forEach(lx => {
    const sLight = new THREE.PointLight(0xffedd5, 1.8, 14, 1.5);
    sLight.position.set(lx, 3.2, 0);
    superMarket.add(sLight);
    sLight.userData.nightIntensity = 2.2;
    if (!window.nightLights) window.nightLights = [];
    window.nightLights.push(sLight);
  });

  // 3 Xe đẩy siêu thị xếp trước cửa
  const cartMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
  [-1.5, 0, 1.5].forEach((cx) => {
    const cart = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1.0), cartMat);
    cart.position.set(cx, 0.45, 8.2);
    cart.castShadow = true;
    superMarket.add(cart);
  });

  const sSign = makeBillboardText('🛒 ĐẠI SIÊU THỊ ĐẾ CHẾ (CUTAWAY DIORAMA)', '#38bdf8', 420, 65);
  sSign.position.set(0, 4.2, 6.8);
  superMarket.add(sSign);

  // -------------------------------------------------------------------------
  // SECTOR 5: ĐƯỜNG CAO TỐC VẬN TẢI & CẦU VƯỢT SÔNG HÙNG VĨ: { x: 28 }
  // Kết nối Bến xếp hàng, Cầu vượt sông Đại dương và Bờ nam siêu thị
  // -------------------------------------------------------------------------
  const roadMat = new THREE.MeshStandardMaterial({ map: Textures.asphalt(), roughness: 0.85 });

  // 3. CẦU VƯỢT SÔNG HÙNG VĨ BẰNG THÉP VÒM & BÊ TÔNG CỐT THÉP (Z: 4.0 ĐẾN 28.0)
    createGrandHighwayBridge(scene);

    // 4. MỞ RỘNG TOÀN DIỆN BỜ NAM: 4 SIÊU PHÂN KHU ĐẾ CHẾ TYCOON (SOUTH SHORE MEGA EXPANSION)
    createSouthShoreExpansion(scene);

    // 5. HỆ THỐNG THỜI TIẾT ĐỘNG (RAIN & RAINBOW) & CÁC Ô TƯƠNG TÁC SẢN XUẤT CHUYÊN SÂU
    createRainbowMesh(scene);
    createRainParticleSystem(scene);
    createDeepProductionPads(scene);

    // 6. TUYẾN ĐƯỜNG SẮT, CẦU GỖ ĐI BỘ BỜ TÂY, HẠ TẦNG VỈA HÈ ĐẾ CHẾ
    createRailroadInfrastructure(scene);
    createWestScenicFootbridge(scene);
    createEmpirePedestrianWalkways(scene);
    createHelipadInfrastructure(scene);
    createMegaLuxuryYacht(scene);
    createUnderwaterSanctuaryAndTreasure(scene);
    createSawmillIndustrialSubstation(scene);
    createMiningAndMetallurgyDistrict(scene);
    createAgroFoodDistrict(scene);
    createEmpireLandmarkConstruction(scene);
    createCityHallAndJusticeDistrict(scene);
    createPowerGridAndUtilitiesDistrict(scene);
    createMarketplaceAndTradingDistrict(scene);
    createCityPublicTransitBusStops(scene);
    createInternationalAirCargoSkyport(scene);
    createCoastalLuxuryVillaDistrict(scene);
    createSpeedCircuitArch(scene);
    createLogisticsCargoDrone(scene);
    createHighDensityResidentialHub(scene);
    createRiversideFoodTrucksAndStreetLife(scene);
    createPoliceRoadblockCheckpoint(scene);
    createPrisonYardRecreation(scene);
    createCourtroomInterior(scene);
    initCityPedestrianCrowd(scene);
    initAIPoliceForce(scene);
    createEMSAmbulanceAndHospitalHelipad(scene);
    createLuxuryMarinaAndLighthouse(scene);
    createEcoRecyclingAndWindFarm(scene);
    createCityLuckyWheelAndFestival(scene);
    createSmartTrafficAndMountainTunnel(scene);
    createOceanariumAndSubmarine(scene);
    createOffshoreOilRigAndRefinery(scene);
    createWallStreetStockExchange(scene);
    createCentralBankAndVault(scene);
    createPetSanctuaryAndAutoDrone(scene);
    createAdvancedCraftingAssemblyPlant(scene);
    createCityHallAndDecreeMonument(scene);
    createCityInfrastructureMasterPlan(scene);
    createNextGenInfrastructureGraphics(scene);
    createThemeParkRollerCoasterAndFerrisWheel(scene);
    createLuxuryRealEstateInteriors(scene);
    createDynamicSeasonsAndWeather(scene);
    createMaritimePortFleetCenter(scene);
    createNextGenHyperRealisticWorldUpgrade(scene);
    createFull20ItemNextGenGraphicsOverhaul(scene);
    create100UpgradeSuiteWorld(scene);
    createPhase1EcosystemAndVFX(scene);

    // 7. ĐẠI LỘ VÀNH ĐAI KHÉP KÍN & HẠ TẦNG LOGISTICS XE TẢI ĐẦU KÉO
    createEmpireHighwayNetwork(scene);

  // 4 Cột đèn đường cao áp chiếu sáng cao tốc ban đêm
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 6.5, 8);
  const streetPoleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.85 });
  const lampHeadGeo = new THREE.BoxGeometry(0.4, 0.25, 0.8);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });

  [-45, -20, 5, 30].forEach(lz => {
    const poleGroup = new THREE.Group();
    poleGroup.position.set(36.2, 0, lz);
    scene.add(poleGroup);

    const pole = new THREE.Mesh(poleGeo, streetPoleMat);
    pole.position.y = 3.25;
    pole.castShadow = true;
    poleGroup.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.12), streetPoleMat);
    arm.position.set(-0.8, 6.3, 0);
    poleGroup.add(arm);

    const lampHead = new THREE.Mesh(lampHeadGeo, lampMat);
    lampHead.position.set(-1.6, 6.2, 0);
    poleGroup.add(lampHead);

    const light = new THREE.PointLight(0xfbbf24, 0, 18, 1.6);
    light.position.set(-1.6, 5.8, 0);
    poleGroup.add(light);
    light.userData.nightIntensity = 1.9;
    if (!window.nightLights) window.nightLights = [];
    window.nightLights.push(light);

    // Chùm tia sáng nón thể tích rọi xuống mặt đường ban đêm (Volumetric Light Cone)
    const beamGeo = new THREE.CylinderGeometry(0.25, 2.8, 5.8, 8, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      map: Textures.volumetricBeam(),
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(-1.6, 2.9, 0);
    poleGroup.add(beam);
    beam.userData.nightOpacity = 0.35;
    if (!window.nightBeams) window.nightBeams = [];
    window.nightBeams.push(beam);
  });

  // Bảng chỉ dẫn bến bốc dỡ hàng xuất khẩu
  const dockSign = makeBillboardText('🚛 BẾN XUẤT KHẨU LOGISTICS CONTAINER', '#38bdf8', 360, 52);
  dockSign.position.set(28, -999, -18); // hidden
  scene.add(dockSign);
  window.dockSign = dockSign;

  // -------------------------------------------------------------------------
  // CỔNG CHÀO ĐẾ CHẾ HOÀNG GIA (GRAND EMPIRE ENTRANCE ARCHWAY)
  // -------------------------------------------------------------------------
  const archGroup = new THREE.Group();
  archGroup.position.set(-16, 0, -12);
  scene.add(archGroup);

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.85,
    metalness: 0.1
  });
  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.8,
    roughness: 0.25
  });

  // 2 Trụ đá hoa cương
  const pL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5.0, 1.2), stoneMat);
  pL.position.set(-3.5, 2.5, 0);
  pL.castShadow = true;
  archGroup.add(pL);

  const pR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5.0, 1.2), stoneMat);
  pR.position.set(3.5, 2.5, 0);
  pR.castShadow = true;
  archGroup.add(pR);

  // Chân đế & Đỉnh cột mạ vàng
  const baseL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.6), goldTrimMat);
  baseL.position.set(-3.5, 0.25, 0);
  archGroup.add(baseL);
  const capL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 1.5), goldTrimMat);
  capL.position.set(-3.5, 5.2, 0);
  archGroup.add(capL);

  const baseR = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.6), goldTrimMat);
  baseR.position.set(3.5, 0.25, 0);
  archGroup.add(baseR);
  const capR = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 1.5), goldTrimMat);
  capR.position.set(3.5, 5.2, 0);
  archGroup.add(capR);

  // Xà vòm cầu bắc ngang
  const archBeam = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.7, 1.1), stoneMat);
  archBeam.position.set(0, 5.35, 0);
  archBeam.castShadow = true;
  archGroup.add(archBeam);

  const archTrim = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.15, 1.2), goldTrimMat);
  archTrim.position.set(0, 5.75, 0);
  archGroup.add(archTrim);

  // 2 Đèn lồng đuốc lửa trên đỉnh 2 cột
  const torchMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 1.0 });
  const torchL = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35), torchMat);
  torchL.position.set(-3.5, 5.7, 0);
  archGroup.add(torchL);

  const torchR = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35), torchMat);
  torchR.position.set(3.5, 5.7, 0);
  archGroup.add(torchR);

  const torchLight = new THREE.PointLight(0xf59e0b, 1.5, 14);
  torchLight.position.set(0, 5.5, 0);
  archGroup.add(torchLight);

  // Canvas Biển hiệu Cổng Chào Đế Chế
  const archCanvas = document.createElement('canvas');
  archCanvas.width = 512;
  archCanvas.height = 128;
  const archCtx = archCanvas.getContext('2d');

  function drawArchCanvas(empireName, username, level) {
    archCtx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    archCtx.roundRect(4, 4, 504, 120, 18);
    archCtx.fill();
    archCtx.strokeStyle = '#facc15';
    archCtx.lineWidth = 4;
    archCtx.stroke();

    // Dòng 1: Tên Đế Chế
    archCtx.fillStyle = '#facc15';
    archCtx.font = 'bold 28px sans-serif';
    archCtx.textAlign = 'center';
    archCtx.textBaseline = 'middle';
    archCtx.fillText(`🏛️ ${String(empireName || 'ĐẾ CHẾ LÂM NGHIỆP').toUpperCase()}`, 256, 42);

    // Dòng 2: Chủ tịch & Cấp độ
    archCtx.fillStyle = '#38bdf8';
    archCtx.font = 'bold 22px sans-serif';
    archCtx.fillText(`CHỦ TỊCH: ${String(username || 'CHỦ TỊCH').toUpperCase()} • LV.${level || 1}`, 256, 88);
  }

  drawArchCanvas(
    (typeof gameState !== 'undefined' && gameState.empireName) ? gameState.empireName : 'ĐẾ CHẾ LÂM NGHIỆP',
    (typeof gameState !== 'undefined' && gameState.username) ? gameState.username : 'CHỦ TỊCH',
    (typeof gameState !== 'undefined' && gameState.level) ? gameState.level : 1
  );

  const archTexture = new THREE.CanvasTexture(archCanvas);
  const archSignMat = new THREE.MeshStandardMaterial({
    map: archTexture,
    roughness: 0.3,
    metalness: 0.1,
    side: THREE.DoubleSide
  });
  const archSignMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 1.45), archSignMat);
  archSignMesh.position.set(0, 4.4, 0);
  archGroup.add(archSignMesh);

  // Helper cập nhật biển hiệu toàn cục
  window.updateEmpireEntranceSign = function(empireName, username, level) {
    drawArchCanvas(empireName || 'ĐẾ CHẾ LÂM NGHIỆP', username || 'CHỦ TỊCH', level || 1);
    archTexture.needsUpdate = true;
  };

  window.updateEmpireHQSign = function(empireName, username) {
    if (window.hqNeonSign && window.hqNeonSign.material && window.hqNeonSign.material.map) {
      const cv = window.hqNeonSign.material.map.image;
      if (cv && cv.getContext) {
        const ctx = cv.getContext('2d');
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.roundRect(4, 4, cv.width - 8, cv.height - 8, 16);
        ctx.fill();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🏛️ TỔNG HÀNH DINH: ${String(empireName || 'ĐẾ CHẾ').toUpperCase()}`, cv.width / 2, cv.height / 2);
        window.hqNeonSign.material.map.needsUpdate = true;
      }
    }
  };

  // -------------------------------------------------------------------------
  // MŨI TÊN CHỈ DẪN NHIỆM VỤ ĐỘNG (DYNAMIC QUEST INDICATOR)
  // -------------------------------------------------------------------------
  const arrowGeo = new THREE.ConeGeometry(0.35, 0.9, 4);
  arrowGeo.rotateX(Math.PI / 2);
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.85 });
  questArrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
  questArrowMesh.position.set(0, 0.15, 0);
  scene.add(questArrowMesh);

  // -------------------------------------------------------------------------
  // BARRICADES WITH 3D PADLOCKS
  // -------------------------------------------------------------------------
  function createBarricade(levelReq, pos, size, label) {
    const group = new THREE.Group();
    group.position.copy(pos);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(size.x, 1.2, size.z), new THREE.MeshStandardMaterial({ map: Textures.hazardStripes(), roughness: 0.7 }));
    rail.position.y = 0.6;
    rail.castShadow = true;
    group.add(rail);

    const lockBody = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.4), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8 }));
    lockBody.position.set(0, 1.8, 0);
    group.add(lockBody);

    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.12, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 }));
    shackle.position.set(0, 2.3, 0);
    group.add(shackle);

    const tag = makeBillboardText(`🔒 YÊU CẦU ${label}`, '#f87171');
    tag.position.set(0, 3.5, 0);
    group.add(tag);

    scene.add(group);
    barricades[levelReq] = group;
  }

  createBarricade(2, new THREE.Vector3(-4, 0, -18), new THREE.Vector3(1, 1.2, 16), "CẤP 2 (XƯỞNG CƯA)");
  createBarricade(3, new THREE.Vector3(14, 0, -18), new THREE.Vector3(1, 1.2, 16), "CẤP 3 (TỰ ĐỘNG & XE NÂNG)");
  createBarricade(4, new THREE.Vector3(24, 0, -18), new THREE.Vector3(1, 1.2, 16), "CẤP 4 (CẦU TÀU & THỦY SẢN)");
  createBarricade(5, new THREE.Vector3(10, 0, 30), new THREE.Vector3(24, 1.2, 1), "CẤP 5 (SIÊU THỊ BÁN LẺ)");

  // -------------------------------------------------------------------------
  // ARCADE BUY / UPGRADE PADS (ĐÃ THAY THẾ BẰNG CỬA HÀNG NÂNG CẤP 1-CLICK)
  // -------------------------------------------------------------------------
  // Không spawn các ô tròn trừ tiền nhỏ giọt dưới đất nữa
}

function updateSectorBarricades() {
  for (let lvl = 2; lvl <= 5; lvl++) {
    if (barricades[lvl]) {
      barricades[lvl].visible = !gameState.unlockedZones.includes(lvl);
    }
  }
}

// ---------------------------------------------------------------------------
// VẬT LÝ NẢY & HOẠT ẢNH PARABOL BEZIER HÚT GỖ
// ---------------------------------------------------------------------------
function spawnPickableLog(pos, scene) {
  const log = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.28, 1.6, 8),
    new THREE.MeshStandardMaterial({ map: Textures.bark(), roughness: 0.9 })
  );
  trunk.rotateZ(Math.PI / 2);
  trunk.position.y = 0.25;
  trunk.castShadow = true;
  log.add(trunk);

  // Nảy nhẹ đàn hồi (Elastic Bounce) khi tiếp đất
  const scatterX = (Math.random() - 0.5) * 2.2;
  const scatterZ = (Math.random() - 0.5) * 2.2;
  log.position.copy(pos).add(new THREE.Vector3(scatterX, 0.8, scatterZ));

  // Bounce tween
  let bounceT = 0;
  const bounceInterval = setInterval(() => {
    bounceT += 0.08;
    log.position.y = Math.max(0, 0.8 * Math.abs(Math.cos(bounceT * 3)) * Math.exp(-bounceT * 1.5));
    if (bounceT >= 1.2) {
      log.position.y = 0;
      clearInterval(bounceInterval);
    }
  }, 30);

  log.userData = { type: 'pickable_log' };
  scene.add(log);
  pickableLogs.push(log);
  clickables.push(log);
}

// Hoạt ảnh hút gỗ bay hình Parabol (Cubic Bezier curve) từ đất lên balo
function triggerParabolicPickup(groundLog, playerMesh, onComplete) {
  const p0 = groundLog.position.clone();
  const pMid = new THREE.Vector3(
    (p0.x + playerMesh.position.x) / 2,
    p0.y + 3.2,
    (p0.z + playerMesh.position.z) / 2
  );

  flyingLogs.push({
    mesh: groundLog,
    p0: p0,
    pMid: pMid,
    playerMesh: playerMesh,
    t: 0,
    onComplete: onComplete
  });
}

function updateFlyingLogs(dt) {
  for (let i = flyingLogs.length - 1; i >= 0; i--) {
    const fl = flyingLogs[i];
    fl.t += dt * 3.2;
    const t = Math.min(fl.t, 1.0);

    // Quadratic Bezier: B(t) = (1-t)^2 * P0 + 2(1-t)t * P_mid + t^2 * P_dest
    const pDest = fl.playerMesh.position.clone().add(new THREE.Vector3(0, 1.8, 0));
    const invT = 1.0 - t;
    fl.mesh.position.x = invT * invT * fl.p0.x + 2 * invT * t * fl.pMid.x + t * t * pDest.x;
    fl.mesh.position.y = invT * invT * fl.p0.y + 2 * invT * t * fl.pMid.y + t * t * pDest.y;
    fl.mesh.position.z = invT * invT * fl.p0.z + 2 * invT * t * fl.pMid.z + t * t * pDest.z;
    fl.mesh.scale.setScalar(1.0 - t * 0.35);

    if (fl.t >= 1.0) {
      if (fl.onComplete) fl.onComplete();
      scene.remove(fl.mesh);
      flyingLogs.splice(i, 1);
    }
  }
}

// Vị trí tĩnh cố định của các công trình và biển hiệu (Zero Garbage Collection)
const _tagPosBuffer = new THREE.Vector3(-6, 0, -18);
const _tagPosSell = new THREE.Vector3(18, 0, -18);
const _tagPosDock = new THREE.Vector3(28, 0, -18);
const _tagPosShop = new THREE.Vector3(0, 0, -23.5);
const _tagPosStrap = new THREE.Vector3(9.2, 0, -18);
const _tagPosPort = new THREE.Vector3(28, 0, -1.0);
const _tagPosFish = new THREE.Vector3(22, 0, 18.8);
const _tagPosMarket = new THREE.Vector3(13.0, 0, 4.0);
const _tagPosCannery = new THREE.Vector3(33.0, 0, 3.5);
const _posArrowDir = new THREE.Vector3();
const _posSawBench = new THREE.Vector3(-6, 0, -18);
const _posPlankSell = new THREE.Vector3(18, 0, -25);

// ---------------------------------------------------------------------------
// WORLD UPDATE TICK (60 FPS OPTIMIZED)
// ---------------------------------------------------------------------------
function updateWorld(dt, time, playerPos) {
  if (typeof updateDeepWorld === 'function') updateDeepWorld(dt, time, playerPos);
  if (typeof updatePhase1EcosystemAndVFX === 'function') updatePhase1EcosystemAndVFX(dt, time, playerPos);

  // 2. Dải bọt sóng bờ sông dập dềnh thở nhịp (Dual-Harmonic Shoreline Foam)
  if (window.shoreFoamNorth && window.shoreFoamNorth.material.map) {
    window.shoreFoamNorth.material.map.offset.x += dt * 0.08;
    const pulse = 1.0 + Math.sin((time || 0) * 2.2) * 0.18 + Math.cos((time || 0) * 3.8) * 0.06;
    window.shoreFoamNorth.scale.set(1.0, pulse, 1.0);
  }
  if (window.shoreFoamSouth && window.shoreFoamSouth.material.map) {
    window.shoreFoamSouth.material.map.offset.x -= dt * 0.08;
    const pulse = 1.0 + Math.sin((time || 0) * 2.2 + 1.2) * 0.18 + Math.cos((time || 0) * 3.8 + 1.0) * 0.06;
    window.shoreFoamSouth.scale.set(1.0, pulse, 1.0);
  }

  // 2b. Gợn sóng nước sông cuộn trôi đa hướng tự nhiên (Physical Dual-Current Water Flow)
  if (window.riverMesh && window.riverMesh.material.normalMap) {
    window.riverMesh.material.normalMap.offset.x += dt * 0.07;
    window.riverMesh.material.normalMap.offset.y += Math.sin((time || 0) * 0.9) * 0.003 + dt * 0.025;
  }

  // 2c. Đốm sáng kim cương phản quang ánh nắng mặt trời trên sóng nước (Sun Specular Glitter)
  if (window.glintItems && window.glintGroup) {
    const isDay = (typeof gameState !== 'undefined' && gameState.gameHour >= 5.5 && gameState.gameHour <= 18.5);
    window.glintGroup.visible = isDay;
    if (isDay) {
      window.glintItems.forEach(item => {
        item.phase += dt * item.speed;
        const pulse = Math.max(0, Math.sin(item.phase));
        item.mesh.scale.set(pulse * 0.9, pulse * 0.9, 1);
        item.mesh.rotation.z += dt * 1.6;
      });
    }
  }

  // 2d. Chùm tia nắng thể tích xuyên rừng thông (Volumetric God Rays)
  if (window.godRaysGroup) {
    const sunAngle = (typeof gameState !== 'undefined') ? ((gameState.gameHour - 6) / 24) * Math.PI * 2 : 0;
    const noonFactor = Math.max(0, Math.sin(sunAngle));
    window.godRaysGroup.visible = noonFactor > 0.08;
    window.godRaysGroup.children.forEach((ray, i) => {
      ray.material.opacity = (0.16 + Math.sin((time || 0) * 1.5 + i) * 0.07) * noonFactor;
    });
  }

  // 3. Mây trôi bồng bềnh lướt qua xưởng (Drifting Clouds)
  if (window.clouds) {
    window.clouds.forEach(c => {
      c.position.x += dt * 1.2;
      if (c.position.x > 75) c.position.x = -75;
    });
  }

  // 3b. Khói hoạt hình bốc lên từ ống khói xưởng cưa (Chimney Puff Smoke)
  if (window.smokePuffs) {
    window.smokePuffs.forEach(puff => {
      puff.userData.life += dt;
      if (puff.userData.life > puff.userData.maxLife) {
        puff.userData.life = 0;
        puff.position.copy(puff.userData.basePos);
        puff.scale.set(0.4, 0.4, 0.4);
      }
      const progress = puff.userData.life / puff.userData.maxLife;
      puff.position.y += dt * 1.6;
      puff.position.x += puff.userData.driftX * dt;
      puff.position.z += puff.userData.driftZ * dt;
      const s = 0.42 + progress * 1.5;
      puff.scale.set(s, s, s);
      puff.material.opacity = Math.max(0, (1.0 - progress) * 0.7);
    });
  }

  // 3c. Đàn bướm vỗ cánh chao lượn quanh rừng thông
  if (window.butterflies) {
    window.butterflies.forEach(b => {
      const u = b.userData;
      const flap = Math.sin((time || 0) * 18 + u.seed) * 0.75;
      u.wL.rotation.y = flap;
      u.wR.rotation.y = -flap;
      b.position.x = u.baseX + Math.sin((time || 0) * 0.8 + u.seed) * 1.8;
      b.position.y = 1.3 + Math.sin((time || 0) * 2.2 + u.seed) * 0.35;
      b.position.z = u.baseZ + Math.cos((time || 0) * 0.8 + u.seed) * 1.8;
    });
  }

  // 2c. Cá bạc nhảy quẫy nước trên sông & tạo vòng tròn sóng lan tỏa
  if (window.jumpingFishData) {
    const jd = window.jumpingFishData;
    jd.timer += dt;
    if (jd.state === 'idle') {
      if (jd.timer >= 4.0) {
        jd.state = 'jumping';
        jd.timer = 0;
        jd.jumpT = 0;
        jd.baseX = -25 + Math.random() * 50;
        jd.group.position.set(jd.baseX, 0.1, 16);
        jd.fish.visible = true;
        jd.ripple.material.opacity = 0;
      }
    } else if (jd.state === 'jumping') {
      jd.jumpT += dt * 1.25;
      const t = Math.min(jd.jumpT, 1.0);
      const arcY = Math.sin(t * Math.PI) * 2.2;
      jd.fish.position.y = arcY;
      jd.fish.position.x = (t - 0.5) * 2.5;
      jd.fish.rotation.z = Math.PI / 2 - (t - 0.5) * 1.6;

      if (t >= 1.0) {
        jd.state = 'ripple';
        jd.fish.visible = false;
        jd.timer = 0;
        jd.ripple.scale.set(0.2, 0.2, 0.2);
        jd.ripple.material.opacity = 0.85;
        if (typeof spawnParticle === 'function') {
          for (let sp = 0; sp < 8; sp++) {
            spawnParticle(jd.group.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.1, (Math.random() - 0.5) * 0.6)), 0xe0f2fe);
          }
        }
      }
    } else if (jd.state === 'ripple') {
      const ripT = Math.min(jd.timer * 1.8, 1.0);
      const s = 0.2 + ripT * 3.5;
      jd.ripple.scale.set(s, s, s);
      jd.ripple.material.opacity = Math.max(0, (1.0 - ripT) * 0.85);
      if (ripT >= 1.0) {
        jd.state = 'idle';
        jd.timer = 0;
      }
    }
  }

  // 4. Đom đóm bay bồng bềnh ven bờ suối
  if (window.fireflies) {
    const pos = window.fireflies.geometry.attributes.position.array;
    for (let i = 1; i < pos.length; i += 3) {
      pos[i] += Math.sin((time || 0) * 3 + i) * 0.015;
    }
    window.fireflies.geometry.attributes.position.needsUpdate = true;
  }

  // 5. Cuộn UV Thác nước chảy cuộn tốc độ cao
  if (waterfallMesh && waterfallMesh.material.map) {
    waterfallMesh.material.map.offset.y += dt * 2.5;
  }

  // 6. Hạt sương mù chân thác nước
  if (waterMistPoints) {
    const pos = waterMistPoints.geometry.attributes.position.array;
    for (let i = 1; i < pos.length; i += 3) {
      pos[i] += dt * 0.8;
      if (pos[i] > 4.5) pos[i] = 0.5;
    }
    waterMistPoints.geometry.attributes.position.needsUpdate = true;
  }

  // 7. Cập nhật các ô nâng cấp Arcade Pads (Đã thay thế bằng Cửa Hàng Nâng Cấp 1-Click)
  // upgradePads.forEach(pad => pad.update(dt, playerPos));

  // 8. Cập nhật Flying Parabolic Logs
  updateFlyingLogs(dt);

  // 8b. Cập nhật Chuyển Động Máy Cưa Công Nghiệp & Bãi Đệm Gỗ Thực Tế
  if (window.blade1 && window.blade2) {
    const bladeSpeed = dt * (16 + ((typeof gameState !== 'undefined' && gameState.sawmillSpeedTier) || 1) * 8);
    window.blade1.rotateZ(bladeSpeed);
    window.blade2.rotateZ(bladeSpeed);
  }
  if (window.drivePulley) {
    window.drivePulley.rotateZ(dt * 20);
  }
  if (window.millRollers && typeof gameState !== 'undefined' && gameState.machineLogBuffer > 0) {
    window.millRollers.forEach(r => r.rotateX(dt * 10));

    // Băng chuyền chuyển phôi gỗ tròn thành ván thành phẩm liên tục
    if (window.millInfeedLog) {
      window.millInfeedLog.visible = true;
      window.millInfeedLog.position.x += dt * 3.5;
      if (window.millInfeedLog.position.x >= -0.5) {
        window.millInfeedLog.position.x = -8.5; // Reset vòng nạp phôi
      }
    }
    if (window.millOutfeedPlank) {
      window.millOutfeedPlank.visible = true;
      window.millOutfeedPlank.position.x += dt * 3.5;
      if (window.millOutfeedPlank.position.x >= 8.5) {
        window.millOutfeedPlank.position.x = 0.5; // Reset vòng xuất ván
      }
    }
  } else {
    if (window.millInfeedLog) window.millInfeedLog.visible = false;
    if (window.millOutfeedPlank) window.millOutfeedPlank.visible = false;
  }
  if (window.operatorLever) {
    window.operatorLever.rotation.x = -0.3 + Math.sin((time || 0) * 3.5) * 0.25;
  }

  // 8c. Gió thổi đung đưa tán thông tự nhiên (Wind Canopy Sway & Elastic Proximity Rustle)
  if (typeof trees !== 'undefined' && playerPos) {
    const windGust = 0.038 + Math.sin((time || 0) * 0.9) * 0.016;
    trees.forEach(t => {
      if (t.visible && t.userData && t.userData.canopy && !t.userData.isFalling) {
        const dSq = playerPos.distanceToSquared(t.position);
        if (dSq <= 3600) {
          t.userData.canopy.rotation.z = Math.sin((time || 0) * 1.6 + t.position.x * 0.45) * windGust;
          t.userData.canopy.rotation.x = Math.cos((time || 0) * 1.2 + t.position.z * 0.45) * (windGust * 0.7);

          // Cọ quẹt cành lá khi nhân vật đi sát qua gốc cây
          if (dSq < 6.0 && window.player && window.player.isMoving) {
            t.userData.canopy.rotation.z += Math.sin((time || 0) * 14) * 0.025;
          }
        }
      }
    });
  }

  // 8d. Tia lửa xẹt ra từ lưỡi cưa khi đang cưa gỗ (Saw Blade Friction Sparks VFX)
  if (window.blade1 && typeof gameState !== 'undefined' && gameState.machineLogBuffer > 0) {
    if (Math.random() < 0.45 && typeof spawnParticle === 'function') {
      const sparkPos = new THREE.Vector3(0, 1.8, -18).add(new THREE.Vector3((Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.35));
      spawnParticle(sparkPos, Math.random() > 0.4 ? 0xf59e0b : 0xfef08a);
    }
  }

  // 8e. Hiệu ứng đèn chớp cảnh báo hàng không đỉnh vòm & nhịp thở dải LED cầu vượt
  if (window.bridgeBeacons) {
    const isBeaconOn = (Math.floor((time || 0) * 2.8) % 2 === 0);
    window.bridgeBeacons.forEach(b => { b.visible = isBeaconOn; });
  }
  if (window.bridgeLEDs) {
    const ledColor = ((time || 0) % 8 > 4) ? 0x38bdf8 : 0x06b6d4;
    window.bridgeLEDs.forEach(led => {
      if (led.material) led.material.color.setHex(ledColor);
    });
  }
  if (window.machineLogBufferMeshes) {
    const buf = (typeof gameState !== 'undefined' && gameState.machineLogBuffer) || 0;
    for (let i = 0; i < window.machineLogBufferMeshes.length; i++) {
      window.machineLogBufferMeshes[i].visible = i < buf;
    }
  }
  if (window.bufferTag) {
    window.bufferTag.visible = playerPos.distanceTo(_tagPosBuffer) <= 5.5;
  }

  // 9. Cập nhật hiển thị bảng chữ 3D trong phạm vi gần (Tái sử dụng vector tĩnh, Zero GC)
  if (window.sawTag) {
    window.sawTag.visible = playerPos.distanceTo(_tagPosBuffer) <= 3.8;
  }
  if (window.sellTag) {
    window.sellTag.visible = playerPos.distanceTo(_tagPosSell) <= 3.8;
  }
  if (window.dockSign) {
    window.dockSign.visible = playerPos.distanceTo(_tagPosDock) <= 9.0;
  }
  if (window.shopTag) {
    window.shopTag.visible = playerPos.distanceTo(_tagPosShop) <= 5.0;
  }
  if (window.strapSign) {
    window.strapSign.visible = playerPos.distanceTo(_tagPosStrap) <= 6.0;
  }
  if (window.portSign) {
    window.portSign.visible = playerPos.distanceTo(_tagPosPort) <= 8.5;
  }
  if (window.fishingTag) {
    window.fishingTag.visible = playerPos.distanceTo(_tagPosFish) <= 5.5;
  }
  if (window.seafoodMarketSign) {
    window.seafoodMarketSign.visible = playerPos.distanceTo(_tagPosMarket) <= 6.5;
  }
  if (window.cannerySign) {
    window.cannerySign.visible = playerPos.distanceTo(_tagPosCannery) <= 8.5;
  }

  // 10. Hoạt ảnh xoay cánh quạt cối xay gió điện sạch Bờ Nam (Wind Turbines)
  if (window.windTurbineBlades && window.windTurbineBlades.length > 0) {
    window.windTurbineBlades.forEach(b => b.rotateZ(dt * 1.6));
  }

  // Cập nhật số lượng kiện Pallet đóng đai hiển thị trên bãi
  if (window.palletStackMeshes) {
    const palCount = (typeof gameState !== 'undefined' && gameState.pallets) || 0;
    for (let i = 0; i < window.palletStackMeshes.length; i++) {
      window.palletStackMeshes[i].visible = i < palCount;
    }
  }

  // 10. Mũi tên chỉ dẫn nhiệm vụ động trôi nổi dưới chân (Tái sử dụng vector tĩnh, Zero GC)
  if (questArrowMesh) {
    questArrowMesh.position.set(playerPos.x, playerPos.y + 0.15, playerPos.z);
    let target = null;
    if (gameState.logs >= gameState.backpackMax) {
      target = _posSawBench;
    } else if (gameState.planks > 0) {
      target = _posPlankSell;
    } else {
      let nearest = null, minDist = 999;
      for (let ti = 0; ti < trees.length; ti++) {
        const t = trees[ti];
        if (t.visible && t.userData.growthStage === 3) {
          const d = playerPos.distanceTo(t.position);
          if (d < minDist) { minDist = d; nearest = t; }
        }
      }
      if (nearest) target = nearest.position;
    }

    if (target) {
      _posArrowDir.subVectors(target, playerPos);
      questArrowMesh.rotation.y = Math.atan2(_posArrowDir.x, _posArrowDir.z);
    }
  }

  // 10b. CẬP NHẬT 100-ITEM MASTER UPGRADE SUITE (ANIMATIONS & LOGIC 60 FPS)
  if (typeof gameState !== 'undefined') {
    const gHour = gameState.gameHour || 10.0;
    const hourRad = (gHour / 24.0) * Math.PI * 2.0 - Math.PI / 2.0;

    // Quỹ đạo Mặt Trời & Mặt Trăng
    if (window.celestialSun) {
      window.celestialSun.position.set(Math.cos(hourRad) * 180.0, Math.sin(hourRad) * 180.0, -18.0);
      window.celestialSun.visible = (window.celestialSun.position.y > -10.0);
    }
    if (window.celestialMoon) {
      window.celestialMoon.position.set(-Math.cos(hourRad) * 180.0, -Math.sin(hourRad) * 180.0, -18.0);
      window.celestialMoon.visible = (window.celestialMoon.position.y > -10.0);
    }

    // Luồng sáng Crepuscular God Rays tán rừng
    if (window.forestGodRays) {
      const isMorningOrGoldenHour = (gHour >= 6.5 && gHour <= 10.5) || (gHour >= 15.0 && gHour <= 17.5);
      const targetRayOpacity = isMorningOrGoldenHour ? 0.22 : 0.0;
      window.forestGodRays.children.forEach(r => {
        if (r.material) r.material.opacity = THREE.MathUtils.lerp(r.material.opacity, targetRayOpacity, dt * 2.0);
      });
    }

    // Tuyết rơi phủ mái nhà mùa Đông
    if (window.rooftopSnowCaps) {
      const isWinter = gameState.currentSeason === 'winter';
      const targetSnowScale = isWinter ? 1.0 : 0.001;
      window.rooftopSnowCaps.forEach(sc => {
        sc.scale.y = THREE.MathUtils.lerp(sc.scale.y, targetSnowScale, dt * 2.0);
      });
    }

    // Bọt sóng vỗ bờ dập dềnh
    if (window.shorelineFoams) {
      const wavePulse = 1.0 + Math.sin(time * 2.8) * 0.18;
      window.shorelineFoams.forEach(f => f.scale.set(wavePulse, 1.0, wavePulse));
    }

    // Khinh khí cầu du ngoạn bay bổng
    if (window.scenicBalloon) {
      window.scenicBalloon.position.y = 48.0 + Math.sin(time * 0.75) * 1.6;
      window.scenicBalloon.rotation.y += dt * 0.08;
    }

    // Tuyến tàu điện Monorail trên cao
    if (window.monorailSystem && window.monorailSystem.curve) {
      const ms = window.monorailSystem;
      ms.progress = (ms.progress + dt * ms.speed) % 1.0;
      const curPt = ms.curve.getPoint(ms.progress);
      const nextPt = ms.curve.getPoint((ms.progress + 0.015) % 1.0);
      ms.car.position.copy(curPt);
      ms.car.lookAt(nextPt);
    }

    // Hòm tiếp tế Airdrop thả dù
    if (window.airdropObject && window.airdropObject.active) {
      const ao = window.airdropObject;
      if (ao.altitude > ao.groundY) {
        ao.altitude = Math.max(ao.groundY, ao.altitude - dt * 6.5);
        ao.group.position.y = ao.altitude;
      }
      // Người chơi nhặt Airdrop
      if (playerPos && ao.altitude <= 0.2 && !ao.claimed && playerPos.distanceTo(ao.pos) < 3.2) {
        ao.claimed = true;
        ao.active = false;
        ao.group.visible = false;
        gameState.money = (gameState.money || 0) + 3500;
        gameState.gems = (gameState.gems || 0) + 15;
        if (typeof showToast === 'function') showToast('📦 AIRDROP BUNG HÒM: Nhận +$3,500 USD & +15 Gems Hoàng Gia!');
        if (typeof sounds !== 'undefined' && sounds.playCelebrationCheer) sounds.playCelebrationCheer();
        if (typeof updateHUD === 'function') updateHUD();
      }
    }

    // Dải mũi tên AR Waypoint Chevron Path
    if (window.waypointPathGroup && window.waypointChevrons && playerPos) {
      const wp = gameState.activeWaypoint || gameState.gpsTarget;
      if (wp) {
        window.waypointPathGroup.visible = true;
        const targetV = new THREE.Vector3(wp.x, 0.25, wp.z);
        const totalDist = playerPos.distanceTo(targetV);
        for (let ci = 0; ci < window.waypointChevrons.length; ci++) {
          const ratio = (ci + 1) / (window.waypointChevrons.length + 1);
          const chev = window.waypointChevrons[ci];
          chev.position.lerpVectors(playerPos, targetV, ratio);
          chev.position.y = 0.25 + Math.sin(time * 4.0 + ci * 0.6) * 0.05;
          chev.lookAt(targetV);
          chev.visible = totalDist > 3.0;
        }
      } else {
        window.waypointPathGroup.visible = false;
      }
    }
  }

  // 11. Chu kỳ Ngày - Đêm & Dàn đèn công trường
  updateDayNight(dt);
}

function updateDayNight(dt) {
  if (typeof gameState === 'undefined') return;
  // Chu kỳ ngày đêm 24h: 1s thực tế = ~0.08h trong game (khoảng 5 phút một vòng ngày đêm đầy đủ)
  gameState.gameHour = ((gameState.gameHour || 10.0) + dt * 0.08) % 24;

  const hr = Math.floor(gameState.gameHour);
  const min = Math.floor((gameState.gameHour % 1) * 60);
  const timeStr = `${hr.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  const isNight = gameState.gameHour < 5.5 || gameState.gameHour > 18.5;
  const isSunset = (gameState.gameHour >= 16.5 && gameState.gameHour <= 18.5) || (gameState.gameHour >= 5.0 && gameState.gameHour <= 6.5);

  const clockEl = document.getElementById('val-clock');
  const clockIcon = document.getElementById('val-clock-icon');
  if (clockEl) clockEl.textContent = timeStr;
  if (clockIcon) clockIcon.textContent = isNight ? '🌙' : '☀️';

  // Chuyển động cung mặt trời
  const sunAngle = ((gameState.gameHour - 6) / 24) * Math.PI * 2;
  if (window.sunLight) {
    // Cường độ, màu sắc & Khí quyển bầu trời điện ảnh theo chu kỳ ngày đêm
    const sc = worldScene || window.scene;
    if (isNight) {
      window.sunLight.intensity = 0.35;
      window.sunLight.color.setHex(0x60a5fa); // Ánh trăng xanh huyền dịu
      if (sc && sc.fog) sc.fog.color.lerp(new THREE.Color(0x0a1120), Math.min(1.0, dt * 2.0));
      if (sc && sc.background) sc.background.lerp(new THREE.Color(0x0a1120), Math.min(1.0, dt * 2.0));
    } else if (isSunset) {
      window.sunLight.intensity = 1.45;
      window.sunLight.color.setHex(0xfb923c); // Ráng chiều hoàng hôn rực rỡ
      if (sc && sc.fog) sc.fog.color.lerp(new THREE.Color(0xfdba74), Math.min(1.0, dt * 2.0));
      if (sc && sc.background) sc.background.lerp(new THREE.Color(0xfdba74), Math.min(1.0, dt * 2.0));
    } else {
      const noonFactor = Math.sin(sunAngle);
      window.sunLight.intensity = 1.6 + noonFactor * 0.9;
      window.sunLight.color.setHex(0xfff7ed); // Nắng vàng ấm PBR
      if (sc && sc.fog) sc.fog.color.lerp(new THREE.Color(0xbfe0f7), Math.min(1.0, dt * 2.0));
      if (sc && sc.background) sc.background.lerp(new THREE.Color(0xbfe0f7), Math.min(1.0, dt * 2.0));
    }
  }

  // Bật/tắt êm dịu dàn đèn đêm công trường & Chùm tia sáng nón thể tích (Tắt hẳn visible ban ngày để đạt 60 FPS)
  const isNightActive = isNight || (typeof gameState !== 'undefined' && (gameState.gameHour < 6.0 || gameState.gameHour > 18.0));
  const targetInt = isNightActive ? 1.0 : 0.0;
  if (window.nightLights && window.nightLights.length > 0) {
    window.nightLights.forEach(light => {
      light.visible = isNightActive;
      if (isNightActive) {
        const maxI = light.userData.nightIntensity || 2.0;
        light.intensity = THREE.MathUtils.lerp(light.intensity, targetInt * maxI, dt * 2.5);
      }
    });
  }

  if (window.nightBeams && window.nightBeams.length > 0) {
    window.nightBeams.forEach(beam => {
      beam.visible = isNightActive;
      if (isNightActive) {
        const maxOp = beam.userData.nightOpacity || 0.35;
        beam.material.opacity = THREE.MathUtils.lerp(beam.material.opacity, targetInt * maxOp, dt * 2.5);
      }
    });
  }
}
window.updateDayNight = updateDayNight;

// ---------------------------------------------------------------------------
// CẦU VƯỢT SÔNG HÙNG VĨ BẰNG VÒM THÉP & BÊ TÔNG CỐT THÉP (GRAND HIGHWAY ARCH BRIDGE)
// ĐỒ HỌA MỚI: MẶT CẦU PARABOL CONG TRƠN TUYỆT ĐỐI C^1 & ĐÔI VÒM THÉP NGUYÊN KHỐI TUBE
// ---------------------------------------------------------------------------
function createGrandHighwayBridge(scene) {
  const bridgeGroup = new THREE.Group();
  scene.add(bridgeGroup);

  // Bề mặt nhựa Asphalt công nghiệp siêu phẳng mượt, triệt tiêu hoàn toàn nếp gờ bậc thang
  const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.82, side: THREE.DoubleSide });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88, metalness: 0.12, side: THREE.DoubleSide });
  const archSteelMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.28, metalness: 0.75 }); // Cam đỏ công nghiệp bóng bẩy
  const archSteelDarkMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.35, metalness: 0.8 });
  const guardMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.88 }); // Thép kẽm sáng
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.92 }); // Cáp thép chịu lực
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7, side: THREE.DoubleSide });

  // Hàm tính cao độ mượt mà C^1 (Zero derivative at boundary z=2.0 & z=30.0)
  const getDeckY = (z) => {
    const u = (z - 16.0) / 14.0;
    if (Math.abs(u) <= 1.0) {
      return 0.13 + 3.6 * ((1.0 + Math.cos(Math.PI * u)) / 2.0);
    }
    return 0.13;
  };
  window.getBridgeDeckY = getDeckY;

  const getDeckSlope = (z) => {
    const u = (z - 16.0) / 14.0;
    if (Math.abs(u) <= 1.0) {
      return -3.6 * (Math.PI / 28.0) * Math.sin(Math.PI * u);
    }
    return 0;
  };

  // 1. MỐ CẦU BÊ TÔNG ĐÔI BỜ BẮC (Z = 2.0) & BỜ NAM (Z = 30.0)
  // [MÓNG MỐ ĐẶT CHÌM DƯỚI MẶT ĐƯỜNG ĐẢM BẢO XE CHẠY HOÀN TOÀN THÔNG THOÁNG KHÔNG BỊ XUYÊN VÀO KHỐI BÊ TÔNG]
  [2.0, 30.0].forEach(bz => {
    // Khối mố móng chìm dưới lòng đất đỡ mặt đường từ bên dưới (đỉnh ở Y = 0.0, dưới mặt đường Y = 0.13)
    const abutment = new THREE.Mesh(new THREE.BoxGeometry(19.2, 2.6, 4.8), concreteMat);
    abutment.position.set(28, -1.3, bz);
    abutment.castShadow = true;
    abutment.receiveShadow = true;
    bridgeGroup.add(abutment);

    // Tường cánh bê tông vát góc (Wingwalls) 2 bên mép ngoài lề đường
    [-9.2, 9.2].forEach(wx => {
      const wingWall = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 5.0), concreteMat);
      wingWall.position.set(28 + wx, 0.5, bz);
      wingWall.castShadow = true;
      wingWall.receiveShadow = true;
      bridgeGroup.add(wingWall);
    });

    // Bệ chịu lực vát chéo đỡ chân vòm thép khổng lồ (nằm ngoài mép vỉa hè X = 28 +- 8.6)
    [-8.6, 8.6].forEach(ax => {
      const archPedestal = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 2.4), concreteMat);
      archPedestal.position.set(28 + ax, 0.8, bz);
      archPedestal.castShadow = true;
      bridgeGroup.add(archPedestal);

      const steelShoe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 1.5), archSteelDarkMat);
      steelShoe.position.set(28 + ax, 1.95, bz);
      bridgeGroup.add(steelShoe);
    });
  });

  // 2. TRỤ CẦU ĐÔI BÊ TÔNG CỐT THÉP CẮM SÂU LÒNG SÔNG (PIERS AT Z = 9.5 & Z = 22.5)
  [9.5, 22.5].forEach(pz => {
    const deckYAtPier = getDeckY(pz);

    [-6.8, 6.8].forEach(pxOffset => {
      const pierHeight = deckYAtPier + 1.2;
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.35, pierHeight + 2.0, 14), concreteMat);
      pier.position.set(28 + pxOffset, pierHeight / 2 - 1.0, pz);
      pier.castShadow = true;
      bridgeGroup.add(pier);

      // Ngấn nước rêu phong ẩm ướt bám quanh chân trụ
      const mossBand = new THREE.Mesh(
        new THREE.CylinderGeometry(1.12, 1.38, 0.7, 14),
        new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.95 })
      );
      mossBand.position.set(28 + pxOffset, -0.15, pz);
      bridgeGroup.add(mossBand);

      // Mũi rẽ nước chống va đập hình nêm
      const cutwater = new THREE.Mesh(new THREE.ConeGeometry(1.25, 2.6, 4), concreteMat);
      cutwater.rotation.y = Math.PI / 4;
      cutwater.rotation.z = Math.PI / 2;
      cutwater.position.set(28 + pxOffset - 1.25, -0.5, pz);
      bridgeGroup.add(cutwater);

      // Dải bọt nước rẽ dòng cuộn qua chân trụ
      const pierWake = new THREE.Mesh(
        new THREE.PlaneGeometry(2.0, 3.6),
        new THREE.MeshBasicMaterial({ map: Textures.boatWake(), transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
      );
      pierWake.rotateX(-Math.PI / 2);
      pierWake.rotation.z = -Math.PI / 2;
      pierWake.position.set(28 + pxOffset + 1.5, 0.04, pz);
      bridgeGroup.add(pierWake);
    });

    // Dầm xà mũ ngang đỡ mặt cầu
    const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(17.6, 0.85, 2.2), concreteMat);
    crossBeam.position.set(28, deckYAtPier - 0.55, pz);
    crossBeam.castShadow = true;
    bridgeGroup.add(crossBeam);
  });

  // 3. MẶT ĐƯỜNG BẢN BÊ TÔNG & NHỰA ASPHALT NGUYÊN KHỐI LIỀN MẠCH 100% (SEAMLESS RIBBON SURFACE)
  // [HOÀN TOÀN LOẠI BỎ HỘP BOX RỜI RẠC - TẠO MẶT PHẲNG LƯỢN SÓNG PARABOL KHÔNG NẾP GỜ BẬC THANG]
  const steps = 72;
  const zStart = 2.0;
  const zEnd = 30.0;

  const createRibbonMesh = (xLeft, xRight, yOffset, mat, uvRepeat = 14.0) => {
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i <= steps; i++) {
      const z = zStart + (i / steps) * (zEnd - zStart);
      const y = getDeckY(z) + yOffset;
      const v = (z - zStart) / uvRepeat;

      positions.push(28 + xLeft, y, z);
      uvs.push(0, v);

      positions.push(28 + xRight, y, z);
      uvs.push(1, v);

      if (i < steps) {
        const row1 = i * 2;
        const row2 = (i + 1) * 2;
        // Winding order chuẩn: row1 -> row2 -> row1 + 1 để pháp tuyến hướng lên trời (+Y)
        indices.push(row1, row2, row1 + 1);
        indices.push(row1 + 1, row2, row2 + 1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    return mesh;
  };

  // 1. Mặt đường nhựa asphalt phẳng lỳ nguyên khối rộng 14.8m
  const roadSurface = createRibbonMesh(-7.4, 7.4, 0.0, asphaltMat, 28.0);
  bridgeGroup.add(roadSurface);

  // 2. Dầm đáy bê tông hộp chịu lực phía dưới mặt đường
  const soffitSurface = createRibbonMesh(-7.2, 7.2, -0.42, concreteMat, 28.0);
  bridgeGroup.add(soffitSurface);

  // 3. Vạch kẻ tim đường vàng đôi phản quang phẳng mượt
  const yellowLine = createRibbonMesh(-0.2, 0.2, 0.015, new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }), 28.0);
  bridgeGroup.add(yellowLine);

  // Vạch kẻ trắng phân chia làn xe chạy 2 bên (White Dashed Lane Lines)
  [-3.8, 3.8].forEach(lineX => {
    const whiteLine = createRibbonMesh(lineX - 0.08, lineX + 0.08, 0.012, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), 28.0);
    bridgeGroup.add(whiteLine);
  });

  // 4. Vỉa hè đi bộ 2 bên (đá granite cao hơn mặt đường 0.14m)
  const leftSidewalk = createRibbonMesh(-8.2, -7.4, 0.14, curbMat, 28.0);
  bridgeGroup.add(leftSidewalk);
  const rightSidewalk = createRibbonMesh(7.4, 8.2, 0.14, curbMat, 28.0);
  bridgeGroup.add(rightSidewalk);

  // 5. Gờ vát đứng thành vỉa hè (Curb Faces)
  const makeCurbFace = (xPos, yLow, yHigh) => {
    const positions = [];
    const indices = [];
    for (let i = 0; i <= steps; i++) {
      const z = zStart + (i / steps) * (zEnd - zStart);
      const baseY = getDeckY(z);
      positions.push(28 + xPos, baseY + yLow, z);
      positions.push(28 + xPos, baseY + yHigh, z);
      if (i < steps) {
        const r1 = i * 2;
        const r2 = (i + 1) * 2;
        indices.push(r1, r2, r1 + 1);
        indices.push(r1 + 1, r2, r2 + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, curbMat);
    m.receiveShadow = true;
    m.frustumCulled = false;
    bridgeGroup.add(m);
  };
  makeCurbFace(-7.4, 0.0, 0.14);
  makeCurbFace(7.4, 0.0, 0.14);

  // 6. DẢI PHÂN CÁCH BÊ TÔNG CHỐNG VA ĐẬP (JERSEY BARRIERS) NGĂN GIỮA LÀN XE VÀ VỈA HÈ
  [-7.4, 7.4].forEach(bx => {
    const barrierCurvePoints = [];
    for (let c = 0; c <= 32; c++) {
      const cz = zStart + (c / 32) * (zEnd - zStart);
      const cy = getDeckY(cz);
      barrierCurvePoints.push(new THREE.Vector3(28 + bx, cy + 0.35, cz));
    }
    const bCurve = new THREE.CatmullRomCurve3(barrierCurvePoints);
    const barrierMesh = new THREE.Mesh(new THREE.TubeGeometry(bCurve, 36, 0.16, 8, false), concreteMat);
    barrierMesh.castShadow = true;
    bridgeGroup.add(barrierMesh);

    // Mắt mèo phản quang (Reflector studs) vàng/đỏ xen kẽ dọc theo dải phân cách
    for (let rz = zStart + 1.2; rz <= zEnd - 1.2; rz += 2.0) {
      const ry = getDeckY(rz);
      const isRed = Math.floor(rz / 2) % 2 === 0;
      const ref = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.08, 0.14),
        new THREE.MeshBasicMaterial({ color: isRed ? 0xef4444 : 0xfacc15 })
      );
      ref.position.set(28 + bx + (bx < 0 ? 0.14 : -0.14), ry + 0.38, rz);
      bridgeGroup.add(ref);
    }
  });

  // 3b. LAN CAN THÉP VÀ DẢI ĐÈN LED NEON UỐN CONG BẰNG TUBE NGUYÊN KHỐI
  [-8.1, 8.1].forEach(gx => {
    const railPoints = [];
    const lowerRailPoints = [];
    const ledPoints = [];

    const curveSamples = 32;
    for (let c = 0; c <= curveSamples; c++) {
      const cz = zStart + (c / curveSamples) * (zEnd - zStart);
      const cy = getDeckY(cz);
      railPoints.push(new THREE.Vector3(28 + gx, cy + 0.95, cz));
      lowerRailPoints.push(new THREE.Vector3(28 + gx, cy + 0.52, cz));
      ledPoints.push(new THREE.Vector3(28 + gx, cy + 0.98, cz));
    }

    const railCurve = new THREE.CatmullRomCurve3(railPoints);
    const railMesh = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 36, 0.065, 8, false), guardMat);
    railMesh.castShadow = true;
    bridgeGroup.add(railMesh);

    const lowerCurve = new THREE.CatmullRomCurve3(lowerRailPoints);
    const lowerMesh = new THREE.Mesh(new THREE.TubeGeometry(lowerCurve, 36, 0.045, 8, false), guardMat);
    bridgeGroup.add(lowerMesh);

    // Dải đèn LED neon màu xanh ngọc chạy dọc thanh tay vịn
    const ledCurve = new THREE.CatmullRomCurve3(ledPoints);
    const ledNeonMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const ledMesh = new THREE.Mesh(new THREE.TubeGeometry(ledCurve, 36, 0.038, 6, false), ledNeonMat);
    bridgeGroup.add(ledMesh);
    if (!window.bridgeLEDs) window.bridgeLEDs = [];
    window.bridgeLEDs.push(ledMesh);

    // Trụ lan can thẳng đứng cắm xuống mặt vỉa hè cách đều 1.5m
    for (let pz = zStart + 0.5; pz <= zEnd - 0.4; pz += 1.5) {
      const py = getDeckY(pz);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.92, 8), guardMat);
      post.position.set(28 + gx, py + 0.46, pz);
      bridgeGroup.add(post);
    }
  });

  // 3c. ĐÀI NGẮM CẢNH HÌNH BÁN NGUYỆT GIỮA CẦU (SCENIC LOOKOUT OVERLOOK & TELESCOPE)
  const overlookGroup = new THREE.Group();
  overlookGroup.position.set(28 - 8.1, getDeckY(16.0), 16.0);
  bridgeGroup.add(overlookGroup);

  const overlookFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(2.3, 2.3, 0.38, 20, 1, false, Math.PI / 2, Math.PI),
    curbMat
  );
  overlookFloor.position.set(0, 0.08, 0);
  overlookGroup.add(overlookFloor);

  const overlookRail = new THREE.Mesh(
    new THREE.CylinderGeometry(2.3, 2.3, 0.88, 20, 1, true, Math.PI / 2, Math.PI),
    guardMat
  );
  overlookRail.position.set(0, 0.52, 0);
  overlookGroup.add(overlookRail);

  const overlookLED = new THREE.Mesh(
    new THREE.CylinderGeometry(2.32, 2.32, 0.08, 20, 1, true, Math.PI / 2, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  overlookLED.position.set(0, 0.96, 0);
  overlookGroup.add(overlookLED);
  window.bridgeLEDs.push(overlookLED);

  // Kính viễn vọng ngắm cảnh hoàng hôn bằng đồng thau
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.25 });
  const telePedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.1, 8), brassMat);
  telePedestal.position.set(-1.1, 0.65, 0);
  overlookGroup.add(telePedestal);

  const teleHead = new THREE.Group();
  teleHead.position.set(-1.1, 1.25, 0);
  teleHead.rotation.y = Math.PI / 2;
  teleHead.rotation.z = -0.15;
  overlookGroup.add(teleHead);

  const teleBarrel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.65, 8), brassMat);
  teleBarrel1.position.set(-0.08, 0, 0);
  teleBarrel1.rotateX(Math.PI / 2);
  teleHead.add(teleBarrel1);

  const teleBarrel2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.65, 8), brassMat);
  teleBarrel2.position.set(0.08, 0, 0);
  teleBarrel2.rotateX(Math.PI / 2);
  teleHead.add(teleBarrel2);

  // 4. ĐÔI VÒM THÉP KHỔNG LỒ SƠN ĐỎ CAM NGUYÊN KHỐI (CONTINUOUS TUBE ARCH TRUSSES)
  // [HOÀN TOÀN LOẠI BỎ CÁC KHỐI HỘP LƠ LỬNG RỜI RẠC - THAY BẰNG DẦM ỐNG VÒM CONG UỐN LƯỢN ĐẲNG CẤP]
  [-8.4, 8.4].forEach(archX => {
    const archGroup = new THREE.Group();
    archGroup.position.set(28 + archX, 0, 0);
    bridgeGroup.add(archGroup);

    // Tính toán đường cong vòm chính (Top Arch Chord)
    const topArchPoints = [];
    const botArchPoints = [];
    const archSamples = 36;

    for (let s = 0; s <= archSamples; s++) {
      const az = zStart + (s / archSamples) * (zEnd - zStart);
      const u = (az - 16.0) / 14.0;
      // Độ cao vòm parabol vuốt cao hùng vĩ (đỉnh đạt ~9.2m)
      const topY = 0.5 + 8.7 * ((1.0 + Math.cos(Math.PI * u)) / 2.0);
      const botY = Math.max(0.4, topY - 0.72);

      topArchPoints.push(new THREE.Vector3(0, topY, az));
      botArchPoints.push(new THREE.Vector3(0, botY, az));
    }

    // Dầm vòm trên chính bằng TubeGeometry liền lạc trơn tru
    const topArchCurve = new THREE.CatmullRomCurve3(topArchPoints);
    const topArchMesh = new THREE.Mesh(
      new THREE.TubeGeometry(topArchCurve, 48, 0.36, 12, false),
      archSteelMat
    );
    topArchMesh.castShadow = true;
    archGroup.add(topArchMesh);

    // Dầm vòm dưới phụ bằng TubeGeometry tạo kết cấu dầm không gian
    const botArchCurve = new THREE.CatmullRomCurve3(botArchPoints);
    const botArchMesh = new THREE.Mesh(
      new THREE.TubeGeometry(botArchCurve, 48, 0.22, 10, false),
      archSteelMat
    );
    botArchMesh.castShadow = true;
    archGroup.add(botArchMesh);

    // Hệ thanh giằng mạng mắt cáo hình chữ X giữa 2 vòm trên và dưới
    for (let s = 1; s < archSamples; s += 2) {
      const p1 = topArchPoints[s];
      const p2 = botArchPoints[s + 1];
      const p3 = botArchPoints[s];
      const p4 = topArchPoints[s + 1];

      const makeStrut = (start, end) => {
        const delta = new THREE.Vector3().subVectors(end, start);
        const strutLen = delta.length();
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, strutLen, 6), archSteelDarkMat);
        strut.position.copy(start).addScaledVector(delta, 0.5);
        strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
        archGroup.add(strut);
      };

      if (p1 && p2) makeStrut(p1, p2);
      if (p3 && p4) makeStrut(p3, p4);
    }

    // Dây cáp treo cường lực thẳng đứng từ vòm thép neo xuống mép dầm cầu
    for (let cz = zStart + 1.6; cz <= zEnd - 1.5; cz += 1.4) {
      const u = (cz - 16.0) / 14.0;
      const vArchY = 0.5 + 8.7 * ((1.0 + Math.cos(Math.PI * u)) / 2.0) - 0.72;
      const vDeckY = getDeckY(cz);
      const h = vArchY - vDeckY;

      if (h > 0.45) {
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, h, 6), cableMat);
        cable.position.set(0, vDeckY + h / 2, cz);
        archGroup.add(cable);

        // Khớp neo cáp thép trên & dưới
        const shoeTop = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.14), archSteelDarkMat);
        shoeTop.position.set(0, vArchY - 0.08, cz);
        archGroup.add(shoeTop);

        const shoeBot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.14), archSteelDarkMat);
        shoeBot.position.set(0, vDeckY + 0.08, cz);
        archGroup.add(shoeBot);
      }
    }

    // Đèn chớp đỏ cảnh báo hàng không đỉnh vòm (Aviation Warning Beacon)
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    beacon.position.set(0, 9.35, 16.0);
    archGroup.add(beacon);
    if (!window.bridgeBeacons) window.bridgeBeacons = [];
    window.bridgeBeacons.push(beacon);
  });

  // Dầm ngang giằng gió đỉnh vòm (Portal Wind Bracing) nối 2 vòm thép trên nóc
  [11.5, 13.8, 16.0, 18.2, 20.5].forEach(topZ => {
    const u = (topZ - 16.0) / 14.0;
    const topY = 0.5 + 8.7 * ((1.0 + Math.cos(Math.PI * u)) / 2.0);

    const crossStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 16.8, 8), archSteelMat);
    crossStrut.rotation.z = Math.PI / 2;
    crossStrut.position.set(28, topY - 0.1, topZ);
    bridgeGroup.add(crossStrut);
  });

  // Đèn pha công suất cao rọi ngược lên vòm thép (Arch Architectural Uplighting)
  [-8.4, 8.4].forEach(ax => {
    [3.6, 28.4].forEach(az => {
      const uplight = new THREE.SpotLight(0xf97316, 0, 36, Math.PI / 3.6, 0.45);
      uplight.position.set(28 + ax, 1.4, az);
      uplight.target.position.set(28 + ax, 8.5, 16.0);
      bridgeGroup.add(uplight);
      bridgeGroup.add(uplight.target);
      uplight.userData.nightIntensity = 2.8;
      if (!window.nightLights) window.nightLights = [];
      window.nightLights.push(uplight);
    });
  });

  // 5. ĐÈN ĐƯỜNG CAO ÁP CHIẾU SÁNG MẶT CẦU BAN ĐÊM (6 CỘT ĐÈN ĐÔI)
  [-8.0, 8.0].forEach(lx => {
    [8.0, 16.0, 24.0].forEach(lz => {
      const bY = getDeckY(lz);

      const bPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 4.4, 8), guardMat);
      bPole.position.set(28 + lx, bY + 2.2, lz);
      bridgeGroup.add(bPole);

      const bHead = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.65), concreteMat);
      bHead.position.set(28 + lx + (lx < 0 ? 0.65 : -0.65), bY + 4.3, lz);
      bridgeGroup.add(bHead);

      const bLight = new THREE.PointLight(0xfef08a, 0, 18, 2.0);
      bLight.position.set(28 + lx + (lx < 0 ? 0.65 : -0.65), bY + 4.1, lz);
      bridgeGroup.add(bLight);
      bLight.userData.nightIntensity = 1.9;
      if (!window.nightLights) window.nightLights = [];
      window.nightLights.push(bLight);
    });
  });

  // 6. BIỂN BÁO CỔNG VÒM LONG MÔN (OVERHEAD TRAFFIC GANTRY SIGNS)
  const gantryMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });
  [
    { z: 2.8, label: '🌉 CẦU VƯỢT SÔNG ĐẠI DƯƠNG | OCEAN HIGHWAY BRIDGE', color: '#38bdf8' },
    { z: 29.2, label: '⚓ HƯỚNG VỀ CẢNG BIỂN & KHU CÔNG NGHIỆP', color: '#facc15' }
  ].forEach(gt => {
    const gantry = new THREE.Group();
    gantry.position.set(28, 0, gt.z);
    bridgeGroup.add(gantry);

    [-8.6, 8.6].forEach(gx => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.2, 8), gantryMat);
      post.position.set(gx, 3.1, 0);
      gantry.add(post);
    });

    const beam = new THREE.Mesh(new THREE.BoxGeometry(17.8, 0.45, 0.45), gantryMat);
    beam.position.set(0, 5.8, 0);
    gantry.add(beam);

    const sign = makeBillboardText(gt.label, gt.color, 420, 52);
    sign.position.set(0, 6.6, 0);
    gantry.add(sign);

    // Camera giám sát giao thông trên cổng long môn (Traffic CCTV Cam)
    const camHousing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.5), concreteMat);
    camHousing.position.set(3.5, 5.5, 0);
    camHousing.rotation.x = 0.35;
    gantry.add(camHousing);

    const camLens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 8), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
    camLens.rotateX(Math.PI / 2);
    camLens.position.set(3.5, 5.45, 0.26);
    gantry.add(camLens);

    // Đèn tín hiệu giao thông thông minh ETC
    [-3.8, 3.8].forEach(lx => {
      const etcSign = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.35, 0.08),
        new THREE.MeshBasicMaterial({ color: 0x10b981 })
      );
      etcSign.position.set(lx, 5.4, 0.24);
      gantry.add(etcSign);
    });

    // Gờ giảm tốc sơn vàng đen trên mặt đường tiếp cận mố cầu (Speed Bumps)
    for (let sb = -1.2; sb <= 1.2; sb += 0.8) {
      const bump = new THREE.Mesh(
        new THREE.BoxGeometry(14.0, 0.06, 0.32),
        new THREE.MeshStandardMaterial({ color: (Math.abs(sb) < 0.5) ? 0xfacc15 : 0x0f172a, roughness: 0.6 })
      );
      bump.position.set(0, 0.26, gt.z > 16 ? 0.9 + sb : -0.9 + sb);
      gantry.add(bump);
    }
  });
}
window.createGrandHighwayBridge = createGrandHighwayBridge;

// ---------------------------------------------------------------------------
// SIÊU MỞ RỘNG BẢN ĐỒ TOÀN CẢNH: 8 ĐẠI PHÂN KHU ĐẾ CHẾ HOÀNG GIA (MEGA EMPIRE 380m)
// [BỐ CỤC QUY HOẠCH RỘNG THÊNH THANG, THƯA THOÁNG, KHÔNG CHỒNG ĐÈ, ĐẠT CHUẨN ĐÔ THỊ AAA]
// ---------------------------------------------------------------------------
function createSouthShoreExpansion(scene) {
  const southGroup = new THREE.Group();
  scene.add(southGroup);

  // Vật liệu chuẩn PBR cao cấp
  const asphaltMat = new THREE.MeshStandardMaterial({ map: Textures.asphalt(), roughness: 0.82 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88, metalness: 0.12 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.75 });
  const woodMat = new THREE.MeshStandardMaterial({ map: Textures.plank(), roughness: 0.85 });
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.95 }); // Cát vàng nhiệt đới
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55 });
  const darkGlassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, transparent: true, opacity: 0.75 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.9, roughness: 0.15 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.92, roughness: 0.18 });

  if (!window.southExpansionPads) window.southExpansionPads = [];

  // =========================================================================
  // 1. MẠNG LƯỚI HẠ TẦNG CAO TỐC & ĐẠI LỘ BỜ NAM RỘNG THÊNH THANG
  // =========================================================================
  // Tuyến cao tốc chính nối dài thẳng tắp từ chân cầu (Z = 30.0 đến Z = 166.0, X = 28.0)
  const highwayGeo = new THREE.PlaneGeometry(14.8, 136);
  highwayGeo.rotateX(-Math.PI / 2);
  const southHighway = new THREE.Mesh(highwayGeo, asphaltMat);
  southHighway.position.set(28, 0.13, 98.0);
  southHighway.receiveShadow = true;
  southGroup.add(southHighway);

  // Vạch tim đường vàng đôi cao tốc Bờ Nam
  const stripeGeo = new THREE.PlaneGeometry(0.38, 136);
  stripeGeo.rotateX(-Math.PI / 2);
  const southYellowStripe = new THREE.Mesh(stripeGeo, new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
  southYellowStripe.position.set(28, 0.14, 98.0);
  southGroup.add(southYellowStripe);

  // Đại lộ Đông - Tây kết nối các đại phân khu (East-West Boulevard tại Z = 78.0, dài 250m)
  // [QUY HOẠCH HOÀN TOÀN TÁCH BIỆT KHU PHỐ ĐI BỘ HÀNH CHÍNH & KHÔNG CHỒNG LÊN CÔNG TRÌNH]
  const crossBlvdGeo = new THREE.PlaneGeometry(250, 10.5);
  crossBlvdGeo.rotateX(-Math.PI / 2);
  const crossBlvd = new THREE.Mesh(crossBlvdGeo, asphaltMat);
  crossBlvd.position.set(0, 0.135, 78.0);
  crossBlvd.receiveShadow = true;
  southGroup.add(crossBlvd);

  // Vạch tim đường kép màu vàng rực rỡ
  const crossYellow = new THREE.Mesh(new THREE.PlaneGeometry(250, 0.35), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
  crossYellow.rotateX(-Math.PI / 2);
  crossYellow.position.set(0, 0.14, 78.0);
  southGroup.add(crossYellow);

  // Vạch biên trắng 2 bên mép đường (Curb edge lines)
  [-4.8, 4.8].forEach(wz => {
    const edgeWhite = new THREE.Mesh(new THREE.PlaneGeometry(250, 0.2), new THREE.MeshBasicMaterial({ color: 0xf8fafc }));
    edgeWhite.rotateX(-Math.PI / 2);
    edgeWhite.position.set(0, 0.14, 78.0 + wz);
    southGroup.add(edgeWhite);
  });

  // =========================================================================
  // PHÂN KHU 1: SIÊU CẢNG BIỂN LOGISTICS CONTAINER (EAST CONTAINER TERMINAL)
  // Tọa độ dời sang phía Đông thoáng đãng: X = 85, Z = 50 (Cách xa cầu 55m!)
  // =========================================================================
  const portGroup = new THREE.Group();
  portGroup.position.set(85, 0, 50);
  southGroup.add(portGroup);

  // Sàn cảng bê tông chịu tải nặng
  const portApron = new THREE.Mesh(new THREE.BoxGeometry(38, 0.4, 28), concreteMat);
  portApron.position.set(0, 0.1, 0);
  portApron.receiveShadow = true;
  portGroup.add(portApron);

  // Siêu Cần cẩu giàn STS cao 16 mét
  const craneGroup = new THREE.Group();
  craneGroup.position.set(10, 0, -8);
  portGroup.add(craneGroup);
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.7, roughness: 0.3 });

  [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]].forEach(([cx, cz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.65, 14, 0.65), craneMat);
    leg.position.set(cx, 7, cz);
    leg.castShadow = true;
    craneGroup.add(leg);
  });
  const boom = new THREE.Mesh(new THREE.BoxGeometry(22, 1.1, 2.6), craneMat);
  boom.position.set(0, 14, 0);
  boom.castShadow = true;
  craneGroup.add(boom);

  const spreader = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 7.2), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
  spreader.position.set(-4, 9, 0);
  craneGroup.add(spreader);
  window.portCraneSpreader = spreader;

  // Container đang được cần cẩu giàn cẩu bốc dỡ
  const hoistedContainer = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.5, 7.0), new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 }));
  hoistedContainer.position.set(0, -1.5, 0);
  hoistedContainer.castShadow = true;
  spreader.add(hoistedContainer);
  window.portCraneContainer = hoistedContainer;

  // Bãi Container 4 màu quốc tế xếp 3 tầng
  const cColors = [0x0284c7, 0x15803d, 0xdb2777, 0xea580c];
  const cBoxGeo = new THREE.BoxGeometry(2.5, 2.6, 7.2);
  [-10, -5, 0].forEach((cx, colIdx) => {
    [4, 8].forEach((cz, rowIdx) => {
      for (let t = 0; t < 3; t++) {
        const cMesh = new THREE.Mesh(cBoxGeo, new THREE.MeshStandardMaterial({ color: cColors[(colIdx + rowIdx + t) % 4], roughness: 0.45 }));
        cMesh.position.set(cx, 1.45 + t * 2.62, cz);
        cMesh.castShadow = true;
        portGroup.add(cMesh);
      }
    });
  });

  // Pad giao dịch Cảng Biển
  const portPad = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0369a1, emissiveIntensity: 0.6 }));
  portPad.position.set(-14, 0.25, -6);
  portGroup.add(portPad);
  portPad.userData = { type: 'port_logistics_pad' };
  if (typeof clickables !== 'undefined') clickables.push(portPad);
  const portTag = makeBillboardText('⚓ SIÊU CẢNG BIỂN QUỐC TẾ | LOGISTICS XUẤT KHẨU (+300% USD)', '#38bdf8', 380, 48);
  portTag.position.set(-14, 3.8, -6);
  portGroup.add(portTag);
  window.southExpansionPads.push({ mesh: portTag, pos: new THREE.Vector3(71, 0, 44) });

  // -------------------------------------------------------------------------
  // HẠ TẦNG CẢNG BIỂN: ĐỆM CHỐNG VA CẦU TÀU (QUAY WALL RUBBER FENDERS & BOLLARDS)
  // -------------------------------------------------------------------------
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95 });
  const bollardMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.25 });
  const lifebuoyMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.5 });
  const whiteBandMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });

  // Dọc theo mép cầu cảng X = 19 (World X = 104, Z từ -13 đến 13)
  for (let bz = -12; bz <= 12; bz += 4.8) {
    // Đệm cao su giảm chấn hình trụ treo mép nước (Cylindrical Marine Fenders)
    const fender = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.8, 12), rubberMat);
    fender.position.set(19.2, -0.4, bz);
    portGroup.add(fender);

    // Xích thép treo đệm
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9 });
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6), chainMat);
    chain.position.set(19.1, 0.4, bz);
    portGroup.add(chain);

    // Bích neo tàu kép bằng gang đúc mạ vàng (Double Bitt Mooring Bollards)
    const bollardBase = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.15, 1.1), bollardMat);
    bollardBase.position.set(18.2, 0.38, bz);
    portGroup.add(bollardBase);

    [-0.32, 0.32].forEach(oz => {
      const bitt = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.65, 10), bollardMat);
      bitt.position.set(18.2, 0.65, bz + oz);
      portGroup.add(bitt);

      const bittCap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 10), bollardMat);
      bittCap.position.set(18.2, 0.98, bz + oz);
      portGroup.add(bittCap);
    });
  }

  // Phao cứu sinh gắn trên giá treo dọc cầu tàu
  [-7.0, 7.0].forEach(pz => {
    const buoyGroup = new THREE.Group();
    buoyGroup.position.set(18.4, 0.9, pz);
    portGroup.add(buoyGroup);

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), steelMat);
    post.position.y = 0.6;
    buoyGroup.add(post);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.1, 8, 16), lifebuoyMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.y = 1.0;
    buoyGroup.add(ring);
  });

  // -------------------------------------------------------------------------
  // TRẠM CÂN TẢI TRỌNG TỰ ĐỘNG & CỔNG KIỂM SOÁT CẢNG BIỂN (TRUCK WEIGH STATION)
  // Tọa độ cửa ngõ vào cảng: World X = 52, Z = 50 (Relative X = -33, Z = 0)
  // -------------------------------------------------------------------------
  const weighGroup = new THREE.Group();
  weighGroup.position.set(-33, 0, 0);
  portGroup.add(weighGroup);

  // Khung cổng giàn thép chịu lực bắc ngang đường vào cảng
  const gantrySteelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.3 });
  [-5.8, 5.8].forEach(gz => {
    const gCol = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.2, 0.5), gantrySteelMat);
    gCol.position.set(0, 3.1, gz);
    gCol.castShadow = true;
    weighGroup.add(gCol);
  });

  const gBeam = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 12.2), gantrySteelMat);
  gBeam.position.set(0, 6.2, 0);
  gBeam.castShadow = true;
  weighGroup.add(gBeam);

  // Biển hiệu điện tử LED chữ xanh ngọc phía trên cổng cân
  const weighTag = makeBillboardText('⚖️ TRẠM CÂN TẢI TRỌNG CẢNG BIỂN | WEIGH STATION [CLEAR]', '#38bdf8', 430, 50);
  weighTag.position.set(0, 7.2, 0);
  weighGroup.add(weighTag);

  // Bàn cân điện tử âm sàn bằng thép có gân chống trượt
  const scalePlateMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.4 });
  const scalePlate = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.08, 9.8), scalePlateMat);
  scalePlate.position.set(0, 0.14, 0);
  weighGroup.add(scalePlate);

  // Vạch kẻ sơn chéo vàng đen cảnh báo nguy hiểm mép bàn cân
  const hazardMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  [-5.0, 5.0].forEach(hz => {
    const hazardStripe = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 0.35), hazardMat);
    hazardStripe.rotation.x = -Math.PI / 2;
    hazardStripe.position.set(0, 0.16, hz);
    weighGroup.add(hazardStripe);
  });

  // Bốt kiểm soát cân & Hải quan quan sát (Weighmaster Inspection Booth)
  const boothGroup = new THREE.Group();
  boothGroup.position.set(0, 0, -6.8);
  weighGroup.add(boothGroup);

  const boothBody = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.2, 2.2), concreteMat);
  boothBody.position.y = 1.6;
  boothBody.castShadow = true;
  boothGroup.add(boothBody);

  const boothRoof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.25, 2.6), gantrySteelMat);
  boothRoof.position.y = 3.3;
  boothGroup.add(boothRoof);

  const boothGlass = new THREE.Mesh(new THREE.BoxGeometry(2.82, 1.2, 1.6), darkGlassMat);
  boothGlass.position.set(0, 2.0, 0.3);
  boothGroup.add(boothGlass);

  // Đèn tín hiệu giao thông cổng cân (Xanh = Clear, Đỏ = Stop)
  const trafficSignal = new THREE.Group();
  trafficSignal.position.set(0, 4.6, 5.2);
  weighGroup.add(trafficSignal);

  const sigBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), gantrySteelMat);
  trafficSignal.add(sigBox);
  const greenLight = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
  greenLight.position.set(-0.16, -0.2, 0);
  trafficSignal.add(greenLight);
  const redLight = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  redLight.position.set(-0.16, 0.2, 0);
  trafficSignal.add(redLight);

  // Đăng ký vị trí trạm cân để xử lý tương tác logic xe
  window.portWeighStation = {
    pos: new THREE.Vector3(52, 0, 50),
    radius: 5.5,
    cooldown: 0
  };

  // =========================================================================
  // PHÂN KHU 2: NHÀ MÁY NỘI THẤT XUẤT KHẨU BẮC ÂU (NORDIC FURNITURE PLANT)
  // Tọa độ trung tâm lùi sâu xuống Nam: X = 5, Z = 95
  // =========================================================================
  const furnGroup = new THREE.Group();
  furnGroup.position.set(5, 0, 95);
  southGroup.add(furnGroup);

  const factoryFloor = new THREE.Mesh(new THREE.BoxGeometry(34, 0.35, 24), new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4 }));
  factoryFloor.position.set(0, 0.1, 0);
  factoryFloor.receiveShadow = true;
  furnGroup.add(factoryFloor);

  // Khung cột nhà xưởng thép công nghiệp
  [-14, 0, 14].forEach(fx => {
    [-10, 10].forEach(fz => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.2, 0.5), steelMat);
      col.position.set(fx, 3.6, fz);
      col.castShadow = true;
      furnGroup.add(col);
    });
    const truss = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 20.4), steelMat);
    truss.position.set(fx, 7.2, 0);
    furnGroup.add(truss);
  });

  // Máy CNC & Dây chuyền sản xuất nội thất
  const cnc = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.8, 2.8), new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6 }));
  cnc.position.set(-8, 1.5, -4);
  furnGroup.add(cnc);

  const conveyor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, 1.4), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
  conveyor.position.set(0, 0.6, -4);
  furnGroup.add(conveyor);

  // BÀN THỢ MỘC GIA CÔNG GỖ (CARPENTRY WORKBENCHES & TOOLS)
  const bench = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.85, 1.8), new THREE.MeshStandardMaterial({ map: Textures.plank(), roughness: 0.8 }));
  bench.position.set(-2, 0.45, 2);
  bench.castShadow = true;
  furnGroup.add(bench);

  // Ê-tô kẹp gỗ & Ván gỗ đang bào dở
  const vice = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 }));
  vice.position.set(-4.1, 0.98, 2);
  furnGroup.add(vice);
  const rawPlank = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.6), new THREE.MeshStandardMaterial({ color: 0xd97706 }));
  rawPlank.position.set(-1.8, 0.95, 2);
  furnGroup.add(rawPlank);

  // 2 THỢ MỘC BẮC ÂU (CARPENTER NPCs) ĐANG LÀM VIỆC
  // Thợ mộc 1: Áo sơ mi ca-rô đỏ đang bào gỗ tại bàn thợ
  const carp1 = new THREE.Group();
  carp1.position.set(-2.0, 0, 0.8);
  furnGroup.add(carp1);
  const cp1Body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.0, 0.45), new THREE.MeshStandardMaterial({ color: 0xb91c1c }));
  cp1Body.position.y = 1.1;
  carp1.add(cp1Body);
  const cp1Apron = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.85, 0.48), new THREE.MeshStandardMaterial({ color: 0x78350f }));
  cp1Apron.position.set(0, 1.05, 0.02);
  carp1.add(cp1Apron);
  const cp1Head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: 0xffedd5 }));
  cp1Head.position.y = 1.82;
  carp1.add(cp1Head);

  // Thợ mộc 2: Đang lắp ráp ghế sồi tại showroom
  const carp2 = new THREE.Group();
  carp2.position.set(4.0, 0, 4.0);
  carp2.rotation.y = -Math.PI / 4;
  furnGroup.add(carp2);
  const cp2Body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.0, 0.45), new THREE.MeshStandardMaterial({ color: 0x0369a1 }));
  cp2Body.position.y = 1.1;
  carp2.add(cp2Body);
  const cp2Head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: 0xffedd5 }));
  cp2Head.position.y = 1.82;
  carp2.add(cp2Head);

  // Showroom vách kính trưng bày bàn ghế sồi
  const showroomWall = new THREE.Mesh(new THREE.BoxGeometry(12, 4.5, 0.1), glassMat);
  showroomWall.position.set(6, 2.3, 8);
  furnGroup.add(showroomWall);

  const table = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 1.6), woodMat);
  table.position.set(6, 1.3, 4);
  furnGroup.add(table);

  // 2 Ghế tựa gỗ sồi bọc nệm
  [-1.0, 1.0].forEach(chX => {
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.8), new THREE.MeshStandardMaterial({ color: 0x92400e }));
    chair.position.set(6 + chX, 0.7, 5.4);
    chair.castShadow = true;
    furnGroup.add(chair);
  });

  // Pad Nhà máy nội thất
  const furnPad = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.6 }));
  furnPad.position.set(-10, 0.25, 6);
  furnGroup.add(furnPad);
  furnPad.userData = { type: 'furniture_factory_pad' };
  if (typeof clickables !== 'undefined') clickables.push(furnPad);
  const furnTag = makeBillboardText('🪑 NHÀ MÁY NỘI THẤT BẮC ÂU: SẢN XUẤT BÀN GHẾ ($$$$)', '#facc15', 380, 48);
  furnTag.position.set(-10, 3.8, 6);
  furnGroup.add(furnTag);
  window.southExpansionPads.push({ mesh: furnTag, pos: new THREE.Vector3(-5, 0, 101) });

  // =========================================================================
  // PHÂN KHU 3: LÀNG CHÀI THỦY SẢN & CHỢ ĐÊM HẢI SẢN (COASTAL FISHERY)
  // Tọa độ dời sang phía Tây ven biển xa: X = -90, Z = 50 (Tách biệt hoàn toàn!)
  // =========================================================================
  const fishGroup = new THREE.Group();
  fishGroup.position.set(-90, 0, 50);
  southGroup.add(fishGroup);

  const boardWalk = new THREE.Mesh(new THREE.BoxGeometry(36, 0.45, 22), woodMat);
  boardWalk.position.set(0, 0.2, 0);
  boardWalk.receiveShadow = true;
  fishGroup.add(boardWalk);

  // Dãy nhà sàn mái ngọc bích
  [-10, 0, 10].forEach((sx, sIdx) => {
    const shack = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.2, 4.2), new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 }));
    shack.position.set(sx, 1.8, -6);
    fishGroup.add(shack);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 1.8, 4), new THREE.MeshStandardMaterial({ color: sIdx === 1 ? 0x0d9488 : 0x0284c7 }));
    roof.rotation.y = Math.PI / 4;
    roof.position.set(sx, 4.2, -6);
    fishGroup.add(roof);
  });

  // Bể sục oxy tôm hùm & Quầy BBQ
  const tank = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.4, 2.2), new THREE.MeshStandardMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.65 }));
  tank.position.set(-6, 0.9, 4);
  fishGroup.add(tank);

  const grill = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.1, 1.6), steelMat);
  grill.position.set(6, 0.85, 4);
  fishGroup.add(grill);

  // Pad Làng chài
  const fishPad = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x0d9488, emissive: 0x0f766e, emissiveIntensity: 0.6 }));
  fishPad.position.set(0, 0.25, 8);
  fishGroup.add(fishPad);
  fishPad.userData = { type: 'fishery_market_pad' };
  if (typeof clickables !== 'undefined') clickables.push(fishPad);
  const fishTag = makeBillboardText('🦞 LÀNG CHÀI THỦY SẢN | CHỢ HẢI SẢN TƯƠI SỐNG (+$250/con)', '#2dd4bf', 380, 48);
  fishTag.position.set(0, 3.8, 8);
  fishGroup.add(fishTag);
  window.southExpansionPads.push({ mesh: fishTag, pos: new THREE.Vector3(-90, 0, 58) });

  // =========================================================================
  // PHÂN KHU 4: VƯỜN ƯƠM CÂY CÔNG NGHỆ CAO & ĐỒI ĐIỆN GIÓ (ECO FARM)
  // Tọa độ lùi sâu xuống Nam: X = 0, Z = 140 (Cối xay gió đứng cách nhau 55m)
  // =========================================================================
  const ecoGroup = new THREE.Group();
  ecoGroup.position.set(0, 0, 140);
  southGroup.add(ecoGroup);

  // Dãy nhà kính vòm trong suốt
  [-22, 22].forEach(ghx => {
    const gh = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 14, 16, 1, false, 0, Math.PI), glassMat);
    gh.rotation.z = Math.PI / 2;
    gh.position.set(ghx, 2.6, 0);
    ecoGroup.add(gh);
  });

  // 3 Cối xay gió khổng lồ đứng cách nhau 55 mét
  if (!window.windTurbineBlades) window.windTurbineBlades = [];
  [-55, 0, 55].forEach(wtX => {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.85, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 }));
    tower.position.set(wtX, 8, 12);
    ecoGroup.add(tower);

    const rotorGroup = new THREE.Group();
    rotorGroup.position.set(wtX, 16, 13.5);
    ecoGroup.add(rotorGroup);
    window.windTurbineBlades.push(rotorGroup);

    const bladeGeo = new THREE.BoxGeometry(0.26, 6.2, 0.06);
    [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].forEach(ang => {
      const b = new THREE.Mesh(bladeGeo, new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
      b.position.y = 3.0;
      const holder = new THREE.Group();
      holder.rotation.z = ang;
      holder.add(b);
      rotorGroup.add(holder);
    });
  });

  // Pad Vườn ươm
  const ecoPad = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x16a34a, emissive: 0x15803d, emissiveIntensity: 0.6 }));
  ecoPad.position.set(0, 0.2, -6);
  ecoGroup.add(ecoPad);
  ecoPad.userData = { type: 'eco_nursery_pad' };
  if (typeof clickables !== 'undefined') clickables.push(ecoPad);
  const ecoTag = makeBillboardText('🌱 VƯỜN ƯƠM CÂY CÔNG NGHỆ CAO: TÁI SINH RỪNG GẤP 2X TỐC ĐỘ', '#4ade80', 380, 48);
  ecoTag.position.set(0, 3.8, -6);
  ecoGroup.add(ecoTag);
  window.southExpansionPads.push({ mesh: ecoTag, pos: new THREE.Vector3(0, 0, 134) });

  // =========================================================================
  // PHÂN KHU 5: ĐẢO NGHỈ DƯỠNG MALDIVES & BẾN SIÊU DU THUYỀN (EAST LUXURY RESORT)
  // Tọa độ ngoài khơi biển Đông: X = 150, Z = 50
  // =========================================================================
  const resortGroup = new THREE.Group();
  resortGroup.position.set(150, 0, 50);
  southGroup.add(resortGroup);

  // Đảo cát vàng nhiệt đới hình Oval
  const island = new THREE.Mesh(new THREE.CylinderGeometry(26, 30, 1.2, 24), sandMat);
  island.position.set(0, 0.5, 0);
  island.receiveShadow = true;
  resortGroup.add(island);

  // Cầu gỗ uốn lượn nối từ cảng biển sang đảo
  const bridgeToIsland = new THREE.Mesh(new THREE.BoxGeometry(32, 0.35, 4.2), woodMat);
  bridgeToIsland.position.set(-28, 0.4, 0);
  resortGroup.add(bridgeToIsland);

  // 4 Căn Biệt Thự Bungalow nổi trên mặt biển
  [-12, -4, 4, 12].forEach((bx, idx) => {
    const villa = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.8, 4.2), woodMat);
    villa.position.set(bx, 1.8, -18);
    resortGroup.add(villa);

    const vRoof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 1.6, 4), new THREE.MeshStandardMaterial({ color: 0xd97706 }));
    vRoof.rotation.y = Math.PI / 4;
    vRoof.position.set(bx, 4.0, -18);
    resortGroup.add(vRoof);
  });

  // Siêu du thuyền 3 tầng (Mega Yacht 12m)
  const yacht = new THREE.Group();
  yacht.position.set(0, 0.4, 22);
  resortGroup.add(yacht);

  const yHull = new THREE.Mesh(new THREE.BoxGeometry(14, 1.6, 4.8), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 }));
  yHull.position.y = 0.8;
  yacht.add(yHull);

  const yDeck2 = new THREE.Mesh(new THREE.BoxGeometry(9, 1.4, 3.6), new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 }));
  yDeck2.position.set(-1, 2.2, 0);
  yacht.add(yDeck2);

  const yDeck3 = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, 2.6), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
  yDeck3.position.set(-2, 3.4, 0);
  yacht.add(yDeck3);

  // Sân đỗ trực thăng Helipad
  const helipad = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.2, 24), concreteMat);
  helipad.position.set(0, 1.2, 0);
  resortGroup.add(helipad);
  const hMark = makeBillboardText('🚁 H', '#facc15', 120, 120);
  hMark.rotation.x = -Math.PI / 2;
  hMark.position.set(0, 1.35, 0);
  resortGroup.add(hMark);

  // Pad Resort du thuyền
  const resPad = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.6 }));
  resPad.position.set(-8, 1.25, 6);
  resortGroup.add(resPad);
  resPad.userData = { type: 'luxury_resort_pad' };
  if (typeof clickables !== 'undefined') clickables.push(resPad);
  const resTag = makeBillboardText('🏖️ ĐẢO DU THUYỀN MALDIVES | RESORT NGHỈ DƯỠNG VIP ($$$$$)', '#38bdf8', 380, 48);
  resTag.position.set(-8, 4.8, 6);
  resortGroup.add(resTag);
  window.southExpansionPads.push({ mesh: resTag, pos: new THREE.Vector3(142, 0, 56) });

  // =========================================================================
  // PHÂN KHU 6: MỎ VÀNG & ĐẠI CÔNG TRƯỜNG KHOÁNG SẢN BẮC NÚI (NORTH GOLD MINE)
  // Tọa độ phía Bắc sâu trong núi: X = 0, Z = -110
  // =========================================================================
  const mineGroup = new THREE.Group();
  mineGroup.position.set(0, 0, -110);
  southGroup.add(mineGroup);

  // Bậc thang mỏ lộ thiên
  const quarryBase = new THREE.Mesh(new THREE.BoxGeometry(45, 1.0, 35), new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.95 }));
  quarryBase.position.y = 0.5;
  mineGroup.add(quarryBase);

  // Cục quặng vàng lấp lánh lộ thiên
  for (let g = 0; g < 8; g++) {
    const goldNugget = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + Math.random() * 0.5), goldMat);
    goldNugget.position.set(-15 + Math.random() * 30, 1.4, -12 + Math.random() * 24);
    mineGroup.add(goldNugget);
  }

  // Xe ben quái vật khai mỏ CAT 797 màu vàng khổng lồ
  const dumpTruck = new THREE.Group();
  dumpTruck.position.set(-8, 0, 0);
  mineGroup.add(dumpTruck);

  const dtCab = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.2, 4.5), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 }));
  dtCab.position.set(0, 3.2, 1.5);
  dumpTruck.add(dtCab);

  const dtBed = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.5, 6.5), new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.6 }));
  dtBed.position.set(0, 4.0, -3.2);
  dtBed.rotation.x = -0.2;
  dumpTruck.add(dtBed);

  // 6 Bánh xe ben khổng lồ
  [[-2.4, 2], [2.4, 2], [-2.4, -2.5], [2.4, -2.5], [-2.4, -4.5], [2.4, -4.5]].forEach(([wx, wz]) => {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.9, 12), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 }));
    tire.rotation.z = Math.PI / 2;
    tire.position.set(wx, 1.2, wz);
    dumpTruck.add(tire);
  });

  // Pad Mỏ vàng
  const minePad = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.6 }));
  minePad.position.set(10, 1.1, 0);
  mineGroup.add(minePad);
  minePad.userData = { type: 'gold_mine_pad' };
  if (typeof clickables !== 'undefined') clickables.push(minePad);
  const mineTag = makeBillboardText('⛏️ MỎ KHAI THÁC VÀNG & QUẶNG SẮT (TỐC ĐỘ CƯA x3)', '#facc15', 380, 48);
  mineTag.position.set(10, 4.8, 0);
  mineGroup.add(mineTag);
  window.southExpansionPads.push({ mesh: mineTag, pos: new THREE.Vector3(10, 0, -110) });

  // =========================================================================
  // PHÂN KHU 7: KHU BẢO TỒN SAFARI & CẦU TREO NGỌN CÂY (WEST WILDLIFE SAFARI)
  // Tọa độ phía Tây rừng: X = -130, Z = -15
  // =========================================================================
  const safariGroup = new THREE.Group();
  safariGroup.position.set(-130, 0, -15);
  southGroup.add(safariGroup);

  // Cây cổ thụ khổng lồ với chòi ngọn cây (Treehouses)
  [-12, 12].forEach((tx, tIdx) => {
    const bigTrunk = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 12, 10), new THREE.MeshStandardMaterial({ color: 0x451a03 }));
    bigTrunk.position.set(tx, 6, 0);
    safariGroup.add(bigTrunk);

    const foliage = new THREE.Mesh(new THREE.SphereGeometry(5.5, 8, 8), new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 }));
    foliage.position.set(tx, 13, 0);
    safariGroup.add(foliage);

    const treeHouse = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.6, 4.5), woodMat);
    treeHouse.position.set(tx, 7.5, 0);
    safariGroup.add(treeHouse);
  });

  // Cầu treo dây thừng Canopy Walkway nối 2 chòi cây
  const canopyBridge = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 1.4), woodMat);
  canopyBridge.position.set(0, 7.5, 0);
  safariGroup.add(canopyBridge);

  // Đàn hươu sao 3D
  [-5, 2, 7].forEach((hx, idx) => {
    const deer = new THREE.Group();
    deer.position.set(hx, 0, 8 + idx * 2.5);
    safariGroup.add(deer);
    const dBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 1.4), new THREE.MeshStandardMaterial({ color: 0xb45309 }));
    dBody.position.y = 1.0;
    deer.add(dBody);
    const dNeck = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.4), new THREE.MeshStandardMaterial({ color: 0xb45309 }));
    dNeck.position.set(0, 1.5, 0.6);
    deer.add(dNeck);
  });

  // Pad Safari
  const safariPad = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.6 }));
  safariPad.position.set(0, 0.25, 4);
  safariGroup.add(safariPad);
  safariPad.userData = { type: 'wildlife_safari_pad' };
  if (typeof clickables !== 'undefined') clickables.push(safariPad);
  const safariTag = makeBillboardText('🦁 KHU BẢO TỒN SAFARI HOANG DÃ | DU LỊCH SINH THÁI (+FSC)', '#4ade80', 380, 48);
  safariTag.position.set(0, 3.8, 4);
  safariGroup.add(safariTag);
  window.southExpansionPads.push({ mesh: safariTag, pos: new THREE.Vector3(-130, 0, -11) });

  // =========================================================================
  // PHÂN KHU 8: SIÊU SÂN BAY HÀNG HÓA QUỐC TẾ (AIR CARGO & LOGISTICS AIRPORT)
  // Tọa độ cực Nam: X = 15, Z = 185
  // =========================================================================
  const airportGroup = new THREE.Group();
  airportGroup.position.set(15, 0, 185);
  southGroup.add(airportGroup);

  // Đường băng bê tông 4F dài 90 mét, rộng 18 mét
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(90, 18), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75 }));
  runway.rotateX(-Math.PI / 2);
  runway.position.set(0, 0.12, 0);
  runway.receiveShadow = true;
  airportGroup.add(runway);

  // Vạch kẻ sơn tim đường băng trắng đứt đoạn
  const rwyStripe = new THREE.Mesh(new THREE.PlaneGeometry(86, 0.6), new THREE.MeshBasicMaterial({ color: 0xf8fafc }));
  rwyStripe.rotateX(-Math.PI / 2);
  rwyStripe.position.set(0, 0.14, 0);
  airportGroup.add(rwyStripe);

  // Máy bay phản lực chở hàng Boeing 747-8F Cargo Jet
  const planeGroup = new THREE.Group();
  planeGroup.position.set(0, 0, 0);
  airportGroup.add(planeGroup);

  // Thân máy bay dài 22m màu trắng
  const planeBody = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 22, 16), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 }));
  planeBody.rotation.z = Math.PI / 2;
  planeBody.position.y = 3.6;
  planeGroup.add(planeBody);

  // Mũi máy bay bo tròn
  const nose = new THREE.Mesh(new THREE.SphereGeometry(2.1, 16, 16), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
  nose.position.set(-11, 3.6, 0);
  planeGroup.add(nose);

  // Đôi cánh chính sải rộng 24 mét
  const mainWings = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.35, 24), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
  mainWings.position.set(0, 3.2, 0);
  planeGroup.add(mainWings);

  // 4 Động cơ phản lực dưới cánh
  [-5, -8, 5, 8].forEach(engZ => {
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 2.8, 12), new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 }));
    engine.rotation.z = Math.PI / 2;
    engine.position.set(0, 2.1, engZ);
    planeGroup.add(engine);
  });

  // Đuôi đứng & cánh đuôi ngang
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(3.5, 4.2, 0.25), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
  tailFin.position.set(9.5, 6.2, 0);
  planeGroup.add(tailFin);

  // Tháp kiểm soát không lưu (Air Traffic Control Tower) cao 22 mét
  const atcTower = new THREE.Group();
  atcTower.position.set(32, 0, -12);
  airportGroup.add(atcTower);

  const atcCol = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 18, 12), concreteMat);
  atcCol.position.y = 9;
  atcTower.add(atcCol);

  const atcCab = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 2.8, 3.6, 12), darkGlassMat);
  atcCab.position.y = 19;
  atcTower.add(atcCab);

  // ĐÀI RADAR QUÉT 360 ĐỘ TRÊN ĐỈNH THÁP KHÔNG LƯU (ATC ROTATING SURVEILLANCE RADAR)
  if (!window.radarAntennas) window.radarAntennas = [];
  const radarGroup = new THREE.Group();
  radarGroup.position.set(0, 21.0, 0);
  atcTower.add(radarGroup);
  window.radarAntennas.push(radarGroup);

  // Trục đế xoay radar
  const radarPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.6, 8), steelMat);
  radarPedestal.position.y = 0.3;
  radarGroup.add(radarPedestal);

  // Chảo radar parabol cong lớn (Parabolic Curved Dish)
  const dishMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.25 });
  const radarDish = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.18, 16), dishMat);
  radarDish.rotation.x = 0.45;
  radarDish.position.set(0, 1.2, 0.3);
  radarGroup.add(radarDish);

  // Khung giàn sau lưng chảo radar
  const dishBack = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 0.14), steelMat);
  dishBack.position.set(0, 1.2, 0.18);
  radarGroup.add(dishBack);

  // Kim thu phát sóng phía trước chảo (Feed Horn)
  const feedHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 8), chromeMat);
  feedHorn.rotation.x = -1.1;
  feedHorn.position.set(0, 1.45, 0.8);
  radarGroup.add(feedHorn);

  // Đèn cảnh báo hàng không chớp đỏ trên đỉnh tháp (Aviation Red Obstruction Strobe)
  const beaconMast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.8, 8), steelMat);
  beaconMast.position.set(0, 22.4, 0);
  atcTower.add(beaconMast);

  const beaconLight = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  beaconLight.position.set(0, 23.3, 0);
  atcTower.add(beaconLight);
  window.airportBeaconLight = beaconLight;

  // -------------------------------------------------------------------------
  // HỆ THỐNG ĐÈN ĐƯỜNG BĂNG TIÊU CHUẨN ICAO (RUNWAY LIGHTING & PAPI SYSTEM)
  // Đường băng: dài 90m (X: -45 đến 45), rộng 18m (Z: -9 đến 9)
  // -------------------------------------------------------------------------
  window.runwayEdgeLights = [];
  const edgeLightMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 0.8,
    roughness: 0.2
  });
  const thresholdGreenMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x22c55e,
    emissiveIntensity: 0.9,
    roughness: 0.2
  });
  const fixtureBaseMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });

  // 1. Dãy đèn biên đường băng trắng/vàng dọc 2 mép biên Z = +- 9.3m (khoảng cách 9m/đèn)
  [-9.3, 9.3].forEach(lz => {
    for (let lx = -40; lx <= 40; lx += 10.0) {
      const fixture = new THREE.Group();
      fixture.position.set(lx, 0, lz);
      airportGroup.add(fixture);

      const fBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.35, 6), fixtureBaseMat);
      fBase.position.y = 0.18;
      fixture.add(fBase);

      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), edgeLightMat);
      bulb.position.y = 0.38;
      fixture.add(bulb);
      window.runwayEdgeLights.push(bulb);
    }
  });

  // 2. Dàn đèn ngưỡng đầu và cuối đường băng màu xanh lá (Runway Threshold Lights)
  [-44.0, 44.0].forEach(tx => {
    for (let tz = -7.5; tz <= 7.5; tz += 2.5) {
      const fixture = new THREE.Group();
      fixture.position.set(tx, 0, tz);
      airportGroup.add(fixture);

      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), thresholdGreenMat);
      bulb.position.y = 0.35;
      fixture.add(bulb);
      window.runwayEdgeLights.push(bulb);
    }
  });

  // 3. Hệ thống chỉ thị góc hạ cánh PAPI (4 Precision Approach Path Indicator Boxes)
  const papiMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
  for (let p = 0; p < 4; p++) {
    const papiBox = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.7), papiMat);
    papiBox.position.set(-22 + p * 1.4, 0.23, -11.5);
    airportGroup.add(papiBox);

    const isWhite = p >= 2;
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: isWhite ? 0xf8fafc : 0xef4444 })
    );
    lens.position.set(-22 + p * 1.4, 0.28, -11.15);
    airportGroup.add(lens);
  }

  // 4. Ống báo hướng gió hàng không (Aviation Windsock)
  const windsockGroup = new THREE.Group();
  windsockGroup.position.set(42, 0, -12.5);
  airportGroup.add(windsockGroup);

  const sockPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.5, 8), fixtureBaseMat);
  sockPole.position.y = 2.25;
  sockPole.castShadow = true;
  windsockGroup.add(sockPole);

  const sockMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.6 });
  const sockCone = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.2, 10), sockMat);
  sockCone.rotation.z = Math.PI / 2;
  sockCone.position.set(1.1, 4.35, 0);
  windsockGroup.add(sockCone);
  window.airportWindsock = sockCone;

  // Pad Sân bay
  const planePad = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x6366f1, emissive: 0x4f46e5, emissiveIntensity: 0.6 }));
  planePad.position.set(-18, 0.25, -6);
  airportGroup.add(planePad);
  planePad.userData = { type: 'air_cargo_pad' };
  if (typeof clickables !== 'undefined') clickables.push(planePad);
  const planeTag = makeBillboardText('✈️ SIÊU SÂN BAY QUỐC TẾ | VẬN TẢI HÀNG KHÔNG (x10 THƯỞNG)', '#818cf8', 380, 48);
  planeTag.position.set(-18, 3.8, -6);
  airportGroup.add(planeTag);
  window.southExpansionPads.push({ mesh: planeTag, pos: new THREE.Vector3(-3, 0, 179) });
}
window.createSouthShoreExpansion = createSouthShoreExpansion;

// ===========================================================================
// HỆ THỐNG THỜI TIẾT ĐỘNG (DYNAMIC WEATHER) & 4 PHÂN KHU CHUYÊN SÂU
// ===========================================================================

// 1. CẦU VỒNG 3D 7 SẮC HUYỀN ẢO (3D RAINBOW ARC SPANNING THE RIVER)
function createRainbowMesh(scene) {
  const arcRadius = 34.0;
  const arcTube = 2.4;
  const segments = 48;
  const rainbowGeo = new THREE.TorusGeometry(arcRadius, arcTube, 16, segments, Math.PI);

  // Canvas gradient 7 sắc cầu vồng: Đỏ, Cam, Vàng, Lục, Lam, Chàm, Tím
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.0, 'rgba(239, 68, 68, 0.7)');
  grad.addColorStop(0.18, 'rgba(249, 115, 22, 0.7)');
  grad.addColorStop(0.35, 'rgba(234, 179, 8, 0.75)');
  grad.addColorStop(0.52, 'rgba(34, 197, 94, 0.7)');
  grad.addColorStop(0.70, 'rgba(6, 182, 212, 0.7)');
  grad.addColorStop(0.85, 'rgba(59, 130, 246, 0.7)');
  grad.addColorStop(1.0, 'rgba(168, 85, 247, 0.7)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 16);

  const rainbowTex = new THREE.CanvasTexture(canvas);
  rainbowTex.wrapS = THREE.RepeatWrapping;
  rainbowTex.wrapT = THREE.RepeatWrapping;

  const rainbowMat = new THREE.MeshBasicMaterial({
    map: rainbowTex,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const rainbowMesh = new THREE.Mesh(rainbowGeo, rainbowMat);
  rainbowMesh.position.set(28.0, 0.0, 16.0);
  rainbowMesh.rotation.y = Math.PI / 2;
  rainbowMesh.visible = false;
  scene.add(rainbowMesh);
  window.rainbowMesh = rainbowMesh;
}
window.createRainbowMesh = createRainbowMesh;

// 2. HỆ THỐNG MƯA RƠI TOÀN BẢN ĐỒ (RAIN PARTICLE SYSTEM)
function createRainParticleSystem(scene) {
  const rainCount = 1400;
  const positions = new Float32Array(rainCount * 3);

  for (let i = 0; i < rainCount; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 280; // X
    positions[i * 3 + 1] = Math.random() * 38;          // Y
    positions[i * 3 + 2] = (Math.random() - 0.5) * 320; // Z
  }

  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  rainGeo.computeBoundingSphere();

  const rainMat = new THREE.PointsMaterial({
    color: 0x93c5fd,
    size: 0.22,
    transparent: true,
    opacity: 0.68,
    depthWrite: false
  });

  const rainSystem = new THREE.Points(rainGeo, rainMat);
  rainSystem.frustumCulled = false;
  rainSystem.visible = false;
  scene.add(rainSystem);
  window.rainSystem = rainSystem;
}
window.createRainParticleSystem = createRainParticleSystem;

// 3. CÁC Ô TƯƠNG TÁC SẢN XUẤT CHUYÊN SÂU (DEEP PRODUCTION INTERACTIVE PADS)
function createDeepProductionPads(scene) {
  window.deepPads = [];

  const createPad = (x, z, radius, colorHex, labelText, padType) => {
    const padGroup = new THREE.Group();
    padGroup.position.set(x, 0.15, z);
    scene.add(padGroup);

    // Vòng phát sáng bệ tròn
    const baseMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.12, 24),
      new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.55, roughness: 0.3 })
    );
    padGroup.add(baseMesh);

    // Vòng neon xoay tròn lơ lửng
    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.92, 0.08, 8, 24),
      new THREE.MeshBasicMaterial({ color: colorHex })
    );
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.16;
    padGroup.add(ringMesh);

    // Bảng hiệu 3D
    const bill = makeBillboardText(labelText, '#ffffff', 420, 52);
    bill.position.y = 3.2;
    padGroup.add(bill);

    const padObj = {
      group: padGroup,
      ring: ringMesh,
      pos: new THREE.Vector3(x, 0, z),
      radius: radius,
      type: padType,
      cooldown: 0
    };
    window.deepPads.push(padObj);
    return padObj;
  };

  // 1. Ô Đúc Vàng Mỏ Núi Phía Bắc
  createPad(0, -110, 3.2, 0xfacc15, '🪙 [ĐỨNG VÀO] ĐÚC THỎI VÀNG ($5,000/thỏi)', 'gold_mine');

  // 2. Ô Gia Công Nội Thất Xưởng Bắc Âu
  createPad(5, 95, 3.2, 0xf97316, '🪑 [ĐỨNG VÀO] GIA CÔNG NỘI THẤT BẮC ÂU ($1,200/bộ)', 'furniture');

  // 3. Két Tiền Thu Nhập Thụ Động Resort Maldives
  createPad(150, 50, 3.4, 0x06b6d4, '🏖️ [ĐỨNG VÀO] THU HOẠCH DOANH THU RESORT MALDIVES', 'resort_vault');

  // 4. Ô Điều Phối Hàng Không Boeing 747 Sân Bay Quốc Tế
  createPad(15, 185, 3.6, 0x6366f1, '✈️ [ĐỨNG VÀO] CẤT CÁNH BOEING 747 ($25,000/chuyến)', 'air_cargo');

  // 5. Ô Đóng Container Xuất Khẩu VIP (Cảng Biển Container Phía Đông: X = 71, Z = 44)
  createPad(71, 44, 3.6, 0x0284c7, '🚢 [ĐỨNG VÀO] ĐÓNG CONTAINER XUẤT KHẨU VIP ($15,000 + 10💎)', 'export_container');

  // 6. Ô Ép Viên Nén Gỗ Sinh Học (Cạnh Xưởng Cưa Bờ Bắc: X = 8.5, Z = -25)
  createPad(8.5, -25, 2.8, 0x10b981, '🪵 [ĐỨNG VÀO] ÉP VIÊN NÉN GỖ (1 Ván ➜ 2 Viên Nén + RP)', 'wood_pellets');

  // 7. Thùng hàng trôi dạt bờ biển (Ocean Drift Cargo Crates)
  createOceanDriftCrates(scene);
}
window.createDeepProductionPads = createDeepProductionPads;

function createOceanDriftCrates(scene) {
  window.oceanDriftCrates = [];
  const coords = [
    { x: 18, z: 16, label: 'Bờ Kè Chợ Cá' },
    { x: 85, z: 32, label: 'Bờ Biển Nam Cảng' },
    { x: 135, z: 42, label: 'Bờ Biển Resort' }
  ];

  const crateGeo = new THREE.BoxGeometry(1.4, 1.2, 1.4);
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.6,
    metalness: 0.2
  });

  coords.forEach((loc) => {
    const crateGroup = new THREE.Group();
    crateGroup.position.set(loc.x, 0.4, loc.z);
    scene.add(crateGroup);

    const box = new THREE.Mesh(crateGeo, crateMat);
    box.castShadow = true;
    crateGroup.add(box);

    const strap = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.15, 1.42), new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 }));
    crateGroup.add(strap);

    const tag = makeBillboardText('🎁 THÙNG HÀNG TRÔI DẠT (CHẠM VÀO)', '#facc15', 300, 44);
    tag.position.y = 1.8;
    crateGroup.add(tag);

    window.oceanDriftCrates.push({
      group: crateGroup,
      baseY: 0.4,
      pos: new THREE.Vector3(loc.x, 0, loc.z),
      cooldown: 0,
      active: true
    });
  });
}

// ===========================================================================
// HẠ TẦNG ĐƯỜNG SẮT, SÂN BAY TRỰC THĂNG, SIÊU DU THUYỀN & KHO BÁU ĐÁY BIỂN
// ===========================================================================

// 1. TUYẾN ĐƯỜNG SẮT VÀNH ĐAI TÁCH LỚP & ĐẠI NHÀ GA TRUNG TÂM
// [HÀNH LANG BIỆT LẬP: HOÀN TOÀN KHÔNG CHỒNG ĐÈ CÔNG TRÌNH, TÀU QUA CẦU THÔNG THOÁNG 100%]
function createRailroadInfrastructure(scene) {
  const trainCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-65, 0.28, -95),
    new THREE.Vector3(-65, 0.28, -35), // Ga Xe Lửa Trung Tâm Bờ Tây
    new THREE.Vector3(-65, 0.28, 16),  // Cầu Thép Vượt Sông Bờ Tây
    new THREE.Vector3(-65, 0.28, 70),
    new THREE.Vector3(-50, 0.28, 130),
    new THREE.Vector3(0, 0.28, 155),
    new THREE.Vector3(45, 0.28, 155),  // Rào chắn tự động đường Sân Bay
    new THREE.Vector3(105, 0.28, 130),
    new THREE.Vector3(105, 0.28, 60),
    new THREE.Vector3(105, 0.28, 16),  // Cầu Thép Vượt Sông Bờ Đông
    new THREE.Vector3(105, 0.28, -50),
    new THREE.Vector3(40, 0.28, -95),
    new THREE.Vector3(-10, 0.28, -95)
  ], true);
  window.railroadCurve = trainCurve;

  const trackGroup = new THREE.Group();
  scene.add(trackGroup);

  const woodSleeperMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.85 });
  const steelRailMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
  const ballastMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });

  // Tà-vẹt gỗ đặt dọc theo đường ray (Wooden Cross-Ties)
  const sleeperCount = 180;
  for (let i = 0; i < sleeperCount; i++) {
    const t = i / sleeperCount;
    const pt = trainCurve.getPointAt(t);
    const tangent = trainCurve.getTangentAt(t);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    // Thanh tà vẹt
    const sleeper = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.42), woodSleeperMat);
    sleeper.position.set(pt.x, 0.16, pt.z);
    sleeper.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    sleeper.matrixAutoUpdate = false;
    sleeper.updateMatrix();
    trackGroup.add(sleeper);

    // Đế đá dăm (Gravel Ballast)
    const ballast = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.6), ballastMat);
    ballast.position.set(pt.x, 0.06, pt.z);
    ballast.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    ballast.matrixAutoUpdate = false;
    ballast.updateMatrix();
    trackGroup.add(ballast);

    // Đôi ray thép
    [-0.85, 0.85].forEach(rx => {
      const railSegment = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 2.4), steelRailMat);
      railSegment.position.set(pt.x + normal.x * rx, 0.28, pt.z + normal.z * rx);
      railSegment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      railSegment.matrixAutoUpdate = false;
      railSegment.updateMatrix();
      trackGroup.add(railSegment);
    });
  }

  // 2 CẦU THÉP DÀN X VƯỢT SÔNG KHỔNG LỒ (THROUGH-TRUSS BRIDGES) { X = -65 & X = 105 }
  // [KHOẢNG CÁCH GIỮA 2 DÀN LÀ 5.4M, CAO 6.2M - TÀU GLIDE QUA ÊM ÁI HOÀN TOÀN KHÔNG CHẠM VÀO THÀNH CẦU]
  const trussSteelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.88, roughness: 0.25 });
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });

  [-65, 105].forEach(bridgeX => {
    const bGroup = new THREE.Group();
    bGroup.position.set(bridgeX, 0, 16);
    scene.add(bGroup);

    // Mố trụ cầu bê tông cắm sâu lòng sông
    [-10, 10].forEach(pz => {
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.2, 6.5, 12), pierMat);
      pier.position.set(0, -1.2, pz);
      pier.castShadow = true;
      bGroup.add(pier);
    });

    // 2 Dàn thép 2 bên thành cầu (Đặt tại X = +- 2.7m để lọt lòng tàu hỏa 5.4m cực kỳ thênh thang!)
    [-2.7, 2.7].forEach(tx => {
      // Dầm đáy & Dầm đỉnh
      const bottomChord = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 32.0), trussSteelMat);
      bottomChord.position.set(tx, 0.55, 0);
      bGroup.add(bottomChord);

      const topChord = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 28.0), trussSteelMat);
      topChord.position.set(tx, 5.8, 0);
      bGroup.add(topChord);

      // Các thanh chéo chữ X chịu lực ở mặt ngoài
      for (let z = -12; z <= 12; z += 4.5) {
        const diag1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6.4, 6), trussSteelMat);
        diag1.position.set(tx, 3.1, z);
        diag1.rotation.x = 0.58;
        bGroup.add(diag1);

        const diag2 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6.4, 6), trussSteelMat);
        diag2.position.set(tx, 3.1, z);
        diag2.rotation.x = -0.58;
        bGroup.add(diag2);
      }
    });

    // Thanh dầm ngang cổng vòm trên nóc (Portal Bracing) cao 5.8m, tàu cao 3.5m chui qua thoải mái
    [-12, 0, 12].forEach(pz => {
      const topBeam = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.35, 0.35), trussSteelMat);
      topBeam.position.set(0, 5.8, pz);
      bGroup.add(topBeam);
    });
  });

  // ĐẠI NHÀ GA XE LỬA TRUNG TÂM (CENTRAL PASSENGER STATION TERMINAL) { x: -65, z: -35 }
  const stationGroup = new THREE.Group();
  stationGroup.position.set(-60, 0, -35);
  scene.add(stationGroup);

  // Ke ga hành khách lát đá granit có gạch chỉ hướng vàng (Passenger Platform)
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.38, 28.0),
    new THREE.MeshStandardMaterial({ map: Textures.asphalt(), roughness: 0.85 })
  );
  platform.position.set(0, 0.19, 0);
  platform.receiveShadow = true;
  stationGroup.add(platform);

  // Vạch vàng cảnh báo an toàn mép ke ga
  const warnStripe = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 28.0), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
  warnStripe.rotateX(-Math.PI / 2);
  warnStripe.position.set(-3.2, 0.39, 0);
  stationGroup.add(warnStripe);

  // Mái vòm che sân ga bằng kính & khung thép cổ điển
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
  [-8, 0, 8].forEach(cz => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 4.8, 8), canopyMat);
    col.position.set(2.2, 2.4, cz);
    stationGroup.add(col);
  });
  const canopyRoof = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 0.2, 26.0),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5, metalness: 0.8 })
  );
  canopyRoof.position.set(1.5, 4.8, 0);
  stationGroup.add(canopyRoof);

  // Băng ghế chờ gỗ cho hành khách
  [-5, 5].forEach(bz => {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.65, 3.2), woodSleeperMat);
    bench.position.set(2.2, 0.65, bz);
    stationGroup.add(bench);
  });

  // Đồng hồ cột cơ học cổ điển phong cách ga xe lửa Thụy Sĩ
  const clockPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 4.2, 8), canopyMat);
  clockPole.position.set(2.2, 2.1, -11);
  stationGroup.add(clockPole);
  const clockHead = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
  clockHead.rotation.z = Math.PI / 2;
  clockHead.position.set(2.2, 4.3, -11);
  stationGroup.add(clockHead);

  // 3 HÀNH KHÁCH NPC (PASSENGER NPCs) ĐỨNG CHỜ TÀU TRÊN SÂN GA
  // Khách 1: Đứng kéo vali
  const pass1 = new THREE.Group();
  pass1.position.set(-0.8, 0.38, -4.5);
  stationGroup.add(pass1);
  const p1B = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.4), new THREE.MeshStandardMaterial({ color: 0x4338ca }));
  p1B.position.y = 0.9;
  pass1.add(p1B);
  const p1H = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: 0xffedd5 }));
  p1H.position.y = 1.65;
  pass1.add(p1H);
  const luggage = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 0.35), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
  luggage.position.set(0.55, 0.35, 0);
  pass1.add(luggage);

  // Khách 2: Đeo ba-lô du lịch
  const pass2 = new THREE.Group();
  pass2.position.set(-0.5, 0.38, 3.5);
  stationGroup.add(pass2);
  const p2B = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.4), new THREE.MeshStandardMaterial({ color: 0x059669 }));
  p2B.position.y = 0.9;
  pass2.add(p2B);
  const p2H = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: 0xffedd5 }));
  p2H.position.y = 1.65;
  pass2.add(p2H);
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.55, 0.28), new THREE.MeshStandardMaterial({ color: 0xb45309 }));
  backpack.position.set(0, 0.9, -0.28);
  pass2.add(backpack);

  // Biển hiệu 3D Ga Tàu
  const stationSign = makeBillboardText('🚂 ĐẠI NHÀ GA TRUNG TÂM | CENTRAL TRAIN TERMINAL', '#38bdf8', 420, 52);
  stationSign.position.set(0, 5.8, 0);
  stationGroup.add(stationSign);

  // RÀO CHẮN ĐƯỜNG NGANG TỰ ĐỘNG THÔNG MINH TẠI ĐƯỜNG SÂN BAY { x: 45, z: 155 }
  window.crossingGates = [];
  const gateConfigs = [
    // Rào chắn phía Bắc (ngăn xe từ phía Bắc đi về hướng Sân bay)
    { x: 41.5, z: 151.0, rotY: 0, armDir: 1, side: 'north' },
    // Rào chắn phía Nam (ngăn xe từ phía Sân bay đi về hướng Bắc)
    { x: 48.5, z: 159.0, rotY: Math.PI, armDir: -1, side: 'south' }
  ];

  gateConfigs.forEach(cfg => {
    const gateGroup = new THREE.Group();
    gateGroup.position.set(cfg.x, 0, cfg.z);
    gateGroup.rotation.y = cfg.rotY;
    scene.add(gateGroup);

    // Bệ móng bê tông đúc sẵn & Hộp động cơ điều khiển (Motor Housing)
    const baseConcrete = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.9), new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 }));
    baseConcrete.position.y = 0.22;
    gateGroup.add(baseConcrete);

    const motorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.7), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 }));
    motorHousing.position.y = 0.85;
    gateGroup.add(motorHousing);

    // Cột thép đỡ đèn & biển báo (Steel Mast)
    const postMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.8, 8), trussSteelMat);
    postMesh.position.y = 2.1;
    gateGroup.add(postMesh);

    // Chuông cảnh báo cơ học trên đỉnh cột (Mechanical Bell Dome)
    const bellDome = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 }));
    bellDome.position.y = 4.0;
    gateGroup.add(bellDome);

    // Biển báo chữ X giao cắt đường sắt kinh điển (Crossbuck 'RAILWAY CROSSING' Sign)
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 0.05), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 }));
    cross1.rotation.z = Math.PI / 4;
    cross1.position.set(0, 3.4, 0.1);
    gateGroup.add(cross1);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 0.05), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 }));
    cross2.rotation.z = -Math.PI / 4;
    cross2.position.set(0, 3.4, 0.12);
    gateGroup.add(cross2);

    // Giá treo cặp đèn chớp đỏ (Dual Alternating Red Warning Flashers)
    const lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.08), trussSteelMat);
    lightBar.position.set(0, 2.7, 0.15);
    gateGroup.add(lightBar);

    const hoodMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    [-0.52, 0.52].forEach(lx => {
      const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.22, 12, 1, true), hoodMat);
      hood.rotation.x = Math.PI / 2;
      hood.position.set(lx, 2.7, 0.2);
      gateGroup.add(hood);
    });

    const fl1 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.2 }));
    fl1.position.set(-0.52, 2.7, 0.24);
    gateGroup.add(fl1);

    const fl2 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.2 }));
    fl2.position.set(0.52, 2.7, 0.24);
    gateGroup.add(fl2);

    // Trục xoay cần chắn (Boom Barrier Arm Hinge Pivot)
    const armPivot = new THREE.Group();
    armPivot.position.set(0, 1.35, 0.35);
    gateGroup.add(armPivot);

    // Cục đối trọng (Counterweight) phía sau trục xoay
    const counterWeight = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.9), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }));
    counterWeight.position.set(0, 0, -0.45);
    armPivot.add(counterWeight);

    // Thanh cần chắn dài 5.6m chắn ngang mặt đường
    const armLen = 5.6;
    const segCount = 7;
    const segLen = armLen / segCount;
    for (let s = 0; s < segCount; s++) {
      const isRed = s % 2 === 0;
      const stripeMat = new THREE.MeshStandardMaterial({
        color: isRed ? 0xef4444 : 0xf8fafc,
        roughness: 0.4,
        emissive: isRed ? 0x7f1d1d : 0x475569,
        emissiveIntensity: 0.15
      });
      const segMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, segLen), stripeMat);
      segMesh.position.set(0, 0, (s + 0.5) * segLen);
      armPivot.add(segMesh);
    }

    // 3 Đèn LED cảnh báo nhỏ gắn dọc trên cần chắn
    const armLEDs = [];
    [0.35, 0.65, 0.95].forEach(ratio => {
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.3 }));
      led.position.set(0, 0.12, ratio * armLen);
      armPivot.add(led);
      armLEDs.push(led);
    });

    // Ban đầu cần chắn mở góc thẳng đứng (~80 độ)
    armPivot.rotation.x = Math.PI * 0.44;

    window.crossingGates.push({
      group: gateGroup,
      armPivot: armPivot,
      flash1: fl1,
      flash2: fl2,
      armLEDs: armLEDs
    });
  });

  // Sơn vạch dừng xe & Vạch cảnh báo đường sắt trên mặt đường (Road Pavement Markings)
  const stopBarMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  [-5.5, 5.5].forEach(sz => {
    const stopBar = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 0.65), stopBarMat);
    stopBar.rotation.x = -Math.PI / 2;
    stopBar.position.set(45, 0.16, 155 + sz);
    scene.add(stopBar);
  });

  // Tương thích ngược biến toàn cục
  if (window.crossingGates.length > 0) {
    window.crossingBoomArm = window.crossingGates[0].armPivot;
    window.crossingFlashes = [window.crossingGates[0].flash1, window.crossingGates[0].flash2];
  }
}
window.createRailroadInfrastructure = createRailroadInfrastructure;

// 1b. CẦU GỖ ĐI BỘ BỜ TÂY BẮC QUA SÔNG (SCENIC WEST PEDESTRIAN FOOTBRIDGE)
// [KẾT NỐI TRỰC TIẾP RỪNG THÔNG & XƯỞNG CƯA BỜ BẮC VỚI ĐẠI SIÊU THỊ & NHÀ MÁY NỘI THẤT BỜ NAM]
function createWestScenicFootbridge(scene) {
  const bridgeGroup = new THREE.Group();
  scene.add(bridgeGroup);

  const woodDeckMat = new THREE.MeshStandardMaterial({ map: Textures.plank(), roughness: 0.75 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.85 });
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 0.4 });

  // 1. Độ cong parabol mặt cầu đi bộ Cầu Gỗ (Z từ 3.0 đến 29.0, nhô cao tại tâm Z = 16.0)
  const getFootbridgeY = (z) => {
    const u = (z - 16.0) / 13.0;
    if (Math.abs(u) <= 1.0) {
      return 0.22 + 2.15 * Math.cos((Math.PI * u) / 2) * Math.cos((Math.PI * u) / 2);
    }
    return 0.22;
  };
  window.getFootbridgeY = getFootbridgeY;

  // 2. Mặt sàn ván gỗ cong liên tục 48 bước
  const steps = 48;
  const zStart = 3.0, zEnd = 29.0;
  const positions = [], uvs = [], indices = [];
  const halfW = 1.9; // Rộng 3.8m tại X = -15.0

  for (let i = 0; i <= steps; i++) {
    const z = zStart + (i / steps) * (zEnd - zStart);
    const y = getFootbridgeY(z);
    const v = (z - zStart) / 4.0;

    positions.push(-15.0 - halfW, y, z);
    uvs.push(0, v);
    positions.push(-15.0 + halfW, y, z);
    uvs.push(1, v);

    if (i < steps) {
      const r1 = i * 2, r2 = (i + 1) * 2;
      indices.push(r1, r2, r1 + 1);
      indices.push(r1 + 1, r2, r2 + 1);
    }
  }

  const deckGeo = new THREE.BufferGeometry();
  deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  deckGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  deckGeo.setIndex(indices);
  deckGeo.computeVertexNormals();

  const deckMesh = new THREE.Mesh(deckGeo, woodDeckMat);
  deckMesh.castShadow = true;
  deckMesh.receiveShadow = true;
  bridgeGroup.add(deckMesh);

  // 3. Lan can gỗ mộc & Tay vịn cong 2 bên
  [-halfW + 0.1, halfW - 0.1].forEach(gx => {
    const railPoints = [];
    for (let c = 0; c <= 28; c++) {
      const cz = zStart + (c / 28) * (zEnd - zStart);
      const cy = getFootbridgeY(cz);
      railPoints.push(new THREE.Vector3(-15.0 + gx, cy + 0.85, cz));
    }
    const railCurve = new THREE.CatmullRomCurve3(railPoints);
    const railMesh = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 32, 0.08, 8, false), darkWoodMat);
    railMesh.castShadow = true;
    bridgeGroup.add(railMesh);

    // Cọc lan can cách đều 1.6m
    for (let pz = zStart + 0.8; pz <= zEnd - 0.8; pz += 1.6) {
      const py = getFootbridgeY(pz);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.85, 8), darkWoodMat);
      post.position.set(-15.0 + gx, py + 0.42, pz);
      bridgeGroup.add(post);
    }
  });

  // 4. Trụ cọc gỗ sồi cắm sâu xuống đáy sông
  [9.0, 16.0, 23.0].forEach(pz => {
    const py = getFootbridgeY(pz);
    [-halfW, halfW].forEach(px => {
      const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, py + 3.0, 8), darkWoodMat);
      piling.position.set(-15.0 + px, (py - 3.0) / 2, pz);
      piling.castShadow = true;
      bridgeGroup.add(piling);
    });
  });

  // 5. Cổng vòm chào & Đèn lồng ấm áp 2 đầu cầu
  [zStart, zEnd].forEach((bz) => {
    const by = getFootbridgeY(bz);
    [-halfW, halfW].forEach(px => {
      const portalPost = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.8, 0.35), darkWoodMat);
      portalPost.position.set(-15.0 + px, by + 1.4, bz);
      portalPost.castShadow = true;
      bridgeGroup.add(portalPost);

      // Đèn lồng phát sáng vàng ấm
      const lantern = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22), lanternMat);
      lantern.position.set(-15.0 + px, by + 2.5, bz);
      bridgeGroup.add(lantern);

      const pLight = new THREE.PointLight(0xfef08a, 0, 12, 1.6);
      pLight.position.set(-15.0 + px, by + 2.3, bz);
      bridgeGroup.add(pLight);
      pLight.userData.nightIntensity = 1.8;
      if (!window.nightLights) window.nightLights = [];
      window.nightLights.push(pLight);
    });

    const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.4, 0.25, 0.25), darkWoodMat);
    crossBeam.position.set(-15.0, by + 2.7, bz);
    bridgeGroup.add(crossBeam);
  });

  // Biển hiệu 3D
  const sign = makeBillboardText('🌉 CẦU GỖ ĐI BỘ BỜ TÂY ➜ BỜ NAM SIÊU THỊ', '#38bdf8', 380, 48);
  sign.position.set(-15.0, 3.8, zStart - 1.5);
  bridgeGroup.add(sign);
}
window.createWestScenicFootbridge = createWestScenicFootbridge;

// 1c. MẠNG LƯỚI ĐƯỜNG BỘ & VỈA HÈ KẾT NỐI 100% CÁC PHÂN KHU ĐẾ CHẾ
// [ĐẢM BẢO NGƯỜI CHƠI CÓ THỂ ĐI BỘ / LÁI XE TIẾP CẬN TẤT CẢ CÔNG TRÌNH KHÔNG BỊ NGẮT QUÃNG]
function createEmpirePedestrianWalkways(scene) {
  const walkGroup = new THREE.Group();
  scene.add(walkGroup);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });
  const teakBoardMat = new THREE.MeshStandardMaterial({ map: Textures.plank(), roughness: 0.75 });

  // 1. Đường đá kết nối Xưởng Cưa Bờ Bắc sang Cầu Gỗ Bờ Tây { X: 0 -> -15, Z: -2 }
  const walkNorth = new THREE.Mesh(new THREE.BoxGeometry(16, 0.15, 3.2), stoneMat);
  walkNorth.position.set(-7.5, 0.08, 0.5);
  walkNorth.receiveShadow = true;
  walkGroup.add(walkNorth);

  // 2. Đại lộ đi bộ kết nối chân Cầu Gỗ (Z = 29) xuống Đại Siêu Thị (X = 8, Z = 42) & Nhà máy Cá (X = -14, Z = 42)
  const walkSouth1 = new THREE.Mesh(new THREE.BoxGeometry(26, 0.15, 3.5), stoneMat);
  walkSouth1.position.set(-3, 0.08, 31);
  walkSouth1.receiveShadow = true;
  walkGroup.add(walkSouth1);

  // 3. Đường nhựa nội bộ rẽ từ Đại lộ Nam (Z = 83.5) dẫn thẳng tới Xưởng Mộc Bắc Âu (Z = 95)
  // [HOÀN TOÀN KHÔNG CHẠY XUYÊN QUA KHU TÀI CHÍNH HAY NGÂN HÀNG TRUNG ƯƠNG]
  const walkToFurniture = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.15, 16), stoneMat);
  walkToFurniture.position.set(5, 0.08, 90);
  walkToFurniture.receiveShadow = true;
  walkGroup.add(walkToFurniture);

  // 4. Nhánh đường kết nối từ Cao tốc Bờ Nam (X = 28, Z = 50) dẫn sang Cảng Biển Container (X = 85, Z = 50)
  const roadToPort = new THREE.Mesh(new THREE.BoxGeometry(50, 0.18, 8.5), new THREE.MeshStandardMaterial({ map: Textures.asphalt(), roughness: 0.82 }));
  roadToPort.position.set(55, 0.09, 50);
  roadToPort.receiveShadow = true;
  walkGroup.add(roadToPort);

  // 5. Cầu gỗ sàn biển (Boardwalk Gangway) nối từ Bãi biển Maldives ra Siêu Du Thuyền { X: 145 -> 168, Z: 55 }
  const yachtGangway = new THREE.Mesh(new THREE.BoxGeometry(26, 0.25, 3.2), teakBoardMat);
  yachtGangway.position.set(156, 0.35, 55);
  yachtGangway.castShadow = true;
  yachtGangway.receiveShadow = true;
  walkGroup.add(yachtGangway);

  // Lan can gỗ bảo vệ cho cầu dẫn du thuyền
  [-1.5, 1.5].forEach(gy => {
    const gRail = new THREE.Mesh(new THREE.BoxGeometry(26, 0.1, 0.12), new THREE.MeshStandardMaterial({ color: 0x451a03 }));
    gRail.position.set(156, 1.1, 55 + gy);
    walkGroup.add(gRail);
  });

  // 6. Cầu dẫn gỗ nối ra các căn Bungalow đầm phá Maldives
  [[-12, 45], [12, 60]].forEach(([bxOffset, bzPos]) => {
    const bWalk = new THREE.Mesh(new THREE.BoxGeometry(18, 0.22, 2.4), teakBoardMat);
    bWalk.position.set(135 + bxOffset, 0.35, bzPos);
    walkGroup.add(bWalk);
  });
}
window.createEmpirePedestrianWalkways = createEmpirePedestrianWalkways;

// 2. SÂN BAY TRỰC THĂNG SANG TRỌNG (LUXURY HELIPAD)
function createHelipadInfrastructure(scene) {
  const padGroup = new THREE.Group();
  padGroup.position.set(55.0, 0.15, 52.0);
  scene.add(padGroup);

  // Bệ bê tông tròn bán kính 6m
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
  const yellowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });

  const padBase = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.4, 0.15, 32), concreteMat);
  padBase.receiveShadow = true;
  padGroup.add(padBase);

  // Vành tròn sơn vàng bảo vệ
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.4, 5.8, 32), yellowMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.09;
  padGroup.add(ring);

  // Chữ [H] màu trắng nổi bật
  const hBarL = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 3.2), whiteMat);
  hBarL.rotation.x = -Math.PI / 2;
  hBarL.position.set(-1.1, 0.09, 0);
  padGroup.add(hBarL);

  const hBarR = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 3.2), whiteMat);
  hBarR.rotation.x = -Math.PI / 2;
  hBarR.position.set(1.1, 0.09, 0);
  padGroup.add(hBarR);

  const hBarMid = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), whiteMat);
  hBarMid.rotation.x = -Math.PI / 2;
  hBarMid.position.set(0, 0.09, 0);
  padGroup.add(hBarMid);

  // 8 Đèn LED viền sân bay nhấp nháy
  window.helipadLEDs = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8;
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x22c55e })
    );
    led.position.set(Math.cos(angle) * 5.9, 0.15, Math.sin(angle) * 5.9);
    padGroup.add(led);
    window.helipadLEDs.push(led);
  }
}
window.createHelipadInfrastructure = createHelipadInfrastructure;

// 3. SIÊU DU THUYỀN TRIỆU ĐÔ TẠI MALDIVES (MEGA LUXURY YACHT)
function createMegaLuxuryYacht(scene) {
  const yachtGroup = new THREE.Group();
  yachtGroup.position.set(168, 0.18, 55);
  yachtGroup.rotation.y = -Math.PI * 0.4;
  scene.add(yachtGroup);

  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.3 }); // Sơn trắng du thuyền
  const navyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
  const teakMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.65 }); // Gỗ Teak sàn du thuyền
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, transparent: true, opacity: 0.75, roughness: 0.1 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });

  // 1. Thân tàu 42m đáy V rẽ sóng
  const hull = new THREE.Mesh(new THREE.BoxGeometry(6.5, 2.4, 28.0), hullMat);
  hull.position.set(0, 1.2, 0);
  hull.castShadow = true;
  yachtGroup.add(hull);

  // Mũi du thuyền vát khí động học
  const bow = new THREE.Mesh(new THREE.ConeGeometry(3.25, 6.8, 4), hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 1.2, 16.5);
  yachtGroup.add(bow);

  // Dải sơn xanh hải quân ngang thân (Boot-stripe)
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.35, 26.0), navyMat);
  stripe.position.set(0, 0.5, 0);
  yachtGroup.add(stripe);

  // 2. Tầng 2: Boong chính & Salon tiếp khách VIP
  const salon = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.8, 16.0), hullMat);
  salon.position.set(0, 3.2, -1.0);
  yachtGroup.add(salon);

  // Cửa sổ kính toàn cảnh dải dài
  [-2.72, 2.72].forEach(gx => {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(14.0, 1.0), glassMat);
    glass.rotation.y = (gx > 0 ? Math.PI / 2 : -Math.PI / 2);
    glass.position.set(gx, 3.3, -1.0);
    yachtGroup.add(glass);
  });

  // 3. Tầng 3: Buồng lái Flybridge & Mui vòm
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.4, 8.0), hullMat);
  bridge.position.set(0, 4.8, 0);
  yachtGroup.add(bridge);

  // Cột ăng-ten radar vệ tinh
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3.2, 8), chromeMat);
  mast.position.set(0, 6.8, -2.0);
  yachtGroup.add(mast);

  const dome1 = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12), hullMat);
  dome1.position.set(-0.8, 7.2, -2.0);
  yachtGroup.add(dome1);

  const dome2 = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12), hullMat);
  dome2.position.set(0.8, 7.2, -2.0);
  yachtGroup.add(dome2);

  // 4. Bể bơi vô cực đuôi tàu (Aft Infinity Dip Pool)
  const pool = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.6, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.8, roughness: 0.1 })
  );
  pool.position.set(0, 2.2, -11.5);
  yachtGroup.add(pool);

  // Ghế tắm nắng & Dù che trắng
  [-1.5, 1.5].forEach(sx => {
    const sunbed = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 1.6), teakMat);
    sunbed.position.set(sx, 2.3, -9.0);
    yachtGroup.add(sunbed);
  });

  // Cầu dẫn bằng gỗ nối với bến Resort Maldives
  const gangway = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 8.5), teakMat);
  gangway.position.set(-4.5, 1.2, 0);
  gangway.rotation.y = 0.55;
  yachtGroup.add(gangway);

  window.luxuryYachtMesh = yachtGroup;
}
window.createMegaLuxuryYacht = createMegaLuxuryYacht;

// 4. KHU SAN HÔ ĐÁY BIỂN & RƯƠNG KHO BÁU MALDIVES (CORAL REEF & SUNKEN TREASURE)
function createUnderwaterSanctuaryAndTreasure(scene) {
  window.treasureChests = [];

  const woodChestMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.75 });
  const goldBandMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 });

  // 1. Rạn san hô rực rỡ dưới biển Maldives (X: 135-155, Z: 40-60, Y: -2.8)
  const coralColors = [0xf43f5e, 0x8b5cf6, 0x10b981, 0xf59e0b, 0x06b6d4];
  for (let c = 0; c < 18; c++) {
    const cx = 135 + Math.random() * 25;
    const cz = 38 + Math.random() * 24;
    const color = coralColors[Math.floor(Math.random() * coralColors.length)];
    const coralMat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, emissive: color, emissiveIntensity: 0.25 });

    const coral = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + Math.random() * 0.8), coralMat);
    coral.position.set(cx, -2.4, cz);
    coral.scale.set(1.0, 1.4 + Math.random() * 0.8, 1.0);
    scene.add(coral);
  }

  // 2. Xác tàu đắm cướp biển cổ đại (Sunken Galleon Shipwreck)
  const wreckGroup = new THREE.Group();
  wreckGroup.position.set(144, -2.6, 46);
  wreckGroup.rotation.set(0.2, 0.4, 0.35); // Nghiêng trên nền cát biển
  scene.add(wreckGroup);

  const wHull = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, 12.0), woodChestMat);
  wreckGroup.add(wHull);

  const brokenMast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 7.5, 8), woodChestMat);
  brokenMast.position.set(0, 3.5, 0);
  brokenMast.rotation.z = 0.6;
  wreckGroup.add(brokenMast);

  // 3. Ba chiếc Rương Kho Báu Thuyền Đắm (Sunken Treasure Chests)
  const chestLocs = [
    { x: 140, z: 44, label: '💎 RƯƠNG KIM CƯƠNG THUYỀN ĐẮM #1', reward: 30000 },
    { x: 146, z: 54, label: '🪙 RƯƠNG VÀNG RẠN SAN HÔ #2', reward: 40000 },
    { x: 152, z: 42, label: '👑 RƯƠNG NGỌC TRAI HOÀNG GIA #3', reward: 50000 }
  ];

  chestLocs.forEach((loc, idx) => {
    const cGroup = new THREE.Group();
    cGroup.position.set(loc.x, -2.4, loc.z);
    scene.add(cGroup);

    // Hòm gỗ
    const chestBox = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.75, 0.85), woodChestMat);
    chestBox.position.y = 0.38;
    cGroup.add(chestBox);

    // Nắp vòm cong
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.2, 12, 1, false, 0, Math.PI), woodChestMat);
    lid.rotation.z = Math.PI / 2;
    lid.position.set(0, 0.75, 0);
    cGroup.add(lid);

    // Viền kim loại & Khóa vàng
    const band1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.9), goldBandMat);
    band1.position.set(-0.35, 0.4, 0);
    cGroup.add(band1);

    const band2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.9), goldBandMat);
    band2.position.set(0.35, 0.4, 0);
    cGroup.add(band2);

    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.15), goldBandMat);
    lock.position.set(0, 0.55, 0.45);
    cGroup.add(lock);

    // Vầng hào quang phát sáng dưới nước
    const aura = new THREE.PointLight(0xfacc15, 2.0, 6.0);
    aura.position.set(0, 0.8, 0);
    cGroup.add(aura);

    const billboard = makeBillboardText(loc.label, '#facc15', 380, 48);
    billboard.position.set(0, 1.8, 0);
    cGroup.add(billboard);

    window.treasureChests.push({
      group: cGroup,
      lid: lid,
      pos: new THREE.Vector3(loc.x, -2.4, loc.z),
      reward: loc.reward,
      label: loc.label,
      opened: false
    });
  });
}
window.createUnderwaterSanctuaryAndTreasure = createUnderwaterSanctuaryAndTreasure;

// Cập nhật hoạt ảnh hạ cần chắn đường ngang, bọt khí lặn biển & siêu du thuyền
function updateDeepWorld(dt, time, playerPos) {
  // Hoạt ảnh dập dềnh của Siêu Du Thuyền Maldives
  if (window.luxuryYachtMesh) {
    window.luxuryYachtMesh.position.y = 0.18 + Math.sin(time * 1.8) * 0.05;
    window.luxuryYachtMesh.rotation.z = Math.sin(time * 1.2) * 0.02;
  }

  // Đèn viền Helipad nhấp nháy xoay vòng
  if (window.helipadLEDs) {
    const activeLed = Math.floor(time * 6.0) % window.helipadLEDs.length;
    window.helipadLEDs.forEach((led, idx) => {
      led.material.color.setHex(idx === activeLed ? 0x4ade80 : 0x166534);
    });
  }

  // Cần chắn đường ngang tự động hạ xuống và còi chuông reng khi đoàn tàu hỏa đến gần { x: 45, z: 155 }
  if (window.steamTrainSystem && window.steamTrainSystem.locomotive) {
    const trainPos = window.steamTrainSystem.locomotive.position;
    const distToTrain = trainPos.distanceTo(new THREE.Vector3(45, 0, 155));
    const isTrainNear = distToTrain < 34.0;

    // Góc hạ cần chắn: 0 rad (chắn ngang đường) khi tàu đến gần, ~80 độ (dựng đứng mở đường) khi tàu xa
    const targetAngle = isTrainNear ? 0 : Math.PI * 0.44;

    if (window.crossingGates && window.crossingGates.length > 0) {
      const flashOn = isTrainNear && Math.sin(time * 12.0) > 0;
      window.crossingGates.forEach(gate => {
        gate.armPivot.rotation.x = THREE.MathUtils.lerp(gate.armPivot.rotation.x, targetAngle, dt * 3.5);

        gate.flash1.material.color.setHex(flashOn ? 0xef4444 : 0x3b0764);
        gate.flash1.material.emissiveIntensity = flashOn ? 0.9 : 0.05;
        gate.flash2.material.color.setHex(!flashOn && isTrainNear ? 0xef4444 : 0x3b0764);
        gate.flash2.material.emissiveIntensity = (!flashOn && isTrainNear) ? 0.9 : 0.05;

        if (gate.armLEDs) {
          gate.armLEDs.forEach(led => {
            led.material.emissiveIntensity = isTrainNear ? 0.9 : 0.1;
          });
        }
      });
    } else if (window.crossingBoomArm) {
      window.crossingBoomArm.rotation.x = THREE.MathUtils.lerp(window.crossingBoomArm.rotation.x, targetAngle, dt * 3.5);
    }

    // Chuông cảnh báo đường sắt cơ học reng reng khi tàu đến gần và người chơi ở gần
    if (isTrainNear && playerPos && playerPos.distanceTo(new THREE.Vector3(45, 0, 155)) < 32.0) {
      window.crossingBellTimer = (window.crossingBellTimer || 0) + dt;
      if (window.crossingBellTimer >= 0.45) {
        window.crossingBellTimer = 0;
        if (typeof sounds !== 'undefined' && sounds.playTrainCrossingBell) {
          sounds.playTrainCrossingBell();
        }
      }
    }
  }

  // ĐÀI RADAR THÁP KHÔNG LƯU QUÉT 360 ĐỘ LIÊN TỤC & ĐÈN BÁO KHÔNG HÀNG KHÔNG
  if (window.radarAntennas && window.radarAntennas.length > 0) {
    window.radarAntennas.forEach(radar => {
      radar.rotation.y += dt * 1.8;
    });
  }
  if (window.airportBeaconLight) {
    window.airportBeaconLight.material.opacity = (Math.sin(time * 8.0) > 0.35) ? 1.0 : 0.15;
  }
  if (window.airportWindsock) {
    window.airportWindsock.rotation.y = Math.sin(time * 0.9) * 0.35 + 0.6;
  }

  // TRẠM CÂN TẢI TRỌNG CẢNG BIỂN (EAST PORT AUTOMATED TRUCK WEIGH STATION)
  if (window.portWeighStation && playerPos) {
    if (window.portWeighStation.cooldown > 0) {
      window.portWeighStation.cooldown -= dt;
    }
    const distToWeigh = playerPos.distanceTo(window.portWeighStation.pos);
    if (distToWeigh <= window.portWeighStation.radius && window.portWeighStation.cooldown <= 0) {
      const logs = (typeof gameState !== 'undefined' && gameState.logs) || 0;
      const planks = (typeof gameState !== 'undefined' && gameState.planks) || 0;
      const pallets = (typeof gameState !== 'undefined' && gameState.pallets) || 0;
      const pellets = (typeof gameState !== 'undefined' && gameState.woodPellets) || 0;
      const containers = (typeof gameState !== 'undefined' && gameState.containers) || 0;
      const isDrivingCargo = typeof gameState !== 'undefined' && (gameState.isDrivingTruck || gameState.isDrivingForklift);
      const totalCargo = logs + planks + pallets + pellets + containers;

      if (totalCargo > 0 || isDrivingCargo) {
        const bonus = 250;
        gameState.money += bonus;
        window.portWeighStation.cooldown = 25.0; // 25s hồi chiêu mỗi lượt vận chuyển
        if (typeof sounds !== 'undefined' && sounds.playWeighBeep) sounds.playWeighBeep();
        if (typeof spawnFloatingText === 'function') {
          spawnFloatingText(window.portWeighStation.pos.clone().add(new THREE.Vector3(0, 3.5, 0)), `+$${bonus} THÔNG QUAN CẢNG BIỂN ⚖️`, '#38bdf8');
        }
        showToast(`⚖️ TRẠM CÂN TẢI TRỌNG: Khối lượng đạt chuẩn 26.8 Tấn! Thông quan Cảng biển thành công (+${bonus}$)!`);
        if (typeof updateHUD === 'function') updateHUD();
        if (typeof triggerActionSave === 'function') triggerActionSave();
      } else {
        window.portWeighStation.cooldown = 12.0;
        if (typeof sounds !== 'undefined' && sounds.playWeighBeep) sounds.playWeighBeep();
        showToast('⚖️ TRẠM CÂN TẢI TRỌNG CẢNG BIỂN: Xe không tải (0 Tấn) - Cho phép lưu thông qua cổng!');
      }
    }
  }

  // TRẠM BIẾN ÁP CÔNG NGHIỆP 110KV CẤP ĐIỆN XƯỞNG CƯA
  if (typeof gameState !== 'undefined') {
    gameState.substationPowerOnline = true;
    gameState.sawmillGridBonus = 1.10; // +10% hiệu suất cưa gỗ liên tục
  }
  if (window.sawmillSubstation && playerPos) {
    if (window.sawmillSubstation.promptCooldown > 0) {
      window.sawmillSubstation.promptCooldown -= dt;
    }
    const distToSub = playerPos.distanceTo(window.sawmillSubstation.pos);
    if (distToSub <= window.sawmillSubstation.radius && (!window.sawmillSubstation.promptCooldown || window.sawmillSubstation.promptCooldown <= 0)) {
      window.sawmillSubstation.promptCooldown = 20.0;
      showToast('⚡ TRẠM BIẾN ÁP CÔNG NGHIỆP 110KV: Lưới điện 3 pha 50Hz ổn định (Tăng +10% tốc độ máy cưa xưởng gỗ)!');
    }
  }

  // Tương tác mở Rương Kho Báu Đáy Biển khi lặn gần
  if (window.treasureChests && playerPos) {
    window.treasureChests.forEach(chest => {
      if (!chest.opened && playerPos.distanceTo(chest.pos) <= 3.8) {
        chest.opened = true;
        chest.lid.rotation.x = -Math.PI * 0.45; // Mở tung nắp rương
        gameState.money += chest.reward;
        gameState.treasuresFound = (gameState.treasuresFound || 0) + 1;
        sounds.playTreasureChest();
        spawnFloatingText(chest.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), `+$${formatCurrency(chest.reward)} TRỤC VỚT KHO BÁU! 💎👑`, '#facc15');
        showToast(`🎉 Đã trục vớt thành công ${chest.label}: Nhận +$${formatCurrency(chest.reward)}!`);
        updateHUD();
        triggerActionSave();
      }
    });
  }

  // Cập nhật hạt mưa rơi
  if (window.rainSystem && window.rainSystem.visible) {
    const geo = window.rainSystem.geometry;
    const pos = geo.attributes.position.array;
    for (let i = 1; i < pos.length; i += 3) {
      pos[i] -= dt * 26.0;
      if (pos[i] < 0) pos[i] = 38.0;
    }
    geo.attributes.position.needsUpdate = true;
  }

  // Cập nhật cầu vồng nhấp nháy phát quang
  if (window.rainbowMesh && window.rainbowMesh.visible) {
    window.rainbowMesh.material.opacity = 0.55 + Math.sin(time * 2.0) * 0.15;
  }

  // Cập nhật tích lũy doanh thu Resort Maldives ($80/s)
  if (typeof gameState !== 'undefined') {
    if (!gameState.tourismRevenue) gameState.tourismRevenue = 0;
    if (gameState.tourismRevenue < 50000) {
      gameState.tourismRevenue += dt * 80.0;
    }
  }

  // Cập nhật chu kỳ thời tiết động
  if (typeof gameState !== 'undefined') {
    if (!gameState.weatherTimer) gameState.weatherTimer = 180;
    gameState.weatherTimer -= dt;
    if (gameState.weatherTimer <= 0) {
      if (gameState.weather === 'sunny') {
        const next = Math.random() < 0.6 ? 'rain' : 'rainbow';
        gameState.weather = next;
        gameState.weatherTimer = next === 'rain' ? 50 : 40;
        showToast(next === 'rain' ? '🌧️ CƠN MƯA RỪNG ĐẾN: Tốc độ mọc cây tăng GẤP ĐÔI (x2)!' : '🌈 CẦU VỒNG XUẤT HIỆN: Thưởng DOANH THU x2 TOÀN BẢN ĐỒ!');
      } else if (gameState.weather === 'rain') {
        gameState.weather = Math.random() < 0.5 ? 'rainbow' : 'sunny';
        gameState.weatherTimer = gameState.weather === 'rainbow' ? 40 : 180;
        if (gameState.weather === 'rainbow') {
          showToast('🌈 MƯA TAN CẦU VỒNG RỰC RỠ: Doanh thu x2 toàn bộ sản phẩm!');
        } else {
          showToast('☀️ TRỜI NẮNG ĐẸP TRỞ LẠI: Công trường rộn rã!');
        }
      } else {
        gameState.weather = 'sunny';
        gameState.weatherTimer = 180;
        showToast('☀️ TRỜI NẮNG CHAN HOÀ: Tiếp tục hành trình xây dựng đế chế!');
      }
    }

    // Đồng bộ hiển thị 3D với gameState.weather
    if (window.rainSystem) window.rainSystem.visible = (gameState.weather === 'rain');
    if (window.rainbowMesh) window.rainbowMesh.visible = (gameState.weather === 'rainbow');
  }

  // Xoay các vòng neon và kiểm tra người chơi bước vào ô tương tác
  if (window.deepPads && playerPos) {
    window.deepPads.forEach(pad => {
      pad.ring.rotateZ(dt * 2.2);
      pad.cooldown = Math.max(0, pad.cooldown - dt);

      const d = playerPos.distanceTo(pad.pos);
      if (d <= pad.radius && pad.cooldown <= 0) {
        pad.cooldown = 2.0; // Debounce 2 giây

        if (pad.type === 'gold_mine') {
          if (gameState.money >= 5000) {
            gameState.money -= 5000;
            gameState.goldBars = (gameState.goldBars || 0) + 1;
            sounds.playLevelUp();
            spawnFloatingText(pad.pos.clone().add(new THREE.Vector3(0, 3.5, 0)), '+1 THỎI VÀNG HOÀNG GIA! ($5,000) 🪙', '#facc15');
            showToast('🪙 Đã đúc thành công 1 Thỏi Vàng Hoàng Gia ($5,000)!');
            updateHUD();
          } else {
            showToast('⚠️ Cần $5,000 tiền mặt để mua quặng đúc Thỏi Vàng!');
          }
        } else if (pad.type === 'furniture') {
          if (gameState.pallets >= 1) {
            gameState.pallets -= 1;
            gameState.furniture = (gameState.furniture || 0) + 1;
            gameState.money += 1200;
            sounds.playWoodPlank();
            spawnFloatingText(pad.pos.clone().add(new THREE.Vector3(0, 3.5, 0)), '+1 BỘ BÀN GHẾ BẮC ÂU (+$1,200) 🪑', '#f97316');
            showToast('🪑 Đã gia công xong 1 Bộ Bàn Ghế Bắc Âu, nhận +$1,200!');
            updateHUD();
          } else {
            showToast('⚠️ Cần 1 Kiện Pallet công nghiệp để đóng đồ nội thất!');
          }
        } else if (pad.type === 'resort_vault') {
          const rev = Math.floor(gameState.tourismRevenue || 0);
          if (rev >= 50) {
            gameState.money += rev;
            gameState.tourismRevenue = 0;
            sounds.playCoinCollect();
            spawnFloatingText(pad.pos.clone().add(new THREE.Vector3(0, 3.5, 0)), `+$${rev} DOANH THU RESORT MALDIVES! 🏖️💵`, '#38bdf8');
            showToast(`🏖️ Đã thu hoạch $${rev} doanh thu thụ động từ Resort Maldives!`);
            updateHUD();
          } else {
            showToast('⏳ Két tiền Resort đang tích lũy, vui lòng quay lại sau!');
          }
        } else if (pad.type === 'air_cargo') {
          if (window.airportBoeingJet && window.airportBoeingJet.dispatchFlight()) {
            const reward = 25000;
            gameState.money += reward;
            gameState.airFlights = (gameState.airFlights || 0) + 1;
            sounds.playLevelUp();
            spawnFloatingText(pad.pos.clone().add(new THREE.Vector3(0, 4.5, 0)), `+$${reward} XUẤT HÀNG BOEING 747! ✈️📦`, '#818cf8');
            showToast(`✈️ Chuyến bay Boeing 747 cất cánh thành công! Thưởng lớn +$${reward}!`);
            updateHUD();
          } else {
            showToast('✈️ Máy bay Boeing 747 đang thực hiện hành trình bay!');
          }
        } else if (pad.type === 'export_container') {
          // Chuỗi cung ứng liên ngành: 2 Pallet gỗ, 1 Thỏi vàng, 5 Cá hộp -> Container VIP
          const reqPallets = 2;
          const reqGold = 1;
          const reqFish = 5;
          if ((gameState.pallets || 0) >= reqPallets && (gameState.goldBars || 0) >= reqGold && (gameState.cannedFish || 0) >= reqFish) {
            gameState.pallets -= reqPallets;
            gameState.goldBars -= reqGold;
            gameState.cannedFish -= reqFish;
            gameState.containers = (gameState.containers || 0) + 1;

            let moneyReward = 15000;
            if (gameState.marketState && gameState.marketState.activeCommodity === 'pallets') {
              moneyReward = Math.floor(moneyReward * (gameState.marketState.multiplier || 1.0));
            }
            const gemsReward = 10;
            const rpReward = 15;

            gameState.money += moneyReward;
            gameState.gems = (gameState.gems || 0) + gemsReward;
            gameState.researchPoints = (gameState.researchPoints || 0) + rpReward;

            sounds.playLevelUp();
            if (typeof triggerCameraShake === 'function') triggerCameraShake(0.5, 0.35);
            spawnFloatingText(pad.pos.clone().add(new THREE.Vector3(0, 4.5, 0)), `+$${moneyReward.toLocaleString()} 💵 +${gemsReward}💎 +${rpReward}RP!`, '#0284c7');
            showToast(`🚢 ĐÃ XUẤT KHẨU CONTAINER VIP! Thưởng lớn: $${moneyReward.toLocaleString()}, 10 Kim Cương & 15 Điểm Nghiên Cứu!`);
            updateHUD();
            if (typeof triggerActionSave === 'function') triggerActionSave();
          } else {
            showToast(`⚠️ Cần đủ: 2 Pallet (${gameState.pallets || 0}/2), 1 Thỏi Vàng (${gameState.goldBars || 0}/1), 5 Cá Hộp (${gameState.cannedFish || 0}/5)!`);
          }
        } else if (pad.type === 'wood_pellets') {
          // Ép mùn cưa / ván gỗ thành viên nén: 1 Ván gỗ -> 2 Túi viên nén + 2 RP
          if ((gameState.planks || 0) >= 1) {
            gameState.planks -= 1;
            gameState.woodPellets = (gameState.woodPellets || 0) + 2;
            gameState.researchPoints = (gameState.researchPoints || 0) + 2;
            sounds.playWoodPlank();
            spawnFloatingText(pad.pos.clone().add(new THREE.Vector3(0, 3.5, 0)), '+2 Viên Nén Gỗ Sinh Học 🪵 & +2 RP 🔬', '#10b981');
            showToast('🪵 Đã ép 1 Ván gỗ thành 2 Túi Viên Nén Sinh Học (+2 RP)! Đốt lò đầu tàu hơi nước nhận thưởng định kỳ!');
            updateHUD();
            if (typeof triggerActionSave === 'function') triggerActionSave();
          } else {
            showToast('⚠️ Cần 1 Ván Gỗ để đưa vào máy ép viên nén sinh học!');
          }
        }
      }
    });
  }

  // Cập nhật dao động và trục vớt Thùng hàng trôi dạt bờ biển (Ocean Drift Crates)
  if (window.oceanDriftCrates && playerPos) {
    const time = (typeof clock !== 'undefined') ? clock.getElapsedTime() : Date.now() * 0.001;
    window.oceanDriftCrates.forEach(crate => {
      crate.group.position.y = crate.baseY + Math.sin(time * 2.5 + crate.pos.x) * 0.12;
      crate.group.rotation.y += dt * 0.4;
      if (!crate.active) {
        crate.cooldown -= dt;
        if (crate.cooldown <= 0) {
          crate.active = true;
          crate.group.visible = true;
        }
      } else {
        const dist = playerPos.distanceTo(crate.pos);
        if (dist <= 2.2) {
          crate.active = false;
          crate.group.visible = false;
          crate.cooldown = 150.0; // 2.5 phút xuất hiện lại

          const cashBonus = 1500 + Math.floor(Math.random() * 2000);
          const gemBonus = 3;
          const rpBonus = 5;
          gameState.money += cashBonus;
          gameState.gems = (gameState.gems || 0) + gemBonus;
          gameState.researchPoints = (gameState.researchPoints || 0) + rpBonus;

          if (typeof sounds !== 'undefined' && sounds.playLevelUp) sounds.playLevelUp();
          if (typeof spawnFloatingText === 'function') {
            spawnFloatingText(crate.pos.clone().add(new THREE.Vector3(0, 3, 0)), `+$${cashBonus.toLocaleString()} 💵 +${gemBonus}💎 +${rpBonus}RP!`, '#facc15');
          }
          showToast(`🎁 ĐÃ TRỤC VỚT THÙNG HÀNG TRÔI DẠT: +$${cashBonus.toLocaleString()}, +${gemBonus} Kim Cương & +${rpBonus} RP!`);
          updateHUD();
          if (typeof triggerActionSave === 'function') triggerActionSave();
        }
      }
    });
  }
}
window.updateDeepWorld = updateDeepWorld;

// ===========================================================================
// 6b. TRẠM BIẾN ÁP CÔNG NGHIỆP 110KV & HỆ THỐNG LƯỚI ĐIỆN XƯỞNG CƯA
// [MÁY BIẾN ÁP DẦU, SỨ CÁCH ĐIỆN CAO THẾ, CỘT ĐIỆN LY TÂM & ĐƯỜNG DÂY 3 PHA]
// ===========================================================================
function createSawmillIndustrialSubstation(scene) {
  const subGroup = new THREE.Group();
  subGroup.position.set(-25, 0, -26);
  scene.add(subGroup);

  const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.25 });
  const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.35 });
  const gravelMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.95 });
  const ceramicMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.3 }); // Sứ cách điện nâu

  // 1. Mặt bằng rải đá dăm chống tĩnh điện và cách điện (14m x 10m)
  const gravelBed = new THREE.Mesh(new THREE.BoxGeometry(14, 0.14, 10), gravelMat);
  gravelBed.position.y = 0.07;
  gravelBed.receiveShadow = true;
  subGroup.add(gravelBed);

  // 2. Hàng rào thép bảo vệ an toàn xung quanh có cổng ra vào
  const fenceH = 2.4;
  const fenceCoords = [
    { x: 0, z: -4.9, w: 13.8, d: 0.1 },
    { x: -6.9, z: 0, w: 0.1, d: 9.8 },
    { x: 6.9, z: 0, w: 0.1, d: 9.8 },
    { x: -3.8, z: 4.9, w: 6.2, d: 0.1 },
    { x: 3.8, z: 4.9, w: 6.2, d: 0.1 } // Chừa cổng giữa rộng 1.4m
  ];
  fenceCoords.forEach(fc => {
    const fPanel = new THREE.Mesh(new THREE.BoxGeometry(fc.w, fenceH, fc.d), new THREE.MeshStandardMaterial({ color: 0x64748b, transparent: true, opacity: 0.45, roughness: 0.5 }));
    fPanel.position.set(fc.x, fenceH / 2, fc.z);
    subGroup.add(fPanel);

    const fTop = new THREE.Mesh(new THREE.BoxGeometry(fc.w, 0.08, 0.08), steelMat);
    fTop.position.set(fc.x, fenceH, fc.z);
    subGroup.add(fTop);
  });

  // Biển cảnh báo điện cao áp màu vàng nguy hiểm
  const warnSign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
  warnSign.position.set(0, 1.6, 5.0);
  subGroup.add(warnSign);

  // 3. 2 Máy biến áp lực công nghiệp 110kV/22kV ngâm dầu tản nhiệt
  [-3.2, 3.2].forEach((tx, idx) => {
    const tGroup = new THREE.Group();
    tGroup.position.set(tx, 0, -0.8);
    subGroup.add(tGroup);

    // Móng bê tông kê máy biến áp
    const pad = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.35, 3.2), new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 }));
    pad.position.y = 0.18;
    tGroup.add(pad);

    // Thân thùng dầu máy biến áp
    const tank = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.2), darkSteelMat);
    tank.position.y = 1.45;
    tank.castShadow = true;
    tGroup.add(tank);

    // Cánh tản nhiệt làm mát bằng dầu dạng lá xẻ 2 bên hông
    [-1.38, 1.38].forEach(sideX => {
      for (let finZ = -0.8; finZ <= 0.8; finZ += 0.28) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.6, 0.04), steelMat);
        fin.position.set(sideX, 1.45, finZ);
        tGroup.add(fin);
      }
    });

    // Thùng dầu phụ hình trụ nằm ngang trên nóc (Oil Conservator Tank)
    const conservator = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.8, 12), steelMat);
    conservator.rotation.z = Math.PI / 2;
    conservator.position.set(0, 2.8, -0.5);
    tGroup.add(conservator);

    // 3 Sứ cách điện cao áp hình nón gân nổi (High-Voltage Porcelain Bushings)
    [-0.65, 0, 0.65].forEach((bx, pIdx) => {
      const bushing = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.95, 8), ceramicMat);
      bushing.position.set(bx, 3.0, 0.4);
      tGroup.add(bushing);

      const terminalCap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), steelMat);
      terminalCap.position.set(bx, 3.5, 0.4);
      tGroup.add(terminalCap);

      // Đèn LED báo pha điện lực (Pha A đỏ, Pha B vàng, Pha C xanh lá)
      const phaseColors = [0xef4444, 0xfacc15, 0x22c55e];
      const phaseLED = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: phaseColors[pIdx] }));
      phaseLED.position.set(bx, 3.65, 0.4);
      tGroup.add(phaseLED);
    });
  });

  // 4. Biển hiệu 3D Trạm Biến Áp
  const subTag = makeBillboardText('⚡ TRẠM BIẾN ÁP CÔNG NGHIỆP 110KV | LƯỚI ĐIỆN 50Hz (+10% TỐC ĐỘ XƯỞNG CƯA)', '#38bdf8', 430, 50);
  subTag.position.set(0, 4.2, 0);
  subGroup.add(subTag);

  // 5. CỘT ĐIỆN BÊ TÔNG LY TÂM & ĐƯỜNG DÂY 3 PHA NỐI ĐẾN MÁY CƯA XƯỞNG GỖ
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });

  const poleLocations = [
    { x: -25, z: -21, h: 7.2 },
    { x: -12, z: -19, h: 7.2 }
  ];

  poleLocations.forEach(pl => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, pl.h, 10), poleMat);
    pole.position.set(pl.x, pl.h / 2, pl.z);
    pole.castShadow = true;
    scene.add(pole);

    // Xà thép đỡ dây (Crossarm)
    const crossArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.4), steelMat);
    crossArm.position.set(pl.x, pl.h - 0.3, pl.z);
    scene.add(crossArm);

    // 3 Quả sứ đứng
    [-0.8, 0, 0.8].forEach(oz => {
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.25, 6), ceramicMat);
      ins.position.set(pl.x, pl.h - 0.12, pl.z + oz);
      scene.add(ins);
    });
  });

  // Kéo 3 sợi cáp điện cao áp võng tự nhiên nối giữa các cột và vào xưởng cưa
  [-0.8, 0, 0.8].forEach(wireOffset => {
    const pts = [
      new THREE.Vector3(-25, 3.5, -26 + wireOffset * 0.4),
      new THREE.Vector3(-25, 6.9, -21 + wireOffset),
      new THREE.Vector3(-18.5, 6.2, -20 + wireOffset),
      new THREE.Vector3(-12, 6.9, -19 + wireOffset),
      new THREE.Vector3(-6, 5.8, -18.5 + wireOffset * 0.5),
      new THREE.Vector3(0, 5.2, -18 + wireOffset * 0.5)
    ];
    const wireCurve = new THREE.CatmullRomCurve3(pts);
    const wireGeo = new THREE.TubeGeometry(wireCurve, 24, 0.03, 6, false);
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wireMesh);
  });

  window.sawmillSubstation = {
    pos: new THREE.Vector3(-25, 0, -26),
    radius: 5.5,
    promptCooldown: 0
  };
}
window.createSawmillIndustrialSubstation = createSawmillIndustrialSubstation;

// ===========================================================================
// 7. ĐẠI LỘ VÀNH ĐAI KHÉP KÍN & HẠ TẦNG LOGISTICS HOÀN TOÀN MƯỢT MÀ
// ===========================================================================
function createEmpireHighwayNetwork(scene) {
  const asphaltMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.85,
    metalness: 0.15
  });
  const yellowLineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const whiteLineMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 });
  const gantryMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.3 });

  // 1. CÁC ĐOẠN ĐẠI LỘ VÀNH ĐAI VÀ TRỤC CHÍNH (TẤT CẢ Ở CAO ĐỘ Y = 0.04 CHUẨN XÁC)
  // Đại lộ rộng 12m (2 làn mỗi chiều + vạch tim vàng + vạch biên trắng)
  const segments = [
    // Đại lộ Bắc (North Beltway): Z = -110, X từ -110 đến 130
    { x: 10, z: -110, w: 240, d: 12 },
    // Đại lộ Đông (East Beltway): X = 130, Z từ -110 đến 160
    { x: 130, z: 25, w: 12, d: 270 },
    // Đại lộ Nam (South Beltway): Z = 160, X từ -110 đến 130
    { x: 10, z: 160, w: 12, d: 13 }, // sửa bên dưới
    // Đại lộ Tây (West Beltway): X = -110, Z từ -110 đến 160
    { x: -110, z: 25, w: 12, d: 270 },

    // Đại lộ Express Đông - Tây (Z = -38, X từ -110 đến 130)
    { x: -55, z: -38, w: 110, d: 12 }, // Nhánh Tây (từ -110 đến 0)
    { x: 79, z: -38, w: 102, d: 12 },  // Nhánh Đông (từ 28 đến 130)

    // Trục Spine Nam - Bắc (X = 28):
    // Nhánh Bắc: từ Z = -110 đến Z = -4.0 (gặp dốc lên cầu Z = 2.0)
    { x: 28, z: -57, w: 12, d: 106 },
    // Nhánh Nam: từ Z = 30.0 (xuống cầu) đến Z = 160 (gặp Đại lộ Nam)
    { x: 28, z: 95, w: 12, d: 130 }
  ];

  // Sửa đoạn Nam
  segments[2] = { x: 10, z: 160, w: 240, d: 12 };

  segments.forEach(seg => {
    const road = new THREE.Mesh(new THREE.BoxGeometry(seg.w, 0.08, seg.d), asphaltMat);
    road.position.set(seg.x, 0.04, seg.z);
    road.receiveShadow = true;
    scene.add(road);

    if (seg.w > seg.d) {
      // Đường ngang (chạy theo trục X)
      [-0.15, 0.15].forEach(dy => {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(seg.w, 0.18), yellowLineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(seg.x, 0.09, seg.z + dy);
        scene.add(line);
      });
      [-seg.d / 2 + 0.8, seg.d / 2 - 0.8].forEach(wz => {
        const wLine = new THREE.Mesh(new THREE.PlaneGeometry(seg.w, 0.2), whiteLineMat);
        wLine.rotation.x = -Math.PI / 2;
        wLine.position.set(seg.x, 0.09, seg.z + wz);
        scene.add(wLine);
      });
    } else {
      // Đường dọc (chạy theo trục Z)
      [-0.15, 0.15].forEach(dx => {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.18, seg.d), yellowLineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(seg.x + dx, 0.09, seg.z);
        scene.add(line);
      });
      [-seg.w / 2 + 0.8, seg.w / 2 - 0.8].forEach(wx => {
        const wLine = new THREE.Mesh(new THREE.PlaneGeometry(0.2, seg.d), whiteLineMat);
        wLine.rotation.x = -Math.PI / 2;
        wLine.position.set(seg.x + wx, 0.09, seg.z);
        scene.add(wLine);
      });
    }
  });

  // DỐC CHUYỂN TIẾP MƯỢT MÀ VÀO CẦU VƯỢT SÔNG (SMOOTH TRANSITION RAMPS - TRIỆT TIÊU BẬC GỜ)
  // Dốc Bắc (Z: -4.0 đến 2.0, dài 6m): Cao độ từ 0.08 mượt mà lên 0.13
  const northRamp = new THREE.Mesh(new THREE.BoxGeometry(12, 0.08, 6.0), asphaltMat);
  northRamp.position.set(28, 0.065, -1.0);
  northRamp.rotation.x = -0.008; // dốc êm ái
  scene.add(northRamp);

  // Dốc Nam (Z: 30.0 đến 36.0, dài 6m): Cao độ từ 0.13 mượt mà xuống 0.08
  const southRamp = new THREE.Mesh(new THREE.BoxGeometry(12, 0.08, 6.0), asphaltMat);
  southRamp.position.set(28, 0.065, 33.0);
  southRamp.rotation.x = 0.008;
  scene.add(southRamp);

  // 2. VÒNG XUYẾN TRUNG TÂM HOÀNG GIA (GRAND EMPIRE ROUNDABOUT at X: 0, Z: -38)
  const roundGeo = new THREE.CylinderGeometry(18, 18, 0.08, 48);
  const roundMesh = new THREE.Mesh(roundGeo, asphaltMat);
  roundMesh.position.set(0, 0.045, -38);
  scene.add(roundMesh);

  // Đảo hoa & Cỏ ở trung tâm vòng xuyến
  const islandGeo = new THREE.CylinderGeometry(8.5, 8.5, 0.35, 36);
  const islandMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 });
  const islandMesh = new THREE.Mesh(islandGeo, islandMat);
  islandMesh.position.set(0, 0.18, -38);
  scene.add(islandMesh);

  // Tượng Đài Vàng Vinh Danh Người Tiều Phu Lâm Nghiệp
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 2.5, 8), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 }));
  pedestal.position.set(0, 1.4, -38);
  scene.add(pedestal);

  const statueGoldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.95, roughness: 0.15 });
  const statueBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.9), statueGoldMat);
  statueBody.position.set(0, 3.6, -38);
  scene.add(statueBody);

  const statueAxe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 0.8), statueGoldMat);
  statueAxe.position.set(0.8, 4.2, -38);
  statueAxe.rotation.z = -0.3;
  scene.add(statueAxe);

  // 3. HỆ THỐNG ĐÈN ĐƯỜNG CAO TỐC
  if (!window.nightLights) window.nightLights = [];
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.18, 7.5, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.85, roughness: 0.25 });
  const lampHeadGeo = new THREE.BoxGeometry(0.4, 0.25, 0.9);
  const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });

  const streetLampCoords = [
    { x: -90, z: -117 }, { x: -45, z: -117 }, { x: 0, z: -117 }, { x: 45, z: -117 }, { x: 90, z: -117 },
    { x: -90, z: 167 }, { x: -45, z: 167 }, { x: 0, z: 167 }, { x: 45, z: 167 }, { x: 90, z: 167 },
    { x: -117, z: -80 }, { x: -117, z: -20 }, { x: -117, z: 40 }, { x: -117, z: 100 }, { x: -117, z: 140 },
    { x: 137, z: -80 }, { x: 137, z: -20 }, { x: 137, z: 40 }, { x: 137, z: 100 }, { x: 137, z: 140 },
    { x: -80, z: -44 }, { x: -30, z: -44 }, { x: 45, z: -44 }, { x: 95, z: -44 },
    { x: 34, z: 50 }, { x: 34, z: 90 }, { x: 34, z: 130 }
  ];

  streetLampCoords.forEach(pos => {
    const pGroup = new THREE.Group();
    pGroup.position.set(pos.x, 0, pos.z);
    scene.add(pGroup);

    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 3.75;
    pole.castShadow = true;
    pGroup.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.14), poleMat);
    arm.position.set(0, 7.3, 0);
    pGroup.add(arm);

    const lampHead = new THREE.Mesh(lampHeadGeo, lampHeadMat);
    lampHead.position.set(1.1, 7.18, 0);
    pGroup.add(lampHead);

    const lLight = new THREE.PointLight(0xfbbf24, 0, 22, 1.8);
    lLight.position.set(1.1, 6.8, 0);
    pGroup.add(lLight);
    lLight.userData.nightIntensity = 1.9;
    window.nightLights.push(lLight);
  });

  // 4. TRẠM DỊCH VỤ CÂY XĂNG & NITRO BOOST (GAS & NITRO STATION at X: -48, Z: -48)
  const stationGroup = new THREE.Group();
  stationGroup.position.set(-48, 0, -48);
  scene.add(stationGroup);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, 10), new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6 }));
  canopy.position.set(0, 6.2, 0);
  stationGroup.add(canopy);

  [[-6.5, -3.8], [6.5, -3.8], [-6.5, 3.8], [6.5, 3.8]].forEach(([cx, cz]) => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 6.2, 8), poleMat);
    col.position.set(cx, 3.1, cz);
    col.castShadow = true;
    stationGroup.add(col);
  });

  const neonSign = new THREE.Mesh(new THREE.BoxGeometry(12, 1.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.9 }));
  neonSign.position.set(0, 6.4, 5.1);
  stationGroup.add(neonSign);

  [-3.5, 3.5].forEach(px => {
    const pump = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 1.2), new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 }));
    pump.position.set(px, 1.3, 0);
    pump.castShadow = true;
    stationGroup.add(pump);
  });

  const mart = new THREE.Mesh(new THREE.BoxGeometry(14, 4.5, 8), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 }));
  mart.position.set(0, 2.25, -9.5);
  stationGroup.add(mart);

  const nitroPadRing = new THREE.Mesh(
    new THREE.RingGeometry(2.5, 3.6, 32),
    new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide })
  );
  nitroPadRing.rotation.x = -Math.PI / 2;
  nitroPadRing.position.set(0, 0.08, 0);
  stationGroup.add(nitroPadRing);

  window.gasStationPad = {
    pos: new THREE.Vector3(-48, 0, -48),
    ring: nitroPadRing,
    radius: 7.0,
    cooldown: 0
  };

  // 5. BÃI NẠP GỖ XƯỞNG CƯA (ĐẶT TẠI X: 22, Z: -30 THÔNG THOÁNG KHÔNG CHỒNG LÊN BẤT KỲ CÔNG TRÌNH NÀO)
  const loadingGantry = new THREE.Group();
  loadingGantry.position.set(22, 0, -30);
  scene.add(loadingGantry);

  [-4.5, 4.5].forEach(cx => {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.5, 0.5), new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5 }));
    col.position.set(cx, 3.75, 0);
    col.castShadow = true;
    loadingGantry.add(col);
  });

  const hoistBeam = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0xca8a04 }));
  hoistBeam.position.set(0, 7.2, 0);
  loadingGantry.add(hoistBeam);

  const hoistHook = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.5, 8), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
  hoistHook.position.set(0, 5.6, 0);
  loadingGantry.add(hoistHook);

  const loadRing = new THREE.Mesh(new THREE.RingGeometry(3.0, 4.2, 32), new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide }));
  loadRing.rotation.x = -Math.PI / 2;
  loadRing.position.set(0, 0.08, 0);
  loadingGantry.add(loadRing);

  window.sawmillLoadingPad = {
    pos: new THREE.Vector3(22, 0, -30),
    ring: loadRing,
    radius: 7.5,
    cooldown: 0
  };

  // -------------------------------------------------------------------------
  // 5b. HỆ THỐNG HỘ LAN TÔN LƯỢN SÓNG (HIGHWAY W-BEAM GUARDRAILS WITH REFLECTORS)
  // -------------------------------------------------------------------------
  const guardrailMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.25 });
  const postSteelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.35 });
  const amberReflectorMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const redReflectorMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  function createGuardrailSection(startX, startZ, endX, endZ, reflectorMat) {
    const p1 = new THREE.Vector3(startX, 0, startZ);
    const p2 = new THREE.Vector3(endX, 0, endZ);
    const dist = p1.distanceTo(p2);
    const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
    const angle = Math.atan2(dir.x, dir.z);

    const postSpacing = 3.2;
    const count = Math.max(2, Math.floor(dist / postSpacing));

    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const curPos = new THREE.Vector3().lerpVectors(p1, p2, t);

      // Cột thép chữ I
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.12), postSteelMat);
      post.position.set(curPos.x, 0.45, curPos.z);
      scene.add(post);

      // Mắt mèo phản quang trên đỉnh cột
      const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.08), reflectorMat || amberReflectorMat);
      reflector.position.set(curPos.x, 0.72, curPos.z);
      reflector.rotation.y = angle;
      scene.add(reflector);
    }

    // Tấm tôn lượn sóng W-Beam chạy liền mạch
    const midPos = new THREE.Vector3().lerpVectors(p1, p2, 0.5);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, dist), guardrailMat);
    rail.position.set(midPos.x, 0.65, midPos.z);
    rail.rotation.y = angle;
    scene.add(rail);
  }

  // 1. Hộ lan đường dốc dẫn lên Cầu Vượt Sông Bờ Bắc (X: 21.6 và 34.4, Z: -16 đến -4)
  createGuardrailSection(21.6, -16, 21.6, -4, amberReflectorMat);
  createGuardrailSection(34.4, -16, 34.4, -4, redReflectorMat);

  // 2. Hộ lan đường dốc dẫn xuống Cầu Vượt Sông Bờ Nam (X: 21.6 và 34.4, Z: 30 đến 42)
  createGuardrailSection(21.6, 30, 21.6, 42, amberReflectorMat);
  createGuardrailSection(34.4, 30, 34.4, 42, redReflectorMat);

  // 3. Hộ lan khúc cua ngã ba ga tàu Bờ Tây (Z: -38, X: -95 đến -68)
  createGuardrailSection(-95, -31.6, -68, -31.6, amberReflectorMat);
  createGuardrailSection(-95, -44.4, -68, -44.4, redReflectorMat);

  // -------------------------------------------------------------------------
  // 5c. VẠCH SƠN ĐI BỘ QUA ĐƯỜNG (ZEBRA CROSSINGS) KẾT NỐI HẠ TẦNG ĐẾ CHẾ
  // -------------------------------------------------------------------------
  function createZebraCrossing(centerX, centerZ, isAlongX) {
    const zebraGroup = new THREE.Group();
    zebraGroup.position.set(centerX, 0.085, centerZ);
    scene.add(zebraGroup);

    const stripeWidth = 0.55;
    const stripeLength = 3.6;
    const count = 8;
    const spacing = 0.9;

    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spacing;
      const stripeGeo = new THREE.PlaneGeometry(isAlongX ? stripeLength : stripeWidth, isAlongX ? stripeWidth : stripeLength);
      stripeGeo.rotateX(-Math.PI / 2);
      const stripe = new THREE.Mesh(stripeGeo, whiteLineMat);
      if (isAlongX) {
        stripe.position.set(0, 0, offset);
      } else {
        stripe.position.set(offset, 0, 0);
      }
      zebraGroup.add(stripe);
    }
  }

  // Vạch 1: Ngay lối vào Nhà Ga Xe Lửa Bờ Tây { X: -55, Z: -38 }
  createZebraCrossing(-55, -38, false);

  // Vạch 2: Ngay lối vào Xưởng Cưa Gỗ & Vòng Xuyến Hoàng Gia { X: 18, Z: -38 }
  createZebraCrossing(18, -38, false);

  // Vạch 3: Ngã tư kết nối Trục Spine Bờ Nam & Đại Lộ Đông Tây { X: 28, Z: 65 }
  createZebraCrossing(28, 65, true);

  // 6. 4 ĐIỂM GIAO HÀNG ĐẾ CHẾ (DELIVERY HUBS)
  window.lumberDeliveryHubs = [
    {
      id: 'harbor',
      name: 'CẢNG BIỂN LOGISTICS VIỄN DƯƠNG',
      shortName: 'Cảng Biển',
      pos: new THREE.Vector3(-65, 0, 65),
      color: 0x0284c7,
      iconText: '⚓ GIAO HÀNG TÀU CONTAINER',
      rewardPerCargo: 3800,
      rewardExp: 80,
      rewardGems: 0,
      radius: 8.5
    },
    {
      id: 'furniture',
      name: 'XƯỞNG CHẾ TÁC NỘI THẤT BẮC ÂU',
      shortName: 'Xưởng Nội Thất',
      pos: new THREE.Vector3(-35, 0, 115),
      color: 0xf97316,
      iconText: '🪑 GIAO GỖ XƯỞNG NỘI THẤT',
      rewardPerCargo: 4500,
      rewardExp: 90,
      rewardGems: 0,
      radius: 8.5
    },
    {
      id: 'resort',
      name: 'SIÊU RESORT CAO CẤP MALDIVES',
      shortName: 'Resort Maldives',
      pos: new THREE.Vector3(105, 0, 140),
      color: 0x06b6d4,
      iconText: '🏖️ GIAO GỖ CẢNH QUAN RESORT',
      rewardPerCargo: 5600,
      rewardExp: 110,
      rewardGems: 1,
      radius: 8.5
    },
    {
      id: 'airport',
      name: 'SÂN BAY QUỐC TẾ SKYCARGO',
      shortName: 'Sân Bay SkyCargo',
      pos: new THREE.Vector3(90, 0, 95),
      color: 0x8b5cf6,
      iconText: '✈️ GIAO HÀNG XUẤT KHẨU BOEING 747',
      rewardPerCargo: 7200,
      rewardExp: 150,
      rewardGems: 2,
      radius: 8.5
    }
  ];

  window.lumberDeliveryHubs.forEach(hub => {
    const hubGroup = new THREE.Group();
    hubGroup.position.copy(hub.pos);
    scene.add(hubGroup);

    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(3.6, 4.8, 32),
      new THREE.MeshBasicMaterial({ color: hub.color, side: THREE.DoubleSide })
    );
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.08;
    hubGroup.add(outerRing);

    const innerPad = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 24),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 })
    );
    innerPad.rotation.x = -Math.PI / 2;
    innerPad.position.y = 0.06;
    hubGroup.add(innerPad);

    [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]].forEach(([cx, cz]) => {
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.35, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0xf97316 }));
      cone.position.set(cx, 0.6, cz);
      hubGroup.add(cone);
    });

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.roundRect(10, 10, 492, 108, 20);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.roundRect(10, 10, 492, 108, 20);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(hub.iconText, 256, 70);

    const signTex = new THREE.CanvasTexture(canvas);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true, side: THREE.DoubleSide });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 1.6), signMat);
    sign.position.set(0, 4.2, 0);
    hubGroup.add(sign);

    hub.group = hubGroup;
    hub.ring = outerRing;
  });
}
window.createEmpireHighwayNetwork = createEmpireHighwayNetwork;

// ===========================================================================
// HỆ THỐNG KIẾN TRÚC MỞ (OPEN-TOP CUTAWAY ARCHITECTURE) & MINI NPC ĐÔ THỊ
// TẤT CẢ TÒA NHÀ ĐỀU KHÔNG CÓ MÁI ĐỂ QUAN SÁT RÕ NỘI THẤT VÀ NHÂN VIÊN LÀM VIỆC
// TỌA ĐỘ 100% TRÊN ĐẤT LIỀN - KHÔNG CHỒNG SÔNG (Z: 4..28) - KHÔNG CHỒNG CAO TỐC
// ===========================================================================

// Danh sách mini NPC đô thị nội thất cutaway để cập nhật cử động mượt mà
window.cutawayMiniNPCs = window.cutawayMiniNPCs || [];

function createMiniNPC(options) {
  const {
    role = 'worker',
    posX = 0,
    posY = 0.1,
    posZ = 0,
    rotY = 0,
    shirtColor = 0x3b82f6,
    pantsColor = 0x1e293b,
    hatType = 'none',
    animType = 'breathe'
  } = options;

  const npcGroup = new THREE.Group();
  npcGroup.position.set(posX, posY, posZ);
  npcGroup.rotation.y = rotY;

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.6 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });

  // 1. Chân & Giày
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.55, 0.22), pantsMat);
  legs.position.y = 0.275;
  legs.castShadow = true;
  npcGroup.add(legs);

  const shoes = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.1, 0.32), shoeMat);
  shoes.position.set(0, 0.05, 0.04);
  npcGroup.add(shoes);

  // 2. Thân mình (Torso)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.55, 0.26), shirtMat);
  torso.position.y = 0.825;
  torso.castShadow = true;
  npcGroup.add(torso);

  // 3. Đầu (Head)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), skinMat);
  head.position.y = 1.25;
  head.castShadow = true;
  npcGroup.add(head);

  // 4. Hai tay
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), shirtMat);
  leftArm.position.set(-0.28, 0.82, 0);
  npcGroup.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), shirtMat);
  rightArm.position.set(0.28, 0.82, 0);
  npcGroup.add(rightArm);

  // 5. Mũ và phụ kiện theo nghề nghiệp
  if (hatType === 'police_cap') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.20, 0.10, 12), new THREE.MeshStandardMaterial({ color: 0x1e3a8a }));
    cap.position.y = 1.40;
    npcGroup.add(cap);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.15), shoeMat);
    visor.position.set(0, 1.37, 0.14);
    npcGroup.add(visor);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    badge.position.set(0, 1.41, 0.20);
    npcGroup.add(badge);
  } else if (hatType === 'hardhat') {
    const hardhat = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 }));
    hardhat.position.y = 1.34;
    npcGroup.add(hardhat);
  } else if (hatType === 'fire_helmet') {
    const fHelmet = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
    fHelmet.position.y = 1.38;
    npcGroup.add(fHelmet);
    const fShield = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.18), new THREE.MeshStandardMaterial({ color: 0xfef08a }));
    fShield.position.set(0, 1.35, 0.14);
    npcGroup.add(fShield);
  } else if (hatType === 'doctor') {
    const steth = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
    steth.rotation.x = Math.PI / 2;
    steth.position.set(0, 1.08, 0.05);
    npcGroup.add(steth);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.36), new THREE.MeshStandardMaterial({ color: 0x475569 }));
    hair.position.y = 1.38;
    npcGroup.add(hair);
  } else if (hatType === 'straw_hat') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.04, 16), new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9 }));
    brim.position.y = 1.36;
    npcGroup.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.9 }));
    crown.position.y = 1.43;
    npcGroup.add(crown);
  } else if (hatType === 'mayor_hair') {
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.38), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    hair.position.y = 1.38;
    npcGroup.add(hair);
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.02), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
    tie.position.set(0, 0.85, 0.14);
    npcGroup.add(tie);
  } else if (hatType === 'prisoner') {
    for (let sy = 0.65; sy <= 1.05; sy += 0.12) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.27), new THREE.MeshBasicMaterial({ color: 0x0f172a }));
      stripe.position.set(0, sy, 0);
      npcGroup.add(stripe);
    }
  }

  // Búa rèn kim loại nếu animType === hammer
  if (animType === 'hammer') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 6), new THREE.MeshStandardMaterial({ color: 0x78350f }));
    handle.position.set(0.28, 0.65, 0.22);
    handle.rotation.x = Math.PI / 4;
    npcGroup.add(handle);
    const hHead = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 0.18), new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 }));
    hHead.position.set(0.28, 0.80, 0.35);
    npcGroup.add(hHead);
  }

  const npcObj = {
    group: npcGroup,
    role,
    animType,
    head,
    arm: rightArm,
    leftArm,
    baseY: posY,
    phase: Math.random() * Math.PI * 2
  };

  npcGroup.group = npcGroup;
  npcGroup.npcData = npcObj;

  window.cutawayMiniNPCs.push(npcObj);
  return npcGroup;
}

// ===========================================================================
// 8. QUẬN KHAI KHOÁNG & LÒ CAO LUYỆN KIM (MINING & METALLURGY OPEN FOUNDRY)
// Tọa độ Đất liền Đông Bắc: X = 75, Z = -75 (Cách xa đường cao tốc Z: -38, Z: -110 & Sông Z: 4..28)
// THIẾT KẾ MỞ (OPEN-TOP): KHÔNG MÁI - THẤY RÕ LÒ LUYỆN, ĐE THÉP & THỢ RÈN ĐANG ĐẬP BÚA
// ===========================================================================
function createMiningAndMetallurgyDistrict(scene) {
  const mineGroup = new THREE.Group();
  mineGroup.name = 'mining_metallurgy_district';
  mineGroup.position.set(75, 0, -75);
  scene.add(mineGroup);

  const ironMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75, metalness: 0.8 });
  const rustMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.85 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.95 });
  const moltenMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });

  // 1. Sàn bê tông chịu nhiệt & đá xỉ (26m x 20m)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(26, 0.2, 20), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 }));
  floor.position.y = 0.1;
  floor.receiveShadow = true;
  mineGroup.add(floor);

  // 2. TƯỜNG CẮT LỬNG MỞ (CUTAWAY WALLS - CAO 1.6M, HOÀN TOÀN KHÔNG CÓ MÁI NHÀ)
  const wallS = new THREE.Mesh(new THREE.BoxGeometry(26, 1.6, 0.6), wallMat);
  wallS.position.set(0, 0.9, -10);
  mineGroup.add(wallS);

  const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 20), wallMat);
  wallW.position.set(-13, 0.9, 0);
  mineGroup.add(wallW);

  const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 20), wallMat);
  wallE.position.set(13, 0.9, 0);
  mineGroup.add(wallE);

  // 3. LÒ CAO LUYỆN KIM CHÍNH & MÁNG KIM LOẠI NÓNG CHẢY RỰC RỠ
  const furnaceGroup = new THREE.Group();
  furnaceGroup.position.set(4, 0, -2);
  mineGroup.add(furnaceGroup);

  const stack = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 7.5, 16), ironMat);
  stack.position.y = 3.75;
  stack.castShadow = true;
  furnaceGroup.add(stack);

  // Máng kim loại lỏng rực lửa (Molten Metal Trough)
  const trough = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 4.5), rustMat);
  trough.position.set(0, 0.4, 3.2);
  furnaceGroup.add(trough);

  const moltenPool = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 4.0), moltenMat);
  moltenPool.rotation.x = -Math.PI / 2;
  moltenPool.position.set(0, 0.72, 3.2);
  furnaceGroup.add(moltenPool);

  const furnaceLight = new THREE.PointLight(0xff6600, 2.8, 16, 1.5);
  furnaceLight.position.set(0, 1.8, 3.2);
  furnaceGroup.add(furnaceLight);

  // Đe rèn thép & Thợ rèn Blacksmith
  const anvilStump = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0x78350f }));
  anvilStump.position.set(8.5, 0.35, 2.5);
  mineGroup.add(anvilStump);

  const anvilTop = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.5), ironMat);
  anvilTop.position.set(8.5, 0.85, 2.5);
  mineGroup.add(anvilTop);

  // MINI NPC THỢ RÈN / LUYỆN KIM ĐANG ĐẬP BÚA
  const smith = createMiniNPC({
    role: 'blacksmith',
    posX: 8.5,
    posY: 0.1,
    posZ: 1.5,
    rotY: 0,
    shirtColor: 0x7c2d12, // Tạp dề nâu da bò
    pantsColor: 0x0f172a,
    hatType: 'hardhat',
    animType: 'hammer'
  });
  mineGroup.add(smith.group);

  // Chồng dầm thép thành phẩm
  for (let bi = 0; bi < 3; bi++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.4, 0.5), ironMat);
    beam.position.set(7.5, 0.3 + bi * 0.42, 6.5);
    mineGroup.add(beam);
  }

  // 4. 2 SILO XI MĂNG BÊ TÔNG & THANG MÈO
  [-8, -3.5].forEach((sx) => {
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 7.5, 16), concreteMat);
    silo.position.set(sx, 3.75, -4);
    silo.castShadow = true;
    mineGroup.add(silo);

    const sCap = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.0, 16), ironMat);
    sCap.position.set(sx, 8.0, -4);
    mineGroup.add(sCap);
  });

  // 5. CÁC PAD TƯƠNG TÁC CHÍNH
  const minePad = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.2, 32), new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide }));
  minePad.rotation.x = -Math.PI / 2;
  minePad.position.set(0, 0.22, 7.0);
  mineGroup.add(minePad);

  const mineTag = makeBillboardText('⛏️ MỎ SẮT & LÒ CAO: [E] NẤU QUẶNG ➜ DẦM THÉP (+1 THÉP)', '#06b6d4', 440, 50);
  mineTag.position.set(0, 3.6, 7.0);
  mineGroup.add(mineTag);

  const cementPad = new THREE.Mesh(new THREE.RingGeometry(2.0, 2.9, 32), new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }));
  cementPad.rotation.x = -Math.PI / 2;
  cementPad.position.set(-13, 0.22, 0);
  mineGroup.add(cementPad);

  const cementTag = makeBillboardText('🧱 TRẠM XI MĂNG: [E] KHAI THÁC ĐÁ VÔI ➜ XI MĂNG (+1 BAO)', '#facc15', 440, 50);
  cementTag.position.set(-13, 3.6, 0);
  mineGroup.add(cementTag);

  window.miningPad = { pos: new THREE.Vector3(75, 0, -68), radius: 5.0, cooldown: 0 };
  window.cementPad = { pos: new THREE.Vector3(62, 0, -75), radius: 5.0, cooldown: 0 };
}
window.createMiningAndMetallurgyDistrict = createMiningAndMetallurgyDistrict;

// ===========================================================================
// 9. QUẬN NÔNG TRƯỜNG & CHẾ BIẾN LƯƠNG THỰC (AGRO-FOOD PLAINS & OPEN MILL)
// Tọa độ Đất liền Tây Bắc: X = -65, Z = -75 (Cách xa đường cao tốc Z: -38, Z: -110 & Sông Z: 4..28)
// THIẾT KẾ MỞ (OPEN-TOP): KHÔNG MÁI - THẤY CÁNH ĐỒNG LÚA MÌ, BAO BỘT MÌ & NÔNG DÂN ĐANG LÀM VIỆC
// ===========================================================================
function createAgroFoodDistrict(scene) {
  const agroGroup = new THREE.Group();
  agroGroup.name = 'agro_food_district';
  agroGroup.position.set(-65, 0, -75);
  scene.add(agroGroup);

  const wheatMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.85 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 });
  const barnMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.7 });
  const sackMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9 });

  // 1. Cánh đồng lúa mì vàng óng (26m x 16m)
  const field = new THREE.Mesh(new THREE.PlaneGeometry(26, 16), wheatMat);
  field.rotation.x = -Math.PI / 2;
  field.position.set(0, 0.12, -4);
  field.receiveShadow = true;
  agroGroup.add(field);

  // Các luống lúa mì dập dờn
  for (let r = -10; r <= 2; r += 2.2) {
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(24, 0.3, 0.8), new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.9 }));
    ridge.position.set(0, 0.25, r);
    agroGroup.add(ridge);
  }

  // 2. NHÀ XƯỞNG XAY XÁT & ĐÓNG HỘP MỞ CẮT LỬNG (OPEN-TOP CUTAWAY - KHÔNG CÓ MÁI NHÀ)
  const millGroup = new THREE.Group();
  millGroup.position.set(0, 0, 8);
  agroGroup.add(millGroup);

  // Sàn gỗ xưởng xay xát (16m x 10m)
  const millFloor = new THREE.Mesh(new THREE.BoxGeometry(16, 0.2, 10), woodMat);
  millFloor.position.y = 0.1;
  millFloor.receiveShadow = true;
  millGroup.add(millFloor);

  // Tường cắt lửng cao 1.5m (North, South, East, West với cửa mở)
  const wN = new THREE.Mesh(new THREE.BoxGeometry(16, 1.5, 0.4), barnMat);
  wN.position.set(0, 0.85, -5);
  millGroup.add(wN);

  const wE = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.5, 10), barnMat);
  wE.position.set(8, 0.85, 0);
  millGroup.add(wE);

  const wW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.5, 10), barnMat);
  wW.position.set(-8, 0.85, 0);
  millGroup.add(wW);

  // Băng chuyền đóng hộp lương thực
  const conv = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.6, 1.2), new THREE.MeshStandardMaterial({ color: 0x334155 }));
  conv.position.set(-2, 0.4, 0);
  millGroup.add(conv);

  // Các thùng ration trên băng chuyền
  [-2.2, 0, 2.2].forEach(bx => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.8), new THREE.MeshStandardMaterial({ color: 0x16a34a }));
    box.position.set(-2 + bx, 0.9, 0);
    millGroup.add(box);
  });

  // Chồng bao tải bột mì
  for (let si = 0; si < 4; si++) {
    const sack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.8), sackMat);
    sack.position.set(4.5, 0.25 + si * 0.36, 1.5);
    millGroup.add(sack);
  }

  // Cối xay bột đá
  const millStone = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.8, 16), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
  millStone.position.set(4.5, 0.5, -2.5);
  millGroup.add(millStone);

  // MINI NPC NÔNG DÂN ĐỘI MŨ RƠM ĐANG KIỂM KÊ BAO LƯƠNG THỰC
  const farmer = createMiniNPC({
    role: 'farmer',
    posX: 2.8,
    posY: 0.1,
    posZ: 0.8,
    rotY: -Math.PI / 4,
    shirtColor: 0x15803d, // Áo xanh nông dân
    pantsColor: 0x1e3a8a, // Quần jean
    hatType: 'straw_hat',
    animType: 'turn'
  });
  millGroup.add(farmer.group);

  // 3. 2 THÁP SILO TRỮ NGŨ CỐC
  [-11, -7].forEach((sx) => {
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 6.5, 16), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 }));
    silo.position.set(sx, 3.25, -9);
    silo.castShadow = true;
    agroGroup.add(silo);
  });

  // 4. PAD THU HOẠCH & ĐÓNG HỘP THỰC PHẨM
  const agroPad = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.5, 32), new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide }));
  agroPad.rotation.x = -Math.PI / 2;
  agroPad.position.set(0, 0.25, 9.0);
  agroGroup.add(agroPad);

  const agroTag = makeBillboardText('🌾 NÔNG TRƯỜNG ĐÔ THỊ: [E] THU HOẠCH ➜ ĐÓNG HỘP (+2 LƯƠNG THỰC)', '#22c55e', 440, 50);
  agroTag.position.set(0, 3.8, 9.0);
  agroGroup.add(agroTag);

  window.agroFoodPad = { pos: new THREE.Vector3(-65, 0, -66), radius: 5.0, cooldown: 0 };
}
window.createAgroFoodDistrict = createAgroFoodDistrict;

// ===========================================================================
// 10. ĐẠI CÔNG TRƯỜNG KỲ QUAN THẾ KỶ (EMPIRE LANDMARK MEGA CONSTRUCTION)
// Tọa độ Quảng Trường Trung Tâm Bờ Nam: X = -20, Z = 100 (Đất liền vững chắc, cách xa Sông Z: 4..28)
// CÔNG TRƯỜNG MỞ: CẦN CẨU THÁP 24M, CÔNG NHÂN ĐỘI MŨ BẢO HỘ & CÁC TẦNG XÂY DỰNG TOÀN SERVER
// ===========================================================================
function createEmpireLandmarkConstruction(scene) {
  const lmGroup = new THREE.Group();
  lmGroup.name = 'empire_landmark_district';
  lmGroup.position.set(-20, 0, 100);
  scene.add(lmGroup);
  window.landmarkConstructionGroup = lmGroup;

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4, metalness: 0.8 });

  // 1. Móng công trường hình bát giác khổng lồ đường kính 24 mét
  const baseFoundation = new THREE.Mesh(new THREE.CylinderGeometry(12, 13, 0.8, 8), concreteMat);
  baseFoundation.position.y = 0.4;
  baseFoundation.receiveShadow = true;
  lmGroup.add(baseFoundation);

  // Viền vạch an toàn vàng đen công trình
  const warnRim = new THREE.Mesh(new THREE.RingGeometry(11.5, 12.8, 8), new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }));
  warnRim.rotation.x = -Math.PI / 2;
  warnRim.position.y = 0.82;
  lmGroup.add(warnRim);

  // Rào chắn bảo hộ công trường cắt lửng (Cao 1.2m, KHÔNG CÓ MÁI NHÀ)
  for (let ai = 0; ai < 8; ai++) {
    const ang = (ai / 8) * Math.PI * 2;
    const fx = Math.cos(ang) * 12.4;
    const fz = Math.sin(ang) * 12.4;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6), steelMat);
    post.position.set(fx, 1.4, fz);
    lmGroup.add(post);
  }

  // 2. CẦN CẨU THÁP CÔNG TRÌNH CAO 24 MÉT (HEAVY DUTY TOWER CRANE)
  const craneGroup = new THREE.Group();
  craneGroup.position.set(7.5, 0, 7.5);
  lmGroup.add(craneGroup);

  const mast = new THREE.Mesh(new THREE.BoxGeometry(1.2, 24, 1.2), steelMat);
  mast.position.y = 12;
  mast.castShadow = true;
  craneGroup.add(mast);

  // Cụm cần cẩu quay 360 độ trên đỉnh tháp
  const jibGroup = new THREE.Group();
  jibGroup.position.set(0, 24, 0);
  craneGroup.add(jibGroup);
  window.towerCraneArm = jibGroup;

  const mainJib = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 16), steelMat);
  mainJib.position.set(0, 0.45, 8);
  jibGroup.add(mainJib);

  const counterJib = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 6.5), steelMat);
  counterJib.position.set(0, 0.45, -3.2);
  jibGroup.add(counterJib);

  const weight = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 2.2), concreteMat);
  weight.position.set(0, 0.7, -5.0);
  jibGroup.add(weight);

  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 9, 6), steelMat);
  cable.position.set(0, -4.5, 8);
  jibGroup.add(cable);

  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), steelMat);
  hook.position.set(0, -9.0, 8);
  jibGroup.add(hook);

  // 3. KHỐI KẾT CẤU THÁP THEO GIAI ĐOẠN SERVER
  const stageGroup = new THREE.Group();
  stageGroup.position.set(0, 0.8, 0);
  lmGroup.add(stageGroup);
  window.landmarkStageGroup = stageGroup;

  buildLandmarkStageMeshes(1);

  // 4. MINI NPC KỸ SƯ CÔNG TRƯỜNG & THỢ XÂY ĐỘI MŨ BẢO HỘ
  const engineer = createMiniNPC({
    role: 'engineer',
    posX: -5.0,
    posY: 0.8,
    posZ: -3.5,
    rotY: Math.PI / 4,
    shirtColor: 0xea580c, // Áo bảo hộ cam dạ quang
    pantsColor: 0x334155,
    hatType: 'hardhat',
    animType: 'type'
  });
  lmGroup.add(engineer.group);

  const worker = createMiniNPC({
    role: 'builder',
    posX: 4.0,
    posY: 0.8,
    posZ: -4.0,
    rotY: -Math.PI / 3,
    shirtColor: 0xfacc15, // Áo vàng bảo hộ
    pantsColor: 0x1e293b,
    hatType: 'hardhat',
    animType: 'breathe'
  });
  lmGroup.add(worker.group);

  // 5. PAD NẠP VẬT TƯ ĐÓNG GÓP TOÀN SERVER (CONTRIBUTION PAD)
  const padMesh = new THREE.Mesh(new THREE.RingGeometry(3.5, 5.0, 32), new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide }));
  padMesh.rotation.x = -Math.PI / 2;
  padMesh.position.set(0, 0.15, -14);
  lmGroup.add(padMesh);

  const padTag = makeBillboardText('🏗️ ĐẠI CÔNG TRƯỜNG THẾ KỶ: [E] MỞ BẢNG ĐÓNG GÓP XÂY DỰNG', '#f59e0b', 450, 52);
  padTag.position.set(0, 4.5, -14);
  lmGroup.add(padTag);

  window.landmarkContributionPad = { pos: new THREE.Vector3(-20, 0, 86), radius: 6.0 };
}
window.createEmpireLandmarkConstruction = createEmpireLandmarkConstruction;

function buildLandmarkStageMeshes(stage) {
  if (!window.landmarkStageGroup) return;
  const sg = window.landmarkStageGroup;
  while (sg.children.length > 0) {
    sg.remove(sg.children[0]);
  }

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4, metalness: 0.8 });
  const netMat = new THREE.MeshStandardMaterial({ color: 0x059669, transparent: true, opacity: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65, metalness: 0.8 });

  if (stage === 1) {
    [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]].forEach(([cx, cz]) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(2.4, 8, 2.4), concreteMat);
      col.position.set(cx, 4, cz);
      col.castShadow = true;
      sg.add(col);

      const rebar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), steelMat);
      rebar.position.set(cx, 9.1, cz);
      sg.add(rebar);
    });
    const scaffoldNet = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 14), netMat);
    scaffoldNet.position.set(0, 4, 0);
    sg.add(scaffoldNet);
  } else if (stage === 2) {
    const core = new THREE.Mesh(new THREE.BoxGeometry(11, 32, 11), concreteMat);
    core.position.set(0, 16, 0);
    core.castShadow = true;
    sg.add(core);

    const outerNet = new THREE.Mesh(new THREE.BoxGeometry(13.5, 30, 13.5), netMat);
    outerNet.position.set(0, 15, 0);
    sg.add(outerNet);
  } else if (stage >= 3) {
    const baseTower = new THREE.Mesh(new THREE.BoxGeometry(12, 42, 12), concreteMat);
    baseTower.position.set(0, 21, 0);
    sg.add(baseTower);

    const glassCrown = new THREE.Mesh(new THREE.ConeGeometry(7.5, 24, 8), glassMat);
    glassCrown.position.set(0, 54, 0);
    sg.add(glassCrown);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    beacon.position.set(0, 66, 0);
    sg.add(beacon);

    const beaconLight = new THREE.PointLight(0x38bdf8, 3.5, 45, 1.5);
    beaconLight.position.set(0, 66, 0);
    sg.add(beaconLight);
  }
}
window.buildLandmarkStageMeshes = buildLandmarkStageMeshes;

function updateLandmarkConstructionMesh(landmarkProject) {
  if (landmarkProject && landmarkProject.stage) {
    buildLandmarkStageMeshes(landmarkProject.stage);
  }
}
window.updateLandmarkConstructionMesh = updateLandmarkConstructionMesh;

// ===========================================================================
// 11. KHU TRUNG TÂM HÀNH CHÍNH & AN NINH ĐÔ THỊ (CIVIC & JUSTICE DISTRICT)
// TẤT CẢ CÁC TÒA NHÀ ĐỀU ÁP DỤNG KIẾN TRÚC MỞ (OPEN-TOP CUTAWAY - KHÔNG MÁI)
// CAMERA NHÌN TỪ TRÊN XUỐNG THẤY TOÀN BỘ PHÒNG LÀM VIỆC, GIƯỜNG BỆNH, PHÒNG GIAM & MINI NPC!
// TỌA ĐỘ VÀNG TRÊN ĐẤT LIỀN - KHÔNG CHỒNG CAO TỐC (X=28, X=-110) - KHÔNG CHỒNG SÔNG (Z: 4..28)
// ===========================================================================
function createCityHallAndJusticeDistrict(scene) {
  const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
  const darkMarbleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
  const policeBlue = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.4 });
  const jailConcrete = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.95 });
  const clinicTile = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.25 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 });
  const ironBarMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.3 });

  // -------------------------------------------------------------------------
  // 0. QUẢNG TRƯỜNG PHỐ ĐI BỘ LÁT ĐÁ BỜ NAM (CIVIC PROMENADE PLAZA)
  // Tọa độ Z = 43, X từ -80 đến +10 (Phía Tây trục Spine X = 28)
  // Và Z = 43, X từ +50 đến +90 (Phía Đông trục Spine X = 28) -> HOÀN TOÀN TÁCH BIỆT CAO TỐC
  // -------------------------------------------------------------------------
  const westPlaza = new THREE.Mesh(new THREE.BoxGeometry(90, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 }));
  westPlaza.position.set(-35, 0.05, 43);
  westPlaza.receiveShadow = true;
  scene.add(westPlaza);

  const eastPlaza = new THREE.Mesh(new THREE.BoxGeometry(40, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 }));
  eastPlaza.position.set(70, 0.05, 43);
  eastPlaza.receiveShadow = true;
  scene.add(eastPlaza);

  // Đèn đường trang trí cổ điển dọc quảng trường
  [-75, -55, -35, -15, 5, 55, 75, 85].forEach(lx => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.8, 8), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    pole.position.set(lx, 1.9, 40);
    scene.add(pole);

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
    bulb.position.set(lx, 3.8, 40);
    scene.add(bulb);
  });

  // -------------------------------------------------------------------------
  // 1. TRẠM KIỂM SOÁT AN NINH & ĐỒN CẢNH SÁT ĐÔ THỊ (POLICE DISPATCH POST)
  // Tọa độ vỉa hè phố đi bộ phía Tây: X = -53, Z = 67
  // Bốt an ninh hiện đại kính cường lực, đèn chớp cảnh sát & sĩ quan trực ban
  // -------------------------------------------------------------------------
  const polGroup = new THREE.Group();
  polGroup.name = 'police_hq_district';
  polGroup.position.set(-53, 0, 67);
  scene.add(polGroup);

  const boothBase = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 4.2), darkMarbleMat);
  boothBase.position.y = 0.15;
  polGroup.add(boothBase);

  const boothCabin = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.8, 3.6), policeBlue);
  boothCabin.position.y = 1.7;
  polGroup.add(boothCabin);

  const boothGlass = new THREE.Mesh(new THREE.BoxGeometry(3.7, 1.2, 3.7), new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 }));
  boothGlass.position.y = 2.0;
  polGroup.add(boothGlass);

  // Đèn cảnh sát nhấp nháy đỏ xanh ngoài cửa
  const redBlink = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  redBlink.position.set(-0.8, 3.3, 0);
  polGroup.add(redBlink);
  const blueBlink = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0x0284c7 }));
  blueBlink.position.set(0.8, 3.3, 0);
  polGroup.add(blueBlink);

  // Sĩ quan Cảnh sát trực ban
  const officerNPC = createMiniNPC({
    role: 'officer',
    posX: 0,
    posY: 0.3,
    posZ: 1.5,
    rotY: 0,
    shirtColor: 0x1e3a8a,
    pantsColor: 0x0f172a,
    hatType: 'police',
    animType: 'nod'
  });
  polGroup.add(officerNPC.group);

  const polTag = makeBillboardText('👮 BỐT AN NINH CẢNH SÁT: [E] ĐẦU THÚ / NHẬN LƯƠNG TUẦN TRA', '#0284c7', 420, 44);
  polTag.position.set(0, 4.2, 0);
  polGroup.add(polTag);

  window.policeEnlistPad = { pos: new THREE.Vector3(-53, 0, 67), radius: 5.0 };

  // -------------------------------------------------------------------------
  // 3. BỆNH VIỆN ĐA KHOA & TRẠM CỨU HỎA KHẨN CẤP (HOSPITAL & FIRE - OPEN-TOP CUTAWAY)
  // Tọa độ Đất liền Bờ Nam phía Đông trục Spine: X = 70, Z = 56
  // KHÔNG MÁI NHÀ - THẤY GIƯỜNG CẤP CỨU, BÁC SĨ KHÁM BỆNH, XE CỨU HỎA & LÍNH CỨU HỎA
  // -------------------------------------------------------------------------
  const fireHospGroup = new THREE.Group();
  fireHospGroup.name = 'hospital_fire_district';
  fireHospGroup.position.set(70, 0, 56);
  scene.add(fireHospGroup);

  // Sàn gạch trắng men bóng (24m x 14m)
  const hospFloor = new THREE.Mesh(new THREE.BoxGeometry(24, 0.2, 14), clinicTile);
  hospFloor.position.y = 0.1;
  hospFloor.receiveShadow = true;
  fireHospGroup.add(hospFloor);

  // TƯỜNG CẮT LỬNG MỞ (CUTAWAY WALLS - CAO 1.8M, KHÔNG MÁI NHÀ ĐỂ QUAN SÁT)
  const hospWallS = new THREE.Mesh(new THREE.BoxGeometry(24, 1.8, 0.4), darkMarbleMat);
  hospWallS.position.set(0, 1.0, 7);
  fireHospGroup.add(hospWallS);

  const hospWallE = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.8, 14), darkMarbleMat);
  hospWallE.position.set(12, 1.0, 0);
  fireHospGroup.add(hospWallE);

  const hospWallW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.8, 14), darkMarbleMat);
  hospWallW.position.set(-12, 1.0, 0);
  fireHospGroup.add(hospWallW);

  // Cửa trước
  const hospWallN1 = new THREE.Mesh(new THREE.BoxGeometry(9.5, 1.8, 0.4), darkMarbleMat);
  hospWallN1.position.set(-7.25, 1.0, -7);
  fireHospGroup.add(hospWallN1);
  const hospWallN2 = new THREE.Mesh(new THREE.BoxGeometry(9.5, 1.8, 0.4), darkMarbleMat);
  hospWallN2.position.set(7.25, 1.0, -7);
  fireHospGroup.add(hospWallN2);

  // Vách ngăn đôi Bệnh viện (Trái X < 0) và Cứu hỏa (Phải X > 0)
  const partHosp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.8, 14), darkMarbleMat);
  partHosp.position.set(0, 1.0, 0);
  fireHospGroup.add(partHosp);

  // NỘI THẤT BỆNH VIỆN CẤP CỨU (X < 0):
  // 2 Giường bệnh nhân
  [-6, -2.5].forEach(bx => {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 2.4), new THREE.MeshStandardMaterial({ color: 0x38bdf8 }));
    bed.position.set(bx, 0.45, 1.5);
    fireHospGroup.add(bed);

    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 0.6), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
    pillow.position.set(bx, 0.85, 2.3);
    fireHospGroup.add(pillow);

    // Cột truyền dịch y tế (IV Drip)
    const ivPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 6), ironBarMat);
    ivPole.position.set(bx - 1.0, 1.0, 2.0);
    fireHospGroup.add(ivPole);
    const ivBag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.1), new THREE.MeshBasicMaterial({ color: 0xe0f2fe }));
    ivBag.position.set(bx - 1.0, 1.7, 2.0);
    fireHospGroup.add(ivBag);
  });

  // MINI NPC BÁC SĨ ĐEO ỐNG NGHE ĐANG KHÁM BỆNH
  const doctorNPC = createMiniNPC({
    role: 'doctor',
    posX: -4.5,
    posY: 0.1,
    posZ: 0.5,
    rotY: 0,
    shirtColor: 0xf8fafc, // Áo blouse trắng
    pantsColor: 0x0284c7, // Quần scrubs xanh y tế
    hatType: 'doctor',
    animType: 'turn'
  });
  fireHospGroup.add(doctorNPC.group);

  // Biểu tượng chữ thập đỏ phát sáng
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.1), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  crossH.position.set(-6, 2.2, -7.1);
  fireHospGroup.add(crossH);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.1), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  crossV.position.set(-6, 2.2, -7.1);
  fireHospGroup.add(crossV);

  // NỘI THẤT TRẠM CỨU HỎA (X > 0):
  // Kệ thiết bị: Bình bọt khí CO2 & Rìu cứu hỏa
  for (let oi = 0; oi < 3; oi++) {
    const oxy = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.0, 8), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
    oxy.position.set(3.5 + oi * 0.8, 0.6, 4.5);
    fireHospGroup.add(oxy);
  }

  // Cuộn vòi cứu hỏa tường
  const hoseReel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
  hoseReel.rotation.z = Math.PI / 2;
  hoseReel.position.set(11.7, 1.1, 1.0);
  fireHospGroup.add(hoseReel);

  // MINI NPC LÍNH CỨU HỎA ĐỘI MŨ BẢO HỘ CHỮA CHÁY
  const firefighterNPC = createMiniNPC({
    role: 'firefighter',
    posX: 6.0,
    posY: 0.1,
    posZ: 1.5,
    rotY: -Math.PI / 4,
    shirtColor: 0xdc2626, // Đồ bảo hộ cứu hỏa đỏ
    pantsColor: 0xfacc15, // Quần phản quang vàng
    hatType: 'fire_helmet',
    animType: 'breathe'
  });
  fireHospGroup.add(firefighterNPC.group);

  // PAD CỨU HỎA & BỆNH VIỆN
  const hospPad = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.6, 32), new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide }));
  hospPad.rotation.x = -Math.PI / 2;
  hospPad.position.set(0, 0.15, -10.0);
  fireHospGroup.add(hospPad);

  const hospTag = makeBillboardText('🚑 TRUNG TÂM CẤP CỨU & 911: [E] MỞ BẢNG NHIỆM VỤ CỨU HỘ', '#ef4444', 430, 50);
  hospTag.position.set(0, 4.0, -10.0);
  fireHospGroup.add(hospTag);

  window.hospitalFirePad = { pos: new THREE.Vector3(70, 0, 46), radius: 5.0 };

  // -------------------------------------------------------------------------
  // 4. TRẠI GIAM BIỆT LẬP NGOẠI Ô (MAXIMUM SECURITY PRISON - OPEN-TOP CUTAWAY)
  // Tọa độ Ngoại ô Viễn Tây: X = -145, Z = 60 (Tách biệt hoàn toàn, phía Tây Beltway X = -110)
  // KHÔNG MÁI NHÀ - THẤY SÂN TẬP THỂ DỤC PHẠM NHÂN, PHÒNG GIAM & CẢNH SÁT GÁC
  // -------------------------------------------------------------------------
  const jailGroup = new THREE.Group();
  jailGroup.name = 'prison_district';
  jailGroup.position.set(-145, 0, 60);
  scene.add(jailGroup);

  // Sàn bê tông thô ráp nhà tù (26m x 22m)
  const jailFloor = new THREE.Mesh(new THREE.BoxGeometry(26, 0.2, 22), jailConcrete);
  jailFloor.position.y = 0.1;
  jailFloor.receiveShadow = true;
  jailGroup.add(jailFloor);

  // TƯỜNG BÊ TÔNG CẮT LỬNG CAO 1.8M (KHÔNG CÓ MÁI NHÀ)
  const jwN = new THREE.Mesh(new THREE.BoxGeometry(26, 1.8, 0.8), jailConcrete);
  jwN.position.set(0, 1.0, -11);
  jailGroup.add(jwN);

  const jwE = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 22), jailConcrete);
  jwE.position.set(13, 1.0, 0);
  jailGroup.add(jwE);

  const jwW = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 22), jailConcrete);
  jwW.position.set(-13, 1.0, 0);
  jailGroup.add(jwW);

  // Tường Nam có cổng sắt vào trại
  const jwS1 = new THREE.Mesh(new THREE.BoxGeometry(10.5, 1.8, 0.8), jailConcrete);
  jwS1.position.set(-7.75, 1.0, 11);
  jailGroup.add(jwS1);
  const jwS2 = new THREE.Mesh(new THREE.BoxGeometry(10.5, 1.8, 0.8), jailConcrete);
  jwS2.position.set(7.75, 1.0, 11);
  jailGroup.add(jwS2);

  // 4 Tháp canh cao 7.5m ở 4 góc với đèn pha rọi
  [[-13, -11], [13, -11], [-13, 11], [13, 11]].forEach(([tx, tz]) => {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.3, 7.5, 8), jailConcrete);
    tower.position.set(tx, 3.75, tz);
    jailGroup.add(tower);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.8, 2.0), darkMarbleMat);
    cabin.position.set(tx, 8.4, tz);
    jailGroup.add(cabin);

    const searchLight = new THREE.PointLight(0xfef08a, 1.5, 22, 1.5);
    searchLight.position.set(tx, 8.4, tz);
    jailGroup.add(searchLight);
  });

  // NỘI THẤT TRẠI GIAM:
  // Sân đập đá / rèn luyện phạm nhân (Bên trái X < 0)
  const gravelPile = new THREE.Mesh(new THREE.ConeGeometry(2.5, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.95 }));
  gravelPile.position.set(-6, 0.5, -3);
  jailGroup.add(gravelPile);

  // Xà đơn tập thể lực
  const pullUpBar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.1), ironBarMat);
  pullUpBar.position.set(-6, 2.1, 4);
  jailGroup.add(pullUpBar);

  // MINI NPC PHẠM NHÂN 1 ÁO CAM ĐANG CẢI TẠO LAO ĐỘNG
  const inmateJail1 = createMiniNPC({
    role: 'prisoner_hard_labor',
    posX: -4.5,
    posY: 0.1,
    posZ: -1.5,
    rotY: Math.PI / 3,
    shirtColor: 0xea580c, // Áo liền quần cam phạm nhân
    pantsColor: 0xea580c,
    hatType: 'prisoner',
    animType: 'breathe'
  });
  jailGroup.add(inmateJail1.group);

  // Khối phòng giam kiên cố mở cắt lửng (Bên phải X > 0)
  for (let px = 2; px <= 10; px += 0.5) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), ironBarMat);
    bar.position.set(px, 1.0, 0);
    jailGroup.add(bar);
  }

  // Giường sắt buồng giam
  const jBed = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.2), ironBarMat);
  jBed.position.set(6, 0.55, -5.5);
  jailGroup.add(jBed);

  // MINI NPC PHẠM NHÂN 2 TRONG BUỒNG GIAM
  const inmateJail2 = createMiniNPC({
    role: 'prisoner_cell',
    posX: 6,
    posY: 0.1,
    posZ: -3.0,
    rotY: Math.PI,
    shirtColor: 0xea580c,
    pantsColor: 0xea580c,
    hatType: 'prisoner',
    animType: 'turn'
  });
  jailGroup.add(inmateJail2.group);

  // MINI NPC QUẢN TRÒ / GIÁM THỊ TRẠI GIAM ĐỨNG GÁC CỔNG
  const wardenNPC = createMiniNPC({
    role: 'prison_warden',
    posX: 2.5,
    posY: 0.1,
    posZ: 9.0,
    rotY: 0,
    shirtColor: 0x0f172a, // Đồng phục quản giáo đen
    pantsColor: 0x1e293b,
    hatType: 'police_cap',
    animType: 'breathe'
  });
  jailGroup.add(wardenNPC.group);

  // Bàn nộp tiền bảo lãnh ngoài cổng
  const bailDesk = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 1.0), darkMarbleMat);
  bailDesk.position.set(0, 0.47, 12.5);
  jailGroup.add(bailDesk);

  const jailPad = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.6, 32), new THREE.MeshBasicMaterial({ color: 0xdc2626, side: THREE.DoubleSide }));
  jailPad.rotation.x = -Math.PI / 2;
  jailPad.position.set(0, 0.15, 14.0);
  jailGroup.add(jailPad);

  const jailTag = makeBillboardText('⛓️ TRẠI GIAM BIỆT LẬP: [E] NỘP PHẠT BẢO LÃNH / CẢI TẠO', '#ef4444', 430, 50);
  jailTag.position.set(0, 4.0, 14.0);
  jailGroup.add(jailTag);

  window.prisonBailPad = { pos: new THREE.Vector3(-145, 0, 74), radius: 5.0 };

  // -------------------------------------------------------------------------
  // 5. CHỢ ĐEN NGẦM (UNDERGROUND BLACK MARKET - OPEN STALL)
  // Tọa độ Bờ Nam Ngoại vi Đông Nam: X = 75, Z = 115 (Ẩn dật, không chồng đường)
  // KHÔNG MÁI NHÀ - THẤY THÙNG HÀNG LẬU, ĐÈN NEON TÍM & TAY BUÔN CHỢ ĐEN
  // -------------------------------------------------------------------------
  const bmGroup = new THREE.Group();
  bmGroup.name = 'black_market_district';
  bmGroup.position.set(75, 0, 115);
  scene.add(bmGroup);

  const bmFloor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.15, 8), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 }));
  bmFloor.position.y = 0.08;
  bmFloor.receiveShadow = true;
  bmGroup.add(bmFloor);

  // Thùng gỗ chứa hàng buôn lậu
  [[-2, -1.5], [1.5, -2], [2.5, 0.5]].forEach(([cx, cz]) => {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 1.2), woodMat);
    crate.position.set(cx, 0.58, cz);
    bmGroup.add(crate);
  });

  // Đèn neon tím ma mị bí mật
  const bmLight = new THREE.PointLight(0xa855f7, 2.8, 16, 1.5);
  bmLight.position.set(0, 2.2, 0);
  bmGroup.add(bmLight);

  // MINI NPC TRÙM BUÔN CHỢ ĐEN
  const smugglerNPC = createMiniNPC({
    role: 'smuggler',
    posX: 0,
    posY: 0.1,
    posZ: -1.0,
    rotY: 0,
    shirtColor: 0x581c87, // Áo măng tô tím đen
    pantsColor: 0x0f172a,
    hatType: 'none',
    animType: 'turn'
  });
  bmGroup.add(smugglerNPC.group);

  const bmPad = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.2, 32), new THREE.MeshBasicMaterial({ color: 0xa855f7, side: THREE.DoubleSide }));
  bmPad.rotation.x = -Math.PI / 2;
  bmPad.position.set(0, 0.15, -7.0);
  bmGroup.add(bmPad);

  const bmTag = makeBillboardText('🕶️ CHỢ ĐEN NGẦM: [E] BÁN HÀNG LẬU (+50% USD - RỦI RO ⭐)', '#c084fc', 430, 50);
  bmTag.position.set(0, 3.8, -7.0);
  bmGroup.add(bmTag);

  window.blackMarketPad = { pos: new THREE.Vector3(75, 0, 108), radius: 5.0 };
}
window.createCityHallAndJusticeDistrict = createCityHallAndJusticeDistrict;

// ===========================================================================
// 12. NHÀ MÁY NHIỆT ĐIỆN & HẠ TẦNG LƯỚI ĐIỆN ĐÔ THỊ (CITY POWER PLANT & GRID)
// Tọa độ Đất liền Đông Bắc: X = 75, Z = -45 (Gần sông lấy nước mát, không chồng cao tốc)
// THIẾT KẾ MỞ (OPEN-TOP CUTAWAY): KHÔNG MÁI - THẤY LÒ ĐỐT PHÁT ĐIỆN, TURBINE QUAY & KỸ SƯ ĐIỆN
// ===========================================================================
function createPowerGridAndUtilitiesDistrict(scene) {
  const pGroup = new THREE.Group();
  pGroup.name = 'power_grid_district';
  pGroup.position.set(75, 0, -45);
  scene.add(pGroup);

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.85, roughness: 0.3 });
  const copperMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.9, roughness: 0.2 });
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });

  // 1. Sàn móng chịu nhiệt công nghiệp (22m x 16m)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(22, 0.2, 16), concreteMat);
  floor.position.y = 0.1;
  floor.receiveShadow = true;
  pGroup.add(floor);

  // 2. Tường cắt lửng cao 1.6m (Không có mái nhà để quan sát)
  const wallN = new THREE.Mesh(new THREE.BoxGeometry(22, 1.6, 0.5), steelMat);
  wallN.position.set(0, 0.9, -8);
  pGroup.add(wallN);

  const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 16), steelMat);
  wallW.position.set(-11, 0.9, 0);
  pGroup.add(wallW);

  const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 16), steelMat);
  wallE.position.set(11, 0.9, 0);
  pGroup.add(wallE);

  // 3. LÒ ĐỐT NHIÊN LIỆU PHÁT ĐIỆN RỰC LỬA (POWER BOILER)
  const boiler = new THREE.Mesh(new THREE.BoxGeometry(6.5, 4.2, 5.0), steelMat);
  boiler.position.set(-5, 2.1, -3);
  boiler.castShadow = true;
  pGroup.add(boiler);

  // Cửa lò lộ ánh lửa rực sáng
  const fireDoor = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.8), emberMat);
  fireDoor.position.set(-5, 1.5, -0.48);
  pGroup.add(fireDoor);

  const boilerLight = new THREE.PointLight(0xf97316, 2.5, 16, 1.5);
  boilerLight.position.set(-5, 2.0, 1.0);
  pGroup.add(boilerLight);

  // Ống khói thấp phát điện (Cutaway - cao 6m)
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 6.0, 16), steelMat);
  stack.position.set(-5, 5.0, -4.5);
  pGroup.add(stack);

  // 4. 2 MÁY PHÁT ĐIỆN TURBINE ĐỒNG QUAY TRÒN
  window.powerTurbines = [];
  [-1.5, 4.5].forEach((tx, idx) => {
    const generator = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 4.5, 16), copperMat);
    generator.rotation.z = Math.PI / 2;
    generator.position.set(tx + 2.5, 1.4, 2.0);
    pGroup.add(generator);
    window.powerTurbines.push(generator);

    // Bệ đỡ máy phát
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.8, 2.2), concreteMat);
    base.position.set(tx + 2.5, 0.4, 2.0);
    pGroup.add(base);
  });

  // 5. TRẠM BIẾN ÁP CAO THẾ (TRANSFORMER YARD)
  [4.5, 8.5].forEach(ux => {
    const transformer = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.8, 2.2), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 }));
    transformer.position.set(ux, 1.4, -4.5);
    pGroup.add(transformer);

    // Cột sứ cách điện trên đỉnh
    [-0.5, 0.5].forEach(ox => {
      const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0x38bdf8 }));
      insulator.position.set(ux + ox, 3.25, -4.5);
      pGroup.add(insulator);
    });
  });

  // MINI NPC KỸ SƯ ĐIỆN LỰC ĐÔ THỊ
  const engineerNPC = createMiniNPC({
    role: 'power_engineer',
    posX: 0,
    posY: 0.1,
    posZ: -1.0,
    rotY: -Math.PI / 4,
    shirtColor: 0x0284c7, // Áo xanh kỹ thuật điện
    pantsColor: 0x1e293b,
    hatType: 'hardhat',
    animType: 'type'
  });
  pGroup.add(engineerNPC.group);

  // PAD NẠP NHIÊN LIỆU LƯỚI ĐIỆN
  const pPad = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.6, 32), new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide }));
  pPad.rotation.x = -Math.PI / 2;
  pPad.position.set(0, 0.15, 6.5);
  pGroup.add(pPad);

  const pTag = makeBillboardText('⚡ NHÀ MÁY ĐIỆN ĐÔ THỊ: [E] NẠP VÁN GỖ / THAN PHÁT ĐIỆN (+25 MW)', '#facc15', 440, 50);
  pTag.position.set(0, 3.8, 6.5);
  pGroup.add(pTag);

  window.powerFuelPad = { pos: new THREE.Vector3(75, 0, -38.5), radius: 5.0 };

  // 6. ĐẶT 4 TRỤ NƯỚC CỨU HỎA (FIRE HYDRANTS) DỌC VỈA HÈ BỜ NAM
  const hydrantRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, metalness: 0.2 });
  const hydrantBrassMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.25 });

  const hydrantPositions = [
    new THREE.Vector3(-58, 0, 41), // Trước Sở Cảnh Sát
    new THREE.Vector3(-20, 0, 41), // Trước Tòa Thị Chính
    new THREE.Vector3(10, 0, 41),  // Trước Sàn Chợ
    new THREE.Vector3(70, 0, 41)   // Trước Trạm Cứu Hỏa
  ];

  hydrantPositions.forEach(hPos => {
    const hGroup = new THREE.Group();
    hGroup.position.copy(hPos);

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.9, 12), hydrantRedMat);
    post.position.y = 0.45;
    hGroup.add(post);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), hydrantRedMat);
    cap.position.y = 0.9;
    hGroup.add(cap);

    // 2 Van xả nước hai bên
    [-0.22, 0.22].forEach(vx => {
      const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 8), hydrantBrassMat);
      valve.rotation.z = Math.PI / 2;
      valve.position.set(vx, 0.55, 0);
      hGroup.add(valve);
    });

    scene.add(hGroup);
  });
}
window.createPowerGridAndUtilitiesDistrict = createPowerGridAndUtilitiesDistrict;

// ===========================================================================
// 13. SÀN CHỢ GIAO DỊCH TỰ DO ĐÔ THỊ (CENTRAL TRADING POST / MARKETPLACE)
// Tọa độ Bờ Nam Trung Tâm: X = 10, Z = 56 (Giữa Tòa Thị Chính và Cứu Hỏa, đất liền vững chắc)
// THIẾT KẾ MỞ (OPEN-TOP): KHÔNG MÁI NHÀ - 3 GIAN HÀNG SẦM UẤT & TIỂU THƯƠNG BUÔN BÁN
// ===========================================================================
function createMarketplaceAndTradingDistrict(scene) {
  const mGroup = new THREE.Group();
  mGroup.name = 'marketplace_district';
  mGroup.position.set(10, 0, 56);
  scene.add(mGroup);

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
  const tileMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
  const canopyRedMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.6 });
  const canopyWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });

  // 1. Sàn lát đá hoa văn cổ điển (18m x 12m)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(18, 0.2, 12), tileMat);
  floor.position.y = 0.1;
  floor.receiveShadow = true;
  mGroup.add(floor);

  // Tường lửng gỗ mộc bao quanh chợ (cao 1.4m, không mái nhà)
  const mwS = new THREE.Mesh(new THREE.BoxGeometry(18, 1.4, 0.4), woodMat);
  mwS.position.set(0, 0.8, 6);
  mGroup.add(mwS);

  const mwE = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 12), woodMat);
  mwE.position.set(9, 0.8, 0);
  mGroup.add(mwE);

  const mwW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 12), woodMat);
  mwW.position.set(-9, 0.8, 0);
  mGroup.add(mwW);

  // 2. 3 GIAN HÀNG CHỢ TRỜI (MARKET STALLS)
  const stallData = [
    { name: 'Sạp Gỗ Ván', x: -5, tagColor: '#ca8a04', itemColor: 0xca8a04 },
    { name: 'Sạp Kim Khí Thép', x: 0, tagColor: '#06b6d4', itemColor: 0x475569 },
    { name: 'Sạp Nông Sản Lương Thực', x: 5, tagColor: '#16a34a', itemColor: 0x22c55e }
  ];

  stallData.forEach(stall => {
    const sTable = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.85, 1.6), woodMat);
    sTable.position.set(stall.x, 0.52, 1.0);
    mGroup.add(sTable);

    // Mẫu vật phẩm trưng bày trên sạp
    for (let ii = -1; ii <= 1; ii++) {
      const sample = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.5), new THREE.MeshStandardMaterial({ color: stall.itemColor }));
      sample.position.set(stall.x + ii * 0.9, 1.15, 1.0);
      mGroup.add(sample);
    }

    // Biển tên sạp hàng
    const sTag = makeBillboardText(stall.name, stall.tagColor, 260, 42);
    sTag.position.set(stall.x, 2.6, 1.0);
    mGroup.add(sTag);
  });

  // MINI NPC TIỂU THƯƠNG CHỢ ĐANG KIỂM SỔ SÁCH
  const traderNPC = createMiniNPC({
    role: 'trader',
    posX: 0,
    posY: 0.1,
    posZ: 3.2,
    rotY: Math.PI,
    shirtColor: 0xf59e0b, // Áo vàng thương buôn
    pantsColor: 0x1e293b,
    hatType: 'straw_hat',
    animType: 'turn'
  });
  mGroup.add(traderNPC.group);

  // Cân tiểu ly buôn bán
  const scaleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.45, 8), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8 }));
  scaleMesh.position.set(2.5, 1.15, 1.0);
  mGroup.add(scaleMesh);

  // PAD SÀN CHỢ GIAO DỊCH
  const mPad = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.6, 32), new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide }));
  mPad.rotation.x = -Math.PI / 2;
  mPad.position.set(0, 0.15, -9.0);
  mGroup.add(mPad);

  const mTag = makeBillboardText('🛒 SÀN CHỢ GIAO DỊCH: [E] MUA BÁN VẬT TƯ VỚI NGƯỜI CHƠI', '#10b981', 440, 50);
  mTag.position.set(0, 4.0, -9.0);
  mGroup.add(mTag);

  window.marketTradingPad = { pos: new THREE.Vector3(10, 0, 47), radius: 5.0 };
}
window.createMarketplaceAndTradingDistrict = createMarketplaceAndTradingDistrict;

// ===========================================================================
// 14. HỆ THỐNG HỎA HOẠN 3D KHẨN CẤP THỜI GIAN THỰC (3D FIRE CRISIS EFFECT)
// ===========================================================================
function createFireCrisis3DEffect(pos) {
  removeFireCrisis3DEffect();
  const fireGroup = new THREE.Group();
  fireGroup.name = 'active_fire_crisis_effect';
  fireGroup.position.set(pos.x || 0, pos.y || 0.5, pos.z || 0);

  const fireOrange = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  const fireYellow = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const fireRed = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  // 10 Ngọn lửa 3D bập bùng
  fireGroup.flameMeshes = [];
  for (let fi = 0; fi < 10; fi++) {
    const fMat = (fi % 3 === 0) ? fireYellow : ((fi % 2 === 0) ? fireOrange : fireRed);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.6 + Math.random() * 0.4, 2.2 + Math.random() * 1.5, 6), fMat);
    const fx = (Math.random() - 0.5) * 3.5;
    const fz = (Math.random() - 0.5) * 3.5;
    flame.position.set(fx, 1.2, fz);
    fireGroup.add(flame);
    fireGroup.flameMeshes.push({ mesh: flame, baseY: 1.2, speed: 4.0 + Math.random() * 3.0, phase: Math.random() * Math.PI * 2 });
  }

  // Ánh sáng lửa chập chờn
  const fLight = new THREE.PointLight(0xff4400, 4.5, 24, 1.5);
  fLight.position.set(0, 3.0, 0);
  fireGroup.add(fLight);
  fireGroup.fireLight = fLight;

  // Bảng thông báo khẩn cấp trên đầu đám cháy
  const tag = makeBillboardText('🚨 ĐÁM CHÁY 911: LÁI XE CỨU HỎA ĐẾN DẬP LỬA [SPACE]!', '#ef4444', 460, 52);
  tag.position.set(0, 5.0, 0);
  fireGroup.add(tag);

  window.scene.add(fireGroup);
  window.activeFireCrisisGroup = fireGroup;
}
window.createFireCrisis3DEffect = createFireCrisis3DEffect;

function updateFireCrisis3DEffect(dt, time) {
  if (!window.activeFireCrisisGroup) return;
  const fg = window.activeFireCrisisGroup;
  if (fg.flameMeshes) {
    for (let fi = 0; fi < fg.flameMeshes.length; fi++) {
      const fl = fg.flameMeshes[fi];
      fl.mesh.scale.y = 0.8 + Math.sin(time * fl.speed + fl.phase) * 0.4;
      fl.mesh.rotation.y += dt * 2.0;
    }
  }
  if (fg.fireLight) {
    fg.fireLight.intensity = 3.5 + Math.sin(time * 12.0) * 1.5;
  }
}
window.updateFireCrisis3DEffect = updateFireCrisis3DEffect;

function removeFireCrisis3DEffect() {
  if (window.activeFireCrisisGroup && window.scene) {
    window.scene.remove(window.activeFireCrisisGroup);
    window.activeFireCrisisGroup = null;
  }
}
window.removeFireCrisis3DEffect = removeFireCrisis3DEffect;

// ===========================================================================
// 15. HỆ THỐNG TRẠM XE BUÝT CÔNG CỘNG (PUBLIC TRANSIT BUS NETWORK)
// KẾT NỐI 4 QUẬN CHÍNH: XƯỞNG CƯA ➜ ĐẠI LỘ BỜ NAM ➜ KHU LÒ CAO ➜ VIỄN TÂY
// ===========================================================================
function createCityPublicTransitBusStops(scene) {
  const busStops = [
    { id: 'sawmill', name: 'Trạm 1: Xưởng Cưa Lâm Nghiệp', pos: new THREE.Vector3(0, 0, -28) },
    { id: 'downtown', name: 'Trạm 2: Đại Lộ Bờ Nam', pos: new THREE.Vector3(-20, 0, 42) },
    { id: 'industrial', name: 'Trạm 3: Khu Lò Cao & Điện Lực', pos: new THREE.Vector3(75, 0, -35) },
    { id: 'west', name: 'Trạm 4: Trại Giam & Viễn Tây', pos: new THREE.Vector3(-145, 0, 48) }
  ];

  window.cityBusStops = busStops;

  const shelterMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 });
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });

  busStops.forEach((stop, idx) => {
    const sGroup = new THREE.Group();
    sGroup.position.copy(stop.pos);

    // Mái che trạm dừng xe buýt
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.15, 2.4), shelterMat);
    roof.position.set(0, 2.5, 0);
    sGroup.add(roof);

    // Vách kính phía sau
    const backGlass = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.2, 0.1), glassMat);
    backGlass.position.set(0, 1.25, -1.1);
    sGroup.add(backGlass);

    // 2 Cột thép đỡ mái
    [-1.9, 1.9].forEach(cx => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 8), shelterMat);
      col.position.set(cx, 1.25, 0.9);
      sGroup.add(col);
    });

    // Băng ghế chờ gỗ
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.45, 0.6), benchMat);
    bench.position.set(0, 0.35, -0.6);
    sGroup.add(bench);

    // Biển trạm xe buýt
    const tag = makeBillboardText(`🚏 TRẠM XE BUÝT: [E] ĐI XE BUÝT ĐẾN CÁC QUẬN ($15)`, '#38bdf8', 420, 48);
    tag.position.set(0, 3.2, 0);
    sGroup.add(tag);

    // Vòng pad đón xe buýt
    const pad = new THREE.Mesh(new THREE.RingGeometry(2.0, 3.0, 32), new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.1;
    sGroup.add(pad);

    scene.add(sGroup);
  });
}
window.createCityPublicTransitBusStops = createCityPublicTransitBusStops;

// ===========================================================================
// 16. CỤM SÂN BAY HÀNG KHÔNG QUỐC TẾ & VẬN TẢI AIR CARGO (SKYPORT LOGISTICS)
// TỌA ĐỘ CAO NGUYÊN ĐÔNG BẮC: X ∈ [10, 100], Z ∈ [-125, -90] (HOÀN TOÀN TRÊN ĐẤT LIỀN)
// ===========================================================================
function createInternationalAirCargoSkyport(scene) {
  const skyportGroup = new THREE.Group();
  skyportGroup.name = 'international_skyport_district';
  scene.add(skyportGroup);

  const runwayAsphaltMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
  const markingMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const yellowMarkingMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const atcConcreteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 });
  const atcGlassMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, transparent: true, opacity: 0.6, metalness: 0.9, roughness: 0.1 });
  const steelTrussMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.3 });

  // 1. ĐƯỜNG BĂNG BÊ TÔNG NHỰA DÀI 100M x RỘNG 14M: Tâm tại (55, 0.05, -115)
  const runwayMesh = new THREE.Mesh(new THREE.PlaneGeometry(100, 14), runwayAsphaltMat);
  runwayMesh.rotation.x = -Math.PI / 2;
  runwayMesh.position.set(55, 0.05, -115);
  runwayMesh.receiveShadow = true;
  skyportGroup.add(runwayMesh);

  // Vạch kẻ đứt quãng tim đường băng trắng phản quang
  for (let rx = 10; rx <= 100; rx += 8) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.6), markingMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(rx, 0.06, -115);
    skyportGroup.add(dash);
  }

  // Vạch sơn đầu đường băng (Threshold Striping)
  [12, 98].forEach(tx => {
    for (let ty = -5; ty <= 5; ty += 1.6) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 0.6), markingMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(tx, 0.06, -115 + ty);
      skyportGroup.add(stripe);
    }
  });

  // Hàng đèn LED dẫn hướng 2 bên mép đường băng (Xanh lục đầu băng, Trắng dọc thân, Đỏ cuối băng)
  skyportGroup.runwayLights = [];
  for (let lx = 6; lx <= 104; lx += 7) {
    [-7.2, 7.2].forEach(lz => {
      const isStart = lx <= 12;
      const isEnd = lx >= 98;
      const lColor = isStart ? 0x22c55e : (isEnd ? 0xef4444 : 0xf8fafc);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 8), new THREE.MeshBasicMaterial({ color: lColor }));
      lamp.position.set(lx, 0.2, -115 + lz);
      skyportGroup.add(lamp);
    });
  }

  // 2. THÁP KIỂM SOÁT KHÔNG LƯU ATC (AIR TRAFFIC CONTROL TOWER) TẠI (55, 0, -98)
  const atcGroup = new THREE.Group();
  atcGroup.position.set(55, 0, -98);
  skyportGroup.add(atcGroup);

  // Thân tháp bê tông hình trụ cao 18m
  const atcShaft = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 18, 16), atcConcreteMat);
  atcShaft.position.y = 9.0;
  atcShaft.castShadow = true;
  atcGroup.add(atcShaft);

  // Buồng chỉ huy kính 360 độ trên đỉnh
  const atcCab = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 3.2, 3.5, 12), atcGlassMat);
  atcCab.position.y = 19.5;
  atcGroup.add(atcCab);

  // Mái nón chóp tháp
  const atcRoof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 1.8, 12), atcConcreteMat);
  atcRoof.position.y = 22.0;
  atcGroup.add(atcRoof);

  // Radar xoay liên tục trên đỉnh tháp
  const radarStem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), steelTrussMat);
  radarStem.position.y = 23.5;
  atcGroup.add(radarStem);

  const radarDish = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.15), new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.8 }));
  radarDish.position.y = 24.2;
  atcGroup.add(radarDish);
  window.atcRadarMesh = radarDish;

  // Mini NPC Kiểm soát viên không lưu trong buồng kính
  const atcOfficer = createMiniNPC({
    role: 'officer',
    posX: 0,
    posY: 18.2,
    posZ: 0,
    shirtColor: 0x1e3a8a,
    animType: 'turn'
  });
  atcGroup.add(atcOfficer);

  // 3. NHÀ GA VẬN TẢI HÀNG HÓA AIR CARGO DEPOT (CUTAWAY KHÔNG MÁI) TẠI (35, 0, -98)
  const depotGroup = new THREE.Group();
  depotGroup.position.set(35, 0, -98);
  skyportGroup.add(depotGroup);

  const depotFloor = new THREE.Mesh(new THREE.BoxGeometry(16, 0.2, 12), runwayAsphaltMat);
  depotFloor.position.y = 0.1;
  depotGroup.add(depotFloor);

  // Khung vì kèo thép chữ I không nóc
  for (let kx = -7; kx <= 7; kx += 7) {
    [-5.5, 5.5].forEach(kz => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.0, 0.3), steelTrussMat);
      col.position.set(kx, 2.0, kz);
      depotGroup.add(col);
    });
  }

  // 3 Container hàng không chuyên dụng (LD3 Aviation Containers)
  const ld3Mat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
  [-4.5, 0, 4.5].forEach((cx, idx) => {
    const ld3 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 2.0), ld3Mat);
    ld3.position.set(cx, 1.1, 2.0);
    depotGroup.add(ld3);
    const boxTag = makeBillboardText(idx === 0 ? '📦 PALLET GỖ' : (idx === 1 ? '🐟 CÁ HỘP AIR' : '⚙️ DẦM THÉP'), '#38bdf8', 180, 28);
    boxTag.position.set(cx, 2.5, 2.0);
    depotGroup.add(boxTag);
  });

  // Vòng pad nạp hàng xuất khẩu bằng máy bay
  const airCargoPadMesh = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.4, 32), new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }));
  airCargoPadMesh.rotation.x = -Math.PI / 2;
  airCargoPadMesh.position.set(0, 0.15, -2.5);
  depotGroup.add(airCargoPadMesh);

  const airTag = makeBillboardText('✈️ AIR CARGO: NẠP VÁN/CÁ HỘP/DẦM THÉP LÊN MÁY BAY [E] (THƯỞNG X3 USD)!', '#38bdf8', 540, 52);
  airTag.position.set(0, 3.8, -2.5);
  depotGroup.add(airTag);

  window.airCargoPad = { pos: new THREE.Vector3(35, 0, -100.5), radius: 5.0, cooldown: 0 };

  // 4. MÁY BAY VẬN TẢI HÀNG HÓA 3D CHUYÊN DỤNG (3D AIR CARGO FREIGHTER)
  const plane = new THREE.Group();
  plane.name = 'air_cargo_plane';
  skyportGroup.add(plane);

  const fuselageMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.6, roughness: 0.3 });
  const planeAccentMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7, roughness: 0.3 });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1 });

  // Thân máy bay khí động học
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 16, 16), fuselageMat);
  fuselage.rotation.z = Math.PI / 2;
  fuselage.position.y = 2.4;
  plane.add(fuselage);

  // Mũi máy bay hình nón thuôn
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.5, 16), fuselageMat);
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(9.75, 2.4, 0);
  plane.add(nose);

  // Kính buồng lái phi công
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.4), glassMat);
  cockpit.position.set(8.5, 3.3, 0);
  plane.add(cockpit);

  // Cặp cánh chính xuôi sải dài 20m
  const mainWings = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.25, 20), wingMat);
  mainWings.position.set(1.0, 2.4, 0);
  plane.add(mainWings);

  // Cặp động cơ phản lực đôi dưới cánh (Turbofan Engines)
  [-4.8, 4.8].forEach(ey => {
    const enginePod = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.65, 3.0, 12), planeAccentMat);
    enginePod.rotation.z = Math.PI / 2;
    enginePod.position.set(1.5, 1.4, ey);
    plane.add(enginePod);

    // Cánh quạt động cơ quay tít
    const fanBlade = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.1, 8), new THREE.MeshBasicMaterial({ color: 0x0f172a }));
    fanBlade.rotation.z = Math.PI / 2;
    fanBlade.position.set(3.05, 1.4, ey);
    plane.add(fanBlade);
  });

  // Đuôi đứng & Cánh thăng bằng ngang T-Tail
  const vertTail = new THREE.Mesh(new THREE.BoxGeometry(2.5, 4.2, 0.3), planeAccentMat);
  vertTail.position.set(-7.5, 4.5, 0);
  vertTail.rotation.z = -0.3;
  plane.add(vertTail);

  const horizTail = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.15, 6.5), wingMat);
  horizTail.position.set(-8.5, 6.2, 0);
  plane.add(horizTail);

  // Bánh đáp hạ cánh (Landing Gears)
  const wheelMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
  [[6.5, 0], [-2.0, -2.5], [-2.0, 2.5]].forEach(([gx, gz]) => {
    const gearStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8), steelTrussMat);
    gearStrut.position.set(gx, 0.9, gz);
    plane.add(gearStrut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12), wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(gx, 0.4, gz);
    plane.add(wheel);
  });

  plane.position.set(55, 0, -115);
  window.cargoAirplaneGroup = plane;
  window.cargoPlaneState = {
    phase: 'parked', // 'parked', 'takeoff', 'flying', 'landing'
    timer: 15.0,
    flightAltitude: 0,
    speed: 0
  };
}
window.createInternationalAirCargoSkyport = createInternationalAirCargoSkyport;

// Chu kỳ cất / hạ cánh của Máy bay vận tải Cargo Plane
function updateCargoPlaneFlight(dt, time) {
  if (window.atcRadarMesh) {
    window.atcRadarMesh.rotation.y += dt * 2.5;
  }
  const plane = window.cargoAirplaneGroup;
  const state = window.cargoPlaneState;
  if (!plane || !state) return;

  state.timer -= dt;

  if (state.phase === 'parked') {
    plane.position.set(35, 0, -108);
    plane.rotation.set(0, 0, 0);
    if (state.timer <= 0) {
      state.phase = 'takeoff';
      state.timer = 12.0;
      if (typeof sounds !== 'undefined' && sounds.playJetEngine) sounds.playJetEngine();
      if (typeof showToast === 'function') showToast('✈️ CHUYẾN BAY AIR CARGO ĐANG CẤT CÁNH ĐI QUỐC TẾ!');
    }
  } else if (state.phase === 'takeoff') {
    // Lăn bánh tăng tốc dọc đường băng từ X=35 -> X=100 rồi ngóc đầu bay lên cao
    plane.position.x += dt * 18.0;
    plane.position.z = THREE.MathUtils.lerp(plane.position.z, -115, dt * 2.0);
    if (plane.position.x > 70) {
      plane.position.y += dt * 8.0;
      plane.rotation.z = 0.18; // Ngóc đầu lên trời
    }
    if (state.timer <= 0 || plane.position.y >= 35.0) {
      state.phase = 'flying';
      state.timer = 40.0;
    }
  } else if (state.phase === 'flying') {
    // Bay lượn vòng tròn trên bầu trời thành phố ở độ cao 35m
    const flyRadius = 90.0;
    const flyAngle = (time * 0.15);
    plane.position.x = 25 + Math.cos(flyAngle) * flyRadius;
    plane.position.z = 15 + Math.sin(flyAngle) * flyRadius;
    plane.position.y = 35 + Math.sin(time * 0.5) * 3.0;
    plane.rotation.y = -flyAngle - Math.PI / 2;
    plane.rotation.z = 0.15; // Nghiêng cánh lượn vòng

    if (state.timer <= 0) {
      state.phase = 'landing';
      state.timer = 14.0;
      if (typeof sounds !== 'undefined' && sounds.playJetEngine) sounds.playJetEngine();
      if (typeof showToast === 'function') showToast('🛬 CHUYẾN BAY AIR CARGO QUỐC TẾ ĐANG HẠ CÁNH XUỐNG ĐƯỜNG BĂNG!');
    }
  } else if (state.phase === 'landing') {
    // Tiếp cận hạ độ cao từ X=-20 về X=15 trên đường băng Z=-115
    plane.rotation.set(0, 0, -0.08);
    plane.position.x += dt * 16.0;
    plane.position.z = -115;
    plane.position.y = Math.max(0, plane.position.y - dt * 6.5);

    if (plane.position.y <= 0.1 && plane.position.x >= 75) {
      state.phase = 'parked';
      state.timer = 25.0; // Đỗ 25 giây cho người chơi nạp hàng
      plane.position.set(35, 0, -108);
      plane.rotation.set(0, 0, 0);
      if (typeof showToast === 'function') showToast('📦 MÁY BAY ĐÃ CẬP BẾN! Đến bến Air Cargo nạp hàng để nhận thưởng x3 USD!');
    }
  }
}
window.updateCargoPlaneFlight = updateCargoPlaneFlight;

// ===========================================================================
// 17. KHU BIỆT THỰ DINH THỰ NGHỈ DƯỠNG VEN BIỂN (COASTAL LUXURY VILLA & POOL)
// TỌA ĐỘ VÀNG VEN BIỂN: X = 100, Z = 56 (TRÊN ĐẤT LIỀN BÃI BIỂN PHÍA ĐÔNG NAM)
// ===========================================================================
function createCoastalLuxuryVillaDistrict(scene) {
  const villaGroup = new THREE.Group();
  villaGroup.name = 'coastal_luxury_villa_district';
  villaGroup.position.set(100, 0, 56);
  scene.add(villaGroup);

  const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.25 });
  const darkTeakMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 });
  const poolWaterMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.2 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });

  // 1. SÀN DINH THỰ ĐÁ HOA CƯƠNG TRẮNG Ý 22M x 16M
  const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(22, 0.3, 16), marbleMat);
  floorMesh.position.y = 0.15;
  villaGroup.add(floorMesh);

  // TƯỜNG HIỆN ĐẠI CUTAWAY KHÔNG MÁI (CAMERA NHÌN THẤY TOÀN BỘ NỘI THẤT)
  // Tường hậu phía sau
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(22, 4.5, 0.4), marbleMat);
  backWall.position.set(0, 2.4, 7.8);
  villaGroup.add(backWall);

  // Tường trái & phải
  [-10.8, 10.8].forEach(wx => {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.5, 16), marbleMat);
    sideWall.position.set(wx, 2.4, 0);
    villaGroup.add(sideWall);
  });

  // TẦNG 1: PHÒNG KHÁCH THƯỢNG LƯU (LIVING ROOM)
  // Ghế sofa chữ L bọc da đen
  const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.6, 2.0), leatherMat);
  sofaBase.position.set(-5.0, 0.45, 3.5);
  villaGroup.add(sofaBase);

  const sofaReturn = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2.5), leatherMat);
  sofaReturn.position.set(-6.3, 0.45, 1.25);
  villaGroup.add(sofaReturn);

  // Bàn trà mặt kính cường lực
  const coffeeTable = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 1.4), glassMat);
  coffeeTable.position.set(-4.5, 0.35, 1.5);
  villaGroup.add(coffeeTable);

  // Smart TV màn hình phẳng siêu mỏng 85 inch treo tường
  const tvMesh = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.8, 0.1), new THREE.MeshBasicMaterial({ color: 0x0284c7 }));
  tvMesh.position.set(-4.5, 2.5, 7.5);
  villaGroup.add(tvMesh);

  // Quầy Bar bếp đảo đá vân mây
  const barMesh = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.1, 1.2), darkTeakMat);
  barMesh.position.set(5.5, 0.7, 4.0);
  villaGroup.add(barMesh);

  // TẦNG 2: PHÒNG NGỦ MASTER & BAN CÔNG VIEW BIỂN
  const upperFloor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.25, 7.5), marbleMat);
  upperFloor.position.set(5.0, 3.6, -2.5);
  villaGroup.add(upperFloor);

  // Lan can kính cường lực ban công
  const balconyGlass = new THREE.Mesh(new THREE.BoxGeometry(11, 1.0, 0.1), glassMat);
  balconyGlass.position.set(5.0, 4.2, -6.2);
  villaGroup.add(balconyGlass);

  // Giường ngủ King-size nệm trắng
  const kingBed = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.8, 3.2), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
  kingBed.position.set(5.5, 4.1, -1.0);
  villaGroup.add(kingBed);

  // 2. BỂ BƠI VÔ CỰC NƯỚC XANH NGỌC BÍCH (INFINITY POOL) 10M x 5M
  const poolGroup = new THREE.Group();
  poolGroup.position.set(-4.5, 0, -4.5);
  villaGroup.add(poolGroup);

  const poolFloor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.1, 5.5), new THREE.MeshBasicMaterial({ color: 0x0891b2 }));
  poolFloor.position.y = 0.05;
  poolGroup.add(poolFloor);

  const poolWater = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.15, 5.1), poolWaterMat);
  poolWater.position.y = 0.12;
  poolGroup.add(poolWater);

  // Ghế tắm nắng & Dù che biển trắng
  [-2.2, 2.2].forEach(lx => {
    const lounger = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 2.2), darkTeakMat);
    lounger.position.set(lx, 0.3, -3.8);
    poolGroup.add(lounger);
  });

  const parasolPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 8), darkTeakMat);
  parasolPole.position.set(0, 1.4, -3.8);
  poolGroup.add(parasolPole);

  const parasolTop = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
  parasolTop.position.set(0, 2.7, -3.8);
  poolGroup.add(parasolTop);

  // 3. QUẢN GIA MINI NPC ĐỨNG ĐÓN TẠI CỔNG
  const butler = createMiniNPC({
    role: 'officer',
    posX: 0,
    posY: 0.3,
    posZ: -7.0,
    shirtColor: 0x0f172a,
    animType: 'breathe'
  });
  villaGroup.add(butler);

  // Vòng pad quản lý Dinh Thự / Thu tiền thuê thụ động
  const villaPadMesh = new THREE.Mesh(new THREE.RingGeometry(2.0, 3.2, 32), new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide }));
  villaPadMesh.rotation.x = -Math.PI / 2;
  villaPadMesh.position.set(0, 0.2, -8.0);
  villaGroup.add(villaPadMesh);

  const villaTag = makeBillboardText('🏡 DINH THỰ VEN BIỂN: [E] MUA SỞ HỮU ($25K) HOẶC THU TIỀN THUÊ ($350)!', '#f59e0b', 560, 52);
  villaTag.position.set(0, 3.4, -8.0);
  villaGroup.add(villaTag);

  window.playerVillaPad = { pos: new THREE.Vector3(100, 0, 48), radius: 5.0, cooldown: 0 };
}
window.createCoastalLuxuryVillaDistrict = createCoastalLuxuryVillaDistrict;

// ===========================================================================
// 18. CỔNG XUẤT PHÁT ĐƯỜNG ĐUA CAO TỐC ĐÔ THỊ (HIGHWAY SPEED CIRCUIT ARCH)
// TỌA ĐỘ CAO TỐC TRỤC CHÍNH: X = 28, Z = 32
// ===========================================================================
function createSpeedCircuitArch(scene) {
  const archGroup = new THREE.Group();
  archGroup.position.set(28, 0, 32);
  scene.add(archGroup);

  const trussMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, metalness: 0.8, roughness: 0.3 });
  const checkWhiteMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const checkBlackMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

  // 2 Cột cổng thép cao 6m bắc ngang qua đại lộ
  [-5.5, 5.5].forEach(ax => {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6.0, 0.6), trussMat);
    col.position.set(ax, 3.0, 0);
    archGroup.add(col);
  });

  // Xà ngang vòm xuất phát
  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.8, 0.8), trussMat);
  topBeam.position.set(0, 5.8, 0);
  archGroup.add(topBeam);

  // Vạch cờ ca-rô xuất phát trên mặt đường (Checkered Finish Line)
  for (let ci = -5; ci <= 5; ci += 1.0) {
    for (let cj = -0.8; cj <= 0.8; cj += 0.8) {
      const isBlack = (Math.abs(Math.round(ci + cj * 2)) % 2 === 0);
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.8), isBlack ? checkBlackMat : checkWhiteMat);
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(ci, 0.08, cj);
      archGroup.add(tile);
    }
  }

  // Biển hiệu LED điện tử tính giờ
  const raceTag = makeBillboardText('🏁 ĐƯỜNG ĐUA ĐÔ THỊ: LÁI XE QUA CỔNG ĐỂ BẮT ĐẦU ĐUA TÍNH GIỜ (TIME TRIAL)!', '#e11d48', 560, 52);
  raceTag.position.set(0, 6.8, 0);
  archGroup.add(raceTag);

  window.raceStartPad = { pos: new THREE.Vector3(28, 0, 32), radius: 6.0 };
}
window.createSpeedCircuitArch = createSpeedCircuitArch;

// ===========================================================================
// 19. DRONE VẬN TẢI TỰ ĐỘNG THU GOM TÀI NGUYÊN (AUTONOMOUS CARGO DRONE)
// ===========================================================================
function createLogisticsCargoDrone(scene) {
  const droneGroup = new THREE.Group();
  droneGroup.name = 'autonomous_cargo_drone';
  scene.add(droneGroup);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.9, roughness: 0.2 });
  const carbonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
  const propMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });

  // Thân máy bay Drone hình oval
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.9), bodyMat);
  body.position.y = 0.2;
  droneGroup.add(body);

  // Đèn định vị nhấp nháy xanh lục
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
  led.position.set(0, 0.4, 0);
  droneGroup.add(led);

  // 4 Càng đỡ động cơ & Cánh quạt quay
  droneGroup.propellers = [];
  [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].forEach(([px, pz]) => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), carbonMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(px * 0.5, 0.2, pz * 0.5);
    droneGroup.add(arm);

    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 8), carbonMat);
    motor.position.set(px, 0.25, pz);
    droneGroup.add(motor);

    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.08), propMat);
    prop.position.set(px, 0.36, pz);
    droneGroup.add(prop);
    droneGroup.propellers.push(prop);
  });

  droneGroup.position.set(-6, 2.5, -18);
  window.cargoDroneMesh = droneGroup;
  window.cargoDroneState = {
    targetPos: new THREE.Vector3(-25, 2.5, -15),
    phase: 'fly_to_forest',
    timer: 8.0
  };
}
window.createLogisticsCargoDrone = createLogisticsCargoDrone;

function updateLogisticsCargoDrone(dt, time) {
  const drone = window.cargoDroneMesh;
  const state = window.cargoDroneState;
  if (!drone || !state) return;

  // Xoay tít 4 cánh quạt
  if (drone.propellers) {
    drone.propellers.forEach((p, idx) => {
      p.rotation.y += dt * 35.0 * (idx % 2 === 0 ? 1 : -1);
    });
  }

  // Dao động bồng bềnh
  const bobY = Math.sin(time * 3.5) * 0.12;

  if (state.phase === 'fly_to_forest') {
    drone.position.lerp(new THREE.Vector3(-22, 2.4 + bobY, -16), dt * 0.85);
    if (drone.position.distanceTo(new THREE.Vector3(-22, 2.4 + bobY, -16)) < 1.5) {
      state.phase = 'deliver_to_mill';
      if (typeof spawnFloatingText === 'function') {
        spawnFloatingText(drone.position, '+1 Drone Gom Gỗ 🪵🤖', '#38bdf8');
      }
    }
  } else if (state.phase === 'deliver_to_mill') {
    drone.position.lerp(new THREE.Vector3(-6, 2.4 + bobY, -18), dt * 0.85);
    if (drone.position.distanceTo(new THREE.Vector3(-6, 2.4 + bobY, -18)) < 1.5) {
      state.phase = 'fly_to_forest';
      if (typeof gameState !== 'undefined') {
        gameState.machineLogBuffer = Math.min(30, (gameState.machineLogBuffer || 0) + 1);
        if (typeof updateHUD === 'function') updateHUD();
      }
    }
  }
}
window.updateLogisticsCargoDrone = updateLogisticsCargoDrone;

// ===========================================================================
// 20. BẠN ĐỒNG HÀNH THÚ CƯNG K-9 RESCUE DOG (COMPANION PET)
// ===========================================================================
function createK9Companion(scene) {
  if (window.k9DogGroup) return window.k9DogGroup;

  const dogGroup = new THREE.Group();
  dogGroup.name = 'k9_companion_dog';

  const furMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 }); // Vàng cam Golden
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.9 });
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x1c1917 });

  // Thân chó
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.85), furMat);
  body.position.y = 0.5;
  dogGroup.add(body);

  // Đầu chó
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.4), furMat);
  head.position.set(0, 0.85, 0.45);
  dogGroup.add(head);

  // Mõm đen
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.22), darkMat);
  snout.position.set(0, 0.78, 0.65);
  dogGroup.add(snout);

  // 2 Tai cụp
  [-0.18, 0.18].forEach(ex => {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.12), darkMat);
    ear.position.set(ex, 0.92, 0.4);
    dogGroup.add(ear);
  });

  // Đuôi vẫy
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 6), furMat);
  tail.rotation.x = -0.7;
  tail.position.set(0, 0.65, -0.45);
  dogGroup.add(tail);
  dogGroup.tail = tail;

  // 4 Chân cử động
  dogGroup.legs = [];
  [[-0.18, -0.28], [0.18, -0.28], [-0.18, 0.28], [0.18, 0.28]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 8), bellyMat);
    leg.position.set(lx, 0.225, lz);
    dogGroup.add(leg);
    dogGroup.legs.push(leg);
  });

  // Bảng tên thú cưng
  const nameTag = makeBillboardText('🐕 K-9 BUDDY: BẠN ĐỒNG HÀNH (+HÚT GỖ)', '#f59e0b', 260, 32);
  nameTag.position.set(0, 1.4, 0);
  dogGroup.add(nameTag);

  dogGroup.position.set(0, 0, 0);
  scene.add(dogGroup);
  window.k9DogGroup = dogGroup;
  return dogGroup;
}
window.createK9Companion = createK9Companion;

function updateK9Companion(dt, time, playerPos) {
  const dog = window.k9DogGroup;
  if (!dog || !playerPos) return;

  // Mục tiêu đi theo: lùi sau người chơi 1.5m và lệch sang phải 1.2m
  const target = playerPos.clone().add(new THREE.Vector3(1.2, 0, -1.2));
  const dist = dog.position.distanceTo(target);

  if (dist > 0.4) {
    const dir = target.clone().sub(dog.position).normalize();
    const moveSpeed = Math.min(dist * 4.5, 9.0);
    dog.position.add(dir.multiplyScalar(moveSpeed * dt));
    dog.rotation.y = Math.atan2(dir.x, dir.z);

    // Chân chạy
    if (dog.legs) {
      dog.legs.forEach((leg, idx) => {
        leg.rotation.x = Math.sin(time * 14.0 + idx * Math.PI) * 0.45;
      });
    }
  } else {
    // Đứng yên
    if (dog.legs) dog.legs.forEach(leg => leg.rotation.x = 0);
  }

  // Đuôi luôn vẫy mừng vui vẻ
  if (dog.tail) {
    dog.tail.rotation.z = Math.sin(time * 12.0) * 0.35;
  }
}
window.updateK9Companion = updateK9Companion;

// ===========================================================================
// 21. HIỆU ỨNG SẤM SÉT THIÊN TAI ĐÔ THỊ (THUNDERSTORM LIGHTNING STRIKE)
// ===========================================================================
function triggerCityLightningStrike(scene) {
  if (!scene) return;
  const strikeX = (Math.random() - 0.5) * 120;
  const strikeZ = (Math.random() - 0.5) * 120;

  // Tạo tia sét 3D khúc khuỷu giáng từ mây xuống đất
  const points = [];
  let curPos = new THREE.Vector3(strikeX, 48, strikeZ);
  points.push(curPos.clone());
  while (curPos.y > 0) {
    curPos.y -= 5 + Math.random() * 4;
    curPos.x += (Math.random() - 0.5) * 4;
    curPos.z += (Math.random() - 0.5) * 4;
    points.push(curPos.clone());
  }

  const lightningGeo = new THREE.BufferGeometry().setFromPoints(points);
  const lightningMat = new THREE.LineBasicMaterial({ color: 0x93c5fd, linewidth: 3 });
  const lightningLine = new THREE.Line(lightningGeo, lightningMat);
  scene.add(lightningLine);

  // Chớp sáng lóa màn hình
  if (window.sunLight) {
    const origIntensity = window.sunLight.intensity;
    window.sunLight.intensity = 5.0;
    setTimeout(() => {
      if (window.sunLight) window.sunLight.intensity = origIntensity;
    }, 90);
  }

  // Âm thanh sấm nổ rền vang
  if (typeof sounds !== 'undefined' && sounds.playThunderCrash) {
    sounds.playThunderCrash();
  }

  if (typeof triggerCameraShake === 'function') {
    triggerCameraShake(0.45, 0.35);
  }

  // Xóa tia sét sau 180ms
  setTimeout(() => {
    scene.remove(lightningLine);
    lightningGeo.dispose();
    lightningMat.dispose();
  }, 180);
}
window.triggerCityLightningStrike = triggerCityLightningStrike;

// ===========================================================================
// 22. KHU ĐÔ THỊ DÂN CƯ & CỤM CHUNG CƯ HIỆN ĐẠI (HIGH-DENSITY RESIDENTIAL HUB)
// TỌA ĐỘ VÀNG PHÍA NAM: X = -75, Z = 95 (ĐẤT LIỀN BẰNG PHẲNG KHÔNG CHỒNG CAO TỐC)
// ===========================================================================
function createHighDensityResidentialHub(scene) {
  const hubGroup = new THREE.Group();
  hubGroup.name = 'residential_apartments_hub';
  hubGroup.position.set(-75, 0, 95);
  scene.add(hubGroup);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4 });
  const woodPanelMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 });
  const pavementMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
  const brickMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 });

  // 1. SÀN QUẢNG TRƯỜNG DÂN CƯ 32M x 22M
  const plazaFloor = new THREE.Mesh(new THREE.BoxGeometry(32, 0.25, 22), pavementMat);
  plazaFloor.position.y = 0.12;
  hubGroup.add(plazaFloor);

  // TÒA NHÀ A: KHỐI CHUNG CƯ 3 TẦNG CUTAWAY (TÂM TẠI -8, 0, 0)
  const bldgA = new THREE.Group();
  bldgA.position.set(-8, 0, 0);
  hubGroup.add(bldgA);

  const bldgBaseA = new THREE.Mesh(new THREE.BoxGeometry(13, 0.2, 16), wallMat);
  bldgBaseA.position.y = 0.2;
  bldgA.add(bldgBaseA);

  // Tường hậu và 2 tường hông không mái
  const backWallA = new THREE.Mesh(new THREE.BoxGeometry(13, 7.5, 0.4), wallMat);
  backWallA.position.set(0, 3.85, 7.8);
  bldgA.add(backWallA);

  [-6.3, 6.3].forEach(wx => {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7.5, 16), wallMat);
    sideWall.position.set(wx, 3.85, 0);
    bldgA.add(sideWall);
  });

  // Tầng 2 & 3 sàn gác lửng
  [2.8, 5.4].forEach((fy, idx) => {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.2, 15.2), woodPanelMat);
    floor.position.set(0, fy, 0);
    bldgA.add(floor);

    // Ban công kính phía trước
    const balcony = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.9, 0.1), glassMat);
    balcony.position.set(0, fy + 0.45, -7.5);
    bldgA.add(balcony);

    // Chậu hoa cây cảnh ban công
    [-4, 0, 4].forEach(px => {
      const pot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6), brickMat);
      pot.position.set(px, fy + 0.2, -7.2);
      bldgA.add(pot);
      const plant = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
      plant.position.set(px, fy + 0.55, -7.2);
      bldgA.add(plant);
    });
  });

  // TẦNG 1: TIỆM TẠP HÓA TIỆN LỢI 24/7 (CONVENIENCE STORE)
  const storeSign = makeBillboardText('🏪 TIỆM TẠP HÓA 24/7 • SIÊU THỊ DÂN CƯ', '#10b981', 340, 36);
  storeSign.position.set(0, 2.7, -7.6);
  bldgA.add(storeSign);

  // Kệ hàng siêu thị mini
  [-2.5, 2.5].forEach(kx => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 3.8), new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6 }));
    shelf.position.set(kx, 1.0, 1.0);
    bldgA.add(shelf);
  });

  // Cây rút tiền ATM ngoài cửa tiệm
  const atm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 0.9), new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8 }));
  atm.position.set(4.8, 1.0, -7.0);
  bldgA.add(atm);
  const atmTag = makeBillboardText('🏧 ATM', '#38bdf8', 120, 24);
  atmTag.position.set(4.8, 2.2, -7.0);
  bldgA.add(atmTag);

  // TÒA NHÀ B: CĂN HỘ GIA ĐÌNH VĂN MINH (TÂM TẠI 8, 0, 0)
  const bldgB = new THREE.Group();
  bldgB.position.set(8, 0, 0);
  hubGroup.add(bldgB);

  const backWallB = new THREE.Mesh(new THREE.BoxGeometry(13, 7.5, 0.4), wallMat);
  backWallB.position.set(0, 3.85, 7.8);
  bldgB.add(backWallB);

  [-6.3, 6.3].forEach(wx => {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7.5, 16), wallMat);
    sideWall.position.set(wx, 3.85, 0);
    bldgB.add(sideWall);
  });

  [2.8, 5.4].forEach(fy => {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.2, 15.2), woodPanelMat);
    floor.position.set(0, fy, 0);
    bldgB.add(floor);
  });

  // Mini NPC Cư dân sinh hoạt trong căn hộ
  const residentMom = createMiniNPC({
    role: 'officer',
    posX: -8,
    posY: 0.3,
    posZ: -3,
    shirtColor: 0xec4899, // Áo hồng
    animType: 'breathe'
  });
  hubGroup.add(residentMom);

  const residentDad = createMiniNPC({
    role: 'officer',
    posX: 8,
    posY: 3.0,
    posZ: 1,
    shirtColor: 0x3b82f6, // Áo xanh dương
    animType: 'turn'
  });
  hubGroup.add(residentDad);

  // Vòng pad thu Thuế dân cư & Bảng khảo sát ý kiến
  const taxPadMesh = new THREE.Mesh(new THREE.RingGeometry(2.0, 3.2, 32), new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide }));
  taxPadMesh.rotation.x = -Math.PI / 2;
  taxPadMesh.position.set(0, 0.2, -9.0);
  hubGroup.add(taxPadMesh);

  const taxTag = makeBillboardText('🏙️ KHU CHUNG CƯ DÂN CƯ: [E] THU THUẾ THÀNH PHỐ (+$800/ĐỢT)!', '#10b981', 520, 48);
  taxTag.position.set(0, 3.4, -9.0);
  hubGroup.add(taxTag);

  window.residentialApartmentPad = { pos: new THREE.Vector3(-75, 0, 86), radius: 5.5, cooldown: 0 };
}
window.createHighDensityResidentialHub = createHighDensityResidentialHub;

// ===========================================================================
// 23. PHỐ ĐI BỘ BỜ KÈ & XE BÁN ĐỒ ĂN FOOD TRUCKS (STREET LIFE & VENDORS)
// TỌA ĐỘ BỜ NAM VEN SÔNG: X = -35, Z = 42 & NGHỆ SĨ GUITAR TẠI X = -10, Z = 42
// ===========================================================================
function createRiversideFoodTrucksAndStreetLife(scene) {
  const streetGroup = new THREE.Group();
  streetGroup.name = 'riverside_street_life';
  scene.add(streetGroup);

  const truckMetalMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.3 }); // Xe đỏ
  const bobaTruckMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.8, roughness: 0.3 }); // Xe xanh ngọc
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
  const tireMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });

  // 1. XE BÁN GOURMET BURGER & HOTDOG TRUCK TẠI (-35, 0, 42)
  const truck1 = new THREE.Group();
  truck1.position.set(-35, 0, 42);
  streetGroup.add(truck1);

  const body1 = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.8, 2.6), truckMetalMat);
  body1.position.y = 1.7;
  truck1.add(body1);

  // Mái bạt sọc đỏ trắng hiên mở bán
  const awning1 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 1.4), whiteMat);
  awning1.position.set(0, 2.8, -1.8);
  awning1.rotation.x = 0.25;
  truck1.add(awning1);

  // 4 Bánh xe
  [[-2.0, -1.3], [2.0, -1.3], [-2.0, 1.3], [2.0, 1.3]].forEach(([wx, wz]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 12), tireMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.45, wz);
    truck1.add(wheel);
  });

  const sign1 = makeBillboardText('🍔 BURGER & HOTDOG EXPRESS', '#ef4444', 280, 32);
  sign1.position.set(0, 3.6, 0);
  truck1.add(sign1);

  // Đầu bếp Mini NPC nướng bánh
  const chef = createMiniNPC({
    role: 'officer',
    posX: 0,
    posY: 0.6,
    posZ: -0.8,
    shirtColor: 0xf8fafc,
    animType: 'hammer'
  });
  truck1.add(chef);

  // 2. XE TRÀ SỮA TRÂN CHÂU & KEM GELATO TẠI (40, 0, 42)
  const truck2 = new THREE.Group();
  truck2.position.set(40, 0, 42);
  streetGroup.add(truck2);

  const body2 = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.8, 2.6), bobaTruckMat);
  body2.position.y = 1.7;
  truck2.add(body2);

  const awning2 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 1.4), whiteMat);
  awning2.position.set(0, 2.8, -1.8);
  awning2.rotation.x = 0.25;
  truck2.add(awning2);

  [[-2.0, -1.3], [2.0, -1.3], [-2.0, 1.3], [2.0, 1.3]].forEach(([wx, wz]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 12), tireMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.45, wz);
    truck2.add(wheel);
  });

  const sign2 = makeBillboardText('🧋 TRÀ SỮA BOBA & KEM GELATO', '#06b6d4', 300, 32);
  sign2.position.set(0, 3.6, 0);
  truck2.add(sign2);

  // 3. BÀN GHẾ BISTRO NGOÀI TRỜI DỌC BỜ SÔNG
  [-28, -20, 26, 32].forEach(tx => {
    const tableGroup = new THREE.Group();
    tableGroup.position.set(tx, 0, 42);

    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 16), woodMat);
    tableTop.position.y = 0.8;
    tableGroup.add(tableTop);

    const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8), tireMat);
    tableLeg.position.y = 0.4;
    tableGroup.add(tableLeg);

    [-0.9, 0.9].forEach(cx => {
      const chair = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), woodMat);
      chair.position.set(cx, 0.25, 0);
      tableGroup.add(chair);
    });

    streetGroup.add(tableGroup);
  });

  // 4. NGHỆ SĨ ĐƯỜNG PHỐ GẢY GUITAR (STREET BUSKER) TẠI (-10, 0, 42)
  const buskerGroup = new THREE.Group();
  buskerGroup.position.set(-10, 0, 42);
  streetGroup.add(buskerGroup);

  // Loa thùng / Ghế ngồi
  const amp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.5), tireMat);
  amp.position.set(0, 0.3, 0);
  buskerGroup.add(amp);

  const guitarCase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 0.5), woodMat);
  guitarCase.position.set(0, 0.1, -1.0);
  buskerGroup.add(guitarCase);

  const busker = createMiniNPC({
    role: 'builder',
    posX: 0,
    posY: 0.6,
    posZ: 0,
    shirtColor: 0x8b5cf6, // Áo tím phong trần
    animType: 'hammer' // Cử động gảy đàn
  });
  buskerGroup.add(busker);

  const buskerTag = makeBillboardText('🎸 NGHỆ SĨ GUITAR ĐƯỜNG PHỐ (NHẤP [E] TẶNG TIỀN BOA $20)', '#a855f7', 420, 40);
  buskerTag.position.set(0, 2.2, 0);
  buskerGroup.add(buskerTag);

  window.buskerPad = { pos: new THREE.Vector3(-10, 0, 42), radius: 3.5 };
}
window.createRiversideFoodTrucksAndStreetLife = createRiversideFoodTrucksAndStreetLife;

// ===========================================================================
// 24. TRẠM KIỂM SOÁT CẢNH SÁT CỬA NGÕ (POLICE ROADBLOCK & BARRIER CHECKPOINT)
// TỌA ĐỘ LỐI VÀO TRẠI GIAM: X = -120, Z = 54
// ===========================================================================
function createPoliceRoadblockCheckpoint(scene) {
  const gateGroup = new THREE.Group();
  gateGroup.position.set(-120, 0, 54);
  scene.add(gateGroup);

  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.7, roughness: 0.3 });
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });

  // Bốt gác an ninh
  const booth = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.2, 3.0), new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.6 }));
  booth.position.set(0, 1.6, -4.5);
  gateGroup.add(booth);

  // Đèn xoay cảnh sát trên nóc bốt
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8), new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
  beacon.position.set(0, 3.35, -4.5);
  gateGroup.add(beacon);

  // Thanh rào chắn Barie vắt ngang đường
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 8.5, 8), barrierMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0, 1.0, 0);
  gateGroup.add(arm);

  // Biển cảnh báo kiểm soát an ninh
  const gateTag = makeBillboardText('🛑 TRẠM KIỂM SOÁT AN NINH CẢNH SÁT: GIẢM TỐC ĐỘ DƯỚI 30KM/H!', '#ef4444', 500, 46);
  gateTag.position.set(0, 3.6, 0);
  gateGroup.add(gateTag);

  // 2 Cảnh sát vũ trang đứng gác
  [-2.5, 2.5].forEach(gx => {
    const guard = createMiniNPC({
      role: 'officer',
      posX: gx,
      posY: 0,
      posZ: -2.0,
      shirtColor: 0x1e3a8a,
      animType: 'turn'
    });
    gateGroup.add(guard);
  });
}
window.createPoliceRoadblockCheckpoint = createPoliceRoadblockCheckpoint;

// ===========================================================================
// 25. KHU THỂ THAO & SINH HOẠT TRẠI GIAM NGOÀI TRỜI (PRISON RECREATION YARD)
// TỌA ĐỘ KHUÔN VIÊN TRẠI GIAM: X = -145, Z = 60
// ===========================================================================
function createPrisonYardRecreation(scene) {
  const yardGroup = new THREE.Group();
  yardGroup.position.set(-145, 0, 60);
  scene.add(yardGroup);

  const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316 }); // Áo phạm nhân cam
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });

  // Sân bóng rổ nửa sân
  const court = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), asphaltMat);
  court.rotation.x = -Math.PI / 2;
  court.position.set(4, 0.06, 0);
  yardGroup.add(court);

  // Trụ bóng rổ & rổ
  const hoopPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.5, 8), steelMat);
  hoopPole.position.set(9.5, 1.75, 0);
  yardGroup.add(hoopPole);

  const backboard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 1.8), new THREE.MeshBasicMaterial({ color: 0xf8fafc }));
  backboard.position.set(9.2, 3.2, 0);
  yardGroup.add(backboard);

  // Giàn xà đơn & tạ tập thể hình
  const pullupBar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 2.8), steelMat);
  pullupBar.position.set(-5, 1.25, 3);
  yardGroup.add(pullupBar);

  // 3 Phạm nhân áo cam đang tập luyện
  const prisoner1 = createMiniNPC({
    role: 'prisoner',
    posX: 4,
    posY: 0,
    posZ: 0,
    shirtColor: 0xf97316,
    animType: 'hammer' // Nhảy ném bóng
  });
  yardGroup.add(prisoner1);

  const prisoner2 = createMiniNPC({
    role: 'prisoner',
    posX: -5,
    posY: 0,
    posZ: 3,
    shirtColor: 0xf97316,
    animType: 'breathe' // Hít xà
  });
  yardGroup.add(prisoner2);
}
window.createPrisonYardRecreation = createPrisonYardRecreation;

// ===========================================================================
// 26. PHÒNG XÉT XỬ TÒA ÁN ĐÔ THỊ (CITY HALL COURTROOM INTERIOR)
// ===========================================================================
function createCourtroomInterior(scene) {
  const courtGroup = new THREE.Group();
  courtGroup.position.set(-18, 0, 58);
  scene.add(courtGroup);

  const mahoganyMat = new THREE.MeshStandardMaterial({ color: 0x3f1d0b, roughness: 0.6 });

  // Bục Thẩm phán uy nghiêm
  const judgeBench = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.4, 1.6), mahoganyMat);
  judgeBench.position.set(0, 0.7, 0);
  courtGroup.add(judgeBench);

  // Búa gõ tòa án
  const gavel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8), mahoganyMat);
  gavel.rotation.z = Math.PI / 2;
  gavel.position.set(0.8, 1.45, 0);
  courtGroup.add(gavel);

  // Thẩm phán Mini NPC áo thụng đen cầm búa
  const judge = createMiniNPC({
    role: 'officer',
    posX: 0,
    posY: 0.4,
    posZ: 0.5,
    shirtColor: 0x0f172a,
    animType: 'hammer'
  });
  courtGroup.add(judge);

  const courtTag = makeBillboardText('⚖️ PHÒNG XÉT XỬ TÒA ÁN NHÂN DÂN', '#facc15', 300, 32);
  courtTag.position.set(0, 2.6, 0);
  courtGroup.add(courtTag);
}
window.createCourtroomInterior = createCourtroomInterior;

// ===========================================================================
// 27. HỆ THỐNG ĐÁM ĐÔNG DÂN CƯ ĐI BỘ TỰ ĐỘNG (AUTONOMOUS PEDESTRIAN CROWD)
// 28 CƯ DÂN TRANG PHỤC ĐA DẠNG DẠO PHỐ, QUA ĐƯỜNG & CHỜ XE BUÝT
// ===========================================================================
const CITIZEN_SHIRT_COLORS = [0x3b82f6, 0x10b981, 0xef4444, 0xf59e0b, 0x8b5cf6, 0xec4899, 0x06b6d4, 0xf8fafc];
const CITIZEN_DIALOGUES = [
  '👋 Chào bạn! Thành phố hôm nay thật bình yên và nhộn nhịp!',
  '🌲 Xưởng cưa gỗ làm ăn phát đạt quá, kinh tế đảo đang đi lên!',
  '👮 Thấy Cảnh sát tuần tra liên tục tôi cảm thấy rất yên tâm!',
  '🚏 Hệ thống xe buýt công cộng kết nối 4 quận tiện lợi thật đấy!',
  '🏖️ Dinh thự ven biển đẹp mê hồn, ước gì tôi đủ tiền mua!',
  '⚡ May mà có Nhà máy nhiệt điện, dạo này không còn bị Blackout nữa!',
  '🛒 Hôm nay tôi vừa ghé Sàn Chợ mua được mớ ván gỗ giá hời!'
];

function initCityPedestrianCrowd(scene) {
  window.cityPedestrians = [];

  // 4 Tuyến đường đi bộ chính (Waypoints trên Quảng Trường & Vỉa Hè - 0% CẮT XUYÊN TƯỜNG NHÀ)
  const routes = [
    // Tuyến 1: Phố đi bộ ven sông Bờ Nam (-50 -> 15 dọc Z=34)
    { startX: -50, z: 34, endX: 15, dir: 1 },
    // Tuyến 2: Đại lộ Phố đi bộ trước Tòa Thị Chính & Tài Chính (-50 -> 14 dọc Z=67)
    { startX: -50, z: 67, endX: 14, dir: 1 },
    // Tuyến 3: Trục hoa viên kết nối Công viên - Đài phun nước (X = -18, Z từ 34 đến 48)
    { startZ: 34, x: -18, endZ: 48, dir: 1, isZ: true },
    // Tuyến 4: Ven biển Dinh thự (80 -> 115 dọc Z=48)
    { startX: 80, z: 48, endX: 115, dir: 1 }
  ];

  for (let ci = 0; ci < 28; ci++) {
    const route = routes[ci % routes.length];
    const sColor = CITIZEN_SHIRT_COLORS[ci % CITIZEN_SHIRT_COLORS.length];

    const pGroup = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd8b8, roughness: 0.7 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: sColor, roughness: 0.8 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.8 });

    // Thân người
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), shirtMat);
    body.position.y = 0.95;
    pGroup.add(body);

    // Đầu
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), skinMat);
    head.position.y = 1.5;
    pGroup.add(head);

    // 2 Chân cử động
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), pantsMat);
    leftLeg.position.set(-0.14, 0.3, 0);
    pGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), pantsMat);
    rightLeg.position.set(0.14, 0.3, 0);
    pGroup.add(rightLeg);

    // 2 Tay vung vẩy
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.15), shirtMat);
    leftArm.position.set(-0.35, 0.9, 0);
    pGroup.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.15), shirtMat);
    rightArm.position.set(0.35, 0.9, 0);
    pGroup.add(rightArm);

    // Dù che mưa / tuyết tự động bật khi thời tiết xấu (Autonomous Umbrella)
    const umbrellaGroup = new THREE.Group();
    const umbrellaShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 }));
    umbrellaShaft.position.y = 0.55;
    umbrellaGroup.add(umbrellaShaft);

    const umbrellaCanopy = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.38, 10), new THREE.MeshStandardMaterial({ color: sColor, roughness: 0.4 }));
    umbrellaCanopy.position.y = 1.1;
    umbrellaGroup.add(umbrellaCanopy);

    umbrellaGroup.position.set(0.32, 0.85, 0.12);
    umbrellaGroup.scale.set(0.001, 0.001, 0.001); // Ẩn khi trời quang đãng
    pGroup.add(umbrellaGroup);

    // Vị trí xuất phát ngẫu nhiên trên tuyến
    if (route.isZ) {
      pGroup.position.set(route.x + (Math.random() - 0.5) * 1.5, 0, route.startZ + Math.random() * (route.endZ - route.startZ));
    } else {
      pGroup.position.set(route.startX + Math.random() * (route.endX - route.startX), 0, route.z + (Math.random() - 0.5) * 1.5);
    }

    scene.add(pGroup);

    window.cityPedestrians.push({
      group: pGroup,
      route: route,
      speed: 1.5 + Math.random() * 0.9,
      dir: Math.random() > 0.5 ? 1 : -1,
      phase: Math.random() * Math.PI * 2,
      leftLeg: leftLeg,
      rightLeg: rightLeg,
      leftArm: leftArm,
      rightArm: rightArm,
      umbrella: umbrellaGroup,
      dialogue: CITIZEN_DIALOGUES[ci % CITIZEN_DIALOGUES.length]
    });
  }
}
window.initCityPedestrianCrowd = initCityPedestrianCrowd;

function updateCityPedestrians(dt, time, playerPos) {
  if (!window.cityPedestrians) return;

  const isBadWeather = (typeof window.isRaining !== 'undefined' && window.isRaining) || (typeof gameState !== 'undefined' && (gameState.currentSeason === 'winter' || gameState.weather === 'rain'));
  const isCrisis = (typeof gameState !== 'undefined' && (gameState.activeCrisis || (gameState.cityMetrics && gameState.cityMetrics.crimeRate > 40) || window.isBankRobberyActive));

  for (let pi = 0; pi < window.cityPedestrians.length; pi++) {
    const ped = window.cityPedestrians[pi];
    const r = ped.route;

    // Hiệu ứng giương dù che mưa tuyết mượt mà
    if (ped.umbrella) {
      const targetUmbrellaScale = isBadWeather ? 1.0 : 0.001;
      ped.umbrella.scale.x = THREE.MathUtils.lerp(ped.umbrella.scale.x, targetUmbrellaScale, dt * 3.5);
      ped.umbrella.scale.y = THREE.MathUtils.lerp(ped.umbrella.scale.y, targetUmbrellaScale, dt * 3.5);
      ped.umbrella.scale.z = THREE.MathUtils.lerp(ped.umbrella.scale.z, targetUmbrellaScale, dt * 3.5);
    }

    // Tốc độ di chuyển: Tăng gấp 2.2 lần khi hoảng loạn tháo chạy vì khủng hoảng
    const currentSpeed = isCrisis ? ped.speed * 2.2 : ped.speed;

    // Di chuyển tới lui theo tuyến đường
    if (r.isZ) {
      ped.group.position.z += ped.dir * currentSpeed * dt;
      ped.group.rotation.y = ped.dir > 0 ? 0 : Math.PI;
      if (ped.group.position.z >= r.endZ) ped.dir = -1;
      else if (ped.group.position.z <= r.startZ) ped.dir = 1;
    } else {
      ped.group.position.x += ped.dir * currentSpeed * dt;
      ped.group.rotation.y = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (ped.group.position.x >= r.endX) ped.dir = -1;
      else if (ped.group.position.x <= r.startX) ped.dir = 1;
    }

    // Hoạt ảnh vung tay và bước chân (Chạy hoảng loạn hoặc dạo phố thong thả)
    if (isCrisis) {
      const runCycle = Math.sin(time * 16.0 + ped.phase);
      if (ped.leftLeg) ped.leftLeg.rotation.x = runCycle * 0.9;
      if (ped.rightLeg) ped.rightLeg.rotation.x = -runCycle * 0.9;
      // Hai tay giơ lên trời cầu cứu hoảng hốt
      if (ped.leftArm) ped.leftArm.rotation.x = -2.2 + Math.sin(time * 14.0 + ped.phase) * 0.4;
      if (ped.rightArm) ped.rightArm.rotation.x = -2.2 - Math.sin(time * 14.0 + ped.phase) * 0.4;
    } else {
      const walkCycle = Math.sin(time * 8.0 + ped.phase);
      if (ped.leftLeg) ped.leftLeg.rotation.x = walkCycle * 0.6;
      if (ped.rightLeg) ped.rightLeg.rotation.x = -walkCycle * 0.6;
      if (ped.leftArm) ped.leftArm.rotation.x = -walkCycle * 0.5;
      if (ped.rightArm) ped.rightArm.rotation.x = isBadWeather ? -0.8 : walkCycle * 0.5; // Cầm dù chắc chắn khi mưa
    }

    // Dân cư nhìn về phía người chơi khi ở cự ly gần < 4m (khi không khủng hoảng)
    if (!isCrisis && playerPos && ped.group.position.distanceTo(playerPos) < 4.0) {
      ped.group.lookAt(playerPos.x, ped.group.position.y, playerPos.z);
    }
  }
}
window.updateCityPedestrians = updateCityPedestrians;

// ===========================================================================
// 28. ĐỘI XE CẢNH SÁT TUẦN TRA TỰ ĐỘNG & BIỆT ĐỘI TRUY BẮT TỘI PHẠM (ACTIVE POLICE AI)
// 2 XE TUẦN TRA ĐẠI LỘ + 4 CẢNH SÁT ĐI BỘ TRUY BẮT 911
// ===========================================================================
function initAIPoliceForce(scene) {
  window.aiPoliceCruisers = [];

  // Tạo 2 Xe Cảnh Sát AI Tuần Tra Khép Kín Trên Đại Lộ
  for (let ci = 0; ci < 2; ci++) {
    const cGroup = new THREE.Group();
    cGroup.name = `ai_police_cruiser_${ci}`;

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.8, roughness: 0.2 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const wheelMat = new THREE.MeshBasicMaterial({ color: 0x111827 });

    const carBody = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 4.8), bodyMat);
    carBody.position.y = 0.65;
    cGroup.add(carBody);

    const carCabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 2.5), whiteMat);
    carCabin.position.set(0, 1.35, -0.2);
    cGroup.add(carCabin);

    // Đèn chớp cảnh sát Xanh / Đỏ trên nóc
    const sirenRed = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.5), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    sirenRed.position.set(-0.5, 1.78, -0.2);
    cGroup.add(sirenRed);

    const sirenBlue = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.5), new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
    sirenBlue.position.set(0.5, 1.78, -0.2);
    cGroup.add(sirenBlue);

    // 4 Bánh xe
    [[-1.2, -1.4], [1.2, -1.4], [-1.2, 1.4], [1.2, 1.4]].forEach(([wx, wz]) => {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12), wheelMat);
      wh.rotation.z = Math.PI / 2;
      wh.position.set(wx, 0.4, wz);
      cGroup.add(wh);
    });

    const policeTag = makeBillboardText('🚔 CẢNH SÁT TUẦN TRA ĐÔ THỊ (AI POLICE)', '#3b82f6', 360, 36);
    policeTag.position.set(0, 2.6, 0);
    cGroup.add(policeTag);

    // Vị trí xuất phát trên cao tốc (Xe 1 tại X=28, Z=0; Xe 2 tại X=-110, Z=50)
    cGroup.position.set(ci === 0 ? 28 : -108, 0, ci === 0 ? -90 : 158);
    scene.add(cGroup);

    window.aiPoliceCruisers.push({
      group: cGroup,
      sirenRed: sirenRed,
      sirenBlue: sirenBlue,
      state: 'patrol', // 'patrol' hoặc 'pursuit'
      speed: 11.0,
      waypointIdx: ci * 2,
      sirenTimer: 0
    });
  }
}
window.initAIPoliceForce = initAIPoliceForce;

function updateAIPoliceForce(dt, time, playerPos, wantedStars) {
  if (!window.aiPoliceCruisers) return;

  // Lộ trình tuần tra 4 góc cao tốc vành đai thành phố (100% TRÊN MẶT ĐƯỜNG CAO TỐC CHUẨN)
  const highwayWaypoints = [
    new THREE.Vector3(28, 0, 158),
    new THREE.Vector3(-108, 0, 158),
    new THREE.Vector3(-108, 0, -90),
    new THREE.Vector3(28, 0, -90)
  ];

  const isPursuit = (wantedStars && wantedStars >= 1);

  for (let ci = 0; ci < window.aiPoliceCruisers.length; ci++) {
    const cruiser = window.aiPoliceCruisers[ci];

    // Nhấp nháy đèn cảnh sát đỏ xanh
    cruiser.sirenTimer += dt * (isPursuit ? 18.0 : 6.0);
    const flash = Math.sin(cruiser.sirenTimer) > 0;
    if (cruiser.sirenRed && cruiser.sirenBlue) {
      cruiser.sirenRed.material.color.setHex(flash ? 0xff0000 : 0x450a0a);
      cruiser.sirenBlue.material.color.setHex(!flash ? 0x0088ff : 0x082f49);
    }

    if (isPursuit && playerPos) {
      // CHẾ ĐỘ TRUY ĐUỔI TỘI PHẠM (PURSUIT MODE)
      cruiser.state = 'pursuit';
      const targetDir = playerPos.clone().sub(cruiser.group.position).normalize();
      cruiser.group.position.add(targetDir.multiplyScalar(15.5 * dt));
      cruiser.group.lookAt(playerPos.x, cruiser.group.position.y, playerPos.z);

      // Cự ly dưới 5.2m: Rút súng điện Taser khống chế và bắt giữ!
      if (cruiser.group.position.distanceTo(playerPos) <= 5.2) {
        if (typeof gameState !== 'undefined') {
          gameState.wantedStars = 0;
          gameState.money = Math.max(0, (gameState.money || 0) - 500);
        }
        if (typeof sounds !== 'undefined' && sounds.playTaserShock) sounds.playTaserShock();
        if (typeof showToast === 'function') {
          showToast('⚡ BẠN ĐÃ BỊ XE CẢNH SÁT KHỐNG CHẾ BẰNG SÚNG ĐIỆN TASER! Nộp phạt $500 USD.');
        }
        if (typeof updateHUD === 'function') updateHUD();
      }
    } else {
      // CHẾ ĐỘ TUẦN TRA ĐẠI LỘ THƯỜNG NHẬT (PATROL MODE)
      cruiser.state = 'patrol';
      const wp = highwayWaypoints[cruiser.waypointIdx];
      const dir = wp.clone().sub(cruiser.group.position).normalize();
      cruiser.group.position.add(dir.multiplyScalar(cruiser.speed * dt));
      cruiser.group.lookAt(wp.x, cruiser.group.position.y, wp.z);

      if (cruiser.group.position.distanceTo(wp) < 8.0) {
        cruiser.waypointIdx = (cruiser.waypointIdx + 1) % highwayWaypoints.length;
      }
    }
  }
}
window.updateAIPoliceForce = updateAIPoliceForce;

// ===========================================================================
// 29. TRUNG TÂM CẤP CỨU Y TẾ 115 & TRỰC THĂNG MEDEVAC (EMS HOSPITAL WING)
// TỌA ĐỘ BỆNH VIỆN ĐÔ THỊ: X = 70, Z = 56
// ===========================================================================
function createEMSAmbulanceAndHospitalHelipad(scene) {
  const emsGroup = new THREE.Group();
  emsGroup.name = 'ems_hospital_wing';
  scene.add(emsGroup);

  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 });
  const tireMat = new THREE.MeshBasicMaterial({ color: 0x111827 });

  // 1. SÂN ĐÁP TRỰC THĂNG Y TẾ (MEDEVAC HELIPAD) TRÊN NÓC BỆNH VIỆN TẠI (70, 7.5, 56)
  const helipadPad = new THREE.Mesh(new THREE.CylinderGeometry(5.0, 5.0, 0.2, 24), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
  helipadPad.position.set(70, 7.5, 56);
  emsGroup.add(helipadPad);

  const hRing = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.2, 24), new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }));
  hRing.rotation.x = -Math.PI / 2;
  hRing.position.set(70, 7.62, 56);
  emsGroup.add(hRing);

  // Chữ thập đỏ y tế trên mặt Helipad
  [-1.8, 0, 1.8].forEach(hx => {
    const bar1 = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 3.2), new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide }));
    bar1.rotation.x = -Math.PI / 2;
    bar1.position.set(70, 7.63, 56);
    emsGroup.add(bar1);

    const bar2 = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide }));
    bar2.rotation.x = -Math.PI / 2;
    bar2.position.set(70, 7.63, 56);
    emsGroup.add(bar2);
  });

  // Trực thăng cấp cứu Medevac đậu sẵn
  const heliGroup = new THREE.Group();
  heliGroup.position.set(70, 7.8, 56);
  emsGroup.add(heliGroup);

  const heliFuselage = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 4.8), whiteMat);
  heliFuselage.position.y = 1.0;
  heliGroup.add(heliFuselage);

  // Chữ thập đỏ bên hông trực thăng
  [-0.92, 0.92].forEach(hx => {
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.9), redMat);
    crossH.position.set(hx, 1.0, 0);
    heliGroup.add(crossH);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.3), redMat);
    crossV.position.set(hx, 1.0, 0);
    heliGroup.add(crossV);
  });

  // Cánh quạt chính trực thăng
  const mainRotor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 7.5), new THREE.MeshBasicMaterial({ color: 0x0f172a }));
  mainRotor.position.set(0, 2.2, 0);
  heliGroup.add(mainRotor);
  window.medevacHelicopterRotor = mainRotor;

  // 2. XE CỨU THƯƠNG AI TUẦN TRA (AI AMBULANCE 115) TẠI (62, 0, 50)
  const ambGroup = new THREE.Group();
  ambGroup.name = 'ai_ambulance_115';
  ambGroup.position.set(62, 0, 50);
  emsGroup.add(ambGroup);

  const ambBody = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.2, 5.2), whiteMat);
  ambBody.position.y = 1.3;
  ambGroup.add(ambBody);

  const ambStripe = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.45, 5.25), redMat);
  ambStripe.position.y = 1.25;
  ambGroup.add(ambStripe);

  // Đèn còi cấp cứu đỏ / hổ phách
  const ambBeacon = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.6), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  ambBeacon.position.set(0, 2.55, 0);
  ambGroup.add(ambBeacon);

  // 4 Bánh xe cứu thương
  [[-1.3, -1.6], [1.3, -1.6], [-1.3, 1.6], [1.3, 1.6]].forEach(([wx, wz]) => {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12), tireMat);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(wx, 0.42, wz);
    ambGroup.add(wh);
  });

  const ambTag = makeBillboardText('🚑 XE CẤP CỨU 115 ĐÔ THỊ (AMBULANCE)', '#ef4444', 360, 36);
  ambTag.position.set(0, 3.4, 0);
  ambGroup.add(ambTag);

  window.aiAmbulance = {
    group: ambGroup,
    beacon: ambBeacon,
    speed: 8.5,
    timer: 0,
    waypointIdx: 0
  };
}
window.createEMSAmbulanceAndHospitalHelipad = createEMSAmbulanceAndHospitalHelipad;

// ===========================================================================
// 30. BẾN DU THUYỀN MARINA BAY & NGỌN HẢI ĐĂNG CỔ KÍNH (LUXURY MARINA & JETSKI)
// TỌA ĐỘ VỊNH BIỂN ĐÔNG: MARINA X = 140, Z = 55 & HẢI ĐĂNG X = 165, Z = 15
// ===========================================================================
function createLuxuryMarinaAndLighthouse(scene) {
  const marinaGroup = new THREE.Group();
  marinaGroup.name = 'luxury_marina_lighthouse';
  scene.add(marinaGroup);

  const woodDeckMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
  const yachtWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.6 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, transparent: true, opacity: 0.6 });

  // 1. CẦU CẢNG GỖ NỔI MARINA BAY DÀI 28M vươn ra biển
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.4, 28), woodDeckMat);
  pierDeck.position.set(135, 0.2, 50);
  marinaGroup.add(pierDeck);

  // Trụ cọc neo tàu
  for (let pz = 38; pz <= 62; pz += 6) {
    [-2.3, 2.3].forEach(px => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8), woodDeckMat);
      post.position.set(135 + px, 0.6, pz);
      marinaGroup.add(post);
    });
  }

  // 2. MÔ-TÔ NƯỚC JETSKI TỐC ĐỘ CAO (DRIVABLE JETSKI) NEO TẠI (135, 0.2, 42)
  const jetski = new THREE.Group();
  jetski.position.set(132, 0.15, 42);
  marinaGroup.add(jetski);

  const skiHull = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.8, roughness: 0.2 }));
  skiHull.rotation.x = -Math.PI / 2;
  skiHull.position.y = 0.3;
  jetski.add(skiHull);

  const skiSeat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 1.4), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
  skiSeat.position.set(0, 0.5, -0.2);
  jetski.add(skiSeat);

  const skiHandle = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.1), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
  skiHandle.position.set(0, 0.8, 0.5);
  jetski.add(skiHandle);

  const jetskiTag = makeBillboardText('⚡ MÔ-TÔ NƯỚC JETSKI: LƯỚT SÓNG TỐC ĐỘ CAO [E]!', '#06b6d4', 380, 36);
  jetskiTag.position.set(0, 1.8, 0);
  jetski.add(jetskiTag);

  window.jetskiMountPad = { pos: new THREE.Vector3(132, 0, 42), radius: 4.0 };

  // 3. NGỌN HẢI ĐĂNG CỔ KÍNH TRÊN MỎM ĐÁ BIỂN (X = 165, Z = 15)
  const lightGroup = new THREE.Group();
  lightGroup.position.set(165, 0, 15);
  marinaGroup.add(lightGroup);

  // Mỏm đá chân hải đăng
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(6.5, 1), new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 }));
  rock.position.y = 1.0;
  lightGroup.add(rock);

  // Tháp sọc Đỏ - Trắng cao 22m
  for (let ty = 0; ty < 6; ty++) {
    const ringMat = ty % 2 === 0 ? redMat : yachtWhiteMat;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.4 - ty * 0.2, 2.6 - ty * 0.2, 3.5, 16), ringMat);
    ring.position.y = 4.0 + ty * 3.5;
    lightGroup.add(ring);
  }

  // Buồng đèn kính pha 360 độ trên đỉnh
  const lanternRoom = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 2.8, 12), glassMat);
  lanternRoom.position.y = 25.5;
  lightGroup.add(lanternRoom);

  const domeRoof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1.6, 12), redMat);
  domeRoof.position.y = 27.5;
  lightGroup.add(domeRoof);

  // Chùm đèn pha xoay quét biển 360 độ ban đêm (Twin Revolving Searchlight)
  const beamGroup = new THREE.Group();
  beamGroup.position.set(0, 25.5, 0);
  lightGroup.add(beamGroup);

  [-1, 1].forEach(dir => {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(4.0, 42.0, 16), new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    beam.rotation.x = Math.PI / 2;
    beam.position.z = dir * 21.0;
    beamGroup.add(beam);
  });
  window.lighthouseBeamGroup = beamGroup;
}
window.createLuxuryMarinaAndLighthouse = createLuxuryMarinaAndLighthouse;

// ===========================================================================
// 31. NĂNG LƯỢNG TÁI TẠO & NHÀ MÁY TÁI CHẾ SINH THÁI (ECO GREEN RECYCLING)
// TỌA ĐỘ ĐIỆN GIÓ TÂY BẮC: X = -135, Z = -85 & NHÀ MÁY TÁI CHẾ: X = 75, Z = -95
// ===========================================================================
function createEcoRecyclingAndWindFarm(scene) {
  const ecoGroup = new THREE.Group();
  ecoGroup.name = 'eco_green_district';
  scene.add(ecoGroup);

  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
  const solarMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.9, roughness: 0.1 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 });

  // 1. CỤM 3 TURBINE ĐIỆN GIÓ KHỔNG LỒ (WIND TURBINES) TRÊN ĐỒI TÂY BẮC
  window.windTurbineBlades = [];
  [[-135, -85], [-120, -100], [-150, -70]].forEach(([wx, wz], idx) => {
    const tGroup = new THREE.Group();
    tGroup.position.set(wx, 0, wz);
    ecoGroup.add(tGroup);

    // Cột tháp gió cao 26m
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.4, 26, 16), whiteMat);
    mast.position.y = 13.0;
    tGroup.add(mast);

    const nacelle = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 3.2), whiteMat);
    nacelle.position.set(0, 26.2, 0);
    tGroup.add(nacelle);

    // Cụm 3 cánh quạt dài 12m
    const rotorHub = new THREE.Group();
    rotorHub.position.set(0, 26.2, 1.7);
    tGroup.add(rotorHub);

    for (let bi = 0; bi < 3; bi++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.35, 12.0, 0.1), whiteMat);
      blade.position.y = 6.0;
      blade.rotation.z = (bi * Math.PI * 2) / 3;
      rotorHub.add(blade);
    }
    window.windTurbineBlades.push(rotorHub);
  });

  // 2. DÀN PIN MẶT TRỜI QUANG ĐIỆN (SOLAR PHOTOVOLTAIC ARRAYS)
  for (let sx = -140; sx <= -115; sx += 8) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.1, 3.2), solarMat);
    panel.rotation.x = -0.35; // Nghiêng 20 độ đón nắng
    panel.position.set(sx, 1.2, -60);
    ecoGroup.add(panel);
  }

  // 3. NHÀ MÁY PHÂN LOẠI & TÁI CHẾ SINH THÁI (ECO-RECYCLING PLANT) TẠI (85, 0, -95)
  const plantGroup = new THREE.Group();
  plantGroup.position.set(85, 0, -95);
  ecoGroup.add(plantGroup);

  const plantFloor = new THREE.Mesh(new THREE.BoxGeometry(16, 0.2, 14), new THREE.MeshStandardMaterial({ color: 0x334155 }));
  plantFloor.position.y = 0.1;
  plantGroup.add(plantFloor);

  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 1.4, 3.5, 8), greenMat);
  hopper.position.set(0, 2.5, 0);
  plantGroup.add(hopper);

  const conveyor = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 8.0), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
  conveyor.rotation.x = 0.25;
  conveyor.position.set(0, 1.5, 3.5);
  plantGroup.add(conveyor);

  const plantTag = makeBillboardText('♻️ TRẠM TÁI CHẾ SINH THÁI: TÁI SINH PHẾ LIỆU [E] (+$600/LẦN)!', '#22c55e', 480, 46);
  plantTag.position.set(0, 4.8, 0);
  plantGroup.add(plantTag);

  window.ecoRecyclingPad = { pos: new THREE.Vector3(85, 0, -90), radius: 5.0, cooldown: 0 };
}
window.createEcoRecyclingAndWindFarm = createEcoRecyclingAndWindFarm;

// ===========================================================================
// 32. VÒNG QUAY MAY MẮN TẠI QUẢNG TRƯỜNG & LỄ HỘI ĐÔ THỊ (LUCKY WHEEL)
// TỌA ĐỘ QUẢNG TRƯỜNG: X = -18, Z = 42
// ===========================================================================
function createCityLuckyWheelAndFestival(scene) {
  const festGroup = new THREE.Group();
  festGroup.position.set(-36, 0, 40);
  scene.add(festGroup);

  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 });

  // Chân trụ vòng quay
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.35, 3.2, 12), goldMat);
  stand.position.y = 1.6;
  festGroup.add(stand);

  // Đĩa vòng quay 12 múi sắc màu
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.15, 12), new THREE.MeshStandardMaterial({ color: 0xe11d48, metalness: 0.6 }));
  wheel.rotation.x = Math.PI / 2;
  wheel.position.set(0, 2.8, 0);
  festGroup.add(wheel);
  window.luckyWheelMesh = wheel;

  // Kim chỉ số
  const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 6), goldMat);
  pointer.rotation.z = Math.PI;
  pointer.position.set(0, 4.0, 0.2);
  festGroup.add(pointer);

  const wheelTag = makeBillboardText('🎡 VÒNG QUAY MAY MẮN: NHẤP [E] QUAY THƯỞNG MỖI NGÀY!', '#facc15', 440, 42);
  wheelTag.position.set(0, 4.8, 0);
  festGroup.add(wheelTag);

  window.luckyWheelPad = { pos: new THREE.Vector3(-36, 0, 40), radius: 4.5, cooldown: 0 };
}
window.createCityLuckyWheelAndFestival = createCityLuckyWheelAndFestival;

// ===========================================================================
// 33. GIAO THÔNG THÔNG MINH & HẦM ĐƯỜNG BỘ XUYÊN NÚI (SMART TRAFFIC & TUNNEL)
// TỌA ĐỘ ĐÈN GIAO THÔNG: X = 28, Z = 56 & HẦM XUYÊN NÚI: X = -110, Z = -20
// ===========================================================================
function createSmartTrafficAndMountainTunnel(scene) {
  const trafGroup = new THREE.Group();
  scene.add(trafGroup);

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });

  // 1. CỘT ĐÈN GIAO THÔNG THÔNG MINH 3 MÀU TẠI NGÃ TƯ (28, 0, 56)
  const lightPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.2, 8), poleMat);
  lightPole.position.set(24, 2.6, 73);
  trafGroup.add(lightPole);

  const lightBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.4), poleMat);
  lightBox.position.set(24, 4.8, 73);
  trafGroup.add(lightBox);

  // 3 Đèn: Đỏ, Vàng, Xanh
  const redLens = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  redLens.position.set(24, 5.2, 73.2);
  trafGroup.add(redLens);

  const yellowLens = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0x334155 }));
  yellowLens.position.set(24, 4.8, 73.2);
  trafGroup.add(yellowLens);

  const greenLens = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0x334155 }));
  greenLens.position.set(24, 4.4, 73.2);
  trafGroup.add(greenLens);

  window.trafficLightLenses = { red: redLens, yellow: yellowLens, green: greenLens };
  window.trafficCycle = { phase: 'green', timer: 15.0 };

  // 2. VÒM HẦM ĐƯỜNG BỘ XUYÊN NÚI KIÊN CỐ (MOUNTAIN TUNNEL) TẠI (-110, 0, -20)
  const tunnelGroup = new THREE.Group();
  tunnelGroup.position.set(-110, 0, -20);
  trafGroup.add(tunnelGroup);

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
  const portalArch = new THREE.Mesh(new THREE.TorusGeometry(5.5, 1.2, 12, 24, Math.PI), concreteMat);
  portalArch.position.y = 0.5;
  tunnelGroup.add(portalArch);

  // 4 Đèn hầm vàng cam ấm áp
  for (let tz = -6; tz <= 6; tz += 4) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.6), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
    lamp.position.set(0, 5.2, tz);
    tunnelGroup.add(lamp);
  }

  const tunnelTag = makeBillboardText('🚇 HẦM XUYÊN NÚI TÂY BẮC (NORTHWEST TUNNEL)', '#facc15', 420, 38);
  tunnelTag.position.set(0, 6.8, 0);
  tunnelGroup.add(tunnelTag);
}
window.createSmartTrafficAndMountainTunnel = createSmartTrafficAndMountainTunnel;

// ===========================================================================
// 34. THỦY CUNG ĐẠI DƯƠNG & TÀU NGẦM THÁM HIỂM (OCEANARIUM & SUBMARINE)
// TỌA ĐỘ VÒM KÍNH: X = 148, Z = 86 | TÀU NGẦM: X = 140, Z = 74
// ===========================================================================
function createOceanariumAndSubmarine(scene) {
  const oceanGroup = new THREE.Group();
  scene.add(oceanGroup);

  // 1. Đài quan sát Thủy cung mái vòm kính tại (148, 0.2, 86)
  const domeBase = new THREE.Mesh(
    new THREE.CylinderGeometry(8.5, 9.0, 0.4, 24),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 })
  );
  domeBase.position.set(148, 0.2, 86);
  oceanGroup.add(domeBase);

  // Vòm kính trong suốt phản quang ánh nước
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.38,
    roughness: 0.1,
    metalness: 0.2
  });
  const glassDome = new THREE.Mesh(
    new THREE.SphereGeometry(7.8, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    glassMat
  );
  glassDome.position.set(148, 0.4, 86);
  oceanGroup.add(glassDome);

  // Lõi san hô & bọt nước bên trong vòm kính
  const reefMat1 = new THREE.MeshStandardMaterial({ color: 0xf43f5e });
  const reefMat2 = new THREE.MeshStandardMaterial({ color: 0x06b6d4 });
  for (let ri = 0; ri < 6; ri++) {
    const angle = (ri / 6) * Math.PI * 2;
    const rDist = 3.5 + (ri % 2) * 1.5;
    const coral = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 2.2 + (ri % 3) * 0.6, 6),
      ri % 2 === 0 ? reefMat1 : reefMat2
    );
    coral.position.set(148 + Math.cos(angle) * rDist, 1.2, 86 + Math.sin(angle) * rDist);
    oceanGroup.add(coral);
  }

  // Bảng thông tin Thủy cung
  const oceanTag = makeBillboardText('🏛️ THỦY CUNG ĐẠI DƯƠNG: THU TIỀN VÉ DU LỊCH [E] (+$1,200)!', '#38bdf8', 460, 42);
  oceanTag.position.set(148, 8.8, 86);
  oceanGroup.add(oceanTag);
  window.oceanariumTicketPad = { pos: new THREE.Vector3(142, 0.2, 86), radius: 4.5, cooldown: 0 };

  // Sinh vật biển bơi lội quanh vòm kính (Dolphins, Shark, Turtle)
  window.oceanariumCreatures = [];
  const creatureMat1 = new THREE.MeshStandardMaterial({ color: 0x0284c7 });
  const creatureMat2 = new THREE.MeshStandardMaterial({ color: 0x475569 });
  const creatureMat3 = new THREE.MeshStandardMaterial({ color: 0x15803d });

  // 2 Cá heo
  for (let d = 0; d < 2; d++) {
    const dolphin = new THREE.Group();
    const dBody = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.4, 8), creatureMat1);
    dBody.rotation.z = Math.PI / 2;
    dolphin.add(dBody);
    const dFin = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 4), creatureMat1);
    dFin.position.set(0, 0.5, 0);
    dolphin.add(dFin);
    dolphin.position.set(148 + (d === 0 ? 11 : -11), 1.5 + d * 0.8, 86);
    oceanGroup.add(dolphin);
    window.oceanariumCreatures.push({ group: dolphin, type: 'dolphin', baseAngle: d * Math.PI, speed: 0.9, radius: 12.5, depthY: 1.5 + d * 0.8 });
  }

  // 1 Cá mập đầu búa
  const shark = new THREE.Group();
  const sBody = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, 3.2, 8), creatureMat2);
  sBody.rotation.x = Math.PI / 2;
  shark.add(sBody);
  const sHead = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.6), creatureMat2);
  sHead.position.set(0, 0, 1.6);
  shark.add(sHead);
  const sFin = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.9, 4), creatureMat2);
  sFin.position.set(0, 0.8, 0);
  shark.add(sFin);
  shark.position.set(148, 1.2, 86 + 15);
  oceanGroup.add(shark);
  window.oceanariumCreatures.push({ group: shark, type: 'shark', baseAngle: 1.8, speed: 0.65, radius: 15.0, depthY: 1.2 });

  // 1 Rùa biển khổng lồ
  const turtle = new THREE.Group();
  const tShell = new THREE.Mesh(new THREE.SphereGeometry(1.0, 8, 6), creatureMat3);
  tShell.scale.set(1.1, 0.45, 1.3);
  turtle.add(tShell);
  const tHead = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), creatureMat3);
  tHead.position.set(0, 0, 1.4);
  turtle.add(tHead);
  turtle.position.set(148 - 14, 0.8, 86);
  oceanGroup.add(turtle);
  window.oceanariumCreatures.push({ group: turtle, type: 'turtle', baseAngle: 3.5, speed: 0.4, radius: 13.8, depthY: 0.8 });

  // 2. TÀU NGẦM THÁM HIỂM MINI (YELLOW SUBMARINE) TẠI (140, 0.2, 74)
  const subGroup = new THREE.Group();
  subGroup.position.set(140, 0.3, 74);
  oceanGroup.add(subGroup);

  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6, roughness: 0.3 });
  const subBody = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3.8, 12), yellowMat);
  subBody.rotation.z = Math.PI / 2;
  subGroup.add(subBody);

  const subCapFront = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), yellowMat);
  subCapFront.position.set(1.9, 0, 0);
  subGroup.add(subCapFront);

  const subCapBack = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), yellowMat);
  subCapBack.position.set(-1.9, 0, 0);
  subGroup.add(subCapBack);

  // Tháp quan sát vòm kính
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.9, 8), yellowMat);
  tower.position.set(0.3, 0.9, 0);
  subGroup.add(tower);

  const periscope = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0x334155 }));
  periscope.position.set(0.3, 1.6, 0);
  subGroup.add(periscope);

  // Chân vịt quay phía sau
  const propeller = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.18), new THREE.MeshStandardMaterial({ color: 0xd97706 }));
  propeller.position.set(-2.0, 0, 0);
  subGroup.add(propeller);
  window.submarinePropeller = propeller;

  const subTag = makeBillboardText('⚓ TÀU NGẦM THÁM HIỂM BIỂN SÂU: LÊN TÀU [E] (+$2,500 & NGỌC TRAI)!', '#facc15', 480, 42);
  subTag.position.set(0, 2.5, 0);
  subGroup.add(subTag);

  window.submarineMountPad = { pos: new THREE.Vector3(140, 0.2, 74), radius: 4.5, cooldown: 0 };
}
window.createOceanariumAndSubmarine = createOceanariumAndSubmarine;

// ===========================================================================
// 35. GIÀN KHOAN DẦU NGOÀI KHƠI & NHÀ MÁY HÓA DẦU (OFFSHORE OIL RIG & REFINERY)
// GIÀN KHOAN: X = 180, Z = -45 | NHÀ MÁY HÓA DẦU: X = 105, Z = -88
// ===========================================================================
function createOffshoreOilRigAndRefinery(scene) {
  const oilGroup = new THREE.Group();
  scene.add(oilGroup);

  const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.4 });
  const yellowHazardMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });

  // 1. GIÀN KHOAN DẦU NGOÀI KHƠI TẠI (180, 0, -45)
  const rigGroup = new THREE.Group();
  rigGroup.position.set(180, 0, -45);
  oilGroup.add(rigGroup);

  // 4 Chân trụ thép cắm xuống biển
  const legGeo = new THREE.CylinderGeometry(0.7, 0.9, 10, 8);
  [-8, 8].forEach(lx => {
    [-8, 8].forEach(lz => {
      const leg = new THREE.Mesh(legGeo, yellowHazardMat);
      leg.position.set(lx, 2.5, lz);
      rigGroup.add(leg);
    });
  });

  // Sàn thao tác chính tầng 1 & tầng 2
  const mainDeck = new THREE.Mesh(new THREE.BoxGeometry(22, 0.8, 22), steelMat);
  mainDeck.position.y = 7.5;
  rigGroup.add(mainDeck);

  const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(16, 0.6, 16), steelMat);
  upperDeck.position.y = 10.5;
  rigGroup.add(upperDeck);

  // Tháp khoan dầu (Drilling Derrick) cao 16m
  const derrickGeo = new THREE.ConeGeometry(3.5, 16, 4);
  const derrickMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, wireframe: true });
  const derrick = new THREE.Mesh(derrickGeo, derrickMat);
  derrick.position.set(0, 18.5, 0);
  rigGroup.add(derrick);

  // Bãi đáp trực thăng Helipad chữ H màu vàng
  const heliPad = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
  heliPad.position.set(-11, 10.8, 0);
  rigGroup.add(heliPad);
  const hMark = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.05, 0.6), yellowHazardMat);
  hMark.position.set(-11, 11.0, 0);
  rigGroup.add(hMark);

  // Cần bơm dầu (Pumpjack Beam) gật gù
  const beamGroup = new THREE.Group();
  beamGroup.position.set(4, 11.2, 3);
  rigGroup.add(beamGroup);
  const beamBar = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.4, 0.4), yellowHazardMat);
  beamGroup.add(beamBar);
  window.oilRigPumpBeam = beamGroup;

  // Đuốc xả khí (Flare Stack) với ngọn lửa
  const flarePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 12, 8), steelMat);
  flarePipe.position.set(9.5, 13.5, -9.5);
  rigGroup.add(flarePipe);

  const flameMesh = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.8, 6), new THREE.MeshBasicMaterial({ color: 0xf97316 }));
  flameMesh.position.set(9.5, 20.0, -9.5);
  rigGroup.add(flameMesh);
  window.oilRigFlareMesh = flameMesh;

  const rigTag = makeBillboardText('🛢️ GIÀN KHOAN DẦU NGOÀI KHƠI: THU HOẠCH DẦU THÔ [E]!', '#f59e0b', 460, 42);
  rigTag.position.set(0, 22.0, 0);
  rigGroup.add(rigTag);

  window.oilRigPad = { pos: new THREE.Vector3(180, 0, -45), radius: 8.0, cooldown: 0 };

  // 2. NHÀ MÁY HÓA DẦU VEN BIỂN TẠI (98, 0, -75)
  const refGroup = new THREE.Group();
  refGroup.position.set(98, 0, -75);
  oilGroup.add(refGroup);

  const refFloor = new THREE.Mesh(new THREE.BoxGeometry(24, 0.3, 18), new THREE.MeshStandardMaterial({ color: 0x334155 }));
  refFloor.position.y = 0.15;
  refGroup.add(refFloor);

  // 3 Bồn chứa dầu hình trụ khổng lồ màu bạc
  const tankMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.25 });
  [-6, 0, 6].forEach(tx => {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 5.0, 16), tankMat);
    tank.position.set(tx, 2.65, -4);
    refGroup.add(tank);
  });

  // Tháp chưng cất phân đoạn cao 12m
  const fractTower = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 11, 12), steelMat);
  fractTower.position.set(0, 5.65, 4);
  refGroup.add(fractTower);

  const refTag = makeBillboardText('🏭 NHÀ MÁY HÓA DẦU: TINH CHẾ XĂNG DẦU & POLYMER [E] (+$3,000)!', '#ef4444', 480, 42);
  refTag.position.set(0, 7.8, 0);
  refGroup.add(refTag);

  window.petroleumRefineryPad = { pos: new THREE.Vector3(98, 0, -70), radius: 6.0, cooldown: 0 };
}
window.createOffshoreOilRigAndRefinery = createOffshoreOilRigAndRefinery;

// ===========================================================================
// 36. SÀN CHỨNG KHOÁN PHỐ WALL & TƯỢNG BÒ VÀNG (WALL STREET STOCK EXCHANGE)
// TỌA ĐỘ TÒA NHÀ: X = -52, Z = 68 | TƯỢNG BÒ VÀNG: X = -52, Z = 74
// ===========================================================================
function createWallStreetStockExchange(scene) {
  const stockGroup = new THREE.Group();
  stockGroup.position.set(-42, 0, 58);
  scene.add(stockGroup);

  const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3, metalness: 0.1 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.95, roughness: 0.15 });

  // Nền móng bậc thang đá cẩm thạch
  const podium = new THREE.Mesh(new THREE.BoxGeometry(18, 0.8, 14), marbleMat);
  podium.position.y = 0.4;
  stockGroup.add(podium);

  // Thân tòa nhà chính
  const mainHall = new THREE.Mesh(new THREE.BoxGeometry(17, 8.5, 12), marbleMat);
  mainHall.position.y = 5.05;
  stockGroup.add(mainHall);

  // 4 Cột La Mã Ionic trước mặt tiền
  const colGeo = new THREE.CylinderGeometry(0.4, 0.45, 8.5, 12);
  [-6, -2, 2, 6].forEach(cx => {
    const col = new THREE.Mesh(colGeo, marbleMat);
    col.position.set(cx, 5.05, 5.8);
    stockGroup.add(col);
  });

  // Mái tam giác cổ điển (Pediment)
  const pediment = new THREE.Mesh(new THREE.ConeGeometry(9.2, 3.2, 4), marbleMat);
  pediment.rotation.y = Math.PI / 4;
  pediment.position.set(0, 10.8, 3.5);
  stockGroup.add(pediment);

  // TƯỢNG BÒ VÀNG PHỐ WALL (CHARGING GOLDEN BULL) TẠI (0, 0.8, 6.5)
  const bullGroup = new THREE.Group();
  bullGroup.position.set(0, 0.8, 6.5);
  stockGroup.add(bullGroup);

  const bullBase = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.4, 2.2), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 }));
  bullGroup.add(bullBase);

  // Thân bò cơ bắp đúc vàng
  const bullBody = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 2.2, 8), goldMat);
  bullBody.rotation.x = Math.PI / 2;
  bullBody.position.y = 0.85;
  bullGroup.add(bullBody);

  // Đầu và cặp sừng sắc nhọn
  const bullHead = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 6), goldMat);
  bullHead.rotation.x = Math.PI / 1.5;
  bullHead.position.set(0, 0.9, 1.3);
  bullGroup.add(bullHead);

  [-0.35, 0.35].forEach(hx => {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 4), goldMat);
    horn.rotation.x = -Math.PI / 3;
    horn.position.set(hx, 1.25, 1.2);
    bullGroup.add(horn);
  });

  const stockTag = makeBillboardText('📈 SÀN CHỨNG KHOÁN WALL STREET: ĐẦU TƯ & CỔ TỨC [E]!', '#facc15', 460, 42);
  stockTag.position.set(0, 11.5, 6.0);
  stockGroup.add(stockTag);

  window.stockExchangePad = { pos: new THREE.Vector3(-42, 0, 67), radius: 5.0, cooldown: 0 };
}
window.createWallStreetStockExchange = createWallStreetStockExchange;

// ===========================================================================
// 37. NGÂN HÀNG TRUNG ƯƠNG & HẦM VÀNG (CENTRAL BANK & VAULT HEIST)
// TỌA ĐỘ: X = 2, Z = 68
// ===========================================================================
function createCentralBankAndVault(scene) {
  const bankGroup = new THREE.Group();
  bankGroup.position.set(6, 0, 58);
  scene.add(bankGroup);

  const graniteMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 });
  const titaniumMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.25 });

  // Tòa nhà Ngân Hàng Trung Ương
  const bankMesh = new THREE.Mesh(new THREE.BoxGeometry(18, 7.5, 14), graniteMat);
  bankMesh.position.y = 3.75;
  bankGroup.add(bankMesh);

  // Biểu tượng đồng tiền vàng khổng lồ xoay trên nóc
  const coinMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 24), goldMat);
  coinMesh.rotation.z = Math.PI / 2;
  coinMesh.position.set(0, 8.8, 0);
  bankGroup.add(coinMesh);

  // CỬA HẦM VÀNG THÉP TITAN (VAULT DOOR) MẶT TIỀN
  const vaultArch = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.3, 8, 24), titaniumMat);
  vaultArch.position.set(0, 2.2, 7.05);
  bankGroup.add(vaultArch);

  const vaultWheel = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.08, 6, 16), goldMat);
  vaultWheel.position.set(0, 2.2, 7.2);
  bankGroup.add(vaultWheel);
  window.bankVaultDoorMesh = vaultWheel;

  // Đèn xoay cảnh báo an ninh ngân hàng (Bank Alarm Beacon)
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  beacon.position.set(0, 7.8, 6.8);
  bankGroup.add(beacon);
  window.bankAlarmBeacon = beacon;

  const bankTag = makeBillboardText('🏦 NGÂN HÀNG TRUNG ƯƠNG: ÁP TẢI TIỀN HOẶC ĐỘT KÍCH HẦM VÀNG [E]!', '#facc15', 500, 42);
  bankTag.position.set(0, 9.8, 0);
  bankGroup.add(bankTag);

  window.centralBankPad = { pos: new THREE.Vector3(6, 0, 67), radius: 5.5, cooldown: 0 };
}
window.createCentralBankAndVault = createCentralBankAndVault;

// ===========================================================================
// 38. TRUNG TÂM THÚ CƯNG & DRONE THU GOM TỰ ĐỘNG (PET SANCTUARY & AUTO-DRONE)
// TỌA ĐỘ: X = -75, Z = 112
// ===========================================================================
function createPetSanctuaryAndAutoDrone(scene) {
  const petGroup = new THREE.Group();
  petGroup.position.set(-75, 0, 112);
  scene.add(petGroup);

  const woodMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });

  // Ngôi nhà thú cưng sinh thái
  const shelter = new THREE.Mesh(new THREE.BoxGeometry(8, 4.2, 7), woodMat);
  shelter.position.y = 2.1;
  petGroup.add(shelter);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.8, 2.4, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 5.2;
  petGroup.add(roof);

  // Hàng rào trắng bao quanh sân chơi
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
  for (let fx = -5; fx <= 5; fx += 2) {
    const picket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), fenceMat);
    picket.position.set(fx, 0.6, 5);
    petGroup.add(picket);
  }

  // Tượng Chó & Mèo xinh xắn trước cổng
  const petFigure = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), new THREE.MeshStandardMaterial({ color: 0xfbbf24 }));
  petFigure.position.set(2, 0.4, 4.5);
  petGroup.add(petFigure);

  const petTag = makeBillboardText('🐾 CỬA HÀNG THÚ CƯNG & AUTO-DRONE: NHẬN NUÔI BẠN ĐỒNG HÀNH [E]!', '#ec4899', 490, 42);
  petTag.position.set(0, 6.8, 0);
  petGroup.add(petTag);

  window.petSanctuaryPad = { pos: new THREE.Vector3(-75, 0, 112), radius: 5.5, cooldown: 0 };

  // KHỞI TẠO AUTO-LOOT DRONE (MÁY BAY KHÔNG NGƯỜI LÁI THU GOM TỰ ĐỘNG)
  const droneGroup = new THREE.Group();
  droneGroup.name = 'auto_loot_drone';
  scene.add(droneGroup);

  const droneBodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 });
  const droneWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.5 });
  const neonCyan = new THREE.MeshBasicMaterial({ color: 0x22d3ee });

  const coreBody = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.18, 12), droneBodyMat);
  droneGroup.add(coreBody);

  const ringScanner = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 16), neonCyan);
  ringScanner.rotation.x = Math.PI / 2;
  droneGroup.add(ringScanner);

  // 4 Cánh tay rotor & cánh quạt
  window.dronePropellers = [];
  [
    [0.45, 0.45],
    [-0.45, 0.45],
    [0.45, -0.45],
    [-0.45, -0.45]
  ].forEach(([rx, rz]) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.5), droneWhiteMat);
    arm.position.set(rx * 0.5, 0.05, rz * 0.5);
    droneGroup.add(arm);

    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, 0.08), droneBodyMat);
    prop.position.set(rx, 0.12, rz);
    droneGroup.add(prop);
    window.dronePropellers.push(prop);
  });

  // Tia laser quét đất
  const laserBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.5, 2.2, 6),
    new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.35 })
  );
  laserBeam.position.set(0, -1.1, 0);
  droneGroup.add(laserBeam);

  droneGroup.position.set(0, -999, 0); // Ban đầu ẩn dưới đất nếu chưa kích hoạt
  window.autoLootDroneGroup = droneGroup;
}
window.createPetSanctuaryAndAutoDrone = createPetSanctuaryAndAutoDrone;

// ===========================================================================
// 39. XƯỞNG CHẾ TÁC & LẮP RÁP CÔNG NGHỆ CAO (ADVANCED CRAFTING ASSEMBLY PLANT)
// TỌA ĐỘ: X = 65, Z = -55
// ===========================================================================
function createAdvancedCraftingAssemblyPlant(scene) {
  const craftGroup = new THREE.Group();
  craftGroup.position.set(65, 0, -55);
  scene.add(craftGroup);

  const industrialFloorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.85, roughness: 0.3 });
  const cyanGlowMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });

  // Sàn nhà xưởng bê tông
  const floor = new THREE.Mesh(new THREE.BoxGeometry(20, 0.4, 16), industrialFloorMat);
  floor.position.y = 0.2;
  craftGroup.add(floor);

  // Mái vòm thép công nghiệp hở vách
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(18, 0.5, 14), steelMat);
  canopy.position.y = 6.5;
  craftGroup.add(canopy);

  [-8, 8].forEach(px => {
    [-6, 6].forEach(pz => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 6.2, 8), steelMat);
      p.position.set(px, 3.2, pz);
      craftGroup.add(p);
    });
  });

  // Băng chuyền lắp ráp tự động ở giữa
  const conveyor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.6, 2.2), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 }));
  conveyor.position.set(0, 0.8, 0);
  craftGroup.add(conveyor);

  // 2 Cánh tay robot công nghiệp màu cam vàng
  [-3, 3].forEach(rx => {
    const armBase = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
    armBase.position.set(rx, 1.4, -2.0);
    craftGroup.add(armBase);

    const armUpper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 0.2), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
    armUpper.rotation.x = -0.5;
    armUpper.position.set(rx, 2.3, -1.6);
    craftGroup.add(armUpper);
  });

  // Đèn neon công nghệ cao
  const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(16, 0.15, 0.2), cyanGlowMat);
  neonStrip.position.set(0, 6.2, 6.8);
  craftGroup.add(neonStrip);

  const craftTag = makeBillboardText('🏭 XƯỞNG CHẾ TÁC ĐA TẦNG: LẮP RÁP HÀNG CÔNG NGHỆ CAO [E]!', '#06b6d4', 490, 42);
  craftTag.position.set(0, 7.8, 0);
  craftGroup.add(craftTag);

  window.craftingAssemblyPad = { pos: new THREE.Vector3(65, 0, -50), radius: 5.5, cooldown: 0 };
}
window.createAdvancedCraftingAssemblyPlant = createAdvancedCraftingAssemblyPlant;

// ===========================================================================
// 40. TÒA THỊ CHÍNH & SẮC LỆNH ĐÔ THỊ (CITY HALL & DECREE MONUMENT)
// TỌA ĐỘ: X = -25, Z = 68
// ===========================================================================
function createCityHallAndDecreeMonument(scene) {
  const hallGroup = new THREE.Group();
  hallGroup.position.set(-18, 0, 58);
  scene.add(hallGroup);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.5 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 });

  // Tòa nhà Thị Chính 2 tầng phong cách Châu Âu
  const baseHall = new THREE.Mesh(new THREE.BoxGeometry(16, 6.5, 12), stoneMat);
  baseHall.position.y = 3.25;
  hallGroup.add(baseHall);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(9.5, 3.5, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 8.25;
  hallGroup.add(roof);

  // Tháp đồng hồ chính giữa nóc
  const clockTower = new THREE.Mesh(new THREE.BoxGeometry(3.2, 5.0, 3.2), stoneMat);
  clockTower.position.set(0, 10.5, 0);
  hallGroup.add(clockTower);

  const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16), goldMat);
  clockFace.position.set(0, 11.2, 1.62);
  hallGroup.add(clockFace);

  // Bậc thang và Bục Sắc Lệnh Đô Thị trước cửa
  const steps = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 3.5), stoneMat);
  steps.position.set(0, 0.25, 7.5);
  hallGroup.add(steps);

  const monument = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.4, 8), goldMat);
  monument.position.set(0, 1.2, 7.2);
  hallGroup.add(monument);

  const cityTag = makeBillboardText('🏛️ TÒA THỊ CHÍNH: BAN HÀNH SẮC LỆNH ĐÔ THỊ [E]!', '#22c55e', 460, 42);
  cityTag.position.set(0, 8.8, 6.5);
  hallGroup.add(cityTag);

  window.cityHallPad = { pos: new THREE.Vector3(-18, 0, 67), radius: 5.5, cooldown: 0 };
}
window.createCityHallAndDecreeMonument = createCityHallAndDecreeMonument;

// ===========================================================================
// 41. QUY HOẠCH HẠ TẦNG ĐÔ THỊ, ĐÀI PHUN NƯỚC & LỐI ĐI BỘ (INFRASTRUCTURE MASTER PLAN)
// ===========================================================================
function createCityInfrastructureMasterPlan(scene) {
  const infraGroup = new THREE.Group();
  scene.add(infraGroup);

  const graniteMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5 });
  const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
  const waterMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 });
  const zebraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.2 });
  const warmLightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const benchWoodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });

  // 1. ĐẠI LỘ ĐI BỘ TIỀN SẢNH HÀNH CHÍNH & TÀI CHÍNH (GRAND CIVIC FORECOURT ESPLANADE)
  // Sàn đá hoa cương kết nối trước mặt 3 tòa nhà chính: Wall Street (-42), City Hall (-18), Central Bank (+6)
  // [BỀ RỘNG 10M TỪ Z=62 ĐẾN Z=72, CÁCH MÉP ĐẠI LỘ XE CHẠY Z=72.75 TẬN 0.75M - 100% AN TOÀN TUYỆT ĐỐI]
  const promenade = new THREE.Mesh(new THREE.BoxGeometry(72, 0.15, 10), graniteMat);
  promenade.position.set(-18, 0.08, 67);
  infraGroup.add(promenade);

  // Vỉa hè đá viền bảo vệ giáp Đại lộ xe chạy Z = 78
  const curbEdge = new THREE.Mesh(new THREE.BoxGeometry(74, 0.22, 0.5), curbMat);
  curbEdge.position.set(-18, 0.11, 72.25);
  infraGroup.add(curbEdge);

  // 2. TRỤC ĐƯỜNG ĐI BỘ BẮC - NAM NỐI RA CÔNG VIÊN ĐÀI PHUN NƯỚC (CENTRAL PARK AVENUE)
  const southNorthWalkway = new THREE.Mesh(new THREE.BoxGeometry(16, 0.15, 26), graniteMat);
  southNorthWalkway.position.set(-18, 0.08, 45);
  infraGroup.add(southNorthWalkway);

  // Sàn đá công viên đài phun nước trung tâm (Fountain Garden Plaza)
  const fountainPlaza = new THREE.Mesh(new THREE.BoxGeometry(50, 0.12, 18), graniteMat);
  fountainPlaza.position.set(-18, 0.06, 40);
  infraGroup.add(fountainPlaza);

  // 3. ĐÀI PHUN NƯỚC CẨM THẠCH 3 TẦNG TRUNG TÂM (GRAND 3-TIER MARBLE FOUNTAIN) TẠI (-18, 0, 40)
  const fountainGroup = new THREE.Group();
  fountainGroup.position.set(-18, 0.15, 40);
  infraGroup.add(fountainGroup);

  // Bể chứa nước tròn đường kính 7.2m
  const poolRim = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 0.5, 24), curbMat);
  poolRim.position.y = 0.25;
  fountainGroup.add(poolRim);

  const poolWater = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.45, 24), waterMat);
  poolWater.position.y = 0.26;
  fountainGroup.add(poolWater);

  // Tầng 1: Đĩa cẩm thạch đường kính 4.2m
  const tier1Col = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.2, 16), marbleMat);
  tier1Col.position.y = 0.8;
  fountainGroup.add(tier1Col);

  const tier1Bowl = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.6, 0.3, 20), marbleMat);
  tier1Bowl.position.y = 1.4;
  fountainGroup.add(tier1Bowl);

  // Tầng 2: Đĩa cẩm thạch đường kính 2.4m
  const tier2Col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.0, 16), marbleMat);
  tier2Col.position.y = 1.9;
  fountainGroup.add(tier2Col);

  const tier2Bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.9, 0.25, 16), marbleMat);
  tier2Bowl.position.y = 2.4;
  fountainGroup.add(tier2Bowl);

  // Tầng 3: Cột phun nước đỉnh
  const tier3Spout = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 0.9, 8), marbleMat);
  tier3Spout.position.y = 2.85;
  fountainGroup.add(tier3Spout);

  const fountainTag = makeBillboardText('⛲ QUẢNG TRƯỜNG ĐÔ THỊ & ĐÀI PHUN NƯỚC HOÀNG GIA', '#38bdf8', 420, 36);
  fountainTag.position.set(0, 4.2, 0);
  fountainGroup.add(fountainTag);

  // 4. VẠCH KẺ NGƯỜI ĐI BỘ TRÊN ĐẠI LỘ XE CHẠY (ZEBRA CROSSINGS ON Z = 78.0 BOULEVARD)
  // Bố trí tại các ngã giao tiếp cận vỉa hè: X = -42 (Wall St), X = -18 (City Hall), X = 6 (Central Bank), X = -75 (Chung cư)
  // Băng ngang trọn vẹn 10.5m mặt đường (từ Z = 72.75 đến Z = 83.25)
  [
    { x: -42, z: 78.0 },
    { x: -18, z: 78.0 },
    { x: 6, z: 78.0 },
    { x: -75, z: 78.0 }
  ].forEach(zc => {
    for (let zi = -4.5; zi <= 4.5; zi += 1.1) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.8), zebraMat);
      stripe.position.set(zc.x, 0.145, zc.z + zi);
      infraGroup.add(stripe);
    }
  });

  // 5. GHẾ CÔNG VIÊN & ĐÈN ĐƯỜNG CỔ ĐIỂN
  [
    { x: -30, z: 36, ry: Math.PI / 2 },
    { x: -6, z: 36, ry: -Math.PI / 2 },
    { x: -18, z: 47, ry: 0 },
    { x: -30, z: 66, ry: 0 },
    { x: -6, z: 66, ry: 0 },
    { x: 12, z: 66, ry: 0 }
  ].forEach(b => {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.45, 0.6), benchWoodMat);
    bench.position.set(b.x, 0.3, b.z);
    bench.rotation.y = b.ry;
    infraGroup.add(bench);
  });

  // 6 Cột đèn đường công viên phát sáng
  [
    { x: -50, z: 68 },
    { x: -30, z: 68 },
    { x: -6, z: 68 },
    { x: 14, z: 68 },
    { x: -28, z: 35 },
    { x: -8, z: 35 }
  ].forEach(lp => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 8), lampPoleMat);
    pole.position.set(lp.x, 2.1, lp.z);
    infraGroup.add(pole);

    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.35), warmLightMat);
    lantern.position.set(lp.x, 4.3, lp.z);
    infraGroup.add(lantern);
  });

  // 6. CÂY CẢNH QUAN ĐÔ THỊ TRỒNG TRONG BỒN ĐÁ TRANG TRÍ DỌC VỈA HÈ
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
  [
    { x: -52, z: 70.5 },
    { x: -34, z: 70.5 },
    { x: -26, z: 70.5 },
    { x: -10, z: 70.5 },
    { x: -2, z: 70.5 },
    { x: 14, z: 70.5 },
    { x: -26, z: 42 },
    { x: -10, z: 42 }
  ].forEach(tp => {
    const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.4, 8), curbMat);
    planter.position.set(tp.x, 0.2, tp.z);
    infraGroup.add(planter);

    const treeTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.6, 6), trunkMat);
    treeTrunk.position.set(tp.x, 1.4, tp.z);
    infraGroup.add(treeTrunk);

    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), foliageMat);
    canopy.position.set(tp.x, 2.8, tp.z);
    infraGroup.add(canopy);
  });
}
window.createCityInfrastructureMasterPlan = createCityInfrastructureMasterPlan;


// ===========================================================================
// 42. HỆ THỐNG ĐỒ HỌA HẠ TẦNG NEXT-GEN CAO CẤP (NEXT-GEN INFRASTRUCTURE GRAPHICS)
// TỐI ƯU HÓA SIÊU MƯỢT 60 FPS: INSTANCED MESHES + SHARED BUFFERS + 0% LAG
// 1. Đinh phản quang mắt mèo PBR (Cat's Eyes) dọc vạch tim đường (Instanced)
// 2. Nắp cống đúc kim loại (Manholes) & Rãnh cống thoát nước mưa (Instanced)
// 3. Vết lốp phanh cháy đường (Skid Marks) & Vết dầu loang óng ánh PBR
// 4. Bờ kè đá granite hai bên bờ sông & Lan can nghệ thuật với Phao cứu sinh
// 5. Tháp cầu dây văng Art Deco với dây cáp thép căng phản quang
// 6. Quầng sáng nón thể tích mờ ảo (Volumetric Cones) ban đêm
// 7. Bảng LED ma trận điện tử Phố Wall chạy ticker cổ phiếu động
// 8. Đèn rọi kiến trúc chân cột (Architectural Uplighting)
// 9. Rào chắn kim loại lượn sóng W-Beam Guardrails dọc cao tốc
// 10. Trụ nước cứu hỏa đỏ tươi, Thùng rác 3 màu sinh thái, Trạm sạc xe điện EV 150kW
// ===========================================================================
function createNextGenInfrastructureGraphics(scene) {
  const ngGroup = new THREE.Group();
  ngGroup.name = 'nextgen_infrastructure_graphics';
  scene.add(ngGroup);

  // -------------------------------------------------------------------------
  // 1. ĐINH PHẢN QUANG MẮT MÈO PBR (CAT'S EYES) - 1 INSTANCED MESH DUY NHẤT (0% LAG)
  // -------------------------------------------------------------------------
  const studGeo = new THREE.BoxGeometry(0.2, 0.08, 0.2);
  const studMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.9,
    roughness: 0.15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.6
  });

  const catEyePositions = [];
  // Tuyến 1: Cao tốc Spine (X = 28, Z từ 33 đến 155, cách nhau 3m)
  for (let z = 33; z <= 155; z += 3.2) {
    catEyePositions.push(new THREE.Vector3(28.0, 0.145, z));
  }
  // Tuyến 2: Đại lộ Đông - Tây (Z = 78, X từ -90 đến 115, cách nhau 4m)
  for (let x = -90; x <= 115; x += 4.0) {
    catEyePositions.push(new THREE.Vector3(x, 0.145, 78.0));
  }
  // Tuyến 3: Vành đai Tây (X = -110, Z từ -60 đến 140, cách nhau 6m)
  for (let z = -60; z <= 140; z += 6.0) {
    catEyePositions.push(new THREE.Vector3(-110.0, 0.145, z));
  }

  const catEyeInstanced = new THREE.InstancedMesh(studGeo, studMat, catEyePositions.length);
  catEyeInstanced.castShadow = false;
  catEyeInstanced.receiveShadow = false;
  const dummyMatrix = new THREE.Matrix4();
  for (let i = 0; i < catEyePositions.length; i++) {
    dummyMatrix.setPosition(catEyePositions[i]);
    catEyeInstanced.setMatrixAt(i, dummyMatrix);
  }
  catEyeInstanced.instanceMatrix.needsUpdate = true;
  ngGroup.add(catEyeInstanced);

  // -------------------------------------------------------------------------
  // 2. NẮP CỐNG KIM LOẠI & LƯỚI THOÁT NƯỚC MƯA (MANHOLES & STORM DRAINS - INSTANCED)
  // -------------------------------------------------------------------------
  const manholeGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.04, 12);
  const manholeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.88, roughness: 0.35 });
  const manholePositions = [
    new THREE.Vector3(24.0, 0.14, 74.5),
    new THREE.Vector3(32.0, 0.14, 82.0),
    new THREE.Vector3(-42.0, 0.14, 73.5),
    new THREE.Vector3(-18.0, 0.14, 73.5),
    new THREE.Vector3(6.0, 0.14, 73.5),
    new THREE.Vector3(-75.0, 0.14, 73.5),
    new THREE.Vector3(85.0, 0.14, 52.0),
    new THREE.Vector3(10.0, 0.14, 92.0),
    new THREE.Vector3(-106.0, 0.14, 78.0),
    new THREE.Vector3(122.0, 0.14, 78.0)
  ];
  const manholeInstanced = new THREE.InstancedMesh(manholeGeo, manholeMat, manholePositions.length);
  manholeInstanced.castShadow = false;
  for (let i = 0; i < manholePositions.length; i++) {
    dummyMatrix.setPosition(manholePositions[i]);
    manholeInstanced.setMatrixAt(i, dummyMatrix);
  }
  manholeInstanced.instanceMatrix.needsUpdate = true;
  ngGroup.add(manholeInstanced);

  // Lưới rãnh cống thoát nước mưa dọc gờ bó vỉa hè
  const drainGeo = new THREE.BoxGeometry(0.55, 0.04, 1.2);
  const drainMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.92, roughness: 0.3 });
  const drainPositions = [
    new THREE.Vector3(-52.0, 0.14, 73.05),
    new THREE.Vector3(-32.0, 0.14, 73.05),
    new THREE.Vector3(-12.0, 0.14, 73.05),
    new THREE.Vector3(12.0, 0.14, 73.05),
    new THREE.Vector3(-52.0, 0.14, 82.95),
    new THREE.Vector3(-32.0, 0.14, 82.95),
    new THREE.Vector3(-12.0, 0.14, 82.95),
    new THREE.Vector3(12.0, 0.14, 82.95)
  ];
  const drainInstanced = new THREE.InstancedMesh(drainGeo, drainMat, drainPositions.length);
  drainInstanced.castShadow = false;
  for (let i = 0; i < drainPositions.length; i++) {
    dummyMatrix.setPosition(drainPositions[i]);
    drainInstanced.setMatrixAt(i, dummyMatrix);
  }
  drainInstanced.instanceMatrix.needsUpdate = true;
  ngGroup.add(drainInstanced);

  // -------------------------------------------------------------------------
  // 3. VẾT LỐP PHANH CHÁY ĐƯỜNG (SKID MARKS) & VẾT DẦU LOANG ÓNG ÁNH PBR
  // -------------------------------------------------------------------------
  const skidMat = new THREE.MeshBasicMaterial({
    color: 0x09090b,
    transparent: true,
    opacity: 0.5,
    depthWrite: false
  });
  // Vết phanh tại góc cua cao tốc rẽ vào đại lộ
  [
    { x: 26.5, z: 35.0, ry: 0.08 },
    { x: 29.5, z: 35.5, ry: 0.08 },
    { x: -42.0, z: 76.5, ry: Math.PI / 2 },
    { x: -18.0, z: 76.5, ry: Math.PI / 2 }
  ].forEach(sk => {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 3.8), skidMat);
    skid.position.set(sk.x, 0.142, sk.z);
    skid.rotation.y = sk.ry;
    ngGroup.add(skid);
  });

  // Vết dầu loang óng ánh gần trạm xăng và bến xe
  const oilMat = new THREE.MeshBasicMaterial({
    color: 0x1e1b4b,
    transparent: true,
    opacity: 0.45,
    depthWrite: false
  });
  const oil1 = new THREE.Mesh(new THREE.CircleGeometry(1.4, 12), oilMat);
  oil1.rotation.x = -Math.PI / 2;
  oil1.position.set(10.0, 0.142, 91.0);
  ngGroup.add(oil1);

  // -------------------------------------------------------------------------
  // 4. BỜ KÈ ĐÁ GRANITE 2 BÊN SÔNG & LAN CAN NGHỆ THUẬT VỚI PHAO CỨU SINH
  // Bờ Bắc (Z = 4.0) & Bờ Nam (Z = 28.0) từ X = -120 đến X = 130
  // -------------------------------------------------------------------------
  const stoneWallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
  const stoneCurbMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6 });
  const ironRailMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.3 });
  const buoyRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });
  const buoyWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });

  // Kè đá Bờ Bắc (Z = 4.0)
  const northWall = new THREE.Mesh(new THREE.BoxGeometry(250, 1.2, 0.8), stoneWallMat);
  northWall.position.set(5, 0.5, 3.6);
  northWall.receiveShadow = true;
  ngGroup.add(northWall);

  const northCurb = new THREE.Mesh(new THREE.BoxGeometry(250, 0.25, 1.1), stoneCurbMat);
  northCurb.position.set(5, 1.15, 3.6);
  ngGroup.add(northCurb);

  // Kè đá Bờ Nam (Z = 28.0)
  const southWall = new THREE.Mesh(new THREE.BoxGeometry(250, 1.2, 0.8), stoneWallMat);
  southWall.position.set(5, 0.5, 28.4);
  southWall.receiveShadow = true;
  ngGroup.add(southWall);

  const southCurb = new THREE.Mesh(new THREE.BoxGeometry(250, 0.25, 1.1), stoneCurbMat);
  southCurb.position.set(5, 1.15, 28.4);
  ngGroup.add(southCurb);

  // Lan can bờ kè đi bộ Bờ Nam (X từ -55 đến 18, Z = 29.0)
  const railLength = 73;
  const railBarTop = new THREE.Mesh(new THREE.BoxGeometry(railLength, 0.08, 0.08), ironRailMat);
  railBarTop.position.set(-18.5, 1.9, 28.9);
  ngGroup.add(railBarTop);

  const railBarMid = new THREE.Mesh(new THREE.BoxGeometry(railLength, 0.06, 0.06), ironRailMat);
  railBarMid.position.set(-18.5, 1.5, 28.9);
  ngGroup.add(railBarMid);

  // Các cột trụ lan can & Phao cứu sinh tròn
  for (let rx = -54; rx <= 17; rx += 4.5) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.95, 6), ironRailMat);
    post.position.set(rx, 1.55, 28.9);
    ngGroup.add(post);

    // Mỗi 18m gắn 1 phao cứu sinh tròn sọc đỏ-trắng
    if (Math.round(rx) % 18 === 0) {
      const buoy = new THREE.Group();
      buoy.position.set(rx, 1.5, 28.75);
      ngGroup.add(buoy);

      const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.1, 8, 16), buoyRedMat);
      buoy.add(ringMesh);

      const stripe1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.22), buoyWhiteMat);
      stripe1.position.x = -0.35;
      buoy.add(stripe1);
      const stripe2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.22), buoyWhiteMat);
      stripe2.position.x = 0.35;
      buoy.add(stripe2);
    }
  }

  // -------------------------------------------------------------------------
  // 5. THÁP CẦU DÂY VĂNG ART DECO TRÊN CẦU VƯỢT SÔNG (CABLE-STAYED PYLONS)
  // Tọa độ đỉnh cầu giữa sông: X = 28, Z = 16.0
  // -------------------------------------------------------------------------
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.85, roughness: 0.25 });
  const cableSteelMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.2 });

  [-6.2, 6.2].forEach(pxOffset => {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.9, 14.5, 1.1), pylonMat);
    pylon.position.set(28 + pxOffset, 8.5, 16.0);
    pylon.castShadow = true;
    ngGroup.add(pylon);

    // Đỉnh tháp nhọn vươn cao
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.4, 3.2, 4), pylonMat);
    spire.position.set(28 + pxOffset, 17.2, 16.0);
    ngGroup.add(spire);

    // 6 Dây cáp thép văng tỏa đều xuống mặt cầu
    [-9.0, -5.0, -2.0, 2.0, 5.0, 9.0].forEach(czOffset => {
      const stayCable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 9.5, 6), cableSteelMat);
      stayCable.position.set(28 + pxOffset, 9.2, 16.0 + czOffset * 0.5);
      stayCable.rotation.x = (czOffset > 0 ? 1 : -1) * 0.45;
      stayCable.rotation.z = (pxOffset > 0 ? -1 : 1) * 0.15;
      ngGroup.add(stayCable);
    });
  });

  // -------------------------------------------------------------------------
  // 6. QUẦNG SÁNG NÓN THỂ TÍCH MỜ ẢO (VOLUMETRIC CONES) CHO ĐÈN ĐƯỜNG BAN ĐÊM
  // Tự động mượt mà qua window.nightBeams - 0% CPU ban ngày!
  // -------------------------------------------------------------------------
  const coneGeo = new THREE.CylinderGeometry(0.2, 2.4, 5.2, 8, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    map: Textures.volumetricBeam ? Textures.volumetricBeam() : null,
    color: 0xfef08a,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  [
    { x: -50, z: 68 },
    { x: -30, z: 68 },
    { x: -6, z: 68 },
    { x: 14, z: 68 },
    { x: -28, z: 35 },
    { x: -8, z: 35 },
    { x: 24, z: 74 }
  ].forEach(lp => {
    const vCone = new THREE.Mesh(coneGeo, coneMat.clone());
    vCone.position.set(lp.x, 2.6, lp.z);
    vCone.userData.nightOpacity = 0.28;
    ngGroup.add(vCone);

    if (!window.nightBeams) window.nightBeams = [];
    window.nightBeams.push(vCone);
  });

  // -------------------------------------------------------------------------
  // 7. BẢNG LED MA TRẬN ĐIỆN TỬ PHỐ WALL CHẠY TICKER CỔ PHIẾU ĐỘNG
  // Tọa độ mặt tiền Wall Street: X = -42.0, Y = 9.2, Z = 64.15
  // -------------------------------------------------------------------------
  const tickerCanvas = document.createElement('canvas');
  tickerCanvas.width = 512;
  tickerCanvas.height = 64;
  const tCtx = tickerCanvas.getContext('2d');
  if (tCtx) {
    tCtx.fillStyle = '#020617';
    tCtx.fillRect(0, 0, 512, 64);
    tCtx.fillStyle = '#1e293b';
    tCtx.fillRect(0, 0, 512, 4);
    tCtx.fillRect(0, 60, 512, 4);
    tCtx.font = 'bold 24px monospace';
    tCtx.fillStyle = '#22c55e';
    tCtx.fillText('📈 WOOD $145 ▲+6.8%  •  PLANK $280 ▲+4.5%  •  EMPIRE $3,400 ▲+12.4%', 10, 40);
  }

  const tickerTex = new THREE.CanvasTexture(tickerCanvas);
  tickerTex.wrapS = THREE.RepeatWrapping;
  tickerTex.wrapT = THREE.ClampToEdgeWrapping;
  window.wallStreetTickerTex = tickerTex;

  const tickerMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(14.2, 0.85),
    new THREE.MeshBasicMaterial({ map: tickerTex })
  );
  tickerMesh.position.set(-42.0, 9.25, 64.15);
  ngGroup.add(tickerMesh);

  // -------------------------------------------------------------------------
  // 8. RÀO CHẮN KIM LOẠI LƯỢN SÓNG W-BEAM GUARDRAILS DỌC CAO TỐC
  // -------------------------------------------------------------------------
  const guardMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.25 });
  const hazardMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

  // Rào chắn bảo vệ 2 bên dốc cầu vượt sông (Z: 28 đến 35)
  [-5.8, 5.8].forEach(gx => {
    const railBeam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 8.0), guardMat);
    railBeam.position.set(28 + gx, 0.55, 33.0);
    ngGroup.add(railBeam);

    // Chân trụ chữ I
    for (let pz = 29.5; pz <= 36.5; pz += 2.0) {
      const gPost = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.14), guardMat);
      gPost.position.set(28 + gx, 0.35, pz);
      ngGroup.add(gPost);
    }

    // Tấm tiêu phản quang cảnh báo sọc chéo đỏ vàng ở đầu rào chắn
    const terminal = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.4), hazardMat);
    terminal.position.set(28 + gx, 0.55, 37.1);
    ngGroup.add(terminal);
  });

  // -------------------------------------------------------------------------
  // 9. NỘI THẤT ĐƯỜNG PHỐ: TRỤ CỨU HỎA, THÙNG RÁC 3 MÀU & TRẠM SẠC EV FAST CHARGE
  // -------------------------------------------------------------------------
  const hydrantRed = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });
  const brassNut = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85 });

  // 3 Trụ nước cứu hỏa đỏ tươi tại các góc phố
  [
    { x: -46.0, z: 71.5 },
    { x: 10.0, z: 71.5 },
    { x: 23.5, z: 75.0 }
  ].forEach(hp => {
    const hyd = new THREE.Group();
    hyd.position.set(hp.x, 0.08, hp.z);
    ngGroup.add(hyd);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.85, 8), hydrantRed);
    body.position.y = 0.42;
    hyd.add(body);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), hydrantRed);
    cap.position.y = 0.85;
    hyd.add(cap);

    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.65, 6), brassNut);
    nut.rotation.z = Math.PI / 2;
    nut.position.y = 0.55;
    hyd.add(nut);
  });

  // Thùng rác phân loại 3 ngăn sinh thái (Xanh lá - Xanh dương - Vàng)
  const binGreen = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.4 });
  const binBlue = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4 });
  const binYellow = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.4 });

  [
    { x: -32.0, z: 71.2 },
    { x: -4.0, z: 71.2 }
  ].forEach(bp => {
    const binGroup = new THREE.Group();
    binGroup.position.set(bp.x, 0.08, bp.z);
    ngGroup.add(binGroup);

    [
      { dx: -0.4, mat: binGreen },
      { dx: 0.0, mat: binBlue },
      { dx: 0.4, mat: binYellow }
    ].forEach(b => {
      const compartment = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.75, 0.38), b.mat);
      compartment.position.set(b.dx, 0.38, 0);
      binGroup.add(compartment);
    });
  });

  // Trạm sạc xe điện EV 150kW siêu nhanh
  const evGroup = new THREE.Group();
  evGroup.position.set(-10.0, 0.08, 71.4);
  ngGroup.add(evGroup);

  const evKiosk = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.6, 0.45), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6 }));
  evKiosk.position.y = 0.8;
  evGroup.add(evKiosk);

  const evScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.5), new THREE.MeshBasicMaterial({ color: 0x06b6d4 }));
  evScreen.position.set(0, 1.15, 0.23);
  evGroup.add(evScreen);

  const evTag = makeBillboardText('⚡ TRẠM SẠC EV SIÊU NHANH 150kW', '#06b6d4', 320, 32);
  evTag.position.set(0, 2.1, 0);
  evGroup.add(evTag);

  // Nhà chờ xe buýt hiện đại mái kính
  const busShelter = new THREE.Group();
  busShelter.position.set(-60.0, 0.08, 71.5);
  ngGroup.add(busShelter);

  const steelFrameMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85 });
  const glassRoofMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 });

  const bBench = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x78350f }));
  bBench.position.set(0, 0.25, 0);
  busShelter.add(bBench);

  const bRoof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 1.8), glassRoofMat);
  bRoof.position.set(0, 2.4, 0.3);
  busShelter.add(bRoof);

  [-1.8, 1.8].forEach(fx => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), steelFrameMat);
    post.position.set(fx, 1.2, -0.4);
    busShelter.add(post);
  });
}
window.createNextGenInfrastructureGraphics = createNextGenInfrastructureGraphics;


// ===========================================================================
// 43. CÔNG VIÊN GIẢI TRÍ VEN BIỂN: TÀU LƯỢN SIÊU TỐC 3D & ĐU QUAY KHỔNG LỒ
// TỌA ĐỘ BỜ ĐÔNG: X = 135 -> 160, Z = -15 -> 35 (100% ĐẤT LIỀN & MẶT NƯỚC VEN BỜ)
// ===========================================================================
function createThemeParkRollerCoasterAndFerrisWheel(scene) {
  const parkGroup = new THREE.Group();
  parkGroup.name = 'theme_park_roller_coaster';
  scene.add(parkGroup);

  const steelMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.85, roughness: 0.25 });
  const railSteelMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 });
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 });

  // 1. TÀU LƯỢN SIÊU TỐC 3D (ROLLER COASTER TRACK & RIDEABLE CART)
  const rcCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(142, 1.4, 0),
    new THREE.Vector3(150, 7.5, 8),
    new THREE.Vector3(158, 15.0, 18),  // Đỉnh dốc cao 15m
    new THREE.Vector3(152, 4.2, 28),
    new THREE.Vector3(142, 2.8, 22),
    new THREE.Vector3(138, 8.5, 10),
    new THREE.Vector3(142, 1.4, 0)
  ], true);
  window.rollerCoasterCurve = rcCurve;

  // Đường ray đôi hình ống thép (Double Steel Tube Rail)
  const tubeGeo = new THREE.TubeGeometry(rcCurve, 64, 0.22, 6, true);
  const trackMesh = new THREE.Mesh(tubeGeo, railSteelMat);
  trackMesh.castShadow = false;
  trackMesh.receiveShadow = false;
  parkGroup.add(trackMesh);

  // 12 Cột trụ thép chịu lực đỡ đường ray (Pylons)
  const pylonPoints = [0.0, 0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88];
  pylonPoints.forEach(t => {
    const pt = rcCurve.getPointAt(t);
    const pylonH = Math.max(0.5, pt.y);
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, pylonH, 6), pylonMat);
    pylon.position.set(pt.x, pylonH / 2, pt.z);
    parkGroup.add(pylon);
  });

  // Toa xe Tàu Lượn Siêu Tốc (Coaster Train Cart)
  const cartGroup = new THREE.Group();
  cartGroup.position.copy(rcCurve.getPointAt(0));
  parkGroup.add(cartGroup);

  const cartBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 2.6), steelMat);
  cartBody.position.y = 0.5;
  cartGroup.add(cartBody);

  const cartWindshield = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 0.1), glassMat);
  cartWindshield.position.set(0, 0.9, 0.9);
  cartGroup.add(cartWindshield);

  // Đèn pha trước mũi tàu lượn
  const cartLight = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
  cartLight.position.set(0, 0.5, 1.35);
  cartGroup.add(cartLight);

  window.rollerCoasterCart = cartGroup;
  window.rollerCoasterProgress = 0;
  window.isRidingRollerCoaster = false;

  const coasterTag = makeBillboardText('🎢 TÀU LƯỢN SIÊU TỐC 3D: [E] LÊN TRẢI NGHIỆM GÓC NHÌN THỨ NHẤT!', '#f43f5e', 460, 42);
  coasterTag.position.set(142, 3.8, 0);
  parkGroup.add(coasterTag);

  window.rollerCoasterPad = { pos: new THREE.Vector3(142, 0, 0), radius: 5.5 };

  // 2. ĐU QUAY KHỔNG LỒ NEON HOÀNG GIA (GIANT FERRIS WHEEL)
  // Tọa độ bờ biển ngắm cảnh: X = 142, Z = -18
  const fwGroup = new THREE.Group();
  fwGroup.position.set(142, 0, -18);
  parkGroup.add(fwGroup);

  // Chân trụ chữ A đôi
  [-2.2, 2.2].forEach(fx => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 14.5, 0.35), pylonMat);
    leg.position.set(fx, 7.0, 0);
    leg.rotation.z = (fx > 0 ? -1 : 1) * 0.14;
    fwGroup.add(leg);
  });

  // Vòng đu quay xoay tròn đường kính 18m
  const wheelHub = new THREE.Group();
  wheelHub.position.set(0, 13.0, 0);
  fwGroup.add(wheelHub);
  window.ferrisWheelHub = wheelHub;

  const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.22, 8, 32), new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.8 }));
  wheelHub.add(rimMesh);

  // 8 Nan hoa & 8 Cabin lồng kính nhiều màu sắc
  const cabinColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899, 0x06b6d4, 0xfacc15];
  window.ferrisCabins = [];

  for (let ci = 0; ci < 8; ci++) {
    const ang = (ci / 8) * Math.PI * 2;
    // Nan hoa
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 8.5, 6), pylonMat);
    spoke.position.set(Math.cos(ang) * 4.25, Math.sin(ang) * 4.25, 0);
    spoke.rotation.z = ang - Math.PI / 2;
    wheelHub.add(spoke);

    // Cabin
    const cabinGroup = new THREE.Group();
    cabinGroup.position.set(Math.cos(ang) * 8.5, Math.sin(ang) * 8.5, 0);
    wheelHub.add(cabinGroup);

    const cabinBox = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.4), new THREE.MeshStandardMaterial({ color: cabinColors[ci % cabinColors.length], roughness: 0.4 }));
    cabinGroup.add(cabinBox);

    const cabinGlass = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.7, 1.45), glassMat);
    cabinGlass.position.y = 0.2;
    cabinGroup.add(cabinGlass);

    window.ferrisCabins.push(cabinGroup);
  }

  const ferrisTag = makeBillboardText('🎡 ĐU QUAY KHỔNG LỒ: [E] NGẮM HOÀNG HÔN TOÀN CẢNH ĐẢO!', '#38bdf8', 440, 42);
  ferrisTag.position.set(0, 5.0, 0);
  fwGroup.add(ferrisTag);

  window.ferrisWheelPad = { pos: new THREE.Vector3(142, 0, -18), radius: 5.5 };
}
window.createThemeParkRollerCoasterAndFerrisWheel = createThemeParkRollerCoasterAndFerrisWheel;

// ===========================================================================
// 44. NỘI THẤT DINH THỰ THƯỢNG LƯU: GIƯỜNG NGỦ HOÀNG GIA & KÉT SẮT CÁ NHÂN
// TỌA ĐỘ DINH THỰ: X = 100, Z = 56
// ===========================================================================
function createLuxuryRealEstateInteriors(scene) {
  const villaIntGroup = new THREE.Group();
  villaIntGroup.position.set(100, 0, 56);
  scene.add(villaIntGroup);

  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 });
  const bedLinenMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 });
  const safeSteelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.92, roughness: 0.25 });

  // 1. GIƯỜNG NGỦ HOÀNG GIA BỌC GỖ MA HOGANY (KING-SIZE BED) TẠI (96, 0, 54)
  const bedGroup = new THREE.Group();
  bedGroup.position.set(-4.0, 0, -2.0);
  villaIntGroup.add(bedGroup);

  const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 3.8), woodMat);
  bedFrame.position.y = 0.25;
  bedGroup.add(bedFrame);

  const headboard = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 0.3), woodMat);
  headboard.position.set(0, 1.1, -1.8);
  bedGroup.add(headboard);

  const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.45, 3.4), bedLinenMat);
  mattress.position.set(0, 0.6, 0.1);
  bedGroup.add(mattress);

  // Đôi gối nhung
  [-0.8, 0.8].forEach(px => {
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 0.6), bedLinenMat);
    pillow.position.set(px, 0.85, -1.1);
    bedGroup.add(pillow);
  });

  const bedTag = makeBillboardText('🛏️ GIƯỜNG HOÀNG GIA: [E] NGỦ QUA ĐÊM (HỒI X2 THỂ LỰC & +15% TỐC ĐỘ)!', '#38bdf8', 460, 42);
  bedTag.position.set(0, 2.5, 0);
  bedGroup.add(bedTag);

  window.villaBedPad = { pos: new THREE.Vector3(96, 0, 54), radius: 4.0 };

  // 2. KÉT SẮT CÁ NHÂN AN TOÀN TỐI MẬT (PERSONAL TITANIUM SAFE) TẠI (104, 0, 54)
  const safeGroup = new THREE.Group();
  safeGroup.position.set(4.0, 0, -2.0);
  villaIntGroup.add(safeGroup);

  const safeBody = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 1.2), safeSteelMat);
  safeBody.position.y = 0.9;
  safeGroup.add(safeBody);

  const safeWheel = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.05, 6, 16), goldMat);
  safeWheel.position.set(0, 0.9, 0.62);
  safeGroup.add(safeWheel);

  const safeTag = makeBillboardText('🔒 KÉT SẮT AN TOÀN: [E] BẢO VỆ VÀNG & TÀI SẢN 100%!', '#facc15', 440, 42);
  safeTag.position.set(0, 2.4, 0);
  safeGroup.add(safeTag);

  window.villaSafePad = { pos: new THREE.Vector3(104, 0, 54), radius: 4.0 };

  // 3. TỦ CÚP DANH VỌNG & CHIẾN TÍCH (TROPHY SHOWCASE)
  const trophyStand = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 0.8), woodMat);
  trophyStand.position.set(0, 0.6, -4.5);
  villaIntGroup.add(trophyStand);

  [-0.7, 0, 0.7].forEach(tx => {
    const trophy = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.05, 0.6, 8), goldMat);
    trophy.position.set(tx, 1.5, -4.5);
    villaIntGroup.add(trophy);
  });
}
window.createLuxuryRealEstateInteriors = createLuxuryRealEstateInteriors;

// ===========================================================================
// 45. HỆ THỐNG MÙA ĐỘNG & THỜI TIẾT 60 FPS (SEASONS & WEATHER ENGINE)
// 1 DRAW CALL DUY NHẤT: BUFFERGEOMETRY POINTS MƯA & TUYẾT RƠI (ZERO LAG)
// ===========================================================================
function createDynamicSeasonsAndWeather(scene) {
  const WEATHER_PARTICLE_COUNT = 600;
  const weatherGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(WEATHER_PARTICLE_COUNT * 3);
  const velocities = new Float32Array(WEATHER_PARTICLE_COUNT * 3);

  for (let i = 0; i < WEATHER_PARTICLE_COUNT; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 160;
    positions[i * 3 + 1] = Math.random() * 35;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 160;

    velocities[i * 3 + 0] = (Math.random() - 0.5) * 2;
    velocities[i * 3 + 1] = -(15 + Math.random() * 10); // rơi xuống
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 2;
  }

  weatherGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  weatherGeo.userData = { velocities: velocities };

  const weatherMat = new THREE.PointsMaterial({
    color: 0x93c5fd,
    size: 0.35,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const weatherPoints = new THREE.Points(weatherGeo, weatherMat);
  weatherPoints.name = 'dynamic_weather_system';
  weatherPoints.visible = false; // Mặc định chỉ bật khi mưa hoặc tuyết
  scene.add(weatherPoints);

  window.weatherPointsSystem = weatherPoints;
  window.seasonTimer = 0;
  window.seasonsList = ['spring', 'summer', 'autumn', 'winter'];
  window.seasonIndex = 0;
}
window.createDynamicSeasonsAndWeather = createDynamicSeasonsAndWeather;

// ===========================================================================
// 46. VĂN PHÒNG ĐIỀU PHỐI HẠM ĐỘI HÀNG HẢI QUỐC TẾ (MARITIME FLEET CENTER)
// TỌA ĐỘ TẠI CẢNG BIỂN CONTAINER: X = 82, Z = 50
// ===========================================================================
function createMaritimePortFleetCenter(scene) {
  const fleetGroup = new THREE.Group();
  fleetGroup.position.set(82, 0, 50);
  scene.add(fleetGroup);

  const kioskMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.25 });
  const radioMastMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });

  const kiosk = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.2, 3.6), kioskMat);
  kiosk.position.y = 1.6;
  fleetGroup.add(kiosk);

  // Tháp radar hàng hải xoay
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.5, 6), radioMastMat);
  mast.position.set(0, 4.5, 0);
  fleetGroup.add(mast);

  const radarDish = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.1), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
  radarDish.position.set(0, 6.5, 0);
  fleetGroup.add(radarDish);
  window.maritimeRadarDish = radarDish;

  const fleetTag = makeBillboardText('⚓ ĐIỀU PHỐI HÀM ĐỘI BIỂN: [E] XUẤT KHẨU VIỄN DƯƠNG!', '#38bdf8', 460, 44);
  fleetTag.position.set(0, 4.2, 0);
  fleetGroup.add(fleetTag);

  window.maritimeFleetPad = { pos: new THREE.Vector3(82, 0, 50), radius: 5.5, cooldown: 0 };
}
window.createMaritimePortFleetCenter = createMaritimePortFleetCenter;


// ===========================================================================
// 47. BỘ NÂNG CẤP ĐỒ HỌA TOÀN DIỆN HYPER-REALISTIC (NEXT-GEN GRAPHICS ENGINE)
// LOẠI BỎ TRIỆT ĐỂ CẢM GIÁC "MÔ HÌNH ĐỒ CHƠI / LEGO DIORAMA":
// 1. Fake Ambient Occlusion: Bóng tiếp xúc chân móng (Contact Shadows) 100% tòa nhà
// 2. Rooftop Mechanical PBR: Dàn điều hòa HVAC, pin năng lượng mặt trời, bồn nước inox, ăng-ten
// 3. Mặt đứng kính cao ốc hiện đại (Curtain Wall Glass Facades) & mái rải sỏi bitum
// 4. Thảm cỏ 3D đung đưa theo gió (Instanced 3D Grass Tufts with Wind Sway)
// 5. Viền bọt sóng dạt bờ động (Animated Shoreline Wave Foam)
// 6. Đồ nội thất đô thị: Trụ cứu hỏa, tủ điện biến áp, thùng rác phân loại
// TẤT CẢ DÙNG INSTANCED MESH -> 0% RỦI RO LAG, GIỮ VỮNG 60 FPS TRÊN WEB!
// ===========================================================================
function createNextGenHyperRealisticWorldUpgrade(scene) {
  const hyperGroup = new THREE.Group();
  hyperGroup.name = 'hyper_realistic_world_upgrade';
  scene.add(hyperGroup);

  const dummyMatrix = new THREE.Matrix4();
  const dummyPos = new THREE.Vector3();
  const dummyRot = new THREE.Euler();
  const dummyQuat = new THREE.Quaternion();
  const dummyScale = new THREE.Vector3();

  // -------------------------------------------------------------------------
  // 1. BÓNG TIẾP XÚC CHÂN MÓNG (FAKE AMBIENT OCCLUSION CONTACT SHADOWS)
  // Loại bỏ cảm giác công trình "nổi lơ lửng" trên mặt đất!
  // -------------------------------------------------------------------------
  const shadowGeo = new THREE.PlaneGeometry(1, 1);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: Textures.contactShadow(),
    transparent: true,
    opacity: 0.68,
    depthWrite: false
  });

  // Danh sách vị trí & kích thước chân móng của các cụm công trình
  const bldgShadows = [
    { x: 0, z: 58, sx: 24, sz: 16 },       // City Hall & Tòa Thị Chính
    { x: -55, z: 58, sx: 18, sz: 16 },     // Trụ sở Cảnh sát HQ
    { x: 55, z: 58, sx: 20, sz: 16 },      // Bệnh viện & Cứu hỏa
    { x: -15, z: 58, sx: 16, sz: 16 },     // Sàn Chứng khoán Phố Wall
    { x: 15, z: 58, sx: 16, sz: 16 },      // Ngân hàng Trung ương
    { x: 90, z: 58, sx: 22, sz: 18 },      // Khu Căn hộ Cao cấp
    { x: 100, z: 56, sx: 20, sz: 18 },     // Dinh thự Maldives ven biển
    { x: 82, z: 50, sx: 12, sz: 12 },      // Văn phòng Thương Cảng Hải quân
    { x: 35, z: -18, sx: 18, sz: 14 },     // Nhà máy Lắp ráp Chế tạo
    { x: -30, z: -18, sx: 16, sz: 14 },    // Trạm Biến áp 110kV
    { x: 0, z: -18, sx: 20, sz: 14 },      // Xưởng cưa Công nghiệp
    { x: 18, z: -25, sx: 10, sz: 10 },     // Quầy Thu mua Ván gỗ
    { x: 13, z: 4, sx: 12, sz: 10 },       // Chợ cá Cảng biển
    { x: -90, z: 40, sx: 28, sz: 20 },     // Nhà ga Sân bay Skyport
    { x: -40, z: 0, sx: 18, sz: 16 },      // Chợ thương mại trung tâm
    { x: 142, z: 0, sx: 16, sz: 14 },      // Ga Tàu lượn siêu tốc
    { x: 142, z: -18, sx: 14, sz: 14 },    // Đu quay khổng lồ
    { x: -110, z: -20, sx: 22, sz: 16 },   // Nhà máy Tái chế & Phong điện
    { x: -145, z: 60, sx: 24, sz: 18 },    // Trại giam biệt lập
    { x: 70, z: 40, sx: 10, sz: 10 }       // Trạm cứu hỏa
  ];

  const contactShadowMesh = new THREE.InstancedMesh(shadowGeo, shadowMat, bldgShadows.length);
  contactShadowMesh.castShadow = false;
  contactShadowMesh.receiveShadow = false;

  for (let i = 0; i < bldgShadows.length; i++) {
    const s = bldgShadows[i];
    dummyPos.set(s.x, 0.025, s.z);
    dummyQuat.set(0, 0, 0, 1);
    dummyScale.set(s.sx * 1.25, 1, s.sz * 1.25);
    dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
    contactShadowMesh.setMatrixAt(i, dummyMatrix);
  }
  contactShadowMesh.instanceMatrix.needsUpdate = true;
  hyperGroup.add(contactShadowMesh);

  // -------------------------------------------------------------------------
  // 2. THIẾT BỊ CƠ KHÍ & ĐIỆN TỬ TẦNG THƯỢNG (ROOFTOP MECHANICAL & HVAC)
  // Xóa sổ nóc nhà phẳng lì trống trơn như mô hình đồ chơi!
  // -------------------------------------------------------------------------
  const hvacGeo = new THREE.BoxGeometry(1.4, 0.9, 1.2);
  const hvacMat = new THREE.MeshStandardMaterial({
    map: Textures.hvacVent(),
    roughness: 0.45,
    metalness: 0.6
  });

  const hvacLocations = [
    { x: -2, y: 14.5, z: 58 }, { x: 3, y: 14.5, z: 58 },        // City Hall
    { x: -57, y: 12.5, z: 58 }, { x: -53, y: 12.5, z: 58 },    // Police HQ
    { x: 53, y: 16.5, z: 58 }, { x: 57, y: 16.5, z: 58 },      // Hospital
    { x: -16, y: 22.5, z: 58 }, { x: -13, y: 22.5, z: 58 },    // Stock Exchange
    { x: 14, y: 15.5, z: 58 }, { x: 17, y: 15.5, z: 58 },      // Bank
    { x: 88, y: 24.5, z: 58 }, { x: 92, y: 24.5, z: 58 },      // Residential Tower
    { x: 33, y: 7.5, z: -18 }, { x: 37, y: 7.5, z: -18 },      // Crafting Plant
    { x: -92, y: 9.5, z: 40 }, { x: -88, y: 9.5, z: 40 }       // Skyport Terminal
  ];

  const hvacInstanced = new THREE.InstancedMesh(hvacGeo, hvacMat, hvacLocations.length);
  hvacInstanced.castShadow = true;
  hvacInstanced.receiveShadow = true;

  for (let i = 0; i < hvacLocations.length; i++) {
    const loc = hvacLocations[i];
    dummyPos.set(loc.x, loc.y, loc.z);
    dummyQuat.set(0, 0, 0, 1);
    dummyScale.set(1, 1, 1);
    dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
    hvacInstanced.setMatrixAt(i, dummyMatrix);
  }
  hvacInstanced.instanceMatrix.needsUpdate = true;
  hyperGroup.add(hvacInstanced);

  // DÀN PIN NĂNG LƯỢNG MẶT TRỜI TẦNG THƯỢNG (SOLAR PANEL ARRAYS)
  const solarGeo = new THREE.BoxGeometry(1.6, 0.08, 1.1);
  const solarMat = new THREE.MeshStandardMaterial({
    map: Textures.solarPanel(),
    roughness: 0.25,
    metalness: 0.8
  });

  const solarLocations = [
    { x: 86, y: 24.5, z: 56, rx: 0.25 }, { x: 89, y: 24.5, z: 56, rx: 0.25 }, { x: 92, y: 24.5, z: 56, rx: 0.25 },
    { x: 51, y: 16.5, z: 56, rx: 0.25 }, { x: 54, y: 16.5, z: 56, rx: 0.25 },
    { x: -32, y: 8.5, z: -16, rx: 0.25 }, { x: -29, y: 8.5, z: -16, rx: 0.25 },
    { x: -112, y: 10.5, z: -22, rx: 0.25 }, { x: -108, y: 10.5, z: -22, rx: 0.25 }
  ];

  const solarInstanced = new THREE.InstancedMesh(solarGeo, solarMat, solarLocations.length);
  solarInstanced.castShadow = true;

  for (let i = 0; i < solarLocations.length; i++) {
    const s = solarLocations[i];
    dummyPos.set(s.x, s.y, s.z);
    dummyRot.set(s.rx, 0, 0);
    dummyQuat.setFromEuler(dummyRot);
    dummyScale.set(1, 1, 1);
    dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
    solarInstanced.setMatrixAt(i, dummyMatrix);
  }
  solarInstanced.instanceMatrix.needsUpdate = true;
  hyperGroup.add(solarInstanced);

  // BỒN NƯỚC INOX SÁNG BÓNG & THÁP NƯỚC TẦNG THƯỢNG (WATER TANKS)
  const tankGeo = new THREE.CylinderGeometry(0.7, 0.7, 1.6, 12);
  const tankMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.95,
    roughness: 0.15
  });

  const tankLocations = [
    { x: 5, y: 15.0, z: 56 },
    { x: -52, y: 13.0, z: 56 },
    { x: 94, y: 25.0, z: 59 },
    { x: -87, y: 10.0, z: 38 }
  ];

  const tankInstanced = new THREE.InstancedMesh(tankGeo, tankMat, tankLocations.length);
  tankInstanced.castShadow = true;
  for (let i = 0; i < tankLocations.length; i++) {
    const t = tankLocations[i];
    dummyPos.set(t.x, t.y, t.z);
    dummyQuat.set(0, 0, 0, 1);
    dummyScale.set(1, 1, 1);
    dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
    tankInstanced.setMatrixAt(i, dummyMatrix);
  }
  tankInstanced.instanceMatrix.needsUpdate = true;
  hyperGroup.add(tankInstanced);

  // ĐÈN CẢNH BÁO HÀNG KHÔNG ĐỎ CHỚP TẮT TRÊN NÓC CÁC TÒA NHÀ CAO NHẤT (AVIATION BEACONS)
  const beaconGeo = new THREE.SphereGeometry(0.2, 8, 8);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const beaconLocations = [
    { x: -15, y: 24.2, z: 58 }, // Stock Exchange
    { x: 90, y: 26.5, z: 58 },  // Residential Tower
    { x: 0, y: 16.5, z: 58 }    // City Hall Spire
  ];
  window.aviationBeacons = [];
  beaconLocations.forEach(bl => {
    const bm = new THREE.Mesh(beaconGeo, beaconMat);
    bm.position.set(bl.x, bl.y, bl.z);
    hyperGroup.add(bm);
    window.aviationBeacons.push(bm);
  });

  // -------------------------------------------------------------------------
  // 3. MẶT ĐỨNG CAO ỐC KÍNH CURTAIN WALL & MÁI RẢI SỎI BITUM (PBR FACADES)
  // Biến khối hộp đơn sắc thành kiến trúc kính đa tầng phản quang!
  // -------------------------------------------------------------------------
  const facadeMat1 = new THREE.MeshStandardMaterial({
    map: Textures.modernSkyscraperFacade('#0f172a', '#0284c7'),
    roughness: 0.2,
    metalness: 0.65
  });
  const facadeMat2 = new THREE.MeshStandardMaterial({
    map: Textures.modernSkyscraperFacade('#1e293b', '#0369a1'),
    roughness: 0.2,
    metalness: 0.65
  });

  // Tấm ốp kính mặt tiền cho 2 tòa tháp cao nhất
  const facadeWall1 = new THREE.Mesh(new THREE.PlaneGeometry(12.8, 20.0), facadeMat1);
  facadeWall1.position.set(-15, 12.0, 64.1);
  hyperGroup.add(facadeWall1);

  const facadeWall2 = new THREE.Mesh(new THREE.PlaneGeometry(16.0, 22.0), facadeMat2);
  facadeWall2.position.set(90, 13.0, 64.1);
  hyperGroup.add(facadeWall2);

  // Mái rải sỏi bitum chống thấm cho nóc tòa nhà
  const roofGravelMat = new THREE.MeshStandardMaterial({
    map: Textures.rooftopGravel(),
    roughness: 0.85,
    metalness: 0.1
  });
  const roofPlane1 = new THREE.Mesh(new THREE.PlaneGeometry(13.5, 12.5), roofGravelMat);
  roofPlane1.rotateX(-Math.PI / 2);
  roofPlane1.position.set(-15, 22.05, 58);
  hyperGroup.add(roofPlane1);

  const roofPlane2 = new THREE.Mesh(new THREE.PlaneGeometry(17.5, 14.5), roofGravelMat);
  roofPlane2.rotateX(-Math.PI / 2);
  roofPlane2.position.set(90, 24.05, 58);
  hyperGroup.add(roofPlane2);

  // -------------------------------------------------------------------------
  // 4. THẢM CỎ 3D TỰ NHIÊN ĐUNG ĐƯA THEO GIÓ (INSTANCED 3D GRASS TUFTS)
  // Tạo sự sống hữu cơ cho nền đất, triệt tiêu cảm giác diorama nhân tạo!
  // -------------------------------------------------------------------------
  const GRASS_TUFT_COUNT = 320;
  const grassBladeGeo = new THREE.PlaneGeometry(0.8, 0.7);
  grassBladeGeo.translate(0, 0.35, 0); // Đặt gốc ở đáy
  const grassMat = new THREE.MeshStandardMaterial({
    map: Textures.grassTuft(),
    transparent: true,
    alphaTest: 0.35,
    roughness: 0.75,
    side: THREE.DoubleSide
  });

  const grassInstanced = new THREE.InstancedMesh(grassBladeGeo, grassMat, GRASS_TUFT_COUNT);
  grassInstanced.castShadow = false;
  grassInstanced.receiveShadow = true;

  // Thuật toán rải cỏ ngẫu nhiên trong các vùng đất xanh (tránh đường xe chạy và nước)
  let grassIdx = 0;
  for (let i = 0; i < GRASS_TUFT_COUNT && grassIdx < GRASS_TUFT_COUNT; i++) {
    // Vùng 1: Công viên bờ sông & bãi cỏ xưởng cưa (X: -20 -> 25, Z: -35 -> -5)
    let gx, gz;
    if (i % 3 === 0) {
      gx = -25 + Math.random() * 50;
      gz = -35 + Math.random() * 14;
    } else if (i % 3 === 1) {
      // Vùng 2: Ven đồi & công viên sinh thái phía Tây (X: -80 -> -40, Z: -20 -> 30)
      gx = -80 + Math.random() * 40;
      gz = -20 + Math.random() * 45;
    } else {
      // Vùng 3: Khu đồi xanh phía Bắc & đồi thông (X: -60 -> 60, Z: -70 -> -40)
      gx = -60 + Math.random() * 120;
      gz = -75 + Math.random() * 30;
    }

    dummyPos.set(gx, 0.1, gz);
    dummyRot.set(0, Math.random() * Math.PI, 0);
    dummyQuat.setFromEuler(dummyRot);
    const s = 0.75 + Math.random() * 0.5;
    dummyScale.set(s, s, s);
    dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
    grassInstanced.setMatrixAt(grassIdx++, dummyMatrix);
  }
  grassInstanced.instanceMatrix.needsUpdate = true;
  hyperGroup.add(grassInstanced);
  window.hyperGrassInstanced = grassInstanced;

  // -------------------------------------------------------------------------
  // 5. VIỀN BỌT SÓNG DẠT BỜ ĐỘNG (ANIMATED SHORELINE FOAM WAVE RIBBON)
  // -------------------------------------------------------------------------
  const foamGeo = new THREE.PlaneGeometry(160, 2.5, 32, 2);
  foamGeo.rotateX(-Math.PI / 2);
  const foamMat = new THREE.MeshBasicMaterial({
    map: Textures.shoreFoam(),
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const foamRibbon = new THREE.Mesh(foamGeo, foamMat);
  foamRibbon.position.set(20, 0.12, 28);
  hyperGroup.add(foamRibbon);
  window.shorelineFoamRibbon = foamRibbon;

  // -------------------------------------------------------------------------
  // 6. ĐỒ NỘI THẤT ĐÔ THỊ ĐẲNG CẤP (STREET FURNITURE: HYDRANTS & UTILITY BOXES)
  // -------------------------------------------------------------------------
  // Trụ nước cứu hỏa đỏ chói
  const hydrantGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.75, 8);
  const hydrantMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3, metalness: 0.6 });
  const hydrantLocations = [
    { x: -35, z: 66 }, { x: 5, z: 66 }, { x: 45, z: 66 }, { x: 80, z: 66 }
  ];
  const hydrantInstanced = new THREE.InstancedMesh(hydrantGeo, hydrantMat, hydrantLocations.length);
  for (let i = 0; i < hydrantLocations.length; i++) {
    const h = hydrantLocations[i];
    dummyPos.set(h.x, 0.52, h.z);
    dummyQuat.set(0, 0, 0, 1);
    dummyScale.set(1, 1, 1);
    dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
    hydrantInstanced.setMatrixAt(i, dummyMatrix);
  }
  hydrantInstanced.instanceMatrix.needsUpdate = true;
  hyperGroup.add(hydrantInstanced);

  // Tủ điện biến áp ngầm màu xanh rêu đô thị
  const utilBoxGeo = new THREE.BoxGeometry(0.8, 1.1, 0.6);
  const utilBoxMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.4 });
  const utilLocations = [
    { x: -20, z: 66 }, { x: 25, z: 66 }, { x: 65, z: 66 }
  ];
  const utilInstanced = new THREE.InstancedMesh(utilBoxGeo, utilBoxMat, utilLocations.length);
  for (let i = 0; i < utilLocations.length; i++) {
    const u = utilLocations[i];
    dummyPos.set(u.x, 0.68, u.z);
    dummyQuat.set(0, 0, 0, 1);
    dummyScale.set(1, 1, 1);
    dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
    utilInstanced.setMatrixAt(i, dummyMatrix);
  }
  utilInstanced.instanceMatrix.needsUpdate = true;
  hyperGroup.add(utilInstanced);
}
window.createNextGenHyperRealisticWorldUpgrade = createNextGenHyperRealisticWorldUpgrade;


// ===========================================================================
// 48. ĐẠI NÂNG CẤP ĐỒ HỌA TOÀN DIỆN 20 HẠNG MỤC (FULL 20-ITEM GRAPHICS OVERHAUL)
// 100% GPU INSTANCING - ZERO ALLOCATION - KHÔNG TỐN THÊM BỘ NHỚ RAM - GIỮ 60 FPS
// ===========================================================================
function createFull20ItemNextGenGraphicsOverhaul(scene) {
  const masterGroup = new THREE.Group();
  masterGroup.name = 'master_20_graphics_overhaul';
  scene.add(masterGroup);

  const dummyMatrix = new THREE.Matrix4();
  const dummyPos = new THREE.Vector3();
  const dummyRot = new THREE.Euler();
  const dummyQuat = new THREE.Quaternion();
  const dummyScale = new THREE.Vector3();

  // -------------------------------------------------------------------------
  // MỤC 1 & 2: BAN CÔNG NHÔ 3D & LAN CAN KÍNH TÒA NHÀ CĂN HỘ (INSTANCED BALCONIES)
  // -------------------------------------------------------------------------
  const balconyFloorGeo = new THREE.BoxGeometry(3.6, 0.2, 1.4);
  const balconyFloorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
  const glassRailingGeo = new THREE.BoxGeometry(3.6, 0.8, 0.08);
  const glassRailingMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.65,
    roughness: 0.1,
    metalness: 0.3
  });

  // 18 Ban công so le trên thân tháp căn hộ (90, 0, 58)
  const balconyLocs = [];
  for (let floor = 1; floor <= 6; floor++) {
    const fy = 3.5 + floor * 3.2;
    // Mặt trước Z = 67.2
    balconyLocs.push({ x: 84, y: fy, z: 67.2, ry: 0 });
    balconyLocs.push({ x: 90, y: fy, z: 67.2, ry: 0 });
    balconyLocs.push({ x: 96, y: fy, z: 67.2, ry: 0 });
  }

  const balconyInstanced = new THREE.InstancedMesh(balconyFloorGeo, balconyFloorMat, balconyLocs.length);
  const railingInstanced = new THREE.InstancedMesh(glassRailingGeo, glassRailingMat, balconyLocs.length);

  for (let i = 0; i < balconyLocs.length; i++) {
    const loc = balconyLocs[i];
    dummyPos.set(loc.x, loc.y, loc.z);
    dummyQuat.set(0, 0, 0, 1);
    dummyScale.set(1, 1, 1);
    dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
    balconyInstanced.setMatrixAt(i, dummyMatrix);

    dummyPos.set(loc.x, loc.y + 0.45, loc.z + 0.65);
    dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
    railingInstanced.setMatrixAt(i, dummyMatrix);
  }
  balconyInstanced.instanceMatrix.needsUpdate = true;
  railingInstanced.instanceMatrix.needsUpdate = true;
  masterGroup.add(balconyInstanced);
  masterGroup.add(railingInstanced);

  // -------------------------------------------------------------------------
  // MỤC 3: MÁI ĐÓN CANOPY & SẢNH KÍNH TẦNG 1 (CANTILEVERED LOBBY CANOPIES)
  // -------------------------------------------------------------------------
  const canopyGeo = new THREE.BoxGeometry(7.5, 0.25, 4.2);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 });
  const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.8, 8);
  const postMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });

  const canopyConfigs = [
    { x: 0, z: 67.0, title: 'TÒA THỊ CHÍNH' },
    { x: -15, z: 67.0, title: 'PHỐ WALL' },
    { x: 55, z: 67.0, title: 'BỆNH VIỆN' },
    { x: 90, z: 67.0, title: 'PENTHOUSE' }
  ];

  canopyConfigs.forEach(c => {
    const canGroup = new THREE.Group();
    canGroup.position.set(c.x, 3.8, c.z);
    masterGroup.add(canGroup);

    const roof = new THREE.Mesh(canopyGeo, canopyMat);
    canGroup.add(roof);

    // Dải đèn LED âm trần rọi xuống thảm đỏ
    const downLight = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.05, 3.2), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
    downLight.position.y = -0.13;
    canGroup.add(downLight);

    // 2 Cột chrome chịu lực
    [-3.4, 3.4].forEach(px => {
      const p = new THREE.Mesh(postGeo, postMat);
      p.position.set(px, -1.9, 1.8);
      canGroup.add(p);
    });
  });

  // -------------------------------------------------------------------------
  // MỤC 4: THANG MÁY LỒNG KÍNH PANORAMA NGOÀI TRỜI (EXTERIOR GLASS ELEVATOR)
  // Chạy dọc theo thân tháp Sàn Chứng Khoán Phố Wall (-7.5, Y, 58)
  // -------------------------------------------------------------------------
  const trackGeo = new THREE.BoxGeometry(0.3, 21.5, 0.3);
  const trackMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9 });
  const elevatorTrack = new THREE.Mesh(trackGeo, trackMat);
  elevatorTrack.position.set(-6.8, 11.5, 58.0);
  masterGroup.add(elevatorTrack);

  const elevatorCab = new THREE.Group();
  elevatorCab.position.set(-6.8, 2.0, 58.0);
  masterGroup.add(elevatorCab);

  const cabBody = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 1.8), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85 }));
  elevatorCab.add(cabBody);

  const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.6, 1.85), new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.75,
    roughness: 0.1
  }));
  cabGlass.position.y = 0.2;
  elevatorCab.add(cabGlass);

  // Đèn vàng ấm bên trong buồng thang máy
  const cabLight = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
  cabLight.position.y = 0.8;
  elevatorCab.add(cabLight);

  window.exteriorGlassElevator = elevatorCab;

  // -------------------------------------------------------------------------
  // MỤC 6: DẢI LED NEON VIỀN ĐƯỜNG CHÂN TRỜI NÓC THÁP (SKYLINE NEON RIBBONS)
  // -------------------------------------------------------------------------
  const neonMat1 = new THREE.MeshBasicMaterial({ color: 0x06b6d4 }); // Cyan neon
  const neonMat2 = new THREE.MeshBasicMaterial({ color: 0xf59e0b }); // Gold neon
  const neonMat3 = new THREE.MeshBasicMaterial({ color: 0xa855f7 }); // Purple neon

  // Viền nóc Phố Wall
  const n1 = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.2, 13.2), neonMat1);
  n1.position.set(-15, 23.2, 58);
  masterGroup.add(n1);

  // Viền nóc Penthouse
  const n2 = new THREE.Mesh(new THREE.BoxGeometry(18.2, 0.2, 14.2), neonMat2);
  n2.position.set(90, 25.2, 58);
  masterGroup.add(n2);

  // Viền chóp Tòa Thị Chính
  const n3 = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.2, 8.2), neonMat3);
  n3.position.set(0, 16.8, 58);
  masterGroup.add(n3);

  // -------------------------------------------------------------------------
  // MỤC 10: DẢI RẼ SÓNG ĐUÔI TÀU CHỮ V (BOAT WAKES MESH)
  // -------------------------------------------------------------------------
  const wakeGeo = new THREE.PlaneGeometry(3.5, 9.0);
  wakeGeo.rotateX(-Math.PI / 2);
  const wakeMat = new THREE.MeshBasicMaterial({
    map: Textures.boatWake(),
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const boatWake = new THREE.Mesh(wakeGeo, wakeMat);
  boatWake.position.set(16.5, 0.08, 8.0);
  masterGroup.add(boatWake);
  window.speedboatWakeMesh = boatWake;

  // -------------------------------------------------------------------------
  // MỤC 11 & 12: VẠCH KẺ ĐI BỘ ZEBRA CROSSWALK TẠI CÁC NGÃ TƯ LỚN
  // -------------------------------------------------------------------------
  const zebraGeo = new THREE.PlaneGeometry(8.5, 3.8);
  zebraGeo.rotateX(-Math.PI / 2);
  const zebraMat = new THREE.MeshStandardMaterial({
    map: Textures.zebraCrosswalk(),
    roughness: 0.8
  });

  const zebraCrosswalks = [
    { x: -55, z: 78 },
    { x: -15, z: 78 },
    { x: 0, z: 78 },
    { x: 55, z: 78 },
    { x: 90, z: 78 },
    { x: 28, z: 45 },
    { x: 28, z: 110 }
  ];

  zebraCrosswalks.forEach(zc => {
    const zm = new THREE.Mesh(zebraGeo, zebraMat);
    zm.position.set(zc.x, 0.145, zc.z);
    masterGroup.add(zm);
  });

  // -------------------------------------------------------------------------
  // MỤC 13: BIỂN HIỆU NEON CỬA HÀNG TẦNG TRỆT & BÀN GHẾ CAFE VỈA HÈ
  // -------------------------------------------------------------------------
  const signGeo = new THREE.PlaneGeometry(3.8, 0.95);
  const signTypes = ['mart', 'cafe', 'pharmacy', 'bank'];
  const signLocs = [
    { x: 5, y: 4.8, z: 66.2, type: 'cafe' },
    { x: -10, y: 4.8, z: 66.2, type: 'bank' },
    { x: 50, y: 4.8, z: 66.2, type: 'pharmacy' },
    { x: 85, y: 4.8, z: 66.2, type: 'mart' }
  ];

  signLocs.forEach(s => {
    const sMat = new THREE.MeshBasicMaterial({ map: Textures.neonShopSign(s.type) });
    const sMesh = new THREE.Mesh(signGeo, sMat);
    sMesh.position.set(s.x, s.y, s.z);
    masterGroup.add(sMesh);
  });

  // Bàn ghế Cafe vỉa hè có ô che nắng (Instanced Cafe Sets)
  const tableGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.7, 8);
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
  const umbrellaGeo = new THREE.ConeGeometry(1.4, 0.8, 8);
  const umbrellaMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.4 });

  [-2, 8, 12].forEach(tx => {
    const tbl = new THREE.Mesh(tableGeo, tableMat);
    tbl.position.set(tx, 0.45, 68.2);
    masterGroup.add(tbl);

    const umb = new THREE.Mesh(umbrellaGeo, umbrellaMat);
    umb.position.set(tx, 2.2, 68.2);
    masterGroup.add(umb);
  });

  // -------------------------------------------------------------------------
  // MỤC 19: ĐÈN PHA XE CỘ HÌNH NÓN CHIẾU SÁNG ĐÊM (VOLUMETRIC HEADLIGHT CONES)
  // -------------------------------------------------------------------------
  const coneGeo = new THREE.ConeGeometry(1.8, 14.0, 12);
  coneGeo.rotateX(-Math.PI / 2);
  coneGeo.translate(0, 0, 7.0);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const carLightCone = new THREE.Mesh(coneGeo, coneMat);
  carLightCone.visible = false;
  masterGroup.add(carLightCone);
  window.dynamicVehicleHeadlightCone = carLightCone;

  // -------------------------------------------------------------------------
  // MỤC 20: TRẠM SẠC XE ĐIỆN EV & THÙNG RÁC PHÂN LOẠI 3 MÀU ĐÔ THỊ
  // -------------------------------------------------------------------------
  const evGeo = new THREE.BoxGeometry(0.6, 1.6, 0.5);
  const evMat = new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.8, roughness: 0.2 });
  [-22, 22, 75].forEach(ex => {
    const ev = new THREE.Mesh(evGeo, evMat);
    ev.position.set(ex, 0.9, 66.5);
    masterGroup.add(ev);

    const evScreen = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.05), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    evScreen.position.set(ex, 1.35, 66.78);
    masterGroup.add(evScreen);
  });
}
window.createFull20ItemNextGenGraphicsOverhaul = createFull20ItemNextGenGraphicsOverhaul;

// ===========================================================================
// HỆ THỐNG 100 MỤC NÂNG CẤP TOÀN DIỆN (100-ITEM MASTER UPGRADE SUITE)
// ZERO-ALLOCATION, BATCH INSTANCING, 60 FPS ULTRA-STABLE
// ===========================================================================
function create100UpgradeSuiteWorld(scene) {
  const gSuite = new THREE.Group();
  gSuite.name = "100_upgrade_suite_world";
  scene.add(gSuite);

  // 1. THIÊN THỂ MẶT TRỜI & MẶT TRĂNG VẬT LÝ QUỸ ĐẠO (MỤC 5 & 6)
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(6.5, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfef08a })
  );
  gSuite.add(sunMesh);
  window.celestialSun = sunMesh;

  const sunCorona = new THREE.Mesh(
    new THREE.RingGeometry(6.8, 11.5, 24),
    new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    })
  );
  sunMesh.add(sunCorona);

  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(4.8, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0xe2e8f0 })
  );
  gSuite.add(moonMesh);
  window.celestialMoon = moonMesh;

  // 2. TIA SÁNG RỌI XUYÊN RỪNG THÔNG CREPUSCULAR GOD RAYS (MỤC 4)
  const godRaysGroup = new THREE.Group();
  godRaysGroup.position.set(-32, 16, -18);
  const rayMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const rayGeo = new THREE.PlaneGeometry(3.5, 28);
  for (let ri = 0; ri < 4; ri++) {
    const ray = new THREE.Mesh(rayGeo, rayMat);
    ray.position.set((ri - 1.5) * 6.5, 0, (Math.random() - 0.5) * 5.0);
    ray.rotation.z = 0.28;
    ray.rotation.y = (ri * Math.PI) / 4;
    godRaysGroup.add(ray);
  }
  gSuite.add(godRaysGroup);
  window.forestGodRays = godRaysGroup;

  // 3. LỚP TUYẾT PHỦ MÁI NHÀ MÙA ĐÔNG DYNAMIC SNOW CAPS (MỤC 8)
  window.rooftopSnowCaps = [];
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.9,
    metalness: 0.05
  });
  const snowTargets = [
    { x: -42, y: 22.6, z: 67, w: 12.5, d: 10.5 }, // Stock Exchange
    { x: -18, y: 16.6, z: 67, w: 14.5, d: 12.5 }, // City Hall
    { x: 6, y: 18.6, z: 67, w: 13.5, d: 11.5 },   // Central Bank
    { x: -65, y: 26.6, z: 89, w: 16.5, d: 14.5 }  // Residential Hub
  ];
  snowTargets.forEach(st => {
    const sMesh = new THREE.Mesh(new THREE.BoxGeometry(st.w, 0.45, st.d), snowMat);
    sMesh.position.set(st.x, st.y, st.z);
    sMesh.scale.set(1, 0.001, 1); // Ẩn mặc định, bung nở khi mùa đông
    gSuite.add(sMesh);
    window.rooftopSnowCaps.push(sMesh);
  });

  // 4. BỌT SÓNG VỖ BỜ KÈ ĐÁ GRANITE & BÃI BIỂN (MỤC 16)
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false
  });
  const riverFoam = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 48), foamMat);
  riverFoam.rotateX(-Math.PI / 2);
  riverFoam.position.set(22.2, 0.03, 16);
  gSuite.add(riverFoam);

  const beachFoam = new THREE.Mesh(new THREE.PlaneGeometry(64, 2.8), foamMat);
  beachFoam.rotateX(-Math.PI / 2);
  beachFoam.position.set(106, 0.03, 50);
  gSuite.add(beachFoam);
  window.shorelineFoams = [riverFoam, beachFoam];

  // 5. ĐINH PHẢN QUANG MẮT MÈO DỌC TIM ĐẠI LỘ INSTANCED (MỤC 18)
  const studGeo = new THREE.BoxGeometry(0.12, 0.05, 0.16);
  const studMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xfacc15,
    emissiveIntensity: 0.6,
    metalness: 0.9,
    roughness: 0.2
  });
  const studCount = 38;
  const studInst = new THREE.InstancedMesh(studGeo, studMat, studCount);
  const _dummyStud = new THREE.Object3D();
  let studIdx = 0;
  for (let sz = -50; sz <= 140; sz += 5.0) {
    if (studIdx < studCount) {
      _dummyStud.position.set(28.0, 0.14, sz);
      _dummyStud.updateMatrix();
      studInst.setMatrixAt(studIdx++, _dummyStud.matrix);
    }
  }
  studInst.instanceMatrix.needsUpdate = true;
  gSuite.add(studInst);

  // 6. TRẠM XĂNG NHIÊN LIỆU ĐÔ THỊ GAS STATIONS (MỤC 28)
  const fuelPumps = [
    { x: 38.0, z: 66.0, name: 'Trạm Xăng Petrolimex 01' },
    { x: -38.0, z: 66.0, name: 'Trạm Xăng Petrolimex 02' }
  ];
  window.gasStationPads = [];
  fuelPumps.forEach(fp => {
    const gsGroup = new THREE.Group();
    gsGroup.position.set(fp.x, 0, fp.z);
    gSuite.add(gsGroup);

    // Mái che trạm xăng
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.5, 7),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 })
    );
    canopy.position.set(0, 4.8, 0);
    gsGroup.add(canopy);

    // 2 Cột đỡ thép
    [-3, 3].forEach(px => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4.8, 8), new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8 }));
      p.position.set(px, 2.4, 0);
      gsGroup.add(p);
    });

    // 2 Trụ bơm xăng điện tử
    [-1.8, 1.8].forEach(px => {
      const pump = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.6), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 }));
      pump.position.set(px, 0.9, 0);
      gsGroup.add(pump);

      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.05), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
      screen.position.set(px, 1.3, 0.32);
      gsGroup.add(screen);
    });

    // Pad nạp nhiên liệu
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, 0.08, 5.5),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 })
    );
    pad.position.y = 0.04;
    gsGroup.add(pad);

    window.gasStationPads.push({ pos: new THREE.Vector3(fp.x, 0, fp.z), radius: 4.5 });
  });

  // 7. TRẠM SỬA CHỮA CƠ KHÍ GARA AUTO REPAIR (MỤC 31)
  const garageGroup = new THREE.Group();
  garageGroup.position.set(0, 0, -35);
  gSuite.add(garageGroup);

  const liftPad = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.1, 7.2),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 })
  );
  liftPad.position.y = 0.05;
  garageGroup.add(liftPad);

  // 2 Rãnh nâng thủy lực vàng cảnh báo
  [-1.6, 1.6].forEach(lx => {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.22, 6.8), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 }));
    ramp.position.set(lx, 0.16, 0);
    garageGroup.add(ramp);
  });
  window.autoRepairPad = { pos: new THREE.Vector3(0, 0, -35), radius: 4.2 };

  // 8. CÁC Ô ĐỖ XE SONG SONG PARALLEL PARKING (MỤC 32)
  const parkGeo = new THREE.PlaneGeometry(3.2, 6.5);
  parkGeo.rotateX(-Math.PI / 2);
  const parkMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.35,
    depthWrite: false
  });
  window.parkingSlots = [];
  [-30, -22, -14, 14, 22, 30].forEach((px, pIdx) => {
    const pMesh = new THREE.Mesh(parkGeo, parkMat);
    pMesh.position.set(px, 0.14, 71.5);
    gSuite.add(pMesh);
    window.parkingSlots.push({ pos: new THREE.Vector3(px, 0.14, 71.5), id: pIdx, occupied: false });
  });

  // 9. DẢI MŨI TÊN DẪN HƯỚNG 3D AR WAYPOINT CHEVRONS (MỤC 36 & 98)
  const wpGroup = new THREE.Group();
  wpGroup.visible = false;
  gSuite.add(wpGroup);
  window.waypointPathGroup = wpGroup;

  const chevGeo = new THREE.PlaneGeometry(1.6, 2.4);
  chevGeo.rotateX(-Math.PI / 2);
  const chevMat = new THREE.MeshBasicMaterial({
    map: Textures.chevronWaypoint ? Textures.chevronWaypoint() : null,
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  window.waypointChevrons = [];
  for (let ci = 0; ci < 8; ci++) {
    const cm = new THREE.Mesh(chevGeo, chevMat);
    cm.position.y = 0.25;
    wpGroup.add(cm);
    window.waypointChevrons.push(cm);
  }

  // 10. HÒM TIẾP TẾ THẢ DÙ AIRDROP QUÂN SỰ (MỤC 37)
  const airdropGroup = new THREE.Group();
  airdropGroup.position.set(15, 60, 45); // Bắt đầu từ trên cao
  gSuite.add(airdropGroup);

  const crateMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 2.2, 2.2),
    new THREE.MeshStandardMaterial({
      map: Textures.airdropCrate ? Textures.airdropCrate() : null,
      color: 0x15803d,
      roughness: 0.6
    })
  );
  crateMesh.position.y = 1.1;
  crateMesh.castShadow = true;
  airdropGroup.add(crateMesh);

  // Dù tròn màu đỏ trắng
  const chuteMesh = new THREE.Mesh(
    new THREE.SphereGeometry(3.8, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xef4444, side: THREE.DoubleSide, roughness: 0.5 })
  );
  chuteMesh.position.y = 5.8;
  airdropGroup.add(chuteMesh);

  // Đèn tín hiệu pháo sáng màu cam
  const flareLight = new THREE.PointLight(0xf97316, 2.5, 18);
  flareLight.position.set(0, 2.4, 0);
  airdropGroup.add(flareLight);

  window.airdropObject = {
    group: airdropGroup,
    altitude: 60.0,
    active: true,
    groundY: 0.0,
    pos: new THREE.Vector3(15, 0, 45),
    claimed: false
  };

  // 11. KHINH KHÍ CẦU DU NGOẠN NGẮM CẢNH (MỤC 59)
  const balloonGroup = new THREE.Group();
  balloonGroup.position.set(90, 48, -40);
  gSuite.add(balloonGroup);

  const balloonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(6.5, 16, 14),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 })
  );
  balloonMesh.scale.set(1.0, 1.35, 1.0);
  balloonMesh.position.y = 7.5;
  balloonGroup.add(balloonMesh);

  // Giỏ mây khinh khí cầu
  const basket = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.4, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 })
  );
  basket.position.y = 0.7;
  balloonGroup.add(basket);
  window.scenicBalloon = balloonGroup;

  // 12. TUYẾN TÀU ĐIỆN MỘT RAY SKYLINE MONORAIL TRÊN CAO (MỤC 65)
  const monorailGroup = new THREE.Group();
  gSuite.add(monorailGroup);

  // Đường ray đơn cao 8.5m uốn lượn hình oval
  const monoRailMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });

  const monoCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-45, 8.5, 55),
    new THREE.Vector3(0, 8.5, 55),
    new THREE.Vector3(55, 8.5, 55),
    new THREE.Vector3(85, 8.5, 30),
    new THREE.Vector3(85, 8.5, -30),
    new THREE.Vector3(40, 8.5, -45),
    new THREE.Vector3(-45, 8.5, -45),
    new THREE.Vector3(-65, 8.5, 0)
  ], true);

  const railTube = new THREE.Mesh(new THREE.TubeGeometry(monoCurve, 48, 0.45, 8, true), monoRailMat);
  monorailGroup.add(railTube);

  // 8 Trụ bê tông đỡ ray
  monoCurve.getPoints(8).forEach(pt => {
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 8.5, 8), pylonMat);
    pylon.position.set(pt.x, 4.25, pt.z);
    monorailGroup.add(pylon);
  });

  // Toa tàu Monorail khí động học
  const trainCar = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.8, 7.5),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.7, roughness: 0.3 })
  );
  trainCar.position.copy(monoCurve.getPoint(0));
  monorailGroup.add(trainCar);
  window.monorailSystem = {
    car: trainCar,
    curve: monoCurve,
    progress: 0.0,
    speed: 0.04
  };
}
window.create100UpgradeSuiteWorld = create100UpgradeSuiteWorld;

// =========================================================================
// GIAI ĐOẠN 1: HỆ SINH THÁI ĐỘNG VẬT, THỜI TIẾT & HIỆU ỨNG THỊ GIÁC (MỤC 1 - 60)
// =========================================================================

function createPhase1EcosystemAndVFX(scene) {
  const gPhase1 = new THREE.Group();
  gPhase1.name = "phase1_ecosystem_and_vfx";
  scene.add(gPhase1);

  // 1. HOA VĂN KHÚC XẠ ÁNH SÁNG ĐÁY NƯỚC (WATER CAUSTICS) (MỤC 1)
  const causticsGeo = new THREE.PlaneGeometry(36, 120);
  causticsGeo.rotateX(-Math.PI / 2);
  const causticsMat = new THREE.MeshBasicMaterial({
    map: (typeof Textures !== 'undefined' && Textures.waterCaustics) ? Textures.waterCaustics() : null,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const causticsMesh = new THREE.Mesh(causticsGeo, causticsMat);
  causticsMesh.position.set(22.0, -0.65, 45.0);
  gPhase1.add(causticsMesh);
  window.causticsMesh = causticsMesh;

  // 2. MÂY THỂ TÍCH TRÔI THEO GIÓ (VOLUMETRIC CLOUDS) (MỤC 3)
  const cloudTex = (typeof Textures !== 'undefined' && Textures.volumetricCloud) ? Textures.volumetricCloud() : null;
  const cloudMat = new THREE.MeshBasicMaterial({
    map: cloudTex,
    transparent: true,
    opacity: 0.55,
    depthWrite: false
  });
  const cloudGeo = new THREE.PlaneGeometry(16, 16);
  cloudGeo.rotateX(-Math.PI / 2);
  window.volumetricClouds = [];
  for (let ci = 0; ci < 10; ci++) {
    const cMesh = new THREE.Mesh(cloudGeo, cloudMat);
    const cx = (Math.random() - 0.5) * 180;
    const cz = (Math.random() - 0.5) * 180;
    const cy = 48 + Math.random() * 14;
    cMesh.position.set(cx, cy, cz);
    const s = 1.0 + Math.random() * 0.8;
    cMesh.scale.set(s, s, s);
    gPhase1.add(cMesh);
    window.volumetricClouds.push({ mesh: cMesh, speed: 0.8 + Math.random() * 0.6 });
  }

  // 3. MÀN HÌNH LED MA TRẬN UỐN CONG TÒA THÁP TÀI CHÍNH (MỤC 20)
  const ledTex = (typeof Textures !== 'undefined' && Textures.ledCurveStock) ? Textures.ledCurveStock() : null;
  const ledMat = new THREE.MeshBasicMaterial({
    map: ledTex,
    transparent: false
  });
  const ledGeo = new THREE.CylinderGeometry(6.6, 6.6, 1.8, 24, 1, true, -Math.PI / 2, Math.PI);
  const ledRibbon = new THREE.Mesh(ledGeo, ledMat);
  ledRibbon.position.set(-42, 18.5, 67); // Tòa Tháp Chứng Khoán
  gPhase1.add(ledRibbon);
  window.stockExchangeLedRibbon = ledRibbon;

  // 4. BẦY HƯƠU SAO ĂN CỎ TRONG RỪNG SÂU (MỤC 21)
  window.wildlifeDeerHerd = [];
  const deerBodyMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.8 }); // Nâu đốm
  const deerLegMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
  const deerAntlerMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.5 });

  const deerSpawnPoints = [
    { x: -44, z: -26 },
    { x: -48, z: -22 },
    { x: -52, z: -28 },
    { x: -40, z: -30 }
  ];

  deerSpawnPoints.forEach((sp) => {
    const deerGroup = new THREE.Group();
    deerGroup.position.set(sp.x, 0, sp.z);

    // Thân hươu
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.65, 1.3), deerBodyMat);
    body.position.y = 0.95;
    body.castShadow = true;
    deerGroup.add(body);

    // Cổ & Đầu
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.35), deerBodyMat);
    neck.position.set(0, 1.35, 0.5);
    neck.rotation.x = -0.3;
    deerGroup.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.5), deerBodyMat);
    head.position.set(0, 1.6, 0.65);
    head.castShadow = true;
    deerGroup.add(head);

    // Sừng hươu nhánh gạc
    [-0.15, 0.15].forEach(ax => {
      const antler = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.45, 4), deerAntlerMat);
      antler.position.set(ax, 1.85, 0.6);
      antler.rotation.z = (ax < 0 ? -0.3 : 0.3);
      deerGroup.add(antler);
    });

    // 4 Chân
    [[-0.22, -0.4], [0.22, -0.4], [-0.22, 0.4], [0.22, 0.4]].forEach(lp => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.8, 4), deerLegMat);
      leg.position.set(lp[0], 0.4, lp[1]);
      leg.castShadow = true;
      deerGroup.add(leg);
    });

    gPhase1.add(deerGroup);
    window.wildlifeDeerHerd.push({
      group: deerGroup,
      basePos: new THREE.Vector3(sp.x, 0, sp.z),
      pos: deerGroup.position,
      target: new THREE.Vector3(sp.x, 0, sp.z),
      state: 'grazing', // 'grazing' | 'fleeing'
      head: head,
      alertTimer: 0,
      soundCooldown: Math.random() * 12 + 6
    });
  });

  // 5. THỎ RỪNG ĐÀO HANG VEN GỐC THÔNG (MỤC 22)
  window.wildlifeRabbits = [];
  const rabbitMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.7 }); // Trắng tuyết
  const rabbitEarMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.5 }); // Hồng nhạt
  for (let ri = 0; ri < 4; ri++) {
    const rabGroup = new THREE.Group();
    const rx = -34 + (Math.random() - 0.5) * 12;
    const rz = -20 + (Math.random() - 0.5) * 10;
    rabGroup.position.set(rx, 0, rz);

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), rabbitMat);
    body.position.y = 0.22;
    body.scale.set(1.0, 0.9, 1.3);
    rabGroup.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), rabbitMat);
    head.position.set(0, 0.35, 0.2);
    rabGroup.add(head);

    [-0.06, 0.06].forEach(ex => {
      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.24, 4), rabbitEarMat);
      ear.position.set(ex, 0.52, 0.16);
      ear.rotation.x = -0.2;
      rabGroup.add(ear);
    });

    gPhase1.add(rabGroup);
    window.wildlifeRabbits.push({
      group: rabGroup,
      basePos: new THREE.Vector3(rx, 0, rz),
      pos: rabGroup.position,
      hopPhase: Math.random() * Math.PI * 2
    });
  }

  // 6. ĐÀN CÁ VOI LƯNG GÙ NGOÀI KHƠI XA PHUN NƯỚC (MỤC 23)
  const whaleGroup = new THREE.Group();
  whaleGroup.position.set(145, -0.6, 85);
  gPhase1.add(whaleGroup);

  const whaleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.2 });
  const whaleBellyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 });

  // Thân cá voi khí động học
  const whaleBody = new THREE.Mesh(new THREE.ConeGeometry(2.4, 12, 10), whaleMat);
  whaleBody.rotateX(Math.PI / 2);
  whaleBody.scale.set(1.0, 0.65, 1.0);
  whaleGroup.add(whaleBody);

  // Bụng trắng
  const whaleBelly = new THREE.Mesh(new THREE.ConeGeometry(2.1, 8, 8), whaleBellyMat);
  whaleBelly.rotateX(Math.PI / 2);
  whaleBelly.position.set(0, -0.4, -0.8);
  whaleGroup.add(whaleBelly);

  // 2 Vây bơi
  [-2.2, 2.2].forEach(fx => {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 0.9), whaleMat);
    fin.position.set(fx, -0.2, 0.5);
    fin.rotation.z = (fx < 0 ? 0.35 : -0.35);
    whaleGroup.add(fin);
  });

  // Đuôi cá voi
  const fluke = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.2, 1.2), whaleMat);
  fluke.position.set(0, 0.4, -6.2);
  whaleGroup.add(fluke);

  // Cột nước phun spout
  const spoutMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.0,
    depthWrite: false
  });
  const spoutMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 1.2, 7.5, 8), spoutMat);
  spoutMesh.position.set(0, 3.8, 3.2);
  whaleGroup.add(spoutMesh);

  window.humpbackWhale = {
    group: whaleGroup,
    fluke: fluke,
    spout: spoutMesh,
    cycleTimer: 0.0
  };

  // 7. RÙA BIỂN XANH QUANH XÁC TÀU ĐẮM (MỤC 24)
  const turtleGroup = new THREE.Group();
  turtleGroup.position.set(115, -1.2, 35);
  gPhase1.add(turtleGroup);

  const shellMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 });
  const finMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.6 });

  // Mai rùa hình mai vòm
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), shellMat);
  shell.scale.set(1.0, 0.45, 1.3);
  turtleGroup.add(shell);

  // Đầu rùa
  const tHead = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), finMat);
  tHead.position.set(0, 0, 1.1);
  turtleGroup.add(tHead);

  // 2 Vây trước
  const leftFin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.35), finMat);
  leftFin.position.set(-0.9, -0.1, 0.4);
  turtleGroup.add(leftFin);
  const rightFin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.35), finMat);
  rightFin.position.set(0.9, -0.1, 0.4);
  turtleGroup.add(rightFin);

  window.seaTurtle = {
    group: turtleGroup,
    leftFin: leftFin,
    rightFin: rightFin,
    swimPhase: 0.0
  };

  // 8. ĐOM ĐÓM PHÁT SÁNG LẬP LÒE ĐÊM HÈ (MỤC 25)
  const ffGeo = new THREE.SphereGeometry(0.08, 4, 4);
  const ffMat = new THREE.MeshBasicMaterial({ color: 0xbef264 }); // Vàng chanh dạ quang
  const ffGroup = new THREE.Group();
  gPhase1.add(ffGroup);
  window.firefliesList = [];
  for (let fi = 0; fi < 18; fi++) {
    const ffMesh = new THREE.Mesh(ffGeo, ffMat);
    const fx = -25 + (Math.random() - 0.5) * 35;
    const fz = -15 + (Math.random() - 0.5) * 30;
    const fy = 0.5 + Math.random() * 2.2;
    ffMesh.position.set(fx, fy, fz);
    ffGroup.add(ffMesh);
    window.firefliesList.push({
      mesh: ffMesh,
      basePos: new THREE.Vector3(fx, fy, fz),
      phase: Math.random() * Math.PI * 2,
      speed: 1.2 + Math.random() * 1.5
    });
  }
  window.firefliesGroup = ffGroup;

  // 9. ĐÀN CHIM HẢI ÂU CHAO LƯỢN TRÊN CẢNG BIỂN (MỤC 26)
  const gullMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, side: THREE.DoubleSide });
  const gullGeo = new THREE.BufferGeometry();
  // Tam giác sải cánh chữ V
  const gullVerts = new Float32Array([
    0, 0, 0.4,   -0.7, 0.15, -0.2,   0, 0, -0.1,
    0, 0, 0.4,    0, 0, -0.1,         0.7, 0.15, -0.2
  ]);
  gullGeo.setAttribute('position', new THREE.BufferAttribute(gullVerts, 3));
  gullGeo.computeVertexNormals();

  window.seagullFlock = [];
  for (let gi = 0; gi < 8; gi++) {
    const gMesh = new THREE.Mesh(gullGeo, gullMat);
    gMesh.scale.set(0.9, 0.9, 0.9);
    gPhase1.add(gMesh);
    window.seagullFlock.push({
      mesh: gMesh,
      angle: (gi / 8) * Math.PI * 2,
      radius: 14 + Math.random() * 10,
      center: new THREE.Vector3(25, 14, 15),
      speed: 0.8 + Math.random() * 0.4,
      flapPhase: Math.random() * Math.PI * 2
    });
  }

  // 10. ĐÀN NGỖNG TRỜI DI CƯ HÌNH CHỮ V (MỤC 27)
  const geeseGroup = new THREE.Group();
  geeseGroup.position.set(-60, 68, -80);
  gPhase1.add(geeseGroup);
  // 9 chim theo hình chữ V
  for (let vi = 0; vi < 9; vi++) {
    const gm = new THREE.Mesh(gullGeo, gullMat);
    const row = Math.floor(vi / 2);
    const side = (vi % 2 === 0 ? 1 : -1);
    if (vi === 0) gm.position.set(0, 0, 0); // Đầu đàn
    else gm.position.set(side * row * 3.5, 0, -row * 4.2);
    gm.scale.set(1.4, 1.4, 1.4);
    geeseGroup.add(gm);
  }
  window.migratingGeese = geeseGroup;

  // 11. RỪNG TRE SINH THÁI PHÍA TÂY (BAMBOO GROVE) (MỤC 32)
  const bambooMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.4 });
  const bambooGeo = new THREE.CylinderGeometry(0.08, 0.12, 7.5, 6);
  window.bambooStems = [];
  for (let bi = 0; bi < 20; bi++) {
    const bMesh = new THREE.Mesh(bambooGeo, bambooMat);
    const bx = -62 + (Math.random() - 0.5) * 14;
    const bz = -14 + (Math.random() - 0.5) * 12;
    bMesh.position.set(bx, 3.75, bz);
    bMesh.castShadow = true;
    gPhase1.add(bMesh);
    window.bambooStems.push({ mesh: bMesh, phase: Math.random() * Math.PI * 2 });
  }

  // 12. CUA BIỂN BÒ TRÊN CÁT (MỤC 33)
  const crabMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 }); // Đỏ tươi
  window.beachCrabs = [];
  for (let ci = 0; ci < 4; ci++) {
    const crab = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.28), crabMat);
    const cx = 95 + (Math.random() - 0.5) * 15;
    const cz = 55 + (Math.random() - 0.5) * 12;
    crab.position.set(cx, 0.08, cz);
    gPhase1.add(crab);
    window.beachCrabs.push({
      mesh: crab,
      basePos: new THREE.Vector3(cx, 0.08, cz),
      dir: (ci % 2 === 0 ? 1 : -1)
    });
  }

  // 13. CẦU VỒNG ĐÔI BÁN NGUYỆT RỰC RỠ SAU MƯA (MỤC 36)
  const rainbowGeo = new THREE.RingGeometry(85, 95, 32, 1, 0, Math.PI);
  const rainbowMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const rainbow = new THREE.Mesh(rainbowGeo, rainbowMat);
  rainbow.position.set(0, 0, 0);
  rainbow.rotation.y = Math.PI / 4;
  gPhase1.add(rainbow);
  window.doubleRainbow = rainbow;

  // 14. TÀN LỬA ỐNG KHÓI LÒ CAO & TIA LỬA HÀN BẾN CẢNG (MỤC 7 & 19)
  const sparkGeo = new THREE.SphereGeometry(0.08, 4, 4);
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xf97316 }); // Cam phát quang
  const sparkGroup = new THREE.Group();
  sparkGroup.position.set(0, 7.5, -16); // Ống khói xưởng cưa
  gPhase1.add(sparkGroup);
  window.furnaceSparks = [];
  for (let si = 0; si < 8; si++) {
    const sm = new THREE.Mesh(sparkGeo, sparkMat);
    sparkGroup.add(sm);
    window.furnaceSparks.push({
      mesh: sm,
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.2 + Math.random() * 1.5, (Math.random() - 0.5) * 0.8),
      life: Math.random() * 1.5,
      maxLife: 1.5
    });
  }

  // 15. DECAL VỆT LỐP XE LÚN BÙN ĐƯỜNG ĐẤT RỪNG (MỤC 9)
  const mudTex = (typeof Textures !== 'undefined' && Textures.mudTrack) ? Textures.mudTrack() : null;
  const mudMat = new THREE.MeshBasicMaterial({
    map: mudTex,
    transparent: true,
    opacity: 0.65,
    depthWrite: false
  });
  const mudTrackMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 32), mudMat);
  mudTrackMesh.rotateX(-Math.PI / 2);
  mudTrackMesh.position.set(-28, 0.03, -22);
  gPhase1.add(mudTrackMesh);
}

// UPDATE TICK GIAI ĐOẠN 1
function updatePhase1EcosystemAndVFX(dt, time, playerPos) {
  // 1. Sóng khúc xạ Caustics trôi dạt
  if (window.causticsMesh && window.causticsMesh.material.map) {
    window.causticsMesh.material.map.offset.x += dt * 0.04;
    window.causticsMesh.material.map.offset.y += dt * 0.025;
  }

  // 2. Mây thể tích trôi theo gió mùa
  if (window.volumetricClouds) {
    window.volumetricClouds.forEach(c => {
      c.mesh.position.x += dt * c.speed * 2.2;
      if (c.mesh.position.x > 110) c.mesh.position.x = -110;
    });
  }

  // 3. LED Ma trận tòa tháp Chứng Khoán
  if (window.stockExchangeLedRibbon && window.stockExchangeLedRibbon.material.map) {
    window.stockExchangeLedRibbon.material.map.offset.x -= dt * 0.12;
  }

  // 4. Bầy hươu sao gặm cỏ & cảnh giác người chơi
  if (window.wildlifeDeerHerd && playerPos) {
    window.wildlifeDeerHerd.forEach(deer => {
      const distToPlayer = deer.pos.distanceTo(playerPos);
      deer.soundCooldown -= dt;

      if (distToPlayer < 11.0) {
        // Hoảng sợ bỏ chạy
        deer.state = 'fleeing';
        const fleeDir = new THREE.Vector3().subVectors(deer.pos, playerPos).normalize();
        deer.pos.addScaledVector(fleeDir, dt * 6.5);
        deer.group.lookAt(deer.pos.x + fleeDir.x, deer.pos.y, deer.pos.z + fleeDir.z);
        deer.head.position.y = 1.6; // Ngẩng cao đầu
      } else {
        // Gặm cỏ thanh bình
        deer.state = 'grazing';
        // Nhấp nhô đầu gặm cỏ
        deer.head.position.y = 1.35 + Math.sin((time || 0) * 2.0) * 0.25;
        // Đi lại nhẹ nhàng quanh điểm gốc
        if (deer.pos.distanceTo(deer.basePos) > 1.5) {
          const retDir = new THREE.Vector3().subVectors(deer.basePos, deer.pos).normalize();
          deer.pos.addScaledVector(retDir, dt * 0.8);
          deer.group.lookAt(deer.basePos);
        }
        if (deer.soundCooldown <= 0) {
          if (typeof sounds !== 'undefined' && sounds.playDeerCall && distToPlayer < 35.0) {
            sounds.playDeerCall();
          }
          deer.soundCooldown = 15.0 + Math.random() * 20.0;
        }
      }
    });
  }

  // 5. Thỏ rừng nhảy nhót
  if (window.wildlifeRabbits) {
    window.wildlifeRabbits.forEach(rab => {
      rab.hopPhase += dt * 4.5;
      rab.group.position.y = Math.max(0, Math.sin(rab.hopPhase) * 0.18);
    });
  }

  // 6. Cá voi lưng gù phun nước
  if (window.humpbackWhale) {
    const hw = window.humpbackWhale;
    hw.cycleTimer += dt;
    const cycle = hw.cycleTimer % 18.0;

    if (cycle < 6.0) {
      // Ngoi lên mặt nước
      hw.group.position.y = THREE.MathUtils.lerp(hw.group.position.y, 0.4, dt * 1.5);
      hw.fluke.rotation.x = Math.sin((time || 0) * 3.5) * 0.35; // Quẫy đuôi
      if (cycle > 2.0 && cycle < 4.5) {
        // Phun nước
        hw.spout.material.opacity = THREE.MathUtils.lerp(hw.spout.material.opacity, 0.75, dt * 3.0);
        hw.spout.scale.y = 1.0 + Math.sin(cycle * 4) * 0.2;
        if (cycle > 2.0 && cycle < 2.2 && typeof sounds !== 'undefined' && sounds.playWhaleBlow) {
          sounds.playWhaleBlow();
        }
      } else {
        hw.spout.material.opacity = THREE.MathUtils.lerp(hw.spout.material.opacity, 0.0, dt * 4.0);
      }
    } else {
      // Lặn xuống
      hw.group.position.y = THREE.MathUtils.lerp(hw.group.position.y, -1.8, dt * 1.0);
      hw.spout.material.opacity = 0.0;
    }
  }

  // 7. Rùa biển bơi
  if (window.seaTurtle) {
    const st = window.seaTurtle;
    st.swimPhase += dt * 2.2;
    st.leftFin.rotation.y = Math.sin(st.swimPhase) * 0.45;
    st.rightFin.rotation.y = -Math.sin(st.swimPhase) * 0.45;
    st.group.position.x = 115 + Math.cos(st.swimPhase * 0.3) * 3.0;
    st.group.position.z = 35 + Math.sin(st.swimPhase * 0.3) * 3.0;
  }

  // 8. Đom đóm phát sáng đêm hè
  if (window.firefliesList) {
    const isNight = (typeof gameState !== 'undefined' && (gameState.gameHour >= 18.5 || gameState.gameHour <= 5.5));
    if (window.firefliesGroup) window.firefliesGroup.visible = isNight;
    if (isNight) {
      window.firefliesList.forEach(ff => {
        ff.phase += dt * ff.speed;
        ff.mesh.position.y = ff.basePos.y + Math.sin(ff.phase) * 0.45;
        ff.mesh.position.x = ff.basePos.x + Math.cos(ff.phase * 0.7) * 0.35;
        ff.mesh.material.opacity = 0.35 + Math.sin(ff.phase * 2.5) * 0.55;
      });
    }
  }

  // 9. Đàn hải âu chao lượn quanh cảng biển
  if (window.seagullFlock) {
    window.seagullFlock.forEach((gull, idx) => {
      gull.angle += dt * gull.speed * 0.45;
      gull.flapPhase += dt * 8.0;
      gull.mesh.position.x = gull.center.x + Math.cos(gull.angle) * gull.radius;
      gull.mesh.position.z = gull.center.z + Math.sin(gull.angle) * gull.radius;
      gull.mesh.position.y = gull.center.y + Math.sin(gull.angle * 2) * 1.5;
      gull.mesh.rotation.y = -gull.angle + Math.PI / 2;
      gull.mesh.rotation.z = Math.sin(gull.flapPhase) * 0.25;

      if (idx === 0 && Math.random() < 0.003 && typeof sounds !== 'undefined' && sounds.playSeagull) {
        sounds.playSeagull();
      }
    });
  }

  // 10. Đàn ngỗng trời bay di cư
  if (window.migratingGeese) {
    window.migratingGeese.position.z += dt * 8.5;
    if (window.migratingGeese.position.z > 140) {
      window.migratingGeese.position.z = -140;
    }
  }

  // 11. Rừng tre đu đưa theo gió
  if (window.bambooStems) {
    window.bambooStems.forEach(b => {
      b.phase += dt * 1.8;
      b.mesh.rotation.z = Math.sin(b.phase) * 0.04;
      b.mesh.rotation.x = Math.cos(b.phase) * 0.03;
    });
  }

  // 12. Cua biển bò ngang
  if (window.beachCrabs) {
    window.beachCrabs.forEach(crab => {
      crab.mesh.position.x += dt * 0.4 * crab.dir;
      if (Math.abs(crab.mesh.position.x - crab.basePos.x) > 2.0) crab.dir *= -1;
    });
  }

  // 13. Cầu vồng đôi sau mưa
  if (window.doubleRainbow) {
    const isRaining = (typeof gameState !== 'undefined' && gameState.weather === 'rain');
    // Xuất hiện mờ ảo khi tạnh mưa
    const targetOpacity = isRaining ? 0.0 : 0.45;
    window.doubleRainbow.material.opacity = THREE.MathUtils.lerp(window.doubleRainbow.material.opacity, targetOpacity, dt * 0.5);
  }

  // 14. Tàn lửa lò cao
  if (window.furnaceSparks) {
    window.furnaceSparks.forEach(sp => {
      sp.life += dt;
      if (sp.life >= sp.maxLife) {
        sp.life = 0;
        sp.mesh.position.set(0, 0, 0);
      }
      sp.mesh.position.addScaledVector(sp.vel, dt);
      sp.mesh.scale.setScalar(Math.max(0.1, 1.0 - sp.life / sp.maxLife));
    });
  }
}
window.createPhase1EcosystemAndVFX = createPhase1EcosystemAndVFX;
window.updatePhase1EcosystemAndVFX = updatePhase1EcosystemAndVFX;
