# Lumina 项目文档

本项目文档分为以下模块：

## 1. 预览

> 线上 Demo：<https://lumina.zeabur.app/>
>
> 测试账号：`testlumina` / `123456`
>
> 说明：演示环境为只读，创建/更新/删除操作可能被限制。

## 2. 产品使用文档

- 使用手册直达：见 [doc/usage.md](./doc/usage.md)
- 接口单测方案：见 [doc/testing.md](./doc/testing.md)

 快速运行（可选）：

- 启动测试依赖：pnpm test:api:deps
- 运行接口单测：pnpm test:api
- 结束并清理依赖：pnpm test:api:deps:down

## 3.快速部署

```yml
networks:
   lumina-net:
    driver: bridge

services:
 lumina:
  networks:
    - lumina-net
  image: sunxiao0721/lumina:latest
  container_name: lumina
  restart: always
  ports:
   - "3020:80"         # 对外暴露 80 端口（Nginx 提供静态与反向代理）
  env_file:
   - ./.env          # 从当前目录读取环境变量
  volumes:
   - ./logs:/app/apps/server/logs   # 持久化服务端日志（可选）
  depends_on:
   - mysql
   - redis
   - rabbitmq

 mysql:
  image: mysql:8.0
  container_name: lumina-mysql
  restart: always
  networks:
    - lumina-net
  environment:
   MYSQL_ROOT_PASSWORD: root123456
   MYSQL_DATABASE: lumina
   MYSQL_USER: lumina
   MYSQL_PASSWORD: lumina123
  ports:
   - "3306:3306"
  volumes:
   - ./mysql/data:/var/lib/mysql

 redis:
  image: redis:7.2
  container_name: lumina-redis
  restart: always
  networks:
    - lumina-net
  ports:
   - "6389:6379"
  volumes:
   - ./redis/data:/data
  command: ["redis-server", "--appendonly", "yes"]

 rabbitmq:
  image: rabbitmq:3.12-management
  container_name: lumina-rabbitmq
  restart: always
  networks:
    - lumina-net
  ports:
   - "5672:5672"
   - "15672:15672"
  environment:
   RABBITMQ_DEFAULT_USER: admin
   RABBITMQ_DEFAULT_PASS: admin
```

## 4. 开发

### 环境依赖

- Node.js >= 18
- pnpm >= 8
- MySQL >= 5.7（推荐 8.x）
- Redis >= 5
- RabbitMQ >= 3.8

可使用一键启动脚本：

```sh
cd dev
docker-compose up -d
```

### 环境变量配置

复制 `.env` 为 `.env.local`，并根据实际环境填写数据库、Redis、RabbitMQ、邮件等配置。
详细变量说明见 `.env` 注释。可选端口：WEB_PORT（前端，默认 5173）、SERVER_PORT（后端，默认 7002）。

### 安装依赖

在项目根目录执行：

```sh
pnpm install
```

### 启动服务

分别启动后端和前端：

```sh
pnpm -C apps/server dev
pnpm -C apps/web dev
```

前端默认端口 5173，后端默认端口 7002。

### 开发调试

- 前端支持热重载，推荐使用 VSCode + Volar/TypeScript 插件。
- 后端支持热重载，代码变更自动重启。
- 可用 Postman/Apifox 调试接口。

### 常见问题排查

- 依赖未安装：请确认已执行 `pnpm install`。
- 数据库/Redis/RabbitMQ 未启动：请检查 dev/docker-compose.yml 或本地服务。
- 环境变量缺失：请检查 `.env.local` 是否补全。
- 端口冲突：可在 `.env.local` 或启动命令中自定义端口（WEB_PORT、SERVER_PORT）。
- 数据库/Redis/RabbitMQ 未启动：请检查 dev/docker-compose.yml 或本地服务。
