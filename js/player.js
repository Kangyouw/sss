// 全局配置和选项
const selectedAPIs = JSON.parse(localStorage.getItem('selectedAPIs') || '[]');
const customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]'); // 存储自定义API列表
// 定义可用的播放速度选项
const playbackRates = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

// 播放器设置
let playerSettings = {
    skipIntro: false,
    skipOutro: false,
    introStart: 0,
    introEnd: 90
};

// 性能优化：预定义常用的DOM选择器缓存
const domCache = {};
const getCachedElement = (selector) => {
  if (!domCache[selector]) {
    domCache[selector] = document.querySelector(selector);
  }
  return domCache[selector];
};

// 优化的返回功能
function goBack(event) {
    // 防止默认链接行为
    if (event) event.preventDefault();
    
    try {
        // 1. 优先检查URL参数中的returnUrl
        const urlParams = new URLSearchParams(window.location.search);
        const returnUrl = urlParams.get('returnUrl');
        
        if (returnUrl) {
            // 如果URL中有returnUrl参数，优先使用
            window.location.href = decodeURIComponent(returnUrl);
            return;
        }
        
        // 2. 检查localStorage中保存的lastPageUrl
        const lastPageUrl = localStorage.getItem('lastPageUrl');
        if (lastPageUrl && lastPageUrl !== window.location.href) {
            window.location.href = lastPageUrl;
            return;
        }
        
        // 3. 检查是否是从搜索页面进入的播放器
        const referrer = document.referrer;
        
        // 检查 referrer 是否包含搜索参数
        if (referrer && (referrer.includes('/s=') || referrer.includes('?s='))) {
            // 如果是从搜索页面来的，返回到搜索页面
            window.location.href = referrer;
            return;
        }
        
        // 4. 如果是在iframe中打开的，尝试关闭iframe
        if (window.self !== window.top) {
            try {
                // 尝试调用父窗口的关闭播放器函数
                if (window.parent && typeof window.parent.closeVideoPlayer === 'function') {
                    window.parent.closeVideoPlayer();
                }
                return;
            } catch (e) {
                // 静默失败，继续执行后续逻辑
            }
        }
        
        // 5. 无法确定上一页，则返回首页
        if (!referrer || referrer === '') {
            window.location.href = '/';
            return;
        }
        
        // 6. 以上都不满足，使用默认行为：返回上一页
        window.history.back();
    } catch (error) {
        // 任何错误都返回首页作为后备方案
        window.location.href = '/';
    }
}

// 页面加载时保存当前URL到localStorage，作为返回目标
window.addEventListener('load', function () {
    // 保存前一页面URL
    if (document.referrer && document.referrer !== window.location.href) {
        localStorage.setItem('lastPageUrl', document.referrer);
    }

    // 提取当前URL中的重要参数，以便在需要时能够恢复当前页面
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('id');
    const sourceCode = urlParams.get('source');

    if (videoId && sourceCode) {
        // 保存当前播放状态，以便其他页面可以返回
        localStorage.setItem('currentPlayingId', videoId);
        localStorage.setItem('currentPlayingSource', sourceCode);
    }
});


// =================================
// ============== PLAYER ==========
// =================================
// 全局变量
let currentVideoTitle = '';
let currentEpisodeIndex = 0;
let art = null; // 用于 ArtPlayer 实例
let currentHls = null; // 跟踪当前HLS实例
let currentEpisodes = [];
let episodesReversed = false;
let autoplayEnabled = true; // 默认开启自动连播
let videoHasEnded = false; // 跟踪视频是否已经自然结束
let userClickedPosition = null; // 记录用户点击的位置
let shortcutHintTimeout = null; // 用于控制快捷键提示显示时间
let adFilteringEnabled = true; // 默认开启广告过滤
let progressSaveInterval = null; // 定期保存进度的计时器
let currentVideoUrl = ''; // 记录当前实际的视频URL
let currentPlaybackRate = 1.0; // 当前播放速度
let videoQualityLevels = []; // 视频质量级别列表
let currentQualityIndex = -1; // 当前选中的质量索引
// 智能跳过片首片尾相关变量
let skipIntroEnabled = true; // 默认启用跳过片头
let skipOutroEnabled = true; // 默认启用跳过片尾
let introSkipped = false; // 标记片头是否已跳过
let outroSkipped = false; // 标记片尾是否已跳过
let skipButton = null; // 跳过按钮元素
let introStart = 0; // 片头开始时间（秒）
let introEnd = 90; // 片头结束时间（默认90秒）
let outroStart = null; // 片尾开始时间
let outroEnd = null; // 片尾结束时间
// 播放速度相关增强
// 扩展速度选项已经在文件顶部声明，这里不再重复声明
let originalPlaybackRate = 1.0; // 保存原始播放速度（用于长按等临时改变）
let isLongPress = false; // 长按状态标记
let longPressTimer = null; // 长按计时器
const isWebkit = (typeof window.webkitConvertPointFromNodeToPage === 'function')
Artplayer.FULLSCREEN_WEB_IN_BODY = true;

// 页面加载
document.addEventListener('DOMContentLoaded', function () {
    // 先检查用户是否已通过密码验证
    if (!isPasswordVerified()) {
        // 隐藏加载提示
        document.getElementById('player-loading').style.display = 'none';
        return;
    }

    initializePageContent();
});

// 监听密码验证成功事件
document.addEventListener('passwordVerified', () => {
    document.getElementById('player-loading').style.display = 'block';

    initializePageContent();
});

// 初始化页面内容
function initializePageContent() {

    // 解析URL参数
    const urlParams = new URLSearchParams(window.location.search);
    let videoUrl = urlParams.get('url');
    const title = urlParams.get('title');
    const sourceCode = urlParams.get('source');
    let index = parseInt(urlParams.get('index') || '0');
    const episodesList = urlParams.get('episodes'); // 从URL获取集数信息
    const savedPosition = parseInt(urlParams.get('position') || '0'); // 获取保存的播放位置
    // 解决历史记录问题：检查URL是否是player.html开头的链接
    // 如果是，说明这是历史记录重定向，需要解析真实的视频URL
    if (videoUrl && videoUrl.includes('player.html')) {
        try {
            // 尝试从嵌套URL中提取真实的视频链接
            const nestedUrlParams = new URLSearchParams(videoUrl.split('?')[1]);
            // 从嵌套参数中获取真实视频URL
            const nestedVideoUrl = nestedUrlParams.get('url');
            // 检查嵌套URL是否包含播放位置信息
            const nestedPosition = nestedUrlParams.get('position');
            const nestedIndex = nestedUrlParams.get('index');
            const nestedTitle = nestedUrlParams.get('title');

            if (nestedVideoUrl) {
                videoUrl = nestedVideoUrl;

                // 更新当前URL参数
                const url = new URL(window.location.href);
                if (!urlParams.has('position') && nestedPosition) {
                    url.searchParams.set('position', nestedPosition);
                }
                if (!urlParams.has('index') && nestedIndex) {
                    url.searchParams.set('index', nestedIndex);
                }
                if (!urlParams.has('title') && nestedTitle) {
                    url.searchParams.set('title', nestedTitle);
                }
                // 替换当前URL
                window.history.replaceState({}, '', url);
            } else {
                showError('历史记录链接无效，请返回首页重新访问');
            }
        } catch (e) {
        }
    }

    // 保存当前视频URL
    currentVideoUrl = videoUrl || '';

    // 从localStorage获取数据
    currentVideoTitle = title || localStorage.getItem('currentVideoTitle') || '未知视频';
    currentEpisodeIndex = index;

    // 设置自动连播开关状态
    autoplayEnabled = localStorage.getItem('autoplayEnabled') !== 'false'; // 默认为true
    document.getElementById('autoplayToggle').checked = autoplayEnabled;

    // 获取广告过滤设置
    adFilteringEnabled = localStorage.getItem(PLAYER_CONFIG.adFilteringStorage) !== 'false'; // 默认为true

    // 监听自动连播开关变化
    document.getElementById('autoplayToggle').addEventListener('change', function (e) {
        autoplayEnabled = e.target.checked;
        localStorage.setItem('autoplayEnabled', autoplayEnabled);
    });

    // 优先使用URL传递的集数信息，否则从localStorage获取
    try {
        if (episodesList) {
            // 如果URL中有集数数据，优先使用它
            currentEpisodes = JSON.parse(decodeURIComponent(episodesList));

        } else {
            // 否则从localStorage获取
            currentEpisodes = JSON.parse(localStorage.getItem('currentEpisodes') || '[]');

        }

        // 检查集数索引是否有效，如果无效则调整为0
        if (index < 0 || (currentEpisodes.length > 0 && index >= currentEpisodes.length)) {
            // 如果索引太大，则使用最大有效索引
            if (index >= currentEpisodes.length && currentEpisodes.length > 0) {
                index = currentEpisodes.length - 1;
            } else {
                index = 0;
            }

            // 更新URL以反映修正后的索引
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('index', index);
            window.history.replaceState({}, '', newUrl);
        }

        // 更新当前索引为验证过的值
        currentEpisodeIndex = index;

        episodesReversed = localStorage.getItem('episodesReversed') === 'true';
    } catch (e) {
        currentEpisodes = [];
        currentEpisodeIndex = 0;
        episodesReversed = false;
    }

    // 设置页面标题
    document.title = currentVideoTitle + ' - LibreTV播放器';
    document.getElementById('videoTitle').textContent = currentVideoTitle;

    // 初始化播放器
    if (videoUrl) {
        initPlayer(videoUrl);
    } else {
        showError('无效的视频链接');
    }

    // 渲染源信息
    renderResourceInfoBar();

    // 更新集数信息
    updateEpisodeInfo();

    // 渲染集数列表
    renderEpisodes();

    // 更新按钮状态
    updateButtonStates();

    // 更新排序按钮状态
    updateOrderButton();

    // 添加对进度条的监听，确保点击准确跳转
    setTimeout(() => {
        setupProgressBarPreciseClicks();
    }, 1000);

    // 添加键盘快捷键事件监听
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // 添加页面离开事件监听，保存播放位置
    window.addEventListener('beforeunload', saveCurrentProgress);

    // 新增：页面隐藏（切后台/切标签）时也保存
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            saveCurrentProgress();
        }
    });

    // 视频暂停时也保存
    const waitForVideo = setInterval(() => {
        if (art && art.video) {
            art.video.addEventListener('pause', saveCurrentProgress);

            // 新增：播放进度变化时节流保存
            let lastSave = 0;
            art.video.addEventListener('timeupdate', function() {
                const now = Date.now();
                if (now - lastSave > 5000) { // 每5秒最多保存一次
                    saveCurrentProgress();
                    lastSave = now;
                }
            });

            clearInterval(waitForVideo);
        }
    }, 200);
}

// 切换快捷键帮助模态框
function toggleShortcutHelp() {
    const shortcutHelpModal = document.getElementById('shortcutHelpModal');
    if (shortcutHelpModal) {
        if (shortcutHelpModal.classList.contains('hidden')) {
            shortcutHelpModal.classList.remove('hidden');
            // 阻止背景滚动
            document.body.style.overflow = 'hidden';
        } else {
            shortcutHelpModal.classList.add('hidden');
            // 恢复背景滚动
            document.body.style.overflow = '';
        }
    }
}

// 处理键盘快捷键
function handleKeyboardShortcuts(e) {
    // 忽略输入框中的按键事件
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Alt + 左箭头 = 上一集
    if (e.altKey && e.key === 'ArrowLeft') {
        if (currentEpisodeIndex > 0) {
            playPreviousEpisode();
            showShortcutHint('上一集', 'left');
            e.preventDefault();
        }
    }

    // Alt + 右箭头 = 下一集
    if (e.altKey && e.key === 'ArrowRight') {
        if (currentEpisodeIndex < currentEpisodes.length - 1) {
            playNextEpisode();
            showShortcutHint('下一集', 'right');
            e.preventDefault();
        }
    }

    // 左箭头 = 快退
    if (!e.altKey && e.key === 'ArrowLeft') {
        if (art && art.currentTime > 5) {
            art.currentTime -= 5;
            showShortcutHint('快退', 'left');
            e.preventDefault();
        }
    }

    // 右箭头 = 快进
    if (!e.altKey && e.key === 'ArrowRight') {
        if (art && art.currentTime < art.duration - 5) {
            art.currentTime += 5;
            showShortcutHint('快进', 'right');
            e.preventDefault();
        }
    }

    // 上箭头 = 音量+
    if (e.key === 'ArrowUp') {
        if (art && art.volume < 1) {
            art.volume += 0.1;
            showShortcutHint('音量+', 'up');
            e.preventDefault();
        }
    }

    // 下箭头 = 音量-
    if (e.key === 'ArrowDown') {
        if (art && art.volume > 0) {
            art.volume -= 0.1;
            showShortcutHint('音量-', 'down');
            e.preventDefault();
        }
    }

    // 空格 = 播放/暂停
    if (e.key === ' ') {
        if (art) {
            art.toggle();
            showShortcutHint('播放/暂停', 'play');
            e.preventDefault();
        }
    }

    // f 键 = 切换全屏
    if (e.key === 'f' || e.key === 'F') {
        if (art) {
            art.fullscreen = !art.fullscreen;
            showShortcutHint('切换全屏', 'fullscreen');
            e.preventDefault();
        }
    }
    
    // [ 键 = 降低播放速度
    if (e.key === '[') {
        if (art && art.plugins && art.plugins.playbackRate) {
            const currentIndex = playbackRates.indexOf(currentPlaybackRate);
            if (currentIndex > 0) {
                const newRate = playbackRates[currentIndex - 1];
                art.plugins.playbackRate.switchPlaybackRate(newRate);
                showShortcutHint(`减速 ${newRate}x`, 'speed');
            }
            e.preventDefault();
        }
    }
    
    // ] 键 = 提高播放速度
    if (e.key === ']') {
        if (art && art.plugins && art.plugins.playbackRate) {
            const currentIndex = playbackRates.indexOf(currentPlaybackRate);
            if (currentIndex < playbackRates.length - 1) {
                const newRate = playbackRates[currentIndex + 1];
                art.plugins.playbackRate.switchPlaybackRate(newRate);
                showShortcutHint(`加速 ${newRate}x`, 'speed');
            }
            e.preventDefault();
        }
    }
    
    // r 键 = 重置播放速度
    if (e.key === 'r' || e.key === 'R') {
        if (art && art.plugins && art.plugins.playbackRate) {
            art.plugins.playbackRate.switchPlaybackRate(1.0);
            showShortcutHint('正常速度 1.0x', 'speed');
            e.preventDefault();
        }
    }
    
    // h 键 = 显示快捷键帮助
    if (e.key === 'h' || e.key === 'H') {
        toggleShortcutHelp();
        e.preventDefault();
    }
}

// 显示快捷键提示
function showShortcutHint(text, direction) {
    const hintElement = document.getElementById('shortcutHint');
    const textElement = document.getElementById('shortcutText');
    const iconElement = document.getElementById('shortcutIcon');

    // 清除之前的超时
    if (shortcutHintTimeout) {
        clearTimeout(shortcutHintTimeout);
    }

    // 设置文本和图标方向
    textElement.textContent = text;

    if (direction === 'left') {
        iconElement.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>';
    } else if (direction === 'right') {
        iconElement.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>';
    }  else if (direction === 'up') {
        iconElement.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>';
    } else if (direction === 'down') {
        iconElement.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>';
    } else if (direction === 'fullscreen') {
        iconElement.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"></path>';
    } else if (direction === 'speed') {
        iconElement.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>';
    } else if (direction === 'play') {
        iconElement.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3l14 9-14 9V3z"></path>';
    }

    // 显示提示
    hintElement.classList.add('show');

    // 两秒后隐藏
    shortcutHintTimeout = setTimeout(() => {
        hintElement.classList.remove('show');
    }, 2000);
}

// 初始化播放器
function initPlayer(videoUrl) {
    if (!videoUrl) {
        return
    }

    // 销毁旧实例
    if (art) {
        art.destroy();
        art = null;
    }

    // 配置HLS.js选项，优化加载策略
    const hlsConfig = {
        debug: false,
        loader: adFilteringEnabled ? CustomHlsJsLoader : Hls.DefaultConfig.loader,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30, // 减少回退缓冲，加快响应
        maxBufferLength: 15, // 减少最大缓冲长度，减少加载时间
        maxMaxBufferLength: 45,
        maxBufferSize: 20 * 1000 * 1000, // 减少最大缓冲区大小
        maxBufferHole: 0.5,
        fragLoadingMaxRetry: 3, // 优化重试次数
        fragLoadingMaxRetryTimeout: 32000,
        fragLoadingRetryDelay: 1000,
        manifestLoadingMaxRetry: 2,
        manifestLoadingRetryDelay: 800,
        levelLoadingMaxRetry: 3,
        levelLoadingRetryDelay: 800,
        startLevel: -1,
        abrEwmaDefaultEstimate: 300000, // 优化带宽估计
        abrBandWidthFactor: 0.9,
        abrBandWidthUpFactor: 0.6,
        abrMaxWithRealBitrate: true,
        stretchShortVideoTrack: true,
        appendErrorMaxRetry: 3, // 优化尝试次数
        liveSyncDurationCount: 3,
        liveDurationInfinity: false,
        // 新增预加载设置
        fragLoadingSetup: function(loader, context, callbacks) {
            // 优先加载关键帧片段
            if (context.frag && context.frag.isKeyframe) {
                loader.setPriority(High);
            }
            return loader.load(context, callbacks);
        }
    };

    // 从localStorage加载保存的播放速度
    const savedRateKey = `playbackRate_${getVideoId()}`;
    currentPlaybackRate = parseFloat(localStorage.getItem(savedRateKey) || '1.0');
    
    // 从localStorage加载跳过片头片尾设置
    skipIntroEnabled = localStorage.getItem('skipIntroEnabled') !== 'false'; // 默认为true
    skipOutroEnabled = localStorage.getItem('skipOutroEnabled') !== 'false'; // 默认为true
    
    // 配置自定义播放速度选项
    const playbackRateConfig = {
        index: playbackRates.indexOf(currentPlaybackRate) !== -1 ? playbackRates.indexOf(currentPlaybackRate) : 2,
        options: playbackRates.map(rate => ({ name: `${rate}x`, value: rate }))
    }
    
    // Create new ArtPlayer instance
    art = new Artplayer({
        container: '#player',
        url: videoUrl,
        type: 'm3u8',
        title: videoTitle,
        volume: 0.8,
        isLive: false,
        muted: false,
        autoplay: true,
        pip: true,
        autoSize: false,
        autoMini: true,
        screenshot: true,
        setting: true,
        loop: false,
        flip: false,
        playbackRate: true, // 启用播放速度功能（必须是布尔值）
        aspectRatio: false,
        fullscreen: true,
        fullscreenWeb: true,
        subtitleOffset: false,
        miniProgressBar: true,
        mutex: true,
        backdrop: true,
        playsInline: true,
        autoPlayback: false,
        airplay: true,
        hotkey: true, // 启用快捷键支持
        theme: '#23ade5',
        lang: navigator.language.toLowerCase(),
        moreVideoAttr: {
            crossOrigin: 'anonymous',
            // 添加画中画支持
            disablePictureInPicture: false
        },
        // 添加自定义控制按钮
        controls: [
            {
                position: 'right',
                html: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5m7.43-2.57c.75-.75.75-1.97 0-2.72L18.28 8.7a1.97 1.97 0 0 0-2.72 0l-1.5 1.5a1.97 1.97 0 0 0 0 2.72l1.5 1.5a1.97 1.97 0 0 0 2.72 0M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10s10-4.47 10-10S17.53 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8s8 3.59 8 8s-3.59 8-8 8Z"/></svg>',
                tooltip: '播放器设置',
                click: toggleSettingsPanel
            },
            {
                position: 'right',
                html: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
                tooltip: '快捷键帮助',
                click: toggleShortcutHelp
            }
        ],
        customType: {
            m3u8: function (video, url) {
                // 清理之前的HLS实例
                if (currentHls && currentHls.destroy) {
                    try {
                        currentHls.destroy();
                    } catch (e) {
                    }
                }

                // 创建新的HLS实例
                const hls = new Hls(hlsConfig);
                currentHls = hls;

                // 跟踪是否已经显示错误
                let errorDisplayed = false;
                // 跟踪是否有错误发生
                let errorCount = 0;
                // 跟踪视频是否开始播放
                let playbackStarted = false;
                // 跟踪视频是否出现bufferAppendError
                let bufferAppendErrorCount = 0;

                // 监听视频播放事件
                video.addEventListener('playing', function () {
                    playbackStarted = true;
                    document.getElementById('player-loading').style.display = 'none';
                    document.getElementById('error').style.display = 'none';
                });

                // 监听视频进度事件
                video.addEventListener('timeupdate', function () {
                    if (video.currentTime > 1) {
                        // 视频进度超过1秒，隐藏错误（如果存在）
                        document.getElementById('error').style.display = 'none';
                    }
                });

                hls.loadSource(url);
                hls.attachMedia(video);

                // enable airplay, from https://github.com/video-dev/hls.js/issues/5989
                // 检查是否已存在source元素，如果存在则更新，不存在则创建
                let sourceElement = video.querySelector('source');
                if (sourceElement) {
                    // 更新现有source元素的URL
                    sourceElement.src = videoUrl;
                } else {
                    // 创建新的source元素
                    sourceElement = document.createElement('source');
                    sourceElement.src = videoUrl;
                    video.appendChild(sourceElement);
                }
                video.disableRemotePlayback = false;

                hls.on(Hls.Events.MANIFEST_PARSED, function () {
                    // 存储可用的质量级别
                    if (hls.levels && hls.levels.length > 0) {
                        videoQualityLevels = [];
                        hls.levels.forEach((level, index) => {
                            // 尝试从名称或带宽计算质量描述
                            let qualityName = level.height ? `${level.height}p` : `清晰度 ${index + 1}`;
                            if (level.bitrate) {
                                // 添加带宽信息
                                qualityName += ` (${Math.round(level.bitrate / 1000000 * 10) / 10}Mbps)`;
                            }
                            videoQualityLevels.push({
                                index: index,
                                name: qualityName,
                                bitrate: level.bitrate || 0,
                                height: level.height
                            });
                        });
                        
                        // 按高度和比特率降序排序
                        videoQualityLevels.sort((a, b) => {
                            const aHeight = a.height || 0;
                            const bHeight = b.height || 0;
                            if (bHeight !== aHeight) {
                                return bHeight - aHeight;
                            }
                            return b.bitrate - a.bitrate;
                        });
                        
                        // 从localStorage加载保存的质量设置
                        const savedQualityKey = `videoQuality_${getVideoId()}`;
                        const savedQualityIndex = parseInt(localStorage.getItem(savedQualityKey) || '-1');
                        
                        // 如果有保存的质量设置且有效，则应用
                        if (savedQualityIndex >= 0 && savedQualityIndex < videoQualityLevels.length) {
                            currentQualityIndex = savedQualityIndex;
                            hls.loadLevel = videoQualityLevels[savedQualityIndex].index;
                        }
                        
                        // 添加质量选择器到播放器设置菜单
                        setTimeout(() => {
                            addQualitySelectorToSettings();
                        }, 500);
                    }
                    
                    // 应用保存的播放速度
                    try {
                        // 优先使用播放器插件设置播放速度
                        if (art && art.plugins && art.plugins.playbackRate && art.plugins.playbackRate.switchPlaybackRate) {
                            art.plugins.playbackRate.switchPlaybackRate(currentPlaybackRate);
                        } else if (video) {
                            // 备用方式直接设置视频元素的播放速度
                            video.playbackRate = currentPlaybackRate;
                        }
                        // 更新当前播放速度变量
                        currentPlaybackRate = video ? video.playbackRate : 1.0;
                    } catch (e) {
                        console.warn('设置播放速度时出错:', e);
                    }
                    
                    // 视频加载成功，隐藏错误提示
                    const errorContainer = document.getElementById('errorContainer');
                    if (errorContainer) {
                        errorContainer.style.display = 'none';
                    }
                    
                    video.play().catch(e => {
                    });
                });

                hls.on(Hls.Events.ERROR, function (event, data) {
                    // 增加错误计数
                    errorCount++;

                    // 处理bufferAppendError
                    if (data.details === 'bufferAppendError') {
                        bufferAppendErrorCount++;
                        // 如果视频已经开始播放，则忽略这个错误
                        if (playbackStarted) {
                            return;
                        }

                        // 如果出现多次bufferAppendError但视频未播放，尝试恢复
                        if (bufferAppendErrorCount >= 3) {
                            hls.recoverMediaError();
                        }
                    }

                    // 如果是致命错误，且视频未播放
                    if (data.fatal && !playbackStarted) {
                        // 尝试恢复错误
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                hls.recoverMediaError();
                                break;
                            default:
                                // 仅在多次恢复尝试后显示错误
                                if (errorCount > 3 && !errorDisplayed) {
                                    errorDisplayed = true;
                                    showError('视频加载失败，可能是格式不兼容或源不可用');
                                }
                                break;
                        }
                    }
                });

                // 监听分段加载事件
                hls.on(Hls.Events.FRAG_LOADED, function () {
                    document.getElementById('player-loading').style.display = 'none';
                });

                // 监听级别加载事件
                hls.on(Hls.Events.LEVEL_LOADED, function () {
                    document.getElementById('player-loading').style.display = 'none';
                });
            }
        }
    });

    // artplayer 没有 'fullscreenWeb:enter', 'fullscreenWeb:exit' 等事件
    // 所以原控制栏隐藏代码并没有起作用
    // 实际起作用的是 artplayer 默认行为，它支持自动隐藏工具栏
    // 但有一个 bug： 在副屏全屏时，鼠标移出副屏后不会自动隐藏工具栏
    // 下面进一并重构和修复：
    let hideTimer;

    // 隐藏控制栏
    function hideControls() {
        if (art && art.controls) {
            art.controls.show = false;
        }
    }

    // 重置计时器，计时器超时时间与 artplayer 保持一致
    function resetHideTimer() {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            hideControls();
        }, Artplayer.CONTROL_HIDE_TIME);
    }

    // 处理鼠标离开浏览器窗口
    function handleMouseOut(e) {
        if (e && !e.relatedTarget) {
            resetHideTimer();
        }
    }

    // 全屏状态切换时注册/移除 mouseout 事件，监听鼠标移出屏幕事件
    // 从而对播放器状态栏进行隐藏倒计时
    function handleFullScreen(isFullScreen, isWeb) {
        if (isFullScreen) {
            document.addEventListener('mouseout', handleMouseOut);
        } else {
            document.removeEventListener('mouseout', handleMouseOut);
            // 退出全屏时清理计时器
            clearTimeout(hideTimer);
        }

        if (!isWeb) {
            if (window.screen.orientation && window.screen.orientation.lock) {
                window.screen.orientation.lock('landscape')
                    .then(() => {
                    })
                    .catch((error) => {
                    });
            }
        }
    }

    // 播放器加载完成后初始隐藏工具栏
    art.on('ready', () => {
        hideControls();
        
        // 配置自定义播放速度选项
        if (art.plugins && art.plugins.playbackRate) {
            try {
                // 尝试直接修改playbackRate插件的选项
                if (art.plugins.playbackRate.options) {
                    art.plugins.playbackRate.options = playbackRates.map(rate => ({ name: `${rate}x`, value: rate }));
                    console.log('自定义播放速度选项已配置:', playbackRates);
                } else {
                    console.warn('无法直接修改playbackRate选项，将使用默认选项但会记住用户选择');
                }
            } catch (e) {
                console.warn('配置自定义播放速度选项时出错:', e);
            }
        }
        
        // 应用保存的播放速度
        if (currentPlaybackRate !== 1.0 && art.plugins && art.plugins.playbackRate && art.plugins.playbackRate.switchPlaybackRate) {
            try {
                art.plugins.playbackRate.switchPlaybackRate(currentPlaybackRate);
                console.log('已应用保存的播放速度:', currentPlaybackRate);
            } catch (e) {
                console.warn('应用保存的播放速度时出错:', e);
                // 备用方案：直接设置视频元素的播放速度
                if (art.video) {
                    art.video.playbackRate = currentPlaybackRate;
                }
            }
        }
        
        // 监听播放速度变化事件，保存用户选择的速度
        art.on('playbackRateChange', (rate) => {
            currentPlaybackRate = rate;
            const savedRateKey = `playbackRate_${getVideoId()}`;
            localStorage.setItem(savedRateKey, rate.toString());
            console.log('播放速度已更改为:', rate);
            // 确保showSpeedChangeHint函数存在再调用
            if (typeof showSpeedChangeHint === 'function') {
                showSpeedChangeHint(rate);
            }
        });
            
            // 立即初始化智能跳过功能，确保用户控制界面正确显示
            initSkipIntroOutro();
            
            // 初始化播放器设置（包装在try-catch中避免错误）
            try {
                // 先检查播放器是否已准备好
                if (window.art && window.art.ready) {
                    initPlayerSettings();
                } else {
                    console.log('播放器尚未完全准备好，延迟初始化设置');
                }
            } catch (e) {
                console.error('初始化播放器设置时出错:', e);
            }
            
            // 额外添加一个延时调用，确保设置面板已经完全渲染
            setTimeout(() => {
                try {
                    initSkipIntroOutro();
                    initPlayerSettings();
                } catch (e) {
                    console.error('延时初始化播放器设置时出错:', e);
                }
            }, 1000);
        
        // 设置视频元数据加载事件，计算片尾时间
        art.video.addEventListener('loadedmetadata', function() {
            // 计算片尾开始时间（默认视频长度的90%处）
            if (art.video.duration) {
                outroStart = art.video.duration * 0.9;
                outroEnd = art.video.duration;
            }
        });
        
        // 监听视频播放进度，检测是否需要显示跳过按钮
        art.video.addEventListener('timeupdate', checkSkipConditions);
        
        // 监听视频播放开始事件，重置跳过状态
        art.video.addEventListener('play', function() {
            introSkipped = false;
            outroSkipped = false;
        });
        
        // 监听视频加载新源事件，重置跳过状态
        art.on('url', function() {
            introSkipped = false;
            outroSkipped = false;
            if (skipButton) {
                skipButton.remove();
                skipButton = null;
            }
        });
        
        // 监听画中画模式变化
        if (document.pictureInPictureEnabled && art.video) {
            art.video.addEventListener('enterpictureinpicture', () => {
                console.log('进入画中画模式');
                const pipButton = document.querySelector('.artplayer-pip-button');
                if (pipButton) pipButton.classList.add('active');
            });
            
            art.video.addEventListener('leavepictureinpicture', () => {
                console.log('离开画中画模式');
                const pipButton = document.querySelector('.artplayer-pip-button');
                if (pipButton) pipButton.classList.remove('active');
            });
            
            // 设置画中画按钮
            setupPictureInPictureButton();
        }
    });

    // 全屏 Web 模式处理
    art.on('fullscreenWeb', function (isFullScreen) {
        handleFullScreen(isFullScreen, true);
    });

    // 全屏模式处理
    art.on('fullscreen', function (isFullScreen) {
        handleFullScreen(isFullScreen, false);
    });

    art.on('video:loadedmetadata', function() {
        document.getElementById('player-loading').style.display = 'none';
        videoHasEnded = false; // 视频加载时重置结束标志
        // 优先使用URL传递的position参数
        const urlParams = new URLSearchParams(window.location.search);
        const savedPosition = parseInt(urlParams.get('position') || '0');

        if (savedPosition > 10 && savedPosition < art.duration - 2) {
            // 如果URL中有有效的播放位置参数，直接使用它
            art.currentTime = savedPosition;
            showPositionRestoreHint(savedPosition);
        } else {
            // 否则尝试从本地存储恢复播放进度
            try {
                const progressKey = 'videoProgress_' + getVideoId();
                const progressStr = localStorage.getItem(progressKey);
                if (progressStr && art.duration > 0) {
                    const progress = JSON.parse(progressStr);
                    if (
                        progress &&
                        typeof progress.position === 'number' &&
                        progress.position > 10 &&
                        progress.position < art.duration - 2
                    ) {
                        art.currentTime = progress.position;
                        showPositionRestoreHint(progress.position);
                    }
                }
            } catch (e) {
            }
        }

        // 设置进度条点击监听
        setupProgressBarPreciseClicks();

        // 视频加载成功后，在稍微延迟后将其添加到观看历史
    setTimeout(saveToHistory, 3000);

        // 确保视频元素属性正确设置，支持画中画
        if (art.video) {
            art.video.playsInline = true;
            art.video.disablePictureInPicture = false;
        }

        // 启动定期保存播放进度
        startProgressSaveInterval();
    })

    // 错误处理
    art.on('video:error', function (error) {
        // 如果正在切换视频，忽略错误
        if (window.isSwitchingVideo) {
            return;
        }

        // 隐藏所有加载指示器
        const loadingElements = document.querySelectorAll('#player-loading, .player-loading-container');
        loadingElements.forEach(el => {
            if (el) el.style.display = 'none';
        });

        showError('视频播放失败: ' + (error.message || '未知错误'));
    });

    // 添加移动端长按三倍速播放功能
    setupLongPressSpeedControl();

    // 视频播放结束事件
    art.on('video:ended', function () {
        videoHasEnded = true;

        clearVideoProgress();

        // 如果自动播放下一集开启，且确实有下一集
        if (autoplayEnabled && currentEpisodeIndex < currentEpisodes.length - 1) {
            // 稍长延迟以确保所有事件处理完成
            setTimeout(() => {
                // 确认不是因为用户拖拽导致的假结束事件
                playNextEpisode();
                videoHasEnded = false; // 重置标志
            }, 1000);
        } else {
            art.fullscreen = false;
        }
    });

    // 添加双击全屏支持
    art.on('video:playing', () => {
        // 绑定双击事件到视频容器
        if (art.video) {
            art.video.addEventListener('dblclick', () => {
                art.fullscreen = !art.fullscreen;
                art.play();
            });
        }
    });

    // 10秒后如果仍在加载，但不立即显示错误
    setTimeout(function () {
        // 如果视频已经播放开始，则不显示错误
        if (art && art.video && art.video.currentTime > 0) {
            return;
        }

        const loadingElement = document.getElementById('player-loading');
        if (loadingElement && loadingElement.style.display !== 'none') {
            loadingElement.innerHTML = `
                <div class="loading-spinner"></div>
                <div>视频加载时间较长，请耐心等待...</div>
                <div style="font-size: 12px; color: #aaa; margin-top: 10px;">如长时间无响应，请尝试其他视频源</div>
            `;
        }
    }, 10000);
}

// 自定义M3U8 Loader用于过滤广告
class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
    constructor(config) {
        super(config);
        const load = this.load.bind(this);
        this.load = function (context, config, callbacks) {
            // 拦截manifest和level请求
            if (context.type === 'manifest' || context.type === 'level') {
                const onSuccess = callbacks.onSuccess;
                callbacks.onSuccess = function (response, stats, context) {
                    // 如果是m3u8文件，处理内容以移除广告分段
                    if (response.data && typeof response.data === 'string') {
                        // 过滤掉广告段 - 实现更精确的广告过滤逻辑
                        response.data = filterAdsFromM3U8(response.data, true);
                    }
                    return onSuccess(response, stats, context);
                };
            }
            // 执行原始load方法
            load(context, config, callbacks);
        };
    }
}

// 过滤可疑的广告内容
function filterAdsFromM3U8(m3u8Content, strictMode = false) {
    if (!m3u8Content) return '';

    // 按行分割M3U8内容
    const lines = m3u8Content.split('\n');
    const filteredLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 只过滤#EXT-X-DISCONTINUITY标识
        if (!line.includes('#EXT-X-DISCONTINUITY')) {
            filteredLines.push(line);
        }
    }

    return filteredLines.join('\n');
}


// 显示错误
function showError(message) {
    // 在视频已经播放的情况下不显示错误
    if (art && art.video && art.video.currentTime > 1) {
        return;
    }
    const loadingEl = document.getElementById('player-loading');
    if (loadingEl) loadingEl.style.display = 'none';
    const errorEl = document.getElementById('error');
    if (errorEl) errorEl.style.display = 'flex';
    const errorMsgEl = document.getElementById('error-message');
    if (errorMsgEl) errorMsgEl.textContent = message;
}

// 更新集数信息
function updateEpisodeInfo() {
    if (currentEpisodes.length > 0) {
        document.getElementById('episodeInfo').textContent = `第 ${currentEpisodeIndex + 1}/${currentEpisodes.length} 集`;
    } else {
        document.getElementById('episodeInfo').textContent = '无集数信息';
    }
}

// 更新按钮状态
function updateButtonStates() {
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');

    // 处理上一集按钮
    if (currentEpisodeIndex > 0) {
        prevButton.classList.remove('bg-gray-700', 'cursor-not-allowed');
        prevButton.classList.add('bg-[#222]', 'hover:bg-[#333]');
        prevButton.removeAttribute('disabled');
    } else {
        prevButton.classList.add('bg-gray-700', 'cursor-not-allowed');
        prevButton.classList.remove('bg-[#222]', 'hover:bg-[#333]');
        prevButton.setAttribute('disabled', '');
    }

    // 处理下一集按钮
    if (currentEpisodeIndex < currentEpisodes.length - 1) {
        nextButton.classList.remove('bg-gray-700', 'cursor-not-allowed');
        nextButton.classList.add('bg-[#222]', 'hover:bg-[#333]');
        nextButton.removeAttribute('disabled');
    } else {
        nextButton.classList.add('bg-gray-700', 'cursor-not-allowed');
        nextButton.classList.remove('bg-[#222]', 'hover:bg-[#333]');
        nextButton.setAttribute('disabled', '');
    }
}

// 渲染集数按钮
function renderEpisodes() {
    const episodesList = document.getElementById('episodesList');
    if (!episodesList) return;

    if (!currentEpisodes || currentEpisodes.length === 0) {
        episodesList.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8">没有可用的集数</div>';
        return;
    }

    const episodes = episodesReversed ? [...currentEpisodes].reverse() : currentEpisodes;
    let html = '';

    episodes.forEach((episode, index) => {
        // 根据倒序状态计算真实的剧集索引
        const realIndex = episodesReversed ? currentEpisodes.length - 1 - index : index;
        const isActive = realIndex === currentEpisodeIndex;

        html += `
            <button id="episode-${realIndex}" 
                    onclick="playEpisode(${realIndex})" 
                    class="px-4 py-2 ${isActive ? 'episode-active' : '!bg-[#222] hover:!bg-[#333] hover:!shadow-none'} !border ${isActive ? '!border-blue-500' : '!border-[#333]'} rounded-lg transition-colors text-center episode-btn">
                ${realIndex + 1}
            </button>
        `;
    });

    episodesList.innerHTML = html;
}

// 播放指定集数
function playEpisode(index) {
    // 确保index在有效范围内
    if (index < 0 || index >= currentEpisodes.length) {
        return;
    }

    // 保存当前播放进度（如果正在播放）
    if (art && art.video && !art.video.paused && !videoHasEnded) {
        saveCurrentProgress();
    }

    // 清除进度保存计时器
    if (progressSaveInterval) {
        clearInterval(progressSaveInterval);
        progressSaveInterval = null;
    }

    // 首先隐藏之前可能显示的错误
    document.getElementById('error').style.display = 'none';
    // 显示加载指示器
    document.getElementById('player-loading').style.display = 'flex';
    document.getElementById('player-loading').innerHTML = `
        <div class="loading-spinner"></div>
        <div>正在加载视频...</div>
    `;

    // 获取 sourceCode
    const urlParams2 = new URLSearchParams(window.location.search);
    const sourceCode = urlParams2.get('source_code');

    // 准备切换剧集的URL
    const url = currentEpisodes[index];

    // 更新当前剧集索引
    currentEpisodeIndex = index;
    currentVideoUrl = url;
    videoHasEnded = false; // 重置视频结束标志

    clearVideoProgress();

    // 更新URL参数（不刷新页面）
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('index', index);
    currentUrl.searchParams.set('url', url);
    currentUrl.searchParams.delete('position');
    window.history.replaceState({}, '', currentUrl.toString());

    if (isWebkit) {
        initPlayer(url);
    } else {
        art.switch = url;
    }

    // 更新UI
    updateEpisodeInfo();
    updateButtonStates();
    renderEpisodes();

    // 重置用户点击位置记录
    userClickedPosition = null;

    // 三秒后保存到历史记录
    setTimeout(() => saveToHistory(), 3000);
}

// 播放上一集
function playPreviousEpisode() {
    if (currentEpisodeIndex > 0) {
        playEpisode(currentEpisodeIndex - 1);
    }
}

// 播放下一集
function playNextEpisode() {
    if (currentEpisodeIndex < currentEpisodes.length - 1) {
        playEpisode(currentEpisodeIndex + 1);
    }
}

// 复制播放链接
function copyLinks() {
    // 尝试从URL中获取参数
    const urlParams = new URLSearchParams(window.location.search);
    const linkUrl = urlParams.get('url') || '';
    if (linkUrl !== '') {
        navigator.clipboard.writeText(linkUrl).then(() => {
            showToast('播放链接已复制', 'success');
        }).catch(err => {
            showToast('复制失败，请检查浏览器权限', 'error');
        });
    }
}

// 切换集数排序
function toggleEpisodeOrder() {
    episodesReversed = !episodesReversed;

    // 保存到localStorage
    localStorage.setItem('episodesReversed', episodesReversed);

    // 重新渲染集数列表
    renderEpisodes();

    // 更新排序按钮
    updateOrderButton();
}

// 更新排序按钮状态
function updateOrderButton() {
    const orderText = document.getElementById('orderText');
    const orderIcon = document.getElementById('orderIcon');

    if (orderText && orderIcon) {
        orderText.textContent = episodesReversed ? '正序排列' : '倒序排列';
        orderIcon.style.transform = episodesReversed ? 'rotate(180deg)' : '';
    }
}

// 设置进度条准确点击处理
function setupProgressBarPreciseClicks() {
    // 查找DPlayer的进度条元素
    const progressBar = document.querySelector('.dplayer-bar-wrap');
    if (!progressBar || !art || !art.video) return;

    // 移除可能存在的旧事件监听器
    progressBar.removeEventListener('mousedown', handleProgressBarClick);

    // 添加新的事件监听器
    progressBar.addEventListener('mousedown', handleProgressBarClick);

    // 在移动端也添加触摸事件支持
    progressBar.removeEventListener('touchstart', handleProgressBarTouch);
    progressBar.addEventListener('touchstart', handleProgressBarTouch);

    // 处理进度条点击
    function handleProgressBarClick(e) {
        if (!art || !art.video) return;

        // 计算点击位置相对于进度条的比例
        const rect = e.currentTarget.getBoundingClientRect();
        const percentage = (e.clientX - rect.left) / rect.width;

        // 计算点击位置对应的视频时间
        const duration = art.video.duration;
        let clickTime = percentage * duration;

        // 处理视频接近结尾的情况
        if (duration - clickTime < 1) {
            // 如果点击位置非常接近结尾，稍微往前移一点
            clickTime = Math.min(clickTime, duration - 1.5);

        }

        // 记录用户点击的位置
        userClickedPosition = clickTime;

        // 阻止默认事件传播，避免DPlayer内部逻辑将视频跳至末尾
        e.stopPropagation();

        // 直接设置视频时间
        art.seek(clickTime);
    }

    // 处理移动端触摸事件
    function handleProgressBarTouch(e) {
        if (!art || !art.video || !e.touches[0]) return;

        const touch = e.touches[0];
        const rect = e.currentTarget.getBoundingClientRect();
        const percentage = (touch.clientX - rect.left) / rect.width;

        const duration = art.video.duration;
        let clickTime = percentage * duration;

        // 处理视频接近结尾的情况
        if (duration - clickTime < 1) {
            clickTime = Math.min(clickTime, duration - 1.5);
        }

        // 记录用户点击的位置
        userClickedPosition = clickTime;

        e.stopPropagation();
        art.seek(clickTime);
    }
}

// 在播放器初始化后添加视频到历史记录
function saveToHistory() {
    // 确保 currentEpisodes 非空且有当前视频URL
    if (!currentEpisodes || currentEpisodes.length === 0 || !currentVideoUrl) {
        return;
    }

    // 尝试从URL中获取参数
    const urlParams = new URLSearchParams(window.location.search);
    const sourceName = urlParams.get('source') || '';
    const sourceCode = urlParams.get('source') || '';
    const id_from_params = urlParams.get('id'); // Get video ID from player URL (passed as 'id')

    // 获取当前播放进度
    let currentPosition = 0;
    let videoDuration = 0;

    if (art && art.video) {
        currentPosition = art.video.currentTime;
        videoDuration = art.video.duration;
    }

    // Define a show identifier: Prioritize sourceName_id, fallback to first episode URL or current video URL
    let show_identifier_for_video_info;
    if (sourceName && id_from_params) {
        show_identifier_for_video_info = `${sourceName}_${id_from_params}`;
    } else {
        show_identifier_for_video_info = (currentEpisodes && currentEpisodes.length > 0) ? currentEpisodes[0] : currentVideoUrl;
    }

    // 构建要保存的视频信息对象
    const videoInfo = {
        title: currentVideoTitle,
        directVideoUrl: currentVideoUrl, // Current episode's direct URL
        url: `player.html?url=${encodeURIComponent(currentVideoUrl)}&title=${encodeURIComponent(currentVideoTitle)}&source=${encodeURIComponent(sourceName)}&source_code=${encodeURIComponent(sourceCode)}&id=${encodeURIComponent(id_from_params || '')}&index=${currentEpisodeIndex}&position=${Math.floor(currentPosition || 0)}`,
        episodeIndex: currentEpisodeIndex,
        sourceName: sourceName,
        vod_id: id_from_params || '', // Store the ID from params as vod_id in history item
        sourceCode: sourceCode,
        showIdentifier: show_identifier_for_video_info, // Identifier for the show/series
        timestamp: Date.now(),
        playbackPosition: currentPosition,
        duration: videoDuration,
        episodes: currentEpisodes && currentEpisodes.length > 0 ? [...currentEpisodes] : []
    };
    
    try {
        const history = JSON.parse(localStorage.getItem('viewingHistory') || '[]');

        // 检查是否已经存在相同的系列记录 (基于标题、来源和 showIdentifier)
        const existingIndex = history.findIndex(item => 
            item.title === videoInfo.title && 
            item.sourceName === videoInfo.sourceName && 
            item.showIdentifier === videoInfo.showIdentifier
        );

        if (existingIndex !== -1) {
            // 存在则更新现有记录的当前集数、时间戳、播放进度和URL等
            const existingItem = history[existingIndex];
            existingItem.episodeIndex = videoInfo.episodeIndex;
            existingItem.timestamp = videoInfo.timestamp;
            existingItem.sourceName = videoInfo.sourceName; // Should be consistent, but update just in case
            existingItem.sourceCode = videoInfo.sourceCode;
            existingItem.vod_id = videoInfo.vod_id;
            
            // Update URLs to reflect the current episode being watched
            existingItem.directVideoUrl = videoInfo.directVideoUrl; // Current episode's direct URL
            existingItem.url = videoInfo.url; // Player link for the current episode

            // 更新播放进度信息
            existingItem.playbackPosition = videoInfo.playbackPosition > 10 ? videoInfo.playbackPosition : (existingItem.playbackPosition || 0);
            existingItem.duration = videoInfo.duration || existingItem.duration;
            
            // 更新集数列表（如果新的集数列表与存储的不同，例如集数增加了）
            if (videoInfo.episodes && videoInfo.episodes.length > 0) {
                if (!existingItem.episodes || 
                    !Array.isArray(existingItem.episodes) || 
                    existingItem.episodes.length !== videoInfo.episodes.length || 
                    !videoInfo.episodes.every((ep, i) => ep === existingItem.episodes[i])) { // Basic check for content change
                    existingItem.episodes = [...videoInfo.episodes]; // Deep copy
                }
            }
            
            // 移到最前面
            const updatedItem = history.splice(existingIndex, 1)[0];
            history.unshift(updatedItem);
        } else {
            // 添加新记录到最前面
            history.unshift(videoInfo);
        }

        // 限制历史记录数量为50条
        if (history.length > 50) history.splice(50);

        localStorage.setItem('viewingHistory', JSON.stringify(history));
    } catch (e) {
    }
}

// 显示恢复位置提示
function showPositionRestoreHint(position) {
    if (!position || position < 10) return;

    // 创建提示元素
    const hint = document.createElement('div');
    hint.className = 'position-restore-hint';
    hint.innerHTML = `
        <div class="hint-content">
            已从 ${formatTime(position)} 继续播放
        </div>
    `;

    // 添加到播放器容器
    const playerContainer = document.querySelector('.player-container'); // Ensure this selector is correct
    if (playerContainer) { // Check if playerContainer exists
        playerContainer.appendChild(hint);
    } else {
        return; // Exit if container not found
    }

    // 显示提示
    setTimeout(() => {
        hint.classList.add('show');

        // 3秒后隐藏
        setTimeout(() => {
            hint.classList.remove('show');
            setTimeout(() => hint.remove(), 300);
        }, 3000);
    }, 100);
}

// 格式化时间为 mm:ss 格式
function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// 开始定期保存播放进度
function startProgressSaveInterval() {
    // 清除可能存在的旧计时器
    if (progressSaveInterval) {
        clearInterval(progressSaveInterval);
    }

    // 每30秒保存一次播放进度
    progressSaveInterval = setInterval(saveCurrentProgress, 30000);
}

// 保存当前播放进度
function saveCurrentProgress() {
    if (!art || !art.video) return;
    const currentTime = art.video.currentTime;
    const duration = art.video.duration;
    if (!duration || currentTime < 1) return;

    // 在localStorage中保存进度
    const progressKey = `videoProgress_${getVideoId()}`;
    const progressData = {
        position: currentTime,
        duration: duration,
        timestamp: Date.now()
    };
    try {
        localStorage.setItem(progressKey, JSON.stringify(progressData));
        // --- 新增：同步更新 viewingHistory 中的进度 ---
        try {
            const historyRaw = localStorage.getItem('viewingHistory');
            if (historyRaw) {
                const history = JSON.parse(historyRaw);
                // 用 title + 集数索引唯一标识
                const idx = history.findIndex(item =>
                    item.title === currentVideoTitle &&
                    (item.episodeIndex === undefined || item.episodeIndex === currentEpisodeIndex)
                );
                if (idx !== -1) {
                    // 只在进度有明显变化时才更新，减少写入
                    if (
                        Math.abs((history[idx].playbackPosition || 0) - currentTime) > 2 ||
                        Math.abs((history[idx].duration || 0) - duration) > 2
                    ) {
                        history[idx].playbackPosition = currentTime;
                        history[idx].duration = duration;
                        history[idx].timestamp = Date.now();
                        localStorage.setItem('viewingHistory', JSON.stringify(history));
                    }
                }
            }
        } catch (e) {
        }
    } catch (e) {
    }
}

// 设置移动端长按三倍速播放功能
function setupLongPressSpeedControl() {
    if (!art || !art.video) return;

    const playerElement = document.getElementById('player');
    let longPressTimer = null;
    let originalPlaybackRate = 1.0;
    let isLongPress = false;

    // 显示快速提示
    function showSpeedHint(speed) {
        showShortcutHint(`${speed}倍速`, 'right');
    }

    // 禁用右键
    playerElement.oncontextmenu = () => {
        // 检测是否为移动设备
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // 只在移动设备上禁用右键
        if (isMobile) {
            const dplayerMenu = document.querySelector(".dplayer-menu");
            const dplayerMask = document.querySelector(".dplayer-mask");
            if (dplayerMenu) dplayerMenu.style.display = "none";
            if (dplayerMask) dplayerMask.style.display = "none";
            return false;
        }
        return true; // 在桌面设备上允许右键菜单
    };

    // 触摸开始事件
    playerElement.addEventListener('touchstart', function (e) {
        // 检查视频是否正在播放，如果没有播放则不触发长按功能
        if (art.video.paused) {
            return; // 视频暂停时不触发长按功能
        }

        // 保存原始播放速度
        originalPlaybackRate = art.video.playbackRate;

        // 设置长按计时器
        longPressTimer = setTimeout(() => {
            // 再次检查视频是否仍在播放
            if (art.video.paused) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
                return;
            }

            // 长按超过500ms，设置为3倍速
            art.video.playbackRate = 3.0;
            isLongPress = true;
            showSpeedHint(3.0);

            // 只在确认为长按时阻止默认行为
            e.preventDefault();
        }, 500);
    }, { passive: false });

    // 触摸结束事件
    playerElement.addEventListener('touchend', function (e) {
        // 清除长按计时器
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        // 如果是长按状态，恢复原始播放速度
        if (isLongPress) {
            art.video.playbackRate = originalPlaybackRate;
            isLongPress = false;
            showSpeedHint(originalPlaybackRate);

            // 阻止长按后的点击事件
            e.preventDefault();
        }
        // 如果不是长按，则允许正常的点击事件（暂停/播放）
    });

    // 触摸取消事件
    playerElement.addEventListener('touchcancel', function () {
        // 清除长按计时器
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        // 如果是长按状态，恢复原始播放速度
        if (isLongPress) {
            art.video.playbackRate = originalPlaybackRate;
            isLongPress = false;
        }
    });

    // 触摸移动事件 - 防止在长按时触发页面滚动
    playerElement.addEventListener('touchmove', function (e) {
        if (isLongPress) {
            e.preventDefault();
        }
    }, { passive: false });

    // 视频暂停时取消长按状态
    art.video.addEventListener('pause', function () {
        if (isLongPress) {
            art.video.playbackRate = originalPlaybackRate;
            isLongPress = false;
        }

        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });
}

// 显示播放速度变化提示
function showSpeedChangeHint(rate) {
    const hint = document.createElement('div');
    hint.className = 'speed-change-hint';
    hint.innerHTML = `
        <div class="hint-content">
            ${rate}x 速度
        </div>
    `;
    hint.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        font-size: 18px;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s;
    `;
    
    // 添加到播放器容器
    const playerContainer = document.querySelector('#player');
    if (playerContainer) {
        playerContainer.appendChild(hint);
        
        // 显示提示
        setTimeout(() => {
            hint.style.opacity = '1';
            
            // 1.5秒后隐藏
            setTimeout(() => {
                hint.style.opacity = '0';
                setTimeout(() => hint.remove(), 300);
            }, 1500);
        }, 10);
    }
}

// 初始化智能跳过片首片尾功能
function initSkipIntroOutro() {
    // 添加跳过设置到播放器菜单
    addSkipSettingsToMenu();
    
    // 初始化跳过按钮（暂时隐藏）
    createSkipButton();
}

// 检查是否满足跳过条件
function checkSkipConditions() {
    if (!art || !art.video) return;
    
    const currentTime = art.video.currentTime;
    
    // 检查是否需要跳过片头
    if (skipIntroEnabled && !introSkipped && 
        currentTime >= introStart && currentTime <= introEnd) {
        showSkipButton('片头', introEnd);
        return;
    }
    
    // 检查是否需要跳过片尾
    if (skipOutroEnabled && !outroSkipped && outroStart !== null &&
        currentTime >= outroStart && currentTime <= outroEnd) {
        showSkipButton('片尾', outroEnd);
        return;
    }
    
    // 如果不在片头片尾区域，隐藏跳过按钮
    if (skipButton && skipButton.style.display !== 'none') {
        hideSkipButton();
    }
}

// 创建跳过按钮
function createSkipButton() {
    if (skipButton) return;
    
    skipButton = document.createElement('div');
    skipButton.className = 'skip-button';
    skipButton.style.cssText = `
        position: absolute;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        cursor: pointer;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
        font-size: 14px;
        display: none;
    `;
    
    skipButton.addEventListener('click', function() {
        const targetTime = parseFloat(skipButton.dataset.targetTime);
        if (!isNaN(targetTime)) {
            skipToPosition(targetTime);
        }
    });
    
    const playerContainer = document.querySelector('#player');
    if (playerContainer) {
        playerContainer.appendChild(skipButton);
    }
}

// 显示跳过按钮
function showSkipButton(type, targetTime) {
    if (!skipButton) createSkipButton();
    
    skipButton.textContent = `跳过${type}`;
    skipButton.dataset.targetTime = targetTime;
    skipButton.style.display = 'block';
    
    // 淡入效果
    setTimeout(() => {
        if (skipButton) skipButton.style.opacity = '1';
    }, 10);
    
    // 自动跳过提示
    setTimeout(() => {
        if (skipButton && skipButton.style.display !== 'none') {
            skipButton.textContent = `跳过${type} (3s后自动跳过)`;
            
            setTimeout(() => {
                if (skipButton && skipButton.style.display !== 'none') {
                    skipButton.textContent = `跳过${type} (2s后自动跳过)`;
                    
                    setTimeout(() => {
                        if (skipButton && skipButton.style.display !== 'none') {
                            skipButton.textContent = `跳过${type} (1s后自动跳过)`;
                            
                            setTimeout(() => {
                                if (skipButton && skipButton.style.display !== 'none') {
                                    skipToPosition(targetTime);
                                }
                            }, 1000);
                        }
                    }, 1000);
                }
            }, 1000);
        }
    }, 2000);
}

// 隐藏跳过按钮
function hideSkipButton() {
    if (!skipButton) return;
    
    skipButton.style.opacity = '0';
    setTimeout(() => {
        if (skipButton) skipButton.style.display = 'none';
    }, 300);
}

// 执行跳转操作
function skipToPosition(position) {
    if (!art || !art.video) return;
    
    // 使用正确的seek方法调用形式
    try {
        if (typeof art.seek === 'function') {
            art.seek(position);
        } else if (art.video) {
            // 备用方案：直接设置视频元素的currentTime
            art.video.currentTime = position;
        }
        console.log(`跳过到位置: ${position}秒`);
    } catch (e) {
        console.warn('跳转视频位置时出错:', e);
        // 最后的备用方案
        if (art.video) {
            art.video.currentTime = position;
        }
    }
    hideSkipButton();
    
    // 更新跳过状态
    if (position <= introEnd) {
        introSkipped = true;
    } else if (position >= outroStart) {
        outroSkipped = true;
    }
    
    // 显示跳过成功提示
    showSkipSuccessHint(position <= introEnd ? '片头' : '片尾');
}

// 显示跳过成功提示
function showSkipSuccessHint(type) {
    const hint = document.createElement('div');
    hint.className = 'skip-success-hint';
    hint.innerHTML = `
        <div class="hint-content">
            已跳过${type}
        </div>
    `;
    hint.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        font-size: 16px;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s;
    `;
    
    const playerContainer = document.querySelector('#player');
    if (playerContainer) {
        playerContainer.appendChild(hint);
        
        setTimeout(() => {
            hint.style.opacity = '1';
            
            setTimeout(() => {
                hint.style.opacity = '0';
                setTimeout(() => hint.remove(), 300);
            }, 1500);
        }, 10);
    }
}

// 添加跳过设置到播放器菜单
function addSkipSettingsToMenu() {
    console.log('添加跳过设置到播放器菜单');
    // 检查是否已经添加过设置
    if (document.querySelector('.skip-settings-container')) {
        console.log('跳过设置已经存在');
        return;
    }
    
    // 检查播放器控制是否正常工作
    let playerControlsNormal = false;
    let settingsPanel = null;
    
    // 方法1：检查ArtPlayer实例是否正常初始化
    if (typeof art !== 'undefined' && art && art.constructor && art.constructor.name === 'Artplayer') {
        playerControlsNormal = true;
        console.log('ArtPlayer实例已正常初始化');
    }
    
    // 方法2：检查播放器控件是否存在
    if (!playerControlsNormal) {
        const controlsSelector = '.artplayer-controls';
        const controls = document.querySelector(controlsSelector);
        if (controls && controls.children.length > 0) {
            playerControlsNormal = true;
            console.log('找到正常的播放器控件');
        }
    }
    
    // 方法3：尝试多种可能的设置面板选择器
    if (!playerControlsNormal) {
        const settingSelectors = ['.artplayer-setting', '.artplayer-setting-panel'];
        for (const selector of settingSelectors) {
            settingsPanel = document.querySelector(selector);
            if (settingsPanel) {
                playerControlsNormal = true;
                console.log('找到正常的播放器设置面板:', selector);
                break;
            }
        }
    }
    
    // 方法4：尝试通过API访问设置面板
    if (!playerControlsNormal && art && art.template && art.template.setting) {
        settingsPanel = art.template.setting;
        playerControlsNormal = true;
        console.log('通过播放器API获取到设置面板');
    }
    
    // 检查是否已存在临时区域
    const existingTempSettings = document.querySelector('.temp-settings');
    
    // 如果播放器控制正常，移除已存在的临时区域
    if (playerControlsNormal) {
        console.log('播放器控制正常，移除临时设置区域（如果存在）');
        if (existingTempSettings) {
            existingTempSettings.remove();
        }
    }
    
    // 只有在播放器控制不正常且临时区域不存在时才创建临时区域
    if (!playerControlsNormal && !existingTempSettings) {
        console.warn('播放器控制不正常且临时区域不存在，创建临时跳过设置区域');
        
        // 查找播放器容器
        const playerContainer = document.querySelector('#player');
        if (!playerContainer) {
            console.error('找不到播放器容器');
            return;
        }
        
        // 创建临时设置区域
        const tempSettings = document.createElement('div');
        tempSettings.className = 'skip-settings-container temp-settings';
        tempSettings.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            z-index: 1000;
            font-size: 12px;
        `;
        playerContainer.appendChild(tempSettings);
        settingsPanel = tempSettings;
    } else if (!playerControlsNormal && existingTempSettings) {
        // 如果播放器控制不正常但临时区域已存在，直接使用已存在的
        console.log('播放器控制不正常但临时区域已存在，使用已有的临时区域');
        settingsPanel = existingTempSettings;
    }
    
    // 如果仍然没有设置面板，退出函数
    if (!settingsPanel) {
        console.error('无法创建设置面板或临时区域');
        return;
    }
    
    const skipContainer = document.createElement('div');
    skipContainer.className = 'skip-settings-container artplayer-setting-item';
    skipContainer.style.cssText = 'margin: 10px 0;';
    
    skipContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span>跳过片头</span>
            <label class="switch">
                <input type="checkbox" id="skipIntroToggle" ${skipIntroEnabled ? 'checked' : ''}>
                <span class="slider round"></span>
            </label>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>跳过片尾</span>
            <label class="switch">
                <input type="checkbox" id="skipOutroToggle" ${skipOutroEnabled ? 'checked' : ''}>
                <span class="slider round"></span>
            </label>
        </div>
    `;
    
    // 添加到设置面板
    if (settingsPanel.firstChild) {
        settingsPanel.insertBefore(skipContainer, settingsPanel.firstChild);
    } else {
        settingsPanel.appendChild(skipContainer);
    }
    
    console.log('跳过设置已添加到播放器菜单');
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .switch {
            position: relative;
            display: inline-block;
            width: 40px;
            height: 20px;
        }
        .switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 20px;
        }
        .slider:before {
            position: absolute;
            content: "";
            height: 16px;
            width: 16px;
            left: 2px;
            bottom: 2px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }
        input:checked + .slider {
            background-color: #23ade5;
        }
        input:checked + .slider:before {
            transform: translateX(20px);
        }
    `;
    document.head.appendChild(style);
    
    // 添加事件监听
    document.getElementById('skipIntroToggle').addEventListener('change', function(e) {
        skipIntroEnabled = e.target.checked;
        localStorage.setItem('skipIntroEnabled', skipIntroEnabled);
    });
    
    document.getElementById('skipOutroToggle').addEventListener('change', function(e) {
        skipOutroEnabled = e.target.checked;
        localStorage.setItem('skipOutroEnabled', skipOutroEnabled);
    });
}

// 添加视频质量选择器到设置菜单
function addQualitySelectorToSettings() {
    if (videoQualityLevels.length === 0 || !art) return;
    
    // 检查是否已经添加过质量选择器
    if (document.querySelector('.quality-selector-container')) return;
    
    // 创建质量选择器容器
    const settingsPanel = document.querySelector('.artplayer-setting');
    if (!settingsPanel) return;
    
    // 从localStorage加载保存的质量设置
    const savedQualityKey = `videoQuality_${getVideoId()}`;
    const savedQualityIndex = parseInt(localStorage.getItem(savedQualityKey) || '-1');
    
    // 如果有保存的质量设置且有效，则应用
    if (savedQualityIndex >= 0 && savedQualityIndex < videoQualityLevels.length) {
        currentQualityIndex = savedQualityIndex;
        if (currentHls) {
            currentHls.loadLevel = videoQualityLevels[savedQualityIndex].index;
        }
    }
    
    // 在设置面板中添加质量选择器
    const qualitySection = document.createElement('div');
    qualitySection.className = 'quality-selector-container artplayer-setting-item';
    qualitySection.innerHTML = `
        <div class="artplayer-setting-label">视频质量</div>
        <div class="artplayer-setting-value">自动</div>
        <div class="artplayer-setting-menu quality-menu">
            <div class="artplayer-setting-menu-item quality-auto active" data-index="-1">自动</div>
        </div>
    `;
    
    // 添加质量选项
    const qualityMenu = qualitySection.querySelector('.quality-menu');
    videoQualityLevels.forEach((level, idx) => {
        const menuItem = document.createElement('div');
        menuItem.className = `artplayer-setting-menu-item quality-option ${savedQualityIndex === idx ? 'active' : ''}`;
        menuItem.setAttribute('data-index', idx);
        menuItem.textContent = level.name;
        qualityMenu.appendChild(menuItem);
    });
    
    // 添加到设置面板顶部
    const firstSetting = settingsPanel.querySelector('.artplayer-setting-item');
    if (firstSetting) {
        settingsPanel.insertBefore(qualitySection, firstSetting);
    } else {
        settingsPanel.appendChild(qualitySection);
    }
    
    // 添加点击事件
    qualitySection.querySelector('.artplayer-setting-label, .artplayer-setting-value').addEventListener('click', (e) => {
        const menu = qualitySection.querySelector('.artplayer-setting-menu');
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        e.stopPropagation();
    });
    
    // 质量选项点击事件
    qualityMenu.querySelectorAll('.artplayer-setting-menu-item').forEach(item => {
        item.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            
            // 更新选中状态
            qualityMenu.querySelectorAll('.artplayer-setting-menu-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            // 更新显示值
            qualitySection.querySelector('.artplayer-setting-value').textContent = 
                index === -1 ? '自动' : this.textContent;
            
            // 隐藏菜单
            qualityMenu.style.display = 'none';
            
            // 应用质量设置
            if (currentHls) {
                currentQualityIndex = index;
                currentHls.loadLevel = index;
                
                // 保存到localStorage
                localStorage.setItem(savedQualityKey, index.toString());
                
                // 显示质量变化提示
                showQualityChangeHint(index === -1 ? '自动' : this.textContent);
            }
        });
    });
    
    // 点击其他区域关闭菜单
    document.addEventListener('click', () => {
        qualityMenu.style.display = 'none';
    });
}

// 显示质量变化提示
function showQualityChangeHint(quality) {
    const hint = document.createElement('div');
    hint.className = 'quality-change-hint';
    hint.innerHTML = `
        <div class="hint-content">
            ${quality}
        </div>
    `;
    hint.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        font-size: 18px;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s;
    `;
    
    // 添加到播放器容器
    const playerContainer = document.querySelector('#player');
    if (playerContainer) {
        playerContainer.appendChild(hint);
        
        // 显示提示
        setTimeout(() => {
            hint.style.opacity = '1';
            
            // 1.5秒后隐藏
            setTimeout(() => {
                hint.style.opacity = '0';
                setTimeout(() => hint.remove(), 300);
            }, 1500);
        }, 10);
    }
}

// 设置画中画按钮
function setupPictureInPictureButton() {
    if (!art || !art.video) return;
    
    // 检查是否已经添加过画中画按钮
    if (document.querySelector('.artplayer-pip-button')) return;
    
    // 创建画中画按钮
    const controlsRight = document.querySelector('.artplayer-controller-right');
    if (!controlsRight) return;
    
    // 寻找全屏按钮作为参考位置
    const fullscreenButton = document.querySelector('.artplayer-fullscreen');
    if (!fullscreenButton) return;
    
    const pipButton = document.createElement('div');
    pipButton.className = 'artplayer-pip-button artplayer-icon artplayer-controller-button';
    pipButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/>
        </svg>
    `;
    pipButton.style.cssText = `
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    `;
    
    // 在全屏按钮前插入画中画按钮
    controlsRight.insertBefore(pipButton, fullscreenButton);
    
    // 添加点击事件
    pipButton.addEventListener('click', async () => {
        try {
            if (document.pictureInPictureElement) {
                // 退出画中画模式
                await document.exitPictureInPicture();
            } else if (document.pictureInPictureEnabled && art.video) {
                // 进入画中画模式
                await art.video.requestPictureInPicture();
            }
        } catch (error) {
            console.error('画中画模式切换失败:', error);
        }
    });
    
    // 监听画中画状态变化，更新按钮样式
    art.video.addEventListener('enterpictureinpicture', () => {
        pipButton.classList.add('active');
    });
    
    art.video.addEventListener('leavepictureinpicture', () => {
        pipButton.classList.remove('active');
    });
}

// 清除视频进度记录
function clearVideoProgress() {
    const progressKey = `videoProgress_${getVideoId()}`;
    try {
        localStorage.removeItem(progressKey);
    } catch (e) {
    }
}

// 获取视频唯一标识
function getVideoId() {
    // 使用视频标题和集数索引作为唯一标识
    // If currentVideoUrl is available and more unique, prefer it. Otherwise, fallback.
    if (currentVideoUrl) {
        return `${encodeURIComponent(currentVideoUrl)}`;
    }
    return `${encodeURIComponent(currentVideoTitle)}_${currentEpisodeIndex}`;
}

let controlsLocked = false;
function toggleControlsLock() {
    const container = document.getElementById('playerContainer');
    controlsLocked = !controlsLocked;
    container.classList.toggle('controls-locked', controlsLocked);
    const icon = document.getElementById('lockIcon');
    // 切换图标：锁 / 解锁
    icon.innerHTML = controlsLocked
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d=\"M12 15v2m0-8V7a4 4 0 00-8 0v2m8 0H4v8h16v-8H6v-6z\"/>'
        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d=\"M15 11V7a3 3 0 00-6 0v4m-3 4h12v6H6v-6z\"/>';
}

// 支持在iframe中关闭播放器
function closeEmbeddedPlayer() {
    try {
        if (window.self !== window.top) {
            // 如果在iframe中，尝试调用父窗口的关闭方法
            if (window.parent && typeof window.parent.closeVideoPlayer === 'function') {
                window.parent.closeVideoPlayer();
                return true;
            }
        }
    } catch (e) {
        console.error('尝试关闭嵌入式播放器失败:', e);
    }
    return false;
}

function renderResourceInfoBar() {
    // 获取容器元素
    const container = document.getElementById('resourceInfoBarContainer');
    if (!container) {
        console.error('找不到资源信息卡片容器');
        return;
    }
    
    // 获取当前视频 source_code
    const urlParams = new URLSearchParams(window.location.search);
    const currentSource = urlParams.get('source') || '';
    
    // 显示临时加载状态
    container.innerHTML = `
      <div class="resource-info-bar-left flex">
        <span>加载中...</span>
        <span class="resource-info-bar-videos">-</span>
      </div>
      <button class="resource-switch-btn flex" id="switchResourceBtn" onclick="showSwitchResourceModal()">
        <span class="resource-switch-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4v16m0 0l-6-6m6 6l6-6" stroke="#a67c2d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        切换资源
      </button>
    `;

    // 查找当前源名称，从 API_SITES 和 custom_api 中查找即可
    let resourceName = currentSource
    if (currentSource && API_SITES[currentSource]) {
        resourceName = API_SITES[currentSource].name;
    }
    if (resourceName === currentSource) {
        const customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]');
        const customIndex = parseInt(currentSource.replace('custom_', ''), 10);
        if (customAPIs[customIndex]) {
            resourceName = customAPIs[customIndex].name || '自定义资源';
        }
    }

    container.innerHTML = `
      <div class="resource-info-bar-left flex">
        <span>${resourceName}</span>
        <span class="resource-info-bar-videos">${currentEpisodes.length} 个视频</span>
      </div>
      <button class="resource-switch-btn flex" id="switchResourceBtn" onclick="showSwitchResourceModal()">
        <span class="resource-switch-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4v16m0 0l-6-6m6 6l6-6" stroke="#a67c2d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        切换资源
      </button>
    `;
}

// 测试视频源速率的函数
async function testVideoSourceSpeed(sourceKey, vodId) {
    try {
        const startTime = performance.now();
        
        // 构建API参数
        let apiParams = '';
        if (sourceKey.startsWith('custom_')) {
            const customIndex = sourceKey.replace('custom_', '');
            const customApi = getCustomApiInfo(customIndex);
            if (!customApi) {
                return { speed: -1, error: 'API配置无效' };
            }
            if (customApi.detail) {
                apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&customDetail=' + encodeURIComponent(customApi.detail) + '&source=custom';
            } else {
                apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&source=custom';
            }
        } else {
            apiParams = '&source=' + sourceKey;
        }
        
        // 添加时间戳防止缓存
        const timestamp = new Date().getTime();
        const cacheBuster = `&_t=${timestamp}`;
        
        // 获取视频详情
        const response = await fetch(`/api/detail?id=${encodeURIComponent(vodId)}${apiParams}${cacheBuster}`, {
            method: 'GET',
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            return { speed: -1, error: '获取失败' };
        }
        
        const data = await response.json();
        
        if (!data.episodes || data.episodes.length === 0) {
            return { speed: -1, error: '无播放源' };
        }
        
        // 测试第一个播放链接的响应速度
        const firstEpisodeUrl = data.episodes[0];
        if (!firstEpisodeUrl) {
            return { speed: -1, error: '链接无效' };
        }
        
        // 测试视频链接响应时间
        const videoTestStart = performance.now();
        try {
            const videoResponse = await fetch(firstEpisodeUrl, {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-cache',
                signal: AbortSignal.timeout(5000) // 5秒超时
            });
            
            const videoTestEnd = performance.now();
            const totalTime = videoTestEnd - startTime;
            
            // 返回总响应时间（毫秒）
            return { 
                speed: Math.round(totalTime),
                episodes: data.episodes.length,
                error: null 
            };
        } catch (videoError) {
            // 如果视频链接测试失败，只返回API响应时间
            const apiTime = performance.now() - startTime;
            return { 
                speed: Math.round(apiTime),
                episodes: data.episodes.length,
                error: null,
                note: 'API响应' 
            };
        }
        
    } catch (error) {
        return { 
            speed: -1, 
            error: error.name === 'AbortError' ? '超时' : '测试失败' 
        };
    }
}

// 格式化速度显示
function formatSpeedDisplay(speedResult) {
    if (speedResult.speed === -1) {
        return `<span class="speed-indicator error">❌ ${speedResult.error}</span>`;
    }
    
    const speed = speedResult.speed;
    let className = 'speed-indicator good';
    let icon = '🟢';
    
    if (speed > 2000) {
        className = 'speed-indicator poor';
        icon = '🔴';
    } else if (speed > 1000) {
        className = 'speed-indicator medium';
        icon = '🟡';
    }
    
    const note = speedResult.note ? ` (${speedResult.note})` : '';
    return `<span class="${className}">${icon} ${speed}ms${note}</span>`;
}

async function showSwitchResourceModal() {
    const urlParams = new URLSearchParams(window.location.search);
    const currentSourceCode = urlParams.get('source');
    const currentVideoId = urlParams.get('id');

    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');

    modalTitle.innerHTML = `<span class="break-words">${currentVideoTitle}</span>`;
    modalContent.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa;grid-column:1/-1;">正在加载资源列表...</div>';
    modal.classList.remove('hidden');

    // 搜索
    const resourceOptions = selectedAPIs.map((curr) => {
        if (API_SITES[curr]) {
            return { key: curr, name: API_SITES[curr].name };
        }
        const customIndex = parseInt(curr.replace('custom_', ''), 10);
        if (customAPIs[customIndex]) {
            return { key: curr, name: customAPIs[customIndex].name || '自定义资源' };
        }
        return { key: curr, name: '未知资源' };
    });
    let allResults = {};
    await Promise.all(resourceOptions.map(async (opt) => {
        let queryResult = await searchByAPIAndKeyWord(opt.key, currentVideoTitle);
        if (queryResult.length == 0) {
            return 
        }
        // 优先取完全同名资源，否则默认取第一个
        let result = queryResult[0]
        queryResult.forEach((res) => {
            if (res.vod_name == currentVideoTitle) {
                result = res;
            }
        })
        allResults[opt.key] = result;
    }));

    // 更新状态显示：开始速率测试
    modalContent.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa;grid-column:1/-1;">正在测试各资源速率...</div>';

    // 同时测试所有资源的速率
    const speedResults = {};
    await Promise.all(Object.entries(allResults).map(async ([sourceKey, result]) => {
        if (result) {
            speedResults[sourceKey] = await testVideoSourceSpeed(sourceKey, result.vod_id);
        }
    }));

    // 对结果进行排序
    const sortedResults = Object.entries(allResults).sort(([keyA, resultA], [keyB, resultB]) => {
        // 当前播放的源放在最前面
        const isCurrentA = String(keyA) === String(currentSourceCode) && String(resultA.vod_id) === String(currentVideoId);
        const isCurrentB = String(keyB) === String(currentSourceCode) && String(resultB.vod_id) === String(currentVideoId);
        
        if (isCurrentA && !isCurrentB) return -1;
        if (!isCurrentA && isCurrentB) return 1;
        
        // 其余按照速度排序，速度快的在前面（速度为-1表示失败，排到最后）
        const speedA = speedResults[keyA]?.speed || 99999;
        const speedB = speedResults[keyB]?.speed || 99999;
        
        if (speedA === -1 && speedB !== -1) return 1;
        if (speedA !== -1 && speedB === -1) return -1;
        if (speedA === -1 && speedB === -1) return 0;
        
        return speedA - speedB;
    });

    // 渲染资源列表
    let html = '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">';
    
    for (const [sourceKey, result] of sortedResults) {
        if (!result) continue;
        
        // 修复 isCurrentSource 判断，确保类型一致
        const isCurrentSource = String(sourceKey) === String(currentSourceCode) && String(result.vod_id) === String(currentVideoId);
        const sourceName = resourceOptions.find(opt => opt.key === sourceKey)?.name || '未知资源';
        const speedResult = speedResults[sourceKey] || { speed: -1, error: '未测试' };
        
        html += `
            <div class="relative group ${isCurrentSource ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105 transition-transform'}" 
                 ${!isCurrentSource ? `onclick="switchToResource('${sourceKey}', '${result.vod_id}')"` : ''}>
                <div class="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 relative">
                    <img src="${result.vod_pic}" 
                         alt="${result.vod_name}"
                         class="w-full h-full object-cover"
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjY2IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiPjwvcmVjdD48cGF0aCBkPSJNMjEgMTV2NGEyIDIgMCAwIDEtMiAySDVhMiAyIDAgMCAxLTItMnYtNCI+PC9wYXRoPjxwb2x5bGluZSBwb2ludHM9IjE3IDggMTIgMyA3IDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTEyIDN2MTIiPjwvcGF0aD48L3N2Zz4='">
                    
                    <!-- 速率显示在图片右上角 -->
                    <div class="absolute top-1 right-1 speed-badge bg-black bg-opacity-75">
                        ${formatSpeedDisplay(speedResult)}
                    </div>
                </div>
                <div class="mt-2">
                    <div class="text-xs font-medium text-gray-200 truncate">${result.vod_name}</div>
                    <div class="text-[10px] text-gray-400 truncate">${sourceName}</div>
                    <div class="text-[10px] text-gray-500 mt-1">
                        ${speedResult.episodes ? `${speedResult.episodes}集` : ''}
                    </div>
                </div>
                ${isCurrentSource ? `
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div class="bg-blue-600 bg-opacity-75 rounded-lg px-2 py-0.5 text-xs text-white font-medium">
                            当前播放
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    html += '</div>';
    modalContent.innerHTML = html;
}

// 切换资源的函数
async function switchToResource(sourceKey, vodId) {
    // 关闭模态框
    document.getElementById('modal').classList.add('hidden');
    
    showLoading();
    try {
        // 构建API参数
        let apiParams = '';
        
        // 处理自定义API源
        if (sourceKey.startsWith('custom_')) {
            const customIndex = sourceKey.replace('custom_', '');
            const customApi = getCustomApiInfo(customIndex);
            if (!customApi) {
                showToast('自定义API配置无效', 'error');
                hideLoading();
                return;
            }
            // 传递 detail 字段
            if (customApi.detail) {
                apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&customDetail=' + encodeURIComponent(customApi.detail) + '&source=custom';
            } else {
                apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&source=custom';
            }
        } else {
            // 内置API
            apiParams = '&source=' + sourceKey;
        }
        
        // Add a timestamp to prevent caching
        const timestamp = new Date().getTime();
        const cacheBuster = `&_t=${timestamp}`;
        const response = await fetch(`/api/detail?id=${encodeURIComponent(vodId)}${apiParams}${cacheBuster}`);
        
        const data = await response.json();
        
        if (!data.episodes || data.episodes.length === 0) {
            showToast('未找到播放资源', 'error');
            hideLoading();
            return;
        }

        // 获取当前播放的集数索引
        const currentIndex = currentEpisodeIndex;
        
        // 确定要播放的集数索引
        let targetIndex = 0;
        if (currentIndex < data.episodes.length) {
            // 如果当前集数在新资源中存在，则使用相同集数
            targetIndex = currentIndex;
        }
        
        // 获取目标集数的URL
        const targetUrl = data.episodes[targetIndex];
        
        // 构建播放页面URL
        const watchUrl = `player.html?id=${vodId}&source=${sourceKey}&url=${encodeURIComponent(targetUrl)}&index=${targetIndex}&title=${encodeURIComponent(currentVideoTitle)}`;
        
        // 保存当前状态到localStorage
        try {
            localStorage.setItem('currentVideoTitle', data.vod_name || '未知视频');
            localStorage.setItem('currentEpisodes', JSON.stringify(data.episodes));
            localStorage.setItem('currentEpisodeIndex', targetIndex);
            localStorage.setItem('currentSourceCode', sourceKey);
            localStorage.setItem('lastPlayTime', Date.now());
        } catch (e) {
            console.error('保存播放状态失败:', e);
        }

        // 跳转到播放页面
        window.location.href = watchUrl;
        
    } catch (error) {
        console.error('切换资源失败:', error);
        showToast('切换资源失败，请稍后重试', 'error');
    } finally {
        hideLoading();
    }
}

// 初始化播放器设置
function initPlayerSettings() {
    // 从localStorage加载设置
    const savedSettings = localStorage.getItem('playerSettings');
    if (savedSettings) {
        try {
            playerSettings = { ...playerSettings, ...JSON.parse(savedSettings) };
        } catch (e) {
            console.error('解析播放器设置失败:', e);
        }
    }
    
    // 更新UI控件状态
    updateSettingsUI();
    
    // 监听视频播放进度，实现自动跳过功能
    if (window.player) {
        // 尝试多种可能的事件监听方式，兼容不同版本的播放器
        try {
            // 方法1：使用标准DOM事件监听
            if (window.player.video) {
                window.player.video.addEventListener('timeupdate', handleTimeUpdate);
            } 
            // 方法2：尝试ArtPlayer的事件监听
            else if (typeof art !== 'undefined' && art.on) {
                art.on('timeupdate', handleTimeUpdate);
            }
            // 方法3：尝试直接添加到video元素
            else {
                const videoElement = document.querySelector('#player video');
                if (videoElement) {
                    videoElement.addEventListener('timeupdate', handleTimeUpdate);
                }
            }
        } catch (e) {
            console.error('添加进度监听失败:', e);
        }
    }
}

// 更新设置UI
function updateSettingsUI() {
    const skipIntroToggle = document.getElementById('skipIntroToggle');
    const skipOutroToggle = document.getElementById('skipOutroToggle');
    const introStartInput = document.getElementById('introStartInput');
    const introEndInput = document.getElementById('introEndInput');
    
    if (skipIntroToggle) skipIntroToggle.checked = playerSettings.skipIntro;
    if (skipOutroToggle) skipOutroToggle.checked = playerSettings.skipOutro;
    if (introStartInput) introStartInput.value = playerSettings.introStart;
    if (introEndInput) introEndInput.value = playerSettings.introEnd;
}

// 切换设置面板显示/隐藏
function toggleSettingsPanel() {
    // 首先检查播放器控制是否正常工作
    let playerControlsNormal = false;
    
    // 方法1：检查ArtPlayer实例是否正常初始化
    if (typeof art !== 'undefined' && art && art.constructor && art.constructor.name === 'Artplayer') {
        playerControlsNormal = true;
    }
    
    // 方法2：检查播放器控件是否存在
    if (!playerControlsNormal) {
        const controlsSelector = '.artplayer-controls';
        const controls = document.querySelector(controlsSelector);
        if (controls && controls.children.length > 0) {
            playerControlsNormal = true;
        }
    }
    
    // 方法3：尝试多种可能的设置面板选择器
    if (!playerControlsNormal) {
        const settingSelectors = ['.artplayer-setting', '.artplayer-setting-panel'];
        for (const selector of settingSelectors) {
            const panel = document.querySelector(selector);
            if (panel) {
                playerControlsNormal = true;
                break;
            }
        }
    }
    
    // 如果播放器控制正常，只处理标准设置面板
    if (playerControlsNormal) {
        const settingsPanel = document.getElementById('settingsPanel');
        if (settingsPanel) {
            settingsPanel.classList.toggle('hidden');
        }
        // 确保临时区域不可见
        const tempSettings = document.querySelector('.temp-settings');
        if (tempSettings) {
            tempSettings.style.display = 'none';
        }
    } else {
        // 播放器控制不正常时，处理临时设置区域
        const tempSettings = document.querySelector('.temp-settings');
        if (tempSettings) {
            tempSettings.style.display = tempSettings.style.display === 'none' ? 'block' : 'none';
        }
    }
}

// 保存设置
function saveSettings() {
    const skipIntroToggle = document.getElementById('skipIntroToggle');
    const skipOutroToggle = document.getElementById('skipOutroToggle');
    const introStartInput = document.getElementById('introStartInput');
    const introEndInput = document.getElementById('introEndInput');
    
    if (skipIntroToggle && skipOutroToggle && introStartInput && introEndInput) {
        playerSettings.skipIntro = skipIntroToggle.checked;
        playerSettings.skipOutro = skipOutroToggle.checked;
        playerSettings.introStart = parseInt(introStartInput.value) || 0;
        playerSettings.introEnd = parseInt(introEndInput.value) || 90;
        
        // 验证设置的有效性
        if (playerSettings.introStart < 0) playerSettings.introStart = 0;
        if (playerSettings.introEnd <= playerSettings.introStart) playerSettings.introEnd = playerSettings.introStart + 90;
        if (playerSettings.introEnd > 600) playerSettings.introEnd = 600;
        
        // 更新现有的跳过功能变量以保持兼容性
        if (typeof skipIntroEnabled !== 'undefined') skipIntroEnabled = playerSettings.skipIntro;
        if (typeof skipOutroEnabled !== 'undefined') skipOutroEnabled = playerSettings.skipOutro;
        if (typeof introStart !== 'undefined') introStart = playerSettings.introStart;
        if (typeof introEnd !== 'undefined') introEnd = playerSettings.introEnd;
        
        // 保存到localStorage
        try {
            localStorage.setItem('playerSettings', JSON.stringify(playerSettings));
            localStorage.setItem('skipIntroEnabled', playerSettings.skipIntro.toString());
            localStorage.setItem('skipOutroEnabled', playerSettings.skipOutro.toString());
            showToast('设置已保存', 'success');
        } catch (e) {
            console.error('保存设置失败:', e);
            showToast('保存设置失败', 'error');
        }
        
        // 关闭设置面板
        toggleSettingsPanel();
    }
}

// 处理视频播放进度更新
function handleTimeUpdate() {
    if (!playerSettings.skipIntro) return;
    
    // 获取视频元素的兼容方式
    let videoElement = null;
    
    // 方法1：尝试从window.player获取
    if (window.player) {
        if (window.player.video) {
            videoElement = window.player.video;
        } else if (typeof window.player.currentTime === 'number') {
            videoElement = window.player;
        }
    }
    
    // 方法2：尝试直接获取video元素
    if (!videoElement) {
        videoElement = document.querySelector('#player video') || document.querySelector('video');
    }
    
    // 如果仍然找不到视频元素，退出函数
    if (!videoElement || typeof videoElement.currentTime !== 'number') {
        return;
    }
    
    const currentTime = videoElement.currentTime;
    const duration = videoElement.duration;
    
    // 跳过片头
    if (playerSettings.skipIntro && 
        currentTime >= playerSettings.introStart && 
        currentTime < playerSettings.introEnd &&
        Math.abs(currentTime - playerSettings.introStart) < 2) { // 确保是刚开始播放片头
        try {
            videoElement.currentTime = playerSettings.introEnd;
            showToast('已自动跳过片头', 'info');
        } catch (e) {
            console.error('跳过片头失败:', e);
        }
    }
    
    // 跳过片尾（假设片尾是视频最后2分钟）
    if (playerSettings.skipOutro && duration && currentTime >= (duration - 120)) {
        // 查找下一集并播放
        const currentIndex = parseInt(localStorage.getItem('currentEpisodeIndex') || '0');
        const episodes = JSON.parse(localStorage.getItem('currentEpisodes') || '[]');
        
        if (currentIndex < episodes.length - 1) {
            const nextIndex = currentIndex + 1;
            const nextUrl = episodes[nextIndex];
            const vodId = new URLSearchParams(window.location.search).get('id');
            const sourceKey = localStorage.getItem('currentSourceCode');
            const title = localStorage.getItem('currentVideoTitle');
            
            // 构建下一集播放URL
            const nextEpisodeUrl = `player.html?id=${vodId}&source=${sourceKey}&url=${encodeURIComponent(nextUrl)}&index=${nextIndex}&title=${encodeURIComponent(title)}`;
            window.location.href = nextEpisodeUrl;
        }
    }
}
