import { ElMessage } from 'element-plus'

// 获取环境变量中的基础URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT) || 10000

// 请求超时处理
const timeoutPromise = (timeout) => {
    return new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(`请求超时 (${timeout}ms)`))
        }, timeout)
    })
}

// 统一的请求处理
const handleRequest = async (url, options = {}) => {
    const controller = new AbortController()
    const { signal } = controller

    try {
        const fetchPromise = fetch(url, {
            ...options,
            signal,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        })

        // 设置超时
        const response = await Promise.race([
            fetchPromise,
            timeoutPromise(API_TIMEOUT)
        ])

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()

        if (!data.success) {
            throw new Error(data.message || '请求失败')
        }

        return data
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('请求被取消')
        }
        throw error
    }
}

// CDR API 服务
export const cdrApi = {
    // 获取通话记录列表
    async getCDRList(params = {}) {
        const queryParams = new URLSearchParams()

        // 添加查询参数
        Object.keys(params).forEach(key => {
            if (params[key]) {
                queryParams.append(key, params[key])
            }
        })

        const url = `${API_BASE_URL}/api/cdr?${queryParams.toString()}`

        try {
            const data = await handleRequest(url)
            return data
        } catch (error) {
            console.error('获取通话记录失败:', error)
            ElMessage.error(`获取通话记录失败: ${error.message}`)
            throw error
        }
    },

    // 获取通话记录详情
    async getCDRDetail(id) {
        if (!id) {
            throw new Error('ID参数不能为空')
        }

        const url = `${API_BASE_URL}/api/cdr/${id}`

        try {
            const data = await handleRequest(url)
            return data
        } catch (error) {
            console.error('获取通话详情失败:', error)
            ElMessage.error(`获取通话详情失败: ${error.message}`)
            throw error
        }
    },

    // 获取通话统计信息
    async getCDRStats(params = {}) {
        const queryParams = new URLSearchParams()

        Object.keys(params).forEach(key => {
            if (params[key]) {
                queryParams.append(key, params[key])
            }
        })

        const url = `${API_BASE_URL}/api/cdr/stats?${queryParams.toString()}`

        try {
            const data = await handleRequest(url)
            return data
        } catch (error) {
            console.error('获取统计信息失败:', error)
            ElMessage.error(`获取统计信息失败: ${error.message}`)
            throw error
        }
    },

    // 导出通话记录
    async exportCDR(params = {}, exportType = 'all') {
        const queryParams = new URLSearchParams()

        Object.keys(params).forEach(key => {
            if (params[key]) {
                queryParams.append(key, params[key])
            }
        })

        queryParams.append('export_type', exportType)

        const url = `${API_BASE_URL}/api/cdr/export?${queryParams.toString()}`

        try {
            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(`导出失败: ${response.status}`)
            }

            const blob = await response.blob()
            return blob
        } catch (error) {
            console.error('导出通话记录失败:', error)
            ElMessage.error(`导出通话记录失败: ${error.message}`)
            throw error
        }
    },
// 获取音频URL
    getAudioUrl(uuid) {
        return `${API_BASE_URL}/api/cdr/audio/${uuid}`
    },

// 下载音频
    async downloadAudio(uuid) {
        if (!uuid) {
            throw new Error('UUID参数不能为空')
        }

        const url = this.getAudioUrl(uuid)

        try {
            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(`下载失败: ${response.status}`)
            }

            const blob = await response.blob()
            return blob
        } catch (error) {
            console.error('下载音频失败:', error)
            ElMessage.error(`下载音频失败: ${error.message}`)
            throw error
        }
    }

}

// 默认导出
export default {
    cdr: cdrApi
}