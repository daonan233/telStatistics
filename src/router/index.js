import {createRouter,createWebHistory} from 'vue-router'
import Home from '@/pages/Home.vue';
import Details from "@/pages/details.vue";


const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            redirect: '/home',
        },
        {
            path: '/home',
            name: 'home',
            component: Home,
        },
        {
            path:'/details',
            name:'details',
            component: () => import('@/pages/details.vue')
        }

    ]
})

// 创建全局路由守卫
// 创建全局路由守卫
router.beforeEach((to, from, next) => {
    // 1、获取token
    const token = localStorage.getItem('token')
    // 2、判断是否需要登录权限
    if (to.meta.requiresAuth) {
        // 需要登录权限
        if (token) {
            next()
        } else {
            next({
                path: '/login',
                // 保存了用户原本要进入的url，当用户登录后跳转到该url
                query: {redirect: to.fullPath}
            })
        }
    } else {
        // 不需要登录权限，直接进入
        next()
    }
})
export default router
