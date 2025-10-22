import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSearchStore = defineStore('search', () => {
    // 状态
    const searchQuery = ref('')
    const startDate = ref('')
    const endDate = ref('')
    const currentPage = ref(1)
    const pageSize = ref(10)
    const totalRecords = ref(0)
    const allData = ref([])
    const filteredData = ref([])
    const dateDistribution = ref([])
    const durationDistribution = ref([])

    // 保存搜索状态
    const saveSearchState = (state) => {
        if (state.searchQuery !== undefined) searchQuery.value = state.searchQuery
        if (state.startDate !== undefined) startDate.value = state.startDate
        if (state.endDate !== undefined) endDate.value = state.endDate
        if (state.currentPage !== undefined) currentPage.value = state.currentPage
        if (state.pageSize !== undefined) pageSize.value = state.pageSize
        if (state.totalRecords !== undefined) totalRecords.value = state.totalRecords
        if (state.allData !== undefined) allData.value = state.allData
        if (state.filteredData !== undefined) filteredData.value = state.filteredData
        if (state.dateDistribution !== undefined) dateDistribution.value = state.dateDistribution
        if (state.durationDistribution !== undefined) durationDistribution.value = state.durationDistribution
    }

    // 清除搜索状态
    const clearSearchState = () => {
        searchQuery.value = ''
        startDate.value = ''
        endDate.value = ''
        currentPage.value = 1
        pageSize.value = 10
        totalRecords.value = 0
        allData.value = []
        filteredData.value = []
        dateDistribution.value = []
        durationDistribution.value = []
    }

    // 获取完整状态
    const getSearchState = () => {
        return {
            searchQuery: searchQuery.value,
            startDate: startDate.value,
            endDate: endDate.value,
            currentPage: currentPage.value,
            pageSize: pageSize.value,
            totalRecords: totalRecords.value,
            allData: allData.value,
            filteredData: filteredData.value,
            dateDistribution: dateDistribution.value,
            durationDistribution: durationDistribution.value
        }
    }

    return {
        // 状态
        searchQuery,
        startDate,
        endDate,
        currentPage,
        pageSize,
        totalRecords,
        allData,
        filteredData,
        dateDistribution,
        durationDistribution,

        // 方法
        saveSearchState,
        clearSearchState,
        getSearchState
    }
})