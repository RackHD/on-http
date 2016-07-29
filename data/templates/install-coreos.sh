#!/bin/bash
set -e
curl -O http://<%=server%>:<%=port%>/api/current/templates/pxe-cloud-config.yml
sudo coreos-install -d <%=installDisk%> -c pxe-cloud-config.yml -b <%=repo%>
sudo reboot
