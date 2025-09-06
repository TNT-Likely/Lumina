import { Application } from 'egg'

export default (app: Application) => {
  const { controller, router } = app
  // 全局已启用 auth 中间件；此处保留 org/admin/preview 等
  const orgScope = app.middleware.org()
  const adminOnly = app.middleware.admin()
  const previewToken = app.middleware.preview()
  const demoOnly = app.middleware.demoReadOnly()

  // 健康检查
  router.get('/health', ctx => {
    ctx.body = 'ok'
  })

  // Auth
  router.post('/api/auth/login', controller.auth.login)
  router.post('/api/auth/refresh', controller.auth.refresh)
  router.post('/api/auth/logout', controller.auth.logout)
  router.post('/api/auth/register', controller.auth.register)
  router.get('/api/auth/verify-email', controller.auth.verifyEmail)
  router.post('/api/auth/forgot-password', controller.auth.forgotPassword)
  router.post('/api/auth/reset-password', controller.auth.resetPassword)
  // 用户搜索（用于选择成员时联想）
  router.get('/api/users/search', controller.users.search)

  // 当前用户与组织
  router.get('/api/me', controller.me.profile)
  router.get('/api/orgs', controller.orgs.list)

  // 账号设置
  router.put('/api/me', demoOnly, controller.account.updateProfile)
  router.post('/api/me/change-password', demoOnly, controller.account.changePassword)

  // 通用上传（头像等）
  router.post('/api/upload', controller.upload.create)

  // 组织管理（简单起见，此处未加额外 RBAC 中间件，交由控制器内部或后续中间件处理）
  // admin 端点需要 org 作用域（无 :orgId 参数时从 header 读取）
  router.get('/api/admin/orgs', orgScope, adminOnly, controller.admin.orgs.list)
  router.post('/api/admin/orgs', orgScope, adminOnly, demoOnly, controller.admin.orgs.create)
  router.put('/api/admin/orgs/:id', orgScope, adminOnly, demoOnly, controller.admin.orgs.update)
  router.delete('/api/admin/orgs/:id', orgScope, adminOnly, demoOnly, controller.admin.orgs.destroy)

  // 组织成员管理
  router.get('/api/admin/orgs/:orgId/members', adminOnly, controller.admin.orgMembers.list)
  router.post('/api/admin/orgs/:orgId/members', adminOnly, demoOnly, controller.admin.orgMembers.add)
  router.post('/api/admin/orgs/:orgId/members:batch', adminOnly, demoOnly, controller.admin.orgMembers.addBatch)
  router.put('/api/admin/orgs/:orgId/members/:userId', adminOnly, demoOnly, controller.admin.orgMembers.updateRole)
  router.delete('/api/admin/orgs/:orgId/members/:userId', adminOnly, demoOnly, controller.admin.orgMembers.remove)

  // 邀请管理与接受
  router.get('/api/admin/orgs/:orgId/invites', adminOnly, controller.admin.orgInvites.list)
  router.post('/api/admin/orgs/:orgId/invites', adminOnly, demoOnly, controller.admin.orgInvites.create)
  router.post('/api/admin/orgs/:orgId/invites:batch', adminOnly, demoOnly, controller.admin.orgInvites.createBatch)
  router.delete('/api/admin/invites/:id', adminOnly, demoOnly, controller.admin.orgInvites.revoke)
  router.post('/api/invites/:token/accept', controller.invites.accept)

  // 分享签名
  router.post('/api/share/dashboard/sign', orgScope, controller.share.signDashboard)
  // 视图分享签名
  router.post('/api/share/view/sign', orgScope, controller.share.signView)

  // 仪表板管理
  router.get('/api/dashboards', orgScope, controller.dashboards.list)
  router.get('/api/dashboards/:id', orgScope, controller.dashboards.show)
  router.post('/api/dashboards', orgScope, demoOnly, controller.dashboards.create)
  router.put('/api/dashboards/:id', orgScope, demoOnly, controller.dashboards.update)
  router.delete('/api/dashboards/:id', orgScope, demoOnly, controller.dashboards.destroy)
  router.get('/api/dashboards/:id/config', orgScope, controller.dashboards.getConfig)

  // 视图管理
  router.get('/api/views', orgScope, controller.views.list)
  router.get('/api/views/:id', orgScope, controller.views.show)
  router.post('/api/views', orgScope, demoOnly, controller.views.create)
  router.put('/api/views/:id', orgScope, demoOnly, controller.views.update)
  router.delete('/api/views/:id', orgScope, demoOnly, controller.views.destroy)
  router.get('/api/views/:id/config', orgScope, controller.views.getConfig)
  router.get('/api/views/:id/children', orgScope, controller.views.getChildren)
  // 新增：视图数据查询
  router.post('/api/views/:id/data', orgScope, controller.views.getData)
  // 新增：视图详情（配置 + 数据集字段）
  router.get('/api/views/:id/detail', orgScope, controller.views.detail)

  // 公共预览（仅只读）：支持无登录预览 public 资源，或携带签名token预览指定资源
  // 注意：不注入 orgScope，避免默认 orgId=1 导致误判；controller 内部按 token/query 判定 orgId
  router.get('/api/public/dashboards/:id', previewToken, controller.preview.dashboard)
  router.post('/api/public/views/:id/data', previewToken, controller.preview.viewData)
  router.get('/api/public/views/:id/config', previewToken, controller.preview.viewConfig)
  // 新增：公开视图详情（配置 + 数据集字段）
  router.get('/api/public/views/:id/detail', previewToken, controller.preview.viewDetail)

  // 数据集管理
  router.get('/api/datasets', orgScope, controller.datasets.list)
  router.get('/api/datasets/:id', orgScope, controller.datasets.show)
  router.post('/api/datasets', orgScope, demoOnly, controller.datasets.create)
  router.put('/api/datasets/:id', orgScope, demoOnly, controller.datasets.update)
  router.delete('/api/datasets/:id', orgScope, demoOnly, controller.datasets.destroy)
  router.get('/api/datasets/:id/config', orgScope, controller.datasets.getConfig)
  router.post('/api/datasets/:id/query', orgScope, controller.datasets.executeQuery)
  // 获取数据集字段列表
  router.get('/api/datasets/:id/fields', orgScope, controller.datasets.fields)
  // 预览查询SQL（不执行）
  router.post('/api/datasets/:id/preview-query', orgScope, controller.datasets.previewQuery)
  // 执行数据集查询
  router.post('/api/datasets/:id/execute-query', orgScope, controller.datasets.executeQuery)
  // 字段去重取值（级联筛选所需）
  router.post('/api/datasets/:id/distinct-values', orgScope, controller.datasets.distinctValues)


  // 数据源管理
  router.get('/api/datasources', orgScope, controller.datasources.list)
  router.get('/api/datasources/:id', orgScope, controller.datasources.show)
  router.post('/api/datasources', orgScope, demoOnly, controller.datasources.create)
  router.put('/api/datasources/:id', orgScope, demoOnly, controller.datasources.update)
  router.delete('/api/datasources/:id', orgScope, demoOnly, controller.datasources.destroy)
  router.get('/api/datasources/:id/config', orgScope, controller.datasources.getConfig)
  // 数据源元数据枚举
  router.get('/api/datasources/:id/schemas', orgScope, controller.datasources.listSchemas)
  router.get('/api/datasources/:id/tables', orgScope, controller.datasources.listTables)
  router.get('/api/datasources/:id/columns', orgScope, controller.datasources.listColumns)

  // 通知管理
  router.get('/api/notifications', orgScope, controller.notifications.list)
  router.get('/api/notifications/:id', orgScope, controller.notifications.show)
  router.post('/api/notifications', orgScope, demoOnly, controller.notifications.create)
  router.put('/api/notifications/:id', orgScope, demoOnly, controller.notifications.update)
  router.post('/api/notifications/:id/test', orgScope, controller.notifications.testConnection)
  router.delete('/api/notifications/:id', orgScope, demoOnly, controller.notifications.destroy)

  // 订阅管理
  router.get('/api/subscriptions', orgScope, controller.subscriptions.list)
  router.get('/api/subscriptions/:id', orgScope, controller.subscriptions.show)
  router.post('/api/subscriptions', orgScope, demoOnly, controller.subscriptions.create)
  router.put('/api/subscriptions/:id', orgScope, demoOnly, controller.subscriptions.update)
  router.delete('/api/subscriptions/:id', orgScope, demoOnly, controller.subscriptions.destroy)
  router.post('/api/subscriptions/:id/toggle-enabled', orgScope, controller.subscriptions.toggleEnabled)
  // 订阅连通性测试
  router.post('/api/subscriptions/:id/test-connection', orgScope, controller.subscriptions.testConnection)

  // 批量权限检查
  router.post('/api/permissions:batch', orgScope, controller.permissions.batchCheck)

  // 最小日志查看（仅 admin）
  router.get('/api/admin/logs', adminOnly, controller.logs.tail)
}
