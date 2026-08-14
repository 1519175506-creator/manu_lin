// 点餐搭配：按人数/口味/忌口组两套菜单

const OrderView = {
  guests: 4,
  tastes: [],
  avoids: [],
  sets: [],
  notes: [],

  TASTES: ['清淡', '重口辣', '减脂', '海鲜', '家常'],
  AVOIDS: ['不吃牛', '不吃海鲜', '不吃辣'],

  SLOT_LABEL: { meat: '荤', veg: '素', cold: '凉', soup: '汤' },

  async render(container) {
    container.innerHTML = `
      <div class="order-page">
        <div class="nutrition-card">
          <h3>人数</h3>
          <div class="order-stepper">
            <button type="button" class="btn btn-secondary" id="guest-minus">－</button>
            <span class="order-guest-num" id="guest-count">${this.guests}</span>
            <button type="button" class="btn btn-secondary" id="guest-plus">＋</button>
            <span class="order-guest-hint">人桌</span>
          </div>
          <p class="nutrition-note" id="quota-preview">${this.quotaPreviewText()}</p>
        </div>

        <div class="detail-section">
          <h3>口味偏好（可多选）</h3>
          <div class="filter-tabs" id="taste-tabs">
            ${this.TASTES.map(t => `
              <span class="filter-tab ${this.tastes.includes(t) ? 'active' : ''}" data-taste="${t}">${t}</span>
            `).join('')}
          </div>
          <p class="nutrition-note">不选则按家常均衡搭配</p>
        </div>

        <div class="detail-section">
          <h3>忌口</h3>
          <div class="filter-tabs" id="avoid-tabs">
            ${this.AVOIDS.map(a => `
              <span class="filter-tab ${this.avoids.includes(a) ? 'active' : ''}" data-avoid="${a}">${a}</span>
            `).join('')}
          </div>
        </div>

        <button class="btn btn-primary btn-block" id="order-suggest-btn">推荐两套菜单</button>
        <button class="btn btn-secondary btn-block mt-16" id="order-reshuffle-btn" ${this.sets.length ? '' : 'disabled'}>再来一套</button>

        <div id="order-results"></div>
      </div>
    `;

    this.bindForm(container);
    this.renderResults(container);
  },

  quotaPreviewText() {
    const q = this.getQuota(this.guests, this.tastes);
    const parts = [];
    if (q.meat) parts.push(`${q.meat}荤`);
    if (q.veg) parts.push(`${q.veg}素`);
    if (q.cold) parts.push(`${q.cold}凉`);
    if (q.soup) parts.push(`${q.soup}汤`);
    return `建议 ${parts.join(' + ') || '1荤'}（约 ${q.meat + q.veg + q.cold + q.soup} 道）`;
  },

  bindForm(container) {
    const refreshPreview = () => {
      const el = container.querySelector('#quota-preview');
      const num = container.querySelector('#guest-count');
      if (el) el.textContent = this.quotaPreviewText();
      if (num) num.textContent = String(this.guests);
    };

    container.querySelector('#guest-minus').addEventListener('click', () => {
      this.guests = Math.max(1, this.guests - 1);
      refreshPreview();
    });
    container.querySelector('#guest-plus').addEventListener('click', () => {
      this.guests = Math.min(8, this.guests + 1);
      refreshPreview();
    });

    container.querySelectorAll('#taste-tabs .filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const t = tab.dataset.taste;
        if (this.tastes.includes(t)) {
          this.tastes = this.tastes.filter(x => x !== t);
          tab.classList.remove('active');
        } else {
          this.tastes.push(t);
          tab.classList.add('active');
        }
        refreshPreview();
      });
    });

    container.querySelectorAll('#avoid-tabs .filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const a = tab.dataset.avoid;
        if (this.avoids.includes(a)) {
          this.avoids = this.avoids.filter(x => x !== a);
          tab.classList.remove('active');
        } else {
          this.avoids.push(a);
          tab.classList.add('active');
        }
      });
    });

    container.querySelector('#order-suggest-btn').addEventListener('click', async () => {
      await this.generateSets(false);
      const btn = container.querySelector('#order-reshuffle-btn');
      if (btn) btn.disabled = this.sets.length === 0;
      this.renderResults(container);
    });

    container.querySelector('#order-reshuffle-btn').addEventListener('click', async () => {
      await this.generateSets(true);
      this.renderResults(container);
    });
  },

  getQuota(n, tastes) {
    const light = (tastes || []).includes('清淡') || (tastes || []).includes('减脂');
    const table = {
      1: { meat: 1, veg: light ? 1 : 0, cold: 0, soup: 0 },
      2: { meat: 1, veg: 1, cold: 0, soup: 0 },
      3: { meat: 2, veg: 1, cold: 0, soup: 1 },
      4: { meat: 2, veg: 1, cold: 0, soup: 1 },
      5: { meat: 3, veg: 1, cold: 1, soup: 1 },
      6: { meat: 3, veg: 1, cold: 1, soup: 1 },
      7: { meat: 4, veg: 2, cold: 1, soup: 1 },
      8: { meat: 4, veg: 2, cold: 1, soup: 1 }
    };
    return { ...(table[n] || table[4]) };
  },

  getSubCats(dish) {
    return dish.subCategories || (dish.subCategory ? [dish.subCategory] : []);
  },

  getSlot(dish) {
    if (dish.category === '汤') return 'soup';
    if (dish.category === '凉菜') return 'cold';
    if (dish.category === '荤菜') return 'meat';
    return 'veg';
  },

  getProtein(dish) {
    const cats = this.getSubCats(dish);
    for (const p of ['海鲜', '牛肉', '鸡肉', '猪肉']) {
      if (cats.includes(p)) return p;
    }
    const t = (dish.name || '') + ' ' + (dish.ingredients || '');
    if (/虾|鱼|花螺|鲍鱼|鱿鱼|扇贝|蟹|海鲜|蛏/.test(t)) return '海鲜';
    if (/牛/.test(t)) return '牛肉';
    if (/鸡/.test(t)) return '鸡肉';
    if (/猪|排骨|五花|肉沫|肉末|叉烧|里脊/.test(t)) return '猪肉';
    return '';
  },

  isSpicy(dish) {
    const name = dish.name || '';
    // 菜名已是清淡/炖煮/低卡，不因蘸料里的小米辣、撒一点香辣粉判成重口
    if (/清炖|清蒸|白切|白灼|白煮|低卡/.test(name)) return false;

    const raw = name + ' ' + (dish.method || '') + ' ' + (dish.ingredients || '');
    const t = raw
      .replace(/蘸料[：:].*/g, ' ')
      .replace(/调配蘸料[\s\S]*/g, ' ')
      .replace(/香辣粉/g, ' ');

    return /麻辣|麻婆|干锅|香辣|泡椒|藤椒|剁椒|辣椒油|干辣椒|二荆条|水煮|辣子|小米辣|小米椒/.test(t)
      || (/辣/.test(name) && !/低卡|清/.test(name));
  },

  isLowCal(dish) {
    const cats = this.getSubCats(dish);
    return cats.includes('低卡') || (dish.tags || []).includes('低脂');
  },

  isOnePot(dish) {
    return this.getSubCats(dish).includes('一锅出');
  },

  dishText(dish) {
    return (dish.name || '') + ' ' + (dish.ingredients || '') + ' ' + (dish.method || '');
  },

  isAvoided(dish, avoids) {
    const protein = this.getProtein(dish);
    const spicy = this.isSpicy(dish);
    if (avoids.includes('不吃牛') && protein === '牛肉') return true;
    if (avoids.includes('不吃海鲜') && protein === '海鲜') return true;
    if (avoids.includes('不吃辣') && spicy) return true;
    return false;
  },

  scoreDish(dish, tastes, guests) {
    let score = 1;
    const protein = this.getProtein(dish);
    const spicy = this.isSpicy(dish);
    const low = this.isLowCal(dish);
    const onePot = this.isOnePot(dish);
    const prefs = tastes.length ? tastes : ['家常'];

    if (prefs.includes('清淡')) {
      if (!spicy && (dish.category === '凉菜' || dish.category === '汤' || /白切|清蒸|白灼/.test(dish.name || ''))) score += 2;
      if (spicy) score -= 1;
    }
    if (prefs.includes('重口辣')) {
      if (spicy) score += 2;
      if (!spicy && dish.category === '荤菜') score -= 1;
    }
    if (prefs.includes('减脂')) {
      if (low) score += 2;
      else score -= 1;
    }
    if (prefs.includes('海鲜')) {
      if (protein === '海鲜') score += 2;
    }
    if (prefs.includes('家常')) {
      if ((dish.tags || []).length) score += 1;
      if (dish.cooked) score += 1;
    }
    if (guests === 1 && onePot) score += 3;
    return score;
  },

  comboPenalty(picked, candidate) {
    let pen = 0;
    const p = this.getProtein(candidate);
    if (p && picked.filter(d => this.getProtein(d) === p).length >= 1) pen += 3;
    const sub = this.getSubCats(candidate)[0];
    if (sub && picked.some(d => this.getSubCats(d)[0] === sub)) pen += 2;
    if (candidate.category === '凉菜' && picked.some(d => d.category === '凉菜')) pen += 4;
    return pen;
  },

  pickForSlot(pool, slot, count, picked, reasons) {
    const chosen = [];
    const used = new Set(picked.map(d => d.id));
    let available = pool.filter(d => this.getSlot(d) === slot && !used.has(d.id));

    for (let i = 0; i < count; i++) {
      if (!available.length) break;
      available.sort((a, b) => {
        const sa = a._score - this.comboPenalty(picked.concat(chosen), a);
        const sb = b._score - this.comboPenalty(picked.concat(chosen), b);
        return sb - sa;
      });
      const dish = available.shift();
      const why = this.reasonFor(dish, slot);
      chosen.push(dish);
      reasons[dish.id] = why;
      used.add(dish.id);
      available = available.filter(d => d.id !== dish.id);
    }
    return chosen;
  },

  reasonFor(dish, slot) {
    const guests = this.guests;
    if (slot === 'soup') return `${guests} 人配汤`;
    if (slot === 'cold') return `${guests} 人配凉菜`;
    if (this.tastes.includes('海鲜') && this.getProtein(dish) === '海鲜') return '补海鲜';
    if (this.tastes.includes('减脂') && this.isLowCal(dish)) return '减脂取向';
    if (this.tastes.includes('清淡') && !this.isSpicy(dish)) return '清淡取向';
    if (this.tastes.includes('重口辣') && this.isSpicy(dish)) return '重口辣';
    if (this.guests === 1 && this.isOnePot(dish)) return '1 人一锅出';
    return this.SLOT_LABEL[slot] + '菜';
  },

  packOne(pool, quota, excludeIds) {
    const notes = [];
    const reasons = {};
    const picked = [];
    const blocked = new Set(excludeIds || []);
    const base = pool.filter(d => !blocked.has(d.id));

    const take = (slot, count) => {
      const got = this.pickForSlot(base, slot, count, picked, reasons);
      picked.push(...got);
      return got.length;
    };

    const meatN = take('meat', quota.meat);
    if (meatN < quota.meat) notes.push(`荤菜不足，已选 ${meatN} 道`);

    let soupN = take('soup', quota.soup);
    if (quota.soup && soupN < quota.soup) {
      const fill = this.pickForSlot(base, 'veg', quota.soup - soupN, picked, reasons);
      picked.push(...fill);
      fill.forEach(d => { reasons[d.id] = '汤类不足，已用素菜代替'; });
      if (fill.length) notes.push('汤类不足，已用素菜代替');
      else notes.push('汤类不足，未能补齐');
    }

    let coldN = take('cold', quota.cold);
    if (quota.cold && coldN < quota.cold) {
      const fill = this.pickForSlot(base, 'veg', quota.cold - coldN, picked, reasons);
      picked.push(...fill);
      fill.forEach(d => { reasons[d.id] = '凉菜不足，已用素菜代替'; });
      if (fill.length) notes.push('凉菜不足，已用素菜代替');
      else notes.push('凉菜不足，未能补齐');
    }

    const vegN = take('veg', quota.veg);
    if (vegN < quota.veg) notes.push(`素菜不足，已选 ${vegN} 道`);

    return {
      dishes: picked.map(d => ({
        id: d.id,
        slot: this.getSlot(d),
        reason: reasons[d.id] || this.SLOT_LABEL[this.getSlot(d)]
      })),
      notes: [...new Set(notes)]
    };
  },

  async generateSets(reshuffle) {
    const all = await getAllDishes();
    const quota = this.getQuota(this.guests, this.tastes);
    const pool = all
      .filter(d => !this.isAvoided(d, this.avoids))
      .map(d => {
        d._score = this.scoreDish(d, this.tastes, this.guests);
        return d;
      });

    if (!pool.length) {
      this.sets = [];
      this.notes = ['忌口过滤后没有可选菜品'];
      App.showToast('没有符合忌口的菜');
      return;
    }

    const salt = reshuffle ? Math.floor(Math.random() * 1000) : 0;
    pool.forEach(d => { d._score += ((d.id || 0) + salt) % 3; });

    const setA = this.packOne(pool, quota, []);
    const excludeMeat = setA.dishes.filter(x => x.slot === 'meat').map(x => x.id);
    const setB = this.packOne(pool, quota, excludeMeat);

    this.sets = [setA, setB].filter(s => s.dishes.length > 0);
    App.showToast(this.sets.length ? `已推荐 ${this.sets.length} 套菜单` : '候选菜不足');
  },

  async resolveSet(set) {
    const all = await getAllDishes();
    const map = new Map(all.map(d => [d.id, d]));
    return set.dishes.map(item => ({
      ...item,
      dish: map.get(item.id)
    })).filter(x => x.dish);
  },

  renderResults(container) {
    const box = container.querySelector('#order-results');
    if (!box) return;
    if (!this.sets.length) {
      box.innerHTML = '';
      return;
    }

    Promise.all(this.sets.map(s => this.resolveSet(s))).then(resolved => {
      box.innerHTML = resolved.map((items, idx) => {
        const notes = (this.sets[idx].notes || []).map(n => `<p class="nutrition-note">${App.escapeHtml(n)}</p>`).join('');
        const rows = items.map((item, di) => {
          const d = item.dish;
          const slot = item.slot;
          return `
            <div class="dish-card" data-set="${idx}" data-index="${di}">
              <div class="dish-info" style="flex:1">
                <div class="dish-name">${App.escapeHtml(d.name)}</div>
                <div class="dish-meta">
                  <span class="dish-category">${App.escapeHtml(d.category)}</span>
                  <span class="dish-tag-mini">${this.SLOT_LABEL[slot] || slot}</span>
                </div>
                <div class="dish-tags-row">
                  <span class="dish-tag-mini">${App.escapeHtml(item.reason)}</span>
                </div>
              </div>
              <button type="button" class="btn btn-secondary order-swap-btn" data-set="${idx}" data-index="${di}">换一道</button>
            </div>
          `;
        }).join('');
        return `
          <div class="detail-section order-set">
            <h3>方案 ${idx === 0 ? 'A' : 'B'}</h3>
            ${notes}
            <div class="dish-list">${rows}</div>
            <button type="button" class="btn btn-primary btn-block mt-16 order-save-btn" data-set="${idx}">加入今日菜单</button>
          </div>
        `;
      }).join('');

      box.querySelectorAll('.order-swap-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.swapDish(Number(btn.dataset.set), Number(btn.dataset.index));
          this.renderResults(container);
        });
      });

      box.querySelectorAll('.order-save-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          await this.saveToToday(Number(btn.dataset.set));
        });
      });
    });
  },

  async swapDish(setIdx, dishIdx) {
    const set = this.sets[setIdx];
    if (!set) return;
    const current = set.dishes[dishIdx];
    if (!current) return;

    const all = await getAllDishes();
    const used = new Set(set.dishes.map(d => d.id));
    const pool = all
      .filter(d => !this.isAvoided(d, this.avoids))
      .filter(d => this.getSlot(d) === current.slot)
      .filter(d => !used.has(d.id))
      .map(d => {
        const clonePicked = set.dishes
          .filter((_, i) => i !== dishIdx)
          .map(x => all.find(a => a.id === x.id))
          .filter(Boolean);
        d._score = this.scoreDish(d, this.tastes, this.guests) - this.comboPenalty(clonePicked, d);
        return d;
      })
      .sort((a, b) => b._score - a._score);

    if (!pool.length) {
      App.showToast('没有可替换的同类型菜');
      return;
    }

    const next = pool[0];
    set.dishes[dishIdx] = {
      id: next.id,
      slot: current.slot,
      reason: this.reasonFor(next, current.slot)
    };
    App.showToast(`已换成 ${next.name}`);
  },

  async saveToToday(setIdx) {
    const set = this.sets[setIdx];
    if (!set || !set.dishes.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const ids = set.dishes.map(d => d.id);
    await saveMeal(today, ids, '点餐搭配');
    App.showToast('已写入今日菜单');
  }
};
