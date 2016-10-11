#!/bin/bash
set -e
curl -O http://<%=server%>:<%=port%>/api/current/templates/pxe-cloud-config.yml
sudo coreos-install -d <%=installDisk%> -c pxe-cloud-config.yml -b <%=repo%>
curl -X POST -H 'Content-Type:application/json' http://<%=server%>:<%=port%>/api/current/notification?nodeId=<%=nodeId%>
sudo reboot
