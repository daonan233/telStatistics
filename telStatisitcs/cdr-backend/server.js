const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();
const port = 3000;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: '121380',
    port: 5432,
});

app.use(cors());
app.use(express.json());

app.get('/api/cdr', async (req, res) => {
    try {
        const { destination_number } = req.query;
        let whereClause = '';
        let queryParams = [];

        if (destination_number) {
            whereClause = 'WHERE destination_number ILIKE $1';
            queryParams.push(`%${destination_number}%`);
        }

        // 查询所有数据，不进行分页
        const dataQuery = `
            SELECT id, caller_id_number, destination_number, 
                   start_stamp, end_stamp, duration 
            FROM cdr 
            ${whereClause}
            ORDER BY id
        `;

        const dataResult = await pool.query(dataQuery, queryParams);

        res.json({
            success: true,
            data: dataResult.rows
        });

    } catch (error) {
        console.error('数据库查询错误:', error);
        res.status(500).json({
            success: false,
            message: '数据库查询失败'
        });
    }
});

app.listen(port, () => {
    console.log(`后端服务运行在 http://localhost:${port}`);
});