import type { Metadata } from 'next'
import './globals.css'
import { AppProvider } from '@/context/AppContext'

export const metadata: Metadata = {
  title: '校园外卖 - 校园美食一键送达',
  description: '校园外卖平台，连接学生、商家、骑手',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  )
}
