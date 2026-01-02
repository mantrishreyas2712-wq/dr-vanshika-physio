const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');

// Determine DB Type
const IS_POSTGRES = !!process.env.DATABASE_URL;
const DB_PATH = path.join(__dirname, 'physiotherapy.db');

let db; // SQLite instance
let pool; // Postgres pool

// Initialize database
function initDatabase() {
    return new Promise(async (resolve, reject) => {
        if (IS_POSTGRES) {
            console.log('Initializing PostgreSQL connection...');
            pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false } // Required for Neon/Render
            });

            try {
                const client = await pool.connect();
                console.log('Connected to PostgreSQL database');
                await createTablesPostgres(client);
                client.release();
                resolve();
            } catch (err) {
                reject(err);
            }
        } else {
            console.log('Initializing SQLite connection...');
            db = new sqlite3.Database(DB_PATH, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                console.log('Connected to SQLite database');
                createTablesSqlite(db).then(resolve).catch(reject);
            });
        }
    });
}

// ------ SQLite Helpers ------
function createTablesSqlite(db) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`
                CREATE TABLE IF NOT EXISTS appointments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    date TEXT NOT NULL,
                    time TEXT NOT NULL,
                    service TEXT NOT NULL,
                    notes TEXT,
                    status TEXT DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS admin_users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, async (err) => {
                if (err) return reject(err);
                await seedAdmin();
                resolve();
            });
        });
    });
}

// ------ Postgres Helpers ------
async function createTablesPostgres(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS appointments (
            id SERIAL PRIMARY KEY,
            patient_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            service TEXT NOT NULL,
            notes TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await seedAdmin();
}

async function seedAdmin() {
    const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';

    // Check and Insert logic is abstracted in specific functions, 
    // but for seeding we can just use the public API or direct queries.
    // To allow reuse, let's just use the 'getAdminByUsername' and insert if null.
    // However, since db/pool might be set, we can't easily mix. 
    // Let's implement specific seed logic.

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    if (IS_POSTGRES) {
        const res = await pool.query('SELECT * FROM admin_users WHERE username = $1', [defaultUsername]);
        if (res.rows.length === 0) {
            await pool.query('INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)', [defaultUsername, hashedPassword]);
            console.log(`Default admin created (PG) - Username: ${defaultUsername}`);
        }
    } else {
        db.get('SELECT * FROM admin_users WHERE username = ?', [defaultUsername], (err, row) => {
            if (!row) {
                db.run('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', [defaultUsername, hashedPassword]);
                console.log(`Default admin created (SQLite) - Username: ${defaultUsername}`);
            }
        });
    }
}

// ------ API Abstractions ------

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (IS_POSTGRES) {
            // Convert ? to $1, $2 etc.
            let paramIndex = 1;
            const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
            pool.query(pgSql, params, (err, res) => {
                if (err) return reject(err);
                resolve(res); // res.rows, res.rowCount
            });
        } else {
            // For write operations, we need db.run which returns 'this'
            // For read operations, we need db.all or db.get
            // This abstraction is leaky for mixed return types.
            // Let's keep specific functions.
            reject(new Error("Use specific functions"));
        }
    });
}

function getAllAppointments() {
    return new Promise((resolve, reject) => {
        if (IS_POSTGRES) {
            pool.query('SELECT * FROM appointments ORDER BY date DESC, time DESC', (err, res) => {
                if (err) reject(err);
                else resolve(res.rows);
            });
        } else {
            db.all('SELECT * FROM appointments ORDER BY date DESC, time DESC', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }
    });
}

function getAppointmentById(id) {
    return new Promise((resolve, reject) => {
        if (IS_POSTGRES) {
            pool.query('SELECT * FROM appointments WHERE id = $1', [id], (err, res) => {
                if (err) reject(err);
                else resolve(res.rows[0]);
            });
        } else {
            db.get('SELECT * FROM appointments WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        }
    });
}

function createAppointment(appointment) {
    const { patient_name, email, phone, date, time, service, notes } = appointment;
    return new Promise((resolve, reject) => {
        if (IS_POSTGRES) {
            const sql = `INSERT INTO appointments (patient_name, email, phone, date, time, service, notes) 
                         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`;
            pool.query(sql, [patient_name, email, phone, date, time, service, notes], (err, res) => {
                if (err) reject(err);
                else resolve({ id: res.rows[0].id, ...appointment, status: 'pending' });
            });
        } else {
            db.run(
                `INSERT INTO appointments (patient_name, email, phone, date, time, service, notes) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [patient_name, email, phone, date, time, service, notes],
                function (err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, ...appointment, status: 'pending' });
                }
            );
        }
    });
}

function updateAppointmentStatus(id, status) {
    return new Promise((resolve, reject) => {
        if (IS_POSTGRES) {
            pool.query('UPDATE appointments SET status = $1 WHERE id = $2', [status, id], (err, res) => {
                if (err) reject(err);
                else resolve({ id, status, changes: res.rowCount });
            });
        } else {
            db.run('UPDATE appointments SET status = ? WHERE id = ?', [status, id], function (err) {
                if (err) reject(err);
                else resolve({ id, status, changes: this.changes });
            });
        }
    });
}

function deleteAppointment(id) {
    return new Promise((resolve, reject) => {
        if (IS_POSTGRES) {
            pool.query('DELETE FROM appointments WHERE id = $1', [id], (err, res) => {
                if (err) reject(err);
                else resolve({ id, deleted: res.rowCount > 0 });
            });
        } else {
            db.run('DELETE FROM appointments WHERE id = ?', [id], function (err) {
                if (err) reject(err);
                else resolve({ id, deleted: this.changes > 0 });
            });
        }
    });
}

function getAdminByUsername(username) {
    return new Promise((resolve, reject) => {
        if (IS_POSTGRES) {
            pool.query('SELECT * FROM admin_users WHERE username = $1', [username], (err, res) => {
                if (err) reject(err);
                else resolve(res.rows[0]);
            });
        } else {
            db.get('SELECT * FROM admin_users WHERE username = ?', [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        }
    });
}

module.exports = {
    initDatabase,
    getAllAppointments,
    getAppointmentById,
    createAppointment,
    updateAppointmentStatus,
    deleteAppointment,
    getAdminByUsername
};
