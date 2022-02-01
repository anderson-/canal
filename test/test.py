#!/bin/env python3

import json
import argparse
from canal.server import Server

parser = argparse.ArgumentParser(description='Canal server')
parser.add_argument('cert', help='certificate')
parser.add_argument('key', help='key')
parser.add_argument('id', help='id')
args = parser.parse_args()

with open('config.json') as json_file:
    config = json.load(json_file)
    
args.host = config['host']
args.port = config['mqttport']
args.servicename = config['servicename']

args = (
    args.host, 
    args.port, 
    args.cert, 
    args.key, 
    args.id, 
    args.servicename
)

s = Server(*args)

s.connect()
s.setup()

s.onmsg = lambda data: print(data)
s.onconnect = lambda: print('Connected')
s.ondisconnect = lambda: print('Disconnected')

while True:
    s.loop()
    