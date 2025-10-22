const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const config = require('./config'); // 引入配置文件

const app = express();
const port = config.server.port;

// 从配置中获取音频文件夹地址
const RECORDINGS_DIR = config.recordings.RECORDINGS_DIR;

// 从配置中创建数据库连接池
const pool = new Pool({
    user: config.database.user,
    host: config.database.host,
    database: config.database.database,
    password: config.database.password,
    port: config.database.port,
    ...config.database.pool
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

// 处理转接号码
async function processLinkedRecords(records) {
    const result = [];
    const processedIds = new Set();
    const uuidToRecordMap = new Map();
    records.forEach(record => {
        if (record.uuid) {
            uuidToRecordMap.set(record.uuid.toLowerCase(), record);
        }
    });
    // 处理所有记录
    for (const record of records.reverse()) {
        if (processedIds.has(record.id)) continue;

        // A.bleg_uuid == B
        if (record.bleg_uuid) {
            const linkedRecord = uuidToRecordMap.get(record.bleg_uuid.toLowerCase());

            if (linkedRecord && !processedIds.has(linkedRecord.id)) {
                const processedRecord = {
                    ...record,
                    duration: linkedRecord.duration,
                    billsec: linkedRecord.billsec,
                    trans_number: linkedRecord.destination_number
                };
                processedIds.add(record.id);
                processedIds.add(linkedRecord.id);
                result.push(processedRecord);
            } else {
                // 有bleg_uuid但找不到对应记录的
                result.push({
                    ...record,
                    trans_number: null
                });
                processedIds.add(record.id);
            }
        } else {
            let isBRecord = false;
            for (const otherRecord of records) {
                if (otherRecord.bleg_uuid && otherRecord.bleg_uuid.toLowerCase() === record.uuid?.toLowerCase()) {
                    isBRecord = true;
                    break;
                }
            }

            // 如果当前记录是B记录（被其他记录引用），则跳过不加入结果
            if (!isBRecord) {
                // 没有关联的记录，也不是B记录
                result.push({
                    ...record,
                    trans_number: null
                });
                processedIds.add(record.id);
            } else {
                // 当前记录是B记录，标记为已处理但不加入结果
                processedIds.add(record.id);
            }
        }
    }

    // 按照原始ID顺序排序返回
    return result.sort((a, b) => b.start_stamp - a.start_stamp);
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

        // 查询所有符合条件的记录
        const dataQuery = `
            SELECT id, caller_id_number, destination_number, 
                   start_stamp, end_stamp, duration, caller_zh_name, uuid, bleg_uuid, billsec
            FROM cdr 
            ${whereClause}
            ORDER BY start_stamp DESC 
        `;

        const dataResult = await pool.query(dataQuery, queryParams);

        // 处理关联记录
        const processedRecords = await processLinkedRecords(dataResult.rows);

        res.json({
            success: true,
            data: processedRecords
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

        let record = result.rows[0];

        // 检查是否有对应的录音文件
        const hasRecording = record.uuid ? await findRecordingByUuid(record.uuid) : false;

        // 处理关联记录信息
        let trans_number = null;
        let final_duration = record.duration;
        let final_billsec = record.billsec;

        // 如果当前记录有bleg_uuid（是A记录），查找对应的B记录
        if (record.bleg_uuid) {
            const bRecordQuery = `
                SELECT destination_number, duration, billsec
                FROM cdr 
                WHERE uuid = $1
            `;
            const bRecordResult = await pool.query(bRecordQuery, [record.bleg_uuid]);

            if (bRecordResult.rows.length > 0) {
                const bRecord = bRecordResult.rows[0];
                trans_number = bRecord.destination_number;
                final_duration = bRecord.duration;  // A使用B的duration
                final_billsec = bRecord.billsec;    // A使用B的billsec
            }
        }

        res.json({
            success: true,
            data: {
                ...record,
                trans_number: trans_number,
                duration: final_duration,  // 使用处理后的duration
                billsec: final_billsec,    // 使用处理后的billsec
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
    console.log(`后端服务运行在 http://${config.server.host}:${port}`);

    // 初始化录音索引
    if (!fs.existsSync(RECORDINGS_DIR)) {
        console.warn(`[recordings] 录音目录不存在: ${RECORDINGS_DIR}`);
    } else {
        await buildRecordingIndex();
        watchRecordingDir();
    }
});