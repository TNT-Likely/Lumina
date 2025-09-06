# ---- 构建阶段 ----
FROM node:20-bullseye-slim AS builder

WORKDIR /app
COPY . .
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate && pnpm install --frozen-lockfile --prod=false \
  && pnpm run build:all


FROM node:20-bullseye-slim AS app

# 显式声明通过 build-args 传递的变量
ARG VERSION
ARG GIT_SHA
ARG GITHUB_REPOSITORY

LABEL org.opencontainers.image.version=$VERSION \
  org.opencontainers.image.revision=$GIT_SHA \
  org.opencontainers.image.source="https://github.com/${GITHUB_REPOSITORY:-unknown}"

WORKDIR /app
ENV NODE_ENV=production

# Install nginx
# 安装 puppeteer 运行所需的系统依赖
RUN apt-get update && apt-get install -y \
    curl \
    vim \
    nginx \
    chromium \
    fonts-liberation \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    fonts-wqy-zenhei \
    fonts-wqy-microhei \
    fontconfig \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

# 只复制运行所需产物
COPY --from=builder /app/ ./
RUN find ./ -type f -name '*.ts' -delete
COPY .docker/nginx.conf /etc/nginx/nginx.conf
COPY .docker/entrypoint.sh /entrypoint.sh

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN chmod +x /entrypoint.sh

EXPOSE 80
CMD ["/entrypoint.sh"]
