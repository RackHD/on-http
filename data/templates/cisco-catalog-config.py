def main():
    import json
    # Python module names vary depending on nxos version
    try:
        from cli import cli
    except:
        from cisco import cli
    data = {}

    try:
        data['startup-config'] = cli('show startup-config')[0]
        data['running-config'] = cli('show running-config')[0]
    except:
        pass

    return data
