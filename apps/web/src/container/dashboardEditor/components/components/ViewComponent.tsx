import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Spin, Alert, Button, Result, Empty } from 'antd'
import { viewApi, PreviewApi } from '@lumina/api'
import type { DatasetField } from '@lumina/types'
import { ChartView, KPI, ProgressCard, DataTableCard, type DataRow } from '../../../../components/charting'
import type { BaseComponent, ViewConfig } from '../../types/dashboard'

export interface ViewComponentHandle {
  // 外部可调用：重新请求数据
  reload: () => void
  // 外部可调用：重新渲染图表（不重新请求）
  resize: () => void
}

interface ViewComponentProps {
  component: BaseComponent
  mode: 'edit' | 'preview'
  selected: boolean
  onUpdate: (updates: Partial<BaseComponent>) => void
  // 外部传入的临时筛选（例如“下钻”），由外层 toolbar 控制
  externalFilters?: Record<string, unknown>
  // 点击图表点位时，将维度值透传给外层处理（例如弹出筛选器选择）
  onPointClick?: (args: { componentId: string, dimensionValues: Record<string, string | number> }) => void
  // 图表配置可用后回调，便于外层构建高级筛选 UI
  onConfigReady?: (args: { componentId: string, dimensions: Array<{ identifier: string, name: string }>, metrics: Array<{ identifier: string, name: string }>, filters?: Array<{ field: { identifier: string, name: string }, operator: string, values: Array<string | number | boolean | null> }> }) => void
  // 若外部传入 token，则走公开接口；否则走内部接口
  publicToken?: string | null
}

// 本组件职责：
// 1) 依据视图ID与筛选器请求数据；
// 2) 将数据与图表配置拼装给 ChartView 渲染；
// 3) 通过 ref 暴露 reload/resize；
// 4) 点击事件仅透传给外部；不在组件内做下钻或修改 URL。
export const ViewComponent = React.forwardRef<ViewComponentHandle, ViewComponentProps>((props, ref) => {
  const { component, mode, externalFilters, onPointClick, onConfigReady, publicToken } = props
  const cfg = component.config as ViewConfig

  // 后端图表配置（仅随 viewId 变化而更新）
  type LocalChartConfig = import('../../../chartBuilder/types').ChartConfig
  const [chartConfig, setChartConfig] = useState<LocalChartConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [configReloadKey, setConfigReloadKey] = useState(0)

  // 查询数据
  type QueryData = { data: Array<Record<string, unknown>>; totalCount?: number; executionTime?: number }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState<QueryData>({ data: [] })

  // 本地渲染用：强制重渲染 ChartView 的 key，不触发数据请求
  const [renderKey, setRenderKey] = useState(0)

  // 接入方式：仅由外部的 publicToken 决定
  const usePublic = !!publicToken

  // 拉取图表配置：依据单一 detail 接口
  // 说明：开发模式下 React StrictMode 可能导致该 effect 执行两次，这是预期且可接受的。
  useEffect(() => {
    let alive = true
    const run = async () => {
      if (!cfg.viewId) return
      setConfigLoading(true)
      setConfigError(null)
      try {
        // 单一 detail 接口：内部与公开分别调用
        let datasetFields: DatasetField[] = []
        let viewCfg: import('@lumina/types').ViewConfig
        if (!usePublic) {
          const detail = await viewApi.getDetail(cfg.viewId)
          viewCfg = detail.config as unknown as import('@lumina/types').ViewConfig
          datasetFields = (detail.fields || []) as DatasetField[]
        } else {
          const detail = await PreviewApi.getViewDetailPublic(cfg.viewId, { token: publicToken || undefined }, { customError: true })
          const data = detail as unknown as { config?: import('@lumina/types').ViewConfig, fields?: DatasetField[] }
          viewCfg = (data?.config || {}) as import('@lumina/types').ViewConfig
          datasetFields = Array.isArray(data?.fields) ? (data.fields as DatasetField[]) : []
        }

        // 将后端的 ChartConfig(字段为 identifier) 转为 ChartView 需要的本地形态（优先使用数据集字段名）
        const toDatasetField = (ref: unknown): import('@lumina/types').DatasetField => {
          const obj = ref as { identifier: string }
          const id = obj?.identifier
          const found = datasetFields.find(f => f.identifier === id)
          if (found) return found
          return {
            identifier: id,
            name: id,
            type: 'STRING',
            expression: id,
            isDimension: true,
            isMetric: false
          }
        }
        const remote = (viewCfg as import('@lumina/types').ViewConfig).chartConfig
        const lcBase: LocalChartConfig = {
          chartType: remote.chartType,
          title: remote.title,
          dimensions: (remote.dimensions || []).map(d => ({
            field: toDatasetField(d.field as unknown as { identifier: string }),
            aggregationType: d.aggregationType,
            alias: d.alias
          })),
          metrics: (remote.metrics || []).map(m => ({
            field: toDatasetField(m.field as unknown as { identifier: string }),
            aggregationType: m.aggregationType,
            alias: m.alias
          })),
          filters: (remote.filters || []).map(f => ({
            field: toDatasetField(f.field as unknown as { identifier: string }),
            operator: f.operator as LocalChartConfig['filters'][0]['operator'],
            values: (f.values as Array<string | number | boolean>).filter(v => v !== null && v !== undefined) as LocalChartConfig['filters'][0]['values']
          })),
          settings: {
            limit: remote.settings?.limit,
            showDataLabels: remote.settings?.showDataLabels,
            showLegend: remote.settings?.showLegend,
            showGridLines: remote.settings?.showGridLines,
            colorScheme: remote.settings?.colorScheme
          }
        }
        // 兼容旧 orderBy：将 alias 或展示名转换为稳定键（维度=identifier；指标=identifier_aggregationType）
        const normalizeOrderBy = () => {
          const ob = Array.isArray(remote.orderBy) ? remote.orderBy : []
          if (!ob.length) return undefined
          return ob.map(o => {
            // 维度匹配：alias 或 identifier
            const d = lcBase.dimensions.find(dim => (dim.alias || dim.field.identifier) === o.field)
            if (d) return { field: d.field.identifier, direction: o.direction as 'asc' | 'desc' }
            // 指标匹配：alias 或 稳定键
            const m = lcBase.metrics.find(met => (met.alias || `${met.field.identifier}_${met.aggregationType}`) === o.field)
            if (m) return { field: `${m.field.identifier}_${m.aggregationType}`, direction: o.direction as 'asc' | 'desc' }
            // 保留原值（如果已经是稳定键）
            return { field: o.field as string, direction: o.direction as 'asc' | 'desc' }
          })
        }
        const lc: LocalChartConfig = { ...lcBase, orderBy: normalizeOrderBy() }
        if (alive) setChartConfig(lc)
        // 向外暴露可用于构建筛选 UI 的字段信息
        try {
          const dims = (lc.dimensions || []).map(d => ({ identifier: d.field.identifier, name: d.field.name }))
          const mets = (lc.metrics || []).map(m => ({ identifier: m.field.identifier, name: m.field.name }))
          const fs = (lc.filters || []).map(f => ({ field: { identifier: f.field.identifier, name: f.field.name }, operator: f.operator as string, values: f.values as Array<string | number | boolean | null> }))
          onConfigReady?.({ componentId: component.id, dimensions: dims, metrics: mets, filters: fs })
        } catch { /* noop */ }
      } catch (e) {
        // 友好错误提示：区分 403/404
        const err = e as { message?: string; code?: number }
        const raw = err?.message || '获取视图配置失败'
        if (alive) setConfigError(raw)
      } finally {
        if (alive) setConfigLoading(false)
      }
    }
    run()
    return () => { alive = false }
  }, [cfg.viewId, configReloadKey, publicToken])

  // 统一构造 filters 数组：
  // - 支持原有的 equals 单值
  // - 支持数组值 => operator: 'in'
  // - 支持对象值 { operator, values }
  const buildFilters = useCallback((mix: Record<string, unknown>) => {
    type FilterItem = {
      field: { identifier: string, name: string, type: string }
      operator: 'equals' | 'in' | 'between' | 'gt' | 'lt' | 'gte' | 'lte' | 'neq' | 'contains'
      values: Array<string | number | boolean | null>
    }
    const arr: FilterItem[] = []
    Object.entries(mix).forEach(([k, v]) => {
      if (v === undefined) return
      const field = { identifier: k, name: k, type: 'STRING' }
      if (Array.isArray(v)) {
        const vs = v.filter(x => x !== undefined) as Array<string | number | boolean | null>
        if (vs.length > 0) arr.push({ field, operator: 'in', values: vs })
        return
      }
      if (v && typeof v === 'object') {
        const ov = v as { operator?: string, values?: unknown }
        const operator = (ov.operator || 'equals') as FilterItem['operator']
        const valuesRaw = Array.isArray(ov.values) ? ov.values : (ov.values !== undefined ? [ov.values] : [])
        const values = (valuesRaw as Array<unknown>).filter(x => x !== undefined) as Array<string | number | boolean | null>
        if (values.length > 0) arr.push({ field, operator, values })
        return
      }
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) {
        arr.push({ field, operator: 'equals', values: [v] })
      }
    })
    return arr
  }, [])

  // 请求数据
  const loadData = useCallback(async () => {
    if (!cfg.viewId) return
    setLoading(true)
    setError(null)
    try {
      const merged = { ...(externalFilters as Record<string, unknown> || {}) }
      const filtersArray = buildFilters(merged)

      // 合并后端图表配置自带的 filters（若有）
      type FilterItem = {
        field: { identifier: string, name: string, type: string }
        operator: 'equals' | 'in' | 'between' | 'gt' | 'lt' | 'gte' | 'lte' | 'neq' | 'contains'
        values: Array<string | number | boolean | null>
      }
      const baseFilters: FilterItem[] = (chartConfig?.filters || []).map(f => ({
        field: { identifier: f.field.identifier, name: f.field.name, type: f.field.type },
        operator: f.operator as FilterItem['operator'],
        values: (f.values || []) as FilterItem['values']
      }))
      const allFilters = [...baseFilters, ...filtersArray]

      // 数据接口：遵循 publicToken 决策
      const body: Record<string, unknown> = { parameters: cfg.parameters }
      // 透传排序：按视图配置或后续编辑器扩展设置
      if (chartConfig?.orderBy && chartConfig.orderBy.length > 0) {
        body.orderBy = chartConfig.orderBy
      }
      if (allFilters.length > 0) body.filters = allFilters
      let resp
      if (!usePublic) {
        resp = await viewApi.getData(cfg.viewId, body)
      } else {
        resp = await PreviewApi.getViewDataPublic(
          cfg.viewId,
          body,
          { token: publicToken || undefined },
          { customError: true }
        )
      }
      const normalized: QueryData = Array.isArray(resp)
        ? { data: resp as Array<Record<string, unknown>> }
        : (typeof resp === 'object' && resp !== null
          ? {
            data: Array.isArray((resp as Record<string, unknown>)?.data)
              ? (resp as { data: Array<Record<string, unknown>> }).data
              : [],
            totalCount: (resp as { totalCount?: number }).totalCount,
            executionTime: (resp as { executionTime?: number }).executionTime
          }
          : { data: [] })

      setQuery(normalized)
    } catch (e) {
      const err = e as { message?: string; code?: number }
      const raw = err?.message || '加载失败'
      let friendly = raw
      if (typeof err?.code === 'number') {
        if (err.code === 403) friendly = '没有权限查看该视图'
        else if (err.code === 404) friendly = '视图不存在或已删除'
      } else if (/forbidden/i.test(raw)) friendly = '没有权限查看该视图'
      else if (/not found|不存在/i.test(raw)) friendly = '视图不存在或已删除'
      setError(friendly)
    } finally {
      setLoading(false)
    }
  }, [cfg.viewId, cfg.filters, cfg.parameters, externalFilters, buildFilters, publicToken, chartConfig, usePublic])

  // 仅在 detail 成功（chartConfig 就绪）后再拉数据，避免对不存在/无权限视图的无效请求
  useEffect(() => {
    if (!chartConfig) return
    loadData()
  }, [chartConfig, loadData])

  // 自动刷新：仅在无错误时执行；失败后停止，等待手动 reload
  useEffect(() => {
    if (!error && cfg.refreshInterval && cfg.refreshInterval > 0) {
      const t = setInterval(() => loadData(), cfg.refreshInterval * 1000)
      return () => clearInterval(t)
    }
    return () => { /* noop */ }
  }, [cfg.refreshInterval, error, loadData])

  // 向外暴露能力
  useImperativeHandle(ref, () => ({
    reload: () => { loadData() },
    resize: () => { setRenderKey((k: number) => k + 1) }
  }), [loadData])

  // 归一化行数据为基础类型，便于 ChartView 渲染稳定
  const normalizeRow = useCallback((row: Record<string, unknown>) => {
    const out: Record<string, string | number | boolean | null | undefined> = {}
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === undefined) out[k] = v as null | undefined
      else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v
      else {
        try { out[k] = JSON.stringify(v) } catch { out[k] = String(v) }
      }
    }
    return out
  }, [])

  const queryResult: { data: DataRow[]; totalCount: number; executionTime: number } = {
    data: Array.isArray(query.data) ? (query.data.map(normalizeRow) as DataRow[]) : [],
    totalCount: query.totalCount ?? (Array.isArray(query.data) ? query.data.length : 0),
    executionTime: query.executionTime ?? 0
  }

  // 点击上抛
  const handlePointClick = useCallback((payload: { dimensionValues: Record<string, string | number> }) => {
    onPointClick?.({ componentId: component.id, dimensionValues: payload.dimensionValues })
  }, [onPointClick, component.id])

  // 渲染
  if (configLoading) return <Spin size="small" style={{ margin: 16 }} />
  if (configError) {
    if (mode === 'preview') {
      const isForbidden = /没有权限|forbidden/i.test(configError)
      const isNotFound = /不存在|已删除|not found/i.test(configError)
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 360, background: 'transparent' }}>
          <div style={{ width: '100%', maxWidth: 640 }}>
            <Result
              status={isForbidden ? '403' : (isNotFound ? '404' : 'error')}
              title={isForbidden ? '暂无权限' : (isNotFound ? '未找到该视图' : '加载失败')}
              subTitle={configError}
              extra={<Button type="primary" onClick={() => setConfigReloadKey(k => k + 1)}>重试</Button>}
            />
          </div>
        </div>
      )
    }
    return <Alert type="error" message={configError} style={{ margin: 16 }} />
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Spin size="large" />
        </div>
      )}
      {!loading && error && (
        <div style={{ padding: 16 }}>
          <Alert type="error" message="加载失败" description={error} showIcon action={<Button size="small" onClick={() => { setError(null); loadData() }}>重试</Button>} />
        </div>
      )}
      {!loading && !error && chartConfig && (
        (() => {
          const data = queryResult.data
          if (data.length === 0) {
            return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Empty description="暂无数据" />
            </div>
          }

          if (chartConfig.chartType === 'kpi') {
            return <KPI config={chartConfig} data={data} style={{ width: '100%', height: '100%' }} />
          }
          if (chartConfig.chartType === 'progress') {
            return <ProgressCard config={chartConfig} data={data} style={{ width: '100%', height: '100%' }} />
          }
          if (chartConfig.chartType === 'table') {
            return (
              <DataTableCard
                config={chartConfig}
                data={data}
                totalCount={queryResult.totalCount}
                style={{ width: '100%', height: '100%' }}
                onDrillDown={(row) => {
                  if (mode !== 'preview') return
                  // 仅对已配置的维度生成下钻条件：key 使用字段 identifier，value 取该维度在行中的值
                  const dimensionValues: Record<string, string | number> = {}
                  for (const dim of chartConfig.dimensions) {
                    const keyInRow = dim.field.identifier
                    const v = (row as Record<string, unknown>)[keyInRow]
                    if (typeof v === 'string' || typeof v === 'number') {
                      dimensionValues[dim.field.identifier] = v
                    }
                  }
                  if (Object.keys(dimensionValues).length > 0) {
                    onPointClick?.({ componentId: component.id, dimensionValues })
                  }
                }}
              />
            )
          }
          return (
            <ChartView
              key={renderKey}
              chartConfig={chartConfig}
              queryResult={queryResult}
              style={{ width: '100%', height: '100%' }}
              onPointClick={mode === 'preview' ? handlePointClick : undefined}
            />
          )
        })()
      )}
    </div>
  )
})
