import { BaseConnector } from '../../baseConnector'
import type { QueryExecutionParams, QueryDataset, QueryResult } from '../../types'
import mysql, { type Pool, type PoolOptions, type PoolConnection } from 'mysql2/promise'

export type MysqlConnectorConfig = PoolOptions

/**
 * 支持自动创建和管理 mysql2/promise 连接池的 MySQL Connector
 */
export class MysqlConnector extends BaseConnector {
  protected client: PoolConnection | undefined
  readonly type = 'mysql'
  protected pool: Pool

  constructor (config: MysqlConnectorConfig) {
    super()
    // 连接池安全默认值，减少“Too many connections”
    const defaults: PoolOptions = {
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    }
    this.pool = mysql.createPool({ ...defaults, ...config })
  }

  /**
   * 可重写部分 SQL 生成方法以适配 MySQL 特性
   */
  protected buildLimitClause (limit: number, offset: number): string {
    return `LIMIT ${offset}, ${limit}`
  }

  protected escapeField (field: string): string {
    if (field.includes('(') || field.includes('.') || field.includes(' ')) return field
    return `\`${field}\``
  }

  /**
   * 标准化返回 QueryResult，自动管理连接
   */
  async query (dataset: QueryDataset, params: QueryExecutionParams): Promise<QueryResult> {
    const sql = this.buildSQL(dataset, params)
    const start = Date.now()
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query(sql)
      const data: Array<Record<string, unknown>> = Array.isArray(rows)
        ? (rows as Array<Record<string, unknown>>)
        : []
      // 统一：总数不受 LIMIT 影响，始终基于去除 LIMIT 的子查询统计
      let totalCount = data.length
      const countSQL = this.buildCountSQL(sql)
      const [countResult] = await conn.query(countSQL)
      if (Array.isArray(countResult) && countResult.length > 0) {
        const row = countResult[0] as Record<string, unknown> & { total_count?: unknown }
        const raw = row.total_count as unknown
        totalCount = typeof raw === 'number' ? raw : Number(raw ?? 0)
      } else {
        totalCount = 0
      }
      return {
        data,
        totalCount,
        executionTime: Date.now() - start,
        sql
      }
    } finally {
      conn.release()
    }
  }

  /**
   * 生成统计总数的 SQL
   */
  protected buildCountSQL (originalSQL: string): string {
    // 去掉尾部的 LIMIT 子句（支持两种写法："LIMIT offset, limit" 或 "LIMIT limit OFFSET offset"）
    const withoutLimit = originalSQL
      .replace(/\s+LIMIT\s+\d+\s*,\s*\d+\s*$/i, '')
      .replace(/\s+LIMIT\s+\d+(\s+OFFSET\s+\d+)?\s*$/i, '')
    return `SELECT COUNT(*) as total_count FROM (${withoutLimit}) as count_query`
  }

  /**
   * 关闭连接池
   */
  async close (): Promise<void> {
    await this.pool.end()
  }

  /**
   * 列出 MySQL 的 schema（数据库）
   */
  async listSchemas (): Promise<string[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query(
        "SELECT SCHEMA_NAME as name FROM information_schema.SCHEMATA WHERE SCHEMA_NAME NOT IN ('information_schema','mysql','performance_schema','sys') ORDER BY SCHEMA_NAME"
      )
      if (!Array.isArray(rows)) return []
      return (rows as Array<{ name: string }>).map(r => r.name)
    } finally {
      conn.release()
    }
  }

  /**
   * 列出指定 schema 下的表；若未传 schema，则列出当前库下的表
   */
  async listTables (schema?: string): Promise<Array<{ schema?: string, name: string }>> {
    const conn = await this.pool.getConnection()
    try {
      let sql = 'SELECT TABLE_SCHEMA as `schema`, TABLE_NAME as `name` FROM information_schema.TABLES'
      const params: unknown[] = []
      const s = (schema ?? '').trim()
      const sys = ['information_schema', 'mysql', 'performance_schema', 'sys']
      if (s) {
        sql += ' WHERE TABLE_SCHEMA = ? AND TABLE_SCHEMA NOT IN (\'information_schema\',\'mysql\',\'performance_schema\',\'sys\')'
        params.push(s)
      } else {
        sql += " WHERE TABLE_SCHEMA NOT IN ('information_schema','mysql','performance_schema','sys')"
      }
      sql += ' ORDER BY TABLE_SCHEMA, TABLE_NAME'
      const [rows] = await conn.query(sql, params)
      if (!Array.isArray(rows)) return []
      return (rows as Array<{ schema?: string, name: string }>).map(r => ({ schema: r.schema, name: r.name }))
    } finally {
      conn.release()
    }
  }

  /**
   * 列出指定表的列
   */
  async listColumns (schema: string | undefined, table: string): Promise<Array<{ name: string, type: string }>> {
    const conn = await this.pool.getConnection()
    try {
      let sql = 'SELECT COLUMN_NAME as name, DATA_TYPE as type FROM information_schema.COLUMNS WHERE TABLE_NAME = ?'
      const params: unknown[] = [table]
      if (schema) {
        sql += ' AND TABLE_SCHEMA = ?'
        params.push(schema)
      }
      sql += ' ORDER BY ORDINAL_POSITION'
      const [rows] = await conn.query(sql, params)
      if (!Array.isArray(rows)) return []
      return (rows as Array<{ name: string, type: string }>).map(r => ({ name: r.name, type: r.type }))
    } finally {
      conn.release()
    }
  }
}
