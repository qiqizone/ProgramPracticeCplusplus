# C++ 闯关 · 在线练习站

面向个人学习的 C++ 刷题网站：先读知识点，再做随堂练习，最后做章节练习；错题自动进错题本，进度保存在本地 SQLite。支持本地一键启动，也支持 Docker 部署到服务器。

## 功能

- **10 个章节、200 个知识点、400 道随堂练习、178 道章节练习题**（其中 30 道编程题）
- 章节学习页：知识点手风琴展开，含 Markdown 总结、易错点、代码示例，以及 cppreference 中文条目链接
- 每个知识点配 2 道随堂单选练习，提交即时判题并给出解析
- 章节练习：单选、多选、读代码写输出、编程题（编程题只给题干、提示与参考答案，本机自测）
- 错题本：章节练习错题与随堂练习错题分区展示，连续答对 2 次自动移出
- 统计面板：累计答题、正确率、各章掌握度、近 7 天答题趋势
- 收藏、随机练习（20 题）
- 管理员可在线维护题目（首个注册账号自动成为管理员）
- 本地免登录模式：双击即用，不需要账号密码

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | React 18 + TypeScript + Vite 5 + Tailwind CSS 3 |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| 后端 | Node.js 24 + Express 4（ESM） |
| 数据库 | SQLite（Node 内置 `node:sqlite`，WAL 模式，无原生依赖） |
| 认证 | JWT（HS256，7 天）+ bcryptjs |
| 校验 / 安全 | zod、helmet、cors、express-rate-limit |

## 目录结构

```
cpluspractice/
├─ client/                    # React 前端
│  └─ src/
│     ├─ pages/               # 章节、学习页、练习、错题本、统计、管理、登录
│     ├─ components/          # 布局、题目卡片、随堂练习、Markdown 等
│     ├─ store/               # 登录态
│     └─ api/                 # 请求封装（自动注入 token）
├─ server/                    # Express 后端
│  └─ src/
│     ├─ routes/              # auth、chapters、knowledge、questions、attempts、stats、admin
│     ├─ middleware/          # 鉴权、错误处理
│     ├─ db/                  # 连接、建表、种子导入
│     └─ services/            # 判分、错题状态机
├─ data/
│  ├─ questions.seed.json     # 178 道题目
│  └─ knowledge.seed.json     # 200 个知识点 + 400 道随堂练习
├─ deploy/                    # systemd、nginx、Dockerfile
├─ start.bat                  # Windows 一键启动
├─ sync.bat                   # 上传做题记录
└─ docker-compose.yml
```

## 本地运行（Windows）

前置：安装 **Node.js 24 或更高版本**。

1. 双击 `start.bat`
2. 首次运行会自动安装依赖、构建前端、导入题库，然后打开 http://127.0.0.1:3000
3. 之后每次双击即可，1-2 秒启动

`start.bat` 会自动在 `server/.env` 里写入 `LOCAL_MODE=1`，跳过登录页直接进入练习。数据库位于 `server/data/app.db`。

> 服务运行期间不要关闭那个命令行窗口，关闭即停止服务。

## 多设备同步做题记录

做题记录随代码一起托管在 git 仓库中（`server/data/app.db` 已被跟踪，`-wal` / `-shm` 临时文件被忽略）。

**当前电脑做完题后：**

1. 关闭服务窗口（数据库被占用时无法复制）
2. 双击 `sync.bat`：校验服务已停 → 刷新 WAL → 提交 → 推送

**换到另一台电脑：**

```powershell
git clone https://github.com/qiqizone/ProgramPracticeCplusplus.git
cd ProgramPracticeCplusplus
.\start.bat
```

之后每次先 `git pull` 再 `.\start.bat`。

## Docker 部署

```bash
cp .env.example .env      # 或在项目根目录新建，至少填写 JWT_SECRET
docker compose up -d --build
docker compose exec backend node src/db/seed.js
```

- `web` 容器：nginx 托管前端静态文件，`/api` 反向代理到 `backend`
- `backend` 容器：Node 24 运行后端，数据库位于命名卷 `cpp_data`
- 访问 `http://服务器IP/`，默认端口 80，可用 `HTTP_PORT` 调整

Docker 部署**不要**开启 `LOCAL_MODE`，仍是正常注册登录，首个注册账号为管理员。

## 非 Docker 部署（systemd + nginx）

见 [deploy/README.md](deploy/README.md)。

## 环境变量

| 变量 | 说明 | 默认 |
|---|---|---|
| `JWT_SECRET` | JWT 签名密钥，生产必须设置为随机长串 | — |
| `PORT` | 后端监听端口 | `3000` |
| `HOST` | 监听地址 | `127.0.0.1` |
| `DB_PATH` | SQLite 文件路径 | `./data/app.db` |
| `CLIENT_ORIGIN` | 允许的前端来源（CORS） | `http://localhost:5173` |
| `LOCAL_MODE` | 设为 `1` 时免登录，仅限本机使用 | 关闭 |

## 开发与测试

```bash
# 后端测试（24 项）
cd server && npm test

# 前端构建
cd client && npm run build

# 重新导入题库（幂等）
cd server && npm run seed
```

## 说明

- 不做在线编译与自动判题，编程题在本机 Visual Studio 中自行编写运行
- 判分规则：单选精确匹配；多选需完全一致；读代码题去首尾空白后精确匹配（大小写敏感）；编程题仅标记完成
- 错题状态：答错进入错题本；此前答错的题需连续答对 2 次才移出
- 数据库为二进制文件，每次同步都会保存一份完整副本，长期使用后仓库体积会增长
