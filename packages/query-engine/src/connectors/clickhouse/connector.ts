import { BaseConnector } from '../../baseConnector'
import type { QueryExecutionParams, QueryDataset, QueryResult } from '../../types'
import { createClient, type ClickHouseClient, type ClickHouseClientConfigOptions } from '@clickhouse/client'

export type ClickhouseConnectorConfig = ClickHouseClientConfigOptions

export class ClickhouseConnector extends BaseConnector {
  readonly type = 'clickhouse'
  protected client: ClickHouseClient

  constructor (config: ClickhouseConnectorConfig) {
    super()
    this.client = createClient(config)
  }

  protected buildLimitClause (limit: number, offset: number): string {
    return `LIMIT ${limit} OFFSET ${offset}`
  }

  protected escapeField (field: string): string {
    if (field.includes('(') || field.includes('.') || field.includes(' ')) return field
    return `\`${field}\``
  }

  async query (dataset: QueryDataset, params: QueryExecutionParams): Promise<QueryResult> {
    const sql = this.buildSQL(dataset, params)
    const start = Date.now()
    const resultSet = await this.client.query({ query: sql, format: 'JSONEachRow' })
    const rows = await resultSet.json()
    const data: Array<Record<string, unknown>> = Array.isArray(rows)
      ? (rows as Array<Record<string, unknown>>)
      : []
    // 统一：总数不受 LIMIT 影响，始终基于去除 LIMIT 的子查询统计
    let totalCount = data.length
    const countSQL = this.buildCountSQL(sql)
    const countSet = await this.client.query({ query: countSQL, format: 'JSON' })
    const countJson = (await countSet.json()) as unknown as { data?: Array<{ total_count?: number }> }
    const first = Array.isArray(countJson?.data) ? countJson.data[0] : undefined
    totalCount = typeof first?.total_count === 'number' ? first.total_count : Number((first as unknown as number) ?? 0)
    return {
      data,
      totalCount,
      executionTime: Date.now() - start,
      sql
    }
  }

  protected buildCountSQL (originalSQL: string): string {
    const withoutLimit = originalSQL
      .replace(/\s+LIMIT\s+\d+(\s+OFFSET\s+\d+)?$/i, '')
      .replace(/\s+OFFSET\s+\d+\s+ROW\s+FETCH\s+NEXT\s+\d+\s+ROW\s+ONLY$/i, '')
    return `SELECT count(*) AS total_count FROM (${withoutLimit}) AS sub`
  }

  async close (): Promise<void> {
    await this.client.close()
  }

  /**
   * 列出 ClickHouse 的 databases（等价于 schemas）
   */
  async listSchemas (): Promise<string[]> {
    const query = "SELECT name FROM system.databases WHERE name NOT IN ('system') ORDER BY name"
    const rs = await this.client.query({ query, format: 'JSONEachRow' })
    const rows = (await rs.json()) as unknown as Array<{ name: string }>
    return Array.isArray(rows) ? rows.map((r) => r.name) : []
  }

  /**
   * 列出表
   */
  async listTables (schema?: string): Promise<Array<{ schema?: string, name: string }>> {
    const where = schema
      ? `WHERE database = '${schema.replace(/'/g, "''")}'`
      : 'WHERE database NOT IN (\'system\')'
    const rs = await this.client.query({
      query: `SELECT database as schema, name FROM system.tables ${where} ORDER BY database, name`,
      format: 'JSONEachRow'
    })
    const rows = (await rs.json()) as unknown as Array<{ schema: string, name: string }>
    return Array.isArray(rows) ? rows.map((r) => ({ schema: r.schema, name: r.name })) : []
  }

  /**
   * 列出列
   */
  async listColumns (schema: string | undefined, table: string): Promise<Array<{ name: string, type: string }>> {
    const tableSafe = table.replace(/'/g, "''")
    const schemaFilter = schema ? ` AND database = '${schema.replace(/'/g, "''")}'` : ''
    const rs = await this.client.query({
      query: `SELECT name, type FROM system.columns WHERE table = '${tableSafe}'${schemaFilter} ORDER BY position`,
      format: 'JSONEachRow'
    })
    const rows = (await rs.json()) as unknown as Array<{ name: string, type: string }>
    return Array.isArray(rows) ? rows.map((r) => ({ name: r.name, type: r.type })) : []
  }
}
