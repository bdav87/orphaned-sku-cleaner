// PURPOSE: Check for orphaned SKUs and remove them
const https = require('https');
const bodyparser = require('body-parser');
const dotenv = require('dotenv');
const readline = require('readline');

dotenv.load();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

const options = {
    host: process.env.BC_URL,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.BC_AUTH,
        'Accept': 'application/json'
      },
      path: `/api/v2/products/skus?limit=250`,
      method: 'GET'
}

// Returns the number of pages to iterate over
function init() {
    console.log('App initialized. Retrieving all SKUs and filtering them for orphans. Stand by...\n');
    let body = '', count = 0, pages = 0;
    options.path = '/api/v2/products/skus/count';
    options.method = 'GET';
    const countRequest = https.request(options, function(response) {
        if (response.statusCode != '200') {
            console.log('You were not authorized - check API credentials');
            return rl.close();
        }
        response.on('data', (d) => {
            body += d;
            count = JSON.parse(body).count;
            pages = Math.ceil(count/250);
            // Exit because there are no SKUs
            if (count === 0) {
                process.stdout.write(`No option SKUs detected on this store`);
                rl.close();
            }
        });
        response.on('end', () => {
            retrieveSKUs(pages);
        });
        response.on('error', (e)=>{
            console.log(`API responded with an error: ${e}`);
        });
    });
        countRequest.on('error', (e) => {
            console.log("error: " + e);
        });
        countRequest.end();
    
  };

init();

function retrieveSKUs(pages) {
    // This function will be invoked multiple times if there are more than 250 SKUs.
    // The current page is passed in the pagenum parameter.
    function skuAPIrequest(pagenum) {

        return new Promise((resolve,reject)=> {

        options.path = '/api/v2/products/skus?limit=250&page=' + pagenum;
    
        const getSKUs = https.request(options, function(response) {
            let body = '';
            response.on('data', (d) => {
            body += d;
            });
            response.on('end', () => {
                resolve(body);
            });
        });
    
        getSKUs.on('error', (e) => {
            reject(e)
            console.log(e);
        });
        getSKUs.end();
        });
    }

    // Iterates over every page and filters out orphans
    for (i = 1; i < pages + 1; i++) {
        skuAPIrequest(i).then((d)=> {
            checkPageForOrphans(d);
        }).then(()=>{
            checkProgress(pages);            
        }).catch((e)=>{
            console.log(`Error: ${e}`);
        })
    }
}
function checkProgress(pages) {
    if (countSKUrequests == pages) {
        rl.write(`Orphaned SKU IDs: ${orphans}\n`);
        return postScanPrompt();    
    }
}

let orphans = [];
let countSKUrequests = 0;

// Ultimately need to check for product_id = 0
// Guaranteed ID used to verify results in testing
function checkPageForOrphans(pageData) {
    let pageSKUs = JSON.parse(pageData);
    pageSKUs.forEach(SKU => {
        if (SKU.product_id == '35979') {
            orphans.push(SKU.id);
        }
    });
    countSKUrequests++;
}

rl.on('close', () => {
    rl.write('\nExiting program. Good luck in your life endeavours\n')
    process.exit(0);
})

function postScanPrompt() {
    process.stdout.write('\n');
    rl.question('List orphan IDs again? (y/n): ', (ans)=>{
        let answer = ans.toLowerCase();

        if (answer == 'y'){
            rl.write(`${orphans.toString()}\n`);
            postScanPrompt();
        } 
        if (answer == 'n'){
            orphanRemovePrompt();
        }
        if (answer != 'y' && answer != 'n') {
            rl.write('It\'s a yes or no question.\n');
            postScanPrompt();
        }
    });
    return;
}

function orphanRemovePrompt() {

    rl.question(`Remove ${orphans.length} orphans? (y/n): `, (ans) => {
        let answer = ans.toLowerCase();

        if (answer == 'y'){
            
            removeOrphans(orphans);
        }
        if (answer == 'n'){
            rl.write('You have decided to leave the orphans alone.\n');
            rl.close();
        }
        if (answer != 'y' && answer != 'n') {
            rl.write('It\'s a yes or no question.\n');
            postScanPrompt();
        }

    });
    return;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function removeOrphans(orphan_list) {
    let progbar = require('pace')(orphan_list.length);
    let deleted = 0;

    for (index in orphan_list) {
        
        if (index != 0 && index % 10 === 0) {
            await sleep(100);
        }
        options.path = `/api/v2/products/skus/${orphan_list[index]}`;
        options.method = 'DELETE';

        https.request(options, response => {
            
            response.on('data', () => {});
            response.on('end', () => {
                progbar.op();
                deleted++
                if (deleted == orphan_list.length) {
                    rl.write(`\n\n${deleted} orphaned SKUs removed.\n`);
                    rl.close();
                }
            });
            response.on('error', (err) => {
                console.log('Request error', error);
            })
        }).end();
    }
}
    