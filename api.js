'use strict';

const net = require('net'),
      msgpack = require('msgpack');

const HOST = '::1', PORT = 1337,
      socket = new net.Socket(),
      msgpackStream = new msgpack.Stream(socket),
      promiseQueue = [];

msgpackStream.addListener('msg', function(data) {
    promiseQueue.shift().resolve(data);
});

socket.on('error', function(error) {
    console.log('Error');
    socket.destroy();
});

socket.on('close', function() {
    console.log('Lost connection');
    for(var i = 0; i < promiseQueue.length; ++i)
        promiseQueue[i].reject();
    promiseQueue.length = 0;
});

socket.connect(PORT, HOST, function() {
    request('query', 9, 1, 2, 0).then(function(data) {
        console.log('Then', data);
    }, function() {
        console.log('Then failed');
    });
});

const request = function() {
    const packet = msgpack.pack(Array.from(arguments));
    return new Promise(function(resolve, reject) {
        promiseQueue.push({'resolve':resolve, 'reject':reject});
        socket.write(packet);
        console.log(packet);
    });
};
