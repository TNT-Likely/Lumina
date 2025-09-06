#!/bin/bash
# start-mysql.sh

echo "正在启动 MySQL Docker 容器..."

# 检查 docker 是否安装
if ! command -v docker &> /dev/null
then
    echo "错误: 未找到 Docker，请先安装 Docker"
    exit 1
fi

# 检查 docker-compose 是否安装
if ! command -v docker-compose &> /dev/null
then
    echo "错误: 未找到 docker-compose，请先安装 docker-compose"
    exit 1
fi

# 启动 MySQL 容器
docker-compose up -d

echo "MySQL 容器已启动！"
echo "连接信息："
echo "  Host: localhost"
echo "  Port: 3306"
echo "  Database: data_nocode"
echo "  Root 用户: root / root123456"
echo "  普通用户: nocode / nocode123"
echo ""
echo "等待数据库初始化完成..."
sleep 10

echo "数据库初始化完成！"
echo "您可以使用以下命令连接数据库："
echo "  mysql -h localhost -P 3306 -u root -p"