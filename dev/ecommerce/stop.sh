#!/bin/bash

echo "🛑 停止电商测试数据库环境..."
docker-compose down

echo "✅ 服务已停止"
echo ""
echo "💡 如需完全清理（包括数据）:"
echo "   docker-compose down -v"
echo "   rm -rf data/"