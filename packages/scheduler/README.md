# @lumina/scheduler

基于 RabbitMQ 的定时/订阅消息调度包

## 安装依赖

```sh
pnpm add amqplib
```

## 使用示例

```ts
import scheduler from '@lumina/scheduler';

// 初始化
await scheduler.init({
  mqUrl: 'amqp://localhost',
  queuePrefix: 'myapp',
});

// 发送消息（可选定时送达）
await scheduler.sendMessage({
  type: 'daily-report',
  payload: { userId: 1, content: '日报内容' },
  deliverAt: new Date(Date.now() + 60 * 1000), // 1分钟后送达
});

// 订阅消息
scheduler.subscribe({
  type: 'daily-report',
  handler: async (payload) => {
    // 处理日报
    console.log('收到日报', payload);
  },
});

// 暂停某类消息
await scheduler.pause('daily-report');

// 恢复某类消息
await scheduler.resume('daily-report');
```

## 注意事项

- 消息体建议带上时间戳，消费时可判断是否过期。
- 需保证 RabbitMQ 队列和消息持久化。
- 暂停/恢复操作基于队列绑定和消费控制实现。
