/**
 * Storage & MongoDB Atlas Persistence
 * Event-driven with 800ms debounce & robust LocalStorage fallback
 */

window.API_BASE = window.API_BASE || ((window.location.protocol === 'file:' || !window.location.port) 
  ? 'http://127.0.0.1:8000' 
  : '');
var API_BASE = window.API_BASE;

let saveTimer = null;
const cloudPill = document.getElementById('cloud-pill');

async function executeSave(immediate = false) {
  // Không lưu đè khi đang ở chế độ tham quan đế chế người khác
  if (window.authManager && window.authManager.isVisiting) {
    return false;
  }

  if (saveTimer) clearTimeout(saveTimer);
  gameState.lastLogout = Date.now();
  gameState.updatedAt = new Date().toISOString();

  const perform = async () => {
    if (cloudPill) {
      cloudPill.className = 'cloud-pill saving';
      cloudPill.textContent = '☁️ Đang đồng bộ...';
    }

    const saveKey = 'lumber_empire_save_' + (gameState.playerId || 'guest');
    const jsonState = JSON.stringify(gameState);

    try {
      const res = await fetch(`${API_BASE}/api/save-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonState
      });
      if (res.ok) {
        if (cloudPill) {
          cloudPill.className = 'cloud-pill saved';
          cloudPill.textContent = '☁️ Đã lưu Atlas';
        }
        localStorage.setItem(saveKey, jsonState);
        localStorage.setItem('lumber_empire_save', jsonState);
        return true;
      } else {
        localStorage.setItem(saveKey, jsonState);
        localStorage.setItem('lumber_empire_save', jsonState);
        if (cloudPill) {
          cloudPill.className = 'cloud-pill';
          cloudPill.textContent = '💾 Đã lưu dự phòng';
        }
        return false;
      }
    } catch (e) {
      localStorage.setItem(saveKey, jsonState);
      localStorage.setItem('lumber_empire_save', jsonState);
      if (cloudPill) {
        cloudPill.className = 'cloud-pill';
        cloudPill.textContent = '💾 Đã lưu bộ nhớ';
      }
      return false;
    }
  };

  if (immediate) return await perform();
  saveTimer = setTimeout(perform, 3200);
}

function triggerActionSave() {
  executeSave(false);
}

async function loadGame() {
  try {
    const res = await fetch(`${API_BASE}/api/load-game/${gameState.playerId}`);
    if (res.ok) {
      const resData = await res.json();
      if (resData.found && resData.data) {
        Object.assign(gameState, resData.data);
        if (typeof syncBackpackCapacity === 'function') syncBackpackCapacity();
        if (window.player) {
          if (typeof window.player.expandBackpackMeshCapacity === 'function') {
            window.player.expandBackpackMeshCapacity(gameState.backpackMax);
          }
          window.player.updateLogStack(gameState.logs);
        }
        showToast('✅ Đã nạp dữ liệu từ MongoDB Atlas!');
        if (cloudPill) {
          cloudPill.className = 'cloud-pill saved';
          cloudPill.textContent = '☁️ Đã nạp Atlas';
        }
        updateHUD();
        if (typeof syncVehiclesWithGameState === 'function') syncVehiclesWithGameState();
        if (typeof updateSectorBarricades === 'function') updateSectorBarricades();
        if (typeof checkOfflineEarnings === 'function') checkOfflineEarnings();
        return;
      }
    }
  } catch (e) {
    console.warn('[!] Lỗi kết nối Atlas API, chuyển sang nạp từ LocalStorage:', e.message);
  }

  // Fallback đọc LocalStorage
  const saveKey = 'lumber_empire_save_' + (gameState.playerId || 'guest');
  const localRaw = localStorage.getItem(saveKey) || localStorage.getItem('lumber_empire_save');
  if (localRaw) {
    try {
      const localData = JSON.parse(localRaw);
      Object.assign(gameState, localData);
      if (typeof syncBackpackCapacity === 'function') syncBackpackCapacity();
      if (window.player) {
        if (typeof window.player.expandBackpackMeshCapacity === 'function') {
          window.player.expandBackpackMeshCapacity(gameState.backpackMax);
        }
        window.player.updateLogStack(gameState.logs);
      }
      showToast('💾 Đã nạp dữ liệu từ bộ nhớ cục bộ!');
      if (cloudPill) {
        cloudPill.className = 'cloud-pill';
        cloudPill.textContent = '💾 Đã nạp cục bộ';
      }
      updateHUD();
      if (typeof syncVehiclesWithGameState === 'function') syncVehiclesWithGameState();
      if (typeof updateSectorBarricades === 'function') updateSectorBarricades();
      if (typeof checkOfflineEarnings === 'function') checkOfflineEarnings();
    } catch (e) {}
  }
}

// Lưu trạng thái trước khi đóng trang
window.addEventListener('beforeunload', () => {
  gameState.lastLogout = Date.now();
  localStorage.setItem('lumber_empire_save', JSON.stringify(gameState));
});

window.executeSave = executeSave;
window.triggerActionSave = triggerActionSave;
window.loadGame = loadGame;
