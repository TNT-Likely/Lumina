#!/bin/bash

echo "🚀 启动电商测试数据库环境..."

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker未运行，请先启动Docker"
    exit 1
fi

# 停止并删除现有容器（如果存在）
echo "🧹 清理现有容器..."
docker-compose down -v

# 启动服务
echo "📦 启动MySQL和phpMyAdmin服务..."
docker-compose up -d

# 等待MySQL启动完成
echo "⏳ 等待MySQL启动完成..."
sleep 30

# 检查MySQL连接
echo "🔍 检查MySQL连接..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if docker exec mysql-ecommerce-test mysql -uroot -proot123456 -e "SELECT 1" > /dev/null 2>&1; then
        echo "✅ MySQL已就绪!"
        break
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        echo "❌ MySQL启动超时，请检查日志"
        docker-compose logs mysql-ecommerce
        exit 1
    fi
    
    echo "⏳ 等待MySQL启动... (尝试 $attempt/$max_attempts)"
    sleep 2
    ((attempt++))
done

echo ""
echo "🎉 电商测试数据库环境启动成功!"
echo ""
echo "📋 连接信息:"
echo "   MySQL 地址: localhost:3307"
echo "   数据库名: ecommerce_test"
echo "   用户名: ecommerce"
echo "   密码: ecommerce123"
echo "   Root密码: root123456"
echo ""
echo "🔧 常用命令:"
echo "   停止服务: docker-compose down"
echo "   查看日志: docker-compose logs -f"
echo "   进入MySQL: docker exec -it mysql-ecommerce-test mysql -uroot -proot123456"
echo ""