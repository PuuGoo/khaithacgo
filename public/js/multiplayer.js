/**
 * Real-Time Multiplayer System (Native WebSocket RFC 6455)
 * Zero external dependencies - 60 FPS interpolated remote avatars, 3D nameplates,
 * chat bubbles, synchronized chopping and interactive emotes
 */

class MultiplayerManager {
  constructor() {
    window.multiplayer = this;
    window.multiplayerManager = this;
    window.mpClient = this;
    this.ws = null;
    this.connected = false;
    this.myId = null;
    this.myNickname = localStorage.getItem('lumber_tycoon_nickname') || ('Thợ Rừng #' + Math.floor(Math.random() * 899 + 100));
    this.remotePlayers = new Map(); // id -> { data, mesh, targetPos, targetRotY, nameplate, chatBubble, bubbleTimer }
    this.sendTimer = 0;
    this.pingTimer = 0;

    this.initUI();
    this.connect();
  }

  connect() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host || '127.0.0.1:8000';
      const wsUrl = `${protocol}//${host}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        this.updateOnlineBadge();
        showToast(`🌐 Đã kết nối sảnh Multiplayer! Nickname: ${this.myNickname}`);

        // Gửi gói tin tham gia sảnh (Join Room)
        const pos = window.player ? window.player.mesh.position : { x: 0, y: 0, z: -18 };
        const myName = (typeof gameState !== 'undefined' && gameState.username) ? gameState.username : this.myNickname;
        const myEmpire = (typeof gameState !== 'undefined' && gameState.empireName) ? gameState.empireName : 'Đế Chế Lâm Nghiệp';
        this.myNickname = myName;
        this.send({
          type: 'join',
          nickname: myName,
          empireName: myEmpire,
          skin: typeof gameState !== 'undefined' ? gameState.characterSkin : 'default',
          level: typeof gameState !== 'undefined' ? gameState.level : 1,
          x: pos.x,
          z: pos.z
        });
      };

      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          this.handleServerMessage(msg);
        } catch (err) {
          console.warn('[!] Lỗi giải mã gói tin WebSocket:', err);
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.updateOnlineBadge();
        // Tự động kết nối lại sau 3.5 giây
        setTimeout(() => this.connect(), 3500);
      };

      this.ws.onerror = () => {
        this.connected = false;
      };
    } catch (e) {
      console.warn('[!] Không thể mở kết nối WebSocket:', e.message);
    }
  }

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  handleServerMessage(msg) {
    switch (msg.type) {
      case 'init': {
        this.myId = msg.yourId;
        // Xóa danh sách cũ nếu có
        for (const [id, r] of this.remotePlayers.entries()) {
          this.removeRemotePlayer(id);
        }
        // Thêm các người chơi đang có trong phòng
        if (Array.isArray(msg.players)) {
          msg.players.forEach(p => {
            if (p.id !== this.myId) this.addRemotePlayer(p);
          });
        }
        this.updateOnlineBadge();
        break;
      }

      case 'player_join': {
        if (msg.player && msg.player.id !== this.myId) {
          this.addRemotePlayer(msg.player);
          showToast(`👋 ${msg.player.nickname} vừa vào phòng chơi!`);
          this.updateOnlineBadge();
        }
        break;
      }

      case 'player_leave': {
        if (this.remotePlayers.has(msg.id)) {
          const r = this.remotePlayers.get(msg.id);
          showToast(`🚪 ${r.data.nickname} đã rời thế giới.`);
          this.removeRemotePlayer(msg.id);
          this.updateOnlineBadge();
        }
        break;
      }

      case 'player_move': {
        const r = this.remotePlayers.get(msg.id);
        if (r) {
          r.targetPos.set(msg.x, msg.y, msg.z);
          r.targetRotY = msg.rotY;
          r.data.isMoving = msg.isMoving;
          r.data.isChopping = msg.isChopping;
          r.data.isSwimming = msg.isSwimming;
          r.data.vehicle = msg.vehicle;
        }
        break;
      }

      case 'player_chat': {
        this.displayChatMessage(msg.nickname, msg.text, msg.id === this.myId, msg.empireName);
        if (msg.id !== this.myId && this.remotePlayers.has(msg.id)) {
          const r = this.remotePlayers.get(msg.id);
          this.show3DChatBubble(r, msg.text);
        } else if (msg.id === this.myId && window.player) {
          this.showLocal3DChatBubble(msg.text);
        }
        break;
      }

      case 'player_emote': {
        if (this.remotePlayers.has(msg.id)) {
          const r = this.remotePlayers.get(msg.id);
          this.show3DEmote(r, msg.emote);
        }
        break;
      }

      case 'player_chop': {
        // Đồng bộ hiệu ứng đốn cây của bạn bè
        if (typeof spawnParticle === 'function') {
          for (let i = 0; i < 8; i++) {
            spawnParticle(new THREE.Vector3(msg.x, 1.2, msg.z), 0xf59e0b);
          }
        }
        break;
      }

      // -----------------------------------------------------------------------
      // ĐỒNG BỘ ĐẠI ĐÔ THỊ, PHÁP LUẬT, CẢNH SÁT & TỘI PHẠM TOÀN SERVER
      // -----------------------------------------------------------------------
      case 'city_state_sync': {
        window.cityState = msg.cityState;
        if (typeof updateCityDashboardHUD === 'function') {
          updateCityDashboardHUD();
        }
        if (typeof updateLandmarkConstructionMesh === 'function') {
          updateLandmarkConstructionMesh(msg.cityState.landmarkProject);
        }
        break;
      }

      case 'city_announcement': {
        if (typeof showToast === 'function') {
          showToast(msg.announcement);
        }
        if (msg.announcement && msg.announcement.includes('🎉') && typeof sounds !== 'undefined' && sounds.playCelebrationCheer) {
          sounds.playCelebrationCheer();
        }
        break;
      }

      case 'crime_alert': {
        if (typeof showToast === 'function') {
          showToast(`🚨 BÁO ĐỘNG AN NINH: ${msg.nickname} bị truy nã ${'⭐'.repeat(msg.stars)} (${msg.crimeType})! Tiền thưởng: $${msg.bounty}`);
        }
        if (typeof sounds !== 'undefined' && sounds.playPoliceSiren) {
          sounds.playPoliceSiren();
        }
        break;
      }

      case 'police_arrest_broadcast': {
        if (typeof showToast === 'function') {
          showToast(`👮 CẢNH SÁT: ${msg.policeName} đã bắt giữ tội phạm ${msg.targetName}! Nhận thưởng +$${msg.bounty}!`);
        }
        if (typeof sounds !== 'undefined' && sounds.playArrestSfx) {
          sounds.playArrestSfx();
        }
        if (msg.targetId === this.myId) {
          if (typeof triggerJailSentence === 'function') {
            triggerJailSentence(60);
          }
        }
        if (msg.policeId === this.myId) {
          gameState.money = (gameState.money || 0) + msg.bounty;
          if (typeof spawnFloatingText === 'function' && window.player) {
            spawnFloatingText(window.player.mesh.position.clone().add(new THREE.Vector3(0, 3, 0)), `+$${msg.bounty} TIỀN THƯỞNG TRUY NÃ 👮⭐`, '#38bdf8');
          }
          if (typeof updateHUD === 'function') updateHUD();
        }
        break;
      }

      case 'crisis_start': {
        if (typeof showEmergencyBanner === 'function') {
          showEmergencyBanner(msg.crisis);
        }
        if (typeof createFireCrisis3DEffect === 'function' && msg.crisis && msg.crisis.location) {
          createFireCrisis3DEffect(msg.crisis.location);
        }
        if (typeof sounds !== 'undefined' && sounds.playFireSiren) {
          sounds.playFireSiren();
        }
        break;
      }

      case 'crisis_resolved': {
        if (typeof hideEmergencyBanner === 'function') {
          hideEmergencyBanner();
        }
        if (typeof removeFireCrisis3DEffect === 'function') {
          removeFireCrisis3DEffect();
        }
        if (msg.heroId === this.myId) {
          gameState.money = (gameState.money || 0) + (msg.rewardMoney || 3500);
          gameState.gems = (gameState.gems || 0) + (msg.rewardGems || 15);
          if (typeof spawnFloatingText === 'function' && window.player) {
            spawnFloatingText(window.player.mesh.position.clone().add(new THREE.Vector3(0, 3.5, 0)), `+$${msg.rewardMoney} USD & +${msg.rewardGems} Gems! 🚒🎖️`, '#ef4444');
          }
          if (typeof updateHUD === 'function') updateHUD();
        }
        if (typeof showToast === 'function') {
          showToast(msg.announcement || '🏆 ĐÁM CHÁY ĐÃ ĐƯỢC KHỐNG CHẾ HOÀN TOÀN!');
        }
        break;
      }

      case 'market_update': {
        if (typeof renderMarketplaceListings === 'function') {
          renderMarketplaceListings();
        }
        break;
      }

      case 'market_item_bought': {
        if (msg.buyerId === this.myId) {
          if (msg.item === 'planks') gameState.planks = (gameState.planks || 0) + msg.quantity;
          else if (msg.item === 'steel') gameState.steelBeams = (gameState.steelBeams || 0) + msg.quantity;
          else if (msg.item === 'cement') gameState.cementBags = (gameState.cementBags || 0) + msg.quantity;
          else if (msg.item === 'rations') gameState.cannedRations = (gameState.cannedRations || 0) + msg.quantity;
          gameState.money = Math.max(0, (gameState.money || 0) - msg.totalPrice);
          if (typeof showToast === 'function') {
            showToast(`🛒 GIAO DỊCH THÀNH CÔNG: Đã mua ${msg.quantity} ${msg.item} với tổng giá $${msg.totalPrice}!`);
          }
          if (typeof updateHUD === 'function') updateHUD();
        }
        if (typeof renderMarketplaceListings === 'function') {
          renderMarketplaceListings();
        }
        break;
      }
    }
  }

  sendCityContribute(planks, steel, cement, money) {
    if (!this.connected) return;
    this.send({
      type: 'city_contribute',
      planks: planks || 0,
      steel: steel || 0,
      cement: cement || 0,
      money: money || 0
    });
  }

  sendCrimeCommit(stars, crimeType) {
    if (!this.connected) return;
    this.send({
      type: 'crime_commit',
      stars: stars || 1,
      crimeType: crimeType || 'Trộm cắp'
    });
  }

  sendPoliceArrest(targetId) {
    if (!this.connected) return;
    this.send({
      type: 'police_arrest',
      targetId: targetId
    });
  }

  sendPrisonRelease() {
    if (!this.connected) return;
    this.send({
      type: 'prison_release'
    });
  }

  sendMayorVote(candidate) {
    if (!this.connected) return;
    this.send({
      type: 'mayor_vote',
      candidate: candidate
    });
  }

  sendCareerSelect(career) {
    if (!this.connected) return;
    this.send({
      type: 'career_select',
      career: career
    });
  }

  sendPowerFeedFuel(fuelCount = 15) {
    if (!this.connected) return;
    this.send({
      type: 'power_feed_fuel',
      fuelCount: fuelCount
    });
  }

  sendCityDecreeUpdate(decreeKey, value) {
    if (!this.connected) return;
    this.send({
      type: 'city_decree_update',
      decreeKey: decreeKey,
      value: value
    });
  }

  sendMarketListItem(item, quantity, priceEach) {
    if (!this.connected) return;
    this.send({
      type: 'market_list_item',
      item: item,
      quantity: quantity,
      priceEach: priceEach
    });
  }

  sendMarketBuyItem(listingId) {
    if (!this.connected) return;
    this.send({
      type: 'market_buy_item',
      listingId: listingId
    });
  }

  sendCrisisExtinguish(damage = 20) {
    if (!this.connected) return;
    this.send({
      type: 'crisis_extinguish',
      damage: damage
    });
  }

  sendUnderworldHeist() {
    if (!this.connected) return;
    this.send({
      type: 'underworld_heist'
    });
  }

  addRemotePlayer(pData) {
    if (!window.scene) return;
    const group = new THREE.Group();
    group.position.set(pData.x || 0, pData.y || 0, pData.z || 0);

    // 1. Thân người chơi từ xa (Low-Poly Human Stylized)
    const shirtColor = this.getSkinColor(pData.skin);
    const bodyMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.5 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.6 });
    const denimMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.6 });

    // Thân
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.95, 0.45), bodyMat);
    torso.position.y = 1.05;
    torso.castShadow = true;
    group.add(torso);

    // Đầu & Mặt
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), skinMat);
    head.position.y = 1.78;
    head.castShadow = true;
    group.add(head);

    // Mũ bảo hộ
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.54), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
    cap.position.y = 2.02;
    group.add(cap);

    // Chân trái & Chân phải
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.68, 0.32), denimMat);
    legL.position.set(-0.18, 0.34, 0);
    group.add(legL);

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.68, 0.32), denimMat);
    legR.position.set(0.18, 0.34, 0);
    group.add(legR);

    // Balo cõng gỗ
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.35), new THREE.MeshStandardMaterial({ color: 0x78350f }));
    pack.position.set(0, 1.1, -0.32);
    group.add(pack);

    // 2. Bảng tên 3D nổi trên đầu (Floating 3D Nameplate Sprite)
    const nameSprite = this.makeNameplateSprite(pData.nickname || 'Bạn bè', pData.level || 1, pData.empireName || '');
    nameSprite.position.set(0, 2.8, 0);
    group.add(nameSprite);

    window.scene.add(group);

    this.remotePlayers.set(pData.id, {
      data: pData,
      mesh: group,
      torso: torso,
      legL: legL,
      legR: legR,
      nameSprite: nameSprite,
      targetPos: new THREE.Vector3(pData.x || 0, pData.y || 0, pData.z || 0),
      targetRotY: pData.rotY || 0,
      animCycle: 0,
      chatBubble: null,
      bubbleTimer: 0
    });
  }

  removeRemotePlayer(id) {
    if (this.remotePlayers.has(id)) {
      const r = this.remotePlayers.get(id);
      if (r.mesh && window.scene) {
        window.scene.remove(r.mesh);
      }
      this.remotePlayers.delete(id);
    }
  }

  getSkinColor(skin) {
    if (skin === 'golden') return 0xfacc15;
    if (skin === 'cyber') return 0x06b6d4;
    if (skin === 'ceo') return 0x0f172a;
    return 0x2563eb;
  }

  makeNameplateSprite(nickname, level = 1, empireName = '') {
    const cv = document.createElement('canvas');
    cv.width = 320; 
    cv.height = empireName ? 84 : 64;
    const ctx = cv.getContext('2d');

    // Nền thủy tinh mờ
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.roundRect(4, 4, 312, cv.height - 8, 14);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    if (empireName) {
      // Dòng 1: Vương miện + Tên đế chế hoàng gia
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`👑 ${empireName}`, 160, 24);

      // Dòng 2: Cấp độ + Tên người chơi
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 17px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`[ LV.${level} ] ${nickname}`, 160, 56);
    } else {
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`LV.${level}`, 16, 32);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(nickname, 175, 32);
    }

    const texture = new THREE.CanvasTexture(cv);
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(4.4, empireName ? 1.15 : 0.95, 1.0);
    return sprite;
  }

  show3DChatBubble(remotePlayer, text) {
    if (remotePlayer.chatBubble) {
      remotePlayer.mesh.remove(remotePlayer.chatBubble);
    }

    const cv = document.createElement('canvas');
    cv.width = 320; cv.height = 90;
    const ctx = cv.getContext('2d');

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.roundRect(6, 6, 308, 68, 16);
    ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Mũi nhọn thoại hướng xuống đầu nhân vật
    ctx.beginPath();
    ctx.moveTo(150, 74);
    ctx.lineTo(160, 86);
    ctx.lineTo(170, 74);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayTxt = text.length > 22 ? (text.slice(0, 20) + '...') : text;
    ctx.fillText(displayTxt, 160, 38);

    const texture = new THREE.CanvasTexture(cv);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
    sprite.scale.set(4.5, 1.25, 1.0);
    sprite.position.set(0, 3.8, 0);

    remotePlayer.mesh.add(sprite);
    remotePlayer.chatBubble = sprite;
    remotePlayer.bubbleTimer = 4.5;
  }

  showLocal3DChatBubble(text) {
    if (!window.player || !window.player.mesh) return;
    const pMesh = window.player.mesh;
    if (window._myChatBubble) pMesh.remove(window._myChatBubble);

    const cv = document.createElement('canvas');
    cv.width = 320; cv.height = 90;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.roundRect(6, 6, 308, 68, 16);
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(150, 74);
    ctx.lineTo(160, 86);
    ctx.lineTo(170, 74);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayTxt = text.length > 22 ? (text.slice(0, 20) + '...') : text;
    ctx.fillText(displayTxt, 160, 38);

    const texture = new THREE.CanvasTexture(cv);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
    sprite.scale.set(4.5, 1.25, 1.0);
    sprite.position.set(0, 3.8, 0);

    pMesh.add(sprite);
    window._myChatBubble = sprite;
    setTimeout(() => {
      if (window._myChatBubble === sprite) {
        pMesh.remove(sprite);
        window._myChatBubble = null;
      }
    }, 4500);
  }

  show3DEmote(remotePlayer, emote) {
    const symbols = { wave: '👋', dance: '💃', money: '💸', heart: '❤️' };
    const icon = symbols[emote] || '✨';
    if (typeof spawnFloatingText === 'function') {
      spawnFloatingText(remotePlayer.mesh.position.clone().add(new THREE.Vector3(0, 3.2, 0)), icon, '#facc15');
    }
  }

  triggerLocalEmote(emote) {
    this.send({ type: 'emote', emote });
    const symbols = { wave: '👋 VẪY TAY CHÀO', dance: '💃 NHẢY MÚA', money: '💸 TUNG TIỀN', heart: '❤️ THẢ TIM' };
    showToast(`${symbols[emote] || emote}!`);
    if (window.player && typeof spawnFloatingText === 'function') {
      const icons = { wave: '👋', dance: '💃', money: '💸', heart: '❤️' };
      spawnFloatingText(window.player.mesh.position.clone().add(new THREE.Vector3(0, 3.2, 0)), icons[emote] || '✨', '#facc15');
    }
  }

  sendChatMessage(text) {
    const clean = String(text || '').trim();
    if (clean.length === 0) return;
    this.send({ type: 'chat', text: clean });
  }

  update(dt) {
    // 1. Gửi gói tin cập nhật vị trí bản thân lên server (Nhịp 10Hz = 100ms khi có di chuyển)
    this.sendTimer += dt;
    if (this.connected && this.sendTimer >= 0.1 && window.player) {
      this.sendTimer = 0;
      const p = window.player;
      const pos = p.mesh.position;
      const isMoved = !this._lastSentPos || this._lastSentPos.distanceToSquared(pos) > 0.001 || p.isMoving || p.isChopping;
      if (isMoved) {
        if (!this._lastSentPos) this._lastSentPos = new THREE.Vector3();
        this._lastSentPos.copy(pos);
        this.send({
          type: 'move',
          x: Number(pos.x.toFixed(2)),
          y: Number(pos.y.toFixed(2)),
          z: Number(pos.z.toFixed(2)),
          rotY: Number(p.mesh.rotation.y.toFixed(2)),
          isMoving: Boolean(p.isMoving),
          isChopping: Boolean(p.isChopping),
          isSwimming: Boolean(p.isSwimming),
          vehicle: typeof gameState !== 'undefined' ? gameState.drivableVehicle : null
        });
      }
    }

    // 2. Nội suy mượt mà vị trí của bạn bè trong thế giới 3D (Lerp Interpolation)
    for (const [id, r] of this.remotePlayers.entries()) {
      r.mesh.position.lerp(r.targetPos, Math.min(1.0, dt * 14.0));
      r.mesh.rotation.y = THREE.MathUtils.lerp(r.mesh.rotation.y, r.targetRotY, Math.min(1.0, dt * 12.0));

      // Hoạt ảnh bước chân người chơi từ xa
      if (r.data.isMoving) {
        r.animCycle += dt * 12.0;
        const s = Math.sin(r.animCycle);
        if (r.legL) r.legL.rotation.x = s * 0.6;
        if (r.legR) r.legR.rotation.x = -s * 0.6;
        if (r.torso) r.torso.position.y = 1.05 + Math.abs(s) * 0.04;
      } else {
        if (r.legL) r.legL.rotation.x = 0;
        if (r.legR) r.legR.rotation.x = 0;
        if (r.torso) r.torso.position.y = 1.05;
      }

      // Giảm timer của bong bóng thoại 3D
      if (r.chatBubble) {
        r.bubbleTimer -= dt;
        if (r.bubbleTimer <= 0) {
          r.mesh.remove(r.chatBubble);
          r.chatBubble = null;
        }
      }
    }
  }

  // Giao diện Khung Chat & Danh sách người chơi Online
  initUI() {
    // 1. Viên hiển thị số lượng người chơi online trên HUD
    const hudSys = document.querySelector('.hud-sys-group');
    if (hudSys && !document.getElementById('multiplayer-online-badge')) {
      const badge = document.createElement('div');
      badge.id = 'multiplayer-online-badge';
      badge.className = 'res-pill online-pill';
      badge.title = 'Danh sách người chơi đang online trong sảnh (Click để đổi tên)';
      badge.innerHTML = `🟢 <span id="online-count">1</span> Online`;
      badge.onclick = () => this.promptChangeNickname();
      hudSys.insertBefore(badge, hudSys.firstChild);
    }

    // 2. Hộp Chat & Emote Widget ở góc trái
    if (!document.getElementById('multiplayer-chat-widget')) {
      const chatWidget = document.createElement('div');
      chatWidget.id = 'multiplayer-chat-widget';
      chatWidget.innerHTML = `
        <div id="chat-messages-container" class="chat-msgs-box"></div>
        <div class="chat-input-bar">
          <input type="text" id="chat-input-field" placeholder="Gõ tin nhắn... (Enter để gửi)" maxlength="80">
          <button id="btn-send-chat" class="chat-send-btn">Gửi</button>
        </div>
        <div class="chat-emotes-bar">
          <button class="emote-btn" data-emote="wave" title="Vẫy tay">👋</button>
          <button class="emote-btn" data-emote="dance" title="Nhảy múa">💃</button>
          <button class="emote-btn" data-emote="money" title="Tung tiền">💸</button>
          <button class="emote-btn" data-emote="heart" title="Thả tim">❤️</button>
        </div>
      `;
      document.body.appendChild(chatWidget);

      const input = document.getElementById('chat-input-field');
      const sendBtn = document.getElementById('btn-send-chat');

      const doSend = () => {
        if (!input) return;
        const val = input.value.trim();
        if (val) {
          this.sendChatMessage(val);
          input.value = '';
          input.blur();
        }
      };

      if (sendBtn) sendBtn.onclick = doSend;
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            doSend();
          }
        });
      }

      // Nút Emotes
      chatWidget.querySelectorAll('.emote-btn').forEach(btn => {
        btn.onclick = () => {
          const em = btn.dataset.emote;
          if (em) this.triggerLocalEmote(em);
        };
      });

      // Bấm phím Enter ở bất cứ đâu để mở ô chat
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && document.activeElement !== input) {
          e.preventDefault();
          if (input) input.focus();
        }
      });
    }
  }

  updateOnlineBadge() {
    const el = document.getElementById('online-count');
    if (el) {
      const count = 1 + this.remotePlayers.size;
      el.textContent = `${count}`;
    }
  }

  displayChatMessage(sender, text, isMe = false, empireName = '') {
    const box = document.getElementById('chat-messages-container');
    if (!box) return;

    const line = document.createElement('div');
    line.className = `chat-line ${isMe ? 'chat-me' : 'chat-other'}`;
    const empTag = empireName ? `<span class="chat-empire-tag">[${empireName}]</span> ` : '';
    line.innerHTML = `${empTag}<span class="chat-sender">${sender}:</span> <span class="chat-text">${text}</span>`;
    box.appendChild(line);

    box.scrollTop = box.scrollHeight;

    // Giữ tối đa 30 tin nhắn
    while (box.children.length > 30) {
      box.removeChild(box.firstChild);
    }
  }

  promptChangeNickname() {
    const newName = prompt('Nhập tên hiển thị mới của bạn trong sảnh:', this.myNickname);
    if (newName && newName.trim().length > 0) {
      this.myNickname = newName.trim().slice(0, 18);
      localStorage.setItem('lumber_tycoon_nickname', this.myNickname);
      showToast(`🏷️ Đã đổi tên thành: ${this.myNickname}`);
      this.send({
        type: 'join',
        nickname: this.myNickname
      });
    }
  }
}

window.MultiplayerManager = MultiplayerManager;

