// 模块：视图 CRUD（使用测试数据库）
import bootstrap from 'egg-mock/bootstrap';

describe('视图 CRUD：创建 -> 读取 -> 更新 -> 删除', () => {
  const { app } = bootstrap;
  let accessToken: string;
  let orgId: number;
  let datasourceId: number;
  let datasetId: number;
  let viewId: number;

  before(async () => {
    if (process.env.NODE_ENV !== 'test') throw new Error('必须在 test 环境下运行');

    const login = await app.httpRequest()
      .post('/api/auth/login')
      .send({ identifier: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' })
      .expect(200);
    accessToken = login.body?.data?.accessToken;

    const orgs = await app.httpRequest()
      .get('/api/orgs')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const list = (orgs.body?.data?.list || []);
    const def = list.find((o: any) => o.slug === 'default') || list[0];
    orgId = def?.id || 1;
  });

  it('创建数据源与数据集（用于视图）', async () => {
    const createdSrc = await app.httpRequest()
      .post('/api/datasources')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .send({ name: `test_src_${Date.now()}`, type: 'mysql', config: { mysql: { user: 'u', host: 'h', port: 3306, database: 'd' } }, visibility: 'org' })
      .expect(200);
    datasourceId = createdSrc.body?.data?.id;

    const createdDs = await app.httpRequest()
      .post('/api/datasets')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .send({
        name: `test_ds_${Date.now()}`,
        sourceId: datasourceId,
        baseTable: 'orders',
        fields: [{ identifier: 'id', name: 'id', type: 'INTEGER', expression: 'id', isDimension: true, isMetric: false }],
        visibility: 'org',
      })
      .expect(200);
    datasetId = createdDs.body?.data?.id;
  });

  it('创建视图 -> 读取 -> 更新', async () => {
    const created = await app.httpRequest()
      .post('/api/views')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .send({
        name: `view_${Date.now()}`,
        type: 'chart',
        datasetId,
        description: '测试视图',
        config: {
          chartConfig: {
            title: '测试',
            metrics: [{ alias: '数量', field: { identifier: 'id' }, aggregationType: 'count' }],
            dimensions: [{ field: { identifier: 'id' } }],
            chartType: 'bar',
          },
        },
      })
      .expect(200);
    viewId = created.body?.data?.id;

    // 读取
    await app.httpRequest()
      .get(`/api/views/${viewId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .expect(200);

    // 更新描述
    await app.httpRequest()
      .put(`/api/views/${viewId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .send({ description: 'updated-desc' })
      .expect(200);
  });

  it('清理：删除视图/数据集/数据源', async () => {
    if (viewId) {
      await app.httpRequest()
        .delete(`/api/views/${viewId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Org-Id', String(orgId))
        .expect(200);
    }

    if (datasetId) {
      await app.httpRequest()
        .delete(`/api/datasets/${datasetId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Org-Id', String(orgId))
        .expect(200);
    }

    if (datasourceId) {
      await app.httpRequest()
        .delete(`/api/datasources/${datasourceId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Org-Id', String(orgId))
        .expect(200);
    }
  });
});
