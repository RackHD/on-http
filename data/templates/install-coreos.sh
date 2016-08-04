#!/bin/bash
set -e
curl -O http://<%=server%>:<%=port%>/api/current/templates/pxe-cloud-config.yml
sudo coreos-install -d <%=installDisk%> -c pxe-cloud-config.yml -b <%=repo%>
wget --spider http://<%=server%>:<%=port%>/api/current/templates/<%=completionUri%>
sudo reboot
