# @lumina/logger

跨包可用的应用日志库：

- console + 文件轮转（按天或按大小）
- 请求上下文注入（requestId/userId/orgId）
- 生产默认 info 级别，开发默认 debug 并 pretty 输出

用法：

```ts
import { createAppLogger, runWithContext, setContext, getLogger } from '@lumina/logger';

// 在应用启动时（只初始化一次）
createAppLogger({
  file: { enabled: true, rotateBy: 'time', pattern: '1d', dir: 'logs', days: 7 },
});

// 在请求中：
runWithContext({ requestId: 'rid-123' }, () => {
  const logger = getLogger();
  setContext({ userId: 42, orgId: 7 });
  logger.info({ action: 'login' }, 'user logged in');
});
```
