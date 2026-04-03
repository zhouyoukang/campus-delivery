'use client'

import { useState } from 'react'
import { useApp } from '@/context/AppContext'
import { useRouter } from 'next/navigation'

const ROLE_ROUTES: Record<string, string> = {
  student: '/student',
  merchant: '/merchant',
  rider: '/rider',
  admin: '/admin',
}

const QUICK_ACCOUNTS = [
  { label: '学生 张三', phone: '13800001111', pw: '123456', role: 'student', emoji: '🎓' },
  { label: '商家 黄焖鸡', phone: '13900001111', pw: '123456', role: 'merchant', emoji: '👨‍🍳' },
  { label: '骑手 王骑手', phone: '13700001111', pw: '123456', role: 'rider', emoji: '🏍️' },
  { label: '管理员', phone: '18800001111', pw: 'admin123', role: 'admin', emoji: '👑' },
]

export default function HomePage() {
  const { user, login, logout, register, loading } = useApp()
  const router = useRouter()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('student')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-400 to-primary-600">
      <div className="text-white text-xl animate-pulse">加载中...</div>
    </div>
  )

  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-400 via-primary-500 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center space-y-6 animate-fade-in">
          <div className="text-5xl">👋</div>
          <h2 className="text-2xl font-bold text-gray-800">欢迎回来，{user.name}</h2>
          <p className="text-gray-500">
            角色：{user.role === 'student' ? '学生' : user.role === 'merchant' ? '商家' : user.role === 'rider' ? '骑手' : '管理员'}
          </p>
          <button onClick={() => router.push(ROLE_ROUTES[user.role] || '/student')}
            className="btn-primary w-full text-lg py-3">
            进入系统 →
          </button>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-red-500 transition-colors">
            切换账号
          </button>
        </div>
      </div>
    )
  }

  const handleLogin = () => {
    setError('')
    const res = login(phone, password)
    if (!res.ok) setError(res.error || '登录失败')
  }

  const handleRegister = () => {
    setError('')
    if (!name || !phone || !password) { setError('请填写完整信息'); return }
    const res = register({ name, phone, password, role })
    if (res.ok) {
      setTab('login')
      setError('')
      setSuccess('✅ 注册成功，请登录')
    } else {
      setError(res.error || '注册失败')
    }
  }

  const quickLogin = (acc: typeof QUICK_ACCOUNTS[0]) => {
    setError('')
    const res = login(acc.phone, acc.pw)
    if (!res.ok) setError(res.error || '登录失败')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-400 via-primary-500 to-orange-500 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center text-white space-y-2">
          <div className="text-6xl mb-4">🍱</div>
          <h1 className="text-3xl font-bold">校园外卖</h1>
          <p className="text-white/80 text-sm">校园美食 · 一键送达</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-5">
          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => { setTab('login'); setError('') }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${tab === 'login' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>
              登录
            </button>
            <button onClick={() => { setTab('register'); setError('') }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${tab === 'register' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>
              注册
            </button>
          </div>

          {error && <div className="text-red-500 text-sm text-center bg-red-50 py-2 rounded-lg">{error}</div>}
          {success && <div className="text-green-600 text-sm text-center bg-green-50 py-2 rounded-lg font-medium">{success}</div>}

          {tab === 'login' ? (
            <div className="space-y-4">
              <input className="input-field" placeholder="手机号" value={phone} onChange={e => setPhone(e.target.value)} />
              <input className="input-field" type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              <button onClick={handleLogin} className="btn-primary w-full py-3">
                登录
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <input className="input-field" placeholder="姓名" value={name} onChange={e => setName(e.target.value)} />
              <input className="input-field" placeholder="手机号" value={phone} onChange={e => setPhone(e.target.value)} />
              <input className="input-field" type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} />
              <select className="input-field" value={role} onChange={e => setRole(e.target.value)}>
                <option value="student">学生</option>
                <option value="merchant">商家</option>
                <option value="rider">骑手</option>
              </select>
              <button onClick={handleRegister} className="btn-primary w-full py-3">
                注册
              </button>
            </div>
          )}
        </div>

        {/* Quick Login */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 space-y-3">
          <p className="text-white/80 text-xs text-center">快速体验（点击直接登录）</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACCOUNTS.map(acc => (
              <button key={acc.phone} onClick={() => quickLogin(acc)}
                className="bg-white/20 hover:bg-white/30 text-white rounded-xl py-2.5 px-3 text-sm font-medium transition-all flex items-center gap-2 justify-center">
                <span>{acc.emoji}</span>
                <span>{acc.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
