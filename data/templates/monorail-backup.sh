set -e

cd /tmp
rm -f /tmp/monorail_backup_files.txt

backup_file=$1
repository='$repo'

function for_each_repo() {
    for repo in on-http on-taskgraph on-dhcp-proxy on-tftp on-syslog;
    do
        eval $*
    done
}

function stop_service() {
    echo $1
    status=`sudo initctl status $1`
    if [[ "$status" != "$1 stop/waiting" ]];
    then
        sudo initctl stop $1
    fi
}

function add_file() {
    echo $1
    echo $1 >> "./monorail_backup_files.txt"
}

function echo_progress() {
    echo
    echo "#========================================================#"
    echo "#    "$*
    echo "#========================================================#"
    echo
}

if [ -z "$backup_file" ];
then
    echo "Path to backup file is not set!"
    echo "sudo ./monorail-backup.sh <backup_file>"
    exit 1
fi

echo_progress "Shutting down services..."
for_each_repo "stop_service \"$repository\""
echo dhcpd
if pgrep dhcpd
then
    sudo killall dhcpd
fi

# --------
# Mongo
# --------
echo_progress "Creating mongo database backup..."
mongodump -d pxe

# --------

echo_progress "Generating backup file list..."

add_file "./dump"

# --------
# Configuration
# --------
for_each_repo "add_file \"/var/renasar/$repository/config.json\""
add_file "/opt/onrack/etc/monorail.json"

# --------
# DHCP
# --------
add_file "/var/lib/dhcp/dhcpd.leases"

# --------
# Files
# --------
add_file "/var/renasar/on-http/.tmp"
add_file "/var/renasar/on-http/static"

# --------
# Make the upgrade blob
# --------
echo_progress "Compressing upgrade files..."
echo -e $file_list > files.txt
sudo tar --ignore-failed-read -czvf $backup_file -T /tmp/monorail_backup_files.txt

echo_progress "Upgrade blob created at /tmp/$backup_file"
