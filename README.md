# 校园食光 (Campus Food Time)

> 让每一餐都透明，让家长更放心

## 简介

**校园食光** 是一个专为学校食堂打造的食谱发布平台，帮助学校轻松发布每日/每周食谱，让家长实时了解孩子的用餐情况。

基于 Cloudflare Workers 构建，采用全球边缘计算架构，确保访问快速稳定。

## 核心功能

- **食谱发布**：教师一键发布每日/每周食谱，支持图片和视频展示
- **家长查看**：家长登录即可查看孩子学校的食谱详情
- **历史回溯**：完整保留食谱历史版本，支持管理员回滚
- **统计分析**：自动统计菜品出现频率，优化膳食搭配
- **数据归档**：支持按学期归档食谱数据，便于长期保存

## 技术亮点

| 特性 | 说明 |
|------|------|
| 全球加速 | Cloudflare 边缘网络，全球 300+ 节点 |
| 零运维 | 无服务器架构，无需维护服务器 |
| 免费部署 | 全部使用 Cloudflare 免费套餐 |
| 安全可靠 | 私有存储桶 + Worker 代理访问 |
| 单设备登录 | 防止账号被盗用，保障数据安全 |
| ISO 8601 标准 | 严格的周数计算，跨年边界准确 |

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare Edge                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │   Workers   │  │     D1      │  │     R2      │      │
│  │  (API层)    │  │  (SQLite)   │  │  (存储桶)   │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│         │                │                │              │
│         └───────┬────────┴────────┬───────┘              │
│                 │                 │                      │
│            ┌────▼────┐      ┌────▼────┐                 │
│            │   KV    │      │  Cache  │                 │
│            │ (缓存)  │      │  API    │                 │
│            └─────────┘      └─────────┘                 │
└─────────────────────────────────────────────────────────┘
```

## 快速开始

### 环境要求

- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare 账号

### 本地开发

```bash
# 克隆项目
git clone https://github.com/ZedeX/campus-food-time-v2.git
cd campus-food-time-v2

# 安装依赖
npm install

# 本地开发
npm run dev

# 运行测试
npm test
```

### 部署到 Cloudflare

```bash
# 登录 Cloudflare
wrangler login

# 创建资源
wrangler d1 create campus-food-data-v2
wrangler kv namespace create CACHE
wrangler r2 bucket create campus-food-v2

# 更新 wrangler.toml 中的资源 ID

# 执行数据库迁移
wrangler d1 execute campus-food-data-v2 --remote --file=worker/src/db/0001_initial_schema.sql
wrangler d1 execute campus-food-data-v2 --remote --file=worker/src/db/seed.sql

# 设置密钥
wrangler secret put JWT_SECRET
wrangler secret put ADMIN_USERNAME
wrangler secret put ADMIN_PASSWORD

# 部署
npm run deploy
```

## 项目结构

```
campus-food-time-v2/
├── worker/                 # Cloudflare Worker 后端
│   └── src/
│       ├── db/            # 数据库 schema 和 seed
│       ├── routes/        # API 路由处理器
│       ├── services/      # 业务逻辑层
│       └── utils/         # 工具函数
├── frontend/              # 前端页面 (Vanilla JS)
│   ├── admin/            # 管理员界面
│   ├── teacher/          # 教师界面
│   ├── parent/           # 家长界面
│   └── assets/           # CSS/JS 资源
├── tests/                 # 测试文件
├── PRD.md                 # 产品需求文档
└── wrangler.toml          # Cloudflare 配置
```

## API 端点

| 端点 | 说明 |
|------|------|
| `POST /auth/teacher/login` | 教师登录 |
| `POST /auth/parent/login` | 家长登录 |
| `POST /auth/admin/login` | 管理员登录 |
| `GET /api/recipes/daily/:date` | 获取每日食谱 |
| `PUT /api/recipes/daily/:date` | 发布每日食谱 |
| `GET /api/recipes/weekly/:yearWeek` | 获取每周食谱 |
| `PUT /api/recipes/weekly/:yearWeek` | 发布每周食谱 |
| `POST /api/upload/presign` | 获取预签名上传 URL |
| `GET /media/:id` | 获取媒体文件 |

## 安全特性

- **登录防爆破**：失败次数限制 + 自动锁定
- **单设备登录**：同一账号只能在一台设备登录
- **私有存储桶**：R2 私有模式，通过 Worker 代理访问
- **会话滑动过期**：30 天有效期，活跃时自动延长
- **操作审计日志**：完整记录所有操作，不可删除

## 许可证

MIT License

---

**让校园食堂更透明，让家长更安心。**

[在线演示](https://campus-food-time-v2.flychina2008.workers.dev) | [问题反馈](https://github.com/ZedeX/campus-food-time-v2/issues)