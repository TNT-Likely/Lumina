import { useState, useEffect, useCallback } from 'react'
import { message, Modal } from 'antd'
import {
  datasetApi,
  chartBuilderUtils,
  type ChartQueryRequest,
  type ChartQueryResult,
  type CreateViewRequest,
  type UpdateViewRequest
} from '@lumina/api'
import type { Dataset, DatasetField, FieldUsage, FilterConfig, View } from '@lumina/types'

// 图表配置接口
import { type ChartConfig } from '../types'
// import { number } from 'echarts'
// 视图信息类型
type ViewInfo = {
  id?: number
  name: string
  description: string
  isEditing: boolean
  isEditingName: boolean
  isEditingDescription: boolean
}

export const useChartBuilder = () => {
  // 全局可选 API（用于浏览器注入的预置 API）
  type GlobalApis = {
    viewApi?: {
      get?: (id: number) => Promise<View>
      update?: (id: number, data: UpdateViewRequest) => Promise<View>
      create?: (data: CreateViewRequest) => Promise<View>
    }
    datasetApi?: {
      getFields?: (id: number) => Promise<DatasetField[]>
    }
  }
  const getGlobalApis = (): GlobalApis => (window as unknown as GlobalApis)

  // 视图信息状态
  const [viewInfo, setViewInfo] = useState<ViewInfo>({
    id: 0,
    name: '',
    description: '',
    isEditing: false,
    isEditingName: false,
    isEditingDescription: false
  })
  // 视图加载
  const loadView = async (viewId: number) => {
    try {
      const winApis = getGlobalApis()
      const view = winApis.viewApi?.get
        ? await winApis.viewApi.get(viewId)
        : await import('@lumina/api').then(m => m.viewApi.get(viewId))
      if (view?.config) {
        setViewInfo({
          id: view.id,
          name: view.name || '',
          description: view.description || '',
          isEditing: true,
          isEditingName: false,
          isEditingDescription: false
        })
        let datasetFields: DatasetField[] = []
        if (view.datasetId) {
          const datasetId = Number(view.datasetId)
          setSelectedDataset(datasetId)
          try {
            const fieldsApi = getGlobalApis()
            datasetFields = fieldsApi.datasetApi?.getFields
              ? await fieldsApi.datasetApi.getFields(datasetId)
              : await import('@lumina/api').then(m => m.datasetApi.getFields(datasetId))
            setFields(datasetFields)
          } catch (error) {
            message.error('加载数据集字段失败')
          }
        }
        if (view.config.chartConfig) {
          const mergeFieldDetail = (fieldRef: { identifier: string }) => {
            return datasetFields.find(f => f.identifier === fieldRef.identifier) || { identifier: fieldRef.identifier }
          }
          type PersistedFieldRef = { identifier: string }
          type PersistedFieldUsage = { field: PersistedFieldRef, aggregationType: ChartConfig['metrics'][0]['aggregationType'], alias?: string }
          type PersistedFilter = { field: PersistedFieldRef, operator: ChartConfig['filters'][0]['operator'], values: ChartConfig['filters'][0]['values'] }
          type PartialChartCfg = Partial<Omit<ChartConfig, 'dimensions' | 'metrics' | 'filters'>> & {
            dimensions?: PersistedFieldUsage[]
            metrics?: PersistedFieldUsage[]
            filters?: PersistedFilter[]
          }
          const patchConfig = (config: PartialChartCfg): ChartConfig => {
            const dims = (config.dimensions || []).map(item => ({
              ...item,
              field: mergeFieldDetail(item.field) as unknown as DatasetField
            }))
            const mets = (config.metrics || []).map(item => ({
              ...item,
              field: mergeFieldDetail(item.field) as unknown as DatasetField
            }))
            // 兼容旧 orderBy：将 alias 或展示名转换为稳定键
            let ob = Array.isArray(config.orderBy) ? config.orderBy : undefined
            if (ob && ob.length) {
              ob = ob.map(o => {
                const byDim = dims.find(d => (d.alias || d.field.identifier) === o.field)
                if (byDim) return { field: byDim.field.identifier, direction: o.direction }
                const byMet = mets.find(m => (m.alias || `${m.field.identifier}_${m.aggregationType}`) === o.field)
                if (byMet) return { field: `${byMet.field.identifier}_${byMet.aggregationType}`, direction: o.direction }
                return o
              })
            }
            return {
              chartType: config.chartType || 'bar',
              title: config.title ?? (config.settings?.title as string | undefined),
              dimensions: dims,
              metrics: mets,
              filters: (config.filters || []).map(item => ({
                ...item,
                field: mergeFieldDetail(item.field) as unknown as DatasetField
              })),
              orderBy: ob,
              settings: {
                limit: config.settings?.limit ?? 1000,
                showDataLabels: config.settings?.showDataLabels ?? true,
                showLegend: config.settings?.showLegend ?? true,
                showGridLines: config.settings?.showGridLines ?? true,
                colorScheme: config.settings?.colorScheme ?? 'default'
              }
            }
          }
          setChartConfig(patchConfig(view.config.chartConfig))
        }
        message.success(`视图 "${view.name}" 加载成功`)
      }
    } catch (error: unknown) {
      message.error('视图加载失败: ' + (error as Error).message)
    }
  }

  // 视图保存
  const handleSaveView = async (viewName?: string, viewDescription?: string) => {
    if (!selectedDataset) {
      message.warning('请先选择数据集')
      return
    }
    const finalName = viewName || viewInfo.name
    const finalDescription = viewDescription || viewInfo.description
    if (!finalName.trim()) {
      message.warning('请输入视图名称')
      return
    }
    try {
      const minimalChartConfig = {
        ...chartConfig,
        dimensions: chartConfig.dimensions.map((item: FieldUsage) => ({ field: { identifier: item.field.identifier }, aggregationType: item.aggregationType, ...(item.alias ? { alias: item.alias } : {}) })),
        metrics: chartConfig.metrics.map((item: FieldUsage) => ({ field: { identifier: item.field.identifier }, aggregationType: item.aggregationType, ...(item.alias ? { alias: item.alias } : {}) })),
        filters: chartConfig.filters.map((item: FilterConfig) => ({ field: { identifier: item.field.identifier }, operator: item.operator, values: item.values })),
        // 冗余保存标题到 settings.title，便于旧组件读取
        settings: {
          ...chartConfig.settings,
          title: chartConfig.title
        },
        orderBy: chartConfig.orderBy && chartConfig.orderBy.length > 0 ? chartConfig.orderBy : undefined
      }
      // selectedDataset 已在上方校验存在
      const viewData: CreateViewRequest = {
        name: finalName,
        description: finalDescription,
        datasetId: Number(selectedDataset),
        config: { chartConfig: minimalChartConfig, queryResult: null }
      }
      if (viewInfo.id) {
        const winApis = getGlobalApis()
        if (winApis.viewApi?.update) {
          const updateData: UpdateViewRequest = { name: finalName, description: finalDescription, datasetId: Number(selectedDataset), config: viewData.config }
          await winApis.viewApi.update(viewInfo.id, updateData)
        } else {
          const updateData: UpdateViewRequest = { name: finalName, description: finalDescription, datasetId: Number(selectedDataset), config: viewData.config }
          if (!viewInfo.id) return
          await import('@lumina/api').then(m => m.viewApi.update(viewInfo.id as number, updateData))
        }
        message.success('视图更新成功！')
        setViewInfo(prev => ({ ...prev, name: finalName, description: finalDescription }))
      } else {
        const winApis = getGlobalApis()
        const newView = winApis.viewApi?.create
          ? await winApis.viewApi.create(viewData)
          : await import('@lumina/api').then(m => m.viewApi.create(viewData))
        message.success('视图保存成功！')
        window.history.replaceState(null, '', `?viewId=${newView.id}`)
        setViewInfo({
          id: newView.id,
          name: finalName,
          description: finalDescription,
          isEditing: true,
          isEditingName: false,
          isEditingDescription: false
        })
      }
    } catch (error: unknown) {
      message.error(`视图${viewInfo.id ? '更新' : '保存'}失败: ` + (error as Error).message)
    }
  }
  // 基础状态
  const [loading, setLoading] = useState(false)
  const [selectedDataset, setSelectedDataset] = useState<number | null>(null)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [fields, setFields] = useState<DatasetField[]>([])

  // 图表配置状态
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    chartType: 'bar',
    dimensions: [],
    metrics: [],
    filters: [],
    settings: {
      limit: 1000,
      showDataLabels: true,
      showLegend: true,
      showGridLines: true,
      colorScheme: 'default'
    }
  })

  // 查询相关状态
  const [showPreview, setShowPreview] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [queryResult, setQueryResult] = useState<ChartQueryResult | null>(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [sqlPreview, setSqlPreview] = useState<string>('')

  // 初始化数据源列表
  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        setLoading(true)
        const response = await datasetApi.list({ pageSize: 100 })
        setDatasets(response.list)
      } catch (error) {
        message.error('获取数据集列表失败')
        console.error('Failed to fetch datasets:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDatasets()
  }, [])

  // 获取数据集字段
  const fetchDatasetFields = useCallback(async (datasetId: number) => {
    try {
      setLoading(true)
      const fieldsData = await datasetApi.getFields(datasetId)
      setFields(fieldsData)
    } catch (error) {
      message.error('获取字段失败')
      console.error('Failed to fetch dataset fields:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // 处理数据集选择
  const handleDatasetChange = useCallback((datasetId: number) => {
    setSelectedDataset(datasetId)
    setChartConfig({
      chartType: 'bar',
      dimensions: [],
      metrics: [],
      filters: [],
      settings: {
        limit: 1000,
        showDataLabels: true,
        showLegend: true,
        showGridLines: true,
        colorScheme: 'default'
      }
    })
    setShowPreview(false)
    setQueryResult(null)
    setSqlPreview('')
    fetchDatasetFields(datasetId)
  }, [fetchDatasetFields])

  // 处理字段拖拽
  const handleFieldDrop = useCallback((type: 'dimensions' | 'metrics' | 'filters') =>
    (field: DatasetField) => {
      setChartConfig(prevConfig => {
        // 基于不可变更新，保证引用变更以触发依赖变更的副作用（如自动查询）
        if (type === 'dimensions') {
          const exists = prevConfig.dimensions.some(item => item.field.identifier === field.identifier)
          const next: ChartConfig['dimensions'] = exists
            ? prevConfig.dimensions
            : [...prevConfig.dimensions, { field, aggregationType: 'count' }]
          return { ...prevConfig, dimensions: next }
        }
        if (type === 'metrics') {
          const exists = prevConfig.metrics.some(item => item.field.identifier === field.identifier)
          if (exists) return prevConfig
          const defaultAgg = chartBuilderUtils.getDefaultAggregation(field)
          const next: ChartConfig['metrics'] = [...prevConfig.metrics, { field, aggregationType: defaultAgg }]
          return { ...prevConfig, metrics: next }
        }
        // filters
        const exists = prevConfig.filters.some(item => item.field.identifier === field.identifier)
        const defaultOp: ChartConfig['filters'][0]['operator'] =
          field.type === 'STRING' ? 'in' : (field.type === 'DATE' ? 'between' : 'equals')
        const next: ChartConfig['filters'] = exists
          ? prevConfig.filters
          : [...prevConfig.filters, { field, operator: defaultOp, values: [] }]
        return { ...prevConfig, filters: next }
      })
    }, [])

  // 移除字段
  const handleFieldRemove = useCallback((type: 'dimensions' | 'metrics' | 'filters') =>
    (index: number) => {
      setChartConfig(prevConfig => {
        const arr = prevConfig[type]
        if (index < 0 || index >= arr.length) return prevConfig
        const nextArr = [...arr.slice(0, index), ...arr.slice(index + 1)]
        return { ...prevConfig, [type]: nextArr } as typeof prevConfig
      })
    }, [])

  // 更新聚合类型
  const handleAggregationUpdate = useCallback((index: number, aggregation: ChartConfig['metrics'][0]['aggregationType']) => {
    setChartConfig(prevConfig => {
      if (index < 0 || index >= prevConfig.metrics.length) return prevConfig
      const nextMetrics = prevConfig.metrics.map((m, i) =>
        i === index ? { ...m, aggregationType: aggregation } : m
      )
      return { ...prevConfig, metrics: nextMetrics }
    })
  }, [])

  // 更新筛选器
  const handleFilterUpdate = useCallback((index: number, config: Partial<ChartConfig['filters'][0]>) => {
    setChartConfig(prevConfig => {
      if (index < 0 || index >= prevConfig.filters.length) return prevConfig
      const nextFilters = prevConfig.filters.map((f, i) => (i === index ? { ...f, ...config } : f))
      return { ...prevConfig, filters: nextFilters }
    })
  }, [])

  // 更新图表类型
  const handleChartTypeChange = useCallback((type: string) => {
    setChartConfig(prev => ({ ...prev, chartType: type }))
  }, [])

  // 更新图表标题
  const handleTitleChange = useCallback((title: string) => {
    setChartConfig(prev => ({ ...prev, title }))
  }, [])

  // 构建查询参数
  const buildQueryParams = useCallback((): ChartQueryRequest => {
    return {
      dimensions: chartConfig.dimensions.map(dim => ({
        field: {
          identifier: dim.field.identifier,
          name: dim.field.name,
          type: dim.field.type
        },
        alias: dim.alias
      })),
      metrics: chartConfig.metrics.map(metric => ({
        field: {
          identifier: metric.field.identifier,
          name: metric.field.name,
          type: metric.field.type
        },
        aggregationType: metric.aggregationType,
        alias: metric.alias
      })),
      filters: chartConfig.filters.map(filter => {
        const mapOp = (op: string) => {
          if (op === 'gt') return 'greater_than'
          if (op === 'lt') return 'less_than'
          if (op === 'like') return 'contains'
          return op
        }
        return {
          field: {
            identifier: filter.field.identifier,
            name: filter.field.name,
            type: String(filter.field.type)
          },
          operator: mapOp(filter.operator as string) as unknown as 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in' | 'is_null' | 'is_not_null',
          values: filter.values
        }
      }),
      orderBy: chartConfig.orderBy && chartConfig.orderBy.length > 0 ? chartConfig.orderBy : undefined,
      limit: chartConfig.settings.limit || 1000,
      offset: 0
    }
  }, [chartConfig])

  // 预览查询SQL
  const handlePreviewQuery = useCallback(async () => {
    if (!selectedDataset) {
      message.warning('请先选择数据集')
      return
    }

    const queryParams = buildQueryParams()
    const validation = chartBuilderUtils.validateChartQuery(queryParams)

    if (!validation.valid) {
      message.warning(validation.message)
      return
    }

    try {
      const response = await datasetApi.previewChartQuery(selectedDataset, queryParams)
      setSqlPreview(response.sql)

      Modal.info({
        title: '查询预览',
        content: <><div>
          <p><strong>生成的SQL:</strong></p>
          <pre style={{
            background: '#f5f5f5',
            padding: '12px',
            borderRadius: '4px',
            fontSize: '12px',
            overflow: 'auto',
            maxHeight: '300px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            {response.sql}
          </pre>
          {response.estimatedRows && (
            <p style={{ marginTop: '12px' }}>
              <strong>预估返回行数:</strong> {response.estimatedRows.toLocaleString()}
            </p>
          )}
        </div>
        </>,
        width: 800
      })
    } catch (error: unknown) {
      const err = error as { message?: string }
      message.error(`查询预览失败: ${err?.message || '未知错误'}`)
      console.error('Failed to preview query:', error)
    } finally {
      // 预览 SQL 不应影响图表 loading 状态
    }
  }, [selectedDataset, buildQueryParams])

  // 运行查询
  const handleRunQuery = useCallback(async () => {
    if (!selectedDataset) {
      message.warning('请先选择数据集')
      return
    }

    const queryParams = buildQueryParams()
    const validation = chartBuilderUtils.validateChartQuery(queryParams)

    if (!validation.valid) {
      message.warning(validation.message)
      return
    }

    try {
      setQueryLoading(true)
      const response = await datasetApi.executeChartQuery(selectedDataset, queryParams)

      setQueryResult(response)
      setShowPreview(true)

      message.success(
        `查询执行成功！耗时 ${response.executionTime}ms，返回 ${response.totalCount.toLocaleString()} 条记录`
      )
    } catch (error: unknown) {
      const err = error as { message?: string }
      message.error(`查询执行失败: ${err?.message || '未知错误'}`)
      console.error('Failed to execute query:', error)
      setQueryResult(null)
    } finally {
      setQueryLoading(false)
    }
  }, [selectedDataset, buildQueryParams])

  // 导出数据
  const handleExportData = useCallback(() => {
    if (!queryResult?.data?.length) {
      message.warning('没有可导出的数据')
      return
    }

    try {
      // 列顺序：维度 -> 指标；列标题：优先使用别名
      type Col = { key: string, title: string }
      const dimCols: Col[] = (chartConfig.dimensions || []).map(d => ({
        key: d.field.identifier,
        title: d.alias || d.field.name || d.field.identifier
      }))
      const metCols: Col[] = (chartConfig.metrics || []).map(m => ({
        key: `${m.field.identifier}_${m.aggregationType}`,
        title: m.alias || `${m.aggregationType.toUpperCase()}(${m.field.name || m.field.identifier})`
      }))
      // 补充可能存在但未在配置里的列（保持稳定）
      const existingKeys = new Set([...dimCols.map(c => c.key), ...metCols.map(c => c.key)])
      const extraCols: Col[] = Object.keys(queryResult.data[0])
        .filter(k => !existingKeys.has(k))
        .map(k => ({ key: k, title: k }))

      const cols: Col[] = [...dimCols, ...metCols, ...extraCols]

      // 生成 CSV
      const headers = cols.map(c => c.title)
      const csvContent = [
        headers.join(','),
        ...queryResult.data.map(row =>
          cols.map(c => {
            const value = row[c.key]
            const s = value == null ? '' : String(value)
            // 处理包含逗号、双引号或换行的值
            if (s.includes(',') || s.includes('\n') || s.includes('"')) {
              return `"${s.replace(/"/g, '""')}"`
            }
            return s
          }).join(',')
        )
      ].join('\n')

      // 添加BOM以支持中文
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })

      // 创建下载链接
      const link = document.createElement('a')
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', `chart_data_${Date.now()}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }

      message.success('数据导出成功！')
    } catch (error) {
      message.error('数据导出失败')
      console.error('Failed to export data:', error)
    }
  }, [queryResult])

  // 保存图表 - 这个函数现在主要用于兼容性，实际保存逻辑在主组件中
  const handleSaveChart = useCallback(() => {
    if (!queryResult) {
      message.warning('请先运行查询')
    }
    // 这个函数保留是为了兼容现有的调用，实际逻辑在主组件中处理
  }, [queryResult])

  // 更新设置
  const handleSettingsUpdate = useCallback((settings: Partial<ChartConfig['settings']>) => {
    setChartConfig(prev => {
      const next = { ...prev, settings: { ...prev.settings, ...settings } }
      if (Object.prototype.hasOwnProperty.call(settings, 'title')) {
        const t = (settings as Record<string, unknown>).title
        return { ...next, title: typeof t === 'string' ? t : prev.title }
      }
      return next
    })
  }, [])

  // 重置配置
  const handleResetConfig = useCallback(() => {
    setChartConfig({
      chartType: 'bar',
      dimensions: [],
      metrics: [],
      filters: [],
      settings: {
        limit: 1000,
        showDataLabels: true,
        showLegend: true,
        showGridLines: true,
        colorScheme: 'default'
      }
    })
    setQueryResult(null)
    setShowPreview(false)
    setSqlPreview('')
  }, [])

  return {
    // 状态
    loading,
    selectedDataset,
    datasets,
    fields,
    chartConfig, // 替换原有的 chartConfig
    showPreview,
    showAdvancedSettings,
    queryResult,
    queryLoading,
    sqlPreview,
    viewInfo,
    setViewInfo,

    // 事件处理函数
    handleDatasetChange,
    handleFieldDrop,
    handleFieldRemove,
    handleAggregationUpdate,
    handleFilterUpdate,
    handleChartTypeChange,
    handleTitleChange,
    handlePreviewQuery,
    handleRunQuery,
    handleSaveChart,
    handleSettingsUpdate,
    handleExportData,
    handleResetConfig,
    setShowAdvancedSettings,
    setChartConfig,
    setSelectedDataset,
    setFields,
    setQueryResult,
    setShowPreview,

    // 视图相关
    loadView,
    handleSaveView,

    // 工具函数
    buildQueryParams,
    validateQuery: () => chartBuilderUtils.validateChartQuery(buildQueryParams())
  }
}
