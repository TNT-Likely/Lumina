# Query Engine

Query Engine 是一个支持多种主流数据库的 TypeScript/Node.js 查询引擎，采用插件化、工厂模式设计，具备类型安全、真实连接池/客户端管理、标准化查询返回等特性。

## 特性

- 支持 MySQL、PostgreSQL、SQLite、ClickHouse、MongoDB、Oracle、MSSQL 等主流数据库
- 每种数据库均采用真实连接池/客户端管理
- notify 风格工厂入口，传 type 和 config 自动初始化 connector 并暴露统一 query 方法
- 标准化 QueryResult/QueryDataset 类型返回，便于上层处理
- 类型安全，易于扩展

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 使用示例

```ts
import { createConnector } from 'query-engine';

const mysql = createConnector({
  type: 'mysql',
  config: {
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'test',
  },
});

const result = await mysql.query('SELECT * FROM users');
console.log(result.rows);
```

支持的 type 及 config 参考 `src/types/index.ts`。

### 支持的数据库类型

- mysql
- postgresql
- sqlite
- clickhouse
- mongodb
- oracle
- mssql

### 工厂方法

```ts
const connector = createConnector({ type, config });
// connector.query(sql, params?)
```

- type: 数据库类型字符串
- config: 对应数据库的连接配置对象

### 查询返回

所有 connector 的 query 方法返回统一的 QueryResult 类型：

```ts
interface QueryResult {
  rows: QueryDataset[];
  fields?: any[];
  [key: string]: any;
}
```

## 目录结构

- src/index.ts         工厂入口，type+config 自动分发
- src/connectors/      各数据库 connector 实现
- src/types/index.ts   类型声明

## 扩展

如需扩展新数据库，只需在 connectors 目录下新增 connector，并在 index.ts 注册。

## 贡献

欢迎 issue 和 PR！

## License

MIT
