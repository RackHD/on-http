def main():
    import json
    # Python module names vary depending on nxos version
    try:
        from cli import clid
    except:
        from cisco import clid
    data = {}

    try:
        data = json.loads(clid('show version'))
    except:
        pass

    return data
