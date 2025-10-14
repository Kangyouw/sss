// PWA 注册
// 安全的ServiceWorker注册实现
if ('serviceWorker' in navigator) {
    // 检查是否在安全上下文（HTTPS或localhost）中运行
    if (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // 使用setTimeout确保DOM完全加载，避免InvalidStateError
        setTimeout(() => {
            try {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(registration => {
                        console.log('ServiceWorker注册成功:', registration.scope);
                    })
                    .catch(error => {
                        console.warn('ServiceWorker注册失败:', error);
                        // 失败时不影响应用正常运行
                    });
            } catch (error) {
                console.warn('ServiceWorker注册过程异常:', error);
                // 捕获所有可能的异常，确保应用继续运行
            }
        }, 1000); // 延迟1秒后再尝试注册
    } else {
        console.log('ServiceWorker仅在安全上下文（HTTPS）中可用，当前为HTTP协议');
    }
} else {
    console.log('当前浏览器不支持ServiceWorker');
}
