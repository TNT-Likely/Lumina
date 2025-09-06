-- Bootstrap JOIN-based ecommerce datasets, views and an advanced dashboard
-- Assumptions: datasource id=1 -> schema `ecommerce_test`, org_id=1, owner_id=1
-- Run:
--   mysql -h 127.0.0.1 -P 3306 -uroot -p'root123456' < dev/mysql/sql/bootstrap_ecommerce_lumina_joins.sql

SET NAMES utf8mb4;
USE `lumina`;

SET @ORG_ID := 1;
SET @OWNER_ID := 1;
SET @SOURCE_ID := 1;
SET @VISIBILITY := 'private';

SET FOREIGN_KEY_CHECKS=0;

-- Ensure org/user exist
INSERT INTO `organizations` (`id`,`name`,`slug`)
SELECT 1,'default','default' WHERE NOT EXISTS (SELECT 1 FROM `organizations` WHERE `id`=1);
INSERT INTO `users` (`id`,`email`,`username`,`password_hash`)
SELECT 1,'owner1@example.com','owner1','$2b$10$3fak3hashforlocaldevadmin' WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `id`=1);

-- =====================================
-- JOIN-based Datasets
-- =====================================

-- 订单-商品销售汇总（orders o JOIN order_items oi JOIN products p LEFT categories c LEFT brands b）
INSERT INTO `datasets` (`name`,`source_id`,`description`,`fields`,`parameters`,`created_by`,`updated_by`,`org_id`,`owner_id`,`visibility`,`base_table`,`base_schema`,`query_template`,`joins`)
SELECT '订单-商品销售汇总', @SOURCE_ID, '订单与明细、商品、类目与品牌的销售汇总',
  JSON_ARRAY(
    JSON_OBJECT('name','订单ID','type','INTEGER','isMetric',false,'indexable',true,'expression','o.id','identifier','order_id','description','订单ID','isDimension',true),
    JSON_OBJECT('name','下单日期','type','DATE','isMetric',false,'indexable',true,'expression','DATE_FORMAT(o.order_date, "%Y-%m-%d")','identifier','order_date','description','下单日期','isDimension',true),
    JSON_OBJECT('name','商品ID','type','INTEGER','isMetric',false,'indexable',true,'expression','p.id','identifier','product_id','description','商品ID','isDimension',true),
    JSON_OBJECT('name','商品名称','type','STRING','isMetric',false,'indexable',true,'expression','p.name','identifier','product_name','description','商品名称','isDimension',true),
    JSON_OBJECT('name','类目ID','type','INTEGER','isMetric',false,'indexable',true,'expression','p.category_id','identifier','category_id','description','类目ID','isDimension',true),
    JSON_OBJECT('name','类目名称','type','STRING','isMetric',false,'indexable',true,'expression','c.name','identifier','category_name','description','类目名称','isDimension',true),
    JSON_OBJECT('name','品牌ID','type','INTEGER','isMetric',false,'indexable',true,'expression','p.brand_id','identifier','brand_id','description','品牌ID','isDimension',true),
    JSON_OBJECT('name','品牌名称','type','STRING','isMetric',false,'indexable',true,'expression','b.name','identifier','brand_name','description','品牌名称','isDimension',true),
    JSON_OBJECT('name','数量','type','INTEGER','isMetric',true,'indexable',true,'expression','oi.quantity','identifier','quantity','description','购买数量','isDimension',false),
    JSON_OBJECT('name','行项目总价','type','FLOAT','isMetric',true,'indexable',true,'expression','oi.total_price','identifier','line_total','description','明细总价','isDimension',false),
    JSON_OBJECT('name','行项目实付','type','FLOAT','isMetric',true,'indexable',true,'expression','oi.actual_price','identifier','line_actual','description','明细实付','isDimension',false)
  ),
  JSON_ARRAY(
    JSON_OBJECT('name','start_date','type','DATE','description','开始日期','defaultValue','CURDATE() - INTERVAL 30 DAY'),
    JSON_OBJECT('name','end_date','type','DATE','description','结束日期','defaultValue','CURDATE()')
  ),
  'user1','user1',@ORG_ID,@OWNER_ID,@VISIBILITY,
  'orders o','ecommerce_test',
  'SELECT {fields} FROM {base_table} \n\
   JOIN order_items oi ON o.id = oi.order_id \n\
   JOIN products p ON p.id = oi.product_id \n\
   LEFT JOIN categories c ON c.id = p.category_id \n\
   LEFT JOIN brands b ON b.id = p.brand_id \n\
   WHERE 1=1 {conditions}',
  JSON_ARRAY(
    JSON_OBJECT('table','order_items','schema','ecommerce_test','alias','oi','type','INNER',
                'on', JSON_ARRAY(JSON_OBJECT('left','o.id','right','oi.order_id'))),
    JSON_OBJECT('table','products','schema','ecommerce_test','alias','p','type','INNER',
                'on', JSON_ARRAY(JSON_OBJECT('left','oi.product_id','right','p.id'))),
    JSON_OBJECT('table','categories','schema','ecommerce_test','alias','c','type','LEFT',
                'on', JSON_ARRAY(JSON_OBJECT('left','p.category_id','right','c.id'))),
    JSON_OBJECT('table','brands','schema','ecommerce_test','alias','b','type','LEFT',
                'on', JSON_ARRAY(JSON_OBJECT('left','p.brand_id','right','b.id')))
  )
WHERE NOT EXISTS (SELECT 1 FROM `datasets` d WHERE d.name='订单-商品销售汇总' AND d.org_id=@ORG_ID);

-- 用户-订单汇总（users u JOIN orders o）
INSERT INTO `datasets` (`name`,`source_id`,`description`,`fields`,`parameters`,`created_by`,`updated_by`,`org_id`,`owner_id`,`visibility`,`base_table`,`base_schema`,`query_template`,`joins`)
SELECT '用户-订单汇总', @SOURCE_ID, '用户与订单的关联明细，用于客单价、复购等分析',
  JSON_ARRAY(
    JSON_OBJECT('name','用户ID','type','INTEGER','isMetric',false,'indexable',true,'expression','u.id','identifier','user_id','description','用户ID','isDimension',true),
    JSON_OBJECT('name','用户名','type','STRING','isMetric',false,'indexable',true,'expression','u.username','identifier','username','description','用户名','isDimension',true),
    JSON_OBJECT('name','省份','type','STRING','isMetric',false,'indexable',true,'expression','u.province','identifier','province','description','省份','isDimension',true),
    JSON_OBJECT('name','城市','type','STRING','isMetric',false,'indexable',true,'expression','u.city','identifier','city','description','城市','isDimension',true),
    JSON_OBJECT('name','订单ID','type','INTEGER','isMetric',false,'indexable',true,'expression','o.id','identifier','order_id','description','订单ID','isDimension',true),
    JSON_OBJECT('name','订单月份','type','STRING','isMetric',false,'indexable',true,'expression','DATE_FORMAT(o.order_date, "%Y-%m")','identifier','order_month','description','订单月份','isDimension',true),
    JSON_OBJECT('name','实付金额','type','FLOAT','isMetric',true,'indexable',true,'expression','o.actual_amount','identifier','actual_amount','description','实付金额','isDimension',false)
  ),
  JSON_ARRAY(
    JSON_OBJECT('name','start_date','type','DATE','description','开始日期','defaultValue','CURDATE() - INTERVAL 90 DAY'),
    JSON_OBJECT('name','end_date','type','DATE','description','结束日期','defaultValue','CURDATE()')
  ),
  'user1','user1',@ORG_ID,@OWNER_ID,@VISIBILITY,
  'users u','ecommerce_test',
  'SELECT {fields} FROM {base_table} \n\
   JOIN orders o ON o.user_id = u.id \n\
   WHERE 1=1 {conditions}',
  JSON_ARRAY(
    JSON_OBJECT('table','orders','schema','ecommerce_test','alias','o','type','INNER',
                'on', JSON_ARRAY(JSON_OBJECT('left','u.id','right','o.user_id')))
  )
WHERE NOT EXISTS (SELECT 1 FROM `datasets` d WHERE d.name='用户-订单汇总' AND d.org_id=@ORG_ID);

-- 促销活动效果汇总（promotions pr JOIN order_promotions op JOIN orders o）
INSERT INTO `datasets` (`name`,`source_id`,`description`,`fields`,`parameters`,`created_by`,`updated_by`,`org_id`,`owner_id`,`visibility`,`base_table`,`base_schema`,`query_template`,`joins`)
SELECT '促销活动效果汇总', @SOURCE_ID, '活动使用次数、让利金额、带动销售额',
  JSON_ARRAY(
    JSON_OBJECT('name','活动ID','type','INTEGER','isMetric',false,'indexable',true,'expression','pr.id','identifier','promotion_id','description','促销ID','isDimension',true),
    JSON_OBJECT('name','活动名称','type','STRING','isMetric',false,'indexable',true,'expression','pr.name','identifier','promotion_name','description','促销名称','isDimension',true),
    JSON_OBJECT('name','订单ID','type','INTEGER','isMetric',false,'indexable',true,'expression','o.id','identifier','order_id','description','订单ID','isDimension',true),
    JSON_OBJECT('name','订单日期','type','DATE','isMetric',false,'indexable',true,'expression','DATE_FORMAT(o.order_date, "%Y-%m-%d")','identifier','order_date','description','下单日期','isDimension',true),
    JSON_OBJECT('name','让利金额','type','FLOAT','isMetric',true,'indexable',true,'expression','op.discount_amount','identifier','discount_amount','description','折扣金额','isDimension',false),
    JSON_OBJECT('name','实付金额','type','FLOAT','isMetric',true,'indexable',true,'expression','o.actual_amount','identifier','actual_amount','description','实付金额','isDimension',false)
  ),
  JSON_ARRAY(
    JSON_OBJECT('name','start_date','type','DATE','description','开始日期','defaultValue','CURDATE() - INTERVAL 90 DAY'),
    JSON_OBJECT('name','end_date','type','DATE','description','结束日期','defaultValue','CURDATE()')
  ),
  'user1','user1',@ORG_ID,@OWNER_ID,@VISIBILITY,
  'promotions pr','ecommerce_test',
  'SELECT {fields} FROM {base_table} \n\
   JOIN order_promotions op ON op.promotion_id = pr.id \n\
   JOIN orders o ON o.id = op.order_id \n\
   WHERE 1=1 {conditions}',
  JSON_ARRAY(
    JSON_OBJECT('table','order_promotions','schema','ecommerce_test','alias','op','type','INNER',
                'on', JSON_ARRAY(JSON_OBJECT('left','pr.id','right','op.promotion_id'))),
    JSON_OBJECT('table','orders','schema','ecommerce_test','alias','o','type','INNER',
                'on', JSON_ARRAY(JSON_OBJECT('left','op.order_id','right','o.id')))
  )
WHERE NOT EXISTS (SELECT 1 FROM `datasets` d WHERE d.name='促销活动效果汇总' AND d.org_id=@ORG_ID);

-- 地区销售汇总（orders o JOIN addresses a）
INSERT INTO `datasets` (`name`,`source_id`,`description`,`fields`,`parameters`,`created_by`,`updated_by`,`org_id`,`owner_id`,`visibility`,`base_table`,`base_schema`,`query_template`,`joins`)
SELECT '地区销售汇总', @SOURCE_ID, '基于订单与收货地址的地区销售额统计',
  JSON_ARRAY(
    JSON_OBJECT('name','省份','type','STRING','isMetric',false,'indexable',true,'expression','a.province','identifier','province','description','省份','isDimension',true),
    JSON_OBJECT('name','城市','type','STRING','isMetric',false,'indexable',true,'expression','a.city','identifier','city','description','城市','isDimension',true),
    JSON_OBJECT('name','订单ID','type','INTEGER','isMetric',false,'indexable',true,'expression','o.id','identifier','order_id','description','订单ID','isDimension',true),
    JSON_OBJECT('name','实付金额','type','FLOAT','isMetric',true,'indexable',true,'expression','o.actual_amount','identifier','actual_amount','description','实付金额','isDimension',false),
    JSON_OBJECT('name','下单日期','type','DATE','isMetric',false,'indexable',true,'expression','DATE_FORMAT(o.order_date, "%Y-%m-%d")','identifier','order_date','description','下单日期','isDimension',true)
  ),
  JSON_ARRAY(
    JSON_OBJECT('name','start_date','type','DATE','description','开始日期','defaultValue','CURDATE() - INTERVAL 30 DAY'),
    JSON_OBJECT('name','end_date','type','DATE','description','结束日期','defaultValue','CURDATE()')
  ),
  'user1','user1',@ORG_ID,@OWNER_ID,@VISIBILITY,
  'orders o','ecommerce_test',
  'SELECT {fields} FROM {base_table} \n\
   LEFT JOIN addresses a ON a.id = o.shipping_address_id \n\
   WHERE 1=1 {conditions}',
  JSON_ARRAY(
    JSON_OBJECT('table','addresses','schema','ecommerce_test','alias','a','type','LEFT',
                'on', JSON_ARRAY(JSON_OBJECT('left','o.shipping_address_id','right','a.id')))
  )
WHERE NOT EXISTS (SELECT 1 FROM `datasets` d WHERE d.name='地区销售汇总' AND d.org_id=@ORG_ID);

-- 商品浏览与销售对比（user_behavior_logs ubl LEFT JOIN order_items oi JOIN products p）
INSERT INTO `datasets` (`name`,`source_id`,`description`,`fields`,`parameters`,`created_by`,`updated_by`,`org_id`,`owner_id`,`visibility`,`base_table`,`base_schema`,`query_template`,`joins`)
SELECT '商品浏览与销售对比', @SOURCE_ID, '基于行为日志与订单明细的浏览-销量对比（仅 product 目标）',
  JSON_ARRAY(
    JSON_OBJECT('name','商品ID','type','INTEGER','isMetric',false,'indexable',true,'expression','p.id','identifier','product_id','description','商品ID','isDimension',true),
    JSON_OBJECT('name','商品名称','type','STRING','isMetric',false,'indexable',true,'expression','p.name','identifier','product_name','description','商品名称','isDimension',true),
    JSON_OBJECT('name','行为类型','type','STRING','isMetric',false,'indexable',true,'expression','ubl.action_type','identifier','action_type','description','行为类型','isDimension',true),
    JSON_OBJECT('name','浏览记录ID','type','INTEGER','isMetric',false,'indexable',true,'expression','ubl.id','identifier','behavior_id','description','行为记录ID','isDimension',false),
    JSON_OBJECT('name','销量','type','INTEGER','isMetric',true,'indexable',true,'expression','oi.quantity','identifier','quantity','description','购买数量','isDimension',false)
  ),
  JSON_ARRAY(
    JSON_OBJECT('name','start_date','type','DATE','description','开始日期','defaultValue','CURDATE() - INTERVAL 30 DAY'),
    JSON_OBJECT('name','end_date','type','DATE','description','结束日期','defaultValue','CURDATE()')
  ),
  'user1','user1',@ORG_ID,@OWNER_ID,@VISIBILITY,
  'user_behavior_logs ubl','ecommerce_test',
  'SELECT {fields} FROM {base_table} \n\
   JOIN products p ON p.id = ubl.target_id \n\
   LEFT JOIN order_items oi ON oi.product_id = ubl.target_id \n\
   WHERE ubl.target_type = "product" {conditions}',
  JSON_ARRAY(
    JSON_OBJECT('table','products','schema','ecommerce_test','alias','p','type','INNER',
                'on', JSON_ARRAY(JSON_OBJECT('left','ubl.target_id','right','p.id'))),
    JSON_OBJECT('table','order_items','schema','ecommerce_test','alias','oi','type','LEFT',
                'on', JSON_ARRAY(JSON_OBJECT('left','ubl.target_id','right','oi.product_id')))
  )
WHERE NOT EXISTS (SELECT 1 FROM `datasets` d WHERE d.name='商品浏览与销售对比' AND d.org_id=@ORG_ID);

-- =====================================
-- Views (new, non-duplicated names)
-- =====================================

-- 商品销售额Top10（基于 订单-商品销售汇总）
INSERT INTO `views` (`name`,`type`,`config`,`description`,`dataset_id`,`org_id`,`owner_id`,`visibility`)
SELECT '商品销售额Top10','chart',
  JSON_OBJECT(
    'chartConfig', JSON_OBJECT(
      'title','商品销售额Top10','filters', JSON_ARRAY(),
      'metrics', JSON_ARRAY(JSON_OBJECT('alias','销售额','field', JSON_OBJECT('identifier','line_total'), 'aggregationType','sum')),
      'settings', JSON_OBJECT('limit',10,'showLegend',false,'colorScheme','fresh','showDataLabels',false),
      'chartType','bar',
      'dimensions', JSON_ARRAY(JSON_OBJECT('field', JSON_OBJECT('identifier','product_name')))
    ),
    'queryResult', NULL
  ),
  '按销售额排序的商品Top10', d.id, @ORG_ID, @OWNER_ID, @VISIBILITY
FROM `datasets` d WHERE d.name='订单-商品销售汇总' AND d.org_id=@ORG_ID
AND NOT EXISTS (SELECT 1 FROM `views` v WHERE v.name='商品销售额Top10' AND v.org_id=@ORG_ID);

-- 品牌销售额Top10
INSERT INTO `views` (`name`,`type`,`config`,`description`,`dataset_id`,`org_id`,`owner_id`,`visibility`)
SELECT '品牌销售额Top10','chart',
  JSON_OBJECT(
    'chartConfig', JSON_OBJECT(
      'title','品牌销售额Top10','filters', JSON_ARRAY(),
      'metrics', JSON_ARRAY(JSON_OBJECT('alias','销售额','field', JSON_OBJECT('identifier','line_total'), 'aggregationType','sum')),
      'settings', JSON_OBJECT('limit',10,'showLegend',false,'colorScheme','fresh','showDataLabels',false),
      'chartType','bar',
      'dimensions', JSON_ARRAY(JSON_OBJECT('field', JSON_OBJECT('identifier','brand_name')))
    ),
    'queryResult', NULL
  ),
  '按销售额排序的品牌Top10', d.id, @ORG_ID, @OWNER_ID, @VISIBILITY
FROM `datasets` d WHERE d.name='订单-商品销售汇总' AND d.org_id=@ORG_ID
AND NOT EXISTS (SELECT 1 FROM `views` v WHERE v.name='品牌销售额Top10' AND v.org_id=@ORG_ID);

-- 类目销售额Top10
INSERT INTO `views` (`name`,`type`,`config`,`description`,`dataset_id`,`org_id`,`owner_id`,`visibility`)
SELECT '类目销售额Top10','chart',
  JSON_OBJECT(
    'chartConfig', JSON_OBJECT(
      'title','类目销售额Top10','filters', JSON_ARRAY(),
      'metrics', JSON_ARRAY(JSON_OBJECT('alias','销售额','field', JSON_OBJECT('identifier','line_total'), 'aggregationType','sum')),
      'settings', JSON_OBJECT('limit',10,'showLegend',false,'colorScheme','fresh','showDataLabels',false),
      'chartType','bar',
      'dimensions', JSON_ARRAY(JSON_OBJECT('field', JSON_OBJECT('identifier','category_name')))
    ),
    'queryResult', NULL
  ),
  '按销售额排序的类目Top10', d.id, @ORG_ID, @OWNER_ID, @VISIBILITY
FROM `datasets` d WHERE d.name='订单-商品销售汇总' AND d.org_id=@ORG_ID
AND NOT EXISTS (SELECT 1 FROM `views` v WHERE v.name='类目销售额Top10' AND v.org_id=@ORG_ID);

-- 用户客单价Top10（avg 实付金额，基于 用户-订单汇总）
INSERT INTO `views` (`name`,`type`,`config`,`description`,`dataset_id`,`org_id`,`owner_id`,`visibility`)
SELECT '用户客单价Top10','chart',
  JSON_OBJECT(
    'chartConfig', JSON_OBJECT(
      'title','用户客单价Top10','filters', JSON_ARRAY(),
      'metrics', JSON_ARRAY(JSON_OBJECT('alias','客单价','field', JSON_OBJECT('identifier','actual_amount'), 'aggregationType','avg')),
      'settings', JSON_OBJECT('limit',10,'showLegend',false,'colorScheme','fresh','showDataLabels',false),
      'chartType','bar',
      'dimensions', JSON_ARRAY(JSON_OBJECT('field', JSON_OBJECT('identifier','username')))
    ),
    'queryResult', NULL
  ),
  '近 90 天客单价最高的用户', d.id, @ORG_ID, @OWNER_ID, @VISIBILITY
FROM `datasets` d WHERE d.name='用户-订单汇总' AND d.org_id=@ORG_ID
AND NOT EXISTS (SELECT 1 FROM `views` v WHERE v.name='用户客单价Top10' AND v.org_id=@ORG_ID);

-- 省份销售额Top10（基于 地区销售汇总）
INSERT INTO `views` (`name`,`type`,`config`,`description`,`dataset_id`,`org_id`,`owner_id`,`visibility`)
SELECT '省份销售额Top10','chart',
  JSON_OBJECT(
    'chartConfig', JSON_OBJECT(
      'title','省份销售额Top10','filters', JSON_ARRAY(),
      'metrics', JSON_ARRAY(JSON_OBJECT('alias','销售额','field', JSON_OBJECT('identifier','actual_amount'), 'aggregationType','sum')),
      'settings', JSON_OBJECT('limit',31,'showLegend',false,'colorScheme','fresh','showDataLabels',false),
      'chartType','bar',
      'dimensions', JSON_ARRAY(JSON_OBJECT('field', JSON_OBJECT('identifier','province')))
    ),
    'queryResult', NULL
  ),
  '按省份统计销售额Top10', d.id, @ORG_ID, @OWNER_ID, @VISIBILITY
FROM `datasets` d WHERE d.name='地区销售汇总' AND d.org_id=@ORG_ID
AND NOT EXISTS (SELECT 1 FROM `views` v WHERE v.name='省份销售额Top10' AND v.org_id=@ORG_ID);

-- 活动让利金额Top10（基于 促销活动效果汇总）
INSERT INTO `views` (`name`,`type`,`config`,`description`,`dataset_id`,`org_id`,`owner_id`,`visibility`)
SELECT '活动让利金额Top10','chart',
  JSON_OBJECT(
    'chartConfig', JSON_OBJECT(
      'title','活动让利金额Top10','filters', JSON_ARRAY(),
      'metrics', JSON_ARRAY(JSON_OBJECT('alias','让利金额','field', JSON_OBJECT('identifier','discount_amount'), 'aggregationType','sum')),
      'settings', JSON_OBJECT('limit',10,'showLegend',false,'colorScheme','fresh','showDataLabels',false),
      'chartType','bar',
      'dimensions', JSON_ARRAY(JSON_OBJECT('field', JSON_OBJECT('identifier','promotion_name')))
    ),
    'queryResult', NULL
  ),
  '折扣金额最高的活动', d.id, @ORG_ID, @OWNER_ID, @VISIBILITY
FROM `datasets` d WHERE d.name='促销活动效果汇总' AND d.org_id=@ORG_ID
AND NOT EXISTS (SELECT 1 FROM `views` v WHERE v.name='活动让利金额Top10' AND v.org_id=@ORG_ID);

-- 活动带动销售额Top10（基于 促销活动效果汇总）
INSERT INTO `views` (`name`,`type`,`config`,`description`,`dataset_id`,`org_id`,`owner_id`,`visibility`)
SELECT '活动带动销售额Top10','chart',
  JSON_OBJECT(
    'chartConfig', JSON_OBJECT(
      'title','活动带动销售额Top10','filters', JSON_ARRAY(),
      'metrics', JSON_ARRAY(JSON_OBJECT('alias','销售额','field', JSON_OBJECT('identifier','actual_amount'), 'aggregationType','sum')),
      'settings', JSON_OBJECT('limit',10,'showLegend',false,'colorScheme','fresh','showDataLabels',false),
      'chartType','bar',
      'dimensions', JSON_ARRAY(JSON_OBJECT('field', JSON_OBJECT('identifier','promotion_name')))
    ),
    'queryResult', NULL
  ),
  '带动销售额最高的活动', d.id, @ORG_ID, @OWNER_ID, @VISIBILITY
FROM `datasets` d WHERE d.name='促销活动效果汇总' AND d.org_id=@ORG_ID
AND NOT EXISTS (SELECT 1 FROM `views` v WHERE v.name='活动带动销售额Top10' AND v.org_id=@ORG_ID);

-- 浏览-销量对比Top10（基于 商品浏览与销售对比）
INSERT INTO `views` (`name`,`type`,`config`,`description`,`dataset_id`,`org_id`,`owner_id`,`visibility`)
SELECT '浏览-销量对比Top10','chart',
  JSON_OBJECT(
    'chartConfig', JSON_OBJECT(
      'title','浏览-销量对比Top10','filters', JSON_ARRAY(),
      'metrics', JSON_ARRAY(
        JSON_OBJECT('alias','浏览量','field', JSON_OBJECT('identifier','behavior_id'), 'aggregationType','count'),
        JSON_OBJECT('alias','销量','field', JSON_OBJECT('identifier','quantity'), 'aggregationType','sum')
      ),
      'settings', JSON_OBJECT('limit',10,'showLegend',true,'colorScheme','fresh','showDataLabels',false),
      'chartType','bar',
      'dimensions', JSON_ARRAY(JSON_OBJECT('field', JSON_OBJECT('identifier','product_name')))
    ),
    'queryResult', NULL
  ),
  '商品浏览与销量对比Top10', d.id, @ORG_ID, @OWNER_ID, @VISIBILITY
FROM `datasets` d WHERE d.name='商品浏览与销售对比' AND d.org_id=@ORG_ID
AND NOT EXISTS (SELECT 1 FROM `views` v WHERE v.name='浏览-销量对比Top10' AND v.org_id=@ORG_ID);

-- =====================================
-- Advanced Dashboard
-- =====================================

INSERT INTO `dashboards` (`name`,`description`,`config`,`org_id`,`owner_id`,`visibility`)
SELECT '电商高级分析看板','包含品牌/类目/地区/活动与用户客单价等高级分析',
  JSON_OBJECT(
    'filters', JSON_ARRAY(),
    'version','1.0.0',
    'settings', JSON_OBJECT(
      'grid', JSON_OBJECT('cols',24,'rows',0,'margin', JSON_ARRAY(8,7),'padding', JSON_ARRAY(18,21),'autoSize', true, 'rowHeight', 40, 'verticalCompact', true, 'preventCollision', false),
      'canvas', JSON_OBJECT('width', 1920, 'height', 1080)
    ),
    'components', JSON_ARRAY(
      JSON_OBJECT('id','a1','name','view_a1','type','view','style', JSON_OBJECT('padding',0),
        'config', JSON_OBJECT('viewId', (SELECT v.id FROM views v WHERE v.name='品牌销售额Top10' AND v.org_id=@ORG_ID LIMIT 1), 'showTitle', true),
        'layout', JSON_OBJECT('h', 10, 'w', 12, 'x', 0, 'y', 0)
      ),
      JSON_OBJECT('id','a2','name','view_a2','type','view','style', JSON_OBJECT('padding',0),
        'config', JSON_OBJECT('viewId', (SELECT v.id FROM views v WHERE v.name='类目销售额Top10' AND v.org_id=@ORG_ID LIMIT 1), 'showTitle', true),
        'layout', JSON_OBJECT('h', 10, 'w', 12, 'x', 12, 'y', 0)
      ),
      JSON_OBJECT('id','a3','name','view_a3','type','view','style', JSON_OBJECT('padding',0),
        'config', JSON_OBJECT('viewId', (SELECT v.id FROM views v WHERE v.name='省份销售额Top10' AND v.org_id=@ORG_ID LIMIT 1), 'showTitle', true),
        'layout', JSON_OBJECT('h', 10, 'w', 12, 'x', 0, 'y', 10)
      ),
      JSON_OBJECT('id','a4','name','view_a4','type','view','style', JSON_OBJECT('padding',0),
        'config', JSON_OBJECT('viewId', (SELECT v.id FROM views v WHERE v.name='用户客单价Top10' AND v.org_id=@ORG_ID LIMIT 1), 'showTitle', true),
        'layout', JSON_OBJECT('h', 10, 'w', 12, 'x', 12, 'y', 10)
      ),
      JSON_OBJECT('id','a5','name','view_a5','type','view','style', JSON_OBJECT('padding',0),
        'config', JSON_OBJECT('viewId', (SELECT v.id FROM views v WHERE v.name='活动让利金额Top10' AND v.org_id=@ORG_ID LIMIT 1), 'showTitle', true),
        'layout', JSON_OBJECT('h', 10, 'w', 12, 'x', 0, 'y', 20)
      ),
      JSON_OBJECT('id','a6','name','view_a6','type','view','style', JSON_OBJECT('padding',0),
        'config', JSON_OBJECT('viewId', (SELECT v.id FROM views v WHERE v.name='活动带动销售额Top10' AND v.org_id=@ORG_ID LIMIT 1), 'showTitle', true),
        'layout', JSON_OBJECT('h', 10, 'w', 12, 'x', 12, 'y', 20)
      ),
      JSON_OBJECT('id','a7','name','view_a7','type','view','style', JSON_OBJECT('padding',0),
        'config', JSON_OBJECT('viewId', (SELECT v.id FROM views v WHERE v.name='浏览-销量对比Top10' AND v.org_id=@ORG_ID LIMIT 1), 'showTitle', true),
        'layout', JSON_OBJECT('h', 10, 'w', 24, 'x', 0, 'y', 30)
      )
    )
  ),
  @ORG_ID, @OWNER_ID, @VISIBILITY
WHERE NOT EXISTS (SELECT 1 FROM `dashboards` db WHERE db.name='电商高级分析看板' AND db.org_id=@ORG_ID);

SET FOREIGN_KEY_CHECKS=1;

-- Verify
SELECT '=== DATASETS (joins) ===' AS info;
SELECT id,name,source_id,org_id,owner_id FROM datasets WHERE org_id=@ORG_ID AND name IN (
  '订单-商品销售汇总','用户-订单汇总','促销活动效果汇总','地区销售汇总','商品浏览与销售对比'
) ORDER BY id DESC;
SELECT '=== VIEWS (joins) ===' AS info;
SELECT id,name,type,dataset_id FROM views WHERE org_id=@ORG_ID AND name IN (
  '商品销售额Top10','品牌销售额Top10','类目销售额Top10','用户客单价Top10','省份销售额Top10','活动让利金额Top10','活动带动销售额Top10','浏览-销量对比Top10'
) ORDER BY id DESC;
SELECT '=== DASHBOARD (advanced) ===' AS info;
SELECT id,name FROM dashboards WHERE org_id=@ORG_ID AND name='电商高级分析看板';
