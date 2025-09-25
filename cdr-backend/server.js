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
        const { destination_number, start_date, end_date } = req.query;
        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;

        if (destination_number) {
            whereConditions.push(`destination_number ILIKE $${paramIndex}`);
            queryParams.push(`%${destination_number}%`);
            paramIndex++;
        }

        if (start_date) {
            whereConditions.push(`start_stamp >= $${paramIndex}`);
            queryParams.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            whereConditions.push(`end_stamp <= $${paramIndex}`);
            queryParams.push(end_date);
            paramIndex++;
        }

        let whereClause = '';
        if (whereConditions.length > 0) {
            whereClause = 'WHERE ' + whereConditions.join(' AND ');
        }

        //查询所有数据，不进行分页
        const dataQuery = `
            SELECT id, caller_id_number, destination_number, 
                   start_stamp, end_stamp, duration , caller_zh_name
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