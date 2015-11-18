#!/bin/bash
curl -O http://<%=server%>:<%=port%>/api/common/templates/pxe-cloud-config.yml
sudo coreos-install -d <%=installDisk%> -c pxe-cloud-config.yml
sudo reboot
