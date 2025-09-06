// 各种数据源 config 类型
export type MysqlConfig = { mysql: { user: string; host: string; port: number; database: string; password?: string } }
export type PostgresqlConfig = { postgresql: { user: string; host: string; port: number; database: string; password?: string } }
export type ClickhouseConfig = { clickhouse: { user: string; host: string; port: number; database: string; password?: string } }
export type SqliteConfig = { sqlite: { filename: string } }
export type MongodbConfig = { mongodb: { uri: string } }
export type OracleConfig = { oracle: { user: string; connectString: string; password?: string } }
export type MssqlConfig = { mssql: { user: string; server: string; port: number; database: string; password?: string } }
export type EssearchConfig = { essearch: { node: string; index: string; username?: string; password?: string } }

export type DatasourceConfig =
  | MysqlConfig
  | PostgresqlConfig
  | ClickhouseConfig
  | SqliteConfig
  | MongodbConfig
  | OracleConfig
  | MssqlConfig
  | EssearchConfig

export interface Datasource {
  id: number;
  name: string;
  type: string;
  config: DatasourceConfig;
  description?: string;
  // 权限相关（与后端模型对齐，可选）
  ownerId?: number;
  visibility?: 'private' | 'org' | 'public';
  canWrite?: boolean;
  canDelete?: boolean;
}
