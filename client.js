var mf = (function () {
  forge.options.usePureJavaScript = true;

	var tlsmqtt = {};
  tlsmqtt.serverlist = [];
  tlsmqtt.serverid = undefined;
  tlsmqtt.connected = false;
  tlsmqtt.onmsg = function(message) {
    console.log(`Received message: ${message}`);
  }
  tlsmqtt.onconnect = function(message) {
    console.log('connected');
  }
  tlsmqtt.ondisconnect = function(message) {
    console.log('disconnected');
  }
  tlsmqtt.onignored = function(message) {
    console.log('ignored');
  }
  tlsmqtt.ondiscovery = function(id, enter, list) {
    console.log(`discovery: ${id} ${enter} ${JSON.stringify(list)}`);
    if (!tlsmqtt.connected) {
      tlsmqtt.link(id);
    } else {
      tlsmqtt.tls.close();
    }
  }

  var buffer = '';

	function connect(options) {
    let id = Math.random().toString(16);
    ui = id.substring(2, id.length);
  
    if (options.mqtt == undefined) {
      options.mqtt = {
        keepalive: 60,
        clientId: 'mqttjs_' + id,
        protocolId: 'MQTT',
        protocolVersion: 4,
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
        will: {
          topic: 'WillMsg',
          payload: 'Connection Closed abnormally..!',
          qos: 0,
          retain: false
        },
      };
    }
    if (options.topic == undefined) {
      options.topic = '';
    }
    
    const host = `ws://${options.host}:${options.wsport}/mqtt`;
    const mqttC = mqtt.connect(host, options.mqtt);
    tlsmqtt.mqtt = mqttC;
  
    mqttC.on('error', (err) => {
      console.log('Connection error: ', err);
      mqttC.end();
      tlsmqtt.mqtt = null;
    });
    
    mqttC.on('reconnect', () => {
      console.log('Reconnecting...');
    });
	}

  function newTLS(options) {
    tlsmqtt.tx = 0;
    tlsmqtt.tls = forge.tls.createConnection({
      server: false,
      caStore: [options.ca],
      sessionCache: {},
      cipherSuites: [
        forge.tls.CipherSuites.TLS_RSA_WITH_AES_128_CBC_SHA,
        forge.tls.CipherSuites.TLS_RSA_WITH_AES_256_CBC_SHA],
      verify: function(connection, verified, depth, certs) {
        return verified;
      },
      connected: function(connection) {
        tlsmqtt.connected = true;
        tlsmqtt.onconnect();
      },
      tlsDataReady: function(connection) {
        data = forge.util.encode64(connection.tlsData.getBytes());
        var parts = [];
        for(var i = 0; i < data.length; i += 128) {
          parts.push(data.substr(i, 128));
        }
        for(var i = 0; i < parts.length; ++i) {
          message = parts[i] + ' '.repeat(parts.length - i);
          tlsmqtt.mqtt.publish(options.topic, message, { qos: 0, retain: false })
        }
        if (tlsmqtt.tx == 0) {
          console.log('started handshake');
          setTimeout(function() {
            if (tlsmqtt.connected != true) {
              console.log('handshake failed');
              tlsmqtt.tls.close();
              tlsmqtt.link(tlsmqtt.serverid);
            } else {
              console.log('handshake success');
            }
          }, 5000);
        }
        tlsmqtt.tx += 1;
      },
      dataReady: function(connection) {
        tlsmqtt.onmsg(forge.util.decodeUtf8(connection.data.getBytes()), connection);
      },
      closed: function(connection) {
        tlsmqtt.connected = false;
        tlsmqtt.ondisconnect();
      },
      error: function(connection, error) {
        console.log('error', error);
      }
    });
  }

  function setup(options) {
    connect(options);
    tlsmqtt.mqtt.on('connect', () => {
      tlsmqtt.mqtt.subscribe(`${options.servicename}/status/#`, { qos: 0 });
    });
    tlsmqtt.mqtt.on('message', (topic, message, packet) => {
      if (topic === options.topic) {
        message = message.toString();
        if (message.endsWith(' ')) {
        } else {
          if (message.endsWith('\t\t')) {
            buffer += message.trim();
          } else {
            buffer += message.trim();
            tlsmqtt.tls.process(forge.util.decode64(buffer));
            buffer = '';
          }
        }
      } else {
        topic = topic.split('/')
        let servicename = topic[0];
        if (servicename != options.servicename) {
          console.log(`${servicename} is not ${options.servicename}`);
          return;
        }
        let serverId = topic[topic.length - 1];
        if (message.toString().length == 0) {
          tlsmqtt.serverlist = tlsmqtt.serverlist.filter(function(obj) {
            return obj.id !== serverId;
          });
          tlsmqtt.ondiscovery(serverId, false, tlsmqtt.serverlist, {});
          if (tlsmqtt.serverid == serverId) {
            tlsmqtt.tls.close();
          }
        } else {
          let status = {
            id: serverId,
            status: JSON.parse(message.toString())
          };
          tlsmqtt.serverlist.push(status);
          tlsmqtt.ondiscovery(serverId, true, tlsmqtt.serverlist, status.status);
        }
      }
    });
    
    tlsmqtt.link = function (id) {
      newTLS(options);
      options.topic = `${options.servicename}/${id}`;
      tlsmqtt.serverid = id;
      tlsmqtt.mqtt.subscribe(options.topic, { qos: 0 });
      tlsmqtt.tls.handshake();
    };
  }

	tlsmqtt.moduleProperty = 1;
	tlsmqtt.connect = setup;

  tlsmqtt.send = function (message) {
    tlsmqtt.tls.prepare(forge.util.encodeUtf8(message));
  };

	return tlsmqtt;
}());