const net = require('net');

const server = net.createServer();

const shutdownGrace = process.env.SHUTDOWN_GRACE || 5000;
const PORT = process.env.PORT || 80;

function interrupt() {
  server.close();
  server.getConnections(function (err, count) {
    if (!err && count) {
      console.error('Waiting for clients to disconnect. Grace', shutdownGrace);
      setTimeout(function () {
        process.exit();
      }, shutdownGrace);
    } else if (err) {
      console.fatal('Error while receiving interrupt! Attempt to bail, no grace.', err);
      process.exit();
    }
  });
};

server.on('connection', (clientToProxySocket) => {
  console.log('Client Connected To Proxy');
  // We need only the data once, the starting packet
  clientToProxySocket.once('data', (data) => {
    // If you want to see the packet uncomment below
    // console.log(data.toString());

    let isTLSConnection = data.toString().indexOf('CONNECT') !== -1;

    // By Default port is 80
    let serverPort = 80;
    let serverAddress;
    if (isTLSConnection) {
      // Port changed if connection is TLS
      serverPort = data.toString()
        .split('CONNECT ')[1].split(' ')[0].split(':')[1];;
      serverAddress = data.toString()
        .split('CONNECT ')[1].split(' ')[0].split(':')[0];
    } else {
      serverAddress = data.toString().split('Host: ')[1].split('\r\n')[0];
    }

    console.log(serverAddress);

    let proxyToServerSocket = net.createConnection({
      host: serverAddress,
      port: serverPort
    }, () => {
      console.log('PROXY TO SERVER SET UP');
      if (isTLSConnection) {
        clientToProxySocket.write('HTTP/1.1 200 OK\r\n\n');
      } else {
        proxyToServerSocket.write(data);
      }

      clientToProxySocket.pipe(proxyToServerSocket);
      proxyToServerSocket.pipe(clientToProxySocket);

    });

    proxyToServerSocket.on('error', (err) => {
      console.log('PROXY TO SERVER ERROR');
      console.log(err);
    });

    clientToProxySocket.on('error', err => {
      console.log('CLIENT TO PROXY ERROR');
      console.error(err);
    });
  });
});

server.on('error', (err) => {
  console.log('SERVER ERROR');
  console.error(err);
});

server.on('close', () => {
  console.log('Client Disconnected');
});

server.listen(PORT, () => {
  console.log(`Server runnig at http://0.0.0.0:${PORT}`);
});

process.once('SIGINT', interrupt);