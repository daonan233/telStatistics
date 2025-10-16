<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { Clock, DataBoard, Document, Download, Search } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { cdrApi } from '@/service/api'

const router = useRouter()

const searchQuery = ref('')
const allData = ref([])
const filteredData = ref([])
const currentPageData = ref([])
const dateDistribution = ref([])
const durationDistribution = ref([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const totalRecords = ref(0)
const dateChart = ref(null)
const durationChart = ref(null)
const startDate = ref('')
const endDate = ref('')

// 保存搜索状态
const saveSearchState = () => {
  const state = {
    searchQuery: searchQuery.value,
    startDate: startDate.value,
    endDate: endDate.value,
    currentPage: currentPage.value,
    pageSize: pageSize.value,
    totalRecords: totalRecords.value
  }
  sessionStorage.setItem('homeSearchState', JSON.stringify(state))
}

// 加载搜索状态
const loadSearchState = () => {
  const savedState = sessionStorage.getItem('homeSearchState')
  if (savedState) {
    const state = JSON.parse(savedState)
    searchQuery.value = state.searchQuery || ''
    startDate.value = state.startDate || ''
    endDate.value = state.endDate || ''
    currentPage.value = state.currentPage || 1
    pageSize.value = state.pageSize || 10
    totalRecords.value = state.totalRecords || 0

    sessionStorage.removeItem('homeSearchState')
    return true
  }
  return false
}

// 计算属性
const avgDuration = computed(() => {
  if (filteredData.value.length === 0) return 0
  const total = filteredData.value.reduce((sum, item) => sum + item.duration, 0)
  return (total / filteredData.value.length).toFixed(2)
})

const totalPages = computed(() => {
  return Math.ceil(filteredData.value.length / pageSize.value)
})

// 时间戳格式化
const formatTime = (timestamp) => {
  if (!timestamp) return ''
  return timestamp.replace('T', ' ').replace(/\.000Z$/, '')
}

// 请求数据 - 使用封装的API
const fetchData = async () => {
  loading.value = true

  try {
    // 构建查询参数
    const params = {
      destination_number: searchQuery.value,
      start_date: startDate.value,
      end_date: endDate.value
    }

    // 使用封装的API
    const response = await cdrApi.getCDRList(params)

    if (response.success) {
      allData.value = response.data
      applyFilter()
      saveSearchState()
      ElMessage.success(`查询到 ${response.data.length} 条记录`)
    }
  } catch (error) {
    // 错误已经在API层处理，这里不需要再次显示
    console.error('获取数据失败:', error)
  } finally {
    loading.value = false
  }
}

// 搜索过滤
const applyFilter = () => {
  filteredData.value = allData.value

  totalRecords.value = filteredData.value.length
  currentPage.value = 1
  updateCurrentPageData()

  generateDateDistribution(filteredData.value)
  generateDurationDistribution(filteredData.value)
  nextTick(() => {
    initCharts()
  })
}

// 清除时间筛选
const clearDateFilter = () => {
  startDate.value = ''
  endDate.value = ''
  fetchData()
}

// 清除所有筛选
const clearAllFilter = () => {
  startDate.value = ''
  endDate.value = ''
  searchQuery.value = ''
  fetchData()
}

// 日期验证
const disabledStartDate = (time) => {
  if (endDate.value) {
    return time.getTime() > new Date(endDate.value).getTime()
  }
  return false
}

const disabledEndDate = (time) => {
  if (startDate.value) {
    return time.getTime() < new Date(startDate.value).getTime()
  }
  return false
}

// 更新当前页数据
const updateCurrentPageData = () => {
  const startIndex = (currentPage.value - 1) * pageSize.value
  const endIndex = startIndex + pageSize.value
  currentPageData.value = filteredData.value.slice(startIndex, endIndex)
}

// 生成日期分布
const generateDateDistribution = (data) => {
  const distribution = {}

  data.forEach(item => {
    const date = item.end_stamp.split('T')[0]
    distribution[date] = (distribution[date] || 0) + 1
  })

  dateDistribution.value = Object.keys(distribution).map(date => ({
    date,
    count: distribution[date]
  })).sort((a, b) => a.date.localeCompare(b.date))
}

// 生成时长分布
const generateDurationDistribution = (data) => {
  const ranges = [
    { min: 0, max: 10, label: '0-10秒' },
    { min: 10, max: 30, label: '11-30秒' },
    { min: 31, max: 60, label: '31-60秒' },
    { min: 61, max: 120, label: '61-120秒' },
    { min: 121, max: Infinity, label: '120秒以上' }
  ]

  const distribution = {}
  ranges.forEach(range => {
    distribution[range.label] = 0
  })

  data.forEach(item => {
    for (const range of ranges) {
      if (item.duration >= range.min && item.duration <= range.max) {
        distribution[range.label]++
        break
      }
    }
  })

  durationDistribution.value = Object.keys(distribution).map(label => ({
    range: label,
    count: distribution[label]
  }))
}

// 初始化图表
const initCharts = () => {
  // 日期分布图表
  const dateChartDom = document.getElementById('dateChart')
  if (dateChartDom) {
    dateChart.value = echarts.init(dateChartDom)

    const dateOption = {
      tooltip: {
        trigger: 'axis',
        formatter: '{b}: {c} 条通话记录'
      },
      xAxis: {
        type: 'category',
        data: dateDistribution.value.map(item => item.date),
        axisLabel: {
          rotate: 45
        }
      },
      yAxis: {
        type: 'value',
        name: '通话次数'
      },
      series: [{
        data: dateDistribution.value.map(item => item.count),
        type: 'bar',
        itemStyle: {
          color: '#FF88BB'
        },
        label: {
          show: false,
          position: 'top',
          color: '#55DDEE',
          fontWeight: 'bold',
          fontSize: 15,
          formatter: '{c}'
        },
        emphasis: {
          label: {
            show: true,
            position: 'top',
            color: '#55DDEE',
            fontWeight: 'bold',
            fontSize: 15,
            formatter: '{c}',
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(255, 136, 187, 0.5)'
          }
        }
      }],
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '3%',
        containLabel: true
      }
    }

    dateChart.value.setOption(dateOption)
  }

  // 时长分布图表
  const durationChartDom = document.getElementById('durationChart')
  if (durationChartDom) {
    durationChart.value = echarts.init(durationChartDom)

    const durationOption = {
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center'
      },
      series: [
        {
          name: '通话时长分布',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 18,
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: false
          },
          data: durationDistribution.value.map(item => ({
            value: item.count,
            name: item.range
          }))
        }
      ]
    }

    durationChart.value.setOption(durationOption)
  }
}

// 搜索
const handleSearch = () => {
  applyFilter()
  saveSearchState()
}

// 清空搜索
const handleClear = () => {
  searchQuery.value = ''
  applyFilter()
  saveSearchState()
}

// 分页处理
const handlePageChange = (page) => {
  currentPage.value = page
  updateCurrentPageData()
  saveSearchState()
}

const handlePageSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
  updateCurrentPageData()
  saveSearchState()
}

// 导出数据
const exportData = async (exportType = 'all') => {
  try {
    let dataToExport = []
    let dataType = ''

    if (exportType === 'current') {
      dataToExport = currentPageData.value
      dataType = '当前页'
    } else {
      dataToExport = filteredData.value
      dataType = '全部'
    }

    if (dataToExport.length === 0) {
      ElMessage.warning(`没有${dataType}数据可导出`)
      return
    }

    const headers = ['ID', '主叫号码', '被叫号码','转接号码', '开始时间', '结束时间', '计费时长(秒)','呼出人姓名']
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(item => [
        item.id,
        `"${item.caller_id_number || ''}"`,
        `"${item.destination_number || ''}"`,
        `"${item.trans_number || ''}"`,
        `"${item.start_stamp || ''}"`,
        `"${item.end_stamp || ''}"`,
        item.billsec || 0,
        `"${item.caller_zh_name || ''}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)

    const now = new Date()
    const timestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`
    const filename = `通话记录_${dataType}_${timestamp}.csv`

    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    ElMessage.success(`${dataType}数据导出成功，共 ${dataToExport.length} 条记录`)
  } catch (error) {
    console.error('导出数据失败:', error)
    ElMessage.error('数据导出失败，请重试')
  }
}

// 查看详情 - 使用封装的API
const viewDetail = async (row) => {
  saveSearchState()

  try {
    await router.push({
      path: `/details`,
      query: {
        id: row.id
      }
    })
  } catch (error) {
    console.error('跳转到详情页失败:', error)
  }
}

onMounted(() => {
  const hasSavedState = loadSearchState()
  if (hasSavedState) {
    fetchData()
  } else {
    fetchData()
  }

  window.addEventListener('resize', () => {
    if (dateChart.value) {
      dateChart.value.resize()
    }
    if (durationChart.value) {
      durationChart.value.resize()
    }
  })
})
</script>

<template>
  <div class="container">
    <el-container>
      <el-header style="background-color: #FF88BB; color: white; padding: 0 25px;border-radius: 20px">
        <h1 style="margin-left:40vw; align-content: center;line-height: 60px; font-family:'幼圆';font-weight: bold;">通话记录统计分析系统</h1>
      </el-header>

      <el-main>
        <!--搜索区域（含号码、日期筛选-->
        <el-card shadow="hover" style="margin-bottom: 20px;">
          <template #header>
            <div class="card-header">
              <span>数据查询</span>
            </div>
          </template>
          <el-row :gutter="20" style="margin-bottom: 15px;">
            <el-col :span="18">
              <el-input
                  v-model="searchQuery"
                  placeholder="请输入被叫号码进行模糊查询（请去掉+号）"
                  clearable
                  @clear="handleClear"
                  size="large">
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
            </el-col>
            <el-col :span="6">
              <el-button @click="fetchData" size="large" style="width: 100%;background:#FF88BB;color:#fff">
                查询号码记录
              </el-button>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="9">
              <el-date-picker
                  v-model="startDate"
                  type="datetime"
                  placeholder="选择开始时间"
                  style="width: 100%"
                  value-format="YYYY-MM-DDTHH:mm:ss"
                  :disabled-date="disabledStartDate"
              />
            </el-col>
            <el-col :span="9">
              <el-date-picker
                  v-model="endDate"
                  type="datetime"
                  placeholder="选择结束时间"
                  style="width: 100%"
                  value-format="YYYY-MM-DDTHH:mm:ss"
                  :disabled-date="disabledEndDate"
              />
            </el-col>

            <!--清除筛选区域-->
            <el-col :span="3">
              <el-button @click="clearDateFilter" size="large" style="width: 100%;background-color: #55DDEE;color: #fff;">
                清除时间筛选
              </el-button>
            </el-col>
            <el-col :span="3">
              <el-button @click="clearAllFilter" size="large" style="width: 100%;background-color: #DDBBFF;color: #fff;">
                清除所有筛选
              </el-button>
            </el-col>
          </el-row>
        </el-card>

        <!--统计信息区域-->
        <el-row :gutter="20" style="margin-bottom: 20px;">
          <el-col :span="8">
            <el-card shadow="hover">
              <div style="display: flex; align-items: center;">
                <el-icon size="40" color="#409EFF"><Document /></el-icon>
                <div style="margin-left: 15px;">
                  <div style="font-size: 14px; color: #909399;">总记录数</div>
                  <div style="font-size: 24px; font-weight: bold;">{{ totalRecords }}</div>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card shadow="hover">
              <div style="display: flex; align-items: center;">
                <el-icon size="40" color="#67C23A"><DataBoard /></el-icon>
                <div style="margin-left: 15px;">
                  <div style="font-size: 14px; color: #909399;">日期分布数</div>
                  <div style="font-size: 24px; font-weight: bold;">{{ dateDistribution.length }}</div>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card shadow="hover">
              <div style="display: flex; align-items: center;">
                <el-icon size="40" color="#E6A23C"><Clock /></el-icon>
                <div style="margin-left: 15px;">
                  <div style="font-size: 14px; color: #909399;">平均通话时长</div>
                  <div style="font-size: 24px; font-weight: bold;">{{ avgDuration }}秒</div>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <!--通话日期和时长图标，用的echart-->
        <el-row :gutter="20" style="margin-bottom: 20px;">
          <el-col :span="12">
            <el-card shadow="hover">
              <template #header>
                <div class="card-header">
                  <span>通话日期分布</span>
                </div>
              </template>
              <div id="dateChart" style="height: 300px;"></div>
            </el-card>
          </el-col>
          <el-col :span="12">
            <el-card shadow="hover">
              <template #header>
                <div class="card-header">
                  <span>通话时长分布</span>
                </div>
              </template>
              <div id="durationChart" style="height: 300px;"></div>
            </el-card>
          </el-col>
        </el-row>

        <!--数据表格部分，包含下载和分页-->
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>通话记录详情</span>
              <div>
                <span style="margin-right: 10px; color: #606266;">每页显示:</span>
                <el-select v-model="pageSize" @change="handlePageSizeChange" style="width: 100px; margin-right: 10px;">
                  <el-option label="10条" value="10"></el-option>
                  <el-option label="20条" value="20"></el-option>
                  <el-option label="50条" value="50"></el-option>
                  <el-option label="100条" value="100"></el-option>
                  <el-option label="10000条" value="10000"></el-option>
                </el-select>
                <el-button style="background-color:#FF88BB" @click="exportData('all')" :disabled="currentPageData.length === 0">
                  <el-icon style="color:white"><Download/></el-icon>
                  <p style="color:white">导出全部数据</p>
                </el-button>
                <el-button style="background-color:#55DDEE;margin-left: 10px;"   @click="exportData('current')" :disabled="currentPageData.length === 0" >
                  <el-icon style="color:white"><Download/></el-icon>
                  <p style="color:white">导出当前页数据</p>
                </el-button>
              </div>
            </div>
          </template>
          <el-table
              :data="currentPageData"
              stripe
              border
              style="width: 100%;align-content: center;margin-left: 100px"
              v-loading="loading">
            <el-table-column prop="id" label="ID" width="80" sortable></el-table-column>
            <el-table-column prop="caller_id_number" label="主叫号码" width="150"></el-table-column>
            <el-table-column prop="destination_number" label="被叫号码" width="150"></el-table-column>
            <el-table-column prop="trans_number" label="转接号码" width="150"></el-table-column>
            <el-table-column prop="start_stamp" label="开始时间" width="200" sortable>
              <template #default="scope">
                {{ formatTime(scope.row.start_stamp) }}
              </template>
            </el-table-column>
            <el-table-column prop="end_stamp" label="结束时间" width="200" sortable>
              <template #default="scope">
                {{ formatTime(scope.row.end_stamp) }}
              </template>
            </el-table-column>
            <el-table-column prop="billsec" label="通话时长(秒)" width="100" sortable>
              <template #default="scope">
                {{ scope.row.duration }}
              </template>
            </el-table-column>
            <el-table-column prop="billsec" label="计费时长(秒)" width="100" sortable>
              <template #default="scope">
                {{ scope.row.billsec }}
              </template>
            </el-table-column>
            <el-table-column prop="caller_zh_name" label="呼出人姓名" width="150"></el-table-column>

            <!-- 添加操作列 -->
            <el-table-column label="操作" width="150" fixed="right" align="center">
              <template #default="scope">
                <el-button
                    type="primary"
                    size="small"
                    @click="viewDetail(scope.row)">
                  查看详情
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
            <div style="color: #909399;">
              显示 {{ (currentPage - 1) * pageSize + 1 }}-{{ Math.min(currentPage * pageSize, totalRecords) }} 条，共 {{ totalRecords }} 条记录
            </div>
            <el-pagination
                v-model:current-page="currentPage"
                :page-size="pageSize"
                :total="totalRecords"
                :page-count="totalPages"
                layout="prev, pager, next, jumper"
                @current-change="handlePageChange">
            </el-pagination>
          </div>
        </el-card>
      </el-main>
    </el-container>
  </div>
</template>

<style scoped>
body {
  margin: 0;
  width: 100vw;
  font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", Arial, sans-serif;
  background-color: #FF88BB;
}
.container{
  width: 99vw;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

#app {
  min-height: 100vh;
}

.el-header {
  padding: 0;
}

.el-main {
  padding: 20px;
}

.el-card {
  border-radius: 8px;
}

.el-table {
  margin-top: 10px;
}
</style>