
// ===========================================================================
// HỆ THỐNG MẶT PHẲNG VẬT LÝ & TÒA NHÀ CAO TẦNG ĐÔ THỊ (SOLID BUILDING COLLIDERS)
// Cho phép Trực thăng hạ cánh trên nóc nhà, cản va chạm tường kính và đỗ xe
// ===========================================================================
window.CITY_BUILDING_COLLIDERS = [
  { name: 'StockExchange', minX: -23, maxX: -7, minZ: 50, maxZ: 66, height: 22.5 },
  { name: 'CentralBank', minX: 7, maxX: 23, minZ: 50, maxZ: 66, height: 16.0 },
  { name: 'CityHall', minX: -12, maxX: 12, minZ: 50, maxZ: 66, height: 15.0 },
  { name: 'HospitalHelipad', minX: 45, maxX: 65, minZ: 50, maxZ: 66, height: 16.5 },
  { name: 'PoliceHQ', minX: -64, maxX: -46, minZ: 50, maxZ: 66, height: 13.0 },
  { name: 'SkyPenthouse', minX: 79, maxX: 101, minZ: 49, maxZ: 67, height: 24.5 },
  { name: 'SkyportTerminal', minX: -104, maxX: -76, minZ: 30, maxZ: 50, height: 10.0 },
  { name: 'Sawmill', minX: -10, maxX: 10, minZ: -25, maxZ: -11, height: 8.0 },
  { name: 'CraftingPlant', minX: 26, maxX: 44, minZ: -25, maxZ: -11, height: 7.5 },
  { name: 'Substation', minX: -38, maxX: -22, minZ: -25, maxZ: -11, height: 7.0 },
  { name: 'ThemeParkStation', minX: 134, maxX: 150, minZ: -7, maxZ: 7, height: 5.0 },
  { name: 'LuxuryVilla', minX: 90, maxX: 110, minZ: 47, maxZ: 65, height: 7.0 }
];

function getBuildingRoofHeightAt(x, z) {
  if (!window.CITY_BUILDING_COLLIDERS) return 0.0;
  for (let i = 0; i < window.CITY_BUILDING_COLLIDERS.length; i++) {
    const b = window.CITY_BUILDING_COLLIDERS[i];
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
      return b.height;
    }
  }
  return 0.0;
}
window.getBuildingRoofHeightAt = getBuildingRoofHeightAt;

/**
 * Automated Vehicles, Supply Chain Workers & Truck Logistics Fleet
 * - Lumberjack: Fells pine trees in forest
 * - Log Carrier: Physically hauls logs from forest to Sawmill Intake Buffer
 * - Saw Operator: Stands at industrial control console pulling levers
 * - Plank Stacker: Bốc xếp ván thành phẩm từ máy lên sàn xe tải
 * - Forklift: Xe nâng tự động chở pallet ván
 * - Truck Fleet Queue: Đoàn 3 xe tải xếp hàng nhận đơn xuất khẩu có tài xế thật, bóp còi & phụt khói
 * - Instanced Wildlife Boids: Cá sông & Chim sẻ 60 FPS
 */

// Tối ưu hóa bộ nhớ: Tái sử dụng Vector3 tĩnh, loại bỏ rác bộ nhớ (Zero Garbage Collection)
const _sharedVec1 = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
const _sharedVec2 = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;

// ---------------------------------------------------------------------------
// 0. HỆ THỐNG MÔ HÌNH NHÂN VẬT NGƯỜI CHÂN THỰC (ANATOMICAL STYLIZED HUMANOID)
// Khớp háng, đầu gối, bắp chân, giày bốt, thân mình cơ bắp, thắt lưng, cổ, mặt, mắt, mũi, tai, tóc, nón & cánh tay 2 phân đoạn
// ---------------------------------------------------------------------------
function buildStylizedWorkerFigure(group, options = {}) {
  const shirtColor = options.shirtColor || 0x16a34a;
  const vestColor = options.vestColor || 0xf97316;
  const pantsColor = options.pantsColor || 0x1e3a8a;
  const headwearType = options.headwearType || 'hardhat';
  const headwearColor = options.headwearColor || 0xfacc15;
  const skinColor = options.skinColor || 0xffd8b8;

  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.65 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x271910, roughness: 0.85 });
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const browMat = new THREE.MeshBasicMaterial({ color: 0x271910 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
  const vestMat = new THREE.MeshStandardMaterial({ color: vestColor, roughness: 0.7 });
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.7 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.25 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75 });
  const bootLeatherMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.8 });
  const bootSoleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95 });

  // 1. Thân người (Torso Group)
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.78, 0);
  group.add(torsoGroup);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.55, 0.46), shirtMat);
  chest.position.y = 0.55;
  chest.castShadow = true;
  torsoGroup.add(chest);

  if (vestColor) {
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.48, 0.48), vestMat);
    vest.position.y = 0.55;
    torsoGroup.add(vest);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.2 }));
    stripe.position.y = 0.52;
    torsoGroup.add(stripe);
  }

  const abdomen = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.35, 0.4), shirtMat);
  abdomen.position.y = 0.22;
  abdomen.castShadow = true;
  torsoGroup.add(abdomen);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.12, 0.44), beltMat);
  belt.position.y = 0.06;
  torsoGroup.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.05), brassMat);
  buckle.position.set(0, 0.06, 0.23);
  torsoGroup.add(buckle);

  // 2. Đầu, cổ & Khuôn mặt
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.2, 8), skinMat);
  neck.position.y = 0.88;
  torsoGroup.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.18, 0);
  torsoGroup.add(headGroup);

  const cranium = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.48), skinMat);
  cranium.castShadow = true;
  headGroup.add(cranium);

  const workerEyes = [];
  [-0.12, 0.12].forEach(ex => {
    const eyePivot = new THREE.Group();
    eyePivot.position.set(ex, 0.06, 0.245);
    headGroup.add(eyePivot);
    workerEyes.push(eyePivot);

    const ew = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.02), eyeWhiteMat);
    eyePivot.add(ew);

    const ep = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), pupilMat);
    ep.position.set(0, 0, 0.013);
    eyePivot.add(ep);

    const eb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.02), browMat);
    eb.position.set(ex, 0.11, 0.25);
    eb.rotation.z = ex > 0 ? -0.1 : 0.1;
    headGroup.add(eb);
  });

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), skinMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.01, 0.26);
  headGroup.add(nose);

  [-0.26, 0.26].forEach(ex => {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.08), skinMat);
    ear.position.set(ex, 0.02, -0.02);
    headGroup.add(ear);
  });

  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.24, 0.28), hairMat);
  hair.position.set(0, 0.08, -0.14);
  headGroup.add(hair);

  if (headwearType === 'hardhat') {
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.6), new THREE.MeshStandardMaterial({ color: headwearColor, roughness: 0.35 }));
    helmet.position.set(0, 0.24, 0);
    headGroup.add(helmet);

    // Dải decal phản quang an toàn trên nón bảo hộ
    const helmetStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.64, 0.05, 0.62),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.2, metalness: 0.8 })
    );
    helmetStripe.position.set(0, 0.26, 0);
    headGroup.add(helmetStripe);

    // Tai nghe chống ồn bảo hộ lao động 2 bên (Safety Earmuffs)
    [-0.32, 0.32].forEach(mx => {
      const muff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.09, 8),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 })
      );
      muff.rotateZ(Math.PI / 2);
      muff.position.set(mx, 0.12, -0.02);
      headGroup.add(muff);
    });

    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.64), new THREE.MeshStandardMaterial({ color: headwearColor, roughness: 0.35 }));
    brim.position.set(0, 0.16, 0.04);
    headGroup.add(brim);
  } else {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.2, 0.54), new THREE.MeshStandardMaterial({ color: headwearColor }));
    cap.position.set(0, 0.22, 0);
    headGroup.add(cap);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.04, 0.28), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    visor.position.set(0, 0.14, 0.34);
    visor.rotation.x = 0.15;
    headGroup.add(visor);
  }

  // 3. Tay 2 phân đoạn (Shoulder -> Elbow -> Hand)
  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-0.5, 0.7, 0);
  torsoGroup.add(leftShoulder);
  const leftUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.34, 8), shirtMat);
  leftUpperArm.position.y = -0.17;
  leftShoulder.add(leftUpperArm);
  const leftElbow = new THREE.Group();
  leftElbow.position.set(0, -0.32, 0);
  leftShoulder.add(leftElbow);
  const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.32, 8), skinMat);
  leftForearm.position.y = -0.15;
  leftElbow.add(leftForearm);
  const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.14), gloveMat);
  leftHand.position.set(0, -0.32, 0);
  leftElbow.add(leftHand);

  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(0.5, 0.7, 0);
  torsoGroup.add(rightShoulder);
  const rightUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.34, 8), shirtMat);
  rightUpperArm.position.y = -0.17;
  rightShoulder.add(rightUpperArm);
  const rightElbow = new THREE.Group();
  rightElbow.position.set(0, -0.32, 0);
  rightShoulder.add(rightElbow);
  const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.32, 8), skinMat);
  rightForearm.position.y = -0.15;
  rightElbow.add(rightForearm);
  const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.14), gloveMat);
  rightHand.position.set(0, -0.32, 0);
  rightElbow.add(rightHand);

  // 4. Chân 2 phân đoạn (Hip -> Knee -> Lug Boot)
  const leftHip = new THREE.Group();
  leftHip.position.set(-0.21, 0.74, 0);
  group.add(leftHip);
  const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.4, 8), pantsMat);
  leftThigh.position.y = -0.2;
  leftHip.add(leftThigh);
  const leftKnee = new THREE.Group();
  leftKnee.position.set(0, -0.38, 0);
  leftHip.add(leftKnee);
  const leftShin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.38, 8), pantsMat);
  leftShin.position.y = -0.17;
  leftKnee.add(leftShin);
  const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.32), bootLeatherMat);
  leftBoot.position.set(0, -0.3, 0.04);
  leftKnee.add(leftBoot);
  const leftSole = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.38), bootSoleMat);
  leftSole.position.set(0, -0.38, 0.05);
  leftKnee.add(leftSole);

  const rightHip = new THREE.Group();
  rightHip.position.set(0.21, 0.74, 0);
  group.add(rightHip);
  const rightThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.4, 8), pantsMat);
  rightThigh.position.y = -0.2;
  rightHip.add(rightThigh);
  const rightKnee = new THREE.Group();
  rightKnee.position.set(0, -0.38, 0);
  rightHip.add(rightKnee);
  const rightShin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.38, 8), pantsMat);
  rightShin.position.y = -0.17;
  rightKnee.add(rightShin);
  const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.32), bootLeatherMat);
  rightBoot.position.set(0, -0.3, 0.04);
  rightKnee.add(rightBoot);
  const rightSole = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.38), bootSoleMat);
  rightSole.position.set(0, -0.38, 0.05);
  rightKnee.add(rightSole);

  const blobShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 12),
    new THREE.MeshBasicMaterial({ map: Textures.contactShadow(), transparent: true, opacity: 0.65, depthWrite: false })
  );
  blobShadow.rotateX(-Math.PI / 2);
  blobShadow.position.y = 0.02;
  group.add(blobShadow);

  return {
    torsoGroup,
    headGroup,
    eyes: workerEyes,
    leftShoulder,
    leftElbow,
    leftHand,
    rightShoulder,
    rightElbow,
    rightHand,
    leftHip,
    leftKnee,
    rightHip,
    rightKnee
  };
}

// ---------------------------------------------------------------------------
// 1. THỢ ĐỐN CỦI TỰ ĐỘNG (LUMBERJACK WORKER)
// ---------------------------------------------------------------------------
class LumberjackAgent {
  constructor(scene, id = 0) {
    this.id = id;
    this.state = 'SCAN'; // SCAN, MOVE, CHOP, HAUL, IDLE
    this.speed = 4.6;
    this.targetTree = null;
    this.chopTimer = 0;
    this.logsCarried = 0;
    this.scene = scene;
    this.animTimer = Math.random() * 10;

    this.mesh = new THREE.Group();
    this.mesh.position.set(-36 + id * 2.2, 0, -18 + (id % 2) * 2);
    scene.add(this.mesh);

    // Xây dựng cơ thể con người hoàn chỉnh
    this.fig = buildStylizedWorkerFigure(this.mesh, {
      shirtColor: 0x16a34a, // Xanh lá cây thợ rừng
      vestColor: 0xf97316,  // Áo ghi-lê bảo hộ cam
      pantsColor: 0x1e3a8a, // Quần jeans xanh
      headwearType: 'hardhat',
      headwearColor: 0xfacc15 // Mũ bảo hộ vàng công trường
    });

    // Rìu đốn củi cầm chắc trên tay phải
    const axeHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.04, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 })
    );
    axeHandle.rotation.x = Math.PI / 2.8;
    axeHandle.position.set(0, -0.2, 0.3);
    this.fig.rightHand.add(axeHandle);

    const axeBlade = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.32, 0.38),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.2 })
    );
    axeBlade.position.set(0, -0.1, 0.65);
    this.fig.rightHand.add(axeBlade);

    // Khúc gỗ vác trước ngực khi gùi về xưởng
    this.carriedLogsMesh = new THREE.Group();
    this.carriedLogsMesh.position.set(0, 0.45, 0.38);
    this.carriedLogsMesh.visible = false;
    this.fig.torsoGroup.add(this.carriedLogsMesh);

    for (let i = 0; i < 2; i++) {
      const l = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.9, 8),
        new THREE.MeshStandardMaterial({ map: Textures.bark() })
      );
      l.rotateZ(Math.PI / 2);
      l.position.set(0, i * 0.25, 0);
      this.carriedLogsMesh.add(l);
    }

    // Bảng tên 3D trên đầu thợ đốn củi
    const nameTag = makeBillboardText('🌲 Thợ Đốn Củi #' + (id + 1), '#4ade80', 210, 32);
    nameTag.position.set(0, 2.75, 0);
    this.mesh.add(nameTag);
  }

  update(dt, playerPos) {
    const isNear = !playerPos || this.mesh.position.distanceTo(playerPos) < 42.0;

    if (this.state === 'SCAN') {
      let nearest = null, minDist = 999;
      for (const t of trees) {
        if (t.visible && t.userData.growthStage === 3) {
          const d = this.mesh.position.distanceTo(t.position);
          if (d < minDist) { minDist = d; nearest = t; }
        }
      }
      if (nearest) {
        this.targetTree = nearest;
        this.state = 'MOVE';
      } else {
        this.state = 'IDLE';
      }
    } else if (this.state === 'MOVE') {
      if (!this.targetTree || !this.targetTree.visible) {
        this.state = 'SCAN';
        return;
      }
      const dist = this.mesh.position.distanceTo(this.targetTree.position);
      if (dist > 1.8) {
        const dir = _sharedVec1 ? _sharedVec1.subVectors(this.targetTree.position, this.mesh.position).normalize() : new THREE.Vector3().subVectors(this.targetTree.position, this.mesh.position).normalize();
        this.mesh.position.addScaledVector(dir, this.speed * dt);
        this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

        if (isNear) {
          // Hoạt ảnh bước chân người
          this.animTimer += dt * 12;
          const c = Math.sin(this.animTimer);
          this.fig.leftHip.rotation.x = c * 0.55;
          this.fig.rightHip.rotation.x = -c * 0.55;
          this.fig.leftKnee.rotation.x = Math.max(0, -c) * 0.75;
          this.fig.rightKnee.rotation.x = Math.max(0, c) * 0.75;
          this.fig.leftShoulder.rotation.x = -c * 0.45;
          this.fig.rightShoulder.rotation.x = c * 0.4;
          this.fig.torsoGroup.position.y = 0.78 + Math.abs(Math.cos(this.animTimer)) * 0.04;
        }
      } else {
        this.state = 'CHOP';
        this.chopTimer = 0;
      }
    } else if (this.state === 'CHOP') {
      if (!this.targetTree || !this.targetTree.visible) {
        this.state = 'SCAN';
        return;
      }
      this.chopTimer += dt;

      if (isNear) {
        const chopPhase = Math.sin(this.chopTimer * 6.5);
        // Cả 2 tay vung rìu đốn củi với lực toàn thân
        this.fig.rightShoulder.rotation.x = -0.3 - chopPhase * 1.5;
        this.fig.rightElbow.rotation.x = -0.2 - chopPhase * 0.4;
        this.fig.leftShoulder.rotation.x = -0.2 - chopPhase * 1.2;
        this.fig.torsoGroup.rotation.x = -chopPhase * 0.2;
        this.fig.leftKnee.rotation.x = chopPhase * 0.2;
        this.fig.rightKnee.rotation.x = chopPhase * 0.2;
      }

      if (this.chopTimer >= 0.9) {
        this.chopTimer = 0;
        this.targetTree.userData.hp -= 40;
        if (isNear) sounds.playChop();
        if (this.targetTree.userData.hp <= 0) {
          this.targetTree.visible = false;
          if (isNear) sounds.playTreeFall();
          spawnPickableLog(this.targetTree.position, this.scene);
          spawnPickableLog(this.targetTree.position, this.scene);
          gameState.totalLogsCut += 2;
          this.logsCarried = 2;
          this.carriedLogsMesh.visible = true;
          this.state = 'HAUL';
          if (isNear) {
            this.fig.rightShoulder.rotation.x = 0;
            this.fig.leftShoulder.rotation.x = 0;
            this.fig.torsoGroup.rotation.x = 0;
          }
        }
      }
    } else if (this.state === 'HAUL') {
      // Vác gỗ tới Bãi đệm nạp của máy cưa: { x: -6.0, z: -18 }
      const dropPos = _sharedVec2 ? _sharedVec2.set(-6.0, 0, -18) : new THREE.Vector3(-6.0, 0, -18);
      const dist = this.mesh.position.distanceTo(dropPos);
      if (dist > 1.5) {
        const dir = _sharedVec1 ? _sharedVec1.subVectors(dropPos, this.mesh.position).normalize() : new THREE.Vector3().subVectors(dropPos, this.mesh.position).normalize();
        this.mesh.position.addScaledVector(dir, this.speed * dt);
        this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

        if (isNear) {
          // Hoạt ảnh gùi vác gỗ bước đi
          this.animTimer += dt * 11;
          const c = Math.sin(this.animTimer);
          this.fig.leftHip.rotation.x = c * 0.5;
          this.fig.rightHip.rotation.x = -c * 0.5;
          this.fig.leftKnee.rotation.x = Math.max(0, -c) * 0.7;
          this.fig.rightKnee.rotation.x = Math.max(0, c) * 0.7;
          // Hai tay ôm giữ gỗ trước ngực
          this.fig.leftShoulder.rotation.x = -0.6;
          this.fig.leftElbow.rotation.x = -0.5;
          this.fig.rightShoulder.rotation.x = -0.6;
          this.fig.rightElbow.rotation.x = -0.5;
          this.fig.torsoGroup.position.y = 0.78 + Math.abs(Math.cos(this.animTimer)) * 0.04;
        }
      } else {
        const maxB = gameState.maxMachineBuffer || 30;
        const curB = gameState.machineLogBuffer || 0;
        const toAdd = Math.min(this.logsCarried, maxB - curB);
        gameState.machineLogBuffer = curB + toAdd;
        if (isNear) {
          sounds.playCollect();
          spawnFloatingText(dropPos, `+${toAdd} Gỗ vào bãi đệm 🪵`, '#38bdf8');
        }
        this.logsCarried = 0;
        this.carriedLogsMesh.visible = false;
        updateHUD();
        this.state = 'SCAN';
      }
    } else if (this.state === 'IDLE') {
      this.chopTimer += dt;
      if (isNear) {
        // Thở nhẹ khi đứng đợi cây mọc
        const breath = Math.sin(this.chopTimer * 2.2);
        this.fig.torsoGroup.position.y = 0.78 + breath * 0.015;
        this.fig.leftHip.rotation.x = 0;
        this.fig.rightHip.rotation.x = 0;
        this.fig.leftKnee.rotation.x = 0;
        this.fig.rightKnee.rotation.x = 0;
        this.fig.headGroup.rotation.y = Math.sin(this.chopTimer * 0.8) * 0.15;
      }
      if (this.chopTimer >= 2.5) {
        this.chopTimer = 0;
        this.state = 'SCAN';
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 2. CÔNG NHÂN KHIÊNG GỖ THỦ CÔNG (LOG CARRIER AGENT)
// Chuyên gom gỗ rơi trong rừng mang về nạp vào máy cưa
// ---------------------------------------------------------------------------
class LogCarrierAgent {
  constructor(scene) {
    this.scene = scene;
    this.speed = 4.4;
    this.state = 'SEARCH'; // SEARCH, PICKUP, DELIVER
    this.carriedLogs = 0;
    this.targetLog = null;
    this.animTimer = Math.random() * 10;

    this.mesh = new THREE.Group();
    this.mesh.position.set(-28, 0, -18);
    scene.add(this.mesh);

    // Mô hình nhân vật người khiêng gỗ hoàn chỉnh
    this.fig = buildStylizedWorkerFigure(this.mesh, {
      shirtColor: 0x1d4ed8, // Áo xanh dương thợ máy
      vestColor: 0x22c55e,  // Ghi-lê xanh lá bảo hộ
      pantsColor: 0x1e293b, // Quần kaki đen
      headwearType: 'cap',
      headwearColor: 0x0f172a // Mũ lưỡi trai xám đậm
    });

    // Bó gỗ khiêng trước ngực bằng 2 tay
    this.bundleMesh = new THREE.Group();
    this.bundleMesh.position.set(0, 0.45, 0.42);
    this.bundleMesh.visible = false;
    this.fig.torsoGroup.add(this.bundleMesh);

    for (let i = 0; i < 2; i++) {
      const l = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 1.1, 8),
        new THREE.MeshStandardMaterial({ map: Textures.bark() })
      );
      l.rotateZ(Math.PI / 2);
      l.position.set(0, i * 0.26, 0);
      this.bundleMesh.add(l);
    }

    const nameTag = makeBillboardText('🪵 Thợ Khiêng Gỗ', '#38bdf8', 190, 32);
    nameTag.position.set(0, 2.75, 0);
    this.mesh.add(nameTag);
  }

  update(dt, playerPos) {
    const isNear = !playerPos || this.mesh.position.distanceTo(playerPos) < 42.0;

    if (this.state === 'SEARCH') {
      if (pickableLogs && pickableLogs.length > 0) {
        this.targetLog = pickableLogs[0];
        this.state = 'PICKUP';
      } else {
        // Tuần tra nhẹ quanh bìa rừng
        const patrolPos = _sharedVec2 ? _sharedVec2.set(-24, 0, -22) : new THREE.Vector3(-24, 0, -22);
        if (this.mesh.position.distanceTo(patrolPos) > 1.0) {
          const dir = _sharedVec1 ? _sharedVec1.subVectors(patrolPos, this.mesh.position).normalize() : new THREE.Vector3().subVectors(patrolPos, this.mesh.position).normalize();
          this.mesh.position.addScaledVector(dir, this.speed * 0.6 * dt);
          this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

          if (isNear) {
            this.animTimer += dt * 8;
            const c = Math.sin(this.animTimer);
            this.fig.leftHip.rotation.x = c * 0.45;
            this.fig.rightHip.rotation.x = -c * 0.45;
            this.fig.leftKnee.rotation.x = Math.max(0, -c) * 0.6;
            this.fig.rightKnee.rotation.x = Math.max(0, c) * 0.6;
            this.fig.leftShoulder.rotation.x = -c * 0.35;
            this.fig.rightShoulder.rotation.x = c * 0.35;
            this.fig.torsoGroup.position.y = 0.78 + Math.abs(Math.cos(this.animTimer)) * 0.03;
          }
        } else if (isNear) {
          this.fig.leftHip.rotation.x = 0;
          this.fig.rightHip.rotation.x = 0;
          this.fig.leftKnee.rotation.x = 0;
          this.fig.rightKnee.rotation.x = 0;
        }
      }
    } else if (this.state === 'PICKUP') {
      if (!this.targetLog || !this.targetLog.parent) {
        this.state = 'SEARCH';
        return;
      }
      const dist = this.mesh.position.distanceTo(this.targetLog.position);
      if (dist > 1.2) {
        const dir = _sharedVec1 ? _sharedVec1.subVectors(this.targetLog.position, this.mesh.position).normalize() : new THREE.Vector3().subVectors(this.targetLog.position, this.mesh.position).normalize();
        this.mesh.position.addScaledVector(dir, this.speed * dt);
        this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

        if (isNear) {
          this.animTimer += dt * 12;
          const c = Math.sin(this.animTimer);
          this.fig.leftHip.rotation.x = c * 0.55;
          this.fig.rightHip.rotation.x = -c * 0.55;
          this.fig.leftKnee.rotation.x = Math.max(0, -c) * 0.75;
          this.fig.rightKnee.rotation.x = Math.max(0, c) * 0.75;
          this.fig.leftShoulder.rotation.x = -c * 0.45;
          this.fig.rightShoulder.rotation.x = c * 0.45;
          this.fig.torsoGroup.position.y = 0.78 + Math.abs(Math.cos(this.animTimer)) * 0.04;
        }
      } else {
        // Nhặt khúc gỗ
        const idx = pickableLogs.indexOf(this.targetLog);
        if (idx > -1) {
          this.scene.remove(this.targetLog);
          pickableLogs.splice(idx, 1);
        }
        this.carriedLogs = 2;
        this.bundleMesh.visible = true;
        if (isNear) sounds.playCollect();
        this.state = 'DELIVER';
      }
    } else if (this.state === 'DELIVER') {
      const infeedPos = _sharedVec2 ? _sharedVec2.set(-6.0, 0, -18) : new THREE.Vector3(-6.0, 0, -18);
      const dist = this.mesh.position.distanceTo(infeedPos);
      if (dist > 1.4) {
        const dir = _sharedVec1 ? _sharedVec1.subVectors(infeedPos, this.mesh.position).normalize() : new THREE.Vector3().subVectors(infeedPos, this.mesh.position).normalize();
        this.mesh.position.addScaledVector(dir, this.speed * dt);
        this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

        if (isNear) {
          this.animTimer += dt * 11;
          const c = Math.sin(this.animTimer);
          this.fig.leftHip.rotation.x = c * 0.5;
          this.fig.rightHip.rotation.x = -c * 0.5;
          this.fig.leftKnee.rotation.x = Math.max(0, -c) * 0.7;
          this.fig.rightKnee.rotation.x = Math.max(0, c) * 0.7;
          // Hai tay ôm chặt bó gỗ trước ngực
          this.fig.leftShoulder.rotation.x = -0.65;
          this.fig.leftElbow.rotation.x = -0.55;
          this.fig.rightShoulder.rotation.x = -0.65;
          this.fig.rightElbow.rotation.x = -0.55;
          this.fig.torsoGroup.position.y = 0.78 + Math.abs(Math.cos(this.animTimer)) * 0.04;
        }
      } else {
        const maxB = gameState.maxMachineBuffer || 30;
        gameState.machineLogBuffer = Math.min((gameState.machineLogBuffer || 0) + this.carriedLogs, maxB);
        if (isNear) {
          sounds.playCollect();
          spawnFloatingText(infeedPos, `+${this.carriedLogs} Gỗ công nhân khiêng 🪵`, '#38bdf8');
        }
        this.carriedLogs = 0;
        this.bundleMesh.visible = false;
        if (isNear) {
          this.fig.leftShoulder.rotation.x = 0;
          this.fig.leftElbow.rotation.x = 0;
          this.fig.rightShoulder.rotation.x = 0;
        }
        this.fig.rightElbow.rotation.x = 0;
        updateHUD();
        this.state = 'SEARCH';
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 3. THỢ VẬN HÀNH BẢNG ĐIỀU KHIỂN MÁY CƯA (SAW OPERATOR AGENT)
// ---------------------------------------------------------------------------
class SawOperatorAgent {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.set(-1.8, 0, -16.2);
    this.mesh.rotation.y = Math.PI; // Hướng mặt về phía buồng cắt và bảng điều khiển
    scene.add(this.mesh);

    // Kỹ sư điều khiển máy cưa hoàn chỉnh
    this.fig = buildStylizedWorkerFigure(this.mesh, {
      shirtColor: 0x334155, // Áo kỹ sư xám
      vestColor: 0xeab308,  // Áo ghi-lê phản quang vàng
      pantsColor: 0x1e293b,
      headwearType: 'hardhat',
      headwearColor: 0xffffff // Mũ bảo hộ trắng kỹ sư trưởng
    });

    // Tai nghe chống ồn công nghiệp (Industrial Ear Muffs)
    [-0.28, 0.28].forEach(mx => {
      const muff = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 8), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
      muff.rotation.z = Math.PI / 2;
      muff.position.set(mx, 0.02, -0.02);
      this.fig.headGroup.add(muff);
    });
    const muffBand = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    muffBand.position.set(0, 0.24, -0.02);
    this.fig.headGroup.add(muffBand);

    const nameTag = makeBillboardText('⚙️ Kỹ Sư Máy Cưa', '#f59e0b', 190, 32);
    nameTag.position.set(0, 2.75, 0);
    this.mesh.add(nameTag);

    this.animTimer = 0;
  }

  update(dt) {
    this.animTimer += dt;
    const isCutting = (typeof gameState !== 'undefined' && gameState.machineLogBuffer > 0);
    const speedMul = isCutting ? 4.5 : 1.5;

    // Tay phải gạt cần điều khiển máy
    this.fig.rightShoulder.rotation.x = -0.5 + Math.sin(this.animTimer * speedMul) * 0.35;
    this.fig.rightElbow.rotation.x = -0.3 + Math.sin(this.animTimer * speedMul * 1.5) * 0.2;
    // Tay trái tì nhẹ lên thành console
    this.fig.leftShoulder.rotation.x = -0.3;
    this.fig.leftElbow.rotation.x = -0.25;

    // Đầu gật gù quan sát phôi gỗ di chuyển
    this.fig.headGroup.rotation.y = Math.sin(this.animTimer * 1.2) * 0.2;
    this.fig.headGroup.rotation.x = 0.1 + Math.sin(this.animTimer * speedMul) * 0.05;

    this.fig.torsoGroup.position.y = 0.78 + Math.sin(this.animTimer * speedMul * 2) * 0.02;
  }
}

// ---------------------------------------------------------------------------
// 4. CÔNG NHÂN BỐC XẾP VÁN LÊN XE TẢI (PLANK STACKER AGENT)
// Đi theo hành lang an toàn Z = -14, không cắt ngang quầy hàng hay máy móc
// ---------------------------------------------------------------------------
class PlankStackerAgent {
  constructor(scene) {
    this.scene = scene;
    this.state = 'FETCH'; // FETCH, LOAD_TRUCK
    this.speed = 4.2;
    this.timer = 0;
    this.animTimer = 0;

    this.mesh = new THREE.Group();
    this.mesh.position.set(12, 0, -18);
    scene.add(this.mesh);

    // Công nhân bốc ván người hoàn chỉnh
    this.fig = buildStylizedWorkerFigure(this.mesh, {
      shirtColor: 0xd97706, // Áo nâu hổ phách
      vestColor: 0x10b981,  // Ghi-lê bảo hộ xanh ngọc
      pantsColor: 0x1e3a8a,
      headwearType: 'cap',
      headwearColor: 0xb91c1c // Nón đỏ
    });

    // Kiện ván bốc vác trên tay
    this.carriedPlanks = new THREE.Group();
    this.carriedPlanks.position.set(0, 0.45, 0.4);
    this.carriedPlanks.visible = false;
    this.fig.torsoGroup.add(this.carriedPlanks);

    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.8), new THREE.MeshStandardMaterial({ map: Textures.plank() }));
      p.position.y = i * 0.14;
      this.carriedPlanks.add(p);
    }

    const nameTag = makeBillboardText('🚚 Thợ Bốc Ván Xe', '#10b981', 190, 32);
    nameTag.position.set(0, 2.75, 0);
    this.mesh.add(nameTag);

    // Lộ trình hành lang an toàn tránh va chạm:
    // Pallet Bay (12, -18) -> Làn đi bộ (12, -14) -> Làn đi bộ (25, -14) -> Bến xe tải (25, -18)
    this.pathToTruck = [
      new THREE.Vector3(12, 0, -14),
      new THREE.Vector3(25, 0, -14),
      new THREE.Vector3(25, 0, -18)
    ];
    this.pathToPallet = [
      new THREE.Vector3(25, 0, -14),
      new THREE.Vector3(12, 0, -14),
      new THREE.Vector3(12, 0, -18)
    ];
    this.pathIdx = 0;
  }

  update(dt) {
    if (this.state === 'FETCH') {
      const target = this.pathToPallet[this.pathIdx];
      const dist = this.mesh.position.distanceTo(target);
      if (dist > 0.4) {
        const dir = new THREE.Vector3().subVectors(target, this.mesh.position).normalize();
        this.mesh.position.addScaledVector(dir, this.speed * dt);
        this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

        this.animTimer += dt * 11;
        const c = Math.sin(this.animTimer);
        this.fig.leftHip.rotation.x = c * 0.5;
        this.fig.rightHip.rotation.x = -c * 0.5;
        this.fig.leftKnee.rotation.x = Math.max(0, -c) * 0.7;
        this.fig.rightKnee.rotation.x = Math.max(0, c) * 0.7;
        this.fig.leftShoulder.rotation.x = -c * 0.4;
        this.fig.rightShoulder.rotation.x = c * 0.4;
        this.fig.torsoGroup.position.y = 0.78 + Math.abs(Math.cos(this.animTimer)) * 0.04;
      } else {
        this.pathIdx++;
        if (this.pathIdx >= this.pathToPallet.length) {
          if (gameState.planks >= 3) {
            gameState.planks -= 3;
            this.carriedPlanks.visible = true;
            this.state = 'LOAD_TRUCK';
            this.pathIdx = 0;
            updateHUD();
          } else {
            this.pathIdx = this.pathToPallet.length - 1;
            // Đứng chờ ván
            this.fig.leftHip.rotation.x = 0;
            this.fig.rightHip.rotation.x = 0;
            this.fig.leftKnee.rotation.x = 0;
            this.fig.rightKnee.rotation.x = 0;
          }
        }
      }
    } else if (this.state === 'LOAD_TRUCK') {
      const target = this.pathToTruck[this.pathIdx];
      const dist = this.mesh.position.distanceTo(target);
      if (dist > 0.4) {
        const dir = new THREE.Vector3().subVectors(target, this.mesh.position).normalize();
        this.mesh.position.addScaledVector(dir, this.speed * dt);
        this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

        this.animTimer += dt * 10;
        const c = Math.sin(this.animTimer);
        this.fig.leftHip.rotation.x = c * 0.45;
        this.fig.rightHip.rotation.x = -c * 0.45;
        this.fig.leftKnee.rotation.x = Math.max(0, -c) * 0.65;
        this.fig.rightKnee.rotation.x = Math.max(0, c) * 0.65;
        // Bê kiện ván 2 tay
        this.fig.leftShoulder.rotation.x = -0.6;
        this.fig.leftElbow.rotation.x = -0.5;
        this.fig.rightShoulder.rotation.x = -0.6;
        this.fig.rightElbow.rotation.x = -0.5;
        this.fig.torsoGroup.position.y = 0.78 + Math.abs(Math.cos(this.animTimer)) * 0.04;
      } else {
        this.pathIdx++;
        if (this.pathIdx >= this.pathToTruck.length) {
          this.carriedPlanks.visible = false;
          const pVal = (typeof getPlankValue === 'function') ? getPlankValue() : 20;
          const earned = 3 * pVal * 2 + 120;
          if (typeof gameState !== 'undefined') {
            gameState.money = (gameState.money || 0) + earned;
            gameState.exportOrders = (gameState.exportOrders || 0) + 1;
            if (window.drivableLumberTruck && (gameState.truckCargo || 0) < (gameState.truckMaxCargo || 16)) {
              gameState.truckCargo = Math.min(gameState.truckMaxCargo || 16, (gameState.truckCargo || 0) + 1);
            }
          }
          if (typeof sounds !== 'undefined' && sounds.playWoodPlank) sounds.playWoodPlank();
          if (typeof spawnFloatingText === 'function') {
            spawnFloatingText(this.mesh.position.clone().add(new THREE.Vector3(0, 3, 0)), `+${earned} Xuất khẩu ván 📦`, '#facc15');
          }
          if (typeof updateHUD === 'function') updateHUD();
          this.state = 'FETCH';
          this.pathIdx = 0;
          this.fig.leftShoulder.rotation.x = 0;
          this.fig.leftElbow.rotation.x = 0;
          this.fig.rightShoulder.rotation.x = 0;
          this.fig.rightElbow.rotation.x = 0;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 5. MÔ HÌNH XE TẢI NẶNG CÓ TÀI XẾ CHÂN THẬT (TRUCK VEHICLE)
// ---------------------------------------------------------------------------
class TruckVehicle {
  constructor(scene, color = 0xfacc15, zPos = -18) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.set(28, 0, zPos);
    this.mesh.rotation.y = -Math.PI / 2; // Đầu xe hướng về phía Bắc (trục +Z xuất khẩu)
    scene.add(this.mesh);

    this.planksLoaded = 0;
    this.maxPlanks = 8;
    this.speed = 0;
    this.targetZ = zPos;
    this.wheels = [];
    this.state = 'WAITING'; // WAITING, LOADING, DEPARTING, ADVANCING

    // Materials
    const cabMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.35, metalness: 0.2 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });

    // 1. Cabin xe tải hạng nặng (Heavy American Cab)
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.7, 2.7), cabMat);
    cab.position.set(4.0, 1.8, 0);
    cab.castShadow = true;
    this.mesh.add(cab);

    // Kính chắn gió lớn trong suốt
    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.3, 2.3),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65, roughness: 0.1 })
    );
    windshield.position.set(5.61, 2.15, 0);
    this.mesh.add(windshield);

    // Vành che nắng trán cabin (Sun Visor)
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 2.5), chromeMat);
    visor.position.set(5.7, 2.95, 0);
    visor.rotation.z = -0.25;
    this.mesh.add(visor);

    // Mặt nạ ca-lăng tản nhiệt mạ Chrome (Chrome Front Grille)
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 2.1), chromeMat);
    grille.position.set(5.62, 1.15, 0);
    this.mesh.add(grille);

    // Đèn pha kép phát sáng (Twin Headlights)
    [-0.9, 0.9].forEach(hy => {
      const lightMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 0.4), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      lightMesh.position.set(5.62, 1.15, hy);
      this.mesh.add(lightMesh);
    });

    // Gương chiếu hậu 2 bên (Side Mirrors)
    [-1.5, 1.5].forEach(my => {
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.12), chromeMat);
      mirror.position.set(4.6, 2.2, my);
      this.mesh.add(mirror);
    });

    // 2. TÀI XẾ XE TẢI CHÂN THẬT TRONG CABIN (VISIBLE 3D DRIVER)
    const driverGroup = new THREE.Group();
    driverGroup.position.set(4.0, 1.5, -0.55); // Ghế lái phía bên trái
    this.mesh.add(driverGroup);

    // Thân áo tài xế caro
    const dTorso = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.8, 0.5), new THREE.MeshStandardMaterial({ color: 0xb91c1c }));
    dTorso.position.y = 0.4;
    driverGroup.add(dTorso);

    // Đầu & Mũ lưỡi trai tài xế
    const dHead = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: 0xffedd5 }));
    dHead.position.y = 1.0;
    driverGroup.add(dHead);

    const dCap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.52), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    dCap.position.set(0.05, 1.25, 0);
    driverGroup.add(dCap);

    // Vô-lăng tròn trước tay lái
    const wheelSteer = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 16), darkMat);
    wheelSteer.position.set(0.42, 0.7, 0);
    wheelSteer.rotation.y = Math.PI / 2;
    wheelSteer.rotation.x = 0.4;
    driverGroup.add(wheelSteer);

    // 3. Ống Xả Chrome Đứng Phụt Khói (Twin Exhaust Stacks)
    this.exhaustPipes = [];
    [-1.4, 1.4].forEach(ey => {
      const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.8, 10), chromeMat);
      ex.position.set(2.3, 2.8, ey);
      this.mesh.add(ex);
      this.exhaustPipes.push(ex);
    });

    // 4. Sàn Xe Tải Chở Ván Gỗ (Flatbed Cargo Deck)
    const flatbed = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.45, 2.8), darkMat);
    flatbed.position.set(-1.8, 1.1, 0);
    flatbed.castShadow = true;
    this.mesh.add(flatbed);

    // Lan can thành xe thép
    const railNorth = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.35, 0.1), chromeMat);
    railNorth.position.set(-1.8, 1.45, 1.35);
    this.mesh.add(railNorth);
    const railSouth = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.35, 0.1), chromeMat);
    railSouth.position.set(-1.8, 1.45, -1.35);
    this.mesh.add(railSouth);

    // 5. Chồng Ván Gỗ Thật Chất Trên Xe (Dynamic Cargo Planks)
    this.cargoPlanks = [];
    for (let p = 0; p < this.maxPlanks; p++) {
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.28, 2.4),
        new THREE.MeshStandardMaterial({ map: Textures.plank(), roughness: 0.75 })
      );
      plank.position.set(-1.8, 1.45 + p * 0.3, 0);
      plank.castShadow = true;
      plank.visible = false;
      this.mesh.add(plank);
      this.cargoPlanks.push(plank);
    }

    // 6. 6 Bánh Xe Hạng Nặng Cao Su Đen & Mâm Chrome
    const wheelGeo = new THREE.CylinderGeometry(0.56, 0.56, 0.42, 16);
    wheelGeo.rotateX(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.44, 12);
    rimGeo.rotateX(Math.PI / 2);

    const wPos = [
      [4.2, 0.56, -1.45], [4.2, 0.56, 1.45],
      [-0.8, 0.56, -1.45], [-0.8, 0.56, 1.45],
      [-4.0, 0.56, -1.45], [-4.0, 0.56, 1.45]
    ];
    wPos.forEach(([wx, wy, wz]) => {
      const w = new THREE.Mesh(wheelGeo, rubberMat);
      w.position.set(wx, wy, wz);
      w.castShadow = true;
      this.mesh.add(w);
      const r = new THREE.Mesh(rimGeo, chromeMat);
      r.position.set(wx, wy, wz);
      this.mesh.add(r);
      this.wheels.push(w);
      this.wheels.push(r);
    });

    // Puffs khói ống xả
    this.smokeTimer = 0;
  }

  loadPlanks(amount) {
    this.planksLoaded = Math.min(this.planksLoaded + amount, this.maxPlanks);
    this.cargoPlanks.forEach((p, i) => {
      p.visible = i < this.planksLoaded;
    });
  }

  update(dt) {
    // Quay bánh xe khi di chuyển
    if (this.speed > 0.1) {
      this.wheels.forEach(w => w.rotateZ(dt * this.speed * 2.2));
    }

    // Phụt khói ống xả xe tải
    this.smokeTimer += dt;
    if (this.smokeTimer >= 0.35) {
      this.smokeTimer = 0;
      if (typeof spawnParticle === 'function') {
        const pPos = this.mesh.position.clone().add(new THREE.Vector3(0, 4.0, 0));
        spawnParticle(pPos, this.state === 'DEPARTING' ? 0x475569 : 0x94a3b8);
      }
    }

    if (this.state === 'ADVANCING') {
      const curZ = this.mesh.position.z;
      if (curZ < this.targetZ) {
        this.speed = 6.5;
        this.mesh.position.z += this.speed * dt;
        if (this.mesh.position.z >= this.targetZ) {
          this.mesh.position.z = this.targetZ;
          this.speed = 0;
          this.state = (this.targetZ === -18) ? 'LOADING' : 'WAITING';
        }
      }
    } else if (this.state === 'DEPARTING') {
      this.speed = Math.min(this.speed + dt * 8, 14.0);
      this.mesh.position.z += this.speed * dt;

      // Leo dốc vòm Cầu Vượt Sông Đại Dương khi qua cầu (mượt mà đồng bộ 100% C^1)
      const bZ = this.mesh.position.z;
      const getBridgeDeckY = (z) => {
        const u = (z - 16.0) / 14.0;
        if (Math.abs(u) <= 1.0) {
          return 0.13 + 3.6 * ((1.0 + Math.cos(Math.PI * u)) / 2.0);
        }
        return 0.13;
      };

      const zF = 4.8;
      const zR = -3.2;
      const zFront = bZ + zF;
      const zRear = bZ + zR;
      const yCenter = getBridgeDeckY(bZ);
      const yFront = getBridgeDeckY(zFront);
      const yRear = getBridgeDeckY(zRear);

      const deltaY = yFront - yRear;
      const pitch = Math.atan2(deltaY, zF - zR);
      // Với rotation.y = -Math.PI / 2 ('XYZ' order), trục quay dốc (pitch) theo hướng di chuyển +Z là Local Z
      this.mesh.rotation.z = -pitch;
      this.mesh.rotation.x = 0;

      const midY = (yFront + yRear) * 0.5 + ((zF + zR) * 0.5) * Math.sin(pitch);
      this.mesh.position.y = Math.max(yCenter, midY) + 0.04;
    }
  }
}

// ---------------------------------------------------------------------------
// 6. ĐOÀN XE TẢI XẾP HÀNG LOGISTICS (TRUCK FLEET QUEUE MANAGER)
// ---------------------------------------------------------------------------
class TruckFleetManager {
  constructor(scene) {
    this.scene = scene;
    this.slots = [-18, -30, -42];
    this.trucks = [
      new TruckVehicle(scene, 0xfacc15, this.slots[0]), // Lead Truck: Vàng nổi bật
      new TruckVehicle(scene, 0x2563eb, this.slots[1]), // Truck 2: Xanh dương
      new TruckVehicle(scene, 0xdc2626, this.slots[2])  // Truck 3: Đỏ đậm
    ];
    this.trucks[0].state = 'LOADING';
    this.departureCooldown = 0;
  }

  getLeadTruck() {
    return this.trucks[0];
  }

  loadPlanks(amount) {
    const lead = this.getLeadTruck();
    if (!lead || lead.state !== 'LOADING') return;

    lead.loadPlanks(amount);
    sounds.playWoodPlank();
    spawnFloatingText(lead.mesh.position.clone().add(new THREE.Vector3(0, 3, 0)), `+${amount} Ván lên xe tải 🚚`, '#facc15');

    // Nếu đầy thùng hàng: Tiến hành bóp còi & xuất bến!
    if (lead.planksLoaded >= lead.maxPlanks) {
      this.dispatchLeadTruck();
    }
  }

  dispatchLeadTruck() {
    const lead = this.getLeadTruck();
    if (!lead || lead.state !== 'LOADING') return;

    lead.state = 'DEPARTING';
    sounds.playTruckHorn(); // Bóp còi hơi 2 nốt vang dội!

    // Mưa sao vàng & nhận thưởng tiền mặt xuất khẩu khủng
    const pValue = typeof getPlankValue === 'function' ? getPlankValue() : 20;
    const earned = lead.maxPlanks * pValue * 2 + 150; // Thưởng lớn thêm $150 mỗi chuyến xe tải
    gameState.money += earned;
    gameState.exportOrders = (gameState.exportOrders || 0) + 1;

    spawnFloatingText(lead.mesh.position.clone().add(new THREE.Vector3(0, 4.5, 0)), `+$${earned} XUẤT KHẨU XE TẢI! 🚛`, '#4ade80');
    showToast(`🚛 Chuyến xe tải xuất bến thành công! Nhận +$${earned}`);
    updateHUD();
    triggerActionSave();

    // Đoàn xe phía sau rồ ga tiến lên trám chỗ
    setTimeout(() => {
      this.advanceQueue();
    }, 1200);
  }

  advanceQueue() {
    // Xóa lead truck cũ khi đã chạy xa qua cầu
    const departedTruck = this.trucks.shift();
    setTimeout(() => {
      this.scene.remove(departedTruck.mesh);
    }, 8500);

    // 2 Xe sau tiến lên vị trí mới
    this.trucks[0].targetZ = this.slots[0];
    this.trucks[0].state = 'ADVANCING';

    this.trucks[1].targetZ = this.slots[1];
    this.trucks[1].state = 'ADVANCING';

    // Tạo xe mới xếp vào đuôi hàng (slot 2: -42) từ xa (-56)
    const colors = [0xfacc15, 0x10b981, 0x0284c7, 0x8b5cf6, 0xdc2626];
    const randColor = colors[Math.floor(Math.random() * colors.length)];
    const newTruck = new TruckVehicle(this.scene, randColor, -56);
    newTruck.targetZ = this.slots[2];
    newTruck.state = 'ADVANCING';
    this.trucks.push(newTruck);
  }

  update(dt) {
    this.trucks.forEach(t => t.update(dt));
  }
}

// ---------------------------------------------------------------------------
// 7. XE NÂNG HÀNG TỰ ĐỘNG (FORKLIFT AGENT) - CÓ TÀI XẾ 3D & LÀN ĐƯỜNG Z = -13
// ---------------------------------------------------------------------------
class ForkliftAgent {
  constructor(scene, id = 0) {
    this.id = id;
    this.state = 'FETCH'; // FETCH, LIFT, TRANSPORT, DROP
    this.timer = 0;
    this.speed = 4.8;

    this.mesh = new THREE.Group();
    this.mesh.position.set(12, 0, -18);
    scene.add(this.mesh);

    // Chassis vàng công nghiệp
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.2 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 2.4), bodyMat);
    chassis.position.y = 0.55;
    chassis.castShadow = true;
    this.mesh.add(chassis);

    // Đối trọng sắt đúc phía sau đuôi
    const counterweight = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.75, 0.6), darkMat);
    counterweight.position.set(0, 0.65, -1.0);
    this.mesh.add(counterweight);

    // Khung lồng thép bảo hộ cabin mở (Open Roll-Cage Cab)
    this.cabFrame = new THREE.Group();
    this.cabFrame.position.set(0, 0.9, -0.2);
    this.mesh.add(this.cabFrame);

    [[-0.6, 0.5], [0.6, 0.5], [-0.6, -0.5], [0.6, -0.5]].forEach(([px, pz]) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.35, 6), darkMat);
      post.position.set(px, 0.68, pz);
      this.cabFrame.add(post);
    });

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.06, 1.15), darkMat);
    roof.position.y = 1.38;
    this.cabFrame.add(roof);

    // Đèn chớp báo nguy hiểm màu hổ phách
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.85 })
    );
    this.beacon.position.set(0, 1.48, 0);
    this.cabFrame.add(this.beacon);

    // Ghế tài xế xe nâng có đệm êm
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.45), darkMat);
    seat.position.set(0, 0.35, -0.1);
    this.cabFrame.add(seat);
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.1), darkMat);
    seatBack.position.set(0, 0.6, -0.3);
    this.cabFrame.add(seatBack);

    // Trục lái & Vô-lăng
    const steerCol = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6), steelMat);
    steerCol.rotation.x = -0.45;
    steerCol.position.set(0, 0.65, 0.25);
    this.cabFrame.add(steerCol);

    this.steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 6, 12), darkMat);
    this.steeringWheel.rotation.x = -0.45;
    this.steeringWheel.position.set(0, 0.82, 0.35);
    this.cabFrame.add(this.steeringWheel);

    // TÀI XẾ XE NÂNG 3D NGỒI LÁI CHÂN THẬT (Seated Stylized Human Driver)
    const driverGroup = new THREE.Group();
    driverGroup.position.set(0, 0.38, -0.1);
    this.cabFrame.add(driverGroup);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd8b8, roughness: 0.65 });
    const driverTorso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.48, 0.32), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
    driverTorso.position.y = 0.28;
    driverGroup.add(driverTorso);

    const driverVest = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.42, 0.34), new THREE.MeshStandardMaterial({ color: 0xf97316 }));
    driverVest.position.y = 0.28;
    driverGroup.add(driverVest);

    const driverNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.14, 6), skinMat);
    driverNeck.position.y = 0.55;
    driverGroup.add(driverNeck);

    const driverHead = new THREE.Group();
    driverHead.position.set(0, 0.76, 0);
    driverGroup.add(driverHead);

    const cranium = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), skinMat);
    driverHead.add(cranium);

    [-0.09, 0.09].forEach(ex => {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.02), new THREE.MeshBasicMaterial({ color: 0x0f172a }));
      eye.position.set(ex, 0.04, 0.175);
      driverHead.add(eye);
    });

    const driverHelmet = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.18, 0.42), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
    driverHelmet.position.set(0, 0.18, 0);
    driverHead.add(driverHelmet);

    // Cánh tay vươn về phía trước nắm vô-lăng
    [-0.24, 0.24].forEach(ax => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.42, 6), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
      arm.rotation.x = -1.0;
      arm.position.set(ax, 0.32, 0.2);
      driverGroup.add(arm);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0xd97706 }));
      hand.position.set(ax * 0.7, 0.45, 0.42);
      driverGroup.add(hand);
    });

    // Cột nâng hàng & Càng nâng (Mast & Carriage)
    this.mast = new THREE.Group();
    this.mast.position.set(0, 0.2, 1.25);
    this.mesh.add(this.mast);

    this.carriage = new THREE.Group();
    this.carriage.position.set(0, 0.2, 0.1);
    this.mast.add(this.carriage);

    const forkL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 1.2), darkMat);
    forkL.position.set(-0.35, 0.04, 0.55);
    this.carriage.add(forkL);
    const forkR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 1.2), darkMat);
    forkR.position.set(0.35, 0.04, 0.55);
    this.carriage.add(forkR);

    // Kiện Pallet ván hoàn chỉnh
    this.cargoPallet = new THREE.Group();
    this.cargoPallet.position.set(0, 0.2, 0.6);
    this.cargoPallet.visible = false;
    this.carriage.add(this.cargoPallet);

    for (let i = 0; i < 4; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, 0.9), new THREE.MeshStandardMaterial({ map: Textures.plank() }));
      plank.position.y = i * 0.16;
      this.cargoPallet.add(plank);
    }

    // 4 Bánh xe lốp cao su
    this.wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
    [[-0.85, 0.32, 0.8], [0.85, 0.32, 0.8], [-0.85, 0.32, -0.8], [0.85, 0.32, -0.8]].forEach(([wx, wy, wz]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(wx, wy, wz);
      this.mesh.add(w);
      this.wheels.push(w);
    });

    // LỘ TRÌNH ĐI THEO HÀNH LANG CHUYÊN BIỆT TẠI Z = -13 (Không xuyên qua bất kỳ công trình nào!)
    this.pathToDrop = [
      new THREE.Vector3(12, 0, -13),
      new THREE.Vector3(25, 0, -13),
      new THREE.Vector3(25, 0, -18)
    ];
    this.pathToPickup = [
      new THREE.Vector3(25, 0, -13),
      new THREE.Vector3(12, 0, -13),
      new THREE.Vector3(12, 0, -18)
    ];
    this.wpIndex = 0;
  }

  update(dt, playerPos) {
    const isNear = !playerPos || this.mesh.position.distanceTo(playerPos) < 45.0;
    if (isNear) {
      this.wheels.forEach(w => w.rotateX(dt * 7));
      if (this.beacon) this.beacon.rotation.y += dt * 10;
    }

    if (this.state === 'FETCH') {
      const target = this.pathToPickup[this.wpIndex];
      const dist = this.mesh.position.distanceTo(target);
      if (dist > 0.5) {
        const dir = _sharedVec1 ? _sharedVec1.subVectors(target, this.mesh.position).normalize() : new THREE.Vector3().subVectors(target, this.mesh.position).normalize();
        this.mesh.position.addScaledVector(dir, this.speed * dt);
        const targetRot = Math.atan2(dir.x, dir.z);
        this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, targetRot, Math.min(1.0, dt * 8));
      } else {
        this.wpIndex++;
        if (this.wpIndex >= this.pathToPickup.length) {
          this.state = 'LIFT';
          this.timer = 0;
          this.wpIndex = 0;
        }
      }
    } else if (this.state === 'LIFT') {
      this.timer += dt;
      this.carriage.position.y = Math.min(0.2 + this.timer * 0.8, 0.8);
      if (this.timer > 0.8) {
        this.cargoPallet.visible = true;
        this.state = 'TRANSPORT';
        this.wpIndex = 0;
      }
    } else if (this.state === 'TRANSPORT') {
      const target = this.pathToDrop[this.wpIndex];
      const dist = this.mesh.position.distanceTo(target);
      if (dist > 0.5) {
        const dir = _sharedVec1 ? _sharedVec1.subVectors(target, this.mesh.position).normalize() : new THREE.Vector3().subVectors(target, this.mesh.position).normalize();
        this.mesh.position.addScaledVector(dir, this.speed * dt);
        const targetRot = Math.atan2(dir.x, dir.z);
        this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, targetRot, Math.min(1.0, dt * 8));
      } else {
        this.wpIndex++;
        if (this.wpIndex >= this.pathToDrop.length) {
          this.state = 'DROP';
          this.timer = 0;
          this.wpIndex = 0;
        }
      }
    } else if (this.state === 'DROP') {
      this.timer += dt;
      this.carriage.position.y = Math.max(0.8 - this.timer * 0.8, 0.2);
      if (this.timer > 0.8) {
        this.cargoPallet.visible = false;
        if (typeof gameState !== 'undefined') {
          gameState.money = (gameState.money || 0) + 180;
          gameState.exportOrders = (gameState.exportOrders || 0) + 1;
        }
        if (isNear && typeof sounds !== 'undefined' && sounds.playWoodPlank) sounds.playWoodPlank();
        this.state = 'FETCH';
        this.wpIndex = 0;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 8. HỆ SINH THÁI ĐỘNG VẬT HOANG DÃ SỐNG ĐỘNG (REACTIVE WILDLIFE ECOSYSTEM)
// - Đàn chim sẻ: Đậu trên hàng rào, giật mình bay tán loạn khi người chơi đến gần (< 4.8m)
// - Đàn cá bơi ngược dòng sông với vây đuôi quẫy tự nhiên
// - Đom đóm đêm lập lòe phát quang vào hoàng hôn và ban đêm
// ---------------------------------------------------------------------------
class WildlifeEcosystem {
  constructor(scene) {
    this.scene = scene;

    // 1. ĐÀN CHIM SẺ ĐẬU HÀNG RÀO & CỘT CẦU (Sparrow Flock)
    this.birds = [];
    const birdMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8 });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.7 });
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b });

    this.perchPoints = [
      new THREE.Vector3(-14, 1.15, -26),
      new THREE.Vector3(-8, 1.15, -26),
      new THREE.Vector3(-2, 1.15, -26),
      new THREE.Vector3(6, 1.15, -26),
      new THREE.Vector3(14, 1.15, -26),
      new THREE.Vector3(19.8, 2.5, 12),
      new THREE.Vector3(19.8, 2.5, 20),
      new THREE.Vector3(36.2, 2.5, 12),
      new THREE.Vector3(36.2, 2.5, 20),
      new THREE.Vector3(-18, 1.2, -8),
      new THREE.Vector3(-28, 1.2, -8),
      new THREE.Vector3(-36, 1.2, -8)
    ];

    for (let i = 0; i < 12; i++) {
      const bGroup = new THREE.Group();
      scene.add(bGroup);

      const body = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 5), birdMat);
      body.rotation.x = Math.PI / 2.3;
      bGroup.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), birdMat);
      head.position.set(0, 0.12, 0.16);
      bGroup.add(head);

      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 4), beakMat);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.1, 0.26);
      bGroup.add(beak);

      // Cánh trái
      const wingLPivot = new THREE.Group();
      wingLPivot.position.set(-0.1, 0.08, 0);
      bGroup.add(wingLPivot);
      const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.16), wingMat);
      wingL.position.set(-0.12, 0, 0);
      wingLPivot.add(wingL);

      // Cánh phải
      const wingRPivot = new THREE.Group();
      wingRPivot.position.set(0.1, 0.08, 0);
      bGroup.add(wingRPivot);
      const wingR = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.16), wingMat);
      wingR.position.set(0.12, 0, 0);
      wingRPivot.add(wingR);

      const perch = this.perchPoints[i % this.perchPoints.length].clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4));
      bGroup.position.copy(perch);

      this.birds.push({
        mesh: bGroup,
        wingLPivot: wingLPivot,
        wingRPivot: wingRPivot,
        state: 'PERCHED',
        perchPos: perch,
        targetPos: perch.clone(),
        flightTimer: 0,
        wingFreq: 18 + Math.random() * 6,
        cruisingAltitude: 4.5 + Math.random() * 3.5,
        headingAngle: Math.random() * Math.PI * 2
      });
    }

    // 2. ĐÀN CÁ BƠI QUẪY ĐUÔI DƯỚI LÒNG SÔNG (Fish School with Wagging Tail)
    this.fishes = [];
    const fishMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });

    for (let f = 0; f < 18; f++) {
      const fGroup = new THREE.Group();
      scene.add(fGroup);

      const fBody = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.52, 5), fishMat);
      fBody.rotation.x = Math.PI / 2;
      fGroup.add(fBody);

      const tailPivot = new THREE.Group();
      tailPivot.position.set(0, 0, -0.26);
      fGroup.add(tailPivot);

      const caudalFin = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.14), tailMat);
      caudalFin.rotation.y = Math.PI / 2;
      caudalFin.position.set(0, 0, -0.08);
      tailPivot.add(caudalFin);

      const initialPos = new THREE.Vector3(
        -20 + Math.random() * 45,
        -0.25 + (Math.random() - 0.5) * 0.2,
        14 + Math.random() * 4
      );
      fGroup.position.copy(initialPos);

      this.fishes.push({
        mesh: fGroup,
        tailPivot: tailPivot,
        speed: 1.2 + Math.random() * 0.9,
        swimDir: Math.random() > 0.5 ? 1 : -1,
        phase: Math.random() * Math.PI * 2
      });
    }

    // 3. ĐOM ĐÓM ĐÊM PHÁT QUANG (Bioluminescent Night Fireflies)
    this.fireflies = [];
    const fireflyGeo = new THREE.SphereGeometry(0.045, 6, 6);
    const fireflyMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    this.fireflyGroup = new THREE.Group();
    scene.add(this.fireflyGroup);

    for (let fi = 0; fi < 30; fi++) {
      const ff = new THREE.Mesh(fireflyGeo, fireflyMat);
      const fx = -35 + Math.random() * 55;
      const fz = -35 + Math.random() * 40;
      const fy = 0.8 + Math.random() * 2.2;
      ff.position.set(fx, fy, fz);
      this.fireflyGroup.add(ff);

      this.fireflies.push({
        mesh: ff,
        baseX: fx,
        baseZ: fz,
        baseY: fy,
        phase: Math.random() * Math.PI * 2,
        driftSpeed: 0.4 + Math.random() * 0.5
      });
    }
    this.fireflyGroup.visible = false;

    // 4. BẦY HƯƠU RỪNG HOANG DÃ (Forest Deer Herd: Stag, Doe & Spotted Fawn)
    this.deerHerd = [];
    const deerBrownMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.75 });
    const deerWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.7 });
    const antlerMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.5 });
    const darkNoseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });

    const deerConfigs = [
      { type: 'stag', scale: 1.1, x: -28, z: -25, hasAntlers: true },
      { type: 'doe', scale: 0.95, x: -24, z: -28, hasAntlers: false },
      { type: 'fawn', scale: 0.65, x: -26, z: -23, hasAntlers: false }
    ];

    deerConfigs.forEach((cfg) => {
      const dGroup = new THREE.Group();
      dGroup.position.set(cfg.x, 0, cfg.z);
      dGroup.scale.setScalar(cfg.scale);
      scene.add(dGroup);

      // Thân hươu
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.6, 1.25), deerBrownMat);
      body.position.set(0, 0.95, 0);
      body.castShadow = true;
      dGroup.add(body);

      // Yếm trắng dưới bụng
      const belly = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.15, 0.85), deerWhiteMat);
      belly.position.set(0, 0.7, 0);
      dGroup.add(belly);

      // Cổ & Đầu (Nhóm xoay để cúi gặm cỏ hoặc ngẩng cao)
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 1.15, 0.55);
      dGroup.add(headPivot);

      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.65, 0.35), deerBrownMat);
      neck.position.set(0, 0.28, 0.15);
      neck.rotation.x = 0.35;
      neck.castShadow = true;
      headPivot.add(neck);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.42), deerBrownMat);
      head.position.set(0, 0.58, 0.32);
      head.castShadow = true;
      headPivot.add(head);

      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.12), darkNoseMat);
      nose.position.set(0, 0.54, 0.54);
      headPivot.add(nose);

      // Đôi tai
      [-0.18, 0.18].forEach(ex => {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), deerBrownMat);
        ear.position.set(ex, 0.75, 0.25);
        ear.rotation.set(-0.2, 0, (ex > 0 ? -0.4 : 0.4));
        headPivot.add(ear);
      });

      // Sừng gạc hươu (chỉ cho hươu đực)
      if (cfg.hasAntlers) {
        [-0.16, 0.16].forEach(ax => {
          const mainBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.75, 5), antlerMat);
          mainBeam.position.set(ax, 0.95, 0.25);
          mainBeam.rotation.set(-0.35, 0, (ax > 0 ? 0.35 : -0.35));
          headPivot.add(mainBeam);

          const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.35, 4), antlerMat);
          tine.position.set(ax * 1.5, 0.92, 0.38);
          tine.rotation.set(0.35, 0, (ax > 0 ? 0.6 : -0.6));
          headPivot.add(tine);
        });
      }

      // Đuôi nhỏ
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), deerWhiteMat);
      tail.position.set(0, 1.15, -0.65);
      tail.rotation.x = -0.6;
      dGroup.add(tail);

      // 4 Chân slender legs
      const legs = [];
      [[-0.22, 0.45], [0.22, 0.45], [-0.22, -0.45], [0.22, -0.45]].forEach(([lx, lz]) => {
        const legPivot = new THREE.Group();
        legPivot.position.set(lx, 0.7, lz);
        dGroup.add(legPivot);

        const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.1), deerBrownMat);
        legMesh.position.set(0, -0.35, 0);
        legMesh.castShadow = true;
        legPivot.add(legMesh);
        legs.push(legPivot);
      });

      this.deerHerd.push({
        group: dGroup,
        headPivot: headPivot,
        tail: tail,
        legs: legs,
        state: 'GRAZING', // 'GRAZING' | 'LOOKING' | 'WALKING' | 'FLEEING'
        stateTimer: 2.0 + Math.random() * 4.0,
        homePos: new THREE.Vector3(cfg.x, 0, cfg.z),
        targetPos: new THREE.Vector3(cfg.x, 0, cfg.z),
        speed: 1.6,
        type: cfg.type
      });
    });
  }

  scatterBirds(centerPos, radius = 16) {
    if (!this.birds) return;
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      if (b.state === 'PERCHED') {
        const d = b.mesh.position.distanceTo(centerPos);
        if (d <= radius) {
          b.state = 'FLYING';
          b.flightTimer = 7.0 + Math.random() * 4.0;
          const awayDir = new THREE.Vector3().subVectors(b.mesh.position, centerPos);
          awayDir.y = 0;
          awayDir.normalize();
          b.headingAngle = Math.atan2(awayDir.x, awayDir.z) + (Math.random() - 0.5) * 0.8;
          b.mesh.rotation.y = b.headingAngle;
        }
      }
    }
  }

  update(dt, time, playerPos) {
    // 1. Cập nhật chim sẻ
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];

      if (b.state === 'PERCHED') {
        // Cánh xếp gọn
        b.wingLPivot.rotation.z = 0.1;
        b.wingRPivot.rotation.z = -0.1;
        b.mesh.rotation.y = Math.sin(time * 0.5 + i) * 0.2;

        // Phản ứng giật mình khi người chơi đến gần < 4.8m
        if (playerPos) {
          const d = b.mesh.position.distanceTo(playerPos);
          if (d < 4.8) {
            b.state = 'FLYING';
            b.flightTimer = 8.0 + Math.random() * 4.0;
            // Chọn hướng bay vút ra xa
            const awayDir = new THREE.Vector3().subVectors(b.mesh.position, playerPos).normalize();
            b.headingAngle = Math.atan2(awayDir.x, awayDir.z) + (Math.random() - 0.5) * 0.6;
          }
        }
      } else if (b.state === 'FLYING') {
        b.flightTimer -= dt;

        // Đôi cánh vỗ liên tục
        const flap = Math.sin(time * b.wingFreq) * 0.85;
        b.wingLPivot.rotation.z = flap;
        b.wingRPivot.rotation.z = -flap;

        // Bay theo hình vòng cung lượn
        b.headingAngle += Math.sin(time * 0.8 + i) * 0.02;
        b.mesh.position.x += Math.sin(b.headingAngle) * 5.5 * dt;
        b.mesh.position.z += Math.cos(b.headingAngle) * 5.5 * dt;
        b.mesh.position.y = THREE.MathUtils.lerp(b.mesh.position.y, b.cruisingAltitude, dt * 2.0);
        b.mesh.rotation.y = b.headingAngle;
        b.mesh.rotation.z = -Math.sin(time * 0.8 + i) * 0.2; // Nghiêng thân khi lượn cua

        // Hết thời gian bay -> Tìm chỗ đậu mới
        if (b.flightTimer <= 0) {
          b.state = 'LANDING';
          const nextPerch = this.perchPoints[Math.floor(Math.random() * this.perchPoints.length)];
          b.targetPos = nextPerch.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3));
        }
      } else if (b.state === 'LANDING') {
        const dist = b.mesh.position.distanceTo(b.targetPos);
        if (dist > 0.4) {
          const dir = new THREE.Vector3().subVectors(b.targetPos, b.mesh.position).normalize();
          b.mesh.position.addScaledVector(dir, 4.0 * dt);
          b.mesh.rotation.y = Math.atan2(dir.x, dir.z);
          // Lượn xòe cánh chậm dần
          const glide = Math.sin(time * 8) * 0.3;
          b.wingLPivot.rotation.z = 0.2 + glide;
          b.wingRPivot.rotation.z = -0.2 - glide;
        } else {
          b.mesh.position.copy(b.targetPos);
          b.state = 'PERCHED';
          b.wingLPivot.rotation.z = 0.1;
          b.wingRPivot.rotation.z = -0.1;
          b.mesh.rotation.z = 0;
        }
      }
    }

    // 2. Cập nhật đàn cá sông quẫy đuôi
    for (let f = 0; f < this.fishes.length; f++) {
      const fish = this.fishes[f];
      fish.mesh.position.x += fish.swimDir * fish.speed * dt;

      // Giới hạn trong lòng sông
      if (fish.mesh.position.x > 36) fish.swimDir = -1;
      if (fish.mesh.position.x < -24) fish.swimDir = 1;

      fish.mesh.rotation.y = fish.swimDir > 0 ? Math.PI / 2 : -Math.PI / 2;

      // Vây đuôi quẫy nhịp nhàng
      const tailWag = Math.sin(time * 9.0 + fish.phase) * 0.45;
      fish.tailPivot.rotation.y = tailWag;
      fish.mesh.position.y = -0.25 + Math.sin(time * 2.0 + fish.phase) * 0.04;
    }

    // 3. Cập nhật đom đóm ban đêm
    const isNightTime = (typeof dayNightCycle !== 'undefined' && dayNightCycle.isNight);
    this.fireflyGroup.visible = isNightTime;

    if (isNightTime) {
      for (let fi = 0; fi < this.fireflies.length; fi++) {
        const ff = this.fireflies[fi];
        ff.phase += dt * ff.driftSpeed;
        ff.mesh.position.x = ff.baseX + Math.sin(ff.phase) * 1.5;
        ff.mesh.position.z = ff.baseZ + Math.cos(ff.phase * 0.8) * 1.5;
        ff.mesh.position.y = ff.baseY + Math.sin(ff.phase * 1.4) * 0.4;

        // Nhấp nháy nhẹ nhàng
        const pulse = 0.3 + Math.abs(Math.sin(ff.phase * 2.5)) * 0.7;
        ff.mesh.scale.setScalar(pulse);
      }
    }

    // 4. Cập nhật Bầy Hươu Rừng Hoang Dã (Forest Deer Herd)
    if (this.deerHerd) {
      this.deerHerd.forEach(deer => {
        deer.stateTimer -= dt;

        // Phản ứng giật mình tháo chạy khi người chơi hoặc xe cộ đến gần < 6.8m
        const distToPlayer = playerPos ? deer.group.position.distanceTo(playerPos) : 999;
        if (distToPlayer < 6.8 && deer.state !== 'FLEEING') {
          deer.state = 'FLEEING';
          deer.stateTimer = 4.5 + Math.random() * 2.5;
          const fleeDir = deer.group.position.clone().sub(playerPos);
          fleeDir.y = 0;
          fleeDir.normalize();
          deer.targetPos = deer.group.position.clone().addScaledVector(fleeDir, 14.0);
          deer.targetPos.x = Math.max(-36, Math.min(-6, deer.targetPos.x));
          deer.targetPos.z = Math.max(-36, Math.min(-14, deer.targetPos.z));
        }

        if (deer.state === 'GRAZING') {
          deer.headPivot.rotation.x = THREE.MathUtils.lerp(deer.headPivot.rotation.x, 0.95 + Math.sin(time * 2.0) * 0.08, dt * 3.0);
          deer.tail.rotation.z = Math.sin(time * 6.0) * 0.3;
          deer.legs.forEach(l => l.rotation.x = 0);

          if (deer.stateTimer <= 0) {
            deer.state = Math.random() < 0.6 ? 'LOOKING' : 'WALKING';
            deer.stateTimer = 3.0 + Math.random() * 3.0;
            if (deer.state === 'WALKING') {
              deer.targetPos = deer.homePos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12));
              deer.targetPos.x = Math.max(-36, Math.min(-6, deer.targetPos.x));
              deer.targetPos.z = Math.max(-36, Math.min(-14, deer.targetPos.z));
            }
          }
        } else if (deer.state === 'LOOKING') {
          deer.headPivot.rotation.x = THREE.MathUtils.lerp(deer.headPivot.rotation.x, -0.15, dt * 4.0);
          deer.headPivot.rotation.y = Math.sin(time * 0.8) * 0.45;
          deer.tail.rotation.z = 0;
          deer.legs.forEach(l => l.rotation.x = 0);

          if (deer.stateTimer <= 0) {
            deer.state = 'GRAZING';
            deer.stateTimer = 4.0 + Math.random() * 4.0;
          }
        } else if (deer.state === 'WALKING' || deer.state === 'FLEEING') {
          const isFlee = deer.state === 'FLEEING';
          const curSpeed = isFlee ? 7.2 : 1.8;
          deer.headPivot.rotation.x = isFlee ? -0.1 : 0.25;
          deer.headPivot.rotation.y = 0;

          const toTarget = deer.targetPos.clone().sub(deer.group.position);
          toTarget.y = 0;
          const dist = toTarget.length();

          if (dist > 0.4) {
            toTarget.normalize();
            deer.group.position.addScaledVector(toTarget, curSpeed * dt);
            const targetAngle = Math.atan2(toTarget.x, toTarget.z);
            deer.group.rotation.y = THREE.MathUtils.lerp(deer.group.rotation.y, targetAngle, dt * 6.0);

            const legRate = isFlee ? 18.0 : 8.0;
            const legAmp = isFlee ? 0.75 : 0.35;
            const walkCycle = Math.sin(time * legRate);
            deer.legs[0].rotation.x = walkCycle * legAmp;
            deer.legs[1].rotation.x = -walkCycle * legAmp;
            deer.legs[2].rotation.x = -walkCycle * legAmp;
            deer.legs[3].rotation.x = walkCycle * legAmp;
            deer.group.position.y = Math.abs(Math.sin(time * legRate)) * (isFlee ? 0.15 : 0.04);
          } else {
            deer.state = 'LOOKING';
            deer.stateTimer = 3.0 + Math.random() * 2.0;
            deer.legs.forEach(l => l.rotation.x = 0);
            deer.group.position.y = 0;
          }

          if (isFlee && deer.stateTimer <= 0) {
            deer.state = 'LOOKING';
            deer.stateTimer = 3.0;
          }
        }
      });
    }
  }
}

let wildlifeEco = null;

function initWildlife(scene) {
  wildlifeEco = new WildlifeEcosystem(scene);
  window.wildlifeEco = wildlifeEco;
}

function updateWildlife(dt, time, playerPos) {
  if (wildlifeEco) {
    wildlifeEco.update(dt, time, playerPos);
  }
}

// ---------------------------------------------------------------------------
// 9. XE NÂNG ĐIỀU KHIỂN TRỰC TIẾP CHO NGƯỜI CHƠI (DRIVABLE FORKLIFT)
// ---------------------------------------------------------------------------
class DrivableForklift {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.set(13.5, 0, -12);
    scene.add(this.mesh);

    this.velocity = 0;
    this.steerAngle = 0;
    this.maxSpeed = 8.5;
    this.accel = 16.0;
    this.brake = 22.0;
    this.turnSpeed = 2.4;
    this.reverseBeepTimer = 0;
    this.forkY = 0.2;
    this.targetForkY = 0.2;
    this.hasCargoPallet = false;

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.4 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.8 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 2.6), bodyMat);
    chassis.position.y = 0.6;
    chassis.castShadow = true;
    this.mesh.add(chassis);

    const cageGeo = new THREE.BoxGeometry(1.3, 1.4, 1.3);
    const cage = new THREE.Mesh(cageGeo, steelMat);
    cage.position.set(0, 1.6, -0.2);
    cage.castShadow = true;
    this.mesh.add(cage);

    const sWheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 12), steelMat);
    sWheel.position.set(0, 1.45, 0.25);
    sWheel.rotation.x = 0.75;
    this.mesh.add(sWheel);

    this.mast = new THREE.Group();
    this.mast.position.set(0, 0.2, 1.35);
    this.mesh.add(this.mast);

    const mastPillars = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 0.15), steelMat);
    mastPillars.position.y = 1.2;
    this.mast.add(mastPillars);

    this.carriage = new THREE.Group();
    this.carriage.position.set(0, 0.2, 0.1);
    this.mast.add(this.carriage);

    const forkL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 1.3), steelMat);
    forkL.position.set(-0.35, 0.04, 0.6);
    this.carriage.add(forkL);

    const forkR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 1.3), steelMat);
    forkR.position.set(0.35, 0.04, 0.6);
    this.carriage.add(forkR);

    this.palletMesh = new THREE.Group();
    this.palletMesh.position.set(0, 0.1, 0.65);
    this.palletMesh.visible = false;
    this.carriage.add(this.palletMesh);

    const pBase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 1.5), new THREE.MeshStandardMaterial({ map: Textures.plank() }));
    this.palletMesh.add(pBase);
    const pBundle = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.4), new THREE.MeshStandardMaterial({ map: Textures.plank() }));
    pBundle.position.y = 0.45;
    this.palletMesh.add(pBundle);

    this.wheels = [];
    const wGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12);
    wGeo.rotateZ(Math.PI / 2);
    [[-0.88, 0.35, 0.85], [0.88, 0.35, 0.85], [-0.88, 0.35, -0.85], [0.88, 0.35, -0.85]].forEach(([wx, wy, wz]) => {
      const w = new THREE.Mesh(wGeo, wheelMat);
      w.position.set(wx, wy, wz);
      w.castShadow = true;
      this.mesh.add(w);
      this.wheels.push(w);
    });

    this.promptSign = makeBillboardText('🚜 [E] LÁI XE NÂNG FORKLIFT', '#38bdf8', 320, 48);
    this.promptSign.position.set(0, 2.9, 0);
    this.mesh.add(this.promptSign);
  }

  toggleMount() {
    gameState.isDrivingForklift = !gameState.isDrivingForklift;
    if (gameState.isDrivingForklift) {
      sounds.playEngineIgnition();
      this.promptSign.visible = false;
      showToast('🚜 ĐÃ LÊN XE NÂNG: [W/S] Tiến/Lùi | [A/D] Lái | [Space] Nâng/Hạ Càng | [E] Xuống xe');
    } else {
      this.velocity = 0;
      this.promptSign.visible = true;
      showToast('🚶 ĐÃ XUỐNG XE NÂNG');
    }
  }

  toggleForks() {
    this.targetForkY = this.targetForkY < 0.6 ? 1.4 : 0.2;
    sounds.playHydraulic();
  }

  update(dt, playerPos) {
    const distToPlayer = playerPos ? playerPos.distanceTo(this.mesh.position) : 999;
    const promptEl = document.getElementById('vehicle-prompt-hud');
    const promptText = document.getElementById('vehicle-prompt-text');

    if (gameState.isDrivingForklift) {
      if (promptEl) {
        promptEl.classList.add('active');
        if (promptText) promptText.textContent = 'XUỐNG XE NÂNG [E]';
      }
      this.promptSign.visible = false;

      let throttle = 0;
      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) throttle += 1;
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) throttle -= 1;

      let steer = 0;
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) steer += 1;
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) steer -= 1;

      if (throttle !== 0) {
        const turboMultiplier = (gameState.talents && gameState.talents.turboDrive ? 1.3 : 1.0);
        const curMax = this.maxSpeed * (gameState.researchTechs && gameState.researchTechs.turboEngines ? 1.4 : 1.0) * turboMultiplier;
        this.velocity += throttle * this.accel * dt;
        this.velocity = Math.max(-curMax * 0.5, Math.min(this.velocity, curMax));
      } else {
        if (Math.abs(this.velocity) > 0.1) {
          const sign = Math.sign(this.velocity);
          this.velocity -= sign * this.brake * dt;
          if (Math.sign(this.velocity) !== sign) this.velocity = 0;
        } else {
          this.velocity = 0;
        }
      }

      if (this.velocity < -0.5) {
        this.reverseBeepTimer += dt;
        if (this.reverseBeepTimer >= 0.55) {
          this.reverseBeepTimer = 0;
          sounds.playReverseBeep();
        }
      } else {
        this.reverseBeepTimer = 0;
      }

      if (Math.abs(this.velocity) > 0.1) {
        this.mesh.rotation.y += steer * this.turnSpeed * dt * Math.sign(this.velocity);
      }

      // Phanh tay rê bánh Drift khét lẹt (Handbrake Tire Drift Skid)
      const isHandbrake = keysPressed['Space'];
      if (isHandbrake && Math.abs(this.velocity) > 2.5) {
        this.mesh.rotation.y += (steer || (Math.sign(this.velocity) * 0.8)) * this.turnSpeed * dt * 2.2;
        this.velocity *= Math.max(0.1, 1.0 - dt * 2.5);
        if (typeof sounds !== 'undefined' && sounds.playDriftScreech) sounds.playDriftScreech();
        if (typeof spawnParticle === 'function') {
          spawnParticle(this.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.8, 0.15, -1.6)), 0x334155);
          spawnParticle(this.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.8, 0.15, -1.6)), 0xd1d5db);
        }
      }

      const forward = new THREE.Vector3(0, 0, 1).applyEuler(this.mesh.rotation);
      this.mesh.position.addScaledVector(forward, this.velocity * dt);

      // Tiêu thụ nhiên liệu & Kiểm tra Nạp xăng tại trạm xăng
      if (typeof gameState !== 'undefined') {
        if (Math.abs(this.velocity) > 0.2) {
          gameState.vehicleFuel = Math.max(0.0, (gameState.vehicleFuel !== undefined ? gameState.vehicleFuel : 100) - dt * 0.12);
        }
        if (window.gasStationPads) {
          for (let gi = 0; gi < window.gasStationPads.length; gi++) {
            const gp = window.gasStationPads[gi];
            if (this.mesh.position.distanceTo(gp.pos) <= gp.radius && Math.abs(this.velocity) < 1.0) {
              if (gameState.vehicleFuel < 100.0) {
                gameState.vehicleFuel = Math.min(100.0, gameState.vehicleFuel + dt * 35.0);
                if (typeof sounds !== 'undefined' && sounds.playFuelRefill) sounds.playFuelRefill();
                if (typeof showToast === 'function' && Math.random() < 0.05) showToast('⛽ Đang nạp xăng Petrolimex đầy bình...');
              }
            }
          }
        }
        // Kiểm tra Gara sửa chữa xe tự động
        if (window.autoRepairPad && this.mesh.position.distanceTo(window.autoRepairPad.pos) <= window.autoRepairPad.radius && Math.abs(this.velocity) < 1.0) {
          if ((gameState.vehicleHealth || 100) < 100.0) {
            gameState.vehicleHealth = Math.min(100.0, (gameState.vehicleHealth || 100) + dt * 40.0);
            if (typeof sounds !== 'undefined' && sounds.playRepairWrench) sounds.playRepairWrench();
            if (typeof showToast === 'function' && Math.random() < 0.05) showToast('🔧 GARA CƠ KHÍ: Đang gò hàn phục hồi thân vỏ...');
          }
        }
        // Thử thách đỗ xe song song nhận thưởng
        if (window.parkingSlots && Math.abs(this.velocity) < 0.15) {
          window.parkingSlots.forEach(slot => {
            if (!slot.occupied && this.mesh.position.distanceTo(slot.pos) < 2.0) {
              slot.occupied = true;
              gameState.money = (gameState.money || 0) + 50;
              if (typeof showToast === 'function') showToast('🅿️ ĐỖ XE CHUẨN XÁC: Nhận thưởng kỹ năng lái xe +$50!');
              if (typeof sounds !== 'undefined' && sounds.playCoin) sounds.playCoin();
            }
          });
        }
      }

      // Điều tần âm thanh động cơ theo dải ga
      if (typeof sounds !== 'undefined' && sounds.updateEngineThrottle) {
        sounds.updateEngineThrottle(Math.abs(this.velocity) / this.maxSpeed);
      }

      this.mesh.position.x = Math.max(-45, Math.min(this.mesh.position.x, 32));
      this.mesh.position.z = Math.max(-45, Math.min(this.mesh.position.z, 5));

      this.wheels.forEach(w => w.rotateX(this.velocity * dt * 2.5));

      this.forkY = THREE.MathUtils.lerp(this.forkY, this.targetForkY, dt * 4.0);
      this.carriage.position.y = this.forkY;

      // Nhặt Pallet tại trạm đóng đai
      if (!this.hasCargoPallet && gameState.pallets > 0) {
        const distToStrap = this.mesh.position.distanceTo(new THREE.Vector3(10, 0, -18));
        if (distToStrap < 3.5 && this.forkY < 0.5) {
          this.hasCargoPallet = true;
          this.palletMesh.visible = true;
          gameState.pallets--;
          sounds.playWoodPlank();
          spawnFloatingText(this.mesh.position, '+1 Pallet lên càng xe nâng 📦', '#f59e0b');
        }
      }

      // Xếp Pallet lên thùng xe tải
      if (this.hasCargoPallet) {
        const distToTruck = this.mesh.position.distanceTo(new THREE.Vector3(26, 0, -18));
        if (distToTruck < 4.0 && this.forkY > 0.8) {
          this.hasCargoPallet = false;
          this.palletMesh.visible = false;
          gameState.money += 350;
          gameState.exportOrders = (gameState.exportOrders || 0) + 1;
          sounds.playCoin();
          spawnFloatingText(this.mesh.position, '+$350 Giao Pallet Xuất Khẩu! 💵', '#10b981');
        }
      }
    } else {
      if (promptEl) {
        if (distToPlayer <= 3.5) {
          promptEl.classList.add('active');
          if (promptText) promptText.textContent = 'LÊN LÁI XE NÂNG [E]';
        } else {
          promptEl.classList.remove('active');
        }
      }
      this.promptSign.visible = distToPlayer <= 7.0;
    }
  }
}

// ---------------------------------------------------------------------------
// 9b. XE BÁN TẢI HEAVY DUTY ĐIỀU KHIỂN ĐƯỢC (DRIVABLE HEAVY-DUTY PICKUP TRUCK)
// [TỐC ĐỘ 16 M/S - SỨC CHỨA 16 MÓN - LEO CẦU VƯỢT VÀ BĂNG MỌI ĐỊA HÌNH]
// ---------------------------------------------------------------------------
class DrivablePickup {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.set(16, 0.18, -26);
    this.mesh.rotation.order = 'YXZ';
    scene.add(this.mesh);

    this.velocity = 0;
    this.maxSpeed = 16.0;
    this.accel = 22.0;
    this.brake = 30.0;
    this.turnSpeed = 2.6;
    this.cargoCount = 0;
    this.maxCargo = 16;

    const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, metalness: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8, metalness: 0.4 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.9, roughness: 0.1 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });

    // 1. Thân xe bán tải
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.25, 2.4), redMat);
    cab.position.set(0, 1.05, 0.4);
    cab.castShadow = true;
    this.mesh.add(cab);

    // Mui cabin vát khí động học
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 1.6), redMat);
    roof.position.set(0, 1.85, 0.1);
    this.mesh.add(roof);

    // Kính chắn gió
    const ws = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 0.1), glassMat);
    ws.position.set(0, 1.85, 1.0);
    this.mesh.add(ws);

    // Thùng chở hàng phía sau
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 2.2), darkMat);
    bed.position.set(0, 0.85, -1.8);
    bed.castShadow = true;
    this.mesh.add(bed);

    // Khung thể thao mui thùng (Sport Roll-bar)
    const rollBar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.1, 8), chromeMat);
    rollBar.rotation.z = Math.PI / 2;
    rollBar.position.set(0, 2.0, -0.8);
    this.mesh.add(rollBar);

    // Đèn pha LED trước siêu sáng & Chùm tia sáng nón thể tích ban đêm
    const beamGeo = new THREE.ConeGeometry(0.9, 10.0, 10, 1, true);
    beamGeo.rotateX(-Math.PI / 2);
    beamGeo.translate(0, 0, 5.0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.headlightBeams = [];
    [-0.85, 0.85].forEach(lx => {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.15), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      led.position.set(lx, 0.95, 1.65);
      this.mesh.add(led);

      const bMesh = new THREE.Mesh(beamGeo, beamMat);
      bMesh.position.set(lx, 0.95, 1.65);
      bMesh.visible = false;
      this.mesh.add(bMesh);
      this.headlightBeams.push(bMesh);
    });

    // 4 Bánh xe vượt địa hình (All-Terrain Wheels)
    this.wheels = [];
    const wGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.36, 12);
    wGeo.rotateZ(Math.PI / 2);
    [[-1.2, 0.46, 1.4], [1.2, 0.46, 1.4], [-1.2, 0.46, -1.8], [1.2, 0.46, -1.8]].forEach(([wx, wy, wz]) => {
      const w = new THREE.Mesh(wGeo, rubberMat);
      w.position.set(wx, wy, wz);
      w.castShadow = true;
      this.mesh.add(w);
      this.wheels.push(w);
    });

    this.promptSign = makeBillboardText('🛻 [E] LÁI XE BÁN TẢI HEAVY DUTY', '#ef4444', 360, 48);
    this.promptSign.position.set(0, 3.2, 0);
    this.mesh.add(this.promptSign);
  }

  toggleMount() {
    gameState.isDrivingPickup = !gameState.isDrivingPickup;
    if (gameState.isDrivingPickup) {
      if (gameState.isDrivingForklift) gameState.isDrivingForklift = false;
      if (gameState.isDrivingSpeedboat) gameState.isDrivingSpeedboat = false;
      sounds.playEngineIgnition();
      this.promptSign.visible = false;
      showToast('🛻 ĐÃ LÊN XE BÁN TẢI: [W/S] Tốc độ 16 m/s | [A/D] Lái | [E] Xuống xe');
    } else {
      this.velocity = 0;
      this.promptSign.visible = true;
      showToast('🚶 ĐÃ XUỐNG XE BÁN TẢI');
    }
  }

  update(dt, playerPos) {
    const distToPlayer = playerPos ? playerPos.distanceTo(this.mesh.position) : 999;
    const promptEl = document.getElementById('vehicle-prompt-hud');
    const promptText = document.getElementById('vehicle-prompt-text');

    if (gameState.isDrivingPickup) {
      if (promptEl) {
        promptEl.classList.add('active');
        if (promptText) promptText.textContent = 'XUỐNG XE BÁN TẢI [E]';
      }
      this.promptSign.visible = false;

      let throttle = 0;
      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) throttle += 1;
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) throttle -= 1;

      let steer = 0;
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) steer += 1;
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) steer -= 1;

      // Khối lượng xe biến đổi theo tải trọng chở hàng (Mục 41)
      const cargoWeight = ((gameState.logs || 0) * 0.5 + (gameState.planks || 0) * 0.8);
      window.vehiclePayloadWeight = cargoWeight;
      const payloadAccelMul = Math.max(0.65, 1.0 - (cargoWeight / 40.0) * 0.35);
      const payloadBrakeMul = Math.max(0.60, 1.0 - (cargoWeight / 40.0) * 0.40);

      // Bánh xe quay trượt tại chỗ khi đề-pa mạnh Burnout (Mục 50)
      const isBurnout = throttle > 0 && (keysPressed['Space'] || keysPressed['KeyS']) && Math.abs(this.velocity) < 2.5;
      if (isBurnout) {
        if (typeof sounds !== 'undefined' && sounds.playBurnoutSpin && Math.random() < 0.25) {
          sounds.playBurnoutSpin();
        }
        if (typeof spawnParticle === 'function') {
          spawnParticle(this.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.18, -1.5)), 0xd1d5db);
        }
      }

      if (throttle !== 0 && !isBurnout) {
        const turboMultiplier = (gameState.talents && gameState.talents.turboDrive ? 1.3 : 1.0);
        const curMax = this.maxSpeed * (gameState.researchTechs && gameState.researchTechs.turboEngines ? 1.4 : 1.0) * turboMultiplier;
        this.velocity += throttle * this.accel * payloadAccelMul * dt;
        this.velocity = Math.max(-curMax * 0.45, Math.min(this.velocity, curMax));
      } else {
        if (Math.abs(this.velocity) > 0.1) {
          const sign = Math.sign(this.velocity);
          this.velocity -= sign * this.brake * payloadBrakeMul * dt;
          if (Math.sign(this.velocity) !== sign) this.velocity = 0;
        } else {
          this.velocity = 0;
        }
      }

      if (Math.abs(this.velocity) > 0.1) {
        this.mesh.rotation.y += steer * this.turnSpeed * dt * Math.sign(this.velocity);
      }

      // Góc nghiêng thân xe khi ôm cua gắt Body Roll / Sway (Mục 55)
      const targetRoll = -steer * (Math.abs(this.velocity) / this.maxSpeed) * 0.14;
      this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, targetRoll, dt * 7.0);

      // Phanh tay rê bánh Drift khét lẹt (Handbrake Tire Drift Skid)
      const isHandbrake = keysPressed['Space'];
      if (isHandbrake && Math.abs(this.velocity) > 2.5) {
        this.mesh.rotation.y += (steer || (Math.sign(this.velocity) * 0.8)) * this.turnSpeed * dt * 2.2;
        this.velocity *= Math.max(0.1, 1.0 - dt * 2.5);
        if (typeof sounds !== 'undefined' && sounds.playDriftScreech) sounds.playDriftScreech();
        if (typeof spawnParticle === 'function') {
          spawnParticle(this.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.8, 0.15, -1.6)), 0x334155);
          spawnParticle(this.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.8, 0.15, -1.6)), 0xd1d5db);
        }
      }

      const forward = new THREE.Vector3(0, 0, 1).applyEuler(this.mesh.rotation);
      this.mesh.position.addScaledVector(forward, this.velocity * dt);

      // Tiêu thụ nhiên liệu & Kiểm tra Nạp xăng tại trạm xăng
      if (typeof gameState !== 'undefined') {
        if (Math.abs(this.velocity) > 0.2) {
          gameState.vehicleFuel = Math.max(0.0, (gameState.vehicleFuel !== undefined ? gameState.vehicleFuel : 100) - dt * 0.12);
        }
        if (window.gasStationPads) {
          for (let gi = 0; gi < window.gasStationPads.length; gi++) {
            const gp = window.gasStationPads[gi];
            if (this.mesh.position.distanceTo(gp.pos) <= gp.radius && Math.abs(this.velocity) < 1.0) {
              if (gameState.vehicleFuel < 100.0) {
                gameState.vehicleFuel = Math.min(100.0, gameState.vehicleFuel + dt * 35.0);
                if (typeof sounds !== 'undefined' && sounds.playFuelRefill) sounds.playFuelRefill();
                if (typeof showToast === 'function' && Math.random() < 0.05) showToast('⛽ Đang nạp xăng Petrolimex đầy bình...');
              }
            }
          }
        }
        // Kiểm tra Gara sửa chữa xe tự động
        if (window.autoRepairPad && this.mesh.position.distanceTo(window.autoRepairPad.pos) <= window.autoRepairPad.radius && Math.abs(this.velocity) < 1.0) {
          if ((gameState.vehicleHealth || 100) < 100.0) {
            gameState.vehicleHealth = Math.min(100.0, (gameState.vehicleHealth || 100) + dt * 40.0);
            if (typeof sounds !== 'undefined' && sounds.playRepairWrench) sounds.playRepairWrench();
            if (typeof showToast === 'function' && Math.random() < 0.05) showToast('🔧 GARA CƠ KHÍ: Đang gò hàn phục hồi thân vỏ...');
          }
        }
        // Thử thách đỗ xe song song nhận thưởng
        if (window.parkingSlots && Math.abs(this.velocity) < 0.15) {
          window.parkingSlots.forEach(slot => {
            if (!slot.occupied && this.mesh.position.distanceTo(slot.pos) < 2.0) {
              slot.occupied = true;
              gameState.money = (gameState.money || 0) + 50;
              if (typeof showToast === 'function') showToast('🅿️ ĐỖ XE CHUẨN XÁC: Nhận thưởng kỹ năng lái xe +$50!');
              if (typeof sounds !== 'undefined' && sounds.playCoin) sounds.playCoin();
            }
          });
        }
      }

      // Điều tần âm thanh động cơ theo dải ga
      if (typeof sounds !== 'undefined' && sounds.updateEngineThrottle) {
        sounds.updateEngineThrottle(Math.abs(this.velocity) / this.maxSpeed);
      }

      // Địa hình & Cầu Vượt Sông
      const curX = this.mesh.position.x;
      const curZ = this.mesh.position.z;
      const onBridge = (curX >= 20.0 && curX <= 36.0 && curZ >= 1.5 && curZ <= 30.5);

      if (onBridge && typeof window.getBridgeDeckY === 'function') {
        const zF = 1.6;
        const zR = -1.6;
        const zFrontWorld = curZ + Math.cos(this.mesh.rotation.y) * zF;
        const zRearWorld = curZ + Math.cos(this.mesh.rotation.y) * zR;
        const yF = window.getBridgeDeckY(zFrontWorld);
        const yR = window.getBridgeDeckY(zRearWorld);
        const pitch = -Math.atan2(yF - yR, zF - zR);
        this.mesh.rotation.x = pitch;
        this.mesh.position.y = (yF + yR) * 0.5 + 0.04;
      } else {
        this.mesh.rotation.x = 0;
        this.mesh.position.y = 0.18;
      }

      this.mesh.position.x = Math.max(-130, Math.min(this.mesh.position.x, 160));
      this.mesh.position.z = Math.max(-130, Math.min(this.mesh.position.z, 200));

      this.wheels.forEach(w => w.rotateX(this.velocity * dt * 2.8));

      // Bụi lốp xe khi phóng nhanh
      if (Math.abs(this.velocity) > 5.0 && Math.random() < 0.25) {
        if (typeof spawnParticle === 'function') {
          spawnParticle(this.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.2, -1.8)), 0xd1d5db);
        }
      }
    } else {
      if (!gameState.isDrivingForklift && !gameState.isDrivingSpeedboat) {
        if (distToPlayer <= 4.0) {
          if (promptEl) {
            promptEl.classList.add('active');
            if (promptText) promptText.textContent = 'LÊN LÁI XE BÁN TẢI [E]';
          }
        }
      }
      this.promptSign.visible = distToPlayer <= 8.0;
    }

    const isNight = (typeof gameState !== 'undefined') && (gameState.gameHour < 5.5 || gameState.gameHour > 18.5);
    if (this.headlightBeams) {
      this.headlightBeams.forEach(b => b.visible = isNight);
    }
  }
}
window.DrivablePickup = DrivablePickup;

// ---------------------------------------------------------------------------
// 9b-2. XE CẢNH SÁT TUẦN TRA ĐẾ CHẾ (DRIVABLE POLICE INTERCEPTOR CRUISER)
// [TỐC ĐỘ 22 M/S - CÒI HÚ SIREN XANH ĐỎ CHỚP NHÁY - THỰC THI PHÁP LUẬT & TRUY BẮT TỘI PHẠM]
// ---------------------------------------------------------------------------
class DrivablePoliceCruiser {
  constructor(scene) {
    window.drivablePoliceCruiser = this;
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.set(-58, 0.18, 40);
    this.mesh.rotation.order = 'YXZ';
    scene.add(this.mesh);

    this.velocity = 0;
    this.maxSpeed = 22.0;
    this.accel = 28.0;
    this.brake = 36.0;
    this.turnSpeed = 2.8;
    this.sirenActive = false;
    this.sirenTimer = 0;

    const blackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.6 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.2 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 });
    const darkGlass = new THREE.MeshStandardMaterial({ color: 0x0f172a, transparent: true, opacity: 0.75 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.9 });

    const nose = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 1.8), blackMat);
    nose.position.set(0, 0.75, 1.5);
    nose.castShadow = true;
    this.mesh.add(nose);

    const cabinMid = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.8), whiteMat);
    cabinMid.position.set(0, 0.75, -0.2);
    cabinMid.castShadow = true;
    this.mesh.add(cabinMid);

    const trunk = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.8, 1.4), blackMat);
    trunk.position.set(0, 0.75, -1.7);
    trunk.castShadow = true;
    this.mesh.add(trunk);

    const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.75, 2.2), whiteMat);
    cabinRoof.position.set(0, 1.5, -0.2);
    this.mesh.add(cabinRoof);

    const wsF = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.65, 0.1), darkGlass);
    wsF.position.set(0, 1.45, 0.92);
    wsF.rotation.x = 0.25;
    this.mesh.add(wsF);

    const wsR = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.65, 0.1), darkGlass);
    wsR.position.set(0, 1.45, -1.32);
    wsR.rotation.x = -0.25;
    this.mesh.add(wsR);

    const pushBar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 0.2), blackMat);
    pushBar.position.set(0, 0.7, 2.45);
    this.mesh.add(pushBar);

    const barFrame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.3), chromeMat);
    barFrame.position.set(0, 1.95, -0.2);
    this.mesh.add(barFrame);

    this.sirenRed = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.26), new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.8 }));
    this.sirenRed.position.set(-0.35, 1.98, -0.2);
    this.mesh.add(this.sirenRed);

    this.sirenBlue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.26), new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0284c7, emissiveIntensity: 0.8 }));
    this.sirenBlue.position.set(0.35, 1.98, -0.2);
    this.mesh.add(this.sirenBlue);

    this.wheels = [];
    const wGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 16);
    wGeo.rotateZ(Math.PI / 2);
    [[-1.15, 1.3], [1.15, 1.3], [-1.15, -1.3], [1.15, -1.3]].forEach(([wx, wz]) => {
      const w = new THREE.Mesh(wGeo, rubberMat);
      w.position.set(wx, 0.42, wz);
      this.mesh.add(w);
      this.wheels.push(w);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.29, 8), chromeMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(wx, 0.42, wz);
      this.mesh.add(rim);
    });

    this.promptSign = makeBillboardText('🚨 [E] LÁI XE CẢNH SÁT TUẦN TRA', '#38bdf8', 360, 48);
    this.promptSign.position.set(0, 2.8, 0);
    this.mesh.add(this.promptSign);
  }

  toggleMount() {
    gameState.isDrivingPolice = !gameState.isDrivingPolice;
    if (gameState.isDrivingPolice) {
      if (gameState.isDrivingForklift) gameState.isDrivingForklift = false;
      if (gameState.isDrivingPickup) gameState.isDrivingPickup = false;
      if (gameState.isDrivingTruck) gameState.isDrivingTruck = false;
      if (gameState.isDrivingSpeedboat) gameState.isDrivingSpeedboat = false;
      if (gameState.isDrivingHelicopter) gameState.isDrivingHelicopter = false;
      if (gameState.isDrivingTrain) gameState.isDrivingTrain = false;
      if (gameState.isDrivingFireEngine) gameState.isDrivingFireEngine = false;

      this.promptSign.visible = false;
      this.sirenActive = true;
      if (typeof sounds !== 'undefined' && sounds.playPoliceSiren) sounds.playPoliceSiren();
      showToast('🚨 ĐÃ LÊN XE CẢNH SÁT TUẦN TRA: [W/S] Tốc độ | [Space] Còi Siren | [F] Bắt tội phạm');
    } else {
      this.promptSign.visible = true;
      this.sirenActive = false;
      showToast('🚶 ĐÃ RỜI XE CẢNH SÁT');
    }
  }

  update(dt, playerPos) {
    const distToPlayer = playerPos ? playerPos.distanceTo(this.mesh.position) : 999;
    const promptEl = document.getElementById('vehicle-prompt-hud');
    const promptText = document.getElementById('vehicle-prompt-text');

    if (gameState.isDrivingPolice) {
      if (promptEl) {
        promptEl.classList.add('active');
        if (promptText) promptText.textContent = 'XUỐNG XE CẢNH SÁT [E] | [F] BẮT GIỮ';
      }
      this.promptSign.visible = false;

      let throttle = 0;
      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) throttle += 1;
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) throttle -= 1;

      let steer = 0;
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) steer += 1;
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) steer -= 1;

      if (keysPressed['Space']) {
        this.sirenActive = true;
        this.sirenTimer += dt;
        if (this.sirenTimer >= 0.5) {
          this.sirenTimer = 0;
          if (typeof sounds !== 'undefined' && sounds.playPoliceSiren) sounds.playPoliceSiren();
        }
      }

      if (throttle > 0) {
        this.velocity = Math.min(this.velocity + this.accel * dt, this.maxSpeed);
      } else if (throttle < 0) {
        this.velocity = Math.max(this.velocity - this.brake * dt, -this.maxSpeed * 0.45);
      } else {
        if (this.velocity > 0) this.velocity = Math.max(0, this.velocity - 14.0 * dt);
        else if (this.velocity < 0) this.velocity = Math.min(0, this.velocity + 14.0 * dt);
      }

      if (Math.abs(this.velocity) > 0.1) {
        const dir = this.velocity >= 0 ? 1 : -1;
        this.mesh.rotation.y += steer * this.turnSpeed * dt * dir;
      }

      // LOGIC NƯỚC: Xe lao xuống sông sâu sẽ sặc nước và chết máy
      const inRiver = (this.mesh.position.z >= 6.0 && this.mesh.position.z <= 26.0 && (this.mesh.position.x < 24.0 || this.mesh.position.x > 32.0));
      if (inRiver) {
        this.velocity *= 0.88;
        if (typeof spawnParticle === 'function' && Math.random() < 0.3) {
          spawnParticle(this.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 1.5)), 0xffffff); // Hơi nước bốc khói
        }
        if (Math.abs(this.velocity) > 1.0) {
          showToast('⚠️ XE ĐANG NGẬP NƯỚC! Động cơ chết máy vì ngập!');
        }
      }

      // LOGIC LỐP XE: Drift hoặc phanh gấp bắn khói ma sát cao su
      if (Math.abs(this.velocity) > 9.0 && Math.abs(steer) > 0.4) {
        if (typeof spawnParticle === 'function' && Math.random() < 0.4) {
          spawnParticle(this.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.4, 0.1, -1.2)), 0xd1d5db); // Khói lốp xe
        }
      }

      const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
      this.mesh.position.addScaledVector(forward, this.velocity * dt);
      this.mesh.position.x = Math.max(-130, Math.min(this.mesh.position.x, 160));
      this.mesh.position.z = Math.max(-130, Math.min(this.mesh.position.z, 200));

      this.wheels.forEach(w => w.rotateX(this.velocity * dt * 3.2));

      const flash = Math.sin(Date.now() * 0.02) > 0;
      this.sirenRed.material.emissiveIntensity = flash ? 1.5 : 0.1;
      this.sirenBlue.material.emissiveIntensity = !flash ? 1.5 : 0.1;

      if (keysPressed['KeyF'] && window.mpClient) {
        keysPressed['KeyF'] = false;
        let arrested = false;
        if (window.cityState && window.cityState.wantedPlayers) {
          for (const [wId, wData] of Object.entries(window.cityState.wantedPlayers)) {
            if (window.mpClient.remotePlayers.has(wId)) {
              const remote = window.mpClient.remotePlayers.get(wId);
              if (remote && remote.mesh.position.distanceTo(this.mesh.position) <= 7.0) {
                window.mpClient.sendPoliceArrest(wId);
                arrested = true;
                break;
              }
            }
          }
        }
        if (!arrested) {
          showToast('🔍 Đang tuần tra: Không có tội phạm bị truy nã trong cự ly 7m!');
        }
      }
    } else {
      if (!gameState.isDrivingPickup && !gameState.isDrivingForklift && !gameState.isDrivingTruck) {
        if (distToPlayer <= 4.0) {
          if (promptEl) {
            promptEl.classList.add('active');
            if (promptText) promptText.textContent = 'LÊN LÁI XE CẢNH SÁT [E]';
          }
        }
      }
      this.promptSign.visible = distToPlayer <= 8.0;
      this.sirenRed.material.emissiveIntensity = 0.2;
      this.sirenBlue.material.emissiveIntensity = 0.2;
    }
  }
}
window.DrivablePoliceCruiser = DrivablePoliceCruiser;

// ---------------------------------------------------------------------------
// 9b-3. XE CỨU HỎA KHẨN CẤP ĐÔ THỊ (DRIVABLE FIRE ENGINE TRUCK)
// [TỐC ĐỘ 17 M/S - BỒN NƯỚC CỨU HỎA & THANG CHỮA CHÁY - VÒI PHUN DẬP LỬA NƯỚC]
// ---------------------------------------------------------------------------
class DrivableFireEngine {
  constructor(scene) {
    window.drivableFireEngine = this;
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.set(70, 0.18, 40);
    this.mesh.rotation.order = 'YXZ';
    scene.add(this.mesh);

    this.velocity = 0;
    this.maxSpeed = 17.0;
    this.accel = 20.0;
    this.brake = 28.0;
    this.turnSpeed = 2.2;

    const fireRed = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.3 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.8, 5.8), fireRed);
    body.position.y = 1.35;
    body.castShadow = true;
    this.mesh.add(body);

    const ws = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 }));
    ws.position.set(0, 1.85, 2.45);
    this.mesh.add(ws);

    const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 4.8), chromeMat);
    ladder.position.set(0, 2.45, -0.4);
    this.mesh.add(ladder);

    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.22, 12), new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.9 }));
    beacon.position.set(0, 2.45, 2.0);
    this.mesh.add(beacon);

    this.wheels = [];
    const wGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.35, 16);
    wGeo.rotateZ(Math.PI / 2);
    [[-1.35, 1.8], [1.35, 1.8], [-1.35, -0.6], [1.35, -0.6], [-1.35, -2.0], [1.35, -2.0]].forEach(([wx, wz]) => {
      const w = new THREE.Mesh(wGeo, darkMat);
      w.position.set(wx, 0.5, wz);
      this.mesh.add(w);
      this.wheels.push(w);
    });

    this.promptSign = makeBillboardText('🚒 [E] LÁI XE CỨU HỎA KHẨN CẤP', '#ef4444', 360, 48);
    this.promptSign.position.set(0, 3.2, 0);
    this.mesh.add(this.promptSign);
  }

  toggleMount() {
    gameState.isDrivingFireEngine = !gameState.isDrivingFireEngine;
    if (gameState.isDrivingFireEngine) {
      if (gameState.isDrivingPolice) gameState.isDrivingPolice = false;
      if (gameState.isDrivingPickup) gameState.isDrivingPickup = false;
      if (gameState.isDrivingForklift) gameState.isDrivingForklift = false;
      if (gameState.isDrivingTruck) gameState.isDrivingTruck = false;
      if (gameState.isDrivingSpeedboat) gameState.isDrivingSpeedboat = false;
      if (gameState.isDrivingHelicopter) gameState.isDrivingHelicopter = false;
      if (gameState.isDrivingTrain) gameState.isDrivingTrain = false;

      this.promptSign.visible = false;
      showToast('🚒 ĐÃ LÊN XE CỨU HỎA KHẨN CẤP: [W/S] Tăng tốc | [Space] Phun vòi rồng dập lửa');
    } else {
      this.promptSign.visible = true;
      showToast('🚶 ĐÃ RỜI XE CỨU HỎA');
    }
  }

  update(dt, playerPos) {
    const distToPlayer = playerPos ? playerPos.distanceTo(this.mesh.position) : 999;
    const promptEl = document.getElementById('vehicle-prompt-hud');
    const promptText = document.getElementById('vehicle-prompt-text');

    if (gameState.isDrivingFireEngine) {
      if (promptEl) {
        promptEl.classList.add('active');
        if (promptText) promptText.textContent = 'XUỐNG XE CỨU HỎA [E] | [Space] PHUN NƯỚC';
      }
      this.promptSign.visible = false;

      let throttle = 0;
      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) throttle += 1;
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) throttle -= 1;

      let steer = 0;
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) steer += 1;
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) steer -= 1;

      if (keysPressed['Space']) {
        const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
        if (typeof spawnParticle === 'function') {
          for (let p = 0; p < 5; p++) {
            const spread = new THREE.Vector3((Math.random() - 0.5) * 0.8, 2.3 + (Math.random() - 0.5) * 0.4, 2.8 + p * 1.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
            const nozPos = this.mesh.position.clone().add(spread);
            spawnParticle(nozPos, 0x38bdf8);
          }
        }

        // Kiểm tra dập tắt đám cháy 911
        if (window.cityState && window.cityState.activeCrisis && window.cityState.activeCrisis.location) {
          const cLoc = new THREE.Vector3(window.cityState.activeCrisis.location.x, window.cityState.activeCrisis.location.y, window.cityState.activeCrisis.location.z);
          const distToFire = this.mesh.position.distanceTo(cLoc);
          if (distToFire <= 22.0) {
            this.sprayCooldown = (this.sprayCooldown || 0) - dt;
            if (this.sprayCooldown <= 0) {
              this.sprayCooldown = 0.35;
              if (window.mpClient) window.mpClient.sendCrisisExtinguish(20);
              if (typeof spawnFloatingText === 'function') {
                spawnFloatingText(cLoc.clone().add(new THREE.Vector3(0, 2.5, 0)), '-20 HP Hỏa Hoạn 💧', '#38bdf8');
              }
              if (typeof sounds !== 'undefined' && sounds.playWaterSplash) sounds.playWaterSplash();
            }
          }
        }
      }

      if (throttle > 0) {
        this.velocity = Math.min(this.velocity + this.accel * dt, this.maxSpeed);
      } else if (throttle < 0) {
        this.velocity = Math.max(this.velocity - this.brake * dt, -this.maxSpeed * 0.4);
      } else {
        if (this.velocity > 0) this.velocity = Math.max(0, this.velocity - 12.0 * dt);
        else if (this.velocity < 0) this.velocity = Math.min(0, this.velocity + 12.0 * dt);
      }

      if (Math.abs(this.velocity) > 0.1) {
        const dir = this.velocity >= 0 ? 1 : -1;
        this.mesh.rotation.y += steer * this.turnSpeed * dt * dir;
      }

      const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
      this.mesh.position.addScaledVector(forward, this.velocity * dt);
      this.mesh.position.x = Math.max(-130, Math.min(this.mesh.position.x, 160));
      this.mesh.position.z = Math.max(-130, Math.min(this.mesh.position.z, 200));

      this.wheels.forEach(w => w.rotateX(this.velocity * dt * 2.5));
    } else {
      if (!gameState.isDrivingPickup && !gameState.isDrivingPolice && !gameState.isDrivingForklift) {
        if (distToPlayer <= 4.2) {
          if (promptEl) {
            promptEl.classList.add('active');
            if (promptText) promptText.textContent = 'LÊN LÁI XE CỨU HỎA [E]';
          }
        }
      }
      this.promptSign.position.set(0, 3.4, 0);
      this.promptSign.visible = distToPlayer <= 8.5;
    }
  }
}
window.DrivableFireEngine = DrivableFireEngine;

// ---------------------------------------------------------------------------
// 9c. CA NÔ CAO TỐC ĐIỀU KHIỂN ĐƯỢC TRÊN SÔNG (DRIVABLE SPEEDBOAT)
// [TỐC ĐỘ 18 M/S - RẼ SÓNG ĐẠI DƯƠNG - HẠT NƯỚC RẼ SÓNG PHUN TRÀO]
// ---------------------------------------------------------------------------
class DrivableSpeedboat {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.set(16.5, 0.12, 14.0);
    this.mesh.rotation.order = 'YXZ';
    scene.add(this.mesh);

    this.velocity = 0;
    this.maxSpeed = 18.0;
    this.accel = 20.0;
    this.drag = 14.0;
    this.turnSpeed = 2.4;

    const hullMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.2, metalness: 0.5 });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 });

    // Đáy chữ V rẽ sóng
    const hull = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5.8, 4), hullMat);
    hull.rotation.x = Math.PI / 2;
    hull.rotation.y = Math.PI / 4;
    hull.scale.set(1.1, 1.0, 0.45);
    hull.position.set(0, 0.18, 0.4);
    hull.castShadow = true;
    this.mesh.add(hull);

    // Boong tàu trắng
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 4.2), deckMat);
    deck.position.set(0, 0.4, 0);
    this.mesh.add(deck);

    // Kính chắn gió cong
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 0.1), glassMat);
    windshield.position.set(0, 0.85, 0.6);
    this.mesh.add(windshield);

    // Ghế lái bọc da cam nổi bật
    [-0.45, 0.45].forEach(sx => {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), seatMat);
      seat.position.set(sx, 0.65, 0.1);
      this.mesh.add(seat);
    });

    // Động cơ gắn ngoài mạ chrome (Outboard Motor)
    const motor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.6), chromeMat);
    motor.position.set(0, 0.5, -2.2);
    this.mesh.add(motor);

    this.promptSign = makeBillboardText('🚤 [E] LÁI CA NÔ CAO TỐC', '#06b6d4', 340, 48);
    this.promptSign.position.set(0, 2.6, 0);
    this.mesh.add(this.promptSign);
  }

  toggleMount() {
    gameState.isDrivingSpeedboat = !gameState.isDrivingSpeedboat;
    if (gameState.isDrivingSpeedboat) {
      if (gameState.isDrivingForklift) gameState.isDrivingForklift = false;
      if (gameState.isDrivingPickup) gameState.isDrivingPickup = false;
      sounds.playEngineIgnition();
      this.promptSign.visible = false;
      showToast('🚤 ĐÃ LÊN CA NÔ TỐC ĐỘ CAO: [W/S] Tốc độ 18 m/s | [A/D] Lái | [E] Cập bến');
    } else {
      this.velocity = 0;
      this.promptSign.visible = true;
      showToast('🚶 ĐÃ LÊN BỜ XUỐNG CA NÔ');
    }
  }

  update(dt, time, playerPos) {
    const distToPlayer = playerPos ? playerPos.distanceTo(this.mesh.position) : 999;
    const promptEl = document.getElementById('vehicle-prompt-hud');
    const promptText = document.getElementById('vehicle-prompt-text');

    if (gameState.isDrivingSpeedboat) {
      if (promptEl) {
        promptEl.classList.add('active');
        if (promptText) promptText.textContent = 'XUỐNG CA NÔ [E]';
      }
      this.promptSign.visible = false;

      let throttle = 0;
      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) throttle += 1;
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) throttle -= 1;

      let steer = 0;
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) steer += 1;
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) steer -= 1;

      if (throttle !== 0) {
        this.velocity += throttle * this.accel * dt;
        this.velocity = Math.max(-this.maxSpeed * 0.3, Math.min(this.velocity, this.maxSpeed));
      } else {
        if (Math.abs(this.velocity) > 0.1) {
          const sign = Math.sign(this.velocity);
          this.velocity -= sign * this.drag * dt;
          if (Math.sign(this.velocity) !== sign) this.velocity = 0;
        } else {
          this.velocity = 0;
        }
      }

      if (Math.abs(this.velocity) > 0.1) {
        this.mesh.rotation.y += steer * this.turnSpeed * dt * Math.sign(this.velocity);
        // Nghiêng thân tàu vào khúc cua (Bank Angle)
        this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, -steer * 0.22, dt * 5.0);
      } else {
        this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, dt * 4.0);
      }

      const forward = new THREE.Vector3(0, 0, 1).applyEuler(this.mesh.rotation);
      this.mesh.position.addScaledVector(forward, this.velocity * dt);

      // Điều tần âm thanh động cơ theo dải ga
      if (typeof sounds !== 'undefined' && sounds.updateEngineThrottle) {
        sounds.updateEngineThrottle(Math.abs(this.velocity) / this.maxSpeed);
      }

      // Giữ ca nô chạy trong lòng sông / biển
      // Giữ ca nô chạy trong lòng sông / biển và dội lại khi va vào bờ kè đá
      if (this.mesh.position.z <= 5.2 || this.mesh.position.z >= 26.8) {
        this.velocity *= -0.35; // Nảy ngược lại khi va bờ kè
        if (typeof spawnParticle === 'function') spawnParticle(this.mesh.position, 0x38bdf8);
      }
      this.mesh.position.x = Math.max(-120, Math.min(this.mesh.position.x, 160));
      this.mesh.position.z = Math.max(5.0, Math.min(this.mesh.position.z, 27.0));

      // Nhấp nhô sóng nước
      const waveBob = Math.sin(time * 4.0) * 0.05 + (this.velocity / this.maxSpeed) * 0.12;
      this.mesh.position.y = 0.12 + waveBob;
      this.mesh.rotation.x = (this.velocity / this.maxSpeed) * 0.14; // Mũi ngóc lên khi vít ga

      // Hạt rẽ sóng trắng xóa (Water Spray Particles)
      if (Math.abs(this.velocity) > 4.0 && Math.random() < 0.45) {
        if (typeof spawnParticle === 'function') {
          const wakePos = this.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.05, -2.2));
          spawnParticle(wakePos, 0xe0f2fe);
        }
      }
    } else {
      // Nhấp nhô nhẹ nhàng khi neo đậu ở bến
      this.mesh.position.y = 0.12 + Math.sin(time * 2.2) * 0.04;
      this.mesh.rotation.z = Math.sin(time * 1.5) * 0.03;
      if (!gameState.isDrivingForklift && !gameState.isDrivingPickup) {
        if (distToPlayer <= 4.0) {
          if (promptEl) {
            promptEl.classList.add('active');
            if (promptText) promptText.textContent = 'LÊN LÁI CA NÔ [E]';
          }
        }
      }
      this.promptSign.visible = distToPlayer <= 8.0;
    }

    const isNight = (typeof gameState !== 'undefined') && (gameState.gameHour < 5.5 || gameState.gameHour > 18.5);
    if (this.headlightBeams) {
      this.headlightBeams.forEach(b => b.visible = isNight);
    }
  }
}
window.DrivableSpeedboat = DrivableSpeedboat;

// ---------------------------------------------------------------------------
// 9d. SIÊU MÁY BAY CHỞ HÀNG BOEING 747 TẠI SÂN BAY QUỐC TẾ (AIRPORT JET CARGO)
// ---------------------------------------------------------------------------
class AirportBoeingJet {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.set(-8, 0.3, 185);
    scene.add(this.mesh);

    this.state = 'PARKED'; // PARKED, SPOOLING, TAKEOFF, CLIMBING, CIRCLING
    this.speed = 0;
    this.timer = 0;

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.1 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.3 });
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.2 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 });

    // 1. Thân máy bay phản lực dài 18m
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.4, 18.0, 16), bodyMat);
    fuselage.rotation.z = Math.PI / 2;
    fuselage.position.set(0, 2.2, 0);
    fuselage.castShadow = true;
    this.mesh.add(fuselage);

    // Mũi máy bay vát nhọn
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.2, 16), bodyMat);
    nose.rotation.z = -Math.PI / 2;
    nose.position.set(10.6, 2.2, 0);
    this.mesh.add(nose);

    // Kính buồng lái phi công
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.6), glassMat);
    cockpit.position.set(8.8, 3.0, 0);
    this.mesh.add(cockpit);

    // 2. Cánh chính sải rộng 22m (Swept Wings)
    const wingGeo = new THREE.BoxGeometry(5.2, 0.22, 22.0);
    const wings = new THREE.Mesh(wingGeo, bodyMat);
    wings.position.set(1.2, 2.0, 0);
    wings.rotation.y = -0.15;
    wings.castShadow = true;
    this.mesh.add(wings);

    // 4 Động cơ phản lực cánh quạt (Turbofan Engines)
    this.engines = [];
    [-6.8, -3.4, 3.4, 6.8].forEach(ez => {
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.6, 2.8, 12), engineMat);
      eng.rotation.z = Math.PI / 2;
      eng.position.set(1.5, 1.1, ez);
      eng.castShadow = true;
      this.mesh.add(eng);
      this.engines.push(eng);
    });

    // 3. Đuôi máy bay đứng (Tail Fin) & Cánh thăng bằng ngang
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 4.2, 0.25), blueMat);
    tailFin.position.set(-8.2, 4.6, 0);
    tailFin.rotation.z = 0.35;
    this.mesh.add(tailFin);

    const hStab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 7.8), bodyMat);
    hStab.position.set(-8.0, 3.2, 0);
    this.mesh.add(hStab);

    // Đèn chớp dẫn đường hàng không (Aviation Strobe Lights)
    this.strobeLight = new THREE.PointLight(0xef4444, 2.0, 15);
    this.strobeLight.position.set(-8.2, 6.8, 0);
    this.mesh.add(this.strobeLight);
  }

  dispatchFlight() {
    if (this.state !== 'PARKED') return false;
    this.state = 'SPOOLING';
    this.timer = 0;
    this.speed = 0;
    sounds.playTruckHorn(); // Còi hiệu sân bay
    showToast('✈️ BOEING 747 BẬT ĐỘNG CƠ PHẢN LỰC: ĐANG TĂNG TỐC CẤT CÁNH!');
    return true;
  }

  update(dt) {
    this.timer += dt;
    this.strobeLight.intensity = Math.sin(this.timer * 6.0) > 0 ? 3.0 : 0.0;

    if (this.state === 'SPOOLING') {
      if (this.timer > 1.8) {
        this.state = 'TAKEOFF';
        this.speed = 4.0;
      }
      if (typeof spawnParticle === 'function' && Math.random() < 0.4) {
        spawnParticle(this.mesh.position.clone().add(new THREE.Vector3(-2, 1, 0)), 0x94a3b8);
      }
    } else if (this.state === 'TAKEOFF') {
      this.speed += dt * 24.0;
      this.mesh.position.x += this.speed * dt;
      if (this.mesh.position.x > 35) {
        this.state = 'CLIMBING';
      }
    } else if (this.state === 'CLIMBING') {
      this.speed += dt * 12.0;
      this.mesh.position.x += this.speed * dt;
      this.mesh.position.y += dt * 14.0;
      this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, -0.22, dt * 2.0); // Ngóc đầu bay lên
      if (this.mesh.position.y > 45) {
        this.state = 'CIRCLING';
      }
    } else if (this.state === 'CIRCLING') {
      this.mesh.position.x += this.speed * dt * 0.7;
      if (this.mesh.position.x > 220) {
        // Hoàn tất chuyến bay, reset về đường băng
        this.state = 'PARKED';
        this.mesh.position.set(-8, 0.3, 185);
        this.mesh.rotation.set(0, 0, 0);
        this.speed = 0;
      }
    }
  }
}
window.AirportBoeingJet = AirportBoeingJet;

// ---------------------------------------------------------------------------
// 9e. TRỰC THĂNG DU LỊCH VIP CẤT CÁNH BAY TỰ DO (DRIVABLE LUXURY HELICOPTER)
// [BAY LƯỢN 3D TỰ DO TRÊN BẦU TRỜI - NGẮM TOÀN CẢNH ĐẾ CHẾ - HIỆU ỨNG GIÓ XOÁY]
// ---------------------------------------------------------------------------
class DrivableHelicopter {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.set(55.0, 0.25, 52.0);
    this.mesh.rotation.order = 'YXZ';
    scene.add(this.mesh);

    this.velocity = new THREE.Vector3();
    this.speed = 0;
    this.maxSpeed = 22.0;
    this.altitude = 0.25;
    this.maxAltitude = 55.0;
    this.isFlying = false;
    this.rotorRpm = 0;
    this.rotorTimer = 0;

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.5 }); // Xanh đen sang trọng
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 }); // Viền vàng hoàng gia
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7, roughness: 0.1 });

    // 1. Thân buồng lái khí động học (Cockpit Fuselage)
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 3.8), bodyMat);
    cabin.position.set(0, 1.35, 0.4);
    cabin.castShadow = true;
    this.mesh.add(cabin);

    // Mũi kính cong toàn cảnh (Panoramic Canopy Glass)
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.8, 4), glassMat);
    canopy.rotation.x = Math.PI / 2;
    canopy.rotation.y = Math.PI / 4;
    canopy.position.set(0, 1.35, 2.8);
    this.mesh.add(canopy);

    // Kính chắn gió bên
    [-1.12, 1.12].forEach(sx => {
      const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), glassMat);
      sideGlass.rotation.y = (sx > 0 ? -Math.PI / 2 : Math.PI / 2);
      sideGlass.position.set(sx, 1.45, 0.5);
      this.mesh.add(sideGlass);
    });

    // Cánh đuôi dài & Đuôi lái chữ T (Tail Boom & Fin)
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 4.8, 8), bodyMat);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 1.65, -3.6);
    this.mesh.add(boom);

    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.8), goldMat);
    fin.position.set(0, 2.2, -5.8);
    fin.rotation.x = 0.35;
    this.mesh.add(fin);

    // 2. Chân càng đáp ống thép (Landing Skids)
    this.skids = new THREE.Group();
    [-0.95, 0.95].forEach(kx => {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.4, 8), chromeMat);
      skid.rotation.x = Math.PI / 2;
      skid.position.set(kx, 0.08, 0.3);
      this.skids.add(skid);

      // Càng nối
      [-0.9, 1.1].forEach(kz => {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), chromeMat);
        strut.position.set(kx, 0.45, kz);
        strut.rotation.z = (kx > 0 ? 0.3 : -0.3);
        this.skids.add(strut);
      });
    });
    this.mesh.add(this.skids);

    // 3. Trục cánh quạt chính & 4 cánh quạt quay tít (Main Rotor)
    this.mainRotor = new THREE.Group();
    this.mainRotor.position.set(0, 2.45, 0.6);
    this.mesh.add(this.mainRotor);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8), chromeMat);
    mast.position.y = -0.2;
    this.mainRotor.add(mast);

    // Đĩa cánh quạt xoay
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 4.2), chromeMat);
      blade.rotation.y = (i * Math.PI) / 2;
      blade.position.set(0, 0, 2.0).applyAxisAngle(new THREE.Vector3(0, 1, 0), (i * Math.PI) / 2);
      this.mainRotor.add(blade);
    }

    // Đĩa mờ khi quay nhanh (Rotor Blur Disc)
    this.rotorDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.2, 0.02, 16),
      new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.0 })
    );
    this.mainRotor.add(this.rotorDisc);

    // Cánh quạt đuôi chống xoay (Tail Rotor)
    this.tailRotor = new THREE.Group();
    this.tailRotor.position.set(0.15, 2.5, -5.9);
    this.mesh.add(this.tailRotor);

    const tBlade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.02), goldMat);
    this.tailRotor.add(tBlade);

    // Đèn chớp cảnh báo hàng không trên nóc
    this.strobeLight = new THREE.PointLight(0xef4444, 2.5, 18);
    this.strobeLight.position.set(0, 2.8, 0.6);
    this.mesh.add(this.strobeLight);

    // Đèn pha rọi đường ban đêm dưới mũi
    this.headLight = new THREE.SpotLight(0xfef08a, 4.0, 45, Math.PI / 4, 0.4);
    this.headLight.position.set(0, 0.8, 2.5);
    this.headLight.target.position.set(0, -5.0, 10.0);
    this.mesh.add(this.headLight);
    this.mesh.add(this.headLight.target);

    this.promptSign = makeBillboardText('🚁 [E] LÁI TRỰC THĂNG DU LỊCH', '#38bdf8', 360, 48);
    this.promptSign.position.set(0, 3.4, 0);
    this.mesh.add(this.promptSign);
  }

  toggleMount() {
    gameState.isDrivingHelicopter = !gameState.isDrivingHelicopter;
    if (gameState.isDrivingHelicopter) {
      if (window.player) {
        window.player.isOnRooftop = false;
      }
      if (gameState.isDrivingForklift) gameState.isDrivingForklift = false;
      if (gameState.isDrivingPickup) gameState.isDrivingPickup = false;
      if (gameState.isDrivingSpeedboat) gameState.isDrivingSpeedboat = false;
      if (gameState.isDrivingTrain) gameState.isDrivingTrain = false;
      if (typeof sounds !== 'undefined' && sounds.playEngineIgnition) sounds.playEngineIgnition();
      this.promptSign.visible = false;
      gameState.heliFlights = (gameState.heliFlights || 0) + 1;
      showToast('🚁 ĐÃ LÊN TRỰC THĂNG: [Space] Bay lên | [Shift] Hạ cánh trên nóc/mặt đất | [W/S/A/D] Lái | [E] Rời buồng lái');
    } else {
      this.promptSign.visible = true;
      const roofH = typeof getBuildingRoofHeightAt === 'function' ? getBuildingRoofHeightAt(this.mesh.position.x, this.mesh.position.z) : 0.0;
      if (roofH > 2.0) {
        // Đậu trực thăng trên nóc cao ốc - GIỮ NGUYÊN ĐỘ CAO TRÊN NÓC NHÀ!
        this.altitude = roofH + 0.25;
        this.mesh.position.y = this.altitude;
        if (window.player && window.player.mesh) {
          window.player.isOnRooftop = true;
          window.player.rooftopHeight = roofH;
          window.player.mesh.position.set(this.mesh.position.x + 2.4, roofH + 0.05, this.mesh.position.z);
        }
        showToast('🏢 BẠN ĐÃ HẠ CÁNH AN TOÀN TRÊN TẦNG THƯỢNG CAO ỐC! Bấm [E] gần trực thăng để cất cánh lại.');
      } else {
        this.altitude = 0.25;
        this.mesh.position.y = 0.25;
        if (window.player && window.player.mesh) {
          window.player.isOnRooftop = false;
          window.player.rooftopHeight = 0;
          window.player.mesh.position.set(this.mesh.position.x + 2.4, 0.0, this.mesh.position.z);
        }
        showToast('🚶 ĐÃ HẠ CÁNH & RỜI TRỰC THĂNG');
      }
    }
  }

  update(dt, time, playerPos) {
    const distToPlayer = playerPos ? playerPos.distanceTo(this.mesh.position) : 999;
    const promptEl = document.getElementById('vehicle-prompt-hud');
    const promptText = document.getElementById('vehicle-prompt-text');

    if (gameState.isDrivingHelicopter) {
      if (promptEl) {
        promptEl.classList.add('active');
        if (promptText) promptText.textContent = 'HẠ CÁNH & XUỐNG MÁY BAY [E]';
      }
      this.promptSign.visible = false;

      // Khởi động & duy trì vòng quay cánh quạt
      this.rotorRpm = THREE.MathUtils.lerp(this.rotorRpm, 32.0, dt * 2.5);
      this.rotorDisc.material.opacity = Math.min(0.4, (this.rotorRpm / 32.0) * 0.4);

      // Âm thanh cánh quạt
      this.rotorTimer += dt;
      if (this.rotorTimer >= 0.18) {
        this.rotorTimer = 0;
        sounds.playHelicopterRotor();
      }

      // 1. Kiểm tra độ cao nóc nhà bên dưới trực thăng
      const underRoofHeight = typeof getBuildingRoofHeightAt === 'function' ? getBuildingRoofHeightAt(this.mesh.position.x, this.mesh.position.z) : 0.0;
      const minAllowAltitude = underRoofHeight > 2.0 ? (underRoofHeight + 0.25) : 0.25;

      // Điều khiển độ cao [Space: Lên] / [Shift: Xuống]
      let climb = 0;
      if (keysPressed['Space']) climb += 1;
      if (keysPressed['ShiftLeft'] || keysPressed['ShiftRight'] || keysPressed['KeyC']) climb -= 1;

      this.altitude += climb * 12.0 * dt;
      this.altitude = Math.max(minAllowAltitude, Math.min(this.altitude, this.maxAltitude));
      this.mesh.position.y = this.altitude;

      // Điều khiển bay tiến/lùi & rẽ hướng
      let throttle = 0;
      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) throttle += 1;
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) throttle -= 1;

      let steer = 0;
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) steer += 1;
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) steer -= 1;

      this.speed = THREE.MathUtils.lerp(this.speed, throttle * this.maxSpeed, dt * 3.0);
      this.mesh.rotation.y += steer * 1.8 * dt;

      // Nghiêng thân trực thăng khi bay (Pitch & Roll Banking)
      const targetPitch = (this.speed / this.maxSpeed) * 0.28;
      const targetRoll = -steer * 0.22;
      this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, targetPitch, dt * 4.0);
      this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, targetRoll, dt * 4.0);

      // 2. Dự báo vị trí tiếp theo & Kiểm tra va đập tường kính tòa nhà
      const forward = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(0, this.mesh.rotation.y, 0));
      const nextX = this.mesh.position.x + forward.x * this.speed * dt;
      const nextZ = this.mesh.position.z + forward.z * this.speed * dt;

      let wallCollision = false;
      if (window.CITY_BUILDING_COLLIDERS) {
        for (let bi = 0; bi < window.CITY_BUILDING_COLLIDERS.length; bi++) {
          const b = window.CITY_BUILDING_COLLIDERS[bi];
          // Nếu nằm trong mặt bằng tòa nhà
          if (nextX >= (b.minX - 1.2) && nextX <= (b.maxX + 1.2) && nextZ >= (b.minZ - 1.2) && nextZ <= (b.maxZ + 1.2)) {
            // Nếu độ cao trực thăng THẤP HƠN nóc tòa nhà -> Va vào tường!
            if (this.altitude < (b.height - 0.4)) {
              wallCollision = true;
              break;
            }
          }
        }
      }

      if (wallCollision) {
        // Bật ngược lại, giảm tốc độ và rung lắc
        this.speed = -this.speed * 0.45;
        if (typeof cameraShakeTimer !== 'undefined') {
          cameraShakeTimer = 0.24;
          cameraShakeIntensity = 0.65;
        }
        if (typeof spawnParticle === 'function') {
          spawnParticle(this.mesh.position, 0xfacc15); // Tia lửa kim loại
          spawnParticle(this.mesh.position, 0xf97316);
        }
        if (typeof sounds !== 'undefined' && sounds.playSaw) sounds.playSaw();
        showToast('⚠️ VA CHẠM TƯỜNG CAO ỐC! Hãy nâng độ cao [Space] để bay qua nóc nhà!');
      } else {
        this.mesh.position.x = nextX;
        this.mesh.position.z = nextZ;
      }

      // Giới hạn trong không phận đế chế
      this.mesh.position.x = Math.max(-180, Math.min(this.mesh.position.x, 180));
      this.mesh.position.z = Math.max(-135, Math.min(this.mesh.position.z, 200));

      // Hiệu ứng gió xoáy thổi bọt nước hoặc bụi cỏ khi bay thấp (Downwash Vortex)
      if (this.altitude < 14.0 && Math.random() < 0.45) {
        if (typeof spawnParticle === 'function') {
          const ringRad = 2.5 + Math.random() * 2.0;
          const a = Math.random() * Math.PI * 2;
          const dustPos = new THREE.Vector3(
            this.mesh.position.x + Math.cos(a) * ringRad,
            0.15,
            this.mesh.position.z + Math.sin(a) * ringRad
          );
          spawnParticle(dustPos, this.mesh.position.z > 4 && this.mesh.position.z < 28 ? 0xe0f2fe : 0xd1d5db);
        }
      }
    } else {
      // Khi không lái: cánh quạt quay chậm dần rồi dừng hẳn
      this.rotorRpm = THREE.MathUtils.lerp(this.rotorRpm, 0, dt * 1.2);
      this.rotorDisc.material.opacity = 0;
      this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, 0, dt * 4.0);
      this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, dt * 4.0);
      // GIỮ VỮNG ĐỘ CAO TRỰC THĂNG ĐẬU TRÊN NÓC NHÀ (KHÔNG BỊ TỤT XUỐNG ĐẤT!)
      this.mesh.position.y = this.altitude;

      if (!gameState.isDrivingForklift && !gameState.isDrivingPickup && !gameState.isDrivingSpeedboat) {
        if (distToPlayer <= 4.5) {
          if (promptEl) {
            promptEl.classList.add('active');
            if (promptText) promptText.textContent = 'LÊN LÁI TRỰC THĂNG [E]';
          }
        }
      }
      this.promptSign.visible = distToPlayer <= 8.5;
    }

    // Quay cánh quạt
    this.mainRotor.rotation.y += this.rotorRpm * dt * 12.0;
    this.tailRotor.rotation.x += this.rotorRpm * dt * 16.0;
    this.strobeLight.intensity = Math.sin(time * 6.0) > 0.4 ? 2.5 : 0;
  }
}
window.DrivableHelicopter = DrivableHelicopter;

// ---------------------------------------------------------------------------
// 9f. ĐOÀN TÀU HỎA HƠI NƯỚC XUYÊN LỤC ĐỊA (TRANSCONTINENTAL STEAM TRAIN SYSTEM)
// [ĐẦU MÁY HƠI NƯỚC CỔ ĐIỂN - 4 TOA HÀNG - PÍT-TÔNG ĐỘNG HỌC & CÒI TÀU VANG DỘI]
// ---------------------------------------------------------------------------
class SteamTrainSystem {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    scene.add(this.mesh);

    // Tuyến đường ray khép kín đồng bộ 100% với đường ray 3D thực tế
    this.curve = window.railroadCurve || new THREE.CatmullRomCurve3([
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

    this.progress = 0;
    this.speed = 11.5;
    this.smokeTimer = 0;
    this.whistleTimer = 0;
    this.driveWheelAngle = 0;

    const blackSteelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.8 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 });

    // 1. ĐẦU MÁY XE LỬA HƠI NƯỚC (STEAM LOCOMOTIVE)
    this.locomotive = new THREE.Group();
    this.mesh.add(this.locomotive);

    // Nồi hơi xi lanh đen bóng (Boiler)
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 6.2, 16), blackSteelMat);
    boiler.rotation.x = Math.PI / 2;
    boiler.position.set(0, 1.85, 1.2);
    this.locomotive.add(boiler);

    // 3 Vành đai đồng thau nẹp nồi hơi
    [-1.0, 1.0, 2.8].forEach(bz => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.04, 8, 16), brassMat);
      ring.position.set(0, 1.85, bz);
      this.locomotive.add(ring);
    });

    // Ống khói hơi nước (Smokestack)
    const smokestack = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.26, 1.4, 12), blackSteelMat);
    smokestack.position.set(0, 3.4, 3.2);
    this.locomotive.add(smokestack);

    // Chóp vòm hơi nước & Còi hơi (Steam Dome & Whistle)
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), brassMat);
    dome.position.set(0, 3.1, 1.4);
    this.locomotive.add(dome);

    // Đèn pha lồng kính lớn phát sáng ấm (Lantern Headlight)
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.6, 12), brassMat);
    lantern.rotation.x = Math.PI / 2;
    lantern.position.set(0, 2.2, 4.4);
    this.locomotive.add(lantern);

    const lightBulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
    lightBulb.position.set(0, 2.2, 4.65);
    this.locomotive.add(lightBulb);

    // Thanh gạt chướng ngại vật trước mũi tàu (Cowcatcher)
    const cowcatcher = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.4, 4), redMat);
    cowcatcher.rotation.x = -Math.PI / 2;
    cowcatcher.rotation.y = Math.PI / 4;
    cowcatcher.position.set(0, 0.7, 4.6);
    this.locomotive.add(cowcatcher);

    // Buồng lái tài xế (Driver Cab)
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 2.4), redMat);
    cab.position.set(0, 2.3, -2.4);
    cab.castShadow = true;
    this.locomotive.add(cab);

    // 6 Bánh xe truyền động lớn bằng thép (Drive Wheels)
    this.wheels = [];
    [-1.35, 1.35].forEach(wx => {
      [-0.4, 1.4, 3.2].forEach(wz => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.22, 16), blackSteelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.85, wz);
        this.locomotive.add(wheel);
        this.wheels.push(wheel);

        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.26, 8), brassMat);
        hub.rotation.z = Math.PI / 2;
        hub.position.set(wx, 0.85, wz);
        this.locomotive.add(hub);
      });
    });

    // Thanh truyền động pít-tông (Side Connecting Rod)
    this.sideRods = [];
    [-1.48, 1.48].forEach(rx => {
      const rod = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 4.2), brassMat);
      rod.position.set(rx, 0.55, 1.4);
      this.locomotive.add(rod);
      this.sideRods.push(rod);
    });

    // 2. CÁC TOA HÀNG KÉO THEO (TRAIN CARS)
    this.cars = [];
    const carConfigs = [
      { offset: 0.042, type: 'tender' },
      { offset: 0.084, type: 'logs' },
      { offset: 0.126, type: 'gold' },
      { offset: 0.168, type: 'container' }
    ];

    carConfigs.forEach(cfg => {
      const carGroup = new THREE.Group();
      this.mesh.add(carGroup);

      const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 5.8), blackSteelMat);
      chassis.position.y = 0.85;
      chassis.castShadow = true;
      carGroup.add(chassis);

      // Bánh xe toa hàng
      [-1.3, 1.3].forEach(cx => {
        [-1.8, -0.6, 0.6, 1.8].forEach(cz => {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.18, 12), blackSteelMat);
          w.rotation.z = Math.PI / 2;
          w.position.set(cx, 0.45, cz);
          carGroup.add(w);
        });
      });

      if (cfg.type === 'tender') {
        // Toa than đá
        const tenderBox = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.4, 5.2), blackSteelMat);
        tenderBox.position.y = 1.65;
        carGroup.add(tenderBox);

        const coal = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 }));
        coal.scale.set(1.4, 0.6, 2.2);
        coal.position.set(0, 2.3, 0);
        carGroup.add(coal);
      } else if (cfg.type === 'logs') {
        // Toa chở gỗ tròn
        for (let i = 0; i < 6; i++) {
          const log = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 5.2, 10), woodMat);
          log.rotation.x = Math.PI / 2;
          log.position.set((i % 2 === 0 ? -0.5 : 0.5), 1.5 + Math.floor(i / 2) * 0.7, 0);
          carGroup.add(log);
        }
      } else if (cfg.type === 'gold') {
        // Toa chở thỏi vàng hoàng gia lấp lánh
        const vault = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 5.4), redMat);
        vault.position.y = 1.45;
        carGroup.add(vault);

        for (let g = 0; g < 8; g++) {
          const goldBar = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.35, 1.2), brassMat);
          goldBar.position.set((g % 2 === 0 ? -0.45 : 0.45), 2.15, -1.8 + Math.floor(g / 2) * 1.3);
          carGroup.add(goldBar);
        }
      } else if (cfg.type === 'container') {
        // Toa container hàng hải xanh dương
        const cBox = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.8, 5.4), new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 }));
        cBox.position.y = 1.95;
        carGroup.add(cBox);
      }

      this.cars.push({ group: carGroup, offset: cfg.offset });
    });

    this.promptSign = makeBillboardText('🚂 [E] LÁI ĐẦU MÁY XE LỬA', '#facc15', 360, 48);
    this.promptSign.position.set(0, 4.2, 0);
    this.locomotive.add(this.promptSign);
  }

  toggleMount() {
    gameState.isDrivingTrain = !gameState.isDrivingTrain;
    if (gameState.isDrivingTrain) {
      if (gameState.isDrivingForklift) gameState.isDrivingForklift = false;
      if (gameState.isDrivingPickup) gameState.isDrivingPickup = false;
      if (gameState.isDrivingSpeedboat) gameState.isDrivingSpeedboat = false;
      if (gameState.isDrivingHelicopter) gameState.isDrivingHelicopter = false;
      sounds.playTrainWhistle();
      this.promptSign.visible = false;
      gameState.trainRides = (gameState.trainRides || 0) + 1;
      showToast('🚂 ĐÃ LÊN BUỒNG LÁI TÀU HỎA: [W/S] Tăng tốc / Thắng | [Space] Kéo còi | [E] Xuống tàu');
    } else {
      this.promptSign.visible = true;
      showToast('🚶 ĐÃ RỜI BUỒNG LÁI TÀU HỎA');
    }
  }

  update(dt, time, playerPos) {
    const distToPlayer = playerPos ? playerPos.distanceTo(this.locomotive.position) : 999;
    const promptEl = document.getElementById('vehicle-prompt-hud');
    const promptText = document.getElementById('vehicle-prompt-text');

    if (gameState.isDrivingTrain) {
      if (promptEl) {
        promptEl.classList.add('active');
        if (promptText) promptText.textContent = 'XUỐNG TÀU HỎA [E]';
      }
      this.promptSign.visible = false;

      let throttle = 0;
      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) throttle += 1;
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) throttle -= 1;
      if (keysPressed['Space']) sounds.playTrainWhistle();

      this.speed = THREE.MathUtils.lerp(this.speed, (1.0 + throttle * 0.8) * 12.0, dt * 2.0);
    } else {
      this.speed = 10.5; // Chạy tuần hoàn tự động
      if (!gameState.isDrivingForklift && !gameState.isDrivingPickup && !gameState.isDrivingSpeedboat && !gameState.isDrivingHelicopter) {
        if (distToPlayer <= 4.5) {
          if (promptEl) {
            promptEl.classList.add('active');
            if (promptText) promptText.textContent = 'LÊN LÁI TÀU HỎA [E]';
          }
        }
      }
      this.promptSign.visible = distToPlayer <= 8.5;
    }

    // Kinh tế tuần hoàn: Đốt viên nén gỗ sinh học (Wood Pellets) x1.4 tốc độ & nhận cổ tức định kỳ
    if ((gameState.woodPellets || 0) > 0) {
      this.speed *= 1.4;
      this.pelletBurnTimer = (this.pelletBurnTimer || 0) + dt;
      if (this.pelletBurnTimer >= 45.0) {
        this.pelletBurnTimer = 0;
        gameState.woodPellets--;
        const div = 600;
        gameState.money += div;
        if (typeof sounds !== 'undefined' && sounds.playCoin) sounds.playCoin();
        if (typeof spawnFloatingText === 'function') {
          spawnFloatingText(this.locomotive.position.clone().add(new THREE.Vector3(0, 3, 0)), `+$${div} Cổ Tức Tàu Hỏa Viên Nén 🚂`, '#4ade80');
        }
        if (typeof updateHUD === 'function') updateHUD();
      }
    }

    // Di chuyển dọc đường ray cong khép kín
    const curveLen = this.curve.getLength();
    this.progress = (this.progress + (this.speed * dt) / curveLen) % 1.0;

    // Vị trí & Hướng đầu máy
    const pos = this.curve.getPointAt(this.progress);
    const tangent = this.curve.getTangentAt(this.progress);
    this.locomotive.position.copy(pos);
    this.locomotive.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

    // Quay bánh xe & Thanh truyền pít-tông
    this.driveWheelAngle += (this.speed * dt) / 0.85;
    this.wheels.forEach(w => w.rotation.x = this.driveWheelAngle);
    this.sideRods.forEach(r => {
      r.position.y = 0.85 + Math.sin(this.driveWheelAngle) * 0.35;
      r.position.z = 1.4 + Math.cos(this.driveWheelAngle) * 0.35;
    });

    // Cập nhật các toa hàng phía sau
    this.cars.forEach(car => {
      const carProg = (this.progress - car.offset + 1.0) % 1.0;
      const cPos = this.curve.getPointAt(carProg);
      const cTan = this.curve.getTangentAt(carProg);
      car.group.position.copy(cPos);
      car.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), cTan);
    });

    // Phụt khói hơi nước trắng bốc lên cuồn cuộn từ ống khói (Steam Puffs)
    this.smokeTimer += dt;
    if (this.smokeTimer >= 0.16) {
      this.smokeTimer = 0;
      sounds.playTrainChuff();
      if (typeof spawnParticle === 'function') {
        const stackWorld = new THREE.Vector3(0, 3.8, 3.2).applyQuaternion(this.locomotive.quaternion).add(this.locomotive.position);
        spawnParticle(stackWorld, 0xf1f5f9);
      }
    }

    // Tự động kéo còi khi gần cầu hoặc đường ngang
    this.whistleTimer += dt;
    if (this.whistleTimer >= 35.0) {
      this.whistleTimer = 0;
      sounds.playTrainWhistle();
    }
  }
}
window.SteamTrainSystem = SteamTrainSystem;

// ---------------------------------------------------------------------------
// 9g. CHÚ CHÓ SHIBA CƯNG ĐỒNG HÀNH & GOM TÀI NGUYÊN (FAITHFUL SHIBA COMPANION PET)
// [CHẠY THEO CHỦ NHÂN - NGOẮC ĐUÔI VUI NHỘN - TỰ ĐỘNG GOM NHẶT TÀI NGUYÊN RƠI VÃI]
// ---------------------------------------------------------------------------
class ShibaPetAgent {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.set(0, 0, 0);
    scene.add(this.mesh);

    this.targetPos = new THREE.Vector3();
    this.isMoving = false;
    this.speed = 9.5;
    this.fetchCooldown = 0;

    const shibaMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 }); // Lông vàng cam Shiba
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 });

    // 1. Thân chó Shiba
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.85), shibaMat);
    body.position.set(0, 0.42, 0);
    body.castShadow = true;
    this.mesh.add(body);

    const belly = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.15, 0.75), whiteMat);
    belly.position.set(0, 0.25, 0);
    this.mesh.add(belly);

    // 2. Đầu & Má phúng phính đặc trưng
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.45), shibaMat);
    head.position.set(0, 0.72, 0.45);
    head.castShadow = true;
    this.mesh.add(head);

    // Mõm trắng & Mũi đen
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.26), whiteMat);
    muzzle.position.set(0, 0.64, 0.72);
    this.mesh.add(muzzle);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), darkMat);
    nose.position.set(0, 0.7, 0.86);
    this.mesh.add(nose);

    // Mắt đen láy
    [-0.14, 0.14].forEach(ex => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), darkMat);
      eye.position.set(ex, 0.76, 0.68);
      this.mesh.add(eye);
    });

    // Đôi tai tam giác dựng đứng
    [-0.18, 0.18].forEach(earX => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 4), shibaMat);
      ear.rotation.y = Math.PI / 4;
      ear.position.set(earX, 1.0, 0.42);
      this.mesh.add(ear);
    });

    // Vòng cổ đỏ & Chuông vàng
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 12), redMat);
    collar.position.set(0, 0.52, 0.35);
    this.mesh.add(collar);

    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), goldMat);
    bell.position.set(0, 0.46, 0.52);
    this.mesh.add(bell);

    // Đuôi cuộn tròn ngoáy tít
    this.tail = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.06, 6, 12, Math.PI * 1.4), shibaMat);
    this.tail.position.set(0, 0.65, -0.42);
    this.tail.rotation.y = Math.PI / 2;
    this.mesh.add(this.tail);

    // 4 Chân chạy lon ton
    this.legs = [];
    [[-0.2, 0.3], [0.2, 0.3], [-0.2, -0.3], [0.2, -0.3]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.14), whiteMat);
      leg.position.set(lx, 0.18, lz);
      this.mesh.add(leg);
      this.legs.push(leg);
    });
  }

  update(dt, time, playerPos) {
    if (!playerPos) return;

    // Giữ khoảng cách theo sau người chơi 2.5m
    const dist = this.mesh.position.distanceTo(playerPos);
    this.fetchCooldown -= dt;

    if (dist > 3.2) {
      this.isMoving = true;
      const dir = playerPos.clone().sub(this.mesh.position).normalize();
      this.mesh.position.addScaledVector(dir, this.speed * dt);
      this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

      // Chạy lon ton (Leg trotting animation)
      const legAngle = Math.sin(time * 16.0) * 0.6;
      this.legs[0].rotation.x = legAngle;
      this.legs[1].rotation.x = -legAngle;
      this.legs[2].rotation.x = -legAngle;
      this.legs[3].rotation.x = legAngle;
    } else {
      this.isMoving = false;
      this.legs.forEach(l => l.rotation.x = 0);
    }

    // Đuôi ngoáy tít khi gần người chơi
    this.tail.rotation.z = Math.sin(time * 12.0) * 0.45;

    // Cao độ bám mặt đất
    this.mesh.position.y = 0.14;

    // Tính năng gom tài nguyên tự động (Auto-Fetch loose items within 8m)
    if (this.fetchCooldown <= 0 && dist < 12.0) {
      if (typeof gameState !== 'undefined') {
        // Gom gỗ hoặc tiền rơi
        if (gameState.logs < gameState.backpackMax && Math.random() < 0.15) {
          this.fetchCooldown = 8.0;
          gameState.logs += 1;
          sounds.playDogBark();
          spawnFloatingText(this.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0)), '🐾 Gâu! +1 Gỗ nhặt được 🪵', '#facc15');
          updateHUD();
        }
      }
    }
  }
}
window.ShibaPetAgent = ShibaPetAgent;

// ---------------------------------------------------------------------------
// 9h. HỆ SINH THÁI ĐỘNG VẬT HOANG DÃ (WILDLIFE: JUMPING DOLPHINS & SOARING SEAGULLS)
// ---------------------------------------------------------------------------
class MarineAvianWildlife {
  constructor(scene) {
    this.scene = scene;
    this.dolphins = [];
    this.seagulls = [];

    const dolphinMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3, metalness: 0.4 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 });

    // 1. Đàn cá heo lướt sóng nhào lộn gần Resort Maldives (X: 140, Z: 50)
    for (let d = 0; d < 3; d++) {
      const dGroup = new THREE.Group();
      dGroup.position.set(135 + d * 10, -0.2, 45 + d * 8);
      scene.add(dGroup);

      const dBody = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.6, 8), dolphinMat);
      dBody.rotation.x = Math.PI / 2;
      dGroup.add(dBody);

      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.35), dolphinMat);
      fin.position.set(0, 0.4, -0.2);
      fin.rotation.x = -0.35;
      dGroup.add(fin);

      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.3), dolphinMat);
      tail.position.set(0, 0, -1.3);
      dGroup.add(tail);

      this.dolphins.push({
        group: dGroup,
        baseX: 135 + d * 10,
        baseZ: 45 + d * 8,
        phase: d * 2.1
      });
    }

    // 2. Đàn chim hải âu chao lượn quanh Cầu Vượt Sông
    for (let s = 0; s < 5; s++) {
      const gGroup = new THREE.Group();
      gGroup.position.set(28 + (Math.random() - 0.5) * 60, 16 + Math.random() * 8, 16 + (Math.random() - 0.5) * 50);
      scene.add(gGroup);

      const gBody = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.9, 6), whiteMat);
      gBody.rotation.x = Math.PI / 2;
      gGroup.add(gBody);

      const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.3), wingMat);
      wingL.position.set(-0.45, 0, 0);
      gGroup.add(wingL);

      const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.3), wingMat);
      wingR.position.set(0.45, 0, 0);
      gGroup.add(wingR);

      this.seagulls.push({
        group: gGroup,
        wingL: wingL,
        wingR: wingR,
        angle: Math.random() * Math.PI * 2,
        rad: 25 + Math.random() * 20,
        height: 16 + Math.random() * 8,
        speed: 0.8 + Math.random() * 0.6
      });
    }

    // 3. Cá Voi Lưng Gù Khổng Lồ Phun Nước (Giant Humpback Whale at East Ocean: X = 138, Z = 80)
    const whaleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.25 });
    const whaleBellyMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });
    const whaleGroup = new THREE.Group();
    whaleGroup.position.set(138, -2.5, 80);
    whaleGroup.rotation.y = -Math.PI / 3.5;
    scene.add(whaleGroup);

    const wBody = new THREE.Mesh(new THREE.ConeGeometry(1.6, 9.0, 10), whaleMat);
    wBody.rotation.x = Math.PI / 2;
    wBody.castShadow = true;
    whaleGroup.add(wBody);

    const wBelly = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 6.0), whaleBellyMat);
    wBelly.position.set(0, -0.65, 0.5);
    whaleGroup.add(wBelly);

    const wTail = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 1.2), whaleMat);
    wTail.position.set(0, 0.4, -4.6);
    whaleGroup.add(wTail);

    [-1.6, 1.6].forEach(fx => {
      const wFin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.6), whaleMat);
      wFin.position.set(fx, -0.2, 1.4);
      wFin.rotation.set(0, (fx > 0 ? -0.4 : 0.4), (fx > 0 ? -0.3 : 0.3));
      whaleGroup.add(wFin);
    });

    this.whale = {
      group: whaleGroup,
      timer: 0
    };
  }

  update(dt, time) {
    // Cá heo nhào lộn nhảy vọt khỏi mặt nước
    this.dolphins.forEach(dp => {
      const jumpCycle = (time * 1.8 + dp.phase) % (Math.PI * 2);
      if (jumpCycle < Math.PI) {
        dp.group.position.y = Math.sin(jumpCycle) * 3.2 - 0.3;
        dp.group.rotation.x = Math.cos(jumpCycle) * 0.8;
        if (Math.sin(jumpCycle) > 0.8 && Math.random() < 0.25) {
          if (typeof spawnParticle === 'function') {
            spawnParticle(dp.group.position.clone(), 0xe0f2fe);
          }
        }
      } else {
        dp.group.position.y = -0.6; // Lặn dưới nước
      }
    });

    // Hải âu chao lượn quanh vòm cầu
    this.seagulls.forEach(sg => {
      sg.angle += dt * sg.speed;
      sg.group.position.x = 28 + Math.cos(sg.angle) * sg.rad;
      sg.group.position.z = 16 + Math.sin(sg.angle) * sg.rad;
      sg.group.position.y = sg.height + Math.sin(time * 2.0) * 0.8;
      sg.group.rotation.y = -sg.angle + Math.PI / 2;

      // Đập cánh
      const flap = Math.sin(time * 8.0) * 0.35;
      sg.wingL.rotation.z = flap;
      sg.wingR.rotation.z = -flap;
    });

    // Cá Voi Lưng Gù trồi lên mặt nước & phun cột nước cao vút
    if (this.whale) {
      this.whale.timer += dt;
      const cycle = this.whale.timer % 18.0;
      if (cycle < 6.5) {
        const riseT = cycle / 6.5;
        this.whale.group.position.y = -2.2 + Math.sin(riseT * Math.PI) * 2.6;
        this.whale.group.rotation.x = Math.cos(riseT * Math.PI) * 0.18;

        // Phun nước dạng cột sương bọt trắng
        if (cycle > 2.0 && cycle < 4.8 && Math.random() < 0.55 && typeof window.spawnParticle === 'function') {
          const spoutPos = this.whale.group.position.clone().add(new THREE.Vector3(0, 1.2, 2.2));
          window.spawnParticle(spoutPos, 0xe0f2fe);
          window.spawnParticle(spoutPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.9, 1.5 + Math.random() * 2.8, (Math.random() - 0.5) * 0.9)), 0xffffff);
        }
      } else {
        this.whale.group.position.y = -3.0; // Lặn sâu dưới đại dương
      }
    }
  }
}
window.MarineAvianWildlife = MarineAvianWildlife;

// ---------------------------------------------------------------------------
// 10. TÀU ĐÁNH CÁ THỦY SẢN TỰ ĐỘNG (FISHING TRAWLER)
// ---------------------------------------------------------------------------
class FishingTrawlerVehicle {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.set(30, 0.2, 20.5);
    scene.add(this.mesh);

    const hullMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45 }); // Xanh biển đại dương
    const bottomMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 }); // Đáy đỏ chống hà
    const cabMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.2 });
    const netMat = new THREE.MeshStandardMaterial({ color: 0x334155, wireframe: true });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 });

    // 1. Đáy tàu đỏ chống hà
    const keel = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.45, 7.8), bottomMat);
    keel.position.set(0, 0.22, 0);
    this.mesh.add(keel);

    // Mũi quả lê rẽ sóng (Bulbous Bow dưới nước tại +Z)
    const bulbous = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 1.8, 8), bottomMat);
    bulbous.rotation.x = Math.PI / 2;
    bulbous.position.set(0, 0.22, 4.2);
    this.mesh.add(bulbous);

    // 2. Thân tàu chính
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.3, 5.4), hullMat);
    hull.position.set(0, 0.95, -0.6);
    hull.castShadow = true;
    this.mesh.add(hull);

    // Mũi tàu vuốt nhọn vồng cao rẽ sóng (Prow Wedge tại +Z)
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 4), hullMat);
    bow.rotation.x = -Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(0, 1.05, 3.4);
    bow.scale.set(1.0, 1.0, 0.85);
    bow.castShadow = true;
    this.mesh.add(bow);

    // Dải sơn trắng sheerline dọc mạn
    const sheerLine = new THREE.Mesh(new THREE.BoxGeometry(3.26, 0.12, 7.6), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
    sheerLine.position.set(0, 1.48, 0.3);
    this.mesh.add(sheerLine);

    // 3. Cabin điều khiển bo cong góc cạnh (Wheelhouse)
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 2.4), cabMat);
    cabin.position.set(0, 2.1, 0.8);
    cabin.castShadow = true;
    this.mesh.add(cabin);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.1), glassMat);
    windshield.position.set(0, 2.3, 2.01);
    windshield.rotation.x = -0.15;
    this.mesh.add(windshield);

    // Đèn pha biển & Ăng-ten radar luồn gầm cầu an toàn (Air-Draft Clearance)
    const searchLight = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.25, 8), steelMat);
    searchLight.rotation.x = Math.PI / 2;
    searchLight.position.set(0, 2.65, 1.6);
    this.mesh.add(searchLight);

    const radarMast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.45, 6), steelMat);
    radarMast.position.set(0, 2.85, 0.4);
    this.mesh.add(radarMast);

    this.radarBar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.1), steelMat);
    this.radarBar.position.set(0, 3.1, 0.4);
    this.mesh.add(this.radarBar);

    // Đèn hải trình
    const navRed = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    navRed.position.set(-1.25, 2.2, 0.8);
    this.mesh.add(navRed);

    const navGreen = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    navGreen.position.set(1.25, 2.2, 0.8);
    this.mesh.add(navGreen);

    // Phao cứu sinh mạn cabin
    [-1.25, 1.25].forEach(cx => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.08, 8, 16), new THREE.MeshStandardMaterial({ color: 0xf97316 }));
      ring.position.set(cx, 2.1, 0.4);
      ring.rotation.y = Math.PI / 2;
      this.mesh.add(ring);
    });

    // 4. Giàn tời kéo lưới thép chữ "A" phía đuôi (-Z)
    this.netFrame = new THREE.Group();
    this.netFrame.position.set(0, 1.5, -2.8);
    this.mesh.add(this.netFrame);

    const gantryA = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 0.15), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
    this.netFrame.add(gantryA);

    const winchDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.4, 8), steelMat);
    winchDrum.rotation.z = Math.PI / 2;
    winchDrum.position.set(0, 0.4, 0.8);
    this.netFrame.add(winchDrum);

    this.fishNet = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.8, 8), netMat);
    this.fishNet.rotation.x = -Math.PI / 2;
    this.fishNet.position.set(0, -0.6, -1.6);
    this.fishNet.visible = false;
    this.netFrame.add(this.fishNet);

    this.catchGroup = new THREE.Group();
    this.fishNet.add(this.catchGroup);
    for (let f = 0; f < 8; f++) {
      const fMesh = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 5), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 }));
      fMesh.rotation.z = Math.PI / 2;
      fMesh.position.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.4);
      this.catchGroup.add(fMesh);
    }

    // 5. Vệt bọt nước rẽ sóng ở mũi tàu
    const wakeMat = new THREE.MeshBasicMaterial({ map: Textures.boatWake(), transparent: true, opacity: 0.65, side: THREE.DoubleSide });
    this.bowWakeL = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.8), wakeMat);
    this.bowWakeL.rotateX(-Math.PI / 2);
    this.bowWakeL.rotation.z = -0.35;
    this.bowWakeL.position.set(-1.4, 0.08, 1.8);
    this.mesh.add(this.bowWakeL);

    this.bowWakeR = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.8), wakeMat);
    this.bowWakeR.rotateX(-Math.PI / 2);
    this.bowWakeR.rotation.z = 0.35;
    this.bowWakeR.position.set(1.4, 0.08, 1.8);
    this.mesh.add(this.bowWakeR);

    // Cột cờ và cờ hiệu bay phất phới phía đuôi tàu (Waving Stern Pennant Flag)
    const flagMast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.8, 6), steelMat);
    flagMast.position.set(0, 2.5, -3.2);
    this.mesh.add(flagMast);

    const flagGeo = new THREE.PlaneGeometry(0.7, 0.42, 6, 2);
    const flagMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
    this.sternFlag = new THREE.Mesh(flagGeo, flagMat);
    this.sternFlag.position.set(0.35, 3.1, -3.2);
    this.mesh.add(this.sternFlag);

    this.state = 'DOCK';
    this.timer = 0;
    // Luồng hải trình an toàn tuyệt đối xuyên qua giữa vòm cầu đại dương (Z = 16.0)
    this.waypoints = [
      new THREE.Vector3(42, 0.2, 16.0), // Cảng cá nước sâu phía Đông
      new THREE.Vector3(28, 0.2, 16.0), // Tim luồng hàng hải gầm vòm cầu vượt (Clearance Y = 3.85m)
      new THREE.Vector3(2, 0.2, 16.0),  // Lòng sông trung tâm
      new THREE.Vector3(-24, 0.2, 16.0) // Ngư trường thượng nguồn phía Tây
    ];
    this.wpIndex = 0;
    this.fishCatch = 0;
  }

  update(dt, time) {
    this.mesh.position.y = 0.2 + Math.sin(time * 2.2) * 0.08;
    this.mesh.rotation.z = Math.sin(time * 1.5) * 0.04;
    if (this.radarBar) this.radarBar.rotation.y += dt * 4.2;

    // Hiệu ứng cờ bay uốn lượn trong gió biển (Cloth Wind Wave)
    if (this.sternFlag) {
      const pos = this.sternFlag.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i);
        pos.setZ(i, Math.sin(time * 6.5 + u * 4.0) * 0.12 * (u / 0.7));
      }
      pos.needsUpdate = true;
    }

    if (this.state === 'DOCK') {
      this.timer += dt;
      if (this.timer >= 12.0) {
        this.state = 'CRUISE';
        this.timer = 0;
        this.wpIndex = 1;
      }
    } else if (this.state === 'CRUISE') {
      const target = this.waypoints[this.wpIndex];
      const dist = this.mesh.position.distanceTo(target);
      if (dist > 0.6) {
        const dir = new THREE.Vector3().subVectors(target, this.mesh.position).normalize();
        this.mesh.position.addScaledVector(dir, 4.5 * dt);
        this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      } else {
        this.wpIndex++;
        if (this.wpIndex >= this.waypoints.length) {
          this.state = 'FISHING';
          this.timer = 0;
          this.fishNet.visible = true;
          this.catchGroup.visible = false;
        }
      }
    } else if (this.state === 'FISHING') {
      this.timer += dt;
      this.fishNet.position.y = -0.6 + Math.sin(this.timer * 4) * 0.2;
      if (this.timer >= 8.0) {
        this.state = 'RETURN';
        this.timer = 0;
        this.fishNet.visible = true;
        this.catchGroup.visible = true;
        this.fishCatch = 8;
        this.wpIndex = 2; // Bắt đầu quay về qua [2] rồi [1] rồi [0]
        spawnFloatingText(this.mesh.position, '🐟 Mẻ cá tươi bội thu! Đang quay về cảng', '#38bdf8');
      }
    } else if (this.state === 'RETURN') {
      const target = this.waypoints[this.wpIndex];
      const dist = this.mesh.position.distanceTo(target);
      if (dist > 0.6) {
        const dir = new THREE.Vector3().subVectors(target, this.mesh.position).normalize();
        this.mesh.position.addScaledVector(dir, 4.5 * dt);
        this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      } else {
        this.wpIndex--;
        if (this.wpIndex < 0) {
          this.state = 'DOCK';
          this.timer = 0;
          this.fishNet.visible = false;
          gameState.freshFish = (gameState.freshFish || 0) + this.fishCatch;
          gameState.cannedFish = (gameState.cannedFish || 0) + Math.floor(this.fishCatch / 2);
          sounds.playCollect();
          spawnFloatingText(this.mesh.position, `+${this.fishCatch} Cá Tươi & +${Math.floor(this.fishCatch / 2)} Hộp Cá vào kho! 🥫`, '#06b6d4');
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 11. TÀU CONTAINER ĐẠI DƯƠNG CẬP CẢNG XUẤT KHẨU (CARGO CONTAINER SHIP) - AAA MODEL
// ---------------------------------------------------------------------------
class CargoContainerShipVehicle {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.set(70, 0.4, 16);
    scene.add(this.mesh);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.4 });
    const redBottomMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.65, metalness: 0.3 });
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });

    // 1. Đáy tàu đỏ chống hà viễn dương (Keel Bottom)
    const keel = new THREE.Mesh(new THREE.BoxGeometry(26.0, 1.2, 6.4), redBottomMat);
    keel.position.set(0, 0.6, 0);
    keel.castShadow = true;
    this.mesh.add(keel);

    // Mũi quả lê rẽ sóng khổng lồ (Bulbous Bow dưới nước tại -X)
    const bulbous = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.15, 3.8, 10), redBottomMat);
    bulbous.rotation.z = Math.PI / 2;
    bulbous.position.set(-14.2, 0.6, 0);
    this.mesh.add(bulbous);

    // 2. Thân tàu chính thép công nghiệp (Upper Steel Hull)
    const hull = new THREE.Mesh(new THREE.BoxGeometry(22.0, 2.6, 6.6), steelMat);
    hull.position.set(2.0, 2.3, 0);
    hull.castShadow = true;
    this.mesh.add(hull);

    // Mũi tàu vuốt nhọn vát nghiêng (Clipper Bow Wedge tại -X)
    const bowWedge = new THREE.Mesh(new THREE.ConeGeometry(3.4, 6.8, 4), steelMat);
    bowWedge.rotation.z = Math.PI / 2;
    bowWedge.rotation.y = Math.PI / 4;
    bowWedge.position.set(-12.4, 2.4, 0);
    bowWedge.scale.set(1.0, 1.0, 0.88);
    bowWedge.castShadow = true;
    this.mesh.add(bowWedge);

    // Dải sơn trắng sheerline mớn nước
    const sheerLine = new THREE.Mesh(new THREE.BoxGeometry(27.0, 0.16, 6.7), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
    sheerLine.position.set(-0.5, 3.4, 0);
    this.mesh.add(sheerLine);

    // Mỏ neo sắt đen treo bên mạn mũi tàu
    const anchor = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.1, 6, 12), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 }));
    anchor.position.set(-11.5, 2.4, -3.35);
    this.mesh.add(anchor);

    // 3. Đài chỉ huy & Buồng lái đa tầng viễn dương (4-Tier Superstructure Bridge at +X)
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(9.5, 4.6, 0);
    this.mesh.add(bridgeGroup);

    const b1 = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.4, 5.6), bridgeMat);
    b1.position.y = 0.7;
    b1.castShadow = true;
    bridgeGroup.add(b1);

    const b2 = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.3, 5.2), bridgeMat);
    b2.position.y = 2.05;
    b2.castShadow = true;
    bridgeGroup.add(b2);

    const b3 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.2, 6.6), bridgeMat);
    b3.position.y = 3.3;
    b3.castShadow = true;
    bridgeGroup.add(b3);

    const bridgeGlass = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 6.4), glassMat);
    bridgeGlass.position.set(-1.81, 3.4, 0);
    bridgeGroup.add(bridgeGlass);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 6), chromeMat);
    mast.position.set(0, 5.2, 0);
    bridgeGroup.add(mast);

    this.radarAntenna = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.18), chromeMat);
    this.radarAntenna.position.set(0, 6.4, 0);
    bridgeGroup.add(this.radarAntenna);

    // Đôi ống khói nghiêng góc 15 độ (Twin Marine Funnels)
    const funnelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    [-1.4, 1.4].forEach(fz => {
      const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 2.6, 8), funnelMat);
      funnel.rotation.z = -0.15;
      funnel.position.set(1.4, 4.2, fz);
      bridgeGroup.add(funnel);

      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xf97316 }));
      stripe.rotation.z = -0.15;
      stripe.position.set(1.4, 4.4, fz);
      bridgeGroup.add(stripe);
    });

    // 4. Các kiện Container 40ft xếp tầng đan xen (24 Containers)
    const brands = [
      { color: '#0284c7', label: 'MAERSK' },
      { color: '#15803d', label: 'EVERGREEN' },
      { color: '#be185d', label: 'ONE' },
      { color: '#ea580c', label: 'HAPAG' },
      { color: '#1d4ed8', label: 'COSCO' }
    ];

    for (let ci = 0; ci < 24; ci++) {
      const bInfo = brands[ci % brands.length];
      const cTex = Textures.shippingContainer(bInfo.color, bInfo.label);
      const cMat = new THREE.MeshStandardMaterial({ map: cTex, roughness: 0.45 });
      const container = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.45, 1.75), cMat);

      const col = ci % 6;
      const row = Math.floor((ci % 12) / 6);
      const tier = Math.floor(ci / 12);

      container.position.set(-8.5 + col * 4.4, 3.8 + tier * 1.5, -1.25 + row * 2.5);
      container.castShadow = true;
      this.mesh.add(container);
    }

    // 5. Vệt bọt nước rẽ sóng ở mũi tàu khổng lồ
    const wakeMat = new THREE.MeshBasicMaterial({ map: Textures.boatWake(), transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    this.bowWakeL = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 7.5), wakeMat);
    this.bowWakeL.rotateX(-Math.PI / 2);
    this.bowWakeL.rotation.z = -2.7;
    this.bowWakeL.position.set(-14.0, 0.08, -2.6);
    this.mesh.add(this.bowWakeL);

    this.bowWakeR = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 7.5), wakeMat);
    this.bowWakeR.rotateX(-Math.PI / 2);
    this.bowWakeR.rotation.z = -0.45;
    this.bowWakeR.position.set(-14.0, 0.08, 2.6);
    this.mesh.add(this.bowWakeR);

    this.state = 'AWAY';
    this.timer = 15;
  }

  update(dt, time) {
    if (this.radarAntenna) this.radarAntenna.rotation.y += dt * 4.5;
    this.mesh.position.y = 0.4 + Math.sin(time * 1.5) * 0.06;

    if (this.state === 'AWAY') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'ARRIVING';
        this.mesh.position.set(78, 0.4, 16);
        sounds.playShipHorn();
        showToast('🚢 TÀU CONTAINER ĐẠI DƯƠNG QUỐC TẾ ĐANG CẬP CẢNG XUẤT KHẨU!');
      }
    } else if (this.state === 'ARRIVING') {
      this.mesh.position.x -= 4.2 * dt;
      if (this.mesh.position.x <= 50) {
        this.state = 'MOORED';
        this.timer = 18.0;
        const palPayout = (gameState.pallets || 0) * 500;
        const fishPayout = (gameState.cannedFish || 0) * 120;
        const totalBonus = palPayout + fishPayout + 5000;
        const gemBonus = 15;

        gameState.money += totalBonus;
        gameState.gems = (gameState.gems || 0) + gemBonus;
        gameState.pallets = 0;
        gameState.cannedFish = 0;
        gameState.exportOrders = (gameState.exportOrders || 0) + 5;

        sounds.playLevelUp();
        spawnFloatingText(this.mesh.position, `+$${totalBonus.toLocaleString()} & +${gemBonus} 💎 Xuất Khẩu Tàu Biển!`, '#facc15');
        showToast(`🎉 XUẤT KHẨU THÀNH CÔNG: +$${totalBonus.toLocaleString()} & +${gemBonus} 💎!`);
      }
    } else if (this.state === 'MOORED') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'DEPARTING';
        sounds.playShipHorn();
      }
    } else if (this.state === 'DEPARTING') {
      this.mesh.position.x += 4.5 * dt;
      if (this.mesh.position.x >= 80) {
        this.state = 'AWAY';
        this.timer = 120.0;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 11b. HỆ THỐNG GIAO THÔNG QUA CẦU VƯỢT SÔNG (BRIDGE VEHICULAR TRAFFIC SYSTEM)
// ---------------------------------------------------------------------------
class EmpireHighwayTrafficSystem {
  constructor(scene) {
    this.scene = scene;
    this.vehicles = [];

    // Lộ trình khép kín 1: Chiều xuôi Nam qua Cầu Vượt -> Đại lộ Nam -> Đại lộ Tây -> Đại lộ Express
    const loop1 = [
      new THREE.Vector3(29.6, 0.22, -90),
      new THREE.Vector3(29.6, 0.22, -38),
      new THREE.Vector3(29.6, 0.22, 2),
      new THREE.Vector3(29.6, 0.22, 16),
      new THREE.Vector3(29.6, 0.22, 30),
      new THREE.Vector3(29.6, 0.22, 158),
      new THREE.Vector3(0, 0.22, 158),
      new THREE.Vector3(-108, 0.22, 158),
      new THREE.Vector3(-108, 0.22, 50),
      new THREE.Vector3(-108, 0.22, -38),
      new THREE.Vector3(-108, 0.22, -108),
      new THREE.Vector3(0, 0.22, -108),
      new THREE.Vector3(29.6, 0.22, -108)
    ];

    // Lộ trình khép kín 2: Chiều ngược lại (làn đối diện ở X = 26.4)
    const loop2 = [
      new THREE.Vector3(26.4, 0.22, 158),
      new THREE.Vector3(26.4, 0.22, 30),
      new THREE.Vector3(26.4, 0.22, 16),
      new THREE.Vector3(26.4, 0.22, 2),
      new THREE.Vector3(26.4, 0.22, -38),
      new THREE.Vector3(26.4, 0.22, -90),
      new THREE.Vector3(26.4, 0.22, -108),
      new THREE.Vector3(-108, 0.22, -108),
      new THREE.Vector3(-108, 0.22, -38),
      new THREE.Vector3(-108, 0.22, 50),
      new THREE.Vector3(-108, 0.22, 158),
      new THREE.Vector3(0, 0.22, 158)
    ];

    // Tạo 4 xe AI tuần tra tuần hoàn liên tục - KHÔNG BAO GIỜ BIẾN MẤT HAY TELEPORT
    this.createCar(loop1, 0, 'logging', 0xdc2626, 14.0);   // Xe chở gỗ đỏ
    this.createCar(loop1, 6, 'container', 0x2563eb, 13.5); // Xe container xanh
    this.createCar(loop2, 0, 'pickup', 0xfacc15, 16.0);    // Xe bán tải vàng
    this.createCar(loop2, 6, 'delivery', 0x16a34a, 14.5);  // Xe tải giao hàng xanh lá
  }

  createCar(waypoints, startIdx, type, color, speed) {
    const mesh = new THREE.Group();
    mesh.position.copy(waypoints[startIdx]);
    mesh.rotation.order = 'YXZ';
    this.scene.add(mesh);

    const wheels = [];
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const cabMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.3 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 });

    // Cabin xe
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.8, 2.8), cabMat);
    cab.position.set(0, 1.2, 0.6);
    cab.castShadow = true;
    mesh.add(cab);

    // Kính chắn gió
    const ws = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.8, 0.1), glassMat);
    ws.position.set(0, 1.5, 2.02);
    mesh.add(ws);

    // Đèn pha trước & Chùm sáng nón thể tích ban đêm
    const beamGeo = new THREE.ConeGeometry(0.85, 9.0, 10, 1, true);
    beamGeo.rotateX(-Math.PI / 2);
    beamGeo.translate(0, 0, 4.5);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const beams = [];
    [-0.8, 0.8].forEach(lx => {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.1), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      led.position.set(lx, 0.9, 2.05);
      mesh.add(led);

      const bMesh = new THREE.Mesh(beamGeo, beamMat);
      bMesh.position.set(lx, 0.9, 2.05);
      bMesh.visible = false;
      mesh.add(bMesh);
      beams.push(bMesh);
    });

    // Thùng sau tùy loại xe
    if (type === 'container' || type === 'delivery') {
      const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 4.8), darkMat);
      cargo.position.set(0, 1.4, -2.4);
      cargo.castShadow = true;
      mesh.add(cargo);
    } else {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 3.8), cabMat);
      bed.position.set(0, 0.9, -2.0);
      bed.castShadow = true;
      mesh.add(bed);
    }

    // Bánh xe
    const wGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.36, 12);
    wGeo.rotateZ(Math.PI / 2);
    [[-1.2, 0.48, 1.4], [1.2, 0.48, 1.4], [-1.2, 0.48, -1.8], [1.2, 0.48, -1.8], [-1.2, 0.48, -3.2], [1.2, 0.48, -3.2]].forEach(([wx, wy, wz]) => {
      const w = new THREE.Mesh(wGeo, rubberMat);
      w.position.set(wx, wy, wz);
      w.castShadow = true;
      mesh.add(w);
      wheels.push(w);
    });

    this.vehicles.push({
      mesh,
      waypoints,
      wpIdx: startIdx,
      speed,
      currentSpeed: speed,
      wheels,
      beams
    });
  }

  update(dt) {
    const isNight = (typeof gameState !== 'undefined') && (gameState.gameHour < 5.5 || gameState.gameHour > 18.5);
    const isRedOrYellowLight = window.trafficCycle && (window.trafficCycle.phase === 'red' || window.trafficCycle.phase === 'yellow');
    const isTrainCrossingActive = (typeof window.isTrainNearCrossing !== 'undefined' && window.isTrainNearCrossing) || (window.crossingGates && window.crossingGates.length > 0 && window.crossingGates[0].armPivot && window.crossingGates[0].armPivot.rotation.x < 0.35);

    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      if (v.beams) {
        v.beams.forEach(b => b.visible = isNight);
      }

      const curX = v.mesh.position.x;
      const curZ = v.mesh.position.z;
      let shouldStop = false;

      // 1. Dừng thông minh trước Đèn Đỏ / Đèn Vàng tại Ngã Tư Đại Lộ (Z = 73)
      if (isRedOrYellowLight) {
        // Chiều Nam (X ~ 29.6) dừng trước Z = 71
        if (Math.abs(curX - 29.6) < 2.0 && curZ >= 56.0 && curZ <= 71.0) {
          shouldStop = true;
        }
        // Chiều Bắc (X ~ 26.4) dừng trước Z = 75
        else if (Math.abs(curX - 26.4) < 2.0 && curZ <= 88.0 && curZ >= 75.0) {
          shouldStop = true;
        }
      }

      // 2. Dừng an toàn trước Rào chắn Đường Sắt Tự Động Sân Bay (X = 45, Z = 155 - 158)
      if (isTrainCrossingActive && Math.abs(curZ - 158) < 3.0) {
        if (curX >= 30.0 && curX <= 42.0) shouldStop = true; // Chiều Đông
        else if (curX >= 48.0 && curX <= 60.0) shouldStop = true; // Chiều Tây
      }

      // 3. Nhường đường cho Người Đi Bộ qua vạch Zebra Crosswalk
      if (!shouldStop && window.cityPedestrians && window.cityPedestrians.length > 0) {
        for (let pi = 0; pi < window.cityPedestrians.length; pi++) {
          const ped = window.cityPedestrians[pi];
          const pdx = ped.group.position.x - curX;
          const pdz = ped.group.position.z - curZ;
          const pDistSq = pdx * pdx + pdz * pdz;
          if (pDistSq < 16.0) { // Trong phạm vi 4m trước đầu xe
            shouldStop = true;
            break;
          }
        }
      }

      // Hãm phanh mượt mà hoặc tăng tốc trở lại
      const targetSpd = shouldStop ? 0 : v.speed;
      v.currentSpeed = THREE.MathUtils.lerp(v.currentSpeed !== undefined ? v.currentSpeed : v.speed, targetSpd, Math.min(1.0, dt * 4.0));

      const target = v.waypoints[v.wpIdx];
      const toTarget = new THREE.Vector3().subVectors(target, v.mesh.position);
      toTarget.y = 0;
      const dist = toTarget.length();

      if (dist < 4.0) {
        v.wpIdx = (v.wpIdx + 1) % v.waypoints.length;
      } else {
        toTarget.normalize();
        const targetAngle = Math.atan2(toTarget.x, toTarget.z);
        let diff = targetAngle - v.mesh.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        v.mesh.rotation.y += diff * Math.min(1.0, dt * 4.0);

        const fwd = new THREE.Vector3(0, 0, 1).applyEuler(v.mesh.rotation);
        v.mesh.position.addScaledVector(fwd, v.currentSpeed * dt);
      }

      // Vượt Cầu Vượt Sông Hùng Vĩ mượt mà (Z: 2.0 đến 30.0 tại X gần 28)
      const onBridge = (curX >= 22.0 && curX <= 34.0 && curZ >= 1.5 && curZ <= 30.5);

      if (onBridge && typeof window.getBridgeDeckY === 'function') {
        const yCenter = window.getBridgeDeckY(curZ);
        const zF = curZ + Math.cos(v.mesh.rotation.y) * 2.0;
        const zR = curZ - Math.cos(v.mesh.rotation.y) * 2.0;
        const yF = window.getBridgeDeckY(zF);
        const yR = window.getBridgeDeckY(zR);
        v.mesh.rotation.x = -Math.atan2(yF - yR, 4.0);
        v.mesh.position.y = yCenter + 0.04;
      } else {
        v.mesh.rotation.x = 0;
        v.mesh.position.y = 0.22;
      }

      v.wheels.forEach(w => w.rotateX(v.currentSpeed * dt * 2.6));
    }
  }
}
window.BridgeTrafficSystem = EmpireHighwayTrafficSystem;
window.EmpireHighwayTrafficSystem = EmpireHighwayTrafficSystem;

// ---------------------------------------------------------------------------
// 12. REGISTRY & LIFECYCLE
// ---------------------------------------------------------------------------
const workers = [];
const forklifts = [];
const fishermen = [];
const carpenters = [];
const miners = [];
const resortStaff = [];
const airportCrew = [];
let logCarrier = null;
let sawOperator = null;
let plankStacker = null;


// ===========================================================================
// 9c. SIÊU XE TẢI ĐẦU KÉO CHỞ GỖ CÓ RƠ-MOÓC KHỚP NỐI (DRIVABLE SEMI-TRAILER LUMBER TRUCK)
// [XE HẠNG NẶNG - RƠ-MOÓC CHỞ 16 KHÚC GỖ CÔNG NGHIỆP - GIAO HÀNG ĐẠI LỘ VÀNH ĐAI]
// ===========================================================================
class DrivableLumberTruck {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.set(22.0, 0.22, -26.0); // Bãi đỗ xe cạnh Xưởng Xẻ Gỗ
    this.mesh.rotation.order = 'YXZ';
    scene.add(this.mesh);

    this.velocity = 0;
    this.maxSpeed = 22.0;
    this.accel = 12.0;
    this.brake = 24.0;
    this.turnSpeed = 1.8;
    this.loadCooldown = 0;
    this.deliverCooldown = 0;
    this.hornCooldown = 0;

    // Rơ-moóc chuyên dụng chở gỗ (Semi-Trailer with Hitch Pivot)
    this.trailerMesh = new THREE.Group();
    this.trailerMesh.position.set(22.0, 0.22, -32.2);
    this.trailerMesh.rotation.order = 'YXZ';
    scene.add(this.trailerMesh);

    this.wheels = [];
    this.trailerWheels = [];
    this.cargoLogs = [];

    this.buildTractorCab();
    this.buildSemiTrailer();
    this.buildPromptSign();
  }

  buildTractorCab() {
    const cabPaintMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35, metalness: 0.45 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.95, roughness: 0.1 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });

    // Khung gầm đầu kéo
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 6.2), darkMat);
    chassis.position.set(0, 0.7, -0.6);
    chassis.castShadow = true;
    this.mesh.add(chassis);

    // Ca-bin tài xế (Driver Compartment)
    const sleeper = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.2), cabPaintMat);
    sleeper.position.set(0, 2.0, -0.2);
    sleeper.castShadow = true;
    this.mesh.add(sleeper);

    // Mũi xe / Nắp capo động cơ dài kiểu Mỹ (Long Hood)
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.4, 2.2), cabPaintMat);
    hood.position.set(0, 1.5, 1.8);
    hood.castShadow = true;
    this.mesh.add(hood);

    // Lưới tản nhiệt mạ Chrome sáng loáng (Vertical Chrome Grille)
    const grille = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.25, 0.15), chromeMat);
    grille.position.set(0, 1.5, 2.92);
    this.mesh.add(grille);

    // Cản trước hạng nặng (Heavy Chrome Bumper)
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.5, 0.4), chromeMat);
    bumper.position.set(0, 0.7, 3.0);
    this.mesh.add(bumper);

    // Kính chắn gió lớn
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.1), glassMat);
    windshield.position.set(0, 2.3, 0.92);
    this.mesh.add(windshield);

    // 2 Ống xả Chrome dựng đứng sau cabin (Dual Chrome Exhaust Stacks)
    [-1.25, 1.25].forEach(ex => {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 10), chromeMat);
      stack.position.set(ex, 3.2, -1.35);
      stack.castShadow = true;
      this.mesh.add(stack);

      // Đầu cong ống xả
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8), chromeMat);
      tip.rotation.x = -0.5;
      tip.position.set(ex, 4.85, -1.5);
      this.mesh.add(tip);
    });

    // Bình dầu tròn Chrome 2 bên hông
    [-1.4, 1.4].forEach(tx => {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 2.2, 12), chromeMat);
      tank.rotation.x = Math.PI / 2;
      tank.position.set(tx, 0.75, 0.4);
      this.mesh.add(tank);
    });

    // Đèn pha LED trước siêu sáng
    [-0.95, 0.95].forEach(lx => {
      const lightMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.15), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      lightMesh.position.set(lx, 1.15, 2.92);
      this.mesh.add(lightMesh);
    });

    // Mâm kéo rơ-moóc (Fifth Wheel Hitch)
    const fifthWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.18, 16), darkMat);
    fifthWheel.position.set(0, 1.0, -2.2);
    this.mesh.add(fifthWheel);

    // Bánh xe đầu kéo: 2 bánh trước dẫn hướng + 4 bánh sau kép chịu lực
    const wGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.4, 14);
    wGeo.rotateZ(Math.PI / 2);

    const wheelLocs = [
      [-1.3, 0.52, 2.0], [1.3, 0.52, 2.0], // Cầu trước
      [-1.3, 0.52, -1.6], [1.3, 0.52, -1.6], // Cầu sau 1
      [-1.3, 0.52, -2.8], [1.3, 0.52, -2.8]  // Cầu sau 2
    ];

    wheelLocs.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wGeo, rubberMat);
      wheel.position.set(wx, wy, wz);
      wheel.castShadow = true;
      this.mesh.add(wheel);
      this.wheels.push(wheel);

      // Lazang Chrome mạ bóng
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.42, 10), chromeMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(wx, wy, wz);
      this.mesh.add(rim);
    });
  }

  buildSemiTrailer() {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.7 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.9 });

    // Dầm thép chịu lực rơ-moóc dài 9.5m
    const trailerBed = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, 9.5), frameMat);
    trailerBed.position.set(0, 1.05, 0);
    trailerBed.castShadow = true;
    this.trailerMesh.add(trailerBed);

    // Chốt kéo Kingpin ở đầu rơ-moóc
    const kingpin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), frameMat);
    kingpin.position.set(0, 0.8, 3.8);
    this.trailerMesh.add(kingpin);

    // Tấm chắn đầu rơ-moóc bảo vệ cabin (Headboard Cab Protector)
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 0.2), frameMat);
    headboard.position.set(0, 2.35, 4.4);
    this.trailerMesh.add(headboard);

    // 4 Bộ cọc thép đứng giữ thân cây gỗ (Bolster Stakes)
    [-3.5, -1.2, 1.2, 3.5].forEach(sz => {
      // Thanh ngang chữ U
      const bolsterBase = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.3, 0.3), postMat);
      bolsterBase.position.set(0, 1.35, sz);
      this.trailerMesh.add(bolsterBase);

      // 2 Cọc thép đứng 2 bên
      [-1.35, 1.35].forEach(sx => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 0.2), postMat);
        post.position.set(sx, 2.5, sz);
        this.trailerMesh.add(post);
      });
    });

    // 4 Bánh xe kép rơ-moóc ở đuôi
    const twGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.42, 14);
    twGeo.rotateZ(Math.PI / 2);
    [[-1.35, 0.52, -2.6], [1.35, 0.52, -2.6], [-1.35, 0.52, -3.8], [1.35, 0.52, -3.8]].forEach(([wx, wy, wz]) => {
      const tw = new THREE.Mesh(twGeo, rubberMat);
      tw.position.set(wx, wy, wz);
      tw.castShadow = true;
      this.trailerMesh.add(tw);
      this.trailerWheels.push(tw);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.44, 10), chromeMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(wx, wy, wz);
      this.trailerMesh.add(rim);
    });

    // Tạo sẵn 16 Khúc gỗ 3D xếp kim tự tháp (Dynamic Visual Log Cargo)
    const logGeo = new THREE.CylinderGeometry(0.36, 0.36, 7.8, 10);
    logGeo.rotateX(Math.PI / 2);
    const logMat = new THREE.MeshStandardMaterial({
      map: (typeof Textures !== 'undefined' && Textures.bark) ? Textures.bark() : null,
      color: 0x92400e,
      roughness: 0.85
    });

    // 16 Vị trí xếp gỗ: Tầng 1 (6 cây), Tầng 2 (5 cây), Tầng 3 (3 cây), Tầng 4 (2 cây)
    const logPositions = [
      // Tầng 1: Y = 1.6
      [-0.9, 1.6, 0.2], [-0.54, 1.6, 0.2], [-0.18, 1.6, 0.2], [0.18, 1.6, 0.2], [0.54, 1.6, 0.2], [0.9, 1.6, 0.2],
      // Tầng 2: Y = 2.2
      [-0.72, 2.2, 0.2], [-0.36, 2.2, 0.2], [0.0, 2.2, 0.2], [0.36, 2.2, 0.2], [0.72, 2.2, 0.2],
      // Tầng 3: Y = 2.8
      [-0.45, 2.8, 0.2], [0.0, 2.8, 0.2], [0.45, 2.8, 0.2],
      // Tầng 4: Y = 3.4
      [-0.22, 3.4, 0.2], [0.22, 3.4, 0.2]
    ];

    logPositions.forEach(p => {
      const log = new THREE.Mesh(logGeo, logMat);
      log.position.set(p[0], p[1], p[2]);
      log.castShadow = true;
      log.visible = false;
      this.trailerMesh.add(log);
      this.cargoLogs.push(log);
    });
  }

  buildPromptSign() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.roundRect(8, 8, 496, 112, 16);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 6;
    ctx.roundRect(8, 8, 496, 112, 16);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚚 XE TẢI ĐẦU KÉO CHỞ GỖ', 256, 52);
    ctx.fillStyle = '#facc15';
    ctx.font = '26px Arial, sans-serif';
    ctx.fillText('BẤM [E] ĐỂ LÊN LÁI XE', 256, 92);

    const signTex = new THREE.CanvasTexture(canvas);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true, side: THREE.DoubleSide });
    this.promptSign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), signMat);
    this.promptSign.position.set(0, 4.6, 0);
    this.mesh.add(this.promptSign);
  }

  toggleMount() {
    if (typeof gameState === 'undefined') return;
    gameState.isDrivingTruck = !gameState.isDrivingTruck;

    if (gameState.isDrivingTruck) {
      if (typeof sounds !== 'undefined' && sounds.playEngineIgnition) sounds.playEngineIgnition();
      if (typeof showToast === 'function') {
        showToast('🚚 ĐÃ LÊN LÁI XE TẢI ĐẦU KÉO! [W/A/S/D] Lái | [SPACE] Còi hơi & Bốc dỡ');
      }
      if (typeof player !== 'undefined' && player.mesh) player.mesh.visible = false;
    } else {
      if (typeof showToast === 'function') showToast('Đã xuống xe tải chở gỗ!');
      if (typeof player !== 'undefined' && player.mesh) {
        player.mesh.visible = true;
        player.mesh.position.set(this.mesh.position.x - 2.8, 0.2, this.mesh.position.z);
      }
    }
  }

  handleSpaceAction() {
    // 1. Nếu đứng gần bãi nạp gỗ xưởng cưa: Bốc gỗ lên xe
    if (window.sawmillLoadingPad && this.mesh.position.distanceTo(window.sawmillLoadingPad.pos) <= 8.5) {
      this.tryLoadWoodCargo();
      return;
    }

    // 2. Nếu đứng gần bất kỳ Delivery Hub nào: Giao hàng ngay
    if (window.lumberDeliveryHubs) {
      for (let hub of window.lumberDeliveryHubs) {
        if (this.mesh.position.distanceTo(hub.pos) <= 10.0) {
          this.tryDeliverCargo(hub);
          return;
        }
      }
    }

    // 3. Mặc định: Bấm còi hơi xe tải vang trời
    if (this.hornCooldown <= 0) {
      this.hornCooldown = 1.2;
      if (typeof sounds !== 'undefined' && sounds.playTruckHorn) sounds.playTruckHorn();
      if (typeof spawnFloatingText === 'function') {
        spawnFloatingText(this.mesh.position.clone().add(new THREE.Vector3(0, 4.5, 0)), '📯 HOOOONK!!', '#facc15');
      }
    }
  }

  tryLoadWoodCargo() {
    if (typeof gameState === 'undefined') return;
    if ((gameState.truckCargo || 0) >= (gameState.truckMaxCargo || 16)) {
      if (typeof showToast === 'function') showToast('Thùng xe tải đã đầy ắp 16/16 kiện gỗ!');
      return;
    }

    // Nạp từ kho người chơi hoặc bãi gỗ
    gameState.truckCargo = Math.min(gameState.truckMaxCargo || 16, (gameState.truckCargo || 0) + 4);
    if (typeof sounds !== 'undefined' && sounds.playWoodPlank) sounds.playWoodPlank();
    if (typeof spawnFloatingText === 'function') {
      spawnFloatingText(
        this.trailerMesh.position.clone().add(new THREE.Vector3(0, 4.0, 0)),
        `+4 GỖ VÀO THÙNG XE [${gameState.truckCargo}/16] 🚚🪵`,
        '#22c55e'
      );
    }
    if (typeof showToast === 'function') {
      showToast(`🚚 Đã bốc xếp gỗ lên xe tải [${gameState.truckCargo}/16]! Hãy chở đến các điểm Delivery Hub!`);
    }
    if (typeof updateHUD === 'function') updateHUD();
  }

  tryDeliverCargo(hub) {
    if (typeof gameState === 'undefined') return;
    const cargo = gameState.truckCargo || 0;
    if (cargo <= 0) {
      if (typeof showToast === 'function') showToast('⚠️ Thùng xe tải đang trống! Hãy quay lại Xưởng Xẻ để nạp gỗ!');
      return;
    }

    // Giao toàn bộ hàng và nhận thưởng khủng
    const totalPayout = cargo * hub.rewardPerCargo;
    const totalExp = cargo * hub.rewardExp;
    const totalGems = (hub.rewardGems || 0) * Math.ceil(cargo / 4);

    gameState.money = (gameState.money || 0) + totalPayout;
    gameState.gems = (gameState.gems || 0) + totalGems;
    gameState.truckCargo = 0;
    gameState.truckDeliveries = (gameState.truckDeliveries || 0) + 1;

    if (typeof sounds !== 'undefined') {
      if (sounds.playLevelUp) sounds.playLevelUp();
      if (sounds.playCoin) sounds.playCoin();
    }

    if (typeof spawnFloatingText === 'function') {
      spawnFloatingText(
        hub.pos.clone().add(new THREE.Vector3(0, 5.0, 0)),
        `+$${totalPayout.toLocaleString()} GIAO HÀNG ${hub.shortName.toUpperCase()}! 🚚💰`,
        '#facc15'
      );
    }

    if (typeof showToast === 'function') {
      showToast(`🎉 GIAO HÀNG THÀNH CÔNG: +${totalPayout.toLocaleString()} tiền mặt & +${totalExp} EXP!`);
    }
    if (typeof updateHUD === 'function') updateHUD();
  }

  update(dt, playerPos) {
    const distToPlayer = playerPos ? playerPos.distanceTo(this.mesh.position) : 999;
    const promptEl = document.getElementById('vehicle-prompt-hud');
    const promptText = document.getElementById('vehicle-prompt-text');

    this.loadCooldown = Math.max(0, this.loadCooldown - dt);
    this.deliverCooldown = Math.max(0, this.deliverCooldown - dt);
    this.hornCooldown = Math.max(0, this.hornCooldown - dt);

    // Đồng bộ hiển thị 16 khúc gỗ trên rơ-moóc
    const curCargo = (typeof gameState !== 'undefined' && gameState.truckCargo) || 0;
    for (let i = 0; i < this.cargoLogs.length; i++) {
      this.cargoLogs[i].visible = (i < curCargo);
    }

    if (gameState.isDrivingTruck) {
      if (promptEl) {
        promptEl.classList.add('active');
        if (promptText) {
          const nitro = (gameState.nitroBoostTimer > 0) ? '⚡ NITRO ' : '';
          promptText.textContent = `${nitro}XUỐNG XE TẢI [E] | [SPACE] BỐC DỠ / CÒI HƠI [${curCargo}/16]`;
        }
      }
      this.promptSign.visible = false;

      // Xử lý Nitro Boost
      let topSpeed = this.maxSpeed;
      if (gameState.talents && gameState.talents.turboDrive) {
        topSpeed *= 1.3;
      }
      if (gameState.nitroBoostTimer > 0) {
        gameState.nitroBoostTimer -= dt;
        topSpeed = 38.0; // Tăng 72% tốc độ
      }

      let throttle = 0;
      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) throttle += 1;
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) throttle -= 1;

      let steer = 0;
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) steer += 1;
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) steer -= 1;

      if (throttle !== 0) {
        this.velocity += throttle * this.accel * dt;
        this.velocity = Math.max(-topSpeed * 0.4, Math.min(this.velocity, topSpeed));
      } else {
        if (Math.abs(this.velocity) > 0.1) {
          const sign = Math.sign(this.velocity);
          this.velocity -= sign * this.brake * dt;
          if (Math.sign(this.velocity) !== sign) this.velocity = 0;
        } else {
          this.velocity = 0;
        }
      }

      if (Math.abs(this.velocity) > 0.1) {
        this.mesh.rotation.y += steer * this.turnSpeed * dt * Math.sign(this.velocity);
      }

      // Phanh tay rê bánh Drift khét lẹt (Handbrake Tire Drift Skid)
      const isHandbrake = keysPressed['Space'];
      if (isHandbrake && Math.abs(this.velocity) > 2.5) {
        this.mesh.rotation.y += (steer || (Math.sign(this.velocity) * 0.8)) * this.turnSpeed * dt * 2.2;
        this.velocity *= Math.max(0.1, 1.0 - dt * 2.5);
        if (typeof sounds !== 'undefined' && sounds.playDriftScreech) sounds.playDriftScreech();
        if (typeof spawnParticle === 'function') {
          spawnParticle(this.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.8, 0.15, -1.6)), 0x334155);
          spawnParticle(this.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.8, 0.15, -1.6)), 0xd1d5db);
        }
      }

      const forward = new THREE.Vector3(0, 0, 1).applyEuler(this.mesh.rotation);
      this.mesh.position.addScaledVector(forward, this.velocity * dt);

      // Tiêu thụ nhiên liệu & Kiểm tra Nạp xăng tại trạm xăng
      if (typeof gameState !== 'undefined') {
        if (Math.abs(this.velocity) > 0.2) {
          gameState.vehicleFuel = Math.max(0.0, (gameState.vehicleFuel !== undefined ? gameState.vehicleFuel : 100) - dt * 0.12);
        }
        if (window.gasStationPads) {
          for (let gi = 0; gi < window.gasStationPads.length; gi++) {
            const gp = window.gasStationPads[gi];
            if (this.mesh.position.distanceTo(gp.pos) <= gp.radius && Math.abs(this.velocity) < 1.0) {
              if (gameState.vehicleFuel < 100.0) {
                gameState.vehicleFuel = Math.min(100.0, gameState.vehicleFuel + dt * 35.0);
                if (typeof sounds !== 'undefined' && sounds.playFuelRefill) sounds.playFuelRefill();
                if (typeof showToast === 'function' && Math.random() < 0.05) showToast('⛽ Đang nạp xăng Petrolimex đầy bình...');
              }
            }
          }
        }
        // Kiểm tra Gara sửa chữa xe tự động
        if (window.autoRepairPad && this.mesh.position.distanceTo(window.autoRepairPad.pos) <= window.autoRepairPad.radius && Math.abs(this.velocity) < 1.0) {
          if ((gameState.vehicleHealth || 100) < 100.0) {
            gameState.vehicleHealth = Math.min(100.0, (gameState.vehicleHealth || 100) + dt * 40.0);
            if (typeof sounds !== 'undefined' && sounds.playRepairWrench) sounds.playRepairWrench();
            if (typeof showToast === 'function' && Math.random() < 0.05) showToast('🔧 GARA CƠ KHÍ: Đang gò hàn phục hồi thân vỏ...');
          }
        }
        // Thử thách đỗ xe song song nhận thưởng
        if (window.parkingSlots && Math.abs(this.velocity) < 0.15) {
          window.parkingSlots.forEach(slot => {
            if (!slot.occupied && this.mesh.position.distanceTo(slot.pos) < 2.0) {
              slot.occupied = true;
              gameState.money = (gameState.money || 0) + 50;
              if (typeof showToast === 'function') showToast('🅿️ ĐỖ XE CHUẨN XÁC: Nhận thưởng kỹ năng lái xe +$50!');
              if (typeof sounds !== 'undefined' && sounds.playCoin) sounds.playCoin();
            }
          });
        }
      }

      // Điều tần âm thanh động cơ theo dải ga
      if (typeof sounds !== 'undefined' && sounds.updateEngineThrottle) {
        sounds.updateEngineThrottle(Math.abs(this.velocity) / this.maxSpeed);
      }

      // Địa hình & Cầu Vượt Sông
      const curX = this.mesh.position.x;
      const curZ = this.mesh.position.z;
      const onBridge = (curX >= 20.0 && curX <= 36.0 && curZ >= 1.5 && curZ <= 30.5);

      if (onBridge && typeof window.getBridgeDeckY === 'function') {
        const yCab = window.getBridgeDeckY(curZ);
        this.mesh.position.y = yCab + 0.08;
      } else {
        this.mesh.rotation.x = 0;
        this.mesh.position.y = 0.22;
      }

      // Giới hạn trong bản đồ mở rộng
      this.mesh.position.x = Math.max(-130, Math.min(this.mesh.position.x, 150));
      this.mesh.position.z = Math.max(-130, Math.min(this.mesh.position.z, 180));

      // Quay bánh xe đầu kéo
      this.wheels.forEach(w => w.rotateX(this.velocity * dt * 2.4));

      // -----------------------------------------------------------------------
      // VẬT LÝ KHỚP NỐI RƠ-MOÓC (TRAILER HITCH ARTICULATION)
      // -----------------------------------------------------------------------
      const hitchOffset = new THREE.Vector3(0, 0, -2.2).applyEuler(this.mesh.rotation);
      const hitchPos = this.mesh.position.clone().add(hitchOffset);

      // Tính góc mục tiêu của rơ-moóc hướng vào chốt kéo
      const dx = hitchPos.x - this.trailerMesh.position.x;
      const dz = hitchPos.z - this.trailerMesh.position.z;
      const targetAngle = Math.atan2(dx, dz);

      let angleDiff = targetAngle - this.trailerMesh.rotation.y;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      this.trailerMesh.rotation.y += angleDiff * Math.min(1.0, dt * 7.5);

      // Định vị rơ-moóc cố định khoảng cách với chốt kéo
      const trailerBackOffset = new THREE.Vector3(0, 0, -3.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.trailerMesh.rotation.y);
      this.trailerMesh.position.copy(hitchPos).add(trailerBackOffset);

      if (onBridge && typeof window.getBridgeDeckY === 'function') {
        this.trailerMesh.position.y = window.getBridgeDeckY(this.trailerMesh.position.z) + 0.08;
      } else {
        this.trailerMesh.position.y = 0.22;
      }

      this.trailerWheels.forEach(tw => tw.rotateX(this.velocity * dt * 2.4));

      // Khói ống xả khi đạp ga
      if (Math.abs(this.velocity) > 2.0 && Math.random() < 0.3) {
        if (typeof spawnParticle === 'function') {
          const exColor = gameState.nitroBoostTimer > 0 ? 0x06b6d4 : 0x475569;
          spawnParticle(this.mesh.position.clone().add(new THREE.Vector3(-1.25, 4.8, -1.5)), exColor);
          spawnParticle(this.mesh.position.clone().add(new THREE.Vector3(1.25, 4.8, -1.5)), exColor);
        }
      }

      // Kiểm tra ô sạc Nitro trạm xăng
      if (window.gasStationPad && this.mesh.position.distanceTo(window.gasStationPad.pos) <= window.gasStationPad.radius) {
        if (gameState.nitroBoostTimer <= 0) {
          gameState.nitroBoostTimer = 15.0;
          if (typeof sounds !== 'undefined' && sounds.playLevelUp) sounds.playLevelUp();
          if (typeof spawnFloatingText === 'function') {
            spawnFloatingText(this.mesh.position.clone().add(new THREE.Vector3(0, 4.5, 0)), '⚡ NITRO BOOST TĂNG TỐC 15 GIÂY (x1.8 TỐC ĐỘ)!', '#38bdf8');
          }
          if (typeof showToast === 'function') showToast('⚡ ĐÃ KÍCH HOẠT NITRO TĂNG TỐC CHO XE TẢI!');
        }
      }

      // Tự động nạp gỗ nếu dừng tại Bãi Xúc Gỗ Xưởng Cưa
      if (window.sawmillLoadingPad && this.mesh.position.distanceTo(window.sawmillLoadingPad.pos) <= window.sawmillLoadingPad.radius) {
        if (this.loadCooldown <= 0 && Math.abs(this.velocity) < 1.0) {
          this.loadCooldown = 1.5;
          this.tryLoadWoodCargo();
        }
      }

      // Tự động giao hàng nếu dừng tại Delivery Hub
      if (window.lumberDeliveryHubs && Math.abs(this.velocity) < 1.5 && this.deliverCooldown <= 0) {
        for (let hub of window.lumberDeliveryHubs) {
          if (this.mesh.position.distanceTo(hub.pos) <= hub.radius) {
            this.deliverCooldown = 3.0;
            this.tryDeliverCargo(hub);
            break;
          }
        }
      }
    } else {
      // Khi đang đi bộ ngoài xe
      if (distToPlayer <= 5.5) {
        if (promptEl) {
          promptEl.classList.add('active');
          if (promptText) promptText.textContent = 'LÊN LÁI XE TẢI ĐẦU KÉO [E]';
        }
        this.promptSign.visible = true;
        this.promptSign.lookAt(playerPos.x, 4.6, playerPos.z);
      } else {
        this.promptSign.visible = false;
      }
    }
  }
}
window.DrivableLumberTruck = DrivableLumberTruck;

// ===========================================================================
// 9d. XE TẢI LOGISTICS TUẦN TRA TỰ ĐỘNG ĐẠI LỘ VÀNH ĐAI (AUTONOMOUS LOGISTICS TRUCK)
// [TUẦN TRA LIÊN TỤC KHẮP ĐẠI LỘ VÀNH ĐAI - SINH THU NHẬP THỤ ĐỘNG +$350/S CHO ĐẾ CHẾ]
// ===========================================================================
class AutonomousLogisticsTruck {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.set(-110, 0.22, -110);
    this.mesh.rotation.order = 'YXZ';
    scene.add(this.mesh);

    this.trailerMesh = new THREE.Group();
    this.trailerMesh.position.set(-110, 0.22, -116);
    this.trailerMesh.rotation.order = 'YXZ';
    scene.add(this.trailerMesh);

    // Lộ trình tuần tra đại lộ vành đai khép kín
    this.waypoints = [
      new THREE.Vector3(-105, 0.22, -105),
      new THREE.Vector3(125, 0.22, -105),
      new THREE.Vector3(125, 0.22, 155),
      new THREE.Vector3(-105, 0.22, 155)
    ];
    this.currentWpIndex = 0;
    this.speed = 15.0; // 15 m/s
    this.passiveTimer = 0;

    this.buildModel();
  }

  buildModel() {
    const cabPaintMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.5 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.95 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 });

    // Đầu kéo AI
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 5.8), darkMat);
    chassis.position.set(0, 0.7, -0.4);
    this.mesh.add(chassis);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.2, 3.2), cabPaintMat);
    cab.position.set(0, 2.0, 0.6);
    this.mesh.add(cab);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.9, 0.1), glassMat);
    windshield.position.set(0, 2.3, 2.21);
    this.mesh.add(windshield);

    // Bảng LED tên công ty trên mui
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 0.15), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    sign.position.set(0, 3.2, 1.8);
    this.mesh.add(sign);

    // Thùng container rơ-moóc chuyên dụng vàng kim
    const container = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, 8.5), cabPaintMat);
    container.position.set(0, 2.1, 0);
    this.trailerMesh.add(container);

    // Viền khung thép
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.4, 8.6), darkMat);
    frame.position.set(0, 0.8, 0);
    this.trailerMesh.add(frame);
  }

  update(dt) {
    if (!this.waypoints || this.waypoints.length === 0) return;

    const targetWp = this.waypoints[this.currentWpIndex];
    const toTarget = new THREE.Vector3().subVectors(targetWp, this.mesh.position);
    toTarget.y = 0;
    const dist = toTarget.length();

    if (dist < 4.5) {
      this.currentWpIndex = (this.currentWpIndex + 1) % this.waypoints.length;
    } else {
      toTarget.normalize();
      const targetAngle = Math.atan2(toTarget.x, toTarget.z);

      let angleDiff = targetAngle - this.mesh.rotation.y;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.mesh.rotation.y += angleDiff * Math.min(1.0, dt * 3.5);

      const forward = new THREE.Vector3(0, 0, 1).applyEuler(this.mesh.rotation);
      this.mesh.position.addScaledVector(forward, this.speed * dt);
    }

    // Rơ-moóc bám theo
    const hitchOffset = new THREE.Vector3(0, 0, -2.0).applyEuler(this.mesh.rotation);
    const hitchPos = this.mesh.position.clone().add(hitchOffset);
    const dx = hitchPos.x - this.trailerMesh.position.x;
    const dz = hitchPos.z - this.trailerMesh.position.z;
    const trailerTargetAngle = Math.atan2(dx, dz);

    let tAngleDiff = trailerTargetAngle - this.trailerMesh.rotation.y;
    while (tAngleDiff > Math.PI) tAngleDiff -= Math.PI * 2;
    while (tAngleDiff < -Math.PI) tAngleDiff += Math.PI * 2;
    this.trailerMesh.rotation.y += tAngleDiff * Math.min(1.0, dt * 6.0);

    const backOffset = new THREE.Vector3(0, 0, -3.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.trailerMesh.rotation.y);
    this.trailerMesh.position.copy(hitchPos).add(backOffset);

    // Tích lũy tiền thụ động +$350/giây cho người chơi từ hoạt động logistics
    this.passiveTimer += dt;
    if (this.passiveTimer >= 1.0) {
      this.passiveTimer = 0;
      if (typeof gameState !== 'undefined') {
        gameState.money = (gameState.money || 0) + 350;
      }
    }
  }
}
window.AutonomousLogisticsTruck = AutonomousLogisticsTruck;


// ===========================================================================
// HỆ THỐNG NHÂN CÔNG ĐA LĨNH VỰC (MULTI-SECTOR WORKFORCE)
// [THỦY SẢN, NỘI THẤT, MỎ VÀNG, RESORT MALDIVES, SÂN BAY SKYCARGO]
// ===========================================================================

// 1. NGƯ DÂN BẾN CẦU TÀU (FISHERMAN AGENT - LĨNH VỰC THỦY SẢN)
class FishermanAgent {
  constructor(scene, id = 0) {
    this.scene = scene;
    this.id = id;
    this.mesh = new THREE.Group();
    // Vị trí dọc theo cầu tàu gỗ (X: 5.2 hoặc 6.8, Z: 8.0 đến 16.0)
    const pz = 8.0 + id * 2.4;
    const px = (id % 2 === 0) ? 5.2 : 6.8;
    this.mesh.position.set(px, 0.45, pz);
    this.mesh.rotation.y = (id % 2 === 0) ? -Math.PI / 2 : Math.PI / 2;
    scene.add(this.mesh);

    this.fig = buildStylizedWorkerFigure(this.mesh, {
      shirtColor: 0x0284c7, // Áo len xanh biển
      vestColor: null,
      pantsColor: 0x1e3a8a, // Quần ủng lội nước
      headwearType: 'straw',
      headwearColor: 0xfacc15
    });

    // Cần câu tre 3D
    const rodGeo = new THREE.CylinderGeometry(0.03, 0.06, 3.2, 8);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
    this.rod = new THREE.Mesh(rodGeo, rodMat);
    this.rod.rotation.x = 1.1;
    this.rod.position.set(0.1, 0.4, 1.2);
    this.fig.rightHand.add(this.rod);

    // Con cá bạc giãy giụa khi kéo cần
    this.hookedFish = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.55, 6),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 })
    );
    this.hookedFish.rotation.z = Math.PI / 2;
    this.hookedFish.position.set(0, -1.2, 0);
    this.hookedFish.visible = false;
    this.rod.add(this.hookedFish);

    const nameTag = makeBillboardText('🎣 Ngư Dân Bến Cá', '#38bdf8', 190, 32);
    nameTag.position.set(0, 2.65, 0);
    this.mesh.add(nameTag);

    this.stateTimer = Math.random() * 3;
  }

  update(dt, playerPos) {
    this.stateTimer += dt;
    const isNear = !playerPos || this.mesh.position.distanceTo(playerPos) < 42.0;

    if (isNear) {
      this.rod.rotation.x = 1.1 + Math.sin(this.stateTimer * 3.0) * 0.08;
      this.fig.rightShoulder.rotation.x = -0.5 + Math.sin(this.stateTimer * 2.0) * 0.05;
    }

    // Chu kỳ 6 giây câu được 1 mẻ cá
    if (this.stateTimer >= 6.0) {
      this.stateTimer = 0;
      if (typeof gameState !== 'undefined') {
        gameState.freshFish = (gameState.freshFish || 0) + 1;
        gameState.money = (gameState.money || 0) + 35;
      }
      if (isNear) {
        this.hookedFish.visible = true;
        if (typeof sounds !== 'undefined' && sounds.playWaterSplash) sounds.playWaterSplash();
        if (typeof spawnFloatingText === 'function') {
          spawnFloatingText(this.mesh.position.clone().add(new THREE.Vector3(0, 3.0, 0)), '+1 Cá Tươi 🐟 (+$35)', '#38bdf8');
        }
        setTimeout(() => {
          if (this.hookedFish) this.hookedFish.visible = false;
        }, 1500);
      }
      if (typeof updateHUD === 'function') updateHUD();
    }
  }
}
window.FishermanAgent = FishermanAgent;

// 2. THỢ MỘC NỘI THẤT BẮC ÂU (MASTER CARPENTER AGENT - LĨNH VỰC NỘI THẤT)
class MasterCarpenterAgent {
  constructor(scene, id = 0) {
    this.scene = scene;
    this.id = id;
    this.mesh = new THREE.Group();
    // Tại Xưởng Nội Thất (X: -36 đến -30, Z: 112 đến 118)
    const px = -35.0 + id * 2.6;
    const pz = 114.0 + (id % 2) * 2.0;
    this.mesh.position.set(px, 0.22, pz);
    this.mesh.rotation.y = 0;
    scene.add(this.mesh);

    this.fig = buildStylizedWorkerFigure(this.mesh, {
      shirtColor: 0xb45309, // Áo thợ mộc
      vestColor: 0x78350f,  // Tạp dề da
      pantsColor: 0x334155,
      headwearType: 'cap',
      headwearColor: 0x1e293b
    });

    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.85, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.7 })
    );
    bench.position.set(0, 0.42, 0.7);
    this.mesh.add(bench);

    const hammer = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.5, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 })
    );
    hammer.position.set(0, 0, 0.2);
    this.fig.rightHand.add(hammer);

    const nameTag = makeBillboardText('🪑 Thợ Mộc Bắc Âu', '#f97316', 190, 32);
    nameTag.position.set(0, 2.65, 0);
    this.mesh.add(nameTag);

    this.timer = Math.random() * 4;
  }

  update(dt, playerPos) {
    this.timer += dt;
    const isNear = !playerPos || this.mesh.position.distanceTo(playerPos) < 42.0;

    if (isNear) {
      const swing = Math.sin(this.timer * 6.0);
      this.fig.rightShoulder.rotation.x = -0.7 + swing * 0.45;
      this.fig.rightElbow.rotation.x = -0.5 + Math.max(0, swing) * 0.5;
    }

    // Chu kỳ 8 giây đóng xong 1 bộ bàn ghế
    if (this.timer >= 8.0) {
      this.timer = 0;
      if (typeof gameState !== 'undefined') {
        gameState.furniture = (gameState.furniture || 0) + 1;
        gameState.money = (gameState.money || 0) + 75;
      }
      if (isNear) {
        if (typeof sounds !== 'undefined' && sounds.playWoodPlank) sounds.playWoodPlank();
        if (typeof spawnFloatingText === 'function') {
          spawnFloatingText(this.mesh.position.clone().add(new THREE.Vector3(0, 3.0, 0)), '+1 Bàn Ghế Bắc Âu 🪑 (+$75)', '#f97316');
        }
      }
      if (typeof updateHUD === 'function') updateHUD();
    }
  }
}
window.MasterCarpenterAgent = MasterCarpenterAgent;

// 3. THỢ MỎ VÀNG HOÀNG GIA (GOLD MINER AGENT - LĨNH VỰC KHAI KHOÁNG)
class GoldMinerAgent {
  constructor(scene, id = 0) {
    this.scene = scene;
    this.id = id;
    this.mesh = new THREE.Group();
    // Tại Mỏ Vàng Hoàng Gia (X: -76 đến -70, Z: 108 đến 114)
    const px = -74.0 + id * 2.5;
    const pz = 110.0 + (id % 2) * 2.2;
    this.mesh.position.set(px, 0.22, pz);
    this.mesh.rotation.y = Math.PI / 4;
    scene.add(this.mesh);

    this.fig = buildStylizedWorkerFigure(this.mesh, {
      shirtColor: 0x334155,
      vestColor: 0xeab308,
      pantsColor: 0x1e293b,
      headwearType: 'hardhat',
      headwearColor: 0xfacc15
    });

    const pickaxeGroup = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x78350f }));
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.75), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9 }));
    head.position.y = 0.55;
    pickaxeGroup.add(handle);
    pickaxeGroup.add(head);
    pickaxeGroup.position.set(0.1, 0.2, 0.3);
    this.fig.rightHand.add(pickaxeGroup);

    const headlamp = new THREE.PointLight(0xfef08a, 1.2, 8);
    headlamp.position.set(0, 0.35, 0.3);
    this.fig.headGroup.add(headlamp);

    const nameTag = makeBillboardText('🪙 Thợ Đào Mỏ Vàng', '#facc15', 190, 32);
    nameTag.position.set(0, 2.65, 0);
    this.mesh.add(nameTag);

    this.timer = Math.random() * 5;
  }

  update(dt, playerPos) {
    this.timer += dt;
    const isNear = !playerPos || this.mesh.position.distanceTo(playerPos) < 42.0;

    if (isNear) {
      const strike = Math.sin(this.timer * 5.0);
      this.fig.rightShoulder.rotation.x = -1.2 + strike * 0.8;
      this.fig.torsoGroup.rotation.x = Math.max(0, strike) * 0.15;
    }

    // Chu kỳ 10 giây đúc xong 1 thỏi vàng hoàng gia
    if (this.timer >= 10.0) {
      this.timer = 0;
      if (typeof gameState !== 'undefined') {
        gameState.goldBars = (gameState.goldBars || 0) + 1;
        gameState.money = (gameState.money || 0) + 150;
      }
      if (isNear) {
        if (typeof sounds !== 'undefined' && sounds.playLevelUp) sounds.playLevelUp();
        if (typeof spawnFloatingText === 'function') {
          spawnFloatingText(this.mesh.position.clone().add(new THREE.Vector3(0, 3.2, 0)), '+1 Thỏi Vàng 🪙 (+$150)', '#facc15');
        }
      }
      if (typeof updateHUD === 'function') updateHUD();
    }
  }
}
window.GoldMinerAgent = GoldMinerAgent;

// 4. NHÂN VIÊN PHA CHẾ RESORT MALDIVES (RESORT STAFF AGENT - LĨNH VỰC DU LỊCH)
class ResortStaffAgent {
  constructor(scene, id = 0) {
    this.scene = scene;
    this.id = id;
    this.mesh = new THREE.Group();
    // Tại Resort Maldives (X: 104 đến 112, Z: 138 đến 144)
    const px = 104.0 + id * 2.8;
    const pz = 140.0 + (id % 2) * 1.8;
    this.mesh.position.set(px, 0.22, pz);
    this.mesh.rotation.y = -Math.PI / 2;
    scene.add(this.mesh);

    this.fig = buildStylizedWorkerFigure(this.mesh, {
      shirtColor: 0x06b6d4,
      vestColor: null,
      pantsColor: 0xfef08a,
      headwearType: 'straw',
      headwearColor: 0xfef3c7
    });

    const shaker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.1, 0.45, 10),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 })
    );
    shaker.position.set(0, 0.1, 0.2);
    this.fig.rightHand.add(shaker);

    const nameTag = makeBillboardText('🍹 Pha Chế Resort', '#06b6d4', 190, 32);
    nameTag.position.set(0, 2.65, 0);
    this.mesh.add(nameTag);

    this.timer = Math.random() * 4;
  }

  update(dt, playerPos) {
    this.timer += dt;
    const isNear = !playerPos || this.mesh.position.distanceTo(playerPos) < 42.0;

    if (isNear) {
      const shake = Math.sin(this.timer * 9.0);
      this.fig.rightShoulder.rotation.x = -0.8 + shake * 0.25;
      this.fig.leftShoulder.rotation.x = -0.8 - shake * 0.25;
    }

    // Chu kỳ 7 giây phục vụ 1 lượt khách du lịch
    if (this.timer >= 7.0) {
      this.timer = 0;
      if (typeof gameState !== 'undefined') {
        gameState.money = (gameState.money || 0) + 120;
      }
      if (isNear) {
        if (typeof sounds !== 'undefined' && sounds.playCoin) sounds.playCoin();
        if (typeof spawnFloatingText === 'function') {
          spawnFloatingText(this.mesh.position.clone().add(new THREE.Vector3(0, 3.0, 0)), '+$120 Doanh Thu Resort 🍹💵', '#06b6d4');
        }
      }
      if (typeof updateHUD === 'function') updateHUD();
    }
  }
}
window.ResortStaffAgent = ResortStaffAgent;

// 5. ĐIỀU PHỐI VIÊN SÂN BAY SKYCARGO (AIRPORT CREW AGENT - LĨNH VỰC HÀNG KHÔNG)
class AirportCrewAgent {
  constructor(scene, id = 0) {
    this.scene = scene;
    this.id = id;
    this.mesh = new THREE.Group();
    // Tại Sân Bay SkyCargo (X: 88 đến 96, Z: 94 đến 100)
    const px = 88.0 + id * 3.0;
    const pz = 96.0 + (id % 2) * 2.0;
    this.mesh.position.set(px, 0.22, pz);
    this.mesh.rotation.y = 0;
    scene.add(this.mesh);

    this.fig = buildStylizedWorkerFigure(this.mesh, {
      shirtColor: 0x1e293b,
      vestColor: 0xeab308,
      pantsColor: 0x0f172a,
      headwearType: 'hardhat',
      headwearColor: 0xf97316
    });

    const wandGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8);
    const wandMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const wandL = new THREE.Mesh(wandGeo, wandMat);
    wandL.rotation.x = Math.PI / 2;
    wandL.position.set(0, 0, 0.3);
    this.fig.leftHand.add(wandL);

    const wandR = new THREE.Mesh(wandGeo, wandMat);
    wandR.rotation.x = Math.PI / 2;
    wandR.position.set(0, 0, 0.3);
    this.fig.rightHand.add(wandR);

    const nameTag = makeBillboardText('✈️ Điều Phối Sân Bay', '#8b5cf6', 190, 32);
    nameTag.position.set(0, 2.65, 0);
    this.mesh.add(nameTag);

    this.timer = Math.random() * 5;
  }

  update(dt, playerPos) {
    this.timer += dt;
    const isNear = !playerPos || this.mesh.position.distanceTo(playerPos) < 42.0;

    if (isNear) {
      const wave = Math.sin(this.timer * 4.0);
      this.fig.leftShoulder.rotation.z = 0.6 + wave * 0.35;
      this.fig.rightShoulder.rotation.z = -0.6 - wave * 0.35;
      this.fig.leftShoulder.rotation.x = -0.8;
      this.fig.rightShoulder.rotation.x = -0.8;
    }

    // Chu kỳ 9 giây điều phối cất cánh
    if (this.timer >= 9.0) {
      this.timer = 0;
      if (typeof gameState !== 'undefined') {
        gameState.money = (gameState.money || 0) + 220;
      }
      if (isNear) {
        if (typeof sounds !== 'undefined' && sounds.playLevelUp) sounds.playLevelUp();
        if (typeof spawnFloatingText === 'function') {
          spawnFloatingText(this.mesh.position.clone().add(new THREE.Vector3(0, 3.2, 0)), '+$220 Điều Phối Boeing 747 ✈️📦', '#8b5cf6');
        }
      }
      if (typeof updateHUD === 'function') updateHUD();
    }
  }
}
window.AirportCrewAgent = AirportCrewAgent;

function initVehicles(scene) {
  initWildlife(scene);

  // Khởi tạo Đoàn xe tải xếp hàng
  // truckFleet removed in favor of DrivableLumberTruck and loop traffic

  // Khởi tạo Siêu xe tải đầu kéo chở gỗ có rơ-moóc điều khiển được
  window.drivableLumberTruck = new DrivableLumberTruck(scene);

  // Khởi tạo Xe tải Logistics tuần tra tự động quanh đại lộ vành đai
  window.autonomousLogisticsTruck = new AutonomousLogisticsTruck(scene);

  // Khởi tạo Xe nâng có thể điều khiển trực tiếp
  window.drivableForklift = new DrivableForklift(scene);

  // Khởi tạo Xe bán tải Heavy Duty điều khiển được
  window.drivablePickup = new DrivablePickup(scene);

  // Khởi tạo Xe cảnh sát tuần tra Interceptor
  window.drivablePoliceCruiser = new DrivablePoliceCruiser(scene);

  // Khởi tạo Xe cứu hỏa khẩn cấp đô thị
  window.drivableFireEngine = new DrivableFireEngine(scene);

  // Khởi tạo Xe buýt công cộng 2 tầng (Drivable City Bus - Mục 51)
  window.drivableCityBus = new DrivableCityBus(scene);

  // Khởi tạo Xe taxi vàng đón khách (Drivable Yellow Cab - Mục 52)
  window.drivableYellowCab = new DrivableYellowCab(scene);

  // Khởi tạo Moto thể thao phân khối lớn (Sport Superbike - Mục 53)
  window.drivableSportSuperbike = new DrivableSportSuperbike(scene);

  // Khởi tạo Xe đạp thể thao dạo phố (Mountain Bike - Mục 54)
  window.drivableMountainBike = new DrivableMountainBike(scene);

  // Khởi tạo Ca nô cao tốc điều khiển được trên sông
  window.drivableSpeedboat = new DrivableSpeedboat(scene);

  // Khởi tạo Siêu máy bay Boeing 747 tại Sân bay Quốc tế
  window.airportBoeingJet = new AirportBoeingJet(scene);

  // Khởi tạo Trực thăng Du lịch VIP cất cánh bay tự do
  window.drivableHelicopter = new DrivableHelicopter(scene);

  // Khởi tạo Tuyến đoàn tàu hỏa hơi nước xuyên lục địa
  window.steamTrainSystem = new SteamTrainSystem(scene);

  // Khởi tạo Chú chó Shiba cưng đồng hành & nhặt tài nguyên
  window.shibaPetAgent = new ShibaPetAgent(scene);

  // Khởi tạo Hệ sinh thái động vật biển & hải âu (Cá heo nhảy & Chim hải âu)
  window.marineAvianWildlife = new MarineAvianWildlife(scene);

  // Khởi tạo Tàu cá đánh bắt trên sông
  window.fishingTrawler = new FishingTrawlerVehicle(scene);

  // Khởi tạo Tàu container cập cảng
  window.cargoShip = new CargoContainerShipVehicle(scene);

  // Khởi tạo Luồng giao thông xe chạy qua Cầu Vượt Sông
  window.bridgeTraffic = new BridgeTrafficSystem(scene);

  // Khởi tạo Thợ Vận Hành Máy Cưa
  sawOperator = new SawOperatorAgent(scene);
  window.sawOperator = sawOperator;

  // Khởi tạo Thợ Khiêng Gỗ Chuyên Nghiệp
  logCarrier = new LogCarrierAgent(scene);
  window.logCarrier = logCarrier;

  // Khởi tạo Thợ Bốc Xếp Ván Xe Tải
  plankStacker = new PlankStackerAgent(scene);
  window.plankStacker = plankStacker;

  // Đồng bộ toàn bộ nhân lực đa lĩnh vực
  syncVehiclesWithGameState();
}

function syncVehiclesWithGameState() {
  if (!window.scene) return;
  // 1. Lâm nghiệp: Thợ đốn củi
  const targetLumberjacks = (typeof gameState !== 'undefined' && gameState.workers) || 0;
  while (workers.length < targetLumberjacks) {
    workers.push(new LumberjackAgent(window.scene, workers.length));
  }
  while (workers.length > targetLumberjacks) {
    const w = workers.pop();
    if (w && w.mesh && window.scene) window.scene.remove(w.mesh);
  }

  // 2. Xe nâng hàng
  const targetForklifts = (typeof gameState !== 'undefined' && gameState.forklifts) || 0;
  while (forklifts.length < targetForklifts) {
    forklifts.push(new ForkliftAgent(window.scene, forklifts.length));
  }
  while (forklifts.length > targetForklifts) {
    const f = forklifts.pop();
    if (f && f.mesh && window.scene) window.scene.remove(f.mesh);
  }

  // 3. Thủy sản: Ngư dân bến cá
  const targetFishermen = (typeof gameState !== 'undefined' && gameState.fishermen) || 0;
  while (fishermen.length < targetFishermen) {
    fishermen.push(new FishermanAgent(window.scene, fishermen.length));
  }
  while (fishermen.length > targetFishermen) {
    const fm = fishermen.pop();
    if (fm && fm.mesh && window.scene) window.scene.remove(fm.mesh);
  }

  // 4. Nội thất: Thợ mộc Bắc Âu
  const targetCarpenters = (typeof gameState !== 'undefined' && gameState.carpenters) || 0;
  while (carpenters.length < targetCarpenters) {
    carpenters.push(new MasterCarpenterAgent(window.scene, carpenters.length));
  }
  while (carpenters.length > targetCarpenters) {
    const cp = carpenters.pop();
    if (cp && cp.mesh && window.scene) window.scene.remove(cp.mesh);
  }

  // 5. Khai khoáng: Thợ mỏ vàng hoàng gia
  const targetMiners = (typeof gameState !== 'undefined' && gameState.miners) || 0;
  while (miners.length < targetMiners) {
    miners.push(new GoldMinerAgent(window.scene, miners.length));
  }
  while (miners.length > targetMiners) {
    const mn = miners.pop();
    if (mn && mn.mesh && window.scene) window.scene.remove(mn.mesh);
  }

  // 6. Du lịch: Nhân viên pha chế Resort Maldives
  const targetResortStaff = (typeof gameState !== 'undefined' && gameState.resortStaff) || 0;
  while (resortStaff.length < targetResortStaff) {
    resortStaff.push(new ResortStaffAgent(window.scene, resortStaff.length));
  }
  while (resortStaff.length > targetResortStaff) {
    const rs = resortStaff.pop();
    if (rs && rs.mesh && window.scene) window.scene.remove(rs.mesh);
  }

  // 7. Hàng không: Điều phối viên Sân bay SkyCargo
  const targetAirportCrew = (typeof gameState !== 'undefined' && gameState.airportCrew) || 0;
  while (airportCrew.length < targetAirportCrew) {
    airportCrew.push(new AirportCrewAgent(window.scene, airportCrew.length));
  }
  while (airportCrew.length > targetAirportCrew) {
    const ac = airportCrew.pop();
    if (ac && ac.mesh && window.scene) window.scene.remove(ac.mesh);
  }
}
window.syncVehiclesWithGameState = syncVehiclesWithGameState;

function spawnLumberjackWorker() {
  syncVehiclesWithGameState();
}
window.spawnLumberjackWorker = spawnLumberjackWorker;
window.spawnLumberjackAgent = spawnLumberjackWorker;

function spawnForkliftAgent() {
  syncVehiclesWithGameState();
}
window.spawnForkliftAgent = spawnForkliftAgent;

// ===========================================================================
// DRONE HẬU CẦN THÔNG MINH (SMART AUTONOMOUS CARGO DRONE)
// ===========================================================================
class SmartCargoDroneSystem {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.set(9.2, 5.5, -18);
    this.scene.add(this.mesh);

    // Thân Drone tứ giác kim loại công nghệ cao
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.35, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.85, roughness: 0.25 })
    );
    body.castShadow = true;
    this.mesh.add(body);

    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    led.position.y = 0.22;
    this.mesh.add(led);

    // 4 cánh quạt quadcopter
    this.rotors = [];
    const armMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });
    const bladeGeo = new THREE.BoxGeometry(0.9, 0.02, 0.1);
    const bladeMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });

    [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].forEach(([rx, rz]) => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), armMat);
      arm.position.set(rx * 0.5, 0.05, rz * 0.5);
      arm.rotation.y = Math.atan2(rx, rz);
      this.mesh.add(arm);

      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 8), armMat);
      motor.position.set(rx, 0.1, rz);
      this.mesh.add(motor);

      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.set(rx, 0.22, rz);
      this.mesh.add(blade);
      this.rotors.push(blade);
    });

    // Thùng hàng pallet treo lơ lửng
    this.cargoMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.6, 0.9),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 })
    );
    this.cargoMesh.position.y = -0.7;
    this.cargoMesh.castShadow = true;
    this.mesh.add(this.cargoMesh);

    this.startPos = new THREE.Vector3(9.2, 5.5, -18);
    this.endPos = new THREE.Vector3(71, 7.5, 44);
    this.t = 0;
    this.direction = 1;
    this.speed = 0.09;
  }

  update(dt) {
    if (!gameState.researchTechs || !gameState.researchTechs.cargoDrones) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    // Cánh quạt quay tốc độ cao
    this.rotors.forEach(r => r.rotateY(dt * 40));

    // Di chuyển tịnh tiến hình sin lượn sóng
    this.t += this.direction * this.speed * dt;
    if (this.t >= 1.0) {
      this.t = 1.0;
      this.direction = -1;
      this.cargoMesh.visible = false; // Giao hàng tại cảng container

      const bonus = 250;
      gameState.money = (gameState.money || 0) + bonus;
      if (typeof sounds !== 'undefined' && sounds.playCoin) sounds.playCoin();
      if (typeof spawnFloatingText === 'function') {
        spawnFloatingText(this.endPos.clone().add(new THREE.Vector3(0, 2, 0)), `+$${bonus} Drone Hậu Cần 🛸`, '#38bdf8');
      }
      if (typeof updateHUD === 'function') updateHUD();
    } else if (this.t <= 0.0) {
      this.t = 0.0;
      this.direction = 1;
      this.cargoMesh.visible = true; // Lấy hàng tại xưởng cưa
    }

    this.mesh.position.lerpVectors(this.startPos, this.endPos, this.t);
    this.mesh.position.y += Math.sin(this.t * Math.PI) * 2.8;
    this.mesh.lookAt(this.direction > 0 ? this.endPos : this.startPos);
  }
}
window.SmartCargoDroneSystem = SmartCargoDroneSystem;

function updateVehicles(dt, time, playerPos) {
  // Đồng bộ số lượng 3D tuyệt đối với gameState
  if (typeof gameState !== 'undefined') {
    if (workers.length !== (gameState.workers || 0) || forklifts.length !== (gameState.forklifts || 0)) {
      syncVehiclesWithGameState();
    }
  }

  const workerDt = (gameState.overtimeRush && gameState.overtimeRush.active) ? (dt * 2.0) : dt;

  workers.forEach(w => w.update(workerDt, playerPos));
  forklifts.forEach(f => f.update(workerDt, playerPos));
  fishermen.forEach(fm => fm.update(workerDt, playerPos));
  carpenters.forEach(cp => cp.update(workerDt, playerPos));
  miners.forEach(mn => mn.update(workerDt, playerPos));
  resortStaff.forEach(rs => rs.update(workerDt, playerPos));
  airportCrew.forEach(ac => ac.update(workerDt, playerPos));
  if (logCarrier) logCarrier.update(workerDt, playerPos);
  if (sawOperator) sawOperator.update(workerDt, playerPos);
  if (plankStacker) plankStacker.update(workerDt, playerPos);
  // truckFleet update removed
  if (window.drivableLumberTruck) window.drivableLumberTruck.update(dt, playerPos);
  if (window.autonomousLogisticsTruck) window.autonomousLogisticsTruck.update(dt);
  if (window.drivableForklift) window.drivableForklift.update(dt, playerPos);
  if (window.drivablePickup) window.drivablePickup.update(dt, playerPos);
  if (window.drivablePoliceCruiser) window.drivablePoliceCruiser.update(dt, playerPos);
  if (window.drivableFireEngine) window.drivableFireEngine.update(dt, playerPos);
  if (window.drivableCityBus) window.drivableCityBus.update(dt, playerPos);
  if (window.drivableYellowCab) window.drivableYellowCab.update(dt, playerPos);
  if (window.drivableSportSuperbike) window.drivableSportSuperbike.update(dt, playerPos);
  if (window.drivableMountainBike) window.drivableMountainBike.update(dt, playerPos);
  if (window.drivableSpeedboat) window.drivableSpeedboat.update(dt, time, playerPos);
  if (window.airportBoeingJet) window.airportBoeingJet.update(dt);
  if (window.drivableHelicopter) window.drivableHelicopter.update(dt, time, playerPos);
  if (window.steamTrainSystem) window.steamTrainSystem.update(dt, time, playerPos);
  if (window.shibaPetAgent) window.shibaPetAgent.update(dt, time, playerPos);
  if (window.marineAvianWildlife) window.marineAvianWildlife.update(dt, time);
  if (window.fishingTrawler) window.fishingTrawler.update(dt, time);
  if (window.cargoShip) window.cargoShip.update(dt, time);
  if (window.bridgeTraffic) window.bridgeTraffic.update(dt);

  // Drone Hậu Cần Thông Minh R&D
  if (!window.smartCargoDrone && window.scene) {
    window.smartCargoDrone = new SmartCargoDroneSystem(window.scene);
  }
  if (window.smartCargoDrone) window.smartCargoDrone.update(dt);

  updateWildlife(dt, time, playerPos);

  // Bobbing animation on boat
  if (window.boatGroup && gameState.unlockedZones.includes(4)) {
    window.boatGroup.position.y = 0.2 + Math.sin(time * 2.5) * 0.08;
    window.boatGroup.rotation.z = Math.sin(time * 1.8) * 0.04;
  }
}

// ===========================================================================
// 51. XE BUÝT CÔNG CỘNG 2 TẦNG (DRIVABLE CITY BUS)
// ===========================================================================
class DrivableCityBus {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.set(-25, 0.22, 74);
    this.mesh.rotation.order = 'YXZ';
    scene.add(this.mesh);

    this.velocity = 0;
    this.maxSpeed = 14.0;
    this.accel = 12.0;
    this.brake = 20.0;
    this.turnSpeed = 1.6;

    const busBlue = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });

    // Thân xe 2 tầng
    const body1 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.8, 9.2), busBlue);
    body1.position.y = 1.35;
    body1.castShadow = true;
    this.mesh.add(body1);

    const body2 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.6, 9.2), whiteMat);
    body2.position.y = 2.95;
    body2.castShadow = true;
    this.mesh.add(body2);

    // Kính cửa sổ tầng 1 & 2
    const winGeo = new THREE.BoxGeometry(2.82, 0.65, 8.2);
    const win1 = new THREE.Mesh(winGeo, glassMat);
    win1.position.y = 1.45;
    this.mesh.add(win1);
    const win2 = new THREE.Mesh(winGeo, glassMat);
    win2.position.y = 3.05;
    this.mesh.add(win2);

    // Bánh xe
    this.wheels = [];
    const wGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12);
    wGeo.rotateZ(Math.PI / 2);
    [[-1.4, 0.55, 3.0], [1.4, 0.55, 3.0], [-1.4, 0.55, -3.0], [1.4, 0.55, -3.0]].forEach(([wx, wy, wz]) => {
      const w = new THREE.Mesh(wGeo, rubberMat);
      w.position.set(wx, wy, wz);
      this.mesh.add(w);
      this.wheels.push(w);
    });

    const billboardMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 0.05), billboardMat);
    sign.position.set(0, 3.65, 4.62);
    this.mesh.add(sign);
  }

  update(dt, playerPos) {
    if (!playerPos) return;
    const dist = this.mesh.position.distanceTo(playerPos);
    const promptEl = document.getElementById('vehicle-prompt-hud');
    const promptText = document.getElementById('vehicle-prompt-text');

    if (keysPressed['KeyE'] && dist <= 4.0 && !this.keyCooldown) {
      this.keyCooldown = true;
      setTimeout(() => this.keyCooldown = false, 400);
      gameState.isDrivingBus = !gameState.isDrivingBus;
      if (gameState.isDrivingBus) {
        if (typeof sounds !== 'undefined' && sounds.playBusHorn) sounds.playBusHorn();
        if (typeof showToast === 'function') showToast('🚌 Đang lái Xe Buýt 2 Tầng: Dừng tại các trạm để đón khách (+$15/khách)!');
      }
    }

    if (gameState.isDrivingBus) {
      if (promptEl) {
        promptEl.classList.add('active');
        if (promptText) promptText.textContent = 'XUỐNG XE BUÝT [E]';
      }

      let throttle = 0;
      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) throttle += 1;
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) throttle -= 1;

      let steer = 0;
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) steer += 1;
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) steer -= 1;

      if (throttle !== 0) {
        this.velocity += throttle * this.accel * dt;
        this.velocity = Math.max(-this.maxSpeed * 0.4, Math.min(this.velocity, this.maxSpeed));
      } else {
        if (Math.abs(this.velocity) > 0.1) {
          const s = Math.sign(this.velocity);
          this.velocity -= s * this.brake * dt;
          if (Math.sign(this.velocity) !== s) this.velocity = 0;
        } else {
          this.velocity = 0;
        }
      }

      if (Math.abs(this.velocity) > 0.1) {
        this.mesh.rotation.y += steer * this.turnSpeed * dt * Math.sign(this.velocity);
      }

      const forward = new THREE.Vector3(0, 0, 1).applyEuler(this.mesh.rotation);
      this.mesh.position.addScaledVector(forward, this.velocity * dt);
      this.wheels.forEach(w => w.rotateX(this.velocity * dt * 2.5));

      // Đón khách tại trạm xe buýt
      if (Math.abs(this.velocity) < 0.5) {
        this.busStopTimer = (this.busStopTimer || 0) + dt;
        if (this.busStopTimer >= 2.0) {
          this.busStopTimer = 0;
          gameState.money = (gameState.money || 0) + 45;
          if (typeof sounds !== 'undefined' && sounds.playCoin) sounds.playCoin();
          if (typeof showToast === 'function') showToast('🚏 TRẠM XE BUÝT: Đã đón 3 hành khách! Nhận +$45 USD tiền vé!');
        }
      }
    } else if (dist <= 4.0) {
      if (promptEl) {
        promptEl.classList.add('active');
        if (promptText) promptText.textContent = 'LÊN LÁI XE BUÝT 2 TẦNG [E]';
      }
    }
  }
}
window.DrivableCityBus = DrivableCityBus;

// ===========================================================================
// 52. XE TAXI VÀNG ĐÓN KHÁCH (DRIVABLE YELLOW CAB)
// ===========================================================================
class DrivableYellowCab {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.set(-36, 0.18, 71);
    this.mesh.rotation.order = 'YXZ';
    scene.add(this.mesh);

    this.velocity = 0;
    this.maxSpeed = 19.0;
    this.accel = 24.0;
    this.brake = 30.0;
    this.turnSpeed = 2.4;

    const taxiYellow = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.2 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });

    // Thân xe Sedan
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.5), taxiYellow);
    body.position.y = 0.65;
    body.castShadow = true;
    this.mesh.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.4), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 }));
    cabin.position.set(0, 1.25, -0.2);
    this.mesh.add(cabin);

    // Hộp đèn TAXI trên nóc
    const taxiSign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.3), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
    taxiSign.position.set(0, 1.68, -0.2);
    this.mesh.add(taxiSign);

    // Bánh xe
    this.wheels = [];
    const wGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
    wGeo.rotateZ(Math.PI / 2);
    [[-1.05, 0.38, 1.3], [1.05, 0.38, 1.3], [-1.05, 0.38, -1.3], [1.05, 0.38, -1.3]].forEach(([wx, wy, wz]) => {
      const w = new THREE.Mesh(wGeo, rubberMat);
      w.position.set(wx, wy, wz);
      this.mesh.add(w);
      this.wheels.push(w);
    });
  }

  update(dt, playerPos) {
    if (!playerPos) return;
    const dist = this.mesh.position.distanceTo(playerPos);
    const promptEl = document.getElementById('vehicle-prompt-hud');
    const promptText = document.getElementById('vehicle-prompt-text');

    if (keysPressed['KeyE'] && dist <= 3.5 && !this.keyCooldown) {
      this.keyCooldown = true;
      setTimeout(() => this.keyCooldown = false, 400);
      gameState.isDrivingTaxi = !gameState.isDrivingTaxi;
      if (gameState.isDrivingTaxi) {
        if (typeof showToast === 'function') showToast('🚕 Đang lái Taxi New York: Bấm [Space] drift, chở khách vẫy tay để nhận tiền cước!');
      }
    }

    if (gameState.isDrivingTaxi) {
      if (promptEl) {
        promptEl.classList.add('active');
        if (promptText) promptText.textContent = 'XUỐNG XE TAXI [E]';
      }

      let throttle = 0;
      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) throttle += 1;
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) throttle -= 1;

      let steer = 0;
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) steer += 1;
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) steer -= 1;

      if (keysPressed['Space'] && Math.abs(this.velocity) > 2.0) {
        this.mesh.rotation.y += (steer || 1.0) * this.turnSpeed * dt * 2.0;
        this.velocity *= 0.94;
        if (typeof sounds !== 'undefined' && sounds.playDriftScreech) sounds.playDriftScreech();
      }

      if (throttle !== 0) {
        this.velocity += throttle * this.accel * dt;
        this.velocity = Math.max(-this.maxSpeed * 0.45, Math.min(this.velocity, this.maxSpeed));
      } else {
        if (Math.abs(this.velocity) > 0.1) {
          const s = Math.sign(this.velocity);
          this.velocity -= s * this.brake * dt;
          if (Math.sign(this.velocity) !== s) this.velocity = 0;
        } else {
          this.velocity = 0;
        }
      }

      if (Math.abs(this.velocity) > 0.1) {
        this.mesh.rotation.y += steer * this.turnSpeed * dt * Math.sign(this.velocity);
      }

      const forward = new THREE.Vector3(0, 0, 1).applyEuler(this.mesh.rotation);
      this.mesh.position.addScaledVector(forward, this.velocity * dt);
      this.wheels.forEach(w => w.rotateX(this.velocity * dt * 3.0));
    } else if (dist <= 3.5) {
      if (promptEl) {
        promptEl.classList.add('active');
        if (promptText) promptText.textContent = 'LÊN LÁI XE TAXI VÀNG [E]';
      }
    }
  }
}
window.DrivableYellowCab = DrivableYellowCab;

// ===========================================================================
// 53. MOTO THỂ THAO PHÂN KHỐI LỚN (SPORT SUPERBIKE)
// ===========================================================================
class DrivableSportSuperbike {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.set(96, 0.18, 48);
    this.mesh.rotation.order = 'YXZ';
    scene.add(this.mesh);

    this.velocity = 0;
    this.maxSpeed = 26.0;
    this.accel = 32.0;
    this.brake = 36.0;
    this.turnSpeed = 3.2;

    const bikeMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.8, roughness: 0.2 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });

    // Khung sườn xe đua
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 2.2), bikeMat);
    frame.position.y = 0.65;
    this.mesh.add(frame);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.7), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }));
    seat.position.set(0, 0.95, -0.3);
    this.mesh.add(seat);

    // Ghi đông tay lái
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.08), chromeMat);
    bar.position.set(0, 1.15, 0.65);
    this.mesh.add(bar);

    // 2 Bánh xe
    this.wheels = [];
    const wGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.24, 12);
    wGeo.rotateZ(Math.PI / 2);
    [0.95, -0.95].forEach(wz => {
      const w = new THREE.Mesh(wGeo, rubberMat);
      w.position.set(0, 0.38, wz);
      this.mesh.add(w);
      this.wheels.push(w);
    });
  }

  update(dt, playerPos) {
    if (!playerPos) return;
    const dist = this.mesh.position.distanceTo(playerPos);
    const promptEl = document.getElementById('vehicle-prompt-hud');
    const promptText = document.getElementById('vehicle-prompt-text');

    if (keysPressed['KeyE'] && dist <= 3.0 && !this.keyCooldown) {
      this.keyCooldown = true;
      setTimeout(() => this.keyCooldown = false, 400);
      gameState.isDrivingBike = !gameState.isDrivingBike;
      if (gameState.isDrivingBike) {
        if (typeof showToast === 'function') showToast('🏍️ Đang lái Moto Thể Thao: Tốc độ tối đa 26 m/s, nghiêng người ôm cua điệu nghệ!');
      }
    }

    if (gameState.isDrivingBike) {
      if (promptEl) {
        promptEl.classList.add('active');
        if (promptText) promptText.textContent = 'XUỐNG MOTO [E]';
      }

      let throttle = 0;
      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) throttle += 1;
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) throttle -= 1;

      let steer = 0;
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) steer += 1;
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) steer -= 1;

      if (throttle !== 0) {
        this.velocity += throttle * this.accel * dt;
        this.velocity = Math.max(-this.maxSpeed * 0.3, Math.min(this.velocity, this.maxSpeed));
      } else {
        if (Math.abs(this.velocity) > 0.1) {
          const s = Math.sign(this.velocity);
          this.velocity -= s * this.brake * dt;
          if (Math.sign(this.velocity) !== s) this.velocity = 0;
        } else {
          this.velocity = 0;
        }
      }

      if (Math.abs(this.velocity) > 0.1) {
        this.mesh.rotation.y += steer * this.turnSpeed * dt * Math.sign(this.velocity);
        // Độ nghiêng khi ôm cua (Body Leaning)
        this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, -steer * 0.32, dt * 8.0);
      } else {
        this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, dt * 6.0);
      }

      const forward = new THREE.Vector3(0, 0, 1).applyEuler(this.mesh.rotation);
      this.mesh.position.addScaledVector(forward, this.velocity * dt);
      this.wheels.forEach(w => w.rotateX(this.velocity * dt * 4.0));
    } else if (dist <= 3.0) {
      if (promptEl) {
        promptEl.classList.add('active');
        if (promptText) promptText.textContent = 'LÊN LÁI MOTO THỂ THAO [E]';
      }
    }
  }
}
window.DrivableSportSuperbike = DrivableSportSuperbike;

// ===========================================================================
// 54. XE ĐẠP THỂ THAO ĐỊA HÌNH (MOUNTAIN BIKE)
// ===========================================================================
class DrivableMountainBike {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.set(-10, 0.18, 38);
    this.mesh.rotation.order = 'YXZ';
    scene.add(this.mesh);

    this.velocity = 0;
    this.maxSpeed = 11.0;
    this.accel = 10.0;
    this.brake = 18.0;
    this.turnSpeed = 2.6;

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.4 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95 });

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 1.6), frameMat);
    frame.position.y = 0.55;
    this.mesh.add(frame);

    this.wheels = [];
    const wGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.12, 10);
    wGeo.rotateZ(Math.PI / 2);
    [0.75, -0.75].forEach(wz => {
      const w = new THREE.Mesh(wGeo, rubberMat);
      w.position.set(0, 0.34, wz);
      this.mesh.add(w);
      this.wheels.push(w);
    });
  }

  update(dt, playerPos) {
    if (!playerPos) return;
    const dist = this.mesh.position.distanceTo(playerPos);
    const promptEl = document.getElementById('vehicle-prompt-hud');
    const promptText = document.getElementById('vehicle-prompt-text');

    if (keysPressed['KeyE'] && dist <= 2.8 && !this.keyCooldown) {
      this.keyCooldown = true;
      setTimeout(() => this.keyCooldown = false, 400);
      gameState.isDrivingBicycle = !gameState.isDrivingBicycle;
      if (gameState.isDrivingBicycle) {
        if (typeof showToast === 'function') showToast('🚲 Đang đạp Xe Đạp Thể Thao: Không tốn xăng, thân thiện môi trường!');
      }
    }

    if (gameState.isDrivingBicycle) {
      if (promptEl) {
        promptEl.classList.add('active');
        if (promptText) promptText.textContent = 'XUỐNG XE ĐẠP [E]';
      }

      let throttle = 0;
      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) throttle += 1;
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) throttle -= 1;

      let steer = 0;
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) steer += 1;
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) steer -= 1;

      if (throttle !== 0) {
        this.velocity += throttle * this.accel * dt;
        this.velocity = Math.max(-this.maxSpeed * 0.25, Math.min(this.velocity, this.maxSpeed));
      } else {
        if (Math.abs(this.velocity) > 0.1) {
          const s = Math.sign(this.velocity);
          this.velocity -= s * this.brake * dt;
          if (Math.sign(this.velocity) !== s) this.velocity = 0;
        } else {
          this.velocity = 0;
        }
      }

      if (Math.abs(this.velocity) > 0.1) {
        this.mesh.rotation.y += steer * this.turnSpeed * dt * Math.sign(this.velocity);
      }

      const forward = new THREE.Vector3(0, 0, 1).applyEuler(this.mesh.rotation);
      this.mesh.position.addScaledVector(forward, this.velocity * dt);
      this.wheels.forEach(w => w.rotateX(this.velocity * dt * 3.5));
    } else if (dist <= 2.8) {
      if (promptEl) {
        promptEl.classList.add('active');
        if (promptText) promptText.textContent = 'LÊN ĐẠP XE ĐẠP [E]';
      }
    }
  }
}
window.DrivableMountainBike = DrivableMountainBike;
