// ============= 应用全局状态 =============

// API配置
let selectedAPIs = JSON.parse(localStorage.getItem('selectedAPIs') || '["tyyszy","dyttzy", "bfzy", "ruyi"]'); // 默认选中资源
let customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]'); // 存储自定义API列表

// 视频播放状态
let currentEpisodeIndex = 0;
let currentEpisodes = [];
let currentVideoTitle = '';
let episodesReversed = false;

// 性能优化：DOM选择器缓存
const elementCache = {};
const getElement = (selector) => {
    if (!elementCache[selector]) {
        elementCache[selector] = document.querySelector(selector);
    }
    return elementCache[selector];
};

// 性能优化：防抖函数
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// 页面初始化
document.addEventListener('DOMContentLoaded', function () {
    // 初始化API复选框
    initAPICheckboxes();

    // 初始化自定义API列表
    renderCustomAPIsList();

    // 初始化显示选中的API数量
    updateSelectedApiCount();

    // 渲染搜索历史
    renderSearchHistory();

    // 设置默认API选择（如果是第一次加载）
    if (!localStorage.getItem('hasInitializedDefaults')) {
        // 默认选中资源
        selectedAPIs = ["tyyszy", "bfzy", "dyttzy", "ruyi"];
        localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

        // 默认选中过滤开关
        localStorage.setItem('yellowFilterEnabled', 'true');
        localStorage.setItem(PLAYER_CONFIG.adFilteringStorage, 'true');

        // 默认启用豆瓣功能
        localStorage.setItem('doubanEnabled', 'true');

        // 标记已初始化默认值
        localStorage.setItem('hasInitializedDefaults', 'true');
    }

    // 设置黄色内容过滤器开关初始状态
    const yellowFilterToggle = document.getElementById('yellowFilterToggle');
    if (yellowFilterToggle) {
        // 为了向后兼容，先检查旧的键名，如果不存在再使用默认值true
        const oldValue = localStorage.getItem('yellowFilterEnabled');
        const newValue = localStorage.getItem('yellowContentFilterEnabled');
        // 默认启用过滤
        const isEnabled = oldValue === null ? (newValue === null ? true : newValue === 'true') : oldValue === 'true';
        yellowFilterToggle.checked = isEnabled;
        // 统一使用新的键名存储状态
        localStorage.setItem('yellowContentFilterEnabled', isEnabled ? 'true' : 'false');
        // 移除旧的键名以保持清洁
        localStorage.removeItem('yellowFilterEnabled');
    }

    // 设置广告过滤开关初始状态
    const adFilterToggle = document.getElementById('adFilterToggle');
    if (adFilterToggle) {
        adFilterToggle.checked = localStorage.getItem(PLAYER_CONFIG.adFilteringStorage) !== 'false'; // 默认为true
    }

    // 设置事件监听器
    setupEventListeners();

    // 初始检查成人API选中状态
    setTimeout(checkAdultAPIsSelected, 100);
    
    // 初始化搜索建议功能
    setupSearchSuggestionListeners();
});

// 初始化API复选框
function initAPICheckboxes() {
    const container = document.getElementById('apiCheckboxes');
    container.innerHTML = '';

    // 添加普通API组标题
    const normaldiv = document.createElement('div');
    normaldiv.id = 'normaldiv';
    normaldiv.className = 'grid grid-cols-2 gap-2';
    const normalTitle = document.createElement('div');
    normalTitle.className = 'api-group-title';
    normalTitle.textContent = '普通资源';
    normaldiv.appendChild(normalTitle);

    // 创建普通API源的复选框
    Object.keys(API_SITES).forEach(apiKey => {
        const api = API_SITES[apiKey];
        if (api.adult) return; // 跳过成人内容API，稍后添加

        const checked = selectedAPIs.includes(apiKey);

        const checkbox = document.createElement('div');
        checkbox.className = 'flex items-center';
        checkbox.innerHTML = `
            <input type="checkbox" id="api_${apiKey}" 
                   class="form-checkbox h-3 w-3 text-blue-600 bg-[#222] border border-[#333]" 
                   ${checked ? 'checked' : ''} 
                   data-api="${apiKey}">
            <label for="api_${apiKey}" class="ml-1 text-xs text-gray-400 truncate">${api.name}</label>
        `;
        normaldiv.appendChild(checkbox);

        // 添加事件监听器
        checkbox.querySelector('input').addEventListener('change', function () {
            updateSelectedAPIs();
            checkAdultAPIsSelected();
        });
    });
    container.appendChild(normaldiv);

    // 添加成人API列表
    addAdultAPI();

    // 初始检查成人内容状态
    checkAdultAPIsSelected();
}

// 添加成人API列表
function addAdultAPI() {
    // 仅在隐藏设置为false时添加成人API组
    if (!HIDE_BUILTIN_ADULT_APIS && (localStorage.getItem('yellowFilterEnabled') === 'false')) {
        const container = document.getElementById('apiCheckboxes');

        // 添加成人API组标题
        const adultdiv = document.createElement('div');
        adultdiv.id = 'adultdiv';
        adultdiv.className = 'grid grid-cols-2 gap-2';
        const adultTitle = document.createElement('div');
        adultTitle.className = 'api-group-title adult';
        adultTitle.innerHTML = `黄色资源采集站 <span class="adult-warning">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        </span>`;
        adultdiv.appendChild(adultTitle);

        // 创建成人API源的复选框
        Object.keys(API_SITES).forEach(apiKey => {
            const api = API_SITES[apiKey];
            if (!api.adult) return; // 仅添加成人内容API

            const checked = selectedAPIs.includes(apiKey);

            const checkbox = document.createElement('div');
            checkbox.className = 'flex items-center';
            checkbox.innerHTML = `
                <input type="checkbox" id="api_${apiKey}" 
                       class="form-checkbox h-3 w-3 text-blue-600 bg-[#222] border border-[#333] api-adult" 
                       ${checked ? 'checked' : ''} 
                       data-api="${apiKey}">
                <label for="api_${apiKey}" class="ml-1 text-xs text-pink-400 truncate">${api.name}</label>
            `;
            adultdiv.appendChild(checkbox);

            // 添加事件监听器
            checkbox.querySelector('input').addEventListener('change', function () {
                updateSelectedAPIs();
                checkAdultAPIsSelected();
            });
        });
        container.appendChild(adultdiv);
    }
}

// 检查是否有成人API被选中，并在过滤启用时自动取消选中成人API
function checkAdultAPIsSelected() {
    // 使用新的localStorage键名
    const isFilterEnabled = localStorage.getItem('yellowContentFilterEnabled') === 'true';
    
    // 查找所有内置成人API复选框
    const adultBuiltinCheckboxes = document.querySelectorAll('#apiCheckboxes .api-adult');
    const checkedAdultBuiltinCheckboxes = document.querySelectorAll('#apiCheckboxes .api-adult:checked');
    
    // 查找所有自定义成人API复选框
    const customApiCheckboxes = document.querySelectorAll('#customApisList .api-adult');
    const checkedCustomApiCheckboxes = document.querySelectorAll('#customApisList .api-adult:checked');
    
    const hasAdultSelected = checkedAdultBuiltinCheckboxes.length > 0 || checkedCustomApiCheckboxes.length > 0;
    
    const yellowFilterToggle = document.getElementById('yellowFilterToggle');
    const yellowFilterContainer = yellowFilterToggle.closest('div').parentNode;
    const filterDescription = yellowFilterContainer.querySelector('p.filter-description');
    
    // 如果黄色内容过滤启用，自动取消选中并禁用所有成人API
    if (isFilterEnabled) {
        // 取消选中所有成人API
        [...adultBuiltinCheckboxes, ...customApiCheckboxes].forEach(checkbox => {
            if (checkbox.checked) {
                checkbox.checked = false;
                // 为禁用的复选框添加视觉提示
                const label = checkbox.closest('label');
                if (label) {
                    label.classList.add('opacity-50', 'cursor-not-allowed');
                }
            }
            checkbox.disabled = true;
        });
        
        // 如果有取消选中的操作，更新选中的API列表
        if (hasAdultSelected && typeof updateSelectedAPIs === 'function') {
            updateSelectedAPIs();
        }
    } else {
        // 如果过滤禁用，启用所有成人API复选框并移除禁用样式
        [...adultBuiltinCheckboxes, ...customApiCheckboxes].forEach(checkbox => {
            checkbox.disabled = false;
            const label = checkbox.closest('label');
            if (label) {
                label.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });
    }
    
    // 如果选择了成人API，禁用黄色内容过滤器
    if (hasAdultSelected && !isFilterEnabled) {
        yellowFilterToggle.checked = false;
        yellowFilterToggle.disabled = true;
        localStorage.setItem('yellowContentFilterEnabled', 'false');

        // 添加禁用样式
        yellowFilterContainer.classList.add('filter-disabled');

        // 修改描述文字
        if (filterDescription) {
            filterDescription.innerHTML = '<strong class="text-pink-300">选中黄色资源站时无法启用此过滤</strong>';
        }

        // 移除提示信息（如果存在）
        const existingTooltip = yellowFilterContainer.querySelector('.filter-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
    } else {
        // 启用黄色内容过滤器
        yellowFilterToggle.disabled = false;
        // 确保使用新的localStorage键名
        const currentState = localStorage.getItem('yellowContentFilterEnabled');
        // 如果没有设置过状态，默认启用过滤
        if (currentState === null) {
            localStorage.setItem('yellowContentFilterEnabled', 'true');
            yellowFilterToggle.checked = true;
        } else {
            yellowFilterToggle.checked = currentState === 'true';
        }
        yellowFilterContainer.classList.remove('filter-disabled');

        // 恢复原来的描述文字
        if (filterDescription) {
            filterDescription.innerHTML = '过滤"伦理片"等黄色内容';
        }

        // 移除提示信息
        const existingTooltip = yellowFilterContainer.querySelector('.filter-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
    }
}

// 渲染自定义API列表
function renderCustomAPIsList() {
    const container = document.getElementById('customApisList');
    if (!container) return;

    if (customAPIs.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-500 text-center my-2">未添加自定义API</p>';
        return;
    }

    container.innerHTML = '';
    customAPIs.forEach((api, index) => {
        const apiItem = document.createElement('div');
        apiItem.className = 'flex items-center justify-between p-1 mb-1 bg-[#222] rounded';
        const textColorClass = api.isAdult ? 'text-pink-400' : 'text-white';
        const adultTag = api.isAdult ? '<span class="text-xs text-pink-400 mr-1">(18+)</span>' : '';
        // 新增 detail 地址显示
        const detailLine = api.detail ? `<div class="text-xs text-gray-400 truncate">detail: ${api.detail}</div>` : '';
        apiItem.innerHTML = `
            <div class="flex items-center flex-1 min-w-0">
                <input type="checkbox" id="custom_api_${index}" 
                       class="form-checkbox h-3 w-3 text-blue-600 mr-1 ${api.isAdult ? 'api-adult' : ''}" 
                       ${selectedAPIs.includes('custom_' + index) ? 'checked' : ''} 
                       data-custom-index="${index}">
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-medium ${textColorClass} truncate">
                        ${adultTag}${api.name}
                    </div>
                    <div class="text-xs text-gray-500 truncate">${api.url}</div>
                    ${detailLine}
                </div>
            </div>
            <div class="flex items-center">
                <button class="text-blue-500 hover:text-blue-700 text-xs px-1" onclick="editCustomApi(${index})">✎</button>
                <button class="text-red-500 hover:text-red-700 text-xs px-1" onclick="removeCustomApi(${index})">✕</button>
            </div>
        `;
        container.appendChild(apiItem);
        apiItem.querySelector('input').addEventListener('change', function () {
            updateSelectedAPIs();
            checkAdultAPIsSelected();
        });
    });
}

// 编辑自定义API
function editCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return;
    const api = customAPIs[index];
    document.getElementById('customApiName').value = api.name;
    document.getElementById('customApiUrl').value = api.url;
    document.getElementById('customApiDetail').value = api.detail || '';
    const isAdultInput = document.getElementById('customApiIsAdult');
    if (isAdultInput) isAdultInput.checked = api.isAdult || false;
    const form = document.getElementById('addCustomApiForm');
    if (form) {
        form.classList.remove('hidden');
        const buttonContainer = form.querySelector('div:last-child');
        buttonContainer.innerHTML = `
            <button onclick="updateCustomApi(${index})" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">更新</button>
            <button onclick="cancelEditCustomApi()" class="bg-[#444] hover:bg-[#555] text-white px-3 py-1 rounded text-xs">取消</button>
        `;
    }
}

// 更新自定义API
function updateCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return;
    const nameInput = document.getElementById('customApiName');
    const urlInput = document.getElementById('customApiUrl');
    const detailInput = document.getElementById('customApiDetail');
    const isAdultInput = document.getElementById('customApiIsAdult');
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    const detail = detailInput ? detailInput.value.trim() : '';
    const isAdult = isAdultInput ? isAdultInput.checked : false;
    if (!name || !url) {
        showToast('请输入API名称和链接', 'warning');
        return;
    }
    if (!/^https?:\/\/.+/.test(url)) {
        showToast('API链接格式不正确，需以http://或https://开头', 'warning');
        return;
    }
    if (url.endsWith('/')) url = url.slice(0, -1);
    // 保存 detail 字段
    customAPIs[index] = { name, url, detail, isAdult };
    localStorage.setItem('customAPIs', JSON.stringify(customAPIs));
    renderCustomAPIsList();
    checkAdultAPIsSelected();
    restoreAddCustomApiButtons();
    nameInput.value = '';
    urlInput.value = '';
    if (detailInput) detailInput.value = '';
    if (isAdultInput) isAdultInput.checked = false;
    document.getElementById('addCustomApiForm').classList.add('hidden');
    showToast('已更新自定义API: ' + name, 'success');
}

// 取消编辑自定义API
function cancelEditCustomApi() {
    // 清空表单
    document.getElementById('customApiName').value = '';
    document.getElementById('customApiUrl').value = '';
    document.getElementById('customApiDetail').value = '';
    const isAdultInput = document.getElementById('customApiIsAdult');
    if (isAdultInput) isAdultInput.checked = false;

    // 隐藏表单
    document.getElementById('addCustomApiForm').classList.add('hidden');

    // 恢复添加按钮
    restoreAddCustomApiButtons();
}

// 恢复自定义API添加按钮
function restoreAddCustomApiButtons() {
    const form = document.getElementById('addCustomApiForm');
    const buttonContainer = form.querySelector('div:last-child');
    buttonContainer.innerHTML = `
        <button onclick="addCustomApi()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">添加</button>
        <button onclick="cancelAddCustomApi()" class="bg-[#444] hover:bg-[#555] text-white px-3 py-1 rounded text-xs">取消</button>
    `;
}

// 更新选中的API列表
function updateSelectedAPIs() {
    // 获取所有内置API复选框
    const builtInApiCheckboxes = document.querySelectorAll('#apiCheckboxes input:checked');

    // 获取选中的内置API
    const builtInApis = Array.from(builtInApiCheckboxes).map(input => input.dataset.api);

    // 获取选中的自定义API
    const customApiCheckboxes = document.querySelectorAll('#customApisList input:checked');
    const customApiIndices = Array.from(customApiCheckboxes).map(input => 'custom_' + input.dataset.customIndex);

    // 合并内置和自定义API
    selectedAPIs = [...builtInApis, ...customApiIndices];

    // 保存到localStorage
    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

    // 更新显示选中的API数量
    updateSelectedApiCount();
}

// 更新选中的API数量显示
function updateSelectedApiCount() {
    const countEl = document.getElementById('selectedApiCount');
    if (countEl) {
        countEl.textContent = selectedAPIs.length;
    }
}

// 全选或取消全选API
function selectAllAPIs(selectAll = true, excludeAdult = false) {
    const checkboxes = document.querySelectorAll('#apiCheckboxes input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        if (excludeAdult && checkbox.classList.contains('api-adult')) {
            checkbox.checked = false;
        } else {
            checkbox.checked = selectAll;
        }
    });

    updateSelectedAPIs();
    checkAdultAPIsSelected();
}

// 显示添加自定义API表单
function showAddCustomApiForm() {
    const form = document.getElementById('addCustomApiForm');
    if (form) {
        form.classList.remove('hidden');
    }
}

// 取消添加自定义API - 修改函数来重用恢复按钮逻辑
function cancelAddCustomApi() {
    const form = document.getElementById('addCustomApiForm');
    if (form) {
        form.classList.add('hidden');
        document.getElementById('customApiName').value = '';
        document.getElementById('customApiUrl').value = '';
        document.getElementById('customApiDetail').value = '';
        const isAdultInput = document.getElementById('customApiIsAdult');
        if (isAdultInput) isAdultInput.checked = false;

        // 确保按钮是添加按钮
        restoreAddCustomApiButtons();
    }
}

// 添加自定义API
function addCustomApi() {
    const nameInput = document.getElementById('customApiName');
    const urlInput = document.getElementById('customApiUrl');
    const detailInput = document.getElementById('customApiDetail');
    const isAdultInput = document.getElementById('customApiIsAdult');
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    const detail = detailInput ? detailInput.value.trim() : '';
    const isAdult = isAdultInput ? isAdultInput.checked : false;
    if (!name || !url) {
        showToast('请输入API名称和链接', 'warning');
        return;
    }
    if (!/^https?:\/\/.+/.test(url)) {
        showToast('API链接格式不正确，需以http://或https://开头', 'warning');
        return;
    }
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    // 保存 detail 字段
    customAPIs.push({ name, url, detail, isAdult });
    localStorage.setItem('customAPIs', JSON.stringify(customAPIs));
    const newApiIndex = customAPIs.length - 1;
    selectedAPIs.push('custom_' + newApiIndex);
    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

    // 重新渲染自定义API列表
    renderCustomAPIsList();
    updateSelectedApiCount();
    checkAdultAPIsSelected();
    nameInput.value = '';
    urlInput.value = '';
    if (detailInput) detailInput.value = '';
    if (isAdultInput) isAdultInput.checked = false;
    document.getElementById('addCustomApiForm').classList.add('hidden');
    showToast('已添加自定义API: ' + name, 'success');
}

// 移除自定义API
function removeCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return;

    const apiName = customAPIs[index].name;

    // 从列表中移除API
    customAPIs.splice(index, 1);
    localStorage.setItem('customAPIs', JSON.stringify(customAPIs));

    // 从选中列表中移除此API
    const customApiId = 'custom_' + index;
    selectedAPIs = selectedAPIs.filter(id => id !== customApiId);

    // 更新大于此索引的自定义API索引
    selectedAPIs = selectedAPIs.map(id => {
        if (id.startsWith('custom_')) {
            const currentIndex = parseInt(id.replace('custom_', ''));
            if (currentIndex > index) {
                return 'custom_' + (currentIndex - 1);
            }
        }
        return id;
    });

    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

    // 重新渲染自定义API列表
    renderCustomAPIsList();

    // 更新选中的API数量
    updateSelectedApiCount();

    // 重新检查成人API选中状态
    checkAdultAPIsSelected();

    showToast('已移除自定义API: ' + apiName, 'info');
}

function toggleSettings(e) {
    const settingsPanel = document.getElementById('settingsPanel');
    if (!settingsPanel) return;

    if (settingsPanel.classList.contains('show')) {
        settingsPanel.classList.remove('show');
    } else {
        settingsPanel.classList.add('show');
    }

    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 回车搜索
    document.getElementById('searchInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            search();
        }
    });

    // 点击外部关闭设置面板和历史记录面板
    document.addEventListener('click', function (e) {
        // 关闭设置面板
        const settingsPanel = document.querySelector('#settingsPanel.show');
        const settingsButton = document.querySelector('#settingsPanel .close-btn');

        if (settingsPanel && settingsButton &&
            !settingsPanel.contains(e.target) &&
            !settingsButton.contains(e.target)) {
            settingsPanel.classList.remove('show');
        }

        // 关闭历史记录面板
        const historyPanel = document.querySelector('#historyPanel.show');
        const historyButton = document.querySelector('#historyPanel .close-btn');

        if (historyPanel && historyButton &&
            !historyPanel.contains(e.target) &&
            !historyButton.contains(e.target)) {
            historyPanel.classList.remove('show');
        }
    });

    // 黄色内容过滤开关事件绑定
    const yellowFilterToggle = document.getElementById('yellowFilterToggle');
    if (yellowFilterToggle) {
        yellowFilterToggle.addEventListener('change', function (e) {
            // 使用新的键名存储状态
            localStorage.setItem('yellowContentFilterEnabled', e.target.checked ? 'true' : 'false');
            // 显示提示信息
            showToast(e.target.checked ? '已开启黄色内容过滤' : '已关闭黄色内容过滤', 'info');
            
            // 当过滤状态改变时，调用检查函数来同步API选中状态
            checkAdultAPIsSelected();

            // 控制黄色内容接口的显示状态
            const adultdiv = document.getElementById('adultdiv');
            if (adultdiv) {
                if (e.target.checked === true) {
                    adultdiv.style.display = '';
                } else if (e.target.checked === false) {
                    adultdiv.style.display = 'none'
                }
            } else {
                // 添加成人API列表
                addAdultAPI();
            }
        });
    }

    // 广告过滤开关事件绑定
    const adFilterToggle = document.getElementById('adFilterToggle');
    if (adFilterToggle) {
        adFilterToggle.addEventListener('change', function (e) {
            localStorage.setItem(PLAYER_CONFIG.adFilteringStorage, e.target.checked);
        });
    }
}

// 重置搜索区域
function resetSearchArea() {
    // 清理搜索结果
    document.getElementById('results').innerHTML = '';
    document.getElementById('searchInput').value = '';

    // 恢复搜索区域的样式
    document.getElementById('searchArea').classList.add('flex-1');
    document.getElementById('searchArea').classList.remove('mb-8');
    document.getElementById('resultsArea').classList.add('hidden');

    // 确保页脚正确显示，移除相对定位
    const footer = document.querySelector('.footer');
    if (footer) {
        footer.style.position = '';
    }

    // 如果有豆瓣功能，检查是否需要显示豆瓣推荐区域
    if (typeof updateDoubanVisibility === 'function') {
        updateDoubanVisibility();
    }

    // 重置URL为主页
    try {
        window.history.pushState(
            {},
            `LibreTV - 免费在线视频搜索与观看平台`,
            `/`
        );
        // 更新页面标题
        document.title = `LibreTV - 免费在线视频搜索与观看平台`;
    } catch (e) {
        console.error('更新浏览器历史失败:', e);
    }
}

// 获取自定义API信息
function getCustomApiInfo(customApiIndex) {
    const index = parseInt(customApiIndex);
    if (isNaN(index) || index < 0 || index >= customAPIs.length) {
        return null;
    }
    return customAPIs[index];
}

// 搜索功能 - 修改为支持多选API和多页结果
// 获取筛选条件
function getFilterConditions() {
    return {
        area: document.getElementById('filterArea')?.value || '',
        year: document.getElementById('filterYear')?.value || '',
        type: document.getElementById('filterType')?.value || ''
    };
}

// 保存筛选条件到localStorage
function saveFilterConditions(filters) {
    localStorage.setItem('searchFilters', JSON.stringify(filters));
}

// 从localStorage加载筛选条件
function loadFilterConditions() {
    try {
        const saved = localStorage.getItem('searchFilters');
        return saved ? JSON.parse(saved) : {};
    } catch (e) {
        console.error('加载筛选条件失败:', e);
        return {};
    }
}

// 应用筛选条件到UI
function applyFilterConditions(filters) {
    if (document.getElementById('filterArea')) {
        document.getElementById('filterArea').value = filters.area || '';
    }
    if (document.getElementById('filterYear')) {
        document.getElementById('filterYear').value = filters.year || '';
    }
    if (document.getElementById('filterType')) {
        document.getElementById('filterType').value = filters.type || '';
    }
}

async function search() {
    // 强化的密码保护校验 - 防止绕过
    try {
        if (window.ensurePasswordProtection) {
            window.ensurePasswordProtection();
        } else {
            // 兼容性检查
            if (window.isPasswordProtected && window.isPasswordVerified) {
                if (window.isPasswordProtected() && !window.isPasswordVerified()) {
                    showPasswordModal && showPasswordModal();
                    return;
                }
            }
        }
    } catch (error) {
        console.warn('Password protection check failed:', error.message);
        return;
    }
    const query = document.getElementById('searchInput').value.trim();
    const filters = getFilterConditions();
    saveFilterConditions(filters);

    if (!query) {
        showToast('请输入搜索内容', 'info');
        return;
    }

    if (selectedAPIs.length === 0) {
        showToast('请至少选择一个API源', 'warning');
        return;
    }

    showLoading();

    try {
        // 保存搜索历史
        saveSearchHistory(query);

        // 从所有选中的API源搜索
        let allResults = [];
        const searchPromises = selectedAPIs.map(apiId => 
            searchByAPIAndKeyWord(apiId, query, filters)
        );

        // 等待所有搜索请求完成
    const resultsArray = await Promise.all(searchPromises);

    // 合并所有结果
    resultsArray.forEach(results => {
        if (Array.isArray(results) && results.length > 0) {
            allResults = allResults.concat(results);
        }
    });

    // 计算关键词匹配度评分
    function calculateKeywordMatchScore(item, keyword) {
        const title = (item.vod_name || '').toLowerCase();
        const keywordLower = keyword.toLowerCase();
        
        // 完全匹配给最高分
        if (title === keywordLower) return 100;
        
        // 开头匹配给高分
        if (title.startsWith(keywordLower)) return 90;
        
        // 包含关键词
        if (title.includes(keywordLower)) {
            // 根据关键词在标题中的位置给予不同分数
            const index = title.indexOf(keywordLower);
            return Math.max(50, 80 - Math.floor(index / 5));
        }
        
        // 类型匹配
        if ((item.type_name || '').toLowerCase().includes(keywordLower)) return 30;
        
        return 0;
    }
    
    // 获取视频源可靠性评分（基于用户历史数据）
    function getSourceReliabilityScore(sourceCode, apiUrl) {
        try {
            const history = JSON.parse(localStorage.getItem('videoHistory') || '[]');
            const sourceVideos = history.filter(item => 
                item.source_code === sourceCode && (!apiUrl || item.api_url === apiUrl)
            );
            
            if (sourceVideos.length === 0) return 50; // 无历史记录给中等分数
            
            // 计算平均播放完成率
            const completedCount = sourceVideos.filter(v => v.play_percentage > 80).length;
            const reliabilityScore = (completedCount / sourceVideos.length) * 100;
            
            return Math.min(100, Math.max(0, reliabilityScore));
        } catch (e) {
            console.error('获取源可靠性评分失败:', e);
            return 50;
        }
    }
    
    // 获取用户观看历史权重
    function getUserHistoryWeight(item) {
        try {
            const history = JSON.parse(localStorage.getItem('videoHistory') || '[]');
            const viewedItem = history.find(h => h.vod_id === item.vod_id && h.source_code === item.source_code);
            
            if (!viewedItem) return 0;
            
            // 最近观看的给予更高权重
            const daysSinceViewed = Math.floor((Date.now() - viewedItem.last_view_time) / (1000 * 60 * 60 * 24));
            const recencyScore = Math.max(0, 100 - (daysSinceViewed * 5));
            
            // 观看完成度权重
            const completionScore = viewedItem.play_percentage || 0;
            
            return (recencyScore * 0.6 + completionScore * 0.4);
        } catch (e) {
            console.error('获取用户历史权重失败:', e);
            return 0;
        }
    }
    
    // 综合评分函数
    function calculateOverallScore(item, keyword) {
        // 获取各种评分
        const keywordScore = calculateKeywordMatchScore(item, keyword);
        const qualityScore = getVideoQualityScore(item);
        const updateTime = parseUpdateTime(item.update_time);
        const timeScore = updateTime ? (Date.now() - updateTime) / (1000 * 60 * 60 * 24) : 365;
        const hitScore = getHitCount(item.hit || item.views || '');
        const ratingScore = parseFloat(item.rating || '0') * 20; // 转换为0-100分
        const sourceScore = getSourceReliabilityScore(item.source_code, item.api_url);
        const historyWeight = getUserHistoryWeight(item);
        
        // 计算时间衰减分数（越新越高）
        const freshnessScore = Math.max(0, 100 - (timeScore / 365 * 100));
        
        // 计算热度标准化分数
        const normalizedHitScore = Math.min(100, Math.log10(hitScore + 1) * 25);
        
        // 综合加权评分
        // 关键词匹配最重要，其次是视频质量，然后是热度、新鲜度等
        const weightedScore = (
            keywordScore * 0.35 +     // 关键词匹配（35%）
            qualityScore * 0.25 +     // 视频质量（25%）
            normalizedHitScore * 0.15 + // 热度（15%）
            freshnessScore * 0.10 +    // 新鲜度（10%）
            ratingScore * 0.10 +       // 评分（10%）
            sourceScore * 0.03 +       // 源可靠性（3%）
            historyWeight * 0.02       // 用户历史（2%）
        );
        
        return weightedScore;
    }
    
    // 对搜索结果进行优化排序
    allResults.sort((a, b) => {
        // 计算综合评分
        const scoreA = calculateOverallScore(a, query);
        const scoreB = calculateOverallScore(b, query);
        
        // 主要按综合评分排序
        if (Math.abs(scoreA - scoreB) > 0.1) {
            return scoreB - scoreA;
        }
        
        // 评分相同时，按视频名称排序
        const nameCompare = (a.vod_name || '').localeCompare(b.vod_name || '');
        if (nameCompare !== 0) return nameCompare;
        
        // 最后按来源排序
        return (a.source_name || '').localeCompare(b.source_name || '');
    });

        // 更新搜索结果计数
        const searchResultsCount = document.getElementById('searchResultsCount');
        if (searchResultsCount) {
            searchResultsCount.textContent = allResults.length;
        }

        // 显示结果区域，调整搜索区域
        document.getElementById('searchArea').classList.remove('flex-1');
        document.getElementById('searchArea').classList.add('mb-8');
        document.getElementById('resultsArea').classList.remove('hidden');

        // 隐藏豆瓣推荐区域（如果存在）
        const doubanArea = document.getElementById('doubanArea');
        if (doubanArea) {
            doubanArea.classList.add('hidden');
        }

        const resultsDiv = document.getElementById('results');

        // 如果没有结果
        if (!allResults || allResults.length === 0) {
            resultsDiv.innerHTML = `
                <div class="col-span-full text-center py-16">
                    <svg class="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 class="mt-2 text-lg font-medium text-gray-400">没有找到匹配的结果</h3>
                    <p class="mt-1 text-sm text-gray-500">请尝试其他关键词或更换数据源</p>
                </div>
            `;
            hideLoading();
            return;
        }

        // 有搜索结果时，才更新URL
        try {
            // 使用URI编码确保特殊字符能够正确显示
            const encodedQuery = encodeURIComponent(query);
            // 构建包含筛选条件的URL参数
            let urlParams = `s=${encodedQuery}`;
            if (filters.area) urlParams += `&area=${encodeURIComponent(filters.area)}`;
            if (filters.year) urlParams += `&year=${encodeURIComponent(filters.year)}`;
            if (filters.type) urlParams += `&type=${encodeURIComponent(filters.type)}`;
            
            // 使用HTML5 History API更新URL，不刷新页面
            window.history.pushState(
                { search: query, filters: filters },
                `搜索: ${query} - LibreTV`,
                `/${urlParams}`
            );
            // 更新页面标题
            document.title = `搜索: ${query} - LibreTV`;
        } catch (e) {
            console.error('更新浏览器历史失败:', e);
            // 如果更新URL失败，继续执行搜索
        }

        // 处理搜索结果过滤：如果启用了黄色内容过滤，则过滤掉分类含有敏感内容的项目
        const yellowFilterEnabled = localStorage.getItem('yellowFilterEnabled') === 'true';
        if (yellowFilterEnabled) {
            const banned = ['伦理片', '福利', '里番动漫', '门事件', '萝莉少女', '制服诱惑', '国产传媒', 'cosplay', '黑丝诱惑', '无码', '日本无码', '有码', '日本有码', 'SWAG', '网红主播', '色情片', '同性片', '福利视频', '福利片'];
            allResults = allResults.filter(item => {
                const typeName = item.type_name || '';
                return !banned.some(keyword => typeName.includes(keyword));
            });
        }

        // 添加XSS保护，使用textContent和属性转义
        const safeResults = allResults.map(item => {
            const safeId = item.vod_id ? item.vod_id.toString().replace(/[^\w-]/g, '') : '';
            const safeName = (item.vod_name || '').toString()
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            const sourceInfo = item.source_name ?
                `<span class="bg-[#222] text-xs px-1.5 py-0.5 rounded-full">${item.source_name}</span>` : '';
            const sourceCode = item.source_code || '';

            // 添加API URL属性，用于详情获取
            const apiUrlAttr = item.api_url ?
                `data-api-url="${item.api_url.replace(/"/g, '&quot;')}"` : '';

            // 修改为水平卡片布局，图片在左侧，文本在右侧，并优化样式
            const hasCover = item.vod_pic && item.vod_pic.startsWith('http');

            return `
                <div class="card-hover bg-[#111] rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-[1.02] h-full shadow-sm hover:shadow-md" 
                     onclick="showDetails('${safeId}','${safeName}','${sourceCode}')" ${apiUrlAttr}>
                    <div class="flex h-full">
                        ${hasCover ? `
                        <div class="relative flex-shrink-0 search-card-img-container">
                            <img src="${item.vod_pic}" alt="${safeName}" 
                                 class="h-full w-full object-cover transition-transform hover:scale-110" 
                                 onerror="this.onerror=null; this.src='https://via.placeholder.com/300x450?text=无封面'; this.classList.add('object-contain');" 
                                 loading="lazy">
                            <div class="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent"></div>
                        </div>` : ''}
                        
                        <div class="p-2 flex flex-col flex-grow">
                            <div class="flex-grow">
                                <h3 class="font-semibold mb-2 break-words line-clamp-2 ${hasCover ? '' : 'text-center'}" title="${safeName}">${safeName}</h3>
                                
                                <div class="flex flex-wrap ${hasCover ? '' : 'justify-center'} gap-1 mb-2">
                                    ${(item.type_name || '').toString().replace(/</g, '&lt;') ?
                    `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-blue-500 text-blue-300">
                                          ${(item.type_name || '').toString().replace(/</g, '&lt;')}
                                      </span>` : ''}
                                    ${(item.vod_year || '') ?
                    `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-purple-500 text-purple-300">
                                          ${item.vod_year}
                                      </span>` : ''}
                                </div>
                                <p class="text-gray-400 line-clamp-2 overflow-hidden ${hasCover ? '' : 'text-center'} mb-2">
                                    ${(item.vod_remarks || '暂无介绍').toString().replace(/</g, '&lt;')}
                                </p>
                            </div>
                            
                            <div class="flex justify-between items-center mt-1 pt-1 border-t border-gray-800">
                                ${sourceInfo ? `<div>${sourceInfo}</div>` : '<div></div>'}
                                <!-- 接口名称过长会被挤变形
                                <div>
                                    <span class="text-gray-500 flex items-center hover:text-blue-400 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                        </svg>
                                        播放
                                    </span>
                                </div>
                                -->
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        resultsDiv.innerHTML = safeResults;
    } catch (error) {
        console.error('搜索错误:', error);
        if (error.name === 'AbortError') {
            showToast('搜索请求超时，请检查网络连接', 'error');
        } else {
            showToast('搜索请求失败，请稍后重试', 'error');
        }
    } finally {
        hideLoading();
    }
}

// 切换清空按钮的显示状态
function toggleClearButton() {
    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearSearchInput');
    if (searchInput.value !== '') {
        clearButton.classList.remove('hidden');
    } else {
        clearButton.classList.add('hidden');
    }
}

// 获取视频质量分数
function getVideoQualityScore(video) {
    try {
        // 根据视频清晰度计算分数
        const title = (video.vod_name || '').toLowerCase();
        const description = (video.vod_desc || '').toLowerCase();
        const tags = ((video.tags || '') + (video.type_name || '')).toLowerCase();
        
        const allText = title + ' ' + description + ' ' + tags;
        
        // 定义清晰度权重
        const qualityKeywords = [
            { keywords: ['4k', '2160p'], weight: 10 },
            { keywords: ['2k', '1440p'], weight: 8 },
            { keywords: ['1080p', 'fullhd'], weight: 6 },
            { keywords: ['720p', 'hd'], weight: 4 },
            { keywords: ['480p'], weight: 2 },
            { keywords: ['360p', 'sd'], weight: 1 }
        ];
        
        // 定义视频类型权重
        const typeKeywords = [
            { keywords: ['无删', '完整版', '未删减'], score: 5 },
            { keywords: ['高清', '超清'], score: 3 },
            { keywords: ['抢先', '预告'], score: -2 },
            { keywords: ['枪版', '盗版', 'ts版'], score: -5 }
        ];
        
        let score = 3; // 默认分数
        
        // 计算清晰度分数
        for (const { keywords, weight } of qualityKeywords) {
            if (keywords.some(keyword => allText.includes(keyword))) {
                score = weight;
                break;
            }
        }
        
        // 计算类型分数
        for (const { keywords, weight } of typeKeywords) {
            if (keywords.some(keyword => allText.includes(keyword))) {
                score += weight;
            }
        }
        
        // 确保分数在合理范围内
        return Math.max(0, Math.min(10, score));
    } catch (error) {
        console.error('计算视频质量分数失败:', error);
        return 3; // 默认分数
    }
}

// 解析更新时间
function parseUpdateTime(updateTimeStr) {
    try {
        if (!updateTimeStr || typeof updateTimeStr !== 'string') {
            return null;
        }
        
        // 处理相对时间
        if (updateTimeStr.includes('分钟前') || updateTimeStr.includes('小时前')) {
            return Date.now();
        }
        
        if (updateTimeStr.includes('今天') || updateTimeStr.includes('昨天')) {
            const today = new Date();
            if (updateTimeStr.includes('昨天')) {
                today.setDate(today.getDate() - 1);
            }
            return today.getTime();
        }
        
        // 处理具体日期格式
        const datePatterns = [
            // 匹配 YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
            /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/,
            // 匹配 MM-DD-YYYY, MM/DD/YYYY, MM.DD.YYYY
            /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/,
            // 匹配 YYYY年MM月DD日
            /(\d{4})年(\d{1,2})月(\d{1,2})日/
        ];
        
        for (const pattern of datePatterns) {
            const match = updateTimeStr.match(pattern);
            if (match) {
                let year, month, day;
                
                if (match[3].length === 4) {
                    // MM-DD-YYYY 格式
                    [, month, day, year] = match;
                } else {
                    // YYYY-MM-DD 或 YYYY年MM月DD日 格式
                    [, year, month, day] = match;
                }
                
                const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                if (!isNaN(date.getTime())) {
                    return date.getTime();
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error('解析更新时间失败:', error);
        return null;
    }
}

// 解析热度/播放量
function getHitCount(hitStr) {
    try {
        if (!hitStr || typeof hitStr !== 'string') {
            return 0;
        }
        
        // 移除所有非数字和单位字符
        const cleaned = hitStr.replace(/[^\d.]+/g, '');
        
        // 提取数字部分
        const numMatch = cleaned.match(/\d+(\.\d+)?/);
        if (!numMatch) {
            return 0;
        }
        
        let count = parseFloat(numMatch[0]);
        
        // 检查单位并乘以相应的倍数
        if (hitStr.includes('亿')) {
            count *= 100000000;
        } else if (hitStr.includes('万')) {
            count *= 10000;
        } else if (hitStr.includes('千')) {
            count *= 1000;
        }
        
        return Math.floor(count);
    } catch (error) {
        console.error('解析热度计数失败:', error);
        return 0;
    }
}

// 清空搜索框内容
function clearSearchInput() {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = '';
    const clearButton = document.getElementById('clearSearchInput');
    clearButton.classList.add('hidden');
    // 清空搜索框时隐藏搜索建议
    hideSearchSuggestions();
}

// 获取搜索历史记录
function getSearchHistory() {
    try {
        const historyStr = localStorage.getItem('searchHistory');
        return historyStr ? JSON.parse(historyStr) : [];
    } catch (error) {
        console.error('获取搜索历史失败:', error);
        return [];
    }
}

// 保存搜索历史记录
function saveSearchHistory(query) {
    try {
        if (!query || query.trim().length === 0) return;
        
        const history = getSearchHistory();
        const MAX_HISTORY = 10;
        
        // 移除重复的搜索词
        const filteredHistory = history.filter(item => item.toLowerCase() !== query.toLowerCase());
        
        // 将新搜索词添加到开头
        filteredHistory.unshift(query);
        
        // 保持历史记录不超过最大数量
        if (filteredHistory.length > MAX_HISTORY) {
            filteredHistory.splice(MAX_HISTORY);
        }
        
        localStorage.setItem('searchHistory', JSON.stringify(filteredHistory));
        
        // 更新最近搜索显示
        updateRecentSearches();
    } catch (error) {
        console.error('保存搜索历史失败:', error);
    }
}

// 更新最近搜索显示
function updateRecentSearches() {
    const container = document.getElementById('recentSearches');
    if (!container) return;
    
    const history = getSearchHistory();
    
    if (history.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = '';
    
    // 添加清除历史按钮
    const clearHistoryBtn = document.createElement('button');
    clearHistoryBtn.className = 'text-gray-400 hover:text-gray-300 text-sm px-3 py-1 bg-[#1a1a1a] rounded-full';
    clearHistoryBtn.innerHTML = '<svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg> 清除历史';
    clearHistoryBtn.onclick = clearSearchHistory;
    container.appendChild(clearHistoryBtn);
    
    // 添加历史搜索项
    history.forEach(item => {
        const historyItem = document.createElement('button');
        historyItem.className = 'text-gray-300 hover:text-white text-sm px-3 py-1 bg-[#1a1a1a] rounded-full';
        historyItem.textContent = item;
        historyItem.onclick = () => {
            document.getElementById('searchInput').value = item;
            toggleClearButton();
            hideSearchSuggestions();
            search();
        };
        container.appendChild(historyItem);
    });
}

// 清除搜索历史
function clearSearchHistory() {
    try {
        localStorage.removeItem('searchHistory');
        document.getElementById('recentSearches').innerHTML = '';
    } catch (error) {
        console.error('清除搜索历史失败:', error);
    }
}

// 处理搜索建议
function handleSearchSuggestions(query) {
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (!suggestionsContainer) return;
    
    // 如果查询为空，隐藏建议
    if (!query || query.trim().length === 0) {
        hideSearchSuggestions();
        return;
    }
    
    // 获取搜索历史
    const history = getSearchHistory();
    
    // 过滤匹配的搜索建议
    const filteredSuggestions = history.filter(item => 
        item.toLowerCase().includes(query.toLowerCase())
    );
    
    // 如果没有匹配的建议，隐藏下拉框
    if (filteredSuggestions.length === 0) {
        hideSearchSuggestions();
        return;
    }
    
    // 清空并填充搜索建议
    suggestionsContainer.innerHTML = '';
    
    // 为每个建议项添加图标和高亮匹配部分
    filteredSuggestions.forEach(item => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'px-4 py-2 hover:bg-[#252525] cursor-pointer transition-colors flex items-center';
        
        // 添加搜索图标
        const icon = document.createElement('svg');
        icon.className = 'w-4 h-4 text-gray-500 mr-2';
        icon.setAttribute('fill', 'none');
        icon.setAttribute('stroke', 'currentColor');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>';
        
        // 创建文本节点，高亮匹配部分
        const textContainer = document.createElement('span');
        const lowerQuery = query.toLowerCase();
        const lowerItem = item.toLowerCase();
        const matchIndex = lowerItem.indexOf(lowerQuery);
        
        if (matchIndex !== -1) {
            // 非匹配部分
            const beforeMatch = document.createTextNode(item.substring(0, matchIndex));
            // 匹配部分（高亮）
            const matchSpan = document.createElement('span');
            matchSpan.className = 'bg-blue-600 bg-opacity-20 text-blue-300 font-medium';
            matchSpan.textContent = item.substring(matchIndex, matchIndex + query.length);
            // 剩余部分
            const afterMatch = document.createTextNode(item.substring(matchIndex + query.length));
            
            textContainer.appendChild(beforeMatch);
            textContainer.appendChild(matchSpan);
            textContainer.appendChild(afterMatch);
        } else {
            textContainer.textContent = item;
        }
        
        suggestionItem.appendChild(icon);
        suggestionItem.appendChild(textContainer);
        
        // 添加键盘导航支持
        suggestionItem.tabIndex = 0;
        
        // 点击建议项进行搜索
        suggestionItem.onclick = () => {
            document.getElementById('searchInput').value = item;
            toggleClearButton();
            hideSearchSuggestions();
            search();
        };
        
        // 回车键触发搜索
        suggestionItem.onkeydown = (e) => {
            if (e.key === 'Enter') {
                document.getElementById('searchInput').value = item;
                toggleClearButton();
                hideSearchSuggestions();
                search();
            }
        };
        
        suggestionsContainer.appendChild(suggestionItem);
    });
    
    // 显示搜索建议
    suggestionsContainer.classList.remove('hidden');
}

// 隐藏搜索建议
function hideSearchSuggestions() {
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (suggestionsContainer) {
        suggestionsContainer.classList.add('hidden');
    }
}

// 设置点击外部关闭搜索建议
function setupSearchSuggestionListeners() {
    const searchInput = document.getElementById('searchInput');
    const suggestionsContainer = document.getElementById('searchSuggestions');
    
    document.addEventListener('click', (e) => {
        const clearButton = document.getElementById('clearSearchInput');
        
        // 如果点击的不是搜索输入框、搜索建议框或清空按钮，隐藏搜索建议
        if (searchInput && suggestionsContainer && clearButton) {
            if (!searchInput.contains(e.target) && 
                !suggestionsContainer.contains(e.target) && 
                !clearButton.contains(e.target)) {
                hideSearchSuggestions();
            }
        }
    });
    
    // 为搜索输入框添加键盘导航支持
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (!suggestionsContainer || suggestionsContainer.classList.contains('hidden')) return;
            
            const suggestions = suggestionsContainer.querySelectorAll('div[tabindex="0"]');
            if (!suggestions || suggestions.length === 0) return;
            
            let activeIndex = -1;
            
            // 找到当前活动的建议项
            for (let i = 0; i < suggestions.length; i++) {
                if (suggestions[i] === document.activeElement) {
                    activeIndex = i;
                    break;
                }
            }
            
            // 处理上下箭头键
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = activeIndex < suggestions.length - 1 ? activeIndex + 1 : 0;
                suggestions[nextIndex].focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = activeIndex > 0 ? activeIndex - 1 : suggestions.length - 1;
                suggestions[prevIndex].focus();
            } else if (e.key === 'Escape') {
                // 按ESC键隐藏建议并聚焦到搜索框
                hideSearchSuggestions();
                searchInput.focus();
            }
        });
        
        // 当搜索框获得焦点时，如果有内容则显示建议
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim()) {
                handleSearchSuggestions(searchInput.value);
            }
        });
    }
    
    // 初始化最近搜索显示
    updateRecentSearches();
}

// 初始化筛选条件
function initializeFilters() {
    // 动态生成年份选项
    const yearSelect = document.getElementById('filterYear');
    if (yearSelect) {
        const currentYear = new Date().getFullYear();
        // 生成近30年的年份选项
        for (let year = currentYear; year >= currentYear - 30; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year + '年';
            yearSelect.appendChild(option);
        }
    }
    
    // 加载并应用保存的筛选条件
    const savedFilters = loadFilterConditions();
    applyFilterConditions(savedFilters);
    
    // 从URL参数加载筛选条件（如果有）
    const urlParams = new URLSearchParams(window.location.search);
    const urlFilters = {
        area: urlParams.get('area') || '',
        year: urlParams.get('year') || '',
        type: urlParams.get('type') || ''
    };
    
    if (urlFilters.area || urlFilters.year || urlFilters.type) {
        applyFilterConditions(urlFilters);
        saveFilterConditions(urlFilters);
    }
}

// 在DOM加载完成后初始化筛选条件
document.addEventListener('DOMContentLoaded', initializeFilters);

// 劫持搜索框的value属性以检测外部修改
function hookInput() {
    const input = document.getElementById('searchInput');
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

    // 重写 value 属性的 getter 和 setter
    Object.defineProperty(input, 'value', {
        get: function () {
            // 确保读取时返回字符串（即使原始值为 undefined/null）
            const originalValue = descriptor.get.call(this);
            return originalValue != null ? String(originalValue) : '';
        },
        set: function (value) {
            // 显式将值转换为字符串后写入
            const strValue = String(value);
            descriptor.set.call(this, strValue);
            this.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });

    // 初始化输入框值为空字符串（避免初始值为 undefined）
    input.value = '';
}
document.addEventListener('DOMContentLoaded', hookInput);

// 显示详情 - 修改为支持自定义API
async function showDetails(id, vod_name, sourceCode) {
    // 密码保护校验
    if (window.isPasswordProtected && window.isPasswordVerified) {
        if (window.isPasswordProtected() && !window.isPasswordVerified()) {
            showPasswordModal && showPasswordModal();
            return;
        }
    }
    if (!id) {
        showToast('视频ID无效', 'error');
        return;
    }

    showLoading();
    try {
        // 构建API参数
        let apiParams = '';

        // 处理自定义API源
        if (sourceCode.startsWith('custom_')) {
            const customIndex = sourceCode.replace('custom_', '');
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
            apiParams = '&source=' + sourceCode;
        }

        // Add a timestamp to prevent caching
        const timestamp = new Date().getTime();
        const cacheBuster = `&_t=${timestamp}`;
        const response = await fetch(`/api/detail?id=${encodeURIComponent(id)}${apiParams}${cacheBuster}`);

        const data = await response.json();

        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');

        // 显示来源信息
        const sourceName = data.videoInfo && data.videoInfo.source_name ?
            ` <span class="text-sm font-normal text-gray-400">(${data.videoInfo.source_name})</span>` : '';

        // 不对标题进行截断处理，允许完整显示
        modalTitle.innerHTML = `<span class="break-words">${vod_name || '未知视频'}</span>${sourceName}`;
        currentVideoTitle = vod_name || '未知视频';

        if (data.episodes && data.episodes.length > 0) {
            // 构建详情信息HTML
            let detailInfoHtml = '';
            if (data.videoInfo) {
                // Prepare description text, strip HTML and trim whitespace
                const descriptionText = data.videoInfo.desc ? data.videoInfo.desc.replace(/<[^>]+>/g, '').trim() : '';

                // Check if there's any actual grid content
                const hasGridContent = data.videoInfo.type || data.videoInfo.year || data.videoInfo.area || data.videoInfo.director || data.videoInfo.actor || data.videoInfo.remarks;

                if (hasGridContent || descriptionText) { // Only build if there's something to show
                    detailInfoHtml = `
                <div class="modal-detail-info">
                    ${hasGridContent ? `
                    <div class="detail-grid">
                        ${data.videoInfo.type ? `<div class="detail-item"><span class="detail-label">类型:</span> <span class="detail-value">${data.videoInfo.type}</span></div>` : ''}
                        ${data.videoInfo.year ? `<div class="detail-item"><span class="detail-label">年份:</span> <span class="detail-value">${data.videoInfo.year}</span></div>` : ''}
                        ${data.videoInfo.area ? `<div class="detail-item"><span class="detail-label">地区:</span> <span class="detail-value">${data.videoInfo.area}</span></div>` : ''}
                        ${data.videoInfo.director ? `<div class="detail-item"><span class="detail-label">导演:</span> <span class="detail-value">${data.videoInfo.director}</span></div>` : ''}
                        ${data.videoInfo.actor ? `<div class="detail-item"><span class="detail-label">主演:</span> <span class="detail-value">${data.videoInfo.actor}</span></div>` : ''}
                        ${data.videoInfo.remarks ? `<div class="detail-item"><span class="detail-label">备注:</span> <span class="detail-value">${data.videoInfo.remarks}</span></div>` : ''}
                    </div>` : ''}
                    ${descriptionText ? `
                    <div class="detail-desc">
                        <p class="detail-label">简介:</p>
                        <p class="detail-desc-content">${descriptionText}</p>
                    </div>` : ''}
                </div>
                `;
                }
            }

            currentEpisodes = data.episodes;
            currentEpisodeIndex = 0;

            modalContent.innerHTML = `
                ${detailInfoHtml}
                <div class="flex flex-wrap items-center justify-between mb-4 gap-2">
                    <div class="flex items-center gap-2">
                        <button onclick="toggleEpisodeOrder('${sourceCode}', '${id}')" 
                                class="px-3 py-1.5 bg-[#333] hover:bg-[#444] border border-[#444] rounded text-sm transition-colors flex items-center gap-1">
                            <svg class="w-4 h-4 transform ${episodesReversed ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                            </svg>
                            <span>${episodesReversed ? '正序排列' : '倒序排列'}</span>
                        </button>
                        <span class="text-gray-400 text-sm">共 ${data.episodes.length} 集</span>
                    </div>
                    <button onclick="copyLinks()" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors">
                        复制链接
                    </button>
                </div>
                <div id="episodesGrid" class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                    ${renderEpisodes(vod_name, sourceCode, id)}
                </div>
            `;
        } else {
            modalContent.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-red-400 mb-2">❌ 未找到播放资源</div>
                    <div class="text-gray-500 text-sm">该视频可能暂时无法播放，请尝试其他视频</div>
                </div>
            `;
        }

        modal.classList.remove('hidden');
    } catch (error) {
        console.error('获取详情错误:', error);
        showToast('获取详情失败，请稍后重试', 'error');
    } finally {
        hideLoading();
    }
}

// 更新播放视频函数，修改为使用/watch路径而不是直接打开player.html
function playVideo(url, vod_name, sourceCode, episodeIndex = 0, vodId = '') {
    // 密码保护校验
    if (window.isPasswordProtected && window.isPasswordVerified) {
        if (window.isPasswordProtected() && !window.isPasswordVerified()) {
            showPasswordModal && showPasswordModal();
            return;
        }
    }

    // 获取当前路径作为返回页面
    let currentPath = window.location.href;

    // 构建播放页面URL，使用watch.html作为中间跳转页
    let watchUrl = `watch.html?id=${vodId || ''}&source=${sourceCode || ''}&url=${encodeURIComponent(url)}&index=${episodeIndex}&title=${encodeURIComponent(vod_name || '')}`;

    // 添加返回URL参数
    if (currentPath.includes('index.html') || currentPath.endsWith('/')) {
        watchUrl += `&back=${encodeURIComponent(currentPath)}`;
    }

    // 保存当前状态到localStorage
    try {
        localStorage.setItem('currentVideoTitle', vod_name || '未知视频');
        localStorage.setItem('currentEpisodes', JSON.stringify(currentEpisodes));
        localStorage.setItem('currentEpisodeIndex', episodeIndex);
        localStorage.setItem('currentSourceCode', sourceCode || '');
        localStorage.setItem('lastPlayTime', Date.now());
        localStorage.setItem('lastSearchPage', currentPath);
        localStorage.setItem('lastPageUrl', currentPath);  // 确保保存返回页面URL
    } catch (e) {
        console.error('保存播放状态失败:', e);
    }

    // 在当前标签页中打开播放页面
    window.location.href = watchUrl;
}

// 弹出播放器页面
function showVideoPlayer(url) {
    // 在打开播放器前，隐藏详情弹窗
    const detailModal = document.getElementById('modal');
    if (detailModal) {
        detailModal.classList.add('hidden');
    }
    // 临时隐藏搜索结果和豆瓣区域，防止高度超出播放器而出现滚动条
    document.getElementById('resultsArea').classList.add('hidden');
    document.getElementById('doubanArea').classList.add('hidden');
    // 在框架中打开播放页面
    videoPlayerFrame = document.createElement('iframe');
    videoPlayerFrame.id = 'VideoPlayerFrame';
    videoPlayerFrame.className = 'fixed w-full h-screen z-40';
    videoPlayerFrame.src = url;
    document.body.appendChild(videoPlayerFrame);
    // 将焦点移入iframe
    videoPlayerFrame.focus();
}

// 关闭播放器页面
function closeVideoPlayer(home = false) {
    videoPlayerFrame = document.getElementById('VideoPlayerFrame');
    if (videoPlayerFrame) {
        videoPlayerFrame.remove();
        // 恢复搜索结果显示
        document.getElementById('resultsArea').classList.remove('hidden');
        // 关闭播放器时也隐藏详情弹窗
        const detailModal = document.getElementById('modal');
        if (detailModal) {
            detailModal.classList.add('hidden');
        }
        // 如果启用豆瓣区域则显示豆瓣区域
        if (localStorage.getItem('doubanEnabled') === 'true') {
            document.getElementById('doubanArea').classList.remove('hidden');
        }
    }
    if (home) {
        // 刷新主页
        window.location.href = '/'
    }
}

// 播放上一集
function playPreviousEpisode(sourceCode) {
    if (currentEpisodeIndex > 0) {
        const prevIndex = currentEpisodeIndex - 1;
        const prevUrl = currentEpisodes[prevIndex];
        playVideo(prevUrl, currentVideoTitle, sourceCode, prevIndex);
    }
}

// 播放下一集
function playNextEpisode(sourceCode) {
    if (currentEpisodeIndex < currentEpisodes.length - 1) {
        const nextIndex = currentEpisodeIndex + 1;
        const nextUrl = currentEpisodes[nextIndex];
        playVideo(nextUrl, currentVideoTitle, sourceCode, nextIndex);
    }
}

// 处理播放器加载错误
function handlePlayerError() {
    hideLoading();
    showToast('视频播放加载失败，请尝试其他视频源', 'error');
}

// 辅助函数用于渲染剧集按钮（使用当前的排序状态）
function renderEpisodes(vodName, sourceCode, vodId) {
    const episodes = episodesReversed ? [...currentEpisodes].reverse() : currentEpisodes;
    return episodes.map((episode, index) => {
        // 根据倒序状态计算真实的剧集索引
        const realIndex = episodesReversed ? currentEpisodes.length - 1 - index : index;
        return `
            <button id="episode-${realIndex}" onclick="playVideo('${episode}','${vodName.replace(/"/g, '&quot;')}', '${sourceCode}', ${realIndex}, '${vodId}')" 
                    class="px-4 py-2 bg-[#222] hover:bg-[#333] border border-[#333] rounded-lg transition-colors text-center episode-btn">
                ${realIndex + 1}
            </button>
        `;
    }).join('');
}

// 复制视频链接到剪贴板
function copyLinks() {
    const episodes = episodesReversed ? [...currentEpisodes].reverse() : currentEpisodes;
    const linkList = episodes.join('\r\n');
    navigator.clipboard.writeText(linkList).then(() => {
        showToast('播放链接已复制', 'success');
    }).catch(err => {
        showToast('复制失败，请检查浏览器权限', 'error');
    });
}

// 切换排序状态的函数
function toggleEpisodeOrder(sourceCode, vodId) {
    episodesReversed = !episodesReversed;
    // 重新渲染剧集区域，使用 currentVideoTitle 作为视频标题
    const episodesGrid = document.getElementById('episodesGrid');
    if (episodesGrid) {
        episodesGrid.innerHTML = renderEpisodes(currentVideoTitle, sourceCode, vodId);
    }

    // 更新按钮文本和箭头方向
    const toggleBtn = document.querySelector(`button[onclick="toggleEpisodeOrder('${sourceCode}', '${vodId}')"]`);
    if (toggleBtn) {
        toggleBtn.querySelector('span').textContent = episodesReversed ? '正序排列' : '倒序排列';
        const arrowIcon = toggleBtn.querySelector('svg');
        if (arrowIcon) {
            arrowIcon.style.transform = episodesReversed ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }
}

// 从URL导入配置
async function importConfigFromUrl() {
    // 创建模态框元素
    let modal = document.getElementById('importUrlModal');
    if (modal) {
        document.body.removeChild(modal);
    }

    modal = document.createElement('div');
    modal.id = 'importUrlModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40';

    modal.innerHTML = `
        <div class="bg-[#191919] rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            <button id="closeUrlModal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">&times;</button>
            
            <h3 class="text-xl font-bold mb-4">从URL导入配置</h3>
            
            <div class="mb-4">
                <input type="text" id="configUrl" placeholder="输入配置文件URL" 
                       class="w-full px-3 py-2 bg-[#222] border border-[#333] rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
            </div>
            
            <div class="flex justify-end space-x-2">
                <button id="confirmUrlImport" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">导入</button>
                <button id="cancelUrlImport" class="bg-[#444] hover:bg-[#555] text-white px-4 py-2 rounded">取消</button>
            </div>
        </div>`;

    document.body.appendChild(modal);

    // 关闭按钮事件
    document.getElementById('closeUrlModal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    // 取消按钮事件
    document.getElementById('cancelUrlImport').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    // 确认导入按钮事件
    document.getElementById('confirmUrlImport').addEventListener('click', async () => {
        const url = document.getElementById('configUrl').value.trim();
        if (!url) {
            showToast('请输入配置文件URL', 'warning');
            return;
        }

        // 验证URL格式
        try {
            const urlObj = new URL(url);
            if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                showToast('URL必须以http://或https://开头', 'warning');
                return;
            }
        } catch (e) {
            showToast('URL格式不正确', 'warning');
            return;
        }

        showLoading('正在从URL导入配置...');

        try {
            // 获取配置文件 - 直接请求URL
            const response = await fetch(url, {
                mode: 'cors',
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) throw '获取配置文件失败';

            // 验证响应内容类型
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw '响应不是有效的JSON格式';
            }

            const config = await response.json();
            if (config.name !== 'LibreTV-Settings') throw '配置文件格式不正确';

            // 验证哈希
            const dataHash = await sha256(JSON.stringify(config.data));
            if (dataHash !== config.hash) throw '配置文件哈希值不匹配';

            // 导入配置
            for (let item in config.data) {
                localStorage.setItem(item, config.data[item]);
            }

            showToast('配置文件导入成功，3 秒后自动刷新本页面。', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } catch (error) {
            const message = typeof error === 'string' ? error : '导入配置失败';
            showToast(`从URL导入配置出错 (${message})`, 'error');
        } finally {
            hideLoading();
            document.body.removeChild(modal);
        }
    });

    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

// 配置文件导入功能
async function importConfig() {
    showImportBox(async (file) => {
        try {
            // 检查文件类型
            if (!(file.type === 'application/json' || file.name.endsWith('.json'))) throw '文件类型不正确';

            // 检查文件大小
            if (file.size > 1024 * 1024 * 10) throw new Error('文件大小超过 10MB');

            // 读取文件内容
            const content = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject('文件读取失败');
                reader.readAsText(file);
            });

            // 解析并验证配置
            const config = JSON.parse(content);
            if (config.name !== 'LibreTV-Settings') throw '配置文件格式不正确';

            // 验证哈希
            const dataHash = await sha256(JSON.stringify(config.data));
            if (dataHash !== config.hash) throw '配置文件哈希值不匹配';

            // 导入配置
            for (let item in config.data) {
                localStorage.setItem(item, config.data[item]);
            }

            showToast('配置文件导入成功，3 秒后自动刷新本页面。', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } catch (error) {
            const message = typeof error === 'string' ? error : '配置文件格式错误';
            showToast(`配置文件读取出错 (${message})`, 'error');
        }
    });
}

// 配置文件导出功能
async function exportConfig() {
    // 存储配置数据
    const config = {};
    const items = {};

    const settingsToExport = [
        'selectedAPIs',
        'customAPIs',
        'yellowFilterEnabled',
        'adFilteringEnabled',
        'doubanEnabled',
        'hasInitializedDefaults'
    ];

    // 导出设置项
    settingsToExport.forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) {
            items[key] = value;
        }
    });

    // 导出历史记录
    const viewingHistory = localStorage.getItem('viewingHistory');
    if (viewingHistory) {
        items['viewingHistory'] = viewingHistory;
    }

    const searchHistory = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (searchHistory) {
        items[SEARCH_HISTORY_KEY] = searchHistory;
    }

    const times = Date.now().toString();
    config['name'] = 'LibreTV-Settings';  // 配置文件名，用于校验
    config['time'] = times;               // 配置文件生成时间
    config['cfgVer'] = '1.0.0';           // 配置文件版本
    config['data'] = items;               // 配置文件数据
    config['hash'] = await sha256(JSON.stringify(config['data']));  // 计算数据的哈希值，用于校验

    // 将配置数据保存为 JSON 文件
    saveStringAsFile(JSON.stringify(config), 'LibreTV-Settings_' + times + '.json');
}

// 将字符串保存为文件
function saveStringAsFile(content, fileName) {
    // 创建Blob对象并指定类型
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    // 生成临时URL
    const url = window.URL.createObjectURL(blob);
    // 创建<a>标签并触发下载
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    // 清理临时对象
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// 移除Node.js的require语句，因为这是在浏览器环境中运行的
