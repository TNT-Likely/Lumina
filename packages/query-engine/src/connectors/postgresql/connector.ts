import { BaseConnector } from '../../baseConnector'
import type { QueryExecutionParams, QueryDataset, QueryResult } from '../../types'
import { Pool, type PoolConfig, type PoolClient } from 'pg'

export type PostgresConnectorConfig = PoolConfig

export class PostgresConnector extends BaseConnector {
  protected client: PoolClient | undefined
  readonly type = 'postgresql'
  protected pool: Pool

  constructor (config: PostgresConnectorConfig) {
    super()
    this.pool = new Pool(config)
  }

  protected buildLimitClause (limit: number, offset: number): string {
    return `LIMIT ${limit} OFFSET ${offset}`
  }

  protected escapeField (field: string): string {
    if (field.includes('(') || field.includes('.') || field.includes(' ')) return field
    return `"${field}"`
  }

  async query (dataset: QueryDataset, params: QueryExecutionParams): Promise<QueryResult> {
    const sql = this.buildSQL(dataset, params)
    const start = Date.now()
    const client = await this.pool.connect()
    try {
      const result = await client.query(sql)
      // 统一规则：总数总是基于去除 LIMIT 的子查询统计
      const countSQL = this.buildCountSQL(sql)
      const countResult = await client.query(countSQL)
      const totalCount = countResult.rows.length > 0 ? Number(countResult.rows[0].total_count ?? 0) : 0
      return {
        data: result.rows,
        totalCount,
        executionTime: Date.now() - start,
        sql
      }
    } finally {
      client.release()
    }
  }

  protected buildCountSQL (originalSQL: string): string {
    const withoutLimit = originalSQL.replace(/\s+LIMIT\s+\d+(\s+OFFSET\s+\d+)?$/i, '')
    return `SELECT COUNT(*) as total_count FROM (${withoutLimit}) as count_query`
  }

  async close (): Promise<void> {
    await this.pool.end()
  }

  /**
   * 列出 PostgreSQL schemas（命名空间）
   */
  async listSchemas (): Promise<string[]> {
    const client = await this.pool.connect()
    try {
      const sql = "SELECT nspname as name FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema' ORDER BY nspname"
      const result = await client.query(sql)
      return result.rows.map(r => r.name as string)
    } finally {
      client.release()
    }
  }

  /**
   * 列出表
   */
  async listTables (schema?: string): Promise<Array<{ schema?: string, name: string }>> {
    const client = await this.pool.connect()
    try {
      let sql = 'SELECT table_schema as schema, table_name as name FROM information_schema.tables WHERE table_type=\'BASE TABLE\''
      const params: unknown[] = []
      if (schema) {
        sql += ' AND table_schema = $1'
        params.push(schema)
      } else {
        sql += " AND table_schema NOT LIKE 'pg_%' AND table_schema <> 'information_schema'"
      }
      sql += ' ORDER BY table_schema, table_name'
      const result = await client.query(sql, params as unknown[])
      return result.rows.map(r => ({ schema: r.schema as string, name: r.name as string }))
    } finally {
      client.release()
    }
  }

  /**
   * 列出列
   */
  async listColumns (schema: string | undefined, table: string): Promise<Array<{ name: string, type: string }>> {
    const client = await this.pool.connect()
    try {
      let sql = 'SELECT column_name as name, data_type as type FROM information_schema.columns WHERE table_name = $1'
      const params: unknown[] = [table]
      if (schema) {
        sql += ' AND table_schema = $2'
        params.push(schema)
      }
      sql += ' ORDER BY ordinal_position'
      const result = await client.query(sql, params as unknown[])
      return result.rows.map(r => ({ name: r.name as string, type: r.type as string }))
    } finally {
      client.release()
    }
  }
}
