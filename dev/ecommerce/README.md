# 电商测试数据库环境

## 快速开始

```bash
# 启动环境
./start.sh

# 测试连接
./test-connection.sh

# 停止环境
./stop.sh
```

## 连接信息

- **MySQL**: localhost:3307
- **数据库**: ecommerce_test
- **用户名**: ecommerce
- **密码**: ecommerce123
- **phpMyAdmin**: <http://localhost:8080>

## 文件结构

```
ecommerce-test-db/
├── docker-compose.yml    # Docker编排文件
├── my.cnf               # MySQL配置
├── sql/                 # 初始化SQL脚本
├── data/                # MySQL数据文件
├── logs/                # MySQL日志文件
├── start.sh             # 启动脚本
├── stop.sh              # 停止脚本
└── test-connection.sh   # 连接测试脚本
```

## 数据库表结构

1. **users** - 用户表
2. **categories** - 商品分类表
3. **brands** - 品牌表
4. **products** - 商品表
5. **addresses** - 收货地址表
6. **orders** - 订单表
7. **order_items** - 订单详情表
8. **user_behavior_logs** - 用户行为日志表
9. **product_reviews** - 商品评价表
10. **promotions** - 营销活动表
11. **order_promotions** - 订单促销关联表
12. **inventory_logs** - 库存变动记录表

## 常用操作

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f mysql-ecommerce

# 进入MySQL容器
docker exec -it mysql-ecommerce-test bash

# 直接连接MySQL
docker exec -it mysql-ecommerce-test mysql -uroot -proot123456

# 备份数据库
docker exec mysql-ecommerce-test mysqldump -uroot -proot123456 ecommerce_test > backup.sql

# 恢复数据库
docker exec -i mysql-ecommerce-test mysql -uroot -proot123456 ecommerce_test < backup.sql
```
