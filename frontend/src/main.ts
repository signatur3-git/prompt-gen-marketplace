import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import RegisterPage from './pages/RegisterPage.vue';
import LoginPage from './pages/LoginPage.vue';
import HomePage from './pages/HomePage.vue';
import PackagesPage from './pages/PackagesPage.vue';
import PackageDetailPage from './pages/PackageDetailPage.vue';
import DashboardPage from './pages/DashboardPage.vue';
import AuthorizePage from './pages/AuthorizePage.vue';
import PublishPage from './pages/PublishPage.vue';
import './style.css';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage },
    { path: '/register', component: RegisterPage },
    { path: '/login', component: LoginPage },
    { path: '/packages', component: PackagesPage },
    { path: '/packages/:namespace/:name', component: PackageDetailPage },
    { path: '/dashboard', component: DashboardPage },
    { path: '/oauth/authorize', component: AuthorizePage },
    { path: '/publish', component: PublishPage },
  ],
});

const app = createApp(App);
app.use(router);
app.mount('#app');

