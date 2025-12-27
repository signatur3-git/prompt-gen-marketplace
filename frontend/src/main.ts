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

// Initialize theme before app mounts
const STORAGE_KEY = 'prompt-gen-theme';
const savedTheme = localStorage.getItem(STORAGE_KEY) || 'auto';
if (savedTheme === 'light') {
  document.documentElement.setAttribute('data-theme', 'light');
} else if (savedTheme === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
}

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
