# 临终关怀信息指南

提供临终关怀知识、症状照护、家属指导和资源清单的指南应用。

## 快速启动（Docker Compose）

```bash
cp .env.example .env
docker compose up -d --build
```

启动后访问：

- 前端：http://localhost:8238
- 后端健康检查：http://localhost:3238/api/health
- 数据库端口：localhost:5738

停止并清理容器、网络和数据卷：

```bash
docker compose down -v --remove-orphans
```

## 主要功能

- 临终关怀知识导航
- 症状照护与心理支持信息
- 资源、愿望清单和家属指南
- 家属指南 · 照护交接板：记录待办、完成留档、收班交接给下一位家人（数据存于 PostgreSQL，服务重启后保留）

## 照护交接板 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /api/care/board | 交接板总览：当前负责人、待办数量、最近交接时间、待办/已完成事项、交接记录 |
| POST | /api/care/person | 首次设置负责人（`{ "name": "妈妈" }`，已设置则 409） |
| POST | /api/care/tasks | 新增待办（`{ "title": "8点喂药" }`，记在现任负责人名下） |
| POST | /api/care/tasks/:id/complete | 完成名下待办，转入已完成留档 |
| POST | /api/care/handover | 交接班（`{ "toPerson": "爸爸" }`）；无待办或接手人仍是当前负责人时拒绝，状态保持不变 |

后端测试：

```bash
cd backend
npm install
npm test
```

## 本地开发

前端：

```bash
cd frontend
npm install
npm run dev
```

后端：

```bash
cd backend
npm install
npm run dev
```

数据库可通过根目录的 Docker Compose 单独启动：

```bash
docker compose up -d db
```

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React + Vite |
| 后端 | Node.js health API |
| 数据库 | PostgreSQL |
| 部署 | Docker Compose + Nginx |

## 项目目录结构

```text
.
├── docker-compose.yml
├── .env.example
├── .env
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── ...
├── backend/
│   ├── Dockerfile
│   └── ...
└── database/
    └── ...
```

## 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| COMPOSE_PROJECT_NAME | Compose 项目名，避免中文目录名导致项目名为空 | gb-138 |
| DB_NAME | 数据库名称 | hospice_guide |
| DB_USER | 数据库用户 | app |
| DB_PASSWORD | 数据库密码 | app_pwd |
| DB_ROOT_PASSWORD | 数据库 root/superuser 密码 | root_pwd |
| JWT_SECRET | 后端签名密钥 | hospice_guide_secret_key_2026 |
| FRONTEND_PORT | 前端宿主机端口 | 8238 |
| BACKEND_PORT | 后端宿主机端口 | 3238 |
| DB_PORT | 数据库宿主机端口 | 5738 |

## Docker 部署说明

- `docker-compose.yml` 顶层已声明 `name: gb-138`，可以在中文目录名下直接运行。
- 数据库使用 Docker 命名卷 `db_data` 持久化，不绑定到宿主中文路径。
- 前端容器使用 Nginx 托管静态资源，并将 `/api` 反向代理到后端服务名 `backend`。
- 后端会等待数据库健康后再启动，前端会等待后端健康后再启动。
- 如本机端口冲突，修改根目录 `.env` 中的 `FRONTEND_PORT`、`BACKEND_PORT` 或 `DB_PORT`。

## License

MIT
