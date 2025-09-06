#!/usr/bin/env bash
set -euo pipefail
set -x
trap 'echo "脚本出错，退出码：$?"' ERR

ENV_FILE=".env"
KEY="PREVIEW_TOKEN_SECRET"

# 生成32位随机字符串（字母+数字）
RANDOM_SECRET=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 32)

# 如果 .env 存在且包含 KEY，则替换，否则追加
if grep -q "^${KEY}=" "$ENV_FILE"; then
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s/^${KEY}=.*/${KEY}=${RANDOM_SECRET}/" "$ENV_FILE"
  else
    sed -i "s/^${KEY}=.*/${KEY}=${RANDOM_SECRET}/" "$ENV_FILE"
  fi
else
  echo "${KEY}=${RANDOM_SECRET}" >> "$ENV_FILE"
fi

echo "已自动更新 .env 中的 ${KEY} 为随机值：${RANDOM_SECRET}"
