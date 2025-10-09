<script setup>
import { ref, onMounted, computed, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {ArrowLeft, Refresh, Download, Clock, Microphone} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const downloading = ref(false)
const detailData = ref(null)
const error = ref('')
const audioPlayer = ref(null)
const audioDuration = ref(0)

// 计算音频URL
const audioUrl = computed(() => {
  if (!detailData.value?.uuid) return null
  return `http://localhost:3000/api/cdr/audio/${detailData.value.uuid}`
})

// 时间格式化
const formatTime = (timestamp) => {
  if (!timestamp) return ''
  return timestamp.replace('T', ' ').replace(/\.\d+Z?$/, '')
}

// 音频时长格式化
const formatAudioDuration = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 音频加载完成
const handleAudioLoaded = () => {
  if (audioPlayer.value) {
    audioDuration.value = audioPlayer.value.duration
  }
}

// 音频错误处理
const handleAudioError = () => {
  ElMessage.error('音频加载失败')
}

// 下载音频
const downloadAudio = async () => {
  if (!detailData.value?.uuid) {
    ElMessage.warning('没有可下载的录音文件')
    return
  }

  downloading.value = true
  try {
    const response = await fetch(audioUrl.value)
    if (!response.ok) {
      throw new Error('下载失败')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    a.download = `recording_${detailData.value.uuid}.wav`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    ElMessage.success('录音下载成功')
  } catch (err) {
    console.error('下载失败:', err)
    ElMessage.error('录音下载失败')
  } finally {
    downloading.value = false
  }
}

// 获取详情数据
const fetchDetail = async () => {
  const id = route.query.id
  if (!id) {
    error.value = '缺少ID参数'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await fetch(`http://localhost:3000/api/cdr/${id}`)

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`)
    }

    const data = await response.json()

    if (data.success) {
      detailData.value = data.data
    } else {
      error.value = '获取详情失败: ' + (data.message || '未知错误')
      ElMessage.error(error.value)
    }
  } catch (err) {
    console.error('获取详情失败:', err)
    error.value = `获取详情失败: ${err.message}`
    ElMessage.error(error.value)
  } finally {
    loading.value = false
  }
}

// 刷新数据
const refreshData = () => {
  fetchDetail()
}

// 保存返回状态
const saveReturnState = () => {
  // 从 Home 页面传递的状态已经在 sessionStorage 中，这里不需要额外保存
  // 只需要确保在返回时不删除状态即可
}

// 返回上一页
const goBack = () => {
  saveReturnState()
  router.back()
}

// 在组件卸载前保存状态（防止用户直接点击浏览器返回）
onBeforeUnmount(() => {
  saveReturnState()
})

onMounted(() => {
  fetchDetail()
})
</script>

<template>
  <div class="detail-container">
    <el-container>
      <el-header style="background-color: #FF88BB; color: white; padding: 0 25px;border-radius: 20px; margin-bottom: 20px;">
        <h1 style="text-align: center; line-height: 60px; font-family:'幼圆';font-weight: bold;">通话记录详情</h1>
      </el-header>

      <el-main>
        <el-card shadow="hover" v-loading="loading">
          <template #header>
            <div class="card-header">
              <span>详细信息</span>
              <div>
                <el-button @click="refreshData" style="margin-right: 10px;">
                  <el-icon><Refresh /></el-icon>
                  刷新
                </el-button>
                <el-button style="background-color: #55DDEE" @click="goBack">
                  <el-icon style="color:white"><ArrowLeft /></el-icon>
                  <p style="color:white">返回列表</p>
                </el-button>
              </div>
            </div>
          </template>

          <div v-if="error" class="error-message">
            <el-alert
                :title="error"
                type="error"
                show-icon
                :closable="false"
            />
          </div>

          <div v-else-if="detailData" class="detail-content">
            <!-- 详细信息 -->
            <el-descriptions :column="2" border>
              <!-- 基本信息 -->
              <el-descriptions-item label="ID">{{ detailData.id }}</el-descriptions-item>
              <el-descriptions-item label="UUID">{{ detailData.uuid || '无' }}</el-descriptions-item>
              <el-descriptions-item label="Bleg UUID">{{ detailData.bleg_uuid || '无' }}</el-descriptions-item>
              <el-descriptions-item label="Call Link ID">{{ detailData.call_link_id || '无' }}</el-descriptions-item>

              <!-- 通话双方信息 -->
              <el-descriptions-item label="主叫号码">{{ detailData.caller_id_number }}</el-descriptions-item>
              <el-descriptions-item label="主叫名称">{{ detailData.caller_id_name || '无' }}</el-descriptions-item>
              <el-descriptions-item label="呼出人姓名">{{ detailData.caller_zh_name || '无' }}</el-descriptions-item>
              <el-descriptions-item label="被叫号码">{{ detailData.destination_number }}</el-descriptions-item>

              <!-- 时间信息 -->
              <el-descriptions-item label="开始时间">{{ formatTime(detailData.start_stamp) }}</el-descriptions-item>
              <el-descriptions-item label="应答时间">{{ formatTime(detailData.answer_stamp) || '未应答' }}</el-descriptions-item>
              <el-descriptions-item label="结束时间">{{ formatTime(detailData.end_stamp) }}</el-descriptions-item>
              <el-descriptions-item label="通话时长">{{ detailData.duration }} 秒</el-descriptions-item>
              <el-descriptions-item label="计费时长">{{ detailData.billsec || 0 }} 秒</el-descriptions-item>

              <!-- 技术信息 -->
              <el-descriptions-item label="本地IP">{{ detailData.local_ip_v4 || '无' }}</el-descriptions-item>
              <el-descriptions-item label="上下文">{{ detailData.context || '无' }}</el-descriptions-item>
              <el-descriptions-item label="账户代码">{{ detailData.accountcode || '无' }}</el-descriptions-item>
              <el-descriptions-item label="网关">{{ detailData.gateway || '无' }}</el-descriptions-item>

              <!-- 编码信息 -->
              <el-descriptions-item label="读取编解码">{{ detailData.read_codec || '无' }}</el-descriptions-item>
              <el-descriptions-item label="写入编解码">{{ detailData.write_codec || '无' }}</el-descriptions-item>

              <!-- 挂断信息 -->
              <el-descriptions-item label="挂断原因">{{ detailData.hangup_cause || '无' }}</el-descriptions-item>
              <el-descriptions-item label="SIP挂断处理">{{ detailData.sip_hangup_disposition || '无' }}</el-descriptions-item>

              <!-- 其他信息 -->
              <el-descriptions-item label="ANI">{{ detailData.ani || '无' }}</el-descriptions-item>
              <el-descriptions-item label="最终目的地">{{ detailData.final_dest || '无' }}</el-descriptions-item>
              <el-descriptions-item label="Leg信息">
                <el-tag v-if="detailData.leg_info" type="info">{{ detailData.leg_info }}</el-tag>
                <span v-else>无</span>
              </el-descriptions-item>
            </el-descriptions>


            <el-card v-if="detailData.has_audio" shadow="never" style="margin-bottom: 20px;">
              <template #header>
                <div class="audio-header">
                  <span style="color:#FF88BB">通话录音</span>
                </div>
              </template>
              <div class="audio-player-section">
                <audio
                    ref="audioPlayer"
                    controls
                    :src="audioUrl"
                    style="width: 100%; margin-bottom: 15px;"
                    @error="handleAudioError"
                    @loadedmetadata="handleAudioLoaded"
                >
                  您的浏览器不支持音频播放
                </audio>
                <div class="audio-controls">
                  <el-button
                      style="background-color: #55DDEE"
                      @click="downloadAudio"
                      :loading="downloading"
                      :disabled="!detailData.uuid">
                    <el-icon style="color:white"><Download /></el-icon>
                    <p style="color:white">下载录音</p>
                  </el-button>
                  <el-tag v-if="audioDuration" type="info">
                    时长: {{ formatAudioDuration(audioDuration) }}
                  </el-tag>
                  <el-tag v-else type="warning">
                    加载中...
                  </el-tag>
                </div>
              </div>
            </el-card>

            <el-card v-else shadow="never" style="margin-bottom: 20px;">
              <template #header>
                <div class="audio-header">
                  <el-icon><Microphone /></el-icon>
                  <span>通话录音</span>
                </div>
              </template>
              <div class="no-audio">
                <el-empty description="暂无通话录音" :image-size="80">
                  <el-button type="info" disabled>无可用录音</el-button>
                </el-empty>
              </div>
            </el-card>

            <!-- 通话流程时间线 -->
            <el-card shadow="never" style="margin-top: 20px;">
              <template #header>
                <div class="timeline-header">
                  <el-icon><Clock /></el-icon>
                  <span>通话流程时间线</span>
                </div>
              </template>
              <el-timeline>
                <el-timeline-item
                    :timestamp="formatTime(detailData.start_stamp)"
                    placement="top"
                    type="primary"
                    size="large">
                  <el-card>
                    <h4>通话开始</h4>
                    <p>主叫: {{ detailData.caller_id_number }} → 被叫: {{ detailData.destination_number }}</p>
                  </el-card>
                </el-timeline-item>

                <el-timeline-item
                    v-if="detailData.answer_stamp"
                    :timestamp="formatTime(detailData.answer_stamp)"
                    placement="top"
                    type="success"
                    size="large">
                  <el-card>
                    <h4>通话应答</h4>
                    <p>被叫方接听电话，开始计费</p>
                  </el-card>
                </el-timeline-item>

                <el-timeline-item
                    :timestamp="formatTime(detailData.end_stamp)"
                    placement="top"
                    type="warning"
                    size="large">
                  <el-card>
                    <h4>通话结束</h4>
                    <p>挂断原因: {{ detailData.hangup_cause || '未知' }}</p>
                    <p>总时长: {{ detailData.duration }} 秒</p>
                  </el-card>
                </el-timeline-item>
              </el-timeline>
            </el-card>
          </div>

          <div v-else-if="!loading" class="empty-state">
            <el-empty description="未找到通话记录详情">
              <el-button type="primary" @click="goBack">返回列表</el-button>
            </el-empty>
          </div>
        </el-card>
      </el-main>
    </el-container>
  </div>
</template>

<style scoped>
.detail-container {
  width: 99vw;
  min-height: 100vh;
  background-color: #f5f7fa;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.audio-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
  color: #409EFF;
}

.audio-player-section {
  padding: 10px;
}

.audio-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.no-audio {
  padding: 20px;
  text-align: center;
}

.detail-content {
  padding: 10px;
}

.empty-state {
  padding: 50px 0;
}

.error-message {
  margin-bottom: 20px;
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
  color: #409EFF;
}

:deep(.el-descriptions__label) {
  font-weight: bold;
  background-color: #f8f9fa;
}

:deep(.el-descriptions__content) {
  background-color: white;
}

:deep(.el-timeline-item__timestamp) {
  color: #666;
  font-size: 14px;
}
</style>