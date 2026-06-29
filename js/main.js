// ============================================================
// 模块A：木版年画生境大数据看板 — ECharts 数据可视化引擎
// 数据来源：年画传承人数据.xlsx / 年画流派核心数据.xlsx
// 洞察：地域集聚、老龄化危机、师承断层
// ============================================================

let globalInheritorData = [];
let globalSchoolData = [];
let chartInstances = {};
let currentGeoProvince = null; // 地图联动选中的省份

document.addEventListener("DOMContentLoaded", () => {
    loadAllData();
    setupScrollNavigation();
    setupEnhancedScrollAnimations();
    setupTickerAnimation();
    setupScrollProgress();
    setupBackToTop();
});

// ===================== 数据加载 =====================
function loadAllData() {
    // 优先使用内联数据（本地文件直接打开）
    if (typeof INLINE_INHERITOR_DATA !== 'undefined' && INLINE_INHERITOR_DATA.length > 0) {
        globalInheritorData = INLINE_INHERITOR_DATA.filter(row => row["传承人姓名"]);
        globalSchoolData = (typeof INLINE_SCHOOL_DATA !== 'undefined') ? INLINE_SCHOOL_DATA : [];
        console.log(`[内联数据] 传承人: ${globalInheritorData.length}条, 流派: ${globalSchoolData.length}条`);
        initDashboard(globalInheritorData, globalSchoolData);
        return;
    }
    // 回退：fetch 模式（需 Live Server）
    loadAllDataViaFetch();
}

async function loadAllDataViaFetch() {
    try {
        const [inheritorBuffer, schoolBuffer] = await Promise.all([
            fetch("data/年画传承人数据.xlsx").then(r => r.arrayBuffer()),
            fetch("data/年画流派核心数据.xlsx").then(r => r.arrayBuffer())
        ]);
        const inheritorWb = XLSX.read(inheritorBuffer, { type: 'array' });
        const rawInheritor = XLSX.utils.sheet_to_json(inheritorWb.Sheets[inheritorWb.SheetNames[0]]);
        globalInheritorData = rawInheritor.filter(row => row["传承人姓名"]);
        const schoolWb = XLSX.read(schoolBuffer, { type: 'array' });
        globalSchoolData = XLSX.utils.sheet_to_json(schoolWb.Sheets[schoolWb.SheetNames[0]]);
        console.log(`[Fetch数据] 传承人: ${globalInheritorData.length}条, 流派: ${globalSchoolData.length}条`);
        initDashboard(globalInheritorData, globalSchoolData);
    } catch (error) {
        console.error("Fetch加载失败:", error);
    }
}

// ===================== 数据清洗 =====================
function cleanAndAnalyze(inheritorData, schoolData) {
    const currentYear = 2026;
    
    // 流派分布统计
    let schoolDistribution = {};
    // 省份分布统计（用于地图）
    let provinceDistribution = {};
    // 年龄分组
    let ageGroups = { '90岁以上': 0, '80-89岁': 0, '70-79岁': 0, '60-69岁': 0, '60岁以下': 0 };
    // 散点数据
    let scatterData = [];
    // 年代-流派 联动数据
    let timelineData = {};
    // 平均年龄计算
    let totalAge = 0, ageCount = 0;
    // 性别统计
    let genderStats = { '男': 0, '女': 0 };

    inheritorData.forEach(row => {
        // 流派
        let school = row["所属流派"] || "未分类";
        schoolDistribution[school] = (schoolDistribution[school] || 0) + 1;
        
        // 省份（从地址或流派提取）
        let province = row["所在省份"] || row["籍贯省份"] || extractProvince(row["所属流派"]) || "未知";
        provinceDistribution[province] = (provinceDistribution[province] || 0) + 1;
        
        // 年龄
        if (row["出生年份"]) {
            let age = currentYear - parseInt(row["出生年份"]);
            totalAge += age;
            ageCount++;
            if (age >= 90) ageGroups['90岁以上']++;
            else if (age >= 80) ageGroups['80-89岁']++;
            else if (age >= 70) ageGroups['70-79岁']++;
            else if (age >= 60) ageGroups['60-69岁']++;
            else ageGroups['60岁以下']++;
        }
        
        // 散点
        if (row["出生年份"] && row["授徒人数"] !== undefined) {
            scatterData.push([
                parseInt(row["出生年份"]),
                parseInt(row["授徒人数"]),
                row["传承人姓名"],
                row["所属流派"] || "未知"
            ]);
        }
        
        // 性别
        let gender = row["性别"];
        if (gender && genderStats.hasOwnProperty(gender)) {
            genderStats[gender]++;
        }
    });
    
    let avgAge = ageCount > 0 ? (totalAge / ageCount).toFixed(1) : "N/A";
    
    // 将省份映射到echarts map所需格式
    let mapData = mapProvincesForChina(provinceDistribution);
    
    return {
        schoolDistribution,
        provinceDistribution,
        mapData,
        ageGroups,
        scatterData,
        avgAge,
        genderStats,
        totalInheritors: inheritorData.length,
        totalSchools: Object.keys(schoolDistribution).length,
        totalYield: 680  // 全国年画年产量汇总（万张）
    };
}

// 从流派名推断省份
function extractProvince(school) {
    const mapping = {
        '杨柳青': '天津',
        '桃花坞': '江苏',
        '潍坊杨家埠': '山东',
        '凤翔': '陕西',
        '绵竹': '四川',
        '朱仙镇': '河南',
        '佛山': '广东',
        '武强': '河北',
        '漳州': '福建',
        '滩头': '湖南',
        '梁平': '重庆',
        '平阳': '浙江',
        '高密': '山东',
        '聊城': '山东',
        '老河口': '湖北',
        '夹江': '四川',
        '凤阳': '安徽',
    };
    for (let [key, province] of Object.entries(mapping)) {
        if (school && school.includes(key)) return province;
    }
    return null;
}

// 省份名标准化映射
function mapProvincesForChina(provinceDist) {
    const nameMap = {
        '天津': '天津市', '江苏': '江苏省', '山东': '山东省', '陕西': '陕西省',
        '四川': '四川省', '河南': '河南省', '广东': '广东省', '河北': '河北省',
        '福建': '福建省', '湖南': '湖南省', '重庆': '重庆市', '浙江': '浙江省',
        '湖北': '湖北省', '安徽': '安徽省', '北京': '北京市', '上海': '上海市',
        '山西': '山西省', '甘肃': '甘肃省', '云南': '云南省',
    };
    let result = [];
    for (let [prov, count] of Object.entries(provinceDist)) {
        let standardName = nameMap[prov] || prov;
        if (prov !== '未知') {
            result.push({ name: standardName, value: count });
        }
    }
    return result;
}

// ===================== 初始化仪表盘 =====================
function initDashboard(inheritorData, schoolData) {
    const stats = cleanAndAnalyze(inheritorData, schoolData);
    
    // 更新顶部数据摘要条
    updateTickerValues(stats);
    
    // 注册中国地图（使用echarts内置简化版或CDN）
    loadChinaMap().then(() => {
        initGeoChart(stats);
    }).catch(() => {
        console.warn('中国地图加载失败，跳过地图图表');
        // 地图加载失败时用流派柱状图替代
        initSchoolBarChart(stats);
    });
    
    initAgeRoseChart(stats);
    initScatterBubbleChart(stats);
    initGenderChart(stats);
    initSchoolBarChart(stats);
    initSankeyChart(inheritorData);
    
    // 新增模块C/D/E图表 — 微延迟确保 DOM 布局完成
    setTimeout(() => {
        initCraftGanttChart();
        initCraftBarChart();
        initColorRadarChart();
        initThemeRadarChart();
        initThemeTreemapChart();
    }, 80);
    
    setupColorSwatchClick();
    
    // 动态注入洞察数字
    injectDynamicInsights(stats);
    
    // 响应式
    window.addEventListener('resize', () => {
        Object.values(chartInstances).forEach(chart => chart.resize());
    });
}

// ===================== 加载中国地图GeoJSON =====================
async function loadChinaMap() {
    return new Promise((resolve, reject) => {
        // 使用多个CDN备选
        const urls = [
            'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json',
            'https://geo.datav.aliyun.com/areas_v3/bound/geojson/china.json'
        ];
        
        async function tryLoad(index) {
            if (index >= urls.length) { reject(new Error('全部CDN不可用')); return; }
            try {
                const resp = await fetch(urls[index]);
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                const geoJson = await resp.json();
                echarts.registerMap('china', geoJson);
                resolve();
            } catch (e) {
                tryLoad(index + 1);
            }
        }
        tryLoad(0);
    });
}

// ===================== 图表1：中国地图 - 流派地理分布热力 =====================
function initGeoChart(stats) {
    let dom = document.getElementById('chart-geo-school');
    if (!dom) return;
    
    chartInstances.geo = echarts.init(dom);
    
    // 计算视觉映射范围
    let values = stats.mapData.map(d => d.value);
    let maxVal = Math.max(...values, 1);
    
    chartInstances.geo.setOption({
        title: {
            text: '▍ 木版年画流派地理分布热力图',
            subtext: `覆盖 ${stats.mapData.length} 个省/直辖市`,
            textStyle: { fontSize: 14, fontFamily: 'serif', color: '#333' },
            subtextStyle: { fontSize: 11, color: '#888' },
            left: 'center',
            top: 8
        },
        tooltip: {
            trigger: 'item',
            formatter: function(params) {
                if (params.data) {
                    return `<b>${params.name}</b><br/>传承人数量: ${params.data.value || 0} 位`;
                }
                return params.name;
            }
        },
        visualMap: {
            min: 0,
            max: maxVal,
            left: 'left',
            bottom: 10,
            text: ['高', '低'],
            inRange: {
                color: ['#f5efe0', '#e8c9a0', '#bfa16f', '#9d2929', '#6b1a1a']
            },
            textStyle: { color: '#666', fontSize: 10 },
            calculable: true
        },
        geo: {
            map: 'china',
            roam: true,
            zoom: 1.15,
            center: [105, 36],
            label: {
                show: false,
                fontSize: 10,
                color: '#555'
            },
            emphasis: {
                label: {
                    show: true,
                    fontSize: 12,
                    fontWeight: 'bold'
                },
                itemStyle: {
                    areaColor: '#bfa16f',
                    shadowBlur: 20,
                    shadowColor: 'rgba(0,0,0,0.3)'
                }
            },
            itemStyle: {
                areaColor: '#f5efe0',
                borderColor: '#9d2929',
                borderWidth: 0.8
            }
        },
        series: [{
            type: 'map',
            map: 'china',
            geoIndex: 0,
            data: stats.mapData,
            // 点击地图省份联动p5.js艺术
            // 选中效果
            selectedMode: 'single',
            select: {
                itemStyle: {
                    areaColor: '#9d2929',
                    borderColor: '#bfa16f',
                    borderWidth: 2
                },
                label: { show: true, color: '#fff' }
            }
        }]
    });
    
    // 地图省份点击 → 尝试联动到模块B的流派切换
    chartInstances.geo.on('click', function(params) {
        if (params.data) {
            let province = params.name;
            // 省份到流派的映射
            const provinceToSchool = {
                '天津市': '杨柳青',
                '江苏省': '桃花坞',
                '山东省': '潍坊杨家埠',
                '陕西省': '凤翔',
            };
            let school = provinceToSchool[province];
            if (school && window.switchArtStyle) {
                window.switchArtStyle(school);
                // 同步按钮状态
                document.querySelectorAll('.style-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.getAttribute('data-school') === school) btn.classList.add('active');
                });
            }
        }
    });
}

// ===================== 图表2：流派传承规模柱状图 =====================
function initSchoolBarChart(stats) {
    // 如果地图已存在则跳过
    if (chartInstances.geo) return;
    
    let dom = document.getElementById('chart-geo-school');
    if (!dom) return;
    
    chartInstances.bar = echarts.init(dom);
    let schools = Object.entries(stats.schoolDistribution).sort((a, b) => b[1] - a[1]);
    
    chartInstances.bar.setOption({
        title: { text: '▍ 核心年画流派传承规模横向对比', textStyle: { fontSize: 14, fontFamily: 'serif' }, left: 'center', top: 8 },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { top: '18%', bottom: '12%', left: '15%', right: '8%' },
        xAxis: { type: 'value', name: '传承人数量(人)', nameTextStyle: { fontSize: 10, color: '#888' } },
        yAxis: {
            type: 'category',
            data: schools.map(s => s[0]),
            axisLabel: { fontSize: 10 },
            inverse: true
        },
        series: [{
            type: 'bar',
            data: schools.map(s => ({
                value: s[1],
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        { offset: 0, color: '#6b1a1a' },
                        { offset: 0.5, color: '#9d2929' },
                        { offset: 1, color: '#bfa16f' }
                    ]),
                    borderRadius: [0, 3, 3, 0]
                }
            })),
            barMaxWidth: 32,
            label: { show: true, position: 'right', fontSize: 10, color: '#555' },
            emphasis: {
                itemStyle: { color: '#bfa16f' },
                scale: true
            }
        }]
    });
    
    chartInstances.bar.on('click', function(params) {
        let school = params.name;
        if (school && window.switchArtStyle) {
            window.switchArtStyle(school);
            document.querySelectorAll('.style-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-school') === school) btn.classList.add('active');
            });
        }
    });
}

// ===================== 图表3：年龄结构玫瑰/南丁格尔图 =====================
function initAgeRoseChart(stats) {
    let dom = document.getElementById('chart-age-pyramid');
    if (!dom) return;
    chartInstances.age = echarts.init(dom);
    
    let ageData = Object.entries(stats.ageGroups)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ value: v, name: k }));
    
    chartInstances.age.setOption({
        title: {
            text: '▍ 传承人老龄化时间危机',
            subtext: `在世传承人平均年龄 ${stats.avgAge} 岁`,
            textStyle: { fontSize: 14, fontFamily: 'serif', color: '#333' },
            subtextStyle: { fontSize: 11, color: '#9d2929' },
            left: 'center',
            top: 8
        },
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c}人 ({d}%)'
        },
        legend: {
            bottom: 5,
            left: 'center',
            itemWidth: 8,
            itemHeight: 8,
            textStyle: { fontSize: 9, color: '#666' }
        },
        series: [{
            type: 'pie',
            radius: ['35%', '72%'],
            center: ['50%', '48%'],
            roseType: 'area',
            itemStyle: {
                borderRadius: 6,
                borderColor: '#fff',
                borderWidth: 2
            },
            label: {
                fontSize: 10,
                formatter: '{b}\n{d}%'
            },
            color: ['#6b1a1a', '#9d2929', '#c45a5a', '#bfa16f', '#d9c29e'],
            data: ageData,
            emphasis: {
                itemStyle: {
                    shadowBlur: 15,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.4)'
                },
                scaleSize: 12
            }
        }]
    });
}

// ===================== 图表4：散点气泡图 - 出生年 vs 授徒数 =====================
function initScatterBubbleChart(stats) {
    let dom = document.getElementById('chart-apprentice-scatter');
    if (!dom) return;
    chartInstances.scatter = echarts.init(dom);
    
    // 按流派分组着色
    let schoolColors = {};
    let colorList = ['#9d2929', '#2B4490', '#1D953F', '#C7A252', '#DE82A2', '#AA2116'];
    let colorIdx = 0;
    stats.scatterData.forEach(d => {
        let school = d[3];
        if (!schoolColors[school]) {
            schoolColors[school] = colorList[colorIdx % colorList.length];
            colorIdx++;
        }
    });
    
    chartInstances.scatter.setOption({
        title: {
            text: '▍ 传承断层与授徒规模演变',
            subtext: '气泡大小代表授徒人数',
            textStyle: { fontSize: 14, fontFamily: 'serif', color: '#333' },
            subtextStyle: { fontSize: 10, color: '#888' },
            left: 'center',
            top: 8
        },
        tooltip: {
            trigger: 'item',
            formatter: function(p) {
                return `<b>${p.data[2]}</b> (${p.data[3]})<br/>出生: ${p.data[0]}年<br/>授徒: ${p.data[1]}人<br/><span style="color:#9d2929">● 师承规模</span>`;
            }
        },
        grid: { top: '22%', bottom: '12%', left: '15%', right: '8%' },
        xAxis: {
            type: 'value',
            name: '出生年份',
            min: 1920,
            max: 2000,
            nameTextStyle: { fontSize: 10, color: '#888' },
            axisLabel: { fontSize: 9 },
            splitLine: { lineStyle: { color: '#f0e8d8' } }
        },
        yAxis: {
            type: 'value',
            name: '授徒人数',
            nameTextStyle: { fontSize: 10, color: '#888' },
            axisLabel: { fontSize: 9 },
            splitLine: { lineStyle: { color: '#f0e8d8' } }
        },
        series: [{
            type: 'scatter',
            data: stats.scatterData,
            symbolSize: function(data) {
                return Math.sqrt(data[1] + 1) * 8 + 4;
            },
            itemStyle: {
                color: function(params) {
                    return schoolColors[params.data[3]] || '#9d2929';
                },
                borderColor: '#fff',
                borderWidth: 1,
                shadowBlur: 6,
                shadowColor: 'rgba(0,0,0,0.15)',
                opacity: 0.8
            },
            emphasis: {
                scale: 1.6,
                itemStyle: { shadowBlur: 20 }
            },
            label: {
                show: false
            }
        }]
    });
}

// ===================== 图表5：性别比例图 =====================
function initGenderChart(stats) {
    let total = (stats.genderStats['男'] || 0) + (stats.genderStats['女'] || 0);
    if (total === 0) return;
    let genderRatio = stats.genderStats['男'] || 0;
    let femCount = stats.genderStats['女'] || 0;
    console.log(`[性别统计] 男性: ${genderRatio}位, 女性: ${femCount}位, 性别比: ${(genderRatio/total*100).toFixed(0)}%`);
}

// ===================== 图表6：桑基图 — 传承谱系流 =====================
function initSankeyChart(inheritorData) {
    let dom = document.getElementById('chart-sankey-lineage');
    if (!dom) return;
    chartInstances.sankey = echarts.init(dom);
    
    const currentYear = 2026;
    
    // 构建桑基图数据结构：地区 → 流派 → 年龄组
    let regionSet = new Set();
    let schoolSet = new Set();
    let ageGroupSet = new Set();
    let regionSchool = {};    // 地区→流派 计数
    let schoolAge = {};       // 流派→年龄组 计数
    
    inheritorData.forEach(row => {
        let school = row["所属流派"] || "未分类";
        let region = row["申报地区"] || row["籍贯省份"] || "未知";
        let birthYear = row["出生年份"];
        
        // 简化地区名
        if (region.length > 4) region = region.substring(0, 4);
        if (school.length > 8) school = school.substring(0, 8);
        
        let ageGroup = "未知";
        if (birthYear) {
            let age = currentYear - parseInt(birthYear);
            if (age >= 80) ageGroup = "80岁以上·高危";
            else if (age >= 65) ageGroup = "65-79岁·老年";
            else if (age >= 50) ageGroup = "50-64岁·中年";
            else ageGroup = "50岁以下·青年";
        }
        
        regionSet.add(region);
        schoolSet.add(school);
        ageGroupSet.add(ageGroup);
        
        let rsKey = region + "|||" + school;
        regionSchool[rsKey] = (regionSchool[rsKey] || 0) + 1;
        
        let saKey = school + "|||" + ageGroup;
        schoolAge[saKey] = (schoolAge[saKey] || 0) + 1;
    });
    
    // 构建 nodes
    let regions = Array.from(regionSet).map((name, i) => ({
        name: name,
        itemStyle: { color: '#2B4490' },
        depth: 0
    }));
    let schools = Array.from(schoolSet).map((name, i) => ({
        name: name,
        itemStyle: { color: '#9d2929' },
        depth: 1
    }));
    let ageGroups = Array.from(ageGroupSet).map((name, i) => {
        let colorMap = {
            '80岁以上·高危': '#6b1a1a',
            '65-79岁·老年': '#9d2929',
            '50-64岁·中年': '#c45a5a',
            '50岁以下·青年': '#bfa16f',
            '未知': '#888'
        };
        return {
            name: name,
            itemStyle: { color: colorMap[name] || '#888' },
            depth: 2
        };
    });
    
    let allNodes = [...regions, ...schools, ...ageGroups];
    
    // 构建 links
    let links = [];
    for (let [key, value] of Object.entries(regionSchool)) {
        let [source, target] = key.split("|||");
        links.push({ source, target, value });
    }
    for (let [key, value] of Object.entries(schoolAge)) {
        let [source, target] = key.split("|||");
        links.push({ source, target, value });
    }
    
    chartInstances.sankey.setOption({
        title: {
            text: '▍ 传承谱系流动图',
            subtext: '地区 → 流派 → 年龄组  |  连线粗细 = 传承人数量',
            textStyle: { fontSize: 14, fontFamily: 'serif', color: '#333' },
            subtextStyle: { fontSize: 10, color: '#888' },
            left: 'center',
            top: 8
        },
        tooltip: {
            trigger: 'item',
            triggerOn: 'mousemove',
            formatter: function(p) {
                if (p.dataType === 'edge' || p.data && p.data.source) {
                    return `${p.data.source} → ${p.data.target}<br/>传承人: ${p.data.value} 位`;
                }
                return `${p.name}`;
            }
        },
        series: [{
            type: 'sankey',
            layout: 'none',
            emphasis: {
                focus: 'adjacency',
                lineStyle: { opacity: 0.8 }
            },
            nodeAlign: 'left',
            layoutIterations: 32,
            data: allNodes,
            links: links,
            label: {
                fontSize: 10,
                fontFamily: 'serif',
                color: '#333',
                formatter: function(p) {
                    return p.name.length > 6 ? p.name.substring(0, 6) + '…' : p.name;
                }
            },
            lineStyle: {
                color: 'gradient',
                curveness: 0.5,
                opacity: 0.25
            },
            nodeWidth: 18,
            nodeGap: 12,
            itemStyle: {
                borderWidth: 1,
                borderColor: '#fff'
            }
        }]
    });
    
    // 桑基图点击联动
    chartInstances.sankey.on('click', function(params) {
        if (params.data && params.data.depth === 1) {
            // 点击流派节点 → 联动p5.js
            let schoolName = params.name;
            // 尝试匹配已知流派
            const schoolMap = {
                '杨柳青木版年画': '杨柳青',
                '桃花坞木版年画': '桃花坞',
                '潍坊杨家埠年画': '潍坊杨家埠',
                '凤翔木版年画': '凤翔',
                '杨柳青': '杨柳青',
                '桃花坞': '桃花坞',
                '杨家埠': '潍坊杨家埠',
                '凤翔': '凤翔',
            };
            let mapped = null;
            for (let [key, val] of Object.entries(schoolMap)) {
                if (schoolName.includes(key) || key.includes(schoolName)) {
                    mapped = val;
                    break;
                }
            }
            if (mapped && window.switchArtStyle) {
                window.switchArtStyle(mapped);
                document.querySelectorAll('.style-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.getAttribute('data-school') === mapped) btn.classList.add('active');
                });
            }
        }
    });
}

// ===================== 图表7：工艺时序甘特图（模块C）=====================
function initCraftGanttChart() {
    let dom = document.getElementById('chart-craft-gantt');
    if (!dom) return;
    chartInstances.craftGantt = echarts.init(dom);
    
    const categories = ['准备阶段', '线稿创作', '雕版刻制', '套色印刷', '手工彩绘', '装裱成轴'];
    const craftData = [
        { name: '选材处理', category: 0, start: 0, end: 3, difficulty: 2 },
        { name: '画稿构思', category: 1, start: 1, end: 5, difficulty: 4 },
        { name: '勾线定稿', category: 1, start: 4, end: 7, difficulty: 3 },
        { name: '上版贴样', category: 2, start: 5, end: 7, difficulty: 3 },
        { name: '主版雕刻', category: 2, start: 7, end: 14, difficulty: 5 },
        { name: '色版雕刻', category: 2, start: 9, end: 15, difficulty: 5 },
        { name: '刷墨对版', category: 3, start: 13, end: 18, difficulty: 4 },
        { name: '套色叠印', category: 3, start: 14, end: 20, difficulty: 4 },
        { name: '手工敷色', category: 4, start: 17, end: 22, difficulty: 3 },
        { name: '晾干压平', category: 5, start: 20, end: 23, difficulty: 1 },
        { name: '装裱成轴', category: 5, start: 22, end: 25, difficulty: 2 },
    ];
    
    chartInstances.craftGantt.setOption({
        title: {
            text: '▍ 木版年画工序甘特图',
            subtext: '6大阶段 · 11道子工序 · 总工期约25日',
            textStyle: { fontSize: 14, fontFamily: 'serif', color: '#ddd' },
            subtextStyle: { fontSize: 10, color: '#888' },
            left: 'center', top: 8
        },
        tooltip: {
            trigger: 'item',
            formatter: function(p) {
                // p.value 是数组 [category, start, end, name, difficulty]
                if (!p.value || !Array.isArray(p.value)) return p.name || '';
                let name = p.value[3] || '';
                let start = p.value[1] || 0;
                let end = p.value[2] || 0;
                let diff = p.value[4] || 0;
                return `<b>${name}</b><br/>工期: 第${start}-${end}日<br/>难度: ${'★'.repeat(Math.max(1, Math.round(Number(diff) || 1)))}`;
            }
        },
        grid: { top: '16%', bottom: '8%', left: '18%', right: '5%' },
        xAxis: {
            type: 'value', min: 0, max: 25,
            name: '工期（日）', nameTextStyle: { color: '#888', fontSize: 10 },
            axisLabel: { color: '#888', fontSize: 9 },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
        },
        yAxis: {
            type: 'category',
            data: categories,
            axisLabel: { fontSize: 10, color: '#ccc' },
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
        },
        series: [{
            type: 'custom',
            renderItem: function(params, api) {
                // 防护：api.value 可能返回 undefined
                let catIdx = api.value(0);
                let start = api.value(1);
                let end = api.value(2);
                if (catIdx == null || start == null || end == null) return null;
                
                let yBase = api.coord([0, catIdx])[1];
                let xStart = api.coord([start, 0])[0];
                let xEnd = api.coord([end, 0])[0];
                let height = api.size([0, 1])[1] * 0.5;
                let y = yBase - height / 2;
                let colors = ['#2B4490','#56876D','#9d2929','#C7A252','#D5625A','#bfa16f'];
                let c = colors[catIdx] || '#9d2929';
                let w = Math.max(xEnd - xStart, 4);
                
                // 难度和名称从 encode 映射的 data 数组中取
                let itemName = api.value(3) || '';
                let diff = Number(api.value(4)) || 3;
                
                // 只返回 rect，text 用 label show 替代
                return {
                    type: 'rect',
                    shape: { x: xStart, y: y, width: w, height: height },
                    style: { fill: c, stroke: 'rgba(255,255,255,0.15)', lineWidth: 1, opacity: 0.75 }
                };
            },
            data: craftData.map(d => [d.category, d.start, d.end, d.name, d.difficulty]),
            encode: { x: [1, 2], y: 0 },
            label: {
                show: true,
                position: 'insideLeft',
                formatter: function(p) {
                    if (!p.data) return '';
                    let diff = Number(p.data[4]) || 0;
                    return diff >= 4 ? p.data[3] : '';
                },
                fontSize: 9,
                color: '#fff',
                fontFamily: 'serif'
            }
        }]
    });
}

function initCraftBarChart() {
    let dom = document.getElementById('chart-craft-bar');
    if (!dom) return;
    chartInstances.craftBar = echarts.init(dom);
    
    let stages = ['选材处理', '画稿创作', '雕版刻制', '套色印刷', '手工彩绘', '装裱成轴'];
    let days = [3, 6, 10, 7, 5, 3];
    let difficulty = [2, 3.5, 5, 4, 3, 1.5];
    
    chartInstances.craftBar.setOption({
        title: { text: '工序耗时与难度', textStyle: { fontSize: 12, fontFamily: 'serif', color: '#ccc' }, left: 'center', top: 4 },
        tooltip: { trigger: 'axis' },
        legend: { data: ['耗时(日)', '难度系数'], bottom: 0, textStyle: { fontSize: 9, color: '#888' } },
        grid: { top: '20%', bottom: '18%', left: '12%', right: '8%' },
        xAxis: { type: 'category', data: stages, axisLabel: { fontSize: 8, color: '#aaa' }, axisLine: { lineStyle: { color: '#333' } } },
        yAxis: [
            { type: 'value', name: '日', nameTextStyle: { color: '#888', fontSize: 9 }, axisLabel: { fontSize: 8, color: '#888' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
            { type: 'value', name: '难度', max: 5, nameTextStyle: { color: '#888', fontSize: 9 }, axisLabel: { fontSize: 8, color: '#888' } }
        ],
        series: [
            { name: '耗时(日)', type: 'bar', data: days, itemStyle: { color: '#9d2929', borderRadius: [3,3,0,0] }, barWidth: 22 },
            { name: '难度系数', type: 'line', yAxisIndex: 1, data: difficulty, itemStyle: { color: '#bfa16f' }, lineStyle: { width: 2 }, symbolSize: 6 }
        ]
    });
}

// ===================== 图表8：色彩基因雷达图（模块D）=====================
function initColorRadarChart() {
    let dom = document.getElementById('chart-color-radar');
    if (!dom) return;
    chartInstances.colorRadar = echarts.init(dom);
    
    chartInstances.colorRadar.setOption({
        title: {
            text: '▍ 四大流派色彩倾向雷达图',
            subtext: '基于传统色系的HSL色相空间投影',
            textStyle: { fontSize: 14, fontFamily: 'serif', color: '#333' },
            subtextStyle: { fontSize: 10, color: '#888' },
            left: 'center', top: 8
        },
        tooltip: {},
        legend: {
            bottom: 5, left: 'center',
            data: ['杨柳青', '桃花坞', '杨家埠', '凤翔'],
            textStyle: { fontSize: 10 }
        },
        radar: {
            center: ['50%', '52%'],
            radius: '62%',
            indicator: [
                { name: '红色系', max: 100 },
                { name: '蓝色系', max: 100 },
                { name: '黄色系', max: 100 },
                { name: '绿色系', max: 100 },
                { name: '暗色系', max: 100 },
                { name: '暖色比', max: 100 },
            ],
            axisName: { fontSize: 10, color: '#555' }
        },
        series: [{
            type: 'radar',
            data: [
                { value: [85, 65, 55, 20, 50, 75], name: '杨柳青',
                  lineStyle: { color: '#D5625A', width: 2 }, areaStyle: { color: 'rgba(213,98,90,0.15)' },
                  itemStyle: { color: '#D5625A' } },
                { value: [50, 70, 40, 60, 35, 60], name: '桃花坞',
                  lineStyle: { color: '#DE82A2', width: 2 }, areaStyle: { color: 'rgba(222,130,162,0.15)' },
                  itemStyle: { color: '#DE82A2' } },
                { value: [90, 20, 80, 45, 70, 90], name: '杨家埠',
                  lineStyle: { color: '#DE1C31', width: 2 }, areaStyle: { color: 'rgba(222,28,49,0.15)' },
                  itemStyle: { color: '#DE1C31' } },
                { value: [70, 45, 55, 25, 65, 55], name: '凤翔',
                  lineStyle: { color: '#AA2116', width: 2 }, areaStyle: { color: 'rgba(170,33,22,0.15)' },
                  itemStyle: { color: '#AA2116' } },
            ]
        }]
    });
}

// 色彩基因卡点击联动
function setupColorSwatchClick() {
    document.querySelectorAll('.color-school-swatch').forEach(swatch => {
        swatch.addEventListener('click', function() {
            let school = this.getAttribute('data-school');
            if (school && window.switchArtStyle) {
                window.switchArtStyle(school);
                document.querySelectorAll('.style-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.getAttribute('data-school') === school) btn.classList.add('active');
                });
            }
        });
    });
}

// ===================== 图表9：题材雷达图 + 矩形树图（模块E）=====================
function initThemeRadarChart() {
    let dom = document.getElementById('chart-theme-radar');
    if (!dom) return;
    chartInstances.themeRadar = echarts.init(dom);
    
    chartInstances.themeRadar.setOption({
        title: {
            text: '▍ 流派题材六维对比',
            subtext: '门神·祈福·戏曲·仕女·民俗·神话',
            textStyle: { fontSize: 14, fontFamily: 'serif', color: '#ddd' },
            subtextStyle: { fontSize: 10, color: '#888' },
            left: 'center', top: 8
        },
        tooltip: {},
        legend: {
            bottom: 5, left: 'center',
            data: ['杨柳青', '桃花坞', '杨家埠', '凤翔'],
            textStyle: { fontSize: 10, color: '#aaa' }
        },
        radar: {
            center: ['50%', '52%'],
            radius: '60%',
            indicator: [
                { name: '门神武将', max: 100 },
                { name: '祈福吉祥', max: 100 },
                { name: '戏曲故事', max: 100 },
                { name: '仕女娃娃', max: 100 },
                { name: '民俗生活', max: 100 },
                { name: '神话传说', max: 100 },
            ],
            axisName: { fontSize: 10, color: '#aaa' },
            splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)','rgba(255,255,255,0.04)'] } },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
        },
        series: [{
            type: 'radar',
            data: [
                { value: [30, 85, 50, 90, 40, 35], name: '杨柳青', symbol: 'circle', symbolSize: 5,
                  lineStyle: { color: '#D5625A', width: 2 }, areaStyle: { color: 'rgba(213,98,90,0.15)' },
                  itemStyle: { color: '#D5625A' } },
                { value: [25, 70, 40, 85, 60, 35], name: '桃花坞', symbol: 'diamond', symbolSize: 5,
                  lineStyle: { color: '#DE82A2', width: 2 }, areaStyle: { color: 'rgba(222,130,162,0.15)' },
                  itemStyle: { color: '#DE82A2' } },
                { value: [95, 50, 70, 20, 45, 60], name: '杨家埠', symbol: 'triangle', symbolSize: 5,
                  lineStyle: { color: '#DE1C31', width: 2 }, areaStyle: { color: 'rgba(222,28,49,0.15)' },
                  itemStyle: { color: '#DE1C31' } },
                { value: [80, 55, 30, 20, 50, 65], name: '凤翔', symbol: 'rect', symbolSize: 5,
                  lineStyle: { color: '#AA2116', width: 2 }, areaStyle: { color: 'rgba(170,33,22,0.15)' },
                  itemStyle: { color: '#AA2116' } },
            ]
        }]
    });
}

function initThemeTreemapChart() {
    let dom = document.getElementById('chart-theme-treemap');
    if (!dom) return;
    chartInstances.themeTreemap = echarts.init(dom);
    
    let treemapData = [
        { name: '门神武将', value: 35, children: [
            { name: '立锤门神', value: 12 }, { name: '马上鞭', value: 8 },
            { name: '秦琼尉迟恭', value: 7 }, { name: '钟馗捉鬼', value: 8 }
        ]},
        { name: '祈福吉祥', value: 30, children: [
            { name: '天官赐福', value: 9 }, { name: '连年有余', value: 8 },
            { name: '福禄寿三星', value: 7 }, { name: '五子登科', value: 6 }
        ]},
        { name: '戏曲故事', value: 15, children: [
            { name: '西游记', value: 5 }, { name: '三国演义', value: 5 }, { name: '白蛇传', value: 5 }
        ]},
        { name: '仕女娃娃', value: 12, children: [
            { name: '十二金钗', value: 4 }, { name: '胖娃娃', value: 5 }, { name: '姑嫂闲话', value: 3 }
        ]},
        { name: '民俗生活', value: 10, children: [
            { name: '农耕牧歌', value: 4 }, { name: '男耕女织', value: 3 }, { name: '市井百态', value: 3 }
        ]},
        { name: '神话传说', value: 8, children: [
            { name: '麒麟送子', value: 3 }, { name: '丹凤朝阳', value: 3 }, { name: '和合二仙', value: 2 }
        ]},
    ];
    
    chartInstances.themeTreemap.setOption({
        title: {
            text: '▍ 年画题材层级矩形图',
            subtext: '一级：题材大类 · 二级：具体主题',
            textStyle: { fontSize: 14, fontFamily: 'serif', color: '#ddd' },
            subtextStyle: { fontSize: 10, color: '#888' },
            left: 'center', top: 8
        },
        tooltip: {
            formatter: function(p) {
                return `<b>${p.name}</b><br/>占比: ${((p.value/110)*100).toFixed(0)}%`;
            }
        },
        series: [{
            type: 'treemap',
            width: '92%', height: '80%',
            left: 'center', top: '16%',
            roam: false,
            nodeClick: 'link',
            breadcrumb: { show: false },
            label: { show: true, fontSize: 11, fontFamily: 'serif', color: '#fff' },
            upperLabel: { show: true, height: 22, fontSize: 11, color: '#ddd' },
            itemStyle: { borderColor: '#1a1a1a', borderWidth: 2, gapWidth: 2 },
            levels: [
                { itemStyle: { borderColor: '#333', borderWidth: 3, gapWidth: 3 },
                  color: ['#9d2929', '#2B4490', '#1D953F', '#C7A252', '#DE82A2', '#AA2116'] },
                { colorSaturation: [0.35, 0.6] }
            ],
            data: treemapData
        }]
    });
}
// ===================== 更新顶部数据摘要 =====================
function updateTickerValues(stats) {
    // 动画更新数据摘要数字
    animateNumber('.ticker-item:nth-child(1) .ticker-number', stats.totalInheritors);
    animateNumber('.ticker-item:nth-child(3) .ticker-number', stats.mapData.length);
    animateNumber('.ticker-item:nth-child(5) .ticker-number', stats.totalSchools);
    animateNumber('.ticker-item:nth-child(7) .ticker-number', stats.totalYield || 680);
}

function animateNumber(selector, target) {
    let el = document.querySelector(selector);
    if (!el) return;
    
    let current = parseInt(el.textContent) || 0;
    let duration = 1200;
    let startTime = null;
    
    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        let progress = Math.min((timestamp - startTime) / duration, 1);
        // easeOutExpo
        let eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        let value = Math.floor(current + (target - current) * eased);
        el.textContent = value;
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }
    requestAnimationFrame(step);
}

// ===================== 滚动导航 =====================
function setupScrollNavigation() {
    const sections = document.querySelectorAll('section[id]');
    const navDots = document.querySelectorAll('.nav-dot');
    
    if (sections.length === 0 || navDots.length === 0) return;
    
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            if (window.pageYOffset >= sectionTop - sectionHeight * 0.3) {
                current = section.getAttribute('id');
            }
        });
        
        navDots.forEach(dot => {
            dot.classList.remove('active');
            if (dot.getAttribute('href') === `#${current}`) {
                dot.classList.add('active');
            }
        });
    });
    
    // 平滑滚动
    navDots.forEach(dot => {
        dot.addEventListener('click', function(e) {
            e.preventDefault();
            let targetId = this.getAttribute('href').replace('#', '');
            let target = document.getElementById(targetId);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// ===================== 增强版滚动入场动画（视差+交错）=====================
function setupEnhancedScrollAnimations() {
    // 给每个section的标题和内容加类名
    document.querySelectorAll('.dashboard-header h2, .story-text-panel h2').forEach(el => {
        el.classList.add('section-reveal-title');
    });
    document.querySelectorAll('.dashboard-header .chapter-tag, .story-text-panel .chapter-tag').forEach(el => {
        el.classList.add('section-reveal');
    });
    document.querySelectorAll('.insight-card').forEach((el, i) => {
        el.classList.add('insight-stagger');
        el.style.transitionDelay = (i * 0.12) + 's';
    });
    document.querySelectorAll('.premium-chart, .chart-top-row, .chart-bottom-row, .chart-sankey-row').forEach((el, i) => {
        el.classList.add('chart-stagger');
        el.style.transitionDelay = (i * 0.1) + 's';
    });
    document.querySelectorAll('.craft-left .insight-card, .craft-right .premium-chart').forEach((el, i) => {
        el.classList.add('chart-stagger');
        el.style.transitionDelay = (i * 0.15) + 's';
    });
    document.querySelectorAll('.color-swatch-grid .color-school-swatch').forEach((el, i) => {
        el.classList.add('insight-stagger');
        el.style.transitionDelay = (i * 0.1) + 's';
    });
    document.querySelectorAll('.end-content > *').forEach((el, i) => {
        el.classList.add('section-reveal');
        el.style.transitionDelay = (i * 0.15) + 's';
    });
    
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
    });
    
    document.querySelectorAll('.section-reveal, .section-reveal-title, .chart-stagger, .insight-stagger').forEach(el => {
        revealObserver.observe(el);
    });
}

// ===================== 顶部数据条动态效果 =====================
function setupTickerAnimation() {
    const tickerItems = document.querySelectorAll('.ticker-item');
    tickerItems.forEach(item => {
        item.addEventListener('mouseenter', function() {
            this.querySelector('.ticker-number').style.transform = 'scale(1.1)';
            this.querySelector('.ticker-number').style.transition = 'transform 0.3s ease';
        });
        item.addEventListener('mouseleave', function() {
            this.querySelector('.ticker-number').style.transform = 'scale(1)';
        });
    });
}

// ===================== ECharts 全局样式配置 =====================
// 提供统一的视觉主题函数
window.getEChartsThemeColors = function() {
    return {
        primary: '#9d2929',
        secondary: '#bfa16f',
        dark: '#161616',
        light: '#f2ede2',
        accent: ['#9d2929', '#bfa16f', '#2B4490', '#1D953F', '#C7A252', '#DE82A2'],
        gradient: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#6b1a1a' }, { offset: 1, color: '#bfa16f' }
        ])
    };
};

// ===================== 调试输出 =====================
console.log('[模块A] 数据可视化引擎已就绪');
console.log('[模块A] 图表类型: 中国地图 | 柱状图 | 南丁格尔玫瑰图 | 散点气泡图 | 桑基谱系图 | 工艺甘特图 | 色彩雷达 | 题材雷达+矩形树图');

// ===================== 滚动进度条 =====================
function setupScrollProgress() {
    const bar = document.getElementById('scroll-progress');
    if (!bar) return;
    window.addEventListener('scroll', () => {
        let scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        let scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        let progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        bar.style.width = progress + '%';
    });
}

// ===================== 回到顶部按钮 =====================
function setupBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 600) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    });
    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ===================== 动态洞察注入 =====================
function injectDynamicInsights(stats) {
    // 更新实时平均年龄
    const avgAgeEl = document.getElementById('avg-age-display');
    if (avgAgeEl && stats && stats.avgAge) {
        avgAgeEl.textContent = stats.avgAge + '岁';
    }
    
    // 更新流派总数
    const schoolCountEl = document.getElementById('school-count-display');
    if (schoolCountEl && stats) {
        schoolCountEl.textContent = stats.totalSchools;
    }
    
    // 更新传承人总数
    const inheritorCountEl = document.getElementById('inheritor-count-display');
    if (inheritorCountEl && stats) {
        inheritorCountEl.textContent = stats.totalInheritors;
    }
}
