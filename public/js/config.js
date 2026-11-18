/**
 * Config & State Management
 * Level 1-5 Progression, Upgrade Pads Registry, Mini-Quests & Economic Balancing
 */

const gameState = {
  playerId: "player_01",
  username: "Chủ tịch",
  empireName: "Đế Chế Lâm Nghiệp",
  level: 1,
  money: 0.0,
  gems: 0,
  logs: 0,
  backpackTier: 1,
  backpackMax: 4,
  machineLogBuffer: 0, // Đệm gỗ chờ xẻ thực tế tại máy cưa công nghiệp
  maxMachineBuffer: 30, // Dung tích bãi tập kết gỗ tại đầu nạp máy cưa
  bootsTier: 1,
  plankValueTier: 1,
  autoConveyorTier: 0,
  planks: 0,
  freshFish: 0,
  cannedFish: 0,
  forklifts: 0,
  boats: 0,
  workers: 0, // Hired Lumberjacks
  axeTier: 1, // 1: Stone (4 hits), 2: Iron (2 hits), 3: Titanium (1 hit), 4: Chainsaw (rapid)
  sawmillSpeedTier: 1, // 1x, 2x, 3x
  reforestationLevel: 0,
  supermarketTier: 0,
  unlockedZones: [1],
  buildingStages: {},
  upgradeInvestments: {}, // { [padId]: amountInvested }
  totalLogsCut: 0,
  totalPlanksSawn: 0,
  exportOrders: 0,
  pallets: 0, // Kiện gỗ đóng đai pallet (1 pallet = 5 ván gỗ)
  goldBars: 0, // Thỏi vàng hoàng gia đúc từ Mỏ Vàng ($5,000/thỏi)
  furniture: 0, // Bàn ghế nội thất Bắc Âu ($1,200/bộ)
  containers: 0, // Container xuất khẩu liên ngành ($15,000/cont + 10 Gems)
  woodPellets: 0, // Túi viên nén gỗ ép mùn cưa cho tàu hỏa & năng lượng xanh
  sawdust: 0, // Mùn cưa phụ phẩm từ xẻ gỗ
  researchPoints: 0, // Điểm nghiên cứu R&D (RP)
  researchTechs: {
    redwoodEco: false,
    cargoDrones: false,
    turboEngines: false
  },
  marketState: {
    activeCommodity: null,
    multiplier: 1.0,
    timeLeft: 0,
    headline: 'Thị trường thế giới đang ổn định. Nhu cầu xuất khẩu bình thường.'
  },
  overtimeRush: {
    active: false,
    timer: 0,
    cooldown: 0
  },
  tourismRevenue: 150.0, // Két tiền du lịch thụ động tích lũy tại Resort Maldives
  airFlights: 0, // Số chuyến bay Boeing 747 cất cánh thành công
  resortVisited: false,
  drivableVehicle: null, // null | 'forklift' | 'pickup' | 'speedboat'
  weather: 'sunny', // 'sunny' | 'rain' | 'rainbow'
  weatherTimer: 0,
  achievementsClaimed: {}, // { [id]: boolean }
  characterSkin: 'default', // 'default' | 'golden' | 'cyber' | 'ceo'
  gpsTarget: null, // { x, z, label }
  gameHour: 10.0, // 0.0 - 24.0 (10:00 AM sáng)
  activeContract: null, // Hợp đồng VIP khẩn cấp
  contractCooldown: 30, // giây trước khi có hợp đồng mới
  isDrivingForklift: false, // Trạng thái lái xe nâng của người chơi
  isDrivingPickup: false, // Trạng thái lái xe bán tải
  isDrivingTruck: false, // Trạng thái lái xe tải đầu kéo chở gỗ
  truckCargo: 0, // Số lượng gỗ/pallet trên xe tải (0 - 16)
  truckMaxCargo: 16, // Dung tích thùng xe tải
  truckDeliveries: 0, // Tổng số chuyến hàng giao thành công
  nitroBoostTimer: 0, // Thời gian hiệu ứng tăng tốc Nitro từ trạm xăng
  fishermen: 0, // Ngư dân câu cá & thủy sản tự động
  carpenters: 0, // Thợ mộc chế tác bàn ghế nội thất Bắc Âu
  miners: 0, // Thợ mỏ cuốc quặng & đúc thỏi vàng hoàng gia
  resortStaff: 0, // Nhân viên pha chế & phục vụ Resort Maldives
  airportCrew: 0, // Điều phối viên mặt đất & hàng không SkyCargo
  isDrivingSpeedboat: false, // Trạng thái lái ca nô
  isDrivingHelicopter: false, // Trạng thái lái trực thăng trên không
  isDrivingTrain: false, // Trạng thái lái tàu hỏa hơi nước
  isScubaDiving: false, // Trạng thái lặn biển ngắm san hô & săn kho báu
  hasPet: true, // Chú chó Shiba đồng hành nhặt đồ
  treasuresFound: 0, // Số rương kho báu thuyền đắm đã trục vớt
  trainRides: 0,
  heliFlights: 0,
  stocks: {
    WOOD: { id: 'WOOD', name: 'Lâm Nghiệp Rừng Xanh', icon: '🌲', price: 45.0, history: [40, 42, 45], owned: 0 },
    PORT: { id: 'PORT', name: 'Cảng Biển & Logistics', icon: '⚓', price: 130.0, history: [120, 125, 130], owned: 0 },
    GOLD: { id: 'GOLD', name: 'Mỏ Vàng Hoàng Gia', icon: '🪙', price: 295.0, history: [280, 290, 295], owned: 0 },
    AERO: { id: 'AERO', name: 'Hàng Không SkyCargo', icon: '✈️', price: 580.0, history: [540, 560, 580], owned: 0 }
  },
  stockDividendTimer: 60.0,
  passiveIncome: 0.0,
  // 100-UPGRADE EXPANSION SUITE
  vehicleFuel: 100.0, // 0 - 100% nhiên liệu
  vehicleHealth: 100.0, // 0 - 100% độ bền xe
  playerStamina: 100.0, // 0 - 100% thể lực chạy nước rút
  playerHealth: 100.0, // 0 - 100% sinh lực
  playerOxygen: 100.0, // 0 - 100% dưỡng khí lặn biển
  wantedLevel: 0, // 0 - 5 sao truy nã
  activeWaypoint: null, // { x, z, label }
  bankSavings: 0.0, // Tiền gửi tiết kiệm ngân hàng sinh lời
  bankLoan: 0.0, // Dư nợ vay vốn kinh doanh
  insuranceActive: false, // Bảo hiểm tai nạn & hỏa hoạn
  corporateReputation: 50, // 0 - 100 điểm uy tín doanh nghiệp
  storyChapter: 1, // Tiến độ cốt truyện 1 - 20
  activeStoryQuest: { id: 1, title: 'Bước Đầu Khởi Nghiệp', desc: 'Đốn 15 khúc gỗ thông đầu tiên', progress: 0, target: 15, reward: 250, completed: false },
  dailyQuests: [
    { id: 'daily_1', title: 'Thu hoạch 30 ván gỗ', progress: 0, target: 30, reward: 500, done: false },
    { id: 'daily_2', title: 'Tuần tra đại lộ 500m', progress: 0, target: 500, reward: 400, done: false },
    { id: 'daily_3', title: 'Bắt 1 vụ vi phạm', progress: 0, target: 1, reward: 800, done: false }
  ],
  staffManagers: { foreman: false, engineer: false, accountant: false },
  franchiseStores: 0, // Chuỗi cửa hàng Mini-Mart nhượng quyền
  tycoonRank: 7, // Hạng tỷ phú đảo (1 - 10)
  photoModeActive: false, // Chế độ chụp ảnh điện ảnh
  graphicsQuality: 'high', // 'low' | 'medium' | 'high' | 'ultra'
  isDrifting: false, // Trạng thái drift phanh tay
  currentVehicleGear: 2, // 1: Low (kéo nặng), 2: Normal, 3: High
  isFishing: false, // Trạng thái câu cá thủ công
  fishBiteTimer: 0,
  isDrivingBus: false, // Xe buýt công cộng 2 tầng
  isDrivingTaxi: false, // Xe taxi vàng
  isDrivingBike: false, // Moto thể thao
  isDrivingBicycle: false, // Xe đạp địa hình
  busPassengers: 0, // Số khách đi xe buýt
  taxiFareActive: false, // Chuyến taxi đang chạy
  taxiTimer: 0,
  lastLogout: Date.now(),
  updatedAt: null
};

// ---------------------------------------------------------------------------
// TIERS & PROGRESSION DICTIONARIES
// ---------------------------------------------------------------------------
const BACKPACK_TIERS = {
  1: { cap: 4, cost: 0, reqLevel: 1, title: "Balo Vải Thô Sơ", desc: "Chứa tối đa 4 khúc gỗ", icon: "🎒" },
  2: { cap: 8, cost: 150, reqLevel: 1, title: "Balo Khung Thép", desc: "Chứa tối đa 8 khúc gỗ (gấp 2)", icon: "🧰" },
  3: { cap: 12, cost: 400, reqLevel: 1, title: "Balo Dã Ngoại Trợ Lực", desc: "Chứa tối đa 12 khúc gỗ", icon: "🎒" },
  4: { cap: 18, cost: 900, reqLevel: 2, title: "Khung Giá Đỡ Công Nghiệp", desc: "Chứa tối đa 18 khúc gỗ", icon: "🧳" },
  5: { cap: 26, cost: 1800, reqLevel: 2, title: "Gùi Chở Gỗ Trợ Lực", desc: "Chứa tối đa 26 khúc gỗ", icon: "🦾" },
  6: { cap: 36, cost: 3600, reqLevel: 3, title: "Khung Thép Thủy Lực", desc: "Chứa tối đa 36 khúc gỗ", icon: "⚙️" },
  7: { cap: 50, cost: 7500, reqLevel: 3, title: "Bộ Khung Exoskeleton Hạng Nặng", desc: "Chứa tối đa 50 khúc gỗ", icon: "🦾" },
  8: { cap: 70, cost: 15000, reqLevel: 4, title: "Balo Phản Lực Titan", desc: "Chứa tối đa 70 khúc gỗ", icon: "🚀" },
  9: { cap: 100, cost: 30000, reqLevel: 5, title: "Khung Trợ Lực Tycoon Vô Cực", desc: "Chứa tối đa 100 khúc gỗ khổng lồ!", icon: "👑" }
};

function getBackpackConfig(tier) {
  if (BACKPACK_TIERS[tier]) return BACKPACK_TIERS[tier];
  const cap = 100 + (tier - 9) * 25;
  const cost = Math.floor(30000 * Math.pow(1.65, tier - 9));
  const reqLevel = 5;
  return {
    cap,
    cost,
    reqLevel,
    title: `Balo Siêu Cấp Bậc ${tier}`,
    desc: `Chứa tối đa ${cap} khúc gỗ (Nâng cấp không giới hạn)`,
    icon: "🌟"
  };
}

const BOOTS_TIERS = {
  1: { speedMul: 1.0, cost: 0, title: "Giày Vải Lao Động", desc: "Tốc độ chạy cơ bản 100%", icon: "👟" },
  2: { speedMul: 1.25, cost: 150, title: "Ủng Da Chống Trượt", desc: "Tăng +25% tốc độ chạy", icon: "🥾" },
  3: { speedMul: 1.55, cost: 450, title: "Giày Bảo Hộ Trợ Lực", desc: "Tăng +55% tốc độ chạy", icon: "⚡" },
  4: { speedMul: 1.90, cost: 1200, title: "Giày Phản Lực Tycoon", desc: "Tăng +90% tốc độ chạy thần tốc!", icon: "🚀" }
};

const AXE_TIERS = {
  1: { hits: 4, cost: 0, title: "Rìu Đá Thô Sơ", desc: "Cần 4 nhát đốn ngã 1 cây thông", icon: "🪓" },
  2: { hits: 2, cost: 80, title: "Rìu Sắt Tôi Cứng", desc: "Chỉ cần 2 nhát đốn ngã cây", icon: "🪓" },
  3: { hits: 1, cost: 260, title: "Rìu Titan Siêu Bén", desc: "Chỉ 1 nhát đốn gục tức thì", icon: "⚔️" },
  4: { hits: 1, cost: 750, title: "Máy Cưa Xích Cầm Tay", desc: "Đốn cây siêu tốc tự động", icon: "⚙️" }
};

const PLANK_VALUE_TIERS = {
  1: { value: 20, cost: 0, title: "Ván Gỗ Mộc", desc: "Bán $20 / thanh ván", icon: "🪵" },
  2: { value: 30, cost: 220, title: "Ván Bào Mịn 4 Mặt", desc: "Bán $30 / thanh ván (+50%)", icon: "✨" },
  3: { value: 45, cost: 650, title: "Ván Sấy Khô Công Nghiệp", desc: "Bán $45 / thanh ván (+125%)", icon: "🏭" },
  4: { value: 70, cost: 1600, title: "Ván Phủ Melamine Xuất Khẩu", desc: "Bán $70 / thanh ván (+250%)", icon: "👑" }
};

const AUTO_CONVEYOR_TIERS = {
  0: { rate: 0, cost: 250, title: "Chưa mở khóa", desc: "Cần công nhân hoặc người chơi nạp vào phễu đệm máy", icon: "🔒" },
  1: { rate: 1, cost: 250, title: "Con Lăn Tự Động Cấp 1", desc: "Tự động rút gỗ từ đệm xẻ 1 gỗ / 2.5s", icon: "⚙️" },
  2: { rate: 2, cost: 750, title: "Băng Con Lăn Cao Tốc", desc: "Tự động rút gỗ từ đệm xẻ 2 gỗ / 1.8s", icon: "⏩" },
  3: { rate: 3, cost: 2000, title: "Hệ Thống Nạp Xẻ Thủy Lực", desc: "Tự động xẻ 3 gỗ / 1.2s liên tục từ bãi đệm!", icon: "⚡" }
};

function getPlankValue() {
  const tier = gameState.plankValueTier || 1;
  const base = PLANK_VALUE_TIERS[tier] ? PLANK_VALUE_TIERS[tier].value : 20;
  const seasonMult = (gameState.currentSeason === 'winter') ? 3.0 : 1.0;
  return Math.floor(base * seasonMult);
}

function syncBackpackCapacity() {
  const tier = gameState.backpackTier || 1;
  const cfg = getBackpackConfig(tier);
  gameState.backpackMax = cfg.cap;
}

// Level Progression Milestones (Thử thách hấp dẫn, yêu cầu phối hợp sản xuất chuỗi giá trị)
const LEVEL_CONFIGS = {
  1: {
    tag: "LV.1 THỦ CÔNG",
    desc: "Đốn 35 cây | Xẻ 25 ván | Nạp 10 gỗ máy | Kiếm $500",
    reqLogs: 35,
    reqPlanks: 25,
    reqMoney: 500,
    title: "KỶ NGUYÊN CƠ GIỚI HÓA (CẤP 2)",
    unlockMsg: "Đã mở khóa Máy Cưa Công Nghiệp Lộ Thiên, Thợ Khiêng Gỗ & Đội Xe Tải!"
  },
  2: {
    tag: "LV.2 CƠ GIỚI HÓA",
    desc: "Xẻ 120 ván | Xuất 5 chuyến xe tải | Kiếm $3.000",
    reqPlanks: 120,
    reqExport: 5,
    reqMoney: 3000,
    title: "KỶ NGUYÊN LOGISTICS & ĐỘI XE TẢI (CẤP 3)",
    unlockMsg: "Đã mở khóa Đoàn Xe Tải Xếp Hàng, Xe Nâng Tự Động & Thợ Vận Hành Chuyên Nghiệp!"
  },
  3: {
    tag: "LV.3 LOGISTICS",
    desc: "Xuất 20 chuyến xe | Thuê 2 công nhân | Kiếm $12.000",
    reqExport: 20,
    reqWorkers: 2,
    reqMoney: 12000,
    title: "KỶ NGUYÊN THỦY SẢN & BẾN CẢNG (CẤP 4)",
    unlockMsg: "Đã mở khóa Cầu Tàu Biển, Đội Thuyền Đánh Cá & Dây Chuyền Cá Hộp!"
  },
  4: {
    tag: "LV.4 BẾN CẢNG",
    desc: "Đóng 50 hộp cá | Xuất 45 chuyến xe | Kiếm $40.000",
    reqCanned: 50,
    reqExport: 45,
    reqMoney: 40000,
    title: "TẬP ĐOÀN ĐA NGÀNH & SIÊU THỊ (CẤP 5)",
    unlockMsg: "Đã mở khóa Đại Siêu Thị Quốc Tế & Đội Xe Vận Tải Toàn Cầu!"
  },
  5: {
    tag: "LV.5 TẬP ĐOÀN",
    desc: "Vận hành siêu thị, đoàn xe tải & thu nhập thụ động khủng",
    reqMoney: 150000,
    title: "ÔNG TRÙM ĐẾ CHẾ TOÀN DIỆN",
    unlockMsg: "Bạn đã xây dựng đế chế Gỗ - Logistics - Siêu Thị hùng mạnh bậc nhất thế giới!"
  }
};

// Mini-Quest Chain with Instant Rewards
const QUEST_CHAIN = [
  { id: 1, text: "Đốn 4 khúc gỗ đầu tiên", targetKey: 'totalLogsCut', targetVal: 4, reward: 30 },
  { id: 2, text: "Xẻ 4 ván tại Bàn Cưa Tay", targetKey: 'totalPlanksSawn', targetVal: 4, reward: 50 },
  { id: 3, text: "Kiếm $100 đầu tiên từ bán ván", targetKey: 'money', targetVal: 100, reward: 60 },
  { id: 4, text: "Nâng cấp Rìu Sắt (Chặt 2 nhát)", targetKey: 'axeTier', targetVal: 2, reward: 120 },
  { id: 5, text: "Thuê Thợ Rừng tự động", targetKey: 'workers', targetVal: 1, reward: 150 },
  { id: 6, text: "Đạt Cấp 2 Cơ Giới Hóa", targetKey: 'level', targetVal: 2, reward: 300 },
  { id: 7, text: "Mua Xe Nâng Hàng đầu tiên", targetKey: 'forklifts', targetVal: 1, reward: 250 },
  { id: 8, text: "Đạt Cấp 3 Logistics Xe Nâng", targetKey: 'level', targetVal: 3, reward: 500 },
  { id: 9, text: "Mở khóa Thuyền Đánh Cá sông", targetKey: 'boats', targetVal: 1, reward: 600 },
  { id: 10, text: "Vận hành Siêu Thị Cấp 5", targetKey: 'supermarketTier', targetVal: 1, reward: 1000 }
];

// Arcade Buy / Upgrade Pads Registry
const UPGRADE_PADS_CONFIG = {
  // Khu Rừng trong đất liền
  'pad_axe': {
    id: 'pad_axe',
    name: 'XƯỞNG RÌU (TOOL SHED)',
    desc: 'Giảm số nhát chặt cây (4 -> 2 -> 1)',
    pos: { x: -20, y: 0, z: -25.5 },
    radius: 1.25,
    basePrice: 80,
    maxLevel: 4,
    color: '#f59e0b',
    icon: '🪓'
  },
  'pad_lumberjack': {
    id: 'pad_lumberjack',
    name: 'LÁN THỢ RỪNG',
    desc: 'Thuê Thợ đốn củi tự động chặt & gom gỗ',
    pos: { x: -36, y: 0, z: -18 },
    radius: 1.25,
    basePrice: 150,
    maxLevel: 5,
    color: '#10b981',
    icon: '👷'
  },
  'pad_reforest': {
    id: 'pad_reforest',
    name: 'TRẠM ƯƠM GIỐNG',
    desc: 'Tăng tốc độ cây con lớn nhanh gấp đôi',
    pos: { x: -36, y: 0, z: -26 },
    radius: 1.25,
    basePrice: 120,
    maxLevel: 3,
    color: '#22c55e',
    icon: '🌱'
  },
  // Khu Xưởng Cưa trong đất liền
  'pad_sawmill_speed': {
    id: 'pad_sawmill_speed',
    name: 'NÂNG CẤP MÁY CƯA',
    desc: 'Xẻ gỗ nhanh x2 & tăng tốc băng chuyền',
    pos: { x: 0, y: 0, z: -14 },
    radius: 1.25,
    basePrice: 200,
    maxLevel: 4,
    color: '#ef4444',
    icon: '⚙️'
  },
  'pad_forklift': {
    id: 'pad_forklift',
    name: 'GARA XE NÂNG',
    desc: 'Mua Xe Nâng tự động vận chuyển pallet',
    pos: { x: 12, y: 0, z: -14 },
    radius: 1.25,
    basePrice: 300,
    maxLevel: 4,
    color: '#facc15',
    icon: '🚜'
  },
  // Khu Bến Cảng & Siêu Thị
  'pad_boat': {
    id: 'pad_boat',
    name: 'XÂY CẦU TÀU & THUYỀN CÁ',
    desc: 'Đánh bắt cá tươi tự động trên sông',
    pos: { x: 20, y: 0, z: 8 },
    radius: 1.25,
    basePrice: 500,
    maxLevel: 3,
    color: '#0284c7',
    icon: '⛵'
  },
  'pad_supermarket': {
    id: 'pad_supermarket',
    name: 'ĐẠI SIÊU THỊ BÁN LẺ',
    desc: 'Mở rộng quầy kệ & thu hút khách NPC',
    pos: { x: 8, y: 0, z: 28 },
    radius: 1.25,
    basePrice: 1000,
    maxLevel: 3,
    color: '#ec4899',
    icon: '🛒'
  }
};

function getPadCurrentCost(padId) {
  const pad = UPGRADE_PADS_CONFIG[padId];
  if (!pad) return 999999;
  let level = 0;
  if (padId === 'pad_axe') level = gameState.axeTier - 1;
  else if (padId === 'pad_lumberjack') level = gameState.workers;
  else if (padId === 'pad_reforest') level = gameState.reforestationLevel;
  else if (padId === 'pad_sawmill_speed') level = gameState.sawmillSpeedTier - 1;
  else if (padId === 'pad_forklift') level = gameState.forklifts;
  else if (padId === 'pad_boat') level = gameState.boats;
  else if (padId === 'pad_supermarket') level = gameState.supermarketTier;

  return Math.floor(pad.basePrice * Math.pow(1.45, level));
}

function formatCurrency(num) {
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}k`;
  return `$${Math.floor(num)}`;
}

// ---------------------------------------------------------------------------
// ALL-IN-ONE EMPIRE UPGRADE HQ & SHOP CATALOG
// ---------------------------------------------------------------------------
const EMPIRE_SHOP_TABS = [
  { id: 'tab_player', name: '🪓 Balo & Cá Nhân', icon: '🎒' },
  { id: 'tab_sawmill', name: '⚙️ Máy Móc Xưởng Cưa', icon: '🏭' },
  { id: 'tab_workers', name: '👷 Đội Ngũ Nhân Lực', icon: '👷' },
  { id: 'tab_expansion', name: '⛵ Thủy Sản & Bán Lẻ', icon: '🛒' }
];

const EMPIRE_SHOP_ITEMS = {
  // Tab 1: Cá Nhân & Balo
  'backpack': {
    id: 'backpack',
    tab: 'tab_player',
    name: 'Dung Tích Balo Gỗ (Vô Hạn)',
    icon: '🎒',
    color: '#38bdf8',
    maxLevel: 99,
    getCurrentLevel: () => gameState.backpackTier || 1,
    getNextCost: () => {
      const nextTier = (gameState.backpackTier || 1) + 1;
      const nextCfg = getBackpackConfig(nextTier);
      return nextCfg.cost;
    },
    getCurrentDesc: () => {
      const cur = gameState.backpackTier || 1;
      const cfg = getBackpackConfig(cur);
      return `${cfg.title}: Sức chứa hiện tại ${cfg.cap} khúc gỗ`;
    },
    getNextBenefit: () => {
      const nextTier = (gameState.backpackTier || 1) + 1;
      const nextCfg = getBackpackConfig(nextTier);
      if (gameState.level < nextCfg.reqLevel) {
        return `<span style="color:#f87171; font-weight:800;">🔒 Yêu cầu Cấp ${nextCfg.reqLevel}</span> (Lên ${nextCfg.cap} khúc)`;
      }
      return `Mở rộng lên chứa ${nextCfg.cap} khúc gỗ!`;
    },
    canUpgradeNow: () => {
      const nextTier = (gameState.backpackTier || 1) + 1;
      const nextCfg = getBackpackConfig(nextTier);
      return gameState.level >= nextCfg.reqLevel;
    },
    onUpgrade: () => {
      const nextTier = (gameState.backpackTier || 1) + 1;
      const nextCfg = getBackpackConfig(nextTier);
      if (gameState.level < nextCfg.reqLevel) {
        if (typeof showToast === 'function') {
          showToast(`🔒 Cần đạt Cấp ${nextCfg.reqLevel} để mở rộng balo cấp này!`);
        }
        return false;
      }
      gameState.backpackTier = nextTier;
      syncBackpackCapacity();
      if (window.player) {
        if (typeof window.player.expandBackpackMeshCapacity === 'function') {
          window.player.expandBackpackMeshCapacity(gameState.backpackMax);
        }
        window.player.updateLogStack(gameState.logs);
      }
      return true;
    }
  },
  'axe': {
    id: 'axe',
    tab: 'tab_player',
    name: 'Rìu Đốn Củi',
    icon: '🪓',
    color: '#f59e0b',
    maxLevel: 4,
    getCurrentLevel: () => gameState.axeTier || 1,
    getNextCost: () => {
      const cur = gameState.axeTier || 1;
      return cur < 4 ? AXE_TIERS[cur + 1].cost : null;
    },
    getCurrentDesc: () => {
      const cur = gameState.axeTier || 1;
      return `${AXE_TIERS[cur].title}: ${AXE_TIERS[cur].desc}`;
    },
    getNextBenefit: () => {
      const cur = gameState.axeTier || 1;
      return cur < 4 ? `Giảm còn ${AXE_TIERS[cur + 1].hits} nhát chặt` : 'ĐÃ ĐẠT TỐI ĐA!';
    },
    onUpgrade: () => {
      gameState.axeTier = (gameState.axeTier || 1) + 1;
    }
  },
  'boots': {
    id: 'boots',
    tab: 'tab_player',
    name: 'Giày Lao Động Tăng Tốc',
    icon: '⚡',
    color: '#10b981',
    maxLevel: 4,
    getCurrentLevel: () => gameState.bootsTier || 1,
    getNextCost: () => {
      const cur = gameState.bootsTier || 1;
      return cur < 4 ? BOOTS_TIERS[cur + 1].cost : null;
    },
    getCurrentDesc: () => {
      const cur = gameState.bootsTier || 1;
      return `${BOOTS_TIERS[cur].title}: ${BOOTS_TIERS[cur].desc}`;
    },
    getNextBenefit: () => {
      const cur = gameState.bootsTier || 1;
      return cur < 4 ? `Tốc độ lên x${BOOTS_TIERS[cur + 1].speedMul}` : 'ĐÃ ĐẠT TỐI ĐA!';
    },
    onUpgrade: () => {
      gameState.bootsTier = (gameState.bootsTier || 1) + 1;
    }
  },

  // Tab 2: Máy Móc Xưởng Cưa
  'sawmill_speed': {
    id: 'sawmill_speed',
    tab: 'tab_sawmill',
    name: 'Tốc Độ Máy Cưa Trung Tâm',
    icon: '⚙️',
    color: '#ef4444',
    maxLevel: 4,
    getCurrentLevel: () => gameState.sawmillSpeedTier || 1,
    getNextCost: () => {
      const cur = gameState.sawmillSpeedTier || 1;
      return cur < 4 ? Math.floor(200 * Math.pow(1.5, cur - 1)) : null;
    },
    getCurrentDesc: () => `Tốc độ hiện tại: x${gameState.sawmillSpeedTier || 1}`,
    getNextBenefit: () => {
      const cur = gameState.sawmillSpeedTier || 1;
      return cur < 4 ? `Tăng tốc độ xẻ gỗ lên x${cur + 1}` : 'ĐÃ ĐẠT TỐI ĐA!';
    },
    onUpgrade: () => {
      gameState.sawmillSpeedTier = (gameState.sawmillSpeedTier || 1) + 1;
    }
  },
  'auto_conveyor': {
    id: 'auto_conveyor',
    tab: 'tab_sawmill',
    name: 'Băng Chuyền Nạp Gỗ Tự Động',
    icon: '⏩',
    color: '#0284c7',
    maxLevel: 3,
    getCurrentLevel: () => gameState.autoConveyorTier || 0,
    getNextCost: () => {
      const cur = gameState.autoConveyorTier || 0;
      return cur < 3 ? AUTO_CONVEYOR_TIERS[cur + 1].cost : null;
    },
    getCurrentDesc: () => {
      const cur = gameState.autoConveyorTier || 0;
      return `${AUTO_CONVEYOR_TIERS[cur].title}: ${AUTO_CONVEYOR_TIERS[cur].desc}`;
    },
    getNextBenefit: () => {
      const cur = gameState.autoConveyorTier || 0;
      return cur < 3 ? `${AUTO_CONVEYOR_TIERS[cur + 1].desc}` : 'ĐÃ ĐẠT TỐI ĐA!';
    },
    onUpgrade: () => {
      gameState.autoConveyorTier = (gameState.autoConveyorTier || 0) + 1;
    }
  },
  'plank_value': {
    id: 'plank_value',
    tab: 'tab_sawmill',
    name: 'Quy Chuẩn Chế Biến & Giá Ván Gỗ',
    icon: '💵',
    color: '#22c55e',
    maxLevel: 4,
    getCurrentLevel: () => gameState.plankValueTier || 1,
    getNextCost: () => {
      const cur = gameState.plankValueTier || 1;
      return cur < 4 ? PLANK_VALUE_TIERS[cur + 1].cost : null;
    },
    getCurrentDesc: () => {
      const cur = gameState.plankValueTier || 1;
      return `${PLANK_VALUE_TIERS[cur].title}: ${PLANK_VALUE_TIERS[cur].desc}`;
    },
    getNextBenefit: () => {
      const cur = gameState.plankValueTier || 1;
      return cur < 4 ? `Giá bán tăng lên $${PLANK_VALUE_TIERS[cur + 1].value}/ván!` : 'ĐÃ ĐẠT TỐI ĐA!';
    },
    onUpgrade: () => {
      gameState.plankValueTier = (gameState.plankValueTier || 1) + 1;
      if (window.sellTag) {
        window.sellTag.material.map = makeBillboardText(`💰 THU MUA VÁN GỖ - $${getPlankValue()}/ván`, '#4ade80').material.map;
      }
    }
  },

  // Tab 3: Đội Ngũ Nhân Lực
  'lumberjack': {
    id: 'lumberjack',
    tab: 'tab_workers',
    name: 'Thợ Đốn Củi Rừng',
    icon: '🌲',
    color: '#10b981',
    maxLevel: 5,
    getCurrentLevel: () => gameState.workers || 0,
    getNextCost: () => {
      const cur = gameState.workers || 0;
      return cur < 5 ? Math.floor(150 * Math.pow(1.45, cur)) : null;
    },
    getCurrentDesc: () => `Đang có: ${gameState.workers || 0} thợ đốn củi trong rừng (Tổng công trường: ${(gameState.workers || 0) + 3} nhân công)`,
    getNextBenefit: () => {
      const cur = gameState.workers || 0;
      return cur < 5 ? `Thuê thêm thợ đốn củi thứ ${cur + 1} trong rừng` : 'ĐÃ ĐẠT TỐI ĐA (5/5)!';
    },
    onUpgrade: () => {
      gameState.workers = (gameState.workers || 0) + 1;
      if (window.syncVehiclesWithGameState) window.syncVehiclesWithGameState();
    }
  },
  'reforest': {
    id: 'reforest',
    tab: 'tab_workers',
    name: 'Trạm Ươm Giống Tái Sinh Rừng',
    icon: '🌱',
    color: '#84cc16',
    maxLevel: 3,
    getCurrentLevel: () => gameState.reforestationLevel || 0,
    getNextCost: () => {
      const cur = gameState.reforestationLevel || 0;
      return cur < 3 ? Math.floor(120 * Math.pow(1.5, cur)) : null;
    },
    getCurrentDesc: () => `Cấp trạm ươm: ${gameState.reforestationLevel || 0}/3`,
    getNextBenefit: () => {
      const cur = gameState.reforestationLevel || 0;
      return cur < 3 ? `Rừng mọc lại nhanh hơn gấp 2 lần` : 'ĐÃ ĐẠT TỐI ĐA!';
    },
    onUpgrade: () => {
      gameState.reforestationLevel = (gameState.reforestationLevel || 0) + 1;
    }
  },
  'forklift': {
    id: 'forklift',
    tab: 'tab_workers',
    name: 'Xe Nâng Hàng Tự Động',
    icon: '🚜',
    color: '#facc15',
    maxLevel: 4,
    getCurrentLevel: () => gameState.forklifts || 0,
    getNextCost: () => {
      const cur = gameState.forklifts || 0;
      return cur < 4 ? Math.floor(300 * Math.pow(1.45, cur)) : null;
    },
    getCurrentDesc: () => `Đang có: ${gameState.forklifts || 0} xe nâng chạy`,
    getNextBenefit: () => {
      const cur = gameState.forklifts || 0;
      return cur < 4 ? `Mua thêm xe nâng thứ ${cur + 1} chuyên chở ra xe tải` : 'ĐÃ ĐẠT TỐI ĐA!';
    },
    onUpgrade: () => {
      gameState.forklifts = (gameState.forklifts || 0) + 1;
      if (window.spawnForkliftAgent) window.spawnForkliftAgent();
    }
  },
  'fisherman': {
    id: 'fisherman',
    tab: 'tab_workers',
    name: 'Ngư Dân Đánh Cá Bến Tàu',
    icon: '🎣',
    color: '#0284c7',
    maxLevel: 4,
    getCurrentLevel: () => gameState.fishermen || 0,
    getNextCost: () => {
      const cur = gameState.fishermen || 0;
      return cur < 4 ? Math.floor(250 * Math.pow(1.5, cur)) : null;
    },
    getCurrentDesc: () => `Đang có: ${gameState.fishermen || 0} ngư dân câu cá trên sông (+$35/s mỗi thợ)`,
    getNextBenefit: () => {
      const cur = gameState.fishermen || 0;
      return cur < 4 ? `Thuê thêm ngư dân thứ ${cur + 1} câu cá & thu hoạch thủy sản tự động` : 'ĐÃ ĐẠT TỐI ĐA (4/4)!';
    },
    onUpgrade: () => {
      gameState.fishermen = (gameState.fishermen || 0) + 1;
      if (window.syncVehiclesWithGameState) window.syncVehiclesWithGameState();
    }
  },
  'carpenter': {
    id: 'carpenter',
    tab: 'tab_workers',
    name: 'Thợ Mộc Xưởng Nội Thất',
    icon: '🪑',
    color: '#f97316',
    maxLevel: 4,
    getCurrentLevel: () => gameState.carpenters || 0,
    getNextCost: () => {
      const cur = gameState.carpenters || 0;
      return cur < 4 ? Math.floor(450 * Math.pow(1.55, cur)) : null;
    },
    getCurrentDesc: () => `Đang có: ${gameState.carpenters || 0} thợ mộc đóng bàn ghế (+$75/s mỗi thợ)`,
    getNextBenefit: () => {
      const cur = gameState.carpenters || 0;
      return cur < 4 ? `Thuê thêm thợ mộc thứ ${cur + 1} gia công bàn ghế Bắc Âu tự động` : 'ĐÃ ĐẠT TỐI ĐA (4/4)!';
    },
    onUpgrade: () => {
      gameState.carpenters = (gameState.carpenters || 0) + 1;
      if (window.syncVehiclesWithGameState) window.syncVehiclesWithGameState();
    }
  },
  'miner': {
    id: 'miner',
    tab: 'tab_workers',
    name: 'Thợ Mỏ & Đúc Vàng Hoàng Gia',
    icon: '🪙',
    color: '#eab308',
    maxLevel: 4,
    getCurrentLevel: () => gameState.miners || 0,
    getNextCost: () => {
      const cur = gameState.miners || 0;
      return cur < 4 ? Math.floor(750 * Math.pow(1.6, cur)) : null;
    },
    getCurrentDesc: () => `Đang có: ${gameState.miners || 0} thợ mỏ khai khoáng & đúc vàng (+$150/s mỗi thợ)`,
    getNextBenefit: () => {
      const cur = gameState.miners || 0;
      return cur < 4 ? `Thuê thêm thợ mỏ thứ ${cur + 1} đào quặng & đúc Thỏi Vàng tự động` : 'ĐÃ ĐẠT TỐI ĐA (4/4)!';
    },
    onUpgrade: () => {
      gameState.miners = (gameState.miners || 0) + 1;
      if (window.syncVehiclesWithGameState) window.syncVehiclesWithGameState();
    }
  },
  'resortStaff': {
    id: 'resortStaff',
    tab: 'tab_workers',
    name: 'Nhân Viên Pha Chế Resort Maldives',
    icon: '🍹',
    color: '#06b6d4',
    maxLevel: 4,
    getCurrentLevel: () => gameState.resortStaff || 0,
    getNextCost: () => {
      const cur = gameState.resortStaff || 0;
      return cur < 4 ? Math.floor(600 * Math.pow(1.5, cur)) : null;
    },
    getCurrentDesc: () => `Đang có: ${gameState.resortStaff || 0} nhân viên resort phục vụ khách (+$120/s mỗi thợ)`,
    getNextBenefit: () => {
      const cur = gameState.resortStaff || 0;
      return cur < 4 ? `Thuê thêm nhân viên thứ ${cur + 1} pha cocktail & chăm sóc khách du lịch` : 'ĐÃ ĐẠT TỐI ĐA (4/4)!';
    },
    onUpgrade: () => {
      gameState.resortStaff = (gameState.resortStaff || 0) + 1;
      if (window.syncVehiclesWithGameState) window.syncVehiclesWithGameState();
    }
  },
  'airportCrew': {
    id: 'airportCrew',
    tab: 'tab_workers',
    name: 'Điều Phối Viên Sân Bay SkyCargo',
    icon: '✈️',
    color: '#8b5cf6',
    maxLevel: 4,
    getCurrentLevel: () => gameState.airportCrew || 0,
    getNextCost: () => {
      const cur = gameState.airportCrew || 0;
      return cur < 4 ? Math.floor(900 * Math.pow(1.65, cur)) : null;
    },
    getCurrentDesc: () => `Đang có: ${gameState.airportCrew || 0} điều phối viên sân bay (+$220/s mỗi thợ)`,
    getNextBenefit: () => {
      const cur = gameState.airportCrew || 0;
      return cur < 4 ? `Thuê thêm điều phối viên thứ ${cur + 1} dẫn hướng bay & bốc xếp Boeing 747` : 'ĐÃ ĐẠT TỐI ĐA (4/4)!';
    },
    onUpgrade: () => {
      gameState.airportCrew = (gameState.airportCrew || 0) + 1;
      if (window.syncVehiclesWithGameState) window.syncVehiclesWithGameState();
    }
  },

  // Tab 4: Thủy Sản & Bán Lẻ
  'boat': {
    id: 'boat',
    tab: 'tab_expansion',
    name: 'Cầu Tàu & Thuyền Đánh Cá Sông',
    icon: '⛵',
    color: '#0284c7',
    maxLevel: 3,
    getCurrentLevel: () => gameState.boats || 0,
    getNextCost: () => {
      const cur = gameState.boats || 0;
      return cur < 3 ? Math.floor(500 * Math.pow(1.5, cur)) : null;
    },
    getCurrentDesc: () => `Đang có: ${gameState.boats || 0} thuyền đánh cá sông`,
    getNextBenefit: () => {
      const cur = gameState.boats || 0;
      return cur < 3 ? `Thêm thuyền cá đánh bắt tự động trên sông` : 'ĐÃ ĐẠT TỐI ĐA!';
    },
    onUpgrade: () => {
      gameState.boats = (gameState.boats || 0) + 1;
    }
  },
  'supermarket': {
    id: 'supermarket',
    tab: 'tab_expansion',
    name: 'Đại Siêu Thị Khách NPC',
    icon: '🛒',
    color: '#ec4899',
    maxLevel: 3,
    getCurrentLevel: () => gameState.supermarketTier || 0,
    getNextCost: () => {
      const cur = gameState.supermarketTier || 0;
      return cur < 3 ? Math.floor(1000 * Math.pow(1.6, cur)) : null;
    },
    getCurrentDesc: () => `Cấp siêu thị: ${gameState.supermarketTier || 0}/3`,
    getNextBenefit: () => {
      const cur = gameState.supermarketTier || 0;
      return cur < 3 ? `Mở rộng quầy kệ & tăng +$12/s thu nhập thụ động` : 'ĐÃ ĐẠT TỐI ĐA!';
    },
    onUpgrade: () => {
      gameState.supermarketTier = (gameState.supermarketTier || 0) + 1;
    }
  }
};

// ---------------------------------------------------------------------------
// HỆ THỐNG THÀNH TỰU ĐẾ CHẾ (TROPHY ACHIEVEMENTS)
// ---------------------------------------------------------------------------
const ACHIEVEMENT_DEFINITIONS = [
  { id: 'cut_20', title: 'Tiều Phu Khởi Nghiệp', desc: 'Đốn hạ 20 cây thông rừng', icon: '🪓', reward: 1000, isDone: (s) => (s.totalLogsCut || 0) >= 20 },
  { id: 'saw_50', title: 'Thợ Xẻ Bậc Thầy', desc: 'Xẻ 50 thanh ván gỗ công nghiệp', icon: '🪵', reward: 2500, isDone: (s) => (s.totalPlanksSawn || 0) >= 50 },
  { id: 'export_10', title: 'Vua Logistics Cầu Vượt', desc: 'Xuất khẩu 10 chuyến xe tải', icon: '🚛', reward: 6000, isDone: (s) => (s.exportOrders || 0) >= 10 },
  { id: 'fish_25', title: 'Ngư Phủ Biển Sâu', desc: 'Chế biến 25 hộp cá xuất khẩu', icon: '🥫', reward: 10000, isDone: (s) => (s.cannedFish || 0) >= 25 },
  { id: 'furn_5', title: 'Nghệ Nhân Bắc Âu', desc: 'Gia công 5 bộ bàn ghế cao cấp', icon: '🪑', reward: 15000, isDone: (s) => (s.furniture || 0) >= 5 },
  { id: 'gold_3', title: 'Vua Mỏ Vàng Hoàng Gia', desc: 'Đúc 3 thỏi vàng nguyên chất', icon: '🪙', reward: 25000, isDone: (s) => (s.goldBars || 0) >= 3 },
  { id: 'flight_1', title: 'Tỷ Phú Hàng Không Boeing 747', desc: 'Cất cánh 1 chuyến bay xuất khẩu', icon: '✈️', reward: 35000, isDone: (s) => (s.airFlights || 0) >= 1 },
  { id: 'resort_1', title: 'Chúa Đảo Maldives', desc: 'Thu hoạch tiền két du lịch resort', icon: '🏖️', reward: 50000, isDone: (s) => (s.resortVisited || false) },
  { id: 'train_ride', title: 'Thuyền Trưởng Đường Sắt', desc: 'Lái đầu máy xe lửa hơi nước qua cầu', icon: '🚂', reward: 40000, isDone: (s) => (s.trainRides || 0) >= 1 },
  { id: 'heli_pilot', title: 'Phi Công Trực Thăng VIP', desc: 'Bay lượn trên bầu trời ngắm đế chế', icon: '🚁', reward: 45000, isDone: (s) => (s.heliFlights || 0) >= 1 },
  { id: 'scuba_treasure', title: 'Thợ Lặn Kho Báu Maldives', desc: 'Khám phá rương kho báu thuyền đắm', icon: '🤿', reward: 60000, isDone: (s) => (s.treasuresFound || 0) >= 1 },
  { id: 'stock_trader', title: 'Sói Già Phố Wall Tycoon', desc: 'Sở hữu cổ phiếu đế chế sinh lời', icon: '📈', reward: 75000, isDone: (s) => Object.values(s.stocks || {}).some(st => st.owned > 0) }
];

// ---------------------------------------------------------------------------
// TÙY BIẾN TRANG PHỤC NHÂN VẬT (CHARACTER SKINS)
// ---------------------------------------------------------------------------
const CHARACTER_SKINS = {
  'default': { id: 'default', name: 'Thợ Rừng Tiêu Chuẩn', color: 0xea580c, hatColor: 0x1e293b, icon: '👷' },
  'golden': { id: 'golden', name: 'Giáp Vàng Hoàng Gia', color: 0xfacc15, hatColor: 0xf59e0b, icon: '👑' },
  'cyber': { id: 'cyber', name: 'Cyberpunk Neon', color: 0x06b6d4, hatColor: 0x3b82f6, icon: '⚡' },
  'ceo': { id: 'ceo', name: 'Doanh Nhân VIP Tycoon', color: 0x0f172a, hatColor: 0xdc2626, icon: '👔' }
};

// ---------------------------------------------------------------------------
// VIỆN NGHIÊN CỨU CÔNG NGHỆ & CÂY KỸ NĂNG (R&D TECH TREE CONFIG)
// ---------------------------------------------------------------------------
const TECH_TREE_CONFIG = {
  redwoodEco: {
    id: 'redwoodEco',
    name: 'Lâm Nghiệp Sinh Thái Gỗ Đỏ',
    costRP: 25,
    costMoney: 5000,
    desc: '20% cây rừng tái sinh thành Cổ Thụ Gỗ Đỏ Redwood, sản lượng x2 (4 khúc gỗ) và thưởng thêm +3 RP!',
    icon: '🌲'
  },
  cargoDrones: {
    id: 'cargoDrones',
    name: 'Drone Hậu Cần Thông Minh',
    costRP: 40,
    costMoney: 12000,
    desc: 'Biệt đội Drone AI tự động vận chuyển hàng từ Xưởng cưa ra Cảng biển, sinh lợi thụ động +$250/chuyến!',
    icon: '🛸'
  },
  turboEngines: {
    id: 'turboEngines',
    name: 'Động Cơ Thủy Lực Turbo',
    costRP: 35,
    costMoney: 8000,
    desc: 'Tăng vĩnh viễn +40% tốc độ cho Xe Nâng (Forklift) và Xe Bán Tải!',
    icon: '⚡'
  }
};

// ---------------------------------------------------------------------------
// THỊ TRƯỜNG BIẾN ĐỘNG CUNG - CẦU THỜI GIAN THỰC (MARKET COMMODITIES)
// ---------------------------------------------------------------------------
const MARKET_COMMODITIES = {
  planks: {
    name: 'Ván Gỗ Công Nghiệp',
    icon: '🪵',
    multiplier: 2.5,
    headline: '🚨 KHỦNG HOẢNG NGUYÊN LIỆU TOÀN CẦU: Giá ván gỗ xuất khẩu tăng vọt x2.5!'
  },
  pallets: {
    name: 'Kiện Gỗ Pallet',
    icon: '📦',
    multiplier: 3.0,
    headline: '🚨 CẢNG CONTAINER TẮC NGHẼN: Nhu cầu pallet gỗ đóng hàng tăng chóng mặt x3.0!'
  },
  cannedFish: {
    name: 'Cá Hộp Đại Dương',
    icon: '🥫',
    multiplier: 3.5,
    headline: '🚨 DỰ TRỮ LƯƠNG THỰC KHẨN CẤP: Cá hộp biển sâu cháy hàng, giá x3.5!'
  },
  goldBars: {
    name: 'Thỏi Vàng Hoàng Gia',
    icon: '🪙',
    multiplier: 3.0,
    headline: '🚨 GIÁ VÀNG THẾ GIỚI PHÁ ĐỈNH: Các quỹ đầu tư thu mua thỏi vàng x3.0!'
  }
};

// Safe fallback stubs for storage and saves to guarantee 0 runtime crashes
window.triggerActionSave = window.triggerActionSave || function() {};
window.executeSave = window.executeSave || function() {};
window.loadGame = window.loadGame || function() {};

// =========================================================================
// GIAI ĐOẠN 1: CẤU HÌNH HỆ SINH THÁI, ĐỘNG VẬT & VẬT LÝ TƯƠNG TÁC (MỤC 1 - 60)
// =========================================================================
window.wildlifeDeerHerd = window.wildlifeDeerHerd || [];
window.wildlifeRabbits = window.wildlifeRabbits || [];
window.wildlifeWhales = window.wildlifeWhales || [];
window.wildlifeSeagulls = window.wildlifeSeagulls || [];
window.wildlifeCrabs = window.wildlifeCrabs || [];
window.volumetricClouds = window.volumetricClouds || [];
window.screenTremor = 0.0;
window.inMudBog = false;
window.waterDragActive = false;
window.playerBackpackWeight = 0.0;
window.vehiclePayloadWeight = 0.0;
