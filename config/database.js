const path = require('path');

const runtimeRoot = path.resolve(__dirname, '..').replace(/\\/g, '/');
const appEnv = (process.env.APP_ENV || process.env.NODE_ENV || process.env.PASSENGER_APP_ENV || '').toLowerCase();
const appUrl = (process.env.APP_URL || '').toLowerCase();

const isLocalRuntime =
    ['local', 'development', 'dev', 'test'].includes(appEnv) ||
    appUrl.includes('localhost') ||
    process.platform === 'win32';

const isProductionRuntime =
    appEnv === 'production' ||
    runtimeRoot.startsWith('/home/halljyqm/admin.finalovers.cricket');

const useProductionDatabase = isProductionRuntime && !isLocalRuntime;

console.log(`Using ${useProductionDatabase ? 'productiondb.js' : 'localdb.js'} database configuration.`);

module.exports = useProductionDatabase
    ? require('./productiondb')
    : require('./localdb');
