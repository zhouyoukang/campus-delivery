'use client'

import { useState, useEffect } from 'react'
import { useApp } from '@/context/AppContext'
import { useRouter } from 'next/navigation'
import { Restaurant, MenuItem } from '@/types'
import * as store from '@/lib/store'

export default function RestaurantClient({ id }: { id: string }) {
  const { user, cart, addToCart } = useApp()
  const router = useRouter()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [activeCat, setActiveCat] = useState('')

  useEffect(() => {
    if (!user) { router.push('/'); return }
    const r = store.getRestaurantById(id)
    if (r) {
      setRestaurant(r)
      const m = store.getMenuByRestaurant(id)
      setMenu(m)
      const cats = store.getMenuCategories(id)
      setCategories(cats)
      if (cats.length > 0) setActiveCat(cats[0])
    }
  }, [id, user])

  if (!restaurant) return (
    <div className="page-container flex items-center justify-center min-h-screen">
      <div className="text-gray-400 animate-pulse">加载中...</div>
    </div>
  )

  const getQty = (itemId: string) => {
    if (!cart || cart.restaurantId !== restaurant.id) return 0
    const ci = cart.items.find(c => c.menuItem.id === itemId)
    return ci ? ci.quantity : 0
  }

  const cartTotal = cart && cart.restaurantId === restaurant.id
    ? cart.items.reduce((s, ci) => s + ci.menuItem.price * ci.quantity, 0)
    : 0
  const cartCount = cart && cart.restaurantId === restaurant.id
    ? cart.items.reduce((s, ci) => s + ci.quantity, 0)
    : 0

  return (
    <div className="page-container pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-500 to-orange-400 px-4 pt-4 pb-6 rounded-b-3xl">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="text-white text-xl">&#8592;</button>
          <h1 className="text-white font-bold text-lg flex-1 truncate">{restaurant.name}</h1>
        </div>
        <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-3xl">
              {restaurant.image}
            </div>
            <div className="flex-1 text-white">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-yellow-300">&#9733; {restaurant.rating}</span>
                <span className="text-white/60">|</span>
                <span className="text-white/80">月售{restaurant.monthSales}</span>
              </div>
              <p className="text-xs text-white/70 mt-1">{restaurant.description}</p>
              <p className="text-xs text-white/60 mt-1">
                &#165;{restaurant.minOrder}起送 | 配送费&#165;{restaurant.deliveryFee} | {restaurant.openTime}-{restaurant.closeTime}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="flex mt-2">
        {/* Category sidebar */}
        <div className="w-20 flex-shrink-0 bg-gray-50 min-h-[60vh]">
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCat(cat)}
              className={`w-full py-3 text-xs text-center transition-all ${activeCat === cat ? 'bg-white text-primary-600 font-bold border-l-2 border-primary-500' : 'text-gray-500'}`}>
              {cat}
            </button>
          ))}
        </div>
        {/* Items */}
        <div className="flex-1 px-3 py-2 space-y-3">
          {menu.filter(m => m.category === activeCat).map(item => (
            <div key={item.id} className="flex gap-3 pb-3 border-b border-gray-50">
              <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                {item.image}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm text-gray-800 truncate">{item.name}</h4>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>
                <div className="text-xs text-gray-400 mt-1">月售{item.sales}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-primary-600 font-bold">&#165;{item.price}</span>
                    {item.originalPrice && (
                      <span className="text-xs text-gray-400 line-through">&#165;{item.originalPrice}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getQty(item.id) > 0 && (
                      <>
                        <button onClick={() => addToCart(restaurant.id, restaurant.name, restaurant.deliveryFee, item, -1)}
                          className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold">
                          -
                        </button>
                        <span className="text-sm font-bold w-4 text-center">{getQty(item.id)}</span>
                      </>
                    )}
                    <button onClick={() => addToCart(restaurant.id, restaurant.name, restaurant.deliveryFee, item, 1)}
                      className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm font-bold shadow">
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-gray-800 rounded-t-2xl px-4 py-3 flex items-center gap-3 z-50 animate-slide-up">
          <div onClick={() => router.push('/student/cart')}
            className="relative cursor-pointer">
            <div className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center text-xl shadow-lg -mt-4">
              &#128722;
            </div>
            <span className="absolute -top-5 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {cartCount}
            </span>
          </div>
          <div className="flex-1">
            <span className="text-white font-bold text-lg">&#165;{cartTotal.toFixed(2)}</span>
            <span className="text-gray-400 text-xs ml-2">另需配送费&#165;{restaurant.deliveryFee}</span>
          </div>
          <button onClick={() => router.push('/student/cart')}
            className="bg-primary-500 text-white rounded-full px-6 py-2 font-bold text-sm">
            去结算
          </button>
        </div>
      )}
    </div>
  )
}
