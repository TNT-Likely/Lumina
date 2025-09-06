-- 创建电商测试数据库
CREATE DATABASE IF NOT EXISTS ecommerce_test 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE ecommerce_test;

-- 创建用户并授权
CREATE USER IF NOT EXISTS 'ecommerce'@'%' IDENTIFIED BY 'ecommerce123';
GRANT ALL PRIVILEGES ON ecommerce_test.* TO 'ecommerce'@'%';
FLUSH PRIVILEGES;