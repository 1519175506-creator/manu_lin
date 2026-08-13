// ===== 主应用：路由 + 视图调度 + 工具函数 =====

const App = {
  currentRoute: '',

  // 页面标题映射
  titles: {
    'dishes': '⚡ 小lin食铺',
    'add': '新增菜品',
    'meals': '每日菜单',
    'settings': '我的',
    'shopping': '🛒 购物清单',
    'wishlist': '💡 周日愿望清单'
  },

  // 初始化
  async init() {
    // 注册 Service Worker
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('sw.js');
        // 强制激活新 SW
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              newSW.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      } catch (e) {
        console.log('SW 注册失败:', e);
      }
    }

    // 导入初始数据
    const imported = await initInitialData();
    if (imported) {
      this.showToast('已导入初始菜谱数据 ⚡');
    }

    // 迁移：为已有菜品添加标签 + 括号迁移
    await migrateDishTags();

    // 迁移：导入抖音视频链接为菜品（占位，后续豆包批量补充）
    // 已禁用：改用 importFromFavoritesTxt() 从菜谱文件直接导入
    // const douyinAdded = await migrateDouyinVideos();
    // if (douyinAdded > 0) {
    //   this.showToast(`已导入 ${douyinAdded} 个抖音视频菜品占位 ⚡`);
    // }

    // 导入豆包整理好的收藏夹菜谱（删除占位菜品，从txt导入真实菜谱）
    const favResult = await importFromFavoritesTxt();
    if (favResult && !favResult.alreadyDone && !favResult.error) {
      const msg = `✅ 已清理${favResult.deletedBadDishes}道错误菜，导入${favResult.createdNew}道菜谱`;
      console.log('[收藏夹菜谱导入]', favResult);
      this.showToast(msg);
    }

    // 路由监听
    window.addEventListener('hashchange', () => this.router());
    this.router();
  },

  // 路由分发
  async router() {
    const hash = window.location.hash.slice(1) || '/';
    const container = document.getElementById('view-container');
    container.innerHTML = '<div class="loading">加载中... ⚡</div>';

    // 更新底部导航高亮
    this.updateNav(hash);

    try {
      // 路由匹配
      if (hash === '/' || hash === '') {
        this.setPageTitle('dishes');
        await DishesView.renderList(container);
      } else if (hash.startsWith('/dish/')) {
        const id = hash.split('/')[2];
        this.setPageTitle('detail');
        await DishesView.renderDetail(container, id);
      } else if (hash === '/add') {
        this.setPageTitle('add');
        AddDishView.render(container);
      } else if (hash === '/edit/') {
        // 不直接访问
        window.location.hash = '/';
      } else if (hash.startsWith('/edit/')) {
        const id = hash.split('/')[2];
        this.setPageTitle('edit');
        AddDishView.render(container, id);
      } else if (hash === '/plan') {
        this.setPageTitle('plan');
        await PlanView.render(container);
      } else if (hash === '/meals') {
        this.setPageTitle('meals');
        await MealsView.render(container);
      } else if (hash === '/settings') {
        this.setPageTitle('settings');
        await SettingsView.render(container);
      } else if (hash === '/shopping') {
        this.setPageTitle('shopping');
        await ShoppingView.render(container);
      } else if (hash === '/wishlist') {
        this.setPageTitle('wishlist');
        await WishlistView.render(container);
      } else {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🐭</div><p>页面不存在</p></div>';
      }
    } catch (err) {
      console.error('[路由错误]', err);
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">😵</div>
          <p>加载出错了</p>
          <p style="font-size:12px;color:#999;margin-top:8px">${App.escapeHtml(String(err.message || err))}</p>
          <a href="#/" class="btn btn-primary mt-16">返回菜谱</a>
        </div>
      `;
    }
  },

  // 更新导航高亮
  updateNav(hash) {
    const tabs = document.querySelectorAll('.nav-item');
    tabs.forEach(tab => tab.classList.remove('active'));
    let tabName = 'dishes';
    if (hash === '/' || hash === '') tabName = 'dishes';
    else if (hash === '/plan') tabName = 'plan';
    else if (hash === '/add' || hash.startsWith('/edit/')) tabName = 'add';
    else if (hash === '/meals') tabName = 'meals';
    else if (hash === '/settings') tabName = 'settings';
    // 详情页不高亮任何 tab
    if (!hash.startsWith('/dish/')) {
      const activeTab = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
      if (activeTab) activeTab.classList.add('active');
    }
  },

  // 设置页面标题
  setPageTitle(view) {
    const titleMap = {
      'dishes': '⚡ 小lin食铺',
      'add': '➕ 新增菜品',
      'edit': '✏️ 编辑菜品',
      'detail': '🍳 菜品详情',
      'plan': '📋 每周计划',
      'meals': '🗒️ 每日菜单',
      'settings': '🐾 我的',
      'shopping': '🛒 购物清单',
      'wishlist': '💡 周日愿望清单'
    };
    document.getElementById('page-title').textContent = titleMap[view] || '⚡ 小lin食铺';
  },

  // ===== Toast 提示 =====
  showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), duration);
  },

  // ===== 模态框 =====
  showModal(html) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    content.innerHTML = html;
    overlay.classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  // ===== 图片压缩 =====
  compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // ===== HTML 转义 =====
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// 模态框点击遮罩关闭
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') {
    App.closeModal();
  }
});

// 启动应用
document.addEventListener('DOMContentLoaded', () => App.init());
