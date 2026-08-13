// 数据库操作层 - 基于 Dexie.js (IndexedDB)
const DB_NAME = 'RecipeAppDB';
const DB_VERSION = 4;

const db = new Dexie(DB_NAME);

db.version(1).stores({
  dishes: '++id, name, category, cooked, createdAt, lastCookedAt',
  meals: '++id, date, dishIds'
});

db.version(2).stores({
  dishes: '++id, name, category, cooked, createdAt, lastCookedAt',
  meals: '++id, date, dishIds',
  weeklyPlans: '++id, weekStart'
});

db.version(3).stores({
  dishes: '++id, name, category, subCategory, cooked, createdAt, lastCookedAt',
  meals: '++id, date, dishIds',
  weeklyPlans: '++id, weekStart',
  shoppingCart: '++id, createdAt',
  wishlist: '++id, createdAt'
}).upgrade(async (tx) => {
  // 迁移已有菜品，设置默认值
  await tx.dishes.toCollection().modify(dish => {
    if (!dish.subCategory) dish.subCategory = '';
    if (!dish.nutrition) dish.nutrition = { calories: 0, carbs: 0, fat: 0, protein: 0 };
  });
});

db.version(4).stores({
  dishes: '++id, name, category, subCategory, cooked, createdAt, lastCookedAt',
  meals: '++id, date, dishIds',
  weeklyPlans: '++id, weekStart',
  shoppingCart: '++id, createdAt',
  wishlist: '++id, createdAt',
  meta: 'key'
});

// ===== 细分类常量 =====
const SUB_CATEGORIES = {
  猪肉: ['红烧肉', '糖醋排骨', '回锅肉', '蒜泥白肉', '辣椒炒肉', '小炒肉', '叉烧', '菠萝炖猪排', '生炒排骨', '盐葱牛肉', '松板肉', '五花肉', '排骨'],
  鸡肉: ['宫保鸡丁', '可乐鸡翅', '白切鸡', '手撕鸡', '香煎鸡排', '盐葱鸡腿', '盐葱鸡', '干蒸豆豉鸡', '胡椒鸡', '江西辣鸡翅', '焦糖耗油鸡翅', '蒜香口蘑鸡胸肉', '鸡胸肉', '鸡翅'],
  牛肉: ['苦瓜牛肉', '酸辣土豆丝牛肉', '箩卜炖牛肉', '土豆炖牛腩', '牙签牛肉', '凉拌牛肉', '盐葱牛肉', '牛肉豆花饭', '牛肉'],
  海鲜: ['油焖大虾', '口蘑虾滑', '土豆丝虾球', '盐焗虾蛏子', '芥末虾球', '芥末罗氏虾炒花螺', '油蛤牛肉蒜头油', '油泼葱丝鱿鱼', '干锅鱿鱼', '虾蛏', '鱿鱼', '虾'],
  空气炸锅: [],
  一锅出: ['三汁焖锅', '牛肉豆花饭', '土豆火鸡面', '土豆豆角炖排骨', '南瓜蛋挞', '焖饭', '一锅出']
};

// 根据菜名推测细分类
function guessSubCategory(dishName) {
  for (const [cat, keywords] of Object.entries(SUB_CATEGORIES)) {
    for (const kw of keywords) {
      if (dishName.includes(kw)) return cat;
    }
  }
  return '';
}

// ===== 菜品标签映射（用于迁移已有菜品）=====
const DISH_TAG_MAP = {
  // 适合冷冻复热
  '糖醋排骨': ['适合冷冻'],
  '生炒排骨': ['适合冷冻'],
  '香辣肉丝': ['适合冷冻', '抗炎'],
  '叉烧': ['适合冷冻'],
  '豆角肉沫': ['适合冷冻'],
  '茄子肉沫': ['适合冷冻'],
  '玉米肉沫': ['适合冷冻'],
  '毛豆鸡蛋肉饼': ['适合冷冻', '高钾'],
  '排骨苦瓜汤': ['适合冷冻', '抗炎'],
  '箩卜炖牛肉': ['适合冷冻'],
  '三汁焖锅': ['适合冷冻'],
  '干蒸豆豉鸡': ['适合冷冻'],
  '盐葱鸡腿': ['适合冷冻'],
  '盐葱牛肉': ['适合冷冻'],
  '白切肉': ['适合冷冻', '低脂'],
  '白切鸡': ['适合冷冻', '低脂'],
  '虾滑麻婆豆腐': ['适合冷冻', '低脂'],
  '酸辣土豆丝牛肉': ['适合冷冻', '高钾'],
  '菠萝炖猪排': ['适合冷冻'],
  // 低脂
  '蒜香口蘑鸡胸肉': ['低脂', '高钾', '抗炎'],
  '香煎鸡排': ['低脂'],
  '鲫鱼豆腐汤': ['低脂', '抗炎'],
  '口蘑虾滑': ['低脂', '高钾'],
  '口蘑炒肉': ['高钾'],
  '盐水毛豆': ['低脂', '高钾'],
  '番茄榨菜汤': ['低脂', '高钾'],
  '凉拌菠菜': ['低脂', '高钾', '抗炎'],
  '凉拌杏鲍菇': ['低脂', '高钾'],
  '凉拌黄瓜': ['低脂'],
  '凉拌粉丝': ['低脂'],
  '凉拌平菇': ['低脂', '高钾'],
  '凉拌娃娃菜': ['低脂'],
  '凉拌土豆片(土豆焯水180秒+盐)': ['低脂', '高钾'],
  // 高钾
  '干锅土豆片': ['高钾'],
  '干锅豆角土豆': ['高钾'],
  '醋溜土豆丝': ['高钾'],
  '土豆丝虾球': ['高钾'],
  '虎皮青椒': ['高钾', '抗炎'],
  '苦瓜牛肉': ['高钾', '抗炎'],
  // 抗炎
  '蒜泥白肉': ['抗炎'],
  '蒜香口蘑鸡胸肉': ['低脂', '高钾', '抗炎'],
  // 新增推荐菜
  '低卡版辣椒炒肉': ['低脂', '适合冷冻', '抗炎'],
  '辣炖冻豆腐': ['低脂', '高钾', '适合冷冻'],
  '宫保鸡丁': ['低脂', '适合冷冻'],
  '蒜蓉西兰花': ['低脂', '高钾', '抗炎', '适合冷冻'],
};

// 迁移：为已有菜品添加标签
async function migrateDishTags() {
  const dishes = await getAllDishes();
  for (const dish of dishes) {
    let needsUpdate = false;
    const updates = {};

    // 标签迁移
    if (!dish.tags || dish.tags.length === 0) {
      const tags = DISH_TAG_MAP[dish.name] || [];
      updates.tags = tags;
      needsUpdate = true;
    }

    // 细分类迁移
    if (!dish.subCategory) {
      const sub = guessSubCategory(dish.name);
      if (sub) {
        updates.subCategory = sub;
        needsUpdate = true;
      }
    }

    // 营养数据迁移
    if (!dish.nutrition) {
      updates.nutrition = { calories: 0, carbs: 0, fat: 0, protein: 0 };
      needsUpdate = true;
    }

    // 菜名括号内容迁移到做法备注
    const extractResult = extractParenthetical(dish.name);
    if (extractResult.inParenthesis) {
      // 更新菜名（去掉括号部分）
      updates.name = extractResult.cleanName;
      // 将括号内容追加到做法开头
      const noteText = `【备注】${extractResult.inParenthesis}`;
      const newMethod = dish.method 
        ? `${noteText}\n\n${dish.method}` 
        : noteText;
      updates.method = newMethod;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await updateDish(dish.id, updates);
    }
  }
}

// 从菜名中提取括号内容（支持()、（）、[]、【】）
function extractParenthetical(name) {
  if (!name) return { cleanName: name || '', inParenthesis: '' };
  
  const patterns = [
    /[（(]([^（()）]*)[)）]/g,   // 中英文小括号
    /[【\[]([^【\[\]】]*)[】\]]/g  // 中英文方括号
  ];
  
  let allContent = [];
  let cleanName = name;
  
  for (const p of patterns) {
    const matches = [...cleanName.matchAll(p)];
    for (const m of matches) {
      if (m[1]) allContent.push(m[1].trim());
    }
    cleanName = cleanName.replace(p, '').trim();
  }
  
  // 清理多余空格
  cleanName = cleanName.replace(/\s+/g, ' ').trim();
  
  return {
    cleanName: cleanName,
    inParenthesis: allContent.join('；')
  };
}

// ===== 抖音视频ID列表（按收藏夹顺序59个）=====
const DOUYIN_VIDEO_IDS = [
  '7673072641440586353','7665233270087750842','7659018762070916517','7667937684958872420','7664450402062100170',
  '7671608955027084699','7656040375028055139','7671928569170417510','7659709899781528185','7670839975826971496',
  '7668720221859483313','7668243396763055945','7648245710772538651','7667909991898371697','7667525372925345201',
  '7667888688394734888','7656788845887730610','7667043901531126778','7660872254846334655','7664197173941419450',
  '7655637252345735611','7664936133323023827','7662335845860429090','7640804677336091557','7663419016744618993',
  '7659266175775297509','7661614594904821026','7658224450977959168','7647511987606533363','7644846866240559865',
  '7642923824200231153','7645514582790576872','7647373544372116148','7617311733837044596','7619539365085348963',
  '7624160809123435507','7612929568693131513','7612941599068864442','7592920773237542207','7602577886466133626',
  '7587770671100366137','7594081863461223077','7598495244744707374','7592881083964804393','7590223232927700322',
  '7581813085103476019','7582205723658161445','7580265805124799771','7575009404299250986','7565908979747327275',
  '7543257866782919993','7487962261638728998','7246716944747892029','7538361735859342638','7525410620053769482',
  '7523399501169151286','7516116719158316328','7422141013910768905','7253410743704440122'
];

// 迁移：导入抖音视频链接为菜品（空的做法，后续豆包批量补充）
async function migrateDouyinVideos() {
  const existing = await getAllDishes();
  const existingUrls = new Set(existing.map(d => d.douyinUrl).filter(Boolean));
  let addedCount = 0;

  for (let i = 0; i < DOUYIN_VIDEO_IDS.length; i++) {
    const videoId = DOUYIN_VIDEO_IDS[i];
    const url = `https://www.douyin.com/video/${videoId}`;
    if (existingUrls.has(url)) continue;

    // 检查是否同名
    const defaultName = `抖音视频 ${String(i + 1).padStart(2, '0')}`;
    await addDish({
      name: defaultName,
      category: '荤菜',
      subCategory: guessSubCategory(defaultName),
      cooked: false,
      douyinUrl: url,
      ingredients: '',
      method: '',
      tags: [],
      nutrition: { calories: 0, carbs: 0, fat: 0, protein: 0 }
    });
    addedCount++;
  }
  return addedCount;
}

// ===== 菜品 CRUD =====

async function getAllDishes() {
  return await db.dishes.orderBy('createdAt').reverse().toArray();
}

async function getDishById(id) {
  return await db.dishes.get(Number(id));
}

async function addDish(dish) {
  const now = Date.now();
  return await db.dishes.add({
    name: dish.name || '',
    category: dish.category || '荤菜',
    subCategory: dish.subCategory || guessSubCategory(dish.name || ''),
    cooked: dish.cooked || false,
    photo: dish.photo || null,
    douyinUrl: dish.douyinUrl || '',
    ingredients: dish.ingredients || '',
    method: dish.method || '',
    notes: dish.notes || [],
    tags: dish.tags || [],
    nutrition: dish.nutrition || { calories: 0, carbs: 0, fat: 0, protein: 0 },
    createdAt: now,
    lastCookedAt: null
  });
}

async function updateDish(id, changes) {
  return await db.dishes.update(Number(id), changes);
}

async function deleteDish(id) {
  return await db.dishes.delete(Number(id));
}

async function addDishNote(id, content) {
  const dish = await getDishById(id);
  if (!dish) return;
  const notes = dish.notes || [];
  notes.push({
    date: new Date().toISOString().slice(0, 10),
    content: content
  });
  await updateDish(id, {
    notes: notes,
    lastCookedAt: Date.now(),
    cooked: true
  });
}

// ===== 每日菜单 CRUD =====

async function getMealByDate(date) {
  return await db.meals.where('date').equals(date).first();
}

async function getAllMeals() {
  return await db.meals.orderBy('date').reverse().toArray();
}

async function saveMeal(date, dishIds, note) {
  const existing = await getMealByDate(date);
  if (existing) {
    await db.meals.update(existing.id, { dishIds: dishIds, note: note || '' });
  } else {
    await db.meals.add({
      date: date,
      dishIds: dishIds,
      note: note || ''
    });
  }
}

async function deleteMeal(id) {
  return await db.meals.delete(Number(id));
}

// ===== 每周计划 CRUD =====

// 获取指定周的计划（weekStart 格式 YYYY-MM-DD）
async function getWeeklyPlan(weekStart) {
  return await db.weeklyPlans.where('weekStart').equals(weekStart).first();
}

// 保存每周计划
// planData: { weekStart, sundayPlan: { meatDishIds, vegDishIds }, slots: [{ key, day, meal, meatDishIds, vegDishId }, ...] }
async function saveWeeklyPlan(weekStart, planData) {
  const existing = await getWeeklyPlan(weekStart);
  if (existing) {
    await db.weeklyPlans.update(existing.id, {
      sundayPlan: planData.sundayPlan || null,
      slots: planData.slots || [],
      updatedAt: Date.now()
    });
  } else {
    await db.weeklyPlans.add({
      weekStart: weekStart,
      sundayPlan: planData.sundayPlan || null,
      slots: planData.slots || [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }
}

// 获取所有周计划
async function getAllWeeklyPlans() {
  return await db.weeklyPlans.orderBy('weekStart').reverse().toArray();
}

// ===== 购物清单 CRUD =====

async function getShoppingCart() {
  const cart = await db.shoppingCart.orderBy('createdAt').reverse().first();
  return cart || { dishIds: [], items: [], createdAt: null };
}

// 添加单道菜到购物清单
async function addToShoppingCart(dishId, servings = 1) {
  const cart = await getShoppingCart();
  const dishIds = new Set(cart.dishIds || []);
  dishIds.add(Number(dishId));
  
  // 重新汇总食材
  const dishes = await getAllDishes();
  const cartDishes = dishes.filter(d => dishIds.has(d.id));
  const items = aggregateIngredients(cartDishes, servings);
  
  await db.shoppingCart.clear();
  return await db.shoppingCart.add({
    dishIds: Array.from(dishIds),
    items: items,
    createdAt: Date.now()
  });
}

// 从购物清单移除某道菜
async function removeFromShoppingCart(dishId) {
  const cart = await getShoppingCart();
  const dishIds = (cart.dishIds || []).filter(id => id !== Number(dishId));
  
  const dishes = await getAllDishes();
  const cartDishes = dishes.filter(d => dishIds.includes(d.id));
  const items = aggregateIngredients(cartDishes, 1);
  
  await db.shoppingCart.clear();
  if (dishIds.length === 0) return null;
  return await db.shoppingCart.add({
    dishIds: dishIds,
    items: items,
    createdAt: Date.now()
  });
}

// 检查某道菜是否已在购物清单
async function isInShoppingCart(dishId) {
  const cart = await getShoppingCart();
  return (cart.dishIds || []).includes(Number(dishId));
}

async function saveShoppingCart(dishIds, items) {
  const now = Date.now();
  await db.shoppingCart.clear();
  return await db.shoppingCart.add({
    dishIds: dishIds || [],
    items: items || [],
    createdAt: now
  });
}

async function clearShoppingCart() {
  return await db.shoppingCart.clear();
}

// ===== 食材汇总工具 =====
// 从菜品食材文本中解析并汇总食材
function parseIngredientLine(line) {
  line = line.trim();
  if (!line) return null;
  
  // 尝试匹配格式："食材名 300g"、"食材名：300g"、"食材名 适量" 等
  const patterns = [
    /^(.+?)[\s:：]+([\d.]+)\s*(g|克|kg|公斤|ml|毫升|勺|汤匙|茶匙|个|只|块|片|根|把|碗|杯)$/i,
    /^(.+?)[\s:：]+(.+)$/
  ];
  
  for (const p of patterns) {
    const m = line.match(p);
    if (m) {
      let name = m[1].trim().replace(/^[-•*·\d.、)）]+/, '').trim();
      const amount = m[2] ? m[2].trim() : '适量';
      if (name) return { name, amount };
    }
  }
  
  // 无法拆分，整行作为食材名
  const name = line.replace(/^[-•*·\d.、)）]+/, '').trim();
  if (name) return { name, amount: '适量' };
  return null;
}

function aggregateIngredients(dishes, servingsPerDish = 1) {
  const map = new Map(); // name -> { amount, category }
  
  // 食材粗略分类
  const CATEGORIES = {
    肉蛋禽类: ['猪肉', '牛肉', '鸡肉', '羊肉', '排骨', '五花肉', '鸡胸', '鸡腿', '鸡翅', '鸡蛋', '鸭蛋', '肉馅', '肉沫', '牛腩', '牛腱', '猪肝', '猪心', '火腿', '腊肉', '香肠'],
    海鲜水产: ['虾', '鱼', '蟹', '贝', '螺', '鱿鱼', '章鱼', '蛤蜊', '花蛤', '牡蛎', '生蚝', '带鱼', '鲈鱼', '鲫鱼', '三文鱼', '鳕鱼'],
    蔬菜类: ['白菜', '青菜', '菠菜', '生菜', '油麦菜', '空心菜', '韭菜', '芹菜', '香菜', '葱', '姜', '蒜', '洋葱', '番茄', '西红柿', '土豆', '豆角', '茄子', '辣椒', '青椒', '黄瓜', '苦瓜', '南瓜', '冬瓜', '丝瓜', '萝卜', '胡萝卜', '莲藕', '笋', '玉米', '豌豆', '毛豆', '西兰花', '花椰菜', '菜花', '卷心菜', '包菜', '娃娃菜', '金针菇', '香菇', '蘑菇', '平菇', '木耳', '银耳', '海带', '紫菜', '豆芽', '豆腐', '豆皮', '腐竹'],
    主食谷物: ['米', '大米', '糯米', '面', '面条', '挂面', '意大利面', '馒头', '包子', '饺子', '馄饨', '面包', '吐司', '燕麦', '红薯', '紫薯', '山药', '芋头'],
    调料类: ['盐', '糖', '生抽', '老抽', '酱油', '醋', '料酒', '蚝油', '豆瓣酱', '辣椒酱', '老干妈', '花椒', '八角', '桂皮', '香叶', '辣椒', '胡椒', '孜然', '咖喱', '鸡精', '味精', '淀粉', '生粉', '面粉', '油', '食用油', '香油', '麻油', '蜂蜜', '番茄酱', '沙拉酱'],
    其他: []
  };
  
  function categorize(name) {
    for (const [cat, keywords] of Object.entries(CATEGORIES)) {
      for (const kw of keywords) {
        if (name.includes(kw)) return cat;
      }
    }
    return '其他';
  }
  
  for (const dish of dishes) {
    if (!dish.ingredients) continue;
    const lines = dish.ingredients.split(/[\n,，;；]+/);
    for (const line of lines) {
      const parsed = parseIngredientLine(line);
      if (!parsed) continue;
      const key = parsed.name;
      if (map.has(key)) {
        const existing = map.get(key);
        existing.amount = existing.amount + ' + ' + parsed.amount;
      } else {
        map.set(key, {
          name: key,
          amount: parsed.amount,
          category: categorize(key)
        });
      }
    }
  }
  
  return Array.from(map.values()).sort((a, b) => {
    const order = ['肉蛋禽类', '海鲜水产', '蔬菜类', '主食谷物', '调料类', '其他'];
    return order.indexOf(a.category) - order.indexOf(b.category);
  });
}

// ===== 周日做菜愿望清单 CRUD =====

async function getWishlist() {
  return await db.wishlist.orderBy('createdAt').reverse().toArray();
}

async function addToWishlist(dishId, note) {
  const existing = await db.wishlist.where('dishId').equals(Number(dishId)).first();
  if (existing) return existing.id;
  return await db.wishlist.add({
    dishId: Number(dishId),
    note: note || '',
    createdAt: Date.now()
  });
}

async function removeFromWishlist(id) {
  return await db.wishlist.delete(Number(id));
}

async function clearWishlist() {
  return await db.wishlist.clear();
}

// ===== 统计 =====

async function getStats() {
  const dishes = await getAllDishes();
  const total = dishes.length;
  const cooked = dishes.filter(d => d.cooked).length;
  const uncooked = total - cooked;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthDishes = dishes.filter(d => d.lastCookedAt && d.lastCookedAt >= monthStart).length;

  return { total, cooked, uncooked, monthDishes };
}

// ===== 导出/导入 =====

async function exportAllData() {
  const dishes = await getAllDishes();
  const meals = await getAllMeals();
  const plans = await getAllWeeklyPlans();
  const cart = await getShoppingCart();
  const wishlist = await getWishlist();
  return {
    version: DB_VERSION,
    exportDate: new Date().toISOString(),
    dishes: dishes,
    meals: meals,
    weeklyPlans: plans,
    shoppingCart: cart,
    wishlist: wishlist
  };
}

async function importAllData(data) {
  if (!data || !data.dishes) throw new Error('数据格式不正确');

  await db.transaction('rw', db.dishes, db.meals, db.weeklyPlans, db.shoppingCart, db.wishlist, async () => {
    await db.dishes.clear();
    await db.meals.clear();
    await db.weeklyPlans.clear();
    await db.shoppingCart.clear();
    await db.wishlist.clear();

    for (const dish of data.dishes) {
      delete dish.id;
      if (!dish.tags) dish.tags = [];
      if (!dish.subCategory) dish.subCategory = '';
      if (!dish.nutrition) dish.nutrition = { calories: 0, carbs: 0, fat: 0, protein: 0 };
      await db.dishes.add(dish);
    }

    if (data.meals) {
      for (const meal of data.meals) {
        delete meal.id;
        await db.meals.add(meal);
      }
    }

    if (data.weeklyPlans) {
      for (const plan of data.weeklyPlans) {
        delete plan.id;
        await db.weeklyPlans.add(plan);
      }
    }

    if (data.shoppingCart) {
      await db.shoppingCart.add(data.shoppingCart);
    }

    if (data.wishlist) {
      for (const item of data.wishlist) {
        delete item.id;
        await db.wishlist.add(item);
      }
    }
  });
}

async function isInitialized() {
  const count = await db.dishes.count();
  return count > 0;
}
