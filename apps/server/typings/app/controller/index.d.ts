// This file is created by egg-ts-helper@2.1.1
// Do not modify this file!!!!!!!!!
/* eslint-disable */

import 'egg';
import ExportAccount from '../../../app/controller/account';
import ExportAuth from '../../../app/controller/auth';
import ExportDashboards from '../../../app/controller/dashboards';
import ExportDatasets from '../../../app/controller/datasets';
import ExportDatasources from '../../../app/controller/datasources';
import ExportInvites from '../../../app/controller/invites';
import ExportLogs from '../../../app/controller/logs';
import ExportMe from '../../../app/controller/me';
import ExportNotifications from '../../../app/controller/notifications';
import ExportOrgs from '../../../app/controller/orgs';
import ExportPermissions from '../../../app/controller/permissions';
import ExportPreview from '../../../app/controller/preview';
import ExportShare from '../../../app/controller/share';
import ExportSubscriptions from '../../../app/controller/subscriptions';
import ExportUpload from '../../../app/controller/upload';
import ExportUsers from '../../../app/controller/users';
import ExportViews from '../../../app/controller/views';
import ExportAdminOrgInvites from '../../../app/controller/admin/orgInvites';
import ExportAdminOrgMembers from '../../../app/controller/admin/orgMembers';
import ExportAdminOrgs from '../../../app/controller/admin/orgs';

declare module 'egg' {
  interface IController {
    account: ExportAccount;
    auth: ExportAuth;
    dashboards: ExportDashboards;
    datasets: ExportDatasets;
    datasources: ExportDatasources;
    invites: ExportInvites;
    logs: ExportLogs;
    me: ExportMe;
    notifications: ExportNotifications;
    orgs: ExportOrgs;
    permissions: ExportPermissions;
    preview: ExportPreview;
    share: ExportShare;
    subscriptions: ExportSubscriptions;
    upload: ExportUpload;
    users: ExportUsers;
    views: ExportViews;
    admin: {
      orgInvites: ExportAdminOrgInvites;
      orgMembers: ExportAdminOrgMembers;
      orgs: ExportAdminOrgs;
    }
  }
}
