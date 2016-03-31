def main():
    import json
    import cli
    data = {}

    try:
        community = json.loads(cli.clid('show snmp community'))
        data['community'] = community
    except:
        pass

    try:
        host = json.loads(cli.clid('show snmp host'))
        data['host'] = host
    except:
        pass

    try:
        group = json.loads(cli.clid('show snmp group'))
        data['group'] = group
    except:
        pass

    return data
