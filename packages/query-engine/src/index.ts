import { MysqlConnector, type MysqlConnectorConfig } from './connectors/mysql/connector'
import { PostgresConnector, type PostgresConnectorConfig } from './connectors/postgresql/connector'
import { ClickhouseConnector, type ClickhouseConnectorConfig } from './connectors/clickhouse/connector'
import { OracleConnector, type OracleConnectorConfig } from './connectors/oracle/connector'
import { MSSQLConnector, type MSSQLConnectorConfig } from './connectors/mssql/connector'
import { MongoDBConnector, type MongoDBConnectorConfig } from './connectors/mongodb/connector'
import { EsSearchConnector, type EsSearchConnectorConfig } from './connectors/essearch/connector'
import type { QueryExecutionParams, QueryDataset, QueryResult } from './types'
import type { BaseConnector } from './baseConnector'
export type { QueryFilter, QueryFilterGroup, FilterOperator, FilterValue } from './types'

export type QueryEngineType = 'mysql'
| 'postgresql'
| 'clickhouse'
| 'oracle'
| 'mssql'
| 'mongodb'
| 'essearch'

export type QueryEngineConnectorConfig = MysqlConnectorConfig
| PostgresConnectorConfig
| ClickhouseConnectorConfig
| OracleConnectorConfig
| MSSQLConnectorConfig
| MongoDBConnectorConfig
| EsSearchConnectorConfig

const connectorFactory: Record<QueryEngineType, (config: QueryEngineConnectorConfig) => BaseConnector> = {
  mysql: (config: QueryEngineConnectorConfig) => new MysqlConnector(config as MysqlConnectorConfig),
  postgresql: (config: QueryEngineConnectorConfig) => new PostgresConnector(config as PostgresConnectorConfig),
  clickhouse: (config: QueryEngineConnectorConfig) => new ClickhouseConnector(config as ClickhouseConnectorConfig),
  oracle: (config: QueryEngineConnectorConfig) => new OracleConnector(config as OracleConnectorConfig),
  mssql: (config: QueryEngineConnectorConfig) => new MSSQLConnector(config as MSSQLConnectorConfig),
  mongodb: (config: QueryEngineConnectorConfig) => new MongoDBConnector(config as MongoDBConnectorConfig),
  essearch: (config: QueryEngineConnectorConfig) => new EsSearchConnector(config as EsSearchConnectorConfig)
}

// 轻量缓存：跨请求复用连接器（如 MySQL 连接池）
const connectorCache = new Map<string, BaseConnector>()

function genCacheKey (type: QueryEngineType, config: QueryEngineConnectorConfig): string {
  try {
    // 尝试从常见配置项生成稳定 DSN；不同源可注入自定义 key
    const obj = config as Record<string, unknown>
    const host = String(obj.host ?? '')
    const port = String(obj.port ?? '')
    const database = String(obj.database ?? obj.db ?? '')
    const user = String(obj.user ?? obj.username ?? '')
    const extra = String(obj.key ?? '')
    return `${type}://${user}@${host}:${port}/${database}${extra ? `?k=${extra}` : ''}`
  } catch {
    return `${type}:${JSON.stringify(config)}`
  }
}

/**
 * 统一入口，传入 type 和 connector 配置，自动实例化并暴露 query 方法
 * @param type 数据源类型
 * @param config 连接参数（各 connector 的 config）
 */
export function QueryEngine (type: QueryEngineType, config: QueryEngineConnectorConfig) {
  const factory = connectorFactory[type]
  if (!factory) throw new Error('不支持的数据源类型: ' + String(type))
  const cacheKey = genCacheKey(type, config)
  let connector = connectorCache.get(cacheKey)!
  if (!connector) {
    connector = factory(config)
    connectorCache.set(cacheKey, connector)
  }
  return {
    query: async (dataset: QueryDataset, params: QueryExecutionParams): Promise<QueryResult> => await connector.query(dataset, params),
    connector
  }
}
