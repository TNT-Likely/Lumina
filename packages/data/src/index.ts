// src/index.ts
import { initDatabase, sequelize } from './database'
import { initializeModels } from './models'

import { viewService } from './services/view'
import { dashboardService } from './services/dashboard'
import { datasetService } from './services/dataset'
import { datasourceService } from './services/datasource'
import { notifyService } from './services/notify'
import { subscribeService } from './services/subscribe'
import { messageConsumeLogService } from './services/messageConsumeLog'
import { authService } from './services/auth'
import { rbacService } from './services/rbac'
import { orgService } from './services/org'
import { userService } from './services/user'
import { orgManagementService } from './services/orgManagement'
export { seedAdminIfNeeded } from './services/seed'
export * from './errors'
export type { ServiceContext } from './types/context'

// 由外部（server）显式调用的数据层初始化：建立连接并注册模型与关联
export const initializeData = async ( url?: string ): Promise<void> => {
  await initDatabase( url )
  // 显式初始化所有模型并设置关联
  initializeModels( sequelize )
}

// 导出所有服务
export {
  viewService,
  dashboardService,
  datasetService,
  datasourceService,
  notifyService,
  subscribeService,
  messageConsumeLogService,
  authService,
  rbacService,
  orgService,
  userService,
  orgManagementService
}

export type { OrgRole } from './models/organizationMember'
export type { DatasetField } from './models/dataset'
export type { QueryExecutionParams, DatasetServiceQueryParams } from './services/dataset'
export type { ViewServiceQueryParams } from './services/view'
// 便于在服务层之外执行少量一次性操作（如默认组织成员补偿），透出模型类型
export { Organization, OrganizationMember } from './models'
