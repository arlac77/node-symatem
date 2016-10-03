/* jslint node: true, esnext: true */

'use strict';

const net = require('net'),
  msgpack = require('msgpack');

exports.queryMode = ['M', 'V', 'I'];
exports.queryMask = {};

for (let i = 0; i < 27; ++i) {
  const key = exports.queryMode[i % 3] + exports.queryMode[(i / 3) % 3] + exports.queryMode[(i / 9) % 3];
  exports.queryMask[key] = i;
}

exports.open = function (host = '::1', port = 1337) {
  const socket = new net.Socket(),
    msgpackStream = new msgpack.Stream(socket),
    promiseQueue = [];

  const connection = {
    socket: socket,
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
    upload: (text) =>
      Promise.all([connection.createSymbol(), connection.createSymbol()]).then(args => {
        const [textSymbol, packageSymbol] = args;
        return connection.setBlobSize(textSymbol, text.length * 8).then(() =>
          connection.writeBlob(textSymbol, 0, text.length * 8, Buffer.from(text)).then(() =>
            connection.link(textSymbol, 28, 32).then(() =>
              connection.deserializeBlob(textSymbol, packageSymbol).then(data => {
                console.log(data);
                connection.releaseSymbol(textSymbol);
                return packageSymbol;
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
    console.log(`error: ${error}`);
    socket.destroy();
  });

  socket.on('close', () => {
    console.log('Lost connection');
    promiseQueue.forEach(p => p.reject());
    promiseQueue.length = 0;
  });

  return new Promise((f, r) => {
    socket.connect(port, host, error => {
      if (error) {
        r(error);
      } else {
        f(connection);
      }
    });
  });
};
