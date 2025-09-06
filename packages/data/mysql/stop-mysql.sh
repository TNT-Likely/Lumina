#!/bin/bash
# stop-mysql.sh

echo "正在停止 MySQL Docker 容器..."

# 检查 docker 是否安装
if ! command -v docker &> /dev/null
then
    echo "错误: 未找到 Docker"
    exit 1
fi

# 停止并移除容器
docker-compose down

echo "MySQL 容器已停止并移除"