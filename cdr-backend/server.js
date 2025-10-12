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

// ---------- 处理关联记录的辅助函数（修正版本） ----------
async function processLinkedRecords(records) {
    const result = [];
    const processedIds = new Set();

    // 创建UUID到记录的映射，方便快速查找
    const uuidToRecordMap = new Map();
    // 创建bleg_uuid到记录的映射，用于快速查找父记录
    const blegUuidToRecordMap = new Map();

    // 构建映射
    records.forEach(record => {
        if (record.uuid) {
            uuidToRecordMap.set(record.uuid.toLowerCase(), record);
        }
        if (record.bleg_uuid) {
            blegUuidToRecordMap.set(record.bleg_uuid.toLowerCase(), record);
        }
    });

    // 处理所有记录
    for (const record of records) {
        if (processedIds.has(record.id)) continue;

        // 检查当前记录是否是某个记录的bleg_uuid（即它是B记录）
        const parentRecord = blegUuidToRecordMap.get(record.uuid?.toLowerCase());

        if (parentRecord && !processedIds.has(parentRecord.id)) {
            // 当前记录是B记录，父记录是A记录
            // 修改A记录：添加转接号码（B的destination_number）
            const recordA = {
                ...parentRecord,
                trans_number: record.destination_number  // B的destination_number作为A的转接号码
            };

            // 修改B记录：使用A的billsec
            const recordB = {
                ...record,
                billsec: parentRecord.billsec  // A的billsec作为B的billsec
            };

            processedIds.add(parentRecord.id);
            processedIds.add(record.id);
            result.push(recordA, recordB);
        } else if (record.bleg_uuid) {
            // 当前记录是A记录，查找对应的B记录
            const linkedRecord = uuidToRecordMap.get(record.bleg_uuid.toLowerCase());

            if (linkedRecord && !processedIds.has(linkedRecord.id)) {
                // 修改A记录：添加转接号码（B的destination_number）
                const recordA = {
                    ...record,
                    trans_number: linkedRecord.destination_number
                };

                // 修改B记录：使用A的billsec
                const recordB = {
                    ...linkedRecord,
                    billsec: record.billsec
                };

                processedIds.add(record.id);
                processedIds.add(linkedRecord.id);
                result.push(recordA, recordB);
            } else {
                // 有bleg_uuid但找不到对应的B记录
                result.push({
                    ...record,
                    trans_number: null
                });
                processedIds.add(record.id);
            }
        } else {
            // 没有关联的记录
            result.push({
                ...record,
                trans_number: null
            });
            processedIds.add(record.id);
        }
    }

    // 按照原始ID顺序排序返回
    return result.sort((a, b) => a.id - b.id);
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
        let final_billsec = record.billsec; // 默认使用自己的billsec

        // 情况1：当前记录有bleg_uuid（是A记录），需要找B记录获取转接号码
        if (record.bleg_uuid) {
            const bRecordQuery = `
                SELECT destination_number 
                FROM cdr 
                WHERE uuid = $1
            `;
            const bRecordResult = await pool.query(bRecordQuery, [record.bleg_uuid]);

            if (bRecordResult.rows.length > 0) {
                const bRecord = bRecordResult.rows[0];
                trans_number = bRecord.destination_number;
            }
        }
        // 情况2：当前记录没有bleg_uuid，但可能是B记录（其他记录的bleg_uuid指向当前记录的uuid）
        else {
            const aRecordQuery = `
                SELECT billsec 
                FROM cdr 
                WHERE bleg_uuid = $1
            `;
            const aRecordResult = await pool.query(aRecordQuery, [record.uuid]);

            if (aRecordResult.rows.length > 0) {
                const aRecord = aRecordResult.rows[0];
                // 作为B记录，使用A记录的billsec
                final_billsec = aRecord.billsec;
            }
        }

        res.json({
            success: true,
            data: {
                ...record,
                trans_number: trans_number,
                billsec: final_billsec, // 使用处理后的billsec
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