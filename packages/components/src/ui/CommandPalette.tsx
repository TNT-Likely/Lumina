import React, { useMemo, useState } from 'react'
import { Modal, Input, List } from 'antd'

export interface CommandAction {
  id: string
  title: string
  keywords?: string[]
  section?: string
  shortcut?: string
  run: () => void
}

export interface CommandPaletteProps {
  open: boolean
  actions: CommandAction[]
  onClose: () => void
}

const CommandPalette: React.FC<CommandPaletteProps> = ( { open, actions, onClose } ) => {
  const [q, setQ] = useState( '' )
  const filtered = useMemo( () => {
    const s = q.trim().toLowerCase()
    if ( !s ) return actions
    return actions.filter( a => a.title.toLowerCase().includes( s ) || ( a.keywords || [] ).some( k => k.toLowerCase().includes( s ) ) )
  }, [q, actions] )

  return (
    <Modal open={open} onCancel={onClose} footer={null} title="命令面板" width={600}>
      <Input placeholder="输入命令或关键词" value={q} onChange={( e ) => setQ( e.target.value )} autoFocus />
      <List
        style={{ marginTop: 12, maxHeight: 360, overflowY: 'auto' }}
        dataSource={filtered}
        renderItem={( a ) => (
          <List.Item onClick={() => { a.run(); onClose() }} style={{ cursor: 'pointer' }}>
            <List.Item.Meta title={a.title} description={a.section} />
          </List.Item>
        )}
      />
    </Modal>
  )
}

export default CommandPalette
