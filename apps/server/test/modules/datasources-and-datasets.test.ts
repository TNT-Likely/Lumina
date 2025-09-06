// 模块：数据源 & 数据集 基础流程
import bootstrap from 'egg-mock/bootstrap';

describe('数据源 & 数据集：基础 CRUD 与读取', () => {
  const { app } = bootstrap;
  let accessToken: string;
  let orgId: number;
  let datasourceId: number;
  let datasetId: number;

  before(async () => {
    // 管理员登录
    const login = await app.httpRequest()
      .post('/api/auth/login')
      .send({ identifier: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' })
      .expect(200);
    accessToken = login.body?.data?.accessToken;

    // 解析默认组织 ID
    const orgs = await app.httpRequest()
      .get('/api/orgs')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const list = (orgs.body?.data?.list || []) as Array<{ id: number; slug?: string }>;
    const def = list.find(o => o.slug === 'default') || list[0];
    orgId = def?.id || 1;
  });

  it('创建数据源 -> 列表可见 -> 详情可读 -> 更新 -> 删除', async () => {
    // 创建
    const created = await app.httpRequest()
      .post('/api/datasources')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .send({ name: `src_${Date.now()}`, type: 'mysql', config: { mysql: { user: 'u', host: 'h', port: 3306, database: 'd' } }, visibility: 'org' })
      .expect(200);
    datasourceId = created.body?.data?.id;

    // 列表
    const list = await app.httpRequest()
      .get('/api/datasources')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .expect(200);
    const items = (list.body?.data?.list || []) as Array<Record<string, unknown>>;
    if (!items.find(x => Number(x.id) === Number(datasourceId))) throw new Error('数据源未出现在列表');

    // 详情
    await app.httpRequest()
      .get(`/api/datasources/${datasourceId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .expect(200);

    // 更新
    await app.httpRequest()
      .put(`/api/datasources/${datasourceId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .send({ name: 'updated_name' })
      .expect(200);

    // 配置读取
    await app.httpRequest()
      .get(`/api/datasources/${datasourceId}/config`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .expect(200);
  });

  it('创建数据集 -> 字段/配置读取 -> 更新 -> 删除', async () => {
    // 创建数据集（注意 baseTable 校验与 fields 结构）
    const created = await app.httpRequest()
      .post('/api/datasets')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .send({
        name: `ds_${Date.now()}`,
        sourceId: datasourceId,
        baseTable: 'orders',
        fields: [
          { identifier: 'id_0', name: 'id', type: 'INTEGER', expression: 'id', isDimension: false, isMetric: true },
        ],
        visibility: 'org',
      })
      .expect(200);
    datasetId = created.body?.data?.id;

    await app.httpRequest()
      .get('/api/datasets')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .expect(200);

    await app.httpRequest()
      .get(`/api/datasets/${datasetId}/fields`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .expect(200);

    await app.httpRequest()
      .get(`/api/datasets/${datasetId}/config`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .expect(200);

    await app.httpRequest()
      .put(`/api/datasets/${datasetId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .send({ description: 'updated' })
      .expect(200);
  });

  it('清理：删除数据集与数据源', async () => {
    await app.httpRequest()
      .delete(`/api/datasets/${datasetId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .expect(200);

    await app.httpRequest()
      .delete(`/api/datasources/${datasourceId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .expect(200);
  });
});
