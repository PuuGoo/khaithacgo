/**
 * UI & In-Game Immersive HUD Manager
 * World-space floating numbers, head floating gauges, quest tracker, fever mode & offline welcome modal
 */

const floatContainer = document.getElementById('floating-container');
const singleToast = document.getElementById('single-toast');
let toastTimer = null;
let currentQuestIndex = 0;
let feverTimer = 0;

// Single Toast Notification ở góc dưới bên phải
function showToast(msg) {
  if (!singleToast) return;
  if (toastTimer) clearTimeout(toastTimer);
  singleToast.textContent = msg;
  singleToast.classList.add('visible');
  toastTimer = setTimeout(() => singleToast.classList.remove('visible'), 1600);
}

// Số nhảy tại chỗ trong không gian 3D (World-Space Floating Text)
function spawnFloatingText(worldPos, text, color = '#4ade80') {
  if (!floatContainer || !window.camera) return;
  const el = document.createElement('div');
  el.className = 'world-float-text';
  el.textContent = text;
  el.style.color = color;

  const screenPos = worldToScreen(worldPos);
  el.style.left = `${screenPos.x}px`;
  el.style.top = `${screenPos.y}px`;

  floatContainer.appendChild(el);
  setTimeout(() => el.remove(), 850);
}

const _screenVecTmp = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
const _headPosTmp = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;

function worldToScreen(pos) {
  if (!window.camera) return { x: 0, y: 0 };
  const v = _screenVecTmp ? _screenVecTmp.copy(pos).project(window.camera) : pos.clone().project(window.camera);
  return {
    x: (v.x * 0.5 + 0.5) * window.innerWidth,
    y: (-v.y * 0.5 + 0.5) * window.innerHeight
  };
}

// Cập nhật Thanh HUD trên cùng
function updateHUD() {
  const elMoney = document.getElementById('val-money');
  const elLogs = document.getElementById('val-logs');
  const elPlanks = document.getElementById('val-planks');
  const elFish = document.getElementById('val-fish');
  const elCanned = document.getElementById('val-canned');
  const elEmpireName = document.getElementById('val-empire-name');
  const elUsername = document.getElementById('val-username');
  if (elEmpireName && gameState.empireName) elEmpireName.textContent = gameState.empireName;
  if (elUsername && gameState.username) elUsername.textContent = gameState.username;

  if (elMoney) elMoney.textContent = formatCurrency(gameState.money);
  if (elLogs) elLogs.textContent = `${gameState.logs}/${gameState.backpackMax}`;
  if (elPlanks) elPlanks.textContent = gameState.planks;
  const elPallets = document.getElementById('val-pallets');
  if (elPallets) elPallets.textContent = gameState.pallets || 0;
  if (elFish) elFish.textContent = gameState.freshFish;
  if (elCanned) elCanned.textContent = gameState.cannedFish;
  const elRp = document.getElementById('val-rp');
  if (elRp) elRp.textContent = `${gameState.researchPoints || 0} RP`;

  // Cập nhật nguyên liệu Đại Đô Thị mới
  const elSteel = document.getElementById('val-steel');
  if (elSteel) elSteel.textContent = gameState.steelBeams || 0;
  const elCement = document.getElementById('val-cement');
  if (elCement) elCement.textContent = gameState.cementBags || 0;
  const elRations = document.getElementById('val-rations');
  if (elRations) elRations.textContent = gameState.cannedRations || 0;

  // Cập nhật Thanh Dashboard Đại Đô Thị
  if (typeof updateCityDashboardHUD === 'function') {
    updateCityDashboardHUD();
  }

  // Cập nhật trạng thái Nút Tăng Ca (Overtime Rush)
  const elBtnOvertime = document.getElementById('btn-overtime-rush');
  const elOvertimeBadge = document.getElementById('overtime-badge');
  const elVignette = document.getElementById('fever-vignette');
  if (elBtnOvertime && elOvertimeBadge && gameState.overtimeRush) {
    if (gameState.overtimeRush.active) {
      elBtnOvertime.classList.add('active');
      elOvertimeBadge.textContent = `${Math.ceil(gameState.overtimeRush.timer)}s`;
      if (elVignette) elVignette.classList.add('rush-active');
    } else {
      elBtnOvertime.classList.remove('active');
      if (elVignette) elVignette.classList.remove('rush-active');
      if (gameState.overtimeRush.cooldown > 0) {
        elOvertimeBadge.textContent = `${Math.ceil(gameState.overtimeRush.cooldown)}s`;
      } else {
        elOvertimeBadge.textContent = 'SẴN SÀNG';
      }
    }
  }
  const elWorkers = document.getElementById('val-workers');
  if (elWorkers) {
    const totalWorkers = (gameState.workers || 0) + 3 +
      (gameState.fishermen || 0) +
      (gameState.carpenters || 0) +
      (gameState.miners || 0) +
      (gameState.resortStaff || 0) +
      (gameState.airportCrew || 0);
    elWorkers.textContent = totalWorkers;
  }

  // Cập nhật HUD Xe Tải Chở Gỗ & Nút Thao Tác Mobile
  const elTruckPill = document.getElementById('hud-truck-pill');
  const elTruckCargo = document.getElementById('val-truck-cargo');
  const elTruckAction = document.getElementById('truck-action-hud');
  if (elTruckPill && elTruckCargo) {
    if (gameState.isDrivingTruck) {
      elTruckPill.style.display = 'flex';
      elTruckCargo.textContent = `${gameState.truckCargo || 0}/${gameState.truckMaxCargo || 16}`;
      if (elTruckAction) elTruckAction.style.display = 'flex';
    } else {
      elTruckPill.style.display = 'none';
      if (elTruckAction) elTruckAction.style.display = 'none';
    }
  }

  // Weather Pill (☀️ Nắng | 🌧️ Mưa | 🌈 Cầu Vồng)
  const elWeatherIcon = document.getElementById('weather-icon');
  const elWeatherText = document.getElementById('weather-text');
  if (elWeatherIcon && elWeatherText && typeof gameState !== 'undefined') {
    if (gameState.weather === 'rain') {
      elWeatherIcon.textContent = '🌧️';
      elWeatherText.textContent = 'Mưa x2 Cây';
    } else if (gameState.weather === 'rainbow') {
      elWeatherIcon.textContent = '🌈';
      elWeatherText.textContent = 'Cầu Vồng x2 $';
    } else {
      elWeatherIcon.textContent = '☀️';
      elWeatherText.textContent = 'Nắng Đẹp';
    }
  }

  // Passive rate tag (+$X/s)
  const passiveRate = (gameState.supermarketTier * 12) + (gameState.forklifts * 4) +
    ((gameState.fishermen || 0) * 35) +
    ((gameState.carpenters || 0) * 75) +
    ((gameState.miners || 0) * 150) +
    ((gameState.resortStaff || 0) * 120) +
    ((gameState.airportCrew || 0) * 220);
  gameState.passiveIncome = passiveRate;
  const elRate = document.getElementById('val-rate');
  if (elRate) {
    elRate.textContent = passiveRate > 0 ? `(+${formatCurrency(passiveRate)}/s)` : '';
  }

  // Check Quests & Progression
  updateQuestTracker();
  checkProgression();
  updateHeadGauge();
  if (typeof isShopOpen === 'function' && isShopOpen()) {
    renderUpgradeShop();
  }
}

// Thước đo trạng thái trên đầu nhân vật (Head Floating Gauge - Tối ưu GPU Transform & Zero DOM Reflow)
let _cachedGaugeEl = null;
let _lastGaugeText = '';
let _lastGaugeFull = false;

function updateHeadGauge() {
  if (!_cachedGaugeEl) _cachedGaugeEl = document.getElementById('player-head-gauge');
  if (!_cachedGaugeEl || !window.player || !window.player.mesh || !window.camera) return;

  const pPos = window.player.mesh.position;
  const headPos = _headPosTmp ? _headPosTmp.set(pPos.x, pPos.y + 3.2, pPos.z) : pPos.clone().add(new THREE.Vector3(0, 3.2, 0));
  const screenPos = worldToScreen(headPos);

  _cachedGaugeEl.style.transform = `translate3d(${Math.round(screenPos.x)}px, ${Math.round(screenPos.y)}px, 0) translate(-50%, -100%)`;

  const heroTitle = typeof getPlayerHeroTitle === 'function' ? getPlayerHeroTitle() : '';
  const isFull = (typeof gameState !== 'undefined') && (gameState.logs >= gameState.backpackMax);
  const newText = isFull ? `${heroTitle} • 🚨 FULL! (${gameState.logs}/${gameState.backpackMax})` : `${heroTitle} • 🪵 ${gameState.logs}/${gameState.backpackMax}`;
  if (newText !== _lastGaugeText) {
    _cachedGaugeEl.textContent = newText;
    _lastGaugeText = newText;
  }
  if (isFull !== _lastGaugeFull) {
    if (isFull) _cachedGaugeEl.classList.add('full');
    else _cachedGaugeEl.classList.remove('full');
    _lastGaugeFull = isFull;
  }
}

// Hệ thống Mini-Quest & Thưởng nóng
function updateQuestTracker() {
  const qWidget = document.getElementById('quest-tracker-widget');
  const qText = document.getElementById('quest-tracker-text');
  if (!qWidget || !qText || currentQuestIndex >= QUEST_CHAIN.length) {
    if (qWidget) qWidget.style.display = 'none';
    return;
  }

  const q = QUEST_CHAIN[currentQuestIndex];
  qText.textContent = `Nhiệm vụ: ${q.text} (+$${q.reward})`;

  // Kiểm tra hoàn thành
  const curVal = gameState[q.targetKey] || 0;
  if (curVal >= q.targetVal) {
    qWidget.classList.add('completed');
    sounds.playLevelUp();
    gameState.money += q.reward;
    spawnFloatingText(window.player ? window.player.mesh.position : new THREE.Vector3(), `+${formatCurrency(q.reward)} 💵`, '#facc15');
    currentQuestIndex++;

    setTimeout(() => {
      qWidget.classList.remove('completed');
      updateHUD();
      triggerActionSave();
    }, 1200);
  }
}

function checkProgression() {
  const cfg = LEVEL_CONFIGS[gameState.level];
  if (!cfg) return;

  const elTag = document.getElementById('level-tag');
  const elGoal = document.getElementById('level-goal');
  
  const shortTags = {
    1: 'LV.1 THỦ CÔNG',
    2: 'LV.2 MÁY CƯA',
    3: 'LV.3 LOGISTICS',
    4: 'LV.4 BẾN CẢNG',
    5: 'LV.5 TẬP ĐOÀN'
  };
  if (elTag) elTag.textContent = shortTags[gameState.level] || cfg.tag;

  let pct = 0;
  if (gameState.level === 1) {
    const lP = Math.min(gameState.totalLogsCut / cfg.reqLogs, 1.0);
    const pP = Math.min(gameState.totalPlanksSawn / cfg.reqPlanks, 1.0);
    const mP = Math.min(gameState.money / cfg.reqMoney, 1.0);
    pct = (lP + pP + mP) / 3 * 100;
    if (elGoal) elGoal.textContent = `Đốn ${gameState.totalLogsCut}/${cfg.reqLogs} • Xẻ ${gameState.totalPlanksSawn}/${cfg.reqPlanks}`;

    if (gameState.totalLogsCut >= cfg.reqLogs && gameState.totalPlanksSawn >= cfg.reqPlanks && gameState.money >= cfg.reqMoney) {
      levelUp(2);
    }
  } else if (gameState.level === 2) {
    const pP = Math.min(gameState.totalPlanksSawn / cfg.reqPlanks, 1.0);
    const eP = Math.min((gameState.exportOrders || 0) / (cfg.reqExport || 5), 1.0);
    const mP = Math.min(gameState.money / cfg.reqMoney, 1.0);
    pct = (pP + eP + mP) / 3 * 100;
    if (elGoal) elGoal.textContent = `Ván ${gameState.totalPlanksSawn}/${cfg.reqPlanks} • Xe ${gameState.exportOrders || 0}/${cfg.reqExport || 5}`;

    if (gameState.totalPlanksSawn >= cfg.reqPlanks && (gameState.exportOrders || 0) >= (cfg.reqExport || 5) && gameState.money >= cfg.reqMoney) {
      levelUp(3);
    }
  } else if (gameState.level === 3) {
    const eP = Math.min((gameState.exportOrders || 0) / (cfg.reqExport || 20), 1.0);
    const wP = Math.min((gameState.workers || 0) / (cfg.reqWorkers || 2), 1.0);
    const mP = Math.min(gameState.money / cfg.reqMoney, 1.0);
    pct = (eP + wP + mP) / 3 * 100;
    if (elGoal) elGoal.textContent = `Xe ${gameState.exportOrders || 0}/${cfg.reqExport || 20} • Thợ ${gameState.workers || 0}/${cfg.reqWorkers || 2}`;

    if ((gameState.exportOrders || 0) >= (cfg.reqExport || 20) && (gameState.workers || 0) >= (cfg.reqWorkers || 2) && gameState.money >= cfg.reqMoney) {
      levelUp(4);
    }
  } else if (gameState.level === 4) {
    const cP = Math.min((gameState.cannedFish || 0) / (cfg.reqCanned || 50), 1.0);
    const eP = Math.min((gameState.exportOrders || 0) / (cfg.reqExport || 45), 1.0);
    const mP = Math.min(gameState.money / cfg.reqMoney, 1.0);
    pct = (cP + eP + mP) / 3 * 100;
    if (elGoal) elGoal.textContent = `Cá ${gameState.cannedFish || 0}/${cfg.reqCanned || 50} • Xe ${gameState.exportOrders || 0}/${cfg.reqExport || 45}`;

    if ((gameState.cannedFish || 0) >= (cfg.reqCanned || 50) && (gameState.exportOrders || 0) >= (cfg.reqExport || 45) && gameState.money >= cfg.reqMoney) {
      levelUp(5);
    }
  } else {
    const mP = Math.min(gameState.money / (cfg.reqMoney || 150000), 1.0);
    pct = mP * 100;
    if (elGoal) elGoal.textContent = `Đế Chế • ${formatCurrency(gameState.money)}`;
  }

  const elFill = document.getElementById('xp-bar-fill');
  if (elFill) elFill.style.width = `${Math.min(pct, 100)}%`;
}

function levelUp(newLevel) {
  gameState.level = newLevel;
  if (!gameState.unlockedZones.includes(newLevel)) {
    gameState.unlockedZones.push(newLevel);
  }
  sounds.playLevelUp();
  const cfg = LEVEL_CONFIGS[newLevel];
  const elTitle = document.getElementById('modal-level-title');
  const elDesc = document.getElementById('modal-level-desc');
  if (elTitle) elTitle.textContent = `🎉 ${cfg.title}`;
  if (elDesc) elDesc.textContent = cfg.unlockMsg;
  const modal = document.getElementById('levelup-modal');
  if (modal) modal.classList.add('open');

  if (typeof updateSectorBarricades === 'function') {
    updateSectorBarricades();
  }
  triggerActionSave();
  updateHUD();
}

// Chế độ Tăng tốc Kích thích Rìu Vàng (Fever / Rush Mode)
function triggerFeverMode() {
  if (feverTimer > 0) return;
  feverTimer = 30.0;
  const vignette = document.getElementById('fever-vignette');
  if (vignette) vignette.classList.add('fever-active');
  sounds.playLevelUp();
  showToast('🔥 RÌU VÀNG KÍCH HOẠT: Tốc độ x2 & Chặt 1 nhát đổ cây!');

  const btnFever = document.getElementById('btn-fever');
  if (btnFever) btnFever.disabled = true;

  const interval = setInterval(() => {
    feverTimer -= 1.0;
    if (btnFever) btnFever.textContent = `🔥 ${Math.ceil(feverTimer)}s`;
    if (feverTimer <= 0) {
      clearInterval(interval);
      if (vignette) vignette.classList.remove('fever-active');
      if (btnFever) {
        btnFever.disabled = false;
        btnFever.textContent = '🪓 Rìu Vàng';
      }
      showToast('Hết thời gian Rìu Vàng!');
    }
  }, 1000);
}

function isFeverActive() {
  return feverTimer > 0;
}

// Kiểm tra và hiển thị Thu nhập Ngoại tuyến (Offline Earnings)
function checkOfflineEarnings() {
  if (!gameState.lastLogout) return;
  const now = Date.now();
  const offlineSecs = Math.min((now - gameState.lastLogout) / 1000, 7200); // Tối đa 2 giờ

  if (offlineSecs >= 60) {
    const ratePerSec = Math.max((gameState.supermarketTier * 6) + (gameState.forklifts * 2) + (gameState.workers * 1.5), 1.0);
    const earned = Math.floor(offlineSecs * ratePerSec);

    if (earned > 0) {
      const modal = document.getElementById('offline-modal');
      const text = document.getElementById('offline-earnings-text');
      if (text) text.textContent = `Bạn đã vắng mặt ${Math.floor(offlineSecs / 60)} phút. Đội ngũ đã mang về: +$${formatCurrency(earned)} 💵`;
      if (modal) {
        modal.classList.add('open');
        const btnClaim = document.getElementById('btn-claim-offline');
        if (btnClaim) {
          btnClaim.onclick = () => {
            gameState.money += earned;
            sounds.playLevelUp();
            modal.classList.remove('open');
            showToast(`🎉 Đã thu nhận $${formatCurrency(earned)} tiền ngoại tuyến!`);
            updateHUD();
            triggerActionSave();
          };
        }
      }
    }
  }
}

// ===========================================================================
// ALL-IN-ONE EMPIRE UPGRADE HQ & SHOP UI CONTROLLER (COMPACT FLOATING PANEL)
// ===========================================================================
let currentShopTab = 'tab_player';

function isShopOpen() {
  const panel = document.getElementById('upgrade-shop-panel');
  return panel && panel.classList.contains('open');
}

function openUpgradeShop(tabId = null) {
  if (tabId) currentShopTab = tabId;
  const panel = document.getElementById('upgrade-shop-panel');
  if (!panel) return;

  // Đóng bảng phím tắt nếu đang mở để tránh chồng lấn
  const shortcuts = document.getElementById('shortcuts-modal');
  if (shortcuts) shortcuts.classList.remove('open');

  panel.classList.add('open');
  sounds.playLevelUp();
  renderUpgradeShop();
}

function closeUpgradeShop() {
  const panel = document.getElementById('upgrade-shop-panel');
  if (panel) panel.classList.remove('open');
}

function toggleUpgradeShop() {
  if (isShopOpen()) closeUpgradeShop();
  else openUpgradeShop();
}

function renderUpgradeShop() {
  const panel = document.getElementById('upgrade-shop-panel');
  if (!panel || !panel.classList.contains('open')) return;

  // Cập nhật số dư tiền trong ví cửa hàng
  const elWallet = document.getElementById('shop-wallet-money');
  if (elWallet) elWallet.textContent = formatCurrency(gameState.money);

  // Render danh sách Tabs dạng Pill Kbd
  const navEl = document.getElementById('shop-tabs-nav');
  if (navEl && typeof EMPIRE_SHOP_TABS !== 'undefined') {
    navEl.innerHTML = '';
    EMPIRE_SHOP_TABS.forEach(tab => {
      const btn = document.createElement('button');
      btn.className = `shop-tab-pill ${tab.id === currentShopTab ? 'active' : ''}`;
      btn.innerHTML = `${tab.name}`;
      btn.onclick = () => {
        currentShopTab = tab.id;
        renderUpgradeShop();
      };
      navEl.appendChild(btn);
    });
  }

  // Render danh sách các mục nâng cấp dạng Row compact tương tự bảng phím tắt
  const listEl = document.getElementById('shop-items-grid');
  if (listEl && typeof EMPIRE_SHOP_ITEMS !== 'undefined') {
    listEl.innerHTML = '';
    const items = Object.values(EMPIRE_SHOP_ITEMS).filter(item => item.tab === currentShopTab);

    items.forEach(item => {
      const curLvl = item.getCurrentLevel();
      const nextCost = item.getNextCost();
      const isMax = nextCost === null || curLvl >= item.maxLevel;
      const isLocked = item.canUpgradeNow ? !item.canUpgradeNow() : false;
      const canAfford = !isMax && !isLocked && gameState.money >= nextCost;

      const row = document.createElement('div');
      row.className = 'shop-panel-row';

      let btnLabel = `NÂNG<br><span style="color:${canAfford ? '#fde047' : '#94a3b8'};">$${formatCurrency(nextCost)}</span>`;
      if (isMax) btnLabel = 'TỐI ĐA';
      else if (isLocked) btnLabel = '🔒 KHÓA';

      row.innerHTML = `
        <div class="shop-panel-row-left">
          <div class="shop-row-title-line">
            <span class="shop-row-icon">${item.icon}</span>
            <span class="shop-row-name">${item.name}</span>
            <span class="kbd kbd-lvl ${isMax ? 'kbd-max' : ''}">${isMax ? 'MAX' : `Lv.${curLvl}/${item.maxLevel}`}</span>
          </div>
          <div class="shop-row-desc">
            ${item.getCurrentDesc()}
            <br>
            ${isMax ? '<span style="color:#eab308; font-weight:700;">🏆 Đã đạt cấp tối đa</span>' : `➔ <span class="shop-row-benefit">${item.getNextBenefit()}</span>`}
          </div>
        </div>
        <div class="shop-panel-row-right">
          <button class="kbd-buy-btn ${isMax ? 'is-max' : (canAfford ? 'can-buy' : 'disabled')}"
            ${isMax || isLocked || !canAfford ? 'disabled' : ''}>
            ${btnLabel}
          </button>
        </div>
      `;

      const buyBtn = row.querySelector('.kbd-buy-btn');
      if (buyBtn && !isMax && !isLocked) {
        buyBtn.onclick = (e) => {
          e.stopPropagation();
          buyShopItem(item.id);
        };
      }

      listEl.appendChild(row);
    });
  }
}

function buyShopItem(itemId) {
  const item = EMPIRE_SHOP_ITEMS[itemId];
  if (!item) return;

  if (item.canUpgradeNow && !item.canUpgradeNow()) {
    showToast('🔒 Hạng mục này chưa mở khóa cấp độ!');
    return;
  }

  const cost = item.getNextCost();
  if (cost === null) {
    showToast('🏆 Hạng mục này đã đạt cấp tối đa!');
    return;
  }

  if (gameState.money < cost) {
    const missing = Math.ceil(cost - gameState.money);
    showToast(`⚠️ Chưa đủ tiền! (Còn thiếu $${formatCurrency(missing)})`);
    return;
  }

  gameState.money -= cost;
  const ok = item.onUpgrade();
  if (ok === false) {
    gameState.money += cost; // Hoàn tiền nếu onUpgrade fail
    return;
  }
  sounds.playLevelUp();
  showToast(`🎉 Nâng cấp 1-Click thành công: ${item.name}!`);

  // Hiệu ứng số tiền trừ đỏ nổi bật & chùm sao vàng thăng hoa & sóng chấn động lan tỏa
  if (window.player) {
    spawnFloatingText(window.player.mesh.position, `-$${formatCurrency(cost)} 💵`, '#ef4444');
    if (typeof spawnShockwave === 'function') {
      spawnShockwave(window.player.mesh.position, 0x22c55e);
    }
    if (typeof spawnParticle === 'function') {
      for (let s = 0; s < 16; s++) {
        spawnParticle(window.player.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.4, 1.4, (Math.random() - 0.5) * 1.4)), 0xfacc15);
      }
    }
  }

  updateHUD();
  renderUpgradeShop();
  triggerActionSave();
}

// ===========================================================================
// BẢN ĐỒ RADAR THU NHỎ (MINIMAP RADAR & GPS NAVIGATOR)
// ===========================================================================
let minimapSweepAngle = 0;

const POI_LOCATIONS = {
  gold: { name: 'Mỏ Vàng Phía Bắc', x: 0, z: -110, icon: '🪙', color: '#facc15' },
  sawmill: { name: 'Xưởng Cưa Trung Tâm', x: 0, z: -18, icon: '🪵', color: '#f97316' },
  harbor: { name: 'Cảng Biển Quốc Tế', x: 33, z: 4, icon: '⚓', color: '#38bdf8' },
  city_hall: { name: 'Tòa Thị Chính', x: -20, z: 56, icon: '🏛️', color: '#38bdf8' },
  police: { name: 'Sở Cảnh Sát Đô Thị', x: -58, z: 56, icon: '👮', color: '#3b82f6' },
  hospital_fire: { name: 'Bệnh Viện & Cứu Hỏa 911', x: 70, z: 56, icon: '🚑', color: '#ef4444' },
  landmark: { name: 'Đại Công Trường Kỳ Quan', x: -20, z: 100, icon: '🏗️', color: '#f59e0b' },
  power_grid: { name: 'Nhà Máy Điện Đô Thị', x: 75, z: -45, icon: '⚡', color: '#facc15' },
  market: { name: 'Sàn Chợ Giao Dịch', x: 10, z: 56, icon: '🛒', color: '#10b981' },
  foundry: { name: 'Khu Luyện Kim & Lò Cao', x: 75, z: -75, icon: '⛏️', color: '#06b6d4' },
  agro_mill: { name: 'Nông Trường & Xưởng Xay', x: -65, z: -75, icon: '🌾', color: '#22c55e' },
  prison: { name: 'Trại Giam Biệt Lập', x: -145, z: 60, icon: '⛓️', color: '#dc2626' },
  furniture: { name: 'Xưởng Nội Thất Bắc Âu', x: 5, z: 95, icon: '🪑', color: '#fb923c' },
  resort: { name: 'Resort Đảo Maldives', x: 150, z: 50, icon: '🏖️', color: '#06b6d4' },
  airport: { name: 'Sân Bay Boeing 747', x: 15, z: 185, icon: '✈️', color: '#818cf8' },
  air_cargo: { name: 'Sân Bay Air Cargo Quốc Tế', x: 35, z: -100, icon: '✈️', color: '#38bdf8' },
  coastal_villa: { name: 'Dinh Thự Ven Biển & Bể Bơi', x: 100, z: 56, icon: '🏡', color: '#f59e0b' },
  residential: { name: 'Khu Chung Cư & Siêu Thị 24/7', x: -65, z: 98, icon: '🏙️', color: '#10b981' },
  food_trucks: { name: 'Phố Đi Bộ & Xe Đồ Ăn', x: -35, z: 42, icon: '🍔', color: '#ef4444' },
  speed_circuit: { name: 'Cổng Đua Cao Tốc Time Trial', x: 28, z: 32, icon: '🏁', color: '#e11d48' },
  eco_recycling: { name: 'Trạm Tái Chế Sinh Thái ♻️', x: 75, z: -95, icon: '♻️', color: '#22c55e' },
  marina_jetski: { name: 'Bến Du Thuyền & Jetski 🛥️', x: 135, z: 50, icon: '🛥️', color: '#06b6d4' },
  lucky_wheel: { name: 'Vòng Quay May Mắn 🎡', x: -20, z: 36, icon: '🎡', color: '#facc15' },
  lighthouse: { name: 'Ngọn Hải Đăng Cổ Kính 🗼', x: 165, z: 15, icon: '🗼', color: '#ef4444' },
  train: { name: 'Ga Tàu Hỏa Hơi Nước', x: -45, z: -32, icon: '🚂', color: '#facc15' },
  heli: { name: 'Sân Bay Trực Thăng Helipad', x: 45, z: -2, icon: '🚁', color: '#38bdf8' },
  yacht: { name: 'Siêu Du Thuyền Maldives', x: 168, z: 55, icon: '🛥️', color: '#06b6d4' }
};

function initMinimap() {
  const quickBtns = document.querySelectorAll('.poi-quick-btn');
  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const poiKey = btn.dataset.poi;
      const target = POI_LOCATIONS[poiKey];
      if (target) {
        gameState.gpsTarget = { x: target.x, z: target.z, name: target.name };
        showToast(`🧭 Đã bật GPS dẫn đường: ${target.name} (${target.icon})!`);
        sounds.playClick();
      }
    });
  });

  const canvas = document.getElementById('minimap-canvas');
  if (canvas) {
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Chuyển tọa độ click canvas sang tọa độ thế giới (Invert map transform)
      const cx = 75, cy = 75, S = 70.0 / 190.0, X0 = 10, Z0 = 35;
      const worldX = (clickX - cx) / S + X0;
      const worldZ = (clickY - cy) / S + Z0;

      gameState.gpsTarget = { x: Math.round(worldX), z: Math.round(worldZ), name: 'Điểm Đánh Dấu Bản Đồ' };
      showToast(`📍 Đã ghim GPS tại [X: ${Math.round(worldX)}, Z: ${Math.round(worldZ)}]!`);
      sounds.playClick();
    });
  }
}

let _minimapCanvas = null;
let _minimapCtx = null;

function renderMinimap() {
  if (!_minimapCanvas) _minimapCanvas = document.getElementById('minimap-canvas');
  if (!_minimapCanvas) return;
  if (!_minimapCtx) _minimapCtx = _minimapCanvas.getContext('2d');
  const ctx = _minimapCtx;
  if (!ctx) return;

  const w = 150, h = 150;
  const cx = 75, cy = 75;
  const S = 70.0 / 190.0;
  const X0 = 10, Z0 = 35;

  ctx.clearRect(0, 0, w, h);

  // 1. Nền Radar
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 73, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, w, h);

  // Vòng tròn cự ly radar (Range rings)
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.lineWidth = 1;
  [24, 48, 68].forEach(r => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Trục chữ thập radar (Crosshairs)
  ctx.beginPath();
  ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
  ctx.moveTo(0, cy); ctx.lineTo(w, cy);
  ctx.stroke();

  const toMapX = (wx) => cx + (wx - X0) * S;
  const toMapY = (wz) => cy + (wz - Z0) * S;

  // 2. Dòng sông đại dương (River Channel)
  const riverY1 = toMapY(4);
  const riverY2 = toMapY(28);
  ctx.fillStyle = 'rgba(2, 132, 199, 0.45)';
  ctx.fillRect(0, riverY1, w, Math.max(4, riverY2 - riverY1));

  // 3. Cầu Vượt Sông (Highway Bridge)
  const bX = toMapX(28);
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(bX - 3, riverY1 - 2, 6, Math.max(8, riverY2 - riverY1 + 4));

  // 4. Các điểm POI nổi bật
  Object.values(POI_LOCATIONS).forEach(poi => {
    const mx = toMapX(poi.x);
    const my = toMapY(poi.z);
    ctx.fillStyle = poi.color;
    ctx.beginPath();
    ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Icon nhấp nháy nếu là GPS Target
    if (gameState.gpsTarget && Math.abs(gameState.gpsTarget.x - poi.x) < 5 && Math.abs(gameState.gpsTarget.z - poi.z) < 5) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, 6 + Math.sin(Date.now() * 0.008) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  // 5. Đường dẫn hướng GPS (Neon Trail Line)
  if (gameState.gpsTarget && window.player && window.player.mesh) {
    const pPos = window.player.mesh.position;
    const pmx = toMapX(pPos.x);
    const pmy = toMapY(pPos.z);
    const tmx = toMapX(gameState.gpsTarget.x);
    const tmy = toMapY(gameState.gpsTarget.z);

    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(pmx, pmy);
    ctx.lineTo(tmx, tmy);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 6. Phương tiện di chuyển (Vehicles)
  if (window.drivableForklift) {
    const fx = toMapX(window.drivableForklift.mesh.position.x);
    const fy = toMapY(window.drivableForklift.mesh.position.z);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(fx - 2, fy - 2, 4, 4);
  }
  if (window.drivablePickup) {
    const px = toMapX(window.drivablePickup.mesh.position.x);
    const py = toMapY(window.drivablePickup.mesh.position.z);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(px - 2, py - 2, 4, 4);
  }
  if (window.drivableSpeedboat) {
    const sx = toMapX(window.drivableSpeedboat.mesh.position.x);
    const sy = toMapY(window.drivableSpeedboat.mesh.position.z);
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(sx - 2, sy - 2, 4, 4);
  }

  // Phương tiện mới: Trực thăng, Tàu hỏa, Du thuyền, Thú cưng
  if (window.drivableHelicopter && window.drivableHelicopter.mesh) {
    const hx = toMapX(window.drivableHelicopter.mesh.position.x);
    const hy = toMapY(window.drivableHelicopter.mesh.position.z);
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(hx, hy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText('H', hx - 2.5, hy + 2.5);
  }

  if (window.steamTrain && window.steamTrain.locomotiveGroup) {
    const tx = toMapX(window.steamTrain.locomotiveGroup.position.x);
    const ty = toMapY(window.steamTrain.locomotiveGroup.position.z);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(tx - 3, ty - 3, 6, 6);
  }

  if (window.megaLuxuryYacht) {
    const yx = toMapX(window.megaLuxuryYacht.position.x);
    const yy = toMapY(window.megaLuxuryYacht.position.z);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(yx - 3, yy - 3, 6, 6);
  }

  if (window.shibaPet && window.shibaPet.mesh) {
    const px = toMapX(window.shibaPet.mesh.position.x);
    const py = toMapY(window.shibaPet.mesh.position.z);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6.5. Đánh dấu đám cháy khẩn cấp 911 nhấp nháy đỏ trên Minimap
  if (window.cityState && window.cityState.activeCrisis && window.cityState.activeCrisis.location) {
    const cl = window.cityState.activeCrisis.location;
    const fx = toMapX(cl.x);
    const fy = toMapY(cl.z);
    const blink = Math.sin(Date.now() * 0.01) > 0;
    ctx.fillStyle = blink ? '#ef4444' : '#facc15';
    ctx.beginPath();
    ctx.arc(fx, fy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('🔥', fx - 5, fy + 3);
  }

  // 7. Người chơi (Player Marker)
  if (window.player && window.player.mesh) {
    const pPos = window.player.mesh.position;
    const pmx = toMapX(pPos.x);
    const pmy = toMapY(pPos.z);

    // Chấm xanh lá nổi bật
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(pmx, pmy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Mũi hướng nhìn (Heading vector)
    const rot = window.player.mesh.rotation.y;
    const hx = pmx + Math.sin(rot) * 7;
    const hy = pmy + Math.cos(rot) * 7;
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pmx, pmy);
    ctx.lineTo(hx, hy);
    ctx.stroke();
  }

  // 8. Vệt quét radar xoay tròn (Radar Sweep Scanner)
  minimapSweepAngle += 0.035;
  if (minimapSweepAngle > Math.PI * 2) minimapSweepAngle = 0;

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(minimapSweepAngle) * 73, cy + Math.sin(minimapSweepAngle) * 73);
  ctx.stroke();

  ctx.restore();
}
window.initMinimap = initMinimap;
window.renderMinimap = renderMinimap;

// ===========================================================================
// MODAL THÀNH TỰU & HUY CHƯƠNG (ACHIEVEMENTS SYSTEM)
// ===========================================================================
function initAchievementsModal() {
  const btnOpen = document.getElementById('btn-achievements');
  const btnClose = document.getElementById('btn-close-achievements');
  const modal = document.getElementById('achievements-modal');

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      openAchievementsModal();
    });
  }
  if (btnClose && modal) {
    btnClose.addEventListener('click', () => {
      modal.classList.remove('open');
    });
  }
}

function openAchievementsModal() {
  const modal = document.getElementById('achievements-modal');
  const listEl = document.getElementById('achievements-list');
  if (!modal || !listEl || typeof ACHIEVEMENT_DEFINITIONS === 'undefined') return;

  listEl.innerHTML = '';
  if (!gameState.achievementsClaimed) gameState.achievementsClaimed = [];

  ACHIEVEMENT_DEFINITIONS.forEach(a => {
    const isClaimed = gameState.achievementsClaimed.includes(a.id);
    const canClaim = !isClaimed && a.isDone(gameState);

    const item = document.createElement('div');
    item.className = `achievement-item ${isClaimed ? 'claimed' : ''}`;

    item.innerHTML = `
      <div class="achievement-info">
        <div class="achievement-icon">${a.icon}</div>
        <div class="achievement-texts">
          <div class="achievement-name">${a.title}</div>
          <div class="achievement-desc">${a.desc}</div>
          <div class="achievement-reward">+${formatCurrency(a.reward)} 💵</div>
        </div>
      </div>
      <button class="btn-claim-reward" ${!canClaim ? 'disabled' : ''}>
        ${isClaimed ? 'Đã Nhận ✔' : (canClaim ? 'Nhận Thưởng 🎁' : 'Chưa Đạt')}
      </button>
    `;

    const btn = item.querySelector('.btn-claim-reward');
    if (canClaim && btn) {
      btn.onclick = () => {
        gameState.money += a.reward;
        gameState.achievementsClaimed.push(a.id);
        sounds.playLevelUp();
        showToast(`🎉 Đã nhận thưởng thành tựu [${a.title}]: +${formatCurrency(a.reward)}!`);
        updateHUD();
        openAchievementsModal();
        triggerActionSave();
      };
    }

    listEl.appendChild(item);
  });

  modal.classList.add('open');
}
window.initAchievementsModal = initAchievementsModal;
window.openAchievementsModal = openAchievementsModal;

// ===========================================================================
// MODAL TỦ ĐỒ TRANG PHỤC NHÂN VẬT (CHARACTER SKINS)
// ===========================================================================
function initSkinsModal() {
  const btnOpen = document.getElementById('btn-skins');
  const btnClose = document.getElementById('btn-close-skins');
  const modal = document.getElementById('skins-modal');

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      openSkinsModal();
    });
  }
  if (btnClose && modal) {
    btnClose.addEventListener('click', () => {
      modal.classList.remove('open');
    });
  }
}

function openSkinsModal() {
  const modal = document.getElementById('skins-modal');
  const listEl = document.getElementById('skins-list');
  if (!modal || !listEl || typeof CHARACTER_SKINS === 'undefined') return;

  listEl.innerHTML = '';
  const currentSkin = gameState.characterSkin || 'default';

  Object.entries(CHARACTER_SKINS).forEach(([skinId, skin]) => {
    const isEquipped = currentSkin === skinId;
    const card = document.createElement('div');
    card.className = `skin-card ${isEquipped ? 'active' : ''}`;

    const hexToRgb = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

    card.innerHTML = `
      <div class="skin-title">${skin.name}</div>
      <div class="skin-desc">${skin.desc}</div>
      <div class="skin-swatches">
        <span class="skin-swatch" style="background:${hexToRgb(skin.shirtColor)}" title="Màu Áo"></span>
        <span class="skin-swatch" style="background:${hexToRgb(skin.pantsColor)}" title="Màu Quần"></span>
        <span class="skin-swatch" style="background:${hexToRgb(skin.vestColor)}" title="Màu Bảo Hộ"></span>
      </div>
      <button class="btn-equip-skin ${isEquipped ? 'equipped' : ''}">
        ${isEquipped ? 'Đang Mặc ✔' : 'Mặc Ngay 👔'}
      </button>
    `;

    const btn = card.querySelector('.btn-equip-skin');
    if (!isEquipped && btn) {
      btn.onclick = () => {
        if (window.player && typeof window.player.applySkin === 'function') {
          window.player.applySkin(skinId);
        } else {
          gameState.characterSkin = skinId;
        }
        sounds.playClick();
        showToast(`👔 Đã thay trang phục: ${skin.name}!`);
        openSkinsModal();
        triggerActionSave();
      };
    }

    listEl.appendChild(card);
  });

  modal.classList.add('open');
}
window.initSkinsModal = initSkinsModal;
window.openSkinsModal = openSkinsModal;

// ===========================================================================
// MODAL SÀN CHỨNG KHOÁN TYCOON & CỔ TỨC (STOCK MARKET & DIVIDENDS)
// ===========================================================================
function initStocksModal() {
  const btnOpen = document.getElementById('btn-stocks');
  const btnClose = document.getElementById('btn-close-stocks');
  const modal = document.getElementById('stocks-modal');

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      openStocksModal();
    });
  }
  if (btnClose && modal) {
    btnClose.addEventListener('click', () => {
      modal.classList.remove('open');
    });
  }
}

function drawSparkline(canvas, history, isUp) {
  if (!canvas || !history || history.length < 2) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const min = Math.min(...history) * 0.98;
  const max = Math.max(...history) * 1.02;
  const range = (max - min) || 1;

  ctx.strokeStyle = isUp ? '#22c55e' : '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();

  history.forEach((val, i) => {
    const x = (i / (history.length - 1)) * (w - 8) + 4;
    const y = h - 6 - ((val - min) / range) * (h - 12);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Gradient fill under sparkline
  const lastX = w - 4;
  const lastY = h - 6 - ((history[history.length - 1] - min) / range) * (h - 12);
  ctx.lineTo(lastX, h);
  ctx.lineTo(4, h);
  ctx.closePath();
  ctx.fillStyle = isUp ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)';
  ctx.fill();
}

function openStocksModal() {
  const modal = document.getElementById('stocks-modal');
  if (!modal) return;
  renderStocksModal();
  modal.classList.add('open');
}

function renderStocksModal() {
  const listEl = document.getElementById('stocks-list');
  if (!listEl || typeof gameState === 'undefined' || !gameState.stocks) return;

  listEl.innerHTML = '';

  Object.entries(gameState.stocks).forEach(([sym, stock]) => {
    const card = document.createElement('div');
    card.className = 'stock-card';

    const isUp = stock.history.length >= 2 ? (stock.price >= stock.history[stock.history.length - 2]) : true;
    const changePct = stock.history.length >= 2 ? (((stock.price - stock.history[stock.history.length - 2]) / stock.history[stock.history.length - 2]) * 100).toFixed(1) : '+0.0';
    const profit = stock.owned > 0 ? (stock.price - stock.avgBuyPrice) * stock.owned : 0;

    card.innerHTML = `
      <div class="stock-card-header">
        <div>
          <div class="stock-symbol">${sym}</div>
          <div class="stock-name">${stock.name}</div>
        </div>
        <div style="text-align: right;">
          <div class="stock-price">${formatCurrency(stock.price)}</div>
          <div class="stock-change ${isUp ? 'up' : 'down'}">${isUp ? '▲ +' : '▼ '}${changePct}%</div>
        </div>
      </div>
      <canvas class="stock-sparkline-canvas" width="280" height="60"></canvas>
      <div class="stock-meta-row">
        <span>Sở hữu: <b>${stock.owned} cp</b></span>
        <span>Giá vốn: <b>${stock.owned > 0 ? formatCurrency(stock.avgBuyPrice) : '$0'}</b></span>
        <span style="color:${profit >= 0 ? '#4ade80' : '#f87171'}">P/L: <b>${profit >= 0 ? '+' : ''}${formatCurrency(profit)}</b></span>
      </div>
      <div class="stock-card-actions">
        <button class="btn-buy-stock" data-sym="${sym}">Mua 1 cp (${formatCurrency(stock.price)})</button>
        <button class="btn-sell-stock" data-sym="${sym}" ${stock.owned <= 0 ? 'disabled' : ''}>Bán 1 cp</button>
      </div>
    `;

    const canvas = card.querySelector('canvas');
    drawSparkline(canvas, stock.history, isUp);

    const btnBuy = card.querySelector('.btn-buy-stock');
    if (btnBuy) {
      btnBuy.onclick = () => {
        if (gameState.money >= stock.price) {
          gameState.money -= stock.price;
          const totalCost = (stock.avgBuyPrice * stock.owned) + stock.price;
          stock.owned += 1;
          stock.avgBuyPrice = Math.round(totalCost / stock.owned);
          if (typeof sounds !== 'undefined' && sounds.playCash) sounds.playCash();
          showToast(`📈 Đã mua 1 cổ phiếu ${sym} giá ${formatCurrency(stock.price)}!`);
          renderStocksModal();
          updateHUD();
          triggerActionSave();
        } else {
          showToast('❌ Không đủ tiền mua cổ phiếu!');
        }
      };
    }

    const btnSell = card.querySelector('.btn-sell-stock');
    if (btnSell && stock.owned > 0) {
      btnSell.onclick = () => {
        gameState.money += stock.price;
        stock.owned -= 1;
        if (stock.owned === 0) stock.avgBuyPrice = 0;
        if (typeof sounds !== 'undefined' && sounds.playCash) sounds.playCash();
        showToast(`📉 Đã bán 1 cổ phiếu ${sym} nhận ${formatCurrency(stock.price)}!`);
        renderStocksModal();
        updateHUD();
        triggerActionSave();
      };
    }

    listEl.appendChild(card);
  });
}

let stockTickAcc = 0;
function updateStockMarket(dt) {
  if (typeof gameState === 'undefined' || !gameState.stocks) return;

  // 1. Cổ tức thụ động mỗi 60s
  if (typeof gameState.stockDividendTimer !== 'number') gameState.stockDividendTimer = 60;
  gameState.stockDividendTimer -= dt;

  const countBadge = document.getElementById('dividend-countdown');
  if (countBadge) {
    countBadge.textContent = `⏱️ Cổ tức: ${Math.max(0, Math.ceil(gameState.stockDividendTimer))}s`;
  }

  if (gameState.stockDividendTimer <= 0) {
    gameState.stockDividendTimer = 60;
    const rates = { '$WOOD': 60, '$PORT': 140, '$GOLD': 400, '$AERO': 750 };
    let totalDiv = 0;
    Object.entries(gameState.stocks).forEach(([sym, s]) => {
      if (s.owned > 0) {
        totalDiv += s.owned * (rates[sym] || 50);
      }
    });

    if (totalDiv > 0) {
      gameState.money += totalDiv;
      if (typeof sounds !== 'undefined' && sounds.playCash) sounds.playCash();
      showToast(`💵 Cổ tức định kỳ: Nhận +${formatCurrency(totalDiv)} từ danh mục đầu tư!`);
      updateHUD();
    }
  }

  // 2. Biến động giá cổ phiếu mỗi 5 giây
  stockTickAcc += dt;
  if (stockTickAcc >= 5.0) {
    stockTickAcc = 0;
    Object.values(gameState.stocks).forEach(stock => {
      const volatility = 0.04;
      const delta = (Math.random() - 0.48) * volatility;
      stock.price = Math.max(10, Math.round(stock.price * (1 + delta)));
      stock.history.push(stock.price);
      if (stock.history.length > 20) stock.history.shift();
    });

    const modal = document.getElementById('stocks-modal');
    if (modal && modal.classList.contains('open')) {
      renderStocksModal();
    }
  }
}
window.initStocksModal = initStocksModal;
window.openStocksModal = openStocksModal;
window.renderStocksModal = renderStocksModal;
window.updateStockMarket = updateStockMarket;

// ===========================================================================
// VIỆN NGHIÊN CỨU CÔNG NGHỆ R&D (TECH TREE MODAL & RESEARCH)
// ===========================================================================
function initTechTreeModal() {
  const btnOpen = document.getElementById('btn-tech-tree');
  const btnClose = document.getElementById('btn-close-tech-tree');
  const modal = document.getElementById('tech-tree-modal');
  const btnOvertime = document.getElementById('btn-overtime-rush');

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      openTechTreeModal();
    });
  }
  if (btnClose && modal) {
    btnClose.addEventListener('click', () => {
      modal.classList.remove('open');
    });
  }
  if (btnOvertime) {
    btnOvertime.addEventListener('click', () => {
      triggerOvertimeRush();
    });
  }
}

function openTechTreeModal() {
  const modal = document.getElementById('tech-tree-modal');
  if (!modal) return;
  modal.classList.add('open');
  renderTechTreeModal();
}

function renderTechTreeModal() {
  const listEl = document.getElementById('tech-tree-list');
  const valRpEl = document.getElementById('modal-rp-val');
  if (valRpEl) valRpEl.textContent = `${gameState.researchPoints || 0} RP`;
  if (!listEl || typeof TECH_TREE_CONFIG === 'undefined') return;

  listEl.innerHTML = '';
  Object.values(TECH_TREE_CONFIG).forEach(tech => {
    const isUnlocked = gameState.researchTechs && gameState.researchTechs[tech.id];
    const canAfford = (gameState.researchPoints || 0) >= tech.costRP && (gameState.money || 0) >= tech.costMoney;

    const card = document.createElement('div');
    card.className = `tech-card ${isUnlocked ? 'unlocked' : ''}`;
    card.innerHTML = `
      <div class="tech-card-header">
        <div class="tech-card-icon">${tech.icon}</div>
        <div>
          <div class="tech-card-title">${tech.name}</div>
        </div>
      </div>
      <div class="tech-card-desc">${tech.desc}</div>
      <div class="tech-card-cost">
        <span class="cost-rp">🔬 ${tech.costRP} RP</span>
        <span class="cost-money">💵 $${tech.costMoney.toLocaleString()}</span>
      </div>
      <button class="tech-btn-research" ${isUnlocked ? 'disabled' : canAfford ? '' : 'disabled'}>
        ${isUnlocked ? '✓ ĐÃ MỞ KHÓA' : canAfford ? '🚀 NGHIÊN CỨU NGAY' : 'CHƯA ĐỦ ĐIỀU KIỆN'}
      </button>
    `;

    const btn = card.querySelector('.tech-btn-research');
    if (btn && !isUnlocked && canAfford) {
      btn.addEventListener('click', () => {
        researchTech(tech.id);
      });
    }

    listEl.appendChild(card);
  });
}

function researchTech(techId) {
  const tech = TECH_TREE_CONFIG[techId];
  if (!tech) return;
  if ((gameState.researchPoints || 0) < tech.costRP || (gameState.money || 0) < tech.costMoney) {
    showToast('⚠️ Không đủ RP hoặc Tiền mặt để nghiên cứu!');
    return;
  }

  gameState.researchPoints -= tech.costRP;
  gameState.money -= tech.costMoney;
  if (!gameState.researchTechs) gameState.researchTechs = {};
  gameState.researchTechs[techId] = true;

  if (typeof sounds !== 'undefined' && sounds.playLevelUp) sounds.playLevelUp();
  showToast(`🎉 NGHIÊN CỨU THÀNH CÔNG: ${tech.name}!`);
  if (typeof spawnFloatingText === 'function') {
    const pPos = window.player ? window.player.mesh.position : new THREE.Vector3(0, 3, 0);
    spawnFloatingText(pPos.clone().add(new THREE.Vector3(0, 3, 0)), `ĐỘT PHÁ CÔNG NGHỆ: ${tech.name}! 🔬`, '#38bdf8');
  }
  renderTechTreeModal();
  updateHUD();
  if (typeof triggerActionSave === 'function') triggerActionSave();
}

function triggerOvertimeRush() {
  if (!gameState.overtimeRush) gameState.overtimeRush = { active: false, timer: 0, cooldown: 0 };
  if (gameState.overtimeRush.cooldown > 0) {
    showToast(`⏳ Tăng ca đang hồi chiêu (${Math.ceil(gameState.overtimeRush.cooldown)}s)!`);
    return;
  }
  gameState.overtimeRush.active = true;
  gameState.overtimeRush.timer = 25.0; // 25s x2 speed
  gameState.overtimeRush.cooldown = 120.0; // 2 min cooldown
  if (typeof sounds !== 'undefined' && sounds.playLevelUp) sounds.playLevelUp();
  if (typeof spawnFloatingText === 'function' && window.player && window.player.mesh) {
    spawnFloatingText(window.player.mesh.position.clone().add(new THREE.Vector3(0, 3, 0)), '⚡ TĂNG CA NHIỆT HUYẾT! x2 TỐC ĐỘ 25s! 🔥', '#f59e0b');
  }
  showToast('⚡ ĐÃ KÍCH HOẠT TĂNG CA! Toàn bộ công nhân & máy móc chạy với 200% tốc độ!');
  updateHUD();
}

function updateDynamicMarketUI() {
  if (!gameState.marketState) return;
  const m = gameState.marketState;
  const banner = document.getElementById('market-news-banner');
  const textEl = document.getElementById('market-news-text');
  const timerEl = document.getElementById('market-news-timer');

  if (m.timeLeft > 0 && m.activeCommodity) {
    if (banner) banner.style.display = 'flex';
    if (textEl) textEl.textContent = m.headline;
    const mins = Math.floor(m.timeLeft / 60);
    const secs = Math.floor(m.timeLeft % 60);
    if (timerEl) timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    if (banner) banner.style.display = 'none';
  }
}

// -----------------------------------------------------------------------------
// THANH DASHBOARD CHỈ SỐ SỐNG CÒN ĐẠI ĐÔ THỊ (CITY VITAL SIGNS HUD)
// -----------------------------------------------------------------------------
function initCityDashboardHUD() {
  if (document.getElementById('city-dashboard-bar')) return;

  const bar = document.createElement('div');
  bar.id = 'city-dashboard-bar';
  bar.style.cssText = 'position:fixed; top:66px; left:50%; transform:translateX(-50%); z-index:900; display:flex; gap:12px; align-items:center; background:rgba(15,23,42,0.92); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); padding:6px 16px; border-radius:24px; border:1px solid rgba(255,255,255,0.18); box-shadow:0 8px 28px rgba(0,0,0,0.5); font-family:sans-serif; font-size:12px; color:#f8fafc; pointer-events:auto; user-select:none; transition:all 0.3s ease;';

  bar.innerHTML = `
    <div style="display:flex; align-items:center; gap:5px; cursor:pointer;" onclick="showToast('🏛️ ĐẠI ĐÔ THỊ: Thành phố chung được toàn server hợp tác xây dựng!')">
      <span>🏆</span> <span id="city-hud-level" style="font-weight:bold; color:#facc15;">CẤP 1</span>
    </div>
    <div style="width:1px; height:14px; background:rgba(255,255,255,0.2);"></div>
    <div style="display:flex; align-items:center; gap:5px;">
      <span>👥</span> <span id="city-hud-pop" style="font-weight:bold; color:#38bdf8;">12,500</span>
    </div>
    <div style="width:1px; height:14px; background:rgba(255,255,255,0.2);"></div>
    <div style="display:flex; align-items:center; gap:5px;">
      <span>🌾</span> <span id="city-hud-food" style="font-weight:bold; color:#4ade80;">6.2k</span>
    </div>
    <div style="width:1px; height:14px; background:rgba(255,255,255,0.2);"></div>
    <div style="display:flex; align-items:center; gap:5px;">
      <span>⚡</span> <span id="city-hud-power" style="font-weight:bold; color:#f59e0b;">1.2k MW</span>
    </div>
    <div style="width:1px; height:14px; background:rgba(255,255,255,0.2);"></div>
    <div style="display:flex; align-items:center; gap:5px;">
      <span>🏛️</span> <span id="city-hud-treasury" style="font-weight:bold; color:#34d399;">$120k</span>
    </div>
    <div style="width:1px; height:14px; background:rgba(255,255,255,0.2);"></div>
    <div style="display:flex; align-items:center; gap:5px;">
      <span>🚨</span> <span id="city-hud-crime" style="font-weight:bold; color:#ef4444;">10%</span>
    </div>
    <div id="city-hud-wanted" style="margin-left:6px; display:flex; gap:2px; font-size:14px; color:#475569;">
      <span class="w-star">★</span><span class="w-star">★</span><span class="w-star">★</span><span class="w-star">★</span><span class="w-star">★</span>
    </div>
  `;
  document.body.appendChild(bar);
}

function updateCityDashboardHUD() {
  initCityDashboardHUD();

  const c = window.cityState || {
    cityLevel: 1,
    population: 12500,
    foodReserves: 6200,
    powerGridMW: 1200,
    treasury: 120000,
    crimeRate: 10
  };

  const elLvl = document.getElementById('city-hud-level');
  if (elLvl) elLvl.textContent = `CẤP ${c.cityLevel || 1}`;

  const elPop = document.getElementById('city-hud-pop');
  if (elPop) elPop.textContent = (c.population || 12500).toLocaleString();

  const elFood = document.getElementById('city-hud-food');
  if (elFood) elFood.textContent = (c.foodReserves || 0) > 1000 ? `${((c.foodReserves || 0) / 1000).toFixed(1)}k` : (c.foodReserves || 0);

  const elPower = document.getElementById('city-hud-power');
  if (elPower) elPower.textContent = `${c.powerGridMW || 1200} MW`;

  const elTreasury = document.getElementById('city-hud-treasury');
  if (elTreasury) elTreasury.textContent = `$${Math.floor((c.treasury || 0) / 1000)}k`;

  const elCrime = document.getElementById('city-hud-crime');
  if (elCrime) elCrime.textContent = `${c.crimeRate || 10}%`;

  const wantedContainer = document.getElementById('city-hud-wanted');
  if (wantedContainer) {
    const stars = (typeof gameState !== 'undefined' && gameState.wantedStars) || 0;
    const starEls = wantedContainer.querySelectorAll('.w-star');
    starEls.forEach((st, idx) => {
      if (idx < stars) {
        st.style.color = '#ef4444';
        st.style.textShadow = '0 0 8px #ef4444';
      } else {
        st.style.color = '#475569';
        st.style.textShadow = 'none';
      }
    });
  }
}
window.initCityDashboardHUD = initCityDashboardHUD;
window.updateCityDashboardHUD = updateCityDashboardHUD;

// -----------------------------------------------------------------------------
// HỆ THỐNG NHIỆM VỤ ĐÔ THỊ, SĂN TIỀN THƯỞNG CẢNH SÁT, CỨU HỘ & KỲ QUAN MODALS
// -----------------------------------------------------------------------------
const CITY_QUESTS = [
  { id: 'cq_food', icon: '🌾', title: 'CỨU ĐÓI KHẨN CẤP ĐÔ THỊ', desc: 'Cung cấp 5 Thùng lương thực để bảo đảm an ninh lương thực cho cư dân', needType: 'rations', needQty: 5, rewardMoney: 18000, rewardRp: 15 },
  { id: 'cq_infra', icon: '🏗️', title: 'NÂNG CẤP TRỤ LƯỚI ĐIỆN', desc: 'Nạp 15 Ván gỗ & 2 Dầm thép để nâng cấp trạm biến áp đô thị', needType: 'composite', needPlanks: 15, needSteel: 2, rewardMoney: 32000, rewardRp: 25 },
  { id: 'cq_tax', icon: '💵', title: 'ỦNG HỘ NGÂN KHỐ PHÚC LỢI', desc: 'Đóng góp $5,000 vào ngân khố để tài trợ giáo dục và hạ nhiệt tội phạm (-5% Crime)', needType: 'money', needQty: 5000, rewardCrime: -5, rewardRp: 20 }
];

const POLICE_BOUNTIES = [
  { id: 'pb_patrol', icon: '🚔', title: 'TUẦN TRA AN NINH ĐẠI LỘ', desc: 'Lái Xe Cảnh Sát Tuần Tra [E], bật còi hú [Space] giữ gìn trật tự', rewardMoney: 12000, rewardGems: 5 },
  { id: 'pb_speed', icon: '📸', title: 'XỬ PHẠT CHẠY QUÁ TỐC ĐỘ', desc: 'Bắt quả tang tài xế chạy quá tốc độ trên đại lộ vành đai', rewardMoney: 18000, rewardGems: 8 },
  { id: 'pb_market', icon: '🕶️', title: 'TRIỆT PHÁ BUÔN LẬU CHỢ ĐEN', desc: 'Tuần tra và thu hồi các chuyến hàng lậu tại chợ đen', rewardMoney: 25000, rewardGems: 12 }
];

const RESCUE_MISSIONS = [
  { id: 'rm_fire', icon: '🔥', title: 'DẬP TẮT HỎA HOẠN KHẨN CẤP', desc: 'Lái Xe Cứu Hỏa [E] khẩn cấp đến hiện trường và phun nước dập lửa [Space]', rewardMoney: 22000, rewardRp: 20 },
  { id: 'rm_med', icon: '🚑', title: 'CẤP CỨU CÔNG NHÂN XƯỞNG CƯA', desc: 'Vận chuyển thuốc men và hỗ trợ y tế khẩn cấp cho đội ngũ công nhân', rewardMoney: 16000, rewardRp: 15 }
];

function initCityModals() {
  const binds = [
    { btn: 'btn-close-city-hall', modal: 'city-hall-modal' },
    { btn: 'btn-close-police-station', modal: 'police-station-modal' },
    { btn: 'btn-close-hospital-fire', modal: 'hospital-fire-modal' },
    { btn: 'btn-close-landmark', modal: 'landmark-modal' },
    { btn: 'btn-close-career', modal: 'career-modal' },
    { btn: 'btn-close-market', modal: 'market-modal' },
    { btn: 'btn-close-villa', modal: 'villa-modal' }
  ];

  const btnReel = document.getElementById('btn-reel-pull');
  if (btnReel) {
    btnReel.addEventListener('click', () => {
      if (typeof pullFishingReel === 'function') pullFishingReel();
    });
  }

  binds.forEach(({ btn, modal }) => {
    const b = document.getElementById(btn);
    const m = document.getElementById(modal);
    if (b && m) {
      b.addEventListener('click', () => {
        m.classList.remove('open');
        m.classList.remove('active');
      });
      m.addEventListener('click', (e) => {
        if (e.target === m) {
          m.classList.remove('open');
          m.classList.remove('active');
        }
      });
    }
  });

  // Gán sự kiện nạp tài nguyên Kỳ quan
  const btnP = document.getElementById('btn-contrib-planks');
  if (btnP) btnP.onclick = () => contributeLandmarkQuick('planks', 10);
  const btnS = document.getElementById('btn-contrib-steel');
  if (btnS) btnS.onclick = () => contributeLandmarkQuick('steel', 5);
  const btnC = document.getElementById('btn-contrib-cement');
  if (btnC) btnC.onclick = () => contributeLandmarkQuick('cement', 5);
  const btnM = document.getElementById('btn-contrib-money');
  if (btnM) btnM.onclick = () => contributeLandmarkQuick('money', 5000);

  const btnPost = document.getElementById('btn-market-post');
  if (btnPost) {
    btnPost.onclick = () => {
      const itemEl = document.getElementById('market-input-item');
      const qtyEl = document.getElementById('market-input-qty');
      const priceEl = document.getElementById('market-input-price');
      if (!itemEl || !qtyEl || !priceEl) return;
      const item = itemEl.value;
      const qty = parseInt(qtyEl.value, 10) || 1;
      const price = parseInt(priceEl.value, 10) || 10;

      let hasEnough = false;
      if (item === 'planks') {
        if ((gameState.planks || 0) >= qty) { gameState.planks -= qty; hasEnough = true; }
      } else if (item === 'steel') {
        if ((gameState.steelBeams || 0) >= qty) { gameState.steelBeams -= qty; hasEnough = true; }
      } else if (item === 'cement') {
        if ((gameState.cementBags || 0) >= qty) { gameState.cementBags -= qty; hasEnough = true; }
      } else if (item === 'rations') {
        if ((gameState.cannedRations || 0) >= qty) { gameState.cannedRations -= qty; hasEnough = true; }
      }

      if (!hasEnough) {
        showToast(`⚠️ Bạn không có đủ ${qty} ${item} trong kho để đăng bán!`);
        return;
      }

      if (window.mpClient) {
        window.mpClient.sendMarketListItem(item, qty, price);
      }
      showToast(`📦 ĐÃ ĐĂNG BÁN THÀNH CÔNG ${qty} ${item} GIÁ $${price}/cái LÊN SÀN CHỢ!`);
      updateHUD();
    };
  }
}

function openCityHallModal() {
  const m = document.getElementById('city-hall-modal');
  if (!m) return;
  m.classList.add('open');
  m.classList.add('active');

  const elMayor = document.getElementById('ch-current-mayor');
  const elTreasury = document.getElementById('ch-treasury');
  const cState = window.cityState || {};
  if (elMayor) elMayor.textContent = cState.currentMayor || 'Ban Quản Trị Lâm Thời';
  if (elTreasury) elTreasury.textContent = `$${(cState.treasury || 120000).toLocaleString()}`;

  const list = document.getElementById('city-quest-list');
  if (!list) return;
  list.innerHTML = '';

  CITY_QUESTS.forEach((q, idx) => {
    let canComplete = false;
    let reqText = '';
    if (q.needType === 'rations') {
      const cur = gameState.cannedRations || 0;
      canComplete = cur >= q.needQty;
      reqText = `Cần: ${q.needQty} Lương thực (Bạn có: ${cur})`;
    } else if (q.needType === 'composite') {
      const curP = gameState.planks || 0;
      const curS = gameState.steelBeams || 0;
      canComplete = curP >= q.needPlanks && curS >= q.needSteel;
      reqText = `Cần: ${q.needPlanks} Ván, ${q.needSteel} Thép (Bạn có: ${curP} Ván, ${curS} Thép)`;
    } else if (q.needType === 'money') {
      const curM = gameState.money || 0;
      canComplete = curM >= q.needQty;
      reqText = `Cần: $${q.needQty.toLocaleString()} (Bạn có: $${Math.floor(curM).toLocaleString()})`;
    }

    const card = document.createElement('div');
    card.style.cssText = 'background:rgba(30,41,59,0.85); border:1px solid rgba(255,255,255,0.12); border-radius:12px; padding:14px; display:flex; justify-content:space-between; align-items:center; gap:12px;';
    card.innerHTML = `
      <div>
        <div style="font-weight:bold; font-size:15px; color:#facc15; margin-bottom:4px;">${q.icon} ${q.title}</div>
        <div style="font-size:12px; color:#cbd5e1; margin-bottom:4px;">${q.desc}</div>
        <div style="font-size:12px; color:#38bdf8; font-weight:600;">${reqText}</div>
      </div>
      <button class="btn-primary-action" style="padding:8px 16px; font-size:13px; white-space:nowrap; ${canComplete ? 'background:#16a34a;' : 'background:#475569; opacity:0.6; cursor:not-allowed;'}" ${canComplete ? '' : 'disabled'} onclick="completeCityQuest(${idx})">
        ${canComplete ? '✅ Hoàn Thành' : 'Chưa Đủ Điều Kiện'}
      </button>
    `;
    list.appendChild(card);
  });
}

function completeCityQuest(idx) {
  const q = CITY_QUESTS[idx];
  if (!q) return;

  if (q.needType === 'rations') {
    if ((gameState.cannedRations || 0) < q.needQty) return;
    gameState.cannedRations -= q.needQty;
  } else if (q.needType === 'composite') {
    if ((gameState.planks || 0) < q.needPlanks || (gameState.steelBeams || 0) < q.needSteel) return;
    gameState.planks -= q.needPlanks;
    gameState.steelBeams -= q.needSteel;
  } else if (q.needType === 'money') {
    if ((gameState.money || 0) < q.needQty) return;
    gameState.money -= q.needQty;
  }

  gameState.money = (gameState.money || 0) + (q.rewardMoney || 0);
  gameState.researchPoints = (gameState.researchPoints || 0) + (q.rewardRp || 0);
  if (q.rewardCrime && window.cityState) {
    window.cityState.crimeRate = Math.max(1, (window.cityState.crimeRate || 10) + q.rewardCrime);
  }

  if (typeof sounds !== 'undefined' && sounds.playCelebrationCheer) sounds.playCelebrationCheer();
  showToast(`🎉 HOÀN THÀNH NHIỆM VỤ: ${q.title}! Thưởng: +$${(q.rewardMoney || 0).toLocaleString()} 💵, +${q.rewardRp || 0} RP 🔬!`);
  updateHUD();
  openCityHallModal();
  if (typeof triggerActionSave === 'function') triggerActionSave();
}

function openPoliceModal() {
  const m = document.getElementById('police-station-modal');
  if (!m) return;
  m.classList.add('open');
  m.classList.add('active');

  const list = document.getElementById('police-quest-list');
  if (!list) return;
  list.innerHTML = '';

  POLICE_BOUNTIES.forEach((b, idx) => {
    const card = document.createElement('div');
    card.style.cssText = 'background:rgba(30,41,59,0.85); border:1px solid rgba(255,255,255,0.12); border-radius:12px; padding:14px; display:flex; justify-content:space-between; align-items:center; gap:12px;';
    card.innerHTML = `
      <div>
        <div style="font-weight:bold; font-size:15px; color:#38bdf8; margin-bottom:4px;">${b.icon} ${b.title}</div>
        <div style="font-size:12px; color:#cbd5e1; margin-bottom:4px;">${b.desc}</div>
        <div style="font-size:12px; color:#4ade80; font-weight:bold;">Thưởng: +$${b.rewardMoney.toLocaleString()} 💵 +${b.rewardGems} 💎</div>
      </div>
      <button class="btn-primary-action" style="padding:8px 16px; font-size:13px; background:#0284c7; white-space:nowrap;" onclick="acceptPoliceBounty(${idx})">
        🚔 Nhận Lệnh Săn
      </button>
    `;
    list.appendChild(card);
  });
}

function acceptPoliceBounty(idx) {
  const b = POLICE_BOUNTIES[idx];
  if (!b) return;
  gameState.isPoliceOfficer = true;
  gameState.activeBounty = b;
  showToast(`👮 ĐÃ NHẬN NHIỆM VỤ AN NINH: ${b.title}! Lên xe Cảnh Sát tuần tra đại lộ và giữ trật tự!`);
  const m = document.getElementById('police-station-modal');
  if (m) {
    m.classList.remove('open');
    m.classList.remove('active');
  }
}

function openHospitalFireModal() {
  const m = document.getElementById('hospital-fire-modal');
  if (!m) return;
  m.classList.add('open');
  m.classList.add('active');

  const list = document.getElementById('rescue-quest-list');
  if (!list) return;
  list.innerHTML = '';

  RESCUE_MISSIONS.forEach((rm, idx) => {
    const card = document.createElement('div');
    card.style.cssText = 'background:rgba(30,41,59,0.85); border:1px solid rgba(255,255,255,0.12); border-radius:12px; padding:14px; display:flex; justify-content:space-between; align-items:center; gap:12px;';
    card.innerHTML = `
      <div>
        <div style="font-weight:bold; font-size:15px; color:#ef4444; margin-bottom:4px;">${rm.icon} ${rm.title}</div>
        <div style="font-size:12px; color:#cbd5e1; margin-bottom:4px;">${rm.desc}</div>
        <div style="font-size:12px; color:#fbbf24; font-weight:bold;">Thưởng: +$${rm.rewardMoney.toLocaleString()} 💵 +${rm.rewardRp} RP 🔬</div>
      </div>
      <button class="btn-primary-action" style="padding:8px 16px; font-size:13px; background:#dc2626; white-space:nowrap;" onclick="acceptRescueMission(${idx})">
        🚨 Ứng Cứu 911
      </button>
    `;
    list.appendChild(card);
  });
}

function acceptRescueMission(idx) {
  const rm = RESCUE_MISSIONS[idx];
  if (!rm) return;
  gameState.activeRescue = rm;
  showToast(`🚨 ĐÃ TIẾP NHẬN BÁO ĐỘNG 911: ${rm.title}! Lên Xe Cứu Hỏa [E] khẩn cấp xuất phát!`);
  const m = document.getElementById('hospital-fire-modal');
  if (m) {
    m.classList.remove('open');
    m.classList.remove('active');
  }
}

function openLandmarkModal() {
  const m = document.getElementById('landmark-modal');
  if (!m) return;
  m.classList.add('open');
  m.classList.add('active');

  const c = (window.cityState && window.cityState.landmarkProject) || {
    stage: 1,
    title: 'Giai Đoạn 1: Móng Trụ Bê Tông & Cốt Thép Ngầm',
    neededPlanks: 60, currentPlanks: 15,
    neededSteel: 40, currentSteel: 8,
    neededCement: 50, currentCement: 12,
    neededMoney: 35000, currentMoney: 12500
  };

  const sub = document.getElementById('landmark-modal-subtitle');
  if (sub) sub.textContent = `${c.title} (Cấp độ giai đoạn: ${c.stage}/3)`;

  const cont = document.getElementById('landmark-progress-container');
  if (cont) {
    const pctP = Math.min(100, Math.floor((c.currentPlanks / c.neededPlanks) * 100));
    const pctS = Math.min(100, Math.floor((c.currentSteel / c.neededSteel) * 100));
    const pctC = Math.min(100, Math.floor((c.currentCement / c.neededCement) * 100));
    const pctM = Math.min(100, Math.floor((c.currentMoney / c.neededMoney) * 100));

    cont.innerHTML = `
      <div style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
          <span>🪵 Ván Gỗ Chịu Lực: <b>${c.currentPlanks}/${c.neededPlanks}</b></span>
          <span style="color:#facc15;">${pctP}%</span>
        </div>
        <div style="background:rgba(255,255,255,0.1); height:8px; border-radius:4px; overflow:hidden;"><div style="width:${pctP}%; height:100%; background:#f59e0b;"></div></div>
      </div>

      <div style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
          <span>🏗️ Dầm Thép Siêu Cường: <b>${c.currentSteel}/${c.neededSteel}</b></span>
          <span style="color:#38bdf8;">${pctS}%</span>
        </div>
        <div style="background:rgba(255,255,255,0.1); height:8px; border-radius:4px; overflow:hidden;"><div style="width:${pctS}%; height:100%; background:#0284c7;"></div></div>
      </div>

      <div style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
          <span>🧱 Bao Xi Măng Nghiền: <b>${c.currentCement}/${c.neededCement}</b></span>
          <span style="color:#fde047;">${pctC}%</span>
        </div>
        <div style="background:rgba(255,255,255,0.1); height:8px; border-radius:4px; overflow:hidden;"><div style="width:${pctC}%; height:100%; background:#ca8a04;"></div></div>
      </div>

      <div>
        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
          <span>💵 Quỹ Thi Công: <b>$${c.currentMoney.toLocaleString()}/$${c.neededMoney.toLocaleString()}</b></span>
          <span style="color:#4ade80;">${pctM}%</span>
        </div>
        <div style="background:rgba(255,255,255,0.1); height:8px; border-radius:4px; overflow:hidden;"><div style="width:${pctM}%; height:100%; background:#16a34a;"></div></div>
      </div>
    `;
  }
}

function contributeLandmarkQuick(type, amount) {
  let p = 0, s = 0, c = 0, m = 0;
  if (type === 'planks') {
    if ((gameState.planks || 0) < amount) {
      showToast(`⚠️ Không đủ Ván Gỗ! Bạn có: ${gameState.planks || 0}/${amount}`);
      return;
    }
    gameState.planks -= amount;
    p = amount;
  } else if (type === 'steel') {
    if ((gameState.steelBeams || 0) < amount) {
      showToast(`⚠️ Không đủ Dầm Thép! Bạn có: ${gameState.steelBeams || 0}/${amount}`);
      return;
    }
    gameState.steelBeams -= amount;
    s = amount;
  } else if (type === 'cement') {
    if ((gameState.cementBags || 0) < amount) {
      showToast(`⚠️ Không đủ Xi Măng! Bạn có: ${gameState.cementBags || 0}/${amount}`);
      return;
    }
    gameState.cementBags -= amount;
    c = amount;
  } else if (type === 'money') {
    if ((gameState.money || 0) < amount) {
      showToast(`⚠️ Không đủ Tiền mặt! Bạn có: $${Math.floor(gameState.money || 0)}/$${amount}`);
      return;
    }
    gameState.money -= amount;
    m = amount;
  }

  if (window.mpClient) {
    window.mpClient.sendCityContribute(p, s, c, m);
  }

  showToast(`🏗️ ĐÃ ĐÓNG GÓP CHO KỲ QUAN: +${p} Ván, +${s} Thép, +${c} Xi Măng, +$${m}!`);
  if (typeof sounds !== 'undefined' && sounds.playCelebrationCheer) sounds.playCelebrationCheer();
  updateHUD();
  openLandmarkModal();
  if (typeof triggerActionSave === 'function') triggerActionSave();
}

function openCareerModal() {
  const m = document.getElementById('career-modal');
  if (m) { m.classList.add('open'); m.classList.add('active'); }
}

function closeCareerModal() {
  const m = document.getElementById('career-modal');
  if (m) { m.classList.remove('open'); m.classList.remove('active'); }
}

function toggleCareerModal() {
  const m = document.getElementById('career-modal');
  if (!m) return;
  if (m.classList.contains('open')) closeCareerModal();
  else openCareerModal();
}

function selectPlayerCareer(careerId) {
  gameState.currentCareer = careerId;
  if (careerId === 'police') gameState.isPoliceOfficer = true;
  else gameState.isPoliceOfficer = false;

  if (window.mpClient) {
    window.mpClient.sendCareerSelect(careerId);
  }

  const careerNames = {
    police: '👮 CẢNH SÁT TUẦN TRA (Phím [F] Bắn Taser bắt tội phạm)',
    firefighter: '🚒 LÍNH CỨU HỎA 911 (Phím [F] / Xe Cứu Hỏa [Space] Phun nước)',
    logistics: '🚛 TÀI PHIỆT LOGISTICS (+40% Thưởng giao hàng nặng)',
    underworld: '🕶️ TRÙM ĐẠO TẶC (Phím [F] Bẻ khóa cướp ngân quỹ & Chợ đen x2)'
  };

  showToast(`🎉 CHÚC MỪNG: BẠN ĐÃ ĐƯỢC CẤP GIẤY PHÉP HÀNH NGHỀ:\n${careerNames[careerId] || careerId}`);
  closeCareerModal();
  updateHUD();
  if (typeof triggerActionSave === 'function') triggerActionSave();
}

function openMarketModal() {
  const m = document.getElementById('market-modal');
  if (!m) return;
  m.classList.add('open');
  m.classList.add('active');
  renderMarketplaceListings();
}

function closeMarketModal() {
  const m = document.getElementById('market-modal');
  if (m) { m.classList.remove('open'); m.classList.remove('active'); }
}

function toggleMarketModal() {
  const m = document.getElementById('market-modal');
  if (!m) return;
  if (m.classList.contains('open')) closeMarketModal();
  else openMarketModal();
}

function renderMarketplaceListings() {
  const container = document.getElementById('market-listings-container');
  if (!container) return;
  container.innerHTML = '';

  const listings = (window.cityState && window.cityState.marketListings) || [];
  if (listings.length === 0) {
    container.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:20px;">Hiện chưa có ai đăng bán vật tư. Hãy là người đầu tiên đăng bán!</div>';
    return;
  }

  const itemNames = {
    planks: '🪵 Ván Gỗ Chịu Lực',
    steel: '🏗️ Dầm Thép Siêu Cường',
    cement: '🧱 Bao Xi Măng Nghiền',
    rations: '🥫 Hộp Lương Thực'
  };

  listings.forEach(listing => {
    const row = document.createElement('div');
    row.style.cssText = 'background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; gap:10px;';
    const totalCost = listing.quantity * listing.priceEach;
    const canAfford = (gameState.money || 0) >= totalCost;

    row.innerHTML = `
      <div>
        <div style="font-weight:bold; color:#f8fafc; font-size:13px;">${itemNames[listing.item] || listing.item} <span style="color:#facc15;">x${listing.quantity}</span></div>
        <div style="font-size:11px; color:#94a3b8;">Người bán: <b style="color:#38bdf8;">${listing.sellerName || 'Vô danh'}</b> | Giá: $${listing.priceEach}/đơn vị</div>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <span style="font-weight:bold; color:#4ade80; font-size:14px;">$${totalCost.toLocaleString()}</span>
        <button class="btn-primary-action" onclick="buyMarketItem('${listing.id}')" style="background:${canAfford ? '#10b981' : '#64748b'}; padding:6px 12px; font-size:12px;" ${canAfford ? '' : 'disabled'}>${canAfford ? 'MUA NGAY' : 'KHÔNG ĐỦ TIỀN'}</button>
      </div>
    `;
    container.appendChild(row);
  });
}

function buyMarketItem(listingId) {
  const listings = (window.cityState && window.cityState.marketListings) || [];
  const itemFound = listings.find(l => l.id === listingId);
  if (!itemFound) {
    showToast('⚠️ Món hàng này vừa được người chơi khác mua mất!');
    renderMarketplaceListings();
    return;
  }
  const totalCost = itemFound.quantity * itemFound.priceEach;
  if ((gameState.money || 0) < totalCost) {
    showToast(`⚠️ Không đủ tiền mặt! Bạn cần $${totalCost.toLocaleString()} nhưng chỉ có $${Math.floor(gameState.money || 0)}`);
    return;
  }

  if (window.mpClient) {
    window.mpClient.sendMarketBuyItem(listingId);
  }
}

function toggleCityDecree(decreeKey, value) {
  if (window.mpClient) {
    window.mpClient.sendCityDecreeUpdate(decreeKey, value);
  }
  showToast(`🏛️ ĐÃ CẬP NHẬT SẮC LỆNH ĐÔ THỊ [${decreeKey}]: ${value ? 'ÁP DỤNG' : 'BÃI BỎ'}`);
}

function showEmergencyBanner(crisis) {
  const b = document.getElementById('emergency-alert-banner');
  if (!b) return;
  const t = document.getElementById('emergency-banner-title');
  const d = document.getElementById('emergency-banner-desc');
  if (t) t.textContent = `🚨 BÁO ĐỘNG ĐỎ 911: ${crisis.title || 'HỎA HOẠN KHẨN CẤP!'}`;
  if (d) d.textContent = `Vị trí: (${crisis.location ? crisis.location.x : 0}, ${crisis.location ? crisis.location.z : 0}) - Thưởng $${(crisis.rewardMoney || 3500).toLocaleString()} + ${crisis.rewardGems || 15} Gems!`;
  b.style.display = 'flex';
}

function dismissEmergencyBanner() {
  const b = document.getElementById('emergency-alert-banner');
  if (b) b.style.display = 'none';
}

function hideEmergencyBanner() {
  dismissEmergencyBanner();
}

// ===========================================================================
// 16. MINI-GAME CÂU CÁ KÉO DÂY TƯƠNG TÁC (ACTIVE FISHING REELING)
// ===========================================================================
let isReelingActive = false;
let reelNeedlePos = 50; // 0% - 100%
let reelNeedleDir = 1;
let reelProgress = 35; // 0% - 100%
let reelSuccessCallback = null;

function startFishingReelingMiniGame(onSuccess) {
  isReelingActive = true;
  reelNeedlePos = 50;
  reelProgress = 40;
  reelSuccessCallback = onSuccess;

  const w = document.getElementById('fishing-reeling-widget');
  if (w) w.style.display = 'block';
  if (typeof sounds !== 'undefined' && sounds.playWaterSplash) sounds.playWaterSplash();
  showToast('🎣 CÁ ĐÃ CẮN CÂU! Hãy nhấp phím [SPACE] để giữ kim trong Vùng Xanh!');
}

function updateFishingReelingMiniGame(dt) {
  if (!isReelingActive) return;

  // Kim dao động qua lại từ 10% đến 90%
  reelNeedlePos += reelNeedleDir * dt * 90.0;
  if (reelNeedlePos >= 88) {
    reelNeedlePos = 88;
    reelNeedleDir = -1;
  } else if (reelNeedlePos <= 12) {
    reelNeedlePos = 12;
    reelNeedleDir = 1;
  }

  // Tụt dần tiến độ nếu không kéo
  reelProgress = Math.max(0, reelProgress - dt * 14.0);

  const needleEl = document.getElementById('reel-needle');
  const fillEl = document.getElementById('reel-progress-fill');
  if (needleEl) needleEl.style.left = `${reelNeedlePos}%`;
  if (fillEl) fillEl.style.width = `${reelProgress}%`;

  if (reelProgress <= 0) {
    // Cá trốn thoát
    isReelingActive = false;
    const w = document.getElementById('fishing-reeling-widget');
    if (w) w.style.display = 'none';
    showToast('💨 TIẾC QUÁ! Con cá đã giật đứt dây câu và bơi mất!');
  }
}

function pullFishingReel() {
  if (!isReelingActive) return;
  // Kiểm tra xem kim có đang nằm trong Vùng Xanh (35% - 65%)
  if (reelNeedlePos >= 32 && reelNeedlePos <= 68) {
    reelProgress = Math.min(100, reelProgress + 16);
    if (typeof sounds !== 'undefined' && sounds.playCollect) sounds.playCollect();

    if (reelProgress >= 100) {
      // Bắt thành công cá hiếm!
      isReelingActive = false;
      const w = document.getElementById('fishing-reeling-widget');
      if (w) w.style.display = 'none';

      const rareFishPool = [
        { name: 'Cá Hồi Vàng Hoàng Gia 🐟', value: 950, gems: 2 },
        { name: 'Cá Kiếm Đại Dương Siêu Cường 🦈', value: 1800, gems: 4 },
        { name: 'Cá Thần Tài Huyền Thoại 👑', value: 3600, gems: 8 }
      ];
      const fish = rareFishPool[Math.floor(Math.random() * rareFishPool.length)];

      if (typeof gameState !== 'undefined') {
        gameState.money = (gameState.money || 0) + fish.value;
        gameState.gems = (gameState.gems || 0) + fish.gems;
        gameState.fish = (gameState.fish || 0) + 1;
      }
      if (typeof sounds !== 'undefined' && sounds.playReelCatch) sounds.playReelCatch();
      showToast(`🎉 BẮT ĐƯỢC ${fish.name}! Nhận +$${fish.value.toLocaleString()} 💵 & +${fish.gems} 💎!`);
      if (typeof spawnFloatingText === 'function' && window.player && window.player.mesh) {
        spawnFloatingText(window.player.mesh.position, `+$${fish.value.toLocaleString()} & +${fish.gems} 💎!`, '#facc15');
      }
      if (typeof updateHUD === 'function') updateHUD();
      if (typeof triggerActionSave === 'function') triggerActionSave();
      if (reelSuccessCallback) reelSuccessCallback(fish);
    }
  } else {
    // Kéo trượt ngoài vùng xanh -> bị giật lùi
    reelProgress = Math.max(0, reelProgress - 8);
  }
}

// ===========================================================================
// 17. ĐƯỜNG ĐUA CAO TỐC ĐÔ THỊ TÍNH GIỜ (HIGHWAY SPEED CIRCUIT TIME TRIAL)
// ===========================================================================
let isRacingActive = false;
let raceElapsedTime = 0;
let raceBestTime = Infinity;
let raceCheckpointStage = 0;

function startHighwayRaceLap() {
  if (isRacingActive) return;
  isRacingActive = true;
  raceElapsedTime = 0;
  raceCheckpointStage = 1;

  const w = document.getElementById('race-lap-widget');
  if (w) w.style.display = 'block';
  const cpBadge = document.getElementById('race-checkpoint-badge');
  if (cpBadge) cpBadge.textContent = 'CHECKPOINT 1/3';
  showToast('🏁 XUẤT PHÁT! Đua 1 vòng cao tốc quanh đảo để nhận thưởng $5,000 USD!');
}

function updateHighwayRaceLap(dt, playerPos) {
  if (!isRacingActive) return;
  raceElapsedTime += dt;

  const timerEl = document.getElementById('race-timer-display');
  if (timerEl) {
    const mins = Math.floor(raceElapsedTime / 60);
    const secs = (raceElapsedTime % 60).toFixed(1);
    timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.padStart(4, '0')}`;
  }

  if (!playerPos) return;

  // Checkpoint 1: Đại Lộ Phía Nam (X = 28, Z = 120)
  if (raceCheckpointStage === 1 && playerPos.distanceTo(new THREE.Vector3(28, 0, 120)) <= 14.0) {
    raceCheckpointStage = 2;
    const cpBadge = document.getElementById('race-checkpoint-badge');
    if (cpBadge) cpBadge.textContent = 'CHECKPOINT 2/3';
    showToast('⚡ CHECKPOINT 1/3 ĐẠT! Rẽ sang đại lộ phía Tây!');
    if (typeof sounds !== 'undefined' && sounds.playCollect) sounds.playCollect();
  }
  // Checkpoint 2: Cao Tốc Viễn Tây (X = -110, Z = 60)
  else if (raceCheckpointStage === 2 && playerPos.distanceTo(new THREE.Vector3(-110, 0, 60)) <= 16.0) {
    raceCheckpointStage = 3;
    const cpBadge = document.getElementById('race-checkpoint-badge');
    if (cpBadge) cpBadge.textContent = 'CHECKPOINT 3/3';
    showToast('⚡ CHECKPOINT 2/3 ĐẠT! Vòng về vạch đích phía Bắc!');
    if (typeof sounds !== 'undefined' && sounds.playCollect) sounds.playCollect();
  }
  // Checkpoint 3 / Vạch Đích: Cổng xuất phát (X = 28, Z = 32)
  else if (raceCheckpointStage === 3 && playerPos.distanceTo(new THREE.Vector3(28, 0, 32)) <= 12.0) {
    finishHighwayRaceLap();
  }
}

function finishHighwayRaceLap() {
  isRacingActive = false;
  const finishTime = raceElapsedTime;
  if (finishTime < raceBestTime) {
    raceBestTime = finishTime;
    const bestEl = document.getElementById('race-best-time');
    if (bestEl) bestEl.textContent = `${(raceBestTime).toFixed(1)}s`;
  }

  if (typeof gameState !== 'undefined') {
    gameState.money = (gameState.money || 0) + 5000;
    gameState.raceWins = (gameState.raceWins || 0) + 1;
  }

  showToast(`🏆 HOÀN THÀNH VÒNG ĐUA: ${(finishTime).toFixed(1)} giây! Nhận thưởng +$5,000 USD!`);
  if (typeof sounds !== 'undefined' && sounds.playCelebrationCheer) sounds.playCelebrationCheer();
  if (typeof updateHUD === 'function') updateHUD();

  setTimeout(() => {
    const w = document.getElementById('race-lap-widget');
    if (w && !isRacingActive) w.style.display = 'none';
  }, 6000);
}

// ===========================================================================
// 18. QUẢN LÝ DINH THỰ VEN BIỂN (COASTAL LUXURY VILLA MODAL)
// ===========================================================================
function openVillaModal() {
  const m = document.getElementById('villa-modal');
  if (!m) return;
  m.classList.add('active');

  const isOwned = !!(gameState.villaOwned);
  const statusEl = document.getElementById('villa-ownership-status');
  const descEl = document.getElementById('villa-desc-status');
  const rentEl = document.getElementById('villa-accumulated-rent');
  const btnBuy = document.getElementById('btn-buy-villa');
  const btnCollect = document.getElementById('btn-collect-villa-rent');

  if (statusEl) statusEl.textContent = isOwned ? 'ĐÃ SỞ HỮU (CẤP 1)' : 'CHƯA SỞ HỮU';
  if (statusEl) statusEl.style.color = isOwned ? '#4ade80' : '#38bdf8';
  if (descEl) descEl.textContent = isOwned ? 'Dinh thự đang vận hành cho thuê du lịch cao cấp và sinh lời tự động!' : 'Mua Dinh thự ven biển để nhận dòng tiền thụ động $350/phút!';
  if (rentEl) rentEl.textContent = `$${(gameState.villaAccumulatedRent || 0).toLocaleString()}`;

  if (btnBuy) btnBuy.style.display = isOwned ? 'none' : 'inline-block';
  if (btnCollect) btnCollect.style.display = isOwned ? 'inline-block' : 'none';
}

function closeVillaModal() {
  const m = document.getElementById('villa-modal');
  if (m) m.classList.remove('active');
}

function toggleVillaModal() {
  const m = document.getElementById('villa-modal');
  if (m && m.classList.contains('active')) closeVillaModal();
  else openVillaModal();
}

function purchasePlayerVilla() {
  if (gameState.villaOwned) {
    showToast('ℹ️ Bạn đã sở hữu Dinh thự ven biển này rồi!');
    return;
  }
  const cost = 25000;
  if ((gameState.money || 0) < cost) {
    showToast(`⚠️ Bạn không đủ tiền mặt! Cần $${cost.toLocaleString()} USD để mua Dinh thự.`);
    return;
  }
  gameState.money -= cost;
  gameState.villaOwned = true;
  gameState.villaAccumulatedRent = 0;
  showToast('🎉 CHÚC MỪNG TÀI PHIỆT! Bạn đã chính thức sở hữu Dinh Thự Nghỉ Dưỡng Ven Biển!');
  if (typeof sounds !== 'undefined' && sounds.playCelebrationCheer) sounds.playCelebrationCheer();
  openVillaModal();
  if (typeof updateHUD === 'function') updateHUD();
  if (typeof triggerActionSave === 'function') triggerActionSave();
}

function collectPlayerVillaRent() {
  const rent = gameState.villaAccumulatedRent || 0;
  if (rent <= 0) {
    showToast('ℹ️ Chưa có tiền thuê mới tích lũy. Vui lòng quay lại sau ít phút!');
    return;
  }
  gameState.money += rent;
  gameState.villaAccumulatedRent = 0;
  showToast(`💰 ĐÃ THU TIỀN THUÊ: +$${rent.toLocaleString()} USD từ Dinh thự!`);
  if (typeof sounds !== 'undefined' && sounds.playCashRegister) sounds.playCashRegister();
  openVillaModal();
  if (typeof updateHUD === 'function') updateHUD();
  if (typeof triggerActionSave === 'function') triggerActionSave();
}

// Cập nhật tích lũy tiền thuê thụ động
function updateVillaPassiveIncome(dt) {
  if (!gameState.villaOwned) return;
  window.villaRentTimer = (window.villaRentTimer || 0) + dt;
  if (window.villaRentTimer >= 10.0) { // Mỗi 10 giây cộng $60 (~$360/phút)
    window.villaRentTimer = 0;
    gameState.villaAccumulatedRent = (gameState.villaAccumulatedRent || 0) + 60;
  }
}

// ===========================================================================
// 19. HỆ THỐNG DANH HIỆU ANH HÙNG ĐÔ THỊ (HERO TITLES CALCULATION)
// ===========================================================================
function getPlayerHeroTitle() {
  if (typeof gameState === 'undefined') return '👑 TÂN THỦ ĐÔ THỊ';
  if ((gameState.firesExtinguished || 0) >= 3) return '🔥 DŨNG SĨ CỨU HỎA';
  if ((gameState.crimesArrested || 0) >= 3) return '⭐ HIỆP SĨ ĐÔ THỊ';
  if ((gameState.exportOrders || 0) >= 25) return '👑 ĐẠI TỶ PHÚ LÂM NGHIỆP';
  if ((gameState.airCargoOrders || 0) >= 5) return '✈️ VUA HÀNG KHÔNG';
  if (gameState.currentCareer === 'police') return '👮 SĨ QUAN CẢNH SÁT';
  if (gameState.currentCareer === 'firefighter') return '🚒 LÍNH CỨU HỎA';
  if (gameState.currentCareer === 'logistics') return '🚛 TRÙM LOGISTICS';
  if (gameState.currentCareer === 'underworld') return '🕶️ ĐẠO TẶC BÓNG ĐÊM';
  return '🌲 THỢ KHAI THÁC LÂM NGHIỆP';
}

window.startFishingReelingMiniGame = startFishingReelingMiniGame;
window.updateFishingReelingMiniGame = updateFishingReelingMiniGame;
window.pullFishingReel = pullFishingReel;

window.startHighwayRaceLap = startHighwayRaceLap;
window.updateHighwayRaceLap = updateHighwayRaceLap;
window.finishHighwayRaceLap = finishHighwayRaceLap;

window.openVillaModal = openVillaModal;
window.closeVillaModal = closeVillaModal;
window.toggleVillaModal = toggleVillaModal;
window.purchasePlayerVilla = purchasePlayerVilla;
window.collectPlayerVillaRent = collectPlayerVillaRent;
window.updateVillaPassiveIncome = updateVillaPassiveIncome;
window.getPlayerHeroTitle = getPlayerHeroTitle;

window.openCareerModal = openCareerModal;
window.closeCareerModal = closeCareerModal;
window.toggleCareerModal = toggleCareerModal;
window.selectPlayerCareer = selectPlayerCareer;
window.openMarketModal = openMarketModal;
window.closeMarketModal = closeMarketModal;
window.toggleMarketModal = toggleMarketModal;
window.renderMarketplaceListings = renderMarketplaceListings;
window.buyMarketItem = buyMarketItem;
window.toggleCityDecree = toggleCityDecree;
window.showEmergencyBanner = showEmergencyBanner;
window.dismissEmergencyBanner = dismissEmergencyBanner;
window.hideEmergencyBanner = hideEmergencyBanner;

window.openCityHallModal = openCityHallModal;
window.completeCityQuest = completeCityQuest;
window.openPoliceModal = openPoliceModal;
window.acceptPoliceBounty = acceptPoliceBounty;
window.openHospitalFireModal = openHospitalFireModal;
window.acceptRescueMission = acceptRescueMission;
window.openLandmarkModal = openLandmarkModal;
window.contributeLandmarkQuick = contributeLandmarkQuick;

window.initCityModals = initCityModals;
window.initTechTreeModal = initTechTreeModal;
window.openTechTreeModal = openTechTreeModal;
window.renderTechTreeModal = renderTechTreeModal;
window.researchTech = researchTech;
window.triggerOvertimeRush = triggerOvertimeRush;
window.updateDynamicMarketUI = updateDynamicMarketUI;

// ===========================================================================
// 20. CHUỖI CUNG ỨNG ĐA TẦNG & XƯỞNG CHẾ TÁC (MULTI-TIER CRAFTING)
// ===========================================================================
const CRAFTING_RECIPES = {
  furniture: {
    name: '🪑 Bàn Ghế Gỗ & Thép Cao Cấp (Luxury Furniture)',
    desc: 'Nội thất xuất khẩu sang trọng, kết hợp Ván xẻ gỗ và Dầm thép chịu lực.',
    req: { planks: 4, steel: 1 },
    reward: { money: 2200, rp: 20 },
    icon: '🪑'
  },
  jet_engine: {
    name: '✈️ Động Cơ Phản Lực Siêu Âm (Jet Engine)',
    desc: 'Linh kiện công nghệ hàng không tối tân, đúc từ Thép siêu cường và Dầu thô.',
    req: { steel: 2, crudeOil: 2 },
    reward: { money: 5000, rp: 45 },
    icon: '✈️'
  },
  solar_cell: {
    name: '☀️ Tấm Pin Năng Lượng Mặt Trời (Solar Cell)',
    desc: 'Thiết bị năng lượng sạch tương lai, chế tạo từ Thép, Dầu mỏ và Tinh thể Đá Quý.',
    req: { steel: 1, crudeOil: 1, gems: 1 },
    reward: { money: 8500, rp: 75 },
    icon: '☀️'
  },
  mega_cargo: {
    name: '🚢 Kiện Hàng Container Siêu Cảng (Mega Cargo)',
    desc: 'Hàng hóa xuất khẩu cao cấp tích hợp Pallet gỗ, Thép dầm và Hộp cá đại dương.',
    req: { pallets: 2, steel: 2, canned: 2 },
    reward: { money: 14000, rp: 150 },
    icon: '🚢'
  }
};

function openCraftingModal() {
  const m = document.getElementById('crafting-modal');
  if (!m) return;
  renderCraftingModal();
  m.classList.add('open');
}

function renderCraftingModal() {
  const grid = document.getElementById('crafting-recipes-grid');
  if (!grid || typeof gameState === 'undefined') return;
  grid.innerHTML = '';

  Object.entries(CRAFTING_RECIPES).forEach(([rId, r]) => {
    let canCraft = true;
    const reqText = Object.entries(r.req).map(([mat, count]) => {
      const owned = (gameState[mat] || 0);
      if (owned < count) canCraft = false;
      return `<span style="color:${owned >= count ? '#4ade80' : '#f87171'}">${mat}: ${owned}/${count}</span>`;
    }).join(' &bull; ');

    const card = document.createElement('div');
    card.style.cssText = 'background:rgba(30,41,59,0.7); border:2px solid ' + (canCraft ? '#06b6d4' : '#475569') + '; border-radius:14px; padding:15px; display:flex; flex-direction:column; justify-content:space-between; text-align:center;';
    card.innerHTML = `
      <div>
        <div style="font-size:38px; margin-bottom:6px;">${r.icon}</div>
        <h3 style="color:#38bdf8; margin:0 0 6px 0; font-size:14px;">${r.name}</h3>
        <p style="font-size:11px; color:#cbd5e1; margin:0 0 10px 0;">${r.desc}</p>
        <div style="background:rgba(15,23,42,0.8); padding:8px; border-radius:8px; font-size:11px; margin-bottom:12px;">
          ${reqText}
        </div>
      </div>
      <div>
        <div style="font-size:12px; color:#facc15; font-weight:bold; margin-bottom:8px;">
          Xuất khẩu: +$${r.reward.money.toLocaleString()} & +${r.reward.rp} RP
        </div>
        <button class="btn-primary-action" onclick="craftRecipe('${rId}')" style="background:${canCraft ? '#0891b2' : '#475569'}; width:100%;" ${canCraft ? '' : 'disabled'}>
          ${canCraft ? 'LẮP RÁP & XUẤT KHẨU' : 'THIẾU NGUYÊN LIỆU'}
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function craftRecipe(rId) {
  const r = CRAFTING_RECIPES[rId];
  if (!r || typeof gameState === 'undefined') return;

  for (const [mat, count] of Object.entries(r.req)) {
    if ((gameState[mat] || 0) < count) {
      showToast(`⚠️ Không đủ nguyên liệu: Cần ${count} ${mat}!`);
      return;
    }
  }

  // Khấu trừ nguyên liệu
  for (const [mat, count] of Object.entries(r.req)) {
    gameState[mat] -= count;
  }

  // Cộng thưởng xuất khẩu
  gameState.money = (gameState.money || 0) + r.reward.money;
  gameState.rp = (gameState.rp || 0) + r.reward.rp;

  showToast(`🏭 CHẾ TÁC THÀNH CÔNG: Đã lắp ráp và xuất khẩu [${r.name}]! Nhận +$${r.reward.money.toLocaleString()} & +${r.reward.rp} RP!`);
  if (typeof sounds !== 'undefined' && sounds.playCash) sounds.playCash();
  renderCraftingModal();
  if (typeof updateHUD === 'function') updateHUD();
  if (typeof triggerActionSave === 'function') triggerActionSave();
}

// ===========================================================================
// 21. CÂY KỸ NĂNG & THIÊN PHÚ RPG (TALENT TREE & SPECIALIZATIONS)
// ===========================================================================
const TALENT_NODES = {
  treeSurge: {
    branch: '🌲 VUA LÂM NGHIỆP',
    name: 'Khai Thác Bùng Nổ',
    desc: 'Tăng 35% sản lượng gỗ rơi rớt mỗi nhát đốn rìu.',
    icon: '🌲'
  },
  ancientTimber: {
    branch: '🌲 VUA LÂM NGHIỆP',
    name: 'Gỗ Cổ Thụ Nghìn Năm',
    desc: '15% cơ hội hạ cây rơi Khối Gỗ Cổ Thụ quý hiếm trị giá $600.',
    icon: '🌳'
  },
  dividendBoost: {
    branch: '📈 TÀI PHIỆT PHỐ WALL',
    name: 'Cổ Tức Siêu Cấp',
    desc: 'Tăng 40% cổ tức thụ động chi trả từ toàn bộ danh mục cổ phiếu.',
    icon: '📈'
  },
  taxExemption: {
    branch: '📈 TÀI PHIỆT PHỐ WALL',
    name: 'Miễn Trừ Thuế Doanh Nghiệp',
    desc: 'Giảm 50% phí giao dịch chợ P2P và giảm 15% mọi chi phí nâng cấp.',
    icon: '💳'
  },
  turboDrive: {
    branch: '🚚 CHÚA TỂ LOGISTICS',
    name: 'Động Cơ Siêu Tốc',
    desc: 'Tăng 30% tốc độ tối đa cho mọi phương tiện: Xe Tải, Pickup và Jetski.',
    icon: '🏎️'
  },
  megaCargo: {
    branch: '🚚 CHÚA TỂ LOGISTICS',
    name: 'Khoang Chứa Khổng Lồ',
    desc: 'Tăng thêm +6 ô chứa Balo và +12 ô hàng trên thùng Xe Tải.',
    icon: '📦'
  },
  heistMaster: {
    branch: '🕶️ ĐẶC NHIỆM & TỘI PHẠM',
    name: 'Siêu Đạo Chích Đẳng Cấp',
    desc: 'Tăng thêm 50% tiền cướp hầm vàng và rút ngắn 5 giây thời gian khoan két.',
    icon: '💣'
  },
  policeBadge: {
    branch: '🕶️ ĐẶC NHIỆM & TỘI PHẠM',
    name: 'Cảnh Sát Trưởng Trấn Thủ',
    desc: 'Bắt tội phạm nhận thưởng gấp đôi, dập tắt tỷ lệ tội phạm thành phố về 0%.',
    icon: '⭐'
  }
};

function openTalentModal() {
  const m = document.getElementById('talent-modal');
  if (!m) return;
  renderTalentModal();
  m.classList.add('open');
}

function renderTalentModal() {
  const grid = document.getElementById('talents-grid');
  const ptsEl = document.getElementById('val-talent-points');
  if (!grid || typeof gameState === 'undefined') return;

  const points = (gameState.talentPoints || 0);
  if (ptsEl) ptsEl.textContent = `${points} TP`;
  grid.innerHTML = '';

  gameState.talents = gameState.talents || {};

  Object.entries(TALENT_NODES).forEach(([tKey, t]) => {
    const isUnlocked = !!(gameState.talents[tKey]);
    const canUnlock = !isUnlocked && points > 0;

    const card = document.createElement('div');
    card.style.cssText = 'background:rgba(30,41,59,0.7); border:2px solid ' + (isUnlocked ? '#a855f7' : (canUnlock ? '#38bdf8' : '#475569')) + '; border-radius:14px; padding:14px; text-align:center; display:flex; flex-direction:column; justify-content:space-between;';
    card.innerHTML = `
      <div>
        <div style="font-size:10px; color:#c084fc; font-weight:bold; margin-bottom:4px;">${t.branch}</div>
        <div style="font-size:32px; margin-bottom:6px;">${t.icon}</div>
        <h4 style="color:${isUnlocked ? '#4ade80' : '#f8fafc'}; margin:0 0 6px 0; font-size:14px;">${t.name}</h4>
        <p style="font-size:11px; color:#94a3b8; margin:0 0 10px 0;">${t.desc}</p>
      </div>
      <div>
        <button class="btn-primary-action" onclick="allocateTalentPoint('${tKey}')" style="background:${isUnlocked ? '#10b981' : (canUnlock ? '#9333ea' : '#475569')}; width:100%;" ${canUnlock ? '' : 'disabled'}>
          ${isUnlocked ? '✅ ĐÃ MỞ KHÓA' : (canUnlock ? 'HỌC KỸ NĂNG (1 TP)' : 'CẦN ĐIỂM TP')}
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function allocateTalentPoint(tKey) {
  if (typeof gameState === 'undefined') return;
  gameState.talents = gameState.talents || {};
  if (gameState.talents[tKey]) {
    showToast('ℹ️ Bạn đã mở khóa kỹ năng này rồi!');
    return;
  }
  if ((gameState.talentPoints || 0) <= 0) {
    showToast('⚠️ Không đủ Điểm Thiên Phú (TP)! Hãy thăng cấp để nhận thêm điểm!');
    return;
  }
  gameState.talentPoints--;
  gameState.talents[tKey] = true;

  if (tKey === 'megaCargo') {
    gameState.backpackMax = (gameState.backpackMax || 4) + 6;
    if (window.player) window.player.maxLogs = gameState.backpackMax;
  }

  showToast(`🧬 ĐÃ MỞ KHÓA THIÊN PHÚ: [${TALENT_NODES[tKey].name}]!`);
  if (typeof sounds !== 'undefined' && sounds.playCelebrationCheer) sounds.playCelebrationCheer();
  renderTalentModal();
  if (typeof updateHUD === 'function') updateHUD();
  if (typeof triggerActionSave === 'function') triggerActionSave();
}

// ===========================================================================
// 22. TÒA THỊ CHÍNH & SẮC LỆNH ĐÔ THỊ (CITY HALL & DECREES)
// ===========================================================================
const CITY_DECREES = {
  greenEco: {
    name: '🌿 Sắc Lệnh Thành Phố Sinh Thái Xanh',
    desc: 'Đầu tư phát triển rừng và năng lượng sạch: Tăng +25% Môi trường xanh, trợ cấp sinh thái +$400/lần.',
    cost: 3500,
    icon: '🌿'
  },
  stimulus: {
    name: '💰 Gói Kích Cầu Kinh Tế Đô Thị',
    desc: 'Tung gói tiền trợ giá hàng hóa: Tăng +30% Hạnh phúc cư dân và tăng +20% giá bán mọi nông lâm sản.',
    cost: 5000,
    icon: '💰'
  },
  peacekeeper: {
    name: '🚔 Chiến Dịch Đô Thị Thép Không Tội Phạm',
    desc: 'Lực lượng đặc nhiệm tuần tra toàn diện: Dập tắt Tội phạm về 0%, cư dân an tâm nộp gấp 2 lần thuế!',
    cost: 2500,
    icon: '🚔'
  }
};

function openCityHallModal() {
  const m = document.getElementById('city-hall-modal');
  if (!m) return;
  renderCityHallModal();
  m.classList.add('open');
}

function renderCityHallModal() {
  const grid = document.getElementById('city-decrees-grid');
  if (!grid || typeof gameState === 'undefined') return;
  grid.innerHTML = '';

  Object.entries(CITY_DECREES).forEach(([dKey, d]) => {
    const canAfford = (gameState.money || 0) >= d.cost;
    const card = document.createElement('div');
    card.style.cssText = 'background:rgba(30,41,59,0.7); border:2px solid #22c55e; border-radius:14px; padding:15px; text-align:center; display:flex; flex-direction:column; justify-content:space-between;';
    card.innerHTML = `
      <div>
        <div style="font-size:36px; margin-bottom:6px;">${d.icon}</div>
        <h4 style="color:#4ade80; margin:0 0 6px 0; font-size:14px;">${d.name}</h4>
        <p style="font-size:11px; color:#cbd5e1; margin:0 0 12px 0;">${d.desc}</p>
      </div>
      <div>
        <div style="font-size:12px; color:#facc15; font-weight:bold; margin-bottom:8px;">Ngân sách: $${d.cost.toLocaleString()}</div>
        <button class="btn-primary-action" onclick="enactCityDecree('${dKey}')" style="background:${canAfford ? '#16a34a' : '#64748b'}; width:100%;" ${canAfford ? '' : 'disabled'}>
          ${canAfford ? 'BAN HÀNH SẮC LỆNH' : 'THIẾU NGÂN SÁCH'}
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function enactCityDecree(dKey) {
  const d = CITY_DECREES[dKey];
  if (!d || typeof gameState === 'undefined') return;
  if ((gameState.money || 0) < d.cost) {
    showToast(`⚠️ Không đủ ngân sách ban hành sắc lệnh: Cần $${d.cost.toLocaleString()}!`);
    return;
  }
  gameState.money -= d.cost;
  gameState.cityMetrics = gameState.cityMetrics || { ecoHealth: 85, citizenHappiness: 90, crimeRate: 10 };

  if (dKey === 'greenEco') {
    gameState.cityMetrics.ecoHealth = Math.min(100, gameState.cityMetrics.ecoHealth + 25);
  } else if (dKey === 'stimulus') {
    gameState.cityMetrics.citizenHappiness = Math.min(100, gameState.cityMetrics.citizenHappiness + 30);
  } else if (dKey === 'peacekeeper') {
    gameState.cityMetrics.crimeRate = 0;
    gameState.wantedStars = 0;
  }

  showToast(`🏛️ TÒA THỊ CHÍNH: Đã chính thức ban hành [${d.name}]!`);
  if (typeof sounds !== 'undefined' && sounds.playCelebrationCheer) sounds.playCelebrationCheer();
  renderCityHallModal();
  updateCityMetricsHUD();
  if (typeof updateHUD === 'function') updateHUD();
  if (typeof triggerActionSave === 'function') triggerActionSave();
}

function updateCityMetricsHUD() {
  if (typeof gameState === 'undefined') return;
  gameState.cityMetrics = gameState.cityMetrics || { ecoHealth: 85, citizenHappiness: 90, crimeRate: 10 };

  const ecoEl = document.getElementById('val-eco-health');
  const hapEl = document.getElementById('val-citizen-happiness');
  const criEl = document.getElementById('val-crime-rate');
  const mayorEl = document.getElementById('val-mayor-rating');

  if (ecoEl) ecoEl.textContent = `${gameState.cityMetrics.ecoHealth}%`;
  if (hapEl) hapEl.textContent = `${gameState.cityMetrics.citizenHappiness}%`;
  if (criEl) criEl.textContent = `${gameState.cityMetrics.crimeRate}%`;

  // Xếp hạng Thị Trưởng
  const totalScore = gameState.cityMetrics.ecoHealth + gameState.cityMetrics.citizenHappiness - gameState.cityMetrics.crimeRate;
  let rank = '🏛️ THỊ TRƯỞNG HẠNG B';
  if (totalScore >= 165) rank = '🏛️ THỊ TRƯỞNG HẠNG S (HUYỀN THOẠI)';
  else if (totalScore >= 135) rank = '🏛️ THỊ TRƯỞNG HẠNG A (XUẤT SẮC)';
  else if (totalScore < 100) rank = '🏛️ THỊ TRƯỞNG HẠNG C (CẦN CẢI THIỆN)';
  if (mayorEl) mayorEl.textContent = rank;
}

// ===========================================================================
// 23. TẬP ĐOÀN ĐA QUỐC GIA & NGHIỆP ĐOÀN TOÀN SERVER (SYNDICATES)
// ===========================================================================
const INFRASTRUCTURE_MONOPOLIES = {
  railway: {
    name: '🚂 Độc Quyền Tuyến Đường Sắt Xuyên Đảo',
    desc: 'Thu cổ tức $500/phút từ các đoàn tàu hàng vận chuyển quặng và gỗ.',
    cost: 20000,
    dividendRate: 500
  },
  harbor: {
    name: '⚓ Độc Quyền Cảng Biển Vận Tải Quốc Tế',
    desc: 'Thu cổ tức $900/phút từ tàu container và du thuyền cập mạn Marina.',
    cost: 35000,
    dividendRate: 900
  },
  skyport: {
    name: '✈️ Độc Quyền Bầu Trời Vận Tải Hàng Không',
    desc: 'Thu cổ tức $1,500/phút từ mọi chuyến bay vận tải Boeing Cargo.',
    cost: 50000,
    dividendRate: 1500
  }
};

function openSyndicateModal() {
  const m = document.getElementById('syndicate-modal');
  if (!m) return;
  renderSyndicateModal();
  m.classList.add('open');
}

function renderSyndicateModal() {
  const cont = document.getElementById('syndicate-content');
  if (!cont || typeof gameState === 'undefined') return;

  gameState.corporation = gameState.corporation || { level: 1, name: 'EMPIRE APEX HOLDINGS', monopolies: {} };

  let monoCardsHtml = '';
  Object.entries(INFRASTRUCTURE_MONOPOLIES).forEach(([mKey, mono]) => {
    const isOwned = !!(gameState.corporation.monopolies[mKey]);
    const canAfford = (gameState.money || 0) >= mono.cost;
    monoCardsHtml += `
      <div style="background:rgba(15,23,42,0.8); border:1px solid ${isOwned ? '#4ade80' : '#475569'}; border-radius:12px; padding:12px; text-align:center;">
        <h4 style="color:${isOwned ? '#4ade80' : '#38bdf8'}; margin:0 0 4px 0; font-size:13px;">${mono.name}</h4>
        <p style="font-size:11px; color:#cbd5e1; margin:0 0 8px 0;">${mono.desc}</p>
        <div style="font-size:12px; color:#facc15; font-weight:bold; margin-bottom:8px;">
          ${isOwned ? '✅ Cổ tức: +$' + mono.dividendRate + '/phút' : 'Giá nhượng quyền: $' + mono.cost.toLocaleString()}
        </div>
        <button class="btn-primary-action" onclick="buyInfrastructureMonopoly('${mKey}')" style="background:${isOwned ? '#10b981' : (canAfford ? '#d97706' : '#64748b')}; padding:6px 14px; font-size:11px;" ${isOwned || !canAfford ? 'disabled' : ''}>
          ${isOwned ? 'ĐÃ SỞ HỮU ĐỘC QUYỀN' : (canAfford ? 'MUA ĐỘC QUYỀN' : 'KHÔNG ĐỦ TIỀN')}
        </button>
      </div>
    `;
  });

  cont.innerHTML = `
    <div style="background:rgba(30,58,138,0.3); border:2px solid #3b82f6; border-radius:14px; padding:16px; margin-bottom:14px; text-align:center;">
      <div style="font-size:42px; margin-bottom:6px;">🌐</div>
      <h3 style="color:#60a5fa; margin:0 0 6px 0;">${gameState.corporation.name} (CẤP ${gameState.corporation.level})</h3>
      <p style="font-size:12px; color:#cbd5e1; margin:0 0 12px 0;">Tập đoàn đa quốc gia đứng đầu nền kinh tế! Nâng cấp quy mô để mở rộng thị trường tài chính.</p>
      <div style="display:flex; justify-content:center; gap:12px;">
        <button class="btn-primary-action" onclick="upgradeSyndicateLevel()" style="background:#2563eb; padding:8px 20px;">
          🚀 NÂNG CẤP TẬP ĐOÀN LÊN CẤP ${gameState.corporation.level + 1} ($${(gameState.corporation.level * 25000).toLocaleString()})
        </button>
      </div>
    </div>
    <h4 style="color:#facc15; margin:14px 0 8px 0; text-align:center;">ĐẤU GIÁ NHƯỢNG QUYỀN ĐỘC QUYỀN HẠ TẦNG TOÀN SERVER</h4>
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
      ${monoCardsHtml}
    </div>
  `;
}

function upgradeSyndicateLevel() {
  if (typeof gameState === 'undefined') return;
  gameState.corporation = gameState.corporation || { level: 1, name: 'EMPIRE APEX HOLDINGS', monopolies: {} };
  const cost = gameState.corporation.level * 25000;
  if ((gameState.money || 0) < cost) {
    showToast(`⚠️ Cần $${cost.toLocaleString()} để nâng cấp tập đoàn!`);
    return;
  }
  gameState.money -= cost;
  gameState.corporation.level++;
  showToast(`🎉 CHÚC MỪNG CHỦ TỊCH: Tập đoàn đã nâng cấp lên CẤP ${gameState.corporation.level}! Vốn hóa thị trường đạt đỉnh mới!`);
  if (typeof sounds !== 'undefined' && sounds.playCelebrationCheer) sounds.playCelebrationCheer();
  renderSyndicateModal();
  if (typeof updateHUD === 'function') updateHUD();
  if (typeof triggerActionSave === 'function') triggerActionSave();
}

function buyInfrastructureMonopoly(mKey) {
  const mono = INFRASTRUCTURE_MONOPOLIES[mKey];
  if (!mono || typeof gameState === 'undefined') return;
  gameState.corporation = gameState.corporation || { level: 1, name: 'EMPIRE APEX HOLDINGS', monopolies: {} };
  if (gameState.corporation.monopolies[mKey]) return;

  if ((gameState.money || 0) < mono.cost) {
    showToast(`⚠️ Không đủ ngân sách mua độc quyền hạ tầng: Cần $${mono.cost.toLocaleString()}!`);
    return;
  }
  gameState.money -= mono.cost;
  gameState.corporation.monopolies[mKey] = true;

  showToast(`⚓ ĐÃ THÂU TÓM ĐỘC QUYỀN: [${mono.name}]! Nhận cổ tức định kỳ +$${mono.dividendRate}/phút!`);
  if (typeof sounds !== 'undefined' && sounds.playCash) sounds.playCash();
  renderSyndicateModal();
  if (typeof updateHUD === 'function') updateHUD();
  if (typeof triggerActionSave === 'function') triggerActionSave();
}

// ===========================================================================
// 24. HỆ THỐNG KHỦNG HOẢNG ĐỘNG TOÀN CẦU (GLOBAL CRISIS DIRECTOR)
// ===========================================================================
let activeCrisisData = null;

function showGlobalCrisisAlert(crisis) {
  activeCrisisData = crisis;
  const b = document.getElementById('crisis-alert-banner');
  const t = document.getElementById('crisis-alert-text');
  const timer = document.getElementById('crisis-alert-timer');
  if (b && t) {
    t.textContent = crisis.title;
    if (timer) timer.textContent = `${Math.ceil(crisis.duration)}s`;
    b.style.display = 'flex';
  }
  if (typeof sounds !== 'undefined' && sounds.playSiren) sounds.playSiren();
}

function hideGlobalCrisisAlert() {
  activeCrisisData = null;
  const b = document.getElementById('crisis-alert-banner');
  if (b) b.style.display = 'none';
}

function joinGlobalCrisisResolve() {
  if (!activeCrisisData || typeof gameState === 'undefined') {
    showToast('ℹ️ Hiện không có sự cố khủng hoảng nào đang diễn ra.');
    return;
  }
  const reward = activeCrisisData.reward || 10000;
  gameState.money = (gameState.money || 0) + reward;
  gameState.gems = (gameState.gems || 0) + 10;
  showToast(`🏅 ANH HÙNG ĐÔ THỊ: Bạn đã dũng cảm dập tắt cuộc khủng hoảng [${activeCrisisData.title}]! Nhận thưởng khẩn cấp: +$${reward.toLocaleString()} & +10 GEMS!`);
  if (typeof sounds !== 'undefined' && sounds.playCelebrationCheer) sounds.playCelebrationCheer();
  hideGlobalCrisisAlert();
  if (typeof updateHUD === 'function') updateHUD();
  if (typeof triggerActionSave === 'function') triggerActionSave();
}

window.openCraftingModal = openCraftingModal;
window.renderCraftingModal = renderCraftingModal;
window.craftRecipe = craftRecipe;

window.openTalentModal = openTalentModal;
window.renderTalentModal = renderTalentModal;
window.allocateTalentPoint = allocateTalentPoint;

window.openCityHallModal = openCityHallModal;
window.renderCityHallModal = renderCityHallModal;
window.enactCityDecree = enactCityDecree;
window.updateCityMetricsHUD = updateCityMetricsHUD;

window.openSyndicateModal = openSyndicateModal;
window.renderSyndicateModal = renderSyndicateModal;
window.upgradeSyndicateLevel = upgradeSyndicateLevel;
window.buyInfrastructureMonopoly = buyInfrastructureMonopoly;

window.showGlobalCrisisAlert = showGlobalCrisisAlert;
window.hideGlobalCrisisAlert = hideGlobalCrisisAlert;
window.joinGlobalCrisisResolve = joinGlobalCrisisResolve;

// Tự động khởi chạy Minimap & Modals khi nạp trang
window.addEventListener('DOMContentLoaded', () => {
  initMinimap();
  initAchievementsModal();
  initSkinsModal();
  initStocksModal();
  initTechTreeModal();
  initCityDashboardHUD();
  initCityModals();
});


// ===========================================================================
// MODAL QUẢN LÝ BẤT ĐỘNG SẢN & THƯƠNG CẢNG HÀNG HẢI
// ===========================================================================
function openRealEstateModal() {
  const m = document.getElementById('real-estate-modal');
  if (m) {
    m.classList.add('open');
    const vStatus = document.getElementById('re-villa-status');
    if (vStatus) {
      vStatus.textContent = gameState.villaRented ? 'CHO THUÊ (+$1,200/2p)' : 'ĐÃ SỞ HỮU (NGHỈ DƯỠNG)';
      vStatus.style.color = gameState.villaRented ? '#facc15' : '#22c55e';
    }
    const pStatus = document.getElementById('re-penthouse-status');
    if (pStatus) {
      pStatus.textContent = gameState.penthouseOwned ? 'ĐÃ SỞ HỮU 👑' : 'Đang mở bán';
      pStatus.style.color = gameState.penthouseOwned ? '#a855f7' : '#38bdf8';
    }
  }
}
window.openRealEstateModal = openRealEstateModal;

function closeRealEstateModal() {
  const m = document.getElementById('real-estate-modal');
  if (m) m.classList.remove('open');
}
window.closeRealEstateModal = closeRealEstateModal;

function teleportToHomeVilla() {
  if (window.player && window.player.mesh) {
    window.player.mesh.position.set(100, 1.5, 60);
    showToast('🏖️ ĐÃ DỊCH CHUYỂN VỀ DINH THỰ MALDIVES OCEAN VIEW!');
    if (typeof sounds !== 'undefined' && sounds.playLevelUp) sounds.playLevelUp();
  }
  closeRealEstateModal();
}
window.teleportToHomeVilla = teleportToHomeVilla;

function toggleVillaRental() {
  gameState.villaRented = !gameState.villaRented;
  if (gameState.villaRented) {
    showToast('💼 Dinh thự chuyển sang chế độ CHO THUÊ: Tự động thu +$1,200 USD mỗi 2 phút!');
  } else {
    showToast('🏖️ Dinh thự chuyển sang chế độ NGHỈ DƯỠNG CÁ NHÂN: Phục vụ riêng cho bạn!');
  }
  if (typeof sounds !== 'undefined' && sounds.playCash) sounds.playCash();
  openRealEstateModal();
  if (typeof triggerActionSave === 'function') triggerActionSave();
}
window.toggleVillaRental = toggleVillaRental;

function buySkyPenthouse() {
  if (gameState.penthouseOwned) {
    showToast('ℹ️ Bạn đã sở hữu Sky Penthouse Hoàng Gia này rồi!');
    return;
  }
  const cost = 25000;
  const reqPlanks = 150;
  if ((gameState.money || 0) < cost || (gameState.planks || 0) < reqPlanks) {
    showToast(`⚠️ Không đủ tài nguyên! Cần $${cost.toLocaleString()} USD và ${reqPlanks} Ván Gỗ để sở hữu Sky Penthouse.`);
    return;
  }
  gameState.money -= cost;
  gameState.planks -= reqPlanks;
  gameState.penthouseOwned = true;
  showToast('👑 CHÚC MỪNG BẠN ĐÃ SỞ HỮU SKY PENTHOUSE HOÀNG GIA! Đẳng cấp đỉnh cao giữa mây trời!');
  if (typeof sounds !== 'undefined' && sounds.playCelebrationCheer) sounds.playCelebrationCheer();
  openRealEstateModal();
  if (typeof updateHUD === 'function') updateHUD();
  if (typeof triggerActionSave === 'function') triggerActionSave();
}
window.buySkyPenthouse = buySkyPenthouse;

function hostPartyAtHome() {
  const cost = 500;
  if ((gameState.money || 0) < cost) {
    showToast('⚠️ Bạn không đủ $500 USD để mở tiệc!');
    return;
  }
  gameState.money -= cost;
  showToast('🎉 BẠN ĐÃ MỞ TIỆC VIP TẠI DINH THỰ: Cư dân cùng ăn mừng, tăng +25% tốc độ di chuyển trong 60s!');
  if (typeof sounds !== 'undefined' && sounds.playCelebrationCheer) sounds.playCelebrationCheer();
  gameState.partyBuffTimer = 60.0;
  if (window.player && window.player.mesh && typeof spawnParticle === 'function') {
    for (let pi = 0; pi < 20; pi++) {
      spawnParticle(window.player.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 2, (Math.random() - 0.5) * 4)), 0xec4899);
    }
  }
  closeRealEstateModal();
  if (typeof updateHUD === 'function') updateHUD();
}
window.hostPartyAtHome = hostPartyAtHome;

function openMaritimeModal() {
  const m = document.getElementById('maritime-modal');
  if (m) m.classList.add('open');
}
window.openMaritimeModal = openMaritimeModal;

function closeMaritimeModal() {
  const m = document.getElementById('maritime-modal');
  if (m) m.classList.remove('open');
}
window.closeMaritimeModal = closeMaritimeModal;

function dispatchMaritimeFleet(dest) {
  if (window.activeMaritimeVoyage) {
    showToast(`⚠️ Hạm đội đang trên hải trình tới ${window.activeMaritimeVoyage.destName} (${Math.ceil(window.activeMaritimeVoyage.timer)}s còn lại)!`);
    return;
  }

  const routes = {
    singapore: {
      destName: 'Singapore',
      reqItem: 'planks',
      reqAmount: 40,
      rewardMoney: 8500,
      rewardGems: 5,
      duration: 35
    },
    rotterdam: {
      destName: 'Rotterdam',
      reqItem: 'pallets',
      reqAmount: 10,
      rewardMoney: 14000,
      rewardGems: 10,
      duration: 50
    },
    tokyo: {
      destName: 'Tokyo',
      reqItem: 'freshFish',
      altItem: 'cannedFish',
      reqAmount: 20,
      rewardMoney: 22000,
      rewardGems: 18,
      duration: 65
    }
  };

  const r = routes[dest];
  if (!r) return;

  // Kiểm tra hàng hóa
  let hasEnough = false;
  if (r.reqItem === 'planks' && (gameState.planks || 0) >= r.reqAmount) {
    gameState.planks -= r.reqAmount;
    hasEnough = true;
  } else if (r.reqItem === 'pallets' && (gameState.pallets || 0) >= r.reqAmount) {
    gameState.pallets -= r.reqAmount;
    hasEnough = true;
  } else if (r.reqItem === 'freshFish') {
    if ((gameState.freshFish || 0) >= r.reqAmount) {
      gameState.freshFish -= r.reqAmount;
      hasEnough = true;
    } else if ((gameState.cannedFish || 0) >= Math.ceil(r.reqAmount / 2)) {
      gameState.cannedFish -= Math.ceil(r.reqAmount / 2);
      hasEnough = true;
    } else if ((gameState.planks || 0) >= 60) { // Dự phòng ván gỗ nếu chưa đánh cá
      gameState.planks -= 60;
      hasEnough = true;
    }
  } else if ((gameState.planks || 0) >= 50) { // Fallback linh hoạt
    gameState.planks -= 50;
    hasEnough = true;
  }

  if (!hasEnough) {
    showToast(`⚠️ Không đủ hàng hóa để xuất cảng tới ${r.destName}! Cần ít nhất ${r.reqAmount} đơn vị hàng hóa.`);
    return;
  }

  window.activeMaritimeVoyage = {
    destName: r.destName,
    timer: r.duration,
    totalDuration: r.duration,
    stormEncountered: false,
    rewardMoney: r.rewardMoney,
    rewardGems: r.rewardGems
  };

  closeMaritimeModal();
  showToast(`🚢 HẠM ĐỘI ĐÃ XUẤT BẾN ĐI ${r.destName.toUpperCase()}! Hải trình dự kiến: ${r.duration}s. Lợi nhuận: +$${r.rewardMoney.toLocaleString()} USD!`);
  if (typeof sounds !== 'undefined' && sounds.playCelebrationCheer) sounds.playCelebrationCheer();
  if (typeof updateHUD === 'function') updateHUD();
  if (typeof triggerActionSave === 'function') triggerActionSave();
}
window.dispatchMaritimeFleet = dispatchMaritimeFleet;

// ===========================================================================
// HỆ THỐNG UI/UX & QUẢN TRỊ 100-ITEM MASTER SUITE (ZERO-LAG THROTTLED HUD)
// ===========================================================================

// 1. CHẾ ĐỘ CHỤP ẢNH ĐIỆN ẢNH PHOTO MODE (MỤC 94 - PHÍM F12)
function togglePhotoMode() {
  if (typeof gameState === 'undefined') return;
  gameState.photoModeActive = !gameState.photoModeActive;
  const header = document.querySelector('header');
  const banners = document.querySelectorAll('.market-news-banner, #bottom-left-btn, #minimap-container');
  
  if (gameState.photoModeActive) {
    if (header) header.style.display = 'none';
    banners.forEach(b => b.style.display = 'none');
    showToast('📸 PHOTO MODE BẬT: Xoay tự do ngắm cảnh! Nhấn [F12] để chụp ảnh PNG hoặc thoát!');
    if (typeof sounds !== 'undefined' && sounds.playCameraShutter) sounds.playCameraShutter();
  } else {
    // Chụp ảnh canvas khi tắt Photo Mode nếu muốn
    if (window.renderer && window.renderer.domElement) {
      try {
        const dataURL = window.renderer.domElement.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `LumberEmpire_Photo_${Date.now()}.png`;
        link.href = dataURL;
        // Không force download làm phiền nếu người dùng chỉ nhấn thoát, chỉ báo đã lưu buffer
        showToast('📷 Đã tắt Photo Mode & lưu góc chụp vào bộ nhớ tạm!');
      } catch (e) {}
    }
    if (header) header.style.display = '';
    const metricsBanner = document.getElementById('city-metrics-banner');
    if (metricsBanner) metricsBanner.style.display = 'flex';
    const btm = document.getElementById('bottom-left-btn');
    if (btm) btm.style.display = 'flex';
  }
}
window.togglePhotoMode = togglePhotoMode;

// 2. VÒNG TRÒN CHỌN NHANH THAO TÁC RADIAL ACTION WHEEL (MỤC 97 - PHÍM TAB)
function toggleRadialMenu() {
  let wheel = document.getElementById('radial-action-wheel');
  if (!wheel) {
    wheel = document.createElement('div');
    wheel.id = 'radial-action-wheel';
    wheel.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:320px; height:320px; border-radius:50%; background:rgba(15,23,42,0.92); border:3px solid #38bdf8; box-shadow:0 0 40px rgba(56,189,248,0.45); display:none; z-index:9999; flex-direction:column; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(10px);';
    wheel.innerHTML = `
      <div style="color:#38bdf8; font-weight:bold; font-size:13px; margin-bottom:12px;">⚡ MENU THAO TÁC NHANH (TAB)</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; width:100%;">
        <button class="sys-btn" onclick="openBankModal(); toggleRadialMenu();">🏦 Ngân Hàng (N)</button>
        <button class="sys-btn" onclick="openQuestLogModal(); toggleRadialMenu();">📜 Nhiệm Vụ (Q)</button>
        <button class="sys-btn" onclick="openForbesModal(); toggleRadialMenu();">🏆 Forbes (L)</button>
        <button class="sys-btn" onclick="openGraphicsSettingsModal(); toggleRadialMenu();">⚙️ Đồ Họa (G)</button>
        <button class="sys-btn" onclick="togglePhotoMode(); toggleRadialMenu();">📸 Chụp Ảnh (F12)</button>
        <button class="sys-btn" onclick="openUpgradeShop(); toggleRadialMenu();">🏪 Cửa Hàng (B)</button>
        <button class="sys-btn" onclick="openRealEstateModal(); toggleRadialMenu();">🏰 Bất Động Sản</button>
        <button class="sys-btn" style="background:#ef4444;" onclick="toggleRadialMenu();">✖ Đóng</button>
      </div>
    `;
    document.body.appendChild(wheel);
  }
  wheel.style.display = (wheel.style.display === 'none' || !wheel.style.display) ? 'flex' : 'none';
}
window.toggleRadialMenu = toggleRadialMenu;

// 3. NGÂN HÀNG TRUNG ƯƠNG & TÍN DỤNG DOANH NGHIỆP (MỤC 67, 68, 69)
function openBankModal() {
  let modal = document.getElementById('bank-credit-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'bank-credit-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card modal-wide" style="max-width:620px;">
        <div class="modal-card-header">
          <h2>🏦 NGÂN HÀNG TRUNG ƯƠNG & TÍN DỤNG DOANH NGHIỆP</h2>
          <button class="btn-close-panel" onclick="document.getElementById('bank-credit-modal').classList.remove('open')">✖</button>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:14px;">
          <div style="background:#0f172a; padding:14px; border-radius:10px; border:1px solid #334155;">
            <h3 style="color:#22c55e; margin-top:0;">💰 Tiết Kiệm Lãi Kép (3%/chu kỳ)</h3>
            <p style="font-size:13px; color:#94a3b8;">Số dư gửi: <b id="val-bank-savings" style="color:#facc15;">$0</b></p>
            <div style="display:flex; gap:8px; margin-top:10px;">
              <button class="btn-primary" style="flex:1; padding:8px;" onclick="bankAction('deposit', 1000)">Gửi $1,000</button>
              <button class="btn-primary" style="flex:1; padding:8px; background:#0284c7;" onclick="bankAction('withdraw', 1000)">Rút $1,000</button>
            </div>
          </div>
          <div style="background:#0f172a; padding:14px; border-radius:10px; border:1px solid #334155;">
            <h3 style="color:#f59e0b; margin-top:0;">💳 Vay Vốn Đầu Tư (Lãi 8%)</h3>
            <p style="font-size:13px; color:#94a3b8;">Dư nợ hiện tại: <b id="val-bank-loan" style="color:#ef4444;">$0</b></p>
            <div style="display:flex; gap:8px; margin-top:10px;">
              <button class="btn-primary" style="flex:1; padding:8px; background:#ea580c;" onclick="bankAction('loan', 5000)">Vay $5,000</button>
              <button class="btn-primary" style="flex:1; padding:8px; background:#16a34a;" onclick="bankAction('repay', 5000)">Trả $5,000</button>
            </div>
          </div>
        </div>
        <div style="background:#0f172a; padding:14px; border-radius:10px; border:1px solid #334155; margin-top:14px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <b style="color:#38bdf8;">🛡️ Gói Bảo Hiểm Tài Sản & Xe Cơ Giới Toàn Diện</b>
            <div style="font-size:12px; color:#94a3b8;">Đền bù 70% tổn thất thiên tai, hỏa hoạn, tai nạn ($2,500 USD)</div>
          </div>
          <button id="btn-toggle-insurance" class="btn-primary" style="padding:8px 16px;" onclick="bankAction('insurance', 2500)">Mua Bảo Hiểm</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  modal.classList.add('open');
  refreshBankModal();
}
window.openBankModal = openBankModal;

function refreshBankModal() {
  const savEl = document.getElementById('val-bank-savings');
  const loanEl = document.getElementById('val-bank-loan');
  const insBtn = document.getElementById('btn-toggle-insurance');
  if (savEl) savEl.textContent = '$' + Math.floor(gameState.bankSavings || 0).toLocaleString();
  if (loanEl) loanEl.textContent = '$' + Math.floor(gameState.bankLoan || 0).toLocaleString();
  if (insBtn) insBtn.textContent = gameState.insuranceActive ? '✅ ĐÃ KÍCH HOẠT' : 'Mua Bảo Hiểm ($2.5K)';
}

window.bankAction = function(type, amt) {
  if (type === 'deposit') {
    if ((gameState.money || 0) < amt) return showToast('⚠️ Không đủ tiền mặt để gửi tiết kiệm!');
    gameState.money -= amt;
    gameState.bankSavings = (gameState.bankSavings || 0) + amt;
    showToast(`🏦 Đã gửi $${amt.toLocaleString()} vào sổ tiết kiệm!`);
  } else if (type === 'withdraw') {
    if ((gameState.bankSavings || 0) < amt) return showToast('⚠️ Số dư tiết kiệm không đủ!');
    gameState.bankSavings -= amt;
    gameState.money += amt;
    showToast(`💵 Đã rút $${amt.toLocaleString()} từ sổ tiết kiệm!`);
  } else if (type === 'loan') {
    if ((gameState.bankLoan || 0) >= 25000) return showToast('⚠️ Đã chạm hạn mức tín dụng tối đa $25,000!');
    gameState.bankLoan = (gameState.bankLoan || 0) + amt;
    gameState.money += amt;
    showToast(`💳 Giải ngân thành công khoản vay $${amt.toLocaleString()}!`);
  } else if (type === 'repay') {
    if ((gameState.bankLoan || 0) <= 0) return showToast('✅ Bạn không có nợ xấu ngân hàng!');
    const pay = Math.min(amt, gameState.bankLoan);
    if ((gameState.money || 0) < pay) return showToast('⚠️ Không đủ tiền mặt để trả nợ!');
    gameState.money -= pay;
    gameState.bankLoan -= pay;
    showToast(`✅ Đã thanh toán $${pay.toLocaleString()} nợ gốc ngân hàng!`);
  } else if (type === 'insurance') {
    if (gameState.insuranceActive) return showToast('🛡️ Bảo hiểm tài sản đã có hiệu lực!');
    if ((gameState.money || 0) < amt) return showToast('⚠️ Cần $2,500 USD để mua gói bảo hiểm!');
    gameState.money -= amt;
    gameState.insuranceActive = true;
    showToast('🛡️ Đã kích hoạt Gói Bảo Hiểm Tài Sản & Xe Cơ Giới Toàn Diện!');
  }
  refreshBankModal();
  if (typeof updateHUD === 'function') updateHUD();
  if (typeof sounds !== 'undefined' && sounds.playCoin) sounds.playCoin();
};

// 4. BẢNG XẾP HẠNG TỶ PHÚ FORBES REALTIME (MỤC 78 & 100)
function openForbesModal() {
  let modal = document.getElementById('forbes-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'forbes-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card modal-wide" style="max-width:580px;">
        <div class="modal-card-header">
          <h2>🏆 BẢNG XẾP HẠNG TỶ PHÚ FORBES REALTIME</h2>
          <button class="btn-close-panel" onclick="document.getElementById('forbes-modal').classList.remove('open')">✖</button>
        </div>
        <p style="font-size:12px; color:#94a3b8;">So sánh tổng giá trị tài sản ròng thời gian thực với các tài phiệt đối thủ trên đảo!</p>
        <div id="forbes-list" style="margin-top:12px; display:flex; flex-direction:column; gap:8px;"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  const list = document.getElementById('forbes-list');
  const myNetWorth = Math.floor((gameState.money || 0) + (gameState.bankSavings || 0) - (gameState.bankLoan || 0) + (gameState.planks || 0) * 20);
  const rivals = [
    { name: 'Elon Woodsworth', worth: 850000, icon: '🚀' },
    { name: 'Warren Timber', worth: 420000, icon: '🏛️' },
    { name: 'Jeff Logistics', worth: 195000, icon: '📦' },
    { name: 'Bill Skyport', worth: 88000, icon: '✈️' },
    { name: 'Mark Marina', worth: 32000, icon: '⚓' },
    { name: `👑 ${gameState.username || 'Chủ Tịch'} (BẠN)`, worth: myNetWorth, icon: '🔥', isMe: true }
  ].sort((a, b) => b.worth - a.worth);

  if (list) {
    list.innerHTML = rivals.map((r, i) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:${r.isMe ? 'rgba(56,189,248,0.2)' : '#0f172a'}; border:1px solid ${r.isMe ? '#38bdf8' : '#334155'}; border-radius:8px;">
        <span style="font-weight:${r.isMe ? 'bold' : 'normal'}; color:${r.isMe ? '#38bdf8' : '#e2e8f0'};">#${i + 1} ${r.icon} ${r.name}</span>
        <b style="color:#facc15;">$${r.worth.toLocaleString()} USD</b>
      </div>
    `).join('');
  }
  modal.classList.add('open');
}
window.openForbesModal = openForbesModal;

// 5. CHIẾN DỊCH CỐT TRUYỆN & NHIỆM VỤ HÀNG NGÀY (MỤC 81 & 82)
function openQuestLogModal() {
  let modal = document.getElementById('quest-log-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'quest-log-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card modal-wide" style="max-width:600px;">
        <div class="modal-card-header">
          <h2>📜 CHIẾN DỊCH CỐT TRUYỆN & NHIỆM VỤ HÀNG NGÀY</h2>
          <button class="btn-close-panel" onclick="document.getElementById('quest-log-modal').classList.remove('open')">✖</button>
        </div>
        <div id="quest-log-content" style="margin-top:12px;"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  const qContent = document.getElementById('quest-log-content');
  const sq = gameState.activeStoryQuest || { title: 'Bước Đầu Khởi Nghiệp', desc: 'Đốn 15 khúc gỗ thông', progress: 0, target: 15, reward: 250 };
  const dailies = gameState.dailyQuests || [];

  if (qContent) {
    qContent.innerHTML = `
      <div style="background:rgba(245,158,11,0.12); border:1px solid #f59e0b; padding:14px; border-radius:10px; margin-bottom:14px;">
        <div style="color:#f59e0b; font-weight:bold; font-size:13px;">📖 NHIỆM VỤ CHÍNH - CHƯƠNG ${gameState.storyChapter || 1}</div>
        <div style="font-size:15px; font-weight:bold; margin:4px 0; color:#fff;">${sq.title}</div>
        <div style="font-size:13px; color:#cbd5e1;">${sq.desc} (${Math.min(sq.progress, sq.target)}/${sq.target}) • Thưởng: <b style="color:#22c55e;">+$${sq.reward} USD</b></div>
      </div>
      <div style="color:#38bdf8; font-weight:bold; font-size:13px; margin-bottom:8px;">📅 NHIỆM VỤ NHẬT TRÌNH HÔM NAY</div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${dailies.map(d => `
          <div style="background:#0f172a; border:1px solid #334155; padding:10px 14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:bold; color:#e2e8f0;">${d.title}</div>
              <div style="font-size:12px; color:#94a3b8;">Tiến độ: ${Math.min(d.progress, d.target)} / ${d.target}</div>
            </div>
            <span style="color:#4ade80; font-weight:bold;">+$${d.reward}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
  modal.classList.add('open');
}
window.openQuestLogModal = openQuestLogModal;

// 6. CÀI ĐẶT ĐỒ HỌA & HIỆU NĂNG ĐA CẤP (MỤC 99 - PHÍM G)
function openGraphicsSettingsModal() {
  let modal = document.getElementById('graphics-settings-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'graphics-settings-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card" style="max-width:460px;">
        <div class="modal-card-header">
          <h2>⚙️ TÙY CHỈNH ĐỒ HỌA & 60 FPS</h2>
          <button class="btn-close-panel" onclick="document.getElementById('graphics-settings-modal').classList.remove('open')">✖</button>
        </div>
        <p style="font-size:13px; color:#94a3b8;">Chọn cấu hình tương thích với thiết bị để duy trì 60 FPS không giật lag!</p>
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:12px;">
          <button class="btn-primary" style="background:#10b981;" onclick="setGraphicsPreset('low')">🔋 SIÊU MƯỢT (Low - Tắt bóng đổ, 60 FPS tuyệt đối)</button>
          <button class="btn-primary" style="background:#0284c7;" onclick="setGraphicsPreset('medium')">⚖️ CÂN BẰNG (Medium - Bóng đổ nhẹ, HD)</button>
          <button class="btn-primary" style="background:#7c3aed;" onclick="setGraphicsPreset('high')">✨ CHẤT LƯỢNG CAO (High - Đầy đủ hiệu ứng PBR)</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  modal.classList.add('open');
}
window.openGraphicsSettingsModal = openGraphicsSettingsModal;

window.setGraphicsPreset = function(preset) {
  if (!window.renderer) return;
  gameState.graphicsQuality = preset;
  if (preset === 'low') {
    window.renderer.setPixelRatio(0.8);
    window.renderer.shadowMap.enabled = false;
    showToast('🔋 Đã bật cấu hình SIÊU MƯỢT (Low) - Tối đa tốc độ khung hình!');
  } else if (preset === 'medium') {
    window.renderer.setPixelRatio(1.0);
    window.renderer.shadowMap.enabled = true;
    showToast('⚖️ Đã bật cấu hình CÂN BẰNG (Medium)!');
  } else {
    window.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    window.renderer.shadowMap.enabled = true;
    showToast('✨ Đã bật cấu hình CHẤT LƯỢNG CAO (High PBR)!');
  }
  document.getElementById('graphics-settings-modal').classList.remove('open');
};

// 7. CẬP NHẬT HUD 100-ITEM SUITE (ĐỒNG HỒ, XĂNG, THỂ LỰC, DƯỠNG KHÍ, BẢNG TIN)
let tickerTimer = 0;
let tickerIdx = 0;
const CITY_NEWS_LINES = [
  '📰 TIN ĐÔ THỊ: Giá ván gỗ mùa Đông sưởi ấm tăng vọt x3 tại quầy thu mua!',
  '🚗 GIAO THÔNG: Các trạm xăng Petrolimex và Gara Auto Repair đã mở cửa 24/7!',
  '📦 AIRDROP: Hòm tiếp tế quân sự vừa được thả dù xuống Đảo - Mau đi nhặt!',
  '⚡ MẸO HAY: Nhấn [Tab] mở vòng tròn chọn nhanh, [F12] chụp ảnh, [N] vào Ngân Hàng!'
];

function update100SuiteHUD(dt) {
  if (typeof gameState === 'undefined') return;
  let bar = document.getElementById('hud-100-suite-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'hud-100-suite-bar';
    bar.style.cssText = 'position:fixed; bottom:16px; left:50%; transform:translateX(-50%); background:rgba(15,23,42,0.88); border:1px solid #38bdf8; border-radius:12px; padding:6px 16px; display:flex; gap:16px; align-items:center; z-index:900; font-size:12px; color:#e2e8f0; box-shadow:0 4px 20px rgba(0,0,0,0.5); backdrop-filter:blur(6px);';
    bar.innerHTML = `
      <span id="hud-stamina-stat" title="Thể lực chạy nước rút (Shift)">🏃 Thể lực: <b>100%</b></span>
      <span id="hud-fuel-stat" title="Nhiên liệu xe hiện tại">⛽ Xăng: <b>100%</b></span>
      <span id="hud-hp-stat" title="Độ bền xe">🔧 Xe: <b>100%</b></span>
      <span id="hud-oxy-stat" style="display:none; color:#38bdf8;">🤿 Oxy: <b>100%</b></span>
      <span style="border-left:1px solid #334155; padding-left:12px; color:#facc15;" id="hud-news-ticker">📰 Đang cập nhật...</span>
      <button class="sys-btn" style="padding:3px 8px; font-size:11px; background:#0284c7;" onclick="toggleRadialMenu()">⚡ Menu (Tab)</button>
    `;
    document.body.appendChild(bar);
  }

  const stamEl = document.getElementById('hud-stamina-stat');
  const fuelEl = document.getElementById('hud-fuel-stat');
  const hpEl = document.getElementById('hud-hp-stat');
  const oxyEl = document.getElementById('hud-oxy-stat');
  const newsEl = document.getElementById('hud-news-ticker');

  if (stamEl) stamEl.innerHTML = `🏃 Thể lực: <b style="color:${gameState.playerStamina < 25 ? '#ef4444' : '#22c55e'}">${Math.round(gameState.playerStamina || 100)}%</b>`;
  if (fuelEl) fuelEl.innerHTML = `⛽ Xăng: <b style="color:${gameState.vehicleFuel < 20 ? '#ef4444' : '#facc15'}">${Math.round(gameState.vehicleFuel !== undefined ? gameState.vehicleFuel : 100)}%</b>`;
  if (hpEl) hpEl.innerHTML = `🔧 Xe: <b style="color:#38bdf8">${Math.round(gameState.vehicleHealth !== undefined ? gameState.vehicleHealth : 100)}%</b>`;

  if (oxyEl && window.player) {
    oxyEl.style.display = window.player.isSwimming ? 'inline' : 'none';
    oxyEl.innerHTML = `🤿 Oxy: <b>${Math.round(gameState.playerOxygen || 100)}%</b>`;
  }

  tickerTimer += (dt || 0.1);
  if (tickerTimer >= 5.0) {
    tickerTimer = 0;
    tickerIdx = (tickerIdx + 1) % CITY_NEWS_LINES.length;
    if (newsEl) newsEl.textContent = CITY_NEWS_LINES[tickerIdx];
  }
}
window.update100SuiteHUD = update100SuiteHUD;
