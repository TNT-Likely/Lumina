import React from 'react'
import { Typography, Space, Button, Card } from 'antd'
import { Link } from 'react-router-dom'
import { DatabaseOutlined, HddOutlined, DashboardOutlined } from '@ant-design/icons'

const { Title, Paragraph, Text } = Typography

const Guide: React.FC = () => {
  return (
    <div>
      <Typography>
        <Title level={3} style={{ marginTop: 8 }}>欢迎使用 Lumina</Title>
        <Paragraph type="secondary">按照下面 3 步，快速上手从数据到图表，再到仪表盘。</Paragraph>
      </Typography>

      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Card>
          <Space align="start">
            <div style={{ width: 40, display: 'flex', justifyContent: 'center' }}><DatabaseOutlined /></div>
            <div>
              <Title level={4} style={{ margin: 0 }}>第 1 步：连接数据源</Title>
              <Paragraph type="secondary" style={{ marginTop: 6 }}>支持 MySQL、PostgreSQL、ClickHouse、MongoDB、Elasticsearch、Oracle、SQL Server 等。</Paragraph>
              <Link to="/dataSource/list"><Button type="primary">前往数据源</Button></Link>
            </div>
          </Space>
        </Card>

        <Card>
          <Space align="start">
            <div style={{ width: 40, display: 'flex', justifyContent: 'center' }}><HddOutlined /></div>
            <div>
              <Title level={4} style={{ margin: 0 }}>第 2 步：创建数据集</Title>
              <Paragraph type="secondary" style={{ marginTop: 6 }}>从表一键生成数据集或自定义字段与指标，作为图表的数据基础。</Paragraph>
              <Link to="/dataset/list"><Button>前往数据集</Button></Link>
            </div>
          </Space>
        </Card>

        <Card>
          <Space align="start">
            <div style={{ width: 40, display: 'flex', justifyContent: 'center' }}><DashboardOutlined /></div>
            <div>
              <Title level={4} style={{ margin: 0 }}>第 3 步：创建视图与仪表盘</Title>
              <Paragraph type="secondary" style={{ marginTop: 6 }}>用图表构建洞察视图，并将多个视图组合到仪表盘中进行分享与订阅。</Paragraph>
              <Space>
                <Link to="/view/list"><Button>前往视图</Button></Link>
                <Link to="/dashboard/list"><Button>前往仪表盘</Button></Link>
              </Space>
            </div>
          </Space>
        </Card>
      </Space>
    </div>
  )
}

export default Guide
