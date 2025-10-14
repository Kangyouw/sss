// 改进的API请求处理函数
// 增强的fetch函数，支持重试机制
async function fetchWithRetry(url, options = {}, retries = 2, retryDelay = 1000) {
    let lastError;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            // 创建一个新的AbortController用于每次尝试
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), options.timeout || 10000);
            
            try {
                // 合并AbortSignal到选项
                const fetchOptions = {
                    ...options,
                    signal: controller.signal
                };
                
                const response = await fetch(url, fetchOptions);
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    return response;
                } else if (response.status >= 500 && response.status < 600 && attempt < retries) {
                    // 服务器错误，可重试
                    console.warn(`请求失败 (${response.status})，${retryDelay}ms后重试 (${attempt+1}/${retries})`);
                    lastError = new Error(`服务器错误: ${response.status}`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    continue;
                } else {
                    // 其他错误，不可重试
                    throw new Error(`HTTP错误: ${response.status}`);
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                
                // 网络错误或超时错误，可以重试
                if ((!fetchError.name || fetchError.name === 'TypeError' || fetchError.name === 'AbortError') && attempt < retries) {
                    console.warn(`网络错误，${retryDelay}ms后重试 (${attempt+1}/${retries})`);
                    lastError = fetchError;
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    continue;
                } else {
                    throw fetchError;
                }
            }
        } catch (error) {
            lastError = error;
        }
    }
    
    // 所有重试都失败，抛出最后一个错误
    throw lastError || new Error('所有重试均失败');
}

// 解析错误类型，提供更具体的错误提示
function getSpecificErrorMessage(error) {
    if (!error) return '未知错误';
    
    const errorMessage = error.message || String(error);
    
    // 网络错误
    if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
        return '网络连接失败，请检查您的网络设置';
    }
    
    // 超时错误
    if (errorMessage.includes('timeout') || error.name === 'AbortError') {
        return '请求超时，服务器响应时间过长';
    }
    
    // 404错误
    if (errorMessage.includes('404')) {
        return '请求的资源不存在';
    }
    
    // 服务器错误
    if (errorMessage.includes('50') || errorMessage.includes('服务器错误')) {
        return '服务器暂时不可用，请稍后再试';
    }
    
    // API特定错误
    if (errorMessage.includes('API返回的数据格式无效')) {
        return '数据源返回的数据格式有误，可能是数据源已更新';
    }
    
    if (errorMessage.includes('获取到的详情内容无效')) {
        return '无法获取视频详情，可能是视频ID无效或数据源已更新';
    }
    
    // 默认错误消息
    return errorMessage;
}

async function handleApiRequest(url) {
    const customApi = url.searchParams.get('customApi') || '';
    const customDetail = url.searchParams.get('customDetail') || '';
    const source = url.searchParams.get('source') || 'heimuer';
    
    try {
        if (url.pathname === '/api/search') {
            const searchQuery = url.searchParams.get('wd');
            if (!searchQuery) {
                throw new Error('缺少搜索参数');
            }
            
            // 验证API和source的有效性
            if (source === 'custom' && !customApi) {
                throw new Error('使用自定义API时必须提供API地址');
            }
            
            if (!API_SITES[source] && source !== 'custom') {
                throw new Error('无效的API来源');
            }
            
            const apiUrl = customApi
                ? `${customApi}${API_CONFIG.search.path}${encodeURIComponent(searchQuery)}`
                : `${API_SITES[source].api}${API_CONFIG.search.path}${encodeURIComponent(searchQuery)}`;
            
            // 添加超时处理
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            try {
                // 添加鉴权参数到代理URL
                const proxiedUrl = await window.ProxyAuth?.addAuthToProxyUrl ? 
                    await window.ProxyAuth.addAuthToProxyUrl(PROXY_URL + encodeURIComponent(apiUrl)) :
                    PROXY_URL + encodeURIComponent(apiUrl);
                    
                const response = await fetchWithRetry(proxiedUrl, {
                        headers: API_CONFIG.search.headers,
                        timeout: 10000
                    });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`API请求失败: ${response.status}`);
                }
                
                const data = await response.json();
                
                // 检查JSON格式的有效性
                if (!data || !Array.isArray(data.list)) {
                    throw new Error('API返回的数据格式无效');
                }
                
                // 添加源信息到每个结果
                data.list.forEach(item => {
                    item.source_name = source === 'custom' ? '自定义源' : API_SITES[source].name;
                    item.source_code = source;
                    // 对于自定义源，添加API URL信息
                    if (source === 'custom') {
                        item.api_url = customApi;
                    }
                });
                
                return JSON.stringify({
                    code: 200,
                    list: data.list || [],
                });
            } catch (fetchError) {
                clearTimeout(timeoutId);
                throw fetchError;
            }
        }

        // 详情处理
        if (url.pathname === '/api/detail') {
            const id = url.searchParams.get('id');
            const sourceCode = url.searchParams.get('source') || 'heimuer'; // 获取源代码
            
            if (!id) {
                throw new Error('缺少视频ID参数');
            }
            
            // 验证ID格式 - 只允许数字和有限的特殊字符
            if (!/^[\w-]+$/.test(id)) {
                throw new Error('无效的视频ID格式');
            }

            // 验证API和source的有效性
            if (sourceCode === 'custom' && !customApi) {
                throw new Error('使用自定义API时必须提供API地址');
            }
            
            if (!API_SITES[sourceCode] && sourceCode !== 'custom') {
                throw new Error('无效的API来源');
            }

            // 对于有detail参数的源，都使用特殊处理方式
            if (sourceCode !== 'custom' && API_SITES[sourceCode].detail) {
                return await handleSpecialSourceDetail(id, sourceCode);
            }
            
            // 如果是自定义API，并且传递了detail参数，尝试特殊处理
            // 优先 customDetail
            if (sourceCode === 'custom' && customDetail) {
                return await handleCustomApiSpecialDetail(id, customDetail);
            }
            if (sourceCode === 'custom' && url.searchParams.get('useDetail') === 'true') {
                return await handleCustomApiSpecialDetail(id, customApi);
            }
            
            const detailUrl = customApi
                ? `${customApi}${API_CONFIG.detail.path}${id}`
                : `${API_SITES[sourceCode].api}${API_CONFIG.detail.path}${id}`;
            
            // 添加超时处理
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            try {
                // 添加鉴权参数到代理URL
                const proxiedUrl = await window.ProxyAuth?.addAuthToProxyUrl ? 
                    await window.ProxyAuth.addAuthToProxyUrl(PROXY_URL + encodeURIComponent(detailUrl)) :
                    PROXY_URL + encodeURIComponent(detailUrl);
                    
                const response = await fetchWithRetry(proxiedUrl, {
                        headers: API_CONFIG.detail.headers,
                        timeout: 10000
                    });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`详情请求失败: ${response.status}`);
                }
                
                // 解析JSON
                const data = await response.json();
                
                // 检查返回的数据是否有效
                if (!data || !data.list || !Array.isArray(data.list) || data.list.length === 0) {
                    throw new Error('获取到的详情内容无效');
                }
                
                // 获取第一个匹配的视频详情
                const videoDetail = data.list[0];
                
                // 提取播放地址
                let episodes = [];
                
                if (videoDetail.vod_play_url) {
                    // 分割不同播放源
                    const playSources = videoDetail.vod_play_url.split('$$$');
                    
                    // 提取第一个播放源的集数（通常为主要源）
                    if (playSources.length > 0) {
                        const mainSource = playSources[0];
                        const episodeList = mainSource.split('#');
                        
                        // 从每个集数中提取URL
                        episodes = episodeList.map(ep => {
                            const parts = ep.split('$');
                            // 返回URL部分(通常是第二部分，如果有的话)
                            return parts.length > 1 ? parts[1] : '';
                        }).filter(url => url && (url.startsWith('http://') || url.startsWith('https://')));
                    }
                }
                
                // 如果没有找到播放地址，尝试使用正则表达式查找m3u8链接
                if (episodes.length === 0 && videoDetail.vod_content) {
                    const matches = videoDetail.vod_content.match(M3U8_PATTERN) || [];
                    episodes = matches.map(link => link.replace(/^\$/, ''));
                }
                
                return JSON.stringify({
                    code: 200,
                    episodes: episodes,
                    detailUrl: detailUrl,
                    videoInfo: {
                        title: videoDetail.vod_name,
                        cover: videoDetail.vod_pic,
                        desc: videoDetail.vod_content,
                        type: videoDetail.type_name,
                        year: videoDetail.vod_year,
                        area: videoDetail.vod_area,
                        director: videoDetail.vod_director,
                        actor: videoDetail.vod_actor,
                        remarks: videoDetail.vod_remarks,
                        // 添加源信息
                        source_name: sourceCode === 'custom' ? '自定义源' : API_SITES[sourceCode].name,
                        source_code: sourceCode
                    }
                });
            } catch (fetchError) {
                clearTimeout(timeoutId);
                throw fetchError;
            }
        }

        throw new Error('未知的API路径');
    } catch (error) {
        console.error('API处理错误:', error);
        return JSON.stringify({
            code: 400,
            msg: error.message || '请求处理失败',
            list: [],
            episodes: [],
        });
    }
}

// 处理自定义API的特殊详情页
async function handleCustomApiSpecialDetail(id, customApi) {
    try {
        // 构建详情页URL
        const detailUrl = `${customApi}/index.php/vod/detail/id/${id}.html`;
        
        // 添加超时处理
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        // 添加鉴权参数到代理URL
        const proxiedUrl = await window.ProxyAuth?.addAuthToProxyUrl ? 
            await window.ProxyAuth.addAuthToProxyUrl(PROXY_URL + encodeURIComponent(detailUrl)) :
            PROXY_URL + encodeURIComponent(detailUrl);
            
        // 获取详情页HTML
        const response = await fetch(proxiedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`自定义API详情页请求失败: ${response.status}`);
        }
        
        // 获取HTML内容
        const html = await response.text();
        
        // 使用通用模式提取m3u8链接
        const generalPattern = /\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
        let matches = html.match(generalPattern) || [];
        
        // 处理链接
        matches = matches.map(link => {
            link = link.substring(1, link.length);
            const parenIndex = link.indexOf('(');
            return parenIndex > 0 ? link.substring(0, parenIndex) : link;
        });
        
        // 提取基本信息
        const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
        const titleText = titleMatch ? titleMatch[1].trim() : '';
        
        const descMatch = html.match(/<div[^>]*class=["']sketch["'][^>]*>([\s\S]*?)<\/div>/);
        const descText = descMatch ? descMatch[1].replace(/<[^>]+>/g, ' ').trim() : '';
        
        return JSON.stringify({
            code: 200,
            episodes: matches,
            detailUrl: detailUrl,
            videoInfo: {
                title: titleText,
                desc: descText,
                source_name: '自定义源',
                source_code: 'custom'
            }
        });
    } catch (error) {
        console.error(`自定义API详情获取失败:`, error);
        throw error;
    }
}

// 通用特殊源详情处理函数
async function handleSpecialSourceDetail(id, sourceCode) {
    try {
        // 构建详情页URL（使用配置中的detail URL而不是api URL）
        const detailUrl = `${API_SITES[sourceCode].detail}/index.php/vod/detail/id/${id}.html`;
        
        // 添加超时处理
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        // 添加鉴权参数到代理URL
        const proxiedUrl = await window.ProxyAuth?.addAuthToProxyUrl ? 
            await window.ProxyAuth.addAuthToProxyUrl(PROXY_URL + encodeURIComponent(detailUrl)) :
            PROXY_URL + encodeURIComponent(detailUrl);
            
        // 获取详情页HTML
        const response = await fetch(proxiedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`详情页请求失败: ${response.status}`);
        }
        
        // 获取HTML内容
        const html = await response.text();
        
        // 根据不同源类型使用不同的正则表达式
        let matches = [];
        
        if (sourceCode === 'ffzy') {
            // 非凡影视使用特定的正则表达式
            const ffzyPattern = /\$(https?:\/\/[^"'\s]+?\/\d{8}\/\d+_[a-f0-9]+\/index\.m3u8)/g;
            matches = html.match(ffzyPattern) || [];
        }
        
        // 如果没有找到链接或者是其他源类型，尝试一个更通用的模式
        if (matches.length === 0) {
            const generalPattern = /\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
            matches = html.match(generalPattern) || [];
        }
        // 去重处理，避免一个播放源多集显示
        matches = [...new Set(matches)];
        // 处理链接
        matches = matches.map(link => {
            link = link.substring(1, link.length);
            const parenIndex = link.indexOf('(');
            return parenIndex > 0 ? link.substring(0, parenIndex) : link;
        });
        
        // 提取可能存在的标题、简介等基本信息
        const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
        const titleText = titleMatch ? titleMatch[1].trim() : '';
        
        const descMatch = html.match(/<div[^>]*class=["']sketch["'][^>]*>([\s\S]*?)<\/div>/);
        const descText = descMatch ? descMatch[1].replace(/<[^>]+>/g, ' ').trim() : '';
        
        return JSON.stringify({
            code: 200,
            episodes: matches,
            detailUrl: detailUrl,
            videoInfo: {
                title: titleText,
                desc: descText,
                source_name: API_SITES[sourceCode].name,
                source_code: sourceCode
            }
        });
    } catch (error) {
        console.error(`${API_SITES[sourceCode].name}详情获取失败:`, error);
        throw error;
    }
}

// 处理聚合搜索
async function handleAggregatedSearch(searchQuery) {
    // 获取可用的API源列表（排除aggregated和custom）
    const availableSources = Object.keys(API_SITES).filter(key => 
        key !== 'aggregated' && key !== 'custom'
    );
    
    if (availableSources.length === 0) {
        throw new Error('没有可用的API源');
    }
    
    // 创建所有API源的搜索请求
    const searchPromises = availableSources.map(async (source) => {
        try {
            const apiUrl = `${API_SITES[source].api}${API_CONFIG.search.path}${encodeURIComponent(searchQuery)}`;
            
            // 使用Promise.race添加超时处理
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`${source}源搜索超时`)), 8000)
            );
            
            // 添加鉴权参数到代理URL
            const proxiedUrl = await window.ProxyAuth?.addAuthToProxyUrl ? 
                await window.ProxyAuth.addAuthToProxyUrl(PROXY_URL + encodeURIComponent(apiUrl)) :
                PROXY_URL + encodeURIComponent(apiUrl);
            
            const fetchPromise = fetch(proxiedUrl, {
                headers: API_CONFIG.search.headers
            });
            
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            
            if (!response.ok) {
                throw new Error(`${source}源请求失败: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data || !Array.isArray(data.list)) {
                throw new Error(`${source}源返回的数据格式无效`);
            }
            
            // 为搜索结果添加源信息
            const results = data.list.map(item => ({
                ...item,
                source_name: API_SITES[source].name,
                source_code: source
            }));
            
            return results;
        } catch (error) {
            console.warn(`${source}源搜索失败:`, error);
            return []; // 返回空数组表示该源搜索失败
        }
    });
    
    try {
        // 并行执行所有搜索请求
        const resultsArray = await Promise.all(searchPromises);
        
        // 合并所有结果
        let allResults = [];
        resultsArray.forEach(results => {
            if (Array.isArray(results) && results.length > 0) {
                allResults = allResults.concat(results);
            }
        });
        
        // 如果没有搜索结果，返回空结果
        if (allResults.length === 0) {
            return JSON.stringify({
                code: 200,
                list: [],
                msg: '所有源均无搜索结果'
            });
        }
        
        // 增强去重：通过视频名称、ID等特征识别不同来源的相同内容
        const uniqueResults = [];
        const seenByVodId = new Set();  // 按ID去重
        const seenByContentHash = new Set();  // 按内容特征去重
        
        // 清理视频名称（移除清晰度、年份、版本等信息）
        function cleanVideoName(name) {
            if (!name) return '';
            // 移除清晰度信息
            name = name.replace(/(4k|2k|1080p|720p|480p|高清|超清)/gi, '');
            // 移除年份信息
            name = name.replace(/(\d{4}年|\d{4})/gi, '');
            // 移除版本信息
            name = name.replace(/(未删减版|完整版|删减版|修复版|重制版|导演剪辑版|加长版)/gi, '');
            // 移除空格和特殊字符
            name = name.replace(/[\s\u00A0\-\_\(\)\[\]\{\}\.\,\:\;\！\？]/g, '').trim();
            return name;
        }
        
        // 生成内容哈希值
        function generateContentHash(item) {
            const cleanName = cleanVideoName(item.vod_name);
            const typeName = (item.type_name || '').toLowerCase();
            const year = (item.vod_year || '').toString().slice(0, 4);
            
            // 基础哈希由清理后的名称和类型组成
            let baseHash = `${cleanName}_${typeName}`;
            
            // 如果有年份信息，也加入哈希
            if (year && /^\d{4}$/.test(year)) {
                baseHash = `${baseHash}_${year}`;
            }
            
            return baseHash;
        }
        
        allResults.forEach(item => {
            // 1. 先按vod_id和source_code组合去重（确保同一来源的相同视频不重复）
            const uniqueIdKey = `${item.source_code}_${item.vod_id}`;
            if (seenByVodId.has(uniqueIdKey)) {
                return;
            }
            
            // 2. 再按内容特征去重（识别不同来源的相同内容）
            const contentHash = generateContentHash(item);
            
            // 如果内容特征已存在，选择质量更高的来源
            if (seenByContentHash.has(contentHash)) {
                // 查找已存在的相似项索引
                const existingIndex = uniqueResults.findIndex(uniqueItem => 
                    generateContentHash(uniqueItem) === contentHash
                );
                
                if (existingIndex !== -1) {
                    const existingItem = uniqueResults[existingIndex];
                    
                    // 比较视频质量（简单实现：假设某些源提供更高质量的视频）
                    const qualitySources = ['tyyszy', 'bfzy', 'dyttzy']; // 高质量源列表
                    const existingQuality = qualitySources.includes(existingItem.source_code) ? 1 : 0;
                    const newQuality = qualitySources.includes(item.source_code) ? 1 : 0;
                    
                    // 如果新来源质量更高，则替换现有项
                    if (newQuality > existingQuality) {
                        uniqueResults[existingIndex] = item;
                        seenByVodId.delete(`${existingItem.source_code}_${existingItem.vod_id}`);
                        seenByVodId.add(uniqueIdKey);
                    }
                }
                return;
            }
            
            // 添加新结果
            seenByVodId.add(uniqueIdKey);
            seenByContentHash.add(contentHash);
            uniqueResults.push(item);
        });
        
        // 按照视频名称和来源排序
        uniqueResults.sort((a, b) => {
            // 首先按照视频名称排序
            const nameCompare = (a.vod_name || '').localeCompare(b.vod_name || '');
            if (nameCompare !== 0) return nameCompare;
            
            // 如果名称相同，则按照来源排序
            return (a.source_name || '').localeCompare(b.source_name || '');
        });
        
        return JSON.stringify({
            code: 200,
            list: uniqueResults,
        });
    } catch (error) {
            console.error('聚合搜索处理错误:', error);
            const specificError = getSpecificErrorMessage(error);
            return JSON.stringify({
                code: 400,
                msg: specificError,
                list: []
            });
        }
}

// 处理多个自定义API源的聚合搜索
async function handleMultipleCustomSearch(searchQuery, customApiUrls) {
    // 解析自定义API列表
    const apiUrls = customApiUrls.split(CUSTOM_API_CONFIG.separator)
        .map(url => url.trim())
        .filter(url => url.length > 0 && /^https?:\/\//.test(url))
        .slice(0, CUSTOM_API_CONFIG.maxSources);
    
    if (apiUrls.length === 0) {
        throw new Error('没有提供有效的自定义API地址');
    }
    
    // 为每个API创建搜索请求
    const searchPromises = apiUrls.map(async (apiUrl, index) => {
        try {
            const fullUrl = `${apiUrl}${API_CONFIG.search.path}${encodeURIComponent(searchQuery)}`;
            
            // 使用Promise.race添加超时处理
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`自定义API ${index+1} 搜索超时`)), 8000)
            );
            
            // 添加鉴权参数到代理URL
            const proxiedUrl = await window.ProxyAuth?.addAuthToProxyUrl ? 
                await window.ProxyAuth.addAuthToProxyUrl(PROXY_URL + encodeURIComponent(fullUrl)) :
                PROXY_URL + encodeURIComponent(fullUrl);
            
            const fetchPromise = fetch(proxiedUrl, {
                headers: API_CONFIG.search.headers
            });
            
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            
            if (!response.ok) {
                throw new Error(`自定义API ${index+1} 请求失败: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data || !Array.isArray(data.list)) {
                throw new Error(`自定义API ${index+1} 返回的数据格式无效`);
            }
            
            // 为搜索结果添加源信息
            const results = data.list.map(item => ({
                ...item,
                source_name: `${CUSTOM_API_CONFIG.namePrefix}${index+1}`,
                source_code: 'custom',
                api_url: apiUrl // 保存API URL以便详情获取
            }));
            
            return results;
        } catch (error) {
            console.warn(`自定义API ${index+1} 搜索失败:`, error);
            return []; // 返回空数组表示该源搜索失败
        }
    });
    
    try {
        // 并行执行所有搜索请求
        const resultsArray = await Promise.all(searchPromises);
        
        // 合并所有结果
        let allResults = [];
        resultsArray.forEach(results => {
            if (Array.isArray(results) && results.length > 0) {
                allResults = allResults.concat(results);
            }
        });
        
        // 如果没有搜索结果，返回空结果
        if (allResults.length === 0) {
            return JSON.stringify({
                code: 200,
                list: [],
                msg: '所有自定义API源均无搜索结果'
            });
        }
        
        // 增强去重：通过视频名称、ID等特征识别不同来源的相同内容
        const uniqueResults = [];
        const seenByVodId = new Set();  // 按ID去重
        const seenByContentHash = new Set();  // 按内容特征去重
        
        // 清理视频名称（移除清晰度、年份、版本等信息）
        function cleanVideoName(name) {
            if (!name) return '';
            // 移除清晰度信息
            name = name.replace(/(4k|2k|1080p|720p|480p|高清|超清)/gi, '');
            // 移除年份信息
            name = name.replace(/(\d{4}年|\d{4})/gi, '');
            // 移除版本信息
            name = name.replace(/(未删减版|完整版|删减版|修复版|重制版|导演剪辑版|加长版)/gi, '');
            // 移除空格和特殊字符
            name = name.replace(/[\s\u00A0\-\_\(\)\[\]\{\}\.\,\:\;\！\？]/g, '').trim();
            return name;
        }
        
        // 生成内容哈希值
        function generateContentHash(item) {
            const cleanName = cleanVideoName(item.vod_name);
            const typeName = (item.type_name || '').toLowerCase();
            const year = (item.vod_year || '').toString().slice(0, 4);
            
            // 基础哈希由清理后的名称和类型组成
            let baseHash = `${cleanName}_${typeName}`;
            
            // 如果有年份信息，也加入哈希
            if (year && /^\d{4}$/.test(year)) {
                baseHash = `${baseHash}_${year}`;
            }
            
            return baseHash;
        }
        
        allResults.forEach(item => {
            // 1. 先按vod_id和api_url组合去重（确保同一来源的相同视频不重复）
            const uniqueIdKey = `${item.api_url || ''}_${item.vod_id}`;
            if (seenByVodId.has(uniqueIdKey)) {
                return;
            }
            
            // 2. 再按内容特征去重（识别不同来源的相同内容）
            const contentHash = generateContentHash(item);
            
            // 如果内容特征已存在，选择质量更高的来源
            if (seenByContentHash.has(contentHash)) {
                // 查找已存在的相似项索引
                const existingIndex = uniqueResults.findIndex(uniqueItem => 
                    generateContentHash(uniqueItem) === contentHash
                );
                
                if (existingIndex !== -1) {
                    // 自定义API没有质量源列表，所以简单比较响应速度（假设先返回的质量更高）
                    // 在实际应用中，可以扩展这个逻辑
                    return;
                }
                return;
            }
            
            // 添加新结果
            seenByVodId.add(uniqueIdKey);
            seenByContentHash.add(contentHash);
            uniqueResults.push(item);
        });
        
        return JSON.stringify({
            code: 200,
            list: uniqueResults,
        });
    } catch (error) {
            console.error('自定义API聚合搜索处理错误:', error);
            const specificError = getSpecificErrorMessage(error);
            return JSON.stringify({
                code: 400,
                msg: specificError,
                list: []
            });
        }
}

// 拦截API请求
(function() {
    const originalFetch = window.fetch;
    
    window.fetch = async function(input, init) {
        const requestUrl = typeof input === 'string' ? new URL(input, window.location.origin) : input.url;
        
        if (requestUrl.pathname.startsWith('/api/')) {
            if (window.isPasswordProtected && window.isPasswordVerified) {
                if (window.isPasswordProtected() && !window.isPasswordVerified()) {
                    return;
                }
            }
            try {
                const data = await handleApiRequest(requestUrl);
                return new Response(data, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            } catch (error) {
                return new Response(JSON.stringify({
                    code: 500,
                    msg: '服务器内部错误',
                }), {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
            }
        }
        
        // 非API请求使用原始fetch
        return originalFetch.apply(this, arguments);
    };
})();

async function testSiteAvailability(apiUrl) {
    try {
        // 使用更简单的测试查询
        const response = await fetch('/api/search?wd=test&customApi=' + encodeURIComponent(apiUrl), {
            // 添加超时
            signal: AbortSignal.timeout(5000)
        });
        
        // 检查响应状态
        if (!response.ok) {
            return false;
        }
        
        const data = await response.json();
        
        // 检查API响应的有效性
        return data && data.code !== 400 && Array.isArray(data.list);
    } catch (error) {
        console.error('站点可用性测试失败:', error);
        return false;
    }
}
