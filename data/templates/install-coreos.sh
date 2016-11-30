#!/bin/bash
set -e
CLOUD_CONFIG_FILE=pxe-cloud-config.yml
curl -o $CLOUD_CONFIG_FILE http://<%=server%>:<%=port%>/api/current/templates/$CLOUD_CONFIG_FILE?nodeId=<%=nodeId%>
sudo coreos-install -d <%=installDisk%> -c $CLOUD_CONFIG_FILE -b <%=repo%>
curl -X POST -H 'Content-Type:application/json' http://<%=server%>:<%=port%>/api/current/notification?nodeId=<%=nodeId%>
sudo reboot
