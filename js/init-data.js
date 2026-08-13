// 初始数据导入 - 首次启动时从 JSON 加载菜品清单
async function initInitialData() {
  const initialized = await isInitialized();
  if (initialized) return false;

  try {
    const response = await fetch('data/initial-dishes.json');
    const dishes = await response.json();
    for (const dish of dishes) {
      await addDish(dish);
    }
    return true;
  } catch (err) {
    console.error('初始数据导入失败:', err);
    return false;
  }
}

// 追加导入新菜品（不覆盖已有）
async function importNewDishes() {
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
    return addedCount;
  } catch (err) {
    console.error('新菜品导入失败:', err);
    return 0;
  }
}

// 批量补充菜谱（食材+做法）- 从 recipes.json 加载并更新已有菜品
async function loadRecipes() {
  try {
    const response = await fetch('data/recipes.json');
    const recipes = await response.json();
    const allDishes = await getAllDishes();
    let updatedCount = 0;

    for (const recipe of recipes) {
      // 按菜名匹配已有菜品
      const dish = allDishes.find(d => d.name === recipe.name);
      if (dish && !dish.method) {
        await updateDish(dish.id, {
          ingredients: recipe.ingredients,
          method: recipe.method
        });
        updatedCount++;
      }
    }
    return updatedCount;
  } catch (err) {
    console.error('菜谱加载失败:', err);
    return 0;
  }
}

// ============ 抖音收藏夹菜谱批量导入 ============

// 从任意抖音链接提取视频ID（纯数字，15-20位）
function extractDouyinVideoId(url) {
  if (!url) return null;
  // 标准：/video/7673072641440586353
  let m = url.match(/\/video\/(\d{15,22})/);
  if (m) return m[1];
  // modal_id=7673072641440586353
  m = url.match(/modal_id=(\d{15,22})/);
  if (m) return m[1];
  // from_tab_name=7667043901531126778 （豆包写错的链接）
  m = url.match(/from_tab_name=(\d{15,22})/);
  if (m) return m[1];
  return null;
}

// 从菜名中提取括号内容，追加到做法开头（跟db.js一致）
function extractNameParenthetical(name) {
  const bracketPatterns = [
    /\(([^)]*)\)/g,
    /（([^）]*)）/g,
    /\[([^\]]*)\]/g,
    /【([^】]*)】/g
  ];
  const inParenthesis = [];
  let cleanName = name;
  for (const pattern of bracketPatterns) {
    let match;
    while ((match = pattern.exec(name)) !== null) {
      inParenthesis.push(match[1]);
      cleanName = cleanName.replace(match[0], '');
    }
  }
  cleanName = cleanName.replace(/\s+/g, ' ').trim();
  return { cleanName, inParenthesis };
}

// 根据菜名和食材内容自动猜分类
function guessCategoryAndSub(recipe) {
  const text = (recipe.name + ' ' + recipe.ingredients + ' ' + recipe.method).toLowerCase();

  // subCategory 优先匹配
  let subCategory = '';
  if (text.includes('空气炸锅')) {
    subCategory = '空气炸锅';
  } else if (text.includes('一锅出') || text.includes('焖饭') || text.includes('焖菜') || text.includes('无水焗') || text.includes('蒸面') || text.includes('焖牛肉') || /一?锅(?!巴)/.test(text) || text.includes('电饭煲') && /饭/.test(text)) {
    subCategory = '一锅出';
  } else if (/\b虾\b|鱼|花螺|鲍鱼|鱿鱼|扇贝|蟹|贝|海鲜|虾仁|虾滑|基围虾|罗氏虾/.test(text)) {
    subCategory = '海鲜';
  } else if (/牛|牛腩|牛腱|牛排|肥牛|牛肉/.test(text)) {
    subCategory = '牛肉';
  } else if (/鸡|鸡腿|鸡胸|鸡翅|奥尔良|鸡块|鸡肉|鸡丝|鸡肉|鸡架/.test(text)) {
    subCategory = '鸡肉';
  } else if (/猪|猪肉|排骨|五花肉|梅花肉|猪排|肋排|里脊|肉馅|肉沫|五花/.test(text)) {
    subCategory = '猪肉';
  }

  // category（荤菜 / 素菜）
  let category = '荤菜';
  if (!/猪|牛|鸡|羊|鱼|虾|肉|蛋|排骨|五花|鸡翅|鸡腿|鸡胸|海鲜|牛肉|鸡肉|猪肉|牛排|猪排|牛腩|虾仁|虾滑|扇贝|花螺|鲍鱼|鱿鱼/.test(text)) {
    category = '素菜';
  }

  return { category, subCategory };
}

// 解析"收藏夹菜谱.txt"的文本内容 → 菜谱数组
function parseFavoritesTxt(text) {
  const recipes = [];
  // 兼容中文/英文冒号
  const lines = text.split(/\r?\n/);
  let current = null;
  let stage = null; // null / '菜名' / '食材' / '做法'
  let parenCount = 0;

  for (let rawLine of lines) {
    // 非破坏性空格（&nbsp;等）
    const line = rawLine.replace(/\u00a0/g, ' ').trimRight();

    // 开始新菜谱块："编号：XX" 或 "编号:XX"
    const numMatch = line.match(/^\s*编号[：:]\s*(\d+)\s*$/);
    if (numMatch) {
      if (current) recipes.push(current);
      current = {
        blockNo: numMatch[1],
        name: '',
        ingredients: '',
        method: '',
        videoUrl: ''
      };
      stage = null;
      continue;
    }

    if (!current) continue;

    // 菜名行
    const nameMatch = line.match(/^\s*菜名[：:]\s*(.+?)\s*$/);
    if (nameMatch) {
      current.name = nameMatch[1].trim();
      stage = '菜名';
      continue;
    }

    // 食材行开始
    if (/^\s*食材[：:]\s*$/.test(line) || /^\s*食材分款[：:]\s*$/.test(line)) {
      stage = '食材';
      current.ingredients = '';
      continue;
    }

    // 做法行开始
    if (/^\s*做法[：:]\s*$/.test(line)) {
      stage = '做法';
      current.method = '';
      continue;
    }

    // 视频链接行
    const videoMatch = line.match(/^\s*视频链接[：:]\s*(.+?)\s*$/);
    if (videoMatch) {
      current.videoUrl = videoMatch[1].trim();
      stage = null;
      continue;
    }

    // 跳过分隔线（如 ---）
    if (/^\s*[-=*#\s]+\s*$/.test(line) && line.trim().length >= 3) continue;
    // 跳过纯中文注释行（"这条视频主打..."、"# 视频内容总结"）
    if (/^\s*#/.test(line)) continue;
    if (/^\s*视频内容总结/.test(line)) continue;

    // 根据阶段追加内容
    if (stage === '食材') {
      if (line.trim() === '') {
        if (current.ingredients && !current.ingredients.endsWith('\n')) current.ingredients += '\n';
        continue;
      }
      current.ingredients += line.replace(/^\s+/, '') + '\n';
    } else if (stage === '做法') {
      if (line.trim() === '') {
        if (current.method && !current.method.endsWith('\n')) current.method += '\n';
        continue;
      }
      current.method += line.replace(/^\s+/, '') + '\n';
    } else if (stage === '菜名') {
      // 菜名跨行（极少见）
      current.name += line.trim();
    }
  }
  if (current) recipes.push(current);

  // 清理尾部空行
  for (const r of recipes) {
    r.ingredients = (r.ingredients || '').replace(/\s+$/g, '');
    r.method = (r.method || '').replace(/\s+$/g, '');
  }
  return recipes;
}

// 从收藏夹菜谱1.txt和2.txt导入（带幂等）
// 策略：先删除所有"抖音视频XX"占位菜品，再从txt文件直接创建新菜品
async function importFromFavoritesTxt() {
  const DONE_KEY = 'favorites_import_done_v2';
  // 用localStorage做幂等标记，避免依赖db.meta表
  if (localStorage.getItem(DONE_KEY)) {
    return { alreadyDone: true };
  }

  // 1. 删除所有"抖音视频XX"占位菜品
  const allDishes = await getAllDishes();
  const placeholders = allDishes.filter(d => /^抖音视频\s*\d+\s*$/.test(d.name));
  for (const p of placeholders) {
    await db.dishes.delete(p.id);
  }

  // 2. 读取两个菜谱文件
  const files = ['data/收藏夹菜谱1.txt', 'data/收藏夹菜谱2.txt'];
  let allRecipes = [];
  for (const f of files) {
    try {
      const res = await fetch(f);
      if (!res.ok) { console.warn(`读取${f}失败:`, res.status); continue; }
      const text = await res.text();
      const recipes = parseFavoritesTxt(text);
      allRecipes = allRecipes.concat(recipes);
    } catch (e) {
      console.warn(`读取${f}异常:`, e);
    }
  }

  // 3. 按视频ID+菜名去重，创建菜品
  const seenVideoIds = new Set();
  const seenNames = new Set();
  let createdNew = 0;
  let skippedDup = 0;
  let skippedNoName = 0;
  const createdDishes = [];

  // 获取删除占位菜后的最新菜品列表
  const currentDishes = await getAllDishes();
  const existingNames = new Set(currentDishes.map(d => d.name));
  const existingVideoIds = new Set(
    currentDishes.map(d => extractDouyinVideoId(d.douyinUrl)).filter(Boolean)
  );

  for (const recipe of allRecipes) {
    if (!recipe.name) { skippedNoName++; continue; }

    // 处理菜名括号内容 → 追加到做法备注
    const { cleanName, inParenthesis } = extractNameParenthetical(recipe.name);
    let finalMethod = recipe.method || '';
    if (inParenthesis.length > 0) {
      const noteLine = '【备注】' + inParenthesis.join('；');
      finalMethod = finalMethod ? (noteLine + '\n\n' + finalMethod) : noteLine;
    }

    const finalName = cleanName || recipe.name;
    const videoId = extractDouyinVideoId(recipe.videoUrl);

    // 去重：同名或同视频ID已存在就跳过
    if (existingNames.has(finalName) || (videoId && existingVideoIds.has(videoId))) {
      skippedDup++;
      continue;
    }
    if (seenNames.has(finalName) || (videoId && seenVideoIds.has(videoId))) {
      skippedDup++;
      continue;
    }

    seenNames.add(finalName);
    if (videoId) seenVideoIds.add(videoId);

    // 自动猜分类
    const { category, subCategory } = guessCategoryAndSub({
      name: finalName,
      ingredients: recipe.ingredients,
      method: finalMethod
    });

    await addDish({
      name: finalName,
      ingredients: recipe.ingredients || '',
      method: finalMethod || '',
      category,
      subCategory,
      tags: ['适合冷冻'],
      cooked: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      douyinUrl: recipe.videoUrl || ''
    });
    createdNew++;
    createdDishes.push({ name: finalName, subCategory, videoId });
  }

  localStorage.setItem(DONE_KEY, JSON.stringify({
    doneAt: Date.now(),
    deletedPlaceholders: placeholders.length,
    totalRecipes: allRecipes.length,
    createdNew,
    skippedDup,
    skippedNoName
  }));

  return {
    deletedPlaceholders: placeholders.length,
    totalRecipes: allRecipes.length,
    createdNew,
    skippedDup,
    skippedNoName,
    samples: createdDishes.slice(0, 20)
  };
}
