import React, { useMemo, useState } from 'react'
import { Select, Tag, Tooltip, Divider, Typography } from 'antd'
import { useAppContext, type AppOrg } from '../../context/AppContext'

const RoleTag: React.FC<{ role: string }> = ({ role }) => {
  const color = role === 'ADMIN' ? 'geekblue' : role === 'EDITOR' ? 'green' : 'default'
  return <Tag color={color}>{role}</Tag>
}

export default function OrgSwitcher () {
  const { orgs, currentOrg, switchOrg } = useAppContext()
  const [value, setValue] = useState<string | undefined>(currentOrg ? String(currentOrg.id) : undefined)

  const options = useMemo(() => (orgs || []).map((o: AppOrg) => ({
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{o.name}</span>
        <RoleTag role={o.role} />
      </div>
    ),
    value: String(o.id)
  })), [orgs])

  const onChange = (orgId: string) => {
    setValue(orgId)
    try { switchOrg(Number(orgId)) } catch {}
  }
  const current = (orgs || []).find((o: AppOrg) => String(o.id) === value) || currentOrg

  return (
    <Tooltip title={current ? `当前组织：${current.name}（${current.role}）` : '切换组织'}>
      <Select
        size="small"
        variant="borderless"
        style={{ width: '100%' }}
        loading={false}
        value={value}
        onChange={onChange}
        options={options}
        placeholder="切换组织"
        dropdownRender={menu => (
          <div>
            {menu}
            <Divider style={{ margin: '8px 0' }} />
            <div style={{ padding: '4px 8px' }}>
              <Typography.Link href="/admin/orgs">管理组织</Typography.Link>
            </div>
          </div>
        )}
      />
    </Tooltip>
  )
}
