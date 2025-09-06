#!/bin/bash

# 电商测试数据生成脚本
# 使用纯 Shell + MySQL 生成测试数据

# Docker配置
CONTAINER_NAME="mysql-ecommerce-test"
DB_USER="ecommerce"
DB_PASSWORD="ecommerce123"
DB_NAME="ecommerce_test"

# 创建临时配置文件
TEMP_CNF=$(mktemp)
cat > "$TEMP_CNF" << EOF
[client]
user=$DB_USER
password=$DB_PASSWORD
EOF

# MySQL命令
MYSQL="docker exec -i $CONTAINER_NAME mysql --defaults-extra-file=/tmp/mysql.cnf $DB_NAME"

# 将配置文件复制到容器中
docker cp "$TEMP_CNF" "$CONTAINER_NAME:/tmp/mysql.cnf" 2>/dev/null

# 数据生成配置
USERS_COUNT=2500
CATEGORIES_COUNT=50
BRANDS_COUNT=100
PRODUCTS_COUNT=1000
ORDERS_COUNT=12000
PROMOTIONS_COUNT=20
BEHAVIOR_LOGS_COUNT=50000

echo "🚀 开始生成电商测试数据"
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
    echo "❌ 无法连接到数据库"
    rm -f "$TEMP_CNF"
    docker exec $CONTAINER_NAME rm -f /tmp/mysql.cnf 2>/dev/null
    exit 1
fi

echo "✅ 数据库连接正常"

# 清空现有数据
echo "🗑️  清空现有测试数据..."
$MYSQL << 'EOF'
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE inventory_logs;
TRUNCATE TABLE order_promotions;
TRUNCATE TABLE product_reviews;
TRUNCATE TABLE user_behavior_logs;
TRUNCATE TABLE order_items;
TRUNCATE TABLE orders;
TRUNCATE TABLE addresses;
TRUNCATE TABLE products;
TRUNCATE TABLE promotions;
TRUNCATE TABLE brands;
TRUNCATE TABLE categories;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;
EOF

# 生成随机数函数
random_number() {
    local min=$1
    local max=$2
    
    # 检查参数是否有效
    if [ -z "$min" ] || [ -z "$max" ] || [ "$min" -gt "$max" ]; then
        echo "0"
        return
    fi
    
    # 如果min和max相等，直接返回
    if [ "$min" -eq "$max" ]; then
        echo "$min"
        return
    fi
    
    echo $((RANDOM % (max - min + 1) + min))
}

# 随机选择数组元素（修复版本）
random_choice() {
    local arr=("$@")
    local count=${#arr[@]}
    
    # 检查数组是否为空
    if [ $count -eq 0 ]; then
        echo ""
        return
    fi
    
    local index=$((RANDOM % count))
    echo "${arr[$index]}"
}

# 生成随机日期函数 (YYYY-MM-DD格式)
random_date() {
    local start_year=$1
    local end_year=$2
    local year=$(random_number $start_year $end_year)
    local month=$(printf "%02d" $(random_number 1 12))
    local day=$(printf "%02d" $(random_number 1 28))
    echo "$year-$month-$day"
}

# 数组定义
PROVINCES=("北京市" "上海市" "天津市" "重庆市" "河北省" "山西省" "辽宁省" "吉林省" "黑龙江省" "江苏省" "浙江省" "安徽省" "福建省" "江西省" "山东省" "河南省" "湖北省" "湖南省" "广东省" "海南省" "四川省" "贵州省" "云南省" "陕西省" "甘肃省" "青海省" "内蒙古自治区" "广西壮族自治区" "西藏自治区" "宁夏回族自治区" "新疆维吾尔自治区" "香港特别行政区" "澳门特别行政区")

CITIES=("广州市" "深圳市" "珠海市" "汕头市" "佛山市" "韶关市" "湛江市" "肇庆市" "江门市" "茂名市" "惠州市" "梅州市" "汕尾市" "河源市" "阳江市" "清远市" "东莞市" "中山市" "潮州市" "揭阳市" "云浮市")

DISTRICTS=("东城区" "西城区" "朝阳区" "丰台区" "石景山区" "海淀区" "门头沟区" "房山区" "通州区" "顺义区" "昌平区" "大兴区" "怀柔区" "平谷区" "密云区" "延庆区")

USERNAMES=("张三" "李四" "王五" "赵六" "陈七" "刘八" "周九" "吴十" "郑一" "孙二" "朱三" "许四" "何五" "吕六" "施七" "张八" "孔九" "曹十" "严一" "华二" "金三" "魏四" "陶五" "姜六" "戚七" "谢八" "邹九" "喻十" "柏一" "水二" "窦三" "章四" "云五" "苏六" "潘七" "葛八" "奚九" "范十" "彭一" "郎二")

GENDERS=("male" "female" "unknown")
USER_LEVELS=("bronze" "silver" "gold" "platinum" "diamond")

CATEGORY_NAMES=("电子产品" "服装鞋包" "家居用品" "美妆个护" "食品饮料" "运动户外" "图书文具" "母婴用品" "汽车用品" "宠物用品")

BRAND_NAMES=("苹果" "华为" "小米" "三星" "OPPO" "vivo" "耐克" "阿迪达斯" "优衣库" "ZARA" "H&M" "无印良品" "宜家" "海尔" "美的" "格力" "雅诗兰黛" "欧莱雅" "兰蔻" "SK-II")

PRODUCT_NAMES=("智能手机" "笔记本电脑" "平板电脑" "蓝牙耳机" "运动鞋" "连衣裙" "T恤衫" "牛仔裤" "床上四件套" "沙发" "餐桌" "台灯" "保温杯" "电饭煲" "空气净化器" "洗面奶" "面膜" "口红" "香水" "咖啡豆")

PAYMENT_METHODS=("alipay" "wechat" "credit_card" "cash_on_delivery")
ORDER_STATUS=("pending" "confirmed" "processing" "shipped" "delivered" "cancelled")
PAYMENT_STATUS=("pending" "paid" "failed")

COURIER_COMPANIES=("顺丰速运" "圆通速递" "中通快递" "申通快递" "韵达快递" "百世快递" "德邦物流" "京东物流")

DEVICE_TYPES=("desktop" "mobile" "tablet")
OS_TYPES=("Windows" "MacOS" "iOS" "Android" "Linux")

ACTION_TYPES=("view" "search" "add_to_cart" "remove_from_cart" "add_to_wishlist" "purchase")
TARGET_TYPES=("product" "category" "brand" "page")

# 随机选择数组元素
random_choice() {
    local arr=("$@")
    local index=$(random_number 0 $((${#arr[@]} - 1)))
    echo "${arr[$index]}"
}

# 生成用户数据
echo "👥 生成 $USERS_COUNT 个用户..."
for i in $(seq 1 $USERS_COUNT); do
    username="user_$(printf "%06d" $i)"
    email="user${i}@example.com"
    phone="1$(random_number 3000000000 9999999999)"
    gender=$(random_choice "${GENDERS[@]}")
    birthday=$(random_date 1980 2005)
    registration_date=$(random_date 2020 2024)
    last_login_date=$(random_date 2024 2024)
    user_level=$(random_choice "${USER_LEVELS[@]}")
    total_spent=$(random_price 0 50000)
    total_orders=$(random_number 0 100)
    province=$(random_choice "${PROVINCES[@]}")
    city=$(random_choice "${CITIES[@]}")
    district=$(random_choice "${DISTRICTS[@]}")
    is_active=$(random_number 0 1)

    $MYSQL << EOF
INSERT INTO users (username, email, phone, gender, birthday, registration_date, last_login_date, user_level, total_spent, total_orders, province, city, district, is_active) 
VALUES ('$username', '$email', '$phone', '$gender', '$birthday', '$registration_date', '$last_login_date', '$user_level', $total_spent, $total_orders, '$province', '$city', '$district', $is_active);
EOF

    if [ $((i % 500)) -eq 0 ]; then
        echo "   已生成 $i 个用户..."
    fi
done

# 生成分类数据
echo "📂 生成商品分类..."
for i in $(seq 1 ${#CATEGORY_NAMES[@]}); do
    category_name="${CATEGORY_NAMES[$((i-1))]}"
    sort_order=$(random_number 1 100)
    
    $MYSQL << EOF
INSERT INTO categories (name, parent_id, level, sort_order) 
VALUES ('$category_name', NULL, 1, $sort_order);
EOF

    # 为每个一级分类生成子分类
    for j in $(seq 1 5); do
        sub_category_name="${category_name}_子分类${j}"
        sub_sort_order=$(random_number 1 100)
        
        $MYSQL << EOF
INSERT INTO categories (name, parent_id, level, sort_order) 
VALUES ('$sub_category_name', $i, 2, $sub_sort_order);
EOF
    done
done

# 生成品牌数据
echo "🏷️  生成品牌数据..."
for i in $(seq 1 ${#BRAND_NAMES[@]}); do
    brand_name="${BRAND_NAMES[$((i-1))]}"
    country="中国"
    if [[ "$brand_name" =~ ^(苹果|耐克|阿迪达斯)$ ]]; then
        country="美国"
    elif [[ "$brand_name" =~ ^(ZARA|H&M)$ ]]; then
        country="欧洲"
    fi
    established_year=$(random_number 1950 2020)
    brand_level=$(random_choice "luxury" "premium" "mass" "budget")
    
    $MYSQL << EOF
INSERT INTO brands (name, country, established_year, brand_level) 
VALUES ('$brand_name', '$country', $established_year, '$brand_level');
EOF
done

# 补充更多品牌到100个
for i in $(seq $((${#BRAND_NAMES[@]} + 1)) $BRANDS_COUNT); do
    brand_name="品牌_$(printf "%03d" $i)"
    country=$(random_choice "中国" "美国" "日本" "德国" "法国")
    established_year=$(random_number 1950 2020)
    brand_level=$(random_choice "luxury" "premium" "mass" "budget")
    
    $MYSQL << EOF
INSERT INTO brands (name, country, established_year, brand_level) 
VALUES ('$brand_name', '$country', $established_year, '$brand_level');
EOF
done

# 生成商品数据
echo "📦 生成 $PRODUCTS_COUNT 个商品..."
for i in $(seq 1 $PRODUCTS_COUNT); do
    product_name="${PRODUCT_NAMES[$((RANDOM % ${#PRODUCT_NAMES[@]}))]}_$(printf "%04d" $i)"
    sku="SKU$(date +%s)$(printf "%06d" $i)"
    category_id=$(random_number 1 50)  # 假设有50个分类
    brand_id=$(random_number 1 $BRANDS_COUNT)
    price=$(random_price 10 5000)
    cost=$(echo "scale=2; $price * 0.$(random_number 30 80)" | bc)
    stock_quantity=$(random_number 0 1000)
    min_stock_level=$(random_number 5 50)
    weight=$(echo "scale=2; $(random_number 1 50).$(random_number 10 99)" | bc)
    length=$(echo "scale=2; $(random_number 5 100).$(random_number 10 99)" | bc)
    width=$(echo "scale=2; $(random_number 5 100).$(random_number 10 99)" | bc)
    height=$(echo "scale=2; $(random_number 5 50).$(random_number 10 99)" | bc)
    status=$(random_choice "active" "inactive" "out_of_stock")
    rating=$(echo "scale=1; $(random_number 10 50)/10" | bc)
    review_count=$(random_number 0 1000)
    view_count=$(random_number 0 10000)
    sales_count=$(random_number 0 500)
    launch_date=$(random_date 2020 2024)

    $MYSQL << EOF
INSERT INTO products (name, sku, category_id, brand_id, price, cost, stock_quantity, min_stock_level, weight, length, width, height, status, rating, review_count, view_count, sales_count, launch_date) 
VALUES ('$product_name', '$sku', $category_id, $brand_id, $price, $cost, $stock_quantity, $min_stock_level, $weight, $length, $width, $height, '$status', $rating, $review_count, $view_count, $sales_count, '$launch_date');
EOF

    if [ $((i % 200)) -eq 0 ]; then
        echo "   已生成 $i 个商品..."
    fi
done

# 生成收货地址
echo "📍 生成收货地址..."
for user_id in $(seq 1 $USERS_COUNT); do
    address_count=$(random_number 1 3)
    
    for j in $(seq 1 $address_count); do
        contact_name="收件人_${user_id}_${j}"
        contact_phone="1$(random_number 3000000000 9999999999)"
        province=$(random_choice "${PROVINCES[@]}")
        city=$(random_choice "${CITIES[@]}")
        district=$(random_choice "${DISTRICTS[@]}")
        street="街道地址_${user_id}_${j}"
        postal_code=$(printf "%06d" $(random_number 100000 999999))
        is_default=$([[ $j -eq 1 ]] && echo 1 || echo 0)
        address_type=$(random_choice "home" "office" "other")

        $MYSQL << EOF
INSERT INTO addresses (user_id, contact_name, contact_phone, province, city, district, street, postal_code, is_default, address_type) 
VALUES ($user_id, '$contact_name', '$contact_phone', '$province', '$city', '$district', '$street', '$postal_code', $is_default, '$address_type');
EOF
    done

    if [ $((user_id % 500)) -eq 0 ]; then
        echo "   已生成 $user_id 个用户的地址..."
    fi
done

# 生成促销活动
echo "🎉 生成促销活动..."
for i in $(seq 1 $PROMOTIONS_COUNT); do
    name="促销活动_$(printf "%02d" $i)"
    type=$(random_choice "discount" "coupon" "flash_sale" "bundle" "free_shipping")
    discount_type=$(random_choice "percentage" "fixed_amount")
    discount_value=$(random_price 5 50)
    min_order_amount=$(random_price 100 1000)
    max_discount_amount=$(random_price 50 500)
    start_date=$(random_date 2024 2024)
    end_date=$(random_date 2024 2024)
    usage_limit=$(random_number 100 1000)
    used_count=$(random_number 0 50)

    $MYSQL << EOF
INSERT INTO promotions (name, type, discount_type, discount_value, min_order_amount, max_discount_amount, start_date, end_date, usage_limit, used_count) 
VALUES ('$name', '$type', '$discount_type', $discount_value, $min_order_amount, $max_discount_amount, '$start_date', '$end_date', $usage_limit, $used_count);
EOF
done


# 获取实际的地址ID和用户ID范围
echo "🔍 获取数据库中的实际ID范围..."
address_ids=($($MYSQL -e "SELECT id FROM addresses ORDER BY id;" | tr '\n' ' '))
address_count=${#address_ids[@]}

user_ids=($($MYSQL -e "SELECT id FROM users ORDER BY id;" | tr '\n' ' '))
user_count=${#user_ids[@]}

product_ids=($($MYSQL -e "SELECT id FROM products ORDER BY id;" | tr '\n' ' '))
product_count=${#product_ids[@]}

if [ $address_count -eq 0 ] || [ $user_count -eq 0 ] || [ $product_count -eq 0 ]; then
    echo "❌ 缺少必要的基础数据，请先生成用户、地址和商品"
    exit 1
fi

echo "✅ 找到 $address_count 个地址, $user_count 个用户, $product_count 个商品"

# 生成订单数据
echo "🛒 生成 $ORDERS_COUNT 个订单..."
for i in $(seq 1 $ORDERS_COUNT); do
    order_no="ORD$(date +%s)$(printf "%06d" $i)"
    
    # 使用实际存在的用户ID
    user_index=$(random_number 0 $((user_count - 1)))
    user_id=${user_ids[$user_index]}
    
    # 使用实际存在的地址ID
    address_index=$(random_number 0 $((address_count - 1)))
    shipping_address_id=${address_ids[$address_index]}
    
    total_amount=$(random_price 50 2000)
    discount_amount=$(echo "scale=2; $total_amount * 0.$(random_number 0 20)" | bc)
    shipping_fee=$(random_price 0 20)
    actual_amount=$(echo "scale=2; $total_amount - $discount_amount + $shipping_fee" | bc)
    payment_method=$(random_choice "${PAYMENT_METHODS[@]}")
    payment_status=$(random_choice "${PAYMENT_STATUS[@]}")
    order_status=$(random_choice "${ORDER_STATUS[@]}")
    courier_company=$(random_choice "${COURIER_COMPANIES[@]}")
    tracking_number="TRACK$(random_number 100000000000 999999999999)"
    order_source=$(random_choice "web" "mobile_app" "wechat" "offline")
    device_type=$(random_choice "${DEVICE_TYPES[@]}")
    ip_address="192.168.$(random_number 1 255).$(random_number 1 255)"
    order_date=$(random_date 2024 2024)
    payment_date=$(random_date 2024 2024)

    # 插入订单并检查是否成功
    order_insert_result=$($MYSQL << EOF
INSERT INTO orders (order_no, user_id, total_amount, discount_amount, shipping_fee, actual_amount, payment_method, payment_status, order_status, shipping_address_id, courier_company, tracking_number, order_source, device_type, ip_address, order_date, payment_date) 
VALUES ('$order_no', $user_id, $total_amount, $discount_amount, $shipping_fee, $actual_amount, '$payment_method', '$payment_status', '$order_status', $shipping_address_id, '$courier_company', '$tracking_number', '$order_source', '$device_type', '$ip_address', '$order_date', '$payment_date');
SELECT LAST_INSERT_ID();
EOF
)

    # 获取订单ID（取最后一行）
    order_id=$(echo "$order_insert_result" | tail -1)
    
    # 检查订单ID是否有效
    if [ "$order_id" = "0" ] || [ -z "$order_id" ]; then
        echo "   警告: 订单 $i 插入失败，跳过商品项生成"
        continue
    fi

    # 为每个订单生成1-3个商品
    item_count=$(random_number 1 3)
    for j in $(seq 1 $item_count); do
        # 使用实际存在的商品ID
        product_index=$(random_number 0 $((product_count - 1)))
        product_id=${product_ids[$product_index]}
        
        product_name="商品_${product_id}"
        product_sku="SKU_${product_id}"
        unit_price=$(random_price 10 500)
        quantity=$(random_number 1 5)
        total_price=$(echo "scale=2; $unit_price * $quantity" | bc)
        discount_amount_item=$(echo "scale=2; $total_price * 0.$(random_number 0 10)" | bc)
        actual_price=$(echo "scale=2; $total_price - $discount_amount_item" | bc)

        # 插入订单商品项
        $MYSQL << EOF 2>/dev/null
INSERT INTO order_items (order_id, product_id, product_name, product_sku, unit_price, quantity, total_price, discount_amount, actual_price) 
VALUES ($order_id, $product_id, '$product_name', '$product_sku', $unit_price, $quantity, $total_price, $discount_amount_item, $actual_price);
EOF
        
        if [ $? -ne 0 ]; then
            echo "   警告: 订单 $order_id 的商品项 $j 插入失败"
        fi
    done

    if [ $((i % 1000)) -eq 0 ]; then
        echo "   已生成 $i 个订单..."
    fi
done

# 生成商品评价
echo "⭐ 生成商品评价..."
review_count=$((ORDERS_COUNT * 30 / 100))  # 30%的订单有评价
for i in $(seq 1 $review_count); do
    product_index=$(random_number 0 $((product_count - 1)))
    product_id=${product_ids[$product_index]}
    
    user_index=$(random_number 0 $((user_count - 1)))
    user_id=${user_ids[$user_index]}
    
    # 随机选择一个订单ID（如果有的话）
    order_id=$(random_number 1 $ORDERS_COUNT)
    rating=$(random_number 1 5)
    title="评价标题_${i}"
    content="这是一条商品评价内容，商品质量不错，值得推荐。"
    is_anonymous=$(random_number 0 1)
    like_count=$(random_number 0 50)
    status=$(random_choice "pending" "approved" "rejected")

    $MYSQL << EOF
INSERT INTO product_reviews (product_id, user_id, order_id, rating, title, content, is_anonymous, like_count, status) 
VALUES ($product_id, $user_id, $order_id, $rating, '$title', '$content', $is_anonymous, $like_count, '$status');
EOF

    if [ $((i % 1000)) -eq 0 ]; then
        echo "   已生成 $i 条评价..."
    fi
done

# 生成用户行为日志
echo "📊 生成 $BEHAVIOR_LOGS_COUNT 条用户行为日志..."
for i in $(seq 1 $BEHAVIOR_LOGS_COUNT); do
    user_id=$(random_number 1 $USERS_COUNT)
    session_id="sess_$(random_number 100000000000 999999999999)"
    action_type=$(random_choice "${ACTION_TYPES[@]}")
    target_type=$(random_choice "${TARGET_TYPES[@]}")
    target_id=$(random_number 1 1000)
    page_url="https://example.com/page_${target_id}"
    referrer_url="https://example.com/ref_$(random_number 1 100)"
    search_keyword="搜索词_$(random_number 1 100)"
    device_type=$(random_choice "${DEVICE_TYPES[@]}")
    browser="Chrome"
    os=$(random_choice "${OS_TYPES[@]}")
    ip_address="192.168.$(random_number 1 255).$(random_number 1 255)"
    country="中国"
    province=$(random_choice "${PROVINCES[@]}")
    city=$(random_choice "${CITIES[@]}")
    action_time=$(random_date 2024 2024)

    $MYSQL << EOF
INSERT INTO user_behavior_logs (user_id, session_id, action_type, target_type, target_id, page_url, referrer_url, search_keyword, device_type, browser, os, ip_address, country, province, city, action_time) 
VALUES ($user_id, '$session_id', '$action_type', '$target_type', $target_id, '$page_url', '$referrer_url', '$search_keyword', '$device_type', '$browser', '$os', '$ip_address', '$country', '$province', '$city', '$action_time');
EOF

    if [ $((i % 5000)) -eq 0 ]; then
        echo "   已生成 $i 条行为日志..."
    fi
done

# 生成库存变动记录
echo "📋 生成库存变动记录..."
for product_index in $(seq 0 199); do  # 为前200个商品生成库存记录
    if [ $product_index -ge $product_count ]; then
        break
    fi
    
    product_id=${product_ids[$product_index]}
    log_count=$(random_number 5 20)
    
    for j in $(seq 1 $log_count); do
        change_type=$(random_choice "in" "out" "adjust")
        change_reason=$(random_choice "purchase" "sale" "return" "damaged" "adjust")
        quantity_before=$(random_number 50 500)
        quantity_change=$(random_number 1 100)
        if [ "$change_type" = "out" ]; then
            quantity_change=$((quantity_change * -1))
        fi
        quantity_after=$((quantity_before + quantity_change))
        note="库存变动备注_${product_id}_${j}"

        $MYSQL << EOF
INSERT INTO inventory_logs (product_id, change_type, change_reason, quantity_before, quantity_change, quantity_after, note) 
VALUES ($product_id, '$change_type', '$change_reason', $quantity_before, $quantity_change, $quantity_after, '$note');
EOF
    done
done

echo "🎉 测试数据生成完成！"
echo "=================================================="
echo "📊 数据统计："
echo "   👥 用户: $USERS_COUNT 个"
echo "   📂 分类: 50+ 个"
echo "   🏷️  品牌: $BRANDS_COUNT 个"
echo "   📦 商品: $PRODUCTS_COUNT 个"
echo "   📍 地址: $((USERS_COUNT * 2)) 个左右"
echo "   🛒 订单: $ORDERS_COUNT 个"
echo "   🎉 促销: $PROMOTIONS_COUNT 个"
echo "   ⭐ 评价: $((ORDERS_COUNT * 30 / 100)) 条"
echo "   📊 行为日志: $BEHAVIOR_LOGS_COUNT 条"
echo "   📋 库存记录: 1000+ 条"
echo ""
echo "💡 现在可以运行统计脚本查看数据概况"

# 清理临时文件
rm -f "$TEMP_CNF"
docker exec $CONTAINER_NAME rm -f /tmp/mysql.cnf 2>/dev/null