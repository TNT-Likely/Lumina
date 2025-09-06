// 模块：数据源错误路径
import bootstrap from 'egg-mock/bootstrap';

describe('数据源错误场景：缺失必填字段应返回 400', () => {
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

  it('创建数据源缺少 name 字段应返回 400', async () => {
    const res = await app.httpRequest()
      .post('/api/datasources')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ type: 'mysql', config: { mysql: { user: 'u' } } });

    if (res.status === 200 && res.body?.data?.id) {
      // API 错误地创建了数据源，尝试清理并将测试标记为失败
      const id = res.body.data.id;
      await app.httpRequest()
        .delete(`/api/datasources/${id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      throw new Error('不应创建缺少 name 的数据源，期望返回 400');
    }

    if (res.status !== 400) {
      throw new Error(`期望 400，但收到 ${res.status}`);
    }
  });
});
