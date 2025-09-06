#!/bin/bash

# 显示数据统计报告脚本 - 修复版本
# 兼容不支持关联数组的Shell版本

# Docker配置
CONTAINER_NAME="mysql-ecommerce-test"
DB_USER="ecommerce"
DB_PASSWORD="ecommerce123"
DB_NAME="ecommerce_test"

# 创建临时配置文件以避免密码警告
TEMP_CNF=$(mktemp)
cat > "$TEMP_CNF" << EOF
[client]
user=$DB_USER
password=$DB_PASSWORD
EOF

# MySQL命令简化 (使用配置文件)
MYSQL="docker exec -i $CONTAINER_NAME mysql --defaults-extra-file=/tmp/mysql.cnf $DB_NAME -sN"

# 将配置文件复制到容器中
docker cp "$TEMP_CNF" "$CONTAINER_NAME:/tmp/mysql.cnf" 2>/dev/null

echo "📊 电商测试数据统计报告"
echo "=================================================="

# 检查容器是否运行
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo "❌ Docker容器 $CONTAINER_NAME 未运行"
    echo "💡 请先启动容器: docker-compose up -d"
    rm -f "$TEMP_CNF"
    exit 1
fi

# 测试数据库连接
echo "🔍 检查数据库连接..."
if ! $MYSQL -e "SELECT 1;" >/dev/null 2>&1; then
    echo "❌ 无法连接到数据库，请检查："
    echo "   - 容器是否正常运行"
    echo "   - 数据库用户名密码是否正确"
    echo "   - 数据库名称是否正确"
    
    # 显示容器状态
    echo ""
    echo "📋 容器状态:"
    docker ps --filter name=$CONTAINER_NAME --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    # 清理并退出
    rm -f "$TEMP_CNF"
    docker exec $CONTAINER_NAME rm -f /tmp/mysql.cnf 2>/dev/null
    exit 1
fi

echo "✅ 数据库连接正常"
echo ""

# 基础统计 - 使用函数替代关联数组
echo "📈 基础数据统计:"

# 定义表名和标签的函数
get_table_label() {
    case $1 in
        "users") echo "用户" ;;
        "categories") echo "商品分类" ;;
        "brands") echo "品牌" ;;
        "products") echo "商品" ;;
        "addresses") echo "收货地址" ;;
        "orders") echo "订单" ;;
        "order_items") echo "订单商品" ;;
        "product_reviews") echo "商品评价" ;;
        "promotions") echo "促销活动" ;;
        "user_behavior_logs") echo "用户行为日志" ;;
        "inventory_logs") echo "库存变动记录" ;;
        *) echo "$1" ;;
    esac
}

# 表列表
tables="users categories brands products addresses orders order_items product_reviews promotions user_behavior_logs inventory_logs"

# 统计每个表的数据
for table in $tables; do
    # 检查表是否存在
    table_exists=$($MYSQL -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_name='$table';" 2>/dev/null || echo "0")
    
    if [ "$table_exists" = "1" ]; then
        count=$($MYSQL -e "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
        label=$(get_table_label "$table")
        printf "   %-15s %'d 条\n" "${label}:" "$count"
    else
        label=$(get_table_label "$table")
        printf "   %-15s %s\n" "${label}:" "表不存在"
    fi
done

# 检查是否有数据
total_users=$($MYSQL -e "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
if [ "$total_users" = "0" ]; then
    echo ""
    echo "⚠️  数据库中暂无数据，请先运行数据初始化脚本"
    echo "   或检查表结构是否正确创建"
    
    # 显示现有的表
    echo ""
    echo "📋 当前数据库中的表:"
    existing_tables=$($MYSQL -e "SHOW TABLES;" 2>/dev/null || echo "")
    if [ -z "$existing_tables" ]; then
        echo "   无表存在"
    else
        echo "$existing_tables" | while read table; do
            echo "   - $table"
        done
    fi
    
    # 清理并退出
    rm -f "$TEMP_CNF"
    docker exec $CONTAINER_NAME rm -f /tmp/mysql.cnf 2>/dev/null
    exit 0
fi

# 用户分析
echo ""
echo "👥 用户分析:"

# 检查user_level字段是否存在
user_level_exists=$($MYSQL -e "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='$DB_NAME' AND table_name='users' AND column_name='user_level';" 2>/dev/null || echo "0")

if [ "$user_level_exists" = "1" ]; then
    echo "   用户等级分布:"
    user_level_data=$($MYSQL -e "
    SELECT user_level, COUNT(*) as count
    FROM users 
    GROUP BY user_level 
    ORDER BY FIELD(user_level, 'bronze', 'silver', 'gold', 'platinum', 'diamond');" 2>/dev/null)
    
    if [ -n "$user_level_data" ]; then
        echo "$user_level_data" | while IFS=$'\t' read level count; do
            if [ -n "$level" ] && [ -n "$count" ]; then
                printf "   %-10s: %'d 人\n" "${level:-未设置}" "$count"
            fi
        done
    else
        echo "   查询失败"
    fi
fi

# 检查gender字段是否存在
gender_exists=$($MYSQL -e "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='$DB_NAME' AND table_name='users' AND column_name='gender';" 2>/dev/null || echo "0")

if [ "$gender_exists" = "1" ]; then
    echo ""
    echo "   性别分布:"
    gender_data=$($MYSQL -e "
    SELECT gender, COUNT(*) as count
    FROM users 
    GROUP BY gender;" 2>/dev/null)
    
    if [ -n "$gender_data" ]; then
        echo "$gender_data" | while IFS=$'\t' read gender count; do
            if [ -n "$count" ]; then
                printf "   %-10s: %'d 人\n" "${gender:-未设置}" "$count"
            fi
        done
    else
        echo "   查询失败"
    fi
fi

# 订单分析（只在orders表存在时执行）
orders_exists=$($MYSQL -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_name='orders';" 2>/dev/null || echo "0")

if [ "$orders_exists" = "1" ]; then
    echo ""
    echo "🛒 订单分析:"
    
    order_stats=$($MYSQL -e "
    SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(actual_amount), 0) as total_sales,
        COALESCE(AVG(actual_amount), 0) as avg_order_value,
        COALESCE(MIN(actual_amount), 0) as min_order,
        COALESCE(MAX(actual_amount), 0) as max_order
    FROM orders;" 2>/dev/null)
    
    if [ -n "$order_stats" ]; then
        echo "$order_stats" | while IFS=$'\t' read total_orders total_sales avg_order min_order max_order; do
            printf "   总订单数: %'d\n" "$total_orders"
            printf "   总收入: ¥%.2f\n" "$total_sales"
            printf "   平均订单金额: ¥%.2f\n" "$avg_order"
            printf "   最小订单: ¥%.2f\n" "$min_order"
            printf "   最大订单: ¥%.2f\n" "$max_order"
        done
    fi

    echo ""
    echo "   支付方式分布:"
    payment_data=$($MYSQL -e "
    SELECT payment_method, COUNT(*) as count
    FROM orders 
    GROUP BY payment_method 
    ORDER BY COUNT(*) DESC;" 2>/dev/null)
    
    if [ -n "$payment_data" ]; then
        echo "$payment_data" | while IFS=$'\t' read method count; do
            if [ -n "$count" ]; then
                printf "   %-15s: %'d 笔\n" "${method:-未设置}" "$count"
            fi
        done
    fi

    echo ""
    echo "   订单状态分布:"
    status_data=$($MYSQL -e "
    SELECT order_status, COUNT(*) as count
    FROM orders 
    GROUP BY order_status 
    ORDER BY COUNT(*) DESC;" 2>/dev/null)
    
    if [ -n "$status_data" ]; then
        echo "$status_data" | while IFS=$'\t' read status count; do
            if [ -n "$count" ]; then
                printf "   %-15s: %'d 笔\n" "${status:-未设置}" "$count"
            fi
        done
    fi
fi

# 商品分析
products_exists=$($MYSQL -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_name='products';" 2>/dev/null || echo "0")

if [ "$products_exists" = "1" ]; then
    echo ""
    echo "📦 商品分析:"
    
    product_stats=$($MYSQL -e "
    SELECT 
        COUNT(*) as total_products,
        COALESCE(AVG(price), 0) as avg_price,
        COALESCE(MIN(price), 0) as min_price,
        COALESCE(MAX(price), 0) as max_price,
        COALESCE(SUM(stock_quantity), 0) as total_stock
    FROM products;" 2>/dev/null)
    
    if [ -n "$product_stats" ]; then
        echo "$product_stats" | while IFS=$'\t' read total_products avg_price min_price max_price total_stock; do
            printf "   商品总数: %'d\n" "$total_products"
            printf "   平均价格: ¥%.2f\n" "$avg_price"
            printf "   最低价格: ¥%.2f\n" "$min_price"
            printf "   最高价格: ¥%.2f\n" "$max_price"
            printf "   总库存: %'d 件\n" "$total_stock"
        done
    fi

    # 检查分类表和关联
    categories_exists=$($MYSQL -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_name='categories';" 2>/dev/null || echo "0")
    
    if [ "$categories_exists" = "1" ]; then
        echo ""
        echo "   热门分类 (一级):"
        category_data=$($MYSQL -e "
        SELECT c.name, COUNT(p.id) as product_count
        FROM categories c
        LEFT JOIN products p ON c.id = p.category_id
        WHERE c.level = 1
        GROUP BY c.id, c.name
        ORDER BY COUNT(p.id) DESC
        LIMIT 5;" 2>/dev/null)
        
        if [ -n "$category_data" ]; then
            echo "$category_data" | while IFS=$'\t' read name count; do
                if [ -n "$count" ]; then
                    printf "   %-15s: %'d 个商品\n" "${name:-未分类}" "$count"
                fi
            done
        fi
    fi
fi

# 用户行为分析
behavior_exists=$($MYSQL -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_name='user_behavior_logs';" 2>/dev/null || echo "0")

if [ "$behavior_exists" = "1" ]; then
    echo ""
    echo "📊 用户行为分析:"
    
    action_data=$($MYSQL -e "
    SELECT action_type, COUNT(*) as count
    FROM user_behavior_logs 
    GROUP BY action_type 
    ORDER BY COUNT(*) DESC;" 2>/dev/null)
    
    if [ -n "$action_data" ]; then
        echo "$action_data" | while IFS=$'\t' read action count; do
            if [ -n "$count" ]; then
                printf "   %-15s: %'d 次\n" "${action:-未知}" "$count"
            fi
        done
    fi

    echo ""
    echo "   设备类型分布:"
    device_data=$($MYSQL -e "
    SELECT device_type, COUNT(*) as count
    FROM user_behavior_logs 
    GROUP BY device_type 
    ORDER BY COUNT(*) DESC;" 2>/dev/null)
    
    if [ -n "$device_data" ]; then
        echo "$device_data" | while IFS=$'\t' read device count; do
            if [ -n "$count" ]; then
                printf "   %-15s: %'d 次\n" "${device:-未知}" "$count"
            fi
        done
    fi
fi

# 地域分析
province_exists=$($MYSQL -e "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='$DB_NAME' AND table_name='users' AND column_name='province';" 2>/dev/null || echo "0")

if [ "$province_exists" = "1" ]; then
    echo ""
    echo "🗺️  地域分析:"
    echo "   用户省份分布 (TOP 10):"
    
    province_data=$($MYSQL -e "
    SELECT province, COUNT(*) as count
    FROM users 
    WHERE province IS NOT NULL AND province != ''
    GROUP BY province 
    ORDER BY COUNT(*) DESC 
    LIMIT 10;" 2>/dev/null)
    
    if [ -n "$province_data" ]; then
        echo "$province_data" | while IFS=$'\t' read province count; do
            if [ -n "$count" ]; then
                printf "   %-15s: %'d 人\n" "$province" "$count"
            fi
        done
    fi
fi

# 时间分析
if [ "$orders_exists" = "1" ]; then
    echo ""
    echo "📅 时间分析:"
    echo "   月度订单趋势 (最近6个月):"
    
    monthly_data=$($MYSQL -e "
    SELECT 
        DATE_FORMAT(order_date, '%Y-%m') as month,
        COUNT(*) as order_count,
        COALESCE(SUM(actual_amount), 0) as total_amount
    FROM orders 
    WHERE order_date IS NOT NULL
    GROUP BY DATE_FORMAT(order_date, '%Y-%m')
    ORDER BY DATE_FORMAT(order_date, '%Y-%m') DESC
    LIMIT 6;" 2>/dev/null)
    
    if [ -n "$monthly_data" ]; then
        echo "$monthly_data" | while IFS=$'\t' read month order_count total_amount; do
            if [ -n "$order_count" ]; then
                printf "   %s: %'d 笔订单, ¥%.0f\n" "$month" "$order_count" "$total_amount"
            fi
        done
    fi
fi

echo ""
echo "=================================================="
echo "📊 统计报告生成完成！"

# 清理临时文件
rm -f "$TEMP_CNF"
docker exec $CONTAINER_NAME rm -f /tmp/mysql.cnf 2>/dev/null

# 提供故障排除建议
echo ""
echo "💡 故障排除建议："
echo "   - 如果看到大量 '查询失败' 或 '表不存在'，请检查数据库结构"
echo "   - 如果数据为0，请运行数据初始化脚本"
echo "   - 检查字段名称是否与实际表结构匹配"
echo ""
echo "🔗 相关命令："
echo "   - 生成测试数据: ./generate_data.sh"
echo "   - 查看表结构: docker exec $CONTAINER_NAME mysql -u$DB_USER -p$DB_PASSWORD $DB_NAME -e 'SHOW TABLES;'"