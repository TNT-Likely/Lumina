-- Lumina schema (authoritative DDL) - MySQL 8+
-- Keep this file in sync with Sequelize models under packages/data/src/models
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

CREATE DATABASE IF NOT EXISTS `lumina` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `lumina`;

-- users
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `username` VARCHAR(100) NOT NULL,
  `display_name` VARCHAR(100) NULL,
  `avatar_url` VARCHAR(512) NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `status` ENUM('active','disabled') NOT NULL DEFAULT 'active',
  `last_login_at` DATETIME NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_users_email` (`email`),
  UNIQUE KEY `uniq_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- organizations
DROP TABLE IF EXISTS `organizations`;
CREATE TABLE `organizations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_organizations_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- organization_members
DROP TABLE IF EXISTS `organization_members`;
CREATE TABLE `organization_members` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `org_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `role` ENUM('ADMIN','EDITOR','VIEWER') NOT NULL DEFAULT 'ADMIN',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_org_user` (`org_id`, `user_id`),
  KEY `idx_org_id` (`org_id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_org_members_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_org_members_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- organization_invitations
DROP TABLE IF EXISTS `organization_invitations`;
CREATE TABLE `organization_invitations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `org_id` INT NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `role` ENUM('ADMIN','EDITOR','VIEWER') NOT NULL DEFAULT 'VIEWER',
  `token` VARCHAR(128) NOT NULL,
  `expires_at` DATETIME NULL,
  `status` ENUM('PENDING','ACCEPTED','REVOKED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_invite_token` (`token`),
  KEY `idx_invite_org` (`org_id`),
  KEY `idx_invite_email` (`email`),
  CONSTRAINT `fk_invite_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- datasources
DROP TABLE IF EXISTS `datasources`;
CREATE TABLE `datasources` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `type` VARCHAR(100) NOT NULL,
  `config` JSON DEFAULT NULL,
  `org_id` INT NULL,
  `owner_id` INT NULL,
  `visibility` ENUM('private','org','public') NULL DEFAULT 'private',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_datasources_org_id` (`org_id`),
  KEY `idx_datasources_owner_id` (`owner_id`),
  KEY `idx_datasources_visibility` (`visibility`),
  CONSTRAINT `fk_datasources_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_datasources_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- dashboards
DROP TABLE IF EXISTS `dashboards`;
CREATE TABLE `dashboards` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `config` JSON DEFAULT NULL,
  `org_id` INT NULL,
  `owner_id` INT NULL,
  `visibility` ENUM('private','org','public') NULL DEFAULT 'private',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dashboards_org_id` (`org_id`),
  KEY `idx_dashboards_owner_id` (`owner_id`),
  KEY `idx_dashboards_visibility` (`visibility`),
  CONSTRAINT `fk_dashboards_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_dashboards_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- datasets
DROP TABLE IF EXISTS `datasets`;
CREATE TABLE `datasets` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `source_id` INT NOT NULL,
  `description` TEXT,
  `fields` JSON NOT NULL,
  `parameters` JSON DEFAULT (json_array()),
  `created_by` VARCHAR(255) NOT NULL DEFAULT 'system',
  `updated_by` VARCHAR(255) NOT NULL DEFAULT 'system',
  `org_id` INT NULL,
  `owner_id` INT NULL,
  `visibility` ENUM('private','org','public') NULL DEFAULT 'private',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  `base_table` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '基础表名',
  `base_schema` VARCHAR(100) DEFAULT NULL COMMENT '基础表所在schema',
  `query_template` TEXT COMMENT 'SQL查询模板',
  `joins` JSON DEFAULT (json_array()) COMMENT '联表配置',
  PRIMARY KEY (`id`),
  KEY `idx_datasets_source_id` (`source_id`),
  KEY `idx_datasets_org_id` (`org_id`),
  KEY `idx_datasets_owner_id` (`owner_id`),
  KEY `idx_datasets_visibility` (`visibility`),
  KEY `idx_datasets_created_at` (`created_at`),
  KEY `idx_datasets_updated_at` (`updated_at`),
  KEY `idx_base_table` (`base_table`),
  KEY `idx_base_schema_base_table` (`base_schema`,`base_table`),
  CONSTRAINT `fk_datasets_source_id` FOREIGN KEY (`source_id`) REFERENCES `datasources` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_datasets_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_datasets_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- views
DROP TABLE IF EXISTS `views`;
CREATE TABLE `views` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `type` VARCHAR(100) NOT NULL,
  `config` JSON DEFAULT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `dataset_id` INT NOT NULL,
  `org_id` INT NULL,
  `owner_id` INT NULL,
  `visibility` ENUM('private','org','public') NULL DEFAULT 'private',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_views_dataset_id` (`dataset_id`),
  KEY `idx_views_org_id` (`org_id`),
  KEY `idx_views_owner_id` (`owner_id`),
  KEY `idx_views_visibility` (`visibility`),
  CONSTRAINT `fk_views_dataset_id` FOREIGN KEY (`dataset_id`) REFERENCES `datasets` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_views_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_views_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- notifies
DROP TABLE IF EXISTS `notifies`;
CREATE TABLE `notifies` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `type` VARCHAR(100) NOT NULL,
  `config` JSON DEFAULT NULL,
  `org_id` INT NULL,
  `owner_id` INT NULL,
  `visibility` ENUM('private','org','public') NULL DEFAULT 'private',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifies_org_id` (`org_id`),
  KEY `idx_notifies_owner_id` (`owner_id`),
  KEY `idx_notifies_visibility` (`visibility`),
  CONSTRAINT `fk_notifies_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_notifies_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- subscribes
DROP TABLE IF EXISTS `subscribes`;
CREATE TABLE `subscribes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `dashboard_id` INT NOT NULL,
  `notify_ids` JSON NOT NULL,
  `config` JSON DEFAULT NULL,
  `org_id` INT NULL,
  `owner_id` INT NULL,
  `visibility` ENUM('private','org','public') NULL DEFAULT 'private',
  `enabled` TINYINT DEFAULT '0',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_subscribes_dashboard_id` (`dashboard_id`),
  KEY `idx_subscribes_org_id` (`org_id`),
  KEY `idx_subscribes_owner_id` (`owner_id`),
  KEY `idx_subscribes_visibility` (`visibility`),
  CONSTRAINT `fk_subscribes_dashboard_id` FOREIGN KEY (`dashboard_id`) REFERENCES `dashboards` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_subscribes_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_subscribes_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- message_consume_log
DROP TABLE IF EXISTS `message_consume_log`;
CREATE TABLE `message_consume_log` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `type` VARCHAR(32) NOT NULL COMMENT '消息类型，如 subscription、alert 等',
  `message_id` VARCHAR(128) NOT NULL COMMENT '消息唯一ID',
  `ref_id` INT UNSIGNED NOT NULL COMMENT '业务主键，如 subscriptionId、alertId',
  `consumedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '消费时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_type_messageId` (`type`,`message_id`),
  KEY `idx_type_refId` (`type`,`ref_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='通用消息消费日志';

SET FOREIGN_KEY_CHECKS=1;
