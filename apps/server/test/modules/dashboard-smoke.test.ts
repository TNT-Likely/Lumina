// 模块：仪表盘 简单流程（创建 -> 读取 -> 删除）
import bootstrap from 'egg-mock/bootstrap';

describe('仪表盘：创建 -> 读取 -> 删除（烟雾测试）', () => {
  const { app } = bootstrap;
  let accessToken: string;
  let orgId: number;
  let dashboardId: number;

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
    const list = orgs.body?.data?.list || [];
    const def = list.find((o: any) => o.slug === 'default') || list[0];
    orgId = def?.id || 1;
  });

  it('创建一个最小仪表盘并能被读取与删除', async () => {
    const created = await app.httpRequest()
      .post('/api/dashboards')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .send({ name: `smoke_${Date.now()}`, description: 'smoke test', config: { components: [] } })
      .expect(200);

    dashboardId = created.body?.data?.id;
    if (!dashboardId) throw new Error('创建仪表盘未返回 id');

    await app.httpRequest()
      .get(`/api/dashboards/${dashboardId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .expect(200);

    await app.httpRequest()
      .delete(`/api/dashboards/${dashboardId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .expect(200);
  });
});
