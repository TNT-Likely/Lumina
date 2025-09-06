// egg-mock style app bootstrap
import bootstrap from 'egg-mock/bootstrap';

const { app } = bootstrap;

describe('RBAC：跨组织的公开可见与写入限制', () => {
  let accessToken: string;
  let orgA: number;
  let orgB: number;
  let dsPublicId: number | null = null;
  let editorToken: string;
  let viewerToken: string;

  before(async () => {
    const login = await app.httpRequest()
      .post('/api/auth/login')
      .send({ identifier: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' })
      .expect(200);
    accessToken = login.body?.data?.accessToken;

    // 解析 admin 的默认组织作为管理作用域
    const orgs = await app.httpRequest()
      .get('/api/orgs')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const list = (orgs.body?.data?.list || []) as Array<{ id: number; slug?: string }>;
    const def = list.find(o => o.slug === 'default') || list[0];
    const adminScopeOrgId = def?.id || 1;

    // 创建两个组织
    const slugA = `orga_${Date.now()}`;
    const a = await app.httpRequest()
      .post('/api/admin/orgs')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(adminScopeOrgId))
      .send({ name: 'OrgA', slug: slugA })
      .expect(200);
    orgA = a.body?.data?.id;
    if (!orgA) {
      const myOrgs = await app.httpRequest()
        .get('/api/orgs')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const list2 = (myOrgs.body?.data?.list || []) as Array<{ id: number; slug?: string }>;
      const foundA = list2.find(o => o.slug === slugA);
      if (!foundA) throw new Error('failed to resolve orgA id');
      orgA = foundA.id;
    }

    const slugB = `orgb_${Date.now()}`;
    const b = await app.httpRequest()
      .post('/api/admin/orgs')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(adminScopeOrgId))
      .send({ name: 'OrgB', slug: slugB })
      .expect(200);
    orgB = b.body?.data?.id;
    if (!orgB) {
      const myOrgs2 = await app.httpRequest()
        .get('/api/orgs')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const list3 = (myOrgs2.body?.data?.list || []) as Array<{ id: number; slug?: string }>;
      const foundB = list3.find(o => o.slug === slugB);
      if (!foundB) throw new Error('failed to resolve orgB id');
      orgB = foundB.id;
    }

    // create two users and add to orgA with roles
    const editorReg = await app.httpRequest()
      .post('/api/auth/register')
      .send({ username: `editor_${Date.now()}`, email: `e_${Date.now()}@t.local`, password: 'pass1234' })
      .expect(200);
    const editorId = editorReg.body?.data?.id;
    await app.httpRequest()
      .post(`/api/admin/orgs/${orgA}/members`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ userId: editorId, role: 'EDITOR' })
      .expect(200);
    const editorLogin = await app.httpRequest()
      .post('/api/auth/login')
      .send({ identifier: editorReg.body?.data?.username, password: 'pass1234' })
      .expect(200);
    editorToken = editorLogin.body?.data?.accessToken;

    const viewerReg = await app.httpRequest()
      .post('/api/auth/register')
      .send({ username: `viewer_${Date.now()}`, email: `v_${Date.now()}@t.local`, password: 'pass1234' })
      .expect(200);
    const viewerId = viewerReg.body?.data?.id;
    await app.httpRequest()
      .post(`/api/admin/orgs/${orgA}/members`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ userId: viewerId, role: 'VIEWER' })
      .expect(200);
    const viewerLogin = await app.httpRequest()
      .post('/api/auth/login')
      .send({ identifier: viewerReg.body?.data?.username, password: 'pass1234' })
      .expect(200);
    viewerToken = viewerLogin.body?.data?.accessToken;
  });

  it('在 orgA 创建 public 数据源，orgB 列表可见但不可写', async () => {
    // Create in orgA
    const created = await app.httpRequest()
      .post('/api/datasources')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgA))
      .send({ name: `pub_ds_${Date.now()}`, type: 'mysql', config: { mysql: { user: 'u', host: 'h', port: 3306, database: 'd' } }, visibility: 'public' })
      .expect(200);
    const dsId = created.body?.data?.id as number;
    dsPublicId = dsId;

    // List from orgB
    const listB = await app.httpRequest()
      .get('/api/datasources')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgB))
      .expect(200);
    const items = (listB.body?.data?.list || []) as Array<Record<string, unknown>>;
    const found = items.find(x => Number(x.id as number | string | undefined) === dsId) as Record<string, unknown> | undefined;
    if (!found) throw new Error('public datasource should be visible cross-org');
    if ((found as { canWrite?: boolean } | undefined)?.canWrite) throw new Error('public datasource should not be writable from another org');
  });

  it('orgA 创建 private 的数据集，在 orgB 不可见', async () => {
    const created = await app.httpRequest()
      .post('/api/datasets')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgA))
      .send({ name: `priv_ds_${Date.now()}`, sourceId: dsPublicId || 1, fields: [{ identifier: 'id_0', name: 'id', type: 'INTEGER', expression: 'id', isDimension: false, isMetric: true }], visibility: 'private' })
      .expect(200);
    const id = created.body?.data?.id as number;

    const listB = await app.httpRequest()
      .get('/api/datasets')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgB))
      .expect(200);
    const items = (listB.body?.data?.list || []) as Array<Record<string, unknown>>;
    const found = items.find(x => Number(x.id as number | string | undefined) === id);
    if (found) throw new Error('non-public dataset should NOT be visible cross-org');
  });

  it('跨组织写操作应被拒绝（403 或 404）', async () => {
    const created = await app.httpRequest()
      .post('/api/dashboards')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgA))
      .send({ name: `db_${Date.now()}`, config: { components: [], settings: {} }, visibility: 'org' })
      .expect(200);
    const id = created.body?.data?.id as number;

    // Attempt update from orgB
    await app.httpRequest()
      .put(`/api/dashboards/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', String(orgB))
      .send({ name: 'hacked' })
      .expect(res => {
        if (![ 403, 404 ].includes(res.status)) {
          throw new Error(`expected 403/404, got ${res.status}`);
        }
      });
  });

  it('EDITOR 可创建仪表盘，VIEWER 不可', async () => {
    // EDITOR can create in orgA
    const created = await app.httpRequest()
      .post('/api/dashboards')
      .set('Authorization', `Bearer ${editorToken}`)
      .set('X-Org-Id', String(orgA))
      .send({ name: `db_editor_${Date.now()}`, config: { components: [], settings: {} }, visibility: 'private' })
      .expect(200);
    const id = created.body?.data?.id as number;
    // VIEWER create should be 403
    await app.httpRequest()
      .post('/api/dashboards')
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('X-Org-Id', String(orgA))
      .send({ name: `db_viewer_${Date.now()}`, config: { components: [], settings: {} }, visibility: 'private' })
      .expect(res => {
        if (res.status !== 403) throw new Error('VIEWER should not create dashboard');
      });
    // VIEWER can read list
    await app.httpRequest()
      .get('/api/dashboards')
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('X-Org-Id', String(orgA))
      .expect(200);
    // VIEWER cannot update existing
    await app.httpRequest()
      .put(`/api/dashboards/${id}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('X-Org-Id', String(orgA))
      .send({ name: 'nope' })
      .expect(res => {
        if (![ 403, 404 ].includes(res.status)) throw new Error('VIEWER should not update dashboard');
      });
  });
});
