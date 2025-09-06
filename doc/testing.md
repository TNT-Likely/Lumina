# 接口单测与隔离环境方案

本方案目标：

- 在本地开发之外，提供一套“隔离、可重复”的接口单测环境。
- 按模块划分测试集，覆盖鉴权/权限/边界/失败场景。
- 一条命令即可启动依赖、运行测试、输出报告。

## 一、测试环境隔离

推荐使用 Docker Compose 启动独立依赖与服务，避免污染本地开发态：

- 数据库：MySQL（或 Postgres 等实际使用的数据库）
- Redis：作为会话 / 任务队列 / 频控等依赖
- RabbitMQ：订阅/调度依赖
- 被测服务：apps/server 以 test 配置启动

环境变量：

- 使用 `.env.test`（仅用于测试）与 `.env.local`（开发）分离。
- `.env.test` 中使用独立的 DB/Redis/RabbitMQ 库/前缀，避免相互污染。

## 二、工具与目录结构

- 测试框架：Jest + supertest（HTTP API 断言）
- 组织结构建议：
  - tests/
    - auth/
    - org/
    - datasource/
    - dataset/
    - view/
    - dashboard/
    - notification/
    - subscription/
  - 每个模块内再按“happy path / 权限边界 / 异常场景”分文件。

## 三、基础契约（约定）

- 请求需携带 Authorization（Bearer token），除公开接口外。
- 多组织维度：所有创建类接口默认写入“当前组织”。
- 角色：ADMIN / EDITOR / VIEWER 三类基础角色。
- 错误：使用统一的错误码与 http status（4xx/5xx）。

## 四、通用测试基类

- bootstrap：
  - 在 beforeAll：
    - 启动 docker 依赖（可选：也可预先在 dev/docker-compose 中定义 test profile）。
    - 迁移/初始化数据库（可指定最小数据）。
    - 启动 apps/server（SERVER_PORT=7xxx）。
  - 在 afterAll：
    - 关闭服务，清理容器与数据卷（或保留以便排错）。
- helpers：
  - loginAs(role)：返回不同角色的 token
  - createOrg() / inviteMember()：组织级操作
  - request()：封装 supertest 实例，自动注入 baseURL 与 headers

## 五、按模块测试用例清单（示例）

以下仅列出关键断言点，实际用例需包含期望的 http status、响应体字段断言、以及后置清理。

1) Auth & Org
- 注册与登录：成功；重复注册；弱口令；错误凭证
- 组织创建：ADMIN 可创建；EDITOR/VIEWER 不可创建
- 邀请成员：ADMIN 可邀请；校验邮箱格式；重复邀请；接受邀请流程

2) Datasource
- 创建：ADMIN 成功；EDITOR 成功；VIEWER 403
- 测试连接：参数缺失 400；认证失败 401/403；连接失败 502
- 列表/详情：有权限成员可见；跨组织不可见
- 更新：仅拥有者/ADMIN；并发更新使用版本号/etag（如有）
- 删除：空引用成功；被数据集引用时报 409 并提示引用关系

3) Dataset
- 从表创建：字段自动识别；不支持类型报错
- 字段编辑：表达式基础校验；无权限 403
- 列表/详情：按组织与权限过滤
- 删除：被视图引用时报 409

4) View
- 创建视图：维度/度量绑定正确；无权限 403
- 预览：参数校验；空数据边界
- 更新/删除：权限校验；并发更新

5) Dashboard
- 创建：添加多个视图并布局；保存成功
- 全局筛选：字段存在与传播验证
- 分享链接：public / org 签名；PREVIEW_TOKEN_SECRET 未配置时报 400
- 删除：被订阅引用时报 409

6) Notification
- 渠道配置：邮件/钉钉/Slack/飞书/Discord/Telegram 校验必填项
- 发送：模板渲染成功；渠道错误配置重试与错误码

7) Subscription
- 创建：选择仪表盘 → 设定 cron/频率 → 选择渠道 → 收件人
- 执行：手动触发一次发送，收到 200，并在通知渠道端可见
- 队列：RabbitMQ 存在任务；重试策略；失败告警

## 六、落地示例（代码片段）

以下用例用来说明粒度与风格（示意）：

```ts
// tests/datasource/create.spec.ts
import request from 'supertest';
import { loginAs, server } from '../helpers';

describe('Datasource: create', () => {
  it('ADMIN can create', async () => {
    const token = await loginAs('ADMIN');
    const res = await request(server)
      .post('/api/datasources')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'mysql', host: 'db', port: 3306, database: 'demo', user: 'ro', password: '***' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
  });

  it('EDITOR can create', async () => {
    const token = await loginAs('EDITOR');
    const res = await request(server)
      .post('/api/datasources')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'mysql', host: 'db', port: 3306, database: 'demo', user: 'ro', password: '***' });
    expect(res.status).toBe(201);
  });

  it('VIEWER cannot create', async () => {
    const token = await loginAs('VIEWER');
    const res = await request(server)
      .post('/api/datasources')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'mysql', host: 'db', port: 3306, database: 'demo', user: 'ro', password: '***' });
    expect(res.status).toBe(403);
  });
});
```

## 七、执行与报告

- 执行：
  - 本地：`pnpm -w turbo run test:api`（在根 package.json 配置 scripts）
  - CI：使用 GitHub Actions / GitLab CI，以 docker compose 启动依赖后运行测试
- 报告：
  - jest-junit 输出 XML，供 CI 展示
  - 覆盖率使用 c8/istanbul，阈值按模块设置（例如：api 80%，核心模块 90%）

## 八、数据与幂等

- 每个用例前后清理所创建的资源，或使用事务 + 回滚（若有）
- 使用组织前缀/命名约定隔离数据，避免跨用例污染
- 失败重跑策略仅用于临时网络类用例，业务断言不建议重跑

## 九、扩展建议

- 合并“契约测试”（对外 API 的 schema 校验）与“回归集”
- 对慢查询接口加入性能阈值断言（如 p95 < 500ms）
- 对订阅截图链路增加端到端金丝雀用例（生成图片并校验尺寸/格式）
