import { User, Restaurant, MenuItem, Order, OrderStatus, OrderItem, Transaction, TransactionType } from '@/types'

const KEYS = {
  users: 'cd_users',
  restaurants: 'cd_restaurants',
  menu: 'cd_menu',
  orders: 'cd_orders',
  transactions: 'cd_transactions',
  initialized: 'cd_initialized',
}

function get<T>(key: string, fallback: T[]): T[] {
  if (typeof window === 'undefined') return fallback
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try { return JSON.parse(raw) } catch { return fallback }
}

function set<T>(key: string, data: T[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(data))
}

export function initStore() {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(KEYS.initialized)) return
  set(KEYS.users, seedUsers())
  set(KEYS.restaurants, seedRestaurants())
  set(KEYS.menu, seedMenu())
  set(KEYS.orders, [])
  set(KEYS.transactions, [])
  localStorage.setItem(KEYS.initialized, '1')
}

export function resetStore() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEYS.initialized)
  initStore()
}

// === Users ===
export function getUsers(): User[] { return get<User>(KEYS.users, seedUsers()) }
export function getUserById(id: string) { return getUsers().find(u => u.id === id) }
export function getUserByPhone(phone: string) { return getUsers().find(u => u.phone === phone) }
export function addUser(user: User) { const all = getUsers(); all.push(user); set(KEYS.users, all) }
export function updateUser(id: string, patch: Partial<User>) {
  const all = getUsers(); const idx = all.findIndex(u => u.id === id)
  if (idx === -1) return null; all[idx] = { ...all[idx], ...patch }; set(KEYS.users, all); return all[idx]
}

// === Restaurants ===
export function getRestaurants(category?: string, keyword?: string): Restaurant[] {
  let list = get<Restaurant>(KEYS.restaurants, seedRestaurants())
  if (category && category !== '全部') list = list.filter(r => r.category === category)
  if (keyword) list = list.filter(r => r.name.includes(keyword) || r.description.includes(keyword))
  return list
}
export function getRestaurantById(id: string) { return get<Restaurant>(KEYS.restaurants, seedRestaurants()).find(r => r.id === id) }
export function getRestaurantsByOwner(ownerId: string) { return get<Restaurant>(KEYS.restaurants, seedRestaurants()).filter(r => r.ownerId === ownerId) }
export function updateRestaurant(id: string, patch: Partial<Restaurant>) {
  const all = get<Restaurant>(KEYS.restaurants, seedRestaurants()); const idx = all.findIndex(r => r.id === id)
  if (idx === -1) return null; all[idx] = { ...all[idx], ...patch }; set(KEYS.restaurants, all); return all[idx]
}

// === Menu ===
export function getMenuItems(): MenuItem[] { return get<MenuItem>(KEYS.menu, seedMenu()) }
export function getMenuByRestaurant(restaurantId: string) { return getMenuItems().filter(m => m.restaurantId === restaurantId) }
export function getMenuByOwner(ownerId: string) {
  const restIds = new Set(getRestaurantsByOwner(ownerId).map(r => r.id))
  return getMenuItems().filter(m => restIds.has(m.restaurantId))
}
export function getMenuItemById(id: string) { return getMenuItems().find(m => m.id === id) }
export function addMenuItem(item: MenuItem) { const all = getMenuItems(); all.push(item); set(KEYS.menu, all) }
export function updateMenuItem(id: string, patch: Partial<MenuItem>) {
  const all = getMenuItems(); const idx = all.findIndex(m => m.id === id)
  if (idx === -1) return null; all[idx] = { ...all[idx], ...patch }; set(KEYS.menu, all); return all[idx]
}
export function deleteMenuItem(id: string) { set(KEYS.menu, getMenuItems().filter(m => m.id !== id)) }
export function getMenuCategories(restaurantId: string) { return [...new Set(getMenuByRestaurant(restaurantId).map(m => m.category))] }

// === Orders ===
export function getOrders(): Order[] { return get<Order>(KEYS.orders, []) }
export function getOrderById(id: string) { return getOrders().find(o => o.id === id) }
export function getOrdersByStudent(studentId: string) { return getOrders().filter(o => o.studentId === studentId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)) }
export function getOrdersByMerchant(merchantId: string) {
  const restIds = new Set(getRestaurantsByOwner(merchantId).map(r => r.id))
  return getOrders().filter(o => restIds.has(o.restaurantId)).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
}
export function getOrdersByRider(riderId: string) { return getOrders().filter(o => o.riderId === riderId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)) }
export function getAvailableOrders() { return getOrders().filter(o => o.status === 'ready' && !o.riderId) }

export function createOrder(data: {
  studentId: string; studentName: string; studentPhone: string
  restaurantId: string; restaurantName: string
  items: OrderItem[]; deliveryFee: number; address: string; note: string
}): Order {
  const totalPrice = data.items.reduce((s, i) => s + i.price * i.quantity, 0)
  const packingFee = Math.ceil(data.items.length * 0.5)
  const discount = totalPrice >= 30 ? 3 : 0
  const now = new Date().toISOString()
  const order: Order = {
    id: 'ord_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    orderNo: 'CD' + Date.now().toString().slice(-10),
    ...data,
    totalPrice, deliveryFee: data.deliveryFee, packingFee, discount,
    finalPrice: totalPrice + data.deliveryFee + packingFee - discount,
    status: 'pending',
    statusHistory: [{ status: 'pending', time: now }],
    estimatedTime: 30,
    createdAt: now, updatedAt: now,
  }
  const all = getOrders(); all.push(order); set(KEYS.orders, all)
  return order
}

export function updateOrder(id: string, patch: Partial<Order>) {
  const all = getOrders(); const idx = all.findIndex(o => o.id === id)
  if (idx === -1) return null
  const now = new Date().toISOString()
  if (patch.status) {
    patch.statusHistory = [...(all[idx].statusHistory || []), { status: patch.status, time: now }]
  }
  all[idx] = { ...all[idx], ...patch, updatedAt: now }
  set(KEYS.orders, all); return all[idx]
}

// === Transactions ===
export function getTransactions(): Transaction[] { return get<Transaction>(KEYS.transactions, []) }
export function getTransactionsByUser(userId: string) {
  return getTransactions().filter(t => t.userId === userId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
}
export function addTransaction(data: Omit<Transaction, 'id' | 'createdAt'>): Transaction {
  const tx: Transaction = { ...data, id: 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), createdAt: new Date().toISOString() }
  const all = getTransactions(); all.push(tx); set(KEYS.transactions, all); return tx
}

// === Balance Operations ===
export function changeBalance(userId: string, amount: number): number | null {
  const user = getUserById(userId); if (!user) return null
  const newBalance = Math.round((user.balance + amount) * 100) / 100
  updateUser(userId, { balance: newBalance })
  return newBalance
}

export function recharge(userId: string, amount: number): { ok: boolean; error?: string } {
  if (amount <= 0 || amount > 10000) return { ok: false, error: '充值金额需在0-10000之间' }
  const user = getUserById(userId); if (!user) return { ok: false, error: '用户不存在' }
  const newBal = changeBalance(userId, amount)!
  addTransaction({ userId, type: 'recharge', amount, balance: newBal, description: `充值 ¥${amount.toFixed(2)}` })
  return { ok: true }
}

export function withdraw(userId: string, amount: number): { ok: boolean; error?: string } {
  if (amount <= 0) return { ok: false, error: '提现金额需大于0' }
  const user = getUserById(userId); if (!user) return { ok: false, error: '用户不存在' }
  if (user.balance < amount) return { ok: false, error: '余额不足' }
  const newBal = changeBalance(userId, -amount)!
  addTransaction({ userId, type: 'withdraw', amount: -amount, balance: newBal, description: `提现 ¥${amount.toFixed(2)}` })
  return { ok: true }
}

// === Payment: Order Creation with Balance Deduction ===
export function payAndCreateOrder(data: {
  studentId: string; studentName: string; studentPhone: string
  restaurantId: string; restaurantName: string
  items: OrderItem[]; deliveryFee: number; address: string; note: string
}): { ok: boolean; order?: Order; error?: string } {
  const student = getUserById(data.studentId)
  if (!student) return { ok: false, error: '用户不存在' }
  const totalPrice = data.items.reduce((s, i) => s + i.price * i.quantity, 0)
  const packingFee = Math.ceil(data.items.length * 0.5)
  const discount = totalPrice >= 30 ? 3 : 0
  const finalPrice = totalPrice + data.deliveryFee + packingFee - discount
  if (student.balance < finalPrice) return { ok: false, error: `余额不足，需 ¥${finalPrice.toFixed(2)}，当前余额 ¥${student.balance.toFixed(2)}` }
  // Deduct balance
  const newBal = changeBalance(data.studentId, -finalPrice)!
  const order = createOrder(data)
  addTransaction({ userId: data.studentId, type: 'payment', amount: -finalPrice, balance: newBal, orderId: order.id, orderNo: order.orderNo, description: `支付订单 ${order.orderNo} (${data.restaurantName})` })
  return { ok: true, order }
}

// === Settlement: Complete order → pay merchant + rider ===
const PLATFORM_RATE = 0.05 // 5% platform fee
const RIDER_FEE_RATE = 0.8 // rider gets 80% of delivery fee

export function settleOrder(orderId: string): { ok: boolean; error?: string } {
  const order = getOrderById(orderId)
  if (!order) return { ok: false, error: '订单不存在' }
  if (order.status !== 'delivered' && order.status !== 'completed') return { ok: false, error: '订单状态不允许结算' }
  // Check if already settled
  const txs = getTransactions()
  if (txs.some(t => t.orderId === orderId && t.type === 'income')) return { ok: true } // already settled
  // Merchant income: totalPrice - platform fee
  const restaurant = getRestaurantById(order.restaurantId)
  if (restaurant) {
    const platformFee = Math.round(order.totalPrice * PLATFORM_RATE * 100) / 100
    const merchantIncome = Math.round((order.totalPrice - platformFee) * 100) / 100
    const mBal = changeBalance(restaurant.ownerId, merchantIncome)
    if (mBal !== null) addTransaction({ userId: restaurant.ownerId, type: 'income', amount: merchantIncome, balance: mBal, orderId, orderNo: order.orderNo, description: `订单收入 ${order.orderNo} (扣${(PLATFORM_RATE*100).toFixed(0)}%手续费)` })
  }
  // Rider income: delivery fee * rate
  if (order.riderId) {
    const riderIncome = Math.round(order.deliveryFee * RIDER_FEE_RATE * 100) / 100
    const rBal = changeBalance(order.riderId, riderIncome)
    if (rBal !== null) addTransaction({ userId: order.riderId, type: 'income', amount: riderIncome, balance: rBal, orderId, orderNo: order.orderNo, description: `配送收入 ${order.orderNo}` })
  }
  return { ok: true }
}

// === Cancel & Refund ===
export function cancelAndRefund(orderId: string, reason?: string): { ok: boolean; error?: string } {
  const order = getOrderById(orderId)
  if (!order) return { ok: false, error: '订单不存在' }
  if (['completed', 'cancelled'].includes(order.status)) return { ok: false, error: '订单已完成或已取消' }
  // Refund to student
  const newBal = changeBalance(order.studentId, order.finalPrice)
  if (newBal !== null) {
    addTransaction({ userId: order.studentId, type: 'refund', amount: order.finalPrice, balance: newBal, orderId, orderNo: order.orderNo, description: `退款 ${order.orderNo}${reason ? ' (' + reason + ')' : ''}` })
  }
  updateOrder(orderId, { status: 'cancelled' })
  return { ok: true }
}

// === Financial Stats ===
export function getFinancialStats() {
  const txs = getTransactions()
  const totalRecharge = txs.filter(t => t.type === 'recharge').reduce((s, t) => s + t.amount, 0)
  const totalPayment = txs.filter(t => t.type === 'payment').reduce((s, t) => s + Math.abs(t.amount), 0)
  const totalRefund = txs.filter(t => t.type === 'refund').reduce((s, t) => s + t.amount, 0)
  const totalIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalWithdraw = txs.filter(t => t.type === 'withdraw').reduce((s, t) => s + Math.abs(t.amount), 0)
  return { totalRecharge, totalPayment, totalRefund, totalIncome, totalWithdraw, totalTransactions: txs.length }
}

// === Stats ===
export function getStats() {
  const users = getUsers()
  const restaurants = get<Restaurant>(KEYS.restaurants, seedRestaurants())
  const orders = getOrders()
  const totalRevenue = orders.filter(o => o.status === 'completed' || o.status === 'delivered').reduce((s, o) => s + o.finalPrice, 0)
  return {
    totalUsers: users.length,
    totalStudents: users.filter(u => u.role === 'student').length,
    totalMerchants: users.filter(u => u.role === 'merchant').length,
    totalRiders: users.filter(u => u.role === 'rider').length,
    totalRestaurants: restaurants.length,
    totalOrders: orders.length,
    todayOrders: orders.filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString()).length,
    totalRevenue,
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    deliveringOrders: orders.filter(o => o.status === 'delivering').length,
  }
}

// === Auth ===
export function loginUser(phone: string, password: string): { ok: boolean; user?: Omit<User, 'password'>; error?: string } {
  const user = getUserByPhone(phone)
  if (!user) return { ok: false, error: '用户不存在' }
  if (user.password !== password) return { ok: false, error: '密码错误' }
  const { password: _, ...safe } = user
  return { ok: true, user: safe }
}

export function registerUser(data: { name: string; phone: string; password: string; role: string }): { ok: boolean; error?: string } {
  if (!data.name || !data.phone || !data.password) return { ok: false, error: '请填写完整信息' }
  if (getUserByPhone(data.phone)) return { ok: false, error: '手机号已注册' }
  const user: User = {
    id: 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name: data.name, phone: data.phone, password: data.password,
    role: data.role as User['role'],
    balance: data.role === 'merchant' ? 0 : 100,
    createdAt: new Date().toISOString(),
  }
  addUser(user)
  return { ok: true }
}

// === Seed Data ===
function seedUsers(): User[] {
  return [
    { id: 'stu1', name: '张三', phone: '13800001111', role: 'student', password: '123456', address: '明德楼A栋305', balance: 500, createdAt: '2024-01-01T00:00:00Z' },
    { id: 'stu2', name: '李四', phone: '13800002222', role: 'student', password: '123456', address: '博学楼B栋210', balance: 300, createdAt: '2024-01-02T00:00:00Z' },
    { id: 'mer1', name: '黄焖鸡老板', phone: '13900001111', role: 'merchant', password: '123456', address: '食堂一楼A3', balance: 10000, createdAt: '2024-01-01T00:00:00Z' },
    { id: 'mer2', name: '麻辣烫老板', phone: '13900002222', role: 'merchant', password: '123456', address: '食堂二楼B5', balance: 8000, createdAt: '2024-01-01T00:00:00Z' },
    { id: 'mer3', name: '奶茶店老板', phone: '13900003333', role: 'merchant', password: '123456', address: '校园商业街12号', balance: 6000, createdAt: '2024-01-01T00:00:00Z' },
    { id: 'rid1', name: '王骑手', phone: '13700001111', role: 'rider', password: '123456', balance: 2000, createdAt: '2024-01-01T00:00:00Z' },
    { id: 'rid2', name: '赵骑手', phone: '13700002222', role: 'rider', password: '123456', balance: 1500, createdAt: '2024-01-02T00:00:00Z' },
    { id: 'adm1', name: '管理员', phone: '18800001111', role: 'admin', password: 'admin123', balance: 0, createdAt: '2024-01-01T00:00:00Z' },
  ]
}

function seedRestaurants(): Restaurant[] {
  return [
    { id: 'rest1', name: '黄焖鸡米饭', ownerId: 'mer1', description: '正宗黄焖鸡，鲜嫩多汁', image: '🍗', rating: 4.8, ratingCount: 520, category: '中式快餐', address: '食堂一楼A3', openTime: '10:00', closeTime: '21:00', minOrder: 15, deliveryFee: 3, status: 'open', monthSales: 1280 },
    { id: 'rest2', name: '杨国福麻辣烫', ownerId: 'mer2', description: '麻辣鲜香，自选称重', image: '🍲', rating: 4.6, ratingCount: 380, category: '麻辣烫', address: '食堂二楼B5', openTime: '10:30', closeTime: '22:00', minOrder: 20, deliveryFee: 4, status: 'open', monthSales: 960 },
    { id: 'rest3', name: '茶百道奶茶', ownerId: 'mer3', description: '新鲜水果茶，现做现卖', image: '🧋', rating: 4.9, ratingCount: 890, category: '饮品甜点', address: '校园商业街12号', openTime: '09:00', closeTime: '23:00', minOrder: 10, deliveryFee: 2, status: 'open', monthSales: 2100 },
    { id: 'rest4', name: '兰州拉面', ownerId: 'mer1', description: '手工拉面，汤鲜面劲', image: '🍜', rating: 4.5, ratingCount: 290, category: '面食', address: '食堂一楼A7', openTime: '07:00', closeTime: '21:00', minOrder: 12, deliveryFee: 3, status: 'open', monthSales: 780 },
    { id: 'rest5', name: '韩式炸鸡', ownerId: 'mer2', description: '酥脆炸鸡配啤酒', image: '🍗', rating: 4.7, ratingCount: 450, category: '韩式料理', address: '校园商业街8号', openTime: '11:00', closeTime: '23:00', minOrder: 25, deliveryFee: 5, status: 'open', monthSales: 650 },
    { id: 'rest6', name: '沙县小吃', ownerId: 'mer3', description: '实惠好吃的国民小吃', image: '🥟', rating: 4.3, ratingCount: 680, category: '中式快餐', address: '食堂一楼A1', openTime: '06:30', closeTime: '22:00', minOrder: 10, deliveryFee: 2, status: 'open', monthSales: 1850 },
  ]
}

function seedMenu(): MenuItem[] {
  return [
    { id: 'm1', restaurantId: 'rest1', name: '黄焖鸡米饭（大份）', price: 22, originalPrice: 25, description: '鸡腿肉+土豆+青椒+米饭', image: '🍗', category: '招牌', sales: 580, status: 'available' },
    { id: 'm2', restaurantId: 'rest1', name: '黄焖鸡米饭（小份）', price: 16, description: '鸡腿肉+土豆+米饭', image: '🍗', category: '招牌', sales: 320, status: 'available' },
    { id: 'm3', restaurantId: 'rest1', name: '黄焖排骨米饭', price: 24, description: '排骨+土豆+青椒+米饭', image: '🍖', category: '招牌', sales: 210, status: 'available' },
    { id: 'm4', restaurantId: 'rest1', name: '可乐', price: 3, description: '330ml罐装', image: '🥤', category: '饮品', sales: 450, status: 'available' },
    { id: 'm5', restaurantId: 'rest2', name: '麻辣烫（小份）', price: 18, description: '自选蔬菜+粉丝', image: '🍲', category: '招牌', sales: 420, status: 'available' },
    { id: 'm6', restaurantId: 'rest2', name: '麻辣烫（大份）', price: 28, description: '自选蔬菜+肉类+粉丝', image: '🍲', category: '招牌', sales: 380, status: 'available' },
    { id: 'm7', restaurantId: 'rest2', name: '酸辣粉', price: 15, description: '红薯粉+花生+香菜', image: '🍜', category: '粉面', sales: 260, status: 'available' },
    { id: 'm8', restaurantId: 'rest2', name: '凉皮', price: 12, description: '麻酱凉皮+黄瓜丝', image: '🥗', category: '凉菜', sales: 180, status: 'available' },
    { id: 'm9', restaurantId: 'rest3', name: '杨枝甘露', price: 16, originalPrice: 19, description: '芒果+西柚+椰浆', image: '🥭', category: '人气', sales: 890, status: 'available' },
    { id: 'm10', restaurantId: 'rest3', name: '西瓜啵啵', price: 13, description: '鲜榨西瓜+椰果', image: '🍉', category: '水果茶', sales: 650, status: 'available' },
    { id: 'm11', restaurantId: 'rest3', name: '珍珠奶茶', price: 12, description: '红茶+牛奶+珍珠', image: '🧋', category: '经典', sales: 780, status: 'available' },
    { id: 'm12', restaurantId: 'rest3', name: '多肉葡萄', price: 18, description: '鲜葡萄+茉莉绿茶', image: '🍇', category: '人气', sales: 720, status: 'available' },
    { id: 'm13', restaurantId: 'rest4', name: '牛肉拉面', price: 15, description: '手工拉面+牛肉+香菜', image: '🍜', category: '拉面', sales: 390, status: 'available' },
    { id: 'm14', restaurantId: 'rest4', name: '牛肉板面', price: 14, description: '板面+牛肉+辣椒', image: '🍜', category: '拉面', sales: 220, status: 'available' },
    { id: 'm15', restaurantId: 'rest4', name: '鸡蛋', price: 2, description: '卤鸡蛋', image: '🥚', category: '加料', sales: 580, status: 'available' },
    { id: 'm16', restaurantId: 'rest5', name: '原味炸鸡（半只）', price: 29, originalPrice: 35, description: '外酥里嫩原味炸鸡', image: '🍗', category: '炸鸡', sales: 320, status: 'available' },
    { id: 'm17', restaurantId: 'rest5', name: '甜辣炸鸡', price: 32, description: '韩式甜辣酱裹炸鸡', image: '🍗', category: '炸鸡', sales: 280, status: 'available' },
    { id: 'm18', restaurantId: 'rest5', name: '芝士年糕', price: 18, description: '拉丝芝士+韩式年糕', image: '🧀', category: '小食', sales: 190, status: 'available' },
    { id: 'm19', restaurantId: 'rest6', name: '蒸饺（一屉）', price: 8, description: '猪肉蒸饺8个', image: '🥟', category: '主食', sales: 920, status: 'available' },
    { id: 'm20', restaurantId: 'rest6', name: '拌面', price: 7, description: '花生酱拌面', image: '🍝', category: '主食', sales: 850, status: 'available' },
    { id: 'm21', restaurantId: 'rest6', name: '炖汤', price: 10, description: '排骨炖汤/鸡汤', image: '🍲', category: '汤品', sales: 620, status: 'available' },
    { id: 'm22', restaurantId: 'rest6', name: '卤味拼盘', price: 15, description: '卤鸡腿+卤蛋+豆干', image: '🍱', category: '卤味', sales: 380, status: 'available' },
  ]
}
