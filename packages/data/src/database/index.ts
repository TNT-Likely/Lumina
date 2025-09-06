// src/lib/database/index.ts
import { Sequelize } from 'sequelize'

let sequelize!: Sequelize

export const initDatabase = async ( url?: string ): Promise<void> => {
  try {
    const DATABASE_URL = url || process.env.DATABASE_URL || 'mysql://lumina:lumina123@localhost:3306/lumina'
    // 创建实例（覆盖旧实例）
    sequelize = new Sequelize( DATABASE_URL, {
      define: { timestamps: true, underscored: true },
      logging: false
    } )
    // 防呆：测试环境禁止连到 3306（默认 dev 端口）
    if ( process.env.NODE_ENV === 'test' && DATABASE_URL ) {
      try {
        const u = new URL( DATABASE_URL )
        const port = u.port || '3306'
        if ( port === '3306' ) {
          throw new Error( `Refuse to use port 3306 in test. Please point DATABASE_URL to the isolated test DB (e.g., 33306). Current: ${u.protocol}//${u.hostname}:${port}${u.pathname}` )
        }
      } catch ( e ) {
        // URL 解析失败也不放行测试环境
        throw e instanceof Error ? e : new Error( 'Invalid DATABASE_URL in test' )
      }
    }

    await sequelize.authenticate()
    // 测试环境下强制重建，避免并发/重复索引；其余环境正常 sync
    if ( process.env.NODE_ENV === 'test' ) {
      // 关闭外键检查，避免强制重建时因外键依赖导致的删除顺序错误
      try {
        await sequelize.query( 'SET FOREIGN_KEY_CHECKS = 0' )
        await sequelize.sync( { force: true } )
      } finally {
        await sequelize.query( 'SET FOREIGN_KEY_CHECKS = 1' )
      }
    } else {
      await sequelize.sync()
    }
  } catch ( error ) {
    console.error( 'Unable to connect to the database:', error )
    throw error
  }
}
export { sequelize }
