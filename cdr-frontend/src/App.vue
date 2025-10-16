<script setup>
import { RouterView } from 'vue-router'
// 导入echarts
import { provide } from 'vue'

</script>

<template>
  <!-- 一级路由出口 -->
  <router-view></router-view>
</template>

<style>
html, body, #app{
  margin: 0;
  padding: 0;
  height: 100%;
}
</style>
