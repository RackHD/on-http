#!/usr/local/python/3.3.2/bin/python3

import json
from CLI import CLI

def main():
    data = {}

    try:
        output = CLI('show version', do_print=False).get_output()
        data = output[2]
    except:
        pass

    return data
