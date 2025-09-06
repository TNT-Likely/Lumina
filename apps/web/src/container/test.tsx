import React from 'react'
import { Row, Col } from 'antd'
import { StatsCard, CrudTable } from '@lumina/components'
import { ThunderboltOutlined, DatabaseOutlined, EyeOutlined } from '@ant-design/icons'

interface DemoItem {
  id: number
  name: string
  status: string
  createdAt: string
}

const mockData: DemoItem[] = Array.from({ length: 23 }).map((_, i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
  status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'pending' : 'disabled',
  createdAt: new Date(Date.now() - i * 86400000).toISOString().slice(0, 19).replace('T', ' ')
}))

const TestPage: React.FC = () => {
  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <StatsCard
            icon={<ThunderboltOutlined />}
            title="QPS"
            value="1,284"
            subtitle="过去 5 分钟"
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <StatsCard
            icon={<DatabaseOutlined />}
            title="数据源"
            value="12"
            subtitle="已连接"
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <StatsCard
            icon={<EyeOutlined />}
            title="活跃视图"
            value="37"
            subtitle="今日"
          />
        </Col>
      </Row>

      <div style={{ height: 16 }} />

      <CrudTable<DemoItem>
        title="演示表格（固定列 anti-bleed + 搜索圆角）"
        rowKey="id"
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80, fixed: 'left' },
          { title: '名称', dataIndex: 'name', width: 200 },
          { title: '状态', dataIndex: 'status', width: 120 },
          { title: '创建时间', dataIndex: 'createdAt', width: 200 },
          { title: '描述', dataIndex: 'desc', width: 600, render: (_, r) => `这是一段关于 ${r.name} 的描述，用于测试横向滚动与固定列遮挡。` }
        ]}
        formColumns={[
          {
            title: '名称',
            dataIndex: 'name',
            valueType: 'text',
            formItemProps: { rules: [{ required: true, message: '请输入名称' }] }
          },
          {
            title: '状态',
            dataIndex: 'status',
            valueType: 'select',
            fieldProps: {
              options: [
                { label: 'active', value: 'active' },
                { label: 'pending', value: 'pending' },
                { label: 'disabled', value: 'disabled' }
              ]
            }
          }
        ]}
        operations={{
          list: async (params: { current?: number, pageSize?: number, name?: string, status?: string }) => {
            // 简单本地过滤 + 分页模拟
            const { current = 1, pageSize = 10, name, status } = params
            let rows = mockData
            if (name) rows = rows.filter(r => r.name.toLowerCase().includes(String(name).toLowerCase()))
            if (status) rows = rows.filter(r => r.status === status)
            const start = (current - 1) * pageSize
            const page = rows.slice(start, start + pageSize)
            return { data: page, total: rows.length, success: true }
          }
        }}
      />
    </div>
  )
}

export default TestPage
