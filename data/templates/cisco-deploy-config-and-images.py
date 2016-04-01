import os
import shutil
# Python module names vary depending on nxos version
try:
    from cli import cli
except:
    from cisco import cli


def deploy_startup_config():
    startup_config_uri = '<%= (hasOwnProperty("startupConfigUri") ? startupConfigUri : "" )%>'
    if not startup_config_uri:
        return

    tmp_config_path = "volatile:poap.cfg"
    tmp_config_path_unix = "/volatile/poap.cfg"

    try:
        os.remove(tmp_config_path_unix)
    except:
        pass

    cli("copy %s %s vrf management" % (startup_config_uri, tmp_config_path))
    cli("copy %s running-config" % tmp_config_path)


def deploy_boot_images():
    boot_image_uri = '<%= (hasOwnProperty("bootImageUri") ? bootImageUri : "" )%>'
    if not boot_image_uri:
        return

    image_dir = "bootflash:poap_images"
    image_dir_new = "%s_new" % image_dir
    image_dir_unix = "/bootflash/poap_images"
    image_dir_new_unix = "%s_new" % image_dir_unix
    image_dir_old_unix = "%s_old" % image_dir_unix

    # Cisco won't let us remove images being used for the current boot,
    # so mark them for deletion on the NEXT upgrade. This means we will have
    # three image versions on disk:
    #     - The current ones (bootflash:poap_images_new/)
    #     - The previous ones (bootflash:poap_images_old/)
    #     - The original ones which we never modify (bootfalsh:)

    if os.path.isdir(image_dir_old_unix):
        shutil.rmtree(image_dir_old_unix)

    if os.path.isdir(image_dir_new_unix):
        os.rename(image_dir_new_unix, image_dir_old_unix)
    else:
        os.mkdir(image_dir_old_unix)

    os.mkdir(image_dir_new_unix)

    # Download images
    image_path = "%s/<%=bootImage%>" % image_dir_new
    kickstart_path = "%s/<%=kickstartImage%>" % image_dir_new
    kickstart_uri = "<%=kickstartUri%>"

    cli("copy %s %s vrf management" % (kickstart_uri, kickstart_path))
    cli("copy %s %s vrf management" % (boot_image_uri, image_path))

    # Set boot variables, system image first
    cli("configure terminal ; boot system %s" % image_path)
    cli("configure terminal ; boot kickstart %s" % kickstart_path)


def main():
    deploy_startup_config()
    deploy_boot_images()
    # Copying to scheduled-config is necessary for POAP to exit on the next
    # reboot and apply the configuration. We want to merge the running-config
    # changes made by both the startup-config deployment
    # and the boot image deployment.
    # The issue is if we copy to scheduled-config MORE THAN ONCE it will
    # trigger POAP/config application MORE THAN ONCE as well, which we don't want.
    # So we have to do all these operations in the same script, that way they
    # are not order-dependant.
    cli("copy running-config startup-config")
    cli("copy running-config scheduled-config")
