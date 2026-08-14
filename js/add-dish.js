// 新增/编辑菜品视图（含抖音提示词辅助）

const AddDishView = {
  // 预置提示词模板
  promptTemplate: `请根据这个抖音视频链接：{URL}
帮我提取这道菜的做法，包括：
1. 菜名
2. 所需食材和用量（包括调料的精确比例）
3. 详细步骤
4. 关键技巧/注意事项

特别注意：
- 如果视频中有文字/图片展示调料比例，请仔细识别并记录
- 如果是图片展示的比例，请描述图片内容并尽量读取上面的文字
请用简洁的文本格式输出。`,

  // 截图提取提示词（用于调料比例在图片中的情况）
  screenshotPrompt: `我刚发了几张截图，来自一个做菜视频。
这些截图中有调料比例的图片/文字。
请帮我：
1. 仔细识别每张截图上的文字和数字
2. 整理出所有调料的名称和用量
3. 如果有步骤说明，也一并整理
4. 如果看不清的地方，请标注"【需确认】"

输出格式：
【调料比例】
- 生抽：x勺
- 老抽：x勺
- ...

【步骤】
1. ...
2. ...`,

  // 渲染表单（新增或编辑）
  async render(container, editId = null) {
    let dish = null;
    let isEdit = false;
    if (editId) {
      dish = await getDishById(editId);
      if (!dish) {
        container.innerHTML = '<div class="empty-state"><p>菜品不存在</p><a href="#/" class="btn btn-primary mt-16">返回</a></div>';
        return;
      }
      isEdit = true;
    }

    const photoPreview = dish && dish.photo
      ? `<img src="${dish.photo}" style="width:100%;border-radius:8px;margin-top:8px">`
      : '';

    container.innerHTML = `
      <div class="back-bar">
        <a href="${isEdit ? `#/dish/${dish.id}` : '#/'}" class="back-btn">‹</a>
      </div>
      <form id="dish-form">
        <div class="form-group">
          <label>菜名 *</label>
          <input type="text" id="dish-name" required
                 placeholder="例如：豆角肉沫"
                 value="${dish ? App.escapeHtml(dish.name) : ''}">
        </div>
        <div class="form-group">
          <label>分类</label>
          <select id="dish-category">
            ${['荤菜', '素菜', '汤', '凉菜', '主食'].map(cat => `
              <option value="${cat}" ${dish && dish.category === cat ? 'selected' : ''}>${cat}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>细分类（按肉/烹饪方式）</label>
          <select id="dish-subcategory">
            <option value="">（未分类）</option>
            ${['低卡', '猪肉', '鸡肉', '牛肉', '海鲜', '一锅出'].map(sub => `
              <option value="${sub}" ${dish && dish.subCategory === sub ? 'selected' : ''}>${sub}</option>
            `).join('')}
          </select>
          <p style="font-size:12px;color:var(--text-light);margin-top:4px">💡 加新菜会根据菜名自动猜，不对可以手动改</p>
        </div>
        <div class="form-group">
          <label class="checkbox-group">
            <input type="checkbox" id="dish-cooked" ${dish && dish.cooked ? 'checked' : ''}>
            <span>已做过这道菜</span>
          </label>
        </div>

        <div class="form-group">
          <label>属性标签（工作日备餐参考）</label>
          <div class="tags-checkbox-group">
            ${['适合冷冻', '低脂', '高钾', '抗炎'].map(tag => `
              <label class="checkbox-group" style="margin-right:12px">
                <input type="checkbox" class="dish-tag-cb" value="${tag}" ${dish && dish.tags && dish.tags.includes(tag) ? 'checked' : ''}>
                <span>${tag}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label>抖音视频链接</label>
          <input type="url" id="dish-douyin-url"
                 placeholder="粘贴抖音视频分享链接"
                 value="${dish ? App.escapeHtml(dish.douyinUrl || '') : ''}">
        </div>

        <div class="prompt-helper">
          <p>⚡ <strong>从抖音提取做法：</strong></p>
          <p>1. 粘贴上方链接 → 2. 点"生成提示词" → 3. 打开豆包粘贴链接和提示词 → 4. 将结果粘贴到下方做法框</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
            <button type="button" class="btn btn-secondary btn-sm" id="gen-prompt-btn">📋 生成提示词</button>
            <button type="button" class="btn btn-secondary btn-sm" id="gen-screenshot-prompt-btn">📸 截图提示词</button>
          </div>
          <p style="font-size:12px;color:var(--text-light);margin-top:8px">
            💡 如果调料比例在视频图片中：暂停视频截图 → 在豆包发送截图 → 粘贴"截图提示词" → AI识别比例
          </p>
        </div>

        <div class="form-group">
          <label>食材</label>
          <textarea id="dish-ingredients"
                    placeholder="所需食材及用量，例如：&#10;豆角 300g&#10;猪肉沫 150g&#10;蒜末、生抽、盐适量">${dish ? App.escapeHtml(dish.ingredients || '') : ''}</textarea>
        </div>

        <div class="form-group">
          <label>做法</label>
          <textarea id="dish-method"
                    placeholder="详细步骤，可直接粘贴豆包返回的总结">${dish ? App.escapeHtml(dish.method || '') : ''}</textarea>
        </div>

        <div class="form-group">
          <label>预估营养（每次1份）</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
            <div>
              <label style="font-size:13px;color:var(--text-light)">🔥 热量 (kcal)</label>
              <input type="number" id="dish-calories" placeholder="例如 500" min="0" step="1"
                     value="${dish && dish.nutrition ? dish.nutrition.calories || '' : ''}" style="padding:8px;border:1px solid #eee;border-radius:8px;width:100%;margin-top:4px">
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-light)">🥔 碳水 (g)</label>
              <input type="number" id="dish-carbs" placeholder="例如 30" min="0" step="0.1"
                     value="${dish && dish.nutrition ? dish.nutrition.carbs || '' : ''}" style="padding:8px;border:1px solid #eee;border-radius:8px;width:100%;margin-top:4px">
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-light)">🥩 蛋白质 (g)</label>
              <input type="number" id="dish-protein" placeholder="例如 25" min="0" step="0.1"
                     value="${dish && dish.nutrition ? dish.nutrition.protein || '' : ''}" style="padding:8px;border:1px solid #eee;border-radius:8px;width:100%;margin-top:4px">
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-light)">🧈 脂肪 (g)</label>
              <input type="number" id="dish-fat" placeholder="例如 15" min="0" step="0.1"
                     value="${dish && dish.nutrition ? dish.nutrition.fat || '' : ''}" style="padding:8px;border:1px solid #eee;border-radius:8px;width:100%;margin-top:4px">
            </div>
          </div>
          <p style="font-size:12px;color:var(--text-light);margin-top:6px">
            💡 估算方法：食材克数 × 每100g含量 ÷ 100 × 出成率（约0.7），或用豆包问"XXX 一份多少热量"
          </p>
        </div>

        <div class="form-group">
          <label>菜品图片（可选）</label>
          <input type="file" id="dish-photo" accept="image/*">
          <div id="photo-preview">${photoPreview}</div>
        </div>

        <button type="submit" class="btn btn-primary btn-block mt-16">
          ${isEdit ? '保存修改' : '添加菜品'}
        </button>
      </form>
    `;

    this.bindEvents(container, isEdit, dish);
  },

  // 绑定事件
  bindEvents(container, isEdit, dish) {
    // 生成提示词
    const genBtn = container.querySelector('#gen-prompt-btn');
    if (genBtn) {
      genBtn.addEventListener('click', () => {
        const url = container.querySelector('#dish-douyin-url').value.trim();
        if (!url) {
          App.showToast('请先粘贴抖音链接');
          return;
        }
        const prompt = this.promptTemplate.replace('{URL}', url);

        // 尝试复制到剪贴板
        if (navigator.clipboard) {
          navigator.clipboard.writeText(prompt).then(() => {
            App.showModal(`
              <div class="modal-header">
                <h3>提示词已复制</h3>
                <button class="modal-close" onclick="App.closeModal()">×</button>
              </div>
              <div class="prompt-helper">
                <p>✅ 提示词已复制到剪贴板！</p>
                <p><strong>下一步：</strong></p>
                <p>1. 打开豆包（或其它AI工具）<br>
                   2. 粘贴抖音链接<br>
                   3. 粘贴这段提示词<br>
                   4. 获取做法总结<br>
                   5. 回到这里粘贴到"做法"框中</p>
              </div>
              <div style="background:#f5f5f5;padding:12px;border-radius:8px;font-size:13px;white-space:pre-wrap;max-height:200px;overflow-y:auto;margin-bottom:12px">${App.escapeHtml(prompt)}</div>
              <button class="btn btn-primary btn-block" onclick="App.closeModal()">知道了</button>
            `);
          }).catch(() => {
            this.showPromptModal(prompt);
          });
        } else {
          this.showPromptModal(prompt);
        }
      });
    }

    // 截图提示词按钮
    const screenshotBtn = container.querySelector('#gen-screenshot-prompt-btn');
    if (screenshotBtn) {
      screenshotBtn.addEventListener('click', () => {
        const prompt = this.screenshotPrompt;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(prompt).then(() => {
            App.showModal(`
              <div class="modal-header">
                <h3>📸 截图提示词已复制</h3>
                <button class="modal-close" onclick="App.closeModal()">×</button>
              </div>
              <div class="prompt-helper">
                <p>✅ 截图提示词已复制！</p>
                <p><strong>使用步骤：</strong></p>
                <p>1. 在抖音视频中暂停，截图有调料比例的画面<br>
                   2. 打开豆包（支持发图的AI工具）<br>
                   3. 发送截图图片<br>
                   4. 粘贴这段提示词<br>
                   5. AI会识别图片中的调料比例<br>
                   6. 将结果粘贴到下方"做法"框</p>
              </div>
              <div style="background:#f5f5f5;padding:12px;border-radius:8px;font-size:13px;white-space:pre-wrap;max-height:200px;overflow-y:auto;margin-bottom:12px">${App.escapeHtml(prompt)}</div>
              <button class="btn btn-primary btn-block" onclick="App.closeModal()">知道了</button>
            `);
          }).catch(() => {
            this.showPromptModal(prompt);
          });
        } else {
          this.showPromptModal(prompt);
        }
      });
    }

    // 图片预览
    const photoInput = container.querySelector('#dish-photo');
    if (photoInput) {
      photoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const compressed = await App.compressImage(file);
          const preview = container.querySelector('#photo-preview');
          preview.innerHTML = `<img src="${compressed}" style="width:100%;border-radius:8px;margin-top:8px">`;
          preview.dataset.photo = compressed;
        } catch (err) {
          App.showToast('图片处理失败');
        }
      });
    }

    // 表单提交
    const form = container.querySelector('#dish-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.save(container, isEdit, dish);
    });
  },

  // 显示提示词模态框（剪贴板不可用时）
  showPromptModal(prompt) {
    App.showModal(`
      <div class="modal-header">
        <h3>复制以下提示词</h3>
        <button class="modal-close" onclick="App.closeModal()">×</button>
      </div>
      <div class="prompt-helper">
        <p><strong>使用步骤：</strong></p>
        <p>1. 复制下方提示词<br>
           2. 打开豆包粘贴抖音链接和提示词<br>
           3. 获取做法后粘贴到"做法"框</p>
      </div>
      <div style="background:#f5f5f5;padding:12px;border-radius:8px;font-size:13px;white-space:pre-wrap;max-height:300px;overflow-y:auto;margin-bottom:12px">${App.escapeHtml(prompt)}</div>
      <button class="btn btn-primary btn-block" onclick="App.closeModal()">知道了</button>
    `);
  },

  // 保存菜品
  async save(container, isEdit, existingDish) {
    let name = container.querySelector('#dish-name').value.trim();
    if (!name) {
      App.showToast('请输入菜名');
      return;
    }

    // 提取菜名括号内容 → 移到做法备注
    let method = container.querySelector('#dish-method').value.trim();
    const extract = extractParenthetical(name);
    if (extract.inParenthesis) {
      name = extract.cleanName;
      const noteText = `【备注】${extract.inParenthesis}`;
      if (!method.includes(noteText)) {
        method = method ? `${noteText}\n\n${method}` : noteText;
        // 提示用户
        App.showToast(`已将括号内容移到做法备注`);
      }
    }
    if (!name) {
      App.showToast('请输入有效的菜名');
      return;
    }

    const photoPreview = container.querySelector('#photo-preview');
    const photo = photoPreview.dataset.photo || (existingDish ? existingDish.photo : null);

    const data = {
      name: name,
      category: container.querySelector('#dish-category').value,
      subCategory: container.querySelector('#dish-subcategory').value,
      cooked: container.querySelector('#dish-cooked').checked,
      douyinUrl: container.querySelector('#dish-douyin-url').value.trim(),
      ingredients: container.querySelector('#dish-ingredients').value.trim(),
      method: method,
      photo: photo,
      tags: Array.from(container.querySelectorAll('.dish-tag-cb:checked')).map(cb => cb.value),
      nutrition: {
        calories: Number(container.querySelector('#dish-calories').value) || 0,
        carbs: Number(container.querySelector('#dish-carbs').value) || 0,
        protein: Number(container.querySelector('#dish-protein').value) || 0,
        fat: Number(container.querySelector('#dish-fat').value) || 0
      }
    };

    if (isEdit) {
      await updateDish(existingDish.id, data);
      App.showToast('已保存修改');
      window.location.hash = `/dish/${existingDish.id}`;
    } else {
      const id = await addDish(data);
      App.showToast('菜品已添加');
      window.location.hash = `/dish/${id}`;
    }
  }
};
