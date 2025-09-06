// egg-mock style app bootstrap
import bootstrap from 'egg-mock/bootstrap';

describe('认证与组织作用域', () => {
  const { app } = bootstrap;
  it('未携带 token 返回 401', async () => {
    await app.httpRequest()
      .get('/api/me')
      .expect(401)
      .expect(res => {
        if (res.body?.code !== 401) throw new Error('expected 401 code');
      });
  });

  it('登录 -> 访问受保护 -> 刷新 -> 再次访问', async () => {
    const login = await app.httpRequest()
      .post('/api/auth/login')
      .send({ identifier: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' })
      .expect(200);
    if (!login.body?.success) throw new Error('login failed');
    const accessToken = login.body?.data?.accessToken;
    const refreshToken = login.body?.data?.refreshToken;

    await app.httpRequest()
      .get('/api/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const refreshed = await app.httpRequest()
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    const access2 = refreshed.body?.data?.accessToken;
    await app.httpRequest()
      .get('/api/me')
      .set('Authorization', `Bearer ${access2}`)
      .expect(200);
  });
});

describe('管理员 403 与组织头校验', () => {
  const { app } = bootstrap;
  let accessToken: string;
  before(async () => {
    const login = await app.httpRequest()
      .post('/api/auth/login')
      .send({ identifier: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' })
      .expect(200);
    accessToken = login.body?.data?.accessToken;
  });

  it('非成员组织访问 admin 列表返回 403', async () => {
    await app.httpRequest()
      .get('/api/admin/orgs')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', '999999')
      .expect(403);
  });
});
