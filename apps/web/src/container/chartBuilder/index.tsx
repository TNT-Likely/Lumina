// src/components/ChartBuilder/index.tsx
import React, { useEffect, useMemo } from 'react'
import { Row, Col, message, Card, Input, Button, Space, Typography, Tooltip, Divider } from 'antd'
import { EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import DataSourcePanel from './components/dataSourcePanel'
import ChartConfigPanel from './components/chartConfigPanel'
import ChartPreview from './components/chartPreview'
import AdvancedSettingsInline from '@/container/chartBuilder/components/advancedSettingsInline'
import ChartTypeSelector from './components/chartTypeSelector'
import { useChartBuilder } from './hooks/useChartBuilder'
import './index.less'
import type { ChartConfig } from './types'
const ChartBuilder: React.FC = () => {
  const {
    // 数据状态
    loading,
    datasets,
    fields,
    selectedDataset,
    chartConfig,
    showPreview,

    // 查询相关状态
    queryResult,
    queryLoading,
    sqlPreview,

    // 事件处理
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
    setChartConfig,
    setSelectedDataset,
    setFields,
    setQueryResult,
    setShowPreview,
    // 视图相关
    viewInfo,
    setViewInfo,
    loadView,
    handleSaveView
  } = useChartBuilder()

  // 页面加载时检查是否有viewId参数，如果有则加载对应的视图
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const viewId = urlParams.get('viewId')
    if (viewId) {
      loadView(parseInt(viewId, 10))
    } else {
      setViewInfo((prev) => ({
        ...prev,
        name: '',
        description: '',
        isEditing: false
      }))
    }
  }, [])

  // 首次进入时执行一次查询（当已选择数据集且配置有最少字段时）
  useEffect(() => {
    if (!selectedDataset) return
    // 最小触发条件：任意一个维度或指标存在
    if ((chartConfig.dimensions?.length || 0) > 0 || (chartConfig.metrics?.length || 0) > 0) {
      handleRunQuery()
    }
  // 仅首进触发一次
  }, [selectedDataset])

  // 稳定依赖签名：忽略 alias，仅关注 identifier/aggregation/operator/values 等关键变更
  const dimsSig = useMemo(() => (chartConfig.dimensions || []).map(d => d.field.identifier).join(','), [chartConfig.dimensions])
  const metsSig = useMemo(() => (chartConfig.metrics || []).map(m => `${m.field.identifier}__${m.aggregationType}`).join(','), [chartConfig.metrics])
  const filtersSig = useMemo(() => JSON.stringify((chartConfig.filters || []).map(f => ({ field: f.field.identifier, operator: f.operator, values: f.values }))), [chartConfig.filters])
  const orderBySig = useMemo(() => JSON.stringify(chartConfig.orderBy || []), [chartConfig.orderBy])

  // 维度/指标/筛选器变化后自动执行查询（防抖），若存在未完成的筛选器则跳过
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!selectedDataset) return
      if ((chartConfig.dimensions?.length || 0) + (chartConfig.metrics?.length || 0) === 0) return
      const requiresValue = (op: ChartConfig['filters'][0]['operator']) => (
        op === 'equals' || op === 'not_equals' || op === 'contains' || op === 'not_contains' ||
        op === 'greater_than' || op === 'less_than' || op === 'between' || op === 'in' || op === 'not_in' || op === 'like' || op === 'gt' || op === 'lt'
      )
      const hasIncompleteFilter = (chartConfig.filters || []).some(f => {
        if (!requiresValue(f.operator)) return false
        if (f.operator === 'between') return (f.values?.length ?? 0) < 2 || f.values[0] === '' || f.values[1] === ''
        return (f.values?.length ?? 0) === 0 || (f.values.length === 1 && String(f.values[0]) === '')
      })
      if (hasIncompleteFilter) return
      handleRunQuery()
    }, 380)
    return () => window.clearTimeout(timer)
  }, [selectedDataset, dimsSig, metsSig, filtersSig, orderBySig])

  // 别名变更通过 onAliasChange 回调在 ChartConfigPanel 中上抛，这里不需要额外监听

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="chart-builder">
        <div className="chart-builder-left">
          <DataSourcePanel
            datasets={datasets}
            selectedDataset={selectedDataset}
            fields={fields}
            loading={loading}
            onDatasetChange={handleDatasetChange}
          />
        </div>

        {/* 中间类型与高级设置 - 固定宽度，单卡片顶到底 */}
        <div className="chart-builder-middle">
          <div className="chart-builder-middle-content">
            <Card size="small" className="chart-middle-card" title="图表类型">
              {/* 类型选择 */}
              <ChartTypeSelector
                selectedType={chartConfig.chartType}
                onSelect={handleChartTypeChange}
                dimensions={chartConfig.dimensions}
                metrics={chartConfig.metrics}
                iconOnly
                columns={3}
              />
              <Divider className="middle-divider" />
              <div className="middle-section-title">图表设置</div>
              {/* 高级设置（内联） */}
              <AdvancedSettingsInline
                settings={chartConfig.settings || {}}
                onUpdate={handleSettingsUpdate}
                chartType={chartConfig.chartType}
              />
            </Card>
          </div>
        </div>

        {/* 右侧配置和预览区域 */}
        <div className="chart-builder-right">
          {/* 顶部配置区域 - 固定高度 */}
          <div className="chart-config-section">
            <ChartConfigPanel
              chartConfig={chartConfig}
              selectedDataset={selectedDataset}
              showPreview={showPreview}
              queryLoading={queryLoading}
              viewInfo={viewInfo}
              fields={fields}
              onFieldDrop={handleFieldDrop}
              onFieldRemove={handleFieldRemove}
              onAggregationUpdate={handleAggregationUpdate}
              onFilterUpdate={handleFilterUpdate}
              onReplaceAllFilters={(next) => {
                setChartConfig(prev => ({ ...prev, filters: next }))
              }}
              onOrderByChange={(next) => {
                setChartConfig(prev => ({ ...prev, orderBy: next }))
              }}
              onAliasChange={(draft) => {
                setChartConfig(prev => {
                  const dimMap = new Map(draft.dimensions.map(d => [d.identifier, d.alias || undefined]))
                  const metMap = new Map(draft.metrics.map(m => [`${m.identifier}__${m.aggregationType}`, m.alias || undefined]))
                  return {
                    ...prev,
                    dimensions: prev.dimensions.map(d => ({ ...d, alias: dimMap.get(d.field.identifier) || undefined })),
                    metrics: prev.metrics.map(m => ({ ...m, alias: metMap.get(`${m.field.identifier}__${m.aggregationType}`) || undefined }))
                  }
                })
              }}
              onTitleChange={handleTitleChange}
              onPreviewQuery={() => { handlePreviewQuery() }}
              onRunQuery={() => { handleRunQuery() }}
              onSaveChart={handleSaveView}
              onResetConfig={() => { handleResetConfig() }}
              onViewInfoUpdate={(values) => setViewInfo(prev => ({ ...prev, ...values }))}
            />
          </div>

          {/* 底部预览区域 - 自适应高度 */}
          <div className="chart-preview-section">
            <ChartPreview
              chartConfig={chartConfig}
              showPreview={showPreview}
              queryResult={queryResult}
              queryLoading={queryLoading}
              onExportData={() => { handleExportData() }}
              onPreviewQuery={() => { handlePreviewQuery() }}
              onRunQuery={() => { handleRunQuery() }}
              onResetConfig={() => { handleResetConfig() }}
              onSaveChart={(name?: string, desc?: string) => { handleSaveView(name, desc) }}
              isEditMode={Boolean(viewInfo?.isEditing && viewInfo?.id)}
              selectedDataset={selectedDataset}
            />
          </div>
        </div>
      </div>
    </DndProvider>
  )
}

export default ChartBuilder
