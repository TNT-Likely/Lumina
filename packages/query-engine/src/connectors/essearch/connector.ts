/* eslint-disable indent */
import { BaseConnector } from '../../baseConnector'
import type { QueryExecutionParams, QueryDataset, QueryResult, QueryFilter, QueryFilterGroup } from '../../types'
import { Client, type ClientOptions, type estypes } from '@elastic/elasticsearch'

export interface EsSearchConnectorConfig extends ClientOptions {
  index: string
}

export class EsSearchConnector extends BaseConnector {
  readonly type = 'essearch'
  protected client: Client
  protected index: string
  private connected = false

  constructor (config: EsSearchConnectorConfig) {
    super()
    this.client = new Client(config)
    this.index = config.index
  }

  private async ensureConnected (): Promise<void> {
    if (!this.connected) {
      await this.client.ping()
      this.connected = true
    }
  }

  async query (dataset: QueryDataset, params: QueryExecutionParams): Promise<QueryResult> {
    await this.ensureConnected()
  const ds = dataset as unknown as { fields?: Array<{ identifier: string, expression: string }> }
  const fieldMap = new Map<string, string>((ds.fields || []).map(f => [f.identifier, f.expression]))
    const start = Date.now()

    const baseQuery: estypes.QueryDslQueryContainer = this.buildBoolQuery(params.filters, fieldMap) || { match_all: {} }
    const limit = params.limit ?? 1000
    const offset = params.offset ?? 0
    const hasDims = Array.isArray(params.dimensions) && params.dimensions.length > 0
    const hasMetrics = Array.isArray(params.metrics) && params.metrics.length > 0

  if (!hasDims) {
      if (!hasMetrics) {
        const esReq: estypes.SearchRequest = {
          index: this.index,
          query: baseQuery,
          size: limit,
          from: offset,
          track_total_hits: true
        }
  const result = await this.client.search<Record<string, unknown>>(esReq)
  const hits = (result.hits?.hits as Array<{ _source?: Record<string, unknown> }> | undefined) ?? []
  const data = hits.map(h => h._source ?? {})
        const total = typeof result.hits?.total === 'number' ? result.hits.total : (result.hits?.total?.value ?? data.length)
        return { data, totalCount: Number(total ?? 0), executionTime: Date.now() - start, sql: JSON.stringify(esReq) }
      }
      // 仅指标：顶层聚合
      const aggs: Record<string, estypes.AggregationsAggregationContainer> = {}
      for (const m of params.metrics) {
        const field = fieldMap.get(m.field.identifier) || m.field.identifier
        // 使用稳定键名作为聚合结果字段名，忽略前端 alias
        const alias = `${m.field.identifier}_${m.aggregationType}`
        switch (m.aggregationType) {
          case 'sum': aggs[alias] = { sum: { field } }; break
          case 'avg': aggs[alias] = { avg: { field } }; break
          case 'max': aggs[alias] = { max: { field } }; break
          case 'min': aggs[alias] = { min: { field } }; break
          case 'count': aggs[alias] = { value_count: { field } }; break
          case 'count_distinct': aggs[alias] = { cardinality: { field } }; break
          default: throw new Error(`Unsupported aggregation type: ${m.aggregationType}`)
        }
      }
      const esReq: estypes.SearchRequest = { index: this.index, query: baseQuery, size: 0, aggs }
      const result = await this.client.search<Record<string, unknown>>(esReq)
      const row: Record<string, unknown> = {}
      const aggRes = (result.aggregations ?? {}) as Record<string, estypes.AggregationsAggregate>
      for (const [k, v] of Object.entries(aggRes)) {
        const maybeVal = (v as estypes.AggregationsSumAggregate).value
        row[k] = typeof maybeVal === 'number' ? maybeVal : Number(maybeVal ?? 0)
      }
      return { data: [row], totalCount: 1, executionTime: Date.now() - start, sql: JSON.stringify(esReq) }
    }

    // 有分组：使用 composite 聚合便于分页
    const sources: estypes.AggregationsCompositeAggregation['sources'] = []
    for (const d of params.dimensions) {
      const field = fieldMap.get(d.field.identifier) || d.field.identifier
      // composite sources 的 key 也使用稳定键（identifier），不使用 alias
      const name = d.field.identifier
      sources!.push({ [name]: { terms: { field } } })
    }
    const metricsAggs: Record<string, estypes.AggregationsAggregationContainer> = {}
    for (const m of params.metrics) {
      const field = fieldMap.get(m.field.identifier) || m.field.identifier
      // 使用稳定键作为聚合名
      const alias = `${m.field.identifier}_${m.aggregationType}`
      switch (m.aggregationType) {
        case 'sum': metricsAggs[alias] = { sum: { field } }; break
        case 'avg': metricsAggs[alias] = { avg: { field } }; break
        case 'max': metricsAggs[alias] = { max: { field } }; break
        case 'min': metricsAggs[alias] = { min: { field } }; break
        case 'count': metricsAggs[alias] = { value_count: { field } }; break
        case 'count_distinct': metricsAggs[alias] = { cardinality: { field } }; break
        default: throw new Error(`Unsupported aggregation type: ${m.aggregationType}`)
      }
    }

    const pageSize = Math.min(limit + offset, 10000)
    const esReq: estypes.SearchRequest = {
      index: this.index,
      size: 0,
      query: baseQuery,
      aggs: {
        group: {
          composite: { size: pageSize, sources: sources! },
          aggs: metricsAggs
        }
      }
    }
  const result = await this.client.search<Record<string, unknown>>(esReq)
    type Bucket = { key: Record<string, unknown> } & Record<string, { value?: number }>
    const buckets = ((result.aggregations as unknown as { group?: { buckets?: Bucket[] } })?.group?.buckets) ?? []
    // 客户端排序（如需要）
    let rows = buckets.map(b => ({ ...(b.key || {}), ...Object.fromEntries(Object.keys(metricsAggs).map((k) => [k, (b[k]?.value ?? 0)]) as Array<[string, unknown]>) }))
    if (params.orderBy && params.orderBy.length > 0) {
      const { field, direction } = params.orderBy[0]
      const dir = direction === 'desc' ? -1 : 1
      rows = rows.sort((a, b) => {
        const va = (a as Record<string, unknown>)[field] as number | string
        const vb = (b as Record<string, unknown>)[field] as number | string
        if (va === vb) return 0
        return ((va as number) > (vb as number) ? 1 : -1) * dir
      })
    }
    const data = rows.slice(offset, offset + limit)

    // 估算总分组数（最多 10000）
    const countReq: estypes.SearchRequest = {
      index: this.index,
      size: 0,
      query: baseQuery,
      aggs: { group: { composite: { size: 10000, sources: sources! } } }
    }
  const countRes = await this.client.search<Record<string, unknown>>(countReq)
  const totalCount = ((((countRes.aggregations as unknown as { group?: { buckets?: unknown[] } })?.group?.buckets) ?? []).length)

    return { data, totalCount, executionTime: Date.now() - start, sql: JSON.stringify({ esReq, countReq }) }
  }

  async close (): Promise<void> {
    // ES client 无需显式关闭
  }

  public previewQuery (dataset: QueryDataset, params: QueryExecutionParams): { sql: string } {
    const ds = dataset as unknown as { fields?: Array<{ identifier: string, expression: string }> }
    const fieldMap = new Map<string, string>((ds.fields || []).map(f => [f.identifier, f.expression]))
    const esQuery: estypes.SearchRequest = {
      index: this.index,
      query: this.buildBoolQuery(params.filters, fieldMap) || { match_all: {} },
      size: params.limit ?? 1000,
      from: params.offset ?? 0
    }
    return { sql: JSON.stringify({ query: esQuery.query, size: esQuery.size, from: esQuery.from }, null, 2) }
  }

  // 元数据枚举：ES 将单集群视为单 schema，列出索引与 mapping 字段
  async listSchemas (): Promise<string[]> {
    await this.ensureConnected()
    return ['default']
  }

  async listTables (_schema?: string): Promise<Array<{ schema?: string, name: string }>> {
    await this.ensureConnected()
    const indices = await this.client.cat.indices({ format: 'json' })
    const list = (indices as unknown as Array<{ index: string }>) || []
    return list.map(i => ({ schema: 'default', name: i.index }))
  }

  async listColumns (_schema: string | undefined, table: string): Promise<Array<{ name: string, type: string }>> {
    await this.ensureConnected()
    const mapping = await this.client.indices.getMapping({ index: table })
    const cols: Array<{ name: string, type: string }> = []
    type MappingNode = { type?: string, properties?: Record<string, MappingNode> }
    const body = (mapping as unknown as Record<string, { mappings?: { properties?: Record<string, MappingNode> } }>)[table]
    const props: Record<string, MappingNode> | undefined = body?.mappings?.properties
    const walk = (node: Record<string, MappingNode>, prefix = ''): void => {
      for (const [k, v] of Object.entries(node)) {
        const name = prefix ? `${prefix}.${k}` : k
        if (v?.type) {
          cols.push({ name, type: String(v.type).toUpperCase() })
        } else if (v?.properties) {
          walk(v.properties as Record<string, MappingNode>, name)
        }
      }
    }
    if (props) walk(props)
    return cols
  }

  private buildBoolQuery (filters: QueryExecutionParams['filters'], fieldMap: Map<string, string>): estypes.QueryDslQueryContainer | undefined {
    if (!filters || (Array.isArray(filters) && filters.length === 0)) return undefined
    if (Array.isArray(filters)) {
      const must = filters.map(f => this.renderEsFilter(f as QueryFilter, fieldMap)).filter(Boolean) as estypes.QueryDslQueryContainer[]
      if (must.length === 1) return must[0]
      if (must.length > 1) return { bool: { must } }
      return undefined
    }
    return this.renderEsFilterGroup(filters as QueryFilterGroup, fieldMap)
  }

  private renderEsFilterGroup (group: QueryFilterGroup, fieldMap: Map<string, string>): estypes.QueryDslQueryContainer {
    const children = group.children || []
    const parts = children.map((c) => {
      const maybeGroup = c as QueryFilterGroup | QueryFilter
      if ((maybeGroup as QueryFilterGroup).op && Array.isArray((maybeGroup as QueryFilterGroup).children)) return this.renderEsFilterGroup(maybeGroup as QueryFilterGroup, fieldMap)
      return this.renderEsFilter(maybeGroup as QueryFilter, fieldMap)
    }).filter(Boolean) as estypes.QueryDslQueryContainer[]
    if (parts.length === 0) return { match_all: {} }
    const isOr = group.op === 'OR'
    return { bool: isOr ? { should: parts, minimum_should_match: 1 } : { must: parts } }
  }

  private renderEsFilter (filter: QueryFilter, fieldMap: Map<string, string>): estypes.QueryDslQueryContainer {
    const field = fieldMap.get(filter.field.identifier) || filter.field.identifier
    const { operator, values } = filter
    switch (operator) {
  case 'equals': return { term: { [field]: values?.[0] as string | number | boolean | null } }
  case 'not_equals': return { bool: { must_not: [{ term: { [field]: values?.[0] as string | number | boolean | null } }] } }
      case 'contains': return { wildcard: { [field]: `*${String(values?.[0] ?? '')}*` } }
      case 'not_contains': return { bool: { must_not: [{ wildcard: { [field]: `*${String(values?.[0] ?? '')}*` } }] } }
  case 'greater_than': return { range: { [field]: { gt: values?.[0] as number | string | Date } } }
  case 'less_than': return { range: { [field]: { lt: values?.[0] as number | string | Date } } }
  case 'between': return { range: { [field]: { gte: values?.[0] as number | string | Date, lte: values?.[1] as number | string | Date } } }
  case 'in': return { terms: { [field]: (Array.isArray(values) ? values : [values]) as Array<string | number | boolean> } }
  case 'not_in': return { bool: { must_not: [{ terms: { [field]: (Array.isArray(values) ? values : [values]) as Array<string | number | boolean> } }] } }
      case 'is_null': return { bool: { must_not: [{ exists: { field } }] } }
      case 'is_not_null': return { exists: { field } }
      default: throw new Error(`Unsupported filter operator: ${operator}`)
    }
  }
}
