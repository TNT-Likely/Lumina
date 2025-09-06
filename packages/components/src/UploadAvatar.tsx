import React, { useState, type CSSProperties } from 'react'
import { Upload, Avatar, Button, message } from 'antd'
import { UploadOutlined, UserOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'

interface UploadAvatarProps {
  value?: string
  onChange?: ( url?: string ) => void
  size?: number
  buttonText?: string
  // 由上层注入具体上传实现，返回文件 URL
  uploader: ( file: File ) => Promise<string>
}

const UploadAvatar: React.FC<UploadAvatarProps> = ( { value, onChange, size = 48, buttonText = '上传头像', uploader } ) => {
  const [uploading, setUploading] = useState( false )

  const props: UploadProps = {
    accept: 'image/*',
    showUploadList: false,
    customRequest: async ( options ) => {
      const { file, onSuccess, onError } = options
      setUploading( true )
      try {
        const url = await uploader( file as File )
        onChange?.( url )
        if ( onSuccess ) onSuccess( {}, new XMLHttpRequest() )
        message.success( '头像上传成功' )
      } catch ( err ) {
        if ( onError ) onError( err as Error )
        message.error( ( err as Error )?.message || '上传失败' )
      } finally {
        setUploading( false )
      }
    }
  }

  const avatarProps = value ? { src: value } : { icon: <UserOutlined /> }
  const avatarStyle: CSSProperties = { background: '#f0f2f5', border: '1px solid #eee', objectFit: 'cover' as CSSProperties['objectFit'] }
  return (
    <Upload {...props}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar size={size} {...avatarProps} style={avatarStyle} />
        <Button icon={<UploadOutlined />} loading={uploading}>{buttonText}</Button>
      </div>
    </Upload>
  )
}

export default UploadAvatar
