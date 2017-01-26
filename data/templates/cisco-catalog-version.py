def main():
    import json
    # Python module names vary depending on nxos version
    try:
        from cli import clid
    except:
        from cisco import clid
    data = {}

    try:
        # The "as is" will cause dumps from taskrunner.py to produce an invalid jason string
        dataString = clid('show version')
        dataString = dataString.replace("\\\"as is,\\\"", "as is")
        data = json.loads(dataString)
    except:
        pass

    return data
