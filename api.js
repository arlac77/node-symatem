/* jslint node: true, esnext: true */

'use strict';

const net = require('net'),
  msgpack = require('msgpack');

exports.queryMode = ['M', 'V', 'I'];

exports.queryMask = {
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

for (let i = 0; i < 27; ++i) {
  const key = exports.queryMode[i % 3] + exports.queryMode[Math.floor(i / 3) % 3] + exports.queryMode[Math.floor(i / 9) %
    3];
  exports.queryMask[key] = i;
}

exports.open = function (host = '::1', port = 1337) {
  return new Promise((fullfill, reject) => {
    const socket = new net.Socket(),
      msgpackStream = new msgpack.Stream(socket),
      promiseQueue = [];

    const connection = {
      request: (...args) => {
        const packet = msgpack.pack(args);
        return new Promise((resolve, reject) => {
          promiseQueue.push({
            resolve, reject
          });
          socket.write(packet);
          console.log('sending', packet);
        });
      },
      symbolNamed: (name) => connection.deserializeBlob(`"${name}"`),
      upload: (text) =>
        Promise.all([connection.createSymbol(), connection.createSymbol()]).then(args => {
          const [textSymbol, packageSymbol] = args;
          return connection.setBlobSize(textSymbol, text.length * 8).then(() =>
            connection.writeBlob(textSymbol, 0, text.length * 8, Buffer.from(text)).then(() =>
              connection.link(textSymbol, 28, 32).then(() =>
                connection.deserializeBlob(textSymbol, packageSymbol).then(data => {
                  connection.releaseSymbol(textSymbol);
                  return {
                    packageSymbol, symbols: data
                  };
                })
              )
            )
          );
        })
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

    socket.on('data', data => console.log('received', data));
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

    socket.connect(port, host, error => {
      if (error) {
        reject(error);
      } else {
        fullfill(connection);
      }
    });
  });
};
