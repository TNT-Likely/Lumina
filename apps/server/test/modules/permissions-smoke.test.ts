// 模块：权限接口简要测试
import bootstrap from 'egg-mock/bootstrap';

describe('权限接口：batch 权限判定（烟雾）', () => {
  const { app } = bootstrap;
  let accessToken: string;

  before(async () => {
    if (process.env.NODE_ENV !== 'test') throw new Error('必须在 test 环境下运行');
    const login = await app.httpRequest()
      .post('/api/auth/login')
      .send({ identifier: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' })
      .expect(200);
    accessToken = login.body?.data?.accessToken;
  });

  it('POST /api/permissions:batch 返回数组', async () => {
    const res = await app.httpRequest()
      .post('/api/permissions:batch')
      .set('Authorization', `Bearer ${accessToken}`)
      .send([{ resource: 'dashboards', action: 'read' }])
      .expect(200);

    if (!Array.isArray(res.body?.data)) throw new Error('期望返回数组');
  });
});
