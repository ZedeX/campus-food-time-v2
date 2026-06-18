# 🍽️ 校园食光 (Campus Food Time)

> **让每一餐都透明，让家长更安心**

一款专为学校食堂打造的食谱发布平台，帮助教师轻松发布每日/每周食谱，让家长随时了解孩子的饮食安排。

---

## ✨ 产品亮点

### 🎯 解决痛点
- **信息不对称**：家长无法及时了解学校食堂的食谱安排
- **发布繁琐**：教师需要通过微信群反复发送食谱图片，效率低下
- **历史难查**：过往食谱难以追溯，无法统计分析

### 💡 核心价值
- **一键发布**：教师通过网页端快速上传食谱图片/视频
- **随时查看**：家长通过手机端实时查看当日/本周食谱
- **智能压缩**：前端自动压缩图片视频，节省上传时间
- **历史追溯**：完整保留食谱历史，支持按日期/学期查询

---

## 🚀 技术特色

### 架构设计
- **Cloudflare Workers**：边缘计算，全球加速访问
- **D1 数据库**：SQLite 云端版，SQL 查询灵活高效
- **R2 存储**：私有桶 + Worker 代理，安全可控
- **KV 缓存**：60 分钟食谱缓存，极致响应速度

### 开发实践
- **TDD 开发**：单元测试先行，代码质量保障
- **ISO 8601 标准**：严格遵循国际周数计算规范
- **北京时区**：业务日期统一 UTC+8，避免时区混乱
- **乐观锁并发**：version 字段防止并发编辑冲突

### 安全防护
- **登录防爆破**：IP + 手机号双重限频，自动锁定
- **单设备登录**：同一账号仅允许一台设备在线
- **会话滑动过期**：30 天有效，活跃自动续期
- **媒体鉴权**：R2 私有桶，Worker 校验身份后返回

---

## 📱 功能模块

| 角色 | 功能 |
|------|------|
| **教师** | 发布每日食谱、发布每周食谱、上传图片视频、查看发布历史 |
| **家长** | 查看当日食谱、查看本周食谱、按日期范围查询、注册绑定学生 |
| **管理员** | 管理教师账号、管理家长账号、管理班级学生、学期配置、操作日志、食谱统计、数据归档 |

---

## 🛠️ 快速部署

### 前置条件
- Cloudflare 账号（免费套餐即可）
- GitHub 账号

### 一键部署步骤

```bash
# 1. 克隆仓库
git clone https://github.com/ZedeX/campus-food-time-v2.git
cd campus-food-time-v2

# 2. 安装依赖
npm install

# 3. 创建 Cloudflare 资源
wrangler d1 create campus-food-data-v2
wrangler kv namespace create CACHE
wrangler r2 bucket create campus-food-v2

# 4. 更新 wrangler.toml 中的资源 ID

# 5. 执行数据库迁移
wrangler d1 execute campus-food-data-v2 --remote --file=worker/src/db/0001_initial_schema.sql
wrangler d1 execute campus-food-data-v2 --remote --file=worker/src/db/seed.sql

# 6. 设置密钥
wrangler secret put JWT_SECRET
wrangler secret put ADMIN_USERNAME
wrangler secret put ADMIN_PASSWORD

# 7. 部署
wrangler deploy
```

### GitHub 自动部署

1. 在 GitHub 仓库设置中添加 Secrets：
   - `CLOUDFLARE_API_TOKEN`：Cloudflare API Token
   - `CLOUDFLARE_ACCOUNT_ID`：Cloudflare Account ID

2. 推送代码到 `main` 分支，GitHub Actions 自动触发部署

---

## 🧪 测试

```bash
# 运行单元测试
node --test tests/unit/utils.test.js

# 16 个测试覆盖：
# - ISO 8601 周数计算（边界日期验证）
# - 手机号验证
# - 身份证号验证
# - 菜名归一化
```

---

## 📊 数据模型

- **users**：教师、家长、管理员
- **sessions**：登录会话（单设备）
- **schools**：学校信息
- **classes**：班级（格式：class:学校:年级:班号）
- **students**：学生信息
- **parent_student_relations**：家长-学生多对多关联
- **daily_recipes**：每日食谱（ID：daily_学校_日期）
- **weekly_recipes**：每周食谱（ID：weekly_学校_年周）
- **recipe_media**：食谱媒体文件
- **recipe_snapshots**：食谱历史快照
- **semesters**：学期配置
- **operation_logs**：操作日志（仅 INSERT）
- **dish_aliases**：菜名别名归一化

---

## 🌐 访问地址

- **演示地址**：https://campus-food-time-v2.flychina2008.workers.dev
- **GitHub**：https://github.com/ZedeX/campus-food-time-v2

---

## 📄 许可证

MIT License

---

## 🙏 致谢

- Cloudflare 提供免费的边缘计算平台
- Flatpickr 提供优雅的日期选择组件
- 所有为学校食堂信息化努力的教育工作者