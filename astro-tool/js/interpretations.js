/*!
 * interpretations.js —— 解读文案引擎
 * 生成：三大主星 / 行星落座落宫 / 相位 / 格局 / 元素模式平衡 / 行运 / 汇总文本
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.AstroText = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SUN = {
    '白羊座': '你的生命力来自「先做再说」。你需要在开创、竞争和直接表达中确认自己的存在感，最怕被迫等待或被别人替你做决定。把冲劲集中在一个真正在乎的方向上，你会跑得比别人都快。',
    '金牛座': '你通过稳定、感官愉悦和可积累的事物确认自我价值。你喜欢看得见摸得着的成果，节奏偏慢但耐力惊人，最怕被催促、被打乱和失去安全感。',
    '双子座': '你的核心驱动力是好奇与交流。你透过收集信息、切换话题、认识新朋友来感受自己活着，需要源源不断的新鲜感，但要小心在太多可能性里分散力气。',
    '巨蟹座': '你的自我价值与「被需要」紧密相连。你靠照顾人、创造归属感来定义自己，情绪记忆很深，安全感是你一切行动的底层前提。',
    '狮子座': '你需要被看见、被认可，也愿意为自己所爱的人发光。你的生命力来自创造与慷慨，但别把自我价值全部押在别人的掌声上。',
    '处女座': '你透过「把事情做好」来确认自己的价值。你天生关注细节、擅长优化改进，但要小心用完美主义苛责自己——允许自己先完成，再完美。',
    '天秤座': '你的自我在发展关系和寻求平衡中成形。你在意公平、美感和他人感受，擅长协调，需要练习先确认自己的立场，而不是一味迁就。',
    '天蝎座': '你追求彻底的深度与真实，厌恶浮于表面。你擅长洞察人心，生命力来自一次次重生；课题是学会信任，而不是用掌控换安全感。',
    '射手座': '你的核心是寻找意义与更大的世界。你透过旅行、学习、信念的扩张来感受自由，乐观是天赋，但需要给理想配上落地的计划。',
    '摩羯座': '你透过承担、积累与达成目标来定义自己。你相信时间站在你这边，是天生长期主义者；但别把自我价值只绑在成就上，允许自己休息。',
    '水瓶座': '你的存在感来自「与众不同」和更大的群体理想。你需要精神上的自由，也要练习在亲近关系里表达情绪，而不只是讲道理。',
    '双鱼座': '你透过感受、共情和想象力与世界连接，天生带有艺术与疗愈的潜质。边界感是你的功课，学会分辨「这是谁的感受」。'
  };

  var MOON = {
    '白羊座': '情绪来得快也去得快，需要即时行动和直白的回应。被拖延或被限制时容易急躁，你的安全感来自「我能自己决定」。',
    '金牛座': '情绪需要稳定的节奏、熟悉的食物与舒适的环境。你讨厌被迫改变，情绪低落时先照顾好身体会特别有效。',
    '双子座': '你用说话和思考来消化情绪，需要一个能陪你聊的人。情绪起伏快，安全感来自「我知道还有别的可能」。',
    '巨蟹座': '情感丰沛、记忆力极强，对家和亲密关系有极深的需求。你需要被温柔对待，也容易把别人的情绪背在自己身上。',
    '狮子座': '你需要被肯定、被偏爱、被当作重要的人。受伤时自尊先痛，安全感来自「我在你心里是特别的」。',
    '处女座': '你用分析和解决问题来安抚自己，焦虑时容易钻细节。安全感来自「一切都在掌控中」，要学着允许混乱存在。',
    '天秤座': '情绪需要被聆听和协调，最怕冲突与失衡。你的安全感很大程度来自关系的和睦，需要练习独处也不慌张。',
    '天蝎座': '情绪深、浓、不轻易示人，爱与恨都很彻底。你需要百分之百的忠诚，安全感来自「我没有被隐瞒」。',
    '射手座': '情绪需要空间和乐观的解释，讨厌被困住或被情绪勒索。你的安全感来自「我随时可以出发」。',
    '摩羯座': '情绪表达克制，习惯自己扛。你的安全感来自结构、责任和「我足够有用」，需要练习承认脆弱并不丢脸。',
    '水瓶座': '情绪需要理性的距离，常先分析再感受。你的安全感来自「我依然是我自己」，别用疏离保护自己太久。',
    '双鱼座': '情绪像海绵，容易吸收周围人的感受。你需要被理解、被温柔包裹，同时要在共情和自我保护之间划出界线。'
  };

  var ASC = {
    '白羊座': '给人直接、爽快、有行动力的第一印象。你的人生靠「主动出击」打开局面，只要先迈出第一步，后面的路会自己出现。',
    '金牛座': '给人稳定、温和、有质感的印象。你的人生靠「积累与坚持」打开局面，慢就是你的快。',
    '双子座': '给人机灵、健谈、显年轻的印象。你的人生靠「信息与人脉」打开局面，多说话、多连接会带来机会。',
    '巨蟹座': '给人温和、亲切、有保护感的印象。你的人生靠「情感联结与照顾」打开局面，先建立信任再谈合作。',
    '狮子座': '给人明亮、有气场、有存在感的印象。你的人生靠「展现与创造」打开局面，越敢被看见，舞台越大。',
    '处女座': '给人干净、严谨、可靠的印象。你的人生靠「专业与细节」打开局面，把一件事做到极致就是你的通行证。',
    '天秤座': '给人优雅、友善、好相处的印象。你的人生靠「关系与美感」打开局面，搭档和伴侣常是你运势的关键。',
    '天蝎座': '给人神秘、有强度、看不透的印象。你的人生靠「洞察与深度」打开局面，别人做不到的深度就是你的护城河。',
    '射手座': '给人开朗、直率、有远见的印象。你的人生靠「视野与信念」打开局面，走出去看世界会改变你的命运。',
    '摩羯座': '给人成熟、稳重、有分量的印象。你的人生靠「长期主义与责任」打开局面，时间是站在你这边的。',
    '水瓶座': '给人独立、聪明、带点疏离的印象。你的人生靠「独特视角与群体」打开局面，做别人没做过的事最出彩。',
    '双鱼座': '给人柔美、朦胧、有灵气的印象。你的人生靠「直觉与共情」打开局面，感受力就是你的天赋。'
  };

  var SIGN_STYLE = {
    '白羊座': '直接而快速，先行动再修正',
    '金牛座': '缓慢而稳定，重视实际价值与确定性',
    '双子座': '轻快而多变，需要交流与新鲜信息',
    '巨蟹座': '感性而保护，带着情绪记忆做判断',
    '狮子座': '热情而外放，需要有舞台和被看见',
    '处女座': '细致而务实，追求精确与有用',
    '天秤座': '优雅而权衡，在意关系与公平',
    '天蝎座': '深刻而顽强，不触及核心不罢休',
    '射手座': '开阔而乐观，向往自由与意义',
    '摩羯座': '自律而务实，一切以目标为导向',
    '水瓶座': '理性而抽离，坚持自己的一套逻辑',
    '双鱼座': '柔软而直觉，容易被感受带着走'
  };

  var HOUSE_MEANING = {
    1: '自我形象与人生起点',
    2: '金钱资源与自我价值',
    3: '沟通学习与日常信息',
    4: '家庭根源与内在安全感',
    5: '恋爱创造与自我表现',
    6: '工作健康与日常习惯',
    7: '伴侣合作与一对一关系',
    8: '深层关系与共有资源',
    9: '远方信念与人生意义',
    10: '事业地位与公众形象',
    11: '朋友社群与长期愿景',
    12: '潜意识与独处疗愈'
  };

  var HOUSE_LONG = {
    1: '你的存在感、外貌气质与给人的第一印象都在这里被定义，人生常靠「亲自上场」启动。',
    2: '金钱、物质安全感和自我价值在这里交织，你如何赚钱也反映了你如何看待自己。',
    3: '沟通、学习、兄弟姐妹与短程移动是你的日常舞台，信息流动越快，你越有活力。',
    4: '家庭、根源与内心最深处的安全感在此扎根，这里的状态决定你在外面能走多远。',
    5: '恋爱、创造、娱乐与子女议题在此展开，这是你最需要被欣赏、也最愿意发光的地方。',
    6: '工作方法、健康与日常习惯在此显化，把这里照顾好，你整个人的状态都会稳。',
    7: '伴侣、合伙与契约关系在此成形，你最容易被看见的功课，往往由最亲近的人带来。',
    8: '深层亲密、共有资源与心理暗面在此运作，这里需要的是彻底的信任与坦诚。',
    9: '高等教育、远方、信仰与意义感在此展开，走得越远、学得越深，你越有归属感。',
    10: '事业、社会地位与公众形象在此建立，这是你被世界认可的方式，也是压力的来源。',
    11: '朋友、社群与人脉资源在此汇聚，你的理想多半通过一群人而不是一个人实现。',
    12: '潜意识、独处、灵性与隐形的消耗在此，学会定期清空自己，比硬撑更重要。'
  };

  var ASPECT_TEXT = {
    conjunction: '两股能量融为一体，互相强化也互相牵制，很难客观地分开看待。既是最强的天赋，也是最容易失去距离感的地方。',
    opposition: '两种需求彼此拉扯，容易投射到外部关系里——你吸引来的人往往替你演出了另一半。整合之后，这是最大的平衡智慧。',
    trine: '能量自然流动，是你与生俱来的天赋，用起来毫不费力；也正因为太顺，常被自己忽略而浪费。',
    square: '内在的张力与摩擦，会持续推着你行动。这是最辛苦也最容易逼出成长的配置，代价是长期的自我消耗。',
    sextile: '一种机会型的和谐，天赋需要你主动一点才能兑现。抓住它，会有意想不到的助力。',
    quincunx: '两者格格不入，需要不断调整与妥协，常对应身体或生活节奏上的失衡感。',
    semisextile: '轻微的不协调，提醒你在两个领域之间做小幅调整。',
    semisquare: '细碎的摩擦，容易在日常里累积成烦躁，需要主动疏通。',
    sesquiquadrate: '内在的紧张感，常以突发的冲动或身体反应出现。'
  };

  var PAIR_TIPS = {
    'sun-moon': '这是你内在「想要」与「需要」的协调度，也常反映你与父母的关系模式。',
    'sun-mercury': '反映你的表达是否忠实于真实的自己。',
    'sun-venus': '自我价值感与爱的方式彼此呼应，你最容易在这件事上被认可。',
    'sun-mars': '意志与行动力合流，执行力强，也容易急躁上头。',
    'sun-jupiter': '自信与扩张结合，天生乐观，要注意别过度承诺。',
    'sun-saturn': '自我与责任的角力，成就来得慢但扎实，容易对自己要求过高。',
    'sun-uranus': '自我中带着叛逆与突变，你不走寻常路，也很难被规则框住。',
    'sun-neptune': '自我边界偏模糊，有艺术与灵性天赋，但要小心把别人理想化。',
    'sun-pluto': '有强烈的自我重塑能力，人生常与权力、控制、彻底的转变相关。',
    'sun-node': '人生方向与自我表达高度一致，你的成长往往发生在「做自己」的路上。',
    'moon-mercury': '情绪与思考互通，你善于把感受说清楚，也容易用讲道理代替感受。',
    'moon-venus': '温柔体贴，懂得照顾人，也渴望被疼爱。',
    'moon-mars': '情绪带着火药味，反应快、行动快，也容易冲动伤人。',
    'moon-jupiter': '情绪慷慨乐观，容易心软与过度付出。',
    'moon-saturn': '情感上习惯自制，早年可能缺少情绪回应，需要练习依靠别人。',
    'moon-uranus': '情绪需要空间感，容易忽冷忽热，也害怕被绑住。',
    'moon-neptune': '共情力极强，容易吸收他人情绪，要保护自己的能量边界。',
    'moon-pluto': '情感浓烈、执念深，常与深层依恋或母亲议题相关。',
    'mercury-venus': '说话好听，善于表达欣赏与善意，谈判与社交有天赋。',
    'mercury-mars': '思路快、嘴也快，适合辩论、竞争型表达与临场应变。',
    'mercury-jupiter': '思维宏大，善于总结与传播，适合教学、写作、演讲。',
    'mercury-saturn': '思考严谨、表达谨慎，学习靠结构与纪律取胜。',
    'mercury-uranus': '思维跳跃，灵感型选手，常有别人想不到的角度。',
    'mercury-neptune': '想象力丰富，偏直觉型思考，表达有时会显得模糊。',
    'venus-mars': '爱与欲望结合，魅力强、关系热度高，也容易快速升温后失衡。',
    'venus-jupiter': '慷慨乐观，喜欢丰盛的爱与美，容易在关系里过度付出。',
    'venus-saturn': '爱得认真、慢热，可能害怕自己不够好而不敢开口。',
    'venus-uranus': '在关系里需要自由与新鲜感，平淡会先让你心慌。',
    'venus-neptune': '浪漫、理想化，容易爱上自己想象中的那个人。',
    'venus-pluto': '爱得极深、占有欲强，关系往往带来彻底的重塑。',
    'mars-jupiter': '行动大胆、敢冒险，适合开拓与创业。',
    'mars-saturn': '行动受阻与自我克制，但也因此磨练出别人比不上的耐力。',
    'mars-uranus': '行动突发、不按牌理，适合开创、突破与技术领域。',
    'mars-neptune': '行动力时强时弱，容易被灵感或情绪牵引，需要清晰的目标。',
    'mars-pluto': '战斗力极强、意志惊人，越是逆境越能爆发。',
    'jupiter-saturn': '扩张与收缩的平衡，决定你人生的节奏与阶段性成果。',
    'jupiter-uranus': '突破与扩张的组合，容易带来意外的好运与机会。',
    'jupiter-neptune': '梦想被放大，灵感很多，要防止过度乐观与自我美化。',
    'saturn-uranus': '旧结构与新秩序的拉扯，你常在变革中承担压力。',
    'saturn-neptune': '理想与现实的拉扯，需要给梦想建立可执行的架构。',
    'saturn-pluto': '结构与权力的结合，耐受力极强，适合处理硬骨头。',
    'node-sun': '人生成长方向与自我表现一致，做自己就是你的路。',
    'node-moon': '情感与成长方向相连，安全感的重建是你的功课。'
  };

  var ELEMENT_TEXT = {
    '火': '火元素突出：行动力、热情与直觉主导你的反应，你点火很快，但要注意燃料耗尽的时刻，需要用土元素的落实来延续。',
    '土': '土元素突出：务实、耐力与身体感是你的底盘，你擅长把想法变成现实；注意别过度保守，也别把自己限制在「应该」里。',
    '风': '风元素突出：思维、沟通与观念领先是你的天赋，你善于观察和连接；需要留意别用分析代替感受，也要给想法找到落地的出口。',
    '水': '水元素突出：感受力、共情与直觉极强，你能读到别人没说出口的话；功课是建立边界，别把所有人的情绪都装进自己心里。',
    '缺火': '缺少火元素：启动和自信需要刻意培养，建议为自己设定固定的小行动，用「先做五分钟」来点燃动力。',
    '缺土': '缺少土元素：落地、金钱规划与身体照顾是长期功课，建议用固定的作息和记账习惯来补足稳定感。',
    '缺风': '缺少风元素：抽离与理性沟通需要练习，建议在情绪上头时先写下来，用文字帮自己拉开一点距离。',
    '缺水': '缺少水元素：表达情绪与共情比较吃力，建议先学会命名自己的感受，再练习把它说给人听。'
  };

  var MODE_TEXT = {
    '基本': '基本星座突出：你是天然的启动者，擅长开创与发起，但容易同时开太多头，记得收尾比开头更值钱。',
    '固定': '固定星座突出：你是稳定的中坚力量，坚持力与耐力远超常人，但对改变的抗拒也可能是你的天花板。',
    '变动': '变动星座突出：适应力强、多才多艺，能在变化中游刃有余；要注意别因为选择太多而长期分散。'
  };

  var PATTERN_TEXT = {
    'grand-trine': '三个行星互成三分相，天赋的流动非常顺畅，你在这一组主题上几乎不需要费力。代价是容易缺乏动力，需要主动给自己找挑战。',
    't-square': '两星对冲、共同被第三颗星四分，形成持续的行动压力。它让你的这一组主题很难不处理，但也往往是成就的来源。',
    'yod': '两星六分相并共同十二分相于顶点，是一种必须长期调整的课题。它常以身体反应或命运式的重复出现，直到你找到独特解法。',
    'stellium-sign': '三颗以上行星落在同一星座，这个星座的特质会被极度强化，成为你性格中最鲜明的一面。',
    'stellium-house': '三颗以上行星聚在同一宫位，这个人生领域会被反复激活，往往是你这一生投入最多、收获也最集中的地方。'
  };

  var TRANSIT_TEXT = {
    sun: '年度焦点被照亮，适合启动、展示与被看见',
    moon: '短周期的情绪起伏，适合调整日常节奏与照顾身体',
    mercury: '沟通、信息、学习与短途行程的主题被激活',
    venus: '关系、金钱与愉悦感受的能量上升，适合修复与享受',
    mars: '行动力与冲突同时上升，适合推动停滞已久的事',
    jupiter: '扩张与机会之门打开，容易获得资源与支持',
    saturn: '现实检验期，责任加重，用纪律换取长期成果',
    uranus: '突变与打破旧结构，意外的转折会带来新的空间',
    neptune: '理想化与界限消融，需要看清幻象再做决定',
    pluto: '深层转化期，旧的模式被拆解，权力关系重新洗牌',
    node: '命运方向的提醒，适合回看长期目标'
  };

  function pick(map, key, fallback) { return map[key] || fallback || ''; }

  function pairKey(a, b) {
    var x = a + '-' + b, y = b + '-' + a;
    return PAIR_TIPS[x] ? x : (PAIR_TIPS[y] ? y : null);
  }

  /* ---------------- 主报告 ---------------- */

  function report(chart) {
    var out = { bigThree: [], planets: [], aspects: [], patterns: [], balance: [], summary: [] };
    var sun = chart.byKey.sun, moon = chart.byKey.moon, asc = chart.angleByKey.asc;

    out.bigThree.push({
      title: '太阳 · ' + sun.sign.name,
      sub: A(sun) + ' · 第' + sun.house + '宫' + (sun.retrograde ? ' · 逆行' : ''),
      body: pick(SUN, sun.sign.name) + houseLine(sun, true)
    });
    out.bigThree.push({
      title: '月亮 · ' + moon.sign.name,
      sub: A(moon) + ' · 第' + moon.house + '宫',
      body: pick(MOON, moon.sign.name) + houseLine(moon, false)
    });
    out.bigThree.push({
      title: '上升 · ' + asc.sign.name,
      sub: A(asc) + ' · 命主星 ' + chart.ascRuler.name,
      body: pick(ASC, asc.sign.name) + (chart.ascRuler.point
        ? ' 你的命主星' + chart.ascRuler.name + '落在' + chart.ascRuler.point.sign.name + '第' + chart.ascRuler.point.house + '宫，意味着你人生的关键钥匙握在「' + HOUSE_MEANING[chart.ascRuler.point.house] + '」这个领域里。'
        : '')
    });

    chart.corePlanets.forEach(function (p) {
      var style = pick(SIGN_STYLE, p.sign.name);
      var speedNote = p.retrograde && p.key !== 'node' ? ' 这颗星在出生时为逆行状态，它的能量更多向内运作：你会用更个人化、更迂回的方式表达它，也常需要比别人多绕一圈才能真正掌握。' : '';
      var dig = p.dignity && p.dignity.length ? '（' + p.dignity.map(function (d) { return d.type; }).join('、') + '）' : '';
      out.planets.push({
        title: p.glyph + ' ' + p.name + dig + ' · ' + p.sign.name + ' · 第' + p.house + '宫',
        sub: A(p) + (p.retrograde && p.key !== 'node' ? ' · 逆行 ℞' : ''),
        body: '你的「' + p.theme + '」偏向' + style + '。' + houseLine(p, false)
      });
    });

    chart.aspects.filter(function (a) { return a.major || a.type === 'quincunx'; }).slice(0, 14).forEach(function (a) {
      var key = pairKey(a.a, a.b);
      var tip = key ? PAIR_TIPS[key] : '';
      var tone = a.nature === '挑战' ? '这组配置带来张力，是需要花力气磨合的地方。'
        : a.nature === '和谐' ? '这组配置让能量自然流动，是你可以依靠的天赋。'
        : a.nature === '调整' ? '这组配置需要不断微调，容易在生活中以身体或习惯的形式提醒你。'
        : '这组配置是中性而强力的，它会放大你这两颗星的主题。';
      out.aspects.push({
        title: a.aGlyph + a.aName + ' ' + a.typeGlyph + ' ' + a.bGlyph + a.bName + ' · ' + a.typeName,
        sub: '容许度 ' + a.orb.toFixed(2) + '°' + (a.exact ? ' · 紧密相位' : '') + ' · ' + a.nature,
        body: (tip ? tip : '') + pick(ASPECT_TEXT, a.type) + ' ' + tone
      });
    });

    chart.patterns.forEach(function (pt) {
      out.patterns.push({
        title: pt.name,
        sub: pt.detail,
        body: pick(PATTERN_TEXT, pt.type, '')
      });
    });

    // 平衡
    var el = chart.distributions.elements, mode = chart.distributions.modes;
    var elKeys = ['火', '土', '风', '水'];
    var maxEl = elKeys.reduce(function (a, b) { return el[b] > el[a] ? b : a; }, '火');
    var minEl = elKeys.reduce(function (a, b) { return el[b] < el[a] ? b : a; }, '火');
    var elDesc = elKeys.map(function (k) { return k + el[k]; }).join(' · ');
    var modeDesc = ['基本', '固定', '变动'].map(function (k) { return k + mode[k]; }).join(' · ');
    var dominant = elKeys.filter(function (k) { return el[k] === el[maxEl]; });
    var missing = elKeys.filter(function (k) { return el[k] === 0; });
    out.balance.push({
      title: '元素分布：' + elDesc,
      sub: '主导元素 ' + dominant.join('/') + (missing.length ? ' · 缺失元素 ' + missing.join('/') : ''),
      body: ELEMENT_TEXT[maxEl] + (missing.length ? ' ' + missing.map(function (m) { return ELEMENT_TEXT['缺' + m]; }).join(' ') : '')
    });
    var maxMode = ['基本', '固定', '变动'].reduce(function (a, b) { return mode[b] > mode[a] ? b : a; }, '基本');
    out.balance.push({
      title: '模式分布：' + modeDesc,
      sub: '主导模式 ' + maxMode,
      body: MODE_TEXT[maxMode]
    });
    out.balance.push({
      title: '星盘形状：' + chart.shape.name,
      sub: '半球分布：地平线上 ' + chart.distributions.hemispheres.upper + ' 颗 / 地平线下 ' + chart.distributions.hemispheres.lower + ' 颗',
      body: chart.shape.desc + '。' + (chart.distributions.hemispheres.upper > chart.distributions.hemispheres.lower
        ? '你的能量更多投注在外部世界、关系与公共领域。'
        : '你的能量更多投注在内在世界、个人资源与私密领域。')
    });

    // 汇总文本
    var lines = [];
    lines.push('【星盘简析】' + chart.input.name + ' ' + chart.input.dateText + ' ' + (chart.input.placeName || ''));
    lines.push('');
    lines.push('太阳 ' + A(sun) + ' ｜ 月亮 ' + A(moon) + ' ｜ 上升 ' + A(asc));
    lines.push('命主星：' + chart.ascRuler.name + '（' + (chart.ascRuler.point ? chart.ascRuler.point.sign.name + ' 第' + chart.ascRuler.point.house + '宫' : '—') + '）');
    lines.push('');
    out.bigThree.forEach(function (b) { lines.push('▍' + b.title); lines.push(b.body); lines.push(''); });
    lines.push('▍行星落点');
    chart.corePlanets.forEach(function (p) {
      lines.push(p.glyph + ' ' + p.name + '：' + A(p) + ' 第' + p.house + '宫' + (p.retrograde && p.key !== 'node' ? '（逆行℞）' : '') + (p.dignity.length ? '（' + p.dignity.map(function (d) { return d.type; }).join('') + '）' : ''));
    });
    lines.push('');
    lines.push('▍主要相位');
    out.aspects.slice(0, 8).forEach(function (a) { lines.push('• ' + a.title + '（' + a.sub + '）'); });
    if (out.patterns.length) {
      lines.push('');
      lines.push('▍星盘格局');
      out.patterns.forEach(function (p) { lines.push('• ' + p.title + '：' + p.sub); });
    }
    lines.push('');
    lines.push('▍平衡');
    out.balance.forEach(function (b) { lines.push('• ' + b.title + '：' + b.sub); });
    lines.push('');
    lines.push('（本解读由占星工具自动生成，仅供自我探索与娱乐参考，不替代医疗、法律、投资等专业意见。）');
    out.summary = lines.join('\n');
    return out;
  }

  function houseLine(p, isSun) {
    return '落在' + HOUSE_MEANING[p.house] + '的第' + p.house + '宫：' + HOUSE_LONG[p.house];
  }
  function A(p) { return p.sign.name + ' ' + p.degText; }

  function transitReport(tr) {
    return tr.list.slice(0, 12).map(function (x) {
      var base = TRANSIT_TEXT[x.transiting] || '一个值得留意的天象主题';
      var tone = x.type === 'conjunction' ? '能量被强烈激活'
        : x.type === 'opposition' || x.type === 'square' ? '外部压力与挑战上升，是必须面对的部分'
        : x.type === 'trine' || x.type === 'sextile' ? '顺势而轻松，是可以用力的地方'
        : '需要调整的部分';
      return {
        title: '行运' + x.transitingName + ' ' + x.typeGlyph + ' 本命' + x.natalName,
        sub: x.typeName + ' · 容许度 ' + x.orb.toFixed(2) + '°',
        body: base + '。' + tone + '。'
      };
    });
  }

  return {
    report: report,
    transitReport: transitReport,
    SUN: SUN, MOON: MOON, ASC: ASC,
    SIGN_STYLE: SIGN_STYLE, HOUSE_MEANING: HOUSE_MEANING, HOUSE_LONG: HOUSE_LONG,
    ASPECT_TEXT: ASPECT_TEXT, PAIR_TIPS: PAIR_TIPS, ELEMENT_TEXT: ELEMENT_TEXT,
    MODE_TEXT: MODE_TEXT, PATTERN_TEXT: PATTERN_TEXT, TRANSIT_TEXT: TRANSIT_TEXT
  };
});