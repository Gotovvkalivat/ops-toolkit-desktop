'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const html = read('public/index.html');
const shell = read('public/desktop.js');
const orders = read('public/orders/app.js');
const calculator = read('public/calculator/app.js');

const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const idSet = new Set(htmlIds);
const duplicateIds = htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index);
const shellSelectors = [...shell.matchAll(/\$\('#([^']+)'\)/g)].map(match => match[1]);
const missingIds = [...new Set(shellSelectors.filter(id => !idSet.has(id)))];

const orderActions = ['import', 'calculate', 'create', 'resolve', 'toggle-view', 'template', 'toggle-auto', 'start-over', 'stop'];
const calculatorActions = ['add-row', 'paste', 'import', 'calculate', 'template', 'example', 'toggle-auto', 'stop'];
const unsupportedOrders = orderActions.filter(action => !orders.includes(`action === '${action}'`));
const unsupportedCalculator = calculatorActions.filter(action => !calculator.includes(`action === '${action}'`));

if (duplicateIds.length || missingIds.length || unsupportedOrders.length || unsupportedCalculator.length) {
  console.error({ duplicateIds, missingIds, unsupportedOrders, unsupportedCalculator });
  process.exit(1);
}

console.log(`Shell contract OK: ${idSet.size} IDs, ${orderActions.length + calculatorActions.length} actions`);

