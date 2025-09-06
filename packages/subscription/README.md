
# @lumina/subscription

基于消息队列的分布式订阅调度包，依赖 @lumina/scheduler、cron-parser、cron。

## 主要功能

- 启动时批量调度所有订阅（延迟消息，无本地定时器压力）
- 支持动态立即执行/下次执行
- 支持定时巡检，自动补发丢失消息
- 消费完成后自动调度下一个周期
- 订阅管理（启停、重发、查状态）

## 推荐用法

```ts
import {
  scheduleAllSubscriptions,
  startSubscriptionInspector,
  sendSubscriptionNow,
  sendSubscriptionNext
} from '@lumina/subscription'

// 1. 启动时批量调度所有订阅（自动获取并调度下一次）
await scheduleAllSubscriptions()

// 2. 启动定时巡检任务（每10分钟自动补发丢失消息）
const stop = startSubscriptionInspector()
// 需要时调用 stop() 停止巡检

// 3. 发送某个订阅消息（立即/下一次）
await sendSubscriptionNow(subscriptionId)   // 立即发送
await sendSubscriptionNext(subscriptionId)  // 按下次调度时间发送
```

## API 说明

- `scheduleAllSubscriptions()`：批量调度所有订阅（自动获取订阅并调度下一次）
- `startSubscriptionInspector()`：启动定时巡检任务，自动补发丢失消息，返回 stop 函数
- `sendSubscriptionNow(subscriptionId)`：立即发送某个订阅
- `sendSubscriptionNext(subscriptionId)`：按下次调度时间发送某个订阅
- `inspectAllSubscriptions()`：手动触发一次巡检，返回补发/正常结果

## 说明

- 订阅数据建议通过 @lumina/data 的 subscribeService 获取
- 消费端会自动判断订阅状态，已关闭/删除的消息不会被处理
- 消费完成后自动调度下一个周期，无需本地定时器
- 巡检机制基于消费日志，自动补发丢失消息，支持多实例高可用
