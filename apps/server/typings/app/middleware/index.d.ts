// This file is created by egg-ts-helper@2.1.1
// Do not modify this file!!!!!!!!!
/* eslint-disable */

import 'egg';
import ExportAdmin from '../../../app/middleware/admin';
import ExportAuth from '../../../app/middleware/auth';
import ExportDemoReadOnly from '../../../app/middleware/demoReadOnly';
import ExportErrorHandler from '../../../app/middleware/errorHandler';
import ExportLoggerContext from '../../../app/middleware/loggerContext';
import ExportOrg from '../../../app/middleware/org';
import ExportPreview from '../../../app/middleware/preview';
import ExportRateLimit from '../../../app/middleware/rateLimit';

declare module 'egg' {
  interface IMiddleware {
    admin: typeof ExportAdmin;
    auth: typeof ExportAuth;
    demoReadOnly: typeof ExportDemoReadOnly;
    errorHandler: typeof ExportErrorHandler;
    loggerContext: typeof ExportLoggerContext;
    org: typeof ExportOrg;
    preview: typeof ExportPreview;
    rateLimit: typeof ExportRateLimit;
  }
}
