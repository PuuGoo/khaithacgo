/**
 * Playable Humanoid Character & Realistic Carrying Physics
 * Flannel shirt, blue jeans, boots, cap, dynamic spine lean, organized 2x2 back-stacking, magnet ring & hit recoil
 */

class PlayerCharacter {
  constructor(scene) {
    this.mesh = new THREE.Group();
    this.mesh.position.set(-16, 0, -18);
    scene.add(this.mesh);

    this.baseSpeed = 7.0;
    this.isMoving = false;
    this.animTimer = 0;
    this.isChopping = false;
    this.chopTimer = 0;
    this.chopCooldown = 0;
    this.hitStopTimer = 0;
    this.moveInput = new THREE.Vector3();
    this.targetPos = null;

    // Torso Group (cột sống con người, cho phép uốn cong & nghiêng khi mang vác)
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.78, 0);
    this.mesh.add(this.torsoGroup);

    // Vật liệu nhân vật người chân thực
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd8b8, roughness: 0.65 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    const browMat = new THREE.MeshBasicMaterial({ color: 0x271910 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.8 }); // Caro đỏ flannel
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.7 }); // Da thuộc thắt lưng
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.25 });
    const denimMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.85 }); // Quần jeans xanh
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75 }); // Găng tay da vàng
    const bootLeatherMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 }); // Da giày bốt
    const bootSoleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95 }); // Đế cao su rãnh bám
    this.shirtMat = shirtMat;
    this.denimMat = denimMat;

    // 1. Thân trên & Ngực nở vai rộng (Contoured Muscular Human Torso)
    const upperChest = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.58, 0.48), shirtMat);
    upperChest.position.y = 0.56;
    upperChest.castShadow = true;
    this.torsoGroup.add(upperChest);

    // Áo gile bảo hộ kỹ sư phản quang (High-Vis Safety Harness / Vest)
    const safetyVestMat = new THREE.MeshStandardMaterial({
      color: 0x84cc16,
      roughness: 0.4,
      emissive: 0x4d7c0f,
      emissiveIntensity: 0.15
    });
    this.safetyVestMat = safetyVestMat;
    const vestStripeHoriz = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.09, 0.5), safetyVestMat);
    vestStripeHoriz.position.y = 0.52;
    this.torsoGroup.add(vestStripeHoriz);

    [-0.24, 0.24].forEach(vx => {
      const vestStrap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.54, 0.5), safetyVestMat);
      vestStrap.position.set(vx, 0.56, 0);
      this.torsoGroup.add(vestStrap);
    });

    // Thân dưới / Bụng thon gọn
    const lowerAbdomen = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.38, 0.42), shirtMat);
    lowerAbdomen.position.y = 0.22;
    lowerAbdomen.castShadow = true;
    this.torsoGroup.add(lowerAbdomen);

    // Cổ áo sơ mi bẻ đôi (Shirt Collar)
    [-0.14, 0.14].forEach(cx => {
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.24), shirtMat);
      collar.position.set(cx, 0.86, 0.12);
      collar.rotation.z = cx > 0 ? -0.2 : 0.2;
      collar.rotation.x = -0.15;
      this.torsoGroup.add(collar);
    });

    // Thắt lưng da lao động & Khóa đồng công nghiệp
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.45), beltMat);
    belt.position.y = 0.05;
    this.torsoGroup.add(belt);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.06), brassMat);
    buckle.position.set(0, 0.05, 0.23);
    this.torsoGroup.add(buckle);

    // Túi da đựng đồ nghề & Quai móc búa bên hông
    const toolPouch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.14), beltMat);
    toolPouch.position.set(-0.42, 0.04, 0.05);
    this.torsoGroup.add(toolPouch);

    const hammerRing = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 12), brassMat);
    hammerRing.position.set(0.42, 0.04, 0.05);
    hammerRing.rotation.y = Math.PI / 2;
    this.torsoGroup.add(hammerRing);

    // 2. Đầu & Khuôn mặt con người hoàn chỉnh (Head, Face, Eyes, Nose, Hair, Cap)
    this.neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.22, 10), skinMat);
    this.neck.position.y = 0.9;
    this.torsoGroup.add(this.neck);

    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.22, 0);
    this.torsoGroup.add(this.headGroup);

    // Hộp sọ đầu
    const cranium = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.52), skinMat);
    cranium.castShadow = true;
    this.headGroup.add(cranium);

    // Tai 2 bên (Ears)
    [-0.28, 0.28].forEach(ex => {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.1), skinMat);
      ear.position.set(ex, 0.02, -0.02);
      this.headGroup.add(ear);
    });

    // Mũi người 3D (Sculpted Nose)
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 4), skinMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.02, 0.28);
    this.headGroup.add(nose);

    // Đôi mắt người sống động (Tròng trắng + Đồng tử đen) với khả năng chớp mắt
    this.eyes = [];
    [-0.13, 0.13].forEach(eyeX => {
      const eyePivot = new THREE.Group();
      eyePivot.position.set(eyeX, 0.08, 0.265);
      this.headGroup.add(eyePivot);
      this.eyes.push(eyePivot);

      const eyeWhite = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.03), eyeWhiteMat);
      eyePivot.add(eyeWhite);

      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), pupilMat);
      pupil.position.set(0, 0, 0.013);
      eyePivot.add(pupil);

      // Lông mày đậm nam tính
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.035, 0.03), browMat);
      brow.position.set(eyeX, 0.14, 0.27);
      brow.rotation.z = eyeX > 0 ? -0.1 : 0.1;
      this.headGroup.add(brow);
    });

    // Tóc mai & Chân tóc (Hair)
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.28, 0.3), hairMat);
    hairBack.position.set(0, 0.08, -0.16);
    this.headGroup.add(hairBack);

    // Mũ lưỡi trai thợ rừng (Pro Logger Baseball Cap) có đèn rọi trán
    const capCrown = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.24, 0.58), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    capCrown.position.set(0, 0.25, -0.01);
    this.headGroup.add(capCrown);

    // Đèn pin đeo trán thợ mỏ/thợ rừng (Headlamp)
    const headlamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.08, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.35, roughness: 0.3 })
    );
    headlamp.rotateX(Math.PI / 2);
    headlamp.position.set(0, 0.28, 0.31);
    this.headGroup.add(headlamp);

    const capButton = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 8), brassMat);
    capButton.position.set(0, 0.38, -0.01);
    this.headGroup.add(capButton);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.32), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    visor.position.set(0, 0.16, 0.4);
    visor.rotation.x = 0.18;
    this.headGroup.add(visor);

    // 3. Khớp cánh tay 2 phân đoạn chuẩn giải phẫu (2-Segment Articulated Arms)
    // Cánh tay trái: Vai -> Bắp tay -> Khuỷu tay -> Cẳng tay -> Bàn tay/Găng tay
    this.leftShoulderPivot = new THREE.Group();
    this.leftShoulderPivot.position.set(-0.52, 0.72, 0);
    this.torsoGroup.add(this.leftShoulderPivot);

    const leftUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.36, 8), shirtMat);
    leftUpperArm.position.y = -0.18;
    leftUpperArm.castShadow = true;
    this.leftShoulderPivot.add(leftUpperArm);

    this.leftElbowPivot = new THREE.Group();
    this.leftElbowPivot.position.set(0, -0.34, 0);
    this.leftShoulderPivot.add(this.leftElbowPivot);

    const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.34, 8), skinMat);
    leftForearm.position.y = -0.16;
    leftForearm.castShadow = true;
    this.leftElbowPivot.add(leftForearm);

    this.leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.16), gloveMat);
    this.leftHand.position.set(0, -0.34, 0);
    this.leftElbowPivot.add(this.leftHand);

    // Cánh tay phải: Vai -> Bắp tay -> Khuỷu tay -> Cẳng tay -> Tay cầm vũ khí
    this.rightShoulderPivot = new THREE.Group();
    this.rightShoulderPivot.position.set(0.52, 0.72, 0);
    this.torsoGroup.add(this.rightShoulderPivot);

    const rightUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.36, 8), shirtMat);
    rightUpperArm.position.y = -0.18;
    rightUpperArm.castShadow = true;
    this.rightShoulderPivot.add(rightUpperArm);

    this.rightElbowPivot = new THREE.Group();
    this.rightElbowPivot.position.set(0, -0.34, 0);
    this.rightShoulderPivot.add(this.rightElbowPivot);

    const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.34, 8), skinMat);
    rightForearm.position.y = -0.16;
    rightForearm.castShadow = true;
    this.rightElbowPivot.add(rightForearm);

    this.rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.16), gloveMat);
    this.rightHand.position.set(0, -0.34, 0);
    this.rightElbowPivot.add(this.rightHand);

    // Gắn vũ khí rìu vào tay phải
    this.axe = new THREE.Group();
    this.rightHand.add(this.axe);
    this.currentAxeTier = -1;
    this.currentFeverState = false;
    this.updateWeaponAppearance();

    // 4. Khớp chân 2 phân đoạn chuẩn giải phẫu (2-Segment Articulated Legs + Lug Boots)
    // Chân trái: Khớp háng -> Đùi -> Khớp đầu gối -> Bắp chuối -> Giày bốt
    this.leftHipPivot = new THREE.Group();
    this.leftHipPivot.position.set(-0.22, 0.76, 0);
    this.mesh.add(this.leftHipPivot);

    const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.42, 8), denimMat);
    leftThigh.position.y = -0.21;
    leftThigh.castShadow = true;
    this.leftHipPivot.add(leftThigh);

    this.leftKneePivot = new THREE.Group();
    this.leftKneePivot.position.set(0, -0.4, 0);
    this.leftHipPivot.add(this.leftKneePivot);

    const leftShin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.4, 8), denimMat);
    leftShin.position.y = -0.18;
    leftShin.castShadow = true;
    this.leftKneePivot.add(leftShin);

    // Giày bốt da chuyên dụng có đế cao su gồ ghề & mũi gia cường
    const leftBootUpper = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.34), bootLeatherMat);
    leftBootUpper.position.set(0, -0.32, 0.05);
    this.leftKneePivot.add(leftBootUpper);

    const leftBootToe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.22, 8), bootLeatherMat);
    leftBootToe.rotateZ(Math.PI / 2);
    leftBootToe.position.set(0, -0.35, 0.2);
    this.leftKneePivot.add(leftBootToe);

    const leftBootSole = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.42), bootSoleMat);
    leftBootSole.position.set(0, -0.42, 0.06);
    this.leftKneePivot.add(leftBootSole);

    // Chân phải: Khớp háng -> Đùi -> Khớp đầu gối -> Bắp chuối -> Giày bốt
    this.rightHipPivot = new THREE.Group();
    this.rightHipPivot.position.set(0.22, 0.76, 0);
    this.mesh.add(this.rightHipPivot);

    const rightThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.42, 8), denimMat);
    rightThigh.position.y = -0.21;
    rightThigh.castShadow = true;
    this.rightHipPivot.add(rightThigh);

    this.rightKneePivot = new THREE.Group();
    this.rightKneePivot.position.set(0, -0.4, 0);
    this.rightHipPivot.add(this.rightKneePivot);

    const rightShin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.4, 8), denimMat);
    rightShin.position.y = -0.18;
    rightShin.castShadow = true;
    this.rightKneePivot.add(rightShin);

    const rightBootUpper = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.34), bootLeatherMat);
    rightBootUpper.position.set(0, -0.32, 0.05);
    this.rightKneePivot.add(rightBootUpper);

    const rightBootToe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.22, 8), bootLeatherMat);
    rightBootToe.rotateZ(Math.PI / 2);
    rightBootToe.position.set(0, -0.35, 0.2);
    this.rightKneePivot.add(rightBootToe);

    const rightBootSole = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.42), bootSoleMat);
    rightBootSole.position.set(0, -0.42, 0.06);
    this.rightKneePivot.add(rightBootSole);

    // Giữ lại tham chiếu cũ cho các plugin bên ngoài nếu có
    this.leftLeg = this.leftHipPivot;
    this.rightLeg = this.rightHipPivot;
    this.leftArm = this.leftShoulderPivot;
    this.rightArmPivot = this.rightShoulderPivot;

    // Bóng tiếp xúc đất mờ mềm mại (Blob Contact Shadow)
    const blobShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.65, 16),
      new THREE.MeshBasicMaterial({ map: Textures.contactShadow(), transparent: true, opacity: 0.75, depthWrite: false })
    );
    blobShadow.rotateX(-Math.PI / 2);
    blobShadow.position.y = 0.02;
    this.mesh.add(blobShadow);

    // Balo Gỗ Vật Lý & Khung Giá Đỡ Sau Lưng (Hỗ trợ mở rộng tối đa 24 khúc gỗ)
    this.backpackFrame = new THREE.Group();
    this.backpackFrame.position.set(0, 0.55, -0.32);
    this.torsoGroup.add(this.backpackFrame);

    const metalRack = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 1.8, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.35 })
    );
    metalRack.position.y = 0.5;
    this.backpackFrame.add(metalRack);

    // Cọc đỡ 2 bên giữ chồng gỗ cao
    [-0.45, 0.45].forEach(sx => {
      const rail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 })
      );
      rail.position.set(sx, 0.7, -0.35);
      this.backpackFrame.add(rail);
    });

    // Mảng Khúc Gỗ Xếp Chồng Vật Lý Lưng Nhân Vật (Hỗ trợ mở rộng vô hạn tầng)
    this.logMeshes = [];
    this.logGeo = new THREE.CylinderGeometry(0.16, 0.16, 1.25, 8);
    this.logGeo.rotateZ(Math.PI / 2);
    this.logMat = new THREE.MeshStandardMaterial({ map: Textures.bark(), roughness: 0.85 });
    this.buildLogMeshes(Math.max((typeof gameState !== 'undefined' && gameState.backpackMax) || 12, 60));

    // Quầng sáng Nam Châm Hút Gỗ Bán Kính 1.5m (Magnet Area Ring)
    const magnetGeo = new THREE.RingGeometry(1.4, 1.55, 32);
    magnetGeo.rotateX(-Math.PI / 2);
    const magnetMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    this.magnetRing = new THREE.Mesh(magnetGeo, magnetMat);
    this.magnetRing.position.y = 0.04;
    scene.add(this.magnetRing);
  }

  buildLogMeshes(targetCap = 60) {
    const needed = Math.max(targetCap, 60);
    while (this.logMeshes.length < needed) {
      const idx = this.logMeshes.length;
      const layer = Math.floor(idx / 4);
      const subIdx = idx % 4;
      const ly = 0.15 + (layer % 10) * 0.28;
      const colZ = Math.floor(layer / 10);
      const lx = (subIdx % 2 === 0 ? -0.22 : 0.22);
      const lz = (subIdx < 2 ? -0.20 : -0.52) - colZ * 0.32;

      const log = new THREE.Mesh(this.logGeo, this.logMat);
      log.position.set(lx, ly, lz);
      log.castShadow = true;
      log.visible = false;
      this.backpackFrame.add(log);
      this.logMeshes.push(log);
    }
  }

  expandBackpackMeshCapacity(newMax) {
    this.buildLogMeshes(newMax);
  }

  updateLogStack(count) {
    if (count > this.logMeshes.length) {
      this.buildLogMeshes(count + 12);
    }
    for (let i = 0; i < this.logMeshes.length; i++) {
      this.logMeshes[i].visible = i < count;
    }
  }

  updateWeaponAppearance() {
    const tier = (typeof gameState !== 'undefined' && gameState.axeTier) || 1;
    const isFever = typeof isFeverActive === 'function' && isFeverActive();
    if (tier === this.currentAxeTier && isFever === this.currentFeverState) return;

    this.currentAxeTier = tier;
    this.currentFeverState = isFever;

    while (this.axe.children.length > 0) {
      this.axe.remove(this.axe.children[0]);
    }

    if (isFever) {
      // RÌU VÀNG THẦN THOẠI (Rực lửa phát quang)
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.05, 1.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 })
      );
      handle.position.set(0, -0.65, 0.35);
      handle.rotateX(Math.PI / 2.6);
      this.axe.add(handle);

      const goldBlade = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.48, 0.58),
        new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.9,
          metalness: 0.95,
          roughness: 0.1
        })
      );
      goldBlade.position.set(0, -0.45, 0.9);
      this.axe.add(goldBlade);

      const fLight = new THREE.PointLight(0xfacc15, 1.5, 4);
      fLight.position.set(0, -0.45, 0.9);
      this.axe.add(fLight);
    } else if (tier >= 3) {
      // MÁY CƯA XÍCH CẦM TAY (Heavy Chainsaw)
      const csBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.42, 0.62),
        new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.3, metalness: 0.4 })
      );
      csBody.position.set(0, -0.5, 0.5);
      this.axe.add(csBody);

      const csBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.26, 0.82),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 })
      );
      csBar.position.set(0, -0.5, 1.15);
      this.axe.add(csBar);

      const csTip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 0.06, 10),
        new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9 })
      );
      csTip.rotateZ(Math.PI / 2);
      csTip.position.set(0, -0.5, 1.56);
      this.axe.add(csTip);
    } else if (tier === 2) {
      // RÌU CHIẾN 2 LƯỠI THÉP XANH VIỀN ĐỒNG
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.05, 1.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 })
      );
      handle.position.set(0, -0.65, 0.35);
      handle.rotateX(Math.PI / 2.6);
      this.axe.add(handle);

      const bladeL = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.4, 0.42),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.9, roughness: 0.2 })
      );
      bladeL.position.set(0, -0.45, 0.85);
      this.axe.add(bladeL);

      const bladeR = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.4, 0.42),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.9, roughness: 0.2 })
      );
      bladeR.position.set(0, -0.85, 0.85);
      this.axe.add(bladeR);
    } else {
      // RÌU THÉP TIÊU CHUẨN CÁN GỖ SỒI
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.05, 1.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 })
      );
      handle.position.set(0, -0.65, 0.35);
      handle.rotateX(Math.PI / 2.6);
      this.axe.add(handle);

      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.35, 0.45),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.92, roughness: 0.18 })
      );
      blade.position.set(0, -0.45, 0.85);
      this.axe.add(blade);
    }
  }

  setMoveInput(x, z) {
    this.moveInput.set(x, 0, z);
    if (this.moveInput.lengthSq() > 0) {
      this.moveInput.normalize();
      this.targetPos = null;
    }
  }

  update(dt) {
    // Khi đang lái phương tiện: Gắn nhân vật vào ghế lái xe nâng / bán tải / ca nô
    if (typeof gameState !== 'undefined') {
      if (gameState.isDrivingForklift && window.drivableForklift) {
        const seatOffset = new THREE.Vector3(0, 0.45, -0.2).applyEuler(window.drivableForklift.mesh.rotation);
        this.mesh.position.copy(window.drivableForklift.mesh.position).add(seatOffset);
        this.mesh.rotation.y = window.drivableForklift.mesh.rotation.y;
        this.magnetRing.position.copy(this.mesh.position);
        this.isMoving = false;
        return;
      }
      if (gameState.isDrivingPickup && window.drivablePickup) {
        const seatOffset = new THREE.Vector3(-0.45, 0.55, 0.2).applyEuler(window.drivablePickup.mesh.rotation);
        this.mesh.position.copy(window.drivablePickup.mesh.position).add(seatOffset);
        this.mesh.rotation.y = window.drivablePickup.mesh.rotation.y;
        this.magnetRing.position.copy(this.mesh.position);
        this.isMoving = false;
        return;
      }
      if (gameState.isDrivingSpeedboat && window.drivableSpeedboat) {
        const seatOffset = new THREE.Vector3(-0.45, 0.35, 0.1).applyEuler(window.drivableSpeedboat.mesh.rotation);
        this.mesh.position.copy(window.drivableSpeedboat.mesh.position).add(seatOffset);
        this.mesh.rotation.y = window.drivableSpeedboat.mesh.rotation.y;
        this.magnetRing.position.copy(this.mesh.position);
        this.isMoving = false;
        return;
      }
      if (gameState.isDrivingHelicopter && window.drivableHelicopter) {
        const seatOffset = new THREE.Vector3(0, 0.7, 0.4).applyEuler(window.drivableHelicopter.mesh.rotation);
        this.mesh.position.copy(window.drivableHelicopter.mesh.position).add(seatOffset);
        this.mesh.rotation.y = window.drivableHelicopter.mesh.rotation.y;
        this.magnetRing.position.copy(this.mesh.position);
        this.isMoving = false;
        return;
      }
      if (gameState.isDrivingTrain && window.steamTrainSystem) {
        const seatOffset = new THREE.Vector3(0, 1.4, -2.4).applyQuaternion(window.steamTrainSystem.locomotive.quaternion);
        this.mesh.position.copy(window.steamTrainSystem.locomotive.position).add(seatOffset);
        this.mesh.quaternion.copy(window.steamTrainSystem.locomotive.quaternion);
        this.magnetRing.position.copy(this.mesh.position);
        this.isMoving = false;
        return;
      }
    }

    // Tự động kiểm tra và cập nhật mô hình rìu / cưa máy theo cấp độ
    this.updateWeaponAppearance();

    // Hạt bụi bước chân & Âm thanh bước chân đa bề mặt khi chạy
    if (this.isMoving) {
      this.footstepTimer = (this.footstepTimer || 0) + dt;
      if (this.footstepTimer >= 0.26) {
        this.footstepTimer = 0;
        if (typeof spawnParticle === 'function') {
          spawnParticle(this.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.08, (Math.random() - 0.5) * 0.4)), 0xe2e8f0);
        }
        if (typeof sounds !== 'undefined' && sounds.playFootstep) {
          let surface = 'grass';
          const pY = this.mesh.position.y;
          const pZ = this.mesh.position.z;
          const pX = this.mesh.position.x;
          if (pY < -0.1 || (pX >= 22.0 && pX <= 34.0 && pZ >= 1.5 && pZ <= 30.5 && pY <= 0.1)) {
            surface = 'water';
          } else if (pY > 0.1 || (Math.abs(pX - 28.0) <= 5.5 && (pZ <= 160 && pZ >= -115)) || (pZ >= 72 && pZ <= 84)) {
            surface = 'asphalt';
          }
          sounds.playFootstep(surface);
        }
      }
    }
    // Luôn bám vòng nam châm dưới chân
    this.magnetRing.position.copy(this.mesh.position);
    this.magnetRing.position.y = this.mesh.position.y + 0.04;

    // Hit-stop tạm dừng hoạt ảnh trong 1-2 frame khi đốn trúng gỗ
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    // Tải trọng & tư thế chạy: Nếu balo đầy gỗ, cột sống nghiêng trước theo trọng lượng vật lý (Mục 54)
    if (typeof syncBackpackCapacity === 'function') syncBackpackCapacity();
    const currentLoad = (gameState.logs || 0) + (gameState.planks || 0) * 1.5;
    window.playerBackpackWeight = currentLoad;
    const isFullLoad = gameState.logs >= gameState.backpackMax;
    const bootsMul = (typeof BOOTS_TIERS !== 'undefined' && BOOTS_TIERS[gameState.bootsTier || 1]?.speedMul) || 1.0;
    const swimMul = this.isSwimming ? 0.45 : 1.0;

    // Sức cản của nước khi lội suối (Water Drag Resistance - Mục 53)
    const pX = this.mesh.position.x;
    const pZ = this.mesh.position.z;
    const pY = this.mesh.position.y;
    const isWadingWater = (pX >= 18.0 && pX <= 32.0 && pZ >= 1.0 && pZ <= 38.0 && pY <= 0.1 && !this.isSwimming);
    window.waterDragActive = isWadingWater;
    const waterDragMul = isWadingWater ? 0.42 : 1.0; // Giảm gần 60% tốc độ lội nước
    if (isWadingWater && this.isMoving && Math.random() < 0.08 && typeof sounds !== 'undefined' && sounds.playWaterSplashDrag) {
      sounds.playWaterSplashDrag();
    }

    // Bẫy bùn sình lầy giữ chặt chân (Mud Bog Trap - Mục 58)
    const isMudBog = (Math.hypot(pX - (-28), pZ - (-22)) < 8.5 && pY <= 0.15);
    window.inMudBog = isMudBog;
    const mudBogMul = isMudBog ? 0.52 : 1.0;

    // Hệ số tải trọng balo vật lý
    const loadMul = Math.max(0.68, 1.0 - (currentLoad / 50.0) * 0.32);

    // Thể lực & Chạy nước rút (Sprint Stamina - Mục 38)
    const isSprinting = (keysPressed['ShiftLeft'] || keysPressed['ShiftRight']) && ((gameState.playerStamina || 100) > 5.0) && this.isMoving;
    if (isSprinting) {
      gameState.playerStamina = Math.max(0.0, (gameState.playerStamina || 100) - dt * (22.0 + currentLoad * 0.3));
    } else {
      gameState.playerStamina = Math.min(100.0, (gameState.playerStamina !== undefined ? gameState.playerStamina : 100) + dt * 18.0);
    }
    const sprintMul = isSprinting ? 1.45 : 1.0;

    const speed = (isFeverActive() ? this.baseSpeed * 2.0 : this.baseSpeed) * bootsMul * loadMul * swimMul * sprintMul * waterDragMul * mudBogMul;
    this.torsoGroup.rotation.x = isFullLoad ? 0.28 : Math.min(0.24, 0.05 + (currentLoad / 40.0) * 0.19);

    // Bật nhảy vượt chướng ngại vật (Jump & Vaulting Physics - Mục 39)
    if (keysPressed['Space'] && !this.isJumping && !this.isOnRooftop && !this.isSwimming) {
      this.isJumping = true;
      this.jumpVelocity = 7.2;
    }
    if (this.isJumping) {
      this.jumpVelocity -= 22.0 * dt;
      this.jumpY = (this.jumpY || 0) + this.jumpVelocity * dt;
      if (this.jumpY <= 0.0) {
        this.jumpY = 0.0;
        this.isJumping = false;
        this.jumpVelocity = 0;
      }
    }

    // Dưỡng khí bơi lội dưới biển sâu (Ocean Swimming & Oxygen - Mục 40)
    if (this.isSwimming) {
      gameState.playerOxygen = Math.max(0.0, (gameState.playerOxygen !== undefined ? gameState.playerOxygen : 100) - dt * 6.0);
      if (gameState.playerOxygen <= 0.0) {
        gameState.playerHealth = Math.max(0.0, (gameState.playerHealth || 100) - dt * 12.0);
      }
    } else {
      gameState.playerOxygen = Math.min(100.0, (gameState.playerOxygen !== undefined ? gameState.playerOxygen : 100) + dt * 30.0);
    }

    // Câu cá thủ công (Manual Fishing - Mục 41)
    if (keysPressed['KeyF'] && !this.isFishingKeyCooldown) {
      this.isFishingKeyCooldown = true;
      setTimeout(() => this.isFishingKeyCooldown = false, 500);
      const isNearWater = this.mesh.position.y <= 0.1 && (this.mesh.position.x > 18 || this.mesh.position.z > 1.0);
      if (isNearWater) {
        gameState.isFishing = !gameState.isFishing;
        if (gameState.isFishing) {
          if (typeof sounds !== 'undefined' && sounds.playFishingCast) sounds.playFishingCast();
          if (typeof showToast === 'function') showToast('🎣 Đang buông cần câu cá... Chờ phao động!');
        }
      }
    }
    if (gameState.isFishing) {
      this.fishTimer = (this.fishTimer || 0) + dt;
      if (this.fishTimer >= 3.5) {
        this.fishTimer = 0;
        gameState.freshFish = (gameState.freshFish || 0) + 1;
        if (typeof sounds !== 'undefined' && sounds.playReelCatch) sounds.playReelCatch();
        if (typeof showToast === 'function') showToast('🐟 GIẬT CẦU: Bạn đã câu được 1 Cá Tươi ngon lành!');
        if (typeof updateHUD === 'function') updateHUD();
      }
    }

    // Trồng cây thủ công (Manual Tree Sapling Care - Mục 42)
    if (keysPressed['KeyP'] && !this.isPlantKeyCooldown) {
      this.isPlantKeyCooldown = true;
      setTimeout(() => this.isPlantKeyCooldown = false, 800);
      const inForest = (this.mesh.position.x >= -60 && this.mesh.position.x <= 0 && this.mesh.position.z >= -45 && this.mesh.position.z <= 0);
      if (inForest) {
        if (typeof plantTree === 'function') {
          plantTree(this.mesh.position.x + (Math.random() - 0.5) * 2, this.mesh.position.z + (Math.random() - 0.5) * 2);
          if (typeof showToast === 'function') showToast('🌱 Vun trồng cây thông non mới thành công! Nhận +25 XP');
          if (typeof sounds !== 'undefined' && sounds.playCollect) sounds.playCollect();
        }
      }
    }

    // Xử lý di chuyển
    if (this.moveInput.lengthSq() > 0) {
      this.mesh.position.addScaledVector(this.moveInput, speed * dt);
      const angle = Math.atan2(this.moveInput.x, this.moveInput.z);
      this.mesh.rotation.y = angle;
      this.isMoving = true;
    } else if (this.targetPos) {
      const dist = this.mesh.position.distanceTo(this.targetPos);
      if (dist > 0.4) {
        const dir = new THREE.Vector3().subVectors(this.targetPos, this.mesh.position).normalize();
        this.mesh.position.addScaledVector(dir, speed * dt);
        this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        this.isMoving = true;
      } else {
        this.targetPos = null;
        this.isMoving = false;
      }
    } else {
      this.isMoving = false;
    }

    // Cơ chế chống kẹt góc mềm (Anti-Stuck Soft-Collider Repulsion)
    this.preventBoundaryStuck(dt);

    // TRỌNG LỰC & ĐI BỘ TRÊN TẦNG THƯỢNG CAO ỐC (ROOFTOP WALKING & GRAVITY FALL)
    if (this.isOnRooftop) {
      // Người chơi đang đứng trên tầng thượng
      const roofH = (typeof getBuildingRoofHeightAt === 'function') ? getBuildingRoofHeightAt(this.mesh.position.x, this.mesh.position.z) : 0.0;
      if (roofH > 2.0) {
        this.mesh.position.y = roofH + 0.05; // Đi bộ an toàn trên sàn nóc nhà
      } else {
        // Đi ra ngoài mép nóc nhà -> Rơi tự do xuống đất theo trọng lực!
        this.mesh.position.y = Math.max(0.0, this.mesh.position.y - 24.0 * dt);
        if (this.mesh.position.y <= 0.05) {
          this.mesh.position.y = 0.0;
          this.isOnRooftop = false;
          if (typeof showToast === 'function') showToast('🪂 Bạn đã bước khỏi mép tầng thượng và tiếp đất an toàn!');
        }
      }
    } else {
      // Người chơi đi bộ bình thường dưới mặt đất kết hợp lực nhảy Spacebar
      this.mesh.position.y = (this.jumpY || 0.0);

      // CẢN TƯỜNG CAO ỐC: Chặn người chơi đi xuyên tường bê tông hoặc leo lên nóc!
      if (window.CITY_BUILDING_COLLIDERS) {
        for (let bi = 0; bi < window.CITY_BUILDING_COLLIDERS.length; bi++) {
          const b = window.CITY_BUILDING_COLLIDERS[bi];
          if (this.mesh.position.x >= b.minX && this.mesh.position.x <= b.maxX &&
              this.mesh.position.z >= b.minZ && this.mesh.position.z <= b.maxZ) {
            const distLeft = Math.abs(this.mesh.position.x - b.minX);
            const distRight = Math.abs(this.mesh.position.x - b.maxX);
            const distBottom = Math.abs(this.mesh.position.z - b.minZ);
            const distTop = Math.abs(this.mesh.position.z - b.maxZ);
            const minDist = Math.min(distLeft, distRight, distBottom, distTop);
            if (minDist === distLeft) this.mesh.position.x = b.minX - 0.25;
            else if (minDist === distRight) this.mesh.position.x = b.maxX + 0.25;
            else if (minDist === distBottom) this.mesh.position.z = b.minZ - 0.25;
            else this.mesh.position.z = b.maxZ + 0.25;
          }
        }
      }
    }

    // LOGIC BƠI DƯỚI NƯỚC SÔNG
    const inRiver = (this.mesh.position.z >= 7.0 && this.mesh.position.z <= 25.0 && (this.mesh.position.x < 24.0 || this.mesh.position.x > 32.0));
    if (inRiver && !this.isOnRooftop) {
      this.isSwimming = true;
      this.mesh.position.y = -0.32; // Nửa thân chìm trong nước
      if (typeof spawnParticle === 'function' && Math.random() < 0.25) {
        spawnParticle(this.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.05, (Math.random() - 0.5) * 0.8)), 0x38bdf8);
      }
    } else if (this.isSwimming) {
      this.isSwimming = false;
      this.wetDripTimer = 5.0; // Ướt quần áo trong 5s
    }

    if (this.wetDripTimer > 0) {
      this.wetDripTimer -= dt;
      if (typeof spawnParticle === 'function' && Math.random() < 0.3) {
        spawnParticle(this.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.05, (Math.random() - 0.5) * 0.4)), 0x93c5fd);
      }
    }

    // Chớp mắt tự nhiên sống động (Human Eye Blinking)
    this.blinkTimer = (this.blinkTimer || 0) + dt;
    if (this.blinkTimer > 3.4) {
      if (this.blinkTimer > 3.54) {
        this.blinkTimer = 0;
      }
      if (this.eyes) this.eyes.forEach(e => e.scale.y = 0.12);
    } else {
      if (this.eyes) this.eyes.forEach(e => e.scale.y = 1.0);
    }

    // Hoạt ảnh bước chân chuẩn người sinh học (Biomechanical Human Locomotion)
    if (this.isMoving) {
      this.animTimer += dt * 13;
      const legCycle = Math.sin(this.animTimer);
      const cosCycle = Math.cos(this.animTimer);

      // Đùi lắc trước - sau
      this.leftHipPivot.rotation.x = legCycle * 0.65;
      this.rightHipPivot.rotation.x = -legCycle * 0.65;

      // Khớp gối uốn cong tự nhiên khi chân đưa về sau / nhấc bước
      this.leftKneePivot.rotation.x = Math.max(0, -legCycle) * 0.85;
      this.rightKneePivot.rotation.x = Math.max(0, legCycle) * 0.85;

      // Cánh tay vung chéo đối xứng tự nhiên với chân, khuỷu tay hơi gập
      this.leftShoulderPivot.rotation.x = -legCycle * 0.5;
      this.leftElbowPivot.rotation.x = -0.25 - Math.max(0, -legCycle) * 0.35;

      if (!this.isChopping) {
        this.rightShoulderPivot.rotation.x = legCycle * 0.4;
        this.rightElbowPivot.rotation.x = -0.2 - Math.max(0, legCycle) * 0.3;
      }

      // Nhấp nhô xương chậu & cột sống theo nhịp bước chân (Pelvic Bounce & Sway)
      const bounce = Math.abs(cosCycle) * 0.05;
      this.torsoGroup.position.y = 0.78 + bounce;
      this.torsoGroup.rotation.z = Math.sin(this.animTimer * 0.5) * 0.03;

      // Độ nhún và lắc nhẹ của khung cõng gỗ
      this.backpackFrame.rotation.z = Math.sin(this.animTimer * 0.5) * 0.06;
      this.backpackFrame.position.y = 0.55 + bounce * 0.5;
    } else {
      // Hoạt ảnh Thở khi đứng yên (Human Breathing Idle)
      this.idleTimer = (this.idleTimer || 0) + dt;
      const breath = Math.sin(this.idleTimer * 2.2);

      this.leftHipPivot.rotation.x = 0;
      this.rightHipPivot.rotation.x = 0;
      this.leftKneePivot.rotation.x = 0;
      this.rightKneePivot.rotation.x = 0;

      this.leftShoulderPivot.rotation.x = breath * 0.03;
      this.leftElbowPivot.rotation.x = -0.1 + breath * 0.02;

      if (!this.isChopping) {
        this.rightShoulderPivot.rotation.x = -breath * 0.03;
        this.rightElbowPivot.rotation.x = -0.15;
      }

      this.torsoGroup.position.y = 0.78 + breath * 0.015;
      this.torsoGroup.rotation.z = 0;
      if (this.headGroup) {
        this.headGroup.rotation.y = Math.sin(this.idleTimer * 0.7) * 0.08; // Liếc nhìn cảnh quan xung quanh
        this.headGroup.rotation.x = Math.sin(this.idleTimer * 1.1) * 0.03;
      }

      this.backpackFrame.rotation.z = 0;
      this.backpackFrame.position.y = 0.55;

      if (!this.isChopping) {
        this.mesh.scale.set(1.0, 1.0 + breath * 0.012, 1.0);
      }
    }

    // Hoạt ảnh đốn cây 2 tay đầy uy lực (Full-Body 2-Handed Axe Chop)
    if (this.isChopping) {
      this.chopTimer -= dt * 8.5;
      const chopPhase = Math.sin(this.chopTimer * Math.PI);

      // Cả 2 tay cùng vung theo tư thế bổ củi
      this.rightShoulderPivot.rotation.x = -0.4 - chopPhase * 1.8;
      this.rightElbowPivot.rotation.x = -0.3 - chopPhase * 0.5;
      this.leftShoulderPivot.rotation.x = -0.2 - chopPhase * 1.5;
      this.leftElbowPivot.rotation.x = -0.6 - chopPhase * 0.4;

      // Cột sống ngửa ra sau rồi gập mạnh xuống khi chém
      this.torsoGroup.rotation.x = (isFullLoad ? 0.21 : 0.0) + (-chopPhase * 0.25);
      // Đầu gối chùng xuống tạo lực
      this.leftKneePivot.rotation.x = chopPhase * 0.3;
      this.rightKneePivot.rotation.x = chopPhase * 0.3;

      // Squash & Stretch lực bổ củi
      this.mesh.scale.set(1.0 + chopPhase * 0.08, 1.0 - chopPhase * 0.08, 1.0 + chopPhase * 0.08);

      if (this.chopTimer <= 0) {
        this.isChopping = false;
        this.rightShoulderPivot.rotation.x = 0;
        this.rightElbowPivot.rotation.x = 0;
        this.leftShoulderPivot.rotation.x = 0;
        this.leftElbowPivot.rotation.x = 0;
        this.leftKneePivot.rotation.x = 0;
        this.rightKneePivot.rotation.x = 0;
      }
    }
    if (this.chopCooldown > 0) this.chopCooldown -= dt;
  }

  // Tự động xoay người hướng thẳng vào gốc cây (Auto-Aim) & kích hoạt Hit-Stop
  triggerChop(targetObj) {
    if (this.chopCooldown > 0) return;
    this.chopCooldown = isFeverActive() ? 0.15 : 0.35;
    this.isChopping = true;
    this.chopTimer = 1.0;
    this.hitStopTimer = 0.04; // 1-2 frames freeze cảm giác va chạm thật
    sounds.playChop();

    if (targetObj) {
      const diff = new THREE.Vector3().subVectors(targetObj.position, this.mesh.position);
      this.mesh.rotation.y = Math.atan2(diff.x, diff.z);
    }
  }

  // Cơ chế đẩy mềm chống kẹt map & tương tác cao độ Cầu Tàu Biển, Cầu Gỗ Bờ Tây & Bơi Lội Dưới Sông
  preventBoundaryStuck(dt = 0.016) {
    const p = this.mesh.position;

    // Giới hạn toàn bản đồ Đế Chế 380m (Mở rộng toàn diện không bị chặn ở -68, +68)
    if (p.x < -185) p.x = -185;
    if (p.x > 185) p.x = 185;
    if (p.z < -130) p.z = -130;
    if (p.z > 195) p.z = 195;

    // 1. Cầu gỗ đi bộ bờ Tây (West Scenic Footbridge: X = -15, Z từ 2.5 đến 29.5)
    const onFootbridge = (p.x >= -17.2 && p.x <= -12.8 && p.z >= 2.5 && p.z <= 29.5);

    // 2. Cầu vượt sông cao tốc (Highway Bridge X=28, Z từ 2.0 đến 30.0)
    const onHighwayBridge = (p.x >= 20.0 && p.x <= 36.0 && p.z >= 2.0 && p.z <= 30.0);

    // 3. Cầu tàu gỗ bờ Tây
    const onPierStem = (p.x >= 2.8 && p.x <= 7.2 && p.z >= 5.0 && p.z <= 14.2);
    const onPierWing = (p.x >= -0.2 && p.x <= 10.2 && p.z >= 14.0 && p.z <= 19.8);
    const onPier = onPierStem || onPierWing;

    // 4. Bến cảng công nghiệp & cầu cảng phía Đông (East Docks: X >= 38.0, Z từ 2.0 đến 28.0)
    const onEastDocks = (p.x >= 38.0 && p.x <= 75.0 && p.z >= 2.0 && p.z <= 28.0);

    // 5. Khu vực lòng sông tự nhiên (River Water: Z từ 5.2 đến 27.2)
    const inRiverWater = (p.z > 5.2 && p.z < 27.2) && !onFootbridge && !onHighwayBridge && !onPier && !onEastDocks;

    // 6. Toàn bộ Đại đế chế Bờ Nam (Z >= 27.5)
    const onSouthShore = (p.z >= 27.5);

    if (onHighwayBridge) {
      this.isSwimming = false;
      // Đi bộ trên Cầu Vượt Sông Cao Tốc (uốn vòm C^1)
      const u = (p.z - 16.0) / 14.0;
      let bridgeY = 0.13;
      if (Math.abs(u) <= 1.0) {
        bridgeY = 0.13 + 3.6 * ((1.0 + Math.cos(Math.PI * u)) / 2.0);
      }
      p.y = THREE.MathUtils.lerp(p.y, bridgeY, Math.min(1.0, 16 * dt));
    } else if (onFootbridge) {
      this.isSwimming = false;
      // Đi bộ trên Cầu Gỗ Bờ Tây
      const footY = (typeof window.getFootbridgeY === 'function') ? window.getFootbridgeY(p.z) : 1.5;
      p.y = THREE.MathUtils.lerp(p.y, footY, Math.min(1.0, 16 * dt));
    } else if (onPier) {
      this.isSwimming = false;
      p.y = THREE.MathUtils.lerp(p.y, 0.92, Math.min(1.0, 12 * dt));
    } else if (onEastDocks) {
      this.isSwimming = false;
      p.y = THREE.MathUtils.lerp(p.y, 0.65, Math.min(1.0, 12 * dt));
    } else if (inRiverWater) {
      // VẬT LÝ BƠI LỘI & LỘI NƯỚC QUA SÔNG TỰ NHIÊN (Không còn đi trên không khí hoặc lơ lửng)
      this.isSwimming = true;
      p.y = THREE.MathUtils.lerp(p.y, -0.55, Math.min(1.0, 10 * dt));

      // Hạt nước bắn tung tóe & bọt trắng khi người chơi bơi qua sông
      if (this.isMoving && Math.random() < 0.35 && typeof spawnParticle === 'function') {
        spawnParticle(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.25, (Math.random() - 0.5) * 0.6)), 0x38bdf8);
        spawnParticle(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.2, (Math.random() - 0.5) * 0.4)), 0xe0f2fe);
      }
    } else if (onSouthShore) {
      this.isSwimming = false;
      let targetY = 0.15;
      // Khu vực sàn gỗ Làng Chài Thủy Sản ven biển
      if (p.x <= -18.0 && p.z <= 44.0) {
        targetY = 0.35;
      }
      // Khu vực Lặn Biển Săn Kho Báu Maldives (Scuba Diving Lagoon)
      if (p.x >= 132.0 && p.x <= 168.0 && p.z >= 36.0 && p.z <= 68.0) {
        targetY = -2.4; // Lặn sâu xuống rạn san hô
        if (typeof gameState !== 'undefined') {
          if (!gameState.isScubaDiving) {
            gameState.isScubaDiving = true;
            showToast('🤿 ĐÃ LẶN XUỐNG RẠN SAN HÔ MALDIVES: Khám phá rương kho báu thuyền đắm!');
            sounds.playWaterSplash();
          }
          if (Math.random() < 0.25 && typeof spawnParticle === 'function') {
            spawnParticle(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.8, (Math.random() - 0.5) * 0.4)), 0xe0f2fe);
          }
        }
      } else {
        if (typeof gameState !== 'undefined' && gameState.isScubaDiving) {
          gameState.isScubaDiving = false;
          showToast('🏊 ĐÃ LÊN BỜ BÃI CÁT MALDIVES');
        }
      }
      p.y = THREE.MathUtils.lerp(p.y, targetY, Math.min(1.0, 14 * dt));
    } else {
      // Đất liền bờ Bắc (Rừng thông, Xưởng cưa, Trụ sở Empire HQ, Mỏ vàng)
      this.isSwimming = false;
      if (p.z >= 1.5 && p.z <= 5.2 && p.x >= -2 && p.x <= 60) {
        p.y = THREE.MathUtils.lerp(p.y, 0.35, Math.min(1.0, 12 * dt));
      } else {
        p.y = THREE.MathUtils.lerp(p.y, 0.0, Math.min(1.0, 12 * dt));
      }
    }
  }

  applySkin(skinId) {
    if (typeof CHARACTER_SKINS === 'undefined') return;
    const skin = CHARACTER_SKINS[skinId] || CHARACTER_SKINS['default'];
    if (!skin) return;
    if (this.shirtMat) this.shirtMat.color.setHex(skin.shirtColor);
    if (this.denimMat) this.denimMat.color.setHex(skin.pantsColor);
    if (this.safetyVestMat) {
      this.safetyVestMat.color.setHex(skin.vestColor);
      this.safetyVestMat.emissive.setHex(skin.vestColor);
    }
    if (typeof gameState !== 'undefined') gameState.characterSkin = skinId;
  }
}
