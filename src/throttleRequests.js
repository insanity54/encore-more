// greetz https://stackoverflow.com/a/45460625/1004931
let throttleRequests = (axiosInstance, intervalMs) => {
  let lastInvocationTime;
  const httpRequestThrottler = (config) => {
    const now = Date.now();
    if (lastInvocationTime) {
      lastInvocationTime += intervalMs;
      const waitPeriodForThisRequest = lastInvocationTime - now;
      if (waitPeriodForThisRequest > 0) {
        return new Promise((resolve) => {
          setTimeout(
            () => resolve(config),
            waitPeriodForThisRequest
          )
        });
      }
    }
    lastInvocationTime = now;
    return config;
  }
  axiosInstance.interceptors.request.use(httpRequestThrottler);
}

module.exports = throttleRequests;
