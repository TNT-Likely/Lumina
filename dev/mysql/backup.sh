#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Robust MySQL backup script
# - saves dumps into ./backups/
# - supports local socket or docker container usage
# - compresses output and updates a 'latest' symlink

BACKUP_DIR="$(pwd)/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUT_NAME="mysql-backup-${TIMESTAMP}.sql"
OUT_PATH="$BACKUP_DIR/$OUT_NAME"

# Defaults (can override via env)
MYSQL_HOST=${MYSQL_HOST:-127.0.0.1}
MYSQL_PORT=${MYSQL_PORT:-3306}
MYSQL_USER=${MYSQL_USER:-root}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-root123456}
# 默认使用开发容器 dev-mysql（可通过环境变量覆盖）
DOCKER_CONTAINER=${DOCKER_CONTAINER:-dev-mysql}

echo "[INFO] 开始备份 MySQL -> $OUT_PATH"

if [ -n "$DOCKER_CONTAINER" ]; then
	echo "[INFO] 使用 Docker 容器: $DOCKER_CONTAINER"
	docker exec "$DOCKER_CONTAINER" sh -c "mysqldump -u$MYSQL_USER -p'${MYSQL_PASSWORD}' --all-databases" > "$OUT_PATH"
else
	# Try using mysqldump from PATH
	if ! command -v mysqldump >/dev/null 2>&1; then
		echo "[ERROR] 本地未找到 mysqldump。要使用容器备份请设置 DOCKER_CONTAINER 环境变量。"
		exit 2
	fi

	mysqldump -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" --all-databases > "$OUT_PATH"
fi

if [ ! -s "$OUT_PATH" ]; then
	echo "[ERROR] 备份文件为空或未创建: $OUT_PATH"
	exit 3
fi

gzip -f "$OUT_PATH"
OUT_PATH_GZ="$OUT_PATH.gz"
ln -sf "$(basename "$OUT_PATH_GZ")" "$BACKUP_DIR/latest.sql.gz"

echo "[OK] 备份完成: $OUT_PATH_GZ"
echo "[INFO] 可用备份列表:"
ls -l "$BACKUP_DIR" | sed -n '1,200p'

exit 0
