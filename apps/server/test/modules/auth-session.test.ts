// 模块：认证与会话（使用测试数据库）
import bootstrap from 'egg-mock/bootstrap';

describe('认证与会话：登录 / 获取用户信息 / 注销', () => {
  const { app } = bootstrap;
  let accessToken: string;

  before(async () => {
    // 确保使用测试环境
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('测试必须在 NODE_ENV=test 下运行，避免连接开发数据库');
    }
  });

  it('管理员账号可以登录并获取个人信息', async () => {
    // 登录
    const login = await app.httpRequest()
      .post('/api/auth/login')
      .send({ identifier: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' })
      .expect(200);

    accessToken = login.body?.data?.accessToken;
    if (!accessToken) throw new Error('登录未返回 accessToken');

    // 获取当前用户信息（服务中使用 /api/me）
    const me = await app.httpRequest()
      .get('/api/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const uid = me.body?.data?.id;
    if (!uid) throw new Error('未能读取当前用户 id');
  });

  it('注销后无法再访问受保护接口', async () => {
    // 注销
    await app.httpRequest()
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // 再次访问应返回 401 或 403
    await app.httpRequest()
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(res => {
        if (res.status === 200) throw new Error('注销后仍然可以访问受保护接口');
      });
  });
});
