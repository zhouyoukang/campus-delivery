'use client'

import { useState } from 'react'
import { useApp } from '@/context/AppContext'
import { useRouter } from 'next/navigation'

export default function CartPage() {
  const { user, cart, addToCart, removeFromCart, clearCart, getCartTotal, placeOrder } = useApp()
  const router = useRouter()
  const [address, setAddress] = useState(user?.address || '')
  const [note, setNote] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [orderNo, setOrderNo] = useState('')
  const [cartError, setCartError] = useState('')

  if (!user) { return null }

  if (showSuccess) {
    return (
      <div className="page-container flex items-center justify-center min-h-screen bg-green-50">
        <div className="text-center space-y-4 animate-fade-in p-8">
          <div className="text-6xl">&#9989;</div>
          <h2 className="text-2xl font-bold text-green-700">下单成功!</h2>
          <p className="text-gray-500">订单号: {orderNo}</p>
          <p className="text-sm text-gray-400">商家正在准备您的餐品...</p>
          <div className="flex gap-3 justify-center mt-6">
            <button onClick={() => router.push('/student')} className="btn-secondary">继续点餐</button>
            <button onClick={() => router.push('/student?tab=orders')} className="btn-primary">查看订单</button>
          </div>
        </div>
      </div>
    )
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="page-container min-h-screen">
        <div className="sticky top-0 bg-white z-10 px-4 py-3 border-b flex items-center gap-3">
          <button onClick={() => router.back()} className="text-lg">&#8592;</button>
          <h2 className="font-bold text-lg">购物车</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="text-6xl mb-4">&#128722;</div>
          <p className="text-gray-400 mb-6">购物车是空的</p>
          <button onClick={() => router.push('/student')} className="btn-primary">去点餐</button>
        </div>
      </div>
    )
  }

  const subtotal = getCartTotal()
  const packingFee = Math.ceil(cart.items.length * 0.5)
  const discount = subtotal >= 30 ? 3 : 0
  const total = subtotal + cart.deliveryFee + packingFee - discount

  const handleSubmit = () => {
    setCartError('')
    if (!address.trim()) { setCartError('请填写收货地址'); return }
    const res = placeOrder(address, note)
    if (res.ok) {
      setOrderNo(res.orderId || '')
      setShowSuccess(true)
    } else {
      setCartError(res.error || '下单失败')
    }
  }

  return (
    <div className="page-container pb-40">
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-lg">&#8592;</button>
          <h2 className="font-bold text-lg">购物车</h2>
        </div>
        <button onClick={clearCart} className="text-sm text-red-400 hover:text-red-600">清空</button>
      </div>

      {/* Restaurant */}
      <div className="px-4 py-3 bg-gray-50">
        <span className="text-sm font-medium text-gray-700">&#127860; {cart.restaurantName}</span>
      </div>

      {/* Items */}
      <div className="px-4 py-3 space-y-3">
        {cart.items.map(ci => (
          <div key={ci.menuItem.id} className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
              {ci.menuItem.image}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium truncate">{ci.menuItem.name}</h4>
              <span className="text-primary-600 font-bold text-sm">&#165;{ci.menuItem.price}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => addToCart(cart.restaurantId, cart.restaurantName, cart.deliveryFee, ci.menuItem, -1)}
                className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold">-</button>
              <span className="w-6 text-center font-bold text-sm">{ci.quantity}</span>
              <button onClick={() => addToCart(cart.restaurantId, cart.restaurantName, cart.deliveryFee, ci.menuItem, 1)}
                className="w-7 h-7 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm font-bold">+</button>
            </div>
          </div>
        ))}
      </div>

      {/* Error */}
      {cartError && (
        <div className="mx-4 mt-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600 font-medium">
          ⚠️ {cartError}
        </div>
      )}

      {/* Delivery Address */}
      <div className="px-4 py-3 border-t">
        <h3 className="text-sm font-bold mb-2">&#128205; 收货地址</h3>
        <input className="input-field" placeholder="例如: 明德楼A栋305" value={address}
          onChange={e => setAddress(e.target.value)} />
      </div>

      {/* Note */}
      <div className="px-4 py-3">
        <h3 className="text-sm font-bold mb-2">&#128221; 备注</h3>
        <textarea className="input-field h-16 resize-none" placeholder="口味要求、特殊说明..." value={note}
          onChange={e => setNote(e.target.value)} />
      </div>

      {/* Price Summary */}
      <div className="px-4 py-3 space-y-2 bg-gray-50 rounded-xl mx-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">商品小计</span><span>&#165;{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">配送费</span><span>&#165;{cart.deliveryFee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">打包费</span><span>&#165;{packingFee.toFixed(2)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-green-600">满30减3优惠</span><span className="text-green-600">-&#165;{discount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base pt-2 border-t">
          <span>合计</span><span className="text-primary-600">&#165;{total.toFixed(2)}</span>
        </div>
      </div>

      {/* Submit */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t px-4 py-4 z-50">
        <button onClick={handleSubmit}
          className="btn-primary w-full py-3.5 text-base">
          提交订单 ¥{total.toFixed(2)}
        </button>
      </div>
    </div>
  )
}
