const NSEClient = require('./src/services/NSEClient');

(async () => {
    try {
        console.log("Fetching intraday for HAL.NS via NSEClient...");
        const res = await NSEClient.intradayChart('HAL.NS');
        console.log("Response:", res);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
})();
