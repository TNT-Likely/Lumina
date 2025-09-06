#!/bin/bash

# 清空测试数据脚本

# Docker配置
CONTAINER_NAME="mysql-ecommerce-test"
DB_USER="ecommerce"
DB_PASSWORD="ecommerce123"
DB_NAME="ecommerce_test"

# MySQL命令简化 (通过docker exec执行)
MYSQL="docker exec $CONTAINER_NAME mysql -u$DB_USER -p$DB_PASSWORD $DB_NAME"

echo "🗑️  数据清理工具"
echo "=============================="

# 检查容器是否运行
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo "❌ Docker容器 $CONTAINER_NAME 未运行"
    echo "💡 请先启动容器: docker-compose up -d"
    exit 1
fi

# 显示当前数据统计
echo ""
echo "📊 当前数据统计:"
TABLES=("users" "categories" "brands" "products" "addresses" "orders" "order_items" "user_behavior_logs" "product_reviews" "promotions" "order_promotions" "inventory_logs")

total_records=0
for table in "${TABLES[@]}"; do
    count=$($MYSQL -sN -e "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
    total_records=$((total_records + count))
    printf "   %-20s %'d 条记录\n" "$table:" "$count"
done

echo ""
printf "总计: %'d 条记录\n" "$total_records"

if [ "$total_records" -eq 0 ]; then
    echo ""
    echo "✅ 数据库已经是空的，无需清理。"
    exit 0
fi

# 确认清理
echo ""
echo "⚠️  警告: 此操作将删除所有测试数据！"
read -p "是否继续？(输入 'yes' 确认): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ 操作已取消"
    exit 0
fi

echo ""
echo "🗑️  开始清理数据..."

# 禁用外键检查
$MYSQL -e "SET FOREIGN_KEY_CHECKS = 0;"

# 按依赖关系逆序清理
CLEAR_ORDER=(
    "inventory_logs"
    "order_promotions" 
    "product_reviews" 
    "user_behavior_logs" 
    "order_items" 
    "orders" 
    "addresses"
    "products" 
    "promotions" 
    "brands" 
    "categories" 
    "users"
)

for table in "${CLEAR_ORDER[@]}"; do
    if $MYSQL -e "TRUNCATE TABLE $table;" 2>/dev/null; then
        echo "   ✅ $table 已清空"
    else
        echo "   ❌ $table 清空失败"
    fi
done

# 重新启用外键检查
$MYSQL -e "SET FOREIGN_KEY_CHECKS = 1;"

echo ""
echo "🎉 数据清理完成！"

# 重置自增ID
echo ""
echo "🔄 重置自增ID..."
for table in "${CLEAR_ORDER[@]}"; do
    $MYSQL -e "ALTER TABLE $table AUTO_INCREMENT = 1;" 2>/dev/null && echo "   ✅ $table ID已重置"
done

echo ""
echo "✅ 所有数据已清理完成，可以重新生成测试数据。"