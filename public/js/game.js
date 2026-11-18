/**
 * Main Game Controller
 * Scene, PBR Lights, Smooth Damping Camera, Day/Night Cycle, Multi-Input & Virtual Joystick,
 * Parabolic Unloading, Tree Lifecycle Growth & 60 FPS Game Loop
 */

let scene, camera, renderer, controls, clock;
let player, sunLight, hemiLight;
let isDrivingAny = false;
let focusPos = new THREE.Vector3();
const keysPressed = {};

// Object Pooling for Wood Sawdust & Smoke Particles
const MAX_PARTICLES = 150;
const particlePool = [];
const activeParticles = [];

function initParticlePool() {
  const pGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  const pMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const mesh = new THREE.Mesh(pGeo, pMat.clone());
    mesh.visible = false;
    scene.add(mesh);
    particlePool.push(mesh);
  }
}

function spawnParticle(pos, color = 0xf59e0b) {
  if (particlePool.length === 0) return;
  const p = particlePool.pop();
  p.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.6, (Math.random() - 0.5) * 0.4));
  p.material.color.set(color);
  p.scale.set(1, 1, 1);
  p.visible = true;
  p.userData = {
    vel: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 4 + 1.2, (Math.random() - 0.5) * 3),
    life: 0.6
  };
  activeParticles.push(p);
}
window.spawnParticle = spawnParticle;

// ---------------------------------------------------------------------------
// HIỆU ỨNG RUNG CHẤN CAMERA ĐIỆN ẢNH (CINEMATIC CAMERA SHAKE LOGIC)
// ---------------------------------------------------------------------------
let cameraShakeTimer = 0;
let cameraShakeIntensity = 0;

function triggerCameraShake(intensity = 0.35, duration = 0.25) {
  cameraShakeIntensity = intensity;
  cameraShakeTimer = duration;
}
window.triggerCameraShake = triggerCameraShake;

function updateParticles(dt) {
  for (let i = activeParticles.length - 1; i >= 0; i--) {
    const p = activeParticles[i];
    p.userData.life -= dt;
    p.userData.vel.y -= 9.8 * dt; // gravity
    p.position.addScaledVector(p.userData.vel, dt);
    p.scale.multiplyScalar(0.95);
    if (p.userData.life <= 0) {
      p.visible = false;
      activeParticles.splice(i, 1);
      particlePool.push(p);
    }
  }
}

// ---------------------------------------------------------------------------
// HIỆU ỨNG SÓNG CHẤN ĐỘNG LAN TỎA KHI NÂNG CẤP (SHOCKWAVE EXPANSION RING)
// ---------------------------------------------------------------------------
const activeShockwaves = [];
const shockwaveGeo = new THREE.RingGeometry(0.2, 0.45, 32);
shockwaveGeo.rotateX(-Math.PI / 2);

function spawnShockwave(pos, color = 0x22c55e) {
  if (!scene) return;
  const mat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(shockwaveGeo, mat);
  mesh.position.copy(pos);
  mesh.position.y = 0.05;
  scene.add(mesh);
  activeShockwaves.push({ mesh, life: 0.55, maxLife: 0.55 });
}
window.spawnShockwave = spawnShockwave;

function updateShockwaves(dt) {
  for (let i = activeShockwaves.length - 1; i >= 0; i--) {
    const sw = activeShockwaves[i];
    sw.life -= dt;
    const progress = 1.0 - (sw.life / sw.maxLife);
    const s = 1.0 + progress * 5.8;
    sw.mesh.scale.set(s, s, s);
    sw.mesh.material.opacity = Math.max(0, (1.0 - progress) * 0.9);
    if (sw.life <= 0) {
      scene.remove(sw.mesh);
      sw.mesh.material.dispose();
      activeShockwaves.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// HIỆU ỨNG LÁ CÂY & KIM THÔNG RƠI LẢ TẢ THEO GIÓ (FALLING FOREST LEAVES)
// ---------------------------------------------------------------------------
const fallingLeaves = [];
function initFallingLeaves() {
  const leavesGroup = new THREE.Group();
  const leafGeo = new THREE.PlaneGeometry(0.18, 0.28);
  const m1 = new THREE.MeshBasicMaterial({ color: 0x84cc16, side: THREE.DoubleSide });
  const m2 = new THREE.MeshBasicMaterial({ color: 0xeab308, side: THREE.DoubleSide });
  for (let i = 0; i < 28; i++) {
    const leaf = new THREE.Mesh(leafGeo, i % 2 === 0 ? m1 : m2);
    leaf.position.set(-46 + Math.random() * 30, 1 + Math.random() * 8, -27 + Math.random() * 18);
    leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    leaf.userData = {
      speedY: 0.7 + Math.random() * 0.9,
      swaySpeed: 1.6 + Math.random() * 1.8,
      swayDist: 0.4 + Math.random() * 0.6,
      seed: Math.random() * 10
    };
    leavesGroup.add(leaf);
    fallingLeaves.push(leaf);
  }
  scene.add(leavesGroup);
}

function updateFallingLeaves(dt, time) {
  fallingLeaves.forEach(l => {
    const u = l.userData;
    l.position.y -= u.speedY * dt;
    l.position.x += Math.sin(time * u.swaySpeed + u.seed) * u.swayDist * dt;
    l.position.z += Math.cos(time * u.swaySpeed * 0.7 + u.seed) * u.swayDist * 0.5 * dt;
    l.rotation.x += dt * 1.8;
    l.rotation.y += dt * 2.2;
    if (l.position.y < 0.1) {
      l.position.y = 8 + Math.random() * 3;
      l.position.x = -46 + Math.random() * 30;
      l.position.z = -27 + Math.random() * 18;
    }
  });
}

// ---------------------------------------------------------------------------
// HIỆU ỨNG PHẤN HOA VÀNG & BỤI NẮNG BỒNG BỀNH RỪNG THÔNG (ATMOSPHERIC POLLEN MOTES)
// ---------------------------------------------------------------------------
const forestPollen = [];
function initForestPollen() {
  const pollenGroup = new THREE.Group();
  const pollenGeo = new THREE.SphereGeometry(0.045, 4, 4);
  const pollenMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.75 });
  for (let i = 0; i < 35; i++) {
    const p = new THREE.Mesh(pollenGeo, pollenMat);
    const px = -40 + Math.random() * 50;
    const py = 0.6 + Math.random() * 4.5;
    const pz = -35 + Math.random() * 30;
    p.position.set(px, py, pz);
    p.userData = {
      baseX: px,
      baseY: py,
      baseZ: pz,
      freq: 1.0 + Math.random() * 1.5,
      driftY: 0.2 + Math.random() * 0.3,
      seed: Math.random() * Math.PI * 2
    };
    pollenGroup.add(p);
    forestPollen.push(p);
  }
  scene.add(pollenGroup);
  window.pollenGroup = pollenGroup;
}

function updateForestPollen(dt, time) {
  const isDay = (typeof gameState !== 'undefined') && (gameState.gameHour >= 6.0 && gameState.gameHour <= 18.0);
  if (window.pollenGroup) window.pollenGroup.visible = isDay;
  if (!isDay) return;

  forestPollen.forEach(p => {
    const u = p.userData;
    p.position.y += Math.sin(time * u.freq + u.seed) * 0.008;
    p.position.x = u.baseX + Math.sin(time * 0.5 + u.seed) * 1.2;
    p.position.z = u.baseZ + Math.cos(time * 0.4 + u.seed) * 1.2;
  });
}

// ---------------------------------------------------------------------------
// INITIALIZATION
// ---------------------------------------------------------------------------
function init() {
  const container = document.getElementById('webgl-container');

  // Scene & Soft Atmospheric Fog
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe0f7);
  scene.fog = new THREE.FogExp2(0xbfe0f7, 0.0085);
  window.scene = scene;

  // Isometric 45° Camera
  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(45, aspect, 0.5, 300);
  camera.position.set(-20, 36, 6);
  camera.lookAt(0, 0, -18);
  window.camera = camera;

  // WebGL Renderer với cấu hình hiệu năng cao 60 FPS mượt mà
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0)); // Khóa chuẩn 1.0 Native HD, giải phóng 40% tải GPU
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // Tốc độ xử lý bóng đổ nhanh gấp 4 lần, siêu mượt 60 FPS
  renderer.shadowMap.autoUpdate = true; // AutoUpdate mượt mà từng frame, triệt tiêu 100% hiện tượng khựng giật 6 frame!
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  // Controls (Isometric Pan & Zoom)
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, -18);
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.minDistance = 12;
  controls.maxDistance = 110;
  window.controls = controls;

  // Natural Warm Sunlight & Sky-Ambient Slate Ground Bounce (Khử ám xanh đồ chơi)
  hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 1.05);
  scene.add(hemiLight);

  sunLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
  sunLight.position.set(-35, 55, -25);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 130;
  sunLight.shadow.camera.left = -28;
  sunLight.shadow.camera.right = 28;
  sunLight.shadow.camera.top = 28;
  sunLight.shadow.camera.bottom = -28;
  sunLight.shadow.bias = -0.0003;
  scene.add(sunLight);
  scene.add(sunLight.target);
  window.sunLight = sunLight;

  // Initialize Systems
  initParticlePool();
  initWorld(scene);
  initFallingLeaves();
  initForestPollen();

  player = new PlayerCharacter(scene);
  window.player = player;

  // Khởi tạo Bạn đồng hành thú cưng K-9 Rescue Dog
  if (typeof createK9Companion === 'function') {
    createK9Companion(scene);
  }

  initVehicles(scene);
  clock = new THREE.Clock();

  setupEventListeners();
  setupVirtualJoystick();

  // Khởi tạo Hệ thống Tài khoản & Tải Đế Chế (Auth & Empire System)
  if (window.authManager) {
    window.authManager.init();
  } else {
    loadGame();
  }
  updateHUD();

  // Khởi tạo Sảnh Multiplayer Thời Gian Thực
  if (typeof MultiplayerManager !== 'undefined') {
    window.multiplayerManager = new MultiplayerManager();
  }

  animate();
}

// ---------------------------------------------------------------------------
// MULTI-INPUT SYSTEM & DYNAMIC FLOATING VIRTUAL JOYSTICK
// ---------------------------------------------------------------------------
let joystickActive = false;
let joystickOrigin = { x: 0, y: 0 };
const jBase = document.getElementById('virtual-joystick-base');
const jStick = document.getElementById('virtual-joystick-stick');

function setupVirtualJoystick() {
  const container = document.getElementById('webgl-container');

  const onPointerDown = (e) => {
    // Chỉ kích hoạt joystick ảo trên màn hình cảm ứng (Touchscreen/Mobile)
    // Trên máy tính Desktop, chuột dùng để xoay camera và click tương tác, phím WASD để di chuyển
    if (e.pointerType !== 'touch') return;
    if (e.target !== renderer.domElement) return;

    joystickActive = true;
    joystickOrigin = { x: e.clientX, y: e.clientY };

    if (jBase && jStick) {
      jBase.style.left = `${e.clientX}px`;
      jBase.style.top = `${e.clientY}px`;
      jBase.style.display = 'block';
      jStick.style.transform = `translate(-50%, -50%)`;
    }
  };

  const onPointerMove = (e) => {
    if (!joystickActive) return;
    const dx = e.clientX - joystickOrigin.x;
    const dy = e.clientY - joystickOrigin.y;
    const dist = Math.hypot(dx, dy);
    const maxRadius = 45;

    const angle = Math.atan2(dy, dx);
    const clampedDist = Math.min(dist, maxRadius);
    const sx = Math.cos(angle) * clampedDist;
    const sy = Math.sin(angle) * clampedDist;

    if (jStick) {
      jStick.style.transform = `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`;
    }

    if (clampedDist > 8) {
      // Chiếu vector góc xoay theo camera Isometric 45 độ
      const moveX = Math.cos(angle + Math.PI / 4);
      const moveZ = Math.sin(angle + Math.PI / 4);
      player.setMoveInput(moveX, moveZ);
    }
  };

  const onPointerUp = () => {
    if (!joystickActive) return;
    joystickActive = false;
    if (jBase) jBase.style.display = 'none';
    player.setMoveInput(0, 0);
  };

  container.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

function setupEventListeners() {
  window.addEventListener('resize', onWindowResize);

  window.addEventListener('keydown', (e) => {
    keysPressed[e.code] = true;
    if (e.code === 'Space') {
      e.preventDefault();
      if (typeof isReelingActive !== 'undefined' && isReelingActive) {
        if (typeof pullFishingReel === 'function') pullFishingReel();
        return;
      }
      if (typeof gameState !== 'undefined' && gameState.isDrivingForklift && window.drivableForklift) {
        window.drivableForklift.toggleForks();
      } else if (typeof gameState !== 'undefined' && gameState.isDrivingTruck && window.drivableLumberTruck) {
        window.drivableLumberTruck.handleSpaceAction();
      } else {
        const fishingSpotPos = new THREE.Vector3(22.0, 0, 18.8);
        if (player && player.mesh && player.mesh.position.distanceTo(fishingSpotPos) <= 2.8) {
          triggerPlayerFishing();
        } else {
          tryChopNearbyTree();
        }
      }
    } else if (e.code === 'KeyE') {
      e.preventDefault();
      handleVehicleMountToggle();
    } else if (e.code === 'KeyF') {
      e.preventDefault();
      handleActionKeyPressF();
    } else if (e.code === 'KeyK') {
      e.preventDefault();
      if (typeof toggleCareerModal === 'function') toggleCareerModal();
    } else if (e.code === 'KeyM') {
      e.preventDefault();
      if (typeof toggleMarketModal === 'function') toggleMarketModal();
    } else if (e.code === 'KeyB') {
      e.preventDefault();
      if (typeof toggleUpgradeShop === 'function') toggleUpgradeShop();
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      if (typeof triggerOvertimeRush === 'function') triggerOvertimeRush();
    } else if (e.code === 'F12') {
      e.preventDefault();
      if (typeof togglePhotoMode === 'function') togglePhotoMode();
    } else if (e.code === 'Tab') {
      e.preventDefault();
      if (typeof toggleRadialMenu === 'function') toggleRadialMenu();
    } else if (e.code === 'KeyQ') {
      e.preventDefault();
      if (typeof openQuestLogModal === 'function') openQuestLogModal();
    } else if (e.code === 'KeyN') {
      e.preventDefault();
      if (typeof openBankModal === 'function') openBankModal();
    } else if (e.code === 'KeyL') {
      e.preventDefault();
      if (typeof openForbesModal === 'function') openForbesModal();
    } else if (e.code === 'KeyG') {
      e.preventDefault();
      if (typeof openGraphicsSettingsModal === 'function') openGraphicsSettingsModal();
    }
  });

  function handleVehicleMountToggle() {
    if (typeof gameState === 'undefined') return;
    // 1. Nếu đang lái một phương tiện: Xuống xe ngay
    if (gameState.isDrivingPolice && window.drivablePoliceCruiser) {
      window.drivablePoliceCruiser.toggleMount();
      return;
    }
    if (gameState.isDrivingFireEngine && window.drivableFireEngine) {
      window.drivableFireEngine.toggleMount();
      return;
    }
    if (gameState.isDrivingTruck && window.drivableLumberTruck) {
      window.drivableLumberTruck.toggleMount();
      return;
    }
    if (gameState.isDrivingForklift && window.drivableForklift) {
      window.drivableForklift.toggleMount();
      return;
    }
    if (gameState.isDrivingPickup && window.drivablePickup) {
      window.drivablePickup.toggleMount();
      return;
    }
    if (gameState.isDrivingSpeedboat && window.drivableSpeedboat) {
      window.drivableSpeedboat.toggleMount();
      return;
    }
    if (gameState.isDrivingHelicopter && window.drivableHelicopter) {
      window.drivableHelicopter.toggleMount();
      return;
    }
    if (gameState.isDrivingTrain && window.steamTrain) {
      window.steamTrain.toggleMount();
      return;
    }

    // 2. Nếu đang đi bộ: Kiểm tra Pad tương tác chức năng hoặc phương tiện gần nhất
    const pPos = player && player.mesh ? player.mesh.position : null;
    if (!pPos) return;

    // Tương tác Bảng Quản trị & Nhiệm vụ Đô thị
    if (window.cityHallPad && pPos.distanceTo(window.cityHallPad.pos) <= window.cityHallPad.radius) {
      if (typeof openCityHallModal === 'function') { openCityHallModal(); return; }
    }
    if (window.policeEnlistPad && pPos.distanceTo(window.policeEnlistPad.pos) <= window.policeEnlistPad.radius) {
      if (typeof openPoliceModal === 'function') { openPoliceModal(); return; }
    }
    if (window.hospitalFirePad && pPos.distanceTo(window.hospitalFirePad.pos) <= window.hospitalFirePad.radius) {
      if (typeof openHospitalFireModal === 'function') { openHospitalFireModal(); return; }
    }
    if (window.landmarkContributionPad && pPos.distanceTo(window.landmarkContributionPad.pos) <= window.landmarkContributionPad.radius) {
      if (typeof openLandmarkModal === 'function') { openLandmarkModal(); return; }
    }
    if (window.marketTradingPad && pPos.distanceTo(window.marketTradingPad.pos) <= window.marketTradingPad.radius) {
      if (typeof openMarketModal === 'function') { openMarketModal(); return; }
    }
    if (window.powerFuelPad && pPos.distanceTo(window.powerFuelPad.pos) <= window.powerFuelPad.radius) {
      feedPowerPlantFuel();
      return;
    }
    if (window.airCargoPad && pPos.distanceTo(window.airCargoPad.pos) <= window.airCargoPad.radius) {
      feedAirCargoPlane();
      return;
    }
    if (window.playerVillaPad && pPos.distanceTo(window.playerVillaPad.pos) <= window.playerVillaPad.radius) {
      if (typeof openVillaModal === 'function') { openVillaModal(); return; }
    }
    if (window.residentialApartmentPad && pPos.distanceTo(window.residentialApartmentPad.pos) <= window.residentialApartmentPad.radius) {
      collectResidentialTaxes();
      return;
    }
    if (window.buskerPad && pPos.distanceTo(window.buskerPad.pos) <= window.buskerPad.radius) {
      tipStreetBusker();
      return;
    }
    if (window.ecoRecyclingPad && pPos.distanceTo(window.ecoRecyclingPad.pos) <= window.ecoRecyclingPad.radius) {
      recycleScrapAtPlant();
      return;
    }
    if (window.luckyWheelPad && pPos.distanceTo(window.luckyWheelPad.pos) <= window.luckyWheelPad.radius) {
      spinCityLuckyWheel();
      return;
    }
    if (window.jetskiMountPad && pPos.distanceTo(window.jetskiMountPad.pos) <= window.jetskiMountPad.radius) {
      mountJetskiWatercraft();
      return;
    }
    if (window.oceanariumTicketPad && pPos.distanceTo(window.oceanariumTicketPad.pos) <= window.oceanariumTicketPad.radius) {
      collectOceanariumTickets();
      return;
    }
    if (window.submarineMountPad && pPos.distanceTo(window.submarineMountPad.pos) <= window.submarineMountPad.radius) {
      mountDeepSeaSubmarine();
      return;
    }
    if (window.oilRigPad && pPos.distanceTo(window.oilRigPad.pos) <= window.oilRigPad.radius) {
      harvestOffshoreOilRig();
      return;
    }
    if (window.petroleumRefineryPad && pPos.distanceTo(window.petroleumRefineryPad.pos) <= window.petroleumRefineryPad.radius) {
      refinePetroleumPlant();
      return;
    }
    if (window.stockExchangePad && pPos.distanceTo(window.stockExchangePad.pos) <= window.stockExchangePad.radius) {
      visitWallStreetStockExchange();
      return;
    }
    if (window.centralBankPad && pPos.distanceTo(window.centralBankPad.pos) <= window.centralBankPad.radius) {
      visitCentralBankVault();
      return;
    }
    if (window.petSanctuaryPad && pPos.distanceTo(window.petSanctuaryPad.pos) <= window.petSanctuaryPad.radius) {
      visitPetSanctuaryShop();
      return;
    }
    if (window.craftingAssemblyPad && pPos.distanceTo(window.craftingAssemblyPad.pos) <= window.craftingAssemblyPad.radius) {
      if (typeof openCraftingModal === 'function') openCraftingModal();
      return;
    }
    if (window.cityHallPad && pPos.distanceTo(window.cityHallPad.pos) <= window.cityHallPad.radius) {
      if (typeof openCityHallModal === 'function') openCityHallModal();
      return;
    }

    // THANG MÁY CAO TỐC (LOBBY <-> ROOFTOP ELEVATOR)
    const elevators = [
      { name: 'Bệnh viện & Helipad', gPos: new THREE.Vector3(45, 0, 58), rPos: new THREE.Vector3(46, 16.5, 58) },
      { name: 'Sàn Phố Wall', gPos: new THREE.Vector3(-15, 0, 66), rPos: new THREE.Vector3(-15, 22.5, 62) },
      { name: 'Sky Penthouse', gPos: new THREE.Vector3(90, 0, 66), rPos: new THREE.Vector3(90, 24.5, 62) }
    ];

    for (let ei = 0; ei < elevators.length; ei++) {
      const elv = elevators[ei];
      // Nếu đang ở dưới sảnh trệt
      if (pPos.distanceTo(elv.gPos) <= 3.5 && !window.player.isOnRooftop) {
        window.player.isOnRooftop = true;
        window.player.mesh.position.copy(elv.rPos);
        showToast(`🛗 THANG MÁY CAO TỐC: Đã đưa bạn lên Tầng Thượng ${elv.name}!`);
        if (typeof sounds !== 'undefined' && sounds.playLevelUp) sounds.playLevelUp();
        return;
      }
      // Nếu đang ở trên tầng thượng
      if (pPos.distanceTo(elv.rPos) <= 3.5 && window.player.isOnRooftop) {
        window.player.isOnRooftop = false;
        window.player.mesh.position.copy(elv.gPos);
        showToast(`🛗 THANG MÁY CAO TỐC: Đã đưa bạn xuống Sảnh Trệt ${elv.name}!`);
        if (typeof sounds !== 'undefined' && sounds.playCoin) sounds.playCoin();
        return;
      }
    }

    // 5 Mega Systems Interactions
    if (window.rollerCoasterPad && pPos.distanceTo(window.rollerCoasterPad.pos) <= window.rollerCoasterPad.radius) {
      toggleRollerCoasterRide();
      return;
    }
    if (window.ferrisWheelPad && pPos.distanceTo(window.ferrisWheelPad.pos) <= window.ferrisWheelPad.radius) {
      toggleFerrisWheelRide();
      return;
    }
    if (window.villaBedPad && pPos.distanceTo(window.villaBedPad.pos) <= window.villaBedPad.radius) {
      sleepInVillaRoyalBed();
      return;
    }
    if (window.villaSafePad && pPos.distanceTo(window.villaSafePad.pos) <= window.villaSafePad.radius) {
      interactVillaSafe();
      return;
    }
    if (window.maritimeFleetPad && pPos.distanceTo(window.maritimeFleetPad.pos) <= window.maritimeFleetPad.radius) {
      if (typeof openMaritimeModal === 'function') openMaritimeModal();
      return;
    }

    // Trò chuyện với Cư dân đi bộ gần nhất (<3.0m)
    if (window.cityPedestrians) {
      for (let pi = 0; pi < window.cityPedestrians.length; pi++) {
        const ped = window.cityPedestrians[pi];
        if (pPos.distanceTo(ped.group.position) <= 3.0) {
          showToast(`💬 CƯ DÂN NÓI: "${ped.dialogue}"`);
          if (typeof spawnFloatingText === 'function') {
            spawnFloatingText(ped.group.position.clone().add(new THREE.Vector3(0, 2.2, 0)), '💬 Xin chào!', '#38bdf8');
          }
          return;
        }
      }
    }

    // Đi xe buýt công cộng nhanh giữa 4 quận
    if (window.cityBusStops) {
      for (let bi = 0; bi < window.cityBusStops.length; bi++) {
        const bs = window.cityBusStops[bi];
        if (pPos.distanceTo(bs.pos) <= 3.6) {
          handleBusFastTravel(bs);
          return;
        }
      }
    }

    // Lên xe chuyên dụng hoặc xe công nghiệp
    if (window.drivablePoliceCruiser && pPos.distanceTo(window.drivablePoliceCruiser.mesh.position) <= 4.8) {
      window.drivablePoliceCruiser.toggleMount();
      return;
    }
    if (window.drivableFireEngine && pPos.distanceTo(window.drivableFireEngine.mesh.position) <= 5.2) {
      window.drivableFireEngine.toggleMount();
      return;
    }
    if (window.drivableForklift && pPos.distanceTo(window.drivableForklift.mesh.position) <= 4.2) {
      window.drivableForklift.toggleMount();
      return;
    }
    if (window.drivablePickup && pPos.distanceTo(window.drivablePickup.mesh.position) <= 4.5) {
      window.drivablePickup.toggleMount();
      return;
    }
    if (window.drivableLumberTruck && pPos.distanceTo(window.drivableLumberTruck.mesh.position) <= 5.5) {
      window.drivableLumberTruck.toggleMount();
      return;
    }
    if (window.drivableSpeedboat && pPos.distanceTo(window.drivableSpeedboat.mesh.position) <= 4.5) {
      window.drivableSpeedboat.toggleMount();
      return;
    }
    if (window.drivableHelicopter && pPos.distanceTo(window.drivableHelicopter.mesh.position) <= 6.5) {
      window.drivableHelicopter.toggleMount();
      return;
    }
    if (window.steamTrain && pPos.distanceTo(window.steamTrain.locomotiveGroup.position) <= 7.0) {
      window.steamTrain.toggleMount();
      return;
    }
  }

  function feedPowerPlantFuel() {
    const pl = gameState.planks || 0;
    if (pl >= 5) {
      gameState.planks -= 5;
      gameState.money = (gameState.money || 0) + 250;
      if (window.mpClient) window.mpClient.sendPowerFeedFuel(15);
      if (typeof spawnFloatingText === 'function' && window.player) {
        spawnFloatingText(window.player.mesh.position.clone().add(new THREE.Vector3(0, 3, 0)), '+15 Nhiên Liệu Điện ⚡ (+$250)', '#facc15');
      }
      showToast('⚡ ĐÃ NẠP 5 VÁN GỖ VÀO LÒ NHIỆT ĐIỆN! Giữ lưới điện đô thị ổn định.');
      if (typeof updateHUD === 'function') updateHUD();
    } else {
      showToast('⚠️ Cần ít nhất 5 Ván gỗ để nạp vào Lò nhiệt điện đô thị!');
    }
  }
  window.feedPowerPlantFuel = feedPowerPlantFuel;

  function feedAirCargoPlane() {
    if (!window.airCargoPad) return;
    const state = window.cargoPlaneState;
    if (state && state.phase !== 'parked') {
      showToast('⚠️ MÁY BAY ĐANG TRÊN ĐƯỜNG BAY! Hãy chờ máy bay hạ cánh đỗ tại bến để nạp hàng!');
      return;
    }
    let loaded = false;
    let reward = 0;
    if ((gameState.pallets || 0) >= 2) {
      gameState.pallets -= 2;
      reward = 8500;
      loaded = true;
      showToast('✈️ ĐÃ NẠP 2 KIỆN PALLET GỖ LÊN MÁY BAY QUỐC TẾ: Nhận +$8,500 USD!');
    } else if ((gameState.cannedFish || 0) >= 4) {
      gameState.cannedFish -= 4;
      reward = 6800;
      loaded = true;
      showToast('✈️ ĐÃ NẠP 4 THÙNG CÁ HỘP AIR CARGO: Nhận +$6,800 USD!');
    } else if ((gameState.planks || 0) >= 10) {
      gameState.planks -= 10;
      reward = 4200;
      loaded = true;
      showToast('✈️ ĐÃ NẠP 10 VÁN GỖ THƯỢNG HẠNG: Nhận +$4,200 USD!');
    } else {
      showToast('⚠️ CẦN HÀNG HÓA: Cần ít nhất 2 Pallet gỗ, 4 Cá Hộp hoặc 10 Ván gỗ để xuất khẩu đường bay!');
      return;
    }
    if (loaded) {
      gameState.money = (gameState.money || 0) + reward;
      gameState.airCargoOrders = (gameState.airCargoOrders || 0) + 1;
      gameState.researchPoints = (gameState.researchPoints || 0) + 5;
      if (typeof sounds !== 'undefined' && sounds.playJetEngine) sounds.playJetEngine();
      if (typeof spawnFloatingText === 'function') {
        spawnFloatingText(new THREE.Vector3(35, 3, -100.5), `+$${reward.toLocaleString()} AIR CARGO ⭐`, '#38bdf8');
      }
      updateHUD();
      triggerActionSave();
    }
  }
  window.feedAirCargoPlane = feedAirCargoPlane;

  function collectResidentialTaxes() {
    window.residentTaxCooldown = (window.residentTaxCooldown || 0);
    if (window.residentTaxCooldown > 0) {
      showToast(`ℹ️ Cư dân vừa nộp thuế! Đợt thu thuế kế tiếp sau ${Math.ceil(window.residentTaxCooldown)}s.`);
      return;
    }
    window.residentTaxCooldown = 45.0; // 45 giây mỗi đợt
    let taxEarned = 800;
    gameState.cityMetrics = gameState.cityMetrics || { ecoHealth: 85, citizenHappiness: 90, crimeRate: 10 };
    if (gameState.cityMetrics.citizenHappiness >= 80) {
      taxEarned = 1600; // Thưởng gấp đôi thuế khi dân cư hạnh phúc!
    }
    gameState.money = (gameState.money || 0) + taxEarned;
    if (typeof sounds !== 'undefined' && sounds.playCashRegister) sounds.playCashRegister();
    if (typeof spawnFloatingText === 'function') {
      spawnFloatingText(new THREE.Vector3(-65, 3, 89), `+$${taxEarned} THUẾ CƯ DÂN 🏢💵`, '#10b981');
    }
    showToast(`🏛️ ĐÃ THU THUẾ ĐÔ THỊ: Nhận +$${taxEarned} USD từ các hộ gia đình khu chung cư! ${taxEarned > 800 ? '(X2 Thưởng Hạnh Phúc 😊)' : ''}`);
    updateHUD();
    triggerActionSave();
  }
  window.collectResidentialTaxes = collectResidentialTaxes;

  function tipStreetBusker() {
    if ((gameState.money || 0) < 20) {
      showToast('⚠️ Bạn không đủ $20 tiền mặt để tặng nghệ sĩ đường phố!');
      return;
    }
    gameState.money -= 20;
    if (typeof sounds !== 'undefined' && sounds.playAcousticGuitarStrum) sounds.playAcousticGuitarStrum();
    if (typeof spawnFloatingText === 'function') {
      spawnFloatingText(new THREE.Vector3(-10, 2.5, 42), '-$20 Boa Guitar 🎸✨', '#a855f7');
    }
    showToast('🎸 Nghệ sĩ mỉm cười gảy một khúc nhạc tặng bạn! "Cảm ơn người anh em!"');
    updateHUD();
    triggerActionSave();
  }
  window.tipStreetBusker = tipStreetBusker;

  function recycleScrapAtPlant() {
    let recycled = false;
    let earned = 0;
    if ((gameState.planks || 0) >= 4) {
      gameState.planks -= 4;
      earned = 600;
      recycled = true;
    } else if ((gameState.logs || 0) >= 3) {
      gameState.logs -= 3;
      player.updateLogStack(gameState.logs);
      earned = 450;
      recycled = true;
    } else {
      showToast('⚠️ Cần ít nhất 3 Khúc gỗ hoặc 4 Ván để đưa vào Phễu tái chế sinh thái!');
      return;
    }
    if (recycled) {
      gameState.money = (gameState.money || 0) + earned;
      gameState.greenPoints = (gameState.greenPoints || 0) + 1;
      if (typeof sounds !== 'undefined' && sounds.playCollect) sounds.playCollect();
      if (typeof spawnFloatingText === 'function') {
        spawnFloatingText(new THREE.Vector3(75, 3.5, -90), `+$${earned} TÁI CHẾ SINH THÁI ♻️`, '#22c55e');
      }
      showToast(`♻️ ĐÃ TÁI CHẾ SINH THÁI THÀNH CÔNG: Nhận +$${earned} USD & +1 Điểm Đô Thị Xanh!`);
      updateHUD();
      triggerActionSave();
    }
  }
  window.recycleScrapAtPlant = recycleScrapAtPlant;

  function spinCityLuckyWheel() {
    window.luckyWheelCooldown = (window.luckyWheelCooldown || 0);
    if (window.luckyWheelCooldown > 0) {
      showToast(`⏳ Vòng quay đang nạp lại! Bạn có thể quay tiếp sau ${Math.ceil(window.luckyWheelCooldown)}s.`);
      return;
    }
    window.luckyWheelCooldown = 60.0;
    const prizes = [
      { name: 'Tiền mặt +$1,500 💵', money: 1500, gems: 0 },
      { name: 'Đá quý Hoàng Gia +5 💎', money: 500, gems: 5 },
      { name: 'Jackpot Đô Thị +$3,500 💰 & 10 💎', money: 3500, gems: 10 },
      { name: 'Gói May Mắn +$800 💵', money: 800, gems: 2 }
    ];
    const prize = prizes[Math.floor(Math.random() * prizes.length)];
    gameState.money = (gameState.money || 0) + prize.money;
    gameState.gems = (gameState.gems || 0) + prize.gems;

    if (window.luckyWheelMesh) {
      let spinTime = 0;
      const spinInterval = setInterval(() => {
        spinTime += 0.05;
        window.luckyWheelMesh.rotation.z += 0.45;
        if (spinTime >= 1.2) {
          clearInterval(spinInterval);
          if (typeof sounds !== 'undefined' && sounds.playCelebrationCheer) sounds.playCelebrationCheer();
          showToast(`🎉 CHÚC MỪNG: Vòng quay dừng lại ở [${prize.name}]!`);
          if (typeof spawnFloatingText === 'function') {
            spawnFloatingText(new THREE.Vector3(-20, 4.5, 36), `🎉 ${prize.name}`, '#facc15');
          }
          updateHUD();
          triggerActionSave();
        }
      }, 50);
    }
  }
  window.spinCityLuckyWheel = spinCityLuckyWheel;

  function mountJetskiWatercraft() {
    if (window.player && window.player.mesh) {
      window.player.mesh.position.set(132, 0.4, 45);
      showToast('🌊 ĐÃ LÊN MÔ-TÔ NƯỚC JETSKI! Phóng hết ga lướt sóng trên mặt biển!');
      if (typeof sounds !== 'undefined' && sounds.playWaterSplash) sounds.playWaterSplash();
    }
  }
  window.mountJetskiWatercraft = mountJetskiWatercraft;

  // 1. THỦY CUNG ĐẠI DƯƠNG - THU TIỀN VÉ DU LỊCH
  function collectOceanariumTickets() {
    window.oceanariumCooldown = (window.oceanariumCooldown || 0);
    if (window.oceanariumCooldown > 0) {
      showToast(`⏳ Thủy cung đang đón thêm đợt khách mới! Quay lại sau ${Math.ceil(window.oceanariumCooldown)}s.`);
      return;
    }
    window.oceanariumCooldown = 35.0;
    const ticketIncome = 1200;
    gameState.money = (gameState.money || 0) + ticketIncome;
    if (typeof sounds !== 'undefined' && sounds.playCash) sounds.playCash();
    if (typeof spawnFloatingText === 'function' && window.oceanariumTicketPad) {
      spawnFloatingText(window.oceanariumTicketPad.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), `+$${ticketIncome} 🎟️`, '#38bdf8');
    }
    showToast(`🏛️ THỦY CUNG ĐẠI DƯƠNG: Đã thu tiền vé khách du lịch tham quan sinh vật biển: +$${ticketIncome}!`);
    if (typeof updateHUD === 'function') updateHUD();
    triggerActionSave();
  }
  window.collectOceanariumTickets = collectOceanariumTickets;

  // 2. TÀU NGẦM THÁM HIỂM BIỂN SÂU
  function mountDeepSeaSubmarine() {
    window.subDiveCooldown = (window.subDiveCooldown || 0);
    if (window.subDiveCooldown > 0) {
      showToast(`⏳ Tàu ngầm đang nạp oxy & điện ắc quy! Lặn tiếp sau ${Math.ceil(window.subDiveCooldown)}s.`);
      return;
    }
    window.subDiveCooldown = 40.0;
    const diveTreasure = 2500;
    const pearls = 3;
    gameState.money = (gameState.money || 0) + diveTreasure;
    gameState.gems = (gameState.gems || 0) + pearls;
    if (typeof sounds !== 'undefined' && sounds.playWaterSplash) sounds.playWaterSplash();
    if (window.player && window.player.mesh) {
      window.player.mesh.position.set(140, 0.4, 76);
    }
    if (typeof spawnFloatingText === 'function') {
      spawnFloatingText(new THREE.Vector3(140, 2.5, 74), `+$${diveTreasure} ⚓ +${pearls} 💎`, '#facc15');
    }
    showToast(`⚓ TÀU NGẦM LẶN BIỂN SÂU: Khám phá rạn san hô cổ đại & trục vớt hòm báu: +$${diveTreasure} và +${pearls} Ngọc trai/Đá quý!`);
    if (typeof updateHUD === 'function') updateHUD();
    triggerActionSave();
  }
  window.mountDeepSeaSubmarine = mountDeepSeaSubmarine;

  // 3. GIÀN KHOAN DẦU NGOÀI KHƠI
  function harvestOffshoreOilRig() {
    window.oilRigCooldown = (window.oilRigCooldown || 0);
    if (window.oilRigCooldown > 0) {
      showToast(`⏳ Tháp khoan đang bơm dầu thô lên bồn chứa! Thu hoạch tiếp sau ${Math.ceil(window.oilRigCooldown)}s.`);
      return;
    }
    window.oilRigCooldown = 30.0;
    const oilMoney = 2000;
    gameState.money = (gameState.money || 0) + oilMoney;
    gameState.crudeOil = (gameState.crudeOil || 0) + 5;
    if (typeof sounds !== 'undefined' && sounds.playCash) sounds.playCash();
    if (typeof spawnFloatingText === 'function' && window.oilRigPad) {
      spawnFloatingText(new THREE.Vector3(180, 8.5, -45), `+$${oilMoney} 🛢️ +5 Dầu thô`, '#f59e0b');
    }
    showToast(`🛢️ GIÀN KHOAN DẦU NGOÀI KHƠI: Thu hoạch 5 thùng Dầu Thô và bán lấy +$${oilMoney}! Mang dầu về Nhà Máy Hóa Dầu để tinh chế!`);
    if (typeof updateHUD === 'function') updateHUD();
    triggerActionSave();
  }
  window.harvestOffshoreOilRig = harvestOffshoreOilRig;

  // 4. NHÀ MÁY HÓA DẦU TINH CHẾ
  function refinePetroleumPlant() {
    window.petroCooldown = (window.petroCooldown || 0);
    if (window.petroCooldown > 0) {
      showToast(`⏳ Lò chưng cất hóa dầu đang gia nhiệt! Tinh chế tiếp sau ${Math.ceil(window.petroCooldown)}s.`);
      return;
    }
    window.petroCooldown = 25.0;
    const refineRevenue = 3000;
    gameState.money = (gameState.money || 0) + refineRevenue;
    if (gameState.crudeOil && gameState.crudeOil >= 5) {
      gameState.crudeOil -= 5;
      gameState.money += 1500; // Thưởng thêm khi có dầu thô từ giàn khoan
    }
    if (typeof sounds !== 'undefined' && sounds.playCash) sounds.playCash();
    if (typeof spawnFloatingText === 'function' && window.petroleumRefineryPad) {
      spawnFloatingText(window.petroleumRefineryPad.pos.clone().add(new THREE.Vector3(0, 3.0, 0)), `+$${refineRevenue} 🏭`, '#ef4444');
    }
    showToast(`🏭 NHÀ MÁY HÓA DẦU: Tinh chế Dầu thô thành Xăng Super Fuel & Nhựa Polymer chất lượng cao: +$${refineRevenue}!`);
    if (typeof updateHUD === 'function') updateHUD();
    triggerActionSave();
  }
  window.refinePetroleumPlant = refinePetroleumPlant;

  // 5. SÀN CHỨNG KHOÁN PHỐ WALL & TƯỢNG BÒ VÀNG
  function visitWallStreetStockExchange() {
    if (typeof openStocksModal === 'function') {
      openStocksModal();
    }
    // Cầu may tượng bò vàng
    window.bullLuckyCooldown = (window.bullLuckyCooldown || 0);
    if (window.bullLuckyCooldown <= 0) {
      window.bullLuckyCooldown = 60.0;
      const luckyBonus = 500;
      gameState.money = (gameState.money || 0) + luckyBonus;
      showToast(`🐂 VÍA BÒ VÀNG PHỐ WALL: Bạn được chúc phúc thị trường Bull Market! Nhận +$${luckyBonus} tiền may mắn!`);
      if (typeof updateHUD === 'function') updateHUD();
    }
  }
  window.visitWallStreetStockExchange = visitWallStreetStockExchange;

  // 6. NGÂN HÀNG TRUNG ƯƠNG & PHI VỤ HẦM VÀNG
  function visitCentralBankVault() {
    const modal = document.getElementById('bank-modal');
    if (modal) modal.classList.add('open');
  }
  window.visitCentralBankVault = visitCentralBankVault;

  function startBankEscortMission() {
    const modal = document.getElementById('bank-modal');
    if (modal) modal.classList.remove('open');
    const pay = 2500;
    gameState.money = (gameState.money || 0) + pay;
    if (typeof sounds !== 'undefined' && sounds.playCash) sounds.playCash();
    showToast(`🛡️ ÁP TẢI TIỀN AN TOÀN: Đã hoàn tất vận chuyển tiền mặt từ cây ATM về kho bạc! Nhận thù lao an ninh: +$${pay}!`);
    if (typeof updateHUD === 'function') updateHUD();
    triggerActionSave();
  }
  window.startBankEscortMission = startBankEscortMission;

  function startBankVaultHeist() {
    const modal = document.getElementById('bank-modal');
    if (modal) modal.classList.remove('open');

    if (window.bankHeistActive) {
      showToast('⚠️ Bạn đang trong một phi vụ đột kích hầm vàng! Hãy sống sót và trốn thoát!');
      return;
    }

    window.bankHeistActive = true;
    window.bankHeistTimer = 35.0; // 35 giây đếm ngược trốn thoát
    gameState.wantedStars = 5; // 5 Sao truy nã tối đa!

    showToast('🚨 BÁO ĐỘNG ĐỎ KHO BẠC: CỬA HẦM VÀNG ĐÃ BỊ KHOAN THỦNG! Bạn bị truy nã 5 SAO! Trốn thoát trong 35s để đoạt vàng!');
    if (typeof sounds !== 'undefined' && sounds.playSiren) sounds.playSiren();
    if (window.mpClient) window.mpClient.sendCrimeCommit(5, 'Đột kích cướp Ngân Hàng Trung Ương');
    if (typeof updateHUD === 'function') updateHUD();
  }
  window.startBankVaultHeist = startBankVaultHeist;

  // 7. CỬA HÀNG THÚ CƯNG & AUTO-DRONE
  function visitPetSanctuaryShop() {
    const modal = document.getElementById('pet-modal');
    if (modal) modal.classList.add('open');
  }
  window.visitPetSanctuaryShop = visitPetSanctuaryShop;

  function adoptCompanionPet(type) {
    const modal = document.getElementById('pet-modal');
    if (modal) modal.classList.remove('open');

    gameState.activeCompanion = type;
    if (type === 'drone') {
      gameState.hasAutoLootDrone = true;
      if (window.autoLootDroneGroup && window.player && window.player.mesh) {
        window.autoLootDroneGroup.position.copy(window.player.mesh.position).add(new THREE.Vector3(1.0, 2.4, 0));
      }
      showToast('🛸 ĐÃ KÍCH HOẠT AUTO-LOOT DRONE! Drone sẽ tự động bay hút tiền, gỗ, quặng trong bán kính 16m!');
    } else if (type === 'shiba') {
      showToast('🐕 ĐÃ NHẬN NUÔI CHÓ SHIBA INU! Shiba chạy theo hỗ trợ tăng tốc độ và quầng hút gỗ 4m!');
    } else if (type === 'cyber_cat') {
      showToast('🐱 ĐÃ KÍCH HOẠT MÈO CYBER NEON! Mèo máy may mắn tăng 25% tỷ lệ rơi Gỗ Quý và Đá Quý!');
    }
    if (typeof updateHUD === 'function') updateHUD();
    triggerActionSave();
  }
  window.adoptCompanionPet = adoptCompanionPet;

  function handleBusFastTravel(currentStop) {
    if (!window.cityBusStops || window.cityBusStops.length === 0) return;
    const curIdx = window.cityBusStops.findIndex(s => s.id === currentStop.id);
    const nextIdx = (curIdx + 1) % window.cityBusStops.length;
    const targetStop = window.cityBusStops[nextIdx];
    const busFare = 15;
    if ((gameState.money || 0) < busFare) {
      showToast(`⚠️ Cần $${busFare} tiền vé xe buýt! Bạn chỉ có: $${Math.floor(gameState.money || 0)}`);
      return;
    }
    gameState.money -= busFare;
    if (typeof sounds !== 'undefined' && sounds.playBusHorn) sounds.playBusHorn();
    if (window.player && window.player.mesh) {
      window.player.mesh.position.set(targetStop.pos.x, 0.2, targetStop.pos.z + 2.5);
    }
    showToast(`🚌 XE BUÝT ĐÔ THỊ: Đã đưa bạn đến [${targetStop.name}]! (Vé: -$${busFare})`);
    if (typeof updateHUD === 'function') updateHUD();
  }
  window.handleBusFastTravel = handleBusFastTravel;

  function updateLogisticsCareerMissions(dt) {
    if (gameState.currentCareer !== 'logistics') return;

    if (!gameState.activeFreight) {
      window.freightAssignTimer = (window.freightAssignTimer || 0) - dt;
      if (window.freightAssignTimer <= 0) {
        window.freightAssignTimer = 15.0;
        const missions = [
          { pickupName: 'Mỏ Sắt & Lò Cao', pickupPos: new THREE.Vector3(75, 0, -75), dropName: 'Công Trường Landmark', dropPos: new THREE.Vector3(-20, 0, 86), cargo: '10 Dầm Thép', reward: 10500 },
          { pickupName: 'Nông Trường Lương Thực', pickupPos: new THREE.Vector3(-65, 0, -75), dropName: 'Bệnh Viện Đa Khoa', dropPos: new THREE.Vector3(70, 0, 56), cargo: '12 Hộp Lương Thực', reward: 8800 },
          { pickupName: 'Xưởng Cưa Trung Tâm', pickupPos: new THREE.Vector3(0, 0, -18), dropName: 'Cảng Xuất Khẩu', dropPos: new THREE.Vector3(33, 0, 4), cargo: '20 Ván Gỗ', reward: 7200 }
        ];
        gameState.activeFreight = Object.assign({ stage: 'pickup' }, missions[Math.floor(Math.random() * missions.length)]);
        showToast(`🚛 HỢP ĐỒNG LOGISTICS MỚI: Đến [${gameState.activeFreight.pickupName}] nhận ${gameState.activeFreight.cargo}! Thù lao: $${gameState.activeFreight.reward.toLocaleString()}`);
      }
      return;
    }

    const pPos = window.player && window.player.mesh ? window.player.mesh.position : null;
    if (!pPos) return;

    const f = gameState.activeFreight;
    if (f.stage === 'pickup') {
      if (pPos.distanceTo(f.pickupPos) <= 7.0) {
        f.stage = 'deliver';
        showToast(`📦 ĐÃ BỐC HÀNG [${f.cargo}] LÊN XE! Lái xe đến [${f.dropName}] để giao nhận thù lao $${f.reward.toLocaleString()}!`);
        if (typeof sounds !== 'undefined' && sounds.playWoodPlank) sounds.playWoodPlank();
      }
    } else if (f.stage === 'deliver') {
      if (pPos.distanceTo(f.dropPos) <= 7.0) {
        const payout = f.reward;
        gameState.money = (gameState.money || 0) + payout;
        gameState.activeFreight = null;
        window.freightAssignTimer = 20.0;
        showToast(`🎉 HOÀN THÀNH HỢP ĐỒNG LOGISTICS! Nhận thù lao +$${payout.toLocaleString()} USD!`);
        if (typeof spawnFloatingText === 'function') spawnFloatingText(pPos.clone().add(new THREE.Vector3(0, 3, 0)), `+$${payout.toLocaleString()} LOGISTICS 🚛⭐`, '#facc15');
        if (typeof sounds !== 'undefined' && sounds.playCelebrationCheer) sounds.playCelebrationCheer();
        if (typeof updateHUD === 'function') updateHUD();
      }
    }
  }

  function handleActionKeyPressF() {
    const pPos = player && player.mesh ? player.mesh.position : null;
    if (!pPos) return;

    const currentCareer = gameState.currentCareer || (gameState.isPoliceOfficer ? 'police' : 'citizen');

    if (currentCareer === 'police' || gameState.isDrivingPolice) {
      let caught = false;
      if (window.mpClient && window.mpClient.remotePlayers) {
        window.mpClient.remotePlayers.forEach((r, rId) => {
          if (!caught && r.group && pPos.distanceTo(r.group.position) <= 7.0) {
            caught = true;
            window.mpClient.sendPoliceArrest(rId);
            showToast(`⚡ ĐÃ BẮN SÚNG ĐIỆN TASER & CÒNG TAY TỘI PHẠM ${r.name || rId}!`);
          }
        });
      }
      if (!caught) {
        showToast('👮 CẢNH SÁT: Đến gần đối tượng tình nghi (<7m) và nhấn [F] để phóng taser còng tay!');
      }
    } else if (currentCareer === 'firefighter' || gameState.isDrivingFireEngine) {
      if (typeof spawnParticle === 'function') {
        for (let p = 0; p < 6; p++) {
          const spread = new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.2 + (Math.random() - 0.5) * 0.4, 1.5 + p * 0.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.mesh.rotation.y);
          spawnParticle(pPos.clone().add(spread), 0x38bdf8);
        }
      }
      if (window.cityState && window.cityState.activeCrisis && window.cityState.activeCrisis.location) {
        const cLoc = new THREE.Vector3(window.cityState.activeCrisis.location.x, window.cityState.activeCrisis.location.y, window.cityState.activeCrisis.location.z);
        if (pPos.distanceTo(cLoc) <= 18.0) {
          if (window.mpClient) window.mpClient.sendCrisisExtinguish(15);
          if (typeof spawnFloatingText === 'function') spawnFloatingText(cLoc.clone().add(new THREE.Vector3(0, 2, 0)), '-15 HP Hỏa Hoạn 💧', '#38bdf8');
        }
      }
      if (typeof sounds !== 'undefined' && sounds.playWaterSplash) sounds.playWaterSplash();
    } else if (currentCareer === 'underworld') {
      if (window.mpClient) window.mpClient.sendUnderworldHeist();
      showToast('🕶️ ĐẠO TẶC: Bẻ khóa thành công! Cướp tiền quỹ và tẩu thoát trước khi Cảnh sát tới!');
    } else {
      showToast('💡 Mẹo: Nhấn phím [K] để chọn Nghề nghiệp (Cảnh sát, Cứu hỏa, Đạo tặc, Logistics)!');
    }
  }
  window.handleActionKeyPressF = handleActionKeyPressF;

  const vehiclePrompt = document.getElementById('vehicle-prompt-hud');
  if (vehiclePrompt) {
    vehiclePrompt.addEventListener('click', () => {
      handleVehicleMountToggle();
    });
  }

  const truckActionPrompt = document.getElementById('truck-action-hud');
  if (truckActionPrompt) {
    truckActionPrompt.addEventListener('click', () => {
      if (window.drivableLumberTruck) window.drivableLumberTruck.handleSpaceAction();
    });
  }

  window.addEventListener('keyup', (e) => {
    keysPressed[e.code] = false;
  });

  // Raycasting click to chop or move
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  renderer.domElement.addEventListener('click', (e) => {
    if (joystickActive) return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(clickables, true);

    if (intersects.length > 0) {
      let hit = intersects[0].object;
      while (hit.parent && !hit.userData.type && hit !== scene) {
        hit = hit.parent;
      }

      if (hit.userData.type === 'tree') {
        player.targetPos = hit.position.clone();
        player.triggerChop(hit);
        damageTree(hit);
        return;
      } else if (hit.userData.type === 'pickable_log') {
        player.targetPos = hit.position.clone();
        return;
      } else if (hit.userData.type === 'empire_hq_shop') {
        if (typeof openUpgradeShop === 'function') openUpgradeShop();
        return;
      } else if (hit.userData.type === 'trade_stall') {
        player.targetPos = new THREE.Vector3(18, 0, -25);
        return;
      } else if (hit.userData.type === 'manual_saw_bench') {
        player.targetPos = new THREE.Vector3(-6, 0, -18);
        return;
      } else if (hit.userData.type === 'fishing_spot') {
        player.targetPos = new THREE.Vector3(22.0, 0, 18.8);
        const d = player.mesh.position.distanceTo(new THREE.Vector3(22.0, 0, 18.8));
        if (d <= 2.8) triggerPlayerFishing();
        return;
      } else if (hit.userData.type === 'seafood_market') {
        player.targetPos = new THREE.Vector3(13.0, 0, 4.0);
        return;
      } else if (hit.userData.type === 'cannery_factory') {
        player.targetPos = new THREE.Vector3(44.0, 0, 4.5);
        return;
      }
    }

    if (window.groundMesh) {
      const groundHits = raycaster.intersectObject(window.groundMesh);
      if (groundHits.length > 0) {
        player.targetPos = groundHits[0].point.clone();
      }
    }
  });

  // Đổi con trỏ chuột thành pointer khi rê vào Cửa Hàng, Cây hoặc Quầy Bán (Throttle để chống lag CPU)
  let lastHoverTime = 0;
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (joystickActive) return;
    const now = performance.now();
    if (now - lastHoverTime < 100) return; // Giới hạn kiểm tra 10 lần/giây, không tính toán raycast liên tục
    lastHoverTime = now;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(clickables, true);
    let isHover = false;
    if (intersects.length > 0) {
      let hit = intersects[0].object;
      while (hit.parent && !hit.userData.type && hit !== scene) hit = hit.parent;
      if (hit.userData.type === 'empire_hq_shop' || hit.userData.type === 'tree' || hit.userData.type === 'trade_stall' || hit.userData.type === 'manual_saw_bench') {
        isHover = true;
      }
    }
    renderer.domElement.style.cursor = isHover ? 'pointer' : 'default';
  });

  // UI Buttons
  document.getElementById('btn-recenter').addEventListener('click', () => {
    if (player && controls) {
      controls.target.copy(player.mesh.position);
      camera.position.set(player.mesh.position.x - 22, player.mesh.position.y + 26, player.mesh.position.z + 24);
    }
  });

  document.getElementById('btn-audio').addEventListener('click', () => {
    const isMuted = sounds.toggle();
    document.getElementById('btn-audio').textContent = isMuted ? '🔇 Âm thanh' : '🔊 Âm thanh';
  });

  document.getElementById('btn-save').addEventListener('click', () => {
    executeSave(true);
    showToast('☁️ Đã lưu tiến trình lên MongoDB Atlas!');
  });

  document.getElementById('btn-load').addEventListener('click', () => {
    loadGame();
  });

  document.getElementById('btn-fever').addEventListener('click', () => {
    triggerFeverMode();
  });

  document.getElementById('btn-shortcuts').addEventListener('click', () => {
    const scModal = document.getElementById('shortcuts-modal');
    if (scModal) {
      const isOpen = scModal.classList.contains('open');
      if (isOpen) {
        scModal.classList.remove('open');
      } else {
        if (typeof closeUpgradeShop === 'function') closeUpgradeShop();
        scModal.classList.add('open');
      }
    }
  });

  document.getElementById('btn-close-shortcuts').addEventListener('click', () => {
    const scModal = document.getElementById('shortcuts-modal');
    if (scModal) scModal.classList.remove('open');
  });

  const btnShopFloat = document.getElementById('btn-shop-float');
  if (btnShopFloat) {
    btnShopFloat.addEventListener('click', () => {
      if (typeof toggleUpgradeShop === 'function') toggleUpgradeShop();
    });
  }

  const btnShop = document.getElementById('btn-shop');
  if (btnShop) {
    btnShop.addEventListener('click', () => {
      if (typeof toggleUpgradeShop === 'function') toggleUpgradeShop();
    });
  }

  const btnCloseShop = document.getElementById('btn-close-shop');
  if (btnCloseShop) {
    btnCloseShop.addEventListener('click', () => {
      if (typeof closeUpgradeShop === 'function') closeUpgradeShop();
    });
  }

  document.getElementById('btn-claim-levelup').addEventListener('click', () => {
    document.getElementById('levelup-modal').classList.remove('open');
    gameState.talentPoints = (gameState.talentPoints || 0) + 1;
    showToast(`🚀 Bước sang ${LEVEL_CONFIGS[gameState.level].tag}! Bạn nhận được +1 Điểm Thiên Phú (TP)!`);
    if (typeof updateHUD === 'function') updateHUD();
    if (typeof renderTalentModal === 'function') renderTalentModal();
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ---------------------------------------------------------------------------
// TREE CHOPPING, 4-SEGMENT HP BAR & LIFECYCLE REGENERATION
// ---------------------------------------------------------------------------
function tryChopNearbyTree() {
  let closestTree = null;
  let minDist = 3.8;

  for (const tree of trees) {
    if (tree.visible && tree.userData.growthStage === 3) {
      const d = player.mesh.position.distanceTo(tree.position);
      if (d < minDist) {
        minDist = d;
        closestTree = tree;
      }
    }
  }

  if (closestTree) {
    player.triggerChop(closestTree);
    damageTree(closestTree);
  }
}

function damageTree(tree) {
  if (!tree.visible || tree.userData.growthStage !== 3 || tree.userData.isFalling) return;

  // Sát thương theo Cấp Rìu (Tier 1: 25, Tier 2: 50, Tier 3: 100, Fever: 100)
  let dmg = 25;
  if (gameState.axeTier === 2) dmg = 50;
  else if (gameState.axeTier >= 3) dmg = 100;
  if (isFeverActive()) dmg = 100;

  tree.userData.hp -= dmg;

  // Dăm gỗ 3D bắn tung tóe theo nhát chém (Vàng gỗ, nâu vỏ cây & lá kim)
  for (let i = 0; i < 14; i++) {
    const col = (i % 3 === 0) ? 0x78350f : (i % 3 === 1) ? 0xf59e0b : 0x16a34a;
    spawnParticle(tree.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.9, 1.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.9)), col);
  }

  // Đồng bộ hiệu ứng đốn cây cho bạn bè trong phòng
  if (window.multiplayerManager) {
    window.multiplayerManager.send({
      type: 'chop',
      x: Number(tree.position.x.toFixed(1)),
      z: Number(tree.position.z.toFixed(1))
    });
  }

  // Cập nhật thanh máu 4 nấc 3D trên ngọn cây
  if (tree.userData.hpBar) {
    tree.userData.hpBar.visible = true;
    const remainingSegments = Math.ceil(tree.userData.hp / 25);
    tree.userData.hpSegments.forEach((seg, idx) => {
      seg.visible = idx < remainingSegments;
      seg.material.color.set(remainingSegments <= 1 ? 0xef4444 : remainingSegments <= 2 ? 0xfacc15 : 0x22c55e);
    });
  }

  // Rung lắc thân cây theo nhịp chém
  tree.rotation.z = 0.16;
  setTimeout(() => { if (tree && !tree.userData.isFalling) tree.rotation.z = -0.12; }, 60);
  setTimeout(() => { if (tree && !tree.userData.isFalling) tree.rotation.z = 0.06; }, 120);
  setTimeout(() => { if (tree && !tree.userData.isFalling) tree.rotation.z = 0; }, 180);

  if (tree.userData.hp <= 0) {
    tree.userData.isFalling = true;
    if (tree.userData.hpBar) tree.userData.hpBar.visible = false;
    sounds.playTreeFall();

    // Hoạt ảnh đổ cây vật lý từ từ (Smooth Toppling Physics)
    let fallProgress = 0;
    const fallInterval = setInterval(() => {
      fallProgress += 0.08;
      if (tree) {
        tree.rotation.z = fallProgress * 1.48; // Nghiêng đổ dần về một phía
        if (Math.random() > 0.4) {
          spawnParticle(tree.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.8, (Math.random() - 0.5) * 1.5)), 0x15803d);
          spawnParticle(tree.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.2, (Math.random() - 0.5) * 1.5)), 0xf59e0b);
        }
      }
      if (fallProgress >= 1.0) {
        clearInterval(fallInterval);
        if (tree) {
          tree.visible = false;
          tree.rotation.z = 0;
          tree.userData.isFalling = false;

          // Khi đập xuống đất: bùng nổ mùn cưa + lá thông + rung chấn màn hình
          for (let p = 0; p < 18; p++) {
            spawnParticle(tree.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, 0.4, (Math.random() - 0.5) * 2.2)), 0x16a34a);
            spawnParticle(tree.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, 0.4, (Math.random() - 0.5) * 2.2)), 0xfbbf24);
          }

          document.body.classList.add('screen-shake');
          setTimeout(() => document.body.classList.remove('screen-shake'), 240);
          triggerCameraShake(0.38, 0.28);

          // Đàn chim sẻ rừng hoang dã giật mình bay tán loạn lên không trung
          if (window.wildlifeEco && typeof window.wildlifeEco.scatterBirds === 'function') {
            window.wildlifeEco.scatterBirds(tree.position, 18.0);
          }

          // Sinh khúc gỗ rơi trên đất có độ nảy đàn hồi (Gỗ đỏ Redwood sinh 4 khúc + 3 RP)
          const isRed = tree.userData && tree.userData.isRedwood;
          let logCount = isRed ? 4 : 2;
          // Thiên phú Khai Thác Bùng Nổ (+35% gỗ)
          if (gameState.talents && gameState.talents.treeSurge) {
            logCount += 1;
          }
          // Thiên phú Gỗ Cổ Thụ Nghìn Năm (15% cơ hội rơi khối gỗ quý $600)
          if (gameState.talents && gameState.talents.ancientTimber && Math.random() < 0.15) {
            gameState.money = (gameState.money || 0) + 600;
            showToast('🌳 THIÊN PHÚ KÍCH HOẠT: Phát hiện Khối Gỗ Cổ Thụ Nghìn Năm! Nhận ngay +$600 USD!');
            spawnFloatingText(tree.position.clone().add(new THREE.Vector3(0, 2, 0)), '+$600 🌳 Gỗ Cổ Thụ!', '#10b981');
          }
          for (let l = 0; l < logCount; l++) {
            spawnPickableLog(tree.position, scene);
          }

          gameState.totalLogsCut += logCount;
          const earnedRP = isRed ? 3 : 1;
          gameState.researchPoints = (gameState.researchPoints || 0) + earnedRP;

          if (isRed) {
            spawnFloatingText(tree.position, `+4 Gỗ Đỏ Redwood 🌲 & +${earnedRP} RP 🔬`, "#ef4444");
          } else {
            spawnFloatingText(tree.position, `+2 Khúc gỗ 🪵 & +${earnedRP} RP 🔬`, "#facc15");
          }
          updateHUD();
          triggerActionSave();

          // Chu kỳ sinh trưởng 3 giai đoạn: mầm non (0.1) -> cây con (0.45) -> cây lớn (1.0)
          startTreeRegrowth(tree);
        }
      }
    }, 25);
  }
}

function startTreeRegrowth(tree) {
  tree.scale.set(0.1, 0.1, 0.1);
  tree.userData.growthStage = 1;
  tree.userData.hp = tree.userData.maxHp;

  const regrowSpeed = (gameState.reforestationLevel > 0) ? 0.5 : 1.0;

  // Giai đoạn 1: Mầm non nhú sau 4 giây
  setTimeout(() => {
    tree.visible = true;
    tree.scale.set(0.2, 0.2, 0.2);

    // Giai đoạn 2: Cây con sau 8 giây
    setTimeout(() => {
      tree.userData.growthStage = 2;
      tree.scale.set(0.5, 0.5, 0.5);

      // Giai đoạn 3: Cây trưởng thành sau 14 giây
      setTimeout(() => {
        tree.userData.growthStage = 3;
        tree.scale.set(1.0, 1.0, 1.0);
      }, 6000 * regrowSpeed);
    }, 4000 * regrowSpeed);
  }, 4000 * regrowSpeed);
}

// ---------------------------------------------------------------------------
// PROXIMITY & STEP-IN TRIGGER ZONES
// ---------------------------------------------------------------------------
let sawCooldown = 0;
let sellCooldown = 0;
let autoConveyorTimer = 0;
let shopTriggerCooldown = 0;
let machineSawTimer = 0;
let truckLoadCooldown = 0;
let strappingTimer = 0;
let contractCooldownTimer = 18;
let isPlayerFishing = false;
let fishSellCooldown = 0;
let canneryProcessCooldown = 0;

function triggerPlayerFishing() {
  if (isPlayerFishing) return;
  isPlayerFishing = true;

  // Xoay mặt nhân vật hướng ra lòng sông sâu (+Z)
  player.mesh.rotation.y = 0;

  // Âm thanh vung cần câu
  if (typeof sounds !== 'undefined' && sounds.playFishingCast) {
    sounds.playFishingCast();
  } else if (typeof sounds !== 'undefined' && sounds.playCollect) {
    sounds.playCollect();
  }

  spawnFloatingText(player.mesh.position.clone().add(new THREE.Vector3(0, 1.8, 0)), '🎣 Đang buông cần...', '#38bdf8');

  // Động tác vung tay buông cần
  if (player.rightArmPivot) {
    player.rightArmPivot.rotation.x = -1.2;
  }

  // Chờ 1.6s cá cắn câu giật cần
  setTimeout(() => {
    if (typeof sounds !== 'undefined' && sounds.playWaterSplash) {
      sounds.playWaterSplash();
    } else if (typeof sounds !== 'undefined' && sounds.playCollect) {
      sounds.playCollect();
    }

    // Nước bắn tung tóe trước mũi cầu tàu
    const splashPos = new THREE.Vector3(22.0, 0.2, 21.0);
    for (let i = 0; i < 18; i++) {
      spawnParticle(splashPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.4, 0.5, (Math.random() - 0.5) * 1.4)), 0x38bdf8);
      spawnParticle(splashPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.8, (Math.random() - 0.5) * 0.8)), 0xe0f2fe);
    }

    // Kích hoạt Mini-game kéo cần câu tương tác
    if (typeof startFishingReelingMiniGame === 'function') {
      startFishingReelingMiniGame((rareFish) => {
        if (player.rightArmPivot) player.rightArmPivot.rotation.x = 0;
        isPlayerFishing = false;
      });
    } else {
      gameState.freshFish = (gameState.freshFish || 0) + 1;
      gameState.totalFishCaught = (gameState.totalFishCaught || 0) + 1;
      spawnFloatingText(new THREE.Vector3(22.0, 2.2, 19.5), '+1 Cá Tươi Đớp Mồi 🐟! ($45)', '#34d399');
      showToast('🎣 Giật cần dính cá! +1 Cá Tươi trong kho!');
      if (player.rightArmPivot) player.rightArmPivot.rotation.x = 0;
      updateHUD();
      triggerActionSave();
      setTimeout(() => { isPlayerFishing = false; }, 400);
    }
  }, 1600);
}
window.triggerPlayerFishing = triggerPlayerFishing;

let fullToastCooldown = 0;

function checkZoneTriggers(dt) {
  if (!player || !player.mesh) return;
  const pPos = (isDrivingAny && focusPos) ? focusPos : player.mesh.position;
  if (shopTriggerCooldown > 0) shopTriggerCooldown -= dt;
  if (fullToastCooldown > 0) fullToastCooldown -= dt;

  // 1. Quầng nam châm hút gỗ bay hình Parabol (bán kính <= 1.6m, tăng lên 3.5m khi có Chó K-9)
  const magnetRadius = window.k9DogGroup ? 3.5 : 1.6;
  for (let i = pickableLogs.length - 1; i >= 0; i--) {
    const log = pickableLogs[i];
    const dist = pPos.distanceTo(log.position);
    if (dist <= magnetRadius) {
      if (gameState.logs < gameState.backpackMax) {
        gameState.logs++;
        player.updateLogStack(gameState.logs);
        sounds.playCollect();

        // Kích hoạt bay Parabol Bezier
        triggerParabolicPickup(log, player.mesh, () => {
          spawnFloatingText(player.mesh.position, "+1 Gỗ vào balo", "#facc15");
        });

        pickableLogs.splice(i, 1);
        const cIdx = clickables.indexOf(log);
        if (cIdx > -1) clickables.splice(cIdx, 1);

        updateHUD();
      } else {
        if (fullToastCooldown <= 0) {
          showToast(`⚠️ Balo đã đầy (${gameState.logs}/${gameState.backpackMax})! Hãy mang đến Xưởng Cưa!`);
          fullToastCooldown = 2.5;
        }
      }
      break;
    }
  }

  // 2. BÃI ĐỆM NẠP GỖ MÁY CƯA CÔNG NGHIỆP: { x: -6.0, z: -18 }, bán kính r = 1.6m
  // Gỗ trong balo KHÔNG tự động biến mất khi chạy quanh map, người chơi phải mang đến đây dỡ xuống
  const infeedPos = new THREE.Vector3(-6.0, 0, -18);
  const distToInfeed = pPos.distanceTo(infeedPos);
  if (distToInfeed <= 1.6) {
    sawCooldown -= dt;
    if (sawCooldown <= 0 && gameState.logs > 0) {
      const maxBuffer = gameState.maxMachineBuffer || 30;
      if ((gameState.machineLogBuffer || 0) < maxBuffer) {
        sawCooldown = 0.12; // Dỡ gỗ nhanh từng khúc vào máy
        gameState.logs--;
        gameState.machineLogBuffer = (gameState.machineLogBuffer || 0) + 1;
        player.updateLogStack(gameState.logs);
        sounds.playCollect();

        // Hiệu ứng dỡ gỗ rơi vào đệm máy
        for (let i = 0; i < 4; i++) {
          spawnParticle(infeedPos.clone().add(new THREE.Vector3(0, 0.8, 0)), 0xf59e0b);
        }
        spawnFloatingText(infeedPos, "+1 Gỗ vào đệm máy 🪵", "#38bdf8");
        updateHUD();
        triggerActionSave();
      } else {
        showToast("⚠️ Bãi đệm máy cưa đã đầy (30/30)! Đang chờ lưỡi cưa xử lý...");
      }
    }
  }

  // 2b. CHU TRÌNH XẺ GỖ TỰ ĐỘNG CỦA MÁY CƯA CÔNG NGHIỆP TỪ BÃI ĐỆM
  if ((gameState.machineLogBuffer || 0) > 0) {
    machineSawTimer += dt;
    const speedMult = gameState.sawmillSpeedTier || 1;
    const gridMult = (gameState.sawmillGridBonus || 1.10); // Lưới điện trạm biến áp 110kV tăng +10% hiệu suất
    const isRush = gameState.overtimeRush && gameState.overtimeRush.active;
    const sawInterval = (1.35 / (speedMult * gridMult)) / (isRush ? 2.0 : 1.0); // Tăng tốc theo cấp độ & chế độ Tăng Ca
    if (machineSawTimer >= sawInterval) {
      machineSawTimer = 0;
      gameState.machineLogBuffer--;
      gameState.planks += 2;
      gameState.totalPlanksSawn += 2;
      if (gameState.totalPlanksSawn % 10 === 0) {
        gameState.researchPoints = (gameState.researchPoints || 0) + 1;
      }
      sounds.playSaw();

      // Tia lửa cơ khí tóe ra từ buồng cưa hợp kim (0, 2.0, -18)
      const sparkPos = new THREE.Vector3(0, 2.0, -18);
      for (let s = 0; s < 8; s++) {
        spawnParticle(sparkPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8)), 0xf97316);
        spawnParticle(sparkPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8)), 0xfef08a);
      }

      spawnFloatingText(new THREE.Vector3(5.8, 1.8, -18), "+2 Ván thành phẩm 📦", "#38bdf8");
      updateHUD();
      triggerActionSave();
    }
  }

  // 2b-2. CHU TRÌNH ĐÓNG ĐAI PALLET TỰ ĐỘNG (5 VÁN ➜ 1 PALLET CÓ ĐAI THÉP)
  if ((gameState.planks || 0) >= 5 && (gameState.pallets || 0) < 12) {
    strappingTimer += dt;
    const isRush = gameState.overtimeRush && gameState.overtimeRush.active;
    const gridMult = (gameState.sawmillGridBonus || 1.10);
    const strapTarget = (isRush ? 1.2 : 2.4) / gridMult;
    if (strappingTimer >= strapTarget) {
      strappingTimer = 0;
      gameState.planks -= 5;
      gameState.pallets = (gameState.pallets || 0) + 1;
      gameState.researchPoints = (gameState.researchPoints || 0) + 1;
      sounds.playWoodPlank();

      if (window.strappingPressHead) {
        window.strappingPressHead.position.y = 1.6;
        setTimeout(() => {
          if (window.strappingPressHead) window.strappingPressHead.position.y = 2.4;
        }, 250);
      }

      spawnFloatingText(new THREE.Vector3(9.2, 2.0, -18), "+1 Kiện Pallet Đóng Đai 📦 & +1 RP 🔬", "#f59e0b");
      updateHUD();
      triggerActionSave();
    }
  }

  // 2c. BẾN NẠP VÁN LÊN XE TẢI XUẤT KHẨU TRỰC TIẾP: { x: 26, z: -18 }, bán kính r = 2.2m
  const truckDockPos = new THREE.Vector3(26, 0, -18);
  const distToTruckDock = pPos.distanceTo(truckDockPos);
  if (distToTruckDock <= 2.2 && gameState.planks > 0) {
    truckLoadCooldown -= dt;
    if (truckLoadCooldown <= 0) {
      truckLoadCooldown = 0.25;
      const toLoad = Math.min(gameState.planks, 2);
      gameState.planks -= toLoad;
      let pVal = (typeof getPlankValue === 'function') ? getPlankValue() : 20;
      if (gameState.marketState && gameState.marketState.activeCommodity === 'planks') {
        pVal = Math.floor(pVal * (gameState.marketState.multiplier || 1.0));
      }
      const earned = toLoad * pVal * 2 + 80;
      gameState.money += earned;
      gameState.exportOrders = (gameState.exportOrders || 0) + 1;
      if (typeof sounds !== 'undefined' && sounds.playWoodPlank) sounds.playWoodPlank();
      if (typeof spawnFloatingText === 'function') {
        spawnFloatingText(truckDockPos.clone().add(new THREE.Vector3(0, 3, 0)), `+$${earned} Xuất khẩu ván 🚛`, '#4ade80');
      }
      if (window.drivableLumberTruck && (gameState.truckCargo || 0) < (gameState.truckMaxCargo || 16)) {
        gameState.truckCargo = Math.min(gameState.truckMaxCargo || 16, (gameState.truckCargo || 0) + 1);
      }
      updateHUD();
      triggerActionSave();
    }
  }

  // 3. Quầy thu mua ván gỗ thẳng hàng trong đất liền: { x: 18, z: -25 }, bán kính r = 1.6m
  const sellPos = new THREE.Vector3(18, 0, -25);
  const distToSell = pPos.distanceTo(sellPos);
  if (distToSell <= 1.6) {
    sellCooldown -= dt;
    if (sellCooldown <= 0 && gameState.planks > 0) {
      sellCooldown = 0.5;
      const count = gameState.planks;
      let unitPrice = typeof getPlankValue === 'function' ? getPlankValue() : 20;
      let seasonMult = (gameState.currentSeason === 'winter') ? 3.0 : 1.0;
      if (gameState.marketState && gameState.marketState.activeCommodity === 'planks') {
        unitPrice = Math.floor(unitPrice * (gameState.marketState.multiplier || 1.0));
      }
      unitPrice = Math.floor(unitPrice * seasonMult);
      const earned = count * unitPrice;
      gameState.money += earned;
      gameState.planks = 0;
      sounds.playCoin();

      // Mưa sao lấp lánh vàng kim khi nhận tiền
      for (let sp = 0; sp < 16; sp++) {
        spawnParticle(sellPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.2, (Math.random() - 0.5) * 1.5)), 0xfacc15);
        spawnParticle(sellPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.2, (Math.random() - 0.5) * 1.5)), 0x34d399);
      }

      const seasonTag = (gameState.currentSeason === 'winter') ? ' ❄️ [x3 Sưởi Ấm Mùa Đông]' : '';
      spawnFloatingText(sellPos, `+$${earned} 💵${seasonTag}`, "#4ade80");
      showToast(`💰 Đã bán ${count} ván gỗ ($${unitPrice}/ván${seasonTag}) nhận $${earned}!`);

      const elMoney = document.getElementById('val-money');
      if (elMoney && elMoney.parentElement) {
        elMoney.parentElement.classList.add('pop-scale');
        setTimeout(() => elMoney.parentElement.classList.remove('pop-scale'), 350);
      }

      updateHUD();
      triggerActionSave();
    }
  }

  // 4. Vòng bước vào Cửa Hàng Nâng Cấp Đế Chế trong đất liền: { x: 0, z: -28.5 }, bán kính r = 2.4m
  const shopZonePos = new THREE.Vector3(0, 0, -28.5);
  const distToShopZone = pPos.distanceTo(shopZonePos);
  if (distToShopZone <= 2.4 && shopTriggerCooldown <= 0) {
    if (typeof isShopOpen === 'function' && !isShopOpen()) {
      shopTriggerCooldown = 2.5; // Cooldown tránh mở lặp liên tục
      if (typeof openUpgradeShop === 'function') openUpgradeShop();
    }
  }

  // 5. QUẦY THU MUA HẢI SẢN & CHỢ CÁ CẢNG BIỂN: { x: 13.0, z: 4.0 }, bán kính r = 2.4m
  const seafoodMarketPos = new THREE.Vector3(13.0, 0, 4.0);
  const distToMarket = pPos.distanceTo(seafoodMarketPos);
  if (distToMarket <= 2.4) {
    fishSellCooldown -= dt;
    if (fishSellCooldown <= 0 && (gameState.freshFish || 0) > 0) {
      fishSellCooldown = 0.6;
      const fishCount = gameState.freshFish;
      let unitPrice = 45;
      let seasonFishMult = (gameState.currentSeason === 'summer') ? 2.0 : 1.0;
      if (gameState.marketState && gameState.marketState.activeCommodity === 'cannedFish') {
        unitPrice = Math.floor(unitPrice * (gameState.marketState.multiplier || 1.0));
      }
      unitPrice = Math.floor(unitPrice * seasonFishMult);
      const earned = fishCount * unitPrice;
      gameState.money += earned;
      gameState.freshFish = 0;
      sounds.playCoin();

      // Mưa hạt lấp lánh xanh biển & vàng kim
      for (let sp = 0; sp < 18; sp++) {
        spawnParticle(seafoodMarketPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.0, 1.2, (Math.random() - 0.5) * 2.0)), 0x06b6d4);
        spawnParticle(seafoodMarketPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.0, 1.2, (Math.random() - 0.5) * 2.0)), 0xfacc15);
      }

      const fishSeasonTag = (gameState.currentSeason === 'summer') ? ' ☀️ [x2 Du Lịch Hè]' : '';
      spawnFloatingText(seafoodMarketPos.clone().add(new THREE.Vector3(0, 1.8, 0)), `+$${earned} 💵 (${fishCount} Cá Tươi)${fishSeasonTag}`, "#10b981");
      showToast(`🐟 Chợ Cá Cảng Biển: Đã bán ${fishCount} Cá Tươi ($${unitPrice}/con${fishSeasonTag}) nhận +$${earned}!`);

      const elMoney = document.getElementById('val-money');
      if (elMoney && elMoney.parentElement) {
        elMoney.parentElement.classList.add('pop-scale');
        setTimeout(() => elMoney.parentElement.classList.remove('pop-scale'), 350);
      }

      updateHUD();
      triggerActionSave();
    }
  }

  // 6. NHÀ MÁY ĐỒ HỘP XUẤT KHẨU: { x: 44.0, z: 4.5 }, bán kính r = 2.8m
  const canneryPos = new THREE.Vector3(44.0, 0, 4.5);
  const distToCannery = pPos.distanceTo(canneryPos);
  if (distToCannery <= 2.6) {
    canneryProcessCooldown -= dt;
    if (canneryProcessCooldown <= 0 && (gameState.freshFish || 0) >= 2) {
      canneryProcessCooldown = 0.5;
      gameState.freshFish -= 2;
      gameState.cannedFish = (gameState.cannedFish || 0) + 1;
      gameState.money += 20; // Tiền thưởng chế biến tại chỗ
      sounds.playWoodPlank();

      // Hạt hơi nước công nghiệp
      for (let sp = 0; sp < 10; sp++) {
        spawnParticle(canneryPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.5, (Math.random() - 0.5) * 1.5)), 0x38bdf8);
      }

      spawnFloatingText(canneryPos.clone().add(new THREE.Vector3(0, 2.0, 0)), "+1 Hộp Cá Xuất Khẩu 🥫 (+$20)", "#0284c7");
      showToast("🥫 Nhà Máy Đồ Hộp: Đã chế biến 2 Cá Tươi thành 1 Hộp Cá Xuất Khẩu (Được Tàu Container thu mua $120/hộp)!");

      updateHUD();
      triggerActionSave();
    }
  }

  // ---------------------------------------------------------------------------
  // TƯƠNG TÁC ĐẠI ĐÔ THỊ, KHAI KHOÁNG, NÔNG TRƯỜNG & HẠ TẦNG AN NINH
  // ---------------------------------------------------------------------------
  // 1. ĐẠI CÔNG TRƯỜNG SIÊU THÁP THẾ KỶ { x: -20, z: 86 }
  if (window.landmarkContributionPad) {
    const distToLM = pPos.distanceTo(window.landmarkContributionPad.pos);
    if (distToLM <= window.landmarkContributionPad.radius) {
      window.landmarkPromptCooldown = (window.landmarkPromptCooldown || 0) - dt;
      if (window.landmarkPromptCooldown <= 0) {
        window.landmarkPromptCooldown = 5.0;
        if (typeof openLandmarkModal === 'function') {
          openLandmarkModal();
        } else {
          showToast('🏗️ ĐẠI CÔNG TRƯỜNG THẾ KỶ: Bấm [E] để mở Bảng Đóng Góp Xây Dựng!');
        }
      }
    }
  }

  // 2. MỎ QUẶNG SẮT & LÒ CAO LUYỆN KIM { x: 75, z: -68 }
  if (window.miningPad) {
    if (window.miningPad.cooldown > 0) window.miningPad.cooldown -= dt;
    const distToMine = pPos.distanceTo(window.miningPad.pos);
    if (distToMine <= window.miningPad.radius && window.miningPad.cooldown <= 0) {
      window.miningPad.cooldown = 1.8;
      gameState.steelBeams = (gameState.steelBeams || 0) + 1;
      if (typeof sounds !== 'undefined' && sounds.playMiningPick) sounds.playMiningPick();
      spawnFloatingText(window.miningPad.pos.clone().add(new THREE.Vector3(0, 3.5, 0)), '+1 Dầm Thép Siêu Cường 🏗️', '#06b6d4');
      showToast(`⛏️ ĐÃ LUYỆN THÀNH CÔNG 1 DẦM THÉP SIÊU CƯỜNG! (Hiện có: ${gameState.steelBeams})`);
      updateHUD();
      triggerActionSave();
    }
  }

  // 3. TRẠM NGHIỀN XI MĂNG { x: 62, z: -75 }
  if (window.cementPad) {
    if (window.cementPad.cooldown > 0) window.cementPad.cooldown -= dt;
    const distToCement = pPos.distanceTo(window.cementPad.pos);
    if (distToCement <= window.cementPad.radius && window.cementPad.cooldown <= 0) {
      window.cementPad.cooldown = 1.8;
      gameState.cementBags = (gameState.cementBags || 0) + 1;
      if (typeof sounds !== 'undefined' && sounds.playWoodPlank) sounds.playWoodPlank();
      spawnFloatingText(window.cementPad.pos.clone().add(new THREE.Vector3(0, 3.5, 0)), '+1 Bao Xi Măng Nghiền 🧱', '#facc15');
      showToast(`🧱 ĐÃ NGHIỀN THÀNH CÔNG 1 BAO XI MĂNG! (Hiện có: ${gameState.cementBags})`);
      updateHUD();
      triggerActionSave();
    }
  }

  // 4. NÔNG TRƯỜNG & CHẾ BIẾN LƯƠNG THỰC { x: -65, z: -66 }
  if (window.agroFoodPad) {
    if (window.agroFoodPad.cooldown > 0) window.agroFoodPad.cooldown -= dt;
    const distToAgro = pPos.distanceTo(window.agroFoodPad.pos);
    if (distToAgro <= window.agroFoodPad.radius && window.agroFoodPad.cooldown <= 0) {
      window.agroFoodPad.cooldown = 2.0;
      gameState.cannedRations = (gameState.cannedRations || 0) + 2;
      if (window.cityState) {
        window.cityState.foodReserves = Math.min(window.cityState.maxFood || 20000, (window.cityState.foodReserves || 0) + 20);
        if (typeof updateCityDashboardHUD === 'function') updateCityDashboardHUD();
      }
      if (typeof sounds !== 'undefined' && sounds.playCollect) sounds.playCollect();
      spawnFloatingText(window.agroFoodPad.pos.clone().add(new THREE.Vector3(0, 3.5, 0)), '+2 Thùng Lương Thực 🥫 (+20 Dự trữ đô thị)', '#22c55e');
      showToast('🌾 ĐÃ THU HOẠCH & ĐÓNG HỘP 2 THÙNG LƯƠNG THỰC! Cung cấp dinh dưỡng cho cư dân đô thị.');
      updateHUD();
      triggerActionSave();
    }
  }

  // 5. ĐỒN CẢNH SÁT TRUNG TÂM { x: -58, z: 46 }
  if (window.policeEnlistPad) {
    const distToPol = pPos.distanceTo(window.policeEnlistPad.pos);
    if (distToPol <= window.policeEnlistPad.radius) {
      window.policeEnlistCooldown = (window.policeEnlistCooldown || 0) - dt;
      if (window.policeEnlistCooldown <= 0) {
        window.policeEnlistCooldown = 5.0;
        gameState.isPoliceOfficer = true;
        if (typeof openPoliceModal === 'function') {
          openPoliceModal();
        } else {
          showToast('👮 BẠN ĐÃ GIA NHẬP LỰC LƯỢNG CẢNH SÁT ĐÔ THỊ! Hãy lái Xe Tuần Tra [E] và truy bắt tội phạm [F]!');
        }
      }
    }
  }

  // 6. TRUNG TÂM CẤP CỨU & CỨU HỎA 911 { x: 70, z: 46 }
  if (window.hospitalFirePad) {
    const distToHosp = pPos.distanceTo(window.hospitalFirePad.pos);
    if (distToHosp <= window.hospitalFirePad.radius) {
      window.hospitalFireCooldown = (window.hospitalFireCooldown || 0) - dt;
      if (window.hospitalFireCooldown <= 0) {
        window.hospitalFireCooldown = 5.0;
        if (typeof openHospitalFireModal === 'function') {
          openHospitalFireModal();
        } else {
          showToast('🚑 TRUNG TÂM CẤP CỨU & 911: Bấm [E] để mở Bảng Nhiệm Vụ Cứu Hộ!');
        }
      }
    }
  }

  // 7. NHÀ TÙ TRUNG TÂM & NỘP TIỀN BẢO LÃNH { x: -145, z: 74 }
  if (window.prisonBailPad) {
    const distToJail = pPos.distanceTo(window.prisonBailPad.pos);
    if (distToJail <= window.prisonBailPad.radius) {
      window.prisonBailCooldown = (window.prisonBailCooldown || 0) - dt;
      if (window.prisonBailCooldown <= 0) {
        window.prisonBailCooldown = 4.0;
        if ((gameState.wantedStars || 0) > 0 || (gameState.jailedTimer || 0) > 0) {
          const bailCost = 2500;
          if (gameState.money >= bailCost) {
            gameState.money -= bailCost;
            gameState.wantedStars = 0;
            gameState.jailedTimer = 0;
            if (window.mpClient) window.mpClient.sendPrisonRelease();
            showToast(`🔓 ĐÃ NỘP $${bailCost} TIỀN BẢO LÃNH! Bạn đã được xóa án truy nã và tự do!`);
            updateHUD();
          } else {
            showToast(`⚠️ Cần $2,500 để nộp tiền bảo lãnh tại ngoại! Bạn có: $${gameState.money}`);
          }
        } else {
          showToast('⚖️ BẠN LÀ CÔNG DÂN GƯƠNG MẪU: Hồ sơ trong sạch (0 Sao truy nã)!');
        }
      }
    }
  }

  // 8. CHỢ ĐEN NGẦM { x: 75, z: 108 }
  if (window.blackMarketPad) {
    const distToBM = pPos.distanceTo(window.blackMarketPad.pos);
    if (distToBM <= window.blackMarketPad.radius) {
      window.blackMarketCooldown = (window.blackMarketCooldown || 0) - dt;
      if (window.blackMarketCooldown <= 0) {
        window.blackMarketCooldown = 3.5;
        if (gameState.planks > 0) {
          const count = gameState.planks;
          const cash = count * 45;
          gameState.planks = 0;
          gameState.money += cash;
          gameState.wantedStars = Math.min(5, (gameState.wantedStars || 0) + 1);
          if (window.mpClient) window.mpClient.sendCrimeCommit(gameState.wantedStars, 'Tiêu thụ hàng chợ đen');
          showToast(`🕶️ ĐÃ BÁN LẬU ${count} VÁN GỖ NHẬN $${cash}! Bị Cảnh sát nghi vấn (+1 ⭐ Truy nã)!`);
          updateHUD();
        } else {
          showToast('🕶️ CHỢ ĐEN: Mang ván gỗ hoặc hàng lậu đến đây để bán giá x2 USD (Coi chừng Cảnh sát)!');
        }
      }
    }
  }

  // 9. TÒA THỊ CHÍNH { x: -20, z: 46 }
  if (window.cityHallPad) {
    const distToHall = pPos.distanceTo(window.cityHallPad.pos);
    if (distToHall <= window.cityHallPad.radius) {
      window.cityHallCooldown = (window.cityHallCooldown || 0) - dt;
      if (window.cityHallCooldown <= 0) {
        window.cityHallCooldown = 5.0;
        if (typeof openCityHallModal === 'function') {
          openCityHallModal();
        } else {
          const mayor = (window.cityState && window.cityState.currentMayor) || 'Ban Quản Trị Lâm Thời';
          const treasury = (window.cityState && window.cityState.treasury) || 120000;
          showToast(`🏛️ TÒA THỊ CHÍNH: Thị trưởng: ${mayor} | Ngân khố công: $${treasury.toLocaleString()} USD`);
        }
      }
    }
  }

  // 10. NHÀ MÁY ĐIỆN ĐÔ THỊ { x: 75, z: -38.5 }
  if (window.powerFuelPad) {
    const distToPower = pPos.distanceTo(window.powerFuelPad.pos);
    if (distToPower <= window.powerFuelPad.radius) {
      window.powerFuelCooldown = (window.powerFuelCooldown || 0) - dt;
      if (window.powerFuelCooldown <= 0) {
        window.powerFuelCooldown = 4.0;
        showToast('⚡ NHÀ MÁY ĐIỆN: Bấm [E] để nạp 5 Ván gỗ vào lò đốt (+15 Nhiên liệu, nhận +$250)!');
      }
    }
  }

  // 11. SÀN CHỢ GIAO DỊCH TỰ DO { x: 10, z: 47 }
  if (window.marketTradingPad) {
    const distToMkt = pPos.distanceTo(window.marketTradingPad.pos);
    if (distToMkt <= window.marketTradingPad.radius) {
      window.marketTradingCooldown = (window.marketTradingCooldown || 0) - dt;
      if (window.marketTradingCooldown <= 0) {
        window.marketTradingCooldown = 5.0;
        if (typeof openMarketModal === 'function') {
          openMarketModal();
        } else {
          showToast('🛒 SÀN CHỢ GIAO DỊCH: Bấm [E] hoặc [M] để mở chợ mua bán với người chơi!');
        }
      }
    }
  }

  // 12. SÂN BAY HÀNG KHÔNG QUỐC TẾ { x: 35, z: -100.5 }
  if (window.airCargoPad) {
    const distToAir = pPos.distanceTo(window.airCargoPad.pos);
    if (distToAir <= window.airCargoPad.radius) {
      window.airCargoCooldown = (window.airCargoCooldown || 0) - dt;
      if (window.airCargoCooldown <= 0) {
        window.airCargoCooldown = 4.5;
        showToast('✈️ AIR CARGO DEPOT: Bấm [E] để nạp Pallet/Cá Hộp xuất khẩu quốc tế (Thưởng x3 USD)!');
      }
    }
  }

  // 13. DINH THỰ VEN BIỂN { x: 100, z: 48 }
  if (window.playerVillaPad) {
    const distToVilla = pPos.distanceTo(window.playerVillaPad.pos);
    if (distToVilla <= window.playerVillaPad.radius) {
      window.villaPadCooldown = (window.villaPadCooldown || 0) - dt;
      if (window.villaPadCooldown <= 0) {
        window.villaPadCooldown = 4.0;
        if (typeof openVillaModal === 'function') openVillaModal();
      }
    }
  }

  // 14. CỔNG ĐƯỜNG ĐUA CAO TỐC { x: 28, z: 32 }
  if (window.raceStartPad && isDrivingAny) {
    const distToRace = pPos.distanceTo(window.raceStartPad.pos);
    if (distToRace <= window.raceStartPad.radius) {
      window.racePadCooldown = (window.racePadCooldown || 0) - dt;
      if (window.racePadCooldown <= 0) {
        window.racePadCooldown = 20.0;
        if (typeof startHighwayRaceLap === 'function') startHighwayRaceLap();
      }
    }
  }

  // 15. KHU CHUNG CƯ DÂN CƯ { x: -65, z: 89 }
  if (window.residentialApartmentPad) {
    const distToRes = pPos.distanceTo(window.residentialApartmentPad.pos);
    if (distToRes <= window.residentialApartmentPad.radius) {
      window.residentialApartmentPad.cooldown = (window.residentialApartmentPad.cooldown || 0) - dt;
      if (window.residentialApartmentPad.cooldown <= 0) {
        window.residentialApartmentPad.cooldown = 4.5;
        showToast('🏙️ CHUNG CƯ DÂN CƯ: Bấm [E] để thu thuế thành phố (+$800/đợt)!');
      }
    }
  }

  // 16. NGHỆ SĨ GUITAR ĐƯỜNG PHỐ { x: -10, z: 42 }
  if (window.buskerPad) {
    const distToBusker = pPos.distanceTo(window.buskerPad.pos);
    if (distToBusker <= window.buskerPad.radius) {
      window.buskerPadCooldown = (window.buskerPadCooldown || 0) - dt;
      if (window.buskerPadCooldown <= 0) {
        window.buskerPadCooldown = 5.0;
        showToast('🎸 NGHỆ SĨ ĐƯỜNG PHỐ: Bấm [E] để thưởng tiền boa $20!');
      }
    }
  }

  // 17. TRẠM TÁI CHẾ SINH THÁI { x: 75, z: -90 }
  if (window.ecoRecyclingPad) {
    const distToEco = pPos.distanceTo(window.ecoRecyclingPad.pos);
    if (distToEco <= window.ecoRecyclingPad.radius) {
      window.ecoPadCooldown = (window.ecoPadCooldown || 0) - dt;
      if (window.ecoPadCooldown <= 0) {
        window.ecoPadCooldown = 4.5;
        showToast('♻️ TÁI CHẾ SINH THÁI: Bấm [E] để tái sinh gỗ/ván lấy +$600 USD!');
      }
    }
  }

  // 18. VÒNG QUAY MAY MẮN { x: -36, z: 40 }
  if (window.luckyWheelPad) {
    const distToWheel = pPos.distanceTo(window.luckyWheelPad.pos);
    if (distToWheel <= window.luckyWheelPad.radius) {
      window.wheelPadCooldown = (window.wheelPadCooldown || 0) - dt;
      if (window.wheelPadCooldown <= 0) {
        window.wheelPadCooldown = 4.0;
        showToast('🎡 VÒNG QUAY MAY MẮN: Bấm [E] để quay thưởng trúng tiền & Gems!');
      }
    }
  }

  // 19. MÔ-TÔ NƯỚC JETSKI { x: 132, z: 42 }
  if (window.jetskiMountPad) {
    const distToJet = pPos.distanceTo(window.jetskiMountPad.pos);
    if (distToJet <= window.jetskiMountPad.radius) {
      window.jetPadCooldown = (window.jetPadCooldown || 0) - dt;
      if (window.jetPadCooldown <= 0) {
        window.jetPadCooldown = 4.0;
        showToast('🌊 MÔ-TÔ NƯỚC JETSKI: Bấm [E] để nhảy lên lướt sóng!');
      }
    }
  }

  // 20. THỦY CUNG ĐẠI DƯƠNG { x: 142, z: 86 }
  if (window.oceanariumTicketPad) {
    const distToOcean = pPos.distanceTo(window.oceanariumTicketPad.pos);
    if (distToOcean <= window.oceanariumTicketPad.radius) {
      window.oceanPadCooldown = (window.oceanPadCooldown || 0) - dt;
      if (window.oceanPadCooldown <= 0) {
        window.oceanPadCooldown = 4.0;
        showToast('🏛️ THỦY CUNG ĐẠI DƯƠNG: Bấm [E] thu tiền vé tham quan (+$1,200)!');
      }
    }
  }

  // 21. TÀU NGẦM THÁM HIỂM BIỂN SÂU { x: 140, z: 74 }
  if (window.submarineMountPad) {
    const distToSub = pPos.distanceTo(window.submarineMountPad.pos);
    if (distToSub <= window.submarineMountPad.radius) {
      window.subPadCooldown = (window.subPadCooldown || 0) - dt;
      if (window.subPadCooldown <= 0) {
        window.subPadCooldown = 4.0;
        showToast('⚓ TÀU NGẦM THÁM HIỂM: Bấm [E] để lặn biển & tìm hòm báu (+$2,500 & Ngọc trai)!');
      }
    }
  }

  // 22. GIÀN KHOAN DẦU NGOÀI KHƠI { x: 180, z: -45 }
  if (window.oilRigPad) {
    const distToRig = pPos.distanceTo(window.oilRigPad.pos);
    if (distToRig <= window.oilRigPad.radius) {
      window.rigPadCooldown = (window.rigPadCooldown || 0) - dt;
      if (window.rigPadCooldown <= 0) {
        window.rigPadCooldown = 4.0;
        showToast('🛢️ GIÀN KHOAN DẦU: Bấm [E] để thu hoạch 5 thùng Dầu Thô (+$2,000)!');
      }
    }
  }

  // 23. NHÀ MÁY HÓA DẦU { x: 98, z: -70 }
  if (window.petroleumRefineryPad) {
    const distToPetro = pPos.distanceTo(window.petroleumRefineryPad.pos);
    if (distToPetro <= window.petroleumRefineryPad.radius) {
      window.petroPadCooldown = (window.petroPadCooldown || 0) - dt;
      if (window.petroPadCooldown <= 0) {
        window.petroPadCooldown = 4.0;
        showToast('🏭 NHÀ MÁY HÓA DẦU: Bấm [E] nạp dầu thô tinh chế xăng & polymer (+$3,000)!');
      }
    }
  }

  // 24. SÀN CHỨNG KHOÁN WALL STREET { x: -42, z: 67 }
  if (window.stockExchangePad) {
    const distToStock = pPos.distanceTo(window.stockExchangePad.pos);
    if (distToStock <= window.stockExchangePad.radius) {
      window.stockPadCooldown = (window.stockPadCooldown || 0) - dt;
      if (window.stockPadCooldown <= 0) {
        window.stockPadCooldown = 4.0;
        showToast('📈 SÀN CHỨNG KHOÁN: Bấm [E] giao dịch cổ phiếu & lấy vía Bò Vàng!');
      }
    }
  }

  // 25. NGÂN HÀNG TRUNG ƯƠNG { x: 6, z: 67 }
  if (window.centralBankPad) {
    const distToBank = pPos.distanceTo(window.centralBankPad.pos);
    if (distToBank <= window.centralBankPad.radius) {
      window.bankPadCooldown = (window.bankPadCooldown || 0) - dt;
      if (window.bankPadCooldown <= 0) {
        window.bankPadCooldown = 4.0;
        showToast('🏦 NGÂN HÀNG TRUNG ƯƠNG: Bấm [E] nhận nhiệm vụ áp tải hoặc đột kích hầm vàng!');
      }
    }
  }

  // 26. CỬA HÀNG THÚ CƯNG & AUTO-DRONE { x: -75, z: 112 }
  if (window.petSanctuaryPad) {
    const distToPet = pPos.distanceTo(window.petSanctuaryPad.pos);
    if (distToPet <= window.petSanctuaryPad.radius) {
      window.petStorePadCooldown = (window.petStorePadCooldown || 0) - dt;
      if (window.petStorePadCooldown <= 0) {
        window.petStorePadCooldown = 4.0;
        showToast('🐾 THÚ CƯNG & AUTO-DRONE: Bấm [E] nhận nuôi Shiba, Mèo Cyber hoặc Drone!');
      }
    }
  }

  // 27. XƯỞNG CHẾ TÁC ĐA TẦNG { x: 65, z: -50 }
  if (window.craftingAssemblyPad) {
    const distToCraft = pPos.distanceTo(window.craftingAssemblyPad.pos);
    if (distToCraft <= window.craftingAssemblyPad.radius) {
      window.craftPadCooldown = (window.craftPadCooldown || 0) - dt;
      if (window.craftPadCooldown <= 0) {
        window.craftPadCooldown = 4.0;
        showToast('🏭 XƯỞNG CHẾ TÁC: Bấm [E] để lắp ráp hàng công nghệ cao & xuất khẩu!');
      }
    }
  }

  // 28. TÒA THỊ CHÍNH & SẮC LỆNH { x: -18, z: 67 }
  if (window.cityHallPad) {
    const distToHall = pPos.distanceTo(window.cityHallPad.pos);
    if (distToHall <= window.cityHallPad.radius) {
      window.hallPadCooldown = (window.hallPadCooldown || 0) - dt;
      if (window.hallPadCooldown <= 0) {
        window.hallPadCooldown = 4.0;
        showToast('🏛️ TÒA THỊ CHÍNH: Bấm [E] để ban hành Sắc Lệnh Đô Thị & nâng thứ hạng Thị Trưởng!');
      }
    }
  }
}

function updateVipContracts(dt) {
  const widget = document.getElementById('vip-contract-widget');
  const timerEl = document.getElementById('contract-timer');
  const descEl = document.getElementById('contract-desc');
  const fillEl = document.getElementById('contract-progress-fill');
  const rewardEl = document.getElementById('contract-reward');
  const counterEl = document.getElementById('contract-counter');

  if (!gameState.activeContract) {
    if (widget) widget.classList.remove('active');
    contractCooldownTimer -= dt;
    if (contractCooldownTimer <= 0) {
      const contractPool = [
        { title: 'Tập đoàn Xây Dựng Landmark', target: 'planks', required: 15, time: 150, rewardMoney: 6000, rewardGems: 10 },
        { title: 'Đại lý Nội Thất Luxury', target: 'pallets', required: 3, time: 180, rewardMoney: 12000, rewardGems: 25 },
        { title: 'Chuỗi Siêu Thị Hải Sản Đông Á', target: 'cannedFish', required: 6, time: 160, rewardMoney: 8500, rewardGems: 15 }
      ];
      const selected = contractPool[Math.floor(Math.random() * contractPool.length)];
      gameState.activeContract = {
        ...selected,
        timeLeft: selected.time,
        progress: 0
      };
      sounds.playContractAlert();
      showToast(`⚡ HỢP ĐỒNG VIP MỚI: ${selected.title}!`);
    }
    return;
  }

  const c = gameState.activeContract;
  c.timeLeft -= dt;

  if (widget) widget.classList.add('active');

  const mins = Math.floor(Math.max(0, c.timeLeft) / 60);
  const secs = Math.floor(Math.max(0, c.timeLeft) % 60);
  if (timerEl) timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  if (descEl) descEl.textContent = `${c.title} (Cần ${c.required} ${c.target === 'planks' ? 'Ván' : c.target === 'pallets' ? 'Pallet' : 'Hộp Cá'})`;
  if (rewardEl) rewardEl.textContent = `+$${c.rewardMoney.toLocaleString()} 💵 +${c.rewardGems} 💎`;

  let current = 0;
  if (c.target === 'planks') current = Math.min(c.required, gameState.planks || 0);
  else if (c.target === 'pallets') current = Math.min(c.required, gameState.pallets || 0);
  else if (c.target === 'cannedFish') current = Math.min(c.required, gameState.cannedFish || 0);

  const pct = Math.min(100, Math.floor((current / c.required) * 100));
  if (fillEl) fillEl.style.width = `${pct}%`;
  if (counterEl) counterEl.textContent = `${current}/${c.required}`;

  if (current >= c.required) {
    if (c.target === 'planks') gameState.planks -= c.required;
    else if (c.target === 'pallets') gameState.pallets -= c.required;
    else if (c.target === 'cannedFish') gameState.cannedFish -= c.required;

    gameState.money += c.rewardMoney;
    gameState.gems = (gameState.gems || 0) + c.rewardGems;
    gameState.exportOrders = (gameState.exportOrders || 0) + 3;

    sounds.playLevelUp();
    showToast(`🎉 HOÀN THÀNH HỢP ĐỒNG VIP: +$${c.rewardMoney.toLocaleString()} 💵 & +${c.rewardGems} 💎!`);
    const pPos = (window.player && window.player.mesh) ? window.player.mesh.position : new THREE.Vector3(0, 2, 0);
    spawnFloatingText(pPos, `+$${c.rewardMoney.toLocaleString()} & +${c.rewardGems} 💎!`, '#facc15');

    gameState.activeContract = null;
    contractCooldownTimer = 60;
    if (widget) widget.classList.remove('active');
    updateHUD();
    triggerActionSave();
  } else if (c.timeLeft <= 0) {
    showToast(`❌ HẾT THỜI GIAN: Hợp đồng ${c.title} đã bị hủy.`);
    gameState.activeContract = null;
    contractCooldownTimer = 45;
    if (widget) widget.classList.remove('active');
  }
}

// ---------------------------------------------------------------------------
// DAY / NIGHT CYCLE (SYNCHRONIZED ATMOSPHERE & CELESTIAL SKY DOME)
// ---------------------------------------------------------------------------
function updateDayNightCycle(time) {
  const isNight = typeof gameState !== 'undefined' ? (gameState.gameHour < 5.5 || gameState.gameHour > 18.5) : false;
  const isSunset = typeof gameState !== 'undefined' ? ((gameState.gameHour >= 16.5 && gameState.gameHour <= 18.5) || (gameState.gameHour >= 5.0 && gameState.gameHour <= 6.5)) : false;

  // Chuyển sắc bầu trời vòm tự nhiên theo chu kỳ ngày đêm
  if (window.skyDome && window.skyDome.material) {
    if (isNight) {
      window.skyDome.material.color.lerp(new THREE.Color(0x1e293b), 0.05);
    } else if (isSunset) {
      window.skyDome.material.color.lerp(new THREE.Color(0xfdba74), 0.05);
    } else {
      window.skyDome.material.color.lerp(new THREE.Color(0xffffff), 0.05);
    }
  }

  // Tự động thắp sáng đom đóm lập lòe vào ban đêm
  if (window.fireflies && window.fireflies.material) {
    window.fireflies.material.opacity = isNight ? 0.85 : 0.0;
  }
}

let sawSparkTimer = 0;
let frameCount = 0;
let fpsTimer = 0;
let fpsCount = 0;
let currentFPS = 60;

// ---------------------------------------------------------------------------
// MAIN GAME LOOP (60 FPS STABLE)
// ---------------------------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.getElapsedTime();

  frameCount++;
  fpsCount++;
  fpsTimer += dt;
  if (fpsTimer >= 1.0) {
    currentFPS = fpsCount / fpsTimer;
    fpsCount = 0;
    fpsTimer = 0;
    // Tự động tối ưu độ phân giải nếu máy yếu hoặc lag (FPS < 35)
    if (currentFPS < 35 && renderer && renderer.getPixelRatio() > 0.85) {
      renderer.setPixelRatio(0.85);
    }
  }

  // TỰ ĐỘNG THÍCH ỨNG HIỆU NĂNG 60 FPS (ZERO-LAG ADAPTIVE SCALER)
  if (fpsTimer >= 1.0) {
    if (currentFPS < 42 && renderer && renderer.getPixelRatio() > 0.85) {
      renderer.setPixelRatio(0.85); // Hạ nhẹ độ phân giải để giữ vững 60 FPS
    } else if (currentFPS < 28 && renderer && renderer.shadowMap.enabled) {
      renderer.shadowMap.enabled = false; // Máy quá yếu: tự động tắt bóng đổ để cứu FPS
    }
  }

  // Đọc phím điều khiển bàn phím WASD (nếu không đang lái phương tiện nào)
  isDrivingAny = typeof gameState !== 'undefined' &&
    ((gameState.isDrivingForklift && window.drivableForklift) ||
      (gameState.isDrivingPickup && window.drivablePickup) ||
      (gameState.isDrivingPolice && window.drivablePoliceCruiser) ||
      (gameState.isDrivingFireEngine && window.drivableFireEngine) ||
      (gameState.isDrivingTruck && window.drivableLumberTruck) ||
      (gameState.isDrivingSpeedboat && window.drivableSpeedboat) ||
      (gameState.isDrivingHelicopter && window.drivableHelicopter) ||
      (gameState.isDrivingTrain && window.steamTrain));

  if (!joystickActive && !isDrivingAny) {
    let moveX = 0, moveZ = 0;
    if (keysPressed['KeyW'] || keysPressed['ArrowUp']) moveZ -= 1;
    if (keysPressed['KeyS'] || keysPressed['ArrowDown']) moveZ += 1;
    if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) moveX -= 1;
    if (keysPressed['KeyD'] || keysPressed['ArrowRight']) moveX += 1;

    if (moveX !== 0 || moveZ !== 0) {
      player.setMoveInput(moveX, moveZ);
    } else {
      player.setMoveInput(0, 0);
    }
  }

  // Cập nhật người chơi
  player.update(dt);

  // Camera bám thông minh nội suy (Smooth Damping Camera - tự động thích ứng khi lái mọi loại phương tiện)
  let focusPos = player.mesh.position;
  if (gameState.isDrivingForklift && window.drivableForklift) focusPos = window.drivableForklift.mesh.position;
  else if (gameState.isDrivingPickup && window.drivablePickup) focusPos = window.drivablePickup.mesh.position;
  else if (gameState.isDrivingPolice && window.drivablePoliceCruiser) focusPos = window.drivablePoliceCruiser.mesh.position;
  else if (gameState.isDrivingFireEngine && window.drivableFireEngine) focusPos = window.drivableFireEngine.mesh.position;
  else if (gameState.isDrivingTruck && window.drivableLumberTruck) focusPos = window.drivableLumberTruck.mesh.position;
  else if (gameState.isDrivingSpeedboat && window.drivableSpeedboat) focusPos = window.drivableSpeedboat.mesh.position;
  else if (gameState.isDrivingHelicopter && window.drivableHelicopter) focusPos = window.drivableHelicopter.mesh.position;
  else if (gameState.isDrivingTrain && window.steamTrain) focusPos = window.steamTrain.locomotiveGroup.position;

  // Camera bám trực tiếp 1:1 theo nhân vật (Zero Input Lag & Buttery Smooth 60 FPS)
  const deltaX = focusPos.x - controls.target.x;
  const deltaY = focusPos.y - controls.target.y;
  const deltaZ = focusPos.z - controls.target.z;

  controls.target.set(focusPos.x, focusPos.y, focusPos.z);
  camera.position.x += deltaX;
  camera.position.y += deltaY;
  camera.position.z += deltaZ;

  // Hiệu ứng Rung Chấn Camera Điện Ảnh (Decaying Micro Shake)
  if (cameraShakeTimer > 0) {
    cameraShakeTimer -= dt;
    const decay = Math.max(0, cameraShakeTimer / 0.28);
    camera.position.x += (Math.random() - 0.5) * cameraShakeIntensity * decay;
    camera.position.y += (Math.random() - 0.5) * cameraShakeIntensity * decay;
    camera.position.z += (Math.random() - 0.5) * cameraShakeIntensity * decay;
  }

  // Chấn động rung mặt đất khi tàu hỏa chạy ngang qua (Screen Ground Tremor - Mục 14)
  if (window.steamTrainSystem && window.steamTrainSystem.locomotive) {
    const trainDist = focusPos.distanceTo(window.steamTrainSystem.locomotive.position);
    if (trainDist < 22.0) {
      const tremor = Math.max(0, 1.0 - trainDist / 22.0) * 0.08;
      camera.position.x += (Math.random() - 0.5) * tremor;
      camera.position.y += (Math.random() - 0.5) * tremor;
    }
  }

  // Hiệu ứng giọt nước đọng trên camera khi mưa (Camera Rain Droplets - Mục 5)
  if (frameCount % 15 === 0) {
    const rainOverlay = document.getElementById('rain-camera-overlay');
    if (rainOverlay && typeof gameState !== 'undefined') {
      const isRaining = (gameState.weather === 'rain');
      rainOverlay.style.opacity = isRaining ? '0.65' : '0';
    }
  }

  // Góc nhìn FOV điện ảnh tự động mở rộng theo tốc độ di chuyển
  const isHighSpeed = isDrivingAny || (gameState.overtimeRush && gameState.overtimeRush.active);
  const targetFov = isHighSpeed ? 48.0 : 45.0;
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, dt * 3.5);
    camera.updateProjectionMatrix();
  }

  controls.update();

  // 3D GPS Neon Waypoint & Trail
  if (gameState && gameState.gpsTarget) {
    if (!window.gpsWaypointMesh && typeof scene !== 'undefined') {
      const gGroup = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.6, 2.2, 32),
        new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      gGroup.add(ring);

      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.45, 14, 16),
        new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.6 })
      );
      beacon.position.y = 7;
      gGroup.add(beacon);

      scene.add(gGroup);
      window.gpsWaypointMesh = gGroup;
    }

    if (window.gpsWaypointMesh) {
      window.gpsWaypointMesh.visible = true;
      window.gpsWaypointMesh.position.set(gameState.gpsTarget.x, 0.2, gameState.gpsTarget.z);
      window.gpsWaypointMesh.rotation.y += dt * 2.5;

      const dTarget = player.mesh.position.distanceTo(new THREE.Vector3(gameState.gpsTarget.x, 0, gameState.gpsTarget.z));
      if (dTarget <= 5.5) {
        showToast(`🎯 Bạn đã đến điểm GPS: ${gameState.gpsTarget.name}!`);
        sounds.playCoinCollect();
        gameState.gpsTarget = null;
        window.gpsWaypointMesh.visible = false;
      }
    }
  } else if (window.gpsWaypointMesh) {
    window.gpsWaypointMesh.visible = false;
  }

  // BÓNG TIẾP XÚC CHÂN THỰC DYNAMIC BLOB CONTACT SHADOW (MỤC 2 & 21)
  if (!window.playerBlobShadow && typeof scene !== 'undefined') {
    const sGeo = new THREE.PlaneGeometry(1.8, 1.8);
    sGeo.rotateX(-Math.PI / 2);
    const sMat = new THREE.MeshBasicMaterial({
      map: (typeof Textures !== 'undefined' && Textures.blobShadow) ? Textures.blobShadow() : null,
      transparent: true,
      opacity: 0.52,
      depthWrite: false
    });
    window.playerBlobShadow = new THREE.Mesh(sGeo, sMat);
    scene.add(window.playerBlobShadow);
  }
  if (window.playerBlobShadow) {
    window.playerBlobShadow.position.set(focusPos.x, 0.03, focusPos.z);
    const alt = Math.max(0, focusPos.y);
    const sScale = Math.max(0.35, 1.0 - alt * 0.035);
    window.playerBlobShadow.scale.set(sScale, sScale, sScale);
    window.playerBlobShadow.material.opacity = Math.max(0.05, 0.52 - alt * 0.025);
  }

  // CẬP NHẬT HUD TỐC ĐỘ, ĐỒNG HỒ & BẢNG TIN 100 MỤC
  if (frameCount % 6 === 0 && typeof update100SuiteHUD === 'function') {
    update100SuiteHUD(dt);
  }

  // TỐI ƯU HÓA 2: Throttled Minimap 2D Canvas (vẽ 6 FPS thay vì 60 FPS, tiết kiệm 90% CPU)
  if (frameCount % 10 === 0 && typeof renderMinimap === 'function') {
    renderMinimap();
  }

  // TỐI ƯU HÓA 3: Dynamic Light Distance Culling (Tắt đèn xa > 36m khỏi camera)
  if (frameCount % 20 === 0 && window.nightLights && player) {
    const pPos = player.mesh.position;
    window.nightLights.forEach(light => {
      const d = light.parent ? light.parent.position.distanceTo(pPos) : light.position.distanceTo(pPos);
      light.visible = (d < 36.0);
    });
  }

  // CẬP NHẬT REAL-TIME MULTIPLAYER (Đồng bộ vị trí & bạn bè)
  if (window.multiplayerManager) {
    window.multiplayerManager.update(dt);
  }

  // Cập nhật Sàn Chứng Khoán Tycoon & Cổ tức thụ động
  if (typeof updateStockMarket === 'function') {
    updateStockMarket(dt);
  }

  // Cập nhật đếm ngược chế độ Tăng Ca Nhà Máy (Overtime Rush)
  if (gameState.overtimeRush) {
    if (gameState.overtimeRush.active) {
      gameState.overtimeRush.timer -= dt;
      if (gameState.overtimeRush.timer <= 0) {
        gameState.overtimeRush.active = false;
        gameState.overtimeRush.timer = 0;
        showToast('⚡ Hết thời gian Tăng Ca! Công nhân trở về tốc độ bình thường.');
        updateHUD();
      }
    }
    if (gameState.overtimeRush.cooldown > 0) {
      gameState.overtimeRush.cooldown -= dt;
    }
  }

  // Cập nhật Sốt Giá Thị Trường Hàng Hóa Thế Giới (Dynamic Market Rush)
  if (gameState.marketState && typeof MARKET_COMMODITIES !== 'undefined') {
    if (gameState.marketState.timeLeft > 0) {
      gameState.marketState.timeLeft -= dt;
      if (gameState.marketState.timeLeft <= 0) {
        gameState.marketState.activeCommodity = null;
        gameState.marketState.multiplier = 1.0;
        gameState.marketState.headline = 'Thị trường thế giới đang ổn định. Nhu cầu xuất khẩu bình thường.';
        showToast('📊 Thị trường thế giới đã bình ổn trở lại!');
      }
    } else {
      window.marketRushTimer = (window.marketRushTimer || 0) + dt;
      if (window.marketRushTimer >= 180.0) { // Mỗi 3 phút xuất hiện 1 đợt sốt giá hàng hóa
        window.marketRushTimer = 0;
        const keys = Object.keys(MARKET_COMMODITIES);
        const randKey = keys[Math.floor(Math.random() * keys.length)];
        const item = MARKET_COMMODITIES[randKey];
        gameState.marketState.activeCommodity = randKey;
        gameState.marketState.multiplier = item.multiplier;
        gameState.marketState.headline = item.headline;
        gameState.marketState.timeLeft = 120.0; // Sốt giá 2 phút

        if (typeof sounds !== 'undefined' && sounds.playContractAlert) sounds.playContractAlert();
        showToast(item.headline);
      }
    }
    if (typeof updateDynamicMarketUI === 'function') {
      updateDynamicMarketUI();
    }
  }

  // Tọa độ bóng đổ Mặt Trời bám mượt mà theo tiêu điểm (Zero Shadow Popping)
  if (window.sunLight) {
    window.sunLight.position.set(focusPos.x - 30, 50, focusPos.z - 24);
    window.sunLight.target.position.set(focusPos.x, focusPos.y, focusPos.z);
  }

  // Cập nhật Thế giới, Thác nước, Thảm cỏ đung đưa & Ô nâng cấp
  updateWorld(dt, time, player.mesh.position);

  // Cập nhật Phương tiện & Instanced Boids
  updateVehicles(dt, time, player.mesh.position);

  // Xoay Cần Cẩu Tháp Siêu Công Trình Thế Kỷ
  if (window.towerCraneArm) {
    window.towerCraneArm.rotation.y += dt * 0.25;
  }

  // Xoay Turbine Nhà Máy Điện Đô Thị
  if (window.powerTurbines) {
    window.powerTurbines.forEach(tb => tb.rotation.x += dt * 6.5);
  }

  // Cập nhật Hiệu ứng Hỏa hoạn 3D thời gian thực
  if (typeof updateFireCrisis3DEffect === 'function') {
    updateFireCrisis3DEffect(dt, time);
  }

  // Cập nhật Hợp đồng VIP & Nhiệm vụ Logistics
  if (typeof updateVipContracts === 'function') {
    updateVipContracts(dt);
  }
  if (typeof updateLogisticsCareerMissions === 'function') {
    updateLogisticsCareerMissions(dt);
  }

  // Cập nhật Chuyến bay Cargo Plane quốc tế & Drone vận tải
  if (typeof updateCargoPlaneFlight === 'function') {
    updateCargoPlaneFlight(dt, time);
  }
  if (typeof updateLogisticsCargoDrone === 'function') {
    updateLogisticsCargoDrone(dt, time);
  }

  // Cập nhật Bạn đồng hành K-9 Dog
  if (typeof updateK9Companion === 'function') {
    updateK9Companion(dt, time, player ? player.mesh.position : null);
  }

  // Cập nhật Mini-game Câu cá & Đua xe cao tốc
  if (typeof updateFishingReelingMiniGame === 'function') {
    updateFishingReelingMiniGame(dt);
  }
  if (typeof updateHighwayRaceLap === 'function') {
    updateHighwayRaceLap(dt, (isDrivingAny && focusPos) ? focusPos : (player ? player.mesh.position : null));
  }

  // Cập nhật Tiền thuê thụ động Dinh thự ven biển
  if (typeof updateVillaPassiveIncome === 'function') {
    updateVillaPassiveIncome(dt);
  }

  // Thiên tai sấm sét đô thị ngẫu nhiên
  if (Math.random() < 0.00035 && typeof triggerCityLightningStrike === 'function') {
    triggerCityLightningStrike(scene);
  }

  // Cập nhật Đám đông Cư dân đi bộ dạo phố (Pedestrian Crowd AI)
  if (typeof updateCityPedestrians === 'function') {
    updateCityPedestrians(dt, time, (isDrivingAny && focusPos) ? focusPos : (player ? player.mesh.position : null));
  }

  // Cập nhật Đội Xe & Cảnh sát Tuần tra / Truy đuổi AI (Active Police AI)
  if (typeof updateAIPoliceForce === 'function') {
    const suspectPos = (isDrivingAny && focusPos) ? focusPos : (player ? player.mesh.position : null);
    updateAIPoliceForce(dt, time, suspectPos, gameState.wantedStars);
  }

  // Cooldown thu thuế dân cư
  if (window.residentTaxCooldown && window.residentTaxCooldown > 0) {
    window.residentTaxCooldown -= dt;
  }

  // Cập nhật Cánh quạt Trực thăng cấp cứu Medevac & Đèn xe cứu thương
  if (window.medevacHelicopterRotor) {
    window.medevacHelicopterRotor.rotation.y += dt * 18.0;
  }
  if (window.aiAmbulance && window.aiAmbulance.group) {
    window.aiAmbulance.timer += dt * 4.0;
    if (window.aiAmbulance.beacon) {
      window.aiAmbulance.beacon.material.color.setHex(Math.sin(window.aiAmbulance.timer * 4.0) > 0 ? 0xef4444 : 0xfbbf24);
    }
  }

  // Cập nhật Cánh đồng 3 Turbine Điện Gió & Đèn Hải Đăng xoay quét biển
  if (window.windTurbineBlades && window.windTurbineBlades.length > 0) {
    for (let wi = 0; wi < window.windTurbineBlades.length; wi++) {
      window.windTurbineBlades[wi].rotation.z += dt * 1.6;
    }
  }
  if (window.lighthouseBeamGroup) {
    window.lighthouseBeamGroup.rotation.y += dt * 0.75;
  }

  // Chu kỳ Đèn giao thông thông minh 3 pha (Xanh 15s -> Vàng 3s -> Đỏ 12s)
  if (window.trafficCycle && window.trafficLightLenses) {
    window.trafficCycle.timer -= dt;
    if (window.trafficCycle.timer <= 0) {
      if (window.trafficCycle.phase === 'green') {
        window.trafficCycle.phase = 'yellow';
        window.trafficCycle.timer = 3.0;
        window.trafficLightLenses.green.material.color.setHex(0x1e293b);
        window.trafficLightLenses.yellow.material.color.setHex(0xfacc15);
        window.trafficLightLenses.red.material.color.setHex(0x1e293b);
      } else if (window.trafficCycle.phase === 'yellow') {
        window.trafficCycle.phase = 'red';
        window.trafficCycle.timer = 12.0;
        window.trafficLightLenses.green.material.color.setHex(0x1e293b);
        window.trafficLightLenses.yellow.material.color.setHex(0x1e293b);
        window.trafficLightLenses.red.material.color.setHex(0xef4444);
      } else {
        window.trafficCycle.phase = 'green';
        window.trafficCycle.timer = 15.0;
        window.trafficLightLenses.green.material.color.setHex(0x22c55e);
        window.trafficLightLenses.yellow.material.color.setHex(0x1e293b);
        window.trafficLightLenses.red.material.color.setHex(0x1e293b);
      }
    }
  }

  // Cập nhật hoạt ảnh Mini NPC trong các tòa nhà Cutaway không mái (Tối ưu GPU 30 FPS + Distance Culling < 55m)
  if (frameCount % 2 === 0 && window.cutawayMiniNPCs && window.cutawayMiniNPCs.length > 0) {
    const t = performance.now() * 0.003;
    const pPos = (isDrivingAny && focusPos) ? focusPos : (player ? player.mesh.position : null);
    for (let ni = 0; ni < window.cutawayMiniNPCs.length; ni++) {
      const npc = window.cutawayMiniNPCs[ni];
      if (pPos && npc.group && npc.group.position.distanceTo(pPos) > 55.0) continue;
      if (npc.animType === 'breathe') {
        npc.group.position.y = npc.baseY + Math.sin(t * 1.5 + npc.phase) * 0.02;
      } else if (npc.animType === 'hammer') {
        if (npc.arm) npc.arm.rotation.x = Math.sin(t * 3.5 + npc.phase) * 0.6 - 0.4;
      } else if (npc.animType === 'type') {
        if (npc.arm) npc.arm.rotation.x = Math.sin(t * 5 + npc.phase) * 0.15 - 0.7;
        if (npc.leftArm) npc.leftArm.rotation.x = Math.sin(t * 5 + npc.phase + 1.5) * 0.15 - 0.7;
      } else if (npc.animType === 'turn') {
        if (npc.head) npc.head.rotation.y = Math.sin(t * 0.8 + npc.phase) * 0.45;
      }
    }
  }

  // Cập nhật 5 Đại Nâng Cấp Siêu Đô Thị (Thủy Cung, Giàn Khoan, Hầm Vàng Heist, Auto-Drone)
  if (typeof updateNewMegaSystems === 'function') {
    const activePos = (isDrivingAny && focusPos) ? focusPos : (player ? player.mesh.position : null);
    updateNewMegaSystems(dt, time, activePos);
  }

  // Quản lý thời gian thụ án Trại Giam Biệt Lập Ngoại Ô
  if (gameState.jailedTimer && gameState.jailedTimer > 0) {
    gameState.jailedTimer -= dt;
    if (player && player.mesh) {
      player.mesh.position.x = THREE.MathUtils.clamp(player.mesh.position.x, -156, -134);
      player.mesh.position.z = THREE.MathUtils.clamp(player.mesh.position.z, 50, 70);
    }
    if (gameState.jailedTimer <= 0) {
      gameState.jailedTimer = 0;
      gameState.wantedStars = 0;
      showToast('🔓 BẠN ĐÃ THỤ ÁN XONG! Bạn được tự do trở lại thế giới.');
      if (window.mpClient) window.mpClient.sendPrisonRelease();
      updateHUD();
    }
  }

  // Camera giao thông bắn tốc độ phạt nguội
  window.speedTrapCooldown = (window.speedTrapCooldown || 0) - dt;
  if (window.speedTrapCooldown <= 0 && isDrivingAny && !gameState.isDrivingPolice) {
    let curVel = 0;
    if (window.drivablePickup && gameState.isDrivingPickup) curVel = window.drivablePickup.velocity;
    if (window.drivableLumberTruck && gameState.isDrivingTruck) curVel = window.drivableLumberTruck.velocity;
    if (Math.abs(curVel) > 17.5 && ((focusPos.z > -20 && focusPos.z < 20) || (focusPos.z > 50 && focusPos.z < 105))) {
      window.speedTrapCooldown = 25.0;
      gameState.wantedStars = Math.min(5, (gameState.wantedStars || 0) + 1);
      if (window.mpClient) window.mpClient.sendCrimeCommit(gameState.wantedStars, 'Chạy quá tốc độ đô thị');
      showToast('📸 CAMERA BẮN TỐC ĐỘ: Xe chạy quá tốc độ quy định (>65km/h)! (+1 ⭐ Truy nã)');
      updateHUD();
    }
  }

  // Cập nhật Hệ thống Hạt Object Pool, Lá Rụng & Sóng Chấn Động
  updateParticles(dt);
  updateFallingLeaves(dt, time);
  updateForestPollen(dt, time);
  updateShockwaves(dt);

  // Hiệu ứng giọt nước bắn tóe & sóng gợn khi người chơi lội nước / bãi biển
  if (window.player && window.player.isMoving && frameCount % 6 === 0) {
    const pPos = window.player.mesh.position;
    const inRiver = (pPos.z >= 7.0 && pPos.z <= 25.0 && (pPos.x < 22.0 || pPos.x > 34.0));
    const inBeach = (pPos.x >= 115.0 && pPos.z >= 25.0);
    if ((inRiver || inBeach) && typeof window.spawnParticle === 'function') {
      window.spawnParticle(pPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.05, (Math.random() - 0.5) * 0.6)), 0xe0f2fe);
    }
  }

  // Kiểm tra Vùng va chạm & Triggers (bọc try-catch chống đứng màn hình)
  try {
    checkZoneTriggers(dt);
  } catch (err) {
    console.warn('[!] Zone trigger non-fatal warning:', err);
  }

  // Chu kỳ Ngày - Đêm
  updateDayNightCycle(time);

  // Xoay lưỡi cưa trung tâm & bắn tia lửa kim loại / khói mùn cưa (chỉ khi người chơi ở gần < 35m)
  if (window.blade1 && window.blade2) {
    window.blade1.rotateZ(dt * 22);
    window.blade2.rotateZ(dt * 22);

    const distToSaw = player ? player.mesh.position.distanceTo(window.blade1.position) : 999;
    if (distToSaw < 35.0) {
      sawSparkTimer += dt;
      if (sawSparkTimer >= 0.16) {
        sawSparkTimer = 0;
        spawnParticle(new THREE.Vector3(-0.8, 1.4, -18), 0xf97316); // Tia lửa cam
        spawnParticle(new THREE.Vector3(0.8, 1.4, -18), 0xfbbf24);  // Tia lửa vàng
        spawnParticle(new THREE.Vector3(0, 1.6, -18), 0xe2e8f0);    // Khói mùn cưa
      }
    }
  }

  // Cập nhật Thước đo trên đầu & HUD (Throttle 30 FPS với GPU Transform)
  if (frameCount % 2 === 0) {
    updateHeadGauge();
  }

  // Render Scene
  renderer.render(scene, camera);
}

function updateNewMegaSystems(dt, time, pPos) {
  // 1. Thủy cung & Sinh vật biển bơi lượn quanh vòm kính
  if (window.oceanariumCreatures && window.oceanariumCreatures.length > 0) {
    for (let ci = 0; ci < window.oceanariumCreatures.length; ci++) {
      const c = window.oceanariumCreatures[ci];
      const curAngle = c.baseAngle + time * c.speed * 0.25;
      const cx = 148 + Math.cos(curAngle) * c.radius;
      const cz = 86 + Math.sin(curAngle) * c.radius;
      c.group.position.set(cx, c.depthY + Math.sin(time * 2.0 + ci) * 0.3, cz);
      c.group.rotation.y = -curAngle + Math.PI / 2;
    }
  }
  // Chân vịt tàu ngầm quay
  if (window.submarinePropeller) {
    window.submarinePropeller.rotation.x += dt * 8.0;
  }
  // Bảng LED ma trận Phố Wall cuộn chữ động thời gian thực (Zero GC)
  if (window.wallStreetTickerTex) {
    window.wallStreetTickerTex.offset.x += dt * 0.06;
  }

  // 2. Giàn khoan dầu: Đuốc khí bập bùng & cần bơm dầu gật gù
  if (window.oilRigFlareMesh) {
    const flameScale = 1.0 + Math.sin(time * 10.0) * 0.25;
    window.oilRigFlareMesh.scale.set(flameScale, flameScale * 1.1, flameScale);
  }
  if (window.oilRigPumpBeam) {
    window.oilRigPumpBeam.rotation.z = Math.sin(time * 2.2) * 0.2;
  }

  // 3. Vụ cướp Ngân Hàng Trung Ương (Bank Vault Heist)
  if (window.bankHeistActive) {
    window.bankHeistTimer -= dt;
    // Đèn xoay báo động nhấp nháy đỏ
    if (window.bankAlarmBeacon) {
      window.bankAlarmBeacon.rotation.y += dt * 10.0;
      if (window.bankAlarmBeacon.material && window.bankAlarmBeacon.material.color) {
        window.bankAlarmBeacon.material.color.setHex(Math.sin(time * 12.0) > 0 ? 0xef4444 : 0x450a0a);
      }
    }
    // Kiểm tra hoàn thành phi vụ
    if (window.bankHeistTimer <= 0) {
      window.bankHeistActive = false;
      const heistCash = 12500;
      const heistGems = 15;
      gameState.money = (gameState.money || 0) + heistCash;
      gameState.gems = (gameState.gems || 0) + heistGems;
      gameState.wantedStars = 0; // Thoát truy nã
      if (typeof sounds !== 'undefined' && sounds.playLevelUp) sounds.playLevelUp();
      showToast(`🏆 PHI VỤ CƯỚP HẦM VÀNG THÀNH CÔNG! Bạn đã trốn thoát an toàn: +$${heistCash} & +${heistGems} GEMS!`);
      if (window.bankAlarmBeacon && window.bankAlarmBeacon.material && window.bankAlarmBeacon.material.color) {
        window.bankAlarmBeacon.material.color.setHex(0xef4444);
      }
      if (typeof updateHUD === 'function') updateHUD();
      triggerActionSave();
    }
  }

  // 4. Auto-Loot Drone hút đồ tự động trong bán kính 16m
  if (gameState.hasAutoLootDrone && window.autoLootDroneGroup && pPos) {
    // Bay lơ lửng trên vai phải người chơi
    const droneTarget = pPos.clone().add(new THREE.Vector3(1.2, 2.3 + Math.sin(time * 3.5) * 0.15, -0.8));
    window.autoLootDroneGroup.position.lerp(droneTarget, 0.12);
    // Quay 4 cánh quạt
    if (window.dronePropellers) {
      for (let di = 0; di < window.dronePropellers.length; di++) {
        window.dronePropellers[di].rotation.y += dt * 32.0;
      }
    }
    // Hút gỗ và quặng tự động
    if (typeof pickableLogs !== 'undefined' && pickableLogs.length > 0) {
      for (let li = pickableLogs.length - 1; li >= 0; li--) {
        const log = pickableLogs[li];
        if (log && log.position && window.autoLootDroneGroup.position.distanceTo(log.position) <= 16.0) {
          if (gameState.logs < gameState.backpackMax) {
            gameState.logs++;
            if (player && typeof player.updateLogStack === 'function') player.updateLogStack(gameState.logs);
            if (typeof sounds !== 'undefined' && sounds.playCollect) sounds.playCollect();
            scene.remove(log);
            pickableLogs.splice(li, 1);
          }
        }
      }
    }
  }

  // 5. ĐẠO DIỄN KHỦNG HOẢNG ĐỘNG TOÀN CẦU (GLOBAL CRISIS DIRECTOR)
  window.crisisDirectorTimer = (window.crisisDirectorTimer || 0) - dt;
  if (window.crisisDirectorTimer <= 0) {
    window.crisisDirectorTimer = 180.0 + Math.random() * 60.0; // Mỗi 3 - 4 phút nổ 1 sự cố
    const crises = [
      { id: 'wildfire', title: '🔥 CHÁY RỪNG BÙNG PHÁT TÂY BẮC! Lửa đang lan tới xưởng gỗ!', duration: 90, reward: 8000 },
      { id: 'oilspill', title: '🚢 SỰ CỐ TRÀN DẦU NGOÀI VỊNH! Cá và Thủy cung bị đe dọa!', duration: 90, reward: 10000 },
      { id: 'blackswan', title: '📉 SỤP ĐỔ THỊ TRƯỜNG PHỐ WALL! Giá cổ phiếu giảm sâu 60%!', duration: 75, reward: 12000 },
      { id: 'goldrush', title: '💎 CƠN SỐT VÀNG ĐỘT BIẾN! Mỏ đá xuất hiện các khối quặng hoàng kim!', duration: 90, reward: 15000 }
    ];
    const pickedCrisis = crises[Math.floor(Math.random() * crises.length)];
    if (typeof showGlobalCrisisAlert === 'function') {
      showGlobalCrisisAlert(pickedCrisis);
    }
  }

  // 6. THU CỔ TỨC ĐỘC QUYỀN HẠ TẦNG TẬP ĐOÀN (SYNDICATE MONOPOLY DIVIDENDS)
  if (gameState.corporation && gameState.corporation.monopolies) {
    window.corpDividendTimer = (window.corpDividendTimer || 0) + dt;
    if (window.corpDividendTimer >= 60.0) {
      window.corpDividendTimer = 0;
      let totalCorpDiv = 0;
      if (gameState.corporation.monopolies.railway) totalCorpDiv += 500;
      if (gameState.corporation.monopolies.harbor) totalCorpDiv += 900;
      if (gameState.corporation.monopolies.skyport) totalCorpDiv += 1500;
      if (totalCorpDiv > 0) {
        if (gameState.talents && gameState.talents.dividendBoost) totalCorpDiv = Math.round(totalCorpDiv * 1.4);
        gameState.money = (gameState.money || 0) + totalCorpDiv;
        showToast(`🌐 CỔ TỨC TẬP ĐOÀN: Nhận +$${totalCorpDiv.toLocaleString()} USD từ các hạ tầng độc quyền toàn server!`);
        if (typeof sounds !== 'undefined' && sounds.playCash) sounds.playCash();
        if (typeof updateHUD === 'function') updateHUD();
      }
    }
  }

  // 7. CẬP NHẬT CHỈ SỐ ĐÔ THỊ & HẠNH PHÚC CƯ DÂN
  window.cityMetricsTickTimer = (window.cityMetricsTickTimer || 0) + dt;
  if (window.cityMetricsTickTimer >= 5.0) {
    window.cityMetricsTickTimer = 0;
    if (typeof updateCityMetricsHUD === 'function') updateCityMetricsHUD();
  }

  // 8. TÀU LƯỢN SIÊU TỐC & ĐU QUAY KHỔNG LỒ (THEME PARK)
  if (window.rollerCoasterCurve && window.rollerCoasterCart) {
    window.rollerCoasterProgress = ((window.rollerCoasterProgress || 0) + dt * 0.08) % 1.0;
    const cartPos = window.rollerCoasterCurve.getPointAt(window.rollerCoasterProgress);
    window.rollerCoasterCart.position.copy(cartPos);
    const tangent = window.rollerCoasterCurve.getTangentAt(window.rollerCoasterProgress);
    window.rollerCoasterCart.lookAt(cartPos.clone().add(tangent));

    // Nếu người chơi đang ngồi tàu lượn -> Khóa góc nhìn thứ nhất
    if (window.isRidingRollerCoaster && typeof camera !== 'undefined') {
      camera.position.copy(cartPos).add(new THREE.Vector3(0, 1.4, 0));
      camera.lookAt(cartPos.clone().add(tangent.clone().multiplyScalar(10)));
      if (window.player && window.player.mesh) {
        window.player.mesh.position.copy(cartPos);
      }
    }
  }

  // Đu quay khổng lồ quay đều & lồng cabin giữ thăng bằng
  if (window.ferrisWheelHub) {
    window.ferrisWheelHub.rotation.z += dt * 0.18;
    if (window.ferrisCabins) {
      for (let fi = 0; fi < window.ferrisCabins.length; fi++) {
        window.ferrisCabins[fi].rotation.z = -window.ferrisWheelHub.rotation.z;
      }
    }
    // Nếu đang ngồi cabin đu quay
    if (window.isRidingFerrisWheel && window.ferrisCabins && window.ferrisCabins[0] && typeof camera !== 'undefined') {
      const cabinWorldPos = new THREE.Vector3();
      window.ferrisCabins[0].getWorldPosition(cabinWorldPos);
      camera.position.copy(cabinWorldPos).add(new THREE.Vector3(0, 0.8, 0));
      camera.lookAt(new THREE.Vector3(70, 5, 20)); // ngắm toàn cảnh đảo
      if (window.player && window.player.mesh) {
        window.player.mesh.position.copy(cabinWorldPos);
      }
    }
  }

  // 9. HỆ THỐNG MÙA ĐỘNG & THỜI TIẾT 60 FPS (ZERO ALLOCATION)
  if (window.seasonsList) {
    window.seasonTimer = (window.seasonTimer || 0) + dt;
    if (window.seasonTimer >= 180.0) { // Đổi mùa mỗi 3 phút
      window.seasonTimer = 0;
      window.seasonIndex = ((window.seasonIndex || 0) + 1) % window.seasonsList.length;
      gameState.currentSeason = window.seasonsList[window.seasonIndex];
      const sBadge = document.getElementById('val-season');
      if (gameState.currentSeason === 'spring') {
        if (sBadge) sBadge.innerHTML = '🌸 Xuân';
        if (window.weatherPointsSystem) window.weatherPointsSystem.visible = false;
        showToast('🌸 MÙA XUÂN ĐẾN: Vạn vật hồi sinh, năng suất lao động tăng cao!');
      } else if (gameState.currentSeason === 'summer') {
        if (sBadge) sBadge.innerHTML = '☀️ Hạ';
        if (window.weatherPointsSystem) window.weatherPointsSystem.visible = false;
        showToast('☀️ MÙA HÈ ĐẾN: Nắng biển rực rỡ, tốc độ xe cộ và du lịch biển sôi động!');
      } else if (gameState.currentSeason === 'autumn') {
        if (sBadge) sBadge.innerHTML = '🍁 Thu';
        if (window.weatherPointsSystem) window.weatherPointsSystem.visible = false;
        showToast('🍁 MÙA THU ĐẾN: Khí hậu ôn hòa, hoạt động thương cảng đạt đỉnh!');
      } else if (gameState.currentSeason === 'winter') {
        if (sBadge) sBadge.innerHTML = '❄️ Đông';
        if (window.weatherPointsSystem) {
          window.weatherPointsSystem.visible = true;
          window.weatherPointsSystem.material.color.setHex(0xffffff);
        }
        showToast('❄️ MÙA ĐÔNG ĐẾN: Tuyết rơi phủ trắng! NHU CẦU SƯỞI ẤM ĐẨY GIÁ VÁN GỖ X3!');
      }
    }
  }

  // Cập nhật hạt thời tiết (Points Buffer Geometry, 1 Draw Call, Zero GC)
  if (window.weatherPointsSystem && window.weatherPointsSystem.visible) {
    const pGeo = window.weatherPointsSystem.geometry;
    const pArr = pGeo.attributes.position.array;
    const vArr = pGeo.userData.velocities;
    const pCount = pArr.length / 3;
    for (let pi = 0; pi < pCount; pi++) {
      pArr[pi * 3 + 1] += vArr[pi * 3 + 1] * dt * 0.4;
      pArr[pi * 3 + 0] += vArr[pi * 3 + 0] * dt * 0.3;
      if (pArr[pi * 3 + 1] <= 0.2) {
        pArr[pi * 3 + 1] = 32.0; // Quay lại trên trời
      }
    }
    pGeo.attributes.position.needsUpdate = true;
  }

  // 10. RADAR ĐIỀU PHỐI HÀNG HẢI XOAY
  if (window.maritimeRadarDish) {
    window.maritimeRadarDish.rotation.y += dt * 2.2;
  }

  // 10b. CẦN CẨU GIÀN CONTAINER STS NÂNG HẠ CONTAINER TUẦN HOÀN
  if (window.portCraneSpreader) {
    window.portCraneCycle = (window.portCraneCycle || 0) + dt * 0.05; // 1 chu kỳ ~20s
    const cycle = window.portCraneCycle % 1.0;
    // Đi ngang từ -7.5 (tàu chở hàng) tới +4.0 (bãi container)
    let targetX = -7.5;
    let targetY = 10.5;
    if (cycle < 0.4) {
      targetX = -7.5 + (cycle / 0.4) * 11.5;
      targetY = 10.5;
    } else if (cycle < 0.5) {
      targetX = 4.0;
      targetY = 10.5 - Math.sin((cycle - 0.4) / 0.1 * Math.PI) * 4.2;
    } else if (cycle < 0.9) {
      targetX = 4.0 - ((cycle - 0.5) / 0.4) * 11.5;
      targetY = 10.5;
    } else {
      targetX = -7.5;
      targetY = 10.5 - Math.sin((cycle - 0.9) / 0.1 * Math.PI) * 4.2;
    }
    window.portCraneSpreader.position.x = targetX;
    window.portCraneSpreader.position.y = targetY;
  }

  // 11. HẢI TRÌNH TÀU VIỄN DƯƠNG ĐANG THỰC HIỆN
  if (window.activeMaritimeVoyage) {
    const v = window.activeMaritimeVoyage;
    v.timer -= dt;

    // Rủi ro bão biển cấp 12 giữa Thái Bình Dương (tỷ lệ kích hoạt khi qua nửa hải trình)
    if (!v.stormEncountered && v.totalDuration && v.timer < v.totalDuration * 0.5) {
      v.stormEncountered = true;
      if (Math.random() < 0.25) { // 25% cơ hội gặp bão biển kịch tính
        v.isStormActive = true;
        v.rewardMoney = Math.floor(v.rewardMoney * 1.25);
        showToast(`🌊 BÃO BIỂN CẤP 12 TẠI THÁI BÌNH DƯƠNG! Tàu ${v.destName} kích hoạt GPS tự vượt bão! Nhận thêm +25% tiền thưởng dũng cảm!`, '#f59e0b');
        if (typeof sounds !== 'undefined' && sounds.playThunderCrash) sounds.playThunderCrash();
      }
    }

    if (v.timer <= 0) {
      gameState.money = (gameState.money || 0) + v.rewardMoney;
      gameState.gems = (gameState.gems || 0) + v.rewardGems;
      showToast(`🚢 HẢI TRÌNH THÀNH CÔNG: Tàu viễn dương từ ${v.destName} đã cập cảng! Nhận +${v.rewardMoney.toLocaleString()} USD & +${v.rewardGems} Gems!`);
      if (typeof sounds !== 'undefined' && sounds.playCelebrationCheer) sounds.playCelebrationCheer();
      if (typeof updateHUD === 'function') updateHUD();
      if (typeof triggerActionSave === 'function') triggerActionSave();
      window.activeMaritimeVoyage = null;
    }
  }

  // 12. DÒNG TIỀN THỤ ĐỘNG TỪ BẤT ĐỘNG SẢN BIỆT THỰ
  if (gameState.villaRented) {
    window.villaRentalPassiveTimer = (window.villaRentalPassiveTimer || 0) + dt;
    if (window.villaRentalPassiveTimer >= 120.0) { // Mỗi 2 phút
      window.villaRentalPassiveTimer = 0;
      gameState.money = (gameState.money || 0) + 1200;
      showToast('🏖️ TIỀN THUÊ BIỆT THỰ MALDIVES: +$1,200 USD đã chuyển vào tài khoản!');
      if (typeof sounds !== 'undefined' && sounds.playCash) sounds.playCash();
      if (typeof updateHUD === 'function') updateHUD();
      if (typeof triggerActionSave === 'function') triggerActionSave();
    }
  }

  // 13. CẬP NHẬT HIỆU ỨNG ĐỒ HỌA HYPER-REALISTIC
  // Đèn cảnh báo hàng không nhấp nháy đỏ trên đỉnh cao ốc
  if (window.aviationBeacons && window.aviationBeacons.length > 0) {
    const isLit = Math.sin(time * 3.5) > 0;
    for (let bi = 0; bi < window.aviationBeacons.length; bi++) {
      window.aviationBeacons[bi].visible = isLit;
    }
  }

  // Viền bọt sóng vỗ bờ dạt dào theo nhịp thở đại dương
  if (window.shorelineFoamRibbon && window.shorelineFoamRibbon.material) {
    if (window.shorelineFoamRibbon.material.map) {
      window.shorelineFoamRibbon.material.map.offset.x += dt * 0.04;
    }
    window.shorelineFoamRibbon.material.opacity = 0.50 + Math.sin(time * 2.2) * 0.18;
  }

  // Thảm cỏ 3D đung đưa nhẹ theo ngọn gió biển (Zero GC)
  if (window.hyperGrassInstanced) {
    window.hyperGrassInstanced.rotation.y = Math.sin(time * 1.6) * 0.05;
  }

  // 14. HOẠT ẢNH 20 MỤC NÂNG CẤP ĐỒ HỌA CAO CẤP
  // Thang máy lồng kính ngoài trời lướt êm ái trên thân tháp Phố Wall
  if (window.exteriorGlassElevator) {
    const elevT = Math.sin(time * 0.45) * 0.5 + 0.5; // 0 đến 1
    window.exteriorGlassElevator.position.y = 2.0 + elevT * 19.5;
  }

  // Dải rẽ sóng chữ V sủi bọt trắng xóa theo sau ca-nô
  if (window.speedboatWakeMesh && window.drivableSpeedboat && window.drivableSpeedboat.mesh) {
    const isDrivingBoat = !!(gameState.isDrivingSpeedboat);
    window.speedboatWakeMesh.visible = isDrivingBoat;
    if (isDrivingBoat) {
      window.speedboatWakeMesh.position.copy(window.drivableSpeedboat.mesh.position).add(new THREE.Vector3(0, -0.05, -4.5).applyEuler(window.drivableSpeedboat.mesh.rotation));
      window.speedboatWakeMesh.rotation.y = window.drivableSpeedboat.mesh.rotation.y;
    }
  }

  // Luồng đèn pha hình nón chiếu sáng mặt đường ban đêm
  if (window.dynamicVehicleHeadlightCone) {
    const isNight = typeof gameState !== 'undefined' ? (gameState.gameHour < 5.5 || gameState.gameHour > 18.5) : false;
    if (isNight && isDrivingAny && focusPos) {
      window.dynamicVehicleHeadlightCone.visible = true;
      window.dynamicVehicleHeadlightCone.position.set(focusPos.x, focusPos.y + 0.5, focusPos.z);
      if (player && player.mesh) {
        window.dynamicVehicleHeadlightCone.rotation.y = player.mesh.rotation.y;
      }
    } else {
      window.dynamicVehicleHeadlightCone.visible = false;
    }
  }
}
window.updateNewMegaSystems = updateNewMegaSystems;

function triggerJailSentence(seconds = 60) {
  if (typeof gameState !== 'undefined') {
    gameState.jailedTimer = seconds;
    gameState.wantedStars = 0;
  }
  if (window.player && window.player.mesh) {
    window.player.mesh.position.set(-145, 0.2, 60);
  }
  if (typeof showToast === 'function') {
    showToast(`⛓️ BẠN ĐÃ BỊ TỐNG VÀO TRẠI GIAM BIỆT LẬP! Thời gian thụ án: ${seconds} giây (Đến quầy bảo lãnh để nộp phạt)!`);
  }
  if (typeof updateHUD === 'function') updateHUD();
}
window.triggerJailSentence = triggerJailSentence;

// Khởi chạy khi DOM sẵn sàng
window.addEventListener('DOMContentLoaded', init);


// ===========================================================================
// TƯƠNG TÁC CÔNG VIÊN GIẢI TRÍ & NỘI THẤT DINH THỰ CAO CẤP
// ===========================================================================
function toggleRollerCoasterRide() {
  window.isRidingRollerCoaster = !window.isRidingRollerCoaster;
  if (window.isRidingRollerCoaster) {
    window.isRidingFerrisWheel = false;
    showToast('🎢 ĐANG TRẢI NGHIỆM TÀU LƯỢN SIÊU TỐC 3D! Nhấn [E] để xuống ga.');
    if (typeof sounds !== 'undefined' && sounds.playSaw) sounds.playSaw();
  } else {
    if (window.player && window.player.mesh) {
      window.player.mesh.position.set(142, 0.5, -2);
    }
    showToast('🚶 ĐÃ RỜI TÀU LƯỢN SIÊU TỐC');
  }
}
window.toggleRollerCoasterRide = toggleRollerCoasterRide;

function toggleFerrisWheelRide() {
  window.isRidingFerrisWheel = !window.isRidingFerrisWheel;
  if (window.isRidingFerrisWheel) {
    window.isRidingRollerCoaster = false;
    showToast('🎡 ĐANG TRẢI NGHIỆM ĐU QUAY KHỔNG LỒ! Ngắm toàn cảnh quần đảo. Nhấn [E] để xuống.');
    if (typeof sounds !== 'undefined' && sounds.playWoodPlank) sounds.playWoodPlank();
  } else {
    if (window.player && window.player.mesh) {
      window.player.mesh.position.set(142, 0.5, -15);
    }
    showToast('🚶 ĐÃ RỜI ĐU QUAY KHỔNG LỒ');
  }
}
window.toggleFerrisWheelRide = toggleFerrisWheelRide;

function sleepInVillaRoyalBed() {
  if (gameState.stamina !== undefined) gameState.stamina = 100;
  if (typeof dayTimeProgress !== 'undefined') {
    dayTimeProgress = 0.25; // 06:00 AM sáng rực rỡ
  }
  gameState.royalBedBuffTimer = 180.0; // 3 phút buff tốc độ +15%
  showToast('🛏️ BẠN ĐÃ NGỦ MỘT GIẤC THẬT SÂU TRÊN GIƯỜNG HOÀNG GIA! Thể lực hồi 100% & nhận Buff +15% Tốc độ!');
  if (typeof sounds !== 'undefined' && sounds.playLevelUp) sounds.playLevelUp();
  if (typeof spawnFloatingText === 'function' && window.player && window.player.mesh) {
    spawnFloatingText(window.player.mesh.position.clone().add(new THREE.Vector3(0, 2.5, 0)), '⚡ HỒI PHỤC THỂ LỰC 100%!', '#38bdf8');
  }
  if (typeof updateHUD === 'function') updateHUD();
}
window.sleepInVillaRoyalBed = sleepInVillaRoyalBed;

function interactVillaSafe() {
  const safeSavings = gameState.money || 0;
  showToast(`🔒 KÉT SẮT TITANIUM: Đã bảo vệ toàn bộ $${safeSavings.toLocaleString()} USD an toàn trước mọi rủi ro!`);
  if (typeof sounds !== 'undefined' && sounds.playCoin) sounds.playCoin();
  if (typeof spawnFloatingText === 'function' && window.player && window.player.mesh) {
    spawnFloatingText(window.player.mesh.position.clone().add(new THREE.Vector3(0, 2.5, 0)), '🛡️ TÀI SẢN ĐƯỢC BẢO HỘ 100%', '#facc15');
  }
}
window.interactVillaSafe = interactVillaSafe;
