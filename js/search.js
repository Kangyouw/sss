// 构建带筛选条件的查询字符串
function buildQueryString(query, filters = {}) {
    let queryStr = `?ac=videolist&wd=${encodeURIComponent(query)}`;
    
    // 添加筛选条件
    if (filters.area) {
        queryStr += `&area=${encodeURIComponent(filters.area)}`;
    }
    if (filters.year) {
        queryStr += `&year=${encodeURIComponent(filters.year)}`;
    }
    if (filters.type) {
        queryStr += `&type=${encodeURIComponent(filters.type)}`;
    }
    
    return queryStr;
}

// 构建带筛选条件的分页查询字符串
function buildPageQueryString(query, page, filters = {}) {
    let queryStr = `?ac=videolist&wd=${encodeURIComponent(query)}&pg=${page}`;
    
    // 添加筛选条件
    if (filters.area) {
        queryStr += `&area=${encodeURIComponent(filters.area)}`;
    }
    if (filters.year) {
        queryStr += `&year=${encodeURIComponent(filters.year)}`;
    }
    if (filters.type) {
        queryStr += `&type=${encodeURIComponent(filters.type)}`;
    }
    
    return queryStr;
}

// 检查黄色内容过滤是否启用
function isYellowContentFilterEnabled() {
    // 为了向后兼容，先检查新的键名，如果不存在再检查旧的键名
    const newValue = localStorage.getItem('yellowContentFilterEnabled');
    const oldValue = localStorage.getItem('yellowFilterEnabled');
    
    // 如果新键存在，使用新键值；如果新键不存在但旧键存在，使用旧键值；如果都不存在，默认启用过滤
    if (newValue !== null) {
        return newValue === 'true';
    } else if (oldValue !== null) {
        return oldValue === 'true';
    }
    // 默认启用过滤
    return true;
}

async function searchByAPIAndKeyWord(apiId, query, filters = {}) {
    try {
        // 如果启用了黄色内容过滤，检查当前API是否为成人内容源
        if (isYellowContentFilterEnabled() && !apiId.startsWith('custom_')) {
            const apiSource = API_SITES[apiId];
            if (apiSource && (apiSource.is_adult === true || apiSource.adult === true)) {
                return []; // 跳过成人内容源
            }
        }
        
        let apiUrl, apiName, apiBaseUrl;
        
        // 处理自定义API
        if (apiId.startsWith('custom_')) {
            const customIndex = apiId.replace('custom_', '');
            const customApi = getCustomApiInfo(customIndex);
            if (!customApi) return [];
            
            apiBaseUrl = customApi.url;
            apiUrl = apiBaseUrl + buildQueryString(query, filters);
            apiName = customApi.name;
        } else {
            // 内置API
            if (!API_SITES[apiId]) return [];
            apiBaseUrl = API_SITES[apiId].api;
            apiUrl = apiBaseUrl + buildQueryString(query, filters);
            apiName = API_SITES[apiId].name;
        }
        
        // 添加超时处理
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        // 添加鉴权参数到代理URL
        const proxiedUrl = await window.ProxyAuth?.addAuthToProxyUrl ? 
            await window.ProxyAuth.addAuthToProxyUrl(PROXY_URL + encodeURIComponent(apiUrl)) :
            PROXY_URL + encodeURIComponent(apiUrl);
        
        const response = await fetch(proxiedUrl, {
            headers: API_CONFIG.search.headers,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            return [];
        }
        
        const data = await response.json();
        
        if (!data || !data.list || !Array.isArray(data.list) || data.list.length === 0) {
            return [];
        }
        
        // 处理第一页结果
        const results = data.list.map(item => ({
            ...item,
            source_name: apiName,
            source_code: apiId,
            api_url: apiId.startsWith('custom_') ? getCustomApiInfo(apiId.replace('custom_', ''))?.url : undefined
        }));
        
        // 获取总页数
        const pageCount = data.pagecount || 1;
        // 确定需要获取的额外页数 (最多获取maxPages页)
        const pagesToFetch = Math.min(pageCount - 1, API_CONFIG.search.maxPages - 1);
        
        // 如果有额外页数，获取更多页的结果
        if (pagesToFetch > 0) {
            const additionalPagePromises = [];
            
            for (let page = 2; page <= pagesToFetch + 1; page++) {
                // 构建带筛选条件的分页URL
                const pageUrl = apiBaseUrl + buildPageQueryString(query, page, filters);
                
                // 创建获取额外页的Promise
                const pagePromise = (async () => {
                    try {
                        const pageController = new AbortController();
                        const pageTimeoutId = setTimeout(() => pageController.abort(), 15000);
                        
                        // 添加鉴权参数到代理URL
                        const proxiedPageUrl = await window.ProxyAuth?.addAuthToProxyUrl ? 
                            await window.ProxyAuth.addAuthToProxyUrl(PROXY_URL + encodeURIComponent(pageUrl)) :
                            PROXY_URL + encodeURIComponent(pageUrl);
                        
                        const pageResponse = await fetchWithRetry(proxiedPageUrl, {
                            headers: API_CONFIG.search.headers,
                            signal: pageController.signal,
                            timeout: 15000
                        }, 2, 1000);
                        
                        clearTimeout(pageTimeoutId);
                        
                        if (!pageResponse.ok) return [];
                        
                        const pageData = await pageResponse.json();
                        
                        if (!pageData || !pageData.list || !Array.isArray(pageData.list)) return [];
                        
                        // 处理当前页结果
                        return pageData.list.map(item => ({
                            ...item,
                            source_name: apiName,
                            source_code: apiId,
                            api_url: apiId.startsWith('custom_') ? getCustomApiInfo(apiId.replace('custom_', ''))?.url : undefined
                        }));
                    } catch (error) {
                        console.warn(`API ${apiId} 第${page}页搜索失败:`, error);
                        return [];
                    }
                })();
                
                additionalPagePromises.push(pagePromise);
            }
            
            // 等待所有额外页的结果
            const additionalResults = await Promise.all(additionalPagePromises);
            
            // 合并所有页的结果
            additionalResults.forEach(pageResults => {
                if (pageResults.length > 0) {
                    results.push(...pageResults);
                }
            });
        }
        
        return results;
    } catch (error) {
        console.warn(`API ${apiId} 搜索失败:`, error);
        return [];
    }
}