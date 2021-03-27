# How to Deploy vipsinfo

vipsinfo is splitted into 3 repos:
* [https://github.com/vipstar-dev/vipsinfo](https://github.com/vipstar-dev/vipsinfo)
* [https://github.com/vipstar-dev/vipsinfo-api](https://github.com/vipstar-dev/vipsinfo-api)
* [https://github.com/vipstar-dev/vipsinfo-ui](https://github.com/vipstar-dev/vipsinfo-ui)

## Prerequisites

* node.js v12.0+
* mysql v8.0+
* redis v5.0+

## Deploy VIPSTARCOIN Core
1. `git clone --recursive https://github.com/vipstar-dev/VIPSTARCOIN.git --branch=vipsinfo`
2. Follow the instructions of [https://github.com/vipstar-dev/VIPSTARCOIN/blob/master/README.md#building-vipstarcoin-core](https://github.com/vipstar-dev/VIPSTARCOIN/blob/master/README.md#building-vipstarcoin-core) to build VIPSTARCOIN
3. Run `vipstarcoind` with `-logevents=1` enabled

## Deploy vipsinfo
1. `git clone https://github.com/vipstar-dev/vipsinfo.git`
2. `cd vipsinfo && yarn install`
3. Create a mysql database and import [docs/structure.sql](structure.sql)
4. Edit file `vipsinfo-node.json` and change the configurations if needed.
5. `yarn dev`

It is strongly recommended to run `vipsinfo` under a process manager (like `pm2`), to restart the process when `vipsinfo` crashes.

## Deploy vipsinfo-api
1. `git clone https://github.com/vipstar-dev/vipsinfo-api.git`
2. `cd vipsinfo-api && yarn install`
3. Create file `config/config.prod.js`, write your configurations into `config/config.prod.js` such as:
    ```javascript
    exports.security = {
        domainWhiteList: ['http://example.com']  // CORS whitelist sites
    }
    // or
    exports.cors = {
        origin: '*'  // Access-Control-Allow-Origin: *
    }

    exports.sequelize = {
        logging: false  // disable sql logging
    }
    ```
    This will override corresponding field in `config/config.default.js` while running.
4. `yarn start`

## Deploy vipsinfo-ui
This repo is optional, you may not deploy it if you don't need UI.
1. `git clone https://github.com/vipstar-dev/vipsinfo-ui.git`
2. `cd vipsinfo-ui && yarn install`
3. Edit `package.json` for example:
   * Edit `script.build` to `"build": "QTUMINFO_API_BASE_CLIENT=/api/ QTUMINFO_API_BASE_SERVER=http://localhost:3001/ QTUMINFO_API_BASE_WS=//example.com/ nuxt build"` in `package.json` to set the api URL base
   * Edit `script.start` to `"start": "PORT=3000 nuxt start"` to run `vipsinfo-ui` on port 3000
4. `yarn build`
5. `yarn start`
