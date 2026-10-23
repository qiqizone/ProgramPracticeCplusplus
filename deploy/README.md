# 部署说明

## 环境要求

- Linux 服务器（已测试思路适用于 Ubuntu/Debian 系）
- Node.js **24**（后端使用 Node 内置的 `node:sqlite`，无需编译原生模块）
- nginx
- 无需 Docker

## 一、本地开发

```bash
# 1. 后端
cd server
cp .env.example .env          # 填入一个足够长的随机 JWT_SECRET
npm install
npm run seed                  # 导入 106 道初始题目（幂等，可重复执行）
npm run dev                   # http://127.0.0.1:3000

# 2. 前端（另开一个终端）
cd client
npm install
npm run dev                   # http://127.0.0.1:5173
```

打开 http://127.0.0.1:5173 ，**第一个注册的账号自动成为管理员**，之后可以在「题目管理」里加题。

## 二、服务器部署

以下命令以 `root` 执行，部署目录 `/opt/cpp-practice`。

### 1. 安装 Node.js 24 与 nginx

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs nginx
node -v   # 应显示 v24.x
```

### 2. 创建运行用户与数据目录

```bash
useradd -r -s /usr/sbin/nologin cpp || true
mkdir -p /var/lib/cpp-practice
chown -R cpp:cpp /var/lib/cpp-practice
```

### 3. 上传代码

把项目放到 `/opt/cpp-practice`（可用 git clone 或 scp），确保包含 `client/`、`server/`、`data/`、`deploy/`。

```bash
cd /opt/cpp-practice/client
npm ci
npm run build          # 产物在 client/dist

cd /opt/cpp-practice/server
npm ci --omit=dev
```

### 4. 配置环境变量

```bash
cd /opt/cpp-practice/server
cp .env.example .env
```

编辑 `.env`：

```ini
JWT_SECRET=用 openssl rand -hex 32 生成的随机串
PORT=3000
DB_PATH=/var/lib/cpp-practice/app.db
CLIENT_ORIGIN=http://你的服务器IP
```

```bash
chown -R cpp:cpp /opt/cpp-practice
```

### 5. 导入题库

```bash
cd /opt/cpp-practice/server
runuser -u cpp -- node src/db/seed.js
```

### 6. 配置 systemd

```bash
cp /opt/cpp-practice/deploy/cpp-practice.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now cpp-practice
systemctl status cpp-practice
```

### 7. 配置 nginx

```bash
cp /opt/cpp-practice/deploy/nginx.conf /etc/nginx/sites-available/cpp-practice
ln -sf /etc/nginx/sites-available/cpp-practice /etc/nginx/sites-enabled/cpp-practice
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### 8. 放行端口

```bash
# 如果启用了 ufw
ufw allow 80/tcp
```

浏览器访问 `http://服务器IP/`，第一个注册的账号即为管理员。

## 三、日常维护

```bash
# 更新代码后
cd /opt/cpp-practice/client && npm ci && npm run build
cd /opt/cpp-practice/server && npm ci --omit=dev
systemctl restart cpp-practice

# 备份数据库（SQLite 单文件）
cp /var/lib/cpp-practice/app.db /var/lib/cpp-practice/app-$(date +%F).db

# 查看日志
journalctl -u cpp-practice -f
```

## 四、升级 HTTPS（拿到域名后）

当前用 IP + HTTP 访问，登录密码明文传输。建议注册一个免费域名（如 DuckDNS），然后：

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d 你的域名
```

证书自动续期，代码无需改动。

## 五、常见问题

| 现象 | 处理 |
|---|---|
| 启动报「缺少环境变量 JWT_SECRET」 | 检查 `server/.env` 是否存在且已填写 |
| 页面 404 / 刷新后白屏 | nginx 缺少 `try_files $uri $uri/ /index.html`，参考 `deploy/nginx.conf` |
| 接口 502 | 后端没起来：`systemctl status cpp-practice`、`journalctl -u cpp-practice -n 50` |
| 题库为空 | 执行 `runuser -u cpp -- node src/db/seed.js` |
| 数据库无写权限 | `chown -R cpp:cpp /var/lib/cpp-practice` |
