// Create minimal orders table in test DB to support view tests
const mysql = require('mysql2/promise')

module.exports = async function ensureOrders () {
  try {
    const conn = await mysql.createConnection({ host: '127.0.0.1', port: 33306, user: 'lumina', password: 'lumina123', database: 'lumina_test' })
    await conn.execute("CREATE TABLE IF NOT EXISTS orders (id INT AUTO_INCREMENT PRIMARY KEY, sample_col VARCHAR(32) DEFAULT '') ENGINE=InnoDB")
    await conn.execute('INSERT INTO orders (sample_col) VALUES (?)', ['test'])
    await conn.end()
  } catch (e) {
    // don't throw; tests will surface any errors
    // eslint-disable-next-line no-console
    console.warn('ensureOrders helper failed:', e && e.message ? e.message : e)
  }
}
