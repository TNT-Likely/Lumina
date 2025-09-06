import { EggAppConfig, PowerPartial } from 'egg'

export default () => {
  const config: PowerPartial<EggAppConfig> = {
    logger: {
      level: 'ERROR',
      consoleLevel: 'ERROR',
      disableConsoleAfterReady: true,
    },
    logrotator: {
      enable: false,
    },
  }

  return config
}
