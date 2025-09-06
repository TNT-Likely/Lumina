import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Table, Space, Button, message, Tooltip, Select, InputNumber, Dropdown } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { datasetApi, chartBuilderUtils, viewApi } from '@lumina/api'
import type { Dataset, DatasetField } from '@lumina/types'
import { EllipsisOutlined } from '@ant-design/icons'

type Row = Record<string, unknown>

export interface SampleDataModalProps {
  open: boolean
  dataset: Dataset | null
  onClose: () => void
}

const SampleDataModal: React.FC<SampleDataModalProps> = ({ open, dataset, onClose }) => {
  const [loading, setLoading] = useState(false)
  const [fields, setFields] = useState<DatasetField[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([])
  const [limit, setLimit] = useState<number>(50)

  const runQuery = async (ds: Dataset, fds: DatasetField[], picked: string[], lim: number) => {
    const useFields = picked.length ? fds.filter(f => picked.includes(f.identifier)) : fds
    const req: import('@lumina/api').ChartQueryRequest = {
      dimensions: useFields.map(chartBuilderUtils.fieldToDimension),
      metrics: [],
      filters: [],
      limit: lim,
      offset: 0
    }
    const res = await datasetApi.executeChartQuery(ds.id, req)
    setRows(res.data || [])
  }

  useEffect(() => {
    const load = async () => {
      if (!open || !dataset) return
      setLoading(true)
      try {
        const fds = await datasetApi.getFields(dataset.id)
        setFields(fds)
        setSelectedFieldIds([])
        if (!fds.length) {
          setRows([])
        } else {
          await runQuery(dataset, fds, [], limit)
        }
      } catch (e) {
        console.error(e)
        message.error('加载样本数据失败')
        setRows([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, dataset])

  const createFromField = async (colName: string, agg?: 'sum' | 'count' | 'avg' | 'max' | 'min' | 'count_distinct') => {
    if (!dataset) return
    try {
      const f = fields.find(x => x.name === colName) || fields[0]
      if (!f) return
      const dimensionField = f
      const metricField = fields.find(x => x.isMetric) || f
      const metricAgg = agg || chartBuilderUtils.getDefaultAggregation(metricField)
      const minimalChartConfig: import('@lumina/types').ChartConfig = {
        chartType: 'bar',
        title: `${dataset.name} - 快速视图`,
        dimensions: [{ field: { identifier: dimensionField.identifier }, aggregationType: 'count' }],
        metrics: [{ field: { identifier: metricField.identifier }, aggregationType: metricAgg }],
        filters: [],
        settings: { limit: 1000 }
      }
      const newView = await viewApi.create({
        name: `${dataset.name}视图`,
        description: '',
        datasetId: Number(dataset.id),
        config: { chartConfig: minimalChartConfig, queryResult: null }
      })
      message.success('视图已生成，正在前往编辑')
      window.location.href = `/chartBuilder?viewId=${newView.id}`
    } catch (e) {
      console.error(e)
      message.error('生成视图失败')
    }
  }

  const columns: ColumnsType<Row> = useMemo(() => {
    const names = rows.length > 0 ? Object.keys(rows[0]) : []
    return names.map(name => {
      const meta = fields.find(f => f.name === name || f.identifier === name)
      const display = meta?.name || name
      const title = (
        <Space size={4}>
          <Tooltip title={meta?.description || '无描述'}><span>{display}</span></Tooltip>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'as-dim', label: '设为维度生成图表', onClick: () => createFromField(meta?.name || name) },
                { type: 'divider' as const },
                { key: 'm-sum', label: '聚合：求和', onClick: () => createFromField(meta?.name || name, 'sum') },
                { key: 'm-count', label: '聚合：计数', onClick: () => createFromField(meta?.name || name, 'count') },
                { key: 'm-avg', label: '聚合：平均', onClick: () => createFromField(meta?.name || name, 'avg') },
                { key: 'm-max', label: '聚合：最大', onClick: () => createFromField(meta?.name || name, 'max') },
                { key: 'm-min', label: '聚合：最小', onClick: () => createFromField(meta?.name || name, 'min') }
              ]
            }}
          >
            <Button type="text" size="small" icon={<EllipsisOutlined />} onClick={e => e.stopPropagation()} />
          </Dropdown>
        </Space>
      )
      return ({ title, dataIndex: name, key: name })
    })
  }, [rows, fields])

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={onClose}
      width={'96vw'}
      style={{ top: 24, paddingBottom: 0 }}
      bodyStyle={{ paddingTop: 8, maxHeight: '82vh', overflow: 'hidden' }}
      title={dataset ? `样本数据预览 - ${dataset.name}` : '样本数据预览'}
      destroyOnClose
    >
      <Space style={{ marginBottom: 8 }} wrap>
        <span>字段</span>
        <Select
          mode="multiple"
          allowClear
          style={{ minWidth: 260 }}
          placeholder="选择要预览的字段（默认全部）"
          value={selectedFieldIds}
          onChange={setSelectedFieldIds}
          options={fields.map(f => ({ label: f.name, value: f.identifier }))}
        />
        <span>Limit</span>
        <InputNumber min={1} max={1000} value={limit} onChange={(v) => setLimit(Number(v || 1))} />
        <Button
          onClick={async () => { if (dataset) { setLoading(true); try { await runQuery(dataset, fields, selectedFieldIds, limit) } finally { setLoading(false) } } }}
          type="primary"
        >刷新</Button>
      </Space>
      <div style={{ overflow: 'auto' }}>
        <Table<Row>
          size="small"
          loading={loading}
          columns={columns}
          dataSource={rows}
          rowKey={(_, idx) => String(idx)}
          pagination={{ pageSize: 50, hideOnSinglePage: true }}
          scroll={{ x: 'max-content', y: '70vh' }}
        />
      </div>
    </Modal>
  )
}

export default SampleDataModal
