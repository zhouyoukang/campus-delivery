'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useApp } from '@/context/AppContext'
import { useRouter } from 'next/navigation'
import { Restaurant, Order, OrderStatus, Transaction, ORDER_STATUS_MAP, ORDER_STATUS_COLOR, TRANSACTION_TYPE_MAP, TRANSACTION_TYPE_COLOR } from '@/types'
import * as store from '@/lib/store'

const CATEGORIES = ['全部', '中式快餐', '麻辣烫', '饮品甜点', '面食', '韩式料理']

// ======= Student Order Status Timeline =======
const S_STEPS: { key: OrderStatus; icon: string; label: string }[] = [
  { key: 'pending', icon: '🕐', label: '待接单' },
  { key: 'accepted', icon: '✅', label: '已接单' },
  { key: 'preparing', icon: '🔥', label: '制作中' },
  { key: 'ready', icon: '🍽️', label: '待取餐' },
  { key: 'delivering', icon: '🏍️', label: '配送中' },
  { key: 'delivered', icon: '📦', label: '已送达' },
]

function OrderTimeline({ status }: { status: OrderStatus }) {
  if (['cancelled', 'completed'].includes(status)) return null
  const si = S_STEPS.findIndex(s => s.key === status)
  return (
    <div className="flex items-center gap-0.5 py-2">
      {S_STEPS.map((step, i) => {
        const done = i <= si; const active = i === si
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs
                ${done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}
                ${active ? 'ring-2 ring-green-300 ring-offset-1 scale-110' : ''}`}>
                {done ? step.icon : (i + 1)}
              </div>
              <span className={`text-[9px] mt-0.5 whitespace-nowrap ${done ? 'text-green-600 font-bold' : 'text-gray-400'}`}>{step.label}</span>
            </div>
            {i < S_STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-0.5 ${done && i < si ? 'bg-green-500' : 'bg-gray-200'}`} />}
          </div>
        )
      })}
    </div>
  )
}

function StudentOrders({ userId, onBack, onCancel }: { userId: string; onBack: () => void; onCancel: (id: string) => void }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState<'active' | 'done'>('active')
  const prevStatuses = useRef<Record<string, string>>({})

  const load = useCallback(() => {
    setOrders(store.getOrdersByStudent(userId))
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
    // Populate prevStatuses on first load to avoid spurious vibrations
    const initial = store.getOrdersByStudent(userId)
    initial.forEach(o => { prevStatuses.current[o.id] = o.status })
  }, [load, userId])

  // Real-time polling every 5s - detect status changes
  useEffect(() => {
    const timer = setInterval(() => {
      const fresh = store.getOrdersByStudent(userId)
      fresh.forEach(o => {
        const prev = prevStatuses.current[o.id]
        if (prev && prev !== o.status && !['completed', 'cancelled'].includes(prev)) {
          try { navigator.vibrate?.([100, 50, 100]) } catch {}
        }
        prevStatuses.current[o.id] = o.status
      })
      setOrders(fresh)
    }, 5000)
    return () => clearInterval(timer)
  }, [userId])

  const activeOrders = orders.filter(o => !['completed', 'cancelled'].includes(o.status))
  const doneOrders = orders.filter(o => ['completed', 'cancelled'].includes(o.status))

  return (
    <div className="page-container pb-20">
      <div className="sticky top-0 bg-white z-10 px-4 py-3 border-b flex items-center gap-3">
        <button onClick={onBack} className="text-lg">&#8592;</button>
        <h2 className="font-bold text-lg">我的订单</h2>
        <div className="ml-auto flex gap-1">
          <button onClick={() => setSubTab('active')}
            className={`text-xs px-3 py-1 rounded-full transition-all ${subTab === 'active' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
            进行中{activeOrders.length > 0 ? `(${activeOrders.length})` : ''}
          </button>
          <button onClick={() => setSubTab('done')}
            className={`text-xs px-3 py-1 rounded-full transition-all ${subTab === 'done' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
            已完成
          </button>
        </div>
      </div>
      {loading ? <div className="p-8 text-center text-gray-400">加载中...</div> : (() => {
        const list = subTab === 'active' ? activeOrders : doneOrders
        if (list.length === 0) return (
          <div className="p-12 text-center">
            <div className="text-5xl mb-4">{subTab === 'active' ? '✅' : '📭'}</div>
            <p className="text-gray-400">{subTab === 'active' ? '暂无进行中订单' : '暂无历史订单'}</p>
          </div>
        )
        return (
          <div className="p-4 space-y-3">
            {list.map(order => (
              <div key={order.id} className={`card overflow-hidden ${
                order.status === 'pending' ? 'border-l-4 border-l-orange-400' :
                order.status === 'delivering' ? 'border-l-4 border-l-blue-400' :
                order.status === 'delivered' ? 'border-l-4 border-l-green-400' : ''
              }`}>
                {/* Header */}
                <div className="px-4 pt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{order.restaurantName}</span>
                    <span className="text-xs text-gray-400 font-mono">#{order.orderNo}</span>
                  </div>
                  <span className={`badge ${ORDER_STATUS_COLOR[order.status]}`}>{ORDER_STATUS_MAP[order.status]}</span>
                </div>

                {/* Status timeline - only for active orders */}
                {!['cancelled', 'completed'].includes(order.status) && (
                  <div className="px-4">
                    <OrderTimeline status={order.status} />
                  </div>
                )}

                {/* Status message */}
                {order.status === 'pending' && (
                  <div className="mx-4 mb-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-600 font-medium">
                    🕐 等待商家接单中...
                  </div>
                )}
                {order.status === 'preparing' && (
                  <div className="mx-4 mb-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs text-purple-600 font-medium">
                    🔥 商家正在制作您的餐品
                  </div>
                )}
                {order.status === 'ready' && (
                  <div className="mx-4 mb-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-600 font-medium">
                    🍽️ 餐品已制作完成，等待骑手取餐
                  </div>
                )}
                {order.status === 'delivering' && order.riderName && (
                  <div className="mx-4 mb-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-600 font-medium">
                    🏍️ {order.riderName} 正在配送 · <a href={`tel:${order.riderPhone}`} className="underline font-bold">{order.riderPhone}</a>
                  </div>
                )}

                {/* Items */}
                <div className="px-4 py-2">
                  <div className="text-sm text-gray-500">
                    {order.items.map(it => `${it.name}x${it.quantity}`).join('、')}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-sm">
                    <span className="text-gray-400">{new Date(order.createdAt).toLocaleString('zh-CN')}</span>
                    <span className="font-bold text-primary-600">&#165;{order.finalPrice.toFixed(2)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-4 pb-3 flex gap-2">
                  {order.status === 'delivered' && (
                    <button onClick={() => {
                      store.updateOrder(order.id, { status: 'completed' })
                      store.settleOrder(order.id)
                      load()
                    }} className="btn-success flex-1 text-sm min-h-[44px] font-bold">✅ 确认收货</button>
                  )}
                  {['pending', 'accepted', 'preparing'].includes(order.status) && (
                    <button onClick={() => { onCancel(order.id); load() }} className="btn-danger flex-1 text-sm min-h-[44px]">取消订单</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}

function StudentWallet({ user, onRecharge }: { user: any; onRecharge: (amt: number) => { ok: boolean; error?: string } }) {
  const [showRecharge, setShowRecharge] = useState(false)
  const [amount, setAmount] = useState('')
  const [txs, setTxs] = useState<Transaction[]>([])
  const [walletErr, setWalletErr] = useState('')
  const presets = [10, 20, 50, 100, 200, 500]

  useEffect(() => { setTxs(store.getTransactionsByUser(user.id)) }, [user])

  const doRecharge = (amt: number) => {
    setWalletErr('')
    const res = onRecharge(amt)
    if (res.ok) { setShowRecharge(false); setAmount(''); setTxs(store.getTransactionsByUser(user.id)) }
    else setWalletErr(res.error || '充值失败')
  }

  return (
    <div className="page-container pb-20">
      <div className="bg-gradient-to-r from-primary-500 to-orange-400 px-4 pt-8 pb-10 rounded-b-3xl text-center">
        <p className="text-white/70 text-sm">账户余额</p>
        <div className="text-white text-4xl font-bold mt-2">&#165;{user.balance.toFixed(2)}</div>
        <button onClick={() => setShowRecharge(!showRecharge)}
          className="mt-4 bg-white/25 text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-white/35 transition">
          {showRecharge ? '收起' : '充值'}
        </button>
      </div>
      {showRecharge && (
        <div className="px-4 -mt-4 relative z-10">
          <div className="card p-4 space-y-3">
            <h4 className="font-bold text-sm">选择充值金额</h4>
            <div className="grid grid-cols-3 gap-2">
              {presets.map(p => (
                <button key={p} onClick={() => doRecharge(p)}
                  className="border-2 border-primary-200 rounded-xl py-3 text-center hover:border-primary-500 hover:bg-primary-50 transition font-bold text-primary-600">
                  &#165;{p}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="number" className="input-field flex-1" placeholder="自定义金额" value={amount}
                onChange={e => setAmount(e.target.value)} />
              <button onClick={() => { const n = parseFloat(amount); if (n > 0) doRecharge(n); else setWalletErr('请输入有效金额') }}
                className="btn-primary px-4 text-sm">确认</button>
            </div>
          </div>
          {walletErr && <div className="text-red-500 text-xs bg-red-50 rounded-lg px-3 py-2 mt-2">⚠️ {walletErr}</div>}
        </div>
      )}
      <div className="px-4 mt-4">
        <h3 className="font-bold text-sm mb-3">交易记录</h3>
        {txs.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">暂无交易记录</div>
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
  )
}

function StudentProfile({ user, onLogout }: { user: any; onLogout: () => void }) {
  return (
    <div className="page-container pb-20">
      <div className="bg-gradient-to-r from-primary-500 to-orange-400 px-4 pt-8 pb-12 rounded-b-3xl text-center">
        <div className="w-20 h-20 bg-white/30 rounded-full mx-auto flex items-center justify-center text-4xl mb-3">
          &#127891;
        </div>
        <h2 className="text-white font-bold text-xl">{user.name}</h2>
        <p className="text-white/70 text-sm mt-1">{user.phone}</p>
      </div>
      <div className="px-4 -mt-6 space-y-3">
        <div className="card p-4 flex items-center justify-between">
          <span className="text-gray-600">账户余额</span>
          <span className="font-bold text-primary-600">&#165;{user.balance.toFixed(2)}</span>
        </div>
        <div className="card p-4 flex items-center justify-between">
          <span className="text-gray-600">收货地址</span>
          <span className="text-sm text-gray-500">{user.address || '未设置'}</span>
        </div>
        <div className="card p-4 flex items-center justify-between">
          <span className="text-gray-600">手机号</span>
          <span className="text-sm text-gray-500">{user.phone}</span>
        </div>
        <button onClick={onLogout} className="btn-danger w-full mt-6">退出登录</button>
      </div>
    </div>
  )
}

export default function StudentHome() {
  const { user, logout, getCartItemCount, cart, loading, rechargeBalance, cancelOrder } = useApp()
  const router = useRouter()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [category, setCategory] = useState('全部')
  const [keyword, setKeyword] = useState('')
  const [tab, setTab] = useState<'home' | 'orders' | 'wallet' | 'profile'>('home')

  const fetchRestaurants = useCallback((cat?: string, kw?: string) => {
    setRestaurants(store.getRestaurants(cat, kw))
  }, [])

  useEffect(() => {
    if (loading) return
    if (!user || user.role !== 'student') { router.push('/'); return }
    fetchRestaurants()
  }, [user, loading, fetchRestaurants])

  useEffect(() => {
    if (!loading && user) fetchRestaurants(category, keyword)
  }, [category, loading, user, fetchRestaurants])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-gray-400">加载中...</div></div>
  if (!user) return null
  const cartCount = getCartItemCount()

  if (tab === 'orders') return (
    <>
      <StudentOrders userId={user.id} onBack={() => setTab('home')} onCancel={(id) => cancelOrder(id)} />
      <BottomNav tab={tab} setTab={setTab} cartCount={cartCount} onCartClick={() => router.push('/student/cart')} />
    </>
  )
  if (tab === 'wallet') return (
    <>
      <StudentWallet user={user} onRecharge={rechargeBalance} />
      <BottomNav tab={tab} setTab={setTab} cartCount={cartCount} onCartClick={() => router.push('/student/cart')} />
    </>
  )
  if (tab === 'profile') return (
    <>
      <StudentProfile user={user} onLogout={() => { logout(); router.push('/') }} />
      <BottomNav tab={tab} setTab={setTab} cartCount={cartCount} onCartClick={() => router.push('/student/cart')} />
    </>
  )

  return (
    <div className="page-container pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-500 to-orange-400 px-4 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/80 text-xs">&#128205; {user.address || '设置收货地址'}</p>
            <h1 className="text-white text-lg font-bold mt-1">校园外卖</h1>
          </div>
          <div className="text-white text-sm bg-white/20 rounded-full px-3 py-1">
            余额 &#165;{user.balance}
          </div>
        </div>
        <div className="flex gap-2">
          <input className="flex-1 bg-white/90 rounded-full px-4 py-2.5 text-sm placeholder-gray-400 focus:outline-none"
            placeholder="搜索餐厅或菜品..." value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchRestaurants(category, keyword)} />
          <button onClick={() => fetchRestaurants(category, keyword)}
            className="bg-white rounded-full w-10 h-10 flex items-center justify-center text-primary-500 font-bold shadow">
            &#128269;
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="px-4 mt-4">
        <div className="flex gap-2 overflow-x-auto scroll-hidden pb-2">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${category === cat ? 'bg-primary-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Restaurant List */}
      <div className="px-4 mt-4 space-y-3 pb-4">
        {restaurants.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">&#128533;</div>
            <p>没有找到餐厅</p>
          </div>
        ) : restaurants.map(r => (
          <div key={r.id} onClick={() => router.push(`/student/restaurant/${r.id}`)}
            className="card p-4 flex gap-4 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]">
            <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center text-3xl flex-shrink-0">
              {r.image}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-800 truncate">{r.name}</h3>
                {r.status === 'open' && <span className="badge bg-green-100 text-green-700">营业中</span>}
              </div>
              <p className="text-xs text-gray-400 mt-1 truncate">{r.description}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span className="text-yellow-500">&#9733; {r.rating}</span>
                <span>月售{r.monthSales}</span>
                <span>&#165;{r.minOrder}起送</span>
                <span className="text-primary-500">配送费&#165;{r.deliveryFee}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cart Float */}
      {cartCount > 0 && (
        <div onClick={() => router.push('/student/cart')}
          className="fixed bottom-20 right-4 max-w-md bg-primary-500 text-white rounded-full px-5 py-3 shadow-lg cursor-pointer flex items-center gap-2 animate-slide-up z-40">
          <span className="text-lg">&#128722;</span>
          <span className="font-bold">{cartCount}件</span>
          <span className="text-white/80">|</span>
          <span>&#165;{cart ? cart.items.reduce((s, ci) => s + ci.menuItem.price * ci.quantity, 0).toFixed(2) : '0'}</span>
        </div>
      )}

      {/* Bottom Nav */}
      <BottomNav tab={tab} setTab={setTab} cartCount={cartCount} onCartClick={() => router.push('/student/cart')} />
    </div>
  )
}

function BottomNav({ tab, setTab, cartCount, onCartClick }: {
  tab: string; setTab: (t: any) => void; cartCount: number; onCartClick: () => void
}) {
  return (
    <div className="bottom-nav">
      <button onClick={() => setTab('home')} className={`nav-item ${tab === 'home' ? 'active' : ''}`}>
        <span className="text-xl">&#127968;</span><span>首页</span>
      </button>
      <button onClick={onCartClick} className="nav-item relative">
        <span className="text-xl">&#128722;</span><span>购物车</span>
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">{cartCount}</span>
        )}
      </button>
      <button onClick={() => setTab('orders')} className={`nav-item ${tab === 'orders' ? 'active' : ''}`}>
        <span className="text-xl">&#128196;</span><span>订单</span>
      </button>
      <button onClick={() => setTab('wallet')} className={`nav-item ${tab === 'wallet' ? 'active' : ''}`}>
        <span className="text-xl">&#128176;</span><span>钱包</span>
      </button>
      <button onClick={() => setTab('profile')} className={`nav-item ${tab === 'profile' ? 'active' : ''}`}>
        <span className="text-xl">&#128100;</span><span>我的</span>
      </button>
    </div>
  )
}
