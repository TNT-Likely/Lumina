#!/bin/bash

# 测试数据库连接脚本

# Docker配置
CONTAINER_NAME="mysql-ecommerce-test"
DB_USER="ecommerce"
DB_PASSWORD="ecommerce123"
DB_NAME="ecommerce_test"

echo "🔗 测试数据库连接..."

# 检查容器是否运行
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo "❌ Docker容器 $CONTAINER_NAME 未运行"
    echo "💡 请先启动容器: docker-compose up -d"
    exit 1
fi

echo "✅ Docker容器运行正常"

# 测试数据库连接
if docker exec $CONTAINER_NAME mysql -u$DB_USER -p$DB_PASSWORD -e "SELECT 1;" 2>/dev/null; then
    echo "✅ 数据库连接成功"
else
    echo "❌ 数据库连接失败"
    echo "💡 请检查用户名密码是否正确: $DB_USER/$DB_PASSWORD"
    exit 1
fi

# 检查数据库是否存在
if docker exec $CONTAINER_NAME mysql -u$DB_USER -p$DB_PASSWORD -e "USE $DB_NAME;" 2>/dev/null; then
    echo "✅ 数据库 $DB_NAME 存在"
else
    echo "❌ 数据库 $DB_NAME 不存在"
    exit 1
fi

# 检查表是否存在
echo "📊 检查表结构..."
TABLES=(
    "users" "categories" "brands" "products" "addresses" 
    "orders" "order_items" "user_behavior_logs" "product_reviews" 
    "promotions" "order_promotions" "inventory_logs"
)

MISSING_TABLES=()
for table in "${TABLES[@]}"; do
    if docker exec $CONTAINER_NAME mysql -u$DB_USER -p$DB_PASSWORD -e "DESCRIBE $table;" $DB_NAME >/dev/null 2>&1; then
        echo "   ✅ $table"
    else
        echo "   ❌ $table"
        MISSING_TABLES+=($table)
    fi
done

if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
    echo ""
    echo "❌ 缺少以下表，请先运行建表SQL脚本:"
    for table in "${MISSING_TABLES[@]}"; do
        echo "   - $table"
    done
    exit 1
fi

# 显示数据统计
echo ""
echo "📊 当前数据统计:"
for table in "${TABLES[@]}"; do
    count=$(docker exec $CONTAINER_NAME mysql -u$DB_USER -p$DB_PASSWORD -sN -e "SELECT COUNT(*) FROM $table;" $DB_NAME 2>/dev/null || echo "0")
    printf "   %-20s %s 条记录\n" "$table:" "$count"
done

echo ""
echo "🎉 数据库检查完成，可以开始生成测试数据！"