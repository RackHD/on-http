def main():
    import os

    # Python module names vary depending on nxos version
    try:
        from cli import cli
    except:
        from cisco import cli

    tmp_config_path = "volatile:poap.cfg"
    tmp_config_path_unix = "/volatile/poap.cfg"

    try:
        os.remove(tmp_config_path_unix)
    except:
        pass

    cli("copy <%=startupConfigUri%> %s vrf management" % tmp_config_path)
    cli("copy %s running-config" % tmp_config_path)
    cli("copy running-config startup-config")
    # copying to scheduled-config is necessary for POAP to exit on the next
    # reboot and apply the configuration. We want to merge the running-config
    # so we can work well with any other scripts that may also be applying
    # their changes to scheduled-config
    cli("copy running-config scheduled-config")
