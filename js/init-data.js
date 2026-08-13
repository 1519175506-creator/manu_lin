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

    // 食材行开始（支持"食材："、"食材:"、"食材" 三种格式，以及同行内容）
    // 也支持"食材分款："格式
    const ingredMatch = line.match(/^\s*(?:食材|食材分款)\s*[：:]?\s*(.*?)\s*$/);
    if (ingredMatch) {
      stage = '食材';
      current.ingredients = '';
      if (ingredMatch[1]) {
        current.ingredients += ingredMatch[1] + '\n';
      }
      continue;
    }

    // 做法行开始（支持"做法："、"做法:"、"做法" 三种格式，以及同行内容）
    const methodMatch = line.match(/^\s*做法\s*[：:]?\s*(.*?)\s*$/);
    if (methodMatch) {
      stage = '做法';
      current.method = '';
      if (methodMatch[1]) {
        current.method += methodMatch[1] + '\n';
      }
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

  // 拆分合集菜谱：一个菜谱包含多个子菜时，自动拆成多个独立菜谱
  const splitRecipes = [];
  for (const r of recipes) {
    const subRecipes = splitCollectionRecipe(r);
    splitRecipes.push(...subRecipes);
  }
  return splitRecipes;
}

// 判断是否是合集菜谱并拆分
// 合集特征：食材/做法包含多个子菜
function splitCollectionRecipe(recipe) {
  const name = recipe.name || '';
  const ingredients = recipe.ingredients || '';
  const method = recipe.method || '';

  // 检测是否为合集菜谱（扩展关键词）
  const collectionKeywords = ['合集', '套餐', '全套', '备餐', '一周', '便当', '减脂餐', '瘦身餐', '低卡', '公式', '三款', '四款', '五款', '六款', '七款', '八款', '九款', '十款'];
  const hasCollectionKeyword = collectionKeywords.some(k => name.includes(k));
  
  // 额外检测：食材包含多个"周X·"或"第X款"格式
  const hasDayPattern = /周[一二三四五六日][·、.]/.test(ingredients);
  const hasBracketPattern = /【第[一二三四五六七八九十\d]+款[^\】]*】/.test(ingredients + '\n' + method);
  const hasNumberedItems = /\d+[.、．]\s*[^\n：:，,。；;]{2,20}[：:]/.test(ingredients);
  const hasMultipleSections = (ingredients.match(/周[一二三四五六日][·、.]/g) || []).length >= 2
    || (ingredients.match(/【第[一二三四五六七八九十\d]+款/g) || []).length >= 2;
  const hasMethodSections = (method.match(/第[一二三四五六七八九十\d]+款[：:]/g) || []).length >= 2
    || (method.match(/###\s*第[一二三四五六七八九十\d]+款/g) || []).length >= 2;

  const isCollection = hasCollectionKeyword || hasDayPattern || hasBracketPattern || hasNumberedItems || hasMultipleSections || hasMethodSections;

  if (!isCollection) {
    return [recipe];
  }

  // 方案0: 从做法中提取子菜名（如果做法里有"第X款：菜名"格式）
  const methodDishNames = extractDishNamesFromMethod(method);
  
  // 方案1: 按 "周一·菜名：原料"、"1.菜名 原料"、"【第X款 菜名】" 等模式拆分食材
  let subDishes = extractSubDishesFromIngredients(ingredients);

  if (subDishes.length <= 1 && methodDishNames.length > 0) {
    // 尝试从食材中按编号提取子食材，配合做法中的菜名
    subDishes = extractSubDishesByNumberedIngredients(ingredients, methodDishNames);
  }

  if (subDishes.length <= 1) {
    // 方案2: 食材分款格式（"【第X款 菜名】"）
    const subDishesV2 = extractSubDishesFromBracketSections(ingredients);
    if (subDishesV2.length > subDishes.length) {
      subDishes = subDishesV2;
    }
  }

  if (subDishes.length <= 1) {
    // 方案3: 食材按行拆分，每行可能是菜名或原料
    const lines = ingredients.split('\n').map(l => l.trim()).filter(l => l);
    const lineSubDishes = extractSubDishesByLines(lines);
    if (lineSubDishes.length > subDishes.length) {
      subDishes = lineSubDishes;
    }
  }

  if (subDishes.length <= 1) {
    // 方案4: 食材分款格式
    const subDishesV4 = extractSubDishesFromSections(ingredients);
    if (subDishesV4.length > subDishes.length) {
      subDishes = subDishesV4;
    }
  }

  if (subDishes.length === 0) {
    return [recipe]; // 无法拆分，原样返回
  }

  // 清理子菜名中的"周一·"、"周二·"等前缀
  for (const sd of subDishes) {
    sd.subName = cleanSubDishName(sd.subName);
  }

  // 如果做法里有更好的菜名，用做法里的替换
  if (methodDishNames.length >= subDishes.length) {
    for (let i = 0; i < subDishes.length && i < methodDishNames.length; i++) {
      if (methodDishNames[i] && !subDishes[i].subName) {
        subDishes[i].subName = methodDishNames[i];
      }
    }
  }

  return buildResultsFromSubDishes(subDishes, ingredients, method, recipe);
}

// 从做法文本中提取子菜名
function extractDishNamesFromMethod(method) {
  if (!method) return [];
  const names = [];
  
  // 匹配 "第X款：菜名" 或 "第X款 菜名"（去掉末尾的"做法"、"教程"等）
  let pattern = /第[一二三四五六七八九十\d]+款[：:]\s*([^\n#·、,，。；;]+?)(?:做法|教程|方法)?\s*$/gm;
  let match;
  while ((match = pattern.exec(method)) !== null) {
    const name = match[1].trim();
    if (name.length > 1 && name.length < 30 && !/^通用/.test(name)) {
      names.push(name);
    }
  }
  
  if (names.length > 0) return names;
  
  // 匹配 "### 第X款：菜名" 
  pattern = /###\s*第[一二三四五六七八九十\d]+款[：:]?\s*([^\n#]+)/g;
  while ((match = pattern.exec(method)) !== null) {
    let name = match[1].trim();
    name = name.replace(/(?:做法|教程|方法)$/, '').trim();
    if (name.length > 1 && name.length < 30 && !/^通用/.test(name)) {
      names.push(name);
    }
  }
  
  return names;
}

// 按编号提取食材并配对做法中的菜名
function extractSubDishesByNumberedIngredients(ingredients, methodDishNames) {
  const subDishes = [];
  const lines = ingredients.split('\n').map(l => l.trim()).filter(l => l);
  
  // 查找编号行（如 "1.海鲜专用葱香油汁：..."）
  const numberedPattern = /^\s*(\d+)[.、．]\s*(.+?)[：:]\s*(.+)$/;
  const numberedItems = [];
  let preIngredients = '';
  let inNumberedSection = false;
  
  for (const line of lines) {
    const m = line.match(numberedPattern);
    if (m) {
      inNumberedSection = true;
      numberedItems.push({
        num: parseInt(m[1]),
        name: m[2].trim(),
        ingredients: m[3].trim()
      });
    } else if (!inNumberedSection) {
      preIngredients += (preIngredients ? '\n' : '') + line;
    }
  }
  
  if (numberedItems.length === 0) return [];
  
  // 配对：用做法中的菜名，如果没有就用编号行的名字
  for (let i = 0; i < numberedItems.length; i++) {
    const item = numberedItems[i];
    const subName = methodDishNames[i] || item.name;
    // 食材 = 通用主料 + 编号对应的蘸汁
    const subIngredients = (preIngredients ? preIngredients + '\n' : '') + item.name + '：' + item.ingredients;
    subDishes.push({
      prefix: String(item.num),
      subName: subName,
      subIngredients: subIngredients
    });
  }
  
  return subDishes;
}

// 清理子菜名中的日期/序号前缀
function cleanSubDishName(name) {
  if (!name) return '';
  let cleaned = name;
  // 移除 "周一·"、"周二·" 等前缀
  cleaned = cleaned.replace(/^周[一二三四五六日][·、.．]\s*/, '');
  // 移除 "周一" 前缀（无标点）
  cleaned = cleaned.replace(/^周[一二三四五六日]\s*/, '');
  // 移除 "1."、"2、" 等序号前缀
  cleaned = cleaned.replace(/^\d+[.、.．]\s*/, '');
  // 移除 "第一款："、"第1款" 等前缀（含冒号）
  cleaned = cleaned.replace(/^第[一二三四五六七八九十\d]+款[：:]\s*/, '');
  // 移除 "第一款"、"第1款" 等前缀（无冒号）
  cleaned = cleaned.replace(/^第[一二三四五六七八九十\d]+款\s*/, '');
  // 移除 "【第一款 菜名】" 格式中的序号部分
  cleaned = cleaned.replace(/^【?第[一二三四五六七八九十\d]+款[：:]?\s*/, '');
  // 移除括号包裹（只保留括号内的菜名）
  cleaned = cleaned.replace(/^【([^】]+)】\s*/, '$1');
  // 移除末尾的 "做法"、"教程"、"方法"
  cleaned = cleaned.replace(/(做法|教程|方法)$/, '').trim();
  return cleaned.trim();
}

// 检查菜名是否有效（不是食材名、不是空的、有意义）
function isValidDishName(name) {
  if (!name || name.length < 2) return false;
  if (name.length > 40) return false;
  // 包含太多标点，可能是食材列表
  if ((name.match(/[、，,；;]/g) || []).length > 2) return false;
  // 包含重量/数量单位（g、kg、ml、克、千克、毫升等），可能是食材描述
  if (/(\d+[gkgml毫升克千克])/i.test(name)) return false;
  // 以调料/食材结尾，可能不是菜名
  const badEndings = ['汁', '酱', '油', '粉', '糊', '油汁', '酱汁', '肉', '肉', '菜', '蛋', '鱼'];
  let endingBad = false;
  for (const ending of badEndings) {
    if (name.endsWith(ending) && name.length < 6) { endingBad = true; break; }
  }
  if (endingBad) return false;
  // 包含食材处理动词（去皮、去骨、切块、切片等），可能是食材描述
  if (/^(去皮|去骨|切块|切片|切丝|切丁|剁碎|切碎|洗净|沥干|解冻)/.test(name)) return false;
  // 以"新鲜"、"冷冻"、"干"等开头，可能是食材描述
  if (/^(新鲜|冷冻|干|鲜|嫩)/.test(name) && name.length < 8) return false;
  return true;
}

// 方案1: 按 "周一·菜名：原料"、"1.菜名 原料"、"第一款：菜名" 模式拆分
function extractSubDishesFromIngredients(ingredients) {
  const subDishes = [];

  // 模式A: "周一·菜名：原料" 或 "周一·菜名：原料"
  let pattern = /(周[一二三四五六日])[·、.．]\s*([^：:\n]+)[：:]\s*([^\n]+)/g;
  let match;
  while ((match = pattern.exec(ingredients)) !== null) {
    subDishes.push({
      prefix: match[1],
      subName: match[2].trim(),
      subIngredients: match[3].trim()
    });
  }

  if (subDishes.length > 0) return subDishes;

  // 模式B: "第一款：菜名"、"第X款：菜名" 格式（菜名在冒号后）
  pattern = /第[一二三四五六七八九十\d]+款[：:]\s*([^\n]+)/g;
  while ((match = pattern.exec(ingredients)) !== null) {
    const fullMatch = match[0];
    const subName = match[1].trim();
    // 查找这个菜名后面的食材内容
    const startIdx = pattern.lastIndex;
    let subIng = '';
    // 收集到下一个菜名标记（"第X款"、"通用"、"共计"等）
    const rest = ingredients.slice(startIdx);
    const nextMarkerPattern = /\n(?=(?:第[一二三四五六七八九十\d]+款[：:]|通用主料|通用调味|共计|备注))/;
    const nextIdx = rest.search(nextMarkerPattern);
    if (nextIdx >= 0) {
      subIng = rest.slice(0, nextIdx).trim();
    } else {
      subIng = rest.trim();
    }
    if (subName.length > 1 && subName.length < 30) {
      subDishes.push({
        prefix: fullMatch,
        subName,
        subIngredients: subIng
      });
    }
  }

  if (subDishes.length > 0) return subDishes;

  // 模式C: "【第一款 菜名】" 或 "【第X款菜名】" 格式
  pattern = /【第[一二三四五六七八九十\d]+款\s*([^\】]+)】/g;
  while ((match = pattern.exec(ingredients)) !== null) {
    const subName = match[1].trim();
    const startIdx = pattern.lastIndex;
    let subIng = '';
    const rest = ingredients.slice(startIdx);
    const nextMarkerPattern = /\n(?=(?:【第[一二三四五六七八九十\d]+款|第[一二三四五六七八九十\d]+款[：:]|通用|共计))/;
    const nextIdx = rest.search(nextMarkerPattern);
    if (nextIdx >= 0) {
      subIng = rest.slice(0, nextIdx).trim();
    } else {
      subIng = rest.trim();
    }
    if (subName.length > 1 && subName.length < 30) {
      subDishes.push({
        prefix: match[0],
        subName,
        subIngredients: subIng
      });
    }
  }

  if (subDishes.length > 0) return subDishes;

  // 模式D: "1.菜名：原料"、"1.菜名 原料"
  pattern = /(\d+)[.、．]\s*([^\n：:]+?)[：:]?\s*([^\n]+)/g;
  while ((match = pattern.exec(ingredients)) !== null) {
    const subName = match[2].trim();
    const subIng = match[3].trim();
    // 菜名应该是短的（<30字符），且不以标点结尾
    if (subName.length > 2 && subName.length < 30 && !/[，,。；;]/.test(subName)) {
      subDishes.push({
        prefix: match[1],
        subName,
        subIngredients: subIng
      });
    }
  }

  return subDishes;
}

// 方案2: 按行拆分，识别菜名+原料结构
function extractSubDishesByLines(lines) {
  const subDishes = [];
  let current = null;

  for (const line of lines) {
    // 菜名行特征：短文本（<25字），不以标点结尾，且包含菜名关键词
    const isNameLine = line.length > 2 && line.length < 25
      && !/[，,。；;、：:]/.test(line)
      && !/^(食材|做法|通用|共计|备注)/.test(line)
      && !/^[①②③④⑤⑥⑦⑧⑨⑩]/.test(line);

    if (isNameLine && (!current || current.subIngredients.length > 30)) {
      // 新菜名开始
      if (current && current.subIngredients) {
        subDishes.push(current);
      }
      current = {
        prefix: '',
        subName: line.trim(),
        subIngredients: ''
      };
    } else if (current) {
      current.subIngredients += (current.subIngredients ? '\n' : '') + line;
    }
  }
  if (current && current.subIngredients) {
    subDishes.push(current);
  }

  return subDishes;
}

// 方案3: 按分款格式拆分（"【第X款 菜名】" 或菜名单独成行）
function extractSubDishesFromSections(ingredients) {
  const subDishes = [];
  const lines = ingredients.split('\n').map(l => l.trim()).filter(l => l);

  // 查找菜名行（短行，看起来像菜名）
  const namePattern = /^(.{2,20})$/;
  const ingPattern = /^(.{2,20})[：:]\s*(.+)/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // 尝试匹配 "菜名：原料" 格式
    const m = line.match(ingPattern);
    if (m && m[1].length < 20 && !/^(食材|做法|通用|共计)/.test(m[1])) {
      const subName = m[1].trim();
      let subIng = m[2].trim();
      // 收集后续原料行直到下一个菜名
      i++;
      while (i < lines.length) {
        const next = lines[i];
        const nextIsName = next.length > 2 && next.length < 20
          && !/[，,。；;、：:]/.test(next)
          && !/^(食材|做法|通用|共计)/.test(next);
        if (nextIsName && subIng.length > 20) break;
        subIng += '\n' + next;
        i++;
      }
      subDishes.push({ prefix: '', subName, subIngredients: subIng });
    } else {
      i++;
    }
  }

  return subDishes;
}

// 方案2新: 按【第X款 菜名】格式拆分
function extractSubDishesFromBracketSections(ingredients) {
  const subDishes = [];
  
  // 匹配 "【第X款 菜名】" 或 "【第X款菜名】" 格式
  const bracketPattern = /【第[一二三四五六七八九十\d]+款\s*([^\】]+)】/g;
  let match;
  const sections = [];
  let lastIndex = 0;
  
  while ((match = bracketPattern.exec(ingredients)) !== null) {
    // 保存上一个section的内容
    if (sections.length > 0) {
      sections[sections.length - 1].content = ingredients.slice(lastIndex, match.index).trim();
    }
    sections.push({
      name: match[1].trim(),
      content: ''
    });
    lastIndex = bracketPattern.lastIndex;
  }
  
  // 保存最后一个section的内容
  if (sections.length > 0) {
    sections[sections.length - 1].content = ingredients.slice(lastIndex).trim();
  }
  
  for (const section of sections) {
    if (section.name && section.content) {
      subDishes.push({
        prefix: '',
        subName: section.name,
        subIngredients: section.content
      });
    }
  }
  
  return subDishes;
}

// 根据提取的子菜构建结果
function buildResultsFromSubDishes(subDishes, ingredients, method, recipe) {
  if (subDishes.length === 0) return [recipe];

  // 拆分做法
  const methodSections = splitMethod(method, subDishes.length);

  const results = [];
  for (let i = 0; i < subDishes.length; i++) {
    const sd = subDishes[i];
    // 清理菜名
    let cleanName = cleanSubDishName(sd.subName);
    
    // 过滤无效菜名（太短、太长、明显是食材名等）
    if (!isValidDishName(cleanName)) continue;
    
    // 清理食材文本中的前缀
    const cleanedIngredients = cleanIngredientsText(sd.subIngredients);
    
    // 如果清理后食材为空，跳过这个菜
    if (!cleanedIngredients || cleanedIngredients.length < 2) continue;
    
    results.push({
      blockNo: recipe.blockNo,
      name: cleanName,
      ingredients: cleanedIngredients,
      method: methodSections[i] || '',
      videoUrl: recipe.videoUrl
    });
  }

  // 如果过滤后没有有效菜品，返回原菜谱
  if (results.length === 0) return [recipe];

  return results;
}

// 清理食材文本中的序号/日期前缀
function cleanIngredientsText(text) {
  if (!text) return '';
  let cleaned = text;
  // 移除行首的 "周一·"、"周二·" 等
  cleaned = cleaned.replace(/周[一二三四五六日][·、.．]\s*/g, '');
  // 移除 "【第X款 X】" 包裹
  cleaned = cleaned.replace(/【第[一二三四五六七八九十\d]+款[^\】]*】\s*/g, '');
  // 移除行首的 "第X款："、"第X款 " 
  cleaned = cleaned.replace(/第[一二三四五六七八九十\d]+款[：:]?\s*/g, '');
  // 移除行首的 "1."、"2、" 等序号（仅限行首）
  cleaned = cleaned.replace(/^\s*\d+[.、.．]\s*/gm, '');
  // 移除 "通用主食"、"通用调味"、"通用主料" 等标题行
  cleaned = cleaned.replace(/^通用[^\n]*\n/gm, '');
  // 移除孤立的 "共计"、"备注"、"说明" 等标题行
  cleaned = cleaned.replace(/^(共计|备注|说明)[^\n]*\n/gm, '');
  // 移除空行
  cleaned = cleaned.replace(/\n\s*\n/g, '\n');
  return cleaned.trim();
}

// 拆分做法文本
function splitMethod(method, expectedCount) {
  if (!method) return [];

  // 按 ### 第X款 格式拆分（如 "### 第一款：白灼大虾做法"）
  const hashPattern = /###\s*第[一二三四五六七八九十\d]+款[^\n]*/g;
  const hashMatches = method.match(hashPattern);
  if (hashMatches && hashMatches.length >= 2) {
    const parts = method.split(hashPattern).filter(p => p.trim());
    return hashMatches.map((m, i) => {
      const idx = i * 2 + 1;
      return (parts[idx] || '').trim();
    }).filter(Boolean);
  }

  // 按【第X款 菜名】格式拆分
  const bracketPattern = /【第[一二三四五六七八九十\d]+款[^\】]*】/g;
  const bracketMatches = method.match(bracketPattern);
  if (bracketMatches && bracketMatches.length >= 2) {
    const parts = method.split(bracketPattern).filter(p => p.trim());
    return bracketMatches.map((m, i) => {
      const idx = i * 2 + 1;
      return (parts[idx] || '').trim();
    }).filter(Boolean);
  }

  // 按 "第X步" 或 "一、" 格式拆分
  const numberedPattern = /\n(?=(?:第[一二三四五六七八九十\d]+步|[一二三四五六七八九十\d]+[、.．])\s)/g;
  const numberedParts = method.split(numberedPattern).filter(p => p.trim());
  if (numberedParts.length >= 2) {
    return numberedParts.slice(0, expectedCount);
  }

  // 按自然段落拆分
  const paragraphs = method.split(/\n\n+/).filter(p => p.trim());
  if (paragraphs.length >= expectedCount) {
    return paragraphs.slice(0, expectedCount);
  }

  // 按换行拆分并均匀分配
  const lines = method.split('\n').filter(l => l.trim());
  const sectionSize = Math.ceil(lines.length / expectedCount);
  const sections = [];
  for (let i = 0; i < expectedCount; i++) {
    const start = i * sectionSize;
    sections.push(lines.slice(start, start + sectionSize).join('\n').trim());
  }
  return sections.filter(Boolean);
}

// 从收藏夹菜谱1.txt和2.txt导入（带幂等）
// 策略：先删除所有错误数据，再从txt文件直接创建新菜品
async function importFromFavoritesTxt() {
  const DONE_KEY = 'favorites_import_done_v17';
  if (localStorage.getItem(DONE_KEY)) {
    return { alreadyDone: true };
  }

  // 1. 删除所有从抖音/txt导入的菜品（有douyinUrl的），重新从txt正确导入
  //    包括：占位菜、菜名包含"食材"/"做法"的、以及之前已导入的（有douyinUrl标记的）
  const allDishes = await getAllDishes();
  const badDishes = allDishes.filter(d => {
    if (/^抖音视频\s*\d+\s*$/.test(d.name)) return true;
    if (d.name && (d.name.includes('食材：') || d.name.includes('食材:') || d.name.includes('做法：') || d.name.includes('做法:'))) return true;
    if (d.name && d.name.length > 80) return true;
    // 有抖音链接的也清除（之前导入的），确保用正确的解析器重新导入
    if (d.douyinUrl) return true;
    return false;
  });
  for (const d of badDishes) {
    await db.dishes.delete(d.id);
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

    // 去重：同名就跳过（合集拆分的子菜共享videoId但菜名不同，所以不按videoId去重）
    if (existingNames.has(finalName)) {
      skippedDup++;
      continue;
    }
    if (seenNames.has(finalName)) {
      skippedDup++;
      continue;
    }

    seenNames.add(finalName);

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
    deletedBadDishes: badDishes.length,
    totalRecipes: allRecipes.length,
    createdNew,
    skippedDup,
    skippedNoName
  }));

  return {
    deletedBadDishes: badDishes.length,
    totalRecipes: allRecipes.length,
    createdNew,
    skippedDup,
    skippedNoName,
    samples: createdDishes.slice(0, 20)
  };
}
