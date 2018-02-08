# orphaned-sku-cleaner
A command line tool to remove orphaned SKUs on BigCommerce stores.

## Instructions

### Setup
Run `$ npm install` to install Node dependencies.

This tool uses dotenv to populate BigCommerce V2 API credentials. Create a .env file in the project folder and write in the required environment variables in this format:

BC_AUTH='Basic B4s3643X4mPl3'

BC_URL='examplestore.com'

For more information on creating basic auth credentials, check out BigCommerce's documentation here: https://developer.bigcommerce.com/api/#obtaining-basic-auth-api-tokens

### Running the program

Run `$ npm start` to start the script. After the site is scanned for orphaned SKUs, you will be presented with a list of SKU values in case you want to manually check them via a REST client like Postman. Next, you'll be prompted to remove SKUs or exit the program.

To ensure safe deletion, the program will only remove 400 SKUs at a time. After SKUs are removed you're given the option to scan the site again or exit. 
