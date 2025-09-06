# notify 通知包

## 支持的通知渠道

- 钉钉机器人（DingTalk）
- Webhook
- Email（SMTP）
- Telegram
- 企业微信机器人（WeCom）
- Slack
- 飞书（Lark）
- Discord
- Server酱
- Bark（iOS推送）

## 快速使用

```ts
import Notify, { NotifyChannel } from './src'

// 以钉钉为例
const instance = Notify({
  type: NotifyChannel.Ding_Robot,
  properties: {
    accessToken: 'xxx',
    secret: 'xxx',
  }
})
await instance.sendText('hello')

// 以企业微信为例
const wecom = Notify({
  type: NotifyChannel.Wecom,
  properties: { key: 'your_wecom_key' }
})
await wecom.sendText('企业微信通知')

// 以 Email 为例
const email = Notify({
  type: NotifyChannel.Email,
  properties: {
    host: 'smtp.example.com',
    port: 465,
    secure: true,
    auth: { user: 'xxx', pass: 'xxx' },
    from: 'xxx@example.com',
    to: 'yyy@example.com',
  }
})
await email.sendText('邮件内容')
```

## 各渠道参数说明及申请方式

### 钉钉机器人

- 需在钉钉群设置机器人，获取 accessToken 和 secret

### Webhook

- 需有可用的 webhook 地址

### Email

- 需有 SMTP 服务、账号、密码、发件人、收件人

### Telegram

- 需创建 bot，获取 botToken 和 chatId

### 企业微信机器人

- 需在企业微信群添加机器人，获取 key

### Slack

- 需创建 Incoming Webhook，获取 webhookUrl

### 飞书

- 需创建自定义机器人，获取 webhook

### Discord

- 需创建 Webhook，获取 webhookUrl

### Server酱

- 需注册账号，获取 sendKey

### Bark

- 需安装 Bark App，获取 deviceKey，可自建服务器

## 统一接口

- `sendText(text: string)` 发送纯文本
- `sendMarkdown({ text: string })` 发送 markdown/富文本
- `test()` 发送一条测试消息

## 环境变量

- 钉钉测试群可用 `DING_TEST_TOKEN`、`DING_TEST_SECRET` 覆盖

## 扩展

如需扩展新渠道，实现 AbstractConnector 并注册到 Notify 工厂即可。
