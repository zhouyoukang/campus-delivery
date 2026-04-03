# 🍱 校园外卖平台

> 校园美食 · 一键送达

**在线体验**: [https://zhouyoukang.github.io/campus-delivery/](https://zhouyoukang.github.io/campus-delivery/)

## 功能概览

| 角色 | 功能 |
|------|------|
| 🎓 学生 | 浏览餐厅、搜索菜品、加购下单、查看订单、确认收货 |
| 👨‍🍳 商家 | 订单管理、菜品管理（增删改）、营业统计 |
| 🏍️ 骑手 | 查看可接单、接单配送、确认送达、收入统计 |
| 👑 管理员 | 全局数据总览、订单监控、用户分布 |

## 快速体验

首页提供一键快速登录，点击即可进入对应角色：

| 角色 | 手机号 | 密码 |
|------|--------|------|
| 学生 张三 | 13800001111 | 123456 |
| 商家 黄焖鸡 | 13900001111 | 123456 |
| 骑手 王骑手 | 13700001111 | 123456 |
| 管理员 | 18800001111 | admin123 |

## 技术栈

- **框架**: Next.js 14 (App Router, Static Export)
- **语言**: TypeScript
- **样式**: TailwindCSS
- **状态**: React Context + localStorage
- **部署**: GitHub Pages

## 架构

```
src/
├── app/                  # 页面路由
│   ├── page.tsx          # 登录/注册
│   ├── student/          # 学生端
│   ├── merchant/         # 商家端
│   ├── rider/            # 骑手端
│   └── admin/            # 管理后台
├── context/
│   └── AppContext.tsx     # 全局状态管理
├── lib/
│   └── store.ts          # 客户端数据层 (localStorage)
└── types/
    └── index.ts          # TypeScript类型定义
```

纯客户端SPA，所有数据存储在浏览器localStorage中，无需后端服务器。首次访问自动初始化种子数据（6家餐厅、22个菜品、8个用户）。

## 本地开发

```bash
npm install
npm run dev      # 开发模式 http://localhost:3060
npm run build    # 构建静态文件到 dist/
```

## 订单生命周期

```
下单(pending) → 商家接单(accepted) → 备餐中(preparing) → 待取餐(ready)
→ 骑手接单配送(delivering) → 已送达(delivered) → 学生确认收货(completed)
```

## License

MIT
