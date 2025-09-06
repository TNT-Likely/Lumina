// 模块：权限批量检查 & 上传
import bootstrap from 'egg-mock/bootstrap';

describe('权限批量检查 & 上传：接口可用性', () => {
  const { app } = bootstrap;
  let accessToken: string;
  let orgId: number;

  before(async () => {
    const login = await app.httpRequest()
      .post('/api/auth/login')
      .send({ identifier: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' })
      .expect(200);
    accessToken = login.body?.data?.accessToken;

    const orgs = await app.httpRequest()
      .get('/api/orgs')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const list = (orgs.body?.data?.list || []) as Array<{ id: number; slug?: string }>;
    const def = list.find(o => o.slug === 'default') || list[0];
    orgId = def?.id || 1;
  });

  it('POST /api/permissions:batch 返回权限判定结果数组', async () => {
    const res = await app.httpRequest()
      .post('/api/permissions:batch')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .send({ items: [{ type: 'dashboard', id: 999999 }, { type: 'dataset', id: 999998 }] })
      .expect(200);
    if (!Array.isArray(res.body?.data)) throw new Error('应返回数组');
  });

  it('POST /api/upload 在未配置存储时返回 501', async () => {
    // 强制模拟未配置存储
    process.env.LUMINA_FORCE_NO_STORAGE = '1';
    await app.httpRequest()
      .post('/api/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgId))
      .attach('file', Buffer.from('hello'), 'hello.txt')
      .expect(501);
    delete process.env.LUMINA_FORCE_NO_STORAGE;
  });
});
