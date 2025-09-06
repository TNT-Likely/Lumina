#!/bin/bash

# 电商数据备份恢复脚本
# 用于快速备份和恢复测试数据，避免重复生成

# Docker配置
CONTAINER_NAME="mysql-ecommerce-test"
DB_USER="ecommerce"
DB_PASSWORD="ecommerce123"
DB_NAME="ecommerce_test"

# 备份配置
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="ecommerce_backup_${TIMESTAMP}.sql"
LATEST_BACKUP="ecommerce_latest.sql"

# 创建临时配置文件
TEMP_CNF=$(mktemp)
cat > "$TEMP_CNF" << EOF
[client]
user=$DB_USER
password=$DB_PASSWORD
EOF

# MySQL命令
MYSQL="docker exec -i $CONTAINER_NAME mysql --defaults-extra-file=/tmp/mysql.cnf"
MYSQLDUMP="docker exec $CONTAINER_NAME mysqldump --defaults-extra-file=/tmp/mysql.cnf"

# 复制配置文件到容器
docker cp "$TEMP_CNF" "$CONTAINER_NAME:/tmp/mysql.cnf" 2>/dev/null

# 显示使用说明
show_usage() {
    echo "📋 电商数据备份恢复工具"
    echo "=================================================="
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  backup              创建数据备份"
    echo "  restore [文件名]    恢复数据备份"
    echo "  list                列出所有备份文件"
    echo "  clean               清理旧备份文件"
    echo "  auto-backup         自动备份（如果数据存在）"
    echo "  status              检查数据状态"
    echo ""
    echo "示例:"
    echo "  $0 backup                              # 创建新备份"
    echo "  $0 restore                             # 恢复最新备份"
    echo "  $0 restore ecommerce_backup_20241201_143022.sql  # 恢复指定备份"
    echo "  $0 list                                # 列出备份文件"
    echo "  $0 status                              # 检查数据状态"
}

# 检查容器状态
check_container() {
    if ! docker ps | grep -q $CONTAINER_NAME; then
        echo "❌ Docker容器 $CONTAINER_NAME 未运行"
        echo "💡 请先启动容器: docker-compose up -d"
        cleanup_and_exit 1
    fi

    if ! $MYSQL $DB_NAME -e "SELECT 1;" >/dev/null 2>&1; then
        echo "❌ 无法连接到数据库"
        cleanup_and_exit 1
    fi
}

# 清理临时文件并退出
cleanup_and_exit() {
    rm -f "$TEMP_CNF"
    docker exec $CONTAINER_NAME rm -f /tmp/mysql.cnf 2>/dev/null
    exit $1
}

# 创建备份目录
ensure_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        echo "📁 创建备份目录: $BACKUP_DIR"
    fi
}

# 检查数据状态
check_data_status() {
    echo "🔍 检查数据库状态..."
    
    # 检查表是否存在
    tables=$($MYSQL $DB_NAME -e "SHOW TABLES;" 2>/dev/null | grep -v "Tables_in")
    if [ -z "$tables" ]; then
        echo "⚠️  数据库中没有表"
        return 1
    fi
    
    echo "📊 数据库表统计:"
    
    # 创建临时文件存储结果
    temp_file=$(mktemp)
    total_records=0
    
    # 遍历所有表并统计记录数
    for table in $tables; do
        if [ -n "$table" ]; then
            count=$($MYSQL $DB_NAME -e "SELECT COUNT(*) FROM $table;" 2>/dev/null | tail -1)
            count=${count:-0}
            printf "   %-20s: %'d 条记录\n" "$table" "$count"
            total_records=$((total_records + count))
        fi
    done
    
    echo ""
    echo "📈 总记录数: $total_records"
    
    # 清理临时文件
    rm -f "$temp_file"
    
    if [ $total_records -gt 0 ]; then
        echo "✅ 数据库包含测试数据"
        return 0
    else
        echo "⚠️  数据库为空"
        return 1
    fi
}

# 创建备份
create_backup() {
    echo "💾 开始创建数据备份..."
    
    check_container
    ensure_backup_dir
    
    # 检查是否有数据
    if ! check_data_status > /dev/null 2>&1; then
        echo "⚠️  数据库中没有数据，无需备份"
        cleanup_and_exit 0
    fi
    
    echo "📦 正在备份数据库..."
    
    # 创建带时间戳的备份
    if $MYSQLDUMP $DB_NAME > "$BACKUP_DIR/$BACKUP_FILE" 2>/dev/null; then
        echo "✅ 备份创建成功: $BACKUP_DIR/$BACKUP_FILE"
        
        # 创建最新备份的软链接
        cd "$BACKUP_DIR"
        ln -sf "$BACKUP_FILE" "$LATEST_BACKUP"
        cd - > /dev/null
        
        # 显示备份文件大小
        backup_size=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
        echo "📁 备份文件大小: $backup_size"
        
        # 压缩备份文件
        echo "🗜️  正在压缩备份文件..."
        if gzip "$BACKUP_DIR/$BACKUP_FILE"; then
            echo "✅ 备份文件已压缩: $BACKUP_DIR/$BACKUP_FILE.gz"
            
            # 更新软链接
            cd "$BACKUP_DIR"
            ln -sf "$BACKUP_FILE.gz" "$LATEST_BACKUP.gz"
            cd - > /dev/null
            
            compressed_size=$(du -h "$BACKUP_DIR/$BACKUP_FILE.gz" | cut -f1)
            echo "📁 压缩后大小: $compressed_size"
        fi
        
        echo ""
        echo "🎉 备份完成！"
        echo "💡 使用 '$0 restore' 可以恢复最新备份"
        
    else
        echo "❌ 备份创建失败"
        cleanup_and_exit 1
    fi
}

# 恢复备份
restore_backup() {
    local restore_file="$1"
    
    echo "🔄 开始恢复数据备份..."
    
    check_container
    ensure_backup_dir
    
    # 确定要恢复的文件
    if [ -z "$restore_file" ]; then
        # 使用最新备份
        if [ -f "$BACKUP_DIR/$LATEST_BACKUP.gz" ]; then
            restore_file="$BACKUP_DIR/$LATEST_BACKUP.gz"
            echo "📂 使用最新备份: $(readlink "$restore_file")"
        elif [ -f "$BACKUP_DIR/$LATEST_BACKUP" ]; then
            restore_file="$BACKUP_DIR/$LATEST_BACKUP"
            echo "📂 使用最新备份: $(readlink "$restore_file")"
        else
            echo "❌ 没有找到可用的备份文件"
            echo "💡 请先运行 '$0 backup' 创建备份，或指定备份文件"
            cleanup_and_exit 1
        fi
    else
        # 使用指定文件
        if [ ! -f "$BACKUP_DIR/$restore_file" ]; then
            echo "❌ 备份文件不存在: $BACKUP_DIR/$restore_file"
            cleanup_and_exit 1
        fi
        restore_file="$BACKUP_DIR/$restore_file"
    fi
    
    # 确认恢复操作
    echo ""
    echo "⚠️  恢复操作将删除当前数据库中的所有数据！"
    read -p "确定要继续吗？(y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "操作已取消"
        cleanup_and_exit 0
    fi
    
    echo ""
    echo "🗑️  清空现有数据..."
    
    # 禁用外键检查并清空所有表
    $MYSQL $DB_NAME << 'EOF'
SET FOREIGN_KEY_CHECKS = 0;
SET @tables = NULL;
SELECT GROUP_CONCAT(table_name) INTO @tables
FROM information_schema.tables 
WHERE table_schema = DATABASE();
SET @tables = CONCAT('DROP TABLE IF EXISTS ', @tables);
PREPARE stmt FROM @tables;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET FOREIGN_KEY_CHECKS = 1;
EOF
    
    echo "📥 正在恢复备份数据..."
    
    # 恢复数据
    if [[ "$restore_file" == *.gz ]]; then
        # 解压并恢复
        if zcat "$restore_file" | $MYSQL $DB_NAME; then
            echo "✅ 数据恢复成功"
        else
            echo "❌ 数据恢复失败"
            cleanup_and_exit 1
        fi
    else
        # 直接恢复
        if $MYSQL $DB_NAME < "$restore_file"; then
            echo "✅ 数据恢复成功"
        else
            echo "❌ 数据恢复失败"
            cleanup_and_exit 1
        fi
    fi
    
    echo ""
    echo "📊 恢复后数据统计:"
    check_data_status
    
    echo ""
    echo "🎉 恢复完成！"
}

# 列出备份文件
list_backups() {
    echo "📋 备份文件列表"
    echo "=================================================="
    
    ensure_backup_dir
    
    if [ ! "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
        echo "📁 备份目录为空"
        echo "💡 使用 '$0 backup' 创建第一个备份"
        return
    fi
    
    echo "📁 备份目录: $BACKUP_DIR"
    echo ""
    
    # 显示备份文件
    ls -la "$BACKUP_DIR"/*.sql* 2>/dev/null | while read -r permissions links owner group size month day time filename; do
        basename_file=$(basename "$filename")
        if [[ "$basename_file" != *"latest"* ]]; then
            printf "%-40s %8s %s %s %s\n" "$basename_file" "$size" "$month" "$day" "$time"
        fi
    done
    
    # 显示最新备份链接
    if [ -L "$BACKUP_DIR/$LATEST_BACKUP" ] || [ -L "$BACKUP_DIR/$LATEST_BACKUP.gz" ]; then
        echo ""
        echo "🔗 最新备份链接:"
        ls -la "$BACKUP_DIR"/*latest* 2>/dev/null | while read line; do
            echo "   $line"
        done
    fi
}

# 清理旧备份
clean_backups() {
    echo "🧹 清理旧备份文件"
    echo "=================================================="
    
    ensure_backup_dir
    
    # 保留最近7个备份文件
    KEEP_COUNT=7
    
    backup_files=$(ls -t "$BACKUP_DIR"/ecommerce_backup_*.sql* 2>/dev/null | grep -v latest)
    file_count=$(echo "$backup_files" | wc -l)
    
    if [ $file_count -le $KEEP_COUNT ]; then
        echo "📁 备份文件数量: $file_count，无需清理"
        return
    fi
    
    echo "📁 当前备份文件数量: $file_count"
    echo "🗑️  将删除最旧的 $((file_count - KEEP_COUNT)) 个备份文件"
    
    # 显示将要删除的文件
    echo "$backup_files" | tail -n +$((KEEP_COUNT + 1)) | while read file; do
        echo "   - $(basename "$file")"
    done
    
    read -p "确定要删除这些文件吗？(y/N): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        echo "$backup_files" | tail -n +$((KEEP_COUNT + 1)) | xargs rm -f
        echo "✅ 清理完成"
    else
        echo "操作已取消"
    fi
}

# 自动备份
auto_backup() {
    echo "🤖 自动备份检查"
    echo "=================================================="
    
    check_container
    
    # 检查是否有数据
    if check_data_status > /dev/null 2>&1; then
        echo "✅ 检测到测试数据，开始自动备份..."
        create_backup
    else
        echo "⚠️  数据库中没有数据，跳过自动备份"
        echo "💡 请先运行数据生成脚本，然后使用 '$0 backup' 创建备份"
    fi
}

# 主程序
main() {
    case "${1:-}" in
        "backup")
            create_backup
            ;;
        "restore")
            restore_backup "$2"
            ;;
        "list")
            list_backups
            ;;
        "clean")
            clean_backups
            ;;
        "auto-backup")
            auto_backup
            ;;
        "status")
            check_container
            check_data_status
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        "")
            show_usage
            ;;
        *)
            echo "❌ 未知选项: $1"
            echo ""
            show_usage
            cleanup_and_exit 1
            ;;
    esac
    
    cleanup_and_exit 0
}

# 执行主程序
main "$@"