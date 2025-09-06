-- Patch joins field for JOIN-based datasets
-- Run:
--   mysql -h 127.0.0.1 -P 3306 -uroot -p'root123456' < dev/mysql/sql/patch_ecommerce_dataset_joins.sql

SET NAMES utf8mb4;
USE `lumina`;

SET @ORG_ID := 1;

-- 订单-商品销售汇总: o -> oi (INNER), oi -> p (INNER), p -> c (LEFT), p -> b (LEFT)
UPDATE datasets d
SET d.joins = JSON_ARRAY(
  JSON_OBJECT('table','order_items','schema','ecommerce_test','alias','oi','type','INNER',
              'on', JSON_ARRAY(JSON_OBJECT('left','o.id','right','oi.order_id'))),
  JSON_OBJECT('table','products','schema','ecommerce_test','alias','p','type','INNER',
              'on', JSON_ARRAY(JSON_OBJECT('left','oi.product_id','right','p.id'))),
  JSON_OBJECT('table','categories','schema','ecommerce_test','alias','c','type','LEFT',
              'on', JSON_ARRAY(JSON_OBJECT('left','p.category_id','right','c.id'))),
  JSON_OBJECT('table','brands','schema','ecommerce_test','alias','b','type','LEFT',
              'on', JSON_ARRAY(JSON_OBJECT('left','p.brand_id','right','b.id')))
)
WHERE d.name='订单-商品销售汇总' AND d.org_id=@ORG_ID;

-- 用户-订单汇总: u -> o (INNER)
UPDATE datasets d
SET d.joins = JSON_ARRAY(
  JSON_OBJECT('table','orders','schema','ecommerce_test','alias','o','type','INNER',
              'on', JSON_ARRAY(JSON_OBJECT('left','u.id','right','o.user_id')))
)
WHERE d.name='用户-订单汇总' AND d.org_id=@ORG_ID;

-- 促销活动效果汇总: pr -> op (INNER), op -> o (INNER)
UPDATE datasets d
SET d.joins = JSON_ARRAY(
  JSON_OBJECT('table','order_promotions','schema','ecommerce_test','alias','op','type','INNER',
              'on', JSON_ARRAY(JSON_OBJECT('left','pr.id','right','op.promotion_id'))),
  JSON_OBJECT('table','orders','schema','ecommerce_test','alias','o','type','INNER',
              'on', JSON_ARRAY(JSON_OBJECT('left','op.order_id','right','o.id')))
)
WHERE d.name='促销活动效果汇总' AND d.org_id=@ORG_ID;

-- 地区销售汇总: o -> a (LEFT)
UPDATE datasets d
SET d.joins = JSON_ARRAY(
  JSON_OBJECT('table','addresses','schema','ecommerce_test','alias','a','type','LEFT',
              'on', JSON_ARRAY(JSON_OBJECT('left','o.shipping_address_id','right','a.id')))
)
WHERE d.name='地区销售汇总' AND d.org_id=@ORG_ID;

-- 商品浏览与销售对比: ubl -> p (INNER), ubl -> oi (LEFT)
UPDATE datasets d
SET d.joins = JSON_ARRAY(
  JSON_OBJECT('table','products','schema','ecommerce_test','alias','p','type','INNER',
              'on', JSON_ARRAY(JSON_OBJECT('left','ubl.target_id','right','p.id'))),
  JSON_OBJECT('table','order_items','schema','ecommerce_test','alias','oi','type','LEFT',
              'on', JSON_ARRAY(JSON_OBJECT('left','ubl.target_id','right','oi.product_id')))
)
WHERE d.name='商品浏览与销售对比' AND d.org_id=@ORG_ID;

-- Verify
SELECT '=== DATASETS JOINS PATCHED ===' AS info;
SELECT id,name,JSON_PRETTY(joins) AS joins FROM datasets WHERE org_id=@ORG_ID AND name IN (
  '订单-商品销售汇总','用户-订单汇总','促销活动效果汇总','地区销售汇总','商品浏览与销售对比'
);
