#!/bin/bash
set -e
CLOUD_CONFIG_FILE=pxe-cloud-config.yml

<% if( typeof progressMilestones !== 'undefined' && progressMilestones.installToDiskUri ) { %>
curl -X POST -H 'Content-Type:application/json' 'http://<%=server%>:<%=port%><%-progressMilestones.installToDiskUri%>' || true
<% } %>

curl -o $CLOUD_CONFIG_FILE http://<%=server%>:<%=port%>/api/current/templates/$CLOUD_CONFIG_FILE?nodeId=<%=nodeId%>
sudo coreos-install -d <%=installDisk%> -c $CLOUD_CONFIG_FILE -b <%=repo%>

<% if (typeof ignitionScriptUri !== 'undefined') { %>
# Customizations for supporting CoreOS Ignition:
mkdir /mnt/coreos
OEM_PARTITION_NUM=6 # https://coreos.com/os/docs/latest/sdk-disk-partitions.html
mount <%=installDisk%>${OEM_PARTITION_NUM} /mnt/coreos/
echo "set linux_append=\"coreos.first_boot=1 coreos.config.url=<%=ignitionScriptUri%>\"" > /mnt/coreos/grub.cfg
<%} %>

curl -X POST -H 'Content-Type:application/json' http://<%=server%>:<%=port%>/api/current/notification?nodeId=<%=nodeId%>
sudo reboot
