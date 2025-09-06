import React from 'react'

export interface SidebarSection {
  key: string
  title: React.ReactNode
  content: React.ReactNode
}

export interface SidebarProps {
  sections: SidebarSection[]
}

const Sidebar: React.FC<SidebarProps> = ( { sections } ) => {
  return (
    <div style={{ padding: 12 }}>
      {sections.map( ( s ) => (
        <div key={s.key} style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>{s.title}</div>
          <div>{s.content}</div>
        </div>
      ) )}
    </div>
  )
}

export default Sidebar
