import DingRobot, { type DingRobotProperties } from './connectors/dingRobot'
import EmailConnector, { type EmailProperties } from './connectors/email'
import TelegramConnector, { type TelegramProperties } from './connectors/telegram'
import SlackConnector, { type SlackProperties } from './connectors/slack'
import LarkConnector, { type LarkProperties } from './connectors/lark'
import DiscordConnector, { type DiscordProperties } from './connectors/discord'
import { NotifyChannel } from './types'

type NotifyConfig =
  | { type: NotifyChannel.Ding_Robot, properties: DingRobotProperties }
  | { type: NotifyChannel.Email, properties: EmailProperties }
  | { type: NotifyChannel.Telegram, properties: TelegramProperties }
  | { type: NotifyChannel.Slack, properties: SlackProperties }
  | { type: NotifyChannel.Lark, properties: LarkProperties }
  | { type: NotifyChannel.Discord, properties: DiscordProperties }

type Instance =
  | DingRobot
  | EmailConnector
  | TelegramConnector
  | SlackConnector
  | LarkConnector
  | DiscordConnector

const connectorMap = {
  [NotifyChannel.Ding_Robot]: (props: DingRobotProperties) => {
    return new DingRobot(props)
  },
  [NotifyChannel.Email]: (props: EmailProperties) => new EmailConnector(props),
  [NotifyChannel.Telegram]: (props: TelegramProperties) => new TelegramConnector(props),
  [NotifyChannel.Slack]: (props: SlackProperties) => new SlackConnector(props),
  [NotifyChannel.Lark]: (props: LarkProperties) => new LarkConnector(props),
  [NotifyChannel.Discord]: (props: DiscordProperties) => new DiscordConnector(props)
}
export const Notify = (config: NotifyConfig): Instance => {
  switch (config.type) {
    case NotifyChannel.Ding_Robot:
      return connectorMap[NotifyChannel.Ding_Robot](config.properties)
    case NotifyChannel.Email:
      return connectorMap[NotifyChannel.Email](config.properties)
    case NotifyChannel.Telegram:
      return connectorMap[NotifyChannel.Telegram](config.properties)
    case NotifyChannel.Slack:
      return connectorMap[NotifyChannel.Slack](config.properties)
    case NotifyChannel.Lark:
      return connectorMap[NotifyChannel.Lark](config.properties)
    case NotifyChannel.Discord:
      return connectorMap[NotifyChannel.Discord](config.properties)
    default:
      // @ts-expect-error 兜底保护
      throw new Error('不支持的通知类型:' + String(config.type))
  }
}

export default Notify
export { NotifyChannel } from './types'
export type { Instance, EmailProperties, TelegramProperties, SlackProperties, LarkProperties, DiscordProperties, DingRobotProperties }
