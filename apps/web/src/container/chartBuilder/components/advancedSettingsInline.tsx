// src/components/ChartBuilder/components/AdvancedSettingsInline.tsx
import React, { useEffect, useState } from 'react'
import { Row, Col, Input, Switch, Select, InputNumber, Typography, Divider } from 'antd'
import { type SettingItem } from '../types'
import { getSettingsForChartType } from '../../../components/charting/settings'

const { Text } = Typography
const { Option } = Select

// 与 ChartConfig.settings 对齐：仅 string|number|boolean|undefined
export type AdvancedSettingsState = Record<string, string | number | boolean | undefined>

type SettingValue = string | number | boolean

interface AdvancedSettingsInlineProps {
  settings: AdvancedSettingsState
  onUpdate: (settings: AdvancedSettingsState) => void
  chartType: string
}

const AdvancedSettingsInline: React.FC<AdvancedSettingsInlineProps> = ({ settings, onUpdate, chartType }) => {
  const [localSettings, setLocalSettings] = useState<AdvancedSettingsState>(settings)

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  const updateSetting = (key: string, value: SettingValue) => {
    const next = { ...localSettings, [key]: value }
    setLocalSettings(next)
    onUpdate(next)
  }

  const getItems = (): SettingItem[] => getSettingsForChartType(chartType)

  const renderControl = (setting: SettingItem) => {
    const value = (localSettings[setting.key] ?? setting.defaultValue) as string | number | boolean

    switch (setting.type) {
    case 'input':
      return (
        <Input
          placeholder={setting.placeholder}
          value={String(value)}
          onChange={(e) => updateSetting(setting.key, e.target.value)}
          size="small"
        />
      )
    case 'switch':
      return (
        <Switch
          checked={Boolean(value)}
          onChange={(checked) => updateSetting(setting.key, checked)}
          size="small"
        />
      )
    case 'select':
      return (
        <Select
          value={String(value)}
          onChange={(val: string) => updateSetting(setting.key, val)}
          size="small"
          style={{ width: '100%' }}
        >
          {setting.options?.map((opt) => (
            <Option key={opt.value} value={opt.value}>
              {opt.label}
            </Option>
          ))}
        </Select>
      )
    case 'number':
      return (
        <InputNumber
          value={Number(value)}
          onChange={(val: number | null) => { if (typeof val === 'number') updateSetting(setting.key, val) }}
          min={setting.min}
          max={setting.max}
          size="small"
          style={{ width: '100%' }}
        />
      )
    default:
      return null
    }
  }

  return (
    <div className="advanced-settings-inline">
      <Row gutter={[8, 8]}>
        {getItems().map(setting => (
          <Col span={24} key={setting.key}>
            <div className="setting-item">
              <div className="setting-label">
                <Text strong>{setting.label}</Text>
              </div>
              <div className="setting-control">
                {renderControl(setting)}
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </div>
  )
}

export default AdvancedSettingsInline
