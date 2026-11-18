/**
 * Empire Tycoon 3D - Authentication & Personal Empire Management System
 * Supports User Registration, Login, Guest Play, MongoDB Atlas Isolation,
 * Empire Renaming, Leaderboard & Visiting Friend's Empires
 */

window.API_BASE = window.API_BASE || ((window.location.protocol === 'file:' || !window.location.port) 
  ? 'http://127.0.0.1:8000' 
  : '');
var API_BASE = window.API_BASE;

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.token = null;
    this.isGuest = false;
    this.isVisiting = false;
    this.myOwnSavedState = null;
  }

  init() {
    this.bindDOM();
    this.checkSavedSession();
  }

  checkSavedSession() {
    const raw = localStorage.getItem('lumber_empire_auth');
    if (raw) {
      try {
        const session = JSON.parse(raw);
        if (session && session.username) {
          this.applySession(session, false);
          return;
        }
      } catch (e) {}
    }

    // Tự động khởi tạo phiên chơi Khách (Guest) để người chơi vào thẳng thế giới 3D không bị kẹt bởi modal
    this.playAsGuest(false);
  }

  bindDOM() {
    // Chuyển Tab Đăng nhập / Đăng ký
    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');
    const registerGroup = document.getElementById('auth-register-extra');
    const submitBtn = document.getElementById('auth-submit-btn');
    const formTitle = document.getElementById('auth-form-title');

    if (tabLogin && tabRegister) {
      tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        if (registerGroup) registerGroup.style.display = 'none';
        if (submitBtn) submitBtn.textContent = '🚀 VÀO ĐẾ CHẾ CỦA TÔI';
        if (formTitle) formTitle.textContent = '🔑 ĐĂNG NHẬP VÀO ĐẾ CHẾ';
      });

      tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        if (registerGroup) registerGroup.style.display = 'block';
        if (submitBtn) submitBtn.textContent = '✨ SÁNG LẬP ĐẾ CHẾ MỚI';
        if (formTitle) formTitle.textContent = '👑 TẠO TÀI KHOẢN & SÁNG LẬP ĐẾ CHẾ';
      });
    }

    // Submit form
    const form = document.getElementById('auth-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const isRegister = tabRegister && tabRegister.classList.contains('active');
        const username = document.getElementById('auth-username').value.trim();
        const password = document.getElementById('auth-password').value;
        const empireName = document.getElementById('auth-empire-name') 
          ? document.getElementById('auth-empire-name').value.trim() 
          : '';

        if (isRegister) {
          this.register(username, password, empireName);
        } else {
          this.login(username, password);
        }
      });
    }

    // Chơi nhanh chế độ khách
    const btnGuest = document.getElementById('auth-guest-btn');
    if (btnGuest) {
      btnGuest.addEventListener('click', () => this.playAsGuest());
    }

    // Account pill click -> mở Account Menu
    const accountPill = document.getElementById('account-pill');
    if (accountPill) {
      accountPill.addEventListener('click', () => this.openAccountMenu());
    }

    // Nút đóng Auth Modal
    const btnCloseAuth = document.getElementById('btn-close-auth');
    if (btnCloseAuth) {
      btnCloseAuth.addEventListener('click', () => this.closeAuthModal());
    }

    const authModalOverlay = document.getElementById('auth-modal');
    if (authModalOverlay) {
      authModalOverlay.addEventListener('click', (e) => {
        if (e.target === authModalOverlay) this.closeAuthModal();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeAuthModal();
    });

    // Nút khám phá đế chế bạn bè trên HUD
    const btnEmpires = document.getElementById('btn-empires');
    if (btnEmpires) {
      btnEmpires.addEventListener('click', () => this.openEmpireDirectory());
    }

    // Nút đóng modal danh sách đế chế
    const btnCloseEmpires = document.getElementById('btn-close-empires');
    if (btnCloseEmpires) {
      btnCloseEmpires.addEventListener('click', () => {
        const modal = document.getElementById('empires-modal');
        if (modal) {
          modal.classList.remove('open');
          modal.classList.remove('active');
        }
      });
    }

    // Nút quay về đế chế của tôi khi đang đi thăm
    const btnLeaveVisit = document.getElementById('btn-leave-visit');
    if (btnLeaveVisit) {
      btnLeaveVisit.addEventListener('click', () => this.leaveVisit());
    }
  }

  showAuthModal(isRegister = false) {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.add('open');
    modal.classList.add('open');
    modal.classList.add('active');

    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');
    const registerGroup = document.getElementById('auth-register-extra');
    const submitBtn = document.getElementById('auth-submit-btn');

    if (isRegister && tabRegister) {
      tabRegister.click();
    } else if (tabLogin) {
      tabLogin.click();
    }
  }

  closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.classList.remove('open');
      modal.classList.remove('active');
    }
  }

  async register(username, password, empireName) {
    const errBox = document.getElementById('auth-error-msg');
    if (errBox) errBox.textContent = '';

    try {
      showToast('⏳ Đang khởi tạo đế chế mới trên Atlas...');
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, empireName })
      });
      const data = await res.json();

      if (!res.ok || data.status !== 'success') {
        if (errBox) errBox.textContent = '❌ ' + (data.message || 'Lỗi đăng ký!');
        showToast('❌ ' + (data.message || 'Lỗi đăng ký!'));
        return;
      }

      showToast(`🎉 Chúc mừng! Đế chế "${data.user.empireName}" đã được sáng lập!`);
      this.applySession(data.user, true, data.empireData);
      this.closeAuthModal();
    } catch (e) {
      if (errBox) errBox.textContent = '❌ Lỗi kết nối mạng: ' + e.message;
      showToast('❌ Lỗi kết nối máy chủ!');
    }
  }

  async login(username, password) {
    const errBox = document.getElementById('auth-error-msg');
    if (errBox) errBox.textContent = '';

    try {
      showToast('⏳ Đang xác thực tài khoản...');
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (!res.ok || data.status !== 'success') {
        if (errBox) errBox.textContent = '❌ ' + (data.message || 'Đăng nhập thất bại!');
        showToast('❌ ' + (data.message || 'Đăng nhập thất bại!'));
        return;
      }

      showToast(`👑 Chào mừng Chủ tịch ${data.user.username} trở lại!`);
      this.applySession(data.user, true, data.empireData);
      this.closeAuthModal();
    } catch (e) {
      if (errBox) errBox.textContent = '❌ Lỗi kết nối mạng: ' + e.message;
      showToast('❌ Lỗi kết nối máy chủ!');
    }
  }

  playAsGuest(showNotification = true) {
    const guestId = 'khach_' + Math.floor(Math.random() * 8999 + 1000);
    const guestEmpire = 'Đế Chế Lâm Nghiệp #' + guestId.slice(-4);
    const session = {
      username: guestId,
      empireName: guestEmpire,
      token: 'guest_token',
      isGuest: true
    };
    if (showNotification) {
      showToast(`⚡ Bắt đầu chơi nhanh với tài khoản Khách: ${guestId}`);
    }
    this.applySession(session, true);
    this.closeAuthModal();
  }

  applySession(user, isNewAction = false, empireData = null) {
    this.currentUser = user.username;
    this.isGuest = !!user.isGuest;
    this.token = user.token;

    // Lưu session
    localStorage.setItem('lumber_empire_auth', JSON.stringify({
      username: user.username,
      empireName: user.empireName,
      token: user.token,
      isGuest: this.isGuest
    }));

    // Cập nhật gameState
    if (typeof gameState !== 'undefined') {
      gameState.playerId = user.username;
      gameState.username = user.username;
      gameState.empireName = user.empireName;

      if (empireData) {
        Object.assign(gameState, empireData);
      }
    }

    // Cập nhật HUD
    this.updateHUDAccount();

    // Nạp dữ liệu đế chế từ Atlas hoặc LocalStorage nếu không truyền sẵn
    if (!empireData && typeof loadGame === 'function') {
      loadGame().then(() => {
        this.update3DSignboards();
      });
    } else {
      if (typeof updateHUD === 'function') updateHUD();
      if (typeof syncBackpackCapacity === 'function') syncBackpackCapacity();
      if (typeof syncVehiclesWithGameState === 'function') syncVehiclesWithGameState();
      if (typeof updateSectorBarricades === 'function') updateSectorBarricades();
      this.update3DSignboards();
    }

    // Cập nhật sảnh Multiplayer với danh tính mới
    if (window.multiplayer && window.multiplayer.connected) {
      window.multiplayer.myNickname = user.username;
      localStorage.setItem('lumber_tycoon_nickname', user.username);
      localStorage.setItem('lumber_tycoon_empire', user.empireName);
      window.multiplayer.send({
        type: 'join',
        nickname: user.username,
        empireName: user.empireName,
        skin: gameState.characterSkin || 'default',
        level: gameState.level || 1
      });
    }
  }

  updateHUDAccount() {
    const empireEl = document.getElementById('val-empire-name');
    const userEl = document.getElementById('val-username');
    if (empireEl && typeof gameState !== 'undefined') {
      empireEl.textContent = gameState.empireName || 'Đế Chế Của Bạn';
    }
    if (userEl && typeof gameState !== 'undefined') {
      userEl.textContent = gameState.username || 'Chủ tịch';
    }
  }

  update3DSignboards() {
    if (typeof updateEmpireEntranceSign === 'function') {
      updateEmpireEntranceSign(gameState.empireName, gameState.username, gameState.level);
    }
    if (typeof updateEmpireHQSign === 'function') {
      updateEmpireHQSign(gameState.empireName, gameState.username);
    }
  }

  openAccountMenu() {
    const options = [
      `1. 🏷️ Đổi tên Đế Chế (Hiện tại: "${gameState.empireName}")`,
      `2. 🌐 Khám phá & Đi thăm Đế Chế bạn bè`,
      `3. 💾 Lưu ngay lập tức lên Cloud MongoDB Atlas`,
      `4. 🚪 Đổi tài khoản / Đăng xuất`
    ].join('\n');

    const choice = prompt(
      `🏛️ QUẢN TRỊ ĐẾ CHẾ [ ${gameState.empireName} ]\nChủ tịch: ${gameState.username} (LV.${gameState.level})\n\nChọn chức năng (Nhập 1, 2, 3 hoặc 4):`,
      '1'
    );

    if (choice === '1') {
      this.promptRenameEmpire();
    } else if (choice === '2') {
      this.openEmpireDirectory();
    } else if (choice === '3') {
      if (typeof executeSave === 'function') {
        executeSave(true).then(() => showToast('✅ Đã lưu thủ công vào Atlas thành công!'));
      }
    } else if (choice === '4') {
      this.logout();
    }
  }

  async promptRenameEmpire() {
    const newName = prompt('Nhập tên Đế Chế mới của bạn:', gameState.empireName);
    if (!newName || !newName.trim()) return;

    const trimmed = newName.trim().slice(0, 32);
    gameState.empireName = trimmed;
    this.updateHUDAccount();
    this.update3DSignboards();

    // Đồng bộ server
    try {
      await fetch(`${API_BASE}/api/auth/rename-empire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: gameState.username, empireName: trimmed })
      });
      showToast(`🏷️ Đã đổi tên đế chế thành: "${trimmed}"`);
      if (typeof executeSave === 'function') executeSave(true);
    } catch (e) {
      showToast(`🏷️ Đã cập nhật tên đế chế cục bộ: "${trimmed}"`);
    }

    // Báo sảnh multiplayer
    if (window.multiplayer && window.multiplayer.connected) {
      window.multiplayer.send({
        type: 'join',
        nickname: gameState.username,
        empireName: trimmed,
        level: gameState.level
      });
    }
  }

  logout() {
    if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi đế chế này không?')) {
      if (typeof executeSave === 'function') executeSave(true);
      localStorage.removeItem('lumber_empire_auth');
      this.currentUser = null;
      this.token = null;
      showToast('🚪 Đã đăng xuất thành công.');
      this.showAuthModal(false);
    }
  }

  // -------------------------------------------------------------------------
  // KHÁM PHÁ & ĐI THĂM ĐẾ CHẾ BẠN BÈ (EMPIRE DIRECTORY & VISITING)
  // -------------------------------------------------------------------------
  async openEmpireDirectory() {
    const modal = document.getElementById('empires-modal');
    const container = document.getElementById('empires-grid');
    if (!modal || !container) return;

    modal.classList.add('open');
    modal.classList.add('active');
    container.innerHTML = '<div style="color:#94a3b8; padding:20px; text-align:center;">⏳ Đang tải danh sách các đế chế trên server...</div>';

    try {
      const res = await fetch(`${API_BASE}/api/empires/leaderboard`);
      const data = await res.json();
      const list = (data && data.empires) ? data.empires : [];

      if (list.length === 0) {
        container.innerHTML = '<div style="color:#94a3b8; padding:20px; text-align:center;">Chưa có đế chế nào khác trên server. Hãy rủ bạn bè cùng vào tạo đế chế nhé!</div>';
        return;
      }

      container.innerHTML = '';
      list.forEach((emp, idx) => {
        const isMine = emp.username === gameState.username;
        const card = document.createElement('div');
        card.className = `empire-card ${isMine ? 'empire-card-mine' : ''}`;

        const rankIcon = idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;

        card.innerHTML = `
          <div class="empire-card-header">
            <span class="empire-rank">${rankIcon}</span>
            <div class="empire-card-title-group">
              <h3 class="empire-card-name">${emp.empireName}</h3>
              <span class="empire-card-owner">Chủ tịch: <b>${emp.username}</b> ${isMine ? '(Đế Chế Của Bạn)' : ''}</span>
            </div>
            <span class="empire-level-pill">LV.${emp.level}</span>
          </div>
          <div class="empire-card-stats">
            <div class="empire-stat-item">💵 Tài sản: <b>$${(emp.money || 0).toLocaleString()}</b></div>
            <div class="empire-stat-item">🪵 Gỗ khai thác: <b>${(emp.totalLogsCut || 0).toLocaleString()}</b></div>
          </div>
          <div class="empire-card-actions">
            ${isMine 
              ? '<button class="empire-btn-mine" disabled>🏠 Đế Chế Hiện Tại</button>' 
              : `<button class="empire-btn-visit" onclick="window.authManager.visitEmpire('${emp.username}')">🚀 Đi Thăm Công Trình</button>`}
          </div>
        `;
        container.appendChild(card);
      });
    } catch (e) {
      container.innerHTML = '<div style="color:#ef4444; padding:20px; text-align:center;">Lỗi khi tải danh sách đế chế: ' + e.message + '</div>';
    }
  }

  async visitEmpire(targetUsername) {
    if (this.isVisiting) {
      showToast('⚠️ Bạn đang ở chế độ tham quan đế chế khác rồi!');
      return;
    }

    try {
      showToast(`🚀 Đang dịch chuyển đến tham quan đế chế của ${targetUsername}...`);
      const res = await fetch(`${API_BASE}/api/empires/view/${targetUsername}`);
      const data = await res.json();

      if (!res.ok || !data.found || !data.empire) {
        showToast('❌ Không thể tải dữ liệu đế chế này!');
        return;
      }

      // Đóng modal
      const modal = document.getElementById('empires-modal');
      if (modal) {
        modal.classList.remove('open');
        modal.classList.remove('active');
      }

      // Sao lưu trạng thái của chính mình
      this.myOwnSavedState = JSON.parse(JSON.stringify(gameState));
      this.isVisiting = true;

      // Áp dụng trạng thái của người bạn này vào world
      const targetState = data.empire;
      Object.assign(gameState, targetState);

      // Hiển thị Banner Tham Quan
      const banner = document.getElementById('visiting-banner');
      const bEmpire = document.getElementById('visiting-empire-name');
      const bOwner = document.getElementById('visiting-owner-name');
      if (banner) banner.style.display = 'flex';
      if (bEmpire) bEmpire.textContent = targetState.empireName || 'Đế Chế Bạn Bè';
      if (bOwner) bOwner.textContent = targetState.username || targetUsername;

      // Cập nhật công trình, rào chắn, bảng hiệu
      if (typeof syncBackpackCapacity === 'function') syncBackpackCapacity();
      if (typeof syncVehiclesWithGameState === 'function') syncVehiclesWithGameState();
      if (typeof updateSectorBarricades === 'function') updateSectorBarricades();
      if (typeof updateHUD === 'function') updateHUD();
      this.update3DSignboards();

      showToast(`👀 Bạn đang tham quan đế chế "${targetState.empireName}" của ${targetUsername}! Hãy dạo một vòng xem các công trình!`);
    } catch (e) {
      showToast('❌ Lỗi khi tham quan: ' + e.message);
    }
  }

  leaveVisit() {
    if (!this.isVisiting || !this.myOwnSavedState) return;

    showToast('🏠 Đang quay trở về đế chế của bạn...');
    this.isVisiting = false;

    // Phục hồi lại dữ liệu đế chế của chính mình
    Object.assign(gameState, this.myOwnSavedState);
    this.myOwnSavedState = null;

    // Ẩn Banner Tham Quan
    const banner = document.getElementById('visiting-banner');
    if (banner) banner.style.display = 'none';

    // Cập nhật lại toàn bộ thế giới
    this.updateHUDAccount();
    if (typeof syncBackpackCapacity === 'function') syncBackpackCapacity();
    if (typeof syncVehiclesWithGameState === 'function') syncVehiclesWithGameState();
    if (typeof updateSectorBarricades === 'function') updateSectorBarricades();
    if (typeof updateHUD === 'function') updateHUD();
    this.update3DSignboards();

    showToast('✅ Đã trở về tổng hành dinh đế chế của bạn!');
  }
}

window.authManager = new AuthManager();

