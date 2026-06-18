# 校园食光 (Campus Food Time) - README

本文档是"校园食光"网站的建设说明，包含产品需求、详细设计、数据结构和项目目录结构，旨在为AI智能体提供清晰的开发蓝图，以便产出整个项目代码文档

## 1. 产品需求文档

### 1.1. 项目简介

- **项目名称**: 校园食光 (Campus Food Time)
- **目标**: 为食堂老师提供一个发布每日和每周食谱（文字与照片）的平台，并允许家长查看。发布内容需结构化保存，方便查询和统计。
- **用户端**: 教师端、家长端、管理端。
- **学校信息**: 目前仅支持单一学校（校区）：上海星河湾双语学校（id=1）。系统架构预留多学校扩展能力，教师账号与学校绑定，教师只能发布食谱到自己所属的学校。教师的学校属性由管理员在创建教师账号时设置。

### 1.2. 用户角色

1. **教师**: 负责发布和管理所在学校（校区）的每日及每周食谱。食谱以学校（校区）为单位，不是以班级为单位。
2. **家长**: 注册后可查看子女所在学校食堂发布的食谱。
3. **管理员**: 对系统数据（食谱、账户等）进行管理和维护，包括手动创建教师账号。

### 1.3. 功能需求

#### 1.3.1. 网站首页

- 提供角色选择："我是老师" 或 "我是家长"。
- **登录状态检测与跳转优化**:
  - 访问首页时，系统自动检测用户登录状态。
  - 若用户已登录，直接跳转到对应身份的首页（教师跳转到教师端，家长跳转到家长端，管理员跳转到管理端）。
  - 跳转过程中不显示登录页面，避免页面闪现，提供流畅的用户体验。
  - 未登录用户显示角色选择页面。

#### 1.3.2. 教师端

- **登录**:
  - 选择"我是老师"后进入教师登录页面。
  - 使用手机号和密码登录。
  - 登录状态保持30天（滑动过期，即以最后一次登录时间算起）。
  - 只允许单设备登录，同一账号在其他设备登录后，之前设备的登录状态将失效。
  - 调试阶段：教师端用户名 `teacher`，密码 `teacher123` 可直接登录。
  - **教师账号由管理员在管理后台手动创建**，教师无法自行注册。
  - **忘记密码**: 教师忘记密码只能找管理员重置（教师账号少，管理员手动处理即可）。
- **退出登录**:
  - 教师端页面右上角显示"退出"按钮。
  - 点击后清除本地登录状态，跳转回首页。
  - 后端同时清除该用户的会话信息。
- **发布/修改食谱 (默认页面)**:
  \-   **日食谱**:
  \-   默认进入【发布食谱】的日食谱页面。
  \-   通过日期选择器选择特定日期进行发布或修改。
  \-   选中日期后，页面自动加载当天内容（无则发布，有则修改）。
  \-   **日期显示**: 日期显示格式包含星期几，如"2024年1月15日 星期一"。
  \-   **日期选择器**: 使用 Flatpickr 第三方日期选择器控件，支持年月日快速切换，提供直观的日历界面。
  \-   页面元素:
  \-   日食谱/周食谱切换按钮。
  \-   日期显示（默认当天，可选择）。
  \-   图片上传（最多6张）:
  \-   标题：全盘、全盘、点心、点心、可选、可选 (标题可修改)。
  \-   **菜名（必填）**: 每张图片对应一道菜，需填写菜名，用于统计功能。
  \-   未上传足够数量时，家长端不显示对应标题。
  \-   图片上传后的命名方式为：`YYYY-MM/YYYY-MM-DD-01.jpg`、`YYYY-MM/YYYY-MM-DD-02.png` 等（按月区隔存储，序号从01开始顺序递增）。
  \-   **粘贴上传支持**: 支持通过剪贴板粘贴图片进行上传。用户可复制图片后，在上传区域或备注文本框内按 Ctrl+V（Mac: Cmd+V）直接粘贴上传。
  \-   视频上传（最多4个）:
  \-   标题：加工过程、加工过程、可选、可选 (标题可修改)。
  \-   未上传足够数量时，家长端不显示对应标题。
  \-   视频上传后的命名方式为：`YYYY-MM/YYYY-MM-DD-10.mp4`、`YYYY-MM/YYYY-MM-DD-11.mov` 等（每日从10开始，按月区隔存储，序号顺序递增）。
  \-   **粘贴上传支持**: 支持通过剪贴板粘贴视频进行上传。用户可复制视频后，在上传区域或备注文本框内按 Ctrl+V（Mac: Cmd+V）直接粘贴上传。
  - **周食谱**:
    - **重要说明**: 周食谱是整体展示一周的食谱清单，形式是PDF转换过的图片，与日食谱没有任何关联。两者完全独立。周食谱仅支持图片上传，不支持视频。
    - 切换到周食谱模式。
    - 通过周选择器选择特定周进行发布或修改（默认当周）。
    - 选中周后，页面自动加载当周内容（无则发布，有则修改）。
    - 页面元素:
      - 周食谱/日食谱切换按钮。
      - 当年周数及对应日期范围（周一至周日，显示完整一周）。
      - 图片上传（最多5张）:
        - 默认标题：风味餐菜单、健康餐菜单、点心菜单 (前三张，标题可修改，其余为可选)。
        - 未上传足够数量时，家长端不显示对应标题。
        - 图片上传后的命名方式为：`YYYY-MM/YYYY-WW-01.jpg`、`YYYY-MM/YYYY-WW-02.jpg` 等（每周从01开始，按月区隔存储，月份按周一所在月份确定，序号顺序递增）。
        - **粘贴上传支持**: 支持通过剪贴板粘贴图片进行上传。
    - **周数计算规则**:
      - 使用ISO周标准。
      - 跨年周处理：2025年12月29日算2025年最后一周，2026年1月5日开始算2026年第一周。
- **图片处理**:
  - 上传前，图片在客户端本地进行压缩。
  - 统一生成高为1080像素、宽度等比缩小的照片后上传，压缩质量参数 `quality=0.8`，以减少云端存储。
- **视频处理**:
  - 上传前，视频在客户端本地进行压缩转码。
  - **技术方案**: 使用 WebCodecs API + Mediabunny 库实现纯前端视频压缩。
  - **核心特性**:
    - GPU 硬件加速编码（优先使用硬件加速）。
    - 支持多种分辨率输出（360p、480p、720p、1080p、4K、8K）。
    - 可调节比特率（100-80000 kbps）。
    - 可调节帧率（10-60 fps）。
    - 智能参数计算（根据目标文件大小自动计算最佳参数）。
  - **编码格式**:
    - 主方案：H.264/AVC 编码（MP4容器），编码器候选：`avc1.42001E`、`avc1.4D401E`、`avc1.64001E`。
    - 降级方案：VP9 编码（WebM容器），使用 MediaRecorder API。
    - **Safari兼容性建议**：
      - Safari 16.4+ 支持 WebCodecs API，但默认未启用，需用户在"开发"菜单中手动开启。
      - Safari 16.4以下版本不支持WebCodecs，建议使用以下替代方案：
        - **FFmpeg.wasm**：基于WebAssembly的FFmpeg，兼容所有现代浏览器，但性能较慢（编码速度约1-5fps）。
        - **MediaRecorder API**：Safari原生支持，但只能录制不能压缩已有视频，可用于降级方案。
        - **推荐方案**：检测浏览器是否支持WebCodecs，不支持则使用FFmpeg.wasm作为降级方案，并在UI中提示用户"视频处理可能需要较长时间"。
  - **压缩流程**:
    1. 解析原视频信息（时长、分辨率、比特率、帧率）。
    2. 根据设置计算输出参数（确保不超过原始视频属性）。
    3. 逐帧解码、缩放、重新编码。
    4. 封装为 MP4 格式输出。
    5. **文件大小限制**：如果转码后的视频超过100MB，则截取前99MB进行上传，后续视频内容丢弃。前端需提示用户"视频过大，已截取前99MB上传"。
  - **安全特性**: 视频完全在本地处理，不上传到服务器，100% 隐私安全。
  - **降级体验**:
    - 检测到不支持 WebCodecs 时，弹窗明确告知"预计需要 X 分钟"。
    - 显示进度条（基于已处理帧数 / 总帧数）。
    - 提供"跳过压缩，直接上传原视频"选项（但有 100MB 限制）。
    - 提供"取消"按钮。
    - 超过 5 分钟的视频提示"建议在电脑端处理"。
  - **推荐**: 建议用户只上传 30 秒以内的视频，以保证压缩和上传速度。
  - 上传中断后丢弃，不支持断点续传。
- **查看历史版本**:
  - 教师可以查看自己发布过的食谱历史版本（只读）。
  - 不能回滚版本（只有管理员才能回滚）。
- **草稿功能（前端实现）**:
  - 前端用 localStorage 自动保存草稿（每 10 秒）。
  - 切换日期时如果检测到未保存内容，提示"是否保存草稿"。
  - 重新打开同日期时检测到草稿，提示"是否恢复未保存的内容"。
  - 不需要后端支持，纯前端实现。

#### 1.3.3. 家长端

- **注册/登录**:
  - 选择"我是家长"后，判断登录状态。
  - 未登录新用户需注册：
    - 输入学生姓名、身份证号、手机号、选择对应班级（班级从下拉框选择）。
    - **姓名格式校验**: 学生姓名需符合中文或英文姓名格式要求。
    - **身份证号格式校验**: 学生身份证号需符合中国身份证号格式校验规则。
    - **身份验证规则**:
      - 管理员需在后台预先录入学生信息（姓名、班级、身份证前3位和后4位），支持手动录入或CSV导入。
      - 注册时验证：学生姓名 + 对应班级 + 身份证前3位和后4位（如`330***********351X`中的`330`和`351X`）必须完全匹配后台白名单才能通过验证。
      - 若后台该学生的身份证号为空，则身份证字段不参与校验，此时家长填写任意符合格式的身份证号即可通过（即只需姓名+班级匹配即可）。
      - **一个学生允许多个家长注册**（如爸爸、妈妈分别使用不同手机号注册），系统通过学生信息匹配，不限制家长账号数量。
    - **家长信息存储**:
      - 家长注册时输入的完整身份证号需存储在数据库中，与学生姓名、班级、手机号一起保存。
      - 后台存储的前3后4位仅用于注册验证，验证通过后仍需保存完整身份证号。
  - 已登录用户直接进入餐食查看页。
  - 登录状态保持30天（滑动过期，单设备登录）。
  - **忘记密码**: MVP 阶段由管理员在后台重置（生成临时密码或随机密码，告知家长）。不提供短信验证码功能。
  - 调试阶段：家长端用户名 `parent`，密码 `parent123` 可直接登录。
- **查看餐食**:
  - **日食谱**:
    - 默认显示当日餐食。
    - 若教师未上传，则显示提示信息（如"今日食谱暂未上传"）。
    - 可查看前一天或后一天的餐食，包括图片和视频。
    - 可通过日历选择器选择特定日期查看。
    - 系统不对日期进行限制，教师可以发布任意日期的食谱，家长可以查看任意日期的食谱（若该日期有食谱）。
    - **日期显示**: 日期显示格式包含星期几，如"2024年1月15日 星期一"。
    - **日期选择器**: 使用 Flatpickr 第三方日期选择器控件，支持年月日快速切换。
    - **媒体预览**: 点击图片或视频可在页面中预览，每个媒体文件都有独立的URL，支持直接分享链接。
  - **周食谱**:
    - **重要说明**: 周食谱是整体展示一周的食谱清单，形式是PDF转换过的图片，与日食谱没有任何关联。两者完全独立。周食谱仅包含图片，不含视频。
    - 可切换查看当周食谱。
    - 可查看上一周或下一周的食谱，包括图片。
    - 可通过周选择器快速选择某一周查看。
    - **媒体预览**: 点击图片可在页面中预览，每个媒体文件都有独立的URL。

#### 1.3.4. 管理端

- **入口**: URL 路径 `/zxadmin/`（不依赖隐藏，防护靠登录鉴权）。
- **登录**: 
  - 用户名 `zx`，密码 `1qaz!QAZ`。
  - **调试账号**: 调试账号（`teacher/teacher123`、`parent/parent123`、`zx/1qaz!QAZ`）通过环境变量配置，生产环境不注入这些变量 → 调试账号自动失效。
  - **登录防爆破**: 同 IP + 同账号 5 次失败 → 锁定 15 分钟；同 IP 20 次失败 → 锁定 1 小时。用 KV 记录失败次数（TTL 自动过期）。
  - **人机验证**: 管理端登录加 Cloudflare Turnstile（免费版），防止机器人爆破。
- **管理控制台**: 标准后台管理界面。
  - 左侧菜单项:
    - 管理日食谱
    - 管理周食谱
    - 管理老师账号
    - 管理家长账号
    - 管理班级信息
    - 管理学生信息（用于家长注册验证）
    - 管理学期信息
    - 数据统计
    - 数据归档
    - 操作日志（教师端操作日志 + 管理端操作日志）
  - 功能：通过表格方式快速查看及修改上述各项数据。
- **班级管理**:
  - 管理员可手动创建班级。
  - 班级可设置在前台显示/隐藏状态（隐藏的班级在家长注册时不可选）。
- **学生信息管理**:
  - 管理员可手动录入或通过CSV导入学生信息（姓名、班级、身份证前3位和后4位）。
  - 学生信息用于家长注册时的身份验证。
- **教师账号管理**:
  - 管理员可手动创建教师账号。
  - 可查看教师账号的真实密码（密码使用可逆加密存储）。
- **版本历史查看**:
  - 管理员可查看所有食谱的历史版本（snapshot）。
  - 前台教师和家长只能看到最新一份食谱。
  - **食谱详情查看**: 管理员可查看任意食谱的详细内容，包括所有图片、视频、菜名、备注等信息。
  - **版本恢复**: 管理员可将食谱恢复到任意历史版本（snapshot），恢复操作会创建新的snapshot记录当前状态，然后恢复到指定版本。
- **数据统计**:
  \-   统计每种菜品（按菜名）每个学期出现的次数。
  \-   菜名来源于日食谱中每张图片对应的菜名字段。
  - **学期管理**:
    - 管理员可在管理后台设置学期的开始和结束日期。
    - 系统初始化时，默认设置：
      - 上学期：每年9月1日 \~ 次年1月31日
      - 下学期：每年3月1日 \~ 6月30日（注：6月31日不存在，应为6月30日）
    - 学期ID格式：`YYYY-YYYY-N`（如`2024-2025-2`表示2024-2025学年第二学期）
- **数据归档**:
  \-   每学期结束可以把当学期的所有食谱、snapshot、图片、视频等信息打包。
  \-   归档内容：
  \-   **元数据**：所有食谱数据、snapshot历史、用户信息等导出为JSON格式，管理员可下载。
  \-   **多媒体数据**：当学期的所有图片和视频文件打包为ZIP压缩文件，管理员可下载。
  \-   管理员可以下载归档文件。
  \-   管理员可以从管理控制台删除已下载的归档文件。
- **孤儿文件清理**:
  - 当前版本 + 所有 snapshot 引用的文件：保留。
  - 既不在当前版本也不在任何 snapshot 中的文件：标记为"孤儿"。
  - 管理端提供"孤儿文件清理"功能，管理员手动触发清理（删除 R2 文件 + 删除 recipe_media 记录）。
  - 清理前生成清单供管理员确认。

### 1.4. 非功能需求

- **UI/UX 设计**: 简洁、专业、响应式设计，支持移动设备，流畅动画和视觉效果。
- **独立URL支持**:
  - 所有主要页面均支持独立URL访问，便于分享和书签收藏。
  - **管理端**: 使用URL hash参数记录当前菜单状态，如 `#menu=daily-recipes`、`#menu=teachers` 等。
  - **教师端**: 使用URL hash参数记录当前标签页和日期/周，如 `#tab=daily&date=2024-01-15`、`#tab=weekly&week=2024-W03`。
  - **家长端**: 使用URL hash参数记录当前标签页和日期/周，如 `#tab=daily&date=2024-01-15`、`#tab=weekly&week=2024-W03`。
  - **媒体预览页**: 每个媒体文件都有独立的URL，格式如 `/media.html?id=xxx&type=daily`。
  - 页面加载时自动解析URL参数并恢复对应状态，支持浏览器前进/后退按钮。
- **部署**: Cloudflare Workers + Pages + D1 + KV + R2（全部使用免费版）。
  - Worker 名称: `campus-food-time`
  - D1 数据库: `campus_food_data`（存储所有业务数据，包括用户、食谱、媒体元数据、snapshot、操作日志、学生信息、班级信息、学期信息等）
  - KV 命名空间: `campus_food_cache`（仅用于：①会话 token 黑名单缓存 ②系统配置热缓存 ③预签名 URL 临时存储 ④登录失败次数计数，TTL 自动过期）
  - 存储桶名称 (Cloudflare R2 for files): `campus-food`（私有桶，通过 Worker 代理访问）
- **后端能力**: 具备数据处理能力。
- **前端性能**: 适应多家长同时访问。
- **分页机制**:
  - 管理端所有列表接口（食谱列表、用户列表、学生列表、日志列表等）均支持分页。
  - 分页参数：`page`（页码，从1开始）、`pageSize`（每页条数，默认20，最大100）。
  - 返回参数：`data`（数据列表）、`total`（总条数）、`page`（当前页码）、`pageSize`（每页条数）。
- **操作日志**:
  - **教师端操作日志**: 记录教师登录、发布/修改/删除食谱、上传/删除文件等操作。
  - **管理端操作日志**: 记录管理员登录、创建/修改/删除用户、修改食谱、回滚版本、归档数据等操作。
  - **日志存储**: 统一存储在 D1 的 `operation_logs` 表中（不使用 KV 存储日志）。
  - **日志不可篡改**: 日志表只允许 INSERT，不允许 UPDATE/DELETE（应用层限制）。管理端不提供"删除单条日志"功能，只提供"导出"和"按条件查看"。
  - **日志归档**: 定期归档到 R2（只追加，不可修改）。
  - 日志内容：操作人、操作时间、操作类型、操作对象、操作结果。
  - **日志筛选功能**:
    - 支持按用户类型筛选（教师/管理员）。
    - 支持按操作类型筛选（登录、发布、修改、删除等）。
    - 支持按操作人筛选。
    - 支持按时间范围筛选（开始日期\~结束日期）。
    - 支持多条件组合筛选（SQL WHERE 组合查询）。
- **异常处理**:
  - 上传中断：提示用户"上传已中断，请重新上传"。
  - 网络异常：提示用户"网络连接失败，请检查网络后重试"。
  - 请求超时：提示用户"请求超时，请稍后重试"。
  - 所有异常均使用非阻塞式通知组件提示，不使用`alert`。
- **缓存策略**:
  - 使用 Cloudflare Workers Cache API 缓存热门食谱数据。
  - 缓存时长：60 分钟（食谱更新频率低，基本不会频繁更新）。
  - 缓存粒度：按 `school_id + date`（日食谱）或 `school_id + year_week`（周食谱）缓存。
  - 教师发布/更新食谱时自动清除对应缓存。
  - 目标：支撑 500 并发读（D1 免费版 + Cache 层）。
- **时区规则**:
  - **业务日期**（食谱日期、学期日期等）：统一用"北京日期"（UTC+8），存储为 TEXT `YYYY-MM-DD`（不带时区）。
  - 前端传日期时传 `YYYY-MM-DD`（已是北京日期），后端原样存储。
  - **时间戳**（`created_at`、`updated_at`、操作时间等）：用 UTC ISO 8601 存储，前端展示时转北京时间。
- **登录防爆破**:
  - 同 IP + 同手机号：5 次失败 → 锁定 15 分钟。
  - 同 IP：20 次失败 → 锁定 1 小时。
  - 用 KV 记录失败次数（TTL 自动过期，无需手动清理）。
  - 管理端登录额外加 Cloudflare Turnstile（免费版，人机验证）。
- **API 版本化**:
  - 当前 API 无版本化，前后端同源部署，不存在版本不一致问题。
  - 后续如开放给第三方或 App，再加 `/api/v1/...` 版本前缀。
- **性能指标**:
  - 页面首次加载时间：桌面端 < 2秒，移动端 < 3秒。
  - API响应时间：P95 < 500ms，P99 < 1秒。
  - 图片压缩时间：单张图片 < 1秒（1080p）。
  - 视频压缩时间：1分钟视频 < 30秒（720p，H.264硬件加速）。
  - 并发支持：支持至少100个家长同时访问。
- **安全性**:
  - 密码使用可逆加密存储，管理员后台可查看真实密码。
  - 用户名和密码不在前端暴露。
- **用户提示**: 采用友好的非 `alert` 式提示。

### 1.5. 技术栈

- **技术栈**:
  - **前端**: HTML5 Canvas, CSS3, Vanilla JavaScript
  - **后端/部署**: Cloudflare Workers（免费版）
  - **数据库**: Cloudflare D1（免费版，SQLite）
  - **缓存/KV**: Cloudflare KV（免费版，用于会话黑名单、配置缓存、预签名URL、失败计数）
  - **文件存储**: Cloudflare R2（免费版，私有桶）
  - **构建工具**: Wrangler

### 1.6. 通知机制（预留）

- 暂时不实现通知机制。
- 代码中留好空函数位置并写好注释，等后续实现。
- 预留接口：
  - `sendNotification(userId, message)` - 发送站内通知
  - `sendSMS(phone, message)` - 发送短信通知
  - `notifyNewRecipe(schoolId, recipeType, date)` - 通知新食谱发布
- **家长端搜索功能预留**:
  - MVP 不实现家长端搜索功能。
  - 后续迭代可支持按菜名、日期范围搜索食谱。

## 2. 详细设计文档

### 2.1. 系统架构

- **前端 (Cloudflare Pages)**: 托管静态资源 (HTML, CSS, Vanilla JS)。负责用户界面、交互逻辑、客户端数据校验、图片本地压缩、视频本地压缩。
- **后端 (Cloudflare Workers -** **`campus-food-time`)**: 提供API接口，处理用户认证、食谱管理（CRUD）、数据查询、版本控制、媒体文件代理访问等。
- **数据存储**:
  - **Cloudflare D1 (`campus_food_data`)**: 存储所有业务数据，包括用户信息（教师、家长、管理员账户）、食谱文本内容、图片/视频元数据（如标题、R2文件Key）、配置信息、版本历史（snapshot）、操作日志、学生信息、班级信息、学期信息、菜名别名等。使用SQL进行查询，支持分页、统计、复杂查询等。
  - **Cloudflare KV (`campus_food_cache`)**: 仅用于缓存和临时数据：①会话 token 黑名单缓存 ②系统配置热缓存 ③预签名 URL 临时存储 ④登录失败次数计数（TTL 自动过期）。
  - **Cloudflare R2 (`campus-food`)**: **私有桶**，存储教师上传的压缩后的图片和视频文件。不公开访问，通过 Worker 代理 `/media/:id` 访问，Worker 校验登录态后返回文件流。
- **缓存层 (Workers Cache API)**: 缓存热门食谱查询结果，缓存时长 60 分钟，减少 D1 读压力。教师发布/更新食谱时自动清除对应缓存。

### 2.2. UI/UX 设计

- **整体风格**: 简洁、直观、易用。
- **响应式**: 确保在桌面、平板、手机等不同设备上均有良好体验。
- **关键页面流程**:
  1. **首页**: 清晰的角色选择入口。
  2. **登录/注册**: 简洁的表单，明确的错误提示和加载状态。
  3. **教师端 - 食谱发布**: 直观的日期/周选择器，易用的图片/视频上传控件（带预览和标题编辑），清晰的发布/更新按钮。
  4. **家长端 - 食谱查看**: 易于导航的日期/周切换，清晰展示食谱图片和文字信息。
  5. **管理端**: 标准的后台表格布局，提供搜索、筛选、编辑、删除、版本历史查看等操作。
- **组件**: 自定义日期选择器、周选择器、图片/视频上传器、非阻塞式通知组件。
- **动画与过渡**: 使用CSS3动画实现平滑的页面过渡和元素交互效果。

### 2.3. 关键功能模块设计

#### 2.3.1. 用户认证与会话管理

- **教师登录**:
  - 后端Worker验证凭据。
  - 成功后，生成一个有时效性（30天）的Token (e.g., JWT)，存储在HTTP Only Cookie中。
  - **单设备登录**:
    - 在D1的`sessions`表中存储session记录，包含session ID、user\_id和过期时间。
    - 新登录时，生成新的session ID并更新D1记录，旧session自动失效（DELETE旧记录后INSERT新记录）。
    - 每次API调用时，验证请求中的session ID与D1中存储的是否一致。
  - **滑动过期**:
    - 每次API调用时，更新D1中session记录的过期时间（延长30天）。
    - SQL实现：`UPDATE sessions SET expires_at = datetime('now', '+30 days') WHERE session_id = ?`
  - 教师账号由管理员手动创建，不可自行注册。
- **家长登录**:
  - 同教师登录机制（30天滑动过期，单设备登录，D1存储session）。
- **家长注册**:
  - 后端Worker处理注册请求。
  - 验证信息：手机号唯一性、学生姓名+身份证号+班级组合有效性。
  - 存入D1。
- **调试登录**: 后端Worker硬编码处理调试账号登录逻辑。

#### 2.3.2. 食谱管理 (CRUD)

- **创建/更新**: 教师端通过 API 将食谱数据（文本、图片/视频标题）和文件发送到Worker。
  - Worker接收文本数据存入D1。
  - **文件上传流程（预签名 URL 直传 R2）**:
    1. 前端先请求预签名 URL：`POST /api/upload/presign`，获取 R2 上传 URL。
    2. 前端使用预签名 URL 直接将文件上传至 R2（不经过 Worker 中转，避免 Worker 内存限制）。
    3. 前端将文件 R2 Key 提交给 Worker，Worker 将 R2 Key 存入 D1 对应的食谱记录中。
  - **乐观锁（并发控制）**: `daily_recipes` 和 `weekly_recipes` 表含 `version` 字段。PUT 请求需带 `If-Match: <version>`，版本不匹配返回 409 Conflict。前端编辑时定时（每 30 秒）拉取最新版本，检测到他人修改时提示"食谱已被他人修改，是否刷新"。
    - **注**: 目前业务场景为单一学校由 1 个教师管理食谱，并发冲突概率低，乐观锁作为防护措施保留。
  - **版本控制**: 每次更新时，创建当前版本的snapshot保存到D1的`recipe_snapshots`表。
  - **覆盖机制**: 同一日期/周的食谱可以被同一学校的教师覆盖更新，覆盖前系统自动保存当前版本的snapshot。
- **读取**: 家长端和教师端通过API从Worker请求特定日期/周的食谱。Worker从D1读取最新版本数据并返回。
- **删除**: 管理员通过管理端API删除食谱数据（D1记录和对应的R2文件）。
  - **注意**: 由于有snapshot版本历史，上传的图片不清除，保留用于历史记录。

#### 2.3.3. 图片/视频处理

- **客户端压缩 (图片)**: 使用HTML5 Canvas `toDataURL('image/jpeg', quality)` 或 `toBlob()` 方法在上传前压缩图片至1080p高度，保持宽高比，并控制文件大小。
- **客户端压缩 (视频)**: 使用 `video-compress.html` 中的技术进行视频压缩转码。
- **文件上传**: 前端通过预签名 URL 直接上传压缩后的文件到 Cloudflare R2（不经过 Worker 中转）。
- **上传中断处理**: 上传中断后丢弃，不支持断点续传。用户需重新上传。
- **文件存储**: R2 存储文件（私有桶），D1 存储文件的元数据（R2 Key、标题、菜名等）。访问时通过 Worker 代理 `/media/:id` 读取。

#### 2.3.4. 管理端功能

- Worker提供受保护的API接口供管理端调用，实现对D1中各类数据的增删改查。
- 版本历史查看：管理员可查看所有食谱的历史版本。
- 数据统计：统计每种食谱每个学期出现的次数（使用SQL GROUP BY查询）。
- 数据归档（异步）: 
  - `POST /admin/api/archive/create` 立即返回 `archiveId` 和 `status: "processing"`。
  - 后台用 Cloudflare Queues 或 Durable Objects 异步打包。
  - 前端轮询 `GET /admin/api/archive/:id` 获取状态（processing/completed/failed）。
  - 完成后返回 `downloadUrl`。
  - **元数据快速导出**: 归档只导出元数据 JSON（快速完成），多媒体文件提供"按日期范围批量下载"接口（前端分批下载）。
- 操作日志：查看教师端和管理端的操作日志。

#### 2.3.5. 版本控制与历史记录

- **Snapshot机制**: 每次食谱更新时，保存当前状态的snapshot到D1的`recipe_snapshots`表。
- **存储方式**:
  - 最新版本：存储在`daily_recipes`或`weekly_recipes`表中
  - 历史版本：存储在`recipe_snapshots`表中，通过`recipe_id`和`version`关联
- **访问权限**:
  - 教师/家长：只能看到最新版本
  - 管理员：可以看到所有历史版本
- **版本回滚**:
  - 管理员可在管理后台选择历史版本进行回滚。
  - 回滚操作将指定历史版本恢复为最新版本，并在`recipe_snapshots`表中创建新的snapshot记录回滚前的状态。

### 2.4. API 端点设计

Base URL: Cloudflare Worker URL

#### 2.4.1. 认证相关

| 方法   | 端点                      | 描述     | 权限  |
| ---- | ----------------------- | ------ | --- |
| POST | `/auth/teacher/login`   | 教师登录   | 公开  |
| POST | `/auth/parent/login`    | 家长登录   | 公开  |
| POST | `/auth/parent/register` | 家长注册   | 公开  |
| POST | `/auth/admin/login`     | 管理员登录  | 公开  |
| POST | `/auth/logout`          | 登出     | 已认证 |
| GET  | `/auth/check`           | 检查登录状态 | 已认证 |

#### 2.4.2. 用户相关

| 方法  | 端点                   | 描述       | 权限  |
| --- | -------------------- | -------- | --- |
| GET | `/api/user/profile`  | 获取当前用户信息 | 已认证 |
| PUT | `/api/user/profile`  | 更新当前用户信息 | 已认证 |
| PUT | `/api/user/password` | 修改密码     | 已认证 |
| PUT | `/api/user/phone`    | 修改手机号    | 已认证 |

#### 2.4.3. 食谱相关

| 方法  | 端点                               | 描述                     | 权限    |
| --- | -------------------------------- | ---------------------- | ----- |
| GET | `/api/recipes/daily/:date`       | 获取指定日期的日食谱             | 教师/家长 |
| PUT | `/api/recipes/daily/:date`       | 创建或更新日食谱（不存在则创建，存在则更新） | 教师    |
| GET | `/api/recipes/daily/current`     | 获取当日食谱                 | 教师/家长 |
| GET | `/api/recipes/daily/date-range`  | 获取日期范围内的食谱列表           | 教师/家长 |
| GET | `/api/recipes/weekly/:yearWeek`  | 获取指定周的周食谱              | 教师/家长 |
| PUT | `/api/recipes/weekly/:yearWeek`  | 创建或更新周食谱（不存在则创建，存在则更新） | 教师    |
| GET | `/api/recipes/weekly/current`    | 获取当周食谱                 | 教师/家长 |
| GET | `/api/recipes/weekly/week-range` | 获取周范围内的食谱列表            | 教师/家长 |

#### 2.4.4. 文件上传

| 方法   | 端点                   | 描述                          | 权限 |
| ---- | -------------------- | --------------------------- | -- |
| POST | `/api/upload/presign` | 获取 R2 预签名上传 URL（前端直传 R2） | 教师 |
| GET  | `/media/:id`          | 媒体文件代理访问（Worker 校验登录态后返回文件流）  | 已认证 |

#### 2.4.5. 公共接口

| 方法  | 端点             | 描述     | 权限 |
| --- | -------------- | ------ | -- |
| GET | `/api/classes` | 获取班级列表 | 公开 |
| GET | `/api/schools` | 获取学校列表 | 公开 |
| GET | `/api/config`  | 获取系统配置 | 公开 |

#### 2.4.6. 管理端 - 食谱管理

| 方法     | 端点                                      | 描述        | 权限  |
| ------ | --------------------------------------- | --------- | --- |
| GET    | `/admin/api/recipes/daily`              | 获取日食谱列表   | 管理员 |
| PUT    | `/admin/api/recipes/daily/:id`          | 更新日食谱     | 管理员 |
| DELETE | `/admin/api/recipes/daily/:id`          | 删除日食谱     | 管理员 |
| GET    | `/admin/api/recipes/daily/:id/history`  | 获取日食谱历史版本 | 管理员 |
| GET    | `/admin/api/recipes/weekly`             | 获取周食谱列表   | 管理员 |
| PUT    | `/admin/api/recipes/weekly/:id`         | 更新周食谱     | 管理员 |
| DELETE | `/admin/api/recipes/weekly/:id`         | 删除周食谱     | 管理员 |
| GET    | `/admin/api/recipes/weekly/:id/history` | 获取周食谱历史版本 | 管理员 |

#### 2.4.7. 管理端 - 用户管理

| 方法     | 端点                        | 描述     | 权限  |
| ------ | ------------------------- | ------ | --- |
| GET    | `/admin/api/teachers`     | 获取教师列表 | 管理员 |
| POST   | `/admin/api/teachers`     | 创建教师账号 | 管理员 |
| PUT    | `/admin/api/teachers/:id` | 更新教师信息 | 管理员 |
| DELETE | `/admin/api/teachers/:id` | 删除教师账号 | 管理员 |
| GET    | `/admin/api/parents`      | 获取家长列表 | 管理员 |
| PUT    | `/admin/api/parents/:id`  | 更新家长信息 | 管理员 |
| DELETE | `/admin/api/parents/:id`  | 删除家长账号 | 管理员 |

#### 2.4.8. 管理端 - 班级管理

| 方法     | 端点                       | 描述     | 权限  |
| ------ | ------------------------ | ------ | --- |
| GET    | `/admin/api/classes`     | 获取班级列表 | 管理员 |
| POST   | `/admin/api/classes`     | 创建班级   | 管理员 |
| PUT    | `/admin/api/classes/:id` | 更新班级信息 | 管理员 |
| DELETE | `/admin/api/classes/:id` | 删除班级   | 管理员 |

#### 2.4.9. 管理端 - 学生信息管理

| 方法     | 端点                           | 描述        | 权限  |
| ------ | ---------------------------- | --------- | --- |
| GET    | `/admin/api/students`        | 获取学生列表    | 管理员 |
| POST   | `/admin/api/students`        | 创建学生信息    | 管理员 |
| POST   | `/admin/api/students/import` | CSV导入学生信息 | 管理员 |
| PUT    | `/admin/api/students/:id`    | 更新学生信息    | 管理员 |
| DELETE | `/admin/api/students/:id`    | 删除学生信息    | 管理员 |

#### 2.4.10. 管理端 - 学校管理

| 方法     | 端点                       | 描述     | 权限  |
| ------ | ------------------------ | ------ | --- |
| GET    | `/admin/api/schools`     | 获取学校列表 | 管理员 |
| POST   | `/admin/api/schools`     | 创建学校   | 管理员 |
| PUT    | `/admin/api/schools/:id` | 更新学校信息 | 管理员 |
| DELETE | `/admin/api/schools/:id` | 删除学校   | 管理员 |

#### 2.4.11. 管理端 - 配置与统计

| 方法  | 端点                                           | 描述       | 权限  |
| --- | -------------------------------------------- | -------- | --- |
| GET | `/admin/api/config`                          | 获取系统配置   | 管理员 |
| PUT | `/admin/api/config`                          | 更新系统配置   | 管理员 |
| GET | `/admin/api/statistics/recipes`              | 获取食谱统计数据 | 管理员 |
| GET | `/admin/api/statistics/semester/:semesterId` | 获取学期统计   | 管理员 |

#### 2.4.12. 管理端 - 数据归档

| 方法     | 端点                                | 描述     | 权限  |
| ------ | --------------------------------- | ------ | --- |
| POST   | `/admin/api/archive/create`       | 创建学期归档 | 管理员 |
| GET    | `/admin/api/archive/list`         | 获取归档列表 | 管理员 |
| GET    | `/admin/api/archive/:id/download` | 下载归档文件 | 管理员 |
| DELETE | `/admin/api/archive/:id`          | 删除归档文件 | 管理员 |

## 3. 数据库表结构（Cloudflare D1）

### 3.1. 用户表 (users)

| 字段名                 | 类型       | 示例值                    | 描述                         |
| ------------------- | -------- | ---------------------- | -------------------------- |
| id                  | TEXT     | "teacher\_001"         | 用户ID（主键）                   |
| type                | TEXT     | "teacher"              | 用户类型（teacher/parent/admin） |
| phone               | TEXT     | "13800138000"          | 手机号                        |
| password            | TEXT     | "encrypted\_password"  | 密码（可逆加密）                   |
| name                | TEXT     | "张老师"                  | 姓名                         |
| school\_id          | INTEGER  | 1                      | 学校ID                       |
| status              | TEXT     | "active"               | 状态（active/disabled）        |
| created\_at         | DATETIME | "2025-09-01T00:00:00Z" | 创建时间                       |
| updated\_at         | DATETIME | "2025-09-01T00:00:00Z" | 更新时间                       |

**注**: 家长的学生关联信息存储在 parent_student_relations 表中。

### 3.2. Session表 (sessions)

| 字段名            | 类型       | 示例值                    | 描述             |
| -------------- | -------- | ---------------------- | -------------- |
| id             | TEXT     | "session\_uuid"        | Session ID（主键） |
| user\_id       | TEXT     | "teacher\_001"         | 用户ID           |
| session\_id    | TEXT     | "jwt\_token\_or\_uuid" | 会话标识           |
| expires\_at    | DATETIME | "2025-10-26T00:00:00Z" | 过期时间           |
| last\_accessed | DATETIME | "2025-09-26T10:00:00Z" | 最后访问时间         |
| created\_at    | DATETIME | "2025-09-26T10:00:00Z" | 创建时间           |

### 3.3. 日食谱表 (daily\_recipes)

| 字段名         | 类型       | 示例值                    | 描述       |
| ----------- | -------- | ---------------------- | -------- |
| id          | TEXT     | "daily\_1\_20251026"   | 食谱ID（主键，格式：daily\_<school_id>_<date>） |
| date        | TEXT     | "2025-10-26"           | 日期       |
| school\_id  | INTEGER  | 1                      | 学校ID     |
| notes       | TEXT     | "今日特色：有机蔬菜"            | 备注       |
| version     | INTEGER  | 2                      | 版本号      |
| created\_by | TEXT     | "teacher\_001"         | 创建人      |
| created\_at | DATETIME | "2025-10-25T16:40:22Z" | 创建时间     |
| updated\_at | DATETIME | "2025-10-26T09:15:30Z" | 更新时间     |

**约束**: UNIQUE(school_id, date)

### 3.4. 周食谱表 (weekly\_recipes)

| 字段名          | 类型       | 示例值                    | 描述       |
| ------------ | -------- | ---------------------- | -------- |
| id           | TEXT     | "weekly\_1\_2025W43"   | 食谱ID（主键，格式：weekly\_<school_id>_<yearWeek>） |
| year\_week   | TEXT     | "2025-W43"             | 年周       |
| year         | INTEGER  | 2025                   | 年份       |
| week\_number | INTEGER  | 43                     | 周数       |
| start\_date  | TEXT     | "2025-10-20"           | 开始日期     |
| end\_date    | TEXT     | "2025-10-26"           | 结束日期     |
| school\_id   | INTEGER  | 1                      | 学校ID     |
| notes        | TEXT     | "本周营养均衡搭配"             | 备注       |
| version      | INTEGER  | 1                      | 版本号      |
| created\_by  | TEXT     | "teacher\_001"         | 创建人      |
| created\_at  | DATETIME | "2025-10-19T10:30:15Z" | 创建时间     |
| updated\_at  | DATETIME | "2025-10-19T10:30:15Z" | 更新时间     |

**约束**: UNIQUE(school_id, year_week)

### 3.5. 食谱媒体表 (recipe\_media)

| 字段名          | 类型       | 示例值                         | 描述                 |
| ------------ | -------- | --------------------------- | ------------------ |
| id           | TEXT     | "img1"                      | 媒体ID（主键）           |
| recipe\_id   | TEXT     | "daily\_20251026"           | 食谱ID               |
| recipe\_type | TEXT     | "daily"                     | 食谱类型（daily/weekly） |
| media\_type  | TEXT     | "image"                     | 媒体类型（image/video）  |
| dish\_name   | TEXT     | "红烧肉"                       | 菜名（仅日食谱图片）         |
| title        | TEXT     | "全盘营养餐"                     | 标题                 |
| url          | TEXT     | "https\://..."              | R2文件URL            |
| filename     | TEXT     | "2025-10/2025-10-26-01.jpg" | 文件名                |
| order\_num   | INTEGER  | 1                           | 排序                 |
| created\_at  | DATETIME | "2025-10-25T16:40:22Z"      | 创建时间               |

### 3.6. 食谱快照表 (recipe\_snapshots)

| 字段名            | 类型       | 示例值                    | 描述                 |
| -------------- | -------- | ---------------------- | ------------------ |
| id             | TEXT     | "snapshot\_uuid"       | 快照ID（主键）           |
| recipe\_id     | TEXT     | "daily\_20251026"      | 食谱ID               |
| recipe\_type   | TEXT     | "daily"                | 食谱类型（daily/weekly） |
| version        | INTEGER  | 1                      | 版本号                |
| snapshot\_data | TEXT     | "{...}"                | 快照JSON数据           |
| created\_at    | DATETIME | "2025-10-26T09:15:30Z" | 创建时间               |
| created\_by    | TEXT     | "teacher\_001"         | 创建人                |

**保留策略**:
- 保留最近 20 个版本 + 所有"被管理员标记"的版本。
- 超出保留策略的旧版本在归档时导出到 R2 的 JSON 文件中，然后从 D1 删除。
- **数据量估算**: 每年约 180 个食谱（2 学期 × 约 9 个月 × 每月约 20 个工作日），每个食谱最多 20 个 snapshot，年数据量可控。

### 3.7. 班级表 (classes)

| 字段名           | 类型       | 示例值                    | 描述       |
| ------------- | -------- | ---------------------- | -------- |
| id            | TEXT     | "class:1:1:1"          | 班级ID（主键，格式：class:<school_id>:<grade>:<class_number>） |
| name          | TEXT     | "一年级(1)班"              | 班级名称     |
| grade         | INTEGER  | 1                      | 年级       |
| class\_number | INTEGER  | 1                      | 班级编号     |
| school\_id    | INTEGER  | 1                      | 学校ID     |
| visible       | BOOLEAN  | true                   | 是否可见     |
| created\_at   | DATETIME | "2025-09-01T00:00:00Z" | 创建时间     |
| updated\_at   | DATETIME | "2025-09-01T00:00:00Z" | 更新时间     |

**说明**: 班级只是辅助记录家长和学生身份的信息，不与食谱挂钩。如 class:1:3:2 = 学校1的3年级2班。

### 3.8. 学生信息表 (students)

| 字段名         | 类型       | 示例值                    | 描述            |
| ----------- | -------- | ---------------------- | ------------- |
| id          | TEXT     | "student\_001"         | 学生ID（主键）      |
| name        | TEXT     | "张小明"                  | 学生姓名          |
| class\_id   | TEXT     | "class:1:1"            | 班级ID          |
| school\_id  | INTEGER  | 1                      | 学校ID          |
| id\_number  | TEXT     | "310101201501011234"   | 完整身份证号        |
| id\_prefix  | TEXT     | "310"                  | 身份证号前3位（用于验证） |
| id\_suffix  | TEXT     | "1234"                 | 身份证号后4位（用于验证） |
| created\_at | DATETIME | "2025-09-01T00:00:00Z" | 创建时间          |
| updated\_at | DATETIME | "2025-09-01T00:00:00Z" | 更新时间          |

### 3.8.1. 家长-学生关联表 (parent_student_relations)

| 字段名         | 类型       | 示例值                    | 描述                |
| ------------- | -------- | ---------------------- | ----------------- |
| id            | TEXT     | "rel_001"              | 关联ID（主键）          |
| parent_user_id| TEXT     | "parent_001"           | 家长用户ID（外键→users）  |
| student_id    | TEXT     | "student_001"          | 学生ID（外键→students） |
| relation      | TEXT     | "父亲"                  | 关系（父亲/母亲/其他）      |
| created_at    | DATETIME | "2025-09-01T00:00:00Z" | 创建时间              |

**说明**: 
- 一个家长可关联多个学生（双胞胎、跨年级）。
- 一个学生可被多个家长关联（爸爸、妈妈分别注册）。
- **约束**: UNIQUE(parent_user_id, student_id)

### 3.9. 学期表 (semesters)

| 字段名         | 类型       | 示例值                    | 描述       |
| ----------- | -------- | ---------------------- | -------- |
| id          | TEXT     | "2024-2025-2"          | 学期ID（主键） |
| name        | TEXT     | "2024-2025学年第二学期"      | 学期名称     |
| start\_date | TEXT     | "2025-02-17"           | 开始日期     |
| end\_date   | TEXT     | "2025-06-30"           | 结束日期     |
| is\_active  | BOOLEAN  | true                   | 是否当前学期   |
| created\_at | DATETIME | "2025-01-01T00:00:00Z" | 创建时间     |
| updated\_at | DATETIME | "2025-01-01T00:00:00Z" | 更新时间     |

**约束**:
- 同一 school_id 下学期日期不允许重叠（应用层校验 + INSERT 前查询）。
- 查询某天所属学期时，如果不在任何学期内，统计中归入"非学期时段"单独统计。
- 学期管理 UI 上展示时间轴，直观看到重叠。

### 3.10. 操作日志表 (operation\_logs)

| 字段名         | 类型       | 示例值                    | 描述       |
| ----------- | -------- | ---------------------- | -------- |
| id          | TEXT     | "log\_uuid"            | 日志ID（主键） |
| user\_id    | TEXT     | "teacher\_001"         | 用户ID     |
| user\_type  | TEXT     | "teacher"              | 用户类型     |
| user\_name  | TEXT     | "张老师"                  | 用户姓名     |
| action      | TEXT     | "create\_recipe"       | 操作类型     |
| target      | TEXT     | "daily\_20251026"      | 操作对象     |
| result      | TEXT     | "success"              | 操作结果     |
| created\_at | DATETIME | "2025-10-26T09:15:30Z" | 操作时间     |

### 3.10.1. 菜名别名表 (dish_aliases)

| 字段名            | 类型       | 示例值    | 描述              |
| ---------------- | -------- | ------ | --------------- |
| id               | TEXT     | "alias_001" | 别名ID（主键）       |
| canonical_name   | TEXT     | "西红柿炒鸡蛋" | 标准菜名          |
| alias_name       | TEXT     | "番茄炒蛋" | 别名（归并到标准菜名）   |
| created_at       | DATETIME | "2025-09-01T00:00:00Z" | 创建时间           |

**说明**: 
- 统计时按 canonical_name 分组。
- 输入菜名时自动 trim + 全角转半角。
- 统计页面支持模糊搜索 + 在线手动归并。

### 3.11. 系统配置表 (config)

| 字段名         | 类型       | 示例值                    | 描述      |
| ----------- | -------- | ---------------------- | ------- |
| key         | TEXT     | "school\_name"         | 配置键（主键） |
| value       | TEXT     | "上海星河湾双语学校"            | 配置值     |
| updated\_at | DATETIME | "2025-09-16T10:00:00Z" | 更新时间    |

### 3.12. 学期归档表 (archives)

| 字段名                   | 类型       | 示例值                    | 描述           |
| --------------------- | -------- | ---------------------- | ------------ |
| id                    | TEXT     | "2024-2025-2"          | 归档ID（主键）     |
| semester\_id          | TEXT     | "2024-2025-2"          | 学期ID         |
| semester\_name        | TEXT     | "2024-2025学年第二学期"      | 学期名称         |
| start\_date           | TEXT     | "2025-02-17"           | 开始日期         |
| end\_date             | TEXT     | "2025-06-30"           | 结束日期         |
| school\_id            | INTEGER  | 1                      | 学校ID         |
| metadata\_url         | TEXT     | "https\://..."         | 元数据JSON文件URL |
| media\_zip\_url       | TEXT     | "https\://..."         | 多媒体ZIP文件URL  |
| file\_size            | INTEGER  | 524288000              | 文件大小（字节）     |
| recipe\_count\_daily  | INTEGER  | 85                     | 日食谱数量        |
| recipe\_count\_weekly | INTEGER  | 17                     | 周食谱数量        |
| created\_at           | DATETIME | "2025-07-01T10:00:00Z" | 创建时间         |
| created\_by           | TEXT     | "admin"                | 创建人          |

## 4. 项目目录结构（仅供参考）

```
campus-food-time/
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── SECURITY.md
├── .github/
│   └── workflows/
│       └── deploy.yml
├── .eslintrc.json
├── .eslintignore
├── .prettierrc
├── .prettierignore
├── .gitattributes
├── .editorconfig
├── cypress.json
├── jest.config.js
├── CODEOWNERS
├── pull_request_template.md
└── worker/.env.example
├── docs/
│   ├── api-docs.md
│   ├── setup-guide.md
│   └── architecture.md
├── .gitignore
├── .env.example
├── wrangler.toml
├── package.json
├── frontend/
│   ├── index.html
│   ├── teacher/
│   │   ├── login.html
│   │   ├── dashboard.html
│   ├── parent/
│   │   ├── register.html
│   │   ├── login.html
│   │   ├── dashboard.html
│   ├── admin/
│   │   ├── login.html
│   │   ├── dashboard.html
│   ├── assets/
│   │   ├── css/
│   │   ├── js/
│   │   │   ├── main.js
│   │   │   ├── auth.js
│   │   │   ├── api.js
│   │   │   ├── components/
│   │   │   │   ├── datepicker.js
│   │   │   │   ├── notification.js
│   │   │   │   ├── image-uploader.js
│   │   │   │   ├── image-compressor.js
│   │   │   │   ├── video-compressor.js
│   │   │   │   └── week-selector.js
│   │   │   └── utils/
│   │   │       ├── formatters.js
│   │   │       ├── validators.js
│   │   │       ├── storage.js
│   │   │       └── crypto.js
│   │   ├── images/
│   ├── utils/
│   │   └── video-compress.html
│   ├── package.json
│   └── favicon.ico
├── worker/
│   ├── src/
│   │   ├── index.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── teacher.js
│   │   │   ├── parent.js
│   │   │   ├── admin.js
│   │   │   └── public.js
│   │   ├── handlers/
│   │   │   ├── authHandler.js
│   │   │   ├── recipeHandler.js
│   │   │   ├── userHandler.js
│   │   │   ├── classHandler.js
│   │   │   ├── adminHandler.js
│   │   │   ├── configHandler.js
│   │   │   ├── statisticsHandler.js
│   │   │   └── archiveHandler.js
│   │   ├── services/
│   │   │   ├── kvService.js
│   │   │   ├── r2Service.js
│   │   │   ├── validationService.js
│   │   │   ├── authService.js
│   │   │   ├── cryptoService.js
│   │   │   ├── snapshotService.js
│   │   │   └── notificationService.js
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js
│   │   │   ├── validationMiddleware.js
│   │   │   └── errorMiddleware.js
│   │   ├── utils/
│   │   │   ├── responseHelper.js
│   │   │   ├── constants.js
│   │   │   ├── dateUtils.js
│   │   │   ├── weekUtils.js
│   │   │   └── securityUtils.js
│   ├── package.json
│   └── tsconfig.json

```

## 5. API接口文档

### 5.1. 通用说明

- 所有API返回JSON格式数据
- 时间格式：ISO 8601 (`YYYY-MM-DDTHH:mm:ssZ`)
- 日期格式：`YYYY-MM-DD`
- 周格式：`YYYY-WW`（ISO周）

### 5.2. 认证接口

#### 5.2.1. 教师登录

**请求方式**: POST\
**请求地址**: `/auth/teacher/login`

**请求参数**:

| 参数名      | 类型     | 是否必选 | 示例值         | 描述  |
| -------- | ------ | ---- | ----------- | --- |
| phone    | string | 是    | 13800138000 | 手机号 |
| password | string | 是    | password123 | 密码  |

**返回参数**:

| 参数名                | 类型     | 示例值               | 描述        |
| ------------------ | ------ | ----------------- | --------- |
| code               | number | 0                 | 状态码，0表示成功 |
| message            | string | "登录成功"            | 提示信息      |
| data               | object | -                 | 返回数据      |
| data.user          | object | -                 | 用户信息      |
| data.user.id       | string | "teacher\_001"    | 用户ID      |
| data.user.name     | string | "张老师"             | 用户姓名      |
| data.user.phone    | string | "138\*\*\*\*8000" | 脱敏手机号     |
| data.user.schoolId | number | 1                 | 学校ID      |
| data.token         | string | "jwt\_token"      | 认证令牌      |

**请求示例**:

```json
POST /auth/teacher/login
Content-Type: application/json

{
  "phone": "13800138000",
  "password": "password123"
}
```

**返回示例**:

```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "user": {
      "id": "teacher_001",
      "name": "张老师",
      "phone": "138****8000",
      "schoolId": 1
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### 5.2.2. 家长注册

**请求方式**: POST\
**请求地址**: `/auth/parent/register`

**请求参数**:

| 参数名             | 类型     | 是否必选 | 示例值                | 描述     |
| --------------- | ------ | ---- | ------------------ | ------ |
| phone           | string | 是    | 13900139000        | 手机号    |
| password        | string | 是    | password123        | 密码     |
| studentName     | string | 是    | 李小明                | 学生姓名   |
| studentIdNumber | string | 是    | 310101201501011234 | 学生身份证号 |
| classId         | string | 是    | class:1:1          | 班级ID   |

**返回参数**:

| 参数名        | 类型     | 示例值          | 描述   |
| ---------- | ------ | ------------ | ---- |
| code       | number | 0            | 状态码  |
| message    | string | "注册成功"       | 提示信息 |
| data       | object | -            | 返回数据 |
| data.user  | object | -            | 用户信息 |
| data.token | string | "jwt\_token" | 认证令牌 |

**请求示例**:

```json
POST /auth/parent/register
Content-Type: application/json

{
  "phone": "13900139000",
  "password": "password123",
  "studentName": "李小明",
  "studentIdNumber": "310101201501011234",
  "classId": "class:1:1"
}
```

**返回示例**:

```json
{
  "code": 0,
  "message": "注册成功",
  "data": {
    "user": {
      "id": "parent_001",
      "phone": "139****9000",
      "studentName": "李小明",
      "className": "一年级(1)班",
      "schoolId": 1
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 5.3. 食谱接口

#### 5.3.1. 获取日食谱

**请求方式**: GET\
**请求地址**: `/api/recipes/daily/:date`

**请求参数**:

| 参数名  | 类型     | 是否必选 | 示例值        | 描述       |
| ---- | ------ | ---- | ---------- | -------- |
| date | string | 是    | 2025-10-26 | 日期（路径参数） |

**返回参数**:

| 参数名                     | 类型     | 示例值                    | 描述       |
| ----------------------- | ------ | ---------------------- | -------- |
| code                    | number | 0                      | 状态码      |
| message                 | string | "获取成功"                 | 提示信息     |
| data                    | object | -                      | 返回数据     |
| data.id                 | string | "daily\_20251026"      | 食谱ID     |
| data.date               | string | "2025-10-26"           | 日期       |
| data.status             | string | "published"            | 状态       |
| data.images             | array  | -                      | 图片列表     |
| data.images\[].dishName | string | "红烧肉"                  | 菜名（用于统计） |
| data.videos             | array  | -                      | 视频列表     |
| data.notes              | string | "今日特色"                 | 备注       |
| data.lastUpdatedAt      | string | "2025-10-26T09:15:30Z" | 最后更新时间   |

**请求示例**:

```
GET /api/recipes/daily/2025-10-26
Authorization: Bearer <token>
```

**返回示例**:

```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "id": "daily_20251026",
    "date": "2025-10-26",
    "status": "published",
    "images": [
      {
        "id": "img1",
        "order": 1,
        "title": "全盘营养餐",
        "dishName": "红烧肉",
        "url": "https://r2.zedex.cn/campus-food/2025-10/2025-10-26-01.jpg"
      }
    ],
    "videos": [],
    "notes": "今日特色：有机蔬菜",
    "lastUpdatedAt": "2025-10-26T09:15:30Z"
  }
}
```

#### 5.3.2. 创建/更新日食谱

**请求方式**: PUT\
**请求地址**: `/api/recipes/daily/:date`

**说明**: 统一使用PUT接口，不存在则创建，存在则更新。

**请求参数**:

| 参数名                | 类型     | 是否必选 | 示例值            | 描述          |
| ------------------ | ------ | ---- | -------------- | ----------- |
| date               | string | 是    | 2025-10-26     | 日期（路径参数）    |
| images             | array  | 否    | -              | 图片列表        |
| images\[].title    | string | 是    | "全盘营养餐"        | 图片标题        |
| images\[].dishName | string | 是    | "红烧肉"          | 菜名（必填，用于统计） |
| images\[].url      | string | 是    | "https\://..." | 图片URL       |
| images\[].order    | number | 是    | 1              | 排序          |
| videos             | array  | 否    | -              | 视频列表        |
| videos\[].title    | string | 是    | "加工过程"         | 视频标题        |
| videos\[].url      | string | 是    | "https\://..." | 视频URL       |
| videos\[].order    | number | 是    | 1              | 排序          |
| notes              | string | 否    | "今日特色"         | 备注          |

**返回参数**:

| 参数名          | 类型     | 示例值               | 描述   |
| ------------ | ------ | ----------------- | ---- |
| code         | number | 0                 | 状态码  |
| message      | string | "保存成功"            | 提示信息 |
| data         | object | -                 | 返回数据 |
| data.id      | string | "daily\_20251026" | 食谱ID |
| data.version | number | 2                 | 版本号  |

**请求示例**:

```json
PUT /api/recipes/daily/2025-10-26
Authorization: Bearer <token>
Content-Type: application/json

{
  "images": [
    {
      "title": "全盘营养餐",
      "url": "https://r2.zedex.cn/campus-food/2025-10/2025-10-26-01.jpg",
      "order": 1
    }
  ],
  "videos": [],
  "notes": "今日特色：有机蔬菜"
}
```

**返回示例**:

```json
{
  "code": 0,
  "message": "保存成功",
  "data": {
    "id": "daily_20251026",
    "version": 2
  }
}
```

#### 5.3.3. 获取周食谱

**请求方式**: GET\
**请求地址**: `/api/recipes/weekly/:yearWeek`

**请求参数**:

| 参数名      | 类型     | 是否必选 | 示例值      | 描述       |
| -------- | ------ | ---- | -------- | -------- |
| yearWeek | string | 是    | 2025-W43 | 年周（路径参数） |

**返回参数**:

| 参数名             | 类型     | 示例值               | 描述   |
| --------------- | ------ | ----------------- | ---- |
| code            | number | 0                 | 状态码  |
| message         | string | "获取成功"            | 提示信息 |
| data            | object | -                 | 返回数据 |
| data.id         | string | "weekly\_2025W43" | 食谱ID |
| data.yearWeek   | string | "2025-W43"        | 年周   |
| data.year       | number | 2025              | 年份   |
| data.weekNumber | number | 43                | 周数   |
| data.startDate  | string | "2025-10-20"      | 开始日期 |
| data.endDate    | string | "2025-10-26"      | 结束日期 |
| data.status     | string | "published"       | 状态   |
| data.images     | array  | -                 | 图片列表 |
| data.notes      | string | "本周营养搭配"          | 备注   |

**请求示例**:

```
GET /api/recipes/weekly/2025-W43
Authorization: Bearer <token>
```

**返回示例**:

```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "id": "weekly_2025W43",
    "yearWeek": "2025-W43",
    "year": 2025,
    "weekNumber": 43,
    "startDate": "2025-10-20",
    "endDate": "2025-10-26",
    "status": "published",
    "images": [
      {
        "id": "wimg1",
        "order": 1,
        "title": "风味餐菜单",
        "url": "https://r2.zedex.cn/campus-food/2025-10/2025-W43-01.jpg"
      }
    ],
    "notes": "本周营养均衡搭配",
    "lastUpdatedAt": "2025-10-19T10:30:15Z"
  }
}
```

#### 5.4. 文件上传接口

#### 5.4.1. 获取预签名URL

**请求方式**: POST\
**请求地址**: `/api/upload/presign`

**请求参数**:

| 参数名      | 类型     | 是否必选 | 示例值          | 描述          |
| -------- | ------ | ---- | ------------ | ----------- |
| fileType | string | 是    | image/jpeg   | 文件MIME类型    |
| date     | string | 是    | 2025-10-26   | 日期（用于生成文件名） |
| order    | number | 是    | 1            | 序号（用于生成文件名） |
| type     | string | 是    | daily/weekly | 食谱类型        |

**返回参数**:

| 参数名            | 类型     | 示例值                         | 描述         |
| -------------- | ------ | --------------------------- | ---------- |
| code           | number | 0                           | 状态码        |
| message        | string | "获取成功"                      | 提示信息       |
| data           | object | -                           | 返回数据       |
| data.uploadUrl | string | "https\://..."              | R2预签名上传URL |
| data.fileUrl   | string | "campus-food/2025-10/2025-10-26-01.jpg" | 文件访问Key（用于后续 /media/:id 代理访问） |
| data.filename  | string | "2025-10/2025-10-26-01.jpg" | 文件名        |

**请求示例**:

```json
POST /api/upload/presign
Authorization: Bearer <token>
Content-Type: application/json

{
  "fileType": "image/jpeg",
  "date": "2025-10-26",
  "order": 1,
  "type": "daily"
}
```

**返回示例**:

```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "uploadUrl": "https://campus-food.r2.cloudflarestorage.com/2025-10/2025-10-26-01.jpg?X-Amz-...",
    "fileKey": "campus-food/2025-10/2025-10-26-01.jpg",
    "filename": "2025-10/2025-10-26-01.jpg"
  }
}
```

#### 5.4.2. 媒体文件代理访问

**请求方式**: GET\
**请求地址**: `/media/:id`

**说明**: R2 存储桶为私有，所有媒体文件通过 Worker 代理访问。Worker 校验请求者登录态（教师/家长/管理员）后，从 R2 读取文件流返回。

**请求参数**:

| 参数名 | 类型     | 是否必选 | 示例值  | 描述         |
| --- | ------ | ---- | ---- | ---------- |
| id  | string | 是    | img1 | 媒体ID（路径参数） |

**请求示例**:

```
GET /media/img1
Authorization: Bearer <token>
```

**返回**: 直接返回文件流（Content-Type 根据文件类型设置，如 image/jpeg、video/mp4）。

**分享链接**: 支持生成带 token 的临时分享链接（有效期 1 小时），格式如 `/media/img1?token=<temp_token>`，无需登录即可访问，过期后失效。

### 5.5. 管理端接口

#### 5.5.1. 创建教师账号

**请求方式**: POST\
**请求地址**: `/admin/api/teachers`

**请求参数**:

| 参数名      | 类型     | 是否必选 | 示例值         | 描述   |
| -------- | ------ | ---- | ----------- | ---- |
| phone    | string | 是    | 13800138000 | 手机号  |
| password | string | 是    | password123 | 密码   |
| name     | string | 是    | 张老师         | 姓名   |
| schoolId | number | 是    | 1           | 学校ID |

**返回参数**:

| 参数名     | 类型     | 示例值            | 描述   |
| ------- | ------ | -------------- | ---- |
| code    | number | 0              | 状态码  |
| message | string | "创建成功"         | 提示信息 |
| data    | object | -              | 返回数据 |
| data.id | string | "teacher\_001" | 教师ID |

**请求示例**:

```json
POST /admin/api/teachers
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "phone": "13800138000",
  "password": "password123",
  "name": "张老师",
  "schoolId": 1
}
```

**返回示例**:

```json
{
  "code": 0,
  "message": "创建成功",
  "data": {
    "id": "teacher_001",
    "phone": "13800138000",
    "name": "张老师",
    "schoolId": 1
  }
}
```

#### 5.5.2. 获取食谱历史版本

**请求方式**: GET\
**请求地址**: `/admin/api/recipes/daily/:id/history`

**请求参数**:

| 参数名 | 类型     | 是否必选 | 示例值             | 描述         |
| --- | ------ | ---- | --------------- | ---------- |
| id  | string | 是    | daily\_20251026 | 食谱ID（路径参数） |

**返回参数**:

| 参数名               | 类型     | 示例值                    | 描述     |
| ----------------- | ------ | ---------------------- | ------ |
| code              | number | 0                      | 状态码    |
| message           | string | "获取成功"                 | 提示信息   |
| data              | array  | -                      | 历史版本列表 |
| data\[].version   | number | 1                      | 版本号    |
| data\[].updatedAt | string | "2025-10-25T16:40:22Z" | 更新时间   |
| data\[].updatedBy | string | "teacher\_001"         | 更新人    |

**请求示例**:

```
GET /admin/api/recipes/daily/daily_20251026/history
Authorization: Bearer <admin_token>
```

**返回示例**:

```json
{
  "code": 0,
  "message": "获取成功",
  "data": [
    {
      "version": 2,
      "updatedAt": "2025-10-26T09:15:30Z",
      "updatedBy": "teacher_001",
      "snapshotKey": "recipe:daily:2025-10-26:history:20251026091530"
    },
    {
      "version": 1,
      "updatedAt": "2025-10-25T16:40:22Z",
      "updatedBy": "teacher_001",
      "snapshotKey": "recipe:daily:2025-10-26:history:20251025164022"
    }
  ]
}
```

#### 5.5.3. 版本回滚

**请求方式**: POST\
**请求地址**: `/admin/api/recipes/daily/:id/rollback`

**请求参数**:

| 参数名     | 类型     | 是否必选 | 示例值             | 描述         |
| ------- | ------ | ---- | --------------- | ---------- |
| id      | string | 是    | daily\_20251026 | 食谱ID（路径参数） |
| version | number | 是    | 1               | 要回滚到的版本号   |

**返回参数**:

| 参数名          | 类型     | 示例值    | 描述   |
| ------------ | ------ | ------ | ---- |
| code         | number | 0      | 状态码  |
| message      | string | "回滚成功" | 提示信息 |
| data         | object | -      | 返回数据 |
| data.version | number | 3      | 新版本号 |

**请求示例**:

```json
POST /admin/api/recipes/daily/daily_20251026/rollback
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "version": 1
}
```

**返回示例**:

```json
{
  "code": 0,
  "message": "回滚成功",
  "data": {
    "version": 3
  }
}
```

#### 5.5.4. 操作日志

##### 5.5.4.1. 获取教师端操作日志

**请求方式**: GET\
**请求地址**: `/admin/api/logs/teacher`

**请求参数**:

| 参数名       | 类型     | 是否必选 | 示例值          | 描述         |
| --------- | ------ | ---- | ------------ | ---------- |
| page      | number | 否    | 1            | 页码（默认1）    |
| pageSize  | number | 否    | 20           | 每页条数（默认20） |
| teacherId | string | 否    | teacher\_001 | 教师ID筛选     |
| startDate | string | 否    | 2025-10-01   | 开始日期筛选     |
| endDate   | string | 否    | 2025-10-31   | 结束日期筛选     |

**返回参数**:

| 参数名                 | 类型     | 示例值                    | 描述   |
| ------------------- | ------ | ---------------------- | ---- |
| code                | number | 0                      | 状态码  |
| message             | string | "获取成功"                 | 提示信息 |
| data                | array  | -                      | 日志列表 |
| data\[].id          | string | "log\_001"             | 日志ID |
| data\[].teacherId   | string | "teacher\_001"         | 教师ID |
| data\[].teacherName | string | "张老师"                  | 教师姓名 |
| data\[].action      | string | "create\_recipe"       | 操作类型 |
| data\[].target      | string | "daily\_20251026"      | 操作对象 |
| data\[].result      | string | "success"              | 操作结果 |
| data\[].timestamp   | string | "2025-10-26T09:15:30Z" | 操作时间 |
| total               | number | 100                    | 总条数  |
| page                | number | 1                      | 当前页码 |
| pageSize            | number | 20                     | 每页条数 |

##### 5.5.4.2. 获取管理端操作日志

**请求方式**: GET\
**请求地址**: `/admin/api/logs/admin`

**请求参数**:

| 参数名       | 类型     | 是否必选 | 示例值        | 描述         |
| --------- | ------ | ---- | ---------- | ---------- |
| page      | number | 否    | 1          | 页码（默认1）    |
| pageSize  | number | 否    | 20         | 每页条数（默认20） |
| startDate | string | 否    | 2025-10-01 | 开始日期筛选     |
| endDate   | string | 否    | 2025-10-31 | 结束日期筛选     |

**返回参数**: 同教师端操作日志，字段类似。

#### 5.5.5. 学期管理

##### 5.5.5.1. 获取学期列表

**请求方式**: GET\
**请求地址**: `/admin/api/semesters`

**请求参数**:

| 参数名      | 类型     | 是否必选 | 示例值 | 描述         |
| -------- | ------ | ---- | --- | ---------- |
| page     | number | 否    | 1   | 页码（默认1）    |
| pageSize | number | 否    | 20  | 每页条数（默认20） |

**返回参数**:

| 参数名               | 类型      | 示例值               | 描述     |
| ----------------- | ------- | ----------------- | ------ |
| code              | number  | 0                 | 状态码    |
| message           | string  | "获取成功"            | 提示信息   |
| data              | array   | -                 | 学期列表   |
| data\[].id        | string  | "2024-2025-2"     | 学期ID   |
| data\[].name      | string  | "2024-2025学年第二学期" | 学期名称   |
| data\[].startDate | string  | "2025-02-17"      | 开始日期   |
| data\[].endDate   | string  | "2025-06-30"      | 结束日期   |
| data\[].isActive  | boolean | true              | 是否当前学期 |
| total             | number  | 10                | 总条数    |
| page              | number  | 1                 | 当前页码   |
| pageSize          | number  | 20                | 每页条数   |

##### 5.5.5.2. 创建/更新学期

**请求方式**: PUT\
**请求地址**: `/admin/api/semesters/:id`

**请求参数**:

| 参数名       | 类型      | 是否必选 | 示例值             | 描述         |
| --------- | ------- | ---- | --------------- | ---------- |
| id        | string  | 是    | 2024-2025-2     | 学期ID（路径参数） |
| name      | string  | 是    | 2024-2025学年第二学期 | 学期名称       |
| startDate | string  | 是    | 2025-02-17      | 开始日期       |
| endDate   | string  | 是    | 2025-06-30      | 结束日期       |
| isActive  | boolean | 否    | true            | 是否设为当前学期   |

**返回参数**:

| 参数名     | 类型     | 示例值           | 描述   |
| ------- | ------ | ------------- | ---- |
| code    | number | 0             | 状态码  |
| message | string | "保存成功"        | 提示信息 |
| data    | object | -             | 返回数据 |
| data.id | string | "2024-2025-2" | 学期ID |

#### 5.5.6. 创建学期归档

**请求方式**: POST\
**请求地址**: `/admin/api/archive/create`

**请求参数**:

| 参数名        | 类型     | 是否必选 | 示例值         | 描述   |
| ---------- | ------ | ---- | ----------- | ---- |
| semesterId | string | 是    | 2024-2025-2 | 学期ID |
| schoolId   | number | 是    | 1           | 学校ID |

**返回参数**:

| 参数名              | 类型     | 示例值            | 描述   |
| ---------------- | ------ | -------------- | ---- |
| code             | number | 0              | 状态码  |
| message          | string | "归档任务已创建"      | 提示信息 |
| data             | object | -              | 返回数据 |
| data.archiveId   | string | "2024-2025-2"  | 归档ID |
| data.status      | string | "processing"   | 状态   |

**请求示例**:

```json
POST /admin/api/archive/create
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "semesterId": "2024-2025-2",
  "schoolId": 1
}
```

**返回示例**:

```json
{
  "code": 0,
  "message": "归档任务已创建",
  "data": {
    "archiveId": "2024-2025-2",
    "status": "processing"
  }
}
```

#### 5.5.7. 查询归档状态

**请求方式**: GET\
**请求地址**: `/admin/api/archive/:id`

**请求参数**:

| 参数名 | 类型 | 是否必选 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| id | string | 是 | 2024-2025-2 | 归档ID（路径参数） |

**返回参数**:

| 参数名 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| code | number | 0 | 状态码 |
| message | string | "获取成功" | 提示信息 |
| data | object | - | 返回数据 |
| data.archiveId | string | "2024-2025-2" | 归档ID |
| data.status | string | "completed" | 状态（processing/completed/failed） |
| data.downloadUrl | string | "https://..." | 下载链接（status=completed 时有值） |
| data.metadataUrl | string | "https://..." | 元数据JSON下载链接 |
| data.fileSize | number | 524288000 | 文件大小（字节） |
| data.recipeCount | object | - | 食谱数量 |
| data.recipeCount.daily | number | 85 | 日食谱数量 |
| data.recipeCount.weekly | number | 17 | 周食谱数量 |

### 5.6. 错误码表

| 错误码  | 错误名称                    | 描述        | 前端提示文案                    |
| ---- | ----------------------- | --------- | ------------------------- |
| 0    | SUCCESS                 | 成功        | 操作成功                      |
| 1001 | INVALID\_PARAMS         | 参数错误      | 请检查输入信息是否正确               |
| 1002 | MISSING\_PARAMS         | 缺少必要参数    | 请填写完整信息                   |
| 1003 | INVALID\_FORMAT         | 格式错误      | 输入格式不正确，请检查后重试            |
| 2001 | UNAUTHORIZED            | 未登录       | 请先登录                      |
| 2002 | TOKEN\_EXPIRED          | 登录已过期     | 登录已过期，请重新登录               |
| 2003 | TOKEN\_INVALID          | 无效的登录凭证   | 登录状态异常，请重新登录              |
| 2004 | PERMISSION\_DENIED      | 权限不足      | 您没有权限执行此操作                |
| 2005 | ACCOUNT\_DISABLED       | 账号已被禁用    | 您的账号已被禁用，请联系管理员           |
| 2006 | SINGLE\_DEVICE\_LIMIT   | 账号在其他设备登录 | 您的账号已在其他设备登录，请重新登录        |
| 2007 | ACCOUNT\_LOCKED         | 账号已锁定     | 账号已被锁定，请稍后再试              |
| 3001 | USER\_NOT\_FOUND        | 用户不存在     | 用户不存在，请检查输入               |
| 3002 | PASSWORD\_ERROR         | 密码错误      | 密码错误，请重新输入                |
| 3003 | PHONE\_EXISTS           | 手机号已注册    | 该手机号已被注册，请直接登录            |
| 3004 | STUDENT\_NOT\_FOUND     | 学生信息不存在   | 学生信息不存在，请核对姓名、身份证号和班级     |
| 3005 | CLASS\_NOT\_FOUND       | 班级不存在     | 班级信息不存在，请重新选择             |
| 4001 | RECIPE\_NOT\_FOUND      | 食谱不存在     | 暂无食谱信息                    |
| 4002 | RECIPE\_ALREADY\_EXISTS | 食谱已存在     | 该日期已有食谱，请使用更新功能           |
| 4003 | RECIPE\_SAVE\_FAILED    | 食谱保存失败    | 保存失败，请稍后重试                |
| 4004 | RECIPE\_DELETE\_FAILED  | 食谱删除失败    | 删除失败，请稍后重试                |
| 5001 | FILE\_UPLOAD\_FAILED    | 文件上传失败    | 文件上传失败，请重试                |
| 5002 | FILE\_TOO\_LARGE        | 文件过大      | 文件大小超出限制，请压缩后上传           |
| 5003 | INVALID\_FILE\_TYPE     | 文件类型不支持   | 不支持该文件类型，请上传jpg/png/mp4格式 |
| 5004 | FILE\_COMPRESS\_FAILED  | 文件压缩失败    | 文件处理失败，请重试                |
| 6001 | SCHOOL\_NOT\_FOUND      | 学校不存在     | 学校信息不存在                   |
| 6002 | SEMESTER\_NOT\_FOUND    | 学期不存在     | 学期信息不存在                   |
| 7001 | ARCHIVE\_CREATE\_FAILED | 归档创建失败    | 归档创建失败，请稍后重试              |
| 7002 | ARCHIVE\_NOT\_FOUND     | 归档不存在     | 归档文件不存在                   |
| 9001 | SYSTEM\_ERROR           | 系统错误      | 系统繁忙，请稍后重试                |
| 9002 | NETWORK\_ERROR          | 网络错误      | 网络连接失败，请检查网络后重试           |
| 9003 | SERVICE\_UNAVAILABLE    | 服务不可用     | 服务暂时不可用，请稍后重试             |

### 5.7. 前端错误提示文案汇总

#### 5.7.1. 登录/注册相关

| 场景      | 提示文案         |
| ------- | ------------ |
| 手机号为空   | 请输入手机号       |
| 手机号格式错误 | 请输入正确的11位手机号 |
| 密码为空    | 请输入密码        |
| 密码长度不足  | 密码长度至少6位     |
| 登录成功    | 登录成功，正在跳转... |
| 注册成功    | 注册成功，正在跳转... |
| 登出成功    | 已安全退出        |

#### 5.7.2. 食谱相关

| 场景       | 提示文案             |
| -------- | ---------------- |
| 今日食谱暂未上传 | 今日食谱暂未上传，请稍后再来查看 |
| 本周食谱暂未上传 | 本周食谱暂未上传，请稍后再来查看 |
| 食谱保存成功   | 食谱保存成功           |
| 食谱更新成功   | 食谱更新成功           |
| 正在加载食谱   | 正在加载食谱，请稍候...    |
| 正在保存食谱   | 正在保存食谱，请稍候...    |

#### 5.7.3. 文件上传相关

| 场景     | 提示文案          |
| ------ | ------------- |
| 选择图片   | 请选择要上传的图片     |
| 选择视频   | 请选择要上传的视频     |
| 图片数量超限 | 最多上传{max}张图片  |
| 视频数量超限 | 最多上传{max}个视频  |
| 正在压缩图片 | 正在压缩图片，请稍候... |
| 正在压缩视频 | 正在压缩视频，请稍候... |
| 正在上传   | 正在上传，请稍候...   |
| 上传成功   | 上传成功          |
| 上传失败   | 上传失败，请重试      |

#### 5.7.4. 通用提示

| 场景    | 提示文案            |
| ----- | --------------- |
| 网络错误  | 网络连接失败，请检查网络后重试 |
| 请求超时  | 请求超时，请重试        |
| 系统繁忙  | 系统繁忙，请稍后重试      |
| 操作成功  | 操作成功            |
| 操作失败  | 操作失败，请重试        |
| 确认删除  | 确定要删除吗？此操作不可恢复  |
| 确认提交  | 确定要提交吗？         |
| 数据加载中 | 正在加载数据，请稍候...   |
| 无数据   | 暂无数据            |

## 6. 附录

### 6.1. ISO周数计算规则

- 严格遵循 ISO 8601 标准。
- ISO 周从周一开始，周日结束。
- 每年的第一周是包含该年第一个星期四的那一周。
- **边界测试用例**:
  - 2024-12-30（周一）→ 2025-W01（因为这一周包含 2025-01-02 周四）
  - 2025-12-29（周一）→ 2026-W01（因为这一周包含 2026-01-01 周四）
  - 2026-12-28（周一）→ 2026-W52（因为这一周不包含 2027-01-01 周四）
  - 2026-01-05（周一）→ 2026-W02

### 6.2. 密码加密说明

- 使用可逆加密算法（如AES）存储密码
- 加密密钥存储在环境变量中
- 管理员后台可查看解密后的真实密码
- 前端传输使用HTTPS加密

### 6.3. 通知机制预留接口

```javascript
/**
 * 发送站内通知（预留）
 * @param {string} userId - 用户ID
 * @param {object} message - 通知内容
 * @returns {Promise<void>}
 */
async function sendNotification(userId, message) {
  // TODO: 实现站内通知功能
  // 后续可接入WebSocket或轮询机制
  console.log('Notification sent to user:', userId, message);
}

/**
 * 发送短信通知（预留）
 * @param {string} phone - 手机号
 * @param {string} message - 短信内容
 * @returns {Promise<void>}
 */
async function sendSMS(phone, message) {
  // TODO: 接入短信服务商API
  // 如阿里云短信、腾讯云短信等
  console.log('SMS sent to:', phone, message);
}

/**
 * 通知新食谱发布（预留）
 * @param {number} schoolId - 学校ID
 * @param {string} recipeType - 食谱类型 (daily/weekly)
 * @param {string} date - 日期或周
 * @returns {Promise<void>}
 */
async function notifyNewRecipe(schoolId, recipeType, date) {
  // TODO: 实现新食谱通知功能
  // 可通过站内通知、短信、微信等方式通知家长
  console.log('New recipe notification:', schoolId, recipeType, date);
}
```

