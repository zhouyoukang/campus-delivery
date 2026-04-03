export type UserRole = 'student' | 'merchant' | 'rider' | 'admin'

export interface User {
  id: string
  name: string
  phone: string
  role: UserRole
  password: string
  avatar?: string
  address?: string
  balance: number
  createdAt: string
}

export interface Restaurant {
  id: string
  name: string
  ownerId: string
  description: string
  image: string
  rating: number
  ratingCount: number
  category: string
  address: string
  openTime: string
  closeTime: string
  minOrder: number
  deliveryFee: number
  status: 'open' | 'closed' | 'busy'
  monthSales: number
}

export interface MenuItem {
  id: string
  restaurantId: string
  name: string
  price: number
  originalPrice?: number
  description: string
  image: string
  category: string
  sales: number
  status: 'available' | 'soldout'
}

export interface CartItem {
  menuItem: MenuItem
  quantity: number
}

export interface Cart {
  restaurantId: string
  restaurantName: string
  items: CartItem[]
  deliveryFee: number
}

export type OrderStatus =
  | 'pending'      // 待接单
  | 'accepted'     // 已接单
  | 'preparing'    // 制作中
  | 'ready'        // 待取餐
  | 'delivering'   // 配送中
  | 'delivered'    // 已送达
  | 'completed'    // 已完成
  | 'cancelled'    // 已取消

export interface OrderItem {
  menuItemId: string
  name: string
  price: number
  quantity: number
  image: string
}

export interface Order {
  id: string
  orderNo: string
  studentId: string
  studentName: string
  studentPhone: string
  restaurantId: string
  restaurantName: string
  riderId?: string
  riderName?: string
  riderPhone?: string
  items: OrderItem[]
  totalPrice: number
  deliveryFee: number
  packingFee: number
  discount: number
  finalPrice: number
  address: string
  note: string
  status: OrderStatus
  statusHistory: { status: OrderStatus; time: string; note?: string }[]
  estimatedTime?: number
  createdAt: string
  updatedAt: string
}

export const ORDER_STATUS_MAP: Record<OrderStatus, string> = {
  pending: '待接单',
  accepted: '已接单',
  preparing: '制作中',
  ready: '待取餐',
  delivering: '配送中',
  delivered: '已送达',
  completed: '已完成',
  cancelled: '已取消',
}

export type TransactionType =
  | 'recharge'     // 充值
  | 'payment'      // 支付订单
  | 'refund'       // 退款
  | 'income'       // 商家/骑手收入
  | 'withdraw'     // 提现
  | 'platform_fee' // 平台手续费

export interface Transaction {
  id: string
  userId: string
  type: TransactionType
  amount: number          // 正=收入，负=支出
  balance: number         // 交易后余额
  orderId?: string
  orderNo?: string
  description: string
  createdAt: string
}

export const TRANSACTION_TYPE_MAP: Record<TransactionType, string> = {
  recharge: '充值',
  payment: '支付',
  refund: '退款',
  income: '收入',
  withdraw: '提现',
  platform_fee: '手续费',
}

export const TRANSACTION_TYPE_COLOR: Record<TransactionType, string> = {
  recharge: 'text-green-600',
  payment: 'text-red-600',
  refund: 'text-green-600',
  income: 'text-green-600',
  withdraw: 'text-orange-600',
  platform_fee: 'text-gray-500',
}

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-blue-100 text-blue-800',
  preparing: 'bg-purple-100 text-purple-800',
  ready: 'bg-indigo-100 text-indigo-800',
  delivering: 'bg-orange-100 text-orange-800',
  delivered: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
}
