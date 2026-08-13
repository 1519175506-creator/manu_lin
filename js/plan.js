// 每周计划视图：周日烹饪清单 + 每顿2荤1素

const PlanView = {
  currentWeekStart: '',
  sundayPlan: null,  // { meatDishIds: [3], vegDishIds: [2] }
  slots: [],         // [{ key, day, meal, meatDishIds: [2], vegDishId: 1 }]

  mealSlots: [
    { day: '周一', meal: '午饭', key: 'mon_lunch' },
    { day: '周二', meal: '午饭', key: 'tue_lunch' },
    { day: '周三', meal: '午饭', key: 'wed_lunch' },
    { day: '周四', meal: '午饭', key: 'thu_lunch' },
    { day: '周五', meal: '午饭', key: 'fri_lunch' },
    { day: '周六', meal: '晚饭', key: 'sat_dinner' },
    { day: '周日', meal: '晚饭', key: 'sun_dinner' },
  ],

  async render(container, skipLoad = false) {
    if (!this.currentWeekStart) {
      this.currentWeekStart = this.getWeekStart(new Date());
    }

    if (!skipLoad) {
      const plan = await getWeeklyPlan(this.currentWeekStart);
      this.sundayPlan = plan ? (plan.sundayPlan || null) : null;
      this.slots = plan ? (plan.slots || []) : [];
    }

    const weekDates = this.getWeekDates(this.currentWeekStart);
    const weekLabel = `${weekDates[0].slice(5)} ~ ${weekDates[6].slice(5)}`;

    const allDishes = await getAllDishes();
    const dishMap = {};
    allDishes.forEach(d => { dishMap[d.id] = d; });

    // 渲染周日烹饪清单
    const sundayHtml = this.renderSundayPlan(dishMap);

    // 渲染餐位
    let slotsHtml = '';
    for (const slot of this.mealSlots) {
      const assigned = this.slots.find(s => s.key === slot.key);
      const meatIds = assigned ? (assigned.meatDishIds || []) : [];
      const vegId = assigned ? assigned.vegDishId : null;

      const meatDishes = meatIds.map(id => dishMap[id]).filter(d => d);
      const vegDish = vegId ? dishMap[vegId] : null;

      const meatHtml = meatDishes.map(d => {
        const tagsHtml = (d.tags || []).map(t => `<span class="dish-tag-mini">${t}</span>`).join('');
        return `<div class="plan-slot-dish plan-meat">
                  <span class="plan-dish-name">🍖 ${App.escapeHtml(d.name)}</span>
                  <div class="dish-tags-row">${tagsHtml}</div>
                </div>`;
      }).join('');

      const vegHtml = vegDish
        ? `<div class="plan-slot-dish plan-veg">
             <span class="plan-dish-name">🥬 ${App.escapeHtml(vegDish.name)}</span>
             <div class="dish-tags-row">${(vegDish.tags || []).map(t => `<span class="dish-tag-mini">${t}</span>`).join('')}</div>
           </div>`
        : '';

      slotsHtml += `
        <div class="plan-slot" data-key="${slot.key}" data-day="${slot.day}">
          <div class="plan-slot-header">
            <span class="plan-slot-day">${slot.day} ${slot.meal}</span>
            ${(meatIds.length > 0 || vegId) ? `<button class="plan-slot-clear" data-key="${slot.key}" title="清除">×</button>` : ''}
          </div>
          ${(meatHtml || vegHtml)
            ? `<div class="plan-slot-dishes">${meatHtml}${vegHtml}</div>`
            : `<div class="plan-slot-empty">点击选择 2荤1素</div>`
          }
        </div>
      `;
    }

    // 标签统计
    const selectedMeatIds = new Set();
    const selectedVegIds = new Set();
    this.slots.forEach(s => {
      (s.meatDishIds || []).forEach(id => selectedMeatIds.add(id));
      if (s.vegDishId) selectedVegIds.add(s.vegDishId);
    });
    const tagCounts = {};
    [...selectedMeatIds, ...selectedVegIds].forEach(id => {
      const d = dishMap[id];
      if (d) (d.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
    });
    let tagSummaryHtml = '';
    if (Object.keys(tagCounts).length > 0) {
      tagSummaryHtml = Object.entries(tagCounts).map(([tag, count]) =>
        `<span class="plan-tag-summary tag-${tag}">${tag} ×${count}</span>`
      ).join('');
    }

    container.innerHTML = `
      <div class="plan-week-nav">
        <button class="btn btn-secondary btn-sm" id="prev-week">‹ 上周</button>
        <span class="plan-week-label">${weekLabel}</span>
        <button class="btn btn-secondary btn-sm" id="next-week">下周 ›</button>
      </div>

      <div class="plan-dietary-hint">
        <p>🎯 <strong>备餐模式：</strong>周日批量烹饪 → 每顿2荤1素分装</p>
        <p style="font-size:12px;color:var(--text-light);margin-top:4px">
          先选周日要做的菜 → 再为每顿分配2荤1素
        </p>
      </div>

      ${tagSummaryHtml ? `<div class="plan-tag-summary-row">${tagSummaryHtml}</div>` : ''}

      <div class="plan-sunday-plan-section">${sundayHtml}</div>

      <div class="plan-section-title">🍱 每日餐食安排（每顿 2荤 + 1素）</div>
      <div class="plan-slots">${slotsHtml}</div>

      <button class="btn btn-primary btn-block mt-16" id="save-plan-btn">💾 保存本周计划</button>
      <button class="btn btn-secondary btn-block mt-16" id="smart-suggest-btn">⚡ 智能推荐整周菜单</button>
      <button class="btn btn-secondary btn-block mt-8" id="auto-assign-btn">🔄 从周日清单自动分配</button>

      <div class="plan-tips">
        <h3>💡 备餐小贴士</h3>
        <ul>
          <li>周日做3荤2素，分装为7顿×(2荤+1素)</li>
          <li>选择有"适合冷冻"标签的菜，复热口感更好</li>
          <li>汤类、炖菜类冷冻复热效果最佳</li>
          <li>叶菜类凉拌菜不建议冷冻</li>
          <li>分装时按顿分盒，避免反复解冻</li>
        </ul>
      </div>
    `;

    this.bindEvents(container);
  },

  renderSundayPlan(dishMap) {
    const meatIds = this.sundayPlan ? (this.sundayPlan.meatDishIds || []) : [];
    const vegIds = this.sundayPlan ? (this.sundayPlan.vegDishIds || []) : [];

    let meatHtml = '';
    for (let i = 0; i < 3; i++) {
      const id = meatIds[i];
      const d = id ? dishMap[id] : null;
      if (d) {
        const tagsHtml = (d.tags || []).map(t => `<span class="dish-tag-mini">${t}</span>`).join('');
        meatHtml += `<div class="plan-sunday-item" data-type="meat" data-index="${i}">
          <div class="plan-sunday-item-info">
            <span class="plan-dish-name">🍖 ${App.escapeHtml(d.name)}</span>
            <div class="dish-tags-row">${tagsHtml}</div>
          </div>
          <button class="plan-sunday-remove" data-type="meat" data-index="${i}">×</button>
        </div>`;
      } else {
        meatHtml += `<div class="plan-sunday-item empty" data-type="meat" data-index="${i}">
          <span>🍖 选择荤菜 ${i + 1}</span>
        </div>`;
      }
    }

    let vegHtml = '';
    for (let i = 0; i < 2; i++) {
      const id = vegIds[i];
      const d = id ? dishMap[id] : null;
      const isDefault = i === 0;
      if (d) {
        const tagsHtml = (d.tags || []).map(t => `<span class="dish-tag-mini">${t}</span>`).join('');
        vegHtml += `<div class="plan-sunday-item" data-type="veg" data-index="${i}">
          <div class="plan-sunday-item-info">
            <span class="plan-dish-name">🥬 ${App.escapeHtml(d.name)}${isDefault ? ' <span style="font-size:11px;color:#ff9800">(推荐：炒青菜)</span>' : ''}</span>
            <div class="dish-tags-row">${tagsHtml}</div>
          </div>
          <button class="plan-sunday-remove" data-type="veg" data-index="${i}">×</button>
        </div>`;
      } else {
        vegHtml += `<div class="plan-sunday-item empty" data-type="veg" data-index="${i}">
          <span>🥬 选择素菜 ${i + 1}${isDefault ? ' (推荐：炒青菜)' : ''}</span>
        </div>`;
      }
    }

    return `
      <div class="plan-section-title">🥘 周日烹饪清单（3荤 + 2素）</div>
      <div class="plan-sunday-group">
        <div class="plan-sunday-label">荤菜（3道）</div>
        <div class="plan-sunday-items">${meatHtml}</div>
      </div>
      <div class="plan-sunday-group">
        <div class="plan-sunday-label">素菜（2道）</div>
        <div class="plan-sunday-items">${vegHtml}</div>
      </div>
    `;
  },

  bindEvents(container) {
    container.querySelector('#prev-week').addEventListener('click', () => {
      const d = new Date(this.currentWeekStart);
      d.setDate(d.getDate() - 7);
      this.currentWeekStart = this.getWeekStart(d);
      this.render(container);
    });

    container.querySelector('#next-week').addEventListener('click', () => {
      const d = new Date(this.currentWeekStart);
      d.setDate(d.getDate() + 7);
      this.currentWeekStart = this.getWeekStart(d);
      this.render(container);
    });

    // 点击周日烹饪清单项
    container.querySelectorAll('.plan-sunday-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('plan-sunday-remove')) return;
        const type = item.dataset.type;
        const index = parseInt(item.dataset.index);
        this.showSundayPicker(container, type, index);
      });
    });

    // 移除周日清单项
    container.querySelectorAll('.plan-sunday-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.dataset.type;
        const index = parseInt(btn.dataset.index);
        if (!this.sundayPlan) this.sundayPlan = { meatDishIds: [], vegDishIds: [] };
        if (type === 'meat') {
          this.sundayPlan.meatDishIds.splice(index, 1);
        } else {
          this.sundayPlan.vegDishIds.splice(index, 1);
        }
        this.render(container, true);
      });
    });

    // 点击餐位
    container.querySelectorAll('.plan-slot').forEach(slotEl => {
      slotEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('plan-slot-clear')) return;
        const key = slotEl.dataset.key;
        this.showMealPicker(container, key);
      });
    });

    // 清除餐位
    container.querySelectorAll('.plan-slot-clear').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.key;
        this.slots = this.slots.filter(s => s.key !== key);
        this.render(container, true);
      });
    });

    // 保存
    container.querySelector('#save-plan-btn').addEventListener('click', async () => {
      const planData = {
        sundayPlan: this.sundayPlan,
        slots: this.slots
      };
      await saveWeeklyPlan(this.currentWeekStart, planData);
      App.showToast('本周计划已保存 ⚡');
    });

    // 智能推荐
    container.querySelector('#smart-suggest-btn').addEventListener('click', () => {
      this.smartSuggest(container);
    });

    // 从周日清单自动分配
    container.querySelector('#auto-assign-btn').addEventListener('click', () => {
      this.autoAssignFromSunday(container);
    });
  },

  // 周日烹饪清单选择器
  async showSundayPicker(container, type, index) {
    const allDishes = await getAllDishes();
    const isMeat = type === 'meat';
    const mealCategories = ['荤菜'];
    const vegCategories = ['素菜', '汤', '凉菜'];
    const allowedCategories = isMeat ? mealCategories : vegCategories;

    let filtered = allDishes.filter(d => allowedCategories.includes(d.category));

    const tags = ['适合冷冻', '低脂', '高钾', '抗炎'];
    const sortByTags = (dishes) => {
      return [...dishes].sort((a, b) => {
        const scoreA = (a.tags || []).filter(t => tags.includes(t)).length;
        const scoreB = (b.tags || []).filter(t => tags.includes(t)).length;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return (b.cooked ? 1 : 0) - (a.cooked ? 1 : 0);
      });
    };

    filtered = sortByTags(filtered);

    const title = isMeat ? `选择荤菜 ${index + 1}` : `选择素菜 ${index + 1}`;
    const currentIds = this.sundayPlan
      ? (isMeat ? this.sundayPlan.meatDishIds : this.sundayPlan.vegDishIds)
      : [];
    const currentId = currentIds[index] || null;

    const renderList = (filterTag = '', keyword = '') => {
      let list = filtered;
      if (filterTag) list = list.filter(d => d.tags && d.tags.includes(filterTag));
      if (keyword) list = list.filter(d => d.name.includes(keyword));
      return list.map(d => {
        const isUsed = currentIds.includes(d.id) && d.id !== currentId;
        const tagsHtml = (d.tags || []).map(t => `<span class="dish-tag-mini">${t}</span>`).join('');
        return `
          <label class="dish-select-item ${isUsed ? 'dish-used' : ''}">
            <input type="radio" name="sunday-dish" value="${d.id}" ${d.id === currentId ? 'checked' : ''}>
            <span class="meal-dish-name">${App.escapeHtml(d.name)}</span>
            ${d.cooked ? '<span style="color:var(--success);font-size:12px">✔</span>' : ''}
            <div class="dish-tags-row">${tagsHtml}</div>
            ${isUsed ? '<span style="color:#ff9800;font-size:11px">已选</span>' : ''}
          </label>
        `;
      }).join('');
    };

    App.showModal(`
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="App.closeModal()">×</button>
      </div>
      <div class="filter-tabs" style="margin-bottom:12px">
        <span class="filter-tab active" data-tag="">全部</span>
        ${tags.map(t => `<span class="filter-tab" data-tag="${t}">${t}</span>`).join('')}
      </div>
      <input type="text" class="search-bar" id="picker-search" placeholder="搜索菜名..." style="margin-bottom:12px">
      <div class="dish-select-list" id="picker-list">${renderList()}</div>
      <button class="btn btn-primary btn-block mt-16" id="confirm-pick">确认选择</button>
    `);

    const filterTabs = document.querySelectorAll('#modal-content .filter-tab');
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tag = tab.dataset.tag;
        const keyword = document.getElementById('picker-search').value;
        document.getElementById('picker-list').innerHTML = renderList(tag, keyword);
      });
    });

    document.getElementById('picker-search').addEventListener('input', (e) => {
      const activeTab = document.querySelector('#modal-content .filter-tab.active');
      const tag = activeTab ? activeTab.dataset.tag : '';
      document.getElementById('picker-list').innerHTML = renderList(tag, e.target.value);
    });

    document.getElementById('confirm-pick').addEventListener('click', () => {
      const selected = document.querySelector('input[name="sunday-dish"]:checked');
      if (!selected) {
        App.showToast('请选择一道菜');
        return;
      }
      const dishId = Number(selected.value);
      if (!this.sundayPlan) this.sundayPlan = { meatDishIds: [], vegDishIds: [] };
      if (isMeat) {
        this.sundayPlan.meatDishIds[index] = dishId;
      } else {
        this.sundayPlan.vegDishIds[index] = dishId;
      }
      App.closeModal();
      this.render(container, true);
    });
  },

  // 餐位选择器：选2荤1素
  async showMealPicker(container, slotKey) {
    const allDishes = await getAllDishes();
    const currentSlot = this.slots.find(s => s.key === slotKey);
    const currentMeatIds = currentSlot ? (currentSlot.meatDishIds || []) : [];
    const currentVegId = currentSlot ? currentSlot.vegDishId : null;

    // 如果有周日清单，限制菜品范围
    const sundayMeatIds = this.sundayPlan ? (this.sundayPlan.meatDishIds || []) : [];
    const sundayVegIds = this.sundayPlan ? (this.sundayPlan.vegDishIds || []) : [];

    const meatDishes = sundayMeatIds.length > 0
      ? sundayMeatIds.map(id => allDishes.find(d => d.id === id)).filter(d => d)
      : allDishes.filter(d => d.category === '荤菜');
    const vegDishes = sundayVegIds.length > 0
      ? sundayVegIds.map(id => allDishes.find(d => d.id === id)).filter(d => d)
      : allDishes.filter(d => d.category === '素菜' || d.category === '汤' || d.category === '凉菜');

    const tags = ['适合冷冻', '低脂', '高钾', '抗炎'];

    const renderDishItem = (dish, type, checked) => {
      const tagsHtml = (dish.tags || []).map(t => `<span class="dish-tag-mini">${t}</span>`).join('');
      return `
        <label class="dish-select-item">
          <input type="${type === 'veg' ? 'radio' : 'checkbox'}" name="meal-${type}" value="${dish.id}" ${checked ? 'checked' : ''}>
          <span class="meal-dish-name">${App.escapeHtml(dish.name)}</span>
          ${dish.cooked ? '<span style="color:var(--success);font-size:12px">✔</span>' : ''}
          <div class="dish-tags-row">${tagsHtml}</div>
        </label>
      `;
    };

    const renderList = (dishes, type, currentIds, currentId) => {
      return dishes.map(d => {
        const checked = type === 'veg'
          ? d.id === currentId
          : currentIds.includes(d.id);
        return renderDishItem(d, type, checked);
      }).join('');
    };

    App.showModal(`
      <div class="modal-header">
        <h3>选择2荤1素</h3>
        <button class="modal-close" onclick="App.closeModal()">×</button>
      </div>
      ${sundayMeatIds.length > 0 || sundayVegIds.length > 0
        ? '<p style="font-size:12px;color:#888;margin-bottom:8px">💡 仅显示周日烹饪清单中的菜品</p>'
        : ''}
      <div class="meal-picker-section">
        <h4 style="margin:8px 0 4px;font-size:14px">🍖 荤菜（选2道）</h4>
        <div class="dish-select-list" id="meal-meat-list">${renderList(meatDishes, 'meat', currentMeatIds)}</div>
      </div>
      <div class="meal-picker-section">
        <h4 style="margin:12px 0 4px;font-size:14px">🥬 素菜（选1道）</h4>
        <div class="dish-select-list" id="meal-veg-list">${renderList(vegDishes, 'veg', currentMeatIds, currentVegId)}</div>
      </div>
      <button class="btn btn-primary btn-block mt-16" id="confirm-meal">确认选择</button>
    `);

    document.getElementById('confirm-meal').addEventListener('click', () => {
      const checkedMeats = document.querySelectorAll('input[name="meal-meat"]:checked');
      const checkedVeg = document.querySelector('input[name="meal-veg"]:checked');

      if (checkedMeats.length !== 2) {
        App.showToast('请选择2道荤菜');
        return;
      }
      if (!checkedVeg) {
        App.showToast('请选择1道素菜');
        return;
      }

      const meatDishIds = Array.from(checkedMeats).map(cb => Number(cb.value));
      const vegDishId = Number(checkedVeg.value);

      this.slots = this.slots.filter(s => s.key !== slotKey);
      const slotDef = this.mealSlots.find(m => m.key === slotKey);
      this.slots.push({
        key: slotKey,
        day: slotDef.day,
        meal: slotDef.meal,
        meatDishIds: meatDishIds,
        vegDishId: vegDishId
      });
      App.closeModal();
      this.render(container, true);
    });
  },

  // 从周日清单自动分配每顿的2荤1素
  autoAssignFromSunday(container) {
    if (!this.sundayPlan || !this.sundayPlan.meatDishIds || this.sundayPlan.meatDishIds.length === 0) {
      App.showToast('请先在周日烹饪清单中选择菜品');
      return;
    }
    const meatIds = this.sundayPlan.meatDishIds;
    const vegIds = this.sundayPlan.vegDishIds || [];
    if (vegIds.length === 0) {
      App.showToast('请先在周日烹饪清单中添加素菜');
      return;
    }

    const newSlots = [];
    this.mealSlots.forEach((slot, i) => {
      // 循环分配荤菜：每顿2道，从3道中轮流组合
      const m1 = meatIds[i % meatIds.length];
      const m2 = meatIds[(i + 1) % meatIds.length];
      // 如果3道荤菜，则每顿选不同的2道组合
      let meatPair;
      if (meatIds.length === 3) {
        const pairs = [[0,1], [0,2], [1,2]];
        const pair = pairs[i % pairs.length];
        meatPair = [meatIds[pair[0]], meatIds[pair[1]]];
      } else {
        meatPair = [m1, m2];
      }

      // 轮流分配素菜
      const vegId = vegIds[i % vegIds.length];

      newSlots.push({
        key: slot.key,
        day: slot.day,
        meal: slot.meal,
        meatDishIds: meatPair,
        vegDishId: vegId
      });
    });

    this.slots = newSlots;
    App.showToast('已从周日清单自动分配 ⚡');
    this.render(container, true);
  },

  // 智能推荐
  async smartSuggest(container) {
    const allDishes = await getAllDishes();
    const tags = ['适合冷冻', '低脂', '高钾', '抗炎'];

    // 筛选有目标标签的菜
    const candidates = allDishes
      .filter(d => (d.tags || []).some(t => tags.includes(t)))
      .sort((a, b) => {
        const scoreA = (a.tags || []).filter(t => tags.includes(t)).length;
        const scoreB = (b.tags || []).filter(t => tags.includes(t)).length;
        return scoreB - scoreA;
      });

    if (candidates.length === 0) {
      App.showToast('暂无带标签的菜品，请先为菜品添加标签');
      return;
    }

    const meatCandidates = candidates.filter(d => d.category === '荤菜');
    const vegCandidates = candidates.filter(d => d.category !== '荤菜');

    if (meatCandidates.length < 2 || vegCandidates.length < 1) {
      App.showToast('带标签的菜品不足，需要至少2荤1素');
      return;
    }

    // 选3道荤菜作为周日烹饪
    const shuffledMeat = [...meatCandidates].sort(() => Math.random() - 0.5);
    const sundayMeat = shuffledMeat.slice(0, Math.min(3, shuffledMeat.length));

    // 选2道素菜
    const shuffledVeg = [...vegCandidates].sort(() => Math.random() - 0.5);
    const sundayVeg = shuffledVeg.slice(0, Math.min(2, shuffledVeg.length));

    this.sundayPlan = {
      meatDishIds: sundayMeat.map(d => d.id),
      vegDishIds: sundayVeg.map(d => d.id)
    };

    // 自动分配每顿2荤1素
    this.autoAssignFromSunday(container);
    App.showToast('已智能推荐整周菜单 ⚡');
  },

  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().slice(0, 10);
  },

  getWeekDates(weekStart) {
    const dates = [];
    const d = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      dates.push(new Date(d).toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }
};
