// 模块：视图 基础流程
import bootstrap from 'egg-mock/bootstrap';

describe('视图：基础 CRUD 与数据接口', () => {
  const { app } = bootstrap;
  let accessToken: string;
  let orgId: number;
  let datasourceId: number;
  let datasetId: number;
  let viewId: number;

  before(async () => {
    // 管理员登录
    const login = await app.httpRequest()
      .post('/api/auth/login')
      .send({ identifier: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' })
      .expect(200);
    accessToken = login.body?.data?.accessToken;
    // 默认组织
    const orgs = await app.httpRequest()
      .get('/api/orgs')
      .set('Authorization', `Bearer ${accessToken}`);
    if (orgs.status !== 200) {
      // eslint-disable-next-line no-console
      console.error('GET /api/orgs failed', orgs.status, orgs.body);
      throw new Error(`GET /api/orgs expected 200 but got ${orgs.status}`);
    }
    const list = (orgs.body?.data?.list || []) as Array<{ id: number; slug?: string }>;
    const def = list.find(o => o.slug === 'default') || list[0];
    orgId = def?.id || 1;

    // 依赖：创建一个数据源与数据集
    // 确保测试数据库包含 orders 表（部分集成测试依赖该表）
    try {
      // Use JS helper to avoid TS type dependency on mysql2 types in test files
      const mod = await import('../../../../test/test-helpers/ensure_orders');
      const ensureOrders = mod.default || mod;
      await ensureOrders();
    } catch {
      // best-effort
    }
    // 使用 .env.test 中的测试数据库（lumina_test）作为数据源目标，避免连接外部主机
    const ds = await app.httpRequest()
      .post('/api/datasources')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .send({ name: `v_src_${Date.now()}`, type: 'mysql', config: { mysql: { user: 'lumina', password: 'lumina123', host: '127.0.0.1', port: 33306, database: 'lumina_test' } }, visibility: 'org' });
    if (ds.status !== 200) {
      // eslint-disable-next-line no-console
      console.error('POST /api/datasources failed', ds.status, ds.body);
      throw new Error(`POST /api/datasources expected 200 but got ${ds.status}`);
    }
    datasourceId = ds.body?.data?.id;
    const created = await app.httpRequest()
      .post('/api/datasets')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .send({
        name: `v_ds_${Date.now()}`,
        sourceId: datasourceId,
        baseTable: 'orders',
        fields: [{ identifier: 'id_0', name: 'id', type: 'INTEGER', expression: 'id', isDimension: false, isMetric: true }],
        visibility: 'org',
      })
      .expect(200);
    datasetId = created.body?.data?.id;
  });

  it('创建 -> 列表 -> 详情 -> 配置 -> 更新 -> 详情 detail', async () => {
    // 创建视图
    const created = await app.httpRequest()
      .post('/api/views')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .send({ name: `view_${Date.now()}`, datasetId, description: '测试视图', config: { type: 'table', options: {} }, visibility: 'org' });
    if (created.status !== 200) {
      // eslint-disable-next-line no-console
      console.error('CREATE /api/views failed', created.status, created.body);
      throw new Error(`CREATE view expected 200 but got ${created.status}`);
    }
    viewId = created.body?.data?.id;

    await app.httpRequest()
      .get('/api/views')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .expect(200);

    {
      const res = await app.httpRequest()
        .get(`/api/views/${viewId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Org-Id', String(orgId));
      if (res.status !== 200) {
        // 输出响应体以便定位 500 错误
        // eslint-disable-next-line no-console
        console.error('GET /api/views/:id failed', res.status, res.body);
        throw new Error(`GET /api/views/${viewId} expected 200 but got ${res.status}`);
      }
    }

    {
      const res = await app.httpRequest()
        .get(`/api/views/${viewId}/config`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Org-Id', String(orgId));
      if (res.status !== 200) {
        // eslint-disable-next-line no-console
        console.error('GET /api/views/:id/config failed', res.status, res.body);
        throw new Error(`GET /api/views/${viewId}/config expected 200 but got ${res.status}`);
      }
    }

    {
      const res = await app.httpRequest()
        .put(`/api/views/${viewId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Org-Id', String(orgId))
        .send({ description: 'hello' });
      if (res.status !== 200) {
        // eslint-disable-next-line no-console
        console.error('PUT /api/views/:id failed', res.status, res.body);
        throw new Error(`PUT /api/views/${viewId} expected 200 but got ${res.status}`);
      }
    }

    {
      const res = await app.httpRequest()
        .get(`/api/views/${viewId}/detail`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Org-Id', String(orgId));
      if (res.status !== 200) {
        // eslint-disable-next-line no-console
        console.error('GET /api/views/:id/detail failed', res.status, res.body);
        throw new Error(`GET /api/views/${viewId}/detail expected 200 but got ${res.status}`);
      }
    }
  });

  it('视图数据接口 getData 可调用（最小参数）', async () => {
    // 根据 strict 模式，需要至少提供一个 metric 或 dimension；这里使用最小的 count metric
    const res = await app.httpRequest()
      .post(`/api/views/${viewId}/data`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .send({ dimensions: [], metrics: [{ field: { identifier: 'id_0', name: 'id', type: 'INTEGER' }, aggregationType: 'count' }], filters: [], limit: 1 });
    if (res.status !== 200) {
      throw new Error(`POST /api/views/${viewId}/data expected 200 but got ${res.status}`);
    }
  });
});
