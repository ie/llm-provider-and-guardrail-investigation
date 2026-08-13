export async function withRetry(fn, isThrottled, maxRetries = 4) {
    for (let attempt = 0; ; attempt++) {
        try {
            return await fn()
        } catch (err) {
            if (!isThrottled(err) || attempt >= maxRetries) throw err
            const delayMs = 1000 * 2 ** attempt
            await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
    }
}
