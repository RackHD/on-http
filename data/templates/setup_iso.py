# setup_iso.py [http://path.to/file.iso | /path/to/file.iso] [/var/destination]
#
# Deploy the ISO file contents to the specified destination directory such that
# destination directory can be used as a target for RackHD OS bootstrap workflows
import argparse
import subprocess
import os
import errno
import os.path
import tempfile
import atexit
import sys
import shutil
import re
import urllib

tmpdir = ''
verbose=1

# Cleanup
@atexit.register
def cleanup_tmp():
    if tmpdir != '':
        subprocess.check_call(['umount', tmpdir])
        os.rmdir(tmpdir)

def get_iso_info(fname):
    # Access ISO to determine OS type from supported list
    label1=subprocess.Popen(['isoinfo', '-i', fname, '-d'], stdout=subprocess.PIPE)
    return label1.stdout.read()

def do_setup_repo(osname, osver, src, dest, link):
    print 'Installing {0} {1} to {2}/{0}/{1}'.format(osname, osver, dest)
    print 'symbolic link base directory {0}'.format(link)
    dstpath=dest + '/' + osname + '/' + osver
    if os.path.isdir(dstpath):
        print 'Found existing directory, bailing...'
        sys.exit(1)

    if osname is 'ESXi':
        shutil.copytree(src, dstpath)

    if osname is 'RHEL' or osname is 'Centos':
        shutil.copytree(src, dstpath)

    if osname is 'LiveCD':
        initrd='initrd.img'
        vmlinuz='vmlinuz'
        if os.path.isfile(src+'/isolinux/initrd0.img'):
            initrd='initrd0.img'
            vmlinuz='vmlinuz0'
        mount1 = subprocess.Popen(['mount'], stdout=subprocess.PIPE)
        mount2 = subprocess.Popen(['grep', src], stdin=mount1.stdout, stdout=subprocess.PIPE)
        mount3 = subprocess.Popen(['awk', '{print $1}'], stdin=mount2.stdout, stdout=subprocess.PIPE)
        isoname = mount3.communicate()[0]

        iso_basename = os.path.basename(isoname).strip()
        iso_dirname = os.path.dirname(isoname).strip()

        os.makedirs(dstpath)
        
        syscall = '(cd "'+iso_dirname+'" && echo "'+iso_basename+'" | cpio -H newc --quiet -L -o )'
        syscall += ' | gzip -9'
        syscall += ' | cat '+src+'/isolinux/'+initrd+' - > '+dstpath+'/initrd.img'
        os.system(syscall)

        shutil.copyfile(src+'/isolinux/'+vmlinuz, dstpath+'/'+vmlinuz)


    os.system('ln -sf ' + dest + "/" + osname + ' ' + link + '/on-http/static/http/')
    os.system('ln -sf ' + dest + "/" + osname + ' ' + link + '/on-tftp/static/tftp/')

def mount_iso(fname):
    # Mount the ISO to tmp directory
    tmpdir=tempfile.mkdtemp()
    if os.path.isdir(tmpdir) and os.access(tmpdir, os.W_OK):
        try:
            subprocess.check_call(['mount', '-o', 'loop', fname, tmpdir])
        except subprocess.CalledProcessError as e:
            print 'Failed with error code: {0}'.format(e.returncode)
            os.rmdir(tmpdir)
            return ''
    else:
        print 'Unable to access ISO image'
        os.rmdir(tmpdir)
        return ''

    return tmpdir

def determine_os_ver(srcdir, iso_info):
    osname = ''
    osver = ''
    vid = ''
    m = re.search('^Volume id\:\s+(.+)$', iso_info, re.MULTILINE)
    if m:
        vid = m.group(1)

    if 'Application id: ESXIMAGE' in iso_info:
        osname='ESXi'
        if 'ESXI-6.0.0' in vid:
            osver='6.0'
        elif 'ESXI-5.5' in vid:
            osver='5.5'
    else:
        list=os.listdir(srcdir)
        if "RPM-GPG-KEY-redhat-release" in list:
            osname = 'RHEL'
            osver = '7.0'
        elif "RPM-GPG-KEY-CentOS-Testing-7" in list:
            osname = "Centos"
            osver = '7.0'
        elif 'LiveOS' and 'isolinux' in list:
            print 'attempting LiveCD netboot'
            osname = 'LiveCD'
            osver = vid
    return osname, osver

def show_progress(a,b,file_size):
    if verbose:
        file_size_dl = a * b
        status = r"%10d  [%3.2f%%]" % (file_size_dl, file_size_dl * 100. / file_size)
        status = status + chr(8)*(len(status)+1)
        print status,

parser = argparse.ArgumentParser(description='Setup the OS repo from an ISO image')
parser.add_argument('iso', metavar='N', help='the ISO image or URL to ISO image')
parser.add_argument('dest', metavar='N', help='the destination directory to setup')
parser.add_argument('--link', metavar='N', help='the symbolic link path', default='/var/renasar')
args = parser.parse_args()


# Ensure the image exists and is readable
fname = ''
if os.path.isfile(args.iso) and os.access(args.iso, os.R_OK):
    fname = args.iso
else:
    (filename,headers) = urllib.urlretrieve(url=args.iso,reporthook=show_progress)
    print '\n'
    fname = filename

tmpdir = mount_iso(fname)
if not tmpdir:
    print 'Failed to mount ISO image'
    sys.exit(1)

info = get_iso_info(fname)
if not info:
    print 'Failed to get iso info'
    sys.exit(1)

osname,osver = determine_os_ver(tmpdir, info)
if not osname or not osver:
    print 'Failed to get os name and/or os version information'
    sys.exit(1)

do_setup_repo(osname, osver, tmpdir, args.dest, args.link)

