import { useSearchParams } from 'react-router-dom'
import DashboardEditor from '../dashboardEditor/index'

const App = () => {
  const [searchParams] = useSearchParams()
  const id = searchParams.get('id')

  return (
    <>
      <DashboardEditor
        dashboardId={id || undefined}
        onSave={(dashboard) => {
          console.log('保存成功:', dashboard)
        }}
        onExit={() => {
          window.location.href = '/view-management'
        }}
      />
    </>
  )
}

export default App
