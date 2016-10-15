/* jslint node: true, esnext: true */

'use strict';

const net = require('net'),
  msgpack = require('msgpack'),
  path = require('path'),
  fs = require('fs'),
  spawn = require('child_process').spawn;

exports.queryMode = ['M', 'V', 'I'];

const PredefinedSymbolLookup = [
  'Void', 'RunTimeEnvironment', 'ArchitectureSize',
  'Package', 'Holds', 'Input', 'Output', 'Target',
  'Destination', 'Source', 'Count', 'Direction',
  'Entity', 'Attribute', 'Value', 'Search', 'Varying',
  'Link', 'Unlink', 'Create', 'Destroy', 'Serialize',
  'Deserialize', 'UnnestEntity', 'UnnestAttribute',
  'Message', 'Row', 'Column', 'BlobType', 'Natural',
  'Integer', 'Float', 'UTF8', 'CloneBlob', 'SliceBlob',
  'GetBlobSize', 'DecreaseBlobSize', 'IncreaseBlobSize',
  'At'
];

const PredefinedSymbols = {};
PredefinedSymbolLookup.forEach((s, i) => {
  PredefinedSymbols[s] = i;
});

exports.PredefinedSymbols = PredefinedSymbols;

const queryMask = {
  /*
  MMM: 0,
  VMM: 1,
  IMM: 2,
  MVM: 3,
  VVM: 4,
  IVM: 5,
  MIM: 6,
  VIM: 7,
  IIM: 8,
  MMV: 9,
  VMV: 10,
  IMV: 11,
  MVV: 12,
  VVV: 13,
  IVV: 14,
  MIV: 15,
  VIV: 16,
  IIV: 17,
  MMI: 18,
  VMI: 19,
  IMI: 20,
  MVI: 21,
  VVI: 22,
  IVI: 23,
  MII: 24,
  VII: 25,
  III: 26
  */
};

exports.queryMask = queryMask;

for (let i = 0; i < 27; ++i) {
  const key = exports.queryMode[i % 3] + exports.queryMode[Math.floor(i / 3) % 3] + exports.queryMode[Math.floor(i / 9) %
    3];
  queryMask[key] = i;
}

exports.open = function (options = {}) {

  const port = options.port || 1337;
  const host = options.host || '::1';

  return new Promise((fullfill, reject) => {
    const socket = new net.Socket(),
      msgpackStream = new msgpack.Stream(socket),
      promiseQueue = [];

    const symbolToNameCache = {};

    const symbolCache = new Map();

    const connection = {
      request: (...args) => {
        const packet = msgpack.pack(args);
        return new Promise((resolve, reject) => {
          promiseQueue.push({
            resolve, reject
          });
          socket.write(packet);
          //console.log('sending', packet);
        });
      },

      nameToSymbol: (name) => connection.deserializeBlob(`"${name}"`),

      symbolToName: (symbol) => {
        let name = PredefinedSymbolLookup[symbol] || symbolToNameCache[symbol];
        if (name !== undefined) {
          return name;
        }

        return connection.query(false, queryMask.MMV, symbol, PredefinedSymbols.BlobType, 0).then(result =>
          connection.readBlob(symbol).then(result => {
            const name = result.toString();
            //console.log(`${symbol} -> ${name}`);
            symbolToNameCache[symbol] = name;
            return name;
          })
        );
      },

      decodeSymbolWithCache: (symbol) => {
        const d = symbolCache.get(symbol); 
        if (d !== undefined) {
          //console.log(`already found: ${symbol}`);
          d.access += 1;
          return Promise.resolve(d.object);
        }

        const p = connection.decodeSymbol(symbol).then(decoded => {
          //console.log(`add ${symbol} -> ${decoded.name}`);
          symbolCache.set(symbol, { access: symbolCache.get(symbol).access, object: decoded });
          return decoded;
        });
        
        symbolCache.set(symbol, { access: 0, object: p });

        return p;
      },

      decodeSymbol: (symbol) => {
        return connection.query(false, queryMask.MVV, symbol, 0, 0).then(avs => {
          const valuesAndTypes = [];

          //console.log(`avs: ${avs}`);
          for (let i = 0; i < avs.length; i += 2) {
            const value = avs[i + 1] + 0;
            valuesAndTypes.push(connection.readBlob(value));
            valuesAndTypes.push(connection.query(false, queryMask.MMV, value, PredefinedSymbols.BlobType,
              0));
          }

          return Promise.all(valuesAndTypes).then(valuesAndTypes => {
            const object = {};
            const promises = [];

            for (let i = 0; i < valuesAndTypes.length; i += 2) {
              let v = valuesAndTypes[i];
              const type = valuesAndTypes[i + 1][0];

              switch (type) {
                case PredefinedSymbols.UTF8:
                  v = v.toString();
                  break;
                case PredefinedSymbols.Natural:
                  v = v.readUInt32LE(0);
                  break;
                case PredefinedSymbols.Integer:
                  v = v.readInt32LE(0);
                  break;
                default:
                  console.log(
                    `unknown type '${type}' ${typeof type} ${JSON.stringify(type)} for ${v}`);
              }
              //console.log(`${avs[i]} ${v} (${type})`);

              const propertyName = connection.symbolToName(avs[i]);
              if (propertyName.then) {
                promises.push(propertyName.then(name => object[name] = v));
              } else {
                object[propertyName] = v;
              }
            }
            return Promise.all(promises).then(() => object);
          });
        });
      },

      upload: (text, packageSymbol = PredefinedSymbols.Void) => {
        const buffer = Buffer.from(text);
        return connection.createSymbol().then(textSymbol =>
          connection.setBlobSize(textSymbol, buffer.length * 8).then(() =>
            connection.writeBlob(textSymbol, 0, buffer.length * 8, buffer).then(() =>
              connection.link(textSymbol, PredefinedSymbols.BlobType, PredefinedSymbols.UTF8).then(() =>
                connection.deserializeBlob(textSymbol, packageSymbol).then(data => {
                  connection.releaseSymbol(textSymbol);
                  return Array.isArray(data) ? data : connection.decodeSymbol(data).then(r =>
                    Promise.reject(r)
                  );
                }))
            )
          )
        );
      }
    };

    [
      'createSymbol', 'releaseSymbol',
      'getBlobSize', 'setBlobSize', 'decreaseBlobSize', 'increaseBlobSize', 'readBlob', 'writeBlob',
      'deserializeBlob',
      'query', 'link', 'unlink'
    ].forEach(
      name => {
        connection[name] = (...args) => connection.request(name, ...args);
      });

    //socket.on('data', data => console.log('received', data));
    msgpackStream.addListener('msg', data => promiseQueue.shift().resolve(data));

    socket.on('error', error => {
      socket.destroy();
      reject(error);
    });

    socket.on('close', () => {
      promiseQueue.forEach(p => p.reject());
      promiseQueue.length = 0;
      socket.destroy();
    });

    if (options.store === undefined) {
      socket.connect(port, host, error => {
        if (error) {
          reject(error);
        } else {
          fullfill(connection);
        }
      });
    } else {
      const process = spawn(path.join(__dirname, 'SymatemAPI'), [options.store]);
      process.stdout.on('data', data => console.log(`stdout: ${data}`));
      process.stderr.on('data', data => console.error(`stderr: ${data}`));
      process.on('error', err => console.error(`Failed to start child process. ${err}`));

      connection.close = () => {
        process.kill();
        return Promise.resolve();
      };

      setTimeout(() =>
        socket.connect(port, host, error => {
          if (error) {
            reject(error);
          } else {
            fullfill(connection);
          }
        }), 300);
    }
  });
};
