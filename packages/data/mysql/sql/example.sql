- 插入视图数据 (基于现有静态数据)
INSERT INTO views (id, name, type, config) VALUES
('editor_load_success_rate', '加载成功率', 'metric', '{"description": "加载成功 / 加载开始", "datasetKey": "fed_monitor"}'),
('editor_load_one_second_rate', '加载秒开率', 'metric', '{"description": "加载耗时 < 1秒 / 加载成功", "datasetKey": "fed_monitor"}'),
('editor_load_avg_time', '加载平均耗时', 'metric', '{"description": "加载成功总耗时 / 加载成功次数", "datasetKey": "fed_monitor"}'),
('editor_useable_avg_time', '可用平均耗时', 'metric', '{"description": "可用 定义为 \\"分享按钮出现\\"", "datasetKey": "fed_monitor"}'),
('editor_save_success_rate', '保存成功率', 'metric', '{"description": "保存成功 / 保存开始", "datasetKey": "fed_monitor"}'),
('editor_save_avg_time', '保存平均耗时', 'metric', '{"description": "保存成功总耗时 / 保存成功次数", "datasetKey": "fed_monitor"}'),
('editor_export_success_rate', '导出成功率', 'metric', '{"description": "导出成功 / 导出开始", "datasetKey": "fed_monitor"}'),
('editor_export_avg_time', '导出平均耗时', 'metric', '{"description": "导出成功总耗时 / 导出成功次数", "datasetKey": "fed_monitor"}'),
('editor_file_analysis_success_rate', '解析成功率', 'metric', '{"description": "解析成功 / ( 解析成功 + 解析失败 )", "datasetKey": "fed_analysis_h5"}'),
('editor_template_error_rate', '模板异常率', 'metric', '{"description": "出现过\\"加载、保存、导出\\" 异常模板/模板总数", "datasetKey": "fed_monitor"}'),
('api_costTime', 'api耗时', 'metric', '{"datasetKey": "fed_monitor"}'),
('api_401_rate', '接口401率', 'metric', '{"datasetKey": "fed_monitor"}'),
('login_success_rate', '登录成功率', 'metric', '{"description": "接口非 401 总数/接口总数", "datasetKey": "fed_monitor"}'),
('login_failed_count', '登录失败数', 'metric', '{"datasetKey": "fed_monitor"}'),
('login_failed_user_count', '登录失败用户数', 'metric', '{"datasetKey": "fed_monitor"}'),
('editor_longTask_rate', '作图卡顿占比', 'metric', '{"description": "出现过卡顿的作图记录/总作图记录", "datasetKey": "fed_monitor"}'),
('editor_longTask_count', '卡顿次数', 'metric', '{"datasetKey": "fed_monitor"}'),
('editor_longTask_users', '卡顿用户数', 'metric', '{"datasetKey": "fed_monitor"}'),
('editor_longTask_time', '卡顿时长(P75)', 'metric', '{"datasetKey": "fed_monitor"}'),
('editor_longTask_frequency', '平均卡顿次数', 'metric', '{"description": "每个用户的平均卡顿次数", "datasetKey": "fed_monitor"}');

-- 插入仪表板数据
INSERT INTO dashboards (id, name, layout, config) VALUES
('editor-dashboard', '编辑器核心指标', '{"type": "grid"}', '{"description": "", "globalFilters": ["service", "version", "userId", "time"]}'),
('api-dashboard', '接口核心指标', '{"type": "grid"}', '{"description": "", "globalFilters": ["service", "version", "httpUrl", "userId", "time"]}'),
('editor-longTask-dashboard', '编辑器卡顿指标', '{"type": "grid"}', '{"description": "", "globalFilters": ["service", "version", "userId", "time"]}'),
('editor-frequent-login', '编辑器频繁登录', '{"type": "grid"}', '{"description": "", "globalFilters": ["service", "version", "userId", "time"]}');

-- 插入数据源数据
INSERT INTO datasources (id, name, type, config) VALUES
('sls_prod_rum', '前端监控 sls 日志', 'SLS', '{"accessKeyId": "your_access_key_id", "secretAccessKey": "your_secret_access_key", "projectName": "gaoding-prod", "logStoreName": "gaoding-prod-rum-processed"}'),
('sls_prod_track_h5', 'sls_prod_track_h5', 'SLS', '{"accessKeyId": "your_access_key_id", "secretAccessKey": "your_secret_access_key", "projectName": "web-gaoding-prod", "logStoreName": "sls-alysls-track-h5"}'),
('mysql1', '测试 mysql', 'MYSQL', '{"host": "localhost", "port": 3306, "username": "root", "password": "password", "database": "yt_fed_hidemo"}');

-- 插入数据集数据
INSERT INTO datasets (id, name, source_id, query, fields) VALUES
('fed_monitor', '前端sls监控', 'sls_prod_rum', '{}', '{}'),
('fed_analysis_h5', '前端分析 h5', 'sls_prod_track_h5', '{}', '{}');

-- 插入通知数据
INSERT INTO notifies (id, name, type, config) VALUES
('editor_dd_group', '钉钉群-工具研发组', 'DINGTALK', '{"accessToken": "ad29869cb7e76a8250ff29855b184448f3bd7180addda4594cadced7e9070a8e", "secret": "SEC631586117db710e03dffbff6f2cc0734946b1a8afc43206505d28221b6b70f26"}'),
('longTask_dd_group', '钉钉群-编辑器卡顿专项', 'DINGTALK', '{"accessToken": "e8cfb036a68882ec6b2ae4f33c8a2311b79b6d4eb30e5a64a858f0a54239af10", "secret": "SEC204c22e1c117a0c573eddef92cb233dbbaed561054fe8e381c9ad72780567d63"}'),
('lumina-plate_dd_group', '钉钉群-Lumina告警', 'DINGTALK', '{"accessToken": "f26349a2db62cc3f40005a2a8e8554383d6c82d86193ef2086b03b4496039861", "secret": "SEC3dbd6adf59bc1701a9666f31db196cabe07dbba10572bf02b3ea74e25fe836af"}');

-- 插入告警数据
INSERT INTO alerts (id, name, dataset_id, conditions, config, enabled) VALUES
('editor_oneSecondRate', '编辑器秒开率下降1%', 'fed_monitor', '{}', '{"cron": "0 8 * * *", "time": "lastDay", "ruleType": "all"}', 1);

-- 插入订阅数据
INSERT INTO subscribes (id, name, alert_id, notify_id, config) VALUES
('editor_daily', '【日报】编辑器核心指标', 'editor_oneSecondRate', 'editor_dd_group', '{"cron": "0 2 * * *", "time": "lastDay", "type": "screenshot"}'),
('editor_weekly', '【周报】编辑器核心指标', 'editor_oneSecondRate', 'lumina-plate_dd_group', '{"cron": "0 0 5 * * 0", "time": "lastRelativeWeek", "type": "screenshot"}'),
('editor_longTask_daily', '【日报】编辑器卡顿指标', 'editor_oneSecondRate', 'longTask_dd_group', '{"cron": "10 3 * * *", "time": "lastDay", "type": "screenshot"}'),
('editor_longTask_weekly', '【周报】编辑器卡顿指标', 'editor_oneSecondRate', 'lumina-plate_dd_group', '{"cron": "0 10 5 * * 0", "time": "lastRelativeWeek", "type": "screenshot"}');