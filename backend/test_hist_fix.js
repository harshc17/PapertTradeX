const HistoricalClient = require('./src/services/HistoricalClient');

(async () => {
    try {
        console.log("Fetching 1d for HAL.NS");
        const res1d = await HistoricalClient.historical('HAL.NS', '1d');
        console.log("1d data points:", res1d.length);
        if (res1d.length > 0) console.log("First point:", res1d[0], "Last point:", res1d[res1d.length - 1]);

        console.log("\nFetching 1w for HAL.NS");
        const res1w = await HistoricalClient.historical('HAL.NS', '1w');
        console.log("1w data points:", res1w.length);
        if (res1w.length > 0) console.log("First point:", res1w[0], "Last point:", res1w[res1w.length - 1]);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
})();
