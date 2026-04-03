'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { User, Cart, MenuItem, Order, OrderStatus, Transaction } from '@/types'
import * as store from '@/lib/store'

interface AppState {
  user: User | null
  cart: Cart | null
  orders: Order[]
  loading: boolean
}

interface AppContextType extends AppState {
  login: (phone: string, password: string) => { ok: boolean; error?: string }
  logout: () => void
  register: (data: { name: string; phone: string; password: string; role: string }) => { ok: boolean; error?: string }
  addToCart: (restaurantId: string, restaurantName: string, deliveryFee: number, item: MenuItem, qty?: number) => void
  removeFromCart: (menuItemId: string) => void
  clearCart: () => void
  getCartTotal: () => number
  getCartItemCount: () => number
  placeOrder: (address: string, note: string) => { ok: boolean; orderId?: string; error?: string }
  refreshOrders: () => void
  updateOrderStatus: (orderId: string, status: string, extra?: Record<string, string>) => { ok: boolean }
  rechargeBalance: (amount: number) => { ok: boolean; error?: string }
  withdrawBalance: (amount: number) => { ok: boolean; error?: string }
  cancelOrder: (orderId: string, reason?: string) => { ok: boolean; error?: string }
  refreshUser: () => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({ user: null, cart: null, orders: [], loading: true })

  useEffect(() => {
    store.initStore()
    const saved = localStorage.getItem('campus_user')
    if (saved) {
      try {
        const user = JSON.parse(saved)
        setState(s => ({ ...s, user, loading: false }))
      } catch { setState(s => ({ ...s, loading: false })) }
    } else {
      setState(s => ({ ...s, loading: false }))
    }
    const savedCart = localStorage.getItem('campus_cart')
    if (savedCart) {
      try { setState(s => ({ ...s, cart: JSON.parse(savedCart) })) } catch {}
    }
  }, [])

  useEffect(() => {
    if (state.cart) localStorage.setItem('campus_cart', JSON.stringify(state.cart))
    else localStorage.removeItem('campus_cart')
  }, [state.cart])

  const login = (phone: string, password: string) => {
    const res = store.loginUser(phone, password)
    if (res.ok && res.user) {
      setState(s => ({ ...s, user: res.user as User }))
      localStorage.setItem('campus_user', JSON.stringify(res.user))
    }
    return res
  }

  const logout = () => {
    setState(s => ({ ...s, user: null, cart: null, orders: [] }))
    localStorage.removeItem('campus_user')
    localStorage.removeItem('campus_cart')
  }

  const register = (d: { name: string; phone: string; password: string; role: string }) => {
    return store.registerUser(d)
  }

  const addToCart = (restaurantId: string, restaurantName: string, deliveryFee: number, item: MenuItem, qty = 1) => {
    setState(s => {
      let cart = s.cart
      if (!cart || cart.restaurantId !== restaurantId) {
        cart = { restaurantId, restaurantName, deliveryFee, items: [] }
      }
      const existing = cart.items.find(ci => ci.menuItem.id === item.id)
      if (existing) {
        existing.quantity += qty
        if (existing.quantity <= 0) {
          cart.items = cart.items.filter(ci => ci.menuItem.id !== item.id)
        }
      } else if (qty > 0) {
        cart.items.push({ menuItem: item, quantity: qty })
      }
      if (cart.items.length === 0) return { ...s, cart: null }
      return { ...s, cart: { ...cart } }
    })
  }

  const removeFromCart = (menuItemId: string) => {
    setState(s => {
      if (!s.cart) return s
      const items = s.cart.items.filter(ci => ci.menuItem.id !== menuItemId)
      if (items.length === 0) return { ...s, cart: null }
      return { ...s, cart: { ...s.cart, items } }
    })
  }

  const clearCart = () => setState(s => ({ ...s, cart: null }))

  const getCartTotal = () => {
    if (!state.cart) return 0
    return state.cart.items.reduce((sum, ci) => sum + ci.menuItem.price * ci.quantity, 0)
  }

  const getCartItemCount = () => {
    if (!state.cart) return 0
    return state.cart.items.reduce((sum, ci) => sum + ci.quantity, 0)
  }

  const placeOrder = (address: string, note: string) => {
    if (!state.cart || !state.user) return { ok: false, error: '购物车为空或未登录' }
    const res = store.payAndCreateOrder({
      studentId: state.user.id,
      studentName: state.user.name,
      studentPhone: state.user.phone,
      restaurantId: state.cart.restaurantId,
      restaurantName: state.cart.restaurantName,
      items: state.cart.items.map(ci => ({ menuItemId: ci.menuItem.id, name: ci.menuItem.name, price: ci.menuItem.price, quantity: ci.quantity, image: ci.menuItem.image })),
      deliveryFee: state.cart.deliveryFee,
      address, note,
    })
    if (res.ok) {
      setState(s => ({ ...s, cart: null }))
      refreshUser()
      return { ok: true, orderId: res.order!.id }
    }
    return { ok: false, error: res.error }
  }

  const refreshOrders = useCallback(() => {
    if (!state.user) return
    const role = state.user.role
    let orders: Order[] = []
    if (role === 'student') orders = store.getOrdersByStudent(state.user.id)
    else if (role === 'merchant') orders = store.getOrdersByMerchant(state.user.id)
    else if (role === 'rider') orders = store.getOrdersByRider(state.user.id)
    else orders = store.getOrders().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    setState(s => ({ ...s, orders }))
  }, [state.user])

  const updateOrderStatus = (orderId: string, status: string, extra?: Record<string, string>) => {
    const updated = store.updateOrder(orderId, { status: status as OrderStatus, ...extra })
    if (status === 'completed' || status === 'delivered') {
      store.settleOrder(orderId)
    }
    refreshOrders()
    refreshUser()
    return { ok: !!updated }
  }

  const rechargeBalance = (amount: number) => {
    if (!state.user) return { ok: false, error: '未登录' }
    const res = store.recharge(state.user.id, amount)
    if (res.ok) refreshUser()
    return res
  }

  const withdrawBalance = (amount: number) => {
    if (!state.user) return { ok: false, error: '未登录' }
    const res = store.withdraw(state.user.id, amount)
    if (res.ok) refreshUser()
    return res
  }

  const cancelOrder = (orderId: string, reason?: string) => {
    const res = store.cancelAndRefund(orderId, reason)
    if (res.ok) { refreshOrders(); refreshUser() }
    return res
  }

  const refreshUser = () => {
    if (!state.user) return
    const fresh = store.getUserById(state.user.id)
    if (fresh) {
      const { password: _, ...safe } = fresh
      setState(s => ({ ...s, user: safe as User }))
      localStorage.setItem('campus_user', JSON.stringify(safe))
    }
  }

  return (
    <AppContext.Provider value={{ ...state, login, logout, register, addToCart, removeFromCart, clearCart, getCartTotal, getCartItemCount, placeOrder, refreshOrders, updateOrderStatus, rechargeBalance, withdrawBalance, cancelOrder, refreshUser }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be within AppProvider')
  return ctx
}
