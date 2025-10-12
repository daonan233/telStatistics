const path = require('path');

const config = {
    // 音频文件夹配置
    recordings: {
        // 默认的录音目录
        DEFAULT_RECORDINGS_DIR: 'D:\\recordings',
        RECORDINGS_DIR: path.normalize(process.env.RECORDINGS_DIR || 'D:\\recordings')
    },
    // 数据库配置
    database: {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'postgres',
        password: process.env.DB_PASSWORD || '121380',
        port: parseInt(process.env.DB_PORT) || 5432,
        // 连接池配置
        pool: {
            max: 20,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    },
    // 服务器配置
    server: {
        port: parseInt(process.env.PORT) || 3000,
        host: process.env.HOST || 'localhost'
    }
};

module.exports = config;