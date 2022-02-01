#!/bin/env python3

import ssl
import base64
import paho.mqtt.client as paho

class Server(object):
    
    def __init__(self, host, port, cert, key, id, servicename):
        self.id = id
        self.host = host
        self.port = port
        self.cert = cert
        self.key = key
        self.servicename = servicename
        self.onmsg = None
        self.onconnect = None
        self.ondisconnect = None
        self._incoming = None
        self._outgoing = None
        self.connected = False
        self.buffer = b''
        self._create_tls()

    def _create_tls(self):
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(self.cert, self.key)
        context.set_ciphers('ALL:@SECLEVEL=1')
        
        self._incoming = ssl.MemoryBIO()
        self._outgoing = ssl.MemoryBIO()
        
        self.tls = context.wrap_bio(self._incoming, self._outgoing, server_side=True, session=None)
    
    def connect(self, ):
        self.mqtt = paho.Client()
        def on_connect(client, userdata, flags, rc):
            client.subscribe(f'{self.servicename}/{self.id}')
            client.publish(f'{self.servicename}/status/{self.id}', '{}', retain=True)
        self.mqtt.on_connect = on_connect
        self.mqtt.will_set(f'{self.servicename}/status/{self.id}', 
                        payload=None, qos=0, retain=True)
        self.mqtt.connect(self.host, self.port, 60)
        
    def send(self, data):
        self.tls.write(data.encode('utf-8'))
        
    def setup(self):
        def on_message(client, userdata, msg):
            if msg.payload.endswith(b'\t'):
                return
            if msg.payload.endswith(b'  '):
                self.buffer += msg.payload.strip()
                return
            else:
                self.buffer += msg.payload.strip()
            data = base64.b64decode(self.buffer)
            self.buffer = b''
            if len(data) == 0:
                return
            self._incoming.write(data)
            try:
                if not self.connected:
                    self.tls.do_handshake()
                    self.connected = True
                    if self.onconnect:
                        self.onconnect()
                else:
                    data = self.tls.read().decode('utf-8')
                    if self.onmsg:
                        self.onmsg(data)
            except ssl.SSLWantReadError:
                pass
            except BaseException as e:
                print('error: ' + str(e))
                self.connected = False
                self.buffer = b''
                if self.ondisconnect:
                    self.ondisconnect()
                self._create_tls()
                
        self.mqtt.on_message = on_message
        
    def loop(self):
        self.mqtt.loop()
    
        if self._outgoing and self._outgoing.pending:
            msg = base64.b64encode(self._outgoing.read())
            parts = [msg[i:i+128] for i in range(0, len(msg), 128)]
            pid = 0
            for part in parts:
                msg = part + b'\t' * (len(parts) - pid)
                self.mqtt.publish(f'{self.servicename}/{self.id}', msg)
                pid += 1