// 设置页：统计、导出/导入、营养目标参考、购物清单、愿望清单

const SettingsView = {
  async render(container) {
    const stats = await getStats();
    const cart = await getShoppingCart();
    const wishlist = await getWishlist();
    const cartCount = (cart.dishIds || []).length;
    const wishCount = wishlist.length;

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">${stats.total}</div>
          <div class="stat-label">总菜品数</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color:var(--success)">${stats.cooked}</div>
          <div class="stat-label">已做过</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color:#ff9800">${stats.uncooked}</div>
          <div class="stat-label">没做过</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${stats.monthDishes}</div>
          <div class="stat-label">本月做菜次数</div>
        </div>
      </div>

      <div class="stats-grid" style="grid-template-columns:1fr 1fr">
        <a href="#/shopping" class="stat-card" style="text-decoration:none;color:inherit;cursor:pointer">
          <div class="stat-number" style="color:var(--primary-dark)">🛒 ${cartCount}</div>
          <div class="stat-label">购物清单</div>
        </a>
        <a href="#/wishlist" class="stat-card" style="text-decoration:none;color:inherit;cursor:pointer">
          <div class="stat-number" style="color:#7B1FA2">💡 ${wishCount}</div>
          <div class="stat-label">周日愿望清单</div>
        </a>
      </div>

      <div class="nutrition-card">
        <h3>🎯 每日营养目标（参考）</h3>
        <div class="nutrition-item">
          <span>蛋白质</span>
          <span class="nutrition-value">105g</span>
        </div>
        <div class="nutrition-item">
          <span>脂肪</span>
          <span class="nutrition-value">45g</span>
        </div>
        <div class="nutrition-item">
          <span>碳水化合物</span>
          <span class="nutrition-value">130g</span>
        </div>
        <p class="nutrition-note">💡 此为参考目标，实际摄入请根据食材估算</p>
      </div>

      <div class="detail-section">
        <h3>📥 批量导入抖音视频</h3>
        <p style="font-size:12px;color:#888;margin-bottom:8px">
          粘贴抖音/B站/小红书视频链接（每行一个），自动创建菜品
        </p>
        <textarea id="batch-urls" placeholder="https://www.douyin.com/video/xxx&#10;https://www.bilibili.com/video/xxx" rows="4" style="width:100%;padding:10px;border:1px solid #eee;border-radius:8px;margin-bottom:8px;font-size:13px"></textarea>
        <button class="btn btn-primary btn-block" id="import-urls-btn">🔗 解析并导入</button>
        <p style="font-size:11px;color:#aaa;margin-top:6px">
          💡 建议在抖音APP分享视频→复制链接→粘贴到这里
        </p>
      </div>

      <div class="detail-section">
        <h3>菜谱补充</h3>
        <button class="btn btn-primary btn-block mb-16" id="import-new-dishes-btn">🍽️ 追加导入新菜品</button>
        <button class="btn btn-primary btn-block mb-16" id="load-recipes-btn">📖 一键补充菜谱做法</button>
        <p style="font-size:12px;color:var(--text-light)">
          先导入新菜品，再补充做法（两步走）
        </p>
      </div>

      <div class="detail-section">
        <h3>数据管理</h3>
        <button class="btn btn-primary btn-block mb-16" id="export-btn">📤 导出备份数据</button>
        <button class="btn btn-secondary btn-block mb-16" id="import-btn">📥 导入备份数据</button>
        <button class="btn btn-danger btn-block" id="clear-btn">🗑️ 清空所有数据</button>
      </div>

      <div class="detail-section">
        <h3>关于</h3>
        <p style="font-size:14px;line-height:1.6;color:#555">
          <strong>⚡ 小lin食铺</strong> v2.0<br><br>
          个人菜谱与每日菜单管理工具。<br>
          数据存储在本地浏览器，支持导出备份。<br>
          可添加到手机主屏幕，像 App 一样使用。<br><br>
          <span style="color:#888">提示：在浏览器菜单中选择"添加到主屏幕"即可安装</span>
        </p>
      </div>

      <input type="file" id="import-file" accept=".json" class="hidden">
    `;

    this.bindEvents(container);
  },

  bindEvents(container) {
    // 批量导入抖音链接
    document.getElementById('import-urls-btn').addEventListener('click', async () => {
      const textarea = document.getElementById('batch-urls');
      const text = textarea.value.trim();
      if (!text) {
        App.showToast('请粘贴至少一个视频链接');
        return;
      }

      const urls = text.split('\n').map(l => l.trim()).filter(l => l);
      let importedCount = 0;
      let skippedCount = 0;

      for (const url of urls) {
        try {
          // 从URL中提取视频ID和可能的标题
          const dish = this.parseVideoUrl(url);
          if (dish) {
            const existing = await getAllDishes();
            const duplicate = existing.find(d => d.douyinUrl === url || d.name === dish.name);
            if (duplicate) {
              skippedCount++;
              continue;
            }
            await addDish(dish);
            importedCount++;
          }
        } catch (e) {
          console.error('导入失败:', url, e);
        }
      }

      if (importedCount > 0) {
        App.showToast(`已导入 ${importedCount} 道菜${skippedCount > 0 ? `（${skippedCount}重复跳过）` : ''} ⚡`);
        textarea.value = '';
      } else {
        App.showToast('没有成功导入，请检查链接格式');
      }
    });

    // 追加导入新菜品
    document.getElementById('import-new-dishes-btn').addEventListener('click', async () => {
      try {
        const response = await fetch('data/initial-dishes.json');
        const dishes = await response.json();
        const existing = await getAllDishes();
        const existingNames = new Set(existing.map(d => d.name));
        let addedCount = 0;
        for (const dish of dishes) {
          if (!existingNames.has(dish.name)) {
            await addDish(dish);
            addedCount++;
          }
        }
        if (addedCount > 0) {
          App.showToast(`已追加导入 ${addedCount} 道菜 ⚡`);
        } else {
          App.showToast('没有新菜品需要导入');
        }
      } catch (err) {
        App.showToast('导入失败：' + err.message);
      }
    });

    // 补充菜谱
    document.getElementById('load-recipes-btn').addEventListener('click', async () => {
      try {
        const response = await fetch('data/recipes.json');
        const recipes = await response.json();
        const allDishes = await getAllDishes();
        let updatedCount = 0;
        for (const recipe of recipes) {
          const dish = allDishes.find(d => d.name === recipe.name);
          if (dish && !dish.method) {
            await updateDish(dish.id, {
              ingredients: recipe.ingredients,
              method: recipe.method
            });
            updatedCount++;
          }
        }
        if (updatedCount > 0) {
          App.showToast(`已补充 ${updatedCount} 道菜的做法 ⚡`);
        } else {
          App.showToast('没有需要补充做法的菜品');
        }
      } catch (err) {
        App.showToast('补充失败：' + err.message);
      }
    });

    // 导出
    document.getElementById('export-btn').addEventListener('click', async () => {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `菜谱备份_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      App.showToast('已导出备份文件');
    });

    // 导入
    document.getElementById('import-btn').addEventListener('click', () => {
      document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      App.showModal(`
        <div class="modal-header">
          <h3>确认导入</h3>
          <button class="modal-close" onclick="App.closeModal()">×</button>
        </div>
        <p style="margin-bottom:16px">导入将<strong style="color:var(--danger)">覆盖</strong>当前所有数据，确定继续吗？</p>
        <div style="display:flex;gap:12px">
          <button class="btn btn-secondary" style="flex:1" onclick="App.closeModal()">取消</button>
          <button class="btn btn-primary" style="flex:1" id="confirm-import-btn">确认导入</button>
        </div>
      `);

      document.getElementById('confirm-import-btn').addEventListener('click', async () => {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          await importAllData(data);
          App.closeModal();
          App.showToast('导入成功');
          await this.render(container);
        } catch (err) {
          App.closeModal();
          App.showToast('导入失败：' + err.message);
        }
      });
      e.target.value = '';
    });

    // 清空数据
    document.getElementById('clear-btn').addEventListener('click', () => {
      App.showModal(`
        <div class="modal-header">
          <h3>⚠️ 危险操作</h3>
          <button class="modal-close" onclick="App.closeModal()">×</button>
        </div>
        <p style="margin-bottom:16px">这将<strong style="color:var(--danger)">永久删除</strong>所有菜品和菜单数据！<br>建议先导出备份。</p>
        <p style="font-size:13px;color:#888;margin-bottom:16px">输入"确认清空"以继续：</p>
        <input type="text" id="clear-confirm-input" placeholder="确认清空" style="width:100%;padding:10px;border:1px solid #eee;border-radius:8px;margin-bottom:16px">
        <div style="display:flex;gap:12px">
          <button class="btn btn-secondary" style="flex:1" onclick="App.closeModal()">取消</button>
          <button class="btn btn-danger" style="flex:1" id="confirm-clear-btn" disabled>清空</button>
        </div>
      `);

      const input = document.getElementById('clear-confirm-input');
      const btn = document.getElementById('confirm-clear-btn');
      input.addEventListener('input', () => {
        btn.disabled = input.value !== '确认清空';
      });

      btn.addEventListener('click', async () => {
        await db.dishes.clear();
        await db.meals.clear();
        App.closeModal();
        App.showToast('已清空所有数据');
        window.location.hash = '/';
      });
    });
  },

  // 解析视频链接，提取菜品信息
  parseVideoUrl(url) {
    // 根据不同平台提取信息
    let platform = 'unknown';
    let videoId = '';
    let directUrl = url;

    if (url.includes('douyin.com')) {
      platform = 'douyin';
      // 1. 标准视频链接格式: video/7673072641440586353
      let match = url.match(/video\/(\d+)/);
      if (match) videoId = match[1];
      // 2. 收藏夹模态框链接格式: modal_id=7673072641440586353
      if (!videoId) {
        match = url.match(/modal_id=(\d+)/);
        if (match) {
          videoId = match[1];
          // 转换为标准视频链接，方便直接访问
          directUrl = `https://www.douyin.com/video/${videoId}`;
        }
      }
    } else if (url.includes('bilibili.com') || url.includes('b23.tv')) {
      platform = 'bilibili';
      const match = url.match(/video\/(BV[\w]+)/);
      if (match) videoId = match[1];
    } else if (url.includes('xiaohongshu.com') || url.includes('xhslink.com')) {
      platform = 'xiaohongshu';
    }

    // 提取视频标题（如果URL中有标题参数）
    let name = '';
    try {
      const urlObj = new URL(url);
      // 尝试从URL参数中找标题
      const titleParam = urlObj.searchParams.get('title') || urlObj.searchParams.get('name');
      if (titleParam) {
        name = decodeURIComponent(titleParam);
      }
    } catch (e) {}

    // 如果没有标题，用视频ID生成名称
    if (!name) {
      name = `${platform === 'douyin' ? '抖音' : platform === 'bilibili' ? 'B站' : '小红书'}视频 ${videoId || ''}`;
    }

    return {
      name: name,
      category: '荤菜',
      douyinUrl: directUrl,
      ingredients: '',
      method: '',
      tags: []
    };
  }
};

// ===== 购物清单视图 =====
const ShoppingView = {
  async render(container) {
    const cart = await getShoppingCart();
    const dishIds = cart.dishIds || [];
    const items = cart.items || [];

    // 获取菜品详情
    const allDishes = await getAllDishes();
    const cartDishes = allDishes.filter(d => dishIds.includes(d.id));

    container.innerHTML = `
      <div class="back-bar">
        <a href="#/settings" class="back-btn">‹</a>
        <div style="font-size:16px;font-weight:600">🛒 购物清单</div>
      </div>

      ${cartDishes.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">🛒</div>
          <p>购物清单还是空的</p>
          <p style="font-size:13px;margin-top:8px">打开菜品详情页，点击"加入购物清单"吧</p>
          <a href="#/" class="btn btn-primary mt-16">去选菜</a>
        </div>
      ` : `
        <div class="shopping-section">
          <div class="plan-section-title">🗓️ 要做的菜（${cartDishes.length}道）</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${cartDishes.map(d => `
              <span class="shopping-dish-tag">
                ${App.escapeHtml(d.name)}
                <button class="shopping-dish-remove" data-id="${d.id}" title="移除">×</button>
              </span>
            `).join('')}
          </div>
        </div>

        <div class="shopping-section">
          <div class="plan-section-title">📝 需要买的食材（${items.length}项）</div>
          ${this.renderItemsByCategory(items)}
        </div>

        <div style="display:flex;gap:10px;margin-top:20px">
          <button class="btn btn-secondary" style="flex:1" id="copy-list-btn">📋 复制清单</button>
          <button class="btn btn-danger" style="flex:1" id="clear-cart-btn">🗑️ 清空</button>
        </div>
        <p style="font-size:12px;color:var(--text-light);margin-top:10px">
          💡 食材解析基于您填入的食材文本，调料和用量可能需要人工调整
        </p>
      `}
    `;

    this.bindEvents(container);
  },

  renderItemsByCategory(items) {
    if (items.length === 0) {
      return '<p style="color:#999;font-size:13px">暂无食材，先把菜品的"食材"信息填好哦</p>';
    }

    const grouped = {};
    for (const item of items) {
      const cat = item.category || '其他';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    }

    const order = ['肉蛋禽类', '海鲜水产', '蔬菜类', '主食谷物', '调料类', '其他'];
    let html = '';
    for (const cat of order) {
      if (!grouped[cat] || grouped[cat].length === 0) continue;
      // 提取简短分类名给CSS匹配
      let dataCat = cat;
      if (cat === '肉蛋禽类') dataCat = '肉类';
      else if (cat === '主食谷物') dataCat = '主食';
      else if (cat === '调料类') dataCat = '调料';
      html += `<div class="shopping-category-title" data-cat="${dataCat}">${this.getCategoryIcon(cat)} ${cat}</div>`;
      for (const item of grouped[cat]) {
        html += `
          <div class="shopping-item">
            <input type="checkbox" class="shopping-item-check" title="标记已买">
            <span class="shopping-item-name">${App.escapeHtml(item.name)}</span>
            <span class="shopping-item-amount">${App.escapeHtml(item.amount)}</span>
          </div>
        `;
      }
    }
    return html;
  },

  getCategoryIcon(cat) {
    const map = {
      '肉蛋禽类': '🥩',
      '海鲜水产': '🦐',
      '蔬菜类': '🥬',
      '主食谷物': '🍚',
      '调料类': '🧂',
      '其他': '📦'
    };
    return map[cat] || '📦';
  },

  bindEvents(container) {
    // 移除某个菜
    container.querySelectorAll('.shopping-dish-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(btn.dataset.id);
        await removeFromShoppingCart(id);
        App.showToast('已移除');
        await this.render(container);
      });
    });

    // 复制清单
    const copyBtn = container.querySelector('#copy-list-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const cart = await getShoppingCart();
        const allDishes = await getAllDishes();
        const cartDishes = allDishes.filter(d => (cart.dishIds || []).includes(d.id));
        
        let text = '🛒 购物清单\n';
        text += `要做的菜：${cartDishes.map(d => d.name).join('、')}\n\n`;
        text += '需要购买的食材：\n';
        const items = cart.items || [];
        const grouped = {};
        for (const item of items) {
          const cat = item.category || '其他';
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(item);
        }
        const order = ['肉蛋禽类', '海鲜水产', '蔬菜类', '主食谷物', '调料类', '其他'];
        for (const cat of order) {
          if (!grouped[cat] || grouped[cat].length === 0) continue;
          text += `【${cat}】\n`;
          for (const item of grouped[cat]) {
            text += `□ ${item.name} ${item.amount}\n`;
          }
        }

        try {
          await navigator.clipboard.writeText(text);
          App.showToast('✅ 已复制到剪贴板');
        } catch (e) {
          App.showModal(`
            <div class="modal-header">
              <h3>复制以下内容</h3>
              <button class="modal-close" onclick="App.closeModal()">×</button>
            </div>
            <div style="white-space:pre-wrap;font-size:13px;background:#f5f5f5;padding:12px;border-radius:8px;max-height:300px;overflow-y:auto">${App.escapeHtml(text)}</div>
            <button class="btn btn-primary btn-block mt-16" onclick="App.closeModal()">知道了</button>
          `);
        }
      });
    }

    // 清空购物清单
    const clearBtn = container.querySelector('#clear-cart-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        App.showModal(`
          <div class="modal-header">
            <h3>确认清空</h3>
            <button class="modal-close" onclick="App.closeModal()">×</button>
          </div>
          <p style="margin-bottom:16px">确定要清空购物清单吗？</p>
          <div style="display:flex;gap:12px">
            <button class="btn btn-secondary" style="flex:1" onclick="App.closeModal()">取消</button>
            <button class="btn btn-danger" style="flex:1" id="confirm-clear-cart">确定清空</button>
          </div>
        `);
        document.getElementById('confirm-clear-cart').addEventListener('click', async () => {
          await clearShoppingCart();
          App.closeModal();
          App.showToast('已清空');
          await this.render(container);
        });
      });
    }
  }
};

// ===== 周日愿望清单视图 =====
const WishlistView = {
  async render(container) {
    const items = await getWishlist();
    const allDishes = await getAllDishes();
    const dishMap = new Map(allDishes.map(d => [d.id, d]));

    container.innerHTML = `
      <div class="back-bar">
        <a href="#/settings" class="back-btn">‹</a>
        <div style="font-size:16px;font-weight:600">💡 周日愿望清单</div>
      </div>

      <div class="plan-dietary-hint" style="background:#F3E5F5;border-left-color:#9C27B0">
        <p style="color:#4A148C">✨ 工作日突然想到要做什么菜，马上记下来！<br>周日集中采购和烹饪时，这里就是你的灵感池。</p>
      </div>

      ${items.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">💡</div>
          <p>还没有想到要做的菜</p>
          <p style="font-size:13px;margin-top:8px">看到感兴趣的菜品详情页，点击"加入周日愿望清单"吧</p>
          <a href="#/" class="btn btn-primary mt-16">去浏览菜谱</a>
        </div>
      ` : `
        <div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <span style="font-size:13px;color:var(--text-light)">共 ${items.length} 道菜等你周日做</span>
            <button class="btn btn-danger btn-sm" id="clear-wishlist-btn">全部清空</button>
          </div>
          <button class="btn btn-primary btn-block mb-16" id="add-all-to-cart-btn">🛒 全部加入购物清单</button>
        </div>

        ${items.map(item => {
          const dish = dishMap.get(item.dishId);
          if (!dish) return '';
          const dateStr = new Date(item.createdAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
          return `
            <div class="wishlist-item">
              <div class="wishlist-item-info">
                <div class="wishlist-item-name">🍳 ${App.escapeHtml(dish.name)}</div>
                <div class="wishlist-item-date">📅 ${dateStr} 加入 · ${App.escapeHtml(dish.category)}${dish.subCategory ? ' · ' + dish.subCategory : ''}</div>
                ${item.note ? `<div style="font-size:13px;color:#666;margin-top:4px">📝 ${App.escapeHtml(item.note)}</div>` : ''}
              </div>
              <div class="wishlist-item-actions">
                <button class="wishlist-action-btn cart" data-action="cart" data-id="${item.id}" data-dishid="${dish.id}">🛒 加购物车</button>
                <button class="wishlist-action-btn remove" data-action="remove" data-id="${item.id}">🗑️</button>
              </div>
            </div>
          `;
        }).join('')}
      `}
    `;

    this.bindEvents(container);
  },

  bindEvents(container) {
    // 单项操作
    container.querySelectorAll('.wishlist-action-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        const id = Number(btn.dataset.id);
        const dishId = Number(btn.dataset.dishid);

        if (action === 'cart') {
          await addToShoppingCart(dishId);
          await removeFromWishlist(id);
          App.showToast('✅ 已移入购物清单');
        } else if (action === 'remove') {
          await removeFromWishlist(id);
          App.showToast('已移除');
        }
        await this.render(container);
      });
    });

    // 全部加入购物清单
    const addAllBtn = container.querySelector('#add-all-to-cart-btn');
    if (addAllBtn) {
      addAllBtn.addEventListener('click', async () => {
        const items = await getWishlist();
        for (const item of items) {
          await addToShoppingCart(item.dishId);
        }
        await clearWishlist();
        App.showToast(`✅ 已将 ${items.length} 道菜加入购物清单`);
        window.location.hash = '/shopping';
      });
    }

    // 清空
    const clearBtn = container.querySelector('#clear-wishlist-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        App.showModal(`
          <div class="modal-header">
            <h3>确认清空</h3>
            <button class="modal-close" onclick="App.closeModal()">×</button>
          </div>
          <p style="margin-bottom:16px">确定清空所有愿望吗？</p>
          <div style="display:flex;gap:12px">
            <button class="btn btn-secondary" style="flex:1" onclick="App.closeModal()">取消</button>
            <button class="btn btn-danger" style="flex:1" id="confirm-clear-wishlist">确定清空</button>
          </div>
        `);
        document.getElementById('confirm-clear-wishlist').addEventListener('click', async () => {
          await clearWishlist();
          App.closeModal();
          App.showToast('已清空');
          await this.render(container);
        });
      });
    }
  }
};
