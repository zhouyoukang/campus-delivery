'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useApp } from '@/context/AppContext'
import { useRouter } from 'next/navigation'
import { Order, MenuItem, Restaurant, Transaction, OrderStatus, ORDER_STATUS_MAP, ORDER_STATUS_COLOR } from '@/types'
import * as db from '@/lib/store'

// ==================== HEARING: Sound Engine ====================
let _ctx: AudioContext | null = null
let _audioWarmedUp = false
function ac() { if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); if (_ctx.state === 'suspended') _ctx.resume(); return _ctx }
function warmUpAudio() {
  if (_audioWarmedUp) return; _audioWarmedUp = true
  try { const c = ac(); const o = c.createOscillator(); const g = c.createGain(); o.connect(g); g.connect(c.destination); g.gain.value = 0; o.start(); o.stop(c.currentTime + 0.01) } catch {}
}
function tone(f: number, d: number, v = 0.5, t: OscillatorType = 'square') {
  try { const c = ac(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = f; o.type = t; g.gain.setValueAtTime(v, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d); o.start(); o.stop(c.currentTime + d) } catch {}
}
function alarmBurst() {
  tone(800, 0.15, 0.7); setTimeout(() => tone(1050, 0.15, 0.8), 180); setTimeout(() => tone(1350, 0.25, 0.9), 360)
  try { navigator.vibrate?.([300, 100, 300, 100, 500]) } catch {}
}
function actionDing() {
  tone(523, 0.08, 0.3, 'sine'); setTimeout(() => tone(784, 0.15, 0.4, 'sine'), 100)
  try { navigator.vibrate?.([40]) } catch {}
}
function tryNotify(title: string, body: string) {
  try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body, tag: 'mo' }) } catch {}
}

// ==================== VISION: Constants & Urgency ====================
const NEXT_ACT: Partial<Record<OrderStatus, { status: OrderStatus; label: string; color: string }>> = {
  pending: { status: 'accepted', label: '✅ 接单', color: 'bg-green-500' },
  accepted: { status: 'preparing', label: '🔥 开始制作', color: 'bg-purple-500' },
  preparing: { status: 'ready', label: '🍽️ 出餐完成', color: 'bg-blue-500' },
}
const STEPS: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready', 'delivering', 'delivered']
const URG = { caution: 3, warn: 5, danger: 10 } // minutes

function urgencyBorder(t: string) {
  const m = (Date.now() - new Date(t).getTime()) / 60000
  if (m >= URG.danger) return 'border-red-500 bg-red-50 shadow-red-200 shadow-lg ring-2 ring-red-400'
  if (m >= URG.warn) return 'border-orange-400 bg-orange-50/50 shadow-orange-100 shadow-md'
  if (m >= URG.caution) return 'border-yellow-300 bg-yellow-50/30'
  return 'border-gray-100 bg-white shadow-sm'
}

// ==================== VISION: Live Timer ====================
function LiveTimer({ t, size = 'sm' }: { t: string; size?: 'sm' | 'lg' | 'xl' }) {
  const [, tick] = useState(0)
  useEffect(() => { const i = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(i) }, [])
  const sec = Math.floor((Date.now() - new Date(t).getTime()) / 1000)
  const m = Math.floor(sec / 60), s = sec % 60
  const cls = m >= URG.danger ? 'text-red-600 animate-pulse' : m >= URG.warn ? 'text-red-500' : m >= URG.caution ? 'text-orange-500' : 'text-emerald-600'
  const sz = size === 'xl' ? 'text-5xl' : size === 'lg' ? 'text-3xl' : 'text-base'
  return <span className={`font-mono font-black tabular-nums ${cls} ${sz}`}>{m}:{s.toString().padStart(2, '0')}</span>
}

// ==================== TOUCH + VISION: Order Card ====================
function OrderCard({ order, onAction, onReject }: {
  order: Order; onAction: (id: string, s: OrderStatus) => void; onReject: (id: string) => void
}) {
  const next = NEXT_ACT[order.status]
  const isPending = order.status === 'pending'
  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all ${isPending ? urgencyBorder(order.createdAt) : 'border-gray-100 bg-white shadow-sm'}`}>
      {/* Header: order# + LIVE timer */}
      <div className={`px-4 py-3 flex items-center justify-between ${isPending ? 'bg-red-500 text-white' : 'bg-gray-50'}`}>
        <div className="flex items-center gap-2">
          {isPending && <span className="w-3 h-3 bg-white rounded-full animate-ping" />}
          <span className="text-sm font-mono font-black">#{order.orderNo}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${isPending ? 'bg-white/20' : ORDER_STATUS_COLOR[order.status]}`}>{ORDER_STATUS_MAP[order.status]}</span>
        </div>
        <LiveTimer t={order.createdAt} />
      </div>

      {/* Progress dots */}
      {!['cancelled', 'completed'].includes(order.status) && (
        <div className="px-4 py-1.5 flex items-center gap-1">
          {STEPS.map((s, i) => {
            const si = STEPS.indexOf(order.status); const done = i <= si; const active = i === si
            return (<div key={s} className="flex items-center flex-1">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${done ? 'bg-blue-500' : 'bg-gray-200'} ${active ? 'ring-2 ring-blue-300 ring-offset-1' : ''}`} />
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${done && i < si ? 'bg-blue-500' : 'bg-gray-200'}`} />}
            </div>)
          })}
        </div>
      )}

      {/* Customer + total */}
      <div className="px-4 py-2 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">{order.studentName[0]}</span>
            <span className="font-medium">{order.studentName}</span>
            <a href={`tel:${order.studentPhone}`} className="text-blue-500 underline text-sm">{order.studentPhone}</a>
          </div>
          <span className="text-xl font-black text-orange-600">¥{order.finalPrice.toFixed(0)}</span>
        </div>
        <div className="text-xs text-gray-400 mt-1">📍 {order.address}</div>
      </div>

      {/* Items */}
      <div className="px-4 py-2">
        {order.items.map((it, i) => (
          <div key={i} className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-lg">{it.image}</span>
              <span className="font-medium">{it.name}</span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">x{it.quantity}</span>
            </div>
            <span className="text-gray-600">¥{(it.price * it.quantity).toFixed(0)}</span>
          </div>
        ))}
      </div>

      {/* Note - prominent */}
      {order.note && (
        <div className="mx-4 mb-2 text-sm text-orange-700 bg-orange-50 border-2 border-orange-300 p-2.5 rounded-xl font-medium">
          ⚠️ {order.note}
        </div>
      )}

      {/* LARGE action buttons (min 56px touch target) */}
      {next && (
        <div className="px-4 py-3 flex gap-2">
          <button onClick={() => { onAction(order.id, next.status); actionDing() }}
            className={`flex-1 ${next.color} text-white rounded-2xl min-h-[56px] text-lg font-black active:scale-[0.97] transition-transform shadow-md`}>
            {next.label}
          </button>
          {isPending && (
            <button onClick={() => onReject(order.id)}
              className="w-24 bg-gray-200 text-gray-600 rounded-2xl min-h-[56px] text-base font-bold active:scale-[0.97] transition-transform">
              拒单
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function EditItemModal({ item, onSave, onClose, restaurants }: {
  item: MenuItem; onSave: (id: string, patch: Partial<MenuItem>) => void; onClose: () => void; restaurants: Restaurant[]
}) {
  const [form, setForm] = useState({ name: item.name, price: String(item.price), description: item.description, image: item.image, category: item.category, restaurantId: item.restaurantId })
  const emojis = ['🍱','🍗','🍜','🍲','🥤','🧋','🍖','🥟','🍝','🥗','🧀','🥚','🍇','🥭','🍉','🍰','🌮','🥩','🍕','🍔']
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 space-y-3 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">编辑菜品</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">✕</button>
        </div>
        <select className="input-field" value={form.restaurantId} onChange={e => setForm(p => ({ ...p, restaurantId: e.target.value }))}>
          {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <input className="input-field" placeholder="菜品名称" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <div className="flex gap-2">
          <input className="input-field flex-1" type="number" step="0.01" placeholder="价格" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
          <input className="input-field flex-1" placeholder="分类" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} />
        </div>
        <input className="input-field" placeholder="描述" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        <div>
          <p className="text-xs text-gray-400 mb-1">选择图标</p>
          <div className="flex flex-wrap gap-2">
            {emojis.map(e => (
              <button key={e} onClick={() => setForm(p => ({ ...p, image: e }))}
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${form.image === e ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-gray-50'}`}>{e}</button>
            ))}
          </div>
        </div>
        <button onClick={() => { onSave(item.id, { name: form.name, price: parseFloat(form.price) || item.price, description: form.description, image: form.image, category: form.category, restaurantId: form.restaurantId }); onClose() }}
          className="w-full bg-blue-500 text-white rounded-xl py-3 font-bold active:scale-95 transition-transform">保存</button>
      </div>
    </div>
  )
}

function EditShopModal({ shop, onSave, onClose }: {
  shop: Restaurant; onSave: (id: string, patch: Partial<Restaurant>) => void; onClose: () => void
}) {
  const [form, setForm] = useState({ name: shop.name, description: shop.description, address: shop.address, openTime: shop.openTime, closeTime: shop.closeTime, minOrder: String(shop.minOrder), deliveryFee: String(shop.deliveryFee), category: shop.category })
  const emojis = ['🍗','🍲','🧋','🍜','🥟','🍕','🍔','🌮','🥩','🍰','🥗','🍱']
  const [image, setImage] = useState(shop.image)
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 space-y-3 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">编辑店铺</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">✕</button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-wrap gap-1">
            {emojis.map(e => (
              <button key={e} onClick={() => setImage(e)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${image === e ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-gray-50'}`}>{e}</button>
            ))}
          </div>
        </div>
        <input className="input-field" placeholder="店铺名称" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <input className="input-field" placeholder="店铺描述" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        <input className="input-field" placeholder="地址" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
        <input className="input-field" placeholder="分类 (如: 中式快餐)" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400">开始营业</label>
            <input type="time" className="input-field" value={form.openTime} onChange={e => setForm(p => ({ ...p, openTime: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-400">结束营业</label>
            <input type="time" className="input-field" value={form.closeTime} onChange={e => setForm(p => ({ ...p, closeTime: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400">起送价 (¥)</label>
            <input type="number" className="input-field" value={form.minOrder} onChange={e => setForm(p => ({ ...p, minOrder: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-400">配送费 (¥)</label>
            <input type="number" className="input-field" value={form.deliveryFee} onChange={e => setForm(p => ({ ...p, deliveryFee: e.target.value }))} />
          </div>
        </div>
        <button onClick={() => {
          onSave(shop.id, { name: form.name, description: form.description, address: form.address, openTime: form.openTime, closeTime: form.closeTime, minOrder: parseFloat(form.minOrder) || shop.minOrder, deliveryFee: parseFloat(form.deliveryFee) || shop.deliveryFee, category: form.category, image })
          onClose()
        }} className="w-full bg-blue-500 text-white rounded-xl py-3 font-bold active:scale-95 transition-transform">保存</button>
      </div>
    </div>
  )
}

// ==================== Main Merchant Page ====================
export default function MerchantPage() {
  const { user, logout, loading: appLoading } = useApp()
  const router = useRouter()
  const [tab, setTab] = useState<'orders' | 'menu' | 'shop' | 'finance' | 'stats'>('orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [txs, setTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  // Order sub-state
  const [orderTab, setOrderTab] = useState<'pending' | 'active' | 'history'>('pending')
  const prevPendingCount = useRef(0)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Menu sub-state
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [menuCat, setMenuCat] = useState('全部')
  const [menuRestFilter, setMenuRestFilter] = useState('all')
  const [newItem, setNewItem] = useState({ name: '', price: '', description: '', image: '🍱', category: '招牌', restaurantId: '' })

  // Shop sub-state
  const [editingShop, setEditingShop] = useState<Restaurant | null>(null)

  // Finance sub-state
  const [withdrawAmt, setWithdrawAmt] = useState('')
  const [showWithdraw, setShowWithdraw] = useState(false)

  // === SENSORY ANCHORS ===
  const [kitchenMode, setKitchenMode] = useState(false)
  const [kitchenIdx, setKitchenIdx] = useState(0)
  const [fullscreenAlert, setFullscreenAlert] = useState<Order | null>(null)
  const fullscreenAlertRef = useRef<Order | null>(null)
  const [actionFeedback, setActionFeedback] = useState('')
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [formErr, setFormErr] = useState('')
  const alarmLoopRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wakeLockRef = useRef<any>(null)
  const origTitle = useRef('校园外卖 - 校园美食一键送达')

  const loadData = useCallback(() => {
    if (!user) return
    setLoading(true)
    setOrders(db.getOrdersByMerchant(user.id))
    setMenuItems(db.getMenuByOwner(user.id))
    setRestaurants(db.getRestaurantsByOwner(user.id))
    setTxs(db.getTransactionsByUser(user.id))
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (appLoading) return
    if (!user || user.role !== 'merchant') { router.push('/'); return }
    loadData()
    // Request notification permission + warm up audio on first click
    try { if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission() } catch {}
    const warmHandler = () => { warmUpAudio(); document.removeEventListener('click', warmHandler) }
    document.addEventListener('click', warmHandler)
    return () => document.removeEventListener('click', warmHandler)
  }, [user, appLoading, loadData, router])

  // HEARING: Persistent alarm loop - rings every 3s while pending orders exist
  useEffect(() => {
    const pending = orders.filter(o => o.status === 'pending').length
    if (pending > 0 && autoRefresh) {
      if (!alarmLoopRef.current) {
        alarmBurst() // immediate first ring
        alarmLoopRef.current = setInterval(alarmBurst, 3000)
      }
    } else {
      if (alarmLoopRef.current) { clearInterval(alarmLoopRef.current); alarmLoopRef.current = null }
    }
    return () => { if (alarmLoopRef.current) { clearInterval(alarmLoopRef.current); alarmLoopRef.current = null } }
  }, [orders, autoRefresh])

  // VISION: Title bar flash when pending > 0
  useEffect(() => {
    const pending = orders.filter(o => o.status === 'pending').length
    if (pending === 0) { document.title = origTitle.current; return }
    let on = true
    const t = setInterval(() => {
      document.title = on ? `🔴 ${pending}个新订单!` : origTitle.current
      on = !on
    }, 800)
    return () => { clearInterval(t); document.title = origTitle.current }
  }, [orders])

  // PROPRIOCEPTION: Wake lock - keep screen on
  useEffect(() => {
    let lock: any = null
    const req = async () => { try { lock = await (navigator as any).wakeLock?.request('screen'); wakeLockRef.current = lock } catch {} }
    req()
    const onVis = () => { if (document.visibilityState === 'visible') req() }
    document.addEventListener('visibilitychange', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); try { lock?.release() } catch {} }
  }, [])

  // Auto-refresh every 4s + detect new orders → fullscreen alert + notification
  useEffect(() => {
    if (!user || !autoRefresh) return
    const timer = setInterval(() => {
      const fresh = db.getOrdersByMerchant(user.id)
      const newPending = fresh.filter(o => o.status === 'pending').length
      if (newPending > prevPendingCount.current && prevPendingCount.current >= 0) {
        // New order arrived!
        const newest = fresh.filter(o => o.status === 'pending').sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]
        if (newest && !fullscreenAlertRef.current) { fullscreenAlertRef.current = newest; setFullscreenAlert(newest) }
        tryNotify('🔔 新订单!', `${newest?.studentName} - ¥${newest?.finalPrice.toFixed(0)}`)
        if (tab !== 'orders') setTab('orders')
        if (orderTab !== 'pending') setOrderTab('pending')
      }
      prevPendingCount.current = newPending
      setOrders(fresh)
      setTxs(db.getTransactionsByUser(user.id))
    }, 4000)
    return () => clearInterval(timer)
  }, [user, autoRefresh, tab, orderTab])

  // Auto-dismiss fullscreen alert if order is no longer pending
  useEffect(() => {
    if (!fullscreenAlert) return
    const check = setInterval(() => {
      const o = db.getOrderById(fullscreenAlert.id)
      if (!o || o.status !== 'pending') {
        fullscreenAlertRef.current = null
        setFullscreenAlert(null)
      }
    }, 2000)
    return () => clearInterval(check)
  }, [fullscreenAlert])

  // Action feedback auto-clear
  useEffect(() => {
    if (!actionFeedback) return
    const t = setTimeout(() => setActionFeedback(''), 1500)
    return () => clearTimeout(t)
  }, [actionFeedback])

  const handleOrderAction = (orderId: string, status: OrderStatus) => {
    db.updateOrder(orderId, { status })
    loadData()
  }

  const handleReject = (orderId: string) => {
    setRejectConfirmId(orderId)
  }
  const confirmReject = () => {
    if (!rejectConfirmId) return
    db.cancelAndRefund(rejectConfirmId, '商家拒单')
    setRejectConfirmId(null)
    setActionFeedback('❌ 已拒单')
    loadData()
  }

  const handleWithdraw = () => {
    setFormErr('')
    const amt = parseFloat(withdrawAmt)
    if (!amt || amt <= 0) { setFormErr('请输入有效金额'); return }
    const res = db.withdraw(user!.id, amt)
    if (res.ok) { setShowWithdraw(false); setWithdrawAmt(''); setFormErr(''); loadData() }
    else setFormErr(res.error || '提现失败')
  }

  const toggleItemStatus = (item: MenuItem) => {
    db.updateMenuItem(item.id, { status: item.status === 'available' ? 'soldout' : 'available' })
    loadData()
  }

  const batchToggle = (status: 'available' | 'soldout') => {
    const filtered = getFilteredMenu()
    filtered.forEach(item => db.updateMenuItem(item.id, { status }))
    loadData()
  }

  const deleteItem = (id: string) => {
    setDeleteConfirmId(id)
  }
  const confirmDelete = () => {
    if (!deleteConfirmId) return
    db.deleteMenuItem(deleteConfirmId)
    setDeleteConfirmId(null)
    setActionFeedback('🗑️ 已删除')
    loadData()
  }

  const saveItem = (id: string, patch: Partial<MenuItem>) => {
    db.updateMenuItem(id, patch)
    loadData()
  }

  const addNewItem = () => {
    if (!newItem.name || !newItem.price || !newItem.restaurantId) { setFormErr('请填写完整信息'); return }
    setFormErr('')
    db.addMenuItem({ id: 'mi_' + Date.now(), name: newItem.name, price: parseFloat(newItem.price), description: newItem.description, image: newItem.image, category: newItem.category, restaurantId: newItem.restaurantId, sales: 0, status: 'available' })
    setShowAddForm(false)
    setNewItem({ name: '', price: '', description: '', image: '🍱', category: '招牌', restaurantId: '' })
    loadData()
  }

  const toggleShopStatus = (shop: Restaurant) => {
    db.updateRestaurant(shop.id, { status: shop.status === 'open' ? 'closed' : 'open' })
    loadData()
  }

  const saveShop = (id: string, patch: Partial<Restaurant>) => {
    db.updateRestaurant(id, patch)
    loadData()
  }

  if (appLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-gray-400">加载中...</div></div>
  if (!user) return null

  const pendingOrders = orders.filter(o => o.status === 'pending')
  const activeOrders = orders.filter(o => ['accepted', 'preparing', 'ready'].includes(o.status))
  const historyOrders = orders.filter(o => ['delivering', 'delivered', 'completed', 'cancelled'].includes(o.status))
  const freshUser = db.getUserById(user.id)
  const totalIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalWithdrawn = txs.filter(t => t.type === 'withdraw').reduce((s, t) => s + Math.abs(t.amount), 0)
  const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString())
  const todayIncome = txs.filter(t => t.type === 'income' && new Date(t.createdAt).toDateString() === new Date().toDateString()).reduce((s, t) => s + t.amount, 0)
  const completedOrders = orders.filter(o => ['delivered', 'completed'].includes(o.status))
  const avgPrice = completedOrders.length > 0 ? completedOrders.reduce((s, o) => s + o.finalPrice, 0) / completedOrders.length : 0
  const menuCategories = ['全部', ...new Set(menuItems.map(m => m.category))]

  const getFilteredMenu = () => {
    let list = menuItems
    if (menuRestFilter !== 'all') list = list.filter(m => m.restaurantId === menuRestFilter)
    if (menuCat !== '全部') list = list.filter(m => m.category === menuCat)
    return list
  }

  // Get daily stats for last 7 days
  const dailyStats = (() => {
    const days: { label: string; orders: number; income: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ds = d.toDateString()
      const dayLabel = `${d.getMonth() + 1}/${d.getDate()}`
      const dayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === ds)
      const dayIncome = txs.filter(t => t.type === 'income' && new Date(t.createdAt).toDateString() === ds).reduce((s, t) => s + t.amount, 0)
      days.push({ label: dayLabel, orders: dayOrders.length, income: dayIncome })
    }
    return days
  })()

  const topItems = [...menuItems].sort((a, b) => b.sales - a.sales).slice(0, 5)
  const maxSales = Math.max(...topItems.map(i => i.sales), 1)

  return (
    <div className="page-container pb-20">
      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 px-4 pt-6 pb-4 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl backdrop-blur-sm">👨‍🍳</div>
            <div>
              <h1 className="text-white text-lg font-bold">{user.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${restaurants.some(r => r.status === 'open') ? 'bg-green-400' : 'bg-gray-400'}`} />
                <span className="text-white/60 text-xs">{restaurants.filter(r => r.status === 'open').length}/{restaurants.length} 店营业中</span>
                {autoRefresh && <span className="text-green-300 text-xs">● 自动刷新</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => { setKitchenMode(true); setKitchenIdx(0) }}
              className="text-xs px-2.5 py-1.5 rounded-full bg-black/30 text-white font-bold backdrop-blur-sm active:scale-95 transition-transform">
              🍳 厨房
            </button>
            <button onClick={() => setAutoRefresh(!autoRefresh)}
              className={`text-xs px-2.5 py-1.5 rounded-full ${autoRefresh ? 'bg-green-400/30 text-green-200' : 'bg-white/10 text-white/50'}`}>
              {autoRefresh ? '🔔' : '🔕'}
            </button>
            <button onClick={() => { logout(); router.push('/') }} className="text-white/50 text-xs">退出</button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white/10 rounded-xl p-2.5 text-center backdrop-blur-sm" onClick={() => { setTab('orders'); setOrderTab('pending') }}>
            <div className="text-white text-xl font-bold">{pendingOrders.length}</div>
            <div className="text-white/60 text-[10px] mt-0.5">新订单</div>
            {pendingOrders.length > 0 && <div className="w-1.5 h-1.5 bg-red-400 rounded-full mx-auto mt-1 animate-ping" />}
          </div>
          <div className="bg-white/10 rounded-xl p-2.5 text-center backdrop-blur-sm">
            <div className="text-white text-xl font-bold">{activeOrders.length}</div>
            <div className="text-white/60 text-[10px] mt-0.5">进行中</div>
          </div>
          <div className="bg-white/10 rounded-xl p-2.5 text-center backdrop-blur-sm">
            <div className="text-yellow-300 text-xl font-bold">{todayOrders.length}</div>
            <div className="text-white/60 text-[10px] mt-0.5">今日单</div>
          </div>
          <div className="bg-white/10 rounded-xl p-2.5 text-center backdrop-blur-sm">
            <div className="text-green-300 text-xl font-bold">¥{freshUser ? freshUser.balance.toFixed(0) : 0}</div>
            <div className="text-white/60 text-[10px] mt-0.5">余额</div>
          </div>
        </div>
      </div>

      {/* ===== TAB BAR ===== */}
      <div className="flex px-2 mt-2 gap-1">
        {([
          { key: 'orders', icon: '📋', label: '订单', badge: pendingOrders.length },
          { key: 'menu', icon: '🍴', label: '菜单', badge: 0 },
          { key: 'shop', icon: '🏪', label: '店铺', badge: 0 },
          { key: 'finance', icon: '💰', label: '财务', badge: 0 },
          { key: 'stats', icon: '📊', label: '数据', badge: 0 },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex-1 py-2.5 text-xs font-medium rounded-xl transition-all relative ${tab === t.key ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-400'}`}>
            <span className="block text-base">{t.icon}</span>
            {t.label}
            {t.badge ? <span className="absolute -top-0.5 right-1/4 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {loading ? <div className="p-8 text-center text-gray-400 animate-pulse">加载中...</div> : (
        <div className="px-3 py-3 space-y-3">

          {/* ===== ORDERS TAB ===== */}
          {tab === 'orders' && (
            <>
              {/* Order sub-tabs */}
              <div className="flex gap-2">
                {([
                  { key: 'pending', label: `新订单(${pendingOrders.length})`, color: pendingOrders.length > 0 ? 'bg-red-500 text-white' : '' },
                  { key: 'active', label: `进行中(${activeOrders.length})`, color: '' },
                  { key: 'history', label: `历史(${historyOrders.length})`, color: '' },
                ] as const).map(t => (
                  <button key={t.key} onClick={() => setOrderTab(t.key as any)}
                    className={`flex-1 py-2 text-xs font-medium rounded-xl transition-all ${orderTab === t.key ? (t.color || 'bg-blue-500 text-white') : 'bg-gray-100 text-gray-500'}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Order list */}
              {orderTab === 'pending' && (pendingOrders.length === 0 ? (
                <div className="text-center py-16 text-gray-300">
                  <div className="text-5xl mb-3">✅</div>
                  <p className="text-sm">暂无待处理订单</p>
                  <p className="text-xs text-gray-300 mt-1">新订单将自动弹出提醒</p>
                </div>
              ) : pendingOrders.map(o => <OrderCard key={o.id} order={o} onAction={handleOrderAction} onReject={handleReject} />))}

              {orderTab === 'active' && (activeOrders.length === 0 ? (
                <div className="text-center py-16 text-gray-300">
                  <div className="text-5xl mb-3">🍳</div><p className="text-sm">暂无进行中订单</p>
                </div>
              ) : activeOrders.map(o => <OrderCard key={o.id} order={o} onAction={handleOrderAction} onReject={handleReject} />))}

              {orderTab === 'history' && (historyOrders.length === 0 ? (
                <div className="text-center py-16 text-gray-300">
                  <div className="text-5xl mb-3">📜</div><p className="text-sm">暂无历史订单</p>
                </div>
              ) : historyOrders.slice(0, 20).map(o => (
                <div key={o.id} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-gray-400">#{o.orderNo}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ORDER_STATUS_COLOR[o.status]}`}>{ORDER_STATUS_MAP[o.status]}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm">{o.items.map(i => i.name).join('、').slice(0, 25)}{o.items.map(i => i.name).join('、').length > 25 ? '...' : ''}</div>
                    <span className="font-bold text-sm">¥{o.finalPrice.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{new Date(o.createdAt).toLocaleString('zh-CN')}</div>
                </div>
              )))}

              <button onClick={loadData} className="w-full py-2.5 text-sm text-blue-500 bg-blue-50 rounded-xl font-medium active:bg-blue-100 transition">🔄 手动刷新</button>
            </>
          )}

          {/* ===== MENU TAB ===== */}
          {tab === 'menu' && (
            <>
              {/* Toolbar */}
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAddForm(!showAddForm)}
                  className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium active:scale-95 transition-transform">
                  + 新菜品
                </button>
                <select className="input-field text-xs flex-1" value={menuRestFilter} onChange={e => setMenuRestFilter(e.target.value)}>
                  <option value="all">全部店铺</option>
                  {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <button onClick={() => batchToggle('soldout')} className="text-xs px-2 py-2 bg-gray-100 rounded-lg text-gray-500">全下架</button>
                <button onClick={() => batchToggle('available')} className="text-xs px-2 py-2 bg-green-50 rounded-lg text-green-600">全上架</button>
              </div>

              {/* Category filter */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {menuCategories.map(cat => (
                  <button key={cat} onClick={() => setMenuCat(cat)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${menuCat === cat ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* Add form */}
              {showAddForm && (
                <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/30 p-4 space-y-2.5">
                  <h4 className="font-bold text-sm text-blue-600">添加菜品</h4>
                  <select className="input-field text-sm" value={newItem.restaurantId} onChange={e => setNewItem(p => ({ ...p, restaurantId: e.target.value }))}>
                    <option value="">选择店铺</option>
                    {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <input className="input-field text-sm flex-1" placeholder="菜品名称" value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} />
                    <input className="input-field text-sm w-20" type="number" placeholder="价格" value={newItem.price} onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))} />
                  </div>
                  <div className="flex gap-2">
                    <input className="input-field text-sm flex-1" placeholder="分类" value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))} />
                    <select className="input-field text-sm w-16" value={newItem.image} onChange={e => setNewItem(p => ({ ...p, image: e.target.value }))}>
                      {['🍱','🍗','🍜','🍲','🥤','🧋','🍖','🥟','🍝','🥗','🧀','🥚'].map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  <input className="input-field text-sm" placeholder="描述" value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} />
                  {formErr && <div className="text-red-500 text-xs bg-red-50 rounded-lg px-3 py-2">⚠️ {formErr}</div>}
                  <div className="flex gap-2">
                    <button onClick={addNewItem} className="flex-1 bg-blue-500 text-white rounded-xl py-2 text-sm font-bold">确认添加</button>
                    <button onClick={() => { setShowAddForm(false); setFormErr('') }} className="px-4 bg-gray-200 rounded-xl py-2 text-sm">取消</button>
                  </div>
                </div>
              )}

              {/* Menu items */}
              <div className="text-xs text-gray-400 mb-1">{getFilteredMenu().length} 个菜品</div>
              {getFilteredMenu().map(item => (
                <div key={item.id} className="rounded-xl border border-gray-100 bg-white p-3 flex items-center gap-3 shadow-sm">
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-2xl">{item.image}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm truncate">{item.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                        {item.status === 'available' ? '在售' : '下架'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 truncate">{item.description}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-orange-600 font-bold text-sm">¥{item.price}</span>
                      <span className="text-[10px] text-gray-300">月售{item.sales}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => setEditingItem(item)} className="text-[10px] px-2 py-1 rounded-lg bg-blue-50 text-blue-500">编辑</button>
                    <button onClick={() => toggleItemStatus(item)}
                      className={`text-[10px] px-2 py-1 rounded-lg ${item.status === 'available' ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-600'}`}>
                      {item.status === 'available' ? '下架' : '上架'}
                    </button>
                    <button onClick={() => deleteItem(item.id)} className="text-[10px] px-2 py-1 rounded-lg bg-red-50 text-red-400">删除</button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ===== SHOP TAB ===== */}
          {tab === 'shop' && (
            <>
              {restaurants.map(shop => (
                <div key={shop.id} className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
                  {/* Shop header */}
                  <div className={`px-4 py-3 flex items-center gap-3 ${shop.status === 'open' ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <span className="text-3xl">{shop.image}</span>
                    <div className="flex-1">
                      <div className="font-bold">{shop.name}</div>
                      <div className="text-xs text-gray-500">{shop.description}</div>
                    </div>
                    <button onClick={() => toggleShopStatus(shop)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${shop.status === 'open' ? 'bg-green-500 text-white' : 'bg-gray-300 text-white'}`}>
                      {shop.status === 'open' ? '营业中' : '已打烊'}
                    </button>
                  </div>

                  {/* Shop details */}
                  <div className="px-4 py-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1 text-gray-500"><span>⭐</span>{shop.rating} ({shop.ratingCount}评)</div>
                    <div className="flex items-center gap-1 text-gray-500"><span>📊</span>月售 {shop.monthSales}</div>
                    <div className="flex items-center gap-1 text-gray-500"><span>🕐</span>{shop.openTime}-{shop.closeTime}</div>
                    <div className="flex items-center gap-1 text-gray-500"><span>📍</span>{shop.address}</div>
                    <div className="flex items-center gap-1 text-gray-500"><span>💰</span>起送 ¥{shop.minOrder}</div>
                    <div className="flex items-center gap-1 text-gray-500"><span>🚴</span>配送费 ¥{shop.deliveryFee}</div>
                  </div>

                  {/* Shop actions */}
                  <div className="px-4 py-2 bg-gray-50 flex gap-2">
                    <button onClick={() => setEditingShop(shop)} className="flex-1 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-xl active:bg-blue-100 transition">✏️ 编辑信息</button>
                    <button onClick={() => { setTab('menu'); setMenuRestFilter(shop.id) }} className="flex-1 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-xl active:bg-purple-100 transition">🍴 管理菜单</button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ===== FINANCE TAB ===== */}
          {tab === 'finance' && (
            <div className="space-y-3">
              {/* Balance card */}
              <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-5 text-white shadow-lg">
                <p className="text-white/70 text-sm">可用余额</p>
                <div className="text-4xl font-bold mt-1">¥{freshUser ? freshUser.balance.toFixed(2) : '0.00'}</div>
                <div className="flex gap-4 mt-3 text-xs text-white/60">
                  <span>累计收入 ¥{totalIncome.toFixed(2)}</span>
                  <span>累计提现 ¥{totalWithdrawn.toFixed(2)}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setShowWithdraw(!showWithdraw)}
                    className="bg-white/20 backdrop-blur-sm text-white px-5 py-2 rounded-full text-sm font-medium active:bg-white/30 transition">
                    {showWithdraw ? '收起' : '💳 提现'}
                  </button>
                </div>
                {showWithdraw && (
                  <div className="mt-3">
                    <div className="flex gap-2">
                      <input type="number" className="flex-1 bg-white/20 border border-white/30 rounded-xl px-3 py-2 text-white placeholder-white/40 text-sm"
                        placeholder="输入提现金额" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} />
                      <button onClick={handleWithdraw} className="bg-white text-blue-600 px-4 py-2 rounded-xl text-sm font-bold active:scale-95 transition-transform">确认</button>
                    </div>
                    {formErr && <div className="text-red-200 text-xs bg-red-900/30 rounded-lg px-3 py-2 mt-2">⚠️ {formErr}</div>}
                  </div>
                )}
              </div>

              {/* Today summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white border border-gray-100 p-3 text-center shadow-sm">
                  <div className="text-lg font-bold text-blue-600">{todayOrders.length}</div>
                  <div className="text-[10px] text-gray-400">今日订单</div>
                </div>
                <div className="rounded-xl bg-white border border-gray-100 p-3 text-center shadow-sm">
                  <div className="text-lg font-bold text-green-600">¥{todayIncome.toFixed(0)}</div>
                  <div className="text-[10px] text-gray-400">今日收入</div>
                </div>
                <div className="rounded-xl bg-white border border-gray-100 p-3 text-center shadow-sm">
                  <div className="text-lg font-bold text-orange-600">¥{avgPrice.toFixed(0)}</div>
                  <div className="text-[10px] text-gray-400">客单价</div>
                </div>
              </div>

              {/* Transaction list */}
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 font-bold text-sm">交易明细</div>
                {txs.length === 0 ? (
                  <div className="py-10 text-center text-gray-300 text-sm">暂无记录</div>
                ) : txs.slice(0, 30).map(tx => (
                  <div key={tx.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${tx.amount >= 0 ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-400'}`}>
                        {tx.amount >= 0 ? '↓' : '↑'}
                      </div>
                      <div>
                        <div className="text-sm">{tx.description}</div>
                        <div className="text-[10px] text-gray-400">{new Date(tx.createdAt).toLocaleString('zh-CN')}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-sm ${tx.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-gray-300">余额 {tx.balance.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== STATS TAB ===== */}
          {tab === 'stats' && (
            <div className="space-y-3">
              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-gradient-to-br from-blue-50 to-white border border-blue-100 p-4">
                  <div className="text-3xl font-bold text-blue-600">{orders.length}</div>
                  <div className="text-xs text-gray-500 mt-1">总订单数</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">完成率 {orders.length ? (completedOrders.length / orders.length * 100).toFixed(0) : 0}%</div>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-green-50 to-white border border-green-100 p-4">
                  <div className="text-3xl font-bold text-green-600">¥{totalIncome.toFixed(0)}</div>
                  <div className="text-xs text-gray-500 mt-1">累计收入</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">客单价 ¥{avgPrice.toFixed(1)}</div>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-orange-50 to-white border border-orange-100 p-4">
                  <div className="text-3xl font-bold text-orange-600">{menuItems.length}</div>
                  <div className="text-xs text-gray-500 mt-1">菜品总数</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">在售 {menuItems.filter(m => m.status === 'available').length} 下架 {menuItems.filter(m => m.status === 'soldout').length}</div>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-purple-50 to-white border border-purple-100 p-4">
                  <div className="text-3xl font-bold text-purple-600">{restaurants.length}</div>
                  <div className="text-xs text-gray-500 mt-1">店铺数</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">平均评分 {restaurants.length ? (restaurants.reduce((s, r) => s + r.rating, 0) / restaurants.length).toFixed(1) : '-'}</div>
                </div>
              </div>

              {/* 7-day trend (bar chart) */}
              <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
                <h3 className="font-bold text-sm mb-3">近7日趋势</h3>
                <div className="flex items-end gap-1 h-24">
                  {dailyStats.map((d, i) => {
                    const maxO = Math.max(...dailyStats.map(x => x.orders), 1)
                    const h = d.orders > 0 ? Math.max(d.orders / maxO * 100, 8) : 4
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[9px] text-gray-400">{d.orders}</span>
                        <div className="w-full rounded-t-md bg-blue-400 transition-all" style={{ height: `${h}%` }} />
                        <span className="text-[9px] text-gray-400">{d.label}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-gray-400">
                  <span>7日总单: {dailyStats.reduce((s, d) => s + d.orders, 0)}</span>
                  <span>7日收入: ¥{dailyStats.reduce((s, d) => s + d.income, 0).toFixed(0)}</span>
                </div>
              </div>

              {/* Hot items ranking */}
              <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
                <h3 className="font-bold text-sm mb-3">🔥 热销菜品 TOP5</h3>
                {topItems.map((item, i) => (
                  <div key={item.id} className="flex items-center gap-3 py-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'}`}>{i + 1}</span>
                    <span className="text-base">{item.image}</span>
                    <span className="text-sm flex-1 truncate">{item.name}</span>
                    <div className="w-20">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-400 rounded-full" style={{ width: `${item.sales / maxSales * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">{item.sales}单</span>
                  </div>
                ))}
              </div>

              {/* Shop stats */}
              <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
                <h3 className="font-bold text-sm mb-3">店铺概览</h3>
                {restaurants.map(r => (
                  <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    <span className="text-2xl">{r.image}</span>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{r.name}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                        <span>⭐{r.rating}</span>
                        <span>月售{r.monthSales}</span>
                        <span>{r.category}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${r.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {r.status === 'open' ? '营业中' : '休息中'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== MODALS ===== */}
      {editingItem && <EditItemModal item={editingItem} onSave={saveItem} onClose={() => setEditingItem(null)} restaurants={restaurants} />}
      {editingShop && <EditShopModal shop={editingShop} onSave={saveShop} onClose={() => setEditingShop(null)} />}

      {/* ===== DELETE CONFIRMATION ===== */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">🗑️</div>
              <h3 className="text-xl font-black">确认删除？</h3>
              <p className="text-gray-500 mt-2 text-sm">删除后不可恢复</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)}
                className="flex-1 bg-gray-100 text-gray-600 rounded-2xl min-h-[52px] text-base font-bold active:scale-[0.97] transition-transform">
                取消
              </button>
              <button onClick={confirmDelete}
                className="flex-1 bg-red-500 text-white rounded-2xl min-h-[52px] text-base font-black active:scale-[0.97] transition-transform shadow-md">
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== REJECT CONFIRMATION (replaces blocking confirm()) ===== */}
      {rejectConfirmId && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">⚠️</div>
              <h3 className="text-xl font-black">确认拒单？</h3>
              <p className="text-gray-500 mt-2 text-sm">将自动退款给学生</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRejectConfirmId(null)}
                className="flex-1 bg-gray-100 text-gray-600 rounded-2xl min-h-[52px] text-base font-bold active:scale-[0.97] transition-transform">
                取消
              </button>
              <button onClick={confirmReject}
                className="flex-1 bg-red-500 text-white rounded-2xl min-h-[52px] text-base font-black active:scale-[0.97] transition-transform shadow-md">
                确认拒单
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== FULLSCREEN NEW ORDER ALERT (HEARING+VISION: impossible to miss) ===== */}
      {fullscreenAlert && (
        <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: 'linear-gradient(180deg, #dc2626 0%, #991b1b 100%)' }}>
          <div className="text-center py-6 animate-pulse">
            <div className="text-white text-4xl font-black">🔔 新订单!</div>
            <div className="mt-2"><LiveTimer t={fullscreenAlert.createdAt} size="xl" /></div>
          </div>
          <div className="flex-1 mx-4 mb-4 bg-white rounded-3xl overflow-y-auto shadow-2xl">
            <div className="p-5">
              <div className="text-2xl font-black mb-1">#{fullscreenAlert.orderNo}</div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-lg font-bold">{fullscreenAlert.studentName[0]}</span>
                <div>
                  <div className="text-xl font-bold">{fullscreenAlert.studentName}</div>
                  <a href={`tel:${fullscreenAlert.studentPhone}`} className="text-blue-500 underline">{fullscreenAlert.studentPhone}</a>
                </div>
              </div>
              <div className="text-gray-500 mb-4">📍 {fullscreenAlert.address}</div>
              {fullscreenAlert.items.map((it, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{it.image}</span>
                    <span className="text-xl font-bold">{it.name}</span>
                    <span className="text-base text-gray-400 bg-gray-100 px-3 py-1 rounded-full">x{it.quantity}</span>
                  </div>
                  <span className="text-lg font-bold">¥{(it.price * it.quantity).toFixed(0)}</span>
                </div>
              ))}
              {fullscreenAlert.note && (
                <div className="mt-4 p-4 bg-orange-50 border-2 border-orange-300 rounded-2xl text-lg text-orange-700 font-bold">
                  ⚠️ {fullscreenAlert.note}
                </div>
              )}
              <div className="mt-4 text-right text-4xl font-black text-orange-600">¥{fullscreenAlert.finalPrice.toFixed(2)}</div>
            </div>
          </div>
          {/* HUGE buttons - entire bottom of screen */}
          <div className="px-4 pb-6 flex gap-3">
            <button onClick={() => {
              handleOrderAction(fullscreenAlert.id, 'accepted'); actionDing()
              fullscreenAlertRef.current = null; setFullscreenAlert(null); setActionFeedback('✅ 已接单')
            }} className="flex-1 bg-green-500 text-white rounded-2xl min-h-[72px] text-2xl font-black active:scale-[0.97] transition-transform shadow-xl">
              ✅ 接单
            </button>
            <button onClick={() => {
              db.cancelAndRefund(fullscreenAlert.id, '商家拒单'); loadData()
              fullscreenAlertRef.current = null; setFullscreenAlert(null); setActionFeedback('❌ 已拒单')
            }} className="w-28 bg-white/20 text-white rounded-2xl min-h-[72px] text-lg font-bold active:scale-[0.97] transition-transform">
              拒绝
            </button>
          </div>
        </div>
      )}

      {/* ===== KITCHEN MODE (VISION+TOUCH: black bg, huge text, one order at a time) ===== */}
      {kitchenMode && (() => {
        const allActive = [...pendingOrders, ...activeOrders]
        const idx = Math.min(kitchenIdx, Math.max(allActive.length - 1, 0))
        const o = allActive[idx]
        const next = o ? NEXT_ACT[o.status] : null
        return (
          <div className="fixed inset-0 z-[80] bg-black flex flex-col">
            {/* Kitchen header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <span className="text-white/40 text-sm">🍳 厨房模式</span>
                <span className="text-white font-bold">{allActive.length > 0 ? `${idx + 1}/${allActive.length}` : '0/0'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${pendingOrders.length > 0 ? 'text-red-400 animate-pulse font-bold' : 'text-white/30'}`}>
                  {pendingOrders.length > 0 ? `🔴 ${pendingOrders.length}待接` : '无新单'}
                </span>
                <button onClick={() => setKitchenMode(false)}
                  className="text-white/50 text-sm px-3 py-1.5 border border-white/20 rounded-lg active:bg-white/10">✕ 退出</button>
              </div>
            </div>

            {!o ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4 opacity-20">✅</div>
                  <div className="text-white/20 text-2xl font-bold">暂无待处理订单</div>
                </div>
              </div>
            ) : (
              <>
                {/* Status bar - full width color */}
                <div className={`px-6 py-4 ${o.status === 'pending' ? 'bg-red-600 animate-pulse' : o.status === 'accepted' ? 'bg-blue-600' : o.status === 'preparing' ? 'bg-purple-600' : 'bg-green-600'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-white text-3xl font-black">#{o.orderNo}</span>
                    <LiveTimer t={o.createdAt} size="lg" />
                  </div>
                  <div className="text-white/80 text-xl mt-1 font-medium">{ORDER_STATUS_MAP[o.status]} · {o.studentName}</div>
                </div>

                {/* Items - HUGE readable from 1 meter */}
                <div className="flex-1 overflow-y-auto px-6 py-3 bg-gray-950">
                  {o.items.map((it, i) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b border-gray-800">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{it.image}</span>
                        <span className="text-white text-2xl font-bold">{it.name}</span>
                      </div>
                      <span className="text-white text-3xl font-black bg-gray-800 px-5 py-1.5 rounded-xl min-w-[64px] text-center">x{it.quantity}</span>
                    </div>
                  ))}
                  {o.note && (
                    <div className="mt-4 p-4 bg-orange-950/60 border-2 border-orange-500 rounded-2xl text-xl text-orange-300 font-bold">
                      ⚠️ {o.note}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-white/40 text-lg">📍 {o.address}</span>
                    <span className="text-green-400 text-4xl font-black">¥{o.finalPrice.toFixed(0)}</span>
                  </div>
                </div>

                {/* Navigation + Action - MASSIVE touch targets */}
                <div className="p-4 bg-gray-900 flex gap-3">
                  <button onClick={() => setKitchenIdx(Math.max(0, idx - 1))}
                    className="w-16 bg-gray-700 text-white rounded-xl min-h-[64px] text-2xl active:bg-gray-600 disabled:opacity-30" disabled={idx === 0}>◀</button>
                  {next && (
                    <button onClick={() => {
                      handleOrderAction(o.id, next.status); actionDing()
                      setActionFeedback(next.label)
                    }} className={`flex-1 ${o.status === 'pending' ? 'bg-green-500' : next.color} text-white rounded-xl min-h-[64px] text-2xl font-black active:scale-[0.97] transition-transform shadow-lg`}>
                      {next.label}
                    </button>
                  )}
                  {o.status === 'pending' && (
                    <button onClick={() => {
                      db.cancelAndRefund(o.id, '商家拒单'); loadData(); actionDing()
                      setActionFeedback('❌ 已拒单')
                    }} className="w-20 bg-red-900 text-white rounded-xl min-h-[64px] text-lg font-bold active:bg-red-800">拒绝</button>
                  )}
                  <button onClick={() => setKitchenIdx(Math.min(allActive.length - 1, idx + 1))}
                    className="w-16 bg-gray-700 text-white rounded-xl min-h-[64px] text-2xl active:bg-gray-600 disabled:opacity-30" disabled={idx >= allActive.length - 1}>▶</button>
                </div>
                {/* Dot pagination */}
                <div className="pb-4 bg-gray-900 flex justify-center gap-1.5">
                  {allActive.map((_, i) => (
                    <button key={i} onClick={() => setKitchenIdx(i)}
                      className={`w-2.5 h-2.5 rounded-full transition-all ${i === idx ? 'bg-white scale-125' : 'bg-gray-700'}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* ===== ACTION FEEDBACK OVERLAY (VISION: confirms action was received) ===== */}
      {actionFeedback && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none">
          <div className="bg-black/80 backdrop-blur-sm text-white text-3xl font-black px-12 py-8 rounded-3xl shadow-2xl animate-bounce">
            {actionFeedback}
          </div>
        </div>
      )}

      {/* ===== BOTTOM NAV ===== */}
      <div className="bottom-nav">
        {([
          { key: 'orders', icon: '📋', label: '订单', badge: pendingOrders.length },
          { key: 'menu', icon: '🍴', label: '菜单', badge: 0 },
          { key: 'shop', icon: '🏪', label: '店铺', badge: 0 },
          { key: 'finance', icon: '💰', label: '财务', badge: 0 },
          { key: 'stats', icon: '📊', label: '数据', badge: 0 },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`nav-item relative ${tab === t.key ? 'text-blue-500' : ''}`}>
            <span className="text-xl">{t.icon}</span>
            <span>{t.label}</span>
            {t.badge ? <span className="absolute -top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center animate-bounce">{t.badge}</span> : null}
          </button>
        ))}
      </div>
    </div>
  )
}
