import { EggAppConfig, EggAppInfo, PowerPartial } from 'egg'
import path from 'path'

export default (appInfo: EggAppInfo): PowerPartial<EggAppConfig> => {
  const config = {} as PowerPartial<EggAppConfig>

  // override config from framework / plugin
  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1686101717661_4915'

  // add your egg config in here
  config.middleware = [ 'loggerContext', 'errorHandler', 'rateLimit', 'auth' ];

  // 全局 auth 配置：忽略无需鉴权的路由
  (config as unknown as { auth: { ignore: Array<string | RegExp> } }).auth = {
    ignore: [
      '/health',
      /^\/api\/auth\//,
      /^\/api\/public\//,
    ],
  }

  // 仅对 /api* 路径做限流（可按需调整）
  // 由于 egg 的类型定义未包含自定义中间件配置，这里通过 bizConfig 合并

  // add your special config in here
  const bizConfig = {
  // 如需降低 Egg 自带 logger 噪音，可在生产环境设置：
  // logger: { level: 'ERROR', consoleLevel: 'ERROR', disableConsoleAfterReady: true },
  // 并配合 logrotator 调整保留策略或关闭
  // logrotator: { enable: false },
    mocha: {
      require: [ path.join(appInfo.baseDir, 'test/.root-hooks.js') ],
    },
    static: {
      prefix: '/',
      dir: path.join(appInfo.baseDir, 'static'),
    },


    cookies: {
      sameSite: 'none',
    },

    security: {
      domainWhiteList: [ '127.0.0.1:3000', '192.168.0.10' ],
      csrf: {
        enable: process.env.NODE_ENV !== 'test',
        ignore: '/', // 测试/开发下不做严格校验
        domainWhiteList: [ '127.0.0.1:3000', '192.168.0.10' ],
      },
      xframe: {
        enable: false,
      },
    },

    // 跨域配置
    cors: {
      origin: ctx => ctx.get('origin'),
      allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS',
      credentials: true,
    },

    multipart: {
      mode: 'stream',
      fileSize: '5mb',
      whitelist: [ '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg' ],
    },

    onerror: {
      accepts() {
        return 'json'
      },
      json(error: Error, ctx) {
        // 保留原始状态码（例如鉴权失败 401），默认 500
        if (!ctx.status || ctx.status < 400) ctx.status = 500
        ctx.body = {
          success: false,
          code: ctx.status,
          message: error.message || '未知错误',
        }
      },
    },
    rateLimit: {
      enable: process.env.NODE_ENV !== 'test',
      match: /^\/api\//,
      windowMs: 60_000,
      max: 300,
    },
    demoReadOnly: {
      // 仅在设置了 DEMO_BLOCK_USER_ID 时启用，middleware 中自行判断
      enable: true,
    },
  }

  // the return config will combines to EggAppConfig
  return {
    ...config,
    ...bizConfig,
  }
}
