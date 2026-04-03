'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useApp } from '@/context/AppContext'
import { useRouter } from 'next/navigation'
import { Order, Transaction, ORDER_STATUS_MAP, ORDER_STATUS_COLOR } from '@/types'
import * as db from '@/lib/store'

// ======= Rider Sound =======
let _rCtx: AudioContext | null = null
function rTone(f: number, d: number, v = 0.4) {
  try {
    if (!_rCtx) _rCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    if (_rCtx.state === 'suspended') _rCtx.resume()
    const o = _rCtx.createOscillator(), g = _rCtx.createGain()
    o.connect(g); g.connect(_rCtx.destination); o.frequency.value = f; o.type = 'sine'
    g.gain.setValueAtTime(v, _rCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, _rCtx.currentTime + d)
    o.start(); o.stop(_rCtx.currentTime + d)
  } catch {}
}
function riderAlert() {
  rTone(660, 0.12); setTimeout(() => rTone(880, 0.12), 140); setTimeout(() => rTone(1100, 0.2), 280)
  try { navigator.vibrate?.([200, 100, 200]) } catch {}
}

export default function RiderPage() {
  const { user, logout, loading: appLoading } = useApp()
  const router = useRouter()
  const [tab, setTab] = useState<'available' | 'active' | 'history' | 'finance'>('available')
  const [available, setAvailable] = useState<Order[]>([])
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [txs, setTxs] = useState<Transaction[]>([])
  const [withdrawAmt, setWithdrawAmt] = useState('')
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [actionFeedback, setActionFeedback] = useState('')
  const [withdrawErr, setWithdrawErr] = useState('')
  const prevAvailCount = useRef(-1)

  const loadData = useCallback(() => {
    if (!user) return
    setLoading(true)
    setAvailable(db.getAvailableOrders())
    setMyOrders(db.getOrdersByRider(user.id))
    setTxs(db.getTransactionsByUser(user.id))
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (appLoading) return
    if (!user || user.role !== 'rider') { router.push('/'); return }
    loadData()
  }, [user, appLoading, loadData])

  // Real-time polling every 5s - alert on new available orders
  useEffect(() => {
    if (!user) return
    const timer = setInterval(() => {
      const fresh = db.getAvailableOrders()
      if (fresh.length > prevAvailCount.current && prevAvailCount.current >= 0) {
        riderAlert()
      }
      prevAvailCount.current = fresh.length
      setAvailable(fresh)
      setMyOrders(db.getOrdersByRider(user.id))
      setTxs(db.getTransactionsByUser(user.id))
    }, 5000)
    return () => clearInterval(timer)
  }, [user])

  // Action feedback auto-clear
  useEffect(() => {
    if (!actionFeedback) return
    const t = setTimeout(() => setActionFeedback(''), 1500)
    return () => clearTimeout(t)
  }, [actionFeedback])

  const acceptOrder = (orderId: string) => {
    if (!user) return
    db.updateOrder(orderId, { status: 'delivering', riderId: user.id, riderName: user.name, riderPhone: user.phone } as any)
    setActionFeedback('🏍️ 已接单')
    loadData()
  }

  const completeDelivery = (orderId: string) => {
    db.updateOrder(orderId, { status: 'delivered' })
    setActionFeedback('📦 已送达')
    loadData()
  }

  if (appLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-gray-400">加载中...</div></div>
  if (!user) return null

  const activeDeliveries = myOrders.filter(o => o.status === 'delivering')
  const completedDeliveries = myOrders.filter(o => ['delivered', 'completed'].includes(o.status))
  const readyOrders = available.filter(o => o.status === 'ready')
  const totalIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalWithdrawn = txs.filter(t => t.type === 'withdraw').reduce((s, t) => s + Math.abs(t.amount), 0)
  const freshUser = db.getUserById(user.id)

  const handleWithdraw = () => {
    setWithdrawErr('')
    const amt = parseFloat(withdrawAmt)
    if (!amt || amt <= 0) { setWithdrawErr('请输入有效金额'); return }
    const res = db.withdraw(user!.id, amt)
    if (res.ok) { setShowWithdraw(false); setWithdrawAmt(''); loadData() }
    else setWithdrawErr(res.error || '提现失败')
  }

  return (
    <div className="page-container pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-4 pt-6 pb-4 rounded-b-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-white text-lg font-bold">🏍️ 骑手中心</h1>
            <p className="text-white/70 text-xs mt-1">{user.name} | {user.phone}</p>
          </div>
          <button onClick={() => { logout(); router.push('/') }}
            className="text-white/70 text-xs hover:text-white">退出</button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white/15 rounded-xl p-2.5 text-center backdrop-blur-sm">
            <div className="text-white text-xl font-bold">{available.length}</div>
            <div className="text-white/70 text-[10px] mt-0.5">可接单</div>
          </div>
          <div className={`rounded-xl p-2.5 text-center backdrop-blur-sm ${readyOrders.length > 0 ? 'bg-yellow-400/30 animate-pulse' : 'bg-white/15'}`}>
            <div className={`text-xl font-bold ${readyOrders.length > 0 ? 'text-yellow-300' : 'text-white'}`}>{readyOrders.length}</div>
            <div className="text-white/70 text-[10px] mt-0.5">🍽️ 可取餐</div>
          </div>
          <div className="bg-white/15 rounded-xl p-2.5 text-center backdrop-blur-sm">
            <div className="text-white text-xl font-bold">{activeDeliveries.length}</div>
            <div className="text-white/70 text-[10px] mt-0.5">配送中</div>
          </div>
          <div className="bg-white/15 rounded-xl p-2.5 text-center backdrop-blur-sm">
            <div className="text-yellow-300 text-xl font-bold">&#165;{freshUser ? freshUser.balance.toFixed(0) : 0}</div>
            <div className="text-white/70 text-[10px] mt-0.5">余额</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b px-4 mt-2">
        {(['available', 'active', 'history', 'finance'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-all ${tab === t ? 'border-green-500 text-green-600' : 'border-transparent text-gray-400'}`}>
            {t === 'available' ? `接单(${available.length})` : t === 'active' ? `配送(${activeDeliveries.length})` : t === 'history' ? '历史' : '财务'}
          </button>
        ))}
      </div>

      {loading ? <div className="p-8 text-center text-gray-400 animate-pulse">加载中...</div> : (
        <div className="px-4 py-3 space-y-3">
          {tab === 'available' && (
            <>
              {available.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-2">&#128722;</div><p>暂无可接订单</p>
                  <button onClick={loadData} className="btn-secondary mt-4 text-sm">刷新</button>
                </div>
              ) : available.map(order => (
                <div key={order.id} className="bg-white rounded-2xl border-2 border-yellow-300 shadow-sm overflow-hidden">
                  <div className="bg-yellow-50 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🍽️</span>
                      <span className="font-bold">{order.restaurantName}</span>
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">已出餐</span>
                    </div>
                    <span className="text-green-600 font-bold text-lg">+&#165;{order.deliveryFee}</span>
                  </div>
                  <div className="px-4 py-2.5">
                    <div className="text-sm text-gray-600 mb-1.5">{order.items.map(it => `${it.name}x${it.quantity}`).join('、')}</div>
                    <div className="flex items-start gap-4 text-xs text-gray-400 mb-3">
                      <span>📍 取: {order.restaurantName}</span>
                      <span>🏠 送: {order.address}</span>
                    </div>
                    {order.note && <div className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-1.5 mb-3 font-medium">⚠️ {order.note}</div>}
                    <button onClick={() => acceptOrder(order.id)}
                      className="w-full bg-green-500 text-white rounded-xl py-3 font-bold text-base active:scale-[0.97] transition-transform shadow-md">
                      🏍️ 立即取餐配送
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={loadData} className="btn-secondary w-full text-sm">🔄 刷新订单</button>
            </>
          )}

          {tab === 'active' && (
            <>
              {activeDeliveries.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-2">&#128692;</div><p>暂无配送中的订单</p>
                </div>
              ) : activeDeliveries.map(order => (
                <div key={order.id} className="card p-4 space-y-3 border-l-4 border-orange-400">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{order.restaurantName}</span>
                    <span className={`badge ${ORDER_STATUS_COLOR[order.status]}`}>{ORDER_STATUS_MAP[order.status]}</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                    <div><span className="text-gray-400">取餐: </span>{order.restaurantName}</div>
                    <div><span className="text-gray-400">送达: </span>{order.address}</div>
                    <div><span className="text-gray-400">客户: </span>{order.studentName} {order.studentPhone}</div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {order.items.map(it => `${it.name}x${it.quantity}`).join('、')}
                  </div>
                  {order.note && <div className="text-xs text-orange-500 bg-orange-50 p-2 rounded">备注: {order.note}</div>}
                  <button onClick={() => completeDelivery(order.id)} className="btn-primary w-full text-sm">确认送达</button>
                </div>
              ))}
            </>
          )}

          {tab === 'history' && (
            <>
              {completedDeliveries.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-2">&#128196;</div><p>暂无历史订单</p>
                </div>
              ) : completedDeliveries.map(order => (
                <div key={order.id} className="card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{order.restaurantName}</span>
                    <span className={`badge ${ORDER_STATUS_COLOR[order.status]}`}>{ORDER_STATUS_MAP[order.status]}</span>
                  </div>
                  <div className="text-xs text-gray-400">{order.address}</div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">{new Date(order.createdAt).toLocaleString('zh-CN')}</span>
                    <span className="text-green-600 font-bold">+&#165;{order.deliveryFee}</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {tab === 'finance' && (
            <div className="space-y-4">
              <div className="card p-4">
                <div className="text-center">
                  <p className="text-gray-500 text-sm">可用余额</p>
                  <div className="text-3xl font-bold text-green-600 mt-1">&#165;{freshUser ? freshUser.balance.toFixed(2) : '0.00'}</div>
                  <div className="flex justify-center gap-6 mt-3 text-xs text-gray-500">
                    <span>配送收入 &#165;{totalIncome.toFixed(2)}</span>
                    <span>累计提现 &#165;{totalWithdrawn.toFixed(2)}</span>
                  </div>
                  <button onClick={() => setShowWithdraw(!showWithdraw)}
                    className="mt-3 bg-green-500 text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-green-600 transition">
                    {showWithdraw ? '收起' : '提现'}
                  </button>
                </div>
                {showWithdraw && (
                  <div className="mt-4">
                    <div className="flex gap-2">
                      <input type="number" className="input-field flex-1" placeholder="提现金额" value={withdrawAmt}
                        onChange={e => setWithdrawAmt(e.target.value)} />
                      <button onClick={handleWithdraw} className="btn-primary px-4 text-sm">确认提现</button>
                    </div>
                    {withdrawErr && <div className="text-red-500 text-xs bg-red-50 rounded-lg px-3 py-2 mt-2">⚠️ {withdrawErr}</div>}
                  </div>
                )}
              </div>
              <div className="card p-4">
                <h3 className="font-bold text-sm mb-3">收支明细</h3>
                {txs.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm">暂无记录</div>
                ) : txs.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div>
                      <div className="text-sm font-medium">{tx.description}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{new Date(tx.createdAt).toLocaleString('zh-CN')}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-sm ${tx.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-400">余额 {tx.balance.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Feedback */}
      {actionFeedback && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none">
          <div className="bg-black/80 backdrop-blur-sm text-white text-2xl font-black px-10 py-6 rounded-3xl shadow-2xl animate-bounce">
            {actionFeedback}
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div className="bottom-nav">
        <button onClick={() => { setTab('available'); loadData() }} className={`nav-item ${tab === 'available' ? 'text-green-500' : ''}`}>
          <span className="text-xl">&#128230;</span><span>接单</span>
        </button>
        <button onClick={() => setTab('active')} className={`nav-item ${tab === 'active' ? 'text-green-500' : ''}`}>
          <span className="text-xl">&#128692;</span><span>配送</span>
        </button>
        <button onClick={() => setTab('history')} className={`nav-item ${tab === 'history' ? 'text-green-500' : ''}`}>
          <span className="text-xl">&#128196;</span><span>历史</span>
        </button>
        <button onClick={() => setTab('finance')} className={`nav-item ${tab === 'finance' ? 'text-green-500' : ''}`}>
          <span className="text-xl">&#128176;</span><span>财务</span>
        </button>
      </div>
    </div>
  )
}
