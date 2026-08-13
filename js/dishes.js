// 菜品列表与详情视图

const DishesView = {
  // 当前筛选状态
  filter: 'all',
  subFilter: 'all',
  searchKeyword: '',

  // 细分类选项
  subCategories: ['all', '猪肉', '鸡肉', '牛肉', '海鲜', '空气炸锅', '一锅出'],

  // 渲染菜品列表
  async renderList(container) {
    const categories = ['all', 'cooked', 'uncooked', '荤菜', '素菜', '汤', '凉菜', '主食'];
    const labels = { all: '全部', cooked: '已做过 ✔', uncooked: '没做过', '荤菜': '荤菜', '素菜': '素菜', '汤': '汤', '凉菜': '凉菜', '主食': '主食' };
    const subLabels = { all: '🏷️ 全部', '猪肉': '🐷 猪肉', '鸡肉': '🐔 鸡肉', '牛肉': '🐮 牛肉', '海鲜': '🦐 海鲜', '空气炸锅': '🌀 空气炸锅', '一锅出': '🍲 一锅出' };

    container.innerHTML = `
      <input type="text" class="search-bar" id="search-input"
             placeholder="搜索菜名..." value="${App.escapeHtml(this.searchKeyword)}">
      <div class="filter-tabs">
        ${categories.map(cat => `
          <span class="filter-tab ${this.filter === cat ? 'active' : ''}"
                data-filter="${cat}">${labels[cat]}</span>
        `).join('')}
      </div>
      <div class="sub-filter-tabs">
        ${this.subCategories.map(sub => `
          <span class="sub-filter-tab ${this.subFilter === sub ? 'active' : ''}"
                data-subfilter="${sub}">${subLabels[sub]}</span>
        `).join('')}
      </div>
      <div id="dish-list-container"></div>
    `;

    // 绑定搜索和筛选事件（只绑定一次）
    this.bindHeaderEvents(container);
    // 渲染菜品列表
    await this.renderDishItems(container);
  },

  // 只渲染菜品列表部分（不重建搜索框，保持焦点）
  async renderDishItems(container) {
    let dishes = await getAllDishes();

    // 搜索过滤
    if (this.searchKeyword) {
      dishes = dishes.filter(d => d.name.includes(this.searchKeyword));
    }

    // 分类/状态过滤
    if (this.filter === 'cooked') {
      dishes = dishes.filter(d => d.cooked);
    } else if (this.filter === 'uncooked') {
      dishes = dishes.filter(d => !d.cooked);
    } else if (this.filter !== 'all') {
      dishes = dishes.filter(d => d.category === this.filter);
    }

    // 细分类过滤
    if (this.subFilter !== 'all') {
      dishes = dishes.filter(d => d.subCategory === this.subFilter);
    }

    const listContainer = container.querySelector('#dish-list-container');
    if (!listContainer) return;

    let html = '';
    if (dishes.length === 0) {
      html = `
        <div class="empty-state">
          <div class="empty-state-icon">🍽️</div>
          <p>没有找到菜品</p>
          <p style="font-size:13px;margin-top:8px">点击底部"新增"添加菜品</p>
        </div>
      `;
    } else {
      html = '<div class="dish-list">';
      for (const dish of dishes) {
        const photoHtml = dish.photo
          ? `<img src="${dish.photo}" alt="${App.escapeHtml(dish.name)}">`
          : '🍳';
        const tagsHtml = (dish.tags && dish.tags.length > 0)
          ? dish.tags.map(tag => `<span class="dish-tag-mini">${tag}</span>`).join('')
          : '';
        const subCatHtml = dish.subCategory
          ? `<span class="dish-tag-mini" style="background:#FFF3E0;color:#E65100">${this.getSubCategoryIcon(dish.subCategory)} ${App.escapeHtml(dish.subCategory)}</span>`
          : '';
        // 添加分类和细分类的CSS类，用于多样化配色
          const catClass = dish.category ? `cat-${App.escapeHtml(dish.category)}` : '';
          const subCatClass = dish.subCategory ? `cat-${App.escapeHtml(dish.subCategory)}` : '';
          const cardClasses = [catClass, subCatClass].filter(Boolean).join(' ');
          html += `
          <div class="dish-card ${cardClasses}" data-id="${dish.id}">
            <div class="dish-photo">${photoHtml}</div>
            <div class="dish-info">
              <div class="dish-name">${App.escapeHtml(dish.name)}</div>
              <div class="dish-meta">
                <span class="dish-category">${App.escapeHtml(dish.category)}</span>
                ${dish.cooked ? '<span class="dish-status cooked">✔</span>' : ''}
              </div>
              ${(tagsHtml || subCatHtml) ? `<div class="dish-tags-row">${subCatHtml}${tagsHtml}</div>` : ''}
            </div>
          </div>
        `;
      }
      html += '</div>';
    }

    listContainer.innerHTML = html;

    // 绑定菜品卡片点击事件
    listContainer.querySelectorAll('.dish-card').forEach(card => {
      card.addEventListener('click', () => {
        window.location.hash = `/dish/${card.dataset.id}`;
      });
    });
  },

  // 绑定搜索栏和筛选标签事件（不重建 DOM）
  bindHeaderEvents(container) {
    // 搜索（防抖，只更新列表部分）
    const searchInput = container.querySelector('#search-input');
    if (searchInput) {
      let timer = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          this.searchKeyword = e.target.value;
          this.renderDishItems(container);
        }, 300);
      });
    }

    // 主筛选标签（只更新标签高亮和列表）
    container.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        this.filter = tab.dataset.filter;
        container.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        await this.renderDishItems(container);
      });
    });

    // 细分类筛选标签
    container.querySelectorAll('.sub-filter-tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        this.subFilter = tab.dataset.subfilter;
        container.querySelectorAll('.sub-filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        await this.renderDishItems(container);
      });
    });
  },

  // 渲染菜品详情
  async renderDetail(container, id) {
    const dish = await getDishById(id);
    if (!dish) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">😢</div>
          <p>菜品不存在</p>
          <a href="#/" class="btn btn-primary mt-16">返回菜谱</a>
        </div>
      `;
      return;
    }

    const photoHtml = dish.photo
      ? `<img src="${dish.photo}" alt="${App.escapeHtml(dish.name)}">`
      : '🍳';

    // 可内联编辑的区域 - 点击后变为编辑模式
    const linkHtml = dish.douyinUrl
      ? `<p class="detail-editable" data-field="douyinUrl" title="点击编辑">📺 <a href="${App.escapeHtml(dish.douyinUrl)}" class="detail-link" target="_blank">${App.escapeHtml(dish.douyinUrl)}</a> <span class="edit-hint">✎</span></p>`
      : `<p class="detail-editable" data-field="douyinUrl" title="点击添加">➕ 添加视频链接 <span class="edit-hint">✎</span></p>`;

    const ingredientsHtml = dish.ingredients
      ? `<p class="detail-editable detail-text" data-field="ingredients" title="点击编辑">${App.escapeHtml(dish.ingredients)} <span class="edit-hint">✎</span></p>`
      : `<p class="detail-editable" data-field="ingredients" title="点击添加">➕ 点击添加食材信息 <span class="edit-hint">✎</span></p>`;

    const methodHtml = dish.method
      ? `<p class="detail-editable detail-text" data-field="method" title="点击编辑">${App.escapeHtml(dish.method)} <span class="edit-hint">✎</span></p>`
      : `<p class="detail-editable" data-field="method" title="点击添加">➕ 点击添加做法 <span class="edit-hint">✎</span></p>`;

    const tagsHtml = (dish.tags && dish.tags.length > 0)
      ? dish.tags.map(tag => `<span class="detail-tag tag-${tag}">${tag}</span>`).join('')
      : '';

    // 细分类标签
    const subCategoryHtml = dish.subCategory
      ? `<span class="detail-tag tag-subcategory">${this.getSubCategoryIcon(dish.subCategory)} ${App.escapeHtml(dish.subCategory)}</span>`
      : '';

    // 营养数据
    const n = dish.nutrition || { calories: 0, carbs: 0, fat: 0, protein: 0 };
    const hasNutrition = n.calories > 0 || n.carbs > 0 || n.fat > 0 || n.protein > 0;
    const nutritionHtml = hasNutrition ? `
      <div class="nutrition-card detail-nutrition-card">
        <h3>📊 预估营养（每份）</h3>
        <div class="nutrition-grid">
          <div class="nutrition-item-block">
            <div class="nutrition-icon">🔥</div>
            <div class="nutrition-big-value">${n.calories}</div>
            <div class="nutrition-small-label">千卡 kcal</div>
          </div>
          <div class="nutrition-item-block">
            <div class="nutrition-icon">🥔</div>
            <div class="nutrition-big-value">${n.carbs}g</div>
            <div class="nutrition-small-label">碳水</div>
          </div>
          <div class="nutrition-item-block">
            <div class="nutrition-icon">🥩</div>
            <div class="nutrition-big-value">${n.protein}g</div>
            <div class="nutrition-small-label">蛋白质</div>
          </div>
          <div class="nutrition-item-block">
            <div class="nutrition-icon">🧈</div>
            <div class="nutrition-big-value">${n.fat}g</div>
            <div class="nutrition-small-label">脂肪</div>
          </div>
        </div>
      </div>
    ` : '';

    // 检查是否已在购物车/愿望清单
    const [inCart, inWishlist] = await Promise.all([
      isInShoppingCart(dish.id),
      db.wishlist.where('dishId').equals(Number(dish.id)).first().then(Boolean)
    ]);

    let notesHtml = '';
    if (dish.notes && dish.notes.length > 0) {
      const sortedNotes = [...dish.notes].reverse();
      notesHtml = sortedNotes.map(note => `
        <div class="note-item">
          <div class="note-date">📅 ${note.date}</div>
          <div class="note-content">${App.escapeHtml(note.content)}</div>
        </div>
      `).join('');
    } else {
      notesHtml = '<p style="color:#999;font-size:14px">还没有做菜笔记，做完菜后记录一下吧</p>';
    }

    container.innerHTML = `
      <div class="back-bar">
        <a href="#/" class="back-btn">‹</a>
        <a href="#/edit/${dish.id}" class="btn btn-secondary btn-sm edit-btn">编辑</a>
      </div>
      <div class="detail-photo-wrap">
        <div class="detail-photo">${photoHtml}</div>
        <button class="detail-photo-upload-btn" id="upload-photo-btn">📷 ${dish.photo ? '换张照片' : '上传做菜照片'}</button>
        <input type="file" id="detail-photo-input" accept="image/*" class="hidden" capture="environment">
      </div>
      <div class="detail-title detail-editable" data-field="name" title="点击编辑菜名">${App.escapeHtml(dish.name)} <span class="edit-hint">✎</span></div>
      <div class="detail-tags">
        <span class="detail-tag category">${App.escapeHtml(dish.category)}</span>
        ${subCategoryHtml}
        ${dish.cooked
          ? '<span class="detail-tag cooked">✔ 已做过</span>'
          : '<span class="detail-tag uncooked">还没做过</span>'}
        ${tagsHtml}
      </div>

      ${nutritionHtml}

      <div class="detail-action-row">
        <button class="btn ${inCart ? 'btn-secondary' : 'btn-primary'} detail-action-btn" id="cart-btn">
          ${inCart ? '✅ 已在购物清单' : '🛒 加入购物清单'}
        </button>
        <button class="btn ${inWishlist ? 'btn-secondary' : 'btn-secondary'} detail-action-btn" id="wishlist-btn" style="${inWishlist ? 'background:#FFF9E6;color:var(--primary-dark)' : ''}">
          ${inWishlist ? '💡 已在愿望清单' : '💡 加入周日愿望清单'}
        </button>
      </div>

      <div class="detail-section">
        <h3>视频链接</h3>
        ${linkHtml}
      </div>
      <div class="detail-section">
        <h3>食材</h3>
        ${ingredientsHtml}
      </div>
      <div class="detail-section">
        <h3>做法</h3>
        ${methodHtml}
      </div>
      <div class="detail-section">
        <h3>做菜笔记</h3>
        <button class="btn btn-primary btn-block mb-16" id="add-note-btn">✏️ 记录今日做法</button>
        ${notesHtml}
      </div>
      <button class="btn btn-danger btn-block mt-16" id="delete-dish-btn">删除菜品</button>
    `;

    // 绑定事件
    document.getElementById('add-note-btn').addEventListener('click', () => {
      this.showNoteModal(dish.id);
    });

    document.getElementById('delete-dish-btn').addEventListener('click', () => {
      this.showDeleteConfirm(dish.id, dish.name);
    });

    // 内联编辑：点击可编辑区域变为编辑模式
    container.querySelectorAll('.detail-editable').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const field = el.dataset.field;
        const currentValue = dish[field] || '';
        await this.enterInlineEdit(container, dish.id, field, currentValue, el);
      });
    });

    // 上传做菜照片
    const uploadBtn = document.getElementById('upload-photo-btn');
    const photoInput = document.getElementById('detail-photo-input');
    if (uploadBtn && photoInput) {
      uploadBtn.addEventListener('click', () => {
        photoInput.click();
      });
      photoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const compressed = await App.compressImage(file);
          await updateDish(dish.id, { photo: compressed });
          App.showToast('✅ 照片已保存');
          await this.renderDetail(container, id);
        } catch (err) {
          App.showToast('图片处理失败');
        }
      });
    }

    // 加入购物清单
    document.getElementById('cart-btn').addEventListener('click', async () => {
      if (inCart) {
        await removeFromShoppingCart(dish.id);
        App.showToast('已从购物清单移除');
      } else {
        await addToShoppingCart(dish.id);
        App.showToast('✅ 已加入购物清单');
      }
      await this.renderDetail(container, id);
    });

    // 加入愿望清单
    document.getElementById('wishlist-btn').addEventListener('click', async () => {
      if (inWishlist) {
        const item = await db.wishlist.where('dishId').equals(Number(dish.id)).first();
        if (item) await removeFromWishlist(item.id);
        App.showToast('已从愿望清单移除');
      } else {
        await addToWishlist(dish.id, '');
        App.showToast('💡 已加入周日愿望清单');
      }
      await this.renderDetail(container, id);
    });
  },

  // 内联编辑：进入编辑模式
  async enterInlineEdit(container, dishId, field, currentValue, element) {
    // 如果已经在编辑状态，不重复进入
    if (element.classList.contains('editing')) return;

    const isLongText = field === 'ingredients' || field === 'method';
    const fieldLabels = { name: '菜名', ingredients: '食材', method: '做法', douyinUrl: '抖音视频链接' };
    const label = fieldLabels[field] || field;

    // 创建编辑框
    element.classList.add('editing');
    const originalHtml = element.innerHTML;
    element.innerHTML = `
      <div class="inline-edit-box">
        <div class="inline-edit-label">编辑${label}</div>
        ${isLongText 
          ? `<textarea class="inline-edit-textarea" rows="6">${App.escapeHtml(currentValue)}</textarea>`
          : `<input type="text" class="inline-edit-input" value="${App.escapeHtml(currentValue)}">`
        }
        <div class="inline-edit-actions">
          <button class="btn btn-secondary btn-sm inline-cancel-btn">取消</button>
          <button class="btn btn-primary btn-sm inline-save-btn">保存</button>
        </div>
      </div>
    `;

    const textarea = element.querySelector('.inline-edit-textarea, .inline-edit-input');
    const cancelBtn = element.querySelector('.inline-cancel-btn');
    const saveBtn = element.querySelector('.inline-save-btn');

    // 聚焦
    if (textarea) {
      textarea.focus();
      if (isLongText) textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }

    // 取消
    const cancelEdit = () => {
      element.classList.remove('editing');
      element.innerHTML = originalHtml;
      this.rebindEditableEvents(container, dishId);
    };

    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelEdit();
    });

    // 保存
    const saveEdit = async () => {
      const newValue = textarea.value.trim();
      if (field === 'name' && !newValue) {
        App.showToast('菜名不能为空');
        textarea.focus();
        return;
      }
      try {
        await updateDish(dishId, { [field]: newValue });
        App.showToast('✅ 已保存');
        // 重新渲染详情
        await this.renderDetail(container, dishId);
      } catch (err) {
        App.showToast('保存失败');
        cancelEdit();
      }
    };

    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveEdit();
    });

    // 快捷键：Enter保存（textarea用Ctrl+Enter），Esc取消
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      } else if (e.key === 'Enter' && !isLongText) {
        e.preventDefault();
        saveEdit();
      } else if (e.key === 'Enter' && e.ctrlKey && isLongText) {
        e.preventDefault();
        saveEdit();
      }
    });
  },

  // 重新绑定可编辑事件
  rebindEditableEvents(container, dishId) {
    container.querySelectorAll('.detail-editable').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (el.classList.contains('editing')) return;
        const field = el.dataset.field;
        const dish = await getDishById(dishId);
        if (!dish) return;
        const currentValue = dish[field] || '';
        await this.enterInlineEdit(container, dishId, field, currentValue, el);
      });
    });
  },

  // 细分类图标映射
  getSubCategoryIcon(subCat) {
    const map = {
      '猪肉': '🐷',
      '鸡肉': '🐔',
      '牛肉': '🐮',
      '海鲜': '🦐',
      '空气炸锅': '🌀',
      '一锅出': '🍲'
    };
    return map[subCat] || '🏷️';
  },

  // 显示添加笔记模态框
  showNoteModal(dishId) {
    const today = new Date().toISOString().slice(0, 10);
    App.showModal(`
      <div class="modal-header">
        <h3>记录做菜笔记</h3>
        <button class="modal-close" onclick="App.closeModal()">×</button>
      </div>
      <p style="font-size:13px;color:#888;margin-bottom:12px">📅 ${today}</p>
      <div class="form-group">
        <textarea id="note-content" placeholder="记录本次做菜的心得、调整、改进点...&#10;例如：盐少放点，豆角要多炒一会"></textarea>
      </div>
      <button class="btn btn-primary btn-block" id="save-note-btn">保存笔记</button>
    `);

    document.getElementById('save-note-btn').addEventListener('click', async () => {
      const content = document.getElementById('note-content').value.trim();
      if (!content) {
        App.showToast('请输入笔记内容');
        return;
      }
      await addDishNote(dishId, content);
      App.closeModal();
      App.showToast('笔记已保存');
      // 重新渲染详情页
      const container = document.getElementById('view-container');
      await this.renderDetail(container, dishId);
    });
  },

  // 删除确认
  showDeleteConfirm(dishId, dishName) {
    App.showModal(`
      <div class="modal-header">
        <h3>确认删除</h3>
        <button class="modal-close" onclick="App.closeModal()">×</button>
      </div>
      <p style="margin-bottom:16px">确定要删除「${App.escapeHtml(dishName)}」吗？此操作不可撤销。</p>
      <div style="display:flex;gap:12px">
        <button class="btn btn-secondary" style="flex:1" onclick="App.closeModal()">取消</button>
        <button class="btn btn-danger" style="flex:1" id="confirm-delete-btn">删除</button>
      </div>
    `);

    document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
      await deleteDish(dishId);
      App.closeModal();
      App.showToast('已删除');
      window.location.hash = '/';
    });
  }
};
