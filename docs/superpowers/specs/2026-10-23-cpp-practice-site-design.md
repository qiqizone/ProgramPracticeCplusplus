# C++ 在线练习站 — 设计文档

- 日期：2026-10-23
- 状态：已确认（用户批准）
- 目标读者：实现者（后续实施计划与编码）

## 1. 背景与目标

用户正在学习 C++，需要一个可以按知识点刷题的网站。核心诉求：

1. 题目覆盖 C++ 主要知识点，配解析，帮助快速掌握
2. 选择题在线作答并即时判分；编程题只提供题干、提示与参考答案，代码在本机 Visual Studio 中自行编写运行
3. 有账号体系，做题记录保存在服务器，换设备登录后进度一致
4. 手机可访问，主要使用场景为手机刷选择题、电脑做编程题

成功标准：

- 用户注册登录后，能在 6 个章节中答题，答完立即看到对错与解析
- 关闭浏览器、换设备重新登录后，进度、错题本、统计保持一致
- 手机上可流畅完成一次完整的章节练习
- 约 90 道选择题 + 16 道编程题的初始题库可导入并正常展示

## 2. 非目标（明确不做）

- 在线编译 / 代码执行 / 自动判题（编程题仅自评完成）
- 讨论区、评论、社交功能
- 邮箱验证、找回密码、第三方登录
- 支付、会员、多语言
- 多机部署、读写分离、缓存层

## 3. 技术选型

| 层 | 选型 | 说明 |
|---|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS | SPA，移动端优先响应式 |
| 代码高亮 | highlight.js（cpp 语言包） | 只做展示，不做编辑器 |
| 后端 | Node.js 24 + Express（JavaScript, ESM） | 使用 Node 内置 `node:sqlite`，无原生依赖 |
| 数据库 | SQLite（`node:sqlite`，WAL 模式） | 单文件，便于备份 |
| 认证 | JWT（HS256，7 天）+ bcrypt | 无服务端会话表 |
| 校验 | zod | 入参校验 |
| 部署 | nginx 静态托管 + 反向代理；systemd 托管 Node 进程 | 服务器为 Linux，暂无 Docker，无域名 |

## 4. 系统架构

```
浏览器 (React SPA)
    │  HTTP /api/*
    ▼
nginx ──静态文件──> client/dist
    └──反向代理──> Node.js Express (127.0.0.1:3000)
                        └──> SQLite  /var/lib/cpp-practice/app.db
```

前后端同源部署（nginx 提供 `/` 静态资源，`/api` 反代到 Node），因此生产环境不需要 CORS 放宽；开发环境允许 `http://localhost:5173`。

## 5. 目录结构

```
cpluspractice/
├─ client/                  # React 前端
│  ├─ src/
│  │  ├─ pages/             # Login, Chapters, Practice, WrongBook, Stats, Admin
│  │  ├─ components/        # QuestionCard, CodeBlock, ProgressBar, Layout ...
│  │  ├─ api/               # 请求封装（fetch + token 注入）
│  │  ├─ store/             # 认证上下文
│  │  └─ lib/               # 判分与格式化等纯函数
│  └─ dist/                 # 构建产物
├─ server/
│  ├─ src/
│  │  ├─ routes/            # auth, questions, attempts, stats, admin
│  │  ├─ middleware/        # auth, requireAdmin, errorHandler, rateLimit
│  │  ├─ db/                # 连接、schema 初始化、seed 导入
│  │  └─ services/          # 判分、错题状态机、统计聚合
│  └─ .env.example
├─ data/questions.seed.json # 初始题库
├─ deploy/                  # nginx 配置、systemd unit、部署说明
└─ docs/superpowers/specs/  # 设计文档
```

## 6. 数据模型

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE questions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  slug               TEXT NOT NULL UNIQUE,       -- 稳定标识，如 ch3-q07，导入时作为 upsert 键
  chapter            INTEGER NOT NULL,           -- 1-6
  type               TEXT NOT NULL,              -- 'single' | 'multiple' | 'output' | 'code'
  difficulty         TEXT NOT NULL DEFAULT 'medium', -- 'easy' | 'medium' | 'hard'
  stem               TEXT NOT NULL,              -- 题干，支持 Markdown 与 ```cpp 代码块
  options            TEXT,                       -- JSON: [{"id":"A","text":"..."}]
  answer             TEXT NOT NULL,              -- 见 7.2 判分规则
  explanation        TEXT NOT NULL,              -- 解析 + 易错点
  hints              TEXT,                       -- JSON 数组，编程题分步提示
  reference_solution TEXT,                       -- 编程题参考代码
  order_index        INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE attempts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer      TEXT NOT NULL,                     -- 用户提交内容（JSON 或纯文本）
  is_correct  INTEGER,                           -- 1 正确 / 0 错误 / NULL 表示编程题自评完成
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE question_states (
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id    INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  status         TEXT NOT NULL,                  -- 'correct' | 'wrong' | 'done'
  wrong_count    INTEGER NOT NULL DEFAULT 0,     -- 累计答错次数
  correct_streak INTEGER NOT NULL DEFAULT 0,     -- 最近连续答对次数（错题移出依据）
  starred        INTEGER NOT NULL DEFAULT 0,     -- 0/1 收藏
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, question_id)
);

CREATE INDEX idx_questions_chapter ON questions(chapter, order_index);
CREATE INDEX idx_attempts_user_time  ON attempts(user_id, created_at);
CREATE INDEX idx_states_user_status ON question_states(user_id, status);
```

说明：

- 进度不单独建表，统一由 `question_states` 派生，避免双写不一致
- `attempts` 保留全部流水，仅用于统计与练习量趋势
- 无行 = 未做过；`status='wrong'` 即错题本成员（见 7.3）

## 7. 业务规则

### 7.1 章节

固定 6 章，`chapter` 为 1-6：

1. 基础语法（变量、类型、运算符、流程控制）
2. 函数、数组、字符串
3. 指针、引用、内存管理
4. 面向对象（类、继承、多态、虚函数、构造析构）
5. STL（容器、迭代器、常用算法）
6. 现代 C++（auto、lambda、智能指针、移动语义、模板入门）

章节名称由前端常量表维护，不入库。

### 7.2 判分规则

| 类型 | 提交格式 | 判定 |
|---|---|---|
| single | `"B"` | 与 `answer` 字符串相等 |
| multiple | `["A","C"]` | 排序后与 `answer`（JSON 数组）完全相等；少选、多选均判错 |
| output | 纯文本 | 与 `answer`（JSON 数组，多个可接受答案）中任意一项比较：去首尾空白、把 `\r\n` 统一为 `\n` 后相等，其余字符精确匹配（大小写敏感） |
| code | 无提交内容 | 不做程序化判题；用户点击“标记完成”后写入 `attempts(is_correct=NULL)` 与 `question_states(status='done')` |

答错时响应必须包含 `explanation`；答对时也返回解析，供用户对照。

### 7.3 错题本与状态机

每次选择题作答后更新 `question_states`：

- 答错：`status='wrong'`，`wrong_count += 1`，`correct_streak = 0` → 进入错题本
- 答对：`correct_streak += 1`；若该题此前是错题且连续答对不足 2 次，`status` 仍为 `'wrong'`（仍在错题本）；否则 `status='correct'`（首次答对或连续答对 2 次即视为正确）
- 编程题标记完成：`status='done'`，不算对错，不进入错题本
- 收藏 `starred` 与状态相互独立

错题本查询条件：`status='wrong'`。

### 7.4 练习模式

| mode | 取题规则 |
|---|---|
| `chapter` | 该章全部题，按 `order_index` 升序 |
| `random` | 随机 20 题：优先取未做过的题，不足则用做过的题补齐 |
| `wrong` | 当前用户 `status='wrong'` 的题 |
| `starred` | 当前用户 `starred=1` 的题 |

作答位置（做到第几题）只存前端内存，刷新后回到该模式第一题。

### 7.5 统计

- 累计答题数、选择题正确率 = 正确次数 / 选择题提交次数
- 各章掌握度 = 该章 `status IN ('correct','done')` 的题数 / 该章总题数
- 近 7 天每日答题数（按 `attempts.created_at` 聚合，日期以服务器时区为准，部署时将服务器时区设为 `Asia/Shanghai`）
- 当前错题数、收藏数
- 编程题完成数单独展示，不计入正确率

## 8. API 契约

统一前缀 `/api`，除注册登录外均需 `Authorization: Bearer <token>`。

错误响应统一结构：`{ "error": { "code": "STRING_CODE", "message": "中文提示" } }`。

### 8.1 认证

| 方法 | 路径 | 请求 | 响应 |
|---|---|---|---|
| POST | `/auth/register` | `{username, password}` | `{token, user:{id,username,role}}` |
| POST | `/auth/login` | `{username, password}` | `{token, user:{id,username,role}}` |
| GET | `/auth/me` | — | `{id, username, role, created_at}` |

校验：username 3-20 位，仅字母数字下划线；password 8-72 位。用户名重复返回 409。

规则：**数据库中第一个注册的用户自动获得 `admin` 角色**，其余为 `user`。

### 8.2 题目与作答

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/chapters` | 返回 6 章的 `total / correct / done / wrong` 计数 |
| GET | `/questions?chapter=1&mode=chapter` | 返回题目列表；答题时不返回 `answer`、`explanation`、`reference_solution` |
| POST | `/attempts` | `{questionId, answer}` 或 `{questionId, completed:true}`（编程题）；返回 `{is_correct, answer, explanation, state}` |
| GET | `/questions?mode=wrong` | 错题列表（含错误次数） |
| POST | `/questions/:id/star` | 切换收藏，返回 `{starred}` |
| GET | `/stats` | 统计面板数据 |

安全约束：`/questions` 列表接口绝不返回答案字段，防止前端 F12 直接看答案；答案只在提交后由 `/attempts` 返回。

### 8.3 管理（`role=admin`）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/admin/questions` | 全量列表（含答案） |
| GET | `/admin/questions/:id` | 单题详情（含答案，供编辑表单使用） |
| POST | `/admin/questions` | 新增一题（slug 唯一） |
| PUT | `/admin/questions/:id` | 更新一题 |
| DELETE | `/admin/questions/:id` | 删除一题（级联删除相关 attempts/states） |
| POST | `/admin/questions/import` | 批量导入 JSON 数组，按 slug upsert |

## 9. 前端页面

| 路由 | 页面 | 要点 |
|---|---|---|
| `/login` | 登录/注册 | 单页切换两种表单，成功后跳 `/` |
| `/` | 章节列表 | 6 张卡片，进度条、正确率、错题数；顶部入口：随机练习、错题本、统计、管理（admin） |
| `/practice?mode=chapter&chapter=1` | 答题页 | 一题一屏；选择题选后点“提交”，展示正误 + 解析 + “下一题”；编程题展示题干/提示/折叠参考答案/标记完成；底部进度指示 |
| `/wrong-book` | 错题本 | 列表 + “开始重做” |
| `/stats` | 统计 | 数字卡片 + 近 7 天柱状图（纯 CSS/SVG 实现，不引图表库） |
| `/admin` | 题目管理 | 列表、编辑表单、JSON 导入文本框；仅 admin 可见 |

交互与体验要求：

- 移动端优先：答题页在 375px 宽度下单屏可完成选择 + 提交
- 题干支持 Markdown（含代码块），渲染后对 `cpp` 代码块做 highlight.js 高亮
- 提交后禁止改答案；对错用颜色 + 图标双重标识（不只靠颜色）
- 请求失败统一 toast 提示；401 自动清除 token 并跳登录页
- 未登录访问任何页面跳 `/login`

## 10. 题库内容规范与种子数据

`data/questions.seed.json` 为数组，每项字段与 `questions` 表一致。初始题目：

- 第 1-6 章，每章 15 道选择题（单选/多选/读代码写输出混合）
- 编程题：第 1-2 章各 2 道，第 3-6 章各 3 道，合计 16 道
- 选择题全部带 `explanation`，写清“为什么对 / 为什么错 / 常见误区”
- 编程题带 `hints`（2-3 条）与完整可编译的 `reference_solution`，难度以 VS 单文件可直接运行为准
- slug 规则：`ch{章节}-q{两位序号}`

## 11. 安全

- 密码 bcrypt（cost 12）哈希，任何响应不返回哈希
- JWT_SECRET 从环境变量读取，缺失时服务启动失败
- 登录/注册接口限流：每 IP 每分钟 10 次
- 全部入参经 zod 校验；SQL 全部使用参数化查询
- helmet 安全头；生产仅同源访问
- 管理接口强制校验 `role=admin`
- SQLite 开启 `journal_mode=WAL` 与 `foreign_keys=ON`

已知限制：当前无域名，只能以 `http://IP:端口` 访问，登录请求明文传输。后续添加域名后启用 Certbot + Let's Encrypt 即可升级为 HTTPS，不需要改代码。

## 12. 部署

1. 服务器安装 Node.js 24 与 nginx（无需 Docker；`node:sqlite` 为 Node 内置，无原生编译依赖）
2. 代码放 `/opt/cpp-practice`，`client/` 执行 `npm ci && npm run build`
3. `server/` 执行 `npm ci --omit=dev`，`.env` 配置 `JWT_SECRET`、`PORT=3000`、`DB_PATH=/var/lib/cpp-practice/app.db`
4. systemd unit `cpp-practice.service`：`User=cpp`, `WorkingDirectory=/opt/cpp-practice/server`, `ExecStart=/usr/bin/node src/index.js`, `Restart=always`
5. nginx：`root /opt/cpp-practice/client/dist;` + `location /api { proxy_pass http://127.0.0.1:3000; }`
6. 首次启动执行 seed 导入（幂等，按 slug upsert）
7. 备份策略：定期复制 `app.db` 文件

`deploy/` 目录内提供 nginx 配置样例、systemd unit 与一份中文部署步骤说明。

## 13. 测试策略

- 服务端：vitest + supertest，覆盖
  - 注册/登录/重复用户名/错误密码/过期 token
  - 非 admin 访问管理接口返回 403
  - 四种题型的判分（含多选题少选、output 忽略首尾空白）
  - 错题本状态机：答错进入、连续答对 1 次仍在、连续答对 2 次移出
  - `/questions` 响应不含答案字段
- 前端：对纯函数（判分、统计格式化）写单元测试；页面以手工验收清单为主
- 验收清单覆盖：手机宽度完成一轮章节练习、刷新后进度保持、换账号数据隔离

## 14. 实施里程碑

| 里程碑 | 内容 |
|---|---|
| M1 | 脚手架、数据库初始化、`.env` 配置 |
| M2 | 认证：注册/登录/JWT 中间件/首个用户为 admin |
| M3 | 题库：schema、seed 导入、章节与取题接口、判分服务 |
| M4 | 前端：登录、章节列表、答题页（四题型）、错题本、统计 |
| M5 | 管理页 + 批量导入 |
| M6 | 部署配置与部署说明；服务器上线（IP + 端口） |

## 15. 风险与应对

| 风险 | 应对 |
|---|---|
| 题库内容质量决定学习效果 | 每题强制写解析；编程题参考代码要求可编译并可本地运行验证 |
| 无域名导致 HTTP 明文 | 先内网/自用；后续加免费域名升级 HTTPS |
| SQLite 并发写 | 个人使用并发极低；开启 WAL；将来可换 Postgres（仅改 db 层） |
| 手机刷题体验差 | 移动端优先设计，375px 作为验收宽度 |
