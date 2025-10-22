import './assets/main.css'
import ElementUI from 'element-plus';
import 'element-plus/theme-chalk/index.css'
import 'echarts'
import { createPinia } from 'pinia'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

const pinia = createPinia()
const app = createApp(App)

app.use(router)
app.use(ElementUI)
app.use(pinia)
app.mount('#app')

