const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');

const app = express();
const port = 3000;

// 音频文件夹地址
const DEFAULT_RECORDINGS_DIR = 'D:\\recordings';
const RECORDINGS_DIR = path.normalize(process.env.RECORDINGS_DIR || DEFAULT_RECORDINGS_DIR);

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: '121380', // 注意：这里改回了你的原始密码
    port: 5432,
});

app.use(cors());
app.use(express.json());

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------- 录音索引功能 ----------
const recordingIndex = new Map();

function extractUuidFromFilename(filename) {
    const lower = filename.toLowerCase();
    if (!lower.endsWith('.wav')) return null;
    const base = filename.slice(0, -4);
    const lastUnderscore = base.lastIndexOf('_');
    if (lastUnderscore === -1) return null;
    const uuid = base.slice(lastUnderscore + 1);
    return UUID_REGEX.test(uuid) ? uuid : null;
}

async function buildRecordingIndex() {
    recordingIndex.clear();
    try {
        const entries = await fsp.readdir(RECORDINGS_DIR, { withFileTypes: true });
        for (const ent of entries) {
            if (!ent.isFile()) continue;
            const uuid = extractUuidFromFilename(ent.name);
            if (uuid) {
                recordingIndex.set(uuid.toLowerCase(), path.join(RECORDINGS_DIR, ent.name));
            }
        }
        console.log(`[recordings] indexed ${recordingIndex.size} files from ${RECORDINGS_DIR}`);
    } catch (err) {
        console.error('[recordings] index build error:', err.message);
    }
}

function watchRecordingDir() {
    try {
        fs.watch(RECORDINGS_DIR, (eventType, filename) => {
            if (!filename) return;
            try {
                const uuid = extractUuidFromFilename(filename);
                const full = path.join(RECORDINGS_DIR, filename);
                if (!uuid) return;

                if (eventType === 'rename') {
                    if (fs.existsSync(full)) {
                        recordingIndex.set(uuid.toLowerCase(), full);
                    } else {
                        recordingIndex.delete(uuid.toLowerCase());
                    }
                } else if (eventType === 'change') {
                    recordingIndex.set(uuid.toLowerCase(), full);
                }
            } catch (_) {}
        });
        console.log(`[recordings] watching ${RECORDINGS_DIR}`);
    } catch (err) {
        console.error('[recordings] watch error:', err.message);
    }
}

async function findRecordingByUuid(uuid) {
    const key = uuid.toLowerCase();
    if (recordingIndex.has(key)) return recordingIndex.get(key);
    await buildRecordingIndex();
    return recordingIndex.get(key) || null;
}

// 获取所有信息
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

        const dataQuery = `
            SELECT id, caller_id_number, destination_number, 
                   start_stamp, end_stamp, duration , caller_zh_name , uuid
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

// 获取详细信息
app.get('/api/cdr/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                id, local_ip_v4, caller_id_name, caller_id_number, 
                destination_number, context, start_stamp, answer_stamp, 
                end_stamp, duration, billsec, hangup_cause, uuid, 
                bleg_uuid, accountcode, read_codec, write_codec, 
                sip_hangup_disposition, ani, final_dest, caller_zh_name, 
                call_link_id, leg_info, gateway
            FROM cdr 
            WHERE id = $1
        `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '未找到对应的通话记录'
            });
        }

        // 检查是否有对应的录音文件
        const record = result.rows[0];
        const hasRecording = record.uuid ? await findRecordingByUuid(record.uuid) : false;

        res.json({
            success: true,
            data: {
                ...record,
                has_audio: !!hasRecording
            }
        });

    } catch (error) {
        console.error('数据库查询错误:', error);
        res.status(500).json({
            success: false,
            message: '获取详情失败'
        });
    }
});

// 根据uuid获取对应的音频
app.get('/api/cdr/audio/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;

        if (!UUID_REGEX.test(uuid)) {
            return res.status(400).json({ success: false, message: '无效的UUID' });
        }

        const filePath = await findRecordingByUuid(uuid);
        if (!filePath) {
            return res.status(404).json({ success: false, message: '录音文件未找到' });
        }

        // 设置正确的 Content-Type
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Disposition', `inline; filename="${uuid}.wav"`);

        // 创建可读流并传输文件
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

        fileStream.on('error', (error) => {
            console.error('文件流错误:', error);
            res.status(500).json({ success: false, message: '文件读取失败' });
        });

    } catch (error) {
        console.error('录音下载错误:', error);
        res.status(500).json({ success: false, message: '录音下载失败' });
    }
});

app.listen(port, async () => {
    console.log(`后端服务运行在 http://localhost:${port}`);

    // 初始化录音索引
    if (!fs.existsSync(RECORDINGS_DIR)) {
        console.warn(`[recordings] 录音目录不存在: ${RECORDINGS_DIR}`);
    } else {
        await buildRecordingIndex();
        watchRecordingDir();
    }
});