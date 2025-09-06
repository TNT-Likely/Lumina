# MySQL 数据目录

此目录用于本地/开发阶段的 MySQL 数据与 DDL/Seed 管理。

- docker-compose.yml 中已将 ./mysql/data 挂载到容器 /var/lib/mysql
- 备份脚本：backup.sh；恢复脚本：restore.sh

## SQL 约定（仅保留两份权威 SQL）

- dev/mysql/sql/schema.sql：权威表结构（DDL）。必须与 `packages/data/src/models` 中的 Sequelize 模型保持同步。
- dev/mysql/sql/seed.sql：初始化数据（可选/开发用）。

> 任何后续表结构更新，请同时更新 schema.sql；如有默认数据调整，请同步更新 seed.sql。

### 使用方法

1. 初始化/重建数据库（开发环境）：

mysql> source /workspace/dev/mysql/sql/schema.sql;
mysql> source /workspace/dev/mysql/sql/seed.sql;  -- 可选

1. 升级数据库（保留数据）：

- 若为新增字段/索引/外键：请在 schema.sql 中反映，并在生产采用迁移脚本或手工变更；开发环境可重建。
- 若为破坏性变更（删表/改类型）：请先备份，评估数据迁移方案。

### 现有外键策略

- datasets.source_id -> datasources.id (ON DELETE RESTRICT, ON UPDATE CASCADE)
- views.dataset_id -> datasets.id (ON DELETE RESTRICT, ON UPDATE CASCADE)
- subscribes.dashboard_id -> dashboards.id (ON DELETE RESTRICT, ON UPDATE CASCADE)

说明：仪表盘 JSON 中对视图的引用不使用 DB 约束，由服务层校验删除依赖。

## 备份与恢复脚本

本目录包含更健壮的 `backup.sh` 和 `restore.sh`，用于开发环境的快速备份与恢复。

主要特性：
- 将备份保存到 `dev/mysql/backups/` 并自动压缩为 `.gz`。
- 支持本地 `mysqldump`/`mysql` 客户端或通过 Docker 容器执行（设置 `DOCKER_CONTAINER` 环境变量为容器名）。
- 提供简单的日志和恢复确认交互，避免误操作。

示例：

```bash
# 在本机上备份
cd dev/mysql
./backup.sh

# 使用容器备份
DOCKER_CONTAINER=dev-mysql MYSQL_USER=root MYSQL_PASSWORD='root123456' ./backup.sh

# 恢复最新备份
cd dev/mysql
./restore.sh backups/latest.sql.gz

# 使用容器恢复
DOCKER_CONTAINER=dev-mysql ./restore.sh backups/latest.sql.gz
```

请在生产环境中采用更严格的凭证与权限策略。
