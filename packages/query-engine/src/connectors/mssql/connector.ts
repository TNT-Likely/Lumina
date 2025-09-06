import { BaseConnector } from '../../baseConnector'
import type { QueryExecutionParams, QueryDataset, QueryResult } from '../../types'
import mssql, { type config as MSSQLConfig, type ConnectionPool, type ConnectionPool as MSSQLPool } from 'mssql'

export type MSSQLConnectorConfig = MSSQLConfig

export class MSSQLConnector extends BaseConnector {
  protected client: MSSQLPool | undefined
  readonly type = 'mssql'
  protected pool: ConnectionPool

  constructor (config: MSSQLConnectorConfig) {
    super()
    this.pool = new mssql.ConnectionPool(config)
    this.pool.connect()
  }

  protected buildLimitClause (limit: number, offset: number): string {
    return `OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`
  }

  protected escapeField (field: string): string {
    if (field.includes('(') || field.includes('.') || field.includes(' ')) return field
    return `[${field}]`
  }

  async query (dataset: QueryDataset, params: QueryExecutionParams): Promise<QueryResult> {
    const sql = this.buildSQL(dataset, params)
    const start = Date.now()
    const result = await this.pool.request().query(sql)
    const data = (result.recordset ?? []) as Array<Record<string, unknown>>
    // 统一：总数不受 LIMIT 影响，始终基于去除 LIMIT 的子查询统计
    let totalCount = data.length
    const countSQL = this.buildCountSQL(sql)
    const countResult = await this.pool.request().query(countSQL)
    if (Array.isArray(countResult.recordset) && countResult.recordset.length > 0) {
      const row = countResult.recordset[0] as Record<string, unknown> & { total_count?: unknown }
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
  }

  protected buildCountSQL (originalSQL: string): string {
    const withoutLimit = originalSQL.replace(/\s+OFFSET\s+\d+\s+ROWS\s+FETCH\s+NEXT\s+\d+\s+ROWS\s+ONLY$/i, '')
    return `SELECT COUNT(*) as total_count FROM (${withoutLimit}) as count_query`
  }

  async close (): Promise<void> {
    await this.pool.close()
  }

  /**
   * 列出 MSSQL schemas
   */
  async listSchemas (): Promise<string[]> {
    const result = await this.pool.request().query('SELECT name FROM sys.schemas WHERE name NOT IN (\'sys\', \'INFORMATION_SCHEMA\') ORDER BY name')
    const rows = (result.recordset ?? []) as Array<{ name: string }>
    return rows.map(r => r.name)
  }

  /**
   * 列出表
   */
  async listTables (schema?: string): Promise<Array<{ schema?: string, name: string }>> {
    let sql = 'SELECT s.name as schema, t.name as name FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id'
    if (schema) sql += ' WHERE s.name = @schema'
    sql += ' ORDER BY s.name, t.name'
    const req = this.pool.request()
    if (schema) req.input('schema', mssql.NVarChar, schema)
    const result = await req.query(sql)
    const rows = (result.recordset ?? []) as Array<{ schema: string, name: string }>
    return rows.map(r => ({ schema: r.schema, name: r.name }))
  }

  /**
   * 列出列
   */
  async listColumns (schema: string | undefined, table: string): Promise<Array<{ name: string, type: string }>> {
    const req = this.pool.request()
    let sql = 'SELECT c.name as name, tp.name as type FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id JOIN sys.types tp ON c.user_type_id = tp.user_type_id JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.name = @table'
    req.input('table', mssql.NVarChar, table)
    if (schema) {
      sql += ' AND s.name = @schema'
      req.input('schema', mssql.NVarChar, schema)
    }
    sql += ' ORDER BY c.column_id'
    const result = await req.query(sql)
    const rows = (result.recordset ?? []) as Array<{ name: string, type: string }>
    return rows.map(r => ({ name: r.name, type: r.type }))
  }
}
