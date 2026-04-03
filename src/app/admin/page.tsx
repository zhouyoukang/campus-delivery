'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import { useRouter } from 'next/navigation'
import { Order, User, Transaction, ORDER_STATUS_MAP, ORDER_STATUS_COLOR } from '@/types'
import * as db from '@/lib/store'

interface Stats {
  totalUsers: number
  totalStudents: number
  totalMerchants: number
  totalRiders: number
  totalRestaurants: number
  totalOrders: number
  todayOrders: number
  totalRevenue: number
  pendingOrders: number
  deliveringOrders: number
}

const ROLE_MAP: Record<string, string> = { student: '学生', merchant: '商家', rider: '骑手', admin: '管理员' }
const ROLE_COLOR: Record<string, string> = { student: 'bg-blue-100 text-blue-700', merchant: 'bg-green-100 text-green-700', rider: 'bg-orange-100 text-orange-700', admin: 'bg-purple-100 text-purple-700' }

export default function AdminPage() {
  const { user, logout, loading: appLoading } = useApp()
  const router = useRouter()
  const [tab, setTab] = useState<'overview' | 'orders' | 'users' | 'finance'>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [finStats, setFinStats] = useState<any>(null)
  const [txs, setTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [userFilter, setUserFilter] = useState('all')
  const [orderFilter, setOrderFilter] = useState('all')

  const loadData = useCallback(() => {
    setLoading(true)
    setStats(db.getStats())
    setOrders(db.getOrders().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)))
    setAllUsers(db.getUsers())
    setFinStats(db.getFinancialStats())
    setTxs(db.getTransactions().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 100))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (appLoading) return
    if (!user || user.role !== 'admin') { router.push('/'); return }
    loadData()
  }, [user, appLoading, loadData])

  const [confirmOrderId, setConfirmOrderId] = useState<string | null>(null)
  const [adjustUser, setAdjustUser] = useState<User | null>(null)
  const [adjustAmt, setAdjustAmt] = useState('')

  if (appLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-gray-400">加载中...</div></div>
  const handleCancelRefund = (orderId: string) => {
    setConfirmOrderId(orderId)
  }
  const doCancel = () => {
    if (!confirmOrderId) return
    const res = db.cancelAndRefund(confirmOrderId, '管理员仲裁取消')
    setConfirmOrderId(null)
    if (res.ok) loadData()
  }

  const handleForceComplete = (orderId: string) => {
    db.updateOrder(orderId, { status: 'completed' })
    db.settleOrder(orderId)
    loadData()
  }

  if (!user) return null

  const filteredUsers = userFilter === 'all' ? allUsers : allUsers.filter(u => u.role === userFilter)
  const filteredOrders = orderFilter === 'all' ? orders : orders.filter(o => o.status === orderFilter)

  return (
    <div className="page-container pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 to-purple-500 px-4 pt-6 pb-4 rounded-b-2xl">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-white text-lg font-bold">管理后台</h1>
            <p className="text-white/70 text-xs mt-1">系统管理员</p>
          </div>
          <button onClick={() => { logout(); router.push('/') }}
            className="text-white/70 text-xs hover:text-white">退出</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b px-4 mt-2">
        {(['overview', 'orders', 'users', 'finance'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-all ${tab === t ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-400'}`}>
            {t === 'overview' ? '总览' : t === 'orders' ? '订单' : t === 'users' ? '用户' : '财务'}
          </button>
        ))}
      </div>

      {loading ? <div className="p-8 text-center text-gray-400 animate-pulse">加载中...</div> : (
        <div className="px-4 py-4 space-y-4">
          {tab === 'overview' && stats && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="总用户" value={stats.totalUsers} color="blue" icon="&#128101;" />
                <StatCard label="总订单" value={stats.totalOrders} color="green" icon="&#128196;" />
                <StatCard label="总收入" value={`&#165;${stats.totalRevenue.toFixed(0)}`} color="yellow" icon="&#128176;" />
                <StatCard label="餐厅数" value={stats.totalRestaurants} color="purple" icon="&#127860;" />
                <StatCard label="待处理" value={stats.pendingOrders} color="red" icon="&#9888;" />
                <StatCard label="配送中" value={stats.deliveringOrders} color="orange" icon="&#128692;" />
              </div>
              <div className="card p-4">
                <h3 className="font-bold text-sm mb-3">用户分布</h3>
                <div className="space-y-2">
                  <UserBar label="学生" count={stats.totalStudents} total={stats.totalUsers} color="bg-blue-500" />
                  <UserBar label="商家" count={stats.totalMerchants} total={stats.totalUsers} color="bg-green-500" />
                  <UserBar label="骑手" count={stats.totalRiders} total={stats.totalUsers} color="bg-orange-500" />
                </div>
              </div>
              <button onClick={loadData} className="btn-secondary w-full text-sm">刷新数据</button>
            </>
          )}

          {tab === 'orders' && (
            <>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {[['all','全部'],['pending','待接单'],['accepted','已接单'],['preparing','制作中'],['delivering','配送中'],['delivered','已送达'],['completed','已完成'],['cancelled','已取消']].map(([v,l]) => (
                  <button key={v} onClick={() => setOrderFilter(v)}
                    className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${orderFilter === v ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{l}</button>
                ))}
              </div>
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-400">暂无订单</div>
              ) : filteredOrders.slice(0, 50).map(order => (
                <div key={order.id} className="card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">#{order.orderNo}</span>
                    <span className={`badge ${ORDER_STATUS_COLOR[order.status]}`}>{ORDER_STATUS_MAP[order.status]}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>{order.restaurantName}</span>
                    <span className="font-bold">&#165;{order.finalPrice.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {order.studentName} ({order.studentPhone}) &#8594; {order.address}
                  </div>
                  <div className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleString('zh-CN')}</div>
                  {order.riderName && <div className="text-xs text-gray-400">骑手: {order.riderName} {order.riderPhone}</div>}
                  {!['completed', 'cancelled'].includes(order.status) && (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => handleCancelRefund(order.id)}
                        className="btn-danger flex-1 text-xs py-1.5">仲裁取消(退款)</button>
                      {['delivering', 'delivered'].includes(order.status) && (
                        <button onClick={() => handleForceComplete(order.id)}
                          className="btn-success flex-1 text-xs py-1.5">强制完成(结算)</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <button onClick={loadData} className="btn-secondary w-full text-sm">刷新</button>
            </>
          )}

          {tab === 'users' && (
            <>
              <div className="flex gap-2 mb-3">
                {[['all','全部'],['student','学生'],['merchant','商家'],['rider','骑手']].map(([v,l]) => (
                  <button key={v} onClick={() => setUserFilter(v)}
                    className={`px-3 py-1 rounded-full text-xs ${userFilter === v ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{l}</button>
                ))}
              </div>
              <div className="text-xs text-gray-400 mb-2">共 {filteredUsers.length} 位用户</div>
              {filteredUsers.map(u => (
                <div key={u.id} className="card p-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg">
                    {u.role === 'student' ? '🎓' : u.role === 'merchant' ? '🏪' : u.role === 'rider' ? '🚴' : '👑'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{u.name}</span>
                      <span className={`badge text-xs ${ROLE_COLOR[u.role]}`}>{ROLE_MAP[u.role]}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{u.phone} | 余额 &#165;{u.balance.toFixed(2)}</div>
                  </div>
                  {u.role !== 'admin' && (
                    <div className="flex gap-1">
                      <button onClick={() => { setAdjustUser(u); setAdjustAmt('') }}
                        className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600">调余额</button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {tab === 'finance' && finStats && (
            <>
              <div className="card p-4">
                <h3 className="font-bold text-sm mb-3">平台财务总览</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-green-600">&#165;{finStats.totalRecharge.toFixed(0)}</div>
                    <div className="text-xs text-gray-500 mt-1">总充值</div>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-red-600">&#165;{finStats.totalPayment.toFixed(0)}</div>
                    <div className="text-xs text-gray-500 mt-1">总消费</div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-blue-600">&#165;{finStats.totalRefund.toFixed(0)}</div>
                    <div className="text-xs text-gray-500 mt-1">总退款</div>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-orange-600">&#165;{finStats.totalWithdraw.toFixed(0)}</div>
                    <div className="text-xs text-gray-500 mt-1">总提现</div>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-purple-600">&#165;{finStats.totalIncome.toFixed(0)}</div>
                    <div className="text-xs text-gray-500 mt-1">商家+骑手收入</div>
                  </div>
                  <div className="bg-yellow-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-yellow-600">{finStats.totalTransactions}</div>
                    <div className="text-xs text-gray-500 mt-1">交易笔数</div>
                  </div>
                </div>
              </div>
              <div className="card p-4">
                <h3 className="font-bold text-sm mb-3">最近交易记录</h3>
                {txs.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm">暂无记录</div>
                ) : txs.slice(0, 30).map(tx => {
                  const txUser = allUsers.find(u => u.id === tx.userId)
                  return (
                    <div key={tx.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{tx.description}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {txUser ? `${txUser.name}(${ROLE_MAP[txUser.role]})` : tx.userId} · {new Date(tx.createdAt).toLocaleString('zh-CN')}
                        </div>
                      </div>
                      <div className={`font-bold text-sm ml-3 ${tx.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Balance Adjustment Modal (replaces blocking prompt()) */}
      {adjustUser && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">💰</div>
              <h3 className="text-lg font-black">调整余额</h3>
              <p className="text-gray-500 mt-1 text-sm">{adjustUser.name} · 当前余额 ¥{adjustUser.balance.toFixed(2)}</p>
            </div>
            <input type="number" className="input-field w-full mb-3 text-center text-lg" placeholder="正数增加，负数减少"
              value={adjustAmt} onChange={e => setAdjustAmt(e.target.value)} autoFocus />
            <div className="flex gap-3">
              <button onClick={() => setAdjustUser(null)}
                className="flex-1 bg-gray-100 text-gray-600 rounded-2xl min-h-[48px] text-base font-bold active:scale-[0.97] transition-transform">
                取消
              </button>
              <button onClick={() => {
                const n = parseFloat(adjustAmt)
                if (isNaN(n) || n === 0) return
                db.changeBalance(adjustUser.id, n)
                db.addTransaction({ userId: adjustUser.id, type: n > 0 ? 'recharge' : 'withdraw', amount: n, balance: (db.getUserById(adjustUser.id)?.balance || 0), description: `管理员调整 ${n > 0 ? '+' : ''}${n.toFixed(2)}` })
                setAdjustUser(null); loadData()
              }}
                className="flex-1 bg-blue-500 text-white rounded-2xl min-h-[48px] text-base font-black active:scale-[0.97] transition-transform shadow-md">
                确认调整
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {confirmOrderId && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">⚠️</div>
              <h3 className="text-xl font-black">确认取消并退款？</h3>
              <p className="text-gray-500 mt-2 text-sm">将取消订单并退款给学生</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmOrderId(null)}
                className="flex-1 bg-gray-100 text-gray-600 rounded-2xl min-h-[48px] text-base font-bold active:scale-[0.97] transition-transform">
                取消
              </button>
              <button onClick={doCancel}
                className="flex-1 bg-red-500 text-white rounded-2xl min-h-[48px] text-base font-black active:scale-[0.97] transition-transform shadow-md">
                确认退款
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div className="bottom-nav">
        <button onClick={() => setTab('overview')} className={`nav-item ${tab === 'overview' ? 'text-purple-500' : ''}`}>
          <span className="text-xl">&#128200;</span><span>总览</span>
        </button>
        <button onClick={() => setTab('orders')} className={`nav-item ${tab === 'orders' ? 'text-purple-500' : ''}`}>
          <span className="text-xl">&#128196;</span><span>订单</span>
        </button>
        <button onClick={() => setTab('users')} className={`nav-item ${tab === 'users' ? 'text-purple-500' : ''}`}>
          <span className="text-xl">&#128101;</span><span>用户</span>
        </button>
        <button onClick={() => setTab('finance')} className={`nav-item ${tab === 'finance' ? 'text-purple-500' : ''}`}>
          <span className="text-xl">&#128176;</span><span>财务</span>
        </button>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, icon }: { label: string; value: any; color: string; icon: string }) {
  const bgMap: Record<string, string> = {
    blue: 'bg-blue-50', green: 'bg-green-50', yellow: 'bg-yellow-50', purple: 'bg-purple-50', red: 'bg-red-50', orange: 'bg-orange-50',
  }
  const textMap: Record<string, string> = {
    blue: 'text-blue-600', green: 'text-green-600', yellow: 'text-yellow-600', purple: 'text-purple-600', red: 'text-red-600', orange: 'text-orange-600',
  }
  return (
    <div className={`${bgMap[color]} rounded-xl p-4`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl" dangerouslySetInnerHTML={{ __html: icon }} />
        <div className={`text-2xl font-bold ${textMap[color]}`} dangerouslySetInnerHTML={{ __html: String(value) }} />
      </div>
      <div className="text-xs text-gray-500 mt-2">{label}</div>
    </div>
  )
}

function UserBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-8">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-6 text-right">{count}</span>
    </div>
  )
}
