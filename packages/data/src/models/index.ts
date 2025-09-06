// src/lib/models/index.ts
import type { Sequelize } from 'sequelize'
import { Datasource, initDatasourceModel } from './datasource'
import { Dataset, initDatasetModel } from './dataset'
import { View, initViewModel } from './view'
import { Dashboard, initDashboardModel } from './dashboard'
import { Subscribe, initSubscribeModel } from './subscribe'
import { Notify, initNotifyModel } from './notify'
import { Organization, initOrganizationModel } from './organization'
import { OrganizationInvitation, initOrganizationInvitationModel } from './organizationInvitation'
import { OrganizationMember, initOrganizationMemberModel } from './organizationMember'
import { User, initUserModel } from './user'
import { AuthToken, initAuthTokenModel } from './authToken'
import { initMessageConsumeLogModel } from './messageConsumeLog'

// init 函数已通过上方合并导入

// 设置关联关系
const setupAssociations = () => {
  // Dataset 属于 Datasource
  Dataset.belongsTo( Datasource, {
    foreignKey: 'sourceId',
    as: 'source',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  } )

  // Datasource 有多个 Dataset
  Datasource.hasMany( Dataset, {
    foreignKey: 'sourceId',
    as: 'datasets',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  } )

  // View 属于 Dataset；Dataset 有多个 View
  View.belongsTo( Dataset, {
    foreignKey: 'datasetId',
    as: 'dataset',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  } )
  Dataset.hasMany( View, {
    foreignKey: 'datasetId',
    as: 'views',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  } )

  // Subscribe 属于 Dashboard；Dashboard 有多个 Subscribe
  Subscribe.belongsTo( Dashboard, {
    foreignKey: 'dashboardId',
    as: 'dashboard',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  } )
  Dashboard.hasMany( Subscribe, {
    foreignKey: 'dashboardId',
    as: 'subscribes',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  } )

  // User - Organization (memberships)
  OrganizationMember.belongsTo( Organization, { foreignKey: 'orgId', as: 'org' } )
  OrganizationMember.belongsTo( User, { foreignKey: 'userId', as: 'user' } )
  Organization.hasMany( OrganizationMember, { foreignKey: 'orgId', as: 'members' } )
  // Invitation -> Organization
  OrganizationInvitation.belongsTo( Organization, { foreignKey: 'orgId', as: 'org' } )

  // AuthToken -> User
  AuthToken.belongsTo( User, { foreignKey: 'userId', as: 'user' } )
  User.hasMany( AuthToken, { foreignKey: 'userId', as: 'tokens' } )

  // 可选：主体与组织/所有者的软关联（不在 DB 侧强制 FK，便于 include）
  const softRefOpts = { constraints: false as const }
  ;[
    { model: Datasource, name: 'datasource' },
    { model: Dataset, name: 'dataset' },
    { model: View, name: 'view' },
    { model: Dashboard, name: 'dashboard' },
    { model: Notify, name: 'notify' },
    { model: Subscribe, name: 'subscribe' }
  ].forEach( ( m ) => {
    // @ts-expect-error dynamic association
    m.model.belongsTo( Organization, { foreignKey: 'orgId', as: 'org', ...softRefOpts } )
    // @ts-expect-error dynamic association
    m.model.belongsTo( User, { foreignKey: 'ownerId', as: 'owner', ...softRefOpts } )
  } )
}

// 由外部在 initializeData() 中调用，统一完成模型初始化与关联设置
export const initializeModels = ( sequelize: Sequelize ): void => {
  // 逐一初始化各模型
  initDatasourceModel( sequelize )
  initDatasetModel( sequelize )
  initViewModel( sequelize )
  initDashboardModel( sequelize )
  initSubscribeModel( sequelize )
  initNotifyModel( sequelize )
  initOrganizationModel( sequelize )
  initOrganizationInvitationModel( sequelize )
  initOrganizationMemberModel( sequelize )
  initUserModel( sequelize )
  initAuthTokenModel( sequelize )
  initMessageConsumeLogModel( sequelize )
  // 设置关联
  setupAssociations()
}

export { View } from './view'
export { Dashboard } from './dashboard'
export { Dataset, type DatasetAttributes } from './dataset'
export { Datasource } from './datasource'
export { Notify } from './notify'
export { Subscribe } from './subscribe'
export { User } from './user'
export { Organization } from './organization'
export { OrganizationMember } from './organizationMember'
export { OrganizationInvitation } from './organizationInvitation'
export { AuthToken } from './authToken'
