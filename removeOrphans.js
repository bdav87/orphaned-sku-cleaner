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

let count = 0, pages = 0, values = [];
let orphans = [];

function countSKUs() {
    
    options.path = '/api/v2/products/skus/count';

    const countRequest = https.request(options, function(response){
      response.on('data', (d) => {
        count = JSON.parse(d).count;
        console.log('Total SKUs: ' + count);

        pages = Math.ceil(count/250);
        console.log('Pages: ' + pages);
      })
      .on('end', () => {
        //Invoke callback function
        console.log(`Scanning page: ${pages}`);
        retrieveSKUs();
      })
    })
      .on('error', (e) => {
        console.log("error: " + e);
      })
      .end();
    
  };
  //Invoking the countSKUs function to start the whole process
  countSKUs();



//Retrieve the SKUs
let countSKUrequests = 0;
function retrieveSKUs(){

    // This function will be invoked multiple times if there are more than 250 SKUs.
    // The current page is passed in the pagenum parameter.
    function skuAPIrequest(pagenum){
        console.log(`Retrieving page: ${pagenum}`);
        return new Promise((resolve,reject)=> {

        options.path = '/api/v2/products/skus?limit=250&page=' + pagenum;
    
        const getSKUs = https.request(options, function(response){
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

    //Invoke the API request, passing in the pages variable set in countRequest
    //skuAPIrequest(pages);
    
    for (i=1; i<pages+1; i++) {
        skuAPIrequest(i).then((d)=> {
            checkPageForOrphans(d);
        }).then(()=>{
            checkProgress();            
        })
    }

}
function checkProgress(){
    console.log(`Progress: ${countSKUrequests}\n`);
    if (countSKUrequests == pages) {
        console.log(`Complete\n`);
        console.log(`Orphaned SKU IDs: ${orphans}\n`);
        return postScanPrompt();    
    }     
}

// Ultimately need to check for product_id = 0
// Guaranteed ID used to verify results in testing
function checkPageForOrphans(pageData){
    //console.log(`Scanning page: ${countSKUrequests}`);
    let pageSKUs = JSON.parse(pageData);
    pageSKUs.forEach(SKU => {
        if (SKU.product_id == '0'){
            orphans.push(SKU.id);
        }
    });
    countSKUrequests++;
}

rl.on('close', ()=>{
    rl.write('\nExiting program. Good luck in your life endeavours\n')
    process.exit(0);
})

function postScanPrompt(){
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

function orphanRemovePrompt(){
    rl.question(`Remove ${orphans.length} orphans? (y/n): `, (ans) => {
        let answer = ans.toLowerCase();

        if (answer == 'y'){
            removeOrphans();
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

function removeOrphans(){
    let range = orphans.length;
    let count = 0;
    checkCount(count);
        orphans.forEach(id => {
            return new Promise((resolve, reject) => {
            options.path = `/api/v2/products/skus/${id}`;
            options.method = 'DELETE';
            const delRequest = https.request(options, (response)=> {
                let body = '';
                response.on('data', (data) => {
                    body += data;
                });
                response.on('end', ()=>{
                    console.log(`Orphan removed: ${id}`)
                    resolve(count++);
                });
            });
            delRequest.on('error', (err) => {
                console.log(`Error: ${err}`);
            })
            delRequest.end();
        }).then(()=>{
            checkCount(count);
        });      
    });
    
    function checkCount(ct){
        if (ct >= range) {
            rl.write(`\n${ct} orphans cleared.\n`);
            rl.close();
        }
    }

    
}
