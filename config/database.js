const path = require('path');

const runtimeRoot = path.resolve(__dirname, '..').replace(/\\/g, '/');
const appUrl = (process.env.APP_URL || '').toLowerCase();
const host = (process.env.HOSTNAME || '').toLowerCase();

const isLocalRuntime =
    process.platform === 'win32' ||
    runtimeRoot.includes('/users/') ||
    runtimeRoot[1] === ':' ||
    appUrl.includes('localhost') ||
    host.includes('localhost');

const isProductionRuntime =
    runtimeRoot.startsWith('/home/halljyqm/admin.finalovers.cricket') ||
    appUrl.includes('admin.finalovers.cricket');

const useProductionDatabase = isProductionRuntime && !isLocalRuntime;

console.log(`Using ${useProductionDatabase ? 'productiondb.js' : 'localdb.js'} database configuration.`);

module.exports = useProductionDatabase
    ? require('./productiondb')
    : require('./localdb');
