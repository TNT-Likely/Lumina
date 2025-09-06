import React from 'react'

export const ShortcutHint: React.FC<{ keys: string[] }> = ( { keys } ) => {
  return (
    <span style={{ opacity: 0.6 }}>
      {keys.map( ( k, i ) => (
        <kbd key={i} style={{ background: '#f5f5f5', borderRadius: 4, padding: '0 4px', marginRight: 4 }}>{k}</kbd>
      ) )}
    </span>
  )
}

export default ShortcutHint
