-- Bootstrap common ecommerce datasets, views and a dashboard for Lumina
-- Assumptions:
--   - Lumina schema already created (see schema.sql)
--   - datasource with id=1 exists and points to schema `ecommerce_test`
--   - We will ensure org id=1 and user id=1 exist (create if missing)
--   - owner_id=1, org_id=1, visibility='private'
-- Run:
--   mysql -h 127.0.0.1 -P 3306 -uroot -p'root123456' < dev/mysql/sql/bootstrap_ecommerce_lumina.sql

SET NAMES utf8mb4;
USE `lumina`;

SET @ORG_ID := 1;
SET @OWNER_ID := 1;    -- as requested
SET @SOURCE_ID := 1;   -- datasourceId=1
SET @VISIBILITY := 'private';

SET FOREIGN_KEY_CHECKS=0;

-- Ensure org and owner exist (no-op if already present)
INSERT INTO `organizations` (`id`,`name`,`slug`)
SELECT 1,'default','default'
WHERE NOT EXISTS (SELECT 1 FROM `organizations` WHERE `id`=1);

INSERT INTO `users` (`id`,`email`,`username`,`password_hash`)
SELECT 1,'owner1@example.com','owner1','$2b$10$3fak3hashforlocaldevadmin'
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `id`=1);

-- =====================================
-- Datasets
-- =====================================

-- 订单数据集 (orders)
INSERT INTO `datasets` (`name`,`source_id`,`description`,`fields`,`parameters`,`created_by`,`updated_by`,`org_id`,`owner_id`,`visibility`,`base_table`,`base_schema`,`query_template`,`joins`)
SELECT '订单数据集', @SOURCE_ID, '基于订单表的数据集：趋势、支付方式、状态等分析',
  JSON_ARRAY(
    JSON_OBJECT('name','订单ID','type','INTEGER','isMetric',false,'indexable',true,'expression','id','identifier','order_id','description','订单唯一标识','isDimension',true),
    JSON_OBJECT('name','订单日期','type','DATE','isMetric',false,'indexable',true,'expression','DATE_FORMAT(order_date, "%Y-%m-%d")','identifier','order_date','description','订单创建日期','isDimension',true),
    JSON_OBJECT('name','订单月份','type','STRING','isMetric',false,'indexable',true,'expression','DATE_FORMAT(order_date, "%Y-%m")','identifier','order_month','description','订单月份','isDimension',true),
    JSON_OBJECT('name','支付方式','type','STRING','isMetric',false,'indexable',true,'expression','payment_method','identifier','payment_method','description','支付方式','isDimension',true),
    JSON_OBJECT('name','订单状态','type','STRING','isMetric',false,'indexable',true,'expression','order_status','identifier','order_status','description','订单状态','isDimension',true),
    JSON_OBJECT('name','用户ID','type','INTEGER','isMetric',false,'indexable',true,'expression','user_id','identifier','user_id','description','下单用户ID','isDimension',true),
    JSON_OBJECT('name','订单总金额','type','FLOAT','isMetric',true,'indexable',true,'expression','total_amount','identifier','total_amount','description','订单总金额','isDimension',false),
    JSON_OBJECT('name','实付金额','type','FLOAT','isMetric',true,'indexable',true,'expression','actual_amount','identifier','actual_amount','description','订单实际支付金额','isDimension',false),
    JSON_OBJECT('name','折扣金额','type','FLOAT','isMetric',true,'indexable',true,'expression','discount_amount','identifier','discount_amount','description','折扣金额','isDimension',false),
    JSON_OBJECT('name','运费','type','FLOAT','isMetric',true,'indexable',true,'expression','shipping_fee','identifier','shipping_fee','description','运费','isDimension',false)
  ),
  JSON_ARRAY(
    JSON_OBJECT('name','start_date','type','DATE','description','开始日期','defaultValue','CURDATE() - INTERVAL 30 DAY'),
    JSON_OBJECT('name','end_date','type','DATE','description','结束日期','defaultValue','CURDATE()')
  ),
  'user1','user1',@ORG_ID,@OWNER_ID,@VISIBILITY,
  'orders','ecommerce_test','SELECT {fields} FROM {base_table} WHERE 1=1 {conditions}',JSON_ARRAY()
WHERE NOT EXISTS (SELECT 1 FROM `datasets` d WHERE d.name='订单数据集' AND d.org_id=@ORG_ID);

-- 订单明细数据集 (order_items)
INSERT INTO `datasets` (`name`,`source_id`,`description`,`fields`,`parameters`,`created_by`,`updated_by`,`org_id`,`owner_id`,`visibility`,`base_table`,`base_schema`,`query_template`,`joins`)
SELECT '订单明细数据集', @SOURCE_ID, '基于订单明细表的数据集：热销商品、商品销量等',
  JSON_ARRAY(
    JSON_OBJECT('name','订单ID','type','INTEGER','isMetric',false,'indexable',true,'expression','order_id','identifier','order_id','description','关联订单ID','isDimension',true),
    JSON_OBJECT('name','商品ID','type','INTEGER','isMetric',false,'indexable',true,'expression','product_id','identifier','product_id','description','商品ID','isDimension',true),
    JSON_OBJECT('name','商品名称','type','STRING','isMetric',false,'indexable',true,'expression','product_name','identifier','product_name','description','商品名称','isDimension',true),
    JSON_OBJECT('name','商品SKU','type','STRING','isMetric',false,'indexable',true,'expression','product_sku','identifier','product_sku','description','商品SKU','isDimension',true),
    JSON_OBJECT('name','数量','type','INTEGER','isMetric',true,'indexable',true,'expression','quantity','identifier','quantity','description','购买数量','isDimension',false),
    JSON_OBJECT('name','单价','type','FLOAT','isMetric',true,'indexable',true,'expression','unit_price','identifier','unit_price','description','单价','isDimension',false),
    JSON_OBJECT('name','总价','type','FLOAT','isMetric',true,'indexable',true,'expression','total_price','identifier','total_price','description','总价','isDimension',false),
    JSON_OBJECT('name','实付金额','type','FLOAT','isMetric',true,'indexable',true,'expression','actual_price','identifier','actual_price','description','实付金额','isDimension',false)
  ),
  JSON_ARRAY(),
  'user1','user1',@ORG_ID,@OWNER_ID,@VISIBILITY,
  'order_items','ecommerce_test','SELECT {fields} FROM {base_table} WHERE 1=1 {conditions}',JSON_ARRAY()
WHERE NOT EXISTS (SELECT 1 FROM `datasets` d WHERE d.name='订单明细数据集' AND d.org_id=@ORG_ID);

-- 商品数据集 (products)
INSERT INTO `datasets` (`name`,`source_id`,`description`,`fields`,`parameters`,`created_by`,`updated_by`,`org_id`,`owner_id`,`visibility`,`base_table`,`base_schema`,`query_template`,`joins`)
SELECT '商品数据集', @SOURCE_ID, '基于商品表的数据集：价格、库存、销量等',
  JSON_ARRAY(
    JSON_OBJECT('name','商品ID','type','INTEGER','isMetric',false,'indexable',true,'expression','id','identifier','product_id','description','商品ID','isDimension',true),
    JSON_OBJECT('name','商品名称','type','STRING','isMetric',false,'indexable',true,'expression','name','identifier','product_name','description','商品名称','isDimension',true),
    JSON_OBJECT('name','类目ID','type','INTEGER','isMetric',false,'indexable',true,'expression','category_id','identifier','category_id','description','类目ID','isDimension',true),
    JSON_OBJECT('name','品牌ID','type','INTEGER','isMetric',false,'indexable',true,'expression','brand_id','identifier','brand_id','description','品牌ID','isDimension',true),
    JSON_OBJECT('name','价格','type','FLOAT','isMetric',true,'indexable',true,'expression','price','identifier','price','description','价格','isDimension',false),
    JSON_OBJECT('name','库存','type','INTEGER','isMetric',true,'indexable',true,'expression','stock_quantity','identifier','stock_quantity','description','库存数量','isDimension',false),
    JSON_OBJECT('name','评分','type','FLOAT','isMetric',true,'indexable',true,'expression','rating','identifier','rating','description','评分','isDimension',false),
    JSON_OBJECT('name','销量','type','INTEGER','isMetric',true,'indexable',true,'expression','sales_count','identifier','sales_count','description','销量','isDimension',false),
    JSON_OBJECT('name','状态','type','STRING','isMetric',false,'indexable',true,'expression','status','identifier','status','description','商品状态','isDimension',true),
    JSON_OBJECT('name','上架日期','type','DATE','isMetric',false,'indexable',true,'expression','DATE_FORMAT(launch_date, "%Y-%m-%d")','identifier','launch_date','description','上架日期','isDimension',true)
  ),
  JSON_ARRAY(),
  'user1','user1',@ORG_ID,@OWNER_ID,@VISIBILITY,
  'products','ecommerce_test','SELECT {fields} FROM {base_table} WHERE 1=1 {conditions}',JSON_ARRAY()
WHERE NOT EXISTS (SELECT 1 FROM `datasets` d WHERE d.name='商品数据集' AND d.org_id=@ORG_ID);

-- 用户数据集 (users)
INSERT INTO `datasets` (`name`,`source_id`,`description`,`fields`,`parameters`,`created_by`,`updated_by`,`org_id`,`owner_id`,`visibility`,`base_table`,`base_schema`,`query_template`,`joins`)
SELECT '用户数据集', @SOURCE_ID, '基于用户表的数据集：用户画像与地域分布',
  JSON_ARRAY(
    JSON_OBJECT('name','用户ID','type','INTEGER','isMetric',false,'indexable',true,'expression','id','identifier','user_id','description','用户ID','isDimension',true),
    JSON_OBJECT('name','用户名','type','STRING','isMetric',false,'indexable',true,'expression','username','identifier','username','description','用户名','isDimension',true),
    JSON_OBJECT('name','省份','type','STRING','isMetric',false,'indexable',true,'expression','province','identifier','province','description','省份','isDimension',true),
    JSON_OBJECT('name','城市','type','STRING','isMetric',false,'indexable',true,'expression','city','identifier','city','description','城市','isDimension',true),
    JSON_OBJECT('name','用户等级','type','STRING','isMetric',false,'indexable',true,'expression','user_level','identifier','user_level','description','用户等级','isDimension',true),
    JSON_OBJECT('name','总消费金额','type','FLOAT','isMetric',true,'indexable',true,'expression','total_spent','identifier','total_spent','description','总消费金额','isDimension',false),
    JSON_OBJECT('name','订单数','type','INTEGER','isMetric',true,'indexable',true,'expression','total_orders','identifier','total_orders','description','累计订单数','isDimension',false),
    JSON_OBJECT('name','是否活跃','type','STRING','isMetric',false,'indexable',true,'expression','IF(is_active, "true","false")','identifier','is_active','description','是否活跃','isDimension',true)
  ),
  JSON_ARRAY(
    JSON_OBJECT('name','user_level','type','STRING','description','用户等级筛选','defaultValue','')
  ),
  'user1','user1',@ORG_ID,@OWNER_ID,@VISIBILITY,
  'users','ecommerce_test','SELECT {fields} FROM {base_table} WHERE 1=1 {conditions}',JSON_ARRAY()
WHERE NOT EXISTS (SELECT 1 FROM `datasets` d WHERE d.name='用户数据集' AND d.org_id=@ORG_ID);

-- 用户行为日志数据集 (user_behavior_logs)
INSERT INTO `datasets` (`name`,`source_id`,`description`,`fields`,`parameters`,`created_by`,`updated_by`,`org_id`,`owner_id`,`visibility`,`base_table`,`base_schema`,`query_template`,`joins`)
SELECT '用户行为日志数据集', @SOURCE_ID, '基于用户行为日志的数据集：搜索、浏览、加入购物车等',
  JSON_ARRAY(
    JSON_OBJECT('name','用户ID','type','INTEGER','isMetric',false,'indexable',true,'expression','user_id','identifier','user_id','description','用户ID','isDimension',true),
    JSON_OBJECT('name','行为类型','type','STRING','isMetric',false,'indexable',true,'expression','action_type','identifier','action_type','description','行为类型','isDimension',true),
    JSON_OBJECT('name','目标类型','type','STRING','isMetric',false,'indexable',true,'expression','target_type','identifier','target_type','description','目标类型','isDimension',true),
    JSON_OBJECT('name','目标ID','type','INTEGER','isMetric',false,'indexable',true,'expression','target_id','identifier','target_id','description','目标ID','isDimension',true),
    JSON_OBJECT('name','设备','type','STRING','isMetric',false,'indexable',true,'expression','device_type','identifier','device_type','description','设备类型','isDimension',true),
    JSON_OBJECT('name','浏览器','type','STRING','isMetric',false,'indexable',true,'expression','browser','identifier','browser','description','浏览器','isDimension',true),
    JSON_OBJECT('name','操作系统','type','STRING','isMetric',false,'indexable',true,'expression','os','identifier','os','description','操作系统','isDimension',true),
    JSON_OBJECT('name','省份','type','STRING','isMetric',false,'indexable',true,'expression','province','identifier','province','description','省份','isDimension',true),
    JSON_OBJECT('name','城市','type','STRING','isMetric',false,'indexable',true,'expression','city','identifier','city','description','城市','isDimension',true),
    JSON_OBJECT('name','行为时间','type','DATE','isMetric',false,'indexable',true,'expression','DATE_FORMAT(action_time, "%Y-%m-%d %H:00:00")','identifier','action_hour','description','行为时间(小时)','isDimension',true)
  ),
  JSON_ARRAY(),
  'user1','user1',@ORG_ID,@OWNER_ID,@VISIBILITY,
  'user_behavior_logs','ecommerce_test','SELECT {fields} FROM {base_table} WHERE 1=1 {conditions}',JSON_ARRAY()
WHERE NOT EXISTS (SELECT 1 FROM `datasets` d WHERE d.name='用户行为日志数据集' AND d.org_id=@ORG_ID);

-- =====================================
-- Views
-- =====================================

-- 支付方式分析（订单数量）
INSERT INTO `views` (`name`,`type`,`config`,`description`,`dataset_id`,`org_id`,`owner_id`,`visibility`)
SELECT '支付方式分析','chart',
  JSON_OBJECT(
    'chartConfig', JSON_OBJECT(
      'title','支付方式分析','filters', JSON_ARRAY(),
      'metrics', JSON_ARRAY(JSON_OBJECT('alias','订单数量','field', JSON_OBJECT('identifier','order_id'), 'aggregationType','count')),
      'settings', JSON_OBJECT('limit',100,'showLegend',true,'colorScheme','fresh','showDataLabels',true),
      'chartType','bar',
      'dimensions', JSON_ARRAY(JSON_OBJECT('field', JSON_OBJECT('identifier','payment_method')))
    ),
    'queryResult', NULL
  ),
  '不同支付方式的使用情况分布', d.id, @ORG_ID, @OWNER_ID, @VISIBILITY
FROM `datasets` d WHERE d.name='订单数据集' AND d.org_id=@ORG_ID
AND NOT EXISTS (SELECT 1 FROM `views` v WHERE v.name='支付方式分析' AND v.org_id=@ORG_ID);

-- 月度销售额趋势（sum 实付金额）
INSERT INTO `views` (`name`,`type`,`config`,`description`,`dataset_id`,`org_id`,`owner_id`,`visibility`)
SELECT '月度销售额趋势','chart',
  JSON_OBJECT(
    'chartConfig', JSON_OBJECT(
      'title','月度销售额趋势','filters', JSON_ARRAY(),
      'metrics', JSON_ARRAY(JSON_OBJECT('alias','销售额','field', JSON_OBJECT('identifier','actual_amount'), 'aggregationType','sum')),
      'settings', JSON_OBJECT('limit',120,'showLegend',false,'colorScheme','fresh','showDataLabels',false),
      'chartType','line',
      'dimensions', JSON_ARRAY(JSON_OBJECT('field', JSON_OBJECT('identifier','order_month')))
    ),
    'queryResult', NULL
  ),
  '按月统计销售额', d.id, @ORG_ID, @OWNER_ID, @VISIBILITY
FROM `datasets` d WHERE d.name='订单数据集' AND d.org_id=@ORG_ID
AND NOT EXISTS (SELECT 1 FROM `views` v WHERE v.name='月度销售额趋势' AND v.org_id=@ORG_ID);

-- 订单状态分布
INSERT INTO `views` (`name`,`type`,`config`,`description`,`dataset_id`,`org_id`,`owner_id`,`visibility`)
SELECT '订单状态分布','chart',
  JSON_OBJECT(
    'chartConfig', JSON_OBJECT(
      'title','订单状态分布','filters', JSON_ARRAY(),
      'metrics', JSON_ARRAY(JSON_OBJECT('alias','订单数量','field', JSON_OBJECT('identifier','order_id'), 'aggregationType','count')),
      'settings', JSON_OBJECT('limit',100,'showLegend',true,'colorScheme','fresh','showDataLabels',true),
      'chartType','pie',
      'dimensions', JSON_ARRAY(JSON_OBJECT('field', JSON_OBJECT('identifier','order_status')))
    ),
    'queryResult', NULL
  ),
  '各订单状态数量分布', d.id, @ORG_ID, @OWNER_ID, @VISIBILITY
FROM `datasets` d WHERE d.name='订单数据集' AND d.org_id=@ORG_ID
AND NOT EXISTS (SELECT 1 FROM `views` v WHERE v.name='订单状态分布' AND v.org_id=@ORG_ID);

-- 热销商品 Top10（sum 数量）
INSERT INTO `views` (`name`,`type`,`config`,`description`,`dataset_id`,`org_id`,`owner_id`,`visibility`)
SELECT '热销商品Top10','chart',
  JSON_OBJECT(
    'chartConfig', JSON_OBJECT(
      'title','热销商品Top10','filters', JSON_ARRAY(),
      'metrics', JSON_ARRAY(JSON_OBJECT('alias','销量','field', JSON_OBJECT('identifier','quantity'), 'aggregationType','sum')),
      'settings', JSON_OBJECT('limit',10,'showLegend',false,'colorScheme','fresh','showDataLabels',false),
      'chartType','bar',
      'dimensions', JSON_ARRAY(JSON_OBJECT('field', JSON_OBJECT('identifier','product_name')))
    ),
    'queryResult', NULL
  ),
  '按销量排序的商品Top10', d.id, @ORG_ID, @OWNER_ID, @VISIBILITY
FROM `datasets` d WHERE d.name='订单明细数据集' AND d.org_id=@ORG_ID
AND NOT EXISTS (SELECT 1 FROM `views` v WHERE v.name='热销商品Top10' AND v.org_id=@ORG_ID);

-- 用户等级分布
INSERT INTO `views` (`name`,`type`,`config`,`description`,`dataset_id`,`org_id`,`owner_id`,`visibility`)
SELECT '用户等级分布','chart',
  JSON_OBJECT(
    'chartConfig', JSON_OBJECT(
      'title','用户等级分布','filters', JSON_ARRAY(),
      'metrics', JSON_ARRAY(JSON_OBJECT('alias','用户数','field', JSON_OBJECT('identifier','user_id'), 'aggregationType','count')),
      'settings', JSON_OBJECT('limit',20,'showLegend',true,'colorScheme','fresh','showDataLabels',false),
      'chartType','pie',
      'dimensions', JSON_ARRAY(JSON_OBJECT('field', JSON_OBJECT('identifier','user_level')))
    ),
    'queryResult', NULL
  ),
  '不同用户等级的占比', d.id, @ORG_ID, @OWNER_ID, @VISIBILITY
FROM `datasets` d WHERE d.name='用户数据集' AND d.org_id=@ORG_ID
AND NOT EXISTS (SELECT 1 FROM `views` v WHERE v.name='用户等级分布' AND v.org_id=@ORG_ID);

-- 地区用户分布（省份）
INSERT INTO `views` (`name`,`type`,`config`,`description`,`dataset_id`,`org_id`,`owner_id`,`visibility`)
SELECT '地区用户分布','chart',
  JSON_OBJECT(
    'chartConfig', JSON_OBJECT(
      'title','地区用户分布','filters', JSON_ARRAY(),
      'metrics', JSON_ARRAY(JSON_OBJECT('alias','用户数','field', JSON_OBJECT('identifier','user_id'), 'aggregationType','count')),
      'settings', JSON_OBJECT('limit',100,'showLegend',false,'colorScheme','fresh','showDataLabels',false),
      'chartType','bar',
      'dimensions', JSON_ARRAY(JSON_OBJECT('field', JSON_OBJECT('identifier','province')))
    ),
    'queryResult', NULL
  ),
  '按省份统计用户数量', d.id, @ORG_ID, @OWNER_ID, @VISIBILITY
FROM `datasets` d WHERE d.name='用户数据集' AND d.org_id=@ORG_ID
AND NOT EXISTS (SELECT 1 FROM `views` v WHERE v.name='地区用户分布' AND v.org_id=@ORG_ID);

-- =====================================
-- Dashboard
-- =====================================

-- 电商运营看板：包含 6 个组件，分别引用上面的视图
INSERT INTO `dashboards` (`name`,`description`,`config`,`org_id`,`owner_id`,`visibility`)
SELECT '电商运营看板','电商常用指标概览',
  JSON_OBJECT(
    'filters', JSON_ARRAY(),
    'version','1.0.0',
    'settings', JSON_OBJECT(
      'grid', JSON_OBJECT('cols',24,'rows',0,'margin', JSON_ARRAY(8,7),'padding', JSON_ARRAY(18,21),'autoSize', true, 'rowHeight', 40, 'verticalCompact', true, 'preventCollision', false),
      'canvas', JSON_OBJECT('width', 1920, 'height', 1080)
    ),
    'components', JSON_ARRAY(
      JSON_OBJECT(
        'id','c1','name','view_c1','type','view',
        'style', JSON_OBJECT('padding',0),
        'config', JSON_OBJECT('viewId', (SELECT v1.id FROM views v1 WHERE v1.name='支付方式分析' AND v1.org_id=@ORG_ID LIMIT 1), 'showTitle', true),
        'layout', JSON_OBJECT('h', 10, 'w', 12, 'x', 0, 'y', 0)
      ),
      JSON_OBJECT(
        'id','c2','name','view_c2','type','view',
        'style', JSON_OBJECT('padding',0),
        'config', JSON_OBJECT('viewId', (SELECT v2.id FROM views v2 WHERE v2.name='月度销售额趋势' AND v2.org_id=@ORG_ID LIMIT 1), 'showTitle', true),
        'layout', JSON_OBJECT('h', 10, 'w', 12, 'x', 12, 'y', 0)
      ),
      JSON_OBJECT(
        'id','c3','name','view_c3','type','view',
        'style', JSON_OBJECT('padding',0),
        'config', JSON_OBJECT('viewId', (SELECT v3.id FROM views v3 WHERE v3.name='订单状态分布' AND v3.org_id=@ORG_ID LIMIT 1), 'showTitle', true),
        'layout', JSON_OBJECT('h', 10, 'w', 8, 'x', 0, 'y', 10)
      ),
      JSON_OBJECT(
        'id','c4','name','view_c4','type','view',
        'style', JSON_OBJECT('padding',0),
        'config', JSON_OBJECT('viewId', (SELECT v4.id FROM views v4 WHERE v4.name='热销商品Top10' AND v4.org_id=@ORG_ID LIMIT 1), 'showTitle', true),
        'layout', JSON_OBJECT('h', 10, 'w', 16, 'x', 8, 'y', 10)
      ),
      JSON_OBJECT(
        'id','c5','name','view_c5','type','view',
        'style', JSON_OBJECT('padding',0),
        'config', JSON_OBJECT('viewId', (SELECT v5.id FROM views v5 WHERE v5.name='用户等级分布' AND v5.org_id=@ORG_ID LIMIT 1), 'showTitle', true),
        'layout', JSON_OBJECT('h', 10, 'w', 12, 'x', 0, 'y', 20)
      ),
      JSON_OBJECT(
        'id','c6','name','view_c6','type','view',
        'style', JSON_OBJECT('padding',0),
        'config', JSON_OBJECT('viewId', (SELECT v6.id FROM views v6 WHERE v6.name='地区用户分布' AND v6.org_id=@ORG_ID LIMIT 1), 'showTitle', true),
        'layout', JSON_OBJECT('h', 10, 'w', 12, 'x', 12, 'y', 20)
      )
    )
  ),
  @ORG_ID, @OWNER_ID, @VISIBILITY
WHERE NOT EXISTS (SELECT 1 FROM `dashboards` db WHERE db.name='电商运营看板' AND db.org_id=@ORG_ID);

SET FOREIGN_KEY_CHECKS=1;

-- Verify
SELECT '=== DATASETS ===' AS info;
SELECT id,name,source_id,org_id,owner_id FROM datasets WHERE org_id=@ORG_ID ORDER BY id DESC;
SELECT '=== VIEWS ===' AS info;
SELECT id,name,type,dataset_id,org_id,owner_id FROM views WHERE org_id=@ORG_ID ORDER BY id DESC;
SELECT '=== DASHBOARDS ===' AS info;
SELECT id,name,org_id,owner_id FROM dashboards WHERE org_id=@ORG_ID ORDER BY id DESC;
