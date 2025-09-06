#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Robust MySQL restore script
# Usage: restore.sh <backup-file.sql[.gz]>   (file path relative to this script or absolute)

BACKUP_FILE=${1:-}
if [ -z "$BACKUP_FILE" ]; then
  echo "用法: $0 <备份文件.sql|.sql.gz>"
  exit 1
fi

# 转为绝对路径
if [ ! -f "$BACKUP_FILE" ]; then
  if [ -f "./backups/$BACKUP_FILE" ]; then
    BACKUP_FILE="./backups/$BACKUP_FILE"
  elif [ -f "../backups/$BACKUP_FILE" ]; then
    BACKUP_FILE="../backups/$BACKUP_FILE"
  else
    echo "[ERROR] 未找到备份文件: $BACKUP_FILE"
    echo "[DEBUG] 当前目录: $(pwd)"
    exit 2
  fi
fi

MYSQL_HOST=${MYSQL_HOST:-127.0.0.1}
MYSQL_PORT=${MYSQL_PORT:-3306}
MYSQL_USER=${MYSQL_USER:-root}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-root123456}
# 默认使用开发容器 dev-mysql（可通过环境变量覆盖）
DOCKER_CONTAINER=${DOCKER_CONTAINER:-dev-mysql}

echo "[WARN] 恢复操作将会覆盖当前数据库，请确认"
read -p "继续恢复 $BACKUP_FILE ? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "操作取消"
  exit 0
fi

echo "[INFO] 开始恢复: $BACKUP_FILE"

if [[ "$BACKUP_FILE" == *.gz ]]; then
  DECOMP_CMD="gzip -dc '$BACKUP_FILE'"
else
  DECOMP_CMD="cat '$BACKUP_FILE'"
fi

if [ -n "$DOCKER_CONTAINER" ]; then
  echo "[INFO] 使用容器 $DOCKER_CONTAINER 恢复"
  if eval "$DECOMP_CMD | docker exec -i $DOCKER_CONTAINER mysql -u$MYSQL_USER -p'${MYSQL_PASSWORD}'"; then
    echo "[OK] 恢复成功 (容器)"
  else
    echo "[ERROR] 恢复失败 (容器)"
    exit 3
  fi
else
  if ! command -v mysql >/dev/null 2>&1; then
    echo "[ERROR] 本地未找到 mysql 客户端。要使用容器恢复请设置 DOCKER_CONTAINER 环境变量。"
    exit 4
  fi

  if eval "$DECOMP_CMD | mysql -h $MYSQL_HOST -P $MYSQL_PORT -u$MYSQL_USER -p'${MYSQL_PASSWORD}'"; then
    echo "[OK] 恢复成功"
  else
    echo "[ERROR] 恢复失败"
    exit 5
  fi
fi

echo "[INFO] 恢复完成，建议运行数据库校验脚本或应用检查。"

exit 0
