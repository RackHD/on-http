#!/usr/bin/env python

# Copyright 2016, EMC, Inc.

"""
This script is to do Secure Erase (SE) on a compute node
Four methods/tools are integrated in this scripts
A log file will be created for each disk to be erased named after disk name, like sdx.log
"""

import os
import sys
import re
import subprocess
import argparse
import time
import json
from multiprocessing import Pool
from multiprocessing import cpu_count
from filecmp import cmp as file_compare

ARG_PARSER = argparse.ArgumentParser(description='RackHD secure-erase argument')

ARG_PARSER.add_argument("-d", action="append", default=[], type=str,
                        help="Disks to be erased with arguments")

ARG_PARSER.add_argument("-v", action="store", default="lsi", type=str,
                        help="RAID controller vendor info")

ARG_PARSER.add_argument("-t", action="store", type=str,
                        help="Specify secure erase tool, "
                             "scrub, hdpram, sg_format, sg_sanitize are supported")

ARG_PARSER.add_argument("-o", action="store", type=str,
                        help='Specify SE options. '
                             'For SG_format SE options, "0"/"1" are supported, '
                             'stands for erasing/not erasing GLIST.\n '
                             'For scrub SE options, "nnsa", "dod", "fillzero", '
                             '"random", "random2", "fillff", "gutmann", "schneier", '
                             '"fastold", "pfitzner7", "pfitzner33", "usarmy", '
                             '"old", "fastold" and "custom=string" are supported.'
                             'Please read scrub man page for more details. \n'
                             'For sg_sanitize SE options, "block", "crypto", "fail" are supported. '
                             'Overwrite option is not supported at current stage. '
                             'Please read tool man page for more details \n'
                             'For hdparm, "secure-erase" and "secure-erase-enhanced" are supported')

ARG_LIST = ARG_PARSER.parse_args()

RAID_VENDOR_LIST = {
    "lsi": "/opt/MegaRAID/storcli/storcli64",
    "dell": "/opt/MegaRAID/perccli/perccli64"
}
SE_PASSWORD = "rackhd_secure_erase"
FRONT_SKIP = "4096"
HDPARM_RETRY_EXITCODES = [5]
COMMAND_LOG_MARKER = "\n==========================" \
                     "==========================\n"


def create_jbod(disk_arg, raid_tool):
    """
    Create JBOD for each physical disk under a virtual disk.
    :param disk_arg: a dictionary contains disk argument
    :param raid_tool: tools used for JBOD creation, storcli and perccli are supported
    :return: a list contains disk OS names, like ["/dev/sda", "/dev/sdb", ...]
    """
    for slot_id in disk_arg["slotIds"]:
        cmd = [raid_tool, slot_id, "set", "jbod"]
        subprocess.check_output(cmd, shell=False)
    disk_list_with_jbod = []

    # scsi id is used to map virtual disk to new JBOD
    # scsi id is made up of adapter:scsi:dev:lun as below:
    #   adapter id [host]: controller ID, ascending from 0.
    #       Usually c0 for one controller in server Megaraid info
    #   scsi id [bus]: a number of 0-15.
    #       Usually different for RAID(like 2) and JBOD(like 0)
    #   device id [target]: displayed as DID in Megaraid for each physical drives.
    #   LUN id [LUN]: Logic Unit Numbers, LUN is not used for drive mapping
    scsi_id_bits = disk_arg["scsiId"].split(":")
    scsi_id_bits[-1] = ""  # LUN ID is ignored
    # map jbod to disk device name with JBOD
    for device_id in disk_arg["deviceIds"]:
        scsi_info = scsi_id_bits[:]
        scsi_info[2] = str(device_id)
        anti_patten = re.compile(":".join(scsi_info))  # anti-patten to exclude scsi id for RAID
        scsi_info[1] = '[0-9]{1,2}'  # scsi id should be a number of 0-15
        patten = re.compile(":".join(scsi_info))
        cmd = ["ls", "-l", "/dev/disk/by-path"]

        # Retry 10 times in 1 second before OS can identify JBOD
        for i in range(10):
            time.sleep(0.1)
            try:
                lines = subprocess.check_output(cmd, shell=False).split("\n")
            except subprocess.CalledProcessError:
                continue
            # example for "ls -l /dev/disk/by-path" console output
            #   total 0
            #   drwxr-xr-x 2 root root 300 May 19 03:15 ./
            #   drwxr-xr-x 5 root root 100 May 16 04:43 ../
            #   lrwxrwxrwx 1 root root   9 May 19 03:06 pci-0000:06:00.0-scsi-0:2:0:0 -> ../../sdf
            #   lrwxrwxrwx 1 root root  10 May 19 03:06 pci-0000:06:00.0-scsi-0:2:0:0-part1 -> ../../sdf1
            #   lrwxrwxrwx 1 root root  10 May 19 02:31 pci-0000:06:00.0-scsi-0:2:1:0 -> ../../sda
            disk_name = ''
            for line in lines:
                if patten.search(line) and not anti_patten.search(line) and line.find("part") == -1:
                    disk_name = line.split("/")[-1]
                    break
            if disk_name:
                break

        assert disk_name, "Disk OS name is not found for deviceId " + str(device_id)
        disk_list_with_jbod.append("/dev/" + disk_name)
    return disk_list_with_jbod


def convert_raid_to_jbod():
    """
    To delete RAID and create JBOD for each physical disk of a virtual disk with RAID
    :rtype : list
    :return: a string includes all the disks to be erased
    """

    disk_argument_list = []
    # ARG_LIST.d should include at least following items as a string
    #   {
    #   "diskName": "/dev/sdx"
    #   "slotIds": ["/c0/e252/sx"]
    #   "deviceIds": [0]
    #   "virtualDisk": "/c0/vx"
    #   "scsiId": "0:0:0:0"
    #   }
    for arg in ARG_LIST.d:
        disk_argument_list.append(json.loads(arg))
    assert disk_argument_list != [], "no disk arguments includes"

    # Idenfity tools used for raid operation
    raid_controller_vendor = ARG_LIST.v
    assert raid_controller_vendor in RAID_VENDOR_LIST.keys(), "RAID controller vendor info is invalid"
    raid_tool = RAID_VENDOR_LIST[raid_controller_vendor]
    assert os.path.exists(raid_tool), "Overlay doesn't include tool path: " + raid_tool

    disk_list_without_raid = []
    for disk_argument in disk_argument_list:
        # if virtualDisk desn't exit, push disk directly into disk list
        if not disk_argument["virtualDisk"]:
            # disk_list_without_raid.append("/dev/" + disk_argument["diskName"])
            disk_list_without_raid.append(disk_argument["diskName"])
        else:
            command = [raid_tool, "/c0", "set", "jbod=on"]
            subprocess.check_output(command, shell=False)
            command = [raid_tool, disk_argument["virtualDisk"], "del", "force"]
            subprocess.check_output(command, shell=False)
            disk_list_without_raid += create_jbod(disk_argument, raid_tool)
    return disk_list_without_raid


def robust_check_call(cmd, log):
    """
    Subprocess check_call module with try-except to catch CalledProcessError
    Real time command output will be written to log file.
    :rtype : dict
    :param cmd: command option for subprocess.check_call, an array
    :param log: an opened file object to store stdout and stderr
    :return: a dict include exit_code and message info
    """
    assert isinstance(cmd, list), "Input commands is not an array"
    exit_status = {"exit_code": 0, "message": "check_call command succeeded"}
    log.write(COMMAND_LOG_MARKER + "[" + " ".join(cmd) + "] output:\n")
    log.flush()  # Align logs
    try:
        exit_code = subprocess.check_call(cmd, shell=False, stdout=log, stderr=log)
    except subprocess.CalledProcessError as exc:
        exit_status["message"] = exc.output
        exit_status["exit_code"] = exc.returncode
    else:
        exit_status["exit_code"] = exit_code
    return exit_status


def robust_check_output(cmd, log):
    """
    Subprocess check_output module with try-except to catch CalledProcessError
    Command output will be written to log file after commands finished
    :param cmd: command option for subprocess.check_output, an array
    :param log: an opened file object to store stdout and stderr
    :return: a dict include exit_code and command execution message
    """
    assert isinstance(cmd, list), "Input commands is not an array"
    exit_status = {"exit_code": 0, "message": "check_output command succeeded"}
    log.write(COMMAND_LOG_MARKER + "[" + " ".join(cmd) + "] output:\n")
    log.flush()  # Align logs
    try:
        output = subprocess.check_output(cmd, shell=False, stderr=log)
    except subprocess.CalledProcessError as exc:
        exit_status["message"] = exc.output
        exit_status["exit_code"] = exc.returncode
    else:
        exit_status["message"] = output
        log.write(str(exit_status) + "\n")
    return exit_status


def get_disk_size(disk_name, log, mark_files):
    """
    Get disk size and create empty mark files
    :param disk_name: disk name that be copied data to.
    :param log: an opened file object to store stdout and stderr
    :return: a string of disk size
    """
    # Filler drive size info from "fdisk -l /dev/sdx" commands
    command = ["fdisk", "-l", disk_name]
    disk_info = robust_check_output(command, log)
    assert disk_info["exit_code"] == 0, "Can't get drive %s size info" % disk_name
    output = disk_info["message"]
    # Output example for the line contains disk size info:
    # Disk /dev/sdx: 400.1 GB, 400088457216 bytes
    disk_size = "0"
    pattern = re.compile(r".*%s.* (\d{10,16}) bytes" % disk_name)
    # Match disk with size from 1G to 1P
    for line in output.split("\n"):
        match_result = pattern.match(line)
        if pattern.match(line):
            disk_size = match_result.group(1)
            break
    assert disk_size != "0", "Disk size should not be 0"
    for name in mark_files:
        try:
            os.mknod(name)
        except OSError:  # if file exits, ignore OSError
            continue
    return disk_size


def mark_on_disk(disk_name, log, flag, back_skip, mark_files):
    """
    Copy 512 Bytes random data to specified disk address as a mark.
    Or to read the marks from disk for verification
    :param disk_name: disk name that be copied data to.
    :param log: an opened file object to store stdout and stderr
    :param flag: a flag to choose mark creation or verification action
    :return:
    """
    # Raw data will be restored in document mark_data, size is 512 byte
    # Contents of mark_data will be write to both front/back end of disk addresses
    commands = [
        ["dd", "if=/dev/urandom", "of=" + mark_files[0], "count=1"],
        ["dd", "if=" + mark_files[0], "of=" + disk_name, "seek=" + FRONT_SKIP, "count=1"],
        ["dd", "if=" + mark_files[0], "of=" + disk_name, "seek=" + back_skip, "count=1"],
        ["dd", "if=" + disk_name, "of=" + mark_files[1], "skip=" + FRONT_SKIP, "count=1"],
        ["dd", "if=" + disk_name, "of=" + mark_files[2], "skip=" + back_skip, "count=1"]
    ]
    if not flag:
        # Create marks
        for command in commands:
            exit_status = robust_check_call(command, log)
            assert exit_status["exit_code"] == 0, "Command [ %s ] failed" % " ".join(command)
        assert file_compare(mark_files[0], mark_files[1]), \
            "Disk front mark data is not written correctly"
        assert file_compare(mark_files[0], mark_files[2]), \
            "Disk back mark data is not written correctly"
    else:
        # Verify marks
        for command in commands[3:5]:
            exit_status = robust_check_call(command, log)
            assert exit_status["exit_code"] == 0, "Command [ %s ] failed" % " ".join(command)
        assert not file_compare(mark_files[0], mark_files[1]), \
            "Disk front mark data exists after erasing"
        assert not file_compare(mark_files[0], mark_files[2]), \
            "Disk back mark data exists after erasing"
    return


def record_timestamp(log, action):
    """
    Record erase start/complete timestamp for each disk
    :param log: secure erase log file
    :param action: secure erase start/complete string
    """
    log.write(COMMAND_LOG_MARKER + action + " erase time is:\n")
    log.write(time.strftime("%Y-%m-%d %X", time.localtime()) + "\n\n")
    return


def secure_erase_base(disk_name, cmd):
    """
    Basic SE function
    :param disk_name: disk to be erased
    :param cmd: a list includes secure erase command argument
    :return: a dict includes SE command exitcode and SE message
    """
    name = disk_name.split("/")[-1]
    log_file = name + ".log"  # log file for sdx will be sdx.log
    log = open(log_file, "a")

    record_timestamp(log=log, action="start")

    # Create mark on disk
    mark_files = ["_".join([name, "mark_data"]),
                  "_".join([name, "front_end"]),
                  "_".join([name, "back_end"])]
    disk_size = get_disk_size(disk_name, log, mark_files)
    back_skip = str(int(disk_size) / 512 - int(FRONT_SKIP))
    mark_on_disk(disk_name, log, False, back_skip, mark_files)  # Create marks on disk

    # Retry 3 times to run secure erase command
    # This is a workaround for hdparm/dd tool comfliction
    exit_status = {}
    for i in range(3):
        exit_status = robust_check_call(cmd=cmd, log=log)
        if exit_status["exit_code"] not in HDPARM_RETRY_EXITCODES:
            break
        time.sleep(0.5)
    if exit_status["exit_code"] == 0:
        mark_on_disk(disk_name, log, True, back_skip, mark_files)  # Verify marks on disk
    record_timestamp(log=log, action="complete")
    log.close()
    return exit_status


def hdparm_check_drive_status(pattern, disk_name, log):
    """
    Verify drive SE status use "hdparm -I /dev/sdx" command.
    :param pattern: re patten to match different SE status
    :param disk_name: disk device name
    :param log: an opened file object to store logs
    """
    command = ["hdparm", "-I", disk_name]
    exit_status = robust_check_output(cmd=command, log=log)
    assert exit_status["exit_code"] == 0, "Can't get drive %s SE or ESE status" % disk_name
    output = exit_status["message"]
    secure_index = output.find("Security")
    assert secure_index != -1, \
        "Can't find security info, probably disk %s doesn't support SE and ESE" % disk_name
    output_secure_items = output[secure_index:-1]
    assert pattern.match(output_secure_items), "Disk is not enabled for secure erase"
    return


def hdparm_secure_erase(disk_name, se_option):
    """
    Secure erase using hdparm tool
    :param disk_name: disk to be erased
    :param se_option: secure erase option
    :return: a dict includes SE command exitcode and SE message
    """
    # enhance_se = ARG_LIST.e
    log_file = disk_name.split("/")[-1] + ".log"  # log file for sdx will be sdx.log
    log = open(log_file, "a")
    if se_option:
        hdparm_option = "--" + se_option
    else:
        hdparm_option = "--security-erase"  # Default is security erase

    # Hdparm SE Step1: check disk status
    #
    # Secure Erase supported output example
    # Security:
    #        Master password revision code = 65534
    #                supported
    #        not     enabled
    #        not     locked
    #        not     frozen
    #        not     expired: security count
    #                supported: enhanced erase
    #        2min for SECURITY ERASE UNIT. 2min for ENHANCED SECURITY ERASE UNIT.
    # Checksum: correct
    #
    # except for "supported" and "enabled", other items should have "not" before them
    if hdparm_option == "--security-erase":
        pattern_se_support = re.compile(r'[\s\S]*(?!not)[\s]*supported[\s]*[\s\S]*enabled[\s]*not[\s]'
                                        r'*locked[\s]*not[\s]*frozen[\s]*not[\s]*expired[\s\S]*')
    else:
        pattern_se_support = re.compile(r'[\s\S]*(?!not)[\s]*supported[\s]*[\s\S]*enabled[\s]*not'
                                        r'[\s]*locked[\s]*not[\s]*frozen[\s]*not[\s]*expired[\s\S]*'
                                        r'supported: enhanced erase[\s\S]*')
    hdparm_check_drive_status(pattern_se_support, disk_name, log)

    # TODO: add section to unlocked a disk

    # Hdparm SE Step2: set password
    command = ["hdparm", "--verbose", "--user-master", "u",
               "--security-set-pass", SE_PASSWORD, disk_name]
    assert robust_check_call(command, log)["exit_code"] == 0, \
        "Failed to set password for disk " + disk_name

    # Hdparm SE Step3: confirm disk is ready for secure erase
    # both "supported" and "enabled" should have no "not" before them
    # other items should still  have "not" before them
    pattern_se_enabled = re.compile(r'[\s\S]*(?!not)[\s]*supported[\s]*(?!not)[\s]*enabled[\s]*not'
                                    r'[\s]*locked[\s]*not[\s]*frozen[\s]*not[\s]*expired[\s\S]*')
    hdparm_check_drive_status(pattern_se_enabled, disk_name, log)
    log.close()

    # Hdparm SE step4: run secure erase command
    command = ["hdparm", "--verbose", "--user-master", "u", hdparm_option, SE_PASSWORD, disk_name]
    return secure_erase_base(disk_name, command)


def sg_format_secure_erase(disk_name, se_option):
    """
    Secure erase using sg_format tool
    :param disk_name: disk to be erased
    :return: a dict includes SE command exitcode and SE message
    """
    if se_option:
        glist_erase_bit = "--cmplst=" + se_option
    else:
        glist_erase_bit = "--cmplst=1"  # default Glist erasing disabled

    command = ["sg_format", "-v", "--format", glist_erase_bit, disk_name]
    return secure_erase_base(disk_name, cmd=command)


def sg_sanitize_secure_erase(disk_name, se_option):
    """
    Secure erase using sg_sanitize tool
    :param disk_name: disk to be erased
    :return: a dict includes SE command exitcode and SE message
    """
    if se_option:
        sanitize_option = "--" + se_option
    else:
        sanitize_option = "--block"  # default use block erasing
    command = ["sg_sanitize", "-v", sanitize_option, disk_name]
    return secure_erase_base(disk_name, cmd=command)


def scrub_secure_erase(disk_name, se_option):
    """
    Secure erase using scrub tool
    :param disk_name: disk to be erased
    :return: a dict includes SE command exitcode and SE message
    """
    if se_option:
        scrub_option = se_option
    else:
        scrub_option = "nnsa"  # default use nnsa standard
    command = ["scrub", "-f", "-p", scrub_option, disk_name]  # -f is to force erase
    return secure_erase_base(disk_name, cmd=command)


if __name__ == '__main__':
    TOOL_MAPPER = {
        "scrub": scrub_secure_erase,
        "hdparm": hdparm_secure_erase,
        "sg_format": sg_format_secure_erase,
        "sg_sanitize": sg_sanitize_secure_erase
    }
    tool = ARG_LIST.t
    option = ARG_LIST.o
    assert tool in ["scrub", "hdparm", "sg_format", "sg_sanitize"], \
        "Secure erase tool is not supported"

    # Get drive list without RAID
    disk_list = set(convert_raid_to_jbod())

    # Get process count we should started
    user_count = len(disk_list)
    cpu_thread_count = cpu_count()
    if user_count > cpu_thread_count:
        process_count = cpu_thread_count
    else:
        process_count = user_count
    pool = Pool(process_count)

    # Run multiple processes for SE
    erase_output_list = []
    for disk in disk_list:
        erase_output = {"seMethod": tool, "disk": disk}
        result = pool.apply_async(TOOL_MAPPER[tool], args=(disk, option))
        erase_output["poolExitStatus"] = result
        erase_output_list.append(erase_output)

    # Parse erase exit message
    # .get() is a method blocks main process
    erase_result_list = []
    for erase_output in erase_output_list:
        erase_result = {"seMethod": erase_output["seMethod"],
                        "disk": erase_output["disk"]}
        try:
            pool_exit_result = erase_output["poolExitStatus"].get()
        except AssertionError as err:
            erase_result["exitcode"] = -1
            erase_result["message"] = err
        else:
            erase_result["exitcode"] = pool_exit_result["exit_code"]
            if pool_exit_result["exit_code"] == 0:
                erase_result["message"] = "Secure erase completed successfully"
            else:
                erase_result["message"] = pool_exit_result["message"]
        erase_result_list.append(erase_result)

    pool.close()
    pool.join()

    print erase_result_list

    for erase_result in erase_result_list:
        if erase_result["exitcode"]:
            msg = "Drive %s failed to run secure erase with tool %s, error info are: \n %s" \
                  % (erase_result["disk"], erase_result["seMethod"], erase_result["message"])
            sys.exit(msg)
