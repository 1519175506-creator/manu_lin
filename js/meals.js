// 每日菜单视图

const MealsView = {
  currentDate: new Date().toISOString().slice(0, 10),
  currentDishIds: [],

  async render(container) {
    const today = this.currentDate;
    const meal = await getMealByDate(today);
    this.currentDishIds = meal ? (meal.dishIds || []) : [];

    const allMeals = await getAllMeals();
    const allDishes = await getAllDishes();
    const dishMap = {};
    allDishes.forEach(d => { dishMap[d.id] = d; });

    // 当天菜品列表
    let dishesHtml = '';
    if (this.currentDishIds.length > 0) {
      dishesHtml = this.currentDishIds.map(id => {
        const dish = dishMap[id];
        if (!dish) return '';
        return `
          <div class="meal-dish-item">
            <span class="meal-dish-name">${App.escapeHtml(dish.name)}</span>
            <button class="meal-remove-btn" data-id="${id}">×</button>
          </div>
        `;
      }).join('');
    } else {
      dishesHtml = '<p style="color:#999;font-size:14px;text-align:center;padding:12px">今天还没添加菜品</p>';
    }

    // 历史记录
    let historyHtml = '';
    if (allMeals.length > 0) {
      historyHtml = allMeals.map(m => {
        const dishNames = (m.dishIds || [])
          .map(id => dishMap[id] ? dishMap[id].name : '?')
          .join('、');
        return `
          <div class="meal-history-item">
            <div class="meal-history-date">📅 ${m.date}</div>
            <div class="meal-history-dishes">${App.escapeHtml(dishNames)}</div>
            ${m.note ? `<div style="font-size:13px;color:#888;margin-top:4px">备注：${App.escapeHtml(m.note)}</div>` : ''}
          </div>
        `;
      }).join('');
    } else {
      historyHtml = '<p style="color:#999;font-size:14px;text-align:center;padding:12px">暂无历史记录</p>';
    }

    container.innerHTML = `
      <div class="meal-date-picker">
        <div class="form-group">
          <label>选择日期</label>
          <input type="date" id="meal-date" value="${today}">
        </div>
      </div>
      <div class="detail-section">
        <h3>当日菜品</h3>
        <div class="meal-dishes" id="meal-dishes">${dishesHtml}</div>
        <button class="btn btn-secondary btn-block" id="add-meal-dish-btn">➕ 添加菜品</button>
      </div>
      <div class="form-group">
        <label>备注（可选）</label>
        <textarea id="meal-note" placeholder="例如：今天盐放多了">${meal ? App.escapeHtml(meal.note || '') : ''}</textarea>
      </div>
      <button class="btn btn-primary btn-block mb-16" id="save-meal-btn">保存当日菜单</button>
      <div class="detail-section">
        <h3>历史记录</h3>
        ${historyHtml}
      </div>
    `;

    this.bindEvents(container);
  },

  bindEvents(container) {
    // 日期切换
    const dateInput = container.querySelector('#meal-date');
    dateInput.addEventListener('change', async (e) => {
      this.currentDate = e.target.value;
      await this.render(container);
    });

    // 移除菜品
    container.querySelectorAll('.meal-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        this.currentDishIds = this.currentDishIds.filter(d => d !== id);
        this.renderDishList(container);
      });
    });

    // 添加菜品
    const addBtn = container.querySelector('#add-meal-dish-btn');
    addBtn.addEventListener('click', () => {
      this.showDishPicker(container);
    });

    // 保存
    const saveBtn = container.querySelector('#save-meal-btn');
    saveBtn.addEventListener('click', async () => {
      const note = container.querySelector('#meal-note').value.trim();
      await saveMeal(this.currentDate, this.currentDishIds, note);
      App.showToast('已保存');
      await this.render(container);
    });
  },

  // 重新渲染当天菜品列表
  renderDishList(container) {
    const allDishes = null; // will be fetched in showDishPicker
    // 简单重新渲染
    this.render(container);
  },

  // 显示菜品选择器
  async showDishPicker(container) {
    const allDishes = await getAllDishes();
    const searchKeyword = '';

    const renderDishOptions = (keyword = '') => {
      let filtered = allDishes;
      if (keyword) {
        filtered = allDishes.filter(d => d.name.toLowerCase().includes(keyword.toLowerCase()));
      }
      return filtered.map(d => `
        <label class="dish-select-item">
          <input type="checkbox" value="${d.id}" ${this.currentDishIds.includes(d.id) ? 'checked' : ''}>
          <span>${App.escapeHtml(d.name)}</span>
          <span style="margin-left:auto;font-size:12px;color:#888">${App.escapeHtml(d.category)}</span>
        </label>
      `).join('');
    };

    App.showModal(`
      <div class="modal-header">
        <h3>选择菜品</h3>
        <button class="modal-close" onclick="App.closeModal()">×</button>
      </div>
      <input type="text" class="search-bar" id="dish-search" placeholder="搜索菜名..." style="margin-bottom:12px">
      <div class="dish-select-list" id="dish-select-list">${renderDishOptions()}</div>
      <button class="btn btn-primary btn-block mt-16" id="confirm-select-btn">确认添加</button>
    `);

    // 搜索
    const searchInput = document.getElementById('dish-search');
    searchInput.addEventListener('input', (e) => {
      document.getElementById('dish-select-list').innerHTML = renderDishOptions(e.target.value);
    });

    // 确认选择
    document.getElementById('confirm-select-btn').addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('#dish-select-list input[type="checkbox"]:checked');
      this.currentDishIds = Array.from(checkboxes).map(cb => Number(cb.value));
      App.closeModal();
      this.render(container);
    });
  }
};
