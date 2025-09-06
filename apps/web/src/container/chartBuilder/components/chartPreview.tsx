import React from 'react'
import { Card, Typography, Empty, Spin, Button, Space, Table, Statistic, Tabs, Modal, Input, Divider } from 'antd'
import { DownloadOutlined, EyeOutlined, ReloadOutlined, FullscreenOutlined, PlayCircleOutlined, SaveOutlined } from '@ant-design/icons'
import { type ChartConfig } from '../types'
import { CHART_TYPES } from '../constants'
import { ChartView, KPI, ProgressCard, DataTableCard, type DataRow } from '../../../components/charting'
import type { ChartQueryResult as ApiChartQueryResult } from '@lumina/api'

const { Title, Text } = Typography
const { TabPane } = Tabs

type DataValue = string | number | boolean | null | undefined

interface ChartPreviewProps {
  chartConfig: ChartConfig
  showPreview: boolean
  queryResult?: ApiChartQueryResult | null
  queryLoading?: boolean
  onExportData?: () => void
  onPreviewQuery?: () => void
  onRunQuery?: () => void
  onResetConfig?: () => void
  onSaveChart?: (viewName?: string, viewDescription?: string) => void
  isEditMode?: boolean
  selectedDataset?: number | null
}
const ChartPreview: React.FC<ChartPreviewProps> = ({
  chartConfig,
  showPreview,
  queryResult,
  queryLoading = false,
  onExportData,
  onPreviewQuery,
  onRunQuery,
  onResetConfig,
  onSaveChart,
  isEditMode = false,
  selectedDataset
}) => {
  // 所有 hooks 提升到组件顶部，确保顺序稳定
  const [saveModalOpen, setSaveModalOpen] = React.useState(false)
  const [viewName, setViewName] = React.useState('')
  const [viewDescription, setViewDescription] = React.useState('')
  const [activeTab, setActiveTab] = React.useState<string>('chart')
  const [tablePagination, setTablePagination] = React.useState({ current: 1, pageSize: 50 })
  const chartHeight = 500
  const tableHeight = 500

  const hasConfiguredFields = chartConfig.dimensions.length > 0 || chartConfig.metrics.length > 0
  const canRunQuery = Boolean(selectedDataset) && hasConfiguredFields && !queryLoading

  const handleClickSave = () => {
    if (!onSaveChart) return
    if (isEditMode) {
      onSaveChart()
    } else {
      setSaveModalOpen(true)
    }
  }

  const handleConfirmSave = () => {
    if (!onSaveChart) return
    if (!viewName.trim()) {
      Modal.error({ title: '错误', content: '请输入视图名称' })
      return
    }
    onSaveChart(viewName.trim(), viewDescription)
    setSaveModalOpen(false)
    setViewName('')
    setViewDescription('')
  }
  const renderRightActions = () => (
    <Space size={8} className="preview-actions-right">
      {/* 运行查询 */}
      <Button
        type="primary"
        icon={queryLoading ? <Spin size="small" /> : <PlayCircleOutlined />}
        loading={queryLoading}
        onClick={onRunQuery}
        disabled={!canRunQuery}
        size="small"
      >
        {queryLoading ? '查询中...' : '运行查询'}
      </Button>

      {/* 预览SQL */}
      <Button
        icon={<EyeOutlined />}
        onClick={onPreviewQuery}
        disabled={!hasConfiguredFields || queryLoading}
        size="small"
      >
        预览SQL
      </Button>
      {/* 其它 */}
      {onExportData && (
        <Button icon={<DownloadOutlined />} onClick={onExportData} size="small">
          导出数据
        </Button>
      )}
      <Button
        icon={<FullscreenOutlined />}
        size="small"
        onClick={() => {
          const chartElement = document.querySelector('.chart-renderer-container') as HTMLElement | null
          if (chartElement?.requestFullscreen) {
            chartElement.requestFullscreen()
          }
        }}
      >
        全屏
      </Button>
    </Space>
  )

  const renderTitle = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Space size={8} align="center">
        <span>图表预览</span>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          ({queryResult?.totalCount.toLocaleString()} 条记录，耗时 {queryResult?.executionTime}ms)
        </Text>
      </Space>
    </div>
  )
  const normalizeRow = (row: Record<string, unknown>): DataRow => {
    const out: Record<string, DataValue> = {}
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === undefined) {
        out[k] = v as null | undefined
      } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        out[k] = v
      } else {
        // 其他类型（对象/数组/日期等）转为字符串以便渲染
        const maybeHasToISOString = v as { toISOString?: () => string }
        out[k] = typeof maybeHasToISOString.toISOString === 'function'
          ? maybeHasToISOString.toISOString()
          : String(v)
      }
    }
    return out
  }

  const renderDataTable = () => {
    if (!queryResult?.data.length) {
      return <Empty description="暂无数据" />
    }
    const columns = Object.keys(queryResult?.data[0] as Record<string, unknown>).map((key: string) => {
      // 找到对应的字段定义，用于显示友好的列名
      let title = key

      // 查找维度字段
      const dimension = chartConfig.dimensions.find((dim: ChartConfig['dimensions'][0]) =>
        dim.field.identifier === key
      )
      if (dimension) {
        title = dimension.alias || dimension.field.name
      } else {
        // 查找指标字段
        const metric = chartConfig.metrics.find((met: ChartConfig['metrics'][0]) =>
          `${met.field.identifier}_${met.aggregationType}` === key
        )
        if (metric) {
          title = metric.alias || `${metric.field.name}(${metric.aggregationType})`
        }
      }

      return {
        title,
        dataIndex: key,
        key,
        sorter: (a: DataRow, b: DataRow) => {
          const aVal = a[key]
          const bVal = b[key]
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return aVal - bVal
          }
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            const aNum = parseFloat(aVal)
            const bNum = parseFloat(bVal)
            if (!isNaN(aNum) && !isNaN(bNum)) {
              return aNum - bNum
            }
          }
          return String(aVal).localeCompare(String(bVal))
        },
        render: (value: DataValue) => {
          if (typeof value === 'number') {
            return value.toLocaleString()
          }
          if (typeof value === 'string' && !isNaN(parseFloat(value))) {
            return parseFloat(value).toLocaleString()
          }
          return value
        }
      }
    })

    const normalizedData: DataRow[] = queryResult.data.map((row) => normalizeRow(row as Record<string, unknown>))
    // 估算表头/分页占用高度，给到 scroll.y
    const headerAndPager = 112
    return (
      <Table
        columns={columns}
        dataSource={normalizedData.map((row, index) => ({ ...row, key: index }))}
        size="small"
        sticky
        scroll={{ x: true, y: Math.max(200, tableHeight - headerAndPager) }}
        pagination={{
          current: tablePagination.current,
          pageSize: tablePagination.pageSize,
          total: queryResult.data?.length,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          onChange: (page, pageSize) => {
            setTablePagination({ current: page, pageSize })
          }
        }}
      />
    )
  }

  if (!showPreview) {
    return (
      <Card
        title={renderTitle()}
        size="small"
        className="chart-preview-card"
        extra={renderRightActions()}
      >
        <Empty description="请配置图表后运行查询" />
      </Card>
    )
  }

  if (queryLoading) {
    return (
      <Card title={renderTitle()} size="small" className="chart-preview-card" extra={renderRightActions()}>
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">正在执行查询...</Text>
          </div>
        </div>
      </Card>
    )
  }

  if (!queryResult?.data.length) {
    return (
      <Card
        title={renderTitle()}
        size="small"
        className="chart-preview-card"
        extra={renderRightActions()}
      >
        <Empty description="查询未返回数据" />
      </Card>
    )
  }

  // Tabs 选中状态已提升至顶部

  return (
    <>
      <Card
        title={renderTitle()}
        size="small"
        className="chart-preview-card"
        extra={renderRightActions()}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="small"
        >
          <TabPane tab="图表视图" key="chart">
            {/* 校验维度和指标数量要求并提示 */}
            {(() => {
            // 图表类型要求配置
              const req = CHART_TYPES.find((t) => t.key === chartConfig.chartType)
              if (!req) return null
              const dimCount = chartConfig.dimensions.length
              const metCount = chartConfig.metrics.length
              const dimOk = req ? dimCount >= req.minDimensions : true
              const metOk = req ? metCount >= req.minMetrics : true
              if (!dimOk || !metOk) {
                return (
                  <div style={{ color: '#faad14', marginBottom: 8 }}>
                  ⚠️ {req?.name} 需要至少 {req?.minDimensions} 个维度、{req?.minMetrics} 个指标，当前已配置 {dimCount} 个维度、{metCount} 个指标。
                  </div>
                )
              }
              // 饼图只允许一个指标
              if (chartConfig.chartType === 'pie' && metCount > 1) {
                return (
                  <div style={{ color: '#faad14', marginBottom: 8 }}>
                  ⚠️ 饼图仅支持单一指标，已自动选用第一个指标：{chartConfig.metrics[0]?.field.name}
                  </div>
                )
              }
              // K 线图指标映射提示
              if (chartConfig.chartType === 'candlestick' && metCount === 4) {
                const [o, c, l, h] = chartConfig.metrics
                return (
                  <div style={{ color: '#8c8c8c', marginBottom: 8 }}>
                  ℹ️ K 线映射：开={o.field.name}（{o.aggregationType}）、收={c.field.name}（{c.aggregationType}）、低={l.field.name}（{l.aggregationType}）、高={h.field.name}（{h.aggregationType}）。请确认顺序为 开/收/低/高。
                  </div>
                )
              }
              return null
            })()}
            {(() => {
              const data = (queryResult?.data || []).map((row) => normalizeRow(row as Record<string, unknown>))
              // 非 ECharts 卡片类渲染
              if (chartConfig.chartType === 'kpi') {
                return <KPI config={chartConfig} data={data} style={{ height: chartHeight }} />
              }
              if (chartConfig.chartType === 'progress') {
                return <ProgressCard config={chartConfig} data={data} style={{ height: chartHeight }} />
              }
              if (chartConfig.chartType === 'table') {
                return <DataTableCard config={chartConfig} data={data} totalCount={queryResult?.totalCount} style={{ height: chartHeight }} />
              }
              // 默认 ECharts 渲染
              return (
                <div
                  className="chart-renderer-container"
                  style={{ width: '100%', height: '100%', border: '1px solid #f0f0f0', borderRadius: '4px' }}
                >
                  <ChartView
                    chartConfig={chartConfig}
                    queryResult={{
                      data,
                      totalCount: queryResult?.totalCount || 0,
                      executionTime: queryResult?.executionTime || 0
                    }}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              )
            })()}

            {/* 数据统计 */}
            {/* <div style={{ marginTop: 16 }}>
            <Space size="large">
              <Statistic
                title="总记录数"
                value={queryResult.totalCount}
                formatter={(value) => value?.toLocaleString()}
              />
              <Statistic
                title="查询耗时"
                value={queryResult.executionTime}
                suffix="ms"
              />
              <Statistic
                title="显示记录"
                value={queryResult.data.length}
                formatter={(value) => value?.toLocaleString()}
              />
            </Space>
          </div> */}

            {/* 配置信息 */}
            {/* <div style={{ marginTop: 16, fontSize: '12px', color: '#666' }}>
            <div>
              <Text type="secondary">
                <strong>维度:</strong> {chartConfig.dimensions.map((d: ChartConfig['dimensions'][0]) => d.field.name).join(', ') || '无'}
              </Text>
            </div>
            <div>
              <Text type="secondary">
                <strong>指标:</strong> {chartConfig.metrics.map((m: ChartConfig['metrics'][0]) => `${m.field.name}(${m.aggregationType})`).join(', ') || '无'}
              </Text>
            </div>
            {chartConfig.filters.length > 0 && (
              <div>
                <Text type="secondary">
                  <strong>筛选器:</strong> {chartConfig.filters.map((f: ChartConfig['filters'][0]) => `${f.field.name} ${f.operator} ${f.values.join(',')}`).join('; ')}
                </Text>
              </div>
            )}
          </div> */}
          </TabPane>

          <TabPane tab="数据表格" key="table" className="chart-preview-content">
            <div style={{ flex: 1, height: tableHeight, minHeight: 360, overflow: 'auto' }}>
              {renderDataTable()}
            </div>
          </TabPane>

          <TabPane tab="查询信息" key="query" className="chart-preview-content">
            <div style={{ flex: 1, overflow: 'auto' }}>
              <Title level={5}>执行的SQL查询</Title>
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
                {queryResult?.sql || '暂无SQL信息'}
              </pre>

              <Title level={5} style={{ marginTop: 24 }}>字段映射</Title>
              <Table
                columns={[
                  { title: '字段键（稳定）', dataIndex: 'identifier', key: 'identifier' },
                  { title: '显示名称', dataIndex: 'name', key: 'name' },
                  { title: '类型', dataIndex: 'type', key: 'type' },
                  { title: '别名', dataIndex: 'alias', key: 'alias' }
                ]}
                dataSource={[
                  ...chartConfig.dimensions.map((dim: ChartConfig['dimensions'][0]) => ({
                    identifier: dim.field.identifier,
                    name: dim.alias || dim.field.name,
                    type: '维度',
                    alias: dim.alias || ''
                  })),
                  ...chartConfig.metrics.map((metric: ChartConfig['metrics'][0]) => ({
                    identifier: `${metric.field.identifier}_${metric.aggregationType}`,
                    name: metric.alias || `${metric.field.name}(${metric.aggregationType})`,
                    type: `指标(${metric.aggregationType})`,
                    alias: metric.alias || ''
                  }))
                ]}
                size="small"
                pagination={false}
              />
            </div>
          </TabPane>
        </Tabs>
      </Card>

      {/* 新建模式保存视图模态框 */}
      <Modal
        title="保存视图"
        open={saveModalOpen}
        onOk={handleConfirmSave}
        onCancel={() => setSaveModalOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>视图名称 <span style={{ color: '#ff4d4f' }}>*</span>:</div>
          <Input
            placeholder="请输入视图名称"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
          />
        </div>
        <div>
          <div style={{ marginBottom: 8 }}>视图描述:</div>
          <Input.TextArea
            placeholder="请输入视图描述(可选)"
            value={viewDescription}
            onChange={(e) => setViewDescription(e.target.value)}
            rows={3}
          />
        </div>
      </Modal>
    </>
  )
}

export default ChartPreview
