// ============= 全局配置常量 =============

// API代理配置
const PROXY_URL = '/proxy/';  // 适用于所有支持重写的部署平台

// 搜索相关配置
const SEARCH_HISTORY_KEY = 'videoSearchHistory';
const MAX_HISTORY_ITEMS = 5;

// ============= 安全配置 =============

// 密码保护配置
// 注意：PASSWORD 环境变量是必需的，所有部署都必须设置密码以确保安全
const PASSWORD_CONFIG = {
    localStorageKey: 'passwordVerified',  // 存储验证状态的键名
    verificationTTL: 90 * 24 * 60 * 60 * 1000  // 验证有效期（90天，约3个月）
};

// ============= 站点信息 =============

// 网站信息配置
const SITE_CONFIG = {
    name: 'LibreTV',
    url: 'https://libretv.is-an.org',
    description: '免费在线视频搜索与观看平台',
    logo: 'image/logo.png',
    version: '1.0.3'
};

// ============= 播放器配置 =============

// 播放器相关配置
const PLAYER_CONFIG = {
    // 播放器相关本地存储键名
    adFilteringStorage: 'adFilteringEnabled',
    playbackRateStorage: 'preferredPlaybackRate',
    skipIntroStorage: 'skipIntroEnabled',
    skipOutroStorage: 'skipOutroEnabled',
    autoplayStorage: 'autoplayEnabled',
    // 默认配置
    defaultPlaybackRate: 1.0,
    defaultSkipIntro: true,
    defaultSkipOutro: true,
    defaultAutoplay: true,
    defaultAdFiltering: true
};

// API站点配置
const API_SITES = {
    testSource: {
        api: 'https://www.example.com/api.php/provide/vod',
        name: '空内容测试源',
        adult: true
    },
     "155": {
      "api": "https://155api.com/api.php/provide/vod",
      "name": "155资源",
      "is_adult": true
    },
    "dyttzy": {
      "api": "http://caiji.dyttzyapi.com/api.php/provide/vod",
      "name": "电影天堂",
      "detail": "http://caiji.dyttzyapi.com",
      "is_adult": false
    },
    "ruyi": {
      "api": "http://cj.rycjapi.com/api.php/provide/vod",
      "name": "如意资源",
      "is_adult": false
    },
    "bfzy": {
      "api": "https://bfzyapi.com/api.php/provide/vod",
      "name": "暴风资源",
      "is_adult": false
    },
    "tyyszy": {
      "api": "https://tyyszy.com/api.php/provide/vod",
      "name": "天涯资源",
      "is_adult": false
    },
    "ffzy": {
      "api": "https://api.ffzyapi.com/api.php/provide/vod",
      "name": "非凡影视",
      "detail": "http://ffzy5.tv",
      "is_adult": false
    },
    "zy360": {
      "api": "https://360zy.com/api.php/provide/vod",
      "name": "360资源",
      "is_adult": false
    },
    "maotaizy": {
      "api": "https://caiji.maotaizy.cc/api.php/provide/vod",
      "name": "茅台资源",
      "is_adult": false
    },
    "wolong": {
      "api": "https://wolongzyw.com/api.php/provide/vod",
      "name": "卧龙资源",
      "is_adult": false
    },
    "jisu": {
      "api": "https://jszyapi.com/api.php/provide/vod",
      "name": "极速资源",
      "detail": "https://jszyapi.com",
      "is_adult": false
    },
    "dbzy": {
      "api": "https://dbzy.tv/api.php/provide/vod",
      "name": "豆瓣资源",
      "is_adult": false
    },
    "mozhua": {
      "api": "https://mozhuazy.com/api.php/provide/vod",
      "name": "魔爪资源",
      "is_adult": false
    },
    "mdzy": {
      "api": "https://www.mdzyapi.com/api.php/provide/vod",
      "name": "魔都资源",
      "is_adult": false
    },
    "zuid": {
      "api": "https://api.zuidapi.com/api.php/provide/vod",
      "name": "最大资源",
      "is_adult": false
    },
    "yinghua": {
      "api": "https://m3u8.apiyhzy.com/api.php/provide/vod",
      "name": "樱花资源",
      "is_adult": false
    },
    "wujin": {
      "api": "https://api.wujinapi.me/api.php/provide/vod",
      "name": "无尽资源",
      "is_adult": false
    },
    "wwzy": {
      "api": "https://wwzy.tv/api.php/provide/vod",
      "name": "旺旺短剧",
      "is_adult": false
    },
    "ikun": {
      "api": "https://ikunzyapi.com/api.php/provide/vod",
      "name": "iKun资源",
      "is_adult": false
    },
    "lzi": {
      "api": "https://cj.lziapi.com/api.php/provide/vod",
      "name": "量子资源",
      "is_adult": false
    },
    "bdzy": {
      "api": "https://api.apibdzy.com/api.php/provide/vod",
      "name": "百度资源",
      "is_adult": false
    },
    "hongniuzy": {
      "api": "https://www.hongniuzy2.com/api.php/provide/vod",
      "name": "红牛资源",
      "is_adult": false
    },
    "xinlangaa": {
      "api": "https://api.xinlangapi.com/xinlangapi.php/provide/vod",
      "name": "新浪资源",
      "is_adult": false
    },
    "ckzy": {
      "api": "https://ckzy.me/api.php/provide/vod",
      "name": "CK资源",
      "detail": "https://ckzy.me",
      "is_adult": false
    },
    "ukuapi": {
      "api": "https://api.ukuapi.com/api.php/provide/vod",
      "name": "U酷资源",
      "detail": "https://api.ukuapi.com",
      "is_adult": false
    },
    "1080zyk": {
      "api": "https://api.1080zyku.com/inc/apijson.php/",
      "name": "1080资源",
      "detail": "https://api.1080zyku.com",
      "is_adult": false
    },
    "hhzyapi": {
      "api": "https://hhzyapi.com/api.php/provide/vod",
      "name": "豪华资源",
      "detail": "https://hhzyapi.com",
      "is_adult": false
    },
    "subocaiji": {
      "api": "https://subocaiji.com/api.php/provide/vod",
      "name": "速博资源",
      "is_adult": false
    },
    "p2100": {
      "api": "https://p2100.net/api.php/provide/vod",
      "name": "飘零资源",
      "detail": "https://p2100.net",
      "is_adult": false
    },
    "mtyun": {
      "api": "https://caiji.maotaizy.cc/api.php/provide/vod/at/josn/",
      "name": "茅台资源",
      "is_adult": false
    },
    "hnyun": {
      "api": "https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/",
      "name": "红牛",
      "is_adult": false
    },
    "gsyun": {
      "api": "https://api.guangsuapi.com/api.php/provide/vod/from/gsm3u8/",
      "name": "光速资源",
      "is_adult": false
    },
    "jyyun": {
      "api": "https://jyzyapi.com/provide/vod",
      "name": "金鹰资源",
      "is_adult": false
    },
    "hym3u8": {
      "api": "https://www.huyaapi.com/api.php/provide/vod/at/json",
      "name": "虎牙资源",
      "is_adult": false
    },
    "91jp": {
      "api": "https://91jpzyw.com/api.php/provide/vod/at/json",
      "name": "91精品资源",
      "is_adult": true
    },
    "wkm3u8": {
      "api": " https://wukongzyz.com/api.php/provide/vod/?ac=list  ",
      "name": "悟空资源",
      "is_adult": true
    },
    "xyun": {
      "api": "https://xzybb1.com/api.php/provide/vod",
      "name": "幸资源",
      "is_adult": true
    },
    "my": {
      "api": "https://api.maoyanapi.top/api.php/provide/vod",
      "name": "猫眼资源",
      "is_adult": false
    },
    "dnz": {
      "api": "https://apidanaizi.com/api.php/provide/vod/?ac=list",
      "name": "大奶子资源",
      "is_adult": true
    },
    "tyys": {
      "api": "https://tyyszyapi.com/api.php/provide/vod/?ac=list",
      "name": "天涯影视",
      "is_adult": false
    },
    "aqy": {
      "api": "https://iqiyizyapi.com/api.php/provide/vod",
      "name": "爱奇艺资源",
      "is_adult": false
    },
    "dytt": {
      "api": "http://caiji.dyttzyapi.com/api.php/provide/vod",
      "name": "电影天堂",
      "is_adult": false
    },
    "xb": {
      "api": "https://xingba111.com/api.php/provide/vod/?ac=list",
      "name": "杏吧资源",
      "is_adult": false
    },
    "hsck": {
      "api": "https://hsckzy.vip/api.php/provide/vod/at/json/",
      "name": "黄色仓库",
      "is_adult": true
    },
    "xjzy": {
      "api": "https://api.xiaojizy.live/provide/vod?ac=list",
      "name": "小鸡资源",
      "is_adult": true
    },
    "xxb": {
      "api": "https://www.xxibaozyw.com/api.php/provide/vod",
      "name": "X细胞",
      "is_adult": true
    },
    "mzzy": {
      "api": "https://mozhuazy.com/api.php/provide/vod",
      "name": "魔爪资源",
      "is_adult": false
    },
    "souav": {
      "api": "https://api.souavzy.vip/api.php/provide/vod",
      "name": "搜av资源",
      "is_adult": true
    },
    "ryzy": {
      "api": "https://cj.rycjapi.com/api.php/provide/vod",
      "name": "如意资源",
      "is_adult": false
    },
    "fqzy": {
      "api": "https://fqzy.me//api.php/provide/vod",
      "name": "番茄资源",
      "is_adult": true
    },
    "wlys": {
      "api": "https://collect.wolongzy.cc/api.php/provide/vod",
      "name": "卧龙影视",
      "is_adult": false
    },
    "swzy": {
      "api": "https://siwazyw.tv/api.php/provide/vod",
      "name": "丝袜资源",
      "is_adult": true
    },
    "wjzy": {
      "api": "https://api.wujinapi.me/api.php/provide/vod",
      "name": "无尽资源",
      "is_adult": false
    },
    "smzy": {
      "api": "https://caiji.semaozy.net/inc/apijson_vod.php",
      "name": "色猫资源",
      "is_adult": true
    },
    "lkun": {
      "api": "https://ikunzyapi.com/api.php/provide/vod",
      "name": "ikun资源",
      "is_adult": false
    },
    "nxx": {
      "api": "https://naixxzy.com/api.php/provide/vod",
      "name": "奶香香资源",
      "is_adult": true
    },
    "bfzy2": {
      "api": "http://by.bfzyapi.com/api.php/provide/vod/",
      "name": "暴风资源2",
      "is_adult": false
    },
    "jszy": {
      "api": "https://jszyapi.com/api.php/provide/vod",
      "name": "极速资源",
      "is_adult": false
    },
    "jkunak": {
      "api": "https://jkunzyapi.com/api.php/seaxml/vod",
      "name": "jkun爱坤联盟",
      "is_adult": true
    },
    "mddm": {
      "api": "https://www.mdzyapi.com/api.php/provide/vod",
      "name": "魔都动漫",
      "is_adult": false
    },
    "lsb": {
      "api": "https://apilsbzy1.com/api.php/provide/vod",
      "name": "老色逼资源",
      "is_adult": true
    },
    "thzy": {
      "api": "https://thzy1.me/api.php/provide/vod",
      "name": "桃花资源",
      "is_adult": true
    },
    "ytzy": {
      "api": "https://apiyutu.com/api.php/provide/vod",
      "name": "玉兔资源",
      "is_adult": true
    },
    "ukzy": {
      "api": "https://api.ukuapi.com/api.php/provide/vod",
      "name": "U酷资源",
      "is_adult": false
    },
    "91md": {
      "api": "https://91md.me/api.php/provide/vod",
      "name": "91麻豆",
      "detail": "https://91md.me",
      "is_adult": true
    },
    "AIvin": {
      "api": "http://lbapiby.com/api.php/provide/vod",
      "name": "AIvin",
      "is_adult": true
    },
    "lbzy": {
      "api": "https://lbapi9.com/api.php/provide/vod",
      "name": "乐播资源",
      "is_adult": true
    },
    "slzy": {
      "api": "https://slapibf.com/api.php/provide/vod",
      "name": "森林资源",
      "detail": "https://slapibf.com",
      "is_adult": true
    },
    "ysjzy": {
      "api": "https://www.xrbsp.com/api/json.php",
      "name": "淫水机资源",
      "detail": "https://www.xrbsp.com",
      "is_adult": true
    },
    "fhzy": {
      "api": "http://fhapi9.com/api.php/provide/vod",
      "name": "番号资源",
      "is_adult": true
    },
    "jpzy": {
      "api": "https://www.jingpinx.com/api.php/provide/vod",
      "name": "精品资源",
      "detail": "https://www.jingpinx.com",
      "is_adult": true
    },
    "msnzy": {
      "api": "https://www.msnii.com/api/json.php",
      "name": "美少女资源",
      "detail": "https://www.msnii.com",
      "is_adult": true
    },
    "shg": {
      "api": "https://api.sexnguon.com/api.php/provide/vod",
      "name": "色嗨国",
      "detail": "https://api.sexnguon.com",
      "is_adult": true
    },
    "ljzy": {
      "api": "https://apilj.com/api.php/provide/vod",
      "name": "辣椒资源",
      "detail": "https://apilj.com",
      "is_adult": true
    },
    "xnezy": {
      "api": "https://www.gdlsp.com/api/json.php",
      "name": "香奶儿资源",
      "detail": "https://www.gdlsp.com",
      "is_adult": true
    },
    "syzy": {
      "api": "https://shayuapi.com/api.php/provide/vod",
      "name": "鲨鱼资源",
      "detail": "https://shayuapi.com",
      "is_adult": true
    },
    "hav": {
      "api": "https://www.pgxdy.com/api/json.php",
      "name": "黄AV资源",
      "detail": "https://www.pgxdy.com",
      "is_adult": true
    },
    "xbzy": {
      "api": "https://xingba111.com/api.php/provide/vod",
      "name": "性吧资源",
      "is_adult": true
    },
    "hszy": {
      "api": "https://hsckzy888.com/api.php/provide/vod",
      "name": "黄色资源",
      "is_adult": true
    },
    "askzy": {
      "api": "https://aosikazy.com/api.php/provide/vod",
      "name": "奥斯卡资源",
      "detail": "https://aosikazy.com",
      "is_adult": true
    }
    //ARCHIVE https://telegra.ph/APIs-08-12
};

// 定义合并方法
function extendAPISites(newSites) {
    Object.assign(API_SITES, newSites);
}

// 暴露到全局
window.API_SITES = API_SITES;
window.extendAPISites = extendAPISites;


// 添加聚合搜索的配置选项
const AGGREGATED_SEARCH_CONFIG = {
    enabled: true,             // 是否启用聚合搜索
    timeout: 8000,            // 单个源超时时间（毫秒）
    maxResults: 10000,          // 最大结果数量
    parallelRequests: true,   // 是否并行请求所有源
    showSourceBadges: true    // 是否显示来源徽章
};

// 抽象API请求配置
const API_CONFIG = {
    search: {
        // 只拼接参数部分，不再包含 /api.php/provide/vod/
        path: '?ac=videolist&wd=',
        pagePath: '?ac=videolist&wd={query}&pg={page}',
        maxPages: 50, // 最大获取页数
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        }
    },
    detail: {
        // 只拼接参数部分
        path: '?ac=videolist&ids=',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        }
    }
};

// 优化后的正则表达式模式
const M3U8_PATTERN = /\$https?:\/\/[^"'\s]+?\.m3u8/g;

// 添加自定义播放器URL
const CUSTOM_PLAYER_URL = 'player.html'; // 使用相对路径引用本地player.html

// 增加错误信息本地化
const ERROR_MESSAGES = {
    NETWORK_ERROR: '网络连接错误，请检查网络设置',
    TIMEOUT_ERROR: '请求超时，服务器响应时间过长',
    API_ERROR: 'API接口返回错误，请尝试更换数据源',
    PLAYER_ERROR: '播放器加载失败，请尝试其他视频源',
    UNKNOWN_ERROR: '发生未知错误，请刷新页面重试'
};

// 添加进一步安全设置
const SECURITY_CONFIG = {
    enableXSSProtection: true,  // 是否启用XSS保护
    sanitizeUrls: true,         // 是否清理URL
    maxQueryLength: 100,        // 最大搜索长度
    // allowedApiDomains 不再需要，因为所有请求都通过内部代理
};

// 添加多个自定义API源的配置
const CUSTOM_API_CONFIG = {
    separator: ',',           // 分隔符
    maxSources: 5,            // 最大允许的自定义源数量
    testTimeout: 5000,        // 测试超时时间(毫秒)
    namePrefix: 'Custom-',    // 自定义源名称前缀
    validateUrl: true,        // 验证URL格式
    cacheResults: true,       // 缓存测试结果
    cacheExpiry: 5184000000,  // 缓存过期时间(2个月)
    adultPropName: 'isAdult' // 用于标记成人内容的属性名
};

// 隐藏内置黄色采集站API的变量
const HIDE_BUILTIN_ADULT_APIS = false;
