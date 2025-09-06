// 模块：通知 API 基本流程（中文描述）
import bootstrap from 'egg-mock/bootstrap';

describe('通知：CRUD 与连通性测试', () => {
  const { app } = bootstrap;
  let accessToken: string;
  let orgId: number;
  let notifyId: number;

  before(async () => {
    const login = await app.httpRequest().post('/api/auth/login').send({ identifier: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' })
      .expect(200);
    accessToken = login.body?.data?.accessToken;
    const orgs = await app.httpRequest().get('/api/orgs').set('Authorization', `Bearer ${accessToken}`);
    const list = (orgs.body?.data?.list || []);
    const def = list.find((o: any) => o.slug === 'default') || list[0];
    orgId = def?.id || 1;
  });

  it('创建 -> 列表 -> 详情 -> 更新 -> 删除', async () => {
    const created = await app.httpRequest()
      .post('/api/notifications')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .send({ name: `nt_${Date.now()}`, type: 'ding', config: { ding: { webhook: 'https://example.local/hook' } }, visibility: 'org' });
    if (created.status !== 200) {
      // eslint-disable-next-line no-console
      console.error('CREATE /api/notifications failed', created.status, created.body);
    }
    notifyId = created.body?.data?.id;

    await app.httpRequest().get('/api/notifications').set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .expect(200);

    const res = await app.httpRequest().get(`/api/notifications/${notifyId}`).set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId));
    if (res.status !== 200) {
      // eslint-disable-next-line no-console
      console.error('GET /api/notifications/:id failed', res.status, res.body);
    }

    await app.httpRequest().put(`/api/notifications/${notifyId}`).set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .send({ name: 'renamed' })
      .expect(200);

    await app.httpRequest().post(`/api/notifications/${notifyId}/test`).set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .send({ type: 'text' })
      .expect(200);

    await app.httpRequest().delete(`/api/notifications/${notifyId}`).set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .expect(200);
  });
});
